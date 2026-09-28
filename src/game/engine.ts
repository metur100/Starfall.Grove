import { ambience, footstep, sfx, type Sfx } from './audio';
import { ITEMS, ITEM_ORDER, rollItem } from './items';
import { RARITY, SLOT_ORDER, makeGear, rollRarity, seeded, sellPrice } from './gear';
import { BAG_SIZE, HP_UNIT, MAX_LEVEL, MAX_RANK, armorAt, bagUsed, gearOf, healthAt, loadProfile, manaAt, powerAt, rankOf, regenAt, saveProfile, starsOf, upgradeCost, xpToNext, type Profile } from './progression';
import { HEROES, MAX_STARS, SPELLS, SPELL_UPGRADES, starCost, starLevel, upgradeText } from './spells';
import { Grid } from './spatial';
import { REGION_W, RoadIndex, inPond } from './worldgen';
import { getWorld } from './worlds';
import type {
  CritterKind, EngineEvent, GearItem, GearSlot, HeroId, EnemyKind, EnemySeed, GameSnapshot, ItemId, MainQuest, NoticeTone, NpcDef, Obstacle, Point, Poi,
  QuestDef, QuestOffer, QuestRow, QuestState, Rarity, Region, RegionId, SpellId, SpellRank, UpgradeId, WorldDefinition, WorldObject,
} from './types';

export type Hero = {
  x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; mana: number; maxMana: number; manaRegen: number;
  faceX: number; faceY: number; cds: Record<SpellId, number>; shieldTime: number; hurtTime: number; walkTime: number;
  dashTime: number; dashX: number; dashY: number; castTime: number;
  /** Seconds left of being slowed by spider silk. */
  slowT: number;
  /** Kael: seconds left of Bladestorm, and whether the current dash is a Charge. */
  stormT: number; stormTick: number; charging: boolean;
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
};
export type Npc = NpcDef & { homeX: number; homeY: number; tx: number; ty: number; moving: boolean; faceX: number; waitT: number; routeI: number; routeDir: number; workT: number; bark: string; barkT: number; barkCd: number; walkT: number; poiName: string };
export type Critter = { kind: CritterKind; x: number; y: number; homeX: number; homeY: number; tx: number; ty: number; state: 'idle' | 'move' | 'flee' | 'fly'; t: number; face: number; alt: number; hop: number; seed: number };
type BossAction = 'slam' | 'boulders' | 'nova' | 'roots' | 'charge' | 'spiral' | 'meteors' | 'blink';
export type Projectile = { x: number; y: number; vx: number; vy: number; life: number; r: number; damage: number; level: number; owner: 'hero' | 'enemy'; kind: 'spark' | 'sunfire' | 'thorn' | 'void' | 'web' | 'ice'; targetId?: string; crit?: boolean; spin: number };
export type Hazard = { x: number; y: number; r: number; delay: number; maxDelay: number; damage: number; level: number; owner: 'hero' | 'enemy'; kind: 'slam' | 'boulder' | 'root' | 'meteor' | 'starfall' | 'spore' | 'firebomb' | 'frostbomb' | 'lightning'; fromX: number; fromY: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'leaf' | 'ember' | 'star' | 'smoke' | 'ring' | 'shard'; rot: number; vr: number; grav: number; drag: number; glow: boolean };
/** A `loot` orb carries a piece of equipment and is drawn as a small bag glowing in its rarity colour. */
export type Orb = { x: number; y: number; vx: number; vy: number; kind: 'mana' | 'heart' | 'gold' | 'loot'; age: number; value: number; gear?: GearItem };
export type Pod = { id: number; x: number; y: number; dead: boolean; hitT: number };
export type FloatText = { x: number; y: number; text: string; life: number; max: number; color: string; size: number };
export type Afterimage = { x: number; y: number; life: number; faceX: number };
/** Kael's sword swings, drawn as a fading arc. */
export type Slash = { x: number; y: number; angle: number; life: number; max: number; reach: number };
export type EngineSave = {
  version: 4; hero: { x: number; y: number; hp: number; mana: number }; main: MainQuest; quests: Record<string, QuestState>; got: string[];
  opened: string[]; read: string[]; discovered: string[]; explored: string; brokenPods: number[]; checkpoint: Point; elapsed: number; defeated: number;
  blessed: string[]; tracked: string | null; chapterStart: { elapsed: number; defeated: number }; awaiting: boolean; foxQueue: string[];
};
type Near = { kind: 'object'; o: WorldObject } | { kind: 'npc'; n: Npc };

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
  mossback: { hp: 2600, r: 46, speed: 78, name: 'Mossback', xp: 700, dmg: 1 },
  brambleWarden: { hp: 6500, r: 46, speed: 88, name: 'Bramble Warden', xp: 1100, dmg: 1 },
  hollowStar: { hp: 12000, r: 42, speed: 96, name: 'The Hollow Star', xp: 1800, dmg: 1 },
  eclipse: { hp: 34000, r: 60, speed: 92, name: 'Umbra', xp: 4000, dmg: 1 },
};
const hpMul = (level: number) => 1.5 * (1 + .3 * (level - 1));
/** Damage of one ordinary creature hit at a level, in health points. */
const hitAt = (level: number) => 12 + 5.5 * level;
const BOSS_PATTERNS: Record<string, BossAction[][]> = {
  mossback: [['slam', 'boulders', 'slam', 'boulders'], ['boulders', 'slam', 'charge', 'boulders', 'slam', 'charge']],
  brambleWarden: [['nova', 'roots', 'slam', 'charge'], ['nova', 'charge', 'roots', 'nova', 'slam', 'roots']],
  hollowStar: [['spiral', 'meteors', 'blink', 'nova'], ['meteors', 'spiral', 'blink', 'nova', 'meteors', 'blink']],
  eclipse: [['slam', 'nova', 'boulders', 'roots', 'charge'], ['spiral', 'meteors', 'blink', 'slam', 'nova', 'roots'], ['meteors', 'spiral', 'charge', 'boulders', 'blink', 'nova', 'roots', 'slam']],
};
const SUMMONS: Record<string, EnemyKind[]> = {
  mossback: ['gloomling', 'bristleboar'], brambleWarden: ['thornling', 'shadewolf'], hollowStar: ['wisp', 'frostwraith'],
  eclipse: ['gloomling', 'bristleboar', 'shadewolf', 'webspinner', 'wisp', 'frostwraith'],
};
const KILL_COLORS: Partial<Record<EnemyKind, string[]>> = {
  gloomling: ['#8c7ce0', '#c9b6ff', '#ffffff'], thornling: ['#9fd46b', '#e8ffb0', '#5fae4f'], wisp: ['#8ee8ff', '#c9b6ff', '#ffffff'],
  bristleboar: ['#a8744a', '#e8c09a', '#ffffff'], sporecap: ['#b9e27a', '#e0735a', '#fff1b8'], shadewolf: ['#5a5a7a', '#a0a0c8', '#ffffff'],
  webspinner: ['#6a4a7a', '#e8e0f0', '#b6df91'], frostwraith: ['#bfe8ff', '#8ee8ff', '#ffffff'], cragGolem: ['#8a8fa8', '#c8cce0', '#8ee8ff'],
  eclipse: ['#1a1030', '#c9b6ff', '#ff6b9a', '#ffffff'],
};
export const EXPLORE_CELL = 320;
const ACTIVE_RANGE = 1700;
/** Creatures come back this many seconds after being defeated. */
const RESPAWN_TIME = 60;
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
  /** Counts down while Umbra gathers itself out of the three lands. */
  private finalT = 0;
  private profileDirty = false;
  private markerVersion = 0;
  private markerCache = new Map<string, { mark: '!' | '?'; main: boolean } | null>();
  private markerCacheVersion = -1;

  constructor(heroId: HeroId, onEvent: (event: EngineEvent) => void, saved?: EngineSave | null) {
    this.heroId = heroId; this.spellIds = HEROES[heroId].spells;
    this.world = getWorld(); this.eventHandler = onEvent; this.checkpoint = { ...this.world.spawn };
    this.profile = loadProfile(heroId);
    const cds = Object.fromEntries(Object.keys(SPELLS).map(s => [s, 0])) as Record<SpellId, number>;
    const p = this.profile;
    this.hero = { x: this.world.spawn.x, y: this.world.spawn.y, vx: 0, vy: 0, hp: healthAt(p), maxHp: healthAt(p), mana: manaAt(p), maxMana: manaAt(p), manaRegen: regenAt(p), faceX: 1, faceY: 0, cds, shieldTime: 0, hurtTime: 0, walkTime: 0, dashTime: 0, dashX: 0, dashY: 0, castTime: 0, slowT: 0, stormT: 0, stormTick: 0, charging: false };
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
    if (saved?.version === 4) this.restore(saved);
    this.regionId = this.regionAt(this.hero.x).id;
    this.markExplored();
    ambience.start(this.regionId);
  }
  dispose() { ambience.stop(); if (this.profileDirty) saveProfile(this.profile); }

  private makeEnemy(seed: EnemySeed, summoned = false): Enemy {
    const s = ENEMY_STATS[seed.kind];
    const hp = seed.boss ? s.hp : Math.round(s.hp * hpMul(seed.level) * (seed.elite ? 2.6 : 1));
    return { ...seed, hp, maxHp: hp, r: s.r * (seed.elite ? 1.3 : 1), dead: false, deadT: 0, cd: rand(1, 2.5), windup: 0, hitFlash: 0, kx: 0, ky: 0, homeX: seed.x, homeY: seed.y, wanderX: seed.x, wanderY: seed.y, wanderT: rand(0, 3), aggro: summoned, spawnT: summoned ? .6 : 0, phase: 1, action: null, actionT: 0, actionStep: 0, pattern: 0, summons: 0, chargeX: 0, chargeY: 0, lunge: 0, angle: rand(0, 6.28), summoned, rage: 0, stunT: 0, blinkT: rand(3, 6) };
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
    for (const [set, list] of [[this.got, s.got], [this.opened, s.opened], [this.read, s.read], [this.discovered, s.discovered], [this.blessed, s.blessed]] as Array<[Set<string>, string[]]>) if (Array.isArray(list)) for (const v of list) set.add(v);
    if (typeof s.explored === 'string') for (let i = 0; i < Math.min(s.explored.length, this.explored.length); i++) this.explored[i] = s.explored.charCodeAt(i) === 49 ? 1 : 0;
    this.exploredVersion++;
    this.elapsed = Number(s.elapsed) || 0; this.defeated = Number(s.defeated) || 0;
    this.tracked = typeof s.tracked === 'string' && this.quests.has(s.tracked) ? s.tracked : null;
    if (s.chapterStart) this.chapterStart = { elapsed: Number(s.chapterStart.elapsed) || 0, defeated: Number(s.chapterStart.defeated) || 0 };
    this.awaitingChapter = !!s.awaiting;
    this.foxQueue = Array.isArray(s.foxQueue) ? s.foxQueue.filter(id => this.quests.has(id)) : [];
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
      brokenPods: this.pods.filter(p => p.dead).map(p => p.id), checkpoint: { ...this.checkpoint }, elapsed: this.elapsed, defeated: this.defeated, blessed: [...this.blessed], tracked: this.tracked,
      chapterStart: { ...this.chapterStart }, awaiting: this.awaitingChapter, foxQueue: [...this.foxQueue],
    };
  }

  // ───────────────────────────── helpers
  private notice(text: string, tone: NoticeTone = 'info', short?: string) { this.eventHandler({ type: 'notice', text, tone, short }); }
  /** The story is written for Mira; other heroes get their own name in it. */
  /** Kael travels alone, so Tuft is written out of his lines. */
  private personal(lines: string[]) {
    if (this.heroId === 'mira') return lines;
    const n = HEROES[this.heroId].name;
    return lines.map(l => l.replace(/\bMira\b/g, n).replace(/\bgirl with the fox\b/g, 'warrior with the red plume').replace(/\b([Mm])y brave girl\b/g, '$1y brave lad')
      .replace('(Tuft tugs at your sleeve and points east,', '(You look east,')
      .replace('(Tuft sniffs the icy wind blowing through the Eastern Gate and whines.)', '(An icy wind howls through the Eastern Gate.)')
      .replace('(Tuft’s fur stands on end.', '(The hair on your neck stands on end.')
      .replace(/ and Tuft\b/g, '').replace(/ with Tuft\b/g, '').replace(/\bTuft\b/g, 'the wind'));
  }
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
      this.eventHandler({ type: 'levelUp', level: p.level });
      for (const id of this.spellIds) if (SPELLS[id].level === p.level) this.eventHandler({ type: 'spellLearned', spell: id });
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
    saveProfile(p);
  }
  private gainGold(n: number, x = this.hero.x, y = this.hero.y) {
    n = Math.round(n * (this.buffs.luckyClover ? 1.5 : 1)); if (n <= 0) return;
    this.profile.gold += n; this.profileDirty = true;
    this.text(x, y - 76, `+${n} gold`, '#ffd35c', 14);
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
    if (!this.spellUnlocked(id)) { this.play('nope'); this.notice(`${info.name} is learned at level ${info.level}. Defeat creatures and finish quests to level up.`, 'warn', `Level ${info.level}`); return; }
    if (id === 'spark') return this.attack();
    if (id === 'dash') return this.dash();
    if (id === 'slash') return this.swordSlash();
    if (id === 'charge') return this.charge();
    if (h.cds[id] > 0) { this.play('nope'); return; }
    if (h.mana < info.cost) { this.play('nope'); this.notice('Not enough magic! Break glow pods and defeat creatures for mana.', 'warn', 'No magic'); return; }
    h.mana -= info.cost; h.cds[id] = this.cooldownOf(id); h.castTime = .3;
    if (id === 'sunfire') this.sunfire();
    else if (id === 'shield' || id === 'guard') this.mossShield(id);
    else if (id === 'starfall') this.starfall();
    else if (id === 'slam') this.earthsplitter();
    else if (id === 'bladestorm') this.bladestorm();
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
  /** Rushes at the nearest foe (or straight ahead); everything in the way is hurt, knocked aside and stunned. */
  private charge() {
    const h = this.hero; if (h.cds.charge > 0 || h.dashTime > 0) return;
    const t = this.nearestTarget(460, true), moving = Math.hypot(this.moveX, this.moveY) > .1;
    let dx = t ? t.x - h.x : moving ? this.moveX : h.faceX, dy = t ? t.y - h.y : moving ? this.moveY : h.faceY;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    h.dashX = dx; h.dashY = dy; h.faceX = dx; h.faceY = dy; h.dashTime = .34; h.charging = true; h.cds.charge = this.cooldownOf('charge'); h.slowT = 0;
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
  private mossShield(id: SpellId) {
    const h = this.hero; h.shieldTime = this.durationOf(id, 3); h.slowT = 0;
    this.ring(h.x, h.y, 70, '#9fe8b0', .4);
    this.emit(h.x, h.y, 30, ['#9fe8b0', '#d6ffd9', '#5fae4f'], { speed: 200, life: .6, kind: 'leaf', size: 6 });
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist(h, e) < 110 + e.r) { e.windup = 0; e.cd = Math.max(e.cd, 1.3); this.damageEnemy(e, 10 * this.power); this.knock(e, h, e.boss ? 10 : 220); }
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
    return makeGear({ ilvl: q.kind === 'boss' ? lv[1] + 1 : Math.round(lv[0] + (lv[1] - lv[0]) * .6), rarity, rand: r, uid: `q-${q.id}` });
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
    const gear = first ? this.rewardGear(q) : null;
    if (gear) this.addGear(gear);
    if (this.tracked === q.id) this.tracked = this.world.quests.find(x => !x.main && (this.qs(x.id).status === 'active' || this.qs(x.id).status === 'ready'))?.id || null;
    for (const other of this.world.quests) if (other.requires === q.id && this.qs(other.id).status === 'locked') {
      this.qs(other.id).status = 'available';
      if (other.giver === 'fox') this.foxQueue.push(other.id);
    }
  }
  track(id: string) { if (this.quests.has(id)) this.tracked = id; }
  /** Tuft's nudges start on their own once no chapter-end screen is showing. */
  private flushFox() {
    if (!this.foxQueue.length || this.completeTimer > 0 || this.awaitingChapter) return;
    const id = this.foxQueue.shift()!, q = this.quest(id);
    if (!q || this.qs(id).status !== 'available') return;
    const voice = this.guideVoice; this.say(voice.name, voice.portrait, q.text.offer);
    this.acceptQuest(id);
  }
  /** Called by the UI when the player leaves the chapter-complete screen. */
  nextChapter() { this.awaitingChapter = false; this.chapterStart = { elapsed: this.elapsed, defeated: this.defeated }; this.flushFox(); }

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
    switch (id) {
      case 'healthPotion': { const heal = Math.min(h.maxHp - h.hp, Math.round(h.maxHp * .5)); h.hp += heal; this.text(h.x, h.y - 50, `+${heal}`, '#ff9aa8', 20); break; }
      case 'manaPotion': h.mana = h.maxMana; break;
      case 'fireBomb': case 'frostBomb': return this.throwBomb(id);
      case 'thunderJar': return this.thunder();
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
    const h = this.hero, t = this.nearestTarget(560, true), fire = id === 'fireBomb';
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
  setQuick(id: ItemId) { if (id === 'healthPotion') return; this.profile.quick = id; saveProfile(this.profile); this.play('ui'); }

  // ───────────────────────────── equipment
  /** Puts a piece in the bag; if the bag is full it is sold on the spot instead. */
  addGear(g: GearItem) {
    const p = this.profile, c = RARITY[g.rarity].color;
    if (p.gear.some(x => x.uid === g.uid) || SLOT_ORDER.some(s => p.equipped[s]?.uid === g.uid)) g = { ...g, uid: `${g.uid}-${Date.now().toString(36)}` };
    if (bagUsed(p) >= BAG_SIZE) { const n = sellPrice(g); p.gold += n; this.profileDirty = true; this.notice(`Your bag is full — ${g.name} was sold for ${n} gold.`, 'warn', 'Bag full · sold'); return; }
    p.gear.push(g); saveProfile(p);
    this.text(this.hero.x, this.hero.y - 88, g.name, c, 15);
    this.eventHandler({ type: 'loot', item: g });
  }
  private dropGear(x: number, y: number, ilvl: number, rarity: Rarity) {
    const g = makeGear({ ilvl, rarity }), a = rand(0, 6.28), v = rand(140, 260);
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
    p.gold -= r.cost; p.stars[id] = r.rank + 1; saveProfile(p);
    this.play('learn'); this.flash = .2;
    this.emit(this.hero.x, this.hero.y - 10, 30, [SPELLS[id].color, '#ffffff', '#ffd35c'], { speed: 200, life: .8, kind: 'star', glow: true });
    return true;
  }
  upgradeRank(id: UpgradeId) { return rankOf(this.profile, id); }
  buyUpgrade(id: UpgradeId) {
    const p = this.profile, rank = rankOf(p, id), cost = upgradeCost(rank);
    if (rank >= MAX_RANK || p.gold < cost) { this.play('nope'); return false; }
    p.gold -= cost; p.upgrades[id] = rank + 1;
    const before = this.hero.maxHp; this.refreshStats(false); this.hero.hp += Math.max(0, this.hero.maxHp - before);
    saveProfile(p); this.play('learn'); this.flash = .25;
    this.emit(this.hero.x, this.hero.y, 30, ['#ffd35c', '#ffffff', '#ffb05c'], { speed: 200, life: .8, kind: 'star', glow: true });
    return true;
  }

  // ───────────────────────────── world interaction
  isVisible(o: WorldObject) { return this.visibleObject(o); }
  private visibleObject(o: WorldObject) {
    // Key items appear once the main quest that asks for them is accepted.
    if (o.kind === 'key') return !this.main.keys.includes(o.id) && this.world.quests.some(q => q.kind === 'key' && this.qs(q.id).status === 'active' && q.keys!.some(i => this.keyId(q, i) === o.id));
    if (o.kind === 'questItem') return !this.got.has(o.id) && this.qs(o.questId!)?.status === 'active';
    if (o.kind === 'cage') return !this.got.has(o.id) && this.qs(o.questId!)?.status === 'active';
    return true;
  }
  private interactable(o: WorldObject) { return this.visibleObject(o) && !(o.kind === 'chest' && this.opened.has(o.id)); }
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
        this.notice(`You opened the ${o.name.toLowerCase()}!`, 'good'); this.gainXp(35 * reg.xpScale, o.x, o.y);
        this.addItem(rollItem()); if (Math.random() < .35) this.addItem(rollItem());
        if (Math.random() < .45) { const r = rollRarity(Math.random, .3); this.dropGear(o.x, o.y - 8, reg.levels[0] + Math.round(Math.random() * (reg.levels[1] - reg.levels[0])), r === 'common' ? 'uncommon' : r); }
        return;
      }
      case 'lore': {
        const first = !this.read.has(o.id); this.read.add(o.id); this.play('page');
        this.say(o.name, '🪨', o.text || []);
        if (first) this.gainXp(30 * reg.xpScale, o.x, o.y);
        return;
      }
      case 'sign': this.play('page'); this.say(o.name, '🪧', o.text || []); return;
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
    if (n.role === 'merchant' || n.role === 'smith') { sfx.play('talk'); this.eventHandler({ type: 'shop', kind: n.role, name: n.name, portrait: n.portrait }); return; }
    if (n.role === 'inn') {
      const h = this.hero; h.hp = h.maxHp; h.mana = h.maxMana; this.play('rest');
      this.emit(h.x, h.y, 24, ['#fff1b8', '#ffcf6e', '#ffffff'], { speed: 120, life: 1, kind: 'star', glow: true, grav: -40 });
      return this.say(n.name, n.portrait, ['A soft bed, a warm meal, a quiet night.', 'You wake rested. (Fully restored — you will return here if you fall.)']);
    }
    const mine = this.questsFor(n.id);
    const active = mine.find(q => q.main && this.qs(q.id).status === 'active') || mine.find(q => this.qs(q.id).status === 'active');
    if (active) { const st = this.qs(active.id), counted = active.count > 1 && (active.kind === 'collect' || active.kind === 'slay' || active.kind === 'key'); return this.say(n.name, n.portrait, [...active.text.progress, counted ? `(${st.progress}/${active.count})` : ''].filter(Boolean)); }
    if (n.role === 'guide') { const cur = this.currentMain(), reg = this.region(n.region); return this.say(n.name, n.portrait, m.finales.includes(n.region) || !cur ? reg.script.guide.done : [`${cur.title}: ${cur.summary}`, `Follow the gold markers, ${HEROES[this.heroId].name}. The valley is counting on you.`]); }
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
  /** Called by the UI once the finale dialogue closes: fireworks, then the chapter ends. */
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
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0 || !this.canHurt(e) || Math.abs(e.x - h.x) > maxRange || Math.abs(e.y - h.y) > maxRange) continue; const d = dist(h, e); if (d < bestD) { best = e; bestD = d; } }
    if (!best && !creaturesOnly) for (const p of this.pods) { if (p.dead || Math.abs(p.x - h.x) > 260 || Math.abs(p.y - h.y) > 260) continue; const d = dist(h, p); if (d < Math.min(bestD, 260)) { best = p; bestD = d; } }
    return best;
  }
  private knock(e: Enemy, from: Point, force: number) {
    if (e.kind === 'cragGolem') force *= .25;
    if (this.buffs.giantBrew) force *= 1.8;
    const dx = e.x - from.x, dy = e.y - from.y, d = Math.max(1, Math.hypot(dx, dy));
    e.kx += dx / d * force; e.ky += dy / d * force;
  }
  private damageEnemy(e: Enemy, amount: number, crit = false) {
    if (e.dead) return;
    if (!this.canHurt(e)) { this.notice(this.region(e.region).script.sealed, 'warn', 'Sealed'); this.emit(e.x, e.y, 8, '#c9b6ff', { speed: 120, glow: true }); return; }
    amount = Math.max(1, Math.round(amount * this.dealMul(e.level)));
    e.hp -= amount; e.hitFlash = .14; e.aggro = true;
    this.combo++; this.comboTime = 2.4;
    this.text(e.x, e.y - e.r - 18, crit ? `${amount}!` : `${amount}`, crit ? '#ffd35c' : '#fff3c0', crit ? 24 : 17);
    this.emit(e.x, e.y, crit ? 12 : 7, ['#ffffff', '#fff3c0', this.region(e.region).palette.accent], { speed: 200, life: .35, glow: true, size: 3 });
    this.play(crit ? 'crit' : 'hit', e);
    if (crit) { this.hitStop = Math.max(this.hitStop, .05); this.addShake(3); }
    if (e.hp <= 0) this.killEnemy(e);
  }
  private killEnemy(e: Enemy) {
    e.dead = true; e.deadT = 0; e.action = null;
    if (!e.summoned) this.defeated++;
    const colors = KILL_COLORS[e.kind] || [this.region(e.region).palette.accent, '#ffffff', '#ffd27a', '#ff9a4a'];
    this.emit(e.x, e.y, e.boss ? 140 : 22, colors, { speed: e.boss ? 520 : 240, life: e.boss ? 1.8 : .8, kind: 'star', glow: true, size: e.boss ? 7 : 4, drag: 2 });
    this.emit(e.x, e.y, e.boss ? 36 : 8, ['#8fd46b', '#b9f29d', '#f2a1b8'], { speed: 200, life: 1.6, kind: 'leaf', size: 7, grav: 60 });
    this.ring(e.x, e.y, e.boss ? 320 : 70, colors[0], e.boss ? 1 : .4);
    const drops = e.boss ? 14 : e.summoned ? 1 : e.elite ? 6 : 2;
    for (let i = 0; i < drops; i++) this.spawnOrb(e.x, e.y, Math.random() < (e.boss ? .3 : e.elite ? .3 : .1) ? 'heart' : 'mana');
    if (!e.summoned) { const coins = e.boss ? 10 : e.elite ? 3 : 1 + Number(Math.random() < .4); for (let i = 0; i < coins; i++) this.spawnOrb(e.x, e.y, 'gold', Math.round((2 + e.level * .9) * (e.boss ? 5 : 1))); }
    const gap = this.profile.level - e.level, grey = gap >= 5 ? .1 : gap >= 3 ? .5 : 1;
    const xp = ENEMY_STATS[e.kind].xp * (e.boss ? 1 : .5 * (1 + .2 * (e.level - 1)) * (e.elite ? 3 : e.summoned ? .3 : 1) * grey);
    if (e.boss) { this.addItem(rollItem()); this.addItem('healthPotion'); }
    else if (e.elite ? Math.random() < .45 : !e.summoned && Math.random() < .04) this.addItem(e.elite ? rollItem() : 'healthPotion');
    // Equipment: guardians always drop an epic (sometimes a legendary too), elites often, ordinary creatures now and then.
    if (e.boss) { this.dropGear(e.x, e.y, e.level, 'epic'); this.dropGear(e.x, e.y, e.level, Math.random() < .3 ? 'legendary' : 'rare'); }
    else if (!e.summoned && (e.elite ? Math.random() < .35 : Math.random() < .045 * grey)) { const r = rollRarity(Math.random, e.elite ? .4 : 0); this.dropGear(e.x, e.y, e.level, e.elite && r === 'common' ? 'uncommon' : r); }
    if (e.kind === 'sporecap') this.addHazard(e.x, e.y, 110, .7, 'spore', e, hitAt(e.level) * .8, e.level);
    if (e.boss) {
      this.main.bosses.push(e.id); this.slowMo = 1.4;
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
    if (h.hurtTime > 0 || h.dashTime > 0 || this.completeTimer > 0) return;
    if (h.shieldTime > 0) { this.ring(h.x, h.y, 50, '#9fe8b0', .25); this.play('reflect'); return; }
    const dmg = Math.max(1, Math.round(amount * this.takeMul(level) * armorAt(this.profile) * (this.buffs.barkskin ? .5 : 1) * (this.buffs.giantBrew ? .7 : 1) * (h.stormT > 0 ? .5 : 1)));
    h.hp -= dmg; h.hurtTime = .9; this.damageFlash = .35; this.combo = 0;
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
    h.hp = Math.round(h.maxHp * .6); h.hurtTime = 2.5; h.vx = h.vy = 0;
    this.emit(h.x, h.y, 70, ['#ff9a4a', '#ffd35c', '#ff5f3d', '#fff1b8'], { speed: 360, life: 1.2, kind: 'ember', glow: true, size: 6, grav: -80 });
    this.ring(h.x, h.y, 220, '#ff9a4a', .9); this.flash = .7; this.slowMo = .8; this.play('levelUp');
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist(h, e) < 240 + e.r) { this.damageEnemy(e, 30 * this.power); if (!e.boss) this.knock(e, h, 380); }
    this.notice('The Phoenix Feather bursts into flame — you rise again!', 'epic', 'Reborn!');
  }
  private respawn() {
    const h = this.hero;
    h.hp = h.maxHp; h.mana = Math.max(40, h.mana); h.x = this.checkpoint.x; h.y = this.checkpoint.y; h.vx = h.vy = 0; h.hurtTime = 2; h.slowT = 0;
    const lost = Math.floor(this.profile.gold * .1); this.profile.gold -= lost; this.profileDirty = true;
    this.respawnFade = 1; this.clearThreats = true;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.summoned) { e.dead = true; continue; }
      e.aggro = false; e.x = e.homeX; e.y = e.homeY; e.cd = 2; e.windup = 0; e.action = null; e.lunge = 0;
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
      if (this.profileDirty) { this.profileDirty = false; saveProfile(this.profile); }
    }
    if (this.completeTimer > 0) this.updateCelebration(dt);
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
    const h = this.hero, speed = (this.heroId === 'kael' ? 255 : 270) * this.moveSpeed * (h.slowT > 0 ? .5 : 1) * (h.stormT > 0 ? .8 : 1);
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
      h.walkTime += dt * 10;
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
    if (h.shieldTime > 0 && Math.random() < dt * 12) this.emit(h.x + rand(-30, 30), h.y + rand(-30, 20), 1, '#9fe8b0', { speed: 30, life: .7, kind: 'leaf', size: 5, grav: -20 });
    sfx.setListener(h.x, h.y);
  }
  groundAt(x: number, y: number) {
    if (this.roads.dist(x, y, 60) < 46) return 'path' as const;
    const p = this.poiAt({ x, y }); if (p && (p.kind === 'ruins' || p.kind === 'shrine' || p.kind === 'finale' || p.kind === 'city')) return 'stone' as const;
    return this.regionAt(x).ground === 'snow' ? 'snow' as const : 'grass' as const;
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
      const rage = !e.aggro ? 0 : e.windup > 0 || e.lunge > 0 || e.action ? 1 : .55;
      e.rage += (rage - e.rage) * Math.min(1, dt * 7);
      e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(.004, dt); e.ky *= Math.pow(.004, dt);
      e.x = clamp(e.x, 40, this.world.width - 40); e.y = clamp(e.y, 40, this.world.height - 40);
      if (!e.boss) this.collide(e, e.r * .8);
      const d = dist(h, e);
      if (e.aggro && d < 650) threats += e.boss ? 3 : 1;
      if (e.aggro && d < 480 && this.canHurt(e)) near = true;
      if (e.boss) { this.updateBoss(e, dt, d); continue; }
      if (!e.aggro && d < 380 && !this.buffs.smokeBomb) { e.aggro = true; this.text(e.x, e.y - e.r - 26, '!', '#ffd35c', 22); this.play('squeak', e); }
      if (e.aggro && (d > 820 || dist(e, { x: e.homeX, y: e.homeY }) > 950)) { e.aggro = false; e.windup = 0; e.lunge = 0; }
      if (!e.aggro) { this.wander(e, dt); continue; }
      if (e.stunT > 0) { e.stunT -= dt; if (Math.random() < dt * 12) this.emit(e.x + rand(-e.r, e.r), e.y - e.r, 1, '#8fd8ff', { speed: 40, life: .3, glow: true, size: 2 }); continue; }
      e.cd = Math.max(0, e.cd - dt);
      this.enemyAct(e, dt, d);
      const hit = hitAt(e.level) * ENEMY_STATS[e.kind].dmg;
      if (d < e.r + 16 && e.kind !== 'thornling' && e.kind !== 'sporecap') this.hurt(hit * (e.kind === 'bristleboar' && e.lunge > 0 ? 1.5 : e.kind === 'webspinner' && h.slowT > 0 ? 1 : .6), e, e.level);
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
    }
  }
  private respawnEnemies() {
    const h = this.hero;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.dead) continue;
      if (e.summoned || e.guard) { if (e.deadT > 2) swapRemove(this.enemies, i); continue; }
      if (e.boss || e.deadT < RESPAWN_TIME || Math.hypot(e.homeX - h.x, e.homeY - h.y) < 560) continue;
      const fresh = this.makeEnemy(e); fresh.x = e.homeX; fresh.y = e.homeY; fresh.spawnT = .6;
      Object.assign(e, fresh);
      if (Math.abs(e.x - h.x) < 1400 && Math.abs(e.y - h.y) < 1000) { this.emit(e.x, e.y, 16, ['#c9b6ff', '#1a1030', '#ffffff'], { speed: 140, life: .6, kind: 'smoke', size: 10 }); this.ring(e.x, e.y, 50, '#c9b6ff', .4); }
    }
  }
  private wander(e: Enemy, dt: number) {
    e.wanderT -= dt;
    if (e.wanderT <= 0) { e.wanderT = rand(1.5, 4); const a = rand(0, 6.28), r = rand(0, 110); e.wanderX = e.homeX + Math.cos(a) * r; e.wanderY = e.homeY + Math.sin(a) * r; }
    const dx = e.wanderX - e.x, dy = e.wanderY - e.y, d = Math.hypot(dx, dy);
    if (d > 6) { e.x += dx / d * 40 * dt; e.y += dy / d * 40 * dt; }
    if (e.kind === 'wisp' || e.kind === 'frostwraith') e.angle += dt * 2;
  }
  private enemyShot(e: Enemy, angle: number, speed: number, kind: 'thorn' | 'void' | 'web' | 'ice', damage: number) {
    this.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 2.6, r: kind === 'void' || kind === 'web' ? 9 : 7, damage, level: e.level, owner: 'enemy', kind, spin: angle });
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
      if (dh < 330 && n.barkCd <= 0 && this.globalBarkT <= 0 && !close) { n.bark = this.npcMarker(n)?.mark === '!' ? pick(['Excuse me! Could you help?', 'Oh! A hero! I need a hand…', 'Psst — over here!']) : pick(n.barks.length ? n.barks : ['Hello!']); n.barkT = 3.2; n.barkCd = rand(14, 26); this.globalBarkT = 2.5; }
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
      if (!this.bossIntroShown.has(e.id)) { this.bossIntroShown.add(e.id); this.eventHandler({ type: 'bossIntro', name: this.bossName(e), title: this.bossTitle(e) }); this.play('roar'); this.addShake(12); this.ring(e.x, e.y, 260, '#ff8f7a', .8); }
    }
    if (d > 1200) { e.aggro = false; e.action = null; return; }
    const phases = BOSS_PATTERNS[e.kind].length, frac = e.hp / e.maxHp;
    const phase = phases === 3 ? (frac <= .33 ? 3 : frac <= .66 ? 2 : 1) : frac <= .5 ? 2 : 1;
    if (phase > e.phase) { e.phase = phase; this.play('roar'); this.addShake(14); this.flash = .4; this.ring(e.x, e.y, 300, '#ff6b5b', .8); this.notice(`${this.bossName(e)} is enraged!`, 'epic', 'Enraged!'); e.action = null; e.cd = .6; }
    const thresholds = e.kind === 'eclipse' ? [.85, .6, .35, .15] : [.7, .35];
    if (e.summons < thresholds.length && e.hp <= e.maxHp * thresholds[e.summons]) { e.summons++; this.summonMinions(e); }
    if (Math.random() < dt * 8) this.emit(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r * .5), 1, e.kind === 'eclipse' ? ['#1a1030', '#c9b6ff', '#ff6b9a'] : e.kind === 'hollowStar' ? ['#c9b6ff', '#6a4bd6'] : e.kind === 'brambleWarden' ? ['#b6df91', '#ff8f7a'] : ['#a3c46a', '#e8ffb0'], { speed: 20, life: 1, glow: e.kind === 'hollowStar' || e.kind === 'eclipse', size: 4, grav: -40, kind: e.kind === 'hollowStar' || e.kind === 'eclipse' ? 'star' : 'leaf' });
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
        for (let i = 0; i < n; i++) { const a2 = rand(0, 6.28), r = i < 2 ? rand(0, 30) : rand(50, 280); const x = h.x + Math.cos(a2) * r, y = h.y + Math.sin(a2) * r; this.addHazard(x, y, 64, .9 + i * .1, 'meteor', { x: x - 220, y: y - 600 }); }
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
        const kind = e.kind === 'hollowStar' ? 'void' : e.kind === 'eclipse' ? (e.pattern % 2 ? 'void' : 'thorn') : 'thorn';
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
          if ((e.kind === 'brambleWarden' || e.kind === 'eclipse') && Math.random() < dt * 14) this.enemyShot(e, Math.atan2(e.chargeY, e.chargeX) + Math.PI + rand(-.9, .9), 170, 'thorn', hit * .6);
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
  private novaRing(e: Enemy, count: number, offset: number, kind: 'thorn' | 'void', damage: number) {
    for (let i = 0; i < count; i++) this.enemyShot(e, offset + (i / count) * Math.PI * 2, 250, kind, damage);
    this.ring(e.x, e.y, 80, kind === 'void' ? '#c9b6ff' : '#b6df91', .3); this.addShake(4); this.play(kind === 'void' ? 'voidShot' : 'thornShot', e);
  }
  private addHazard(x: number, y: number, r: number, delay: number, kind: Hazard['kind'], from: Point & { level?: number; boss?: boolean }, damage?: number, level?: number) {
    const lv = level ?? from.level ?? 1;
    this.hazards.push({ x, y, r, delay, maxDelay: delay, damage: damage ?? hitAt(lv) * 1.5, level: lv, owner: 'enemy', kind, fromX: from.x, fromY: from.y });
  }
  /** Umbra rises out of the three lands: shadow streams race in from the west and up from the Cradle, then it takes shape. */
  private spawnFinal(rising: boolean) {
    if (this.enemies.some(e => e.kind === 'eclipse' && !e.dead)) return;
    if (rising) { this.finalT = 5; this.flash = .6; this.addShake(16); this.play('roar'); this.notice('The shadows of every land are gathering…', 'epic', 'Umbra rises…'); return; }
    this.createFinal(false);
  }
  private createFinal(aggro: boolean) {
    const cradle = this.finaleOf('summit'); if (!cradle) return;
    const e = this.makeEnemy({ id: 'summit:final', kind: 'eclipse', x: cradle.x - 40, y: cradle.y - 150, boss: true, level: 20, region: 'summit' });
    e.aggro = aggro; e.spawnT = aggro ? 1.2 : 0; e.homeX = cradle.x - 40; e.homeY = cradle.y - 150;
    this.enemies.push(e);
    if (aggro) { this.bossIntroShown.add(e.id); this.eventHandler({ type: 'bossIntro', name: this.bossName(e), title: this.bossTitle(e) }); this.flash = 1; this.addShake(22); this.play('roar'); this.ring(e.x, e.y, 420, '#c9b6ff', 1.2); }
  }
  private updateFinalRise(dt: number) {
    const cradle = this.finaleOf('summit'); if (!cradle) { this.finalT = 0; return; }
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
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.spin += dt * 10;
      if (Math.random() < .7) {
        if (p.kind === 'sunfire') this.emit(p.x, p.y, 2, ['#ffd27a', '#ff9a4a', '#ff6b3d'], { speed: 50, life: .45, kind: 'ember', glow: true, size: 6 });
        else if (p.kind === 'spark') this.emit(p.x, p.y, 1, p.crit ? '#ffd35c' : '#fff6c4', { speed: 20, life: .25, glow: true, size: 3 });
        else if (p.kind === 'void' && Math.random() < .5) this.emit(p.x, p.y, 1, '#a78bfa', { speed: 15, life: .35, glow: true, size: 3 });
        else if (p.kind === 'ice' && Math.random() < .5) this.emit(p.x, p.y, 1, '#dff6ff', { speed: 15, life: .3, glow: true, size: 2 });
      }
      let hit = false;
      if (p.owner === 'hero') {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || Math.abs(e.x - p.x) > 90 || Math.abs(e.y - p.y) > 90 || dist(p, e) > e.r + p.r) continue;
          if (p.kind === 'sunfire') this.explodeSunfire(p.x, p.y);
          else { this.damageEnemy(e, p.damage, p.crit); if (!e.boss) this.knock(e, { x: p.x - p.vx, y: p.y - p.vy }, 90); }
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
          p.owner = 'hero'; p.vx *= -1.35; p.vy *= -1.35; p.life = 1.4; p.damage = 20 * this.power; if (p.kind === 'web' || p.kind === 'ice') p.kind = 'thorn';
          this.emit(p.x, p.y, 8, '#9fe8b0', { speed: 150, life: .3, glow: true }); this.play('reflect'); continue;
        }
        if (d < p.r + 14) {
          if (p.kind === 'web' && h.dashTime <= 0 && h.shieldTime <= 0) { h.slowT = 2.2; this.notice('Webbed! Dash to break free.', 'warn', 'Webbed!'); }
          this.hurt(p.damage, p, p.level); hit = true;
        }
      }
      if (!hit && p.owner === 'enemy') for (const o of this.obstacleGrid.near(p.x, p.y, 60)) if (!o.w && dist(p, o) < o.r && o.kind !== 'fence') { hit = true; this.emit(p.x, p.y, 5, p.kind === 'void' ? '#a78bfa' : p.kind === 'ice' ? '#dff6ff' : '#9fd46b', { speed: 90, life: .3 }); break; }
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
        for (const e of this.enemies) if (!e.dead && this.canHurt(e) && Math.abs(e.x - z.x) < z.r + 80 && dist(e, z) < z.r + e.r) { this.damageEnemy(e, z.damage); this.knock(e, z, e.boss ? 10 : z.kind === 'frostbomb' ? 0 : z.kind === 'firebomb' ? 260 : 160);
          const stun = z.kind === 'slam' ? 1.2 : z.kind === 'frostbomb' ? 3 : z.kind === 'lightning' ? .6 : 0;
          if (stun && (!e.boss || z.kind === 'frostbomb')) { e.stunT = e.boss ? .8 : stun; e.windup = 0; e.lunge = 0; } }
        for (const p of this.pods) if (!p.dead && dist(p, z) < z.r) this.breakPod(p);
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
    }
    const p = this.poiAt(this.hero);
    if (!p) { this.zoneName = ''; return; }
    if (p.name === this.zoneName) return;
    this.zoneName = p.name;
    const first = !this.discovered.has(p.id);
    this.eventHandler({ type: 'zone', name: p.name, discovered: first });
    if (!first) return;
    this.discovered.add(p.id); this.play('discover');
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
      this.completeTimer = 0; this.awaitingChapter = true;
      const side = this.sideQuests(this.completeRegion), done = side.filter(q => this.qs(q.id).status === 'done').length;
      this.eventHandler({ type: 'levelComplete', region: this.completeRegion, stats: { stars: this.earnedStars(this.completeRegion), time: this.elapsed - this.chapterStart.elapsed, defeated: this.defeated - this.chapterStart.defeated, quests: done, totalQuests: side.length, level: this.profile.level } });
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
    if (!cur) { const all = this.world.quests.filter(q => q.main && q.region === 'summit'); return { title: 'The valley is saved', step: 'Every light is shining', progress: 0, count: 0, index: all.length, total: all.length }; }
    const list = this.world.quests.filter(q => q.main && q.region === cur.region), row = this.rowFor(cur);
    return { title: cur.title, step: row.goal, progress: row.progress, count: row.count, index: list.indexOf(cur) + 1, total: list.length };
  }
  private questRows(main: boolean): QuestRow[] {
    const chapter = this.chapter;
    const rows = this.world.quests.filter(q => !!q.main === main && this.qs(q.id).status !== 'locked' && (!main || this.region(q.region).chapter === Math.min(chapter, 3))).map(q => this.rowFor(q));
    if (main) return rows;
    const order = { ready: 0, active: 1, available: 2, done: 3, locked: 4 };
    const here = this.heroRegion.chapter;
    return rows.sort((a, b) => order[a.status] - order[b.status] || Number(b.chapter === here) - Number(a.chapter === here));
  }
  private nearAction(n: Npc) {
    if (this.npcMarker(n)) return 'Talk';
    return n.role === 'merchant' ? 'Trade' : n.role === 'smith' ? 'Upgrade' : n.role === 'inn' ? 'Rest' : 'Talk';
  }
  snapshot(): GameSnapshot {
    const near = this.nearest(), h = this.hero, p = this.profile;
    const b = this.enemies.find(e => e.boss && !e.dead && e.aggro && this.canHurt(e));
    let nearName: string | null = null, nearAction: string | null = null;
    if (near?.kind === 'npc') { nearName = near.n.name; nearAction = this.nearAction(near.n); }
    else if (near) {
      const o = near.o; nearName = o.name;
      nearAction = ({ key: 'Take', questItem: 'Take', shrine: this.blessed.has(o.id) ? 'Pray' : 'Bless', finale: 'Inspect', chest: 'Open', sign: 'Read', lore: 'Read', well: 'Drink', fountain: 'Drink', campfire: 'Rest', cage: 'Free' } as const)[o.kind];
    }
    const chests = this.world.objects.filter(o => o.kind === 'chest'), lore = this.world.objects.filter(o => o.kind === 'lore');
    const sides = this.sideQuests();
    return {
      hero: this.heroId, region: this.heroRegion.id, chapter: this.chapter, hp: h.hp, maxHp: h.maxHp, mana: Math.round(h.mana), maxMana: h.maxMana, shield: h.shieldTime > 0,
      level: p.level, xp: p.xp, xpNext: xpToNext(p.level), gold: p.gold, upgrades: { ...p.upgrades },
      spells: this.spellIds.map(id => { const cd = this.cooldownOf(id); return { id, name: SPELLS[id].name, key: SPELLS[id].key, icon: SPELLS[id].icon, unlocked: this.spellUnlocked(id), level: SPELLS[id].level, cooldown: cd ? Math.min(1, h.cds[id] / cd) : 0, cost: SPELLS[id].cost, affordable: h.mana >= SPELLS[id].cost, damage: Math.round((SPELLS[id].dmg || 0) * this.sp(id)), rank: this.spellRank(id), cd }; }),
      nearName, nearAction,
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
