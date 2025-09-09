"use client";

import { useEffect, useMemo, useState } from 'react';
import type { SeminarListItem } from '@/lib/api';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type Teilnehmer = {
  vorname: string;
  nachname: string;
  email?: string;
  geburtstag?: string;
  wsetCandidateNumber?: string;
  besondereBeduerfnisse?: string;
};

type TerminItem = NonNullable<SeminarListItem['termine']>[number];

type Props = {
  initialStep?: number;
  initialSlug?: string;
  initialTerminId?: number;
  initialAnzahl?: number;
  seminar: SeminarListItem | null;
  termin: TerminItem | null;
  paypalClientId: string;
  paypalCurrency?: string;
};

export default function CheckoutClient({ initialStep = 1, initialSlug, initialTerminId, initialAnzahl = 1, seminar, termin, paypalClientId, paypalCurrency = 'EUR' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [step, setStep] = useState(Math.min(4, Math.max(1, initialStep)));
  const [rechnungstyp, setRechnungstyp] = useState<'privat' | 'firma'>('privat');
  const [adresse, setAdresse] = useState({
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
    firmenname: '',
    rechnungsEmail: '',
    strasse: '',
    plz: '',
    stadt: '',
    land: 'Deutschland',
  });
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>(
    Array.from({ length: Math.max(1, initialAnzahl) }, (_, i) => ({ vorname: i === 0 ? adresse.vorname || '' : '', nachname: i === 0 ? adresse.nachname || '' : '' }))
  );
  const [gutscheincode, setGutscheincode] = useState('');
  const [agb, setAgb] = useState(false);

  const einzelpreis = Number(termin?.preis || 0);
  const anzahl = teilnehmer.length || 1;
  const zwischensumme = useMemo(() => Number((einzelpreis * anzahl).toFixed(2)), [einzelpreis, anzahl]);
  const steuerSchaetzung = useMemo(() => Number(((zwischensumme / 1.19) * 0.19).toFixed(2)), [zwischensumme]);
  const gesamt = zwischensumme; // Preise sind im Backend standardmäßig brutto; hier Anzeige als Brutto

  type BookingPayload = {
    terminId?: number;
    rechnungstyp: 'privat' | 'firma';
    vorname: string;
    nachname: string;
    email?: string;
    firmenname?: string;
    rechnungsEmail?: string;
    strasse?: string;
    plz?: string;
    stadt?: string;
    land?: string;
    teilnehmer: Array<{ vorname: string; nachname: string }>;
    agbAkzeptiert: boolean;
    gutscheincode?: string;
    paypalCaptureId?: string;
  };

  const updateQuery = (nextStep: number) => {
    const qs = new URLSearchParams(search?.toString());
    if (initialSlug) qs.set('slug', initialSlug);
    if (initialTerminId) qs.set('terminId', String(initialTerminId));
    qs.set('anzahl', String(anzahl));
    qs.set('step', String(nextStep));
    router.replace(`${pathname}?${qs.toString()}`);
  };

  const goNext = () => {
    const next = Math.min(4, step + 1);
    if (validate(step)) {
      setStep(next);
      updateQuery(next);
    }
  };
  const goPrev = () => {
    const prev = Math.max(1, step - 1);
    setStep(prev);
    updateQuery(prev);
  };

  function validate(s: number): boolean {
    if (s === 1) {
      if (rechnungstyp === 'privat') {
        return !!adresse.vorname && !!adresse.nachname && !!adresse.email;
      }
      return !!adresse.firmenname && !!adresse.rechnungsEmail && !!adresse.strasse && !!adresse.plz && !!adresse.stadt && !!adresse.land;
    }
    if (s === 2) {
      return teilnehmer.length > 0 && teilnehmer.every((t) => t.vorname && t.nachname);
    }
    if (s === 4) {
      return agb;
    }
    return true;
  }

  const addTeilnehmer = () => setTeilnehmer((arr) => [...arr, { vorname: '', nachname: '' }]);
  const removeTeilnehmer = (idx: number) => setTeilnehmer((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));
  const setTeilnehmerField = (idx: number, key: keyof Teilnehmer, val: string) =>
    setTeilnehmer((arr) => arr.map((t, i) => (i === idx ? { ...t, [key]: val } : t)));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Linke Spalte: Steps + aktive Form */}
      <div className="lg:col-span-2">
        <div className="space-y-4">
          <StepBlock index={1} title="Rechnungsadresse" active={step === 1} onHeaderClick={() => setStep(1)}>
            {/* Rechnungsadresse Formular */}
            <div className="mb-4">
              <div className="flex gap-4">
                <label className={`px-3 py-2 border rounded cursor-pointer ${rechnungstyp === 'privat' ? 'bg-gray-100 border-gray-600' : ''}`}>
                  <input type="radio" className="mr-2" checked={rechnungstyp === 'privat'} onChange={() => setRechnungstyp('privat')} /> Privat
                </label>
                <label className={`px-3 py-2 border rounded cursor-pointer ${rechnungstyp === 'firma' ? 'bg-gray-100 border-gray-600' : ''}`}>
                  <input type="radio" className="mr-2" checked={rechnungstyp === 'firma'} onChange={() => setRechnungstyp('firma')} /> Firma
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Vorname*" value={adresse.vorname} onChange={(v) => setAdresse({ ...adresse, vorname: v })} />
              <TextInput label="Nachname*" value={adresse.nachname} onChange={(v) => setAdresse({ ...adresse, nachname: v })} />
              <TextInput className="sm:col-span-2" label="E‑Mail*" type="email" value={adresse.email} onChange={(v) => setAdresse({ ...adresse, email: v })} hidden={rechnungstyp === 'firma'} />
              {/* Firmenfelder */}
              {rechnungstyp === 'firma' && (
                <>
                  <TextInput className="sm:col-span-2" label="Firmenname*" value={adresse.firmenname} onChange={(v) => setAdresse({ ...adresse, firmenname: v })} />
                  <TextInput className="sm:col-span-2" label="Rechnungs‑E‑Mail*" type="email" value={adresse.rechnungsEmail} onChange={(v) => setAdresse({ ...adresse, rechnungsEmail: v })} />
                  <TextInput className="sm:col-span-2" label="Straße*" value={adresse.strasse} onChange={(v) => setAdresse({ ...adresse, strasse: v })} />
                  <TextInput label="PLZ*" value={adresse.plz} onChange={(v) => setAdresse({ ...adresse, plz: v })} />
                  <TextInput label="Stadt*" value={adresse.stadt} onChange={(v) => setAdresse({ ...adresse, stadt: v })} />
                  <TextInput label="Land*" value={adresse.land} onChange={(v) => setAdresse({ ...adresse, land: v })} />
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={goNext} className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm disabled:opacity-50" disabled={!validate(1)}>
                Weiter
              </button>
            </div>
          </StepBlock>

          <StepBlock index={2} title="Teilnehmer" active={step === 2} onHeaderClick={() => setStep(2)}>
            <div className="space-y-4">
              {teilnehmer.map((t, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3 border rounded p-3">
                  <TextInput label="Vorname*" value={t.vorname} onChange={(v) => setTeilnehmerField(i, 'vorname', v)} />
                  <TextInput label="Nachname*" value={t.nachname} onChange={(v) => setTeilnehmerField(i, 'nachname', v)} />
                  <div className="flex items-end">
                    <button onClick={() => removeTeilnehmer(i)} className="text-sm px-3 py-2 border rounded hover:bg-gray-50 disabled:opacity-40" disabled={teilnehmer.length === 1}>
                      Entfernen
                    </button>
                  </div>
                </div>
              ))}
              <div>
                <button onClick={addTeilnehmer} className="text-sm px-3 py-2 border rounded hover:bg-gray-50">
                  + Teilnehmer hinzufügen
                </button>
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <button onClick={goPrev} className="inline-flex items-center rounded-md border px-4 py-2 text-sm">Zurück</button>
              <button onClick={goNext} className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm" disabled={!validate(2)}>
                Weiter
              </button>
            </div>
          </StepBlock>

          <StepBlock index={3} title="Bestellübersicht" active={step === 3} onHeaderClick={() => setStep(3)}>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{seminar?.seminarname || 'Seminar'}</div>
                  {termin?.ort?.standort && <div className="text-gray-500">{termin.ort.standort}</div>}
                </div>
                <div>
                  {einzelpreis.toFixed(2)} € × {anzahl}
                </div>
              </div>
              <div className="pt-3 mt-3 border-t flex justify-end">
                <button onClick={goNext} className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm">Weiter</button>
              </div>
            </div>
          </StepBlock>

          <StepBlock index={4} title="Bezahlen" active={step === 4} onHeaderClick={() => setStep(4)}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={agb} onChange={(e) => setAgb(e.target.checked)} />
                Ich akzeptiere die AGB.
              </label>
              <PayPalSection
                enabled={agb && !!paypalClientId}
                clientId={paypalClientId}
                currency={paypalCurrency}
                amount={gesamt}
                customId={`${initialSlug || 'seminar'}|${initialTerminId || ''}|${anzahl}`}
                onApprove={async (captureId) => {
                  // Nach erfolgreichem Capture Buchung im Backend anlegen
                  try {
                    const payload: BookingPayload = {
                      terminId: initialTerminId,
                      rechnungstyp,
                      vorname: adresse.vorname,
                      nachname: adresse.nachname,
                      email: rechnungstyp === 'privat' ? adresse.email : undefined,
                      firmenname: rechnungstyp === 'firma' ? adresse.firmenname : undefined,
                      rechnungsEmail: rechnungstyp === 'firma' ? adresse.rechnungsEmail : undefined,
                      strasse: rechnungstyp === 'firma' ? adresse.strasse : undefined,
                      plz: rechnungstyp === 'firma' ? adresse.plz : undefined,
                      stadt: rechnungstyp === 'firma' ? adresse.stadt : undefined,
                      land: rechnungstyp === 'firma' ? adresse.land : undefined,
                      teilnehmer: teilnehmer.map(t => ({ vorname: t.vorname, nachname: t.nachname })),
                      agbAkzeptiert: true,
                      gutscheincode: undefined,
                      paypalCaptureId: captureId,
                    };
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/buchungen`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json?.error?.message || 'Buchung fehlgeschlagen');
                    // Erfolg: weiterleiten
                    window.location.href = `/checkout/erfolg?buchungId=${encodeURIComponent(json.id)}&betrag=${encodeURIComponent(gesamt.toFixed(2))}`;
                  } catch (e) {
                    console.error(e);
                    window.location.href = `/checkout/abbruch?grund=${encodeURIComponent((e as Error)?.message || 'Fehler')}`;
                  }
                }}
              />
              <div className="flex justify-between">
                <button onClick={goPrev} className="inline-flex items-center rounded-md border px-4 py-2 text-sm">Zurück</button>
                <button disabled className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm disabled:opacity-50" title="Wird demnächst aktiviert">
                  Zahlung starten
                </button>
              </div>
            </div>
          </StepBlock>
        </div>
      </div>

      {/* Rechte Spalte: Übersicht */}
      <aside className="lg:col-span-1">
        <div className="sticky top-6">
          <div className="text-xl font-semibold mb-4">Übersicht</div>
          <div className="mb-4">
            <label className="text-sm font-medium">Gutscheincode</label>
            <div className="mt-1 flex gap-2">
              <input value={gutscheincode} onChange={(e) => setGutscheincode(e.target.value)} placeholder="Code eingeben" className="w-full rounded border px-3 py-2 text-sm" />
              <button className="px-3 py-2 border rounded text-sm" disabled>
                Prüfen
              </button>
            </div>
          </div>
          <div className="divide-y border rounded">
            <div className="p-4 text-sm">
              <div className="font-medium mb-2">Warenkorb</div>
              <div className="flex justify-between">
                <div>
                  {seminar?.seminarname || 'Seminar'}
                  <div className="text-gray-500">{anzahl} × {einzelpreis.toFixed(2)} €</div>
                </div>
                <div className="font-medium">{zwischensumme.toFixed(2)} €</div>
              </div>
            </div>
            <div className="p-4 text-sm space-y-1">
              <Row label="Zwischensumme" value={`${zwischensumme.toFixed(2)} €`} />
              <Row label="Steuer (geschätzt)" value={`${steuerSchaetzung.toFixed(2)} €`} />
            </div>
            <div className="p-4 text-sm flex justify-between font-semibold">
              <span>Gesamt</span>
              <span>{gesamt.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StepBlock({ index, title, active, children, onHeaderClick }: { index: number; title: string; active: boolean; children?: React.ReactNode; onHeaderClick?: () => void }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 cursor-pointer" onClick={onHeaderClick}>
        <div className={`size-7 rounded-full border flex items-center justify-center text-sm ${active ? 'bg-black text-white border-black' : 'bg-white text-gray-700'}`}>{index}</div>
        <div className="text-lg font-medium">{title}</div>
      </div>
      <div className={`mt-3 border rounded ${active ? 'p-4 bg-white' : 'p-0 bg-transparent'}`}>{active ? children : <div className="h-12 flex items-center px-4 text-sm text-gray-500">Klicken, um zu öffnen</div>}</div>
    </div>
  );
}

function TextInput({ label, value, onChange, type = 'text', className = '', hidden = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border px-3 py-2 text-sm"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: PayPalButtonsOptions) => { render: (selector: string) => void };
    };
  }
}

type PayPalButtonsOptions = {
  style?: Record<string, unknown>;
  createOrder: (data: unknown, actions: { order: { create: (args: Record<string, unknown>) => Promise<string> | string } }) => Promise<string> | string;
  onApprove: (data: unknown, actions: { order: { capture: () => Promise<PayPalCaptureDetails> } }) => void;
  onError?: (err: unknown) => void;
  onCancel?: () => void;
};

type PayPalCaptureDetails = {
  purchase_units?: Array<{
    payments?: { captures?: Array<{ id?: string }> };
  }>;
};

function PayPalSection({ enabled, clientId, currency, amount, customId, onApprove }: { enabled: boolean; clientId: string; currency: string; amount: number; customId: string; onApprove: (captureId: string) => void }) {
  const [error, setError] = useState<string | null>(null);

  // SDK Script laden und Buttons mounten
  useEffect(() => {
    if (!enabled) return;
    setError(null);
    const sdkId = `pp-sdk-${clientId}-${currency}`;
    if (!document.getElementById(sdkId)) {
      const s = document.createElement('script');
      s.id = sdkId;
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
      s.async = true;
      document.head.appendChild(s);
    }
    const iv = setInterval(() => {
      if (window.paypal?.Buttons) {
        clearInterval(iv);
        try {
          window.paypal!.Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
            createOrder: (_data, actions) => {
              return actions.order.create({
                intent: 'CAPTURE',
                purchase_units: [
                  { amount: { currency_code: currency, value: amount.toFixed(2) }, custom_id: customId },
                ],
                application_context: { shipping_preference: 'NO_SHIPPING' },
              });
            },
            onApprove: async (_data, actions) => {
              try {
                const details = await actions.order.capture();
                const capId = details?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
                if (!capId) throw new Error('Keine Capture-ID erhalten');
                onApprove(String(capId));
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Fehler beim Capture');
              }
            },
            onError: (err) => {
              setError(err instanceof Error ? err.message : 'PayPal-Fehler');
            },
            onCancel: () => {
              window.location.href = '/checkout/abbruch?grund=abgebrochen';
            },
          }).render('#paypal-buttons');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'PayPal-Initialisierung fehlgeschlagen');
        }
      }
    }, 150);
    return () => clearInterval(iv);
  }, [enabled, clientId, currency, amount, customId, onApprove]);

  if (!enabled) {
    return (
      <div className="p-3 border rounded bg-gray-50 text-sm">Bitte AGB akzeptieren, um die PayPal‑Zahlung zu starten.</div>
    );
  }
  return (
    <div className="space-y-2">
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div id="paypal-buttons"></div>
    </div>
  );
}
