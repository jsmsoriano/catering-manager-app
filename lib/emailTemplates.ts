// ============================================================================
// EMAIL TEMPLATES
// ============================================================================
// Pure functions that return { subject, html } for each transactional email type.
// No external dependencies — just string templates.

import type { Booking } from './bookingTypes';
import type { ProposalSnapshot } from './proposalTypes';

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

// ─── Deposit Reminder ─────────────────────────────────────────────────────────

export function depositReminderEmail(
  booking: Booking,
  businessName: string
): { subject: string; html: string } {
  const subject = `Deposit Reminder — Your Event on ${booking.eventDate}`;

  const dueLine = booking.depositDueDate
    ? `<strong>due by ${booking.depositDueDate}</strong>`
    : '<strong>due soon</strong>';

  const html = `
<div style="${baseStyle}">
  <div style="background:#f59e0b;padding:32px 24px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${businessName}</h1>
    <p style="margin:8px 0 0;color:#fef3c7;font-size:14px;">Deposit Reminder</p>
  </div>
  <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;margin:0 0 16px;">Hi ${booking.customerName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">
      This is a friendly reminder that your deposit for the upcoming event is ${dueLine}.
    </p>
    <table style="${tableStyle}">
      <tr>
        <td style="${tdLabelStyle}">Event Date</td>
        <td style="${tdValueStyle}"><strong>${booking.eventDate}</strong></td>
      </tr>
      ${booking.eventTime ? `<tr><td style="${tdLabelStyle}">Time</td><td style="${tdValueStyle}">${booking.eventTime}</td></tr>` : ''}
      <tr>
        <td style="${tdLabelStyle}">Deposit Amount</td>
        <td style="${tdValueStyle}"><strong>${fmt(booking.depositAmount ?? 0)}</strong></td>
      </tr>
      ${booking.depositDueDate ? `<tr><td style="${tdLabelStyle}">Due By</td><td style="${tdValueStyle}"><strong style="color:#d97706;">${booking.depositDueDate}</strong></td></tr>` : ''}
    </table>
    <p style="font-size:14px;color:#374151;margin:24px 0 0;">
      Please reach out if you have any questions about payment methods or scheduling.
    </p>
    <p style="font-size:14px;color:#374151;margin:8px 0 0;">— ${businessName}</p>
  </div>
</div>`;

  return { subject, html };
}

// ─── Balance Reminder ─────────────────────────────────────────────────────────

export function balanceReminderEmail(
  booking: Booking,
  businessName: string
): { subject: string; html: string } {
  const subject = `Balance Due — Your Event on ${booking.eventDate}`;

  const html = `
<div style="${baseStyle}">
  <div style="background:#ef4444;padding:32px 24px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${businessName}</h1>
    <p style="margin:8px 0 0;color:#fee2e2;font-size:14px;">Balance Due</p>
  </div>
  <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;margin:0 0 16px;">Hi ${booking.customerName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">
      Your remaining balance is due before your event. Please arrange payment at your earliest convenience.
    </p>
    <table style="${tableStyle}">
      <tr>
        <td style="${tdLabelStyle}">Event Date</td>
        <td style="${tdValueStyle}"><strong>${booking.eventDate}</strong></td>
      </tr>
      ${booking.eventTime ? `<tr><td style="${tdLabelStyle}">Time</td><td style="${tdValueStyle}">${booking.eventTime}</td></tr>` : ''}
      <tr>
        <td style="${tdLabelStyle}">Balance Due</td>
        <td style="${tdValueStyle}"><strong style="font-size:18px;">${fmt(booking.balanceDueAmount ?? 0)}</strong></td>
      </tr>
      ${booking.balanceDueDate ? `<tr><td style="${tdLabelStyle}">Due By</td><td style="${tdValueStyle}"><strong style="color:#dc2626;">${booking.balanceDueDate}</strong></td></tr>` : ''}
      <tr>
        <td style="${tdLabelStyle}">Already Paid</td>
        <td style="${tdValueStyle}">${fmt(booking.amountPaid ?? 0)}</td>
      </tr>
      <tr>
        <td style="${tdLabelStyle}">Total</td>
        <td style="${tdValueStyle}">${fmt(booking.total)}</td>
      </tr>
    </table>
    <p style="font-size:14px;color:#374151;margin:24px 0 0;">
      If you have already arranged payment or have any questions, please reply to this email.
    </p>
    <p style="font-size:14px;color:#374151;margin:8px 0 0;">— ${businessName}</p>
  </div>
</div>`;

  return { subject, html };
}

// ─── Thank You / Post-Event ───────────────────────────────────────────────────

export function thankYouEmail(
  booking: Booking,
  businessName: string
): { subject: string; html: string } {
  const subject = `Thank You — Hope You Enjoyed Your Event!`;

  const html = `
<div style="${baseStyle}">
  <div style="background:#16a34a;padding:32px 24px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${businessName}</h1>
    <p style="margin:8px 0 0;color:#dcfce7;font-size:14px;">Thank You!</p>
  </div>
  <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;margin:0 0 16px;">Hi ${booking.customerName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">
      Thank you for choosing <strong>${businessName}</strong> for your event on <strong>${booking.eventDate}</strong>.
      We hope you and your guests had a wonderful time!
    </p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">
      We'd love to hear your feedback, and we hope to serve you again for your next event.
      Feel free to reach out anytime — we look forward to creating another great experience together.
    </p>
    <p style="font-size:14px;color:#374151;margin:0 0 8px;font-weight:600;">Planning another event?</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">
      Reply to this email or contact us to check availability and get a quote for your next celebration.
    </p>
    <p style="font-size:14px;color:#374151;margin:24px 0 0;">— ${businessName}</p>
  </div>
</div>`;

  return { subject, html };
}

// ─── Inquiry Acknowledgment ───────────────────────────────────────────────────

export function inquiryAckEmail(
  customerName: string,
  eventDate: string,
  businessName: string
): { subject: string; html: string } {
  const subject = `We received your inquiry — ${businessName}`;

  const dateLine = eventDate
    ? `<tr><td style="${tdLabelStyle}">Requested Date</td><td style="${tdValueStyle}"><strong>${eventDate}</strong></td></tr>`
    : '';

  const html = `
<div style="${baseStyle}">
  <div style="background:#0ea5e9;padding:32px 24px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${businessName}</h1>
    <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Inquiry Received</p>
  </div>
  <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;margin:0 0 16px;">Hi ${customerName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">
      Thank you for reaching out to <strong>${businessName}</strong>! We've received your inquiry
      and will be in touch within <strong>24 hours</strong> to confirm availability and discuss the details.
    </p>
    ${dateLine ? `<table style="${tableStyle}">${dateLine}</table>` : ''}
    <p style="font-size:14px;color:#374151;margin:24px 0 8px;">
      In the meantime, feel free to reply to this email if you have any questions.
    </p>
    <p style="font-size:14px;color:#374151;margin:0;">— ${businessName}</p>
  </div>
</div>`;

  return { subject, html };
}

// ─── Proposal / Quote ─────────────────────────────────────────────────────────

export function proposalEmail(
  snapshot: ProposalSnapshot,
  proposalUrl: string
): { subject: string; html: string } {
  const subject = `Your Event Quote — ${snapshot.businessName}`;

  const guestLabel = `${snapshot.adults} adult${snapshot.adults !== 1 ? 's' : ''}${
    snapshot.children ? ` + ${snapshot.children} child${snapshot.children !== 1 ? 'ren' : ''}` : ''
  }`;

  const depositRow = snapshot.depositAmount && snapshot.depositAmount > 0
    ? `<tr>
        <td style="${tdLabelStyle}">Deposit Required</td>
        <td style="${tdValueStyle}">${fmt(snapshot.depositAmount)}${snapshot.depositDueDate ? ` by ${snapshot.depositDueDate}` : ''}</td>
      </tr>`
    : '';

  const balanceRow = snapshot.depositAmount && snapshot.depositAmount > 0
    ? `<tr>
        <td style="${tdLabelStyle}">Balance Due</td>
        <td style="${tdValueStyle}">${fmt(snapshot.total - snapshot.depositAmount)}${snapshot.balanceDueDate ? ` by ${snapshot.balanceDueDate}` : ''}</td>
      </tr>`
    : '';

  const menuRow = snapshot.menuSummary
    ? `<tr>
        <td style="${tdLabelStyle}">Menu</td>
        <td style="${tdValueStyle}">${snapshot.menuSummary.replace(/\n/g, '<br>')}</td>
      </tr>`
    : '';

  const notesRow = snapshot.notes
    ? `<tr>
        <td style="${tdLabelStyle}">Notes</td>
        <td style="${tdValueStyle}">${snapshot.notes.replace(/\n/g, '<br>')}</td>
      </tr>`
    : '';

  const html = `
<div style="${baseStyle}">
  <div style="background:#0ea5e9;padding:32px 24px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${snapshot.businessName}</h1>
    <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Event Quote</p>
  </div>
  <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;margin:0 0 16px;">Hi ${snapshot.customerName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">
      Thank you for your interest! Here is your personalized quote. Review the details below
      and click the button to accept online.
    </p>
    <table style="${tableStyle}">
      <tr>
        <td style="${tdLabelStyle}">Event Date</td>
        <td style="${tdValueStyle}"><strong>${snapshot.eventDate}</strong></td>
      </tr>
      ${snapshot.eventTime ? `<tr><td style="${tdLabelStyle}">Time</td><td style="${tdValueStyle}">${snapshot.eventTime}</td></tr>` : ''}
      ${snapshot.location ? `<tr><td style="${tdLabelStyle}">Location</td><td style="${tdValueStyle}">${snapshot.location}</td></tr>` : ''}
      <tr>
        <td style="${tdLabelStyle}">Guests</td>
        <td style="${tdValueStyle}">${guestLabel}</td>
      </tr>
      <tr>
        <td style="${tdLabelStyle}">Event Type</td>
        <td style="${tdValueStyle}">${snapshot.eventType}</td>
      </tr>
      ${menuRow}
    </table>
    <table style="${tableStyle}">
      <tr>
        <td style="${tdLabelStyle}">Subtotal</td>
        <td style="${tdValueStyle}">${fmt(snapshot.subtotal)}</td>
      </tr>
      ${snapshot.gratuity > 0 ? `<tr><td style="${tdLabelStyle}">Gratuity</td><td style="${tdValueStyle}">${fmt(snapshot.gratuity)}</td></tr>` : ''}
      ${snapshot.distanceFee > 0 ? `<tr><td style="${tdLabelStyle}">Travel Fee</td><td style="${tdValueStyle}">${fmt(snapshot.distanceFee)}</td></tr>` : ''}
      <tr>
        <td style="${tdLabelStyle}">Total</td>
        <td style="${tdValueStyle}"><strong style="font-size:18px;">${fmt(snapshot.total)}</strong></td>
      </tr>
      ${depositRow}
      ${balanceRow}
    </table>
    ${notesRow ? `<table style="${tableStyle}">${notesRow}</table>` : ''}
    <div style="text-align:center;margin:32px 0;">
      <a href="${proposalUrl}"
         style="display:inline-block;background:#0ea5e9;color:#fff;font-size:16px;font-weight:700;
                padding:14px 32px;border-radius:8px;text-decoration:none;">
        View &amp; Accept Quote
      </a>
    </div>
    <p style="font-size:13px;color:#6b7280;text-align:center;margin:0;">
      Or copy this link: <a href="${proposalUrl}" style="color:#0ea5e9;">${proposalUrl}</a>
    </p>
    <p style="font-size:14px;color:#374151;margin:24px 0 0;">
      Questions? Simply reply to this email — we're happy to help.
    </p>
    <p style="font-size:14px;color:#374151;margin:8px 0 0;">— ${snapshot.businessName}</p>
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
