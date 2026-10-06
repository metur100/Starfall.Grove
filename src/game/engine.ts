import { ACHIEVEMENTS, goalOf, type AchDef, type Totals } from './achievements';
import { ambience, footstep, sfx, type Sfx } from './audio';
import { ITEMS, ITEM_ORDER, rollItem } from './items';
import { RARITY, SLOT_ORDER, armouryStock, makeGear, rollRarity, seeded, sellPrice } from './gear';
import { BAG_SIZE, FRAGMENTS_PER_HEART, HP_UNIT, MAX_LEVEL, MAX_STARHEARTS, MAX_RANK, armorAt, bagUsed, gearOf, healthAt, loadProfile, manaAt, powerAt, practiceProfile, rankOf, regenAt, saveProfile, starsOf, upgradeCost, xpToNext, type Profile } from './progression';
import { HEROES, MAX_STARS, SPELLS, SPELL_UPGRADES, starCost, starLevel, upgradeText } from './spells';
import { MOUNTS, MOUNT_ORDER } from './mounts';
import { TRAILS, trailFor } from './trails';
import { keyLabel, keyOf, spellKey } from './keys';
import { Grid } from './spatial';
import { REGION_W, RoadIndex, inPond, inRange, riverX } from './worldgen';
import { getWorld, localKind } from './worlds';
import { inDepthsArea, keepInDepths } from './depths';
import { questsForHero, worldForHero } from './heroWorld';
import { cineFor, type CineFx, type Shot } from './cutscenes';
import { bossVariant, type BossAction, type BossShot, type BossVariant } from './bosses';
import type {
  CineState, CritterKind, EngineEvent, NpcLook, GearItem, GearSlot, HeroId, EnemyKind, EnemySeed, GameSnapshot, ItemId, MainQuest, MiniGame, MountId, NoticeTone, TrailId, NpcDef, Obstacle, Point, Poi,
  QuestDef, QuestOffer, QuestRow, QuestState, Rarity, Region, RegionId, River, ShopGear, SpellId, SpellRank, UpgradeId, WorldDefinition, WorldObject,
} from './types';

export type Hero = {
  x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; mana: number; maxMana: number; manaRegen: number;
  faceX: number; faceY: number; cds: Record<SpellId, number>; shieldTime: number; hurtTime: number; walkTime: number;
  dashTime: number; dashX: number; dashY: number; castTime: number;
  /** Seconds left of being slowed by spider silk. */
  slowT: number;
  /** Kael: seconds left of Bladestorm, and whether the current dash is a Charge. */
  stormT: number; stormTick: number; charging: boolean;
  /** Seconds the hero cannot be hurt after a Blink or a Shadowstep (no hurt flicker, unlike `hurtTime`). */
  ghostT: number;
  /** Lyra: seconds left inside her Ice Block (she can't move or act, and nothing can hurt her). */
  iceT: number;
  /** Mira: seconds left of Guardian Stars, how many stars still circle her, and the timer of their burn. */
  orbitT: number; orbitN: number; orbitTick: number;
};
export type Enemy = EnemySeed & {
  hp: number; maxHp: number; r: number; dead: boolean; deadT: number; cd: number; windup: number; hitFlash: number;
  kx: number; ky: number; homeX: number; homeY: number; wanderX: number; wanderY: number; wanderT: number;
  aggro: boolean; spawnT: number; phase: number; action: BossAction | null; actionT: number; actionStep: number;
  pattern: number; summons: number; chargeX: number; chargeY: number; lunge: number; angle: number; summoned?: boolean;
  /** 0 calm → 1 attacking; drives the red aggro tint. */
  rage: number;
  /** Seconds left of a stun; `blinkT` counts down to a frost wraith's next blink. */
  stunT: number; blinkT: number;
  /** Chilled creatures move and act slower; frozen ones are shown in a block of ice; a burrowed scorpion is under the sand. */
  chillT: number; frozenT: number; burrowT: number;
  /** Heroic creatures: seconds to the next ground slam, and whether they have enraged at half health. */
  heroT: number; enraged: boolean;
  /** Siege attackers march on `raid` (the house they mean to burn, `raidAt` in the siege's targets); creatures from a
   *  cutscene vanish when it ends. */
  raid?: Point; raidAt?: number; cineOnly?: boolean;
  /** The kind it fights like (its own kind, or the kin it takes after: see ENEMY_AI). */
  ai: EnemyKind;
};
/** Fenn, Wren's wolf, and the spirit wolves of Call of the Wild (`life` counts down; Fenn's is endless). */
export type Pet = { x: number; y: number; face: number; target: Enemy | null; cd: number; bite: number; leapT: number; walk: number; spirit: boolean; life: number; moving: boolean };
export type Npc = NpcDef & { homeX: number; homeY: number; tx: number; ty: number; moving: boolean; faceX: number; waitT: number; routeI: number; routeDir: number; workT: number; bark: string; barkT: number; barkCd: number; walkT: number; poiName: string;
  /** Quest people: whose quest they belong to, drawn as a wolf (a pale spirit one), too scared to walk, and a thief's stamina. */
  quest?: string; beast?: boolean; spirit?: boolean; scared?: boolean; tireT?: number; restT?: number; ang?: number };
export type Critter = { kind: CritterKind; x: number; y: number; homeX: number; homeY: number; tx: number; ty: number; state: 'idle' | 'move' | 'flee' | 'fly'; t: number; face: number; alt: number; hop: number; seed: number;
  /** An animal to herd for the quest `herd`, and whether it is safely in the pen. */
  herd?: string; penned?: boolean; slide?: number };
/** A falling star (or, `dark`, a streak of Umbra's smoke) in a cutscene, and a burning roof. */
export type Meteor = { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; dark: boolean };
export type Fire = { x: number; y: number; t: number; s: number };
type Cine = { id: string; shots: Shot[]; i: number; t: number; dur: number; cutT: number; pending: Point | null; ctx: Record<string, Point>; then?: () => void; timers: Array<{ t: number; fx: CineFx }> };
/** A siege: the creatures march on a town's houses (or on the one thing a quest guards) and set them alight. */
type SiegeTarget = { x: number; y: number; fx: number; fy: number; burning: boolean };
type Siege = { q: QuestDef; ward: WorldObject; wave: number; waveT: number; hp: number; spawned: boolean; raiders: Enemy[];
  /** The town under attack (a village, city, camp or farm), or null when the quest guards one thing. */
  town: Poi | null; targets: SiegeTarget[] };
export type Projectile = { x: number; y: number; vx: number; vy: number; life: number; r: number; damage: number; level: number; owner: 'hero' | 'enemy'; kind: 'spark' | 'sunfire' | 'thorn' | 'void' | 'web' | 'ice' | 'frost' | 'knife' | 'fire' | 'arrow'; targetId?: string; crit?: boolean; spin: number;
  /** Arrows pass through this many more creatures; `passed` are the ones already hit. */
  pierce?: number; passed?: Enemy[];
  /** Hawk Leap's arrows pin what they hit to the ground for this many seconds. */
  pin?: number };
export type Hazard = { x: number; y: number; r: number; delay: number; maxDelay: number; damage: number; level: number; owner: 'hero' | 'enemy'; kind: 'slam' | 'boulder' | 'root' | 'meteor' | 'starfall' | 'spore' | 'firebomb' | 'frostbomb' | 'lightning' | 'lava' | 'frostnova' | 'blizzard' | 'mark'; fromX: number; fromY: number };
/** Riven's Death Mark on a creature, and Lyra's Blizzard over a patch of ground. */
export type Mark = { e: Enemy; t: number; max: number; mul: number };
export type Storm = { x: number; y: number; t: number; tick: number };
/** Mira's Gravity Well: a small black star that drags creatures into its heart. */
export type Well = { x: number; y: number; t: number; max: number; tick: number };
/** Wren's order to Fenn: fight beside her, or stay at her heel and attack nothing. */
export type PetMode = 'attack' | 'passive';
/** One achievement as the journal shows it. */
export type AchRow = AchDef & { goal: number; progress: number; got: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'leaf' | 'ember' | 'star' | 'smoke' | 'ring' | 'shard'; rot: number; vr: number; grav: number; drag: number; glow: boolean };
/** A `loot` orb carries a piece of equipment and is drawn as a small bag glowing in its rarity colour. */
export type Orb = { x: number; y: number; vx: number; vy: number; kind: 'mana' | 'heart' | 'gold' | 'loot'; age: number; value: number; gear?: GearItem };
export type Pod = { id: number; x: number; y: number; dead: boolean; hitT: number };
export type FloatText = { x: number; y: number; text: string; life: number; max: number; color: string; size: number };
export type Afterimage = { x: number; y: number; life: number; faceX: number };
/** Kael's sword swings (and Riven's dagger thrusts, `narrow`), drawn as a fading arc. */
export type Slash = { x: number; y: number; angle: number; life: number; max: number; reach: number; color?: string; narrow?: boolean };
export type EngineSave = {
  version: 4; hero: { x: number; y: number; hp: number; mana: number }; main: MainQuest; quests: Record<string, QuestState>; got: string[];
  opened: string[]; read: string[]; discovered: string[]; explored: string; brokenPods: number[]; checkpoint: Point; elapsed: number; defeated: number;
  blessed: string[]; tracked: string | null; chapterStart: { elapsed: number; defeated: number }; awaiting: boolean; foxQueue: string[];
  /** Cracked walls broken and waterfall caves found. */
  secrets?: string[];
  /** Answers picked in conversations, and where people walking with the hero were. */
  choices?: Record<string, 'a' | 'b'>; escorts?: Array<{ id: string; x: number; y: number }>;
  /** Quests given up, which the journal offers to take up again. */
  abandoned?: string[];
  /** Columns of the explore grid when saved: the valley grew a fourth land, so older fog maps are re-laid row by row. */
  exploreCols?: number;
  /** Creatures defeated and not yet back, with the moment (ms since 1970) each fell: leaving and coming straight back
   *  doesn't bring them back early. */
  slain?: Record<string, number>;
  /** Seconds of play until the sky may drop the next star. */
  starfallT?: number;
};
type Near = { kind: 'object'; o: WorldObject } | { kind: 'npc'; n: Npc };
/**
 * A Starfall: now and then a star comes down somewhere in the lands the hero can reach. Where it lands: a crater, star
 * fragments scattered round it, creatures touched by its light, a beast that fell with it (a world boss, gone when the
 * star fades) and a star-forged chest that holds a legendary piece, sealed until the beast falls.
 */
export type Starfall = { x: number; y: number; region: RegionId; place: string; name: string; phase: 'falling' | 'landed'; t: number;
  frags: Array<{ x: number; y: number; got: boolean }>; boss: Enemy | null; foes: Enemy[]; chest: WorldObject | null; seen: boolean };
/** The names a fallen star's beast may bear. */
const STAR_NAMES = ['Astralith, the Fallen', 'The Comet-Eater', 'Meteorgeist', 'The Skyshard Colossus', 'Nightfall Behemoth', 'The Starborn Wyrm'];
/** How long a fallen star shines before it fades (seconds), and the wait between chances of one falling. */
const STAR_TIME = 360, STAR_WAIT: [number, number] = [600, 1200];
/** Umbra's echo, which rises on the empty throne whenever the hero comes back down after the story is over. */
const ECHO_ID = 'depths:echo';

/** Mira's story, retold for another hero: their name, their looks, and no fox at their side. */
const EPITHET: Record<HeroId, string> = { mira: 'girl with the fox', kael: 'warrior with the red plume', lyra: 'girl with frost in her hair', riven: 'one in the shadow-cloak', wren: 'girl with the longbow and the wolf' };
export function personalize(l: string, hero: HeroId) {
  if (hero === 'mira') return l;
  const info = HEROES[hero];
  return l.replace(/Mira and Tuft have/g, `${info.name} has`).replace(/\bMira\b/g, info.name).replace(/\bgirl with the fox\b/g, EPITHET[hero]).replace(/\b([Mm])y brave girl\b/g, (_, m: string) => `${m}y brave ${info.boy ? 'lad' : 'girl'}`)
    .replace('(Tuft tugs at your sleeve and points east,', '(You look east,')
    .replace('(Tuft sniffs the icy wind blowing through the Eastern Gate and whines.)', '(An icy wind howls through the Eastern Gate.)')
    .replace('(Tuft stares east,', '(You stare east,')
    .replace('(Tuft’s fur stands on end.', '(The hair on your neck stands on end.')
    .replace(/ and Tuft\b/g, '').replace(/ with Tuft\b/g, '').replace(/\bTuft\b/g, 'the wind')
    // Lines written for Orrin's apprentice, told to someone who isn't.
    .replace('Your teacher, Master Orrin, rode', 'Master Orrin, the old star-wizard, rode')
    .replace('Orrin’s apprentice. He said you would come looking.', 'You’re the one Tamsin sent? Good. The valley needs every brave pair of hands.')
    .replace('what your master was looking for', 'what Master Orrin was looking for')
    .replace('You fight like Orrin’s student.', 'You fight like one of the old Wardens.')
    .replace('Orrin’s apprentice! Oh, that stubborn old man.', 'Rowan sent you about Orrin? Oh, that stubborn old man.')
    .replace('Orrin’s other apprentice?', 'The hero who lit the Beacon?')
    .replace('and Orrin’s apprentice at that', 'and the one who rang the Bell, at that')
    .replace('Orrin’s apprentice. We have prayed for you.', 'The hero of the Beacon and the Bell. We have prayed for you.')
    .replace('bring your teacher home', 'bring Orrin home').replace('Free your teacher,', 'Free Master Orrin,')
    .replace(/^\S+…\? Oh, my brave \w+\. You came all this way\.$/, 'You came for me? All this way, for a foolish old man… Bless you.');
}
/** Quests that show a running count in the log. */
const COUNTED = new Set(['collect', 'slay', 'key', 'build', 'activate', 'trail', 'herd', 'defend']);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const swapRemove = <T,>(list: T[], i: number) => { list[i] = list[list.length - 1]; list.pop(); };

/** Base stats at level 1; `dmg` scales the level's hit damage. Bosses keep their listed health. */
const ENEMY_STATS: Record<EnemyKind, { hp: number; r: number; speed: number; name: string; xp: number; dmg: number }> = {
  gloomling: { hp: 30, r: 19, speed: 115, name: 'Gloomling', xp: 14, dmg: 1 },
  thornling: { hp: 40, r: 22, speed: 60, name: 'Thornling', xp: 18, dmg: .9 },
  wisp: { hp: 32, r: 16, speed: 150, name: 'Void wisp', xp: 20, dmg: .9 },
  bristleboar: { hp: 50, r: 24, speed: 95, name: 'Bristleboar', xp: 20, dmg: 1.2 },
  sporecap: { hp: 44, r: 20, speed: 45, name: 'Sporecap', xp: 18, dmg: .9 },
  shadewolf: { hp: 40, r: 21, speed: 175, name: 'Shadewolf', xp: 20, dmg: 1 },
  webspinner: { hp: 42, r: 22, speed: 100, name: 'Webspinner', xp: 22, dmg: 1 },
  frostwraith: { hp: 44, r: 20, speed: 125, name: 'Frost wraith', xp: 24, dmg: 1 },
  cragGolem: { hp: 120, r: 32, speed: 52, name: 'Crag golem', xp: 42, dmg: 1.5 },
  emberImp: { hp: 36, r: 17, speed: 140, name: 'Ember imp', xp: 24, dmg: .95 },
  ashScorpion: { hp: 58, r: 22, speed: 105, name: 'Ash scorpion', xp: 27, dmg: 1.15 },
  magmaHulk: { hp: 140, r: 34, speed: 55, name: 'Magma hulk', xp: 46, dmg: 1.5 },
  bogling: { hp: 34, r: 20, speed: 120, name: 'Bogling', xp: 18, dmg: 1 },
  briarling: { hp: 46, r: 22, speed: 62, name: 'Briarling', xp: 20, dmg: .95 },
  mirecap: { hp: 50, r: 21, speed: 48, name: 'Mirecap', xp: 20, dmg: .95 },
  marshlight: { hp: 34, r: 16, speed: 150, name: 'Marsh light', xp: 20, dmg: .9 },
  snowfang: { hp: 46, r: 22, speed: 180, name: 'Snowfang', xp: 24, dmg: 1.05 },
  rimeling: { hp: 50, r: 22, speed: 62, name: 'Rimeling', xp: 24, dmg: 1 },
  cinderhound: { hp: 52, r: 22, speed: 185, name: 'Cinderhound', xp: 27, dmg: 1.1 },
  pyrewisp: { hp: 40, r: 16, speed: 155, name: 'Pyre wisp', xp: 25, dmg: .95 },
  mossback: { hp: 2600, r: 46, speed: 78, name: 'Mossback', xp: 700, dmg: 1 },
  brambleWarden: { hp: 6500, r: 46, speed: 88, name: 'Bramble Warden', xp: 1100, dmg: 1 },
  hollowStar: { hp: 12000, r: 42, speed: 96, name: 'The Hollow Star', xp: 1800, dmg: 1 },
  cinderTyrant: { hp: 21000, r: 50, speed: 96, name: 'Pyrrhus', xp: 2800, dmg: 1 },
  eclipse: { hp: 42000, r: 60, speed: 92, name: 'Umbra', xp: 5000, dmg: 1 },
  rubble: { hp: 1, r: 110, speed: 0, name: 'Rockfall', xp: 0, dmg: 0 },
  // The depths: stronger than anything in the four lands, and found nowhere else.
  umbralKnight: { hp: 88, r: 24, speed: 100, name: 'Umbral knight', xp: 40, dmg: 1.35 },
  duskwing: { hp: 32, r: 17, speed: 215, name: 'Duskwing', xp: 24, dmg: 1 },
  hollowArcher: { hp: 48, r: 20, speed: 72, name: 'Hollow archer', xp: 32, dmg: 1.1 },
  shardback: { hp: 170, r: 33, speed: 56, name: 'Shardback', xp: 56, dmg: 1.5 },
  acolyte: { hp: 62, r: 20, speed: 112, name: 'Eclipse acolyte', xp: 38, dmg: 1.1 },
  // A fallen star's beast: its health is set by the star (see startStarfall).
  starbeast: { hp: 1, r: 54, speed: 92, name: 'Fallen star', xp: 0, dmg: 1 },
};
/** How much smashing each kind of blocked way takes. Bombs and thunder hit it three times as hard. */
const WALL_HP: Record<string, number> = { rocks: 1800, cave: 3200 };
/** Each land's own creatures fight like a kind from another land (a bogling like a gloomling, a snowfang like a
 *  shadewolf); everything else fights as itself. */
export const ENEMY_AI: Partial<Record<EnemyKind, EnemyKind>> = {
  bogling: 'gloomling', briarling: 'thornling', mirecap: 'sporecap', marshlight: 'wisp',
  snowfang: 'shadewolf', rimeling: 'thornling', cinderhound: 'shadewolf', pyrewisp: 'wisp',
};
const hpMul = (level: number) => 1.5 * (1 + .3 * (level - 1));
/** Damage of one ordinary creature hit at a level, in health points. */
const hitAt = (level: number) => 12 + 5.5 * level;
const BOSS_PATTERNS: Record<string, BossAction[][]> = {
  mossback: [['slam', 'boulders', 'slam', 'boulders'], ['boulders', 'slam', 'charge', 'boulders', 'slam', 'charge']],
  brambleWarden: [['nova', 'roots', 'slam', 'charge'], ['nova', 'charge', 'roots', 'nova', 'slam', 'roots']],
  hollowStar: [['spiral', 'meteors', 'blink', 'nova'], ['meteors', 'spiral', 'blink', 'nova', 'meteors', 'blink']],
  cinderTyrant: [['slam', 'meteors', 'charge', 'nova'], ['meteors', 'charge', 'nova', 'slam', 'boulders', 'charge']],
  starbeast: [['meteors', 'slam', 'spiral', 'charge'], ['meteors', 'nova', 'blink', 'spiral', 'slam', 'meteors']],
  eclipse: [['slam', 'nova', 'boulders', 'roots', 'charge'], ['spiral', 'meteors', 'blink', 'slam', 'nova', 'roots'], ['meteors', 'spiral', 'charge', 'boulders', 'blink', 'nova', 'roots', 'slam']],
};
const SUMMONS: Record<string, EnemyKind[]> = {
  mossback: ['gloomling', 'bristleboar'], brambleWarden: ['briarling', 'shadewolf'], hollowStar: ['wisp', 'frostwraith'], cinderTyrant: ['emberImp', 'ashScorpion'],
  eclipse: ['gloomling', 'bristleboar', 'shadewolf', 'webspinner', 'wisp', 'frostwraith', 'emberImp', 'ashScorpion'],
  // Whatever lives where the star came down (each land's own kin, see localKind).
  starbeast: ['gloomling', 'shadewolf', 'wisp', 'emberImp'],
};
const KILL_COLORS: Partial<Record<EnemyKind, string[]>> = {
  gloomling: ['#8c7ce0', '#c9b6ff', '#ffffff'], thornling: ['#9fd46b', '#e8ffb0', '#5fae4f'], wisp: ['#8ee8ff', '#c9b6ff', '#ffffff'],
  bristleboar: ['#a8744a', '#e8c09a', '#ffffff'], sporecap: ['#b9e27a', '#e0735a', '#fff1b8'], shadewolf: ['#5a5a7a', '#a0a0c8', '#ffffff'],
  webspinner: ['#6a4a7a', '#e8e0f0', '#b6df91'], frostwraith: ['#bfe8ff', '#8ee8ff', '#ffffff'], cragGolem: ['#8a8fa8', '#c8cce0', '#8ee8ff'],
  bogling: ['#5f8a4a', '#b9e27a', '#ffffff'], briarling: ['#8a3a4a', '#e0a0b0', '#4a2a3a'], mirecap: ['#3f9aa0', '#9ff0e8', '#ffffff'], marshlight: ['#9ff0a0', '#d8ffd0', '#ffffff'],
  snowfang: ['#e8f0fa', '#9fb8d8', '#ffffff'], rimeling: ['#bfe8ff', '#ffffff', '#7fb0e0'], cinderhound: ['#3a2a26', '#ff7a3d', '#ffd27a'], pyrewisp: ['#ffb347', '#ff6b3d', '#fff1b8'],
  emberImp: ['#ffb347', '#ff6b3d', '#fff1b8'], ashScorpion: ['#c9a26e', '#8a5a3a', '#ffd27a'], magmaHulk: ['#ff7a3d', '#5a3a30', '#ffd27a'], cinderTyrant: ['#ff9a3d', '#ff5f3d', '#fff1b8', '#3a2a26'],
  eclipse: ['#1a1030', '#c9b6ff', '#ff6b9a', '#ffffff'],
  umbralKnight: ['#2a2438', '#8a7aff', '#ffffff'], duskwing: ['#3a2a4a', '#c98aff', '#ffffff'], hollowArcher: ['#d8d0e8', '#8a7aff', '#2a2438'],
  shardback: ['#c9b6ff', '#8ee8ff', '#ffffff', '#4a3a6a'], acolyte: ['#1a1030', '#ff6b9a', '#c9b6ff'], starbeast: ['#fff1b8', '#ffd35c', '#8ee8ff', '#ffffff'],
};
export const EXPLORE_CELL = 320;
const ACTIVE_RANGE = 1700;
/** Creatures come back this many seconds after being defeated. */
const RESPAWN_TIME = 240;
/** Heroic creatures take longer to come back. */
const HEROIC_RESPAWN = 600;
/** A siege's barricade health, and how long building takes. */
const SIEGE_HP = 100, WORK_TIME = 2.6;
/** A siege on a town is a horde: every wave the quest names comes this many times over (at most SIEGE_MAX at once),
 *  each raider a little frailer and worth less experience than a creature of the wild. */
const SIEGE_HORDE = 2.6, SIEGE_MAX = 20;
/** Places a siege falls on as a whole, and the buildings in them the raiders go for. */
const TOWN_KINDS = new Set(['village', 'city', 'start', 'camp', 'farm']);
const RAID_TARGETS = new Set(['house', 'manor', 'stall', 'tent', 'windmill', 'tower', 'well', 'fountain']);
const SWITCH_COLOR: Record<string, string> = { brazier: '#ffb347', lantern: '#ffe38a', rune: '#9fe8ff', totem: '#b9f29d', vent: '#bfe8ff' };
const BARRIER_TEXT: Record<string, string> = {
  bridge: 'The Gloomwater Bridge lies broken in the river. There is no way across until it is rebuilt.',
  thorns: 'A wall of black thorns chokes the Eastern Gate. Nothing can get through.',
  ice: 'A wall of black ice seals the Eastern Gate. It is colder than any winter.',
  rocks: 'A rockslide has buried Frostspine Pass. Smash through it: strike the rocks, or throw a bomb at them.',
  cave: 'The mouth of the Cindermaw has caved in. Break the rubble to get through the mountain: strike it, or throw a bomb.',
};
const BARRIER_OPEN: Record<string, string> = { bridge: 'The mended bridge creaks cheerfully underfoot.', thorns: 'Only dry, crumbling stalks are left of the thorn wall.', ice: 'Shards of black ice glitter at the roadside, melting slowly.', rocks: 'Broken boulders lie heaped against the canyon walls. The pass is open.', cave: 'Shattered obsidian crunches underfoot. The way through the mountain is open.' };
/** A barrier the hero has to smash (rather than one a quest opens). */
const isWall = (o: WorldObject) => o.variant === 'rocks' || o.variant === 'cave';
const INTRO_LINE: Record<HeroId, string> = {
  mira: '(Tuft tugs at your sleeve. Bridgekeeper Tamsin is waving from the gate. She might know where Master Orrin went.)',
  kael: 'Millbrook Farm… how did I get here? Aldric told me to warn the valley. The farmer is waving me over. Then I find Aldric.',
  lyra: 'Mirror Lake. Nessa ran this road. That fisherman on the shore might have seen her.',
  riven: 'No more jobs. No more feathers. If the Beacon is dead, someone ought to find out why. Might as well be me. That baker keeps staring.',
  wren: 'Easy, Fenn. We’ll find them. Together.',
};
/** Where each hero wakes on the first map, next to whoever gives them their first quest. Mira starts at the Rest. */
const HERO_START: Partial<Record<HeroId, { at: string; npc?: string; dx: number; dy: number }>> = {
  kael: { at: 'meadow:millbrook', npc: 'meadow:bram', dx: 110, dy: 70 },
  lyra: { at: 'meadow:mirror', npc: 'meadow:lou', dx: -40, dy: -110 },
  riven: { at: 'meadow:city', npc: 'meadow:tom', dx: 110, dy: 50 },
  wren: { at: 'meadow:stones', dx: -300, dy: 230 },
};
function startFor(w: WorldDefinition, hero: HeroId): Point {
  const s = HERO_START[hero]; if (!s) return { ...w.spawn };
  const base = (s.npc && w.npcs.find(n => n.id === s.npc)) || w.pois.find(p => p.id === s.at);
  return base ? { x: base.x + s.dx, y: base.y + s.dy } : { ...w.spawn };
}
/** Creatures this close to a hero's own start are no stronger than those around the Rest, so no hero starts among harder foes. */
const START_SAFE = 2800;
/** No creature lives this close to where a hero wakes, so every adventure begins in peace. */
const START_CALM = 1050;
/** Extra animals in every herd beyond the number the quest asks for. */
const HERD_SPARE = 2;
/** Consumables a quest can pay out (the rare feather is left to luck and merchants). */
const QUEST_ITEMS = ITEM_ORDER.filter(id => id !== 'phoenixFeather');

export class GameEngine {
  readonly practice: boolean;
  readonly world: WorldDefinition;
  readonly hero: Hero;
  readonly profile: Profile;
  readonly enemies: Enemy[];
  readonly npcs: Npc[];
  readonly critters: Critter[];
  readonly pods: Pod[];
  readonly obstacleGrid: Grid<Obstacle>;
  readonly roads: RoadIndex;
  readonly projectiles: Projectile[] = [];
  readonly hazards: Hazard[] = [];
  readonly particles: Particle[] = [];
  readonly orbs: Orb[] = [];
  readonly floating: FloatText[] = [];
  readonly afterimages: Afterimage[] = [];
  readonly slashes: Slash[] = [];
  readonly marks: Mark[] = [];
  readonly storms: Storm[] = [];
  readonly wells: Well[] = [];
  /** Riven: seconds left of Stealth, and whether the next stab is a sure critical hit (after a Shadowstep). */
  stealthT = 0; nextCrit = false;
  /** Wren: Fenn and any spirit wolves, seconds left of Howl of the Pack, and what Fenn has been told to do. */
  readonly pets: Pet[] = [];
  wildT = 0; petMode: PetMode = 'attack';
  /** Seconds until Fenn can pounce again when he is sent in. */
  private pounceCd = 0;
  /** When the hero last struck or was struck: no mount can be called for a few seconds after. */
  private fightT = -99;
  /** The creature Wren last shot at: Fenn goes for it. */
  private petFocus: Enemy | null = null;
  /** True while riding; `mountFx` fades the mount in (0 → 1). */
  riding = false; mountFx = 0;
  /** Newly earned mounts and trails are announced once the achievement pop-up has gone. */
  private news: Array<{ text: string; short: string; t: number }> = [];
  readonly heroId: HeroId;
  /** This hero's abilities, in button order. */
  readonly spellIds: SpellId[];
  private chargeHit = new Set<Enemy>();
  readonly main: MainQuest = { keys: [], bosses: [], finales: [] };
  readonly quests = new Map<string, QuestState>();
  readonly got = new Set<string>();
  readonly opened = new Set<string>();
  readonly read = new Set<string>();
  readonly discovered = new Set<string>();
  readonly secrets = new Set<string>();
  readonly explored: Uint8Array;
  readonly exploreCols: number;
  exploredVersion = 0;
  moveX = 0; moveY = 0; elapsed = 0; defeated = 0;
  shake = 0; hitStop = 0; slowMo = 0; damageFlash = 0; respawnFade = 0; flash = 0;
  /** A spell being cast (Mira's and Lyra's bolts and big spells): it goes off when `t` reaches `dur`. A tap on the
   *  same bolt while it is being cast (or a held key) casts it again right after. */
  casting: { id: SpellId; t: number; dur: number; again: boolean } | null = null;
  /** When the last hit-stop began, in play time. */
  private frozeAt = -99;
  /**
   * A hit-stop: the world holds still for a moment on a big hit. In a crowd these came several times a second and the
   * fight played in slow motion, so there is at most one every .35 s of play, half as long when many creatures fight.
   */
  private freeze(t: number) {
    if (this.elapsed - this.frozeAt < .35) return;
    this.frozeAt = this.elapsed;
    this.hitStop = Math.max(this.hitStop, this.combat > .6 ? t * .5 : t);
  }
  combo = 0; comboTime = 0; combat = 0; tracked: string | null = null;
  /** 0…1, rises quickly while a hostile creature is close: drives the red screen edge. */
  danger = 0;
  /** Seconds left on each potion effect. */
  readonly buffs: Partial<Record<ItemId, number>> = {};
  /** Effect density set by the graphics quality (1 = full). */
  fx = 1;
  /** Set when a chapter ends, until the player moves on from the victory screen. */
  awaitingChapter = false;
  private eventHandler: (event: EngineEvent) => void;
  private checkpoint: Point;
  private bossIntroShown = new Set<string>();
  private zoneName = '';
  private regionId: RegionId;
  private completeTimer = 0;
  private completeRegion: RegionId = 'meadow';
  private fireworkTimer = 0;
  private summonCount = 0;
  private sealedNoticeT = 0;
  private clearThreats = false;
  private slowTick = 0;
  private stepPhase = 0;
  private blessed = new Set<string>();
  private wellT = new Map<string, number>();
  private globalBarkT = 0;
  private questById: Map<string, QuestDef>;
  private campfires: WorldObject[];
  private chapterStart = { elapsed: 0, defeated: 0 };
  private foxQueue: string[] = [];
  /** Counts down while Umbra gathers itself out of the four lands. */
  private finalT = 0;
  private profileDirty = false;
  private markerVersion = 0;
  private markerCache = new Map<string, { mark: '!' | '?'; main: boolean } | null>();
  private markerCacheVersion = -1;
  /** What "every place", "every chest" and the like mean for the achievements. */
  private totals: Totals;
  /** True while a guardian fight goes on without the hero falling (for the Untouchable achievement). */
  private cleanFight = false;
  private exploreTick = 0;
  /** Seconds to wait before the next chapter's opener, so it starts after the chapter banner. */
  private foxDelay = 0;
  /** The cutscene playing, and those waiting. `cineFocus` is where the camera looks; `camCut` changes on every hard cut. */
  cine: Cine | null = null; private cineQueue: Array<{ id: string; ctx: Record<string, Point>; then?: () => void }> = [];
  cineFocus: Point | null = null; camCut = 0; cineFade = 0;
  /** How dark a story scene makes the world (0 = as it is). */
  cineDark = 0; private cineNight = 0;
  readonly meteors: Meteor[] = []; readonly fires: Fire[] = [];
  /** A siege under way, and something being built. */
  siege: Siege | null = null; private siegeCd = 0;
  work: { o: WorldObject; q: QuestDef; t: number } | null = null;
  private ambushes: Array<{ q: string; x: number; y: number; done: boolean }> = [];
  private choices: Record<string, 'a' | 'b'> = {};
  private abandoned = new Set<string>();
  /** A light shown burning during a cutscene of the night it went out. */
  cineLit: RegionId | null = null;
  private introSeen = false; private barrierNoticeT = -99; private barriers: WorldObject[] = [];
  /** A fallen star in the valley (see Starfall events), and seconds of play until the sky may drop the next one. */
  fallen: Starfall | null = null; private starfallT = rand(600, 1200); private starfalls = 0;
  /** A streak across the sky the moment a star falls (for the renderer): seconds left, and which way it fell. */
  skyStar = { t: 0, dx: 1 };
  /** Umbra's echo has been beaten on this descent; the next Umbra to rise is only its echo. */
  private echoBeaten = false; private finalEcho = false;

  constructor(heroId: HeroId, onEvent: (event: EngineEvent) => void, saved?: EngineSave | null, practice = false) {
    this.practice = practice;
    this.heroId = heroId; this.spellIds = HEROES[heroId].spells;
    const base = getWorld(), quests = questsForHero(base.quests, heroId);
    const practiceSeeds: EnemySeed[] = [
      { id: 'practice:one', kind: 'gloomling', x: 900, y: 900, level: 1, region: 'meadow' },
      { id: 'practice:two', kind: 'gloomling', x: 1120, y: 900, level: 1, region: 'meadow' },
      { id: 'practice:three', kind: 'gloomling', x: 1340, y: 900, level: 1, region: 'meadow' },
    ];
    const practiceWorld: WorldDefinition = {
      ...base, width: 2400, height: 1800, spawn: { x: 650, y: 900 }, enemies: practiceSeeds,
      obstacles: base.obstacles.filter(o => o.x < 2400 && o.y < 1800), decor: base.decor.filter(o => o.x < 2400 && o.y < 1800), ponds: base.ponds.filter(o => o.x < 2400 && o.y < 1800),
      npcs: [], critters: [], pods: [], objects: [], quests: [], pois: [], roads: [], rivers: [],
    };
    this.world = practice ? practiceWorld : { ...base, ...worldForHero(base, heroId, quests), spawn: startFor(base, heroId), quests }; this.eventHandler = onEvent; this.checkpoint = { ...this.world.spawn };
    this.profile = practice ? practiceProfile(heroId) : loadProfile(heroId);
    const cds = Object.fromEntries(Object.keys(SPELLS).map(s => [s, 0])) as Record<SpellId, number>;
    const p = this.profile;
    this.hero = { x: this.world.spawn.x, y: this.world.spawn.y, vx: 0, vy: 0, hp: healthAt(p), maxHp: healthAt(p), mana: manaAt(p), maxMana: manaAt(p), manaRegen: regenAt(p), faceX: 1, faceY: 0, cds, shieldTime: 0, hurtTime: 0, walkTime: 0, dashTime: 0, dashX: 0, dashY: 0, castTime: 0, slowT: 0, stormT: 0, stormTick: 0, charging: false, ghostT: 0, iceT: 0, orbitT: 0, orbitN: 0, orbitTick: 0 };
    if (practice) { this.hero.maxMana = 240; this.hero.mana = 240; this.hero.manaRegen = 240; }
    this.obstacleGrid = new Grid(256, this.world.obstacles);
    this.collide(this.world.spawn, 34); this.hero.x = this.world.spawn.x; this.hero.y = this.world.spawn.y; this.checkpoint = { ...this.world.spawn };
    this.roads = new RoadIndex(this.world.roads);
    this.enemies = this.world.enemies.map(seed => this.makeEnemy(this.nearStart(seed, base.spawn)));
    if (!practice) this.calmStart();
    this.pods = this.world.pods.map((pt, id) => ({ id, x: pt.x, y: pt.y, dead: false, hitT: 0 }));
    this.npcs = this.world.npcs.map(n => ({ ...n, homeX: n.x, homeY: n.y, tx: n.x, ty: n.y, moving: false, faceX: 1, waitT: rand(0, 3), routeI: 0, routeDir: 1, workT: rand(0, 2), bark: '', barkT: 0, barkCd: rand(2, 8), walkT: 0, poiName: this.poiAt(n)?.name || this.regionAt(n.x).name }));
    this.critters = this.world.critters.map(c => ({ ...c, homeX: c.x, homeY: c.y, tx: c.x, ty: c.y, state: 'idle', t: rand(0, 3), face: 1, alt: 0, hop: 0, seed: Math.random() }));
    this.questById = new Map(this.world.quests.map(q => [q.id, q]));
    for (const q of this.world.quests) this.quests.set(q.id, { status: q.requires ? 'locked' : 'available', progress: 0 });
    this.campfires = this.world.objects.filter(o => o.kind === 'campfire');
    this.barriers = this.world.objects.filter(o => o.kind === 'barrier');
    this.exploreCols = Math.ceil(this.world.width / EXPLORE_CELL);
    this.explored = new Uint8Array(this.exploreCols * Math.ceil(this.world.height / EXPLORE_CELL));
    this.totals = { places: this.world.pois.length, chests: this.world.objects.filter(o => o.kind === 'chest').length, lore: this.world.objects.filter(o => o.kind === 'lore').length, sideQuests: this.world.quests.filter(q => !q.main).length, secrets: this.world.objects.filter(o => o.kind === 'crack' || o.kind === 'waterfall').length };
    if (saved?.version === 4) this.restore(saved);
    else for (const q of this.world.quests) if (q.giver === 'fox' && this.qs(q.id).status === 'available') this.foxQueue.push(q.id);
    if (!practice) this.raiseWalls();
    if (this.inDepths) this.resetDepths();
    this.restoreQuestPeople(saved);
    this.regionId = this.regionAt(this.hero.x).id;
    if (heroId === 'wren') this.pets.push(this.makePet(false));
    this.markExplored();
    this.syncAchievements();
    ambience.start(this.regionId);
  }
  dispose() { ambience.stop(); if (this.profileDirty && !this.practice) saveProfile(this.profile); }
  /** Writes the hero's profile (gold, counts, achievements) now, if it changed: a phone may close the game unseen. */
  saveProfileNow() { if (this.profileDirty && !this.practice) { saveProfile(this.profile); this.profileDirty = false; } }

  private nearStart(s: EnemySeed, rest: Point): EnemySeed {
    const r = this.world.regions[0]; if (s.boss || s.region !== r.id || !HERO_START[this.heroId]) return s;
    const d = dist(s, this.world.spawn); if (d > START_SAFE) return s;
    const [lo, hi] = r.levels, cap = Math.max(lo, lo + Math.round((hi - lo) * Math.max(d, dist(s, rest) * .35) / 9000) + (s.elite ? 1 : 0));
    return s.level > cap ? { ...s, level: cap } : s;
  }
  /** Creatures that would wander around the hero's own start move out past `START_CALM`, away from it. */
  private calmStart() {
    const s = this.world.spawn;
    for (const e of this.enemies) {
      if (e.boss || Math.abs(e.x - s.x) > START_CALM || Math.abs(e.y - s.y) > START_CALM) continue;
      const d = dist(e, s); if (d >= START_CALM) continue;
      let a = d > 1 ? Math.atan2(e.y - s.y, e.x - s.x) : rand(0, 6.28);
      const p = { x: 0, y: 0 };
      // Try the straight way out first, then turn a little at a time until the spot is dry and open.
      for (let i = 0; i < 24; i++) {
        const r = START_CALM + 60 + (i % 3) * 70;
        p.x = clamp(s.x + Math.cos(a) * r, 80, this.world.width - 80); p.y = clamp(s.y + Math.sin(a) * r, 80, this.world.height - 80);
        this.collide(p, e.r);
        if (!inPond(this.world.ponds, p.x, p.y, e.r) && dist(p, s) >= START_CALM) break;
        a += (i % 2 ? 1 : -1) * (.35 + i * .1);
      }
      e.x = e.homeX = e.wanderX = p.x; e.y = e.homeY = e.wanderY = p.y;
    }
  }
  /**
   * The rockfall in Frostspine Pass and the caved-in mouth of the Cindermaw: each is a body with health standing in the
   * way, until it is smashed. A save already past one (from before they existed) counts it as broken.
   */
  private raiseWalls() {
    for (const o of this.barriers) {
      if (!isWall(o)) continue;
      if (this.hero.x > o.x + 100 && Math.abs(this.hero.x - o.x) < 30000) this.got.add(o.id);
      if (this.got.has(o.id)) continue;
      const reg = this.region(o.region);
      this.enemies.push(this.makeEnemy({ id: `wall:${o.id}`, kind: 'rubble', x: o.x, y: o.y, level: reg.levels[1], region: o.region, wall: o.id }));
      this.wallSide.set(o.id, Math.sign(this.hero.x - o.x) || -1);
    }
  }
  /** The body of a barrier that has to be smashed, while it stands. */
  wallOf(id: string) { return this.enemies.find(e => e.wall === id && !e.dead) || null; }
  /** A wall can be struck once whatever stands before it (the thorns, the black ice) is gone. */
  private wallReady(e: Enemy) { const before = this.barriers.find(b => b.id === `${e.region}:barrier`); return !before || this.barrierOpen(before); }
  private breakWall(e: Enemy) {
    const o = this.barriers.find(b => b.id === e.wall); this.got.add(e.wall!);
    const cave = o?.variant === 'cave', reg = this.region(e.region);
    this.emit(e.x, e.y - 40, 90, cave ? ['#2a2028', '#4a3a3e', '#ff7a3d', '#ffd27a'] : ['#8d93ad', '#c8cce0', '#ffffff', '#6f7493'], { speed: 520, life: 1.3, kind: 'shard', size: 9, grav: 520 });
    this.emit(e.x, e.y, 30, cave ? 'rgba(60,44,40,.6)' : 'rgba(225,232,248,.6)', { speed: 220, life: 1.8, kind: 'smoke', size: 30 });
    this.ring(e.x, e.y, 320, cave ? '#ff9a3d' : '#dfe8ff', 1); this.flash = Math.max(this.flash, .5); this.addShake(22); this.slowMo = Math.max(this.slowMo, .5);
    this.play('slam'); this.play('boom');
    this.gainXp(160 * reg.xpScale, e.x, e.y);
    this.notice(cave ? 'The cave mouth bursts open! The way through the mountain is clear.' : 'The rockfall shatters! Frostspine Pass is open.', 'epic', 'The way is open!');
    this.touchQuests();
  }
  private makeEnemy(seed: EnemySeed, summoned = false): Enemy {
    // A creature called into a land it doesn't live in comes as that land's own kin.
    if (!seed.boss && !this.practice) { const k = localKind(seed.kind, seed.region); if (k !== seed.kind) seed = { ...seed, kind: k }; }
    const s = ENEMY_STATS[seed.kind];
    const wall = seed.wall ? this.world.objects.find(o => o.id === seed.wall) : null;
    const hp = wall ? WALL_HP[wall.variant || 'rocks'] || 2000 : seed.boss ? s.hp : Math.round(s.hp * hpMul(seed.level) * (seed.heroic ? 9 : seed.elite ? 2.6 : 1));
    const star = seed.starborn ? 1.7 : 1;
    return { ...seed, heroT: rand(3, 5), enraged: false, hp: Math.round(hp * star), maxHp: Math.round(hp * star), r: s.r * (seed.heroic ? 1.6 : seed.elite ? 1.3 : 1) * (seed.starborn ? 1.12 : 1), dead: false, deadT: 0, cd: rand(1, 2.5), windup: 0, hitFlash: 0, kx: 0, ky: 0, homeX: seed.x, homeY: seed.y, wanderX: seed.x, wanderY: seed.y, wanderT: rand(0, 3), aggro: summoned, spawnT: summoned ? .6 : 0, phase: 1, action: null, actionT: 0, actionStep: 0, pattern: 0, summons: 0, chargeX: 0, chargeY: 0, lunge: 0, angle: rand(0, 6.28), summoned, rage: 0, stunT: 0, blinkT: rand(3, 6), chillT: 0, frozenT: 0, burrowT: 0, ai: ENEMY_AI[seed.kind] || seed.kind };
  }
  setEventHandler(handler: (event: EngineEvent) => void) { this.eventHandler = handler; }

  private restore(s: EngineSave) {
    const ok = (p: Point) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
    if (ok(s.hero)) { const B = this.boundsOf(s.hero); this.hero.x = clamp(s.hero.x, B.x0 + 30, B.x1 - 30); this.hero.y = clamp(s.hero.y, B.y0 + 30, B.y1 - 30); }
    if (Number.isFinite(s.starfallT)) this.starfallT = clamp(Number(s.starfallT), 30, 1200);
    this.hero.hp = clamp(Number(s.hero.hp) || this.hero.maxHp, 1, this.hero.maxHp);
    this.hero.mana = clamp(Number(s.hero.mana) || 0, 0, this.hero.maxMana);
    this.checkpoint = ok(s.checkpoint) ? { ...s.checkpoint } : { ...this.world.spawn };
    if (s.main) { this.main.keys = [...(s.main.keys || [])]; this.main.bosses = [...(s.main.bosses || [])]; this.main.finales = [...(s.main.finales || [])]; }
    for (const [id, st] of Object.entries(s.quests || {})) if (this.quests.has(id) && st?.status) this.quests.set(id, { status: st.status, progress: Number(st.progress) || 0 });
    for (const [set, list] of [[this.got, s.got], [this.opened, s.opened], [this.read, s.read], [this.discovered, s.discovered], [this.blessed, s.blessed], [this.secrets, s.secrets]] as Array<[Set<string>, string[] | undefined]>) if (Array.isArray(list)) for (const v of list) set.add(v);
    if (typeof s.explored === 'string') {
      // Saves from before the Ember Wastes were laid out 92 cells wide; copy them row by row into today's wider grid.
      const cols = Number(s.exploreCols) || 92, rows = this.explored.length / this.exploreCols;
      for (let y = 0; y < rows; y++) for (let x = 0; x < Math.min(cols, this.exploreCols); x++) if (s.explored.charCodeAt(y * cols + x) === 49) this.explored[y * this.exploreCols + x] = 1;
    }
    this.exploredVersion++;
    this.elapsed = Number(s.elapsed) || 0; this.defeated = Number(s.defeated) || 0;
    this.tracked = typeof s.tracked === 'string' && this.quests.has(s.tracked) ? s.tracked : null;
    if (s.chapterStart) this.chapterStart = { elapsed: Number(s.chapterStart.elapsed) || 0, defeated: Number(s.chapterStart.defeated) || 0 };
    // There is no chapter-complete screen any more: the story carries straight on. Older saves that were left waiting on
    // that screen (the "next chapter quest has no arrow" bug) are freed here, and any chapter opener that was never
    // started is queued again so it begins on its own.
    this.awaitingChapter = false;
    this.introSeen = true;
    if (s.choices && typeof s.choices === 'object') for (const [k, v] of Object.entries(s.choices)) if (v === 'a' || v === 'b') this.choices[k] = v;
    this.catchUpStory();
    this.repairChain();
    this.foxQueue = Array.isArray(s.foxQueue) ? s.foxQueue.filter(id => this.quests.has(id)) : [];
    if (Array.isArray(s.abandoned)) for (const id of s.abandoned) if (this.quests.get(id)?.status === 'available') this.abandoned.add(id);
    for (const q of this.world.quests) if (q.giver === 'fox' && this.qs(q.id).status === 'available' && !this.foxQueue.includes(q.id)) this.foxQueue.push(q.id);
    const broken = new Set(Array.isArray(s.brokenPods) ? s.brokenPods : []);
    for (const p of this.pods) if (broken.has(p.id)) p.dead = true;
    for (const e of this.enemies) if (e.boss && this.main.bosses.includes(e.id)) { e.dead = true; e.hp = 0; }
    // Creatures still waiting to come back. The clock keeps running while the game is closed.
    if (s.slain && typeof s.slain === 'object') {
      const now = Date.now();
      for (const e of this.enemies) {
        const at = Number(s.slain[e.id]); if (e.boss || !Number.isFinite(at)) continue;
        const gone = Math.max(0, (now - at) / 1000);
        if (gone < (e.heroic ? HEROIC_RESPAWN : RESPAWN_TIME)) { e.dead = true; e.hp = 0; e.deadT = gone; }
      }
    }
    for (const q of this.world.quests) if (q.kind === 'rescue' && this.qs(q.id).status === 'active') this.spawnGuards(q);
  }
  /**
   * The story grew new quests between old ones. A save that is already past such a quest counts it as done; one that
   * reached it just now gets it offered. Quests whose goal changed shape are handed in if the old progress covers it.
   */
  /**
   * A save made before a hero's story was rewritten: whatever of the main story lies before the furthest point it
   * reached, or in a land the hero has already left behind, counts as done, so the story picks up where they are.
   */
  private catchUpStory() {
    const mains = this.world.quests.filter(q => q.main), here = this.world.regions.findIndex(r => r.id === this.regionAt(this.hero.x).id);
    const order = this.world.regions.map(r => r.id);
    let last = -1; mains.forEach((q, i) => { if (this.qs(q.id).status !== 'locked' && this.qs(q.id).status !== 'available') last = i; });
    mains.forEach((q, i) => {
      const st = this.qs(q.id); if (st.status !== 'locked' && st.status !== 'available') return;
      if (i < last || order.indexOf(q.region) < here) {
        st.status = 'done'; st.progress = q.count;
        // Its relic counts as found, or the land's guardian would stay sealed.
        if (q.kind === 'key') for (const k of q.keys || []) if (this.keysFound(q.region) < 3 && !this.main.keys.includes(this.keyId(q, k))) this.main.keys.push(this.keyId(q, k));
      }
    });
  }
  private repairChain() {
    for (let changed = true; changed;) {
      changed = false;
      for (const q of this.world.quests) {
        const st = this.qs(q.id);
        if (st.status !== 'locked' || !q.requires || this.quests.get(q.requires)?.status !== 'done') continue;
        const passed = this.world.quests.some(o => o.requires === q.id && this.qs(o.id).status !== 'locked');
        st.status = passed ? 'done' : 'available'; changed = true;
      }
    }
    for (const q of this.world.quests) { const st = this.qs(q.id); if (st.status === 'active' && q.kind !== 'boss' && q.kind !== 'build' && st.progress >= q.count) st.status = 'ready'; }
  }
  /** People walking with the hero, thieves on the run and herds to drive come back with a loaded game. */
  private restoreQuestPeople(saved?: EngineSave | null) {
    for (const q of this.world.quests) {
      const st = this.qs(q.id); if (st.status !== 'active') continue;
      const cage = this.world.objects.find(o => o.kind === 'cage' && o.questId === q.id);
      if (q.kind === 'escort' || (q.kind === 'rescue' && q.escort && cage && this.got.has(cage.id))) {
        const pos = saved?.escorts?.find(e => e.id === q.id) || (q.kind === 'escort' ? this.escortStart(q) : cage && { x: cage.x, y: cage.y + 40 });
        if (pos) this.spawnFollower(q, pos);
      }
      if (q.kind === 'chase') this.spawnThief(q);
      if (q.kind === 'herd') this.spawnHerd(q);
      if (q.kind === 'defend') st.progress = 0;
    }
  }
  private escortStart(q: QuestDef): Point {
    const p = this.poi(q.from); if (p) return { x: p.x + 40, y: p.y + 70 };
    const g = this.npcs.find(n => n.id === q.giver); return g ? { x: g.x + 50, y: g.y + 30 } : { x: this.hero.x + 60, y: this.hero.y };
  }
  exportSave(): EngineSave {
    const h = this.hero;
    let explored = ''; for (const v of this.explored) explored += v ? '1' : '0';
    return {
      version: 4, hero: { x: h.x, y: h.y, hp: h.hp, mana: h.mana }, main: { keys: [...this.main.keys], bosses: [...this.main.bosses], finales: [...this.main.finales] }, quests: Object.fromEntries(this.quests),
      got: [...this.got], opened: [...this.opened], read: [...this.read], discovered: [...this.discovered], explored,
      brokenPods: this.pods.filter(p => p.dead).map(p => p.id), checkpoint: { ...this.checkpoint }, elapsed: this.elapsed, defeated: this.defeated, blessed: [...this.blessed], secrets: [...this.secrets], tracked: this.tracked,
      chapterStart: { ...this.chapterStart }, awaiting: false, foxQueue: [...this.foxQueue], exploreCols: this.exploreCols,
      slain: this.slainNow(), starfallT: Math.round(this.starfallT),
      choices: { ...this.choices }, abandoned: [...this.abandoned], escorts: this.npcs.filter(n => n.role === 'follower' && n.quest).map(n => ({ id: n.quest!, x: n.x, y: n.y })),
    };
  }

  /** Ordinary creatures lying defeated, and when they fell in real time. */
  private slainNow() {
    const now = Date.now(), out: Record<string, number> = {};
    for (const e of this.enemies) if (e.dead && !e.boss && !e.summoned && !e.guard && !e.cineOnly && !e.wall && !e.starborn) out[e.id] = Math.round(now - e.deadT * 1000);
    return out;
  }
  // ───────────────────────────── helpers
  private persistProfile(profile: Profile) { if (!this.practice) saveProfile(profile); }
  private notice(text: string, tone: NoticeTone = 'info', short?: string) { this.eventHandler({ type: 'notice', text, tone, short }); }
  /** The story is written for Mira; other heroes get their own name in it, and travel without Tuft the fox. */
  private personal(lines: string[]) { return lines.map(l => personalize(l, this.heroId)); }
  /** Who speaks the story's nudges between quests: Tuft for Mira, Kael's own thoughts for Kael. */
  get guideVoice() { return this.heroId === 'mira' ? { name: 'Tuft', portrait: '🦊' } : { name: HEROES[this.heroId].name, portrait: `hero:${this.heroId}` }; }
  get hasPet() { return this.heroId === 'mira'; }
  private say(speaker: string, portrait: string, lines: string[], then?: 'complete') { if (!lines.length) return; sfx.play('talk'); this.eventHandler({ type: 'dialogue', speaker, portrait, lines: this.personal(lines), then }); }
  private play(s: Sfx, pos?: Point) { sfx.play(s, pos); }
  regionAt(x: number): Region { const r = this.world.regions; return r[clamp(Math.floor(x / REGION_W), 0, r.length - 1)]; }
  region(id: RegionId) { return this.world.regions.find(r => r.id === id)!; }
  get heroRegion() { return this.regionAt(this.hero.x); }
  /** The story chapter being played: the first region whose light is not yet restored. */
  get chapter() { const q = this.currentMain(); return q ? this.region(q.region).chapter : this.world.regions.length; }
  /** This hero's own version of a guardian (its name, looks and attacks), when they meet a different one from Mira. */
  bossVariant(e: Enemy): BossVariant | null { return e.boss ? bossVariant(this.heroId, e.kind) : null; }
  private bossName(e: Enemy): string { if (e.kind === 'starbeast') return this.fallen?.name || 'The Fallen Star'; const v = this.bossVariant(e); const s = this.region(e.region).script, name = v ? v.name : e.kind === 'eclipse' ? s.final?.name || 'Umbra' : s.bossName; return e.id === ECHO_ID ? `Echo of ${name}` : name; }
  private bossTitle(e: Enemy) { if (e.kind === 'starbeast') return 'Fallen from the stars'; if (e.id === ECHO_ID) return 'What is left in the dark'; const v = this.bossVariant(e); if (v) return v.title; const s = this.region(e.region).script; return e.kind === 'eclipse' ? s.final?.title || '' : s.bossTitle; }
  private bossPatterns(e: Enemy) { return this.bossVariant(e)?.patterns || BOSS_PATTERNS[e.kind]; }
  private bossShot(e: Enemy): BossShot { const v = this.bossVariant(e); return v ? v.shot : e.kind === 'hollowStar' || e.kind === 'starbeast' ? 'void' : e.kind === 'cinderTyrant' ? 'fire' : 'thorn'; }
  /** The colours of a guardian's sparks and rings. */
  private bossColors(e: Enemy) {
    const v = this.bossVariant(e); if (v) return [v.look.glow, v.look.trim, v.look.eye];
    return e.kind === 'starbeast' ? ['#fff1b8', '#ffd35c', '#8ee8ff'] : e.kind === 'eclipse' ? ['#1a1030', '#c9b6ff', '#ff6b9a'] : e.kind === 'hollowStar' ? ['#c9b6ff', '#6a4bd6'] : e.kind === 'cinderTyrant' ? ['#ff9a3d', '#ff5f3d', '#ffd27a'] : e.kind === 'brambleWarden' ? ['#b6df91', '#ff8f7a'] : ['#a3c46a', '#e8ffb0'];
  }
  /** Guardians that float instead of walking. */
  private bossFloats(e: Enemy) { const f = this.bossVariant(e)?.look.form; return f ? f === 'wraith' || f === 'mask' || f === 'eclipse' : e.kind === 'hollowStar' || e.kind === 'eclipse'; }
  private bossQuest(e: Enemy) { return this.world.quests.find(q => q.kind === 'boss' && q.boss === e.id) || null; }
  /** A guardian can be fought once its quest has been accepted. */
  bossUnlocked(e: Enemy) { const q = this.bossQuest(e); if (!q) return true; const st = this.qs(q.id).status; return st === 'active' || st === 'done'; }
  private canHurt(e: Enemy) { return e.wall ? this.wallReady(e) : !e.boss || this.bossUnlocked(e); }
  keysFound(region: RegionId) { return this.main.keys.filter(k => k.startsWith(`${region}:`)).length; }
  spellUnlocked(id: SpellId) { return this.practice || this.profile.level >= SPELLS[id].level; }
  get power() { return powerAt(this.profile) * (this.buffs.powerElixir ? 1.35 : 1) * (this.buffs.giantBrew ? 1.4 : 1); }
  /** Damage multiplier of one ability: overall power times its upgrade stars. */
  private sp(id: SpellId) { const u = SPELL_UPGRADES[id]; return this.power * (u.stat === 'damage' ? 1 + starsOf(this.profile, id) * u.per / 100 : 1); }
  /** An ability's damage: its base from the spell table times spell power and its stars. */
  private dmg(id: SpellId) { return (SPELLS[id].dmg || 0) * this.sp(id); }
  cooldownOf(id: SpellId) { const u = SPELL_UPGRADES[id]; return SPELLS[id].cooldown * (u.stat === 'cooldown' ? 1 - starsOf(this.profile, id) * u.per / 100 : 1); }
  private durationOf(id: SpellId, base: number) { const u = SPELL_UPGRADES[id]; return base * (u.stat === 'duration' ? 1 + starsOf(this.profile, id) * u.per / 100 : 1); }
  get critChance() { return .15 + gearOf(this.profile).crit / 100; }
  get moveSpeed() { return (this.buffs.swiftTonic ? 1.4 : 1) * (1 + gearOf(this.profile).speed / 100) * (this.buffs.giantBrew ? .9 : 1); }
  /** How big the hero is drawn: Giant's Brew makes them huge. */
  get heroScale() { const t = this.buffs.giantBrew; return t === undefined ? 1 : 1 + .45 * Math.min(1, t * 2, (ITEMS.giantBrew.duration - t) * 3 + .01); }
  /** The music the moment calls for: Umbra's own theme, a guardian's fight, a siege, or the land's song. */
  get musicTrack(): 'finale' | 'boss' | 'siege' | 'depths' | RegionId {
    if (this.finalT > 0 || this.enemies.some(e => e.kind === 'eclipse' && !e.dead && e.aggro)) return 'finale';
    if (this.bossFight) return 'boss';
    if (this.siege) return 'siege';
    if (this.inDepths) return 'depths';
    return this.regionId;
  }
  /** In the depths beneath the Dawn Forge. */
  get inDepths() { return inDepthsArea(this.world.depths, this.hero); }
  /** The space a point lives in: the valley, or the depths beside it. */
  boundsOf(p: Point) { const dp = this.world.depths; return dp && p.x > this.world.width + 400 ? { x0: dp.x0, y0: dp.y0, x1: dp.x1, y1: dp.y1 } : { x0: 0, y0: 0, x1: this.world.width, y1: this.world.height }; }
  get bossFight() { return this.enemies.some(e => e.boss && !e.dead && e.aggro && this.canHurt(e)); }
  get regionTrack() { return this.regionId; }
  addShake(n: number) { this.shake = Math.min(22, this.shake + n); }
  poiAt(p: Point, pad = 0): Poi | null { let best: Poi | null = null, bd = Infinity; for (const z of this.world.pois) { const d = dist(p, z); if (d < z.r + pad && d < bd) { bd = d; best = z; } } return best; }
  npcVisible(n: Npc) {
    if (n.hero && n.hero !== this.heroId) return false;
    if (n.after && this.quests.get(n.after)?.status !== 'done') return false;
    if (n.until) { const s = this.quests.get(n.until)?.status; if (s && s !== 'locked' && s !== 'available') return false; }
    return true;
  }
  /** A quest's lines, in this hero's own version where it has one. */
  private tx(q: QuestDef) { const o = q.textFor?.[this.heroId]; return o ? { ...q.text, ...o } : q.text; }
  /** Hero damage against a creature: weaker the higher it is above Mira's level. */
  private dealMul(level: number) { const d = level - this.profile.level; return d > 0 ? Math.max(.3, 1 - d * .1) : 1 + Math.min(.3, -d * .04); }
  /** Damage Mira takes from a creature of this level. */
  private takeMul(level: number) { const d = level - this.profile.level; return d > 0 ? 1 + d * .15 : Math.max(.6, 1 + d * .06); }

  emit(x: number, y: number, count: number, color: string | string[], o: Partial<Particle> & { speed?: number; spread?: number; angle?: number } = {}) {
    const speed = o.speed ?? 160, spread = o.spread ?? Math.PI * 2, base = o.angle ?? 0;
    // Below full detail bursts are thinner and fewer sparks live at once: in a big fight they are what piles up.
    const k = this.fx >= 1 ? 1 : this.fx * this.fx;
    count = k < 1 ? Math.floor(count * k + Math.random()) : count;
    const cap = this.fx >= 1 ? 900 : 540 * k;
    for (let i = 0; i < count && this.particles.length < cap; i++) {
      const a = base + (Math.random() - .5) * spread, v = speed * rand(.35, 1), life = (o.life ?? .7) * rand(.6, 1.2);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: (o.size ?? 4) * rand(.6, 1.3), color: Array.isArray(color) ? pick(color) : color, kind: o.kind ?? 'dot', rot: Math.random() * 6.28, vr: rand(-8, 8), grav: o.grav ?? 0, drag: o.drag ?? 2.5, glow: o.glow ?? false });
    }
  }
  private ring(x: number, y: number, size: number, color: string, life = .45) { this.particles.push({ x, y, vx: 0, vy: 0, life, max: life, size, color, kind: 'ring', rot: 0, vr: 0, grav: 0, drag: 0, glow: true }); }
  private text(x: number, y: number, text: string, color: string, size = 16) { this.floating.push({ x: x + rand(-8, 8), y, text, life: .9, max: .9, color, size }); }

  // ───────────────────────────── achievements
  private bump(stat: string, by = 1) { const n = this.profile.ach.n; n[stat] = (n[stat] || 0) + by; this.profileDirty = true; this.checkAch(stat); }
  /** For counters that are a best-so-far (level, gold carried, biggest combo…). */
  private statMax(stat: string, v: number, silent = false) { const n = this.profile.ach.n; if ((n[stat] || 0) >= v) return; n[stat] = v; this.profileDirty = true; this.checkAch(stat, silent); }
  private checkAch(stat: string, silent = false) {
    const a = this.profile.ach, v = a.n[stat] || 0;
    for (const d of ACHIEVEMENTS) {
      if (d.stat !== stat || a.got[d.id] || v < goalOf(d, this.totals)) continue;
      a.got[d.id] = Date.now(); this.profileDirty = true;
      if (!silent) {
        this.eventHandler({ type: 'achievement', id: d.id, name: d.name, description: d.description, icon: d.icon, points: d.points }); this.play('learn');
        const tr = trailFor(d.id);
        if (tr) this.news.push({ text: `New trail: ${TRAILS[tr].name}! Choose it in the stable (Achievements tab).`, short: `New trail: ${TRAILS[tr].name}`, t: 5 });
      }
    }
  }
  /** Brings the counters up to date with what this adventure already did, quietly, so older saves get their achievements. */
  private syncAchievements() {
    const p = this.profile, s = (k: string, v: number) => this.statMax(k, v, true);
    s('kills', this.defeated); s('places', this.discovered.size); s('chests', this.opened.size); s('lore', this.read.size);
    s('sideQuests', this.world.quests.filter(q => !q.main && this.qs(q.id).status === 'done').length);
    s('level', p.level); s('gold', p.gold); s('slots', SLOT_ORDER.filter(sl => p.equipped[sl]).length);
    s('stars', Math.max(0, ...this.spellIds.map(id => starsOf(p, id)))); s('smith', Math.max(0, ...Object.values(p.upgrades).map(Number)));
    for (const id of this.main.bosses) { const e = this.enemies.find(x => x.id === id) || (id.endsWith(':final') ? { kind: 'eclipse' } : null); if (e) s(`boss:${e.kind}`, 1); }
    for (const r of this.main.finales) s(`chapter:${r}`, 1);
    s('lands', this.landsSeen()); s('explore', this.exploredPercent()); s('secrets', this.secrets.size);
    for (const d of ACHIEVEMENTS) this.checkAch(d.stat, true);
  }
  private landsSeen() { const set = new Set<RegionId>([this.regionAt(this.hero.x).id]); for (const id of this.discovered) { const p = this.world.pois.find(z => z.id === id); if (p) set.add(p.region); } return set.size; }
  private exploredPercent() { let n = 0; for (const v of this.explored) n += v; return Math.floor(n / this.explored.length * 100); }
  /** Every achievement with its progress, for the journal. */
  achievementRows(): AchRow[] {
    const a = this.profile.ach;
    return ACHIEVEMENTS.map(d => { const goal = goalOf(d, this.totals); return { ...d, goal, progress: Math.min(goal, a.n[d.stat] || 0), got: a.got[d.id] || 0 }; });
  }

  // ───────────────────────────── experience and gold
  gainXp(amount: number, x = this.hero.x, y = this.hero.y) {
    const p = this.profile; amount = Math.round(amount * (this.buffs.luckyClover ? 1.5 : 1));
    if (amount <= 0 || p.level >= MAX_LEVEL) return;
    p.xp += amount;
    this.text(x, y - 60, `+${amount} XP`, '#c9f29d', 15);
    while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level); p.level++;
      this.refreshStats(true);
      const h = this.hero;
      this.emit(h.x, h.y, 60, ['#fff1b8', '#ffd35c', '#ffffff', '#b9f29d'], { speed: 300, life: 1.3, kind: 'star', glow: true, size: 6 });
      this.ring(h.x, h.y, 200, '#ffd35c', .9); this.flash = .45; this.play('levelUp');
      this.eventHandler({ type: 'levelUp', level: p.level }); this.statMax('level', p.level);
      for (const id of this.spellIds) if (SPELLS[id].level === p.level) this.eventHandler({ type: 'spellLearned', spell: id });
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
    this.persistProfile(p);
  }
  private gainGold(n: number, x = this.hero.x, y = this.hero.y) {
    n = Math.round(n * (this.buffs.luckyClover ? 1.5 : 1)); if (n <= 0) return;
    this.profile.gold += n; this.profileDirty = true;
    this.text(x, y - 76, `+${n} gold`, '#ffd35c', 14);
    this.statMax('gold', this.profile.gold);
  }
  private refreshStats(heal: boolean) {
    const h = this.hero, p = this.profile;
    h.maxHp = healthAt(p); h.maxMana = manaAt(p); h.manaRegen = regenAt(p);
    if (heal) { h.hp = h.maxHp; h.mana = h.maxMana; }
    h.hp = Math.min(h.hp, h.maxHp); h.mana = Math.min(h.mana, h.maxMana);
  }

  // ───────────────────────────── input
  setMovement(x: number, y: number) {
    const mag = Math.hypot(x, y); if (mag > 1) { x /= mag; y /= mag; }
    this.moveX = x; this.moveY = y;
    if (mag > .08 && this.hero.iceT <= 0) { this.hero.faceX = x; this.hero.faceY = y; }
  }
  cast(id: SpellId) {
    sfx.unlock();
    if (this.completeTimer > 0 || this.cine) return;
    const info = SPELLS[id], h = this.hero;
    if (this.riding && this.spellUnlocked(id)) this.dismount();
    if (!this.practice && !this.spellUnlocked(id)) { this.play('nope'); this.notice(`${info.name} is learned at level ${info.level}. Defeat creatures and finish quests to level up.`, 'warn', `Level ${info.level}`); return; }
    // Inside the Ice Block nothing else can be done: the button breaks Lyra free.
    if (h.iceT > 0) { if (id === 'iceBlock') this.endIceBlock(); else this.frozenNotice(); return; }
    if (id === 'stealth' && this.stealthT > 0) { this.endStealth(); return; }
    // Another spell breaks off the one being cast.
    if (this.casting && this.casting.id !== id) this.casting = null;
    if (info.cast) return this.beginCast(id);
    if (id === 'spark') return this.attack();
    if (id === 'slash') return this.swordSlash();
    if (id === 'charge') return this.charge();
    if (id === 'frostbolt') return this.frostbolt();
    if (id === 'blink') return this.blink();
    if (id === 'stab') return this.stab();
    if (id === 'shadowstep') return this.shadowstep();
    if (id === 'arrow') return this.quickShot();
    if (id === 'command') return this.petCommand();
    if (h.cds[id] > 0) { this.play('nope'); return; }
    if (h.mana < info.cost) { this.noMagic(); return; }
    h.mana -= info.cost; h.cds[id] = this.cooldownOf(id); h.castTime = .3;
    if (id === 'sunfire') this.sunfire();
    else if (id === 'gravity') this.gravityWell();
    else if (id === 'starguard') this.guardianStars();
    else if (id === 'guard') this.shieldWall();
    else if (id === 'starfall') this.starfall();
    else if (id === 'slam') this.earthsplitter();
    else if (id === 'bladestorm') this.bladestorm();
    else if (id === 'frostnova') this.frostnova();
    else if (id === 'iceBlock') this.iceBlock();
    else if (id === 'blizzard') this.blizzard();
    else if (id === 'knives') this.fanOfKnives();
    else if (id === 'stealth') this.enterStealth();
    else if (id === 'deathmark' && !this.deathmark()) { h.mana += info.cost; h.cds[id] = 0; }
    else if (id === 'volley') this.volley();
    else if (id === 'leap') this.hawkLeap();
    else if (id === 'wildcall') this.wildcall();
  }
  /** Starts casting a spell with a cast time. Its magic is spent, and its cooldown starts, when it goes off. */
  private beginCast(id: SpellId) {
    const h = this.hero, info = SPELLS[id], c = this.casting;
    if (c) { if (c.id === id) c.again = true; return; }
    const bolt = id === 'spark' || id === 'frostbolt';
    if (!bolt && h.cds[id] > 0) { this.play('nope'); return; }
    if (h.mana < info.cost) { this.noMagic(); return; }
    // Anything that speeds up a bolt's cooldown (upgrades) speeds up its casting just as much.
    const haste = bolt ? this.cooldownOf(id) / info.cooldown : 1;
    this.casting = { id, t: 0, dur: info.cast! * haste, again: false };
    const t = this.nearestTarget(620); if (t) { const d = Math.max(1, dist(h, t)); h.faceX = (t.x - h.x) / d; h.faceY = (t.y - h.y) / d; }
  }
  private finishCast() {
    const c = this.casting!, h = this.hero, id = c.id, info = SPELLS[id];
    this.casting = null;
    if (id === 'spark' || id === 'frostbolt') { h.cds[id] = 0; if (id === 'spark') this.attack(); else this.frostbolt(); if (c.again) this.beginCast(id); return; }
    if (h.mana < info.cost) { this.noMagic(); return; }
    h.mana -= info.cost; h.cds[id] = this.cooldownOf(id); h.castTime = .3;
    if (id === 'sunfire') this.sunfire(); else if (id === 'blizzard') this.blizzard();
  }
  /** Casting goes on while the hero walks (at under half speed); a cutscene, the Ice Block, riding or falling ends it. */
  private updateCasting(dt: number) {
    const c = this.casting, h = this.hero; if (!c) return;
    if (this.cine || h.iceT > 0 || this.riding || h.hp <= 0) { this.casting = null; return; }
    c.t += dt; h.castTime = Math.max(h.castTime, .1);
    // Motes of the spell's light gather at the hero's hands.
    if (Math.random() < dt * 18) { const a = rand(0, 6.28), r = rand(16, 30), col = SPELLS[c.id].color; this.emit(h.x + h.faceX * 18 + Math.cos(a) * r, h.y - 30 + Math.sin(a) * r * .6, 1, [col, '#ffffff'], { speed: 30, life: .35, size: 2.5, glow: true, grav: -40 }); }
    if (c.t >= c.dur) this.finishCast();
  }
  private noMagic() { this.play('nope'); this.notice(`Not enough ${HEROES[this.heroId].resource.toLowerCase()}! Break glow pods and defeat creatures to win some back, or drink a potion.`, 'warn', `No ${HEROES[this.heroId].resource.toLowerCase()}`); }
  /** A spell that needs a foe was pressed with none in reach: nothing happens and nothing is spent. */
  private noTarget(what: string) { this.play('nope'); this.notice(`No foe in reach to ${what}.`, 'warn', 'No target'); }
  private frozenNotice() { this.play('nope'); this.notice('You are frozen in your Glacier Shell. Press Glacier Shell again to break free.', 'warn', 'Frozen in ice'); }
  /** A toggle that is on: Lyra in her Ice Block, Riven in stealth, Fenn held back at Wren's heel. */
  spellActive(id: SpellId) { return id === 'iceBlock' ? this.hero.iceT > 0 : id === 'stealth' ? this.stealthT > 0 : id === 'command' ? this.petMode === 'passive' : false; }
  private attack() {
    const h = this.hero; if (h.cds.spark > 0) return;
    h.cds.spark = this.cooldownOf('spark'); h.castTime = .18;
    const target = this.nearestTarget(560);
    let dx = h.faceX, dy = h.faceY;
    if (target) { const d = Math.max(1, dist(h, target)); dx = (target.x - h.x) / d; dy = (target.y - h.y) / d; h.faceX = dx; h.faceY = dy; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const crit = Math.random() < this.critChance;
    this.projectiles.push({ x: h.x + dx * 26, y: h.y - 14 + dy * 26, vx: dx * 640, vy: dy * 640, life: 1, r: crit ? 9 : 7, damage: this.dmg('spark') * (crit ? 2 : 1), level: 0, owner: 'hero', kind: 'spark', targetId: target && 'kind' in target ? target.id : undefined, crit, spin: 0 });
    this.emit(h.x + dx * 26, h.y - 14 + dy * 26, 6, ['#fff6c4', '#ffe38a'], { speed: 120, life: .3, size: 3, glow: true, angle: Math.atan2(dy, dx), spread: 1.2 });
    this.play('spark');
  }
  // ───────────────────────────── Mira's abilities
  /** A black star on the nearest foe (or just ahead) that drags creatures into its heart for a few seconds. */
  private gravityWell() {
    const h = this.hero, t = this.nearestTarget(560, true);
    const c = t ? { x: t.x, y: t.y } : { x: h.x + h.faceX * 200, y: h.y + h.faceY * 200 };
    if (t) { const d = Math.max(1, dist(h, t)); h.faceX = (t.x - h.x) / d; h.faceY = (t.y - h.y) / d; }
    this.wells.push({ x: c.x, y: c.y, t: 2, max: 2, tick: .1 });
    this.ring(c.x, c.y, 170, '#b39cff', .5);
    this.emit(c.x, c.y, 26, ['#1a1030', '#6a4bd6', '#b39cff', '#ffffff'], { speed: 220, life: .6, kind: 'star', glow: true, size: 4 });
    this.addShake(3); this.play('voidShot', c);
  }
  /** Three stars that circle Mira: each one catches a blow for her. */
  private guardianStars() {
    const h = this.hero; h.orbitT = 8; h.orbitN = 3; h.orbitTick = .3;
    this.ring(h.x, h.y, 90, '#fff1b8', .5);
    this.emit(h.x, h.y - 10, 30, ['#fff1b8', '#ffe38a', '#ffffff', '#c9b6ff'], { speed: 200, life: .7, kind: 'star', glow: true, size: 5 });
    this.play('shield');
  }
  /** Where Guardian Star `i` circles right now. */
  starPos(i: number): Point { const h = this.hero, a = this.elapsed * 3.2 + i * Math.PI * 2 / 3; return { x: h.x + Math.cos(a) * 52, y: h.y - 10 + Math.sin(a) * 36 }; }
  /** A star leaves the ring and flies at a foe: the attacker, or the nearest one. */
  private loseStar(at: Enemy | null) {
    const h = this.hero, s = this.starPos(h.orbitN - 1); h.orbitN--;
    const t = at && !at.dead ? at : this.nearestTarget(560, true) as Enemy | null;
    this.emit(s.x, s.y, 16, ['#fff1b8', '#ffffff', '#ffe38a'], { speed: 200, life: .5, kind: 'star', glow: true, size: 4 });
    if (!t) { this.ring(s.x, s.y, 60, '#fff1b8', .4); return; }
    const d = Math.max(1, dist(s, t)), dx = (t.x - s.x) / d, dy = (t.y - s.y) / d;
    this.projectiles.push({ x: s.x, y: s.y, vx: dx * 700, vy: dy * 700, life: 1.2, r: 10, damage: this.dmg('starguard'), level: 0, owner: 'hero', kind: 'spark', targetId: t.id, spin: 0 });
  }
  // ───────────────────────────── Kael's abilities
  /** A wide sword arc in front of Kael; it turns toward the nearest foe in reach. */
  private swordSlash() {
    const h = this.hero; if (h.cds.slash > 0) return;
    h.cds.slash = this.cooldownOf('slash'); h.castTime = .26;
    const t = this.nearestTarget(190);
    if (t) { const d = Math.max(1, dist(h, t)); h.faceX = (t.x - h.x) / d; h.faceY = (t.y - h.y) / d; }
    const ang = Math.atan2(h.faceY, h.faceX), reach = 118 * this.heroScale, crit = Math.random() < this.critChance;
    this.slashes.push({ x: h.x, y: h.y - 12, angle: ang, life: .22, max: .22, reach });
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0 || Math.abs(e.x - h.x) > reach + 60 || Math.abs(e.y - h.y) > reach + 60) continue;
      const d = dist(h, e); if (d > reach + e.r) continue;
      let da = Math.atan2(e.y - h.y, e.x - h.x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > 1.25 && d > e.r + 20) continue;
      this.damageEnemy(e, this.dmg('slash') * (crit ? 2 : 1), crit); if (!e.boss) this.knock(e, h, 170); hits++;
    }
    for (const p of this.pods) if (!p.dead && dist(h, p) < reach) this.breakPod(p);
    this.play(hits ? 'hit' : 'dash'); if (hits) this.addShake(2 + Math.min(4, hits));
  }
  /** Rushes at the nearest foe; everything in the way is hurt, knocked aside and stunned. It needs a foe to aim at,
   *  and it stops at that foe instead of carrying on past it. */
  private charge() {
    const h = this.hero; if (h.cds.charge > 0 || h.dashTime > 0) return;
    const t = this.nearestTarget(340, true) as Enemy | null;
    if (!t) return this.noTarget('charge');
    let dx = t.x - h.x, dy = t.y - h.y;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const reach = clamp((len - t.r - 10) / 1050, .06, .32);
    h.dashX = dx; h.dashY = dy; h.faceX = dx; h.faceY = dy; h.dashTime = reach; h.charging = true; h.cds.charge = this.cooldownOf('charge'); h.slowT = 0;
    this.chargeHit.clear();
    this.emit(h.x, h.y + 14, 18, ['#ffd0a0', '#ffb35c', '#ffffff'], { speed: 160, life: .45, kind: 'smoke', size: 8, angle: Math.atan2(-dy, -dx), spread: 1.4 });
    this.play('dash'); this.play('roar');
  }
  /** A shockwave around Kael that hurts and stuns. */
  private earthsplitter() {
    const h = this.hero;
    this.hazards.push({ x: h.x, y: h.y, r: 175, delay: .22, maxDelay: .22, damage: this.dmg('slam'), level: 0, owner: 'hero', kind: 'slam', fromX: h.x, fromY: h.y });
    h.castTime = .3; this.addShake(4); this.play('roar');
  }
  private bladestorm() { const h = this.hero; h.stormT = 3; h.stormTick = 0; this.play('dash'); this.flash = Math.max(this.flash, .15); }
  private updateWarrior(dt: number) {
    const h = this.hero;
    if (h.dashTime <= 0) h.charging = false;
    if (h.charging) for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0 || this.chargeHit.has(e) || Math.abs(e.x - h.x) > 90 || Math.abs(e.y - h.y) > 90 || dist(e, h) > e.r + 34) continue;
      this.chargeHit.add(e); this.damageEnemy(e, this.dmg('charge'));
      if (!e.boss) { e.stunT = 1; e.windup = 0; e.lunge = 0; this.knock(e, { x: e.x - h.dashY * 30 - h.dashX * 10, y: e.y + h.dashX * 30 - h.dashY * 10 }, 420); }
      this.addShake(6); this.freeze(.04);
    }
    if (h.stormT > 0) {
      h.stormT -= dt; h.stormTick -= dt;
      if (Math.random() < dt * 20) { const a = rand(0, 6.28); this.emit(h.x + Math.cos(a) * 60, h.y - 10 + Math.sin(a) * 40, 1, ['#ffd0a0', '#ffffff', '#ff8a6b'], { speed: 120, life: .3, glow: true, size: 3, angle: a + 1.6, spread: .4 }); }
      if (h.stormTick <= 0) {
        h.stormTick = .25; this.play('dash');
        for (const e of this.enemies) if (!e.dead && e.spawnT <= 0 && Math.abs(e.x - h.x) < 200 && Math.abs(e.y - h.y) < 200 && dist(e, h) < 150 + e.r) { this.damageEnemy(e, this.dmg('bladestorm')); if (!e.boss) this.knock(e, h, 90); }
        for (const p of this.pods) if (!p.dead && dist(h, p) < 150) this.breakPod(p);
      }
    }
  }
  // ───────────────────────────── Lyra's abilities
  /** A homing shard of ice; it chills whatever it hits. */
  private frostbolt() {
    const h = this.hero; if (h.cds.frostbolt > 0) return;
    h.cds.frostbolt = this.cooldownOf('frostbolt'); h.castTime = .2;
    const target = this.nearestTarget(580);
    let dx = h.faceX, dy = h.faceY;
    if (target) { const d = Math.max(1, dist(h, target)); dx = (target.x - h.x) / d; dy = (target.y - h.y) / d; h.faceX = dx; h.faceY = dy; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const crit = Math.random() < this.critChance;
    this.projectiles.push({ x: h.x + dx * 26, y: h.y - 16 + dy * 26, vx: dx * 600, vy: dy * 600, life: 1, r: crit ? 9 : 7, damage: this.dmg('frostbolt') * (crit ? 2 : 1), level: 0, owner: 'hero', kind: 'frost', targetId: target && 'kind' in target ? target.id : undefined, crit, spin: Math.atan2(dy, dx) });
    this.emit(h.x + dx * 26, h.y - 16 + dy * 26, 6, ['#e0f6ff', '#9fe4ff'], { speed: 120, life: .3, size: 3, glow: true, angle: Math.atan2(dy, dx), spread: 1.2 });
    this.play('spark');
  }
  /** A short teleport; the spot left behind bursts into frost that chills. */
  private blink() {
    const h = this.hero; if (h.cds.blink > 0) return;
    let dx = this.moveX, dy = this.moveY;
    if (Math.hypot(dx, dy) < .1) { dx = h.faceX; dy = h.faceY; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const from = { x: h.x, y: h.y };
    this.hazards.push({ x: from.x, y: from.y, r: 110, delay: .05, maxDelay: .05, damage: this.dmg('blink'), level: 0, owner: 'hero', kind: 'blizzard', fromX: from.x, fromY: from.y });
    for (let i = 0; i < 5; i++) this.afterimages.push({ x: from.x + dx * i * 45, y: from.y + dy * i * 45, life: .28 - i * .03, faceX: h.faceX });
    h.x = clamp(h.x + dx * 230, 40, this.world.width - 40); h.y = clamp(h.y + dy * 230, 40, this.world.height - 40);
    this.collide(h, 15);
    h.vx = h.vy = 0; h.ghostT = .35; h.slowT = 0; h.cds.blink = this.cooldownOf('blink');
    this.emit(from.x, from.y, 20, ['#e0f6ff', '#9fe4ff', '#ffffff'], { speed: 200, life: .5, kind: 'shard', glow: true, size: 4 });
    this.emit(h.x, h.y, 16, ['#e0f6ff', '#ffffff'], { speed: 160, life: .4, kind: 'star', glow: true });
    this.play('dash');
  }
  private frostnova() {
    const h = this.hero;
    this.hazards.push({ x: h.x, y: h.y, r: 175, delay: .08, maxDelay: .08, damage: this.dmg('frostnova'), level: 0, owner: 'hero', kind: 'frostnova', fromX: h.x, fromY: h.y });
    h.castTime = .3; this.addShake(3); this.play('reflect');
  }
  /** Lyra freezes herself solid: no harm gets in, and she can't move or act until she breaks out (or it melts). */
  private iceBlock() {
    const h = this.hero; this.dismount();
    h.iceT = 6; h.cds.iceBlock = 0; h.vx = h.vy = 0; h.dashTime = 0; h.slowT = 0; this.work = null;
    this.setMovement(0, 0);
    this.ring(h.x, h.y, 80, '#bfeaff', .5); this.flash = Math.max(this.flash, .12);
    this.emit(h.x, h.y - 10, 30, ['#e0f6ff', '#9fe4ff', '#ffffff'], { speed: 200, life: .6, kind: 'shard', glow: true, size: 5 });
    this.play('reflect'); this.play('shield');
  }
  /** The ice shatters and Lyra is free; the cooldown starts now. */
  endIceBlock() {
    const h = this.hero; if (h.iceT <= 0) return;
    h.iceT = 0; h.cds.iceBlock = this.cooldownOf('iceBlock');
    this.ring(h.x, h.y, 90, '#dff6ff', .4);
    this.emit(h.x, h.y - 20, 34, ['#e0f6ff', '#9fe4ff', '#ffffff'], { speed: 280, life: .7, kind: 'shard', glow: true, size: 5, grav: 400 });
    this.addShake(3); this.play('reflect');
  }
  /** A blizzard over the nearest pack (or just ahead) that rains ice for four seconds. */
  private blizzard() {
    const h = this.hero, t = this.nearestTarget(620, true);
    const c = t ? { x: t.x, y: t.y } : { x: h.x + h.faceX * 220, y: h.y + h.faceY * 220 };
    this.storms.push({ x: c.x, y: c.y, t: 4, tick: 0 }); this.flash = Math.max(this.flash, .15); this.play('starfall');
  }
  // ───────────────────────────── Riven's abilities
  /** Out of Stealth, the first strike is an ambush for triple damage (and brings Riven out of the shadows). */
  private ambush() { if (this.stealthT <= 0) return 1; this.endStealth(); this.text(this.hero.x, this.hero.y - 70, 'Veil strike!', '#e0c8ff', 18); return 3; }
  /** Two quick dagger thrusts at up to two foes in front. Critical hits deal triple damage. */
  private stab() {
    const h = this.hero; if (h.cds.stab > 0) return;
    h.cds.stab = this.cooldownOf('stab'); h.castTime = .2;
    const t = this.nearestTarget(170);
    if (t) { const d = Math.max(1, dist(h, t)); h.faceX = (t.x - h.x) / d; h.faceY = (t.y - h.y) / d; }
    const ang = Math.atan2(h.faceY, h.faceX), reach = 94 * this.heroScale, sure = this.nextCrit;
    this.slashes.push({ x: h.x, y: h.y - 12, angle: ang, life: .16, max: .16, reach, color: '#e0c8ff', narrow: true });
    let hits = 0, amb = 1;
    for (const e of this.enemies) {
      if (hits >= 2) break;
      if (e.dead || e.spawnT > 0 || e.burrowT > 0 || Math.abs(e.x - h.x) > reach + 60 || Math.abs(e.y - h.y) > reach + 60) continue;
      const d = dist(h, e); if (d > reach + e.r) continue;
      let da = Math.atan2(e.y - h.y, e.x - h.x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > .85 && d > e.r + 16) continue;
      if (!hits) amb = this.ambush();
      for (let k = 0; k < 2; k++) { const crit = sure || Math.random() < this.critChance; this.damageEnemy(e, this.dmg('stab') * amb * (crit ? 3 : 1), crit); }
      if (!e.boss) this.knock(e, h, 70); hits++;
    }
    if (hits) this.nextCrit = false;
    for (const p of this.pods) if (!p.dead && dist(h, p) < reach) this.breakPod(p);
    this.play(hits ? 'hit' : 'dash'); if (hits) this.addShake(1.5 + hits);
  }
  /** Steps through the shadows to right behind the nearest foe; the next stab is a sure critical hit. It needs a foe:
   *  with none in reach nothing happens and the cooldown is not spent. Stepping keeps Riven in stealth. */
  private shadowstep() {
    const h = this.hero; if (h.cds.shadowstep > 0) return;
    const t = this.nearestTarget(380, true) as Enemy | null, from = { x: h.x, y: h.y };
    if (!t) return this.noTarget('step to');
    const d = Math.max(1, dist(h, t)), ux = (t.x - h.x) / d, uy = (t.y - h.y) / d, r = t.r + 30;
    h.x = t.x + ux * r; h.y = t.y + uy * r; h.faceX = -ux; h.faceY = -uy;
    h.x = clamp(h.x, 40, this.world.width - 40); h.y = clamp(h.y, 40, this.world.height - 40); this.collide(h, 15);
    h.vx = h.vy = 0; h.ghostT = .3; h.slowT = 0; h.cds.shadowstep = this.cooldownOf('shadowstep'); this.nextCrit = true;
    this.afterimages.push({ x: from.x, y: from.y, life: .28, faceX: h.faceX });
    for (const p of [from, h]) this.emit(p.x, p.y, 16, ['rgba(60,40,90,.7)', 'rgba(140,110,200,.6)', '#e0c8ff'], { speed: 140, life: .5, kind: 'smoke', size: 12 });
    this.play('dash');
  }
  private fanOfKnives() {
    const h = this.hero, amb = this.ambush();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + rand(-.05, .05); this.projectiles.push({ x: h.x, y: h.y - 12, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: .55, r: 7, damage: this.dmg('knives') * amb, level: 0, owner: 'hero', kind: 'knife', spin: a }); }
    h.castTime = .25; this.addShake(2); this.play('thornShot');
  }
  /** Riven fades from sight: every creature, guardians too, loses him and none can find him until he strikes,
   *  is hurt, steps out or it runs out. The cooldown starts when he comes out. */
  private enterStealth() {
    const h = this.hero; this.stealthT = 15; h.cds.stealth = 0;
    this.loseHero();
    this.emit(h.x, h.y, 34, ['rgba(60,50,80,.7)', 'rgba(150,140,180,.6)', 'rgba(220,210,240,.5)'], { speed: 200, life: 1.3, kind: 'smoke', size: 22, drag: 2 });
    this.text(h.x, h.y - 70, 'Nightveil', '#c9b6ff', 16); this.play('dash');
  }
  endStealth() {
    if (this.stealthT <= 0) return;
    const h = this.hero; this.stealthT = 0; h.cds.stealth = this.cooldownOf('stealth');
    this.emit(h.x, h.y, 16, ['rgba(60,50,80,.6)', 'rgba(150,140,180,.5)'], { speed: 120, life: .7, kind: 'smoke', size: 14 });
  }
  /** Every creature fighting the hero loses them: guardians stop their attack, the rest go back to wandering. */
  private loseHero() {
    for (const e of this.enemies) {
      if (e.dead || !e.aggro) continue;
      e.aggro = false; e.windup = 0; e.lunge = 0; e.cd = Math.max(e.cd, 1);
      if (e.boss) { e.action = null; e.cd = Math.max(e.cd, 1.4); }
      if (Math.abs(e.x - this.hero.x) < 900 && Math.abs(e.y - this.hero.y) < 900) this.text(e.x, e.y - e.r - 26, '?', '#c9b6ff', 20);
    }
  }
  /** Marks the toughest foe in reach; the mark bursts two seconds later. Returns false when nothing is in reach. */
  private deathmark() {
    const h = this.hero;
    const list = this.enemies.filter(e => !e.dead && e.spawnT <= 0 && e.burrowT <= 0 && this.canHurt(e) && Math.abs(e.x - h.x) < 520 && Math.abs(e.y - h.y) < 520 && dist(h, e) < 520 && !this.marks.some(m => m.e === e));
    if (!list.length) { this.play('nope'); this.notice('No foe in reach to mark.', 'warn', 'No target'); return false; }
    const t = list.reduce((a, b) => b.hp > a.hp ? b : a);
    this.marks.push({ e: t, t: 2, max: 2, mul: this.ambush() });
    this.ring(t.x, t.y, 60, '#ff6b9a', .5); h.castTime = .3; this.play('voidShot');
    return true;
  }
  // ───────────────────────────── Wren's abilities, and Fenn the wolf
  private makePet(spirit: boolean, life = 0): Pet {
    const h = this.hero, a = rand(0, 6.28);
    return { x: h.x - 44 + (spirit ? Math.cos(a) * 40 : 0), y: h.y + 16 + (spirit ? Math.sin(a) * 30 : 0), face: 1, target: null, cd: 0, bite: 0, leapT: 0, walk: 0, spirit, life, moving: false };
  }
  private arrowShot(dx: number, dy: number, damage: number, crit: boolean, pierce: number, life = .75) {
    const h = this.hero;
    this.projectiles.push({ x: h.x + dx * 24, y: h.y - 14 + dy * 24, vx: dx * 920, vy: dy * 920, life, r: 7, damage, level: 0, owner: 'hero', kind: 'arrow', crit, spin: Math.atan2(dy, dx), pierce, passed: [] });
  }
  /** An arrow at the nearest foe that passes through the first creature it hits; Fenn goes for whatever Wren shoots. */
  private quickShot() {
    const h = this.hero; if (h.cds.arrow > 0) return;
    h.cds.arrow = this.cooldownOf('arrow'); h.castTime = .22;
    const target = this.nearestTarget(640);
    let dx = h.faceX, dy = h.faceY;
    if (target) { const d = Math.max(1, dist(h, target)); dx = (target.x - h.x) / d; dy = (target.y - h.y) / d; h.faceX = dx; h.faceY = dy; if ('kind' in target) this.petFocus = target; }
    const len = Math.hypot(dx, dy) || 1, crit = Math.random() < this.critChance;
    this.arrowShot(dx / len, dy / len, this.dmg('arrow') * (crit ? 2 : 1), crit, 1);
    this.play('thornShot');
  }
  /**
   * Wren's order to Fenn. On attack, it calls him to heel: passive, he follows her and attacks nothing. On passive it
   * sends him in at her foe (out of combat, the nearest creature, so he starts the fight), with a stunning pounce when
   * he has one ready.
   */
  private petCommand() {
    const h = this.hero; if (h.cds.command > 0) return;
    h.cds.command = this.cooldownOf('command'); h.castTime = .2;
    const fenn = this.pets.find(p => !p.spirit) || null;
    if (this.petMode === 'attack') {
      this.petMode = 'passive'; this.petFocus = null;
      for (const p of this.pets) { p.target = null; p.leapT = 0; }
      this.text(h.x, h.y - 70, 'Fenn: heel!', '#c8e6a0', 16);
      if (fenn) this.ring(fenn.x, fenn.y, 50, '#c8e6a0', .4);
      this.play('ui');
      return;
    }
    this.petMode = 'attack';
    const t = this.nearestTarget(520, true) as Enemy | null;
    this.text(h.x, h.y - 70, t ? 'Fenn: attack!' : 'Fenn: ready', '#ffd35c', 16);
    if (!fenn || !t) { this.play('ui'); return; }
    this.petFocus = t; fenn.target = t;
    if (this.pounceCd <= 0) { fenn.leapT = .32; this.pounceCd = 5; }
    this.ring(t.x, t.y, 60, '#ffd35c', .45); this.play('squeak', fenn); this.play('roar');
  }
  private volley() {
    const h = this.hero, t = this.nearestTarget(620, true);
    let a = Math.atan2(h.faceY, h.faceX);
    if (t) { a = Math.atan2(t.y - h.y, t.x - h.x); h.faceX = Math.cos(a); h.faceY = Math.sin(a); if ('kind' in t) this.petFocus = t; }
    for (let i = 0; i < 7; i++) { const o = a + (i - 3) * .14, crit = Math.random() < this.critChance; this.arrowShot(Math.cos(o), Math.sin(o), this.dmg('volley') * (crit ? 2 : 1), crit, 0, .6); }
    h.castTime = .3; this.addShake(2); this.play('thornShot');
  }
  /**
   * Hawk Leap: Wren vaults away from the nearest foe (or the way she is moving) and looses three arrows at it in mid-air.
   * Nothing can hurt her during the leap, and every creature an arrow hits is pinned to the ground.
   */
  private hawkLeap() {
    const h = this.hero, t = this.nearestTarget(560, true) as Enemy | null;
    let dx = this.moveX, dy = this.moveY;
    if (Math.hypot(dx, dy) < .1) { if (t) { dx = h.x - t.x; dy = h.y - t.y; } else { dx = -h.faceX; dy = -h.faceY; } }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    h.dashX = dx; h.dashY = dy; h.dashTime = .3; h.charging = false; h.slowT = 0; h.ghostT = Math.max(h.ghostT, .45);
    let a = Math.atan2(-dy, -dx);
    if (t) { a = Math.atan2(t.y - h.y, t.x - h.x); this.petFocus = t; }
    h.faceX = Math.cos(a); h.faceY = Math.sin(a);
    for (let i = -1; i <= 1; i++) { const o = a + i * .12, crit = Math.random() < this.critChance; this.arrowShot(Math.cos(o), Math.sin(o), this.dmg('leap') * (crit ? 2 : 1), crit, 0, .7); this.projectiles[this.projectiles.length - 1].pin = 1.5; }
    this.emit(h.x, h.y + 12, 16, ['#b9e27a', '#e8d49a', '#ffffff'], { speed: 180, life: .45, kind: 'leaf', size: 5, angle: Math.atan2(-dy, -dx), spread: 1.6 });
    h.castTime = .3; this.play('dash'); this.play('thornShot');
  }
  private wildcall() {
    const h = this.hero, t = this.durationOf('wildcall', 8);
    this.wildT = t; this.petMode = 'attack';
    for (let i = 0; i < this.pets.length; i++) if (this.pets[i].spirit) { swapRemove(this.pets, i); i--; }
    for (let i = 0; i < 2; i++) this.pets.push(this.makePet(true, t));
    this.ring(h.x, h.y, 140, '#9fe8b0', .6); this.emit(h.x, h.y, 30, ['#9fe8b0', '#e6ffe9', '#ffffff'], { speed: 220, life: .8, kind: 'star', glow: true });
    this.flash = Math.max(this.flash, .15); this.play('roar');
  }
  /** Fenn follows Wren, runs at whatever she shoots (or anything attacking her) and bites.
   *  Told to stay passive, he and the spirit wolves keep to her heel and attack nothing. */
  private updatePets(dt: number) {
    const h = this.hero, passive = this.petMode === 'passive';
    if (this.wildT > 0) this.wildT = Math.max(0, this.wildT - dt);
    this.pounceCd = Math.max(0, this.pounceCd - dt);
    const valid = (e: Enemy | null): e is Enemy => !passive && !!e && !e.wall && !e.dead && e.spawnT <= 0 && e.burrowT <= 0 && this.canHurt(e) && dist(e, h) < 620;
    if (!valid(this.petFocus)) this.petFocus = null;
    for (let i = this.pets.length - 1; i >= 0; i--) {
      const p = this.pets[i];
      if (p.spirit) { p.life -= dt; if (p.life <= 0) { this.emit(p.x, p.y - 8, 16, ['#9fe8b0', '#e6ffe9'], { speed: 120, life: .6, kind: 'star', glow: true }); swapRemove(this.pets, i); continue; } }
      p.cd -= dt; p.bite = Math.max(0, p.bite - dt);
      if (Math.abs(p.x - h.x) > 900 || Math.abs(p.y - h.y) > 900) { p.x = h.x - 40; p.y = h.y + 16; p.target = null; p.leapT = 0; }
      if (!valid(p.target)) p.target = null;
      if (!p.target && !passive) {
        // Anything already fighting Wren, near her.
        let best: Enemy | null = this.petFocus, bd = 460;
        if (!best) for (const e of this.enemies) { if (!e.aggro || !valid(e) || Math.abs(e.x - h.x) > bd || Math.abs(e.y - h.y) > bd) continue; const d = dist(e, h); if (d < bd) { bd = d; best = e; } }
        p.target = best;
      }
      const wild = this.wildT > 0 && !p.spirit, fast = this.riding ? MOUNTS[this.mountId || 'pony'].speed : 1;
      let tx: number, ty: number, speed: number;
      if (p.target) { tx = p.target.x; ty = p.target.y; speed = p.leapT > 0 ? 760 : 330 * (wild ? 1.3 : 1); }
      else { const side = p.spirit ? (i % 2 ? 1 : -1) * 34 : 0; tx = h.x - (h.faceX >= 0 ? 44 : -44); ty = h.y + 16 + side; speed = Math.max(300, Math.hypot(h.vx, h.vy) * 1.15) * fast; }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), reach = p.target ? p.target.r + 16 : 8;
      p.moving = d > reach + 2;
      if (p.moving) { const step = Math.min(d - reach, speed * dt); p.x += dx / d * step; p.y += dy / d * step; p.walk += dt * 14; if (Math.abs(dx) > 2) p.face = dx > 0 ? 1 : -1; }
      if (!p.spirit) this.collide(p, 12);
      if (p.leapT > 0) {
        p.leapT -= dt;
        if (p.target && d < reach + 14) {
          p.leapT = 0; p.cd = .6; p.bite = .25;
          this.damageEnemy(p.target, this.dmg('command')); if (!p.target.boss) { p.target.stunT = Math.max(p.target.stunT, .8); p.target.windup = 0; p.target.lunge = 0; }
          this.emit(p.target.x, p.target.y, 10, ['#ffffff', '#e0d4b0'], { speed: 160, life: .35, glow: true, size: 3 });
        }
      } else if (p.target && d < reach + 10 && p.cd <= 0) {
        p.cd = p.spirit ? .8 : wild ? .45 : .9; p.bite = .2;
        const e = p.target; this.damageEnemy(e, (p.spirit ? 7 : 9) * this.power * (wild ? 2 : 1) * (1 + starsOf(this.profile, 'wildcall') * .06));
        if (!e.boss) this.knock(e, p, 60);
      }
    }
  }

  // ───────────────────────────── mini-games and trails
  /** Some villagers like a game: dice, or a shooting match for hunters and guards. Innkeepers always have dice. */
  gameOf(n: Npc): MiniGame | null {
    if (n.role === 'inn') return 'dice';
    if (n.role && n.role !== 'villager') return null;
    if (/hunter|archer|ranger|scout|captain|guard/i.test(n.name)) return 'archery';
    let h = 7; for (const c of n.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % 7 === 0 ? 'dice' : h % 11 === 3 ? 'archery' : null;
  }
  /** The dice stake grows with the hero's level; archery is free and pays by score. */
  gameStake(kind: MiniGame) { return kind === 'dice' ? Math.round((5 + this.profile.level * 2.5) / 5) * 5 : 0; }
  private offerGame(n: Npc, kind: MiniGame, before: string[] = []) {
    const stake = this.gameStake(kind), dice = kind === 'dice';
    const lines = [...before, ...(dice ? [pick(['Fancy a game of Starfall Dice? Three dice each, best of three rounds.', 'Care to roll some bones? Loser pays the winner.', 'Dice, friend? I feel lucky tonight.'])] : [pick(['Think you can shoot? The range out back needs a real archer.', 'Eight arrows, moving targets. Beat my score and I’ll pay you well.', 'A shooting match! The far targets count double.'])])];
    const offer: QuestOffer = { id: `game:${kind}`, title: dice ? 'Starfall Dice' : 'Archery match', summary: dice ? 'Roll three dice, keep what you like and reroll the rest once. Pairs and triples score extra. Best of three rounds.' : 'Tap or click to loose eight arrows at moving targets. Bullseyes and far targets score the most.', reward: dice ? `Stake ${stake} gold · win ${stake * 2}` : 'Gold by score · a medal at 40, 70 and 100 points', main: false, game: { kind, stake, opponent: n.name, portrait: n.portrait } };
    sfx.play('talk'); this.eventHandler({ type: 'dialogue', speaker: n.name, portrait: n.portrait, lines: this.personal(lines), offer });
  }
  /** Takes the dice stake; false when the hero can't pay it. */
  gameStart(kind: MiniGame) { const s = this.gameStake(kind); if (this.profile.gold < s) { this.play('nope'); return false; } this.profile.gold -= s; this.profileDirty = true; return true; }
  /** Pays out a finished game and counts it for the achievements. */
  gameEnd(kind: MiniGame, r: { won: boolean; gold: number; score?: number }) {
    if (r.gold > 0) { this.profile.gold += r.gold; this.statMax('gold', this.profile.gold); }
    if (kind === 'dice' && r.won) this.bump('diceWins');
    if (kind === 'archery' && r.score !== undefined) this.statMax('archeryBest', r.score);
    this.profileDirty = true; this.persistProfile(this.profile); this.play(r.won ? 'questDone' : 'page');
  }
  trailUnlocked(id: TrailId) { return this.practice || !!this.profile.ach.got[TRAILS[id].ach]; }
  setTrail(id: TrailId | null) { if (id && !this.trailUnlocked(id)) return; this.profile.trail = id; this.persistProfile(this.profile); this.play('ui'); }
  get trail(): TrailId | null { const t = this.profile.trail; return t && this.trailUnlocked(t) ? t : null; }

  // ───────────────────────────── mounts
  /** Mounts are owned: bought from a stable master or won in battle. */
  mountUnlocked(id: MountId) { return this.practice || this.profile.mounts.includes(id); }
  /** A stable master's price for a mount, and why it can't be bought yet (null when it can). */
  mountOffer(id: MountId) {
    const m = MOUNTS[id], owned = this.mountUnlocked(id), price = m.price || 0;
    const why = owned ? 'Owned' : !price ? 'Not for sale' : this.profile.level < (m.level || 1) ? `Lv ${m.level}` : this.profile.gold < price ? 'Not enough gold' : null;
    return { price, owned, why };
  }
  buyMount(id: MountId) {
    const o = this.mountOffer(id); if (o.why) { this.play('nope'); return false; }
    this.profile.gold -= o.price; this.gainMount(id, false); return true;
  }
  /** A new mount for this hero: it is ridden from now on (until another is chosen in the stable). */
  private gainMount(id: MountId, won: boolean) {
    const p = this.profile; if (p.mounts.includes(id)) return;
    p.mounts.push(id); p.mount = id; this.persistProfile(p); this.play('learn');
    this.notice(`${won ? 'Won in battle' : 'Bought'}: ${MOUNTS[id].name}! Press ${keyLabel(keyOf('ride'))} (or the saddle button) to ride.`, 'epic', `New mount: ${MOUNTS[id].name}`);
  }
  /** The mount the hero rides: the one chosen in the stable, or the fastest one earned. */
  get mountId(): MountId | null {
    const p = this.profile.mount;
    if (p && this.mountUnlocked(p)) return p;
    for (let i = MOUNT_ORDER.length - 1; i >= 0; i--) if (this.mountUnlocked(MOUNT_ORDER[i])) return MOUNT_ORDER[i];
    return null;
  }
  setMount(id: MountId) { if (!this.mountUnlocked(id)) return; this.profile.mount = id; this.persistProfile(this.profile); this.play('ui'); }
  /** In combat: a guardian fight, a creature hunting the hero, a siege, or a blow struck either way a moment ago. */
  inCombat() {
    const h = this.hero;
    if (this.bossFight || this.siege?.spawned || this.elapsed - this.fightT < 5) return true;
    return this.enemies.some(e => !e.dead && e.aggro && this.canHurt(e) && Math.abs(e.x - h.x) < 900 && Math.abs(e.y - h.y) < 900);
  }
  /** R: call the mount (not while creatures are after you), or step off it. */
  toggleMount() {
    sfx.unlock();
    if (this.completeTimer > 0 || this.cine) return;
    if (this.riding) return this.dismount();
    const id = this.mountId, h = this.hero;
    if (h.iceT > 0) return this.frozenNotice();
    if (!id) { this.play('nope'); this.notice('You have no mount yet. Buy one from the stable master in any city, or win one from a heroic creature.', 'warn', 'No mount yet'); return; }
    if (this.inCombat()) { this.play('nope'); this.notice('You can’t call your mount in combat. Win the fight or get away first.', 'warn', 'In combat'); return; }
    this.riding = true; this.mountFx = 0;
    this.emit(h.x, h.y + 10, 24, [MOUNTS[id].mane, MOUNTS[id].body, '#ffffff'], { speed: 180, life: .6, kind: 'smoke', size: 10 });
    if (MOUNTS[id].glow) this.ring(h.x, h.y, 80, MOUNTS[id].glow!, .5);
    this.play('learn');
  }
  dismount() {
    if (!this.riding) return;
    const h = this.hero; this.riding = false;
    this.emit(h.x, h.y + 12, 16, ['rgba(220,200,150,.6)', 'rgba(255,255,255,.5)'], { speed: 140, life: .5, kind: 'smoke', size: 9 });
    this.play('dash');
  }
  /** Death Marks count down and burst; Blizzards rain ice; Gravity Wells pull; Guardian Stars circle; Stealth, the Ice
   *  Block and the blink grace fade. */
  private updateSpells(dt: number) {
    const h = this.hero;
    h.ghostT = Math.max(0, h.ghostT - dt);
    if (this.pets.length) this.updatePets(dt);
    if (this.riding) this.mountFx = Math.min(1, this.mountFx + dt * 4);
    if (this.stealthT > 0) {
      if (this.stealthT <= dt) { this.endStealth(); this.notice('You step out of the shadows.', 'info', 'Veil ended'); }
      else { this.stealthT -= dt; if (Math.random() < dt * 10) this.emit(h.x + rand(-16, 16), h.y + rand(-24, 14), 1, 'rgba(150,130,200,.5)', { speed: 20, life: .6, kind: 'smoke', size: 7, grav: -20 }); }
    }
    if (h.iceT > 0) {
      if (h.iceT <= dt) this.endIceBlock();
      else { h.iceT -= dt; if (Math.random() < dt * 8) this.emit(h.x + rand(-26, 26), h.y + rand(-44, 18), 1, ['#ffffff', '#dff6ff'], { speed: 15, life: .6, glow: true, size: 2.5, grav: -20 }); }
    }
    if (h.orbitT > 0) {
      h.orbitT -= dt; h.orbitTick -= dt;
      if (h.orbitN <= 0) h.orbitT = 0;
      else if (h.orbitT <= 0) { while (h.orbitN > 0) this.loseStar(null); }
      else if (h.orbitTick <= 0) {
        // The stars burn whatever they brush past.
        h.orbitTick = .45;
        for (let i = 0; i < h.orbitN; i++) {
          const s = this.starPos(i);
          for (const e of this.enemies) if (!e.dead && e.spawnT <= 0 && e.burrowT <= 0 && this.canHurt(e) && Math.abs(e.x - s.x) < 90 && Math.abs(e.y - s.y) < 90 && dist(e, s) < e.r + 18) this.damageEnemy(e, this.dmg('starguard') * .3);
        }
      }
    }
    for (let i = this.wells.length - 1; i >= 0; i--) {
      const w = this.wells[i]; w.t -= dt; w.tick -= dt;
      if (w.t <= 0) { swapRemove(this.wells, i); this.ring(w.x, w.y, 120, '#b39cff', .35); this.emit(w.x, w.y, 20, ['#6a4bd6', '#b39cff', '#ffffff'], { speed: 240, life: .5, kind: 'star', glow: true, size: 4 }); continue; }
      const R = 160, tick = w.tick <= 0;
      if (tick) w.tick = .4;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || e.burrowT > 0 || !this.canHurt(e) || Math.abs(e.x - w.x) > R + 60 || Math.abs(e.y - w.y) > R + 60) continue;
        const d = dist(e, w); if (d > R + e.r) continue;
        if (!e.boss && !e.wall) {
          // Dragged in: the closer to the heart, the harder to pull free. Heavy creatures and heroic ones resist.
          const heavy = e.heroic || e.kind === 'cragGolem' || e.kind === 'magmaHulk' ? .45 : 1, pull = Math.min(d * 2.5, 190) * heavy;
          if (d > 8) { e.x += (w.x - e.x) / d * pull * dt; e.y += (w.y - e.y) / d * pull * dt; }
          e.kx *= .5; e.ky *= .5; e.lunge = 0;
        }
        if (tick) this.damageEnemy(e, this.dmg('gravity'));
      }
      if (Math.random() < dt * 30 * this.fx) { const a = rand(0, 6.28), r = rand(60, R); this.particles.push({ x: w.x + Math.cos(a) * r, y: w.y + Math.sin(a) * r * .62, vx: -Math.cos(a) * r * 2.2 - Math.sin(a) * 90, vy: -Math.sin(a) * r * 1.4 + Math.cos(a) * 60, life: .45, max: .45, size: rand(2, 4), color: pick(['#b39cff', '#ffffff', '#6a4bd6', '#fff1b8']), kind: 'star', rot: 0, vr: 4, grav: 0, drag: 0, glow: true }); }
    }
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i]; m.t -= dt;
      if (m.e.dead) { swapRemove(this.marks, i); continue; }
      if (m.t > 0) continue;
      swapRemove(this.marks, i);
      const e = m.e, dmg = this.dmg('deathmark') * m.mul;
      this.damageEnemy(e, dmg, true);
      for (const o of this.enemies) if (o !== e && !o.dead && this.canHurt(o) && Math.abs(o.x - e.x) < 220 && dist(o, e) < 170 + o.r) this.damageEnemy(o, dmg * .4);
      this.ring(e.x, e.y, 170, '#ff6b9a', .6); this.ring(e.x, e.y, 90, '#ffffff', .35);
      this.emit(e.x, e.y, 40, ['#ff6b9a', '#2a1838', '#e0c8ff', '#ffffff'], { speed: 360, life: .7, kind: 'star', glow: true, size: 5 });
      this.flash = Math.max(this.flash, .25); this.addShake(8); this.freeze(.05); this.play('boom', e);
    }
    for (let i = this.storms.length - 1; i >= 0; i--) {
      const s = this.storms[i]; s.t -= dt; s.tick -= dt;
      if (s.t <= 0) { swapRemove(this.storms, i); continue; }
      if (Math.random() < dt * 40 * this.fx) this.emit(s.x + rand(-170, 170), s.y + rand(-150, 90), 1, ['#ffffff', '#dff6ff'], { speed: 40, life: .8, size: 3, grav: 160, angle: Math.PI / 2 + .3, spread: .3 });
      if (s.tick <= 0) {
        s.tick = .22;
        const a = rand(0, 6.28), r = rand(0, 150), x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r * .8;
        this.hazards.push({ x, y, r: 66, delay: .35, maxDelay: .35, damage: this.dmg('blizzard'), level: 0, owner: 'hero', kind: 'blizzard', fromX: x + 80, fromY: y - 380 });
      }
    }
  }
  private sunfire() {
    const h = this.hero, target = this.nearestTarget(620);
    let dx = h.faceX, dy = h.faceY;
    if (target) { const d = Math.max(1, dist(h, target)); dx = (target.x - h.x) / d; dy = (target.y - h.y) / d; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    this.projectiles.push({ x: h.x + dx * 30, y: h.y - 14 + dy * 30, vx: dx * 470, vy: dy * 470, life: 1.3, r: 14, damage: this.dmg('sunfire'), level: 0, owner: 'hero', kind: 'sunfire', spin: 0 });
    this.emit(h.x + dx * 30, h.y - 14 + dy * 30, 16, ['#ffd27a', '#ff9a4a', '#fff1b8'], { speed: 180, life: .4, kind: 'ember', glow: true, angle: Math.atan2(dy, dx), spread: 1.4 });
    this.addShake(3); this.play('sunfire');
  }
  private explodeSunfire(x: number, y: number) {
    this.ring(x, y, 105, '#ffb05c', .45); this.ring(x, y, 60, '#fff1b8', .3);
    this.emit(x, y, 36, ['#ffd27a', '#ff9a4a', '#ff6b3d', '#fff1b8'], { speed: 360, life: .7, kind: 'ember', glow: true, size: 5 });
    this.emit(x, y, 10, 'rgba(90,60,50,.5)', { speed: 90, life: 1, kind: 'smoke', size: 16 });
    this.flash = Math.max(this.flash, .25);
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist({ x, y }, e) < 100 + e.r) { this.damageEnemy(e, this.dmg('sunfire')); this.knock(e, { x, y }, e.boss ? 15 : 200); }
    for (const p of this.pods) if (!p.dead && dist({ x, y }, p) < 100) this.breakPod(p);
    this.addShake(9); this.freeze(.05); this.play('boom', { x, y });
  }
  /** Kael's Shield Wall: a ward that blocks everything, bounces projectiles and shoves foes back. */
  private shieldWall() {
    const h = this.hero; h.shieldTime = this.durationOf('guard', 3); h.slowT = 0;
    this.ring(h.x, h.y, 70, '#b8c8e0', .4);
    this.emit(h.x, h.y, 30, ['#dfe8f5', '#b8c8e0', '#ffffff'], { speed: 200, life: .6, kind: 'shard', size: 5 });
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist(h, e) < 110 + e.r) { e.windup = 0; e.cd = Math.max(e.cd, 1.3); this.damageEnemy(e, this.dmg('guard')); this.knock(e, h, e.boss ? 10 : 220); }
    this.play('shield');
  }
  private starfall() {
    const h = this.hero;
    const targets = this.enemies.filter(e => !e.dead && this.canHurt(e) && Math.abs(e.x - h.x) < 480 && dist(h, e) < 480).sort((a, b) => dist(h, a) - dist(h, b)).slice(0, 5);
    const spots: Point[] = targets.map(t => ({ x: t.x, y: t.y }));
    while (spots.length < 9) { const a = rand(0, 6.28), r = rand(60, 300); spots.push({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r }); }
    spots.forEach((s, i) => { const delay = .35 + i * .12; this.hazards.push({ x: s.x, y: s.y, r: 72, delay, maxDelay: delay, damage: this.dmg('starfall'), level: 0, owner: 'hero', kind: 'starfall', fromX: s.x + 260, fromY: s.y - 560 }); });
    this.flash = .3; this.play('starfall');
  }

  // ───────────────────────────── quests
  quest(id: string) { return this.questById.get(id); }
  private qs(id: string) { return this.quests.get(id)!; }
  private touchQuests() { this.markerVersion++; }
  questsFor(npcId: string) { return this.world.quests.filter(q => q.giver === npcId); }
  /** Who a finished quest is handed in to. */
  private reportTo(q: QuestDef) { return q.turnIn || q.giver; }
  /** Quests that finish by speaking with `to`. */
  private isTalk(q: QuestDef) { return q.kind === 'deliver' || q.kind === 'talk'; }
  /** The main story quest being worked on: the first one not yet done. */
  currentMain(): QuestDef | null { return this.world.quests.find(q => q.main && this.qs(q.id).status !== 'done') || null; }
  /** Marker over a villager's head. Main quests (gold) win over side quests (blue), hand-ins over offers. */
  npcMarker(n: Npc): { mark: '!' | '?'; main: boolean } | null {
    if (this.markerCacheVersion !== this.markerVersion) { this.markerCache.clear(); this.markerCacheVersion = this.markerVersion; }
    const cached = this.markerCache.get(n.id);
    if (cached !== undefined) return cached;
    let found: { mark: '!' | '?'; main: boolean } | null = null;
    for (const q of this.world.quests) {
      const st = this.qs(q.id).status, main = !!q.main;
      const mark = (st === 'ready' && this.reportTo(q) === n.id) || (st === 'active' && this.isTalk(q) && q.to === n.id) ? '?' : st === 'available' && q.giver === n.id ? '!' : null;
      if (!mark) continue;
      if (!found || (main && !found.main) || (main === found.main && mark === '?')) found = { mark, main };
    }
    this.markerCache.set(n.id, found);
    return found;
  }
  /** Every quest also pays out one item; quests without a set one get a fixed pick so the offer can name it. */
  rewardItem(q: QuestDef): ItemId { return q.reward.item ?? QUEST_ITEMS[[...q.id].reduce((a, c) => a + c.charCodeAt(0), 0) % QUEST_ITEMS.length]; }
  /** Side quests pay a rare piece of equipment, guardians an epic one. It is fixed per quest and hero, so the offer can show it. */
  rewardGear(q: QuestDef): GearItem | null {
    const rarity: Rarity | null = !q.main ? 'rare' : q.kind === 'boss' ? 'epic' : q.kind === 'rescue' ? 'rare' : null;
    if (!rarity) return null;
    const lv = this.region(q.region).levels, r = seeded(`${q.id}:${this.heroId}`);
    return makeGear({ ilvl: q.kind === 'boss' ? lv[1] + 1 : Math.round(lv[0] + (lv[1] - lv[0]) * .6), rarity, rand: r, uid: `q-${q.id}`, hero: this.heroId });
  }
  private rewardXp(q: QuestDef) { return Math.round(q.reward.xp * this.region(q.region).xpScale); }
  private rewardGold(q: QuestDef) { return q.reward.gold ?? Math.round(q.reward.xp * this.region(q.region).xpScale * .3 / 5) * 5; }
  /** What a quest pays, as one line. It depends only on the quest and the hero, so each is worked out once (the quest
   *  rows in every snapshot ask for all of them). */
  rewardText(q: QuestDef) {
    let text = this.rewardTexts.get(q.id);
    if (text === undefined) { text = this.makeRewardText(q); this.rewardTexts.set(q.id, text); }
    return text;
  }
  private rewardTexts = new Map<string, string>();
  private makeRewardText(q: QuestDef) {
    const r = q.reward, parts = [`${this.rewardXp(q)} XP`, `${this.rewardGold(q)} gold`];
    if (r.hearts) parts.push(`+${r.hearts * HP_UNIT} max health`);
    if (r.mana) parts.push(`+${r.mana} max magic`);
    if (r.regen) parts.push('faster magic');
    parts.push(ITEMS[this.rewardItem(q)].name);
    const g = this.rewardGear(q); if (g) parts.push(`${g.name} (${RARITY[g.rarity].name})`);
    return parts.join(' · ');
  }
  private offerQuest(q: QuestDef, n: Npc, before: string[] = []) {
    const offer: QuestOffer = { id: q.id, title: q.title, summary: q.summary, reward: this.rewardText(q), main: !!q.main };
    sfx.play('talk'); this.eventHandler({ type: 'dialogue', speaker: n.name, portrait: n.portrait, lines: this.personal([...before, ...this.tx(q).offer]), offer });
  }
  /** Called by the UI when the player presses Accept on an offer. */
  acceptQuest(id: string) {
    const q = this.quest(id); if (!q) return;
    const st = this.qs(q.id); if (st.status !== 'available') return;
    st.status = 'active'; st.progress = 0; this.touchQuests(); this.abandoned.delete(q.id);
    if (!q.main) this.tracked = q.id;
    this.eventHandler({ type: 'quest', title: q.title, state: 'accepted' }); this.play('quest');
    // Anything already done before accepting still counts.
    const already = q.kind === 'collect' || q.kind === 'build' ? this.world.objects.filter(o => o.questId === q.id && o.kind === 'questItem' && this.got.has(o.id)).length
      : q.kind === 'key' ? q.keys!.filter(i => this.main.keys.includes(this.keyId(q, i))).length
        : q.kind === 'visit' ? Number(this.discovered.has(q.place!)) : q.kind === 'boss' ? Number(this.main.bosses.includes(q.boss!)) : 0;
    if (already) this.advance(q, already);
    if (q.kind === 'rescue') this.spawnGuards(q);
    if (q.kind === 'escort') this.spawnFollower(q, this.escortStart(q));
    if (q.kind === 'chase') this.spawnThief(q);
    if (q.kind === 'herd') this.spawnHerd(q);
    // The last quest's own scene plays when Umbra rises on its throne, in the depths.
    if (q.cine?.start && q.kind !== 'defend' && !this.isFinal(q)) this.queueCine(q.cine.start, this.cineCtx(q));
    if (this.isFinal(q)) this.queueCine('depths-fall', {}, () => this.descend(true));
    else if (q.kind === 'boss' && !this.main.bosses.includes(q.boss!)) { const e = this.enemies.find(x => x.id === q.boss); if (e) { this.notice(`The seal on ${this.bossName(e)} is breaking…`, 'epic', 'The seal breaks!'); this.addShake(6); } }
  }
  /** The last quest of the story: Umbra. */
  private isFinal(q: QuestDef) { return q.kind === 'boss' && !!q.boss?.endsWith(':final'); }
  private get finalQuest() { return this.world.quests.find(q => this.isFinal(q)) || null; }
  /** Umbra has been beaten (the story's Umbra, not an echo). */
  get umbraBeaten() { const q = this.finalQuest; return !!q && this.main.bosses.includes(q.boss!); }
  /** A quest can be given up while it is under way, except a guardian's fight and a siege being fought. */
  canAbandon(id: string) {
    const q = this.quest(id), s = this.quests.get(id)?.status;
    return !!q && (s === 'active' || s === 'ready') && q.kind !== 'boss' && this.siege?.q !== q && this.work?.q !== q;
  }
  /**
   * Gives a quest up. It goes back to whoever gave it (and into the journal), to be taken up again from the start:
   * followers, thieves and herds go home, rescue guards and siege attackers melt away, and lanterns, runes, clues and
   * cages are reset. Things gathered for a collect or build quest are kept and count again when it is taken back.
   */
  abandonQuest(id: string) {
    if (!this.canAbandon(id)) return false;
    const q = this.quest(id)!, st = this.qs(id);
    st.status = 'available'; st.progress = 0; this.abandoned.add(id);
    this.removeQuestNpcs(id);
    for (let i = this.critters.length - 1; i >= 0; i--) if (this.critters[i].herd === id) this.critters.splice(i, 1);
    for (const e of this.enemies) if (e.guard === id && !e.dead) { e.dead = true; e.deadT = 0; this.emit(e.x, e.y, 10, ['#1a1030', '#6a4bd6'], { speed: 120, life: .6, kind: 'smoke', size: 10 }); }
    this.ambushes = this.ambushes.filter(a => a.q !== id);
    for (const o of this.world.objects) if (o.questId === id && o.kind !== 'questItem') this.got.delete(o.id);
    if (this.tracked === id) this.tracked = null;
    this.touchQuests(); this.play('page');
    this.eventHandler({ type: 'quest', title: q.title, state: 'abandoned' });
    this.notice(`${q.title}: abandoned. Take it up again from the journal${q.giver === 'fox' ? '' : ' or ' + (this.npcs.find(n => n.id === q.giver)?.name || 'its giver')}.`, 'info', 'Quest abandoned');
    return true;
  }
  /** Takes an abandoned quest up again straight from the journal. */
  resumeQuest(id: string) {
    if (!this.abandoned.has(id) || this.qs(id).status !== 'available') return false;
    const q = this.quest(id)!; this.acceptQuest(id);
    if (q.main) this.tracked = null;
    return true;
  }
  /** The relic a key quest wants: the land's own, or one a hero's story hides at the quest's `place`. */
  private keyId(q: QuestDef, i: number) { return q.hero && q.place ? `${q.id}-key-${i}` : `${q.region}:key-${i}`; }
  private advance(q: QuestDef, by: number) {
    const st = this.qs(q.id); if (st.status !== 'active') return;
    st.progress = Math.min(q.count, st.progress + by); this.touchQuests();
    if (q.kind === 'boss') {
      if (st.progress < q.count) return;
      if (q.finale) this.notice(`${q.title}: restore the ${this.region(q.region).script.finaleName}.`, 'good', 'Restore the light');
      else this.complete(q, null, [], true);
      return;
    }
    if (q.kind === 'build') {
      if (st.progress >= q.count) { this.notice(`All the ${q.item?.toLowerCase()} is gathered. Now build the ${q.siteName?.toLowerCase() || 'site'}!`, 'good', 'Now build it!'); this.play('quest'); }
      else this.notice(`${q.item} ${st.progress}/${q.count}`, 'good', `${st.progress}/${q.count}`);
      return;
    }
    if (st.progress >= q.count && q.auto) { this.autoComplete(q); return; }
    if (st.progress >= q.count) {
      st.status = 'ready';
      this.eventHandler({ type: 'quest', title: q.title, state: 'ready' }); this.play('quest');
      const to = this.npcs.find(n => n.id === this.reportTo(q));
      this.notice(`${q.title}: report to ${to?.name || 'the quest giver'}.`, 'good', `Report to ${to?.name.split(' ').pop() || 'giver'}`);
      if (q.cine?.ready) this.queueCine(q.cine.ready, this.cineCtx(q));
    } else if (q.kind !== 'collect') this.notice(`${q.title} ${st.progress}/${q.count}`, 'info', `${st.progress}/${q.count}`);
  }
  private complete(q: QuestDef, speaker: Npc | null, lines: string[], silent = false) {
    const st = this.qs(q.id); st.status = 'done'; this.touchQuests();
    const r = q.reward, first = !this.profile.claimed.includes(q.id);
    if (first) {
      this.profile.claimed.push(q.id);
      if (r.hearts) this.profile.bonusHearts += r.hearts;
      if (r.mana) this.profile.bonusMana += r.mana;
      if (r.regen) this.profile.regen += r.regen;
    }
    this.refreshStats(false);
    if (r.hearts) this.hero.hp = this.hero.maxHp;
    if (r.regen) this.hero.mana = this.hero.maxMana;
    const h = this.hero;
    this.emit(h.x, h.y, 34, ['#fff1b8', '#b9f29d', '#ffffff'], { speed: 180, life: 1, kind: 'star', glow: true }); this.play('questDone');
    const xp = this.rewardXp(q);
    if (speaker && !silent) this.say(speaker.name, speaker.portrait, lines);
    this.eventHandler({ type: 'quest', title: q.title, state: 'completed', xp });
    this.gainXp(xp); this.gainGold(this.rewardGold(q));
    this.addItem(this.rewardItem(q));
    if (!q.main) this.bump('sideQuests');
    if (q.kind === 'rescue') this.bump('rescues');
    const gear = first ? this.rewardGear(q) : null;
    if (gear) this.addGear(gear);
    if (this.tracked === q.id) this.tracked = this.world.quests.find(x => !x.main && (this.qs(x.id).status === 'active' || this.qs(x.id).status === 'ready'))?.id || null;
    for (const other of this.world.quests) if (other.requires === q.id && this.qs(other.id).status === 'locked') {
      this.qs(other.id).status = 'available';
      if (other.giver === 'fox') this.foxQueue.push(other.id);
    }
    this.removeQuestNpcs(q.id);
    if (this.siege?.q === q) this.siege = null;
    if (q.cine?.done) this.queueCine(q.cine.done, this.cineCtx(q));
    if (q.main) {
      const mains = this.world.quests.filter(x => x.main && x.region === q.region);
      if (mains[mains.length - 1] === q && mains.every(x => this.qs(x.id).status === 'done')) this.endChapter(q.region);
    }
  }
  track(id: string) { if (this.quests.has(id)) this.tracked = id; }
  /** Tuft's nudges (the next chapter's opener) start on their own once the fireworks are over. */
  private flushFox() {
    if (!this.foxQueue.length || this.needsIntro || this.completeTimer > 0 || this.foxDelay > 0 || this.cinePlaying) return;
    const id = this.foxQueue.shift()!, q = this.quest(id);
    if (!q || this.qs(id).status !== 'available') return;
    const voice = this.guideVoice; this.say(voice.name, voice.portrait, this.tx(q).offer);
    this.acceptQuest(id);
  }

  // ───────────────────────────── cutscenes
  /** Plays a cutscene as soon as nothing else is on screen (dialogue, fireworks). `ctx` names quest spots such as '$ward'. */
  queueCine(id: string, ctx: Record<string, Point> = {}, then?: () => void) {
    if (!cineFor(id, this.heroId)) { then?.(); return; }
    this.cineQueue.push({ id, ctx, then });
  }
  get cinePlaying() { return !!this.cine || this.cineQueue.length > 0; }
  private beginCine(next: { id: string; ctx: Record<string, Point>; then?: () => void }) {
    const shots = cineFor(next.id, this.heroId); if (!shots) { next.then?.(); return; }
    this.cine = { id: next.id, shots, i: -1, t: 0, dur: 0, cutT: 0, pending: null, ctx: next.ctx, then: next.then, timers: [] };
    this.setMovement(0, 0); this.hero.vx = this.hero.vy = 0; this.work = null;
    this.nextShot();
  }
  /** Where a shot or an effect looks: a place, a person, an object, the hero or a quest spot, moved by dx/dy. */
  /** The land's light (Beacon, Bell, Star or Forge) nearest a point. */
  private nearestFinale(p: Point) { let best: WorldObject | null = null, bd = Infinity; for (const o of this.world.objects) if (o.kind === 'finale') { const d = dist(o, p); if (d < bd) { bd = d; best = o; } } return best; }
  /** A land's light as drawn: lit for real, or burning in a cutscene of the night it went out. */
  finaleShining(region: RegionId) { return this.finaleLit(region) || this.cineLit === region; }
  private cineAt(ref: string | undefined, dx = 0, dy = 0): Point {
    const c = this.cine, base = this.cineFocus || c?.pending || this.hero;
    let p: Point = base;
    if (ref === 'hero') p = this.hero;
    else if (ref?.startsWith('$')) p = c?.ctx[ref] || base;
    else if (ref?.startsWith('npc:')) p = this.npcs.find(n => n.id === ref.slice(4)) || base;
    else if (ref?.startsWith('obj:')) p = this.world.objects.find(o => o.id === ref.slice(4)) || base;
    else if (ref) p = this.world.pois.find(z => z.id === ref) || base;
    return { x: p.x + dx, y: p.y + dy };
  }
  private nextShot() {
    const c = this.cine!; c.i++;
    if (c.i >= c.shots.length) { this.endCine(); return; }
    const s = c.shots[c.i];
    c.t = 0; c.dur = s.dur ?? clamp(2 + (s.text?.length || 0) * .045, 3, 8);
    if (s.night !== undefined) this.cineNight = s.night;
    let delay = 0;
    if (s.at) {
      const p = this.cineAt(s.at, s.dx, s.dy), from = this.cineFocus || this.hero;
      if (s.cut || (!this.cineFocus && dist(from, p) > 900) || dist(from, p) > 4200) { c.cutT = .6; c.pending = p; delay = .3; } else this.cineFocus = p;
    } else if (!this.cineFocus) this.cineFocus = { x: this.hero.x, y: this.hero.y };
    for (const f of s.fx || []) c.timers.push({ t: (f.delay || 0) + delay, fx: f });
    for (const a of s.actors || []) {
      if (this.npcs.some(n => n.id === `actor:${a.id}`)) continue;
      const at = c.pending || this.cineFocus || this.hero, x = at.x + (a.dx || 0), y = at.y + (a.dy || 0);
      const n = this.tempNpc(`actor:${a.id}`, a.name || '', '', { skin: '#f0c8a2', robe: '#8a6fb0', hat: 'none', hatColor: '#5b5480', hair: '#6b3f2a', ...a.look }, x, y, 'actor');
      n.beast = a.beast; n.spirit = a.spirit; n.faceX = a.face || 1;
      if (a.walk) { n.tx = x + a.walk.dx; n.ty = y + a.walk.dy; n.moving = true; }
      this.npcs.push(n);
    }
  }
  /** Tapping moves to the next shot; skipping ends the whole cutscene. */
  advanceCine() { const c = this.cine; if (c && c.t > .45 && c.cutT <= 0) this.nextShot(); }
  skipCine() { if (this.cine) this.endCine(); }
  private endCine() {
    const c = this.cine; if (!c) return;
    // Effects still waiting (a skip) happen at once, so nothing the story needs is lost.
    for (const t of c.timers) this.cineFx(t.fx);
    this.cine = null; this.cineLit = null;
    for (let i = this.npcs.length - 1; i >= 0; i--) if (this.npcs[i].role === 'actor') this.npcs.splice(i, 1);
    for (const e of this.enemies) if (e.cineOnly && !e.dead) { e.dead = true; e.deadT = 0; this.emit(e.x, e.y, 10, ['#1a1030', '#6a4bd6', '#c9b6ff'], { speed: 120, life: .6, kind: 'smoke', size: 10 }); }
    if (this.cineFocus && dist(this.cineFocus, this.hero) > 700) { this.cineFade = 1; this.camCut++; }
    this.cineFocus = null; this.markerVersion++; this.cineNight = 0;
    c.then?.();
  }
  private updateCine(dt: number) {
    const c = this.cine!;
    c.t += dt;
    if (c.cutT > 0) {
      c.cutT -= dt; this.cineFade = c.cutT > .3 ? Math.min(1, (.6 - c.cutT) / .3) : Math.max(0, c.cutT / .3);
      if (c.pending && c.cutT <= .3) { this.cineFocus = c.pending; c.pending = null; this.camCut++; }
    }
    for (let i = c.timers.length - 1; i >= 0; i--) { const t = c.timers[i]; t.t -= dt; if (t.t <= 0) { c.timers.splice(i, 1); this.cineFx(t.fx); } }
    if (this.cine === c && c.t >= c.dur && c.cutT <= 0) this.nextShot();
  }
  /** The world effects a cutscene uses to show that something happened. */
  private cineFx(f: CineFx) {
    const p = this.cineAt(f.at, f.dx, f.dy), acc = this.regionAt(p.x).palette.accent;
    switch (f.kind) {
      case 'starfall': this.meteors.push({ x0: p.x - 1100, y0: p.y - 1300, x1: p.x, y1: p.y, t: 0, dur: 1.3, dark: false }); this.play('starfall'); break;
      case 'smoke': this.meteors.push({ x0: p.x, y0: p.y, x1: p.x + (f.to?.dx ?? 1400), y1: p.y + (f.to?.dy ?? 600), t: 0, dur: 2.4, dark: true }); this.play('voidShot'); break;
      case 'shadow':
        this.emit(p.x, p.y, 60, ['#1a1030', '#3a2a6a', '#6a4bd6', '#c9b6ff'], { speed: 320, life: 1.4, kind: 'smoke', size: 22, drag: 1.8 });
        this.emit(p.x, p.y, 30, ['#c9b6ff', '#ff6b9a'], { speed: 420, life: 1, kind: 'star', glow: true, size: 5 });
        this.ring(p.x, p.y, 240, '#6a4bd6', 1); this.addShake(10); this.flash = Math.max(this.flash, .2); this.play('roar'); break;
      case 'gloom': case 'wolves': case 'imps': case 'wisps': {
        const kind: EnemyKind = f.kind === 'gloom' ? 'gloomling' : f.kind === 'wolves' ? 'shadewolf' : f.kind === 'imps' ? 'emberImp' : 'wisp';
        const n = f.n || 4, reg = this.regionAt(p.x);
        for (let i = 0; i < n; i++) {
          const a = i / n * 6.28 + rand(0, .8), r = rand(60, 230), q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * .7 };
          this.collide(q, 24);
          const e = this.makeEnemy({ id: `cine-${this.summonCount++}`, kind, x: q.x, y: q.y, level: reg.levels[0], region: reg.id }, true);
          e.aggro = false; e.spawnT = .6 + i * .18; e.cineOnly = true; this.enemies.push(e);
          this.emit(q.x, q.y, 12, ['#1a1030', '#6a4bd6', '#c9b6ff'], { speed: 110, life: .8, kind: 'smoke', size: 12 });
        }
        this.play(f.kind === 'wolves' ? 'roar' : 'squeak'); break;
      }
      case 'fire': {
        const houses = this.obstacleGrid.near(p.x, p.y, 750).filter(o => o.kind === 'house' || o.kind === 'manor' || o.kind === 'tent' || o.kind === 'stall').sort((a, b) => dist(a, p) - dist(b, p)).slice(0, f.n || 2);
        const spots = houses.length ? houses.map(o => ({ x: o.x + rand(-20, 20), y: o.y - (o.kind === 'manor' ? 80 : 56) })) : [{ x: p.x, y: p.y }];
        for (const s of spots) this.fires.push({ x: s.x, y: s.y, t: f.t ?? 60, s: 1 });
        this.play('sunfire'); break;
      }
      case 'douse': for (let i = this.fires.length - 1; i >= 0; i--) { const fi = this.fires[i]; if (dist(fi, p) < 1200) { this.emit(fi.x, fi.y, 16, 'rgba(230,235,245,.6)', { speed: 90, life: 1.4, kind: 'smoke', size: 16, grav: -40 }); swapRemove(this.fires, i); } } break;
      case 'collapse':
        this.emit(p.x, p.y, 40, ['#8a6a48', '#6f5337', '#a8844a'], { speed: 320, life: 1, kind: 'shard', size: 7, grav: 600 });
        this.emit(p.x, p.y, 16, 'rgba(160,150,130,.5)', { speed: 140, life: 1.3, kind: 'smoke', size: 22 }); this.addShake(12); this.play('slam'); this.play('splash'); break;
      case 'light':
        this.ring(p.x, p.y, 420, acc, 1.3); this.ring(p.x, p.y, 200, '#fff1b8', .8);
        this.emit(p.x, p.y, 90, [acc, '#ffffff', '#fff1b8'], { speed: 460, life: 1.5, kind: 'star', glow: true, size: 6, drag: 1.6 });
        this.flash = Math.max(this.flash, .45); this.play('learn'); break;
      case 'build':
        this.emit(p.x, p.y, 30, 'rgba(200,180,140,.55)', { speed: 160, life: 1.1, kind: 'smoke', size: 16 });
        this.emit(p.x, p.y - 20, 30, ['#ffd35c', '#ffffff', '#c9a06a'], { speed: 260, life: 1, kind: 'star', glow: true, size: 5 }); this.play('hammer'); this.play('chest'); break;
      case 'shatter':
        this.emit(p.x, p.y - 40, 70, ['#dff6ff', '#9fd8ff', '#ffffff', '#6fb8e8'], { speed: 460, life: 1.2, kind: 'shard', size: 8, grav: 500 });
        this.ring(p.x, p.y, 260, '#bfe8ff', .9); this.flash = Math.max(this.flash, .35); this.addShake(12); this.play('reflect'); this.play('slam'); break;
      case 'wither':
        this.emit(p.x, p.y - 40, 60, ['#6a5a3a', '#8a7a4a', '#4a3a2a'], { speed: 260, life: 1.6, kind: 'leaf', size: 8, grav: 120 });
        this.emit(p.x, p.y, 20, 'rgba(120,100,80,.5)', { speed: 120, life: 1.4, kind: 'smoke', size: 20 }); this.play('pod'); break;
      case 'memory':
        this.emit(p.x, p.y - 20, 60, ['#dff6ff', '#c9b6ff', '#ffffff'], { speed: 140, life: 2, kind: 'star', glow: true, size: 4, grav: -40, drag: 1 });
        this.ring(p.x, p.y, 180, '#dff6ff', 1.2); this.play('discover'); break;
      case 'quake': this.addShake(18); this.emit(p.x, p.y, 24, 'rgba(150,120,90,.5)', { speed: 200, life: 1, kind: 'smoke', size: 18 }); this.play('roar'); break;
      case 'ring': this.ring(p.x, p.y, 160, acc, 1); this.emit(p.x, p.y - 30, 30, [acc, '#ffffff'], { speed: 200, life: 1, kind: 'star', glow: true, size: 5 }); this.play('key'); break;
      // A land's light shown burning (it is still cold in the world), then put out with smoke and a burst of shadow.
      case 'kindle': { const f0 = this.nearestFinale(p); if (f0) { this.cineLit = f0.region; this.emit(f0.x, f0.y - 90, 24, ['#ffcf6e', '#ffffff', '#ff9a3c'], { speed: 120, life: .9, kind: 'ember', glow: true, size: 4, grav: -80 }); this.play('sunfire'); } break; }
      case 'snuff': {
        const f0 = this.nearestFinale(p); if (!f0) break;
        this.cineLit = null; const x = f0.x, y = f0.y - 90;
        this.emit(x, y, 50, ['#2a2438', '#3a3048', '#1a1030', 'rgba(90,80,110,.8)'], { speed: 90, life: 2.6, kind: 'smoke', size: 26, grav: -70, drag: .8 });
        this.emit(x, y, 26, ['#ffcf6e', '#ff9a3c'], { speed: 260, life: .6, kind: 'ember', glow: true, size: 3, grav: 200 });
        this.emit(x, y + 40, 40, ['#1a1030', '#3a2a6a', '#6a4bd6'], { speed: 280, life: 1.4, kind: 'smoke', size: 20, drag: 1.6 });
        this.ring(x, y + 60, 300, '#6a4bd6', 1.2); this.addShake(8); this.play('voidShot'); this.play('roar'); break;
      }
      case 'feathers': for (let i = 0; i < (f.n || 22); i++) this.emit(p.x + rand(-160, 160), p.y - rand(80, 220), 1, pick(['#141018', '#2a2438', '#3a3048']), { speed: 30, life: rand(2.2, 3.4), kind: 'leaf', size: rand(7, 11), grav: 26, drag: .9 }); this.play('flap'); break;
      case 'letters': for (let i = 0; i < (f.n || 14); i++) this.emit(p.x + rand(-40, 40), p.y - rand(10, 60), 1, pick(['#f4ecd8', '#ffffff', '#e8dcc0']), { speed: rand(120, 260), angle: rand(-.9, .3), spread: .2, life: rand(1.6, 2.6), kind: 'leaf', size: rand(8, 12), grav: 20, drag: .7 }); this.play('page'); break;
      case 'frost':
        this.ring(p.x, p.y, 320, '#bfe8ff', 1.4); this.ring(p.x, p.y, 160, '#ffffff', .9);
        this.emit(p.x, p.y, 60, ['#dff6ff', '#9fd8ff', '#ffffff'], { speed: 300, life: 1.6, kind: 'shard', size: 5, drag: 2 });
        this.emit(p.x, p.y - 30, 40, ['#ffffff', '#bfe8ff'], { speed: 90, life: 2.4, kind: 'star', glow: true, size: 3, grav: 30 }); this.play('reflect'); break;
      case 'howl': this.ring(p.x, p.y - 20, 260, 'rgba(223,246,255,.8)', 1.6); this.ring(p.x, p.y - 20, 420, 'rgba(223,246,255,.4)', 2.2); this.emit(p.x, p.y - 40, 16, ['#ffffff', '#dff6ff'], { speed: 60, life: 2, kind: 'star', glow: true, size: 3, grav: -30 }); this.play('howl'); break;
      case 'lantern': this.meteors.push({ x0: p.x, y0: p.y, x1: p.x + (f.to?.dx ?? 900), y1: p.y + (f.to?.dy ?? -300), t: 0, dur: 3.6, dark: false }); this.play('orb'); break;
      case 'embers': this.emit(p.x, p.y, f.n || 50, ['#ffcf6e', '#ff9a3c', '#ff6b3c'], { speed: 90, life: 2.2, kind: 'ember', glow: true, size: 3, grav: -90, spread: 3.14 }); this.play('sunfire'); break;
    }
  }
  /** Meteors and cutscene fires. */
  private updateFx(dt: number) {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]; m.t += dt;
      const f = Math.min(1, m.t / m.dur), x = m.x0 + (m.x1 - m.x0) * f, y = m.y0 + (m.y1 - m.y0) * f;
      if (Math.random() < .8) this.emit(x, y, 2, m.dark ? ['#1a1030', '#3a2a6a', '#6a4bd6'] : ['#fff1b8', '#ffd35c', '#ffffff'], { speed: 40, life: m.dark ? 1.2 : .7, kind: m.dark ? 'smoke' : 'star', glow: !m.dark, size: m.dark ? 14 : 5 });
      if (m.t >= m.dur) {
        swapRemove(this.meteors, i);
        const close = Math.abs(m.x1 - this.hero.x) < 1600 && Math.abs(m.y1 - this.hero.y) < 1400;
        if (!m.dark) { this.flash = Math.max(this.flash, close ? .7 : .12); this.addShake(close ? 18 : 4); this.ring(m.x1, m.y1, 380, '#fff1b8', 1.1); this.emit(m.x1, m.y1, 90, ['#fff1b8', '#ffd35c', '#ff9a4a', '#ffffff'], { speed: 520, life: 1.4, kind: 'star', glow: true, size: 6 }); this.play('slam'); }
      }
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const fi = this.fires[i]; fi.t -= dt;
      if (fi.t <= 0) { swapRemove(this.fires, i); continue; }
      if (Math.abs(fi.x - this.hero.x) > 1800 && !this.cine) continue;
      if (Math.random() < dt * 22 * this.fx) this.emit(fi.x + rand(-26, 26), fi.y, 1, ['#ffcf6e', '#ff9a4a', '#ff5f3d'], { speed: 60, life: .8, kind: 'ember', glow: true, size: 4, grav: -120 });
      if (Math.random() < dt * 5 * this.fx) this.emit(fi.x + rand(-20, 20), fi.y - 20, 1, 'rgba(60,50,50,.45)', { speed: 30, life: 2, kind: 'smoke', size: 20, grav: -50 });
    }
  }

  // ───────────────────────────── quest people: followers, thieves, herds
  private tempNpc(id: string, name: string, portrait: string, look: NpcLook, x: number, y: number, role: 'follower' | 'thief' | 'actor'): Npc {
    return { id, name, portrait, look, activity: 'idle', x, y, region: this.regionAt(x).id, role, lines: [], barks: [], homeX: x, homeY: y, tx: x, ty: y, moving: false, faceX: 1, waitT: 0, routeI: 0, routeDir: 1, workT: 0, bark: '', barkT: 0, barkCd: 3, walkT: 0, poiName: this.poiAt({ x, y })?.name || '' };
  }
  private poi(id?: string) { return id ? this.world.pois.find(p => p.id === id) || null : null; }
  private followerOf(qid: string) { return this.npcs.find(n => n.role === 'follower' && n.quest === qid) || null; }
  private thiefOf(qid: string) { return this.npcs.find(n => n.role === 'thief' && n.quest === qid) || null; }
  private removeQuestNpcs(qid: string) { for (let i = this.npcs.length - 1; i >= 0; i--) if (this.npcs[i].quest === qid && this.npcs[i].role !== 'villager') this.npcs.splice(i, 1); }
  /** Where an escort ends: the place it names, or (after a rescue) whoever the captive is brought home to. */
  private escortGoal(q: QuestDef): Point | null {
    if (q.kind === 'escort') return this.poi(q.place);
    const to = this.npcs.find(n => n.id === this.reportTo(q)); return to ? { x: to.x, y: to.y } : null;
  }
  private spawnFollower(q: QuestDef, at: Point) {
    if (this.followerOf(q.id)) return;
    const c = q.who || q.captive; if (!c) return;
    const n = this.tempNpc(`${q.id}:follower`, c.name, c.portrait, c.look, at.x, at.y, 'follower');
    n.quest = q.id; n.beast = q.beast === 'wolf'; n.spirit = n.beast; this.npcs.push(n);
    // Two ambushes wait along the way, ahead of where the walk starts.
    const goal = this.escortGoal(q); if (!goal) return;
    const d0 = dist(at, goal), nx = -(goal.y - at.y) / Math.max(1, d0), ny = (goal.x - at.x) / Math.max(1, d0);
    if (d0 < 900) return;
    for (const f of [.35, .72]) this.ambushes.push({ q: q.id, x: at.x + (goal.x - at.x) * f + nx * 170, y: at.y + (goal.y - at.y) * f + ny * 170, done: false });
  }
  private updateFollower(n: Npc, dt: number) {
    const q = this.quest(n.quest!); if (!q) return;
    const h = this.hero, st = this.qs(q.id);
    n.barkT = Math.max(0, n.barkT - dt); n.barkCd -= dt;
    const say = (lines: string[]) => { if (n.barkCd <= 0) { n.bark = pick(lines); n.barkT = 2.6; n.barkCd = rand(5, 8); } };
    if (st.status !== 'active') { n.moving = false; n.faceX = h.x > n.x ? 1 : -1; return; }
    const threat = this.enemies.some(e => !e.dead && e.spawnT <= 0 && !e.boss && (e.aggro || e.guard === q.id) && Math.abs(e.x - n.x) < 480 && Math.abs(e.y - n.y) < 480 && dist(e, n) < 460);
    n.scared = threat;
    const dh = dist(h, n);
    if (threat) { n.moving = false; say(n.beast ? ['(whimpers)', '(growls, hackles up)'] : ['Eek! Keep them away!', 'Help!', 'I can’t go on with those things here!']); }
    else if (dh > 760) { n.moving = false; say(n.beast ? ['(howls for you)'] : ['Wait for me!', 'Not so fast!', 'Don’t leave me behind!']); }
    else if (dh > 90) {
      const sp = this.riding ? 340 : 240, dx = h.x - n.x, dy = h.y - n.y, ox = n.x, oy = n.y;
      n.x += dx / dh * sp * dt; n.y += dy / dh * sp * dt; n.moving = true; n.walkT += dt * sp / 18;
      if (Math.abs(dx) > 2) n.faceX = dx > 0 ? 1 : -1;
      this.collide(n, 14);
      // Caught on a tree or a wall for a while: catch up behind the hero instead of walking on the spot.
      n.restT = Math.hypot(n.x - ox, n.y - oy) < sp * dt * .3 ? (n.restT || 0) + dt : 0;
      if (n.restT > 1.2 && dh > 160) { const p = { x: h.x - (dx / dh) * 70, y: h.y - (dy / dh) * 70 }; this.collide(p, 14); n.x = p.x; n.y = p.y; n.restT = 0; this.emit(n.x, n.y, 8, 'rgba(220,200,150,.55)', { speed: 60, life: .5, kind: 'smoke', size: 8 }); }
    } else { n.moving = false; n.faceX = h.x > n.x ? 1 : -1; }
    const goal = this.escortGoal(q);
    if (goal && dist(n, goal) < 200) {
      const lines = this.tx(q).arrive || [];
      if (q.auto) { st.progress = q.count; this.autoComplete(q, lines); return; }
      if (lines.length) this.say(n.name, n.portrait, lines);
      this.advance(q, q.count - st.progress);
    }
  }
  private checkAmbushes() {
    for (const a of this.ambushes) {
      if (a.done) continue;
      const q = this.quest(a.q), f = this.followerOf(a.q);
      if (!q || this.qs(q.id).status !== 'active') { a.done = true; continue; }
      if (!f || dist(f, a) > 640) continue;
      a.done = true;
      const reg = this.region(q.region), kinds: EnemyKind[] = q.ambush?.length ? q.ambush : this.world.enemies.filter(e => e.region === q.region && !e.boss && Math.abs(e.x - a.x) < 2000).map(e => e.kind).slice(0, 6);
      const near = this.world.enemies.filter(e => e.region === q.region && !e.boss && Math.abs(e.x - a.x) < 1600 && Math.abs(e.y - a.y) < 1600);
      const level = near.length ? Math.round(near.reduce((s, e) => s + e.level, 0) / near.length) : reg.levels[0];
      for (let i = 0; i < 3; i++) {
        const ang = i / 3 * 6.28, p = { x: a.x + Math.cos(ang) * 90, y: a.y + Math.sin(ang) * 70 }; this.collide(p, 24);
        const e = this.makeEnemy({ id: `${q.id}-amb-${this.summonCount++}`, kind: kinds.length ? kinds[i % kinds.length] : 'gloomling', x: p.x, y: p.y, level, region: q.region, guard: q.id, elite: i === 0 });
        e.aggro = true; e.spawnT = .7; this.enemies.push(e);
        this.emit(p.x, p.y, 14, ['#1a1030', '#6a4bd6', '#c9b6ff'], { speed: 140, life: .7, kind: 'smoke', size: 12 });
      }
      this.notice(`Ambush! Protect ${f.name}!`, 'warn', 'Ambush!'); this.play('roar'); this.addShake(6);
    }
  }
  private spawnThief(q: QuestDef) {
    if (this.thiefOf(q.id) || !q.who) return;
    const p = this.poi(q.place) || this.hero, s = { x: p.x + 60, y: p.y + 40 };
    // Never in the water: a place such as a lake gets its thief on the nearest dry ground around it.
    for (let i = 0, r = 0; i < 40 && inPond(this.world.ponds, s.x, s.y, 40); i++) { r += 60; const a = i * 2.4; s.x = p.x + Math.cos(a) * r; s.y = p.y + Math.sin(a) * r * .7; }
    this.collide(s, 20);
    const n = this.tempNpc(`${q.id}:thief`, q.who.name, q.who.portrait, q.who.look, s.x, s.y, 'thief');
    n.quest = q.id; n.tireT = 4; n.restT = 0; n.ang = 0; this.npcs.push(n);
  }
  private updateThief(n: Npc, dt: number) {
    const q = this.quest(n.quest!); if (!q || this.qs(q.id).status !== 'active') return;
    const h = this.hero, d = dist(h, n);
    n.barkT = Math.max(0, n.barkT - dt); n.barkCd -= dt; n.restT = Math.max(0, (n.restT || 0) - dt);
    if (d < 56 && !this.cine) { this.catchThief(q, n); return; }
    if (!n.scared) {
      n.moving = false; n.faceX = h.x > n.x ? 1 : -1;
      if (d < 380) { n.scared = true; n.tireT = rand(3.4, 4.6); n.bark = pick(['Can’t catch me!', 'Too slow!', 'Eep! Run!']); n.barkT = 2.4; this.play('squeak', n); this.notice(`${n.name} is getting away — catch them!`, 'warn', 'Catch them!'); }
      return;
    }
    if (d > 1500) { n.scared = false; n.x = n.homeX; n.y = n.homeY; n.moving = false; this.notice(`${n.name} slipped away back to their hiding place.`, 'info', 'They got away'); return; }
    if (n.restT > 0) { n.moving = false; if (Math.random() < dt * 6) this.emit(n.x + n.faceX * 12, n.y - 30, 1, 'rgba(255,255,255,.6)', { speed: 20, life: .5, size: 3, grav: -20 }); return; }
    n.tireT = (n.tireT || 0) - dt;
    if (n.tireT <= 0) { n.restT = 1.15; n.tireT = rand(3.2, 4.6); n.bark = 'Huff… puff…'; n.barkT = 1.2; return; }
    // Runs from the hero with a pull back toward home, so the chase circles instead of crossing the map.
    let ax = (n.x - h.x) / Math.max(1, d), ay = (n.y - h.y) / Math.max(1, d);
    const hx = n.homeX - n.x, hy = n.homeY - n.y, hl = Math.hypot(hx, hy) || 1, pull = clamp((hl - 450) / 900, 0, .75);
    const a = Math.atan2(ay * (1 - pull) + hy / hl * pull, ax * (1 - pull) + hx / hl * pull) + (n.ang || 0) + Math.sin(this.elapsed * 1.7) * .3;
    ax = Math.cos(a); ay = Math.sin(a);
    const sp = 236, ox = n.x, oy = n.y;
    n.x = clamp(n.x + ax * sp * dt, 80, this.world.width - 80); n.y = clamp(n.y + ay * sp * dt, 80, this.world.height - 80);
    this.collide(n, 14);
    // Stuck against a tree or a wall: try another way.
    if (Math.hypot(n.x - ox, n.y - oy) < sp * dt * .35) n.ang = (n.ang || 0) + (Math.random() < .5 ? 1.3 : -1.3); else n.ang = (n.ang || 0) * Math.pow(.2, dt);
    n.moving = true; n.walkT += dt * sp / 16; if (Math.abs(ax) > .1) n.faceX = ax > 0 ? 1 : -1;
    if (Math.random() < dt * 6) this.emit(n.x, n.y + 18, 1, 'rgba(220,200,150,.55)', { speed: 30, life: .5, kind: 'smoke', size: 6 });
  }
  private catchThief(q: QuestDef, n: Npc) {
    const lines = this.tx(q).deliver || ['Alright, alright! You caught me!'], at = { x: n.x, y: n.y };
    this.npcs.splice(this.npcs.indexOf(n), 1);
    this.play('pickup'); this.emit(at.x, at.y - 20, 24, ['#fff1b8', '#ffffff'], { speed: 180, life: .8, kind: 'star', glow: true });
    if (q.escapes) this.cineFx({ kind: 'shadow', at: undefined, dx: 0, dy: 0 });
    if (q.cine?.caught) this.queueCine(q.cine.caught, { $thief: at }, () => this.say(n.name, n.portrait, lines));
    else this.say(n.name, n.portrait, lines);
    this.advance(q, 1);
  }
  private penOf(qid: string) { return this.world.objects.find(o => o.kind === 'pen' && o.questId === qid) || null; }
  private spawnHerd(q: QuestDef) {
    if (this.critters.some(c => c.herd === q.id)) return;
    const near = this.poi(q.near), pen = this.penOf(q.id); if (!near || !pen) return;
    const st = this.qs(q.id);
    // Two more than the quest needs, so one that wanders off never makes it impossible.
    for (let i = 0; i < q.count + HERD_SPARE; i++) {
      const penned = i < st.progress, a = rand(0, 6.28), r = penned ? rand(0, 50) : rand(260, 620);
      const base = penned ? pen : near, p = { x: base.x + Math.cos(a) * r, y: base.y + Math.sin(a) * r * .7 };
      if (!penned) { this.collide(p, 14); if (inPond(this.world.ponds, p.x, p.y, 20)) { p.x = near.x + rand(-200, 200); p.y = near.y + rand(-160, 160); } }
      this.critters.push({ kind: q.animal || 'sheep', x: p.x, y: p.y, homeX: p.x, homeY: p.y, tx: p.x, ty: p.y, state: 'idle', t: rand(0, 2), face: 1, alt: 0, hop: 0, seed: Math.random(), herd: q.id, penned });
    }
  }
  /**
   * A herded animal stays in its own land and near its flock: pushed past the edge of the herd's ground it stops there
   * and, left alone, trots back toward the pen, so none can be lost off the map.
   */
  private leash(c: Critter, q: QuestDef, pen: Point) {
    const r = this.region(q.region), near = this.poi(q.near) || pen, mx = (near.x + pen.x) / 2, my = (near.y + pen.y) / 2;
    const R = Math.max(900, dist(near, pen) / 2 + 700), dx = c.x - mx, dy = c.y - my, d = Math.hypot(dx, dy);
    if (d > R) { c.x = mx + dx / d * R; c.y = my + dy / d * R; if (dist(this.hero, c) > 260) { c.tx = c.x - dx / d * 160; c.ty = c.y - dy / d * 160; c.state = 'move'; c.t = 3; } }
    c.x = clamp(c.x, r.x0 + 160, r.x1 - 160); c.y = clamp(c.y, 160, this.world.height - 160);
    const edge = Math.min(c.x - r.x0, r.x1 - c.x, c.y, this.world.height - c.y);
    if (edge < 380 && c.state !== 'flee' && dist(this.hero, c) > 260 && c.state !== 'move') { c.tx = c.x + (mx - c.x) * .25; c.ty = c.y + (my - c.y) * .25; c.state = 'move'; c.t = 4; }
  }
  private updateHerdAnimal(c: Critter, dt: number) {
    const q = this.quest(c.herd!), pen = this.penOf(c.herd!), h = this.hero;
    c.hop += dt; c.t -= dt;
    if (!q || !pen) return;
    if (c.penned) {
      if (c.t <= 0) { const a = rand(0, 6.28), r = rand(0, 55); c.tx = pen.x + Math.cos(a) * r; c.ty = pen.y + Math.sin(a) * r * .6; c.t = rand(2, 5); c.state = 'move'; }
      const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
      if (d > 3) { c.x += dx / d * 22 * dt; c.y += dy / d * 22 * dt; c.face = dx > 0 ? 1 : -1; } else c.state = 'idle';
      return;
    }
    const d = dist(h, c), ox = c.x, oy = c.y;
    if (d < 210 && this.qs(q.id).status === 'active') {
      // Walk up behind an animal and it trots away from you: that is how you steer it into the pen.
      const a0 = Math.atan2(c.y - h.y, c.x - h.x), a = a0 + (c.slide || 0), sp = d < 120 ? 200 : 130;
      c.x += Math.cos(a) * sp * dt; c.y += Math.sin(a) * sp * dt; c.state = 'flee'; c.face = Math.cos(a) > 0 ? 1 : -1;
      this.collide(c, 12);
      // Pressed against a house or a rock: slide along it, turning toward the side the pen is on.
      if (Math.hypot(c.x - ox, c.y - oy) < sp * dt * .35) { const toPen = Math.atan2(pen.y - c.y, pen.x - c.x), side = Math.sin(toPen - a0) >= 0 ? 1 : -1; c.slide = clamp((c.slide || 0) + side * dt * 6, -1.6, 1.6); }
      else c.slide = (c.slide || 0) * Math.pow(.3, dt);
      if (Math.random() < dt * .8) this.play('squeak', c);
    } else {
      if (c.t <= 0) { c.tx = c.x + rand(-60, 60); c.ty = c.y + rand(-40, 40); c.t = rand(2, 5); c.state = 'move'; }
      const dx = c.tx - c.x, dy = c.ty - c.y, dd = Math.hypot(dx, dy);
      if (dd > 3 && c.state === 'move') { c.x += dx / dd * 18 * dt; c.y += dy / dd * 18 * dt; c.face = dx > 0 ? 1 : -1; } else c.state = 'idle';
    }
    this.collide(c, 12);
    if (inPond(this.world.ponds, c.x, c.y, 4)) { c.x = ox; c.y = oy; }
    this.leash(c, q, pen);
    if (dist(c, pen) < 80) {
      c.penned = true; c.state = 'idle'; c.t = 1;
      this.text(c.x, c.y - 40, '✓', '#b9f29d', 22); this.emit(c.x, c.y - 10, 12, ['#b9f29d', '#ffffff'], { speed: 120, life: .6, kind: 'star', glow: true });
      this.play('pickup', c); this.advance(q, 1);
    }
  }

  // ───────────────────────────── trails, switches, building
  private checkClues() {
    const h = this.hero;
    for (const o of this.world.objects) {
      if (o.kind !== 'clue' || Math.abs(o.x - h.x) > 110 || Math.abs(o.y - h.y) > 110 || !this.visibleObject(o) || dist(h, o) > 100) continue;
      const q = this.quest(o.questId!); if (!q) continue;
      const st = this.qs(q.id), line = q.clues?.[o.step || 0] || '…', voice = this.guideVoice, last = st.progress + 1 >= q.count;
      this.got.add(o.id); this.play('discover');
      this.emit(o.x, o.y - 10, 26, ['#fff1b8', '#ffffff', '#b9f29d'], { speed: 180, life: .9, kind: 'star', glow: true });
      if (last && q.auto) { st.progress = q.count; this.complete(q, null, [], true); this.say(voice.name, voice.portrait, [line, ...this.tx(q).complete]); return; }
      this.say(voice.name, voice.portrait, [line]);
      this.advance(q, 1);
      return;
    }
  }
  private lightSwitch(o: WorldObject) {
    const q = this.quest(o.questId!), st = q && this.quests.get(q.id), c = SWITCH_COLOR[o.variant || 'brazier'] || '#ffcf6e';
    if (this.got.has(o.id)) { this.notice(`The ${o.name.toLowerCase()} is already burning.`); return; }
    if (!q || !st || st.status !== 'active') { this.play('page'); this.say(o.name, '🕯️', ['Cold and dark. It is waiting for something.']); return; }
    if (q.ordered && (o.step || 0) !== st.progress) {
      // The wrong one: every light of the puzzle goes out again.
      for (const s of this.world.objects) if (s.questId === q.id && s.kind === 'switch' && this.got.has(s.id)) { this.got.delete(s.id); this.emit(s.x, s.y - 30, 12, 'rgba(120,110,130,.6)', { speed: 80, life: 1, kind: 'smoke', size: 12 }); }
      st.progress = 0; this.touchQuests(); this.play('nope'); this.addShake(4);
      const v = this.guideVoice; this.say(v.name, v.portrait, [`The ${o.name.toLowerCase()} sputters, and every light goes out at once. The order must matter.`, ...(this.tx(q).progress.slice(0, 1))]);
      return;
    }
    this.got.add(o.id); this.play('learn', o); this.flash = Math.max(this.flash, .12);
    this.emit(o.x, o.y - 34, 34, [c, '#ffffff', '#fff1b8'], { speed: 220, life: 1, kind: 'star', glow: true, size: 5 }); this.ring(o.x, o.y - 20, 90, c, .6);
    this.advance(q, 1);
  }
  switchLit(o: WorldObject) { return this.got.has(o.id); }
  questProgress(id: string) { return this.quests.get(id)?.progress || 0; }
  siteBuilt(o: WorldObject) { return this.got.has(o.id); }
  private startWork(o: WorldObject) {
    const q = this.quest(o.questId!), st = q && this.quests.get(q.id);
    if (this.got.has(o.id)) { this.say(o.name, '🔨', ['It stands strong. Good work.']); return; }
    if (!q || !st || st.status !== 'active') { this.play('page'); this.say(o.name, '🔨', ['A building site, marked out with stakes and string. It needs a plan, and materials.']); return; }
    if (st.progress < q.count) { this.play('nope'); this.notice(`You need ${q.count - st.progress} more ${q.item?.toLowerCase()} to build here.`, 'warn', `${st.progress}/${q.count} ${q.item}`); return; }
    this.dismount(); this.work = { o, q, t: 0 }; this.play('hammer', o);
  }
  private updateWork(dt: number) {
    const w = this.work!, h = this.hero;
    if (Math.hypot(h.vx, h.vy) > 60 || dist(h, w.o) > 150) { this.work = null; this.notice('Building stopped. Stand still at the site to build.', 'info', 'Stopped'); return; }
    const before = w.t; w.t += dt;
    if (Math.floor(before / .42) !== Math.floor(w.t / .42)) { this.play('hammer', w.o); this.emit(w.o.x + rand(-40, 40), w.o.y - rand(10, 40), 6, ['#c9a06a', '#8a6a4a', 'rgba(200,180,140,.6)'], { speed: 120, life: .6, kind: 'shard', size: 4, grav: 400 }); }
    if (w.t < WORK_TIME) return;
    this.work = null; this.got.add(w.o.id);
    this.cineFx({ kind: 'build', at: `obj:${w.o.id}` }); this.addShake(5);
    this.notice(`${w.o.name} built!`, 'epic', 'Built!'); this.touchQuests();
    const q = w.q, st = this.qs(q.id);
    if (q.auto) { this.autoComplete(q); return; }
    st.status = 'ready'; this.eventHandler({ type: 'quest', title: q.title, state: 'ready' }); this.play('quest');
    const to = this.npcs.find(n => n.id === this.reportTo(q)); this.notice(`${q.title}: report to ${to?.name || 'the quest giver'}.`, 'good', `Report to ${to?.name.split(' ').pop() || 'giver'}`);
    if (q.cine?.ready) this.queueCine(q.cine.ready, this.cineCtx(q));
  }

  // ───────────────────────────── sieges
  private wardOf(qid: string) { return this.world.objects.find(o => o.kind === 'ward' && o.questId === qid) || null; }
  /** The town a siege falls on: the quest's place when it is a village, city, camp or farm. */
  siegeTown(q: QuestDef): Poi | null { const p = this.poi(q.place); return p && TOWN_KINDS.has(p.kind) ? p : null; }
  /** What a siege defends, as the bar and the journal name it: the town, or the thing the quest guards. */
  siegeLabel(q: QuestDef) { return this.siegeTown(q)?.name || q.ward || 'the barricade'; }
  /** Every house, stall and tent in the town (the raiders' marks), or just the thing the quest guards. */
  private siegeTargets(ward: WorldObject, town: Poi | null): SiegeTarget[] {
    if (!town) return [{ x: ward.x, y: ward.y, fx: ward.x, fy: ward.y - 40, burning: false }];
    const out: SiegeTarget[] = [];
    for (const o of this.obstacleGrid.near(town.x, town.y, town.r)) {
      if (!RAID_TARGETS.has(o.kind) || dist(o, town) > town.r) continue;
      const tall = o.kind === 'manor' ? 150 : o.kind === 'house' ? 100 : o.kind === 'tower' ? 160 : o.kind === 'windmill' ? 90 : 50;
      out.push({ x: o.x, y: o.y + (o.h || o.r * .5) + 26, fx: o.x + rand(-24, 24), fy: o.y - tall, burning: false });
    }
    return out.length ? out : [{ x: ward.x, y: ward.y, fx: ward.x, fy: ward.y - 40, burning: false }];
  }
  private updateSiege(dt: number) {
    const h = this.hero;
    if (!this.siege) {
      if (this.siegeCd > 0) { this.siegeCd -= dt; return; }
      for (const q of this.world.quests) {
        if (q.kind !== 'defend' || this.qs(q.id).status !== 'active') continue;
        const ward = this.wardOf(q.id); if (!ward) continue;
        const town = this.siegeTown(q), reach = town ? town.r * .9 : 560;
        if (Math.abs(ward.x - h.x) > reach + 40 || dist(ward, h) > reach) continue;
        this.siege = { q, ward, wave: this.qs(q.id).progress, waveT: 3, hp: SIEGE_HP, spawned: false, raiders: [], town, targets: this.siegeTargets(ward, town) };
        this.notice(town ? `${q.title}: ${town.name} is under attack! Drive them off before the houses burn.` : `${q.title}: defend ${this.siegeLabel(q).toLowerCase()}!`, 'epic', 'Defend!');
        if (q.cine?.start) this.queueCine(q.cine.start, { $ward: { x: ward.x, y: ward.y } });
        return;
      }
      return;
    }
    const s = this.siege, st = this.qs(s.q.id), waves = s.q.waves || [3, 4, 5];
    if (st.status !== 'active') { this.siege = null; return; }
    if (dist(h, s.ward) > (s.town ? s.town.r + 1300 : 1700)) { this.failSiege('You left the fight, and the attackers melted back into the dark.'); return; }
    if (this.cinePlaying) return;
    if (s.spawned && !s.raiders.some(e => !e.dead)) {
      s.spawned = false; s.wave++; st.progress = s.wave; this.touchQuests();
      if (s.wave >= waves.length) { this.winSiege(); return; }
      this.notice(`Wave ${s.wave} of ${waves.length} beaten! More are coming…`, 'good', `Wave ${s.wave}/${waves.length}`); this.play('quest'); s.waveT = 6;
      s.hp = Math.min(SIEGE_HP, s.hp + 15);
    }
    if (!s.spawned) { s.waveT -= dt; if (s.waveT <= 0) this.spawnWave(); return; }
    // Raiders that reach their mark tear at it, and set it alight.
    for (const e of s.raiders) {
      if (e.dead || e.aggro || e.spawnT > 0 || !e.raid || Math.abs(e.x - e.raid.x) > 110 || dist(e, e.raid) > 96) continue;
      s.hp -= dt * (e.elite ? 1.3 : .75) * (s.town ? 1 : 1.8);
      const tg = s.targets[e.raidAt ?? 0];
      if (tg && !tg.burning) { tg.burning = true; this.fires.push({ x: tg.fx, y: tg.fy, t: 600, s: 1 }); this.play('sunfire', tg); }
      if (Math.random() < dt * 2) { this.emit(e.raid.x + rand(-30, 30), e.raid.y - rand(20, 60), 5, ['#c9a06a', '#ffffff'], { speed: 140, life: .4, kind: 'shard', size: 3, grav: 300 }); this.play('hit', e.raid); }
    }
    if (s.hp <= 0) this.failSiege(s.town ? `${s.town.name} is burning! The raiders overran it.` : `${s.q.ward || 'The barricade'} has fallen!`);
  }
  private spawnWave() {
    const s = this.siege!, q = s.q, waves = q.waves || [3, 4, 5], reg = this.region(q.region);
    const n = Math.min(SIEGE_MAX, Math.round((waves[s.wave] || 4) * (s.town ? SIEGE_HORDE : 2)));
    const kinds: EnemyKind[] = q.foes?.length ? q.foes : ['gloomling'];
    const near = this.world.enemies.filter(e => e.region === q.region && !e.boss && Math.abs(e.x - s.ward.x) < 2400 && Math.abs(e.y - s.ward.y) < 2400);
    const level = clamp((near.length ? Math.round(near.reduce((a, e) => a + e.level, 0) / near.length) : reg.levels[0]) + (s.wave > 1 ? 1 : 0), reg.levels[0], reg.levels[1]);
    // They come out of the dark from three or four sides at once, outside the town's edge.
    const c = s.town || s.ward, R = s.town ? s.town.r + 260 : 760, base = rand(0, 6.28), sides = s.town ? 4 : 3;
    const gates = Array.from({ length: sides }, (_, i) => ({ x: c.x + Math.cos(base + i / sides * 6.28) * R, y: c.y + Math.sin(base + i / sides * 6.28) * R * .78 }));
    for (let i = 0; i < n; i++) {
      const g = gates[i % sides], p = { x: clamp(g.x + rand(-140, 140), reg.x0 + 120, reg.x1 - 120), y: clamp(g.y + rand(-110, 110), 120, this.world.height - 120) }; this.collide(p, 26);
      const e = this.makeEnemy({ id: `${q.id}-raid-${this.summonCount++}`, kind: kinds[(i + s.wave) % kinds.length], x: p.x, y: p.y, level, region: q.region, guard: q.id, elite: i % 7 === 0 && s.wave === waves.length - 1 });
      // A horde: each raider frailer than a creature of the wild.
      e.hp = e.maxHp = Math.round(e.maxHp * (s.town ? .6 : .75));
      // Each goes for one of the buildings on its side of town.
      const order = s.targets.map((tg, k) => [dist(tg, p) + rand(0, 260), k] as const).sort((a, b) => a[0] - b[0]);
      const k = order[Math.floor(Math.random() * Math.min(3, order.length))][1], tg = s.targets[k];
      e.raidAt = k; e.raid = { x: tg.x + rand(-26, 26), y: tg.y + rand(-8, 12) }; e.homeX = tg.x; e.homeY = tg.y; e.spawnT = .8 + i * .08;
      this.enemies.push(e); s.raiders.push(e);
      this.emit(p.x, p.y, 14, ['#1a1030', '#6a4bd6', '#c9b6ff'], { speed: 140, life: .8, kind: 'smoke', size: 12 });
    }
    s.spawned = true; this.play('roar'); this.addShake(5);
    this.notice(`Wave ${s.wave + 1} of ${waves.length}: ${n} of them, here they come!`, 'warn', `Wave ${s.wave + 1}/${waves.length}`);
  }
  /** Puts out every house the raiders set alight. */
  private douseSiege(s: Siege) {
    for (const tg of s.targets) {
      if (!tg.burning) continue;
      tg.burning = false;
      for (let i = this.fires.length - 1; i >= 0; i--) { const fi = this.fires[i]; if (fi.x === tg.fx && fi.y === tg.fy) { this.emit(fi.x, fi.y, 16, 'rgba(230,235,245,.6)', { speed: 90, life: 1.4, kind: 'smoke', size: 16, grav: -40 }); swapRemove(this.fires, i); } }
    }
  }
  private winSiege() {
    const s = this.siege!, q = s.q, st = this.qs(q.id); this.siege = null;
    this.douseSiege(s); this.cineFx({ kind: 'douse', at: `obj:${s.ward.id}` }); this.cineFx({ kind: 'light', at: `obj:${s.ward.id}` });
    this.notice(s.town ? `${q.title}: ${s.town.name} is saved!` : `${q.title}: you held!`, 'epic', 'Victory!');
    st.progress = q.count - 1; this.advance(q, 1);
  }
  private failSiege(msg: string) {
    const s = this.siege; if (!s) return;
    this.siege = null; this.siegeCd = 8; this.douseSiege(s);
    for (const e of s.raiders) if (!e.dead) { e.dead = true; e.deadT = 0; this.emit(e.x, e.y, 10, ['#1a1030', '#6a4bd6'], { speed: 120, life: .6, kind: 'smoke', size: 10 }); }
    const st = this.qs(s.q.id); st.progress = 0; this.touchQuests(); this.play('nope');
    this.notice(`${msg} Regroup, then come back to try again.`, 'warn', 'Siege lost');
  }
  private raidMove(e: Enemy, dt: number) {
    const t = e.raid!, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy), sp = ENEMY_STATS[e.kind].speed * .6;
    if (d > 70) { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
    else if (Math.random() < dt * 2) { e.lunge = .15; e.kx += dx / Math.max(1, d) * 200; e.ky += dy / Math.max(1, d) * 200; }
    e.angle += dt * 2;
  }

  // ───────────────────────────── gates between the lands
  barrierOpen(o: WorldObject) { if (isWall(o)) return this.got.has(o.id); const st = this.quests.get(o.questId!)?.status; if (st === 'done') return true; const q = this.quest(o.questId!); return q?.kind === 'build' && st === 'ready'; }
  /** Standing on a river's bridge, and the bridge is whole. */
  onBridge(rv: River, p: Point) {
    if (Math.abs(p.y - rv.bridgeY) > 44) return false;
    const o = this.barriers.find(b => b.id === rv.barrier);
    return !o || this.barrierOpen(o);
  }
  /** Which bank of each river the hero is on, so a Frost Step or a leap can't hop over the water. */
  private banks: Array<{ side: number; x: number }> = [];
  private keepBanks() {
    const h = this.hero;
    this.world.rivers.forEach((rv, i) => {
      const cx = riverX(rv, h.y), side = h.x < cx ? -1 : 1, b = this.banks[i];
      if (b && side !== b.side && Math.abs(h.x - b.x) < 600 && !this.onBridge(rv, h)) { h.x = cx + b.side * (rv.hw + 18); h.vx = 0; }
      else this.banks[i] = { side, x: h.x };
      if (this.banks[i]) this.banks[i].x = h.x;
    });
  }
  /** Which side of each wall still standing the hero is on, so no Frost Step or leap can hop through it. */
  private wallSide = new Map<string, number>();
  private blockBarriers() {
    const h = this.hero;
    this.keepBanks();
    for (const o of this.barriers) {
      if (isWall(o)) {
        if (this.barrierOpen(o)) continue;
        const side = Math.sign(h.x - o.x) || -1, was = this.wallSide.get(o.id) ?? side, inPass = Math.abs(h.y - o.y) < 260;
        if (inPass && side !== was && Math.abs(h.x - o.x) < 700) { h.x = o.x + was * 92; h.vx = 0; }
        else this.wallSide.set(o.id, side);
        if (inPass && Math.abs(h.x - o.x) < 160 && this.elapsed - this.barrierNoticeT > 6) { this.barrierNoticeT = this.elapsed; this.notice(BARRIER_TEXT[o.variant!], 'warn', 'Smash through!'); }
        continue;
      }
      const river = o.variant === 'bridge' && this.world.rivers.length > 0;
      if (Math.abs(h.y - o.y) > 230 || h.x < o.x - (river ? 150 : 70) || h.x > o.x + 40 || this.barrierOpen(o)) continue;
      if (!river) { h.x = o.x - 70; h.vx = Math.min(0, h.vx); }
      if (this.elapsed - this.barrierNoticeT > 4) { this.barrierNoticeT = this.elapsed; this.notice(BARRIER_TEXT[o.variant || 'bridge'], 'warn', 'The way is blocked'); }
    }
  }

  // ───────────────────────────── choices
  /** The player picked an answer at the end of a conversation: finish the quest, with that answer's words and bonus. */
  choose(id: string, pick: 'a' | 'b') {
    const q = this.quest(id); if (!q?.choice) return;
    const st = this.qs(q.id); if (st.status === 'done') return;
    const opt = q.choice[pick], n = this.npcs.find(x => x.id === (this.isTalk(q) ? q.to : this.reportTo(q))) || null;
    this.choices[id] = pick;
    const key = `choice:${id}`, r = opt.reward;
    if (r && !this.profile.claimed.includes(key)) {
      this.profile.claimed.push(key);
      if (r.hearts) this.profile.bonusHearts += r.hearts;
      if (r.mana) this.profile.bonusMana += r.mana;
      if (r.gold) this.gainGold(r.gold);
      if (r.item) this.addItem(r.item);
      if (r.xp) this.gainXp(Math.round(r.xp * this.region(q.region).xpScale));
      if (r.regen) this.profile.regen += r.regen;
      this.refreshStats(false);
    }
    this.complete(q, n, [], true);
    const next = n && this.offerFrom(n, true);
    if (n && next) this.offerQuest(next, n, opt.lines); else if (n) this.say(n.name, n.portrait, opt.lines); else { const v = this.guideVoice; this.say(v.name, v.portrait, opt.lines); }
  }
  choiceOf(id: string) { return this.choices[id] || null; }

  // ───────────────────────────── the intro
  /** A new adventure opens with the hero's intro film and then a short arrival cutscene. */
  get needsIntro() { const first = this.world.quests.find(q => q.main && !q.requires); return !this.introSeen && !!first && this.quests.get(first.id)?.status === 'available' && this.elapsed < 30; }
  /** After the hero's intro film a short arrival scene is enough; if the film could not play, the full intro cutscene does. */
  startIntro(afterFilm = false) {
    this.introSeen = true;
    this.queueCine(afterFilm ? 'arrive' : 'intro', {}, () => { const v = this.guideVoice; this.say(v.name, v.portrait, [INTRO_LINE[this.heroId]]); });
  }
  skipIntro() { this.introSeen = true; const v = this.guideVoice; this.say(v.name, v.portrait, [INTRO_LINE[this.heroId]]); }
  private cineCtx(q: QuestDef): Record<string, Point> {
    const ward = this.wardOf(q.id), site = this.world.objects.find(o => o.kind === 'site' && o.questId === q.id);
    return { ...(ward ? { $ward: { x: ward.x, y: ward.y } } : {}), ...(site ? { $site: { x: site.x, y: site.y } } : {}) };
  }
  /** A quest whose goal is met with no one to report to: it finishes on the spot, and whoever gave it speaks. */
  private autoComplete(q: QuestDef, before: string[] = []) {
    // Narration in brackets is the hero's (or Tuft's) to tell, not the far-away quest giver's.
    const lines = [...before, ...this.tx(q).complete], giver = this.npcs.find(n => n.id === q.giver), v = giver && !lines[0]?.startsWith('(') ? giver : this.guideVoice;
    this.complete(q, null, [], true);
    if (lines.length) this.say(v.name, v.portrait, lines);
  }
  /** Chapters end with whatever the last main quest of a land is: then its achievement, a cutscene, and the next land. */
  private endChapter(r: RegionId) {
    const side = this.sideQuests(r), done = side.filter(q => this.qs(q.id).status === 'done').length;
    this.statMax(`chapter:${r}`, 1);
    this.eventHandler({ type: 'levelComplete', region: r, last: r === this.lastRegion, stats: { stars: this.earnedStars(r), time: this.elapsed - this.chapterStart.elapsed, defeated: this.defeated - this.chapterStart.defeated, quests: done, totalQuests: side.length, level: this.profile.level } });
    this.chapterStart = { elapsed: this.elapsed, defeated: this.defeated };
    this.queueCine(`chapter-${r}`);
    this.foxDelay = 1.5;
  }

  // ───────────────────────────── rescues
  private spawnGuards(q: QuestDef) {
    const cage = this.world.objects.find(o => o.kind === 'cage' && o.questId === q.id);
    if (!cage || this.got.has(cage.id) || this.enemies.some(e => e.guard === q.id && !e.dead)) return;
    const place = this.world.pois.find(p => p.id === q.place), reg = this.region(q.region);
    const nearby = this.world.enemies.filter(e => !e.boss && Math.abs(e.x - cage.x) < 1400 && Math.abs(e.y - cage.y) < 1400);
    const level = nearby.length ? Math.round(nearby.reduce((s, e) => s + e.level, 0) / nearby.length) : reg.levels[0];
    const kinds: EnemyKind[] = place?.pack?.length ? place.pack : nearby.length ? nearby.map(e => e.kind) : ['gloomling'];
    const n = q.guards || 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(0, .6), r = rand(120, 230);
      const p = { x: cage.x + Math.cos(a) * r, y: cage.y + Math.sin(a) * r * .8 };
      this.collide(p, 26);
      const e = this.makeEnemy({ id: `${q.id}-guard-${i}`, kind: kinds[i % kinds.length], x: p.x, y: p.y, level: Math.min(reg.levels[1] + 1, level + (i === 0 ? 1 : 0)), region: q.region, elite: i === 0, guard: q.id });
      this.enemies.push(e);
    }
  }
  private guardsLeft(qid: string) { let n = 0; for (const e of this.enemies) if (e.guard === qid && !e.dead) n++; return n; }

  // ───────────────────────────── inventory, shops, upgrades
  addItem(id: ItemId, count = 1) {
    const bag = this.profile.items;
    if (!bag[id] && bagUsed(this.profile) >= BAG_SIZE) { this.gainGold(ITEMS[id].price * .4 * count); this.notice(`Your bag is full — ${ITEMS[id].name} was sold.`, 'warn', 'Bag full'); return; }
    bag[id] = Math.min(99, (bag[id] || 0) + count); this.persistProfile(this.profile);
    this.text(this.hero.x, this.hero.y - 70, `+${count} ${ITEMS[id].name}`, ITEMS[id].color, 15);
    this.eventHandler({ type: 'item', id, count });
  }
  useItem(id: ItemId) {
    if (this.completeTimer > 0 || this.cine) return;
    if (this.hero.iceT > 0) return this.frozenNotice();
    const bag = this.profile.items, have = bag[id] || 0, h = this.hero, info = ITEMS[id];
    if (have <= 0) { this.play('nope'); this.notice(`You have no ${info.name} left. Buy more from a city merchant.`, 'warn', `No ${info.name}`); return; }
    if (id === 'healthPotion' && h.hp >= h.maxHp) { this.play('nope'); this.notice('Your health is already full.', 'warn', 'Health full'); return; }
    if (id === 'manaPotion' && h.mana >= h.maxMana - .5) { this.play('nope'); this.notice('Your magic is already full.', 'warn', 'Magic full'); return; }
    if (id === 'phoenixFeather') { this.play('nope'); this.notice('The Phoenix Feather works by itself: keep it in your bag and it saves you when you fall.', 'info', 'Works by itself'); return; }
    if (id === 'thunderJar' && !this.thunderTargets().length) { this.play('nope'); this.notice('No foes in reach — the lightning would be wasted.', 'warn', 'No foes near'); return; }
    if (have > 1) bag[id] = have - 1; else delete bag[id];
    this.persistProfile(this.profile);
    if (info.kind === 'potion') this.bump('potions'); else if (info.kind === 'bomb' && id !== 'smokeBomb') this.bump('bombs');
    switch (id) {
      case 'healthPotion': { const heal = Math.min(h.maxHp - h.hp, Math.round(h.maxHp * .5)); h.hp += heal; this.text(h.x, h.y - 50, `+${heal}`, '#ff9aa8', 20); break; }
      case 'manaPotion': h.mana = h.maxMana; break;
      case 'fireBomb': case 'frostBomb': this.dismount(); return this.throwBomb(id);
      case 'thunderJar': this.dismount(); return this.thunder();
      case 'smokeBomb': this.smoke(); break;
      case 'hourglass': for (const s of this.spellIds) h.cds[s] = 0; this.buffs.hourglass = info.duration; this.notice(`${info.name}: every ability is ready!`, 'good', 'Cooldowns reset'); break;
      case 'giantBrew': this.buffs.giantBrew = info.duration; this.addShake(8); this.play('roar'); this.notice(`${info.name}: you are ENORMOUS!`, 'good', 'Giant!'); break;
      default: this.buffs[id] = info.duration; this.notice(`${info.name}: ${info.description}`, 'good', info.name);
    }
    this.emit(h.x, h.y - 10, 22, [info.color, '#ffffff'], { speed: 160, life: .8, kind: 'star', glow: true, grav: -60 });
    this.ring(h.x, h.y, 70, info.color, .5); this.play('drink');
  }
  /** Bombs are lobbed at the nearest creature (or straight ahead) and burst when they land. */
  private throwBomb(id: 'fireBomb' | 'frostBomb') {
    const h = this.hero, fire = id === 'fireBomb';
    // A cracked wall close by is the obvious target, unless a creature is closer still.
    let t: Point | null = this.nearestTarget(560, true), best = 340;
    for (const o of this.world.objects) if (o.kind === 'crack' && !this.secrets.has(o.id) && Math.abs(o.x - h.x) < best && Math.abs(o.y - h.y) < best) { const d = dist(o, h); if (d < best && (!t || d < dist(t, h))) { best = d; t = { x: o.x, y: o.y - 20 }; } }
    const to = t ? { x: t.x, y: t.y } : { x: h.x + h.faceX * 240, y: h.y + h.faceY * 240 };
    this.hazards.push({ x: to.x, y: to.y, r: fire ? 150 : 210, delay: .6, maxDelay: .6, damage: (fire ? 70 : 16) * this.power, level: 0, owner: 'hero', kind: fire ? 'firebomb' : 'frostbomb', fromX: h.x, fromY: h.y - 24 });
    h.castTime = .3; this.play('dash');
  }
  private thunderTargets() {
    const h = this.hero;
    return this.enemies.filter(e => !e.dead && e.spawnT <= 0 && this.canHurt(e) && Math.abs(e.x - h.x) < 520 && Math.abs(e.y - h.y) < 520 && dist(h, e) < 520).sort((a, b) => dist(h, a) - dist(h, b)).slice(0, 6);
  }
  private thunder() {
    this.thunderTargets().forEach((e, i) => { const d = .08 + i * .12; this.hazards.push({ x: e.x, y: e.y, r: 64, delay: d, maxDelay: d, damage: 50 * this.power, level: 0, owner: 'hero', kind: 'lightning', fromX: e.x + rand(-60, 60), fromY: e.y - 640 }); });
    this.flash = Math.max(this.flash, .35); this.play('starfall');
  }
  private smoke() {
    const h = this.hero;
    for (const e of this.enemies) if (!e.dead && !e.boss && dist(h, e) < 700) { e.aggro = false; e.windup = 0; e.lunge = 0; e.cd = Math.max(e.cd, 2); }
    this.emit(h.x, h.y, 40, ['rgba(200,195,215,.7)', 'rgba(160,155,180,.6)', 'rgba(230,228,240,.6)'], { speed: 220, life: 1.6, kind: 'smoke', size: 26, drag: 2 });
    this.buffs.smokeBomb = ITEMS.smokeBomb.duration; this.notice('You vanish in smoke. Creatures lose track of you.', 'good', 'Vanished');
  }
  buyItem(id: ItemId) {
    const price = ITEMS[id].price, p = this.profile;
    if (p.gold < price || (!p.items[id] && bagUsed(p) >= BAG_SIZE)) { this.play('nope'); return false; }
    p.gold -= price; this.addItem(id); this.play('pickup');
    return true;
  }
  /** Merchants buy spare consumables back for 40% of their price. */
  sellItem(id: ItemId) {
    const bag = this.profile.items, have = bag[id] || 0; if (have <= 0) return 0;
    const n = Math.max(1, Math.round(ITEMS[id].price * .4));
    if (have > 1) bag[id] = have - 1; else delete bag[id];
    this.profile.gold += n; this.persistProfile(this.profile); this.play('orb');
    return n;
  }
  setQuick(id: ItemId) { if (id === 'healthPotion') return; this.profile.quick = id; this.persistProfile(this.profile); this.play('ui'); }

  // ───────────────────────────── equipment
  /** Puts on a piece for an empty slot; anything else goes in the bag, or is sold on the spot if the bag is full. */
  addGear(g: GearItem) {
    const p = this.profile, c = RARITY[g.rarity].color;
    if (p.gear.some(x => x.uid === g.uid) || SLOT_ORDER.some(s => p.equipped[s]?.uid === g.uid)) g = { ...g, uid: `${g.uid}-${Date.now().toString(36)}` };
    if (g.rarity === 'epic') this.bump('epics'); else if (g.rarity === 'legendary') this.bump('legendaries');
    if (!p.equipped[g.slot]) {
      const before = this.hero.maxHp; p.equipped[g.slot] = g; this.statsChanged(before);
      this.statMax('slots', SLOT_ORDER.filter(s => p.equipped[s]).length);
      this.text(this.hero.x, this.hero.y - 88, `${g.name} · equipped`, c, 15);
      this.emit(this.hero.x, this.hero.y - 10, 18, [c, '#ffffff'], { speed: 140, life: .6, kind: 'star', glow: true });
      this.eventHandler({ type: 'loot', item: g, equipped: true });
      return;
    }
    if (bagUsed(p) >= BAG_SIZE) { const n = sellPrice(g); p.gold += n; this.profileDirty = true; this.notice(`Your bag is full — ${g.name} was sold for ${n} gold.`, 'warn', 'Bag full · sold'); return; }
    p.gear.push(g); this.persistProfile(p);
    this.text(this.hero.x, this.hero.y - 88, g.name, c, 15);
    this.eventHandler({ type: 'loot', item: g });
  }
  /** The armourer's shelf in the land the hero stands in. It is restocked every time the hero levels up. */
  armoury(): ShopGear[] {
    const p = this.profile, r = this.heroRegion;
    return armouryStock(p.hero, r.id, p.level, r.levels).map(s => ({ ...s, sold: p.bought.includes(s.item.uid) }));
  }
  buyGear(uid: string) {
    const p = this.profile, s = this.armoury().find(x => x.item.uid === uid);
    if (!s || s.sold || p.gold < s.price || p.level < s.needLevel || (p.equipped[s.item.slot] && bagUsed(p) >= BAG_SIZE)) { this.play('nope'); return false; }
    p.gold -= s.price; p.bought = [...p.bought, uid].slice(-60); this.play('orb'); this.bump('bought');
    this.addGear({ ...s.item, uid: `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}` });
    this.persistProfile(p);
    return true;
  }
  private dropGear(x: number, y: number, ilvl: number, rarity: Rarity) {
    const g = makeGear({ ilvl, rarity, hero: this.heroId }), a = rand(0, 6.28), v = rand(140, 260);
    this.orbs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind: 'loot', age: 0, value: 0, gear: g });
    if (rarity === 'epic' || rarity === 'legendary') this.ring(x, y, 90, RARITY[rarity].color, .8);
  }
  private statsChanged(before: number) {
    this.refreshStats(false); this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + Math.max(0, this.hero.maxHp - before));
    this.persistProfile(this.profile);
  }
  equip(uid: string) {
    const p = this.profile, i = p.gear.findIndex(g => g.uid === uid); if (i < 0) return false;
    const g = p.gear[i], old = p.equipped[g.slot], before = this.hero.maxHp;
    p.gear.splice(i, 1); if (old) p.gear.splice(i, 0, old);
    p.equipped[g.slot] = g; this.statsChanged(before);
    this.statMax('slots', SLOT_ORDER.filter(s => p.equipped[s]).length);
    this.emit(this.hero.x, this.hero.y - 10, 18, [RARITY[g.rarity].color, '#ffffff'], { speed: 140, life: .6, kind: 'star', glow: true }); this.play('pickup');
    return true;
  }
  unequip(slot: GearSlot) {
    const p = this.profile, g = p.equipped[slot]; if (!g) return false;
    if (bagUsed(p) >= BAG_SIZE) { this.play('nope'); this.notice('Your bag is full.', 'warn', 'Bag full'); return false; }
    const before = this.hero.maxHp; delete p.equipped[slot]; p.gear.push(g); this.statsChanged(before); this.play('page');
    return true;
  }
  discardGear(uid: string) { const p = this.profile, i = p.gear.findIndex(g => g.uid === uid); if (i < 0) return; p.gear.splice(i, 1); this.persistProfile(p); this.play('page'); }
  sellGear(uid: string) {
    const p = this.profile, i = p.gear.findIndex(g => g.uid === uid); if (i < 0) return 0;
    const n = sellPrice(p.gear[i]); p.gear.splice(i, 1); p.gold += n; this.persistProfile(p); this.play('orb');
    return n;
  }

  // ───────────────────────────── spell stars
  spellRank(id: SpellId): SpellRank {
    const rank = starsOf(this.profile, id), next = rank < MAX_STARS ? rank + 1 : 0;
    const cost = next ? starCost(id, next) : 0, needLevel = next ? starLevel(id, next) : 0;
    return { rank, max: MAX_STARS, bonus: rank ? upgradeText(id, rank) : 'No upgrades yet', next: next ? upgradeText(id, next) : null, cost, needLevel, canBuy: !!next && this.spellUnlocked(id) && this.profile.level >= needLevel && this.profile.gold >= cost };
  }
  upgradeSpell(id: SpellId) {
    const r = this.spellRank(id), p = this.profile;
    if (!r.canBuy) { this.play('nope'); return false; }
    p.gold -= r.cost; p.stars[id] = r.rank + 1; this.persistProfile(p); this.statMax('stars', r.rank + 1);
    this.play('learn'); this.flash = .2;
    this.emit(this.hero.x, this.hero.y - 10, 30, [SPELLS[id].color, '#ffffff', '#ffd35c'], { speed: 200, life: .8, kind: 'star', glow: true });
    return true;
  }
  upgradeRank(id: UpgradeId) { return rankOf(this.profile, id); }
  buyUpgrade(id: UpgradeId) {
    const p = this.profile, rank = rankOf(p, id), cost = upgradeCost(rank);
    if (rank >= MAX_RANK || p.gold < cost) { this.play('nope'); return false; }
    p.gold -= cost; p.upgrades[id] = rank + 1; this.statMax('smith', rank + 1);
    const before = this.hero.maxHp; this.refreshStats(false); this.hero.hp += Math.max(0, this.hero.maxHp - before);
    this.persistProfile(p); this.play('learn'); this.flash = .25;
    this.emit(this.hero.x, this.hero.y, 30, ['#ffd35c', '#ffffff', '#ffb05c'], { speed: 200, life: .8, kind: 'star', glow: true });
    return true;
  }

  // ───────────────────────────── world interaction
  isVisible(o: WorldObject) { return this.visibleObject(o); }
  private visibleObject(o: WorldObject) {
    if (o.hiddenBy && !this.secrets.has(o.hiddenBy)) return false;
    // Key items appear once the main quest that asks for them is accepted.
    if (o.kind === 'key') return !this.main.keys.includes(o.id) && this.world.quests.some(q => q.kind === 'key' && this.qs(q.id).status === 'active' && q.keys!.some(i => this.keyId(q, i) === o.id));
    if (o.kind === 'questItem') return !this.got.has(o.id) && this.qs(o.questId!)?.status === 'active';
    if (o.kind === 'cage') return !this.got.has(o.id) && this.qs(o.questId!)?.status === 'active';
    if (o.kind === 'clue') { const st = this.quests.get(o.questId!); return !!st && st.status === 'active' && st.progress === o.step; }
    if (o.kind === 'switch') { const s = this.quests.get(o.questId!)?.status; return s === 'active' || s === 'ready' || s === 'done'; }
    if (o.kind === 'site' || o.kind === 'pen' || o.kind === 'ward') return this.quests.has(o.questId!);
    // The hole opens when the ground gives way under the hero; the shaft of dawnlight once Umbra (or its echo) is beaten.
    if (o.kind === 'hole') { const q = this.finalQuest, s = q && this.qs(q.id).status; return s === 'active' || s === 'done'; }
    if (o.kind === 'exit') return o.variant !== 'throne' || this.umbraBeaten || this.echoBeaten;
    return true;
  }
  private interactable(o: WorldObject) { return this.visibleObject(o) && o.kind !== 'clue' && o.kind !== 'pen' && o.kind !== 'ward' && !(o.kind === 'barrier' && this.barrierOpen(o)) && !(o.kind === 'site' && this.got.has(o.id)) && !(o.kind === 'chest' && this.opened.has(o.id)) && !((o.kind === 'crack' || o.kind === 'waterfall') && this.secrets.has(o.id)); }
  secretFound(id: string) { return this.secrets.has(id); }
  /** A cracked wall bursts, or the water parts: whatever was hidden behind appears. */
  private revealSecret(o: WorldObject) {
    if (this.secrets.has(o.id)) return;
    this.secrets.add(o.id); this.bump('secrets'); this.touchQuests();
    const reg = this.region(o.region), acc = reg.palette.accent;
    if (o.kind === 'crack') {
      this.emit(o.x, o.y - 30, 40, [reg.palette.rock, '#8a7a68', '#b0a490'], { speed: 380, life: .9, kind: 'shard', size: 7, grav: 520 });
      this.emit(o.x, o.y - 30, 16, 'rgba(160,150,130,.5)', { speed: 140, life: 1.3, kind: 'smoke', size: 24 });
      this.addShake(10); this.play('slam', o);
    } else { this.emit(o.x, o.y - 60, 30, reg.ground === 'ash' ? ['#ffb347', '#ff6b3d'] : ['#dff6ff', '#9fd8ff', '#ffffff'], { speed: 200, life: .9, glow: true, size: 4 }); this.play('splash', o); }
    this.emit(o.x, o.y - 50, 36, [acc, '#ffffff', '#fff1b8'], { speed: 240, life: 1.1, kind: 'star', glow: true, size: 5 });
    this.ring(o.x, o.y - 40, 120, acc, .7); this.flash = Math.max(this.flash, .25); this.play('discover');
    this.gainXp(80 * reg.xpScale, o.x, o.y);
    this.notice(o.kind === 'crack' ? 'The wall crumbles — you found a secret!' : `Behind the ${o.name.toLowerCase()}: a hidden cave!`, 'epic', 'Secret found!');
  }
  nearest(maxRange = 105): Near | null {
    let best: Near | null = null, bd = maxRange;
    const h = this.hero;
    // Quest pickups win over a villager standing right next to them.
    for (const o of this.world.objects) { if (Math.abs(o.x - h.x) > maxRange + 40 || Math.abs(o.y - h.y) > maxRange + 40 || !this.interactable(o)) continue; const d = dist(h, o) - (o.kind === 'questItem' || o.kind === 'key' || o.kind === 'switch' ? 30 : o.kind === 'cage' || o.kind === 'site' ? 40 : 0); if (d < bd) { bd = d; best = { kind: 'object', o }; } }
    for (const n of this.npcs) { if (Math.abs(n.x - h.x) > maxRange || Math.abs(n.y - h.y) > maxRange || n.role === 'thief' || n.role === 'actor' || !this.npcVisible(n)) continue; const d = dist(h, n) - 12; if (d < bd) { bd = d; best = { kind: 'npc', n }; } }
    return best;
  }
  interact() {
    sfx.unlock();
    if (this.completeTimer > 0 || this.cine) return;
    if (this.hero.iceT > 0) return this.frozenNotice();
    const near = this.nearest(); if (!near) return;
    if (near.kind === 'npc') return this.talk(near.n);
    const o = near.o, reg = this.region(o.region), s = reg.script, h = this.hero, m = this.main, acc = reg.palette.accent;
    switch (o.kind) {
      case 'key': {
        m.keys.push(o.id); h.mana = Math.min(h.maxMana, h.mana + 25);
        this.emit(o.x, o.y, 40, [acc, '#ffffff', '#fff1b8'], { speed: 260, life: 1, kind: 'star', glow: true, size: 5 });
        this.ring(o.x, o.y, 90, acc, .6); this.flash = .2;
        const n = String(this.keysFound(o.region));
        this.notice(s.pickupKey.replace('{n}', n), 'good', `${s.keyLabel} ${n}/3`); this.play('key'); this.gainXp(40 * reg.xpScale);
        for (const q of this.world.quests) if (q.kind === 'key' && this.qs(q.id).status === 'active' && q.keys!.some(i => this.keyId(q, i) === o.id)) this.advance(q, 1);
        return;
      }
      case 'questItem': {
        const q = this.quest(o.questId!)!; this.got.add(o.id);
        this.emit(o.x, o.y, 22, ['#fff49b', '#ffffff', acc], { speed: 150, life: .8, kind: 'star', glow: true });
        this.play('pickup'); this.advance(q, 1);
        const st = this.qs(q.id);
        if (st.status === 'active') { this.notice(`${o.name} ${st.progress}/${q.count}`, 'good', `${st.progress}/${q.count}`); this.text(o.x, o.y - 40, `${st.progress}/${q.count}`, '#fff49b', 18); }
        return;
      }
      case 'cage': {
        const q = this.quest(o.questId!)!, left = this.guardsLeft(q.id);
        if (left > 0) { this.play('nope'); this.notice(`Defeat the guards first — ${left} left.`, 'warn', `${left} guards left`); return; }
        this.got.add(o.id); this.play('chest', o); this.flash = .25;
        this.emit(o.x, o.y - 30, 50, ['#fff1b8', '#ffffff', acc], { speed: 280, life: 1.1, kind: 'star', glow: true, size: 5 });
        this.ring(o.x, o.y, 120, acc, .7);
        if (q.captive) this.say(q.captive.name, q.captive.portrait, this.tx(q).deliver || ['Thank you!']);
        if (q.escort) { this.spawnFollower(q, { x: o.x, y: o.y + 40 }); this.notice(`Bring ${q.captive?.name} home safely.`, 'good', 'Escort them home'); this.touchQuests(); }
        else this.advance(q, 1);
        return;
      }
      case 'hole': this.descend(); return;
      case 'exit': this.ascend(); return;
      case 'chest': {
        if (o.variant === 'star' && this.fallen?.chest === o && this.fallen.boss && !this.fallen.boss.dead) { this.play('nope'); this.notice(`The star-forged chest is sealed while ${this.bossName(this.fallen.boss)} still stands.`, 'warn', 'Sealed'); return; }
        this.opened.add(o.id); this.play('chest', o);
        this.emit(o.x, o.y - 10, 36, ['#ffd35c', '#fff1b8', '#ffffff'], { speed: 240, life: 1, kind: 'star', glow: true, size: 5 });
        const n = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.spawnOrb(o.x, o.y - 8, Math.random() < .25 ? 'heart' : 'mana');
        for (let i = 0; i < 4; i++) this.spawnOrb(o.x, o.y - 8, 'gold', Math.round(6 + reg.levels[0] * 2.5));
        this.notice(`You opened the ${o.name.toLowerCase()}!`, 'good'); this.gainXp(35 * reg.xpScale, o.x, o.y); this.bump('chests');
        this.addItem(rollItem()); if (Math.random() < .35) this.addItem(rollItem());
        // A hidden cache always holds a rare or better piece and a pile of extra gold.
        if (o.variant === 'star') {
          // A star-forged chest: a legendary piece every time, star fragments and a heap of gold.
          const lv = clamp(this.profile.level + 1, 1, 30);
          this.dropGear(o.x, o.y - 8, lv, 'legendary'); this.dropGear(o.x, o.y - 8, lv, Math.random() < .5 ? 'epic' : 'rare');
          for (let i = 0; i < 8; i++) this.spawnOrb(o.x, o.y - 8, 'gold', Math.round(14 + lv * 4));
          if (this.fallen?.chest === o) for (let i = 0; i < 3; i++) { const a = rand(0, 6.28); this.fallen.frags.push({ x: o.x + Math.cos(a) * 70, y: o.y + Math.sin(a) * 50, got: false }); }
          this.gainXp(120 * reg.xpScale, o.x, o.y); this.bump('starChests'); this.flash = Math.max(this.flash, .5); this.ring(o.x, o.y, 160, '#fff1b8', .9);
        }
        else if (o.rich) { for (let i = 0; i < 5; i++) this.spawnOrb(o.x, o.y - 8, 'gold', Math.round(10 + reg.levels[1] * 3)); this.addItem(rollItem()); this.dropGear(o.x, o.y - 8, reg.levels[1] + 1, Math.random() < .1 ? 'legendary' : Math.random() < .45 ? 'epic' : 'rare'); }
        else if (Math.random() < .45) { const r = rollRarity(Math.random, .3); this.dropGear(o.x, o.y - 8, reg.levels[0] + Math.round(Math.random() * (reg.levels[1] - reg.levels[0])), r === 'common' ? 'uncommon' : r); }
        return;
      }
      case 'lore': {
        const first = !this.read.has(o.id); this.read.add(o.id); this.play('page');
        this.say(o.name, '🪨', o.text || []);
        if (first) { this.gainXp(30 * reg.xpScale, o.x, o.y); this.bump('lore'); }
        return;
      }
      case 'sign': this.play('page'); this.say(o.name, '🪧', o.text || []); return;
      case 'site': this.startWork(o); return;
      case 'switch': this.lightSwitch(o); return;
      case 'barrier': this.play('page'); this.say(o.name, o.variant === 'ice' ? '🧊' : o.variant === 'thorns' ? '🌿' : o.variant === 'rocks' ? '🪨' : o.variant === 'cave' ? '🌋' : '🌉', [this.barrierOpen(o) ? BARRIER_OPEN[o.variant || 'bridge'] : BARRIER_TEXT[o.variant || 'bridge']]); return;
      case 'crack': this.play('page'); this.say(o.name, '🪨', ['Cold air seeps through the cracks in this old wall. Something is hidden behind it.', `A bomb could break it open. (Throw one close by${this.profile.items.fireBomb || this.profile.items.frostBomb || this.profile.items.thunderJar ? ' — you have some in your bag' : ' — merchants sell fire bombs'}.)`]); return;
      case 'waterfall': this.revealSecret(o); this.say(o.name, reg.ground === 'ash' ? '🔥' : '💧', reg.ground === 'ash' ? ['You edge along the rock behind the falling lava. The heat is fierce…', '…but there is a cave back here, and something glints inside!'] : ['You slip behind the falling water, soaked to the bone…', '…and find a hidden cave with something glinting inside!']); return;
      case 'well': case 'fountain': {
        const t = this.wellT.get(o.id) || -999;
        if (this.elapsed - t > 45 && (h.hp < h.maxHp || h.mana < h.maxMana)) { this.wellT.set(o.id, this.elapsed); h.hp = h.maxHp; h.mana = h.maxMana; this.play('drink'); this.emit(h.x, h.y, 20, ['#9fd8ff', '#ffffff'], { speed: 120, glow: true }); this.notice('You drink the cool water. Fully restored!', 'good', 'Restored'); }
        else this.notice('The water is cool and clear.');
        this.setCheckpoint(); return;
      }
      case 'campfire': {
        this.setCheckpoint(); h.hp = h.maxHp; h.mana = h.maxMana; this.play('rest');
        this.emit(o.x, o.y - 10, 24, ['#ffcf6e', '#ff9a4a', '#fff1b8'], { speed: 90, life: 1.1, kind: 'ember', glow: true, grav: -40 });
        this.notice('You rest by the fire. Fully restored — you will return here if you fall.', 'good', 'Rested');
        return;
      }
      case 'shrine': {
        this.setCheckpoint(); h.hp = h.maxHp; h.mana = h.maxMana;
        if (!this.blessed.has(o.id)) {
          this.blessed.add(o.id);
          this.emit(o.x, o.y - 20, 70, [acc, '#ffffff', '#fff1b8'], { speed: 320, life: 1.3, kind: 'star', glow: true, size: 6 });
          this.ring(o.x, o.y, 160, acc, .9); this.flash = .5; this.addShake(6); this.play('learn');
          this.say(o.name, '✨', s.shrine.bless); this.gainXp(90 * reg.xpScale, o.x, o.y);
        } else { this.play('rest'); this.say(o.name, '✨', s.shrine.again); }
        return;
      }
      case 'finale': {
        if (m.finales.includes(o.region)) { this.say(o.name, '✦', [`The ${s.finaleName} shines over the land.`]); return; }
        const q = this.world.quests.find(x => x.kind === 'boss' && x.finale && x.region === o.region);
        const st = q ? this.qs(q.id).status : 'locked';
        const guarded = this.enemies.some(e => e.boss && e.region === o.region && !e.dead && this.canHurt(e));
        if (guarded) { this.say(o.name, '✦', s.finale.guarded); return; }
        if (!q || st !== 'active' || !m.bosses.includes(q.boss!)) { this.say(o.name, '✦', s.finale.locked); return; }
        m.finales.push(o.region);
        this.complete(q, null, [], true);
        this.completeRegion = o.region;
        this.say(o.name, '✦', s.finale.done, 'complete'); return;
      }
    }
  }
  private talk(n: Npc) {
    const m = this.main;
    if (n.role === 'follower') { this.say(n.name, n.portrait, [n.beast ? '(The little wolf presses against your leg and wags.)' : n.scared ? 'Not while those creatures are here! Please, chase them off!' : pick(['Lead the way. I’m right behind you.', 'Is it much farther?', 'I feel safer with you here.'])]); return; }
    if (n.role === 'thief' || n.role === 'actor') return;
    n.faceX = this.hero.x > n.x ? 1 : -1; n.waitT = Math.max(n.waitT, 3);
    if (n.role === 'guide' || n.role === 'inn') this.setCheckpoint();
    // Someone you were sent to speak with, or bring something to, comes first; then hand-ins, then new quests.
    for (const q of this.world.quests) if (this.isTalk(q) && q.to === n.id && this.qs(q.id).status === 'active') return this.finish(q, n, this.tx(q).deliver || ['Thank you!']);
    const ready = this.world.quests.find(q => this.qs(q.id).status === 'ready' && this.reportTo(q) === n.id);
    if (ready) return this.finish(ready, n, this.tx(ready).complete);
    const offer = this.offerFrom(n); if (offer) return this.offerQuest(offer, n);
    if (n.role === 'merchant' || n.role === 'smith' || n.role === 'armorer' || n.role === 'stable') { sfx.play('talk'); this.eventHandler({ type: 'shop', kind: n.role, name: n.name, portrait: n.portrait }); return; }
    if (n.role === 'inn') {
      const h = this.hero; h.hp = h.maxHp; h.mana = h.maxMana; this.play('rest');
      this.emit(h.x, h.y, 24, ['#fff1b8', '#ffcf6e', '#ffffff'], { speed: 120, life: 1, kind: 'star', glow: true, grav: -40 });
      return this.offerGame(n, 'dice', ['A soft bed, a warm meal, a quiet night.', 'You wake rested. (Fully restored — you will return here if you fall.)']);
    }
    const mine = this.questsFor(n.id);
    const active = mine.find(q => q.main && this.qs(q.id).status === 'active') || mine.find(q => this.qs(q.id).status === 'active');
    if (active) { const st = this.qs(active.id), counted = active.count > 1 && (active.kind === 'collect' || active.kind === 'slay' || active.kind === 'key'); return this.say(n.name, n.portrait, [...this.tx(active).progress, counted ? `(${st.progress}/${active.count})` : ''].filter(Boolean)); }
    if (n.role === 'guide') { const cur = this.currentMain(), reg = this.region(n.region); return this.say(n.name, n.portrait, m.finales.includes(n.region) || !cur ? reg.script.guide.done : [`${cur.title}: ${cur.summary}`, `Follow the gold markers, ${HEROES[this.heroId].name}. The valley is counting on you.`]); }
    const game = this.gameOf(n);
    if (game) return this.offerGame(n, game, [pick(n.lines.length ? n.lines : ['Hello there!'])]);
    const done = mine.find(q => this.qs(q.id).status === 'done');
    this.say(n.name, n.portrait, done && Math.random() < .5 ? this.tx(done).after : [pick(n.lines.length ? n.lines : ['Hello there!'])]);
  }
  /** One quest per conversation, main story first: a side quest from the same person waits until you speak again.
   *  `mainOnly` is for the offer that follows a hand-in, so a side quest never rides along with the story. */
  private offerFrom(n: Npc, mainOnly = false) { const open = this.questsFor(n.id).filter(q => this.qs(q.id).status === 'available'); return open.find(q => q.main) || (mainOnly ? null : open[0]) || null; }
  /** Hands a quest in; if the same person has the next step of the story, it is offered right after their thanks. */
  private finish(q: QuestDef, n: Npc, lines: string[]) {
    if (q.choice) { sfx.play('talk'); this.eventHandler({ type: 'choice', speaker: n.name, portrait: n.portrait, lines: this.personal(lines), quest: q.id, title: q.title, a: q.choice.a.label, b: q.choice.b.label }); return; }
    this.complete(q, n, lines, true);
    const next = this.offerFrom(n, true);
    if (next) this.offerQuest(next, n, lines); else this.say(n.name, n.portrait, lines);
  }
  /** Called by the UI once the finale dialogue closes: fireworks, then the chapter is complete and the story walks on. */
  celebrate() {
    if (this.completeTimer > 0 || this.cine) return;
    this.completeTimer = 3.2; this.fireworkTimer = 0; this.flash = .8; this.addShake(8); this.play('victory');
    const f = this.finaleOf(this.completeRegion);
    if (f) { const acc = this.region(f.region).palette.accent; this.ring(f.x, f.y, 400, acc, 1.4); this.emit(f.x, f.y - 40, 120, [acc, '#ffffff', '#fff1b8'], { speed: 520, life: 1.6, kind: 'star', glow: true, size: 6, drag: 1.6 }); }
  }
  finaleOf(region: RegionId) { return this.world.objects.find(o => o.kind === 'finale' && o.region === region) || null; }
  finaleLit(region: RegionId) { return this.main.finales.includes(region); }

  private nearestTarget(maxRange: number, creaturesOnly = false): Enemy | Pod | null {
    let best: Enemy | Pod | null = null, bestD = maxRange;
    const h = this.hero;
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0 || e.burrowT > 0 || !this.canHurt(e) || Math.abs(e.x - h.x) > maxRange || Math.abs(e.y - h.y) > maxRange) continue; const d = dist(h, e); if (d < bestD) { best = e; bestD = d; } }
    if (!best && !creaturesOnly) for (const p of this.pods) { if (p.dead || Math.abs(p.x - h.x) > 260 || Math.abs(p.y - h.y) > 260) continue; const d = dist(h, p); if (d < Math.min(bestD, 260)) { best = p; bestD = d; } }
    return best;
  }
  private knock(e: Enemy, from: Point, force: number) {
    if (e.wall) return;
    if (e.kind === 'cragGolem' || e.kind === 'magmaHulk') force *= .25;
    if (this.buffs.giantBrew) force *= 1.8;
    const dx = e.x - from.x, dy = e.y - from.y, d = Math.max(1, Math.hypot(dx, dy));
    e.kx += dx / d * force; e.ky += dy / d * force;
  }
  private damageEnemy(e: Enemy, amount: number, crit = false) {
    if (e.dead || e.burrowT > 0) return;
    if (!this.canHurt(e)) { this.notice(e.wall ? 'Clear the way to it first.' : this.region(e.region).script.sealed, 'warn', 'Sealed'); this.emit(e.x, e.y, 8, '#c9b6ff', { speed: 120, glow: true }); return; }
    amount = Math.max(1, Math.round(amount * this.dealMul(e.level)));
    this.fightT = this.elapsed;
    if (this.practice) {
      e.hitFlash = .14;
      this.combo++; this.comboTime = 2.4;
      this.text(e.x, e.y - e.r - 18, crit ? `${amount}!` : `${amount}`, crit ? '#ffd35c' : '#fff3c0', crit ? 24 : 17);
      this.emit(e.x, e.y, crit ? 12 : 7, ['#ffffff', '#fff3c0', this.region(e.region).palette.accent], { speed: 200, life: .35, glow: true, size: 3 });
      this.play(crit ? 'crit' : 'hit', e);
      if (crit) { this.freeze(.05); this.addShake(3); }
      return;
    }
    e.hp -= amount; e.hitFlash = .14; e.aggro = !e.wall;
    if (e.wall) this.emit(e.x + rand(-60, 60), e.y - rand(10, 90), 6, this.barriers.find(b => b.id === e.wall)?.variant === 'cave' ? ['#2a2028', '#ff7a3d'] : ['#8d93ad', '#ffffff'], { speed: 220, life: .6, kind: 'shard', size: 4, grav: 500 });
    this.combo++; this.comboTime = 2.4;
    if (crit && !this.practice) this.bump('crits');
    if (this.combo >= 15) this.statMax('combo', this.combo);
    this.text(e.x, e.y - e.r - 18, crit ? `${amount}!` : `${amount}`, crit ? '#ffd35c' : '#fff3c0', crit ? 24 : 17);
    this.emit(e.x, e.y, crit ? 12 : 7, ['#ffffff', '#fff3c0', this.region(e.region).palette.accent], { speed: 200, life: .35, glow: true, size: 3 });
    this.play(crit ? 'crit' : 'hit', e);
    if (crit) { this.freeze(.05); this.addShake(3); }
    if (e.hp <= 0) this.killEnemy(e);
  }
  private killEnemy(e: Enemy) {
    e.dead = true; e.deadT = 0; e.action = null; e.burrowT = 0; e.chillT = 0; e.frozenT = 0;
    if (e.wall) { this.breakWall(e); return; }
    if (this.practice) { this.emit(e.x, e.y, 18, ['#fff1b8', '#ffd35c', '#ffffff'], { speed: 220, life: .7, kind: 'star', glow: true, size: 4 }); this.ring(e.x, e.y, 90, '#ffd35c', .5); return; }
    if (!e.summoned) { this.defeated++; this.bump('kills'); if (e.elite) this.bump('elites'); if (e.heroic) this.bump('heroics'); if (e.level - this.profile.level >= 4) this.statMax('underdog', 1); }
    const colors = KILL_COLORS[e.kind] || [this.region(e.region).palette.accent, '#ffffff', '#ffd27a', '#ff9a4a'];
    this.emit(e.x, e.y, e.boss ? 140 : 22, colors, { speed: e.boss ? 520 : 240, life: e.boss ? 1.8 : .8, kind: 'star', glow: true, size: e.boss ? 7 : 4, drag: 2 });
    this.emit(e.x, e.y, e.boss ? 36 : 8, ['#8fd46b', '#b9f29d', '#f2a1b8'], { speed: 200, life: 1.6, kind: 'leaf', size: 7, grav: 60 });
    this.ring(e.x, e.y, e.boss ? 320 : 70, colors[0], e.boss ? 1 : .4);
    // A kill gives back a little magic, not a full refill: in a crowd two orbs a kill kept every hero topped up.
    const drops = e.boss ? 14 : e.heroic ? 6 : e.summoned ? 0 : e.elite ? 4 : Number(Math.random() < .55);
    for (let i = 0; i < drops; i++) this.spawnOrb(e.x, e.y, Math.random() < (e.boss ? .3 : e.elite ? .3 : .2) ? 'heart' : 'mana');
    if (!e.summoned) { const coins = e.boss ? 10 : e.heroic ? 7 : e.elite ? 3 : 1 + Number(Math.random() < .4); for (let i = 0; i < coins; i++) this.spawnOrb(e.x, e.y, 'gold', Math.round((2 + e.level * .9) * (e.boss ? 5 : e.heroic ? 3 : 1))); }
    const gap = this.profile.level - e.level, grey = gap >= 5 ? .1 : gap >= 3 ? .5 : 1;
    // Creatures are many, so each one is worth a little less than it used to (.5).
    let xp = ENEMY_STATS[e.kind].xp * (e.boss ? (e.id === ECHO_ID ? .6 : 1) : .4 * (1 + .2 * (e.level - 1)) * (e.heroic ? 9 : e.elite ? 3 : e.summoned ? .3 : 1) * (e.raid ? .45 : 1) * (e.starborn ? 2.5 : 1) * grey);
    if (e.kind === 'starbeast') xp = Math.round(60 * (1 + .2 * (e.level - 1)) * 18);
    // Whatever the star touched leaves a fragment of it behind.
    if (e.starborn && this.fallen) this.fallen.frags.push({ x: e.x, y: e.y, got: false });
    if (e.boss) { this.addItem(rollItem()); this.addItem('healthPotion'); }
    else if (e.heroic) { this.addItem(rollItem()); this.addItem(rollItem()); }
    else if (e.elite ? Math.random() < .45 : !e.summoned && Math.random() < .04) this.addItem(e.elite ? rollItem() : 'healthPotion');
    // Equipment: guardians always drop an epic (sometimes a legendary too), elites often, ordinary creatures now and then.
    if (e.boss) { this.dropGear(e.x, e.y, e.level, 'epic'); this.dropGear(e.x, e.y, e.level, Math.random() < .3 ? 'legendary' : 'rare'); }
    else if (e.heroic) {
      // Heroic foes always drop a rare or better piece, often an epic, now and then a legendary, and a second piece.
      this.dropGear(e.x, e.y, e.level + 1, Math.random() < .12 ? 'legendary' : Math.random() < .5 ? 'epic' : 'rare');
      this.dropGear(e.x, e.y, e.level, Math.random() < .5 ? 'rare' : 'uncommon');
      for (const o of this.enemies) if (o.summoned && !o.dead && o.id.startsWith(`hsum-${e.id}-`)) this.killEnemy(o);
      this.notice(`${e.heroic} is defeated! Heroic loot spills out.`, 'epic', 'Heroic victory!');
      this.dropMounts('heroic');
      this.flash = Math.max(this.flash, .5); this.slowMo = Math.max(this.slowMo, .6); this.addShake(12); this.ring(e.x, e.y, 200, '#e8a0ff', .9); this.play('bossDie');
    }
    else if (!e.summoned && (e.elite ? Math.random() < .35 : Math.random() < .045 * grey)) { const r = rollRarity(Math.random, e.elite ? .4 : 0); this.dropGear(e.x, e.y, e.level, e.elite && r === 'common' ? 'uncommon' : r); }
    if (e.ai === 'sporecap') this.addHazard(e.x, e.y, 110, .7, 'spore', e, hitAt(e.level) * .8, e.level);
    if (e.boss) {
      if (e.kind === 'eclipse') this.dropMounts('eclipse');
      if (e.kind !== 'starbeast' && e.id !== ECHO_ID && !this.main.bosses.includes(e.id)) this.main.bosses.push(e.id);
      if (e.id === ECHO_ID) { this.echoBeaten = true; this.bump('echoes'); }
      if (e.kind === 'starbeast') { this.bump('starbeasts'); this.notice(`${this.bossName(e)} is defeated! The star-forged chest is unsealed.`, 'epic', 'The star is yours!'); }
      this.slowMo = 1.4;
      this.statMax(`boss:${e.kind}`, 1); if (this.cleanFight) this.statMax('flawless', 1); this.cleanFight = false;
      this.flash = 1; this.addShake(22); this.play('bossDie');
      for (const other of this.enemies) if (other.summoned && !other.dead) this.killEnemy(other);
      this.clearThreats = true;
      const q = this.bossQuest(e);
      if (q?.finale) this.notice(`${this.bossName(e)} is defeated! ${this.inDepths ? 'Climb out through the shaft of dawnlight and light' : 'Go to'} the ${this.region(e.region).script.finaleName}.`, 'epic', `${this.bossName(e)} defeated!`);
      else if (e.kind !== 'starbeast') this.notice(`${this.bossName(e)} is defeated!`, 'epic', 'Victory!');
      if (q && this.qs(q.id).status === 'active') this.advance(q, 1);
    } else {
      this.freeze(.04); this.addShake(4); this.play('kill', e);
      if (!e.summoned && !e.guard) for (const q of this.world.quests) if (q.kind === 'slay' && (q.enemy === 'any' || q.enemy === e.kind) && (q.enemy !== 'any' || e.region === q.region)) this.advance(q, 1);
      if (e.guard && this.guardsLeft(e.guard) === 0) { const q = this.quest(e.guard); if (q?.captive) this.notice(`The guards are down — free ${q.captive.name}!`, 'good', 'Open the cage!'); }
    }
    this.gainXp(xp, e.x, e.y);
  }
  /** Mounts that only drop: each one the foe can drop, by its chance, if the hero hasn't got it yet. */
  private dropMounts(from: string) {
    for (const id of MOUNT_ORDER) { const m = MOUNTS[id]; if (m.drop === from && !this.mountUnlocked(id) && Math.random() < (m.chance ?? 1)) this.gainMount(id, true); }
  }
  private spawnOrb(x: number, y: number, kind: Orb['kind'], value = 0) { const a = rand(0, 6.28), v = rand(120, 300); this.orbs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind, age: 0, value }); }
  private breakPod(p: Pod) {
    if (p.dead) return;
    p.dead = true;
    const pal = this.regionAt(p.x).palette;
    this.emit(p.x, p.y, 22, [pal.pod, '#ffffff', '#fff1b8'], { speed: 240, life: .8, kind: 'shard', glow: true, size: 5, grav: 200 });
    this.ring(p.x, p.y, 50, pal.pod, .35);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.spawnOrb(p.x, p.y, Math.random() < .22 ? 'heart' : 'mana');
    this.addShake(3); this.play('pod', p);
  }
  /** `amount` is in health points before level, armour and potion reductions. */
  private hurt(amount: number, from: Point, level: number) {
    const h = this.hero;
    if (h.hurtTime > 0 || h.dashTime > 0 || h.ghostT > 0 || this.completeTimer > 0 || this.cine) return;
    this.fightT = this.elapsed;
    // The Ice Block turns everything aside, however many blows land (a moment's grace keeps the clinks from piling up).
    if (h.iceT > 0) { h.ghostT = .25; this.ring(h.x, h.y - 8, 56, '#dff6ff', .25); this.emit(from.x + (h.x - from.x) * .8, from.y + (h.y - from.y) * .8 - 10, 5, ['#ffffff', '#bfeaff'], { speed: 140, life: .3, kind: 'shard', size: 3 }); this.play('reflect'); return; }
    if (h.shieldTime > 0) { this.ring(h.x, h.y, 50, '#b8c8e0', .25); this.play('reflect'); return; }
    if (h.orbitN > 0) {
      // A Guardian Star takes the blow and bursts on whoever struck it.
      this.loseStar('hp' in from && 'kind' in from ? from as Enemy : null);
      // A moment's grace, so one volley can't strip every star at once.
      this.ring(h.x, h.y - 8, 60, '#fff1b8', .3); h.ghostT = Math.max(h.ghostT, .3); this.play('reflect');
      return;
    }
    const dmg = Math.max(1, Math.round(amount * this.takeMul(level) * armorAt(this.profile) * (this.buffs.barkskin ? .5 : 1) * (this.buffs.giantBrew ? .7 : 1) * (h.stormT > 0 ? .5 : 1)));
    h.hp -= dmg; h.hurtTime = .9; this.damageFlash = .35; this.combo = 0;
    if (this.stealthT > 0) { this.endStealth(); this.notice('You were struck and fell out of the shadows!', 'warn', 'Seen!'); }
    if (this.riding) { this.dismount(); this.notice('You were knocked off your mount!', 'warn', 'Dismounted'); }
    const dx = h.x - from.x, dy = h.y - from.y, d = Math.max(1, Math.hypot(dx, dy));
    h.vx += dx / d * 520; h.vy += dy / d * 520;
    this.text(h.x, h.y - 50, `-${dmg}`, '#ff8f7a', 20);
    this.emit(h.x, h.y, 18, ['#ff8f7a', '#ffd1ae', '#ffffff'], { speed: 220, life: .5, glow: true });
    this.addShake(10); this.freeze(.08); this.play('hurt');
    if (h.hp <= 0) { if (this.profile.items.phoenixFeather) this.rebirth(); else this.respawn(); }
  }
  /** The Phoenix Feather burns up and the hero rises again on the spot. */
  private rebirth() {
    const h = this.hero, bag = this.profile.items;
    if ((bag.phoenixFeather || 0) > 1) bag.phoenixFeather!--; else delete bag.phoenixFeather;
    this.persistProfile(this.profile);
    h.hp = Math.round(h.maxHp * .6); h.hurtTime = 2.5; h.vx = h.vy = 0; this.bump('rebirths');
    this.emit(h.x, h.y, 70, ['#ff9a4a', '#ffd35c', '#ff5f3d', '#fff1b8'], { speed: 360, life: 1.2, kind: 'ember', glow: true, size: 6, grav: -80 });
    this.ring(h.x, h.y, 220, '#ff9a4a', .9); this.flash = .7; this.slowMo = .8; this.play('levelUp');
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist(h, e) < 240 + e.r) { this.damageEnemy(e, 30 * this.power); if (!e.boss) this.knock(e, h, 380); }
    this.notice('The Phoenix Feather bursts into flame — you rise again!', 'epic', 'Reborn!');
  }
  private respawn() {
    const h = this.hero;
    h.hp = h.maxHp; h.mana = Math.max(40, h.mana); h.x = this.checkpoint.x; h.y = this.checkpoint.y; h.vx = h.vy = 0; h.hurtTime = 2; h.slowT = 0;
    const lost = Math.floor(this.profile.gold * .1); this.profile.gold -= lost; this.profileDirty = true;
    this.respawnFade = 1; this.clearThreats = true; this.cleanFight = false; this.bump('deaths');
    this.marks.length = 0; this.storms.length = 0; this.wells.length = 0; this.stealthT = 0; this.riding = false;
    h.iceT = 0; h.orbitT = 0; h.orbitN = 0;
    this.wildT = 0; this.petFocus = null; this.work = null;
    if (this.siege) this.failSiege('You fell, and the attackers overran the defence.');
    for (const n of this.npcs) if (n.role === 'follower') { n.x = h.x + 50; n.y = h.y + 24; }
    for (let i = this.pets.length - 1; i >= 0; i--) { const p = this.pets[i]; if (p.spirit) swapRemove(this.pets, i); else { p.x = h.x - 40; p.y = h.y + 16; p.target = null; p.leapT = 0; } }
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.summoned) { e.dead = true; continue; }
      // Every creature and guardian still standing is back at full health: a fight lost is a fight started over.
      e.aggro = false; e.x = e.homeX; e.y = e.homeY; e.cd = 2; e.windup = 0; e.action = null; e.lunge = 0; e.hp = e.maxHp;
      e.stunT = 0; e.chillT = 0; e.frozenT = 0; e.burrowT = 0; e.rage = 0;
      if (e.heroic) { e.enraged = false; e.heroT = 4; }
      if (e.boss) { e.phase = 1; e.pattern = 0; e.actionStep = 0; e.summons = 0; }
    }
    this.bossIntroShown.clear();
    this.notice(`${HEROES[this.heroId].name} wakes at the last resting place.${lost ? ` ${lost} gold was lost.` : ''} Quest progress is safe.`, 'warn', lost ? `Defeated · −${lost} gold` : 'Defeated');
  }
  setCheckpoint() { this.checkpoint = { x: this.hero.x, y: this.hero.y }; }

  // ───────────────────────────── simulation
  /** Screen effects keep fading even while the game is paused. */
  settleFx(dtRaw: number) {
    const dt = Math.min(.05, Math.max(0, dtRaw));
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2);
    this.respawnFade = Math.max(0, this.respawnFade - dt * 1.2);
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    if (!this.cine || this.cine.cutT <= 0) this.cineFade = Math.max(0, this.cineFade - dt * 2.4);
    // A cut hides the change of light; otherwise night falls (or lifts) over a second or so.
    this.cineDark += (this.cineNight - this.cineDark) * Math.min(1, dt * (this.cineFade > .9 ? 30 : 1.4));
  }
  update(dtRaw: number) {
    let dt = Math.min(.045, Math.max(0, dtRaw));
    this.settleFx(dt);
    if (!this.cine && this.cineQueue.length && this.completeTimer <= 0) this.beginCine(this.cineQueue.shift()!);
    if (this.cine) {
      // While a cutscene plays, the world keeps breathing but nobody fights.
      this.updateCine(dt); this.updateNpcs(dt); this.updateCritters(dt); this.updateParticles(dt); this.updateFx(dt);
      for (const e of this.enemies) if (!e.dead) { e.hitFlash = 0; if (e.spawnT > 0) e.spawnT = Math.max(0, e.spawnT - dt); }
      return;
    }
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    if (this.slowMo > 0) { this.slowMo -= dt; dt *= .3; }
    this.elapsed += dt;
    const h = this.hero;
    const cdRate = this.buffs.hourglass ? 2 : 1;
    for (const id of this.spellIds) h.cds[id] = Math.max(0, h.cds[id] - dt * cdRate);
    h.shieldTime = Math.max(0, h.shieldTime - dt); h.hurtTime = Math.max(0, h.hurtTime - dt); h.castTime = Math.max(0, h.castTime - dt); h.slowT = Math.max(0, h.slowT - dt); this.updateCasting(dt);
    // Out of a fight magic and energy come back two and a half times as fast.
    h.mana = this.practice ? h.maxMana : Math.min(h.maxMana, h.mana + h.manaRegen * (this.combat < .05 ? 2.5 : 1) * dt);
    this.comboTime -= dt; if (this.comboTime <= 0) this.combo = 0;
    for (const id of ITEM_ORDER) {
      const left = this.buffs[id]; if (left === undefined) continue;
      if (left - dt > 0) this.buffs[id] = left - dt; else { delete this.buffs[id]; this.notice(`${ITEMS[id].name} wore off.`); }
    }

    this.updateHero(dt);
    this.blockBarriers();
    if (this.work) this.updateWork(dt);
    this.updateSiege(dt);
    this.updateFx(dt);
    this.updateEnemies(dt);
    this.updateNpcs(dt);
    this.updateCritters(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateOrbs(dt);
    this.updateParticles(dt);
    if (this.finalT > 0) this.updateFinalRise(dt);
    this.updateStarfall(dt);
    this.slowTick -= dt;
    if (this.slowTick <= 0) {
      this.slowTick = .25; this.updateZone(); this.markExplored(); this.updateSoundscape(); this.respawnEnemies(); this.flushFox(); this.checkAmbushes(); this.checkClues(); this.checkThrone();
      if (++this.exploreTick % 16 === 0) this.statMax('explore', this.exploredPercent());
      if (this.profileDirty) { this.profileDirty = false; this.persistProfile(this.profile); }
    }
    if (this.completeTimer > 0) this.updateCelebration(dt);
    if (this.foxDelay > 0) this.foxDelay -= dt;
    if (this.news.length && (this.news[0].t -= dt) <= 0) { const n = this.news.shift()!; this.notice(n.text, 'epic', n.short); this.play('quest'); if (this.news.length) this.news[0].t = Math.max(this.news[0].t, 3.5); }
    if (this.clearThreats) {
      // Deferred so no update loop sees its array change underneath it.
      this.clearThreats = false;
      for (let i = this.hazards.length - 1; i >= 0; i--) if (this.hazards[i].owner === 'enemy') swapRemove(this.hazards, i);
      for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.projectiles[i].owner === 'enemy') swapRemove(this.projectiles, i);
    }
  }
  /** Push a point out of every solid thing near it. */
  collide(p: Point, pad: number) {
    const dp = this.world.depths, deep = !!dp && p.x > this.world.width + 400;
    for (const o of this.obstacleGrid.near(p.x, p.y, 120 + pad)) {
      if (o.w) {
        const hh = o.h || 0, cx = clamp(p.x, o.x - o.w, o.x + o.w), cy = clamp(p.y, o.y - hh, o.y + hh), dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
        if (d < pad) {
          if (d > 0) { p.x = cx + dx / d * pad; p.y = cy + dy / d * pad; }
          else { const ox = o.w + pad - Math.abs(p.x - o.x), oy = hh + pad - Math.abs(p.y - o.y); if (ox < oy) p.x += Math.sign(p.x - o.x || 1) * ox; else p.y += Math.sign(p.y - o.y || 1) * oy; }
        }
      } else this.pushOut(p, o.x, o.y, o.r + pad);
    }
    if (deep) { keepInDepths(dp!, p, pad); return; }
    // A rockfall or caved-in cave mouth still standing fills its canyon.
    for (const o of this.barriers) if (isWall(o) && Math.abs(p.x - o.x) < 92 + pad && Math.abs(p.y - o.y) < 230 && !this.got.has(o.id)) p.x = o.x + (p.x < o.x ? -1 : 1) * (92 + pad);
    // A river can only be crossed on its bridge, once the bridge is mended.
    for (const rv of this.world.rivers) {
      if (Math.abs(p.x - rv.pts[0].x) > rv.hw + 240 + pad) continue;
      const cx = riverX(rv, p.y), d = p.x - cx, lim = rv.hw + pad * .6;
      if (Math.abs(d) < lim && !this.onBridge(rv, p)) p.x = cx + Math.sign(d || -1) * lim;
    }
    for (const pond of this.world.ponds) {
      if (Math.abs(p.x - pond.x) > pond.r + 60 || Math.abs(p.y - pond.y) > pond.r + 60) continue;
      const dx = (p.x - pond.x) / (pond.r + pad * .6), dy = (p.y - pond.y) / (pond.r * .58 + pad * .6), d = Math.hypot(dx, dy);
      if (d < 1 && d > 0) { p.x = pond.x + dx / d * (pond.r + pad * .6); p.y = pond.y + dy / d * (pond.r * .58 + pad * .6); }
    }
  }
  private updateHero(dt: number) {
    const h = this.hero, ride = this.riding ? MOUNTS[this.mountId || 'pony'].speed : 1;
    const speed = HEROES[this.heroId].speed * this.moveSpeed * ride * (h.slowT > 0 ? .5 : 1) * (h.stormT > 0 ? .8 : 1) * (this.casting ? .45 : 1);
    if (h.iceT > 0) h.vx = h.vy = 0;
    else if (h.dashTime > 0) {
      h.dashTime -= dt; const ds = h.charging ? 1050 : 900; h.vx = h.dashX * ds; h.vy = h.dashY * ds;
      if (Math.random() < .9) this.afterimages.push({ x: h.x, y: h.y, life: .28, faceX: h.faceX });
    } else {
      const k = Math.min(1, dt * 14);
      h.vx += (this.moveX * speed - h.vx) * k; h.vy += (this.moveY * speed - h.vy) * k;
    }
    const B = this.boundsOf(h); h.x = clamp(h.x + h.vx * dt, B.x0 + 40, B.x1 - 40); h.y = clamp(h.y + h.vy * dt, B.y0 + 40, B.y1 - 40);
    const moving = Math.hypot(h.vx, h.vy) > 30;
    if (moving) {
      h.walkTime += dt * (this.riding ? 13 : 10);
      const phase = Math.floor(h.walkTime / Math.PI);
      if (phase !== this.stepPhase) { this.stepPhase = phase; if (h.dashTime <= 0) footstep(this.groundAt(h.x, h.y)); }
      if (Math.random() < dt * 8) this.emit(h.x + rand(-8, 8), h.y + 20, 1, this.regionAt(h.x).ground === 'snow' ? 'rgba(220,225,255,.5)' : 'rgba(220,200,150,.55)', { speed: 30, life: .5, kind: 'smoke', size: 5, drag: 3 });
    }
    if (h.slowT > 0 && Math.random() < dt * 10) this.emit(h.x + rand(-14, 14), h.y + rand(-20, 16), 1, '#e8e0f0', { speed: 10, life: .6, size: 3, grav: 30 });
    this.collide(h, 15);
    for (const p of this.pods) if (!p.dead && Math.abs(p.x - h.x) < 60 && Math.abs(p.y - h.y) < 60) this.pushOut(h, p.x, p.y, 34);
    for (const n of this.npcs) if (Math.abs(n.x - h.x) < 40 && Math.abs(n.y - h.y) < 40 && this.npcVisible(n)) this.pushOut(h, n.x, n.y, 28);
    for (let i = this.afterimages.length - 1; i >= 0; i--) { this.afterimages[i].life -= dt; if (this.afterimages[i].life <= 0) swapRemove(this.afterimages, i); }
    for (let i = this.slashes.length - 1; i >= 0; i--) { this.slashes[i].life -= dt; if (this.slashes[i].life <= 0) swapRemove(this.slashes, i); }
    this.updateWarrior(dt);
    this.updateSpells(dt);
    if (h.shieldTime > 0 && Math.random() < dt * 12) this.emit(h.x + rand(-30, 30), h.y + rand(-30, 20), 1, '#dfe8f5', { speed: 30, life: .7, kind: 'shard', size: 4, grav: -20 });
    sfx.setListener(h.x, h.y);
  }
  groundAt(x: number, y: number) {
    if (this.roads.dist(x, y, 60) < 46) return 'path' as const;
    const p = this.poiAt({ x, y }); if (p && (p.kind === 'ruins' || p.kind === 'shrine' || p.kind === 'finale' || p.kind === 'city')) return 'stone' as const;
    const g = this.regionAt(x).ground;
    return g === 'snow' ? 'snow' as const : g === 'ash' ? 'path' as const : 'grass' as const;
  }
  private pushOut(p: Point, x: number, y: number, min: number) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d < min && d > 0) { p.x = x + dx / d * min; p.y = y + dy / d * min; }
  }

  private updateEnemies(dt: number) {
    const h = this.hero;
    if (this.practice) {
      for (const e of this.enemies) {
        if (e.dead) { e.deadT += dt; if (e.deadT > .8) { e.dead = false; e.hp = e.maxHp; e.deadT = 0; e.spawnT = 0; } else continue; }
        e.hitFlash = Math.max(0, e.hitFlash - dt);
        e.rage = 0; e.aggro = false; e.kx = 0; e.ky = 0;
      }
      this.combat = 0; this.danger = 0;
      return;
    }
    let threats = 0, near = false;
    for (const e of this.enemies) {
      if (e.dead) { e.deadT += dt; continue; }
      if (e.wall) { e.hitFlash = Math.max(0, e.hitFlash - dt); e.kx = e.ky = 0; continue; }
      const far = Math.abs(e.x - h.x) > ACTIVE_RANGE || Math.abs(e.y - h.y) > ACTIVE_RANGE;
      if (far && !e.aggro) continue; // creatures far away sleep
      e.hitFlash = Math.max(0, e.hitFlash - dt); e.lunge = Math.max(0, e.lunge - dt);
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      if (e.frozenT > 0) e.frozenT = Math.max(0, e.frozenT - dt);
      // A chilled creature lives a little slower: it moves, winds up and recovers at 55% speed.
      if (e.chillT > 0) { e.chillT = Math.max(0, e.chillT - dt); if (Math.random() < dt * 5) this.emit(e.x + rand(-e.r, e.r), e.y - e.r * .5, 1, '#dff6ff', { speed: 15, life: .5, glow: true, size: 2, grav: 30 }); }
      const edt = e.chillT > 0 ? dt * (e.boss ? .8 : .55) : dt;
      const rage = !e.aggro ? 0 : e.windup > 0 || e.lunge > 0 || e.action ? 1 : .55;
      e.rage += (rage - e.rage) * Math.min(1, dt * 7);
      e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(.004, dt); e.ky *= Math.pow(.004, dt);
      const EB = this.boundsOf(e); e.x = clamp(e.x, EB.x0 + 40, EB.x1 - 40); e.y = clamp(e.y, EB.y0 + 40, EB.y1 - 40);
      if (!e.boss) this.collide(e, e.r * .8);
      else if (e.depths || e.kind === 'eclipse') { const dp = this.world.depths; if (dp && e.x > this.world.width) keepInDepths(dp, e, e.r * .6); }
      const d = dist(h, e);
      if (e.aggro && d < 650) threats += e.boss ? 3 : 1;
      if (e.aggro && d < 480 && this.canHurt(e)) near = true;
      if (e.boss) { this.updateBoss(e, edt, d); continue; }
      if (!e.aggro && d < 380 && !this.buffs.smokeBomb && this.stealthT <= 0) {
        e.aggro = true; this.text(e.x, e.y - e.r - 26, '!', '#ffd35c', 22); this.play('squeak', e);
        if (e.heroic && !this.bossIntroShown.has(e.id)) { this.bossIntroShown.add(e.id); this.notice(`Heroic foe: ${e.heroic}! Tough, but rich in loot.`, 'epic', `Heroic: ${e.heroic}`); this.play('roar'); this.addShake(6); this.ring(e.x, e.y, 160, '#e8a0ff', .7); }
      }
      if (e.aggro && (d > 820 || dist(e, { x: e.homeX, y: e.homeY }) > 950)) { e.aggro = false; e.windup = 0; e.lunge = 0; }
      if (!e.aggro) { if (e.raid) this.raidMove(e, dt); else this.wander(e, dt); continue; }
      if (e.stunT > 0) { e.stunT -= dt; if (Math.random() < dt * 12) this.emit(e.x + rand(-e.r, e.r), e.y - e.r, 1, '#8fd8ff', { speed: 40, life: .3, glow: true, size: 2 }); continue; }
      e.cd = Math.max(0, e.cd - edt);
      this.enemyAct(e, edt, d);
      if (e.heroic) this.heroicAct(e, edt, d);
      const hit = hitAt(e.level) * ENEMY_STATS[e.kind].dmg * (e.raid ? .75 : 1);
      if (d < e.r + 16 && e.ai !== 'thornling' && e.ai !== 'sporecap' && e.ai !== 'emberImp' && e.ai !== 'hollowArcher' && e.ai !== 'acolyte' && e.burrowT <= 0) this.hurt(hit * (e.kind === 'bristleboar' && e.lunge > 0 ? 1.5 : e.kind === 'webspinner' && h.slowT > 0 ? 1 : .6), e, e.level);
    }
    this.combat += (clamp(threats / 4, 0, 1) - this.combat) * Math.min(1, dt * 1.5);
    this.danger += (Number(near) - this.danger) * Math.min(1, dt * (near ? 5 : 2));
  }
  /** Each creature fights its own way. */
  private enemyAct(e: Enemy, dt: number, d: number) {
    const h = this.hero, dx = (h.x - e.x) / Math.max(1, d), dy = (h.y - e.y) / Math.max(1, d), sp = ENEMY_STATS[e.kind].speed * (e.elite ? 1.1 : 1), hit = hitAt(e.level) * ENEMY_STATS[e.kind].dmg * (e.raid ? .75 : 1);
    switch (e.ai) {
      case 'gloomling': {
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) { e.lunge = .2; e.kx += dx * 520; e.ky += dy * 520; if (d < 90 + (e.elite ? 20 : 0)) this.hurt(hit, e, e.level); e.cd = e.elite ? 1.5 : 2; }
        } else if (e.cd <= 0 && d < 90) e.windup = .5;
        else if (d > 50) { e.x += dx * sp * dt; e.y += dy * sp * dt; }
        break;
      }
      case 'thornling': {
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) { for (const off of e.elite ? [-.4, -.2, 0, .2, .4] : [-.22, 0, .22]) this.enemyShot(e, Math.atan2(dy, dx) + off, 310, 'thorn', hit * .8); e.cd = 2.2; this.play('thornShot', e); }
        } else if (e.cd <= 0 && d < 380) e.windup = .55;
        else { const want = d > 260 ? 1 : d < 180 ? -1 : 0; e.x += dx * sp * want * dt; e.y += dy * sp * want * dt; }
        break;
      }
      case 'wisp': {
        e.angle += dt * 2.4;
        const side = Math.sin(e.angle) * sp, want = d > 240 ? sp : d < 170 ? -sp : 0;
        e.x += (dx * want - dy * side) * dt; e.y += (dy * want + dx * side) * dt;
        if (Math.random() < dt * 8) this.emit(e.x, e.y + 6, 1, ['#8ee8ff', '#c9b6ff'], { speed: 20, life: .6, glow: true, size: 4, grav: -30 });
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { const a = Math.atan2(dy, dx); this.enemyShot(e, a, 340, 'void', hit * .8); if (e.elite) { this.enemyShot(e, a + .3, 340, 'void', hit * .8); this.enemyShot(e, a - .3, 340, 'void', hit * .8); } e.cd = 1.6; this.play('voidShot', e); } }
        else if (e.cd <= 0 && d < 430) e.windup = .4;
        break;
      }
      case 'bristleboar': {
        // Paws the ground (a red line shows the path), then charges straight through.
        if (e.lunge > 0) {
          e.x += e.chargeX * 660 * dt; e.y += e.chargeY * 660 * dt;
          if (Math.random() < .5) this.emit(e.x, e.y + e.r * .6, 1, 'rgba(160,130,90,.5)', { speed: 50, life: .5, kind: 'smoke', size: 9 });
        } else if (e.windup > 0) {
          e.windup -= dt;
          if (Math.random() < dt * 14) this.emit(e.x - e.chargeX * 18, e.y + e.r * .6, 1, 'rgba(160,130,90,.5)', { speed: 40, life: .4, kind: 'smoke', size: 7 });
          if (e.windup <= 0) { e.lunge = .6; this.play('roar', e); }
        } else if (e.cd <= 0 && d < 440) { e.windup = .75; e.chargeX = dx; e.chargeY = dy; e.cd = 2.6; }
        else { const want = d > 240 ? sp : d < 150 ? -sp * .5 : 0; e.x += dx * want * dt; e.y += dy * want * dt; }
        break;
      }
      case 'sporecap': {
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { e.cd = 3.2; this.emit(e.x, e.y - 10, 26, ['#b9e27a', '#dfff9a', '#8aab52'], { speed: 180, life: .9, kind: 'smoke', size: 12 }); this.play('pod', e); } }
        else if (e.cd <= 0 && d < 170) { e.windup = .9; this.addHazard(e.x, e.y, 140, .9, 'spore', e, hit * 1.1, e.level); }
        else if (d > 60) { e.x += dx * sp * dt; e.y += dy * sp * dt; }
        break;
      }
      case 'shadewolf': {
        e.angle += dt * 1.6;
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) { e.lunge = .25; e.kx += dx * 780; e.ky += dy * 780; if (d < 120) this.hurt(hit, e, e.level); e.cd = e.elite ? 1.3 : 1.8; this.play('squeak', e); }
        } else if (e.cd <= 0 && d < 135) e.windup = .35;
        else {
          // Circle the hero at a distance, then dart in.
          const want = d > 190 ? sp : d < 120 ? -sp * .6 : 0, side = Math.sin(e.angle) * sp * .7;
          e.x += (dx * want - dy * side) * dt; e.y += (dy * want + dx * side) * dt;
        }
        break;
      }
      case 'webspinner': {
        if (h.slowT > 0 && d > 40) { e.x += dx * sp * 1.4 * dt; e.y += dy * sp * 1.4 * dt; break; }
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { this.enemyShot(e, Math.atan2(dy, dx), 290, 'web', hit * .5); e.cd = 2.6; this.play('thornShot', e); } }
        else if (e.cd <= 0 && d < 400) e.windup = .45;
        else { const want = d > 280 ? sp : d < 200 ? -sp * .7 : 0; e.x += dx * want * dt; e.y += dy * want * dt; }
        break;
      }
      case 'frostwraith': {
        e.angle += dt * 2;
        const side = Math.sin(e.angle) * sp * .6, want = d > 260 ? sp : d < 180 ? -sp : 0;
        e.x += (dx * want - dy * side) * dt; e.y += (dy * want + dx * side) * dt;
        e.blinkT -= dt;
        if (e.blinkT <= 0 && d < 600) {
          e.blinkT = rand(4, 6.5);
          this.emit(e.x, e.y, 20, ['#bfe8ff', '#ffffff'], { speed: 200, life: .5, kind: 'star', glow: true });
          const a = rand(0, 6.28), p = { x: h.x + Math.cos(a) * rand(170, 230), y: h.y + Math.sin(a) * rand(140, 200) };
          this.collide(p, e.r); e.x = p.x; e.y = p.y; e.windup = .45;
          this.emit(e.x, e.y, 20, ['#bfe8ff', '#ffffff'], { speed: 200, life: .5, kind: 'star', glow: true }); this.play('dash', e);
        }
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { const a = Math.atan2(dy, dx); for (const off of e.elite ? [-.36, -.18, 0, .18, .36] : [-.22, 0, .22]) this.enemyShot(e, a + off, 330, 'ice', hit * .75); e.cd = 2.1; this.play('voidShot', e); } }
        else if (e.cd <= 0 && d < 420) e.windup = .5;
        break;
      }
      case 'cragGolem': {
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) e.cd = 3.6; }
        else if (e.cd <= 0 && d < 160) { e.windup = 1; this.addHazard(e.x, e.y, 155, 1, 'slam', e, hit * 1.2, e.level); this.play('roar', e); }
        else if (d > 80) { e.x += dx * sp * dt; e.y += dy * sp * dt; }
        break;
      }
      case 'emberImp': {
        // Hovers just out of reach and lobs fire, weaving side to side.
        e.angle += dt * 2.2;
        const side = Math.sin(e.angle) * sp * .5, want = d > 300 ? sp : d < 210 ? -sp : 0;
        e.x += (dx * want - dy * side) * dt; e.y += (dy * want + dx * side) * dt;
        if (Math.random() < dt * 6) this.emit(e.x, e.y + 4, 1, ['#ffb347', '#ff6b3d'], { speed: 20, life: .5, glow: true, size: 3, grav: -40, kind: 'ember' });
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { const a0 = Math.atan2(dy, dx); for (const off of e.elite ? [-.25, 0, .25] : [-.12, .12]) this.enemyShot(e, a0 + off, 300, 'fire', hit * .75); e.cd = 1.9; this.play('sunfire', e); } }
        else if (e.cd <= 0 && d < 440) e.windup = .5;
        break;
      }
      case 'ashScorpion': {
        if (e.burrowT > 0) {
          // Swims under the sand toward the hero, then bursts out beneath them: the ring on the ground is the warning.
          e.burrowT -= dt; e.x += dx * sp * 2.1 * dt; e.y += dy * sp * 2.1 * dt;
          if (Math.random() < dt * 16) this.emit(e.x + rand(-12, 12), e.y + 10, 1, 'rgba(200,160,110,.55)', { speed: 50, life: .5, kind: 'smoke', size: 8 });
          if (d < 60 || e.burrowT <= 0) { e.burrowT = 0; e.windup = .5; this.addHazard(e.x, e.y, 92, .5, 'slam', e, hit * 1.25, e.level); this.play('slam', e); }
          break;
        }
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) e.cd = 2.2; break; }
        if (e.cd <= 0 && d > 160 && d < 520) { e.burrowT = 2.4; e.cd = 4.5; this.emit(e.x, e.y + 8, 14, 'rgba(200,160,110,.6)', { speed: 120, life: .6, kind: 'smoke', size: 10 }); break; }
        if (e.lunge <= 0 && e.cd <= 0 && d < 95) { e.lunge = .25; e.kx += dx * 600; e.ky += dy * 600; this.hurt(hit, e, e.level); e.cd = 1.6; this.play('squeak', e); }
        else if (d > 60) { e.x += dx * sp * dt; e.y += dy * sp * dt; }
        break;
      }
      case 'umbralKnight': {
        // Marches in behind its shield, raises its great blade and brings it down: the ring before it shows where.
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { e.cd = e.elite ? 1.6 : 2.1; e.lunge = .2; } }
        else if (e.cd <= 0 && d < 150) { e.windup = .7; this.addHazard(e.x + dx * 70, e.y + dy * 70, e.elite ? 120 : 100, .7, 'slam', e, hit * 1.3, e.level); this.play('roar', e); }
        else if (d > 70) { e.x += dx * sp * dt; e.y += dy * sp * dt; }
        break;
      }
      case 'duskwing': {
        // Flits round in circles, then dives.
        e.angle += dt * 3;
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { e.lunge = .3; e.kx += dx * 900; e.ky += dy * 900; if (d < 150) this.hurt(hit, e, e.level); e.cd = e.elite ? 1 : 1.4; this.play('flap', e); } }
        else if (e.cd <= 0 && d < 170) e.windup = .3;
        else { const want = d > 210 ? sp : d < 120 ? -sp * .6 : 0, side = Math.sin(e.angle) * sp * .8; e.x += (dx * want - dy * side) * dt; e.y += (dy * want + dx * side) * dt; }
        break;
      }
      case 'hollowArcher': {
        // Keeps its distance and looses a volley of shadow bolts.
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { const a = Math.atan2(dy, dx); for (const off of e.elite ? [-.24, -.12, 0, .12, .24] : [-.14, 0, .14]) this.enemyShot(e, a + off, 430, 'void', hit * .7); e.cd = 1.9; this.play('thornShot', e); } }
        else if (e.cd <= 0 && d < 480) e.windup = .55;
        else { const want = d > 330 ? 1 : d < 230 ? -1 : 0; e.x += dx * sp * want * dt; e.y += dy * sp * want * dt; }
        break;
      }
      case 'shardback': {
        // Slams the ground, and crystal shards burst out of it in a ring.
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { e.cd = 3.4; this.novaRing(e, e.elite ? 12 : 8, rand(0, 1), 'ice', hit * .6); } }
        else if (e.cd <= 0 && d < 210) { e.windup = 1; this.addHazard(e.x, e.y, 160, 1, 'slam', e, hit * 1.2, e.level); this.play('roar', e); }
        else if (d > 90) { e.x += dx * sp * dt; e.y += dy * sp * dt; }
        break;
      }
      case 'acolyte': {
        // Blinks close and casts a ring of void orbs; now and then it calls a duskwing out of the dark.
        e.angle += dt * 2;
        const side = Math.sin(e.angle) * sp * .5, want = d > 280 ? sp : d < 200 ? -sp : 0;
        e.x += (dx * want - dy * side) * dt; e.y += (dy * want + dx * side) * dt;
        e.blinkT -= dt;
        if (e.blinkT <= 0 && d < 650) {
          e.blinkT = rand(5, 7.5);
          this.emit(e.x, e.y, 20, ['#1a1030', '#ff6b9a', '#c9b6ff'], { speed: 200, life: .5, kind: 'star', glow: true });
          const a = rand(0, 6.28), p = { x: h.x + Math.cos(a) * rand(190, 250), y: h.y + Math.sin(a) * rand(150, 210) };
          this.collide(p, e.r); e.x = p.x; e.y = p.y; e.windup = .7; this.play('dash', e);
        }
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) {
            this.novaRing(e, e.elite ? 10 : 7, Math.atan2(dy, dx), 'void', hit * .6); e.cd = 2.6;
            if (Math.random() < .35 && this.enemies.filter(x => x.summoned && !x.dead && x.kind === 'duskwing' && dist(x, e) < 700).length < 3) {
              const m = this.makeEnemy({ id: `summon-${this.summonCount++}`, kind: 'duskwing', x: e.x + rand(-60, 60), y: e.y + rand(-60, 60), level: Math.max(1, e.level - 1), region: e.region }, true);
              this.collide(m, m.r); this.enemies.push(m); this.ring(m.x, m.y, 50, '#c98aff', .5);
            }
          }
        } else if (e.cd <= 0 && d < 460) e.windup = .7;
        break;
      }
      case 'magmaHulk': {
        // Raises its fists: the ground cracks open around it and under the hero.
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) e.cd = 3.4; }
        else if (e.cd <= 0 && d < 220) {
          e.windup = 1.1; this.addHazard(e.x, e.y, 150, 1.1, 'lava', e, hit * 1.2, e.level);
          for (let i = 0; i < 3; i++) { const a2 = rand(0, 6.28), r2 = i ? rand(90, 200) : 0; this.addHazard(h.x + Math.cos(a2) * r2, h.y + Math.sin(a2) * r2, 70, 1.3 + i * .25, 'lava', e, hit, e.level); }
          this.play('roar', e);
        } else if (d > 90) { e.x += dx * sp * dt; e.y += dy * sp * dt; }
        break;
      }
    }
  }
  /** Heroic creatures fight like their kind, plus a telegraphed ground slam every few seconds; at half health they
   *  enrage and call two of their kin. */
  private heroicAct(e: Enemy, dt: number, d: number) {
    const h = this.hero, hit = hitAt(e.level) * ENEMY_STATS[e.kind].dmg, fire = e.region === 'ember', kind = fire ? 'lava' as const : 'slam' as const;
    e.heroT -= dt;
    if (e.heroT <= 0 && d < 520) {
      e.heroT = e.enraged ? 5 : 7;
      this.addHazard(e.x, e.y, 170, 1.2, kind, e, hit * 1.4, e.level);
      this.addHazard(h.x, h.y, 80, 1.45, kind, e, hit, e.level);
      this.text(e.x, e.y - e.r - 40, 'Ground slam!', '#ffb347', 16); this.play('roar', e);
    }
    if (!e.enraged && e.hp < e.maxHp * .5) {
      e.enraged = true; e.heroT = Math.min(e.heroT, 1.5);
      for (let i = 0; i < 2; i++) {
        const a = rand(0, 6.28), m = this.makeEnemy({ id: `hsum-${e.id}-${this.summonCount++}`, kind: e.kind, x: e.x + Math.cos(a) * 120, y: e.y + Math.sin(a) * 100, level: Math.max(1, e.level - 2), region: e.region }, true);
        this.collide(m, m.r); this.enemies.push(m); this.ring(m.x, m.y, 50, '#e8a0ff', .5);
      }
      this.text(e.x, e.y - e.r - 56, 'Enraged!', '#ff6b6b', 22); this.ring(e.x, e.y, 150, '#ff6b6b', .6); this.addShake(8); this.play('roar', e);
    }
  }
  private respawnEnemies() {
    const h = this.hero;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.dead) continue;
      if (e.summoned || e.guard || e.wall || e.starborn || e.kind === 'starbeast' || e.id === ECHO_ID) { if (e.deadT > 2) swapRemove(this.enemies, i); continue; }
      if (e.boss || e.deadT < (e.heroic ? HEROIC_RESPAWN : RESPAWN_TIME) || Math.hypot(e.homeX - h.x, e.homeY - h.y) < 560) continue;
      const fresh = this.makeEnemy({ id: e.id, kind: e.kind, x: e.homeX, y: e.homeY, level: e.level, region: e.region, elite: e.elite, heroic: e.heroic }); fresh.spawnT = .6;
      Object.assign(e, fresh);
      if (Math.abs(e.x - h.x) < 1400 && Math.abs(e.y - h.y) < 1000) { this.emit(e.x, e.y, 16, ['#c9b6ff', '#1a1030', '#ffffff'], { speed: 140, life: .6, kind: 'smoke', size: 10 }); this.ring(e.x, e.y, 50, '#c9b6ff', .4); }
    }
  }
  private wander(e: Enemy, dt: number) {
    e.wanderT -= dt;
    if (e.wanderT <= 0) { e.wanderT = rand(1.5, 4); const a = rand(0, 6.28), r = rand(0, 110); e.wanderX = e.homeX + Math.cos(a) * r; e.wanderY = e.homeY + Math.sin(a) * r; }
    const dx = e.wanderX - e.x, dy = e.wanderY - e.y, d = Math.hypot(dx, dy);
    if (d > 6) { e.x += dx / d * 40 * dt; e.y += dy / d * 40 * dt; }
    if (e.ai === 'wisp' || e.ai === 'frostwraith' || e.ai === 'emberImp' || e.ai === 'duskwing' || e.ai === 'acolyte') e.angle += dt * 2;
  }
  private enemyShot(e: Enemy, angle: number, speed: number, kind: BossShot, damage: number) {
    this.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 2.6, r: kind === 'void' || kind === 'web' || kind === 'fire' ? 9 : 7, damage, level: e.level, owner: 'enemy', kind, spin: angle });
  }

  // ───────────────────────────── villagers and wildlife
  private updateNpcs(dt: number) {
    const h = this.hero;
    this.globalBarkT -= dt;
    for (const n of this.npcs) {
      if (n.role === 'follower') { this.updateFollower(n, dt); continue; }
      if (n.role === 'thief') { this.updateThief(n, dt); continue; }
      if (n.role === 'actor') {
        if (n.moving) { const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy); if (d < 4) n.moving = false; else { n.x += dx / d * 110 * dt; n.y += dy / d * 110 * dt; n.walkT += dt * 6; n.faceX = dx > 0 ? 1 : -1; } }
        continue;
      }
      n.barkT = Math.max(0, n.barkT - dt); n.barkCd -= dt;
      const sg = this.siege?.spawned ? this.siege.town : null;
      if (sg && n.barkCd <= 0 && n.role !== 'merchant' && Math.abs(n.x - sg.x) < sg.r && dist(n, sg) < sg.r) { n.bark = pick(['Help!', 'They’re at the houses!', 'Fire! Fire!', 'Save us!', 'Get the buckets!', 'Run!']); n.barkT = 2.4; n.barkCd = rand(4, 9); }
      const dh = Math.abs(n.x - h.x) + Math.abs(n.y - h.y);
      if (dh > ACTIVE_RANGE * 1.4 && n.activity !== 'travel') continue;
      if (!this.npcVisible(n)) continue;
      const close = dh < 150;
      if (dh < 330 && n.barkCd <= 0 && this.globalBarkT <= 0 && !close) { const game = this.gameOf(n); n.bark = this.npcMarker(n)?.mark === '!' ? pick(['Excuse me! Could you help?', 'Oh! A hero! I need a hand…', 'Psst — over here!']) : game && Math.random() < .5 ? pick(game === 'dice' ? ['Anyone for dice?', 'Roll the bones with me!', 'I feel lucky today!'] : ['Who can outshoot me?', 'A shooting match, anyone?', 'Bullseye! Beat that!']) : pick(n.barks.length ? n.barks : ['Hello!']); n.barkT = 3.2; n.barkCd = rand(14, 26); this.globalBarkT = 2.5; }
      n.workT += dt; n.waitT -= dt;
      if (close) { n.moving = false; n.faceX = h.x > n.x ? 1 : -1; continue; }
      let speed = 0;
      switch (n.activity) {
        case 'wander': case 'play': {
          const r = n.activity === 'play' ? 150 : 200;
          if (!n.moving && n.waitT <= 0) { const a = rand(0, 6.28), rr = rand(20, r); n.tx = n.homeX + Math.cos(a) * rr; n.ty = n.homeY + Math.sin(a) * rr * .7; n.moving = true; }
          speed = n.activity === 'play' ? 120 : 48; break;
        }
        case 'patrol': case 'travel': {
          const route = n.route; if (!route?.length) break;
          if (!n.moving && n.waitT <= 0) {
            n.routeI += n.routeDir;
            if (n.activity === 'patrol') n.routeI = (n.routeI + route.length) % route.length;
            else if (n.routeI >= route.length || n.routeI < 0) { n.routeDir *= -1; n.routeI = clamp(n.routeI, 0, route.length - 1); n.waitT = rand(4, 8); break; }
            n.tx = route[n.routeI].x; n.ty = route[n.routeI].y; n.moving = true;
          }
          speed = n.activity === 'travel' ? 72 : 55; break;
        }
        case 'farm': {
          if (!n.moving && n.waitT <= 0) { n.tx = n.homeX + rand(-160, 160); n.ty = n.homeY + rand(-60, 60); n.moving = true; }
          speed = 35; break;
        }
        case 'chop': case 'hammer': {
          const period = n.activity === 'chop' ? 1.2 : .7;
          if (n.workT > period) { n.workT = 0; if (dh < 900) this.play(n.activity === 'chop' ? 'chop' : 'hammer', n); if (n.activity === 'chop') this.emit(n.x + n.faceX * 30, n.y + 2, 3, ['#c9a06a', '#8a6a4a'], { speed: 90, life: .5, kind: 'shard', size: 3, grav: 300 }); }
          break;
        }
      }
      if (n.moving) {
        const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
        if (d < 6) { n.moving = false; n.waitT = n.activity === 'patrol' ? rand(.5, 2) : n.activity === 'travel' ? 0 : n.activity === 'play' ? rand(.2, 1) : rand(2, 5); }
        else {
          n.x += dx / d * speed * dt; n.y += dy / d * speed * dt; n.walkT += dt * speed / 18;
          if (Math.abs(dx) > 2) n.faceX = dx > 0 ? 1 : -1;
          if (n.activity !== 'travel') this.collide(n, 16);
        }
      }
    }
  }
  private updateCritters(dt: number) {
    const h = this.hero, w = this.world;
    for (const c of this.critters) {
      if (c.herd) { this.updateHerdAnimal(c, dt); continue; }
      if (Math.abs(c.x - h.x) > ACTIVE_RANGE || Math.abs(c.y - h.y) > ACTIVE_RANGE) continue;
      const d = Math.hypot(c.x - h.x, c.y - h.y), scare = c.kind === 'deer' ? 260 : c.kind === 'duck' ? 110 : c.kind === 'bird' ? 190 : 160;
      c.t -= dt; c.hop += dt;
      if (c.state === 'fly') {
        c.alt += dt * 140; c.x += c.tx * dt; c.y += c.ty * dt;
        if (c.t <= 0) { // land somewhere new in the same region, out of sight
          const reg = this.regionAt(c.x), a = rand(0, 6.28), rr = rand(900, 1500);
          const nx = clamp(h.x + Math.cos(a) * rr, reg.x0 + 200, reg.x1 - 200), ny = clamp(h.y + Math.sin(a) * rr, 200, w.height - 200);
          c.x = c.homeX = nx; c.y = c.homeY = ny; c.alt = 0; c.state = 'idle'; c.t = rand(1, 4);
        }
        continue;
      }
      if (d < scare && c.state !== 'flee') {
        if (c.kind === 'bird') { c.state = 'fly'; c.t = 3; const a = Math.atan2(c.y - h.y, c.x - h.x) + rand(-.5, .5); c.tx = Math.cos(a) * 260; c.ty = Math.sin(a) * 260 - 60; c.face = c.tx > 0 ? 1 : -1; this.play('flap', c); continue; }
        if (c.kind === 'frog') { const p = w.ponds.reduce((b, q) => Math.hypot(q.x - c.x, q.y - c.y) < Math.hypot(b.x - c.x, b.y - c.y) ? q : b, w.ponds[0]); c.tx = p.x + (c.x - p.x) * .6; c.ty = p.y + (c.y - p.y) * .6; c.state = 'flee'; c.t = .8; this.play('splash', c); continue; }
        const a = Math.atan2(c.y - h.y, c.x - h.x) + rand(-.6, .6), run = c.kind === 'deer' ? 380 : c.kind === 'duck' ? 90 : 240;
        c.tx = c.x + Math.cos(a) * run; c.ty = c.y + Math.sin(a) * run; c.state = 'flee'; c.t = c.kind === 'deer' ? 1.6 : 1.1;
      }
      if (c.state === 'idle' && c.t <= 0) {
        const r = c.kind === 'duck' ? 60 : 120;
        c.tx = c.homeX + rand(-r, r); c.ty = c.homeY + rand(-r, r) * .7; c.state = 'move'; c.t = rand(2, 5);
      }
      if (c.state !== 'idle') {
        const sp = c.state === 'flee' ? (c.kind === 'deer' ? 300 : c.kind === 'duck' ? 70 : c.kind === 'frog' ? 160 : 230) : (c.kind === 'duck' ? 18 : c.kind === 'deer' ? 30 : 40);
        const dx = c.tx - c.x, dy = c.ty - c.y, dd = Math.hypot(dx, dy);
        if (dd < 5 || c.t <= 0) { c.state = 'idle'; c.t = rand(1.5, 5); if (c.kind === 'frog' && inPond(w.ponds, c.x, c.y)) { c.x = c.homeX; c.y = c.homeY; } }
        else {
          const nx = c.x + dx / dd * sp * dt, ny = c.y + dy / dd * sp * dt;
          const wet = inPond(w.ponds, nx, ny);
          if (c.kind === 'duck' ? wet : c.kind === 'frog' || !wet) { c.x = nx; c.y = ny; } else { c.state = 'idle'; c.t = 1; }
          if (Math.abs(dx) > 1) c.face = dx > 0 ? 1 : -1;
          if (c.kind !== 'duck' && c.kind !== 'frog') this.collide(c, 8);
        }
      }
    }
  }

  // ───────────────────────────── bosses
  private bossHit(e: Enemy) { return hitAt(e.level) * 1.5; }
  private updateBoss(e: Enemy, dt: number, d: number) {
    const h = this.hero;
    if (!this.canHurt(e)) {
      this.sealedNoticeT -= dt;
      if (d < 260 && this.sealedNoticeT <= 0) { this.sealedNoticeT = 6; this.notice(this.region(e.region).script.sealed, 'warn', 'Sealed'); }
      return;
    }
    if (!e.aggro) {
      const home = Math.hypot(e.homeX - e.x, e.homeY - e.y);
      if (home > 20) { e.x += (e.homeX - e.x) / home * 90 * dt; e.y += (e.homeY - e.y) / home * 90 * dt; }
      // A guardian can't find a hero hidden in stealth.
      if (d > 540 || this.stealthT > 0) return;
      e.aggro = true; e.cd = 1.4;
      if (!this.bossIntroShown.has(e.id)) { this.bossIntroShown.add(e.id); this.cleanFight = true; this.eventHandler({ type: 'bossIntro', name: this.bossName(e), title: this.bossTitle(e) }); this.play('roar'); this.addShake(12); this.ring(e.x, e.y, 260, '#ff8f7a', .8); }
    }
    if (d > 1200) { e.aggro = false; e.action = null; return; }
    const patterns = this.bossPatterns(e), phases = patterns.length, frac = e.hp / e.maxHp;
    const phase = phases === 3 ? (frac <= .33 ? 3 : frac <= .66 ? 2 : 1) : frac <= .5 ? 2 : 1;
    if (phase > e.phase) { e.phase = phase; this.play('roar'); this.addShake(14); this.flash = .4; this.ring(e.x, e.y, 300, '#ff6b5b', .8); this.notice(`${this.bossName(e)} is enraged!`, 'epic', 'Enraged!'); e.action = null; e.cd = .6; }
    const thresholds = e.kind === 'eclipse' ? [.85, .6, .35, .15] : [.7, .35];
    if (e.summons < thresholds.length && e.hp <= e.maxHp * thresholds[e.summons]) { e.summons++; this.summonMinions(e); }
    if (Math.random() < dt * 8) {
      const v = this.bossVariant(e), shot = this.bossShot(e);
      this.emit(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r * .5), 1, this.bossColors(e), { speed: 20, life: 1, glow: v ? true : e.kind !== 'mossback' && e.kind !== 'brambleWarden', size: 4, grav: -40,
        kind: v ? (shot === 'fire' ? 'ember' : shot === 'thorn' || shot === 'web' ? 'leaf' : 'star') : e.kind === 'hollowStar' || e.kind === 'eclipse' ? 'star' : e.kind === 'cinderTyrant' ? 'ember' : 'leaf' });
    }
    if (d < e.r + 18 && e.action !== 'blink' && e.action !== 'shadowstrike') this.hurt(this.bossHit(e) * .7, e, e.level);
    if (e.action) { this.runBossAction(e, dt); return; }
    const sp = ENEMY_STATS[e.kind].speed * (1 + (e.phase - 1) * .25);
    if (d > 150) { e.x += (h.x - e.x) / d * sp * dt; e.y += (h.y - e.y) / d * sp * dt; }
    if (this.bossFloats(e)) { e.angle += dt; e.y += Math.sin(this.elapsed * 2) * 10 * dt; }
    e.cd -= dt;
    if (e.cd <= 0) {
      const list = patterns[e.phase - 1];
      this.startBossAction(e, list[e.pattern++ % list.length]);
    }
  }
  private summonMinions(e: Enemy, count = 0, quiet = false) {
    const kinds = this.bossVariant(e)?.summons || SUMMONS[e.kind] || ['gloomling'];
    const n = count || (e.kind === 'eclipse' ? 4 : 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(0, 1), m = this.makeEnemy({ id: `summon-${this.summonCount++}`, kind: pick(kinds), x: e.x + Math.cos(a) * 130, y: e.y + Math.sin(a) * 130, level: Math.max(1, e.level - 2), region: e.region }, true);
      m.hp = m.maxHp = Math.round(m.maxHp * .7);
      this.enemies.push(m);
      this.emit(m.x, m.y, 20, ['#c9b6ff', '#ffffff', '#8fd46b'], { speed: 160, glow: true, kind: 'star' }); this.ring(m.x, m.y, 50, '#c9b6ff', .5);
    }
    if (!quiet) { this.notice(`${this.bossName(e)} calls for help!`, 'warn', 'Minions!'); this.play('roar'); }
  }
  private startBossAction(e: Enemy, a: BossAction) {
    const h = this.hero, p = e.phase - 1, big = e.kind === 'eclipse' ? 1.2 : 1;
    e.action = a; e.actionStep = 0;
    switch (a) {
      case 'slam': e.actionT = 1.25; this.addHazard(e.x, e.y, (160 + p * 30) * big, .95, 'slam', e); break;
      case 'boulders': {
        e.actionT = 1.4; const n = 4 + p * 2 + (e.kind === 'eclipse' ? 2 : 0);
        for (let i = 0; i < n; i++) { const a2 = rand(0, 6.28), r = i === 0 ? 0 : rand(40, 190); this.addHazard(h.x + Math.cos(a2) * r + h.vx * .4, h.y + Math.sin(a2) * r + h.vy * .4, 60, 1 + i * .15, 'boulder', e); }
        this.play('roar'); break;
      }
      case 'nova': e.actionT = p ? 1.3 : .95; break;
      case 'roots': {
        e.actionT = 1.5; const base = Math.atan2(h.y - e.y, h.x - e.x), lines = p ? [-.45, 0, .45] : e.kind === 'eclipse' ? [-.3, .3] : [0];
        for (const off of lines) for (let i = 1; i <= 9; i++) this.addHazard(e.x + Math.cos(base + off) * i * 62, e.y + Math.sin(base + off) * i * 62, 46, .55 + i * .09, 'root', e);
        break;
      }
      case 'charge': { e.actionT = 1.3; const dx = h.x - e.x, dy = h.y - e.y, d = Math.max(1, Math.hypot(dx, dy)); e.chargeX = dx / d; e.chargeY = dy / d; break; }
      case 'spiral': e.actionT = p ? 2.6 : 2.1; e.angle = rand(0, 6.28); break;
      case 'meteors': {
        e.actionT = 1.8; const n = 8 + p * 4 + (e.kind === 'eclipse' ? 3 : 0), rain = this.bossVariant(e)?.rain || (e.kind === 'cinderTyrant' ? 'lava' : 'meteor');
        for (let i = 0; i < n; i++) { const a2 = rand(0, 6.28), r = i < 2 ? rand(0, 30) : rand(50, 280); const x = h.x + Math.cos(a2) * r, y = h.y + Math.sin(a2) * r; this.addHazard(x, y, 64, .9 + i * .1, rain, { x: x - 220, y: y - 600, level: e.level }); }
        break;
      }
      case 'blink': e.actionT = 1.4; break;
      case 'volley': e.actionT = p ? 1.9 : 1.5; break;
      case 'shadowstrike': e.actionT = p ? 2.3 : 1.8; break;
      case 'howl': e.actionT = 1.3; this.play('roar'); this.ring(e.x, e.y, 160, this.bossColors(e)[0], .6); break;
      case 'geysers': {
        // The ground bursts open under and around the hero: spikes, lava or frost, one after another.
        e.actionT = 1.6; const n = 5 + p * 3 + (e.kind === 'eclipse' ? 2 : 0), ground = this.bossVariant(e)?.ground || 'slam';
        for (let i = 0; i < n; i++) { const a2 = rand(0, 6.28), r = i === 0 ? 0 : rand(60, 240); this.addHazard(h.x + Math.cos(a2) * r + h.vx * .3, h.y + Math.sin(a2) * r + h.vy * .3, 72, .75 + i * .12, ground, e); }
        this.addShake(4); break;
      }
    }
  }
  private runBossAction(e: Enemy, dt: number) {
    const h = this.hero, p2 = e.phase > 1, hit = this.bossHit(e);
    const before = e.actionT; e.actionT -= dt;
    const passed = (t: number) => before > t && e.actionT <= t;
    switch (e.action) {
      case 'nova': {
        const own = this.bossShot(e), mine = !!this.bossVariant(e);
        const kind: BossShot = e.kind === 'eclipse' ? (e.pattern % 3 === 2 ? (mine ? own : 'fire') : e.pattern % 2 ? 'void' : mine ? own : 'thorn') : own;
        const count = (p2 ? 18 : 14) + (e.kind === 'eclipse' ? 6 : 0);
        if (passed(p2 ? .75 : .4)) this.novaRing(e, count, 0, kind, hit * .7);
        if (p2 && passed(.35)) this.novaRing(e, count, Math.PI / count, kind, hit * .7);
        break;
      }
      case 'charge': {
        if (e.actionT < .75 && e.actionT > .3) {
          e.x += e.chargeX * 820 * dt; e.y += e.chargeY * 820 * dt;
          const CB = this.boundsOf(e); e.x = clamp(e.x, CB.x0 + 60, CB.x1 - 60); e.y = clamp(e.y, CB.y0 + 60, CB.y1 - 60);
          if (Math.random() < .6) this.emit(e.x, e.y + e.r * .6, 2, ['#8a6a4a', '#b6df91'], { speed: 80, life: .6, kind: 'smoke', size: 10 });
          const v = this.bossVariant(e), trail = v ? !!v.trail : e.kind === 'brambleWarden' || e.kind === 'eclipse' || e.kind === 'cinderTyrant';
          if (trail && Math.random() < dt * 14) this.enemyShot(e, Math.atan2(e.chargeY, e.chargeX) + Math.PI + rand(-.9, .9), 170, v ? v.shot : e.kind === 'cinderTyrant' ? 'fire' : 'thorn', hit * .6);
          if (dist(e, h) < e.r + 24) this.hurt(hit, e, e.level);
        }
        if (passed(.75)) { this.addShake(6); this.play('roar'); }
        break;
      }
      case 'spiral': {
        if (e.actionT < (p2 ? 2.3 : 1.8)) {
          e.actionStep += dt;
          while (e.actionStep > .075) {
            e.actionStep -= .075; e.angle += p2 ? .42 : .34;
            const arms = (p2 ? 4 : 3) + (e.kind === 'eclipse' && e.phase === 3 ? 1 : 0);
            const shot = this.bossVariant(e) ? this.bossShot(e) : 'void';
            for (let i = 0; i < arms; i++) this.enemyShot(e, e.angle + (i / arms) * Math.PI * 2, 215, shot, hit * .6);
          }
        }
        break;
      }
      case 'blink': {
        if (passed(1.1)) this.bossBlink(e, 190, p2 ? 180 : 150, .75);
        break;
      }
      case 'shadowstrike': {
        // A string of blinks around the hero, each ending in a quick slam where it lands.
        for (const at of p2 ? [1.95, 1.35, .75, .2] : [1.45, .85, .25]) if (passed(at)) this.bossBlink(e, 150, p2 ? 140 : 120, .5);
        break;
      }
      case 'volley': {
        const shot = this.bossShot(e), n = p2 ? 7 : 5;
        for (const at of p2 ? [1.45, 1, .55] : [1.05, .6]) if (passed(at)) {
          const base = Math.atan2(h.y - e.y, h.x - e.x);
          for (let i = 0; i < n; i++) this.enemyShot(e, base + (i - (n - 1) / 2) * .17, 300, shot, hit * .65);
          this.play(shot === 'fire' ? 'sunfire' : shot === 'thorn' || shot === 'web' ? 'thornShot' : 'voidShot', e);
        }
        break;
      }
      case 'howl': {
        if (passed(.8)) {
          this.addShake(8); this.novaRing(e, p2 ? 16 : 12, rand(0, 1), this.bossShot(e), hit * .6);
          const helpers = this.enemies.filter(x => x.summoned && !x.dead && dist(x, e) < 900).length;
          if (helpers < 5) this.summonMinions(e, 2, true);
        }
        break;
      }
    }
    if (e.actionT <= 0) { e.action = null; e.cd = e.phase === 3 ? .7 : p2 ? .9 : 1.4; }
  }
  private novaRing(e: Enemy, count: number, offset: number, kind: BossShot, damage: number) {
    for (let i = 0; i < count; i++) this.enemyShot(e, offset + (i / count) * Math.PI * 2, 250, kind, damage);
    this.ring(e.x, e.y, 80, kind === 'void' ? '#c9b6ff' : kind === 'fire' ? '#ff9a3d' : kind === 'ice' ? '#bfe8ff' : kind === 'web' || kind === 'knife' ? '#e8e0f0' : '#b6df91', .3); this.addShake(4); this.play(kind === 'thorn' || kind === 'web' ? 'thornShot' : 'voidShot', e);
  }
  /** A guardian vanishes in a puff and reappears next to the hero, and the ground where it lands bursts. */
  private bossBlink(e: Enemy, away: number, r: number, delay: number) {
    const h = this.hero, c = this.bossVariant(e) ? this.bossColors(e) : ['#c9b6ff', '#6a4bd6'];
    this.emit(e.x, e.y, 40, [...c, '#ffffff'], { speed: 260, life: .6, kind: 'star', glow: true }); this.ring(e.x, e.y, 90, c[0], .4);
    const a = rand(0, 6.28), B = this.boundsOf(h); e.x = clamp(h.x + Math.cos(a) * away, B.x0 + 80, B.x1 - 80); e.y = clamp(h.y + Math.sin(a) * away, B.y0 + 80, B.y1 - 80);
    const dp = this.world.depths; if (dp && e.x > this.world.width) keepInDepths(dp, e, e.r);
    this.emit(e.x, e.y, 40, [...c, '#ffffff'], { speed: 260, life: .6, kind: 'star', glow: true }); this.play('dash');
    this.addHazard(e.x, e.y, r, delay, 'slam', e);
  }
  private addHazard(x: number, y: number, r: number, delay: number, kind: Hazard['kind'], from: Point & { level?: number; boss?: boolean }, damage?: number, level?: number) {
    const lv = level ?? from.level ?? 1;
    this.hazards.push({ x, y, r, delay, maxDelay: delay, damage: damage ?? hitAt(lv) * 1.5, level: lv, owner: 'enemy', kind, fromX: from.x, fromY: from.y });
  }
  /** Umbra rises on its throne in the depths: shadow streams race in from every side, then it takes shape. `echo`: the
   *  echo of it that rises whenever the hero comes back down after the story is over. */
  private spawnFinal(rising: boolean, echo = false) {
    if (this.enemies.some(e => e.kind === 'eclipse' && !e.dead)) return;
    this.finalEcho = echo;
    if (rising) { this.finalT = 5; this.flash = .6; this.addShake(16); this.play('roar'); this.notice(echo ? 'Something stirs on the empty throne…' : 'The shadows of every land are gathering…', 'epic', echo ? 'An echo rises…' : 'Umbra rises…'); return; }
    this.createFinal(false);
  }
  /** Where Umbra rises: on its throne in the depths (or, without them, at the last land's light). */
  private finalSpot(): Point | null { const dp = this.world.depths; if (dp) return dp.throne; const c = this.finaleOf(this.lastRegion); return c ? { x: c.x - 40, y: c.y - 150 } : null; }
  /** Walking into the throne room wakes Umbra (or, once the story is over, its echo). */
  private checkThrone() {
    const dp = this.world.depths, q = this.finalQuest, h = this.hero;
    if (!dp || !q || this.finalT > 0 || this.cinePlaying || Math.abs(h.x - dp.throne.x) > 600 || dist(h, dp.throne) > 560) return;
    if (this.enemies.some(e => e.kind === 'eclipse' && !e.dead)) return;
    const st = this.qs(q.id).status;
    if (st === 'active' && !this.umbraBeaten) { this.spawnFinal(true); if (q.cine?.start) this.queueCine(q.cine.start, { $throne: { ...dp.throne } }); }
    else if (this.umbraBeaten && !this.echoBeaten) this.spawnFinal(true, true);
  }
  /** Down the hole beside the Dawn Forge into the depths; `first`, the ground gave way under the hero. Their creatures
   *  are all back, as strong as the hero has grown. */
  descend(first = false) {
    const dp = this.world.depths; if (!dp) return;
    this.dismount(); this.casting = null; this.work = null; this.setMovement(0, 0);
    const h = this.hero; h.x = dp.landing.x; h.y = dp.landing.y; h.vx = h.vy = 0; h.hurtTime = 1.5;
    this.checkpoint = { ...dp.landing }; this.resetDepths(); this.echoBeaten = false;
    this.cineFade = 1; this.camCut++; this.addShake(first ? 20 : 8); this.flash = Math.max(this.flash, .3);
    this.emit(h.x, h.y - 10, 40, ['rgba(160,140,120,.6)', 'rgba(120,100,90,.5)'], { speed: 220, life: 1.4, kind: 'smoke', size: 22 });
    this.emit(h.x, h.y - 240, 30, ['#8a7a68', '#5e4c4a'], { speed: 120, life: 1.2, kind: 'shard', size: 6, grav: 600 });
    this.play('slam'); if (first) this.play('roar');
    for (const p of this.pets) { p.x = h.x - 40; p.y = h.y + 16; p.target = null; }
    this.bump('depths');
    this.eventHandler({ type: 'depths', first });
    this.notice(first ? 'The ground gave way! You have fallen into the depths beneath the Dawn Forge.' : 'You climb down into the depths beneath the Dawn Forge.', 'epic', 'The Depths');
  }
  /** Back up into the light, beside the hole. */
  ascend() {
    const dp = this.world.depths; if (!dp) return;
    this.dismount(); this.casting = null; this.setMovement(0, 0);
    const h = this.hero; h.x = dp.hole.x; h.y = dp.hole.y + 170; h.vx = h.vy = 0; h.hurtTime = 1;
    this.collide(h, 15); this.checkpoint = { x: h.x, y: h.y };
    for (const e of this.enemies) if (e.kind === 'eclipse' && !e.dead && e.id === ECHO_ID) { e.dead = true; e.deadT = 0; }
    this.finalT = 0; this.cineFade = 1; this.camCut++; this.play('flap');
    for (const p of this.pets) { p.x = h.x - 40; p.y = h.y + 16; p.target = null; }
    this.notice('You climb back up into the light of the Ember Wastes.', 'good', 'The surface');
  }
  /** Every creature of the depths is back at its post, as strong as the hero has grown (levels 26 to 30). */
  private resetDepths() {
    const lv = this.profile.level;
    for (const e of this.enemies) {
      if (!e.depths) continue;
      Object.assign(e, this.makeEnemy({ id: e.id, kind: e.kind, x: e.homeX, y: e.homeY, level: clamp(Math.max(26, lv) + (e.elite ? 1 : 0), 26, 30), region: e.region, elite: e.elite, depths: true }));
    }
  }
  /** Umbra rises at the last land's finale: once the Cinder Tyrant falls, at the Dawn Forge. */
  private get lastRegion() { return this.world.regions[this.world.regions.length - 1].id; }
  private createFinal(aggro: boolean) {
    const last = this.lastRegion, at = this.finalSpot(); if (!at) return;
    const echo = this.finalEcho, lv = clamp(Math.max(27, this.profile.level + 1), 27, 30);
    const e = this.makeEnemy({ id: echo ? ECHO_ID : `${last}:final`, kind: 'eclipse', x: at.x, y: at.y, boss: true, level: lv, region: last });
    if (echo) e.hp = e.maxHp = Math.round(e.maxHp * .6);
    e.aggro = aggro; e.spawnT = aggro ? 1.2 : 0; e.homeX = at.x; e.homeY = at.y;
    this.enemies.push(e);
    if (aggro) { this.bossIntroShown.add(e.id); this.cleanFight = true; this.eventHandler({ type: 'bossIntro', name: this.bossName(e), title: this.bossTitle(e) }); this.flash = 1; this.addShake(22); this.play('roar'); this.ring(e.x, e.y, 420, '#c9b6ff', 1.2); }
  }
  private updateFinalRise(dt: number) {
    const at = this.finalSpot(); if (!at) { this.finalT = 0; return; }
    this.finalT -= dt;
    const tx = at.x, ty = at.y;
    // Two streams from the west (the Beacon and the Bell), one rising from the Cradle's own shadow.
    for (const [sx, sy] of [[tx - 1100, ty - 380], [tx - 1100, ty + 380], [tx, ty + 700]]) {
      if (Math.random() > .75) continue;
      const a = Math.atan2(ty - sy, tx - sx) + rand(-.08, .08), v = rand(700, 900), off = rand(0, 1);
      this.particles.push({ x: sx + (tx - sx) * off, y: sy + (ty - sy) * off, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2, max: 1.2, size: rand(5, 9), color: pick(['#1a1030', '#6a4bd6', '#c9b6ff', '#ff6b9a']), kind: 'star', rot: 0, vr: 3, grav: 0, drag: .4, glow: true });
    }
    if (Math.random() < dt * 3) { this.addShake(3); this.ring(tx, ty, rand(80, 260), '#6a4bd6', .6); }
    if (this.finalT <= 0) { this.finalT = 0; this.createFinal(true); }
  }

  // ───────────────────────────── Starfall events
  /** Every ten to twenty minutes of play the sky may drop a star (three times in four), somewhere the hero can reach. */
  private updateStarfall(dt: number) {
    if (this.practice) return;
    if (this.skyStar.t > 0) this.skyStar.t = Math.max(0, this.skyStar.t - dt);
    const s = this.fallen;
    if (!s) {
      if (this.inDepths || this.needsIntro || this.siege || this.profile.level < 2) return;
      this.starfallT -= dt;
      if (this.starfallT > 0) return;
      this.starfallT = rand(STAR_WAIT[0], STAR_WAIT[1]);
      if (Math.random() < .75) this.startStarfall();
      return;
    }
    s.t -= dt;
    if (s.phase === 'falling') { if (s.t <= 0) this.landStar(s); return; }
    const h = this.hero;
    for (const f of s.frags) if (!f.got && Math.abs(f.x - h.x) < 40 && Math.abs(f.y - h.y) < 40 && dist(f, h) < 38) this.takeFragment(f);
    if (!s.seen && Math.abs(s.x - h.x) < 700 && dist(h, s) < 650) { s.seen = true; this.notice(`The fallen star! ${s.name} guards a star-forged chest.`, 'epic', 'The fallen star'); }
    if (s.t <= 60 && s.t + dt > 60) this.notice('The fallen star is fading. Hurry!', 'warn', '1 minute left');
    const fighting = !!s.boss && !s.boss.dead && s.boss.aggro;
    const done = (!s.boss || s.boss.dead) && (!s.chest || this.opened.has(s.chest.id)) && s.frags.every(f => f.got);
    if (done && s.t > 20) s.t = 20;
    if (s.t <= 0 && !fighting) this.endStarfall(s);
  }
  /** The lands the hero can walk to: the first, and each one after it whose way in is open. */
  private reachableRegions() {
    const out = [this.world.regions[0]];
    for (let k = 1; k < this.world.regions.length; k++) { const prev = this.world.regions[k - 1]; if (!this.barriers.filter(b => b.region === prev.id).every(b => this.barrierOpen(b))) break; out.push(this.world.regions[k]); }
    return out;
  }
  /** Open ground for a star to land on, mostly in the hero's own land, far enough to be a walk and away from every town. */
  private starSpot(): Point | null {
    const reach = this.reachableRegions(), here = this.regionAt(this.hero.x), w = this.world;
    for (let i = 0; i < 500; i++) {
      const reg = Math.random() < .6 && reach.includes(here) ? here : pick(reach);
      const p = { x: rand(reg.x0 + 800, reg.x1 - 800), y: rand(500, w.height - 500) }, d = dist(p, this.hero);
      if (d < 1300 || d > 7000) continue;
      if (inPond(w.ponds, p.x, p.y, 220) || inRange(w.ranges, p.x, p.y, 320) || w.rivers.some(rv => Math.abs(riverX(rv, p.y) - p.x) < 420)) continue;
      if (w.pois.some(z => dist(z, p) < z.r + 280)) continue;
      if (this.obstacleGrid.near(p.x, p.y, 320).some(o => dist(o, p) < 240 + o.r)) continue;
      return p;
    }
    return null;
  }
  private startStarfall() {
    const p = this.starSpot(); if (!p) return;
    const reg = this.regionAt(p.x), near = this.poiAt(p, 2600);
    this.fallen = { x: p.x, y: p.y, region: reg.id, place: near ? `near ${near.name}` : `in ${reg.title}`, name: pick(STAR_NAMES), phase: 'falling', t: 3, frags: [], boss: null, foes: [], chest: null, seen: false };
    this.starfalls++;
    this.meteors.push({ x0: p.x - 1300, y0: p.y - 1700, x1: p.x, y1: p.y, t: 0, dur: 3, dark: false });
    this.skyStar = { t: 2.8, dx: Math.sign(p.x - this.hero.x) || 1 };
    this.play('starfall');
    this.eventHandler({ type: 'starfall', place: this.fallen.place, region: reg.id });
  }
  /** The star has landed: its fragments lie scattered, its light has touched the creatures round it, its beast stands guard
   *  over the star-forged chest. All of them are as strong as the hero (or the land, if that is stronger). */
  private landStar(s: Starfall) {
    s.phase = 'landed'; s.t = STAR_TIME;
    const reg = this.region(s.region), lv = clamp(Math.max(this.profile.level, reg.levels[0]) + 1, 2, 30);
    const kinds = [...new Set(this.world.enemies.filter(e => e.region === s.region && !e.boss && !e.depths && Math.abs(e.x - s.x) < 4000).map(e => e.kind))];
    for (let i = 0, n = 6 + Math.floor(Math.random() * 3); i < n; i++) { const a = i / n * 6.28 + rand(0, .5), r = rand(170, 430), p = { x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r * .8 }; this.collide(p, 20); s.frags.push({ ...p, got: false }); }
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 6.28 + rand(0, .6), r = rand(230, 400), p = { x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r * .8 }; this.collide(p, 26);
      const e = this.makeEnemy({ id: `star-${this.starfalls}-${i}`, kind: kinds.length ? pick(kinds) : 'gloomling', x: p.x, y: p.y, level: lv, region: s.region, elite: i < 2, starborn: true });
      this.enemies.push(e); s.foes.push(e);
    }
    const b = this.makeEnemy({ id: `star-boss-${this.starfalls}`, kind: 'starbeast', x: s.x, y: s.y - 30, boss: true, level: lv, region: s.region });
    b.hp = b.maxHp = Math.max(1600, Math.round(2600 * Math.pow(lv / 7, 1.6) * .7)); b.homeX = s.x; b.homeY = s.y - 30;
    this.enemies.push(b); s.boss = b;
    const chest: WorldObject = { id: `starfall:chest-${this.starfalls}-${Date.now().toString(36)}`, kind: 'chest', x: s.x + 70, y: s.y + 130, name: 'Star-forged chest', region: s.region, rich: true, variant: 'star' };
    this.world.objects.push(chest); s.chest = chest; this.touchQuests();
    this.emit(s.x, s.y, 80, ['#fff1b8', '#ffd35c', '#8ee8ff', '#ffffff'], { speed: 420, life: 1.4, kind: 'star', glow: true, size: 6 });
  }
  /** A star fragment: some experience and gold, and every eighth fuses into a Starheart (one more heart of health). */
  private takeFragment(f: { x: number; y: number; got: boolean }) {
    f.got = true; const p = this.profile, reg = this.regionAt(f.x);
    this.emit(f.x, f.y - 10, 26, ['#fff1b8', '#ffd35c', '#ffffff', '#8ee8ff'], { speed: 200, life: .8, kind: 'star', glow: true, size: 4 }); this.play('key', f);
    this.gainXp(18 * reg.xpScale, f.x, f.y); this.gainGold(Math.round(4 + p.level * 1.5), f.x, f.y); this.bump('fragments');
    p.fragments++;
    if (p.fragments >= FRAGMENTS_PER_HEART) {
      p.fragments = 0;
      if (p.starhearts < MAX_STARHEARTS) {
        p.starhearts++; this.refreshStats(false); this.hero.hp = this.hero.maxHp; this.statMax('starhearts', p.starhearts);
        this.ring(this.hero.x, this.hero.y, 200, '#fff1b8', 1); this.flash = Math.max(this.flash, .5); this.play('levelUp');
        this.notice(`Eight star fragments fuse into a Starheart! +${HP_UNIT} max health (${p.starhearts}/${MAX_STARHEARTS}).`, 'epic', 'Starheart!');
      } else { this.gainGold(150 + p.level * 10); this.notice('Eight star fragments flare into a shower of gold.', 'good', 'Star gold'); }
    } else this.notice(`Star fragment ${p.fragments}/${FRAGMENTS_PER_HEART} toward a Starheart`, 'good', `Fragment ${p.fragments}/${FRAGMENTS_PER_HEART}`);
    this.persistProfile(p);
  }
  /** The star fades: whatever it touched goes with it. */
  private endStarfall(s: Starfall) {
    for (const e of [...s.foes, ...(s.boss ? [s.boss] : [])]) if (!e.dead) { e.dead = true; e.deadT = 0; this.emit(e.x, e.y, 16, ['#fff1b8', '#8ee8ff', '#ffffff'], { speed: 160, life: .8, kind: 'star', glow: true }); }
    if (s.chest) { const i = this.world.objects.indexOf(s.chest); if (i >= 0) this.world.objects.splice(i, 1); }
    const all = (!s.boss || s.boss.hp <= 0) && s.frags.every(f => f.got);
    this.fallen = null; this.touchQuests();
    this.notice(all ? 'The fallen star’s light settles into the earth.' : 'The fallen star’s light fades away.', 'info', 'The star fades');
  }

  // ───────────────────────────── projectiles / hazards / orbs / particles
  private updateProjectiles(dt: number) {
    const h = this.hero;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.kind === 'spark' && p.targetId) {
        const t = this.enemies.find(e => e.id === p.targetId && !e.dead);
        if (t) { const dx = t.x - p.x, dy = t.y - p.y, d = Math.max(1, Math.hypot(dx, dy)), sp = Math.hypot(p.vx, p.vy); p.vx += (dx / d * sp - p.vx) * Math.min(1, dt * 8); p.vy += (dy / d * sp - p.vy) * Math.min(1, dt * 8); }
      } else if (p.kind === 'frost' && p.targetId) {
        const t = this.enemies.find(e => e.id === p.targetId && !e.dead);
        if (t) { const dx = t.x - p.x, dy = t.y - p.y, d = Math.max(1, Math.hypot(dx, dy)), sp = Math.hypot(p.vx, p.vy); p.vx += (dx / d * sp - p.vx) * Math.min(1, dt * 7); p.vy += (dy / d * sp - p.vy) * Math.min(1, dt * 7); p.spin = Math.atan2(p.vy, p.vx); }
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.spin += dt * 10;
      if (Math.random() < .7) {
        if (p.kind === 'sunfire') this.emit(p.x, p.y, 2, ['#ffd27a', '#ff9a4a', '#ff6b3d'], { speed: 50, life: .45, kind: 'ember', glow: true, size: 6 });
        else if (p.kind === 'spark') this.emit(p.x, p.y, 1, p.crit ? '#ffd35c' : '#fff6c4', { speed: 20, life: .25, glow: true, size: 3 });
        else if (p.kind === 'void' && Math.random() < .5) this.emit(p.x, p.y, 1, '#a78bfa', { speed: 15, life: .35, glow: true, size: 3 });
        else if ((p.kind === 'ice' || p.kind === 'frost') && Math.random() < .5) this.emit(p.x, p.y, 1, '#dff6ff', { speed: 15, life: .3, glow: true, size: p.kind === 'frost' ? 3 : 2 });
        else if (p.kind === 'fire' && Math.random() < .6) this.emit(p.x, p.y, 1, ['#ffd27a', '#ff6b3d'], { speed: 25, life: .35, kind: 'ember', glow: true, size: 4 });
      }
      let hit = false;
      if (p.owner === 'hero') {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || e.burrowT > 0 || Math.abs(e.x - p.x) > 90 || Math.abs(e.y - p.y) > 90 || dist(p, e) > e.r + p.r || p.passed?.includes(e)) continue;
          if (p.kind === 'sunfire') this.explodeSunfire(p.x, p.y);
          else { this.damageEnemy(e, p.damage, p.crit); if (!e.boss) this.knock(e, { x: p.x - p.vx, y: p.y - p.vy }, 90); if (p.kind === 'frost') e.chillT = Math.max(e.chillT, 2); if (p.pin && !e.dead) { e.stunT = Math.max(e.stunT, e.boss ? p.pin * .4 : p.pin); e.windup = 0; e.lunge = 0; e.kx = e.ky = 0; this.ring(e.x, e.y + e.r * .5, 34, '#b9e27a', .35); } }
          // A piercing arrow flies on through the first creature.
          if (p.pierce) { p.pierce--; p.passed!.push(e); p.damage *= .7; break; }
          hit = true; break;
        }
        if (!hit) for (const pod of this.pods) {
          if (pod.dead || Math.abs(pod.x - p.x) > 50 || Math.abs(pod.y - p.y) > 50 || dist(p, pod) > 26 + p.r) continue;
          if (p.kind === 'sunfire') this.explodeSunfire(p.x, p.y); else this.breakPod(pod);
          hit = true; break;
        }
        if (!hit && p.life <= 0 && p.kind === 'sunfire') this.explodeSunfire(p.x, p.y);
      } else {
        const d = dist(p, { x: h.x, y: h.y - 10 });
        if (h.shieldTime > 0 && d < 46) {
          p.owner = 'hero'; p.vx *= -1.35; p.vy *= -1.35; p.life = 1.4; p.damage = 20 * this.power; if (p.kind === 'web' || p.kind === 'ice' || p.kind === 'fire') p.kind = 'thorn';
          this.emit(p.x, p.y, 8, '#dfe8f5', { speed: 150, life: .3, glow: true }); this.play('reflect'); continue;
        }
        if (d < p.r + 14) {
          if (p.kind === 'web' && h.dashTime <= 0 && h.shieldTime <= 0 && h.iceT <= 0 && h.orbitN <= 0 && h.ghostT <= 0) { h.slowT = 2.2; this.notice('Webbed! You are slowed for a moment.', 'warn', 'Webbed!'); }
          this.hurt(p.damage, p, p.level); hit = true;
        }
      }
      if (!hit && p.owner === 'enemy') for (const o of this.obstacleGrid.near(p.x, p.y, 60)) if (!o.w && dist(p, o) < o.r && o.kind !== 'fence') { hit = true; this.emit(p.x, p.y, 5, p.kind === 'void' ? '#a78bfa' : p.kind === 'ice' ? '#dff6ff' : p.kind === 'fire' ? '#ff9a3d' : '#9fd46b', { speed: 90, life: .3 }); break; }
      if (hit || p.life <= 0) swapRemove(this.projectiles, i);
    }
  }
  private updateHazards(dt: number) {
    const h = this.hero;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const z = this.hazards[i]; z.delay -= dt;
      if (z.delay > 0) continue;
      swapRemove(this.hazards, i);
      if (z.owner === 'enemy') {
        if (dist(h, z) < z.r + 8) { this.hurt(z.damage, z, z.level); if ((z.kind === 'blizzard' || z.kind === 'frostnova') && h.dashTime <= 0 && h.iceT <= 0) h.slowT = Math.max(h.slowT, 1.2); }
      } else {
        for (const e of this.enemies) if (!e.dead && e.burrowT <= 0 && this.canHurt(e) && Math.abs(e.x - z.x) < z.r + 80 && dist(e, z) < z.r + e.r) {
          const frost = z.kind === 'frostbomb' || z.kind === 'frostnova';
          this.damageEnemy(e, z.damage * (e.wall && (z.kind === 'firebomb' || z.kind === 'frostbomb' || z.kind === 'lightning') ? 3 : 1)); this.knock(e, z, e.boss ? 10 : frost || z.kind === 'blizzard' ? 0 : z.kind === 'firebomb' ? 260 : 160);
          const stun = z.kind === 'slam' ? 1.2 : z.kind === 'frostbomb' ? 3 : z.kind === 'frostnova' ? 2 : z.kind === 'lightning' ? .6 : 0;
          if (stun && (!e.boss || frost)) { e.stunT = e.boss ? .8 : stun; e.windup = 0; e.lunge = 0; if (frost) e.frozenT = e.stunT; }
          if (frost || z.kind === 'blizzard') e.chillT = Math.max(e.chillT, frost ? 4 : 2.2);
        }
        for (const p of this.pods) if (!p.dead && dist(p, z) < z.r) this.breakPod(p);
        // Bombs and thunder break cracked walls.
        if (z.kind === 'firebomb' || z.kind === 'frostbomb' || z.kind === 'lightning') for (const o of this.world.objects) if (o.kind === 'crack' && !this.secrets.has(o.id) && Math.abs(o.x - z.x) < z.r + 90 && dist(o, z) < z.r + 70) this.revealSecret(o);
      }
      this.detonateFx(z);
    }
  }
  private detonateFx(z: Hazard) {
    switch (z.kind) {
      case 'slam':
        this.ring(z.x, z.y, z.r * 1.1, '#f6c58a', .5); this.ring(z.x, z.y, z.r * .6, '#ffffff', .3);
        this.emit(z.x, z.y, 34, ['#8a6a4a', '#b39a72', '#6f5337'], { speed: 380, life: .7, kind: 'shard', size: 6, grav: 500 });
        this.emit(z.x, z.y, 12, 'rgba(160,140,110,.45)', { speed: 160, life: 1, kind: 'smoke', size: 22 });
        this.addShake(14); this.play('slam', z); break;
      case 'boulder':
        this.emit(z.x, z.y, 20, ['#8c8f80', '#b0b3a3', '#6f7568'], { speed: 280, life: .6, kind: 'shard', size: 6, grav: 500 });
        this.emit(z.x, z.y, 6, 'rgba(160,150,120,.45)', { speed: 90, life: .8, kind: 'smoke', size: 16 });
        this.addShake(6); this.play('slam', z); break;
      case 'root':
        this.emit(z.x, z.y, 10, ['#6f5337', '#8fd46b', '#553f2d'], { speed: 220, life: .5, kind: 'shard', size: 5, grav: 400, angle: -Math.PI / 2, spread: 1.4 });
        this.addShake(2); this.play('hit', z); break;
      case 'meteor':
        this.ring(z.x, z.y, z.r, '#c9b6ff', .4);
        this.emit(z.x, z.y, 22, ['#c9b6ff', '#6a4bd6', '#ffffff'], { speed: 300, life: .6, kind: 'star', glow: true, size: 5 });
        this.addShake(5); this.play('boom', z); break;
      case 'spore':
        this.emit(z.x, z.y, 30, ['rgba(185,226,122,.7)', 'rgba(223,255,154,.6)', 'rgba(138,171,82,.6)'], { speed: z.r * 1.6, life: 1.1, kind: 'smoke', size: 16, drag: 3 });
        this.ring(z.x, z.y, z.r, '#b9e27a', .4); this.play('pod', z); break;
      case 'starfall':
        this.ring(z.x, z.y, z.r * 1.1, '#fff1b8', .45);
        this.emit(z.x, z.y, 26, ['#fff1b8', '#c9b6ff', '#ffffff', '#ffd35c'], { speed: 340, life: .7, kind: 'star', glow: true, size: 5 });
        this.flash = Math.max(this.flash, .15); this.addShake(5); this.play('boom', z); break;
      case 'firebomb':
        this.ring(z.x, z.y, z.r * 1.15, '#ff9a4a', .5); this.ring(z.x, z.y, z.r * .6, '#fff1b8', .3);
        this.emit(z.x, z.y, 50, ['#ffd27a', '#ff9a4a', '#ff5f3d', '#fff1b8'], { speed: 420, life: .8, kind: 'ember', glow: true, size: 6 });
        this.emit(z.x, z.y, 14, 'rgba(70,50,45,.55)', { speed: 110, life: 1.3, kind: 'smoke', size: 22 });
        this.flash = Math.max(this.flash, .3); this.addShake(12); this.freeze(.05); this.play('boom', z); break;
      case 'frostbomb':
        this.ring(z.x, z.y, z.r * 1.1, '#bfe8ff', .6); this.ring(z.x, z.y, z.r * .5, '#ffffff', .35);
        this.emit(z.x, z.y, 44, ['#dff6ff', '#8fd8ff', '#ffffff'], { speed: 360, life: .9, kind: 'shard', glow: true, size: 6, grav: 200 });
        this.emit(z.x, z.y, 12, 'rgba(220,240,255,.55)', { speed: 120, life: 1.2, kind: 'smoke', size: 20 });
        this.addShake(7); this.play('reflect', z); break;
      case 'lightning':
        this.ring(z.x, z.y, z.r * 1.2, '#ffe96b', .35);
        this.emit(z.x, z.y, 18, ['#fff8c0', '#ffe96b', '#ffffff'], { speed: 300, life: .4, glow: true, size: 3 });
        this.flash = Math.max(this.flash, .2); this.addShake(5); this.play('crit', z); break;
      case 'lava':
        this.ring(z.x, z.y, z.r * 1.1, '#ff7a3d', .45);
        this.emit(z.x, z.y, 30, ['#ffd27a', '#ff7a3d', '#ff3d1f', '#3a2420'], { speed: 320, life: .8, kind: 'ember', glow: true, size: 5, grav: 260, angle: -Math.PI / 2, spread: 2.2 });
        this.emit(z.x, z.y, 8, 'rgba(60,40,36,.55)', { speed: 90, life: 1.1, kind: 'smoke', size: 18 });
        this.addShake(z.r > 120 ? 10 : 5); this.play('slam', z); break;
      case 'frostnova':
        this.ring(z.x, z.y, z.r * 1.1, '#bfeaff', .55); this.ring(z.x, z.y, z.r * .55, '#ffffff', .35);
        this.emit(z.x, z.y, 46, ['#e0f6ff', '#9fe4ff', '#ffffff'], { speed: 420, life: .7, kind: 'shard', glow: true, size: 6, grav: 120 });
        this.flash = Math.max(this.flash, .15); this.addShake(6); this.play('reflect', z); break;
      case 'blizzard':
        this.ring(z.x, z.y, z.r, '#dff6ff', .35);
        this.emit(z.x, z.y, 12, ['#ffffff', '#dff6ff', '#9fe4ff'], { speed: 200, life: .45, kind: 'shard', glow: true, size: 4, grav: 200 });
        this.addShake(1.5); this.play('hit', z); break;
      case 'mark': break;
    }
  }
  private updateOrbs(dt: number) {
    const h = this.hero;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i]; o.age += dt;
      const d = dist(o, h);
      if (o.age > .45 && d < 300) { const pull = 1400 * (1 - d / 330); o.vx += (h.x - o.x) / d * pull * dt; o.vy += (h.y - o.y) / d * pull * dt; }
      o.vx *= Math.pow(.05, dt); o.vy *= Math.pow(.05, dt);
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.age > .3 && d < 24) {
        if (o.kind === 'loot') { if (o.gear) this.addGear(o.gear); this.play('pickup'); swapRemove(this.orbs, i); continue; }
        if (o.kind === 'heart') { h.hp = Math.min(h.maxHp, h.hp + HP_UNIT); this.text(h.x, h.y - 48, `+${HP_UNIT}`, '#ff9aa8', 18); this.play('pickup'); }
        else if (o.kind === 'gold') { this.gainGold(o.value, h.x, h.y); this.play('orb'); }
        else { h.mana = Math.min(h.maxMana, h.mana + 6); this.play('orb'); }
        this.emit(h.x, h.y - 10, 6, o.kind === 'heart' ? '#ff9aa8' : o.kind === 'gold' ? '#ffd35c' : '#9fd8ff', { speed: 90, life: .4, glow: true, size: 3 });
        swapRemove(this.orbs, i); continue;
      }
      if (o.age > 20 && o.kind !== 'loot') swapRemove(this.orbs, i);
    }
  }
  private updateParticles(dt: number) {
    const list = this.particles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]; p.life -= dt;
      if (p.life <= 0) { swapRemove(list, i); continue; }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag; p.vy = p.vy * drag + p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = this.floating.length - 1; i >= 0; i--) { const f = this.floating[i]; f.life -= dt; f.y -= 34 * dt; if (f.life <= 0) this.floating.splice(i, 1); }
  }
  private updateZone() {
    const reg = this.regionAt(this.hero.x);
    if (reg.id !== this.regionId) {
      this.regionId = reg.id; ambience.start(reg.id);
      this.eventHandler({ type: 'region', region: reg.id, danger: this.profile.level < reg.levels[0] - 1 });
      this.statMax('lands', this.landsSeen());
    }
    const p = this.poiAt(this.hero);
    if (!p) { this.zoneName = ''; return; }
    if (p.name === this.zoneName) return;
    this.zoneName = p.name;
    const first = !this.discovered.has(p.id);
    this.eventHandler({ type: 'zone', name: p.name, discovered: first });
    if (!first) return;
    this.discovered.add(p.id); this.play('discover'); this.bump('places'); this.statMax('lands', this.landsSeen());
    this.gainXp(20 * this.region(p.region).xpScale);
    if (p.kind === 'village' || p.kind === 'start' || p.kind === 'camp' || p.kind === 'city') this.setCheckpoint();
    for (const q of this.world.quests) if (q.kind === 'visit' && q.place === p.id) this.advance(q, 1);
  }
  private markExplored() {
    const h = this.hero, C = EXPLORE_CELL, R = 3, cx = Math.floor(h.x / C), cy = Math.floor(h.y / C), rows = this.explored.length / this.exploreCols;
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (x < 0 || y < 0 || x >= this.exploreCols || y >= rows || Math.hypot((x + .5) * C - h.x, ((y + .5) * C - h.y) * 1.3) > C * 2.6) continue;
      const i = y * this.exploreCols + x;
      if (!this.explored[i]) { this.explored[i] = 1; this.exploredVersion++; }
    }
  }
  private updateSoundscape() {
    const h = this.hero;
    let water = 0, fire = 0;
    for (const p of this.world.ponds) { if (Math.abs(h.x - p.x) > p.r + 500) continue; const e = Math.hypot((h.x - p.x) / p.r, (h.y - p.y) / (p.r * .58)); const d = (e - 1) * p.r; water = Math.max(water, clamp(1 - d / 420, 0, 1)); }
    for (const rv of this.world.rivers) { const d = Math.abs(h.x - riverX(rv, h.y)) - rv.hw; if (d < 500) water = Math.max(water, clamp(1 - d / 420, 0, 1)); }
    for (const c of this.campfires) if (Math.abs(h.x - c.x) < 500) fire = Math.max(fire, clamp(1 - dist(h, c) / 420, 0, 1));
    ambience.setProximity(water, fire);
  }
  private updateCelebration(dt: number) {
    this.completeTimer -= dt; this.fireworkTimer -= dt;
    const f = this.finaleOf(this.completeRegion), acc = this.region(this.completeRegion).palette.accent;
    if (f && this.fireworkTimer <= 0) {
      this.fireworkTimer = .22;
      const x = f.x + rand(-380, 380), y = f.y + rand(-340, 60), c = pick([acc, '#ff9aa8', '#9fd8ff', '#fff1b8', '#b9f29d', '#c9b6ff']);
      this.emit(x, y, 40, [c, '#ffffff'], { speed: 300, life: 1.3, kind: 'star', glow: true, size: 4, grav: 90, drag: 1.8 }); this.ring(x, y, 70, c, .5); this.play('kill', { x, y });
    }
    // The chapter itself ends with its last main quest (see endChapter), which may come later.
    if (this.completeTimer <= 0) this.completeTimer = 0;
  }

  // ───────────────────────────── UI data
  private targetOf(q: QuestDef): Point | null {
    const st = this.qs(q.id).status, npc = (id?: string) => this.npcs.find(n => n.id === id) || null;
    if (st === 'available') return npc(q.giver);
    if (st === 'ready') return npc(this.reportTo(q));
    if (st !== 'active') return null;
    if (this.isTalk(q)) return npc(q.to);
    if (q.kind === 'visit') return this.world.pois.find(p => p.id === q.place) || null;
    if (q.kind === 'rescue' || q.kind === 'escort') {
      const f = this.followerOf(q.id); if (f) return dist(f, this.hero) > 520 ? f : this.escortGoal(q);
      if (q.kind === 'escort') return this.escortStart(q);
      return this.world.objects.find(o => o.kind === 'cage' && o.questId === q.id) || null;
    }
    if (q.kind === 'defend') return this.wardOf(q.id);
    if (q.kind === 'chase') return this.thiefOf(q.id) || this.poi(q.place);
    if (q.kind === 'trail') { const step = this.qs(q.id).progress; return this.world.objects.find(o => o.kind === 'clue' && o.questId === q.id && o.step === step) || null; }
    if (q.kind === 'herd') {
      const pen = this.penOf(q.id); let best: Critter | null = null, bd = Infinity;
      for (const c of this.critters) if (c.herd === q.id && !c.penned) { const d = dist(this.hero, c); if (d < bd) { bd = d; best = c; } }
      return !best ? pen : bd < 260 ? pen : best;
    }
    if (q.kind === 'activate') {
      if (q.ordered) return this.poi(q.near);
      let best: WorldObject | null = null, bd = Infinity;
      for (const o of this.world.objects) if (o.kind === 'switch' && o.questId === q.id && !this.got.has(o.id)) { const d = dist(this.hero, o); if (d < bd) { bd = d; best = o; } }
      return best;
    }
    if (q.kind === 'build' && this.qs(q.id).progress >= q.count) return this.world.objects.find(o => o.kind === 'site' && o.questId === q.id) || null;
    if (q.kind === 'slay') {
      // Point at the nearest creature that counts, so a hunt never leaves the player guessing where to look.
      let best: Enemy | null = null, bd = Infinity;
      for (const e of this.enemies) {
        if (e.dead || e.boss || e.summoned || e.guard || e.wall || (q.enemy === 'any' ? e.region !== q.region : e.kind !== q.enemy)) continue;
        const d = dist(this.hero, e); if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    if (q.kind === 'boss') {
      const b = this.enemies.find(e => e.id === q.boss && !e.dead);
      if (b) return b;
      if (this.isFinal(q) && !this.umbraBeaten && this.world.depths) return this.world.depths.throne;
      return this.finaleOf(q.region);
    }
    if (q.kind === 'key' || q.kind === 'collect' || q.kind === 'build') {
      let best: WorldObject | null = null, bd = Infinity;
      for (const o of this.world.objects) {
        const mine = q.kind === 'key' ? o.kind === 'key' && !this.main.keys.includes(o.id) && q.keys!.some(i => this.keyId(q, i) === o.id) : o.questId === q.id && o.kind === 'questItem' && !this.got.has(o.id);
        if (mine) { const d = dist(this.hero, o); if (d < bd) { bd = d; best = o; } }
      }
      if (q.kind !== 'key' && best && bd > 900) return this.world.pois.find(p => p.id === q.near) || best;
      return best;
    }
    return null;
  }
  mainTarget(): Point | null { const q = this.currentMain(), t0 = q ? this.targetOf(q) : null; if (!t0) return null; const t = this.viaDepths(t0); return this.wallBetween(t)?.at || t; }
  /** A point in the depths, seen from the valley, is reached through the hole; a point in the valley, from the depths,
   *  through the nearest way out. */
  private viaDepths(t: Point): Point {
    const dp = this.world.depths; if (!dp) return t;
    const here = this.inDepths, there = inDepthsArea(dp, t);
    if (here === there) return t;
    if (!here) return dp.hole;
    let best: Point = dp.landing, bd = Infinity;
    for (const o of this.world.objects) if (o.kind === 'exit' && this.visibleObject(o)) { const d = dist(o, this.hero); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  /** Where the fallen star lies, while it shines and is still to be found. */
  starTarget(): Point | null { const s = this.fallen; if (!s || s.phase !== 'landed' || this.inDepths) return null; return dist(s, this.hero) > 360 ? s : null; }
  /** A wall still standing between the hero and a point further along the road, and where to stand to strike it. */
  private wallBetween(t: Point) {
    const h = this.hero;
    for (const o of this.barriers) if (isWall(o) && !this.barrierOpen(o) && Math.sign(h.x - o.x) !== Math.sign(t.x - o.x) && Math.abs(h.x - o.x) < 20000) return { o, at: { x: o.x + Math.sign(h.x - o.x || -1) * 150, y: o.y } };
    return null;
  }
  questTarget(): Point | null { const q = this.tracked ? this.quest(this.tracked) : null, t = q && !q.main ? this.targetOf(q) : null; return t && this.viaDepths(t); }
  private goalOf(q: QuestDef) {
    const st = this.qs(q.id), name = (id?: string) => this.npcNamed(id)?.name || '', s = this.region(q.region).script;
    if (st.status === 'available') return q.giver === 'fox' ? (this.hasPet ? 'Follow Tuft' : 'Follow the road') : `Talk to ${name(q.giver)}`;
    if (st.status === 'ready') return `Report to ${name(this.reportTo(q))}`;
    if (st.status === 'done') return 'Complete';
    switch (q.kind) {
      case 'collect': return `${q.item}`;
      case 'slay': return q.enemy && q.enemy !== 'any' ? `${ENEMY_STATS[q.enemy].name}s defeated` : 'Creatures defeated';
      case 'deliver': return `Bring ${q.item && /’s/.test(q.item) ? q.item : `the ${q.item?.toLowerCase()}`} to ${name(q.to)}`;
      case 'talk': return `Speak with ${name(q.to)}`;
      case 'visit': return `Visit ${this.world.pois.find(p => p.id === q.place)?.name}`;
      case 'rescue': { const left = this.guardsLeft(q.id), f = this.followerOf(q.id); return f ? (f.scared ? `Protect ${f.name}!` : `Bring ${f.name} home`) : left ? `Defeat the guards (${left} left)` : `Free ${q.captive?.name}`; }
      case 'escort': { const f = this.followerOf(q.id); return f ? (f.scared ? `Protect ${f.name}!` : `Lead ${f.name} to ${this.poi(q.place)?.name}`) : `Meet ${q.who?.name}`; }
      case 'defend': { const n = q.waves?.length || 3, what = this.siegeTown(q) ? this.siegeLabel(q) : this.siegeLabel(q).toLowerCase(); return this.siege?.q === q ? `Defend ${what} · wave ${Math.min(n, this.siege.wave + 1)}/${n}` : `Defend ${this.poi(q.place)?.name}`; }
      case 'build': return st.progress >= q.count ? `Build the ${q.siteName?.toLowerCase() || 'site'}` : `${q.item}`;
      case 'activate': return `${q.ordered ? 'In the right order: light' : 'Light'} the ${q.switches === 'rune' ? 'runes' : q.switches === 'totem' ? 'totems' : q.switches === 'vent' ? 'vents' : q.switches === 'lantern' ? 'lanterns' : 'braziers'}`;
      case 'chase': return `Catch ${q.who?.name}`;
      case 'trail': return 'Follow the trail';
      case 'herd': return `${q.animal === 'goat' ? 'Goats' : 'Sheep'} in the pen`;
      case 'key': {
        // Where a relic lies never changes, so its goal is worked out once.
        let goal = this.keyGoals.get(q.id);
        if (goal === undefined) { const k = this.world.objects.find(o => o.id === this.keyId(q, q.keys![0])), at = k ? this.poiAt(k, 400)?.name : ''; goal = `Find the ${k?.name.toLowerCase() || 'relic'}${at ? ` · ${at}` : ''}`; this.keyGoals.set(q.id, goal); }
        return goal;
      }
      case 'boss': {
        const b = this.enemyNamed(q.boss);
        const bn = b ? this.bossName(b) : q.boss?.endsWith(':final') ? s.final?.name || 'Umbra' : s.bossName;
        return this.main.bosses.includes(q.boss!) ? `Restore the ${s.finaleName}` : `Defeat ${bn}`;
      }
    }
  }
  private rowFor(q: QuestDef): QuestRow {
    const st = this.qs(q.id), giver = this.npcNamed(q.giver), to = this.npcNamed(this.reportTo(q));
    const detail = st.status === 'available' ? (q.giver === 'fox' ? this.personal([q.summary])[0] : `${giver?.name} in ${giver?.poiName} has a request.`)
      : st.status === 'ready' ? `Report to ${to?.name} in ${to?.poiName}.` : st.status === 'done' ? 'Complete' : q.summary;
    const counted = st.status === 'active' && q.count > 1 && COUNTED.has(q.kind);
    return { id: q.id, title: q.title, giver: giver?.name || this.guideVoice.name, status: st.status, detail, goal: this.goalOf(q), progress: counted ? st.progress : 0, count: counted ? q.count : 0, xp: this.rewardXp(q), reward: this.rewardText(q), tracked: this.tracked === q.id, chapter: this.region(q.region).chapter, personal: !!q.hero,
      canAbandon: this.canAbandon(q.id), abandoned: st.status === 'available' && this.abandoned.has(q.id) };
  }
  /** The villager with this id: while a snapshot is being made (its quest rows ask for dozens), from an index made for it. */
  private npcNamed(id: string | undefined) { return this.npcIndex ? (id ? this.npcIndex.get(id) : undefined) : this.npcs.find(n => n.id === id); }
  private npcIndex: Map<string, Npc> | null = null;
  /** The creature with this id: while a snapshot is being made, from an index made (when first asked) for it. */
  private enemyNamed(id: string | undefined) {
    if (!this.npcIndex) return this.enemies.find(e => e.id === id);
    if (!this.enemyIndex) { this.enemyIndex = new Map(); for (const e of this.enemies) if (!this.enemyIndex.has(e.id)) this.enemyIndex.set(e.id, e); }
    return id ? this.enemyIndex.get(id) : undefined;
  }
  private enemyIndex: Map<string, Enemy> | null = null;
  private keyGoals = new Map<string, string>();
  private mainRow() {
    const cur = this.currentMain();
    if (!cur) { const all = this.world.quests.filter(q => q.main && q.region === this.lastRegion); return { title: 'The valley is saved', step: 'Every light is shining', progress: 0, count: 0, index: all.length, total: all.length }; }
    const list = this.world.quests.filter(q => q.main && q.region === cur.region), row = this.rowFor(cur), t = this.targetOf(cur), wall = t && this.wallBetween(t);
    const dp = this.world.depths, deep = t && dp && inDepthsArea(dp, t) !== this.inDepths ? (this.inDepths ? 'Climb back up to the surface' : 'Go down the hole beside the Dawn Forge') : null;
    return { title: cur.title, step: wall ? `Break through the ${wall.o.name.toLowerCase()}` : deep || row.goal, progress: row.progress, count: row.count, index: list.indexOf(cur) + 1, total: list.length };
  }
  private questRows(main: boolean): QuestRow[] {
    const chapter = this.chapter;
    const rows = this.world.quests.filter(q => !!q.main === main && this.qs(q.id).status !== 'locked' && (!main || this.region(q.region).chapter === Math.min(chapter, this.world.regions.length))).map(q => this.rowFor(q));
    if (main) return rows;
    const order = { ready: 0, active: 1, available: 2, done: 3, locked: 4 };
    const here = this.heroRegion.chapter;
    return rows.sort((a, b) => order[a.status] - order[b.status] || Number(b.chapter === here) - Number(a.chapter === here));
  }
  private nearAction(n: Npc) {
    if (this.npcMarker(n)) return 'Talk';
    return n.role === 'merchant' || n.role === 'armorer' || n.role === 'stable' ? 'Trade' : n.role === 'smith' ? 'Upgrade' : n.role === 'inn' ? 'Rest' : 'Talk';
  }
  snapshot(): GameSnapshot {
    const index = new Map<string, Npc>(); for (const n of this.npcs) if (!index.has(n.id)) index.set(n.id, n);
    this.npcIndex = index;
    try { return this.buildSnapshot(); } finally { this.npcIndex = null; this.enemyIndex = null; }
  }
  private buildSnapshot(): GameSnapshot {
    const near = this.nearest(), h = this.hero, p = this.profile;
    const b = this.enemies.find(e => e.boss && !e.dead && e.aggro && this.canHurt(e));
    let nearName: string | null = null, nearAction: string | null = null;
    if (near?.kind === 'npc') { nearName = near.n.name; nearAction = this.nearAction(near.n); }
    else if (near) {
      const o = near.o; nearName = o.name;
      nearAction = ({ key: 'Take', questItem: 'Take', shrine: this.blessed.has(o.id) ? 'Pray' : 'Bless', finale: 'Inspect', chest: 'Open', sign: 'Read', lore: 'Read', well: 'Drink', fountain: 'Drink', campfire: 'Rest', cage: 'Free', crack: 'Inspect', waterfall: 'Explore', site: 'Build', switch: 'Light', barrier: 'Inspect', clue: '', pen: '', ward: '', hole: 'Descend', exit: 'Climb up' } as const)[o.kind];
    }
    const { chests, lore, sides } = this.fixedLists();
    return {
      hero: this.heroId, region: this.heroRegion.id, chapter: this.chapter, hp: h.hp, maxHp: h.maxHp, mana: Math.round(h.mana), maxMana: h.maxMana, shield: h.shieldTime > 0,
      level: p.level, xp: p.xp, xpNext: xpToNext(p.level), gold: p.gold, upgrades: { ...p.upgrades },
      spells: this.spellIds.map((id, i) => {
        const cd = this.cooldownOf(id), active = this.spellActive(id), passive = id === 'command' && this.petMode === 'passive';
        return { id, name: id === 'command' ? (passive ? 'Fenn: passive' : 'Fenn: attack') : SPELLS[id].name, key: keyLabel(spellKey(i)), icon: passive ? '💤' : SPELLS[id].icon, unlocked: this.spellUnlocked(id), active, level: SPELLS[id].level, cooldown: cd ? Math.min(1, h.cds[id] / cd) : 0, cost: SPELLS[id].cost, affordable: active || h.mana >= SPELLS[id].cost, damage: Math.round((SPELLS[id].dmg || 0) * this.sp(id)), rank: this.spellRank(id), cd };
      }),
      nearName, nearAction,
      mount: this.mountId ? { id: this.mountId, name: MOUNTS[this.mountId].name, riding: this.riding } : null,
      main: this.mainRow(), mainQuests: this.questRows(true), quests: this.questRows(false), defeated: this.defeated, combo: this.combo,
      items: ITEM_ORDER.map(id => ({ id, count: p.items[id] || 0 })),
      buffs: ITEM_ORDER.filter(id => this.buffs[id]).map(id => ({ id, time: this.buffs[id]!, max: ITEMS[id].duration })),
      gear: [...p.gear], equipped: { ...p.equipped }, bagSize: BAG_SIZE, quick: p.quick,
      stats: { regen: h.manaRegen, power: this.power, speed: this.moveSpeed, spark: Math.round((SPELLS[this.spellIds[0]].dmg || 10) * this.sp(this.spellIds[0])), guard: 1 - armorAt(p) * (this.buffs.barkskin ? .5 : 1) * (this.buffs.giantBrew ? .7 : 1), crit: this.critChance, elapsed: Math.floor(this.elapsed), questsDone: sides.filter(q => this.qs(q.id).status === 'done').length, totalQuests: sides.length },
      boss: b ? { name: this.bossName(b), title: this.bossTitle(b), hp: Math.max(0, b.hp), maxHp: b.maxHp, phase: b.phase, level: b.level } : null,
      cine: this.cineState(),
      siege: this.siege ? { title: this.siege.q.title, ward: this.siegeLabel(this.siege.q), wave: Math.min(this.siege.q.waves?.length || 3, this.siege.wave + 1), waves: this.siege.q.waves?.length || 3, hp: Math.max(0, this.siege.hp), max: SIEGE_HP, left: this.siege.raiders.filter(e => !e.dead).length, resting: this.siege.spawned ? 0 : Math.ceil(this.siege.waveT) } : null,
      work: this.work ? { label: `Building the ${this.work.o.name.toLowerCase()}`, t: Math.min(1, this.work.t / WORK_TIME) } : null,
      starfall: this.fallen?.phase === 'landed' ? { place: this.fallen.place, left: Math.max(0, Math.ceil(this.fallen.t)), found: this.fallen.frags.filter(f => f.got).length, total: this.fallen.frags.length, boss: !!this.fallen.boss && !this.fallen.boss.dead } : null,
      fragments: p.fragments, starhearts: p.starhearts, depths: this.inDepths,
      discovered: this.discovered.size, totalPlaces: this.world.pois.length, chests: this.opened.size, totalChests: chests.length, lore: lore.filter(o => this.read.has(o.id)).length, totalLore: lore.length,
    };
  }
  /** The world's chests, lore stones and side quests never change during a run, so the snapshot counts them from lists
   *  made once. */
  private fixedLists() {
    if (this.fixed?.world !== this.world) this.fixed = { world: this.world, chests: this.world.objects.filter(o => o.kind === 'chest'), lore: this.world.objects.filter(o => o.kind === 'lore'), sides: this.sideQuests() };
    return this.fixed;
  }
  private fixed: { world: WorldDefinition; chests: WorldObject[]; lore: WorldObject[]; sides: QuestDef[] } | null = null;
  private cineState(): CineState | null {
    const c = this.cine; if (!c || c.i < 0 || c.i >= c.shots.length) return null;
    const s = c.shots[c.i];
    return { key: `${c.id}-${c.i}`, text: s.text || '', speaker: s.speaker || '', portrait: s.portrait || '', title: s.title || '', sub: s.sub || '', last: c.i === c.shots.length - 1 };
  }
  getObjects() { return this.world.objects.filter(o => this.visibleObject(o)); }
  isOpened(id: string) { return this.opened.has(id); }
  sideQuests(region?: RegionId) { return this.world.quests.filter(q => !q.main && (!region || q.region === region)); }
  earnedStars(region: RegionId) { const side = this.sideQuests(region), done = side.filter(q => this.qs(q.id).status === 'done').length, all = side.length; return 1 + Number(done >= all / 2) + Number(done === all); }
}
