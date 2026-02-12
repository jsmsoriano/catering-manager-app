export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  if (!canUseBrowserStorage()) return fallback;
  const parsed = safeJsonParse<T>(localStorage.getItem(key));
  return parsed ?? fallback;
}

export function saveToStorage<T>(key: string, value: T) {
  if (!canUseBrowserStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeFromStorage(key: string) {
  if (!canUseBrowserStorage()) return;
  localStorage.removeItem(key);
}