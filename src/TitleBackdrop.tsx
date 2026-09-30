import { useEffect, useRef } from 'react';
import type { LevelId } from './game/types';
import { isTouch } from './game/graphics';

// The menus' backdrop: a pop-up storybook diorama at night. Hills are sheets of card standing one behind the other,
// each with a pale cut edge and a shadow on the sheet behind; the trees are cut from the same sheet as their hill. A
// paper moon, punched-out stars and drifting paper clouds hang in the sky, and the Beacon glows on the middle hill.
// Everything that stands still (sky, moon, stars, hills, clouds, glows) is painted once into its own canvas when the
// page is sized; a frame only places those pieces and moves the few small live things. On touch screens the sheets
// share fewer canvases (there is no mouse to follow for parallax) and the frame rate is capped at 30.
const THEMES: Record<LevelId, { sky: [string, string, string]; hills: [string, string, string, string]; cloud: string; glow: string; leaf: string }> = {
  meadow: { sky: ['#141a3a', '#2e2e62', '#b8707a'], hills: ['#3a4270', '#2a4a4e', '#1e3a30', '#132a22'], cloud: '#4a4a82', glow: '#ffd98a', leaf: '#f7c5d5' },
  woods: { sky: ['#0b1a20', '#16393e', '#4f7a5c'], hills: ['#244448', '#1a3a36', '#12302a', '#0b211c'], cloud: '#2a5054', glow: '#b9f29d', leaf: '#e8a54b' },
  summit: { sky: ['#0c0a22', '#262054', '#6a4bb0'], hills: ['#3a3470', '#2a2658', '#1c1a44', '#110f2e'], cloud: '#3e367a', glow: '#c9b6ff', leaf: '#e0d8ff' },
  ember: { sky: ['#1a0c14', '#4e1e22', '#c8602a'], hills: ['#5a3430', '#40241f', '#2c1814', '#1a0d0b'], cloud: '#6a2e2a', glow: '#ffb347', leaf: '#ffa060' },
};
const INK = 'rgba(20,12,22,.85)';
/** How far past the page edge the sky and hills are painted, so parallax never shows an edge. */
const M = 48;
/** How many stars twinkle live; the rest are painted into the sky. */
const TWINKLE = 26;
/** A colour pushed toward the cream of the paper's cut edge. */
function edgeOf(hex: string, k = .38) {
  const n = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), p = [255, 244, 222];
  return `rgb(${n.map((v, i) => Math.round(v + (p[i] - v) * k)).join(',')})`;
}
function canvasOf(w: number, h: number, d: number) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * d)); c.height = Math.max(1, Math.ceil(h * d));
  const g = c.getContext('2d')!; g.setTransform(d, 0, 0, d, 0, 0); return { c, g };
}
type Layer = { c: HTMLCanvasElement; w: number; h: number };

export default function TitleBackdrop({ level = 'meadow' }: { level?: LevelId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const theme = THEMES[level], lite = isTouch();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 1, h = 1, d = 1, raf = 0, mx = 0, my = 0, last = 0, drawn = 0;
    const stars = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random() * .62, r: Math.random() * 2 + 1, p: Math.random() * 6.28, s: Math.random() * 2 + .5 }));
    const flies = Array.from({ length: lite ? 20 : 34 }, () => ({ x: Math.random(), y: .58 + Math.random() * .42, p: Math.random() * 6.28 }));
    const leaves = Array.from({ length: lite ? 14 : 22 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, s: Math.random() * 3 + 4, v: Math.random() * .03 + .02 }));
    const trees = [0, 1, 2, 3].map(layer => Array.from({ length: 18 + layer * 5 }, (_, i) => ({ x: (i + Math.random() * .7) / (18 + layer * 5), s: .55 + Math.random() * .75, pine: Math.random() > .45 })));
    const clouds = Array.from({ length: 3 }, (_, i) => ({ x: Math.random(), y: .3 + i * .07 + Math.random() * .03, s: .5 + Math.random() * .4, v: .004 + Math.random() * .006, sprite: null as Layer | null }));
    const hillY = (layer: number, x: number) => h * (.58 + layer * .09) + Math.sin(x * (3 + layer) + layer * 2) * h * .045 + Math.sin(x * 9 + layer) * h * .014;
    const star = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .38 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
    };
    /** Cuts a sheet: shadow on the sheet behind, the pale cut edge, then the face. */
    // Each piece is its own path: all shadows, then all edges, then all faces, so pieces overlap into one cut shape.
    const cutSheet = (g: CanvasRenderingContext2D, paths: Path2D[], face: string, sx = 5, sy = 7) => {
      g.save(); g.translate(sx, sy); g.fillStyle = 'rgba(12,6,16,.45)'; for (const p of paths) g.fill(p); g.restore();
      g.strokeStyle = edgeOf(face); g.lineWidth = 3.2; g.lineJoin = 'round'; for (const p of paths) g.stroke(p);
      g.fillStyle = face; for (const p of paths) g.fill(p);
    };
    const wide = () => w >= 900 && w > h * 1.2;
    const beaconAt = () => { const f = wide() ? .2 : .66; return { x: w * f, y: hillY(1, f) }; };

    // The still pieces, painted when the page is sized.
    let sky: Layer | null = null, glow: Layer | null = null, beam: Layer | null = null, fly: Layer | null = null, leaf: Layer | null = null;
    let sheets: Array<{ layer: Layer; depth: number; glowAfter: boolean }> = [];
    const bakeSky = () => {
      const lw = w + M * 2, lh = h + M * 2, { c, g } = canvasOf(lw, lh, d);
      const gr = g.createLinearGradient(0, M, 0, M + h); gr.addColorStop(0, theme.sky[0]); gr.addColorStop(.6, theme.sky[1]); gr.addColorStop(1, theme.sky[2]);
      g.fillStyle = gr; g.fillRect(0, 0, lw, lh);
      g.translate(M, M);
      for (let i = TWINKLE; i < stars.length; i++) { const s = stars[i]; g.fillStyle = `rgba(255,244,222,${.5 + Math.sin(s.p) * .2 + .2})`; star(g, s.x * w, s.y * h, s.r * .9); }
      // The paper moon, inked, with pale craters and a soft halo.
      const tall = h > w * 1.2, moonX = w * (tall ? .2 : wide() ? .86 : .78), moonY = h * (tall ? .085 : wide() ? .17 : .2);
      const mg = g.createRadialGradient(moonX, moonY, 20, moonX, moonY, 200); mg.addColorStop(0, 'rgba(255,240,200,.35)'); mg.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = mg; g.fillRect(moonX - 200, moonY - 200, 400, 400);
      g.fillStyle = 'rgba(12,6,16,.45)'; g.beginPath(); g.arc(moonX + 5, moonY + 7, 46, 0, 6.28); g.fill();
      g.fillStyle = INK; g.beginPath(); g.arc(moonX, moonY, 48, 0, 6.28); g.fill();
      g.fillStyle = '#fff1d0'; g.beginPath(); g.arc(moonX, moonY, 45.5, 0, 6.28); g.fill();
      g.fillStyle = '#f2dfb2'; g.beginPath(); g.arc(moonX + 8, moonY + 6, 38, 0, 6.28); g.fill(); g.fillStyle = '#fff1d0'; g.beginPath(); g.arc(moonX - 4, moonY - 4, 36, 0, 6.28); g.fill();
      for (const [cx, cy, cr] of [[-14, -10, 9], [15, 12, 6.5], [10, -18, 4.5], [-18, 16, 5]]) { g.fillStyle = '#ead6a8'; g.beginPath(); g.arc(moonX + cx, moonY + cy, cr, 0, 6.28); g.fill(); g.fillStyle = '#fff6de'; g.beginPath(); g.arc(moonX + cx - 1.2, moonY + cy - 1.2, cr * .55, 0, 6.28); g.fill(); }
      return { c, w: lw, h: lh };
    };
    const bakeCloud = (s: number): Layer => {
      const lw = 200 * s + 30, lh = 110 * s + 30, { c, g } = canvasOf(lw, lh, d), cx = 50 * s + 10, cy = 60 * s + 10, parts: Path2D[] = [];
      for (const [ox, oy, r] of [[0, 0, 34], [40, -12, 42], [86, -2, 34], [120, 6, 24], [-34, 8, 22]]) { const q = new Path2D(); q.arc(cx + ox * s, cy + oy * s, r * s, 0, 6.28); parts.push(q); }
      const base = new Path2D(); base.roundRect(cx - 40 * s, cy, 184 * s, 26 * s, 12 * s); parts.push(base);
      g.globalAlpha = .7; cutSheet(g, parts, theme.cloud, 4, 6);
      return { c, w: lw, h: lh };
    };
    /** Hill sheets `layers`, back to front, into one canvas reaching M past every page edge. */
    const bakeHills = (layers: number[]): Layer => {
      const lw = w + M * 2, lh = h + M, { c, g } = canvasOf(lw, lh, d);
      g.translate(M, 0);
      for (const layer of layers) {
        const p = new Path2D(), parts: Path2D[] = [p];
        p.moveTo(-M, h + M);
        for (let x = -M; x <= w + M; x += 18) p.lineTo(x, hillY(layer, x / w));
        p.lineTo(w + M, h + M); p.closePath();
        for (const tr of trees[layer]) {
          const x = tr.x * w, base = hillY(layer, tr.x) + 6, size = (22 + layer * 14) * tr.s * Math.max(.7, Math.min(1.2, w / 1100));
          if (tr.pine) { for (let k = 0; k < 3; k++) { const yy = base - k * size * .42, ww = size * (.5 - k * .1), q = new Path2D(); q.moveTo(x - ww, yy); q.lineTo(x, yy - size * .78); q.lineTo(x + ww, yy); q.closePath(); parts.push(q); } }
          else { const q = new Path2D(); q.rect(x - size * .07, base - size * .6, size * .14, size * .62); parts.push(q); for (const [ox, oy, r] of [[0, -.95, .48], [-.3, -.7, .34], [.3, -.72, .36]]) { const cc = new Path2D(); cc.arc(x + ox * size, base + oy * size, r * size, 0, 6.28); parts.push(cc); } }
        }
        if (layer === 1) {
          // The Beacon: a little stone tower on the middle hill, its window lit.
          const { x: bx, y: by } = beaconAt();
          const tower = new Path2D(); tower.rect(bx - 10, by - 72, 20, 76); const cap = new Path2D(); cap.moveTo(bx - 15, by - 72); cap.lineTo(bx, by - 94); cap.lineTo(bx + 15, by - 72); cap.closePath(); parts.push(tower, cap);
          cutSheet(g, parts, theme.hills[layer]);
          g.fillStyle = theme.glow; g.fillRect(bx - 5, by - 66, 10, 12);
        } else cutSheet(g, parts, theme.hills[layer]);
      }
      return { c, w: lw, h: lh };
    };
    const bake = () => {
      sky = bakeSky();
      for (const cl of clouds) cl.sprite = bakeCloud(cl.s * Math.min(1, w / 900) + .3);
      // Touch screens have no parallax, so neighbouring sheets can share a canvas; the Beacon's glow lies between 1 and 2.
      sheets = lite ? [{ layer: bakeHills([0, 1]), depth: 1, glowAfter: true }, { layer: bakeHills([2, 3]), depth: 3, glowAfter: false }]
        : [0, 1, 2, 3].map(l => ({ layer: bakeHills([l]), depth: l, glowAfter: l === 1 }));
      { const { c, g } = canvasOf(260, 260, d), bg = g.createRadialGradient(130, 130, 2, 130, 130, 130); bg.addColorStop(0, theme.glow); bg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = bg; g.fillRect(0, 0, 260, 260); glow = { c, w: 260, h: 260 }; }
      { const by = beaconAt().y - 62, bh = Math.max(1, by), { c, g } = canvasOf(84, bh, d), bm = g.createLinearGradient(0, 0, 0, bh); bm.addColorStop(0, 'rgba(255,255,255,0)'); bm.addColorStop(1, theme.glow); g.fillStyle = bm; g.beginPath(); g.moveTo(36, bh); g.lineTo(0, 0); g.lineTo(84, 0); g.lineTo(48, bh); g.fill(); beam = { c, w: 84, h: bh }; }
      { const { c, g } = canvasOf(28, 28, d), fg = g.createRadialGradient(14, 14, 0, 14, 14, 14); fg.addColorStop(0, 'rgba(255,236,150,.9)'); fg.addColorStop(1, 'rgba(255,236,150,0)'); g.fillStyle = fg; g.fillRect(0, 0, 28, 28); fly = { c, w: 28, h: 28 }; }
      { const { c, g } = canvasOf(20, 12, d); g.fillStyle = theme.leaf; g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.ellipse(10, 6, 8.5, 4.2, 0, 0, 6.28); g.fill(); g.stroke(); leaf = { c, w: 20, h: 12 }; }
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, r.height);
      d = Math.min(lite ? 1.5 : 2, devicePixelRatio || 1); canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      bake(); last = 0;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const move = (e: PointerEvent) => { mx = e.clientX / window.innerWidth - .5; my = e.clientY / window.innerHeight - .5; };
    if (!lite) window.addEventListener('pointermove', move);
    const put = (L: Layer, x: number, y: number, dw = L.w, dh = L.h) => ctx.drawImage(L.c, x, y, dw, dh);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Touch screens paint 30 frames a second: the scene drifts slowly and the phone stays cool.
      if (lite && now - drawn < 28) return;
      drawn = now;
      const t = now / 1000, dt = last ? Math.min(.05, t - last) : 0; last = t;
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (sky) put(sky, -M - mx * 10, -M - my * 7);
      // Punched-out stars: a few twinkle live over the painted ones.
      for (let i = 0; i < TWINKLE; i++) { const s = stars[i], k = .55 + Math.sin(t * s.s + s.p) * .45; ctx.fillStyle = `rgba(255,244,222,${.45 + k * .5})`; star(ctx, s.x * w - mx * 8, s.y * h - my * 6, s.r * (.6 + k * .5)); }
      // Paper clouds drifting across.
      for (const c of clouds) {
        if (!reduced) { c.x += c.v * dt; if (c.x > 1.25) c.x = -.25; }
        const s = c.s * Math.min(1, w / 900) + .3;
        if (c.sprite) put(c.sprite, c.x * w - mx * 20 - 50 * s - 10, c.y * h - my * 8 - 60 * s - 10);
      }
      // Hills with their trees, back to front, with a little parallax; the Beacon's light burns on the middle hill.
      for (const sh of sheets) {
        put(sh.layer, -M - mx * (8 + sh.depth * 16), -my * (4 + sh.depth * 5));
        if (sh.glowAfter && glow && beam) {
          const px = -mx * 24, py = -my * 9, { x, y } = beaconAt(), bx = x + px, by = y + py, pulse = .6 + Math.sin(t * 2.2) * .25;
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse; put(glow, bx - 130, by - 192);
          ctx.globalAlpha = pulse * .22; put(beam, bx - 42, 0, 84, Math.max(1, by - 62));
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        }
      }
      // Fireflies over the front hill.
      if (fly) {
        ctx.globalCompositeOperation = 'lighter';
        for (const f of flies) {
          const a = Math.max(0, Math.sin(t * 2 + f.p * 3)); if (a < .02) continue;
          ctx.globalAlpha = a; put(fly, f.x * w + Math.sin(t * .6 + f.p) * 40 - mx * 30 - 14, f.y * h + Math.cos(t * .8 + f.p) * 26 - 14);
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      // Drifting petals or leaves: paper confetti with an ink edge.
      if (leaf) for (const l of leaves) {
        if (!reduced) { l.y += l.v * dt; l.x += (Math.sin(t + l.p) * .01 + .01) * dt; if (l.y > 1.05) { l.y = -.05; l.x = Math.random(); } if (l.x > 1.05) l.x = -.05; }
        const k = l.s / 8.5, a = t * 1.5 + l.p, sy = Math.abs(Math.sin(t * 2 + l.p)) * .7 + .3, cos = Math.cos(a), sin = Math.sin(a);
        ctx.setTransform(d * cos * k, d * sin * k, -d * sin * k * sy, d * cos * k * sy, d * (l.x * w - mx * 40), d * l.y * h);
        put(leaf, -10, -6);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', move); };
  }, [level]);
  return <canvas ref={ref} className="title-backdrop" aria-hidden="true" />;
}
