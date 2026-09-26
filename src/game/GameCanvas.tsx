import { useEffect, useRef } from 'react';
import { GameEngine } from './engine';
import { music } from './music';
import { Renderer } from './render';
import { loadSession, saveSession } from './storage';
import type { EngineEvent, GameSnapshot, LevelId } from './types';

// Canvas resolution is capped by a pixel budget so big and high-DPI screens stay smooth.
const PIXEL_BUDGET = 2_300_000;

type Props = { levelId: LevelId; runKey: number; paused: boolean; onReady: (engine: GameEngine | null) => void; onSnapshot: (snapshot: GameSnapshot) => void; onEvent: (event: EngineEvent) => void };
export default function GameCanvas({ levelId, runKey, paused, onReady, onSnapshot, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const callbacks = useRef({ onSnapshot, onEvent, onReady }); callbacks.current = { onSnapshot, onEvent, onReady };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
    const engine = new GameEngine(levelId, event => callbacks.current.onEvent(event), loadSession(levelId));
    const renderer = new Renderer();
    callbacks.current.onReady(engine);
    if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __renderer: renderer, __ctx: ctx });
    let raf = 0, last = 0, lastUi = 0, lastSave = 0, lastMusic = 0, viewW = 1, viewH = 1, dpr = 1, slow = 0, fast = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect(); viewW = Math.max(1, rect.width); viewH = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(PIXEL_BUDGET / (viewW * viewH)));
      canvas.width = Math.round(viewW * dpr); canvas.height = Math.round(viewH * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    music.play(levelId);
    const frame = (now: number) => {
      const raw = last ? (now - last) / 1000 : 0, dt = Math.min(.05, raw); last = now;
      // Adaptive quality: thin out ambient detail if frames run long, restore it when they recover.
      if (raw > .026) { slow++; fast = 0; } else if (raw && raw < .018) { fast++; slow = Math.max(0, slow - 1); }
      if (slow > 45 && renderer.quality > .5) { renderer.quality = Math.max(.5, renderer.quality - .25); slow = 0; }
      if (fast > 240 && renderer.quality < 1) { renderer.quality = Math.min(1, renderer.quality + .25); fast = 0; }
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
