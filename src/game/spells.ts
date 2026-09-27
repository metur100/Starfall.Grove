import type { HeroId, SpellId } from './types';

/**
 * `level` is the hero level at which the ability is learned. `dmg` is its base damage before spell power.
 * `slot` is its place on the touch wheel: main (big button), dash, inner, side and top.
 */
export type SpellInfo = { name: string; key: string; icon: string; cost: number; cooldown: number; color: string; description: string; level: number; dmg?: number; slot: 'main' | 'dash' | 'inner' | 'side' | 'top' };

export const SPELLS: Record<SpellId, SpellInfo> = {
  // Mira, star warlock
  spark: { name: 'Spark', key: 'L', icon: '✦', cost: 0, cooldown: .3, color: '#ffe38a', description: 'A homing mote of starlight. Sometimes lands a critical hit.', level: 1, dmg: 10, slot: 'main' },
  dash: { name: 'Dash', key: 'E', icon: '➶', cost: 0, cooldown: .8, color: '#bfe8ff', description: 'Dart forward on the wind. You cannot be hit mid-dash.', level: 1, slot: 'dash' },
  sunfire: { name: 'Sunfire', key: 'K', icon: '☀', cost: 16, cooldown: 2, color: '#ffb05c', description: 'Hurls a blazing sun orb that explodes in a wide blast.', level: 3, dmg: 40, slot: 'side' },
  shield: { name: 'Moss Shield', key: 'J', icon: '◉', cost: 20, cooldown: 8, color: '#9fe8b0', description: 'A living ward. Blocks all harm and reflects projectiles back.', level: 6, dmg: 10, slot: 'inner' },
  starfall: { name: 'Starfall', key: 'H', icon: '☄', cost: 38, cooldown: 9, color: '#c9b6ff', description: 'Calls a shower of falling stars onto every foe around you.', level: 10, dmg: 34, slot: 'top' },
  // Kael, warrior
  slash: { name: 'Slash', key: 'L', icon: '⚔', cost: 0, cooldown: .38, color: '#ffd0a0', description: 'A wide sword swing that hits every foe in front of you.', level: 1, dmg: 15, slot: 'main' },
  charge: { name: 'Charge', key: 'E', icon: '➤', cost: 0, cooldown: 2.2, color: '#ffb35c', description: 'Rush at the nearest foe. Everything in your path is knocked aside and stunned. You cannot be hit mid-charge.', level: 1, dmg: 22, slot: 'dash' },
  guard: { name: 'Shield Wall', key: 'K', icon: '⛨', cost: 20, cooldown: 9, color: '#b8c8e0', description: 'Raise your shield: blocks all harm, bounces projectiles back and shoves foes away.', level: 3, dmg: 12, slot: 'inner' },
  slam: { name: 'Earthsplitter', key: 'J', icon: '✺', cost: 24, cooldown: 5, color: '#e0a060', description: 'Smash the ground: a shockwave hurts and stuns everything around you.', level: 6, dmg: 45, slot: 'side' },
  bladestorm: { name: 'Bladestorm', key: 'H', icon: '✵', cost: 40, cooldown: 12, color: '#ff8a6b', description: 'Spin into a whirlwind of steel for 3 seconds, cutting everything nearby. You take half damage while spinning.', level: 10, dmg: 14, slot: 'top' },
};

/** Each hero's abilities, in the order they are shown and learned. */
export type HeroInfo = { id: HeroId; name: string; title: string; portrait: string; description: string; spells: SpellId[]; resource: string; hearts: number; armor: number; regen: number };
export const HEROES: Record<HeroId, HeroInfo> = {
  mira: { id: 'mira', name: 'Mira', title: 'Star warlock', portrait: '🧙‍♀️', description: 'Strikes from afar with starlight. Fragile — keep your distance.', spells: ['spark', 'dash', 'sunfire', 'shield', 'starfall'], resource: 'Magic', hearts: 5, armor: 1, regen: 3.2 },
  kael: { id: 'kael', name: 'Kael', title: 'Warrior', portrait: '🛡️', description: 'Sword and shield up close. Tough — creatures hurt him far less.', spells: ['slash', 'charge', 'guard', 'slam', 'bladestorm'], resource: 'Stamina', hearts: 7, armor: .65, regen: 5 },
};
export const HERO_ORDER: HeroId[] = ['mira', 'kael'];
