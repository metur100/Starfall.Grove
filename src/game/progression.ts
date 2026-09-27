import { ITEM_ORDER } from './items';
import type { ItemId, UpgradeId } from './types';

// Hero progression that carries across the whole valley: level, experience, gold, permanent rewards, upgrades and the bag.
export type Profile = {
  version: 1; level: number; xp: number; gold: number; bonusHearts: number; bonusMana: number; regen: number;
  claimed: string[]; items: Partial<Record<ItemId, number>>; upgrades: Partial<Record<UpgradeId, number>>;
};

export const MAX_LEVEL = 20;
/** Health is shown as a bar; one "heart" of the old design is worth this many points. */
export const HP_UNIT = 20;
const KEY = 'starfall-grove-hero-v1';
const blank = (): Profile => ({ version: 1, level: 1, xp: 0, gold: 40, bonusHearts: 0, bonusMana: 0, regen: 0, claimed: [], items: { healthPotion: 3, manaPotion: 1 }, upgrades: {} });

/** Smith upgrades: each has five ranks, bought in cities with gold. */
export type UpgradeInfo = { name: string; icon: string; description: string; per: string };
export const UPGRADES: Record<UpgradeId, UpgradeInfo> = {
  staff: { name: 'Starsteel Staff', icon: '✦', description: 'Spells deal more damage.', per: '+8% spell power' },
  mantle: { name: 'Warden’s Mantle', icon: '⛨', description: 'Creatures hurt you less.', per: '−6% damage taken' },
  amulet: { name: 'Heartstone Amulet', icon: '♥', description: 'More maximum health.', per: '+30 max health' },
};
export const UPGRADE_ORDER: UpgradeId[] = ['staff', 'mantle', 'amulet'];
export const MAX_RANK = 5;
export const upgradeCost = (rank: number) => Math.round(90 * Math.pow(rank + 1, 1.7) / 5) * 5;
export const rankOf = (p: Profile, id: UpgradeId) => p.upgrades[id] || 0;

/** Experience needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => level >= MAX_LEVEL ? 0 : Math.round(55 * Math.pow(level, 1.42) / 5) * 5;
const heartsAt = (p: Profile) => Math.min(20, 5 + Number(p.level >= 4) + Number(p.level >= 8) + Number(p.level >= 12) + Number(p.level >= 16) + p.bonusHearts);
export const healthAt = (p: Profile) => heartsAt(p) * HP_UNIT + (p.level - 1) * 8 + rankOf(p, 'amulet') * 30;
export const manaAt = (p: Profile) => 100 + (p.level - 1) * 6 + p.bonusMana;
export const regenAt = (p: Profile) => 3.2 + (p.level - 1) * .14 + p.regen;
/** Spell damage multiplier from level and the staff upgrade. */
export const powerAt = (p: Profile) => (1 + (p.level - 1) * .12) * (1 + rankOf(p, 'staff') * .08);
/** Share of damage that gets through the mantle. */
export const armorAt = (p: Profile) => 1 - rankOf(p, 'mantle') * .06;

export function loadProfile(): Profile {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Profile> | null;
    if (raw?.version !== 1) return blank();
    const p = { ...blank(), ...raw };
    p.level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(p.level) || 1)));
    p.xp = Math.max(0, Number(p.xp) || 0);
    p.gold = Math.max(0, Math.floor(Number(p.gold) || 0));
    p.claimed = Array.isArray(p.claimed) ? p.claimed.filter(x => typeof x === 'string') : [];
    const items: Profile['items'] = {};
    for (const id of ITEM_ORDER) { const n = Math.floor(Number(raw.items?.[id]) || 0); if (n > 0) items[id] = Math.min(99, n); }
    p.items = raw.items ? items : blank().items;
    const upgrades: Profile['upgrades'] = {};
    for (const id of UPGRADE_ORDER) { const n = Math.floor(Number(raw.upgrades?.[id]) || 0); if (n > 0) upgrades[id] = Math.min(MAX_RANK, n); }
    p.upgrades = upgrades;
    return p;
  } catch { return blank(); }
}
export function saveProfile(p: Profile) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } }
export function resetProfile() { saveProfile(blank()); }
