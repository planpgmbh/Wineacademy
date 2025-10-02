"use client";

import Image from 'next/image';
import { useCart } from '@/lib/cart-context';
import type { Produkt } from '@/lib/api';
import { mediaUrl } from '@/lib/api';

function formatPrice(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);
}

type Props = {
  products: Produkt[];
};

export default function ProductGrid({ products }: Props) {
  const { addItem } = useCart();

  const handleAdd = (product: Produkt) => {
    addItem({
      type: product.gutschein ? 'gutschein' : 'produkt',
      titel: product.name,
      beschreibung: product.kurzbeschreibung,
      produktId: product.id,
      preisBrutto: product.preisBrutto ?? 0,
      steuerSatz: product.mwst === false ? 0 : product.steuerSatz ?? Number(process.env.NEXT_PUBLIC_DEFAULT_VAT ?? 19),
      menge: 1,
      participants: [],
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const imageUrl = mediaUrl(product.bild?.url);
        return (
          <article key={product.id} className="flex h-full flex-col overflow-hidden rounded-xl border shadow-sm">
            {imageUrl && (
              <div className="relative h-40 w-full">
                <Image src={imageUrl} alt={product.bild?.alternativeText || product.name} fill className="object-cover" />
              </div>
            )}
            <div className="flex flex-1 flex-col p-4">
              <h3 className="text-lg font-semibold">{product.name}</h3>
              {product.kurzbeschreibung && <p className="mt-2 text-sm text-gray-600">{product.kurzbeschreibung}</p>}
              <div className="mt-auto pt-4">
                <p className="text-sm font-medium text-gray-900">{formatPrice(product.preisBrutto ?? 0)}</p>
                <button
                  onClick={() => handleAdd(product)}
                  className="mt-3 w-full rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
                >
                  In den Warenkorb
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
