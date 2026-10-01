import type { MountId } from './types';

// Mounts are not free. Four are sold by the stable master in every city (each one waits for a level), and two can only
// be won in battle: the Tusked Bristleboar now and then from a heroic creature, the Starlit Unicorn from Umbra. A mount
// is kept by that hero forever. Press R (or the saddle button) to ride when no creature is fighting you; attacking,
// casting or being hit puts you back on your feet.

/**
 * `speed` is the riding speed as a multiple of walking speed. `price` and `level` are what a stable master asks;
 * mounts without a price are only dropped (`drop` says by whom, `chance` how often).
 */
export type MountInfo = { id: MountId; name: string; icon: string; speed: number; how: string; body: string; mane: string; glow?: string; price?: number; level?: number; drop?: string; chance?: number };
export const MOUNTS: Record<MountId, MountInfo> = {
  pony: { id: 'pony', name: 'Sunpetal Pony', icon: '🐴', speed: 1.5, price: 350, level: 4, how: 'Sold by every stable master (level 4).', body: '#a8744a', mane: '#fff1d8' },
  boar: { id: 'boar', name: 'Tusked Bristleboar', icon: '🐗', speed: 1.55, drop: 'heroic', chance: .2, how: 'Won in battle: heroic creatures (lair leaders) sometimes drop its saddle.', body: '#7a5236', mane: '#3a2a20' },
  stag: { id: 'stag', name: 'Whisperroot Stag', icon: '🦌', speed: 1.65, price: 1400, level: 9, how: 'Sold by every stable master (level 9).', body: '#b88a5a', mane: '#f4e6c4', glow: '#b9f29d' },
  frostwolf: { id: 'frostwolf', name: 'Rimecoat Wolf', icon: '🐺', speed: 1.75, price: 3200, level: 14, how: 'Sold by every stable master (level 14).', body: '#dfe8f4', mane: '#9fb8d8', glow: '#9fe4ff' },
  drake: { id: 'drake', name: 'Cinder Drake', icon: '🦎', speed: 1.85, price: 6000, level: 20, how: 'Sold by every stable master (level 20).', body: '#c8502e', mane: '#ffb347', glow: '#ff9a3d' },
  unicorn: { id: 'unicorn', name: 'Starlit Unicorn', icon: '🦄', speed: 2, drop: 'eclipse', chance: 1, how: 'Won in battle: Umbra, the final foe, drops it.', body: '#f4f0ff', mane: '#c9b6ff', glow: '#fff1b8' },
};
export const MOUNT_ORDER: MountId[] = ['pony', 'boar', 'stag', 'frostwolf', 'drake', 'unicorn'];
/** The mounts a stable master sells, cheapest first. */
export const STABLE_STOCK: MountId[] = MOUNT_ORDER.filter(id => MOUNTS[id].price);
/** Before mounts were sold, these achievements gave one away. Saves from then keep the mounts they had already earned. */
export const OLD_MOUNT_ACH: Record<MountId, string> = { pony: 'p10', boar: 'h1', stag: 'ch-woods', frostwolf: 'ch-summit', drake: 'ch-ember', unicorn: 'eclipse' };
