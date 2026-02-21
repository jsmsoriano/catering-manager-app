import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import { bookingConfirmationEmail, paymentReceiptEmail } from '@/lib/emailTemplates';
import type { Booking } from '@/lib/bookingTypes';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Email not configured — add RESEND_API_KEY to your environment variables.' },
      { status: 503 }
    );
  }

  let body: {
    type: 'confirmation' | 'receipt';
    booking: Booking;
    businessName?: string;
    amount?: number;
    method?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, booking, businessName = 'Your Caterer', amount, method } = body;

  if (!booking?.customerEmail) {
    return NextResponse.json(
      { error: 'No customer email on this booking' },
      { status: 400 }
    );
  }

  let subject: string;
  let html: string;

  if (type === 'confirmation') {
    ({ subject, html } = bookingConfirmationEmail(booking, businessName));
  } else if (type === 'receipt') {
    if (!amount || !method) {
      return NextResponse.json(
        { error: 'amount and method are required for receipt emails' },
        { status: 400 }
      );
    }
    ({ subject, html } = paymentReceiptEmail(booking, amount, method, businessName));
  } else {
    return NextResponse.json({ error: 'Unknown email type' }, { status: 400 });
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: booking.customerEmail,
    subject,
    html,
  });

  if (error) {
    console.error('[api/emails/send]', error);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
