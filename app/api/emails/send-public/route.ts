// ============================================================================
// /api/emails/send-public — Unauthenticated email endpoint
// ============================================================================
// Only allows 'inquiry_ack' type. No auth required so public forms can send
// acknowledgment emails without an active admin session.
// Scoped narrowly to prevent abuse: only one email type, requires RESEND_API_KEY.

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { inquiryAckEmail } from '@/lib/emailTemplates';

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Email not configured — silently succeed so inquiry submission still works
    return NextResponse.json({ success: true, skipped: true });
  }

  let body: {
    type: 'inquiry_ack';
    customerName: string;
    booking: { customerEmail: string; eventDate: string };
    businessName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.type !== 'inquiry_ack') {
    return NextResponse.json({ error: 'Only inquiry_ack is allowed on this endpoint' }, { status: 400 });
  }

  const { customerName, booking, businessName = 'Your Caterer' } = body;

  if (!booking?.customerEmail) {
    return NextResponse.json({ error: 'No customer email provided' }, { status: 400 });
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
