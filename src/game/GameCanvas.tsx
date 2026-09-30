import { useEffect, useRef } from 'react';
import { GameEngine } from './engine';
import { music } from './music';
import { Renderer } from './render';
import { loadSession, saveSession } from './storage';
import { TIER_NAMES, TIER_OF, loadAutoTier, saveAutoTier, startTier, type GraphicsSettings } from './graphics';
import type { EngineEvent, GameSnapshot, HeroId } from './types';

// Each tier caps the canvas resolution by a pixel budget and sets how much effect detail is drawn.
// The lowest tier renders below screen resolution and lets the browser scale it up.
const TIERS = [
  { budget: 420_000, dpr: .8, quality: .35 },
  { budget: 650_000, dpr: 1, quality: .5 },
  { budget: 1_300_000, dpr: 1.5, quality: .75 },
  { budget: 2_300_000, dpr: 2, quality: 1 },
];

/** `next` with every part that equals the same part of `prev` swapped for prev's own, so an unchanged snapshot (or an
 *  unchanged part of one) keeps its identity and the HUD skips redrawing it. */
function share<T>(prev: T, next: T): T {
  if (Object.is(prev, next)) return prev;
  if (!prev || !next || typeof prev !== 'object' || typeof next !== 'object' || Array.isArray(prev) !== Array.isArray(next)) return next;
  if (Array.isArray(next)) {
    const p = prev as unknown[]; let same = p.length === next.length;
    const out = next.map((v, i) => { const x = share(p[i], v); if (x !== p[i]) same = false; return x; });
    return (same ? prev : out) as T;
  }
  const p = prev as Record<string, unknown>, n = next as Record<string, unknown>, keys = Object.keys(n), out: Record<string, unknown> = {};
  let same = keys.length === Object.keys(p).length;
  for (const k of keys) { const x = share(p[k], n[k]); out[k] = x; if (x !== p[k]) same = false; }
  return (same ? prev : out) as T;
}

/** The mean of the fastest nine tenths of `a` (sorted in place). */
function trimmed(a: number[]) {
  a.sort((x, y) => x - y);
  const n = Math.max(1, Math.ceil(a.length * .9)); let sum = 0;
  for (let i = 0; i < n; i++) sum += a[i];
  return sum / n;
}

type Props = { hero: HeroId; runKey: number; paused: boolean; graphics: GraphicsSettings; touch: boolean; practice?: boolean; onReady: (engine: GameEngine | null) => void; onSnapshot: (snapshot: GameSnapshot) => void; onEvent: (event: EngineEvent) => void };
export default function GameCanvas({ hero, runKey, paused, graphics, touch, practice = false, onReady, onSnapshot, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null), veilRef = useRef<HTMLDivElement>(null), barRef = useRef<HTMLElement>(null);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const settings = useRef({ graphics, touch }); settings.current = { graphics, touch };
  const callbacks = useRef({ onSnapshot, onEvent, onReady }); callbacks.current = { onSnapshot, onEvent, onReady };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
    const engine = new GameEngine(hero, event => callbacks.current.onEvent(event), practice ? null : loadSession(hero), practice);
    const renderer = new Renderer();
    callbacks.current.onReady(engine);
    if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __renderer: renderer, __ctx: ctx });
    let raf = 0, last = 0, lastUi = 0, lastSave = 0, lastMusic = 0, viewW = 1, viewH = 1, dpr = 1;
    // Auto quality starts where it settled last time on this device (or from a guess about it), then follows the
    // measured frame time.
    let quality: GraphicsSettings['quality'] | null = null, tier = 0, ceiling = TIERS.length - 1;
    let frameSum = 0, calmUntil = 0, lastUp = -1e9, tierSince = 0, saved = '', fpsFrames = 0, fpsSince = 0, fpsWorst = 0;
    const gaps: number[] = [], works: number[] = [];
    // Entering the world, a loading card stays up while the first frames are drawn (but not played) and the renderer
    // bakes the ground, houses and trees around the start: nothing new has to be made during the first steps.
    let warming = true, warmFrom = 0, warmFrames = 0;
    // After an automatic change of level the ground and pieces are remade at the new one: frames aren't judged until
    // that is done (and a moment after), and it takes two slow seconds in a row to step down again.
    let settling = false, slowRuns = 0;
    // A phone that stepped up while walking and then down in a crowded fight would keep doing it, fight after fight,
    // remaking the ground and every piece at the worst moment. So a level is only tried after a long calm spell away
    // from fights (and never soon after a step down), and a level that had to be left during a fight is not tried again.
    let lastDown = -1e9, lastFight = -1e9, fightInWindow = false;
    // Touch screens of 90 and 120 Hz draw every frame (a late frame then costs only a few ms, not a whole 17 ms
    // one); only the fastest (144 Hz and up) draw every other one, at half the work and heat. The rate is measured
    // over the first frames.
    let hz = 0; const early: number[] = [];
    const changeTier = (to: number, now: number) => { if (to < tier) lastDown = now; tier = to; applyTier(); renderer.rewarm(); settling = true; slowRuns = 0; calmUntil = now + 4000; tierSince = now; frameSum = 0; gaps.length = works.length = 0; };
    veilRef.current?.classList.remove('gone'); if (barRef.current) barRef.current.style.width = '0%';
    let lastSnap: GameSnapshot | null = null, nearX = '', nearY = '';
    const applyTier = () => {
      const t = TIERS[tier];
      renderer.quality = t.quality; engine.fx = t.quality;
      // Below full detail the HUD's bars jump instead of gliding: a glide restyles and repaints them every frame.
      canvas.parentElement?.classList.toggle('hud-lite', t.quality < 1);
      const rect = canvas.getBoundingClientRect(); viewW = Math.max(1, rect.width); viewH = Math.max(1, rect.height);
      dpr = Math.min(t.dpr, window.devicePixelRatio || 1, Math.sqrt(t.budget / (viewW * viewH)));
      canvas.width = Math.round(viewW * dpr); canvas.height = Math.round(viewH * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(applyTier); ro.observe(canvas);
    music.play(engine.regionTrack);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const g = settings.current.graphics, capped = g.fps === 30;
      // The screen's rate shows in the quickest of the first frames after loading (slow ones only mean work).
      if (!hz && last && !warming && !settling) { early.push(now - last); if (early.length >= 40) { early.sort((a, b) => a - b); hz = 1000 / early[8]; } }
      if (capped && last && now - last < 1000 / 30 - 4) return;
      if (!capped && hz > 130 && settings.current.touch && last && now - last < 1000 / 60 - 3) return;
      // A late frame doesn't slow the game down: its time is played in steps of at most 50 ms (up to a tenth of a
      // second; past that the game waits rather than jump). Clamping it to one 50 ms step played fights in slow motion.
      const raw = last ? (now - last) / 1000 : 0, dt = Math.min(.1, raw); last = now;
      renderer.touch = settings.current.touch;
      renderer.shake = g.shake; renderer.weather = g.weather;
      // Still grass is pasted onto the ground and costs nothing a frame, so only the lowest level thins it out.
      renderer.decor = g.decor !== 'auto' ? g.decor : renderer.quality >= .5 ? 'full' : 'less';
      if (quality !== g.quality) {
        quality = g.quality;
        const kept = quality === 'auto' ? loadAutoTier() : null;
        tier = quality === 'auto' ? kept?.tier ?? startTier() : TIER_OF[quality]; ceiling = kept?.ceiling ?? TIERS.length - 1;
        frameSum = 0; gaps.length = works.length = 0; calmUntil = now + 4000; tierSince = now; applyTier();
      }
      if (!pausedRef.current && !warming) { const steps = Math.ceil(dt / .05 - 1e-6) || 1; for (let i = 0; i < steps; i++) engine.update(dt / steps); } else engine.settleFx(dt);
      if (engine.combat > .15) { lastFight = now; fightInWindow = true; }
      renderer.fighting = now - lastFight < 3000;
      renderer.render(ctx, viewW, viewH, engine, now / 1000, pausedRef.current ? dt * .15 : dt, dpr);
      // The touch prompt follows the person in reach. Its position is written straight onto the prompt, and only when it
      // moves: set on the stage it would restyle the whole HUD every frame.
      const ns = renderer.nearScreen, prompt = ns && canvas.parentElement?.querySelector<HTMLElement>('.near-prompt.compact');
      if (ns) {
        const x = `${Math.round(ns.x)}px`, y = `${Math.round(ns.y)}px`;
        if (prompt && (x !== nearX || y !== nearY || prompt.style.getPropertyValue('--near-x') !== x)) { prompt.style.setProperty('--near-x', x); prompt.style.setProperty('--near-y', y); nearX = x; nearY = y; }
      }
      const busy = (performance.now() - now) / 1000;
      if (warming) {
        if (!warmFrom) warmFrom = now;
        const done = renderer.warmup(engine, 10); warmFrames++;
        if (barRef.current) barRef.current.style.width = `${Math.round(done * 100)}%`;
        // A quick device is through in a blink and the card just fades; a slow one waits a few seconds at most.
        if ((done >= 1 && warmFrames >= 6 && now - warmFrom > 250) || now - warmFrom > 4000) {
          // Whatever the card had no time for is finished while playing, before frames are judged.
          warming = false; settling = done < 1; veilRef.current?.classList.add('gone');
          frameSum = 0; gaps.length = works.length = 0; calmUntil = Math.max(calmUntil, now + 2500);
        }
      }
      if (settling && renderer.warmup(engine, 4) >= 1) { settling = false; calmUntil = Math.max(calmUntil, now + 2500); }
      if (quality === 'auto' && raw > 0 && raw < .25 && !pausedRef.current && !warming && !settling && now > calmUntil) {
        frameSum += Math.min(raw, .25); gaps.push(raw); works.push(busy);
        // Judge about a second of play at a time: step down quickly, step up after a calm spell.
        // With the 30 fps cap the frame interval is fixed, so the time spent drawing is what counts.
        if (gaps.length >= 60 || frameSum > 1) {
          // The slowest tenth of the frames are left out, so a moment of baking new ground can't cost a quality level.
          const avg = trimmed(gaps), work = trimmed(works); frameSum = 0; gaps.length = works.length = 0;
          // Uncapped, falling under ~50 fps steps down; keeping up with the screen with most of each frame to spare
          // (even at a steady 60 Hz, where the interval alone can't show spare time) is room to step up.
          // Stepping up needs frames that use under a third of their time: the next level costs about twice as much.
          const slow = capped ? avg > .045 || work > .024 : avg > .0205, smooth = capped ? work < .008 : avg < .0185 && work < .0055;
          const awful = capped ? avg > .06 : avg > .034;
          slowRuns = slow ? slowRuns + 1 : 0;
          if ((slowRuns >= 2 || awful) && tier > 0) {
            // Dropping right after a step up, or in a fight, means that level is too much for this device when it
            // matters: stay below it (and remember).
            if (now - lastUp < 30000 || fightInWindow) ceiling = tier - 1;
            changeTier(tier - 1, now);
          } else if (smooth && tier < ceiling && now - lastUp > 30000 && now - lastDown > 60000 && now - lastFight > 20000) { lastUp = now; changeTier(tier + 1, now); }
          fightInWindow = false;
          // A level held for twenty seconds of play is where the next visit starts.
          const key = `${tier}|${ceiling}`;
          if (now - tierSince > 20000 && key !== saved) { saveAutoTier(tier, ceiling); saved = key; }
        }
      }
      fpsFrames++; if (raw < .5) fpsWorst = Math.max(fpsWorst, raw);
      if (now - fpsSince > 500) {
        const el = fpsRef.current;
        if (el) { el.hidden = !g.showFps; if (g.showFps) el.textContent = `${Math.round(fpsFrames * 1000 / (now - fpsSince))} fps · slowest ${Math.round(fpsWorst * 1000)} ms · ${TIER_NAMES[tier]}`; }
        fpsFrames = 0; fpsSince = now; fpsWorst = 0;
      }
      // The HUD hears about the game ten times a second (five below full detail: each update restyles and repaints
      // it, which a phone feels in a fight), and only when something it shows has changed. Its bars glide between.
      if (now - lastUi > (renderer.quality >= 1 ? 100 : 200)) { const snap = share(lastSnap as GameSnapshot, engine.snapshot()); if (snap !== lastSnap) { lastSnap = snap; callbacks.current.onSnapshot(snap); } lastUi = now; }
      if (now - lastMusic > 250) { lastMusic = now; music.play(engine.musicTrack); music.setIntensity(pausedRef.current ? 0 : engine.combat); }
      if (!practice && !pausedRef.current && now - lastSave > 3000) { saveSession(hero, engine.exportSave()); lastSave = now; }
    };
    // Going to the background (another app, the home button, a locked screen) saves everything at once: a phone often
    // closes a game it can't see without warning.
    const hidden = () => { if (document.visibilityState === 'hidden' && !practice) { saveSession(hero, engine.exportSave()); engine.saveProfileNow(); lastSave = performance.now(); } };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', hidden);
    raf = requestAnimationFrame(frame);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', hidden); cancelAnimationFrame(raf); ro.disconnect(); engine.dispose(); callbacks.current.onReady(null); };
  }, [hero, runKey, practice]);
  return <>
    <canvas ref={canvasRef} className="world-canvas" aria-label="Starfall Grove game world" />
    <div ref={veilRef} className="world-veil" role="status" aria-label="Preparing the valley"><div className="veil-card"><span className="veil-title">Unfolding the valley</span><span className="veil-bar"><i ref={barRef} /></span></div></div>
    <div ref={fpsRef} className="fps-meter" hidden />
  </>;
}
