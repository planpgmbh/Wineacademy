import Link from 'next/link';

export default function ErfolgPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const id = searchParams?.buchungId;
  const betrag = searchParams?.betrag;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold mb-4">Zahlung erfolgreich</h1>
      <p className="text-gray-700">Vielen Dank! Ihre Buchung wurde erfasst.</p>
      <div className="mt-4 rounded border p-4 bg-white">
        <div className="text-sm">Buchungsnummer: <span className="font-medium">{id || '–'}</span></div>
        {betrag && <div className="text-sm">Betrag: <span className="font-medium">{betrag} €</span></div>}
      </div>
      <Link href="/seminare" className="inline-block mt-6 px-4 py-2 rounded bg-black text-white text-sm">Zurück zu den Seminaren</Link>
    </div>
  );
}
