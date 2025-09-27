"use client";

import { useCart } from '@/lib/cart-context';

export default function CartToggle() {
  const { items, toggleCart } = useCart();
  const count = items.reduce((sum, item) => sum + item.menge, 0);
  return (
    <button onClick={toggleCart} className="relative rounded border px-4 py-1 text-sm hover:bg-gray-100">
      Warenkorb
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  );
}
