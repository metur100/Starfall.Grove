import { useEffect, useRef, useState } from 'react';
import type { HeroId } from '../game/types';
import type { Stage, StageMode, Worn } from './hero3d';
import { HeroFace } from './icons';

/** The 3D hero on a rune pedestal. three.js is loaded only when this is first shown; without WebGL a big portrait stands in. */
export default function HeroStage({ hero, gear, mode, className = '' }: { hero: HeroId; gear?: Worn; mode: StageMode; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const latest = useRef({ hero, gear }); latest.current = { hero, gear };
  useEffect(() => {
    let dead = false;
    import('./hero3d').then(({ createStage }) => {
      if (dead || !ref.current) return;
      try {
        stage.current = createStage(ref.current, latest.current.hero, mode);
        if (latest.current.gear) stage.current.setGear(latest.current.gear);
        setReady(true);
      } catch { setFailed(true); }
    }).catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; stage.current?.dispose(); stage.current = null; };
  }, [mode]);
  useEffect(() => { stage.current?.setHero(hero); }, [hero, ready]);
  useEffect(() => { if (gear) stage.current?.setGear(gear); }, [gear, ready]);
  return <div className={`hero-stage ${className} ${ready ? 'ready' : ''}`}>
    {failed ? <div className="stage-fallback"><HeroFace hero={hero} /></div> : <canvas ref={ref} aria-label="Your hero. Drag to turn." />}
    {!ready && !failed && <div className="stage-loading"><i /></div>}
  </div>;
}
