// Remappable keyboard controls. Each action has one key; the arrow keys always move as well, 1–0 stay on the potion
// and bomb slots, and Esc always pauses. Bindings are kept on the device with the other settings.

export type Action = 'up' | 'down' | 'left' | 'right' | 'spell1' | 'spell2' | 'spell3' | 'spell4' | 'spell5'
  | 'interact' | 'ride' | 'bag' | 'character' | 'quests' | 'spellbook' | 'achievements' | 'map' | 'mute';
export type ActionInfo = { id: Action; name: string; group: 'Move' | 'Fight' | 'Menus' };
export const ACTIONS: ActionInfo[] = [
  { id: 'up', name: 'Move up', group: 'Move' }, { id: 'down', name: 'Move down', group: 'Move' }, { id: 'left', name: 'Move left', group: 'Move' }, { id: 'right', name: 'Move right', group: 'Move' },
  { id: 'interact', name: 'Talk / use', group: 'Move' }, { id: 'ride', name: 'Ride mount', group: 'Move' },
  { id: 'spell1', name: 'Attack', group: 'Fight' }, { id: 'spell2', name: 'Ability (level 1)', group: 'Fight' }, { id: 'spell3', name: 'Ability (level 3)', group: 'Fight' }, { id: 'spell4', name: 'Ability (level 6)', group: 'Fight' }, { id: 'spell5', name: 'Ability (level 10)', group: 'Fight' },
  { id: 'bag', name: 'Bag', group: 'Menus' }, { id: 'character', name: 'Character', group: 'Menus' }, { id: 'quests', name: 'Quest log', group: 'Menus' }, { id: 'spellbook', name: 'Spellbook', group: 'Menus' },
  { id: 'achievements', name: 'Achievements', group: 'Menus' }, { id: 'map', name: 'World map', group: 'Menus' }, { id: 'mute', name: 'Sound on / off', group: 'Menus' },
];
export const DEFAULT_KEYS: Record<Action, string> = {
  up: 'w', down: 's', left: 'a', right: 'd', spell1: 'l', spell2: 'e', spell3: 'k', spell4: 'j', spell5: 'h',
  interact: ' ', ride: 'r', bag: 'i', character: 'p', quests: 'o', spellbook: 'u', achievements: 'y', map: 'm', mute: 'n',
};
/** Keys that can't be bound: they already do something fixed. */
export const RESERVED = new Set(['escape', 'tab', 'enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'meta', 'alt', 'control', 'shift', 'capslock', 'contextmenu']);
const KEY = 'starfall-grove-keys-v1';
const SPELL_ACTIONS: Action[] = ['spell1', 'spell2', 'spell3', 'spell4', 'spell5'];

function load(): Record<Action, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Record<Action, string>> | null;
    const out = { ...DEFAULT_KEYS };
    if (raw) for (const a of ACTIONS) { const k = raw[a.id]; if (typeof k === 'string' && k.length && !RESERVED.has(k)) out[a.id] = k; }
    return out;
  } catch { return { ...DEFAULT_KEYS }; }
}
let current = load();
const listeners = new Set<() => void>();
const changed = () => { try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ } for (const l of listeners) l(); };

export const getKeys = () => current;
export const keyOf = (a: Action) => current[a];
/** The spell button in slot i (0–4) of the hero's bar. */
export const spellKey = (i: number) => current[SPELL_ACTIONS[i]] || '';
export const spellSlot = (key: string) => SPELL_ACTIONS.findIndex(a => current[a] === key);
export function actionOf(key: string): Action | null { for (const a of ACTIONS) if (current[a.id] === key) return a.id; return null; }
/** Binds a key; if another action had it, that action takes this one's old key, so nothing is ever left unbound. */
export function bindKey(a: Action, key: string) {
  if (RESERVED.has(key)) return false;
  const other = actionOf(key);
  if (other && other !== a) current = { ...current, [other]: current[a] };
  current = { ...current, [a]: key };
  changed(); return true;
}
export function resetKeys() { current = { ...DEFAULT_KEYS }; changed(); }
export function onKeysChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
/** How a key is written on screen: "Space", "L", "↑"… */
export function keyLabel(k: string) {
  if (k === ' ') return 'Space';
  const named: Record<string, string> = { arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', backspace: 'Back', delete: 'Del', pageup: 'PgUp', pagedown: 'PgDn', home: 'Home', end: 'End', insert: 'Ins' };
  return named[k] || (k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));
}
