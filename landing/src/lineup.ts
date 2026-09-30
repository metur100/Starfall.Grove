// The whole cast standing together on the front hill of the landing page: the same paper puppets as in the world and
// on the select screen's pedestal, drawn by the game's own rig. Each hero breathes, and now and then one shows off
// (a staff raised, a sword swung, a bow drawn); pointing at a hero makes them show off at once. Tuft sits by Mira and
// Fenn by Wren. On touch screens the puppets are re-cut 12 times a second, the stop-motion rate of the world.
import { Cutter, STICKER } from '../../src/game/art/cutout';
import { FIGURE_BOX, drawFigure, type ArmAction } from '../../src/game/art/rig';
import { heroFigure, heroHooks, staffTip } from '../../src/game/art/heroes';
import { paintFox, paintWolf } from '../../src/game/art/animals';
import { isTouch } from '../../src/game/graphics';
import type { HeroId } from '../../src/game/types';

/**
 * Left to right, each as [narrow page, wide page]: `x` the place across the page, `k` the size, `lift` how far back
 * they stand. A wide page has room for a row; on a phone they gather in a group around Mira so each can be bigger.
 */
export const CAST: Array<{ id: HeroId; x: [number, number]; k: [number, number]; lift: [number, number] }> = [
  { id: 'kael', x: [.14, .2], k: [.9, .9], lift: [40, 10] },
  { id: 'lyra', x: [.31, .35], k: [.98, .97], lift: [20, 4] },
  { id: 'mira', x: [.5, .5], k: [1.14, 1.1], lift: [0, 0] },
  { id: 'riven', x: [.69, .65], k: [.98, .97], lift: [20, 4] },
  { id: 'wren', x: [.86, .8], k: [.9, .9], lift: [40, 10] },
];
const FLOURISH: Record<HeroId, ArmAction> = { mira: 'raise', lyra: 'raise', kael: 'swing', riven: 'thrust', wren: 'draw' };
const GLOW: Record<HeroId, string> = { mira: '#ffe38a', kael: '#ffd0a0', lyra: '#bfeaff', riven: '#e0c8ff', wren: '#c8e6a0' };
/** Back to front: the outer pair, the inner pair, then Mira in the middle. */
const DRAW_ORDER = [0, 4, 1, 3, 2];
const PUPPET_FPS = 12;

export type Lineup = { place(): Array<{ id: HeroId; x: number; y: number }>; run(on: boolean): void; dispose(): void };

export function createLineup(canvas: HTMLCanvasElement, onPick: (hero: HeroId) => void): Lineup {
  const ctx = canvas.getContext('2d')!, cut = new Cutter(), lite = isTouch();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (lite) cut.quality = .7;
  let w = 1, h = 1, dpr = 1, raf = 0, drawn = 0, running = false, hover = -1, start = 0;
  // Each hero shows off on their own clock, so they never all move at once.
  const next = CAST.map((_, i) => 2 + i * 2.3 + Math.random() * 2);
  const since = CAST.map(() => -9);

  const wide = () => w >= 760;
  const scale = () => Math.min(3, h / 142, w / (wide() ? 310 : 252));
  const spot = (i: number) => {
    const s = scale(), c = CAST[i], n = wide() ? 1 : 0, k = s * c.k[n];
    return { x: w * c.x[n], y: h - 40 * s - c.lift[n] * s, k };
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(lite ? 1.5 : 2, window.devicePixelRatio || 1);
    w = Math.max(1, r.width); h = Math.max(1, r.height); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    drawn = 0; if (!running) paint(performance.now());
  };
  const at = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = Infinity;
    CAST.forEach((_, i) => { const p = spot(i), dx = Math.abs(x - p.x); if (dx < 36 * p.k && y > p.y - 84 * p.k && y < p.y + 30 * p.k && dx < bd) { bd = dx; best = i; } });
    return best;
  };
  const move = (e: PointerEvent) => {
    const i = at(e); canvas.style.cursor = i >= 0 ? 'pointer' : '';
    if (i !== hover) { hover = i; if (i >= 0 && performance.now() / 1000 - since[i] > 1.2) since[i] = performance.now() / 1000; }
  };
  const leave = () => { hover = -1; canvas.style.cursor = ''; };
  const click = (e: PointerEvent) => { const i = at(e); if (i >= 0) onPick(CAST[i].id); };
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', leave); canvas.addEventListener('pointerup', click);

  function paint(now: number) {
    const t = now / 1000; if (!start) start = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const i of DRAW_ORDER) {
      const c = CAST[i], { x, y, k } = spot(i), hero = c.id;
      if (!reduced && t - start > next[i]) { since[i] = t; next[i] = t - start + 7 + Math.random() * 6; }
      const p = (t - since[i]) / .9, acting = p >= 0 && p < 1, kk = acting ? p : 0;
      // A pool of the hero's own light on the grass, brighter under the one you point at.
      const glow = ctx.createRadialGradient(x, y + 20 * k, 0, x, y + 20 * k, 40 * k);
      glow.addColorStop(0, GLOW[hero] + (hover === i ? '88' : '44')); glow.addColorStop(1, GLOW[hero] + '00');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x, y + 20 * k, 40 * k, 13 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(20,12,22,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 21 * k, 18 * k, 6 * k, 0, 0, Math.PI * 2); ctx.fill();
      const pose = { facing: 'front' as const, dir: 1 as const, walk: 0, moving: false, t: t + i * .7, arm: acting ? FLOURISH[hero] : hero === 'kael' || hero === 'riven' ? 'idle' as ArmAction : 'hold' as ArmAction, k: kk, seed: i };
      const hooks = heroHooks(hero, {}, kk, t, { bowDraw: acting ? Math.sin(kk * Math.PI) : 0 });
      let tip: { x: number; y: number } | null = null;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      cut.stamp(ctx, 0, 0, FIGURE_BOX, dpr * k, STICKER, g => { const j = drawFigure(g, heroFigure(hero, {}), pose, hooks); if (hero === 'mira' || hero === 'lyra') tip = staffTip(j, kk); });
      ctx.restore();
      const tp = tip as { x: number; y: number } | null;
      if (tp) {
        const gx = x + tp.x * k, gy = y + tp.y * k, r = (7 + (acting ? 12 * Math.sin(kk * Math.PI) : 0)) * k;
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.3, GLOW[hero]); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      // Tuft and Fenn sit in front of their hero, a little to the side.
      if (hero === 'mira' || hero === 'wren') {
        const ps = (hero === 'wren' ? .62 : .68) * k, px = x + (hero === 'wren' ? -28 : 27) * k, py = y + (hero === 'wren' ? 12 : 15) * k;
        ctx.save(); ctx.translate(px, py); ctx.scale(ps, ps);
        cut.stamp(ctx, 0, 0, [-46, -50, 92, 72], dpr * ps, STICKER, q => hero === 'wren' ? paintWolf(q, t, 1) : paintFox(q, t, -1));
        ctx.restore();
      }
    }
  }
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if ((lite || reduced) && now - drawn < 1000 / PUPPET_FPS) return;
    drawn = now; paint(now);
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  return {
    place: () => CAST.map((c, i) => { const p = spot(i); return { id: c.id, x: p.x / w, y: p.y + 19 * p.k }; }),
    run(on) { if (on === running) return; running = on; if (on) raf = requestAnimationFrame(frame); else cancelAnimationFrame(raf); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('pointerup', click); },
  };
}
