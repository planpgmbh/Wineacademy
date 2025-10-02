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
          const firstDay = firstTermin?.tageMitUhrzeit?.[0]?.datum;
          const standort = firstTermin?.standort?.name || firstTermin?.standort?.veranstaltungsort || firstTermin?.standort?.stadt;
          return (
            <li key={s.id} className="border rounded p-4 flex flex-col">
              <h2 className="text-lg font-medium">
                <Link href={`/seminare/${s.slug}`} className="hover:underline">
                  {s.name}
                </Link>
              </h2>
              {s.kurzbeschreibung && (
                <p className="text-sm text-gray-700 mt-1 line-clamp-3">{s.kurzbeschreibung}</p>
              )}
              <div className="text-sm mt-3 flex gap-4 flex-wrap text-gray-700">
                {typeof s.preis !== 'undefined' && <span>ab {s.preis} €</span>}
                {firstDay && <span>Nächster Termin: {fmtDateISOToGerman(firstDay)}</span>}
                {standort && <span>Standort: {standort}</span>}
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
