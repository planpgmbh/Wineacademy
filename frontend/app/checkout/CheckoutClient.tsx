"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PayPalButtons from '@/components/payments/PayPalButtons';
import { postBestellung } from '@/lib/api';
import { useCart, TeilnehmerForm, CartItem } from '@/lib/cart-context';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const formatCurrency = (value: number) => currencyFormatter.format(round2(value));

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

type StepDefinition = {
  key: 'cart' | 'participants' | 'billing' | 'confirm';
  title: string;
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
  const [stepError, setStepError] = useState<string | null>(null);
  const hasSeminarItems = useMemo(() => items.some((item) => item.type === 'seminar'), [items]);
  const steps: StepDefinition[] = useMemo(() => {
    const list: StepDefinition[] = [{ key: 'cart', title: 'Warenkorb' }];
    if (hasSeminarItems) {
      list.push({ key: 'participants', title: 'Teilnehmer' });
    }
    list.push({ key: 'billing', title: 'Rechnungsadresse' });
    list.push({ key: 'confirm', title: 'Bestätigung & Zahlung' });
    return list;
  }, [hasSeminarItems]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex]?.key ?? 'cart';

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

  const totalsRaw = useMemo(() => {
    const sums = items.reduce(
      (acc, item) => {
        const brutto = round2(item.preisBrutto * item.menge);
        const taxRate = Number(item.steuerSatz ?? 0);
        const netto = round2(taxRate > 0 ? brutto / (1 + taxRate / 100) : brutto);
        const mwst = round2(brutto - netto);
        acc.brutto += brutto;
        acc.netto += netto;
        acc.mwst += mwst;
        return acc;
      },
      { brutto: 0, netto: 0, mwst: 0 }
    );
    return {
      brutto: round2(sums.brutto),
      netto: round2(sums.netto),
      mwst: round2(sums.mwst),
    };
  }, [items]);

  const totalBrutto = totalsRaw.brutto;

  const totals = useMemo(
    () => ({
      brutto: formatCurrency(totalsRaw.brutto),
      netto: formatCurrency(totalsRaw.netto),
      mwst: formatCurrency(totalsRaw.mwst),
    }),
    [totalsRaw]
  );
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

  const validateParticipants = useCallback(() => {
    if (!hasSeminarItems) return null;
    for (const item of items) {
      if (item.type !== 'seminar') continue;
      const list = participants[item.id] || [];
      if (list.length !== item.menge) {
        return 'Teilnehmerzahl stimmt nicht mit der Menge überein';
      }
      for (const [i, teilnehmer] of list.entries()) {
        if (!teilnehmer.vorname?.trim()) return `Teilnehmer ${i + 1} benötigt einen Vornamen`;
        if (!teilnehmer.nachname?.trim()) return `Teilnehmer ${i + 1} benötigt einen Nachnamen`;
      }
    }
    return null;
  }, [hasSeminarItems, items, participants]);

  const validateBilling = useCallback(() => {
    if (!billing.vorname?.trim() || !billing.nachname?.trim() || !billing.email?.trim()) {
      return 'Bitte Rechnungsadresse vollständig ausfüllen';
    }
    if (billing.rechnungstyp === 'firma') {
      const required = ['firmenname', 'rechnungsEmail', 'strasse', 'plz', 'stadt', 'land'] as const;
      for (const key of required) {
        if (!billing[key]?.toString().trim()) return `Feld "${key}" ist erforderlich`;
      }
    }
    return null;
  }, [billing]);

  const validateAgreements = useCallback(() => {
    if (!agb || !datenschutz) return 'Bitte AGB und Datenschutzhinweise bestätigen';
    return null;
  }, [agb, datenschutz]);

  const validate = useCallback(
    (mode: PaymentMethod) => {
      if (items.length === 0) return 'Warenkorb ist leer';
      const participantError = validateParticipants();
      if (participantError) return participantError;
      const billingError = validateBilling();
      if (billingError) return billingError;
      const agreementError = validateAgreements();
      if (agreementError) return agreementError;
      if (mode === 'paypal' && !resolvedPaypalClientId) return 'PayPal ist derzeit nicht verfügbar';
      return null;
    },
    [items, validateParticipants, validateBilling, validateAgreements, resolvedPaypalClientId]
  );

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

  const validateStep = useCallback(
    (step: StepDefinition['key']) => {
      if (items.length === 0) return 'Warenkorb ist leer';
      switch (step) {
        case 'participants':
          return validateParticipants();
        case 'billing':
          return validateBilling();
        case 'confirm': {
          const agreementError = validateAgreements();
          if (agreementError) return agreementError;
          if (zahlungsmethode === 'paypal' && !resolvedPaypalClientId) {
            return 'PayPal ist derzeit nicht verfügbar';
          }
          return null;
        }
        default:
          return null;
      }
    },
    [items.length, validateParticipants, validateBilling, validateAgreements, zahlungsmethode, resolvedPaypalClientId]
  );

  useEffect(() => {
    setStepError(null);
  }, [currentStepIndex]);

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

  const goNextStep = () => {
    const current = steps[currentStepIndex];
    if (!current) return;
    const validationMessage = validateStep(current.key);
    if (validationMessage) {
      setStepError(validationMessage);
      setError(null);
      setPaypalError(null);
      return;
    }
    setStepError(null);
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
    }
  };

  const goPreviousStep = () => {
    if (currentStepIndex === 0) return;
    setStepError(null);
    setError(null);
    setPaypalError(null);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

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
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <header>
        <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Dein Checkout</h2>
        <p className="mt-2 text-sm text-gray-600">In wenigen Schritten zur abgeschlossenen Bestellung.</p>
      </header>

      <nav aria-label="Checkout Schritte">
        <ol className="flex flex-col gap-3 sm:flex-row sm:gap-5">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            const stepId = `checkout-step-${step.key}`;
            return (
              <li
                key={step.key}
                className="flex items-center gap-3"
                aria-label={`Schritt ${index + 1}: ${step.title}`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isCompleted ? 'bg-gray-300 text-gray-800' : isActive ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span
                  id={stepId}
                  className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="sr-only">Schritt {index + 1}: </span>
                  {step.title}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {stepError && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{stepError}</div>
      )}

      {currentStep === 'cart' && (
        <section
          id="checkout-panel-cart"
          aria-labelledby="checkout-step-cart"
          className="rounded-xl border p-4 shadow-sm space-y-3"
        >
          <h2 className="text-lg font-semibold">Warenkorb</h2>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">Der Warenkorb ist leer.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {items.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 border-b pb-3 last:border-none sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{item.seminarName || item.titel}</p>
                    {item.terminLabel && <p className="text-xs text-gray-500">{item.terminLabel}</p>}
                    {item.beschreibung && <p className="text-xs text-gray-500">{item.beschreibung}</p>}
                  </div>
                  <div className="text-right text-sm sm:text-right">
                    <p className="font-medium">{formatCurrency(round2(item.preisBrutto * Math.max(1, item.menge)))}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 border-t border-gray-200 pt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-600">Zwischensumme (netto)</span>
              <span className="font-medium text-gray-900">{totals.netto}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-600">inkl. MwSt.</span>
              <span className="font-medium text-gray-900">{totals.mwst}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-gray-900">
              <span>Gesamtbetrag</span>
              <span>{totals.brutto}</span>
            </div>
          </div>
        </section>
      )}

      {currentStep === 'participants' && hasSeminarItems && (
        <section
          id="checkout-panel-participants"
          aria-labelledby="checkout-step-participants"
          className="rounded-xl border p-4 shadow-sm space-y-4"
        >
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">Teilnehmerdaten</h2>
            <p className="text-xs text-gray-500">Bitte für jedes Seminar die Teilnehmer ergänzen.</p>
          </div>
          {items.filter((item) => item.type === 'seminar').map((item) => (
            <div key={item.id} className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-900">{item.seminarName || item.titel}</h3>
                {item.terminLabel && <p className="text-xs text-gray-500">{item.terminLabel}</p>}
              </div>
              {(participants[item.id] || []).map((teilnehmer, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-3 border rounded p-3 sm:grid-cols-3">
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
                  <label className="sm:col-span-3 text-xs font-medium text-gray-600">
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

      {currentStep === 'billing' && (
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
              E-Mail*
              <input value={billing.email} onChange={(e) => setBilling({ ...billing, email: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
            </label>
            {billing.rechnungstyp === 'firma' && (
              <label className="sm:col-span-2 text-xs font-medium text-gray-600">
                Rechnungs-E-Mail*
                <input value={billing.rechnungsEmail || ''} onChange={(e) => setBilling({ ...billing, rechnungsEmail: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
              </label>
            )}
            {billing.rechnungstyp === 'firma' && (
              <label className="text-xs font-medium text-gray-600">
                Umsatzsteuer-ID
                <input value={billing.ustId || ''} onChange={(e) => setBilling({ ...billing, ustId: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
              </label>
            )}
            <label className="sm:col-span-2 text-xs font-medium text-gray-600">
              Straße{billing.rechnungstyp === 'firma' ? '*' : ''}
              <input value={billing.strasse || ''} onChange={(e) => setBilling({ ...billing, strasse: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              PLZ{billing.rechnungstyp === 'firma' ? '*' : ''}
              <input value={billing.plz || ''} onChange={(e) => setBilling({ ...billing, plz: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Stadt{billing.rechnungstyp === 'firma' ? '*' : ''}
              <input value={billing.stadt || ''} onChange={(e) => setBilling({ ...billing, stadt: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Land{billing.rechnungstyp === 'firma' ? '*' : ''}
              <input value={billing.land || ''} onChange={(e) => setBilling({ ...billing, land: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-600 sm:col-span-2">
              Telefon
              <input value={billing.telefon || ''} onChange={(e) => setBilling({ ...billing, telefon: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
            </label>
          </div>
        </section>
      )}

      {currentStep === 'confirm' && (
        <section className="space-y-4">
          <div className="rounded-xl border p-4 shadow-sm space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={agb} onChange={(e) => setAgb(e.target.checked)} />
              <span>Ich akzeptiere die AGB.</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={datenschutz} onChange={(e) => setDatenschutz(e.target.checked)} />
              <span>Ich habe die Datenschutzhinweise gelesen.</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
              <span>Ich möchte den Newsletter erhalten.</span>
            </label>
          </div>

          <section className="rounded-xl border p-4 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold">Zahlungsart</h2>
            <label className="flex items-center gap-3 text-sm">
              <input type="radio" checked={zahlungsmethode === 'rechnung'} onChange={() => setZahlungsmethode('rechnung')} />
              <span>Auf Rechnung (Zahlung nach Rechnungseingang)</span>
            </label>
            <div>
              <label className={`flex items-center gap-3 text-sm ${resolvedPaypalClientId ? '' : 'opacity-50'}`}>
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

            {zahlungsmethode === 'rechnung' && (
              <button
                onClick={() => submitOrder({ mode: 'rechnung' })}
                disabled={submitting}
                className="mt-4 w-full rounded bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-40"
              >
                {submitting ? 'Bestellung wird übermittelt…' : 'Bestellung abschließen'}
              </button>
            )}

            {zahlungsmethode === 'paypal' && (
              <div className="mt-4 space-y-2">
                {!paypalReady && <div className="text-xs text-gray-500">PayPal wird geladen…</div>}
                {resolvedPaypalClientId ? (
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
                ) : (
                  <div className="rounded border border-dashed p-3 text-sm text-gray-500">PayPal ist momentan nicht verfügbar.</div>
                )}
              </div>
            )}

            {paypalError && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{paypalError}</div>}
            {error && zahlungsmethode === 'rechnung' && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
            )}
          </section>
        </section>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={goPreviousStep}
          className={`inline-flex items-center rounded-md border px-4 py-2 text-sm ${currentStepIndex === 0 ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-50'}`}
          disabled={currentStepIndex === 0}
        >
          Zurück
        </button>
        {currentStep !== 'confirm' && (
          <button
            onClick={goNextStep}
            className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm hover:bg-gray-900"
          >
            Weiter
          </button>
        )}
      </div>
    </div>
  );
}
