import type { LevelId, SpellId } from './types';

export type SpellInfo = { name: string; key: string; icon: string; cost: number; cooldown: number; color: string; description: string; chapter: number };

export const SPELLS: Record<SpellId, SpellInfo> = {
  spark: { name: 'Spark', key: 'J', icon: '✦', cost: 0, cooldown: .3, color: '#ffe38a', description: 'A homing mote of starlight. Sometimes lands a critical hit.', chapter: 0 },
  dash: { name: 'Dash', key: 'Shift', icon: '➶', cost: 0, cooldown: .8, color: '#bfe8ff', description: 'Dart forward on the wind. You cannot be hit mid-dash.', chapter: 0 },
  leaf: { name: 'Leaf Burst', key: 'Q', icon: '❋', cost: 22, cooldown: 4.5, color: '#b9f29d', description: 'A whirl of razor leaves that hits and pushes back everything nearby.', chapter: 0 },
  sunfire: { name: 'Sunfire', key: 'R', icon: '☀', cost: 16, cooldown: 2, color: '#ffb05c', description: 'Hurls a blazing sun orb that explodes in a wide blast.', chapter: 1 },
  shield: { name: 'Moss Shield', key: 'F', icon: '◉', cost: 20, cooldown: 8, color: '#9fe8b0', description: 'A living ward. Blocks all harm and reflects projectiles back.', chapter: 2 },
  starfall: { name: 'Starfall', key: 'T', icon: '☄', cost: 38, cooldown: 9, color: '#c9b6ff', description: 'Calls a shower of falling stars onto every foe around you.', chapter: 3 },
};
export const SPELL_ORDER: SpellId[] = ['spark', 'dash', 'leaf', 'sunfire', 'shield', 'starfall'];
export const LEVEL_SPELL: Record<LevelId, SpellId> = { meadow: 'sunfire', woods: 'shield', summit: 'starfall' };
