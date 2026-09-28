import { ACHIEVEMENTS, goalOf, type AchDef, type Totals } from './achievements';
import { ambience, footstep, sfx, type Sfx } from './audio';
import { ITEMS, ITEM_ORDER, rollItem } from './items';
import { RARITY, SLOT_ORDER, armouryStock, makeGear, rollRarity, seeded, sellPrice } from './gear';
import { BAG_SIZE, HP_UNIT, MAX_LEVEL, MAX_RANK, armorAt, bagUsed, gearOf, healthAt, loadProfile, manaAt, powerAt, rankOf, regenAt, saveProfile, starsOf, upgradeCost, xpToNext, type Profile } from './progression';
import { HEROES, MAX_STARS, SPELLS, SPELL_UPGRADES, starCost, starLevel, upgradeText } from './spells';
import { MOUNTS, MOUNT_ORDER, mountFor } from './mounts';
import { TRAILS, trailFor } from './trails';
import { keyLabel, keyOf, spellKey } from './keys';
import { Grid } from './spatial';
import { REGION_W, RoadIndex, inPond } from './worldgen';
import { getWorld } from './worlds';
import type {
  CritterKind, EngineEvent, GearItem, GearSlot, HeroId, EnemyKind, EnemySeed, GameSnapshot, ItemId, MainQuest, MiniGame, MountId, NoticeTone, TrailId, NpcDef, Obstacle, Point, Poi,
  QuestDef, QuestOffer, QuestRow, QuestState, Rarity, Region, RegionId, ShopGear, SpellId, SpellRank, UpgradeId, WorldDefinition, WorldObject,
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
};
/** Fenn, Wren's wolf, and the spirit wolves of Call of the Wild (`life` counts down; Fenn's is endless). */
export type Pet = { x: number; y: number; face: number; target: Enemy | null; cd: number; bite: number; leapT: number; walk: number; spirit: boolean; life: number; moving: boolean };
/** Wren's Snare Trap: `t` is the time left; once sprung it snaps shut and fades. */
export type Trap = { x: number; y: number; t: number; sprung: boolean };
export type Npc = NpcDef & { homeX: number; homeY: number; tx: number; ty: number; moving: boolean; faceX: number; waitT: number; routeI: number; routeDir: number; workT: number; bark: string; barkT: number; barkCd: number; walkT: number; poiName: string };
export type Critter = { kind: CritterKind; x: number; y: number; homeX: number; homeY: number; tx: number; ty: number; state: 'idle' | 'move' | 'flee' | 'fly'; t: number; face: number; alt: number; hop: number; seed: number };
type BossAction = 'slam' | 'boulders' | 'nova' | 'roots' | 'charge' | 'spiral' | 'meteors' | 'blink';
export type Projectile = { x: number; y: number; vx: number; vy: number; life: number; r: number; damage: number; level: number; owner: 'hero' | 'enemy'; kind: 'spark' | 'sunfire' | 'thorn' | 'void' | 'web' | 'ice' | 'frost' | 'knife' | 'fire' | 'arrow'; targetId?: string; crit?: boolean; spin: number;
  /** Arrows pass through this many more creatures; `passed` are the ones already hit. */
  pierce?: number; passed?: Enemy[] };
export type Hazard = { x: number; y: number; r: number; delay: number; maxDelay: number; damage: number; level: number; owner: 'hero' | 'enemy'; kind: 'slam' | 'boulder' | 'root' | 'meteor' | 'starfall' | 'spore' | 'firebomb' | 'frostbomb' | 'lightning' | 'lava' | 'frostnova' | 'blizzard' | 'mark'; fromX: number; fromY: number };
/** Riven's Death Mark on a creature, and Lyra's Blizzard over a patch of ground. */
export type Mark = { e: Enemy; t: number; max: number; mul: number };
export type Storm = { x: number; y: number; t: number; tick: number };
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
  /** Columns of the explore grid when saved: the valley grew a fourth land, so older fog maps are re-laid row by row. */
  exploreCols?: number;
};
type Near = { kind: 'object'; o: WorldObject } | { kind: 'npc'; n: Npc };

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
    .replace(/ and Tuft\b/g, '').replace(/ with Tuft\b/g, '').replace(/\bTuft\b/g, 'the wind');
}
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
  mossback: { hp: 2600, r: 46, speed: 78, name: 'Mossback', xp: 700, dmg: 1 },
  brambleWarden: { hp: 6500, r: 46, speed: 88, name: 'Bramble Warden', xp: 1100, dmg: 1 },
  hollowStar: { hp: 12000, r: 42, speed: 96, name: 'The Hollow Star', xp: 1800, dmg: 1 },
  cinderTyrant: { hp: 21000, r: 50, speed: 96, name: 'Pyrrhus', xp: 2800, dmg: 1 },
  eclipse: { hp: 42000, r: 60, speed: 92, name: 'Umbra', xp: 5000, dmg: 1 },
};
const hpMul = (level: number) => 1.5 * (1 + .3 * (level - 1));
/** Damage of one ordinary creature hit at a level, in health points. */
const hitAt = (level: number) => 12 + 5.5 * level;
const BOSS_PATTERNS: Record<string, BossAction[][]> = {
  mossback: [['slam', 'boulders', 'slam', 'boulders'], ['boulders', 'slam', 'charge', 'boulders', 'slam', 'charge']],
  brambleWarden: [['nova', 'roots', 'slam', 'charge'], ['nova', 'charge', 'roots', 'nova', 'slam', 'roots']],
  hollowStar: [['spiral', 'meteors', 'blink', 'nova'], ['meteors', 'spiral', 'blink', 'nova', 'meteors', 'blink']],
  cinderTyrant: [['slam', 'meteors', 'charge', 'nova'], ['meteors', 'charge', 'nova', 'slam', 'boulders', 'charge']],
  eclipse: [['slam', 'nova', 'boulders', 'roots', 'charge'], ['spiral', 'meteors', 'blink', 'slam', 'nova', 'roots'], ['meteors', 'spiral', 'charge', 'boulders', 'blink', 'nova', 'roots', 'slam']],
};
const SUMMONS: Record<string, EnemyKind[]> = {
  mossback: ['gloomling', 'bristleboar'], brambleWarden: ['thornling', 'shadewolf'], hollowStar: ['wisp', 'frostwraith'], cinderTyrant: ['emberImp', 'ashScorpion'],
  eclipse: ['gloomling', 'bristleboar', 'shadewolf', 'webspinner', 'wisp', 'frostwraith', 'emberImp', 'ashScorpion'],
};
const KILL_COLORS: Partial<Record<EnemyKind, string[]>> = {
  gloomling: ['#8c7ce0', '#c9b6ff', '#ffffff'], thornling: ['#9fd46b', '#e8ffb0', '#5fae4f'], wisp: ['#8ee8ff', '#c9b6ff', '#ffffff'],
  bristleboar: ['#a8744a', '#e8c09a', '#ffffff'], sporecap: ['#b9e27a', '#e0735a', '#fff1b8'], shadewolf: ['#5a5a7a', '#a0a0c8', '#ffffff'],
  webspinner: ['#6a4a7a', '#e8e0f0', '#b6df91'], frostwraith: ['#bfe8ff', '#8ee8ff', '#ffffff'], cragGolem: ['#8a8fa8', '#c8cce0', '#8ee8ff'],
  emberImp: ['#ffb347', '#ff6b3d', '#fff1b8'], ashScorpion: ['#c9a26e', '#8a5a3a', '#ffd27a'], magmaHulk: ['#ff7a3d', '#5a3a30', '#ffd27a'], cinderTyrant: ['#ff9a3d', '#ff5f3d', '#fff1b8', '#3a2a26'],
  eclipse: ['#1a1030', '#c9b6ff', '#ff6b9a', '#ffffff'],
};
export const EXPLORE_CELL = 320;
const ACTIVE_RANGE = 1700;
/** Creatures come back this many seconds after being defeated. */
const RESPAWN_TIME = 240;
/** Heroic creatures take longer to come back. */
const HEROIC_RESPAWN = 600;
/** Consumables a quest can pay out (the rare feather is left to luck and merchants). */
const QUEST_ITEMS = ITEM_ORDER.filter(id => id !== 'phoenixFeather');

export class GameEngine {
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
  /** Riven: seconds left of Smoke Veil, and whether the next stab is a sure critical hit (after a Shadowstep). */
  stealthT = 0; nextCrit = false;
  /** Wren: Fenn and any spirit wolves, her traps, and seconds left of Call of the Wild. */
  readonly pets: Pet[] = [];
  readonly traps: Trap[] = [];
  wildT = 0;
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

  constructor(heroId: HeroId, onEvent: (event: EngineEvent) => void, saved?: EngineSave | null) {
    this.heroId = heroId; this.spellIds = HEROES[heroId].spells;
    this.world = getWorld(); this.eventHandler = onEvent; this.checkpoint = { ...this.world.spawn };
    this.profile = loadProfile(heroId);
    const cds = Object.fromEntries(Object.keys(SPELLS).map(s => [s, 0])) as Record<SpellId, number>;
    const p = this.profile;
    this.hero = { x: this.world.spawn.x, y: this.world.spawn.y, vx: 0, vy: 0, hp: healthAt(p), maxHp: healthAt(p), mana: manaAt(p), maxMana: manaAt(p), manaRegen: regenAt(p), faceX: 1, faceY: 0, cds, shieldTime: 0, hurtTime: 0, walkTime: 0, dashTime: 0, dashX: 0, dashY: 0, castTime: 0, slowT: 0, stormT: 0, stormTick: 0, charging: false, ghostT: 0 };
    this.obstacleGrid = new Grid(256, this.world.obstacles);
    this.roads = new RoadIndex(this.world.roads);
    this.enemies = this.world.enemies.map(seed => this.makeEnemy(seed));
    this.pods = this.world.pods.map((pt, id) => ({ id, x: pt.x, y: pt.y, dead: false, hitT: 0 }));
    this.npcs = this.world.npcs.map(n => ({ ...n, homeX: n.x, homeY: n.y, tx: n.x, ty: n.y, moving: false, faceX: 1, waitT: rand(0, 3), routeI: 0, routeDir: 1, workT: rand(0, 2), bark: '', barkT: 0, barkCd: rand(2, 8), walkT: 0, poiName: this.poiAt(n)?.name || this.regionAt(n.x).name }));
    this.critters = this.world.critters.map(c => ({ ...c, homeX: c.x, homeY: c.y, tx: c.x, ty: c.y, state: 'idle', t: rand(0, 3), face: 1, alt: 0, hop: 0, seed: Math.random() }));
    this.questById = new Map(this.world.quests.map(q => [q.id, q]));
    for (const q of this.world.quests) this.quests.set(q.id, { status: q.requires ? 'locked' : 'available', progress: 0 });
    this.campfires = this.world.objects.filter(o => o.kind === 'campfire');
    this.exploreCols = Math.ceil(this.world.width / EXPLORE_CELL);
    this.explored = new Uint8Array(this.exploreCols * Math.ceil(this.world.height / EXPLORE_CELL));
    this.totals = { places: this.world.pois.length, chests: this.world.objects.filter(o => o.kind === 'chest').length, lore: this.world.objects.filter(o => o.kind === 'lore').length, sideQuests: this.world.quests.filter(q => !q.main).length, secrets: this.world.objects.filter(o => o.kind === 'crack' || o.kind === 'waterfall').length };
    if (saved?.version === 4) this.restore(saved);
    this.regionId = this.regionAt(this.hero.x).id;
    if (heroId === 'wren') this.pets.push(this.makePet(false));
    this.markExplored();
    this.syncAchievements();
    ambience.start(this.regionId);
  }
  dispose() { ambience.stop(); if (this.profileDirty) saveProfile(this.profile); }

  private makeEnemy(seed: EnemySeed, summoned = false): Enemy {
    const s = ENEMY_STATS[seed.kind];
    const hp = seed.boss ? s.hp : Math.round(s.hp * hpMul(seed.level) * (seed.heroic ? 9 : seed.elite ? 2.6 : 1));
    return { ...seed, heroT: rand(3, 5), enraged: false, hp, maxHp: hp, r: s.r * (seed.heroic ? 1.6 : seed.elite ? 1.3 : 1), dead: false, deadT: 0, cd: rand(1, 2.5), windup: 0, hitFlash: 0, kx: 0, ky: 0, homeX: seed.x, homeY: seed.y, wanderX: seed.x, wanderY: seed.y, wanderT: rand(0, 3), aggro: summoned, spawnT: summoned ? .6 : 0, phase: 1, action: null, actionT: 0, actionStep: 0, pattern: 0, summons: 0, chargeX: 0, chargeY: 0, lunge: 0, angle: rand(0, 6.28), summoned, rage: 0, stunT: 0, blinkT: rand(3, 6), chillT: 0, frozenT: 0, burrowT: 0 };
  }
  setEventHandler(handler: (event: EngineEvent) => void) { this.eventHandler = handler; }

  private restore(s: EngineSave) {
    const ok = (p: Point) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
    if (ok(s.hero)) { this.hero.x = clamp(s.hero.x, 30, this.world.width - 30); this.hero.y = clamp(s.hero.y, 30, this.world.height - 30); }
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
    this.foxQueue = Array.isArray(s.foxQueue) ? s.foxQueue.filter(id => this.quests.has(id)) : [];
    for (const q of this.world.quests) if (q.giver === 'fox' && this.qs(q.id).status === 'available' && !this.foxQueue.includes(q.id)) this.foxQueue.push(q.id);
    const broken = new Set(Array.isArray(s.brokenPods) ? s.brokenPods : []);
    for (const p of this.pods) if (broken.has(p.id)) p.dead = true;
    for (const e of this.enemies) if (e.boss && this.main.bosses.includes(e.id)) { e.dead = true; e.hp = 0; }
    for (const q of this.world.quests) if (q.kind === 'rescue' && this.qs(q.id).status === 'active') this.spawnGuards(q);
    const final = this.world.quests.find(q => q.boss?.endsWith(':final'));
    if (final && this.qs(final.id).status === 'active' && !this.main.bosses.includes(final.boss!)) this.spawnFinal(false);
  }
  exportSave(): EngineSave {
    const h = this.hero;
    let explored = ''; for (const v of this.explored) explored += v ? '1' : '0';
    return {
      version: 4, hero: { x: h.x, y: h.y, hp: h.hp, mana: h.mana }, main: { keys: [...this.main.keys], bosses: [...this.main.bosses], finales: [...this.main.finales] }, quests: Object.fromEntries(this.quests),
      got: [...this.got], opened: [...this.opened], read: [...this.read], discovered: [...this.discovered], explored,
      brokenPods: this.pods.filter(p => p.dead).map(p => p.id), checkpoint: { ...this.checkpoint }, elapsed: this.elapsed, defeated: this.defeated, blessed: [...this.blessed], secrets: [...this.secrets], tracked: this.tracked,
      chapterStart: { ...this.chapterStart }, awaiting: false, foxQueue: [...this.foxQueue], exploreCols: this.exploreCols,
    };
  }

  // ───────────────────────────── helpers
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
  get chapter() { return this.world.regions.find(r => !this.main.finales.includes(r.id))?.chapter ?? this.world.regions.length; }
  private bossName(e: Enemy) { const s = this.region(e.region).script; return e.kind === 'eclipse' ? s.final?.name || 'Umbra' : s.bossName; }
  private bossTitle(e: Enemy) { const s = this.region(e.region).script; return e.kind === 'eclipse' ? s.final?.title || '' : s.bossTitle; }
  private bossQuest(e: Enemy) { return this.world.quests.find(q => q.kind === 'boss' && q.boss === e.id) || null; }
  /** A guardian can be fought once its quest has been accepted. */
  bossUnlocked(e: Enemy) { const q = this.bossQuest(e); if (!q) return true; const st = this.qs(q.id).status; return st === 'active' || st === 'done'; }
  private canHurt(e: Enemy) { return !e.boss || this.bossUnlocked(e); }
  keysFound(region: RegionId) { return this.main.keys.filter(k => k.startsWith(`${region}:`)).length; }
  spellUnlocked(id: SpellId) { return this.profile.level >= SPELLS[id].level; }
  get power() { return powerAt(this.profile) * (this.buffs.powerElixir ? 1.35 : 1) * (this.buffs.giantBrew ? 1.4 : 1); }
  /** Damage multiplier of one ability: overall power times its upgrade stars. */
  private sp(id: SpellId) { const u = SPELL_UPGRADES[id]; return this.power * (u.stat === 'damage' ? 1 + starsOf(this.profile, id) * u.per / 100 : 1); }
  cooldownOf(id: SpellId) { const u = SPELL_UPGRADES[id]; return SPELLS[id].cooldown * (u.stat === 'cooldown' ? 1 - starsOf(this.profile, id) * u.per / 100 : 1); }
  private durationOf(id: SpellId, base: number) { const u = SPELL_UPGRADES[id]; return base * (u.stat === 'duration' ? 1 + starsOf(this.profile, id) * u.per / 100 : 1); }
  get critChance() { return .15 + gearOf(this.profile).crit / 100; }
  get moveSpeed() { return (this.buffs.swiftTonic ? 1.4 : 1) * (1 + gearOf(this.profile).speed / 100) * (this.buffs.giantBrew ? .9 : 1); }
  /** How big the hero is drawn: Giant's Brew makes them huge. */
  get heroScale() { const t = this.buffs.giantBrew; return t === undefined ? 1 : 1 + .45 * Math.min(1, t * 2, (ITEMS.giantBrew.duration - t) * 3 + .01); }
  get bossFight() { return this.enemies.some(e => e.boss && !e.dead && e.aggro && this.canHurt(e)); }
  get regionTrack() { return this.regionId; }
  addShake(n: number) { this.shake = Math.min(22, this.shake + n); }
  poiAt(p: Point, pad = 0): Poi | null { let best: Poi | null = null, bd = Infinity; for (const z of this.world.pois) { const d = dist(p, z); if (d < z.r + pad && d < bd) { bd = d; best = z; } } return best; }
  npcVisible(n: Npc) { return !n.after || this.qs(n.after)?.status === 'done'; }
  /** Hero damage against a creature: weaker the higher it is above Mira's level. */
  private dealMul(level: number) { const d = level - this.profile.level; return d > 0 ? Math.max(.3, 1 - d * .1) : 1 + Math.min(.3, -d * .04); }
  /** Damage Mira takes from a creature of this level. */
  private takeMul(level: number) { const d = level - this.profile.level; return d > 0 ? 1 + d * .15 : Math.max(.6, 1 + d * .06); }

  emit(x: number, y: number, count: number, color: string | string[], o: Partial<Particle> & { speed?: number; spread?: number; angle?: number } = {}) {
    const speed = o.speed ?? 160, spread = o.spread ?? Math.PI * 2, base = o.angle ?? 0;
    count = this.fx < 1 ? Math.floor(count * this.fx + Math.random()) : count;
    const cap = 900 * this.fx;
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
        const m = mountFor(d.id);
        if (m) this.news.push({ text: `New mount: ${MOUNTS[m].name}! Press ${keyLabel(keyOf('ride'))} (or the saddle button) to ride.`, short: `New mount: ${MOUNTS[m].name}`, t: 4.5 });
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
    saveProfile(p);
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
    if (mag > .08) { this.hero.faceX = x; this.hero.faceY = y; }
  }
  cast(id: SpellId) {
    sfx.unlock();
    if (this.completeTimer > 0) return;
    const info = SPELLS[id], h = this.hero;
    if (this.riding && this.spellUnlocked(id)) this.dismount();
    if (!this.spellUnlocked(id)) { this.play('nope'); this.notice(`${info.name} is learned at level ${info.level}. Defeat creatures and finish quests to level up.`, 'warn', `Level ${info.level}`); return; }
    if (id === 'spark') return this.attack();
    if (id === 'dash') return this.dash();
    if (id === 'slash') return this.swordSlash();
    if (id === 'charge') return this.charge();
    if (id === 'frostbolt') return this.frostbolt();
    if (id === 'blink') return this.blink();
    if (id === 'stab') return this.stab();
    if (id === 'shadowstep') return this.shadowstep();
    if (id === 'arrow') return this.quickShot();
    if (id === 'tumble') return this.tumble();
    if (h.cds[id] > 0) { this.play('nope'); return; }
    if (h.mana < info.cost) { this.play('nope'); this.notice('Not enough magic! Break glow pods and defeat creatures for mana.', 'warn', 'No magic'); return; }
    h.mana -= info.cost; h.cds[id] = this.cooldownOf(id); h.castTime = .3;
    if (id === 'sunfire') this.sunfire();
    else if (id === 'shield' || id === 'guard') this.mossShield(id);
    else if (id === 'starfall') this.starfall();
    else if (id === 'slam') this.earthsplitter();
    else if (id === 'bladestorm') this.bladestorm();
    else if (id === 'frostnova') this.frostnova();
    else if (id === 'iceBarrier') this.mossShield(id);
    else if (id === 'blizzard') this.blizzard();
    else if (id === 'knives') this.fanOfKnives();
    else if (id === 'veil') this.smokeVeil();
    else if (id === 'deathmark' && !this.deathmark()) { h.mana += info.cost; h.cds[id] = 0; }
    else if (id === 'volley') this.volley();
    else if (id === 'snare') this.snare();
    else if (id === 'wildcall') this.wildcall();
  }
  private attack() {
    const h = this.hero; if (h.cds.spark > 0) return;
    h.cds.spark = this.cooldownOf('spark'); h.castTime = .18;
    const target = this.nearestTarget(560);
    let dx = h.faceX, dy = h.faceY;
    if (target) { const d = Math.max(1, dist(h, target)); dx = (target.x - h.x) / d; dy = (target.y - h.y) / d; h.faceX = dx; h.faceY = dy; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const crit = Math.random() < this.critChance;
    this.projectiles.push({ x: h.x + dx * 26, y: h.y - 14 + dy * 26, vx: dx * 640, vy: dy * 640, life: 1, r: crit ? 9 : 7, damage: 10 * this.sp('spark') * (crit ? 2 : 1), level: 0, owner: 'hero', kind: 'spark', targetId: target && 'kind' in target ? target.id : undefined, crit, spin: 0 });
    this.emit(h.x + dx * 26, h.y - 14 + dy * 26, 6, ['#fff6c4', '#ffe38a'], { speed: 120, life: .3, size: 3, glow: true, angle: Math.atan2(dy, dx), spread: 1.2 });
    this.play('spark');
  }
  private dash() {
    const h = this.hero; if (h.cds.dash > 0 || h.dashTime > 0) return;
    let dx = this.moveX, dy = this.moveY;
    if (Math.hypot(dx, dy) < .1) { dx = h.faceX; dy = h.faceY; }
    const len = Math.hypot(dx, dy) || 1;
    h.dashX = dx / len; h.dashY = dy / len; h.dashTime = .18; h.cds.dash = this.cooldownOf('dash'); h.slowT = 0;
    this.emit(h.x, h.y + 14, 14, ['#e9f7ff', '#bfe8ff', '#ffffff'], { speed: 140, life: .45, kind: 'smoke', size: 7, angle: Math.atan2(-dy, -dx), spread: 1.6 });
    this.play('dash');
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
      this.damageEnemy(e, 15 * this.sp('slash') * (crit ? 2 : 1), crit); if (!e.boss) this.knock(e, h, 170); hits++;
    }
    for (const p of this.pods) if (!p.dead && dist(h, p) < reach) this.breakPod(p);
    this.play(hits ? 'hit' : 'dash'); if (hits) this.addShake(2 + Math.min(4, hits));
  }
  /** Rushes at the nearest foe (or straight ahead); everything in the way is hurt, knocked aside and stunned.
   *  A short rush: about 230 px at most, and it stops at the foe it aims for instead of carrying on past it. */
  private charge() {
    const h = this.hero; if (h.cds.charge > 0 || h.dashTime > 0) return;
    const t = this.nearestTarget(300, true), moving = Math.hypot(this.moveX, this.moveY) > .1;
    let dx = t ? t.x - h.x : moving ? this.moveX : h.faceX, dy = t ? t.y - h.y : moving ? this.moveY : h.faceY;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const reach = t ? clamp((len - ('r' in t ? t.r : 20) - 10) / 1050, .08, .22) : .2;
    h.dashX = dx; h.dashY = dy; h.faceX = dx; h.faceY = dy; h.dashTime = reach; h.charging = true; h.cds.charge = this.cooldownOf('charge'); h.slowT = 0;
    this.chargeHit.clear();
    this.emit(h.x, h.y + 14, 18, ['#ffd0a0', '#ffb35c', '#ffffff'], { speed: 160, life: .45, kind: 'smoke', size: 8, angle: Math.atan2(-dy, -dx), spread: 1.4 });
    this.play('dash'); this.play('roar');
  }
  /** A shockwave around Kael that hurts and stuns. */
  private earthsplitter() {
    const h = this.hero;
    this.hazards.push({ x: h.x, y: h.y, r: 175, delay: .22, maxDelay: .22, damage: 45 * this.sp('slam'), level: 0, owner: 'hero', kind: 'slam', fromX: h.x, fromY: h.y });
    h.castTime = .3; this.addShake(4); this.play('roar');
  }
  private bladestorm() { const h = this.hero; h.stormT = 3; h.stormTick = 0; this.play('dash'); this.flash = Math.max(this.flash, .15); }
  private updateWarrior(dt: number) {
    const h = this.hero;
    if (h.dashTime <= 0) h.charging = false;
    if (h.charging) for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0 || this.chargeHit.has(e) || Math.abs(e.x - h.x) > 90 || Math.abs(e.y - h.y) > 90 || dist(e, h) > e.r + 34) continue;
      this.chargeHit.add(e); this.damageEnemy(e, 22 * this.sp('charge'));
      if (!e.boss) { e.stunT = 1; e.windup = 0; e.lunge = 0; this.knock(e, { x: e.x - h.dashY * 30 - h.dashX * 10, y: e.y + h.dashX * 30 - h.dashY * 10 }, 420); }
      this.addShake(6); this.hitStop = Math.max(this.hitStop, .04);
    }
    if (h.stormT > 0) {
      h.stormT -= dt; h.stormTick -= dt;
      if (Math.random() < dt * 20) { const a = rand(0, 6.28); this.emit(h.x + Math.cos(a) * 60, h.y - 10 + Math.sin(a) * 40, 1, ['#ffd0a0', '#ffffff', '#ff8a6b'], { speed: 120, life: .3, glow: true, size: 3, angle: a + 1.6, spread: .4 }); }
      if (h.stormTick <= 0) {
        h.stormTick = .25; this.play('dash');
        for (const e of this.enemies) if (!e.dead && e.spawnT <= 0 && Math.abs(e.x - h.x) < 200 && Math.abs(e.y - h.y) < 200 && dist(e, h) < 150 + e.r) { this.damageEnemy(e, 14 * this.sp('bladestorm')); if (!e.boss) this.knock(e, h, 90); }
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
    this.projectiles.push({ x: h.x + dx * 26, y: h.y - 16 + dy * 26, vx: dx * 600, vy: dy * 600, life: 1, r: crit ? 9 : 7, damage: 12 * this.sp('frostbolt') * (crit ? 2 : 1), level: 0, owner: 'hero', kind: 'frost', targetId: target && 'kind' in target ? target.id : undefined, crit, spin: Math.atan2(dy, dx) });
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
    this.hazards.push({ x: from.x, y: from.y, r: 110, delay: .05, maxDelay: .05, damage: 10 * this.sp('blink'), level: 0, owner: 'hero', kind: 'blizzard', fromX: from.x, fromY: from.y });
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
    this.hazards.push({ x: h.x, y: h.y, r: 175, delay: .08, maxDelay: .08, damage: 28 * this.sp('frostnova'), level: 0, owner: 'hero', kind: 'frostnova', fromX: h.x, fromY: h.y });
    h.castTime = .3; this.addShake(3); this.play('reflect');
  }
  /** A blizzard over the nearest pack (or just ahead) that rains ice for four seconds. */
  private blizzard() {
    const h = this.hero, t = this.nearestTarget(620, true);
    const c = t ? { x: t.x, y: t.y } : { x: h.x + h.faceX * 220, y: h.y + h.faceY * 220 };
    this.storms.push({ x: c.x, y: c.y, t: 4, tick: 0 }); this.flash = Math.max(this.flash, .15); this.play('starfall');
  }
  // ───────────────────────────── Riven's abilities
  /** Out of Smoke Veil, the first strike is an ambush for triple damage. */
  private ambush() { if (this.stealthT <= 0) return 1; this.stealthT = 0; this.text(this.hero.x, this.hero.y - 70, 'Ambush!', '#e0c8ff', 18); return 3; }
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
      for (let k = 0; k < 2; k++) { const crit = sure || Math.random() < this.critChance; this.damageEnemy(e, 9 * this.sp('stab') * amb * (crit ? 3 : 1), crit); }
      if (!e.boss) this.knock(e, h, 70); hits++;
    }
    if (hits) this.nextCrit = false;
    for (const p of this.pods) if (!p.dead && dist(h, p) < reach) this.breakPod(p);
    this.play(hits ? 'hit' : 'dash'); if (hits) this.addShake(1.5 + hits);
  }
  /** Steps through the shadows to right behind the nearest foe; the next stab is a sure critical hit. */
  private shadowstep() {
    const h = this.hero; if (h.cds.shadowstep > 0) return;
    const t = this.nearestTarget(380, true), from = { x: h.x, y: h.y };
    if (t) {
      const d = Math.max(1, dist(h, t)), ux = (t.x - h.x) / d, uy = (t.y - h.y) / d, r = ('r' in t ? t.r : 20) + 30;
      h.x = t.x + ux * r; h.y = t.y + uy * r; h.faceX = -ux; h.faceY = -uy;
    } else {
      let dx = this.moveX, dy = this.moveY; if (Math.hypot(dx, dy) < .1) { dx = h.faceX; dy = h.faceY; }
      const l = Math.hypot(dx, dy) || 1; h.x += dx / l * 200; h.y += dy / l * 200;
    }
    h.x = clamp(h.x, 40, this.world.width - 40); h.y = clamp(h.y, 40, this.world.height - 40); this.collide(h, 15);
    h.vx = h.vy = 0; h.ghostT = .3; h.slowT = 0; h.cds.shadowstep = this.cooldownOf('shadowstep'); this.nextCrit = true;
    this.afterimages.push({ x: from.x, y: from.y, life: .28, faceX: h.faceX });
    for (const p of [from, h]) this.emit(p.x, p.y, 16, ['rgba(60,40,90,.7)', 'rgba(140,110,200,.6)', '#e0c8ff'], { speed: 140, life: .5, kind: 'smoke', size: 12 });
    this.play('dash');
  }
  private fanOfKnives() {
    const h = this.hero, amb = this.ambush();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + rand(-.05, .05); this.projectiles.push({ x: h.x, y: h.y - 12, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: .55, r: 7, damage: 18 * this.sp('knives') * amb, level: 0, owner: 'hero', kind: 'knife', spin: a }); }
    h.castTime = .25; this.addShake(2); this.play('thornShot');
  }
  private smokeVeil() {
    const h = this.hero; this.stealthT = this.durationOf('veil', 4);
    for (const e of this.enemies) if (!e.boss && e.aggro) { e.aggro = false; e.windup = 0; e.lunge = 0; e.cd = Math.max(e.cd, 1); }
    this.emit(h.x, h.y, 34, ['rgba(60,50,80,.7)', 'rgba(150,140,180,.6)', 'rgba(220,210,240,.5)'], { speed: 200, life: 1.3, kind: 'smoke', size: 22, drag: 2 });
    this.play('dash');
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
    this.arrowShot(dx / len, dy / len, 11 * this.sp('arrow') * (crit ? 2 : 1), crit, 1);
    this.play('thornShot');
  }
  /** A roll that can't be hit; Fenn pounces on the nearest foe. */
  private tumble() {
    const h = this.hero; if (h.cds.tumble > 0 || h.dashTime > 0) return;
    let dx = this.moveX, dy = this.moveY;
    if (Math.hypot(dx, dy) < .1) { dx = -h.faceX; dy = -h.faceY; }
    const len = Math.hypot(dx, dy) || 1;
    h.dashX = dx / len; h.dashY = dy / len; h.dashTime = .2; h.cds.tumble = this.cooldownOf('tumble'); h.slowT = 0;
    this.emit(h.x, h.y + 14, 14, ['#e0d4b0', '#c8e6a0', '#ffffff'], { speed: 140, life: .45, kind: 'smoke', size: 7, angle: Math.atan2(-dy, -dx), spread: 1.6 });
    const fenn = this.pets.find(p => !p.spirit), t = this.nearestTarget(460, true);
    if (fenn && t && 'kind' in t) { fenn.target = t; fenn.leapT = .32; this.petFocus = t; this.play('squeak', fenn); }
    this.play('dash');
  }
  private volley() {
    const h = this.hero, t = this.nearestTarget(620, true);
    let a = Math.atan2(h.faceY, h.faceX);
    if (t) { a = Math.atan2(t.y - h.y, t.x - h.x); h.faceX = Math.cos(a); h.faceY = Math.sin(a); if ('kind' in t) this.petFocus = t; }
    for (let i = 0; i < 7; i++) { const o = a + (i - 3) * .14, crit = Math.random() < this.critChance; this.arrowShot(Math.cos(o), Math.sin(o), 20 * this.sp('volley') * (crit ? 2 : 1), crit, 0, .6); }
    h.castTime = .3; this.addShake(2); this.play('thornShot');
  }
  private snare() {
    const h = this.hero;
    if (this.traps.filter(t => !t.sprung).length >= 3) this.traps.splice(this.traps.findIndex(t => !t.sprung), 1);
    this.traps.push({ x: h.x, y: h.y + 12, t: 20, sprung: false });
    this.emit(h.x, h.y + 12, 12, ['#b9e27a', '#8a6a4a', '#ffffff'], { speed: 90, life: .5, kind: 'leaf', size: 5 });
    h.castTime = .3; this.play('pickup');
  }
  private wildcall() {
    const h = this.hero, t = this.durationOf('wildcall', 8);
    this.wildT = t;
    for (let i = 0; i < this.pets.length; i++) if (this.pets[i].spirit) { swapRemove(this.pets, i); i--; }
    for (let i = 0; i < 2; i++) this.pets.push(this.makePet(true, t));
    this.ring(h.x, h.y, 140, '#9fe8b0', .6); this.emit(h.x, h.y, 30, ['#9fe8b0', '#e6ffe9', '#ffffff'], { speed: 220, life: .8, kind: 'star', glow: true });
    this.flash = Math.max(this.flash, .15); this.play('roar');
  }
  /** Fenn follows Wren, runs at whatever she shoots (or anything attacking her) and bites; traps wait for a foot. */
  private updatePets(dt: number) {
    const h = this.hero;
    if (this.wildT > 0) this.wildT = Math.max(0, this.wildT - dt);
    const valid = (e: Enemy | null): e is Enemy => !!e && !e.dead && e.spawnT <= 0 && e.burrowT <= 0 && this.canHurt(e) && dist(e, h) < 620;
    if (!valid(this.petFocus)) this.petFocus = null;
    for (let i = this.pets.length - 1; i >= 0; i--) {
      const p = this.pets[i];
      if (p.spirit) { p.life -= dt; if (p.life <= 0) { this.emit(p.x, p.y - 8, 16, ['#9fe8b0', '#e6ffe9'], { speed: 120, life: .6, kind: 'star', glow: true }); swapRemove(this.pets, i); continue; } }
      p.cd -= dt; p.bite = Math.max(0, p.bite - dt);
      if (Math.abs(p.x - h.x) > 900 || Math.abs(p.y - h.y) > 900) { p.x = h.x - 40; p.y = h.y + 16; p.target = null; p.leapT = 0; }
      if (!valid(p.target)) p.target = null;
      if (!p.target) {
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
          this.damageEnemy(p.target, 16 * this.sp('tumble')); if (!p.target.boss) { p.target.stunT = Math.max(p.target.stunT, .8); p.target.windup = 0; p.target.lunge = 0; }
          this.emit(p.target.x, p.target.y, 10, ['#ffffff', '#e0d4b0'], { speed: 160, life: .35, glow: true, size: 3 });
        }
      } else if (p.target && d < reach + 10 && p.cd <= 0) {
        p.cd = p.spirit ? .8 : wild ? .45 : .9; p.bite = .2;
        const e = p.target; this.damageEnemy(e, (p.spirit ? 7 : 9) * this.power * (wild ? 2 : 1) * (1 + starsOf(this.profile, 'wildcall') * .06));
        if (!e.boss) this.knock(e, p, 60);
      }
    }
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i]; t.t -= dt;
      if (t.t <= 0) { swapRemove(this.traps, i); continue; }
      if (t.sprung) continue;
      const hit = this.enemies.find(e => !e.dead && e.spawnT <= 0 && e.burrowT <= 0 && this.canHurt(e) && Math.abs(e.x - t.x) < 90 && Math.abs(e.y - t.y) < 90 && dist(e, t) < e.r + 34);
      if (!hit) continue;
      t.sprung = true; t.t = .7;
      for (const e of this.enemies) if (!e.dead && this.canHurt(e) && e.burrowT <= 0 && dist(e, t) < 90 + e.r) { this.damageEnemy(e, 40 * this.sp('snare')); e.stunT = Math.max(e.stunT, e.boss ? .9 : 3); e.windup = 0; e.lunge = 0; e.kx = e.ky = 0; }
      this.ring(t.x, t.y, 100, '#b9e27a', .5); this.emit(t.x, t.y, 20, ['#b9e27a', '#8a6a4a', '#ffffff'], { speed: 220, life: .5, kind: 'shard', size: 4, grav: 300 });
      this.addShake(4); this.play('slam', t);
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
    this.profileDirty = true; saveProfile(this.profile); this.play(r.won ? 'questDone' : 'page');
  }
  trailUnlocked(id: TrailId) { return !!this.profile.ach.got[TRAILS[id].ach]; }
  setTrail(id: TrailId | null) { if (id && !this.trailUnlocked(id)) return; this.profile.trail = id; saveProfile(this.profile); this.play('ui'); }
  get trail(): TrailId | null { const t = this.profile.trail; return t && this.trailUnlocked(t) ? t : null; }

  // ───────────────────────────── mounts
  mountUnlocked(id: MountId) { return !!this.profile.ach.got[MOUNTS[id].ach]; }
  /** The mount the hero rides: the one chosen in the stable, or the fastest one earned. */
  get mountId(): MountId | null {
    const p = this.profile.mount;
    if (p && this.mountUnlocked(p)) return p;
    for (let i = MOUNT_ORDER.length - 1; i >= 0; i--) if (this.mountUnlocked(MOUNT_ORDER[i])) return MOUNT_ORDER[i];
    return null;
  }
  setMount(id: MountId) { if (!this.mountUnlocked(id)) return; this.profile.mount = id; saveProfile(this.profile); this.play('ui'); }
  private inCombat() { const h = this.hero; return this.bossFight || this.enemies.some(e => !e.dead && e.aggro && this.canHurt(e) && Math.abs(e.x - h.x) < 600 && Math.abs(e.y - h.y) < 600); }
  /** R: call the mount (not while creatures are after you), or step off it. */
  toggleMount() {
    sfx.unlock();
    if (this.completeTimer > 0) return;
    if (this.riding) return this.dismount();
    const id = this.mountId, h = this.hero;
    if (!id) { this.play('nope'); this.notice('You have no mount yet. The first one is earned by discovering 10 places (the Wanderer achievement).', 'warn', 'No mount yet'); return; }
    if (this.inCombat()) { this.play('nope'); this.notice('You can’t call your mount while creatures are after you.', 'warn', 'In combat'); return; }
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
  /** Death Marks count down and burst; Blizzards rain ice; Smoke Veil and the blink grace fade. */
  private updateSpells(dt: number) {
    const h = this.hero;
    h.ghostT = Math.max(0, h.ghostT - dt);
    if (this.pets.length || this.traps.length) this.updatePets(dt);
    if (this.riding) this.mountFx = Math.min(1, this.mountFx + dt * 4);
    if (this.stealthT > 0) { this.stealthT = Math.max(0, this.stealthT - dt); if (Math.random() < dt * 10) this.emit(h.x + rand(-16, 16), h.y + rand(-24, 14), 1, 'rgba(150,130,200,.5)', { speed: 20, life: .6, kind: 'smoke', size: 7, grav: -20 }); }
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i]; m.t -= dt;
      if (m.e.dead) { swapRemove(this.marks, i); continue; }
      if (m.t > 0) continue;
      swapRemove(this.marks, i);
      const e = m.e, dmg = 110 * this.sp('deathmark') * m.mul;
      this.damageEnemy(e, dmg, true);
      for (const o of this.enemies) if (o !== e && !o.dead && this.canHurt(o) && Math.abs(o.x - e.x) < 220 && dist(o, e) < 170 + o.r) this.damageEnemy(o, dmg * .4);
      this.ring(e.x, e.y, 170, '#ff6b9a', .6); this.ring(e.x, e.y, 90, '#ffffff', .35);
      this.emit(e.x, e.y, 40, ['#ff6b9a', '#2a1838', '#e0c8ff', '#ffffff'], { speed: 360, life: .7, kind: 'star', glow: true, size: 5 });
      this.flash = Math.max(this.flash, .25); this.addShake(8); this.hitStop = Math.max(this.hitStop, .05); this.play('boom', e);
    }
    for (let i = this.storms.length - 1; i >= 0; i--) {
      const s = this.storms[i]; s.t -= dt; s.tick -= dt;
      if (s.t <= 0) { swapRemove(this.storms, i); continue; }
      if (Math.random() < dt * 40 * this.fx) this.emit(s.x + rand(-170, 170), s.y + rand(-150, 90), 1, ['#ffffff', '#dff6ff'], { speed: 40, life: .8, size: 3, grav: 160, angle: Math.PI / 2 + .3, spread: .3 });
      if (s.tick <= 0) {
        s.tick = .22;
        const a = rand(0, 6.28), r = rand(0, 150), x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r * .8;
        this.hazards.push({ x, y, r: 66, delay: .35, maxDelay: .35, damage: 13 * this.sp('blizzard'), level: 0, owner: 'hero', kind: 'blizzard', fromX: x + 80, fromY: y - 380 });
      }
    }
  }
  private sunfire() {
    const h = this.hero, target = this.nearestTarget(620);
    let dx = h.faceX, dy = h.faceY;
    if (target) { const d = Math.max(1, dist(h, target)); dx = (target.x - h.x) / d; dy = (target.y - h.y) / d; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    this.projectiles.push({ x: h.x + dx * 30, y: h.y - 14 + dy * 30, vx: dx * 470, vy: dy * 470, life: 1.3, r: 14, damage: 40 * this.sp('sunfire'), level: 0, owner: 'hero', kind: 'sunfire', spin: 0 });
    this.emit(h.x + dx * 30, h.y - 14 + dy * 30, 16, ['#ffd27a', '#ff9a4a', '#fff1b8'], { speed: 180, life: .4, kind: 'ember', glow: true, angle: Math.atan2(dy, dx), spread: 1.4 });
    this.addShake(3); this.play('sunfire');
  }
  private explodeSunfire(x: number, y: number) {
    this.ring(x, y, 105, '#ffb05c', .45); this.ring(x, y, 60, '#fff1b8', .3);
    this.emit(x, y, 36, ['#ffd27a', '#ff9a4a', '#ff6b3d', '#fff1b8'], { speed: 360, life: .7, kind: 'ember', glow: true, size: 5 });
    this.emit(x, y, 10, 'rgba(90,60,50,.5)', { speed: 90, life: 1, kind: 'smoke', size: 16 });
    this.flash = Math.max(this.flash, .25);
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist({ x, y }, e) < 100 + e.r) { this.damageEnemy(e, 40 * this.sp('sunfire')); this.knock(e, { x, y }, e.boss ? 15 : 200); }
    for (const p of this.pods) if (!p.dead && dist({ x, y }, p) < 100) this.breakPod(p);
    this.addShake(9); this.hitStop = .05; this.play('boom', { x, y });
  }
  /** Moss Shield, Shield Wall and Ice Barrier: a ward that blocks everything, bounces projectiles and shoves foes back. */
  private mossShield(id: SpellId) {
    const h = this.hero, ice = id === 'iceBarrier'; h.shieldTime = this.durationOf(id, 3); h.slowT = 0;
    this.ring(h.x, h.y, 70, ice ? '#bfeaff' : '#9fe8b0', .4);
    if (ice) this.emit(h.x, h.y, 30, ['#e0f6ff', '#9fe4ff', '#ffffff'], { speed: 220, life: .6, kind: 'shard', glow: true, size: 5 });
    else this.emit(h.x, h.y, 30, ['#9fe8b0', '#d6ffd9', '#5fae4f'], { speed: 200, life: .6, kind: 'leaf', size: 6 });
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist(h, e) < 110 + e.r) { e.windup = 0; e.cd = Math.max(e.cd, 1.3); this.damageEnemy(e, 10 * this.power); this.knock(e, h, e.boss ? 10 : 220); if (ice) e.chillT = Math.max(e.chillT, 3); }
    this.play('shield');
  }
  private starfall() {
    const h = this.hero;
    const targets = this.enemies.filter(e => !e.dead && this.canHurt(e) && Math.abs(e.x - h.x) < 480 && dist(h, e) < 480).sort((a, b) => dist(h, a) - dist(h, b)).slice(0, 5);
    const spots: Point[] = targets.map(t => ({ x: t.x, y: t.y }));
    while (spots.length < 9) { const a = rand(0, 6.28), r = rand(60, 300); spots.push({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r }); }
    spots.forEach((s, i) => { const delay = .35 + i * .12; this.hazards.push({ x: s.x, y: s.y, r: 72, delay, maxDelay: delay, damage: 34 * this.sp('starfall'), level: 0, owner: 'hero', kind: 'starfall', fromX: s.x + 260, fromY: s.y - 560 }); });
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
  rewardText(q: QuestDef) {
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
    sfx.play('talk'); this.eventHandler({ type: 'dialogue', speaker: n.name, portrait: n.portrait, lines: this.personal([...before, ...q.text.offer]), offer });
  }
  /** Called by the UI when the player presses Accept on an offer. */
  acceptQuest(id: string) {
    const q = this.quest(id); if (!q) return;
    const st = this.qs(q.id); if (st.status !== 'available') return;
    st.status = 'active'; st.progress = 0; this.touchQuests();
    if (!q.main) this.tracked = q.id;
    this.eventHandler({ type: 'quest', title: q.title, state: 'accepted' }); this.play('quest');
    // Anything already done before accepting still counts.
    const already = q.kind === 'collect' ? this.world.objects.filter(o => o.questId === q.id && this.got.has(o.id)).length
      : q.kind === 'key' ? q.keys!.filter(i => this.main.keys.includes(this.keyId(q, i))).length
        : q.kind === 'visit' ? Number(this.discovered.has(q.place!)) : q.kind === 'boss' ? Number(this.main.bosses.includes(q.boss!)) : 0;
    if (already) this.advance(q, already);
    if (q.kind === 'rescue') this.spawnGuards(q);
    if (q.kind === 'boss' && q.boss?.endsWith(':final')) this.spawnFinal(true);
    else if (q.kind === 'boss' && !this.main.bosses.includes(q.boss!)) { const e = this.enemies.find(x => x.id === q.boss); if (e) { this.notice(`The seal on ${this.bossName(e)} is breaking…`, 'epic', 'The seal breaks!'); this.addShake(6); } }
  }
  private keyId(q: QuestDef, i: number) { return `${q.region}:key-${i}`; }
  private advance(q: QuestDef, by: number) {
    const st = this.qs(q.id); if (st.status !== 'active') return;
    st.progress = Math.min(q.count, st.progress + by); this.touchQuests();
    if (q.kind === 'boss') {
      if (st.progress < q.count) return;
      if (q.finale) this.notice(`${q.title}: restore the ${this.region(q.region).script.finaleName}.`, 'good', 'Restore the light');
      else this.complete(q, null, [], true);
      return;
    }
    if (st.progress >= q.count) {
      st.status = 'ready';
      this.eventHandler({ type: 'quest', title: q.title, state: 'ready' }); this.play('quest');
      const to = this.npcs.find(n => n.id === this.reportTo(q));
      this.notice(`${q.title}: report to ${to?.name || 'the quest giver'}.`, 'good', `Report to ${to?.name.split(' ').pop() || 'giver'}`);
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
  }
  track(id: string) { if (this.quests.has(id)) this.tracked = id; }
  /** Tuft's nudges (the next chapter's opener) start on their own once the fireworks are over. */
  private flushFox() {
    if (!this.foxQueue.length || this.completeTimer > 0 || this.foxDelay > 0) return;
    const id = this.foxQueue.shift()!, q = this.quest(id);
    if (!q || this.qs(id).status !== 'available') return;
    const voice = this.guideVoice; this.say(voice.name, voice.portrait, q.text.offer);
    this.acceptQuest(id);
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
    bag[id] = Math.min(99, (bag[id] || 0) + count); saveProfile(this.profile);
    this.text(this.hero.x, this.hero.y - 70, `+${count} ${ITEMS[id].name}`, ITEMS[id].color, 15);
    this.eventHandler({ type: 'item', id, count });
  }
  useItem(id: ItemId) {
    if (this.completeTimer > 0) return;
    const bag = this.profile.items, have = bag[id] || 0, h = this.hero, info = ITEMS[id];
    if (have <= 0) { this.play('nope'); this.notice(`You have no ${info.name} left. Buy more from a city merchant.`, 'warn', `No ${info.name}`); return; }
    if (id === 'healthPotion' && h.hp >= h.maxHp) { this.play('nope'); this.notice('Your health is already full.', 'warn', 'Health full'); return; }
    if (id === 'manaPotion' && h.mana >= h.maxMana - .5) { this.play('nope'); this.notice('Your magic is already full.', 'warn', 'Magic full'); return; }
    if (id === 'phoenixFeather') { this.play('nope'); this.notice('The Phoenix Feather works by itself: keep it in your bag and it saves you when you fall.', 'info', 'Works by itself'); return; }
    if (id === 'thunderJar' && !this.thunderTargets().length) { this.play('nope'); this.notice('No foes in reach — the lightning would be wasted.', 'warn', 'No foes near'); return; }
    if (have > 1) bag[id] = have - 1; else delete bag[id];
    saveProfile(this.profile);
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
    this.profile.gold += n; saveProfile(this.profile); this.play('orb');
    return n;
  }
  setQuick(id: ItemId) { if (id === 'healthPotion') return; this.profile.quick = id; saveProfile(this.profile); this.play('ui'); }

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
    p.gear.push(g); saveProfile(p);
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
    saveProfile(p);
    return true;
  }
  private dropGear(x: number, y: number, ilvl: number, rarity: Rarity) {
    const g = makeGear({ ilvl, rarity, hero: this.heroId }), a = rand(0, 6.28), v = rand(140, 260);
    this.orbs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind: 'loot', age: 0, value: 0, gear: g });
    if (rarity === 'epic' || rarity === 'legendary') this.ring(x, y, 90, RARITY[rarity].color, .8);
  }
  private statsChanged(before: number) {
    this.refreshStats(false); this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + Math.max(0, this.hero.maxHp - before));
    saveProfile(this.profile);
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
  discardGear(uid: string) { const p = this.profile, i = p.gear.findIndex(g => g.uid === uid); if (i < 0) return; p.gear.splice(i, 1); saveProfile(p); this.play('page'); }
  sellGear(uid: string) {
    const p = this.profile, i = p.gear.findIndex(g => g.uid === uid); if (i < 0) return 0;
    const n = sellPrice(p.gear[i]); p.gear.splice(i, 1); p.gold += n; saveProfile(p); this.play('orb');
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
    p.gold -= r.cost; p.stars[id] = r.rank + 1; saveProfile(p); this.statMax('stars', r.rank + 1);
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
    saveProfile(p); this.play('learn'); this.flash = .25;
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
    return true;
  }
  private interactable(o: WorldObject) { return this.visibleObject(o) && !(o.kind === 'chest' && this.opened.has(o.id)) && !((o.kind === 'crack' || o.kind === 'waterfall') && this.secrets.has(o.id)); }
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
    for (const o of this.world.objects) { if (Math.abs(o.x - h.x) > maxRange + 40 || Math.abs(o.y - h.y) > maxRange + 40 || !this.interactable(o)) continue; const d = dist(h, o) - (o.kind === 'questItem' || o.kind === 'key' ? 30 : o.kind === 'cage' ? 40 : 0); if (d < bd) { bd = d; best = { kind: 'object', o }; } }
    for (const n of this.npcs) { if (Math.abs(n.x - h.x) > maxRange || Math.abs(n.y - h.y) > maxRange || !this.npcVisible(n)) continue; const d = dist(h, n) - 12; if (d < bd) { bd = d; best = { kind: 'npc', n }; } }
    return best;
  }
  interact() {
    sfx.unlock();
    if (this.completeTimer > 0) return;
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
        if (q.captive) this.say(q.captive.name, q.captive.portrait, q.text.deliver || ['Thank you!']);
        this.advance(q, 1);
        return;
      }
      case 'chest': {
        this.opened.add(o.id); this.play('chest', o);
        this.emit(o.x, o.y - 10, 36, ['#ffd35c', '#fff1b8', '#ffffff'], { speed: 240, life: 1, kind: 'star', glow: true, size: 5 });
        const n = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.spawnOrb(o.x, o.y - 8, Math.random() < .25 ? 'heart' : 'mana');
        for (let i = 0; i < 4; i++) this.spawnOrb(o.x, o.y - 8, 'gold', Math.round(6 + reg.levels[0] * 2.5));
        this.notice(`You opened the ${o.name.toLowerCase()}!`, 'good'); this.gainXp(35 * reg.xpScale, o.x, o.y); this.bump('chests');
        this.addItem(rollItem()); if (Math.random() < .35) this.addItem(rollItem());
        // A hidden cache always holds a rare or better piece and a pile of extra gold.
        if (o.rich) { for (let i = 0; i < 5; i++) this.spawnOrb(o.x, o.y - 8, 'gold', Math.round(10 + reg.levels[1] * 3)); this.addItem(rollItem()); this.dropGear(o.x, o.y - 8, reg.levels[1] + 1, Math.random() < .1 ? 'legendary' : Math.random() < .45 ? 'epic' : 'rare'); }
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
    n.faceX = this.hero.x > n.x ? 1 : -1; n.waitT = Math.max(n.waitT, 3);
    if (n.role === 'guide' || n.role === 'inn') this.setCheckpoint();
    // Someone you were sent to speak with, or bring something to, comes first; then hand-ins, then new quests.
    for (const q of this.world.quests) if (this.isTalk(q) && q.to === n.id && this.qs(q.id).status === 'active') return this.finish(q, n, q.text.deliver || ['Thank you!']);
    const ready = this.world.quests.find(q => this.qs(q.id).status === 'ready' && this.reportTo(q) === n.id);
    if (ready) return this.finish(ready, n, ready.text.complete);
    const offer = this.offerFrom(n); if (offer) return this.offerQuest(offer, n);
    if (n.role === 'merchant' || n.role === 'smith' || n.role === 'armorer') { sfx.play('talk'); this.eventHandler({ type: 'shop', kind: n.role, name: n.name, portrait: n.portrait }); return; }
    if (n.role === 'inn') {
      const h = this.hero; h.hp = h.maxHp; h.mana = h.maxMana; this.play('rest');
      this.emit(h.x, h.y, 24, ['#fff1b8', '#ffcf6e', '#ffffff'], { speed: 120, life: 1, kind: 'star', glow: true, grav: -40 });
      return this.offerGame(n, 'dice', ['A soft bed, a warm meal, a quiet night.', 'You wake rested. (Fully restored — you will return here if you fall.)']);
    }
    const mine = this.questsFor(n.id);
    const active = mine.find(q => q.main && this.qs(q.id).status === 'active') || mine.find(q => this.qs(q.id).status === 'active');
    if (active) { const st = this.qs(active.id), counted = active.count > 1 && (active.kind === 'collect' || active.kind === 'slay' || active.kind === 'key'); return this.say(n.name, n.portrait, [...active.text.progress, counted ? `(${st.progress}/${active.count})` : ''].filter(Boolean)); }
    if (n.role === 'guide') { const cur = this.currentMain(), reg = this.region(n.region); return this.say(n.name, n.portrait, m.finales.includes(n.region) || !cur ? reg.script.guide.done : [`${cur.title}: ${cur.summary}`, `Follow the gold markers, ${HEROES[this.heroId].name}. The valley is counting on you.`]); }
    const game = this.gameOf(n);
    if (game) return this.offerGame(n, game, [pick(n.lines.length ? n.lines : ['Hello there!'])]);
    const done = mine.find(q => this.qs(q.id).status === 'done');
    this.say(n.name, n.portrait, done && Math.random() < .5 ? done.text.after : [pick(n.lines.length ? n.lines : ['Hello there!'])]);
  }
  /** Main story offers come before side quests. */
  private offerFrom(n: Npc) { const open = this.questsFor(n.id).filter(q => this.qs(q.id).status === 'available'); return open.find(q => q.main) || open[0] || null; }
  /** Hands a quest in; if the same person has the next step, it is offered right after their thanks. */
  private finish(q: QuestDef, n: Npc, lines: string[]) {
    this.complete(q, n, lines, true);
    const next = this.offerFrom(n);
    if (next) this.offerQuest(next, n, lines); else this.say(n.name, n.portrait, lines);
  }
  /** Called by the UI once the finale dialogue closes: fireworks, then the chapter is complete and the story walks on. */
  celebrate() {
    if (this.completeTimer > 0) return;
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
    if (e.kind === 'cragGolem' || e.kind === 'magmaHulk') force *= .25;
    if (this.buffs.giantBrew) force *= 1.8;
    const dx = e.x - from.x, dy = e.y - from.y, d = Math.max(1, Math.hypot(dx, dy));
    e.kx += dx / d * force; e.ky += dy / d * force;
  }
  private damageEnemy(e: Enemy, amount: number, crit = false) {
    if (e.dead || e.burrowT > 0) return;
    if (!this.canHurt(e)) { this.notice(this.region(e.region).script.sealed, 'warn', 'Sealed'); this.emit(e.x, e.y, 8, '#c9b6ff', { speed: 120, glow: true }); return; }
    amount = Math.max(1, Math.round(amount * this.dealMul(e.level)));
    e.hp -= amount; e.hitFlash = .14; e.aggro = true;
    this.combo++; this.comboTime = 2.4;
    if (crit) this.bump('crits');
    if (this.combo >= 15) this.statMax('combo', this.combo);
    this.text(e.x, e.y - e.r - 18, crit ? `${amount}!` : `${amount}`, crit ? '#ffd35c' : '#fff3c0', crit ? 24 : 17);
    this.emit(e.x, e.y, crit ? 12 : 7, ['#ffffff', '#fff3c0', this.region(e.region).palette.accent], { speed: 200, life: .35, glow: true, size: 3 });
    this.play(crit ? 'crit' : 'hit', e);
    if (crit) { this.hitStop = Math.max(this.hitStop, .05); this.addShake(3); }
    if (e.hp <= 0) this.killEnemy(e);
  }
  private killEnemy(e: Enemy) {
    e.dead = true; e.deadT = 0; e.action = null; e.burrowT = 0; e.chillT = 0; e.frozenT = 0;
    if (!e.summoned) { this.defeated++; this.bump('kills'); if (e.elite) this.bump('elites'); if (e.heroic) this.bump('heroics'); if (e.level - this.profile.level >= 4) this.statMax('underdog', 1); }
    const colors = KILL_COLORS[e.kind] || [this.region(e.region).palette.accent, '#ffffff', '#ffd27a', '#ff9a4a'];
    this.emit(e.x, e.y, e.boss ? 140 : 22, colors, { speed: e.boss ? 520 : 240, life: e.boss ? 1.8 : .8, kind: 'star', glow: true, size: e.boss ? 7 : 4, drag: 2 });
    this.emit(e.x, e.y, e.boss ? 36 : 8, ['#8fd46b', '#b9f29d', '#f2a1b8'], { speed: 200, life: 1.6, kind: 'leaf', size: 7, grav: 60 });
    this.ring(e.x, e.y, e.boss ? 320 : 70, colors[0], e.boss ? 1 : .4);
    const drops = e.boss ? 14 : e.heroic ? 10 : e.summoned ? 1 : e.elite ? 6 : 2;
    for (let i = 0; i < drops; i++) this.spawnOrb(e.x, e.y, Math.random() < (e.boss ? .3 : e.elite ? .3 : .1) ? 'heart' : 'mana');
    if (!e.summoned) { const coins = e.boss ? 10 : e.heroic ? 7 : e.elite ? 3 : 1 + Number(Math.random() < .4); for (let i = 0; i < coins; i++) this.spawnOrb(e.x, e.y, 'gold', Math.round((2 + e.level * .9) * (e.boss ? 5 : e.heroic ? 3 : 1))); }
    const gap = this.profile.level - e.level, grey = gap >= 5 ? .1 : gap >= 3 ? .5 : 1;
    const xp = ENEMY_STATS[e.kind].xp * (e.boss ? 1 : .5 * (1 + .2 * (e.level - 1)) * (e.heroic ? 9 : e.elite ? 3 : e.summoned ? .3 : 1) * grey);
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
      this.flash = Math.max(this.flash, .5); this.slowMo = Math.max(this.slowMo, .6); this.addShake(12); this.ring(e.x, e.y, 200, '#e8a0ff', .9); this.play('bossDie');
    }
    else if (!e.summoned && (e.elite ? Math.random() < .35 : Math.random() < .045 * grey)) { const r = rollRarity(Math.random, e.elite ? .4 : 0); this.dropGear(e.x, e.y, e.level, e.elite && r === 'common' ? 'uncommon' : r); }
    if (e.kind === 'sporecap') this.addHazard(e.x, e.y, 110, .7, 'spore', e, hitAt(e.level) * .8, e.level);
    if (e.boss) {
      this.main.bosses.push(e.id); this.slowMo = 1.4;
      this.statMax(`boss:${e.kind}`, 1); if (this.cleanFight) this.statMax('flawless', 1); this.cleanFight = false;
      this.flash = 1; this.addShake(22); this.play('bossDie');
      for (const other of this.enemies) if (other.summoned && !other.dead) this.killEnemy(other);
      this.clearThreats = true;
      const q = this.bossQuest(e);
      if (q?.finale) this.notice(`${this.bossName(e)} is defeated! Go to the ${this.region(e.region).script.finaleName}.`, 'epic', `${this.bossName(e)} defeated!`);
      else this.notice(`${this.bossName(e)} is defeated!`, 'epic', 'Victory!');
      if (q && this.qs(q.id).status === 'active') this.advance(q, 1);
    } else {
      this.hitStop = Math.max(this.hitStop, .04); this.addShake(4); this.play('kill', e);
      if (!e.summoned && !e.guard) for (const q of this.world.quests) if (q.kind === 'slay' && (q.enemy === 'any' || q.enemy === e.kind) && (q.enemy !== 'any' || e.region === q.region)) this.advance(q, 1);
      if (e.guard && this.guardsLeft(e.guard) === 0) { const q = this.quest(e.guard); if (q?.captive) this.notice(`The guards are down — free ${q.captive.name}!`, 'good', 'Open the cage!'); }
    }
    this.gainXp(xp, e.x, e.y);
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
    if (h.hurtTime > 0 || h.dashTime > 0 || h.ghostT > 0 || this.completeTimer > 0) return;
    if (h.shieldTime > 0) {
      this.ring(h.x, h.y, 50, this.heroId === 'lyra' ? '#bfeaff' : '#9fe8b0', .25); this.play('reflect');
      // Ice Barrier chills whatever strikes it.
      if (this.heroId === 'lyra' && 'chillT' in from) (from as Enemy).chillT = Math.max((from as Enemy).chillT, 3);
      return;
    }
    const dmg = Math.max(1, Math.round(amount * this.takeMul(level) * armorAt(this.profile) * (this.buffs.barkskin ? .5 : 1) * (this.buffs.giantBrew ? .7 : 1) * (h.stormT > 0 ? .5 : 1)));
    h.hp -= dmg; h.hurtTime = .9; this.damageFlash = .35; this.combo = 0;
    if (this.riding) { this.dismount(); this.notice('You were knocked off your mount!', 'warn', 'Dismounted'); }
    const dx = h.x - from.x, dy = h.y - from.y, d = Math.max(1, Math.hypot(dx, dy));
    h.vx += dx / d * 520; h.vy += dy / d * 520;
    this.text(h.x, h.y - 50, `-${dmg}`, '#ff8f7a', 20);
    this.emit(h.x, h.y, 18, ['#ff8f7a', '#ffd1ae', '#ffffff'], { speed: 220, life: .5, glow: true });
    this.addShake(10); this.hitStop = .08; this.play('hurt');
    if (h.hp <= 0) { if (this.profile.items.phoenixFeather) this.rebirth(); else this.respawn(); }
  }
  /** The Phoenix Feather burns up and the hero rises again on the spot. */
  private rebirth() {
    const h = this.hero, bag = this.profile.items;
    if ((bag.phoenixFeather || 0) > 1) bag.phoenixFeather!--; else delete bag.phoenixFeather;
    saveProfile(this.profile);
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
    this.marks.length = 0; this.storms.length = 0; this.stealthT = 0; this.riding = false;
    this.traps.length = 0; this.wildT = 0; this.petFocus = null;
    for (let i = this.pets.length - 1; i >= 0; i--) { const p = this.pets[i]; if (p.spirit) swapRemove(this.pets, i); else { p.x = h.x - 40; p.y = h.y + 16; p.target = null; p.leapT = 0; } }
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.summoned) { e.dead = true; continue; }
      e.aggro = false; e.x = e.homeX; e.y = e.homeY; e.cd = 2; e.windup = 0; e.action = null; e.lunge = 0;
      if (e.heroic) { e.hp = e.maxHp; e.enraged = false; e.heroT = 4; }
      if (e.boss) e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * .25));
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
  }
  update(dtRaw: number) {
    let dt = Math.min(.045, Math.max(0, dtRaw));
    this.settleFx(dt);
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    if (this.slowMo > 0) { this.slowMo -= dt; dt *= .3; }
    this.elapsed += dt;
    const h = this.hero;
    const cdRate = this.buffs.hourglass ? 2 : 1;
    for (const id of this.spellIds) h.cds[id] = Math.max(0, h.cds[id] - dt * cdRate);
    h.shieldTime = Math.max(0, h.shieldTime - dt); h.hurtTime = Math.max(0, h.hurtTime - dt); h.castTime = Math.max(0, h.castTime - dt); h.slowT = Math.max(0, h.slowT - dt);
    h.mana = Math.min(h.maxMana, h.mana + h.manaRegen * dt);
    this.comboTime -= dt; if (this.comboTime <= 0) this.combo = 0;
    for (const id of ITEM_ORDER) {
      const left = this.buffs[id]; if (left === undefined) continue;
      if (left - dt > 0) this.buffs[id] = left - dt; else { delete this.buffs[id]; this.notice(`${ITEMS[id].name} wore off.`); }
    }

    this.updateHero(dt);
    this.updateEnemies(dt);
    this.updateNpcs(dt);
    this.updateCritters(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateOrbs(dt);
    this.updateParticles(dt);
    if (this.finalT > 0) this.updateFinalRise(dt);
    this.slowTick -= dt;
    if (this.slowTick <= 0) {
      this.slowTick = .25; this.updateZone(); this.markExplored(); this.updateSoundscape(); this.respawnEnemies(); this.flushFox();
      if (++this.exploreTick % 16 === 0) this.statMax('explore', this.exploredPercent());
      if (this.profileDirty) { this.profileDirty = false; saveProfile(this.profile); }
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
    for (const o of this.obstacleGrid.near(p.x, p.y, 120 + pad)) {
      if (o.w) {
        const hh = o.h || 0, cx = clamp(p.x, o.x - o.w, o.x + o.w), cy = clamp(p.y, o.y - hh, o.y + hh), dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
        if (d < pad) {
          if (d > 0) { p.x = cx + dx / d * pad; p.y = cy + dy / d * pad; }
          else { const ox = o.w + pad - Math.abs(p.x - o.x), oy = hh + pad - Math.abs(p.y - o.y); if (ox < oy) p.x += Math.sign(p.x - o.x || 1) * ox; else p.y += Math.sign(p.y - o.y || 1) * oy; }
        }
      } else this.pushOut(p, o.x, o.y, o.r + pad);
    }
    for (const pond of this.world.ponds) {
      if (Math.abs(p.x - pond.x) > pond.r + 60 || Math.abs(p.y - pond.y) > pond.r + 60) continue;
      const dx = (p.x - pond.x) / (pond.r + pad * .6), dy = (p.y - pond.y) / (pond.r * .58 + pad * .6), d = Math.hypot(dx, dy);
      if (d < 1 && d > 0) { p.x = pond.x + dx / d * (pond.r + pad * .6); p.y = pond.y + dy / d * (pond.r * .58 + pad * .6); }
    }
  }
  private updateHero(dt: number) {
    const h = this.hero, ride = this.riding ? MOUNTS[this.mountId || 'pony'].speed : 1;
    const speed = HEROES[this.heroId].speed * this.moveSpeed * ride * (h.slowT > 0 ? .5 : 1) * (h.stormT > 0 ? .8 : 1);
    if (h.dashTime > 0) {
      h.dashTime -= dt; const ds = h.charging ? 1050 : 900; h.vx = h.dashX * ds; h.vy = h.dashY * ds;
      if (Math.random() < .9) this.afterimages.push({ x: h.x, y: h.y, life: .28, faceX: h.faceX });
    } else {
      const k = Math.min(1, dt * 14);
      h.vx += (this.moveX * speed - h.vx) * k; h.vy += (this.moveY * speed - h.vy) * k;
    }
    h.x = clamp(h.x + h.vx * dt, 40, this.world.width - 40); h.y = clamp(h.y + h.vy * dt, 40, this.world.height - 40);
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
    if (h.shieldTime > 0 && Math.random() < dt * 12) this.emit(h.x + rand(-30, 30), h.y + rand(-30, 20), 1, '#9fe8b0', { speed: 30, life: .7, kind: 'leaf', size: 5, grav: -20 });
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
    let threats = 0, near = false;
    for (const e of this.enemies) {
      if (e.dead) { e.deadT += dt; continue; }
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
      e.x = clamp(e.x, 40, this.world.width - 40); e.y = clamp(e.y, 40, this.world.height - 40);
      if (!e.boss) this.collide(e, e.r * .8);
      const d = dist(h, e);
      if (e.aggro && d < 650) threats += e.boss ? 3 : 1;
      if (e.aggro && d < 480 && this.canHurt(e)) near = true;
      if (e.boss) { this.updateBoss(e, edt, d); continue; }
      if (!e.aggro && d < 380 && !this.buffs.smokeBomb && this.stealthT <= 0) {
        e.aggro = true; this.text(e.x, e.y - e.r - 26, '!', '#ffd35c', 22); this.play('squeak', e);
        if (e.heroic && !this.bossIntroShown.has(e.id)) { this.bossIntroShown.add(e.id); this.notice(`Heroic foe: ${e.heroic}! Tough, but rich in loot.`, 'epic', `Heroic: ${e.heroic}`); this.play('roar'); this.addShake(6); this.ring(e.x, e.y, 160, '#e8a0ff', .7); }
      }
      if (e.aggro && (d > 820 || dist(e, { x: e.homeX, y: e.homeY }) > 950)) { e.aggro = false; e.windup = 0; e.lunge = 0; }
      if (!e.aggro) { this.wander(e, dt); continue; }
      if (e.stunT > 0) { e.stunT -= dt; if (Math.random() < dt * 12) this.emit(e.x + rand(-e.r, e.r), e.y - e.r, 1, '#8fd8ff', { speed: 40, life: .3, glow: true, size: 2 }); continue; }
      e.cd = Math.max(0, e.cd - edt);
      this.enemyAct(e, edt, d);
      if (e.heroic) this.heroicAct(e, edt, d);
      const hit = hitAt(e.level) * ENEMY_STATS[e.kind].dmg;
      if (d < e.r + 16 && e.kind !== 'thornling' && e.kind !== 'sporecap' && e.kind !== 'emberImp' && e.burrowT <= 0) this.hurt(hit * (e.kind === 'bristleboar' && e.lunge > 0 ? 1.5 : e.kind === 'webspinner' && h.slowT > 0 ? 1 : .6), e, e.level);
    }
    this.combat += (clamp(threats / 4, 0, 1) - this.combat) * Math.min(1, dt * 1.5);
    this.danger += (Number(near) - this.danger) * Math.min(1, dt * (near ? 5 : 2));
  }
  /** Each creature fights its own way. */
  private enemyAct(e: Enemy, dt: number, d: number) {
    const h = this.hero, dx = (h.x - e.x) / Math.max(1, d), dy = (h.y - e.y) / Math.max(1, d), sp = ENEMY_STATS[e.kind].speed * (e.elite ? 1.1 : 1), hit = hitAt(e.level) * ENEMY_STATS[e.kind].dmg;
    switch (e.kind) {
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
      if (e.summoned || e.guard) { if (e.deadT > 2) swapRemove(this.enemies, i); continue; }
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
    if (e.kind === 'wisp' || e.kind === 'frostwraith' || e.kind === 'emberImp') e.angle += dt * 2;
  }
  private enemyShot(e: Enemy, angle: number, speed: number, kind: 'thorn' | 'void' | 'web' | 'ice' | 'fire', damage: number) {
    this.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 2.6, r: kind === 'void' || kind === 'web' || kind === 'fire' ? 9 : 7, damage, level: e.level, owner: 'enemy', kind, spin: angle });
  }

  // ───────────────────────────── villagers and wildlife
  private updateNpcs(dt: number) {
    const h = this.hero;
    this.globalBarkT -= dt;
    for (const n of this.npcs) {
      n.barkT = Math.max(0, n.barkT - dt); n.barkCd -= dt;
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
      if (d > 540) return;
      e.aggro = true; e.cd = 1.4;
      if (!this.bossIntroShown.has(e.id)) { this.bossIntroShown.add(e.id); this.cleanFight = true; this.eventHandler({ type: 'bossIntro', name: this.bossName(e), title: this.bossTitle(e) }); this.play('roar'); this.addShake(12); this.ring(e.x, e.y, 260, '#ff8f7a', .8); }
    }
    if (d > 1200) { e.aggro = false; e.action = null; return; }
    const phases = BOSS_PATTERNS[e.kind].length, frac = e.hp / e.maxHp;
    const phase = phases === 3 ? (frac <= .33 ? 3 : frac <= .66 ? 2 : 1) : frac <= .5 ? 2 : 1;
    if (phase > e.phase) { e.phase = phase; this.play('roar'); this.addShake(14); this.flash = .4; this.ring(e.x, e.y, 300, '#ff6b5b', .8); this.notice(`${this.bossName(e)} is enraged!`, 'epic', 'Enraged!'); e.action = null; e.cd = .6; }
    const thresholds = e.kind === 'eclipse' ? [.85, .6, .35, .15] : [.7, .35];
    if (e.summons < thresholds.length && e.hp <= e.maxHp * thresholds[e.summons]) { e.summons++; this.summonMinions(e); }
    if (Math.random() < dt * 8) this.emit(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r * .5), 1, e.kind === 'eclipse' ? ['#1a1030', '#c9b6ff', '#ff6b9a'] : e.kind === 'hollowStar' ? ['#c9b6ff', '#6a4bd6'] : e.kind === 'cinderTyrant' ? ['#ff9a3d', '#ff5f3d', '#ffd27a'] : e.kind === 'brambleWarden' ? ['#b6df91', '#ff8f7a'] : ['#a3c46a', '#e8ffb0'], { speed: 20, life: 1, glow: e.kind !== 'mossback' && e.kind !== 'brambleWarden', size: 4, grav: -40, kind: e.kind === 'hollowStar' || e.kind === 'eclipse' ? 'star' : e.kind === 'cinderTyrant' ? 'ember' : 'leaf' });
    if (d < e.r + 18 && e.action !== 'blink') this.hurt(this.bossHit(e) * .7, e, e.level);
    if (e.action) { this.runBossAction(e, dt); return; }
    const sp = ENEMY_STATS[e.kind].speed * (1 + (e.phase - 1) * .25);
    if (d > 150) { e.x += (h.x - e.x) / d * sp * dt; e.y += (h.y - e.y) / d * sp * dt; }
    if (e.kind === 'hollowStar' || e.kind === 'eclipse') { e.angle += dt; e.y += Math.sin(this.elapsed * 2) * 10 * dt; }
    e.cd -= dt;
    if (e.cd <= 0) {
      const list = BOSS_PATTERNS[e.kind][e.phase - 1];
      this.startBossAction(e, list[e.pattern++ % list.length]);
    }
  }
  private summonMinions(e: Enemy) {
    const kinds = SUMMONS[e.kind] || ['gloomling'];
    const n = e.kind === 'eclipse' ? 4 : e.kind === 'mossback' ? 3 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(0, 1), m = this.makeEnemy({ id: `summon-${this.summonCount++}`, kind: pick(kinds), x: e.x + Math.cos(a) * 130, y: e.y + Math.sin(a) * 130, level: Math.max(1, e.level - 2), region: e.region }, true);
      m.hp = m.maxHp = Math.round(m.maxHp * .7);
      this.enemies.push(m);
      this.emit(m.x, m.y, 20, ['#c9b6ff', '#ffffff', '#8fd46b'], { speed: 160, glow: true, kind: 'star' }); this.ring(m.x, m.y, 50, '#c9b6ff', .5);
    }
    this.notice(`${this.bossName(e)} calls for help!`, 'warn', 'Minions!'); this.play('roar');
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
        e.actionT = 1.8; const n = 8 + p * 4 + (e.kind === 'eclipse' ? 3 : 0);
        for (let i = 0; i < n; i++) { const a2 = rand(0, 6.28), r = i < 2 ? rand(0, 30) : rand(50, 280); const x = h.x + Math.cos(a2) * r, y = h.y + Math.sin(a2) * r; this.addHazard(x, y, 64, .9 + i * .1, e.kind === 'cinderTyrant' ? 'lava' : 'meteor', { x: x - 220, y: y - 600, level: e.level }); }
        break;
      }
      case 'blink': e.actionT = 1.4; break;
    }
  }
  private runBossAction(e: Enemy, dt: number) {
    const h = this.hero, p2 = e.phase > 1, hit = this.bossHit(e);
    const before = e.actionT; e.actionT -= dt;
    const passed = (t: number) => before > t && e.actionT <= t;
    switch (e.action) {
      case 'nova': {
        const kind = e.kind === 'hollowStar' ? 'void' : e.kind === 'cinderTyrant' ? 'fire' : e.kind === 'eclipse' ? (e.pattern % 3 === 2 ? 'fire' : e.pattern % 2 ? 'void' : 'thorn') : 'thorn';
        const count = (p2 ? 18 : 14) + (e.kind === 'eclipse' ? 6 : 0);
        if (passed(p2 ? .75 : .4)) this.novaRing(e, count, 0, kind, hit * .7);
        if (p2 && passed(.35)) this.novaRing(e, count, Math.PI / count, kind, hit * .7);
        break;
      }
      case 'charge': {
        if (e.actionT < .75 && e.actionT > .3) {
          e.x += e.chargeX * 820 * dt; e.y += e.chargeY * 820 * dt;
          e.x = clamp(e.x, 60, this.world.width - 60); e.y = clamp(e.y, 60, this.world.height - 60);
          if (Math.random() < .6) this.emit(e.x, e.y + e.r * .6, 2, ['#8a6a4a', '#b6df91'], { speed: 80, life: .6, kind: 'smoke', size: 10 });
          if ((e.kind === 'brambleWarden' || e.kind === 'eclipse' || e.kind === 'cinderTyrant') && Math.random() < dt * 14) this.enemyShot(e, Math.atan2(e.chargeY, e.chargeX) + Math.PI + rand(-.9, .9), 170, e.kind === 'cinderTyrant' ? 'fire' : 'thorn', hit * .6);
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
            for (let i = 0; i < arms; i++) this.enemyShot(e, e.angle + (i / arms) * Math.PI * 2, 215, 'void', hit * .6);
          }
        }
        break;
      }
      case 'blink': {
        if (passed(1.1)) {
          this.emit(e.x, e.y, 40, ['#c9b6ff', '#6a4bd6', '#ffffff'], { speed: 260, life: .6, kind: 'star', glow: true }); this.ring(e.x, e.y, 90, '#c9b6ff', .4);
          const a = rand(0, 6.28); e.x = clamp(h.x + Math.cos(a) * 190, 80, this.world.width - 80); e.y = clamp(h.y + Math.sin(a) * 190, 80, this.world.height - 80);
          this.emit(e.x, e.y, 40, ['#c9b6ff', '#6a4bd6', '#ffffff'], { speed: 260, life: .6, kind: 'star', glow: true }); this.play('dash');
          this.addHazard(e.x, e.y, p2 ? 180 : 150, .75, 'slam', e);
        }
        break;
      }
    }
    if (e.actionT <= 0) { e.action = null; e.cd = e.phase === 3 ? .7 : p2 ? .9 : 1.4; }
  }
  private novaRing(e: Enemy, count: number, offset: number, kind: 'thorn' | 'void' | 'fire', damage: number) {
    for (let i = 0; i < count; i++) this.enemyShot(e, offset + (i / count) * Math.PI * 2, 250, kind, damage);
    this.ring(e.x, e.y, 80, kind === 'void' ? '#c9b6ff' : kind === 'fire' ? '#ff9a3d' : '#b6df91', .3); this.addShake(4); this.play(kind === 'thorn' ? 'thornShot' : 'voidShot', e);
  }
  private addHazard(x: number, y: number, r: number, delay: number, kind: Hazard['kind'], from: Point & { level?: number; boss?: boolean }, damage?: number, level?: number) {
    const lv = level ?? from.level ?? 1;
    this.hazards.push({ x, y, r, delay, maxDelay: delay, damage: damage ?? hitAt(lv) * 1.5, level: lv, owner: 'enemy', kind, fromX: from.x, fromY: from.y });
  }
  /** Umbra rises out of the four lands: shadow streams race in from the west and up from the Cradle, then it takes shape. */
  private spawnFinal(rising: boolean) {
    if (this.enemies.some(e => e.kind === 'eclipse' && !e.dead)) return;
    if (rising) { this.finalT = 5; this.flash = .6; this.addShake(16); this.play('roar'); this.notice('The shadows of every land are gathering…', 'epic', 'Umbra rises…'); return; }
    this.createFinal(false);
  }
  /** Umbra rises at the last land's finale: once the Cinder Tyrant falls, at the Dawn Forge. */
  private get lastRegion() { return this.world.regions[this.world.regions.length - 1].id; }
  private createFinal(aggro: boolean) {
    const last = this.lastRegion, cradle = this.finaleOf(last); if (!cradle) return;
    const e = this.makeEnemy({ id: `${last}:final`, kind: 'eclipse', x: cradle.x - 40, y: cradle.y - 150, boss: true, level: 26, region: last });
    e.aggro = aggro; e.spawnT = aggro ? 1.2 : 0; e.homeX = cradle.x - 40; e.homeY = cradle.y - 150;
    this.enemies.push(e);
    if (aggro) { this.bossIntroShown.add(e.id); this.cleanFight = true; this.eventHandler({ type: 'bossIntro', name: this.bossName(e), title: this.bossTitle(e) }); this.flash = 1; this.addShake(22); this.play('roar'); this.ring(e.x, e.y, 420, '#c9b6ff', 1.2); }
  }
  private updateFinalRise(dt: number) {
    const cradle = this.finaleOf(this.lastRegion); if (!cradle) { this.finalT = 0; return; }
    this.finalT -= dt;
    const tx = cradle.x - 40, ty = cradle.y - 150;
    // Two streams from the west (the Beacon and the Bell), one rising from the Cradle's own shadow.
    for (const [sx, sy] of [[tx - 1100, ty - 380], [tx - 1100, ty + 380], [tx, ty + 700]]) {
      if (Math.random() > .75) continue;
      const a = Math.atan2(ty - sy, tx - sx) + rand(-.08, .08), v = rand(700, 900), off = rand(0, 1);
      this.particles.push({ x: sx + (tx - sx) * off, y: sy + (ty - sy) * off, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2, max: 1.2, size: rand(5, 9), color: pick(['#1a1030', '#6a4bd6', '#c9b6ff', '#ff6b9a']), kind: 'star', rot: 0, vr: 3, grav: 0, drag: .4, glow: true });
    }
    if (Math.random() < dt * 3) { this.addShake(3); this.ring(tx, ty, rand(80, 260), '#6a4bd6', .6); }
    if (this.finalT <= 0) { this.finalT = 0; this.createFinal(true); }
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
          else { this.damageEnemy(e, p.damage, p.crit); if (!e.boss) this.knock(e, { x: p.x - p.vx, y: p.y - p.vy }, 90); if (p.kind === 'frost') e.chillT = Math.max(e.chillT, 2); }
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
          p.owner = 'hero'; p.vx *= -1.35; p.vy *= -1.35; p.life = 1.4; p.damage = 20 * this.power; if (p.kind === 'web' || p.kind === 'ice' || p.kind === 'fire') p.kind = this.heroId === 'lyra' ? 'frost' : 'thorn';
          this.emit(p.x, p.y, 8, this.heroId === 'lyra' ? '#bfeaff' : '#9fe8b0', { speed: 150, life: .3, glow: true }); this.play('reflect'); continue;
        }
        if (d < p.r + 14) {
          if (p.kind === 'web' && h.dashTime <= 0 && h.shieldTime <= 0) { h.slowT = 2.2; this.notice('Webbed! Dash to break free.', 'warn', 'Webbed!'); }
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
        if (dist(h, z) < z.r + 8) this.hurt(z.damage, z, z.level);
      } else {
        for (const e of this.enemies) if (!e.dead && e.burrowT <= 0 && this.canHurt(e) && Math.abs(e.x - z.x) < z.r + 80 && dist(e, z) < z.r + e.r) {
          const frost = z.kind === 'frostbomb' || z.kind === 'frostnova';
          this.damageEnemy(e, z.damage); this.knock(e, z, e.boss ? 10 : frost || z.kind === 'blizzard' ? 0 : z.kind === 'firebomb' ? 260 : 160);
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
        this.flash = Math.max(this.flash, .3); this.addShake(12); this.hitStop = Math.max(this.hitStop, .05); this.play('boom', z); break;
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
        else { h.mana = Math.min(h.maxMana, h.mana + 7); this.play('orb'); }
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
    if (this.completeTimer <= 0) {
      // The chapter is complete: an achievement marks it, and the next chapter's opener starts on its own.
      this.completeTimer = 0;
      const r = this.completeRegion, side = this.sideQuests(r), done = side.filter(q => this.qs(q.id).status === 'done').length;
      this.eventHandler({ type: 'levelComplete', region: r, last: r === this.lastRegion, stats: { stars: this.earnedStars(r), time: this.elapsed - this.chapterStart.elapsed, defeated: this.defeated - this.chapterStart.defeated, quests: done, totalQuests: side.length, level: this.profile.level } });
      this.statMax(`chapter:${r}`, 1);
      this.chapterStart = { elapsed: this.elapsed, defeated: this.defeated };
      this.foxDelay = 6.2;
    }
  }

  // ───────────────────────────── UI data
  private targetOf(q: QuestDef): Point | null {
    const st = this.qs(q.id).status, npc = (id?: string) => this.npcs.find(n => n.id === id) || null;
    if (st === 'available') return npc(q.giver);
    if (st === 'ready') return npc(this.reportTo(q));
    if (st !== 'active') return null;
    if (this.isTalk(q)) return npc(q.to);
    if (q.kind === 'visit') return this.world.pois.find(p => p.id === q.place) || null;
    if (q.kind === 'rescue') return this.world.objects.find(o => o.kind === 'cage' && o.questId === q.id) || null;
    if (q.kind === 'slay') {
      // Point at the nearest creature that counts, so a hunt never leaves the player guessing where to look.
      let best: Enemy | null = null, bd = Infinity;
      for (const e of this.enemies) {
        if (e.dead || e.boss || e.summoned || e.guard || (q.enemy === 'any' ? e.region !== q.region : e.kind !== q.enemy)) continue;
        const d = dist(this.hero, e); if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    if (q.kind === 'boss') {
      const b = this.enemies.find(e => e.id === q.boss && !e.dead);
      if (b) return b;
      return this.finaleOf(q.region);
    }
    if (q.kind === 'key' || q.kind === 'collect') {
      let best: WorldObject | null = null, bd = Infinity;
      for (const o of this.world.objects) {
        const mine = q.kind === 'key' ? o.kind === 'key' && !this.main.keys.includes(o.id) && q.keys!.some(i => this.keyId(q, i) === o.id) : o.questId === q.id && o.kind === 'questItem' && !this.got.has(o.id);
        if (mine) { const d = dist(this.hero, o); if (d < bd) { bd = d; best = o; } }
      }
      if (q.kind === 'collect' && best && bd > 900) return this.world.pois.find(p => p.id === q.near) || best;
      return best;
    }
    return null;
  }
  mainTarget(): Point | null { const q = this.currentMain(); return q ? this.targetOf(q) : null; }
  questTarget(): Point | null { const q = this.tracked ? this.quest(this.tracked) : null; return q && !q.main ? this.targetOf(q) : null; }
  private goalOf(q: QuestDef) {
    const st = this.qs(q.id), name = (id?: string) => this.npcs.find(n => n.id === id)?.name || '', s = this.region(q.region).script;
    if (st.status === 'available') return q.giver === 'fox' ? (this.hasPet ? 'Follow Tuft' : 'Follow the road') : `Talk to ${name(q.giver)}`;
    if (st.status === 'ready') return `Report to ${name(this.reportTo(q))}`;
    if (st.status === 'done') return 'Complete';
    switch (q.kind) {
      case 'collect': return `${q.item}`;
      case 'slay': return q.enemy && q.enemy !== 'any' ? `${ENEMY_STATS[q.enemy].name}s defeated` : 'Creatures defeated';
      case 'deliver': return `Bring the ${q.item?.toLowerCase()} to ${name(q.to)}`;
      case 'talk': return `Speak with ${name(q.to)}`;
      case 'visit': return `Visit ${this.world.pois.find(p => p.id === q.place)?.name}`;
      case 'rescue': { const left = this.guardsLeft(q.id); return left ? `Defeat the guards (${left} left)` : `Free ${q.captive?.name}`; }
      case 'key': { const k = this.world.objects.find(o => o.id === this.keyId(q, q.keys![0])), at = k ? this.poiAt(k, 400)?.name : ''; return `Find the ${k?.name.toLowerCase() || 'relic'}${at ? ` · ${at}` : ''}`; }
      case 'boss': {
        const b = this.enemies.find(e => e.id === q.boss);
        const bn = b ? this.bossName(b) : q.boss?.endsWith(':final') ? s.final?.name || 'Umbra' : s.bossName;
        return this.main.bosses.includes(q.boss!) ? `Restore the ${s.finaleName}` : `Defeat ${bn}`;
      }
    }
  }
  private rowFor(q: QuestDef): QuestRow {
    const st = this.qs(q.id), giver = this.npcs.find(n => n.id === q.giver), to = this.npcs.find(n => n.id === this.reportTo(q));
    const detail = st.status === 'available' ? (q.giver === 'fox' ? this.personal([q.summary])[0] : `${giver?.name} in ${giver?.poiName} has a request.`)
      : st.status === 'ready' ? `Report to ${to?.name} in ${to?.poiName}.` : st.status === 'done' ? 'Complete' : q.summary;
    const counted = st.status === 'active' && q.count > 1 && (q.kind === 'collect' || q.kind === 'slay' || q.kind === 'key');
    return { id: q.id, title: q.title, giver: giver?.name || this.guideVoice.name, status: st.status, detail, goal: this.goalOf(q), progress: counted ? st.progress : 0, count: counted ? q.count : 0, xp: this.rewardXp(q), reward: this.rewardText(q), tracked: this.tracked === q.id, chapter: this.region(q.region).chapter };
  }
  private mainRow() {
    const cur = this.currentMain();
    if (!cur) { const all = this.world.quests.filter(q => q.main && q.region === this.lastRegion); return { title: 'The valley is saved', step: 'Every light is shining', progress: 0, count: 0, index: all.length, total: all.length }; }
    const list = this.world.quests.filter(q => q.main && q.region === cur.region), row = this.rowFor(cur);
    return { title: cur.title, step: row.goal, progress: row.progress, count: row.count, index: list.indexOf(cur) + 1, total: list.length };
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
    return n.role === 'merchant' || n.role === 'armorer' ? 'Trade' : n.role === 'smith' ? 'Upgrade' : n.role === 'inn' ? 'Rest' : 'Talk';
  }
  snapshot(): GameSnapshot {
    const near = this.nearest(), h = this.hero, p = this.profile;
    const b = this.enemies.find(e => e.boss && !e.dead && e.aggro && this.canHurt(e));
    let nearName: string | null = null, nearAction: string | null = null;
    if (near?.kind === 'npc') { nearName = near.n.name; nearAction = this.nearAction(near.n); }
    else if (near) {
      const o = near.o; nearName = o.name;
      nearAction = ({ key: 'Take', questItem: 'Take', shrine: this.blessed.has(o.id) ? 'Pray' : 'Bless', finale: 'Inspect', chest: 'Open', sign: 'Read', lore: 'Read', well: 'Drink', fountain: 'Drink', campfire: 'Rest', cage: 'Free', crack: 'Inspect', waterfall: 'Explore' } as const)[o.kind];
    }
    const chests = this.world.objects.filter(o => o.kind === 'chest'), lore = this.world.objects.filter(o => o.kind === 'lore');
    const sides = this.sideQuests();
    return {
      hero: this.heroId, region: this.heroRegion.id, chapter: this.chapter, hp: h.hp, maxHp: h.maxHp, mana: Math.round(h.mana), maxMana: h.maxMana, shield: h.shieldTime > 0,
      level: p.level, xp: p.xp, xpNext: xpToNext(p.level), gold: p.gold, upgrades: { ...p.upgrades },
      spells: this.spellIds.map((id, i) => { const cd = this.cooldownOf(id); return { id, name: SPELLS[id].name, key: keyLabel(spellKey(i)), icon: SPELLS[id].icon, unlocked: this.spellUnlocked(id), level: SPELLS[id].level, cooldown: cd ? Math.min(1, h.cds[id] / cd) : 0, cost: SPELLS[id].cost, affordable: h.mana >= SPELLS[id].cost, damage: Math.round((SPELLS[id].dmg || 0) * this.sp(id)), rank: this.spellRank(id), cd }; }),
      nearName, nearAction,
      mount: this.mountId ? { id: this.mountId, name: MOUNTS[this.mountId].name, riding: this.riding } : null,
      main: this.mainRow(), mainQuests: this.questRows(true), quests: this.questRows(false), defeated: this.defeated, combo: this.combo,
      items: ITEM_ORDER.map(id => ({ id, count: p.items[id] || 0 })),
      buffs: ITEM_ORDER.filter(id => this.buffs[id]).map(id => ({ id, time: this.buffs[id]!, max: ITEMS[id].duration })),
      gear: [...p.gear], equipped: { ...p.equipped }, bagSize: BAG_SIZE, quick: p.quick,
      stats: { regen: h.manaRegen, power: this.power, speed: this.moveSpeed, spark: Math.round((SPELLS[this.spellIds[0]].dmg || 10) * this.sp(this.spellIds[0])), guard: 1 - armorAt(p) * (this.buffs.barkskin ? .5 : 1) * (this.buffs.giantBrew ? .7 : 1), crit: this.critChance, elapsed: this.elapsed, questsDone: sides.filter(q => this.qs(q.id).status === 'done').length, totalQuests: sides.length },
      boss: b ? { name: this.bossName(b), title: this.bossTitle(b), hp: Math.max(0, b.hp), maxHp: b.maxHp, phase: b.phase, level: b.level } : null,
      discovered: this.discovered.size, totalPlaces: this.world.pois.length, chests: this.opened.size, totalChests: chests.length, lore: lore.filter(o => this.read.has(o.id)).length, totalLore: lore.length,
    };
  }
  getObjects() { return this.world.objects.filter(o => this.visibleObject(o)); }
  isOpened(id: string) { return this.opened.has(id); }
  sideQuests(region?: RegionId) { return this.world.quests.filter(q => !q.main && (!region || q.region === region)); }
  earnedStars(region: RegionId) { const side = this.sideQuests(region), done = side.filter(q => this.qs(q.id).status === 'done').length, all = side.length; return 1 + Number(done >= all / 2) + Number(done === all); }
}
