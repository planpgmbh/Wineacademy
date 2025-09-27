"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

type PayPalNamespace = {
  Buttons: (options: PayPalButtonsOptions) => PayPalButtonsInstance;
};

type PayPalButtonsInstance = {
  isEligible: () => boolean;
  render: (container: HTMLElement | string) => Promise<void>;
  close?: () => Promise<void> | void;
};

type PayPalButtonsOptions = {
  style?: Record<string, unknown>;
  onInit?: (data: unknown, actions: PayPalInitActions) => void;
  onClick?: (data: unknown, actions: PayPalClickActions) => void;
  createOrder: (data: unknown, actions: PayPalOrderActions) => Promise<string> | string;
  onApprove: (data: PayPalApproveData, actions: PayPalApproveActions) => void;
  onError?: (err: unknown) => void;
};

type PayPalInitActions = {
  enable: () => void;
  disable: () => void;
};

type PayPalClickActions = PayPalInitActions & {
  resolve: () => void;
  reject: () => void;
};

type PayPalOrderActions = {
  order: {
    create: (args: Record<string, unknown>) => Promise<string> | string;
  };
};

type PayPalApproveData = {
  orderID?: string;
};

type PayPalApproveActions = {
  order: {
    capture: () => Promise<PayPalCaptureDetails>;
  };
};

type PayPalCaptureDetails = {
  id?: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id?: string }>;
    };
  }>;
};

type LoadParams = {
  clientId: string;
  currency: string;
  intent?: string;
  components?: string;
  enableFunding?: string;
  disableFunding?: string;
};

const loaderCache = new Map<string, Promise<PayPalNamespace>>();

function buildSdkUrl({ clientId, currency, intent = 'capture', components = 'buttons', enableFunding, disableFunding }: LoadParams) {
  const params = new URLSearchParams({
    'client-id': clientId,
    currency,
    intent,
    components,
    commit: 'true',
  });
  if (enableFunding) params.set('enable-funding', enableFunding);
  if (disableFunding) params.set('disable-funding', disableFunding);
  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

function loadPayPalSdk(params: LoadParams): Promise<PayPalNamespace> {
  const url = buildSdkUrl(params);
  if (loaderCache.has(url)) {
    return loaderCache.get(url)!;
  }

  const promise = new Promise<PayPalNamespace>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('PayPal SDK benötigt eine Browser-Umgebung'));
      return;
    }

    const resolveWithNamespace = () => {
      if (window.paypal) {
        resolve(window.paypal as PayPalNamespace);
      } else {
        reject(new Error('PayPal SDK konnte nicht initialisiert werden'));
      }
    };

    if (window.paypal) {
      resolveWithNamespace();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
    if (existing) {
      existing.addEventListener('load', resolveWithNamespace, { once: true });
      existing.addEventListener('error', () => reject(new Error('PayPal SDK konnte nicht geladen werden')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.async = true;
    script.addEventListener('load', resolveWithNamespace, { once: true });
    script.addEventListener('error', () => reject(new Error('PayPal SDK konnte nicht geladen werden')), { once: true });
    document.head.appendChild(script);
  });

  loaderCache.set(url, promise);
  return promise;
}

type Props = {
  clientId: string;
  currency: string;
  amount: number;
  customId: string;
  disabled?: boolean;
  onValidate?: () => boolean | Promise<boolean>;
  onApprove: (payload: { captureId: string; orderId?: string }) => void | Promise<void>;
  onError?: (message: string) => void;
  onReady?: () => void;
};

export default function PayPalButtons({
  clientId,
  currency,
  amount,
  customId,
  disabled = false,
  onValidate,
  onApprove,
  onError,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<PayPalButtonsInstance | null>(null);
  const actionsRef = useRef<PayPalInitActions | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const amountValue = useMemo(() => {
    const rounded = Math.max(0, Math.round(amount * 100) / 100);
    return Number.isFinite(rounded) ? rounded : 0;
  }, [amount]);

  useEffect(() => {
    if (!clientId) {
      const message = 'PayPal ist nicht konfiguriert.';
      setLocalError(message);
      onError?.(message);
      return () => undefined;
    }

    let active = true;
    setLocalError(null);

    loadPayPalSdk({
      clientId,
      currency,
      components: 'buttons',
      enableFunding: 'card,sepa,giropay,sofort',
    })
      .then((paypal) => {
        if (!active) return;
        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = '';
        instanceRef.current?.close?.();

        const buttons = paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', color: 'gold', label: 'paypal' },
          onInit: (_data, actions) => {
            actionsRef.current = actions;
            if (disabled) actions.disable();
            else actions.enable();
            onReady?.();
          },
          onClick: (_data, actions) => {
            if (!onValidate) {
              actions.resolve();
              return;
            }
            Promise.resolve(onValidate())
              .then((ok) => {
                if (ok) actions.resolve();
                else actions.reject();
              })
              .catch((err) => {
                const message = err instanceof Error ? err.message : 'Prüfung fehlgeschlagen';
                setLocalError(message);
                onError?.(message);
                actions.reject();
              });
          },
          createOrder: (_data, actions) =>
            actions.order.create({
              intent: 'CAPTURE',
              purchase_units: [
                {
                  amount: {
                    currency_code: currency,
                    value: amountValue.toFixed(2),
                  },
                  custom_id: customId,
                },
              ],
              application_context: { shipping_preference: 'NO_SHIPPING' },
            }),
          onApprove: async (data, actions) => {
            try {
              const details = await actions.order.capture();
              const capture =
                details?.purchase_units?.[0]?.payments?.captures?.[0]?.id ??
                details?.id;
              if (!capture) throw new Error('PayPal-Capture fehlgeschlagen');
              await onApprove({ captureId: capture, orderId: data?.orderID });
            } catch (err) {
              const message = err instanceof Error ? err.message : 'PayPal-Capture fehlgeschlagen';
              setLocalError(message);
              onError?.(message);
            }
          },
          onError: (err) => {
            const message = err instanceof Error ? err.message : 'PayPal konnte nicht geladen werden';
            setLocalError(message);
            onError?.(message);
          },
        });

        if (!buttons.isEligible()) {
          const message = 'PayPal ist für diese Bestellung nicht verfügbar.';
          setLocalError(message);
          onError?.(message);
          return;
        }

        instanceRef.current = buttons;
        buttons.render(container).catch((err) => {
          const message = err instanceof Error ? err.message : 'PayPal konnte nicht geladen werden';
          setLocalError(message);
          onError?.(message);
        });
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'PayPal konnte nicht geladen werden';
        setLocalError(message);
        onError?.(message);
      });

    return () => {
      active = false;
      actionsRef.current = null;
      if (instanceRef.current?.close) {
        instanceRef.current.close();
      }
      instanceRef.current = null;
    };
  }, [clientId, currency, amountValue, customId, disabled, onValidate, onApprove, onError, onReady]);

  useEffect(() => {
    if (!actionsRef.current) return;
    if (disabled) actionsRef.current.disable();
    else actionsRef.current.enable();
  }, [disabled]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} />
      {localError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{localError}</div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}
