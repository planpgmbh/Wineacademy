"use client";
import { useState } from 'react';
import PayPalCheckout from './paypal/PayPalCheckout';

export type CheckoutClientProps = {
  seminarName: string;
  terminLabel?: string;
  amount?: string; // e.g. "99.00"
  paypalClientId?: string;
  paypalMode?: string;
};

export default function CheckoutClient({ seminarName, terminLabel, amount, paypalClientId, paypalMode }: CheckoutClientProps) {
  const [form, setForm] = useState({
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
    strasse: '',
    plz: '',
    stadt: '',
    land: 'Deutschland',
  });

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  const summaryTitle = `${seminarName}${terminLabel ? ` – ${terminLabel}` : ''}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Linke Spalte: Rechnungsdetails */}
      <section className="md:col-span-2">
        <h2 className="text-xl font-medium mb-3">Rechnungsdetails</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Vorname</label>
            <input name="vorname" value={form.vorname} onChange={onChange} className="w-full border rounded px-3 py-2 text-sm" placeholder="Max" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Nachname</label>
            <input name="nachname" value={form.nachname} onChange={onChange} className="w-full border rounded px-3 py-2 text-sm" placeholder="Mustermann" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">E‑Mail</label>
            <input type="email" name="email" value={form.email} onChange={onChange} className="w-full border rounded px-3 py-2 text-sm" placeholder="max@example.com" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Telefon (optional)</label>
            <input name="telefon" value={form.telefon} onChange={onChange} className="w-full border rounded px-3 py-2 text-sm" placeholder="+49 …" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Straße und Hausnummer</label>
            <input name="strasse" value={form.strasse} onChange={onChange} className="w-full border rounded px-3 py-2 text-sm" placeholder="Musterstraße 1" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">PLZ</label>
            <input name="plz" value={form.plz} onChange={onChange} className="w-full border rounded px-3 py-2 text-sm" placeholder="12345" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Stadt</label>
            <input name="stadt" value={form.stadt} onChange={onChange} className="w-full border rounded px-3 py-2 text-sm" placeholder="Hamburg" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Land</label>
            <select name="land" value={form.land} onChange={onChange} className="w-full border rounded px-3 py-2 text-sm">
              <option>Deutschland</option>
              <option>Österreich</option>
              <option>Schweiz</option>
            </select>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-600">Hinweis: Die Zahlungsabwicklung erfolgt im nächsten Schritt. Dies ist eine Demo – Daten werden nicht gespeichert.</p>
      </section>

      {/* Rechte Spalte: Zahlungshinweise, Bestellung, Zahlungsbuttons */}
      <aside className="md:col-span-1 space-y-4">
        <div className="border rounded p-4">
          <h3 className="text-md font-medium mb-2">Zahlungshinweise</h3>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>Banküberweisung (manuelle Zuordnung)</li>
            <li>Kauf auf Rechnung (Prüfung vorbehalten)</li>
            <li>SEPA‑Lastschrift (bald verfügbar)</li>
          </ul>
        </div>

        <div className="border rounded p-4">
          <h3 className="text-md font-medium mb-3">Deine Bestellung</h3>
          <div className="text-sm text-gray-800">
            <div className="flex justify-between">
              <span>{summaryTitle}</span>
              <span>{amount ? `${amount} €` : '–'}</span>
            </div>
            <div className="flex justify-between mt-2 text-gray-700">
              <span>Zwischensumme</span>
              <span>{amount ? `${amount} €` : '–'}</span>
            </div>
            <div className="flex justify-between mt-1 font-medium">
              <span>Gesamt</span>
              <span>{amount ? `${amount} €` : '–'}</span>
            </div>
          </div>
        </div>

        <div className="border rounded p-4 space-y-2">
          <h3 className="text-md font-medium">Zahlung</h3>
          {amount && paypalClientId ? (
            <PayPalCheckout
              clientId={paypalClientId}
              mode={paypalMode || 'sandbox'}
              amount={amount}
              currency="EUR"
              description={summaryTitle}
            />
          ) : (
            <div className="text-sm text-gray-700">PayPal aktuell nicht verfügbar – fehlende Konfiguration.</div>
          )}
          <button disabled className="w-full inline-block text-center bg-gray-200 text-gray-600 px-3 py-2 rounded text-sm cursor-not-allowed">Später bezahlen (bald)</button>
          <button disabled className="w-full inline-block text-center bg-gray-200 text-gray-600 px-3 py-2 rounded text-sm cursor-not-allowed">SEPA Lastschrift (bald)</button>
        </div>
      </aside>
    </div>
  );
}

