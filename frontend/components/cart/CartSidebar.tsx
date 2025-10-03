"use client";

import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import type { TerminTag, CartItem } from '@/lib/cart-context';

function formatPrice(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);
}

const dayFormatter = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatCartDate(value: string) {
  const safeDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(safeDate.getTime()) ? value : dayFormatter.format(safeDate);
}

function formatTimePart(value?: string) {
  if (!value) return undefined;
  return value.slice(0, 5);
}

function formatCartDay(tag: TerminTag) {
  const dateLabel = formatCartDate(tag.datum);
  const start = formatTimePart(tag.startzeit);
  const end = formatTimePart(tag.endzeit);
  if (start && end) return `${dateLabel} · ${start} – ${end} Uhr`;
  if (start) return `${dateLabel} · ${start} Uhr`;
  if (end) return `${dateLabel} · ${end} Uhr`;
  return dateLabel;
}

function getSeminarTitle(item: CartItem) {
  const base = item.seminarName || item.titel || '';
  if (item.seminarName) return item.seminarName;
  if (item.titel.includes(' · ')) return item.titel.split(' · ')[0]?.trim() || base;
  if (item.titel.includes(' - ')) return item.titel.split(' - ')[0]?.trim() || base;
  return base.trim();
}

function sortTerminTage(tage: TerminTag[]) {
  return [...tage].sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
}

function getTerminTage(item: CartItem): TerminTag[] {
  if (Array.isArray(item.terminTage) && item.terminTage.length > 0) {
    return sortTerminTage(item.terminTage);
  }
  return [];
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
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-28">
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
            <ul className="space-y-5">
              {items.map((item) => {
                const isSeminar = item.type === 'seminar';
                const terminTage = isSeminar ? getTerminTage(item) : [];
                const displayTitle = isSeminar ? getSeminarTitle(item) : item.titel;
                return (
                  <li
                    key={item.id}
                    className="relative rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]"
                  >
                    <button
                      onClick={() => removeItem(item.id)}
                      className="absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold text-gray-400 transition hover:bg-gray-100 hover:text-red-500"
                      aria-label={`${item.titel} entfernen`}
                    >
                      ×
                    </button>
                    <div className="flex items-start gap-4 pr-6">
                      <div className="flex-1 text-sm">
                        <p className="text-base font-semibold text-gray-900">{displayTitle}</p>
                        {isSeminar ? (
                          terminTage.length > 0 ? (
                            <ul className="mt-2 space-y-1 text-xs text-gray-600">
                              {terminTage.map((tag) => (
                                <li key={`${item.id}-${tag.datum}-${tag.startzeit ?? ''}-${tag.endzeit ?? ''}`}>{formatCartDay(tag)}</li>
                              ))}
                            </ul>
                          ) : (
                            item.terminLabel && (
                              <p className="mt-2 text-xs text-gray-600">{item.terminLabel}</p>
                            )
                          )
                        ) : (
                          <div className="mt-2 space-y-1 text-xs text-gray-600">
                            {item.beschreibung && <p className="text-gray-500 whitespace-pre-line">{item.beschreibung}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                        <span>Menge</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateItem(item.id, { menge: Math.max(1, item.menge - 1) })}
                            className="flex size-7 items-center justify-center rounded-full border border-gray-200 text-base leading-none text-gray-700 transition hover:border-gray-400"
                            aria-label={`${item.titel} Menge verringern`}
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-gray-900">{item.menge}</span>
                          <button
                            onClick={() => updateItem(item.id, { menge: item.menge + 1 })}
                            className="flex size-7 items-center justify-center rounded-full border border-gray-200 text-base leading-none text-gray-700 transition hover:border-gray-400"
                            aria-label={`${item.titel} Menge erhöhen`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Bruttobetrag</p>
                        <p className="text-lg font-semibold text-gray-900">{formatPrice(item.preisBrutto * item.menge)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div
          className="border-t border-gray-100 bg-white px-6 pt-5 pb-10 shadow-[0_-12px_24px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 40px)' }}
        >
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
