import type { EngineSave } from './engine';
import type { LevelId } from './types';

const SESSION_PREFIX = 'starfall-grove-session-v2-';
export function loadSession(levelId: LevelId): EngineSave | null {
  try {
    const raw = localStorage.getItem(SESSION_PREFIX + levelId); if (!raw) return null;
    const value = JSON.parse(raw) as EngineSave;
    return value?.version === 2 && value.hero && value.quest ? value : null;
  } catch { return null; }
}
export function saveSession(levelId: LevelId, value: EngineSave) { try { localStorage.setItem(SESSION_PREFIX + levelId, JSON.stringify(value)); } catch { /* game continues if storage is full */ } }
export function clearSession(levelId: LevelId) { try { localStorage.removeItem(SESSION_PREFIX + levelId); } catch { /* ignore storage errors */ } }
