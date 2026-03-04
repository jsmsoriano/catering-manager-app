// ============================================================================
// /api/emails/send-public — Unauthenticated email endpoint
// ============================================================================
// Only allows 'inquiry_ack' type. No auth required so public forms can send
// acknowledgment emails without an active admin session.
// Scoped narrowly to prevent abuse: only one email type, requires RESEND_API_KEY.
// Validates email format and optionally restricts to RESEND_ALLOWED_EMAIL_DOMAINS.

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { inquiryAckEmail } from '@/lib/emailTemplates';
import { createRateLimiter } from '@/lib/rateLimit';
import { sendPublicEmailBodySchema } from '@/lib/apiSchemas';

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** If set (comma-separated, e.g. gmail.com,outlook.com), only these domains may receive inquiry_ack. */
function getAllowedEmailDomains(): string[] {
  const raw = process.env.RESEND_ALLOWED_EMAIL_DOMAINS;
  if (!raw?.trim()) return [];
  return raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function isEmailDomainAllowed(email: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? allowedDomains.includes(domain) : false;
}

export async function POST(req: NextRequest) {
  const rl = await limiter.check(req);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Email not configured — silently succeed so inquiry submission still works
    return NextResponse.json({ success: true, skipped: true });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = sendPublicEmailBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { customerName, booking, businessName = 'Your Caterer' } = parsed.data;
  const allowedDomains = getAllowedEmailDomains();
  if (process.env.NODE_ENV === 'production' && allowedDomains.length === 0) {
    return NextResponse.json(
      { error: 'Email allowlist is not configured' },
      { status: 503 }
    );
  }

  if (!isEmailDomainAllowed(booking.customerEmail, allowedDomains)) {
    return NextResponse.json(
      { error: 'Email domain is not allowed for this endpoint' },
      { status: 400 }
    );
  }

  const { subject, html } = inquiryAckEmail(customerName, booking.eventDate ?? '', businessName);

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: booking.customerEmail,
    subject,
    html,
  });

  if (error) {
    console.error('[api/emails/send-public]', error);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
