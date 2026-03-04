import type { ProductProfile } from './featureFlags';

export const PROPOSAL_WRITER_STORAGE_KEY = 'proposalWriterConfig';

export interface ProposalWriterConfig {
  intro: string;
  highlightsTitle: string;
  highlightsBody: string;
  termsTitle: string;
  termsBody: string;
  closing: string;
  ctaLabel: string;
  packageNames: string[];
}

export const DEFAULT_PROPOSAL_WRITER_CONFIG: ProposalWriterConfig = {
  intro:
    'Thank you for your inquiry. Your personalized quote is ready. Review the details below and confirm online when you are ready.',
  highlightsTitle: 'What is included',
  highlightsBody: '- On-site setup and service\n- Event coordination support\n- Final details confirmation before event day',
  termsTitle: 'Important details',
  termsBody:
    '- Deposit secures your event date\n- Guest count changes are allowed until the cutoff window\n- Final balance is due by the listed balance due date',
  closing: 'Questions? Reply to this email and our team will help right away.',
  ctaLabel: 'View and Accept Quote',
  packageNames: ['Standard Package', 'Premium Package'],
};

export function loadProposalWriterConfig(): ProposalWriterConfig {
  if (typeof window === 'undefined') return DEFAULT_PROPOSAL_WRITER_CONFIG;
  try {
    const raw = localStorage.getItem(PROPOSAL_WRITER_STORAGE_KEY);
    if (!raw) return DEFAULT_PROPOSAL_WRITER_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ProposalWriterConfig>;
    return {
      intro: (parsed.intro ?? DEFAULT_PROPOSAL_WRITER_CONFIG.intro).trim(),
      highlightsTitle: (parsed.highlightsTitle ?? DEFAULT_PROPOSAL_WRITER_CONFIG.highlightsTitle).trim(),
      highlightsBody: (parsed.highlightsBody ?? DEFAULT_PROPOSAL_WRITER_CONFIG.highlightsBody).trim(),
      termsTitle: (parsed.termsTitle ?? DEFAULT_PROPOSAL_WRITER_CONFIG.termsTitle).trim(),
      termsBody: (parsed.termsBody ?? DEFAULT_PROPOSAL_WRITER_CONFIG.termsBody).trim(),
      closing: (parsed.closing ?? DEFAULT_PROPOSAL_WRITER_CONFIG.closing).trim(),
      ctaLabel: (parsed.ctaLabel ?? DEFAULT_PROPOSAL_WRITER_CONFIG.ctaLabel).trim(),
      packageNames: Array.isArray(parsed.packageNames)
        ? parsed.packageNames.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean)
        : DEFAULT_PROPOSAL_WRITER_CONFIG.packageNames,
    };
  } catch {
    return DEFAULT_PROPOSAL_WRITER_CONFIG;
  }
}

export function saveProposalWriterConfig(config: ProposalWriterConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROPOSAL_WRITER_STORAGE_KEY, JSON.stringify(config));
}

export function shouldShowProposalWriter(profile: ProductProfile): boolean {
  return profile === 'catering_pro';
}
