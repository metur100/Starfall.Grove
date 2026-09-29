import { EXPLORE_CELL, type Critter, type Enemy, type GameEngine, type Hazard, type Npc, type Particle, type Pet, type Trap, type Well } from './engine';
import { MOUNTS } from './mounts';
import { TRAILS } from './trails';
import { RARITY, SLOT_ORDER, lookOf, type Look } from './gear';
import { Grid } from './spatial';
import { REGION_W, fbm } from './worldgen';
import type { BossLook, BossVariant } from './bosses';
import type { Captive, Decor, ItemIcon, Obstacle, Palette, Point, Poi, Region, WorldDefinition, WorldObject } from './types';
import { BOSS, Cutter, INK, PAPER, SCENERY, SCENERY_LIVE, SMALL, SMALL_STICKER, STICKER, grainPattern, type Baked, type Box, type CutStyle } from './art/cutout';
import { DECOR_BOX, paintDecor, paving, sheet, strip, type Blob } from './art/ground';
import { hash, mix, rrect } from './art/color';
import { paintProp, propShadow } from './art/props';
import { FIGURE_BOX, drawFigure, facingOf, type ArmAction, type Facing, type Joints, type Pose } from './art/rig';
import { heroFigure, heroHooks, staffTip } from './art/heroes';
import { toolHooks, villagerFigure } from './art/people';

type AmbientKind = 'petal' | 'leaf' | 'firefly' | 'mote' | 'snow' | 'butterfly' | 'smoke' | 'ash';
type Ambient = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; rot: number; vr: number; kind: AmbientKind; color: string; phase: number };
type Light = { x: number; y: number; r: number; color?: string; a: number };
type View = { x: number; y: number; w: number; h: number };
type Sprite = { c: HTMLCanvasElement; l: number; t: number; w: number; h: number };
type BossColors = { body: string; dark: string; light: string; trim: string; glow: string; eye: string };

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const DISPLAY = 'Cinzel, Georgia, serif';
const UI = 'Nunito, "Trebuchet MS", sans-serif';
const BUBBLE_FONT = `800 13px ${UI}`;
const CHUNK = 512;
/** Grass tiles: the ground each covers (big tiles mean fewer canvases to hand to the GPU), and how far its tufts (with
 *  their lean and shadow) reach past its edges. */
const DECOR_TILE = 512, DECOR_MX = 40, DECOR_MT = 50, DECOR_MB = 16;
type DecorTile = { items: Decor[]; glows: Decor[]; live: Decor[]; c: HTMLCanvasElement | null; beat: number; res: number; keep: number; phase: number; kept: (keep: number) => number };
const BAKED_DECOR = new Set(['pebble', 'clover', 'crop']);
const TALL = new Set(['tree', 'pine', 'house', 'manor', 'windmill', 'tower', 'deadtree', 'mushroom', 'crystal', 'cliff']);
/** Buildings and cliffs don't sway in the wind. */
const STILL = new Set(['house', 'manor', 'tower', 'windmill', 'cliff']);
/** Scenery with moving parts drawn over its baked piece (water, smoke, flags, sails, flames, glows, falling leaves). */
const LIVELY = new Set(['fountain', 'banner', 'manor', 'tree', 'crystal', 'mushroom', 'lamppost', 'campfire', 'windmill', 'house', 'tower']);
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
/** While a cutout is being painted, glows and ground shadows are set aside (in world units) and drawn outside it, so
 *  they don't get a paper edge. */
type Deferred = { g: CanvasRenderingContext2D; inv: DOMMatrix; x: number; y: number; res: number; glows: Array<[number, number, number, string, number]>; shadows: Array<[number, number, number, number, number]> };
let DEFER: Deferred | null = null;
/** A cut piece in its own canvas, with the ground shadows, glows and lights it made (relative to its anchor). */
type Piece = { b: Baked; glows: Deferred['glows']; shadows: Deferred['shadows']; lights: Light[] };
function deferPoint(d: Deferred, x: number, y: number): [number, number, number] {
  const m = d.g.getTransform(), p = d.inv.transformPoint(m.transformPoint(new DOMPoint(x, y)));
  return [p.x + d.x, p.y + d.y, Math.hypot(m.a, m.b) / d.res];
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 1) {
  if (r <= 0 || a <= 0) return;
  if (DEFER && ctx === DEFER.g) { const [wx, wy, k] = deferPoint(DEFER, x, y); DEFER.glows.push([wx, wy, r * k, color, a * ctx.globalAlpha]); return; }
  const prevA = ctx.globalAlpha, prevOp = ctx.globalCompositeOperation;
  ctx.globalAlpha = prevA * a; ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prevA; ctx.globalCompositeOperation = prevOp;
}
/** Text baked into a canvas stays as it was drawn, so nothing with text is baked until the web fonts it uses (the
 *  storybook capitals and the rounded UI face) have loaded. */
let fontsLoaded = false;
const fontsReady = () => {
  if (fontsLoaded || typeof document === 'undefined' || !document.fonts) return true;
  try { fontsLoaded = document.fonts.status === 'loaded' && document.fonts.check('700 24px Cinzel') && document.fonts.check('900 16px Nunito'); } catch { fontsLoaded = true; }
  return fontsLoaded;
};
/** How brightly a glowing mushroom or shard shines at time `t` (each pulses on its own). */
const shroomGlow = (d: Decor, t: number) => .55 + Math.sin(t * 2 + d.seed * 9) * .2;
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 4, inner = .38, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) { const a = rot + (i / (points * 2)) * TAU - Math.PI / 2, rr = i % 2 ? r * inner : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, rot = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); ctx.fill(); }
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(.1, r), 0, TAU); ctx.fill(); }
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = .25) {
  if (DEFER && ctx === DEFER.g) { const [wx, wy, k] = deferPoint(DEFER, x, y); DEFER.shadows.push([wx, wy, rx * k, ry * k, a]); return; }
  ellipse(ctx, x, y, rx, ry, `rgba(40,24,40,${a})`);
}
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

/** How far each solid object reaches around its anchor, for its cutout. */
const OBJECT_BOX: Partial<Record<WorldObject['kind'], Box>> = {
  chest: [-32, -46, 64, 66], sign: [-36, -54, 72, 66], lore: [-28, -56, 56, 74], crack: [-72, -86, 144, 102], cage: [-52, -124, 104, 150],
  shrine: [-72, -76, 144, 104], finale: [-64, -132, 158, 172], site: [-80, -170, 160, 210], switch: [-34, -84, 68, 104],
};
// ───────────────────────────── renderer
export class Renderer {
  private cam = { x: 0, y: 0, ready: false };
  /** The engine's hard-cut counter last seen: a new value snaps the camera. */
  private camCut = -1;
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
  /** Where the camera was when every sprite around it was last found baked. */
  private prefetched: Point | null = null;
  private liveDecor: Grid<Decor> = new Grid(256);
  private bakedDecor: Grid<Decor> = new Grid(256);
  private roadBoxes: Array<{ pts: Point[]; x0: number; y0: number; x1: number; y1: number }> = [];
  private draws: Array<{ y: number; run: () => void }> = [];
  private near: ReturnType<GameEngine['nearest']> = null;
  private lookCache = { key: '-', look: {} as Look };
  /** The paper-cutout compositor, and device pixels per world unit this frame. */
  private cut = new Cutter(); private px = 1;
  /** The page's world transform this frame (camera scale, position and shake), and the ground resolution the tuft
   *  memo was made for. */
  private worldM = new DOMMatrix(); private memoRes = 0;
  /** The joints (and cast progress) the hero was last cut with, for glows that sit on their staff. */
  private heroCut: { joints: Joints | null; k: number } = { joints: null, k: 0 };
  /** Villagers' poses, cut once and reused (most recently used last). */
  private people = new Map<string, { b: Baked; j: Joints | null }>();
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

  /**
   * Living things are paper puppets animated "on twos", like stop-motion: each is cut again `fps` times a second (twelve
   * for creatures, quicker for the hero) into a canvas of its own, with the shadows, glows and lights it made noted
   * down, and that one piece is drawn every frame wherever it stands. `key` names the thing; `worldCoords` painters
   * draw at its world position.
   */
  private living(ctx: CanvasRenderingContext2D, key: unknown, x: number, y: number, box: Box, style: CutStyle, draw: (g: CanvasRenderingContext2D) => void, overlay?: string, worldCoords = false, fps = 12) {
    // Each thing keeps its own phase, so their re-cuts are spread over the frames instead of all landing on one.
    let L = this.alive.get(key);
    const phase = L?.phase ?? Math.random(), beat = Math.floor(this.time * fps + phase), ov = overlay || '';
    if (!L || L.beat !== beat || L.px !== this.px || L.overlay !== ov || L.box[0] !== box[0] || L.box[1] !== box[1] || L.box[2] !== box[2] || L.box[3] !== box[3]) {
      const now = this.time; this.time = (beat - phase) / fps;
      let piece: Piece;
      try { piece = this.cutPiece(L?.b.c, x, y, box, style, draw, overlay, worldCoords); } finally { this.time = now; }
      L = { ...piece, beat, px: this.px, overlay: ov, box: [box[0], box[1], box[2], box[3]], phase };
      this.alive.delete(key); this.alive.set(key, L);
      while (this.alive.size > 160) this.alive.delete(this.alive.keys().next().value);
    } else { this.alive.delete(key); this.alive.set(key, L); }
    this.drawPiece(ctx, L, x, y);
  }
  private alive = new Map<unknown, Piece & { beat: number; px: number; overlay: string; box: Box; phase: number }>();
  /** A piece that looks the same whenever it is drawn with the same `key` (which must name everything it depends on,
   *  apart from where it stands): cut once and reused, like the villagers' poses. */
  private still(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, box: Box, style: CutStyle, draw: (g: CanvasRenderingContext2D) => void) {
    const k = `${key}|${this.px}`;
    let L = this.frames.get(k);
    if (L) { this.frames.delete(k); this.frames.set(k, L); }
    else {
      L = this.cutPiece(undefined, 0, 0, box, style, draw, undefined, false); this.frames.set(k, L);
      while (this.frames.size > 200) this.frames.delete(this.frames.keys().next().value!);
    }
    this.drawPiece(ctx, L, x, y);
  }
  private frames = new Map<string, Piece>();
  /** Cuts a piece into a canvas of its own (reusing `reuse` when it fits), noting the ground shadows, glows and lights
   *  it made, relative to its anchor at (x, y). `worldCoords` painters draw at the anchor's world position. */
  private cutPiece(reuse: HTMLCanvasElement | undefined, x: number, y: number, box: Box, style: CutStyle, draw: (g: CanvasRenderingContext2D) => void, overlay: string | undefined, worldCoords: boolean): Piece {
    const extra = Math.max(style.shadowX, style.shadowY) + 2, [l, t, w, h] = box, bl = l - extra, bt = t - extra, bw = w + extra * 3, bh = h + extra * 3;
    const W = Math.ceil(bw * this.px), H = Math.ceil(bh * this.px);
    let c = reuse; if (!c || c.width !== W || c.height !== H) { c = document.createElement('canvas'); c.width = W; c.height = H; }
    const o = c.getContext('2d')!; o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W, H); o.setTransform(this.px, 0, 0, this.px, -bl * this.px, -bt * this.px);
    const g = this.cut.begin(box, this.px, style, overlay), lights = this.lights.length;
    const d: Deferred = { g, inv: g.getTransform().inverse(), x: 0, y: 0, res: this.px, glows: [], shadows: [] };
    DEFER = d;
    try { if (worldCoords) g.translate(-x, -y); draw(g); } finally { DEFER = null; }
    this.cut.finish(o, 0, 0);
    const lit = this.lights.splice(lights).map(li => ({ ...li, x: li.x - x, y: li.y - y }));
    return { b: { c, l: bl, t: bt, w: bw, h: bh }, glows: d.glows, shadows: d.shadows, lights: lit };
  }
  private drawPiece(ctx: CanvasRenderingContext2D, L: Piece, x: number, y: number) {
    for (const [sx, sy, rx, ry, a] of L.shadows) ellipse(ctx, x + sx, y + sy, rx, ry, `rgba(40,24,40,${a})`);
    ctx.drawImage(L.b.c, x + L.b.l, y + L.b.t, L.b.w, L.b.h);
    for (const [gx, gy, r, c, a] of L.glows) glow(ctx, x + gx, y + gy, r, c, a);
    for (const li of L.lights) this.lights.push({ x: li.x + x, y: li.y + y, r: li.r, color: li.color, a: li.a });
  }
  private setup(world: WorldDefinition) {
    if (this.worldRef === world) return;
    this.worldRef = world; this.chunks.clear(); this.sprites.clear(); this.prefetched = null; this.decorSprites.clear(); this.ambient = [];
    this.obstacleMemo = new WeakMap(); this.decorMemo = new WeakMap(); this.decorTiles.clear(); this.frames.clear(); this.ring = null; this.ahead = null;
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
    // Small screens pull the camera back a little; big monitors bring it closer so a 1440p screen shows about the
    // same stretch of valley as a laptop, and the paper figures stay a size you can see.
    const scale = w < 640 ? .72 : w < 960 ? .85 : clamp(Math.min(h / 820, w / 1460), 1, 2);
    // The ground sheets are soft paper shapes, so on a big monitor they are baked at screen resolution and drawn a little
    // larger: baking them at the camera's zoom as well made textures the GPU could not keep up with.
    const res = clamp(Math.round(pixelRatio * Math.min(scale, 1) * 2) / 2, 1, 2);
    this.chunkRes = res; this.px = scale * pixelRatio; this.cut.quality = this.quality;
    if (res !== this.memoRes) { this.memoRes = res; this.decorMemo = new WeakMap(); }
    const vw = w / scale, vh = h / scale;
    this.wind = .75 + Math.sin(time * .35) * .35 + Math.sin(time * 1.3) * .1;
    // In a cutscene the camera glides to what the story shows; otherwise it follows the hero a little ahead.
    const focus = e.cineFocus;
    const tx = clamp((focus ? focus.x : hero.x + hero.vx * .28) - vw / 2, 0, Math.max(0, world.width - vw));
    const ty = clamp((focus ? focus.y : hero.y + hero.vy * .28) - vh / 2, 0, Math.max(0, world.height - vh));
    if (!this.cam.ready || this.camCut !== e.camCut || (!focus && Math.hypot(tx - this.cam.x, ty - this.cam.y) > 900)) { this.cam.x = tx; this.cam.y = ty; this.cam.ready = true; this.camCut = e.camCut; this.fox.x = hero.x - 40; this.fox.y = hero.y + 10; }
    const k = Math.min(1, dt * (focus ? 1.8 : 5));
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    const shake = this.shake ? e.shake * (this.reduced ? .25 : 1) : 0;
    const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake;
    const camX = this.cam.x, camY = this.cam.y;
    const view: View = { x: camX, y: camY, w: vw, h: vh };
    this.lights = [];
    this.near = e.nearest();

    ctx.save();
    ctx.scale(scale, scale); ctx.translate(-camX + sx, -camY + sy);
    this.worldM = ctx.getTransform();
    this.drawGround(ctx, e, view);
    this.drawWater(ctx, e, view);
    this.drawDecor(ctx, e, view);
    this.drawPlaceNames(ctx, e, view);
    for (const z of e.hazards) this.drawHazardGround(ctx, z);
    for (const tr of e.traps) this.drawTrap(ctx, tr);
    for (const w of e.wells) this.drawWell(ctx, w);
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

    this.prefetchSprites(e, x0 - 560, y0 - 420, x1 + 560, y1 + 520);
    this.drawOrbs(ctx, e);
    this.drawProjectiles(ctx, e);
    this.drawSlashes(ctx, e);
    this.drawSpellMarks(ctx, e);
    for (const z of e.hazards) this.drawHazardAir(ctx, z);
    this.drawFires(ctx, e, view);
    this.drawParticles(ctx, e.particles);
    this.drawMeteors(ctx, e);
    if (this.weather) { this.updateAmbient(e, view, dt); this.drawAmbient(ctx); } else this.ambient.length = 0;
    this.drawBubbles(ctx, e, view);
    this.drawLevelTags(ctx, e, view);
    this.drawFloating(ctx, e);
    if (!e.cine) { this.drawArrow(ctx, e, e.mainTarget(), MAIN_COLOR, 0); this.drawArrow(ctx, e, e.questTarget(), SIDE_COLOR, 1); }
    const rich = this.quality > .5, here = regionOf(world, hero.x), amb = here.ambient;
    if (amb === 'petals' && rich && this.weather) this.drawCloudShadows(ctx, e, view);
    ctx.restore();

    const toScreen = (p: Point) => ({ x: (p.x - camX + sx) * scale, y: (p.y - camY + sy) * scale });
    // Where the touch "Talk" button goes: just above the head of whoever (or whatever) is in reach.
    const nr = this.near;
    if (nr) { const p = nr.kind === 'npc' ? nr.n : nr.o, lift = nr.kind === 'npc' ? (e.npcMarker(nr.n) || nr.n.role === 'merchant' || nr.n.role === 'smith' || nr.n.role === 'armorer' || nr.n.role === 'inn' ? 84 : 58) : nr.o.kind === 'cage' ? 130 : 62; this.nearScreen = { x: (p.x - camX) * scale, y: (p.y - lift - camY) * scale }; }
    else this.nearScreen = null;
    // Story scenes at night darken even the sunny meadow, so lamps and fires glow.
    const dark = Math.max(this.darkAt(world, camX + vw / 2), e.cineDark);
    if (dark > .01) this.drawLighting(ctx, w, h, e, toScreen, scale, dark, amb === 'stars' ? '8,8,32' : amb === 'embers' ? '28,10,8' : '6,20,22');
    if (amb === 'leaves' && rich && this.weather) this.drawGodRays(ctx, w, h);
    if (amb === 'stars' && this.weather) this.drawShootingStar(ctx, w, h, dt);
    if (amb === 'petals' && this.quality >= 1 && this.weather) this.drawSunGlow(ctx, w, h);
    this.drawScreenFx(ctx, w, h, e);
    if (!e.cine) this.drawMinimap(ctx, w, h, e);
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
    this.ring = { e, c0, c1, r0, r1 };
    if (baked === 0) this.queueRing();
    const keep = (c1 - c0 + 3) * (r1 - r0 + 3) + 4;
    while (this.chunks.size > keep) this.chunks.delete(this.chunks.keys().next().value!);
  }
  /** The chunks around the latest view, and whether a bake of them is waiting for idle time. */
  private ring: { e: GameEngine; c0: number; c1: number; r0: number; r1: number } | null = null;
  private ringQueued = false;
  /** The grass tiles in view last frame, for cutting the next ones ahead. */
  private ahead: { e: GameEngine; c0: number; c1: number; r0: number; r1: number; keep: number; res: number; rate: number } | null = null;
  /** The next grass tile just beyond the view, on the side the hero is walking toward, that has no cut yet. */
  private nextAheadTile(): [number, number, DecorTile] | null {
    const A = this.ahead; if (!A) return null;
    const h = A.e.hero, spots: Array<[number, number]> = [];
    if (Math.abs(h.vx) > 20) for (let ty = A.r0; ty <= A.r1; ty++) spots.push([h.vx > 0 ? A.c1 + 1 : A.c0 - 1, ty]);
    if (Math.abs(h.vy) > 20) for (let tx = A.c0; tx <= A.c1; tx++) spots.push([tx, h.vy > 0 ? A.r1 + 1 : A.r0 - 1]);
    for (const [tx, ty] of spots) {
      if (tx < 0 || ty < 0) continue;
      const tile = this.decorTile(A.e, tx, ty);
      if (tile.kept(A.keep) >= 5 && !(tile.c && tile.res === A.res && tile.keep === A.keep)) return [tx, ty, tile];
    }
    return null;
  }
  private nextRingChunk(): [number, number] | null {
    const R = this.ring; if (!R) return null;
    for (let cy = R.r0 - 1; cy <= R.r1 + 1; cy++) for (let cx = R.c0 - 1; cx <= R.c1 + 1; cx++) if (cx >= 0 && cy >= 0 && !this.chunks.has(`${cx},${cy}`)) return [cx, cy];
    return null;
  }
  /** Bakes the ring's ground chunks, then the grass tiles ahead, in the browser's idle time between frames (where it
   *  has some; at the latest a moment later), so making them never holds up a frame. */
  private queueRing() {
    if (this.ringQueued || (!this.nextRingChunk() && !this.nextAheadTile())) return;
    this.ringQueued = true;
    const run = (deadline?: IdleDeadline) => {
      this.ringQueued = false;
      for (let n = 0; n < 4; n++) {
        const next = this.nextRingChunk(), tile = next ? null : this.nextAheadTile();
        if (next && this.ring) this.bakeChunk(this.ring.e, next[0], next[1]);
        else if (tile && this.ahead) { const A = this.ahead, beat = Math.floor(this.time * A.rate + tile[2].phase); this.cutDecorTile(tile[2], tile[0], tile[1], (beat - tile[2].phase) / A.rate, beat, A.e, A.res, A.keep); }
        else return;
        if (!deadline || deadline.timeRemaining() < 4) break;
      }
      this.queueRing();
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 250 }); else setTimeout(run, 0);
  }
  private bakeChunk(e: GameEngine, cx: number, cy: number) {
    const res = this.chunkRes, world = e.world, ox = cx * CHUNK, oy = cy * CHUNK, region = regionOf(world, ox + 1), p = region.palette;
    const c = document.createElement('canvas'); c.width = c.height = Math.ceil(CHUNK * res);
    const g = c.getContext('2d')!;
    g.scale(res, res); g.translate(-ox, -oy);
    g.fillStyle = p.ground; g.fillRect(ox, oy, CHUNK, CHUNK);
    // The page itself: faint fibres and a slow mottle of lighter and darker paper.
    g.globalAlpha = .45; g.fillStyle = grainPattern(g); g.fillRect(ox, oy, CHUNK, CHUNK); g.globalAlpha = 1;
    // Sheets laid over it, from the noise: lighter where it is high, a darker hollow where it is low. Sampled past the
    // chunk's edge so a sheet carries on seamlessly into the next chunk.
    const M = 90, S = 44, lo: Blob[] = [], hi: Blob[] = [], top: Blob[] = [];
    for (let y = Math.floor((oy - M) / S) * S; y < oy + CHUNK + M; y += S) for (let x = Math.floor((ox - M) / S) * S; x < ox + CHUNK + M; x += S) {
      const n = fbm(x + 777, y, region.chapter * 31), j = hash(x * .37 + y * 1.3) * 10 - 5;
      if (n > .53) hi.push([x + j, y - j, 30 + Math.min(18, (n - .53) * 140)]);
      if (n > .64) top.push([x - j, y + j, 24 + Math.min(14, (n - .64) * 120)]);
      if (n < .36) lo.push([x + j, y + j, 28 + Math.min(16, (.36 - n) * 120)]);
    }
    const alt = p.alternate, dark = mix(p.ground, p.foliage[0], .32), bright = mix(alt, p.foliage[2], .3);
    sheet(g, lo, dark, p.ground, 3, 4);
    sheet(g, hi, alt, p.ground);
    sheet(g, top, bright, alt, 3, 4, 1.4);
    // Places: plazas, fields and ruined floors.
    for (const poi of world.pois) {
      if (poi.x + poi.r < ox - 60 || poi.x - poi.r > ox + CHUNK + 60 || poi.y + poi.r < oy - 60 || poi.y - poi.r > oy + CHUNK + 60) continue;
      this.bakePlace(g, poi, p);
    }
    // Roads: strips of card.
    const boxes = this.roadBoxes.filter(b => b.x1 > ox && b.x0 < ox + CHUNK && b.y1 > oy && b.y0 < oy + CHUNK);
    if (boxes.length) {
      strip(g, boxes.map(b => b.pts), p.path, p.ground, 66);
      for (const b of boxes) for (let i = 1; i < b.pts.length; i++) {
        const a = b.pts[i - 1], q = b.pts[i], len = Math.hypot(q.x - a.x, q.y - a.y);
        for (let s = 0; s < len; s += 46) {
          const f = s / len, x = a.x + (q.x - a.x) * f, y = a.y + (q.y - a.y) * f, n = Math.sin(s * 1.7 + i * 11 + x * .01);
          if (x < ox - 40 || x > ox + CHUNK + 40 || y < oy - 40 || y > oy + CHUNK + 40) continue;
          const px = x + n * 22, py = y + Math.cos(s + i) * 16, rx = 4 + Math.abs(n) * 3.5, ry = 2.6 + Math.abs(n) * 1.6;
          ellipse(g, px + 1.5, py + 2, rx, ry, mix(p.path, INK, .25)); ellipse(g, px, py, rx, ry, shade(p.pathEdge, .1)); ellipse(g, px - .8, py - .8, rx * .6, ry * .5, 'rgba(255,255,245,.35)');
        }
      }
    }
    // Lake beds (the living surface is drawn each frame).
    for (const pond of world.ponds) {
      if (pond.x + pond.r * 1.2 < ox || pond.x - pond.r * 1.2 > ox + CHUNK || pond.y + pond.r < oy || pond.y - pond.r > oy + CHUNK) continue;
      const shore = region.ground === 'snow' ? '#dfe6f5' : region.ground === 'ash' ? '#5a3a30' : mix(p.path, p.ground, .3);
      ellipse(g, pond.x + 5, pond.y + 7, pond.r * 1.1, pond.r * .66, mix(p.ground, INK, .2));
      ellipse(g, pond.x, pond.y, pond.r * 1.08, pond.r * .64, mix(shore, '#fffbea', .3));
      ellipse(g, pond.x, pond.y, pond.r * 1.05, pond.r * .62, shore);
      ellipse(g, pond.x, pond.y, pond.r, pond.r * .58, p.waterDeep);
      ellipse(g, pond.x - pond.r * .06, pond.y - pond.r * .05, pond.r * .86, pond.r * .47, p.water);
      ellipse(g, pond.x - pond.r * .16, pond.y - pond.r * .12, pond.r * .5, pond.r * .24, mix(p.water, '#ffffff', .12));
    }
    // Pebbles, clover and crops: tiny pieces pasted flat.
    for (const d of this.bakedDecor.rect(ox - 20, oy - 20, ox + CHUNK + 20, oy + CHUNK + 20)) {
      if (d.kind === 'pebble') { const rx = 4.5 + d.seed * 3, ry = 2.8 + d.seed * 1.5; ellipse(g, d.x + 1.5, d.y + 2, rx, ry, mix(p.ground, INK, .3)); ellipse(g, d.x, d.y, rx, ry, shade(p.rock, .15)); ellipse(g, d.x - .8, d.y - 1, rx * .55, ry * .5, 'rgba(255,255,245,.45)'); }
      else if (d.kind === 'clover') { for (let i = 0; i < 3; i++) { const lx = d.x + Math.cos(i * 2.1) * 3.2, ly = d.y + Math.sin(i * 2.1) * 2.2; circle(g, lx + 1, ly + 1.5, 2.8, mix(p.ground, INK, .22)); circle(g, lx, ly, 2.8, p.foliage[2]); } if (d.seed > .7) circle(g, d.x, d.y - 4, 2, '#fff'); }
      else { g.strokeStyle = p.foliage[1]; g.lineWidth = 2.2; g.lineCap = 'round'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(d.x, d.y); g.quadraticCurveTo(d.x + i * 6, d.y - 8, d.x + i * 9, d.y - 12); g.stroke(); } circle(g, d.x + 1, d.y - 11, 3.4, mix(p.ground, INK, .2)); circle(g, d.x, d.y - 12, 3.2, d.seed > .5 ? '#e0a040' : d.color); }
    }
    this.chunks.set(`${cx},${cy}`, c);
    return c;
  }
  private bakePlace(g: CanvasRenderingContext2D, poi: Poi, p: Palette) {
    const { x, y, r } = poi, stone = shade(p.path, .06), gap = shade(p.pathEdge, -.05), rock = p.rock.startsWith('#') ? p.rock : '#8c8f80';
    if (poi.kind === 'city') {
      // A paved plaza inside a ring road, streets radiating from it.
      strip(g, [Array.from({ length: 41 }, (_, i) => ({ x: x + Math.cos(i / 40 * TAU) * r * .72, y: y + Math.sin(i / 40 * TAU) * r * .56 }))], p.path, p.ground, 50);
      paving(g, x, y, r * .5, r * .39, stone, gap, 24, x);
      for (let k = 1; k <= 2; k++) { g.strokeStyle = mix(gap, INK, .15); g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, r * .5 * k / 3, r * .39 * k / 3, 0, 0, TAU); g.stroke(); }
    } else if (poi.kind === 'gate') paving(g, x, y, 200, 150, shade(rock, .12), shade(rock, -.2), 30, x);
    else if (poi.kind === 'village' || poi.kind === 'start') paving(g, x, y, r * .42, r * .32, stone, gap, 20, x);
    else if (poi.kind === 'farm') {
      // A ploughed field: dark soil in ridged rows, fenced by the world.
      const soil = '#7a5a3a';
      rrect(g, x - 226, y - 4, 480, 240, 22, mix(soil, INK, .3));
      rrect(g, x - 232, y - 12, 482, 242, 24, mix(soil, '#fffbea', .3)); rrect(g, x - 230, y - 10, 480, 240, 22, soil);
      for (let row = 0; row < 6; row++) { rrect(g, x - 214, y + 10 + row * 36, 448, 14, 7, shade(soil, .14)); g.fillStyle = shade(soil, -.2); g.fillRect(x - 212, y + 22 + row * 36, 444, 3); }
    } else if (poi.kind === 'ruins' || poi.kind === 'shrine' || poi.kind === 'finale') {
      const rr = poi.kind === 'ruins' ? r * .6 : poi.kind === 'shrine' ? 190 : 360;
      paving(g, x, y, rr, rr * .75, shade(rock, .14), shade(rock, -.18), 34, x + y);
      // Weeds pushing up between old stones.
      for (let i = 0; i < 14; i++) { const a = i * 2.39996, d = Math.sqrt(i / 14) * rr * .9; circle(g, x + Math.cos(a) * d, y + Math.sin(a) * d * .75, 5 + (i % 3) * 2, p.foliage[1]); }
    } else if (poi.kind === 'lair') {
      const blobs: Blob[] = []; for (let i = 0; i < 26; i++) { const a = i * 2.39996, d = Math.sqrt(i / 26) * r * .78; blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d * .78, 60 + (i % 4) * 8]); }
      sheet(g, blobs, mix(p.ground, '#241830', .45), p.ground, 4, 5, 1.2);
    } else if (poi.kind === 'grove') {
      sheet(g, [[x, y, r * .5], [x - r * .3, y + r * .12, r * .34], [x + r * .32, y + r * .1, r * .32]], mix(p.foliage[2], p.ground, .45), p.ground);
      g.strokeStyle = mix(p.accent, '#ffffff', .2); g.lineWidth = 3; g.setLineDash([10, 9]); g.beginPath(); g.ellipse(x, y, 110, 80, 0, 0, TAU); g.stroke(); g.setLineDash([]);
    } else if (poi.kind === 'camp') sheet(g, [[x, y, 120], [x - 60, y + 20, 80], [x + 70, y + 10, 80]], mix(p.path, p.ground, .45), p.ground);
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
  /**
   * Grass and flowers are pasted onto tiles of their own, and each tile is cut again up to twelve times a second like
   * the puppets, every tile on its own beat: the whole valley still sways in the wind for a fraction of the drawing. The
   * tufts the hero is walking through are left out of the tile and drawn live, so they still bend away from their feet.
   */
  private drawDecor(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    if (this.decor === 'off') { this.ahead = null; return; }
    const t = this.time, hero = e.hero, res = this.chunkRes, keep = this.decor === 'less' ? .45 : 1, M = ctx.getTransform();
    const c0 = Math.floor((v.x - DECOR_MX) / DECOR_TILE), c1 = Math.floor((v.x + v.w + DECOR_MX) / DECOR_TILE);
    const r0 = Math.floor((v.y - DECOR_MB) / DECOR_TILE), r1 = Math.floor((v.y + v.h + DECOR_MT) / DECOR_TILE);
    // Re-cuts are spread over the frames by each tile's beat; a busy frame lets a few wait for the next one. Weaker
    // devices sway on a slower beat.
    let budget = 12;
    const rate = this.quality >= 1 ? 12 : this.quality >= .75 ? 8 : 6;
    for (let ty = r0; ty <= r1; ty++) for (let tx = c0; tx <= c1; tx++) {
      const tile = this.decorTile(e, tx, ty);
      if (tile.kept(keep) < 5) { for (const d of tile.items) if (d.seed <= keep) this.drawTuft(ctx, M, d, e, t); continue; }
      const beat = Math.floor(t * rate + tile.phase), fresh = tile.c && tile.res === res && tile.keep === keep;
      const near = hero.x > tx * DECOR_TILE - 120 && hero.x < (tx + 1) * DECOR_TILE + 120 && hero.y > ty * DECOR_TILE - 100 && hero.y < (ty + 1) * DECOR_TILE + 100;
      if (!fresh || (tile.beat !== beat && (near || budget-- > 0))) this.cutDecorTile(tile, tx, ty, (beat - tile.phase) / rate, beat, e, res, keep);
      ctx.drawImage(tile.c!, tx * DECOR_TILE - DECOR_MX, ty * DECOR_TILE - DECOR_MT, tile.c!.width / res, tile.c!.height / res);
      for (const d of tile.live) this.drawTuft(ctx, M, d, e, t);
    }
    ctx.setTransform(M);
    // Glowing mushrooms and shards light up the dark around them; a tiled one's glow is painted into its tile.
    for (let ty = r0; ty <= r1; ty++) for (let tx = c0; tx <= c1; tx++) {
      const tile = this.decorTile(e, tx, ty), tiled = tile.kept(keep) >= 5;
      for (const d of tile.glows) {
        if (d.seed > keep) continue;
        const a = shroomGlow(d, t); if (!tiled) glow(ctx, d.x, d.y - 6, 16, d.color, .3 * a); this.lights.push({ x: d.x, y: d.y - 6, r: 34, color: d.color, a });
      }
    }
    // The row and column of tiles the hero is walking toward are cut ahead in idle time, like the ground.
    this.ahead = { e, c0, c1, r0, r1, keep, res, rate }; this.queueRing();
    // Tiles are big canvases: only those in view and the ring around it are kept, and tiles that scrolled away give
    // their canvases back for new ones.
    const most = (c1 - c0 + 2) * (r1 - r0 + 2);
    while (this.decorTiles.size > most) { const [k, old] = this.decorTiles.entries().next().value!; this.decorTiles.delete(k); if (old.c && this.tilePool.length < 4) this.tilePool.push(old.c); }
  }
  /** How far a tuft leans at time `t`, from the wind and (when `hero` is given) the hero brushing past. */
  private swayOf(d: Decor, t: number, hero: Point | null) {
    let sway = Math.sin(t * 1.9 + d.x * .013 + d.y * .007) * .2 * this.wind + Math.sin(t * 4.3 + d.seed * 30) * .04;
    if (hero) { const dx = d.x - hero.x, dy = d.y - hero.y; if (Math.abs(dx) < 42 && Math.abs(dy) < 28) sway += Math.sign(dx || 1) * (1 - Math.abs(dx) / 42) * .9; }
    return -Math.sin(sway) * .9;
  }
  /** One tuft drawn live onto the page (whose world transform is `M`). Paper plants bend from the root: a shear. */
  private drawTuft(ctx: CanvasRenderingContext2D, M: DOMMatrix, d: Decor, e: GameEngine, t: number) {
    const sp = this.decorSpriteOf(d, e), k = this.swayOf(d, t, e.hero);
    ctx.setTransform(M.a, M.b, M.c + M.a * k, M.d, M.a * d.x + M.c * d.y + M.e, M.b * d.x + M.d * d.y + M.f);
    ctx.drawImage(sp.c, sp.l, sp.t, sp.w, sp.h);
  }
  private decorTiles = new Map<number, DecorTile>();
  private tilePool: HTMLCanvasElement[] = [];
  private decorTile(e: GameEngine, tx: number, ty: number): DecorTile {
    const key = tx * 65536 + ty;
    let tile = this.decorTiles.get(key);
    if (tile) { this.decorTiles.delete(key); this.decorTiles.set(key, tile); return tile; }
    const x0 = tx * DECOR_TILE, y0 = ty * DECOR_TILE;
    const items = this.liveDecor.rect(x0, y0, x0 + DECOR_TILE - .001, y0 + DECOR_TILE - .001).slice().sort((a, b) => a.y - b.y);
    const glows = items.filter(d => (d.kind === 'shroom' || d.kind === 'shard') && regionOf(e.world, d.x).darkness > 0);
    const counts = new Map<number, number>();
    tile = { items, glows, live: [], c: null, beat: -1, res: 0, keep: 0, phase: hash(tx * 7.13 + ty * 3.71), kept: k => { let n = counts.get(k); if (n === undefined) { n = items.filter(d => d.seed <= k).length; counts.set(k, n); } return n; } };
    this.decorTiles.set(key, tile);
    return tile;
  }
  /** Cuts a grass tile as it stands at time `t` (its beat `beat`). */
  private cutDecorTile(tile: DecorTile, tx: number, ty: number, t: number, beat: number, e: GameEngine, res: number, keep: number) {
    const W = Math.ceil((DECOR_TILE + DECOR_MX * 2) * res), H = Math.ceil((DECOR_TILE + DECOR_MT + DECOR_MB) * res);
    let c = tile.c;
    if (!c || c.width !== W || c.height !== H) { c = this.tilePool.pop() || document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } }
    const g = c.getContext('2d')!, ox = tx * DECOR_TILE - DECOR_MX, oy = ty * DECOR_TILE - DECOR_MT, hero = e.hero;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    tile.live = [];
    for (const d of tile.items) {
      if (d.seed > keep) continue;
      // Near the hero a tuft is drawn live instead, with room for how far they can walk before the next re-cut.
      if (Math.abs(d.x - hero.x) < 84 && Math.abs(d.y - hero.y) < 64) { tile.live.push(d); continue; }
      const sp = this.decorSpriteOf(d, e), k = this.swayOf(d, t, null);
      g.setTransform(res, 0, res * k, res, (d.x - ox) * res, (d.y - oy) * res);
      g.drawImage(sp.c, sp.l, sp.t, sp.w, sp.h);
    }
    g.setTransform(res, 0, 0, res, -ox * res, -oy * res);
    for (const d of tile.glows) if (d.seed <= keep) glow(g, d.x, d.y - 6, 16, d.color, .3 * shroomGlow(d, t));
    tile.c = c; tile.beat = beat; tile.res = res; tile.keep = keep;
  }
  /** Each tuft's baked piece, remembered on the tuft itself (reset when the ground resolution changes). */
  private decorMemo = new WeakMap<Decor, Sprite>();
  private decorSpriteOf(d: Decor, e: GameEngine) {
    let s = this.decorMemo.get(d);
    if (!s) { s = this.decorSprite(d, regionOf(e.world, d.x)); this.decorMemo.set(d, s); }
    return s;
  }
  private decorSprites = new Map<string, Sprite>();
  private decorSprite(d: Decor, reg: Region): Sprite {
    const variant = Math.floor(d.seed * 3), key = `${reg.id}|${d.kind}|${d.color}|${variant}|${this.chunkRes}`;
    let sp = this.decorSprites.get(key);
    if (!sp) {
      const [l, t, w, h] = DECOR_BOX[d.kind] || DECOR_BOX.grass;
      sp = this.cut.bake([l, t, w, h], this.chunkRes, SMALL, g => paintDecor(g, d, variant, reg.palette.foliage, reg.ground === 'snow', reg.ground === 'ash'));
      this.decorSprites.set(key, sp);
    }
    return sp;
  }
  private drawPlaceNames(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    const font = `700 24px ${DISPLAY}`;
    for (const z of e.world.pois) {
      if (Math.abs(z.x - (v.x + v.w / 2)) > v.w || Math.abs(z.y - (v.y + v.h / 2)) > v.h) continue;
      // Printed faintly on the ground: the name and its shadow are stamped from one piece, breathing in and out.
      const name = z.name.toUpperCase();
      const tw = this.textWidth(ctx, font, name);
      ctx.globalAlpha = .3 + Math.sin(this.time * 1.5 + z.x) * .05;
      this.badge(ctx, `pn|${name}`, z.x, z.y - z.r * .55, [-tw / 2 - 4, -26, tw + 10, 34], g => {
        g.font = font; g.textAlign = 'center';
        g.fillStyle = 'rgba(10,20,15,.67)'; g.fillText(name, 2, 2); g.fillStyle = 'rgb(255,250,225)'; g.fillText(name, 0, 0);
      });
      ctx.globalAlpha = 1;
    }
  }

  // ───────────────────────────── obstacles
  private spriteKey(o: Obstacle, reg: { id: string }) {
    return `${reg.id}|${o.kind}|${Math.round(o.r / 4) * 4}|${Math.floor(o.seed * 3)}|${o.color || ''}|${o.w || 0}`;
  }
  private sprite(o: Obstacle, e: GameEngine): Sprite {
    const memo = this.obstacleMemo.get(o); if (memo) return memo;
    const rq = Math.round(o.r / 4) * 4, variant = Math.floor(o.seed * 3), res = this.chunkRes, reg = regionOf(e.world, o.x);
    const key = this.spriteKey(o, reg);
    let s = this.sprites.get(key);
    if (!s) {
      const q: Obstacle = { ...o, x: 0, y: 0, r: rq || o.r, seed: (variant + .5) / 3 };
      const [l, t, r, b] = spriteBounds(q);
      s = this.cut.bake([l, t, r - l, b - t], res, SCENERY, g => paintProp(g, q, reg.palette, reg.ambient, reg.darkness > 0), g => propShadow(g, q));
      this.sprites.set(key, s);
    }
    this.obstacleMemo.set(o, s);
    return s;
  }
  /** Each obstacle's baked piece, remembered on the obstacle itself (reset when the resolution changes). */
  private obstacleMemo = new WeakMap<Obstacle, Sprite>();
  /** Bakes the houses and trees just beyond the view a few at a time, so walking (or a big, sharp screen) never waits on them. */
  private prefetchSprites(e: GameEngine, x0: number, y0: number, x1: number, y1: number) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, done = this.prefetched;
    if (done && Math.hypot(cx - done.x, cy - done.y) < 120) return;
    const t0 = performance.now();
    for (const o of e.obstacleGrid.rect(x0, y0, x1, y1)) {
      if (this.obstacleMemo.has(o)) continue;
      this.sprite(o, e);
      if (performance.now() - t0 > 2.5) { this.prefetched = null; return; }
    }
    this.prefetched = { x: cx, y: cy };
  }
  private drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, e: GameEngine) {
    const t = this.time, hero = e.hero, s = this.sprite(o, e), tall = TALL.has(o.kind);
    const sway = tall && !STILL.has(o.kind) ? (Math.sin(t * 1.15 + o.seed * 40) * .6 + Math.sin(t * 2.7 + o.seed * 13) * .25) * this.wind : 0;
    const behind = tall && hero.y < o.y && hero.y > o.y + s.t * .9 && Math.abs(hero.x - o.x) < s.w * .45;
    if (behind) ctx.globalAlpha = .5;
    // Trees lean from the root in the wind: a shear of the baked piece, set straight on the page's world transform.
    if (sway) { const M = this.worldM, k = sway * .035; ctx.setTransform(M.a, M.b, M.c + M.a * k, M.d, M.a * o.x + M.c * o.y + M.e, M.b * o.x + M.d * o.y + M.f); ctx.drawImage(s.c, s.l, s.t, s.w, s.h); ctx.setTransform(M); }
    else ctx.drawImage(s.c, o.x + s.l, o.y + s.t, s.w, s.h);
    if (behind) ctx.globalAlpha = 1;
    // Living parts on top of the cached sprite (most scenery has none).
    if (!LIVELY.has(o.kind)) return;
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
  // ───────────────────────────── objects
  /** Solid world objects are paper pieces with an ink edge; glowing pickups, clues and ground marks are drawn as they are. */
  private drawObject(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const box = OBJECT_BOX[o.kind];
    // Chests, signs and lore stones only glint and pulse slowly, so they are re-cut half as often as the rest.
    const calm = o.kind === 'chest' || o.kind === 'sign' || o.kind === 'lore';
    if (box) this.cutWorld(ctx, o, o.x, o.y, box, g => this.paintObject(g, o, e), SCENERY_LIVE, calm ? 6 : 12); else this.paintObject(ctx, o, e);
    const near = this.near; if (near?.kind === 'object' && near.o === o) this.label(ctx, o.x, o.y + 44, o.name, regionOf(e.world, o.x).palette.accent);
  }
  private paintObject(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
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
    else if (o.kind === 'site') this.drawSite(ctx, o, e);
    else if (o.kind === 'switch') this.drawSwitch(ctx, o, e);
    else if (o.kind === 'clue') this.drawClue(ctx, o, e);
    else if (o.kind === 'pen') this.drawPen(ctx, o);
    else if (o.kind === 'ward') this.drawWard(ctx, o, e);
    else if (o.kind === 'barrier') this.drawBarrier(ctx, o, e);
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
    const fig = villagerFigure(c.name, c.look);
    this.living(ctx, c, x, y - 16, FIGURE_BOX, STICKER, g => { drawFigure(g, fig, { facing: 'front', dir: 1, walk: 0, moving: false, t, arm: 'wave', seed: x * .01 }); });
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
    const t = this.time, x = o.x, y = o.y, lit = e.finaleShining(o.region), acc = regionOf(e.world, o.x).palette.accent, id = o.region;
    shadow(ctx, x + 6, y + 30, 50, 14, .3);
    if (id === 'meadow') {
      const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0); g.addColorStop(0, '#6f6450'); g.addColorStop(1, '#8b7f63');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 26, y + 30); ctx.lineTo(x - 18, y - 70); ctx.lineTo(x + 18, y - 70); ctx.lineTo(x + 26, y + 30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - 24 + i, y + 10 - i * 18); ctx.lineTo(x + 24 - i, y + 10 - i * 18); ctx.stroke(); }
      ctx.fillStyle = '#5a5140'; ctx.fillRect(x - 26, y - 82, 52, 14);
      // Dark, the Beacon is dead: cold ash in the bowl and a thin curl of smoke, no flame.
      if (lit) this.drawFlame(ctx, x, y - 84, 1.6, '#ffcf6e');
      else { ctx.fillStyle = '#3a3440'; ctx.beginPath(); ctx.ellipse(x, y - 84, 20, 5, 0, 0, TAU); ctx.fill(); if (Math.random() < .12) this.pushAmbient({ x: x + rand(-8, 8), y: y - 88, vx: rand(-8, 8), vy: rand(-34, -20), life: 2.4, max: 2.4, size: 5, rot: 0, vr: 0, kind: 'mote', color: 'rgba(110,100,130,.5)', phase: 0 }); }
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
    if (lit) this.lights.push({ x, y: y - 60, r: 520, color: acc, a: 1 }); else this.lights.push({ x, y: y - 60, r: 90, color: '#6a4bd6', a: .35 });
  }
  // ───────────────────────────── quest places
  /** Something to build: a staked-out plot with a ghostly plan and a growing pile of materials, then the finished thing. */
  private drawSite(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const x = o.x, y = o.y, t = this.time, built = e.siteBuilt(o), q = o.questId ? e.quest(o.questId) : undefined;
    if (built) { this.drawStructure(ctx, o.variant || 'tower', x, y, 1); return; }
    const have = q ? e.questProgress(q.id) : 0, need = q?.count || 1, ready = have >= need;
    shadow(ctx, x, y + 14, 60, 14, .18);
    ctx.strokeStyle = 'rgba(240,230,200,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.ellipse(x, y + 8, 58, 20, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (const [sx, sy] of [[-56, 6], [56, 6], [0, -12], [0, 28]]) { rect(ctx, x + sx - 2, y + sy - 16, 4, 18, '#8a6a48'); }
    // The plan, glowing faintly where it will stand.
    ctx.save(); ctx.globalAlpha = .22 + Math.sin(t * 2.4) * .08 + (ready ? .15 : 0); this.drawStructure(ctx, o.variant || 'tower', x, y, 0); ctx.restore();
    for (let i = 0; i < Math.min(need, have); i++) { const px = x - 44 + (i % 3) * 16, py = y + 22 - Math.floor(i / 3) * 7; rect(ctx, px, py, 26, 6, i % 2 ? '#a8744a' : '#8a5a34'); rect(ctx, px, py, 26, 2, '#c9a06a'); }
    if (ready) { glow(ctx, x, y - 10, 70, '#ffd35c', .35 + Math.sin(t * 4) * .15); this.lights.push({ x, y: y - 10, r: 120, color: '#ffd35c', a: .7 }); }
  }
  /** The finished (a = 1) or planned (a = 0, drawn as a ghost) shape of a build site. */
  private drawStructure(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, a: number) {
    const wood = a ? '#8a5a34' : '#e8f4ff', dark = a ? '#6f4a2a' : '#c9d8e8', stone = a ? '#8c8f80' : '#e8f4ff', t = this.time;
    if (a) shadow(ctx, x, y + 14, 50, 12, .28);
    switch (kind) {
      case 'tower':
        for (const sx of [-30, 26]) rect(ctx, x + sx, y - 110, 6, 124, wood);
        ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 28, y); ctx.lineTo(x + 28, y - 90); ctx.moveTo(x + 28, y); ctx.lineTo(x - 28, y - 90); ctx.stroke();
        rect(ctx, x - 40, y - 116, 82, 10, dark);
        ctx.fillStyle = a ? '#b85a44' : '#e8f4ff'; ctx.beginPath(); ctx.moveTo(x - 46, y - 116); ctx.lineTo(x, y - 160); ctx.lineTo(x + 48, y - 116); ctx.closePath(); ctx.fill();
        if (a) { const fl = .8 + Math.sin(t * 9) * .2; glow(ctx, x, y - 128, 34, '#ffcf6e', .7 * fl); this.lights.push({ x, y: y - 128, r: 200, color: '#ffcf6e', a: .8 }); }
        break;
      case 'barricade':
        for (let i = -3; i <= 3; i++) { const sx = x + i * 16; ctx.fillStyle = i % 2 ? wood : dark; ctx.beginPath(); ctx.moveTo(sx - 6, y + 10); ctx.lineTo(sx - 6, y - 34 - Math.abs(i) * 2); ctx.lineTo(sx, y - 46 - Math.abs(i) * 2); ctx.lineTo(sx + 6, y - 34 - Math.abs(i) * 2); ctx.lineTo(sx + 6, y + 10); ctx.fill(); }
        rect(ctx, x - 56, y - 18, 112, 6, dark);
        break;
      case 'well':
        ellipse(ctx, x, y, 34, 14, stone); ellipse(ctx, x, y - 4, 26, 9, a ? '#2a3a44' : 'rgba(255,255,255,.4)');
        for (const sx of [-28, 24]) rect(ctx, x + sx, y - 60, 5, 60, wood);
        ctx.fillStyle = a ? '#a8644e' : '#e8f4ff'; ctx.beginPath(); ctx.moveTo(x - 38, y - 58); ctx.lineTo(x, y - 84); ctx.lineTo(x + 38, y - 58); ctx.closePath(); ctx.fill();
        break;
      case 'lantern':
        rect(ctx, x - 3, y - 92, 6, 100, a ? '#4a4a58' : wood);
        ctx.fillStyle = a ? '#5a5a6a' : wood; ctx.beginPath(); ctx.moveTo(x - 16, y - 92); ctx.lineTo(x, y - 110); ctx.lineTo(x + 16, y - 92); ctx.fill();
        ctx.fillStyle = a ? 'rgba(255,250,220,.95)' : 'rgba(255,255,255,.5)'; ctx.fillRect(x - 11, y - 90, 22, 26);
        if (a) { ctx.fillStyle = '#c9b6ff'; star(ctx, x, y - 77, 8, 5, .45, t); ctx.fill(); glow(ctx, x, y - 77, 90, '#c9b6ff', .8); this.lights.push({ x, y: y - 77, r: 260, color: '#c9b6ff', a: 1 }); }
        break;
      case 'bellows':
        ctx.fillStyle = a ? '#7a4a2a' : wood; ctx.beginPath(); ctx.moveTo(x - 50, y - 6); ctx.lineTo(x + 30, y - 30 + (a ? Math.sin(t * 3) * 8 : 0)); ctx.lineTo(x + 30, y + 14); ctx.closePath(); ctx.fill();
        rect(ctx, x + 28, y - 10, 34, 10, a ? '#c9a24c' : stone); for (let i = 0; i < 3; i++) circle(ctx, x - 20 + i * 18, y - 4 - i * 6, 4, a ? '#c9a24c' : stone);
        if (a && Math.random() < .3) this.pushAmbient({ x: x + 62, y: y - 6, vx: rand(30, 60), vy: rand(-30, -10), life: .8, max: .8, size: 2.4, rot: 0, vr: 0, kind: 'mote', color: '#ffb347', phase: 0 });
        break;
      default: // bridge site: a stack of lumber and a trestle
        rect(ctx, x - 40, y - 10, 80, 8, wood); rect(ctx, x - 34, y - 2, 6, 14, dark); rect(ctx, x + 28, y - 2, 6, 14, dark);
    }
  }
  /** Braziers, lanterns, runes, totems and vents that a quest lights one by one. */
  private drawSwitch(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const x = o.x, y = o.y, t = this.time, lit = e.switchLit(o), v = o.variant || 'brazier', reg = regionOf(e.world, x), rock = reg.palette.rock;
    shadow(ctx, x, y + 10, 22, 7, .28);
    switch (v) {
      case 'lantern':
        rect(ctx, x - 3, y - 66, 6, 72, '#4a4a58'); rect(ctx, x - 12, y - 70, 24, 4, '#3a3a48');
        ctx.fillStyle = lit ? 'rgba(255,245,200,.95)' : 'rgba(60,60,72,.8)'; ctx.fillRect(x - 9, y - 66, 18, 20);
        if (lit) { glow(ctx, x, y - 56, 60, '#ffe38a', .9); this.lights.push({ x, y: y - 56, r: 200, color: '#ffe38a', a: 1 }); }
        break;
      case 'rune': case 'totem': {
        const c = v === 'rune' ? '#9fe8ff' : '#b9f29d';
        ctx.fillStyle = v === 'rune' ? rock : '#6f5337'; ctx.beginPath(); ctx.moveTo(x - 14, y + 8); ctx.lineTo(x - 12, y - 46); ctx.quadraticCurveTo(x, y - 60, x + 12, y - 46); ctx.lineTo(x + 14, y + 8); ctx.closePath(); ctx.fill();
        if (v === 'totem') { circle(ctx, x - 5, y - 38, 3, lit ? c : '#3a2a1a'); circle(ctx, x + 5, y - 38, 3, lit ? c : '#3a2a1a'); rect(ctx, x - 16, y - 26, 32, 5, '#8a6a48'); }
        ctx.strokeStyle = lit ? c : 'rgba(0,0,0,.35)'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(x - 6, y - 30); ctx.lineTo(x, y - 18); ctx.lineTo(x + 6, y - 30); ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 4); ctx.stroke();
        if (lit) { glow(ctx, x, y - 24, 50, c, .8); this.lights.push({ x, y: y - 24, r: 160, color: c, a: .9 }); }
        break;
      }
      case 'vent':
        ellipse(ctx, x, y, 26, 11, '#3a2a26'); ellipse(ctx, x, y - 2, 18, 7, lit ? '#bfe8ff' : '#ff7a3d');
        if (lit) { ctx.fillStyle = 'rgba(223,246,255,.85)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 14 + i * 9, y - 2); ctx.lineTo(x - 11 + i * 9, y - 22 - (i % 2) * 8); ctx.lineTo(x - 8 + i * 9, y - 2); ctx.fill(); } this.lights.push({ x, y, r: 90, color: '#bfe8ff', a: .6 }); }
        else { glow(ctx, x, y - 6, 40, '#ff7a3d', .6 + Math.sin(t * 5 + x) * .2); if (Math.random() < .2) this.pushAmbient({ x: x + rand(-10, 10), y: y - 6, vx: 0, vy: rand(-60, -30), life: .8, max: .8, size: 2, rot: 0, vr: 0, kind: 'mote', color: '#ffb347', phase: 0 }); this.lights.push({ x, y, r: 120, color: '#ff7a3d', a: .8 }); }
        break;
      default: // brazier
        ctx.fillStyle = shade(rock, -.15); ctx.beginPath(); ctx.moveTo(x - 8, y + 8); ctx.lineTo(x - 5, y - 20); ctx.lineTo(x + 5, y - 20); ctx.lineTo(x + 8, y + 8); ctx.fill();
        ellipse(ctx, x, y - 22, 18, 7, rock); ellipse(ctx, x, y - 24, 14, 4, '#2a2220');
        if (lit) { this.drawFlame(ctx, x, y - 24, .9, '#ffb347'); this.lights.push({ x, y: y - 40, r: 220, color: '#ffb347', a: 1 }); }
        else if (Math.random() < .03) this.pushAmbient({ x, y: y - 26, vx: 0, vy: -20, life: 1, max: 1, size: 5, rot: 0, vr: 0, kind: 'smoke', color: 'rgba(120,120,130,.4)', phase: 0 });
    }
    // The switch's name stays readable on phones too: an ordered puzzle depends on it.
    if (!lit) { ctx.font = `800 11px ${UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(14,20,30,.7)'; const w = ctx.measureText(o.name).width + 12; ctx.beginPath(); ctx.roundRect(x - w / 2, y + 16, w, 17, 8); ctx.fill(); ctx.fillStyle = '#fff1d0'; ctx.fillText(o.name, x, y + 28); }
  }
  /** Glowing footprints from the last clue to the next, and a sparkle where the clue is. */
  private drawClue(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const t = this.time, q = o.questId ? e.quest(o.questId) : undefined; if (!q) return;
    const prev = (o.step || 0) > 0 ? e.world.objects.find(c => c.kind === 'clue' && c.questId === q.id && c.step === (o.step || 0) - 1) : e.world.pois.find(p => p.id === q.near);
    const from = prev || o, dx = o.x - from.x, dy = o.y - from.y, len = Math.hypot(dx, dy), ux = dx / Math.max(1, len), uy = dy / Math.max(1, len), a = Math.atan2(dy, dx);
    const start = Math.max(0, len - 1100);
    for (let s = start, i = 0; s < len - 30; s += 44, i++) {
      const side = i % 2 ? 1 : -1, px = from.x + ux * s - uy * side * 8, py = from.y + uy * s + ux * side * 8;
      const pulse = .35 + .45 * Math.max(0, Math.sin(t * 3 - s * .012));
      ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.globalAlpha = pulse * Math.min(1, (s - start) / 200 + .2);
      ellipse(ctx, 0, 0, 6, 3.4, '#fff1b8'); ellipse(ctx, 6, 0, 2.6, 2.4, '#fff1b8'); ctx.restore();
    }
    const bob = Math.sin(t * 3) * 3;
    glow(ctx, o.x, o.y - 6 + bob, 46, '#fff1b8', .6); ctx.strokeStyle = `rgba(255,241,184,${.6 + Math.sin(t * 4) * .3})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(o.x, o.y + 6, 26 + Math.sin(t * 3) * 4, 10, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fffbe8'; star(ctx, o.x, o.y - 14 + bob, 8, 4, .35, t); ctx.fill();
    this.lights.push({ x: o.x, y: o.y, r: 110, color: '#fff1b8', a: .8 });
  }
  /** A round sheep pen with a gap to drive the animals through. */
  private drawPen(ctx: CanvasRenderingContext2D, o: WorldObject) {
    const x = o.x, y = o.y;
    ellipse(ctx, x, y, 92, 50, 'rgba(160,130,70,.28)');
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU; if (a > 1.2 && a < 1.95) continue; // the gate faces the viewer
      const px = x + Math.cos(a) * 96, py = y + Math.sin(a) * 54;
      rect(ctx, px - 2.5, py - 26, 5, 28, '#8a6a48');
      const b = (i + 1) / 18 * TAU; if (b > 1.2 && b < 1.95) continue;
      ctx.strokeStyle = '#a8844a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, py - 20); ctx.lineTo(x + Math.cos(b) * 96, y + Math.sin(b) * 54 - 20); ctx.moveTo(px, py - 8); ctx.lineTo(x + Math.cos(b) * 96, y + Math.sin(b) * 54 - 8); ctx.stroke();
    }
    ellipse(ctx, x - 30, y - 6, 16, 8, '#d9b45a'); ellipse(ctx, x + 36, y + 10, 14, 7, '#c9a44c');
  }
  /** What a siege attacks: a palisade that cracks as it takes hits, with its health over it while the fight lasts. */
  private drawWard(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const s = e.siege, mine = s?.ward === o, hp = mine ? s!.hp / 100 : 1, x = o.x + (mine && Math.random() < .1 ? rand(-2, 2) : 0), y = o.y;
    this.drawStructure(ctx, 'barricade', x, y, 1);
    if (hp < .66) { ctx.strokeStyle = 'rgba(30,20,10,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 20, y - 30); ctx.lineTo(x - 10, y - 14); ctx.lineTo(x - 18, y); ctx.moveTo(x + 22, y - 36); ctx.lineTo(x + 12, y - 20); ctx.stroke(); }
    if (mine) {
      const w = 100, by = y - 72;
      ctx.fillStyle = 'rgba(14,20,30,.8)'; ctx.beginPath(); ctx.roundRect(x - w / 2 - 3, by - 3, w + 6, 12, 6); ctx.fill();
      ctx.fillStyle = hp > .5 ? '#7fd46b' : hp > .25 ? '#ffd35c' : '#ff6b5b'; ctx.beginPath(); ctx.roundRect(x - w / 2, by, w * Math.max(0, hp), 6, 3); ctx.fill();
      glow(ctx, x, y - 20, 90, '#ffd35c', .2);
    }
  }
  /** The crossing between two lands: a chasm with a broken bridge, a wall of thorns or a seal of black ice. */
  private drawBarrier(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const x = o.x, y = o.y, t = this.time, open = e.barrierOpen(o), v = o.variant || 'bridge', H = 215;
    if (v === 'bridge') {
      // The gorge, with a river far below.
      ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.moveTo(x - 58, y - H); for (let i = 0; i <= 10; i++) ctx.lineTo(x - 58 + Math.sin(i * 1.7) * 8, y - H + i * H * .2); ctx.lineTo(x + 58, y + H); for (let i = 10; i >= 0; i--) ctx.lineTo(x + 58 + Math.cos(i * 1.3) * 8, y - H + i * H * .2); ctx.closePath(); ctx.fill();
      const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0); g.addColorStop(0, '#1e3a44'); g.addColorStop(.5, '#3d7f8f'); g.addColorStop(1, '#1e3a44');
      ctx.fillStyle = g; ctx.fillRect(x - 22, y - H, 44, H * 2);
      ctx.fillStyle = 'rgba(230,250,255,.35)'; for (let i = 0; i < 8; i++) { const yy = y - H + ((t * 60 + i * 55) % (H * 2)); ctx.fillRect(x - 8 + Math.sin(i) * 6, yy, 3, 18); }
      ctx.strokeStyle = 'rgba(120,110,90,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 58, y - H); ctx.lineTo(x - 58, y + H); ctx.moveTo(x + 58, y - H); ctx.lineTo(x + 58, y + H); ctx.stroke();
      if (open) {
        shadow(ctx, x, y + 44, 80, 10, .3);
        for (let i = 0; i < 9; i++) { const px = x - 72 + i * 18; rect(ctx, px, y - 38, 16, 76, i % 2 ? '#a8744a' : '#8a5a34'); rect(ctx, px, y - 38, 16, 3, '#c9a06a'); }
        for (const sy of [-40, 38]) { ctx.strokeStyle = '#6f5337'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 76, y + sy - 22); ctx.quadraticCurveTo(x, y + sy - 8, x + 76, y + sy - 22); ctx.stroke(); for (const px of [-76, 76]) rect(ctx, x + px - 4, y + sy - 30, 8, 30, '#6f5337'); }
      } else {
        for (const side of [-1, 1]) { for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(x + side * 56, y - 30 + i * 22); ctx.rotate(side * (.9 + i * .15)); rect(ctx, -4, 0, 8, 34 - i * 6, i % 2 ? '#8a5a34' : '#6f4a2a'); ctx.restore(); } rect(ctx, x + side * 70 - 5, y - 46, 10, 34, '#6f5337'); }
      }
    } else if (v === 'thorns') {
      if (open) { for (let i = 0; i < 12; i++) { const yy = y - H + i * 38; ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 50 + (i % 2) * 90, yy); ctx.lineTo(x - 40 + (i % 2) * 90, yy - 14); ctx.stroke(); } return; }
      glow(ctx, x, y, 200, '#6a4bd6', .25 + Math.sin(t * 2) * .08);
      for (let i = 0; i < 26; i++) {
        const yy = y - H + (i / 25) * H * 2, sw = Math.sin(t * 1.4 + i) * 4;
        ctx.strokeStyle = i % 3 ? '#2e2438' : '#3d2c1f'; ctx.lineWidth = 9 - (i % 3) * 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 70, yy + sw); ctx.bezierCurveTo(x - 20, yy - 40 + sw, x + 20, yy + 40 - sw, x + 70, yy - sw); ctx.stroke();
        ctx.fillStyle = '#1e1628'; for (let k = 0; k < 4; k++) { const px = x - 50 + k * 34, py = yy + Math.sin(k + i) * 16; ctx.beginPath(); ctx.moveTo(px, py - 4); ctx.lineTo(px + 4, py - 14); ctx.lineTo(px + 7, py - 3); ctx.fill(); }
      }
      if (Math.random() < .08) this.pushAmbient({ x: x + rand(-60, 60), y: y + rand(-H, H), vx: 0, vy: -12, life: 1.4, max: 1.4, size: 2, rot: 0, vr: 0, kind: 'mote', color: '#c9b6ff', phase: 0 });
    } else {
      if (open) { for (let i = 0; i < 14; i++) { const px = x + Math.sin(i * 3.1) * 70, py = y - H + i * 32; ctx.fillStyle = 'rgba(120,150,210,.7)'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 10, py - 16); ctx.lineTo(px + 18, py + 2); ctx.fill(); } return; }
      const g = ctx.createLinearGradient(x - 50, 0, x + 50, 0); g.addColorStop(0, 'rgba(40,50,110,.92)'); g.addColorStop(.5, 'rgba(90,110,190,.85)'); g.addColorStop(1, 'rgba(30,40,90,.92)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 48, y + H); for (let i = 0; i <= 12; i++) ctx.lineTo(x - 48 + Math.sin(i * 2.3) * 10, y + H - i * H * 2 / 12); ctx.lineTo(x + 48, y - H); for (let i = 12; i >= 0; i--) ctx.lineTo(x + 48 + Math.cos(i * 1.9) * 10, y + H - i * H * 2 / 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(201,182,255,${.5 + Math.sin(t * 2) * .2})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const yy = y - H + 40 + i * 64; ctx.moveTo(x - 30, yy); ctx.lineTo(x - 4, yy + 20); ctx.lineTo(x + 24, yy + 6); } ctx.stroke();
      glow(ctx, x, y, 180, '#6a7fd6', .3); this.lights.push({ x, y, r: 260, color: '#8ea0ff', a: .6 });
    }
  }
  private drawMeteors(ctx: CanvasRenderingContext2D, e: GameEngine) {
    for (const m of e.meteors) {
      const f = Math.min(1, m.t / m.dur), x = m.x0 + (m.x1 - m.x0) * f, y = m.y0 + (m.y1 - m.y0) * f, a = Math.atan2(m.y1 - m.y0, m.x1 - m.x0);
      const tail = m.dark ? 320 : 420, tx = x - Math.cos(a) * tail, ty = y - Math.sin(a) * tail;
      const g = ctx.createLinearGradient(tx, ty, x, y); g.addColorStop(0, m.dark ? 'rgba(26,16,48,0)' : 'rgba(255,241,184,0)'); g.addColorStop(1, m.dark ? 'rgba(58,42,106,.9)' : 'rgba(255,250,230,.95)');
      ctx.strokeStyle = g; ctx.lineWidth = m.dark ? 22 : 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      glow(ctx, x, y, m.dark ? 70 : 120, m.dark ? '#6a4bd6' : '#fff1b8', 1); if (!m.dark) circle(ctx, x, y, 10, '#ffffff');
      this.lights.push({ x, y, r: m.dark ? 200 : 420, color: m.dark ? '#6a4bd6' : '#fff1b8', a: 1 });
    }
  }
  private drawFires(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    for (const f of e.fires) {
      if (f.x < v.x - 100 || f.x > v.x + v.w + 100 || f.y < v.y - 100 || f.y > v.y + v.h + 200) continue;
      const k = Math.min(1, f.t / 2);
      this.drawFlame(ctx, f.x - 14, f.y, 1.1 * k, '#ff9a4a'); this.drawFlame(ctx, f.x + 16, f.y + 6, .8 * k, '#ff7a3d');
      this.lights.push({ x: f.x, y: f.y, r: 260 * k, color: '#ff9a4a', a: 1 });
    }
  }
  /** A wolf walking with the hero, or one in a cutscene: drawn like Fenn (a pale spirit when `spirit`). */
  private drawBeast(ctx: CanvasRenderingContext2D, n: Npc, e: GameEngine) {
    this.drawPet(ctx, { x: n.x, y: n.y, face: n.faceX, target: null, cd: 0, bite: 0, leapT: 0, walk: n.walkT, spirit: !!n.spirit, life: 99, moving: n.moving }, e, n);
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
  /** Mana pods rock gently on their leaves: twelve rocking frames per land, cut once and shared by every pod there. */
  private drawPod(ctx: CanvasRenderingContext2D, x: number, y: number, e: GameEngine) {
    const reg = regionOf(e.world, x), c = reg.palette.pod, f = Math.floor(((((this.time * 2.4 + x) / TAU) % 1) + 1) % 1 * 12);
    this.still(ctx, `pod|${reg.id}|${f}`, x, y, [-30, -40, 60, 64], STICKER, g => this.paintPod(g, reg.palette, (f + .5) / 12 * TAU));
    glow(ctx, x, y - 5, 30, c, .35 * (.6 + Math.sin(this.time * 3 + y) * .4));
    this.lights.push({ x, y: y - 5, r: 60, color: c, a: .6 });
  }
  /** One pod around its anchor, `a` along its rocking. */
  private paintPod(ctx: CanvasRenderingContext2D, pal: Palette, a: number) {
    const c = pal.pod, wob = Math.sin(a) * .08, pulse = .6 + Math.sin(a + 1.2) * .4;
    shadow(ctx, 0, 14, 18, 6);
    for (let i = -1; i <= 1; i++) ellipse(ctx, i * 12, 10, 10, 4, pal.foliage[1], i * .6);
    ctx.save(); ctx.translate(0, 10); ctx.rotate(wob);
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -15, 14, 17, 0, 0, TAU); ctx.fill();
    ellipse(ctx, -4, -21, 5, 7, 'rgba(255,255,255,.55)');
    ctx.strokeStyle = alpha(c, .5 + pulse * .5); ctx.lineWidth = 1.5;
    for (const s of [-.5, 0, .5]) { ctx.beginPath(); ctx.ellipse(0, -15, 14 * Math.abs(Math.cos(s + 1.57)) + 2, 16, 0, -1.3, 1.3); ctx.stroke(); }
    ctx.fillStyle = pal.foliage[1]; ctx.beginPath(); ctx.moveTo(-5, -31); ctx.quadraticCurveTo(0, -38, 6, -34); ctx.lineTo(0, -30); ctx.fill();
    ctx.restore();
  }

  // ───────────────────────────── villagers
  private drawNpc(ctx: CanvasRenderingContext2D, n: Npc, e: GameEngine) {
    const t = this.time, L = n.look, act = n.activity, h = e.hero;
    if (n.beast) { this.drawBeast(ctx, n, e); this.drawQuestPersonMark(ctx, n, 46); return; }
    const a0 = ctx.globalAlpha; if (n.spirit) ctx.globalAlpha = a0 * .55;
    const x = n.x, y = n.y, fig = this.figureOf(n), s = L.small ? .78 : 1;
    // Walking: side-on in the way they go, or toward/away from us. Standing: facing us, or turned to the hero nearby.
    let facing: Facing = 'front', dir: 1 | -1 = n.faceX < 0 ? -1 : 1;
    if (n.moving) { const f = facingOf(n.tx - n.x, (n.ty - n.y) * 1.3); facing = f.facing; dir = f.dir; }
    else if (Math.abs(h.x - x) + Math.abs(h.y - y) < 150) { facing = h.y > y + 40 && Math.abs(h.x - x) < 50 ? 'front' : 'side'; dir = h.x > x ? 1 : -1; }
    else if (act === 'chop' || act === 'hammer' || act === 'farm' || act === 'fish' || act === 'sweep') facing = 'side';
    const period = act === 'chop' ? 1.2 : act === 'hammer' ? .7 : 1.6;
    const arm: ArmAction = act === 'chop' || act === 'hammer' || act === 'farm' ? 'work' : act === 'sweep' ? 'sweep' : act === 'fish' ? 'fish' : act === 'patrol' ? 'hold' : 'idle';
    // Villagers are many, so each pose is cut once and reused: the walk in eight steps, a tool's swing in eight, a
    // broom or rod in eight beats of a two-second loop. Standing still they only breathe (a small bob of the whole piece).
    const walkQ = n.moving ? Math.floor((((n.walkT * 2.2) % TAU) + TAU) % TAU / TAU * 8) : -1;
    const kq = arm === 'work' ? Math.floor(((n.workT / period) % 1) * 8) : 0, tq = arm === 'sweep' || arm === 'fish' ? Math.floor(t * 4) % 8 : 0;
    const walk = walkQ < 0 ? 0 : (walkQ + .5) / 8 * TAU, tPose = walkQ >= 0 ? walk / 2 : tq ? tq / 4 : 1.3;
    const pose: Pose = { facing, dir, walk, moving: n.moving, t: tPose, arm, k: kq / 8, blink: false };
    shadow(ctx, x, y + 22 * s, 17 * s, 6 * s, .26);
    const key = `${n.id}|${facing}|${dir}|${walkQ}|${arm}|${kq}|${tq}|${this.px}`;
    let hit = this.people.get(key);
    if (hit) { this.people.delete(key); this.people.set(key, hit); }
    else {
      let jj: Joints | null = null;
      const b = this.cut.bake(FIGURE_BOX, this.px, STICKER, g => { jj = drawFigure(g, fig, pose, toolHooks(act)); });
      hit = { b, j: jj }; this.people.set(key, hit);
      while (this.people.size > 240) this.people.delete(this.people.keys().next().value!);
    }
    const breathe = n.moving ? 0 : Math.sin(t * 2.2 + n.homeX * .01) * .7;
    ctx.drawImage(hit.b.c, x + hit.b.l, y + breathe + hit.b.t, hit.b.w, hit.b.h);
    const j = hit.j;
    // A fishing line down to a bobbing float.
    if (act === 'fish' && j) { const rx = x + (j.handF.x + Math.cos(j.angF - Math.PI / 2) * 34 * dir), ry = y + j.handF.y - 30; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx + dir * 12, ry + 20, rx + dir * 16, y + 26 + Math.sin(t * 2) * 2); ctx.stroke(); circle(ctx, rx + dir * 16, y + 27 + Math.sin(t * 2) * 2, 3, '#e0525c'); }
    ctx.globalAlpha = a0;
    // Lanterns in the dark.
    const reg = regionOf(e.world, x), dark = reg.darkness > 0;
    if (dark && (n.role === 'guide' || act === 'patrol' || act === 'travel')) { const lx = x - dir * 17, ly = y + 2; glow(ctx, lx, ly, 26, '#ffcf6e', .8); this.paperDot(ctx, lx, ly, 4, '#ffe38a'); this.lights.push({ x: lx, y: ly, r: 150, color: '#ffcf6e', a: .9 }); }
    else if (dark) this.lights.push({ x, y, r: 90, a: .6 });
    const mark = e.npcMarker(n), top = y - 70 * s;
    if (mark) this.questTag(ctx, x, top + Math.abs(Math.sin(t * 3.4)) * -7, mark.mark, mark.main ? MAIN_COLOR : SIDE_COLOR);
    else if (n.role === 'merchant' || n.role === 'smith' || n.role === 'armorer' || n.role === 'inn') this.shopTag(ctx, x, top, n.role === 'merchant' ? '⚗' : n.role === 'smith' ? '⚒' : n.role === 'armorer' ? '⛨' : '☾');
    this.drawQuestPersonMark(ctx, n, 72 * s);
    const near = this.near; if (near?.kind === 'npc' && near.n === n) this.label(ctx, x, y + 46, n.name, reg.palette.accent);
  }
  /** Each villager's puppet, remembered on the villager (their look can change with the story). */
  private figures = new WeakMap<Npc, { look: Npc['look']; fig: ReturnType<typeof villagerFigure> }>();
  private figureOf(n: Npc) {
    let f = this.figures.get(n);
    if (!f || f.look !== n.look) { f = { look: n.look, fig: villagerFigure(n.id, n.look) }; this.figures.set(n, f); }
    return f.fig;
  }
  /** A quest mark: a paper badge with an ink rim, gold for the story, blue for side quests. */
  private questTag(ctx: CanvasRenderingContext2D, x: number, y: number, mark: string, color: string) {
    glow(ctx, x, y, 30, color, .6);
    this.badge(ctx, `q|${mark}|${color}`, x, y, [-16, -16, 34, 38], g => {
      g.beginPath(); g.moveTo(-6, 11); g.lineTo(0, 19); g.lineTo(6, 11); g.closePath(); g.fillStyle = INK; g.fill();
      circle(g, 1.5, 2.5, 14, 'rgba(47,35,48,.3)');
      circle(g, 0, 0, 14, INK); circle(g, 0, 0, 12.2, PAPER); circle(g, 0, 0, 10, color);
      g.fillStyle = INK; g.font = `900 16px ${UI}`; g.textAlign = 'center'; g.fillText(mark, 0, 6);
    });
  }
  /** A shop's sign over its keeper: a little wooden board with the trade's mark. */
  private shopTag(ctx: CanvasRenderingContext2D, x: number, y: number, icon: string) {
    this.badge(ctx, `s|${icon}`, x, y, [-16, -14, 34, 30], g => {
      g.fillStyle = 'rgba(47,35,48,.28)'; g.beginPath(); g.roundRect(-13, -11, 30, 26, 6); g.fill();
      g.fillStyle = INK; g.beginPath(); g.roundRect(-15, -13, 30, 26, 7); g.fill();
      g.fillStyle = '#b98a52'; g.beginPath(); g.roundRect(-13, -11, 26, 22, 5); g.fill();
      g.fillStyle = PAPER; g.font = `900 15px ${UI}`; g.textAlign = 'center'; g.fillText(icon, 0, 5);
    });
  }
  /** Small flat pieces drawn many times a frame (quest badges, shop signs, place names): painted once at this
   *  resolution into a canvas of their own, and stamped from there. */
  private badges = new Map<string, Sprite>();
  /** How wide `text` is in `font`, measured once (after the fonts have loaded). Leaves `ctx.font` as it found it. */
  private widths = new Map<string, number>();
  private textWidth(ctx: CanvasRenderingContext2D, font: string, text: string) {
    const k = `${font}|${text}`; let w = this.widths.get(k);
    if (w === undefined) { const was = ctx.font; ctx.font = font; w = ctx.measureText(text).width; ctx.font = was; if (fontsReady()) { this.widths.set(k, w); if (this.widths.size > 600) this.widths.delete(this.widths.keys().next().value!); } }
    return w;
  }
  private badge(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, box: Box, paint: (g: CanvasRenderingContext2D) => void) {
    const res = Math.min(3, this.px), k = `${key}|${res}`;
    let s = this.badges.get(k);
    if (!s) {
      // Text measured from a font that hasn't loaded yet would be baked wrong for good, so wait for the fonts.
      if (!fontsReady()) { ctx.save(); ctx.translate(x, y); paint(ctx); ctx.restore(); return; }
      const [l, t, w, h] = box, c = document.createElement('canvas'); c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
      const g = c.getContext('2d')!; g.setTransform(res, 0, 0, res, -l * res, -t * res); paint(g);
      s = { c, l, t, w: c.width / res, h: c.height / res }; this.badges.set(k, s);
      while (this.badges.size > 120) this.badges.delete(this.badges.keys().next().value!);
    }
    ctx.drawImage(s.c, x + s.l, y + s.t, s.w, s.h);
  }
  private paperDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) { circle(ctx, x, y, r + 1.2, INK); circle(ctx, x, y, r, color); }
  /** Someone walking with the hero wears a green ring (red while scared); a thief a red one. */
  private drawQuestPersonMark(ctx: CanvasRenderingContext2D, n: Npc, lift: number) {
    if (n.role !== 'follower' && n.role !== 'thief') return;
    const t = this.time, c = n.role === 'thief' || n.scared ? '#ff6b5b' : '#7fd46b';
    ctx.strokeStyle = alpha(c, .8); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(n.x, n.y + 20, 24, 8, 0, 0, TAU); ctx.stroke();
    const my = n.y - lift - 6 + Math.sin(t * 4) * 3;
    ctx.fillStyle = 'rgba(14,20,30,.8)'; ctx.beginPath(); ctx.arc(n.x, my, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = c; ctx.font = `900 13px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(n.role === 'thief' ? '✋' : n.scared ? '!' : '♥', n.x, my + 5);
  }
  private drawBubbles(ctx: CanvasRenderingContext2D, e: GameEngine, v: View) {
    ctx.font = BUBBLE_FONT; ctx.textAlign = 'center';
    for (const n of e.npcs) {
      if (n.barkT <= 0 || n.x < v.x - 100 || n.x > v.x + v.w + 100 || n.y < v.y - 100 || n.y > v.y + v.h + 100) continue;
      const a = Math.min(1, n.barkT * 2, (3.2 - n.barkT) * 5), y = n.y - 72 - (1 - Math.min(1, (3.2 - n.barkT) * 4)) * 8;
      const w = this.textWidth(ctx, BUBBLE_FONT, n.bark) + 20;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(255,250,236,.95)'; ctx.beginPath(); ctx.roundRect(n.x - w / 2, y - 18, w, 26, 13); ctx.fill();
      ctx.beginPath(); ctx.moveTo(n.x - 6, y + 7); ctx.lineTo(n.x, y + 15); ctx.lineTo(n.x + 5, y + 7); ctx.fill();
      ctx.fillStyle = '#3a2e24'; ctx.fillText(n.bark, n.x, y);
      ctx.globalAlpha = 1;
    }
  }

  // ───────────────────────────── wildlife
  private drawCritter(ctx: CanvasRenderingContext2D, c: Critter, e: GameEngine) {
    if (c.kind === 'bird' && c.state === 'fly') return this.paintCritter(ctx, c, e);
    this.cutWorld(ctx, c, c.x, c.y, [-34, -44, 68, 62], g => this.paintCritter(g, c, e), SMALL_STICKER);
  }
  private paintCritter(ctx: CanvasRenderingContext2D, c: Critter, e: GameEngine) {
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
      case 'sheep': {
        const leg = moving ? Math.sin(c.hop * 10) * 4 : 0, wool = snow ? '#fafbff' : '#f4f1e8';
        shadow(ctx, 0, 12, 18, 5, .22);
        ctx.strokeStyle = '#3a3238'; ctx.lineWidth = 3; for (const [lx, ph] of [[-9, 1], [-4, -1], [6, -1], [10, 1]] as Array<[number, number]>) { ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + leg * ph, 12); ctx.stroke(); }
        for (const [bx, by, r] of [[-8, -6, 9], [0, -9, 10], [8, -6, 9], [-2, -2, 9], [6, -1, 8]] as Array<[number, number, number]>) circle(ctx, bx, by, r, wool);
        ellipse(ctx, 15, -9, 6, 5, '#3a3238'); ellipse(ctx, 11, -13, 3, 2, '#3a3238', -.5); circle(ctx, 17, -10, 1.2, '#ffffff');
        if (c.penned) { ctx.fillStyle = '#b9f29d'; ctx.font = `900 11px ${UI}`; ctx.textAlign = 'center'; ctx.fillText('♥', 0, -24); }
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
  private drawFox(ctx: CanvasRenderingContext2D, e: GameEngine) { this.cutWorld(ctx, this.fox, this.fox.x, this.fox.y, [-36, -40, 72, 58], g => this.paintFox(g, e)); }
  private paintFox(ctx: CanvasRenderingContext2D, e: GameEngine) {
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
  /** Giant's Brew grows the hero from the feet up; a Smoke Bomb leaves them half see-through, Stealth turns Riven into
   *  a faint shimmer in the air, and Lyra's Ice Block closes over her. */
  private drawHeroScaled(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const h = e.hero, t = this.time;
    this.drawHeroFx(ctx, e, false);
    if (e.stealthT > 0) {
      // Barely there: two ghost copies that waver apart like heat haze, over a faint violet shadow.
      const w = Math.sin(t * 5) * 1.8;
      glow(ctx, h.x, h.y - 6, 46, '#6a4bd6', .22);
      ctx.save(); ctx.globalAlpha = .26; this.drawHeroBody(ctx, e, w, 0); ctx.restore();
      ctx.save(); ctx.globalAlpha = .18; this.drawHeroBody(ctx, e, -w, Math.cos(t * 4) * .8); ctx.restore();
    } else {
      ctx.save(); if (e.buffs.smokeBomb !== undefined) ctx.globalAlpha = .45 + Math.sin(t * 6) * .1;
      this.drawHeroBody(ctx, e, 0, 0); ctx.restore();
    }
    if (h.iceT > 0) this.drawIceBlock(ctx, e);
    this.drawHeroFx(ctx, e, true);
  }
  /** The hero as a paper puppet, riding or on foot. */
  private drawHeroBody(ctx: CanvasRenderingContext2D, e: GameEngine, dx: number, dy: number) {
    const h = e.hero, t = this.time, s = e.heroScale, id = e.heroId, L = this.heroLook(e), riding = e.riding && !!e.mountId;
    const moving = Math.hypot(h.vx, h.vy) > 30;
    const f = riding ? { facing: 'side' as const, dir: (h.faceX < -.05 ? -1 : 1) as 1 | -1 } : facingOf(h.faceX, h.faceY);
    const castMax = id === 'kael' ? .26 : id === 'riven' ? .2 : .3, casting = h.castTime > 0, storm = h.stormT > 0;
    const k = storm ? (t * 3.5) % 1 : casting ? clamp(1 - h.castTime / castMax, 0, 1) : 0;
    const arm: ArmAction = id === 'kael' ? (casting || storm ? 'swing' : 'idle') : id === 'riven' ? (casting ? 'thrust' : 'idle') : id === 'wren' ? (casting ? 'draw' : 'hold') : casting ? 'raise' : 'hold';
    const pose: Pose = { facing: f.facing, dir: f.dir, walk: h.walkTime, moving: moving && !riding, t, arm, k };
    const flash = h.hurtTime > 0 && Math.floor(t * 16) % 2 === 0;
    const fig = heroFigure(id, L), hooks = heroHooks(id, L, casting ? k : 0, t, { bowDraw: casting ? Math.sin(k * Math.PI) : 0 });
    const x = h.x + dx, y = h.y + dy, box: Box = riding ? [-70 * s, -130 * s, 140 * s, 168 * s] : [FIGURE_BOX[0] * s, (FIGURE_BOX[1] - 22) * s + 22, FIGURE_BOX[2] * s, FIGURE_BOX[3] * s];
    if (!riding) shadow(ctx, x, h.y + 22, 19 * s, 6.5 * s, .28);
    // The hero is cut on a quick beat of their own (every frame on a strong device, 30 or 20 times a second on a weaker
    // one) and stands wherever they are every frame, so walking stays smooth while the puppet costs far less.
    const fps = this.quality >= 1 ? 60 : this.quality >= .75 ? 30 : 20;
    this.living(ctx, 'hero', x, y, box, STICKER, g => {
      let joints: Joints | null = null;
      if (s !== 1) { g.translate(0, 22); g.scale(s, s); g.translate(0, -22); }
      if (riding) {
        const bob = moving ? Math.abs(Math.sin(h.walkTime)) * 2.5 : 0;
        g.save(); g.translate(-h.x, -h.y); this.drawMount(g, e, false); g.restore();
        g.save(); g.beginPath(); g.rect(-70, -140, 140, 132); g.clip(); g.translate(0, -24 - bob); joints = drawFigure(g, fig, pose, hooks); g.restore();
        g.save(); g.translate(-h.x, -h.y); this.drawMount(g, e, true); g.restore();
      } else joints = drawFigure(g, fig, pose, hooks);
      this.heroCut = { joints, k: casting ? k : 0 };
    }, flash ? 'rgba(255,255,255,.72)' : undefined, false, fps);
    const j = this.heroCut.joints;
    // Staff heads glow; epic and legendary gear shimmers where it is worn.
    if (j && (id === 'mira' || id === 'lyra') && j.facing !== 'back' && !riding) {
      const tip = staffTip(j, this.heroCut.k), W = L.weapon;
      glow(ctx, x + tip.x * s, y + tip.y * s, (16 + (casting ? 22 : 0) + (W?.glow ? 8 : 0)) * s, W?.color || (id === 'mira' ? '#ffe38a' : '#9fe4ff'), .85);
      this.lights.push({ x: x + tip.x * s, y: y + tip.y * s, r: 110 + (casting ? 120 : 0), color: id === 'mira' ? '#ffe38a' : '#9fe4ff', a: .9 });
      if (Math.random() < .25) this.pushAmbient({ x: x + tip.x * s + rand(-3, 3), y: y + tip.y * s, vx: rand(-12, 12), vy: id === 'mira' ? rand(-30, -10) : rand(10, 30), life: .7, max: .7, size: 1.8, rot: 0, vr: 0, kind: 'mote', color: id === 'mira' ? '#ffe38a' : '#dff6ff', phase: 0 });
    }
    for (const slot of ['chest', 'back', 'head', 'weapon'] as const) { const g = L[slot]; if (g?.glow) glow(ctx, x, y + (slot === 'head' ? -40 : slot === 'weapon' ? -10 : -4) * s, (20 + Math.sin(t * 4 + x) * 3) * s, g.color, .4); }
  }
  /** What surrounds the hero: afterimages behind, Kael's Shield Wall and Bladestorm, Riven's sure-crit sparks. */
  private drawHeroFx(ctx: CanvasRenderingContext2D, e: GameEngine, front: boolean) {
    const h = e.hero, t = this.time, id = e.heroId;
    if (!front) {
      const tint = id === 'kael' ? '#ffd0a0' : id === 'lyra' ? '#bfeaff' : id === 'riven' ? '#8a7ab8' : id === 'wren' ? '#c8e6a0' : '#bfe8ff';
      for (const a of e.afterimages) {
        const k = a.life / .28;
        ctx.globalAlpha = k * .4; ellipse(ctx, a.x, a.y - 2, 15, 24, tint); circle(ctx, a.x, a.y - 27, 14, tint);
      }
      ctx.globalAlpha = 1;
      if (h.stormT > 0) {
        // Bladestorm: a ring of steel whirling around Kael.
        const spin = t * 22;
        ctx.save(); ctx.translate(h.x, h.y - 6); ctx.scale(1, .62);
        ctx.strokeStyle = 'rgba(255,214,170,.3)'; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(0, 0, 118, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,244,222,.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 122, spin, spin + 2.4); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 122, spin + Math.PI, spin + Math.PI + 2.4); ctx.stroke();
        ctx.restore();
        this.lights.push({ x: h.x, y: h.y, r: 240, color: '#ffb08a', a: .9 });
      }
      return;
    }
    if (h.shieldTime > 0) {
      // Shield Wall: a dome of steel plates.
      const a = Math.min(1, h.shieldTime * 2);
      glow(ctx, h.x, h.y - 14, 76, '#b8c8e0', .45 * a);
      ctx.strokeStyle = `rgba(235,242,255,${.85 * a})`; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(h.x, h.y - 14, 48 + Math.sin(t * 10) * 2, 50, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 6; i++) { const ang = t * 1.2 + i * TAU / 6; ctx.save(); ctx.translate(h.x + Math.cos(ang) * 48, h.y - 14 + Math.sin(ang) * 48); ctx.rotate(ang); ctx.fillStyle = `rgba(200,215,240,${.8 * a})`; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, -2); ctx.lineTo(0, 9); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = `rgba(47,35,48,${.6 * a})`; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); }
    }
    if (id === 'riven' && e.nextCrit && Math.random() < .4) this.pushAmbient({ x: h.x + (h.faceX >= 0 ? 16 : -16) + rand(-4, 4), y: h.y - 6, vx: rand(-8, 8), vy: rand(-30, -10), life: .5, max: .5, size: 1.6, rot: 0, vr: 0, kind: 'mote', color: '#e0c8ff', phase: 0 });
    this.lights.push({ x: h.x, y: h.y - 10, r: e.stealthT > 0 ? 200 : 320, a: 1 });
  }
  /** Lyra frozen solid: a clear block of ice with frosted edges and glints, standing over her. */
  private drawIceBlock(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const h = e.hero, t = this.time, s = e.heroScale, fade = Math.min(1, h.iceT * 3), W = 32 * s, top = h.y - 72 * s, bottom = h.y + 27;
    ctx.save(); ctx.globalAlpha = fade;
    glow(ctx, h.x, h.y - 20, 86 * s, '#9fe4ff', .45);
    // The front face, the top face and the right side of the block, inked like everything else on the page.
    const face = ctx.createLinearGradient(h.x - W, top, h.x + W, bottom);
    face.addColorStop(0, 'rgba(235,250,255,.6)'); face.addColorStop(.45, 'rgba(170,225,255,.34)'); face.addColorStop(1, 'rgba(120,190,240,.52)');
    ctx.fillStyle = 'rgba(240,252,255,.55)'; ctx.beginPath(); ctx.moveTo(h.x - W, top + 4); ctx.lineTo(h.x - W + 10, top - 9); ctx.lineTo(h.x + W + 10, top - 9); ctx.lineTo(h.x + W, top + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(110,180,230,.45)'; ctx.beginPath(); ctx.moveTo(h.x + W, top + 4); ctx.lineTo(h.x + W + 10, top - 9); ctx.lineTo(h.x + W + 10, bottom - 12); ctx.lineTo(h.x + W, bottom); ctx.closePath(); ctx.fill();
    ctx.fillStyle = face; ctx.beginPath(); ctx.roundRect(h.x - W, top, W * 2, bottom - top, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(h.x - W, top, W * 2, bottom - top, 7); ctx.moveTo(h.x - W + 2, top); ctx.lineTo(h.x - W + 10, top - 9); ctx.lineTo(h.x + W + 10, top - 9); ctx.lineTo(h.x + W + 10, bottom - 12); ctx.lineTo(h.x + W, bottom - 1); ctx.moveTo(h.x + W + 10, top - 9); ctx.lineTo(h.x + W - 2, top + 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(h.x - W + 6, top + 14); ctx.lineTo(h.x - W + 14, top + 30); ctx.lineTo(h.x - W + 9, top + 44);
    ctx.moveTo(h.x + W - 8, bottom - 10); ctx.lineTo(h.x + W - 16, bottom - 26); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(h.x - W + 5, top + 6, 4, (bottom - top) * .55);
    const g = (t * .6) % 1; ctx.fillStyle = `rgba(255,255,255,${.5 * (1 - g)})`; ctx.fillRect(h.x - W + 4 + g * W * 2 * .8, top + 4, 3, bottom - top - 8);
    star(ctx, h.x + W - 6, top + 8, 4 + Math.sin(t * 6) * 1.5, 4, .3, t); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
    this.lights.push({ x: h.x, y: h.y - 16, r: 170, color: '#9fe4ff', a: .7 * fade });
  }
  /** Fenn (a grey wolf with a green scarf) and Call of the Wild's glowing spirit wolves. */
  private drawPet(ctx: CanvasRenderingContext2D, p: Pet, e: GameEngine, key: unknown = p) { this.cutWorld(ctx, key, p.x, p.y, [-44, -56, 88, 80], g => this.paintPet(g, p, e)); }
  private paintPet(ctx: CanvasRenderingContext2D, p: Pet, e: GameEngine) {
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
    if (e.practice) { this.drawTrainingDummy(ctx, en); return; }
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
    const bv = en.boss ? e.bossVariant(en) : null;
    if (en.windup > 0 && !en.boss && (en.kind === 'gloomling' || en.kind === 'shadewolf')) {
      // The ground they are about to lunge across, marked in red ink.
      const r = en.kind === 'shadewolf' ? 115 : 80; ctx.save(); ctx.translate(en.x, en.y); ctx.scale(1, .62); ctx.fillStyle = 'rgba(224,70,56,.14)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(190,40,30,.75)'; ctx.lineWidth = 2.4; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 30; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
    if (en.rage > .15) glow(ctx, en.x, en.y + (en.kind === 'wisp' || en.kind === 'frostwraith' ? -10 : -en.r * .15), en.r * (en.boss ? 2 : 2.5), '#ff3b2e', (bv ? .18 : .5) * en.rage * (.85 + Math.sin(t * 9) * .15));
    const R = en.r * (en.boss ? 1.25 : 1) * Math.max(1, spawn), box: Box = [-R * 3.2, -R * 4.2, R * 6.4, R * 5.6];
    const a0 = ctx.globalAlpha; if (en.stunT > 0) ctx.globalAlpha = a0 * .85;
    this.living(ctx, en, en.x, en.y, box, en.boss ? BOSS : STICKER, ctx => {
    const t = this.time + en.homeX * .01;
    ctx.scale(spawn, spawn);
    if (sc !== 1) ctx.scale(sc, sc);
    const trem = en.windup > 0 ? Math.sin(t * 60) * 1.5 : 0;
    const base = sc !== 1 ? { ...en, r: en.r / sc } : en;
    if (bv) this.drawBossForm(ctx, en, t, look, flash, bv, e);
    else switch (en.kind) {
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
    });
    ctx.globalAlpha = a0;
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
    if (bv) this.lights.push({ x: en.x, y: en.y - en.r * .4, r: 300, color: bv.look.glow, a: .75 });
    else if (en.kind === 'wisp' || en.kind === 'hollowStar' || en.kind === 'eclipse') this.lights.push({ x: en.x, y: en.y, r: en.boss ? 300 : 90, color: '#a78bfa', a: .8 });
    if (bv) { /* lit above */ } else if (en.kind === 'frostwraith' || en.kind === 'cragGolem') this.lights.push({ x: en.x, y: en.y - 10, r: 90, color: '#8ee8ff', a: .7 });
    if (!bv && (en.kind === 'emberImp' || en.kind === 'magmaHulk' || en.kind === 'cinderTyrant')) this.lights.push({ x: en.x, y: en.y - 10, r: en.boss ? 320 : en.kind === 'magmaHulk' ? 130 : 90, color: '#ff8a3d', a: .85 });
    if (en.boss && en.aggro) this.lights.push({ x: en.x, y: en.y, r: 180, color: '#ff8f7a', a: .4 });
  }
  /** Wraps a painter that draws in world coordinates into a sticker cutout anchored at (x, y). */
  private cutWorld(ctx: CanvasRenderingContext2D, key: unknown, x: number, y: number, box: Box, draw: (g: CanvasRenderingContext2D) => void, style: CutStyle = STICKER, fps = 12) {
    this.living(ctx, key, x, y, box, style, draw, undefined, true, fps);
  }
  private drawTrainingDummy(ctx: CanvasRenderingContext2D, en: Enemy) { this.cutWorld(ctx, en, en.x, en.y, [-50, -90, 100, 124], g => this.paintDummy(g, en)); }
  private paintDummy(ctx: CanvasRenderingContext2D, en: Enemy) {
    const hit = en.hitFlash > 0, x = en.x, y = en.y, t = this.time;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + x) * .015);
    ctx.fillStyle = 'rgba(10,15,20,.35)'; ctx.beginPath(); ctx.ellipse(0, 18, 42, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#815c45'; ctx.strokeStyle = hit ? '#fff1b8' : '#c59a68'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-22, -34, 44, 70, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a87851'; ctx.beginPath(); ctx.arc(0, -42, 27, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a1b22'; ctx.beginPath(); ctx.arc(-9, -45, 3, 0, TAU); ctx.arc(9, -45, 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e8c08a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -39, 9, .15, Math.PI - .15); ctx.stroke();
    ctx.fillStyle = '#f5d27a'; ctx.font = `800 11px ${UI}`; ctx.textAlign = 'center'; ctx.fillText('DUMMY', 0, 3);
    ctx.restore();
    const bw = 72, by = y - 76; ctx.fillStyle = 'rgba(10,15,20,.7)'; ctx.beginPath(); ctx.roundRect(x - bw / 2, by, bw, 7, 3); ctx.fill();
    ctx.fillStyle = '#b9f29d'; ctx.beginPath(); ctx.roundRect(x - bw / 2, by + 1, bw * Math.max(0, en.hp / en.maxHp), 5, 2); ctx.fill();
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
  // ───────────────────────────── the heroes' own guardians
  /** A guardian as one hero meets it: the shape, colours and detail come from its variant (see bosses.ts). */
  private drawBossForm(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, v: BossVariant, e: GameEngine) {
    const L = v.look, awake = e.bossUnlocked(en);
    const blinkFade = en.action === 'blink' && en.actionT > 1.1 ? (en.actionT - 1.1) / .3 : en.action === 'blink' && en.actionT > .9 ? 1 - (en.actionT - .9) / .2 : 1;
    const fade = en.action === 'shadowstrike' ? .45 + .55 * Math.abs(Math.sin(en.actionT * 7)) : blinkFade;
    ctx.globalAlpha = clamp(fade, .1, 1);
    // Only a hint of the angry red that ordinary creatures get: a guardian keeps its own colours.
    const c = {
      body: flash ? '#ffffff' : enrage(L.body, en.rage * .25), dark: flash ? '#ffffff' : shade(L.body, -.35), light: flash ? '#ffffff' : shade(L.body, .25),
      trim: flash ? '#ffffff' : L.trim, glow: en.phase > 1 ? shade(L.glow, .2) : L.glow, eye: awake ? (en.phase > 1 ? '#ff5a4a' : L.eye) : '#2a2430',
    };
    switch (L.form) {
      case 'knight': this.bossKnight(ctx, en, t, look, L, c, awake); break;
      case 'beast': this.bossBeast(ctx, en, t, look, L, c, awake); break;
      case 'wraith': this.bossWraith(ctx, en, t, look, L, c, awake); break;
      case 'serpent': this.bossSerpent(ctx, en, t, look, L, c, awake); break;
      case 'spider': this.bossSpider(ctx, en, t, look, L, c, awake); break;
      case 'colossus': this.bossColossus(ctx, en, t, look, L, c, awake); break;
      case 'mask': this.bossMask(ctx, en, t, look, L, c, awake); break;
      case 'eclipse': this.bossEclipse(ctx, en, t, L, c); break;
    }
    ctx.globalAlpha = 1;
    if (en.phase > 1 && Math.random() < .25) this.pushAmbient({ x: en.x + rand(-en.r, en.r), y: en.y - en.r, vx: 0, vy: -40, life: 1, max: 1, size: 5, rot: 0, vr: 0, kind: 'mote', color: alpha(L.glow, .6), phase: 0 });
  }
  /** A giant knight in plate: a greatsword raised for the slam, and a tower shield or a crown of thorns. */
  private bossKnight(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, L: BossLook, c: BossColors, awake: boolean) {
    const r = en.r, walk = en.aggro && !en.action ? Math.sin(t * 5) : 0, slam = en.action === 'slam' ? 1 - en.actionT / 1.25 : 0, charging = en.action === 'charge' && en.actionT < .75;
    const dir = look.x >= 0 ? 1 : -1;
    shadow(ctx, 0, r * .95, r * 1.35, r * .45, .4);
    glow(ctx, 0, -r * .6, r * 2.8, c.glow, awake ? .45 : .15);
    if (charging) ctx.rotate(dir * .12);
    for (const s of [-1, 1]) { ctx.fillStyle = c.dark; ctx.beginPath(); ctx.roundRect(s * r * .3 - r * .19, r * .2 + walk * s * 4, r * .38, r * .72, 7); ctx.fill(); ctx.fillStyle = c.trim; ctx.fillRect(s * r * .3 - r * .19, r * .5 + walk * s * 4, r * .38, 3); }
    // Tabard and breastplate.
    ctx.fillStyle = c.trim; ctx.beginPath(); ctx.moveTo(-r * .45, -r * .2); ctx.lineTo(r * .45, -r * .2); ctx.lineTo(r * .32, r * .5); ctx.lineTo(-r * .32, r * .5); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(-r * .8, 0, r * .8, 0); g.addColorStop(0, c.dark); g.addColorStop(.5, c.light); g.addColorStop(1, c.dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-r * .72, r * .1); ctx.lineTo(-r * .88, -r * .75); ctx.lineTo(-r * .4, -r * 1.1); ctx.lineTo(r * .4, -r * 1.1); ctx.lineTo(r * .88, -r * .75); ctx.lineTo(r * .72, r * .1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = alpha(L.trim, .9); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = c.glow; star(ctx, 0, -r * .6, r * .2, 4, .4); ctx.fill(); glow(ctx, 0, -r * .6, r * .5, c.glow, awake ? .7 : .2);
    for (const s of [-1, 1]) { ellipse(ctx, s * r * .85, -r * .9, r * .34, r * .24, c.body, s * .3); ctx.strokeStyle = c.trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s * r * .85, -r * .9, r * .34, r * .24, s * .3, Math.PI, TAU); ctx.stroke(); }
    // Helm with a glowing visor slit.
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.roundRect(-r * .34, -r * 1.62, r * .68, r * .62, [r * .3, r * .3, r * .1, r * .1]); ctx.fill();
    ctx.fillStyle = '#0a0810'; ctx.fillRect(-r * .26, -r * 1.36, r * .52, r * .1);
    for (const s of [-1, 1]) { circle(ctx, look.x * 3 + s * r * .12, -r * 1.31, 3, c.eye); if (awake) glow(ctx, look.x * 3 + s * r * .12, -r * 1.31, 14, c.eye, .9); }
    if (L.style === 'thorns') {
      ctx.fillStyle = c.trim; for (let i = 0; i < 6; i++) { const x = -r * .32 + i * r * .128; ctx.beginPath(); ctx.moveTo(x - 4, -r * 1.58); ctx.lineTo(x, -r * 1.86 - (i % 2) * 6); ctx.lineTo(x + 4, -r * 1.58); ctx.fill(); }
      ctx.strokeStyle = '#4a5a2e'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-r * .8, -r * (.8 - i * .3)); ctx.bezierCurveTo(-r * .3, -r * (1 - i * .3) + Math.sin(t * 2 + i) * 4, r * .3, -r * (.6 - i * .3), r * .8, -r * (.85 - i * .3)); ctx.stroke(); }
    } else {
      // A plume streaming back from the crest.
      ctx.fillStyle = c.trim; ctx.beginPath(); ctx.moveTo(0, -r * 1.6); ctx.quadraticCurveTo(-dir * r * .6, -r * 2 + Math.sin(t * 4) * 4, -dir * r * 1, -r * 1.55); ctx.quadraticCurveTo(-dir * r * .5, -r * 1.7, 0, -r * 1.5); ctx.fill();
    }
    // Greatsword in the sword hand: high overhead, then down in the slam.
    const ang = en.action === 'slam' ? -2.3 + Math.min(1, slam * 1.6) * 2.7 : charging ? 1.3 : -.55 + Math.sin(t * 1.5) * .08;
    ctx.save(); ctx.translate(dir * r * .95, -r * .6); ctx.rotate(dir * ang);
    ctx.fillStyle = '#3a2a26'; ctx.fillRect(-3, -6, 6, r * .3); rect(ctx, -r * .22, -8, r * .44, 5, c.trim);
    const bg = ctx.createLinearGradient(-5, 0, 5, 0); bg.addColorStop(0, '#9aa0b0'); bg.addColorStop(.5, '#f2f4ff'); bg.addColorStop(1, '#9aa0b0');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-5, -r * 1.7); ctx.lineTo(0, -r * 1.9); ctx.lineTo(5, -r * 1.7); ctx.lineTo(6, -8); ctx.closePath(); ctx.fill();
    glow(ctx, 0, -r * 1.2, r * .5, c.glow, .5);
    ctx.restore();
    if (L.style === 'shield') {
      ctx.save(); ctx.translate(-dir * r * .78, -r * .35); ctx.rotate(-dir * .12);
      ctx.fillStyle = c.dark; ctx.beginPath(); ctx.moveTo(-r * .32, -r * .55); ctx.lineTo(r * .32, -r * .55); ctx.lineTo(r * .3, r * .25); ctx.lineTo(0, r * .6); ctx.lineTo(-r * .3, r * .25); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c.trim; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = alpha(L.glow, .8); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * .45); ctx.lineTo(0, r * .45); ctx.moveTo(-r * .22, -r * .1); ctx.lineTo(r * .22, -r * .1); ctx.stroke();
      ctx.restore();
    }
  }
  /** A great beast on four legs: a tusked boar king, a shadow wolf with a mane of smoke, or a white stag with starlit antlers. */
  private bossBeast(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, L: BossLook, c: BossColors, awake: boolean) {
    const r = en.r, charging = en.action === 'charge' && en.actionT < .75 && en.actionT > .3, dir = charging ? Math.sign(en.chargeX || 1) : look.x >= 0 ? 1 : -1;
    const run = en.aggro ? Math.sin(t * (charging ? 26 : 9)) : Math.sin(t * 3) * .2, stag = L.style === 'antlers', wolf = L.style === 'wolf', boar = L.style === 'tusks';
    const howl = en.action === 'howl' ? Math.sin(Math.min(1, (1.3 - en.actionT) / .5) * Math.PI * .5) : 0;
    shadow(ctx, 0, r * .8, r * 1.5, r * .45, .4);
    glow(ctx, 0, -r * .3, r * 2.6, c.glow, awake ? .4 : .12);
    ctx.save(); ctx.scale(dir, 1); if (charging) ctx.rotate(.1);
    const legLen = stag ? r * .95 : r * .7;
    ctx.strokeStyle = c.dark; ctx.lineWidth = r * .18; ctx.lineCap = 'round';
    for (const [lx, ph] of [[-.65, 1], [-.35, -1], [.4, -1], [.7, 1]] as Array<[number, number]>) { ctx.beginPath(); ctx.moveTo(lx * r, r * .05); ctx.lineTo(lx * r + run * ph * 8, r * .05 + legLen); ctx.stroke(); }
    const by = stag ? -r * .35 : -r * .1;
    if (wolf) { ctx.lineWidth = r * .2; ctx.strokeStyle = c.body; ctx.beginPath(); ctx.moveTo(-r * .95, by - r * .1); ctx.quadraticCurveTo(-r * 1.5, by - r * .6 + Math.sin(t * 5) * 6, -r * 1.7, by - r * .1); ctx.stroke(); }
    ellipse(ctx, 0, by, r * 1.15, r * (boar ? .72 : .6), c.body);
    ellipse(ctx, -r * .15, by + r * .2, r * .8, r * .25, 'rgba(255,255,255,.07)');
    if (boar) { ctx.fillStyle = c.dark; for (let i = 0; i < 10; i++) { const bx = -r * .9 + i * r * .2; ctx.beginPath(); ctx.moveTo(bx - 6, by - r * .5); ctx.lineTo(bx + 2, by - r * .95 - (i % 2) * 8); ctx.lineTo(bx + 6, by - r * .5); ctx.fill(); } }
    if (wolf) { for (let i = 0; i < 9; i++) { const a = -2.6 + i * .28; ctx.fillStyle = i % 2 ? c.dark : alpha(L.trim, .85); ctx.beginPath(); ctx.moveTo(r * .55 + Math.cos(a) * r * .35, by - r * .2 + Math.sin(a) * r * .35); ctx.lineTo(r * .55 + Math.cos(a) * r * (.85 + Math.sin(t * 6 + i) * .08), by - r * .2 + Math.sin(a) * r * .85); ctx.lineTo(r * .55 + Math.cos(a + .2) * r * .35, by - r * .2 + Math.sin(a + .2) * r * .35); ctx.fill(); } }
    if (stag) { ctx.fillStyle = alpha(L.trim, .9); star(ctx, -r * .2, by - r * .05, r * .18, 5, .45, t); ctx.fill(); }
    // Neck and head, lifted back in a howl.
    const hx = r * (boar ? .95 : 1), hy = by - r * (stag ? .75 : .35) - howl * r * .4;
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(r * .55, by - r * .4); ctx.lineTo(hx + r * .1, hy - r * .1); ctx.lineTo(hx + r * .15, hy + r * .3); ctx.lineTo(r * .7, by + r * .2); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-howl * .7);
    ellipse(ctx, 0, 0, r * .45, r * .36, c.body);
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(r * .2, -r * .18); ctx.lineTo(r * (boar ? .7 : .85), boar ? 0 : -r * .02); ctx.lineTo(r * .2, r * .22); ctx.fill();
    if (boar) { ellipse(ctx, r * .7, r * .02, r * .15, r * .13, '#e0a08a'); ctx.fillStyle = '#fff4e0'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * .5, r * .12 * s + r * .06); ctx.quadraticCurveTo(r * .75, -r * .3 + s * r * .05, r * .62, -r * .45 + s * r * .05); ctx.lineTo(r * .48, r * .05); ctx.fill(); } }
    if (wolf || boar) { ctx.fillStyle = c.dark; for (const ex of [-.15, .1]) { ctx.beginPath(); ctx.moveTo(r * ex - 6, -r * .25); ctx.lineTo(r * ex, -r * .7); ctx.lineTo(r * ex + 6, -r * .25); ctx.fill(); } }
    if (stag) {
      ctx.strokeStyle = c.trim; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (const s of [0, 12]) { ctx.beginPath(); ctx.moveTo(-r * .05 + s, -r * .3); ctx.lineTo(-r * .2 + s, -r * 1.1); ctx.moveTo(-r * .12 + s, -r * .7); ctx.lineTo(-r * .45 + s, -r * .95); ctx.moveTo(-r * .17 + s, -r * .95); ctx.lineTo(r * .1 + s, -r * 1.3); ctx.moveTo(-r * .2 + s, -r * 1.1); ctx.lineTo(-r * .5 + s, -r * 1.35); ctx.stroke(); }
      for (const [x, y] of [[-r * .2, -r * 1.1], [r * .1, -r * 1.3], [-r * .5, -r * 1.35], [-r * .45, -r * .95]]) glow(ctx, x, y, 12, c.glow, .9);
    }
    circle(ctx, r * .22, -r * .1, 4.2, c.eye); if (awake) glow(ctx, r * .22, -r * .1, 16, c.eye, .9);
    if (wolf && (charging || howl > 0)) { ctx.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * (.35 + i * .13), r * .14); ctx.lineTo(r * (.4 + i * .13), r * .28); ctx.lineTo(r * (.45 + i * .13), r * .14); ctx.fill(); } }
    ctx.restore();
    ctx.restore();
    if (wolf && Math.random() < .3) this.pushAmbient({ x: en.x + rand(-r, r), y: en.y - r * .5, vx: rand(-10, 10), vy: rand(-30, -10), life: 1, max: 1, size: 8, rot: 0, vr: 0, kind: 'smoke', color: alpha(L.trim, .35), phase: 0 });
  }
  /** A towering specter: a hooded huntress, a helmed marshal or a masked broker, with two floating clawed hands. */
  private bossWraith(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, L: BossLook, c: BossColors, awake: boolean) {
    const r = en.r * 1.15, hover = Math.sin(t * 2) * 7 - 20, cast = en.action === 'nova' || en.action === 'volley' || en.action === 'meteors' ? 1 : 0;
    shadow(ctx, 0, en.r * 1.2, en.r * 1.1, en.r * .35, .25);
    ctx.translate(0, hover);
    glow(ctx, 0, -r * .3, r * 3, c.glow, awake ? .6 : .2);
    const g = ctx.createLinearGradient(0, -r * 1.6, 0, r * 1.5); g.addColorStop(0, c.body); g.addColorStop(.55, alpha(L.body, .8)); g.addColorStop(1, alpha(L.body, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -r * 1.6);
    ctx.quadraticCurveTo(r * 1.2, -r * 1.2, r * 1, r * .3);
    for (let i = 0; i <= 5; i++) { const px = r - i * r * .4; ctx.quadraticCurveTo(px - r * .2, r * (1.2 + Math.sin(t * 6 + i) * .2), px - r * .4, r * (.95 + (i % 2) * .45)); }
    ctx.quadraticCurveTo(-r * 1.2, -r * 1.2, 0, -r * 1.6); ctx.fill();
    ctx.strokeStyle = alpha(L.trim, .8); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * .55, -r * .9); ctx.quadraticCurveTo(0, -r * .4, r * .55, -r * .9); ctx.stroke();
    // The face under the hood, helm or mask.
    ctx.fillStyle = L.style === 'mask' ? '#d8cfc0' : 'rgba(10,14,30,.75)'; ctx.beginPath(); ctx.ellipse(look.x * 3, -r * .95, r * .42, r * .38, 0, 0, TAU); ctx.fill();
    if (L.style === 'mask') { ctx.strokeStyle = '#4a3a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(look.x * 3 - r * .1, -r * 1.3); ctx.lineTo(look.x * 3, -r * .95); ctx.lineTo(look.x * 3 - r * .15, -r * .65); ctx.stroke(); }
    for (const s of [-1, 1]) { ellipse(ctx, look.x * 4 + s * r * .16, -r * .98, 4.5, 3, c.eye); if (awake) glow(ctx, look.x * 4 + s * r * .16, -r * .98, 14, c.eye, .9); }
    if (L.style === 'helm') {
      ctx.fillStyle = c.trim; ctx.beginPath(); ctx.moveTo(-r * .48, -r * 1.05); ctx.quadraticCurveTo(0, -r * 1.75, r * .48, -r * 1.05); ctx.lineTo(r * .4, -r * 1.2); ctx.quadraticCurveTo(0, -r * 1.5, -r * .4, -r * 1.2); ctx.fill();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .38, -r * 1.3); ctx.quadraticCurveTo(s * r * .8, -r * 1.55, s * r * .72, -r * 1.95); ctx.lineTo(s * r * .3, -r * 1.42); ctx.fill(); }
    } else if (L.style === 'hood') {
      ctx.fillStyle = alpha(L.trim, .7); for (let i = 0; i < 5; i++) { const a = -Math.PI * .85 + i * Math.PI * .175; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .45 - 3, -r * 1.05 + Math.sin(a) * r * .45); ctx.lineTo(Math.cos(a) * r * .75, -r * 1.05 + Math.sin(a) * r * .8); ctx.lineTo(Math.cos(a) * r * .45 + 3, -r * 1.05 + Math.sin(a) * r * .45); ctx.fill(); }
    }
    for (const s of [-1, 1]) {
      const hx = s * r * (1.15 + cast * .25), hy = -r * (.3 + cast * .45) + Math.sin(t * 3 + s) * 6;
      ellipse(ctx, hx, hy, r * .2, r * .16, c.body);
      ctx.strokeStyle = c.trim; ctx.lineWidth = 2.5; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(hx + s * r * .12, hy + k * 5); ctx.lineTo(hx + s * r * .3, hy + k * 9 - 4); ctx.stroke(); }
      if (cast) glow(ctx, hx, hy, 26, c.glow, .9);
    }
    for (let i = 0; i < 4; i++) { const a = t * 1.6 + i * TAU / 4, ox = Math.cos(a) * r * 1.5, oy = -r * .3 + Math.sin(a) * r * .55; ctx.fillStyle = c.trim; ctx.beginPath(); ctx.moveTo(ox, oy - 8); ctx.lineTo(ox + 3.5, oy); ctx.lineTo(ox, oy + 8); ctx.lineTo(ox - 3.5, oy); ctx.fill(); glow(ctx, ox, oy, 12, c.glow, .7); }
  }
  /** A great coiled serpent: a lake serpent with fins, a fire-wyrm, or a sand-worm with a round, toothed maw. */
  private bossSerpent(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, L: BossLook, c: BossColors, awake: boolean) {
    const r = en.r, sand = L.style === 'sand', strike = en.action === 'charge' ? 1 : en.action === 'nova' || en.action === 'spiral' ? .5 : 0;
    shadow(ctx, 0, r * .75, r * 1.6, r * .5, .4);
    glow(ctx, 0, -r * .3, r * 2.6, c.glow, awake ? .4 : .12);
    // The coils: a ring of scales on the ground.
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + t * .4, x = Math.cos(a) * r * .95, y = r * .35 + Math.sin(a) * r * .38, s = r * (.34 + .06 * Math.sin(i * 1.7));
      ellipse(ctx, x, y, s, s * .8, i % 2 ? c.body : c.dark);
      if (!sand && i % 3 === 0) { ctx.fillStyle = alpha(L.trim, .9); ctx.beginPath(); ctx.moveTo(x - 5, y - s * .7); ctx.lineTo(x, y - s * 1.3); ctx.lineTo(x + 5, y - s * .7); ctx.fill(); }
    }
    // The neck, rising and swaying toward the hero.
    const sway = Math.sin(t * 1.8) * r * .15 + look.x * r * .25, hx = sway + look.x * strike * r * .3, hy = -r * (1.35 + strike * .25);
    ctx.strokeStyle = c.body; ctx.lineWidth = r * .42; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, r * .2); ctx.bezierCurveTo(-r * .3, -r * .3, sway + r * .3, -r * .8, hx, hy); ctx.stroke();
    ctx.strokeStyle = alpha(L.trim, .55); ctx.lineWidth = r * .14;
    ctx.beginPath(); ctx.moveTo(r * .05, r * .15); ctx.bezierCurveTo(-r * .2, -r * .3, sway + r * .35, -r * .8, hx + 2, hy + 4); ctx.stroke();
    if (sand) {
      circle(ctx, hx, hy, r * .42, c.body);
      circle(ctx, hx + look.x * 3, hy + r * .05, r * .28, '#2a1810');
      ctx.fillStyle = '#fff1d8'; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + t; ctx.beginPath(); ctx.moveTo(hx + look.x * 3 + Math.cos(a) * r * .28, hy + r * .05 + Math.sin(a) * r * .28); ctx.lineTo(hx + look.x * 3 + Math.cos(a) * r * .16, hy + r * .05 + Math.sin(a) * r * .16); ctx.lineTo(hx + look.x * 3 + Math.cos(a + .25) * r * .28, hy + r * .05 + Math.sin(a + .25) * r * .28); ctx.fill(); }
      glow(ctx, hx, hy + r * .05, r * .5, c.glow, .6);
      for (const s of [-1, 1]) circle(ctx, hx + s * r * .36, hy - r * .22, 3.5, c.eye);
    } else {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(look.x * .25);
      ellipse(ctx, 0, 0, r * .5, r * .34, c.body);
      ellipse(ctx, 0, r * .12, r * .38, r * .16 + strike * r * .1, '#1a0e0a');
      if (strike) { ctx.fillStyle = '#ffffff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .18, r * .02); ctx.lineTo(s * r * .14, r * .22); ctx.lineTo(s * r * .1, r * .02); ctx.fill(); } }
      ctx.fillStyle = c.trim; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .35, -r * .1); ctx.lineTo(s * r * .85, -r * .45 + Math.sin(t * 5) * 4); ctx.lineTo(s * r * .45, r * .08); ctx.fill(); }
      for (const s of [-1, 1]) { ellipse(ctx, s * r * .2, -r * .1, 5, 3.5, c.eye); if (awake) glow(ctx, s * r * .2, -r * .1, 15, c.eye, .9); }
      ctx.restore();
    }
  }
  /** A spider queen: a huge striped body under a crown, eight long legs and a cluster of glowing eyes. */
  private bossSpider(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, L: BossLook, c: BossColors, awake: boolean) {
    const r = en.r * 1.1, walk = en.aggro ? t * 12 : t * 3;
    shadow(ctx, 0, r * .7, r * 1.6, r * .5, .4);
    glow(ctx, 0, -r * .2, r * 2.6, c.glow, awake ? .35 : .1);
    ctx.strokeStyle = alpha(L.trim, .25); ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(0, r * .3); ctx.lineTo(Math.cos(a) * r * 2, r * .3 + Math.sin(a) * r * .8); ctx.stroke(); }
    ctx.strokeStyle = c.dark; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const a = (-1 + i * .55) + Math.sin(walk + i * 1.7 + (s > 0 ? 1 : 0)) * .15, kx = s * Math.cos(a) * r * 1.35, ky = Math.sin(a) * r * .6 - r * .75;
      ctx.beginPath(); ctx.moveTo(s * r * .35, -r * .1); ctx.lineTo(kx, ky); ctx.lineTo(kx + s * r * .5, ky + r * 1.25); ctx.stroke();
    }
    ellipse(ctx, 0, r * .05, r * .95, r * .78, c.body);
    ctx.fillStyle = c.trim; ctx.beginPath(); ctx.moveTo(0, -r * .45); ctx.lineTo(r * .22, 0); ctx.lineTo(0, r * .45); ctx.lineTo(-r * .22, 0); ctx.closePath(); ctx.fill();
    for (const s of [-1, 1]) { ctx.strokeStyle = alpha(L.trim, .5); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, r * .05, r * .65, s > 0 ? -.9 : Math.PI - .9 + 1.8, s > 0 ? .9 : Math.PI + .9); ctx.stroke(); }
    const hx = look.x * r * .25, hy = -r * .7 + look.y * 3;
    ellipse(ctx, hx, hy, r * .5, r * .4, c.dark);
    for (let i = 0; i < 6; i++) { const ex = hx + (i - 2.5) * r * .13, ey = hy - (i % 2) * 5; circle(ctx, ex, ey, 3, c.eye); if (awake) glow(ctx, ex, ey, 9, c.eye, .8); }
    ctx.fillStyle = '#e8d8a0'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * r * .12, hy + r * .25); ctx.quadraticCurveTo(hx + s * r * .25, hy + r * .45, hx + s * r * .08, hy + r * .55); ctx.lineTo(hx + s * r * .05, hy + r * .28); ctx.fill(); }
    ctx.fillStyle = '#d8b44a'; ctx.beginPath(); ctx.moveTo(hx - r * .3, hy - r * .3); for (let i = 0; i <= 4; i++) ctx.lineTo(hx - r * .3 + i * r * .15, hy - r * (i % 2 ? .45 : .62)); ctx.lineTo(hx + r * .3, hy - r * .3); ctx.closePath(); ctx.fill();
  }
  /** A colossus of stone and metal: an ice-crystal queen, or an iron war engine with a furnace for a heart. */
  private bossColossus(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, L: BossLook, c: BossColors, awake: boolean) {
    const r = en.r, raise = en.action === 'slam' ? Math.min(1, (1.25 - en.actionT) / .6) : en.action === 'geysers' ? .6 : 0, step = en.aggro && !en.action ? Math.sin(t * 3.5) : 0, crystal = L.style === 'crystal';
    shadow(ctx, 0, r * .9, r * 1.5, r * .48, .4);
    glow(ctx, 0, -r * .5, r * 2.8, c.glow, awake ? .45 : .12);
    ctx.translate(0, -raise * 10);
    for (const s of [-1, 1]) { ctx.fillStyle = c.dark; ctx.beginPath(); ctx.roundRect(s * r * .35 - r * .24, r * .15 + step * s * 4, r * .48, r * .75, 8); ctx.fill(); }
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(-r * .9, r * .35); ctx.lineTo(-r * 1.1, -r * .5); ctx.lineTo(-r * .6, -r * 1.25); ctx.lineTo(r * .6, -r * 1.25); ctx.lineTo(r * 1.1, -r * .5); ctx.lineTo(r * .9, r * .35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(r * .1, -r * 1.25); ctx.lineTo(r * .6, -r * 1.25); ctx.lineTo(r * 1.1, -r * .5); ctx.lineTo(r * .9, r * .35); ctx.lineTo(r * .2, r * .35); ctx.closePath(); ctx.fill();
    if (crystal) {
      for (const [x, y, h, a] of [[-.7, -1.15, .9, -.4], [-.35, -1.25, 1.2, -.15], [.1, -1.3, 1.4, .05], [.5, -1.2, 1, .3], [.85, -1, .7, .5]] as Array<[number, number, number, number]>) {
        ctx.save(); ctx.translate(x * r, y * r); ctx.rotate(a);
        const cg = ctx.createLinearGradient(-8, 0, 8, 0); cg.addColorStop(0, c.trim); cg.addColorStop(1, '#ffffff');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(-r * .12, 0); ctx.lineTo(0, -h * r * .55); ctx.lineTo(r * .12, 0); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      glow(ctx, 0, -r * 1.6, r * .9, c.glow, .6);
    } else {
      // Rivets, a chimney that smokes and a furnace mouth.
      ctx.fillStyle = shade(L.body, .3); for (let i = 0; i < 6; i++) circle(ctx, -r * .75 + i * r * .3, -r * 1.05, 3, shade(L.body, .35));
      rect(ctx, r * .45, -r * 1.75, r * .25, r * .55, c.dark);
      if (Math.random() < .35) this.pushAmbient({ x: en.x + r * .57, y: en.y - r * 1.8, vx: rand(-8, 8), vy: -50, life: 1.4, max: 1.4, size: 10, rot: 0, vr: 0, kind: 'smoke', color: 'rgba(60,50,48,.5)', phase: 0 });
    }
    const core = crystal ? c.glow : L.trim;
    ctx.fillStyle = '#140c0a'; ctx.beginPath(); ctx.roundRect(-r * .32, -r * .7, r * .64, r * .45, 8); ctx.fill();
    const fg = ctx.createRadialGradient(0, -r * .48, 2, 0, -r * .48, r * .35); fg.addColorStop(0, '#ffffff'); fg.addColorStop(.4, core); fg.addColorStop(1, alpha(core, 0));
    ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(-r * .3, -r * .68, r * .6, r * .41, 7); ctx.fill(); glow(ctx, 0, -r * .48, r * 1.1, core, .5 + raise * .5);
    for (const s of [-1, 1]) { ellipse(ctx, look.x * 3 + s * r * .3, -r * .98, 5, 3.5, c.eye); if (awake) glow(ctx, look.x * 3 + s * r * .3, -r * .98, 13, c.eye, .9); }
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * r * 1.08, -r * .55); ctx.rotate(s * (.3 - raise * 2.5) + step * .1);
      ctx.fillStyle = c.body; ctx.beginPath(); ctx.roundRect(-r * .26, 0, r * .52, r * .9, 8); ctx.fill();
      ctx.fillStyle = c.dark; ctx.beginPath(); ctx.roundRect(-r * .32, r * .8, r * .64, r * .42, 8); ctx.fill();
      rect(ctx, -r * .22, r * .95, r * .44, 3, core);
      ctx.restore();
    }
  }
  /** A floating mask over a cloak of shadow: a crow-beaked mask of black feathers, or a blank white mask like a mirror. */
  private bossMask(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, L: BossLook, c: BossColors, awake: boolean) {
    const r = en.r * 1.1, hover = Math.sin(t * 1.8) * 8 - 22, feathers = L.style === 'feathers', cast = en.action === 'volley' || en.action === 'spiral' || en.action === 'nova' ? 1 : 0;
    shadow(ctx, 0, en.r * 1.2, en.r, en.r * .32, .25);
    ctx.translate(0, hover);
    glow(ctx, 0, -r * .2, r * 3, c.glow, awake ? .55 : .18);
    // The cloak: tatters of shadow, or long black feathers.
    const cloak = feathers ? '#0e0a14' : '#1a1030';
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * .1 + i / 10 * Math.PI * .8, len = r * (1.35 + Math.sin(t * 3 + i) * .12 + (i % 2) * .2);
      ctx.fillStyle = i % 2 ? cloak : '#2a1c3a';
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .3, -r * .2); ctx.quadraticCurveTo(Math.cos(a) * len * .8, Math.sin(a) * len * .4, Math.cos(a) * len, Math.sin(a) * len * .8); ctx.lineTo(Math.cos(a + .12) * r * .3, -r * .2); ctx.fill();
      if (feathers) { ctx.strokeStyle = alpha(L.trim, .6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .5, -r * .1); ctx.lineTo(Math.cos(a) * len * .95, Math.sin(a) * len * .75); ctx.stroke(); }
    }
    // The mask itself.
    const mg = ctx.createLinearGradient(-r * .6, -r * 1.2, r * .6, 0); mg.addColorStop(0, c.light); mg.addColorStop(1, c.body);
    ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(0, -r * .65, r * .58, r * .75, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = alpha(L.trim, .9); ctx.lineWidth = 2.5; ctx.stroke();
    if (feathers) {
      ctx.fillStyle = c.dark; ctx.beginPath(); ctx.moveTo(-r * .12, -r * .6); ctx.lineTo(look.x * r * .2, -r * .05); ctx.lineTo(r * .12, -r * .6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.trim; for (let i = 0; i < 5; i++) { const a = -Math.PI * .9 + i * Math.PI * .2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .5, -r * .7 + Math.sin(a) * r * .65); ctx.lineTo(Math.cos(a) * r * .95, -r * .75 + Math.sin(a) * r * 1.1); ctx.lineTo(Math.cos(a + .15) * r * .5, -r * .7 + Math.sin(a + .15) * r * .65); ctx.fill(); }
    } else {
      // A mirror sheen and a crack across the blank face.
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * .2, -r * .95, r * .12, r * .3, -.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = c.trim; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(r * .3, -r * 1.25); ctx.lineTo(r * .08, -r * .8); ctx.lineTo(r * .2, -r * .55); ctx.lineTo(-r * .05, -r * .15); ctx.stroke();
    }
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#05020c'; ctx.beginPath(); ctx.ellipse(look.x * 3 + s * r * .22, -r * .8, r * .13, r * .07, s * .3, 0, TAU); ctx.fill();
      circle(ctx, look.x * 4 + s * r * .22, -r * .8, 3.2, L.eye === '#05020c' ? c.glow : c.eye); if (awake) glow(ctx, look.x * 4 + s * r * .22, -r * .8, 16, L.eye === '#05020c' ? c.glow : c.eye, .9);
    }
    for (const s of [-1, 1]) {
      const hx = s * r * (1.1 + cast * .3), hy = -r * (.2 + cast * .4) + Math.sin(t * 2.6 + s * 2) * 8;
      ctx.fillStyle = cloak; ctx.beginPath(); ctx.ellipse(hx, hy, r * .18, r * .22, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = c.trim; ctx.lineWidth = 2; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(hx, hy + r * .1); ctx.lineTo(hx + k * 6, hy + r * .38); ctx.stroke(); }
      if (cast) glow(ctx, hx, hy, 28, c.glow, .9);
    }
  }
  /** Umbra as one hero sees it: the same black sun, in that hero's colours, circled by the shapes of their fears. */
  private bossEclipse(ctx: CanvasRenderingContext2D, en: Enemy, t: number, L: BossLook, c: BossColors) {
    const r = en.r, ph = en.phase, hover = Math.sin(t * 1.6) * 10 - 26;
    shadow(ctx, 0, r * 1.1, r * 1.3, r * .4, .4);
    ctx.translate(0, hover);
    glow(ctx, 0, 0, r * 4, ph === 3 ? '#ff3b6b' : L.glow, .8);
    ctx.save(); ctx.rotate(t * .4);
    for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); const len = r * (1.5 + Math.sin(t * 3 + i) * .25 + (i % 2) * .3); const g = ctx.createLinearGradient(0, 0, len, 0); g.addColorStop(0, alpha(L.trim, 0)); g.addColorStop(.55, alpha(ph > 1 ? '#ff6b9a' : L.trim, .75)); g.addColorStop(1, alpha(L.trim, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(r * .9, -6); ctx.lineTo(len, 0); ctx.lineTo(r * .9, 6); ctx.fill(); }
    ctx.restore();
    circle(ctx, 0, 0, r * 1.02, c.body === '#ffffff' ? '#ffffff' : L.body);
    ctx.strokeStyle = L.trim; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 1.02, 0, TAU); ctx.stroke();
    ctx.strokeStyle = alpha(L.trim, .8); ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (.25 + i * .15), t * (2 + i) + i, t * (2 + i) + i + 2.2); ctx.stroke(); }
    const eye = ph === 3 ? '#ff3b6b' : L.eye;
    for (const s of [-1, 1]) { ellipse(ctx, s * r * .3, -r * .1, r * .14, r * .07, eye, s * .25); glow(ctx, s * r * .3, -r * .1, 22, eye, .9); }
    // Three shapes circle it: shields, crystals, feathers or moons, whatever this hero fears losing.
    for (let i = 0; i < 3; i++) {
      const a = t * .9 + i * TAU / 3, ox = Math.cos(a) * r * 1.9, oy = Math.sin(a) * r * .8;
      ctx.save(); ctx.translate(ox, oy);
      if (L.style === 'shield') { ctx.fillStyle = '#3f5a8a'; ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(10, -12); ctx.lineTo(9, 4); ctx.lineTo(0, 14); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#c9cfd8'; ctx.lineWidth = 2; ctx.stroke(); }
      else if (L.style === 'crystal') { ctx.fillStyle = '#dff6ff'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(7, 0); ctx.lineTo(0, 16); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); }
      else if (L.style === 'feathers') { ctx.rotate(t * 2 + i); ctx.fillStyle = '#1a1026'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 15, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff6b9a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke(); }
      else { ctx.fillStyle = '#f2ecd8'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); ctx.fillStyle = L.body; ctx.beginPath(); ctx.arc(5, -3, 11, 0, TAU); ctx.fill(); }
      ctx.restore(); glow(ctx, ox, oy, 26, L.trim, .7);
    }
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
    // An inked dashed ring with hatching inside, like a warning drawn in a storybook's margin.
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .62);
    const ink = mix(c, INK, hero ? .25 : .45);
    ctx.fillStyle = alpha(c, .1 + p * .12); ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
    if (this.quality > .5) { ctx.save(); ctx.clip(); ctx.strokeStyle = alpha(ink, .2 + p * .2); ctx.lineWidth = 2; ctx.beginPath(); for (let k = -z.r * 2; k < z.r * 2; k += 14) { ctx.moveTo(k, -z.r); ctx.lineTo(k + z.r, z.r); } ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = alpha(c, .28); ctx.beginPath(); ctx.arc(0, 0, z.r * p, 0, TAU); ctx.fill();
    ctx.strokeStyle = alpha(ink, .7 + p * .3); ctx.lineWidth = 2.5 + p * 1.5; ctx.setLineDash([12, 7]); ctx.lineDashOffset = -t * 50;
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
        ctx.fillStyle = '#fff8d8'; star(ctx, p.x, p.y, p.r * 1.45, 4, .38, p.spin); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
        this.lights.push({ x: p.x, y: p.y, r: 90, color: c, a: .9 });
      } else if (p.kind === 'sunfire') {
        const fl = 1 + Math.sin(t * 40) * .1;
        glow(ctx, p.x, p.y, p.r * 4 * fl, '#ff9a4a', 1);
        circle(ctx, p.x, p.y, p.r * 1.2 * fl + 1.4, INK); circle(ctx, p.x, p.y, p.r * 1.2 * fl, '#ffb347'); circle(ctx, p.x - 2, p.y - 2, p.r * .75 * fl, '#ffe38a'); circle(ctx, p.x - 3, p.y - 3, p.r * .35, '#fff6d8');
        ctx.strokeStyle = 'rgba(255,220,150,.8)'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const a = p.spin + i * TAU / 6; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * p.r * 1.2, p.y + Math.sin(a) * p.r * 1.2); ctx.lineTo(p.x + Math.cos(a) * p.r * 1.8, p.y + Math.sin(a) * p.r * 1.8); ctx.stroke(); }
        this.lights.push({ x: p.x, y: p.y, r: 200, color: '#ff9a4a', a: 1 });
      } else if (p.kind === 'thorn') {
        const a = Math.atan2(p.vy, p.vx), c = p.owner === 'hero' ? '#9fe8b0' : '#c9e07a';
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        glow(ctx, 0, 0, 16, p.owner === 'hero' ? '#9fe8b0' : '#ff9a6b', .6);
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -5); ctx.lineTo(-4, 0); ctx.lineTo(-8, 5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
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
        ctx.fillStyle = '#f2fbff'; ctx.beginPath(); ctx.moveTo(p.r * 2, 0); ctx.lineTo(-p.r * .6, -p.r * .8); ctx.lineTo(-p.r * 1.4, 0); ctx.lineTo(-p.r * .6, p.r * .8); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#9fe4ff'; ctx.beginPath(); ctx.moveTo(p.r * 2, 0); ctx.lineTo(-p.r * .6, p.r * .8); ctx.lineTo(-p.r * .2, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        this.lights.push({ x: p.x, y: p.y, r: 90, color: '#9fe4ff', a: .9 });
      } else if (p.kind === 'arrow') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        if (p.crit) glow(ctx, 0, 0, 16, '#ffd35c', .7);
        ctx.strokeStyle = 'rgba(255,245,210,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-14, 0); ctx.stroke();
        rect(ctx, -14.8, -1.8, 23.6, 3.6, INK); rect(ctx, -14, -1, 22, 2, '#c09660');
        ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
        ctx.fillStyle = '#e8ecf4'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(7, -3.5); ctx.lineTo(7, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-19, -4); ctx.lineTo(-11, 0); ctx.lineTo(-19, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'knife') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin + Math.PI / 2);
        if (p.owner === 'enemy') { ctx.scale(1.6, 1.6); glow(ctx, 0, 0, 14, '#ff8f7a', .8); }
        glow(ctx, 0, 0, 12, '#e0c8ff', .6);
        rect(ctx, -1.5, 2, 3, 5, '#3a2a26'); ctx.fillStyle = '#eef0f8'; ctx.beginPath(); ctx.moveTo(-2.5, 2); ctx.lineTo(0, -10); ctx.lineTo(2.5, 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'fire') {
        const fl = 1 + Math.sin(t * 36 + p.x) * .12, c = p.owner === 'hero' ? '#9fe8b0' : '#ff7a3d';
        glow(ctx, p.x, p.y, p.r * 3.4 * fl, c, .95);
        circle(ctx, p.x, p.y, p.r * fl + 1.3, INK); circle(ctx, p.x, p.y, p.r * fl, p.owner === 'hero' ? '#e6ffe9' : '#ff9a3d'); circle(ctx, p.x - 1.5, p.y - 1.5, p.r * .55, '#ffe38a');
        this.lights.push({ x: p.x, y: p.y, r: 80, color: c, a: .9 });
      } else if (p.kind === 'ice') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        glow(ctx, 0, 0, 20, '#8ee8ff', .8);
        ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-4, -5); ctx.lineTo(-10, 0); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
        this.lights.push({ x: p.x, y: p.y, r: 60, color: '#8ee8ff', a: .7 });
      } else {
        const c = p.owner === 'hero' ? '#9fe8b0' : '#a78bfa';
        glow(ctx, p.x, p.y, p.r * 3.4, c, .9);
        circle(ctx, p.x, p.y, p.r + 1.3, p.owner === 'hero' ? INK : '#e0d4ff'); circle(ctx, p.x, p.y, p.r, p.owner === 'hero' ? '#e6ffe9' : '#1a1030');
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
        ellipse(ctx, o.x, y + 3, 10.3, 9.3, INK); ellipse(ctx, o.x, y + 3, 9, 8, '#a8743f'); ellipse(ctx, o.x - 2, y, 4, 3, 'rgba(255,255,255,.25)');
        ctx.fillStyle = '#8a5a2f'; ctx.beginPath(); ctx.moveTo(o.x - 5, y - 4); ctx.lineTo(o.x, y - 9); ctx.lineTo(o.x + 5, y - 4); ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x - 5, y - 4); ctx.lineTo(o.x + 5, y - 4); ctx.stroke();
        ctx.globalAlpha = 1; this.lights.push({ x: o.x, y, r: big ? 110 : 60, color: c, a: .8 });
        continue;
      }
      if (o.kind === 'heart') { glow(ctx, o.x, y, 22, '#ff7a8a', .9); heart(ctx, o.x, y + 2, 9.4, INK); heart(ctx, o.x, y + 2, 8, '#ff5f74'); circle(ctx, o.x - 3, y - 2, 1.6, '#ffd1d8'); }
      else if (o.kind === 'gold') { const sq = Math.abs(Math.cos(t * 5 + o.x)); glow(ctx, o.x, y, 16, '#ffd35c', .8); ellipse(ctx, o.x, y, 6 * sq + 2.2, 7.2, INK); ellipse(ctx, o.x, y, 6 * sq + 1, 6, '#e8a93a'); ellipse(ctx, o.x, y, 4.2 * sq + .6, 4.2, '#ffe38a'); }
      else { glow(ctx, o.x, y, 18, '#7fc8ff', .9); circle(ctx, o.x, y, 5.6, INK); circle(ctx, o.x, y, 4.5, '#bfe6ff'); circle(ctx, o.x - 1.4, y - 1.4, 1.6, '#ffffff'); }
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
  /** Mira's Gravity Well: a black star with a glowing rim, and arms of starlight spiralling into it. */
  private drawWell(ctx: CanvasRenderingContext2D, w: Well) {
    const t = this.time, k = Math.min(1, w.t * 3, (w.max - w.t) * 5), R = 160;
    ctx.save(); ctx.translate(w.x, w.y); ctx.scale(1, .62); ctx.globalAlpha = k;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(10,4,24,.85)'); g.addColorStop(.18, 'rgba(40,20,90,.6)'); g.addColorStop(.6, 'rgba(106,75,214,.18)'); g.addColorStop(1, 'rgba(179,156,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,255,.55)'; ctx.lineWidth = 2; ctx.setLineDash([10, 12]); ctx.lineDashOffset = t * 50;
    ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = i % 2 ? 'rgba(255,241,184,.5)' : 'rgba(179,156,255,.7)'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let s = 0; s <= 24; s++) { const f = s / 24, r = R * (1 - f) * .95, a = -t * 3 + i * TAU / 4 + f * 4.2; s ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.stroke();
    }
    circle(ctx, 0, 0, 16 + Math.sin(t * 9) * 2, '#08030f');
    ctx.strokeStyle = 'rgba(255,241,184,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(t * 9) * 2, 0, TAU); ctx.stroke();
    ctx.restore();
    glow(ctx, w.x, w.y, 70, '#b39cff', .5 * k);
    this.lights.push({ x: w.x, y: w.y, r: 220, color: '#b39cff', a: .7 * k });
  }
  /** Riven's Death Marks counting down over their targets, Lyra's Blizzards swirling over the ground, and Mira's
   *  Guardian Stars circling her. */
  private drawSpellMarks(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time, h = e.hero;
    if (h.orbitN > 0 && h.orbitT > 0) {
      const fade = Math.min(1, h.orbitT * 2);
      for (let i = 0; i < h.orbitN; i++) {
        const p = e.starPos(i);
        for (let j = 1; j <= 5; j++) { const q = e.starPos(i - j * .06); circle(ctx, q.x, q.y, 5.5 - j * .8, `rgba(255,227,138,${(.6 - j * .1) * fade})`); }
        glow(ctx, p.x, p.y, 34, '#ffe38a', fade);
        ctx.fillStyle = `rgba(255,214,92,${fade})`; star(ctx, p.x, p.y, 11 + Math.sin(t * 8 + i) * 1.5, 5, .45, t * 3 + i); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${fade})`; star(ctx, p.x, p.y, 6, 5, .45, t * 3 + i); ctx.fill();
        this.lights.push({ x: p.x, y: p.y, r: 80, color: '#ffe38a', a: .7 * fade });
      }
    }
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
        ellipse(ctx, 0, 0, p.size, p.size * .45, p.color); if (rich && p.size > 4) { ctx.strokeStyle = 'rgba(47,35,48,.4)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-p.size * .8, 0); ctx.lineTo(p.size * .8, 0); ctx.stroke(); } ctx.restore();
      } else if (p.kind === 'smoke') { ctx.globalAlpha = k * .5; circle(ctx, p.x, p.y, p.size * (1 + (1 - k) * 1.6), p.color); }
      else if (p.kind === 'shard') {
        // A scrap of paper tumbling: it shows its darker back as it flips.
        const flip = Math.cos(p.rot * 1.7);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, flip * .8 + (flip >= 0 ? .2 : -.2));
        ctx.fillStyle = flip >= 0 || !p.color.startsWith('#') ? p.color : shade(p.color, -.25);
        ctx.beginPath(); ctx.moveTo(-p.size * .6, -p.size * .4); ctx.lineTo(p.size * .6, -p.size * .2); ctx.lineTo(-p.size * .1, p.size * .5); ctx.closePath(); ctx.fill(); ctx.restore();
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
      ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText(f.text, f.x, f.y);
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
      // Below full detail only the bigger lights (lamps, fires, the hero) get a coloured halo, not every firefly.
      if (!li.color || n >= most || (this.quality < 1 && li.r < 70)) continue;
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
    if (e.cineFade > 0) { ctx.fillStyle = `rgba(4,6,12,${Math.min(1, e.cineFade)})`; ctx.fillRect(0, 0, w, h); }
  }
  /**
   * The minimap: its card frame is painted once, and the map, fog and markers ten times a second into a canvas a little
   * larger than the window. Every frame that canvas is slid under the window by how far the hero has walked since, so the
   * map still glides with them, and the hero's arrow is drawn on top as it is.
   */
  private mini = { c: document.createElement('canvas'), frame: document.createElement('canvas'), key: '', frameKey: '', beat: -1, cx: 0, cy: 0 };
  private drawMinimap(ctx: CanvasRenderingContext2D, w: number, sh: number, e: GameEngine) {
    const small = w < 640 || sh < 520, MW = small ? 128 : 190, MH = small ? 96 : 140, span = 2800, S = MW / span;
    const x0 = w - MW - (small ? 8 : 14), y0 = small ? 54 : 64, h = e.hero, m = this.mini, dpr = Math.max(1, ctx.getTransform().a), PAD = 24;
    // The card behind the map, and the key hint under it.
    const frameKey = `${MW}|${MH}|${dpr}|${this.touch}`, FL = 8, FT = 8, FW = MW + 22, FH = MH + 34;
    if (m.frameKey !== frameKey && fontsReady()) {
      const f = m.frame; f.width = Math.ceil(FW * dpr); f.height = Math.ceil(FH * dpr);
      const g = f.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, FL * dpr, FT * dpr);
      g.fillStyle = 'rgba(18,10,20,.5)'; g.beginPath(); g.roundRect(-3, -2, MW + 12, MH + 12, 12); g.fill();
      g.fillStyle = INK; g.beginPath(); g.roundRect(-6.5, -6.5, MW + 13, MH + 13, 13); g.fill();
      g.fillStyle = PAPER; g.beginPath(); g.roundRect(-5, -5, MW + 10, MH + 10, 12); g.fill();
      if (!this.touch) { g.font = `800 10px ${UI}`; g.textAlign = 'right'; g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = INK; g.strokeText('M · map', MW, MH + 18); g.fillStyle = PAPER; g.fillText('M · map', MW, MH + 18); }
      m.frameKey = frameKey;
    }
    if (m.frameKey === frameKey) ctx.drawImage(m.frame, x0 - FL, y0 - FT, m.frame.width / dpr, m.frame.height / dpr);
    // The map itself, redrawn on a beat or when the hero has nearly walked off the canvas's margin.
    const CW = MW + PAD * 2, CH = MH + PAD * 2, key = `${MW}|${MH}|${dpr}`, beat = Math.floor(this.time * 10);
    if (m.key !== key || m.beat !== beat || Math.abs(h.x - m.cx) * S > PAD * .8 || Math.abs(h.y - m.cy) * S > PAD * .8) {
      const c = m.c; if (m.key !== key) { c.width = Math.ceil(CW * dpr); c.height = Math.ceil(CH * dpr); }
      const g = c.getContext('2d')!, map = worldMapCanvas(e.world), MS = MAP_SCALE, vx = h.x - (CW / S) / 2, vy = h.y - (CH / S) / 2;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = MAP_PAPER; g.fillRect(0, 0, CW, CH);
      g.drawImage(map, vx * MS, vy * MS, (CW / S) * MS, (CH / S) * MS, 0, 0, CW, CH);
      drawFog(g, e, -vx * S, -vy * S, S);
      drawMapMarkers(g, e, p => ({ x: (p.x - vx) * S, y: (p.y - vy) * S }), 1, this.time, vx - 40, vx + CW / S + 40, vy - 40, vy + CH / S + 40, false);
      m.key = key; m.beat = beat; m.cx = h.x; m.cy = h.y;
    }
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x0, y0, MW, MH, 8); ctx.clip();
    ctx.drawImage(m.c, x0 - PAD - (h.x - m.cx) * S, y0 - PAD - (h.y - m.cy) * S, CW, CH);
    heroArrow(ctx, e, x0 + MW / 2, y0 + MH / 2, 1);
    ctx.restore();
    ctx.strokeStyle = MAP_INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(x0, y0, MW, MH, 8); ctx.stroke();
  }
}

// ───────────────────────────── world map (shared by the minimap and the full map screen)
const MAP_SCALE = .08;
/** The parchment the map is drawn on, and its ink. */
const MAP_PAPER = '#efe0c0', MAP_INK = '#3b2a2f';
let mapCache: { world: WorldDefinition; c: HTMLCanvasElement } | null = null;
function worldMapCanvas(world: WorldDefinition) {
  if (mapCache?.world === world) return mapCache.c;
  const S = MAP_SCALE;
  const c = document.createElement('canvas'); c.width = Math.ceil(world.width * S); c.height = Math.ceil(world.height * S);
  const m = c.getContext('2d')!;
  // A map painted onto parchment: each land in its own washed-out colours, inked like an old storybook map.
  for (const r of world.regions) {
    const p = r.palette, wash = mix(p.ground, MAP_PAPER, .42);
    m.fillStyle = wash; m.fillRect(r.x0 * S, 0, (r.x1 - r.x0) * S + 1, c.height);
    for (let y = 0; y < world.height; y += 160) for (let x = r.x0; x < r.x1; x += 160) { const n = fbm(x + 777, y, r.chapter * 31); if (n > .55) { m.fillStyle = alpha(mix(p.alternate, MAP_PAPER, .35), .8); m.beginPath(); m.arc((x + 80) * S, (y + 80) * S, 120 * S, 0, TAU); m.fill(); } }
  }
  m.globalAlpha = .5; m.fillStyle = grainPattern(m); m.fillRect(0, 0, c.width, c.height); m.globalAlpha = 1;
  m.lineCap = 'round'; m.lineJoin = 'round';
  for (const pd of world.ponds) {
    const p = regionOf(world, pd.x).palette;
    m.fillStyle = mix(p.water, MAP_PAPER, .25); m.beginPath(); m.ellipse(pd.x * S, pd.y * S, pd.r * S, pd.r * .58 * S, 0, 0, TAU); m.fill();
    m.strokeStyle = MAP_INK; m.lineWidth = 1.2; m.stroke();
    m.strokeStyle = alpha(MAP_INK, .45); m.lineWidth = .8;
    for (let i = -1; i <= 1; i++) { const y = pd.y * S + i * pd.r * S * .22, x = pd.x * S - pd.r * S * .3; m.beginPath(); m.moveTo(x, y); m.quadraticCurveTo(x + pd.r * S * .15, y - 2, x + pd.r * S * .3, y); m.quadraticCurveTo(x + pd.r * S * .45, y + 2, x + pd.r * S * .6, y); m.stroke(); }
  }
  // Roads as dashed ink.
  m.setLineDash([4, 3]); m.lineWidth = 2;
  for (const r of world.roads) { m.strokeStyle = alpha(shade(regionOf(world, r[0].x).palette.pathEdge, -.35), .85); m.beginPath(); r.forEach((pt, i) => i ? m.lineTo(pt.x * S, pt.y * S) : m.moveTo(pt.x * S, pt.y * S)); m.stroke(); }
  m.setLineDash([]);
  // Trees as little inked puffs, rocks and cliffs as peaks, houses as tiny roofs.
  for (const o of world.obstacles) {
    const p = regionOf(world, o.x).palette, x = o.x * S, y = o.y * S;
    if (o.kind === 'tree' || o.kind === 'bush' || o.kind === 'mushroom') { const r = Math.max(1.4, o.r * S * 1.1); m.fillStyle = mix(p.foliage[1], MAP_PAPER, .25); m.beginPath(); m.arc(x, y, r, 0, TAU); m.fill(); m.strokeStyle = alpha(MAP_INK, .7); m.lineWidth = .7; m.stroke(); }
    else if (o.kind === 'pine' || o.kind === 'deadtree') { const r = Math.max(1.6, o.r * S * 1.2); m.fillStyle = mix(p.foliage[0], MAP_PAPER, .2); m.beginPath(); m.moveTo(x - r, y + r * .6); m.lineTo(x, y - r * 1.2); m.lineTo(x + r, y + r * .6); m.closePath(); m.fill(); m.strokeStyle = alpha(MAP_INK, .7); m.lineWidth = .7; m.stroke(); }
    else if (o.kind === 'rock' || o.kind === 'crystal' || o.kind === 'cliff') { const r = Math.max(1.5, o.r * S * (o.kind === 'cliff' ? 1.7 : 1.1)); m.fillStyle = mix(p.rock.startsWith('#') ? p.rock : '#8c8f80', MAP_PAPER, .3); m.beginPath(); m.moveTo(x - r, y + r * .5); m.lineTo(x - r * .2, y - r); m.lineTo(x + r * .3, y - r * .3); m.lineTo(x + r, y + r * .5); m.closePath(); m.fill(); m.strokeStyle = alpha(MAP_INK, .75); m.lineWidth = .8; m.stroke(); }
  }
  for (const o of world.obstacles) if (o.kind === 'house' || o.kind === 'manor' || o.kind === 'windmill' || o.kind === 'tower' || o.kind === 'tent') {
    const s = o.kind === 'manor' ? 10 : 7, x = o.x * S, y = o.y * S;
    m.fillStyle = regionOf(world, o.x).palette.wall; m.fillRect(x - s / 2, y - s * .3, s, s * .6);
    m.fillStyle = regionOf(world, o.x).palette.roof[0]; m.beginPath(); m.moveTo(x - s * .65, y - s * .25); m.lineTo(x, y - s * .85); m.lineTo(x + s * .65, y - s * .25); m.closePath(); m.fill();
    m.strokeStyle = MAP_INK; m.lineWidth = .8; m.strokeRect(x - s / 2, y - s * .3, s, s * .6); m.stroke();
  }
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
      img.data[i] = 236; img.data[i + 1] = 222; img.data[i + 2] = 188; img.data[i + 3] = inside && e.explored[(y - 1) * cols + x - 1] ? 0 : 240;
    }
    g.putImageData(img, 0, 0); f.v = e.exploredVersion;
  }
  const C = EXPLORE_CELL * S;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(f.c, ox - C, oy - C, (cols + 2) * C, (rows + 2) * C);
}
const seen = (e: GameEngine, p: Point) => { const cx = Math.floor(p.x / EXPLORE_CELL), cy = Math.floor(p.y / EXPLORE_CELL); return !!e.explored[cy * e.exploreCols + cx]; };
/** Chests, keys, people, creatures and quest goals on a map; only those between x0…x1 and y0…y1 are drawn, and the
 *  hero's own arrow unless `hero` is false. */
function drawMapMarkers(ctx: CanvasRenderingContext2D, e: GameEngine, P: (p: Point) => Point, size: number, t: number, x0 = -Infinity, x1 = Infinity, y0 = -Infinity, y1 = Infinity, hero = true) {
  const dot = (p: Point, r: number, c: string) => { const q = P(p); circle(ctx, q.x, q.y, (r + .9) * size, MAP_INK); circle(ctx, q.x, q.y, r * size, c); };
  const inside = (p: Point) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
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
  const h = e.hero; if (!hero || !inside(h)) return;
  const q = P(h); heroArrow(ctx, e, q.x, q.y, size);
}
/** The hero on a map: a white arrow pointing the way they face. */
function heroArrow(ctx: CanvasRenderingContext2D, e: GameEngine, x: number, y: number, size: number) {
  const h = e.hero, ha = Math.atan2(h.faceY, h.faceX);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ha); ctx.scale(size, size);
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
  ctx.strokeStyle = alpha(MAP_INK, .4); ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
  for (const r of world.regions.slice(1)) { const q = P({ x: r.x0, y: 0 }); ctx.beginPath(); ctx.moveTo(q.x, oy); ctx.lineTo(q.x, oy + mh); ctx.stroke(); }
  ctx.setLineDash([]);
  const labels = S * 140 >= 9;
  if (labels) for (const poi of world.pois) {
    if (!inView(poi)) continue;
    const q = P(poi), known = e.discovered.has(poi.id);
    if (!known && !seen(e, poi)) { ctx.fillStyle = alpha(MAP_INK, .35); ctx.font = `900 14px ${UI}`; ctx.fillText('?', q.x, q.y + 5); continue; }
    const big = poi.kind === 'city';
    ctx.font = `${big ? 900 : 700} ${Math.round(clamp(S * (big ? 190 : 140), 10, big ? 20 : 16))}px ${DISPLAY}`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = alpha(MAP_PAPER, .9); ctx.strokeText(poi.name, q.x, q.y - 10); ctx.fillStyle = big ? '#6a2a1a' : known ? MAP_INK : alpha(MAP_INK, .6); ctx.fillText(poi.name, q.x, q.y - 10);
  }
  // Each land's name across its top, bigger when zoomed out.
  for (const r of world.regions) {
    const q = P({ x: (r.x0 + r.x1) / 2, y: 0 }), size = Math.round(clamp(S * 420, 13, 26));
    if (q.x < -300 || q.x > w + 300) continue;
    ctx.font = `900 ${size}px ${DISPLAY}`; ctx.lineWidth = 4; ctx.strokeStyle = alpha(MAP_PAPER, .92);
    const y = Math.max(oy, 0) + size + 8;
    ctx.strokeText(r.title, q.x, y); ctx.fillStyle = '#7a3322'; ctx.fillText(r.title, q.x, y);
    ctx.font = `800 ${Math.max(10, size * .5)}px ${UI}`; ctx.strokeText(`Chapter ${r.chapter} · Lv ${r.levels[0]}–${r.levels[1]}`, q.x, y + size * .75); ctx.fillStyle = alpha(MAP_INK, .75); ctx.fillText(`Chapter ${r.chapter} · Lv ${r.levels[0]}–${r.levels[1]}`, q.x, y + size * .75);
  }
  drawMapMarkers(ctx, e, P, clamp(S * 18, .9, 1.5), t);
  ctx.restore();
  ctx.strokeStyle = MAP_INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(ox, oy, mw, mh, 14); ctx.stroke();
}
