import {
  acceptProposalBodySchema,
  requestMenuChangeBodySchema,
  sendPublicEmailBodySchema,
  MAX_PROPOSAL_TOKEN_LENGTH,
} from '@/lib/apiSchemas';

describe('apiSchemas', () => {
  it('acceptProposalBodySchema rejects token longer than max', () => {
    const parsed = acceptProposalBodySchema.safeParse({
      token: 'a'.repeat(MAX_PROPOSAL_TOKEN_LENGTH + 1),
    });
    expect(parsed.success).toBe(false);
  });

  it('requestMenuChangeBodySchema rejects note longer than 2000 characters', () => {
    const parsed = requestMenuChangeBodySchema.safeParse({
      token: 'abc-123',
      note: 'x'.repeat(2001),
    });
    expect(parsed.success).toBe(false);
  });

  it('requestMenuChangeBodySchema trims and accepts valid payload', () => {
    const parsed = requestMenuChangeBodySchema.safeParse({
      token: '  abc-123  ',
      note: '  need to switch to shrimp for 2 guests  ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.token).toBe('abc-123');
      expect(parsed.data.note).toBe('need to switch to shrimp for 2 guests');
    }
  });

  it('sendPublicEmailBodySchema rejects invalid email', () => {
    const parsed = sendPublicEmailBodySchema.safeParse({
      type: 'inquiry_ack',
      customerName: 'Jane',
      booking: { customerEmail: 'not-an-email', eventDate: '2026-03-15' },
      businessName: 'Catering Co',
    });
    expect(parsed.success).toBe(false);
  });

  it('sendPublicEmailBodySchema accepts a valid inquiry_ack payload', () => {
    const parsed = sendPublicEmailBodySchema.safeParse({
      type: 'inquiry_ack',
      customerName: 'Jane',
      booking: { customerEmail: 'jane@example.com', eventDate: '2026-03-15' },
      businessName: 'Catering Co',
    });
    expect(parsed.success).toBe(true);
  });
});
