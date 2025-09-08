"use client";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { PayPalScriptOptions } from "@paypal/paypal-js";

export default function PayPalProvider({ clientId, currency, intent, children }: { clientId?: string; currency: string; intent?: "capture"|"authorize"; children: React.ReactNode }) {
  const id = clientId && clientId.trim().length > 0 ? clientId : 'sb';
  const options: PayPalScriptOptions = { clientId: id, currency, intent: intent || 'capture', components: 'buttons' };
  return <PayPalScriptProvider options={options}>{children}</PayPalScriptProvider>;
}
