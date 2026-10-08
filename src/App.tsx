import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import GameCanvas from './game/GameCanvas';
import TitleBackdrop from './TitleBackdrop';
import { GameEngine, type AchRow } from './game/engine';
import { ACHIEVEMENTS, ACH_CATEGORIES, TOTAL_POINTS } from './game/achievements';
import { LEVEL_ORDER, WORLDS } from './game/worlds';
import { HEROES, HERO_ORDER, SPELLS, SPELL_UPGRADES } from './game/spells';
import { ITEMS, ITEM_ORDER } from './game/items';
import { RARITY, RARITY_ORDER, SLOT_NAMES, gearScore, sellPrice } from './game/gear';
import { DECOR_LEVELS, QUALITIES, isTouch, loadGraphics, saveGraphics, type GraphicsSettings } from './game/graphics';
import { clearSession, loadSession, saveSession } from './game/storage';
import { MAX_RANK, UPGRADES, UPGRADE_ORDER, loadProfile, resetProfile, saveProfile, upgradeCost } from './game/progression';
import { MAIN_COLOR, SIDE_COLOR, depthsHole, drawDepthsMap, drawWorldMap } from './game/render';
import { sfx } from './game/audio';
import { music } from './game/music';
import { ACTIONS, RESERVED, actionOf, bindKey, getKeys, keyLabel, onKeysChange, resetKeys, spellSlot, type Action } from './game/keys';
import { exportBackup, readBackup, restoreBackup, type Backup } from './game/backup';
import { MOUNTS, MOUNT_ORDER, STABLE_STOCK } from './game/mounts';
import { applyUpdate, onUpdateReady } from './pwa';
import type { EngineEvent, GameSnapshot, HeroId, ItemId, NoticeTone, QuestOffer, QuestRow, RegionId, ShopKind, SpellId, SpellState } from './game/types';
import CharacterScreen, { ScoreLine, StatLines, type SheetTab } from './ui/CharacterScreen';
import CharacterSelect, { type HeroSummary } from './ui/CharacterSelect';
import { GearIcon, HeroFace, ItemIcon, JournalIcon, PersonFace, PowerIcon } from './ui/icons';
import { CineOverlay, IntroFilm, SiegeBar } from './ui/Story';
import MiniGameOverlay, { type GameResult } from './ui/MiniGames';
import { TRAILS, TRAIL_ORDER } from './game/trails';

type Mode = 'title' | 'select' | 'tutorial' | 'practice' | 'play' | 'ending';
type Save = { version: 2; done: Record<RegionId, boolean>; stars: Record<RegionId, number>; bestTime: Record<RegionId, number> };
/** `choice` ends the conversation with two answers instead of a close. */
type Dialogue = { speaker: string; portrait: string; lines: string[]; index: number; then?: 'complete'; offer?: QuestOffer; choice?: { quest: string; title: string; a: string; b: string } };
type Toast = { id: number; text: string; tone: NoticeTone; color?: string };
type Panel = 'sheet' | 'shop' | null;
type Shop = { kind: ShopKind; name: string; portrait: string };
type AchPop = { id: string; name: string; description: string; icon: string; points: number; key: number };
/** Chapter stars per hero; Mira keeps the original key so older saves carry over. */
const saveKey = (hero: HeroId) => hero === 'mira' ? 'starfall-grove-save-v2' : `starfall-grove-save-${hero}-v2`;
const CHOICE_KEY = 'starfall-grove-hero-choice';
const loadChoice = (): HeroId => { try { const v = localStorage.getItem(CHOICE_KEY) as HeroId | null; return v && HERO_ORDER.includes(v) ? v : 'mira'; } catch { return 'mira'; } };
const heroStarted = (hero: HeroId) => { const p = loadProfile(hero), sv = getSave(hero); return !!loadSession(hero) || LEVEL_ORDER.some(id => sv.done[id]) || p.level > 1 || p.xp > 0; };
const ROMAN = ['', 'I', 'II', 'III', 'IV'];
const blankSave = (): Save => ({ version: 2, done: { meadow: false, woods: false, summit: false, ember: false }, stars: { meadow: 0, woods: 0, summit: 0, ember: 0 }, bestTime: { meadow: 0, woods: 0, summit: 0, ember: 0 } });
function getSave(hero: HeroId): Save {
  try {
    const d = JSON.parse(localStorage.getItem(saveKey(hero)) || 'null') as Partial<Save> | null;
    if (d?.version === 2) { const b = blankSave(); return { ...b, done: { ...b.done, ...d.done }, stars: { ...b.stars, ...d.stars }, bestTime: { ...b.bestTime, ...d.bestTime } }; }
    return blankSave();
  } catch { return blankSave(); }
}
/** True once a newer version of the game has been downloaded and waits for a restart. */
function useUpdateReady() { const [ready, setReady] = useState(false); useEffect(() => onUpdateReady(setReady), []); return ready; }
/** The title's offer to switch to a new version: the whole pill is the button, and it shows that the tap was taken. */
function UpdatePill() {
  const [going, setGoing] = useState(false);
  return <button className="update-pill" disabled={going} onClick={() => { sfx.play('ui'); setGoing(true); void applyUpdate(); }}>
    <span>✨ A new version is ready</span><b>{going ? 'Restarting…' : 'Restart ↻'}</b>
  </button>;
}
function saveNow(hero: HeroId, data: Save) { try { localStorage.setItem(saveKey(hero), JSON.stringify(data)); } catch { /* local play remains available */ } }
const levels = (id: RegionId) => `Lv ${WORLDS[id].levels[0]}–${WORLDS[id].levels[1]}`;
/** What the character select screen shows for each hero. */
function heroSummary(id: HeroId): HeroSummary {
  const p = loadProfile(id), sv = getSave(id), next = LEVEL_ORDER.find(r => !sv.done[r]) || LEVEL_ORDER[LEVEL_ORDER.length - 1];
  const points = ACHIEVEMENTS.reduce((n, d) => n + (p.ach.got[d.id] ? d.points : 0), 0);
  return { started: heroStarted(id), level: p.level, gold: p.gold, where: `Chapter ${ROMAN[WORLDS[next].chapter]} · ${WORLDS[next].title}`, stars: LEVEL_ORDER.reduce((n, r) => n + (sv.stars[r] || 0), 0), equipped: p.equipped, points };
}
const practiceSummary = (_id: HeroId): HeroSummary => ({ started: false, level: 1, gold: 0, where: 'Dummy training grounds', stars: 0, equipped: {}, points: 0 });
/** Inside the iOS app, which (like every iOS app) is closed from the home screen, not by a button in the game. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IOS_APP = (window as any).StarfallApp?.platform === 'ios';
/** Closes the app when it runs inside an Android wrapper that offers a way to; returns false in a plain browser. */
function exitApp() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const bridges: Array<[unknown, string]> = [[w.Android, 'exitApp'], [w.Android, 'close'], [w.AndroidInterface, 'exitApp'], [w.AndroidBridge, 'exitApp'], [w.Capacitor?.Plugins?.App, 'exitApp'], [w.navigator?.app, 'exitApp']];
  for (const [o, k] of bridges) {
    const fn = (o as Record<string, unknown> | undefined)?.[k];
    if (typeof fn === 'function') { try { fn.call(o); return true; } catch { /* try the next bridge */ } }
  }
  try { window.close(); } catch { /* not allowed here */ }
  return false;
}

// Keyboard (every key can be changed in the settings): the left hand moves (WASD), dashes (E) and rides (R). The right
// hand attacks on L and casts the other spells leftward along the home row in the order they are learned (K J H); the
// row above opens menus: U spellbook, I inventory, O quest log, P character. F still attacks when it is not bound.
/** Re-renders when the key bindings change, and hands back the label of an action's key. */
/** A function that keeps one identity across renders but always runs the latest `fn`: memoised HUD parts stay put. */
function useStable<A extends unknown[], R>(fn: (...args: A) => R) {
  const ref = useRef(fn); ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}
function useKeys() {
  const [, set] = useState(0);
  useEffect(() => onKeysChange(() => set(n => n + 1)), []);
  return (a: Action) => keyLabel(getKeys()[a]);
}
type JournalTab = 'quests' | 'spells' | 'achievements';
const ITEM_KEYS: Record<string, ItemId> = Object.fromEntries(ITEM_ORDER.filter(id => ITEMS[id].key).map(id => [ITEMS[id].key, id]));
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
  const [hero, setHero] = useState<HeroId>(loadChoice);
  const heroRef = useRef(hero); heroRef.current = hero;
  const [save, setSave] = useState<Save>(() => getSave(loadChoice()));
  const chooseHero = (h: HeroId) => { setHero(h); setSave(getSave(h)); try { localStorage.setItem(CHOICE_KEY, h); } catch { /* ignore */ } };
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [typed, setTyped] = useState(0);
  const [paused, setPaused] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [journal, setJournal] = useState(false);
  const [journalTab, setJournalTab] = useState<JournalTab>('quests');
  const [mapOpen, setMapOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [sheetTab, setSheetTab] = useState<SheetTab>('bag');
  /** The "do you really want to leave?" question on the title screen, and the note shown if the app can't close itself. */
  const [exitAsk, setExitAsk] = useState<'ask' | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [muted, setMuted] = useState(sfx.isMuted());
  const [graphics, setGraphics] = useState<GraphicsSettings>(loadGraphics);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [practiceGuideOpen, setPracticeGuideOpen] = useState(false);
  const [chapterBanner, setChapterBanner] = useState<{ chapter: number; key: number } | null>(null);
  const [regionBanner, setRegionBanner] = useState<{ region: RegionId; danger: boolean; key: number } | null>(null);
  const [zone, setZone] = useState<{ name: string; discovered: boolean; key: number } | null>(null);
  const [spellQueue, setSpellQueue] = useState<SpellId[]>([]);
  const [levelBanner, setLevelBanner] = useState<{ level: number; key: number } | null>(null);
  const [bossBanner, setBossBanner] = useState<{ name: string; title: string } | null>(null);
  /** A star has just fallen (where), or the hero just went down into the depths. */
  const [starBanner, setStarBanner] = useState<{ place: string; land: string; key: number } | null>(null);
  const [depthsBanner, setDepthsBanner] = useState<{ first: boolean; key: number } | null>(null);
  useEffect(() => { if (!starBanner) return; const t = window.setTimeout(() => setStarBanner(null), 5200); return () => window.clearTimeout(t); }, [starBanner]);
  useEffect(() => { if (!depthsBanner) return; const t = window.setTimeout(() => setDepthsBanner(null), 4600); return () => window.clearTimeout(t); }, [depthsBanner]);
  /** After the last chapter's closing cutscene, the ending screen follows. */
  const [endingPending, setEndingPending] = useState(false);
  /** The hero's intro film, which opens a new adventure. */
  const [film, setFilm] = useState(false);
  const introChecked = useRef(-1);
  const [achQueue, setAchQueue] = useState<AchPop[]>([]);
  /** A mini-game a villager offered and the player accepted. */
  const [miniGame, setMiniGame] = useState<NonNullable<QuestOffer['game']> | null>(null);
  const touch = useTouch();
  const touchRef = useRef(touch); touchRef.current = touch;
  const engineRef = useRef<GameEngine | null>(null);
  const toastId = useRef(0);
  const region = snapshot?.region ?? 'meadow';

  // Menu music outside of play; region music is driven by the game loop.
  useEffect(() => { if (mode === 'title' || mode === 'ending') music.play('menu'); }, [mode]);
  const achPop = achQueue[0] ?? null;
  useEffect(() => { if (!achPop) return; const t = window.setTimeout(() => setAchQueue(q => q.slice(1)), 4600); return () => window.clearTimeout(t); }, [achPop]);
  useEffect(() => {
    const unlock = () => { sfx.unlock(); if (music.current() === null && mode !== 'play' && mode !== 'practice') music.play('menu'); };
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
  const notify = useCallback((text: string, tone: NoticeTone = 'info', short?: string, color?: string) => {
    if (touchRef.current) { if (!short && tone === 'info') return; text = short || text; }
    const id = ++toastId.current, max = touchRef.current ? 1 : 2;
    setToasts(list => [...list.filter(t => t.text !== text).slice(-max), { id, text, tone, color }]);
    window.setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), touchRef.current ? 1800 : tone === 'epic' ? 4200 : 2800);
  }, []);
  const onReady = useCallback((engine: GameEngine | null) => { engineRef.current = engine; }, []);
  const onSnapshot = useCallback((state: GameSnapshot) => setSnapshot(state), []);
  const onEvent = useCallback((event: EngineEvent) => {
    switch (event.type) {
      case 'dialogue': engineRef.current?.setMovement(0, 0); resetStick(); setDialogue({ speaker: event.speaker, portrait: event.portrait, lines: event.lines, index: 0, then: event.then, offer: event.offer }); break;
      case 'choice': engineRef.current?.setMovement(0, 0); resetStick(); setDialogue({ speaker: event.speaker, portrait: event.portrait, lines: event.lines, index: 0, choice: { quest: event.quest, title: event.title, a: event.a, b: event.b } }); break;
      case 'notice': notify(event.text, event.tone, event.short); break;
      case 'item': if (!touchRef.current) notify(`Found ${ITEMS[event.id].name}${event.count > 1 ? ` ×${event.count}` : ''}`, 'good'); break;
      case 'loot': { const r = RARITY[event.item.rarity], worn = engineRef.current?.profile.equipped[event.item.slot], up = !event.equipped && !!worn && gearScore(event.item) > gearScore(worn); notify(`${event.equipped ? 'Equipped' : 'Looted'} ${event.item.name} · ${r.name}${up ? ' · ▲ upgrade' : ''}`, RARITY_ORDER.indexOf(event.item.rarity) >= 3 ? 'epic' : 'good', event.item.name, r.color); break; }
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
      case 'starfall': setStarBanner(b => ({ place: event.place, land: WORLDS[event.region].title, key: (b?.key || 0) + 1 })); break;
      case 'depths': setDepthsBanner(b => ({ first: event.first, key: (b?.key || 0) + 1 })); break;
      case 'achievement': {
        setAchQueue(q => [...q, { ...event, key: Date.now() + Math.random() }]);
        break;
      }
      case 'levelComplete': {
        const r = event.region;
        setSave(prev => {
          const next: Save = { ...prev, done: { ...prev.done, [r]: true }, stars: { ...prev.stars, [r]: Math.max(prev.stars[r], event.stats.stars) }, bestTime: { ...prev.bestTime, [r]: prev.bestTime[r] ? Math.min(prev.bestTime[r], event.stats.time) : event.stats.time } };
          saveNow(heroRef.current, next); return next;
        });
        const e = engineRef.current; if (e) saveSession(heroRef.current, e.exportSave());
        // No chapter screen: the chapter's achievement pops, its closing cutscene plays and the next land's first quest
        // begins. After the very last one, the ending follows the cutscene.
        if (event.last) setEndingPending(true);
      }
    }
  }, [notify]);

  const startGame = (fresh = false, as: HeroId = hero) => {
    sfx.unlock();
    if (fresh) clearSession(as);
    setRunKey(k => k + 1); setSnapshot(null); setDialogue(null); setPaused(false); setJournal(false); setMapOpen(false); setPanel(null); setShop(null); setEndingPending(false); setFilm(false); setAchQueue([]); resetStick();
    setSpellQueue([]); setLevelBanner(null); setBossBanner(null); setZone(null); setRegionBanner(null); setToasts([]); setChapterBanner(null); setMode('play');
  };
  const startPractice = (as: HeroId = hero) => {
    engineRef.current = null; chooseHero(as); setPracticeGuideOpen(false); setRunKey(k => k + 1); setSnapshot(null); setDialogue(null); setPaused(false); setJournal(false); setMapOpen(false); setPanel(null); setShop(null); setEndingPending(false); setFilm(false); setAchQueue([]); resetStick();
    setSpellQueue([]); setLevelBanner(null); setBossBanner(null); setZone(null); setRegionBanner(null); setToasts([]); setChapterBanner(null); setMode('practice');
  };
  /** Erases the adventure, the hero's level, gold, bag and quest progress. Sound and graphics settings are kept. */
  /** Erases one hero's adventure, level, gold, bag and quest progress. Sound and graphics settings are kept. */
  const wipeHero = (h: HeroId) => { clearSession(h); resetProfile(h); const s = blankSave(); saveNow(h, s); if (h === hero) setSave(s); };
  /** Starts a brand-new adventure as `h`, erasing only that hero's progress. The hero being played is saved first. */
  const startOver = (h: HeroId = hero) => {
    const e = engineRef.current; if (e && mode === 'play' && h !== hero) saveSession(hero, e.exportSave());
    engineRef.current = null; wipeHero(h); if (h !== hero) chooseHero(h); setSettingsOpen(false); startGame(true, h);
  };
  const deleteAll = () => { engineRef.current = null; for (const h of HERO_ORDER) wipeHero(h); setSave(blankSave()); setPaused(false); setSettingsOpen(false); setJournal(false); setPanel(null); setDialogue(null); setEndingPending(false); setMode('title'); };
  const leaveToTitle = () => { const e = engineRef.current; if (e && mode === 'play') saveSession(hero, e.exportSave()); setPaused(false); setEndingPending(false); setFilm(false); setMode(mode === 'practice' ? 'tutorial' : 'title'); };
  const toggleMute = () => { const m = !muted; sfx.setMuted(m); setMuted(m); if (!m) sfx.play('ui'); };
  const changeGraphics = (patch: Partial<GraphicsSettings>) => { const g = { ...graphics, ...patch }; setGraphics(g); saveGraphics(g); sfx.play('ui'); };
  // New spells and level-ups wait until a cutscene or the intro film is over.
  const showSpell = spellQueue.length && !dialogue && !snapshot?.cine && !film ? spellQueue[0] : null;
  const cine = snapshot?.cine ?? null;
  const blocked = paused || !!dialogue || !!showSpell || mapOpen || !!panel || !!miniGame || !!cine || film;
  const cast = (id: SpellId) => { if (!blocked) engineRef.current?.cast(id); };
  const drink = (id: ItemId) => { if (!paused && !dialogue && !mapOpen && !cine) engineRef.current?.useItem(id); };
  /** Opens the quest log on a tab, or closes it if that tab is already showing. */
  const toggleJournal = (tab: JournalTab) => { setPanel(null); setJournal(open => !(open && journalTab === tab)); setJournalTab(tab); sfx.play('page'); };
  /** The bag and the character sheet are one screen with two tabs; the same key or button again closes it. */
  const openSheet = (tab: SheetTab) => { engineRef.current?.setMovement(0, 0); setJournal(false); setPanel(v => v === 'sheet' && sheetTab === tab ? null : 'sheet'); setSheetTab(tab); sfx.play('page'); };
  const dismissSpell = () => setSpellQueue(q => q.slice(1));
  // The HUD's buttons keep one identity across renders, so the memoised ones only redraw when their own state changes.
  const onCast = useStable(cast), onDrink = useStable(drink), onProfile = useStable(() => openSheet('stats'));
  const onTracker = useStable(() => { setJournal(true); setJournalTab('quests'); sfx.play('page'); });

  // The chapter title plays when a run starts, once the first snapshot says which chapter it is.
  useEffect(() => { if (mode === 'play' && snapshot && !chapterBanner && !film && !snapshot.cine && !engineRef.current?.needsIntro) setChapterBanner({ chapter: snapshot.chapter, key: 1 }); }, [mode, snapshot, chapterBanner, film]);
  // A brand-new adventure opens with the hero's intro film, then a short arrival cutscene.
  useEffect(() => { if (mode !== 'play' || !snapshot || introChecked.current === runKey || snapshot.hero !== hero || engineRef.current?.heroId !== hero) return; introChecked.current = runKey; if (engineRef.current?.needsIntro) { engineRef.current.setMovement(0, 0); setFilm(true); } }, [mode, snapshot, runKey]);
  const cineOn = !!cine;
  useEffect(() => { if (cineOn) { keys.current.clear(); engineRef.current?.setMovement(0, 0); resetStick(); } }, [cineOn]);
  useEffect(() => { if (!endingPending || cineOn) return; const t = window.setTimeout(() => { setEndingPending(false); setMode('ending'); }, 1800); return () => window.clearTimeout(t); }, [endingPending, cineOn]);
  const [showChapter, setShowChapter] = useState(false);
  useEffect(() => { if (!chapterBanner) return; setShowChapter(true); const t = window.setTimeout(() => setShowChapter(false), 3800); return () => window.clearTimeout(t); }, [chapterBanner]);
  useEffect(() => { if (!zone) return; const t = window.setTimeout(() => setZone(null), 3000); return () => window.clearTimeout(t); }, [zone]);
  useEffect(() => { if (!regionBanner) return; const t = window.setTimeout(() => setRegionBanner(null), 4200); return () => window.clearTimeout(t); }, [regionBanner]);
  useEffect(() => { if (!levelBanner) return; const t = window.setTimeout(() => setLevelBanner(null), 3200); return () => window.clearTimeout(t); }, [levelBanner]);
  useEffect(() => { if (!showSpell) return; sfx.play('learn'); const t = window.setTimeout(dismissSpell, 5200); return () => window.clearTimeout(t); }, [showSpell, spellQueue.length]);

  // Typewriter dialogue.
  const line = dialogue ? dialogue.lines[dialogue.index] : '';
  const lastLine = !!dialogue && dialogue.index >= dialogue.lines.length - 1 && typed >= line.length;
  const offerOpen = lastLine && (!!dialogue?.offer || !!dialogue?.choice);
  /** The villager speaking, drawn as they look in the world (the lines only carry their name). */
  const speakerNpc = dialogue ? engineRef.current?.npcs.find(n => n.name === dialogue.speaker) : undefined;
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
    if (dialogue.offer || dialogue.choice) return; // an offer waits for Accept or Decline, a choice for an answer
    const then = dialogue.then; setDialogue(null);
    if (then === 'complete') engineRef.current?.celebrate();
  }, [dialogue, typed, line]);
  const answerOffer = (accept: boolean) => {
    if (dialogue?.choice && offerArmed) { const c = dialogue.choice; setDialogue(null); sfx.play('ui'); engineRef.current?.choose(c.quest, accept ? 'a' : 'b'); return; }
    const offer = dialogue?.offer; if (!offer || !offerArmed) return;
    setDialogue(null);
    if (offer.game) {
      if (!accept) { sfx.play('page'); notify(`Another time, then. ${dialogue.speaker} will be around.`, 'info', 'Not now'); return; }
      const e = engineRef.current; if (!e) return;
      if (offer.game.kind === 'dice' && !e.gameStart('dice')) { notify(`You need ${offer.game.stake} gold to play.`, 'warn', 'Not enough gold'); return; }
      e.setMovement(0, 0); resetStick(); setMiniGame(offer.game); sfx.play('page'); return;
    }
    if (accept) engineRef.current?.acceptQuest(offer.id);
    else { sfx.play('page'); notify(`Maybe later. ${dialogue.speaker} will still be here.`, 'info', 'Maybe later'); }
  };
  const endGame = (r: GameResult) => {
    const g = miniGame; setMiniGame(null); if (!g) return;
    engineRef.current?.gameEnd(g.kind, r);
    if (r.gold > 0) notify(`${g.kind === 'dice' ? 'Starfall Dice' : 'Archery'}: +${r.gold} gold`, 'good', `+${r.gold} gold`);
  };

  const keys = useRef(new Set<string>()), keyMove = useRef(true);
  const syncKeys = () => {
    const k = keys.current, b = getKeys();
    const x = (k.has('arrowright') || k.has(b.right) ? 1 : 0) - (k.has('arrowleft') || k.has(b.left) ? 1 : 0);
    const y = (k.has('arrowdown') || k.has(b.down) ? 1 : 0) - (k.has('arrowup') || k.has(b.up) ? 1 : 0);
    // Letting go of a spell key (with no move key down before or after) mustn't stop a walk started by a click.
    const still = !x && !y, was = keyMove.current; keyMove.current = still;
    if (still && was) return;
    engineRef.current?.setMovement(x, y);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase(), act = actionOf(k);
    if (showSpell && (k === 'enter' || k === ' ' || k === 'escape')) { dismissSpell(); e.preventDefault(); return; }
    if (miniGame || film) return;
    if (cine) {
      if (k === 'escape') engineRef.current?.skipCine(); else if (k === 'enter' || k === ' ' || act === 'interact') engineRef.current?.advanceCine();
      e.preventDefault(); return;
    }
    if (dialogue) {
      if (offerOpen) { if (k === 'enter' || k === ' ' || k === 'y') answerOffer(true); else if (k === 'escape' || k === 'n') answerOffer(false); e.preventDefault(); return; }
      if (k === 'enter' || k === ' ' || act === 'interact') { advanceDialogue(); e.preventDefault(); }
      if (k === 'escape' && !dialogue.offer && !dialogue.choice) setDialogue(null);
      return;
    }
    if (act === 'mute') { toggleMute(); return; }
    if (mapOpen) { if (act === 'map' || k === 'escape') setMapOpen(false); return; }
    if (paused) { if (k === 'escape') { if (settingsOpen) setSettingsOpen(false); else setPaused(false); } return; }
    if (panel) {
      if (k === 'escape' || (panel === 'sheet' && ((act === 'bag' && sheetTab === 'bag') || (act === 'character' && sheetTab === 'stats')))) { setPanel(null); e.preventDefault(); return; }
      if (panel === 'shop') return;
      if (act === 'bag') { setSheetTab('bag'); return; } if (act === 'character') { setSheetTab('stats'); return; }
      if (act === 'spellbook' || act === 'quests') { toggleJournal(act === 'spellbook' ? 'spells' : 'quests'); return; }
      if (ITEM_KEYS[k]) drink(ITEM_KEYS[k]);
      return;
    }
    if (act === 'map') { keys.current.clear(); engineRef.current?.setMovement(0, 0); setMapOpen(true); sfx.play('page'); return; }
    if (k === 'tab' || act === 'quests') { toggleJournal('quests'); e.preventDefault(); return; }
    if (act === 'spellbook') { toggleJournal('spells'); return; }
    if (act === 'achievements') { toggleJournal('achievements'); return; }
    if (act === 'bag' || act === 'character') { keys.current.clear(); openSheet(act === 'bag' ? 'bag' : 'stats'); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) || act === 'up' || act === 'down' || act === 'left' || act === 'right') { keys.current.add(k); syncKeys(); e.preventDefault(); }
    const ids = HEROES[heroRef.current].spells, slot = spellSlot(k), spell = slot >= 0 ? ids[slot] : k === 'f' && !act ? ids[0] : undefined;
    if (spell) { if (!e.repeat || spell === ids[0]) cast(spell); }
    if (e.repeat) return;
    if (ITEM_KEYS[k]) drink(ITEM_KEYS[k]);
    if (act === 'ride' && !blocked) engineRef.current?.toggleMount();
    if (act === 'interact' || k === 'enter') { engineRef.current?.interact(); e.preventDefault(); }
    if (k === 'escape') { keys.current.clear(); engineRef.current?.setMovement(0, 0); if (journal) setJournal(false); else setPaused(true); }
  };
  const keyHandler = useRef(onKeyDown); keyHandler.current = onKeyDown;
  useEffect(() => {
    if (mode !== 'play' && mode !== 'practice') return;
    const down = (e: KeyboardEvent) => keyHandler.current(e);
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); syncKeys(); };
    const blur = () => { keys.current.clear(); engineRef.current?.setMovement(0, 0); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); keys.current.clear(); engineRef.current?.setMovement(0, 0); };
  }, [mode]);
  useEffect(() => { if (paused || dialogue || mapOpen || panel) { keys.current.clear(); engineRef.current?.setMovement(0, 0); resetStick(); } }, [paused, dialogue, mapOpen, panel]);

  // Android back button. In a WebView (and a browser) "back" walks the page history, which would leave the game.
  // An extra history entry catches it instead: back closes whatever is open, opens the pause menu while playing,
  // steps back from the hero select, and on the title screen asks whether to leave the game.
  const onBack = () => {
    if (mode === 'title') { if (settingsOpen) setSettingsOpen(false); else setExitAsk(a => a ? null : 'ask'); return; }
    if (mode === 'select' || mode === 'tutorial' || mode === 'ending') { setMode('title'); return; }
    if (mode === 'practice') { engineRef.current?.setMovement(0, 0); setMode('tutorial'); return; }
    if (showSpell) { dismissSpell(); return; }
    if (miniGame) { endGame({ won: false, gold: 0 }); return; }
    if (film) { setFilm(false); engineRef.current?.startIntro(true); return; }
    if (cine) { engineRef.current?.skipCine(); return; }
    if (dialogue) { if (dialogue.then !== 'complete' && !dialogue.choice) setDialogue(null); return; }
    if (mapOpen) { setMapOpen(false); return; }
    if (panel) { setPanel(null); return; }
    if (journal) { setJournal(false); return; }
    if (paused) { if (settingsOpen) setSettingsOpen(false); else setPaused(false); return; }
    engineRef.current?.setMovement(0, 0); setPaused(true); sfx.play('page');
  };
  const backRef = useRef(onBack); backRef.current = onBack;
  const trapArmed = useRef(true);
  useEffect(() => {
    const arm = () => { try { history.pushState({ starfall: true }, ''); } catch { /* history is unavailable */ } };
    arm();
    const pop = () => { if (!trapArmed.current) return; backRef.current(); arm(); };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const leaveGame = () => {
    sfx.play('ui');
    if (exitApp()) return;
    // No native way to close from here: step past the history trap and the game's own entry, which closes an
    // installed app (or returns to the previous page) without asking for another back press.
    trapArmed.current = false; setExitAsk(null);
    try { history.go(-2); } catch { /* ignore */ }
    // Still here (nothing to go back to): re-arm the trap so the back button keeps working.
    window.setTimeout(() => { if (!trapArmed.current && document.visibilityState === 'visible') { trapArmed.current = true; try { history.pushState({ starfall: true }, ''); } catch { /* ignore */ } } }, 700);
  };
  useEffect(() => { if (mode !== 'title') { setExitAsk(null); if (!trapArmed.current) { trapArmed.current = true; try { history.pushState({ starfall: true }, ''); } catch { /* ignore */ } } } }, [mode]);
  useEffect(() => { if (mode !== 'play') setSettingsOpen(false); }, [mode]);

  const isGamePaused = paused || !!dialogue || mapOpen || !!panel || !!miniGame || film || (mode !== 'play' && mode !== 'practice');
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
  const bannerWorld = chapterBanner ? WORLDS[LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, chapterBanner.chapter - 1)]] : null;
  const kl = useKeys();
  /** Keeps the adventure on disk before a backup is written. */
  const flushSave = () => { const e = engineRef.current; if (e && mode === 'play') { saveSession(hero, e.exportSave()); saveProfile(e.profile); } };
  // A new version can arrive while playing: say so once, and offer the restart in the pause menu (saving first).
  const update = useUpdateReady(), [restarting, setRestarting] = useState(false), toldUpdate = useRef(false);
  useEffect(() => {
    if (!update || toldUpdate.current || (mode !== 'play' && mode !== 'practice')) return;
    toldUpdate.current = true; notify('A new version of the game is ready. Restart it from the pause menu.', 'good', 'New version: see pause menu');
  }, [update, mode, notify]);
  const restartForUpdate = () => { sfx.play('ui'); flushSave(); setRestarting(true); void applyUpdate(); };

  return <div className={`app-shell mode-${mode} ${touch ? 'is-touch' : ''}`}>
    {mode === 'title' && <TitleScreen hero={hero} muted={muted} touch={touch} graphics={graphics} settings={settingsOpen} onSettings={setSettingsOpen} onGraphics={changeGraphics} onToggleMute={toggleMute} onPlay={() => { sfx.play('ui'); setMode('select'); }} onTutorial={() => { sfx.play('ui'); setMode('tutorial'); }} onStartOver={startOver} onDeleteAll={deleteAll} onExit={IOS_APP ? undefined : () => { sfx.play('page'); setExitAsk('ask'); }} />}
    {mode === 'title' && exitAsk && <div className="overlay exit-overlay" onClick={() => setExitAsk(null)}><div className="panel pause-panel exit-panel" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
      <small className="eyebrow">Leave Starfall Grove</small><h2>Do you really want to leave the game?</h2><p>Your adventure is saved. The valley will wait for you.</p>
      <div className="exit-actions"><button className="btn ghost" onClick={() => { sfx.play('ui'); setExitAsk(null); }} autoFocus>Stay</button><button className="btn primary" onClick={leaveGame}>Leave game</button></div>
    </div></div>}
    {mode === 'select' && <CharacterSelect hero={hero} summary={heroSummary} touch={touch} onHero={chooseHero} onEnter={() => startGame()} onBack={() => setMode('title')} />}
    {mode === 'tutorial' && <CharacterSelect hero={hero} summary={practiceSummary} touch={touch} practice onHero={chooseHero} onEnter={() => startPractice()} onBack={() => setMode('title')} />}

    {(mode === 'play' || mode === 'practice') && <main className={`play-page theme-${region} hero-${hero} ${cine || film ? 'cine-on' : ''}`}>
      <section className="game-stage">
        <GameCanvas hero={hero} runKey={runKey} paused={isGamePaused} graphics={graphics} touch={touch} practice={mode === 'practice'} onReady={onReady} onSnapshot={onSnapshot} onEvent={onEvent} />
        {!cine && !film && <button className="minimap-hit" onClick={() => { engineRef.current?.setMovement(0, 0); setMapOpen(true); sfx.play('page'); }} aria-label="Open the world map" title="World map (M)" />}

        <div className="hud-top">
          <Vitals snapshot={snapshot} onProfile={onProfile} />
          <div className="hud-center">
            {snapshot?.boss && <BossBar boss={snapshot.boss} />}
            {snapshot?.siege && !snapshot.boss && <SiegeBar siege={snapshot.siege} />}
            {zone && !snapshot?.boss && !snapshot?.siege && <div className="zone-banner" key={zone.key}><span>✦</span>{zone.name}<span>✦</span>{zone.discovered && !touch && <em>Discovered</em>}</div>}
          </div>
          <div className="hud-buttons">
            {snapshot?.mount && <button className={`icon-button mount-button ${snapshot.mount.riding ? 'on' : ''}`} onClick={() => engineRef.current?.toggleMount()} aria-label={snapshot.mount.riding ? 'Dismount' : `Ride ${snapshot.mount.name}`} title={`${snapshot.mount.riding ? 'Dismount' : `Ride ${snapshot.mount.name}`} (${kl('ride')})`}>{MOUNTS[snapshot.mount.id].icon}</button>}
            <button className="icon-button" onClick={() => openSheet('bag')} aria-label="Bag" title="Bag and equipment (I)">🎒</button>
            <button className="icon-button" onClick={() => { setMapOpen(true); sfx.play('page'); }} aria-label="World map" title="Map (M)">🗺️</button>
            <button className="icon-button journal-button" onClick={() => toggleJournal('quests')} aria-label="Journal: quests, spellbook and achievements" title={`Journal: quests (${kl('quests')}), spellbook (${kl('spellbook')}), achievements (${kl('achievements')})`}><JournalIcon /></button>
            <button className={`icon-button ${update ? 'has-update' : ''}`} onClick={() => { engineRef.current?.setMovement(0, 0); setPaused(true); }} aria-label={update ? 'Pause (a new version is ready)' : 'Pause'} title="Pause (Esc)">❚❚</button>
          </div>
        </div>
        {mode === 'practice' && <button className={`practice-guide-toggle ${practiceGuideOpen ? 'guide-button-on' : ''}`} onClick={() => setPracticeGuideOpen(open => !open)} aria-pressed={practiceGuideOpen} aria-label={practiceGuideOpen ? 'Hide spell guide' : 'Show spell guide'} title={practiceGuideOpen ? 'Hide spell guide' : 'Show spell guide'}><span>Spell guide</span><i className="guide-toggle-track"><b /></i></button>}
        {mode === 'practice' && practiceGuideOpen && <PracticeSpellGuide hero={hero} />}
        {snapshot && !journal && !panel && !mapOpen && <QuestTracker snapshot={snapshot} onOpen={onTracker} />}

        {snapshot && snapshot.combo >= 3 && <div className="combo" key={`combo-${snapshot.combo}`}><b>{snapshot.combo}</b><small>COMBO</small></div>}
        <div className="toasts">{toasts.map(t => <div key={t.id} className={`toast tone-${t.tone} ${t.color ? 'loot' : ''}`} style={t.color ? { '--r': t.color } as CSSProperties : undefined}>{t.text}</div>)}</div>

        {snapshot?.work && <div className="work-bar"><span>🔨 {snapshot.work.label}…</span><i style={{ width: `${Math.round(snapshot.work.t * 100)}%` }} /></div>}
        {snapshot?.nearName && !dialogue && !panel && !cine && <button className={`near-prompt ${touch ? 'compact' : ''}`} onClick={() => engineRef.current?.interact()} aria-label={`${snapshot.nearAction} ${snapshot.nearName}`}>
          {touch ? <span>{snapshot.nearAction}</span> : <><kbd>{kl('interact')}</kbd><span>{snapshot.nearAction}</span><b>{snapshot.nearName}</b></>}
        </button>}

        <div className="spellbar">
          {snapshot?.spells.map(s => <SpellButton key={s.id} spell={s} onCast={onCast} />)}
          <span className="bar-gap" />
          {snapshot && ['healthPotion' as ItemId, snapshot.quick].map(id => <PotionButton key={id} id={id} count={snapshot.items.find(i => i.id === id)?.count ?? 0} onUse={onDrink} />)}
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
            {snapshot?.spells.map(s => <SpellButton key={s.id} spell={s} onCast={onCast} touch />)}
            <PotionButton id="healthPotion" count={potions} onUse={onDrink} touch />
            {snapshot && <PotionButton id={snapshot.quick} count={snapshot.items.find(i => i.id === snapshot.quick)?.count ?? 0} onUse={onDrink} touch quick />}
          </div>
        </div>

        {showChapter && bannerWorld && chapterBanner && <div className="chapter-banner" key={`chapter-${chapterBanner.key}`}>
          <small>Chapter {ROMAN[bannerWorld.chapter]}</small><h2>{bannerWorld.title}</h2><p>{bannerWorld.subtitle}</p><i />
        </div>}
        {regionBanner && !showChapter && !levelBanner && !showSpell && !cine && <div className={`region-banner ${regionBanner.danger ? 'danger' : ''}`} key={`region-${regionBanner.key}`}>
          <small>Entering</small><h3>{WORLDS[regionBanner.region].title}</h3><span>Creatures {levels(regionBanner.region)}</span>
          {regionBanner.danger && <em>⚠ Too dangerous for your level</em>}
        </div>}
        {starBanner && !cine && <div className="star-banner" key={`star-${starBanner.key}`}><small>⭐ A star has fallen</small><h3>{starBanner.place}</h3><span>{starBanner.land} · Follow the gold-white arrow</span></div>}
        {depthsBanner && !cine && <div className="region-banner depths-banner" key={`depths-${depthsBanner.key}`}><small>{depthsBanner.first ? 'The ground gave way' : 'Descending'}</small><h3>The Depths</h3><span>Beneath the Dawn Forge · Creatures Lv 26–30</span></div>}
        {levelBanner && !snapshot?.cine && <div className="level-banner" key={`level-${levelBanner.key}`}><small>Level up</small><b>{levelBanner.level}</b><span>Health and magic restored</span></div>}

        {bossBanner && <div className="boss-banner"><div className="letterbox top" /><div className="letterbox bottom" /><div className="boss-name"><small>{bossBanner.title}</small><h2>{bossBanner.name}</h2></div></div>}

        {showSpell && <div className="spell-banner" onClick={dismissSpell} style={{ '--spell': SPELLS[showSpell].color } as CSSProperties}>
          <div className="spell-card">
            <div className="spell-rays" /><div className="spell-icon">{SPELLS[showSpell].icon}</div>
            <small>New spell · Level {SPELLS[showSpell].level}</small><h2>{SPELLS[showSpell].name}</h2><p>{SPELLS[showSpell].description}</p>
            {touch ? <em className="tap-note">Tap its {SPELLS[showSpell].icon} button to cast</em> : <kbd>Press {keyLabel(getKeys()[(['spell1', 'spell2', 'spell3', 'spell4', 'spell5'] as Action[])[HEROES[hero].spells.indexOf(showSpell)] || 'spell1'])}</kbd>}
          </div>
        </div>}

        {dialogue && <div className={`dialogue ${dialogue.offer ? 'has-offer' : ''} ${offerOpen ? 'offer-open' : ''}`} onClick={advanceDialogue} role="dialog" aria-modal="true">
          <div className="dialogue-portrait">{dialogue.portrait.startsWith('hero:') ? <HeroFace hero={dialogue.portrait.slice(5) as HeroId} /> : speakerNpc && !speakerNpc.beast ? <PersonFace id={speakerNpc.id} look={speakerNpc.look} /> : dialogue.portrait}</div>
          <div className="dialogue-body">
            <strong>{dialogue.speaker}</strong>
            <p>{line.slice(0, typed)}<span className="caret" /></p>
            {offerOpen && dialogue.offer && <div className="offer" onClick={e => e.stopPropagation()}>
              <div className={`offer-info ${dialogue.offer.main ? 'main' : ''}`}><small>{dialogue.offer.game ? 'Mini-game' : dialogue.offer.main ? 'Main quest' : 'Side quest'}</small><b>{dialogue.offer.title}</b><em>{dialogue.offer.summary}</em><span>Reward: {dialogue.offer.reward}</span></div>
              <div className={`offer-actions ${offerArmed ? 'armed' : ''}`}>
                <button className="btn ghost" disabled={!offerArmed} onClick={() => answerOffer(false)}>{dialogue.offer.game ? 'Not now' : 'Decline'}</button>
                <button className="btn primary" disabled={!offerArmed} onClick={() => answerOffer(true)}>{dialogue.offer.game ? 'Play' : 'Accept'}</button>
              </div>
            </div>}
            {offerOpen && dialogue.choice && <div className="offer choice" onClick={e => e.stopPropagation()}>
              <div className="offer-info main"><small>Your answer</small><b>{dialogue.choice.title}</b><em>What you say changes what happens next.</em></div>
              <div className={`offer-actions ${offerArmed ? 'armed' : ''}`}>
                <button className="btn ghost" disabled={!offerArmed} onClick={() => answerOffer(false)}>{dialogue.choice.b}</button>
                <button className="btn primary" disabled={!offerArmed} onClick={() => answerOffer(true)}>{dialogue.choice.a}</button>
              </div>
            </div>}
            {!offerOpen && <div className="dialogue-foot"><span>{dialogue.index + 1} / {dialogue.lines.length}</span><em>{typed < line.length ? (touch ? 'Tap to skip' : 'Click to skip') : dialogue.index < dialogue.lines.length - 1 ? 'Continue ▸' : 'Close ▸'}</em></div>}
          </div>
        </div>}

        {journal && <Journal key={journalTab} initial={journalTab} snapshot={snapshot} engine={engineRef.current} achievements={engineRef.current?.achievementRows() ?? []} touch={touch} onClose={() => setJournal(false)} onTrack={id => engineRef.current?.track(id)} onUpgrade={id => engineRef.current?.upgradeSpell(id)} />}
        {panel === 'sheet' && snapshot && engineRef.current && <CharacterScreen snapshot={snapshot} engine={engineRef.current} initial={sheetTab} touch={touch} onUse={id => engineRef.current?.useItem(id)} onClose={() => setPanel(null)} />}
        {panel === 'shop' && shop && snapshot && engineRef.current && <ShopPanel shop={shop} snapshot={snapshot} engine={engineRef.current} onClose={() => setPanel(null)} />}
        {miniGame && snapshot && <MiniGameOverlay kind={miniGame.kind} opponent={miniGame.opponent} portrait={miniGame.portrait} stake={miniGame.stake} level={snapshot.level} onEnd={endGame} />}
        {mapOpen && engineRef.current && <MapOverlay engine={engineRef.current} touch={touch} onClose={() => setMapOpen(false)} />}

        {cine && <CineOverlay cine={cine} touch={touch} onNext={() => engineRef.current?.advanceCine()} onSkip={() => engineRef.current?.skipCine()} />}
        {film && <IntroFilm hero={hero} onDone={() => { setFilm(false); engineRef.current?.startIntro(true); }} onFail={() => { setFilm(false); engineRef.current?.startIntro(false); }} />}
        {achPop && !cine && !film && <div className="ach-pop" key={achPop.key}>
          <span className="ach-shield"><b>{achPop.icon}</b></span>
          <span className="ach-text"><small>Achievement earned</small><strong>{achPop.name}</strong>{!touch && <em>{achPop.description}</em>}</span>
          <span className="ach-points"><b>{achPop.points}</b></span>
        </div>}

        {paused && settingsOpen && <div className="overlay"><div className="panel pause-panel settings-panel">
          <button className="icon-button settings-close" onClick={() => { setSettingsOpen(false); sfx.play('page'); }} aria-label="Close settings" title="Close">✕</button>
          <SettingsBody graphics={graphics} onGraphics={changeGraphics} touch={touch} />
          <BackupPanel onBeforeExport={flushSave} />
          <button className="btn primary" onClick={() => setSettingsOpen(false)}>Back <b>←</b></button>
          <DangerZone hero={hero} onStartOver={startOver} onDeleteAll={deleteAll} />
        </div></div>}
        {paused && !settingsOpen && <div className="overlay"><div className="panel pause-panel">
          <small className="eyebrow">Paused</small><h2>Take a breath.</h2><p>Your adventure is saved. The valley can wait.</p>
          <div className="controls-grid">
            <span><kbd>{kl('up')}{kl('left')}{kl('down')}{kl('right')}</kbd> Move</span>{HEROES[hero].spells.map((id, i) => <span key={id}><kbd>{kl((['spell1', 'spell2', 'spell3', 'spell4', 'spell5'] as Action[])[i])}</kbd> {SPELLS[id].name}</span>)}<span><kbd>{kl('interact')}</kbd> Talk / use</span>
            <span><kbd>{kl('ride')}</kbd> Ride mount</span><span><kbd>1</kbd>–<kbd>0</kbd> Potions &amp; bombs</span><span><kbd>{kl('spellbook')}</kbd> Spellbook</span><span><kbd>{kl('bag')}</kbd> Bag</span><span><kbd>{kl('quests')}</kbd> Quest log</span><span><kbd>{kl('character')}</kbd> Character</span><span><kbd>{kl('achievements')}</kbd> Achievements</span><span><kbd>{kl('map')}</kbd> Map</span>
          </div>
          {update && <div className="update-row"><span>✨ A new version is ready. Your adventure is saved first.</span><button className="btn primary" disabled={restarting} onClick={restartForUpdate}>{restarting ? 'Restarting…' : 'Restart now ↻'}</button></div>}
          <button className={`btn ${update ? 'ghost' : 'primary'}`} onClick={() => setPaused(false)}>Resume adventure <b>→</b></button>
          <button className="btn ghost leave-btn" onClick={() => { sfx.play('ui'); leaveToTitle(); }} title="Back to the main menu">⌂ Main menu</button>
          <div className="pause-row">
            <button className="btn ghost" onClick={() => { setSettingsOpen(true); sfx.play('page'); }}>⚙ Settings</button>
            <button className="btn ghost" onClick={toggleMute}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            <button className={`btn ghost ${graphics.showFps ? 'on' : ''}`} onClick={() => changeGraphics({ showFps: !graphics.showFps })} aria-pressed={graphics.showFps}>{graphics.showFps ? 'FPS on' : 'FPS off'}</button>
          </div>
        </div></div>}
      </section>
    </main>}

    {mode === 'ending' && <main className="menu-page ending-page">
      <TitleBackdrop level="ember" />
      <Confetti />
      <div className="panel victory-panel">
        <small className="eyebrow">The valley remembers</small>
        <h1>Every light <em>is shining.</em></h1>
        <p>You relit the Beacon, rang the Ancient Bell, returned the Star to its Cradle, woke the Dawn Forge and cast out Umbra, the Eclipse. Orrin and Sable are home, and {hero === 'mira' ? `${HEROES[hero].name} and Tuft have` : `${HEROES[hero].name} has`} become the valley’s newest legend.</p>
        <div className="star-row">{LEVEL_ORDER.map(id => <span key={id} className="on" title={WORLDS[id].title}>{'★'.repeat(save.stars[id] || 1)}</span>)}</div>
        <div className="menu-actions">
          <button className="btn primary" onClick={() => startGame()}>Keep exploring <b>→</b></button>
          <button className="btn ghost" onClick={() => setMode('title')}>Title</button>
        </div>
      </div>
    </main>}
  </div>;
}

/** Title: the logo and one big Play button, centred on screen. Choosing a hero happens on the next screen. */
function TitleScreen({ hero, muted, touch, graphics, settings, onSettings, onGraphics, onToggleMute, onPlay, onTutorial, onStartOver, onDeleteAll, onExit }: { hero: HeroId; muted: boolean; touch: boolean; graphics: GraphicsSettings; settings: boolean; onSettings: (open: boolean) => void; onGraphics: (g: Partial<GraphicsSettings>) => void; onToggleMute: () => void; onPlay: () => void; onTutorial: () => void; onStartOver: () => void; onDeleteAll: () => void; onExit?: () => void }) {
  const save = getSave(hero), next = LEVEL_ORDER.find(id => !save.done[id]) || LEVEL_ORDER[LEVEL_ORDER.length - 1], last = heroStarted(hero) ? heroSummary(hero) : null;
  const kl = useKeys();
  const update = useUpdateReady();
  return <main className="menu-page title-page">
    <TitleBackdrop level={next} />
    <header className="title-top">
      {update && <UpdatePill />}
      <div className="title-tools">
        <button className="icon-button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</button>
        <button className="icon-button" onClick={() => { onSettings(true); sfx.play('page'); }} aria-label="Settings" title="Settings">⚙</button>
        {onExit && <button className="icon-button exit-button" onClick={onExit} aria-label="Leave the game" title="Leave the game"><PowerIcon /></button>}
      </div>
    </header>
    <section className="title-hero">
      <small className="eyebrow">A storybook action RPG</small>
      <h1 className="title-logo"><span>Starfall</span><span>Grove</span></h1>
      <p className="title-tag">Four lands · five heroes · one fallen star</p>
      <p className="title-blurb">A fallen star has dimmed the valley, and Master Orrin has vanished. Cross sunlit meadows, whispering woods, the silver summit and the burning Ember Wastes. Help the valley folk, gather loot, earn achievements — and learn what hides inside the Hollow Star.</p>
      <div className="menu-actions title-actions"><button className="btn primary big play-button" onClick={onPlay}>Play <b>→</b></button><button className="btn ghost big" onClick={onTutorial}>Training <b>✦</b></button></div>
      {last && <button className="last-played" onClick={onPlay}><span className="portrait"><HeroFace hero={hero} /></span><span><b>{HEROES[hero].name} · Level {last.level}</b><small>{last.where}</small></span></button>}
    </section>
    {!touch && <footer className="title-foot"><span><kbd>{kl('up')}{kl('left')}{kl('down')}{kl('right')}</kbd> move</span><span><kbd>{kl('spell1')}</kbd> attack</span><span><kbd>{kl('spell2')} {kl('spell3')} {kl('spell4')} {kl('spell5')}</kbd> abilities</span><span><kbd>{kl('interact')}</kbd> interact</span><span><kbd>{kl('ride')}</kbd> ride</span><span><kbd>1–0</kbd> potions &amp; bombs</span><span><kbd>{kl('bag')}</kbd> bag</span><span><kbd>{kl('map')}</kbd> map</span></footer>}
    {settings && <div className="overlay" onClick={() => onSettings(false)}><div onClick={e => e.stopPropagation()} className="panel pause-panel settings-panel">
      <button className="icon-button settings-close" onClick={() => { onSettings(false); sfx.play('page'); }} aria-label="Close settings" title="Close">✕</button>
      <SettingsBody graphics={graphics} onGraphics={onGraphics} touch={touch} />
      <BackupPanel />
      <button className="btn primary" onClick={() => onSettings(false)}>Back <b>←</b></button>
      <DangerZone hero={hero} onStartOver={onStartOver} onDeleteAll={onDeleteAll} />
    </div></div>}
  </main>;
}

/** Graphics and sound, shared by the title screen and the pause menu. */
function SettingsBody({ graphics, onGraphics, touch }: { graphics: GraphicsSettings; onGraphics: (g: Partial<GraphicsSettings>) => void; touch: boolean }) {
  return <>
    <small className="eyebrow">Settings</small><h2>Graphics &amp; sound</h2>
    <p>Lower these if the game feels slow or the device gets warm. Changes apply right away.</p>
    <SettingRow label="Quality" hint="Auto adjusts to your device">{QUALITIES.map(q => <button key={q} className={graphics.quality === q ? 'on' : ''} onClick={() => onGraphics({ quality: q })}>{LABEL[q]}</button>)}</SettingRow>
    <SettingRow label="Grass & flowers" hint="Plants on the ground; they sway in the wind on High quality">{DECOR_LEVELS.map(d => <button key={d} className={graphics.decor === d ? 'on' : ''} onClick={() => onGraphics({ decor: d })}>{LABEL[d]}</button>)}</SettingRow>
    <SettingRow label="Weather effects" hint="Petals, leaves, snow, fireflies, light rays">{[true, false].map(v => <button key={String(v)} className={graphics.weather === v ? 'on' : ''} onClick={() => onGraphics({ weather: v })}>{v ? 'On' : 'Off'}</button>)}</SettingRow>
    <SettingRow label="Frame rate" hint="30 is steadier on weak tablets">{([60, 30] as const).map(v => <button key={v} className={graphics.fps === v ? 'on' : ''} onClick={() => onGraphics({ fps: v })}>{v} fps</button>)}</SettingRow>
    <SettingRow label="Screen shake">{[true, false].map(v => <button key={String(v)} className={graphics.shake === v ? 'on' : ''} onClick={() => onGraphics({ shake: v })}>{v ? 'On' : 'Off'}</button>)}</SettingRow>
    <SettingRow label="Show FPS">{[true, false].map(v => <button key={String(v)} className={graphics.showFps === v ? 'on' : ''} onClick={() => onGraphics({ showFps: v })}>{v ? 'On' : 'Off'}</button>)}</SettingRow>
    <VolumeControls />
    {!touch && <KeyControls />}
  </>;
}

/** Every keyboard action with its key: click one, then press the new key. A key already in use swaps places. */
function KeyControls() {
  const [wait, setWait] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const kl = useKeys();
  useEffect(() => {
    if (!wait) return;
    const down = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopImmediatePropagation();
      const k = e.key.toLowerCase();
      if (k === 'escape') { setWait(null); setNote(''); return; }
      if (RESERVED.has(k)) { setNote(`${keyLabel(k)} is kept for something else (arrows, 1–0, Tab, Enter, Esc). Pick another key.`); return; }
      const other = actionOf(k);
      bindKey(wait, k); sfx.play('ui');
      setNote(other && other !== wait ? `Swapped with “${ACTIONS.find(a => a.id === other)!.name}”.` : ''); setWait(null);
    };
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, [wait]);
  return <section className="key-controls">
    <div className="kc-head"><span><b>Controls</b><em>Click an action, then press its new key. The arrow keys always move too, a mouse click walks to the spot (or to whoever you click), and 1–0 use potions and bombs.</em></span><button className="btn ghost" onClick={() => { resetKeys(); setNote('Default keys restored.'); sfx.play('ui'); }}>Reset</button></div>
    {(['Move', 'Fight', 'Menus'] as const).map(g => <div key={g} className="kc-group"><small>{g}</small><div className="kc-grid">{ACTIONS.filter(a => a.group === g).map(a => <button key={a.id} className={`kc-key ${wait === a.id ? 'listening' : ''}`} onClick={() => { setWait(w => w === a.id ? null : a.id); setNote(''); sfx.play('page'); }}>
      <span>{a.name}</span><kbd>{wait === a.id ? 'Press a key…' : kl(a.id)}</kbd></button>)}</div></div>)}
    {note && <p className="kc-note">{note}</p>}
  </section>;
}

/** Save backups: one file with every hero's progress, to keep safe or to move to another device. */
function BackupPanel({ onBeforeExport }: { onBeforeExport?: () => void }) {
  const [msg, setMsg] = useState<{ text: string; tone: 'good' | 'warn' } | null>(null);
  const [pending, setPending] = useState<{ backup: Backup; heroes: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    const r = await readBackup(f); if (input.current) input.current.value = '';
    if (!r.ok) { setMsg({ text: r.error, tone: 'warn' }); sfx.play('nope'); return; }
    setPending({ backup: r.backup, heroes: r.heroes }); setMsg(null); sfx.play('page');
  };
  return <section className="backup-panel">
    <div className="dz-row"><span><b>Back up your saves</b><em>Your progress lives only in this browser. Download a backup file with every hero, and load it here again — or on another device — if anything is lost.</em></span>
      <div className="backup-actions">
        <button className="btn ghost" onClick={() => { onBeforeExport?.(); const r = exportBackup(); if (!r.ok) { setMsg({ text: 'The backup could not be saved on this device.', tone: 'warn' }); sfx.play('nope'); return; } setMsg({ text: r.native === 'android' ? `Backup saved to your Downloads folder (${r.count} entries).` : r.native === 'ios' ? `Backup ready (${r.count} entries): choose where to keep it, like Files or iCloud Drive.` : `Backup saved (${r.count} entries). Keep the file somewhere safe.`, tone: 'good' }); sfx.play('pickup'); }}>⬇ Export</button>
        <button className="btn ghost" onClick={() => input.current?.click()}>⬆ Import</button>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={e => pick(e.target.files?.[0])} />
      </div>
    </div>
    {pending && <div className="backup-confirm"><p>Load this backup{pending.backup.exported ? ` from ${new Date(pending.backup.exported).toLocaleString()}` : ''} ({pending.heroes} hero{pending.heroes === 1 ? '' : 'es'})? It replaces every save on this device.</p>
      <div><button className="btn ghost" onClick={() => setPending(null)}>Cancel</button><ConfirmButton label="Replace my saves" onConfirm={() => { restoreBackup(pending.backup); location.reload(); }} /></div></div>}
    {msg && <p className={`backup-msg ${msg.tone}`}>{msg.text}</p>}
  </section>;
}

/** "Start over as" wipes only the hero picked in the list and starts a new adventure as them; "Delete all saves" wipes every hero. Both ask twice. */
function DangerZone({ hero, onStartOver, onDeleteAll }: { hero: HeroId; onStartOver: (h: HeroId) => void; onDeleteAll: () => void }) {
  const [pick, setPick] = useState<HeroId>(hero), name = HEROES[pick].name;
  return <div className="danger-zone">
    <div className="dz-row"><span><b className="dz-pick">Start over as <select value={pick} onChange={e => setPick(e.target.value as HeroId)} aria-label="Hero to start over as">{HERO_ORDER.map(h => <option key={h} value={h}>{HEROES[h].name} · {HEROES[h].title}</option>)}</select></b>
      <em>Erases {name}’s level, gold, bag and quests, then starts a new adventure as {name}. Other heroes are kept{pick !== hero ? `, and ${HEROES[hero].name}’s adventure is saved` : ''}.</em></span><ConfirmButton key={pick} label="Start over" onConfirm={() => onStartOver(pick)} /></div>
    <div className="dz-row"><span><b>Delete all saves</b><em>Erases every hero’s progress and returns to the title. Settings are kept.</em></span><ConfirmButton label="Delete all" onConfirm={onDeleteAll} /></div>
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

/** Only redraws when the values it shows change, not on every snapshot. */
const VITAL_KEYS = ['hp', 'maxHp', 'mana', 'maxMana', 'level', 'xp', 'xpNext', 'hero', 'shield', 'gold', 'buffs', 'fragments', 'starhearts'] as const;
const Vitals = memo(function Vitals({ snapshot, onProfile }: { snapshot: GameSnapshot | null; onProfile: () => void }) {
  const hp = snapshot?.hp ?? 100, max = snapshot?.maxHp ?? 100, mana = snapshot?.mana ?? 80, maxMana = snapshot?.maxMana ?? 100;
  const level = snapshot?.level ?? 1, xp = snapshot?.xp ?? 0, next = snapshot?.xpNext ?? 1, pct = Math.max(0, hp / max) * 100;
  return <div className="vitals-wrap">
    <div className={`vitals ${hp <= max * .25 ? 'critical' : ''}`}>
      <button className="portrait" onClick={onProfile} aria-label="Character details" title="Character (P)"><span><HeroFace hero={snapshot?.hero ?? 'mira'} /></span>{snapshot?.shield && <i className="shield-ring" />}<b className="level-badge">{level}</b></button>
      <div className="bars">
        <div className="health" title="Health"><i className="lag" style={{ width: `${pct}%` }} /><i className="fill" style={{ width: `${pct}%` }} /><b>{Math.max(0, Math.ceil(hp))} / {max}</b></div>
        <div className="mana" title={HEROES[snapshot?.hero ?? 'mira'].resource}><i style={{ width: `${(mana / maxMana) * 100}%` }} /><b>{mana}</b></div>
        <div className="xp" title={`${xp} / ${next} XP`}><i style={{ width: next ? `${(xp / next) * 100}%` : '100%' }} /><b>{next ? `${xp} / ${next} XP` : 'MAX'}</b></div>
      </div>
    </div>
    <div className="vitals-row">
      <span className="gold-chip" title="Gold"><i />{snapshot?.gold ?? 0}</span>
      {!!snapshot && (snapshot.fragments > 0 || snapshot.starhearts > 0) && <span className="star-chip" title={`Star fragments: ${snapshot.fragments} of 8 toward the next Starheart (${snapshot.starhearts} made)`}>✦ {snapshot.fragments}/8</span>}
      {!!snapshot?.buffs.length && <div className="buffs">{snapshot.buffs.map(b => <span key={b.id} className="buff" title={`${ITEMS[b.id].name} · ${Math.ceil(b.time)}s`} style={{ '--c': ITEMS[b.id].color, '--p': `${(b.time / b.max) * 360}deg` } as CSSProperties}><span className="buff-icon"><ItemIcon id={b.id} size={20} /></span><b>{Math.ceil(b.time)}</b></span>)}</div>}
    </div>
  </div>;
}, (a, b) => a.onProfile === b.onProfile && VITAL_KEYS.every(k => a.snapshot?.[k] === b.snapshot?.[k]));

/** WoW-style objective list: the main quest in gold, followed side quests in blue, just goals and counts. */
const QuestTracker = memo(function QuestTracker({ snapshot, onOpen }: { snapshot: GameSnapshot; onOpen: () => void }) {
  const main = snapshot.main, sf = snapshot.starfall;
  const sides = snapshot.quests.filter(q => q.status === 'active' || q.status === 'ready').sort((a, b) => Number(b.tracked) - Number(a.tracked)).slice(0, 3);
  return <button className="tracker" onClick={onOpen} aria-label="Open quest log">
    <span className="trk trk-main"><b>{main.title}<i> {main.index}/{main.total}</i></b><span>{main.step}{main.count > 0 && <em>{main.progress}/{main.count}</em>}</span></span>
    {sides.map(q => <span key={q.id} className={`trk trk-side ${q.status === 'ready' ? 'ready' : ''}`}><b>{q.title}</b><span>{q.goal}{q.count > 0 && <em>{q.progress}/{q.count}</em>}</span></span>)}
    {sf && <span className="trk trk-star"><b>⭐ Fallen star<i> {Math.floor(sf.left / 60)}:{String(sf.left % 60).padStart(2, '0')}</i></b><span>{sf.boss ? `Defeat its beast · ${sf.place}` : `Open the star-forged chest · ${sf.place}`}<em>{sf.found}/{sf.total}</em></span></span>}
  </button>;
}, (a, b) => a.onOpen === b.onOpen && a.snapshot.main === b.snapshot.main && a.snapshot.quests === b.snapshot.quests && a.snapshot.starfall?.left === b.snapshot.starfall?.left && a.snapshot.starfall?.found === b.snapshot.starfall?.found && a.snapshot.starfall?.boss === b.snapshot.starfall?.boss);

function BossBar({ boss }: { boss: NonNullable<GameSnapshot['boss']> }) {
  const pct = (boss.hp / boss.maxHp) * 100;
  return <div className={`boss-bar phase-${boss.phase}`}>
    <div className="boss-label"><strong>{boss.name}</strong><span className="boss-lv">Lv {boss.level}</span>{boss.phase > 1 && <em>ENRAGED</em>}</div>
    <div className="boss-track"><i className="lag" style={{ width: `${pct}%` }} /><i className="fill" style={{ width: `${pct}%` }} /><span className="mark" /></div>
  </div>;
}

const SpellButton = memo(function SpellButton({ spell, onCast, touch }: { spell: SpellState; onCast: (id: SpellId) => void; touch?: boolean }) {
  const ready = spell.unlocked && spell.cooldown <= 0 && spell.affordable;
  const style = { '--cd': `${spell.cooldown * 360}deg`, '--spell': SPELLS[spell.id].color } as CSSProperties;
  return <button className={`spell spell-${spell.id} slot-${SPELLS[spell.id].slot} ${ready ? 'ready' : ''} ${spell.active ? 'active' : ''} ${spell.unlocked ? '' : 'locked'} ${!spell.affordable ? 'poor' : ''} ${touch ? 'touch' : ''}`}
    style={style} onPointerDown={e => { e.preventDefault(); onCast(spell.id); }} aria-label={spell.name} title={spell.unlocked ? `${spell.name} (${spell.key})${spell.cost ? ` · ${spell.cost} mana` : ''} · ${SPELLS[spell.id].description}` : `${spell.name} · learned at level ${spell.level} · ${SPELLS[spell.id].description}`}>
    <span className="spell-icon-wrap"><b>{spell.unlocked ? spell.icon : '🔒'}</b>{spell.cooldown > 0 && <i className="cd" />}</span>
    {!touch && spell.unlocked && <kbd>{spell.key}</kbd>}
    {spell.cost > 0 && spell.unlocked && <small>{spell.cost}</small>}
    {!spell.unlocked && <small className="lvl">Lv {spell.level}</small>}
  </button>;
});

function PracticeSpellGuide({ hero }: { hero: HeroId }) {
  return <aside className="practice-guide" aria-label="Spell guide">
    <header><span><small>Training grounds</small><strong>Spell guide</strong></span><em>All unlocked</em></header>
    {HEROES[hero].spells.map(id => { const s = SPELLS[id]; return <article key={id} style={{ '--spell': s.color } as CSSProperties}><span className="guide-icon">{s.icon}</span><div><b>{s.name} <kbd>{s.key}</kbd></b><p>{s.description}</p></div></article>; })}
  </aside>;
}

const PotionButton = memo(function PotionButton({ id, count, onUse, touch, quick }: { id: ItemId; count: number; onUse: (id: ItemId) => void; touch?: boolean; quick?: boolean }) {
  return <button className={`spell potion potion-${id} ${quick ? 'quick' : ''} ${touch ? 'touch' : ''} ${count ? 'ready' : 'poor'}`} style={{ '--spell': ITEMS[id].color } as CSSProperties}
    onPointerDown={e => { e.preventDefault(); onUse(id); }} aria-label={`${ITEMS[id].name} (${count})`} title={`${ITEMS[id].name}${ITEMS[id].key ? ` (${ITEMS[id].key})` : ''} · ${ITEMS[id].description}`}>
    <span className="spell-icon-wrap"><ItemIcon id={id} size={touch ? 30 : 34} /></span>
    {!touch && ITEMS[id].key && <kbd>{ITEMS[id].key}</kbd>}
    <small className="count">{count}</small>
  </button>;
});

/** Merchants sell potions and bombs and buy loot; smiths forge the three permanent upgrades; armourers sell costly
 *  equipment and buy spare gear; stable masters sell mounts. */
function ShopPanel({ shop, snapshot, engine, onClose }: { shop: Shop; snapshot: GameSnapshot; engine: GameEngine; onClose: () => void }) {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const gold = snapshot.gold, refresh = () => setTick(t => t + 1);
  const junk = snapshot.gear.filter(g => g.rarity === 'common' || g.rarity === 'uncommon');
  return <aside className="side-panel shop-panel">
    <div className="journal-head"><strong>{shop.portrait} {shop.kind === 'merchant' ? 'Merchant' : shop.kind === 'armorer' ? 'Armoury' : shop.kind === 'stable' ? 'Stable' : shop.kind === 'flight' ? 'Flight Master' : 'Smithy'}</strong><span className="gold-chip big"><i />{gold}</span><button className="icon-button" onClick={onClose} aria-label="Close shop">✕</button></div>
    <p className="panel-note">{shop.name}: {shop.kind === 'merchant' ? '“Potions, bombs and oddities. I buy anything you don’t need — gear, potions, the lot.”' : shop.kind === 'armorer' ? '“Fine gear, fine prices. My best pieces wait until you have grown into them. I’ll take your spare pieces off your hands, too.”' : shop.kind === 'stable' ? '“Nobody rides for free. Every one of these is worth the gold, and yours for good.”' : shop.kind === 'flight' ? '“Where to? My griffons fly faster than a falling star. Hold on tight.”' : '“Every rank makes you stronger for the rest of your journey.”'}</p>
    {shop.kind === 'merchant' && <div className="journal-tabs"><button className={tab === 'buy' ? 'on' : ''} onClick={() => setTab('buy')}>Buy</button><button className={tab === 'sell' ? 'on' : ''} onClick={() => setTab('sell')}>Sell <small>{snapshot.gear.length + snapshot.items.filter(i => i.count > 0).length}</small></button></div>}
    {shop.kind === 'armorer' && <div className="journal-tabs"><button className={tab === 'buy' ? 'on' : ''} onClick={() => setTab('buy')}>Buy</button><button className={tab === 'sell' ? 'on' : ''} onClick={() => setTab('sell')}>Sell <small>{snapshot.gear.length}</small></button></div>}
    <div className="bag-list">
      {shop.kind === 'merchant' && tab === 'buy' && ITEM_ORDER.map(id => {
        const info = ITEMS[id], have = snapshot.items.find(i => i.id === id)?.count ?? 0;
        return <div key={id} className="bag-item" style={{ '--c': info.color } as CSSProperties}>
          <span className="bag-icon"><ItemIcon id={id} size={30} /><b>{have}</b></span>
          <div><strong>{info.name}</strong><em>{info.description}</em></div>
          <button className="btn ghost price" disabled={gold < info.price} onClick={() => { engine.buyItem(id); refresh(); }}><i className="coin" />{info.price}</button>
        </div>;
      })}
      {shop.kind === 'merchant' && tab === 'sell' && <>
        {!snapshot.gear.length && !snapshot.items.some(i => i.count > 0) && <p className="panel-note">Nothing to sell. Worn pieces are never sold.</p>}
        {snapshot.items.filter(i => i.count > 0).map(({ id, count }) => { const info = ITEMS[id], price = Math.max(1, Math.round(info.price * .4)); return <div key={id} className="bag-item" style={{ '--c': info.color } as CSSProperties}>
          <span className="bag-icon"><ItemIcon id={id} size={30} /><b>{count}</b></span>
          <div><strong>{info.name}</strong><em>{info.kind === 'bomb' ? 'Bomb' : info.kind === 'charm' ? 'Charm' : 'Potion'} · you have {count}</em></div>
          <button className="btn ghost price" onClick={() => { engine.sellItem(id); refresh(); }}><i className="coin" />{price}</button>
        </div>; })}
        {junk.length > 1 && <button className="btn ghost" onClick={() => { for (const g of junk) engine.sellGear(g.uid); refresh(); }}>Sell all common &amp; uncommon · <i className="coin" />{junk.reduce((n, g) => n + sellPrice(g), 0)}</button>}
        {[...snapshot.gear].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)).map(g => <div key={g.uid} className="bag-item" style={{ '--c': RARITY[g.rarity].color } as CSSProperties}>
          <span className="bag-icon"><GearIcon slot={g.slot} item={g} size={30} /></span>
          <div><strong style={{ color: RARITY[g.rarity].color }}>{g.name}</strong><em>{RARITY[g.rarity].name} · item level {g.ilvl}</em></div>
          <button className="btn ghost price" onClick={() => { engine.sellGear(g.uid); refresh(); }}><i className="coin" />{sellPrice(g)}</button>
        </div>)}
      </>}
      {shop.kind === 'armorer' && tab === 'sell' && <>
        {!snapshot.gear.length && <p className="panel-note">No spare gear in your bag. Worn pieces are never sold.</p>}
        {junk.length > 1 && <button className="btn ghost" onClick={() => { for (const g of junk) engine.sellGear(g.uid); refresh(); }}>Sell all common &amp; uncommon · <i className="coin" />{junk.reduce((n, g) => n + sellPrice(g), 0)}</button>}
        {[...snapshot.gear].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)).map(g => { const worn = snapshot.equipped[g.slot]; return <div key={g.uid} className="bag-item" style={{ '--c': RARITY[g.rarity].color } as CSSProperties}>
          <span className="bag-icon"><GearIcon slot={g.slot} item={g} size={30} /></span>
          <div><strong style={{ color: RARITY[g.rarity].color }}>{g.name}</strong><em>{RARITY[g.rarity].name} {SLOT_NAMES[g.slot].toLowerCase()} · item level {g.ilvl}</em><ScoreLine item={g} against={worn} /></div>
          <button className="btn ghost price" onClick={() => { engine.sellGear(g.uid); refresh(); }}><i className="coin" />{sellPrice(g)}</button>
        </div>; })}
      </>}
      {shop.kind === 'armorer' && tab === 'buy' && <>
        {engine.armoury().map(({ item: g, price, needLevel, sold }) => {
          const worn = snapshot.equipped[g.slot], up = !worn || gearScore(g) > gearScore(worn);
          const why = sold ? 'Sold' : snapshot.level < needLevel ? `Lv ${needLevel}` : '';
          return <div key={g.uid} className={`bag-item armoury-item ${sold ? 'sold' : ''}`} style={{ '--c': RARITY[g.rarity].color } as CSSProperties}>
            <span className="bag-icon"><GearIcon slot={g.slot} item={g} size={30} />{!sold && (up ? <i className="upgrade-arrow" title="Better than what you wear">▲</i> : <i className="upgrade-arrow down" title="Weaker than what you wear">▼</i>)}</span>
            <div><strong style={{ color: RARITY[g.rarity].color }}>{g.name}</strong><em>{RARITY[g.rarity].name} {SLOT_NAMES[g.slot].toLowerCase()} · item level {g.ilvl}</em><StatLines item={g} against={worn} /><ScoreLine item={g} against={worn} /></div>
            <button className="btn ghost price" disabled={!!why || gold < price} onClick={() => { engine.buyGear(g.uid); refresh(); }}>{why ? (sold ? 'Sold' : <>🔒 {why}</>) : <><i className="coin" />{price}</>}</button>
          </div>;
        })}
        <p className="panel-note">New pieces arrive every time you reach a new level.</p>
      </>}
      {shop.kind === 'stable' && <>
        {STABLE_STOCK.map(id => {
          const m = MOUNTS[id], o = engine.mountOffer(id);
          return <div key={id} className={`bag-item stable-item ${o.owned ? 'sold' : ''}`} style={{ '--c': m.glow || '#ffd35c' } as CSSProperties}>
            <span className="bag-icon"><b className="up-icon">{m.icon}</b></span>
            <div><strong>{m.name}</strong><em>+{Math.round((m.speed - 1) * 100)}% speed when riding{m.level ? ` · from level ${m.level}` : ''}</em></div>
            <button className="btn ghost price" disabled={!!o.why} onClick={() => { if (engine.buyMount(id)) refresh(); }}>{o.owned ? 'Owned' : o.why && o.why.startsWith('Lv') ? <>🔒 {o.why}</> : <><i className="coin" />{o.price}</>}</button>
          </div>;
        })}
        <p className="panel-note">The {MOUNT_ORDER.filter(id => !MOUNTS[id].price).map(id => MOUNTS[id].name).join(' and the ')} can’t be bought: they are won in battle.</p>
      </>}
      {shop.kind === 'flight' && <>
        {engine.flightOffers().map(o => <div key={o.id} className={`bag-item flight-item ${o.why ? 'sold' : ''}`} style={{ '--c': '#9fd8ff' } as CSSProperties}>
          <span className="bag-icon"><b className="up-icon">{o.here ? '📍' : '🦅'}</b></span>
          <div><strong>{o.city}</strong><em>{o.land}{o.why && !o.here ? ` · ${o.why}` : ''}</em></div>
          <button className="btn ghost price" disabled={!!o.why || gold < o.cost} onClick={() => { if (engine.fly(o.id)) onClose(); }}>{o.here ? 'Here' : o.why ? '🔒' : <><i className="coin" />{o.cost}</>}</button>
        </div>)}
        <p className="panel-note">Griffons fly between the flight masters of the four cities, high over the river and the mountains. A city is on the list once you have reached it on foot.</p>
      </>}
      {shop.kind === 'smith' && UPGRADE_ORDER.map(id => {
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

/** One spellbook entry: what the ability does, its numbers, its upgrade stars and the button for the next star. */
function BookSpell({ s, snapshot, touch, onUpgrade }: { s: SpellState; snapshot: GameSnapshot; touch: boolean; onUpgrade: (id: SpellId) => void }) {
  const info = SPELLS[s.id], r = s.rank, res = HEROES[snapshot.hero].resource.toLowerCase();
  const why = !s.unlocked ? `Learn it first (level ${info.level})` : snapshot.level < r.needLevel ? `Needs level ${r.needLevel}` : snapshot.gold < r.cost ? 'Not enough gold' : '';
  return <div className={`book-spell ${s.unlocked ? '' : 'locked'}`} style={{ '--spell': info.color } as CSSProperties}>
    <b>{s.unlocked ? info.icon : '?'}</b>
    <div>
      <strong>{s.unlocked ? info.name : 'Unknown ability'} {(!touch || !s.unlocked) && <kbd>{s.unlocked ? s.key : `Lv ${info.level}`}</kbd>}</strong>
      <em>{s.unlocked ? info.description : `Learned at level ${info.level}.`}</em>
      {s.unlocked && <em className="book-stats">{s.damage > 0 && <span>Damage {s.damage}</span>}{s.cost > 0 && <span>{s.cost} {res}</span>}<span>{Math.round(s.cd * 10) / 10}s cooldown</span></em>}
      <div className="star-line">
        <span className="stars" aria-label={`${r.rank} of ${r.max} stars`}>{Array.from({ length: r.max }, (_, i) => <i key={i} className={i < r.rank ? 'on' : ''}>★</i>)}</span>
        <span className={`star-bonus ${r.rank ? 'on' : ''}`}>{r.bonus}</span>
      </div>
      {r.next ? <button className="btn ghost star-buy" disabled={!r.canBuy} onClick={() => { onUpgrade(s.id); sfx.play('ui'); }} title={why || `Next star: ${r.next}`}>
        <span>★ {r.rank + 1}: {r.next.replace(/^[+−]\d+%/, m => `${m.startsWith('+') ? '+' : '−'}${SPELL_UPGRADES[s.id].per}%`)}</span>
        {why ? <em>{why}</em> : <span className="price"><i className="coin" />{r.cost}</span>}
      </button> : <p className="star-max">✦ Fully upgraded</p>}
    </div>
  </div>;
}

const STATUS_ICON: Record<QuestRow['status'], string> ={ available: '!', active: '○', ready: '?', done: '✓', locked: '·' };
/** Give a quest up (asking once more first), or take an abandoned one up again. */
function QuestActions({ q, engine, onChange }: { q: QuestRow; engine: GameEngine | null; onChange: () => void }) {
  const [sure, setSure] = useState(false);
  if (!engine || (!q.canAbandon && !q.abandoned)) return null;
  if (q.abandoned) return <div className="q-actions"><em>Abandoned</em><button className="btn primary small" onClick={() => { engine.resumeQuest(q.id); sfx.play('ui'); onChange(); }}>Take up again</button></div>;
  return <div className="q-actions">{sure
    ? <><em>Give up this quest? Progress is lost.</em><button className="btn ghost small" onClick={() => setSure(false)}>Keep it</button><button className="btn danger small" onClick={() => { engine.abandonQuest(q.id); setSure(false); onChange(); }}>Abandon</button></>
    : <button className="btn ghost small" onClick={() => { setSure(true); sfx.play('ui'); }}>Abandon quest</button>}</div>;
}
function Journal({ snapshot, engine, achievements, touch, initial, onClose, onTrack, onUpgrade }: { snapshot: GameSnapshot | null; engine: GameEngine | null; achievements: AchRow[]; touch: boolean; initial: JournalTab; onClose: () => void; onTrack: (id: string) => void; onUpgrade: (id: SpellId) => void }) {
  const w = engine?.region(snapshot?.region ?? 'meadow') ?? WORLDS[snapshot?.region ?? 'meadow'];
  const [tab, setTab] = useState<JournalTab>(initial);
  const [, bump] = useState(0), changed = () => bump(n => n + 1);
  const cur = snapshot?.mainQuests.find(q => q.canAbandon || q.abandoned);
  return <aside className="journal">
    <div className="journal-head"><strong><JournalIcon size={22} /> Journal</strong><button className="icon-button" onClick={onClose} aria-label="Close journal">✕</button></div>
    <div className="journal-tabs">{(['quests', 'spells', 'achievements'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'quests' ? 'Quests' : t === 'spells' ? 'Spellbook' : 'Achievements'}</button>)}</div>
    {snapshot && tab === 'quests' && <>
      <section className="q-main"><small>Chapter {ROMAN[Math.min(LEVEL_ORDER.length, snapshot.chapter)]} · main quest {snapshot.main.index} of {snapshot.main.total}</small><p className="main-q">{snapshot.main.title}</p><p className="sub-q">{snapshot.main.step}{snapshot.main.count > 0 && <em> {snapshot.main.progress}/{snapshot.main.count}</em>}</p>
        {cur && <QuestActions key={cur.id} q={cur} engine={engine} onChange={changed} />}
        <ol className="story">{snapshot.mainQuests.map(q => <li key={q.id} className={`${q.status === 'done' ? 'done' : 'now'} ${q.personal ? 'personal' : ''}`}><span>{q.status === 'done' ? '✓' : q.personal ? '✦' : '◆'}</span>{q.title}{q.personal && <i className="own">{HEROES[snapshot.hero].name}’s story</i>}</li>)}</ol>
      </section>
      <section className="q-sides"><small>Side quests · {touch ? 'tap' : 'click'} one to follow it</small>
        {snapshot.quests.length === 0 && <p className="sub-q">Villagers with a blue ! have work for you.</p>}
        {snapshot.quests.map(q => <div key={q.id} className="side-wrap"><button className={`side status-${q.status} ${q.tracked ? 'tracked' : ''}`} onClick={() => q.status !== 'done' && q.status !== 'available' && onTrack(q.id)}>
          <span>{STATUS_ICON[q.status]}</span><div><b>{q.title}<i className="ch">{ROMAN[q.chapter]}</i></b><em>{q.detail}</em>{q.status !== 'done' && <em className="reward">Reward: {q.reward}</em>}</div>
        </button><QuestActions q={q} engine={engine} onChange={changed} /></div>)}
      </section>
    </>}
    {snapshot && tab === 'spells' && <>
      <section><small>{HEROES[snapshot.hero].name}’s abilities · upgrade each one with up to five stars</small><div className="spellbook">{snapshot.spells.map(s => <BookSpell key={s.id} s={s} snapshot={snapshot} touch={touch} onUpgrade={onUpgrade} />)}</div></section>
      <section className="book-upgrades"><small>Smith upgrades · buy ranks from a city smith</small>{upgradeRows(snapshot)}</section>
    </>}
    {snapshot && tab === 'achievements' && <>{engine && <Stable engine={engine} current={snapshot.mount?.id ?? null} />}<Achievements rows={achievements} tip={w.script.tip} hero={snapshot.hero} /></>}
  </aside>;
}

/** The stable: every mount, owned ones to choose from and the rest with where to get them. */
function Stable({ engine, current }: { engine: GameEngine; current: string | null }) {
  const [, set] = useState(0);
  const got = MOUNT_ORDER.filter(id => engine.mountUnlocked(id)).length;
  return <section className="stable"><small>Mounts · {got} of {MOUNT_ORDER.length} · ride with {keyLabel(getKeys().ride)} or the saddle button</small>
    <div className="stable-grid">{MOUNT_ORDER.map(id => { const m = MOUNTS[id], ok = engine.mountUnlocked(id); return <button key={id} className={`stable-card ${ok ? '' : 'locked'} ${current === id ? 'on' : ''}`} disabled={!ok} onClick={() => { engine.setMount(id); set(n => n + 1); }} title={ok ? `Ride the ${m.name}` : m.how}>
      <b>{ok ? m.icon : '🔒'}</b><span><strong>{m.name}</strong><em>{ok ? `+${Math.round((m.speed - 1) * 100)}% speed${current === id ? ' · riding this one' : ''}` : m.how}</em></span></button>; })}</div>
    <small className="stable-sub">Trails · a sparkle that follows you</small>
    <div className="stable-grid">
      <button className={`stable-card ${!engine.trail ? 'on' : ''}`} onClick={() => { engine.setTrail(null); set(n => n + 1); }}><b>∅</b><span><strong>No trail</strong><em>Just your footsteps</em></span></button>
      {TRAIL_ORDER.map(id => { const tr = TRAILS[id], ok = engine.trailUnlocked(id); return <button key={id} className={`stable-card ${ok ? '' : 'locked'} ${engine.trail === id ? 'on' : ''}`} disabled={!ok} onClick={() => { engine.setTrail(id); set(n => n + 1); }} title={ok ? tr.name : tr.how}>
        <b>{ok ? tr.icon : '🔒'}</b><span><strong>{tr.name}</strong><em>{ok ? (engine.trail === id ? 'Following you' : 'Tap to wear') : tr.how}</em></span></button>; })}
    </div>
  </section>;
}

/** WoW-style achievements: points earned, a category filter, and every achievement with its progress. */
function Achievements({ rows, tip, hero }: { rows: AchRow[]; tip: string; hero: HeroId }) {
  const [cat, setCat] = useState<string>('All');
  const earned = rows.filter(r => r.got), points = earned.reduce((n, r) => n + r.points, 0);
  const shown = rows.filter(r => cat === 'All' || r.category === cat).sort((a, b) => Number(!!b.got) - Number(!!a.got) || (b.progress / b.goal) - (a.progress / a.goal));
  return <>
    <section className="ach-summary">
      <span className="ach-shield big"><b>{points}</b></span>
      <div><strong>{points} / {TOTAL_POINTS} points</strong><em>{earned.length} of {rows.length} achievements earned</em><i className="ach-bar"><i style={{ width: `${(points / TOTAL_POINTS) * 100}%` }} /></i></div>
    </section>
    <div className="ach-cats">{['All', ...ACH_CATEGORIES].map(c => { const list = rows.filter(r => c === 'All' || r.category === c); return <button key={c} className={cat === c ? 'on' : ''} onClick={() => { setCat(c); sfx.play('page'); }}>{c}<small>{list.filter(r => r.got).length}/{list.length}</small></button>; })}</div>
    <section className="ach-list">{shown.map(r => <div key={r.id} className={`ach-row ${r.got ? 'got' : ''}`}>
      <span className="ach-shield"><b>{r.icon}</b></span>
      <div><strong>{r.name}</strong><em>{r.description}</em>
        {!r.got && r.goal > 1 && <span className="ach-progress"><i className="ach-bar"><i style={{ width: `${(r.progress / r.goal) * 100}%` }} /></i><small>{r.progress} / {r.goal}</small></span>}
        {r.got > 0 && <small className="ach-date">Earned {new Date(r.got).toLocaleDateString()}</small>}
      </div>
      <span className="ach-points"><b>{r.points}</b></span>
    </div>)}</section>
    <section className="fox-tip"><small>{hero === 'mira' ? '🦊 Tuft’s field note' : '⚔ Field note'}</small><p>“{tip}”</p></section>
  </>;
}

/**
 * The map of the whole valley: every land side by side, with the fog lifting wherever the hero has been. It opens
 * zoomed on the land the hero is in; drag to pan, pinch or scroll to zoom, or jump with the buttons.
 */
function MapOverlay({ engine, touch, onClose }: { engine: GameEngine; touch: boolean; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = engine.world.width, H = engine.world.height;
  // cx, cy: world point at the centre of the view; z: zoom, where 1 shows the whole valley.
  const view = useRef({ cx: engine.hero.x, cy: H / 2, z: 0 });
  const size = useRef({ w: 1, h: 1 });
  const [here, setHere] = useState(() => engine.heroRegion.id);
  // The depths are underground, not part of the valley: they get a map of their own, opened from the hole on the valley's
  // map (once the ground has opened) or straight away while the hero is down there.
  const [under, setUnder] = useState(() => engine.inDepths);
  const underRef = useRef(under); underRef.current = under;
  const hole = depthsHole(engine);
  const base = () => Math.min((size.current.w - 16) / W, (size.current.h - 16) / H);
  const regionZoom = () => { const r = engine.world.regions[0]; return Math.min((size.current.w - 16) / (r.x1 - r.x0), (size.current.h - 16) / H) / base(); };
  const clampView = () => {
    const v = view.current, S = base() * v.z, { w, h } = size.current;
    v.z = clamp(v.z, 1, regionZoom() * 3);
    const hw = w / 2 / (base() * v.z), hh = h / 2 / (base() * v.z);
    v.cx = hw * 2 >= W ? W / 2 : clamp(v.cx, hw, W - hw); v.cy = hh * 2 >= H ? H / 2 : clamp(v.cy, hh, H - hh);
    return S;
  };
  const jump = (id: RegionId | 'all') => {
    const v = view.current;
    if (id === 'all') { v.z = 1; v.cx = W / 2; v.cy = H / 2; }
    else { const r = engine.world.regions.find(x => x.id === id)!; v.z = regionZoom(); v.cx = (r.x0 + r.x1) / 2; v.cy = H / 2; }
    setHere(id === 'all' ? engine.heroRegion.id : id); sfx.play('page');
  };
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let raf = 0;
    const frame = (now: number) => {
      const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
      size.current = { w: r.width, h: r.height };
      if (!view.current.z) view.current.z = regionZoom();
      const S = base() * view.current.z; clampView();
      ctx.setTransform(d, 0, 0, d, 0, 0);
      if (underRef.current) drawDepthsMap(ctx, r.width, r.height, engine, now / 1000);
      else drawWorldMap(ctx, r.width, r.height, engine, now / 1000, { cx: view.current.cx, cy: view.current.cy, S });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // Drag to pan, two fingers or the wheel to zoom.
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const zoomAt = (f: number, sx: number, sy: number) => {
      const v = view.current, S0 = base() * v.z, wx = v.cx + (sx - size.current.w / 2) / S0, wy = v.cy + (sy - size.current.h / 2) / S0;
      v.z = clamp(v.z * f, 1, regionZoom() * 3); const S1 = base() * v.z;
      v.cx = wx - (sx - size.current.w / 2) / S1; v.cy = wy - (sy - size.current.h / 2) / S1;
    };
    // A tap (not a drag) on the hole opens the map of the depths.
    let tap: { x: number; y: number } | null = null;
    const click = (e: PointerEvent) => {
      if (!tap || underRef.current || Math.hypot(e.offsetX - tap.x, e.offsetY - tap.y) > 8) return;
      const o = depthsHole(engine); if (!o) return;
      const v = view.current, S = base() * v.z, x = size.current.w / 2 + (o.x - v.cx) * S, y = size.current.h / 2 + (o.y - v.cy) * S;
      if (Math.hypot(e.offsetX - x, e.offsetY - y) < Math.max(26, 160 * S)) { setUnder(true); sfx.play('page'); }
    };
    const down = (e: PointerEvent) => { tap = { x: e.offsetX, y: e.offsetY }; c.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId); if (!p) return;
      if (pts.size === 1) { const S = base() * view.current.z; view.current.cx -= (e.offsetX - p.x) / S; view.current.cy -= (e.offsetY - p.y) / S; }
      pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pts.size === 2) { const [a, b] = [...pts.values()], d2 = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0) zoomAt(d2 / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch = d2; }
    };
    const up = (e: PointerEvent) => { click(e); tap = null; pts.delete(e.pointerId); pinch = 0; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(Math.pow(1.0015, -e.deltaY), e.offsetX, e.offsetY); };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); c.addEventListener('wheel', wheel, { passive: false });
    return () => { cancelAnimationFrame(raf); c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); c.removeEventListener('wheel', wheel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);
  const reg = engine.world.regions.find(r => r.id === here) || engine.heroRegion;
  return <div className="map-overlay" onClick={onClose}>
    <div className="map-head" onClick={e => e.stopPropagation()}>
      <div className="map-tabs">
        <button onClick={() => { setUnder(false); jump('all'); }}>Whole valley<small>All {LEVEL_ORDER.length} lands</small></button>
        {LEVEL_ORDER.map(id => <button key={id} className={!under && id === here ? 'on' : ''} onClick={() => { setUnder(false); jump(id); }}>{WORLDS[id].title}<small>{levels(id)}</small></button>)}
        {hole && <button className={under ? 'on depths-tab' : 'depths-tab'} onClick={() => { setUnder(true); sfx.play('page'); }}>The Depths<small>Underground</small></button>}
      </div>
      <button className="icon-button" onClick={onClose} aria-label="Close map">✕</button>
    </div>
    <canvas ref={ref} onClick={e => e.stopPropagation()} aria-label="World map. Drag to move, pinch or scroll to zoom." />
    <div className="map-legend"><span><i style={{ background: '#fff' }} />You</span><span><i style={{ background: MAIN_COLOR }} />Main quest</span><span><i style={{ background: SIDE_COLOR }} />Side quest</span><span><i style={{ background: reg.palette.accent }} />{reg.script.keyLabel}</span><span><i style={{ background: '#ffd35c' }} />Shop</span><span><i style={{ background: '#ff6b5b' }} />Guardian</span><span><i style={{ background: '#e8a0ff' }} />Heroic foe</span><span>{touch ? 'Drag · pinch to zoom' : 'Drag · scroll to zoom'}</span>{!touch && <span><kbd>M</kbd> close</span>}</div>
  </div>;
}

function Confetti() {
  const pieces = Array.from({ length: 42 }, (_, i) => i);
  return <div className="confetti" aria-hidden="true">{pieces.map(i => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * .25}s`, animationDuration: `${3.2 + (i % 5) * .6}s`, background: ['#ffd35c', '#ff9aa8', '#9fd8ff', '#b9f29d', '#c9b6ff'][i % 5] }} />)}</div>;
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export default App;

/** The smith upgrades as they stand, for the spellbook. */
function upgradeRows(s: GameSnapshot) {
  const ranks = s.upgrades;
  return <dl className="stat-list">{UPGRADE_ORDER.map(id => { const r = ranks[id] || 0, u = UPGRADES[id]; return <div key={id}><dt>{u.icon} {u.name}</dt><dd>{r ? `Rank ${r}/${MAX_RANK} · ${id === 'staff' ? `+${r * 8}% power` : id === 'mantle' ? `−${r * 6}% damage` : `+${r * 30} health`}` : 'Not bought'}</dd></div>; })}</dl>;
}
