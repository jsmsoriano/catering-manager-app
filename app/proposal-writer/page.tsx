'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFeatureFlags } from '@/lib/useFeatureFlags';
import {
  DEFAULT_PROPOSAL_WRITER_CONFIG,
  loadProposalWriterConfig,
  saveProposalWriterConfig,
  type ProposalWriterConfig,
} from '@/lib/proposalWriter';

export default function ProposalWriterPage() {
  const { productProfile } = useFeatureFlags();
  const [form, setForm] = useState<ProposalWriterConfig>(DEFAULT_PROPOSAL_WRITER_CONFIG);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(loadProposalWriterConfig());
  }, []);

  if (productProfile !== 'catering_pro') {
    return (
      <div className="min-h-screen p-8">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold text-text-primary">Proposal Writer</h1>
          <p className="mt-2 text-sm text-text-muted">
            Proposal Writer is available for the Professional Caterers profile only.
          </p>
          <Link
            href="/settings?tab=admin"
            className="mt-4 inline-block rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
          >
            Open Profile Settings
          </Link>
        </div>
      </div>
    );
  }

  const setField = <K extends keyof ProposalWriterConfig>(key: K, value: ProposalWriterConfig[K]) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    saveProposalWriterConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setForm(DEFAULT_PROPOSAL_WRITER_CONFIG);
    setSaved(false);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Proposal Writer</h1>
          <p className="mt-1 text-sm text-text-muted">
            Edit the reusable proposal sections used in quote emails.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-lg border border-border bg-card p-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Intro paragraph</label>
              <textarea
                value={form.intro}
                onChange={(e) => setField('intro', e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Highlights title</label>
              <input
                value={form.highlightsTitle}
                onChange={(e) => setField('highlightsTitle', e.target.value)}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Highlights body</label>
              <textarea
                value={form.highlightsBody}
                onChange={(e) => setField('highlightsBody', e.target.value)}
                rows={5}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Terms title</label>
              <input
                value={form.termsTitle}
                onChange={(e) => setField('termsTitle', e.target.value)}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Terms body</label>
              <textarea
                value={form.termsBody}
                onChange={(e) => setField('termsBody', e.target.value)}
                rows={5}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Closing paragraph</label>
              <textarea
                value={form.closing}
                onChange={(e) => setField('closing', e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">CTA button label</label>
              <input
                value={form.ctaLabel}
                onChange={(e) => setField('ctaLabel', e.target.value)}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Package names</label>
              <p className="mb-2 text-xs text-text-muted">
                One package per line. Menu Item Package Associations can link to this list.
              </p>
              <textarea
                value={form.packageNames.join('\n')}
                onChange={(e) =>
                  setField(
                    'packageNames',
                    e.target.value
                      .split('\n')
                      .map((v) => v.trim())
                      .filter(Boolean)
                  )
                }
                rows={4}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                placeholder={'Standard Package\nWedding Package'}
              />
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                Save sections
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-card"
              >
                Reset defaults
              </button>
              {saved && <span className="text-sm text-success">Saved.</span>}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-text-primary">Live Preview</h2>
            <div className="mt-3 space-y-4 rounded-md border border-border bg-card-elevated p-4 text-sm text-text-secondary">
              <p>{form.intro}</p>
              <div>
                <p className="font-semibold text-text-primary">{form.highlightsTitle}</p>
                <p className="mt-1 whitespace-pre-wrap">{form.highlightsBody}</p>
              </div>
              <div>
                <p className="font-semibold text-text-primary">{form.termsTitle}</p>
                <p className="mt-1 whitespace-pre-wrap">{form.termsBody}</p>
              </div>
              <p>{form.closing}</p>
              <div className="pt-2">
                <span className="inline-block rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                  {form.ctaLabel}
                </span>
              </div>
              <div className="pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Packages</p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {form.packageNames.map((pkg) => (
                    <li key={pkg}>{pkg}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
