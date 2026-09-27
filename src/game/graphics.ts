// Graphics quality setting. "auto" starts from a guess about the device and adapts to the measured frame rate.
export type Graphics = 'auto' | 'high' | 'balanced' | 'low';
export const GRAPHICS: Graphics[] = ['auto', 'high', 'balanced', 'low'];
const KEY = 'starfall-grove-graphics';

export function loadGraphics(): Graphics {
  try { const v = localStorage.getItem(KEY) as Graphics | null; return v && GRAPHICS.includes(v) ? v : 'auto'; } catch { return 'auto'; }
}
export function saveGraphics(v: Graphics) { try { localStorage.setItem(KEY, v); } catch { /* ignore */ } }

/** Tier to start "auto" on: 0 low, 1 balanced, 2 high. Tablets and low-core devices start lower. */
export function startTier() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4, memory = nav.deviceMemory ?? 8;
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (cores <= 4 || memory <= 3) return 0;
  return touch ? 1 : 2;
}
export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: none) and (pointer: coarse)').matches;
