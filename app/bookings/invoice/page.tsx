import { redirect } from 'next/navigation';

// Legacy URL: /bookings/invoice?bookingId=xxx
// Redirects to new canonical URL: /invoices/[id]
export default function LegacyInvoicePage({
  searchParams,
}: {
  searchParams: { bookingId?: string };
}) {
  const id = searchParams.bookingId;
  if (id) redirect(`/invoices/${id}`);
  redirect('/invoices');
}
