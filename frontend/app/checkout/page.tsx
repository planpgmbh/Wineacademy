import { getSeminar, mediaUrl } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';
import CheckoutClient from './CheckoutClient';
import PayPalProvider from './paypal/PayPalProvider';

export const dynamic = 'force-dynamic';

function fmtTime(t?: string) {
  if (!t) return '';
  return t.slice(0, 5);
}
function fmtDateISOToGerman(iso?: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export default async function CheckoutPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) || {};
  const slug = typeof sp.seminar === 'string' ? sp.seminar : '';
  const terminIdStr = typeof sp.terminId === 'string' ? sp.terminId : '';

  if (!slug) {
    return (
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="text-gray-700">Es fehlt die Seminar‑Kennung. Bitte wähle ein Seminar aus.</p>
        <Link href="/seminare" className="text-blue-600 underline">Zur Seminarübersicht</Link>
      </div>
    );
  }

  const seminar = await getSeminar(slug);
  const terminId = terminIdStr ? Number(terminIdStr) : undefined;
  const termin = terminId
    ? (seminar.termine || []).find(t => t.id === terminId)
    : (seminar.termine || [])[0];
  const preis = termin?.preis ?? seminar.standardPreis;
  const amount = typeof preis === 'number' ? preis.toFixed(2) : undefined;
  const bildUrl = mediaUrl(seminar.bild?.url);

  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  return (
    <div className="mx-auto max-w-4xl p-6">
      <nav className="text-sm text-gray-600 mb-3">
        <Link href="/" className="hover:underline">Start</Link>
        <span className="mx-2">/</span>
        <Link href="/seminare" className="hover:underline">Seminare</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Checkout</span>
      </nav>

      <h1 className="text-3xl font-semibold mb-4">Kasse</h1>

      {/* Hero-Zeile mit Seminarbild + Titel */}
      <div className="border rounded p-4 mb-6 flex gap-4">
        {bildUrl && (
          <div className="relative w-40 h-28 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
            <Image src={bildUrl} alt={seminar.bild?.alternativeText || seminar.seminarname} fill className="object-cover" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-medium">{seminar.seminarname}</h2>
          {termin ? (
            <p className="text-sm text-gray-700 mt-1">
              Termin: {fmtDateISOToGerman(termin.tage?.[0]?.datum)} {termin.tage?.[0]?.startzeit && `· ${fmtTime(termin.tage?.[0]?.startzeit)}–${fmtTime(termin.tage?.[0]?.endzeit)} Uhr`}
            </p>
          ) : (
            <p className="text-sm text-gray-700 mt-1">Termin nicht gefunden.</p>
          )}
        </div>
      </div>

      <PayPalProvider clientId={clientId} currency="EUR" intent="capture">
        <CheckoutClient
          seminarName={seminar.seminarname}
          terminLabel={termin ? `Termin ${fmtDateISOToGerman(termin.tage?.[0]?.datum)}` : undefined}
          amount={amount}
          terminId={termin?.id}
          paypalClientId={clientId || undefined}
          paypalMode={mode}
        />
      </PayPalProvider>
    </div>
  );
}
