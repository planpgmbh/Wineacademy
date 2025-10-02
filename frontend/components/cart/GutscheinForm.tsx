"use client";

import Image from 'next/image';
import { useState } from 'react';
import { useCart } from '@/lib/cart-context';
import type { GutscheinTemplate, Produkt } from '@/lib/api';
import { mediaUrl, postGutscheinPricing } from '@/lib/api';

function formatPrice(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

type Props = {
  template: GutscheinTemplate;
  produkt?: Produkt | null;
};

export default function GutscheinForm({ template, produkt }: Props) {
  const { addItem } = useCart();
  const [betrag, setBetrag] = useState(() => {
    if (template.minBetrag != null) return template.minBetrag;
    return 50;
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const min = template.minBetrag ?? 0;
  const max = template.maxBetrag ?? 1000;

  const handleAdd = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await postGutscheinPricing(betrag);
      addItem({
        type: 'gutschein',
        titel: template.name,
        beschreibung: template.beschreibung || undefined,
        produktId: produkt?.id,
        preisBrutto: res.betrag,
        steuerSatz: 0,
        menge: 1,
        participants: [],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Betrag ungültig');
    } finally {
      setLoading(false);
    }
  };

  const imageUrl = mediaUrl(template.bild?.url);

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
      {imageUrl && (
        <div className="relative h-64 w-full overflow-hidden rounded-xl border">
          <Image src={imageUrl} alt={template.bild?.alternativeText || template.name} fill className="object-cover" />
        </div>
      )}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">{template.name}</h2>
        {template.beschreibung && <p className="text-sm text-gray-600 whitespace-pre-line">{template.beschreibung}</p>}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Wunschbetrag ({formatPrice(min)} – {formatPrice(max)})</label>
          <input
            type="number"
            min={min}
            max={max}
            value={betrag}
            onChange={(e) => setBetrag(Number(e.target.value))}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-40"
        >
          {loading ? 'Wird geprüft…' : `Für ${formatPrice(betrag)} in den Warenkorb`}
        </button>
      </div>
    </div>
  );
}
