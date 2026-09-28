import { EXPLORE_CELL, type Critter, type Enemy, type GameEngine, type Hazard, type Npc, type Particle, type Pet, type Trap } from './engine';
import { MOUNTS } from './mounts';
import { TRAILS } from './trails';
import { RARITY, SLOT_ORDER, lookOf, type Look } from './gear';
import { Grid } from './spatial';
import { REGION_W, fbm } from './worldgen';
import type { Captive, Decor, ItemIcon, NpcLook, Obstacle, Palette, Point, Poi, Region, WorldDefinition, WorldObject } from './types';

type AmbientKind = 'petal' | 'leaf' | 'firefly' | 'mote' | 'snow' | 'butterfly' | 'smoke' | 'ash';
type Ambient = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; rot: number; vr: number; kind: AmbientKind; color: string; phase: number };
type Light = { x: number; y: number; r: number; color?: string; a: number };
type View = { x: number; y: number; w: number; h: number };
type Sprite = { c: HTMLCanvasElement; l: number; t: number; w: number; h: number };

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const DISPLAY = 'Cinzel, Georgia, serif';
const UI = 'Nunito, "Trebuchet MS", sans-serif';
const CHUNK = 512;
const BAKED_DECOR = new Set(['pebble', 'clover', 'crop']);
const TALL = new Set(['tree', 'pine', 'house', 'manor', 'windmill', 'tower', 'deadtree', 'mushroom', 'crystal', 'cliff']);
/** Buildings and cliffs don't sway in the wind. */
const STILL = new Set(['house', 'manor', 'tower', 'windmill', 'cliff']);
/** The region a world x position belongs to. */
const regionOf = (world: WorldDefinition, x: number): Region => world.regions[clamp(Math.floor(x / REGION_W), 0, world.regions.length - 1)];

/** Converts '#rrggbb' or 'rgba(...)' to the same colour with a new alpha. */
function alpha(c: string, a: number) {
  if (c.startsWith('#')) {
    const n = c.length === 4 ? c.slice(1).split('').map(x => parseInt(x + x, 16)) : [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    return `rgba(${n[0]},${n[1]},${n[2]},${a})`;
  }
  const m = c.match(/[\d.]+/g); if (!m) return c;
  return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
}
function shade(c: string, f: number) {
  const n = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).map(v => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255));
  return `rgb(${n[0]},${n[1]},${n[2]})`;
}
/** Main quest markers are gold, side quests blue. */
export const MAIN_COLOR = '#ffd35c';
export const SIDE_COLOR = '#6fc3ff';
const tintCache = new Map<string, string>();
/** Blends a '#rrggbb' colour toward angry red as a creature turns aggressive (k = 0…1). */
function enrage(c: string, k: number) {
  if (k < .06) return c;
  const q = Math.round(k * 8) / 8, key = c + q;
  let v = tintCache.get(key);
  if (!v) { const n = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), red = [255, 64, 52], m = q * .6; v = `rgb(${n.map((x, i) => Math.round(x + (red[i] - x) * m)).join(',')})`; tintCache.set(key, v); }
  return v;
}
const glowCache = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string) {
  let c = glowCache.get(color);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, alpha(color, 1)); grad.addColorStop(.25, alpha(color, .55)); grad.addColorStop(1, alpha(color, 0));
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64); glowCache.set(color, c);
  }
  return c;
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 1) {
  if (r <= 0 || a <= 0) return;
  const prevA = ctx.globalAlpha, prevOp = ctx.globalCompositeOperation;
  ctx.globalAlpha = prevA * a; ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prevA; ctx.globalCompositeOperation = prevOp;
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 4, inner = .38, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) { const a = rot + (i / (points * 2)) * TAU - Math.PI / 2, rr = i % 2 ? r * inner : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, rot = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); ctx.fill(); }
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(.1, r), 0, TAU); ctx.fill(); }
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = .25) { ellipse(ctx, x, y, rx, ry, `rgba(12,20,16,${a})`); }
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y + s * .35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * .35, x - s * .45, y - s * 1.05, x, y - s * .45);
  ctx.bezierCurveTo(x + s * .45, y - s * 1.05, x + s * 1.1, y - s * .35, x, y + s * .35); ctx.fill();
}

// ───────────────────────────── static sprites (drawn once, reused every frame)
/** Local-space bounds of a sprite around its anchor (the obstacle position). */
function spriteBounds(o: Obstacle): [number, number, number, number] {
  const r = o.r;
  switch (o.kind) {
    case 'tree': return [-r * 1.7, -r * 2.8, r * 1.9, r * 1.1];
    case 'pine': return [-r * 1.3, -r * 3.2, r * 1.5, r * 1.0];
    case 'deadtree': return [-r * 1.6, -r * 3.2, r * 1.8, r * 1.0];
    case 'mushroom': return [-r * 1.4, -r * 1.8, r * 1.4, r * 1.0];
    case 'house': return [-100, -170, 104, 60];
    case 'manor': return [-134, -240, 138, 66];
    case 'fountain': return [-74, -104, 74, 44];
    case 'barrel': return [-18, -36, 20, 16];
    case 'cart': return [-56, -50, 56, 28];
    case 'bench': return [-38, -32, 38, 14];
    case 'banner': return [-10, -100, 12, 10];
    case 'planter': return [-32, -38, 32, 18];
    case 'cliff': return [-r * 1.45, -r * 2.8, r * 1.5, r * .9];
    case 'windmill': return [-60, -150, 64, 50];
    case 'tower': return [-60, -210, 64, 56];
    case 'tent': return [-54, -70, 58, 36];
    case 'stall': return [-60, -80, 62, 34];
    case 'well': return [-40, -76, 42, 34];
    case 'statue': return [-34, -96, 38, 34];
    case 'pillar': return [-22, -86, 26, 24];
    case 'lamppost': return [-14, -84, 16, 12];
    case 'fence': return o.w! > o.h! ? [-36, -26, 36, 10] : [-10, -44, 10, 40];
    case 'campfire': return [-28, -16, 28, 18];
    case 'log': return [-40, -16, 42, 16];
    default: return [-r * 1.4, -r * 1.6, r * 1.5, r * 1.2];
  }
}

// ───────────────────────────── renderer
export class Renderer {
  private cam = { x: 0, y: 0, ready: false };
  private fox = { x: 0, y: 0, vx: 0, flip: 1 };
  private ambient: Ambient[] = [];
  private lights: Light[] = [];
  private lightCanvas = document.createElement('canvas');
  private shooting = { t: 2, x: 0, y: 0, vx: 0, vy: 0, life: 0 };
  private reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private wind = 1;
  private time = 0;
  private worldRef: WorldDefinition | null = null;
  private chunks = new Map<string, HTMLCanvasElement>();
  private chunkRes = 1;
  private sprites = new Map<string, Sprite>();
  private liveDecor: Grid<Decor> = new Grid(256);
  private bakedDecor: Grid<Decor> = new Grid(256);
  private roadBoxes: Array<{ pts: Point[]; x0: number; y0: number; x1: number; y1: number }> = [];
  private draws: Array<{ y: number; run: () => void }> = [];
  private near: ReturnType<GameEngine['nearest']> = null;
  private lookCache = { key: '-', look: {} as Look };
  /** Screen position (CSS px) just above the nearby person or object, or null when nothing is in reach. */
  nearScreen: Point | null = null;
  /** 1 = full detail, .75 balanced, .5 low (weak tablets): fewer glows, particles and screen effects. */
  quality = 1;
  /** Touch devices have no keyboard, so key hints are left out. */
  touch = false;
  /** Player settings: swaying grass and flowers, weather particles, screen shake. */
  decor: 'full' | 'less' | 'off' = 'full';
  weather = true;
  shake = true;

  private setup(world: WorldDefinition) {
    if (this.worldRef === world) return;
    this.worldRef = world; this.chunks.clear(); this.sprites.clear(); this.ambient = [];
    this.liveDecor = new Grid(256, world.decor.filter(d => !BAKED_DECOR.has(d.kind)));
    this.bakedDecor = new Grid(256, world.decor.filter(d => BAKED_DECOR.has(d.kind)));
    this.roadBoxes = world.roads.map(pts => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      return { pts, x0: x0 - 80, y0: y0 - 80, x1: x1 + 80, y1: y1 + 80 };
    });
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, e: GameEngine, time: number, dt: number, pixelRatio: number) {
    this.time = time;
    const world = e.world, hero = e.hero;
    this.setup(world);
    const scale = w < 640 ? .72 : w < 960 ? .85 : 1;
    const res = clamp(Math.round(pixelRatio * scale * 2) / 2, 1, 2);
    this.chunkRes = res;
    const vw = w / scale, vh = h / scale;
    this.wind = .75 + Math.sin(time * .35) * .35 + Math.sin(time * 1.3) * .1;
    const tx = clamp(hero.x + hero.vx * .28 - vw / 2, 0, Math.max(0, world.width - vw));
    const ty = clamp(hero.y + hero.vy * .28 - vh / 2, 0, Math.max(0, world.height - vh));
    if (!this.cam.ready || Math.hypot(tx - this.cam.x, ty - this.cam.y) > 900) { this.cam.x = tx; this.cam.y = ty; this.cam.ready = true; this.fox.x = hero.x - 40; this.fox.y = hero.y + 10; }
    const k = Math.min(1, dt * 5);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    const shake = this.shake ? e.shake * (this.reduced ? .25 : 1) : 0;
    const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake;
    const camX = this.cam.x, camY = this.cam.y;
    const view: View = { x: camX, y: camY, w: vw, h: vh };
    this.lights = [];
    this.near = e.nearest();

    ctx.save();
    ctx.scale(scale, scale); ctx.translate(-camX + sx, -camY + sy);
    this.drawGround(ctx, e, view);
    this.drawWater(ctx, e, view);
    this.drawDecor(ctx, e, view);
    this.drawPlaceNames(ctx, e, view);
    for (const z of e.hazards) this.drawHazardGround(ctx, z);
    for (const tr of e.traps) this.drawTrap(ctx, tr);
    this.drawChargeLines(ctx, e);

    const draws = this.draws; draws.length = 0;
    const m = 140, x0 = camX - m, x1 = camX + vw + m, y0 = camY - m, y1 = camY + vh + 260;
    const inView = (x: number, y: number) => x > x0 && x < x1 && y > y0 && y < y1;
    for (const o of e.obstacleGrid.rect(x0 - 60, y0, x1 + 60, y1)) draws.push({ y: o.y + (o.h || o.r * .5), run: () => this.drawObstacle(ctx, o, e) });
    for (const o of world.objects) if (inView(o.x, o.y) && o.kind !== 'well' && o.kind !== 'campfire' && o.kind !== 'fountain') { if (e.isVisible(o)) draws.push({ y: o.y + 10, run: () => this.drawObject(ctx, o, e) }); }
    for (const p of e.pods) if (!p.dead && inView(p.x, p.y)) draws.push({ y: p.y + 12, run: () => this.drawPod(ctx, p.x, p.y, e) });
    for (const n of e.npcs) if (inView(n.x, n.y) && e.npcVisible(n)) draws.push({ y: n.y + 22, run: () => this.drawNpc(ctx, n, e) });
    for (const c of e.critters) if (inView(c.x, c.y)) draws.push({ y: c.y + (c.state === 'fly' ? 400 : 6), run: () => this.drawCritter(ctx, c, e) });
    for (const en of e.enemies) if (!en.dead && inView(en.x, en.y)) draws.push({ y: en.y + en.r * .7, run: () => this.drawEnemy(ctx, en, e) });
    // Tuft trots beside Mira; Kael travels alone.
    if (e.hasPet) { this.updateFox(e, dt); draws.push({ y: this.fox.y + 8, run: () => this.drawFox(ctx, e) }); }
    for (const p of e.pets) if (inView(p.x, p.y)) draws.push({ y: p.y + 14, run: () => this.drawPet(ctx, p, e) });
    draws.push({ y: hero.y + 22, run: () => this.drawHeroScaled(ctx, e) });
    // A cosmetic trail sparkles behind a walking hero.
    const trail = e.trail; if (trail && Math.hypot(hero.vx, hero.vy) > 40 && Math.random() < dt * 26) { const T = TRAILS[trail]; e.emit(hero.x - hero.faceX * 10 + rand(-8, 8), hero.y + 12 + rand(-6, 6), 1, T.colors, trail === 'clovers' ? { speed: 20, life: .9, kind: 'leaf', size: 5, grav: -10 } : { speed: 25, life: .8, kind: 'star', glow: true, size: trail === 'sparks' ? 3.5 : 3, grav: -30 }); }
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.run();

    this.drawOrbs(ctx, e);
    this.drawProjectiles(ctx, e);
    this.drawSlashes(ctx, e);
    this.drawSpellMarks(ctx, e);
    for (const z of e.hazards) this.drawHazardAir(ctx, z);
    this.drawParticles(ctx, e.particles);
    if (this.weather) { this.updateAmbient(e, view, dt); this.drawAmbient(ctx); } else this.ambient.length = 0;
    this.drawBubbles(ctx, e, view);
    this.drawLevelTags(ctx, e, view);
    this.drawFloating(ctx, e);
    this.drawArrow(ctx, e, e.mainTarget(), MAIN_COLOR, 0);
    this.drawArrow(ctx, e, e.questTarget(), SIDE_COLOR, 1);
    const rich = this.quality > .5, here = regionOf(world, hero.x), amb = here.ambient;
    if (amb === 'petals' && rich && this.weather) this.drawCloudShadows(ctx, e, view);
    ctx.restore();

    const toScreen = (p: Point) => ({ x: (p.x - camX + sx) * scale, y: (p.y - camY + sy) * scale });
    // Where the touch "Talk" button goes: just above the head of whoever (or whatever) is in reach.
    const nr = this.near;
    if (nr) { const p = nr.kind === 'npc' ? nr.n : nr.o, lift = nr.kind === 'npc' ? (e.npcMarker(nr.n) || nr.n.role === 'merchant' || nr.n.role === 'smith' || nr.n.role === 'armorer' || nr.n.role === 'inn' ? 84 : 58) : nr.o.kind === 'cage' ? 130 : 62; this.nearScreen = { x: (p.x - camX) * scale, y: (p.y - lift - camY) * scale }; }
    else this.nearScreen = null;
    const dark = this.darkAt(world, camX + vw / 2);
    if (dark > .01) this.drawLighting(ctx, w, h, e, toScreen, scale, dark, amb === 'stars' ? '8,8,32' : amb === 'embers' ? '28,10,8' : '6,20,22');
    if (amb === 'leaves' && rich && this.weather) this.drawGodRays(ctx, w, h);
    if (amb === 'stars' && this.weather) this.drawShootingStar(ctx, w, h, dt);
    if (amb === 'petals' && this.quality >= 1 && this.weather) this.drawSunGlow(ctx, w, h);
    this.drawScreenFx(ctx, w, h, e);
    this.drawMinimap(ctx, w, h, e);
  }

  // ───────────────────────────── ground chunks
  private drawGround(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    const c0 = Math.floor(v.x / CHUNK), c1 = Math.floor((v.x + v.w) / CHUNK), r0 = Math.floor(v.y / CHUNK), r1 = Math.floor((v.y + v.h) / CHUNK);
    let baked = 0;
    for (const r of e.world.regions) {
      if (r.x1 < v.x - 20 || r.x0 > v.x + v.w + 20) continue;
      ctx.fillStyle = r.palette.ground; const x0 = Math.max(v.x - 20, r.x0), x1 = Math.min(v.x + v.w + 20, r.x1); ctx.fillRect(x0, v.y - 20, x1 - x0, v.h + 40);
    }
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const key = `${cx},${cy}`;
      let c = this.chunks.get(key);
      if (!c ? baked < 4 : c.width !== Math.ceil(CHUNK * this.chunkRes) && baked < 1) { c = this.bakeChunk(e, cx, cy); baked++; }
      if (c) { ctx.drawImage(c, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK); this.chunks.delete(key); this.chunks.set(key, c); }
    }
    // Pre-bake the ring just outside the view so walking never waits on it.
    if (baked === 0) outer: for (let cy = r0 - 1; cy <= r1 + 1; cy++) for (let cx = c0 - 1; cx <= c1 + 1; cx++) if (!this.chunks.has(`${cx},${cy}`) && cx >= 0 && cy >= 0) { this.bakeChunk(e, cx, cy); break outer; }
    const keep = (c1 - c0 + 3) * (r1 - r0 + 3) + 4;
    while (this.chunks.size > keep) this.chunks.delete(this.chunks.keys().next().value!);
  }
  private bakeChunk(e: GameEngine, cx: number, cy: number) {
    const res = this.chunkRes, world = e.world, ox = cx * CHUNK, oy = cy * CHUNK, region = regionOf(world, ox + 1), p = region.palette;
    const c = document.createElement('canvas'); c.width = c.height = Math.ceil(CHUNK * res);
    const g = c.getContext('2d')!;
    g.scale(res, res); g.translate(-ox, -oy);
    g.fillStyle = p.ground; g.fillRect(ox, oy, CHUNK, CHUNK);
    // Broad colour patches from noise, then small tufts and speckles.
    for (let y = oy - 64; y < oy + CHUNK + 64; y += 64) for (let x = ox - 64; x < ox + CHUNK + 64; x += 64) {
      const n = fbm(x + 777, y, region.chapter * 31);
      if (n > .55) { g.globalAlpha = Math.min(.5, (n - .55) * 2.4); circle(g, x + 32, y + 32, 58, p.alternate); }
      else if (n < .38) { g.globalAlpha = Math.min(.35, (.38 - n) * 2); circle(g, x + 32, y + 32, 58, alpha(p.foliage[0], .6)); }
    }
    g.globalAlpha = 1;
    const G = 96;
    for (let y = Math.floor(oy / G) * G - G; y < oy + CHUNK + G; y += G) for (let x = Math.floor(ox / G) * G - G; x < ox + CHUNK + G; x += G) {
      const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1, m = Math.abs(Math.sin(x * 3.1 + y * 7.7) * 9173.1) % 1;
      g.globalAlpha = .28; ellipse(g, x + 20 + n * 50, y + 24 + m * 40, 26 + n * 16, 12 + m * 8, n > .5 ? p.alternate : alpha(p.foliage[0], .5), n);
      g.globalAlpha = .5; circle(g, x + 10 + m * 70, y + 70 - n * 40, 1.4, alpha(p.foliage[2], .6)); circle(g, x + 60 - n * 30, y + 14 + m * 50, 1.1, 'rgba(255,255,240,.25)');
      g.globalAlpha = 1;
    }
    // Place grounds (plazas, fields, ruined floors).
    for (const poi of world.pois) {
      if (poi.x + poi.r < ox - 50 || poi.x - poi.r > ox + CHUNK + 50 || poi.y + poi.r < oy - 50 || poi.y - poi.r > oy + CHUNK + 50) continue;
      this.bakePlace(g, poi, p);
    }
    // Roads.
    g.lineCap = 'round'; g.lineJoin = 'round';
    const boxes = this.roadBoxes.filter(b => b.x1 > ox && b.x0 < ox + CHUNK && b.y1 > oy && b.y0 < oy + CHUNK);
    const strokeAll = (color: string, width: number) => { g.strokeStyle = color; g.lineWidth = width; for (const b of boxes) { g.beginPath(); b.pts.forEach((pt, i) => i ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y)); g.stroke(); } };
    strokeAll(alpha(p.pathEdge, .45), 100); strokeAll(p.pathEdge, 86); strokeAll(p.path, 70);
    g.setLineDash([2, 38]); strokeAll('rgba(255,255,240,.12)', 30); g.setLineDash([]);
    for (const b of boxes) for (let i = 1; i < b.pts.length; i++) {
      const a = b.pts[i - 1], q = b.pts[i], len = Math.hypot(q.x - a.x, q.y - a.y);
      for (let s = 0; s < len; s += 40) {
        const f = s / len, x = a.x + (q.x - a.x) * f, y = a.y + (q.y - a.y) * f, n = Math.sin(s * 1.7 + i * 11 + x * .01);
        if (x < ox - 40 || x > ox + CHUNK + 40 || y < oy - 40 || y > oy + CHUNK + 40) continue;
        ellipse(g, x + n * 24, y + Math.cos(s + i) * 18, 4 + Math.abs(n) * 4, 2.6 + Math.abs(n) * 2, alpha(p.pathEdge, .7));
        ellipse(g, x + n * 24 - 1, y + Math.cos(s + i) * 18 - 1, 2.6 + Math.abs(n) * 2, 1.4, 'rgba(255,255,240,.25)');
      }
    }
    // Lake beds (the living surface is drawn each frame).
    for (const pond of world.ponds) {
      if (pond.x + pond.r * 1.2 < ox || pond.x - pond.r * 1.2 > ox + CHUNK || pond.y + pond.r < oy || pond.y - pond.r > oy + CHUNK) continue;
      ellipse(g, pond.x + 4, pond.y + 10, pond.r * 1.1, pond.r * .66, 'rgba(20,35,28,.22)');
      ellipse(g, pond.x, pond.y, pond.r * 1.05, pond.r * .62, alpha(p.pathEdge, .9));
      const gr = g.createRadialGradient(pond.x - pond.r * .2, pond.y - pond.r * .15, 5, pond.x, pond.y, pond.r);
      gr.addColorStop(0, p.water); gr.addColorStop(1, p.waterDeep);
      g.fillStyle = gr; g.beginPath(); g.ellipse(pond.x, pond.y, pond.r, pond.r * .58, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(240,250,220,.28)'; g.lineWidth = 3; g.beginPath(); g.ellipse(pond.x, pond.y, pond.r, pond.r * .58, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
    for (const d of this.bakedDecor.rect(ox - 20, oy - 20, ox + CHUNK + 20, oy + CHUNK + 20)) {
      if (d.kind === 'pebble') { ellipse(g, d.x, d.y, 4 + d.seed * 3, 2.5 + d.seed * 1.5, 'rgba(60,60,55,.35)'); ellipse(g, d.x - .5, d.y - 1, 3 + d.seed * 2, 1.6 + d.seed, 'rgba(230,225,210,.35)'); }
      else if (d.kind === 'clover') { for (let i = 0; i < 3; i++) circle(g, d.x + Math.cos(i * 2.1) * 3, d.y + Math.sin(i * 2.1) * 2, 2.6, alpha(p.foliage[2], .8)); if (d.seed > .7) circle(g, d.x, d.y - 4, 2, '#fff'); }
      else { g.strokeStyle = p.foliage[1]; g.lineWidth = 2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(d.x, d.y); g.quadraticCurveTo(d.x + i * 6, d.y - 8, d.x + i * 9, d.y - 12); g.stroke(); } circle(g, d.x, d.y - 12, 3, d.seed > .5 ? '#e0a040' : alpha(d.color, .9)); }
    }
    this.chunks.set(`${cx},${cy}`, c);
    return c;
  }
  private bakePlace(g: CanvasRenderingContext2D, poi: Poi, p: Palette) {
    const { x, y, r } = poi;
    if (poi.kind === 'city') {
      // Paved plaza with a cobbled ring road and radiating streets.
      ellipse(g, x, y, r * .98, r * .76, alpha(p.pathEdge, .22));
      ellipse(g, x, y, r * .5, r * .39, alpha(p.pathEdge, .75)); ellipse(g, x, y, r * .46, r * .36, alpha(p.path, .9));
      g.strokeStyle = alpha(p.pathEdge, .35); g.lineWidth = 2;
      for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(x, y, r * .46 * k / 5, r * .36 * k / 5, 0, 0, TAU); g.stroke(); }
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * r * .1, y + Math.sin(a) * r * .08); g.lineTo(x + Math.cos(a) * r * .46, y + Math.sin(a) * r * .36); g.stroke(); }
      g.strokeStyle = alpha(p.path, .7); g.lineWidth = 46; g.beginPath(); g.ellipse(x, y, r * .72, r * .56, 0, 0, TAU); g.stroke();
      g.strokeStyle = alpha(p.pathEdge, .45); g.lineWidth = 3; g.setLineDash([14, 10]); g.beginPath(); g.ellipse(x, y, r * .72, r * .56, 0, 0, TAU); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 90; i++) { const a = i * 2.4, rr = (i % 9) * r * .05; ellipse(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr * .75, 10, 5, alpha(p.pathEdge, .3)); }
    } else if (poi.kind === 'gate') {
      ellipse(g, x, y, 200, 150, alpha(p.rock, .3));
      for (let i = 0; i < 30; i++) { const a = i * 2.39996, d = Math.sqrt(i / 30) * 170; g.fillStyle = alpha(i % 3 ? p.rock : p.pathEdge, .4); g.fillRect(x + Math.cos(a) * d - 14, y + Math.sin(a) * d * .75 - 9, 28, 18); }
    } else if (poi.kind === 'village' || poi.kind === 'start') {
      ellipse(g, x, y, r * .42, r * .32, alpha(p.pathEdge, .7)); ellipse(g, x, y, r * .38, r * .28, alpha(p.path, .85));
      for (let i = 0; i < 40; i++) { const a = i * 2.4, rr = (i % 7) * r * .05; ellipse(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr * .75, 9, 5, alpha(p.pathEdge, .35)); }
    } else if (poi.kind === 'farm') {
      g.fillStyle = 'rgba(110,80,50,.55)'; g.beginPath(); g.roundRect(x - 230, y - 10, 480, 240, 18); g.fill();
      g.strokeStyle = 'rgba(70,50,30,.45)'; g.lineWidth = 6; for (let row = 0; row < 6; row++) { g.beginPath(); g.moveTo(x - 215, y + 20 + row * 36); g.lineTo(x + 235, y + 20 + row * 36); g.stroke(); }
    } else if (poi.kind === 'ruins' || poi.kind === 'shrine' || poi.kind === 'finale') {
      const rr = poi.kind === 'ruins' ? r * .6 : poi.kind === 'shrine' ? 190 : 360;
      ellipse(g, x, y, rr, rr * .75, alpha(p.rock, .35));
      for (let i = 0; i < 70; i++) { const a = i * 2.39996, d = Math.sqrt(i / 70) * rr; g.fillStyle = alpha(i % 3 ? p.rock : p.pathEdge, .45); g.fillRect(x + Math.cos(a) * d - 14, y + Math.sin(a) * d * .75 - 9, 28, 18); }
    } else if (poi.kind === 'lair') {
      const gr = g.createRadialGradient(x, y, 10, x, y, r); gr.addColorStop(0, 'rgba(30,20,40,.45)'); gr.addColorStop(1, 'rgba(30,20,40,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * .8, 0, 0, TAU); g.fill();
    } else if (poi.kind === 'grove') {
      ellipse(g, x, y, r * .7, r * .55, alpha(p.foliage[2], .25));
      g.strokeStyle = alpha(p.accent, .35); g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, 110, 80, 0, 0, TAU); g.stroke();
    } else if (poi.kind === 'camp') ellipse(g, x, y, 150, 110, 'rgba(90,70,50,.3)');
  }
  /** Darkness at a world x: each region's own, blended over the last stretch before a border. */
  private darkAt(world: WorldDefinition, x: number) {
    const r = regionOf(world, x), band = 900;
    const next = x > r.x1 - band ? world.regions[world.regions.indexOf(r) + 1] : x < r.x0 + band ? world.regions[world.regions.indexOf(r) - 1] : undefined;
    if (!next) return r.darkness;
    const edge = next.x0 >= r.x1 ? r.x1 : r.x0, k = .5 * (1 - Math.abs(x - edge) / band);
    return r.darkness + (next.darkness - r.darkness) * k;
  }
  private drawWater(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    const t = this.time;
    for (const [pi, pond] of e.world.ponds.entries()) {
      if (pond.x + pond.r < v.x - 40 || pond.x - pond.r > v.x + v.w + 40 || pond.y + pond.r < v.y - 40 || pond.y - pond.r > v.y + v.h + 40) continue;
      const reg = regionOf(e.world, pond.x), summit = reg.ambient === 'stars', lava = reg.ambient === 'embers', p = reg.palette;
      ctx.save(); ctx.beginPath(); ctx.ellipse(pond.x, pond.y, pond.r, pond.r * .58, 0, 0, TAU); ctx.clip();
      const bands = Math.min(9, Math.round(pond.r / 45));
      for (let i = 0; i < bands; i++) {
        const yy = pond.y - pond.r * .45 + i * pond.r * .9 / bands, off = Math.sin(t * .8 + i * 1.3 + pi) * pond.r * .25;
        ctx.strokeStyle = `rgba(255,255,255,${.07 + Math.sin(t * 1.4 + i) * .04})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pond.x - pond.r * .45 + off, yy); ctx.quadraticCurveTo(pond.x + off, yy - 5, pond.x + pond.r * .45 + off, yy); ctx.stroke();
      }
      for (let k = 0; k < 3 + Math.floor(pond.r / 120); k++) {
        const ph = (t * .3 + k / 3 + pi * .17) % 1, cx = pond.x + Math.sin(pi * 3 + k * 2.1) * pond.r * .5, cy = pond.y + Math.cos(pi * 2 + k * 1.7) * pond.r * .25;
        ctx.strokeStyle = `rgba(230,250,255,${(1 - ph) * .35})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, 6 + ph * 46, 3 + ph * 20, 0, 0, TAU); ctx.stroke();
      }
      if (lava) {
        // Lava: slow glowing blobs that swell and pop instead of sparkles.
        for (let i = 0; i < 4 + Math.floor(pond.r / 70); i++) {
          const ph = (t * .45 + i * .37 + pi * .21) % 1, x = pond.x + Math.sin(i * 5.1 + pi) * pond.r * .6, y = pond.y + Math.cos(i * 3.3 + pi) * pond.r * .32;
          glow(ctx, x, y, 18 + ph * 26, '#ffd27a', (1 - ph) * .7); circle(ctx, x, y, 3 + ph * 8, `rgba(255,236,170,${(1 - ph) * .8})`);
        }
      } else if (this.quality > .5) for (let i = 0; i < (summit ? 16 : 8); i++) {
        const a = Math.max(0, Math.sin(t * 2.6 + i * 1.9 + pi)), x = pond.x + Math.sin(i * 7.3 + pi) * pond.r * .75, y = pond.y + Math.cos(i * 4.1) * pond.r * .4;
        if (a > .3) { ctx.fillStyle = `rgba(255,255,255,${a * .8})`; star(ctx, x, y, 2 + a * 3); ctx.fill(); }
      }
      ctx.restore();
      if (lava) { this.lights.push({ x: pond.x, y: pond.y, r: pond.r * 1.5, color: '#ff7a3d', a: .9 }); if (Math.random() < .08 * this.quality) this.pushAmbient({ x: pond.x + rand(-pond.r, pond.r) * .7, y: pond.y + rand(-pond.r, pond.r) * .35, vx: rand(-10, 10), vy: rand(-50, -25), life: 1.4, max: 1.4, size: 2.2, rot: 0, vr: 0, kind: 'mote', color: '#ffb347', phase: 0 }); }
      else if (!summit) for (let i = 0; i < 3 + Math.floor(pond.r / 90); i++) {
        const a = i * 1.7 + pi, x = pond.x + Math.cos(a) * pond.r * .62, y = pond.y + Math.sin(a) * pond.r * .32 + Math.sin(t * 1.2 + i) * 2;
        ctx.fillStyle = '#5f9a4c'; ctx.beginPath(); ctx.ellipse(x, y, 13, 7, a, .3, TAU - .1); ctx.lineTo(x, y); ctx.fill();
        if (i % 2 === 0) { circle(ctx, x + 2, y - 2, 3.4, '#f2a1b8'); circle(ctx, x + 2, y - 2, 1.4, '#fff2a1'); }
      }
      if (summit) this.lights.push({ x: pond.x, y: pond.y, r: pond.r * 1.1, color: p.water, a: .5 });
    }
  }
  private drawDecor(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    const t = this.time, hero = e.hero, w = this.wind;
    const list = this.liveDecor.rect(v.x - 30, v.y - 30, v.x + v.w + 30, v.y + v.h + 40);
    if (this.decor === 'off') return;
    const keep = this.decor === 'less' ? .45 : 1;
    for (const d of list) {
      if (d.seed > keep) continue;
      let sway = Math.sin(t * 1.9 + d.x * .013 + d.y * .007) * .2 * w + Math.sin(t * 4.3 + d.seed * 30) * .04;
      const dx = d.x - hero.x, dy = d.y - hero.y;
      if (Math.abs(dx) < 42 && Math.abs(dy) < 28) sway += Math.sign(dx || 1) * (1 - Math.abs(dx) / 42) * .9;
      const reg = regionOf(e.world, d.x), dark = reg.darkness > 0;
      this.drawDecorItem(ctx, d, sway, reg.palette.foliage, t);
      if ((d.kind === 'shroom' || d.kind === 'shard') && dark) this.lights.push({ x: d.x, y: d.y - 6, r: 34, color: d.color, a: .55 + Math.sin(t * 2 + d.seed * 9) * .2 });
    }
  }
  private drawDecorItem(ctx: CanvasRenderingContext2D, d: Decor, sway: number, fol: [string, string, string], t: number) {
    const { x, y } = d;
    if (d.kind === 'grass') {
      ctx.lineCap = 'round'; ctx.lineWidth = 2.2;
      const n = 3 + Math.floor(d.seed * 3);
      for (let i = 0; i < n; i++) {
        const bx = x + (i - n / 2) * 3.5, len = 10 + ((d.seed * 97 + i * 13) % 9), lean = (i - n / 2) * .12 + sway;
        ctx.strokeStyle = i % 2 ? fol[1] : fol[2];
        ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + Math.sin(lean) * len * .4, y - len * .6, bx + Math.sin(lean) * len, y - Math.cos(lean) * len); ctx.stroke();
      }
    } else if (d.kind === 'reed') {
      ctx.lineCap = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#5f7f3f';
      for (let i = 0; i < 3; i++) { const bx = x + (i - 1) * 4, len = 18 + d.seed * 10 + i * 3; ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + sway * 6, y - len * .6, bx + sway * 12, y - len); ctx.stroke(); }
      ellipse(ctx, x + sway * 12, y - 22 - d.seed * 10, 2.4, 6, '#7a5a3a');
    } else if (d.kind === 'flower') {
      const len = 12 + d.seed * 8, hx = x + Math.sin(sway) * len, hy = y - Math.cos(sway) * len;
      ctx.strokeStyle = fol[1]; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - len * .5, hx, hy); ctx.stroke();
      ellipse(ctx, x + 3, y - 4, 4, 1.6, fol[2], -.5);
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t * .3 + d.seed * 9; circle(ctx, hx + Math.cos(a) * 3.2, hy + Math.sin(a) * 3.2, 2.6, d.color); }
      circle(ctx, hx, hy, 1.8, '#fff2a1');
    } else if (d.kind === 'fern') {
      ctx.strokeStyle = fol[1]; ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const a = i * .45 + sway * .6 - Math.PI / 2, len = 16 - Math.abs(i) * 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * len * .6, y + Math.sin(a) * len * .6 - 4, x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
      }
    } else if (d.kind === 'shroom') {
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 1.5, y - 7, 3, 7);
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.ellipse(x + Math.sin(sway) * 2, y - 7, 6, 4, 0, Math.PI, TAU); ctx.fill();
      glow(ctx, x, y - 6, 14, d.color, .25 + Math.sin(t * 2 + d.seed * 9) * .1);
    } else if (d.kind === 'shard') {
      const gl = .6 + Math.sin(t * 2.2 + d.seed * 20) * .3;
      ctx.fillStyle = alpha(d.color, .85); ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 1, y - 12 - d.seed * 6); ctx.lineTo(x + 3, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(x - 1, y - 2); ctx.lineTo(x - 1, y - 10 - d.seed * 5); ctx.lineTo(x + 1, y - 2); ctx.fill();
      glow(ctx, x, y - 6, 16, d.color, .3 * gl);
    }
  }
  private drawPlaceNames(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    ctx.textAlign = 'center'; ctx.font = `700 24px ${DISPLAY}`;
    for (const z of e.world.pois) {
      if (Math.abs(z.x - (v.x + v.w / 2)) > v.w || Math.abs(z.y - (v.y + v.h / 2)) > v.h) continue;
      const y = z.y - z.r * .55;
      ctx.fillStyle = 'rgba(10,20,15,.2)'; ctx.fillText(z.name.toUpperCase(), z.x + 2, y + 2);
      ctx.fillStyle = `rgba(255,250,225,${.3 + Math.sin(this.time * 1.5 + z.x) * .05})`; ctx.fillText(z.name.toUpperCase(), z.x, y);
    }
  }

  // ───────────────────────────── obstacles
  private sprite(o: Obstacle, e: GameEngine): Sprite {
    const rq = Math.round(o.r / 4) * 4, variant = Math.floor(o.seed * 3), res = this.chunkRes, reg = regionOf(e.world, o.x);
    const key = `${reg.id}|${o.kind}|${rq}|${variant}|${o.color || ''}|${o.w || 0}`;
    let s = this.sprites.get(key);
    if (!s) {
      const q: Obstacle = { ...o, x: 0, y: 0, r: rq || o.r, seed: (variant + .5) / 3 };
      const [l, t, r, b] = spriteBounds(q), w = r - l, h = b - t;
      const c = document.createElement('canvas'); c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
      const g = c.getContext('2d')!; g.scale(res, res); g.translate(-l, -t);
      this.paintObstacle(g, q, reg.palette, reg.ambient, reg.darkness > 0);
      s = { c, l, t, w, h }; this.sprites.set(key, s);
    }
    return s;
  }
  private drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, e: GameEngine) {
    const t = this.time, hero = e.hero, s = this.sprite(o, e);
    const sway = TALL.has(o.kind) && !STILL.has(o.kind) ? (Math.sin(t * 1.15 + o.seed * 40) * .6 + Math.sin(t * 2.7 + o.seed * 13) * .25) * this.wind : 0;
    const behind = TALL.has(o.kind) && hero.y < o.y && hero.y > o.y + s.t * .9 && Math.abs(hero.x - o.x) < s.w * .45;
    ctx.globalAlpha = behind ? .5 : 1;
    if (sway) { ctx.save(); ctx.translate(o.x, o.y); ctx.transform(1, 0, sway * .035, 1, 0, 0); ctx.drawImage(s.c, s.l, s.t, s.w, s.h); ctx.restore(); }
    else ctx.drawImage(s.c, o.x + s.l, o.y + s.t, s.w, s.h);
    ctx.globalAlpha = 1;
    // Living parts on top of the cached sprite.
    const reg = regionOf(e.world, o.x), p = reg.palette, dark = reg.darkness > 0;
    switch (o.kind) {
      case 'fountain': {
        // Water arcs from the top bowl into the basin.
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + t * .3, ph = (t * 1.6 + i / 6) % 1, sx = o.x + Math.cos(a) * 10, sy = o.y - 74, ex = o.x + Math.cos(a) * 44, ey = o.y - 14 + Math.sin(a) * 12;
          const qx = sx + (ex - sx) * ph, qy = sy + (ey - sy) * ph - Math.sin(ph * Math.PI) * 26;
          circle(ctx, qx, qy, 2.4, 'rgba(210,240,255,.85)');
        }
        glow(ctx, o.x, o.y - 30, 70, p.water, .25);
        if (Math.random() < .2) this.pushAmbient({ x: o.x + rand(-40, 40), y: o.y - 20, vx: rand(-8, 8), vy: rand(-20, -8), life: 1, max: 1, size: 1.6, rot: 0, vr: 0, kind: 'mote', color: '#dff6ff', phase: 0 });
        if (dark) this.lights.push({ x: o.x, y: o.y - 30, r: 180, color: p.water, a: .7 });
        break;
      }
      case 'banner': {
        const c = o.color || p.roof[0], wave = Math.sin(t * 3 + o.seed * 20) * this.wind;
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(o.x + 3, o.y - 88);
        for (let i = 0; i <= 6; i++) ctx.lineTo(o.x + 3 + i * 5, o.y - 88 + Math.sin(i * .9 + t * 4) * 2 * wave);
        ctx.lineTo(o.x + 33, o.y - 56 + wave * 3); ctx.lineTo(o.x + 18, o.y - 62 + wave * 2); ctx.lineTo(o.x + 3, o.y - 54); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; star(ctx, o.x + 16, o.y - 74, 5, 5, .45); ctx.fill();
        break;
      }
      case 'manor': {
        if (Math.random() < .05 * this.quality) this.pushAmbient({ x: o.x + (o.seed > .5 ? 70 : -70), y: o.y - 226, vx: rand(4, 14) * this.wind, vy: rand(-26, -16), life: 3, max: 3, size: rand(6, 9), rot: 0, vr: 0, kind: 'smoke', color: 'rgba(220,220,225,.35)', phase: 0 });
        if (dark) { for (const wx of [-66, 0, 66]) glow(ctx, o.x + wx, o.y - 100, 24, '#ffcf6e', .55); this.lights.push({ x: o.x, y: o.y - 60, r: 260, color: '#ffcf6e', a: .8 }); }
        break;
      }
      case 'tree': if (Math.random() < .003 * this.wind && !this.reduced) this.spawnLeaf(o.x + rand(-o.r, o.r), o.y - o.r * 1.2, e); break;
      case 'crystal': { const pulse = .7 + Math.sin(t * 1.8 + o.seed * 20) * .3; glow(ctx, o.x, o.y - o.r * .6, o.r * 2.2, p.accent, .35 * pulse); this.lights.push({ x: o.x, y: o.y - o.r * .6, r: o.r * 4, color: p.accent, a: .8 * pulse }); break; }
      case 'mushroom': { const cap = o.seed > .5 ? '#b56ad6' : '#e0735a'; glow(ctx, o.x, o.y - o.r * .9, o.r * 2.4, cap, .3 + Math.sin(t * 2 + o.seed * 9) * .1); this.lights.push({ x: o.x, y: o.y - o.r * .8, r: o.r * 3.4, color: cap, a: .7 }); break; }
      case 'lamppost': { const f = .85 + Math.sin(t * 7 + o.x) * .05; if (dark) glow(ctx, o.x, o.y - 70, 34, '#ffcf6e', f); else glow(ctx, o.x, o.y - 72, 12, '#ffcf6e', .35); if (dark) this.lights.push({ x: o.x, y: o.y - 66, r: 190, color: '#ffcf6e', a: f }); break; }
      case 'campfire': { this.drawFlame(ctx, o.x, o.y - 4, .8, '#ffb347'); this.lights.push({ x: o.x, y: o.y - 20, r: 300, color: '#ffb347', a: .95 + Math.sin(t * 13) * .05 }); break; }
      case 'windmill': {
        ctx.save(); ctx.translate(o.x, o.y - 108); ctx.rotate(t * .8 * this.wind);
        for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); rect(ctx, -3, 0, 6, 78, '#6f5337'); rect(ctx, 3, 14, 16, 60, 'rgba(240,230,210,.92)'); ctx.strokeStyle = 'rgba(111,83,55,.6)'; ctx.lineWidth = 1; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(3, 20 + k * 14); ctx.lineTo(19, 20 + k * 14); ctx.stroke(); } }
        ctx.restore(); circle(ctx, o.x, o.y - 108, 7, '#4a3522'); break;
      }
      case 'house': {
        if (Math.random() < .06 * this.quality) this.pushAmbient({ x: o.x + 44, y: o.y - 150, vx: rand(4, 14) * this.wind, vy: rand(-26, -16), life: 3, max: 3, size: rand(5, 8), rot: 0, vr: 0, kind: 'smoke', color: 'rgba(220,220,225,.35)', phase: 0 });
        if (dark) { for (const wx of [-42, 42]) { glow(ctx, o.x + wx, o.y - 38, 26, '#ffcf6e', .6); } this.lights.push({ x: o.x, y: o.y - 30, r: 200, color: '#ffcf6e', a: .8 }); }
        break;
      }
      case 'tower': if (dark) { glow(ctx, o.x, o.y - 140, 22, '#ffcf6e', .8); this.lights.push({ x: o.x, y: o.y - 130, r: 180, color: '#ffcf6e', a: .8 }); } break;
    }
  }
  /** Draws one obstacle at the origin into a sprite canvas. */
  private paintObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, p: Palette, env: string, dark: boolean) {
    const { x, y, r } = o;
    switch (o.kind) {
      case 'tree': {
        shadow(ctx, x + 8, y + r * .5, r * 1.25, r * .5);
        ctx.fillStyle = p.trunk; ctx.beginPath(); ctx.moveTo(x - r * .2, y + r * .5); ctx.lineTo(x - r * .12, y - r * .5); ctx.lineTo(x + r * .12, y - r * .5); ctx.lineTo(x + r * .22, y + r * .5); ctx.closePath(); ctx.fill();
        rect(ctx, x + r * .02, y - r * .4, r * .08, r * .85, 'rgba(0,0,0,.15)');
        const cx = x, cy = y - r * .95;
        const blobs: Array<[number, number, number]> = [[0, 0, 1], [-.6, .25, .72], [.62, .2, .75], [0, -.55, .74], [-.3, -.35, .6], [.35, -.3, .58]];
        for (const [bx, by, br] of blobs) circle(ctx, cx + bx * r, cy + by * r + 5, br * r, p.foliage[0]);
        for (const [bx, by, br] of blobs) circle(ctx, cx + bx * r * .95, cy + by * r, br * r * .9, p.foliage[1]);
        for (const [bx, by, br] of blobs.slice(3)) circle(ctx, cx + bx * r - r * .12, cy + by * r - r * .15, br * r * .55, alpha(p.foliage[2], .8));
        if (env === 'petals' && o.seed > .6) for (let i = 0; i < 5; i++) circle(ctx, cx + Math.cos(i * 2.4 + o.seed * 10) * r * .7, cy + Math.sin(i * 2.4) * r * .55, 2.6, i % 2 ? '#f7c5d5' : '#fff');
        if (env === 'leaves' && o.seed > .6) for (let i = 0; i < 4; i++) circle(ctx, cx + Math.cos(i * 2.1 + o.seed * 10) * r * .7, cy + Math.sin(i * 2.1) * r * .5, 3, '#e8a54b');
        if (env === 'petals' && o.seed < .2) for (let i = 0; i < 4; i++) circle(ctx, cx + Math.cos(i * 1.9) * r * .6, cy + Math.sin(i * 1.9) * r * .45, 3.4, '#e0525c');
        break;
      }
      case 'pine': {
        shadow(ctx, x + 6, y + r * .5, r * 1.05, r * .42);
        rect(ctx, x - r * .13, y - r * .2, r * .26, r * .7, p.trunk);
        for (let i = 0; i < 4; i++) {
          const ty = y - r * .1 - i * r * .62, wd = r * (1.15 - i * .22);
          ctx.fillStyle = i % 2 ? p.foliage[1] : p.foliage[0];
          ctx.beginPath(); ctx.moveTo(x - wd, ty); ctx.lineTo(x, ty - r * 1.05); ctx.lineTo(x + wd, ty); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(235,240,255,.75)';
          ctx.beginPath(); ctx.moveTo(x - wd * .45, ty - r * .55); ctx.lineTo(x, ty - r * 1.05); ctx.lineTo(x + wd * .45, ty - r * .55); ctx.quadraticCurveTo(x, ty - r * .45, x - wd * .45, ty - r * .55); ctx.fill();
        }
        break;
      }
      case 'deadtree': {
        shadow(ctx, x + 6, y + r * .5, r, r * .4);
        ctx.strokeStyle = shade(p.trunk.startsWith('#') ? p.trunk : '#553f2d', -.2); ctx.lineCap = 'round';
        ctx.lineWidth = r * .32; ctx.beginPath(); ctx.moveTo(x, y + r * .4); ctx.quadraticCurveTo(x - r * .1, y - r, x + r * .1, y - r * 2); ctx.stroke();
        ctx.lineWidth = r * .14;
        for (const [a, l, h] of [[-.9, 1, -1.2], [.8, 1.1, -1.5], [-.5, .8, -2], [.6, .7, -2.3]] as Array<[number, number, number]>) { ctx.beginPath(); ctx.moveTo(x, y + r * h * .8); ctx.quadraticCurveTo(x + Math.sin(a) * r * l * .5, y + r * h - r * .3, x + Math.sin(a) * r * l, y + r * h - r * .6); ctx.stroke(); }
        break;
      }
      case 'stump': shadow(ctx, x + 3, y + 5, r * 1.2, r * .5); ellipse(ctx, x, y, r, r * .55, p.trunk); ellipse(ctx, x, y - 5, r, r * .5, '#c9a06a'); ctx.strokeStyle = 'rgba(90,60,30,.5)'; ctx.lineWidth = 1.2; for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y - 5, r * i / 3, r * i / 6, 0, 0, TAU); ctx.stroke(); } break;
      case 'log': shadow(ctx, x, y + 8, 40, 8); ctx.fillStyle = p.trunk; ctx.beginPath(); ctx.roundRect(x - 34, y - 10, 68, 18, 9); ctx.fill(); ellipse(ctx, x + 34, y - 1, 6, 9, '#c9a06a'); rect(ctx, x - 30, y - 7, 56, 3, 'rgba(255,255,255,.12)'); break;
      case 'bush': {
        shadow(ctx, x + 4, y + r * .45, r * 1.1, r * .4);
        for (let i = 0; i < 5; i++) circle(ctx, x + (i - 2) * r * .36, y - r * .1 + Math.sin(i * 2) * r * .14 - (i === 2 ? r * .25 : 0), r * .5, i % 2 ? p.foliage[1] : p.foliage[0]);
        for (let i = 0; i < 3; i++) circle(ctx, x + (i - 1) * r * .45 - 3, y - r * .35, r * .22, alpha(p.foliage[2], .7));
        if (o.seed > .5) for (let i = 0; i < 5; i++) circle(ctx, x + Math.cos(i * 2.3) * r * .7, y - r * .1 + Math.sin(i * 1.7) * r * .25, 2.6, env === 'petals' ? '#e0525c' : '#9fe3c9');
        break;
      }
      case 'rock': {
        shadow(ctx, x + 6, y + r * .55, r * 1.1, r * .42);
        ctx.fillStyle = p.rock; ctx.beginPath(); ctx.moveTo(x - r, y + r * .3); ctx.lineTo(x - r * .7, y - r * .5); ctx.lineTo(x + r * .05, y - r * .95); ctx.lineTo(x + r * .85, y - r * .4); ctx.lineTo(x + r, y + r * .35); ctx.lineTo(x + r * .3, y + r * .7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(x + r * .05, y - r * .95); ctx.lineTo(x + r * .85, y - r * .4); ctx.lineTo(x + r, y + r * .35); ctx.lineTo(x + r * .3, y + r * .7); ctx.lineTo(x + r * .2, y); ctx.closePath(); ctx.fill();
        ellipse(ctx, x - r * .25, y - r * .55, r * .5, r * .2, env === 'stars' ? 'rgba(240,245,255,.8)' : alpha(p.foliage[2], .75), -.35);
        break;
      }
      case 'crystal': {
        shadow(ctx, x + 4, y + r * .5, r, r * .4);
        for (const [ox, hgt, rot] of [[-.45, .9, -.3], [0, 1.5, 0], [.45, 1.05, .28]] as Array<[number, number, number]>) {
          ctx.save(); ctx.translate(x + ox * r, y + r * .3); ctx.rotate(rot);
          const g = ctx.createLinearGradient(-r * .3, 0, r * .3, 0); g.addColorStop(0, '#8ee8ff'); g.addColorStop(.5, p.accent); g.addColorStop(1, '#5a4bb0');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-r * .28, 0); ctx.lineTo(-r * .22, -r * hgt); ctx.lineTo(0, -r * (hgt + .35)); ctx.lineTo(r * .22, -r * hgt); ctx.lineTo(r * .28, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(-r * .12, -2); ctx.lineTo(-r * .1, -r * hgt); ctx.lineTo(0, -r * (hgt + .3)); ctx.lineTo(0, -2); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'mushroom': {
        shadow(ctx, x + 4, y + r * .5, r * 1.1, r * .4);
        ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.moveTo(x - r * .25, y + r * .5); ctx.quadraticCurveTo(x - r * .15, y - r * .3, x - r * .18, y - r * .7); ctx.lineTo(x + r * .18, y - r * .7); ctx.quadraticCurveTo(x + r * .15, y - r * .3, x + r * .25, y + r * .5); ctx.fill();
        const cap = o.seed > .5 ? '#b56ad6' : '#e0735a';
        ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(x, y - r * .75, r * 1.15, r * .8, 0, Math.PI, TAU); ctx.quadraticCurveTo(x, y - r * .5, x - r * 1.15, y - r * .75); ctx.fill();
        for (let i = 0; i < 5; i++) circle(ctx, x + Math.cos(i * 1.3 + 3.6) * r * .7, y - r * .95 + Math.sin(i * 1.3 + 3.6) * r * .25, r * .12, 'rgba(255,245,220,.85)');
        break;
      }
      case 'house': {
        const roof = o.color || p.roof[0], wall = shade(p.wall, o.seed < .34 ? -.08 : o.seed > .66 ? .05 : 0);
        shadow(ctx, x + 10, y + 36, 96, 22, .3);
        rect(ctx, x - 76, y - 70, 152, 106, wall);
        rect(ctx, x - 76, y - 70, 152, 8, 'rgba(0,0,0,.12)');
        ctx.strokeStyle = 'rgba(90,60,40,.55)'; ctx.lineWidth = 5; ctx.strokeRect(x - 76, y - 70, 152, 106);
        ctx.beginPath(); ctx.moveTo(x - 76, y - 20); ctx.lineTo(x + 76, y - 20); ctx.stroke();
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 20, y - 70); ctx.lineTo(x + s * 20, y + 36); ctx.stroke(); }
        rect(ctx, x - 13, y - 8, 26, 44, '#6f4a30'); circle(ctx, x + 7, y + 14, 2, '#e8c46a'); ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(x, y - 8, 13, Math.PI, TAU); ctx.fill();
        for (const wx of [-48, 48]) { rect(ctx, x + wx - 14, y - 52, 28, 26, '#4a3a2a'); rect(ctx, x + wx - 11, y - 49, 22, 20, dark ? '#ffd88a' : '#9fc8e8'); rect(ctx, x + wx - 1, y - 49, 2, 20, '#4a3a2a'); rect(ctx, x + wx - 11, y - 40, 22, 2, '#4a3a2a'); rect(ctx, x + wx - 16, y - 26, 32, 5, '#8a6a4a'); for (let i = 0; i < 3; i++) circle(ctx, x + wx - 9 + i * 9, y - 27, 3.4, ['#f2a1b8', '#ffd35c', '#c7a6f2'][i]); }
        rect(ctx, x + 34, y - 150, 18, 40, '#8a7a6a'); rect(ctx, x + 32, y - 154, 22, 6, '#6a5a4a');
        ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 96, y - 62); ctx.lineTo(x - 50, y - 142); ctx.lineTo(x + 50, y - 142); ctx.lineTo(x + 96, y - 62); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(x + 20, y - 142); ctx.lineTo(x + 50, y - 142); ctx.lineTo(x + 96, y - 62); ctx.lineTo(x + 50, y - 62); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 2; for (let i = 1; i < 5; i++) { const yy = y - 142 + i * 16, ww = 50 + i * 9.2; ctx.beginPath(); ctx.moveTo(x - ww, yy); ctx.lineTo(x + ww, yy); ctx.stroke(); }
        rect(ctx, x - 98, y - 66, 196, 6, shade(roof.startsWith('#') ? roof : '#8a5a44', -.3));
        break;
      }
      case 'well': {
        shadow(ctx, x + 4, y + 18, 34, 12);
        ellipse(ctx, x, y + 6, 30, 14, '#7d7d72'); ellipse(ctx, x, y, 30, 14, '#9a9a8c'); ellipse(ctx, x, y, 22, 9, '#2a4a5a');
        ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 22, y + Math.sin(a) * 9); ctx.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 14); ctx.stroke(); }
        rect(ctx, x - 28, y - 58, 5, 58, '#6f5337'); rect(ctx, x + 23, y - 58, 5, 58, '#6f5337'); rect(ctx, x - 26, y - 46, 52, 3, '#5a4130');
        ctx.fillStyle = p.roof[0]; ctx.beginPath(); ctx.moveTo(x - 38, y - 54); ctx.lineTo(x, y - 76); ctx.lineTo(x + 38, y - 54); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x, y - 24); ctx.stroke(); rect(ctx, x - 6, y - 26, 12, 10, '#8a6a4a');
        break;
      }
      case 'windmill': {
        shadow(ctx, x + 8, y + 24, 56, 16, .3);
        ctx.fillStyle = p.wall; ctx.beginPath(); ctx.moveTo(x - 40, y + 24); ctx.lineTo(x - 24, y - 100); ctx.lineTo(x + 24, y - 100); ctx.lineTo(x + 40, y + 24); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.moveTo(x + 6, y + 24); ctx.lineTo(x + 8, y - 100); ctx.lineTo(x + 24, y - 100); ctx.lineTo(x + 40, y + 24); ctx.closePath(); ctx.fill();
        ctx.fillStyle = p.roof[1] || p.roof[0]; ctx.beginPath(); ctx.moveTo(x - 30, y - 98); ctx.quadraticCurveTo(x, y - 140, x + 30, y - 98); ctx.closePath(); ctx.fill();
        rect(ctx, x - 10, y - 8, 20, 32, '#6f4a30'); rect(ctx, x - 8, y - 66, 16, 16, '#4a3a2a'); rect(ctx, x - 6, y - 64, 12, 12, dark ? '#ffd88a' : '#9fc8e8');
        break;
      }
      case 'tower': {
        shadow(ctx, x + 8, y + 34, 60, 18, .3);
        ctx.fillStyle = p.rock; ctx.beginPath(); ctx.moveTo(x - 44, y + 34); ctx.lineTo(x - 36, y - 150); ctx.lineTo(x + 36, y - 150); ctx.lineTo(x + 44, y + 34); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(x - 42 + i, y + 20 - i * 22); ctx.lineTo(x + 42 - i, y + 20 - i * 22); ctx.stroke(); }
        rect(ctx, x + 6, y - 150, 30, 184, 'rgba(0,0,0,.12)');
        rect(ctx, x - 12, y - 4, 24, 38, '#4a3a2a'); rect(ctx, x - 8, y - 150, 16, 20, dark ? '#ffd88a' : '#2a2a3a');
        for (let i = -3; i <= 3; i++) rect(ctx, x + i * 11 - 5, y - 166, 9, 14, p.rock);
        ctx.fillStyle = p.roof[0]; ctx.beginPath(); ctx.moveTo(x - 46, y - 164); ctx.lineTo(x, y - 208); ctx.lineTo(x + 46, y - 164); ctx.closePath(); ctx.fill();
        break;
      }
      case 'tent': {
        const c = o.color || '#b86a5a';
        shadow(ctx, x + 6, y + 20, 50, 14);
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 48, y + 22); ctx.lineTo(x, y - 62); ctx.lineTo(x + 48, y + 22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.moveTo(x, y - 62); ctx.lineTo(x + 48, y + 22); ctx.lineTo(x + 14, y + 22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a2020'; ctx.beginPath(); ctx.moveTo(x - 12, y + 22); ctx.lineTo(x, y - 14); ctx.lineTo(x + 12, y + 22); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a4130'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 62); ctx.lineTo(x, y - 70); ctx.stroke();
        break;
      }
      case 'stall': {
        const c = o.color || '#c9803d';
        shadow(ctx, x + 6, y + 22, 56, 12);
        rect(ctx, x - 50, y - 60, 5, 78, '#6f5337'); rect(ctx, x + 45, y - 60, 5, 78, '#6f5337');
        rect(ctx, x - 52, y - 8, 104, 26, '#8a6a4a'); rect(ctx, x - 52, y - 8, 104, 5, '#a8844a');
        for (let i = 0; i < 6; i++) circle(ctx, x - 38 + i * 15, y - 12, 6, ['#e0525c', '#ffd35c', '#9fd46b', '#ff9b73', '#c7a6f2', '#e0525c'][i]);
        for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff4e0' : c; ctx.beginPath(); ctx.moveTo(x - 58 + i * 19.3, y - 58); ctx.lineTo(x - 58 + (i + 1) * 19.3, y - 58); ctx.lineTo(x - 58 + (i + 1) * 19.3, y - 44); ctx.quadraticCurveTo(x - 58 + (i + .5) * 19.3, y - 36, x - 58 + i * 19.3, y - 44); ctx.closePath(); ctx.fill(); }
        rect(ctx, x - 58, y - 76, 116, 20, c);
        break;
      }
      case 'pillar': {
        const broken = o.seed < .4;
        shadow(ctx, x + 4, y + 10, 20, 7);
        const h = broken ? 40 + o.seed * 40 : 76;
        rect(ctx, x - 14, y - h, 28, h + 8, p.rock); rect(ctx, x + 4, y - h, 10, h + 8, 'rgba(0,0,0,.14)');
        rect(ctx, x - 18, y, 36, 10, shade('#8c8f80', -.1));
        if (!broken) rect(ctx, x - 18, y - h - 8, 36, 10, shade('#8c8f80', .05));
        else { ctx.fillStyle = p.rock; ctx.beginPath(); ctx.moveTo(x - 14, y - h); ctx.lineTo(x - 4, y - h - 10); ctx.lineTo(x + 6, y - h - 2); ctx.lineTo(x + 14, y - h - 8); ctx.lineTo(x + 14, y - h); ctx.fill(); }
        ellipse(ctx, x - 6, y - h * .4, 8, 4, alpha(p.foliage[2], .7));
        break;
      }
      case 'statue': {
        shadow(ctx, x + 4, y + 20, 30, 10);
        rect(ctx, x - 26, y - 10, 52, 30, shade('#8c8f80', -.05)); rect(ctx, x - 30, y - 16, 60, 8, '#9a9d8e');
        ctx.fillStyle = '#b0b3a3';
        ctx.beginPath(); ctx.ellipse(x, y - 34, 14, 18, 0, 0, TAU); ctx.fill(); // body of a sitting fox
        ctx.beginPath(); ctx.arc(x + 4, y - 58, 11, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 2, y - 64); ctx.lineTo(x, y - 80); ctx.lineTo(x + 6, y - 66); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 8, y - 66); ctx.lineTo(x + 14, y - 80); ctx.lineTo(x + 14, y - 62); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - 18, y - 20, 16, 7, -.5, 0, TAU); ctx.fill();
        ellipse(ctx, x - 8, y - 40, 6, 10, alpha(p.foliage[2], .5));
        break;
      }
      case 'lamppost': shadow(ctx, x + 2, y + 4, 10, 4); rect(ctx, x - 3, y - 64, 6, 68, '#3a3440'); rect(ctx, x - 7, y - 2, 14, 6, '#3a3440'); rect(ctx, x - 9, y - 80, 18, 16, '#2a2430'); rect(ctx, x - 6, y - 77, 12, 11, '#ffd88a'); ctx.fillStyle = '#2a2430'; ctx.beginPath(); ctx.moveTo(x - 11, y - 80); ctx.lineTo(x, y - 88); ctx.lineTo(x + 11, y - 80); ctx.fill(); break;
      case 'crate': shadow(ctx, x + 3, y + 14, 18, 6); rect(ctx, x - 15, y - 18, 30, 30, '#a0784a'); ctx.strokeStyle = '#6f5337'; ctx.lineWidth = 3; ctx.strokeRect(x - 15, y - 18, 30, 30); ctx.beginPath(); ctx.moveTo(x - 15, y - 18); ctx.lineTo(x + 15, y + 12); ctx.stroke(); rect(ctx, x - 15, y - 18, 30, 5, 'rgba(255,255,255,.15)'); break;
      case 'hay': shadow(ctx, x + 3, y + 14, 22, 7); ellipse(ctx, x, y, 22, 16, '#d9b45a'); ellipse(ctx, x - 16, y, 7, 15, '#e8c870'); ctx.strokeStyle = 'rgba(140,100,40,.6)'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - 12, y + i * 8); ctx.lineTo(x + 20, y + i * 8); ctx.stroke(); } break;
      case 'fence': {
        if (o.w! > o.h!) { for (const px of [-30, 0, 30]) rect(ctx, x + px - 3, y - 22, 6, 26, '#8a6a4a'); rect(ctx, x - 34, y - 18, 68, 4, '#a0784a'); rect(ctx, x - 34, y - 8, 68, 4, '#a0784a'); }
        else { for (const py of [-28, 4, 34]) rect(ctx, x - 3, y + py - 16, 6, 22, '#8a6a4a'); rect(ctx, x - 1, y - 40, 3, 72, '#a0784a'); }
        break;
      }
      case 'campfire': {
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ellipse(ctx, x + Math.cos(a) * 20, y + Math.sin(a) * 10, 7, 5, '#7d7d72'); }
        ctx.strokeStyle = '#5a4130'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 14, y + 4); ctx.lineTo(x + 12, y - 4); ctx.moveTo(x - 12, y - 4); ctx.lineTo(x + 14, y + 4); ctx.stroke();
        break;
      }
      case 'manor': {
        // A two-storey town house with a timber frame, balcony and twin chimneys.
        const roof = o.color || p.roof[0], wall = shade(p.wall, o.seed < .34 ? -.06 : o.seed > .66 ? .04 : 0), beam = 'rgba(90,60,40,.6)';
        shadow(ctx, x + 12, y + 44, 130, 26, .3);
        rect(ctx, x - 110, y - 20, 220, 64, shade(p.rock.startsWith('#') ? p.rock : '#8c8f80', .1));
        for (let i = 0; i < 11; i++) rect(ctx, x - 110 + i * 20 + (i % 2) * 4, y - 20, 1.5, 64, 'rgba(0,0,0,.12)');
        rect(ctx, x - 104, y - 130, 208, 112, wall);
        ctx.strokeStyle = beam; ctx.lineWidth = 5; ctx.strokeRect(x - 104, y - 130, 208, 112);
        for (const bx of [-52, 0, 52]) { ctx.beginPath(); ctx.moveTo(x + bx, y - 130); ctx.lineTo(x + bx, y - 18); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x - 104, y - 74); ctx.lineTo(x + 104, y - 74); ctx.stroke();
        for (const bx of [-78, -26, 26, 78]) for (const by of [-118, -62]) { rect(ctx, x + bx - 13, y + by, 26, 28, '#4a3a2a'); rect(ctx, x + bx - 10, y + by + 3, 20, 22, dark ? '#ffd88a' : '#9fc8e8'); rect(ctx, x + bx - 1, y + by + 3, 2, 22, '#4a3a2a'); }
        rect(ctx, x - 70, y - 70, 140, 6, '#6f5337'); for (let i = 0; i < 9; i++) rect(ctx, x - 66 + i * 16, y - 66, 3, 12, '#6f5337');
        rect(ctx, x - 20, y - 8, 40, 52, '#5a3a24'); ctx.fillStyle = '#4a2e1c'; ctx.beginPath(); ctx.arc(x, y - 8, 20, Math.PI, TAU); ctx.fill(); rect(ctx, x - 1, y - 8, 2, 52, '#3a2416'); circle(ctx, x + 10, y + 20, 2.2, '#e8c46a');
        for (const s of [-1, 1]) { rect(ctx, x + s * 70 - 10, y - 230, 20, 50, '#8a7a6a'); rect(ctx, x + s * 70 - 12, y - 234, 24, 7, '#6a5a4a'); }
        ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 128, y - 122); ctx.lineTo(x - 74, y - 204); ctx.lineTo(x + 74, y - 204); ctx.lineTo(x + 128, y - 122); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(x + 30, y - 204); ctx.lineTo(x + 74, y - 204); ctx.lineTo(x + 128, y - 122); ctx.lineTo(x + 70, y - 122); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 2; for (let i = 1; i < 5; i++) { const yy = y - 204 + i * 16, ww = 74 + i * 10.8; ctx.beginPath(); ctx.moveTo(x - ww, yy); ctx.lineTo(x + ww, yy); ctx.stroke(); }
        rect(ctx, x - 130, y - 126, 260, 7, shade(roof.startsWith('#') ? roof : '#8a5a44', -.3));
        ctx.fillStyle = shade(roof.startsWith('#') ? roof : '#8a5a44', -.15); ctx.beginPath(); ctx.moveTo(x - 22, y - 170); ctx.lineTo(x, y - 196); ctx.lineTo(x + 22, y - 170); ctx.closePath(); ctx.fill();
        rect(ctx, x - 8, y - 186, 16, 14, dark ? '#ffd88a' : '#9fc8e8');
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) circle(ctx, x + s * (40 + i * 14), y + 40, 5, ['#e0525c', '#ffd35c', '#c7a6f2'][i]);
        break;
      }
      case 'fountain': {
        shadow(ctx, x + 6, y + 30, 70, 20, .28);
        ellipse(ctx, x, y + 10, 66, 28, shade(p.rock.startsWith('#') ? p.rock : '#8c8f80', -.1));
        ellipse(ctx, x, y + 4, 66, 28, shade(p.rock.startsWith('#') ? p.rock : '#8c8f80', .15));
        const wg = ctx.createRadialGradient(x - 14, y - 2, 4, x, y + 4, 58); wg.addColorStop(0, p.water); wg.addColorStop(1, p.waterDeep);
        ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(x, y + 4, 56, 22, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 4, 40, 15, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        rect(ctx, x - 8, y - 60, 16, 64, shade(p.rock.startsWith('#') ? p.rock : '#8c8f80', .1)); rect(ctx, x + 2, y - 60, 6, 64, 'rgba(0,0,0,.14)');
        ellipse(ctx, x, y - 62, 30, 10, shade(p.rock.startsWith('#') ? p.rock : '#8c8f80', .2)); ellipse(ctx, x, y - 64, 24, 7, p.water);
        ctx.fillStyle = '#e8e4d8'; ctx.beginPath(); ctx.moveTo(x - 6, y - 66); ctx.quadraticCurveTo(x - 8, y - 90, x, y - 98); ctx.quadraticCurveTo(x + 8, y - 90, x + 6, y - 66); ctx.fill();
        ctx.fillStyle = p.accent; star(ctx, x, y - 98, 7, 5, .45); ctx.fill();
        break;
      }
      case 'barrel': {
        shadow(ctx, x + 3, y + 12, 16, 5);
        ctx.fillStyle = '#8a5a34'; ctx.beginPath(); ctx.moveTo(x - 13, y - 26); ctx.quadraticCurveTo(x - 17, y - 8, x - 13, y + 10); ctx.lineTo(x + 13, y + 10); ctx.quadraticCurveTo(x + 17, y - 8, x + 13, y - 26); ctx.closePath(); ctx.fill();
        rect(ctx, x + 3, y - 26, 8, 36, 'rgba(0,0,0,.15)');
        for (const by of [-20, -8, 4]) rect(ctx, x - 15, by + y, 30, 3, '#4a4a52');
        ellipse(ctx, x, y - 26, 13, 5, '#a8744a'); ellipse(ctx, x, y - 26, 9, 3, '#6f4a2a');
        break;
      }
      case 'cart': {
        shadow(ctx, x + 4, y + 22, 52, 10);
        rect(ctx, x - 44, y - 22, 88, 26, '#8a6a4a'); rect(ctx, x - 44, y - 22, 88, 5, '#a8844a');
        for (let i = 0; i < 5; i++) rect(ctx, x - 40 + i * 20, y - 20, 2, 22, 'rgba(0,0,0,.15)');
        ctx.strokeStyle = '#6f5337'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 44, y - 4); ctx.lineTo(x + 56, y + 6); ctx.stroke();
        if (o.seed > .5) { ellipse(ctx, x - 10, y - 30, 30, 14, '#d9b45a'); ellipse(ctx, x + 14, y - 32, 18, 10, '#e8c870'); }
        else { rect(ctx, x - 34, y - 44, 24, 24, '#a0784a'); rect(ctx, x - 6, y - 40, 20, 20, '#b08a5a'); rect(ctx, x + 18, y - 36, 18, 16, '#a0784a'); }
        for (const wx of [-26, 26]) { circle(ctx, x + wx, y + 8, 14, '#5a4130'); circle(ctx, x + wx, y + 8, 10, '#8a6a4a'); circle(ctx, x + wx, y + 8, 3, '#3a2a1a'); ctx.strokeStyle = '#5a4130'; ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + wx - Math.cos(a) * 10, y + 8 - Math.sin(a) * 10); ctx.lineTo(x + wx + Math.cos(a) * 10, y + 8 + Math.sin(a) * 10); ctx.stroke(); } }
        break;
      }
      case 'bench': {
        shadow(ctx, x + 2, y + 10, 32, 5);
        for (const lx of [-26, 22]) rect(ctx, x + lx, y - 10, 5, 18, '#4a3a2a');
        rect(ctx, x - 32, y - 14, 64, 7, '#8a6a4a'); rect(ctx, x - 32, y - 28, 64, 6, '#8a6a4a'); rect(ctx, x - 30, y - 24, 3, 12, '#6f5337'); rect(ctx, x + 27, y - 24, 3, 12, '#6f5337');
        break;
      }
      case 'banner': {
        shadow(ctx, x + 2, y + 5, 8, 3);
        rect(ctx, x - 2, y - 94, 4, 98, '#4a3a2a'); circle(ctx, x, y - 96, 4, '#c9a44c');
        break;
      }
      case 'planter': {
        shadow(ctx, x + 3, y + 12, 28, 6);
        rect(ctx, x - 26, y - 10, 52, 22, '#8a6a4a'); rect(ctx, x - 26, y - 10, 52, 4, '#a8844a');
        for (let i = 0; i < 7; i++) { const fx = x - 20 + i * 6.6, fy = y - 16 - (i % 2) * 6; ctx.strokeStyle = p.foliage[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, y - 8); ctx.lineTo(fx, fy); ctx.stroke(); circle(ctx, fx, fy - 2, 4, ['#e0525c', '#ffd35c', '#f2a1b8', '#c7a6f2'][i % 4]); }
        break;
      }
      case 'cliff': {
        // Border cliffs: a tall, jagged column of rock with the region's cap (snow, moss or grass).
        const rk = p.rock.startsWith('#') ? p.rock : '#8c8f80', cap = env === 'stars' ? '#eef2ff' : env === 'leaves' ? '#355c3e' : p.foliage[2];
        shadow(ctx, x + 10, y + r * .5, r * 1.3, r * .45, .35);
        ctx.fillStyle = shade(rk, -.25); ctx.beginPath(); ctx.moveTo(x - r * 1.3, y + r * .5); ctx.lineTo(x - r * 1.1, y - r * 1.4); ctx.lineTo(x - r * .5, y - r * 2.6); ctx.lineTo(x + r * .3, y - r * 2.2); ctx.lineTo(x + r * .9, y - r * 2.5); ctx.lineTo(x + r * 1.35, y - r * 1.2); ctx.lineTo(x + r * 1.3, y + r * .55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rk; ctx.beginPath(); ctx.moveTo(x - r * 1.2, y + r * .4); ctx.lineTo(x - r, y - r * 1.3); ctx.lineTo(x - r * .5, y - r * 2.45); ctx.lineTo(x + r * .1, y - r * 2); ctx.lineTo(x + r * .2, y + r * .45); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - r * .9 + i * r * .5, y - r * (1.8 - i * .2)); ctx.lineTo(x - r * .7 + i * r * .45, y + r * .2); ctx.stroke(); }
        ctx.fillStyle = cap; ctx.beginPath(); ctx.moveTo(x - r * .85, y - r * 1.9); ctx.lineTo(x - r * .5, y - r * 2.6); ctx.lineTo(x + r * .3, y - r * 2.2); ctx.lineTo(x + r * .9, y - r * 2.5); ctx.lineTo(x + r * 1.1, y - r * 2); ctx.quadraticCurveTo(x + r * .3, y - r * 1.7, x - r * .85, y - r * 1.9); ctx.fill();
        break;
      }
    }
  }

  // ───────────────────────────── objects
  private drawObject(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const reg = regionOf(e.world, o.x), t = this.time, acc = reg.palette.accent, env = reg.ambient;
    const bob = Math.sin(t * 2.2 + o.x * .03) * 4, x = o.x, y = o.y;
    if (o.kind === 'key') {
      const pg = ctx.createLinearGradient(0, y - 300, 0, y); pg.addColorStop(0, alpha(acc, 0)); pg.addColorStop(1, alpha(acc, .28 + Math.sin(t * 3) * .08));
      ctx.fillStyle = pg; ctx.fillRect(x - 14, y - 300, 28, 300);
      ctx.strokeStyle = alpha(acc, .55); ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.ellipse(x, y + 16, 34 + Math.sin(t * 3) * 3, 13, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      shadow(ctx, x, y + 16, 18, 6, .3);
      glow(ctx, x, y - 12 + bob, 60, acc, .55);
      const yy = y - 16 + bob;
      if (env === 'petals') {
        const sq = Math.cos(t * 2); ctx.save(); ctx.translate(x, yy); ctx.scale(Math.max(.25, Math.abs(sq)), 1);
        ctx.fillStyle = '#f5d266'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(15, -4); ctx.lineTo(0, 22); ctx.lineTo(-15, -4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = sq > 0 ? '#fff6c4' : '#d9a93f'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(15, -4); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (env === 'leaves') {
        circle(ctx, x, yy, 17, '#6f7568'); circle(ctx, x - 3, yy - 3, 14, '#8c917f');
        ctx.strokeStyle = `rgba(173,240,212,${.7 + Math.sin(t * 4) * .3})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 6, yy - 8); ctx.lineTo(x + 2, yy); ctx.lineTo(x - 5, yy + 7); ctx.moveTo(x + 5, yy - 9); ctx.lineTo(x + 5, yy + 9); ctx.stroke();
      } else { ctx.fillStyle = '#fff6ff'; star(ctx, x, yy, 20, 5, .45, t * .8); ctx.fill(); ctx.fillStyle = acc; star(ctx, x, yy, 12, 5, .45, t * .8); ctx.fill(); }
      for (let i = 0; i < 3; i++) { const a = t * 2 + i * TAU / 3; circle(ctx, x + Math.cos(a) * 28, yy + Math.sin(a) * 10, 2.4, '#fff'); glow(ctx, x + Math.cos(a) * 28, yy + Math.sin(a) * 10, 8, acc, .8); }
      this.lights.push({ x, y: yy, r: 170, color: acc, a: 1 });
    } else if (o.kind === 'questItem') this.drawQuestItem(ctx, o, t);
    else if (o.kind === 'chest') {
      const open = e.isOpened(o.id);
      shadow(ctx, x, y + 14, 24, 7, .3);
      if (!open) glow(ctx, x, y - 6, 40, '#ffd35c', .35 + Math.sin(t * 3 + x) * .12);
      rect(ctx, x - 20, y - 14, 40, 26, '#8a5a34'); rect(ctx, x - 20, y - 14, 40, 4, '#a8744a');
      ctx.strokeStyle = '#c9a44c'; ctx.lineWidth = 3; ctx.strokeRect(x - 20, y - 14, 40, 26);
      if (open) { ctx.fillStyle = '#6f4a2a'; ctx.beginPath(); ctx.moveTo(x - 20, y - 14); ctx.lineTo(x - 16, y - 34); ctx.lineTo(x + 24, y - 34); ctx.lineTo(x + 20, y - 14); ctx.fill(); ellipse(ctx, x, y - 14, 18, 4, '#2a1a10'); }
      else { ctx.fillStyle = '#9a6a3e'; ctx.beginPath(); ctx.moveTo(x - 20, y - 14); ctx.quadraticCurveTo(x, y - 30, x + 20, y - 14); ctx.fill(); ctx.stroke(); rect(ctx, x - 4, y - 16, 8, 10, '#e8c46a'); if (Math.sin(t * 3 + x) > .85) { ctx.fillStyle = '#fff'; star(ctx, x + 14, y - 22, 5, 4, .3, t); ctx.fill(); } this.lights.push({ x, y: y - 6, r: 80, color: '#ffd35c', a: .6 }); }
    } else if (o.kind === 'sign') {
      shadow(ctx, x + 2, y + 6, 14, 5);
      rect(ctx, x - 3, y - 44, 6, 50, '#6f5337');
      ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.moveTo(x - 26, y - 44); ctx.lineTo(x + 20, y - 44); ctx.lineTo(x + 28, y - 36); ctx.lineTo(x + 20, y - 28); ctx.lineTo(x - 26, y - 28); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.moveTo(x + 22, y - 24); ctx.lineTo(x - 20, y - 24); ctx.lineTo(x - 28, y - 16); ctx.lineTo(x - 20, y - 8); ctx.lineTo(x + 22, y - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(60,40,20,.55)'; ctx.fillRect(x - 18, y - 38, 30, 2.5); ctx.fillRect(x - 14, y - 18, 30, 2.5);
    } else if (o.kind === 'lore') {
      const readIt = e.read.has(o.id);
      shadow(ctx, x + 3, y + 10, 22, 7);
      ctx.fillStyle = reg.palette.rock; ctx.beginPath(); ctx.moveTo(x - 18, y + 10); ctx.lineTo(x - 16, y - 30); ctx.quadraticCurveTo(x, y - 46, x + 16, y - 30); ctx.lineTo(x + 18, y + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x + 6, y - 34, 12, 44);
      const g = readIt ? .35 : .7 + Math.sin(t * 2.5 + x) * .3;
      ctx.strokeStyle = alpha(acc, g); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 8, y - 26); ctx.lineTo(x - 2, y - 18); ctx.lineTo(x - 8, y - 10); ctx.moveTo(x + 4, y - 28); ctx.lineTo(x + 4, y - 4); ctx.moveTo(x - 8, y + 0); ctx.lineTo(x + 8, y + 0); ctx.stroke();
      glow(ctx, x, y - 16, 34, acc, .35 * g); this.lights.push({ x, y: y - 16, r: 90, color: acc, a: .6 * g });
    } else if (o.kind === 'crack') this.drawCrack(ctx, o, e);
    else if (o.kind === 'waterfall') this.drawWaterfall(ctx, o, e);
    else if (o.kind === 'shrine') this.drawShrine(ctx, o, e);
    else if (o.kind === 'finale') this.drawFinale(ctx, o, e);
    else if (o.kind === 'cage') this.drawCage(ctx, o, e);
    const near = this.near; if (near?.kind === 'object' && near.o === o) this.label(ctx, x, y + 44, o.name, acc);
  }
  /** A cracked stone wall with faint light in its cracks; once a bomb breaks it, a heap of rubble. */
  private drawCrack(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const reg = regionOf(e.world, o.x), rock = reg.palette.rock, x = o.x, y = o.y, t = this.time;
    if (e.secretFound(o.id)) {
      shadow(ctx, x, y + 6, 58, 12, .22);
      for (let i = 0; i < 9; i++) { const a = i * 2.3 + o.x * .01, rx = x + Math.cos(a) * (18 + i * 5), ry = y + 2 + Math.sin(a) * 8; ellipse(ctx, rx, ry, 9 - i * .4, 6 - i * .3, i % 2 ? shade(rock, -.2) : rock, a); }
      return;
    }
    shadow(ctx, x, y + 8, 64, 12, .3);
    ctx.fillStyle = shade(rock, -.12); ctx.beginPath(); ctx.moveTo(x - 62, y + 8); ctx.lineTo(x - 58, y - 52); ctx.lineTo(x - 30, y - 70); ctx.lineTo(x + 8, y - 64); ctx.lineTo(x + 40, y - 74); ctx.lineTo(x + 60, y - 50); ctx.lineTo(x + 64, y + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(x - 56, y + 4); ctx.lineTo(x - 52, y - 48); ctx.lineTo(x - 28, y - 62); ctx.lineTo(x + 6, y - 56); ctx.lineTo(x + 38, y - 66); ctx.lineTo(x + 54, y - 46); ctx.lineTo(x + 58, y + 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5; for (const yy of [-40, -20]) { ctx.beginPath(); ctx.moveTo(x - 50, y + yy); ctx.lineTo(x + 54, y + yy + 3); ctx.stroke(); }
    // The cracks, glowing faintly: something is behind.
    const g = .45 + Math.sin(t * 2.4 + x) * .25;
    ctx.strokeStyle = `rgba(20,14,10,.8)`; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 6, y - 58); ctx.lineTo(x + 2, y - 40); ctx.lineTo(x - 8, y - 26); ctx.lineTo(x + 6, y - 10); ctx.lineTo(x - 2, y + 2); ctx.moveTo(x + 2, y - 40); ctx.lineTo(x + 22, y - 34); ctx.moveTo(x - 8, y - 26); ctx.lineTo(x - 28, y - 20); ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,170,${g})`; ctx.lineWidth = 1; ctx.stroke();
    glow(ctx, x, y - 30, 36, '#ffe9a8', g * .35);
    if (Math.random() < .03) this.pushAmbient({ x: x + rand(-20, 20), y: y - rand(10, 50), vx: rand(-6, 6), vy: rand(-20, -8), life: .9, max: .9, size: 1.6, rot: 0, vr: 0, kind: 'mote', color: '#fff1b8', phase: 0 });
  }
  /** A waterfall (a lava fall in the Ember Wastes) pouring off a rock face into the lake; once explored, the cave behind shows. */
  private drawWaterfall(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const reg = regionOf(e.world, o.x), lava = reg.ground === 'ash', x = o.x, y = o.y, t = this.time, found = e.secretFound(o.id);
    const rock = reg.palette.rock, wc = lava ? ['#ff9a3d', '#ffd27a', '#ff5f3d'] : ['#9fd8ff', '#e6f7ff', '#6fb8e8'];
    // Rock face.
    ctx.fillStyle = shade(rock, -.25); ctx.beginPath(); ctx.moveTo(x - 90, y + 20); ctx.lineTo(x - 84, y - 150); ctx.quadraticCurveTo(x, y - 190, x + 84, y - 150); ctx.lineTo(x + 90, y + 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(x - 80, y + 10); ctx.lineTo(x - 74, y - 140); ctx.quadraticCurveTo(x, y - 176, x + 74, y - 140); ctx.lineTo(x + 80, y + 10); ctx.closePath(); ctx.fill();
    // The cave mouth, dark behind the falling sheet.
    ctx.fillStyle = found ? 'rgba(10,8,14,.95)' : 'rgba(10,8,14,.45)'; ctx.beginPath(); ctx.moveTo(x - 30, y + 10); ctx.lineTo(x - 30, y - 60); ctx.quadraticCurveTo(x, y - 96, x + 30, y - 60); ctx.lineTo(x + 30, y + 10); ctx.closePath(); ctx.fill();
    // Falling sheet, with bright streaks running down.
    const top = y - 150, gw = 46, part = found ? 1 : 0;
    const sheet = (x0: number, x1: number) => { const gr = ctx.createLinearGradient(0, top, 0, y + 20); gr.addColorStop(0, alpha(wc[0], .85)); gr.addColorStop(1, alpha(wc[2], .6)); ctx.fillStyle = gr; ctx.fillRect(x0, top, x1 - x0, y + 20 - top); };
    if (part) { sheet(x - gw, x - 22); sheet(x + 22, x + gw); } else sheet(x - gw, x + gw);
    ctx.save(); ctx.beginPath(); ctx.rect(x - gw, top, gw * 2, y + 20 - top); ctx.clip();
    for (let i = 0; i < 9; i++) { const sx = x - gw + 6 + i * 10.5; if (part && Math.abs(sx - x) < 22) continue; const off = ((t * (lava ? 90 : 220) + i * 37) % 80); ctx.fillStyle = alpha(wc[1], .7); for (let k = -1; k < 3; k++) ctx.fillRect(sx, top + off + k * 80, 2, 34); }
    ctx.restore();
    // Foam or spatter where it lands, and drifting mist.
    for (let i = 0; i < 6; i++) { const a = t * 3 + i; ellipse(ctx, x - gw + i * 18 + Math.sin(a) * 3, y + 22 + Math.sin(a * 1.3) * 2, 12, 5, alpha(wc[1], .6)); }
    if (Math.random() < .25) this.pushAmbient({ x: x + rand(-50, 50), y: y + 18, vx: rand(-10, 10), vy: rand(-26, -8), life: 1.2, max: 1.2, size: lava ? 2 : 3, rot: 0, vr: 0, kind: 'mote', color: lava ? '#ffb347' : '#e6f7ff', phase: 0 });
    glow(ctx, x, y - 60, 90, wc[0], lava ? .35 : .18);
    this.lights.push({ x, y: y - 50, r: lava ? 260 : 150, color: wc[0], a: lava ? .9 : .5 });
  }
  private label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, acc: string) {
    // Phones keep the view clear: the prompt already says what can be done, and dialogue shows who is talking.
    if (this.touch) return;
    ctx.font = `800 13px ${UI}`; ctx.textAlign = 'center';
    const wdt = ctx.measureText(text).width + 22;
    ctx.fillStyle = 'rgba(14,20,30,.78)'; ctx.beginPath(); ctx.roundRect(x - wdt / 2, y - 15, wdt, 24, 12); ctx.fill();
    ctx.strokeStyle = alpha(acc, .7); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff7df'; ctx.fillText(text, x, y + 2);
  }
  private drawQuestItem(ctx: CanvasRenderingContext2D, o: WorldObject, t: number) {
    const x = o.x, y = o.y, bob = Math.sin(t * 2.4 + x) * 4, icon: ItemIcon = o.icon || 'bundle';
    const col = icon === 'bug' ? '#fff49b' : icon === 'gem' ? '#c9b6ff' : icon === 'herb' || icon === 'flower' ? '#b9f29d' : '#fff1b8';
    const pg = ctx.createLinearGradient(0, y - 140, 0, y); pg.addColorStop(0, alpha(col, 0)); pg.addColorStop(1, alpha(col, .22));
    ctx.fillStyle = pg; ctx.fillRect(x - 8, y - 140, 16, 140);
    shadow(ctx, x, y + 10, 12, 4, .2);
    glow(ctx, x, y - 10 + bob, 32, col, .7);
    const yy = y - 10 + bob;
    switch (icon) {
      case 'bug': { const fx = x + Math.sin(t * 1.3 + x) * 14, fy = yy - 8 + Math.sin(t * 2.6 + x) * 8, flap = Math.abs(Math.sin(t * 20)); ctx.fillStyle = alpha(col, .6); ctx.beginPath(); ctx.ellipse(fx - 5, fy - 2, 7 * flap + 1, 5, -.5, 0, TAU); ctx.ellipse(fx + 5, fy - 2, 7 * flap + 1, 5, .5, 0, TAU); ctx.fill(); circle(ctx, fx, fy, 4, '#fff8d0'); circle(ctx, fx, fy + 4, 3, col); this.lights.push({ x: fx, y: fy, r: 90, color: col, a: .9 }); return; }
      case 'herb': ctx.strokeStyle = '#5fae4f'; ctx.lineWidth = 2.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x, yy + 10); ctx.quadraticCurveTo(x + i * 8, yy, x + i * 10, yy - 10); ctx.stroke(); ellipse(ctx, x + i * 10, yy - 10, 5, 3, '#9fd46b', i); } circle(ctx, x, yy - 12, 3.5, '#ffd35c'); break;
      case 'flower': for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t; ellipse(ctx, x + Math.cos(a) * 6, yy + Math.sin(a) * 6, 5, 3, '#e8f4ff', a); } circle(ctx, x, yy, 3.5, '#8ee8ff'); break;
      case 'mushroom': rect(ctx, x - 3, yy - 4, 6, 12, '#efe4c8'); ctx.fillStyle = '#e0735a'; ctx.beginPath(); ctx.ellipse(x, yy - 4, 12, 9, 0, Math.PI, TAU); ctx.fill(); circle(ctx, x - 4, yy - 8, 2, '#fff'); circle(ctx, x + 4, yy - 9, 1.6, '#fff'); break;
      case 'gem': ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, yy - 14); ctx.lineTo(x + 10, yy - 2); ctx.lineTo(x, yy + 12); ctx.lineTo(x - 10, yy - 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(x, yy - 14); ctx.lineTo(x - 10, yy - 2); ctx.lineTo(x, yy); ctx.fill(); break;
      case 'feather': ctx.save(); ctx.translate(x, yy); ctx.rotate(-.6 + Math.sin(t * 2) * .2); ellipse(ctx, 0, 0, 5, 14, '#c8c8d0'); ctx.strokeStyle = '#8a8a9a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, -14); ctx.stroke(); ctx.restore(); break;
      case 'toy': ctx.fillStyle = '#d98a50'; ctx.beginPath(); ctx.ellipse(x, yy, 11, 7, 0, 0, TAU); ctx.fill(); circle(ctx, x + 9, yy - 5, 5, '#d98a50'); ctx.beginPath(); ctx.moveTo(x + 7, yy - 9); ctx.lineTo(x + 8, yy - 15); ctx.lineTo(x + 11, yy - 9); ctx.fill(); ellipse(ctx, x - 12, yy - 2, 6, 3, '#e0525c', -.4); break;
      case 'letter': rect(ctx, x - 11, yy - 8, 22, 16, '#fff4e0'); ctx.strokeStyle = '#b08a5a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 11, yy - 8); ctx.lineTo(x, yy + 1); ctx.lineTo(x + 11, yy - 8); ctx.stroke(); circle(ctx, x, yy + 1, 3, '#c0392b'); break;
      case 'bottle': ellipse(ctx, x, yy + 3, 8, 9, '#9fd8ff'); rect(ctx, x - 3, yy - 12, 6, 8, '#9fd8ff'); rect(ctx, x - 4, yy - 14, 8, 3, '#8a6a4a'); break;
      default: ctx.fillStyle = '#b96b4f'; ctx.beginPath(); ctx.roundRect(x - 12, yy - 8, 24, 18, 5); ctx.fill(); rect(ctx, x - 12, yy - 8, 24, 7, '#8f4f3a'); rect(ctx, x - 3, yy - 3, 6, 5, '#f0c47a');
    }
    this.lights.push({ x, y: yy, r: 80, color: col, a: .7 });
  }
  /** A captive in an iron cage, waving for help. Red when guards are still standing, gold once it can be opened. */
  private drawCage(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const t = this.time, x = o.x, y = o.y, guarded = e.enemies.some(en => en.guard === o.questId && !en.dead), c = guarded ? '#ff6b5b' : '#ffd35c';
    shadow(ctx, x, y + 16, 44, 12, .3);
    glow(ctx, x, y - 30, 70, c, .3 + Math.sin(t * 3) * .1);
    ellipse(ctx, x, y + 12, 40, 12, '#4a4a52'); ellipse(ctx, x, y + 9, 36, 10, '#6a6a72');
    if (o.captive) this.drawCaptive(ctx, x, y + 4, o.captive, t);
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 4;
    for (let i = 0; i < 7; i++) { const bx = x - 33 + i * 11; ctx.beginPath(); ctx.moveTo(bx, y + 10); ctx.lineTo(bx, y - 62); ctx.stroke(); }
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 36, y - 62); ctx.quadraticCurveTo(x, y - 84, x + 36, y - 62); ctx.stroke();
    ctx.strokeStyle = '#7a7a86'; ctx.lineWidth = 1.5; for (let i = 0; i < 7; i++) { const bx = x - 34 + i * 11; ctx.beginPath(); ctx.moveTo(bx, y + 8); ctx.lineTo(bx, y - 60); ctx.stroke(); }
    rect(ctx, x - 7, y - 30, 14, 12, guarded ? '#8a3a3a' : '#c9a44c');
    const by = y - 104 + Math.sin(t * 4) * 3;
    ctx.fillStyle = 'rgba(255,250,236,.95)'; ctx.beginPath(); ctx.roundRect(x - 26, by - 14, 52, 24, 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 5, by + 10); ctx.lineTo(x, by + 17); ctx.lineTo(x + 5, by + 10); ctx.fill();
    ctx.fillStyle = guarded ? '#b8322a' : '#3a2e24'; ctx.font = `900 13px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(guarded ? 'Help!' : 'Free me!', x, by + 3);
    this.lights.push({ x, y: y - 30, r: 150, color: c, a: .7 });
  }
  private drawCaptive(ctx: CanvasRenderingContext2D, x: number, y: number, c: Captive, t: number) {
    const L: NpcLook = c.look, s = L.small ? .8 : 1, wave = Math.sin(t * 6) * .5;
    ctx.save(); ctx.translate(x, y - 20 * s); ctx.scale(s, s);
    ctx.fillStyle = L.robe; ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(12, -6); ctx.lineTo(16, 20); ctx.quadraticCurveTo(0, 24, -16, 20); ctx.closePath(); ctx.fill();
    circle(ctx, 0, -17, 12, L.skin);
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(0, -19, 12.5, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    if (L.hat === 'wizard') { ctx.fillStyle = L.hatColor; ctx.beginPath(); ctx.ellipse(0, -26, 16, 4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-9, -27); ctx.lineTo(-4, -52); ctx.lineTo(9, -27); ctx.fill(); }
    else if (L.hat !== 'none') { ctx.fillStyle = L.hatColor; ctx.beginPath(); ctx.arc(0, -22, 12.5, Math.PI, TAU); ctx.fill(); }
    if (L.beard) { ctx.fillStyle = L.hair; ctx.beginPath(); ctx.moveTo(-6, -12); ctx.quadraticCurveTo(0, 2, 6, -12); ctx.fill(); }
    circle(ctx, -4, -17, 1.6, '#3b2f2a'); circle(ctx, 4, -17, 1.6, '#3b2f2a');
    ctx.strokeStyle = L.skin; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(18, -22 + wave * 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-16, 6); ctx.stroke();
    ctx.restore();
  }
  private drawShrine(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const reg = regionOf(e.world, o.x), t = this.time, x = o.x, y = o.y, c = reg.palette.accent, power = .8;
    ctx.save(); ctx.translate(x, y + 14); ctx.scale(1, .42);
    ctx.strokeStyle = alpha(c, .7 * power); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 62, 0, TAU); ctx.stroke();
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = t * 30; ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.rotate(t * .5); ctx.fillStyle = alpha(c, .8 * power);
    for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillRect(56, -3, 10, 6); }
    ctx.restore();
    glow(ctx, x, y - 20, 90, c, .5 * power);
    ctx.fillStyle = '#6b6a60'; ctx.beginPath(); ctx.roundRect(x - 20, y - 12, 40, 30, 4); ctx.fill();
    ctx.fillStyle = '#86857a'; ctx.fillRect(x - 25, y - 16, 50, 7); ctx.fillStyle = alpha(reg.palette.foliage[2], .8); ctx.fillRect(x - 25, y - 16, 18, 4);
    const fy = y - 44 + Math.sin(t * 2) * 6;
    if (reg.id === 'meadow') { glow(ctx, x, fy, 30, '#ffb05c', .9); ctx.fillStyle = '#ffe38a'; star(ctx, x, fy, 14, 8, .5, t); ctx.fill(); circle(ctx, x, fy, 7, '#fff6d8'); }
    else if (reg.id === 'woods') { circle(ctx, x, fy, 14, '#3f7a4a'); circle(ctx, x - 4, fy - 4, 8, '#9fe8b0'); for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * TAU / 3; ellipse(ctx, x + Math.cos(a) * 22, fy + Math.sin(a) * 8, 6, 3, '#9fe8b0', a); } }
    else if (reg.id === 'ember') this.drawFlame(ctx, x, fy + 12, .7, '#ffb347');
    else { ctx.fillStyle = '#fff'; star(ctx, x, fy, 16, 5, .45, t); ctx.fill(); ctx.fillStyle = c; star(ctx, x, fy, 9, 5, .45, t); ctx.fill(); }
    if (Math.random() < .3) this.pushAmbient({ x: x + rand(-40, 40), y: y + rand(-5, 15), vx: 0, vy: rand(-50, -25), life: 1.2, max: 1.2, size: 2.4, rot: 0, vr: 0, kind: 'mote', color: c, phase: 0 });
    this.lights.push({ x, y: y - 30, r: 220, color: c, a: power });
  }
  private drawFinale(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const t = this.time, x = o.x, y = o.y, lit = e.finaleLit(o.region), acc = regionOf(e.world, o.x).palette.accent, id = o.region;
    shadow(ctx, x + 6, y + 30, 50, 14, .3);
    if (id === 'meadow') {
      const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0); g.addColorStop(0, '#6f6450'); g.addColorStop(1, '#8b7f63');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 26, y + 30); ctx.lineTo(x - 18, y - 70); ctx.lineTo(x + 18, y - 70); ctx.lineTo(x + 26, y + 30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - 24 + i, y + 10 - i * 18); ctx.lineTo(x + 24 - i, y + 10 - i * 18); ctx.stroke(); }
      ctx.fillStyle = '#5a5140'; ctx.fillRect(x - 26, y - 82, 52, 14);
      this.drawFlame(ctx, x, y - 84, lit ? 1.6 : .35, lit ? '#ffcf6e' : '#a0785a');
    } else if (id === 'woods') {
      ctx.strokeStyle = '#553f2d'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 34, y + 28); ctx.quadraticCurveTo(x - 40, y - 80, x, y - 86); ctx.quadraticCurveTo(x + 40, y - 80, x + 34, y + 28); ctx.stroke();
      ctx.strokeStyle = '#6f9a5c'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i * .5 - 1.3; ctx.beginPath(); ctx.arc(x, y - 30, 42, a, a + .3); ctx.stroke(); }
      const swing = lit ? Math.sin(t * 5) * .45 : Math.sin(t * .8) * .06;
      ctx.save(); ctx.translate(x, y - 78); ctx.rotate(swing);
      const bg = ctx.createLinearGradient(-18, 0, 18, 0); bg.addColorStop(0, '#9c7a3c'); bg.addColorStop(.5, '#e8c46a'); bg.addColorStop(1, '#8a6a30');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(-10, 30, -22, 44); ctx.lineTo(22, 44); ctx.quadraticCurveTo(10, 30, 8, 4); ctx.closePath(); ctx.fill();
      circle(ctx, 0, 46, 5, '#6b5226'); ctx.restore();
      if (!lit) { ctx.strokeStyle = '#3d2c1f'; ctx.lineWidth = 5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 30 + i * 18, y + 20); ctx.quadraticCurveTo(x - 10 + i * 6 + Math.sin(t + i) * 4, y - 30, x - 20 + i * 14, y - 60); ctx.stroke(); } }
      if (lit && Math.random() < .2) this.pushAmbient({ x: x + rand(-30, 30), y: y - 40, vx: rand(-40, 40), vy: rand(-40, -10), life: 1.5, max: 1.5, size: 5, rot: 0, vr: 3, kind: 'petal', color: pick(['#f7c5d5', '#fff', '#b9f29d']), phase: Math.random() * 6 });
    } else if (id === 'ember') {
      // The Dawn Forge: a great stone hearth with an anvil; lit, a white-gold fire roars out of its mouth.
      ctx.fillStyle = '#3a2e2c'; ctx.beginPath(); ctx.moveTo(x - 46, y + 30); ctx.lineTo(x - 38, y - 60); ctx.quadraticCurveTo(x, y - 96, x + 38, y - 60); ctx.lineTo(x + 46, y + 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4e3e3a'; ctx.fillRect(x - 50, y - 64, 100, 12);
      ctx.fillStyle = lit ? '#ffd27a' : '#1a1210'; ctx.beginPath(); ctx.moveTo(x - 20, y + 30); ctx.lineTo(x - 20, y - 20); ctx.quadraticCurveTo(x, y - 44, x + 20, y - 20); ctx.lineTo(x + 20, y + 30); ctx.closePath(); ctx.fill();
      if (lit) { this.drawFlame(ctx, x, y - 8, 1.1, '#fff1b8'); this.drawFlame(ctx, x, y - 70, 1.4, '#ffb347'); }
      else { for (let i = 0; i < 5; i++) circle(ctx, x - 12 + i * 6, y + 22 - (i % 2) * 3, 3, `rgba(255,120,60,${.4 + Math.sin(t * 2 + i) * .2})`); }
      ctx.fillStyle = '#2a2220'; ctx.beginPath(); ctx.roundRect(x + 52, y + 4, 34, 12, 3); ctx.fill(); ctx.fillRect(x + 62, y + 16, 14, 14);
      if (lit && Math.random() < .3) this.pushAmbient({ x: x + rand(-20, 20), y: y - 70, vx: rand(-30, 30), vy: rand(-80, -40), life: 1.2, max: 1.2, size: 2.4, rot: 0, vr: 0, kind: 'mote', color: pick(['#ffd27a', '#ffb347', '#fff1b8']), phase: 0 });
    } else {
      ctx.fillStyle = '#4a4f73'; ctx.beginPath(); ctx.ellipse(x, y + 20, 48, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6f7493'; ctx.beginPath(); ctx.ellipse(x, y + 14, 42, 12, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * .2, px = x + Math.cos(a) * 40, py = y + 14 + Math.sin(a) * 12; ctx.fillStyle = '#8f93b8'; ctx.fillRect(px - 4, py - 34, 8, 34); glow(ctx, px, py - 36, 12, acc, lit ? 1 : .3); }
      const rise = lit ? 60 + Math.sin(t) * 8 : 0, sy = y - 30 - rise + Math.sin(t * 2) * 5;
      glow(ctx, x, sy, lit ? 140 : 50, acc, lit ? 1 : .4);
      ctx.fillStyle = lit ? '#fffaf0' : '#3a3358'; star(ctx, x, sy, lit ? 26 : 18, 5, .45, t * .5); ctx.fill();
      if (!lit) { ctx.strokeStyle = 'rgba(201,182,255,.5)'; ctx.lineWidth = 1.5; star(ctx, x, sy, 18, 5, .45, t * .5); ctx.stroke(); }
    }
    glow(ctx, x, y - 70, lit ? 220 : 60, acc, lit ? .9 : .4 + Math.sin(t * 2) * .1);
    this.lights.push({ x, y: y - 60, r: lit ? 520 : 160, color: acc, a: 1 });
  }
  private drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    const t = this.time;
    glow(ctx, x, y - 10 * size, 60 * size, color, .9);
    for (let i = 0; i < 5; i++) {
      const f = Math.sin(t * 12 + i * 2 + x) * 3 * size, h = (22 - i * 3) * size;
      ctx.fillStyle = i === 0 ? alpha(color, .9) : i < 3 ? 'rgba(255,190,90,.8)' : 'rgba(255,245,210,.9)';
      ctx.beginPath(); ctx.moveTo(x - (10 - i * 1.6) * size, y); ctx.quadraticCurveTo(x - 8 * size + f, y - h * .6, x + f * .6, y - h); ctx.quadraticCurveTo(x + 8 * size + f, y - h * .6, x + (10 - i * 1.6) * size, y); ctx.fill();
    }
    if (Math.random() < .3 * size) this.pushAmbient({ x: x + rand(-6, 6), y: y - 14 * size, vx: rand(-10, 10), vy: rand(-70, -40), life: .9, max: .9, size: 2, rot: 0, vr: 0, kind: 'mote', color: '#ffcf6e', phase: 0 });
  }
  private drawPod(ctx: CanvasRenderingContext2D, x: number, y: number, e: GameEngine) {
    const pal = regionOf(e.world, x).palette, t = this.time, c = pal.pod, wob = Math.sin(t * 2.4 + x) * .08, pulse = .6 + Math.sin(t * 3 + y) * .4;
    shadow(ctx, x, y + 14, 18, 6);
    for (let i = -1; i <= 1; i++) ellipse(ctx, x + i * 12, y + 10, 10, 4, pal.foliage[1], i * .6);
    ctx.save(); ctx.translate(x, y + 10); ctx.rotate(wob);
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -15, 14, 17, 0, 0, TAU); ctx.fill();
    ellipse(ctx, -4, -21, 5, 7, 'rgba(255,255,255,.55)');
    ctx.strokeStyle = alpha(c, .5 + pulse * .5); ctx.lineWidth = 1.5;
    for (const a of [-.5, 0, .5]) { ctx.beginPath(); ctx.ellipse(0, -15, 14 * Math.abs(Math.cos(a + 1.57)) + 2, 16, 0, -1.3, 1.3); ctx.stroke(); }
    ctx.fillStyle = pal.foliage[1]; ctx.beginPath(); ctx.moveTo(-5, -31); ctx.quadraticCurveTo(0, -38, 6, -34); ctx.lineTo(0, -30); ctx.fill();
    ctx.restore();
    glow(ctx, x, y - 5, 30, c, .35 * pulse);
    this.lights.push({ x, y: y - 5, r: 60, color: c, a: .6 });
  }

  // ───────────────────────────── villagers
  private drawNpc(ctx: CanvasRenderingContext2D, n: Npc, e: GameEngine) {
    const t = this.time, L = n.look, s = L.small ? .78 : 1, act = n.activity;
    const walking = n.moving;
    const step = walking ? Math.sin(n.walkT * 2.2) : 0, bob = walking ? -Math.abs(step) * 3 : Math.sin(t * 2 + n.homeX) * 1.2;
    const x = n.x, y = n.y;
    shadow(ctx, x, y + 22 * s, 18 * s, 6 * s);
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(n.faceX * s, s);
    // tool animations
    const work = act === 'chop' || act === 'farm' || act === 'hammer' ? Math.sin(n.workT / (act === 'chop' ? 1.2 : act === 'hammer' ? .7 : 1.6) * TAU) : 0;
    if (act === 'travel') { ctx.fillStyle = '#8a5a3a'; ctx.beginPath(); ctx.roundRect(-20, -8, 12, 22, 4); ctx.fill(); rect(ctx, -22, -12, 16, 5, '#6a4a2a'); }
    // legs
    ellipse(ctx, -5 + step * 4, 21, 5, 3, '#4b3025'); ellipse(ctx, 5 - step * 4, 21, 5, 3, '#4b3025');
    // robe
    ctx.fillStyle = L.robe; ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(12, -6); ctx.lineTo(17, 20); ctx.quadraticCurveTo(0, 25, -17, 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(12, -6); ctx.lineTo(17, 20); ctx.lineTo(6, 22); ctx.closePath(); ctx.fill();
    rect(ctx, -13, 4, 26, 3, 'rgba(0,0,0,.2)');
    // head
    circle(ctx, 0, -17, 12, L.skin);
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(0, -19, 12.5, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.fillRect(-12, -21, 4, 9);
    const blink = Math.sin(t * 1.3 + n.homeX) > .97;
    if (blink) { rect(ctx, 2, -17, 4, 1.2, '#3b2f2a'); rect(ctx, 7, -17, 3, 1.2, '#3b2f2a'); }
    else { circle(ctx, 4, -16, 1.6, '#3b2f2a'); circle(ctx, 9, -16, 1.4, '#3b2f2a'); }
    circle(ctx, 7, -11, 2, 'rgba(230,120,110,.35)');
    if (L.beard) { ctx.fillStyle = L.hair === '#e8e2d0' || L.hair === '#8a8a8a' ? '#e8e2d0' : L.hair; ctx.beginPath(); ctx.moveTo(-4, -12); ctx.quadraticCurveTo(4, 2, 12, -12); ctx.fill(); }
    // hats
    const hc = L.hatColor;
    switch (L.hat) {
      case 'straw': ellipse(ctx, 0, -27, 20, 5, '#d9b45a'); ctx.fillStyle = '#d9b45a'; ctx.beginPath(); ctx.arc(0, -28, 10, Math.PI, TAU); ctx.fill(); rect(ctx, -10, -30, 20, 3, hc); break;
      case 'hood': ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, -19, 14.5, Math.PI * .95, Math.PI * 2.05); ctx.lineTo(-14, -8); ctx.fill(); break;
      case 'cap': ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, -24, 11, Math.PI, TAU); ctx.fill(); ellipse(ctx, 8, -24, 9, 3, hc); break;
      case 'wizard': ctx.fillStyle = hc; ctx.beginPath(); ctx.ellipse(0, -26, 17, 4.5, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-10, -27); ctx.quadraticCurveTo(-2, -50, -12 + Math.sin(t) * 3, -56); ctx.quadraticCurveTo(4, -44, 10, -27); ctx.fill(); break;
      case 'bonnet': ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(-1, -20, 14, Math.PI * .9, Math.PI * 2.1); ctx.fill(); ellipse(ctx, -12, -12, 3, 5, hc); break;
      case 'helm': ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, -22, 13, Math.PI, TAU); ctx.fill(); rect(ctx, -13, -23, 26, 4, shade('#8a8f9a', -.2)); rect(ctx, -1.5, -38, 3, 6, '#c0392b'); break;
      case 'ears': ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(-8, -28, 5, 0, TAU); ctx.arc(8, -28, 5, 0, TAU); ctx.fill(); break;
      case 'scarf': rect(ctx, -11, -8, 22, 5, hc); rect(ctx, -12, -8, 5, 12, hc); break;
    }
    // hands and tools
    ctx.strokeStyle = '#6f5337'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    if (act === 'chop' || act === 'hammer' || act === 'farm') {
      ctx.save(); ctx.translate(10, -2); ctx.rotate(-1.2 + work * 1.1);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26); ctx.stroke();
      if (act === 'chop') { ctx.fillStyle = '#b8bcc4'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(10, -30); ctx.lineTo(10, -18); ctx.closePath(); ctx.fill(); }
      else if (act === 'hammer') rect(ctx, -5, -30, 12, 7, '#7a7d86');
      else rect(ctx, -1, -28, 12, 4, '#8a8f9a');
      ctx.restore();
    } else if (act === 'sweep') {
      const sw = Math.sin(t * 3 + n.homeX) * .4;
      ctx.save(); ctx.translate(10, 0); ctx.rotate(.5 + sw); ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke(); ctx.fillStyle = '#c9a44c'; ctx.beginPath(); ctx.moveTo(-5, 18); ctx.lineTo(5, 18); ctx.lineTo(8, 28); ctx.lineTo(-8, 28); ctx.fill(); ctx.restore();
    } else if (act === 'fish') {
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(34, -30); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(34, -30); ctx.quadraticCurveTo(44, -10, 48, 26 + Math.sin(t * 2) * 2); ctx.stroke();
      circle(ctx, 48, 27 + Math.sin(t * 2) * 2, 3, '#e0525c');
    } else if (act === 'patrol') { ctx.beginPath(); ctx.moveTo(12, 16); ctx.lineTo(12, -38); ctx.stroke(); ctx.fillStyle = '#b8bcc4'; ctx.beginPath(); ctx.moveTo(8, -38); ctx.lineTo(12, -48); ctx.lineTo(16, -38); ctx.fill(); }
    circle(ctx, 11, 0, 3.5, L.skin);
    ctx.restore();
    // lantern in the dark
    const reg = regionOf(e.world, x), dark = reg.darkness > 0;
    if (dark && (n.role === 'guide' || act === 'patrol' || act === 'travel')) { const lx = x - n.faceX * 16, ly = y + 4; glow(ctx, lx, ly, 24, '#ffcf6e', .8); circle(ctx, lx, ly, 3.5, '#ffe38a'); this.lights.push({ x: lx, y: ly, r: 150, color: '#ffcf6e', a: .9 }); }
    else if (dark) this.lights.push({ x, y, r: 90, a: .6 });
    const mark = e.npcMarker(n);
    if (mark) {
      const my = y - 56 * s + Math.abs(Math.sin(t * 3.4)) * -8;
      const mc = mark.main ? MAIN_COLOR : SIDE_COLOR;
      glow(ctx, x, my, 28, mc, .8);
      circle(ctx, x, my, 12, mc);
      ctx.fillStyle = '#2a2f24'; ctx.font = `900 16px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(mark.mark, x, my + 6);
    } else if (n.role === 'merchant' || n.role === 'smith' || n.role === 'armorer' || n.role === 'inn') {
      // Shops show a small sign over their keeper's head.
      const my = y - 58 * s, icon = n.role === 'merchant' ? '⚗' : n.role === 'smith' ? '⚒' : n.role === 'armorer' ? '⛨' : '☾';
      ctx.fillStyle = 'rgba(14,20,30,.8)'; ctx.beginPath(); ctx.roundRect(x - 13, my - 13, 26, 24, 8); ctx.fill();
      ctx.strokeStyle = '#ffd35c'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffd35c'; ctx.font = `900 15px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(icon, x, my + 5);
    }
    const near = this.near; if (near?.kind === 'npc' && near.n === n) this.label(ctx, x, y + 44, n.name, reg.palette.accent);
  }
  private drawBubbles(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    ctx.font = `800 13px ${UI}`; ctx.textAlign = 'center';
    for (const n of e.npcs) {
      if (n.barkT <= 0 || n.x < v.x - 100 || n.x > v.x + v.w + 100 || n.y < v.y - 100 || n.y > v.y + v.h + 100) continue;
      const a = Math.min(1, n.barkT * 2, (3.2 - n.barkT) * 5), y = n.y - 72 - (1 - Math.min(1, (3.2 - n.barkT) * 4)) * 8;
      const w = ctx.measureText(n.bark).width + 20;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(255,250,236,.95)'; ctx.beginPath(); ctx.roundRect(n.x - w / 2, y - 18, w, 26, 13); ctx.fill();
      ctx.beginPath(); ctx.moveTo(n.x - 6, y + 7); ctx.lineTo(n.x, y + 15); ctx.lineTo(n.x + 5, y + 7); ctx.fill();
      ctx.fillStyle = '#3a2e24'; ctx.fillText(n.bark, n.x, y);
      ctx.globalAlpha = 1;
    }
  }

  // ───────────────────────────── wildlife
  private drawCritter(ctx: CanvasRenderingContext2D, c: Critter, e: GameEngine) {
    const t = this.time + c.seed * 10, moving = c.state === 'move' || c.state === 'flee', snow = regionOf(e.world, c.x).ground === 'snow';
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.face, 1);
    switch (c.kind) {
      case 'rabbit': {
        const hop = moving ? Math.abs(Math.sin(c.hop * (c.state === 'flee' ? 16 : 8))) * 8 : 0;
        shadow(ctx, 0, 6, 9, 3, .2); ctx.translate(0, -hop);
        const fur = snow ? '#f0f2fa' : '#b89a7a';
        ellipse(ctx, 0, 0, 9, 6.5, fur); circle(ctx, 7, -4, 4.5, fur); circle(ctx, -8, -1, 3, '#fff');
        ellipse(ctx, 6, -11, 1.8, 5.5, fur, -.2); ellipse(ctx, 9, -11, 1.8, 5.5, fur, .2); circle(ctx, 9, -5, 1, '#2a1f1b');
        break;
      }
      case 'squirrel': {
        const hop = moving ? Math.abs(Math.sin(c.hop * 14)) * 5 : 0;
        shadow(ctx, 0, 5, 8, 3, .2); ctx.translate(0, -hop);
        ctx.fillStyle = '#b8683a'; ctx.beginPath(); ctx.ellipse(-8, -8, 5, 9, -.5 + Math.sin(t * 3) * .1, 0, TAU); ctx.fill();
        ellipse(ctx, 0, 0, 6, 5, '#c9783f'); circle(ctx, 5, -4, 3.5, '#c9783f'); circle(ctx, 6.5, -5, .9, '#2a1f1b');
        break;
      }
      case 'deer': {
        const leg = moving ? Math.sin(c.hop * (c.state === 'flee' ? 18 : 6)) * 5 : 0, graze = !moving && Math.sin(t * .4) > .2;
        shadow(ctx, 0, 14, 22, 6, .22);
        ctx.strokeStyle = '#7a5236'; ctx.lineWidth = 3;
        for (const [lx, ph] of [[-12, 1], [-7, -1], [9, -1], [14, 1]] as Array<[number, number]>) { ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + leg * ph, 14); ctx.stroke(); }
        ellipse(ctx, 0, -4, 18, 9, '#a8744a'); ellipse(ctx, -2, -1, 12, 4, '#c9a07a');
        const hx = graze ? 22 : 18, hy = graze ? 6 : -20;
        ctx.strokeStyle = '#a8744a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(12, -8); ctx.lineTo(hx - 2, hy + 4); ctx.stroke();
        ellipse(ctx, hx + 3, hy, 7, 5, '#a8744a'); circle(ctx, hx + 3, hy - 2, 1.2, '#2a1f1b');
        ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(hx, hy - 4); ctx.lineTo(hx - 3, hy - 14); ctx.lineTo(hx - 7, hy - 16); ctx.moveTo(hx - 3, hy - 14); ctx.lineTo(hx + 1, hy - 19); ctx.stroke();
        circle(ctx, -18, -8, 3, '#fff');
        break;
      }
      case 'goat': {
        const leg = moving ? Math.sin(c.hop * 10) * 4 : 0;
        shadow(ctx, 0, 12, 18, 5, .22);
        ctx.strokeStyle = '#6a6a72'; ctx.lineWidth = 3; for (const [lx, ph] of [[-10, 1], [-5, -1], [7, -1], [11, 1]] as Array<[number, number]>) { ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + leg * ph, 12); ctx.stroke(); }
        ellipse(ctx, 0, -4, 15, 9, '#e8e8f0'); ellipse(ctx, 14, -12, 6, 6, '#e8e8f0');
        ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(12, -18, 6, Math.PI, Math.PI * 1.8); ctx.stroke();
        circle(ctx, 16, -13, 1.2, '#2a1f1b'); ellipse(ctx, 18, -6, 2, 3.5, '#d8d8e0');
        break;
      }
      case 'bird': {
        if (c.state === 'fly') {
          ctx.restore(); shadow(ctx, c.x, c.y + 4, 6, 2, .15); ctx.save(); ctx.translate(c.x, c.y - c.alt - 10); ctx.scale(c.face, 1);
          const flap = Math.sin(t * 30);
          ctx.fillStyle = snow ? '#3a3a4a' : '#6a5a4a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -10 * flap - 4, -16, -8 * flap); ctx.quadraticCurveTo(-8, 2, 0, 0); ctx.quadraticCurveTo(8, -10 * flap - 4, 16, -8 * flap); ctx.quadraticCurveTo(8, 2, 0, 0); ctx.fill();
          ellipse(ctx, 0, 0, 6, 3.5, snow ? '#4a4a5a' : '#8a6a4a');
        } else {
          const peck = Math.sin(t * 5) > .6 ? 3 : 0, hop = moving ? Math.abs(Math.sin(c.hop * 14)) * 3 : 0;
          shadow(ctx, 0, 4, 5, 2, .18); ctx.translate(0, -hop);
          ellipse(ctx, 0, -3, 6, 4.5, snow ? '#4a4a5a' : '#8a6a4a'); circle(ctx, 5, -6 + peck, 3.2, snow ? '#3a3a4a' : '#6a5a4a');
          ellipse(ctx, 1, -1, 3, 2, '#e0a070'); ctx.fillStyle = '#e8a040'; ctx.beginPath(); ctx.moveTo(8, -6 + peck); ctx.lineTo(11, -5 + peck); ctx.lineTo(8, -4 + peck); ctx.fill();
          ctx.fillStyle = snow ? '#3a3a4a' : '#6a5a4a'; ctx.beginPath(); ctx.moveTo(-5, -4); ctx.lineTo(-10, -7); ctx.lineTo(-9, -2); ctx.fill();
        }
        break;
      }
      case 'duck': {
        const bob = Math.sin(t * 2) * 1.2;
        ctx.strokeStyle = 'rgba(230,250,255,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 3, 14 + Math.sin(t * 3) * 2, 4, 0, 0, TAU); ctx.stroke();
        ctx.translate(0, bob); ellipse(ctx, 0, 0, 11, 6, '#f2efe6'); ellipse(ctx, -2, -1, 7, 4, '#d8d2c0');
        circle(ctx, 8, -7, 4.5, '#3f7a4a'); ellipse(ctx, 13, -6, 3.5, 1.6, '#e8a040'); circle(ctx, 9, -8, 1, '#111');
        break;
      }
      case 'frog': {
        const hop = c.state === 'flee' ? Math.abs(Math.sin(c.hop * 12)) * 10 : 0;
        shadow(ctx, 0, 4, 7, 2.5, .2); ctx.translate(0, -hop);
        ellipse(ctx, 0, 0, 7, 5, '#5fae4f'); circle(ctx, 3, -4, 2.6, '#6fbe5f'); circle(ctx, -2, -4, 2.6, '#6fbe5f'); circle(ctx, 3, -4.5, 1.1, '#111'); circle(ctx, -2, -4.5, 1.1, '#111');
        const throat = Math.sin(t * 6) > .5 ? 2.5 : 1.5; ellipse(ctx, 3, 1, throat, throat * .8, '#e8e0a0');
        break;
      }
    }
    ctx.restore();
  }

  // ───────────────────────────── hero and fox
  private updateFox(e: GameEngine, dt: number) {
    const h = e.hero, f = this.fox;
    const tx = h.x - (h.faceX >= 0 ? 42 : -42), ty = h.y + 14;
    const px = f.x;
    f.x += (tx - f.x) * Math.min(1, dt * 4); f.y += (ty - f.y) * Math.min(1, dt * 4);
    f.vx = (f.x - px) / Math.max(dt, .001);
    if (Math.abs(f.vx) > 8) f.flip = f.vx > 0 ? 1 : -1;
  }
  private drawFox(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time, f = this.fox, moving = Math.hypot(e.hero.vx, e.hero.vy) > 30;
    const hop = moving ? Math.abs(Math.sin(t * 11)) * 6 : 0, x = f.x, y = f.y - hop;
    shadow(ctx, f.x, f.y + 9, 13, 4.5, .25 - hop * .02);
    ctx.save(); ctx.translate(x, y); ctx.scale(f.flip, 1);
    const wag = Math.sin(t * (moving ? 14 : 5)) * .5;
    ctx.save(); ctx.translate(-9, -2); ctx.rotate(-.6 + wag);
    ellipse(ctx, -9, 0, 12, 6, '#d98a50'); ellipse(ctx, -18, 0, 5, 4.4, '#fff4e0'); ctx.restore();
    ellipse(ctx, 0, 0, 11, 7.5, '#d98a50');
    ellipse(ctx, 2, 3, 7, 4, '#fff0dc');
    const step = moving ? Math.sin(t * 22) * 2.5 : 0;
    ctx.fillStyle = '#4b3025'; ctx.fillRect(-7 + step, 5, 3, 5); ctx.fillRect(5 - step, 5, 3, 5);
    circle(ctx, 10, -6, 7.5, '#d98a50');
    ctx.fillStyle = '#d98a50'; ctx.beginPath(); ctx.moveTo(5, -10); ctx.lineTo(6, -21); ctx.lineTo(11, -12); ctx.fill(); ctx.beginPath(); ctx.moveTo(11, -12); ctx.lineTo(16, -20); ctx.lineTo(16, -9); ctx.fill();
    ctx.fillStyle = '#3a2a24'; ctx.beginPath(); ctx.moveTo(6.5, -12); ctx.lineTo(6.8, -18); ctx.lineTo(9.5, -12.5); ctx.fill();
    ellipse(ctx, 15, -4, 4.5, 3, '#fff4e0'); circle(ctx, 19, -5, 1.6, '#2a1f1b');
    const blink = Math.sin(t * .9) > .96;
    if (blink) { ctx.fillStyle = '#2a1f1b'; ctx.fillRect(10, -8, 3, 1); } else circle(ctx, 11.5, -7.5, 1.4, '#2a1f1b');
    ctx.restore();
    if (Math.random() < .05) this.pushAmbient({ x: x - f.flip * 22, y: y - 3, vx: rand(-10, 10), vy: rand(-20, -5), life: .8, max: .8, size: 1.8, rot: 0, vr: 0, kind: 'mote', color: '#ffe38a', phase: 0 });
    this.lights.push({ x, y, r: 60, a: .4 });
  }
  /** The worn gear as colours per slot, recomputed only when the equipment changes. */
  private heroLook(e: GameEngine): Look {
    const eq = e.profile.equipped, key = SLOT_ORDER.map(s => eq[s]?.uid || '').join('|');
    if (key !== this.lookCache.key) this.lookCache = { key, look: lookOf(eq) };
    return this.lookCache.look;
  }
  /** The weapon's material by land tier (wood and iron → root and bronze → starsilver and crystal → obsidian), and its
   *  gem or edge in the rarity dye. Without a weapon worn, the hero's own starting weapon is drawn. */
  private wpn(L: Look, woodDefault: string, metalDefault: string, gemDefault: string) {
    const w = L.weapon;
    if (!w) return { tier: -1, wood: woodDefault, metal: metalDefault, gem: gemDefault, glow: false };
    return { tier: w.tier, wood: ['#7a5a3f', '#5f7a3a', '#d0d8e8', '#2e2630'][w.tier], metal: ['#c8ccd6', '#d8a860', '#cdefff', '#4a3434'][w.tier], gem: w.color, glow: w.glow };
  }
  /** Ornaments on a staff head that grow with the tier: leaves, a crescent, then a crown of flame. */
  private staffCrown(ctx: CanvasRenderingContext2D, y: number, tier: number, gem: string) {
    if (tier === 1) { ellipse(ctx, -5, y + 5, 5, 2.4, '#6fae4a', -.6); ellipse(ctx, 5, y + 5, 5, 2.4, '#6fae4a', .6); }
    if (tier === 2) { ctx.strokeStyle = '#e8f0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, y, 9, Math.PI * .15, Math.PI * .85, true); ctx.stroke(); }
    if (tier === 3) { ctx.fillStyle = gem; for (const a of [-.7, 0, .7]) { ctx.beginPath(); ctx.moveTo(Math.sin(a) * 6 - 2, y - 2); ctx.lineTo(Math.sin(a) * 11, y - 12 - Math.sin(this.time * 9 + a) * 2); ctx.lineTo(Math.sin(a) * 6 + 2, y - 2); ctx.fill(); } }
  }
  /** Epic and legendary pieces shimmer where they are worn. */
  private gearGlow(ctx: CanvasRenderingContext2D, L: Look, spots: Partial<Record<keyof Look, [number, number]>>) {
    for (const [slot, [x, y]] of Object.entries(spots) as Array<[keyof Look, [number, number]]>) { const l = L[slot]; if (l?.glow) glow(ctx, x, y, 16 + Math.sin(this.time * 4 + x) * 3, l.color, .45); }
  }
  /** Giant's Brew grows the hero from the feet up; a Smoke Bomb or Smoke Veil leaves them half see-through. */
  private drawHeroScaled(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const s = e.heroScale, h = e.hero, hidden = e.buffs.smokeBomb !== undefined || e.stealthT > 0, riding = e.riding && !!e.mountId;
    if (s === 1 && !hidden && !riding) return this.drawHero(ctx, e);
    ctx.save();
    if (hidden) ctx.globalAlpha = .45 + Math.sin(this.time * 6) * .1;
    ctx.translate(h.x, h.y + 20); ctx.scale(s, s); ctx.translate(-h.x, -h.y - 20);
    if (s > 1.05) glow(ctx, h.x, h.y - 10, 60 * s, '#c98aff', .35);
    if (riding) {
      // The rider sits in the saddle: the mount behind, the hero raised and cut off at the hips, then the mount's head.
      const moving = Math.hypot(h.vx, h.vy) > 30, bob = moving ? Math.abs(Math.sin(h.walkTime)) * 2.5 : 0, flip = h.faceX < -.05 ? -1 : 1, L = this.heroLook(e);
      this.drawMount(ctx, e, false);
      ctx.save(); ctx.beginPath(); ctx.rect(h.x - 120, h.y - 220, 240, 208); ctx.clip();
      ctx.translate(0, -22 - bob); this.drawHero(ctx, e); ctx.restore();
      rect(ctx, h.x + flip * 1 - 3, h.y - 14 - bob, 6, 12, L.legs?.color ?? '#4a3a44'); ellipse(ctx, h.x + flip * 3, h.y - 1 - bob, 5, 2.8, L.feet?.color ?? '#3a2a24');
      this.drawMount(ctx, e, true);
    } else this.drawHero(ctx, e);
    ctx.restore();
  }
  private drawHero(ctx: CanvasRenderingContext2D, e: GameEngine) {
    if (e.heroId === 'kael') return this.drawWarrior(ctx, e);
    if (e.heroId === 'lyra') return this.drawFrostMage(ctx, e);
    if (e.heroId === 'riven') return this.drawAssassin(ctx, e);
    if (e.heroId === 'wren') return this.drawHunter(ctx, e);
    const t = this.time, h = e.hero, moving = Math.hypot(h.vx, h.vy) > 30, flip = h.faceX < -.05 ? -1 : 1, L = this.heroLook(e);
    for (const a of e.afterimages) { ctx.globalAlpha = a.life / .28 * .45; ellipse(ctx, a.x, a.y + 4, 16, 24, '#bfe8ff'); circle(ctx, a.x, a.y - 18, 12, '#e6f7ff'); }
    ctx.globalAlpha = 1;
    const bob = moving ? -Math.abs(Math.sin(h.walkTime)) * 4 : Math.sin(t * 2.2) * 1.2;
    const stretch = moving ? 1 + Math.abs(Math.sin(h.walkTime)) * .05 : 1 + Math.sin(t * 2.2) * .015;
    shadow(ctx, h.x, h.y + 20, 20, 7, .3);
    if (h.shieldTime > 0) {
      const a = Math.min(1, h.shieldTime * 2);
      glow(ctx, h.x, h.y - 8, 70, '#9fe8b0', .5 * a);
      ctx.strokeStyle = `rgba(190,255,200,${.75 * a})`; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const ang = t * 1.6 + i * TAU / 8; ellipse(ctx, h.x + Math.cos(ang) * 40, h.y - 8 + Math.sin(ang) * 40, 9, 5, `rgba(159,232,176,${.8 * a})`, ang + Math.PI / 2); }
      ctx.beginPath(); ctx.arc(h.x, h.y - 8, 44 + Math.sin(t * 10) * 2, 0, TAU); ctx.stroke();
    }
    const hurtFlash = h.hurtTime > 0 && Math.floor(t * 16) % 2 === 0;
    ctx.save(); ctx.translate(h.x, h.y + bob); ctx.scale(flip, stretch);
    const speed = Math.min(1, Math.hypot(h.vx, h.vy) / 270), wave = Math.sin(t * 8) * (2 + speed * 4);
    ctx.fillStyle = L.back?.color ?? '#7a3a52'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-20 - speed * 10, 6 + wave, -22 - speed * 14, 20 + wave * .6); ctx.lineTo(-4, 20); ctx.closePath(); ctx.fill();
    const step = moving ? Math.sin(h.walkTime) * 5 : 0;
    ellipse(ctx, -6 + step, 21, 5, 3, L.feet?.color ?? '#4b3025'); ellipse(ctx, 6 - step, 21, 5, 3, L.feet?.color ?? '#4b3025');
    ctx.fillStyle = hurtFlash ? '#ffffff' : L.chest?.color ?? '#d06c50'; ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(13, -4); ctx.lineTo(17, 19); ctx.quadraticCurveTo(0, 25, -17, 19); ctx.closePath(); ctx.fill();
    if (L.legs) { ctx.fillStyle = L.legs.color; ctx.beginPath(); ctx.moveTo(-16.3, 15); ctx.lineTo(16.3, 15); ctx.lineTo(17, 19); ctx.quadraticCurveTo(0, 25, -17, 19); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(13, -4); ctx.lineTo(17, 19); ctx.lineTo(6, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = L.waist?.color ?? '#f2c46a'; ctx.fillRect(-13, 5, 26, 3); circle(ctx, 0, 6.5, 2.6, '#fff1b8');
    if (L.shoulders) { ellipse(ctx, -12, -4, 7, 4.5, L.shoulders.color); ellipse(ctx, 12, -4, 7, 4.5, L.shoulders.color); }
    this.gearGlow(ctx, L, { chest: [0, 8], shoulders: [12, -4], waist: [0, 6], legs: [0, 18], feet: [0, 21], back: [-16, 8] });
    circle(ctx, 0, -17, 12.5, hurtFlash ? '#ffffff' : '#f0c8a2');
    ctx.fillStyle = '#6b3f2a'; ctx.beginPath(); ctx.moveTo(-12, -18); ctx.quadraticCurveTo(-16, -2, -8 - wave * .3, 2); ctx.lineTo(-6, -14); ctx.closePath(); ctx.fill();
    const blink = (t % 3.7) < .12;
    if (blink) { ctx.fillStyle = '#2d2420'; ctx.fillRect(3, -17, 5, 1.4); } else { circle(ctx, 5.5, -16.5, 2, '#2d2420'); circle(ctx, 6.2, -17.3, .7, '#fff'); }
    circle(ctx, 8, -11.5, 2.2, 'rgba(230,110,100,.35)');
    const tip = Math.sin(t * 3 + speed * 4) * 4 - speed * 6;
    ctx.fillStyle = L.head?.color ?? '#3f5a41'; ctx.beginPath(); ctx.ellipse(0, -25, 19, 5.5, -.08, 0, TAU); ctx.fill();
    this.gearGlow(ctx, L, { head: [0, -34] });
    ctx.beginPath(); ctx.moveTo(-11, -26); ctx.quadraticCurveTo(-4, -46, -14 + tip, -54); ctx.quadraticCurveTo(4, -44, 11, -26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2c46a'; ctx.fillRect(-11, -30, 22, 3.5);
    ctx.fillStyle = '#fff1b8'; star(ctx, -14 + tip, -54, 4, 4, .4, t * 2); ctx.fill();
    const raise = h.castTime > 0 ? h.castTime / .3 : 0, sa = -.35 - raise * .7, W = this.wpn(L, '#7a5a3f', '', '#ffe38a');
    ctx.save(); ctx.translate(12, 2); ctx.rotate(sa);
    ctx.strokeStyle = W.wood; ctx.lineWidth = 3 + Math.max(0, W.tier) * .4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -26 - Math.max(0, W.tier) * 2); ctx.stroke();
    this.staffCrown(ctx, -30, W.tier, W.gem);
    circle(ctx, 0, -30, 5 + raise * 2, W.tier < 0 ? '#fff1b8' : '#ffffff'); glow(ctx, 0, -30, 18 + raise * 26 + (W.glow ? 10 : 0), W.gem, .9);
    ctx.restore();
    circle(ctx, 11, 0, 4, L.hands?.color ?? '#f0c8a2');
    ctx.restore();
    const tipX = h.x + flip * (12 + Math.sin(-sa) * 30), tipY = h.y + bob + 2 - Math.cos(sa) * 30;
    if (Math.random() < .2) this.pushAmbient({ x: tipX + rand(-3, 3), y: tipY, vx: rand(-12, 12), vy: rand(-30, -10), life: .7, max: .7, size: 1.8, rot: 0, vr: 0, kind: 'mote', color: '#ffe38a', phase: 0 });
    this.lights.push({ x: h.x, y: h.y - 10, r: 320, a: 1 }, { x: tipX, y: tipY, r: 120 + raise * 120, color: '#ffe38a', a: .9 });
  }

  /** Kael: plate armour, a plumed helm, a kite shield on one arm and a sword that swings with each Slash. */
  private drawWarrior(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time, h = e.hero, moving = Math.hypot(h.vx, h.vy) > 30, flip = h.faceX < -.05 ? -1 : 1, storm = h.stormT > 0, L = this.heroLook(e);
    for (const a of e.afterimages) { ctx.globalAlpha = a.life / .28 * .45; ellipse(ctx, a.x, a.y + 4, 18, 24, '#ffd0a0'); circle(ctx, a.x, a.y - 18, 12, '#fff0e0'); }
    ctx.globalAlpha = 1;
    const bob = moving ? -Math.abs(Math.sin(h.walkTime)) * 3.5 : Math.sin(t * 2.2) * 1;
    shadow(ctx, h.x, h.y + 20, 22, 7, .32);
    if (h.shieldTime > 0) {
      const a = Math.min(1, h.shieldTime * 2);
      glow(ctx, h.x, h.y - 8, 70, '#b8c8e0', .5 * a);
      ctx.strokeStyle = `rgba(220,232,255,${.8 * a})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(h.x, h.y - 8, 44 + Math.sin(t * 10) * 2, 0, TAU); ctx.stroke();
      for (let i = 0; i < 6; i++) { const ang = t * 1.2 + i * TAU / 6; ctx.fillStyle = `rgba(200,215,240,${.7 * a})`; ctx.save(); ctx.translate(h.x + Math.cos(ang) * 44, h.y - 8 + Math.sin(ang) * 44); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, -2); ctx.lineTo(0, 9); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill(); ctx.restore(); }
    }
    if (storm) {
      // Bladestorm: the sword whirls in a full circle, leaving a steel ring.
      const spin = t * 22;
      ctx.save(); ctx.translate(h.x, h.y - 6); ctx.scale(1, .7);
      ctx.strokeStyle = 'rgba(255,200,160,.35)'; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(0, 0, 118, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,220,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 122, spin, spin + 2.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 122, spin + Math.PI, spin + Math.PI + 2.4); ctx.stroke();
      ctx.restore();
      this.lights.push({ x: h.x, y: h.y, r: 240, color: '#ffb08a', a: .9 });
    }
    const hurtFlash = h.hurtTime > 0 && Math.floor(t * 16) % 2 === 0;
    ctx.save(); ctx.translate(h.x, h.y + bob); ctx.scale(flip, 1);
    if (storm) ctx.rotate(Math.sin(t * 22) * .15);
    const step = moving ? Math.sin(h.walkTime) * 5 : 0, steel = hurtFlash ? '#ffffff' : L.chest?.color ?? '#9aa6b8', dark = L.legs?.color ?? '#5a6478';
    // cape
    const wave = Math.sin(t * 7) * 3;
    ctx.fillStyle = L.back?.color ?? '#8a2a2a'; ctx.beginPath(); ctx.moveTo(-10, -8); ctx.quadraticCurveTo(-22, 6 + wave, -20, 22 + wave * .5); ctx.lineTo(-2, 20); ctx.closePath(); ctx.fill();
    // legs and boots
    rect(ctx, -9 + step, 10, 7, 11, dark); rect(ctx, 3 - step, 10, 7, 11, dark);
    ellipse(ctx, -6 + step, 22, 6, 3, L.feet?.color ?? '#3a3040'); ellipse(ctx, 6 - step, 22, 6, 3, L.feet?.color ?? '#3a3040');
    // breastplate
    ctx.fillStyle = steel; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(14, -8); ctx.lineTo(13, 12); ctx.quadraticCurveTo(0, 18, -13, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-10, -6, 5, 14);
    rect(ctx, -14, 6, 28, 4, L.waist?.color ?? '#6a4a30'); circle(ctx, 0, 8, 2.8, '#e8c46a');
    // pauldrons
    const pad = L.shoulders?.color ?? '#5a6478';
    ellipse(ctx, -13, -8, 7, 5, pad); ellipse(ctx, 13, -8, 7, 5, pad);
    this.gearGlow(ctx, L, { chest: [0, 2], shoulders: [13, -8], waist: [0, 8], legs: [0, 15], feet: [0, 22], back: [-15, 8] });
    // head and helm
    circle(ctx, 0, -18, 11.5, hurtFlash ? '#ffffff' : '#f0c8a2');
    ctx.fillStyle = hurtFlash ? '#ffffff' : L.head?.color ?? '#9aa6b8'; ctx.beginPath(); ctx.arc(0, -21, 13, Math.PI * .95, Math.PI * 2.05); ctx.lineTo(13, -16); ctx.lineTo(-13, -16); ctx.closePath(); ctx.fill();
    this.gearGlow(ctx, L, { head: [0, -28] });
    rect(ctx, 2, -20, 11, 3, '#2a2430');
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-2, -33); ctx.quadraticCurveTo(-18 - wave, -40, -20 - wave, -24); ctx.quadraticCurveTo(-10, -32, -1, -30); ctx.fill();
    // shield on the back arm
    ctx.save(); ctx.translate(-12, 2);
    ctx.fillStyle = '#3f5a8a'; ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.lineTo(9, 2); ctx.quadraticCurveTo(0, 16, -9, 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c9a44c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e8c46a'; star(ctx, 0, -3, 5, 4, .4); ctx.fill();
    ctx.restore();
    // sword arm: resting, or swinging through a Slash
    const swing = h.castTime > 0 ? 1 - h.castTime / .26 : 0, ang = storm ? t * 22 : h.castTime > 0 ? -2.1 + swing * 2.9 : -.5;
    ctx.save(); ctx.translate(12, 0); ctx.rotate(ang);
    const W = this.wpn(L, '', '#e6ecf5', '#c9a44c'), bl = 38 + Math.max(0, W.tier) * 4, bw = W.tier === 1 ? 4 : 3;
    rect(ctx, -2, -4, 4, 10, '#6a4a30'); rect(ctx, -7 - Math.max(0, W.tier), -6, 14 + Math.max(0, W.tier) * 2, 3, W.gem);
    ctx.fillStyle = W.metal; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(-bw, -bl * .6); ctx.lineTo(-2.5, -bl); ctx.lineTo(0, -bl - 6); ctx.lineTo(2.5, -bl); ctx.lineTo(bw, -bl * .6); ctx.lineTo(3, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = W.tier === 3 ? W.gem : 'rgba(255,255,255,.7)'; ctx.fillRect(-1, -bl, 1.5, bl - 8);
    if (W.tier >= 0) circle(ctx, 0, -4.5, 2, W.gem);
    if (W.glow || W.tier === 3) glow(ctx, 0, -bl * .6, 20, W.gem, .55);
    if (h.castTime > 0 || storm) glow(ctx, 0, -30, 26, W.tier < 0 ? '#ffd0a0' : W.gem, .7);
    ctx.restore();
    circle(ctx, 12, 0, 4, L.hands?.color ?? '#f0c8a2');
    ctx.restore();
    this.lights.push({ x: h.x, y: h.y - 10, r: 320, a: 1 });
  }

  /** Lyra: long pale hair, a crystal circlet, a blue over-robe on white, and a staff crowned with a floating ice shard. */
  private drawFrostMage(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time, h = e.hero, moving = Math.hypot(h.vx, h.vy) > 30, flip = h.faceX < -.05 ? -1 : 1, L = this.heroLook(e);
    for (const a of e.afterimages) { ctx.globalAlpha = a.life / .28 * .5; ellipse(ctx, a.x, a.y + 4, 16, 24, '#bfeaff'); circle(ctx, a.x, a.y - 18, 12, '#eaf8ff'); }
    ctx.globalAlpha = 1;
    const bob = moving ? -Math.abs(Math.sin(h.walkTime)) * 4 : Math.sin(t * 2.2) * 1.2;
    shadow(ctx, h.x, h.y + 20, 20, 7, .3);
    if (h.shieldTime > 0) {
      // Ice Barrier: a faceted shell of ice.
      const a = Math.min(1, h.shieldTime * 2);
      glow(ctx, h.x, h.y - 8, 72, '#9fe4ff', .5 * a);
      ctx.save(); ctx.translate(h.x, h.y - 8); ctx.rotate(t * .4);
      ctx.fillStyle = `rgba(200,240,255,${.18 * a})`; ctx.strokeStyle = `rgba(230,250,255,${.85 * a})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const q = i * TAU / 6, r = 46 + Math.sin(t * 8 + i) * 1.5; i ? ctx.lineTo(Math.cos(q) * r, Math.sin(q) * r) : ctx.moveTo(Math.cos(q) * r, Math.sin(q) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    const hurtFlash = h.hurtTime > 0 && Math.floor(t * 16) % 2 === 0;
    ctx.save(); ctx.translate(h.x, h.y + bob); ctx.scale(flip, 1);
    const speed = Math.min(1, Math.hypot(h.vx, h.vy) / 265), wave = Math.sin(t * 7) * (2 + speed * 4);
    ctx.fillStyle = L.back?.color ?? '#9fd0ee'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-20 - speed * 10, 6 + wave, -21 - speed * 13, 20 + wave * .6); ctx.lineTo(-4, 20); ctx.closePath(); ctx.fill();
    const step = moving ? Math.sin(h.walkTime) * 5 : 0;
    ellipse(ctx, -6 + step, 21, 5, 3, L.feet?.color ?? '#3a4a6a'); ellipse(ctx, 6 - step, 21, 5, 3, L.feet?.color ?? '#3a4a6a');
    // White under-robe, then the open blue over-robe.
    ctx.fillStyle = hurtFlash ? '#ffffff' : '#e6f4ff'; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(8, -4); ctx.lineTo(12, 20); ctx.quadraticCurveTo(0, 24, -12, 20); ctx.closePath(); ctx.fill();
    const robe = hurtFlash ? '#ffffff' : L.chest?.color ?? '#5a8ac8';
    ctx.fillStyle = robe; ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(-4, -4); ctx.lineTo(-5, 22); ctx.quadraticCurveTo(-12, 22, -17, 19); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, -4); ctx.lineTo(4, -4); ctx.lineTo(5, 22); ctx.quadraticCurveTo(12, 22, 17, 19); ctx.closePath(); ctx.fill();
    if (L.legs) { ctx.fillStyle = L.legs.color; ctx.fillRect(-12, 15, 24, 4); }
    ctx.fillStyle = L.waist?.color ?? '#e6f4ff'; ctx.fillRect(-13, 5, 26, 3); ctx.fillStyle = '#9fe4ff'; star(ctx, 0, 6.5, 3.4, 4, .45, t); ctx.fill();
    if (L.shoulders) { ellipse(ctx, -12, -4, 7, 4.5, L.shoulders.color); ellipse(ctx, 12, -4, 7, 4.5, L.shoulders.color); }
    this.gearGlow(ctx, L, { chest: [8, 8], shoulders: [12, -4], waist: [0, 6], legs: [0, 17], feet: [0, 21], back: [-16, 8] });
    // Long pale hair falling past the shoulders.
    ctx.fillStyle = '#dff2ff'; ctx.beginPath(); ctx.moveTo(-12, -22); ctx.quadraticCurveTo(-18, -4, -12 - wave * .3, 6); ctx.lineTo(-5, -12); ctx.closePath(); ctx.fill();
    circle(ctx, 0, -17, 12.5, hurtFlash ? '#ffffff' : '#f6dcc8');
    ctx.fillStyle = '#dff2ff'; ctx.beginPath(); ctx.arc(0, -19, 13, Math.PI * .95, Math.PI * 2.02); ctx.quadraticCurveTo(8, -22, 2, -21); ctx.quadraticCurveTo(-6, -20, -12, -14); ctx.closePath(); ctx.fill();
    const blink = (t % 3.9) < .12;
    if (blink) { ctx.fillStyle = '#2a4a6a'; ctx.fillRect(3, -17, 5, 1.4); } else { circle(ctx, 5.5, -16.5, 2, '#2a4a6a'); circle(ctx, 6.2, -17.3, .7, '#fff'); }
    circle(ctx, 8, -11.5, 2.2, 'rgba(140,200,240,.35)');
    // Crystal circlet.
    ctx.strokeStyle = L.head?.color ?? '#bfeaff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, -19, 12.5, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    glow(ctx, 2, -32, 12, '#9fe4ff', .8); ctx.fillStyle = '#eaf8ff'; ctx.beginPath(); ctx.moveTo(2, -38); ctx.lineTo(5, -31); ctx.lineTo(2, -27); ctx.lineTo(-1, -31); ctx.closePath(); ctx.fill();
    this.gearGlow(ctx, L, { head: [2, -31] });
    // Staff with a floating ice shard.
    const raise = h.castTime > 0 ? h.castTime / .3 : 0, sa = -.3 - raise * .7;
    ctx.save(); ctx.translate(12, 2); ctx.rotate(sa);
    const W = this.wpn(L, '#c8d8e8', '', '#9fe4ff'), sz = 1 + Math.max(0, W.tier) * .12;
    ctx.strokeStyle = W.wood; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -26); ctx.stroke();
    const fy = -34 + Math.sin(t * 3) * 2;
    this.staffCrown(ctx, fy + 6, W.tier, W.gem);
    glow(ctx, 0, fy, 18 + raise * 24 + (W.glow ? 10 : 0), W.gem, .9);
    ctx.fillStyle = W.tier < 0 ? '#eaf8ff' : '#ffffff'; ctx.beginPath(); ctx.moveTo(0, fy - 9 * sz); ctx.lineTo(5 * sz, fy); ctx.lineTo(0, fy + 7 * sz); ctx.lineTo(-5 * sz, fy); ctx.closePath(); ctx.fill();
    ctx.restore();
    circle(ctx, 11, 0, 4, L.hands?.color ?? '#f6dcc8');
    ctx.restore();
    const tipX = h.x + flip * (12 + Math.sin(-sa) * 34), tipY = h.y + bob + 2 - Math.cos(sa) * 34;
    if (Math.random() < .25) this.pushAmbient({ x: tipX + rand(-4, 4), y: tipY, vx: rand(-10, 10), vy: rand(10, 30), life: .7, max: .7, size: 1.8, rot: 0, vr: 0, kind: 'mote', color: '#dff6ff', phase: 0 });
    this.lights.push({ x: h.x, y: h.y - 10, r: 320, a: 1 }, { x: tipX, y: tipY, r: 110 + raise * 120, color: '#9fe4ff', a: .9 });
  }

  /** Riven: a slim hooded figure with a mask, glowing violet eyes, a short scarf-cape and a dagger in each hand. */
  private drawAssassin(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time, h = e.hero, moving = Math.hypot(h.vx, h.vy) > 30, flip = h.faceX < -.05 ? -1 : 1, L = this.heroLook(e);
    for (const a of e.afterimages) { ctx.globalAlpha = a.life / .28 * .5; ellipse(ctx, a.x, a.y + 4, 14, 22, '#6a5a9a'); circle(ctx, a.x, a.y - 18, 11, '#8a7ab8'); }
    ctx.globalAlpha = 1;
    const bob = moving ? -Math.abs(Math.sin(h.walkTime)) * 3 : Math.sin(t * 2.6) * 1;
    shadow(ctx, h.x, h.y + 20, 18, 6, .32);
    const hurtFlash = h.hurtTime > 0 && Math.floor(t * 16) % 2 === 0;
    ctx.save(); ctx.translate(h.x, h.y + bob); ctx.scale(flip, 1);
    const speed = Math.min(1, Math.hypot(h.vx, h.vy) / 290), wave = Math.sin(t * 9) * (2 + speed * 5);
    // Scarf tail streaming behind.
    ctx.fillStyle = L.back?.color ?? '#2e2440'; ctx.beginPath(); ctx.moveTo(-6, -12); ctx.quadraticCurveTo(-20 - speed * 12, -8 + wave, -26 - speed * 16, 2 + wave); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill();
    const step = moving ? Math.sin(h.walkTime) * 6 : 0, legs = L.legs?.color ?? '#3a3448';
    rect(ctx, -7 + step, 8, 5, 12, legs); rect(ctx, 2 - step, 8, 5, 12, legs);
    ellipse(ctx, -4.5 + step, 21, 5, 2.6, L.feet?.color ?? '#241c2c'); ellipse(ctx, 4.5 - step, 21, 5, 2.6, L.feet?.color ?? '#241c2c');
    const body = hurtFlash ? '#ffffff' : L.chest?.color ?? '#4a3e62';
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(9, 10); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a4a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, -6); ctx.lineTo(8, 8); ctx.stroke();
    rect(ctx, -10, 5, 20, 3, L.waist?.color ?? '#6a4a3a');
    if (L.shoulders) { ellipse(ctx, -10, -7, 5.5, 3.6, L.shoulders.color); ellipse(ctx, 10, -7, 5.5, 3.6, L.shoulders.color); }
    this.gearGlow(ctx, L, { chest: [0, 0], shoulders: [10, -7], waist: [0, 6], legs: [0, 14], feet: [0, 21], back: [-14, -4] });
    // Hooded head: skin, mask, violet eyes.
    circle(ctx, 0, -18, 10.5, hurtFlash ? '#ffffff' : '#e8c4a8');
    ctx.fillStyle = '#2e2440'; ctx.beginPath(); ctx.moveTo(-10, -15); ctx.quadraticCurveTo(0, -12, 11, -15); ctx.lineTo(10, -8); ctx.quadraticCurveTo(0, -5, -10, -8); ctx.closePath(); ctx.fill();
    glow(ctx, 5.5, -19, 7, '#b69cff', .7); ellipse(ctx, 5.5, -19, 2.2, 1.4, '#d8c8ff'); ellipse(ctx, 0, -19, 1.8, 1.2, '#b69cff');
    ctx.fillStyle = hurtFlash ? '#ffffff' : L.head?.color ?? '#3a2e52';
    ctx.beginPath(); ctx.moveTo(-12, -12); ctx.quadraticCurveTo(-14, -30, -4, -34); ctx.quadraticCurveTo(-10, -26 + wave * .2, -18, -30); ctx.quadraticCurveTo(-8, -38, 4, -32); ctx.quadraticCurveTo(13, -28, 12, -14); ctx.quadraticCurveTo(9, -24, 1, -25); ctx.quadraticCurveTo(-8, -24, -12, -12); ctx.closePath(); ctx.fill();
    this.gearGlow(ctx, L, { head: [0, -28] });
    // Daggers: the front one thrusts forward with each stab.
    const thrust = h.castTime > 0 ? Math.sin((1 - h.castTime / .2) * Math.PI) : 0, W = this.wpn(L, '', '#eef0f8', '#e0c8ff'), dl = Math.max(0, W.tier) * 2;
    const dagger = (x: number, y: number, a: number, len: number) => {
      len += dl;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      rect(ctx, -1.5, -2, 3, 6, '#3a2a26'); rect(ctx, -4, -3, 8, 2, W.tier < 0 ? '#d8dce8' : W.gem);
      ctx.fillStyle = W.metal; ctx.beginPath(); ctx.moveTo(-2 - (W.tier === 1 ? 1 : 0), -3); if (W.tier >= 2) ctx.lineTo(-2.6, -3 - len * .5); ctx.lineTo(0, -3 - len); if (W.tier >= 2) ctx.lineTo(2.6, -3 - len * .5); ctx.lineTo(2 + (W.tier === 1 ? 1 : 0), -3); ctx.closePath(); ctx.fill();
      if (W.tier === 3) { ctx.strokeStyle = W.gem; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -2 - len); ctx.stroke(); }
      if (thrust > .2 || W.glow) glow(ctx, 0, -len, 12, W.gem, Math.max(thrust * .8, W.glow ? .4 : 0));
      ctx.restore();
    };
    dagger(-9, 2, -2.4, 13);
    const hand = L.hands?.color ?? '#2a2236';
    circle(ctx, -9, 2, 3.4, hand);
    dagger(10 + thrust * 12, 0 - thrust * 2, 1.65, 15);
    circle(ctx, 10 + thrust * 12, 0 - thrust * 2, 3.6, hand);
    ctx.restore();
    if (e.nextCrit && Math.random() < .4) this.pushAmbient({ x: h.x + flip * 18 + rand(-4, 4), y: h.y - 4, vx: rand(-8, 8), vy: rand(-30, -10), life: .5, max: .5, size: 1.6, rot: 0, vr: 0, kind: 'mote', color: '#e0c8ff', phase: 0 });
    this.lights.push({ x: h.x, y: h.y - 10, r: e.stealthT > 0 ? 200 : 300, a: 1 });
  }
  /** Wren: a green hooded cloak over leather, an auburn braid, a quiver on her back and a longbow she draws to shoot. */
  private drawHunter(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time, h = e.hero, moving = Math.hypot(h.vx, h.vy) > 30, flip = h.faceX < -.05 ? -1 : 1, L = this.heroLook(e);
    for (const a of e.afterimages) { ctx.globalAlpha = a.life / .28 * .45; ellipse(ctx, a.x, a.y + 4, 16, 22, '#c8e6a0'); circle(ctx, a.x, a.y - 18, 11, '#e6f4d0'); }
    ctx.globalAlpha = 1;
    const rolling = h.dashTime > 0;
    const bob = moving ? -Math.abs(Math.sin(h.walkTime)) * 3.5 : Math.sin(t * 2.2) * 1.1;
    shadow(ctx, h.x, h.y + 20, 19, 6.5, .3);
    const hurtFlash = h.hurtTime > 0 && Math.floor(t * 16) % 2 === 0;
    ctx.save(); ctx.translate(h.x, h.y + bob); ctx.scale(flip, 1);
    if (rolling) { ctx.translate(0, 6); ctx.rotate((1 - h.dashTime / .2) * TAU * .9); ctx.translate(0, -6); }
    const speed = Math.min(1, Math.hypot(h.vx, h.vy) / 275), wave = Math.sin(t * 7) * (2 + speed * 4);
    // Hooded cloak behind, with the quiver poking over the shoulder.
    ctx.fillStyle = L.back?.color ?? '#3f6a3a'; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.quadraticCurveTo(-21 - speed * 10, 4 + wave, -20 - speed * 14, 21 + wave * .6); ctx.lineTo(-2, 20); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(-8, -6); ctx.rotate(-.35); rect(ctx, -4, -16, 8, 22, '#6a4a30'); for (let i = 0; i < 3; i++) { rect(ctx, -3 + i * 2.6, -22, 1.4, 7, '#e8e0c8'); ctx.fillStyle = '#c0392b'; ctx.fillRect(-3.4 + i * 2.6, -24, 2.2, 3); } ctx.restore();
    const step = moving ? Math.sin(h.walkTime) * 5.5 : 0, legs = L.legs?.color ?? '#5a4a36';
    rect(ctx, -7 + step, 8, 5.5, 12, legs); rect(ctx, 2 - step, 8, 5.5, 12, legs);
    ellipse(ctx, -4.5 + step, 21, 5.5, 2.8, L.feet?.color ?? '#4b3025'); ellipse(ctx, 4.5 - step, 21, 5.5, 2.8, L.feet?.color ?? '#4b3025');
    // Leather tunic with a belt of pouches.
    ctx.fillStyle = hurtFlash ? '#ffffff' : L.chest?.color ?? '#8a6a44'; ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(11, -8); ctx.lineTo(12, 12); ctx.quadraticCurveTo(0, 16, -12, 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,24,.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 11); ctx.stroke();
    rect(ctx, -12, 4, 24, 3.4, L.waist?.color ?? '#5a3a24'); rect(ctx, 5, 5, 5, 5, '#6a4a30');
    if (L.shoulders) { ellipse(ctx, -11, -7, 6.5, 4.2, L.shoulders.color); ellipse(ctx, 11, -7, 6.5, 4.2, L.shoulders.color); }
    this.gearGlow(ctx, L, { chest: [0, 2], shoulders: [11, -7], waist: [0, 6], legs: [0, 14], feet: [0, 21], back: [-15, 6] });
    // Head: auburn braid, freckles and the hood.
    ctx.strokeStyle = '#a8502e'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8, -16); ctx.quadraticCurveTo(-15, -6, -12 - wave * .3, 4); ctx.stroke();
    circle(ctx, 0, -18, 11.5, hurtFlash ? '#ffffff' : '#f0c8a2');
    ctx.fillStyle = '#a8502e'; ctx.beginPath(); ctx.arc(0, -20, 11.8, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(4, -22, -2, -21); ctx.closePath(); ctx.fill();
    const blink = (t % 4.1) < .12;
    if (blink) { ctx.fillStyle = '#2d3a20'; ctx.fillRect(3, -18, 5, 1.4); } else { circle(ctx, 5.5, -17.5, 2, '#2d3a20'); circle(ctx, 6.2, -18.3, .7, '#fff'); }
    for (const [fx, fy] of [[3, -13], [5.5, -12.4], [8, -13.2]]) circle(ctx, fx, fy, .7, 'rgba(160,90,50,.6)');
    ctx.fillStyle = hurtFlash ? '#ffffff' : L.head?.color ?? '#4a7a44';
    ctx.beginPath(); ctx.moveTo(-12, -12); ctx.quadraticCurveTo(-14, -31, 0, -33); ctx.quadraticCurveTo(12, -32, 13, -20); ctx.quadraticCurveTo(9, -27, 1, -27); ctx.quadraticCurveTo(-8, -26, -9, -12); ctx.closePath(); ctx.fill();
    this.gearGlow(ctx, L, { head: [0, -28] });
    // Longbow in the front hand; it is drawn back while shooting.
    const draw = h.castTime > 0 ? Math.sin((1 - h.castTime / .3) * Math.PI) : 0, W = this.wpn(L, '#7a5230', '', '#e8e0c8');
    ctx.save(); ctx.translate(13, -2);
    ctx.strokeStyle = W.wood; ctx.lineWidth = 3 + (W.tier >= 2 ? .6 : 0); ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(10 + draw * 2, 0, 0, 24); ctx.stroke();
    if (W.tier >= 2) { ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-4, -27, -3, -31); ctx.moveTo(0, 24); ctx.quadraticCurveTo(-4, 27, -3, 31); ctx.stroke(); }
    if (W.tier >= 0) circle(ctx, 7 + draw, 0, 2.4, W.gem);
    if (W.glow || W.tier === 3) glow(ctx, 6, 0, 22, W.gem, .5);
    ctx.strokeStyle = W.tier === 3 ? W.gem : '#e8e0c8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(-draw * 9, 0); ctx.lineTo(0, 24); ctx.stroke();
    if (draw > .15) { rect(ctx, -draw * 9, -.7, 20 + draw * 8, 1.4, '#e8e0c8'); ctx.fillStyle = '#c8c8d0'; ctx.beginPath(); ctx.moveTo(12 + draw * 2, -3); ctx.lineTo(17 + draw * 2, 0); ctx.lineTo(12 + draw * 2, 3); ctx.fill(); }
    ctx.restore();
    circle(ctx, 13, 0, 3.8, L.hands?.color ?? '#6a4a30');
    ctx.restore();
    this.lights.push({ x: h.x, y: h.y - 10, r: 320, a: 1 });
  }
  /** Fenn (a grey wolf with a green scarf) and Call of the Wild's glowing spirit wolves. */
  private drawPet(ctx: CanvasRenderingContext2D, p: Pet, e: GameEngine) {
    const t = this.time, r = p.spirit ? 16 : 18, run = p.moving ? Math.sin(p.walk) : Math.sin(t * 3) * .15, leap = p.leapT > 0;
    const fade = p.spirit ? Math.min(1, p.life * 2) : 1;
    ctx.save(); ctx.globalAlpha = fade * (p.spirit ? .8 : 1);
    shadow(ctx, p.x, p.y + r * .75, r * 1.2, r * .38, leap ? .12 : .25);
    ctx.translate(p.x, p.y - (leap ? 14 : Math.abs(run) * 2)); ctx.scale(p.face, 1); if (leap) ctx.rotate(-.25); else if (p.bite > 0) ctx.rotate(.12);
    const wild = e.wildT > 0 && !p.spirit, fur = p.spirit ? '#9fe8b0' : '#8a8a96', dark = p.spirit ? '#5fae7a' : '#5a5a66';
    if (p.spirit || wild) glow(ctx, 0, -4, r * 2.4, p.spirit ? '#9fe8b0' : '#ffd35c', .5);
    ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const [lx, ph] of [[-.6, 1], [-.3, -1], [.35, -1], [.62, 1]] as Array<[number, number]>) { ctx.beginPath(); ctx.moveTo(lx * r, r * .2); ctx.lineTo(lx * r + run * ph * 6, r * .74); ctx.stroke(); }
    ctx.strokeStyle = fur; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-r * .9, -r * .1); ctx.quadraticCurveTo(-r * 1.4, -r * .6 + Math.sin(t * 9) * 5, -r * 1.55, -r * .25); ctx.stroke();
    ellipse(ctx, 0, 0, r, r * .52, fur); ellipse(ctx, r * .1, r * .18, r * .6, r * .22, p.spirit ? 'rgba(255,255,255,.3)' : '#d8d8e0');
    ellipse(ctx, r * .85, -r * .32, r * .42, r * .34, fur);
    ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(r * 1.05, -r * .38); ctx.lineTo(r * 1.5, -r * .2); ctx.lineTo(r * 1.05, -r * .1); ctx.fill();
    for (const ex of [.62, .92]) { ctx.beginPath(); ctx.moveTo(r * ex - 5, -r * .55); ctx.lineTo(r * ex, -r * .98); ctx.lineTo(r * ex + 5, -r * .55); ctx.fill(); }
    circle(ctx, r * 1.47, -r * .22, 2, '#2a2a30');
    circle(ctx, r * 1.02, -r * .42, 2.2, p.spirit ? '#ffffff' : wild ? '#ffd35c' : '#2a2a30');
    if (!p.spirit) { ctx.fillStyle = '#4f8a3a'; ctx.beginPath(); ctx.moveTo(r * .5, -r * .5); ctx.lineTo(r * .7, r * .05); ctx.lineTo(r * .45, r * .05); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(r * .55, -r * .2); ctx.lineTo(r * .15, r * .4); ctx.lineTo(r * .4, r * .45); ctx.closePath(); ctx.fill(); }
    if (p.bite > 0) { ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * (1.12 + i * .1), -r * .16); ctx.lineTo(r * (1.16 + i * .1), -r * .04); ctx.lineTo(r * (1.2 + i * .1), -r * .16); ctx.fill(); } }
    ctx.restore();
    if (p.spirit && Math.random() < .2) this.pushAmbient({ x: p.x + rand(-10, 10), y: p.y - 10, vx: rand(-10, 10), vy: rand(-30, -10), life: .6, max: .6, size: 1.8, rot: 0, vr: 0, kind: 'mote', color: '#b9f2c9', phase: 0 });
    if (p.spirit) this.lights.push({ x: p.x, y: p.y, r: 80, color: '#9fe8b0', a: .7 });
  }
  /** A Snare Trap: iron jaws half-hidden in leaves, snapping shut when sprung. */
  private drawTrap(ctx: CanvasRenderingContext2D, tr: Trap) {
    const k = tr.sprung ? Math.min(1, tr.t / .7) : Math.min(1, tr.t * 2), shut = tr.sprung ? 1 : 0;
    ctx.save(); ctx.globalAlpha = k; ctx.translate(tr.x, tr.y); ctx.scale(1, .55);
    ctx.strokeStyle = 'rgba(185,226,122,.55)'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -this.time * 20; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#6a6a74'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#b8bcc8';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r0 = 18, r1 = 18 - 9 * (1 - shut * .9); ctx.beginPath(); ctx.moveTo(Math.cos(a - .15) * r0, Math.sin(a - .15) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a + .15) * r0, Math.sin(a + .15) * r0); ctx.fill(); }
    circle(ctx, 0, 0, 4, '#8a6a4a');
    for (let i = 0; i < 4; i++) ellipse(ctx, Math.cos(i * 1.7) * 22, Math.sin(i * 1.7) * 14, 6, 3, i % 2 ? '#6f9a4a' : '#a3c46a', i);
    ctx.restore();
  }
  /** The mount under the hero: a pony, boar, stag, wolf, drake or unicorn, drawn side-on at the hero's feet. */
  private drawMount(ctx: CanvasRenderingContext2D, e: GameEngine, front: boolean) {
    const id = e.mountId; if (!id) return;
    const m = MOUNTS[id], h = e.hero, t = this.time, flip = h.faceX < -.05 ? -1 : 1, moving = Math.hypot(h.vx, h.vy) > 30;
    const gait = moving ? h.walkTime : t * .8, bob = moving ? Math.abs(Math.sin(gait)) * 2.5 : 0, s = .7 + .3 * e.mountFx;
    ctx.save(); ctx.translate(h.x, h.y - bob); ctx.scale(flip * s, s);
    const body = m.body, dark = shade(body, -.3), mane = m.mane, lizard = id === 'drake', wolf = id === 'frostwolf', boar = id === 'boar';
    if (!front) {
      shadow(ctx, 0, 20 + bob, 38, 8, .3);
      if (m.glow) glow(ctx, 0, 0, 60, m.glow, .35);
      // Far legs, the tail, then the body.
      ctx.strokeStyle = dark; ctx.lineWidth = boar || lizard ? 6 : 5; ctx.lineCap = 'round';
      const leg = (x: number, ph: number) => { const sw = moving ? Math.sin(gait + ph) * 7 : 0; ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x + sw, lizard ? 16 : 20); ctx.stroke(); };
      leg(-18, 0); leg(16, Math.PI);
      ctx.strokeStyle = lizard ? body : mane; ctx.lineWidth = lizard ? 7 : wolf ? 8 : 5;
      ctx.beginPath(); ctx.moveTo(-28, -4); ctx.quadraticCurveTo(-40, lizard ? 4 : -2 + Math.sin(t * 5) * 3, -46, lizard ? 12 : 10); ctx.stroke();
      if (lizard) { circle(ctx, -46, 12, 3, m.glow!); glow(ctx, -46, 12, 14, m.glow!, .8); }
      ellipse(ctx, 0, -3, lizard ? 32 : 30, lizard ? 10 : boar ? 14 : 12, body);
      ellipse(ctx, 2, 3, 22, 5, 'rgba(255,255,255,.12)');
      if (boar) { ctx.fillStyle = mane; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-18 + i * 6, -14); ctx.lineTo(-15 + i * 6, -21); ctx.lineTo(-12 + i * 6, -14); ctx.fill(); } }
      if (lizard) { ctx.fillStyle = mane; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-20 + i * 9, -11); ctx.lineTo(-16 + i * 9, -18); ctx.lineTo(-12 + i * 9, -11); ctx.fill(); } }
      // Saddle and blanket.
      ctx.fillStyle = '#8a2a2a'; ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, -12); ctx.lineTo(14, 2); ctx.lineTo(-14, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8c46a'; ctx.fillRect(-14, 0, 28, 2);
      ellipse(ctx, 0, -12, 11, 4, '#5a3a24');
    } else {
      // Near legs, neck and head in front of the rider.
      ctx.strokeStyle = shade(body, -.12); ctx.lineWidth = boar || lizard ? 6 : 5; ctx.lineCap = 'round';
      const leg = (x: number, ph: number) => { const sw = moving ? Math.sin(gait + ph) * 7 : 0; ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x + sw, lizard ? 16 : 20); ctx.stroke(); ellipse(ctx, x + sw, lizard ? 17 : 21, 3.2, 2, lizard ? dark : '#2a2020'); };
      leg(-12, Math.PI); leg(22, 0);
      if (boar || lizard) {
        ellipse(ctx, 30, -6, 13, 10, body); ellipse(ctx, 41, -3, 6, 5, lizard ? body : '#c89878');
        circle(ctx, 33, -9, 2, lizard ? '#ffe38a' : '#1a1010'); if (lizard) glow(ctx, 33, -9, 8, '#ffb347', .8);
        if (boar) { ctx.strokeStyle = '#fff4e0'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(40, 0); ctx.quadraticCurveTo(46, -2, 45, -8); ctx.stroke(); ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(26, -14); ctx.lineTo(30, -22); ctx.lineTo(33, -14); ctx.fill(); }
        if (lizard && moving && Math.random() < .3) this.pushAmbient({ x: h.x + flip * 46 * s, y: h.y - 4, vx: flip * rand(20, 50), vy: rand(-30, -10), life: .5, max: .5, size: 2, rot: 0, vr: 0, kind: 'mote', color: '#ffb347', phase: 0 });
      } else {
        // Neck rising to the head: horse, stag or wolf.
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(18, -12); ctx.quadraticCurveTo(28, -24, 30, -34); ctx.lineTo(38, -30); ctx.quadraticCurveTo(34, -16, 28, 0); ctx.closePath(); ctx.fill();
        if (wolf) { ellipse(ctx, 34, -30, 11, 9, body); ctx.beginPath(); ctx.moveTo(40, -33); ctx.lineTo(52, -28); ctx.lineTo(40, -24); ctx.fill(); for (const ex of [28, 34]) { ctx.beginPath(); ctx.moveTo(ex - 3, -37); ctx.lineTo(ex, -46); ctx.lineTo(ex + 3, -37); ctx.fill(); } circle(ctx, 51, -28, 1.8, '#2a2a30'); circle(ctx, 38, -32, 2, '#6fb8ff'); }
        else { ctx.save(); ctx.translate(36, -33); ctx.rotate(.5); ellipse(ctx, 4, 0, 13, 6.5, body); ctx.restore(); circle(ctx, 35, -35, 1.8, '#1a1010'); ellipse(ctx, 47, -26, 3, 2, shade(body, -.35)); }
        ctx.fillStyle = mane;
        if (id === 'pony' || id === 'unicorn') { ctx.beginPath(); ctx.moveTo(18, -14); ctx.quadraticCurveTo(22 - Math.sin(t * 6) * 2, -28, 30, -40); ctx.lineTo(27, -30); ctx.quadraticCurveTo(22, -20, 22, -10); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(28, -38); ctx.lineTo(31, -45); ctx.lineTo(33, -38); ctx.fill(); }
        if (id === 'unicorn') { ctx.fillStyle = '#fff1b8'; ctx.beginPath(); ctx.moveTo(35, -40); ctx.lineTo(44, -56); ctx.lineTo(39, -38); ctx.closePath(); ctx.fill(); glow(ctx, 42, -50, 16, '#fff1b8', .9); }
        if (id === 'stag') { ctx.strokeStyle = '#e8d8b0'; ctx.lineWidth = 2.4; for (const side of [0, 5]) { ctx.beginPath(); ctx.moveTo(31 + side, -39); ctx.lineTo(27 + side, -54); ctx.moveTo(29 + side, -46); ctx.lineTo(22 + side, -50); ctx.moveTo(28 + side, -51); ctx.lineTo(33 + side, -58); ctx.stroke(); } glow(ctx, 30, -50, 18, '#b9f29d', .6); }
        if (wolf) { ctx.beginPath(); ctx.moveTo(16, -12); ctx.quadraticCurveTo(22, -30, 30, -38); ctx.lineTo(26, -20); ctx.closePath(); ctx.fill(); }
      }
    }
    ctx.restore();
    if (front && m.glow) this.lights.push({ x: h.x, y: h.y - 10, r: 140, color: m.glow, a: .6 });
  }
  // ───────────────────────────── enemies
  private drawEnemy(ctx: CanvasRenderingContext2D, en: Enemy, e: GameEngine) {
    const t = this.time + en.homeX * .01, h = e.hero;
    const spawn = en.spawnT > 0 ? 1 - en.spawnT / .6 : 1;
    const look = { x: clamp((h.x - en.x) / 150, -1, 1), y: clamp((h.y - en.y) / 150, -1, 1) };
    const flash = en.hitFlash > 0;
    const sc = en.heroic ? 1.6 : en.elite ? 1.3 : 1;
    if (en.heroic && en.burrowT <= 0) {
      // A heroic creature stands in a slow violet ring of runes.
      ctx.save(); ctx.translate(en.x, en.y + en.r * .55); ctx.scale(1, .45);
      glow(ctx, 0, 0, en.r * 2.2, en.enraged ? '#ff6b6b' : '#c98aff', .45);
      ctx.strokeStyle = en.enraged ? 'rgba(255,120,110,.7)' : 'rgba(232,160,255,.65)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.arc(0, 0, en.r * 1.25, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
    ctx.save(); ctx.translate(en.x, en.y); ctx.scale(spawn, spawn);
    if (sc !== 1) ctx.scale(sc, sc);
    if (en.rage > .15) glow(ctx, 0, en.kind === 'wisp' || en.kind === 'frostwraith' ? -10 : -en.r * .15, en.r * (en.boss ? 2 : 2.5), '#ff3b2e', .5 * en.rage * (.85 + Math.sin(t * 9) * .15));
    if (en.windup > 0 && !en.boss && (en.kind === 'gloomling' || en.kind === 'shadewolf')) {
      const r = en.kind === 'shadewolf' ? 115 : 80; ctx.fillStyle = 'rgba(255,90,70,.12)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,140,110,.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 30; ctx.stroke(); ctx.setLineDash([]);
    }
    const trem = en.windup > 0 ? Math.sin(t * 60) * 1.5 : 0;
    const base = sc !== 1 ? { ...en, r: en.r / sc } : en;
    if (en.stunT > 0) ctx.globalAlpha = .85;
    switch (en.kind) {
      case 'gloomling': this.drawGloomling(ctx, base, t, look, flash, trem); break;
      case 'thornling': this.drawThornling(ctx, base, t, look, flash, trem); break;
      case 'wisp': this.drawWisp(ctx, base, t, look, flash); break;
      case 'bristleboar': this.drawBoar(ctx, base, t, look, flash, trem); break;
      case 'sporecap': this.drawSporecap(ctx, base, t, look, flash, trem); break;
      case 'shadewolf': this.drawWolf(ctx, base, t, look, flash, trem); break;
      case 'webspinner': this.drawSpider(ctx, base, t, look, flash, trem); break;
      case 'frostwraith': this.drawWraith(ctx, base, t, look, flash); break;
      case 'cragGolem': this.drawGolem(ctx, base, t, look, flash, trem); break;
      case 'emberImp': this.drawImp(ctx, base, t, look, flash); break;
      case 'ashScorpion': this.drawScorpion(ctx, base, t, look, flash, trem); break;
      case 'magmaHulk': this.drawHulk(ctx, base, t, look, flash, trem); break;
      case 'cinderTyrant': this.drawTyrant(ctx, en, t, look, flash); break;
      case 'mossback': this.drawMossback(ctx, en, t, look, flash, e); break;
      case 'brambleWarden': this.drawWarden(ctx, en, t, look, flash, e); break;
      case 'hollowStar': this.drawHollowStar(ctx, en, t, flash, e); break;
      case 'eclipse': this.drawEclipse(ctx, en, t, flash); break;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (en.burrowT > 0) return;
    if (en.frozenT > 0) {
      // Frozen solid: a block of ice around the creature.
      const r = en.r * (en.elite ? 1 : 1), k = Math.min(1, en.frozenT * 2);
      ctx.fillStyle = `rgba(190,235,255,${.32 * k})`; ctx.strokeStyle = `rgba(235,250,255,${.8 * k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(en.x - r * 1.15, en.y - r * 1.55, r * 2.3, r * 2.25, 6); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.6 * k})`; ctx.beginPath(); ctx.moveTo(en.x - r * .8, en.y - r * 1.3); ctx.lineTo(en.x - r * .3, en.y - r * .6); ctx.stroke();
    } else if (en.chillT > 0) glow(ctx, en.x, en.y - en.r * .3, en.r * 1.6, '#9fe4ff', .35);
    if (en.stunT > 0 && en.frozenT <= 0) for (let i = 0; i < 3; i++) { const a = t * 6 + i * TAU / 3; ctx.fillStyle = '#bfefff'; star(ctx, en.x + Math.cos(a) * en.r * .9, en.y - en.r * 1.3 + Math.sin(a) * 5, 4, 4, .4, t * 4); ctx.fill(); }
    if (en.heroic) {
      // A little crown instead of the elite star.
      const cy = en.y - en.r * 1.45 - 8; glow(ctx, en.x, cy, 22, '#e8a0ff', .8);
      ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.moveTo(en.x - 10, cy + 5); ctx.lineTo(en.x - 11, cy - 5); ctx.lineTo(en.x - 5, cy); ctx.lineTo(en.x, cy - 8); ctx.lineTo(en.x + 5, cy); ctx.lineTo(en.x + 11, cy - 5); ctx.lineTo(en.x + 10, cy + 5); ctx.closePath(); ctx.fill();
      circle(ctx, en.x, cy + 1, 2, '#c98aff');
      this.lights.push({ x: en.x, y: en.y, r: 150, color: '#c98aff', a: .7 });
    } else if (en.elite) { glow(ctx, en.x, en.y - en.r * 1.6, 16, '#ffd35c', .7); ctx.fillStyle = '#ffd35c'; star(ctx, en.x, en.y - en.r * 1.6 - 6, 7, 5, .45, t); ctx.fill(); }
    if (!en.boss && (en.hp < en.maxHp || en.heroic)) {
      const bw = en.heroic ? 76 : en.elite ? 50 : 34, by = en.y - en.r - (en.heroic ? 12 : 20); ctx.fillStyle = 'rgba(10,15,20,.65)'; ctx.beginPath(); ctx.roundRect(en.x - bw / 2 - 1, by, bw + 2, en.heroic ? 8 : 6, 3); ctx.fill();
      ctx.fillStyle = en.heroic ? (en.enraged ? '#ff6b6b' : '#c98aff') : en.elite ? '#ffb347' : '#ff8f7a'; ctx.beginPath(); ctx.roundRect(en.x - bw / 2, by + 1, bw * Math.max(0, en.hp / en.maxHp), en.heroic ? 6 : 4, 2); ctx.fill();
    }
    if (en.boss && !e.bossUnlocked(en)) this.drawSeal(ctx, en, t, e);
    if (en.kind === 'wisp' || en.kind === 'hollowStar' || en.kind === 'eclipse') this.lights.push({ x: en.x, y: en.y, r: en.boss ? 300 : 90, color: '#a78bfa', a: .8 });
    if (en.kind === 'frostwraith' || en.kind === 'cragGolem') this.lights.push({ x: en.x, y: en.y - 10, r: 90, color: '#8ee8ff', a: .7 });
    if (en.kind === 'emberImp' || en.kind === 'magmaHulk' || en.kind === 'cinderTyrant') this.lights.push({ x: en.x, y: en.y - 10, r: en.boss ? 320 : en.kind === 'magmaHulk' ? 130 : 90, color: '#ff8a3d', a: .85 });
    if (en.boss && en.aggro) this.lights.push({ x: en.x, y: en.y, r: 180, color: '#ff8f7a', a: .4 });
  }
  /** "Lv 9" over creatures near Mira, coloured by how dangerous they are compared to her. */
  private drawLevelTags(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    const h = e.hero, me = e.profile.level;
    ctx.font = `900 11px ${UI}`; ctx.textAlign = 'center';
    for (const en of e.enemies) {
      if (en.dead || en.boss || en.spawnT > 0 || en.x < v.x - 40 || en.x > v.x + v.w + 40 || en.y < v.y - 40 || en.y > v.y + v.h + 60) continue;
      if (!en.aggro && Math.abs(en.x - h.x) + Math.abs(en.y - h.y) > 620) continue;
      const d = en.level - me, c = d >= 5 ? '#ff4d4d' : d >= 3 ? '#ff9a4a' : d >= -2 ? '#fff1b8' : d >= -4 ? '#9fe870' : '#9aa0aa';
      const text = en.heroic ? `Heroic · Lv ${en.level}` : `Lv ${en.level}`, y = en.y - en.r * (en.heroic ? 1.45 : en.elite ? 1.6 : 1) - (en.hp < en.maxHp || en.heroic ? 28 : 18) - (en.elite ? 14 : 0);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(12,14,22,.8)'; ctx.strokeText(text, en.x, y); ctx.fillStyle = c; ctx.fillText(text, en.x, y);
      if (en.heroic) { ctx.font = `900 14px ${DISPLAY}`; ctx.strokeText(en.heroic, en.x, y - 15); ctx.fillStyle = '#f0c8ff'; ctx.fillText(en.heroic, en.x, y - 15); ctx.font = `900 11px ${UI}`; }
      if (d >= 5) {
        // A tiny skull: far too strong for Mira.
        const sx = en.x - ctx.measureText(text).width / 2 - 9, sy = y - 4;
        circle(ctx, sx, sy, 5.5, 'rgba(12,14,22,.85)'); circle(ctx, sx, sy - .5, 4.2, c); rect(ctx, sx - 2.4, sy + 2, 4.8, 2.6, c);
        circle(ctx, sx - 1.6, sy - .6, 1.1, '#1a0a0a'); circle(ctx, sx + 1.6, sy - .6, 1.1, '#1a0a0a');
      }
    }
  }
  private drawBoar(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r, charging = en.lunge > 0, dir = charging ? Math.sign(en.chargeX || 1) : look.x >= 0 ? 1 : -1, run = en.aggro ? Math.sin(t * (charging ? 30 : 12)) : Math.sin(t * 4) * .3;
    shadow(ctx, 0, r * .75, r * 1.25, r * .4);
    ctx.translate(trem, charging ? -2 : 0); ctx.scale(dir, 1); if (charging) ctx.rotate(.12);
    ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const [lx, ph] of [[-.55, 1], [-.25, -1], [.3, -1], [.6, 1]] as Array<[number, number]>) { ctx.beginPath(); ctx.moveTo(lx * r, r * .25); ctx.lineTo(lx * r + run * ph * 5, r * .72); ctx.stroke(); }
    const body = flash ? '#fff' : enrage(en.elite ? '#6a3a24' : '#8a5a3a', en.rage);
    ellipse(ctx, 0, 0, r * 1.05, r * .68, body);
    ctx.fillStyle = flash ? '#fff' : enrage('#5a3622', en.rage);
    for (let i = 0; i < 9; i++) { const bx = -r * .8 + i * r * .2; ctx.beginPath(); ctx.moveTo(bx - 4, -r * .45); ctx.lineTo(bx, -r * .78 - (i % 2) * 4); ctx.lineTo(bx + 4, -r * .45); ctx.fill(); }
    ellipse(ctx, r * .8, r * .05, r * .42, r * .36, body);
    ellipse(ctx, r * 1.12, r * .12, r * .18, r * .14, '#e0a08a'); circle(ctx, r * 1.14, r * .1, 2, '#3a2618'); circle(ctx, r * 1.22, r * .12, 2, '#3a2618');
    ctx.fillStyle = '#fff4e0'; ctx.beginPath(); ctx.moveTo(r * .98, r * .22); ctx.quadraticCurveTo(r * 1.1, r * .05, r * 1.02, -r * .12); ctx.lineTo(r * .94, r * .18); ctx.fill();
    circle(ctx, r * .78, -r * .1, 3, en.windup > 0 || charging ? '#ff5a4a' : '#1d1726');
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(r * .55, -r * .25); ctx.lineTo(r * .62, -r * .55); ctx.lineTo(r * .75, -r * .28); ctx.fill();
    ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r, -r * .05); ctx.quadraticCurveTo(-r * 1.3, -r * .2 + Math.sin(t * 8) * 4, -r * 1.2, r * .1); ctx.stroke();
  }
  private drawSporecap(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r, swell = en.windup > 0 ? 1 + (1 - en.windup / .9) * .35 : 1 + Math.sin(t * 3) * .03, hop = en.aggro ? Math.abs(Math.sin(t * 5)) * 3 : 0;
    shadow(ctx, 0, r * .8, r, r * .35);
    ctx.translate(trem, -hop);
    ellipse(ctx, 0, r * .35, r * .5, r * .55, flash ? '#fff' : '#efe4c8');
    for (const s of [-1, 1]) ellipse(ctx, s * r * .22, r * .85, r * .18, r * .1, '#c9b89a');
    this.eyes(ctx, 0, r * .3, r * .2, r * .13, look, t, en.aggro);
    ctx.save(); ctx.scale(swell, swell);
    const cap = flash ? '#fff' : enrage(en.elite ? '#7a3aa0' : '#c8503a', en.rage);
    ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(0, -r * .1, r * 1.1, r * .8, 0, Math.PI, TAU); ctx.quadraticCurveTo(0, r * .2, -r * 1.1, -r * .1); ctx.fill();
    for (let i = 0; i < 6; i++) circle(ctx, Math.cos(i * 1.1 + 3.4) * r * .65, -r * .4 + Math.sin(i * 1.1 + 3.4) * r * .25, r * (.1 + (i % 2) * .05), 'rgba(235,255,190,.85)');
    ctx.restore();
    if (en.windup > 0 || Math.random() < .08) this.pushAmbient({ x: en.x + rand(-r, r), y: en.y - r * .5, vx: rand(-10, 10), vy: rand(-30, -10), life: .9, max: .9, size: 2.4, rot: 0, vr: 0, kind: 'mote', color: '#b9e27a', phase: 0 });
  }
  private drawWolf(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r, dir = look.x >= 0 ? 1 : -1, run = Math.sin(t * (en.aggro ? 18 : 6)), lunge = en.lunge > 0;
    shadow(ctx, 0, r * .75, r * 1.2, r * .38);
    ctx.translate(trem, lunge ? -4 : 0); ctx.scale(dir, 1); if (lunge) ctx.rotate(-.15);
    const fur = flash ? '#fff' : enrage(en.elite ? '#2a2a44' : '#4a4e6a', en.rage);
    ctx.strokeStyle = fur; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const [lx, ph] of [[-.6, 1], [-.3, -1], [.35, -1], [.62, 1]] as Array<[number, number]>) { ctx.beginPath(); ctx.moveTo(lx * r, r * .2); ctx.lineTo(lx * r + run * ph * 6, r * .74); ctx.stroke(); }
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-r * .9, -r * .1); ctx.quadraticCurveTo(-r * 1.4, -r * .5 + Math.sin(t * 7) * 5, -r * 1.55, -r * .1); ctx.stroke();
    ellipse(ctx, 0, 0, r * 1, r * .52, fur); ellipse(ctx, -r * .1, r * .15, r * .7, r * .25, 'rgba(255,255,255,.08)');
    ellipse(ctx, r * .85, -r * .3, r * .42, r * .34, fur);
    ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(r * 1.05, -r * .35); ctx.lineTo(r * 1.5, -r * .18); ctx.lineTo(r * 1.05, -r * .08); ctx.fill();
    for (const ex of [.62, .9]) { ctx.beginPath(); ctx.moveTo(r * ex - 5, -r * .55); ctx.lineTo(r * ex, -r * .95); ctx.lineTo(r * ex + 5, -r * .55); ctx.fill(); }
    const eye = en.windup > 0 || lunge ? '#ff5a4a' : '#9fe8ff';
    circle(ctx, r * 1.02, -r * .38, 2.8, eye); glow(ctx, r * 1.02, -r * .38, 10, eye, .8);
    if (lunge || en.windup > 0) { ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * (1.12 + i * .1), -r * .17); ctx.lineTo(r * (1.16 + i * .1), -r * .06); ctx.lineTo(r * (1.2 + i * .1), -r * .17); ctx.fill(); } }
  }
  private drawSpider(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r, walk = en.aggro ? t * 16 : t * 4;
    shadow(ctx, 0, r * .6, r * 1.3, r * .4);
    ctx.translate(trem, Math.sin(t * 6) * 1.5);
    ctx.strokeStyle = flash ? '#fff' : '#2a1a30'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const a = (-.9 + i * .55) + Math.sin(walk + i * 1.7 + (s > 0 ? 1 : 0)) * .15, kx = s * Math.cos(a) * r * 1.1, ky = Math.sin(a) * r * .5 - r * .35;
      ctx.beginPath(); ctx.moveTo(s * r * .3, 0); ctx.lineTo(kx, ky); ctx.lineTo(kx + s * r * .4, ky + r * .9); ctx.stroke();
    }
    const body = flash ? '#fff' : enrage(en.elite ? '#4a1a5a' : '#5a3a6a', en.rage);
    ellipse(ctx, -r * .45 * Math.sign(look.x || 1) * -.2, r * .05, r * .85, r * .7, body);
    ctx.fillStyle = 'rgba(230,220,255,.55)'; ctx.beginPath(); ctx.moveTo(0, -r * .5); ctx.lineTo(r * .18, -r * .1); ctx.lineTo(0, r * .3); ctx.lineTo(-r * .18, -r * .1); ctx.closePath(); ctx.fill();
    ellipse(ctx, look.x * r * .3, -r * .4 + look.y * 3, r * .45, r * .36, flash ? '#fff' : '#3a2448');
    for (let i = 0; i < 4; i++) circle(ctx, look.x * r * .3 + (i - 1.5) * r * .16, -r * .45 + (i % 2) * 3, 2.2, en.windup > 0 ? '#ff5a4a' : '#e0ff9a');
    if (en.windup > 0) glow(ctx, look.x * r * .3, -r * .3, 20, '#e8e0f0', .8);
  }
  private drawWraith(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean) {
    const r = en.r, fl = Math.sin(t * 5) * 3;
    ctx.translate(0, Math.sin(t * 2.4) * 6 - 14);
    shadow(ctx, 0, r * 2.1, r * .9, r * .3, .18);
    glow(ctx, 0, 0, r * 3.2, en.elite ? '#7ad8ff' : '#bfe8ff', .55);
    const g = ctx.createLinearGradient(0, -r * 1.4, 0, r * 1.6); g.addColorStop(0, flash ? '#fff' : enrage('#e8f8ff', en.rage)); g.addColorStop(.6, flash ? '#fff' : 'rgba(150,210,255,.75)'); g.addColorStop(1, 'rgba(150,210,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -r * 1.4);
    ctx.quadraticCurveTo(r * 1.1, -r * 1.1, r * .9, r * .2);
    for (let i = 0; i <= 4; i++) { const px = r * .9 - i * r * .45; ctx.quadraticCurveTo(px - r * .2, r * (1.1 + Math.sin(t * 7 + i) * .2), px - r * .45, r * (.9 + (i % 2) * .5)); }
    ctx.quadraticCurveTo(-r * 1.1, -r * 1.1, 0, -r * 1.4); ctx.fill();
    ctx.fillStyle = 'rgba(20,40,70,.55)'; ctx.beginPath(); ctx.ellipse(look.x * 2, -r * .45, r * .55, r * .5, 0, 0, TAU); ctx.fill();
    for (const s of [-1, 1]) { circle(ctx, look.x * 3 + s * r * .22, -r * .5 + fl * .2, 3, en.windup > 0 ? '#ffffff' : '#8ee8ff'); glow(ctx, look.x * 3 + s * r * .22, -r * .5, 10, '#8ee8ff', .9); }
    for (let i = 0; i < 3; i++) { const a = t * 2 + i * TAU / 3, ox = Math.cos(a) * r * 1.4, oy = Math.sin(a) * r * .5; ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.moveTo(ox, oy - 7); ctx.lineTo(ox + 3, oy); ctx.lineTo(ox, oy + 7); ctx.lineTo(ox - 3, oy); ctx.fill(); }
    if (en.windup > 0) glow(ctx, 0, 0, r * 2.4, '#ffffff', .5);
  }
  private drawGolem(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r, raise = en.windup > 0 ? 1 - en.windup : 0, step = en.aggro ? Math.sin(t * 4) : 0;
    shadow(ctx, 0, r * .8, r * 1.3, r * .42);
    ctx.translate(trem * 2, -raise * 10);
    const rock = flash ? '#fff' : enrage(en.elite ? '#5a6078' : '#7a8098', en.rage), dark = flash ? '#fff' : enrage('#50566e', en.rage);
    for (const s of [-1, 1]) { ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(s * r * .28 - r * .2, r * .2 + step * s * 3, r * .4, r * .55, 6); ctx.fill(); }
    ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(-r * .8, r * .3); ctx.lineTo(-r * .95, -r * .5); ctx.lineTo(-r * .4, -r * 1.05); ctx.lineTo(r * .45, -r * 1); ctx.lineTo(r * .95, -r * .45); ctx.lineTo(r * .8, r * .32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(r * .1, -r * 1); ctx.lineTo(r * .45, -r * 1); ctx.lineTo(r * .95, -r * .45); ctx.lineTo(r * .8, r * .32); ctx.lineTo(r * .2, r * .3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.moveTo(-r * .95, -r * .5); ctx.lineTo(-r * .4, -r * 1.05); ctx.lineTo(r * .45, -r * 1); ctx.lineTo(r * .6, -r * .8); ctx.quadraticCurveTo(0, -r * .7, -r * .95, -r * .5); ctx.fill();
    const core = en.windup > 0 ? '#ffffff' : '#8ee8ff';
    ctx.fillStyle = core; ctx.beginPath(); ctx.moveTo(0, -r * .5); ctx.lineTo(r * .16, -r * .25); ctx.lineTo(0, 0); ctx.lineTo(-r * .16, -r * .25); ctx.closePath(); ctx.fill(); glow(ctx, 0, -r * .25, r * 1.1, '#8ee8ff', .6 + raise * .4);
    for (const s of [-1, 1]) { ellipse(ctx, look.x * 3 + s * r * .3, -r * .72, 4, 3, '#8ee8ff'); }
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * r * .95, -r * .45); ctx.rotate(s * (.3 - raise * 2.4) + step * .1);
      ctx.fillStyle = rock; ctx.beginPath(); ctx.roundRect(-r * .22, 0, r * .44, r * .8, 8); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(-r * .28, r * .7, r * .56, r * .38, 8); ctx.fill();
      ctx.restore();
    }
  }
  /** Ember imp: a little horned fire devil on bat wings, hovering and glowing brighter as it winds up a throw. */
  private drawImp(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean) {
    const r = en.r, hover = Math.sin(t * 5) * 4 - 14, flap = Math.sin(t * 18);
    shadow(ctx, 0, r * .9, r * .9, r * .3, .25);
    ctx.translate(0, hover);
    glow(ctx, 0, 0, r * 2.4, '#ff7a3d', .55 + (en.windup > 0 ? .3 : 0));
    const wing = flash ? '#fff' : enrage('#7a2a1e', en.rage);
    for (const s of [-1, 1]) { ctx.save(); ctx.scale(s, 1); ctx.rotate(-.3 + flap * .35); ctx.fillStyle = wing; ctx.beginPath(); ctx.moveTo(r * .3, -r * .2); ctx.quadraticCurveTo(r * 1.3, -r * 1.1, r * 1.6, -r * .1); ctx.quadraticCurveTo(r * 1.1, -r * .2, r * 1.2, r * .3); ctx.quadraticCurveTo(r * .8, 0, r * .3, r * .2); ctx.closePath(); ctx.fill(); ctx.restore(); }
    const body = flash ? '#fff' : enrage(en.elite ? '#c0391e' : '#e0572a', en.rage);
    ctx.strokeStyle = body; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, r * .6); ctx.quadraticCurveTo(-r * .6, r * 1.2 + Math.sin(t * 6) * 3, -r * .9, r * .9); ctx.stroke();
    ellipse(ctx, 0, 0, r * .75, r * .85, body);
    ellipse(ctx, -r * .2, -r * .3, r * .25, r * .2, 'rgba(255,220,150,.45)');
    ctx.fillStyle = '#3a2420';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .35, -r * .6); ctx.quadraticCurveTo(s * r * .75, -r * 1.2, s * r * .45, -r * 1.4); ctx.lineTo(s * r * .18, -r * .72); ctx.fill(); }
    this.eyes(ctx, look.x * 2, -r * .15, r * .3, r * .17, look, t, en.aggro, '#fff1b8');
    if (en.windup > 0) { const k = 1 - en.windup / .5; glow(ctx, look.x * r, look.y * r, r * (1 + k), '#ffd27a', .9); circle(ctx, look.x * r * .9, look.y * r * .9 - 2, r * .3 * (.5 + k), '#fff1b8'); }
  }
  /** Ash scorpion: a sand-coloured scorpion with its tail arched; while burrowed only a moving mound of sand shows. */
  private drawScorpion(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r;
    if (en.burrowT > 0) {
      const w = r * 1.3 + Math.sin(t * 12) * 2;
      ellipse(ctx, 0, r * .5, w, r * .45, '#9a7650'); ellipse(ctx, -r * .2, r * .35, w * .6, r * .25, '#c9a26e');
      for (let i = 0; i < 4; i++) { const a = t * 6 + i * 1.6; circle(ctx, Math.cos(a) * w * .9, r * .5 + Math.sin(a) * r * .2, 2.5, '#6a4e34'); }
      return;
    }
    const dir = look.x >= 0 ? 1 : -1, walk = en.aggro ? Math.sin(t * 14) : Math.sin(t * 4) * .3, sting = en.windup > 0 ? 1 - en.windup / .5 : en.lunge > 0 ? 1 : 0;
    shadow(ctx, 0, r * .6, r * 1.3, r * .35);
    ctx.translate(trem, 0); ctx.scale(dir, 1);
    const shell = flash ? '#fff' : enrage(en.elite ? '#8a4a2a' : '#b0764a', en.rage), dark = flash ? '#fff' : enrage('#6a4428', en.rage);
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const lx = -r * .5 + i * r * .33, ph = (i % 2 ? 1 : -1) * walk * 4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + ph, s * r * .55 + r * .25); ctx.stroke(); } }
    ellipse(ctx, 0, 0, r * .8, r * .45, shell); ellipse(ctx, r * .6, -r * .05, r * .35, r * .3, shell);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-r * .3 + i * r * .3, 0, r * .4, -1.2, 1.2); ctx.stroke(); }
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(r * .9, s * r * .25); ctx.rotate(s * .4 - (sting ? s * .3 : 0)); ellipse(ctx, r * .25, 0, r * .3, r * .14, shell); ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(r * .45, -r * .12); ctx.lineTo(r * .7, 0); ctx.lineTo(r * .45, r * .05); ctx.fill(); ctx.restore(); }
    const up = .6 + sting * .6;
    ctx.strokeStyle = shell; ctx.lineWidth = r * .28; ctx.beginPath(); ctx.moveTo(-r * .7, 0); ctx.quadraticCurveTo(-r * 1.4, -r * 1.2 * up, -r * .4, -r * 1.5 * up); ctx.stroke();
    ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.moveTo(-r * .45, -r * 1.55 * up); ctx.lineTo(r * .05 + sting * r * .3, -r * 1.3 * up + sting * r * .4); ctx.lineTo(-r * .3, -r * 1.35 * up); ctx.fill();
    glow(ctx, -r * .2, -r * 1.4 * up, r * .5, '#b9e27a', .3 + sting * .5);
    circle(ctx, r * .75, -r * .15, 2.2, '#ffd27a'); circle(ctx, r * .75, r * .05, 2.2, '#ffd27a');
  }
  /** Magma hulk: a lumbering heap of basalt with lava running through its cracks; it raises its fists to crack the ground. */
  private drawHulk(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r, raise = en.windup > 0 ? 1 - en.windup / 1.1 : 0, step = en.aggro ? Math.sin(t * 3.5) : 0;
    shadow(ctx, 0, r * .8, r * 1.35, r * .42);
    ctx.translate(trem * 2, -raise * 8);
    const rock = flash ? '#fff' : enrage(en.elite ? '#2e2220' : '#4a3a36', en.rage), dark = flash ? '#fff' : '#2a1e1c', lava = en.windup > 0 ? '#fff1b8' : '#ff7a3d';
    for (const s of [-1, 1]) { ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(s * r * .3 - r * .22, r * .15 + step * s * 3, r * .44, r * .6, 7); ctx.fill(); }
    ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(-r * .85, r * .35); ctx.lineTo(-r, -r * .4); ctx.lineTo(-r * .55, -r * 1.05); ctx.lineTo(0, -r * 1.15); ctx.lineTo(r * .55, -r * 1.05); ctx.lineTo(r, -r * .4); ctx.lineTo(r * .85, r * .35); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = lava; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const [a, b, c2, d] of [[-.6, -.8, -.2, -.2], [-.2, -.2, .3, -.6], [.3, -.6, .7, -.3], [-.1, -.2, 0, .25]] as Array<[number, number, number, number]>) { ctx.beginPath(); ctx.moveTo(a * r, b * r); ctx.lineTo(c2 * r, d * r); ctx.stroke(); }
    glow(ctx, 0, -r * .4, r * 1.3, '#ff7a3d', .55 + raise * .45);
    for (const s of [-1, 1]) { ellipse(ctx, look.x * 3 + s * r * .28, -r * .75, 4.5, 3, '#ffd27a'); glow(ctx, look.x * 3 + s * r * .28, -r * .75, 10, '#ffb347', .8); }
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * r * .98, -r * .5); ctx.rotate(s * (.3 - raise * 2.4) + step * .1);
      ctx.fillStyle = rock; ctx.beginPath(); ctx.roundRect(-r * .24, 0, r * .48, r * .82, 8); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(-r * .3, r * .72, r * .6, r * .4, 8); ctx.fill();
      ctx.fillStyle = lava; ctx.fillRect(-r * .2, r * .86, r * .4, 3);
      ctx.restore();
    }
  }
  /** Pyrrhus, the Cinder Tyrant: a basalt-armoured fire giant with a crown of flame and a molten hammer. */
  private drawTyrant(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean) {
    const r = en.r, ph = en.phase, slam = en.action === 'slam' ? 1 - en.actionT / 1.25 : 0, walk = en.aggro ? Math.sin(t * 5) : 0;
    shadow(ctx, 0, r * .95, r * 1.5, r * .5, .45);
    glow(ctx, 0, -r * .5, r * 3.2, ph > 1 ? '#ff3d1f' : '#ff7a3d', .55);
    const armour = flash ? '#fff' : ph > 1 ? '#3a1e1a' : '#2e2422', seam = ph > 1 ? '#ffd27a' : '#ff7a3d';
    for (const s of [-1, 1]) { ctx.fillStyle = armour; ctx.beginPath(); ctx.roundRect(s * r * .32 - r * .2, r * .3 + walk * s * 4, r * .4, r * .65, 8); ctx.fill(); ctx.fillStyle = seam; ctx.fillRect(s * r * .32 - r * .12, r * .55 + walk * s * 4, r * .24, 3); }
    ctx.fillStyle = armour; ctx.beginPath(); ctx.moveTo(-r * .75, r * .45); ctx.lineTo(-r * 1.05, -r * .6); ctx.lineTo(-r * .45, -r * 1.05); ctx.lineTo(r * .45, -r * 1.05); ctx.lineTo(r * 1.05, -r * .6); ctx.lineTo(r * .75, r * .45); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = seam; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, -r * .95); ctx.lineTo(0, r * .35); ctx.moveTo(-r * .8, -r * .4); ctx.quadraticCurveTo(0, -r * .1, r * .8, -r * .4); ctx.stroke();
    glow(ctx, 0, -r * .35, r * .9, seam, .8);
    for (const s of [-1, 1]) { ctx.fillStyle = '#4a3632'; ctx.beginPath(); ctx.ellipse(s * r * .95, -r * .75, r * .38, r * .26, s * .3, 0, TAU); ctx.fill(); ctx.fillStyle = seam; ctx.beginPath(); ctx.moveTo(s * r * .8, -r * .95); ctx.lineTo(s * r * 1.15, -r * 1.35); ctx.lineTo(s * r * 1.05, -r * .85); ctx.fill(); }
    // Head: horned helm, burning eyes, a crown of flame.
    ctx.fillStyle = '#1e1614'; ctx.beginPath(); ctx.roundRect(-r * .35, -r * 1.55, r * .7, r * .6, 10); ctx.fill();
    for (const s of [-1, 1]) { ctx.fillStyle = '#3a2a26'; ctx.beginPath(); ctx.moveTo(s * r * .3, -r * 1.45); ctx.quadraticCurveTo(s * r * .8, -r * 1.7, s * r * .7, -r * 2.05); ctx.lineTo(s * r * .22, -r * 1.55); ctx.fill(); }
    for (const s of [-1, 1]) { ellipse(ctx, look.x * 4 + s * r * .14, -r * 1.25, r * .09, r * .05, '#fff1b8'); glow(ctx, look.x * 4 + s * r * .14, -r * 1.25, 16, '#ffb347', .9); }
    this.drawFlame(ctx, 0, -r * 1.55, ph > 1 ? 1.1 : .8, ph > 1 ? '#ff5f3d' : '#ffb347');
    // The hammer: raised high, then brought down in a slam.
    const ang = en.action === 'slam' ? -2.4 + Math.min(1, slam * 1.6) * 2.6 : -.7 + Math.sin(t * 1.5) * .08;
    ctx.save(); ctx.translate(r * 1.05, -r * .55); ctx.rotate(ang);
    ctx.fillStyle = '#3a2a26'; ctx.fillRect(-4, -r * 1.3, 8, r * 1.35);
    ctx.fillStyle = '#2a1e1c'; ctx.beginPath(); ctx.roundRect(-r * .38, -r * 1.65, r * .76, r * .45, 6); ctx.fill();
    ctx.fillStyle = seam; ctx.fillRect(-r * .32, -r * 1.46, r * .64, 4); glow(ctx, 0, -r * 1.43, r * .6, seam, .7);
    ctx.restore();
  }
  /** Umbra: a black sun wearing the powers of all three guardians — moss, thorns and a hollow star circle it. */
  private drawEclipse(ctx: CanvasRenderingContext2D, en: Enemy, t: number, flash: boolean) {
    const r = en.r, ph = en.phase, hover = Math.sin(t * 1.6) * 10 - 26;
    const fade = en.action === 'blink' && en.actionT > 1.1 ? (en.actionT - 1.1) / .3 : en.action === 'blink' && en.actionT > .9 ? 1 - (en.actionT - .9) / .2 : 1;
    ctx.globalAlpha = clamp(fade, .1, 1);
    shadow(ctx, 0, r * 1.1, r * 1.3, r * .4, .4);
    ctx.translate(0, hover);
    glow(ctx, 0, 0, r * 4, ph === 3 ? '#ff3b6b' : ph === 2 ? '#ff6b9a' : '#8a6ff0', .8);
    ctx.save(); ctx.rotate(t * .4);
    for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); const len = r * (1.5 + Math.sin(t * 3 + i) * .25 + (i % 2) * .3); const g = ctx.createLinearGradient(0, 0, len, 0); g.addColorStop(0, 'rgba(255,200,240,.0)'); g.addColorStop(.55, ph > 1 ? 'rgba(255,110,160,.75)' : 'rgba(201,182,255,.7)'); g.addColorStop(1, 'rgba(201,182,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(r * .9, -6); ctx.lineTo(len, 0); ctx.lineTo(r * .9, 6); ctx.fill(); }
    ctx.restore();
    circle(ctx, 0, 0, r * 1.02, flash ? '#fff' : '#05020c');
    ctx.strokeStyle = ph > 1 ? '#ff9ac0' : '#e0d4ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 1.02, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(167,139,250,.9)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (.25 + i * .15), t * (2 + i) + i, t * (2 + i) + i + 2.2); ctx.stroke(); }
    const eye = ph === 3 ? '#ff3b6b' : ph === 2 ? '#ff9a6b' : '#e9ddff';
    for (const s of [-1, 1]) { ellipse(ctx, s * r * .3, -r * .1, r * .14, r * .07, eye, s * .25); glow(ctx, s * r * .3, -r * .1, 22, eye, .9); }
    // The three stolen guardian powers.
    for (let i = 0; i < 3; i++) {
      const a = t * .9 + i * TAU / 3, ox = Math.cos(a) * r * 1.9, oy = Math.sin(a) * r * .8;
      if (i === 0) { circle(ctx, ox, oy, 12, '#6f9a4c'); circle(ctx, ox - 3, oy - 3, 6, '#a3c46a'); glow(ctx, ox, oy, 26, '#a3c46a', .7); }
      else if (i === 1) { ctx.strokeStyle = '#b6df91'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ox, oy, 11, 0, TAU); ctx.stroke(); ctx.fillStyle = '#e6d9a0'; for (let k = 0; k < 6; k++) { const b = k * TAU / 6 + t; ctx.beginPath(); ctx.moveTo(ox + Math.cos(b) * 10, oy + Math.sin(b) * 10); ctx.lineTo(ox + Math.cos(b) * 17, oy + Math.sin(b) * 17); ctx.lineTo(ox + Math.cos(b + .3) * 10, oy + Math.sin(b + .3) * 10); ctx.fill(); } glow(ctx, ox, oy, 26, '#b6df91', .6); }
      else { ctx.fillStyle = '#c9b6ff'; star(ctx, ox, oy, 14, 5, .45, t * 2); ctx.fill(); circle(ctx, ox, oy, 5, '#1a1030'); glow(ctx, ox, oy, 28, '#c9b6ff', .8); }
    }
    ctx.globalAlpha = 1;
  }
  private eyes(ctx: CanvasRenderingContext2D, x: number, y: number, gap: number, size: number, look: Point, t: number, angry: boolean, color = '#fff8e6') {
    const blink = Math.sin(t * 1.7) > .97;
    for (const s of [-1, 1]) {
      if (blink) { ctx.fillStyle = '#1d1726'; ctx.fillRect(x + s * gap - size, y, size * 2, 1.5); continue; }
      ellipse(ctx, x + s * gap, y, size, size * 1.15, color);
      circle(ctx, x + s * gap + look.x * size * .4, y + look.y * size * .35, size * .55, '#1d1726');
      circle(ctx, x + s * gap + look.x * size * .4 - size * .2, y + look.y * size * .35 - size * .25, size * .2, '#fff');
      if (angry) { ctx.strokeStyle = '#1d1726'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + s * gap - size * s, y - size * 1.5); ctx.lineTo(x + s * gap + size * s * .8, y - size * .9); ctx.stroke(); }
    }
  }
  private drawGloomling(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r, hop = en.aggro ? Math.abs(Math.sin(t * 6)) * 7 : Math.abs(Math.sin(t * 3)) * 3, swell = en.windup > 0 ? 1.15 : 1, lunge = en.lunge > 0 ? 1.2 : 1;
    shadow(ctx, 0, r * .8, r * (1.1 - hop * .02), r * .4);
    ctx.translate(trem, -hop); ctx.scale(swell * lunge, swell / lunge * (1 + Math.sin(t * 12) * .04));
    ctx.fillStyle = flash ? '#fff' : enrage(en.elite ? '#5a3a8a' : '#6d5fc0', en.rage); ctx.beginPath(); ctx.moveTo(-r, r * .1); ctx.bezierCurveTo(-r, -r * 1.2, r, -r * 1.2, r, r * .1);
    for (let i = 0; i <= 4; i++) { const px = r - i * r * .5; ctx.quadraticCurveTo(px - r * .25, r * (.75 + Math.sin(t * 8 + i) * .12), px - r * .5, r * .55); }
    ctx.closePath(); ctx.fill();
    ellipse(ctx, -r * .3, -r * .45, r * .35, r * .25, 'rgba(255,255,255,.18)');
    ctx.strokeStyle = '#6e5fb8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * .85); ctx.quadraticCurveTo(Math.sin(t * 3) * 6, -r * 1.3, Math.sin(t * 3) * 8, -r * 1.45); ctx.stroke();
    circle(ctx, Math.sin(t * 3) * 8, -r * 1.45, 3.5, '#ffd35c'); glow(ctx, Math.sin(t * 3) * 8, -r * 1.45, 12, '#ffd35c', .8);
    this.eyes(ctx, 0, -r * .2, r * .34, r * .24, look, t, en.aggro, en.windup > 0 ? '#ffb4a8' : undefined);
  }
  private drawThornling(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r, sway = Math.sin(t * 2) * .15;
    shadow(ctx, 0, r * .7, r * 1.2, r * .4);
    for (let i = -1; i <= 1; i++) { ctx.save(); ctx.translate(0, r * .45); ctx.rotate(i * .9 + sway * (i || 1)); ellipse(ctx, 0, -r * .1, r * .28, r * .8, '#5d8a3a'); ctx.restore(); }
    ctx.translate(trem, 0);
    ctx.fillStyle = flash ? '#fff' : enrage(en.elite ? '#7a8a3a' : '#8aab52', en.rage); ctx.beginPath(); ctx.ellipse(0, -r * .1, r * .9, r * .85, 0, 0, TAU); ctx.fill();
    ellipse(ctx, -r * .3, -r * .45, r * .35, r * .22, 'rgba(255,255,255,.2)');
    ctx.fillStyle = '#e6d9a0';
    for (let i = 0; i < 7; i++) { const a = -Math.PI + (i / 6) * Math.PI + sway * .3; ctx.beginPath(); ctx.moveTo(Math.cos(a - .15) * r * .8, -r * .1 + Math.sin(a - .15) * r * .8); ctx.lineTo(Math.cos(a) * r * 1.35, -r * .1 + Math.sin(a) * r * 1.3); ctx.lineTo(Math.cos(a + .15) * r * .8, -r * .1 + Math.sin(a + .15) * r * .8); ctx.fill(); }
    this.eyes(ctx, 0, -r * .3, r * .32, r * .2, look, t, true);
    const open = en.windup > 0 ? .5 + Math.sin(t * 30) * .2 : .15;
    ellipse(ctx, 0, r * .25, r * .3, r * open, '#2a1f1b');
    if (en.windup > 0) glow(ctx, 0, r * .25, 22, '#b6df91', .8);
  }
  private drawWisp(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean) {
    const r = en.r, fl = Math.sin(t * 10) * 2;
    ctx.translate(0, Math.sin(t * 3) * 6 - 10);
    shadow(ctx, 0, r * 2, r * .8, r * .3, .18);
    glow(ctx, 0, 0, r * 3.5, en.elite ? '#ff6b9a' : '#8a6ff0', .6);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 5; i >= 0; i--) circle(ctx, Math.sin(t * 6 - i * .7) * i * 1.6, i * r * .38, r * (1 - i * .14), `rgba(${120 + i * 10},${140 - i * 10},255,${.35 - i * .04})`);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(0, -2, 1, 0, 0, r); g.addColorStop(0, flash ? '#fff' : '#f1ecff'); g.addColorStop(.6, flash ? '#fff' : enrage('#9f8cff', en.rage)); g.addColorStop(1, 'rgba(90,70,200,.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -r * 1.5 + fl); ctx.quadraticCurveTo(r * 1.1, -r * .3, r * .8, r * .3); ctx.arc(0, r * .2, r * .82, 0, Math.PI); ctx.quadraticCurveTo(-r * 1.1, -r * .3, 0, -r * 1.5 + fl); ctx.fill();
    circle(ctx, -r * .3 + look.x * 2, 0, 2.6, '#1d1540'); circle(ctx, r * .3 + look.x * 2, 0, 2.6, '#1d1540');
    if (en.windup > 0) glow(ctx, 0, 0, r * 2.5, '#ffffff', .6);
  }
  private drawMossback(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, e: GameEngine) {
    const r = en.r, awake = e.bossUnlocked(en), slam = en.action === 'slam' && en.actionT > .3 ? Math.sin(Math.min(1, (1.25 - en.actionT) / .95) * Math.PI * .5) : 0;
    const walk = en.aggro && !en.action ? Math.sin(t * 6) : 0;
    shadow(ctx, 0, r * .75, r * 1.35 * (1 - slam * .2), r * .5);
    ctx.translate(0, -slam * 26); ctx.scale(1 - slam * .05, 1 + slam * .1);
    for (const [lx, ph] of [[-.7, 0], [.7, Math.PI], [-.35, Math.PI], [.35, 0]] as Array<[number, number]>) ellipse(ctx, lx * r, r * .55 + Math.sin(t * 6 + ph) * walk * 3, r * .2, r * .26, '#4a5a3a');
    const hx = look.x * r * .15, hy = r * .25;
    ellipse(ctx, hx, hy, r * .42, r * .32, flash ? '#fff' : '#7d8a5a');
    const eyeC = en.phase === 2 ? '#ff6b5b' : awake ? '#ffb347' : '#3a3a30';
    if (awake) { circle(ctx, hx - r * .17, hy - 2, 4.5, eyeC); circle(ctx, hx + r * .17, hy - 2, 4.5, eyeC); glow(ctx, hx - r * .17, hy - 2, 14, eyeC, .8); glow(ctx, hx + r * .17, hy - 2, 14, eyeC, .8); }
    else { ctx.fillStyle = '#2a2a20'; ctx.fillRect(hx - r * .25, hy - 2, 9, 2); ctx.fillRect(hx + r * .1, hy - 2, 9, 2); }
    const g = ctx.createRadialGradient(-r * .3, -r * .6, 4, 0, -r * .2, r * 1.2); g.addColorStop(0, flash ? '#fff' : enrage('#9aa37c', en.rage)); g.addColorStop(1, flash ? '#fff' : enrage('#4d5840', en.rage));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -r * .15, r * 1.12, r * .82, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(0, r * .2, -r * 1.12, -r * .1); ctx.fill();
    ctx.strokeStyle = 'rgba(40,45,30,.45)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r * .8 + i * r * .55, -r * .05); ctx.lineTo(-r * .55 + i * r * .4, -r * .7); ctx.stroke(); }
    ellipse(ctx, 0, -r * .8, r * .8, r * .25, '#6f9a4c');
    ctx.strokeStyle = '#a3c46a'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const bx = -r * .65 + i * r * .16, s = Math.sin(t * 2.5 + i) * 4; ctx.beginPath(); ctx.moveTo(bx, -r * .82); ctx.quadraticCurveTo(bx + s * .5, -r * .95, bx + s, -r * 1.08); ctx.stroke(); }
    for (const [mx, mc] of [[-.4, '#e0735a'], [.25, '#f2d27a'], [.5, '#e0735a']] as Array<[number, string]>) { ctx.fillStyle = '#efe4c8'; ctx.fillRect(mx * r - 1.5, -r * 1.02, 3, 8); ctx.fillStyle = mc; ctx.beginPath(); ctx.arc(mx * r, -r * 1.02, 6, Math.PI, TAU); ctx.fill(); }
    if (en.phase === 2 && Math.random() < .3) this.pushAmbient({ x: en.x + rand(-r, r), y: en.y - r, vx: 0, vy: -40, life: 1, max: 1, size: 6, rot: 0, vr: 0, kind: 'mote', color: 'rgba(255,140,110,.6)', phase: 0 });
  }
  private drawWarden(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, e: GameEngine) {
    const r = en.r, awake = e.bossUnlocked(en), raise = en.action === 'nova' ? 1 : en.action === 'roots' ? .5 : 0, sway = Math.sin(t * 1.6) * .12;
    shadow(ctx, 0, r * .8, r * 1.2, r * .45);
    ctx.strokeStyle = '#4a3522'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8, r * .5); ctx.quadraticCurveTo(i * 20, r * .7, i * 30 + Math.sin(t * 2 + i) * 3, r * .85); ctx.stroke(); }
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * r * .5, -r * .4); ctx.rotate(s * (.9 - raise * 1.6 + sway + (en.aggro ? Math.sin(t * 4 + s) * .15 : 0)));
      ctx.strokeStyle = '#5a4130'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, r * .9); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, r * .6); ctx.lineTo(s * 12, r * 1.05); ctx.moveTo(0, r * .8); ctx.lineTo(-s * 8, r * 1.1); ctx.stroke();
      circle(ctx, 0, r * .45, 8, '#6f9a5c'); ctx.restore();
    }
    const g = ctx.createLinearGradient(-r * .6, 0, r * .6, 0); const bark = enrage('#4a3522', en.rage); g.addColorStop(0, flash ? '#fff' : bark); g.addColorStop(.5, flash ? '#fff' : enrage('#7a5a3f', en.rage)); g.addColorStop(1, flash ? '#fff' : bark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-r * .6, -r * 1.1, r * 1.2, r * 1.65, [r * .5, r * .5, r * .2, r * .2]); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,10,.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r * .4 + i * r * .27, -r * .7); ctx.quadraticCurveTo(-r * .35 + i * r * .27, 0, -r * .42 + i * r * .27, r * .45); ctx.stroke(); }
    for (let i = 0; i < 9; i++) { const a = -Math.PI + (i / 8) * Math.PI, s2 = Math.sin(t * 2 + i) * .08; ellipse(ctx, Math.cos(a + s2) * r * .62, -r * 1.05 + Math.sin(a + s2) * r * .5, r * .26, r * .16, i % 2 ? '#355c3e' : '#6f9a5c', a); }
    ctx.fillStyle = '#e6d9a0'; for (let i = 0; i < 5; i++) { const a = -Math.PI * .85 + i * Math.PI * .175; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .45 - 3, -r * 1.05 + Math.sin(a) * r * .4); ctx.lineTo(Math.cos(a) * r * .95, -r * 1.05 + Math.sin(a) * r * .9); ctx.lineTo(Math.cos(a) * r * .45 + 3, -r * 1.05 + Math.sin(a) * r * .4); ctx.fill(); }
    const eyeC = en.phase === 2 ? '#ff6b5b' : awake ? '#b6ff7a' : '#2a2018';
    for (const s of [-1, 1]) { ellipse(ctx, s * r * .22 + look.x * 3, -r * .55, 6, 4, eyeC, s * .3); if (awake) glow(ctx, s * r * .22, -r * .55, 16, eyeC, .9); }
    ctx.fillStyle = '#1e140c'; ctx.beginPath(); ctx.ellipse(0, -r * .2, r * .2, raise ? r * .18 : r * .06, 0, 0, TAU); ctx.fill();
  }
  private drawHollowStar(ctx: CanvasRenderingContext2D, en: Enemy, t: number, flash: boolean, e: GameEngine) {
    const r = en.r, awake = e.bossUnlocked(en);
    const fade = en.action === 'blink' && en.actionT > 1.1 ? (en.actionT - 1.1) / .3 : en.action === 'blink' && en.actionT > .9 ? 1 - (en.actionT - .9) / .2 : 1;
    ctx.globalAlpha = clamp(fade, .1, 1);
    const hover = Math.sin(t * 2) * 8 - 18;
    shadow(ctx, 0, r * .9, r * .9, r * .3, .3);
    ctx.translate(0, hover);
    glow(ctx, 0, 0, r * 3.2, en.phase === 2 ? '#ff6b9a' : '#8a6ff0', .7);
    for (let i = 0; i < 5; i++) { const a = t * 1.3 + i * TAU / 5, ox = Math.cos(a) * r * 1.5, oy = Math.sin(a) * r * .7; ctx.fillStyle = '#c9b6ff'; ctx.beginPath(); ctx.moveTo(ox, oy - 8); ctx.lineTo(ox + 4, oy); ctx.lineTo(ox, oy + 8); ctx.lineTo(ox - 4, oy); ctx.fill(); glow(ctx, ox, oy, 12, '#c9b6ff', .8); }
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 1.2); g.addColorStop(0, flash ? '#fff' : '#1a1030'); g.addColorStop(.6, flash ? '#fff' : enrage('#3d2a78', en.rage)); g.addColorStop(1, flash ? '#fff' : '#a78bfa');
    ctx.fillStyle = g; star(ctx, 0, 0, r * 1.2, 5, .5, en.angle * .4); ctx.fill();
    ctx.strokeStyle = 'rgba(230,220,255,.8)'; ctx.lineWidth = 2; ctx.stroke();
    circle(ctx, 0, 0, r * .38, '#05020c');
    ctx.strokeStyle = 'rgba(167,139,250,.9)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (.12 + i * .08), t * (3 + i) + i, t * (3 + i) + i + 2.4); ctx.stroke(); }
    if (awake) { circle(ctx, -r * .14, -r * .02, 3.5, en.phase === 2 ? '#ff6b9a' : '#e9ddff'); circle(ctx, r * .14, -r * .02, 3.5, en.phase === 2 ? '#ff6b9a' : '#e9ddff'); }
    if (en.phase === 2) { ctx.strokeStyle = '#ff9a6b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * .5, -r * .6); ctx.lineTo(-r * .2, -r * .3); ctx.lineTo(-r * .35, 0); ctx.moveTo(r * .6, r * .2); ctx.lineTo(r * .3, r * .15); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  private drawSeal(ctx: CanvasRenderingContext2D, en: Enemy, t: number, e: GameEngine) {
    const r = en.r * 1.9, c = regionOf(e.world, en.x).palette.accent, found = e.keysFound(en.region);
    ctx.save(); ctx.translate(en.x, en.y - en.r * .3);
    const g = ctx.createRadialGradient(-r * .3, -r * .4, 4, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(.8, alpha(c, .12)); g.addColorStop(1, alpha(c, .45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = alpha(c, .8); ctx.lineWidth = 2; ctx.stroke();
    ctx.rotate(t * .4);
    for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.fillStyle = i < found ? '#ffffff' : alpha(c, .5); star(ctx, r, 0, 9, 4, .4); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `700 14px ${UI}`; ctx.textAlign = 'center';
    const zy = en.y - en.r - 20 - ((t * 20) % 30);
    ctx.globalAlpha = 1 - ((t * 20) % 30) / 30; ctx.fillText('z', en.x + 20 + Math.sin(t * 2) * 5, zy); ctx.globalAlpha = 1;
  }

  // ───────────────────────────── combat visuals
  private drawHazardGround(ctx: CanvasRenderingContext2D, z: Hazard) {
    const p = 1 - z.delay / z.maxDelay, t = this.time;
    const hero = z.owner === 'hero', c = z.kind === 'firebomb' ? '#ff8a3d' : z.kind === 'frostbomb' || z.kind === 'frostnova' ? '#8fd8ff' : z.kind === 'blizzard' ? '#dff6ff' : z.kind === 'lightning' ? '#ffe96b' : z.kind === 'lava' ? '#ff7a3d' : hero ? '#ffe38a' : z.kind === 'meteor' ? '#c9b6ff' : z.kind === 'spore' ? '#a8e060' : '#ff6b5b';
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .62);
    ctx.fillStyle = alpha(c, .1 + p * .14); ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
    ctx.fillStyle = alpha(c, .25); ctx.beginPath(); ctx.arc(0, 0, z.r * p, 0, TAU); ctx.fill();
    ctx.strokeStyle = alpha(c, .6 + p * .4); ctx.lineWidth = 2.5 + p * 2; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 50;
    ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (z.kind === 'slam') { ctx.strokeStyle = alpha(c, .5 * p); ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * z.r * .2, Math.sin(a) * z.r * .2); ctx.lineTo(Math.cos(a + .1) * z.r * .9 * p, Math.sin(a + .1) * z.r * .9 * p); ctx.stroke(); } }
    if (z.kind === 'root' && p > .6) { ctx.fillStyle = '#6f5337'; for (let i = 0; i < 3; i++) { const a = i * 2.1; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10 - 4, Math.sin(a) * 10); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10 - 18 * (p - .6) * 2.5); ctx.lineTo(Math.cos(a) * 10 + 4, Math.sin(a) * 10); ctx.fill(); } }
    ctx.restore();
    if (z.kind === 'lava' && !hero) { glow(ctx, z.x, z.y, z.r * (.6 + p * .6), '#ff5f3d', .35 + p * .35); this.lights.push({ x: z.x, y: z.y, r: z.r * 1.4, color: '#ff7a3d', a: .4 + p * .5 }); }
    if (z.kind === 'boulder' || z.kind === 'meteor' || z.kind === 'starfall') shadow(ctx, z.x, z.y, z.r * .5 * p, z.r * .22 * p, .35);
    else if (z.kind === 'firebomb' || z.kind === 'frostbomb') shadow(ctx, z.x, z.y, 14 * p, 6 * p, .35);
  }
  private drawHazardAir(ctx: CanvasRenderingContext2D, z: Hazard) {
    const p = 1 - z.delay / z.maxDelay;
    if (z.kind === 'firebomb' || z.kind === 'frostbomb') {
      // A round bomb with a sparking fuse, lobbed in a high arc.
      const fire = z.kind === 'firebomb', x = z.fromX + (z.x - z.fromX) * p, y = z.fromY + (z.y - z.fromY) * p - Math.sin(p * Math.PI) * 170;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p * 10);
      circle(ctx, 0, 0, 11, fire ? '#3a2a30' : '#3a4a60'); circle(ctx, -3.5, -3.5, 3.5, 'rgba(255,255,255,.35)');
      ctx.fillStyle = fire ? '#ff7a3d' : '#8fd8ff'; ctx.fillRect(-4, -14, 8, 4);
      ctx.restore();
      glow(ctx, x, y - 14, 16, fire ? '#ffd27a' : '#dff6ff', 1);
      if (Math.random() < .6) this.pushAmbient({ x, y: y - 12, vx: rand(-30, 30), vy: rand(-40, 0), life: .4, max: .4, size: 2, rot: 0, vr: 0, kind: 'mote', color: fire ? '#ffd27a' : '#dff6ff', phase: 0 });
      this.lights.push({ x, y, r: 70, color: fire ? '#ffb05c' : '#8fd8ff', a: .8 });
    } else if (z.kind === 'lightning') {
      // A jagged bolt from the sky in the last moment before it lands.
      if (p < .55) return;
      const k = (p - .55) / .45, steps = 9;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [w, col] of [[10, 'rgba(255,233,107,.35)'], [3.5, '#fffbe0']] as const) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(z.fromX, z.fromY);
        for (let i = 1; i <= steps; i++) { const f = i / steps; ctx.lineTo(z.fromX + (z.x - z.fromX) * f + (i < steps ? Math.sin(i * 7.3 + z.fromX) * 26 : 0), z.fromY + (z.y - z.fromY) * f * Math.min(1, k * 1.6)); }
        ctx.stroke();
      }
      ctx.restore();
      this.lights.push({ x: z.x, y: z.y, r: 180, color: '#ffe96b', a: 1 });
    } else if (z.kind === 'boulder') {
      const x = z.fromX + (z.x - z.fromX) * p, y = z.fromY + (z.y - z.fromY) * p - Math.sin(p * Math.PI) * 240;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p * 9);
      ctx.fillStyle = '#7d8070'; ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(-6, -16); ctx.lineTo(12, -13); ctx.lineTo(17, 4); ctx.lineTo(6, 16); ctx.lineTo(-13, 12); ctx.closePath(); ctx.fill();
      ellipse(ctx, -4, -6, 7, 4, '#6f9a4c'); ctx.restore();
    } else if (z.kind === 'meteor' || z.kind === 'starfall' || ((z.kind === 'lava' || z.kind === 'blizzard') && z.fromY < z.y - 250)) {
      const q = p * p, x = z.fromX + (z.x - z.fromX) * q, y = z.fromY + (z.y - z.fromY) * q;
      const c = z.kind === 'meteor' ? '#a78bfa' : z.kind === 'lava' ? '#ff7a3d' : z.kind === 'blizzard' ? '#dff6ff' : '#ffe38a';
      const dx = z.x - z.fromX, dy = z.y - z.fromY, len = Math.hypot(dx, dy);
      const tl = 120, tx = x - dx / len * tl, ty = y - dy / len * tl;
      const g = ctx.createLinearGradient(tx, ty, x, y); g.addColorStop(0, alpha(c, 0)); g.addColorStop(1, alpha(c, .9));
      ctx.strokeStyle = g; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      glow(ctx, x, y, 40, c, 1); ctx.fillStyle = '#fff'; star(ctx, x, y, 11, 5, .45, p * 8); ctx.fill();
      this.lights.push({ x, y, r: 120, color: c, a: 1 });
    }
  }
  private drawChargeLines(ctx: CanvasRenderingContext2D, e: GameEngine) {
    for (const en of e.enemies) {
      if (en.dead) continue;
      if (en.kind === 'bristleboar' && en.windup > 0) {
        const p = 1 - en.windup / .75, a = Math.atan2(en.chargeY, en.chargeX), len = 400;
        ctx.save(); ctx.translate(en.x, en.y); ctx.rotate(a);
        ctx.fillStyle = `rgba(255,90,70,${.1 + p * .18})`; ctx.fillRect(0, -en.r, len, en.r * 2);
        ctx.fillStyle = `rgba(255,140,110,${.35 + p * .45})`; ctx.fillRect(0, -en.r, len * p, 3); ctx.fillRect(0, en.r - 3, len * p, 3);
        ctx.restore(); continue;
      }
      if (en.action !== 'charge' || en.actionT < .75) continue;
      const p = (1.3 - en.actionT) / .55, a = Math.atan2(en.chargeY, en.chargeX);
      ctx.save(); ctx.translate(en.x, en.y); ctx.rotate(a);
      ctx.fillStyle = `rgba(255,90,70,${.1 + p * .15})`; ctx.fillRect(0, -en.r, 380, en.r * 2);
      ctx.fillStyle = `rgba(255,140,110,${.3 + p * .4})`; ctx.fillRect(0, -en.r, 380 * p, 3); ctx.fillRect(0, en.r - 3, 380 * p, 3);
      for (let i = 1; i < 4; i++) { ctx.fillStyle = `rgba(255,200,180,${.4 * p})`; ctx.beginPath(); ctx.moveTo(i * 90, -12); ctx.lineTo(i * 90 + 20, 0); ctx.lineTo(i * 90, 12); ctx.fill(); }
      ctx.restore();
    }
  }
  private drawProjectiles(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time;
    for (const p of e.projectiles) {
      if (p.kind === 'spark') {
        const c = p.owner === 'hero' ? (p.crit ? '#ffd35c' : '#fff1a8') : '#9fe8b0';
        glow(ctx, p.x, p.y, p.r * 4, c, 1);
        ctx.fillStyle = '#fff'; star(ctx, p.x, p.y, p.r * 1.3, 4, .35, p.spin); ctx.fill();
        this.lights.push({ x: p.x, y: p.y, r: 90, color: c, a: .9 });
      } else if (p.kind === 'sunfire') {
        const fl = 1 + Math.sin(t * 40) * .1;
        glow(ctx, p.x, p.y, p.r * 4 * fl, '#ff9a4a', 1);
        circle(ctx, p.x, p.y, p.r * 1.2 * fl, '#ffd27a'); circle(ctx, p.x, p.y, p.r * .7 * fl, '#fff6d8');
        ctx.strokeStyle = 'rgba(255,220,150,.8)'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const a = p.spin + i * TAU / 6; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * p.r * 1.2, p.y + Math.sin(a) * p.r * 1.2); ctx.lineTo(p.x + Math.cos(a) * p.r * 1.8, p.y + Math.sin(a) * p.r * 1.8); ctx.stroke(); }
        this.lights.push({ x: p.x, y: p.y, r: 200, color: '#ff9a4a', a: 1 });
      } else if (p.kind === 'thorn') {
        const a = Math.atan2(p.vy, p.vx), c = p.owner === 'hero' ? '#9fe8b0' : '#c9e07a';
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        glow(ctx, 0, 0, 16, p.owner === 'hero' ? '#9fe8b0' : '#ff9a6b', .6);
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -5); ctx.lineTo(-4, 0); ctx.lineTo(-8, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
        this.lights.push({ x: p.x, y: p.y, r: 40, a: .5 });
      } else if (p.kind === 'web') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin * .3);
        glow(ctx, 0, 0, 22, '#e8e0f0', .6);
        ctx.strokeStyle = 'rgba(240,236,255,.9)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.stroke(); }
        for (const rr of [4, 8]) { ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * TAU / 6; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.stroke(); }
        ctx.restore();
      } else if (p.kind === 'frost') {
        // Lyra's frost bolt: a long ice shard with a trail of cold light.
        const a = Math.atan2(p.vy, p.vx), c = p.crit ? '#ffffff' : '#9fe4ff';
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        const g = ctx.createLinearGradient(-34, 0, 0, 0); g.addColorStop(0, 'rgba(159,228,255,0)'); g.addColorStop(1, 'rgba(159,228,255,.6)');
        ctx.fillStyle = g; ctx.fillRect(-34, -3, 34, 6);
        glow(ctx, 0, 0, p.r * 3.2, c, .9);
        ctx.fillStyle = '#f2fbff'; ctx.beginPath(); ctx.moveTo(p.r * 2, 0); ctx.lineTo(-p.r * .6, -p.r * .8); ctx.lineTo(-p.r * 1.4, 0); ctx.lineTo(-p.r * .6, p.r * .8); ctx.closePath(); ctx.fill();
        ctx.restore();
        this.lights.push({ x: p.x, y: p.y, r: 90, color: '#9fe4ff', a: .9 });
      } else if (p.kind === 'arrow') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        if (p.crit) glow(ctx, 0, 0, 16, '#ffd35c', .7);
        ctx.strokeStyle = 'rgba(255,245,210,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-14, 0); ctx.stroke();
        rect(ctx, -14, -1, 22, 2, '#a8844a');
        ctx.fillStyle = '#d8dce8'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(7, -3.5); ctx.lineTo(7, 3.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-19, -4); ctx.lineTo(-11, 0); ctx.lineTo(-19, 4); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'knife') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin + Math.PI / 2);
        glow(ctx, 0, 0, 12, '#e0c8ff', .6);
        rect(ctx, -1.5, 2, 3, 5, '#3a2a26'); ctx.fillStyle = '#eef0f8'; ctx.beginPath(); ctx.moveTo(-2.5, 2); ctx.lineTo(0, -10); ctx.lineTo(2.5, 2); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'fire') {
        const fl = 1 + Math.sin(t * 36 + p.x) * .12, c = p.owner === 'hero' ? '#9fe8b0' : '#ff7a3d';
        glow(ctx, p.x, p.y, p.r * 3.4 * fl, c, .95);
        circle(ctx, p.x, p.y, p.r * fl, p.owner === 'hero' ? '#e6ffe9' : '#ffd27a'); circle(ctx, p.x, p.y, p.r * .5, '#fff6d8');
        this.lights.push({ x: p.x, y: p.y, r: 80, color: c, a: .9 });
      } else if (p.kind === 'ice') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        glow(ctx, 0, 0, 20, '#8ee8ff', .8);
        ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-4, -5); ctx.lineTo(-10, 0); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
        this.lights.push({ x: p.x, y: p.y, r: 60, color: '#8ee8ff', a: .7 });
      } else {
        const c = p.owner === 'hero' ? '#9fe8b0' : '#a78bfa';
        glow(ctx, p.x, p.y, p.r * 3.4, c, .9);
        circle(ctx, p.x, p.y, p.r, p.owner === 'hero' ? '#e6ffe9' : '#1a1030');
        ctx.strokeStyle = p.owner === 'hero' ? '#9fe8b0' : '#e0d4ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, p.spin, p.spin + 4); ctx.stroke();
        this.lights.push({ x: p.x, y: p.y, r: 60, color: c, a: .7 });
      }
    }
  }
  private drawOrbs(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time;
    for (const o of e.orbs) {
      const fade = o.age > 13 ? (Math.floor(t * 10) % 2 ? .3 : 1) : 1, y = o.y - 8 + Math.sin(t * 5 + o.x) * 3;
      ctx.globalAlpha = fade;
      if (o.kind === 'loot') {
        // A little loot sack glowing in its rarity colour; epic and legendary pieces send up a beam of light.
        const c = o.gear ? RARITY[o.gear.rarity].color : '#ffffff', big = o.gear && (o.gear.rarity === 'epic' || o.gear.rarity === 'legendary');
        if (big) { const g = ctx.createLinearGradient(o.x, y - 160, o.x, y); g.addColorStop(0, alpha(c, 0)); g.addColorStop(1, alpha(c, .45)); ctx.fillStyle = g; ctx.fillRect(o.x - 9, y - 160, 18, 160); }
        glow(ctx, o.x, y, 30, c, .9);
        ellipse(ctx, o.x, y + 3, 9, 8, '#a8743f'); ellipse(ctx, o.x - 2, y, 4, 3, 'rgba(255,255,255,.25)');
        ctx.fillStyle = '#8a5a2f'; ctx.beginPath(); ctx.moveTo(o.x - 5, y - 4); ctx.lineTo(o.x, y - 9); ctx.lineTo(o.x + 5, y - 4); ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x - 5, y - 4); ctx.lineTo(o.x + 5, y - 4); ctx.stroke();
        ctx.globalAlpha = 1; this.lights.push({ x: o.x, y, r: big ? 110 : 60, color: c, a: .8 });
        continue;
      }
      if (o.kind === 'heart') { glow(ctx, o.x, y, 22, '#ff7a8a', .9); heart(ctx, o.x, y + 2, 8, '#ff5f74'); circle(ctx, o.x - 3, y - 2, 1.6, '#ffd1d8'); }
      else if (o.kind === 'gold') { const sq = Math.abs(Math.cos(t * 5 + o.x)); glow(ctx, o.x, y, 16, '#ffd35c', .8); ellipse(ctx, o.x, y, 6 * sq + 1, 6, '#e8a93a'); ellipse(ctx, o.x, y, 4.2 * sq + .6, 4.2, '#ffe38a'); }
      else { glow(ctx, o.x, y, 18, '#7fc8ff', .9); circle(ctx, o.x, y, 4.5, '#dff2ff'); }
      ctx.globalAlpha = 1;
      this.lights.push({ x: o.x, y, r: 50, color: o.kind === 'heart' ? '#ff7a8a' : o.kind === 'gold' ? '#ffd35c' : '#7fc8ff', a: .6 });
    }
  }
  /** Kael's sword swings: a bright crescent that sweeps and fades. */
  private drawSlashes(ctx: CanvasRenderingContext2D, e: GameEngine) {
    for (const sl of e.slashes) {
      const k = sl.life / sl.max, sweep = 1 - k;
      if (sl.narrow) {
        // Riven's dagger thrusts: two quick straight streaks.
        ctx.save(); ctx.translate(sl.x, sl.y); ctx.rotate(sl.angle); ctx.lineCap = 'round';
        for (const off of [-7, 7]) { const len = sl.reach * Math.min(1, sweep * 2 + .3); ctx.strokeStyle = alpha(sl.color || '#ffffff', .8 * k); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(18, off); ctx.lineTo(len, off * .4); ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.restore();
        this.lights.push({ x: sl.x + Math.cos(sl.angle) * 50, y: sl.y + Math.sin(sl.angle) * 40, r: 100, color: sl.color || '#e0c8ff', a: k });
        continue;
      }
      const a0 = sl.angle - 1.25, a1 = a0 + 2.5 * Math.min(1, sweep * 1.8 + .25);
      ctx.save(); ctx.translate(sl.x, sl.y); ctx.scale(1, .8);
      ctx.lineCap = 'round';
      for (const [w, c, r] of [[22, `rgba(255,180,110,${.25 * k})`, sl.reach * .8], [10, `rgba(255,230,200,${.75 * k})`, sl.reach * .82], [3, `rgba(255,255,255,${k})`, sl.reach * .86]] as Array<[number, string, number]>) {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke();
      }
      ctx.restore();
      this.lights.push({ x: sl.x + Math.cos(sl.angle) * 60, y: sl.y + Math.sin(sl.angle) * 50, r: 140, color: '#ffd0a0', a: k });
    }
  }
  /** Riven's Death Marks counting down over their targets, and Lyra's Blizzards swirling over the ground. */
  private drawSpellMarks(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time;
    for (const s of e.storms) {
      const k = Math.min(1, s.t * 2, (4 - s.t) * 3);
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, .62);
      ctx.fillStyle = `rgba(210,240,255,${.12 * k})`; ctx.beginPath(); ctx.arc(0, 0, 190, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(230,250,255,${.5 * k})`; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 60;
      ctx.beginPath(); ctx.arc(0, 0, 190, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      for (let i = 0; i < 5; i++) { const a = t * .6 + i * 1.3; ctx.fillStyle = `rgba(235,245,255,${.18 * k})`; ctx.beginPath(); ctx.ellipse(s.x + Math.cos(a) * 90, s.y - 240 + Math.sin(a * 1.3) * 20, 110, 40, 0, 0, TAU); ctx.fill(); }
      this.lights.push({ x: s.x, y: s.y, r: 260, color: '#9fe4ff', a: .6 * k });
    }
    for (const m of e.marks) {
      const en = m.e, k = 1 - m.t / m.max, y = en.y - en.r * 2.1 - 10, pulse = 1 + Math.sin(t * (8 + k * 14)) * .12;
      glow(ctx, en.x, y, 26 * pulse, '#ff6b9a', .7 + k * .3);
      ctx.strokeStyle = 'rgba(255,107,154,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(en.x, y, 15, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
      circle(ctx, en.x, y, 8 * pulse, '#2a1838'); ctx.fillStyle = '#ff9ac0'; ctx.font = `900 11px ${UI}`; ctx.textAlign = 'center'; ctx.fillText('☠', en.x, y + 4);
      ctx.save(); ctx.translate(en.x, en.y); ctx.scale(1, .6); ctx.strokeStyle = `rgba(255,107,154,${.35 + k * .4})`; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = t * 40; ctx.beginPath(); ctx.arc(0, 0, en.r + 16, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      this.lights.push({ x: en.x, y, r: 90, color: '#ff6b9a', a: .8 });
    }
  }
  private drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
    const rich = this.quality > .5;
    for (const p of list) {
      const k = p.life / p.max;
      if (p.kind === 'ring') {
        const r = p.size * (1 - k * k * .85);
        ctx.strokeStyle = alpha(p.color, k * .9); ctx.lineWidth = 2 + k * 6;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * .62, 0, 0, TAU); ctx.stroke();
        if (k > .6) this.lights.push({ x: p.x, y: p.y, r: r * 1.4, color: p.color, a: k });
        continue;
      }
      ctx.globalAlpha = Math.min(1, k * 1.6);
      if (p.kind === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.cos(p.rot * 1.3)) * .8 + .2);
        ellipse(ctx, 0, 0, p.size, p.size * .45, p.color); ctx.restore();
      } else if (p.kind === 'smoke') { ctx.globalAlpha = k * .5; circle(ctx, p.x, p.y, p.size * (1 + (1 - k) * 1.6), p.color); }
      else if (p.kind === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * .66); ctx.restore();
        if (p.glow && rich) glow(ctx, p.x, p.y, p.size * 3, p.color, .5 * k);
      } else if (p.kind === 'star') { if (rich) glow(ctx, p.x, p.y, p.size * 4, p.color, k); ctx.fillStyle = p.color; star(ctx, p.x, p.y, p.size * (.6 + k * .6), 4, .38, p.rot); ctx.fill(); }
      else if (p.kind === 'ember') { if (rich) glow(ctx, p.x, p.y, p.size * 3.5 * k + 2, p.color, k); circle(ctx, p.x, p.y, p.size * k * .6 + .5, '#fff6d8'); }
      else { if (p.glow && rich) glow(ctx, p.x, p.y, p.size * 3, p.color, k); circle(ctx, p.x, p.y, p.size * (.4 + k * .6), p.color); }
      ctx.globalAlpha = 1;
    }
    let n = 0;
    const most = 30 * this.quality;
    for (const p of list) if (p.glow && p.kind !== 'ring' && n < most && p.life / p.max > .5) { this.lights.push({ x: p.x, y: p.y, r: p.size * 10, color: p.color, a: .5 }); n++; }
  }
  private drawFloating(ctx: CanvasRenderingContext2D, e: GameEngine) {
    ctx.textAlign = 'center';
    for (const f of e.floating) {
      const k = f.life / f.max, pop = k > .8 ? 1 + (k - .8) * 3 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.font = `900 ${Math.round(f.size * pop)}px ${UI}`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,16,28,.75)'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }
  private drawArrow(ctx: CanvasRenderingContext2D, e: GameEngine, target: Point | null, color: string, lane: number) {
    if (!target) return;
    const h = e.hero, dx = target.x - h.x, dy = target.y - h.y, d = Math.hypot(dx, dy);
    if (d < 240) return;
    const a = Math.atan2(dy, dx), pulse = Math.sin(this.time * 4 + lane) * 6, R = 70 + lane * 22 + pulse;
    const x = h.x + Math.cos(a) * R, y = h.y - 6 + Math.sin(a) * R * .7;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    glow(ctx, 0, 0, 22, color, .6);
    ctx.fillStyle = color; ctx.strokeStyle = 'rgba(30,30,10,.6)'; ctx.lineWidth = 2;
    const s = lane ? .8 : 1;
    ctx.beginPath(); ctx.moveTo(12 * s, 0); ctx.lineTo(-6 * s, -9 * s); ctx.lineTo(-2 * s, 0); ctx.lineTo(-6 * s, 9 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ───────────────────────────── ambience
  private pushAmbient(a: Ambient) { if (this.weather && this.ambient.length < 320 * this.quality) this.ambient.push(a); }
  private spawnLeaf(x: number, y: number, e: GameEngine) {
    const c = regionOf(e.world, x).ambient === 'petals' ? pick(['#f7c5d5', '#ffffff', '#a3c46a']) : pick(['#e8a54b', '#c9713d', '#a3c46a', '#f0c47a']);
    this.pushAmbient({ x, y, vx: rand(10, 40), vy: rand(20, 40), life: 6, max: 6, size: rand(3.5, 6), rot: rand(0, 6), vr: rand(-3, 3), kind: 'leaf', color: c, phase: rand(0, 6) });
  }
  private updateAmbient(e: GameEngine, v: View, dt: number) {
    const kind = regionOf(e.world, v.x + v.w / 2).ambient, area = (v.w * v.h) / (1280 * 800);
    const counts: Partial<Record<AmbientKind, number>> = {};
    for (const a of this.ambient) counts[a.kind] = (counts[a.kind] || 0) + 1;
    const reduce = (this.reduced ? .3 : 1) * this.quality;
    const want: Array<[AmbientKind, number]> = kind === 'petals' ? [['petal', 30], ['butterfly', 6], ['mote', 14]] : kind === 'leaves' ? [['leaf', 24], ['firefly', 34], ['mote', 10]] : kind === 'embers' ? [['ash', 46], ['mote', 30]] : [['snow', 70], ['mote', 20]];
    for (const [k, n] of want) {
      let have = counts[k] || 0;
      while (have < n * area * reduce) {
        const x = v.x + rand(-100, v.w + 50), y = v.y + rand(-40, v.h * .6);
        const c = k === 'petal' ? pick(['#f7c5d5', '#ffffff', '#ffd6e5']) : k === 'leaf' ? pick(['#e8a54b', '#c9713d', '#a3c46a']) : k === 'firefly' ? pick(['#ffe38a', '#d8ff9a']) : k === 'butterfly' ? pick(['#ffb35c', '#9fd8ff', '#f2a1b8', '#fff49b']) : k === 'snow' ? '#eef2ff' : k === 'ash' ? pick(['#8a8078', '#5a524e', '#b0a498']) : kind === 'stars' ? pick(['#c9b6ff', '#8ee8ff']) : kind === 'embers' ? pick(['#ffb347', '#ff7a3d', '#ffd27a']) : '#fff8c0';
        const life = rand(6, 14), rising = kind === 'embers' && k === 'mote';
        this.ambient.push({ x, y: rising ? v.y + rand(v.h * .3, v.h + 40) : y, vx: k === 'snow' || k === 'ash' ? rand(-8, 12) : rand(10, 30), vy: k === 'snow' ? rand(18, 40) : k === 'ash' ? rand(12, 26) : rising ? rand(-40, -18) : k === 'petal' || k === 'leaf' ? rand(20, 38) : rand(-6, 6), life, max: life, size: k === 'snow' || k === 'ash' ? rand(1, 2.6) : k === 'butterfly' ? rand(5, 7) : k === 'firefly' ? rand(1.8, 2.8) : k === 'mote' ? rand(1, 2) : rand(3.5, 6), rot: rand(0, 6), vr: rand(-3, 3), kind: k, color: c, phase: rand(0, 6.28) });
        have++;
      }
    }
    const t = this.time, w = this.wind;
    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const a = this.ambient[i]; a.life -= dt;
      if (a.kind === 'petal' || a.kind === 'leaf') { a.x += (a.vx * w + Math.sin(t * 2 + a.phase) * 26) * dt; a.y += a.vy * dt; a.rot += a.vr * dt; }
      else if (a.kind === 'snow' || a.kind === 'ash') { a.x += (a.vx + Math.sin(t + a.phase) * 10) * dt; a.y += a.vy * dt; }
      else if (a.kind === 'firefly' || a.kind === 'mote') { a.x += (a.vx * .3 + Math.sin(t * .9 + a.phase) * 18) * dt; a.y += (a.vy + Math.cos(t * 1.1 + a.phase) * 14) * dt; }
      else if (a.kind === 'butterfly') { a.x += (Math.sin(t * .5 + a.phase) * 60) * dt; a.y += (Math.cos(t * .7 + a.phase * 2) * 40) * dt; }
      else { a.x += a.vx * dt; a.y += a.vy * dt; a.size += dt * 4; }
      const out = a.x < v.x - 160 || a.x > v.x + v.w + 160 || a.y < v.y - 260 || a.y > v.y + v.h + 120;
      if (a.life <= 0 || out) { this.ambient[i] = this.ambient[this.ambient.length - 1]; this.ambient.pop(); }
    }
  }
  private drawAmbient(ctx: CanvasRenderingContext2D) {
    const t = this.time;
    for (const a of this.ambient) {
      const fade = Math.min(1, a.life, (a.max - a.life) * 2);
      ctx.globalAlpha = fade;
      if (a.kind === 'petal' || a.kind === 'leaf') {
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot); ctx.scale(1, Math.abs(Math.sin(a.rot * 1.7)) * .7 + .3);
        ellipse(ctx, 0, 0, a.size, a.size * (a.kind === 'petal' ? .6 : .42), a.color); ctx.restore();
      } else if (a.kind === 'firefly') {
        const b = Math.max(0, Math.sin(t * 2.5 + a.phase * 3));
        glow(ctx, a.x, a.y, 16, a.color, b * fade); circle(ctx, a.x, a.y, a.size, alpha(a.color, .4 + b * .6));
        if (b > .3) this.lights.push({ x: a.x, y: a.y, r: 46, color: a.color, a: b * .8 });
      } else if (a.kind === 'mote') { glow(ctx, a.x, a.y, a.size * 5, a.color, .6 * fade); circle(ctx, a.x, a.y, a.size, a.color); }
      else if (a.kind === 'snow') circle(ctx, a.x, a.y, a.size, 'rgba(238,242,255,.85)');
      else if (a.kind === 'ash') { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.phase + t); ctx.fillStyle = a.color; ctx.fillRect(-a.size, -a.size * .5, a.size * 2, a.size); ctx.restore(); }
      else if (a.kind === 'smoke') { ctx.globalAlpha = fade * .6; circle(ctx, a.x, a.y, a.size, a.color); }
      else if (a.kind === 'butterfly') {
        const flap = Math.abs(Math.sin(t * 13 + a.phase));
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.sin(t + a.phase) * .3);
        ellipse(ctx, -a.size * .5 * flap, 0, a.size * flap, a.size * .8, a.color, -.4); ellipse(ctx, a.size * .5 * flap, 0, a.size * flap, a.size * .8, a.color, .4);
        ellipse(ctx, 0, 0, 1.2, a.size * .6, '#3a2a24'); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }
  private drawCloudShadows(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    const t = this.time;
    for (let i = 0; i < 12; i++) {
      const x = ((t * 22 + i * 1900) % (e.world.width + 1400)) - 700, y = 300 + (i % 6) * 1100 + Math.sin(i * 3) * 200;
      if (x + 500 < v.x || x - 500 > v.x + v.w || y + 300 < v.y || y - 300 > v.y + v.h) continue;
      ctx.fillStyle = 'rgba(20,40,40,.07)';
      for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(x + (j - 2) * 110, y + Math.sin(j * 2 + i) * 50, 170, 90, 0, 0, TAU); ctx.fill(); }
    }
  }

  // ───────────────────────────── screen-space
  /** `tint` is the night colour: deep blue on the Summit, teal in the woods, smoky red in the Ember Wastes. */
  private drawLighting(ctx: CanvasRenderingContext2D, w: number, h: number, e: GameEngine, toScreen: (p: Point) => Point, scale: number, darkness: number, tint: string) {
    const lc = this.lightCanvas, s = this.quality > .5 ? .5 : this.quality > .4 ? .3 : .22, lw = Math.ceil(w * s), lh = Math.ceil(h * s);
    if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
    const l = lc.getContext('2d')!;
    l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, lw, lh);
    l.fillStyle = `rgba(${tint},${darkness * (1 - e.flash * .7)})`;
    l.fillRect(0, 0, lw, lh);
    l.globalCompositeOperation = 'destination-out';
    const white = glowSprite('#ffffff');
    for (const li of this.lights) {
      const p = toScreen(li), r = li.r * scale * s;
      if (p.x * s + r < 0 || p.x * s - r > lw || p.y * s + r < 0 || p.y * s - r > lh) continue;
      l.globalAlpha = clamp(li.a, 0, 1); l.drawImage(white, p.x * s - r, p.y * s - r, r * 2, r * 2);
    }
    l.globalAlpha = 1;
    ctx.drawImage(lc, 0, 0, w, h);
    let n = 0;
    const most = this.quality >= 1 ? 60 : this.quality > .5 ? 25 : 0;
    for (const li of this.lights) {
      if (!li.color || n >= most) continue;
      const p = toScreen(li);
      if (p.x < -200 || p.x > w + 200 || p.y < -200 || p.y > h + 200) continue;
      glow(ctx, p.x, p.y, li.r * scale * .6, li.color, .12 * li.a); n++;
    }
  }
  private drawGodRays(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = this.time;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = w * (.08 + i * .22) + Math.sin(t * .15 + i * 2) * 50, wd = 50 + (i % 3) * 30, a = .05 + Math.sin(t * .4 + i * 1.7) * .03;
      ctx.fillStyle = `rgba(255,236,170,${a})`; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + wd, 0); ctx.lineTo(x + wd - h * .35, h); ctx.lineTo(x - h * .35 - wd * .5, h); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  private sun: { w: number; h: number; g: CanvasGradient | null } = { w: 0, h: 0, g: null };
  private drawSunGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.sun.w !== w || this.sun.h !== h || !this.sun.g) {
      const g = ctx.createRadialGradient(w * .85, -h * .1, 10, w * .85, -h * .1, h * .9);
      g.addColorStop(0, 'rgba(255,236,170,.22)'); g.addColorStop(1, 'rgba(255,236,170,0)'); this.sun = { w, h, g };
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = this.sun.g!; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  private drawShootingStar(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number) {
    const s = this.shooting; s.t -= dt;
    if (s.t <= 0 && s.life <= 0) { s.x = rand(w * .1, w * .9); s.y = rand(-20, h * .3); s.vx = rand(-700, -400); s.vy = rand(200, 350); s.life = .9; s.t = rand(3, 7); }
    if (s.life > 0) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * .25, s.y - s.vy * .25);
      g.addColorStop(0, `rgba(255,255,255,${Math.max(0, s.life)})`); g.addColorStop(1, 'rgba(201,182,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * .25, s.y - s.vy * .25); ctx.stroke();
      glow(ctx, s.x, s.y, 14, '#ffffff', Math.max(0, s.life));
    }
  }
  private vignette: { w: number; h: number; g: CanvasGradient | null; r: CanvasGradient | null } = { w: 0, h: 0, g: null, r: null };
  private drawScreenFx(ctx: CanvasRenderingContext2D, w: number, h: number, e: GameEngine) {
    if (this.vignette.w !== w || this.vignette.h !== h || !this.vignette.g) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .75);
      g.addColorStop(0, 'rgba(10,14,20,0)'); g.addColorStop(1, 'rgba(10,14,20,.45)');
      const r = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .7);
      r.addColorStop(0, 'rgba(200,30,40,0)'); r.addColorStop(1, 'rgba(200,30,40,1)');
      this.vignette = { w, h, g, r };
    }
    if (this.quality > .5) { ctx.fillStyle = this.vignette.g!; ctx.fillRect(0, 0, w, h); }
    if (e.hero.hp <= e.hero.maxHp * .25) { ctx.globalAlpha = .25 + Math.sin(this.time * 5) * .12; ctx.fillStyle = this.vignette.r!; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (e.danger > .03 && e.hero.hp > e.hero.maxHp * .25) {
      ctx.globalAlpha = e.danger * (.46 + Math.min(.16, e.combat * .2)) * (.8 + Math.sin(this.time * 4) * .2);
      ctx.fillStyle = this.vignette.r!; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
    }
    if (e.damageFlash > 0) { ctx.fillStyle = `rgba(255,80,60,${e.damageFlash * .5})`; ctx.fillRect(0, 0, w, h); }
    if (e.flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,245,220,${Math.min(.5, e.flash * .35)})`; ctx.fillRect(0, 0, w, h); ctx.restore(); }
    if (e.respawnFade > 0) { ctx.fillStyle = `rgba(6,8,14,${Math.min(1, e.respawnFade * 1.3)})`; ctx.fillRect(0, 0, w, h); }
  }
  private drawMinimap(ctx: CanvasRenderingContext2D, w: number, sh: number, e: GameEngine) {
    const small = w < 640 || sh < 520, MW = small ? 128 : 190, MH = small ? 96 : 140, span = 2800, S = MW / span;
    const x0 = w - MW - (small ? 8 : 14), y0 = small ? 54 : 64, h = e.hero;
    const map = worldMapCanvas(e.world), MS = MAP_SCALE;
    const vx = h.x - span / 2, vy = h.y - (MH / S) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,20,.6)'; ctx.beginPath(); ctx.roundRect(x0 - 5, y0 - 5, MW + 10, MH + 10, 12); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x0, y0, MW, MH, 8); ctx.clip();
    ctx.fillStyle = '#0b1020'; ctx.fillRect(x0, y0, MW, MH);
    ctx.drawImage(map, vx * MS, vy * MS, span * MS, (MH / S) * MS, x0, y0, MW, MH);
    drawFog(ctx, e, x0 - vx * S, y0 - vy * S, S);
    const P = (p: Point) => ({ x: x0 + (p.x - vx) * S, y: y0 + (p.y - vy) * S });
    drawMapMarkers(ctx, e, P, 1, this.time);
    ctx.restore();
    ctx.strokeStyle = 'rgba(245,215,130,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x0 - 5, y0 - 5, MW + 10, MH + 10, 12); ctx.stroke();
    if (!this.touch) { ctx.fillStyle = 'rgba(255,247,223,.75)'; ctx.font = `800 10px ${UI}`; ctx.textAlign = 'right'; ctx.fillText('M · map', x0 + MW, y0 + MH + 16); }
  }
}

// ───────────────────────────── world map (shared by the minimap and the full map screen)
const MAP_SCALE = .08;
let mapCache: { world: WorldDefinition; c: HTMLCanvasElement } | null = null;
function worldMapCanvas(world: WorldDefinition) {
  if (mapCache?.world === world) return mapCache.c;
  const S = MAP_SCALE;
  const c = document.createElement('canvas'); c.width = Math.ceil(world.width * S); c.height = Math.ceil(world.height * S);
  const m = c.getContext('2d')!;
  for (const r of world.regions) {
    const p = r.palette;
    m.fillStyle = p.ground; m.fillRect(r.x0 * S, 0, (r.x1 - r.x0) * S + 1, c.height);
    for (let y = 0; y < world.height; y += 160) for (let x = r.x0; x < r.x1; x += 160) { const n = fbm(x + 777, y, r.chapter * 31); if (n > .55) { m.fillStyle = alpha(p.alternate, .6); m.fillRect(x * S, y * S, 160 * S, 160 * S); } }
  }
  for (const o of world.obstacles) {
    const p = regionOf(world, o.x).palette;
    if (o.kind === 'tree' || o.kind === 'pine' || o.kind === 'bush' || o.kind === 'mushroom' || o.kind === 'deadtree') { m.fillStyle = alpha(p.foliage[0], .95); m.beginPath(); m.arc(o.x * S, o.y * S, Math.max(1.3, o.r * S * 1.3), 0, TAU); m.fill(); }
    else if (o.kind === 'rock' || o.kind === 'crystal' || o.kind === 'cliff') { m.fillStyle = o.kind === 'cliff' ? shade(p.rock.startsWith('#') ? p.rock : '#8c8f80', -.3) : p.rock; m.beginPath(); m.arc(o.x * S, o.y * S, Math.max(1, o.r * S * (o.kind === 'cliff' ? 1.6 : 1)), 0, TAU); m.fill(); }
  }
  m.lineCap = 'round'; m.lineJoin = 'round'; m.lineWidth = 5;
  for (const r of world.roads) { m.strokeStyle = regionOf(world, r[0].x).palette.path; m.beginPath(); r.forEach((pt, i) => i ? m.lineTo(pt.x * S, pt.y * S) : m.moveTo(pt.x * S, pt.y * S)); m.stroke(); }
  for (const pd of world.ponds) { m.fillStyle = regionOf(world, pd.x).palette.water; m.beginPath(); m.ellipse(pd.x * S, pd.y * S, pd.r * S, pd.r * .58 * S, 0, 0, TAU); m.fill(); }
  for (const o of world.obstacles) if (o.kind === 'house' || o.kind === 'manor' || o.kind === 'windmill' || o.kind === 'tower' || o.kind === 'tent') { m.fillStyle = regionOf(world, o.x).palette.roof[0]; const s = o.kind === 'manor' ? 11 : 8; m.fillRect(o.x * S - s / 2, o.y * S - s / 2, s, s * .85); }
  mapCache = { world, c };
  return c;
}
/** One pixel per explore cell, scaled up with smoothing so the fog has soft edges. */
const fogCache = new WeakMap<GameEngine, { c: HTMLCanvasElement; v: number }>();
function drawFog(ctx: CanvasRenderingContext2D, e: GameEngine, ox: number, oy: number, S: number) {
  const cols = e.exploreCols, rows = e.explored.length / cols;
  let f = fogCache.get(e);
  if (!f) { const c = document.createElement('canvas'); c.width = cols + 2; c.height = rows + 2; f = { c, v: -1 }; fogCache.set(e, f); }
  if (f.v !== e.exploredVersion) {
    const g = f.c.getContext('2d')!, img = g.createImageData(cols + 2, rows + 2);
    for (let y = 0; y < rows + 2; y++) for (let x = 0; x < cols + 2; x++) {
      const inside = x > 0 && y > 0 && x <= cols && y <= rows, i = (y * (cols + 2) + x) * 4;
      img.data[i] = 8; img.data[i + 1] = 10; img.data[i + 2] = 22; img.data[i + 3] = inside && e.explored[(y - 1) * cols + x - 1] ? 0 : 228;
    }
    g.putImageData(img, 0, 0); f.v = e.exploredVersion;
  }
  const C = EXPLORE_CELL * S;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(f.c, ox - C, oy - C, (cols + 2) * C, (rows + 2) * C);
}
const seen = (e: GameEngine, p: Point) => { const cx = Math.floor(p.x / EXPLORE_CELL), cy = Math.floor(p.y / EXPLORE_CELL); return !!e.explored[cy * e.exploreCols + cx]; };
function drawMapMarkers(ctx: CanvasRenderingContext2D, e: GameEngine, P: (p: Point) => Point, size: number, t: number, x0 = -Infinity, x1 = Infinity) {
  const dot = (p: Point, r: number, c: string) => { const q = P(p); circle(ctx, q.x, q.y, r * size, c); };
  const inside = (p: Point) => p.x >= x0 && p.x <= x1;
  for (const o of e.getObjects()) {
    if (!inside(o) || !seen(e, o)) continue;
    const acc = regionOf(e.world, o.x).palette.accent;
    if (o.kind === 'key') { const q = P(o); glow(ctx, q.x, q.y, 10 * size, acc, .9); dot(o, 3 + Math.sin(t * 4) * .8, acc); }
    else if (o.kind === 'chest' && !e.isOpened(o.id)) dot(o, 2, '#ffd35c');
    else if (o.kind === 'shrine') dot(o, 3, acc);
    else if (o.kind === 'finale') { const q = P(o); ctx.fillStyle = '#fff1b8'; star(ctx, q.x, q.y, 5 * size, 5, .45); ctx.fill(); }
    else if (o.kind === 'questItem') dot(o, 2, e.quest(o.questId!)?.main ? MAIN_COLOR : SIDE_COLOR);
    else if (o.kind === 'cage') { const q = P(o); glow(ctx, q.x, q.y, 9 * size, '#ff6b5b', .7); dot(o, 2.8, e.quest(o.questId!)?.main ? MAIN_COLOR : SIDE_COLOR); }
    else if (o.kind === 'campfire' || o.kind === 'fountain') dot(o, 2, o.kind === 'fountain' ? '#9fd8ff' : '#ffb347');
  }
  for (const n of e.npcs) { if (!inside(n) || !seen(e, n) || !e.npcVisible(n)) continue; const mk = e.npcMarker(n); dot(n, mk ? 2.8 : 1.8, !mk ? (n.role === 'merchant' || n.role === 'smith' || n.role === 'armorer' || n.role === 'inn' ? '#ffd35c' : '#fff7df') : mk.main ? MAIN_COLOR : SIDE_COLOR); }
  for (const en of e.enemies) if (!en.dead && inside(en) && seen(e, en)) { if (en.boss) { const q = P(en); glow(ctx, q.x, q.y, 10 * size, '#ff6b5b', .6 + Math.sin(t * 5) * .3); dot(en, 3.4, '#ff6b5b'); } else if (en.heroic) { const q = P(en); glow(ctx, q.x, q.y, 8 * size, '#c98aff', .55 + Math.sin(t * 4) * .25); dot(en, 2.8, '#e8a0ff'); } else if (en.aggro) dot(en, 1.6, '#ff9a8a'); }
  const qt = e.questTarget(); if (qt && inside(qt)) { const q = P(qt); ctx.strokeStyle = SIDE_COLOR; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, (5 + Math.sin(t * 4)) * size, 0, TAU); ctx.stroke(); }
  const mt = e.mainTarget(); if (mt && inside(mt) && size > 1) { const q = P(mt); ctx.strokeStyle = MAIN_COLOR; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, (6 + Math.sin(t * 4)) * size, 0, TAU); ctx.stroke(); }
  const h = e.hero; if (!inside(h)) return;
  const ha = Math.atan2(h.faceY, h.faceX), q = P(h);
  ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ha); ctx.scale(size, size);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-1.5, 0); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
/**
 * Full-screen map of the whole valley, used by the map overlay. `view` is the world point at the centre of the canvas and
 * the scale in screen px per world px. Zoomed out, each land shows its name; zoomed in, every discovered place does.
 */
export function drawWorldMap(ctx: CanvasRenderingContext2D, w: number, h: number, e: GameEngine, t: number, view: { cx: number; cy: number; S: number }) {
  const world = e.world, map = worldMapCanvas(world), S = view.S;
  const ox = w / 2 - view.cx * S, oy = h / 2 - view.cy * S, mw = world.width * S, mh = world.height * S;
  ctx.clearRect(0, 0, w, h);
  ctx.save(); ctx.beginPath(); ctx.roundRect(Math.max(0, ox), Math.max(0, oy), Math.min(w, ox + mw) - Math.max(0, ox), Math.min(h, oy + mh) - Math.max(0, oy), 14); ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(map, 0, 0, map.width, map.height, ox, oy, mw, mh);
  drawFog(ctx, e, ox, oy, S);
  const P = (p: Point) => ({ x: ox + p.x * S, y: oy + p.y * S });
  const inView = (p: Point, pad = 60) => { const q = P(p); return q.x > -pad && q.x < w + pad && q.y > -pad && q.y < h + pad; };
  ctx.textAlign = 'center';
  // Borders between the lands.
  ctx.strokeStyle = 'rgba(255,240,200,.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
  for (const r of world.regions.slice(1)) { const q = P({ x: r.x0, y: 0 }); ctx.beginPath(); ctx.moveTo(q.x, oy); ctx.lineTo(q.x, oy + mh); ctx.stroke(); }
  ctx.setLineDash([]);
  const labels = S * 140 >= 9;
  if (labels) for (const poi of world.pois) {
    if (!inView(poi)) continue;
    const q = P(poi), known = e.discovered.has(poi.id);
    if (!known && !seen(e, poi)) { ctx.fillStyle = 'rgba(255,247,223,.35)'; ctx.font = `900 14px ${UI}`; ctx.fillText('?', q.x, q.y + 5); continue; }
    const big = poi.kind === 'city';
    ctx.font = `${big ? 900 : 700} ${Math.round(clamp(S * (big ? 190 : 140), 10, big ? 20 : 16))}px ${DISPLAY}`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,12,20,.8)'; ctx.strokeText(poi.name, q.x, q.y - 10); ctx.fillStyle = big ? '#ffe9a8' : known ? '#fff4d6' : 'rgba(255,244,214,.6)'; ctx.fillText(poi.name, q.x, q.y - 10);
  }
  // Each land's name across its top, bigger when zoomed out.
  for (const r of world.regions) {
    const q = P({ x: (r.x0 + r.x1) / 2, y: 0 }), size = Math.round(clamp(S * 420, 13, 26));
    if (q.x < -300 || q.x > w + 300) continue;
    ctx.font = `900 ${size}px ${DISPLAY}`; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,12,20,.85)';
    const y = Math.max(oy, 0) + size + 8;
    ctx.strokeText(r.title, q.x, y); ctx.fillStyle = r.palette.accent; ctx.fillText(r.title, q.x, y);
    ctx.font = `800 ${Math.max(10, size * .5)}px ${UI}`; ctx.strokeText(`Chapter ${r.chapter} · Lv ${r.levels[0]}–${r.levels[1]}`, q.x, y + size * .75); ctx.fillStyle = 'rgba(255,244,214,.8)'; ctx.fillText(`Chapter ${r.chapter} · Lv ${r.levels[0]}–${r.levels[1]}`, q.x, y + size * .75);
  }
  drawMapMarkers(ctx, e, P, clamp(S * 18, .9, 1.5), t);
  ctx.restore();
  ctx.strokeStyle = 'rgba(245,215,130,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(ox, oy, mw, mh, 14); ctx.stroke();
}
