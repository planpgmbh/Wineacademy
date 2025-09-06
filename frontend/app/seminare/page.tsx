import Link from 'next/link';
import { getSeminare } from '@/lib/api';

export const revalidate = 30;

export default async function SeminarePage() {
  const seminare = await getSeminare();

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Seminare</h1>
      <ul className="space-y-4">
        {seminare.map((s) => {
          const firstTermin = s.termine?.[0];
          const firstDay = firstTermin?.tage?.[0]?.datum;
          return (
            <li key={s.id} className="border rounded p-4">
              <h2 className="text-lg font-medium">
                <Link href={`/seminare/${s.slug}`} className="hover:underline">
                  {s.seminarname}
                </Link>
              </h2>
              {s.kurzbeschreibung && (
                <p className="text-sm text-gray-600 mt-1">{s.kurzbeschreibung}</p>
              )}
              <div className="text-sm mt-2 flex gap-4 text-gray-700">
                {typeof s.standardPreis !== 'undefined' && <span>ab {s.standardPreis} €</span>}
                {firstDay && <span>nächster Termin: {firstDay}</span>}
                {firstTermin?.ort?.stadt && <span>Ort: {firstTermin.ort.stadt}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

