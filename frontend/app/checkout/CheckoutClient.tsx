"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
    ustId: '',
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
  const [promo, setPromo] = useState<{ valid: boolean; discount: number; totalBrutto: number } | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ id: number; amount: number } | null>(null);
  const [successBuchung, setSuccessBuchung] = useState<{
    id: number;
    status: string;
    zahlungsmethode?: string | null;
    anzahl: number;
    gesamtpreisBrutto: number;
    gesamtpreisNetto?: number;
    gesamtsteuerBetrag?: number;
  } | null>(null);
  const [datenschutz, setDatenschutz] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  // Auf Wunsch vorab angehakt
  const [agb, setAgb] = useState(true);

  // API-Basis: same-origin '/api' im Browser, ENV-Fallback serverseitig
  const apiBase = useMemo(() => {
    if (typeof window !== 'undefined') return `${window.location.origin}/api`;
    return process.env.NEXT_PUBLIC_API_URL || '';
  }, []);

  const einzelpreis = useMemo(() => {
    const tp = termin?.preis;
    if (typeof tp === 'number' && Number.isFinite(tp)) return Number(tp);
    const sp = seminar?.standardPreis;
    if (typeof sp === 'number' && Number.isFinite(Number(sp))) return Number(sp);
    return 0;
  }, [termin?.preis, seminar?.standardPreis]);
  const anzahl = teilnehmer.length || 1;
  const zwischensumme = useMemo(() => Number((einzelpreis * anzahl).toFixed(2)), [einzelpreis, anzahl]);
  const gesamtAnzeige = promo?.valid ? promo.totalBrutto : zwischensumme;
  const mwstAktiv = seminar?.mitMwst !== false; // default: true (MwSt aktiv), false = ohne MwSt
  // Netto/MwSt auf Basis der aktuellen Anzeige (inkl. Rabatt)
  const nettoAnzeige = useMemo(() => (mwstAktiv ? Number((gesamtAnzeige / 1.19).toFixed(2)) : Number(gesamtAnzeige.toFixed(2))), [mwstAktiv, gesamtAnzeige]);
  const steuerAnzeige = useMemo(() => (mwstAktiv ? Number((gesamtAnzeige - nettoAnzeige).toFixed(2)) : 0), [mwstAktiv, gesamtAnzeige, nettoAnzeige]);
  const gesamt = gesamtAnzeige; // Preise sind im Backend standardmäßig brutto; hier Anzeige als Brutto

  type BookingPayload = {
    terminId?: number;
    rechnungstyp: 'privat' | 'firma';
    vorname: string;
    nachname: string;
    email?: string;
    telefon?: string;
    firmenname?: string;
    ustId?: string;
    rechnungsEmail?: string;
    strasse?: string;
    plz?: string;
    stadt?: string;
    land?: string;
    teilnehmer: Array<{ vorname: string; nachname: string }>;
    agbAkzeptiert: boolean;
    datenschutzGelesen?: boolean;
    gutscheincode?: string;
    newsletterOptIn?: boolean;
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
      // Firma: zusätzlich Vorname/Nachname der Kontaktperson verlangen (Frontend-Pflicht)
      return !!adresse.firmenname && !!adresse.vorname && !!adresse.nachname && !!adresse.rechnungsEmail && !!adresse.strasse && !!adresse.plz && !!adresse.stadt && !!adresse.land;
    }
    if (s === 2) {
      return teilnehmer.length > 0 && teilnehmer.every((t) => t.vorname && t.nachname);
    }
    if (s === 3) {
      // Vor Zahlung beide Häkchen verlangen
      return agb && datenschutz;
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
              {rechnungstyp === 'privat' ? (
                <>
                  <TextInput label="Vorname*" value={adresse.vorname} onChange={(v) => setAdresse({ ...adresse, vorname: v })} />
                  <TextInput label="Nachname*" value={adresse.nachname} onChange={(v) => setAdresse({ ...adresse, nachname: v })} />
                  <TextInput className="sm:col-span-2" label="Straße" value={adresse.strasse} onChange={(v) => setAdresse({ ...adresse, strasse: v })} />
                  <TextInput label="PLZ" value={adresse.plz} onChange={(v) => setAdresse({ ...adresse, plz: v })} />
                  <TextInput label="Stadt" value={adresse.stadt} onChange={(v) => setAdresse({ ...adresse, stadt: v })} />
                  <TextInput label="Land" value={adresse.land} onChange={(v) => setAdresse({ ...adresse, land: v })} />
                  <TextInput className="sm:col-span-2" label="E‑Mail*" type="email" value={adresse.email} onChange={(v) => setAdresse({ ...adresse, email: v })} />
                  <TextInput className="sm:col-span-2" label="Telefon" value={adresse.telefon} onChange={(v) => setAdresse({ ...adresse, telefon: v })} />
                </>
              ) : (
                <>
                  <TextInput className="sm:col-span-2" label="Firmenname*" value={adresse.firmenname} onChange={(v) => setAdresse({ ...adresse, firmenname: v })} />
                  <TextInput label="Vorname*" value={adresse.vorname} onChange={(v) => setAdresse({ ...adresse, vorname: v })} />
                  <TextInput label="Nachname*" value={adresse.nachname} onChange={(v) => setAdresse({ ...adresse, nachname: v })} />
                  <TextInput className="sm:col-span-2" label="USt‑ID" value={adresse.ustId} onChange={(v) => setAdresse({ ...adresse, ustId: v })} />
                  <TextInput className="sm:col-span-2" label="Straße*" value={adresse.strasse} onChange={(v) => setAdresse({ ...adresse, strasse: v })} />
                  <TextInput label="PLZ*" value={adresse.plz} onChange={(v) => setAdresse({ ...adresse, plz: v })} />
                  <TextInput label="Stadt*" value={adresse.stadt} onChange={(v) => setAdresse({ ...adresse, stadt: v })} />
                  <TextInput label="Land*" value={adresse.land} onChange={(v) => setAdresse({ ...adresse, land: v })} />
                  <TextInput className="sm:col-span-2" label="Rechnungs‑E‑Mail*" type="email" value={adresse.rechnungsEmail} onChange={(v) => setAdresse({ ...adresse, rechnungsEmail: v })} />
                  <TextInput className="sm:col-span-2" label="Telefon" value={adresse.telefon} onChange={(v) => setAdresse({ ...adresse, telefon: v })} />
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
                  <TextInput label="E‑Mail" type="email" value={t.email || ''} onChange={(v) => setTeilnehmerField(i, 'email', v)} />
                  <TextInput label="Geburtstag" type="date" value={t.geburtstag || ''} onChange={(v) => setTeilnehmerField(i, 'geburtstag', v)} />
                  <TextInput label="WSET Nummer (falls vorhanden)" value={t.wsetCandidateNumber || ''} onChange={(v) => setTeilnehmerField(i, 'wsetCandidateNumber', v)} />
                  <TextInput className="sm:col-span-3" label="Besondere Bedürfnisse" value={t.besondereBeduerfnisse || ''} onChange={(v) => setTeilnehmerField(i, 'besondereBeduerfnisse', v)} />
                  <div className="sm:col-span-3 flex items-end justify-end">
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
              {/* Teilnehmerliste – kompakt, nummeriert */}
              <div className="mt-3">
                <div className="font-medium mb-1">Teilnehmende</div>
                {teilnehmer.length === 0 ? (
                  <div className="text-gray-500">Keine Teilnehmenden eingetragen.</div>
                ) : (
                  <div className="divide-y border rounded">
                    {teilnehmer.map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div className="size-6 rounded-full bg-gray-100 border flex items-center justify-center text-xs font-medium">{i + 1}</div>
                          <div className="text-gray-800 font-medium">{t.vorname} {t.nachname}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Rechtliches */}
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={agb} onChange={(e) => setAgb(e.target.checked)} />
                  Ich akzeptiere die <a href="/agb" className="underline" target="_blank" rel="noreferrer">Allgemeinen Geschäftsbedingungen</a>.
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={datenschutz} onChange={(e) => setDatenschutz(e.target.checked)} />
                  Ich habe die <a href="/datenschutz" className="underline" target="_blank" rel="noreferrer">Datenschutzerklärung</a> gelesen und akzeptiere sie.
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
                  Newsletter anmelden (optional)
                </label>
              </div>
              <div className="pt-3 mt-3 border-t flex justify-end">
                <button onClick={goNext} disabled={!validate(3)} className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm disabled:opacity-50">Jetzt bezahlen</button>
              </div>
            </div>
          </StepBlock>

          <StepBlock index={4} title="Bezahlen" active={step === 4} onHeaderClick={() => setStep(4)}>
            <div className="space-y-3">
              {!validate(1) || !validate(2) ? (
                <div className="text-xs text-red-600">Bitte Rechnungsadresse und Teilnehmer vollständig ausfüllen.</div>
              ) : null}
              <PayPalSection
                enabled={!!paypalClientId}
                clientId={paypalClientId}
                currency={paypalCurrency}
                amount={gesamt}
                customId={`${initialSlug || 'seminar'}|${initialTerminId || ''}|${anzahl}`}
                requireAgb={agb}
                requireValid={validate(1) && validate(2)}
                onApprove={async (captureId) => {
                  // Nach erfolgreichem Capture Buchung im Backend anlegen
                  try {
                    const payload: BookingPayload = {
                      terminId: initialTerminId,
                      rechnungstyp,
                      vorname: adresse.vorname,
                      nachname: adresse.nachname,
                      email: rechnungstyp === 'privat' ? adresse.email : undefined,
                      telefon: adresse.telefon || undefined,
                      firmenname: rechnungstyp === 'firma' ? adresse.firmenname : undefined,
                      ustId: rechnungstyp === 'firma' ? adresse.ustId : undefined,
                      rechnungsEmail: rechnungstyp === 'firma' ? adresse.rechnungsEmail : undefined,
                      // Adresse immer mitsenden (privat optional, firma Pflicht)
                      strasse: adresse.strasse || undefined,
                      plz: adresse.plz || undefined,
                      stadt: adresse.stadt || undefined,
                      land: adresse.land || undefined,
                      teilnehmer: teilnehmer.map(t => ({
                        vorname: t.vorname,
                        nachname: t.nachname,
                        email: t.email || undefined,
                        geburtstag: t.geburtstag || undefined,
                        wsetCandidateNumber: t.wsetCandidateNumber || undefined,
                        besondereBeduerfnisse: t.besondereBeduerfnisse || undefined,
                      })),
                      agbAkzeptiert: true,
                      datenschutzGelesen: datenschutz,
                      gutscheincode: promo?.valid ? gutscheincode : undefined,
                      newsletterOptIn: newsletter,
                      paypalCaptureId: captureId,
                    };
                    const tId = initialTerminId || termin?.id;
                    const res = await fetch(`${apiBase}/public/buchungen`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...payload, terminId: tId }),
                    });
                    const ctype = res.headers.get('content-type') || '';
                    const isJson = ctype.includes('application/json');
                    const json = isJson ? await res.json() : null;
                    if (!res.ok) {
                      const text = !isJson ? await res.text() : '';
                      throw new Error((json && (json.error?.message || json.message)) || `API ${res.status}: ${text?.slice(0,160)}`);
                    }
                    // Erfolg: interner Schritt 5 "Bezahlung erfolgreich"
                    const newId = Number(json.id);
                    setSuccessInfo({ id: newId, amount: gesamt });
                    // Totale aus dem Backend nachladen (inkl. MwSt-/Netto-Breakdown)
                    try {
                      const sumRes = await fetch(`${apiBase}/public/buchungen/${newId}`);
                      if (sumRes.ok) {
                        const sumJson = await sumRes.json();
                        setSuccessBuchung(sumJson);
                      }
                    } catch {}
                    setStep(5);
                    updateQuery(5);
                  } catch (e) {
                    console.error(e);
                    window.location.href = `/checkout/abbruch?grund=${encodeURIComponent((e as Error)?.message || 'Fehler')}`;
                  }
                }}
              />
              <div className="flex justify-start">
                <button onClick={goPrev} className="inline-flex items-center rounded-md border px-4 py-2 text-sm">Zurück</button>
              </div>
            </div>
          </StepBlock>

          {/* Schritt 5: Bezahlung erfolgreich */}
          <StepBlock index={5} title="Bezahlung erfolgreich" active={step === 5} onHeaderClick={() => setStep(5)}>
            <div className="space-y-3 text-sm">
              <div className="p-4 border rounded bg-gray-50">
                <div className="text-gray-800 font-medium">Zahlung erfolgreich</div>
                <div className="mt-1 text-gray-700">Vielen Dank! Ihre Buchung wurde erfasst.</div>
              </div>
              {/* Bestellübersicht vollständig */}
              <div className="border rounded p-4 bg-white text-sm space-y-2">
                <div className="font-medium">Bestellung</div>
                <div className="flex justify-between"><span>{seminar?.seminarname || 'Seminar'}</span><span>{anzahl} × {einzelpreis.toFixed(2)} €</span></div>
                <div className="text-gray-700">Teilnehmende:</div>
                <ul className="list-disc pl-5 text-gray-800">
                  {teilnehmer.map((t, i) => (<li key={i}>{t.vorname} {t.nachname}{t.email?` · ${t.email}`:''}</li>))}
                </ul>
                {/* Summen aus Backend (falls verfügbar), sonst Fallback */}
                <div className="pt-2 border-t mt-2 space-y-1">
                  {successBuchung?.gesamtpreisNetto != null && successBuchung?.gesamtsteuerBetrag != null ? (
                    <>
                      <div className="flex justify-between"><span>Netto</span><span>{successBuchung.gesamtpreisNetto.toFixed(2)} €</span></div>
                      <div className="flex justify-between"><span>MwSt</span><span>{successBuchung.gesamtsteuerBetrag.toFixed(2)} €</span></div>
                      <div className="flex justify-between font-medium"><span>Gesamt (inkl. MwSt)</span><span>{successBuchung.gesamtpreisBrutto.toFixed(2)} €</span></div>
                    </>
                  ) : (
                    <div className="flex justify-between font-medium"><span>Gesamt</span><span>{(successInfo ? successInfo.amount : gesamt).toFixed(2)} €</span></div>
                  )}
                </div>
              </div>
              <div className="border rounded p-4 bg-white">
                <div>Buchungsnummer: <span className="font-medium">{successInfo?.id ?? '–'}</span></div>
                {successBuchung ? (
                  <>
                    {successBuchung.gesamtsteuerBetrag && successBuchung.gesamtsteuerBetrag > 0 ? (
                      <div>Gesamtbetrag (inkl. MwSt): <span className="font-medium">{successBuchung.gesamtpreisBrutto.toFixed(2)} €</span></div>
                    ) : (
                      <div>Gesamtbetrag (ohne MwSt): <span className="font-medium">{successBuchung.gesamtpreisBrutto.toFixed(2)} €</span></div>
                    )}
                  </>
                ) : (
                  <div>Gesamtbetrag: <span className="font-medium">{successInfo ? successInfo.amount.toFixed(2) : gesamt.toFixed(2)} €</span></div>
                )}
              </div>
              <div className="flex gap-3">
                <Link href="/seminare" className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm">Zurück zu den Seminaren</Link>
                <Link href="/" className="inline-flex items-center rounded-md border px-4 py-2 text-sm">Startseite</Link>
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
              <button className="px-3 py-2 border rounded text-sm" onClick={async () => {
                const tId = initialTerminId || termin?.id;
                if (!tId) return;
                try {
                  const res = await fetch(`${apiBase}/public/gutscheine/validate`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ terminId: tId, anzahl, gutscheincode }),
                  });
                  const json = await res.json();
                  if (json?.valid) setPromo({ valid: true, discount: Number(json.rabatt?.betragBrutto || 0), totalBrutto: Number(json.total?.gesamtpreisBrutto || zwischensumme) });
                  else setPromo({ valid: false, discount: 0, totalBrutto: zwischensumme });
                } catch {
                  setPromo(null);
                }
              }}>
                Prüfen
              </button>
            </div>
            {promo && (
              <div className={`mt-1 text-xs ${promo.valid ? 'text-green-700' : 'text-red-600'}`}>
                {promo.valid ? `Rabatt berücksichtigt: −${promo.discount.toFixed(2)} €` : 'Code ungültig'}
              </div>
            )}
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
              {promo?.valid && <Row label="Rabatt" value={`−${promo.discount.toFixed(2)} €`} />}
              {mwstAktiv && (
                <>
                  <Row label="Netto (geschätzt)" value={`${nettoAnzeige.toFixed(2)} €`} />
                  <Row label="MwSt (geschätzt)" value={`${steuerAnzeige.toFixed(2)} €`} />
                </>
              )}
            </div>
            <div className="p-4 text-sm flex justify-between font-semibold">
              <span>{mwstAktiv ? 'Gesamt (inkl. MwSt)' : 'Gesamt (ohne MwSt)'}</span>
              <span>{gesamtAnzeige.toFixed(2)} €</span>
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
      <div className="flex items-center gap-3" onClick={onHeaderClick}>
        <div className={`size-7 rounded-full border flex items-center justify-center text-sm ${active ? 'bg-black text-white border-black' : 'bg-white text-gray-700'}`}>{index}</div>
        <div className="text-lg font-medium">{title}</div>
      </div>
      {active && <div className="mt-3 border rounded p-4 bg-white">{children}</div>}
      <div className="my-6 border-t" />
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

type PayPalOnClickActions = { resolve: () => void; reject: () => void };

type PayPalButtonsOptions = {
  style?: Record<string, unknown>;
  createOrder: (data: unknown, actions: { order: { create: (args: Record<string, unknown>) => Promise<string> | string } }) => Promise<string> | string;
  onApprove: (data: unknown, actions: { order: { capture: () => Promise<PayPalCaptureDetails> } }) => void;
  onClick?: (data: unknown, actions: PayPalOnClickActions) => void;
  onError?: (err: unknown) => void;
  onCancel?: () => void;
};

type PayPalCaptureDetails = {
  purchase_units?: Array<{
    payments?: { captures?: Array<{ id?: string }> };
  }>;
};

function PayPalSection({ enabled, clientId, currency, amount, customId, requireAgb, requireValid, onApprove }: { enabled: boolean; clientId: string; currency: string; amount: number; customId: string; requireAgb: boolean; requireValid: boolean; onApprove: (captureId: string) => void }) {
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
          const mount = document.getElementById('paypal-buttons');
          if (mount) mount.innerHTML = '';
          window.paypal!.Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
            onClick: (_data, actions: PayPalOnClickActions) => {
              if (!requireValid || !requireAgb) {
                alert('Bitte Formular vervollständigen und AGB akzeptieren.');
                return actions.reject();
              }
              return actions.resolve();
            },
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
  }, [enabled, clientId, currency, amount, customId, onApprove, requireAgb, requireValid]);

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
