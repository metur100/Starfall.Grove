import { ambience, footstep, sfx, type Sfx } from './audio';
import { ITEMS, ITEM_ORDER, rollItem } from './items';
import { HP_UNIT, MAX_LEVEL, healthAt, loadProfile, manaAt, powerAt, regenAt, saveProfile, xpToNext, type Profile } from './progression';
import { SPELLS, SPELL_ORDER } from './spells';
import { Grid } from './spatial';
import { RoadIndex, inPond } from './worldgen';
import { getWorld } from './worlds';
import type {
  CritterKind, EngineEvent, EnemyKind, EnemySeed, GameSnapshot, ItemId, LevelId, MainQuest, NoticeTone, NpcDef, Obstacle, Point, Poi,
  QuestDef, QuestOffer, QuestRow, QuestState, SpellId, WorldDefinition, WorldObject,
} from './types';

export type Hero = {
  x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; mana: number; maxMana: number; manaRegen: number;
  faceX: number; faceY: number; cds: Record<SpellId, number>; shieldTime: number; hurtTime: number; walkTime: number;
  dashTime: number; dashX: number; dashY: number; castTime: number;
};
export type Enemy = EnemySeed & {
  hp: number; maxHp: number; r: number; dead: boolean; deadT: number; cd: number; windup: number; hitFlash: number;
  kx: number; ky: number; homeX: number; homeY: number; wanderX: number; wanderY: number; wanderT: number;
  aggro: boolean; spawnT: number; phase: number; action: BossAction | null; actionT: number; actionStep: number;
  pattern: number; summons: number; chargeX: number; chargeY: number; lunge: number; angle: number; summoned?: boolean;
  /** 0 calm → 1 attacking; drives the red aggro tint. */
  rage: number;
};
export type Npc = NpcDef & { homeX: number; homeY: number; tx: number; ty: number; moving: boolean; faceX: number; waitT: number; routeI: number; routeDir: number; workT: number; bark: string; barkT: number; barkCd: number; walkT: number; poiName: string };
export type Critter = { kind: CritterKind; x: number; y: number; homeX: number; homeY: number; tx: number; ty: number; state: 'idle' | 'move' | 'flee' | 'fly'; t: number; face: number; alt: number; hop: number; seed: number };
type BossAction = 'slam' | 'boulders' | 'nova' | 'roots' | 'charge' | 'spiral' | 'meteors' | 'blink';
export type Projectile = { x: number; y: number; vx: number; vy: number; life: number; r: number; damage: number; owner: 'hero' | 'enemy'; kind: 'spark' | 'sunfire' | 'thorn' | 'void'; targetId?: string; crit?: boolean; spin: number };
export type Hazard = { x: number; y: number; r: number; delay: number; maxDelay: number; damage: number; owner: 'hero' | 'enemy'; kind: 'slam' | 'boulder' | 'root' | 'meteor' | 'starfall'; fromX: number; fromY: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'leaf' | 'ember' | 'star' | 'smoke' | 'ring' | 'shard'; rot: number; vr: number; grav: number; drag: number; glow: boolean };
export type Orb = { x: number; y: number; vx: number; vy: number; kind: 'mana' | 'heart'; age: number };
export type Pod = { id: number; x: number; y: number; dead: boolean; hitT: number };
export type FloatText = { x: number; y: number; text: string; life: number; max: number; color: string; size: number };
export type Afterimage = { x: number; y: number; life: number; faceX: number };
export type EngineSave = {
  /** `hpUnit` is absent in saves from when health was counted in hearts. */
  version: 3; hero: { x: number; y: number; hp: number; mana: number; hpUnit?: number }; main: MainQuest; quests: Record<string, QuestState>; got: string[];
  opened: string[]; read: string[]; discovered: string[]; explored: string; brokenPods: number[]; checkpoint: Point; elapsed: number; defeated: number; blessed: boolean; tracked: string | null;
};
type Near = { kind: 'object'; o: WorldObject } | { kind: 'npc'; n: Npc };

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const swapRemove = <T,>(list: T[], i: number) => { list[i] = list[list.length - 1]; list.pop(); };

const ENEMY_STATS: Record<EnemyKind, { hp: number; r: number; speed: number; name: string; xp: number }> = {
  gloomling: { hp: 30, r: 19, speed: 110, name: 'Gloomling', xp: 14 },
  thornling: { hp: 40, r: 22, speed: 60, name: 'Thornling', xp: 18 },
  wisp: { hp: 30, r: 16, speed: 150, name: 'Void wisp', xp: 20 },
  mossback: { hp: 600, r: 46, speed: 70, name: 'Mossback', xp: 300 },
  brambleWarden: { hp: 1300, r: 46, speed: 80, name: 'Bramble Warden', xp: 300 },
  hollowStar: { hp: 2600, r: 42, speed: 90, name: 'The Hollow Star', xp: 300 },
};
const BOSS_PATTERNS: Record<string, [BossAction[], BossAction[]]> = {
  mossback: [['slam', 'boulders', 'slam', 'boulders'], ['boulders', 'slam', 'boulders', 'slam']],
  brambleWarden: [['nova', 'roots', 'slam'], ['nova', 'charge', 'roots', 'charge', 'slam']],
  hollowStar: [['spiral', 'meteors', 'blink'], ['meteors', 'spiral', 'blink', 'nova', 'meteors']],
};
export const EXPLORE_CELL = 320;
const ACTIVE_RANGE = 1700;

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
  readonly main: MainQuest = { talkedGuide: false, keys: [], bossDefeated: false, finaleDone: false, readySeen: false };
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
  /** Seconds left on each potion effect. */
  readonly buffs: Partial<Record<ItemId, number>> = {};
  /** Effect density set by the graphics quality (1 = full). */
  fx = 1;
  private eventHandler: (event: EngineEvent) => void;
  private checkpoint: Point;
  private bossIntroShown = false;
  private zoneName = '';
  private completeTimer = 0;
  private fireworkTimer = 0;
  private summonCount = 0;
  private sealedNoticeT = 0;
  private clearThreats = false;
  private slowTick = 0;
  private stepPhase = 0;
  private blessed = false;
  private wellT = new Map<string, number>();
  private globalBarkT = 0;
  private questById: Map<string, QuestDef>;
  private campfires: WorldObject[];

  constructor(levelId: LevelId, onEvent: (event: EngineEvent) => void, saved?: EngineSave | null) {
    this.world = getWorld(levelId); this.eventHandler = onEvent; this.checkpoint = { ...this.world.spawn };
    this.profile = loadProfile();
    const cds = Object.fromEntries(SPELL_ORDER.map(s => [s, 0])) as Record<SpellId, number>;
    const p = this.profile;
    this.hero = { x: this.world.spawn.x, y: this.world.spawn.y, vx: 0, vy: 0, hp: healthAt(p), maxHp: healthAt(p), mana: manaAt(p), maxMana: manaAt(p), manaRegen: regenAt(p), faceX: 1, faceY: 0, cds, shieldTime: 0, hurtTime: 0, walkTime: 0, dashTime: 0, dashX: 0, dashY: 0, castTime: 0 };
    this.obstacleGrid = new Grid(256, this.world.obstacles);
    this.roads = new RoadIndex(this.world.roads);
    this.enemies = this.world.enemies.map(seed => this.makeEnemy(seed));
    this.pods = this.world.pods.map((pt, id) => ({ id, x: pt.x, y: pt.y, dead: false, hitT: 0 }));
    this.npcs = this.world.npcs.map(n => ({ ...n, homeX: n.x, homeY: n.y, tx: n.x, ty: n.y, moving: false, faceX: 1, waitT: rand(0, 3), routeI: 0, routeDir: 1, workT: rand(0, 2), bark: '', barkT: 0, barkCd: rand(2, 8), walkT: 0, poiName: this.poiAt(n)?.name || this.world.region }));
    this.critters = this.world.critters.map(c => ({ ...c, homeX: c.x, homeY: c.y, tx: c.x, ty: c.y, state: 'idle', t: rand(0, 3), face: 1, alt: 0, hop: 0, seed: Math.random() }));
    this.questById = new Map(this.world.quests.map(q => [q.id, q]));
    for (const q of this.world.quests) this.quests.set(q.id, { status: q.requires ? 'locked' : 'available', progress: 0 });
    this.campfires = this.world.objects.filter(o => o.kind === 'campfire');
    this.exploreCols = Math.ceil(this.world.width / EXPLORE_CELL);
    this.explored = new Uint8Array(this.exploreCols * Math.ceil(this.world.height / EXPLORE_CELL));
    if (saved?.version === 3) this.restore(saved);
    this.markExplored();
    ambience.start(levelId);
  }
  dispose() { ambience.stop(); }

  private makeEnemy(seed: EnemySeed, summoned = false): Enemy {
    const s = ENEMY_STATS[seed.kind], scale = seed.boss ? 1 : this.world.enemyScale * (seed.elite ? 2.6 : 1);
    const hp = Math.round(s.hp * scale);
    return { ...seed, hp, maxHp: hp, r: s.r * (seed.elite ? 1.3 : 1), dead: false, deadT: 0, cd: rand(1, 2.5), windup: 0, hitFlash: 0, kx: 0, ky: 0, homeX: seed.x, homeY: seed.y, wanderX: seed.x, wanderY: seed.y, wanderT: rand(0, 3), aggro: summoned, spawnT: summoned ? .6 : 0, phase: 1, action: null, actionT: 0, actionStep: 0, pattern: 0, summons: 0, chargeX: 0, chargeY: 0, lunge: 0, angle: 0, summoned, rage: 0 };
  }
  setEventHandler(handler: (event: EngineEvent) => void) { this.eventHandler = handler; }

  private restore(s: EngineSave) {
    const ok = (p: Point) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
    if (ok(s.hero)) { this.hero.x = clamp(s.hero.x, 30, this.world.width - 30); this.hero.y = clamp(s.hero.y, 30, this.world.height - 30); }
    this.hero.hp = clamp((Number(s.hero.hp) || this.hero.maxHp) * (s.hero.hpUnit ? 1 : HP_UNIT), 1, this.hero.maxHp);
    this.hero.mana = clamp(Number(s.hero.mana) || 0, 0, this.hero.maxMana);
    this.checkpoint = ok(s.checkpoint) ? { ...s.checkpoint } : { ...this.world.spawn };
    if (s.main) Object.assign(this.main, s.main);
    for (const [id, st] of Object.entries(s.quests || {})) if (this.quests.has(id) && st?.status) this.quests.set(id, { status: st.status, progress: Number(st.progress) || 0 });
    for (const [set, list] of [[this.got, s.got], [this.opened, s.opened], [this.read, s.read], [this.discovered, s.discovered]] as Array<[Set<string>, string[]]>) if (Array.isArray(list)) for (const v of list) set.add(v);
    if (typeof s.explored === 'string') for (let i = 0; i < Math.min(s.explored.length, this.explored.length); i++) this.explored[i] = s.explored.charCodeAt(i) === 49 ? 1 : 0; this.exploredVersion++;
    this.elapsed = Number(s.elapsed) || 0; this.defeated = Number(s.defeated) || 0; this.blessed = !!s.blessed;
    this.tracked = typeof s.tracked === 'string' && this.quests.has(s.tracked) ? s.tracked : null;
    const broken = new Set(Array.isArray(s.brokenPods) ? s.brokenPods : []);
    for (const p of this.pods) if (broken.has(p.id)) p.dead = true;
    if (this.main.bossDefeated) { const b = this.boss(); if (b) { b.dead = true; b.hp = 0; } }
  }
  exportSave(): EngineSave {
    const h = this.hero;
    let explored = ''; for (const v of this.explored) explored += v ? '1' : '0';
    return {
      version: 3, hero: { x: h.x, y: h.y, hp: h.hp, mana: h.mana, hpUnit: HP_UNIT }, main: { ...this.main, keys: [...this.main.keys] }, quests: Object.fromEntries(this.quests),
      got: [...this.got], opened: [...this.opened], read: [...this.read], discovered: [...this.discovered], explored,
      brokenPods: this.pods.filter(p => p.dead).map(p => p.id), checkpoint: { ...this.checkpoint }, elapsed: this.elapsed, defeated: this.defeated, blessed: this.blessed, tracked: this.tracked,
    };
  }

  // ───────────────────────────── helpers
  private notice(text: string, tone: NoticeTone = 'info') { this.eventHandler({ type: 'notice', text, tone }); }
  private say(speaker: string, portrait: string, lines: string[], then?: 'complete') { if (!lines.length) return; sfx.play('talk'); this.eventHandler({ type: 'dialogue', speaker, portrait, lines, then }); }
  private play(s: Sfx, pos?: Point) { sfx.play(s, pos); }
  private boss() { return this.enemies.find(e => e.boss) || null; }
  bossUnlocked() { return this.main.keys.length >= 3; }
  private canHurt(e: Enemy) { return !e.boss || this.bossUnlocked(); }
  spellUnlocked(id: SpellId) { return this.profile.level >= SPELLS[id].level; }
  get power() { return powerAt(this.profile.level) * (this.buffs.powerElixir ? 1.35 : 1); }
  get bossFight() { const b = this.boss(); return !!b && !b.dead && b.aggro; }
  addShake(n: number) { this.shake = Math.min(22, this.shake + n); }
  poiAt(p: Point, pad = 0): Poi | null { let best: Poi | null = null, bd = Infinity; for (const z of this.world.pois) { const d = dist(p, z); if (d < z.r + pad && d < bd) { bd = d; best = z; } } return best; }

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

  // ───────────────────────────── experience
  gainXp(amount: number, x = this.hero.x, y = this.hero.y) {
    const p = this.profile; amount = Math.round(amount);
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
      for (const id of SPELL_ORDER) if (SPELLS[id].level === p.level) this.eventHandler({ type: 'spellLearned', spell: id });
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
    saveProfile(p);
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
    if (!this.spellUnlocked(id)) { this.play('nope'); this.notice(`${info.name} is learned at level ${info.level}. Defeat creatures and finish quests to level up.`, 'warn'); return; }
    if (id === 'spark') return this.attack();
    if (id === 'dash') return this.dash();
    if (h.cds[id] > 0) { this.play('nope'); return; }
    if (h.mana < info.cost) { this.play('nope'); this.notice('Not enough magic! Break glow pods and defeat creatures for mana.', 'warn'); return; }
    h.mana -= info.cost; h.cds[id] = info.cooldown; h.castTime = .3;
    if (id === 'leaf') this.leafBurst();
    else if (id === 'sunfire') this.sunfire();
    else if (id === 'shield') this.mossShield();
    else if (id === 'starfall') this.starfall();
  }
  private attack() {
    const h = this.hero; if (h.cds.spark > 0) return;
    h.cds.spark = SPELLS.spark.cooldown; h.castTime = .18;
    const target = this.nearestTarget(560);
    let dx = h.faceX, dy = h.faceY;
    if (target) { const d = Math.max(1, dist(h, target)); dx = (target.x - h.x) / d; dy = (target.y - h.y) / d; h.faceX = dx; h.faceY = dy; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const crit = Math.random() < .15;
    this.projectiles.push({ x: h.x + dx * 26, y: h.y - 14 + dy * 26, vx: dx * 640, vy: dy * 640, life: 1, r: crit ? 9 : 7, damage: 10 * this.power * (crit ? 2 : 1), owner: 'hero', kind: 'spark', targetId: target && 'kind' in target ? target.id : undefined, crit, spin: 0 });
    this.emit(h.x + dx * 26, h.y - 14 + dy * 26, 6, ['#fff6c4', '#ffe38a'], { speed: 120, life: .3, size: 3, glow: true, angle: Math.atan2(dy, dx), spread: 1.2 });
    this.play('spark');
  }
  private dash() {
    const h = this.hero; if (h.cds.dash > 0 || h.dashTime > 0) return;
    let dx = this.moveX, dy = this.moveY;
    if (Math.hypot(dx, dy) < .1) { dx = h.faceX; dy = h.faceY; }
    const len = Math.hypot(dx, dy) || 1;
    h.dashX = dx / len; h.dashY = dy / len; h.dashTime = .18; h.cds.dash = SPELLS.dash.cooldown;
    this.emit(h.x, h.y + 14, 14, ['#e9f7ff', '#bfe8ff', '#ffffff'], { speed: 140, life: .45, kind: 'smoke', size: 7, angle: Math.atan2(-dy, -dx), spread: 1.6 });
    this.play('dash');
  }
  private leafBurst() {
    const h = this.hero;
    this.ring(h.x, h.y, 175, '#b9f29d', .5); this.ring(h.x, h.y, 120, '#e6ffc9', .35);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2, v = rand(220, 420);
      this.particles.push({ x: h.x + Math.cos(a) * 20, y: h.y + Math.sin(a) * 20, vx: Math.cos(a + .6) * v, vy: Math.sin(a + .6) * v, life: .8, max: .8, size: rand(5, 9), color: pick(['#8fd46b', '#b9f29d', '#5fae4f', '#e8ffb0']), kind: 'leaf', rot: a, vr: rand(-12, 12), grav: 0, drag: 3.2, glow: false });
    }
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead || !this.canHurt(e) || dist(h, e) > 175 + e.r) continue;
      this.damageEnemy(e, 30 * this.power); this.knock(e, h, e.boss ? 20 : 260); hits++;
    }
    for (const p of this.pods) if (!p.dead && dist(h, p) < 175) this.breakPod(p);
    this.addShake(hits ? 7 : 4); this.play('leaf');
  }
  private sunfire() {
    const h = this.hero, target = this.nearestTarget(620);
    let dx = h.faceX, dy = h.faceY;
    if (target) { const d = Math.max(1, dist(h, target)); dx = (target.x - h.x) / d; dy = (target.y - h.y) / d; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    this.projectiles.push({ x: h.x + dx * 30, y: h.y - 14 + dy * 30, vx: dx * 470, vy: dy * 470, life: 1.3, r: 14, damage: 40 * this.power, owner: 'hero', kind: 'sunfire', spin: 0 });
    this.emit(h.x + dx * 30, h.y - 14 + dy * 30, 16, ['#ffd27a', '#ff9a4a', '#fff1b8'], { speed: 180, life: .4, kind: 'ember', glow: true, angle: Math.atan2(dy, dx), spread: 1.4 });
    this.addShake(3); this.play('sunfire');
  }
  private explodeSunfire(x: number, y: number) {
    this.ring(x, y, 105, '#ffb05c', .45); this.ring(x, y, 60, '#fff1b8', .3);
    this.emit(x, y, 36, ['#ffd27a', '#ff9a4a', '#ff6b3d', '#fff1b8'], { speed: 360, life: .7, kind: 'ember', glow: true, size: 5 });
    this.emit(x, y, 10, 'rgba(90,60,50,.5)', { speed: 90, life: 1, kind: 'smoke', size: 16 });
    this.flash = Math.max(this.flash, .25);
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist({ x, y }, e) < 100 + e.r) { this.damageEnemy(e, 40 * this.power); this.knock(e, { x, y }, e.boss ? 15 : 200); }
    for (const p of this.pods) if (!p.dead && dist({ x, y }, p) < 100) this.breakPod(p);
    this.addShake(9); this.hitStop = .05; this.play('boom', { x, y });
  }
  private mossShield() {
    const h = this.hero; h.shieldTime = 3;
    this.ring(h.x, h.y, 70, '#9fe8b0', .4);
    this.emit(h.x, h.y, 30, ['#9fe8b0', '#d6ffd9', '#5fae4f'], { speed: 200, life: .6, kind: 'leaf', size: 6 });
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist(h, e) < 110 + e.r) { e.windup = 0; e.cd = Math.max(e.cd, 1.3); this.damageEnemy(e, 10 * this.power); this.knock(e, h, e.boss ? 10 : 220); }
    this.play('shield');
  }
  private starfall() {
    const h = this.hero;
    const targets = this.enemies.filter(e => !e.dead && this.canHurt(e) && dist(h, e) < 480).sort((a, b) => dist(h, a) - dist(h, b)).slice(0, 5);
    const spots: Point[] = targets.map(t => ({ x: t.x, y: t.y }));
    while (spots.length < 9) { const a = rand(0, 6.28), r = rand(60, 300); spots.push({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r }); }
    spots.forEach((s, i) => { const delay = .35 + i * .12; this.hazards.push({ x: s.x, y: s.y, r: 72, delay, maxDelay: delay, damage: 34 * this.power, owner: 'hero', kind: 'starfall', fromX: s.x + 260, fromY: s.y - 560 }); });
    this.flash = .3; this.play('starfall');
  }

  // ───────────────────────────── quests
  quest(id: string) { return this.questById.get(id); }
  private qs(id: string) { return this.quests.get(id)!; }
  questsFor(npcId: string) { return this.world.quests.filter(q => q.giver === npcId); }
  npcMarker(n: Npc): '!' | '?' | null {
    if (n.role === 'guide') return !this.main.talkedGuide || (this.bossUnlocked() && !this.main.readySeen && !this.main.bossDefeated) ? '!' : null;
    for (const q of this.world.quests) {
      const st = this.qs(q.id);
      if (q.giver === n.id && st.status === 'ready') return '?';
      if (q.kind === 'deliver' && q.to === n.id && st.status === 'active') return '?';
    }
    for (const q of this.questsFor(n.id)) if (this.qs(q.id).status === 'available') return '!';
    return null;
  }
  /** Every quest also pays out one item; quests without a set one get a fixed pick so the offer can name it. */
  rewardItem(q: QuestDef): ItemId { return q.reward.item ?? ITEM_ORDER[[...q.id].reduce((a, c) => a + c.charCodeAt(0), 0) % ITEM_ORDER.length]; }
  rewardText(q: QuestDef) {
    const r = q.reward, parts = [`${Math.round(r.xp * this.world.xpScale)} XP`];
    if (r.hearts) parts.push(`+${r.hearts * HP_UNIT} max health`);
    if (r.mana) parts.push(`+${r.mana} max magic`);
    if (r.regen) parts.push('faster magic');
    parts.push(ITEMS[this.rewardItem(q)].name);
    return parts.join(' · ');
  }
  private offerQuest(q: QuestDef, n: Npc) {
    const offer: QuestOffer = { id: q.id, title: q.title, summary: q.summary, reward: this.rewardText(q) };
    sfx.play('talk'); this.eventHandler({ type: 'dialogue', speaker: n.name, portrait: n.portrait, lines: q.text.offer, offer });
  }
  /** Called by the UI when the player presses Accept on an offer. */
  acceptQuest(id: string) {
    const q = this.quest(id); if (!q) return;
    const st = this.qs(q.id); if (st.status !== 'available') return;
    st.status = 'active'; st.progress = 0;
    if (q.kind === 'collect') st.progress = this.world.objects.filter(o => o.questId === q.id && this.got.has(o.id)).length;
    this.tracked = q.id;
    this.eventHandler({ type: 'quest', title: q.title, state: 'accepted' }); this.play('quest');
    if (q.kind === 'visit' && this.discovered.has(q.place!)) this.advance(q, 1);
    else if (q.kind === 'collect' && st.progress >= q.count) { st.status = 'ready'; }
  }
  private advance(q: QuestDef, by: number) {
    const st = this.qs(q.id); if (st.status !== 'active') return;
    st.progress = Math.min(q.count, st.progress + by);
    if (st.progress >= q.count) {
      st.status = 'ready';
      this.eventHandler({ type: 'quest', title: q.title, state: 'ready' }); this.play('quest');
      const giver = this.npcs.find(n => n.id === q.giver);
      this.notice(`${q.title}: return to ${giver?.name || 'the quest giver'}.`, 'good');
    } else if (q.kind !== 'collect') this.notice(`${q.title} ${st.progress}/${q.count}`);
  }
  private complete(q: QuestDef, speaker: Npc, lines: string[]) {
    const st = this.qs(q.id); st.status = 'done';
    const r = q.reward, key = `${this.world.id}:${q.id}`, first = !this.profile.claimed.includes(key);
    if (first) {
      this.profile.claimed.push(key);
      if (r.hearts) this.profile.bonusHearts += r.hearts;
      if (r.mana) this.profile.bonusMana += r.mana;
      if (r.regen) this.profile.regen += r.regen;
    }
    this.refreshStats(false);
    if (r.hearts) this.hero.hp = this.hero.maxHp;
    if (r.regen) this.hero.mana = this.hero.maxMana;
    const h = this.hero;
    this.emit(h.x, h.y, 34, ['#fff1b8', '#b9f29d', '#ffffff'], { speed: 180, life: 1, kind: 'star', glow: true }); this.play('questDone');
    const xp = r.xp * this.world.xpScale;
    this.say(speaker.name, speaker.portrait, lines);
    this.eventHandler({ type: 'quest', title: q.title, state: 'completed', xp: Math.round(xp) });
    this.gainXp(xp);
    this.addItem(this.rewardItem(q));
    if (this.tracked === q.id) this.tracked = this.world.quests.find(x => this.qs(x.id).status === 'active' || this.qs(x.id).status === 'ready')?.id || null;
    for (const other of this.world.quests) if (other.requires === q.id && this.qs(other.id).status === 'locked') this.qs(other.id).status = 'available';
  }
  track(id: string) { if (this.quests.has(id)) this.tracked = id; }

  // ───────────────────────────── inventory
  addItem(id: ItemId, count = 1) {
    const bag = this.profile.items; bag[id] = Math.min(99, (bag[id] || 0) + count); saveProfile(this.profile);
    this.text(this.hero.x, this.hero.y - 70, `+${count} ${ITEMS[id].name}`, ITEMS[id].color, 15);
    this.eventHandler({ type: 'item', id, count });
  }
  useItem(id: ItemId) {
    if (this.completeTimer > 0) return;
    const bag = this.profile.items, have = bag[id] || 0, h = this.hero, info = ITEMS[id];
    if (have <= 0) { this.play('nope'); this.notice(`You have no ${info.name} left. Open chests to find more.`, 'warn'); return; }
    if (id === 'healthPotion' && h.hp >= h.maxHp) { this.play('nope'); this.notice('Your health is already full.', 'warn'); return; }
    if (id === 'manaPotion' && h.mana >= h.maxMana - .5) { this.play('nope'); this.notice('Your magic is already full.', 'warn'); return; }
    if (have > 1) bag[id] = have - 1; else delete bag[id];
    saveProfile(this.profile);
    if (id === 'healthPotion') { const heal = Math.min(h.maxHp - h.hp, Math.round(h.maxHp * .5)); h.hp += heal; this.text(h.x, h.y - 50, `+${heal}`, '#ff9aa8', 20); }
    else if (id === 'manaPotion') h.mana = h.maxMana;
    else { this.buffs[id] = info.duration; this.notice(`${info.name}: ${info.description}`, 'good'); }
    this.emit(h.x, h.y - 10, 22, [info.color, '#ffffff'], { speed: 160, life: .8, kind: 'star', glow: true, grav: -60 });
    this.ring(h.x, h.y, 70, info.color, .5); this.play('drink');
  }

  // ───────────────────────────── world interaction
  isVisible(o: WorldObject) { return this.visibleObject(o); }
  private visibleObject(o: WorldObject) {
    if (o.kind === 'key') return !this.main.keys.includes(o.id);
    if (o.kind === 'questItem') return !this.got.has(o.id) && this.qs(o.questId!)?.status === 'active';
    return true;
  }
  private interactable(o: WorldObject) { return this.visibleObject(o) && !(o.kind === 'chest' && this.opened.has(o.id)); }
  nearest(maxRange = 105): Near | null {
    let best: Near | null = null, bd = maxRange;
    const h = this.hero;
    for (const o of this.world.objects) { if (Math.abs(o.x - h.x) > maxRange || Math.abs(o.y - h.y) > maxRange || !this.interactable(o)) continue; const d = dist(h, o); if (d < bd) { bd = d; best = { kind: 'object', o }; } }
    for (const n of this.npcs) { if (Math.abs(n.x - h.x) > maxRange || Math.abs(n.y - h.y) > maxRange) continue; const d = dist(h, n) - 12; if (d < bd) { bd = d; best = { kind: 'npc', n }; } }
    return best;
  }
  interact() {
    sfx.unlock();
    if (this.completeTimer > 0) return;
    const near = this.nearest(); if (!near) return;
    if (near.kind === 'npc') return this.talk(near.n);
    const o = near.o, s = this.world.script, h = this.hero, m = this.main, acc = this.world.palette.accent;
    switch (o.kind) {
      case 'key': {
        m.keys.push(o.id); h.mana = Math.min(h.maxMana, h.mana + 25);
        this.emit(o.x, o.y, 40, [acc, '#ffffff', '#fff1b8'], { speed: 260, life: 1, kind: 'star', glow: true, size: 5 });
        this.ring(o.x, o.y, 90, acc, .6); this.flash = .2;
        this.notice(s.pickupKey.replace('{n}', String(m.keys.length)), 'good'); this.play('key'); this.gainXp(40 * this.world.xpScale);
        if (m.keys.length === 3) window.setTimeout(() => this.notice(`The seal on ${s.bossName} is breaking…`, 'epic'), 1400);
        return;
      }
      case 'questItem': {
        const q = this.quest(o.questId!)!; this.got.add(o.id);
        this.emit(o.x, o.y, 22, ['#fff49b', '#ffffff', acc], { speed: 150, life: .8, kind: 'star', glow: true });
        this.play('pickup'); this.advance(q, 1);
        if (this.qs(q.id).status === 'active') this.notice(`${o.name} ${this.qs(q.id).progress}/${q.count}`, 'good');
        return;
      }
      case 'chest': {
        this.opened.add(o.id); this.play('chest', o);
        this.emit(o.x, o.y - 10, 36, ['#ffd35c', '#fff1b8', '#ffffff'], { speed: 240, life: 1, kind: 'star', glow: true, size: 5 });
        const n = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.spawnOrb(o.x, o.y - 8, Math.random() < .25 ? 'heart' : 'mana');
        this.notice(`You opened the ${o.name.toLowerCase()}!`, 'good'); this.gainXp(35 * this.world.xpScale, o.x, o.y);
        this.addItem(rollItem()); if (Math.random() < .35) this.addItem(rollItem());
        return;
      }
      case 'lore': {
        const first = !this.read.has(o.id); this.read.add(o.id); this.play('page');
        this.say(o.name, '🪨', o.text || []);
        if (first) this.gainXp(30 * this.world.xpScale, o.x, o.y);
        return;
      }
      case 'sign': this.play('page'); this.say(o.name, '🪧', o.text || []); return;
      case 'well': {
        const t = this.wellT.get(o.id) || -999;
        if (this.elapsed - t > 45 && (h.hp < h.maxHp || h.mana < h.maxMana)) { this.wellT.set(o.id, this.elapsed); h.hp = h.maxHp; h.mana = h.maxMana; this.play('drink'); this.emit(h.x, h.y, 20, ['#9fd8ff', '#ffffff'], { speed: 120, glow: true }); this.notice('You drink the cool well water. Fully restored!', 'good'); }
        else this.notice('The water is cool and clear.');
        this.setCheckpoint(); return;
      }
      case 'campfire': {
        this.setCheckpoint(); h.hp = h.maxHp; h.mana = h.maxMana; this.play('rest');
        this.emit(o.x, o.y - 10, 24, ['#ffcf6e', '#ff9a4a', '#fff1b8'], { speed: 90, life: 1.1, kind: 'ember', glow: true, grav: -40 });
        this.notice('You rest by the fire. Health and magic restored — Mira will return here if she falls.', 'good');
        return;
      }
      case 'shrine': {
        this.setCheckpoint(); h.hp = h.maxHp; h.mana = h.maxMana;
        if (!this.blessed) {
          this.blessed = true;
          this.emit(o.x, o.y - 20, 70, [acc, '#ffffff', '#fff1b8'], { speed: 320, life: 1.3, kind: 'star', glow: true, size: 6 });
          this.ring(o.x, o.y, 160, acc, .9); this.flash = .5; this.addShake(6); this.play('learn');
          this.say(o.name, '✨', s.shrine.bless); this.gainXp(90 * this.world.xpScale, o.x, o.y);
        } else { this.play('rest'); this.say(o.name, '✨', s.shrine.again); }
        return;
      }
      case 'finale': {
        if (!m.bossDefeated) { this.say(o.name, '✦', this.bossUnlocked() ? s.finale.guarded : s.finale.locked); return; }
        if (m.finaleDone) { this.celebrate(); return; }
        m.finaleDone = true; this.say(o.name, '✦', s.finale.done, 'complete'); return;
      }
    }
  }
  private talk(n: Npc) {
    const s = this.world.script, m = this.main;
    n.faceX = this.hero.x > n.x ? 1 : -1; n.waitT = Math.max(n.waitT, 3);
    if (n.role === 'guide') {
      this.setCheckpoint(); m.talkedGuide = true;
      if (m.bossDefeated) return this.say(n.name, n.portrait, s.guide.done);
      if (this.bossUnlocked()) { m.readySeen = true; return this.say(n.name, n.portrait, s.guide.ready); }
      return this.say(n.name, n.portrait, s.guide.intro(m.keys.length));
    }
    // A delivery addressed to this person comes first.
    for (const q of this.world.quests) if (q.kind === 'deliver' && q.to === n.id && this.qs(q.id).status === 'active') return this.complete(q, n, q.text.deliver || ['Thank you!']);
    const mine = this.questsFor(n.id);
    const ready = mine.find(q => this.qs(q.id).status === 'ready'); if (ready) return this.complete(ready, n, ready.text.complete);
    const offer = mine.find(q => this.qs(q.id).status === 'available'); if (offer) return this.offerQuest(offer, n);
    const active = mine.find(q => this.qs(q.id).status === 'active');
    if (active) { const st = this.qs(active.id); return this.say(n.name, n.portrait, [...active.text.progress, active.kind === 'deliver' ? '' : `(${st.progress}/${active.count})`].filter(Boolean)); }
    const done = mine.find(q => this.qs(q.id).status === 'done');
    this.say(n.name, n.portrait, done && Math.random() < .5 ? done.text.after : [pick(n.lines.length ? n.lines : ['Hello there!'])]);
  }
  /** Called by the UI once the finale dialogue closes: fireworks, then the chapter ends. */
  celebrate() {
    if (this.completeTimer > 0) return;
    this.completeTimer = 3.2; this.fireworkTimer = 0; this.flash = .8; this.addShake(8); this.play('victory');
    const f = this.world.objects.find(o => o.kind === 'finale');
    if (f) { this.ring(f.x, f.y, 400, this.world.palette.accent, 1.4); this.emit(f.x, f.y - 40, 120, [this.world.palette.accent, '#ffffff', '#fff1b8'], { speed: 520, life: 1.6, kind: 'star', glow: true, size: 6, drag: 1.6 }); }
  }
  get finaleLit() { return this.main.finaleDone; }

  private nearestTarget(maxRange: number): Enemy | Pod | null {
    let best: Enemy | Pod | null = null, bestD = maxRange;
    const h = this.hero;
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0 || !this.canHurt(e) || Math.abs(e.x - h.x) > maxRange || Math.abs(e.y - h.y) > maxRange) continue; const d = dist(h, e); if (d < bestD) { best = e; bestD = d; } }
    if (!best) for (const p of this.pods) { if (p.dead) continue; const d = dist(h, p); if (d < Math.min(bestD, 260)) { best = p; bestD = d; } }
    return best;
  }
  private knock(e: Enemy, from: Point, force: number) {
    const dx = e.x - from.x, dy = e.y - from.y, d = Math.max(1, Math.hypot(dx, dy));
    e.kx += dx / d * force; e.ky += dy / d * force;
  }
  private damageEnemy(e: Enemy, amount: number, crit = false) {
    if (e.dead) return;
    if (!this.canHurt(e)) { this.notice(this.world.script.sealed, 'warn'); this.emit(e.x, e.y, 8, '#c9b6ff', { speed: 120, glow: true }); return; }
    amount = Math.max(1, Math.round(amount));
    e.hp -= amount; e.hitFlash = .14; e.aggro = true;
    this.combo++; this.comboTime = 2.4;
    this.text(e.x, e.y - e.r - 18, crit ? `${amount}!` : `${amount}`, crit ? '#ffd35c' : '#fff3c0', crit ? 24 : 17);
    this.emit(e.x, e.y, crit ? 12 : 7, ['#ffffff', '#fff3c0', this.world.palette.accent], { speed: 200, life: .35, glow: true, size: 3 });
    this.play(crit ? 'crit' : 'hit', e);
    if (crit) { this.hitStop = Math.max(this.hitStop, .05); this.addShake(3); }
    if (e.hp <= 0) this.killEnemy(e);
  }
  private killEnemy(e: Enemy) {
    e.dead = true; e.deadT = 0; e.action = null;
    if (!e.summoned) this.defeated++;
    const colors = e.kind === 'gloomling' ? ['#8c7ce0', '#c9b6ff', '#ffffff'] : e.kind === 'thornling' ? ['#9fd46b', '#e8ffb0', '#5fae4f'] : e.kind === 'wisp' ? ['#8ee8ff', '#c9b6ff', '#ffffff'] : [this.world.palette.accent, '#ffffff', '#ffd27a', '#ff9a4a'];
    this.emit(e.x, e.y, e.boss ? 140 : 22, colors, { speed: e.boss ? 520 : 240, life: e.boss ? 1.8 : .8, kind: 'star', glow: true, size: e.boss ? 7 : 4, drag: 2 });
    this.emit(e.x, e.y, e.boss ? 36 : 8, ['#8fd46b', '#b9f29d', '#f2a1b8'], { speed: 200, life: 1.6, kind: 'leaf', size: 7, grav: 60 });
    this.ring(e.x, e.y, e.boss ? 320 : 70, colors[0], e.boss ? 1 : .4);
    const drops = e.boss ? 14 : e.summoned ? 1 : e.elite ? 6 : 2;
    for (let i = 0; i < drops; i++) this.spawnOrb(e.x, e.y, Math.random() < (e.boss ? .3 : e.elite ? .3 : .1) ? 'heart' : 'mana');
    const xp = ENEMY_STATS[e.kind].xp * this.world.xpScale * (e.boss ? 1 : e.elite ? 3 : e.summoned ? .3 : 1);
    if (e.boss) { this.addItem(rollItem()); this.addItem('healthPotion'); }
    else if (e.elite ? Math.random() < .45 : !e.summoned && Math.random() < .04) this.addItem(e.elite ? rollItem() : 'healthPotion');
    if (e.boss) {
      this.main.bossDefeated = true; this.slowMo = 1.4; this.flash = 1; this.addShake(22); this.play('bossDie');
      for (const other of this.enemies) if (other.summoned && !other.dead) this.killEnemy(other);
      this.clearThreats = true;
      this.notice(`${this.world.script.bossName} is defeated! Go to the ${this.world.script.finaleName}.`, 'epic');
    } else {
      this.hitStop = Math.max(this.hitStop, .04); this.addShake(4); this.play('kill', e);
      if (!e.summoned) for (const q of this.world.quests) if (q.kind === 'slay' && (q.enemy === 'any' || q.enemy === e.kind)) this.advance(q, 1);
    }
    this.gainXp(xp, e.x, e.y);
  }
  private spawnOrb(x: number, y: number, kind: Orb['kind']) { const a = rand(0, 6.28), v = rand(120, 300); this.orbs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind, age: 0 }); }
  private breakPod(p: Pod) {
    if (p.dead) return;
    p.dead = true;
    this.emit(p.x, p.y, 22, [this.world.palette.pod, '#ffffff', '#fff1b8'], { speed: 240, life: .8, kind: 'shard', glow: true, size: 5, grav: 200 });
    this.ring(p.x, p.y, 50, this.world.palette.pod, .35);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.spawnOrb(p.x, p.y, Math.random() < .22 ? 'heart' : 'mana');
    this.addShake(3); this.play('pod', p);
  }
  private hurt(amount: number, from: Point) {
    const h = this.hero;
    if (h.hurtTime > 0 || h.dashTime > 0 || this.completeTimer > 0) return;
    if (h.shieldTime > 0) { this.ring(h.x, h.y, 50, '#9fe8b0', .25); this.play('reflect'); return; }
    const dmg = Math.round(amount * HP_UNIT * (this.buffs.barkskin ? .5 : 1));
    h.hp -= dmg; h.hurtTime = 1.1; this.damageFlash = .35; this.combo = 0;
    const dx = h.x - from.x, dy = h.y - from.y, d = Math.max(1, Math.hypot(dx, dy));
    h.vx += dx / d * 520; h.vy += dy / d * 520;
    this.text(h.x, h.y - 50, `-${dmg}`, '#ff8f7a', 20);
    this.emit(h.x, h.y, 18, ['#ff8f7a', '#ffd1ae', '#ffffff'], { speed: 220, life: .5, glow: true });
    this.addShake(10); this.hitStop = .08; this.play('hurt');
    if (h.hp <= 0) this.respawn();
  }
  private get enemyDamage() { return this.world.chapter >= 3 ? 2 : 1; }
  private get bossDamage() { return this.world.chapter >= 2 ? 2 : 1; }
  private respawn() {
    const h = this.hero;
    h.hp = h.maxHp; h.mana = Math.max(40, h.mana); h.x = this.checkpoint.x; h.y = this.checkpoint.y; h.vx = h.vy = 0; h.hurtTime = 2;
    this.respawnFade = 1; this.clearThreats = true;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.summoned) { e.dead = true; continue; }
      e.aggro = false; e.x = e.homeX; e.y = e.homeY; e.cd = 2; e.windup = 0; e.action = null;
      if (e.boss) e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * .25));
    }
    this.bossIntroShown = false;
    this.notice('Mira wakes at her last resting place. Quest progress is safe.', 'warn');
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
    for (const id of SPELL_ORDER) h.cds[id] = Math.max(0, h.cds[id] - dt);
    h.shieldTime = Math.max(0, h.shieldTime - dt); h.hurtTime = Math.max(0, h.hurtTime - dt); h.castTime = Math.max(0, h.castTime - dt);
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
    this.slowTick -= dt;
    if (this.slowTick <= 0) { this.slowTick = .25; this.updateZone(); this.markExplored(); this.updateSoundscape(); this.respawnEnemies(); }
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
    for (const o of this.obstacleGrid.near(p.x, p.y, 110 + pad)) {
      if (o.w) {
        const hh = o.h || 0, cx = clamp(p.x, o.x - o.w, o.x + o.w), cy = clamp(p.y, o.y - hh, o.y + hh), dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
        if (d < pad) {
          if (d > 0) { p.x = cx + dx / d * pad; p.y = cy + dy / d * pad; }
          else { const ox = o.w + pad - Math.abs(p.x - o.x), oy = hh + pad - Math.abs(p.y - o.y); if (ox < oy) p.x += Math.sign(p.x - o.x || 1) * ox; else p.y += Math.sign(p.y - o.y || 1) * oy; }
        }
      } else this.pushOut(p, o.x, o.y, o.r + pad);
    }
    for (const pond of this.world.ponds) {
      const dx = (p.x - pond.x) / (pond.r + pad * .6), dy = (p.y - pond.y) / (pond.r * .58 + pad * .6), d = Math.hypot(dx, dy);
      if (d < 1 && d > 0) { p.x = pond.x + dx / d * (pond.r + pad * .6); p.y = pond.y + dy / d * (pond.r * .58 + pad * .6); }
    }
  }
  private updateHero(dt: number) {
    const h = this.hero, speed = 270 * (this.buffs.swiftTonic ? 1.4 : 1);
    if (h.dashTime > 0) {
      h.dashTime -= dt; h.vx = h.dashX * 900; h.vy = h.dashY * 900;
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
      if (Math.random() < dt * 8) this.emit(h.x + rand(-8, 8), h.y + 20, 1, this.world.id === 'summit' ? 'rgba(220,225,255,.5)' : 'rgba(220,200,150,.55)', { speed: 30, life: .5, kind: 'smoke', size: 5, drag: 3 });
    }
    this.collide(h, 15);
    for (const p of this.pods) if (!p.dead && Math.abs(p.x - h.x) < 60 && Math.abs(p.y - h.y) < 60) this.pushOut(h, p.x, p.y, 34);
    for (const n of this.npcs) if (Math.abs(n.x - h.x) < 40 && Math.abs(n.y - h.y) < 40) this.pushOut(h, n.x, n.y, 28);
    for (let i = this.afterimages.length - 1; i >= 0; i--) { this.afterimages[i].life -= dt; if (this.afterimages[i].life <= 0) swapRemove(this.afterimages, i); }
    if (h.shieldTime > 0 && Math.random() < dt * 12) this.emit(h.x + rand(-30, 30), h.y + rand(-30, 20), 1, '#9fe8b0', { speed: 30, life: .7, kind: 'leaf', size: 5, grav: -20 });
    sfx.setListener(h.x, h.y);
  }
  groundAt(x: number, y: number) {
    if (this.roads.dist(x, y, 60) < 46) return 'path' as const;
    const p = this.poiAt({ x, y }); if (p && (p.kind === 'ruins' || p.kind === 'shrine' || p.kind === 'finale')) return 'stone' as const;
    return this.world.id === 'summit' ? 'snow' as const : 'grass' as const;
  }
  private pushOut(p: Point, x: number, y: number, min: number) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d < min && d > 0) { p.x = x + dx / d * min; p.y = y + dy / d * min; }
  }

  private updateEnemies(dt: number) {
    const h = this.hero;
    let threats = 0;
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
      if (e.boss) { this.updateBoss(e, dt, d); continue; }
      if (!e.aggro && d < 380) { e.aggro = true; this.text(e.x, e.y - e.r - 26, '!', '#ffd35c', 22); this.play('squeak', e); }
      if (e.aggro && (d > 780 || dist(e, { x: e.homeX, y: e.homeY }) > 900)) e.aggro = false;
      if (!e.aggro) { this.wander(e, dt); continue; }
      e.cd = Math.max(0, e.cd - dt);
      const dx = (h.x - e.x) / Math.max(1, d), dy = (h.y - e.y) / Math.max(1, d), sp = ENEMY_STATS[e.kind].speed * (e.elite ? 1.1 : 1);
      if (e.kind === 'gloomling') {
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) { e.lunge = .2; e.kx += dx * 520; e.ky += dy * 520; if (d < 90 + (e.elite ? 20 : 0)) this.hurt(this.enemyDamage, e); e.cd = e.elite ? 1.6 : 2.2; }
        } else if (e.cd <= 0 && d < 90) e.windup = .55;
        else if (d > 50) { e.x += dx * sp * dt; e.y += dy * sp * dt; }
      } else if (e.kind === 'thornling') {
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) { for (const off of e.elite ? [-.4, -.2, 0, .2, .4] : [-.22, 0, .22]) this.enemyShot(e, Math.atan2(dy, dx) + off, 300, 'thorn'); e.cd = 2.4; this.play('thornShot', e); }
        } else if (e.cd <= 0 && d < 360) e.windup = .55;
        else {
          const want = d > 260 ? 1 : d < 180 ? -1 : 0;
          e.x += dx * sp * want * dt; e.y += dy * sp * want * dt;
        }
      } else if (e.kind === 'wisp') {
        e.angle += dt * 2.4;
        const side = Math.sin(e.angle) * sp;
        const want = d > 240 ? sp : d < 170 ? -sp : 0;
        e.x += (dx * want - dy * side) * dt; e.y += (dy * want + dx * side) * dt;
        if (Math.random() < dt * 8) this.emit(e.x, e.y + 6, 1, ['#8ee8ff', '#c9b6ff'], { speed: 20, life: .6, glow: true, size: 4, grav: -30 });
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { this.enemyShot(e, Math.atan2(dy, dx), 330, 'void'); if (e.elite) { this.enemyShot(e, Math.atan2(dy, dx) + .3, 330, 'void'); this.enemyShot(e, Math.atan2(dy, dx) - .3, 330, 'void'); } e.cd = 1.7; this.play('voidShot', e); } }
        else if (e.cd <= 0 && d < 420) e.windup = .4;
      }
      if (d < e.r + 16 && e.kind !== 'thornling') this.hurt(this.enemyDamage, e);
    }
    this.combat += (clamp(threats / 4, 0, 1) - this.combat) * Math.min(1, dt * 1.5);
  }
  private respawnEnemies() {
    const h = this.hero;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.dead) continue;
      if (e.summoned) { swapRemove(this.enemies, i); continue; }
      if (e.boss || e.deadT < 150 || Math.hypot(e.homeX - h.x, e.homeY - h.y) < 1400) continue;
      const fresh = this.makeEnemy(e); fresh.x = e.homeX; fresh.y = e.homeY;
      Object.assign(e, fresh);
    }
  }
  private wander(e: Enemy, dt: number) {
    e.wanderT -= dt;
    if (e.wanderT <= 0) { e.wanderT = rand(1.5, 4); const a = rand(0, 6.28), r = rand(0, 110); e.wanderX = e.homeX + Math.cos(a) * r; e.wanderY = e.homeY + Math.sin(a) * r; }
    const dx = e.wanderX - e.x, dy = e.wanderY - e.y, d = Math.hypot(dx, dy);
    if (d > 6) { e.x += dx / d * 40 * dt; e.y += dy / d * 40 * dt; }
    if (e.kind === 'wisp') e.angle += dt * 2;
  }
  private enemyShot(e: Point, angle: number, speed: number, kind: 'thorn' | 'void') {
    this.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 2.6, r: kind === 'void' ? 9 : 7, damage: this.enemyDamage, owner: 'enemy', kind, spin: angle });
  }

  // ───────────────────────────── villagers and wildlife
  private updateNpcs(dt: number) {
    const h = this.hero;
    this.globalBarkT -= dt;
    for (const n of this.npcs) {
      n.barkT = Math.max(0, n.barkT - dt); n.barkCd -= dt;
      const dh = Math.abs(n.x - h.x) + Math.abs(n.y - h.y);
      if (dh > ACTIVE_RANGE * 1.4 && n.activity !== 'travel') continue;
      const close = dh < 150;
      if (dh < 330 && n.barkCd <= 0 && this.globalBarkT <= 0 && !close) { n.bark = this.npcMarker(n) === '!' ? pick(['Excuse me! Could you help?', 'Oh! A hero! I need a hand…', 'Psst — over here!']) : pick(n.barks.length ? n.barks : ['Hello!']); n.barkT = 3.2; n.barkCd = rand(14, 26); this.globalBarkT = 2.5; }
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
        if (c.t <= 0) { // land somewhere new, out of sight
          const a = rand(0, 6.28), rr = rand(900, 1500), nx = clamp(h.x + Math.cos(a) * rr, 200, w.width - 200), ny = clamp(h.y + Math.sin(a) * rr, 200, w.height - 200);
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
  private updateBoss(e: Enemy, dt: number, d: number) {
    const h = this.hero;
    if (!this.canHurt(e)) {
      this.sealedNoticeT -= dt;
      if (d < 260 && this.sealedNoticeT <= 0) { this.sealedNoticeT = 6; this.notice(this.world.script.sealed, 'warn'); }
      return;
    }
    if (!e.aggro) {
      const home = Math.hypot(e.homeX - e.x, e.homeY - e.y);
      if (home > 20) { e.x += (e.homeX - e.x) / home * 90 * dt; e.y += (e.homeY - e.y) / home * 90 * dt; }
      if (d > 520) return;
      e.aggro = true; e.cd = 1.4;
      if (!this.bossIntroShown) { this.bossIntroShown = true; this.eventHandler({ type: 'bossIntro', name: this.world.script.bossName, title: this.world.script.bossTitle }); this.play('roar'); this.addShake(12); this.ring(e.x, e.y, 260, '#ff8f7a', .8); }
    }
    if (d > 1100) { e.aggro = false; e.action = null; return; }
    const phase = e.hp <= e.maxHp * .5 ? 2 : 1;
    if (phase === 2 && e.phase === 1) { e.phase = 2; this.play('roar'); this.addShake(14); this.flash = .4; this.ring(e.x, e.y, 300, '#ff6b5b', .8); this.notice(`${this.world.script.bossName} is enraged!`, 'epic'); e.action = null; e.cd = .6; }
    const thresholds = [.7, .35];
    if (e.summons < thresholds.length && e.hp <= e.maxHp * thresholds[e.summons]) { e.summons++; this.summonMinions(e); }
    if (Math.random() < dt * 8) this.emit(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r * .5), 1, e.kind === 'hollowStar' ? ['#c9b6ff', '#6a4bd6'] : e.kind === 'brambleWarden' ? ['#b6df91', '#ff8f7a'] : ['#a3c46a', '#e8ffb0'], { speed: 20, life: 1, glow: e.kind === 'hollowStar', size: 4, grav: -40, kind: e.kind === 'hollowStar' ? 'star' : 'leaf' });
    if (d < e.r + 18 && e.action !== 'blink') this.hurt(this.bossDamage, e);
    if (e.action) { this.runBossAction(e, dt); return; }
    const sp = ENEMY_STATS[e.kind].speed * (phase === 2 ? 1.3 : 1);
    if (d > 150) { e.x += (h.x - e.x) / d * sp * dt; e.y += (h.y - e.y) / d * sp * dt; }
    if (e.kind === 'hollowStar') { e.angle += dt; e.y += Math.sin(this.elapsed * 2) * 10 * dt; }
    e.cd -= dt;
    if (e.cd <= 0) {
      const list = BOSS_PATTERNS[e.kind][phase - 1];
      this.startBossAction(e, list[e.pattern++ % list.length]);
    }
  }
  private summonMinions(e: Enemy) {
    const kind: EnemyKind = e.kind === 'hollowStar' ? 'wisp' : e.kind === 'brambleWarden' ? 'thornling' : 'gloomling';
    const n = e.kind === 'mossback' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(0, 1), m = this.makeEnemy({ id: `summon-${this.summonCount++}`, kind, x: e.x + Math.cos(a) * 120, y: e.y + Math.sin(a) * 120 }, true);
      m.hp = m.maxHp = Math.round(m.maxHp * .7);
      this.enemies.push(m);
      this.emit(m.x, m.y, 20, ['#c9b6ff', '#ffffff', '#8fd46b'], { speed: 160, glow: true, kind: 'star' }); this.ring(m.x, m.y, 50, '#c9b6ff', .5);
    }
    this.notice(`${this.world.script.bossName} calls for help!`, 'warn'); this.play('roar');
  }
  private startBossAction(e: Enemy, a: BossAction) {
    const h = this.hero, p2 = e.phase === 2;
    e.action = a; e.actionStep = 0;
    switch (a) {
      case 'slam': e.actionT = 1.25; this.addHazard(e.x, e.y, p2 ? 185 : 155, .95, 'slam', e); break;
      case 'boulders': {
        e.actionT = 1.4; const n = p2 ? 6 : 4;
        for (let i = 0; i < n; i++) { const a2 = rand(0, 6.28), r = i === 0 ? 0 : rand(40, 170); this.addHazard(h.x + Math.cos(a2) * r + h.vx * .4, h.y + Math.sin(a2) * r + h.vy * .4, 58, 1 + i * .16, 'boulder', e); }
        this.play('roar'); break;
      }
      case 'nova': e.actionT = p2 ? 1.3 : .95; break;
      case 'roots': {
        e.actionT = 1.5; const base = Math.atan2(h.y - e.y, h.x - e.x), lines = p2 ? [-.45, 0, .45] : [0];
        for (const off of lines) for (let i = 1; i <= 8; i++) this.addHazard(e.x + Math.cos(base + off) * i * 62, e.y + Math.sin(base + off) * i * 62, 44, .55 + i * .09, 'root', e);
        break;
      }
      case 'charge': { e.actionT = 1.3; const dx = h.x - e.x, dy = h.y - e.y, d = Math.max(1, Math.hypot(dx, dy)); e.chargeX = dx / d; e.chargeY = dy / d; break; }
      case 'spiral': e.actionT = p2 ? 2.6 : 2.1; e.angle = rand(0, 6.28); break;
      case 'meteors': {
        e.actionT = 1.8; const n = p2 ? 12 : 8;
        for (let i = 0; i < n; i++) { const a2 = rand(0, 6.28), r = i < 2 ? rand(0, 30) : rand(50, 260); const x = h.x + Math.cos(a2) * r, y = h.y + Math.sin(a2) * r; this.addHazard(x, y, 64, .9 + i * .11, 'meteor', { x: x - 220, y: y - 600 }); }
        break;
      }
      case 'blink': e.actionT = 1.4; break;
    }
  }
  private runBossAction(e: Enemy, dt: number) {
    const h = this.hero, p2 = e.phase === 2;
    const before = e.actionT; e.actionT -= dt;
    const passed = (t: number) => before > t && e.actionT <= t;
    switch (e.action) {
      case 'nova': {
        const kind = e.kind === 'hollowStar' ? 'void' : 'thorn';
        if (passed(p2 ? .75 : .4)) this.novaRing(e, p2 ? 18 : 14, 0, kind);
        if (p2 && passed(.35)) this.novaRing(e, 18, Math.PI / 18, kind);
        break;
      }
      case 'charge': {
        if (e.actionT < .75 && e.actionT > .3) {
          e.x += e.chargeX * 820 * dt; e.y += e.chargeY * 820 * dt;
          e.x = clamp(e.x, 60, this.world.width - 60); e.y = clamp(e.y, 60, this.world.height - 60);
          if (Math.random() < .6) this.emit(e.x, e.y + e.r * .6, 2, ['#8a6a4a', '#b6df91'], { speed: 80, life: .6, kind: 'smoke', size: 10 });
          if (Math.random() < dt * 14) this.enemyShot(e, Math.atan2(e.chargeY, e.chargeX) + Math.PI + rand(-.9, .9), 160, 'thorn');
        }
        if (passed(.75)) { this.addShake(6); this.play('roar'); }
        break;
      }
      case 'spiral': {
        if (e.actionT < (p2 ? 2.3 : 1.8)) {
          e.actionStep += dt;
          while (e.actionStep > .075) {
            e.actionStep -= .075; e.angle += p2 ? .42 : .34;
            const arms = p2 ? 4 : 3;
            for (let i = 0; i < arms; i++) this.enemyShot(e, e.angle + (i / arms) * Math.PI * 2, 210, 'void');
          }
        }
        break;
      }
      case 'blink': {
        if (passed(1.1)) {
          this.emit(e.x, e.y, 40, ['#c9b6ff', '#6a4bd6', '#ffffff'], { speed: 260, life: .6, kind: 'star', glow: true }); this.ring(e.x, e.y, 90, '#c9b6ff', .4);
          const a = rand(0, 6.28); e.x = clamp(h.x + Math.cos(a) * 190, 80, this.world.width - 80); e.y = clamp(h.y + Math.sin(a) * 190, 80, this.world.height - 80);
          this.emit(e.x, e.y, 40, ['#c9b6ff', '#6a4bd6', '#ffffff'], { speed: 260, life: .6, kind: 'star', glow: true }); this.play('dash');
          this.addHazard(e.x, e.y, p2 ? 175 : 150, .75, 'slam', e);
        }
        break;
      }
    }
    if (e.actionT <= 0) { e.action = null; e.cd = p2 ? .9 : 1.5; }
  }
  private novaRing(e: Enemy, count: number, offset: number, kind: 'thorn' | 'void') {
    for (let i = 0; i < count; i++) this.enemyShot(e, offset + (i / count) * Math.PI * 2, 250, kind);
    this.ring(e.x, e.y, 80, kind === 'void' ? '#c9b6ff' : '#b6df91', .3); this.addShake(4); this.play(kind === 'void' ? 'voidShot' : 'thornShot', e);
  }
  private addHazard(x: number, y: number, r: number, delay: number, kind: Hazard['kind'], from: Point) {
    this.hazards.push({ x, y, r, delay, maxDelay: delay, damage: this.bossDamage, owner: 'enemy', kind, fromX: from.x, fromY: from.y });
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
      }
      let hit = false;
      if (p.owner === 'hero') {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || Math.abs(e.x - p.x) > 80 || Math.abs(e.y - p.y) > 80 || dist(p, e) > e.r + p.r) continue;
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
          p.owner = 'hero'; p.vx *= -1.35; p.vy *= -1.35; p.life = 1.4; p.damage = 20 * this.power;
          this.emit(p.x, p.y, 8, '#9fe8b0', { speed: 150, life: .3, glow: true }); this.play('reflect'); continue;
        }
        if (d < p.r + 14) { this.hurt(p.damage, p); hit = true; }
      }
      if (!hit && p.owner === 'enemy') for (const o of this.obstacleGrid.near(p.x, p.y, 60)) if (!o.w && dist(p, o) < o.r && o.kind !== 'fence') { hit = true; this.emit(p.x, p.y, 5, p.kind === 'void' ? '#a78bfa' : '#9fd46b', { speed: 90, life: .3 }); break; }
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
        if (dist(h, z) < z.r + 8) this.hurt(z.damage, z);
      } else {
        for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist(e, z) < z.r + e.r) { this.damageEnemy(e, z.damage); this.knock(e, z, e.boss ? 10 : 160); }
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
      case 'starfall':
        this.ring(z.x, z.y, z.r * 1.1, '#fff1b8', .45);
        this.emit(z.x, z.y, 26, ['#fff1b8', '#c9b6ff', '#ffffff', '#ffd35c'], { speed: 340, life: .7, kind: 'star', glow: true, size: 5 });
        this.flash = Math.max(this.flash, .15); this.addShake(5); this.play('boom', z); break;
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
        if (o.kind === 'heart') { h.hp = Math.min(h.maxHp, h.hp + HP_UNIT); this.text(h.x, h.y - 48, `+${HP_UNIT}`, '#ff9aa8', 18); this.play('pickup'); }
        else { h.mana = Math.min(h.maxMana, h.mana + 7); this.play('orb'); }
        this.emit(h.x, h.y - 10, 6, o.kind === 'heart' ? '#ff9aa8' : '#9fd8ff', { speed: 90, life: .4, glow: true, size: 3 });
        swapRemove(this.orbs, i); continue;
      }
      if (o.age > 16) swapRemove(this.orbs, i);
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
    const p = this.poiAt(this.hero);
    if (!p) { this.zoneName = ''; return; }
    if (p.name === this.zoneName) return;
    this.zoneName = p.name;
    const first = !this.discovered.has(p.id);
    this.eventHandler({ type: 'zone', name: p.name, discovered: first });
    if (!first) return;
    this.discovered.add(p.id); this.play('discover');
    this.gainXp(20 * this.world.xpScale);
    if (p.kind === 'village' || p.kind === 'start' || p.kind === 'camp') this.setCheckpoint();
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
    for (const p of this.world.ponds) { const e = Math.hypot((h.x - p.x) / p.r, (h.y - p.y) / (p.r * .58)); const d = (e - 1) * p.r; water = Math.max(water, clamp(1 - d / 420, 0, 1)); }
    for (const c of this.campfires) fire = Math.max(fire, clamp(1 - dist(h, c) / 420, 0, 1));
    ambience.setProximity(water, fire);
  }
  private updateCelebration(dt: number) {
    this.completeTimer -= dt; this.fireworkTimer -= dt;
    const f = this.world.objects.find(o => o.kind === 'finale')!;
    if (this.fireworkTimer <= 0) {
      this.fireworkTimer = .22;
      const x = f.x + rand(-380, 380), y = f.y + rand(-340, 60), c = pick([this.world.palette.accent, '#ff9aa8', '#9fd8ff', '#fff1b8', '#b9f29d', '#c9b6ff']);
      this.emit(x, y, 40, [c, '#ffffff'], { speed: 300, life: 1.3, kind: 'star', glow: true, size: 4, grav: 90, drag: 1.8 }); this.ring(x, y, 70, c, .5); this.play('kill', { x, y });
    }
    if (this.completeTimer <= 0) {
      this.completeTimer = 0;
      const done = this.world.quests.filter(q => this.qs(q.id).status === 'done').length;
      this.eventHandler({ type: 'levelComplete', levelId: this.world.id, stats: { stars: this.earnedStars(), time: this.elapsed, defeated: this.defeated, quests: done, totalQuests: this.world.quests.length, level: this.profile.level } });
    }
  }

  // ───────────────────────────── UI data
  mainTarget(): Point | null {
    const m = this.main;
    if (!m.talkedGuide) return this.npcs.find(n => n.role === 'guide') || null;
    if (m.keys.length < 3) {
      let best: WorldObject | null = null, bd = Infinity;
      for (const o of this.world.objects) if (o.kind === 'key' && !m.keys.includes(o.id)) { const d = dist(this.hero, o); if (d < bd) { bd = d; best = o; } }
      return best;
    }
    if (!m.bossDefeated) { const b = this.boss(); return b && !b.dead ? b : null; }
    return this.world.objects.find(o => o.kind === 'finale') || null;
  }
  questTarget(): Point | null {
    const q = this.tracked ? this.quest(this.tracked) : null; if (!q) return null;
    const st = this.qs(q.id);
    if (st.status === 'ready') return this.npcs.find(n => n.id === q.giver) || null;
    if (st.status !== 'active') return null;
    if (q.kind === 'deliver') return this.npcs.find(n => n.id === q.to) || null;
    if (q.kind === 'visit') return this.world.pois.find(p => p.id === q.place) || null;
    if (q.kind === 'collect') {
      let best: WorldObject | null = null, bd = Infinity;
      for (const o of this.world.objects) if (o.questId === q.id && !this.got.has(o.id)) { const d = dist(this.hero, o); if (d < bd) { bd = d; best = o; } }
      if (best && bd > 900) return this.world.pois.find(p => p.id === q.near) || best;
      return best;
    }
    return null;
  }
  private mainRow() {
    const m = this.main, s = this.world.script;
    const guide = this.npcs.find(n => n.role === 'guide');
    const step = m.finaleDone ? 'Chapter complete!' : !m.talkedGuide ? `Talk to ${guide?.name}` : m.bossDefeated ? `Restore the ${s.finaleName}` : m.keys.length < 3 ? `Find ${s.keyLabel}` : `Defeat ${s.bossName}`;
    const collecting = m.talkedGuide && !m.finaleDone && !m.bossDefeated && m.keys.length < 3;
    return { title: this.world.subtitle, step, progress: collecting ? m.keys.length : 0, count: collecting ? 3 : 0 };
  }
  private questRows(): QuestRow[] {
    const rows: QuestRow[] = [];
    for (const q of this.world.quests) {
      const st = this.qs(q.id); if (st.status === 'locked') continue;
      const giver = this.npcs.find(n => n.id === q.giver);
      const to = q.to ? this.npcs.find(n => n.id === q.to) : null;
      const detail = st.status === 'available' ? `${giver?.name} in ${giver?.poiName} has a request.`
        : st.status === 'ready' ? `Return to ${giver?.name} in ${giver?.poiName}.`
          : st.status === 'done' ? 'Complete'
            : q.kind === 'deliver' ? `Bring the ${q.item?.toLowerCase()} to ${to?.name} in ${to?.poiName}.`
              : `${q.summary} (${st.progress}/${q.count})`;
      const target = q.enemy && q.enemy !== 'any' ? `${ENEMY_STATS[q.enemy].name}s defeated` : 'Creatures defeated';
      const goal = st.status === 'available' ? `Talk to ${giver?.name}` : st.status === 'ready' ? `Return to ${giver?.name}` : st.status === 'done' ? 'Complete'
        : q.kind === 'collect' ? `${q.item}` : q.kind === 'slay' ? target : q.kind === 'deliver' ? `Bring the ${q.item?.toLowerCase()} to ${to?.name}` : `Visit ${this.world.pois.find(p => p.id === q.place)?.name}`;
      const counted = st.status === 'active' && (q.kind === 'collect' || q.kind === 'slay');
      rows.push({ id: q.id, title: q.title, giver: giver?.name || '', status: st.status, detail, goal, progress: counted ? st.progress : 0, count: counted ? q.count : 0, xp: Math.round(q.reward.xp * this.world.xpScale), reward: this.rewardText(q), tracked: this.tracked === q.id });
    }
    const order = { ready: 0, active: 1, available: 2, done: 3, locked: 4 };
    return rows.sort((a, b) => order[a.status] - order[b.status]);
  }
  snapshot(): GameSnapshot {
    const near = this.nearest(), h = this.hero, b = this.boss(), p = this.profile;
    let nearName: string | null = null, nearAction: string | null = null;
    if (near?.kind === 'npc') { nearName = near.n.name; nearAction = 'Talk'; }
    else if (near) {
      const o = near.o; nearName = o.name;
      nearAction = ({ key: 'Take', questItem: 'Take', shrine: this.blessed ? 'Pray' : 'Receive blessing', finale: 'Inspect', chest: 'Open', sign: 'Read', lore: 'Read', well: 'Drink', campfire: 'Rest' } as const)[o.kind];
    }
    const chests = this.world.objects.filter(o => o.kind === 'chest'), lore = this.world.objects.filter(o => o.kind === 'lore');
    return {
      levelId: this.world.id, hp: h.hp, maxHp: h.maxHp, mana: Math.round(h.mana), maxMana: h.maxMana, shield: h.shieldTime > 0,
      level: p.level, xp: p.xp, xpNext: xpToNext(p.level),
      spells: SPELL_ORDER.map(id => ({ id, name: SPELLS[id].name, key: SPELLS[id].key, icon: SPELLS[id].icon, unlocked: this.spellUnlocked(id), level: SPELLS[id].level, cooldown: SPELLS[id].cooldown ? h.cds[id] / SPELLS[id].cooldown : 0, cost: SPELLS[id].cost, affordable: h.mana >= SPELLS[id].cost })),
      nearName, nearAction,
      main: this.mainRow(), quests: this.questRows(), defeated: this.defeated, combo: this.combo,
      items: ITEM_ORDER.map(id => ({ id, count: p.items[id] || 0 })),
      buffs: ITEM_ORDER.filter(id => this.buffs[id]).map(id => ({ id, time: this.buffs[id]!, max: ITEMS[id].duration })),
      stats: { regen: h.manaRegen, power: this.power, speed: this.buffs.swiftTonic ? 1.4 : 1, spark: Math.round(10 * this.power), guard: this.buffs.barkskin ? .5 : 0, elapsed: this.elapsed, questsDone: this.world.quests.filter(q => this.qs(q.id).status === 'done').length, totalQuests: this.world.quests.length },
      boss: b && !b.dead && b.aggro ? { name: this.world.script.bossName, title: this.world.script.bossTitle, hp: Math.max(0, b.hp), maxHp: b.maxHp, phase: b.phase } : null,
      discovered: this.discovered.size, totalPlaces: this.world.pois.length, chests: [...this.opened].length, totalChests: chests.length, lore: lore.filter(o => this.read.has(o.id)).length, totalLore: lore.length,
    };
  }
  getObjects() { return this.world.objects.filter(o => this.visibleObject(o)); }
  isOpened(id: string) { return this.opened.has(id); }
  earnedStars() { const done = this.world.quests.filter(q => this.qs(q.id).status === 'done').length, all = this.world.quests.length; return 1 + Number(done >= all / 2) + Number(done === all); }
}
