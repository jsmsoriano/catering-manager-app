import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import {
  bookingConfirmationEmail,
  paymentReceiptEmail,
  depositReminderEmail,
  balanceReminderEmail,
  thankYouEmail,
  proposalEmail,
} from '@/lib/emailTemplates';
import type { Booking } from '@/lib/bookingTypes';
import type { ProposalSnapshot } from '@/lib/proposalTypes';
import type { ProposalWriterConfig } from '@/lib/proposalWriter';
import { sendEmailBodySchema } from '@/lib/apiSchemas';

async function getAuthenticatedUser() {
  const bypass = process.env.BYPASS_AUTH === 'true';
  if (bypass) {
    return { id: 'bypass-user', email: process.env.EMAIL_TEST_RECIPIENT ?? undefined } as {
      id: string;
      email?: string;
    };
  }
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = sendEmailBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data as unknown as {
    type: 'confirmation' | 'receipt' | 'deposit_reminder' | 'balance_reminder' | 'thank_you' | 'proposal';
    booking: Booking;
    businessName?: string;
    logoUrl?: string;
    amount?: number;
    method?: string;
    proposalUrl?: string;
    snapshot?: ProposalSnapshot;
    proposalContent?: ProposalWriterConfig;
  };

  const { type, booking, businessName = 'Your Caterer', amount, method } = body;

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
  } else if (type === 'deposit_reminder') {
    ({ subject, html } = depositReminderEmail(booking, businessName));
  } else if (type === 'balance_reminder') {
    ({ subject, html } = balanceReminderEmail(booking, businessName));
  } else if (type === 'thank_you') {
    ({ subject, html } = thankYouEmail(booking, businessName));
  } else if (type === 'proposal') {
    if (!body.snapshot || !body.proposalUrl) {
      return NextResponse.json(
        { error: 'snapshot and proposalUrl are required for proposal emails' },
        { status: 400 }
      );
    }
    ({ subject, html } = proposalEmail(
      body.snapshot,
      body.proposalUrl,
      body.logoUrl ?? process.env.EMAIL_LOGO_URL,
      body.proposalContent
    ));
  } else {
    return NextResponse.json({ error: 'Unknown email type' }, { status: 400 });
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const configuredTestRecipient = process.env.EMAIL_TEST_RECIPIENT?.trim();
  const shouldRerouteExampleAddress = booking.customerEmail.toLowerCase().endsWith('@example.com');
  const resolvedTo =
    configuredTestRecipient ||
    (shouldRerouteExampleAddress && user?.email ? user.email : booking.customerEmail);

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: resolvedTo,
    subject,
    html,
    ...(type === 'proposal' && user?.email && user.email !== resolvedTo && { bcc: [user.email] }),
  });

  if (error) {
    console.error('[api/emails/send]', error);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true, deliveredTo: resolvedTo });
}
