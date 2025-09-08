"use client";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";

export default function PayPalProvider({ clientId, currency, intent, children }: { clientId?: string; currency: string; intent?: "capture"|"authorize"; children: React.ReactNode }) {
  const id = clientId && clientId.trim().length > 0 ? clientId : 'sb';
  const options = { 'client-id': id, currency, intent: intent || 'capture', components: 'buttons' } as const;
  return <PayPalScriptProvider options={options}>{children}</PayPalScriptProvider>;
}

