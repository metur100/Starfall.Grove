import type { MountId } from './types';

// Mounts: each is earned by an achievement and kept by that hero forever. Press R (or the saddle button) to ride
// when no creature is fighting you; attacking, casting or being hit puts you back on your feet.

/** `speed` is the riding speed as a multiple of walking speed. `ach` is the achievement that earns it. */
export type MountInfo = { id: MountId; name: string; icon: string; speed: number; ach: string; how: string; body: string; mane: string; glow?: string };
export const MOUNTS: Record<MountId, MountInfo> = {
  pony: { id: 'pony', name: 'Sunpetal Pony', icon: '🐴', speed: 1.5, ach: 'p10', how: 'Discover 10 places (Wanderer).', body: '#a8744a', mane: '#fff1d8' },
  boar: { id: 'boar', name: 'Tusked Bristleboar', icon: '🐗', speed: 1.55, ach: 'h1', how: 'Defeat a heroic creature (Heroic Deed).', body: '#7a5236', mane: '#3a2a20' },
  stag: { id: 'stag', name: 'Whisperroot Stag', icon: '🦌', speed: 1.65, ach: 'ch-woods', how: 'Finish Chapter II (The Bell Rings Again).', body: '#b88a5a', mane: '#f4e6c4', glow: '#b9f29d' },
  frostwolf: { id: 'frostwolf', name: 'Frostmane Wolf', icon: '🐺', speed: 1.75, ach: 'ch-summit', how: 'Finish Chapter III (Heart of the Fallen Light).', body: '#dfe8f4', mane: '#9fb8d8', glow: '#9fe4ff' },
  drake: { id: 'drake', name: 'Cinder Drake', icon: '🦎', speed: 1.85, ach: 'ch-ember', how: 'Finish Chapter IV (The Dawn Forge).', body: '#c8502e', mane: '#ffb347', glow: '#ff9a3d' },
  unicorn: { id: 'unicorn', name: 'Starlit Unicorn', icon: '🦄', speed: 2, ach: 'eclipse', how: 'Defeat Umbra (The Eclipse Ends).', body: '#f4f0ff', mane: '#c9b6ff', glow: '#fff1b8' },
};
export const MOUNT_ORDER: MountId[] = ['pony', 'boar', 'stag', 'frostwolf', 'drake', 'unicorn'];
/** Mounts earned by an achievement id, for the "new mount" notice. */
export const mountFor = (achId: string) => MOUNT_ORDER.find(id => MOUNTS[id].ach === achId) || null;
