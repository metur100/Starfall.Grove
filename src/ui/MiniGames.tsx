import { useEffect, useRef, useState } from 'react';
import { sfx } from '../game/audio';
import type { MiniGame } from '../game/types';

// Mini-games offered by valley folk: Starfall Dice (best of three rounds for a gold stake) and an archery match
// (eight arrows at moving targets, paid by score). Both pause the world while they are open.

export type GameResult = { won: boolean; gold: number; score?: number };
export type GameProps = { kind: MiniGame; opponent: string; portrait: string; stake: number; level: number; onEnd: (r: GameResult) => void };

export default function MiniGameOverlay(p: GameProps) {
  return <div className="overlay minigame-overlay"><div className="panel minigame-panel">
    <div className="mg-head"><span className="mg-portrait">{p.portrait}</span><span><small>{p.kind === 'dice' ? 'Starfall Dice' : 'Archery match'}</small><b>against {p.opponent}</b></span></div>
    {p.kind === 'dice' ? <Dice {...p} /> : <Archery {...p} />}
  </div></div>;
}

// ───────────────────────────── dice
const roll = () => 1 + Math.floor(Math.random() * 6);
/** A hand's score: the sum, plus 4 for a pair or 12 for three of a kind. */
function scoreOf(d: number[]) { const s = d.reduce((a, b) => a + b, 0), c = new Map<number, number>(); for (const v of d) c.set(v, (c.get(v) || 0) + 1); const most = Math.max(...c.values()); return { total: s + (most === 3 ? 12 : most === 2 ? 4 : 0), bonus: most === 3 ? 'Three of a kind +12' : most === 2 ? 'Pair +4' : '' }; }
/** The villager keeps pairs and high dice and rerolls the rest once. */
function aiHand() {
  let d = [roll(), roll(), roll()];
  const c = new Map<number, number>(); for (const v of d) c.set(v, (c.get(v) || 0) + 1);
  const pair = [...c.entries()].find(([, n]) => n >= 2)?.[0];
  d = d.map(v => (pair !== undefined ? v === pair : v >= 4) ? v : roll());
  return d;
}
function Die({ v, held, rolling, onClick }: { v: number; held?: boolean; rolling?: boolean; onClick?: () => void }) {
  const pips: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  return <button className={`die ${held ? 'held' : ''} ${rolling ? 'rolling' : ''}`} onClick={onClick} disabled={!onClick} aria-label={`Die showing ${v}${held ? ', kept' : ''}`}>
    {Array.from({ length: 9 }, (_, i) => <i key={i} className={pips[v].includes(i) ? 'on' : ''} />)}
    {held && <small>Keep</small>}
  </button>;
}
function Dice({ opponent, stake, onEnd }: GameProps) {
  type Phase = 'ready' | 'rolled' | 'theirs' | 'result' | 'done';
  const [phase, setPhase] = useState<Phase>('ready');
  const [mine, setMine] = useState([1, 1, 1]);
  const [held, setHeld] = useState([false, false, false]);
  const [theirs, setTheirs] = useState<number[] | null>(null);
  const [rolling, setRolling] = useState<'me' | 'them' | null>(null);
  const [wins, setWins] = useState({ me: 0, them: 0 });
  const [round, setRound] = useState(1);
  const [line, setLine] = useState('Roll your three dice.');
  const shake = (who: 'me' | 'them', final: () => void) => { setRolling(who); sfx.play('dash'); window.setTimeout(() => { setRolling(null); final(); sfx.play('pickup'); }, 520); };
  const first = () => shake('me', () => { setMine([roll(), roll(), roll()]); setHeld([false, false, false]); setPhase('rolled'); setLine('Tap dice to keep them, then reroll the others once — or stand.'); });
  const finish = (hand: number[]) => {
    setPhase('theirs'); setLine(`${opponent} rolls…`);
    window.setTimeout(() => shake('them', () => {
      const t = aiHand(), a = scoreOf(hand).total, b = scoreOf(t).total; setTheirs(t);
      const w = { ...wins }; if (a > b) w.me++; else if (b > a) w.them++;
      setWins(w); setLine(a > b ? 'You win the round!' : b > a ? `${opponent} wins the round.` : 'A draw — nobody scores.');
      setPhase(w.me >= 2 || w.them >= 2 || round >= 3 ? 'done' : 'result'); sfx.play(a > b ? 'quest' : 'nope');
    }), 400);
  };
  const reroll = () => shake('me', () => { const h = mine.map((v, i) => held[i] ? v : roll()); setMine(h); finish(h); });
  const next = () => { setRound(r => r + 1); setTheirs(null); setPhase('ready'); setLine('Roll your three dice.'); };
  const won = wins.me > wins.them, me = scoreOf(mine), them = theirs ? scoreOf(theirs) : null;
  return <div className="dice-game">
    <div className="dg-score"><span>Round {Math.min(round, 3)} of 3</span><b>{wins.me} : {wins.them}</b><span>Stake {stake} gold</span></div>
    <div className="dg-row"><small>{opponent}</small><div className="dg-dice">{(theirs || [1, 1, 1]).map((v, i) => <Die key={i} v={rolling === 'them' ? roll() : v} rolling={rolling === 'them'} />)}</div><em>{them ? `${them.total}${them.bonus ? ` · ${them.bonus}` : ''}` : '—'}</em></div>
    <div className="dg-row mine"><small>You</small><div className="dg-dice">{mine.map((v, i) => <Die key={i} v={rolling === 'me' ? roll() : v} held={held[i]} rolling={rolling === 'me'} onClick={phase === 'rolled' && !rolling ? () => { setHeld(h => h.map((x, j) => j === i ? !x : x)); sfx.play('ui'); } : undefined} />)}</div><em>{phase === 'ready' ? '—' : `${me.total}${me.bonus ? ` · ${me.bonus}` : ''}`}</em></div>
    <p className="dg-line">{phase === 'done' ? (won ? `You win the match! +${stake * 2} gold` : wins.me === wins.them ? `A drawn match — your ${stake} gold stake comes back.` : `${opponent} wins the match and keeps your ${stake} gold.`) : line}</p>
    <div className="dg-actions">
      {phase === 'ready' && <button className="btn primary" disabled={!!rolling} onClick={first}>🎲 Roll</button>}
      {phase === 'rolled' && <><button className="btn ghost" disabled={!!rolling} onClick={() => finish(mine)}>Stand</button><button className="btn primary" disabled={!!rolling || held.every(Boolean)} onClick={reroll}>Reroll {held.filter(h => !h).length}</button></>}
      {phase === 'result' && <button className="btn primary" onClick={next}>Next round →</button>}
      {phase === 'done' && <button className="btn primary" onClick={() => onEnd({ won, gold: won ? stake * 2 : wins.me === wins.them ? stake : 0 })}>{won ? 'Collect winnings' : 'Leave the table'}</button>}
    </div>
  </div>;
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
