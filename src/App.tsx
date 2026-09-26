import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import GameCanvas from './game/GameCanvas';
import TitleBackdrop from './TitleBackdrop';
import { GameEngine } from './game/engine';
import { LEVEL_ORDER, WORLDS } from './game/worlds';
import { LEVEL_SPELL, SPELLS, SPELL_ORDER } from './game/spells';
import { clearSession, saveSession } from './game/storage';
import { sfx } from './game/audio';
import type { EngineEvent, GameSnapshot, LevelId, LevelStats, NoticeTone, SpellId, SpellState } from './game/types';

type Mode = 'title' | 'play' | 'victory' | 'ending';
type Save = { version: 2; done: Record<LevelId, boolean>; stars: Record<LevelId, number>; bestTime: Record<LevelId, number> };
type Dialogue = { speaker: string; portrait: string; lines: string[]; index: number; then?: 'complete' };
type Toast = { id: number; text: string; tone: NoticeTone };
const SAVE_KEY = 'starfall-grove-save-v2';
const ROMAN = ['', 'I', 'II', 'III'];
const blankSave = (): Save => ({ version: 2, done: { meadow: false, woods: false, summit: false }, stars: { meadow: 0, woods: 0, summit: 0 }, bestTime: { meadow: 0, woods: 0, summit: 0 } });
function getSave(): Save {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Partial<Save> | null;
    if (d?.version === 2) { const b = blankSave(); return { ...b, done: { ...b.done, ...d.done }, stars: { ...b.stars, ...d.stars }, bestTime: { ...b.bestTime, ...d.bestTime } }; }
    // Carry over progress from the original two-chapter save.
    const old = JSON.parse(localStorage.getItem('starfall-grove-save-v1') || 'null') as { meadowDone?: boolean; woodsDone?: boolean; meadowStars?: number; woodsStars?: number } | null;
    const s = blankSave();
    if (old) { s.done.meadow = !!old.meadowDone; s.done.woods = !!old.woodsDone; s.stars.meadow = old.meadowStars || 0; s.stars.woods = old.woodsStars || 0; }
    return s;
  } catch { return blankSave(); }
}
function saveNow(data: Save) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* local play remains available */ } }
const unlocked = (save: Save, id: LevelId) => { const i = LEVEL_ORDER.indexOf(id); return i === 0 || save.done[LEVEL_ORDER[i - 1]]; };
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const KEYMAP: Record<string, SpellId> = { j: 'spark', ' ': 'spark', shift: 'dash', k: 'dash', q: 'leaf', r: 'sunfire', f: 'shield', t: 'starfall' };

function App() {
  const [mode, setMode] = useState<Mode>('title');
  const [levelId, setLevelId] = useState<LevelId>('meadow');
  const [runKey, setRunKey] = useState(0);
  const [save, setSave] = useState<Save>(() => getSave());
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [typed, setTyped] = useState(0);
  const [paused, setPaused] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [journal, setJournal] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [muted, setMuted] = useState(sfx.isMuted());
  const [chapterBanner, setChapterBanner] = useState(0);
  const [zone, setZone] = useState<{ name: string; key: number } | null>(null);
  const [spellBanner, setSpellBanner] = useState<SpellId | null>(null);
  const [bossBanner, setBossBanner] = useState<{ name: string; title: string } | null>(null);
  const [stats, setStats] = useState<LevelStats | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const toastId = useRef(0);
  const world = WORLDS[levelId];

  const notify = useCallback((text: string, tone: NoticeTone = 'info') => {
    const id = ++toastId.current;
    setToasts(list => [...list.filter(t => t.text !== text).slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), tone === 'epic' ? 4200 : 2800);
  }, []);
  const onReady = useCallback((engine: GameEngine | null) => { engineRef.current = engine; }, []);
  const onSnapshot = useCallback((state: GameSnapshot) => setSnapshot(state), []);
  const onEvent = useCallback((event: EngineEvent) => {
    switch (event.type) {
      case 'dialogue': engineRef.current?.setMovement(0, 0); setStick({ x: 0, y: 0 }); setDialogue({ speaker: event.speaker, portrait: event.portrait, lines: event.lines, index: 0, then: event.then }); break;
      case 'notice': notify(event.text, event.tone); break;
      case 'zone': setZone(z => ({ name: event.name, key: (z?.key || 0) + 1 })); break;
      case 'spellLearned': setSpellBanner(event.spell); break;
      case 'bossIntro': setBossBanner({ name: event.name, title: event.title }); window.setTimeout(() => setBossBanner(null), 3000); break;
      case 'levelComplete': {
        clearSession(event.levelId); setStats(event.stats);
        setSave(prev => {
          const next: Save = { ...prev, done: { ...prev.done, [event.levelId]: true }, stars: { ...prev.stars, [event.levelId]: Math.max(prev.stars[event.levelId], event.stats.stars) }, bestTime: { ...prev.bestTime, [event.levelId]: prev.bestTime[event.levelId] ? Math.min(prev.bestTime[event.levelId], event.stats.time) : event.stats.time } };
          saveNow(next); return next;
        });
        setDialogue(null); setPaused(false); setMode('victory');
      }
    }
  }, [notify]);

  const startGame = (id: LevelId, fresh = false) => {
    sfx.unlock();
    if (fresh) clearSession(id);
    setLevelId(id); setRunKey(k => k + 1); setSnapshot(null); setDialogue(null); setPaused(false); setJournal(false); setStick({ x: 0, y: 0 });
    setSpellBanner(null); setBossBanner(null); setZone(null); setToasts([]); setChapterBanner(b => b + 1); setMode('play');
  };
  const newGame = () => { for (const id of LEVEL_ORDER) clearSession(id); const s = blankSave(); setSave(s); saveNow(s); startGame('meadow', true); };
  const leaveToTitle = () => { const e = engineRef.current; if (e && !e.quest.finaleDone) saveSession(e.world.id, e.exportSave()); setPaused(false); setMode('title'); };
  const nextLevel = () => { const i = LEVEL_ORDER.indexOf(levelId); if (i < LEVEL_ORDER.length - 1) startGame(LEVEL_ORDER[i + 1], true); else setMode('ending'); };
  const toggleMute = () => { const m = !muted; sfx.setMuted(m); setMuted(m); if (!m) sfx.play('pickup'); };
  const cast = (id: SpellId) => { if (!paused && !dialogue && !showSpell) engineRef.current?.cast(id); };

  // Chapter banner lifetime.
  const [showChapter, setShowChapter] = useState(false);
  useEffect(() => { if (!chapterBanner) return; setShowChapter(true); const t = window.setTimeout(() => setShowChapter(false), 3800); return () => window.clearTimeout(t); }, [chapterBanner]);
  useEffect(() => { if (!zone) return; const t = window.setTimeout(() => setZone(null), 2800); return () => window.clearTimeout(t); }, [zone]);
  // The spell reveal waits until the shrine dialogue is closed.
  const showSpell = spellBanner && !dialogue ? spellBanner : null;
  useEffect(() => { if (!showSpell) return; sfx.play('learn'); const t = window.setTimeout(() => setSpellBanner(null), 5200); return () => window.clearTimeout(t); }, [showSpell]);

  // Typewriter dialogue.
  const line = dialogue ? dialogue.lines[dialogue.index] : '';
  useEffect(() => {
    if (!dialogue) return;
    setTyped(0);
    let n = 0;
    const id = window.setInterval(() => { n += 1; setTyped(t => Math.max(t, n)); if (n % 4 === 0) sfx.play('talk'); if (n >= line.length) window.clearInterval(id); }, 16);
    return () => window.clearInterval(id);
  }, [dialogue, line]);
  const advanceDialogue = useCallback(() => {
    if (!dialogue) return;
    if (typed < line.length) { setTyped(line.length); return; }
    if (dialogue.index < dialogue.lines.length - 1) { setDialogue({ ...dialogue, index: dialogue.index + 1 }); return; }
    const then = dialogue.then; setDialogue(null);
    if (then === 'complete') engineRef.current?.celebrate();
  }, [dialogue, typed, line]);

  const keys = useRef(new Set<string>());
  const syncKeys = () => {
    const k = keys.current;
    const x = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    const y = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('w') ? 1 : 0);
    engineRef.current?.setMovement(x, y);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (showSpell && (k === 'enter' || k === ' ' || k === 'escape')) { setSpellBanner(null); e.preventDefault(); return; }
    if (dialogue) { if (k === 'enter' || k === ' ' || k === 'e') { advanceDialogue(); e.preventDefault(); } if (k === 'escape') setDialogue(null); return; }
    if (k === 'm') { toggleMute(); return; }
    if (paused) { if (k === 'escape') setPaused(false); return; }
    if (k === 'tab' || k === 'l') { setJournal(v => !v); e.preventDefault(); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys.current.add(k); syncKeys(); e.preventDefault(); }
    if (KEYMAP[k]) { if (k === ' ') e.preventDefault(); if (!e.repeat || KEYMAP[k] === 'spark') cast(KEYMAP[k]); }
    if (e.repeat) return;
    if (k === 'e' || k === 'enter') engineRef.current?.interact();
    if (k === 'escape') { keys.current.clear(); engineRef.current?.setMovement(0, 0); setStick({ x: 0, y: 0 }); setJournal(false); setPaused(true); }
  };
  const keyHandler = useRef(onKeyDown); keyHandler.current = onKeyDown;
  useEffect(() => {
    if (mode !== 'play') return;
    const down = (e: KeyboardEvent) => keyHandler.current(e);
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); syncKeys(); };
    const blur = () => { keys.current.clear(); engineRef.current?.setMovement(0, 0); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); keys.current.clear(); engineRef.current?.setMovement(0, 0); };
  }, [mode]);
  // Paused/dialogue states drop held keys so Mira never walks on by herself.
  useEffect(() => { if (paused || dialogue) keys.current.clear(); }, [paused, dialogue]);

  const isGamePaused = paused || !!dialogue || mode !== 'play';
  const stickMove = (el: HTMLDivElement, clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect();
    let x = (clientX - r.left - r.width / 2) / (r.width * .36), y = (clientY - r.top - r.height / 2) / (r.height * .36);
    const mag = Math.hypot(x, y); if (mag > 1) { x /= mag; y /= mag; }
    setStick({ x, y }); engineRef.current?.setMovement(x, y);
  };
  const stickEnd = () => { setStick({ x: 0, y: 0 }); engineRef.current?.setMovement(0, 0); };

  return <div className={`app-shell mode-${mode}`}>
    {mode === 'title' && <TitleScreen save={save} muted={muted} onToggleMute={toggleMute} onStart={startGame} onNewGame={newGame} />}

    {mode === 'play' && <main className={`play-page theme-${levelId}`}>
      <section className="game-stage" onPointerDown={() => sfx.unlock()}>
        <GameCanvas levelId={levelId} runKey={runKey} paused={isGamePaused} onReady={onReady} onSnapshot={onSnapshot} onEvent={onEvent} />

        <div className="hud-top">
          <Vitals snapshot={snapshot} />
          <div className="hud-center">
            <div className="objective">
              <small>Chapter {ROMAN[world.chapter]} · {world.title}</small>
              <strong>{snapshot?.objectives[1] || 'Speak with the villagers to begin.'}</strong>
            </div>
            {snapshot?.boss && <BossBar boss={snapshot.boss} />}
            {zone && <div className="zone-banner" key={zone.key}><span>✦</span>{zone.name}<span>✦</span></div>}
          </div>
          <div className="hud-buttons">
            <button className="icon-button" onClick={() => setJournal(v => !v)} aria-label="Quest journal" title="Journal (Tab)">📜</button>
            <button className="icon-button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title="Sound (M)">{muted ? '🔇' : '🔊'}</button>
            <button className="icon-button" onClick={() => { engineRef.current?.setMovement(0, 0); setPaused(true); }} aria-label="Pause" title="Pause (Esc)">❚❚</button>
          </div>
        </div>

        {snapshot && snapshot.combo >= 3 && <div className="combo" key={snapshot.combo}><b>{snapshot.combo}</b><small>COMBO</small></div>}

        <div className="toasts">{toasts.map(t => <div key={t.id} className={`toast tone-${t.tone}`}>{t.text}</div>)}</div>

        {snapshot?.nearName && !dialogue && <button className="near-prompt" onClick={() => engineRef.current?.interact()}>
          <kbd>E</kbd><span>{snapshot.nearAction}</span><b>{snapshot.nearName}</b>
        </button>}

        <div className="spellbar">{snapshot?.spells.map(s => <SpellButton key={s.id} spell={s} onCast={cast} />)}</div>

        <div className="touch-controls">
          <div className="virtual-stick"
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); stickMove(e.currentTarget, e.clientX, e.clientY); }}
            onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) stickMove(e.currentTarget, e.clientX, e.clientY); }}
            onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); stickEnd(); }}
            onPointerCancel={stickEnd} aria-label="Move with the virtual joystick">
            <i className="stick-thumb" style={{ transform: `translate(${stick.x * 30}px,${stick.y * 30}px)` }} />
          </div>
          <div className="touch-actions">{snapshot?.spells.map(s => <SpellButton key={s.id} spell={s} onCast={cast} touch />)}</div>
        </div>

        {showChapter && <div className="chapter-banner" key={chapterBanner}>
          <small>Chapter {ROMAN[world.chapter]}</small><h2>{world.title}</h2><p>{world.subtitle}</p><i />
        </div>}

        {bossBanner && <div className="boss-banner"><div className="letterbox top" /><div className="letterbox bottom" /><div className="boss-name"><small>{bossBanner.title}</small><h2>{bossBanner.name}</h2></div></div>}

        {showSpell && <div className="spell-banner" onClick={() => setSpellBanner(null)} style={{ '--spell': SPELLS[showSpell].color } as CSSProperties}>
          <div className="spell-card">
            <div className="spell-rays" /><div className="spell-icon">{SPELLS[showSpell].icon}</div>
            <small>New spell learned</small><h2>{SPELLS[showSpell].name}</h2><p>{SPELLS[showSpell].description}</p>
            <kbd>Press {SPELLS[showSpell].key}</kbd>
          </div>
        </div>}

        {dialogue && <div className="dialogue" onClick={advanceDialogue} role="dialog" aria-modal="true">
          <div className="dialogue-portrait">{dialogue.portrait}</div>
          <div className="dialogue-body">
            <strong>{dialogue.speaker}</strong>
            <p>{line.slice(0, typed)}<span className="caret" /></p>
            <div className="dialogue-foot"><span>{dialogue.index + 1} / {dialogue.lines.length}</span><em>{typed < line.length ? 'Click to skip' : dialogue.index < dialogue.lines.length - 1 ? 'Continue ▸' : 'Close ▸'}</em></div>
          </div>
        </div>}

        {journal && <Journal snapshot={snapshot} levelId={levelId} onClose={() => setJournal(false)} />}

        {paused && <div className="overlay"><div className="panel pause-panel">
          <small className="eyebrow">Paused</small><h2>Take a breath.</h2><p>Your adventure is saved. The forest can wait.</p>
          <div className="controls-grid">
            <span><kbd>WASD</kbd> Move</span><span><kbd>J</kbd>/<kbd>Space</kbd> Spark</span><span><kbd>Shift</kbd> Dash</span><span><kbd>Q</kbd> Leaf Burst</span>
            <span><kbd>R</kbd> Sunfire</span><span><kbd>F</kbd> Moss Shield</span><span><kbd>T</kbd> Starfall</span><span><kbd>E</kbd> Interact</span>
          </div>
          <button className="btn primary" onClick={() => setPaused(false)}>Resume adventure <b>→</b></button>
          <div className="pause-row">
            <button className="btn ghost" onClick={toggleMute}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            <button className="btn ghost" onClick={() => startGame(levelId, true)}>↻ Restart chapter</button>
            <button className="btn ghost" onClick={leaveToTitle}>⌂ Title</button>
          </div>
        </div></div>}
      </section>
    </main>}

    {mode === 'victory' && <main className="menu-page">
      <TitleBackdrop level={levelId} />
      <Confetti />
      <div className="panel victory-panel">
        <small className="eyebrow">Chapter {ROMAN[world.chapter]} complete</small>
        <h1>{world.script.victory.title}</h1>
        <p>{world.script.victory.text}</p>
        <div className="star-row">{[1, 2, 3].map(n => <span key={n} className={n <= (stats?.stars || 1) ? 'on' : ''} style={{ animationDelay: `${.3 + n * .25}s` }}>★</span>)}</div>
        <div className="stat-row">
          <div><b>{fmtTime(stats?.time || 0)}</b><small>Time</small></div>
          <div><b>{stats?.defeated || 0}/{stats?.totalEnemies || 0}</b><small>Creatures</small></div>
          <div><b style={{ color: SPELLS[LEVEL_SPELL[levelId]].color }}>{SPELLS[LEVEL_SPELL[levelId]].icon}</b><small>{SPELLS[LEVEL_SPELL[levelId]].name}</small></div>
        </div>
        <div className="menu-actions">
          <button className="btn primary" onClick={nextLevel}>{levelId === 'summit' ? 'See the ending' : `Begin Chapter ${ROMAN[world.chapter + 1]}`} <b>→</b></button>
          <button className="btn ghost" onClick={() => setMode('title')}>Back to title</button>
        </div>
      </div>
    </main>}

    {mode === 'ending' && <main className="menu-page">
      <TitleBackdrop level="summit" />
      <Confetti />
      <div className="panel victory-panel">
        <small className="eyebrow">The valley remembers</small>
        <h1>Every light <em>is shining.</em></h1>
        <p>You restored the beacon, rang the ancient bell and returned the fallen star to the sky. Mira and the fox have become the valley’s newest legends.</p>
        <div className="star-row">{LEVEL_ORDER.map(id => <span key={id} className="on" title={WORLDS[id].title}>{'★'.repeat(save.stars[id] || 1)}</span>)}</div>
        <div className="menu-actions">
          <button className="btn primary" onClick={newGame}>Play again <b>↻</b></button>
          <button className="btn ghost" onClick={() => setMode('title')}>Return to title</button>
        </div>
      </div>
    </main>}
  </div>;
}

function TitleScreen({ save, muted, onToggleMute, onStart, onNewGame }: { save: Save; muted: boolean; onToggleMute: () => void; onStart: (id: LevelId, fresh?: boolean) => void; onNewGame: () => void }) {
  const next = LEVEL_ORDER.find(id => !save.done[id] && unlocked(save, id)) || 'meadow';
  const started = LEVEL_ORDER.some(id => save.done[id]);
  return <main className="menu-page title-page">
    <TitleBackdrop level={next} />
    <header className="title-top">
      <div className="brand"><span className="brand-gem">✦</span><span><strong>Starfall Grove</strong><small>A storybook action RPG</small></span></div>
      <button className="icon-button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</button>
    </header>
    <section className="title-hero">
      <small className="eyebrow">Three chapters · three spells · three guardians</small>
      <h1 className="title-logo"><span>Starfall</span><span>Grove</span></h1>
      <p>A fallen star has dimmed the valley. Guide Mira and her fox through sunlit meadows, whispering woods and the silver summit — learn a new spell in every chapter and face the guardians waiting in the dark.</p>
      <div className="menu-actions">
        <button className="btn primary big" onClick={() => onStart(next)}>{started ? `Continue · ${WORLDS[next].title}` : 'Begin the adventure'} <b>→</b></button>
        {started && <button className="btn ghost" onClick={onNewGame}>New game</button>}
      </div>
    </section>
    <section className="chapter-cards">
      {LEVEL_ORDER.map(id => {
        const w = WORLDS[id], open = unlocked(save, id), sp = SPELLS[LEVEL_SPELL[id]];
        return <button key={id} className={`chapter-card theme-${id} ${open ? '' : 'locked'} ${save.done[id] ? 'done' : ''}`} disabled={!open} onClick={() => onStart(id)} style={{ '--spell': sp.color } as CSSProperties}>
          <span className="card-art"><i /><i /><i /></span>
          <small>Chapter {ROMAN[w.chapter]}</small>
          <strong>{w.title}</strong>
          <em>{w.subtitle}</em>
          <span className="card-foot">
            <span className="card-spell"><b>{sp.icon}</b>{sp.name}</span>
            <span className="card-stars">{open ? [1, 2, 3].map(n => <i key={n} className={n <= save.stars[id] ? 'on' : ''}>★</i>) : '🔒'}</span>
          </span>
        </button>;
      })}
    </section>
    <footer className="title-foot"><span><kbd>WASD</kbd> move</span><span><kbd>J</kbd> spark</span><span><kbd>Shift</kbd> dash</span><span><kbd>Q R F T</kbd> spells</span><span><kbd>E</kbd> interact</span></footer>
  </main>;
}

function Vitals({ snapshot }: { snapshot: GameSnapshot | null }) {
  const hp = snapshot?.hp ?? 5, max = snapshot?.maxHp ?? 5, mana = snapshot?.mana ?? 80, maxMana = snapshot?.maxMana ?? 100;
  return <div className={`vitals ${hp <= 1 ? 'critical' : ''}`}>
    <div className="portrait"><span>🧙‍♀️</span>{snapshot?.shield && <i className="shield-ring" />}</div>
    <div className="bars">
      <div className="hearts">{Array.from({ length: max }, (_, i) => <span key={i} className={i < hp ? 'full' : 'empty'}>♥</span>)}</div>
      <div className="mana"><i style={{ width: `${(mana / maxMana) * 100}%` }} /><b>{mana}</b></div>
    </div>
  </div>;
}

function BossBar({ boss }: { boss: NonNullable<GameSnapshot['boss']> }) {
  const pct = (boss.hp / boss.maxHp) * 100;
  return <div className={`boss-bar phase-${boss.phase}`}>
    <div className="boss-label"><strong>{boss.name}</strong>{boss.phase === 2 && <em>ENRAGED</em>}</div>
    <div className="boss-track"><i className="lag" style={{ width: `${pct}%` }} /><i className="fill" style={{ width: `${pct}%` }} /><span className="mark" /></div>
  </div>;
}

function SpellButton({ spell, onCast, touch }: { spell: SpellState; onCast: (id: SpellId) => void; touch?: boolean }) {
  const ready = spell.unlocked && spell.cooldown <= 0 && spell.affordable;
  const style = { '--cd': `${spell.cooldown * 360}deg`, '--spell': SPELLS[spell.id].color } as CSSProperties;
  return <button className={`spell spell-${spell.id} ${ready ? 'ready' : ''} ${spell.unlocked ? '' : 'locked'} ${!spell.affordable ? 'poor' : ''} ${touch ? 'touch' : ''}`}
    style={style} onPointerDown={e => { e.preventDefault(); onCast(spell.id); }} aria-label={spell.name} title={`${spell.name} (${spell.key})${spell.cost ? ` · ${spell.cost} mana` : ''}`}>
    <span className="spell-icon-wrap"><b>{spell.unlocked ? spell.icon : '🔒'}</b>{spell.cooldown > 0 && <i className="cd" />}</span>
    {!touch && <kbd>{spell.key === 'Shift' ? '⇧' : spell.key}</kbd>}
    {spell.cost > 0 && spell.unlocked && <small>{spell.cost}</small>}
  </button>;
}

function Journal({ snapshot, levelId, onClose }: { snapshot: GameSnapshot | null; levelId: LevelId; onClose: () => void }) {
  const w = WORLDS[levelId];
  return <aside className="journal">
    <div className="journal-head"><strong>Journal</strong><button className="icon-button" onClick={onClose} aria-label="Close journal">✕</button></div>
    {snapshot && <>
      <section><small>Main quest · {snapshot.objectives[0]}</small><p className="main-q">{snapshot.objectives[1]}</p><p className="sub-q">{snapshot.objectives[2]}</p></section>
      <section><small>Small quests</small>{snapshot.sideQuests.map((q, i) => <div key={i} className={`side ${q.done ? 'done' : ''}`}><span>{q.done ? '✓' : '○'}</span><div><b>{q.name}</b><em>{q.status}</em></div></div>)}</section>
      <section><small>Spellbook</small><div className="spellbook">{SPELL_ORDER.map(id => { const s = snapshot.spells.find(x => x.id === id)!; return <div key={id} className={`book-spell ${s.unlocked ? '' : 'locked'}`} style={{ '--spell': SPELLS[id].color } as CSSProperties}><b>{s.unlocked ? SPELLS[id].icon : '?'}</b><div><strong>{s.unlocked ? SPELLS[id].name : 'Unknown spell'} <kbd>{SPELLS[id].key}</kbd></strong><em>{s.unlocked ? SPELLS[id].description : `Learned in Chapter ${ROMAN[SPELLS[id].chapter]}`}</em></div></div>; })}</div></section>
      <section className="fox-tip"><small>🦊 Fox’s field note</small><p>“{w.script.tip}”</p></section>
      <section className="journal-stats"><span>Creatures cleared</span><b>{snapshot.defeated} / {snapshot.totalEnemies}</b></section>
    </>}
  </aside>;
}

function Confetti() {
  const pieces = Array.from({ length: 42 }, (_, i) => i);
  return <div className="confetti" aria-hidden="true">{pieces.map(i => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * .25}s`, animationDuration: `${3.2 + (i % 5) * .6}s`, background: ['#ffd35c', '#ff9aa8', '#9fd8ff', '#b9f29d', '#c9b6ff'][i % 5] }} />)}</div>;
}

export default App;
