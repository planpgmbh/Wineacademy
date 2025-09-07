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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (typeof window === 'undefined') return;
      if (window.paypal && containerRef.current) {
        renderButtons();
        return;
      }
      setStatus('loading');
      const script = document.createElement('script');
      const params = new URLSearchParams({
        'client-id': clientId,
        'currency': currency,
        'intent': 'capture',
        'components': 'buttons'
      });
      script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
      script.async = true;
      script.onload = () => {
        if (!cancelled) renderButtons();
      };
      script.onerror = () => {
        if (!cancelled) {
          setStatus('error');
          setMessage('PayPal SDK konnte nicht geladen werden.');
        }
      };
      document.body.appendChild(script);
    }

    function renderButtons() {
      if (!window.paypal || !containerRef.current) return;
      setStatus('ready');
      containerRef.current.innerHTML = '';
      window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect', color: 'gold', label: 'paypal' },
        createOrder: (_data, actions) => {
          return actions.order.create({
            purchase_units: [
              {
                amount: { currency_code: currency, value: amount },
                description,
              },
            ],
          });
        },
        onApprove: async (_data, actions) => {
          try {
            const details = await actions.order.capture();
            setStatus('approved');
            const id = details?.id || '';
            const payer = details?.payer?.name?.given_name || 'Kunde';
            setMessage(`Zahlung erfolgreich. Bestell-Nr.: ${id} – Danke, ${payer}!`);
          } catch (e: unknown) {
            setStatus('error');
            setMessage('Fehler bei der Zahlungsbestätigung.');
          }
        },
        onError: (err: unknown) => {
          console.error('PayPal error', err);
          setStatus('error');
          setMessage('PayPal Fehler. Bitte erneut versuchen.');
        },
        onCancel: () => {
          setStatus('idle');
          setMessage('Zahlung abgebrochen.');
        }
      }).render(containerRef.current);
    }

    load();
    return () => { cancelled = true; };
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
