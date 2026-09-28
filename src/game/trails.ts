import type { TrailId } from './types';

// Cosmetic trails: a sparkle that follows the hero while they walk. Each is earned by an achievement, kept by that hero,
// and chosen in the stable (Achievements tab). They change nothing but the look.

export type TrailInfo = { id: TrailId; name: string; icon: string; ach: string; how: string; colors: string[] };
export const TRAILS: Record<TrailId, TrailInfo> = {
  sparks: { id: 'sparks', name: 'Golden Sparks', icon: '✨', ach: 'archer', how: 'Win a gold medal at an archery range (Eagle Eye).', colors: ['#ffd35c', '#fff1b8', '#ffb347'] },
  clovers: { id: 'clovers', name: 'Lucky Clovers', icon: '🍀', ach: 'dice5', how: 'Win 5 games of Starfall Dice (Lucky Streak).', colors: ['#6fdc6a', '#b9f29d', '#3f9a4a'] },
  stardust: { id: 'stardust', name: 'Stardust', icon: '🌟', ach: 's1', how: 'Find a secret (Something Hidden).', colors: ['#c9b6ff', '#ffffff', '#9fd8ff'] },
};
export const TRAIL_ORDER: TrailId[] = ['stardust', 'clovers', 'sparks'];
export const trailFor = (achId: string) => TRAIL_ORDER.find(id => TRAILS[id].ach === achId) || null;
