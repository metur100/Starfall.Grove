import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { GameEngine } from '../game/engine';
import { ITEMS, ITEM_ORDER } from '../game/items';
import { RARITY, RARITY_ORDER, SLOT_LEFT, SLOT_NAMES, SLOT_RIGHT, STAT_NAMES, gearScore, statText } from '../game/gear';
import { MAX_RANK, UPGRADES, UPGRADE_ORDER } from '../game/progression';
import { HEROES, SPELLS } from '../game/spells';
import { LEVEL_ORDER, WORLDS } from '../game/worlds';
import { sfx } from '../game/audio';
import type { GameSnapshot, GearItem, GearSlot, GearStat, ItemId } from '../game/types';
import HeroStage from './HeroStage';
import { GearIcon, HeroFace, ItemIcon } from './icons';

// WoW-style character sheet and bag in one screen: the hero stands in the middle with the eight equipment slots around
// them, and the bag (a grid of slots that scrolls) or the full stats sit beside it. Tapping anything opens its card.

export type SheetTab = 'bag' | 'stats';
type Pick = { kind: 'item'; id: ItemId } | { kind: 'gear'; uid: string } | { kind: 'slot'; slot: GearSlot } | null;
const ROMAN = ['', 'I', 'II', 'III'];
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const rarityRank = (g: GearItem) => RARITY_ORDER.indexOf(g.rarity);

export default function CharacterScreen({ snapshot: s, engine, initial, touch, onUse, onClose }: { snapshot: GameSnapshot; engine: GameEngine; initial: SheetTab; touch: boolean; onUse: (id: ItemId) => void; onClose: () => void }) {
  const [tab, setTab] = useState<SheetTab>(initial);
  const [pick, setPick] = useState<Pick>(null);
  /** PC: the piece under the mouse, compared in a floating tooltip. */
  const [tip, setTip] = useState<{ g: GearItem; worn: boolean; x: number; y: number } | null>(null);
  const hover = (g: GearItem | undefined, worn: boolean) => touch || !g ? {} : {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ g, worn, x: r.right, y: r.top }); },
    onMouseLeave: () => setTip(null),
  };
  useEffect(() => setTab(initial), [initial]);
  useEffect(() => setTip(null), [pick]);
  const info = HEROES[s.hero];
  const stacks = ITEM_ORDER.filter(id => (s.items.find(i => i.id === id)?.count ?? 0) > 0);
  const gear = useMemo(() => [...s.gear].sort((a, b) => rarityRank(b) - rarityRank(a) || gearScore(b) - gearScore(a)), [s.gear]);
  const used = stacks.length + gear.length;
  const count = (id: ItemId) => s.items.find(i => i.id === id)?.count ?? 0;
  const better = (g: GearItem) => gearScore(g) > (s.equipped[g.slot] ? gearScore(s.equipped[g.slot]!) : 0);
  const worse = (g: GearItem) => !!s.equipped[g.slot] && gearScore(g) < gearScore(s.equipped[g.slot]!);
  const choose = (p: Pick) => { sfx.play('ui'); setPick(p); };
  const worn = Object.values(s.equipped).filter(Boolean) as GearItem[];
  const avg = worn.length ? Math.round(worn.reduce((n, g) => n + g.ilvl, 0) / 8) : 0;

  const slotButton = (slot: GearSlot) => {
    const g = s.equipped[slot];
    return <button key={slot} {...hover(g, true)} className={`doll-slot ${g ? `r-${g.rarity}` : 'empty'} ${pick?.kind === 'slot' && pick.slot === slot ? 'picked' : ''}`} onClick={() => choose({ kind: 'slot', slot })} aria-label={g ? `${SLOT_NAMES[slot]}: ${g.name}` : `${SLOT_NAMES[slot]}: empty`} style={{ '--r': g ? RARITY[g.rarity].color : 'transparent' } as CSSProperties}>
      <GearIcon slot={slot} item={g} size={30} />
      {!touch && <small>{SLOT_NAMES[slot]}</small>}
    </button>;
  };

  return <div className="char-screen" role="dialog" aria-modal="true" aria-label="Character and bag">
    <header className="char-head">
      <span className="char-face portrait"><HeroFace hero={s.hero} /><b className="level-badge">{s.level}</b></span>
      <span className="char-title"><b>{info.name}</b><em>Level {s.level} {info.title}</em></span>
      <div className="char-xp xp"><i style={{ width: s.xpNext ? `${(s.xp / s.xpNext) * 100}%` : '100%' }} /><b>{s.xpNext ? `${s.xp} / ${s.xpNext} XP` : 'MAX LEVEL'}</b></div>
      <span className="gold-chip big"><i />{s.gold}</span>
      <button className="icon-button" onClick={onClose} aria-label="Close">✕</button>
    </header>
    <div className="char-body">
      <section className="doll">
        <div className="doll-col">{SLOT_LEFT.map(slotButton)}</div>
        <div className="doll-center">
          <HeroStage hero={s.hero} gear={s.equipped} mode="sheet" />
          <div className="doll-foot"><span><b>{Math.ceil(s.hp)}</b> health</span><span><b>+{Math.round((s.stats.power - 1) * 100)}%</b> power</span><span><b>{Math.round(s.stats.guard * 100)}%</b> armor</span>{avg > 0 && <span><b>{avg}</b> item lv</span>}</div>
        </div>
        <div className="doll-col">{SLOT_RIGHT.map(slotButton)}</div>
      </section>
      <section className="char-side">
        <div className="journal-tabs">
          <button className={tab === 'bag' ? 'on' : ''} onClick={() => { setTab('bag'); sfx.play('page'); }}>🎒 Bag <small>{used}/{s.bagSize}</small></button>
          <button className={tab === 'stats' ? 'on' : ''} onClick={() => { setTab('stats'); sfx.play('page'); }}>Stats</button>
        </div>
        {tab === 'bag' ? <div className="bag-grid" role="list">
          {stacks.map(id => <button key={id} role="listitem" className={`bag-slot consumable ${pick?.kind === 'item' && pick.id === id ? 'picked' : ''} ${s.quick === id ? 'quick' : ''}`} style={{ '--c': ITEMS[id].color } as CSSProperties} onClick={() => choose({ kind: 'item', id })} aria-label={`${ITEMS[id].name} ×${count(id)}`}>
            <ItemIcon id={id} size={32} /><b className="stack">{count(id)}</b>{!touch && ITEMS[id].key && <kbd>{ITEMS[id].key}</kbd>}
          </button>)}
          {gear.map(g => <button key={g.uid} {...hover(g, false)} role="listitem" className={`bag-slot r-${g.rarity} ${pick?.kind === 'gear' && pick.uid === g.uid ? 'picked' : ''}`} style={{ '--r': RARITY[g.rarity].color } as CSSProperties} onClick={() => choose({ kind: 'gear', uid: g.uid })} aria-label={g.name}>
            <GearIcon slot={g.slot} item={g} size={32} />{better(g) ? <i className="upgrade-arrow" title="Better than what you wear">▲</i> : worse(g) && <i className="upgrade-arrow down" title="Weaker than what you wear">▼</i>}
          </button>)}
          {Array.from({ length: Math.max(0, s.bagSize - used) }, (_, i) => <span key={`e${i}`} className="bag-slot free" aria-hidden="true" />)}
        </div> : <StatsPane s={s} engine={engine} />}
      </section>
    </div>
    {pick && <ItemCard pick={pick} s={s} engine={engine} touch={touch} onUse={onUse} onDone={() => setPick(null)} />}
    {tip && !pick && <GearTip tip={tip} worn={tip.worn ? null : s.equipped[tip.g.slot]} />}
  </div>;
}

/** Stat lines of a piece, each compared with what is worn in that slot. */
export function StatLines({ item, against }: { item: GearItem; against?: GearItem | null }) {
  const keys = [...new Set([...Object.keys(item.stats), ...Object.keys(against?.stats || {})])] as GearStat[];
  return <ul className="stat-lines">{keys.map(k => {
    const v = item.stats[k] || 0, o = against ? against.stats[k] || 0 : v, d = Math.round((v - o) * 10) / 10;
    if (!v && !d) return null;
    return <li key={k} className={v ? '' : 'lost'}>{v ? statText(k, v) : `${STAT_NAMES[k]}`}{against && d !== 0 && <em className={d > 0 ? 'up' : 'down'}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}</em>}</li>;
  })}</ul>;
}
/** The verdict at a glance: an upgrade (green ▲), weaker (red ▼), or about the same, by overall item score. */
export function ScoreLine({ item, against }: { item: GearItem; against?: GearItem | null }) {
  if (!against) return <p className="score-line up">▲ Upgrade · your {SLOT_NAMES[item.slot].toLowerCase()} slot is empty</p>;
  const d = Math.round(gearScore(item) - gearScore(against));
  if (d === 0) return <p className="score-line">= About the same as your {against.name}</p>;
  return <p className={`score-line ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? `▲ Upgrade · +${d}` : `▼ Weaker · −${-d}`} item score than your {against.name}</p>;
}
/** PC tooltip: the piece under the mouse, its stats compared with what is worn in that slot. */
function GearTip({ tip, worn }: { tip: { g: GearItem; worn: boolean; x: number; y: number }; worn?: GearItem | null }) {
  const w = 300, left = tip.x + 12 + w > window.innerWidth ? Math.max(8, tip.x - w - 70) : tip.x + 12, top = Math.min(tip.y, window.innerHeight - 280);
  return <div className="gear-tip" style={{ left, top, width: w }} role="tooltip">
    <GearHead g={tip.g} worn={tip.worn} />
    <StatLines item={tip.g} against={tip.worn ? undefined : worn} />
    {!tip.worn && <ScoreLine item={tip.g} against={worn} />}
    {!tip.worn && worn && <div className="tip-worn"><small>Currently worn</small><b style={{ color: RARITY[worn.rarity].color }}>{worn.name}</b><StatLines item={worn} /></div>}
    <em className="tip-hint">{tip.worn ? 'Click to take it off' : 'Click to equip or throw away'}</em>
  </div>;
}

function ItemCard({ pick, s, engine, touch, onUse, onDone }: { pick: NonNullable<Pick>; s: GameSnapshot; engine: GameEngine; touch: boolean; onUse: (id: ItemId) => void; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
  // The picked thing can vanish (last potion drunk, piece equipped): then the card closes itself.
  const gone = pick.kind === 'item' ? !(s.items.find(i => i.id === pick.id)?.count) : pick.kind === 'gear' ? !s.gear.some(x => x.uid === pick.uid) : false;
  useEffect(() => { if (gone) onDone(); }, [gone, onDone]);
  if (gone) return null;
  let body: ReactNode = null;
  if (pick.kind === 'item') {
    const it = ITEMS[pick.id], n = s.items.find(i => i.id === pick.id)?.count ?? 0;
    body = <>
      <div className="card-top"><span className="card-icon" style={{ '--c': it.color } as CSSProperties}><ItemIcon id={pick.id} size={40} /></span><span><b style={{ color: it.color }}>{it.name}</b><small>{it.kind === 'bomb' ? 'Bomb' : it.kind === 'charm' ? 'Charm' : 'Potion'} · ×{n}{!touch && it.key ? ` · key ${it.key}` : ''}</small></span></div>
      <p>{it.description}</p>
      <div className="card-actions">
        {pick.id !== 'phoenixFeather' && <button className="btn primary" onClick={() => { onUse(pick.id); onDone(); }}>{it.kind === 'bomb' ? 'Throw' : 'Use'}</button>}
        {pick.id !== 'healthPotion' && <button className="btn ghost" disabled={s.quick === pick.id} onClick={() => engine.setQuick(pick.id)}>{s.quick === pick.id ? '✓ On quick button' : 'Put on quick button'}</button>}
      </div>
    </>;
  } else if (pick.kind === 'gear') {
    const g = s.gear.find(x => x.uid === pick.uid)!;
    const cur = s.equipped[g.slot];
    body = <>
      <GearHead g={g} />
      <StatLines item={g} against={cur} />
      <ScoreLine item={g} against={cur} />
      {cur && <div className="tip-worn"><small>Currently worn</small><b style={{ color: RARITY[cur.rarity].color }}>{cur.name}</b><StatLines item={cur} /></div>}
      <div className="card-actions">
        <button className="btn primary" onClick={() => { engine.equip(g.uid); onDone(); }}>Equip</button>
        <button className={`btn ghost danger ${confirm ? 'armed' : ''}`} onClick={() => { if (confirm) { engine.discardGear(g.uid); onDone(); } else setConfirm(true); }}>{confirm ? 'Tap again to throw away' : 'Throw away'}</button>
      </div>
    </>;
  } else {
    const g = s.equipped[pick.slot];
    body = g ? <>
      <GearHead g={g} worn />
      <StatLines item={g} />
      <div className="card-actions"><button className="btn ghost" onClick={() => { engine.unequip(pick.slot); onDone(); }}>Take off</button></div>
    </> : <>
      <div className="card-top"><span className="card-icon"><GearIcon slot={pick.slot} size={40} /></span><span><b>{SLOT_NAMES[pick.slot]}</b><small>Empty slot</small></span></div>
      <p>Nothing worn here yet. Creatures, chests and guardians drop equipment, and every side quest rewards a rare piece. Open the bag and tap a piece to equip it.</p>
    </>;
  }
  return <div className="item-card-wrap" onClick={onDone}><div className="item-card" onClick={e => e.stopPropagation()}>{body}<button className="icon-button card-close" onClick={onDone} aria-label="Close">✕</button></div></div>;
}
function GearHead({ g, worn }: { g: GearItem; worn?: boolean }) {
  const r = RARITY[g.rarity];
  return <div className="card-top"><span className="card-icon" style={{ '--c': r.color } as CSSProperties}><GearIcon slot={g.slot} item={g} size={40} /></span><span><b style={{ color: r.color }}>{g.name}</b><small>{r.name} {SLOT_NAMES[g.slot].toLowerCase()} · item level {g.ilvl}{worn ? ' · worn' : ''}</small></span></div>;
}

function StatsPane({ s, engine }: { s: GameSnapshot; engine: GameEngine }) {
  const w = WORLDS[LEVEL_ORDER[Math.min(2, s.chapter - 1)]], here = WORLDS[s.region], st = s.stats, info = HEROES[s.hero];
  const rows: Array<[string, string]> = [
    ['Health', `${Math.ceil(s.hp)} / ${s.maxHp}`], [info.resource, `${s.mana} / ${s.maxMana}`], [`${info.resource} regeneration`, `${st.regen.toFixed(1)} / s`],
    ['Power', `+${Math.round((st.power - 1) * 100)}%`], [`${SPELLS[info.spells[0]].name} damage`, `${st.spark}`], ['Critical chance', `${Math.round(st.crit * 100)}%`],
    ['Move speed', `${Math.round(st.speed * 100)}%`], ['Damage blocked', `${Math.round(st.guard * 100)}%`], ['Abilities known', `${s.spells.filter(x => x.unlocked).length} / ${s.spells.length}`],
  ];
  const trip: Array<[string, string]> = [
    ['Chapter', `${ROMAN[w.chapter]} · ${w.title}`], ['You are in', here.title], ['Time played', fmtTime(st.elapsed)], ['Side quests done', `${st.questsDone} / ${st.totalQuests}`],
    ['Creatures defeated', `${s.defeated}`], ['Places discovered', `${s.discovered} / ${s.totalPlaces}`], ['Chests opened', `${s.chests} / ${s.totalChests}`],
  ];
  const gearTotals = (Object.values(s.equipped).filter(Boolean) as GearItem[]).reduce<Partial<Record<GearStat, number>>>((t, g) => { for (const [k, v] of Object.entries(g.stats) as Array<[GearStat, number]>) t[k] = Math.round(((t[k] || 0) + v) * 10) / 10; return t; }, {});
  return <div className="stats-pane">
    <section><small>Attributes</small><dl className="stat-list">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
    <section><small>From equipment</small>{Object.keys(gearTotals).length ? <dl className="stat-list">{(Object.entries(gearTotals) as Array<[GearStat, number]>).map(([k, v]) => <div key={k}><dt>{STAT_NAMES[k]}</dt><dd>{statText(k, v).replace(` ${STAT_NAMES[k]}`, '')}</dd></div>)}</dl> : <p className="panel-note">Nothing worn yet.</p>}</section>
    <section><small>Smith upgrades</small><dl className="stat-list">{UPGRADE_ORDER.map(id => <div key={id}><dt>{UPGRADES[id].name}</dt><dd>Rank {engine.upgradeRank(id)} / {MAX_RANK}</dd></div>)}</dl></section>
    {!!s.buffs.length && <section><small>Active effects</small><dl className="stat-list">{s.buffs.map(b => <div key={b.id}><dt>{ITEMS[b.id].name}</dt><dd>{Math.ceil(b.time)}s</dd></div>)}</dl></section>}
    <section><small>Adventure</small><dl className="stat-list">{trip.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
  </div>;
}
