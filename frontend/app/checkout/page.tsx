import CheckoutClient from './CheckoutClient';

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  const paypalClientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  const paypalCurrency = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY || 'EUR';
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Checkout</h1>
      <div className="mt-6">
        <CheckoutClient paypalClientId={paypalClientId} paypalCurrency={paypalCurrency} />
      </div>
    </div>
  );
}
