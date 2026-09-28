import type { CSSProperties } from 'react';
import { HEROES, HERO_ORDER, SPELLS } from '../game/spells';
import { sfx } from '../game/audio';
import type { HeroId } from '../game/types';
import TitleBackdrop from '../TitleBackdrop';
import HeroStage from './HeroStage';
import { HeroFace } from './icons';

// Character select, in the spirit of an MMO login screen: the chosen hero stands on a rune pedestal in the middle,
// the roster sits on the right, and "Enter world" starts (or continues) that hero's own adventure.

export type HeroSummary = { started: boolean; level: number; gold: number; where: string; stars: number };
const TRAITS: Record<HeroId, Array<[string, number]>> = {
  mira: [['Range', 5], ['Toughness', 2], ['Magic', 5], ['Speed', 4]],
  kael: [['Range', 1], ['Toughness', 5], ['Might', 5], ['Speed', 3]],
};

export default function CharacterSelect({ hero, summary, touch, onHero, onEnter, onBack }: { hero: HeroId; summary: (id: HeroId) => HeroSummary; touch: boolean; onHero: (h: HeroId) => void; onEnter: () => void; onBack: () => void }) {
  const info = HEROES[hero], me = summary(hero);
  return <main className={`select-page hero-${hero}`}>
    <TitleBackdrop level={hero === 'kael' ? 'meadow' : 'summit'} />
    <div className="select-vignette" aria-hidden="true" />
    <header className="select-top">
      <button className="btn ghost" onClick={() => { sfx.play('page'); onBack(); }}>← Back</button>
      <small className="eyebrow">Choose your hero</small>
      <span />
    </header>
    <section className="select-info" key={`info-${hero}`}>
      <small>Level {me.level} · {info.title}</small>
      <h1>{info.name}</h1>
      <p>{info.description}</p>
      <dl className="traits">{TRAITS[hero].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= v ? 'on' : ''} />)}</dd></div>)}</dl>
      <div className="select-spells">{info.spells.map(id => <span key={id} title={`${SPELLS[id].name} · level ${SPELLS[id].level}`} style={{ '--spell': SPELLS[id].color } as CSSProperties}><b>{SPELLS[id].icon}</b><small>Lv {SPELLS[id].level}</small></span>)}</div>
    </section>
    <HeroStage hero={hero} mode="select" className="select-stage" />
    {!touch && <p className="select-hint">Drag the hero to turn them</p>}
    <aside className="roster">
      {HERO_ORDER.map(id => {
        const h = HEROES[id], sm = summary(id);
        return <button key={id} className={`roster-card ${id === hero ? 'on' : ''}`} onClick={() => { if (id !== hero) { onHero(id); sfx.play('ui'); } }}>
          <span className="rc-face portrait"><HeroFace hero={id} /><b className="level-badge">{sm.level}</b></span>
          <span className="rc-text"><b>{h.name}</b><em>Level {sm.level} {h.title}</em><small>{sm.started ? sm.where : 'A new adventure'}</small></span>
        </button>;
      })}
    </aside>
    <footer className="select-foot">
      <button className="btn primary big enter" onClick={() => { sfx.play('ui'); onEnter(); }}>{me.started ? 'Enter world' : 'Begin adventure'} <b>→</b></button>
      <small>{me.started ? `${me.where} · ${me.gold} gold · ${'★'.repeat(me.stars)}${'☆'.repeat(Math.max(0, 9 - me.stars))}` : 'Every hero has their own level, bag and quests.'}</small>
    </footer>
  </main>;
}
