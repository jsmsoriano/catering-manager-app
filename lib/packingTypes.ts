export type PackingChecklistStatus = 'draft' | 'ready' | 'packed';

export type PackingItemCategory =
  | 'equipment'
  | 'tableware'
  | 'service'
  | 'supplies'
  | 'safety'
  | 'other';

export interface PackingChecklistItem {
  id: string;
  name: string;
  category: PackingItemCategory;
  qty: number;
  packed: boolean;
  required?: boolean;
  notes?: string;
  packedAt?: string;
}

export interface PackingChecklist {
  id: string;
  bookingId: string;
  status: PackingChecklistStatus;
  items: PackingChecklistItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
