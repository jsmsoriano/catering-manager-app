'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CrmActivity, CrmTask } from '@/lib/crmTypes';
import { addCrmActivity, addCrmTask, CRM_UPDATED_EVENT, loadCrmActivities, loadCrmTasks, setCrmTaskStatus } from '@/lib/crmStorage';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type Props = {
  customerId?: string;
  bookingId?: string;
  title?: string;
  scope?: 'event' | 'customer' | 'combined';
};

export default function CRMPanel({
  customerId,
  bookingId,
  title = 'CRM Activity & Tasks',
  scope = 'combined',
}: Props) {
  const [activityText, setActivityText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(CRM_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CRM_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const activities = useMemo(() => {
    const all = loadCrmActivities();
    const matches = (a: { bookingId?: string; customerId?: string }) => {
      if (scope === 'event') return !!bookingId && a.bookingId === bookingId;
      if (scope === 'customer') return !!customerId && a.customerId === customerId;
      return (!!bookingId && a.bookingId === bookingId) || (!!customerId && a.customerId === customerId);
    };
    return all
      .filter(matches)
      .slice(0, 12);
  }, [bookingId, customerId, scope, tick]);

  const tasks = useMemo(() => {
    const all = loadCrmTasks();
    const matches = (t: { bookingId?: string; customerId?: string }) => {
      if (scope === 'event') return !!bookingId && t.bookingId === bookingId;
      if (scope === 'customer') return !!customerId && t.customerId === customerId;
      return (!!bookingId && t.bookingId === bookingId) || (!!customerId && t.customerId === customerId);
    };
    return all
      .filter(matches)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        return (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99');
      })
      .slice(0, 20);
  }, [bookingId, customerId, scope, tick]);

  const addActivity = (type: CrmActivity['type'], text: string) => {
    if (!text.trim()) return;
    addCrmActivity({
      customerId,
      bookingId,
      type,
      text: text.trim(),
    });
  };

  const onAddNote = () => {
    addActivity('note', activityText);
    setActivityText('');
  };

  const onAddTask = () => {
    if (!taskTitle.trim()) return;
    const created = addCrmTask({
      customerId,
      bookingId,
      title: taskTitle.trim(),
      dueDate: taskDueDate || undefined,
    });
    addCrmActivity({
      customerId,
      bookingId,
      type: 'task_created',
      text: `Task created: ${created.title}`,
    });
    setTaskTitle('');
    setTaskDueDate('');
  };

  const onCompleteTask = (task: CrmTask) => {
    setCrmTaskStatus(task.id, 'completed');
    addCrmActivity({
      customerId: task.customerId,
      bookingId: task.bookingId,
      type: 'task_completed',
      text: `Task completed: ${task.title}`,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium text-text-secondary">{title}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Activity</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addActivity('call', 'Outbound call')}
              className="rounded-md border border-border bg-card-elevated px-2 py-1 text-xs text-text-primary hover:bg-card"
            >
              Log Call
            </button>
            <button
              type="button"
              onClick={() => addActivity('email', 'Follow-up email sent')}
              className="rounded-md border border-border bg-card-elevated px-2 py-1 text-xs text-text-primary hover:bg-card"
            >
              Log Email
            </button>
          </div>
          <textarea
            value={activityText}
            onChange={(e) => setActivityText(e.target.value)}
            rows={2}
            placeholder="Add CRM note..."
            className="w-full resize-none rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
          />
          <button
            type="button"
            onClick={onAddNote}
            disabled={!activityText.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Save Note
          </button>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {activities.length === 0 ? (
              <p className="text-xs text-text-muted">No activity yet.</p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="rounded-md border border-border bg-card-elevated p-2">
                  <p className="text-xs text-text-primary">{a.text}</p>
                  <p className="mt-0.5 text-[11px] capitalize text-text-muted">
                    {a.type.replace('_', ' ')} · {formatDateTime(a.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tasks</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
            />
            <input
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              className="rounded-md border border-border bg-card-elevated px-2 py-2 text-sm text-text-primary"
            />
            <button
              type="button"
              onClick={onAddTask}
              disabled={!taskTitle.trim()}
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-xs font-medium text-text-primary hover:bg-card disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {tasks.length === 0 ? (
              <p className="text-xs text-text-muted">No tasks yet.</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-2 rounded-md border border-border bg-card-elevated p-2">
                  <div>
                    <p className={`text-xs ${task.status === 'completed' ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {task.dueDate ? `Due ${task.dueDate}` : 'No due date'} · {task.status}
                    </p>
                  </div>
                  {task.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => onCompleteTask(task)}
                      className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-text-primary hover:bg-card-elevated"
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
