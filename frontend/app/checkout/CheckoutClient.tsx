"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PayPalButtons from '@/components/payments/PayPalButtons';
import { postBestellung } from '@/lib/api';
import { useCart, TeilnehmerForm, CartItem } from '@/lib/cart-context';

type Rechnungstyp = 'privat' | 'firma';
type PaymentMethod = 'rechnung' | 'paypal';

type BillingState = {
  rechnungstyp: Rechnungstyp;
  vorname: string;
  nachname: string;
  email: string;
  telefon?: string;
  firmenname?: string;
  ustId?: string;
  rechnungsEmail?: string;
  strasse?: string;
  plz?: string;
  stadt?: string;
  land?: string;
};

type TeilnehmerMap = Record<string, TeilnehmerForm[]>;

type Props = {
  paypalClientId?: string;
  paypalCurrency?: string;
};

type SubmitOptions = {
  mode?: PaymentMethod;
  paypalCaptureId?: string;
  paypalOrderId?: string;
};

type PositionPayload = {
  typ: CartItem['type'];
  titel?: string;
  beschreibung?: string;
  produktId?: number;
  terminId?: number;
  menge: number;
  betrag?: number;
};

export default function CheckoutClient({ paypalClientId, paypalCurrency = 'EUR' }: Props) {
  const { items, clear } = useCart();
  const resolvedPaypalClientId = useMemo(
    () => paypalClientId || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
    [paypalClientId]
  );
  const [participants, setParticipants] = useState<TeilnehmerMap>({});
  const [billing, setBilling] = useState<BillingState>({
    rechnungstyp: 'privat',
    vorname: '',
    nachname: '',
    email: '',
    land: 'Deutschland',
  });
  const [newsletter, setNewsletter] = useState(false);
  const [agb, setAgb] = useState(false);
  const [datenschutz, setDatenschutz] = useState(false);
  const [zahlungsmethode, setZahlungsmethode] = useState<PaymentMethod>('rechnung');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [success, setSuccess] = useState<{ id: number; status: string; bestellnummer?: string | null } | null>(null);

  useEffect(() => {
    setParticipants((prev) => {
      const next: TeilnehmerMap = { ...prev };
      for (const item of items) {
        if (item.type !== 'seminar') {
          delete next[item.id];
          continue;
        }
        const existing = next[item.id] || [];
        const targetLength = Math.max(1, item.menge);
        const resized = [...existing];
        while (resized.length < targetLength) resized.push({ vorname: '', nachname: '', terminId: item.terminId });
        if (resized.length > targetLength) resized.length = targetLength;
        next[item.id] = resized.map((p) => ({ ...p, terminId: item.terminId }));
      }
      return next;
    });
  }, [items]);

  useEffect(() => {
    if (zahlungsmethode === 'rechnung') {
      setPaypalError(null);
    } else {
      setError(null);
    }
  }, [zahlungsmethode]);

  const totalBrutto = useMemo(() => items.reduce((sum, item) => sum + item.preisBrutto * item.menge, 0), [items]);
  const paypalCustomId = useMemo(() => {
    const payload = {
      t: Date.now(),
      items: items.map((item) => ({ type: item.type, ref: item.terminId ?? item.produktId, qty: item.menge })),
    };
    try {
      return btoa(JSON.stringify(payload)).slice(0, 80);
    } catch {
      return `WA-${Date.now()}`;
    }
  }, [items]);

  useEffect(() => {
    setPaypalReady(false);
  }, [paypalClientId, paypalCurrency, totalBrutto, paypalCustomId, zahlungsmethode]);

  const handleParticipantChange = (itemId: string, idx: number, key: keyof TeilnehmerForm, value: string) => {
    setParticipants((prev) => {
      const copy = { ...prev };
      const list = [...(copy[itemId] || [])];
      if (!list[idx]) list[idx] = { vorname: '', nachname: '', terminId: items.find((item) => item.id === itemId)?.terminId } as TeilnehmerForm;
      list[idx] = { ...list[idx], [key]: value };
      copy[itemId] = list;
      return copy;
    });
  };

  const validate = useCallback((mode: PaymentMethod) => {
    if (items.length === 0) return 'Warenkorb ist leer';
    if (!billing.vorname?.trim() || !billing.nachname?.trim() || !billing.email?.trim()) return 'Bitte Rechnungsadresse vollständig ausfüllen';
    if (billing.rechnungstyp === 'firma') {
      const required = ['firmenname', 'rechnungsEmail', 'strasse', 'plz', 'stadt', 'land'] as const;
      for (const key of required) {
        if (!billing[key]?.toString().trim()) return `Feld "${key}" ist erforderlich`;
      }
    }
    for (const item of items) {
      if (item.type !== 'seminar') continue;
      const list = participants[item.id] || [];
      if (list.length !== item.menge) return 'Teilnehmerzahl stimmt nicht mit der Menge überein';
      for (const [i, teilnehmer] of list.entries()) {
        if (!teilnehmer.vorname?.trim()) return `Teilnehmer ${i + 1} benötigt einen Vornamen`;
        if (!teilnehmer.nachname?.trim()) return `Teilnehmer ${i + 1} benötigt einen Nachnamen`;
      }
    }
    if (!agb || !datenschutz) return 'Bitte AGB und Datenschutz bestätigen';
    if (mode === 'paypal' && !resolvedPaypalClientId) return 'PayPal ist derzeit nicht verfügbar';
    return null;
  }, [items, billing, participants, agb, datenschutz, resolvedPaypalClientId]);

  const validateAndReport = useCallback((mode: PaymentMethod) => {
    const validationError = validate(mode);
    if (validationError) {
      if (mode === 'paypal') setPaypalError(validationError);
      else setError(validationError);
      return false;
    }
    if (mode === 'paypal') setPaypalError(null);
    else setError(null);
    return true;
  }, [validate]);

  const submitOrder = useCallback(async ({ mode, paypalCaptureId, paypalOrderId }: SubmitOptions = {}) => {
    const paymentMode: PaymentMethod = paypalCaptureId ? 'paypal' : mode ?? zahlungsmethode;
    if (!validateAndReport(paymentMode)) return;

    setSubmitting(true);
    try {
      const positionen: PositionPayload[] = items.map((item) => {
        const base: PositionPayload = {
          typ: item.type,
          titel: item.titel,
          beschreibung: item.beschreibung,
          produktId: item.produktId,
          terminId: item.terminId,
          menge: item.menge,
        };
        if (item.type === 'gutschein') {
          base.betrag = item.preisBrutto;
        }
        return base;
      });
      const buchungen = items
        .filter((item) => item.type === 'seminar')
        .flatMap((item) => (participants[item.id] || []).map((person) => ({
          ...person,
          terminId: item.terminId,
        })));

      const payload = {
        positionen,
        buchungen,
        gutscheinBetrag: 0,
        rechnungstyp: billing.rechnungstyp,
        vorname: billing.vorname,
        nachname: billing.nachname,
        email: billing.email,
        telefon: billing.telefon,
        firmenname: billing.firmenname,
        ustId: billing.ustId,
        rechnungsEmail: billing.rechnungsEmail,
        strasse: billing.strasse,
        plz: billing.plz,
        stadt: billing.stadt,
        land: billing.land,
        agbAkzeptiert: agb,
        datenschutzGelesen: datenschutz,
        newsletterOptIn: newsletter,
        zahlungsmethode: paymentMode,
        paypalCaptureId,
        paypalOrderId,
      };

      const result = await postBestellung(payload);
      setSuccess({ id: result.id, status: result.status, bestellnummer: result.bestellnummer });
      clear();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bestellung fehlgeschlagen';
      if (paymentMode === 'paypal') setPaypalError(msg);
      else setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [validateAndReport, items, participants, billing, agb, datenschutz, newsletter, clear, zahlungsmethode]);

  const ensurePayPalValid = useCallback(() => validateAndReport('paypal'), [validateAndReport]);

  if (success) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold">Vielen Dank!</h1>
        <p className="text-sm text-gray-600">
          Ihre Bestellung <strong>{success.bestellnummer || `#${success.id}`}</strong> wurde mit Status <strong>{success.status}</strong> gespeichert. Sie erhalten in Kürze eine Bestätigung per E-Mail.
        </p>
        <Link href="/seminare" className="inline-block rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900">
          Zurück zu den Seminaren
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold">Checkout</h1>
        <p className="mt-2 text-sm text-gray-600">Prüfen Sie Ihre Angaben und schließen Sie die Bestellung ab.</p>
      </header>

      <section className="rounded-xl border p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Warenkorb</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">Der Warenkorb ist leer.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between border-b pb-3 last:border-none">
                <div>
                  <p className="font-medium">{item.titel}</p>
                  {item.terminLabel && <p className="text-xs text-gray-500">{item.terminLabel}</p>}
                  {item.beschreibung && <p className="text-xs text-gray-500">{item.beschreibung}</p>}
                </div>
                <div className="text-right">
                  <p>{item.menge}× {item.preisBrutto.toFixed(2)} €</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between text-sm font-medium">
          <span>Gesamt</span>
          <span>{totalBrutto.toFixed(2)} €</span>
        </div>
      </section>

      {items.some((item) => item.type === 'seminar') && (
        <section className="rounded-xl border p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Teilnehmerdaten</h2>
          {items.filter((item) => item.type === 'seminar').map((item) => (
            <div key={item.id} className="mt-4 space-y-3">
              <h3 className="text-sm font-medium">{item.titel}</h3>
              {(participants[item.id] || []).map((teilnehmer, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-gray-600">
                    Vorname*
                    <input
                      value={teilnehmer.vorname || ''}
                      onChange={(e) => handleParticipantChange(item.id, idx, 'vorname', e.target.value)}
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-gray-600">
                    Nachname*
                    <input
                      value={teilnehmer.nachname || ''}
                      onChange={(e) => handleParticipantChange(item.id, idx, 'nachname', e.target.value)}
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-gray-600">
                    E-Mail
                    <input
                      value={teilnehmer.email || ''}
                      onChange={(e) => handleParticipantChange(item.id, idx, 'email', e.target.value)}
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-gray-600">
                    WSET Nr.
                    <input
                      value={teilnehmer.wsetCandidateNumber || ''}
                      onChange={(e) => handleParticipantChange(item.id, idx, 'wsetCandidateNumber', e.target.value)}
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="sm:col-span-2 text-xs font-medium text-gray-600">
                    Besondere Bedürfnisse
                    <textarea
                      value={teilnehmer.besondereBeduerfnisse || ''}
                      onChange={(e) => handleParticipantChange(item.id, idx, 'besondereBeduerfnisse', e.target.value)}
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      rows={2}
                    />
                  </label>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      <section className="rounded-xl border p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">Rechnungsadresse</h2>
        <div className="flex gap-4 text-sm">
          <label className={`flex items-center gap-2 rounded border px-3 py-2 ${billing.rechnungstyp === 'privat' ? 'bg-gray-100 border-gray-600' : ''}`}>
            <input type="radio" checked={billing.rechnungstyp === 'privat'} onChange={() => setBilling({ ...billing, rechnungstyp: 'privat' })} /> Privat
          </label>
          <label className={`flex items-center gap-2 rounded border px-3 py-2 ${billing.rechnungstyp === 'firma' ? 'bg-gray-100 border-gray-600' : ''}`}>
            <input type="radio" checked={billing.rechnungstyp === 'firma'} onChange={() => setBilling({ ...billing, rechnungstyp: 'firma' })} /> Firma
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {billing.rechnungstyp === 'firma' && (
            <label className="sm:col-span-2 text-xs font-medium text-gray-600">
              Firmenname*
              <input value={billing.firmenname || ''} onChange={(e) => setBilling({ ...billing, firmenname: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
            </label>
          )}
          <label className="text-xs font-medium text-gray-600">
            Vorname*
            <input value={billing.vorname} onChange={(e) => setBilling({ ...billing, vorname: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Nachname*
            <input value={billing.nachname} onChange={(e) => setBilling({ ...billing, nachname: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
          <label className="sm:col-span-2 text-xs font-medium text-gray-600">
            Straße
            <input value={billing.strasse || ''} onChange={(e) => setBilling({ ...billing, strasse: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-600">
            PLZ
            <input value={billing.plz || ''} onChange={(e) => setBilling({ ...billing, plz: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Stadt
            <input value={billing.stadt || ''} onChange={(e) => setBilling({ ...billing, stadt: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Land
            <input value={billing.land || ''} onChange={(e) => setBilling({ ...billing, land: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
          <label className="sm:col-span-2 text-xs font-medium text-gray-600">
            E-Mail*
            <input value={billing.email} onChange={(e) => setBilling({ ...billing, email: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
          {billing.rechnungstyp === 'firma' && (
            <label className="sm:col-span-2 text-xs font-medium text-gray-600">
              Rechnungs-E-Mail*
              <input value={billing.rechnungsEmail || ''} onChange={(e) => setBilling({ ...billing, rechnungsEmail: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
            </label>
          )}
          <label className="sm:col-span-2 text-xs font-medium text-gray-600">
            Telefon
            <input value={billing.telefon || ''} onChange={(e) => setBilling({ ...billing, telefon: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section className="rounded-xl border p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">Zahlung</h2>
        <label className="flex items-center gap-3 text-sm">
          <input type="radio" checked={zahlungsmethode === 'rechnung'} onChange={() => setZahlungsmethode('rechnung')} />
          <span>Auf Rechnung (Zahlung nach Rechnungseingang)</span>
        </label>
        <div>
          <label className={`flex items-center gap-3 text-sm ${paypalClientId ? '' : 'opacity-50'}`}>
            <input
              type="radio"
              checked={zahlungsmethode === 'paypal'}
              onChange={() => resolvedPaypalClientId && setZahlungsmethode('paypal')}
              disabled={!resolvedPaypalClientId}
            />
            <span>PayPal, Lastschrift oder Karte</span>
          </label>
          <p className="ml-6 mt-1 text-xs text-gray-500">
            Die PayPal-Option umfasst Zahlung über PayPal-Konto, Debit-/Kreditkarten sowie deutsche Bankeinzugsmethoden.
          </p>
        </div>
      </section>

      {zahlungsmethode === 'paypal' && (
        <section className="rounded-xl border p-4 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">PayPal</h2>
          <p className="text-sm text-gray-600">Zu zahlender Betrag: {totalBrutto.toFixed(2)} €</p>
          <p className="text-xs text-gray-500">Sie können PayPal, Debit-/Kreditkarten oder Bankeinzug nutzen.</p>
          <div className="mt-3 space-y-2">
          {resolvedPaypalClientId ? (
              <>
                {!paypalReady && <div className="text-xs text-gray-500">PayPal wird geladen…</div>}
                <PayPalButtons
                  clientId={resolvedPaypalClientId}
                  currency={paypalCurrency}
                  amount={totalBrutto}
                  customId={paypalCustomId}
                  disabled={submitting}
                  onValidate={ensurePayPalValid}
                  onApprove={({ captureId, orderId }) => submitOrder({ mode: 'paypal', paypalCaptureId: captureId, paypalOrderId: orderId })}
                  onError={(msg) => setPaypalError(msg)}
                  onReady={() => setPaypalReady(true)}
                />
              </>
            ) : (
              <div className="rounded border border-dashed p-3 text-sm text-gray-500">PayPal ist momentan nicht verfügbar.</div>
            )}
          </div>
          {paypalError && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{paypalError}</div>}
        </section>
      )}

      <section className="rounded-xl border p-4 shadow-sm space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={agb} onChange={(e) => setAgb(e.target.checked)} />
          <span>Ich akzeptiere die AGB.</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={datenschutz} onChange={(e) => setDatenschutz(e.target.checked)} />
          <span>Ich habe die Datenschutzhinweise gelesen.</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
          <span>Newsletter erhalten</span>
        </label>
      </section>

      {error && <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {zahlungsmethode === 'rechnung' && (
        <button
          onClick={() => submitOrder({ mode: 'rechnung' })}
          disabled={submitting}
          className="w-full rounded bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-40"
        >
          {submitting ? 'Bestellung wird übermittelt…' : 'Bestellung abschließen'}
        </button>
      )}
    </div>
  );
}
