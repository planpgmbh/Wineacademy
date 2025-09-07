import { getSeminar, mediaUrl } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';
import PayPalCheckout from './paypal/PayPalCheckout';

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

export default async function CheckoutPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const slug = typeof searchParams?.seminar === 'string' ? searchParams!.seminar : '';
  const terminIdStr = typeof searchParams?.terminId === 'string' ? searchParams!.terminId : '';

  if (!slug || !terminIdStr) {
    return (
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="text-gray-700">Es fehlen Parameter. Bitte wähle einen Termin erneut aus.</p>
        <Link href="/seminare" className="text-blue-600 underline">Zur Seminarübersicht</Link>
      </div>
    );
  }

  const seminar = await getSeminar(slug);
  const terminId = Number(terminIdStr);
  const termin = (seminar.termine || []).find(t => t.id === terminId);
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

      <h1 className="text-3xl font-semibold mb-4">Checkout</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <section className="md:col-span-2 space-y-4">
          <div className="border rounded p-4 flex gap-4">
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

          <div className="border rounded p-4">
            <h3 className="text-md font-medium mb-2">Zahlung</h3>
            {!amount ? (
              <p className="text-sm text-gray-700">Kein Preis verfügbar – bitte wähle einen anderen Termin.</p>
            ) : clientId ? (
              <PayPalCheckout
                clientId={clientId}
                mode={mode}
                amount={amount}
                currency="EUR"
                description={`${seminar.seminarname}${termin ? ` – Termin ${fmtDateISOToGerman(termin.tage?.[0]?.datum)}` : ''}`}
              />
            ) : (
              <div className="text-sm text-gray-700">
                PayPal Client-ID fehlt. Bitte `PAYPAL_CLIENT_ID` in `.env` setzen (Sandbox wird empfohlen) und Frontend neu starten.
              </div>
            )}
          </div>
        </section>

        <aside className="md:col-span-1">
          <div className="border rounded p-4">
            <h3 className="text-md font-medium mb-3">Zusammenfassung</h3>
            <div className="text-sm text-gray-800 flex justify-between">
              <span>Zwischensumme</span>
              <span>{amount ? `${amount} €` : '–'}</span>
            </div>
            <div className="text-sm text-gray-800 flex justify-between mt-1">
              <span>Gesamt</span>
              <span className="font-medium">{amount ? `${amount} €` : '–'}</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            Hinweis: Testzahlung via PayPal Sandbox. Dies ist eine Demo ohne Buchungsanlage.
          </div>
        </aside>
      </div>
    </div>
  );
}

