// ============================================================================
// API REQUEST VALIDATION SCHEMAS (Zod)
// ============================================================================
// Import and use these in API route handlers to validate request bodies
// before touching the database.

import { z } from 'zod';

// ─── Shared primitives ────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoTimestamp = z.string().datetime({ offset: true });
const nonEmptyString = z.string().min(1);
const MAX_GUESTS = 5_000;

/** Max length for proposal URL token (UUID ~36; 200 allows future formats). */
export const MAX_PROPOSAL_TOKEN_LENGTH = 200;
const proposalToken = z.string().trim().min(1).max(MAX_PROPOSAL_TOKEN_LENGTH);

// ─── ProposalSnapshot ─────────────────────────────────────────────────────────

export const proposalSnapshotSchema = z.object({
  customerName: nonEmptyString,
  customerEmail: z.string().email(),
  eventDate: isoDate,
  eventTime: z.string(),
  location: z.string(),
  adults: z.number().int().min(1).max(MAX_GUESTS),
  children: z.number().int().min(0).max(MAX_GUESTS),
  eventType: nonEmptyString,
  subtotal: z.number().min(0),
  gratuity: z.number().min(0),
  distanceFee: z.number().min(0),
  total: z.number().min(0),
  businessName: nonEmptyString,
  sentAt: isoTimestamp,
  // all other optional snapshot fields are allowed through passthrough
}).passthrough();

// ─── POST /api/proposals/create ───────────────────────────────────────────────

export const createProposalBodySchema = z.object({
  bookingId: nonEmptyString,
  snapshot: proposalSnapshotSchema,
});

// ─── POST /api/proposals/update ───────────────────────────────────────────────

export const updateProposalBodySchema = z.object({
  token: proposalToken,
  snapshot: proposalSnapshotSchema,
});

// ─── POST /api/proposals/accept ───────────────────────────────────────────────

export const acceptProposalBodySchema = z.object({
  token: proposalToken,
});

// ─── POST /api/proposals/update-guests ───────────────────────────────────────

export const updateGuestsBodySchema = z.object({
  token: proposalToken,
  adults: z.number().int().min(1).max(MAX_GUESTS),
  children: z.number().int().min(0).max(MAX_GUESTS),
});

// ─── POST /api/proposals/request-menu-change ──────────────────────────────────

export const requestMenuChangeBodySchema = z.object({
  token: proposalToken,
  note: z.string().trim().min(1).max(2_000),
});

// ─── POST /api/emails/send ────────────────────────────────────────────────────

const emailTypes = ['confirmation', 'receipt', 'deposit_reminder', 'balance_reminder', 'thank_you', 'proposal'] as const;

export const sendEmailBodySchema = z.object({
  type: z.enum(emailTypes),
  booking: z.object({
    customerEmail: z.string().email(),
    customerName: z.string(),
    eventDate: z.string(),
    total: z.number().min(0),
  }).passthrough(),
  businessName: z.string().optional(),
  logoUrl: z.string().url().optional(),
  amount: z.number().min(0).optional(),
  method: z.string().optional(),
  proposalUrl: z.string().url().optional(),
  snapshot: proposalSnapshotSchema.optional(),
  proposalContent: z.record(z.string(), z.unknown()).optional(),
});

// ─── POST /api/emails/send-public ─────────────────────────────────────────────
// inquiry_ack only; customerEmail validated and optionally restricted by domain.

export const sendPublicEmailBodySchema = z.object({
  type: z.literal('inquiry_ack'),
  customerName: z.string().trim().min(1).max(120),
  booking: z.object({
    customerEmail: z.string().trim().email('Invalid email address').max(254),
    eventDate: z.string().trim().max(40).optional(),
  }),
  businessName: z.string().trim().min(1).max(120).optional(),
});
