import { useEffect, useRef, useState } from 'react';
import { sfx } from '../game/audio';
import { HEROES } from '../game/spells';
import type { CineState, HeroId, SiegeState } from '../game/types';

/**
 * The hero's intro film (public/intro/<hero>.mp4, 30 seconds with its own score), played when a new adventure starts.
 * Skip or Esc ends it. If it cannot load (offline, say), `onFail` goes straight on to the hero's in-game intro.
 */
export function IntroFilm({ hero, onDone, onFail }: { hero: HeroId; onDone: () => void; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null), done = useRef(false);
  const [started, setStarted] = useState(false), [muted, setMuted] = useState(false);
  const finish = (ok: boolean) => { if (done.current) return; done.current = true; ref.current?.pause(); (ok ? onDone : onFail)(); };
  useEffect(() => {
    const v = ref.current; if (!v) return;
    sfx.setDucked(true);
    v.volume = sfx.filmVolume(); v.muted = sfx.isMuted();
    // Browsers may refuse to start a film with sound; then it plays muted, with a button to turn the sound on.
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => finish(false)); });
    const slow = window.setTimeout(() => { if (v.currentTime < .1) finish(false); }, 12000);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(true); } };
    window.addEventListener('keydown', key);
    return () => { window.clearTimeout(slow); window.removeEventListener('keydown', key); sfx.setDucked(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const unmute = () => { const v = ref.current; if (!v) return; v.muted = false; v.volume = sfx.filmVolume(); setMuted(false); };
  return <div className="film" role="dialog" aria-label={`${HEROES[hero].name}’s story`} onClick={() => muted && unmute()}>
    <video ref={ref} src={`${import.meta.env.BASE_URL}intro/${hero}.mp4`} playsInline preload="auto" onPlaying={() => setStarted(true)} onEnded={() => finish(true)} onError={() => finish(false)} />
    {!started && <div className="film-wait"><i /><span>{HEROES[hero].name}’s story…</span></div>}
    {muted && started && <button className="film-sound" onClick={e => { e.stopPropagation(); unmute(); }}>🔇 Tap for sound</button>}
    <button className="film-skip" onClick={e => { e.stopPropagation(); sfx.play('ui'); finish(true); }}>Skip ⏭</button>
  </div>;
}

/** Letterbox bars and the caption of the shot playing; tap to go on, or skip the whole scene. */
export function CineOverlay({ cine, touch, onNext, onSkip }: { cine: CineState; touch: boolean; onNext: () => void; onSkip: () => void }) {
  return <div className="cine" onClick={onNext}>
    <div className="cine-bar top" /><div className="cine-bar bottom" />
    {cine.title && <div className="cine-title" key={`title-${cine.key}`}><h2>{cine.title}</h2>{cine.sub && <p>{cine.sub}</p>}</div>}
    {cine.text && <div className="cine-caption" key={cine.key}>
      {cine.speaker && <strong>{cine.portrait && <span className="cine-face">{cine.portrait}</span>}{cine.speaker}</strong>}
      <p className={cine.speaker ? 'spoken' : ''}>{cine.text}</p>
    </div>}
    <button className="cine-skip" onClick={e => { e.stopPropagation(); sfx.play('ui'); onSkip(); }}>Skip ⏭</button>
    {!touch && <em className="cine-hint">Click or press Enter to continue · Esc to skip</em>}
  </div>;
}

/** A siege's barricade health and wave count, shown where a guardian's health bar would be. */
export function SiegeBar({ siege }: { siege: SiegeState }) {
  const pct = Math.max(0, siege.hp / siege.max) * 100;
  return <div className={`siege-bar ${pct < 30 ? 'low' : ''}`}>
    <div className="siege-label"><strong>{siege.ward}</strong><span>Wave {siege.wave}/{siege.waves}</span><em>{siege.resting > 0 ? `Next wave in ${siege.resting}…` : `${siege.left} left`}</em></div>
    <div className="siege-track"><i style={{ width: `${pct}%` }} /></div>
  </div>;
}
