import type { EngineSave } from './engine';

// The whole valley is one world, so there is a single save for the adventure in progress.
const SESSION_KEY = 'starfall-grove-valley-v1';
const OLD_PREFIX = 'starfall-grove-session-v3-';
export function loadSession(): EngineSave | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY); if (!raw) return null;
    const value = JSON.parse(raw) as EngineSave;
    return value?.version === 4 && value.hero && value.main ? value : null;
  } catch { return null; }
}
export function saveSession(value: EngineSave) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch { /* game continues if storage is full */ } }
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    for (const id of ['meadow', 'woods', 'summit']) localStorage.removeItem(OLD_PREFIX + id);
  } catch { /* ignore storage errors */ }
}
