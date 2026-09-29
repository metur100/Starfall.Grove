// Graphics settings. "auto" quality starts from a guess about the device and adapts to the measured frame rate.
export type Quality = 'auto' | 'high' | 'balanced' | 'low' | 'lowest';
export type DecorLevel = 'auto' | 'full' | 'less' | 'off';
export type GraphicsSettings = {
  quality: Quality;
  /** Grass and flowers (swaying on High quality, still below it). "auto" follows the quality level. */
  decor: DecorLevel;
  /** Falling petals, leaves and snow, fireflies, light rays, cloud shadows. */
  weather: boolean;
  shake: boolean;
  /** 30 caps the frame rate: steadier and cooler on weak devices. */
  fps: 60 | 30;
  showFps: boolean;
};
export const QUALITIES: Quality[] = ['auto', 'high', 'balanced', 'low', 'lowest'];
export const DECOR_LEVELS: DecorLevel[] = ['auto', 'full', 'less', 'off'];
/** Quality tiers from lowest (0) to high (3). */
export const TIER_OF: Record<Exclude<Quality, 'auto'>, number> = { lowest: 0, low: 1, balanced: 2, high: 3 };
export const TIER_NAMES = ['Lowest', 'Low', 'Balanced', 'High'];

const KEY = 'starfall-grove-graphics-v2';
const DEFAULTS: GraphicsSettings = { quality: 'auto', decor: 'auto', weather: true, shake: true, fps: 60, showFps: false };

export function loadGraphics(): GraphicsSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<GraphicsSettings> | null;
    if (!raw) return { ...DEFAULTS };
    return {
      quality: QUALITIES.includes(raw.quality as Quality) ? raw.quality as Quality : DEFAULTS.quality,
      decor: DECOR_LEVELS.includes(raw.decor as DecorLevel) ? raw.decor as DecorLevel : DEFAULTS.decor,
      weather: raw.weather ?? DEFAULTS.weather, shake: raw.shake ?? DEFAULTS.shake,
      fps: raw.fps === 30 ? 30 : 60, showFps: !!raw.showFps,
    };
  } catch { return { ...DEFAULTS }; }
}
export function saveGraphics(v: GraphicsSettings) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ } }

const AUTO_KEY = 'starfall-grove-auto-tier';
/** The tier "auto" settled on last time on this device, and the highest it found the device can hold. */
export function loadAutoTier(): { tier: number; ceiling: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(AUTO_KEY) || 'null') as { tier?: unknown; ceiling?: unknown } | null;
    const ok = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < TIER_NAMES.length;
    return v && ok(v.tier) && ok(v.ceiling) ? { tier: Math.min(v.tier, v.ceiling), ceiling: v.ceiling } : null;
  } catch { return null; }
}
export function saveAutoTier(tier: number, ceiling: number) { try { localStorage.setItem(AUTO_KEY, JSON.stringify({ tier, ceiling })); } catch { /* ignore */ } }

/** Tier "auto" starts on the first time. Tablets and low-core devices start lower. */
export function startTier() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4, memory = nav.deviceMemory ?? 8;
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (cores <= 4 || memory <= 3) return 1;
  return touch ? 2 : 3;
}
export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: none) and (pointer: coarse)').matches;
