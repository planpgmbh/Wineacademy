"use client";

import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';

function formatPrice(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);
}

export default function CartSidebar() {
  const { items, isOpen, closeCart, removeItem, updateItem } = useCart();
  const router = useRouter();
  const itemCount = items.reduce((sum, item) => sum + item.menge, 0);
  const totals = items.reduce(
    (acc, item) => {
      const brutto = item.preisBrutto * item.menge;
      const steuerSatz = Number(item.steuerSatz ?? 0);
      const netto = steuerSatz > 0 ? brutto / (1 + steuerSatz / 100) : brutto;
      const mwst = brutto - netto;
      acc.brutto += brutto;
      acc.netto += netto;
      acc.mwst += mwst;
      return acc;
    },
    { brutto: 0, netto: 0, mwst: 0 }
  );
  const total = totals.brutto;

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Warenkorb</h2>
          <p className="text-xs text-gray-500">{itemCount === 1 ? '1 Artikel' : `${itemCount} Artikel`}</p>
        </div>
        <button onClick={closeCart} className="text-sm text-gray-500 hover:text-gray-800">Schließen</button>
      </div>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-gray-600">
              <span>Der Warenkorb ist leer.</span>
              <button
                type="button"
                onClick={closeCart}
                className="rounded-full border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:border-gray-400"
              >
                Weiter einkaufen
              </button>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-gray-900">{item.titel}</p>
                      {item.terminLabel && <p className="text-xs text-indigo-600">{item.terminLabel}</p>}
                      {item.beschreibung && <p className="text-xs text-gray-500 whitespace-pre-line">{item.beschreibung}</p>}
                      <p className="text-xs text-gray-500">{formatPrice(item.preisBrutto)} · MwSt {item.steuerSatz}%</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs font-medium text-red-500 transition hover:text-red-600"
                    >
                      Entfernen
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-600">Menge</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateItem(item.id, { menge: Math.max(1, item.menge - 1) })}
                        className="flex size-8 items-center justify-center rounded-full border border-gray-200 text-lg leading-none text-gray-700 transition hover:border-gray-400"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-gray-900">{item.menge}</span>
                      <button
                        onClick={() => updateItem(item.id, { menge: item.menge + 1 })}
                        className="flex size-8 items-center justify-center rounded-full border border-gray-200 text-lg leading-none text-gray-700 transition hover:border-gray-400"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
                    <span>Zwischensumme</span>
                    <span className="font-medium">{formatPrice(item.preisBrutto * item.menge)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-gray-100 bg-white px-6 py-5 shadow-[0_-12px_24px_rgba(0,0,0,0.08)]">
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Zwischensumme (netto)</span>
              <span>{formatPrice(totals.netto)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>inkl. MwSt.</span>
              <span>{formatPrice(totals.mwst)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-gray-900">
              <span>Gesamtbetrag</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (items.length === 0) return;
              closeCart();
              router.push('/checkout');
            }}
            className={`mt-4 w-full rounded-full bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-900 ${
              items.length === 0 ? 'cursor-not-allowed opacity-40' : ''
            }`}
            disabled={items.length === 0}
          >
            Weiter zur Kasse
          </button>
          <p className="mt-3 text-xs text-gray-500">
            Preise inkl. gesetzlicher Mehrwertsteuer. Versandkosten fallen nicht an, da es sich um Seminare und digitale Produkte handelt.
          </p>
        </div>
      </div>
    </div>
  );
}
