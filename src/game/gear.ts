import type { GearItem, GearSlot, GearStat, GearStats, HeroId, Rarity } from './types';

// Equipment: eight armour slots and a weapon, five rarities. Pieces are rolled from a stat budget that grows with item level (the level of the
// creature or land it came from) and rarity. Every piece carries its final numbers, so saves never change under the player.

export const SLOT_ORDER: GearSlot[] = ['head', 'shoulders', 'back', 'chest', 'hands', 'waist', 'legs', 'feet', 'weapon'];
/** WoW-style paper doll: armour pieces down the left side, the rest down the right. */
export const SLOT_LEFT: GearSlot[] = ['head', 'shoulders', 'back', 'chest'];
export const SLOT_RIGHT: GearSlot[] = ['hands', 'waist', 'legs', 'feet', 'weapon'];
export const SLOT_NAMES: Record<GearSlot, string> = { head: 'Head', shoulders: 'Shoulders', back: 'Back', chest: 'Chest', hands: 'Hands', waist: 'Waist', legs: 'Legs', feet: 'Feet', weapon: 'Weapon' };
/** What each hero's weapon is called in the slot. */
export const WEAPON_KIND: Record<HeroId, string> = { mira: 'Staff', kael: 'Sword', lyra: 'Frost staff', riven: 'Daggers', wren: 'Bow' };

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY: Record<Rarity, { name: string; color: string; mul: number; stats: number }> = {
  common: { name: 'Common', color: '#d8d8d8', mul: 1, stats: 1 },
  uncommon: { name: 'Uncommon', color: '#5fdc6a', mul: 1.3, stats: 2 },
  rare: { name: 'Rare', color: '#4fa3ff', mul: 1.65, stats: 2 },
  epic: { name: 'Epic', color: '#b86bff', mul: 2.1, stats: 3 },
  legendary: { name: 'Legendary', color: '#ff9a2e', mul: 2.6, stats: 3 },
};

export const STAT_NAMES: Record<GearStat, string> = { armor: 'Armor', power: 'Power', health: 'Health', mana: 'Magic', regen: 'Regeneration', speed: 'Speed', crit: 'Critical chance' };
export function statText(stat: GearStat, v: number) {
  if (stat === 'regen') return `+${v.toFixed(1)} ${STAT_NAMES[stat]} /s`;
  if (stat === 'health' || stat === 'mana') return `+${v} ${STAT_NAMES[stat]}`;
  return `+${v}% ${STAT_NAMES[stat]}`;
}
/** Caps on what worn gear can add in total, so stacking one stat never breaks the game. */
export const GEAR_CAPS: Partial<Record<GearStat, number>> = { armor: 40, speed: 25, crit: 30 };

/** Each slot leans on a main stat and can roll others. */
const SLOT_STATS: Record<GearSlot, { main: GearStat[]; extra: GearStat[] }> = {
  head: { main: ['armor', 'health'], extra: ['mana', 'crit', 'regen'] },
  shoulders: { main: ['armor', 'power'], extra: ['health', 'crit'] },
  back: { main: ['armor', 'regen'], extra: ['speed', 'mana', 'health'] },
  chest: { main: ['armor', 'health'], extra: ['power', 'regen', 'mana'] },
  hands: { main: ['power', 'crit'], extra: ['armor', 'mana'] },
  waist: { main: ['health', 'mana'], extra: ['armor', 'regen', 'power'] },
  legs: { main: ['armor', 'health'], extra: ['power', 'speed', 'regen'] },
  feet: { main: ['speed', 'armor'], extra: ['health', 'regen'] },
  weapon: { main: ['power', 'crit'], extra: ['mana', 'regen', 'speed'] },
};
/** How much of a stat one budget point buys. */
const PER_POINT: Record<GearStat, number> = { armor: .1, power: .12, health: 1.3, mana: .8, regen: .03, speed: .09, crit: .09 };

/** Base names by slot for the four lands (levels 1–6, 7–12, 13–18, 19–26). */
const BASES: Record<GearSlot, [string[], string[], string[], string[]]> = {
  head: [['Wool Hood', 'Leather Cap', 'Farmhand’s Hat'], ['Mossweave Cowl', 'Rootbound Helm', 'Lantern Hood'], ['Starsilver Crown', 'Frostforged Helm', 'Skyhold Circlet'], ['Obsidian Helm', 'Cinderveil Hood', 'Ashen Crown']],
  shoulders: [['Padded Shoulders', 'Hide Mantle'], ['Barkplate Pauldrons', 'Webspun Mantle'], ['Comet Spaulders', 'Glacier Pauldrons'], ['Magmaplate Pauldrons', 'Emberwing Mantle']],
  back: [['Travel Cloak', 'Patchwork Cape'], ['Mossy Shroud', 'Owl-feather Cloak'], ['Starsilver Cloak', 'Aurora Drape'], ['Phoenix Cloak', 'Smoulder Drape']],
  chest: [['Quilted Vest', 'Leather Jerkin'], ['Rootweave Robe', 'Bramble Cuirass'], ['Nightsky Robe', 'Crystal Breastplate'], ['Forgeheart Cuirass', 'Cinderweave Robe']],
  hands: [['Work Gloves', 'Leather Mitts'], ['Thornguard Gloves', 'Spider-silk Wraps'], ['Stargrip Gauntlets', 'Frostbite Gloves'], ['Brimstone Gauntlets', 'Ashgrip Wraps']],
  waist: [['Rope Belt', 'Buckled Girdle'], ['Vine Sash', 'Lantern Belt'], ['Meteor Girdle', 'Moonstone Sash'], ['Lavalink Girdle', 'Smoke-silk Sash']],
  legs: [['Wool Trousers', 'Hide Leggings'], ['Rootwalker Greaves', 'Moss Leggings'], ['Starwoven Leggings', 'Avalanche Greaves'], ['Basalt Greaves', 'Emberstride Leggings']],
  feet: [['Worn Boots', 'Soft Shoes'], ['Mossy Treads', 'Shadow Striders'], ['Skywalker Boots', 'Comet Sabatons'], ['Firewalker Boots', 'Obsidian Sabatons']],
  weapon: [['Oak Cudgel', 'Iron Blade'], ['Rootwood Arm', 'Bronze Edge'], ['Starsilver Arm', 'Crystal Edge'], ['Obsidian Arm', 'Cinder Edge']],
};
/** Weapons by hero and land: the name, and in the game the look, follow the tier (wood and iron → root and bronze →
 *  starsilver and crystal → obsidian and ember). */
const WEAPONS: Record<HeroId, [string[], string[], string[], string[]]> = {
  mira: [['Oak Staff', 'Apprentice’s Wand'], ['Rootwood Staff', 'Mossheart Wand'], ['Starsilver Staff', 'Crescent Rod'], ['Obsidian Staff', 'Sunflare Rod']],
  kael: [['Iron Sword', 'Militia Blade'], ['Bronze Leafblade', 'Warden’s Sword'], ['Crystal Longsword', 'Skyhold Blade'], ['Obsidian Greatsword', 'Cinderedge']],
  lyra: [['Birch Staff', 'Rime Wand'], ['Frostroot Staff', 'Icicle Wand'], ['Glacier Staff', 'Aurora Rod'], ['Blackice Staff', 'Frostfire Rod']],
  riven: [['Iron Daggers', 'Cutpurse Knives'], ['Bronze Fangs', 'Thornbite Daggers'], ['Crystal Shivs', 'Moonfang Daggers'], ['Obsidian Fangs', 'Emberkiss Daggers']],
  wren: [['Hunting Bow', 'Ashwood Bow'], ['Rootwood Longbow', 'Mossstring Bow'], ['Starsilver Bow', 'Windsong Longbow'], ['Obsidian Warbow', 'Cinderstring Bow']],
};
const LEGEND_WEAPONS: Record<HeroId, string> = { mira: 'Orrin’s Starstaff', kael: 'Dawnbreaker', lyra: 'Heart of Winter', riven: 'Eclipse Fangs', wren: 'Moonhowl, Bow of the Pack' };
const SUFFIX: Record<GearStat, string> = { armor: 'of Warding', power: 'of Fury', health: 'of Vigor', mana: 'of Starlight', regen: 'of the Tide', speed: 'of the Wind', crit: 'of Precision' };
const EPIC_PREFIX = ['Sunforged', 'Moonlit', 'Eclipse-touched', 'Wardens’', 'Starborn', 'Everbloom'];
const LEGEND_NAMES: Record<Exclude<GearSlot, 'weapon'>, string> = { head: 'Crown of the Fallen Star', shoulders: 'Mantle of the Beacon', back: 'Cloak of the Last Light', chest: 'Heart of the Valley', hands: 'Orrin’s Lost Gloves', waist: 'Girdle of Three Lights', legs: 'Greaves of the Long Road', feet: 'Boots of Endless Dawn' };

/** A tiny seeded random generator, so a quest's reward can be shown before it is earned. */
export function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const pickOf = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length) % list.length];

export function rollRarity(r: () => number, luck = 0): Rarity {
  const x = r() * (1 - luck * .5);
  return x < .01 ? 'legendary' : x < .06 ? 'epic' : x < .22 ? 'rare' : x < .52 ? 'uncommon' : 'common';
}

export function makeGear(opts: { ilvl: number; rarity: Rarity; slot?: GearSlot; rand?: () => number; uid?: string; hero?: HeroId }): GearItem {
  const r = opts.rand || Math.random, ilvl = Math.max(1, Math.min(26, Math.round(opts.ilvl))), rarity = opts.rarity;
  // A weapon needs to know whose it is; without a hero, an armour piece is rolled instead.
  const slots = opts.hero ? SLOT_ORDER : SLOT_ORDER.filter(s => s !== 'weapon');
  const slot = opts.slot === 'weapon' && !opts.hero ? 'hands' : opts.slot || pickOf(r, slots), spec = SLOT_STATS[slot], info = RARITY[rarity];
  const tier = gearTier(ilvl);
  const budget = (4 + ilvl * 1.6) * info.mul * (slot === 'weapon' ? 1.3 : 1);
  // The first main stat takes most of the budget; the rest is shared between the others.
  const picks: GearStat[] = [spec.main[0]];
  if (info.stats >= 2) picks.push(r() < .6 ? spec.main[1] : pickOf(r, spec.extra));
  if (info.stats >= 3) { const left = [...spec.main, ...spec.extra].filter(s => !picks.includes(s)); picks.push(pickOf(r, left)); }
  const shares = picks.length === 1 ? [1] : picks.length === 2 ? [.62, .38] : [.5, .3, .2];
  const stats: GearStats = {};
  picks.forEach((s, i) => {
    const raw = budget * shares[i] * PER_POINT[s] * (.9 + r() * .2);
    stats[s] = s === 'regen' ? Math.max(.1, Math.round(raw * 10) / 10) : Math.max(1, Math.round(raw));
  });
  const weapon = slot === 'weapon' && opts.hero ? opts.hero : null;
  const base = pickOf(r, weapon ? WEAPONS[weapon][tier] : BASES[slot][tier]);
  const name = rarity === 'legendary' ? (weapon ? LEGEND_WEAPONS[weapon] : LEGEND_NAMES[slot as Exclude<GearSlot, 'weapon'>])
    : rarity === 'epic' ? `${pickOf(r, EPIC_PREFIX)} ${base}`
      : rarity === 'common' ? base : `${base} ${SUFFIX[picks[picks.length > 1 ? 1 : 0]]}`;
  return { uid: opts.uid || `g${Date.now().toString(36)}${Math.floor(r() * 1e9).toString(36)}`, slot, rarity, ilvl, name, stats, ...(weapon ? { hero: weapon } : {}) };
}

export const gearTier = (ilvl: number) => ilvl <= 6 ? 0 : ilvl <= 12 ? 1 : ilvl <= 18 ? 2 : 3;

/**
 * The colour a piece is drawn in on the hero. Each land has its own materials (leather and wool, moss and bark, starsilver,
 * obsidian and ember) and the rarity picks the dye, so a new piece visibly changes how the hero looks.
 */
const DYES: Record<Rarity, string[]> = {
  common: ['#8a7058', '#7d7466', '#9a8a6a', '#6f6a60'],
  uncommon: ['#4f8a4a', '#6a9a4a', '#3f7a5a', '#7a8f3f'],
  rare: ['#3f6ab8', '#4a86c8', '#3a5a9a', '#5a7ad0'],
  epic: ['#7a4ab8', '#9a4ac0', '#6a3aa0', '#a05ad0'],
  legendary: ['#e08a2a', '#d0a040', '#e06a2a', '#f0b040'],
};
const TIER_TONE = [0, .08, .16, -.08];
export function gearColor(g: GearItem): string {
  let h = 0; for (let i = 0; i < g.name.length; i++) h = (h * 31 + g.name.charCodeAt(i)) >>> 0;
  const list = DYES[g.rarity], base = list[h % list.length], f = TIER_TONE[gearTier(g.ilvl)];
  const n = parseInt(base.slice(1), 16), mix = (c: number) => Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f));
  return `#${[n >> 16 & 255, n >> 8 & 255, n & 255].map(c => mix(c).toString(16).padStart(2, '0')).join('')}`;
}
/** Worn pieces as the renderers need them: a colour per slot, and whether the piece glows (epic and legendary). */
export type Look = Partial<Record<GearSlot, { color: string; glow: boolean; tier: number }>>;
export function lookOf(equipped: Partial<Record<GearSlot, GearItem>>): Look {
  const out: Look = {};
  for (const s of SLOT_ORDER) { const g = equipped[s]; if (g) out[s] = { color: gearColor(g), glow: g.rarity === 'epic' || g.rarity === 'legendary', tier: gearTier(g.ilvl) }; }
  return out;
}

/** Everything worn, added up and capped. */
export function sumGear(equipped: Partial<Record<GearSlot, GearItem>>): Required<GearStats> {
  const t: Required<GearStats> = { armor: 0, power: 0, health: 0, mana: 0, regen: 0, speed: 0, crit: 0 };
  for (const slot of SLOT_ORDER) { const g = equipped[slot]; if (!g) continue; for (const [k, v] of Object.entries(g.stats) as Array<[GearStat, number]>) t[k] += v; }
  for (const [k, cap] of Object.entries(GEAR_CAPS) as Array<[GearStat, number]>) t[k] = Math.min(cap, t[k]);
  t.regen = Math.round(t.regen * 10) / 10;
  return t;
}
/** A rough score for sorting and comparing pieces. */
export function gearScore(g: GearItem) { let s = 0; for (const [k, v] of Object.entries(g.stats) as Array<[GearStat, number]>) s += v / PER_POINT[k]; return Math.round(s); }
/** What a merchant pays for a piece. */
export function sellPrice(g: GearItem) { return Math.max(3, Math.round((3 + g.ilvl * 1.8) * RARITY[g.rarity].mul * RARITY[g.rarity].mul)); }

export function validGear(g: unknown): g is GearItem {
  const x = g as GearItem;
  return !!x && typeof x.uid === 'string' && SLOT_ORDER.includes(x.slot) && RARITY_ORDER.includes(x.rarity) && typeof x.name === 'string' && !!x.stats && typeof x.stats === 'object';
}

/** What an armourer asks for a piece: many times what merchants pay, so bought gear is a real goal. */
export function buyPrice(g: GearItem) { return Math.round(sellPrice(g) * (g.rarity === 'legendary' ? 12 : g.rarity === 'epic' ? 10 : 8) / 5) * 5; }
/** An armourer's shelf: six pieces rolled for this hero, land and level, so the stock only changes when the hero levels up.
 *  The best pieces are above the hero's level and stay locked until they catch up. */
export function armouryStock(hero: HeroId, region: string, level: number, levels: [number, number]) {
  const r = seeded(`armoury:${hero}:${region}:${level}`);
  const tiers: Rarity[] = ['uncommon', 'rare', 'rare', 'rare', 'epic', r() < .2 ? 'legendary' : 'epic'];
  const base = Math.max(levels[0], Math.min(level, levels[1] + 2));
  // Six different slots, so the shelf never shows three chests.
  const slots = [...SLOT_ORDER].map(s => [r(), s] as const).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  return tiers.map((rarity, i) => {
    const ilvl = Math.min(26, base + (i >= 4 ? 2 : r() < .35 ? 1 : 0));
    const item = makeGear({ ilvl, rarity, slot: slots[i], rand: r, uid: `shop-${hero}-${region}-${level}-${i}`, hero });
    return { item, price: buyPrice(item), needLevel: ilvl };
  });
}
