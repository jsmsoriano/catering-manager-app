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
  logoUrl?: string;
  sentAt: string;          // ISO timestamp
  quoteVersion?: number;
  quoteRevisionReason?: string;
  guestChangeCutoffAt?: string;
  guestCountLockedAt?: string;
  finalAdults?: number;
  finalChildren?: number;
  guestCountLastClientEditAt?: string;
  guestChangeLockedReason?: string;
  requiresReview?: boolean;
  menuChangeCutoffAt?: string;
  menuChangeLockedAt?: string;
  menuChangeLockedReason?: string;
  menuChangeRequestStatus?: 'none' | 'pending' | 'approved' | 'declined';
  menuChangeRequestNote?: string;
  menuChangeRequestedAt?: string;
  menuChangeRequestLate?: boolean;
  menuChangeResolutionNote?: string;
  menuChangeResolvedAt?: string;
  menuChangeResolvedBy?: string;
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
