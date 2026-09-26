import { useEffect, useRef } from 'react';
import { GameEngine } from './engine';
import { Renderer } from './render';
import { loadSession, saveSession } from './storage';
import type { EngineEvent, GameSnapshot, LevelId } from './types';

type Props = { levelId: LevelId; runKey: number; paused: boolean; onReady: (engine: GameEngine | null) => void; onSnapshot: (snapshot: GameSnapshot) => void; onEvent: (event: EngineEvent) => void };
export default function GameCanvas({ levelId, runKey, paused, onReady, onSnapshot, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const callbacks = useRef({ onSnapshot, onEvent, onReady }); callbacks.current = { onSnapshot, onEvent, onReady };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const engine = new GameEngine(levelId, event => callbacks.current.onEvent(event), loadSession(levelId));
    const renderer = new Renderer();
    callbacks.current.onReady(engine);
    if (import.meta.env.DEV) (window as unknown as { __engine: GameEngine }).__engine = engine;
    let raf = 0, last = 0, lastUi = 0, lastSave = 0, viewW = 1, viewH = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect(); viewW = Math.max(1, rect.width); viewH = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(viewW * dpr); canvas.height = Math.round(viewH * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const frame = (now: number) => {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      if (!pausedRef.current) engine.update(dt); else engine.settleFx(dt);
      renderer.render(ctx, viewW, viewH, engine, now / 1000, pausedRef.current ? dt * .15 : dt);
      if (now - lastUi > 80) { callbacks.current.onSnapshot(engine.snapshot()); lastUi = now; }
      if (!pausedRef.current && now - lastSave > 2500) { saveSession(levelId, engine.exportSave()); lastSave = now; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); callbacks.current.onReady(null); };
  }, [levelId, runKey]);
  return <canvas ref={canvasRef} className="world-canvas" aria-label="Starfall Grove game world" />;
}
