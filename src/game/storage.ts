import type { EngineSave } from './engine';
import type { HeroId } from './types';

// The whole valley is one world, so each hero has a single save for the adventure in progress.
const keyOf = (hero: HeroId) => hero === 'mira' ? 'starfall-grove-valley-v1' : `starfall-grove-valley-${hero}-v1`;
const OLD_PREFIX = 'starfall-grove-session-v3-';
export function loadSession(hero: HeroId): EngineSave | null {
  try {
    const raw = localStorage.getItem(keyOf(hero)); if (!raw) return null;
    const value = JSON.parse(raw) as EngineSave;
    return value?.version === 4 && value.hero && value.main ? value : null;
  } catch { return null; }
}
export function saveSession(hero: HeroId, value: EngineSave) { try { localStorage.setItem(keyOf(hero), JSON.stringify(value)); } catch { /* game continues if storage is full */ } }
export function clearSession(hero: HeroId) {
  try {
    localStorage.removeItem(keyOf(hero));
    if (hero === 'mira') for (const id of ['meadow', 'woods', 'summit']) localStorage.removeItem(OLD_PREFIX + id);
  } catch { /* ignore storage errors */ }
}
