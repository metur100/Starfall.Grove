import { useEffect, useRef } from 'react';
import type { LevelId } from './game/types';

// The menus' backdrop: a pop-up storybook diorama at night. Hills are sheets of card standing one behind the other,
// each with a pale cut edge and a shadow on the sheet behind; the trees are cut from the same sheet as their hill. A
// paper moon, punched-out stars and drifting paper clouds hang in the sky, and the Beacon glows on the middle hill.
const THEMES: Record<LevelId, { sky: [string, string, string]; hills: [string, string, string, string]; cloud: string; glow: string; leaf: string }> = {
  meadow: { sky: ['#141a3a', '#2e2e62', '#b8707a'], hills: ['#3a4270', '#2a4a4e', '#1e3a30', '#132a22'], cloud: '#4a4a82', glow: '#ffd98a', leaf: '#f7c5d5' },
  woods: { sky: ['#0b1a20', '#16393e', '#4f7a5c'], hills: ['#244448', '#1a3a36', '#12302a', '#0b211c'], cloud: '#2a5054', glow: '#b9f29d', leaf: '#e8a54b' },
  summit: { sky: ['#0c0a22', '#262054', '#6a4bb0'], hills: ['#3a3470', '#2a2658', '#1c1a44', '#110f2e'], cloud: '#3e367a', glow: '#c9b6ff', leaf: '#e0d8ff' },
  ember: { sky: ['#1a0c14', '#4e1e22', '#c8602a'], hills: ['#5a3430', '#40241f', '#2c1814', '#1a0d0b'], cloud: '#6a2e2a', glow: '#ffb347', leaf: '#ffa060' },
};
const INK = 'rgba(20,12,22,.85)';
/** A colour pushed toward the cream of the paper's cut edge. */
function edgeOf(hex: string, k = .38) {
  const n = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), p = [255, 244, 222];
  return `rgb(${n.map((v, i) => Math.round(v + (p[i] - v) * k)).join(',')})`;
}

export default function TitleBackdrop({ level = 'meadow' }: { level?: LevelId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const theme = THEMES[level];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 1, h = 1, raf = 0, mx = 0, my = 0, last = 0;
    const stars = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random() * .62, r: Math.random() * 2 + 1, p: Math.random() * 6.28, s: Math.random() * 2 + .5 }));
    const flies = Array.from({ length: 34 }, () => ({ x: Math.random(), y: .58 + Math.random() * .42, p: Math.random() * 6.28 }));
    const leaves = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, s: Math.random() * 3 + 4, v: Math.random() * .03 + .02 }));
    const trees = [0, 1, 2, 3].map(layer => Array.from({ length: 18 + layer * 5 }, (_, i) => ({ x: (i + Math.random() * .7) / (18 + layer * 5), s: .55 + Math.random() * .75, pine: Math.random() > .45 })));
    const clouds = Array.from({ length: 3 }, (_, i) => ({ x: Math.random(), y: .3 + i * .07 + Math.random() * .03, s: .5 + Math.random() * .4, v: .004 + Math.random() * .006 }));
    const resize = () => { const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; const d = Math.min(2, devicePixelRatio || 1); canvas.width = w * d; canvas.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const move = (e: PointerEvent) => { mx = e.clientX / window.innerWidth - .5; my = e.clientY / window.innerHeight - .5; };
    window.addEventListener('pointermove', move);
    const hillY = (layer: number, x: number) => h * (.58 + layer * .09) + Math.sin(x * (3 + layer) + layer * 2) * h * .045 + Math.sin(x * 9 + layer) * h * .014;
    /** Cuts a sheet: shadow on the sheet behind, the pale cut edge, then the face. */
    // Each piece is its own path: all shadows, then all edges, then all faces, so pieces overlap into one cut shape.
    const cutSheet = (paths: Path2D[], face: string, sx = 5, sy = 7) => {
      ctx.save(); ctx.translate(sx, sy); ctx.fillStyle = 'rgba(12,6,16,.45)'; for (const p of paths) ctx.fill(p); ctx.restore();
      ctx.strokeStyle = edgeOf(face); ctx.lineWidth = 3.2; ctx.lineJoin = 'round'; for (const p of paths) ctx.stroke(p);
      ctx.fillStyle = face; for (const p of paths) ctx.fill(p);
    };
    const frame = (now: number) => {
      const t = now / 1000, dt = last ? Math.min(.05, t - last) : 0; last = t;
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, theme.sky[0]); g.addColorStop(.6, theme.sky[1]); g.addColorStop(1, theme.sky[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // Punched-out stars: little four-pointed pieces of cream paper, twinkling.
      for (const s of stars) {
        const k = .55 + Math.sin(t * s.s + s.p) * .45, x = s.x * w - mx * 8, y = s.y * h - my * 6, r = s.r * (.6 + k * .5);
        ctx.fillStyle = `rgba(255,244,222,${.45 + k * .5})`; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .38 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
      }
      // The paper moon, inked, with pale craters and a soft halo.
      const tall = h > w * 1.2, wide = w >= 900 && w > h * 1.2;
      const moonX = w * (tall ? .2 : wide ? .86 : .78) - mx * 14, moonY = h * (tall ? .085 : wide ? .17 : .2) - my * 10;
      const mg = ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 200); mg.addColorStop(0, 'rgba(255,240,200,.35)'); mg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = mg; ctx.fillRect(moonX - 200, moonY - 200, 400, 400);
      ctx.fillStyle = 'rgba(12,6,16,.45)'; ctx.beginPath(); ctx.arc(moonX + 5, moonY + 7, 46, 0, 6.28); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(moonX, moonY, 48, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff1d0'; ctx.beginPath(); ctx.arc(moonX, moonY, 45.5, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#f2dfb2'; ctx.beginPath(); ctx.arc(moonX + 8, moonY + 6, 38, 0, 6.28); ctx.fill(); ctx.fillStyle = '#fff1d0'; ctx.beginPath(); ctx.arc(moonX - 4, moonY - 4, 36, 0, 6.28); ctx.fill();
      for (const [cx, cy, cr] of [[-14, -10, 9], [15, 12, 6.5], [10, -18, 4.5], [-18, 16, 5]]) { ctx.fillStyle = '#ead6a8'; ctx.beginPath(); ctx.arc(moonX + cx, moonY + cy, cr, 0, 6.28); ctx.fill(); ctx.fillStyle = '#fff6de'; ctx.beginPath(); ctx.arc(moonX + cx - 1.2, moonY + cy - 1.2, cr * .55, 0, 6.28); ctx.fill(); }
      // Paper clouds drifting across.
      for (const c of clouds) {
        if (!reduced) { c.x += c.v * dt; if (c.x > 1.25) c.x = -.25; }
        const cx = c.x * w - mx * 20, cy = c.y * h - my * 8, s = c.s * Math.min(1, w / 900) + .3, parts: Path2D[] = [];
        for (const [ox, oy, r] of [[0, 0, 34], [40, -12, 42], [86, -2, 34], [120, 6, 24], [-34, 8, 22]]) { const q = new Path2D(); q.arc(cx + ox * s, cy + oy * s, r * s, 0, 6.28); parts.push(q); }
        const base = new Path2D(); base.roundRect(cx - 40 * s, cy, 184 * s, 26 * s, 12 * s); parts.push(base);
        ctx.globalAlpha = .7; cutSheet(parts, theme.cloud, 4, 6); ctx.globalAlpha = 1;
      }
      // Hills with their trees cut from the same sheet, back to front, with a little parallax.
      for (let layer = 0; layer < 4; layer++) {
        const px = -mx * (8 + layer * 16), py = -my * (4 + layer * 5), p = new Path2D(), parts: Path2D[] = [p];
        p.moveTo(-40, h + 20);
        for (let x = -40; x <= w + 40; x += 18) p.lineTo(x + px, hillY(layer, x / w) + py);
        p.lineTo(w + 40, h + 20); p.closePath();
        for (const tr of trees[layer]) {
          const x = tr.x * w + px, base = hillY(layer, tr.x) + py + 6, size = (22 + layer * 14) * tr.s * Math.max(.7, Math.min(1.2, w / 1100));
          if (tr.pine) { for (let k = 0; k < 3; k++) { const yy = base - k * size * .42, ww = size * (.5 - k * .1), q = new Path2D(); q.moveTo(x - ww, yy); q.lineTo(x, yy - size * .78); q.lineTo(x + ww, yy); q.closePath(); parts.push(q); } }
          else { const q = new Path2D(); q.rect(x - size * .07, base - size * .6, size * .14, size * .62); parts.push(q); for (const [ox, oy, r] of [[0, -.95, .48], [-.3, -.7, .34], [.3, -.72, .36]]) { const c = new Path2D(); c.arc(x + ox * size, base + oy * size, r * size, 0, 6.28); parts.push(c); } }
        }
        if (layer === 1) {
          // The Beacon: a little stone tower on the middle hill, its light burning.
          const bxf = wide ? .2 : .66, bx = w * bxf + px, by = hillY(1, bxf) + py;
          const tower = new Path2D(); tower.rect(bx - 10, by - 72, 20, 76); const cap = new Path2D(); cap.moveTo(bx - 15, by - 72); cap.lineTo(bx, by - 94); cap.lineTo(bx + 15, by - 72); cap.closePath(); parts.push(tower, cap);
          cutSheet(parts, theme.hills[layer]);
          ctx.fillStyle = theme.glow; ctx.fillRect(bx - 5, by - 66, 10, 12);
          const pulse = .6 + Math.sin(t * 2.2) * .25;
          const bg = ctx.createRadialGradient(bx, by - 62, 2, bx, by - 62, 130); bg.addColorStop(0, theme.glow); bg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse; ctx.fillStyle = bg; ctx.fillRect(bx - 130, by - 192, 260, 260);
          const beam = ctx.createLinearGradient(0, 0, 0, by - 62); beam.addColorStop(0, 'rgba(255,255,255,0)'); beam.addColorStop(1, theme.glow);
          ctx.globalAlpha = pulse * .22; ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(bx - 6, by - 62); ctx.lineTo(bx - 42, 0); ctx.lineTo(bx + 42, 0); ctx.lineTo(bx + 6, by - 62); ctx.fill(); ctx.restore();
        } else cutSheet(parts, theme.hills[layer]);
      }
      // Fireflies over the front hill.
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const x = (f.x * w + Math.sin(t * .6 + f.p) * 40) - mx * 30, y = f.y * h + Math.cos(t * .8 + f.p) * 26, a = Math.max(0, Math.sin(t * 2 + f.p * 3));
        const fg = ctx.createRadialGradient(x, y, 0, x, y, 14); fg.addColorStop(0, `rgba(255,236,150,${a * .9})`); fg.addColorStop(1, 'rgba(255,236,150,0)');
        ctx.fillStyle = fg; ctx.fillRect(x - 14, y - 14, 28, 28);
      }
      ctx.restore();
      // Drifting petals or leaves: paper confetti with an ink edge.
      for (const l of leaves) {
        if (!reduced) { l.y += l.v * dt; l.x += (Math.sin(t + l.p) * .01 + .01) * dt; if (l.y > 1.05) { l.y = -.05; l.x = Math.random(); } if (l.x > 1.05) l.x = -.05; }
        ctx.save(); ctx.translate(l.x * w - mx * 40, l.y * h); ctx.rotate(t * 1.5 + l.p); ctx.scale(1, Math.abs(Math.sin(t * 2 + l.p)) * .7 + .3);
        ctx.fillStyle = theme.leaf; ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * .5, 0, 0, 6.28); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', move); };
  }, [level]);
  return <canvas ref={ref} className="title-backdrop" aria-hidden="true" />;
}
