"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type CartItemType = "product" | "seminar";

export type CartItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  imageUrl: string;
  type: CartItemType;
  seminarDays?: string[];
};

type CartContextValue = {
  items: CartItem[];
  setItems: Dispatch<SetStateAction<CartItem[]>>;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  incrementQuantity: (id: string) => void;
  decrementQuantity: (id: string) => void;
  removeItem: (id: string) => void;
  total: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEYS = ["wineacademy-cart", "wineacademy.cart", "cart"];
const CART_UPDATE_EVENT = "wineacademy:cart:update";
const PLACEHOLDER_ITEMS: CartItem[] = [
  {
    id: "seminar-001",
    title: "Weinseminar: Einführung in die Welt der Rieslinge",
    description: "Intensiver Abend mit 5 Riesling-Weinen, Sensorik-Training und Food-Pairing.",
    price: 129,
    quantity: 2,
    imageUrl: "/images/cart/weinseminar-riesling.jpg",
    type: "seminar",
    seminarDays: ["Donnerstag, 14. November 2024", "Freitag, 15. November 2024"],
  },
  {
    id: "produkt-101",
    title: "Weinpaket \"Hamburger Klassiker\"",
    description: "Sechs Flaschen norddeutscher Winzer*innen, ideal als Geschenk.",
    price: 89,
    quantity: 1,
    imageUrl: "/images/cart/hamburger-klassiker.jpg",
    type: "product",
  },
];

const shouldUsePlaceholder = () => process.env.NODE_ENV !== "production";

type RawCartPayload = unknown;

type ParsedStorage = {
  key: string | null;
  items: CartItem[];
};

const uniqueIdFromIndex = (index: number) => `cart-item-${index}`;

const normalizeString = (value: unknown, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const normalizePrice = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const isCentAmount = value > 1000;
    return isCentAmount ? Math.round(value) / 100 : value;
  }
  if (typeof value === "string") {
    const sanitized = value.replace(/\s/g, "");
    const withoutSeparators = sanitized.replace(/\./g, "").replace(",", ".");
    const normalized = Number(withoutSeparators.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(normalized)) {
      return normalized > 1000 ? Math.round(normalized) / 100 : normalized;
    }
  }
  return 0;
};

const normalizeQuantity = (value: unknown, fallback = 1) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string") {
    const sanitized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(sanitized);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }
  return fallback;
};

const normalizeImage = (value: unknown) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.url === "string") {
      return record.url;
    }
    if (typeof record.src === "string") {
      return record.src;
    }
    if (typeof record.image === "string") {
      return record.image;
    }
    const nested =
      record.data && typeof record.data === "object"
        ? (record.data as Record<string, unknown>).attributes
        : undefined;
    if (nested && typeof nested === "object" && typeof (nested as Record<string, unknown>).url === "string") {
      return (nested as Record<string, unknown>).url as string;
    }
  }
  return "";
};

const normalizeSeminarDays = (value: unknown) => {
  const days: string[] = [];
  const addDay = (input: unknown) => {
    const text = normalizeString(input);
    if (text) {
      days.push(text);
    }
  };
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === "object" && item !== null) {
        const record = item as Record<string, unknown>;
        if ("label" in record) {
          addDay(record.label);
        } else if ("date" in record) {
          addDay(record.date);
        } else if ("title" in record) {
          addDay(record.title);
        } else {
          addDay(JSON.stringify(record));
        }
      } else {
        addDay(item);
      }
    });
  } else if (typeof value === "string") {
    addDay(value);
  } else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.days)) {
      record.days.forEach(addDay);
    } else if (Array.isArray(record.termine)) {
      record.termine.forEach(addDay);
    } else if (Array.isArray(record.seminarDays)) {
      record.seminarDays.forEach(addDay);
    } else if ("label" in record || "title" in record || "date" in record) {
      addDay(record.label ?? record.title ?? record.date);
    }
  }
  const seen = new Set<string>();
  return days.filter((day) => {
    if (!day || seen.has(day)) {
      return false;
    }
    seen.add(day);
    return true;
  });
};

const detectType = (raw: Record<string, unknown>, seminarDays: string[]) => {
  const rawType = normalizeString(raw.type);
  if (rawType === "seminar" || rawType === "product") {
    return rawType;
  }
  const category = normalizeString(raw.category ?? raw.kind ?? raw.section);
  if (category.toLowerCase().includes("seminar")) {
    return "seminar";
  }
  if (category.toLowerCase().includes("produkt") || category.toLowerCase().includes("product")) {
    return "product";
  }
  if (seminarDays.length > 0) {
    return "seminar";
  }
  return "product";
};

const toCartItem = (raw: unknown, index: number): CartItem | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const seminarDays = normalizeSeminarDays(
    record.seminarDays ??
      record.days ??
      record.termine ??
      record.eventDates ??
      record.schedule ??
      record.sessions ??
      record.dates,
  );

  const quantity = normalizeQuantity(record.quantity ?? record.qty ?? record.amount ?? 1);
  if (quantity <= 0) {
    return null;
  }

  const idCandidate =
    normalizeString(record.id) ||
    normalizeString(record.sku) ||
    normalizeString(record.slug) ||
    normalizeString(record.identifier);
  const title =
    normalizeString(record.title) ||
    normalizeString(record.name) ||
    normalizeString(record.headline) ||
    `Artikel ${index + 1}`;
  const description =
    normalizeString(record.description) ||
    normalizeString(record.subtitle) ||
    normalizeString(record.summary) ||
    "";
  const imageUrl = normalizeImage(
    record.imageUrl ?? record.image ?? record.thumbnail ?? record.cover ?? record.featuredImage,
  );
  const price = normalizePrice(record.price ?? record.unitPrice ?? record.total ?? record.grossTotal ?? 0);
  const type = detectType(record, seminarDays);

  return {
    id: idCandidate || uniqueIdFromIndex(index),
    title,
    description,
    imageUrl,
    price,
    quantity,
    type,
    seminarDays: seminarDays.length > 0 ? seminarDays : undefined,
  };
};

const parseCartValue = (value: RawCartPayload): CartItem[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item, index) => toCartItem(item, index))
      .filter((item): item is CartItem => Boolean(item));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      return record.items
        .map((item, index) => toCartItem(item, index))
        .filter((item): item is CartItem => Boolean(item));
    }
    if (Array.isArray(record.products)) {
      return record.products
        .map((item, index) => toCartItem(item, index))
        .filter((item): item is CartItem => Boolean(item));
    }
    if (Array.isArray(record.cart)) {
      return record.cart
        .map((item, index) => toCartItem(item, index))
        .filter((item): item is CartItem => Boolean(item));
    }
    if (Array.isArray(record.value)) {
      return record.value
        .map((item, index) => toCartItem(item, index))
        .filter((item): item is CartItem => Boolean(item));
    }
  }
  return [];
};

const readCartFromStorage = (): ParsedStorage => {
  if (typeof window === "undefined") {
    return { key: null, items: [] };
  }

  for (const key of CART_STORAGE_KEYS) {
    try {
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        continue;
      }
      const parsedJson = JSON.parse(rawValue) as RawCartPayload;
      const items = parseCartValue(parsedJson);
      if (items.length > 0) {
        return { key, items };
      }
    } catch {
      // Ignorieren – fehlerhafte Werte werden wie leerer Warenkorb behandelt.
    }
  }

  return { key: null, items: [] };
};

const calculateTotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export function CartProvider({ children }: { children: ReactNode }) {
  const [itemsState, setItemsState] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  const emitCartEvent = useCallback((items: CartItem[]) => {
    if (typeof window === "undefined") {
      return;
    }
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    window.dispatchEvent(
      new CustomEvent(CART_UPDATE_EVENT, {
        detail: { source: "CartProvider", count, items },
      }),
    );
  }, []);

  const persistCart = useCallback(
    (items: CartItem[]) => {
      if (typeof window === "undefined" || !hydratedRef.current) {
        return;
      }
      const key = storageKey ?? CART_STORAGE_KEYS[0];
      try {
        const payload = { items };
        window.localStorage.setItem(key, JSON.stringify(payload));
        emitCartEvent(items);
      } catch {
        // Ignorieren – bei Speicherfehlern behalten wir den UI-Status bei.
      }
    },
    [emitCartEvent, storageKey],
  );

  const setItems = useCallback(
    (updater: SetStateAction<CartItem[]>) => {
      setItemsState((previous) => {
        const next = typeof updater === "function" ? (updater as (value: CartItem[]) => CartItem[])(previous) : updater;
        persistCart(next);
        return next;
      });
    },
    [persistCart],
  );

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);

  const incrementQuantity = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity: item.quantity + 1 } : item)),
      );
    },
    [setItems],
  );

  const decrementQuantity = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev
          .map((item) =>
            item.id === id ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item,
          )
          .filter((item) => item.quantity > 0),
      );
    },
    [setItems],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [setItems],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const placeholderEnabled = shouldUsePlaceholder();
    const { key, items } = readCartFromStorage();
    const initialItems =
      items.length > 0 ? items : placeholderEnabled ? PLACEHOLDER_ITEMS : [];
    setItemsState(initialItems);
    setStorageKey(key ?? CART_STORAGE_KEYS[0]);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const placeholderEnabled = shouldUsePlaceholder();

    const handleStorage = (event: StorageEvent) => {
      if (event.key && !CART_STORAGE_KEYS.includes(event.key)) {
        return;
      }
      const { items } = readCartFromStorage();
      if (items.length > 0 || !placeholderEnabled) {
        setItemsState(items);
      } else if (placeholderEnabled) {
        setItemsState(PLACEHOLDER_ITEMS);
      }
    };

    const handleCartEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        source?: string;
        items?: unknown;
      }>;
      if (customEvent.detail?.source === "CartProvider") {
        return;
      }
      if (customEvent.detail?.items) {
        const nextItems = parseCartValue(customEvent.detail.items);
        if (nextItems.length > 0) {
          setItemsState(nextItems);
          return;
        }
      }
      const { items } = readCartFromStorage();
      if (items.length > 0 || !placeholderEnabled) {
        setItemsState(items);
      } else if (placeholderEnabled) {
        setItemsState(PLACEHOLDER_ITEMS);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(CART_UPDATE_EVENT, handleCartEvent as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(CART_UPDATE_EVENT, handleCartEvent as EventListener);
    };
  }, []);

  const total = useMemo(() => calculateTotal(itemsState), [itemsState]);

  const value = useMemo(
    () => ({
      items: itemsState,
      setItems,
      isOpen,
      openCart,
      closeCart,
      toggleCart,
      incrementQuantity,
      decrementQuantity,
      removeItem,
      total,
    }),
    [
      decrementQuantity,
      incrementQuantity,
      isOpen,
      itemsState,
      openCart,
      closeCart,
      toggleCart,
      removeItem,
      setItems,
      total,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart muss innerhalb von <CartProvider> verwendet werden.");
  }
  return context;
}
