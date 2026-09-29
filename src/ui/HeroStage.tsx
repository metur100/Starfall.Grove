import { useEffect, useRef, useState } from 'react';
import type { HeroId } from '../game/types';
import { createStage, type Stage, type StageMode, type Worn } from './paperStage';
import { HeroFace } from './icons';

/** The hero as a big paper puppet on a pedestal (drag to turn them). Without a canvas a big portrait stands in. */
export default function HeroStage({ hero, gear, mode, className = '' }: { hero: HeroId; gear?: Worn; mode: StageMode; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const latest = useRef({ hero, gear }); latest.current = { hero, gear };
  useEffect(() => {
    if (!ref.current) return;
    try {
      stage.current = createStage(ref.current, latest.current.hero, mode);
      if (latest.current.gear) stage.current.setGear(latest.current.gear);
      setReady(true);
    } catch { setFailed(true); }
    return () => { stage.current?.dispose(); stage.current = null; };
  }, [mode]);
  useEffect(() => { stage.current?.setHero(hero); }, [hero, ready]);
  useEffect(() => { if (gear) stage.current?.setGear(gear); }, [gear, ready]);
  return <div className={`hero-stage ${className} ${ready ? 'ready' : ''}`}>
    {failed ? <div className="stage-fallback"><HeroFace hero={hero} /></div> : <canvas ref={ref} aria-label="Your hero. Drag to turn." />}
  </div>;
}
