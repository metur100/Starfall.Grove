import { useEffect, useRef, useState } from 'react';
import { sfx } from '../game/audio';
import type { MiniGame } from '../game/types';

// The mini-game offered by valley folk: an archery match (eight arrows at moving targets, paid by score).
// It pauses the world while it is open.

export type GameResult = { won: boolean; gold: number; score?: number };
export type GameProps = { kind: MiniGame; opponent: string; portrait: string; level: number; onEnd: (r: GameResult) => void };

export default function MiniGameOverlay(p: GameProps) {
  return <div className="overlay minigame-overlay"><div className="panel minigame-panel">
    <div className="mg-head"><span className="mg-portrait">{p.portrait}</span><span><small>Archery match</small><b>against {p.opponent}</b></span></div>
    <Archery {...p} />
  </div></div>;
}

// ───────────────────────────── archery
type Target = { lane: number; x: number; dir: number; speed: number; r: number; mult: number };
type Shot = { x: number; y: number; t: number; pts: number | null };
const ARROWS = 8, FLIGHT = .2;
const LANES = [{ y: 150, r: 40, mult: 2, speed: 150 }, { y: 250, r: 54, mult: 1.5, speed: 110 }, { y: 360, r: 68, mult: 1, speed: 75 }];
export const medalOf = (s: number) => s >= 100 ? 'gold' : s >= 70 ? 'silver' : s >= 40 ? 'bronze' : null;
function Archery({ level, onEnd }: GameProps) {
  const [, setTick] = useState(0);
  const targets = useRef<Target[]>(LANES.map((l, i) => ({ lane: i, x: 150 + i * 300, dir: i % 2 ? -1 : 1, speed: l.speed, r: l.r, mult: l.mult })));
  const shots = useRef<Shot[]>([]);
  const aim = useRef({ x: 500, y: 250 });
  const time = useRef(0);
  const [left, setLeft] = useState(ARROWS);
  const [score, setScore] = useState(0);
  const [pop, setPop] = useState<{ x: number; y: number; text: string; key: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now; time.current += dt;
      for (const t of targets.current) { t.x += t.dir * t.speed * dt; if (t.x < 60 || t.x > 940) { t.dir *= -1; t.x = Math.max(60, Math.min(940, t.x)); } }
      for (const s of shots.current) if (s.pts === null && time.current - s.t >= FLIGHT) {
        // The arrow lands: points by how close it is to a target's centre, times the lane's multiplier.
        let best = 0;
        for (const t of targets.current) { const d = Math.hypot(s.x - t.x, (s.y - LANES[t.lane].y) * 1.1) / t.r; if (d < 1) best = Math.max(best, Math.round((d < .22 ? 10 : d < .55 ? 6 : 3) * t.mult)); }
        s.pts = best; setScore(v => v + best); setPop({ x: s.x, y: s.y, text: best ? `+${best}` : 'Miss', key: now });
        sfx.play(best >= 15 ? 'crit' : best ? 'hit' : 'nope');
      }
      setTick(n => n + 1); raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  // The bow sways a little: aiming is easy, perfect bullseyes are not.
  const sway = { x: Math.sin(time.current * 2.3) * 7 + Math.sin(time.current * 5.1) * 3, y: Math.cos(time.current * 1.9) * 6 };
  const toLocal = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 1000, y: (e.clientY - r.top) / r.height * 500 }; };
  const shoot = (e: React.PointerEvent) => {
    if (left <= 0) return;
    aim.current = toLocal(e);
    shots.current.push({ x: aim.current.x + sway.x, y: aim.current.y + sway.y, t: time.current, pts: null });
    setLeft(n => n - 1); sfx.play('thornShot');
  };
  const done = left <= 0 && shots.current.every(s => s.pts !== null), medal = medalOf(score), gold = Math.round(score * (.6 + level * .12));
  const pct = (x: number, y: number) => ({ left: `${x / 10}%`, top: `${y / 5}%` });
  return <div className="archery-game">
    <div className="dg-score"><span>Arrows {left} / {ARROWS}</span><b>{score} points</b><span>🥉 40 · 🥈 70 · 🥇 100</span></div>
    <div className="range" ref={box} onPointerMove={e => { aim.current = toLocal(e); }} onPointerDown={shoot} role="application" aria-label="Archery range: tap or click to shoot">
      {LANES.map((l, i) => <i key={i} className="lane" style={{ top: `${(l.y + l.r + 6) / 5}%` }}><small>×{l.mult}</small></i>)}
      {targets.current.map((t, i) => <span key={i} className="target" style={{ ...pct(t.x, LANES[t.lane].y), width: `${t.r * .2}%`, aspectRatio: '1 / 1.1' }}><b /><b /><b /></span>)}
      {shots.current.map((s, i) => { const k = Math.min(1, (time.current - s.t) / FLIGHT); return <span key={i} className={`arrow-mark ${s.pts === null ? 'flying' : s.pts ? 'hit' : 'miss'}`} style={{ ...pct(s.x, s.y + (1 - k) * 160), transform: `translate(-50%,-50%) scale(${1.8 - k * .8})` }} />; })}
      {pop && <span className="shot-pop" key={pop.key} style={pct(pop.x, pop.y - 30)}>{pop.text}</span>}
      {!done && <span className="crosshair" style={pct(aim.current.x + sway.x, aim.current.y + sway.y)} />}
    </div>
    {done ? <div className="dg-end">
      <p className="dg-line">{medal ? `${medal === 'gold' ? '🥇 Gold' : medal === 'silver' ? '🥈 Silver' : '🥉 Bronze'} medal! ` : 'No medal this time. '}{score} points · +{gold} gold</p>
      <button className="btn primary" onClick={() => onEnd({ won: !!medal, gold, score })}>Collect</button>
    </div> : <p className="dg-line">Move to aim, tap or click to shoot. The small far targets count double.</p>}
  </div>;
}
