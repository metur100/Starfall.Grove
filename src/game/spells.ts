import type { SpellId } from './types';

/** `level` is the hero level at which the spell is learned. */
export type SpellInfo = { name: string; key: string; icon: string; cost: number; cooldown: number; color: string; description: string; level: number };

export const SPELLS: Record<SpellId, SpellInfo> = {
  spark: { name: 'Spark', key: 'F', icon: '✦', cost: 0, cooldown: .3, color: '#ffe38a', description: 'A homing mote of starlight. Sometimes lands a critical hit.', level: 1 },
  dash: { name: 'Dash', key: 'E', icon: '➶', cost: 0, cooldown: .8, color: '#bfe8ff', description: 'Dart forward on the wind. You cannot be hit mid-dash.', level: 1 },
  leaf: { name: 'Leaf Burst', key: 'H', icon: '❋', cost: 22, cooldown: 4.5, color: '#b9f29d', description: 'A whirl of razor leaves that hits and pushes back everything nearby.', level: 2 },
  sunfire: { name: 'Sunfire', key: 'J', icon: '☀', cost: 16, cooldown: 2, color: '#ffb05c', description: 'Hurls a blazing sun orb that explodes in a wide blast.', level: 4 },
  shield: { name: 'Moss Shield', key: 'K', icon: '◉', cost: 20, cooldown: 8, color: '#9fe8b0', description: 'A living ward. Blocks all harm and reflects projectiles back.', level: 7 },
  starfall: { name: 'Starfall', key: 'L', icon: '☄', cost: 38, cooldown: 9, color: '#c9b6ff', description: 'Calls a shower of falling stars onto every foe around you.', level: 10 },
};
export const SPELL_ORDER: SpellId[] = ['spark', 'dash', 'leaf', 'sunfire', 'shield', 'starfall'];
