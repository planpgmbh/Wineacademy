"use client";
import { useEffect, useRef, useState } from 'react';

type Props = {
  clientId: string;
  mode?: string; // sandbox|live (nur informativ)
  amount: string; // z. B. "99.00"
  currency: string; // "EUR"
  description?: string;
};

// Minimal typings for the PayPal SDK we use here
type PayPalPurchaseUnit = {
  amount: { currency_code: string; value: string };
  description?: string;
};

type PayPalOrderActionsCreate = (input: {
  purchase_units: PayPalPurchaseUnit[];
}) => Promise<string> | string;

type PayPalOrderActionsCaptureResult = {
  id?: string;
  payer?: { name?: { given_name?: string } };
};

type PayPalOrderActions = {
  order: {
    create: PayPalOrderActionsCreate;
    capture: () => Promise<PayPalOrderActionsCaptureResult>;
  };
};

type PayPalButtonsOptions = {
  style?: Record<string, string>;
  createOrder?: (data: unknown, actions: PayPalOrderActions) => Promise<string> | string;
  onApprove?: (data: unknown, actions: PayPalOrderActions) => Promise<void> | void;
  onError?: (err: unknown) => void;
  onCancel?: () => void;
};

type PayPalButtons = (options: PayPalButtonsOptions) => {
  render: (element: HTMLElement) => Promise<void>;
};

declare global {
  interface Window {
    paypal?: { Buttons: PayPalButtons };
  }
}

export default function PayPalCheckout({ clientId, amount, currency, description }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle"|"loading"|"ready"|"approved"|"error">("idle");
  const [message, setMessage] = useState<string>("");
  const loadedRef = useRef(false);
  const renderedRef = useRef(false);
  const buttonsRef = useRef<{ close?: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensureSDK() {
      if (typeof window === 'undefined') return false;
      if (window.paypal) return true;
      if (loadedRef.current) return !!window.paypal;
      setStatus('loading');
      loadedRef.current = true;
      // Verhindere mehrfaches Einfügen des SDK-Skripts
      const existing = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk]');
      if (!existing) {
        const script = document.createElement('script');
        script.setAttribute('data-paypal-sdk', 'true');
        const params = new URLSearchParams({
          'client-id': clientId,
          'currency': currency,
          'intent': 'capture',
          'components': 'buttons'
        });
        script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
        script.async = true;
        script.onload = () => {
          if (!cancelled) renderButtonsSafe();
        };
        script.onerror = () => {
          if (!cancelled) {
            setStatus('error');
            setMessage('PayPal SDK konnte nicht geladen werden.');
          }
        };
        document.body.appendChild(script);
      } else {
        // Falls ein Script bereits existiert, warte kurz und versuche zu rendern
        setTimeout(() => { if (!cancelled) renderButtonsSafe(); }, 0);
      }
      return false;
    }

    function renderButtonsSafe() {
      try {
        if (!window.paypal || !containerRef.current) return;
        if (renderedRef.current) return; // Nur einmal rendern
        renderedRef.current = true;
        setStatus('ready');
        containerRef.current.innerHTML = '';
        const btns: any = window.paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', color: 'gold', label: 'paypal' },
          createOrder: (_data: unknown, actions: any) => {
            return actions.order.create({
              purchase_units: [
                {
                  amount: { currency_code: currency, value: amount },
                  description,
                },
              ],
            });
          },
          onApprove: async (_data: unknown, actions: any) => {
            try {
              const details = await actions.order.capture();
              setStatus('approved');
              const id = (details as any)?.id || '';
              const payer = (details as any)?.payer?.name?.given_name || 'Kunde';
              setMessage(`Zahlung erfolgreich. Bestell-Nr.: ${id} – Danke, ${payer}!`);
            } catch (e: any) {
              console.error('PayPal capture error', e);
              setStatus('error');
              setMessage(e?.message || 'Fehler bei der Zahlungsbestätigung.');
            }
          },
          onError: (err: any) => {
            console.error('PayPal error', err);
            setStatus('error');
            setMessage(err?.message || 'PayPal Fehler. Bitte erneut versuchen.');
          },
          onCancel: () => {
            setStatus('idle');
            setMessage('Zahlung abgebrochen.');
          }
        });
        buttonsRef.current = btns;
        btns.render(containerRef.current);
      } catch (e: any) {
        console.error('PayPal Buttons render exception', e);
        setStatus('error');
        setMessage(e?.message || 'Unbekannter Fehler beim Rendern der PayPal Buttons.');
      }
    }

    // Starte Ladelogik
    if (clientId && amount && currency) {
      if (window.paypal) {
        renderButtonsSafe();
      } else {
        ensureSDK();
      }
    } else {
      setStatus('error');
      setMessage('Ungültige Zahlungsparameter.');
    }

    return () => {
      cancelled = true;
      try {
        // Versuche Buttons aufzuräumen, falls möglich
        buttonsRef.current?.close?.();
      } catch {}
    };
  }, [clientId, amount, currency, description]);

  return (
    <div>
      <div ref={containerRef} />
      {status !== 'ready' && message && (
        <div className="mt-2 text-sm text-gray-700">{message}</div>
      )}
    </div>
  );
}
