"use client";
import { useMemo, useState } from 'react';
import type { SeminarListItem } from '@/lib/api';
import Link from 'next/link';
import { useEffect } from 'react';

type Termin = NonNullable<NonNullable<SeminarListItem['termine']>[number]>;

function fmtTime(t?: string) {
  if (!t) return '';
  return t.slice(0, 5);
}
function fmtDateISOToGerman(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function labelForTermin(t: Termin) {
  const days = t.tage || [];
  if (days.length === 0) return `Termin #${t.id}`;
  const first = days[0];
  if (days.length === 1) {
    const time = `${fmtTime(first.startzeit)}–${fmtTime(first.endzeit)} Uhr`.replace(/^–/, '').replace(/–\sUhr$/, '');
    return [fmtDateISOToGerman(first.datum), time].filter(Boolean).join(' · ');
  }
  const last = days[days.length - 1];
  const sameMonthYear = first.datum.slice(0, 7) === last.datum.slice(0, 7);
  const [y, m, d1] = first.datum.split('-');
  const d2 = last.datum.split('-')[2];
  const range = sameMonthYear ? `${d1}.–${d2}.${m}.${y}` : `${fmtDateISOToGerman(first.datum)} – ${fmtDateISOToGerman(last.datum)}`;
  return [range].join(' · ');
}

function ortLabel(t: Termin) {
  return t.ort?.stadt || t.ort?.standort || t.ort?.veranstaltungsort || 'Ort n/a';
}

export default function BookingSidebar({ termine, fallbackPreis, slug }: { termine: NonNullable<SeminarListItem['termine']>; fallbackPreis?: number; slug: string }) {
  const allOrte = useMemo(() => {
    const labels = Array.from(new Set((termine || []).map(ortLabel)));
    return labels;
  }, [termine]);

  const [selectedOrt, setSelectedOrt] = useState(allOrte[0] || '');
  const filteredTermine = useMemo(() => (termine || []).filter(t => ortLabel(t) === selectedOrt), [termine, selectedOrt]);

  const terminOptions = useMemo(() => filteredTermine.map(t => ({ value: String(t.id), label: labelForTermin(t), data: t })), [filteredTermine]);
  const [selectedTerminId, setSelectedTerminId] = useState(terminOptions[0]?.value || '');
  const current = useMemo(() => terminOptions.find(o => o.value === selectedTerminId)?.data, [terminOptions, selectedTerminId]);

  const [anzahl, setAnzahl] = useState(1);
  const priceSingle = current?.preis ?? fallbackPreis ?? 0;
  const total = typeof priceSingle === 'number' ? priceSingle * anzahl : undefined;

  // Falls Ort wechselt und bisheriger Termin nicht mehr existiert, auf ersten Termin setzen
  useEffect(() => {
    if (terminOptions.length > 0 && !terminOptions.find(o => o.value === selectedTerminId)) {
      setSelectedTerminId(terminOptions[0].value);
    }
  }, [selectedOrt, terminOptions.map(o => o.value).join(',' )]);

  return (
    <div className="sticky top-6 rounded-xl border p-4 shadow-sm ring-1 ring-black/5 bg-white">
      <h2 className="text-lg font-semibold mb-4">Wunschtermin wählen</h2>
      {termine.length === 0 ? (
        <p className="text-sm text-gray-600">Keine Termine verfügbar.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ort</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm bg-white hover:bg-gray-50"
                value={selectedOrt}
                onChange={(e) => setSelectedOrt(e.target.value)}
              >
                {allOrte.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Datum</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm bg-white hover:bg-gray-50"
                value={selectedTerminId}
                onChange={(e) => setSelectedTerminId(e.target.value)}
              >
                {terminOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">Teilnehmende</div>
            <div className="flex items-center gap-2">
              <button aria-label="minus" onClick={() => setAnzahl(a => Math.max(1, a - 1))} className="size-8 rounded-full border flex items-center justify-center hover:bg-gray-50">−</button>
              <div className="w-8 text-center text-sm font-medium">{anzahl}</div>
              <button aria-label="plus" onClick={() => setAnzahl(a => a + 1)} className="size-8 rounded-full border flex items-center justify-center hover:bg-gray-50">+</button>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-800 flex items-center justify-between">
            <span>Gesamtpreis</span>
            <span className="font-semibold">{typeof total !== 'undefined' ? `${total.toFixed(2)} €` : '–'}</span>
          </div>
          {typeof current?.kapazitaet !== 'undefined' && (
            <div className="mt-1 text-xs text-gray-600">Kapazität: {current.kapazitaet}</div>
          )}

          <Link
            href={`/checkout?seminar=${encodeURIComponent(slug)}&terminId=${encodeURIComponent(selectedTerminId)}&anzahl=${encodeURIComponent(String(anzahl))}`}
            className="mt-5 w-full inline-block text-center bg-black text-white px-4 py-2.5 rounded-lg hover:bg-gray-900 text-sm"
          >
            Weiter zur Buchung
          </Link>
          <div className="mt-2 text-[11px] text-gray-500 text-center">Preise pro Person · Endpreis im Checkout</div>
        </>
      )}
    </div>
  );
}
