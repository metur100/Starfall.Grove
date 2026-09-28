import { useEffect, useRef } from 'react';
import type { LevelId } from './game/types';

// An animated storybook night sky used behind menus: twinkling stars, aurora, swaying hill forests, fireflies and drifting leaves.
const THEMES: Record<LevelId, { sky: [string, string, string]; hills: [string, string, string]; aurora: string; glow: string }> = {
  meadow: { sky: ['#0d1330', '#2b2a5c', '#c8736a'], hills: ['#2c3558', '#1f3a3c', '#122620'], aurora: '120,255,190', glow: '#ffd98a' },
  woods: { sky: ['#07141a', '#113338', '#4f7a5c'], hills: ['#173236', '#10272a', '#08171a'], aurora: '160,255,170', glow: '#b9f29d' },
  summit: { sky: ['#07061a', '#221a4d', '#6a4bb0'], hills: ['#2a2554', '#1a1740', '#0c0b24'], aurora: '200,160,255', glow: '#c9b6ff' },
};

export default function TitleBackdrop({ level = 'meadow' }: { level?: LevelId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const theme = THEMES[level];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 1, h = 1, raf = 0, mx = 0, my = 0, last = 0;
    const stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random() * .7, r: Math.random() * 1.4 + .3, p: Math.random() * 6.28, s: Math.random() * 2 + .5 }));
    const flies = Array.from({ length: 40 }, () => ({ x: Math.random(), y: .55 + Math.random() * .45, p: Math.random() * 6.28 }));
    const leaves = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, s: Math.random() * 3 + 3, v: Math.random() * .03 + .02 }));
    const trees = [0, 1, 2].map(layer => Array.from({ length: 26 + layer * 6 }, (_, i) => ({ x: (i + Math.random() * .6) / (26 + layer * 6), s: .6 + Math.random() * .7, pine: Math.random() > .45, p: Math.random() * 6.28 })));
    let shoot = { x: 0, y: 0, vx: 0, vy: 0, life: 0, next: 1.5 };
    const resize = () => { const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; const d = Math.min(2, devicePixelRatio || 1); canvas.width = w * d; canvas.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const move = (e: PointerEvent) => { mx = e.clientX / window.innerWidth - .5; my = e.clientY / window.innerHeight - .5; };
    window.addEventListener('pointermove', move);
    const hillY = (layer: number, x: number) => h * (.62 + layer * .1) + Math.sin(x * (3 + layer) + layer * 2) * h * .05 + Math.sin(x * 9 + layer) * h * .015;
    const frame = (now: number) => {
      const t = now / 1000, dt = last ? Math.min(.05, t - last) : 0; last = t;
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, theme.sky[0]); g.addColorStop(.55, theme.sky[1]); g.addColorStop(1, theme.sky[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // stars
      for (const s of stars) {
        const a = .35 + Math.sin(t * s.s + s.p) * .35 + .3;
        ctx.fillStyle = `rgba(255,250,235,${a})`; ctx.beginPath(); ctx.arc(s.x * w - mx * 8, s.y * h - my * 6, s.r, 0, 6.28); ctx.fill();
      }
      // aurora ribbons
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) { const y = h * (.18 + k * .07) + Math.sin(x * .006 + t * .35 + k) * 36 + Math.sin(x * .013 - t * .2) * 18; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        for (let x = w; x >= 0; x -= 16) { const y = h * (.18 + k * .07) + 70 + Math.sin(x * .006 + t * .35 + k) * 36 + Math.sin(x * .01 + t * .25) * 24; ctx.lineTo(x, y); }
        const ag = ctx.createLinearGradient(0, h * .1, 0, h * .45); ag.addColorStop(0, `rgba(${theme.aurora},0)`); ag.addColorStop(.5, `rgba(${theme.aurora},${.07 + Math.sin(t * .5 + k) * .03})`); ag.addColorStop(1, `rgba(${theme.aurora},0)`);
        ctx.fillStyle = ag; ctx.fill();
      }
      ctx.restore();
      // moon
      // On tall screens the moon moves up and to the left so it never sits behind the title.
      const tall = h > w * 1.2, wide = w >= 900 && w > h * 1.2;
      const moonX = w * (tall ? .2 : wide ? .86 : .78) - mx * 14, moonY = h * (tall ? .085 : wide ? .17 : .2) - my * 10;
      const mg = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 180); mg.addColorStop(0, 'rgba(255,240,200,.45)'); mg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = mg; ctx.fillRect(moonX - 180, moonY - 180, 360, 360);
      ctx.fillStyle = '#fff3cf'; ctx.beginPath(); ctx.arc(moonX, moonY, 44, 0, 6.28); ctx.fill();
      ctx.fillStyle = 'rgba(220,200,160,.35)'; ctx.beginPath(); ctx.arc(moonX - 12, moonY - 8, 9, 0, 6.28); ctx.arc(moonX + 14, moonY + 12, 6, 0, 6.28); ctx.fill();
      // shooting star
      shoot.next -= dt;
      if (shoot.next <= 0 && shoot.life <= 0) shoot = { x: Math.random() * w * .8 + w * .2, y: Math.random() * h * .25, vx: -(500 + Math.random() * 300), vy: 180 + Math.random() * 120, life: 1, next: 2 + Math.random() * 4 };
      if (shoot.life > 0) {
        shoot.life -= dt * 1.2; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt;
        const sg = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * .2, shoot.y - shoot.vy * .2); sg.addColorStop(0, `rgba(255,255,255,${shoot.life})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = sg; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * .2, shoot.y - shoot.vy * .2); ctx.stroke();
      }
      // hills + swaying silhouettes, back to front with parallax
      for (let layer = 0; layer < 3; layer++) {
        const px = -mx * (10 + layer * 18), py = -my * (4 + layer * 6);
        ctx.fillStyle = theme.hills[layer];
        ctx.beginPath(); ctx.moveTo(-40, h);
        for (let x = -40; x <= w + 40; x += 20) ctx.lineTo(x + px, hillY(layer, x / w) + py);
        ctx.lineTo(w + 40, h); ctx.closePath(); ctx.fill();
        for (const tr of trees[layer]) {
          const x = tr.x * w + px, base = hillY(layer, tr.x) + py + 4, size = (22 + layer * 16) * tr.s, sway = reduced ? 0 : Math.sin(t * 1.2 + tr.p) * size * .08;
          if (tr.pine) { ctx.beginPath(); ctx.moveTo(x - size * .45, base); ctx.lineTo(x + sway, base - size * 1.6); ctx.lineTo(x + size * .45, base); ctx.fill(); }
          else { ctx.fillRect(x - size * .06, base - size * .6, size * .12, size * .6); ctx.beginPath(); ctx.arc(x + sway, base - size * .9, size * .5, 0, 6.28); ctx.arc(x + sway * .7 - size * .3, base - size * .7, size * .35, 0, 6.28); ctx.arc(x + sway * .7 + size * .3, base - size * .72, size * .36, 0, 6.28); ctx.fill(); }
        }
        if (layer === 1) {
          // Beacon on the middle hill; on wide screens it balances the moon from the left.
          const bxf = wide ? .2 : .66, bx = w * bxf + px, by = hillY(1, bxf) + py;
          ctx.fillStyle = theme.hills[1]; ctx.fillRect(bx - 9, by - 70, 18, 72);
          const pulse = .6 + Math.sin(t * 2.2) * .25;
          const bg = ctx.createRadialGradient(bx, by - 76, 2, bx, by - 76, 120); bg.addColorStop(0, theme.glow); bg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse; ctx.fillStyle = bg; ctx.fillRect(bx - 120, by - 196, 240, 240);
          const beam = ctx.createLinearGradient(0, 0, 0, by - 76); beam.addColorStop(0, 'rgba(255,255,255,0)'); beam.addColorStop(1, theme.glow);
          ctx.globalAlpha = pulse * .25; ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(bx - 6, by - 76); ctx.lineTo(bx - 40, 0); ctx.lineTo(bx + 40, 0); ctx.lineTo(bx + 6, by - 76); ctx.fill(); ctx.restore();
        }
      }
      // mist
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const y = h * (.74 + i * .08), x = ((t * (12 + i * 6)) % (w + 600)) - 300;
        const mg2 = ctx.createRadialGradient(x, y, 10, x, y, 300); mg2.addColorStop(0, 'rgba(200,220,255,.08)'); mg2.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.fillStyle = mg2; ctx.fillRect(x - 300, y - 120, 600, 240);
      }
      // fireflies
      for (const f of flies) {
        const x = (f.x * w + Math.sin(t * .6 + f.p) * 40) - mx * 30, y = f.y * h + Math.cos(t * .8 + f.p) * 26, a = Math.max(0, Math.sin(t * 2 + f.p * 3));
        const fg = ctx.createRadialGradient(x, y, 0, x, y, 14); fg.addColorStop(0, `rgba(255,236,150,${a * .9})`); fg.addColorStop(1, 'rgba(255,236,150,0)');
        ctx.fillStyle = fg; ctx.fillRect(x - 14, y - 14, 28, 28);
      }
      ctx.restore();
      // drifting leaves
      for (const l of leaves) {
        if (!reduced) { l.y += l.v * dt; l.x += (Math.sin(t + l.p) * .01 + .01) * dt; if (l.y > 1.05) { l.y = -.05; l.x = Math.random(); } if (l.x > 1.05) l.x = -.05; }
        ctx.save(); ctx.translate(l.x * w - mx * 40, l.y * h); ctx.rotate(t * 1.5 + l.p); ctx.scale(1, Math.abs(Math.sin(t * 2 + l.p)) * .7 + .3);
        ctx.fillStyle = level === 'summit' ? 'rgba(220,210,255,.7)' : level === 'woods' ? 'rgba(232,165,75,.8)' : 'rgba(247,197,213,.85)';
        ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * .5, 0, 0, 6.28); ctx.fill(); ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', move); };
  }, [level]);
  return <canvas ref={ref} className="title-backdrop" aria-hidden="true" />;
}
