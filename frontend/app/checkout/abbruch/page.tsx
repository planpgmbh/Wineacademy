export default function AbbruchPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const grund = searchParams?.grund || 'Abgebrochen';
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold mb-4">Zahlung nicht abgeschlossen</h1>
      <p className="text-gray-700">Der Zahlungsvorgang wurde nicht abgeschlossen.</p>
      <div className="mt-4 rounded border p-4 bg-white text-sm text-gray-700">
        Hinweis: {decodeURIComponent(grund)}
      </div>
      <a href="/checkout" className="inline-block mt-6 px-4 py-2 rounded border text-sm">Zurück zum Checkout</a>
    </div>
  );
}

