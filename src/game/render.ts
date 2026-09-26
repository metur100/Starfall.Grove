import type { Enemy, GameEngine, Hazard, Particle } from './engine';
import type { Decor, Obstacle, Point, WorldObject } from './types';
import { LEVEL_SPELL, SPELLS } from './spells';

type AmbientKind = 'petal' | 'leaf' | 'firefly' | 'mote' | 'snow' | 'butterfly';
type Ambient = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; rot: number; vr: number; kind: AmbientKind; color: string; phase: number };
type Light = { x: number; y: number; r: number; color?: string; a: number };

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const DISPLAY = 'Cinzel, Georgia, serif';
const UI = 'Nunito, "Trebuchet MS", sans-serif';

/** Converts '#rrggbb' or 'rgba(...)' to the same colour with a new alpha. */
function alpha(c: string, a: number) {
  if (c.startsWith('#')) {
    const n = c.length === 4 ? c.slice(1).split('').map(x => parseInt(x + x, 16)) : [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    return `rgba(${n[0]},${n[1]},${n[2]},${a})`;
  }
  const m = c.match(/[\d.]+/g); if (!m) return c;
  return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
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
function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = .25) { ellipse(ctx, x, y, rx, ry, `rgba(12,20,16,${a})`); }
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y + s * .35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * .35, x - s * .45, y - s * 1.05, x, y - s * .45);
  ctx.bezierCurveTo(x + s * .45, y - s * 1.05, x + s * 1.1, y - s * .35, x, y + s * .35); ctx.fill();
}

export class Renderer {
  private cam = { x: 0, y: 0, ready: false };
  private fox = { x: 0, y: 0, vx: 0, flip: 1 };
  private ambient: Ambient[] = [];
  private lights: Light[] = [];
  private lightCanvas = document.createElement('canvas');
  private minimap: HTMLCanvasElement | null = null;
  private minimapId = '';
  private shooting = { t: 2, x: 0, y: 0, vx: 0, vy: 0, life: 0 };
  private reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private wind = 1;
  private time = 0;

  render(ctx: CanvasRenderingContext2D, w: number, h: number, e: GameEngine, time: number, dt: number) {
    this.time = time;
    const scale = w < 640 ? .72 : w < 960 ? .85 : 1;
    const vw = w / scale, vh = h / scale, world = e.world, hero = e.hero;
    this.wind = .75 + Math.sin(time * .35) * .35 + Math.sin(time * 1.3) * .1;
    // Smooth camera with a little look-ahead.
    const tx = clamp(hero.x + hero.vx * .28 - vw / 2, 0, Math.max(0, world.width - vw));
    const ty = clamp(hero.y + hero.vy * .28 - vh / 2, 0, Math.max(0, world.height - vh));
    if (!this.cam.ready || Math.hypot(tx - this.cam.x, ty - this.cam.y) > 900) { this.cam.x = tx; this.cam.y = ty; this.cam.ready = true; this.fox.x = hero.x - 40; this.fox.y = hero.y + 10; }
    const k = Math.min(1, dt * 5);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    const shake = e.shake * (this.reduced ? .25 : 1);
    const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake;
    const camX = this.cam.x, camY = this.cam.y;
    const view = { x: camX, y: camY, w: vw, h: vh };
    this.lights = [];

    ctx.save();
    ctx.scale(scale, scale); ctx.translate(-camX + sx, -camY + sy);
    this.drawGround(ctx, e, view);
    this.drawPonds(ctx, e, view);
    this.drawDecor(ctx, e, view);
    for (const z of e.hazards) this.drawHazardGround(ctx, z);
    this.drawChargeLines(ctx, e);

    const draws: Array<{ y: number; run: () => void }> = [];
    const inView = (x: number, y: number, m = 120) => x > camX - m && x < camX + vw + m && y > camY - m - 60 && y < camY + vh + m;
    for (const o of world.obstacles) if (inView(o.x, o.y)) draws.push({ y: o.y + o.r * .5, run: () => this.drawObstacle(ctx, o, e) });
    for (const o of e.getObjects()) if (inView(o.x, o.y, 200)) draws.push({ y: o.y + 10, run: () => this.drawObject(ctx, o, e) });
    for (const p of e.pods) if (!p.dead && inView(p.x, p.y)) draws.push({ y: p.y + 12, run: () => this.drawPod(ctx, p.x, p.y, e) });
    for (const en of e.enemies) if (!en.dead && inView(en.x, en.y, 160)) draws.push({ y: en.y + en.r * .7, run: () => this.drawEnemy(ctx, en, e) });
    this.updateFox(e, dt);
    draws.push({ y: this.fox.y + 8, run: () => this.drawFox(ctx, e) });
    draws.push({ y: hero.y + 22, run: () => this.drawHero(ctx, e) });
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.run();

    this.drawOrbs(ctx, e);
    this.drawProjectiles(ctx, e);
    for (const z of e.hazards) this.drawHazardAir(ctx, z);
    this.drawParticles(ctx, e.particles);
    this.updateAmbient(e, view, dt);
    this.drawAmbient(ctx);
    this.drawFloating(ctx, e);
    this.drawObjectiveArrow(ctx, e);
    if (world.ambient === 'petals') this.drawCloudShadows(ctx, e, view);
    ctx.restore();

    const toScreen = (p: Point) => ({ x: (p.x - camX + sx) * scale, y: (p.y - camY + sy) * scale });
    if (world.darkness > 0) this.drawLighting(ctx, w, h, e, toScreen, scale);
    if (world.ambient === 'leaves') this.drawGodRays(ctx, w, h);
    if (world.ambient === 'stars') this.drawShootingStar(ctx, w, h, dt);
    if (world.ambient === 'petals') this.drawSunGlow(ctx, w, h);
    this.drawScreenFx(ctx, w, h, e);
    this.drawMinimap(ctx, w, e);
  }

  // ───────────────────────────── ground
  private drawGround(ctx: CanvasRenderingContext2D, e: GameEngine, v: { x: number; y: number; w: number; h: number }) {
    const p = e.world.palette, t = this.time;
    ctx.fillStyle = p.ground; ctx.fillRect(v.x - 20, v.y - 20, v.w + 40, v.h + 40);
    const G = 96, sx = Math.floor(v.x / G) * G, sy = Math.floor(v.y / G) * G;
    for (let y = sy; y < v.y + v.h + G; y += G) for (let x = sx; x < v.x + v.w + G; x += G) {
      const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1, m = Math.abs(Math.sin(x * 3.1 + y * 7.7) * 9173.1) % 1;
      ctx.globalAlpha = .28; ellipse(ctx, x + 20 + n * 50, y + 24 + m * 40, 26 + n * 16, 12 + m * 8, n > .5 ? p.alternate : alpha(p.foliage[0], .5), n);
      ctx.globalAlpha = .5; circle(ctx, x + 10 + m * 70, y + 70 - n * 40, 1.4, alpha(p.foliage[2], .6));
      circle(ctx, x + 60 - n * 30, y + 14 + m * 50, 1.1, 'rgba(255,255,240,.25)');
      ctx.globalAlpha = 1;
    }
    // Winding path with soft edges and pebbles.
    const r = e.world.route;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); r.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y));
    ctx.strokeStyle = alpha(p.pathEdge, .55); ctx.lineWidth = 104; ctx.stroke();
    ctx.strokeStyle = p.pathEdge; ctx.lineWidth = 90; ctx.stroke();
    ctx.strokeStyle = p.path; ctx.lineWidth = 74; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,240,.12)'; ctx.lineWidth = 34; ctx.setLineDash([2, 38]); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i], len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let s = 0; s < len; s += 46) {
        const f = s / len, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, n = Math.sin(s * 1.7 + i * 11);
        if (x < v.x - 60 || x > v.x + v.w + 60 || y < v.y - 60 || y > v.y + v.h + 60) continue;
        ellipse(ctx, x + n * 26, y + Math.cos(s + i) * 20, 5 + Math.abs(n) * 4, 3 + Math.abs(n) * 2, alpha(p.pathEdge, .7));
        ellipse(ctx, x + n * 26 - 1, y + Math.cos(s + i) * 20 - 1, 3 + Math.abs(n) * 2, 1.6, 'rgba(255,255,240,.25)');
      }
    }
    ctx.textAlign = 'center';
    for (const z of e.world.zoneLabels) {
      if (Math.abs(z.x - (v.x + v.w / 2)) > v.w || Math.abs(z.y - (v.y + v.h / 2)) > v.h) continue;
      ctx.font = `700 22px ${DISPLAY}`;
      ctx.fillStyle = 'rgba(10,20,15,.18)'; ctx.fillText(z.name.toUpperCase(), z.x + 2, z.y + 2);
      ctx.fillStyle = `rgba(255,250,225,${.26 + Math.sin(t * 1.5 + z.x) * .05})`; ctx.fillText(z.name.toUpperCase(), z.x, z.y);
    }
  }
  private drawPonds(ctx: CanvasRenderingContext2D, e: GameEngine, v: { x: number; y: number; w: number; h: number }) {
    const p = e.world.palette, t = this.time, summit = e.world.ambient === 'stars';
    for (const [pi, pond] of e.world.ponds.entries()) {
      if (pond.x + pond.r < v.x - 40 || pond.x - pond.r > v.x + v.w + 40 || pond.y + pond.r < v.y - 40 || pond.y - pond.r > v.y + v.h + 40) continue;
      ellipse(ctx, pond.x + 4, pond.y + 10, pond.r * 1.1, pond.r * .66, 'rgba(20,35,28,.22)');
      ellipse(ctx, pond.x, pond.y, pond.r * 1.05, pond.r * .62, alpha(p.pathEdge, .9));
      const g = ctx.createRadialGradient(pond.x - pond.r * .2, pond.y - pond.r * .15, 5, pond.x, pond.y, pond.r);
      g.addColorStop(0, p.water); g.addColorStop(1, p.waterDeep);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(pond.x, pond.y, pond.r, pond.r * .58, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(pond.x, pond.y, pond.r, pond.r * .58, 0, 0, TAU); ctx.clip();
      // shimmering bands
      for (let i = 0; i < 5; i++) {
        const yy = pond.y - pond.r * .4 + i * pond.r * .2, off = Math.sin(t * .8 + i * 1.3 + pi) * pond.r * .3;
        ctx.strokeStyle = `rgba(255,255,255,${.07 + Math.sin(t * 1.4 + i) * .04})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pond.x - pond.r * .5 + off, yy); ctx.quadraticCurveTo(pond.x + off, yy - 5, pond.x + pond.r * .5 + off, yy); ctx.stroke();
      }
      // ripples
      for (let k = 0; k < 3; k++) {
        const ph = (t * .3 + k / 3 + pi * .17) % 1, cx = pond.x + Math.sin(pi * 3 + k * 2.1) * pond.r * .35, cy = pond.y + Math.cos(pi * 2 + k * 1.7) * pond.r * .2;
        ctx.strokeStyle = `rgba(230,250,255,${(1 - ph) * .35})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, 6 + ph * 46, 3 + ph * 20, 0, 0, TAU); ctx.stroke();
      }
      // twinkles
      for (let i = 0; i < (summit ? 16 : 7); i++) {
        const a = Math.max(0, Math.sin(t * 2.6 + i * 1.9 + pi)), x = pond.x + Math.sin(i * 7.3 + pi) * pond.r * .75, y = pond.y + Math.cos(i * 4.1) * pond.r * .4;
        if (a > .3) { ctx.fillStyle = `rgba(255,255,255,${a * .8})`; star(ctx, x, y, 2 + a * 3); ctx.fill(); }
      }
      ctx.restore();
      if (!summit) for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + pi, x = pond.x + Math.cos(a) * pond.r * .6, y = pond.y + Math.sin(a) * pond.r * .3 + Math.sin(t * 1.2 + i) * 2;
        ctx.fillStyle = '#5f9a4c'; ctx.beginPath(); ctx.ellipse(x, y, 13, 7, a, .3, TAU - .1); ctx.lineTo(x, y); ctx.fill();
        if (i % 2 === 0) { circle(ctx, x + 2, y - 2, 3.4, '#f2a1b8'); circle(ctx, x + 2, y - 2, 1.4, '#fff2a1'); }
      }
      ctx.strokeStyle = 'rgba(240,250,220,.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(pond.x, pond.y, pond.r, pond.r * .58, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      if (summit) this.lights.push({ x: pond.x, y: pond.y, r: pond.r * 1.1, color: p.water, a: .5 });
    }
  }
  private drawDecor(ctx: CanvasRenderingContext2D, e: GameEngine, v: { x: number; y: number; w: number; h: number }) {
    const p = e.world.palette, t = this.time, hero = e.hero, w = this.wind;
    for (const d of e.world.decor) {
      if (d.x < v.x - 30 || d.x > v.x + v.w + 30 || d.y < v.y - 30 || d.y > v.y + v.h + 40) continue;
      let sway = Math.sin(t * 1.9 + d.x * .013 + d.y * .007) * .2 * w + Math.sin(t * 4.3 + d.seed * 30) * .04;
      const dx = d.x - hero.x, dy = d.y - hero.y;
      if (Math.abs(dx) < 42 && Math.abs(dy) < 28) sway += Math.sign(dx || 1) * (1 - Math.abs(dx) / 42) * .9;
      this.drawDecorItem(ctx, d, sway, p.foliage, t);
      if ((d.kind === 'shroom' || d.kind === 'shard') && e.world.darkness > 0) this.lights.push({ x: d.x, y: d.y - 6, r: 34, color: d.color, a: .55 + Math.sin(t * 2 + d.seed * 9) * .2 });
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
    } else if (d.kind === 'pebble') {
      ellipse(ctx, x, y, 4 + d.seed * 3, 2.5 + d.seed * 1.5, 'rgba(60,60,55,.35)');
      ellipse(ctx, x - .5, y - 1, 3 + d.seed * 2, 1.6 + d.seed, 'rgba(230,225,210,.35)');
    } else if (d.kind === 'shroom') {
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 1.5, y - 7, 3, 7);
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.ellipse(x + Math.sin(sway) * 2, y - 7, 6, 4, 0, Math.PI, TAU); ctx.fill();
      glow(ctx, x, y - 6, 14, d.color, .25 + Math.sin(t * 2 + d.seed * 9) * .1);
    } else if (d.kind === 'shard') {
      const g = .6 + Math.sin(t * 2.2 + d.seed * 20) * .3;
      ctx.fillStyle = alpha(d.color, .85); ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 1, y - 12 - d.seed * 6); ctx.lineTo(x + 3, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(x - 1, y - 2); ctx.lineTo(x - 1, y - 10 - d.seed * 5); ctx.lineTo(x + 1, y - 2); ctx.fill();
      glow(ctx, x, y - 6, 16, d.color, .3 * g);
    }
  }

  // ───────────────────────────── obstacles
  private drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, e: GameEngine) {
    const p = e.world.palette, t = this.time, { x, y, r } = o;
    const sway = (Math.sin(t * 1.15 + o.seed * 40) * .6 + Math.sin(t * 2.7 + o.seed * 13) * .25) * this.wind;
    const hero = e.hero;
    // Canopies fade when Mira walks behind them so she never gets lost.
    const behind = hero.y < y + r * .3 && hero.y > y - r * 2.6 && Math.abs(hero.x - x) < r * 1.3;
    if (o.kind === 'tree') {
      shadow(ctx, x + 8, y + r * .5, r * 1.25, r * .5);
      const tg = ctx.createLinearGradient(x - r * .2, 0, x + r * .2, 0); tg.addColorStop(0, p.trunk); tg.addColorStop(1, alpha(p.trunk, .75));
      ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(x - r * .2, y + r * .5); ctx.lineTo(x - r * .12, y - r * .5); ctx.lineTo(x + r * .12, y - r * .5); ctx.lineTo(x + r * .22, y + r * .5); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = behind ? .45 : 1;
      const cx = x + sway * r * .12, cy = y - r * .95;
      const blobs: Array<[number, number, number]> = [[0, 0, 1], [-.6, .25, .72], [.62, .2, .75], [0, -.55, .74], [-.3, -.35, .6], [.35, -.3, .58]];
      for (const [bx, by, br] of blobs) circle(ctx, cx + bx * r + sway * by * -2, cy + by * r + 5, br * r, p.foliage[0]);
      for (const [bx, by, br] of blobs) circle(ctx, cx + bx * r * .95 + sway * by * -3, cy + by * r, br * r * .9, p.foliage[1]);
      for (const [bx, by, br] of blobs.slice(3)) circle(ctx, cx + bx * r - r * .12 + sway * 1.5, cy + by * r - r * .15, br * r * .55, alpha(p.foliage[2], .8));
      if (e.world.ambient === 'petals' && o.seed > .6) for (let i = 0; i < 5; i++) circle(ctx, cx + Math.cos(i * 2.4 + o.seed * 10) * r * .7, cy + Math.sin(i * 2.4) * r * .55, 2.6, i % 2 ? '#f7c5d5' : '#fff');
      if (e.world.ambient === 'leaves' && o.seed > .7) for (let i = 0; i < 4; i++) circle(ctx, cx + Math.cos(i * 2.1 + o.seed * 10) * r * .7, cy + Math.sin(i * 2.1) * r * .5, 3, '#e8a54b');
      ctx.globalAlpha = 1;
      if (Math.random() < .004 * this.wind && !this.reduced) this.spawnLeaf(cx + rand(-r, r), cy + rand(-r * .5, r * .5), e);
    } else if (o.kind === 'pine') {
      shadow(ctx, x + 6, y + r * .5, r * 1.05, r * .42);
      ctx.fillStyle = p.trunk; ctx.fillRect(x - r * .13, y - r * .2, r * .26, r * .7);
      ctx.globalAlpha = behind ? .45 : 1;
      for (let i = 0; i < 4; i++) {
        const ty = y - r * .1 - i * r * .62, wd = r * (1.15 - i * .22), sw = sway * (i + 1) * 1.6;
        ctx.fillStyle = i % 2 ? p.foliage[1] : p.foliage[0];
        ctx.beginPath(); ctx.moveTo(x - wd + sw * .5, ty); ctx.lineTo(x + sw, ty - r * 1.05); ctx.lineTo(x + wd + sw * .5, ty); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(235,240,255,.75)';
        ctx.beginPath(); ctx.moveTo(x - wd * .45 + sw * .7, ty - r * .55); ctx.lineTo(x + sw, ty - r * 1.05); ctx.lineTo(x + wd * .45 + sw * .7, ty - r * .55); ctx.quadraticCurveTo(x + sw * .8, ty - r * .45, x - wd * .45 + sw * .7, ty - r * .55); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (o.kind === 'bush') {
      shadow(ctx, x + 4, y + r * .45, r * 1.1, r * .4);
      for (let i = 0; i < 5; i++) { const s = Math.sin(t * 1.6 + i + o.seed * 9) * 1.5 * this.wind; circle(ctx, x + (i - 2) * r * .36 + s, y - r * .1 + Math.sin(i * 2) * r * .14 - (i === 2 ? r * .25 : 0), r * .5, i % 2 ? p.foliage[1] : p.foliage[0]); }
      for (let i = 0; i < 3; i++) circle(ctx, x + (i - 1) * r * .45 - 3, y - r * .35, r * .22, alpha(p.foliage[2], .7));
      if (o.seed > .5) for (let i = 0; i < 5; i++) circle(ctx, x + Math.cos(i * 2.3) * r * .7, y - r * .1 + Math.sin(i * 1.7) * r * .25, 2.6, e.world.ambient === 'petals' ? '#e0525c' : '#9fe3c9');
    } else if (o.kind === 'rock') {
      shadow(ctx, x + 6, y + r * .55, r * 1.1, r * .42);
      ctx.fillStyle = p.rock; ctx.beginPath(); ctx.moveTo(x - r, y + r * .3); ctx.lineTo(x - r * .7, y - r * .5); ctx.lineTo(x + r * .05, y - r * .95); ctx.lineTo(x + r * .85, y - r * .4); ctx.lineTo(x + r, y + r * .35); ctx.lineTo(x + r * .3, y + r * .7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(x + r * .05, y - r * .95); ctx.lineTo(x + r * .85, y - r * .4); ctx.lineTo(x + r, y + r * .35); ctx.lineTo(x + r * .3, y + r * .7); ctx.lineTo(x + r * .2, y); ctx.closePath(); ctx.fill();
      ellipse(ctx, x - r * .25, y - r * .55, r * .5, r * .2, e.world.ambient === 'stars' ? 'rgba(240,245,255,.8)' : alpha(p.foliage[2], .75), -.35);
    } else if (o.kind === 'crystal') {
      shadow(ctx, x + 4, y + r * .5, r, r * .4);
      const pulse = .7 + Math.sin(t * 1.8 + o.seed * 20) * .3;
      glow(ctx, x, y - r * .6, r * 2.2, p.accent, .35 * pulse);
      const shards: Array<[number, number, number]> = [[-.45, .9, -.3], [0, 1.5, 0], [.45, 1.05, .28]];
      for (const [ox, hgt, rot] of shards) {
        ctx.save(); ctx.translate(x + ox * r, y + r * .3); ctx.rotate(rot);
        const g = ctx.createLinearGradient(-r * .3, 0, r * .3, 0); g.addColorStop(0, '#8ee8ff'); g.addColorStop(.5, p.accent); g.addColorStop(1, '#5a4bb0');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-r * .28, 0); ctx.lineTo(-r * .22, -r * hgt); ctx.lineTo(0, -r * (hgt + .35)); ctx.lineTo(r * .22, -r * hgt); ctx.lineTo(r * .28, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(-r * .12, -2); ctx.lineTo(-r * .1, -r * hgt); ctx.lineTo(0, -r * (hgt + .3)); ctx.lineTo(0, -2); ctx.fill();
        ctx.restore();
      }
      this.lights.push({ x, y: y - r * .6, r: r * 4, color: p.accent, a: .8 * pulse });
    } else if (o.kind === 'mushroom') {
      const breathe = 1 + Math.sin(t * 1.4 + o.seed * 20) * .04;
      shadow(ctx, x + 4, y + r * .5, r * 1.1, r * .4);
      ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.moveTo(x - r * .25, y + r * .5); ctx.quadraticCurveTo(x - r * .15, y - r * .3, x - r * .18, y - r * .7); ctx.lineTo(x + r * .18, y - r * .7); ctx.quadraticCurveTo(x + r * .15, y - r * .3, x + r * .25, y + r * .5); ctx.fill();
      ctx.globalAlpha = behind ? .5 : 1;
      const capColor = o.seed > .5 ? '#b56ad6' : '#e0735a';
      glow(ctx, x, y - r * .9, r * 2.4, capColor, .3 + Math.sin(t * 2 + o.seed * 9) * .1);
      ctx.fillStyle = capColor; ctx.beginPath(); ctx.ellipse(x, y - r * .75, r * 1.15 * breathe, r * .8 * breathe, 0, Math.PI, TAU); ctx.quadraticCurveTo(x, y - r * .5, x - r * 1.15 * breathe, y - r * .75); ctx.fill();
      for (let i = 0; i < 5; i++) circle(ctx, x + Math.cos(i * 1.3 + 3.6) * r * .7, y - r * .95 + Math.sin(i * 1.3 + 3.6) * r * .25, r * .12, 'rgba(255,245,220,.85)');
      ctx.globalAlpha = 1;
      this.lights.push({ x, y: y - r * .8, r: r * 3.4, color: capColor, a: .7 });
    }
  }

  // ───────────────────────────── objects
  private drawObject(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const t = this.time, near = e.nearestObject()?.id === o.id, acc = e.world.palette.accent, env = e.world.ambient;
    const bob = Math.sin(t * 2.2 + o.x * .03) * 4, x = o.x, y = o.y;
    if (o.kind === 'npc') this.drawNpc(ctx, o, e);
    else if (o.kind === 'key') {
      // Light pillar makes objectives readable from across the map.
      const pg = ctx.createLinearGradient(0, y - 260, 0, y); pg.addColorStop(0, alpha(acc, 0)); pg.addColorStop(1, alpha(acc, .28 + Math.sin(t * 3) * .08));
      ctx.fillStyle = pg; ctx.fillRect(x - 14, y - 260, 28, 260);
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
      } else {
        ctx.fillStyle = '#fff6ff'; star(ctx, x, yy, 20, 5, .45, t * .8); ctx.fill();
        ctx.fillStyle = acc; star(ctx, x, yy, 12, 5, .45, t * .8); ctx.fill();
      }
      for (let i = 0; i < 3; i++) { const a = t * 2 + i * TAU / 3; circle(ctx, x + Math.cos(a) * 28, yy + Math.sin(a) * 10, 2.4, '#fff'); glow(ctx, x + Math.cos(a) * 28, yy + Math.sin(a) * 10, 8, acc, .8); }
      this.lights.push({ x, y: yy, r: 170, color: acc, a: 1 });
    } else if (o.kind === 'collectible') {
      const fx = x + Math.sin(t * 1.3 + o.x) * 22, fy = y - 24 + Math.sin(t * 2.6 + o.x) * 10;
      const col = env === 'petals' ? '#fff49b' : env === 'leaves' ? '#dff4ff' : '#8ee8ff';
      glow(ctx, fx, fy, 34, col, .8);
      const flap = Math.abs(Math.sin(t * (env === 'leaves' ? 9 : 22)));
      ctx.fillStyle = alpha(col, .6);
      const wing = env === 'leaves' ? 13 : 8;
      ctx.beginPath(); ctx.ellipse(fx - 6, fy - 2, wing * flap + 1, wing * .6, -.5, 0, TAU); ctx.ellipse(fx + 6, fy - 2, wing * flap + 1, wing * .6, .5, 0, TAU); ctx.fill();
      if (env === 'stars') { ctx.fillStyle = '#fff'; star(ctx, fx, fy, 7, 4, .4, t * 3); ctx.fill(); }
      else { circle(ctx, fx, fy, 4.5, '#fff8d0'); circle(ctx, fx, fy + 4, 3, col); }
      shadow(ctx, x, y + 14, 10, 4, .15);
      if (Math.random() < .12) this.pushAmbient({ x: fx, y: fy, vx: rand(-10, 10), vy: rand(5, 20), life: .8, max: .8, size: 2, rot: 0, vr: 0, kind: 'mote', color: col, phase: 0 });
      this.lights.push({ x: fx, y: fy, r: 90, color: col, a: .9 });
    } else if (o.kind === 'item') {
      shadow(ctx, x, y + 14, 16, 6, .25);
      glow(ctx, x, y - 8 + bob, 36, '#fff1b8', .45);
      const yy = y - 8 + bob;
      if (env === 'petals') {
        ctx.fillStyle = '#e8d7a0'; ctx.beginPath(); ctx.moveTo(x - 13, yy + 10); ctx.quadraticCurveTo(x - 12, yy - 14, x, yy - 14); ctx.quadraticCurveTo(x + 12, yy - 14, x + 13, yy + 10); ctx.closePath(); ctx.fill();
        circle(ctx, x + Math.sin(t * 6) * 3, yy + 11, 3.5, '#b39a5a'); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - 7, yy - 8, 3, 14);
      } else if (env === 'leaves') {
        ctx.fillStyle = '#b96b4f'; ctx.beginPath(); ctx.roundRect(x - 15, yy - 9, 30, 22, 6); ctx.fill();
        ctx.fillStyle = '#8f4f3a'; ctx.beginPath(); ctx.roundRect(x - 15, yy - 9, 30, 10, [6, 6, 2, 2]); ctx.fill();
        ctx.fillStyle = '#f0c47a'; ctx.fillRect(x - 3, yy - 2, 6, 6);
      } else {
        circle(ctx, x, yy, 13, '#c9a44c'); circle(ctx, x, yy, 9, '#9fd8ff'); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - 3, yy - 3, 4, 0, TAU); ctx.fill();
      }
      if (Math.sin(t * 3 + x) > .8) { ctx.fillStyle = '#fff'; star(ctx, x + 12, yy - 12, 5, 4, .3, t); ctx.fill(); }
      this.lights.push({ x, y: yy, r: 80, color: '#fff1b8', a: .7 });
    } else if (o.kind === 'shrine') this.drawShrine(ctx, o, e);
    else if (o.kind === 'finale') this.drawFinale(ctx, o, e);
    if (near) {
      ctx.font = `800 13px ${UI}`; ctx.textAlign = 'center';
      const label = o.name, wdt = ctx.measureText(label).width + 22;
      const ty = y + 44;
      ctx.fillStyle = 'rgba(14,20,30,.78)'; ctx.beginPath(); ctx.roundRect(x - wdt / 2, ty - 15, wdt, 24, 12); ctx.fill();
      ctx.strokeStyle = alpha(acc, .7); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff7df'; ctx.fillText(label, x, ty + 2);
    }
  }
  private drawNpc(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const t = this.time, x = o.x, y = o.y, color = o.color || '#d6a35b';
    const breathe = Math.sin(t * 2 + o.x) * 1.2, look = clamp((e.hero.x - x) / 200, -1, 1);
    shadow(ctx, x, y + 22, 20, 7);
    // robe
    const g = ctx.createLinearGradient(0, y - 10, 0, y + 22); g.addColorStop(0, color); g.addColorStop(1, alpha(color, .8));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 12, y - 6 + breathe); ctx.lineTo(x + 12, y - 6 + breathe); ctx.lineTo(x + 18, y + 22); ctx.quadraticCurveTo(x, y + 27, x - 18, y + 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x - 13, y + 5 + breathe * .5, 26, 3);
    // head
    circle(ctx, x, y - 16 + breathe, 12, '#efc5a0');
    const blink = Math.sin(t * 1.3 + o.x) > .97;
    ctx.fillStyle = '#3b2f2a';
    if (blink) ctx.fillRect(x - 6 + look * 2, y - 17 + breathe, 4, 1.2), ctx.fillRect(x + 2 + look * 2, y - 17 + breathe, 4, 1.2);
    else { circle(ctx, x - 4 + look * 2, y - 16 + breathe, 1.6, '#3b2f2a'); circle(ctx, x + 4 + look * 2, y - 16 + breathe, 1.6, '#3b2f2a'); }
    circle(ctx, x - 7, y - 11 + breathe, 2, 'rgba(230,120,110,.35)'); circle(ctx, x + 7, y - 11 + breathe, 2, 'rgba(230,120,110,.35)');
    // hat / hood
    if (o.role === 'guide') { ctx.fillStyle = '#4a5b3e'; ctx.beginPath(); ctx.ellipse(x, y - 25 + breathe, 18, 5, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 26 + breathe, 10, Math.PI, TAU); ctx.fill(); }
    else if (o.role === 'helper') { ctx.fillStyle = '#5b5480'; ctx.beginPath(); ctx.moveTo(x - 14, y - 22 + breathe); ctx.quadraticCurveTo(x + Math.sin(t) * 3, y - 58 + breathe, x + 6 + Math.sin(t * 1.3) * 5, y - 50 + breathe); ctx.lineTo(x + 14, y - 22 + breathe); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.moveTo(x - 8, y - 9 + breathe); ctx.quadraticCurveTo(x, y + 8 + breathe, x + 8, y - 9 + breathe); ctx.fill(); }
    else { ctx.fillStyle = '#a0522d'; ctx.beginPath(); ctx.arc(x - 9, y - 26 + breathe, 5, 0, TAU); ctx.arc(x + 9, y - 26 + breathe, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#6b4a3a'; ctx.beginPath(); ctx.arc(x, y - 24 + breathe, 12, Math.PI, TAU); ctx.fill(); }
    // swinging lantern
    const la = Math.sin(t * 2.2 + o.x) * .35, lx = x + 18 + Math.sin(la) * 12, ly = y + 2 + Math.cos(la) * 12;
    ctx.strokeStyle = '#4b3b32'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 16, y - 8); ctx.lineTo(lx, ly - 5); ctx.stroke();
    ctx.fillStyle = '#4b3b32'; ctx.fillRect(lx - 5, ly - 6, 10, 12); circle(ctx, lx, ly, 3.5, '#ffe38a'); glow(ctx, lx, ly, 26, '#ffcf6e', .7 + Math.sin(t * 9 + x) * .1);
    this.lights.push({ x: lx, y: ly, r: 140, color: '#ffcf6e', a: .9 });
    const mark = e.npcMarker(o);
    if (mark) {
      const my = y - 58 + Math.abs(Math.sin(t * 3.4)) * -8;
      glow(ctx, x, my, 28, mark === '?' ? '#9fe8b0' : '#ffd35c', .8);
      circle(ctx, x, my, 12, mark === '?' ? '#9fe8b0' : '#ffd35c');
      ctx.fillStyle = '#2a2f24'; ctx.font = `900 16px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(mark, x, my + 6);
    }
  }
  private drawShrine(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const t = this.time, x = o.x, y = o.y, spell = SPELLS[LEVEL_SPELL[e.world.id]], learned = e.quest.spellLearned;
    const c = spell.color, power = learned ? .45 : 1;
    ctx.save(); ctx.translate(x, y + 14); ctx.scale(1, .42);
    ctx.strokeStyle = alpha(c, .7 * power); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 62, 0, TAU); ctx.stroke();
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = t * 30; ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.rotate(t * .5); ctx.fillStyle = alpha(c, .8 * power);
    for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillRect(56, -3, 10, 6); }
    ctx.restore();
    glow(ctx, x, y - 20, 90, c, .5 * power);
    // pedestal
    ctx.fillStyle = '#6b6a60'; ctx.beginPath(); ctx.roundRect(x - 20, y - 12, 40, 30, 4); ctx.fill();
    ctx.fillStyle = '#86857a'; ctx.fillRect(x - 25, y - 16, 50, 7); ctx.fillStyle = alpha(e.world.palette.foliage[2], .8); ctx.fillRect(x - 25, y - 16, 18, 4);
    const fy = y - 44 + Math.sin(t * 2) * 6;
    if (e.world.id === 'meadow') {
      const flap = Math.sin(t * 5) * .5;
      ctx.fillStyle = '#8a3b2f'; ctx.fillRect(x - 16, fy - 2, 32, 16);
      ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x - 15, fy - 6 - flap * 4); ctx.lineTo(x - 15, fy + 10); ctx.lineTo(x, fy + 12); ctx.lineTo(x + 15, fy + 10); ctx.lineTo(x + 15, fy - 6 + flap * 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c; star(ctx, x, fy - 14, 7, 8, .5, t); ctx.fill();
    } else if (e.world.id === 'woods') {
      circle(ctx, x, fy, 14, '#3f7a4a'); circle(ctx, x - 4, fy - 4, 8, '#9fe8b0');
      for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * TAU / 3; ellipse(ctx, x + Math.cos(a) * 22, fy + Math.sin(a) * 8, 6, 3, '#9fe8b0', a); }
    } else { ctx.fillStyle = '#fff'; star(ctx, x, fy, 16, 5, .45, t); ctx.fill(); ctx.fillStyle = c; star(ctx, x, fy, 9, 5, .45, t); ctx.fill(); }
    if (!learned && Math.random() < .3) this.pushAmbient({ x: x + rand(-40, 40), y: y + rand(-5, 15), vx: 0, vy: rand(-50, -25), life: 1.2, max: 1.2, size: 2.4, rot: 0, vr: 0, kind: 'mote', color: c, phase: 0 });
    this.lights.push({ x, y: y - 30, r: 200, color: c, a: power });
  }
  private drawFinale(ctx: CanvasRenderingContext2D, o: WorldObject, e: GameEngine) {
    const t = this.time, x = o.x, y = o.y, lit = e.finaleLit, acc = e.world.palette.accent, id = e.world.id;
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
    } else {
      ctx.fillStyle = '#4a4f73'; ctx.beginPath(); ctx.ellipse(x, y + 20, 48, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6f7493'; ctx.beginPath(); ctx.ellipse(x, y + 14, 42, 12, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * .2, px = x + Math.cos(a) * 40, py = y + 14 + Math.sin(a) * 12; ctx.fillStyle = '#8f93b8'; ctx.fillRect(px - 4, py - 34, 8, 34); glow(ctx, px, py - 36, 12, acc, lit ? 1 : .3); }
      const rise = lit ? 60 + Math.sin(t) * 8 : 0;
      const sy = y - 30 - rise + Math.sin(t * 2) * 5;
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
      const f = Math.sin(t * 12 + i * 2) * 3 * size, h = (22 - i * 3) * size;
      ctx.fillStyle = i === 0 ? alpha(color, .9) : i < 3 ? 'rgba(255,190,90,.8)' : 'rgba(255,245,210,.9)';
      ctx.beginPath(); ctx.moveTo(x - (10 - i * 1.6) * size, y); ctx.quadraticCurveTo(x - 8 * size + f, y - h * .6, x + f * .6, y - h); ctx.quadraticCurveTo(x + 8 * size + f, y - h * .6, x + (10 - i * 1.6) * size, y); ctx.fill();
    }
    if (Math.random() < .3 * size) this.pushAmbient({ x: x + rand(-6, 6), y: y - 14 * size, vx: rand(-10, 10), vy: rand(-70, -40), life: .9, max: .9, size: 2, rot: 0, vr: 0, kind: 'mote', color: '#ffcf6e', phase: 0 });
  }
  private drawPod(ctx: CanvasRenderingContext2D, x: number, y: number, e: GameEngine) {
    const t = this.time, c = e.world.palette.pod, wob = Math.sin(t * 2.4 + x) * .08, pulse = .6 + Math.sin(t * 3 + y) * .4;
    shadow(ctx, x, y + 14, 18, 6);
    for (let i = -1; i <= 1; i++) ellipse(ctx, x + i * 12, y + 10, 10, 4, e.world.palette.foliage[1], i * .6);
    ctx.save(); ctx.translate(x, y + 10); ctx.rotate(wob);
    const g = ctx.createRadialGradient(-4, -20, 2, 0, -14, 20); g.addColorStop(0, '#ffffff'); g.addColorStop(.3, c); g.addColorStop(1, alpha(e.world.palette.foliage[0], 1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -15, 14, 17, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = alpha(c, .5 + pulse * .5); ctx.lineWidth = 1.5;
    for (const a of [-.5, 0, .5]) { ctx.beginPath(); ctx.ellipse(0, -15, 14 * Math.abs(Math.cos(a + 1.57)) + 2, 16, 0, -1.3, 1.3); ctx.stroke(); }
    ctx.fillStyle = e.world.palette.foliage[1]; ctx.beginPath(); ctx.moveTo(-5, -31); ctx.quadraticCurveTo(0, -38, 6, -34); ctx.lineTo(0, -30); ctx.fill();
    ctx.restore();
    glow(ctx, x, y - 5, 30, c, .35 * pulse);
    this.lights.push({ x, y: y - 5, r: 60, color: c, a: .6 });
  }

  // ───────────────────────────── characters
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
    // legs
    const step = moving ? Math.sin(t * 22) * 2.5 : 0;
    ctx.fillStyle = '#4b3025'; ctx.fillRect(-7 + step, 5, 3, 5); ctx.fillRect(5 - step, 5, 3, 5);
    // head
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
  private drawHero(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const t = this.time, h = e.hero, moving = Math.hypot(h.vx, h.vy) > 30, flip = h.faceX < -.05 ? -1 : 1;
    for (const a of e.afterimages) {
      ctx.globalAlpha = a.life / .28 * .45;
      ellipse(ctx, a.x, a.y + 4, 16, 24, '#bfe8ff'); circle(ctx, a.x, a.y - 18, 12, '#e6f7ff');
    }
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
    // cape flutters with speed and wind
    const speed = Math.min(1, Math.hypot(h.vx, h.vy) / 255), wave = Math.sin(t * 8) * (2 + speed * 4);
    ctx.fillStyle = '#7a3a52'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-20 - speed * 10, 6 + wave, -22 - speed * 14, 20 + wave * .6); ctx.lineTo(-4, 20); ctx.closePath(); ctx.fill();
    // feet
    const step = moving ? Math.sin(h.walkTime) * 5 : 0;
    ellipse(ctx, -6 + step, 21, 5, 3, '#4b3025'); ellipse(ctx, 6 - step, 21, 5, 3, '#4b3025');
    // robe
    const rg = ctx.createLinearGradient(0, -6, 0, 22); rg.addColorStop(0, '#e2805f'); rg.addColorStop(1, '#b85a44');
    ctx.fillStyle = hurtFlash ? '#ffffff' : rg; ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(13, -4); ctx.lineTo(17, 19); ctx.quadraticCurveTo(0, 25, -17, 19); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2c46a'; ctx.fillRect(-13, 5, 26, 3); circle(ctx, 0, 6.5, 2.6, '#fff1b8');
    // head + hair
    circle(ctx, 0, -17, 12.5, hurtFlash ? '#ffffff' : '#f0c8a2');
    ctx.fillStyle = '#6b3f2a'; ctx.beginPath(); ctx.moveTo(-12, -18); ctx.quadraticCurveTo(-16, -2, -8 - wave * .3, 2); ctx.lineTo(-6, -14); ctx.closePath(); ctx.fill();
    const blink = (t % 3.7) < .12;
    if (blink) { ctx.fillStyle = '#2d2420'; ctx.fillRect(3, -17, 5, 1.4); } else { circle(ctx, 5.5, -16.5, 2, '#2d2420'); circle(ctx, 6.2, -17.3, .7, '#fff'); }
    circle(ctx, 8, -11.5, 2.2, 'rgba(230,110,100,.35)');
    // wizard hat with a bouncing tip
    const tip = Math.sin(t * 3 + speed * 4) * 4 - speed * 6;
    ctx.fillStyle = '#3f5a41'; ctx.beginPath(); ctx.ellipse(0, -25, 19, 5.5, -.08, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-11, -26); ctx.quadraticCurveTo(-4, -46, -14 + tip, -54); ctx.quadraticCurveTo(4, -44, 11, -26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2c46a'; ctx.fillRect(-11, -30, 22, 3.5);
    ctx.fillStyle = '#fff1b8'; star(ctx, -14 + tip, -54, 4, 4, .4, t * 2); ctx.fill();
    // staff
    const raise = h.castTime > 0 ? h.castTime / .3 : 0, sa = -.35 - raise * .7;
    ctx.save(); ctx.translate(12, 2); ctx.rotate(sa);
    ctx.strokeStyle = '#7a5a3f'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -26); ctx.stroke();
    circle(ctx, 0, -30, 5 + raise * 2, '#fff1b8'); glow(ctx, 0, -30, 18 + raise * 26, '#ffe38a', .9);
    ctx.restore();
    circle(ctx, 11, 0, 4, '#f0c8a2');
    ctx.restore();
    const tipX = h.x + flip * (12 + Math.sin(-sa) * 30), tipY = h.y + bob + 2 - Math.cos(sa) * 30;
    if (Math.random() < .25) this.pushAmbient({ x: tipX + rand(-3, 3), y: tipY, vx: rand(-12, 12), vy: rand(-30, -10), life: .7, max: .7, size: 1.8, rot: 0, vr: 0, kind: 'mote', color: '#ffe38a', phase: 0 });
    this.lights.push({ x: h.x, y: h.y - 10, r: 300, a: 1 }, { x: tipX, y: tipY, r: 120 + raise * 120, color: '#ffe38a', a: .9 });
  }

  // ───────────────────────────── enemies
  private drawEnemy(ctx: CanvasRenderingContext2D, en: Enemy, e: GameEngine) {
    const t = this.time + en.homeX * .01, h = e.hero;
    const spawn = en.spawnT > 0 ? 1 - en.spawnT / .6 : 1;
    const look = { x: clamp((h.x - en.x) / 150, -1, 1), y: clamp((h.y - en.y) / 150, -1, 1) };
    const flash = en.hitFlash > 0;
    ctx.save(); ctx.translate(en.x, en.y); ctx.scale(spawn, spawn);
    if (en.windup > 0 && !en.boss) {
      const r = en.kind === 'gloomling' ? 80 : 0;
      if (r) { ctx.fillStyle = 'rgba(255,90,70,.12)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,140,110,.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 30; ctx.stroke(); ctx.setLineDash([]); }
    }
    const trem = en.windup > 0 ? Math.sin(t * 60) * 1.5 : 0;
    if (en.kind === 'gloomling') this.drawGloomling(ctx, en, t, look, flash, trem);
    else if (en.kind === 'thornling') this.drawThornling(ctx, en, t, look, flash, trem);
    else if (en.kind === 'wisp') this.drawWisp(ctx, en, t, look, flash);
    else if (en.kind === 'mossback') this.drawMossback(ctx, en, t, look, flash, e);
    else if (en.kind === 'brambleWarden') this.drawWarden(ctx, en, t, look, flash, e);
    else this.drawHollowStar(ctx, en, t, flash, e);
    ctx.restore();
    if (!en.boss && en.hp < en.maxHp) {
      const bw = 34; ctx.fillStyle = 'rgba(10,15,20,.65)'; ctx.beginPath(); ctx.roundRect(en.x - bw / 2 - 1, en.y - en.r - 20, bw + 2, 6, 3); ctx.fill();
      ctx.fillStyle = '#ff8f7a'; ctx.beginPath(); ctx.roundRect(en.x - bw / 2, en.y - en.r - 19, bw * Math.max(0, en.hp / en.maxHp), 4, 2); ctx.fill();
    }
    if (en.boss && !e.bossUnlocked()) this.drawSeal(ctx, en, t, e);
    if (en.kind === 'wisp' || en.kind === 'hollowStar') this.lights.push({ x: en.x, y: en.y, r: en.boss ? 260 : 90, color: '#a78bfa', a: .8 });
    if (en.boss && en.aggro) this.lights.push({ x: en.x, y: en.y, r: 180, color: '#ff8f7a', a: .4 });
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
    const g = ctx.createRadialGradient(-r * .3, -r * .4, 2, 0, 0, r * 1.2); g.addColorStop(0, flash ? '#fff' : '#9486e6'); g.addColorStop(1, flash ? '#fff' : '#3d3470');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-r, r * .1); ctx.bezierCurveTo(-r, -r * 1.2, r, -r * 1.2, r, r * .1);
    for (let i = 0; i <= 4; i++) { const px = r - i * r * .5; ctx.quadraticCurveTo(px - r * .25, r * (.75 + Math.sin(t * 8 + i) * .12), px - r * .5, r * .55); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6e5fb8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * .85); ctx.quadraticCurveTo(Math.sin(t * 3) * 6, -r * 1.3, Math.sin(t * 3) * 8, -r * 1.45); ctx.stroke();
    circle(ctx, Math.sin(t * 3) * 8, -r * 1.45, 3.5, '#ffd35c'); glow(ctx, Math.sin(t * 3) * 8, -r * 1.45, 12, '#ffd35c', .8);
    this.eyes(ctx, 0, -r * .2, r * .34, r * .24, look, t, en.aggro, en.windup > 0 ? '#ffb4a8' : undefined);
  }
  private drawThornling(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, trem: number) {
    const r = en.r, sway = Math.sin(t * 2) * .15;
    shadow(ctx, 0, r * .7, r * 1.2, r * .4);
    for (let i = -1; i <= 1; i++) { ctx.save(); ctx.translate(0, r * .45); ctx.rotate(i * .9 + sway * (i || 1)); ellipse(ctx, 0, -r * .1, r * .28, r * .8, '#5d8a3a'); ctx.restore(); }
    ctx.translate(trem, 0);
    const g = ctx.createRadialGradient(-r * .3, -r * .4, 2, 0, 0, r); g.addColorStop(0, flash ? '#fff' : '#b6d77a'); g.addColorStop(1, flash ? '#fff' : '#5c7a34');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -r * .1, r * .9, r * .85, 0, 0, TAU); ctx.fill();
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
    glow(ctx, 0, 0, r * 3.5, '#8a6ff0', .6);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 5; i >= 0; i--) circle(ctx, Math.sin(t * 6 - i * .7) * i * 1.6, i * r * .38, r * (1 - i * .14), `rgba(${120 + i * 10},${140 - i * 10},255,${.35 - i * .04})`);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(0, -2, 1, 0, 0, r); g.addColorStop(0, flash ? '#fff' : '#f1ecff'); g.addColorStop(.6, flash ? '#fff' : '#9f8cff'); g.addColorStop(1, 'rgba(90,70,200,.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -r * 1.5 + fl); ctx.quadraticCurveTo(r * 1.1, -r * .3, r * .8, r * .3); ctx.arc(0, r * .2, r * .82, 0, Math.PI); ctx.quadraticCurveTo(-r * 1.1, -r * .3, 0, -r * 1.5 + fl); ctx.fill();
    circle(ctx, -r * .3 + look.x * 2, 0, 2.6, '#1d1540'); circle(ctx, r * .3 + look.x * 2, 0, 2.6, '#1d1540');
    if (en.windup > 0) glow(ctx, 0, 0, r * 2.5, '#ffffff', .6);
  }
  private drawMossback(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, e: GameEngine) {
    const r = en.r, awake = e.bossUnlocked(), slam = en.action === 'slam' && en.actionT > .3 ? Math.sin(Math.min(1, (1.25 - en.actionT) / .95) * Math.PI * .5) : 0;
    const walk = en.aggro && !en.action ? Math.sin(t * 6) : 0;
    shadow(ctx, 0, r * .75, r * 1.35 * (1 - slam * .2), r * .5);
    ctx.translate(0, -slam * 26); ctx.scale(1 - slam * .05, 1 + slam * .1);
    for (const [lx, ph] of [[-.7, 0], [.7, Math.PI], [-.35, Math.PI], [.35, 0]] as Array<[number, number]>) ellipse(ctx, lx * r, r * .55 + Math.sin(t * 6 + ph) * walk * 3, r * .2, r * .26, '#4a5a3a');
    // head
    const hx = look.x * r * .15, hy = r * .25;
    ellipse(ctx, hx, hy, r * .42, r * .32, flash ? '#fff' : '#7d8a5a');
    const eyeC = en.phase === 2 ? '#ff6b5b' : awake ? '#ffb347' : '#3a3a30';
    if (awake) { circle(ctx, hx - r * .17, hy - 2, 4.5, eyeC); circle(ctx, hx + r * .17, hy - 2, 4.5, eyeC); glow(ctx, hx - r * .17, hy - 2, 14, eyeC, .8); glow(ctx, hx + r * .17, hy - 2, 14, eyeC, .8); }
    else { ctx.fillStyle = '#2a2a20'; ctx.fillRect(hx - r * .25, hy - 2, 9, 2); ctx.fillRect(hx + r * .1, hy - 2, 9, 2); }
    // shell
    const g = ctx.createRadialGradient(-r * .3, -r * .6, 4, 0, -r * .2, r * 1.2); g.addColorStop(0, flash ? '#fff' : '#9aa37c'); g.addColorStop(1, flash ? '#fff' : '#4d5840');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -r * .15, r * 1.12, r * .82, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(0, r * .2, -r * 1.12, -r * .1); ctx.fill();
    ctx.strokeStyle = 'rgba(40,45,30,.45)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r * .8 + i * r * .55, -r * .05); ctx.lineTo(-r * .55 + i * r * .4, -r * .7); ctx.stroke(); }
    // moss with swaying grass and mushrooms
    ellipse(ctx, 0, -r * .8, r * .8, r * .25, '#6f9a4c');
    ctx.strokeStyle = '#a3c46a'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const bx = -r * .65 + i * r * .16, s = Math.sin(t * 2.5 + i) * 4; ctx.beginPath(); ctx.moveTo(bx, -r * .82); ctx.quadraticCurveTo(bx + s * .5, -r * .95, bx + s, -r * 1.08); ctx.stroke(); }
    for (const [mx, mc] of [[-.4, '#e0735a'], [.25, '#f2d27a'], [.5, '#e0735a']] as Array<[number, string]>) { ctx.fillStyle = '#efe4c8'; ctx.fillRect(mx * r - 1.5, -r * 1.02, 3, 8); ctx.fillStyle = mc; ctx.beginPath(); ctx.arc(mx * r, -r * 1.02, 6, Math.PI, TAU); ctx.fill(); }
    if (en.phase === 2 && Math.random() < .3) this.pushAmbient({ x: en.x + rand(-r, r), y: en.y - r, vx: 0, vy: -40, life: 1, max: 1, size: 6, rot: 0, vr: 0, kind: 'mote', color: 'rgba(255,140,110,.6)', phase: 0 });
  }
  private drawWarden(ctx: CanvasRenderingContext2D, en: Enemy, t: number, look: Point, flash: boolean, e: GameEngine) {
    const r = en.r, awake = e.bossUnlocked(), raise = en.action === 'nova' ? 1 : en.action === 'roots' ? .5 : 0, sway = Math.sin(t * 1.6) * .12;
    shadow(ctx, 0, r * .8, r * 1.2, r * .45);
    ctx.strokeStyle = '#4a3522'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8, r * .5); ctx.quadraticCurveTo(i * 20, r * .7, i * 30 + Math.sin(t * 2 + i) * 3, r * .85); ctx.stroke(); }
    // arms
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * r * .5, -r * .4); ctx.rotate(s * (.9 - raise * 1.6 + sway + (en.aggro ? Math.sin(t * 4 + s) * .15 : 0)));
      ctx.strokeStyle = '#5a4130'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, r * .9); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, r * .6); ctx.lineTo(s * 12, r * 1.05); ctx.moveTo(0, r * .8); ctx.lineTo(-s * 8, r * 1.1); ctx.stroke();
      circle(ctx, 0, r * .45, 8, '#6f9a5c'); ctx.restore();
    }
    const g = ctx.createLinearGradient(-r * .6, 0, r * .6, 0); g.addColorStop(0, flash ? '#fff' : '#4a3522'); g.addColorStop(.5, flash ? '#fff' : '#7a5a3f'); g.addColorStop(1, flash ? '#fff' : '#4a3522');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-r * .6, -r * 1.1, r * 1.2, r * 1.65, [r * .5, r * .5, r * .2, r * .2]); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,10,.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r * .4 + i * r * .27, -r * .7); ctx.quadraticCurveTo(-r * .35 + i * r * .27, 0, -r * .42 + i * r * .27, r * .45); ctx.stroke(); }
    // crown of leaves and thorns
    for (let i = 0; i < 9; i++) { const a = -Math.PI + (i / 8) * Math.PI, s2 = Math.sin(t * 2 + i) * .08; ellipse(ctx, Math.cos(a + s2) * r * .62, -r * 1.05 + Math.sin(a + s2) * r * .5, r * .26, r * .16, i % 2 ? '#355c3e' : '#6f9a5c', a); }
    ctx.fillStyle = '#e6d9a0'; for (let i = 0; i < 5; i++) { const a = -Math.PI * .85 + i * Math.PI * .175; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .45 - 3, -r * 1.05 + Math.sin(a) * r * .4); ctx.lineTo(Math.cos(a) * r * .95, -r * 1.05 + Math.sin(a) * r * .9); ctx.lineTo(Math.cos(a) * r * .45 + 3, -r * 1.05 + Math.sin(a) * r * .4); ctx.fill(); }
    const eyeC = en.phase === 2 ? '#ff6b5b' : awake ? '#b6ff7a' : '#2a2018';
    for (const s of [-1, 1]) { ellipse(ctx, s * r * .22 + look.x * 3, -r * .55, 6, 4, eyeC, s * .3); if (awake) glow(ctx, s * r * .22, -r * .55, 16, eyeC, .9); }
    ctx.fillStyle = '#1e140c'; ctx.beginPath(); ctx.ellipse(0, -r * .2, r * .2, raise ? r * .18 : r * .06, 0, 0, TAU); ctx.fill();
  }
  private drawHollowStar(ctx: CanvasRenderingContext2D, en: Enemy, t: number, flash: boolean, e: GameEngine) {
    const r = en.r, awake = e.bossUnlocked();
    const fade = en.action === 'blink' && en.actionT > 1.1 ? (en.actionT - 1.1) / .3 : en.action === 'blink' && en.actionT > .9 ? 1 - (en.actionT - .9) / .2 : 1;
    ctx.globalAlpha = clamp(fade, .1, 1);
    const hover = Math.sin(t * 2) * 8 - 18;
    shadow(ctx, 0, r * .9, r * .9, r * .3, .3);
    ctx.translate(0, hover);
    glow(ctx, 0, 0, r * 3.2, en.phase === 2 ? '#ff6b9a' : '#8a6ff0', .7);
    for (let i = 0; i < 5; i++) { const a = t * 1.3 + i * TAU / 5, ox = Math.cos(a) * r * 1.5, oy = Math.sin(a) * r * .7; ctx.fillStyle = '#c9b6ff'; ctx.beginPath(); ctx.moveTo(ox, oy - 8); ctx.lineTo(ox + 4, oy); ctx.lineTo(ox, oy + 8); ctx.lineTo(ox - 4, oy); ctx.fill(); glow(ctx, ox, oy, 12, '#c9b6ff', .8); }
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 1.2); g.addColorStop(0, flash ? '#fff' : '#1a1030'); g.addColorStop(.6, flash ? '#fff' : '#3d2a78'); g.addColorStop(1, flash ? '#fff' : '#a78bfa');
    ctx.fillStyle = g; star(ctx, 0, 0, r * 1.2, 5, .5, en.angle * .4); ctx.fill();
    ctx.strokeStyle = 'rgba(230,220,255,.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#05020c'; circle(ctx, 0, 0, r * .38, '#05020c');
    ctx.strokeStyle = 'rgba(167,139,250,.9)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (.12 + i * .08), t * (3 + i) + i, t * (3 + i) + i + 2.4); ctx.stroke(); }
    if (awake) { circle(ctx, -r * .14, -r * .02, 3.5, en.phase === 2 ? '#ff6b9a' : '#e9ddff'); circle(ctx, r * .14, -r * .02, 3.5, en.phase === 2 ? '#ff6b9a' : '#e9ddff'); }
    if (en.phase === 2) { ctx.strokeStyle = '#ff9a6b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * .5, -r * .6); ctx.lineTo(-r * .2, -r * .3); ctx.lineTo(-r * .35, 0); ctx.moveTo(r * .6, r * .2); ctx.lineTo(r * .3, r * .15); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  private drawSeal(ctx: CanvasRenderingContext2D, en: Enemy, t: number, e: GameEngine) {
    const r = en.r * 1.9, c = e.world.palette.accent, found = e.quest.keys.length;
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
    const hero = z.owner === 'hero', c = hero ? '#ffe38a' : z.kind === 'meteor' ? '#c9b6ff' : '#ff6b5b';
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .62);
    ctx.fillStyle = alpha(c, .1 + p * .14); ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
    ctx.fillStyle = alpha(c, .25); ctx.beginPath(); ctx.arc(0, 0, z.r * p, 0, TAU); ctx.fill();
    ctx.strokeStyle = alpha(c, .6 + p * .4); ctx.lineWidth = 2.5 + p * 2; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 50;
    ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (z.kind === 'slam') { ctx.strokeStyle = alpha(c, .5 * p); ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * z.r * .2, Math.sin(a) * z.r * .2); ctx.lineTo(Math.cos(a + .1) * z.r * .9 * p, Math.sin(a + .1) * z.r * .9 * p); ctx.stroke(); } }
    if (z.kind === 'root' && p > .6) { ctx.fillStyle = '#6f5337'; for (let i = 0; i < 3; i++) { const a = i * 2.1; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10 - 4, Math.sin(a) * 10); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10 - 18 * (p - .6) * 2.5); ctx.lineTo(Math.cos(a) * 10 + 4, Math.sin(a) * 10); ctx.fill(); } }
    ctx.restore();
    if (z.kind === 'boulder' || z.kind === 'meteor' || z.kind === 'starfall') shadow(ctx, z.x, z.y, z.r * .5 * p, z.r * .22 * p, .35);
  }
  private drawHazardAir(ctx: CanvasRenderingContext2D, z: Hazard) {
    const p = 1 - z.delay / z.maxDelay;
    if (z.kind === 'boulder') {
      const x = z.fromX + (z.x - z.fromX) * p, y = z.fromY + (z.y - z.fromY) * p - Math.sin(p * Math.PI) * 240;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p * 9);
      ctx.fillStyle = '#7d8070'; ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(-6, -16); ctx.lineTo(12, -13); ctx.lineTo(17, 4); ctx.lineTo(6, 16); ctx.lineTo(-13, 12); ctx.closePath(); ctx.fill();
      ellipse(ctx, -4, -6, 7, 4, '#6f9a4c'); ctx.restore();
    } else if (z.kind === 'meteor' || z.kind === 'starfall') {
      const q = p * p, x = z.fromX + (z.x - z.fromX) * q, y = z.fromY + (z.y - z.fromY) * q;
      const c = z.kind === 'meteor' ? '#a78bfa' : '#ffe38a';
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
      if (en.dead || en.action !== 'charge' || en.actionT < .75) continue;
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
        const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 1.3);
        g.addColorStop(0, '#ffffff'); g.addColorStop(.4, '#ffe38a'); g.addColorStop(1, 'rgba(255,120,60,.2)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.3 * fl, 0, TAU); ctx.fill();
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
      if (o.kind === 'heart') { glow(ctx, o.x, y, 22, '#ff7a8a', .9); heart(ctx, o.x, y + 2, 8, '#ff5f74'); circle(ctx, o.x - 3, y - 2, 1.6, '#ffd1d8'); }
      else { glow(ctx, o.x, y, 18, '#7fc8ff', .9); circle(ctx, o.x, y, 4.5, '#dff2ff'); }
      ctx.globalAlpha = 1;
      this.lights.push({ x: o.x, y, r: 50, color: o.kind === 'heart' ? '#ff7a8a' : '#7fc8ff', a: .6 });
    }
  }
  private drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
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
        ellipse(ctx, 0, 0, p.size, p.size * .45, p.color); ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = k * .5; circle(ctx, p.x, p.y, p.size * (1 + (1 - k) * 1.6), p.color);
      } else if (p.kind === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * .66); ctx.restore();
        if (p.glow) glow(ctx, p.x, p.y, p.size * 3, p.color, .5 * k);
      } else if (p.kind === 'star') {
        glow(ctx, p.x, p.y, p.size * 4, p.color, k);
        ctx.fillStyle = alpha(p.color, 1); star(ctx, p.x, p.y, p.size * (.6 + k * .6), 4, .38, p.rot); ctx.fill();
      } else if (p.kind === 'ember') {
        glow(ctx, p.x, p.y, p.size * 3.5 * k + 2, p.color, k);
        circle(ctx, p.x, p.y, p.size * k * .6 + .5, '#fff6d8');
      } else {
        if (p.glow) glow(ctx, p.x, p.y, p.size * 3, p.color, k);
        circle(ctx, p.x, p.y, p.size * (.4 + k * .6), p.color);
      }
      ctx.globalAlpha = 1;
    }
    // Only the brightest particles light up the dark.
    let n = 0;
    for (const p of list) if (p.glow && p.kind !== 'ring' && n < 40 && p.life / p.max > .5) { this.lights.push({ x: p.x, y: p.y, r: p.size * 10, color: p.color, a: .5 }); n++; }
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
  private drawObjectiveArrow(ctx: CanvasRenderingContext2D, e: GameEngine) {
    const target = e.objectiveTarget(); if (!target) return;
    const h = e.hero, dx = target.x - h.x, dy = target.y - h.y, d = Math.hypot(dx, dy);
    if (d < 240) return;
    const a = Math.atan2(dy, dx), pulse = Math.sin(this.time * 4) * 6, R = 70 + pulse;
    const x = h.x + Math.cos(a) * R, y = h.y - 6 + Math.sin(a) * R * .7;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    glow(ctx, 0, 0, 22, '#ffd35c', .6);
    ctx.fillStyle = 'rgba(255,225,130,.95)'; ctx.strokeStyle = 'rgba(60,40,10,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -9); ctx.lineTo(-2, 0); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ───────────────────────────── ambience
  private pushAmbient(a: Ambient) { if (this.ambient.length < 360) this.ambient.push(a); }
  private spawnLeaf(x: number, y: number, e: GameEngine) {
    const c = e.world.ambient === 'petals' ? pick(['#f7c5d5', '#ffffff', '#a3c46a']) : pick(['#e8a54b', '#c9713d', '#a3c46a', '#f0c47a']);
    this.pushAmbient({ x, y, vx: rand(10, 40), vy: rand(20, 40), life: 6, max: 6, size: rand(3.5, 6), rot: rand(0, 6), vr: rand(-3, 3), kind: 'leaf', color: c, phase: rand(0, 6) });
  }
  private updateAmbient(e: GameEngine, v: { x: number; y: number; w: number; h: number }, dt: number) {
    const kind = e.world.ambient, area = (v.w * v.h) / (1280 * 800);
    const count = (k: AmbientKind) => { let n = 0; for (const a of this.ambient) if (a.kind === k) n++; return n; };
    const spawnTop = () => ({ x: v.x + rand(-100, v.w + 50), y: v.y + rand(-40, v.h * .6) });
    const reduce = this.reduced ? .3 : 1;
    const want: Array<[AmbientKind, number]> = kind === 'petals' ? [['petal', 34], ['butterfly', 5], ['mote', 16]] : kind === 'leaves' ? [['leaf', 26], ['firefly', 34], ['mote', 10]] : [['snow', 80], ['mote', 22]];
    for (const [k, n] of want) {
      let have = count(k);
      while (have < n * area * reduce) {
        const s = spawnTop(), c = k === 'petal' ? pick(['#f7c5d5', '#ffffff', '#ffd6e5']) : k === 'leaf' ? pick(['#e8a54b', '#c9713d', '#a3c46a']) : k === 'firefly' ? pick(['#ffe38a', '#d8ff9a']) : k === 'butterfly' ? pick(['#ffb35c', '#9fd8ff', '#f2a1b8', '#fff49b']) : k === 'snow' ? '#eef2ff' : kind === 'stars' ? pick(['#c9b6ff', '#8ee8ff']) : '#fff8c0';
        const life = rand(6, 14);
        this.ambient.push({ x: s.x, y: s.y, vx: k === 'snow' ? rand(-8, 12) : rand(10, 30), vy: k === 'snow' ? rand(18, 40) : k === 'petal' || k === 'leaf' ? rand(20, 38) : rand(-6, 6), life, max: life, size: k === 'snow' ? rand(1, 2.6) : k === 'butterfly' ? rand(5, 7) : k === 'firefly' ? rand(1.8, 2.8) : k === 'mote' ? rand(1, 2) : rand(3.5, 6), rot: rand(0, 6), vr: rand(-3, 3), kind: k, color: c, phase: rand(0, 6.28) });
        have++;
      }
    }
    const t = this.time, w = this.wind;
    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const a = this.ambient[i]; a.life -= dt;
      if (a.kind === 'petal' || a.kind === 'leaf') { a.x += (a.vx * w + Math.sin(t * 2 + a.phase) * 26) * dt; a.y += a.vy * dt; a.rot += a.vr * dt; }
      else if (a.kind === 'snow') { a.x += (a.vx + Math.sin(t + a.phase) * 10) * dt; a.y += a.vy * dt; }
      else if (a.kind === 'firefly' || a.kind === 'mote') { a.x += (a.vx * .3 + Math.sin(t * .9 + a.phase) * 18) * dt; a.y += (a.vy + Math.cos(t * 1.1 + a.phase) * 14) * dt; }
      else if (a.kind === 'butterfly') { a.x += (Math.sin(t * .5 + a.phase) * 60) * dt; a.y += (Math.cos(t * .7 + a.phase * 2) * 40) * dt; }
      const out = a.x < v.x - 160 || a.x > v.x + v.w + 160 || a.y < v.y - 160 || a.y > v.y + v.h + 120;
      if (a.life <= 0 || out) this.ambient.splice(i, 1);
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
      } else if (a.kind === 'mote') {
        glow(ctx, a.x, a.y, a.size * 5, a.color, .6 * fade); circle(ctx, a.x, a.y, a.size, a.color);
      } else if (a.kind === 'snow') {
        circle(ctx, a.x, a.y, a.size, 'rgba(238,242,255,.85)');
      } else if (a.kind === 'butterfly') {
        const flap = Math.abs(Math.sin(t * 13 + a.phase));
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.sin(t + a.phase) * .3);
        ellipse(ctx, -a.size * .5 * flap, 0, a.size * flap, a.size * .8, a.color, -.4); ellipse(ctx, a.size * .5 * flap, 0, a.size * flap, a.size * .8, a.color, .4);
        ellipse(ctx, 0, 0, 1.2, a.size * .6, '#3a2a24'); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }
  private drawCloudShadows(ctx: CanvasRenderingContext2D, e: GameEngine, v: { x: number; y: number; w: number; h: number }) {
    const t = this.time;
    for (let i = 0; i < 4; i++) {
      const x = ((t * 22 + i * 1100) % (e.world.width + 1400)) - 700, y = 300 + i * 480 + Math.sin(i * 3) * 120;
      if (x + 500 < v.x || x - 500 > v.x + v.w || y + 300 < v.y || y - 300 > v.y + v.h) continue;
      ctx.fillStyle = 'rgba(20,40,40,.07)';
      for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(x + (j - 2) * 110, y + Math.sin(j * 2 + i) * 50, 170, 90, 0, 0, TAU); ctx.fill(); }
    }
  }

  // ───────────────────────────── screen-space
  private drawLighting(ctx: CanvasRenderingContext2D, w: number, h: number, e: GameEngine, toScreen: (p: Point) => Point, scale: number) {
    const lc = this.lightCanvas, s = .5, lw = Math.ceil(w * s), lh = Math.ceil(h * s);
    if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
    const l = lc.getContext('2d')!;
    const flicker = e.flash;
    l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, lw, lh);
    l.fillStyle = e.world.ambient === 'stars' ? `rgba(8,8,32,${e.world.darkness * (1 - flicker * .7)})` : `rgba(6,20,22,${e.world.darkness * (1 - flicker * .7)})`;
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
    // Soft coloured bloom on top of the darkness.
    for (const li of this.lights) {
      if (!li.color) continue;
      const p = toScreen(li);
      if (p.x < -200 || p.x > w + 200 || p.y < -200 || p.y > h + 200) continue;
      glow(ctx, p.x, p.y, li.r * scale * .6, li.color, .12 * li.a);
    }
  }
  private drawGodRays(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = this.time;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = w * (.08 + i * .22) + Math.sin(t * .15 + i * 2) * 50, wd = 50 + (i % 3) * 30, a = .05 + Math.sin(t * .4 + i * 1.7) * .03;
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(255,236,170,${a * 1.6})`); g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + wd, 0); ctx.lineTo(x + wd - h * .35, h); ctx.lineTo(x - h * .35 - wd * .5, h); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  private drawSunGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = this.time, g = ctx.createRadialGradient(w * .85, -h * .1, 10, w * .85, -h * .1, h * .9);
    g.addColorStop(0, `rgba(255,236,170,${.22 + Math.sin(t * .5) * .04})`); g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  private drawShootingStar(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number) {
    const s = this.shooting; s.t -= dt;
    if (s.t <= 0 && s.life <= 0) { s.x = rand(w * .1, w * .9); s.y = rand(-20, h * .3); s.vx = rand(-700, -400); s.vy = rand(200, 350); s.life = .9; s.t = rand(3, 7); }
    if (s.life > 0) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * .25, s.y - s.vy * .25);
      g.addColorStop(0, `rgba(255,255,255,${s.life})`); g.addColorStop(1, 'rgba(201,182,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * .25, s.y - s.vy * .25); ctx.stroke();
      glow(ctx, s.x, s.y, 14, '#ffffff', s.life);
    }
  }
  private vignette: { w: number; h: number; g: CanvasGradient | null } = { w: 0, h: 0, g: null };
  private drawScreenFx(ctx: CanvasRenderingContext2D, w: number, h: number, e: GameEngine) {
    if (this.vignette.w !== w || this.vignette.h !== h || !this.vignette.g) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .75);
      g.addColorStop(0, 'rgba(10,14,20,0)'); g.addColorStop(1, 'rgba(10,14,20,.45)');
      this.vignette = { w, h, g };
    }
    ctx.fillStyle = this.vignette.g!; ctx.fillRect(0, 0, w, h);
    const t = this.time;
    if (e.hero.hp <= 1) {
      const a = .25 + Math.sin(t * 5) * .12, g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .7);
      g.addColorStop(0, 'rgba(200,30,40,0)'); g.addColorStop(1, `rgba(200,30,40,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (e.damageFlash > 0) { ctx.fillStyle = `rgba(255,80,60,${e.damageFlash * .5})`; ctx.fillRect(0, 0, w, h); }
    if (e.flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,245,220,${Math.min(.5, e.flash * .35)})`; ctx.fillRect(0, 0, w, h); ctx.restore(); }
    if (e.respawnFade > 0) { ctx.fillStyle = `rgba(6,8,14,${Math.min(1, e.respawnFade * 1.3)})`; ctx.fillRect(0, 0, w, h); }
  }
  private drawMinimap(ctx: CanvasRenderingContext2D, w: number, e: GameEngine) {
    const world = e.world, small = w < 640, S = small ? .036 : .05, MW = world.width * S, MH = world.height * S;
    if (!this.minimap || this.minimapId !== world.id + S) {
      const c = document.createElement('canvas'); c.width = MW; c.height = MH;
      const m = c.getContext('2d')!;
      m.fillStyle = world.palette.ground; m.fillRect(0, 0, MW, MH);
      m.strokeStyle = world.palette.path; m.lineWidth = 4 * S * 20; m.lineCap = 'round'; m.lineJoin = 'round';
      m.beginPath(); world.route.forEach((p, i) => i ? m.lineTo(p.x * S, p.y * S) : m.moveTo(p.x * S, p.y * S)); m.stroke();
      m.fillStyle = world.palette.water; for (const p of world.ponds) { m.beginPath(); m.ellipse(p.x * S, p.y * S, p.r * S, p.r * .58 * S, 0, 0, TAU); m.fill(); }
      m.fillStyle = alpha(world.palette.foliage[0], .9); for (const o of world.obstacles) { m.beginPath(); m.arc(o.x * S, o.y * S, Math.max(1.2, o.r * S * 1.2), 0, TAU); m.fill(); }
      this.minimap = c; this.minimapId = world.id + S;
    }
    const x0 = w - MW - (small ? 8 : 14), y0 = small ? 54 : 64, t = this.time;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,20,.55)'; ctx.beginPath(); ctx.roundRect(x0 - 5, y0 - 5, MW + 10, MH + 10, 10); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x0, y0, MW, MH, 6); ctx.clip();
    ctx.globalAlpha = .92; ctx.drawImage(this.minimap, x0, y0); ctx.globalAlpha = 1;
    const dot = (p: Point, r: number, c: string) => circle(ctx, x0 + p.x * S, y0 + p.y * S, r, c);
    for (const o of e.getObjects()) {
      if (o.kind === 'key') { const pulse = 2.5 + Math.sin(t * 4) * .8; glow(ctx, x0 + o.x * S, y0 + o.y * S, 9, world.palette.accent, .9); dot(o, pulse, world.palette.accent); }
      else if (o.kind === 'npc') dot(o, 2.4, e.npcMarker(o) ? '#ffd35c' : '#fff7df');
      else if (o.kind === 'shrine') dot(o, 3, e.quest.spellLearned ? '#8a8a8a' : SPELLS[LEVEL_SPELL[world.id]].color);
      else if (o.kind === 'finale') { ctx.fillStyle = '#fff1b8'; star(ctx, x0 + o.x * S, y0 + o.y * S, 4.5, 5, .45); ctx.fill(); }
      else if (o.kind === 'collectible' || o.kind === 'item') dot(o, 1.6, '#bfe8ff');
    }
    for (const en of e.enemies) if (!en.dead) { if (en.boss) { glow(ctx, x0 + en.x * S, y0 + en.y * S, 10, '#ff6b5b', .6 + Math.sin(t * 5) * .3); dot(en, 3.4, '#ff6b5b'); } else if (en.aggro) dot(en, 1.6, '#ff9a8a'); }
    const h = e.hero, ha = Math.atan2(h.faceY, h.faceX);
    ctx.translate(x0 + h.x * S, y0 + h.y * S); ctx.rotate(ha);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3.5, -3.5); ctx.lineTo(-1.5, 0); ctx.lineTo(-3.5, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(245,215,130,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x0 - 5, y0 - 5, MW + 10, MH + 10, 10); ctx.stroke();
  }
}
