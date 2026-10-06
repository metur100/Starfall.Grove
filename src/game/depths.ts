// The Depths beneath the Dawn Forge: when Pyrrhus falls the ground gives way, and the hero drops into a cave of
// chambers and tunnels where Umbra waits on its throne. It lies in a space of its own beside the valley (east of it on
// the world's coordinates, out of sight and off the map), counts as part of the Ember Wastes, and is laid out by hand:
// seven chambers joined by halls, with creatures found nowhere else. After Umbra falls the hole stays open beside the
// Forge, and the depths can be walked again (their creatures, and an echo of Umbra, come back each time).
import type { Decor, EnemyKind, EnemySeed, Obstacle, Point, Poi, WorldDefinition, WorldObject } from './types';

/** A chamber (an ellipse) and a hall between two chambers (a capsule). */
export type DepthRoom = { id: string; name: string; x: number; y: number; rx: number; ry: number };
export type DepthHall = { a: Point; b: Point; hw: number };
export type Depths = { x0: number; y0: number; x1: number; y1: number; rooms: DepthRoom[]; halls: DepthHall[]; landing: Point; throne: Point; hole: Point };

/** Room between the valley and the depths, so nothing of one is ever drawn next to the other. */
const GAP = 1536, W = 5200, H = 4100;
const ROOMS: Array<Omit<DepthRoom, 'x' | 'y'> & { lx: number; ly: number }> = [
  { id: 'fall', name: 'The Fall', lx: 700, ly: 2000, rx: 460, ry: 380 },
  { id: 'bones', name: 'Hall of Bones', lx: 1900, ly: 1300, rx: 560, ry: 420 },
  { id: 'hoard', name: 'The Sunken Hoard', lx: 1650, ly: 3150, rx: 400, ry: 310 },
  { id: 'crystal', name: 'The Crystal Gallery', lx: 3050, ly: 2250, rx: 580, ry: 450 },
  { id: 'vaults', name: 'The Ember Vaults', lx: 4250, ly: 1200, rx: 520, ry: 400 },
  { id: 'echoes', name: 'Hall of Echoes', lx: 4350, ly: 2520, rx: 430, ry: 330 },
  { id: 'throne', name: 'Umbra’s Throne', lx: 4150, ly: 3500, rx: 660, ry: 470 },
];
const HALLS: Array<[string, string]> = [['fall', 'bones'], ['bones', 'hoard'], ['bones', 'crystal'], ['crystal', 'vaults'], ['vaults', 'echoes'], ['echoes', 'throne']];
/** The creatures of each chamber (and of the halls between), as [kind, count, elites]. */
const PACKS: Record<string, Array<[EnemyKind, number, number]>> = {
  fall: [['duskwing', 3, 0]],
  'fall-bones': [['hollowArcher', 2, 0]],
  bones: [['umbralKnight', 3, 1], ['hollowArcher', 2, 0], ['duskwing', 2, 0]],
  hoard: [['shardback', 1, 1], ['duskwing', 3, 0]],
  'bones-crystal': [['umbralKnight', 2, 0]],
  crystal: [['shardback', 2, 0], ['acolyte', 2, 0], ['duskwing', 3, 0]],
  'crystal-vaults': [['hollowArcher', 2, 0], ['duskwing', 2, 0]],
  vaults: [['umbralKnight', 3, 0], ['acolyte', 2, 0], ['shardback', 1, 1]],
  echoes: [['umbralKnight', 2, 2], ['acolyte', 2, 2], ['hollowArcher', 2, 0]],
};
const LORE: Record<string, string[]> = {
  fall: ['Words scratched into the cave wall, old and deep: “The Forge was built over a door. We lit the fire so it would stay shut.”'],
  crystal: ['A crystal hums under your hand, and shows a memory: four lights in a ring, and in the middle of the ring, something sleeping.', '“Beacon, Bell, Star and Forge. While they burn, the Eclipse dreams. Wake it, and it will want a throne.”'],
  echoes: ['Every voice you have ever heard seems to whisper here at once.', '“There is no shadow you were born with,” they say. “Only the one you choose to carry.”'],
};

const segDist = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
  return { d: Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t), x: a.x + dx * t, y: a.y + dy * t };
};
/** Inside the walkable cave (a chamber or a hall), `pad` from its walls. */
export function inDepths(dp: Depths, x: number, y: number, pad = 0) {
  for (const r of dp.rooms) { const ex = (x - r.x) / Math.max(1, r.rx - pad), ey = (y - r.y) / Math.max(1, r.ry - pad); if (ex * ex + ey * ey <= 1) return true; }
  for (const h of dp.halls) if (segDist({ x, y }, h.a, h.b).d <= h.hw - pad) return true;
  return false;
}
/** Within the depths' own space (walkable or not). */
export const inDepthsArea = (dp: Depths | undefined, p: Point) => !!dp && p.x >= dp.x0 - 200 && p.x <= dp.x1 + 200 && p.y >= dp.y0 - 200 && p.y <= dp.y1 + 200;
/** Keeps a point inside the cave: out of the rock and back to the nearest floor, `pad` from the wall. */
export function keepInDepths(dp: Depths, p: Point, pad: number) {
  if (inDepths(dp, p.x, p.y, pad)) return;
  let best: Point | null = null, bd = Infinity;
  for (const r of dp.rooms) {
    const rx = Math.max(1, r.rx - pad), ry = Math.max(1, r.ry - pad), ex = (p.x - r.x) / rx, ey = (p.y - r.y) / ry, k = 1 / Math.max(1e-6, Math.hypot(ex, ey));
    const q = { x: r.x + (p.x - r.x) * k * .999, y: r.y + (p.y - r.y) * k * .999 }, d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) { bd = d; best = q; }
  }
  for (const h of dp.halls) {
    const s = segDist(p, h.a, h.b), r = Math.max(1, h.hw - pad), k = s.d > 0 ? r / s.d * .999 : 0;
    const q = { x: s.x + (p.x - s.x) * k, y: s.y + (p.y - s.y) * k }, d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) { bd = d; best = q; }
  }
  if (best) { p.x = best.x; p.y = best.y; }
}

/** Lays the depths out beside the valley, with the hole that leads down beside the Dawn Forge. */
export function addDepths(world: WorldDefinition) {
  const x0 = world.width + GAP, y0 = 0;
  let s = 7331; const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const rooms: DepthRoom[] = ROOMS.map(r => ({ id: r.id, name: r.name, x: x0 + r.lx, y: y0 + r.ly, rx: r.rx, ry: r.ry }));
  const room = (id: string) => rooms.find(r => r.id === id)!;
  const halls: DepthHall[] = HALLS.map(([a, b]) => ({ a: { x: room(a).x, y: room(a).y }, b: { x: room(b).x, y: room(b).y }, hw: 105 }));
  const fall = room('fall'), throne = room('throne');
  // The hole opens on open ground a little south-west of the Dawn Forge.
  const forge = world.objects.find(o => o.kind === 'finale' && o.region === 'ember');
  const hole = forge ? { x: forge.x - 430, y: forge.y + 400 } : { x: world.width - 1200, y: 2100 };
  world.obstacles = world.obstacles.filter(o => Math.hypot(o.x - hole.x, o.y - hole.y) > 190 + o.r);
  world.decor = world.decor.filter(d => Math.hypot(d.x - hole.x, d.y - hole.y) > 150);
  const dp: Depths = { x0, y0, x1: x0 + W, y1: y0 + H, rooms, halls, landing: { x: fall.x - 60, y: fall.y + 40 }, throne: { x: throne.x, y: throne.y - 40 }, hole };
  world.depths = dp;

  const obj = (o: Omit<WorldObject, 'region'>) => world.objects.push({ ...o, region: 'ember' });
  obj({ id: 'ember:hole', kind: 'hole', x: hole.x, y: hole.y, name: 'The hole beneath the Forge' });
  obj({ id: 'depths:exit-fall', kind: 'exit', x: fall.x - 210, y: fall.y - 170, name: 'Roots to the surface' });
  obj({ id: 'depths:exit-throne', kind: 'exit', x: throne.x, y: throne.y - 300, name: 'Shaft of dawnlight', variant: 'throne' });
  const crystal = room('crystal'), hoard = room('hoard');
  obj({ id: 'depths:fire', kind: 'campfire', x: crystal.x - crystal.rx * .62, y: crystal.y + 40, name: 'Ember brazier' });
  obj({ id: 'depths:hoard', kind: 'chest', x: hoard.x + 40, y: hoard.y - 30, name: 'Sunken hoard', rich: true });
  for (const [id, text] of Object.entries(LORE)) { const r = room(id); obj({ id: `depths:lore-${id}`, kind: 'lore', x: r.x + r.rx * .45, y: r.y - r.ry * .55, name: id === 'crystal' ? 'Memory crystal' : 'Old carving', text }); }
  for (const r of rooms) world.pois.push({ id: `depths:${r.id}`, name: r.name, kind: 'depths', x: r.x, y: r.y, r: Math.min(r.rx, r.ry), region: 'ember' } as Poi);

  // Stalagmites and crystals around each chamber's wall (none across a hall's mouth), braziers for light, and the throne's
  // ring of pillars.
  const obstacles: Obstacle[] = [];
  const mouth = (x: number, y: number) => halls.some(h => segDist({ x, y }, h.a, h.b).d < h.hw + 70);
  for (const r of rooms) {
    const n = Math.round((r.rx + r.ry) * Math.PI / 115);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rand() * .2, k = .9 + rand() * .06, x = r.x + Math.cos(a) * r.rx * k, y = r.y + Math.sin(a) * r.ry * k;
      if (mouth(x, y)) continue;
      const crystalRoom = r.id === 'crystal' || r.id === 'hoard';
      obstacles.push(crystalRoom && i % 2 ? { x, y, r: 24 + rand() * 10, kind: 'crystal', seed: rand() } : { x, y, r: 26 + rand() * 16, kind: 'crag', seed: rand(), color: 'cave' });
    }
    for (let i = 0; i < 2; i++) { const a = i * Math.PI + .9, x = r.x + Math.cos(a) * r.rx * .7, y = r.y + Math.sin(a) * r.ry * .7; if (!mouth(x, y)) obstacles.push({ x, y, r: 20, kind: 'campfire', seed: rand() }); }
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2; obstacles.push({ x: throne.x + Math.cos(a) * throne.rx * .62, y: throne.y + Math.sin(a) * throne.ry * .62, r: 18, kind: 'pillar', seed: .95 }); }
  world.obstacles.push(...obstacles);
  // Bones and pebbles on the floors, and shards glowing in the crystal gallery.
  const decor: Decor[] = [];
  for (const r of rooms) for (let i = 0; i < Math.round(r.rx * r.ry / 2600); i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * .85, x = r.x + Math.cos(a) * r.rx * d, y = r.y + Math.sin(a) * r.ry * d;
    const shard = (r.id === 'crystal' || r.id === 'hoard') && rand() < .45;
    decor.push({ x, y, kind: shard ? 'shard' : rand() < .3 ? 'bone' : 'pebble', seed: rand(), color: shard ? ['#c9b6ff', '#8ee8ff', '#ff9ad8'][Math.floor(rand() * 3)] : '#e0d6bc' });
  }
  world.decor.push(...decor); world.decor.sort((a, b) => a.y - b.y);

  // The creatures of the depths, kept away from where the hero lands.
  let uid = 0;
  const seed = (kind: EnemyKind, x: number, y: number, elite: boolean): EnemySeed => ({ id: `depths:e-${uid++}`, kind, x, y, level: 26 + (elite ? 1 : 0), region: 'ember', elite, depths: true });
  for (const [key, pack] of Object.entries(PACKS)) {
    const [a, b] = key.split('-'), ra = room(a), rb = b ? room(b) : null;
    for (const [kind, count, elites] of pack) for (let i = 0; i < count; i++) {
      let x = 0, y = 0;
      for (let tries = 0; tries < 30; tries++) {
        if (rb) { const f = .3 + rand() * .4; x = ra.x + (rb.x - ra.x) * f + (rand() - .5) * 80; y = ra.y + (rb.y - ra.y) * f + (rand() - .5) * 80; }
        else { const ang = rand() * Math.PI * 2, d = .2 + rand() * .55; x = ra.x + Math.cos(ang) * ra.rx * d; y = ra.y + Math.sin(ang) * ra.ry * d; }
        if (inDepths(dp, x, y, 40) && Math.hypot(x - dp.landing.x, y - dp.landing.y) > 330 && !obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 40)) break;
      }
      world.enemies.push(seed(kind, x, y, i < elites));
    }
  }
}
