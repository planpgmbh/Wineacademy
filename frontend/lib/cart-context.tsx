"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type TeilnehmerForm = {
  vorname: string;
  nachname: string;
  email?: string;
  wsetCandidateNumber?: string;
  besondereBeduerfnisse?: string;
  anmerkungen?: string;
  terminId?: number;
};

export type CartItem = {
  id: string;
  type: 'seminar' | 'produkt' | 'gutschein';
  titel: string;
  beschreibung?: string;
  produktId?: number;
  terminId?: number;
  terminLabel?: string;
  preisBrutto: number;
  steuerSatz: number;
  menge: number;
  participants: TeilnehmerForm[];
};

type CartContextShape = {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartItem, 'id'> & { id?: string }) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<Omit<CartItem, 'id'>>) => void;
  updateParticipants: (id: string, participants: TeilnehmerForm[]) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextShape | undefined>(undefined);

type ProviderProps = { children: React.ReactNode };

const normaliseParticipants = (item: Omit<CartItem, 'id'> & { id?: string } | CartItem): TeilnehmerForm[] => {
  const base = Array.isArray(item.participants) ? item.participants : [];
  if (item.type !== 'seminar') return [];
  const targetLength = Math.max(1, Number(item.menge ?? 1));
  const clone = [...base];
  while (clone.length < targetLength) {
    clone.push({ vorname: '', nachname: '', terminId: item.terminId });
  }
  if (clone.length > targetLength) {
    clone.length = targetLength;
  }
  return clone.map((p) => ({ ...p, terminId: item.terminId }));
};

const STORAGE_KEY = 'wineacademy_cart_v1';

function safeParseCart(value: string | null): CartItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Omit<CartItem, 'id'> & { id: string } => !!item && typeof item === 'object' && typeof item.id === 'string')
      .map((item) => ({
        ...item,
        participants: normaliseParticipants(item),
      }));
  } catch (err) {
    console.warn('[cart] Konnte gespeicherten Warenkorb nicht lesen', err);
    return [];
  }
}

export function CartProvider({ children }: ProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydrated) return;
    const stored = safeParseCart(window.localStorage.getItem(STORAGE_KEY));
    if (stored.length > 0) {
      setItems(stored);
    }
    setHydrated(true);
  }, [hydrated]);

  const addItem = useCallback((item: Omit<CartItem, 'id'> & { id?: string }) => {
    setItems((prev) => {
      const id = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
      const participants = normaliseParticipants(item);
      return [...prev, { ...item, id, participants }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<Omit<CartItem, 'id'>>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.menge !== undefined || patch.terminId !== undefined || patch.participants !== undefined) {
          next.participants = normaliseParticipants(next);
        }
        return next;
      })
    );
  }, []);

  const updateParticipants = useCallback((id: string, participants: TeilnehmerForm[]) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, participants: normaliseParticipants({ ...item, participants }) } : item))
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('[cart] Konnte Warenkorb nicht speichern', err);
    }
  }, [items, hydrated]);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextShape>(() => ({
    items,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    toggleCart: () => setIsOpen((prev) => !prev),
    addItem,
    removeItem,
    updateItem,
    updateParticipants,
    clear,
  }), [items, isOpen, addItem, removeItem, updateItem, updateParticipants, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('CartContext muss innerhalb CartProvider verwendet werden');
  return ctx;
}
