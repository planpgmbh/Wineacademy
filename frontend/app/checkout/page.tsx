import { getSeminar } from '@/lib/api';
import type { SeminarListItem } from '@/lib/api';
import CheckoutClient from './CheckoutClient';

type SearchParams = {
  slug?: string;
  terminId?: string;
  anzahl?: string;
  step?: string;
};

type TerminItem = NonNullable<SeminarListItem['termine']>[number];

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const slug = searchParams.slug || '';
  const terminId = Number(searchParams.terminId);
  const initialStep = Number(searchParams.step) || 1;
  const anzahl = Math.max(1, Number(searchParams.anzahl || 1));

  let seminar: SeminarListItem | null = null;
  let termin: TerminItem | null = null;
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '';
  const paypalCurrency = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY || 'EUR';

  if (slug && Number.isFinite(terminId)) {
    try {
      const s = await getSeminar(slug);
      const t = s.termine?.find((x) => x.id === terminId) || null;
      if (t) {
        seminar = s;
        termin = t;
      }
    } catch {}
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Bezahlen</h1>
      <div className="mt-6">
        <CheckoutClient
          initialStep={initialStep}
          initialSlug={slug}
          initialTerminId={Number.isFinite(terminId) ? terminId : undefined}
          initialAnzahl={anzahl}
          seminar={seminar}
          termin={termin}
          paypalClientId={paypalClientId}
          paypalCurrency={paypalCurrency}
        />
      </div>
    </div>
  );
}
