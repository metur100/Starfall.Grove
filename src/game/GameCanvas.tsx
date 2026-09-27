import { useEffect, useRef } from 'react';
import { GameEngine } from './engine';
import { music } from './music';
import { Renderer } from './render';
import { loadSession, saveSession } from './storage';
import { TIER_NAMES, TIER_OF, startTier, type GraphicsSettings } from './graphics';
import type { EngineEvent, GameSnapshot, HeroId } from './types';

// Each tier caps the canvas resolution by a pixel budget and sets how much effect detail is drawn.
// The lowest tier renders below screen resolution and lets the browser scale it up.
const TIERS = [
  { budget: 420_000, dpr: .8, quality: .35 },
  { budget: 650_000, dpr: 1, quality: .5 },
  { budget: 1_300_000, dpr: 1.5, quality: .75 },
  { budget: 2_300_000, dpr: 2, quality: 1 },
];

type Props = { hero: HeroId; runKey: number; paused: boolean; graphics: GraphicsSettings; touch: boolean; onReady: (engine: GameEngine | null) => void; onSnapshot: (snapshot: GameSnapshot) => void; onEvent: (event: EngineEvent) => void };
export default function GameCanvas({ hero, runKey, paused, graphics, touch, onReady, onSnapshot, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const settings = useRef({ graphics, touch }); settings.current = { graphics, touch };
  const callbacks = useRef({ onSnapshot, onEvent, onReady }); callbacks.current = { onSnapshot, onEvent, onReady };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
    const engine = new GameEngine(hero, event => callbacks.current.onEvent(event), loadSession(hero));
    const renderer = new Renderer();
    callbacks.current.onReady(engine);
    if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __renderer: renderer, __ctx: ctx });
    let raf = 0, last = 0, lastUi = 0, lastSave = 0, lastMusic = 0, viewW = 1, viewH = 1, dpr = 1;
    // Auto quality starts from a guess about the device and then follows the measured frame time.
    let quality: GraphicsSettings['quality'] | null = null, tier = 0, ceiling = TIERS.length - 1;
    let frameSum = 0, busySum = 0, frames = 0, calmUntil = 0, lastUp = -1e9, fpsFrames = 0, fpsSince = 0;
    const applyTier = () => {
      const t = TIERS[tier];
      renderer.quality = t.quality; engine.fx = t.quality;
      const rect = canvas.getBoundingClientRect(); viewW = Math.max(1, rect.width); viewH = Math.max(1, rect.height);
      dpr = Math.min(t.dpr, window.devicePixelRatio || 1, Math.sqrt(t.budget / (viewW * viewH)));
      canvas.width = Math.round(viewW * dpr); canvas.height = Math.round(viewH * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(applyTier); ro.observe(canvas);
    music.play(engine.regionTrack);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const g = settings.current.graphics, capped = g.fps === 30;
      if (capped && last && now - last < 1000 / 30 - 4) return;
      const raw = last ? (now - last) / 1000 : 0, dt = Math.min(.05, raw); last = now;
      renderer.touch = settings.current.touch;
      renderer.shake = g.shake; renderer.weather = g.weather;
      renderer.decor = g.decor !== 'auto' ? g.decor : renderer.quality >= .75 ? 'full' : 'less';
      if (quality !== g.quality) {
        quality = g.quality; tier = quality === 'auto' ? startTier() : TIER_OF[quality]; ceiling = TIERS.length - 1;
        frameSum = busySum = frames = 0; calmUntil = now + 4000; applyTier();
      }
      if (!pausedRef.current) engine.update(dt); else engine.settleFx(dt);
      renderer.render(ctx, viewW, viewH, engine, now / 1000, pausedRef.current ? dt * .15 : dt, dpr);
      // The touch prompt follows the person in reach; styles are written directly so the HUD doesn't re-render every frame.
      const stage = canvas.parentElement, ns = renderer.nearScreen;
      if (stage && ns) { stage.style.setProperty('--near-x', `${Math.round(ns.x)}px`); stage.style.setProperty('--near-y', `${Math.round(ns.y)}px`); }
      const busy = (performance.now() - now) / 1000;
      if (quality === 'auto' && raw > 0 && raw < .25 && !pausedRef.current && now > calmUntil) {
        frameSum += raw; busySum += busy; frames++;
        // Judge about a second of play at a time: step down quickly, step up only after a long calm spell.
        // With the 30 fps cap the frame interval is fixed, so the time spent drawing is what counts.
        if (frames >= 60 || frameSum > 1) {
          const avg = frameSum / frames, work = busySum / frames; frameSum = busySum = frames = 0;
          const slow = capped ? avg > .045 || work > .024 : avg > .024, smooth = capped ? work < .008 : avg < .0135;
          if (slow && tier > 0) {
            // Dropping right after a step up means that tier is too much for this device: stay below it.
            if (now - lastUp < 30000) ceiling = tier - 1;
            tier--; applyTier(); calmUntil = now + 4000;
          } else if (smooth && tier < ceiling && now - lastUp > 30000) { tier++; lastUp = now; applyTier(); calmUntil = now + 4000; }
        }
      }
      fpsFrames++;
      if (now - fpsSince > 500) {
        const el = fpsRef.current;
        if (el) { el.hidden = !g.showFps; if (g.showFps) el.textContent = `${Math.round(fpsFrames * 1000 / (now - fpsSince))} fps · ${TIER_NAMES[tier]}`; }
        fpsFrames = 0; fpsSince = now;
      }
      if (now - lastUi > 100) { callbacks.current.onSnapshot(engine.snapshot()); lastUi = now; }
      if (now - lastMusic > 250) { lastMusic = now; music.play(engine.bossFight ? 'boss' : engine.regionTrack); music.setIntensity(pausedRef.current ? 0 : engine.combat); }
      if (!pausedRef.current && now - lastSave > 3000) { saveSession(hero, engine.exportSave()); lastSave = now; }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); engine.dispose(); callbacks.current.onReady(null); };
  }, [hero, runKey]);
  return <>
    <canvas ref={canvasRef} className="world-canvas" aria-label="Starfall Grove game world" />
    <div ref={fpsRef} className="fps-meter" hidden />
  </>;
}
