import { expect, test } from '@playwright/test';

function isoDate(daysFromNow = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Smoke', () => {
  test('inquiry form blocks past dates using min date', async ({ page }) => {
    await page.goto('/inquiry');
    await expect(page.getByRole('heading', { name: /book your event/i })).toBeVisible();

    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeVisible();
    await expect(dateInput).toHaveAttribute('min', isoDate(0));
  });

  test('lead queue to quote preview and client portal request', async ({ page }) => {
    await page.goto('/inquiries');
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();

    await page.getByRole('button', { name: /load test/i }).first().click();
    await expect(page.getByRole('button', { name: /preview & send quote/i })).toBeVisible();

    await page.getByRole('button', { name: /preview & send quote/i }).click();
    await expect(page.getByRole('heading', { name: /quote preview/i })).toBeVisible();

    const sendTo = page.getByLabel(/send to email/i);
    await sendTo.fill('qa@example.com');
    await page.getByRole('button', { name: /^send quote$|update & resend quote/i }).click();

    const portalLink = page.getByRole('link', { name: /open client portal/i }).first();
    await expect(portalLink).toBeVisible();
    const href = await portalLink.getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(href!);
    await expect(page.getByRole('heading', { name: /your event proposal/i })).toBeVisible();

    await page.getByLabel(/requested menu updates/i).fill('QA smoke test menu update');
    await page.getByRole('button', { name: /submit menu request|submit late request/i }).click();
    await expect(page.getByText(/menu change request submitted|late menu request submitted/i)).toBeVisible();
  });

  test('event confirmation remains blocked until requirements are met', async ({ page }) => {
    const eventId = 'e2e-smoke-event';
    await page.addInitScript(
      ({ id, eventDate }) => {
        const nowIso = new Date().toISOString();
        const bookings = [
          {
            id,
            eventType: 'private-dinner',
            eventDate,
            eventTime: '18:00',
            customerName: 'Smoke Event',
            customerEmail: 'smoke@example.com',
            customerPhone: '(555)-555-5555',
            adults: 10,
            children: 0,
            location: '123 Test Ave',
            distanceMiles: 10,
            premiumAddOn: 0,
            subtotal: 1000,
            gratuity: 200,
            distanceFee: 25,
            total: 1225,
            status: 'pending',
            serviceStatus: 'pending',
            source: 'manual',
            amountPaid: 0,
            notes: '',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ];
        localStorage.setItem('bookings', JSON.stringify(bookings));
      },
      { id: eventId, eventDate: isoDate(7) }
    );

    await page.goto(`/bookings/${eventId}?tab=review`);
    await expect(page.getByText(/needs confirmation/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /confirm now/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();
  });
});
