import { useEffect, useState } from 'react';
import { sfx } from '../game/audio';
import { HEROES } from '../game/spells';
import type { CineState, HeroId, SiegeState } from '../game/types';
import { HeroFace } from './icons';

/** The storybook pages that open a new adventure, before the camera flies down into the valley. */
const PAGES: Array<{ scene: string; text: string }> = [
  { scene: 'lights', text: 'Long ago, four lights were lit over Starfall Valley: the Beacon, the Bell, the Star and the Forge. In their glow, the dark had nowhere to sleep.' },
  { scene: 'valley', text: 'For a hundred years the valley lived in that glow. Farms and cities, fairs and lanterns, and nights full of stars.' },
  { scene: 'fall', text: 'Then, one quiet night, a star fell.' },
  { scene: 'dark', text: 'The Beacon went dark. Shadows crept out of the grass. And somewhere in the east, something old woke up, hungry.' },
];
const HOOK: Record<HeroId, string> = {
  mira: 'Mira is a young star warlock, apprentice to Master Orrin. On the night the star fell, Orrin walked out into the dark and told her to stay behind. She didn’t.',
  kael: 'Kael is a squire of the Wardens, the old knights who guard the Beacon. He was on watch at the Rise with his teacher, Ser Aldric, when the shadow came.',
  lyra: 'Lyra is a frost mage from the Silver Heights. Her little sister Nessa carries the post on the meadow roads, and on the night the star fell, Nessa never came home.',
  riven: 'Riven grew up in a foundling house, born with a shadow that hurts, and was raised by the Hushed, the valley’s quietest thieves. That night they took a job paid in black feathers.',
  wren: 'Wren is a beast hunter who grew up among wolves. When the star fell her whole pack turned to shadow, all but young Fenn.',
};

export function Prologue({ hero, onDone, onSkip }: { hero: HeroId; onDone: () => void; onSkip: () => void }) {
  const [page, setPage] = useState(0);
  const last = page >= PAGES.length;
  const next = () => { sfx.play('page'); if (last) onDone(); else setPage(p => p + 1); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = window.setTimeout(next, last ? 9000 : page === 2 ? 5200 : 7000); return () => window.clearTimeout(t); }, [page]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onSkip(); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  const p = PAGES[page];
  return <div className="prologue" onClick={next} role="dialog" aria-label="Prologue">
    <div className={`pro-scene scene-${last ? 'hero' : p.scene}`} key={page}>
      <div className="pro-sky">{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 70}%`, animationDelay: `${(i % 7) * .4}s` }} />)}</div>
      <div className="pro-hills"><span /><span /><span /></div>
      {!last && p.scene === 'lights' && <div className="pro-lights"><b>☀</b><b>🔔</b><b>★</b><b>🔥</b></div>}
      {!last && p.scene === 'valley' && <div className="pro-village">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${10 + i * 9}%`, animationDelay: `${i * .3}s` }} />)}</div>}
      {!last && p.scene === 'fall' && <><div className="pro-meteor" /><div className="pro-flash" /></>}
      {!last && p.scene === 'dark' && <div className="pro-mist" />}
      {last && <div className="pro-hero"><span className="pro-face"><HeroFace hero={hero} /></span><small>{HEROES[hero].title}</small><h2>{HEROES[hero].name}</h2></div>}
    </div>
    <div className="pro-text" key={`t${page}`}>
      <p>{last ? HOOK[hero] : p.text}</p>
      <em>{last ? 'Your story begins at the Bridgekeeper’s Rest.' : ''}</em>
    </div>
    <div className="pro-foot" onClick={e => e.stopPropagation()}>
      <span className="pro-dots">{[...PAGES, null].map((_, i) => <i key={i} className={i === page ? 'on' : ''} />)}</span>
      <button className="btn ghost" onClick={() => { sfx.play('ui'); onSkip(); }}>Skip intro ⏭</button>
      <button className="btn primary" onClick={next}>{last ? 'Begin' : 'Next'} <b>→</b></button>
    </div>
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
