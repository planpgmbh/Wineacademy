import CheckoutClient from './CheckoutClient';

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  const paypalClientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  const paypalCurrency = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY || 'EUR';
  return <CheckoutClient paypalClientId={paypalClientId} paypalCurrency={paypalCurrency} />;
}
