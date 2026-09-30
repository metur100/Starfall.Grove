// The hero on a paper pedestal, for hero select and the character sheet: the same paper puppet as in the world, only
// big. Drag sideways to turn them (front, side, back, other side). Every few seconds they show off their weapon.
// The pedestal is painted once per size and hero. On touch screens the puppet is re-cut 12 times a second (the stop-
// motion rate of creatures in the world) into its own canvas, the frames in between only place that canvas, and the
// stage paints 30 frames a second.
import { Cutter, STICKER, grainPattern, INK, PAPER } from '../game/art/cutout';
import { FIGURE_BOX, drawFigure, type ArmAction, type Facing } from '../game/art/rig';
import { heroFigure, heroHooks, staffTip } from '../game/art/heroes';
import { paintFox, paintWolf } from '../game/art/animals';
import { lookOf, type Look } from '../game/gear';
import { mix } from '../game/art/color';
import { isTouch } from '../game/graphics';
import type { GearItem, GearSlot, HeroId } from '../game/types';

export type Worn = Partial<Record<GearSlot, GearItem>>;
export type StageMode = 'select' | 'sheet';
export type Stage = { setHero(hero: HeroId): void; setGear(gear: Worn): void; dispose(): void };

/** Each hero's pedestal colours: the rune ring and the glow of their magic. */
const ACCENT: Record<HeroId, { rune: string; top: string; glow: string }> = {
  mira: { rune: '#ffd35c', top: '#6a5a8a', glow: '#ffe38a' }, kael: { rune: '#ffb35c', top: '#7a6a70', glow: '#ffd0a0' },
  lyra: { rune: '#9fe4ff', top: '#5a7a9a', glow: '#bfeaff' }, riven: { rune: '#b69cff', top: '#4a3e62', glow: '#e0c8ff' },
  wren: { rune: '#b9e27a', top: '#5a7a4a', glow: '#c8e6a0' },
};
const FLOURISH: Record<HeroId, ArmAction> = { mira: 'raise', lyra: 'raise', kael: 'swing', riven: 'thrust', wren: 'draw' };
const TURN: Array<[Facing, 1 | -1]> = [['front', 1], ['side', 1], ['back', 1], ['side', -1]];
/** How many times a second a touch screen re-cuts the puppet. */
const PUPPET_FPS = 12;
const layer = () => { const c = document.createElement('canvas'); return { c, g: c.getContext('2d')! }; };

export function createStage(canvas: HTMLCanvasElement, first: HeroId, mode: StageMode): Stage {
  const ctx = canvas.getContext('2d')!, cut = new Cutter(), lite = isTouch(), base = layer(), puppet = layer();
  let baseKey = '', puppetKey = '', puppetBeat = -1, drawn = 0, looks = 0, tip: { x: number; y: number } | null = null;
  let hero = first, look: Look = {}, raf = 0, w = 1, h = 1, dpr = 1, turn = 0, dragX: number | null = null, dragAcc = 0, flourishAt = 2.5, entered = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(1, r.width); h = Math.max(1, r.height); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    for (const L of [base, puppet]) { L.c.width = canvas.width; L.c.height = canvas.height; }
    baseKey = puppetKey = '';
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const down = (e: PointerEvent) => { dragX = e.clientX; dragAcc = 0; canvas.setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => { if (dragX === null) return; dragAcc += e.clientX - dragX; dragX = e.clientX; while (Math.abs(dragAcc) > 55) { turn = (turn + (dragAcc > 0 ? 1 : 3)) % 4; dragAcc -= Math.sign(dragAcc) * 55; } };
  const up = () => { dragX = null; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // Touch screens paint 30 frames a second, like the backdrop behind.
    if (lite && now - drawn < 28) return;
    drawn = now;
    const t = now / 1000; if (!entered) entered = t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    // How big the puppet is: it fills the stage, feet on the pedestal a little above the bottom.
    // The figure reaches from its hat (80 above its anchor) to its feet (22 below), and the pedestal sits under the feet.
    // A tall, narrow stage (a tablet held upright) is limited by its width, so the puppet sits in the middle, not on the floor.
    const H = mode === 'sheet' ? 140 : 128, below = mode === 'sheet' ? 46 : 36, s = Math.min(h / H, w / 104), cx = w / 2, fy = (h + H * s) / 2 - below * s, A = ACCENT[hero], pr = 44 * s, py = fy + 22 * s;
    // The pedestal: a round stack of card with a turning ring of runes.
    if (baseKey !== hero) {
      baseKey = hero; const g = base.g;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, base.c.width, base.c.height); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const disc = (y: number, rx: number, ry: number, c: string) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
      disc(py + 16 * s * .35 + 7, pr * 1.05, pr * .34, 'rgba(18,10,20,.45)');
      disc(py + 12 * s * .35, pr + 2, pr * .33 + 2, INK); disc(py + 12 * s * .35, pr, pr * .33, mix(A.top, INK, .35));
      disc(py, pr + 2, pr * .33 + 2, INK); disc(py, pr, pr * .33, PAPER); disc(py - 1, pr - 3, pr * .33 - 3, A.top);
      g.globalAlpha = .45; g.fillStyle = grainPattern(g); g.beginPath(); g.ellipse(cx, py, pr, pr * .33, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base.c, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save(); ctx.translate(cx, py - 1); ctx.scale(1, .33); ctx.rotate(t * .25);
    ctx.strokeStyle = A.rune; ctx.lineWidth = Math.max(1.5, s * .9); ctx.setLineDash([s * 3, s * 5]); ctx.beginPath(); ctx.arc(0, 0, pr * .78, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillStyle = A.rune; ctx.fillRect(Math.cos(a) * pr * .9 - s, Math.sin(a) * pr * .9 - s * 2.5, s * 2, s * 5); }
    ctx.restore();
    ctx.fillStyle = 'rgba(40,24,40,.3)'; ctx.beginPath(); ctx.ellipse(cx, py, 19 * s, 6.5 * s, 0, 0, Math.PI * 2); ctx.fill();
    // Now and then the hero shows off.
    const since = t - entered;
    if (since > flourishAt + 1.2) flourishAt = since + 4 + Math.random() * 3;
    const k = since > flourishAt ? Math.min(1, (since - flourishAt) / .9) : 0, acting = since > flourishAt && k < 1;
    const [facing, dir] = TURN[turn];
    const pose = { facing, dir, walk: 0, moving: false, t, arm: acting ? FLOURISH[hero] : hero === 'kael' || hero === 'riven' ? 'idle' as ArmAction : 'hold' as ArmAction, k };
    const key = `${hero}|${turn}|${looks}|${acting ? 1 : 0}`, beat = Math.floor(t * PUPPET_FPS);
    if (!lite || key !== puppetKey || beat !== puppetBeat) {
      puppetKey = key; puppetBeat = beat; tip = null;
      const g = puppet.g;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, puppet.c.width, puppet.c.height); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fig = heroFigure(hero, look), hooks = heroHooks(hero, look, acting ? k : 0, t, { bowDraw: acting ? Math.sin(k * Math.PI) : 0 });
      // Tuft beside Mira, Fenn beside Wren.
      const pet = (front: boolean) => {
        if (hero !== 'mira' && hero !== 'wren') return;
        const behind = facing === 'back'; if (front === behind) return;
        const px = cx + (hero === 'wren' ? -30 : -27) * s, pyy = fy + (hero === 'wren' ? 10 : 14) * s, ps = hero === 'wren' ? .62 : .68;
        g.save(); g.translate(px, pyy); g.scale(s * ps, s * ps);
        cut.stamp(g, 0, 0, [-46, -50, 92, 72], dpr * s * ps, STICKER, q => hero === 'wren' ? paintWolf(q, t, 1) : paintFox(q, t, 1));
        g.restore();
      };
      pet(false);
      g.save(); g.translate(cx, fy); g.scale(s, s);
      cut.stamp(g, 0, 0, FIGURE_BOX, dpr * s, STICKER, q => { const j = drawFigure(q, fig, pose, hooks); if ((hero === 'mira' || hero === 'lyra') && j.facing !== 'back') tip = staffTip(j, acting ? k : 0); });
      g.restore();
      pet(true);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(puppet.c, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tp = tip as { x: number; y: number } | null;
    if (tp) {
      const gx = cx + tp.x * s, gy = fy + tp.y * s, r = (6 + (acting ? 10 : 0)) * s;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.3, A.glow); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // A few motes of the hero's magic drifting up from the pedestal.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { const ph = (t * .22 + i / 9) % 1, mx = cx + Math.sin(i * 2.3 + t * .4) * pr * .8, my = py - ph * 90 * s; ctx.globalAlpha = (1 - ph) * .7; ctx.fillStyle = A.glow; ctx.beginPath(); ctx.arc(mx, my, Math.max(1.2, s * .55), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  raf = requestAnimationFrame(frame);
  return {
    setHero(id) { hero = id; turn = 0; flourishAt = 1.2; entered = 0; },
    setGear(gear) { look = lookOf(gear); looks++; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); },
  };
}
