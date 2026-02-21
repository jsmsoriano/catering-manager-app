// ============================================================================
// EMAIL TEMPLATES
// ============================================================================
// Pure functions that return { subject, html } for each transactional email type.
// No external dependencies — just string templates.

import type { Booking } from './bookingTypes';

function fmt(amount: number) {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  max-width: 560px;
  margin: 0 auto;
  color: #111;
  background: #fff;
`;

const tableStyle = `
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
`;

const tdLabelStyle = `padding: 8px 12px 8px 0; color: #555; font-size: 14px; vertical-align: top;`;
const tdValueStyle = `padding: 8px 0; font-size: 14px; vertical-align: top;`;

// ─── Booking Confirmation ─────────────────────────────────────────────────────

export function bookingConfirmationEmail(
  booking: Booking,
  businessName: string
): { subject: string; html: string } {
  const subject = `Booking Confirmed — ${booking.eventDate}`;

  const depositRow =
    booking.depositAmount && booking.depositAmount > 0
      ? `<tr>
          <td style="${tdLabelStyle}">Deposit Due</td>
          <td style="${tdValueStyle}">${fmt(booking.depositAmount)}${booking.depositDueDate ? ` by ${booking.depositDueDate}` : ''}</td>
        </tr>`
      : '';

  const balanceRow =
    booking.balanceDueAmount && booking.balanceDueAmount > 0
      ? `<tr>
          <td style="${tdLabelStyle}">Balance Due</td>
          <td style="${tdValueStyle}">${fmt(booking.balanceDueAmount)}${booking.balanceDueDate ? ` by ${booking.balanceDueDate}` : ''}</td>
        </tr>`
      : '';

  const notesRow = booking.notes
    ? `<tr>
        <td style="${tdLabelStyle}">Notes</td>
        <td style="${tdValueStyle}">${booking.notes.replace(/\n/g, '<br>')}</td>
      </tr>`
    : '';

  const guestCount =
    booking.adults + (booking.children ?? 0);
  const guestLabel =
    guestCount === 1
      ? '1 guest'
      : `${booking.adults} adult${booking.adults !== 1 ? 's' : ''}${booking.children ? ` + ${booking.children} child${booking.children !== 1 ? 'ren' : ''}` : ''}`;

  const html = `
<div style="${baseStyle}">
  <div style="background:#0ea5e9;padding:32px 24px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${businessName}</h1>
    <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Booking Confirmation</p>
  </div>
  <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;margin:0 0 16px;">Hi ${booking.customerName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">
      Your booking with <strong>${businessName}</strong> is confirmed. Here are your event details:
    </p>
    <table style="${tableStyle}">
      <tr>
        <td style="${tdLabelStyle}">Date</td>
        <td style="${tdValueStyle}"><strong>${booking.eventDate}</strong></td>
      </tr>
      ${booking.eventTime ? `<tr><td style="${tdLabelStyle}">Time</td><td style="${tdValueStyle}">${booking.eventTime}</td></tr>` : ''}
      ${booking.location ? `<tr><td style="${tdLabelStyle}">Location</td><td style="${tdValueStyle}">${booking.location}</td></tr>` : ''}
      <tr>
        <td style="${tdLabelStyle}">Guests</td>
        <td style="${tdValueStyle}">${guestLabel}</td>
      </tr>
      <tr>
        <td style="${tdLabelStyle}">Total</td>
        <td style="${tdValueStyle}"><strong>${fmt(booking.total)}</strong></td>
      </tr>
      ${depositRow}
      ${balanceRow}
      ${notesRow}
    </table>
    <p style="font-size:14px;color:#374151;margin:24px 0 0;">
      We look forward to serving you. If you have any questions, please reply to this email.
    </p>
    <p style="font-size:14px;color:#374151;margin:8px 0 0;">— ${businessName}</p>
  </div>
</div>`;

  return { subject, html };
}

// ─── Payment Receipt ──────────────────────────────────────────────────────────

export function paymentReceiptEmail(
  booking: Booking,
  amount: number,
  method: string,
  businessName: string
): { subject: string; html: string } {
  const subject = `Payment Receipt — ${fmt(amount)}`;

  const methodLabel =
    method === 'bank-transfer'
      ? 'Bank Transfer'
      : method.charAt(0).toUpperCase() + method.slice(1);

  const remaining = booking.balanceDueAmount ?? 0;
  const paidInFull = remaining <= 0;

  const balanceRow = paidInFull
    ? `<tr>
        <td style="${tdLabelStyle}">Status</td>
        <td style="${tdValueStyle}"><strong style="color:#16a34a;">Paid in Full ✓</strong></td>
      </tr>`
    : `<tr>
        <td style="${tdLabelStyle}">Balance Remaining</td>
        <td style="${tdValueStyle}"><strong>${fmt(remaining)}</strong></td>
      </tr>`;

  const html = `
<div style="${baseStyle}">
  <div style="background:#0ea5e9;padding:32px 24px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${businessName}</h1>
    <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Payment Receipt</p>
  </div>
  <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;margin:0 0 16px;">Hi ${booking.customerName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">
      We've received your payment. Here's a summary:
    </p>
    <table style="${tableStyle}">
      <tr>
        <td style="${tdLabelStyle}">Payment</td>
        <td style="${tdValueStyle}"><strong style="font-size:18px;">${fmt(amount)}</strong></td>
      </tr>
      <tr>
        <td style="${tdLabelStyle}">Method</td>
        <td style="${tdValueStyle}">${methodLabel}</td>
      </tr>
      <tr>
        <td style="${tdLabelStyle}">Event Date</td>
        <td style="${tdValueStyle}">${booking.eventDate}</td>
      </tr>
      <tr>
        <td style="${tdLabelStyle}">Total Paid</td>
        <td style="${tdValueStyle}">${fmt(booking.amountPaid ?? 0)}</td>
      </tr>
      ${balanceRow}
    </table>
    <p style="font-size:14px;color:#374151;margin:24px 0 0;">
      Thank you for your payment. Please keep this email for your records.
    </p>
    <p style="font-size:14px;color:#374151;margin:8px 0 0;">— ${businessName}</p>
  </div>
</div>`;

  return { subject, html };
}
