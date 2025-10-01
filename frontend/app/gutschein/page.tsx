import GutscheinForm from '@/components/cart/GutscheinForm';
import { getGutscheinTemplate, getProdukte } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function GutscheinPage() {
  const template = await getGutscheinTemplate();
  const produkte = await getProdukte();
  const gutscheinProdukt = produkte.find((p) => p.gutschein);
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <header>
        <h1 className="text-3xl font-semibold">Gutschein</h1>
        <p className="mt-2 text-sm text-gray-600">Verschenke das perfekte Seminar – Betrag frei wählbar.</p>
      </header>
      <GutscheinForm template={template} produkt={gutscheinProdukt} />
    </div>
  );
}
