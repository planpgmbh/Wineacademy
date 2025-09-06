"use client";
import { useMemo, useState } from 'react';
import type { SeminarListItem } from '@/lib/api';

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
    const place = t.ort?.standort || t.ort?.veranstaltungsort || t.ort?.stadt || '';
    return [fmtDateISOToGerman(first.datum), time, place].filter(Boolean).join(' · ');
  }
  const last = days[days.length - 1];
  const sameMonthYear = first.datum.slice(0, 7) === last.datum.slice(0, 7);
  const [y, m, d1] = first.datum.split('-');
  const d2 = last.datum.split('-')[2];
  const range = sameMonthYear ? `${d1}.–${d2}.${m}.${y}` : `${fmtDateISOToGerman(first.datum)} – ${fmtDateISOToGerman(last.datum)}`;
  const place = t.ort?.standort || t.ort?.veranstaltungsort || t.ort?.stadt || '';
  return [range, place].filter(Boolean).join(' · ');
}

export default function BookingSidebar({ termine, fallbackPreis }: { termine: NonNullable<SeminarListItem['termine']>; fallbackPreis?: number }) {
  const options = useMemo(() => termine.map(t => ({ value: String(t.id), label: labelForTermin(t), data: t })), [termine]);
  const [selected, setSelected] = useState(options[0]?.value || '');
  const current = useMemo(() => options.find(o => o.value === selected)?.data, [options, selected]);
  const price = current?.preis ?? fallbackPreis ?? undefined;

  return (
    <div className="border rounded p-4 sticky top-6">
      <h2 className="text-lg font-medium mb-3">Wunschtermin wählen</h2>
      {options.length === 0 ? (
        <p className="text-sm text-gray-600">Keine Termine verfügbar.</p>
      ) : (
        <>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="mt-3 text-sm text-gray-800 flex items-center justify-between">
            <span>Preis</span>
            <span>{typeof price !== 'undefined' ? `${price} €` : '–'}</span>
          </div>
          {typeof current?.kapazitaet !== 'undefined' && (
            <div className="mt-1 text-xs text-gray-600">Kapazität: {current.kapazitaet}</div>
          )}
          <button className="mt-4 w-full bg-black text-white px-3 py-2 rounded hover:bg-gray-800 text-sm">
            Zur Buchung
          </button>
        </>
      )}
    </div>
  );
}
