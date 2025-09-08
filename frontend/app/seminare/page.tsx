import Link from 'next/link';
import { getSeminare } from '@/lib/api';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

function fmtDateISOToGerman(iso?: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export default async function SeminarePage() {
  const seminare = await getSeminare();

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Seminare</h1>
      <ul className="grid md:grid-cols-2 gap-5">
        {seminare.map((s) => {
          const firstTermin = s.termine?.[0];
          const firstDay = firstTermin?.tage?.[0]?.datum;
          const ort = firstTermin?.ort?.standort || firstTermin?.ort?.veranstaltungsort || firstTermin?.ort?.stadt;
          return (
            <li key={s.id} className="border rounded p-4 flex flex-col">
              <h2 className="text-lg font-medium">
                <Link href={`/seminare/${s.slug}`} className="hover:underline">
                  {s.seminarname}
                </Link>
              </h2>
              {s.kurzbeschreibung && (
                <p className="text-sm text-gray-700 mt-1 line-clamp-3">{s.kurzbeschreibung}</p>
              )}
              <div className="text-sm mt-3 flex gap-4 flex-wrap text-gray-700">
                {typeof s.standardPreis !== 'undefined' && <span>ab {s.standardPreis} €</span>}
                {firstDay && <span>Nächster Termin: {fmtDateISOToGerman(firstDay)}</span>}
                {ort && <span>Ort: {ort}</span>}
              </div>
              <div className="mt-4">
                <Link href={`/seminare/${s.slug}`} className="inline-block bg-black text-white px-3 py-1.5 rounded hover:bg-gray-800 text-sm">Details</Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
