import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { HEROES, HERO_ORDER, SPELLS } from '../../src/game/spells';
import { SLOT_ORDER, makeGear, seeded } from '../../src/game/gear';
import type { GearItem, GearSlot, HeroId, SpellId } from '../../src/game/types';
import TitleBackdrop from '../../src/TitleBackdrop';
import HeroStage from '../../src/ui/HeroStage';
import { HeroFace } from '../../src/ui/icons';
import { PITCH, TRAITS, playAs } from './heroes';

// The game's character select, as a section of the landing page: the chosen hero on the rune pedestal (drag to turn
// them), their traits and abilities on the left, the roster on the right, and below, the story only they play and the
// guardians they meet. "Legendary set" dresses them in a full set of legendary gear, as found in the Ember Wastes.
// While the section is off screen nothing is drawn: the backdrop and the pedestal are only mounted while it shows.

export type Worn = Partial<Record<GearSlot, GearItem>>;
const legendary = (hero: HeroId): Worn => Object.fromEntries(SLOT_ORDER.map(slot => [slot, makeGear({ ilvl: 25, rarity: 'legendary', slot, hero, rand: seeded(`${hero}-${slot}`), uid: `${hero}-${slot}` })]));
const NONE: Worn = {};

export default function Select({ visible, onFilm }: { visible: boolean; onFilm: (hero: HeroId) => void }) {
  const [hero, setHero] = useState<HeroId>('mira');
  const [shown, setShown] = useState<SpellId | null>(null);
  const [dressed, setDressed] = useState(false);
  const info = HEROES[hero], pitch = PITCH[hero], spell = shown && SPELLS[shown];
  const gear = useMemo(() => dressed ? legendary(hero) : NONE, [hero, dressed]);
  useEffect(() => setShown(null), [hero]);
  // The cast in the hero section picks a hero here.
  useEffect(() => {
    const pick = (e: Event) => { const id = (e as CustomEvent<HeroId>).detail; if (HERO_ORDER.includes(id)) setHero(id); };
    window.addEventListener('sg:hero', pick); return () => window.removeEventListener('sg:hero', pick);
  }, []);
  return <div className={`sel hero-${hero}`} onClick={() => setShown(null)}>
    <div className="sel-backdrop" aria-hidden="true">{visible && <TitleBackdrop key={pitch.land} level={pitch.land} />}</div>
    <div className="select-vignette" aria-hidden="true" />
    <div className="sel-grid">
      <nav className="roster" aria-label="Heroes">
        {HERO_ORDER.map(id => {
          const h = HEROES[id];
          return <button key={id} type="button" className={`roster-card ${id === hero ? 'on' : ''}`} aria-pressed={id === hero} onClick={e => { e.stopPropagation(); setHero(id); }}>
            <span className="rc-face portrait"><HeroFace hero={id} /></span>
            <span className="rc-text"><b>{h.name}</b><em>{h.title}</em><small>{PITCH[id].epithet}</small></span>
          </button>;
        })}
      </nav>
      <div className="sel-center">
        {visible ? <HeroStage hero={hero} gear={gear} mode="select" className="sel-stage" /> : <div className="sel-stage hero-stage" />}
        <div className="sel-stage-bar">
          <span className="sel-hint">Drag to turn {info.name}</span>
          <button type="button" className={`gear-toggle ${dressed ? 'on' : ''}`} aria-pressed={dressed} onClick={e => { e.stopPropagation(); setDressed(d => !d); }}>
            <i aria-hidden="true">✦</i>{dressed ? 'Legendary set' : 'Try the legendary set'}
          </button>
        </div>
      </div>
      <section className="select-info" key={`info-${hero}`} aria-live="polite">
        <small>{info.title} · {pitch.epithet}</small>
        <h3>{info.name}</h3>
        <p>{info.description}</p>
        <dl className="traits">{TRAITS[hero].map(([k, v]) => <div key={k}><dt>{k}</dt><dd aria-label={`${v} of 5`}>{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= v ? 'on' : ''} />)}</dd></div>)}</dl>
        <div className="select-abilities">
          <div className="select-spells">{info.spells.map(id => <button type="button" key={id} className={`spell-chip ${shown === id ? 'on' : ''}`} aria-label={SPELLS[id].name} aria-expanded={shown === id} style={{ '--spell': SPELLS[id].color } as CSSProperties}
            onClick={e => { e.stopPropagation(); setShown(s => s === id ? null : id); }}><b>{SPELLS[id].icon}</b><small>Lv {SPELLS[id].level}</small></button>)}</div>
          {spell ? <div className="ability-card" role="dialog" aria-label={spell.name} style={{ '--spell': spell.color } as CSSProperties} onClick={e => { e.stopPropagation(); setShown(null); }}>
            <header><b>{spell.icon}</b><span><strong>{spell.name}</strong><em>Learned at level {spell.level}{spell.cost ? ` · ${spell.cost} ${info.resource.toLowerCase()}` : ' · free'}{spell.cast ? ` · ${spell.cast} s cast` : ''}{spell.cooldown >= 1 ? ` · ${spell.cooldown} s cooldown` : ''}</em></span><i aria-hidden="true">✕</i></header>
            <p>{spell.description}</p>
          </div> : <p className="sel-tip">Tap an ability to see what it does.</p>}
        </div>
      </section>
    </div>
    <article className="sel-story page" key={`story-${hero}`}>
      <div className="sel-story-text">
        <small className="page-eyebrow">{info.name}&rsquo;s own story</small>
        <p>{pitch.story}</p>
        {pitch.companion && <p className="sel-companion">Travels with {pitch.companion}.</p>}
      </div>
      <div className="sel-guardians">
        <small className="page-eyebrow">The guardians {info.name} faces</small>
        <ol>{pitch.guardians.map((g, i) => <li key={g} className={i === 4 ? 'final' : ''}><span>{['I', 'II', 'III', 'IV', '✹'][i]}</span>{g}</li>)}</ol>
      </div>
      <div className="sel-actions">
        <a className="btn primary" href="../" onClick={() => playAs(hero)}>Play as {info.name} <b>→</b></a>
        <button type="button" className="btn ghost" onClick={e => { e.stopPropagation(); onFilm(hero); }}><i className="play-dot" aria-hidden="true" />Watch {info.name}&rsquo;s intro</button>
      </div>
    </article>
  </div>;
}
