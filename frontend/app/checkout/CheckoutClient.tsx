"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchJSON } from '@/lib/api';
import { PayPalButtons } from '@paypal/react-paypal-js';

export type CheckoutClientProps = {
  seminarName: string;
  terminLabel?: string;
  amount?: string; // Preis je Teilnehmer, z. B. "119.00"
  terminId?: number;
  paypalClientId?: string;
  paypalMode?: string;
};

type Teilnehmer = {
  vorname: string;
  nachname: string;
  email: string;
  geburtstag: string;
  wsetCandidateNumber?: string;
  besondereBeduerfnisse?: string;
};

type Rechnungstyp = 'privat' | 'firma';

export default function CheckoutClient({ seminarName, terminLabel, amount, terminId, paypalClientId, paypalMode }: CheckoutClientProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const stepFromUrl = Number(sp?.get('step') || '1');
  const [step, setStep] = useState(Math.min(Math.max(stepFromUrl, 1), 4));

  // Schritt 1 – Rechnungstyp und Kontakt/Firma
  const [rechnungstyp, setRechnungstyp] = useState<Rechnungstyp>('privat');
  const [kontakt, setKontakt] = useState({ vorname: '', nachname: '', email: '' });
  const [firma, setFirma] = useState({
    firmenname: '',
    rechnungsEmail: '',
    strasse: '',
    plz: '',
    stadt: '',
    land: 'DE',
  });
  const [privatAdresse, setPrivatAdresse] = useState({ strasse: '', plz: '', stadt: '', land: 'DE' });

  // Schritt 2 – Teilnehmende
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([
    { vorname: '', nachname: '', email: '', geburtstag: '' },
  ]);

  // Initiale Anzahl aus Query ?anzahl=… übernehmen (beim Mount)
  useEffect(() => {
    const initial = Number(sp?.get('anzahl') || '');
    if (!Number.isNaN(initial) && initial > 1) {
      setTeilnehmer(Array.from({ length: initial }, () => ({ vorname: '', nachname: '', email: '', geburtstag: '' })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schritt 3 – Übersicht + Zahlung + AGB, Absenden
  const [agbAkzeptiert, setAgbAkzeptiert] = useState(false);
  const [paying, setPaying] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [paypalCaptureId, setPaypalCaptureId] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<null | {
    id: number; terminId: number; anzahl: number;
    mitMwst: boolean; steuerSatz: number;
    preisBrutto: number; preisNetto: number; steuerBetrag: number;
    gesamtpreisBrutto: number; gesamtpreisNetto: number; gesamtsteuerBetrag: number; status: string;
  }>(null);

  const summaryTitle = `${seminarName}${terminLabel ? ` – ${terminLabel}` : ''}`;
  const pricePerPerson = useMemo(() => (amount ? Number(amount) : undefined), [amount]);
  const totalAmount = useMemo(() => (pricePerPerson ? (pricePerPerson * teilnehmer.length) : undefined), [pricePerPerson, teilnehmer.length]);
  // Hinweis: PayPal-Client-ID wird außerhalb dieser Komponente konfiguriert

  // URL auf aktuellen Step synchronisieren (Deep-Link, Back/Forward)
  useEffect(() => {
    const current = new URLSearchParams(sp?.toString());
    if (String(step) !== (sp?.get('step') || '1')) {
      current.set('step', String(step));
      router.replace(`?${current.toString()}`);
    }
  }, [step, router, sp]);

  // Utils
  // Teilnehmeranzahl ist fix (kommt aus der Auswahl), kein Hinzufügen/Entfernen in Schritt 2
  const updateTeilnehmer = (idx: number, field: keyof Teilnehmer, value: string) =>
    setTeilnehmer(t => t.map((p, i) => i === idx ? { ...p, [field]: value } : p));

  // Validierung schrittweise
  const validateStep = useCallback((s: number): string[] => {
    const errors: string[] = [];
    if (s === 1) {
      if (!kontakt.vorname.trim()) errors.push('Vorname ist erforderlich.');
      if (!kontakt.nachname.trim()) errors.push('Nachname ist erforderlich.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kontakt.email)) errors.push('Gültige E‑Mail ist erforderlich.');
      if (rechnungstyp === 'firma') {
        if (!firma.firmenname.trim()) errors.push('Firmenname ist erforderlich.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(firma.rechnungsEmail)) errors.push('Rechnungs‑E‑Mail der Firma ist erforderlich.');
        if (!firma.strasse.trim()) errors.push('Straße ist erforderlich.');
        if (!firma.plz.trim()) errors.push('PLZ ist erforderlich.');
        if (!firma.stadt.trim()) errors.push('Stadt ist erforderlich.');
        if (!firma.land.trim()) errors.push('Land ist erforderlich.');
      }
    }
    if (s === 2) {
      if (!teilnehmer.length) errors.push('Mindestens ein Teilnehmer ist erforderlich.');
      teilnehmer.forEach((p, i) => {
        if (!p.vorname.trim()) errors.push(`Teilnehmer ${i + 1}: Vorname fehlt.`);
        if (!p.nachname.trim()) errors.push(`Teilnehmer ${i + 1}: Nachname fehlt.`);
        if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.push(`Teilnehmer ${i + 1}: E‑Mail ungültig.`);
        if (p.geburtstag && !/^\d{4}-\d{2}-\d{2}$/.test(p.geburtstag)) errors.push(`Teilnehmer ${i + 1}: Geburtstag im Format YYYY-MM-DD angeben.`);
      });
    }
    if (s === 3) {
      if (!agbAkzeptiert) errors.push('Bitte AGB akzeptieren.');
    }
    return errors;
  }, [kontakt, rechnungstyp, firma, teilnehmer, agbAkzeptiert]);

  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const goNext = () => {
    const errs = validateStep(step);
    setStepErrors(errs);
    if (errs.length === 0) setStep(s => Math.min(4, s + 1));
  };
  const goBack = () => setStep(s => Math.max(1, s - 1));

  // Anzahl ergibt sich implizit aus teilnehmer.length

  // Hilfsfunktionen
  const errorMessage = (e: unknown, fallback: string) => {
    if (typeof e === 'object' && e && 'message' in e) {
      const msg = (e as { message?: unknown }).message;
      if (typeof msg === 'string') return msg;
    }
    return fallback;
  };

  const extractPaypalCaptureId = (details: unknown): string | null => {
    try {
      const d = details as {
        purchase_units?: Array<{
          payments?: { captures?: Array<{ id?: string }> }
        }>;
      };
      return d.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
    } catch {
      return null;
    }
  };

  const onSubmit = async () => {
    const errs = validateStep(3);
    setStepErrors(errs);
    if (errs.length > 0) return;
    if (!terminId) {
      setSubmitError('Ungültiger oder fehlender Termin. Bitte zurück zur Seminarseite.');
      return;
    }
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        terminId,
        rechnungstyp,
        vorname: kontakt.vorname,
        nachname: kontakt.nachname,
        email: kontakt.email,
        teilnehmer,
        agbAkzeptiert,
        // Wir überlassen die detaillierte Steuer-/Preisberechnung dem Backend
      };
      if (paymentApproved) {
        payload.paymentApproved = true;
        payload.status = 'bezahlt';
        payload.zahlungsmethode = 'paypal';
      }
      if (paypalCaptureId) payload.paypalCaptureId = paypalCaptureId;
      // Optional: Preis je Teilnehmer mitgeben (Brutto), falls vorhanden
      if (pricePerPerson) payload.preisBrutto = Number(pricePerPerson.toFixed(2));
      if (rechnungstyp === 'firma') {
        Object.assign(payload, {
          firmenname: firma.firmenname,
          rechnungsEmail: firma.rechnungsEmail,
          strasse: firma.strasse,
          plz: firma.plz,
          stadt: firma.stadt,
          land: firma.land,
        });
      }

      const res = await fetchJSON<typeof submitResult extends infer T ? T : never>(
        '/public/buchungen',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      setSubmitResult(res as unknown as NonNullable<typeof submitResult>);
      setStep(4);
      // URL aktualisieren (für Deeplink/Reload)
      const params = new URLSearchParams(sp?.toString());
      params.set('step', '4');
      router.replace(`?${params.toString()}`);
    } catch (e: unknown) {
      setSubmitError(errorMessage(e, 'Unbekannter Fehler'));
    } finally {
      setPaying(false);
    }
  };

  const Stepper = () => (
    <div className="flex items-center gap-3 mb-6">
      {[1,2,3,4].map(n => (
        <div key={n} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${n <= step ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}>{n}</div>
          {n < 4 && <div className={`w-10 h-px ${n < step ? 'bg-black' : 'bg-gray-300'}`} />}
        </div>
      ))}
    </div>
  );

  const FehlerListe = ({ list }: { list: string[] }) => (
    list.length ? (
      <div className="mb-4 rounded border border-red-300 bg-red-50 text-red-800 p-3 text-sm">
        <ul className="list-disc list-inside">
          {list.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    ) : null
  );

  // Inhalte je Schritt
  return (
    <div className="max-w-4xl">
      <Stepper />
      <div className="text-sm text-gray-700 mb-4">{summaryTitle}</div>

      {submitResult ? (
        <div className="border rounded p-5">
          <h2 className="text-xl font-semibold mb-2">Buchung abgeschlossen</h2>
          <p className="text-gray-800">Buchungs‑ID: <span className="font-mono">{submitResult.id}</span></p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>Teilnehmende: {submitResult.anzahl}</div>
            <div>Mit MwSt: {submitResult.mitMwst ? 'Ja' : 'Nein'}</div>
            <div>Steuersatz: {submitResult.steuerSatz}%</div>
            <div>Einzelpreis brutto/netto: {submitResult.preisBrutto.toFixed(2)} € / {submitResult.preisNetto.toFixed(2)} €</div>
            <div>Gesamt brutto/netto: {submitResult.gesamtpreisBrutto.toFixed(2)} € / {submitResult.gesamtpreisNetto.toFixed(2)} €</div>
            <div>Gesamtsteuer: {submitResult.gesamtsteuerBetrag.toFixed(2)} €</div>
            <div>Status: {submitResult.status}</div>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 border rounded p-4">
              <h3 className="text-md font-semibold mb-2">Rechnungsempfänger</h3>
              <div className="text-sm text-gray-800 space-y-1">
                {rechnungstyp === 'firma' ? (
                  <div>
                    <div className="font-medium">{firma.firmenname}</div>
                    <div>{firma.strasse}</div>
                    <div>{firma.plz} {firma.stadt}</div>
                    <div>{firma.land}</div>
                    <div className="mt-1 text-gray-700">{firma.rechnungsEmail}</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">{kontakt.vorname} {kontakt.nachname}</div>
                    {privatAdresse.strasse && <div>{privatAdresse.strasse}</div>}
                    {(privatAdresse.plz || privatAdresse.stadt) && <div>{privatAdresse.plz} {privatAdresse.stadt}</div>}
                    {privatAdresse.land && <div>{privatAdresse.land}</div>}
                    <div className="mt-1 text-gray-700">{kontakt.email}</div>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Teilnehmende</h4>
                <div className="space-y-2">
                  {teilnehmer.map((p, i) => (
                    <div key={i} className="rounded border p-3 text-xs">
                      <div className="font-medium">Teilnehmer {i + 1}</div>
                      <div>{p.vorname} {p.nachname}</div>
                      <div>{p.email}</div>
                      {p.geburtstag && <div>Geburtstag: {p.geburtstag}</div>}
                      {p.wsetCandidateNumber && <div>WSET‑Kandidatennummer: {p.wsetCandidateNumber}</div>}
                      {p.besondereBeduerfnisse && <div>Besondere Bedürfnisse: {p.besondereBeduerfnisse}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <aside className="md:col-span-1 border rounded p-4">
              <h3 className="text-md font-semibold">Zusammenfassung</h3>
              <div className="text-sm text-gray-800 mt-2 space-y-1">
                <div className="flex justify-between"><span>Gesamt brutto</span><span>{submitResult.gesamtpreisBrutto.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span>Gesamt netto</span><span>{submitResult.gesamtpreisNetto.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span>Gesamtsteuer</span><span>{submitResult.gesamtsteuerBetrag.toFixed(2)} €</span></div>
              </div>
            </aside>
          </div>
          <div className="mt-6 text-sm text-gray-700">Vielen Dank! Die Buchung ist registriert. Du erhältst in Kürze weitere Informationen per E‑Mail.</div>
        </div>
      ) : step === 4 && paymentApproved ? (
        <div className="border rounded p-5">
          <h2 className="text-xl font-semibold mb-2">Zahlung erfolgreich</h2>
          <p className="text-gray-800">Die PayPal‑Zahlung wurde bestätigt. Die Buchung konnte jedoch nicht automatisch angelegt werden.</p>
          {submitError && (
            <div className="mt-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-900 p-3 text-sm">{submitError}</div>
          )}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 border rounded p-4">
              <h3 className="text-md font-semibold mb-2">Rechnungsempfänger</h3>
              <div className="text-sm text-gray-800 space-y-1">
                {rechnungstyp === 'firma' ? (
                  <div>
                    <div className="font-medium">{firma.firmenname}</div>
                    <div>{firma.strasse}</div>
                    <div>{firma.plz} {firma.stadt}</div>
                    <div>{firma.land}</div>
                    <div className="mt-1 text-gray-700">{firma.rechnungsEmail}</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">{kontakt.vorname} {kontakt.nachname}</div>
                    {privatAdresse.strasse && <div>{privatAdresse.strasse}</div>}
                    {(privatAdresse.plz || privatAdresse.stadt) && <div>{privatAdresse.plz} {privatAdresse.stadt}</div>}
                    {privatAdresse.land && <div>{privatAdresse.land}</div>}
                    <div className="mt-1 text-gray-700">{kontakt.email}</div>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Teilnehmende</h4>
                <div className="space-y-2">
                  {teilnehmer.map((p, i) => (
                    <div key={i} className="rounded border p-3 text-xs">
                      <div className="font-medium">Teilnehmer {i + 1}</div>
                      <div>{p.vorname} {p.nachname}</div>
                      {p.email && <div>{p.email}</div>}
                      {p.geburtstag && <div>Geburtstag: {p.geburtstag}</div>}
                      {p.wsetCandidateNumber && <div>WSET‑Kandidatennummer: {p.wsetCandidateNumber}</div>}
                      {p.besondereBeduerfnisse && <div>Besondere Bedürfnisse: {p.besondereBeduerfnisse}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <aside className="md:col-span-1 border rounded p-4">
              <h3 className="text-md font-semibold">Zusammenfassung</h3>
              <div className="text-sm text-gray-800 mt-2 space-y-1">
                <div className="flex justify-between"><span>Teilnehmende</span><span>{teilnehmer.length}</span></div>
                {pricePerPerson && <div className="flex justify-between"><span>Gesamtsumme</span><span>{(pricePerPerson * teilnehmer.length).toFixed(2)} €</span></div>}
              </div>
            </aside>
          </div>
          <div className="mt-6 text-sm text-gray-700">Wir erfassen deine Buchung umgehend im System. Vielen Dank!</div>
        </div>
      ) : (
        <>
          <FehlerListe list={stepErrors} />

          {step === 1 && (
            <section className="border rounded p-5">
              <h2 className="text-lg font-medium mb-4">Schritt 1: Rechnungsart & Kontakt</h2>
              <div className="flex gap-3 mb-4">
                <button type="button" onClick={() => setRechnungstyp('privat')} className={`px-3 py-1.5 rounded border text-sm ${rechnungstyp==='privat'?'bg-black text-white':'bg-white'}`}>Privat</button>
                <button type="button" onClick={() => setRechnungstyp('firma')} className={`px-3 py-1.5 rounded border text-sm ${rechnungstyp==='firma'?'bg-black text-white':'bg-white'}`}>Firma</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Vorname</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" value={kontakt.vorname} onChange={e=>setKontakt(v=>({...v, vorname:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Nachname</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" value={kontakt.nachname} onChange={e=>setKontakt(v=>({...v, nachname:e.target.value}))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">E‑Mail</label>
                  <input type="email" className="w-full border rounded px-3 py-2 text-sm" value={kontakt.email} onChange={e=>setKontakt(v=>({...v, email:e.target.value}))} />
                </div>
              </div>

              {rechnungstyp === 'firma' && (
                <div className="mt-5">
                  <h3 className="text-md font-medium mb-2">Firmendaten</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Firmenname</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={firma.firmenname} onChange={e=>setFirma(v=>({...v, firmenname:e.target.value}))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Rechnungs‑E‑Mail</label>
                      <input type="email" className="w-full border rounded px-3 py-2 text-sm" value={firma.rechnungsEmail} onChange={e=>setFirma(v=>({...v, rechnungsEmail:e.target.value}))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Straße und Nr.</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={firma.strasse} onChange={e=>setFirma(v=>({...v, strasse:e.target.value}))} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">PLZ</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={firma.plz} onChange={e=>setFirma(v=>({...v, plz:e.target.value}))} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Stadt</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={firma.stadt} onChange={e=>setFirma(v=>({...v, stadt:e.target.value}))} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Land</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={firma.land} onChange={e=>setFirma(v=>({...v, land:e.target.value}))} />
                    </div>
                  </div>
                </div>
              )}

              {rechnungstyp === 'privat' && (
                <div className="mt-5">
                  <h3 className="text-md font-medium mb-2">Rechnungsanschrift (optional)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Straße und Nr.</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={privatAdresse.strasse} onChange={e=>setPrivatAdresse(v=>({...v, strasse:e.target.value}))} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">PLZ</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={privatAdresse.plz} onChange={e=>setPrivatAdresse(v=>({...v, plz:e.target.value}))} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Stadt</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={privatAdresse.stadt} onChange={e=>setPrivatAdresse(v=>({...v, stadt:e.target.value}))} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Land</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={privatAdresse.land} onChange={e=>setPrivatAdresse(v=>({...v, land:e.target.value}))} />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 flex justify-between">
                <div />
                <button onClick={goNext} className="px-4 py-2 rounded bg-black text-white text-sm">Weiter</button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="border rounded p-5">
              <h2 className="text-lg font-medium mb-4">Schritt 2: Teilnehmende</h2>
              <div className="space-y-4">
                {teilnehmer.map((p, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="mb-3"><h3 className="text-sm font-medium">Teilnehmer {idx + 1}</h3></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input className="border rounded px-3 py-2 text-sm" placeholder="Vorname" value={p.vorname} onChange={e=>updateTeilnehmer(idx,'vorname',e.target.value)} />
                      <input className="border rounded px-3 py-2 text-sm" placeholder="Nachname" value={p.nachname} onChange={e=>updateTeilnehmer(idx,'nachname',e.target.value)} />
                      <input type="email" className="border rounded px-3 py-2 text-sm sm:col-span-2" placeholder="E‑Mail" value={p.email} onChange={e=>updateTeilnehmer(idx,'email',e.target.value)} />
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Geburtstag (optional)</label>
                        <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={p.geburtstag} onChange={e=>updateTeilnehmer(idx,'geburtstag',e.target.value)} />
                      </div>
                      <input className="border rounded px-3 py-2 text-sm" placeholder="WSET‑Kandidatennummer (optional)" value={p.wsetCandidateNumber || ''} onChange={e=>updateTeilnehmer(idx,'wsetCandidateNumber',e.target.value)} />
                      <input className="border rounded px-3 py-2 text-sm sm:col-span-2" placeholder="Besondere Bedürfnisse (optional)" value={p.besondereBeduerfnisse || ''} onChange={e=>updateTeilnehmer(idx,'besondereBeduerfnisse',e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-between">
                <button onClick={goBack} className="px-4 py-2 rounded border text-sm">Zurück</button>
                <button onClick={goNext} className="px-4 py-2 rounded bg-black text-white text-sm">Weiter</button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="">
              <h2 className="text-lg font-medium mb-4">Schritt 3: Übersicht & Zahlung</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Linke Spalte: Komplette Übersicht */}
                <div className="md:col-span-2 border rounded p-5">
                  <h3 className="text-md font-semibold mb-3">Rechnungsempfänger</h3>
                  <div className="text-sm text-gray-800 space-y-2">
                    <div><span className="text-gray-600">Seminar:</span> {summaryTitle}</div>
                    {rechnungstyp === 'firma' ? (
                      <div>
                        <div className="font-medium">{firma.firmenname}</div>
                        <div>{firma.strasse}</div>
                        <div>{firma.plz} {firma.stadt}</div>
                        <div>{firma.land}</div>
                        <div className="mt-1 text-gray-700">{firma.rechnungsEmail}</div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">{kontakt.vorname} {kontakt.nachname}</div>
                        {privatAdresse.strasse && <div>{privatAdresse.strasse}</div>}
                        {(privatAdresse.plz || privatAdresse.stadt) && <div>{privatAdresse.plz} {privatAdresse.stadt}</div>}
                        {privatAdresse.land && <div>{privatAdresse.land}</div>}
                        <div className="mt-1 text-gray-700">{kontakt.email}</div>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Teilnehmende:</span>
                      <div className="mt-2 space-y-2">
                        {teilnehmer.map((p, i) => (
                          <div key={i} className="rounded border p-3 text-xs">
                            <div className="font-medium">Teilnehmer {i + 1}</div>
                            <div>{p.vorname} {p.nachname}</div>
                            <div>{p.email}</div>
                            {p.geburtstag && <div>Geburtstag: {p.geburtstag}</div>}
                            {p.wsetCandidateNumber && <div>WSET‑Kandidatennummer: {p.wsetCandidateNumber}</div>}
                            {p.besondereBeduerfnisse && <div>Besondere Bedürfnisse: {p.besondereBeduerfnisse}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rechte Spalte: Zahlung */}
                <aside className="md:col-span-1 border rounded p-5 space-y-3">
                  <h3 className="text-md font-semibold">Zahlung</h3>
                  <div className="text-sm text-gray-800">
                    <div className="flex justify-between">
                      <span>Gesamtsumme</span>
                      <span className="font-semibold">{totalAmount ? `${totalAmount.toFixed(2)} €` : '–'}</span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={agbAkzeptiert} onChange={e=>setAgbAkzeptiert(e.target.checked)} />
                      Ich akzeptiere die AGB.
                    </label>
                  </div>
                  <div>
                    {totalAmount && amount ? (
                      <PayPalButtons
                        forceReRender={[totalAmount, paypalMode]}
                        style={{ layout: 'vertical' }}
                        onClick={(_data, actions) => {
                          if (!agbAkzeptiert) {
                            setSubmitError('Bitte AGB akzeptieren, um fortzufahren.');
                            return actions.reject();
                          }
                          return actions.resolve();
                        }}
                        createOrder={(_data, actions) => {
                          return actions.order.create({
                            purchase_units: [{ amount: { currency_code: 'EUR', value: totalAmount.toFixed(2) }, description: summaryTitle }],
                            intent: 'CAPTURE'
                          });
                        }}
                        onApprove={async (_data, actions) => {
                          try {
                            setPaying(true);
                            if (!actions.order) throw new Error('Order actions nicht verfügbar');
                            const details = await actions.order.capture();
                            setPaymentApproved(true);
                            try {
                              // Capture-ID aus Details extrahieren
                              const cap = extractPaypalCaptureId(details);
                              if (cap) setPaypalCaptureId(cap);
                            } catch {}
                            await onSubmit();
                          } catch (e) {
                            setSubmitError(errorMessage(e, 'PayPal Fehler'));
                            // Auch bei Fehlern nach PayPal die Abschlussseite zeigen, damit der Flow nicht hängen bleibt
                            setStep(4);
                            const params = new URLSearchParams(sp?.toString());
                            params.set('step', '4');
                            router.replace(`?${params.toString()}`);
                          }
                        }}
                        onError={(e) => {
                          setSubmitError(errorMessage(e, 'PayPal Fehler'));
                        }}
                      />
                    ) : (
                      <div className="text-sm text-gray-700">Gesamtsumme unbekannt.</div>
                    )}
                    {!paypalClientId && (
                      <div className="mt-2 text-[11px] text-gray-500">Hinweis: Sandbox‑Modus aktiv (Demo‑Buttons). Setze <code>PAYPAL_CLIENT_ID</code> für echte Sandbox‑Zahlung.</div>
                    )}
                  </div>
                  {submitError && (
                    <div className="rounded border border-red-300 bg-red-50 text-red-800 p-3 text-sm">{submitError}</div>
                  )}
                  {paying && (
                    <div className="text-sm text-gray-700">Zahlung wird bestätigt …</div>
                  )}
                  {/* Buchung erfolgt nach erfolgreicher PayPal-Zahlung automatisch */}
                  <div className="text-[11px] text-gray-500">Die finale Steuerberechnung erfolgt serverseitig.</div>
                </aside>
              </div>
              <div className="mt-5">
                <button onClick={goBack} className="px-4 py-2 rounded border text-sm">Zurück</button>
              </div>
            </section>
          )}

          {false && step === 4 && <></>}
        </>
      )}
    </div>
  );
}
