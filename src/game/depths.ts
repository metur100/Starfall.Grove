// The Depths beneath the Dawn Forge: when Pyrrhus falls the ground gives way, and the hero drops into a great cave of
// chambers and tunnels where Umbra waits on its throne. It lies in a space of its own beside the valley (east of it on
// the world's coordinates, out of sight and off the map), counts as part of the Ember Wastes, and is laid out by hand:
// thirteen chambers joined by halls, each with a look of its own (roots, bones, a sunken hoard, glowing fungi, crystal,
// drowned water, lava, the void), creatures found nowhere else, two ambush arenas that shut behind the hero, and three
// Eclipse Seals whose guardians must be beaten before the door to Umbra's throne opens. After Umbra falls the hole
// stays open beside the Forge, and the depths can be walked again (their creatures, seals, ambushes and an echo of
// Umbra come back each time).
import type { Decor, EnemyKind, EnemySeed, Obstacle, Point, Poi, WorldDefinition, WorldObject } from './types';

/** What a chamber looks like, and what goes wrong in it (see DEPTH_HAZARDS). */
export type DepthTheme = 'roots' | 'bones' | 'hoard' | 'fungi' | 'crystal' | 'water' | 'lava' | 'void' | 'throne';
/** A chamber (an ellipse) and a hall between two chambers (a capsule); `gate` is the sealed door to Umbra's throne. */
export type DepthRoom = { id: string; name: string; x: number; y: number; rx: number; ry: number; theme: DepthTheme };
export type DepthHall = { a: Point; b: Point; hw: number; from: string; to: string; gate?: boolean };
/** A pool of water or lava standing in a chamber's floor: nobody walks through it. */
export type DepthPool = { x: number; y: number; rx: number; ry: number; kind: 'water' | 'lava' };
export type Depths = {
  x0: number; y0: number; x1: number; y1: number; rooms: DepthRoom[]; halls: DepthHall[]; pools: DepthPool[];
  landing: Point; throne: Point; hole: Point;
  /** Where the sealed door to the throne stands (across its hall, where the hall leaves the Hall of Echoes). */
  gate: Point & { nx: number; ny: number; hw: number };
};

/** Room between the valley and the depths, so nothing of one is ever drawn next to the other. */
const GAP = 1536, W = 8800, H = 6500;
const ROOMS: Array<Omit<DepthRoom, 'x' | 'y'> & { lx: number; ly: number }> = [
  { id: 'fall', name: 'The Fall', lx: 800, ly: 1300, rx: 470, ry: 380, theme: 'roots' },
  { id: 'bones', name: 'Hall of Bones', lx: 2150, ly: 800, rx: 600, ry: 430, theme: 'bones' },
  { id: 'hoard', name: 'The Sunken Hoard', lx: 1450, ly: 2650, rx: 440, ry: 340, theme: 'hoard' },
  { id: 'grotto', name: 'The Glowcap Grotto', lx: 3750, ly: 1450, rx: 640, ry: 480, theme: 'fungi' },
  { id: 'crystal', name: 'The Crystal Gallery', lx: 3300, ly: 3300, rx: 600, ry: 460, theme: 'crystal' },
  { id: 'catacombs', name: 'The Catacombs', lx: 1650, ly: 4650, rx: 620, ry: 460, theme: 'bones' },
  { id: 'cistern', name: 'The Drowned Cistern', lx: 5150, ly: 2850, rx: 700, ry: 500, theme: 'water' },
  { id: 'pit', name: 'The Shadow Pit', lx: 4300, ly: 5150, rx: 580, ry: 440, theme: 'void' },
  { id: 'vaults', name: 'The Ember Vaults', lx: 6650, ly: 1350, rx: 620, ry: 450, theme: 'lava' },
  { id: 'forge', name: 'The Shadow Forge', lx: 7950, ly: 2850, rx: 640, ry: 480, theme: 'lava' },
  { id: 'echoes', name: 'Hall of Echoes', lx: 6700, ly: 4250, rx: 540, ry: 400, theme: 'void' },
  { id: 'sanctum', name: 'The Eclipse Sanctum', lx: 8000, ly: 5500, rx: 560, ry: 420, theme: 'void' },
  { id: 'throne', name: 'Umbra’s Throne', lx: 5700, ly: 5750, rx: 720, ry: 500, theme: 'throne' },
];
const HALLS: Array<[string, string, number?]> = [
  ['fall', 'bones'], ['bones', 'hoard'], ['bones', 'grotto'], ['grotto', 'crystal', 120], ['crystal', 'catacombs'], ['crystal', 'cistern', 120],
  ['cistern', 'pit'], ['cistern', 'vaults', 120], ['vaults', 'forge'], ['forge', 'echoes', 120], ['echoes', 'sanctum'], ['echoes', 'throne', 130],
];
/** Pools in the chambers' floors, as offsets from the chamber's middle in its own radii. */
const POOLS: Array<[string, number, number, number, number, DepthPool['kind']]> = [
  ['grotto', -.42, .35, 120, 70, 'water'],
  ['cistern', -.45, -.3, 190, 105, 'water'], ['cistern', .42, .32, 170, 95, 'water'], ['cistern', .05, -.62, 120, 60, 'water'],
  ['vaults', -.38, .38, 150, 80, 'lava'], ['vaults', .45, -.25, 120, 70, 'lava'],
  ['forge', .45, .3, 160, 85, 'lava'], ['forge', -.5, -.35, 110, 60, 'lava'],
];
/** The creatures of each chamber (and of the halls between), as [kind, count, elites]. */
const PACKS: Record<string, Array<[EnemyKind, number, number]>> = {
  fall: [['duskwing', 3, 0], ['bonewalker', 2, 0]],
  'fall-bones': [['hollowArcher', 2, 0], ['bonewalker', 2, 0]],
  bones: [['umbralKnight', 3, 1], ['hollowArcher', 2, 0], ['bonewalker', 5, 1], ['duskwing', 2, 0]],
  hoard: [['shardback', 1, 1], ['duskwing', 3, 0], ['gloomstalker', 1, 0]],
  'bones-grotto': [['gloomstalker', 2, 0], ['bonewalker', 3, 0]],
  grotto: [['acolyte', 2, 0], ['shardback', 1, 0], ['gloomstalker', 2, 1], ['duskwing', 4, 0]],
  'grotto-crystal': [['umbralKnight', 2, 0], ['hollowArcher', 1, 0]],
  crystal: [['shardback', 2, 0], ['acolyte', 2, 0], ['duskwing', 3, 0]],
  'crystal-catacombs': [['bonewalker', 4, 0]],
  'crystal-cistern': [['hollowArcher', 2, 0], ['gloomstalker', 2, 0]],
  cistern: [['umbralKnight', 2, 1], ['shardback', 1, 0], ['hollowArcher', 3, 0], ['duskwing', 3, 1]],
  'cistern-vaults': [['bonewalker', 4, 1], ['acolyte', 1, 0]],
  vaults: [['umbralKnight', 3, 0], ['acolyte', 2, 1], ['shardback', 1, 1], ['bonewalker', 3, 0]],
  'vaults-forge': [['gloomstalker', 2, 1], ['hollowArcher', 2, 0]],
  forge: [['umbralKnight', 3, 1], ['shardback', 2, 0], ['bonewalker', 4, 0]],
  'forge-echoes': [['acolyte', 2, 0], ['duskwing', 3, 0]],
  echoes: [['umbralKnight', 2, 2], ['acolyte', 2, 2], ['hollowArcher', 2, 0], ['gloomstalker', 2, 0]],
  sanctum: [['acolyte', 3, 1], ['gloomstalker', 2, 1], ['duskwing', 3, 0]],
};
/**
 * The two ambush arenas: walk in and the way out seals behind you while the waves come out of the dark, each as
 * [kind, count, elites, heroic name]. The last wave clears the chamber, and its hoard appears.
 */
export const DEPTH_AMBUSHES: Record<string, Array<Array<[EnemyKind, number, number, string?]>>> = {
  catacombs: [
    [['bonewalker', 7, 1], ['hollowArcher', 2, 0]],
    [['bonewalker', 5, 0], ['umbralKnight', 2, 1], ['gloomstalker', 2, 0]],
    [['umbralKnight', 1, 0, 'Morrowgrave, the Hollow Oath'], ['bonewalker', 5, 0], ['hollowArcher', 2, 1]],
  ],
  pit: [
    [['gloomstalker', 3, 0], ['duskwing', 5, 1]],
    [['shardback', 1, 1], ['acolyte', 2, 0], ['bonewalker', 5, 0]],
    [['umbralKnight', 3, 1], ['gloomstalker', 2, 1], ['acolyte', 2, 1]],
  ],
};
/**
 * The Eclipse Seals: three obelisks whose light keeps the door to Umbra's throne shut. Touching one wakes its
 * guardians (as [kind, count, elites, heroic name]); beat them all and the seal shatters.
 */
export const DEPTH_SEALS: Record<string, Array<[EnemyKind, number, number, string?]>> = {
  vaults: [['umbralKnight', 2, 1], ['acolyte', 2, 0], ['bonewalker', 4, 0]],
  forge: [['shardback', 1, 0, 'Gorrak, the Shardfather'], ['bonewalker', 4, 0], ['hollowArcher', 2, 0]],
  sanctum: [['acolyte', 1, 0, 'Nyx, Voice of the Eclipse'], ['duskwing', 4, 1], ['gloomstalker', 2, 0]],
};
/** What each kind of chamber does to whoever stands in it: stalactites drop in the bone halls, spores burst in the
 *  grotto, lava erupts in the vaults and the forge, and shards of the void rain on the halls of the eclipse. */
export const DEPTH_HAZARDS: Partial<Record<DepthTheme, 'stalactite' | 'spore' | 'lava' | 'meteor'>> = { bones: 'stalactite', fungi: 'spore', lava: 'lava', void: 'meteor' };
const LORE: Record<string, string[]> = {
  fall: ['Words scratched into the cave wall, old and deep: “The Forge was built over a door. We lit the fire so it would stay shut.”'],
  bones: ['A cairn of skulls, every one turned toward the east.', '“They came down to stop it, and it kept them. It keeps everything.”'],
  crystal: ['A crystal hums under your hand, and shows a memory: four lights in a ring, and in the middle of the ring, something sleeping.', '“Beacon, Bell, Star and Forge. While they burn, the Eclipse dreams. Wake it, and it will want a throne.”'],
  cistern: ['The water here is perfectly still, and shows the sky. There is no sky.', 'Someone has carved a moon into the rim of the well, and under it: “Drink, and remember the light.”'],
  echoes: ['Every voice you have ever heard seems to whisper here at once.', '“There is no shadow you were born with,” they say. “Only the one you choose to carry.”'],
  sanctum: ['Three seals, three wardens: one of fire, one of stone, one of the dark itself.', '“Break them, and the door will open. Break them, and it will know you are coming.”'],
};

const segDist = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
  return { d: Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t), x: a.x + dx * t, y: a.y + dy * t };
};
const inRoom = (r: DepthRoom, x: number, y: number, pad = 0) => { const ex = (x - r.x) / Math.max(1, r.rx - pad), ey = (y - r.y) / Math.max(1, r.ry - pad); return ex * ex + ey * ey <= 1; };
export const inPool = (pl: DepthPool, x: number, y: number, pad = 0) => { const ex = (x - pl.x) / (pl.rx + pad), ey = (y - pl.y) / (pl.ry + pad); return ex * ex + ey * ey < 1; };
/** The chamber a point stands in (inside its ellipse, `k` of the way out), if any. */
export const roomAt = (dp: Depths, p: Point, k = 1) => dp.rooms.find(r => { const ex = (p.x - r.x) / (r.rx * k), ey = (p.y - r.y) / (r.ry * k); return ex * ex + ey * ey <= 1; }) || null;
/** Inside the walkable cave (a chamber or a hall), `pad` from its walls and out of its pools. The throne's hall is
 *  rock while `gateOpen` is false. */
export function inDepths(dp: Depths, x: number, y: number, pad = 0, gateOpen = true) {
  if (dp.pools.some(pl => inPool(pl, x, y, pad * .5))) return false;
  for (const r of dp.rooms) if (inRoom(r, x, y, pad)) return true;
  for (const h of dp.halls) if ((gateOpen || !h.gate) && segDist({ x, y }, h.a, h.b).d <= h.hw - pad) return true;
  return false;
}
/** Within the depths' own space (walkable or not). */
export const inDepthsArea = (dp: Depths | undefined, p: Point) => !!dp && p.x >= dp.x0 - 200 && p.x <= dp.x1 + 200 && p.y >= dp.y0 - 200 && p.y <= dp.y1 + 200;
/**
 * Keeps a point inside the cave: out of the rock and the pools and back to the nearest floor, `pad` from the wall. While
 * `gateOpen` is false the throne's hall counts as rock; \`lock\` keeps it inside one chamber (an ambush has shut it in).
 */
export function keepInDepths(dp: Depths, p: Point, pad: number, gateOpen = true, lock: DepthRoom | null = null) {
  for (const pl of dp.pools) {
    const rx = pl.rx + pad * .5, ry = pl.ry + pad * .5, ex = (p.x - pl.x) / rx, ey = (p.y - pl.y) / ry, d = Math.hypot(ex, ey);
    if (d < 1) { const k = d > 1e-6 ? 1.001 / d : 0; p.x = pl.x + (d > 1e-6 ? (p.x - pl.x) * k : rx); p.y = pl.y + (p.y - pl.y) * k; }
  }
  if (lock ? inRoom(lock, p.x, p.y, pad) : inDepths(dp, p.x, p.y, pad, gateOpen)) return;
  let best: Point | null = null, bd = Infinity;
  for (const r of lock ? [lock] : dp.rooms) {
    const rx = Math.max(1, r.rx - pad), ry = Math.max(1, r.ry - pad), ex = (p.x - r.x) / rx, ey = (p.y - r.y) / ry, k = 1 / Math.max(1e-6, Math.hypot(ex, ey));
    const q = { x: r.x + (p.x - r.x) * k * .999, y: r.y + (p.y - r.y) * k * .999 }, d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) { bd = d; best = q; }
  }
  if (!lock) for (const h of dp.halls) {
    if (h.gate && !gateOpen) continue;
    const s = segDist(p, h.a, h.b), r = Math.max(1, h.hw - pad), k = s.d > 0 ? r / s.d * .999 : 0;
    const q = { x: s.x + (p.x - s.x) * k, y: s.y + (p.y - s.y) * k }, d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) { bd = d; best = q; }
  }
  if (best) { p.x = best.x; p.y = best.y; }
}
/** The nearest chamber to a point (inside one, or in a hall between two). */
const nearestRoom = (dp: Depths, p: Point) => {
  let best = dp.rooms[0], bd = Infinity;
  for (const r of dp.rooms) { const d = Math.hypot((p.x - r.x) / r.rx, (p.y - r.y) / r.ry); if (d < bd) { bd = d; best = r; } }
  return best;
};
/**
 * Where to head next to get from one point of the depths to another, through the chambers and halls (not through the
 * rock): the next chamber on the way, or the point itself once in its chamber.
 */
export function depthsRoute(dp: Depths, from: Point, to: Point, gateOpen = true): Point {
  const a = roomAt(dp, from) || nearestRoom(dp, from), b = roomAt(dp, to) || nearestRoom(dp, to);
  if (a === b) return to;
  const prev = new Map<string, string>([[a.id, '']]), queue = [a.id];
  while (queue.length) {
    const id = queue.shift()!; if (id === b.id) break;
    for (const h of dp.halls) {
      if (h.gate && !gateOpen) continue;
      const next = h.from === id ? h.to : h.to === id ? h.from : null;
      if (next && !prev.has(next)) { prev.set(next, id); queue.push(next); }
    }
  }
  if (!prev.has(b.id)) return to;
  let step = b.id; while (prev.get(step) !== a.id) step = prev.get(step)!;
  const r = dp.rooms.find(x => x.id === step)!;
  return { x: r.x, y: r.y };
}

/** Lays the depths out beside the valley, with the hole that leads down beside the Dawn Forge. */
export function addDepths(world: WorldDefinition) {
  const x0 = world.width + GAP, y0 = 0;
  let s = 7331; const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const R = (a: number, b: number) => a + rand() * (b - a);
  const rooms: DepthRoom[] = ROOMS.map(r => ({ id: r.id, name: r.name, x: x0 + r.lx, y: y0 + r.ly, rx: r.rx, ry: r.ry, theme: r.theme }));
  const room = (id: string) => rooms.find(r => r.id === id)!;
  const halls: DepthHall[] = HALLS.map(([a, b, hw]) => ({ a: { x: room(a).x, y: room(a).y }, b: { x: room(b).x, y: room(b).y }, hw: hw || 105, from: a, to: b, gate: b === 'throne' || undefined }));
  const pools: DepthPool[] = POOLS.map(([id, fx, fy, rx, ry, kind]) => { const r = room(id); return { x: r.x + fx * r.rx, y: r.y + fy * r.ry, rx, ry, kind }; });
  const fall = room('fall'), throne = room('throne'), echoes = room('echoes');
  // The sealed door stands across the throne's hall where it leaves the Hall of Echoes.
  const gh = halls.find(h => h.gate)!, gdx = gh.b.x - gh.a.x, gdy = gh.b.y - gh.a.y, gl = Math.hypot(gdx, gdy), nx = gdx / gl, ny = gdy / gl;
  const gt = 1 / Math.hypot(nx / echoes.rx, ny / echoes.ry) + 20;
  // The hole opens on open ground a little south-west of the Dawn Forge.
  const forge = world.objects.find(o => o.kind === 'finale' && o.region === 'ember');
  const hole = forge ? { x: forge.x - 430, y: forge.y + 400 } : { x: world.width - 1200, y: 2100 };
  world.obstacles = world.obstacles.filter(o => Math.hypot(o.x - hole.x, o.y - hole.y) > 190 + o.r);
  world.decor = world.decor.filter(d => Math.hypot(d.x - hole.x, d.y - hole.y) > 150);
  const dp: Depths = { x0, y0, x1: x0 + W, y1: y0 + H, rooms, halls, pools, landing: { x: fall.x - 60, y: fall.y + 40 }, throne: { x: throne.x, y: throne.y - 40 }, hole, gate: { x: echoes.x + nx * gt, y: echoes.y + ny * gt, nx, ny, hw: gh.hw } };
  world.depths = dp;

  // Clear floor round each pool's rim and each hall's mouth, and the way through every chamber.
  const mouth = (x: number, y: number, pad = 70) => halls.some(h => segDist({ x, y }, h.a, h.b).d < h.hw + pad);
  const wet = (x: number, y: number, pad: number) => pools.some(pl => inPool(pl, x, y, pad));
  const obstacles: Obstacle[] = [];
  const clear = (x: number, y: number, r: number) => !mouth(x, y, r + 40) && !wet(x, y, r + 30) && !obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 26);
  const put = (o: Obstacle) => { if (clear(o.x, o.y, o.r)) { obstacles.push(o); return true; } return false; };
  /** Scatters `n` of a kind round a chamber, between `d0` and `d1` of the way out. */
  const scatter = (r: DepthRoom, n: number, d0: number, d1: number, make: () => Omit<Obstacle, 'x' | 'y'>) => {
    for (let i = 0, k = 0; i < n * 12 && k < n; i++) { const a = rand() * Math.PI * 2, d = R(d0, d1), o = { ...make(), x: r.x + Math.cos(a) * r.rx * d, y: r.y + Math.sin(a) * r.ry * d } as Obstacle; if (put(o)) k++; }
  };

  const obj = (o: Omit<WorldObject, 'region'>) => world.objects.push({ ...o, region: 'ember' });
  obj({ id: 'ember:hole', kind: 'hole', x: hole.x, y: hole.y, name: 'The hole beneath the Forge' });
  obj({ id: 'depths:exit-fall', kind: 'exit', x: fall.x - 210, y: fall.y - 170, name: 'Roots to the surface' });
  obj({ id: 'depths:exit-throne', kind: 'exit', x: throne.x, y: throne.y - 300, name: 'Shaft of dawnlight', variant: 'throne' });
  const crystal = room('crystal'), hoard = room('hoard'), cistern = room('cistern');
  obj({ id: 'depths:fire', kind: 'campfire', x: crystal.x - crystal.rx * .62, y: crystal.y + 40, name: 'Ember brazier' });
  obj({ id: 'depths:fire-echoes', kind: 'campfire', x: echoes.x - echoes.rx * .55, y: echoes.y - 60, name: 'Ember brazier' });
  obj({ id: 'depths:moonwell', kind: 'well', x: cistern.x + cistern.rx * .5, y: cistern.y - cistern.ry * .45, name: 'Moonwell', variant: 'moon' });
  obj({ id: 'depths:hoard', kind: 'chest', x: hoard.x + 40, y: hoard.y - 30, name: 'Sunken hoard', rich: true });
  obj({ id: 'depths:hoard-2', kind: 'chest', x: hoard.x - hoard.rx * .5, y: hoard.y + 60, name: 'Drowned coffer' });
  obj({ id: 'depths:chest-grotto', kind: 'chest', x: room('grotto').x + room('grotto').rx * .55, y: room('grotto').y + room('grotto').ry * .4, name: 'Mossy chest' });
  obj({ id: 'depths:chest-vaults', kind: 'chest', x: room('vaults').x + 30, y: room('vaults').y - room('vaults').ry * .55, name: 'Ember-sealed chest' });
  for (const id of Object.keys(DEPTH_AMBUSHES)) { const r = room(id); obj({ id: `depths:prize-${id}`, kind: 'chest', x: r.x, y: r.y - 20, name: id === 'catacombs' ? 'Morrowgrave’s hoard' : 'Hoard of the Pit', rich: true, variant: 'ambush' }); }
  for (const id of Object.keys(DEPTH_SEALS)) { const r = room(id); obj({ id: `depths:seal-${id}`, kind: 'seal', x: r.x + r.rx * .1, y: r.y - r.ry * .15, name: 'Eclipse Seal' }); }
  for (const [id, text] of Object.entries(LORE)) { const r = room(id); obj({ id: `depths:lore-${id}`, kind: 'lore', x: r.x - r.rx * .45, y: r.y - r.ry * .55, name: id === 'crystal' ? 'Memory crystal' : 'Old carving', text }); }
  for (const r of rooms) world.pois.push({ id: `depths:${r.id}`, name: r.name, kind: 'depths', x: r.x, y: r.y, r: Math.min(r.rx, r.ry), region: 'ember' } as Poi);
  // Keep the floor clear round everything the hero comes to use.
  for (const o of world.objects) if (o.id.startsWith('depths:')) obstacles.push({ x: o.x, y: o.y, r: o.kind === 'seal' ? 70 : 50, kind: 'rock', seed: 0 });
  const reserved = obstacles.length;

  // Every chamber's wall: stalagmites (crystals in the crystal rooms, obsidian where there is lava), none across a
  // hall's mouth.
  for (const r of rooms) {
    const n = Math.round((r.rx + r.ry) * Math.PI / 110);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rand() * .2, k = .9 + rand() * .06, x = r.x + Math.cos(a) * r.rx * k, y = r.y + Math.sin(a) * r.ry * k;
      if (mouth(x, y)) continue;
      const glassy = (r.theme === 'crystal' || r.theme === 'hoard') && i % 2, lava = r.theme === 'lava' && i % 3 === 0;
      obstacles.push(glassy ? { x, y, r: 24 + rand() * 10, kind: 'crystal', seed: rand() } : lava ? { x, y, r: 26 + rand() * 10, kind: 'obsidian', seed: rand() } : { x, y, r: 26 + rand() * 16, kind: 'crag', seed: rand(), color: 'cave' });
    }
  }
  // Each chamber's own furnishings.
  for (const r of rooms) {
    switch (r.theme) {
      case 'roots': scatter(r, 5, .25, .7, () => ({ r: 22, kind: 'stump', seed: rand() })); break;
      case 'bones': scatter(r, 8, .25, .72, () => ({ r: 20, kind: 'pillar', seed: .3 + rand() * .3 })); scatter(r, 3, .3, .7, () => ({ r: 24, kind: 'crag', seed: rand(), color: 'cave' })); break;
      case 'hoard': scatter(r, 6, .2, .75, () => ({ r: 22 + rand() * 8, kind: 'crystal', seed: rand() })); scatter(r, 4, .3, .75, () => ({ r: 18, kind: 'crate', seed: rand() })); break;
      case 'fungi': for (let c = 0; c < 6; c++) scatter(r, 1 + Math.round(rand() * 2), .2, .78, () => ({ r: 28 + rand() * 16, kind: 'mushroom', seed: rand() })); break;
      case 'crystal': scatter(r, 9, .2, .78, () => ({ r: 22 + rand() * 14, kind: 'crystal', seed: rand() })); break;
      case 'water': scatter(r, 8, .3, .8, () => ({ r: 22, kind: 'pillar', seed: .5 })); break;
      case 'lava': scatter(r, 5, .25, .75, () => ({ r: 22 + rand() * 8, kind: 'obsidian', seed: rand() })); scatter(r, 4, .25, .75, () => ({ r: 16, kind: 'fumarole', seed: rand() })); break;
      case 'void': scatter(r, 6, .35, .75, () => ({ r: 22, kind: 'pillar', seed: .95 })); scatter(r, 3, .3, .7, () => ({ r: 22 + rand() * 10, kind: 'obsidian', seed: rand() })); break;
      case 'throne': break;
    }
    // Braziers for light.
    for (let i = 0; i < 2; i++) { const a = i * Math.PI + .9, x = r.x + Math.cos(a) * r.rx * .7, y = r.y + Math.sin(a) * r.ry * .7; put({ x, y, r: 20, kind: 'campfire', seed: rand() }); }
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2; obstacles.push({ x: throne.x + Math.cos(a) * throne.rx * .62, y: throne.y + Math.sin(a) * throne.ry * .62, r: 18, kind: 'pillar', seed: .95 }); }
  for (let i = 0; i < 2; i++) obstacles.push({ x: throne.x + (i ? 1 : -1) * throne.rx * .3, y: throne.y - throne.ry * .5, r: 26, kind: 'obsidian', seed: .9 });
  // The moonwell's ring of stones.
  { const mw = world.objects.find(o => o.id === 'depths:moonwell')!; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; obstacles.push({ x: mw.x + Math.cos(a) * 70, y: mw.y + Math.sin(a) * 44, r: 10, kind: 'rock', seed: rand() }); } }
  world.obstacles.push(...obstacles.slice(reserved));

  // On the floors: bones and pebbles everywhere, heaps of bones in the halls of the dead, glowing shards in the crystal
  // rooms, gold in the hoard, glowcaps in the grotto, glowing cracks by the lava.
  const decor: Decor[] = [];
  const put2 = (r: DepthRoom, kind: Decor['kind'], color: string, n: number) => { for (let i = 0; i < n; i++) { const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * .85, x = r.x + Math.cos(a) * r.rx * d, y = r.y + Math.sin(a) * r.ry * d; if (!wet(x, y, 14)) decor.push({ x, y, kind, seed: rand(), color }); } };
  for (const r of rooms) {
    const n = Math.round(r.rx * r.ry / 2600);
    put2(r, 'pebble', '#e0d6bc', Math.round(n * .5));
    put2(r, 'bone', '#e0d6bc', Math.round(n * (r.theme === 'bones' ? 1.2 : .25)));
    if (r.theme === 'crystal' || r.theme === 'hoard') for (const c of ['#c9b6ff', '#8ee8ff', '#ff9ad8']) put2(r, 'shard', c, Math.round(n * .2));
    if (r.theme === 'hoard') put2(r, 'shard', '#ffd35c', Math.round(n * .6));
    if (r.theme === 'fungi') { for (const c of ['#9fe3c9', '#86d4ff', '#d6a3f0']) put2(r, 'shroom', c, Math.round(n * .35)); put2(r, 'fern', '#3f6a5a', Math.round(n * .3)); }
    if (r.theme === 'lava') put2(r, 'vein', '#ff7a3d', Math.round(n * .5));
    if (r.theme === 'void') put2(r, 'shard', '#c9b6ff', Math.round(n * .15));
  }
  for (const h of halls) { const l = Math.hypot(h.b.x - h.a.x, h.b.y - h.a.y); for (let i = 0; i < l / 90; i++) { const f = rand(), x = h.a.x + (h.b.x - h.a.x) * f + R(-1, 1) * h.hw * .7, y = h.a.y + (h.b.y - h.a.y) * f + R(-1, 1) * h.hw * .5; decor.push({ x, y, kind: rand() < .3 ? 'bone' : 'pebble', seed: rand(), color: '#e0d6bc' }); } }
  world.decor.push(...decor); world.decor.sort((a, b) => a.y - b.y);

  // The creatures of the depths, kept away from where the hero lands.
  let uid = 0;
  const seed = (kind: EnemyKind, x: number, y: number, elite: boolean): EnemySeed => ({ id: `depths:e-${uid++}`, kind, x, y, level: 26 + (elite ? 1 : 0), region: 'ember', elite, depths: true });
  for (const [key, pack] of Object.entries(PACKS)) {
    const [a, b] = key.split('-'), ra = room(a), rb = b ? room(b) : null;
    for (const [kind, count, elites] of pack) for (let i = 0; i < count; i++) {
      let x = 0, y = 0;
      for (let tries = 0; tries < 40; tries++) {
        if (rb) { const f = .3 + rand() * .4; x = ra.x + (rb.x - ra.x) * f + (rand() - .5) * 80; y = ra.y + (rb.y - ra.y) * f + (rand() - .5) * 80; }
        else { const ang = rand() * Math.PI * 2, d = .2 + rand() * .55; x = ra.x + Math.cos(ang) * ra.rx * d; y = ra.y + Math.sin(ang) * ra.ry * d; }
        if (inDepths(dp, x, y, 40, false) && Math.hypot(x - dp.landing.x, y - dp.landing.y) > 330 && !obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 40)) break;
      }
      world.enemies.push(seed(kind, x, y, i < elites));
    }
  }
}
