import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import GameCanvas from './game/GameCanvas';
import TitleBackdrop from './TitleBackdrop';
import { GameEngine } from './game/engine';
import { LEVEL_ORDER, WORLDS } from './game/worlds';
import { SPELLS, SPELL_ORDER } from './game/spells';
import { ITEMS, ITEM_ORDER } from './game/items';
import { DECOR_LEVELS, QUALITIES, isTouch, loadGraphics, saveGraphics, type GraphicsSettings } from './game/graphics';
import { clearSession, loadSession, saveSession } from './game/storage';
import { MAX_RANK, UPGRADES, UPGRADE_ORDER, loadProfile, resetProfile, upgradeCost } from './game/progression';
import { MAIN_COLOR, SIDE_COLOR, drawWorldMap } from './game/render';
import { sfx } from './game/audio';
import { music } from './game/music';
import type { EngineEvent, GameSnapshot, ItemId, LevelStats, NoticeTone, QuestOffer, QuestRow, RegionId, ShopKind, SpellId, SpellState } from './game/types';

type Mode = 'title' | 'play' | 'ending';
type Save = { version: 2; done: Record<RegionId, boolean>; stars: Record<RegionId, number>; bestTime: Record<RegionId, number> };
type Dialogue = { speaker: string; portrait: string; lines: string[]; index: number; then?: 'complete'; offer?: QuestOffer };
type Toast = { id: number; text: string; tone: NoticeTone };
type Panel = 'bag' | 'hero' | 'shop' | null;
type Shop = { kind: ShopKind; name: string; portrait: string };
type Victory = { region: RegionId; stats: LevelStats };
const SAVE_KEY = 'starfall-grove-save-v2';
const ROMAN = ['', 'I', 'II', 'III'];
const blankSave = (): Save => ({ version: 2, done: { meadow: false, woods: false, summit: false }, stars: { meadow: 0, woods: 0, summit: 0 }, bestTime: { meadow: 0, woods: 0, summit: 0 } });
function getSave(): Save {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Partial<Save> | null;
    if (d?.version === 2) { const b = blankSave(); return { ...b, done: { ...b.done, ...d.done }, stars: { ...b.stars, ...d.stars }, bestTime: { ...b.bestTime, ...d.bestTime } }; }
    return blankSave();
  } catch { return blankSave(); }
}
function saveNow(data: Save) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* local play remains available */ } }
const unlocked = (save: Save, id: RegionId) => { const i = LEVEL_ORDER.indexOf(id); return i === 0 || save.done[LEVEL_ORDER[i - 1]]; };
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const levels = (id: RegionId) => `Lv ${WORLDS[id].levels[0]}–${WORLDS[id].levels[1]}`;

// Keyboard: the left hand moves (WASD) and dashes (E). The right hand attacks on L and casts the other spells leftward
// along the home row in the order they are learned (K J H G); the row above opens menus: U spellbook, I inventory,
// O quest log, P character. F still fires Spark for players used to it.
const KEYMAP: Record<string, SpellId> = { l: 'spark', f: 'spark', e: 'dash', k: 'chain', j: 'sunfire', h: 'shield', g: 'starfall' };
type JournalTab = 'quests' | 'spells' | 'world';
const ITEM_KEYS: Record<string, ItemId> = Object.fromEntries(ITEM_ORDER.map(id => [ITEMS[id].key, id]));
const LABEL: Record<string, string> = { auto: 'Auto', high: 'High', balanced: 'Balanced', low: 'Low', lowest: 'Lowest', full: 'Full', less: 'Less', off: 'Off' };

/** Tracks whether the device is touch-only, so keyboard hints can be swapped for tap hints. */
function useTouch() {
  const [touch, setTouch] = useState(isTouch);
  useEffect(() => {
    const mq = matchMedia('(hover: none) and (pointer: coarse)'), on = () => setTouch(mq.matches);
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on);
  }, []);
  return touch;
}

function App() {
  const [mode, setMode] = useState<Mode>('title');
  const [runKey, setRunKey] = useState(0);
  const [save, setSave] = useState<Save>(() => getSave());
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [typed, setTyped] = useState(0);
  const [paused, setPaused] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [journal, setJournal] = useState(false);
  const [journalTab, setJournalTab] = useState<JournalTab>('quests');
  const [mapOpen, setMapOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [muted, setMuted] = useState(sfx.isMuted());
  const [graphics, setGraphics] = useState<GraphicsSettings>(loadGraphics);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chapterBanner, setChapterBanner] = useState<{ chapter: number; key: number } | null>(null);
  const [regionBanner, setRegionBanner] = useState<{ region: RegionId; danger: boolean; key: number } | null>(null);
  const [zone, setZone] = useState<{ name: string; discovered: boolean; key: number } | null>(null);
  const [spellQueue, setSpellQueue] = useState<SpellId[]>([]);
  const [levelBanner, setLevelBanner] = useState<{ level: number; key: number } | null>(null);
  const [bossBanner, setBossBanner] = useState<{ name: string; title: string } | null>(null);
  const [victory, setVictory] = useState<Victory | null>(null);
  const touch = useTouch();
  const touchRef = useRef(touch); touchRef.current = touch;
  const engineRef = useRef<GameEngine | null>(null);
  const toastId = useRef(0);
  const region = snapshot?.region ?? 'meadow';

  // Menu music outside of play; region music is driven by the game loop.
  useEffect(() => { if (mode === 'title' || mode === 'ending') music.play('menu'); }, [mode]);
  useEffect(() => { if (victory) music.play('victory'); }, [victory]);
  useEffect(() => {
    const unlock = () => { sfx.unlock(); if (music.current() === null && mode !== 'play') music.play('menu'); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [mode]);

  // The joystick is moved by writing styles directly: re-rendering the whole HUD on every pointer move was costly on tablets.
  const stickRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLElement>(null);
  const stickOrigin = useRef<{ ox: number; oy: number } | null>(null);
  const resetStick = () => {
    stickOrigin.current = null;
    const s = stickRef.current, t = thumbRef.current;
    if (s) { s.classList.remove('active'); s.style.left = ''; s.style.top = ''; }
    if (t) t.style.transform = '';
  };

  /** Phones get the short version of a message, and routine info is dropped entirely, so the screen stays clear. */
  const notify = useCallback((text: string, tone: NoticeTone = 'info', short?: string) => {
    if (touchRef.current) { if (!short && tone === 'info') return; text = short || text; }
    const id = ++toastId.current, max = touchRef.current ? 1 : 2;
    setToasts(list => [...list.filter(t => t.text !== text).slice(-max), { id, text, tone }]);
    window.setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), touchRef.current ? 1800 : tone === 'epic' ? 4200 : 2800);
  }, []);
  const onReady = useCallback((engine: GameEngine | null) => { engineRef.current = engine; }, []);
  const onSnapshot = useCallback((state: GameSnapshot) => setSnapshot(state), []);
  const onEvent = useCallback((event: EngineEvent) => {
    switch (event.type) {
      case 'dialogue': engineRef.current?.setMovement(0, 0); resetStick(); setDialogue({ speaker: event.speaker, portrait: event.portrait, lines: event.lines, index: 0, then: event.then, offer: event.offer }); break;
      case 'notice': notify(event.text, event.tone, event.short); break;
      case 'item': if (!touchRef.current) notify(`Found ${ITEMS[event.id].name}${event.count > 1 ? ` ×${event.count}` : ''}`, 'good'); break;
      case 'zone': setZone(z => ({ name: event.name, discovered: event.discovered, key: (z?.key || 0) + 1 })); break;
      case 'region': setRegionBanner(b => ({ region: event.region, danger: event.danger, key: (b?.key || 0) + 1 })); break;
      case 'spellLearned': setSpellQueue(q => [...q, event.spell]); break;
      case 'levelUp': setLevelBanner(b => ({ level: event.level, key: (b?.key || 0) + 1 })); break;
      case 'shop': engineRef.current?.setMovement(0, 0); resetStick(); setShop({ kind: event.kind, name: event.name, portrait: event.portrait }); setPanel('shop'); setJournal(false); break;
      case 'quest':
        if (event.state === 'accepted') notify(`Quest accepted: ${event.title}`, 'good', '✦ Quest accepted');
        else if (event.state === 'completed') notify(`Quest complete: ${event.title}${event.xp ? ` · +${event.xp} XP` : ''}`, 'epic', '✓ Quest complete');
        break;
      case 'bossIntro': setBossBanner({ name: event.name, title: event.title }); window.setTimeout(() => setBossBanner(null), 3000); break;
      case 'levelComplete': {
        const r = event.region;
        setSave(prev => {
          const next: Save = { ...prev, done: { ...prev.done, [r]: true }, stars: { ...prev.stars, [r]: Math.max(prev.stars[r], event.stats.stars) }, bestTime: { ...prev.bestTime, [r]: prev.bestTime[r] ? Math.min(prev.bestTime[r], event.stats.time) : event.stats.time } };
          saveNow(next); return next;
        });
        const e = engineRef.current; if (e) saveSession(e.exportSave());
        setDialogue(null); setPaused(false); setMapOpen(false); setPanel(null); setJournal(false); setVictory({ region: r, stats: event.stats });
      }
    }
  }, [notify]);

  const startGame = (fresh = false) => {
    sfx.unlock();
    if (fresh) clearSession();
    setRunKey(k => k + 1); setSnapshot(null); setDialogue(null); setPaused(false); setJournal(false); setMapOpen(false); setPanel(null); setShop(null); setVictory(null); resetStick();
    setSpellQueue([]); setLevelBanner(null); setBossBanner(null); setZone(null); setRegionBanner(null); setToasts([]); setChapterBanner(null); setMode('play');
  };
  /** Erases the adventure, the hero's level, gold, bag and quest progress. Sound and graphics settings are kept. */
  const wipeProgress = () => { clearSession(); resetProfile(); const s = blankSave(); setSave(s); saveNow(s); };
  const newGame = () => { wipeProgress(); startGame(true); };
  const resetGame = () => { engineRef.current = null; wipeProgress(); setPaused(false); setSettingsOpen(false); setJournal(false); setPanel(null); setDialogue(null); setVictory(null); setMode('title'); };
  const leaveToTitle = () => { const e = engineRef.current; if (e) saveSession(e.exportSave()); setPaused(false); setVictory(null); setMode('title'); };
  /** From the chapter-complete screen: the adventure continues in the same world, or the ending plays after the last chapter. */
  const nextChapter = () => {
    const e = engineRef.current, v = victory;
    setVictory(null); sfx.play('ui');
    if (v?.region === 'summit') { if (e) { e.nextChapter(); saveSession(e.exportSave()); } setMode('ending'); return; }
    e?.nextChapter();
    if (e) setChapterBanner(b => ({ chapter: e.chapter, key: (b?.key || 0) + 1 }));
  };
  const toggleMute = () => { const m = !muted; sfx.setMuted(m); setMuted(m); if (!m) sfx.play('ui'); };
  const changeGraphics = (patch: Partial<GraphicsSettings>) => { const g = { ...graphics, ...patch }; setGraphics(g); saveGraphics(g); sfx.play('ui'); };
  const showSpell = spellQueue.length && !dialogue ? spellQueue[0] : null;
  const blocked = paused || !!dialogue || !!showSpell || mapOpen || !!panel || !!victory;
  const cast = (id: SpellId) => { if (!blocked) engineRef.current?.cast(id); };
  const drink = (id: ItemId) => { if (!paused && !dialogue && !mapOpen && !victory) engineRef.current?.useItem(id); };
  /** Opens the quest log on a tab, or closes it if that tab is already showing. */
  const toggleJournal = (tab: JournalTab) => { setPanel(null); setJournal(open => !(open && journalTab === tab)); setJournalTab(tab); sfx.play('page'); };
  const openPanel = (p: Panel) => { engineRef.current?.setMovement(0, 0); setJournal(false); setPanel(v => v === p ? null : p); sfx.play('page'); };
  const dismissSpell = () => setSpellQueue(q => q.slice(1));

  // The chapter title plays when a run starts, once the first snapshot says which chapter it is.
  useEffect(() => { if (mode === 'play' && snapshot && !chapterBanner) setChapterBanner({ chapter: snapshot.chapter, key: 1 }); }, [mode, snapshot, chapterBanner]);
  const [showChapter, setShowChapter] = useState(false);
  useEffect(() => { if (!chapterBanner) return; setShowChapter(true); const t = window.setTimeout(() => setShowChapter(false), 3800); return () => window.clearTimeout(t); }, [chapterBanner]);
  useEffect(() => { if (!zone) return; const t = window.setTimeout(() => setZone(null), 3000); return () => window.clearTimeout(t); }, [zone]);
  useEffect(() => { if (!regionBanner) return; const t = window.setTimeout(() => setRegionBanner(null), 4200); return () => window.clearTimeout(t); }, [regionBanner]);
  useEffect(() => { if (!levelBanner) return; const t = window.setTimeout(() => setLevelBanner(null), 3200); return () => window.clearTimeout(t); }, [levelBanner]);
  useEffect(() => { if (!showSpell) return; sfx.play('learn'); const t = window.setTimeout(dismissSpell, 5200); return () => window.clearTimeout(t); }, [showSpell, spellQueue.length]);

  // Typewriter dialogue.
  const line = dialogue ? dialogue.lines[dialogue.index] : '';
  const lastLine = !!dialogue && dialogue.index >= dialogue.lines.length - 1 && typed >= line.length;
  const offerOpen = lastLine && !!dialogue?.offer;
  // The quest buttons ignore taps for a moment after they appear, so a tap meant to skip the text can't answer the offer.
  const [offerArmed, setOfferArmed] = useState(false);
  useEffect(() => { if (!offerOpen) { setOfferArmed(false); return; } const t = window.setTimeout(() => setOfferArmed(true), 550); return () => window.clearTimeout(t); }, [offerOpen, dialogue]);
  useEffect(() => {
    if (!dialogue) return;
    setTyped(0);
    let n = 0;
    const id = window.setInterval(() => { n += 1; setTyped(t => Math.max(t, n)); if (n % 5 === 0) sfx.play('talk'); if (n >= line.length) window.clearInterval(id); }, 16);
    return () => window.clearInterval(id);
  }, [dialogue, line]);
  const advanceDialogue = useCallback(() => {
    if (!dialogue) return;
    if (typed < line.length) { setTyped(line.length); return; }
    if (dialogue.index < dialogue.lines.length - 1) { setDialogue({ ...dialogue, index: dialogue.index + 1 }); return; }
    if (dialogue.offer) return; // an offer waits for Accept or Decline
    const then = dialogue.then; setDialogue(null);
    if (then === 'complete') engineRef.current?.celebrate();
  }, [dialogue, typed, line]);
  const answerOffer = (accept: boolean) => {
    const offer = dialogue?.offer; if (!offer || !offerArmed) return;
    setDialogue(null);
    if (accept) engineRef.current?.acceptQuest(offer.id);
    else { sfx.play('page'); notify(`Maybe later. ${dialogue.speaker} will still be here.`, 'info', 'Maybe later'); }
  };

  const keys = useRef(new Set<string>());
  const syncKeys = () => {
    const k = keys.current;
    const x = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    const y = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('w') ? 1 : 0);
    engineRef.current?.setMovement(x, y);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (victory) { if (k === 'enter' || k === ' ') { nextChapter(); e.preventDefault(); } return; }
    if (showSpell && (k === 'enter' || k === ' ' || k === 'escape')) { dismissSpell(); e.preventDefault(); return; }
    if (dialogue) {
      if (offerOpen) { if (k === 'enter' || k === ' ' || k === 'y') answerOffer(true); else if (k === 'escape' || k === 'n') answerOffer(false); e.preventDefault(); return; }
      if (k === 'enter' || k === ' ') { advanceDialogue(); e.preventDefault(); }
      if (k === 'escape' && !dialogue.offer) setDialogue(null);
      return;
    }
    if (k === 'n') { toggleMute(); return; }
    if (mapOpen) { if (k === 'm' || k === 'escape') setMapOpen(false); return; }
    if (paused) { if (k === 'escape') { if (settingsOpen) setSettingsOpen(false); else setPaused(false); } return; }
    if (panel) {
      if (k === 'escape' || (k === 'i' && panel === 'bag') || (k === 'p' && panel === 'hero')) { setPanel(null); e.preventDefault(); return; }
      if (panel === 'shop') return;
      if (k === 'i') { setPanel('bag'); return; } if (k === 'p') { setPanel('hero'); return; }
      if (k === 'u' || k === 'o') { toggleJournal(k === 'u' ? 'spells' : 'quests'); return; }
      if (ITEM_KEYS[k]) drink(ITEM_KEYS[k]);
      return;
    }
    if (k === 'm') { keys.current.clear(); engineRef.current?.setMovement(0, 0); setMapOpen(true); sfx.play('page'); return; }
    if (k === 'tab' || k === 'o') { toggleJournal('quests'); e.preventDefault(); return; }
    if (k === 'u') { toggleJournal('spells'); return; }
    if (k === 'i' || k === 'p') { keys.current.clear(); openPanel(k === 'i' ? 'bag' : 'hero'); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys.current.add(k); syncKeys(); e.preventDefault(); }
    if (KEYMAP[k]) { if (!e.repeat || KEYMAP[k] === 'spark') cast(KEYMAP[k]); }
    if (e.repeat) return;
    if (ITEM_KEYS[k]) drink(ITEM_KEYS[k]);
    if (k === ' ' || k === 'enter') { engineRef.current?.interact(); e.preventDefault(); }
    if (k === 'escape') { keys.current.clear(); engineRef.current?.setMovement(0, 0); if (journal) setJournal(false); else setPaused(true); }
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
  useEffect(() => { if (paused || dialogue || mapOpen || panel || victory) { keys.current.clear(); engineRef.current?.setMovement(0, 0); resetStick(); } }, [paused, dialogue, mapOpen, panel, victory]);

  const isGamePaused = paused || !!dialogue || mapOpen || !!panel || !!victory || mode !== 'play';
  // Floating joystick: it appears where the thumb lands anywhere in the left touch zone.
  const STICK_R = 70;
  const stickStart = (el: HTMLDivElement, clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect(), ox = clientX - r.left, oy = clientY - r.top;
    stickOrigin.current = { ox, oy };
    const s = stickRef.current; if (s) { s.classList.add('active'); s.style.left = `${ox}px`; s.style.top = `${oy}px`; }
  };
  const stickMove = (el: HTMLDivElement, clientX: number, clientY: number) => {
    const o = stickOrigin.current; if (!o) return;
    const r = el.getBoundingClientRect();
    let x = (clientX - r.left - o.ox) / STICK_R, y = (clientY - r.top - o.oy) / STICK_R;
    const mag = Math.hypot(x, y); if (mag > 1) { x /= mag; y /= mag; }
    const dead = mag < .12 ? 0 : 1;
    engineRef.current?.setMovement(x * dead, y * dead);
    if (thumbRef.current) thumbRef.current.style.transform = `translate(${x * STICK_R}px,${y * STICK_R}px)`;
  };
  const stickEnd = () => { resetStick(); engineRef.current?.setMovement(0, 0); };
  const potions = snapshot?.items.find(i => i.id === 'healthPotion')?.count ?? 0;
  const bannerWorld = chapterBanner ? WORLDS[LEVEL_ORDER[Math.min(2, chapterBanner.chapter - 1)]] : null;

  return <div className={`app-shell mode-${mode} ${touch ? 'is-touch' : ''}`}>
    {mode === 'title' && <TitleScreen save={save} muted={muted} touch={touch} onToggleMute={toggleMute} onStart={() => startGame()} onNewGame={newGame} onReset={wipeProgress} />}

    {mode === 'play' && <main className={`play-page theme-${region}`}>
      <section className="game-stage">
        <GameCanvas runKey={runKey} paused={isGamePaused} graphics={graphics} touch={touch} onReady={onReady} onSnapshot={onSnapshot} onEvent={onEvent} />

        <div className="hud-top">
          <Vitals snapshot={snapshot} onProfile={() => openPanel('hero')} />
          <div className="hud-center">
            {snapshot?.boss && <BossBar boss={snapshot.boss} />}
            {zone && !snapshot?.boss && <div className="zone-banner" key={zone.key}><span>✦</span>{zone.name}<span>✦</span>{zone.discovered && !touch && <em>Discovered</em>}</div>}
          </div>
          <div className="hud-buttons">
            <button className="icon-button" onClick={() => openPanel('bag')} aria-label="Bag" title="Inventory (I)">🎒</button>
            <button className="icon-button" onClick={() => { setMapOpen(true); sfx.play('page'); }} aria-label="World map" title="Map (M)">🗺️</button>
            <button className="icon-button" onClick={() => toggleJournal('quests')} aria-label="Quest log" title="Quest log (O)">📜</button>
            <button className="icon-button" onClick={() => { engineRef.current?.setMovement(0, 0); setPaused(true); }} aria-label="Pause" title="Pause (Esc)">❚❚</button>
          </div>
        </div>
        {snapshot && !journal && !panel && <QuestTracker snapshot={snapshot} onOpen={() => { setJournal(true); setJournalTab('quests'); sfx.play('page'); }} />}

        {snapshot && snapshot.combo >= 3 && <div className="combo" key={`combo-${snapshot.combo}`}><b>{snapshot.combo}</b><small>COMBO</small></div>}
        <div className="toasts">{toasts.map(t => <div key={t.id} className={`toast tone-${t.tone}`}>{t.text}</div>)}</div>

        {snapshot?.nearName && !dialogue && !panel && !victory && <button className={`near-prompt ${touch ? 'compact' : ''}`} onClick={() => engineRef.current?.interact()} aria-label={`${snapshot.nearAction} ${snapshot.nearName}`}>
          {touch ? <span>{snapshot.nearAction}</span> : <><kbd>Space</kbd><span>{snapshot.nearAction}</span><b>{snapshot.nearName}</b></>}
        </button>}

        <div className="spellbar">
          {snapshot?.spells.map(s => <SpellButton key={s.id} spell={s} onCast={cast} />)}
          <span className="bar-gap" />
          {snapshot?.items.slice(0, 2).map(it => <PotionButton key={it.id} id={it.id} count={it.count} onUse={drink} />)}
        </div>

        <div className="touch-controls">
          <div className="stick-zone"
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); stickStart(e.currentTarget, e.clientX, e.clientY); }}
            onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) stickMove(e.currentTarget, e.clientX, e.clientY); }}
            onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); stickEnd(); }}
            onPointerCancel={stickEnd} aria-label="Touch and drag anywhere here to move">
            <div className="virtual-stick" ref={stickRef}><i className="stick-thumb" ref={thumbRef} /></div>
          </div>
          <div className="touch-actions">
            {snapshot?.spells.map(s => <SpellButton key={s.id} spell={s} onCast={cast} touch />)}
            <PotionButton id="healthPotion" count={potions} onUse={drink} touch />
          </div>
        </div>

        {showChapter && bannerWorld && chapterBanner && <div className="chapter-banner" key={`chapter-${chapterBanner.key}`}>
          <small>Chapter {ROMAN[bannerWorld.chapter]}</small><h2>{bannerWorld.title}</h2><p>{bannerWorld.subtitle}</p><i />
        </div>}
        {regionBanner && !showChapter && !levelBanner && !showSpell && <div className={`region-banner ${regionBanner.danger ? 'danger' : ''}`} key={`region-${regionBanner.key}`}>
          <small>Entering</small><h3>{WORLDS[regionBanner.region].title}</h3><span>Creatures {levels(regionBanner.region)}</span>
          {regionBanner.danger && <em>⚠ Too dangerous for your level</em>}
        </div>}
        {levelBanner && <div className="level-banner" key={`level-${levelBanner.key}`}><small>Level up</small><b>{levelBanner.level}</b><span>Health and magic restored</span></div>}

        {bossBanner && <div className="boss-banner"><div className="letterbox top" /><div className="letterbox bottom" /><div className="boss-name"><small>{bossBanner.title}</small><h2>{bossBanner.name}</h2></div></div>}

        {showSpell && <div className="spell-banner" onClick={dismissSpell} style={{ '--spell': SPELLS[showSpell].color } as CSSProperties}>
          <div className="spell-card">
            <div className="spell-rays" /><div className="spell-icon">{SPELLS[showSpell].icon}</div>
            <small>New spell · Level {SPELLS[showSpell].level}</small><h2>{SPELLS[showSpell].name}</h2><p>{SPELLS[showSpell].description}</p>
            {touch ? <em className="tap-note">Tap its {SPELLS[showSpell].icon} button to cast</em> : <kbd>Press {SPELLS[showSpell].key}</kbd>}
          </div>
        </div>}

        {dialogue && <div className={`dialogue ${dialogue.offer ? 'has-offer' : ''} ${offerOpen ? 'offer-open' : ''}`} onClick={advanceDialogue} role="dialog" aria-modal="true">
          <div className="dialogue-portrait">{dialogue.portrait}</div>
          <div className="dialogue-body">
            <strong>{dialogue.speaker}</strong>
            <p>{line.slice(0, typed)}<span className="caret" /></p>
            {offerOpen && dialogue.offer && <div className="offer" onClick={e => e.stopPropagation()}>
              <div className={`offer-info ${dialogue.offer.main ? 'main' : ''}`}><small>{dialogue.offer.main ? 'Main quest' : 'Side quest'}</small><b>{dialogue.offer.title}</b><em>{dialogue.offer.summary}</em><span>Reward: {dialogue.offer.reward}</span></div>
              <div className={`offer-actions ${offerArmed ? 'armed' : ''}`}>
                <button className="btn ghost" disabled={!offerArmed} onClick={() => answerOffer(false)}>Decline</button>
                <button className="btn primary" disabled={!offerArmed} onClick={() => answerOffer(true)}>Accept</button>
              </div>
            </div>}
            {!offerOpen && <div className="dialogue-foot"><span>{dialogue.index + 1} / {dialogue.lines.length}</span><em>{typed < line.length ? (touch ? 'Tap to skip' : 'Click to skip') : dialogue.index < dialogue.lines.length - 1 ? 'Continue ▸' : 'Close ▸'}</em></div>}
          </div>
        </div>}

        {journal && <Journal key={journalTab} initial={journalTab} snapshot={snapshot} touch={touch} onClose={() => setJournal(false)} onTrack={id => engineRef.current?.track(id)} />}
        {panel === 'bag' && snapshot && <BagPanel snapshot={snapshot} touch={touch} onUse={drink} onClose={() => setPanel(null)} />}
        {panel === 'hero' && snapshot && engineRef.current && <HeroPanel snapshot={snapshot} engine={engineRef.current} onClose={() => setPanel(null)} />}
        {panel === 'shop' && shop && snapshot && engineRef.current && <ShopPanel shop={shop} snapshot={snapshot} engine={engineRef.current} onClose={() => setPanel(null)} />}
        {mapOpen && engineRef.current && <MapOverlay engine={engineRef.current} touch={touch} onClose={() => setMapOpen(false)} />}

        {victory && <VictoryOverlay victory={victory} save={save} onNext={nextChapter} onMenu={leaveToTitle} />}

        {paused && settingsOpen && <div className="overlay"><div className="panel pause-panel settings-panel">
          <small className="eyebrow">Settings</small><h2>Graphics &amp; sound</h2>
          <p>Lower these if the game feels slow or the device gets warm. Changes apply right away.</p>
          <SettingRow label="Quality" hint="Auto adjusts to your device">{QUALITIES.map(q => <button key={q} className={graphics.quality === q ? 'on' : ''} onClick={() => changeGraphics({ quality: q })}>{LABEL[q]}</button>)}</SettingRow>
          <SettingRow label="Grass & flowers" hint="Swaying plants on the ground">{DECOR_LEVELS.map(d => <button key={d} className={graphics.decor === d ? 'on' : ''} onClick={() => changeGraphics({ decor: d })}>{LABEL[d]}</button>)}</SettingRow>
          <SettingRow label="Weather effects" hint="Petals, leaves, snow, fireflies, light rays">{[true, false].map(v => <button key={String(v)} className={graphics.weather === v ? 'on' : ''} onClick={() => changeGraphics({ weather: v })}>{v ? 'On' : 'Off'}</button>)}</SettingRow>
          <SettingRow label="Frame rate" hint="30 is steadier on weak tablets">{([60, 30] as const).map(v => <button key={v} className={graphics.fps === v ? 'on' : ''} onClick={() => changeGraphics({ fps: v })}>{v} fps</button>)}</SettingRow>
          <SettingRow label="Screen shake">{[true, false].map(v => <button key={String(v)} className={graphics.shake === v ? 'on' : ''} onClick={() => changeGraphics({ shake: v })}>{v ? 'On' : 'Off'}</button>)}</SettingRow>
          <SettingRow label="Show FPS">{[true, false].map(v => <button key={String(v)} className={graphics.showFps === v ? 'on' : ''} onClick={() => changeGraphics({ showFps: v })}>{v ? 'On' : 'Off'}</button>)}</SettingRow>
          <VolumeControls />
          <button className="btn primary" onClick={() => setSettingsOpen(false)}>Back <b>←</b></button>
          <div className="danger-zone"><span><b>Reset entire game</b><em>Deletes the adventure, levels, gold, potions and quests. Cannot be undone.</em></span><ConfirmButton label="Reset game" onConfirm={resetGame} /></div>
        </div></div>}
        {paused && !settingsOpen && <div className="overlay"><div className="panel pause-panel">
          <small className="eyebrow">Paused</small><h2>Take a breath.</h2><p>Your adventure is saved. The valley can wait.</p>
          <div className="controls-grid">
            <span><kbd>WASD</kbd> Move</span><span><kbd>L</kbd> Spark</span><span><kbd>E</kbd> Dash</span><span><kbd>K</kbd> Chain Lightning</span>
            <span><kbd>J</kbd> Sunfire</span><span><kbd>H</kbd> Moss Shield</span><span><kbd>G</kbd> Starfall</span><span><kbd>Space</kbd> Talk / use</span>
            <span><kbd>1</kbd>–<kbd>5</kbd> Potions</span><span><kbd>U</kbd> Spellbook</span><span><kbd>I</kbd> Inventory</span><span><kbd>O</kbd> Quest log</span><span><kbd>P</kbd> Character</span><span><kbd>M</kbd> Map</span>
          </div>
          <button className="btn primary" onClick={() => setPaused(false)}>Resume adventure <b>→</b></button>
          <div className="pause-row">
            <button className="btn ghost" onClick={() => { setSettingsOpen(true); sfx.play('page'); }}>⚙ Settings</button>
            <button className="btn ghost" onClick={toggleMute}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            <button className="btn ghost" onClick={leaveToTitle}>⌂ Menu</button>
          </div>
        </div></div>}
      </section>
    </main>}

    {mode === 'ending' && <main className="menu-page ending-page">
      <TitleBackdrop level="summit" />
      <Confetti />
      <div className="panel victory-panel">
        <small className="eyebrow">The valley remembers</small>
        <h1>Every light <em>is shining.</em></h1>
        <p>You relit the Beacon, rang the Ancient Bell, broke the Hollow Star and cast out Umbra, the Eclipse. Orrin and Sable are home, and Mira and Tuft have become the valley’s newest legend.</p>
        <div className="star-row">{LEVEL_ORDER.map(id => <span key={id} className="on" title={WORLDS[id].title}>{'★'.repeat(save.stars[id] || 1)}</span>)}</div>
        <div className="menu-actions">
          <button className="btn primary" onClick={() => startGame()}>Keep exploring <b>→</b></button>
          <ConfirmButton label="New game" confirm="Erase progress & start?" onConfirm={newGame} />
          <button className="btn ghost" onClick={() => setMode('title')}>Title</button>
        </div>
      </div>
    </main>}
  </div>;
}

function TitleScreen({ save, muted, touch, onToggleMute, onStart, onNewGame, onReset }: { save: Save; muted: boolean; touch: boolean; onToggleMute: () => void; onStart: () => void; onNewGame: () => void; onReset: () => void }) {
  const next = LEVEL_ORDER.find(id => !save.done[id]) || 'summit';
  const profile = loadProfile();
  const started = !!loadSession() || LEVEL_ORDER.some(id => save.done[id]) || profile.level > 1 || profile.xp > 0;
  return <main className="menu-page title-page">
    <TitleBackdrop level={next} />
    <header className="title-top">
      <div className="brand"><span className="brand-gem">✦</span><span><strong>Starfall Grove</strong><small>A storybook action RPG</small></span></div>
      <button className="icon-button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</button>
    </header>
    <section className="title-hero">
      <small className="eyebrow">One vast valley · three lands · forty-five story quests</small>
      <h1 className="title-logo"><span>Starfall</span><span>Grove</span></h1>
      <p>A fallen star has dimmed the valley, and Master Orrin has vanished. Guide Mira and her fox Tuft on foot from sunlit meadows through whispering woods to the silver summit. Help the valley folk, rescue the lost, grow stronger — and learn what hides inside the Hollow Star.</p>
      <div className="menu-actions">
        <button className="btn primary big" onClick={onStart}>{started ? `Continue · ${WORLDS[next].title}` : 'Begin the adventure'} <b>→</b></button>
        {started && <ConfirmButton label="New game" confirm="Erase progress & start?" onConfirm={onNewGame} />}
        {started && <ConfirmButton label="Reset game" onConfirm={onReset} />}
      </div>
      {started && <p className="title-level">Mira · Level {profile.level} · {profile.gold} gold</p>}
    </section>
    <section className="chapter-cards">
      {LEVEL_ORDER.map(id => {
        const w = WORLDS[id], open = unlocked(save, id), sp = SPELLS[SPELL_ORDER.find(s => SPELLS[s].level >= w.levels[0] && SPELLS[s].level <= w.levels[1]) || 'spark'];
        return <button key={id} className={`chapter-card theme-${id} ${open ? '' : 'locked'} ${save.done[id] ? 'done' : ''}`} disabled={!open} onClick={onStart} style={{ '--spell': sp.color } as CSSProperties}>
          <span className="card-art"><i /><i /><i /></span>
          <small>Chapter {ROMAN[w.chapter]}</small>
          <strong>{w.title}</strong>
          <em>{w.subtitle}</em>
          <span className="card-foot">
            <span className="card-spell"><b>⚔</b>Creatures {levels(id)}</span>
            <span className="card-stars">{open ? [1, 2, 3].map(n => <i key={n} className={n <= save.stars[id] ? 'on' : ''}>★</i>) : '🔒'}</span>
          </span>
        </button>;
      })}
    </section>
    {touch
      ? <footer className="title-foot"><span>Drag on the left to move</span><span>Tap the round buttons to cast</span><span>Tap people and chests to interact</span></footer>
      : <footer className="title-foot"><span><kbd>WASD</kbd> move</span><span><kbd>L</kbd> spark</span><span><kbd>E</kbd> dash</span><span><kbd>K J H G</kbd> spells</span><span><kbd>Space</kbd> interact</span><span><kbd>1–5</kbd> potions</span><span><kbd>I</kbd> inventory</span><span><kbd>O</kbd> quests</span><span><kbd>M</kbd> map</span></footer>}
  </main>;
}

/** The chapter-complete screen. On phones in landscape it is laid out side by side so "Next chapter" is always in view. */
function VictoryOverlay({ victory, save, onNext, onMenu }: { victory: Victory; save: Save; onNext: () => void; onMenu: () => void }) {
  const w = WORLDS[victory.region], s = victory.stats, last = victory.region === 'summit';
  const next = LEVEL_ORDER[LEVEL_ORDER.indexOf(victory.region) + 1];
  return <div className="victory-overlay">
    <Confetti />
    <div className="panel victory-panel compact">
      <div className="victory-text">
        <small className="eyebrow">Chapter {ROMAN[w.chapter]} complete</small>
        <h1>{w.script.victory.title}</h1>
        <p>{w.script.victory.text}</p>
      </div>
      <div className="victory-side">
        <div className="star-row">{[1, 2, 3].map(n => <span key={n} className={n <= (s.stars || 1) ? 'on' : ''} style={{ animationDelay: `${.3 + n * .25}s` }}>★</span>)}</div>
        <div className="stat-row">
          <div><b>{fmtTime(s.time)}</b><small>Time</small></div>
          <div><b>{s.quests}/{s.totalQuests}</b><small>Side quests</small></div>
          <div><b>{s.defeated}</b><small>Creatures</small></div>
          <div><b>{s.level}</b><small>Level</small></div>
        </div>
        <div className="menu-actions">
          <button className="btn primary" onClick={onNext} autoFocus>{last ? 'See the ending' : `Next chapter · ${WORLDS[next].title}`} <b>→</b></button>
          <button className="btn ghost" onClick={onMenu}>Menu</button>
        </div>
        {!last && <p className="victory-hint">The road east is open. Chapter {ROMAN[w.chapter + 1]} creatures are {levels(next)}{save.stars[victory.region] < 3 ? ' — side quests here still give rewards.' : '.'}</p>}
      </div>
    </div>
  </div>;
}

/** A destructive button: the first press asks for confirmation, the second one within 4 seconds acts. */
function ConfirmButton({ label, confirm = 'Tap again to confirm', onConfirm }: { label: string; confirm?: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = window.setTimeout(() => setArmed(false), 4000); return () => window.clearTimeout(t); }, [armed]);
  return <button className={`btn ghost danger ${armed ? 'armed' : ''}`} onClick={() => { sfx.play('ui'); if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>{armed ? confirm : label}</button>;
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="setting-row"><span><b>{label}</b>{hint && <em>{hint}</em>}</span><div className="seg">{children}</div></div>;
}

function VolumeControls() {
  const [v, setV] = useState(() => sfx.settings());
  const set = (kind: 'master' | 'music' | 'sfx', value: number) => { sfx.setVolume(kind, value); setV(sfx.settings()); };
  return <div className="volume-grid">
    {(['master', 'music', 'sfx'] as const).map(k => <label key={k}><span>{k === 'sfx' ? 'Effects' : k === 'music' ? 'Music' : 'Volume'}</span>
      <input type="range" min={0} max={1} step={.05} value={v[k]} onChange={e => set(k, Number(e.target.value))} onPointerUp={() => sfx.play('ui')} /></label>)}
  </div>;
}

function Vitals({ snapshot, onProfile }: { snapshot: GameSnapshot | null; onProfile: () => void }) {
  const hp = snapshot?.hp ?? 100, max = snapshot?.maxHp ?? 100, mana = snapshot?.mana ?? 80, maxMana = snapshot?.maxMana ?? 100;
  const level = snapshot?.level ?? 1, xp = snapshot?.xp ?? 0, next = snapshot?.xpNext ?? 1, pct = Math.max(0, hp / max) * 100;
  return <div className="vitals-wrap">
    <div className={`vitals ${hp <= max * .25 ? 'critical' : ''}`}>
      <button className="portrait" onClick={onProfile} aria-label="Character details" title="Character (P)"><span>🧙‍♀️</span>{snapshot?.shield && <i className="shield-ring" />}<b className="level-badge">{level}</b></button>
      <div className="bars">
        <div className="health" title="Health"><i className="lag" style={{ width: `${pct}%` }} /><i className="fill" style={{ width: `${pct}%` }} /><b>{Math.max(0, Math.ceil(hp))} / {max}</b></div>
        <div className="mana" title="Magic"><i style={{ width: `${(mana / maxMana) * 100}%` }} /><b>{mana}</b></div>
        <div className="xp" title={`${xp} / ${next} XP`}><i style={{ width: next ? `${(xp / next) * 100}%` : '100%' }} /><b>{next ? `${xp} / ${next} XP` : 'MAX'}</b></div>
      </div>
    </div>
    <div className="vitals-row">
      <span className="gold-chip" title="Gold"><i />{snapshot?.gold ?? 0}</span>
      {!!snapshot?.buffs.length && <div className="buffs">{snapshot.buffs.map(b => <span key={b.id} className="buff" title={`${ITEMS[b.id].name} · ${Math.ceil(b.time)}s`} style={{ '--c': ITEMS[b.id].color, '--p': `${(b.time / b.max) * 360}deg` } as CSSProperties}><Flask id={b.id} /><b>{Math.ceil(b.time)}</b></span>)}</div>}
    </div>
  </div>;
}

/** WoW-style objective list: the main quest in gold, followed side quests in blue, just goals and counts. */
function QuestTracker({ snapshot, onOpen }: { snapshot: GameSnapshot; onOpen: () => void }) {
  const main = snapshot.main;
  const sides = snapshot.quests.filter(q => q.status === 'active' || q.status === 'ready').sort((a, b) => Number(b.tracked) - Number(a.tracked)).slice(0, 3);
  return <button className="tracker" onClick={onOpen} aria-label="Open quest log">
    <span className="trk trk-main"><b>{main.title}<i> {main.index}/{main.total}</i></b><span>{main.step}{main.count > 0 && <em>{main.progress}/{main.count}</em>}</span></span>
    {sides.map(q => <span key={q.id} className={`trk trk-side ${q.status === 'ready' ? 'ready' : ''}`}><b>{q.title}</b><span>{q.goal}{q.count > 0 && <em>{q.progress}/{q.count}</em>}</span></span>)}
  </button>;
}

function BossBar({ boss }: { boss: NonNullable<GameSnapshot['boss']> }) {
  const pct = (boss.hp / boss.maxHp) * 100;
  return <div className={`boss-bar phase-${boss.phase}`}>
    <div className="boss-label"><strong>{boss.name}</strong><span className="boss-lv">Lv {boss.level}</span>{boss.phase > 1 && <em>ENRAGED</em>}</div>
    <div className="boss-track"><i className="lag" style={{ width: `${pct}%` }} /><i className="fill" style={{ width: `${pct}%` }} /><span className="mark" /></div>
  </div>;
}

function SpellButton({ spell, onCast, touch }: { spell: SpellState; onCast: (id: SpellId) => void; touch?: boolean }) {
  const ready = spell.unlocked && spell.cooldown <= 0 && spell.affordable;
  const style = { '--cd': `${spell.cooldown * 360}deg`, '--spell': SPELLS[spell.id].color } as CSSProperties;
  return <button className={`spell spell-${spell.id} ${ready ? 'ready' : ''} ${spell.unlocked ? '' : 'locked'} ${!spell.affordable ? 'poor' : ''} ${touch ? 'touch' : ''}`}
    style={style} onPointerDown={e => { e.preventDefault(); onCast(spell.id); }} aria-label={spell.name} title={spell.unlocked ? `${spell.name} (${spell.key})${spell.cost ? ` · ${spell.cost} mana` : ''}` : `${spell.name} · learned at level ${spell.level}`}>
    <span className="spell-icon-wrap"><b>{spell.unlocked ? spell.icon : '🔒'}</b>{spell.cooldown > 0 && <i className="cd" />}</span>
    {!touch && spell.unlocked && <kbd>{spell.key}</kbd>}
    {spell.cost > 0 && spell.unlocked && <small>{spell.cost}</small>}
    {!spell.unlocked && <small className="lvl">Lv {spell.level}</small>}
  </button>;
}

function Flask({ id }: { id: ItemId }) { return <i className="flask" style={{ '--c': ITEMS[id].color } as CSSProperties} aria-hidden="true" />; }
function PotionButton({ id, count, onUse, touch }: { id: ItemId; count: number; onUse: (id: ItemId) => void; touch?: boolean }) {
  return <button className={`spell potion potion-${id} ${touch ? 'touch' : ''} ${count ? 'ready' : 'poor'}`} style={{ '--spell': ITEMS[id].color } as CSSProperties}
    onPointerDown={e => { e.preventDefault(); onUse(id); }} aria-label={`${ITEMS[id].name} (${count})`} title={`${ITEMS[id].name} (${ITEMS[id].key}) · ${ITEMS[id].description}`}>
    <span className="spell-icon-wrap"><Flask id={id} /></span>
    {!touch && <kbd>{ITEMS[id].key}</kbd>}
    <small className="count">{count}</small>
  </button>;
}

function BagPanel({ snapshot, touch, onUse, onClose }: { snapshot: GameSnapshot; touch: boolean; onUse: (id: ItemId) => void; onClose: () => void }) {
  return <aside className="side-panel bag-panel">
    <div className="journal-head"><strong>Bag</strong><span className="gold-chip big"><i />{snapshot.gold}</span><button className="icon-button" onClick={onClose} aria-label="Close bag">✕</button></div>
    <p className="panel-note">Chests, strong creatures and quest rewards fill your bag. City merchants sell more.</p>
    <div className="bag-list">
      {snapshot.items.map(it => {
        const info = ITEMS[it.id], active = snapshot.buffs.find(b => b.id === it.id);
        return <div key={it.id} className={`bag-item ${it.count ? '' : 'empty'}`} style={{ '--c': info.color } as CSSProperties}>
          <span className="bag-icon"><Flask id={it.id} /><b>{it.count}</b></span>
          <div><strong>{info.name}{!touch && <kbd>{info.key}</kbd>}</strong><em>{info.description}{active && ` · active ${Math.ceil(active.time)}s`}</em></div>
          <button className="btn ghost" disabled={!it.count} onClick={() => onUse(it.id)}>Use</button>
        </div>;
      })}
    </div>
  </aside>;
}

/** Merchants sell potions; smiths forge the three permanent upgrades. */
function ShopPanel({ shop, snapshot, engine, onClose }: { shop: Shop; snapshot: GameSnapshot; engine: GameEngine; onClose: () => void }) {
  const [, setTick] = useState(0);
  const gold = snapshot.gold, refresh = () => setTick(t => t + 1);
  return <aside className="side-panel shop-panel">
    <div className="journal-head"><strong>{shop.portrait} {shop.kind === 'merchant' ? 'Potions' : 'Smithy'}</strong><span className="gold-chip big"><i />{gold}</span><button className="icon-button" onClick={onClose} aria-label="Close shop">✕</button></div>
    <p className="panel-note">{shop.name}: {shop.kind === 'merchant' ? '“Everything a hero needs. Gold only, no bartering.”' : '“Every rank makes you stronger for the rest of your journey.”'}</p>
    <div className="bag-list">
      {shop.kind === 'merchant' ? ITEM_ORDER.map(id => {
        const info = ITEMS[id], have = snapshot.items.find(i => i.id === id)?.count ?? 0;
        return <div key={id} className="bag-item" style={{ '--c': info.color } as CSSProperties}>
          <span className="bag-icon"><Flask id={id} /><b>{have}</b></span>
          <div><strong>{info.name}</strong><em>{info.description}</em></div>
          <button className="btn ghost price" disabled={gold < info.price} onClick={() => { engine.buyItem(id); refresh(); }}><i className="coin" />{info.price}</button>
        </div>;
      }) : UPGRADE_ORDER.map(id => {
        const info = UPGRADES[id], rank = engine.upgradeRank(id), cost = upgradeCost(rank), maxed = rank >= MAX_RANK;
        return <div key={id} className="bag-item upgrade" style={{ '--c': '#ffd35c' } as CSSProperties}>
          <span className="bag-icon"><b className="up-icon">{info.icon}</b></span>
          <div><strong>{info.name}</strong><em>{info.description} {info.per} per rank.</em><span className="pips">{Array.from({ length: MAX_RANK }, (_, i) => <i key={i} className={i < rank ? 'on' : ''} />)}</span></div>
          <button className="btn ghost price" disabled={maxed || gold < cost} onClick={() => { engine.buyUpgrade(id); refresh(); }}>{maxed ? 'Max' : <><i className="coin" />{cost}</>}</button>
        </div>;
      })}
    </div>
  </aside>;
}

function HeroPanel({ snapshot: s, engine, onClose }: { snapshot: GameSnapshot; engine: GameEngine; onClose: () => void }) {
  const w = WORLDS[LEVEL_ORDER[Math.min(2, s.chapter - 1)]], here = WORLDS[s.region], st = s.stats, spells = s.spells.filter(x => x.unlocked).length;
  const rows: Array<[string, string]> = [
    ['Health', `${Math.ceil(s.hp)} / ${s.maxHp}`], ['Magic', `${s.mana} / ${s.maxMana}`], ['Magic regeneration', `${st.regen.toFixed(1)} / s`],
    ['Spell power', `+${Math.round((st.power - 1) * 100)}%`], ['Spark damage', `${st.spark}`], ['Move speed', `${Math.round(st.speed * 100)}%`],
    ['Damage taken', `${Math.round((1 - st.guard) * 100)}%`], ['Spells known', `${spells} / ${s.spells.length}`], ['Gold', `${s.gold}`],
  ];
  const trip: Array<[string, string]> = [
    ['Chapter', `${ROMAN[w.chapter]} · ${w.title}`], ['You are in', `${here.title} (${levels(s.region)})`], ['Time played', fmtTime(st.elapsed)], ['Side quests done', `${st.questsDone} / ${st.totalQuests}`],
    ['Creatures defeated', `${s.defeated}`], ['Places discovered', `${s.discovered} / ${s.totalPlaces}`], ['Chests opened', `${s.chests} / ${s.totalChests}`],
  ];
  return <aside className="side-panel hero-panel">
    <div className="journal-head"><strong>Character</strong><button className="icon-button" onClick={onClose} aria-label="Close character sheet">✕</button></div>
    <div className="hero-card">
      <span className="portrait big"><span>🧙‍♀️</span><b className="level-badge">{s.level}</b></span>
      <div><b>Mira</b><em>Star apprentice · Level {s.level}</em>
        <div className="xp wide"><i style={{ width: s.xpNext ? `${(s.xp / s.xpNext) * 100}%` : '100%' }} /><b>{s.xpNext ? `${s.xp} / ${s.xpNext} XP` : 'MAX LEVEL'}</b></div>
      </div>
    </div>
    <section><small>Attributes</small><dl className="stat-list">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
    <section><small>Smith upgrades</small><dl className="stat-list">{UPGRADE_ORDER.map(id => <div key={id}><dt>{UPGRADES[id].name}</dt><dd>Rank {engine.upgradeRank(id)} / {MAX_RANK}</dd></div>)}</dl></section>
    {!!s.buffs.length && <section><small>Active effects</small><dl className="stat-list">{s.buffs.map(b => <div key={b.id}><dt>{ITEMS[b.id].name}</dt><dd>{Math.ceil(b.time)}s</dd></div>)}</dl></section>}
    <section><small>Adventure</small><dl className="stat-list">{trip.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
  </aside>;
}

const STATUS_ICON: Record<QuestRow['status'], string> = { available: '!', active: '○', ready: '?', done: '✓', locked: '·' };
function Journal({ snapshot, touch, initial, onClose, onTrack }: { snapshot: GameSnapshot | null; touch: boolean; initial: JournalTab; onClose: () => void; onTrack: (id: string) => void }) {
  const w = WORLDS[snapshot?.region ?? 'meadow'];
  const [tab, setTab] = useState<JournalTab>(initial);
  return <aside className="journal">
    <div className="journal-head"><strong>Quest log</strong><button className="icon-button" onClick={onClose} aria-label="Close quest log">✕</button></div>
    <div className="journal-tabs">{(['quests', 'spells', 'world'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'quests' ? 'Quests' : t === 'spells' ? 'Spellbook' : 'Explorer'}</button>)}</div>
    {snapshot && tab === 'quests' && <>
      <section className="q-main"><small>Chapter {ROMAN[Math.min(3, snapshot.chapter)]} · main quest {snapshot.main.index} of {snapshot.main.total}</small><p className="main-q">{snapshot.main.title}</p><p className="sub-q">{snapshot.main.step}{snapshot.main.count > 0 && <em> {snapshot.main.progress}/{snapshot.main.count}</em>}</p>
        <ol className="story">{snapshot.mainQuests.map(q => <li key={q.id} className={q.status === 'done' ? 'done' : 'now'}><span>{q.status === 'done' ? '✓' : '◆'}</span>{q.title}</li>)}</ol>
      </section>
      <section className="q-sides"><small>Side quests · {touch ? 'tap' : 'click'} one to follow it</small>
        {snapshot.quests.length === 0 && <p className="sub-q">Villagers with a blue ! have work for you.</p>}
        {snapshot.quests.map(q => <button key={q.id} className={`side status-${q.status} ${q.tracked ? 'tracked' : ''}`} onClick={() => q.status !== 'done' && q.status !== 'available' && onTrack(q.id)}>
          <span>{STATUS_ICON[q.status]}</span><div><b>{q.title}<i className="ch">{ROMAN[q.chapter]}</i></b><em>{q.detail}</em>{q.status !== 'done' && <em className="reward">Reward: {q.reward}</em>}</div>
        </button>)}
      </section>
    </>}
    {snapshot && tab === 'spells' && <section><small>Spellbook · new spells come with levels</small><div className="spellbook">{SPELL_ORDER.map(id => { const s = snapshot.spells.find(x => x.id === id)!; return <div key={id} className={`book-spell ${s.unlocked ? '' : 'locked'}`} style={{ '--spell': SPELLS[id].color } as CSSProperties}><b>{s.unlocked ? SPELLS[id].icon : '?'}</b><div><strong>{s.unlocked ? SPELLS[id].name : 'Unknown spell'} {(!touch || !s.unlocked) && <kbd>{s.unlocked ? SPELLS[id].key : `Lv ${SPELLS[id].level}`}</kbd>}</strong><em>{s.unlocked ? SPELLS[id].description : `Learned at level ${SPELLS[id].level}.`}</em></div></div>; })}</div></section>}
    {snapshot && tab === 'world' && <>
      <section className="journal-stats"><span>Places discovered</span><b>{snapshot.discovered} / {snapshot.totalPlaces}</b></section>
      <section className="journal-stats"><span>Chests opened</span><b>{snapshot.chests} / {snapshot.totalChests}</b></section>
      <section className="journal-stats"><span>Runestones read</span><b>{snapshot.lore} / {snapshot.totalLore}</b></section>
      <section className="journal-stats"><span>Creatures defeated</span><b>{snapshot.defeated}</b></section>
      <section className="lands"><small>The three lands</small>{LEVEL_ORDER.map(id => <p key={id}><b>{WORLDS[id].title}</b><span>{levels(id)}</span></p>)}</section>
      <section className="fox-tip"><small>🦊 Tuft’s field note</small><p>“{w.script.tip}”</p></section>
    </>}
  </aside>;
}

function MapOverlay({ engine, touch, onClose }: { engine: GameEngine; touch: boolean; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState(() => LEVEL_ORDER.indexOf(engine.heroRegion.id));
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let raf = 0;
    const frame = (now: number) => {
      const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      if (c.width !== Math.round(r.width * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
      ctx.setTransform(d, 0, 0, d, 0, 0); drawWorldMap(ctx, r.width, r.height, engine, now / 1000, tab);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, tab]);
  const reg = engine.world.regions[tab];
  return <div className="map-overlay" onClick={onClose}>
    <div className="map-head" onClick={e => e.stopPropagation()}>
      <div className="map-tabs">{LEVEL_ORDER.map((id, i) => <button key={id} className={i === tab ? 'on' : ''} onClick={() => { setTab(i); sfx.play('page'); }}>{WORLDS[id].title}<small>{levels(id)}</small></button>)}</div>
      <button className="icon-button" onClick={onClose} aria-label="Close map">✕</button>
    </div>
    <canvas ref={ref} />
    <div className="map-legend"><span><i style={{ background: '#fff' }} />You</span><span><i style={{ background: MAIN_COLOR }} />Main quest</span><span><i style={{ background: SIDE_COLOR }} />Side quest</span><span><i style={{ background: reg.palette.accent }} />{reg.script.keyLabel}</span><span><i style={{ background: '#ffd35c' }} />Shop</span><span><i style={{ background: '#ff6b5b' }} />Guardian</span>{!touch && <span><kbd>M</kbd> close</span>}</div>
  </div>;
}

function Confetti() {
  const pieces = Array.from({ length: 42 }, (_, i) => i);
  return <div className="confetti" aria-hidden="true">{pieces.map(i => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * .25}s`, animationDuration: `${3.2 + (i % 5) * .6}s`, background: ['#ffd35c', '#ff9aa8', '#9fd8ff', '#b9f29d', '#c9b6ff'][i % 5] }} />)}</div>;
}

export default App;
