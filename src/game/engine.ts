import { sfx, type Sfx } from './audio';
import { LEVEL_SPELL, SPELLS, SPELL_ORDER } from './spells';
import { LEVEL_ORDER, WORLDS } from './worlds';
import type { EngineEvent, EnemyKind, EnemySeed, GameSnapshot, LevelId, NoticeTone, Point, QuestFlags, SpellId, WorldDefinition, WorldObject } from './types';

export type Hero = {
  x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; mana: number; maxMana: number; manaRegen: number;
  faceX: number; faceY: number; cds: Record<SpellId, number>; shieldTime: number; hurtTime: number; walkTime: number;
  dashTime: number; dashX: number; dashY: number; castTime: number;
};
export type Enemy = EnemySeed & {
  hp: number; maxHp: number; r: number; dead: boolean; cd: number; windup: number; hitFlash: number;
  kx: number; ky: number; homeX: number; homeY: number; wanderX: number; wanderY: number; wanderT: number;
  aggro: boolean; spawnT: number; phase: number; action: BossAction | null; actionT: number; actionStep: number;
  pattern: number; summons: number; chargeX: number; chargeY: number; lunge: number; angle: number; summoned?: boolean;
};
type BossAction = 'slam' | 'boulders' | 'nova' | 'roots' | 'charge' | 'spiral' | 'meteors' | 'blink';
export type Projectile = { x: number; y: number; vx: number; vy: number; life: number; r: number; damage: number; owner: 'hero' | 'enemy'; kind: 'spark' | 'sunfire' | 'thorn' | 'void'; targetId?: string; crit?: boolean; spin: number };
export type Hazard = { x: number; y: number; r: number; delay: number; maxDelay: number; damage: number; owner: 'hero' | 'enemy'; kind: 'slam' | 'boulder' | 'root' | 'meteor' | 'starfall'; fromX: number; fromY: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'leaf' | 'ember' | 'star' | 'smoke' | 'ring' | 'shard'; rot: number; vr: number; grav: number; drag: number; glow: boolean };
export type Orb = { x: number; y: number; vx: number; vy: number; kind: 'mana' | 'heart'; age: number };
export type Pod = { id: number; x: number; y: number; dead: boolean; hitT: number };
export type FloatText = { x: number; y: number; text: string; life: number; max: number; color: string; size: number };
export type Afterimage = { x: number; y: number; life: number; faceX: number };
export type EngineSave = { version: 2; hero: { x: number; y: number; hp: number; mana: number; maxHp: number; manaRegen: number }; quest: QuestFlags; deadEnemyIds: string[]; brokenPods: number[]; checkpoint: Point; elapsed: number };

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const ENEMY_STATS: Record<EnemyKind, { hp: number; r: number; speed: number; name: string }> = {
  gloomling: { hp: 3, r: 19, speed: 110, name: 'Gloomling' },
  thornling: { hp: 4, r: 22, speed: 60, name: 'Thornling' },
  wisp: { hp: 3, r: 16, speed: 150, name: 'Void wisp' },
  mossback: { hp: 30, r: 46, speed: 70, name: 'Mossback' },
  brambleWarden: { hp: 38, r: 46, speed: 80, name: 'Bramble Warden' },
  hollowStar: { hp: 46, r: 42, speed: 90, name: 'The Hollow Star' },
};
const BOSS_PATTERNS: Record<string, [BossAction[], BossAction[]]> = {
  mossback: [['slam', 'boulders', 'slam', 'boulders'], ['boulders', 'slam', 'boulders', 'slam']],
  brambleWarden: [['nova', 'roots', 'slam'], ['nova', 'charge', 'roots', 'charge', 'slam']],
  hollowStar: [['spiral', 'meteors', 'blink'], ['meteors', 'spiral', 'blink', 'nova', 'meteors']],
};
const blankQuest = (): QuestFlags => ({ talkedGuide: false, keys: [], collected: [], helperDone: false, talkedCourier: false, hasItem: false, courierDone: false, spellLearned: false, bossDefeated: false, finaleDone: false });

export class GameEngine {
  readonly world: WorldDefinition;
  readonly hero: Hero;
  readonly enemies: Enemy[];
  readonly pods: Pod[];
  readonly projectiles: Projectile[] = [];
  readonly hazards: Hazard[] = [];
  readonly particles: Particle[] = [];
  readonly orbs: Orb[] = [];
  readonly floating: FloatText[] = [];
  readonly afterimages: Afterimage[] = [];
  readonly quest: QuestFlags = blankQuest();
  moveX = 0; moveY = 0; elapsed = 0; defeated = 0;
  shake = 0; hitStop = 0; slowMo = 0; damageFlash = 0; respawnFade = 0; flash = 0;
  combo = 0; comboTime = 0;
  private eventHandler: (event: EngineEvent) => void;
  private checkpoint: Point;
  private levelIndex: number;
  private bossIntroShown = false;
  private zoneName = '';
  private completeTimer = 0;
  private fireworkTimer = 0;
  private summonCount = 0;
  private sealedNoticeT = 0;
  private clearThreats = false;

  constructor(levelId: LevelId, onEvent: (event: EngineEvent) => void, saved?: EngineSave | null) {
    this.world = WORLDS[levelId]; this.eventHandler = onEvent; this.checkpoint = { ...this.world.spawn };
    this.levelIndex = LEVEL_ORDER.indexOf(levelId);
    const cds = Object.fromEntries(SPELL_ORDER.map(s => [s, 0])) as Record<SpellId, number>;
    this.hero = { x: this.world.spawn.x, y: this.world.spawn.y, vx: 0, vy: 0, hp: 5, maxHp: 5, mana: 80, maxMana: 100, manaRegen: 3.2, faceX: 1, faceY: 0, cds, shieldTime: 0, hurtTime: 0, walkTime: 0, dashTime: 0, dashX: 0, dashY: 0, castTime: 0 };
    this.enemies = this.world.enemies.map(seed => this.makeEnemy(seed));
    this.pods = this.world.pods.map((p, id) => ({ id, x: p.x, y: p.y, dead: false, hitT: 0 }));
    if (saved?.version === 2) this.restore(saved);
  }

  private makeEnemy(seed: EnemySeed, summoned = false): Enemy {
    const s = ENEMY_STATS[seed.kind];
    return { ...seed, hp: s.hp, maxHp: s.hp, r: s.r, dead: false, cd: rand(1, 2.5), windup: 0, hitFlash: 0, kx: 0, ky: 0, homeX: seed.x, homeY: seed.y, wanderX: seed.x, wanderY: seed.y, wanderT: rand(0, 3), aggro: summoned, spawnT: summoned ? .6 : 0, phase: 1, action: null, actionT: 0, actionStep: 0, pattern: 0, summons: 0, chargeX: 0, chargeY: 0, lunge: 0, angle: 0, summoned };
  }
  setEventHandler(handler: (event: EngineEvent) => void) { this.eventHandler = handler; }

  private restore(saved: EngineSave) {
    const ok = (p: Point) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
    if (ok(saved.hero)) { this.hero.x = clamp(saved.hero.x, 30, this.world.width - 30); this.hero.y = clamp(saved.hero.y, 30, this.world.height - 30); }
    this.hero.maxHp = clamp(Number(saved.hero.maxHp) || 5, 5, 6);
    this.hero.hp = clamp(Number(saved.hero.hp) || this.hero.maxHp, 1, this.hero.maxHp);
    this.hero.mana = clamp(Number(saved.hero.mana) || 0, 0, this.hero.maxMana);
    this.hero.manaRegen = clamp(Number(saved.hero.manaRegen) || 3.2, 3.2, 6);
    this.checkpoint = ok(saved.checkpoint) ? { ...saved.checkpoint } : { ...this.world.spawn };
    if (saved.quest) Object.assign(this.quest, saved.quest);
    this.elapsed = Number(saved.elapsed) || 0;
    const dead = new Set(Array.isArray(saved.deadEnemyIds) ? saved.deadEnemyIds : []);
    for (const e of this.enemies) if (dead.has(e.id)) { e.dead = true; e.hp = 0; this.defeated++; }
    const broken = new Set(Array.isArray(saved.brokenPods) ? saved.brokenPods : []);
    for (const p of this.pods) if (broken.has(p.id)) p.dead = true;
  }
  exportSave(): EngineSave {
    const h = this.hero;
    return { version: 2, hero: { x: h.x, y: h.y, hp: h.hp, mana: h.mana, maxHp: h.maxHp, manaRegen: h.manaRegen }, quest: JSON.parse(JSON.stringify(this.quest)) as QuestFlags, deadEnemyIds: this.enemies.filter(e => e.dead && !e.summoned).map(e => e.id), brokenPods: this.pods.filter(p => p.dead).map(p => p.id), checkpoint: { ...this.checkpoint }, elapsed: this.elapsed };
  }

  // ───────────────────────────── helpers
  private notice(text: string, tone: NoticeTone = 'info') { this.eventHandler({ type: 'notice', text, tone }); }
  private dialogue(o: WorldObject, lines: string[], then?: 'complete') { sfx.play('talk'); this.eventHandler({ type: 'dialogue', speaker: o.name, portrait: o.portrait || '✦', lines, then }); }
  private play(s: Sfx) { sfx.play(s); }
  private boss() { return this.enemies.find(e => e.boss) || null; }
  bossUnlocked() { return this.quest.keys.length >= 3; }
  private canHurt(e: Enemy) { return !e.boss || this.bossUnlocked(); }
  spellUnlocked(id: SpellId) {
    const chapter = SPELLS[id].chapter;
    if (chapter === 0) return true;
    if (chapter - 1 < this.levelIndex) return true;
    return chapter - 1 === this.levelIndex && this.quest.spellLearned;
  }
  addShake(n: number) { this.shake = Math.min(22, this.shake + n); }

  emit(x: number, y: number, count: number, color: string | string[], o: Partial<Particle> & { speed?: number; spread?: number; angle?: number } = {}) {
    const speed = o.speed ?? 160, spread = o.spread ?? Math.PI * 2, base = o.angle ?? 0;
    for (let i = 0; i < count && this.particles.length < 1100; i++) {
      const a = base + (Math.random() - .5) * spread, v = speed * rand(.35, 1), life = (o.life ?? .7) * rand(.6, 1.2);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: (o.size ?? 4) * rand(.6, 1.3), color: Array.isArray(color) ? pick(color) : color, kind: o.kind ?? 'dot', rot: Math.random() * 6.28, vr: rand(-8, 8), grav: o.grav ?? 0, drag: o.drag ?? 2.5, glow: o.glow ?? false });
    }
  }
  private ring(x: number, y: number, size: number, color: string, life = .45) { this.particles.push({ x, y, vx: 0, vy: 0, life, max: life, size, color, kind: 'ring', rot: 0, vr: 0, grav: 0, drag: 0, glow: true }); }
  private text(x: number, y: number, text: string, color: string, size = 16) { this.floating.push({ x: x + rand(-8, 8), y, text, life: .9, max: .9, color, size }); }

  // ───────────────────────────── input
  setMovement(x: number, y: number) {
    const mag = Math.hypot(x, y); if (mag > 1) { x /= mag; y /= mag; }
    this.moveX = x; this.moveY = y;
    if (mag > .08) { this.hero.faceX = x; this.hero.faceY = y; }
  }
  cast(id: SpellId) {
    sfx.unlock();
    if (this.completeTimer > 0) return;
    if (id === 'spark') return this.attack();
    if (id === 'dash') return this.dash();
    const info = SPELLS[id], h = this.hero;
    if (!this.spellUnlocked(id)) { this.play('nope'); this.notice(`${info.name} is not learned yet. Look for this chapter’s shrine.`, 'warn'); return; }
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
    this.projectiles.push({ x: h.x + dx * 26, y: h.y - 14 + dy * 26, vx: dx * 640, vy: dy * 640, life: 1, r: crit ? 9 : 7, damage: crit ? 2 : 1, owner: 'hero', kind: 'spark', targetId: target && 'kind' in target ? target.id : undefined, crit, spin: 0 });
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
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2, v = rand(220, 420);
      this.particles.push({ x: h.x + Math.cos(a) * 20, y: h.y + Math.sin(a) * 20, vx: Math.cos(a + .6) * v, vy: Math.sin(a + .6) * v, life: .8, max: .8, size: rand(5, 9), color: pick(['#8fd46b', '#b9f29d', '#5fae4f', '#e8ffb0']), kind: 'leaf', rot: a, vr: rand(-12, 12), grav: 0, drag: 3.2, glow: false });
    }
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead || !this.canHurt(e) || dist(h, e) > 175 + e.r) continue;
      this.damageEnemy(e, 3); this.knock(e, h, e.boss ? 20 : 260); hits++;
    }
    for (const p of this.pods) if (!p.dead && dist(h, p) < 175) this.breakPod(p);
    this.addShake(hits ? 7 : 4); this.play('leaf');
  }
  private sunfire() {
    const h = this.hero, target = this.nearestTarget(620);
    let dx = h.faceX, dy = h.faceY;
    if (target) { const d = Math.max(1, dist(h, target)); dx = (target.x - h.x) / d; dy = (target.y - h.y) / d; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    this.projectiles.push({ x: h.x + dx * 30, y: h.y - 14 + dy * 30, vx: dx * 470, vy: dy * 470, life: 1.3, r: 14, damage: 4, owner: 'hero', kind: 'sunfire', spin: 0 });
    this.emit(h.x + dx * 30, h.y - 14 + dy * 30, 16, ['#ffd27a', '#ff9a4a', '#fff1b8'], { speed: 180, life: .4, kind: 'ember', glow: true, angle: Math.atan2(dy, dx), spread: 1.4 });
    this.addShake(3); this.play('sunfire');
  }
  private explodeSunfire(x: number, y: number) {
    this.ring(x, y, 105, '#ffb05c', .45); this.ring(x, y, 60, '#fff1b8', .3);
    this.emit(x, y, 40, ['#ffd27a', '#ff9a4a', '#ff6b3d', '#fff1b8'], { speed: 360, life: .7, kind: 'ember', glow: true, size: 5 });
    this.emit(x, y, 12, 'rgba(90,60,50,.5)', { speed: 90, life: 1, kind: 'smoke', size: 16 });
    this.flash = Math.max(this.flash, .25);
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist({ x, y }, e) < 100 + e.r) { this.damageEnemy(e, 4); this.knock(e, { x, y }, e.boss ? 15 : 200); }
    for (const p of this.pods) if (!p.dead && dist({ x, y }, p) < 100) this.breakPod(p);
    this.addShake(9); this.hitStop = .05; this.play('boom');
  }
  private mossShield() {
    const h = this.hero; h.shieldTime = 3;
    this.ring(h.x, h.y, 70, '#9fe8b0', .4);
    this.emit(h.x, h.y, 30, ['#9fe8b0', '#d6ffd9', '#5fae4f'], { speed: 200, life: .6, kind: 'leaf', size: 6 });
    for (const e of this.enemies) if (!e.dead && this.canHurt(e) && dist(h, e) < 110 + e.r) { e.windup = 0; e.cd = Math.max(e.cd, 1.3); this.damageEnemy(e, 1); this.knock(e, h, e.boss ? 10 : 220); }
    this.play('shield');
  }
  private starfall() {
    const h = this.hero;
    const targets = this.enemies.filter(e => !e.dead && this.canHurt(e) && dist(h, e) < 480).sort((a, b) => dist(h, a) - dist(h, b)).slice(0, 5);
    const spots: Point[] = targets.map(t => ({ x: t.x, y: t.y }));
    while (spots.length < 9) { const a = rand(0, 6.28), r = rand(60, 300); spots.push({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r }); }
    spots.forEach((s, i) => { const delay = .35 + i * .12; this.hazards.push({ x: s.x, y: s.y, r: 72, delay, maxDelay: delay, damage: 3, owner: 'hero', kind: 'starfall', fromX: s.x + 260, fromY: s.y - 560 }); });
    this.flash = .3; this.play('starfall');
  }

  // ───────────────────────────── world interaction
  private visibleObject(o: WorldObject) {
    if (o.kind === 'key') return !this.quest.keys.includes(o.id);
    if (o.kind === 'collectible') return !this.quest.collected.includes(o.id);
    if (o.kind === 'item') return !this.quest.hasItem && !this.quest.courierDone;
    return true;
  }
  nearestObject(maxRange = 110) {
    let best: WorldObject | null = null, bestD = maxRange;
    for (const o of this.world.objects) { if (!this.visibleObject(o)) continue; const d = dist(this.hero, o); if (d < bestD) { best = o; bestD = d; } }
    return best;
  }
  npcMarker(o: WorldObject): '!' | '?' | null {
    const q = this.quest;
    if (o.role === 'guide') return !q.talkedGuide || (this.bossUnlocked() && !q.bossDefeated && q.keys.length === 3 && !this.guideReadySeen) ? '!' : null;
    if (o.role === 'helper') return q.helperDone ? null : q.collected.length >= 3 ? '?' : '!';
    if (o.role === 'courier') return q.courierDone ? null : q.hasItem ? '?' : !q.talkedCourier ? '!' : null;
    return null;
  }
  private guideReadySeen = false;
  interact() {
    sfx.unlock();
    if (this.completeTimer > 0) return;
    const o = this.nearestObject();
    if (!o) return;
    const q = this.quest, s = this.world.script, h = this.hero;
    if (o.kind === 'key') {
      q.keys.push(o.id); h.mana = Math.min(h.maxMana, h.mana + 25);
      this.emit(o.x, o.y, 40, [this.world.palette.accent, '#ffffff', '#fff1b8'], { speed: 260, life: 1, kind: 'star', glow: true, size: 5 });
      this.ring(o.x, o.y, 90, this.world.palette.accent, .6); this.flash = .2;
      this.notice(s.pickup.key.replace('{n}', String(q.keys.length)), 'good'); this.play('key');
      if (q.keys.length === 3) window.setTimeout(() => this.notice(`The seal on ${s.bossName} is breaking…`, 'epic'), 1400);
      return;
    }
    if (o.kind === 'collectible') {
      q.collected.push(o.id); this.emit(o.x, o.y, 22, ['#fff49b', '#ffffff', this.world.palette.accent], { speed: 150, life: .8, kind: 'star', glow: true });
      this.notice(s.pickup.collect.replace('{n}', String(q.collected.length)), 'good'); this.play('pickup'); return;
    }
    if (o.kind === 'item') { q.hasItem = true; this.emit(o.x, o.y, 20, ['#fff1b8', '#ffd27a'], { speed: 140, glow: true, kind: 'star' }); this.notice(s.pickup.item, 'good'); this.play('pickup'); return; }
    if (o.kind === 'shrine') {
      this.setCheckpoint();
      if (!q.spellLearned) {
        q.spellLearned = true; h.mana = h.maxMana;
        const spell = LEVEL_SPELL[this.world.id];
        this.emit(o.x, o.y - 20, 70, [SPELLS[spell].color, '#ffffff', '#fff1b8'], { speed: 320, life: 1.3, kind: 'star', glow: true, size: 6 });
        this.ring(o.x, o.y, 160, SPELLS[spell].color, .9); this.flash = .5; this.addShake(6); this.play('learn');
        this.eventHandler({ type: 'spellLearned', spell });
        this.dialogue(o, s.shrine.learn);
      } else this.dialogue(o, s.shrine.again);
      return;
    }
    if (o.kind === 'finale') {
      if (!q.bossDefeated) { this.dialogue(o, this.bossUnlocked() ? s.finale.guarded : s.finale.locked); return; }
      if (q.finaleDone) { this.celebrate(); return; }
      q.finaleDone = true; this.dialogue(o, s.finale.done, 'complete'); return;
    }
    // NPCs
    if (o.role === 'guide') {
      this.setCheckpoint(); q.talkedGuide = true;
      if (this.bossUnlocked()) this.guideReadySeen = true;
      this.dialogue(o, this.bossUnlocked() ? s.guide.ready : s.guide.intro(q.keys.length));
      return;
    }
    if (o.role === 'helper') {
      if (q.collected.length >= 3 && !q.helperDone) {
        q.helperDone = true; h.maxHp = Math.min(6, h.maxHp + 1); h.hp = h.maxHp;
        this.emit(h.x, h.y, 30, ['#ff8c8c', '#ffd1d1', '#ffffff'], { speed: 160, life: 1, kind: 'star', glow: true }); this.play('learn');
        this.dialogue(o, s.helper.thanks);
      } else this.dialogue(o, q.helperDone ? s.helper.done : s.helper.ask);
      return;
    }
    if (o.role === 'courier') {
      q.talkedCourier = true;
      if (q.hasItem && !q.courierDone) {
        q.courierDone = true; q.hasItem = false; h.mana = h.maxMana; h.manaRegen = 5.5;
        this.emit(h.x, h.y, 30, ['#9fd8ff', '#ffffff', '#c9b6ff'], { speed: 160, life: 1, kind: 'star', glow: true }); this.play('learn');
        this.dialogue(o, s.courier.thanks);
      } else this.dialogue(o, q.courierDone ? s.courier.done : s.courier.ask);
    }
  }
  /** Called by the UI once the finale dialogue closes: fireworks, then the chapter ends. */
  celebrate() {
    if (this.completeTimer > 0) return;
    this.completeTimer = 3.2; this.fireworkTimer = 0; this.flash = .8; this.addShake(8); this.play('victory');
    const f = this.world.objects.find(o => o.kind === 'finale');
    if (f) { this.ring(f.x, f.y, 400, this.world.palette.accent, 1.4); this.emit(f.x, f.y - 40, 120, [this.world.palette.accent, '#ffffff', '#fff1b8'], { speed: 520, life: 1.6, kind: 'star', glow: true, size: 6, drag: 1.6 }); }
  }
  get finaleLit() { return this.quest.finaleDone; }

  private nearestTarget(maxRange: number): Enemy | Pod | null {
    let best: Enemy | Pod | null = null, bestD = maxRange;
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0 || !this.canHurt(e)) continue; const d = dist(this.hero, e); if (d < bestD) { best = e; bestD = d; } }
    if (!best) for (const p of this.pods) { if (p.dead) continue; const d = dist(this.hero, p); if (d < Math.min(bestD, 260)) { best = p; bestD = d; } }
    return best;
  }
  private knock(e: Enemy, from: Point, force: number) {
    const dx = e.x - from.x, dy = e.y - from.y, d = Math.max(1, Math.hypot(dx, dy));
    e.kx += dx / d * force; e.ky += dy / d * force;
  }
  private damageEnemy(e: Enemy, amount: number, crit = false) {
    if (e.dead) return;
    if (!this.canHurt(e)) { this.notice(this.world.script.sealed, 'warn'); this.emit(e.x, e.y, 8, '#c9b6ff', { speed: 120, glow: true }); return; }
    e.hp -= amount; e.hitFlash = .14; e.aggro = true;
    this.combo++; this.comboTime = 2.4;
    this.text(e.x, e.y - e.r - 18, crit ? `${amount}!` : `${amount}`, crit ? '#ffd35c' : '#fff3c0', crit ? 24 : 17);
    this.emit(e.x, e.y, crit ? 14 : 8, ['#ffffff', '#fff3c0', this.world.palette.accent], { speed: 200, life: .35, glow: true, size: 3 });
    this.play(crit ? 'crit' : 'hit');
    if (crit) { this.hitStop = Math.max(this.hitStop, .05); this.addShake(3); }
    if (e.hp <= 0) this.killEnemy(e);
  }
  private killEnemy(e: Enemy) {
    e.dead = true; e.action = null; this.defeated += e.summoned ? 0 : 1;
    const colors = e.kind === 'gloomling' ? ['#8c7ce0', '#c9b6ff', '#ffffff'] : e.kind === 'thornling' ? ['#9fd46b', '#e8ffb0', '#5fae4f'] : e.kind === 'wisp' ? ['#8ee8ff', '#c9b6ff', '#ffffff'] : [this.world.palette.accent, '#ffffff', '#ffd27a', '#ff9a4a'];
    this.emit(e.x, e.y, e.boss ? 160 : 26, colors, { speed: e.boss ? 520 : 240, life: e.boss ? 1.8 : .8, kind: 'star', glow: true, size: e.boss ? 7 : 4, drag: 2 });
    this.emit(e.x, e.y, e.boss ? 40 : 10, ['#8fd46b', '#b9f29d', '#f2a1b8'], { speed: 200, life: 1.6, kind: 'leaf', size: 7, grav: 60 });
    this.ring(e.x, e.y, e.boss ? 320 : 70, colors[0], e.boss ? 1 : .4);
    const drops = e.boss ? 14 : e.summoned ? 1 : 3;
    for (let i = 0; i < drops; i++) this.spawnOrb(e.x, e.y, Math.random() < (e.boss ? .3 : .12) ? 'heart' : 'mana');
    if (e.boss) {
      this.quest.bossDefeated = true; this.slowMo = 1.4; this.flash = 1; this.addShake(22); this.play('bossDie');
      for (const other of this.enemies) if (other.summoned && !other.dead) this.killEnemy(other);
      this.clearThreats = true;
      this.notice(`${this.world.script.bossName} is defeated! Go to the ${this.world.script.finaleName}.`, 'epic');
    } else {
      this.hitStop = Math.max(this.hitStop, .04); this.addShake(4); this.play('kill');
      if (!e.summoned) this.notice(`${ENEMY_STATS[e.kind].name} dissolved into leaf-light.`);
    }
  }
  private spawnOrb(x: number, y: number, kind: Orb['kind']) { const a = rand(0, 6.28), v = rand(120, 300); this.orbs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind, age: 0 }); }
  private breakPod(p: Pod) {
    if (p.dead) return;
    p.dead = true;
    this.emit(p.x, p.y, 26, [this.world.palette.pod, '#ffffff', '#fff1b8'], { speed: 240, life: .8, kind: 'shard', glow: true, size: 5, grav: 200 });
    this.ring(p.x, p.y, 50, this.world.palette.pod, .35);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.spawnOrb(p.x, p.y, Math.random() < .22 ? 'heart' : 'mana');
    this.addShake(3); this.play('pod');
  }
  private hurt(amount: number, from: Point) {
    const h = this.hero;
    if (h.hurtTime > 0 || h.dashTime > 0 || this.completeTimer > 0) return;
    if (h.shieldTime > 0) { this.ring(h.x, h.y, 50, '#9fe8b0', .25); this.play('reflect'); return; }
    h.hp -= amount; h.hurtTime = 1.1; this.damageFlash = .35; this.combo = 0;
    const dx = h.x - from.x, dy = h.y - from.y, d = Math.max(1, Math.hypot(dx, dy));
    h.vx += dx / d * 520; h.vy += dy / d * 520;
    this.text(h.x, h.y - 50, `-${amount}`, '#ff8f7a', 20);
    this.emit(h.x, h.y, 18, ['#ff8f7a', '#ffd1ae', '#ffffff'], { speed: 220, life: .5, glow: true });
    this.addShake(10); this.hitStop = .08; this.play('hurt');
    if (h.hp <= 0) this.respawn();
  }
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
    this.notice('Mira rests at the last lantern. Quest progress is safe.', 'warn');
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

    this.updateHero(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateOrbs(dt);
    this.updateParticles(dt);
    this.updateZone();
    if (this.completeTimer > 0) this.updateCelebration(dt);
    if (this.clearThreats) {
      // Deferred so no update loop sees its array change underneath it.
      this.clearThreats = false;
      for (let i = this.hazards.length - 1; i >= 0; i--) if (this.hazards[i].owner === 'enemy') this.hazards.splice(i, 1);
      for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.projectiles[i].owner === 'enemy') this.projectiles.splice(i, 1);
    }
  }
  private updateHero(dt: number) {
    const h = this.hero, speed = 255;
    if (h.dashTime > 0) {
      h.dashTime -= dt; h.vx = h.dashX * 900; h.vy = h.dashY * 900;
      if (Math.random() < .9) this.afterimages.push({ x: h.x, y: h.y, life: .28, faceX: h.faceX });
    } else {
      const k = Math.min(1, dt * 14);
      h.vx += (this.moveX * speed - h.vx) * k; h.vy += (this.moveY * speed - h.vy) * k;
    }
    h.x = clamp(h.x + h.vx * dt, 30, this.world.width - 30); h.y = clamp(h.y + h.vy * dt, 30, this.world.height - 30);
    const moving = Math.hypot(h.vx, h.vy) > 30;
    if (moving) {
      h.walkTime += dt * 10;
      if (Math.random() < dt * 9) this.emit(h.x + rand(-8, 8), h.y + 20, 1, this.world.id === 'summit' ? 'rgba(220,225,255,.5)' : 'rgba(220,200,150,.55)', { speed: 30, life: .5, kind: 'smoke', size: 5, drag: 3 });
    }
    for (const o of this.world.obstacles) this.pushOut(h, o.x, o.y, o.r + 15);
    for (const p of this.pods) if (!p.dead) this.pushOut(h, p.x, p.y, 34);
    for (const pond of this.world.ponds) {
      const dx = (h.x - pond.x) / (pond.r + 10), dy = (h.y - pond.y) / (pond.r * .58 + 10), d = Math.hypot(dx, dy);
      if (d < 1 && d > 0) { h.x = pond.x + dx / d * (pond.r + 10); h.y = pond.y + dy / d * (pond.r * .58 + 10); }
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) { this.afterimages[i].life -= dt; if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1); }
    if (h.shieldTime > 0 && Math.random() < dt * 12) this.emit(h.x + rand(-30, 30), h.y + rand(-30, 20), 1, '#9fe8b0', { speed: 30, life: .7, kind: 'leaf', size: 5, grav: -20 });
  }
  private pushOut(p: Point, x: number, y: number, min: number) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d < min && d > 0) { p.x = x + dx / d * min; p.y = y + dy / d * min; }
  }

  private updateEnemies(dt: number) {
    const h = this.hero;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt); e.lunge = Math.max(0, e.lunge - dt);
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      // knockback
      e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(.004, dt); e.ky *= Math.pow(.004, dt);
      e.x = clamp(e.x, 40, this.world.width - 40); e.y = clamp(e.y, 40, this.world.height - 40);
      if (!e.boss) for (const o of this.world.obstacles) if (Math.abs(o.x - e.x) < 80 && Math.abs(o.y - e.y) < 80) this.pushOut(e, o.x, o.y, o.r + e.r * .8);
      const d = dist(h, e);
      if (e.boss) { this.updateBoss(e, dt, d); continue; }
      if (!e.aggro && d < 380) { e.aggro = true; this.text(e.x, e.y - e.r - 26, '!', '#ffd35c', 22); }
      if (e.aggro && (d > 780 || dist(e, { x: e.homeX, y: e.homeY }) > 900)) e.aggro = false;
      if (!e.aggro) { this.wander(e, dt); continue; }
      e.cd = Math.max(0, e.cd - dt);
      const dx = (h.x - e.x) / Math.max(1, d), dy = (h.y - e.y) / Math.max(1, d), sp = ENEMY_STATS[e.kind].speed;
      if (e.kind === 'gloomling') {
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) { e.lunge = .2; e.kx += dx * 520; e.ky += dy * 520; if (d < 90) this.hurt(1, e); e.cd = 2.2; }
        } else if (e.cd <= 0 && d < 90) e.windup = .55;
        else if (d > 50) { e.x += dx * sp * dt; e.y += dy * sp * dt; }
      } else if (e.kind === 'thornling') {
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) { for (const off of [-.22, 0, .22]) this.enemyShot(e, Math.atan2(dy, dx) + off, 300, 'thorn'); e.cd = 2.4; }
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
        if (Math.random() < dt * 10) this.emit(e.x, e.y + 6, 1, ['#8ee8ff', '#c9b6ff'], { speed: 20, life: .6, glow: true, size: 4, grav: -30 });
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { this.enemyShot(e, Math.atan2(dy, dx), 330, 'void'); e.cd = 1.7; } }
        else if (e.cd <= 0 && d < 420) e.windup = .4;
      }
      if (d < e.r + 16 && e.kind !== 'thornling') this.hurt(1, e);
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
    this.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 2.6, r: kind === 'void' ? 9 : 7, damage: 1, owner: 'enemy', kind, spin: angle });
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
      if (d > 520) return;
      e.aggro = true; e.cd = 1.4;
      if (!this.bossIntroShown) { this.bossIntroShown = true; this.eventHandler({ type: 'bossIntro', name: this.world.script.bossName, title: this.world.script.bossTitle }); this.play('roar'); this.addShake(12); this.ring(e.x, e.y, 260, '#ff8f7a', .8); }
    }
    if (d > 1100) { e.aggro = false; return; }
    const phase = e.hp <= e.maxHp * .5 ? 2 : 1;
    if (phase === 2 && e.phase === 1) { e.phase = 2; this.play('roar'); this.addShake(14); this.flash = .4; this.ring(e.x, e.y, 300, '#ff6b5b', .8); this.notice(`${this.world.script.bossName} is enraged!`, 'epic'); e.action = null; e.cd = .6; }
    // Summons at 70% and 35%.
    const thresholds = [.7, .35];
    if (e.summons < thresholds.length && e.hp <= e.maxHp * thresholds[e.summons]) { e.summons++; this.summonMinions(e); }
    if (Math.random() < dt * 8) this.emit(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r * .5), 1, e.kind === 'hollowStar' ? ['#c9b6ff', '#6a4bd6'] : e.kind === 'brambleWarden' ? ['#b6df91', '#ff8f7a'] : ['#a3c46a', '#e8ffb0'], { speed: 20, life: 1, glow: e.kind === 'hollowStar', size: 4, grav: -40, kind: e.kind === 'hollowStar' ? 'star' : 'leaf' });
    if (d < e.r + 18 && e.action !== 'blink') this.hurt(1, e);
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
      m.hp = m.maxHp = Math.max(2, m.maxHp - 1);
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
    const passed = (t: number) => before > t && e.actionT <= t; // fires once when the timer crosses t
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
    this.ring(e.x, e.y, 80, kind === 'void' ? '#c9b6ff' : '#b6df91', .3); this.addShake(4); this.play('sunfire');
  }
  private addHazard(x: number, y: number, r: number, delay: number, kind: Hazard['kind'], from: Point) {
    this.hazards.push({ x, y, r, delay, maxDelay: delay, damage: 1, owner: 'enemy', kind, fromX: from.x, fromY: from.y });
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
      // trail
      if (Math.random() < .8) {
        if (p.kind === 'sunfire') this.emit(p.x, p.y, 2, ['#ffd27a', '#ff9a4a', '#ff6b3d'], { speed: 50, life: .45, kind: 'ember', glow: true, size: 6 });
        else if (p.kind === 'spark') this.emit(p.x, p.y, 1, p.crit ? '#ffd35c' : '#fff6c4', { speed: 20, life: .25, glow: true, size: 3 });
        else if (p.kind === 'void' && Math.random() < .5) this.emit(p.x, p.y, 1, '#a78bfa', { speed: 15, life: .35, glow: true, size: 3 });
      }
      let hit = false;
      if (p.owner === 'hero') {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || dist(p, e) > e.r + p.r) continue;
          if (p.kind === 'sunfire') this.explodeSunfire(p.x, p.y);
          else { this.damageEnemy(e, p.damage, p.crit); if (!e.boss) this.knock(e, { x: p.x - p.vx, y: p.y - p.vy }, 90); }
          hit = true; break;
        }
        if (!hit) for (const pod of this.pods) {
          if (pod.dead || dist(p, pod) > 26 + p.r) continue;
          if (p.kind === 'sunfire') this.explodeSunfire(p.x, p.y); else this.breakPod(pod);
          hit = true; break;
        }
        if (!hit && p.life <= 0 && p.kind === 'sunfire') this.explodeSunfire(p.x, p.y);
      } else {
        const d = dist(p, { x: h.x, y: h.y - 10 });
        if (h.shieldTime > 0 && d < 46) {
          // Moss Shield reflects: the projectile now belongs to the hero.
          p.owner = 'hero'; p.vx *= -1.35; p.vy *= -1.35; p.life = 1.4; p.damage = 2;
          this.emit(p.x, p.y, 8, '#9fe8b0', { speed: 150, life: .3, glow: true }); this.play('reflect'); continue;
        }
        if (d < p.r + 14) { this.hurt(p.damage, p); hit = true; }
      }
      if (!hit && p.owner === 'enemy') for (const o of this.world.obstacles) if (Math.abs(o.x - p.x) < 50 && Math.abs(o.y - p.y) < 50 && dist(p, o) < o.r) { hit = true; this.emit(p.x, p.y, 5, p.kind === 'void' ? '#a78bfa' : '#9fd46b', { speed: 90, life: .3 }); break; }
      if (hit || p.life <= 0) this.projectiles.splice(i, 1);
    }
  }
  private updateHazards(dt: number) {
    const h = this.hero;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const z = this.hazards[i]; z.delay -= dt;
      if (z.delay > 0) continue;
      this.hazards.splice(i, 1);
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
        this.emit(z.x, z.y, 40, ['#8a6a4a', '#b39a72', '#6f5337'], { speed: 380, life: .7, kind: 'shard', size: 6, grav: 500 });
        this.emit(z.x, z.y, 14, 'rgba(160,140,110,.45)', { speed: 160, life: 1, kind: 'smoke', size: 22 });
        this.addShake(14); this.play('slam'); break;
      case 'boulder':
        this.emit(z.x, z.y, 22, ['#8c8f80', '#b0b3a3', '#6f7568'], { speed: 280, life: .6, kind: 'shard', size: 6, grav: 500 });
        this.emit(z.x, z.y, 6, 'rgba(160,150,120,.45)', { speed: 90, life: .8, kind: 'smoke', size: 16 });
        this.addShake(6); this.play('slam'); break;
      case 'root':
        this.emit(z.x, z.y, 12, ['#6f5337', '#8fd46b', '#553f2d'], { speed: 220, life: .5, kind: 'shard', size: 5, grav: 400, angle: -Math.PI / 2, spread: 1.4 });
        this.addShake(2); this.play('hit'); break;
      case 'meteor':
        this.ring(z.x, z.y, z.r, '#c9b6ff', .4);
        this.emit(z.x, z.y, 26, ['#c9b6ff', '#6a4bd6', '#ffffff'], { speed: 300, life: .6, kind: 'star', glow: true, size: 5 });
        this.addShake(5); this.play('boom'); break;
      case 'starfall':
        this.ring(z.x, z.y, z.r * 1.1, '#fff1b8', .45);
        this.emit(z.x, z.y, 30, ['#fff1b8', '#c9b6ff', '#ffffff', '#ffd35c'], { speed: 340, life: .7, kind: 'star', glow: true, size: 5 });
        this.flash = Math.max(this.flash, .15); this.addShake(5); this.play('boom'); break;
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
        if (o.kind === 'heart') { h.hp = Math.min(h.maxHp, h.hp + 1); this.text(h.x, h.y - 48, '+♥', '#ff9aa8', 18); this.play('pickup'); }
        else { h.mana = Math.min(h.maxMana, h.mana + 7); this.play('orb'); }
        this.emit(h.x, h.y - 10, 6, o.kind === 'heart' ? '#ff9aa8' : '#9fd8ff', { speed: 90, life: .4, glow: true, size: 3 });
        this.orbs.splice(i, 1); continue;
      }
      if (o.age > 16) this.orbs.splice(i, 1);
    }
  }
  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const drag = Math.pow(Math.exp(-p.drag), dt);
      p.vx *= drag; p.vy = p.vy * drag + p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = this.floating.length - 1; i >= 0; i--) { const f = this.floating[i]; f.life -= dt; f.y -= 34 * dt; if (f.life <= 0) this.floating.splice(i, 1); }
    for (const p of this.pods) p.hitT += dt;
  }
  private updateZone() {
    let best = '', bestD = 480;
    for (const z of this.world.zoneLabels) { const d = dist(this.hero, z); if (d < bestD) { best = z.name; bestD = d; } }
    if (best && best !== this.zoneName) { this.zoneName = best; this.eventHandler({ type: 'zone', name: best }); }
  }
  private updateCelebration(dt: number) {
    this.completeTimer -= dt; this.fireworkTimer -= dt;
    const f = this.world.objects.find(o => o.kind === 'finale')!;
    if (this.fireworkTimer <= 0) {
      this.fireworkTimer = .22;
      const x = f.x + rand(-380, 380), y = f.y + rand(-340, 60), c = pick([this.world.palette.accent, '#ff9aa8', '#9fd8ff', '#fff1b8', '#b9f29d', '#c9b6ff']);
      this.emit(x, y, 46, [c, '#ffffff'], { speed: 300, life: 1.3, kind: 'star', glow: true, size: 4, grav: 90, drag: 1.8 }); this.ring(x, y, 70, c, .5); this.play('kill');
    }
    if (this.completeTimer <= 0) { this.completeTimer = 0; this.eventHandler({ type: 'levelComplete', levelId: this.world.id, stats: { stars: this.earnedStars(), time: this.elapsed, defeated: this.defeated, totalEnemies: this.world.enemies.length } }); }
  }

  // ───────────────────────────── UI data
  objectiveTarget(): Point | null {
    const q = this.quest, find = (k: string) => this.world.objects.find(o => o.kind === k || o.role === k) || null;
    if (!q.talkedGuide) return find('guide');
    if (!q.spellLearned) return find('shrine');
    if (q.keys.length < 3) {
      let best: WorldObject | null = null, bd = Infinity;
      for (const o of this.world.objects) if (o.kind === 'key' && !q.keys.includes(o.id)) { const d = dist(this.hero, o); if (d < bd) { bd = d; best = o; } }
      return best;
    }
    if (!q.bossDefeated) { const b = this.boss(); return b && !b.dead ? b : null; }
    return find('finale');
  }
  private questRows() {
    const q = this.quest, s = this.world.script;
    const spellName = SPELLS[LEVEL_SPELL[this.world.id]].name;
    const main = q.finaleDone ? 'Chapter complete!' : !q.talkedGuide ? `Talk to ${this.world.objects.find(o => o.role === 'guide')!.name}` : q.bossDefeated ? `Restore the ${s.finaleName}` : q.keys.length < 3 ? `Find ${s.keyLabel} (${q.keys.length}/3)` : `Defeat ${s.bossName}`;
    return {
      objectives: [this.world.subtitle, main, q.spellLearned ? `${spellName} learned` : `Learn ${spellName} at the shrine`],
      sideQuests: [
        { name: s.collectLabel, status: q.helperDone ? 'Complete · +1 max heart' : q.collected.length >= 3 ? `Return to ${this.world.objects.find(o => o.role === 'helper')!.name}` : `Find ${s.collectLabel.toLowerCase()} (${q.collected.length}/3)`, done: q.helperDone },
        { name: s.itemLabel, status: q.courierDone ? 'Complete · faster mana' : q.hasItem ? 'Return it to Pip' : q.talkedCourier ? 'Search the far fields' : 'Talk to Pip the Courier', done: q.courierDone },
      ],
    };
  }
  snapshot(): GameSnapshot {
    const rows = this.questRows(), near = this.nearestObject(), h = this.hero, b = this.boss();
    const nearAction = !near ? null : near.kind === 'npc' ? 'Talk' : near.kind === 'shrine' ? 'Touch' : near.kind === 'finale' ? 'Inspect' : 'Take';
    return {
      levelId: this.world.id, hp: h.hp, maxHp: h.maxHp, mana: Math.round(h.mana), maxMana: h.maxMana, shield: h.shieldTime > 0,
      spells: SPELL_ORDER.map(id => ({ id, name: SPELLS[id].name, key: SPELLS[id].key, icon: SPELLS[id].icon, unlocked: this.spellUnlocked(id), cooldown: SPELLS[id].cooldown ? h.cds[id] / SPELLS[id].cooldown : 0, cost: SPELLS[id].cost, affordable: h.mana >= SPELLS[id].cost })),
      nearName: near?.name || null, nearAction,
      objectives: rows.objectives, sideQuests: rows.sideQuests, defeated: this.defeated, totalEnemies: this.world.enemies.length, combo: this.combo,
      boss: b && !b.dead && b.aggro ? { name: this.world.script.bossName, title: this.world.script.bossTitle, hp: Math.max(0, b.hp), maxHp: b.maxHp, phase: b.phase } : null,
    };
  }
  getObjects() { return this.world.objects.filter(o => this.visibleObject(o)); }
  earnedStars() { return 1 + Number(this.quest.helperDone) + Number(this.quest.courierDone); }
}
