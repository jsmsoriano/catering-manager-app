// ============================================================================
// PROPOSAL TYPES
// ============================================================================
// Proposal tokens are shareable quote links sent to catering clients.
// The snapshot is a point-in-time copy of booking data stored in Supabase
// so clients can view the quote without needing auth or localStorage access.

/** Point-in-time booking snapshot saved to Supabase at proposal send time */
export interface ProposalSnapshot {
  customerName: string;
  customerEmail: string;
  eventDate: string;       // 'YYYY-MM-DD'
  eventTime: string;       // e.g. '6:00 PM'
  location: string;
  adults: number;
  children: number;
  eventType: string;       // e.g. 'Hibachi Private Dinner'
  subtotal: number;
  gratuity: number;
  distanceFee: number;
  total: number;
  depositAmount?: number;
  depositDueDate?: string;
  balanceDueDate?: string;
  notes?: string;
  menuSummary?: string;    // Plain-text summary built from EventMenu / CateringEventMenu
  businessName: string;
  sentAt: string;          // ISO timestamp
}

export type ProposalStatus = 'pending' | 'accepted' | 'expired';

/** Shape of a row from the proposal_tokens Supabase table */
export interface ProposalToken {
  id: string;
  token: string;
  bookingId: string;
  status: ProposalStatus;
  snapshot: ProposalSnapshot;
  createdAt: string;
  acceptedAt?: string | null;
  expiresAt?: string | null;
}
