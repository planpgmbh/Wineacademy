"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CartDrawer } from "./CartDrawer";

function readStoredCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem("cart:count");
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

export function CartDrawerProvider() {
  const [open, setOpen] = useState(false);
  const [countState, setCountState] = useState<number>(() => readStoredCount());
  const drawerId = useId();
  const countRef = useRef(countState);

  const broadcastCount = useCallback((next: number) => {
    const normalized = normalizeCount(next);
    countRef.current = normalized;
    setCountState(normalized);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cart:count", String(normalized));
      }
    } catch {
      // Persistenz optional; Fehler ignorieren.
    }

    if (typeof document !== "undefined") {
      document.dispatchEvent(
        new CustomEvent("cart:count", {
          detail: { count: normalized },
        })
      );
    }
  }, []);

  useEffect(() => {
    broadcastCount(countRef.current);
  }, [broadcastCount]);

  useEffect(() => {
    const handleToggle = () => setOpen(true);
    const handleClose = () => setOpen(false);

    document.addEventListener("cart:toggle", handleToggle);
    document.addEventListener("cart:close", handleClose);

    return () => {
      document.removeEventListener("cart:toggle", handleToggle);
      document.removeEventListener("cart:close", handleClose);
    };
  }, []);

  useEffect(() => {
    const handleAdd = (event: Event) => {
      const amount =
        event instanceof CustomEvent && typeof event.detail?.amount === "number" ? event.detail.amount : 1;
      broadcastCount(countRef.current + amount);
    };

    const handleSet = (event: Event) => {
      const value =
        event instanceof CustomEvent && typeof event.detail?.count === "number" ? event.detail.count : countRef.current;
      broadcastCount(value);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "cart:count") {
        const value = event.newValue ? Number.parseInt(event.newValue, 10) : 0;
        broadcastCount(value);
      }
    };

    document.addEventListener("cart:add", handleAdd as EventListener);
    document.addEventListener("cart:set", handleSet as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      document.removeEventListener("cart:add", handleAdd as EventListener);
      document.removeEventListener("cart:set", handleSet as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [broadcastCount]);

  return <CartDrawer id={drawerId} open={open} onClose={() => setOpen(false)} />;
}
