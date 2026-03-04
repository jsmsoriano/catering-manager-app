import Link from 'next/link';

export default function BetaPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-text-primary">Beta Testing Hub</h1>
          <p className="text-sm text-text-muted">
            Use this page to access core workflows and report issues during beta.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card-elevated p-6">
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Start Here</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/login" className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-text-primary hover:bg-card-elevated">
              Admin Login
            </Link>
            <Link href="/inquiry-form" className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-text-primary hover:bg-card-elevated">
              Customer Inquiry Form
            </Link>
            <Link href="/bookings/new" className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-text-primary hover:bg-card-elevated">
              New Lead Workflow
            </Link>
            <Link href="/bookings" className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-text-primary hover:bg-card-elevated">
              Events Pipeline
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card-elevated p-6">
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Beta Checklist</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
            <li>Submit inquiry from public form and confirm it appears in Inquiries.</li>
            <li>Convert inquiry to lead/event and verify status progression.</li>
            <li>Send quote and open the proposal link as customer.</li>
            <li>Accept proposal and verify event status moves forward.</li>
            <li>Assign staff, review menu status, and confirm event completion flow.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
