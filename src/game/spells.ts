import type { HeroId, SpellId } from './types';

/**
 * `level` is the hero level at which the ability is learned. `dmg` is its base damage before spell power.
 * `slot` is its place on the touch wheel: main (big button), dash, inner, side and top.
 */
/** `cast`: seconds of casting before the spell goes off (Mira's and Lyra's bolts and big spells); the rest are instant. */
export type SpellInfo = { name: string; key: string; icon: string; cost: number; cooldown: number; color: string; description: string; level: number; dmg?: number; cast?: number; slot: 'main' | 'dash' | 'inner' | 'side' | 'top' };

export const SPELLS: Record<SpellId, SpellInfo> = {
  // Mira, astralmancer. She has no escape spell: she holds foes in place instead.
  spark: { name: 'Spark', key: 'L', icon: '✦', cost: 0, cooldown: .3, color: '#ffe38a', description: 'A homing mote of starlight. Sometimes lands a critical hit.', level: 1, dmg: 17, cast: .45, slot: 'main' },
  gravity: { name: 'Gravity Well', key: 'E', icon: '◎', cost: 20, cooldown: 11, color: '#b39cff', description: 'Opens a small black star on the nearest foe for 2 seconds. It drags every creature around it into its heart and grinds them with starlight.', level: 1, dmg: 3, slot: 'dash' },
  sunfire: { name: 'Sunflare', key: 'K', icon: '☀', cost: 20, cooldown: 2, color: '#ffb05c', description: 'Hurls a blazing sun orb that explodes in a wide blast.', level: 3, dmg: 58, cast: .95, slot: 'side' },
  starguard: { name: 'Guardian Stars', key: 'J', icon: '⁂', cost: 24, cooldown: 10, color: '#fff1b8', description: 'Three stars circle you for 8 seconds and burn foes they touch. Each one catches a blow meant for you and bursts on the attacker. Any left at the end fly at the nearest foes.', level: 6, dmg: 26, slot: 'inner' },
  starfall: { name: 'Comet Shower', key: 'H', icon: '☄', cost: 45, cooldown: 9, color: '#c9b6ff', description: 'Calls a shower of falling stars onto every foe around you.', level: 10, dmg: 38, slot: 'top' },
  // Kael, knight
  slash: { name: 'Slash', key: 'L', icon: '⚔', cost: 0, cooldown: .38, color: '#ffd0a0', description: 'A wide sword swing that hits every foe in front of you.', level: 1, dmg: 15, slot: 'main' },
  charge: { name: 'Lion’s Rush', key: 'E', icon: '➤', cost: 0, cooldown: 2.2, color: '#ffb35c', description: 'Rush at a foe up to 340 steps away. It is knocked aside and stunned, and so is anything in your path. You cannot be hit mid-rush. It needs a foe to rush at.', level: 1, dmg: 22, slot: 'dash' },
  guard: { name: 'Bulwark', key: 'K', icon: '⛨', cost: 24, cooldown: 9, color: '#b8c8e0', description: 'Raise your shield: blocks all harm, bounces projectiles back and shoves foes away.', level: 3, dmg: 12, slot: 'inner' },
  slam: { name: 'Earthsplitter', key: 'J', icon: '✺', cost: 30, cooldown: 5, color: '#e0a060', description: 'Smash the ground: a shockwave hurts and stuns everything around you.', level: 6, dmg: 45, slot: 'side' },
  bladestorm: { name: 'Steel Cyclone', key: 'H', icon: '✵', cost: 46, cooldown: 12, color: '#ff8a6b', description: 'Spin into a whirlwind of steel for 3 seconds, cutting everything nearby. You take half damage while spinning.', level: 10, dmg: 14, slot: 'top' },
  // Lyra, frostweaver
  frostbolt: { name: 'Rime Shard', key: 'L', icon: '❄', cost: 0, cooldown: .4, color: '#9fe4ff', description: 'A shard of ice that seeks the nearest foe. Chilled creatures move and attack slower for 2 seconds.', level: 1, dmg: 22, cast: .5, slot: 'main' },
  blink: { name: 'Frost Step', key: 'E', icon: '✧', cost: 0, cooldown: 2.6, color: '#d6f4ff', description: 'Teleport a short way in the direction you move, leaving a burst of frost that chills foes behind you.', level: 1, dmg: 12, slot: 'dash' },
  frostnova: { name: 'Glacial Burst', key: 'K', icon: '❆', cost: 26, cooldown: 6, color: '#7fd0ff', description: 'Ice bursts out around you: nearby foes are hurt and frozen solid for 2 seconds.', level: 3, dmg: 40, slot: 'side' },
  iceBlock: { name: 'Glacier Shell', key: 'J', icon: '⬢', cost: 22, cooldown: 16, color: '#bfeaff', description: 'Freeze yourself in a shell of glacier ice: nothing can harm you, but you cannot move or cast. Press again to break free (it melts by itself after 6 seconds). The cooldown starts when you come out.', level: 6, slot: 'inner' },
  blizzard: { name: 'Whiteout', key: 'H', icon: '✻', cost: 52, cooldown: 12, color: '#e0f6ff', description: 'Call a whiteout onto the nearest pack: ice rains down for 4 seconds, hurting and chilling everything inside.', level: 10, dmg: 18, cast: 1.05, slot: 'top' },
  // Riven, assassin
  stab: { name: 'Twin Daggers', key: 'L', icon: '†', cost: 0, cooldown: .3, color: '#e0c8ff', description: 'Two quick stabs at the foe in front of you. Critical hits deal triple damage.', level: 1, dmg: 9, slot: 'main' },
  shadowstep: { name: 'Shade Step', key: 'E', icon: '◐', cost: 0, cooldown: 2.4, color: '#b69cff', description: 'Step through the shadows to right behind a foe up to 380 steps away. Your next stab is a certain critical hit. It needs a foe to step to.', level: 1, slot: 'dash' },
  knives: { name: 'Dagger Burst', key: 'K', icon: '✥', cost: 24, cooldown: 4, color: '#d8d0f0', description: 'Throw ten knives in every direction at once.', level: 3, dmg: 18, slot: 'side' },
  stealth: { name: 'Nightveil', key: 'J', icon: '◌', cost: 22, cooldown: 8, color: '#a898c8', description: 'Fade into the shadows for up to 15 seconds. No creature anywhere can see you, guardians included, and any that were fighting you lose you. Attacking, or getting hurt, brings you out, and your first strike from the veil deals triple damage. Press again to step out. The cooldown starts when you come out.', level: 6, slot: 'inner' },
  deathmark: { name: 'Doom Sigil', key: 'H', icon: '☠', cost: 45, cooldown: 11, color: '#ff6b9a', description: 'Brand the strongest foe near you with a sigil. Two seconds later the sigil bursts, and shadow blades cut everything around it.', level: 10, dmg: 110, slot: 'top' },
  // Wren, ranger, with Fenn the wolf
  arrow: { name: 'Swift Arrow', key: 'L', icon: '➹', cost: 0, cooldown: .38, color: '#e8d49a', description: 'Loose an arrow at the nearest foe. It flies far and pierces through the first creature it hits. Fenn attacks whatever you shoot, unless he is told to stay passive.', level: 1, dmg: 10, slot: 'main' },
  command: { name: 'Fenn: Attack / Passive', key: 'E', icon: '🐾', cost: 0, cooldown: 1, color: '#c8e6a0', description: 'Tell Fenn what to do. Passive: he stays at your heel and attacks nothing. Attack: he pounces on your foe, stunning it, and keeps fighting. Out of combat he picks the nearest creature and starts the fight for you.', level: 1, dmg: 16, slot: 'dash' },
  volley: { name: 'Arrow Fan', key: 'K', icon: '⋔', cost: 22, cooldown: 3.5, color: '#f0c070', description: 'Fire a fan of seven arrows at once.', level: 3, dmg: 18, slot: 'side' },
  leap: { name: 'Hawk Leap', key: 'J', icon: '⤺', cost: 20, cooldown: 8, color: '#b9e27a', description: 'Vault away from the nearest foe (or the way you are moving) and loose three arrows at it in mid-air. Nothing can hurt you during the leap, and every creature the arrows hit is pinned to the ground for 1.5 seconds.', level: 6, dmg: 24, slot: 'inner' },
  wildcall: { name: 'Howl of the Pack', key: 'H', icon: '🐺', cost: 44, cooldown: 14, color: '#9fe8b0', description: 'Fenn howls: for 8 seconds two spirit wolves join the hunt, and Fenn bites twice as fast and hard.', level: 10, dmg: 14, slot: 'top' },
};

/**
 * Every ability can be upgraded with up to five stars, bought with gold in the spellbook. Each star improves one thing:
 * damage, cooldown (shorter) or duration (longer), by `per` percent. Star n needs hero level `level + (n - 1) * 3`.
 */
export const MAX_STARS = 5;
export type SpellUpgrade = { stat: 'damage' | 'cooldown' | 'duration'; per: number };
export const SPELL_UPGRADES: Record<SpellId, SpellUpgrade> = {
  spark: { stat: 'damage', per: 12 }, gravity: { stat: 'damage', per: 15 }, sunfire: { stat: 'damage', per: 12 }, starguard: { stat: 'damage', per: 12 }, starfall: { stat: 'damage', per: 12 },
  slash: { stat: 'damage', per: 12 }, charge: { stat: 'damage', per: 15 }, guard: { stat: 'duration', per: 12 }, slam: { stat: 'damage', per: 12 }, bladestorm: { stat: 'damage', per: 12 },
  frostbolt: { stat: 'damage', per: 12 }, blink: { stat: 'cooldown', per: 8 }, frostnova: { stat: 'damage', per: 12 }, iceBlock: { stat: 'cooldown', per: 8 }, blizzard: { stat: 'damage', per: 12 },
  stab: { stat: 'damage', per: 12 }, shadowstep: { stat: 'cooldown', per: 8 }, knives: { stat: 'damage', per: 12 }, stealth: { stat: 'cooldown', per: 8 }, deathmark: { stat: 'damage', per: 12 },
  arrow: { stat: 'damage', per: 12 }, command: { stat: 'damage', per: 15 }, volley: { stat: 'damage', per: 12 }, leap: { stat: 'damage', per: 12 }, wildcall: { stat: 'duration', per: 12 },
};
/** Abilities that were replaced: stars bought for the old one carry over to the one in its place. */
export const RENAMED_SPELLS: Record<string, SpellId> = { dash: 'gravity', shield: 'starguard', iceBarrier: 'iceBlock', veil: 'stealth', tumble: 'command', snare: 'leap' };
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
  mira: { id: 'mira', name: 'Mira', title: 'Astralmancer', portrait: '🧙‍♀️', description: 'Bends the stars from afar: gravity wells, sunflares and guardian stars. Fragile, and she has no escape spell. Hold foes in place and keep your distance.', spells: ['spark', 'gravity', 'sunfire', 'starguard', 'starfall'], resource: 'Magic', hearts: 5, armor: 1, regen: 2.2, hpPerLevel: 8, speed: 270, boy: false, melee: false },
  kael: { id: 'kael', name: 'Kael', title: 'Knight', portrait: '🛡️', description: 'Sword and shield up close. Tough, so creatures hurt him far less. His Lion’s Rush carries him straight into the enemy.', spells: ['slash', 'charge', 'guard', 'slam', 'bladestorm'], resource: 'Stamina', hearts: 7, armor: .65, regen: 2.6, hpPerLevel: 11, speed: 255, boy: true, melee: true },
  lyra: { id: 'lyra', name: 'Lyra', title: 'Frostweaver', portrait: '❄️', description: 'Weaves winter from afar. She chills, freezes and slows, and wins by controlling the fight. In a tight spot she hides inside a shell of glacier ice.', spells: ['frostbolt', 'blink', 'frostnova', 'iceBlock', 'blizzard'], resource: 'Magic', hearts: 5, armor: .92, regen: 2, hpPerLevel: 8, speed: 265, boy: false, melee: false },
  riven: { id: 'riven', name: 'Riven', title: 'Assassin', portrait: '🗡️', description: 'Twin daggers and shadows up close. The deadliest hero, and invisible under his Nightveil, but lightly armoured.', spells: ['stab', 'shadowstep', 'knives', 'stealth', 'deathmark'], resource: 'Energy', hearts: 6, armor: .72, regen: 2.4, hpPerLevel: 10, speed: 292, boy: true, melee: true },
  wren: { id: 'wren', name: 'Wren', title: 'Ranger', portrait: '🏹', description: 'The fastest hero on foot, with a longbow and Fenn, her loyal wolf. She shoots from afar while Fenn attacks, or stays at her heel, on her command.', spells: ['arrow', 'command', 'volley', 'leap', 'wildcall'], resource: 'Focus', hearts: 6, armor: .86, regen: 2.3, hpPerLevel: 9, speed: 312, boy: false, melee: false },
};
export const HERO_ORDER: HeroId[] = ['mira', 'kael', 'lyra', 'riven', 'wren'];
