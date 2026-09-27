import { useEffect, useRef } from 'react';
import { GameEngine } from './engine';
import { music } from './music';
import { Renderer } from './render';
import { loadSession, saveSession } from './storage';
import { startTier, type Graphics } from './graphics';
import type { EngineEvent, GameSnapshot, LevelId } from './types';

// Each tier caps the canvas resolution by a pixel budget and sets how much effect detail is drawn.
const TIERS = [
  { budget: 650_000, dpr: 1, quality: .5 },
  { budget: 1_300_000, dpr: 1.5, quality: .75 },
  { budget: 2_300_000, dpr: 2, quality: 1 },
];

type Props = { levelId: LevelId; runKey: number; paused: boolean; graphics: Graphics; touch: boolean; onReady: (engine: GameEngine | null) => void; onSnapshot: (snapshot: GameSnapshot) => void; onEvent: (event: EngineEvent) => void };
export default function GameCanvas({ levelId, runKey, paused, graphics, touch, onReady, onSnapshot, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const settings = useRef({ graphics, touch }); settings.current = { graphics, touch };
  const callbacks = useRef({ onSnapshot, onEvent, onReady }); callbacks.current = { onSnapshot, onEvent, onReady };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
    const engine = new GameEngine(levelId, event => callbacks.current.onEvent(event), loadSession(levelId));
    const renderer = new Renderer();
    callbacks.current.onReady(engine);
    if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __renderer: renderer, __ctx: ctx });
    let raf = 0, last = 0, lastUi = 0, lastSave = 0, lastMusic = 0, viewW = 1, viewH = 1, dpr = 1;
    // Auto mode starts from a guess about the device and then follows the measured frame time.
    let mode: Graphics | null = null, tier = 0, frameSum = 0, frames = 0, calmUntil = 0;
    const applyTier = () => {
      const t = TIERS[tier];
      renderer.quality = t.quality; engine.fx = t.quality;
      const rect = canvas.getBoundingClientRect(); viewW = Math.max(1, rect.width); viewH = Math.max(1, rect.height);
      dpr = Math.min(t.dpr, window.devicePixelRatio || 1, Math.sqrt(t.budget / (viewW * viewH)));
      canvas.width = Math.round(viewW * dpr); canvas.height = Math.round(viewH * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(applyTier); ro.observe(canvas);
    music.play(levelId);
    const frame = (now: number) => {
      const raw = last ? (now - last) / 1000 : 0, dt = Math.min(.05, raw); last = now;
      renderer.touch = settings.current.touch;
      if (mode !== settings.current.graphics) {
        mode = settings.current.graphics; tier = mode === 'low' ? 0 : mode === 'balanced' ? 1 : mode === 'high' ? 2 : startTier();
        frameSum = 0; frames = 0; calmUntil = now + 3000; applyTier();
      }
      if (mode === 'auto' && raw > 0 && raw < .25 && !pausedRef.current) {
        frameSum += raw; frames++;
        // Judge about one second of play at a time; step down fast, step up only after a calm spell.
        if (frames >= 60 || frameSum > 1) {
          const avg = frameSum / frames; frameSum = 0; frames = 0;
          if (avg > .024 && tier > 0) { tier--; applyTier(); calmUntil = now + 20000; }
          else if (avg < .0135 && tier < TIERS.length - 1 && now > calmUntil) { tier++; applyTier(); calmUntil = now + 8000; }
        }
      }
      if (!pausedRef.current) engine.update(dt); else engine.settleFx(dt);
      renderer.render(ctx, viewW, viewH, engine, now / 1000, pausedRef.current ? dt * .15 : dt, dpr);
      if (now - lastUi > 100) { callbacks.current.onSnapshot(engine.snapshot()); lastUi = now; }
      if (now - lastMusic > 250) { lastMusic = now; music.play(engine.bossFight ? 'boss' : levelId); music.setIntensity(pausedRef.current ? 0 : engine.combat); }
      if (!pausedRef.current && now - lastSave > 3000) { saveSession(levelId, engine.exportSave()); lastSave = now; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); engine.dispose(); callbacks.current.onReady(null); };
  }, [levelId, runKey]);
  return <canvas ref={canvasRef} className="world-canvas" aria-label="Starfall Grove game world" />;
}
