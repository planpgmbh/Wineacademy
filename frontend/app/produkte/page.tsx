import ProductGrid from '@/components/cart/ProductGrid';
import { getProdukte } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ProduktePage() {
  const produkte = await getProdukte();
  const normale = produkte.filter((p) => !p.gutschein);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header>
        <h1 className="text-3xl font-semibold">Produkte</h1>
        <p className="mt-2 text-sm text-gray-600">Bücher und Zubehör der Wine Academy.</p>
      </header>
      {normale.length === 0 ? (
        <p className="text-sm text-gray-600">Derzeit sind keine Produkte verfügbar.</p>
      ) : (
        <ProductGrid products={normale} />
      )}
    </div>
  );
}
