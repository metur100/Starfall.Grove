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
  // Lyra, frost mage
  frostbolt: { name: 'Frost Bolt', key: 'L', icon: '❄', cost: 0, cooldown: .42, color: '#9fe4ff', description: 'A shard of ice that seeks the nearest foe. Chilled creatures move and attack slower for 2 seconds.', level: 1, dmg: 12, slot: 'main' },
  blink: { name: 'Blink', key: 'E', icon: '✧', cost: 0, cooldown: 2.6, color: '#d6f4ff', description: 'Teleport a short way in the direction you move, leaving a burst of frost that chills foes behind you.', level: 1, dmg: 10, slot: 'dash' },
  frostnova: { name: 'Frost Nova', key: 'K', icon: '❆', cost: 18, cooldown: 6, color: '#7fd0ff', description: 'Ice bursts out around you: nearby foes are hurt and frozen solid for 2 seconds.', level: 3, dmg: 28, slot: 'side' },
  iceBarrier: { name: 'Ice Barrier', key: 'J', icon: '⬢', cost: 22, cooldown: 10, color: '#bfeaff', description: 'Encase yourself in ice for 3 seconds: blocks all harm, reflects projectiles and chills anything that touches you.', level: 6, dmg: 10, slot: 'inner' },
  blizzard: { name: 'Blizzard', key: 'H', icon: '✻', cost: 40, cooldown: 12, color: '#e0f6ff', description: 'Call a blizzard onto the nearest pack: ice rains down for 4 seconds, hurting and chilling everything inside.', level: 10, dmg: 13, slot: 'top' },
  // Riven, shadow assassin
  stab: { name: 'Twin Daggers', key: 'L', icon: '†', cost: 0, cooldown: .3, color: '#e0c8ff', description: 'Two quick stabs at the foe in front of you. Critical hits deal triple damage.', level: 1, dmg: 9, slot: 'main' },
  shadowstep: { name: 'Shadowstep', key: 'E', icon: '◐', cost: 0, cooldown: 2.4, color: '#b69cff', description: 'Step through the shadows to right behind the nearest foe (or forward). Your next stab is a certain critical hit.', level: 1, slot: 'dash' },
  knives: { name: 'Fan of Knives', key: 'K', icon: '✥', cost: 16, cooldown: 4, color: '#d8d0f0', description: 'Throw ten knives in every direction at once.', level: 3, dmg: 18, slot: 'side' },
  veil: { name: 'Smoke Veil', key: 'J', icon: '◌', cost: 20, cooldown: 12, color: '#a898c8', description: 'Vanish for 4 seconds: creatures lose track of you, and your first strike from the shadows deals triple damage.', level: 6, slot: 'inner' },
  deathmark: { name: 'Death Mark', key: 'H', icon: '☠', cost: 36, cooldown: 11, color: '#ff6b9a', description: 'Mark the strongest foe near you. Two seconds later the mark bursts, and shadow blades cut everything around it.', level: 10, dmg: 110, slot: 'top' },
};

/**
 * Every ability can be upgraded with up to five stars, bought with gold in the spellbook. Each star improves one thing:
 * damage, cooldown (shorter) or duration (longer), by `per` percent. Star n needs hero level `level + (n - 1) * 3`.
 */
export const MAX_STARS = 5;
export type SpellUpgrade = { stat: 'damage' | 'cooldown' | 'duration'; per: number };
export const SPELL_UPGRADES: Record<SpellId, SpellUpgrade> = {
  spark: { stat: 'damage', per: 12 }, dash: { stat: 'cooldown', per: 8 }, sunfire: { stat: 'damage', per: 12 }, shield: { stat: 'duration', per: 12 }, starfall: { stat: 'damage', per: 12 },
  slash: { stat: 'damage', per: 12 }, charge: { stat: 'damage', per: 15 }, guard: { stat: 'duration', per: 12 }, slam: { stat: 'damage', per: 12 }, bladestorm: { stat: 'damage', per: 12 },
  frostbolt: { stat: 'damage', per: 12 }, blink: { stat: 'cooldown', per: 8 }, frostnova: { stat: 'damage', per: 12 }, iceBarrier: { stat: 'duration', per: 12 }, blizzard: { stat: 'damage', per: 12 },
  stab: { stat: 'damage', per: 12 }, shadowstep: { stat: 'cooldown', per: 8 }, knives: { stat: 'damage', per: 12 }, veil: { stat: 'duration', per: 12 }, deathmark: { stat: 'damage', per: 12 },
};
export const starLevel = (id: SpellId, star: number) => Math.min(25, SPELLS[id].level + (star - 1) * 3);
export const starCost = (id: SpellId, star: number) => Math.round(45 * Math.pow(star, 1.7) * (1 + SPELLS[id].level / 10) / 5) * 5;
export function upgradeText(id: SpellId, stars: number) {
  const u = SPELL_UPGRADES[id], v = u.per * stars;
  return u.stat === 'damage' ? `+${v}% damage` : u.stat === 'cooldown' ? `−${v}% cooldown` : `+${v}% duration`;
}

/**
 * Each hero's abilities, in the order they are shown and learned. `hpPerLevel` is the health gained per level, `speed`
 * the walking speed in px/s, and `boy` picks the words the story uses for them ("my brave lad" or "my brave girl").
 */
export type HeroInfo = { id: HeroId; name: string; title: string; portrait: string; description: string; spells: SpellId[]; resource: string; hearts: number; armor: number; regen: number; hpPerLevel: number; speed: number; boy: boolean; melee: boolean };
export const HEROES: Record<HeroId, HeroInfo> = {
  mira: { id: 'mira', name: 'Mira', title: 'Star warlock', portrait: '🧙‍♀️', description: 'Strikes from afar with starlight. Fragile — keep your distance.', spells: ['spark', 'dash', 'sunfire', 'shield', 'starfall'], resource: 'Magic', hearts: 5, armor: 1, regen: 3.2, hpPerLevel: 8, speed: 270, boy: false, melee: false },
  kael: { id: 'kael', name: 'Kael', title: 'Warrior', portrait: '🛡️', description: 'Sword and shield up close. Tough — creatures hurt him far less.', spells: ['slash', 'charge', 'guard', 'slam', 'bladestorm'], resource: 'Stamina', hearts: 7, armor: .65, regen: 5, hpPerLevel: 11, speed: 255, boy: true, melee: true },
  lyra: { id: 'lyra', name: 'Lyra', title: 'Frost mage', portrait: '❄️', description: 'Bends winter from afar. Chills, freezes and slows — she wins by controlling the fight.', spells: ['frostbolt', 'blink', 'frostnova', 'iceBarrier', 'blizzard'], resource: 'Magic', hearts: 5, armor: .92, regen: 3.4, hpPerLevel: 8, speed: 265, boy: false, melee: false },
  riven: { id: 'riven', name: 'Riven', title: 'Shadow assassin', portrait: '🗡️', description: 'Twin daggers and shadows up close. The fastest and deadliest hero, but lightly armoured.', spells: ['stab', 'shadowstep', 'knives', 'veil', 'deathmark'], resource: 'Energy', hearts: 6, armor: .82, regen: 4.6, hpPerLevel: 9, speed: 292, boy: true, melee: true },
};
export const HERO_ORDER: HeroId[] = ['mira', 'kael', 'lyra', 'riven'];
