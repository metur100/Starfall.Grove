import { ITEM_ORDER } from './items';
import type { ItemId } from './types';

// Hero progression that carries across chapters: level, experience, permanent quest rewards and the bag.
export type Profile = { version: 1; level: number; xp: number; bonusHearts: number; bonusMana: number; regen: number; claimed: string[]; items: Partial<Record<ItemId, number>> };

export const MAX_LEVEL = 15;
/** Health is shown as a bar; one "heart" of the old design is worth this many points. */
export const HP_UNIT = 20;
const KEY = 'starfall-grove-hero-v1';
const blank = (): Profile => ({ version: 1, level: 1, xp: 0, bonusHearts: 0, bonusMana: 0, regen: 0, claimed: [], items: { healthPotion: 2, manaPotion: 1 } });

/** Experience needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => level >= MAX_LEVEL ? 0 : Math.round(55 * Math.pow(level, 1.42) / 5) * 5;
const heartsAt = (p: Profile) => Math.min(12, 5 + Number(p.level >= 4) + Number(p.level >= 8) + Number(p.level >= 12) + p.bonusHearts);
export const healthAt = (p: Profile) => heartsAt(p) * HP_UNIT + (p.level - 1) * 4;
export const manaAt = (p: Profile) => 100 + (p.level - 1) * 6 + p.bonusMana;
export const regenAt = (p: Profile) => 3.2 + (p.level - 1) * .12 + p.regen;
/** Spell damage multiplier. */
export const powerAt = (level: number) => 1 + (level - 1) * .12;

export function loadProfile(): Profile {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Profile> | null;
    if (raw?.version !== 1) return blank();
    const p = { ...blank(), ...raw };
    p.level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(p.level) || 1)));
    p.xp = Math.max(0, Number(p.xp) || 0);
    p.claimed = Array.isArray(p.claimed) ? p.claimed.filter(x => typeof x === 'string') : [];
    const items: Profile['items'] = {};
    for (const id of ITEM_ORDER) { const n = Math.floor(Number(raw.items?.[id]) || 0); if (n > 0) items[id] = Math.min(99, n); }
    p.items = raw.items ? items : blank().items;
    return p;
  } catch { return blank(); }
}
export function saveProfile(p: Profile) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } }
export function resetProfile() { saveProfile(blank()); }
