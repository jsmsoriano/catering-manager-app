import type { Booking, PipelineStatus } from './bookingTypes';
import { addCrmActivity, addCrmTask, loadCrmTasks } from './crmStorage';
import { getBookingCustomerId } from './customerIdentity';

function datePlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function hasTaskMarker(bookingId: string, marker: string): boolean {
  const tasks = loadCrmTasks();
  return tasks.some((t) => t.bookingId === bookingId && (t.notes ?? '').includes(marker));
}

function createAutomatedTask(params: {
  booking: Booking;
  title: string;
  dueInDays: number;
  marker: string;
}) {
  const { booking, title, dueInDays, marker } = params;
  if (hasTaskMarker(booking.id, marker)) return;
  const customerId = getBookingCustomerId(booking);
  const created = addCrmTask({
    bookingId: booking.id,
    customerId,
    title,
    dueDate: datePlus(dueInDays),
    notes: marker,
  });
  addCrmActivity({
    bookingId: booking.id,
    customerId,
    type: 'task_created',
    text: `Auto follow-up task: ${created.title}`,
  });
}

export function runPipelineStageAutomation(params: {
  booking: Booking;
  prevStage?: PipelineStatus | null;
  nextStage: PipelineStatus;
}) {
  const { booking, prevStage, nextStage } = params;
  if (prevStage === nextStage) return;

  if (nextStage === 'qualified') {
    createAutomatedTask({
      booking,
      title: 'Qualify lead with same-day call',
      dueInDays: 0,
      marker: '[auto:qualified-call]',
    });
  }

  if (nextStage === 'quote_sent') {
    createAutomatedTask({
      booking,
      title: 'Follow up: quote receipt check-in',
      dueInDays: 1,
      marker: '[auto:quote-d1]',
    });
    createAutomatedTask({
      booking,
      title: 'Follow up: objection handling / revisions',
      dueInDays: 3,
      marker: '[auto:quote-d3]',
    });
    createAutomatedTask({
      booking,
      title: 'Final follow up before close-lost review',
      dueInDays: 7,
      marker: '[auto:quote-d7]',
    });
  }

  if (nextStage === 'deposit_pending') {
    createAutomatedTask({
      booking,
      title: 'Collect deposit and confirm event date',
      dueInDays: 1,
      marker: '[auto:deposit-due]',
    });
  }

  if (nextStage === 'booked') {
    createAutomatedTask({
      booking,
      title: 'Convert confirmed sale to event workflow handoff',
      dueInDays: 0,
      marker: '[auto:convert-handoff]',
    });
  }
}
