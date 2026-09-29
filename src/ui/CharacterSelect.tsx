import type { CSSProperties } from 'react';
import { HEROES, HERO_ORDER, SPELLS } from '../game/spells';
import { sfx } from '../game/audio';
import type { GearItem, GearSlot, HeroId, LevelId } from '../game/types';
import TitleBackdrop from '../TitleBackdrop';
import HeroStage from './HeroStage';
import { HeroFace } from './icons';

// Character select, in the spirit of an MMO login screen: the chosen hero stands on a rune pedestal in the middle,
// wearing the gear they have equipped; the roster sits on the right, and "Enter world" starts (or continues) that
// hero's own adventure.

export type HeroSummary = { started: boolean; level: number; gold: number; where: string; stars: number; equipped: Partial<Record<GearSlot, GearItem>>; points: number };
const TRAITS: Record<HeroId, Array<[string, number]>> = {
  mira: [['Range', 5], ['Toughness', 1], ['Magic', 5], ['Speed', 3]],
  kael: [['Range', 1], ['Toughness', 5], ['Might', 5], ['Speed', 3]],
  lyra: [['Range', 5], ['Toughness', 2], ['Control', 5], ['Speed', 3]],
  riven: [['Range', 2], ['Toughness', 3], ['Burst', 5], ['Speed', 4]],
  wren: [['Range', 5], ['Toughness', 3], ['Companion', 5], ['Speed', 5]],
};
const BACKDROP: Record<HeroId, LevelId> = { mira: 'summit', kael: 'meadow', lyra: 'woods', riven: 'ember', wren: 'meadow' };

export default function CharacterSelect({ hero, summary, touch, onHero, onEnter, onBack, practice = false }: { hero: HeroId; summary: (id: HeroId) => HeroSummary; touch: boolean; onHero: (h: HeroId) => void; onEnter: () => void; onBack: () => void; practice?: boolean }) {
  const info = HEROES[hero], me = summary(hero), worn = Object.keys(me.equipped).length;
  return <main className={`select-page hero-${hero}`}>
    <TitleBackdrop level={BACKDROP[hero]} />
    <div className="select-vignette" aria-hidden="true" />
    <header className="select-top">
      <button className="btn ghost" onClick={() => { sfx.play('page'); onBack(); }}>← Back</button>
      <small className="eyebrow">Choose your hero</small>
      <span />
    </header>
    <section className="select-info" key={`info-${hero}`}>
      <small>{practice ? 'Practice hero · all spells unlocked' : `Level ${me.level} · ${info.title}`}</small>
      <h1>{info.name}</h1>
      <p>{info.description}</p>
      <dl className="traits">{TRAITS[hero].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= v ? 'on' : ''} />)}</dd></div>)}</dl>
      <div className="select-spells">{info.spells.map(id => <span key={id} title={`${SPELLS[id].name}: ${SPELLS[id].description}`} style={{ '--spell': SPELLS[id].color } as CSSProperties}><b>{SPELLS[id].icon}</b>{!practice && <small>Lv {SPELLS[id].level}</small>}</span>)}</div>
      {me.started && <p className="select-extra">{worn ? `${worn}/8 pieces worn` : 'No gear worn yet'} · {me.points} achievement points</p>}
    </section>
    <HeroStage hero={hero} gear={me.equipped} mode="select" className="select-stage" />
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
      <button className="btn primary big enter" onClick={() => { sfx.play('ui'); onEnter(); }}>{practice ? 'Enter dummy world' : me.started ? 'Enter world' : 'Begin adventure'} <b>→</b></button>
      <small>{practice ? 'Test movement, damage and every spell. Adventure progress is untouched.' : me.started ? `${me.where} · ${me.gold} gold · ${'★'.repeat(me.stars)}${'☆'.repeat(Math.max(0, 12 - me.stars))}` : 'Every hero has their own level, bag and quests.'}</small>
    </footer>
  </main>;
}
