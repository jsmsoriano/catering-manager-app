import type { CrmActivity, CrmTask } from './crmTypes';
import { StorageEvent } from './storageEvents';

export const CRM_ACTIVITIES_KEY = 'crmActivities';
export const CRM_TASKS_KEY = 'crmTasks';
export const CRM_UPDATED_EVENT = StorageEvent.Crm;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emitUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CRM_UPDATED_EVENT));
}

export function loadCrmActivities(): CrmActivity[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CRM_ACTIVITIES_KEY);
    const parsed = raw ? (JSON.parse(raw) as CrmActivity[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCrmActivities(items: CrmActivity[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CRM_ACTIVITIES_KEY, JSON.stringify(items));
  emitUpdated();
}

export function addCrmActivity(input: Omit<CrmActivity, 'id' | 'createdAt'>): CrmActivity {
  const next: CrmActivity = {
    id: makeId('activity'),
    createdAt: new Date().toISOString(),
    ...input,
  };
  const all = loadCrmActivities();
  saveCrmActivities([next, ...all].slice(0, 1500));
  return next;
}

export function loadCrmTasks(): CrmTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CRM_TASKS_KEY);
    const parsed = raw ? (JSON.parse(raw) as CrmTask[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCrmTasks(items: CrmTask[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CRM_TASKS_KEY, JSON.stringify(items));
  emitUpdated();
}

export function addCrmTask(input: Omit<CrmTask, 'id' | 'createdAt' | 'status'>): CrmTask {
  const next: CrmTask = {
    id: makeId('task'),
    createdAt: new Date().toISOString(),
    status: 'open',
    ...input,
  };
  const all = loadCrmTasks();
  saveCrmTasks([next, ...all].slice(0, 1500));
  return next;
}

export function setCrmTaskStatus(taskId: string, status: CrmTask['status']) {
  const all = loadCrmTasks();
  const now = new Date().toISOString();
  const next = all.map((t) =>
    t.id === taskId
      ? {
          ...t,
          status,
          completedAt: status === 'completed' ? now : undefined,
        }
      : t
  );
  saveCrmTasks(next);
}
