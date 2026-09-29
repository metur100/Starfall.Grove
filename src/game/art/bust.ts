// Portraits cut from the same paper figures as the world: head and shoulders of a hero or villager, facing us,
// rendered once into an image and reused by the HUD, the roster and dialogue.
import { Cutter, STICKER } from './cutout';
import { drawFigure, type Figure } from './rig';
import { heroFigure } from './heroes';
import { villagerFigure } from './people';
import type { Look } from '../gear';
import type { HeroId, NpcLook } from '../types';

const cache = new Map<string, string>();
let cutter: Cutter | null = null;

function render(key: string, fig: Figure, hooks = {}): string {
  const hit = cache.get(key); if (hit) return hit;
  if (typeof document === 'undefined') return '';
  cutter ??= new Cutter();
  const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  // Head and shoulders fill the frame: the figure is scaled so the head is about half the width.
  const k = 2.9;
  g.translate(S / 2, S * .5 + 27 * k); g.scale(k, k);
  cutter.stamp(g, 0, 0, [-34, -80, 68, 108], k, STICKER, gg => drawFigure(gg, fig, { facing: 'front', dir: 1, walk: 0, moving: false, t: 1.7, arm: 'idle', blink: false }, hooks));
  const url = c.toDataURL('image/png');
  cache.set(key, url); return url;
}
export function heroBust(hero: HeroId, look: Look = {}) {
  const key = `hero|${hero}|${Object.values(look).map(v => v?.color).join(',')}`;
  return render(key, heroFigure(hero, look));
}
export function villagerBust(id: string, look: NpcLook) { return render(`npc|${id}|${look.robe}|${look.hat}|${look.hair}`, villagerFigure(id, look)); }
