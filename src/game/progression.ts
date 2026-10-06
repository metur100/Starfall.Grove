import { ITEM_ORDER } from './items';
import { SLOT_ORDER, sumGear, validGear } from './gear';
import { HEROES, MAX_STARS, RENAMED_SPELLS } from './spells';
import { MOUNT_ORDER, OLD_MOUNT_ACH } from './mounts';
import { TRAIL_ORDER } from './trails';
import type { GearItem, GearSlot, HeroId, ItemId, MountId, SpellId, TrailId, UpgradeId } from './types';

// Hero progression that carries across the whole valley: level, experience, gold, permanent rewards, upgrades and the bag.
// Every hero has a profile of their own.
export type Profile = {
  version: 1; hero: HeroId; level: number; xp: number; gold: number; bonusHearts: number; bonusMana: number; regen: number;
  claimed: string[]; items: Partial<Record<ItemId, number>>; upgrades: Partial<Record<UpgradeId, number>>;
  /** Equipment carried in the bag, and what is worn. */
  gear: GearItem[]; equipped: Partial<Record<GearSlot, GearItem>>;
  /** Upgrade stars bought for each ability. */
  stars: Partial<Record<SpellId, number>>;
  /** The consumable on the second quick button. */
  quick: ItemId;
  /** Armourer pieces already bought, so they can't be bought twice. */
  bought: string[];
  /** Achievements: when each was earned, and the running counters they are measured by. */
  ach: { got: Record<string, number>; n: Record<string, number> };
  /** The mounts this hero owns (bought from a stable master or won in battle), and the one chosen to ride (null rides
   *  the fastest one owned). */
  mounts: MountId[]; mount: MountId | null;
  /** The cosmetic trail chosen in the stable (null: none). */
  trail: TrailId | null;
  /** Star fragments gathered from fallen stars toward the next Starheart, and the Starhearts made (each +1 heart). */
  fragments: number; starhearts: number;
};
/** Star fragments that fuse into a Starheart, and how many Starhearts a hero can make. */
export const FRAGMENTS_PER_HEART = 8, MAX_STARHEARTS = 6;
/** Bag slots: every kind of consumable held takes one, every piece of equipment takes one. */
export const BAG_SIZE = 36;
export const bagUsed = (p: Profile) => p.gear.length + ITEM_ORDER.filter(id => (p.items[id] || 0) > 0).length;

export const MAX_LEVEL = 30;
/** Health is shown as a bar; one "heart" of the old design is worth this many points. */
export const HP_UNIT = 20;
/** Mira keeps the original key so older saves carry over. */
const keyOf = (hero: HeroId) => hero === 'mira' ? 'starfall-grove-hero-v1' : `starfall-grove-hero-${hero}-v1`;
const blank = (hero: HeroId): Profile => ({ version: 1, hero, level: 1, xp: 0, gold: 40, bonusHearts: 0, bonusMana: 0, regen: 0, claimed: [], items: { healthPotion: 3, manaPotion: 1, fireBomb: 2 }, upgrades: {}, gear: [], equipped: {}, stars: {}, quick: 'manaPotion', bought: [], ach: { got: {}, n: {} }, mounts: [], mount: null, trail: null, fragments: 0, starhearts: 0 });
export const practiceProfile = (hero: HeroId): Profile => ({ ...blank(hero), gold: 0, items: {} });

/** Smith upgrades: each has five ranks, bought in cities with gold. */
export type UpgradeInfo = { name: string; icon: string; description: string; per: string };
export const UPGRADES: Record<UpgradeId, UpgradeInfo> = {
  staff: { name: 'Starsteel Weapon', icon: '✦', description: 'Your attacks and spells deal more damage.', per: '+8% power' },
  mantle: { name: 'Warden’s Mantle', icon: '⛨', description: 'Creatures hurt you less.', per: '−6% damage taken' },
  amulet: { name: 'Heartstone Amulet', icon: '♥', description: 'More maximum health.', per: '+30 max health' },
};
export const UPGRADE_ORDER: UpgradeId[] = ['staff', 'mantle', 'amulet'];
export const MAX_RANK = 5;
export const upgradeCost = (rank: number) => Math.round(90 * Math.pow(rank + 1, 1.7) / 5) * 5;
export const rankOf = (p: Profile, id: UpgradeId) => p.upgrades[id] || 0;

/** Experience needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => level >= MAX_LEVEL ? 0 : Math.round(60 * Math.pow(level, 1.5) / 5) * 5;
const heartsAt = (p: Profile) => Math.min(30, HEROES[p.hero].hearts + Number(p.level >= 4) + Number(p.level >= 8) + Number(p.level >= 12) + Number(p.level >= 16) + Number(p.level >= 20) + Number(p.level >= 25) + Number(p.level >= 30) + p.bonusHearts + p.starhearts);
export const gearOf = (p: Profile) => sumGear(p.equipped);
export const healthAt = (p: Profile) => heartsAt(p) * HP_UNIT + (p.level - 1) * HEROES[p.hero].hpPerLevel + rankOf(p, 'amulet') * 30 + gearOf(p).health;
export const manaAt = (p: Profile) => 100 + (p.level - 1) * 6 + p.bonusMana + gearOf(p).mana;
/** Regeneration in a fight: the hero's own, a little more each level, and part of what quests and gear add. Out of a
 *  fight it is 2.5 times as fast (engine), so magic and energy matter in fights but walking never waits on them. */
export const regenAt = (p: Profile) => HEROES[p.hero].regen + (p.level - 1) * .05 + p.regen * .4 + gearOf(p).regen * .4;
/** Damage multiplier from level, the weapon upgrade and worn gear. */
export const powerAt = (p: Profile) => (1 + (p.level - 1) * .12) * (1 + rankOf(p, 'staff') * .08) * (1 + gearOf(p).power / 100);
/** Share of damage that gets through: the hero's own toughness times the mantle and worn armour. */
export const armorAt = (p: Profile) => HEROES[p.hero].armor * (1 - rankOf(p, 'mantle') * .06) * (1 - gearOf(p).armor / 100);
export const starsOf = (p: Profile, id: SpellId) => p.stars[id] || 0;

export function loadProfile(hero: HeroId = 'mira'): Profile {
  try {
    const raw = JSON.parse(localStorage.getItem(keyOf(hero)) || 'null') as Partial<Profile> | null;
    if (raw?.version !== 1) return blank(hero);
    const p = { ...blank(hero), ...raw, hero };
    p.level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(p.level) || 1)));
    p.xp = Math.max(0, Number(p.xp) || 0);
    p.gold = Math.max(0, Math.floor(Number(p.gold) || 0));
    p.claimed = Array.isArray(p.claimed) ? p.claimed.filter(x => typeof x === 'string') : [];
    const items: Profile['items'] = {};
    for (const id of ITEM_ORDER) { const n = Math.floor(Number(raw.items?.[id]) || 0); if (n > 0) items[id] = Math.min(99, n); }
    p.items = raw.items ? items : blank(hero).items;
    const upgrades: Profile['upgrades'] = {};
    for (const id of UPGRADE_ORDER) { const n = Math.floor(Number(raw.upgrades?.[id]) || 0); if (n > 0) upgrades[id] = Math.min(MAX_RANK, n); }
    p.upgrades = upgrades;
    p.gear = Array.isArray(raw.gear) ? raw.gear.filter(validGear).slice(0, BAG_SIZE) : [];
    const equipped: Profile['equipped'] = {};
    for (const slot of SLOT_ORDER) { const g = raw.equipped?.[slot]; if (validGear(g) && g.slot === slot) equipped[slot] = g; }
    p.equipped = equipped;
    const stars: Profile['stars'] = {}, old: Record<string, unknown> = { ...raw.stars };
    for (const [from, to] of Object.entries(RENAMED_SPELLS)) if (old[from] !== undefined && old[to] === undefined) old[to] = old[from];
    for (const id of HEROES[hero].spells) { const n = Math.floor(Number(old[id]) || 0); if (n > 0) stars[id] = Math.min(MAX_STARS, n); }
    p.stars = stars;
    p.bought = Array.isArray(raw.bought) ? raw.bought.filter(x => typeof x === 'string').slice(-60) : [];
    const num = (o: unknown) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => [k, Number(v)]));
    p.ach = { got: num(raw.ach?.got), n: num(raw.ach?.n) };
    // Mounts used to come free with achievements; a save from then keeps the ones it had already earned.
    p.mounts = Array.isArray(raw.mounts) ? MOUNT_ORDER.filter(id => raw.mounts!.includes(id)) : MOUNT_ORDER.filter(id => p.ach.got[OLD_MOUNT_ACH[id]]);
    p.mount = p.mounts.includes(raw.mount as MountId) ? raw.mount as MountId : null;
    p.trail = TRAIL_ORDER.includes(raw.trail as TrailId) ? raw.trail as TrailId : null;
    p.fragments = Math.max(0, Math.min(FRAGMENTS_PER_HEART - 1, Math.floor(Number(raw.fragments) || 0)));
    p.starhearts = Math.max(0, Math.min(MAX_STARHEARTS, Math.floor(Number(raw.starhearts) || 0)));
    p.quick = ITEM_ORDER.includes(raw.quick as ItemId) && raw.quick !== 'healthPotion' ? raw.quick as ItemId : 'manaPotion';
    return p;
  } catch { return blank(hero); }
}
export function saveProfile(p: Profile) { try { localStorage.setItem(keyOf(p.hero), JSON.stringify(p)); } catch { /* ignore */ } }
export function resetProfile(hero: HeroId) { saveProfile(blank(hero)); }
