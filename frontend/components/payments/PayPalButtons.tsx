"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => {
        render: (selector: string | HTMLElement) => Promise<void>;
        close?: () => void;
      };
    };
  }
}

type PayPalButtonsProps = {
  amount: number;
  currency?: string;
  disabled?: boolean;
  label?: "pay" | "checkout" | "buynow" | "paylater";
  fundingSource?: "paypal" | "card";
  onInit?: (data: unknown, actions: any) => void;
  onApprove: (details: { orderId: string; captureId: string }) => void | Promise<void>;
  onError: (message: string) => void;
};

function buildPaypalUrl(clientId: string, currency: string) {
  const params = new URLSearchParams({
    "client-id": clientId,
    intent: "capture",
    currency
  });
  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

export function PayPalButtons({
  amount,
  currency = "EUR",
  disabled,
  label = "pay",
  fundingSource,
  onInit,
  onApprove,
  onError
}: PayPalButtonsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonsInstanceRef = useRef<{ render: (container: HTMLElement | string) => Promise<void>; close?: () => void } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastConfigKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
    if (clientId.length === 0) {
      setLoadingError(null);
      return;
    }

    let isMounted = true;

    async function loadScript() {
      if (window.paypal) {
        setIsReady(true);
        return;
      }
      try {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = buildPaypalUrl(clientId, currency);
          script.async = true;
          script.addEventListener("load", () => resolve());
          script.addEventListener("error", () => reject(new Error("PayPal SDK konnte nicht geladen werden.")));
          document.body.appendChild(script);
        });
        if (isMounted) {
          setIsReady(true);
        }
      } catch (error) {
        if (isMounted) {
          setLoadingError(
            error instanceof Error ? error.message : "PayPal SDK konnte nicht geladen werden."
          );
        }
      }
    }

    loadScript();

    return () => {
      isMounted = false;
    };
  }, [currency]);

  useEffect(() => {
    return () => {
      if (buttonsInstanceRef.current?.close) {
        buttonsInstanceRef.current.close();
      }
      buttonsInstanceRef.current = null;
      lastConfigKeyRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.pointerEvents = disabled ? "none" : "auto";
      containerRef.current.style.opacity = disabled ? "0.6" : "1";
    }
  }, [disabled]);

  useEffect(() => {
    if (!isReady || !containerRef.current || disabled) {
      return;
    }
    if (!window.paypal?.Buttons) {
      setLoadingError("PayPal Buttons stehen nicht zur Verfügung.");
      return;
    }

    const configKey = JSON.stringify({
      amount,
      currency,
      label,
      fundingSource: fundingSource ?? null
    });

    if (lastConfigKeyRef.current === configKey && buttonsInstanceRef.current) {
      return;
    }
    lastConfigKeyRef.current = configKey;

    if (buttonsInstanceRef.current?.close) {
      try {
        buttonsInstanceRef.current.close();
      } catch {
        // ignore close errors from previous instances
      }
    }
    buttonsInstanceRef.current = null;
    containerRef.current.innerHTML = "";

    const buttonOptions: Record<string, unknown> = {
      style: { shape: "pill", layout: "horizontal", label, tagline: false },
      createOrder: (_data: unknown, actions: any) => {
        const value = Math.max(0, Number.isFinite(amount) ? amount : 0).toFixed(2);
        return actions.order.create({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: currency,
                value
              }
            }
          ]
        });
      },
      onApprove: async (_data: unknown, actions: any) => {
        try {
          setIsProcessing(true);
          const details = await actions.order.capture();
          const orderId = details?.id ?? null;
          const capture = details?.purchase_units?.[0]?.payments?.captures?.[0];
          const captureId = capture?.id ?? null;
          if (!orderId || !captureId) {
            throw new Error("PayPal hat keine Capture-ID geliefert.");
          }
          await onApprove({ orderId, captureId });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "PayPal-Zahlung konnte nicht abgeschlossen werden.";
          onError(message);
        } finally {
          setIsProcessing(false);
        }
      },
      onInit,
      onError: (err: any) => {
        const message = err?.message || "PayPal-Zahlung konnte nicht gestartet werden.";
        onError(message);
      }
    };

    if (fundingSource) {
      buttonOptions.fundingSource = fundingSource;
    }

    buttonsInstanceRef.current = window.paypal.Buttons(buttonOptions);

    if (buttonsInstanceRef.current) {
      buttonsInstanceRef.current.render(containerRef.current);
    }
  }, [amount, currency, disabled, isReady, onApprove, onError, label, fundingSource, onInit]);

  if (loadingError) {
    return <p className="text-sm text-error">{loadingError}</p>;
  }

  return (
    <div>
      {isProcessing ? (
        <p className="mb-3 text-sm text-base-content/70">PayPal-Zahlung wird verarbeitet...</p>
      ) : null}
      <div ref={containerRef} />
    </div>
  );
}
