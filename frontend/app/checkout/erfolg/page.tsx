import Link from 'next/link';
import { getBuchungPublic } from '@/lib/api';

export default async function ErfolgPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const idStr = searchParams?.buchungId;
  const id = idStr ? Number(idStr) : NaN;
  const buchung = Number.isFinite(id) ? await getBuchungPublic(id) : null;
  const betrag = searchParams?.betrag || (buchung ? String(buchung.gesamtpreisBrutto) : undefined);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold mb-4">Zahlung erfolgreich</h1>
      <p className="text-gray-700">Vielen Dank! Ihre Buchung wurde erfasst.</p>
      <div className="mt-4 rounded border p-4 bg-white text-sm space-y-1">
        <div>Buchungsnummer: <span className="font-medium">{idStr || '–'}</span></div>
        {buchung && (
          <>
            <div>Status: <span className="font-medium">{buchung.status}</span></div>
            <div>Teilnehmende: <span className="font-medium">{buchung.anzahl}</span></div>
            <div>Gesamt (brutto): <span className="font-medium">{buchung.gesamtpreisBrutto?.toFixed?.(2) || buchung.gesamtpreisBrutto} €</span></div>
          </>
        )}
        {!buchung && betrag && <div>Betrag: <span className="font-medium">{betrag} €</span></div>}
      </div>
      <Link href="/seminare" className="inline-block mt-6 px-4 py-2 rounded bg-black text-white text-sm">Zurück zu den Seminaren</Link>
    </div>
  );
}
