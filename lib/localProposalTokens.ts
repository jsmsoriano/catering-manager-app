import type { ProposalSnapshot, ProposalStatus, ProposalToken } from './proposalTypes';

const STORAGE_KEY = 'proposalTokens.local';

type LocalProposalRecord = ProposalToken;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadAll(): LocalProposalRecord[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalProposalRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAll(records: LocalProposalRecord[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function createLocalProposalToken(input: {
  bookingId: string;
  snapshot: ProposalSnapshot;
}): { token: string; url: string; proposal: ProposalToken } {
  const token = `local-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const proposal: ProposalToken = {
    id: token,
    token,
    bookingId: input.bookingId,
    status: 'pending',
    snapshot: input.snapshot,
    createdAt: now,
    acceptedAt: null,
    expiresAt: null,
  };
  const existing = loadAll().filter((p) => p.token !== token);
  saveAll([...existing, proposal]);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return { token, url: `${origin}/proposal/${token}`, proposal };
}

export function getLocalProposalToken(token: string): ProposalToken | null {
  const existing = loadAll().find((p) => p.token === token);
  return existing ?? null;
}

export function updateLocalProposalStatus(token: string, status: ProposalStatus): ProposalToken | null {
  const records = loadAll();
  const idx = records.findIndex((p) => p.token === token);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const updated: ProposalToken = {
    ...records[idx],
    status,
    acceptedAt: status === 'accepted' ? now : records[idx].acceptedAt ?? null,
  };
  records[idx] = updated;
  saveAll(records);
  return updated;
}

export function updateLocalProposalSnapshot(
  token: string,
  updater: (snapshot: ProposalSnapshot) => ProposalSnapshot
): ProposalToken | null {
  const records = loadAll();
  const idx = records.findIndex((p) => p.token === token);
  if (idx < 0) return null;
  const updated: ProposalToken = {
    ...records[idx],
    snapshot: updater(records[idx].snapshot),
  };
  records[idx] = updated;
  saveAll(records);
  return updated;
}
