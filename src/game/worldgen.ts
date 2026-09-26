// Procedural world builder: turns a hand-authored chapter layout (places, people, quests) into a large living map
// with a road network, villages, farms, camps, ruins, lakes, forests, creatures, critters and loot.
import { Grid } from './spatial';
import type {
  CritterKind, CritterSeed, Decor, DecorKind, EnemyKind, EnemySeed, ItemIcon, NpcActivity, NpcDef, NpcLook, Obstacle, ObstacleKind,
  Point, Poi, Pond, QuestDef, WorldDefinition, WorldObject,
} from './types';

export const WORLD_W = 9600, WORLD_H = 6720;

export type NpcSpec = {
  id: string; name: string; portrait: string; at: string; activity: NpcActivity; look?: Partial<NpcLook>;
  role?: 'guide' | 'villager'; dx?: number; dy?: number; to?: string; lines: string[]; barks: string[];
};
export type LoreSpec = { at: string; name: string; text: string[] };
export type ChapterSpec = Omit<WorldDefinition, 'width' | 'height' | 'spawn' | 'roads' | 'obstacles' | 'decor' | 'pods' | 'ponds' | 'enemies' | 'critters' | 'npcs' | 'objects'> & {
  seed: number; links: Array<[string, string]>; keyAt: string[]; keyName: string; shrineName: string; finaleName: string;
  trees: Array<[ObstacleKind, number]>; decorKinds: Array<[DecorKind, number]>; decorColors: string[];
  enemyKinds: Array<[EnemyKind, number]>; boss: EnemyKind; critters: Array<[CritterKind, number]>;
  npcs: NpcSpec[]; lore: LoreSpec[]; chatter: string[]; barks: string[]; villagerNames: string[]; lakeSize: Record<string, number>;
  ground: 'grass' | 'snow';
};

// ───────────────────────────── deterministic helpers
export const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const hash = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function lattice(x: number, y: number, s: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, y: number, s: number) => lattice(x / 1100, y / 1100, s) * .55 + lattice(x / 420, y / 420, s + 7) * .3 + lattice(x / 150, y / 150, s + 13) * .15;
const pickW = <T,>(rand: () => number, list: Array<[T, number]>) => { const total = list.reduce((s, [, w]) => s + w, 0); let p = rand() * total; for (const [k, w] of list) if ((p -= w) <= 0) return k; return list[0][0]; };
const d2 = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const inPond = (ponds: Pond[], x: number, y: number, pad = 0) => ponds.some(p => Math.hypot((x - p.x) / (p.r + pad), (y - p.y) / (p.r * .58 + pad)) < 1);

/** Nearest-road distance lookups over a segment grid. */
export class RoadIndex {
  private grid: Grid<{ x: number; y: number; ax: number; ay: number; bx: number; by: number }>;
  constructor(roads: Point[][]) {
    this.grid = new Grid(300);
    for (const road of roads) for (let i = 1; i < road.length; i++) { const a = road[i - 1], b = road[i]; this.grid.insert({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ax: a.x, ay: a.y, bx: b.x, by: b.y }); }
  }
  dist(x: number, y: number, max = 400) {
    let best = max;
    for (const s of this.grid.near(x, y, max + 90)) {
      const dx = s.bx - s.ax, dy = s.by - s.ay, l = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / l));
      const d = Math.hypot(x - (s.ax + dx * t), y - (s.ay + dy * t)); if (d < best) best = d;
    }
    return best;
  }
}

const SKINS = ['#f0c8a2', '#e2b089', '#c98f66', '#9c6a4a', '#f5d6bc', '#7a5037'];
const HAIRS = ['#6b3f2a', '#2e2420', '#b8743c', '#d9c08a', '#8a8a8a', '#e8e2d0', '#4a2f24'];
const ROBES = ['#6f8fb8', '#b86a5a', '#7a9a5a', '#c9a24c', '#8a6fb0', '#5a8a8a', '#b07a9a', '#a0785a', '#7d8f5a', '#c07850'];

export function buildWorld(spec: ChapterSpec): WorldDefinition {
  const rand = rng(spec.seed), W = WORLD_W, H = WORLD_H;
  const R = (a: number, b: number) => a + rand() * (b - a);
  const poiById = new Map(spec.pois.map(p => [p.id, p]));
  const poi = (id: string) => { const p = poiById.get(id); if (!p) throw new Error(`Unknown place ${id}`); return p; };

  // Lakes first so roads can bend around them.
  const ponds: Pond[] = [];
  for (const p of spec.pois) if (p.kind === 'lake') ponds.push({ x: p.x, y: p.y, r: spec.lakeSize[p.id] || 320 });
  for (let i = 0; i < 9; i++) {
    const x = R(500, W - 500), y = R(500, H - 500);
    if (spec.pois.some(p => d2(p, { x, y }) < p.r + 260) || ponds.some(p => d2(p, { x, y }) < p.r + 400)) continue;
    ponds.push({ x, y, r: R(90, 170) });
  }

  // ── road network: minimum spanning tree over the places plus a few loops
  const edges: Array<[string, string]> = [];
  const inTree = new Set([spec.pois[0].id]);
  while (inTree.size < spec.pois.length) {
    let best: [string, string] | null = null, bd = Infinity;
    for (const a of spec.pois) if (inTree.has(a.id)) for (const b of spec.pois) if (!inTree.has(b.id)) { const d = d2(a, b); if (d < bd) { bd = d; best = [a.id, b.id]; } }
    if (!best) break;
    edges.push(best); inTree.add(best[1]);
  }
  for (const l of spec.links) if (!edges.some(([a, b]) => (a === l[0] && b === l[1]) || (a === l[1] && b === l[0]))) edges.push(l);
  const edgePaths = new Map<string, Point[]>();
  const roads: Point[][] = [];
  for (const [ia, ib] of edges) {
    const a = poi(ia), b = poi(ib), len = d2(a, b), n = Math.max(3, Math.round(len / 260));
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len, ph = rand() * 6.28, amp = Math.min(260, len * .12);
    let pts: Point[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, bend = Math.sin(t * Math.PI) * (Math.sin(ph + t * 5.3) * amp + Math.sin(ph * 2 + t * 13) * amp * .25);
      let x = a.x + (b.x - a.x) * t + nx * bend, y = a.y + (b.y - a.y) * t + ny * bend;
      for (const p of ponds) {
        const ex = (x - p.x) / (p.r + 70), ey = (y - p.y) / (p.r * .58 + 70), e = Math.hypot(ex, ey);
        if (e < 1 && e > 0) { x = p.x + ex / e * (p.r + 70); y = p.y + ey / e * (p.r * .58 + 70); }
      }
      pts.push({ x: Math.max(160, Math.min(W - 160, x)), y: Math.max(160, Math.min(H - 160, y)) });
    }
    for (let k = 0; k < 2; k++) { // Chaikin smoothing keeps roads curvy instead of zig-zag
      const s: Point[] = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; s.push({ x: p.x * .75 + q.x * .25, y: p.y * .75 + q.y * .25 }, { x: p.x * .25 + q.x * .75, y: p.y * .25 + q.y * .75 }); }
      s.push(pts[pts.length - 1]); pts = s;
    }
    roads.push(pts); edgePaths.set(`${ia}|${ib}`, pts); edgePaths.set(`${ib}|${ia}`, [...pts].reverse());
  }
  const roadIx = new RoadIndex(roads);
  const roadDist = (x: number, y: number) => roadIx.dist(x, y);

  // ── placement bookkeeping
  const obstacles: Obstacle[] = [], objects: WorldObject[] = [], decor: Decor[] = [], npcs: NpcDef[] = [], critters: CritterSeed[] = [], enemies: EnemySeed[] = [];
  const solid = new Grid<{ x: number; y: number; r: number }>(200);
  const blocked = (x: number, y: number, r: number) => { for (const s of solid.near(x, y, r + 160)) if (Math.hypot(s.x - x, s.y - y) < s.r + r) return true; return inPond(ponds, x, y, r) || x < 120 || y < 120 || x > W - 120 || y > H - 120; };
  const put = (o: Obstacle, clearance = o.w ? Math.max(o.w, o.h || 0) : o.r) => { obstacles.push(o); solid.insert({ x: o.x, y: o.y, r: clearance }); return o; };
  const obj = (o: WorldObject, clearance = 30) => { objects.push(o); solid.insert({ x: o.x, y: o.y, r: clearance }); return o; };
  /** A free spot around (cx, cy) between radius r0 and r1. */
  const spot = (cx: number, cy: number, r0: number, r1: number, clear: number, roadClear = 0, tries = 40): Point | null => {
    for (let i = 0; i < tries; i++) {
      const a = rand() * 6.28, rr = R(r0, r1), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * .8;
      if (blocked(x, y, clear) || (roadClear && roadDist(x, y) < roadClear)) continue;
      return { x, y };
    }
    return null;
  };
  let uid = 0;
  const id = (p: string) => `${p}-${uid++}`;
  const addDecor = (x: number, y: number, kind: DecorKind, color?: string) => decor.push({ x, y, kind, seed: rand(), color: color || spec.decorColors[Math.floor(rand() * spec.decorColors.length)] });

  // ── places
  const villageNames = [...spec.villagerNames];
  const villager = (at: Poi, activity: NpcActivity, near?: Point) => {
    const p = near || spot(at.x, at.y, 60, at.r * .7, 26, 0) || { x: at.x + R(-80, 80), y: at.y + R(-80, 80) };
    const name = villageNames.length ? villageNames.splice(Math.floor(rand() * villageNames.length), 1)[0] : 'Villager';
    const small = activity === 'play';
    const hats: NpcLook['hat'][] = activity === 'farm' ? ['straw', 'straw', 'bonnet'] : activity === 'patrol' ? ['helm'] : ['none', 'cap', 'hood', 'bonnet', 'scarf', 'straw'];
    const look: NpcLook = { skin: SKINS[Math.floor(rand() * SKINS.length)], robe: ROBES[Math.floor(rand() * ROBES.length)], hat: hats[Math.floor(rand() * hats.length)], hatColor: ROBES[Math.floor(rand() * ROBES.length)], hair: HAIRS[Math.floor(rand() * HAIRS.length)], beard: !small && rand() < .25, small };
    const portrait = small ? ['🧒', '👧', '👦'][Math.floor(rand() * 3)] : activity === 'patrol' ? '💂' : activity === 'farm' ? '🧑‍🌾' : ['🧑', '👩', '👨', '👵', '👴', '🧔'][Math.floor(rand() * 6)];
    let route: Point[] | undefined;
    if (activity === 'patrol') route = Array.from({ length: 6 }, (_, i) => ({ x: at.x + Math.cos(i / 6 * 6.28) * at.r * .55, y: at.y + Math.sin(i / 6 * 6.28) * at.r * .45 }));
    const lines = [spec.chatter[Math.floor(rand() * spec.chatter.length)], spec.chatter[Math.floor(rand() * spec.chatter.length)]];
    npcs.push({ id: id('villager'), name, portrait, look, activity, x: p.x, y: p.y, role: 'villager', route, lines, barks: spec.barks });
    solid.insert({ x: p.x, y: p.y, r: 20 });
  };
  const house = (cx: number, cy: number) => {
    const roofs = spec.palette.roof;
    put({ x: cx, y: cy, r: 80, kind: 'house', seed: rand(), w: 74, h: 36, color: roofs[Math.floor(rand() * roofs.length)] }, 120);
    if (rand() < .6) put({ x: cx + R(-80, 80), y: cy + 58, r: 16, kind: rand() < .5 ? 'crate' : 'hay', seed: rand() }, 20);
  };
  const ring = (p: Poi, count: number, r0: number, r1: number, clear: number, fn: (pt: Point, i: number) => void) => {
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 16; k++) {
        const a = (i / count) * 6.28 + R(-.35, .35) + k * .4, rr = R(r0, r1), x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr * .78;
        if (blocked(x, y, clear) || roadDist(x, y) < clear * .9 + 30) continue;
        fn({ x, y }, i); break;
      }
    }
  };
  const fenceRun = (x: number, y: number, len: number, horizontal: boolean) => {
    for (let s = 0; s < len; s += 64) put(horizontal ? { x: x + s, y, r: 6, kind: 'fence', seed: 0, w: 32, h: 6 } : { x, y: y + s, r: 6, kind: 'fence', seed: 1, w: 6, h: 32 }, 30);
  };

  for (const p of spec.pois) {
    switch (p.kind) {
      case 'start': case 'village': {
        const n = p.kind === 'start' ? 3 : 6;
        obj({ id: `well-${p.id}`, kind: 'well', x: p.x, y: p.y, name: 'Village well' }, 0); put({ x: p.x, y: p.y, r: 26, kind: 'well', seed: rand() }, 60);
        ring(p, n, p.r * .45, p.r * .8, 95, pt => house(pt.x, pt.y));
        ring(p, 5, 110, p.r * .5, 14, pt => put({ x: pt.x, y: pt.y, r: 7, kind: 'lamppost', seed: rand() }, 20));
        if (p.kind === 'village') ring(p, 2, 120, 220, 55, pt => put({ x: pt.x, y: pt.y, r: 30, kind: 'stall', seed: rand(), w: 44, h: 18, color: ROBES[Math.floor(rand() * ROBES.length)] }, 60));
        if (p.kind === 'start') { const c = spot(p.x, p.y, 140, 220, 50, 60); if (c) { obj({ id: `fire-${p.id}`, kind: 'campfire', x: c.x, y: c.y, name: 'Campfire' }, 0); put({ x: c.x, y: c.y, r: 20, kind: 'campfire', seed: rand() }, 50); } }
        const extra = p.kind === 'start' ? 2 : 4;
        for (let i = 0; i < extra; i++) villager(p, (['wander', 'sweep', 'hammer', 'play', 'idle', 'wander'] as NpcActivity[])[Math.floor(rand() * 6)]);
        if (p.kind === 'village') villager(p, 'patrol');
        for (let i = 0; i < 60; i++) { const a = rand() * 6.28, rr = R(40, p.r); addDecor(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * .8, rand() < .6 ? 'flower' : 'clover'); }
        break;
      }
      case 'farm': {
        const hx = p.x - p.r * .45, hy = p.y - p.r * .35;
        if (!blocked(hx, hy, 90)) house(hx, hy);
        const mx = p.x + p.r * .5, my = p.y - p.r * .4;
        if (!blocked(mx, my, 60)) put({ x: mx, y: my, r: 44, kind: 'windmill', seed: rand() }, 80);
        const fx = p.x - 200, fy = p.y + 20;
        for (let row = 0; row < 6; row++) for (let c = 0; c < 14; c++) { const x = fx + c * 30 + R(-3, 3), y = fy + row * 36; if (!inPond(ponds, x, y) && roadDist(x, y) > 45) addDecor(x, y, 'crop', spec.palette.accent); }
        fenceRun(fx - 40, fy - 30, 520, true); fenceRun(fx - 40, fy + 230, 520, true);
        solid.insert({ x: fx + 210, y: fy + 100, r: 150 });
        ring(p, 5, p.r * .5, p.r * .9, 22, pt => put({ x: pt.x, y: pt.y, r: 20, kind: 'hay', seed: rand() }, 24));
        villager(p, 'farm', { x: fx + 120, y: fy + 70 }); villager(p, 'farm', { x: fx + 300, y: fy + 150 }); villager(p, 'wander');
        break;
      }
      case 'camp': {
        const c = spot(p.x, p.y, 0, 60, 50, 50) || { x: p.x, y: p.y };
        obj({ id: `fire-${p.id}`, kind: 'campfire', x: c.x, y: c.y, name: 'Campfire' }, 0); put({ x: c.x, y: c.y, r: 20, kind: 'campfire', seed: rand() }, 60);
        ring(p, 3, 150, 240, 50, pt => put({ x: pt.x, y: pt.y, r: 38, kind: 'tent', seed: rand(), color: ROBES[Math.floor(rand() * ROBES.length)] }, 60));
        ring(p, 3, 70, 110, 20, pt => put({ x: pt.x, y: pt.y, r: 12, kind: 'log', seed: rand(), w: 34, h: 10 }, 30));
        ring(p, 3, 180, 300, 20, pt => put({ x: pt.x, y: pt.y, r: 16, kind: 'crate', seed: rand() }, 22));
        villager(p, 'idle');
        break;
      }
      case 'ruins': {
        ring(p, 9, p.r * .45, p.r * .7, 20, pt => put({ x: pt.x, y: pt.y, r: 17, kind: 'pillar', seed: rand() }, 26));
        if (!blocked(p.x, p.y, 30)) put({ x: p.x, y: p.y, r: 26, kind: 'statue', seed: rand() }, 50);
        const c = spot(p.x, p.y, 80, p.r * .4, 30); if (c) obj({ id: `chest-${p.id}`, kind: 'chest', x: c.x, y: c.y, name: 'Old chest' });
        for (let i = 0; i < 40; i++) { const a = rand() * 6.28, rr = R(0, p.r); addDecor(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * .8, 'pebble'); }
        break;
      }
      case 'lake': {
        const pond = ponds.find(q => q.x === p.x && q.y === p.y)!;
        for (let i = 0; i < 90; i++) { const a = rand() * 6.28, e = R(1.02, 1.18); addDecor(pond.x + Math.cos(a) * pond.r * e, pond.y + Math.sin(a) * pond.r * .58 * e, 'reed', '#6f8f4a'); }
        break;
      }
      case 'lair': {
        ring(p, 7, p.r * .4, p.r * .95, 26, pt => put({ x: pt.x, y: pt.y, r: 24, kind: rand() < .6 ? 'deadtree' : 'rock', seed: rand() }, 30));
        const c = spot(p.x, p.y, 0, 80, 30); if (c) obj({ id: `chest-${p.id}`, kind: 'chest', x: c.x, y: c.y, name: 'Hoard chest' });
        break;
      }
      case 'grove': {
        ring(p, 10, p.r * .75, p.r * .95, 30, pt => put({ x: pt.x, y: pt.y, r: 32, kind: spec.trees[0][0] === 'pine' ? 'crystal' : 'mushroom', seed: rand() }, 36));
        for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; addDecor(p.x + Math.cos(a) * 110, p.y + Math.sin(a) * 80, 'shroom'); }
        for (let i = 0; i < 70; i++) { const a = rand() * 6.28, rr = R(0, p.r * .7); addDecor(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * .8, 'flower'); }
        const c = spot(p.x, p.y, 150, p.r * .6, 30); if (c) obj({ id: `chest-${p.id}`, kind: 'chest', x: c.x, y: c.y, name: 'Mossy chest' });
        break;
      }
      case 'shrine': {
        obj({ id: 'shrine', kind: 'shrine', x: p.x, y: p.y, name: spec.shrineName }, 70);
        for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + .78; put({ x: p.x + Math.cos(a) * 150, y: p.y + Math.sin(a) * 110, r: 17, kind: 'pillar', seed: .9 }, 24); }
        break;
      }
      case 'lookout': {
        const tx = p.x + 110, ty = p.y - 60;
        if (!blocked(tx, ty, 60)) put({ x: tx, y: ty, r: 48, kind: 'tower', seed: rand() }, 80);
        ring(p, 3, 150, 260, 20, pt => put({ x: pt.x, y: pt.y, r: 16, kind: 'crate', seed: rand() }, 22));
        break;
      }
      case 'finale': {
        obj({ id: 'finale', kind: 'finale', x: p.x, y: p.y, name: spec.finaleName }, 90);
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; put({ x: p.x + Math.cos(a) * 330, y: p.y + Math.sin(a) * 250, r: 18, kind: 'pillar', seed: .95 }, 26); }
        enemies.push({ id: 'boss', kind: spec.boss, x: p.x - 150, y: p.y - 110, boss: true });
        solid.insert({ x: p.x, y: p.y, r: 300 });
        break;
      }
    }
  }

  // ── signposts where roads leave each place
  for (const p of spec.pois) {
    const outs = edges.filter(e => e.includes(p.id)).map(e => poi(e[0] === p.id ? e[1] : e[0]));
    if (!outs.length) continue;
    const dir = (q: Poi) => { const a = Math.atan2(q.y - p.y, q.x - p.x); return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; };
    const road = edgePaths.get(`${p.id}|${outs[0].id}`)!;
    const at = road.find(pt => d2(pt, p) > p.r * .9) || road[Math.floor(road.length / 3)];
    const s = spot(at.x, at.y, 60, 110, 16) || { x: at.x + 60, y: at.y };
    obj({ id: `sign-${p.id}`, kind: 'sign', x: s.x, y: s.y, name: 'Signpost', text: [`${p.name}.`, ...outs.map(q => `${dir(q)[0].toUpperCase() + dir(q).slice(1)}: ${q.name}`)] }, 20);
  }

  // ── named people
  for (const n of spec.npcs) {
    const p = poi(n.at);
    let x = p.x + (n.dx ?? 0), y = p.y + (n.dy ?? 0);
    if (n.activity === 'fish') { const pond = ponds.reduce((b, q) => d2(q, p) < d2(b, p) ? q : b, ponds[0]); x = pond.x + (n.dx ?? 0); y = pond.y + pond.r * .58 + 34; }
    else if (n.dx === undefined) { const s = spot(p.x, p.y, 70, p.r * .6, 24); if (s) { x = s.x; y = s.y; } }
    const look: NpcLook = { skin: SKINS[0], robe: '#8a6fb0', hat: 'none', hatColor: '#5b5480', hair: HAIRS[0], ...n.look };
    let route: Point[] | undefined;
    if (n.activity === 'travel' && n.to) route = edgePaths.get(`${n.at}|${n.to}`) || [{ x, y }, poi(n.to)];
    if (n.activity === 'chop') put({ x: x + 34, y: y + 4, r: 14, kind: 'stump', seed: rand() }, 16);
    npcs.push({ id: n.id, name: n.name, portrait: n.portrait, look, activity: n.activity, x, y, role: n.role || 'villager', route, lines: n.lines, barks: n.barks });
    solid.insert({ x, y, r: 30 });
  }

  // ── keys, lore, hidden chests, quest items
  spec.keyAt.forEach((pid, i) => { const p = poi(pid), s = spot(p.x, p.y, 20, 140, 30) || { x: p.x, y: p.y + 60 }; obj({ id: `key-${i}`, kind: 'key', x: s.x, y: s.y, name: spec.keyName }); });
  spec.lore.forEach((l, i) => { const p = poi(l.at), s = spot(p.x, p.y, p.r * .3, p.r * .9, 30) || { x: p.x + 100, y: p.y }; obj({ id: `lore-${i}`, kind: 'lore', x: s.x, y: s.y, name: l.name, text: l.text }); });
  for (let i = 0, made = 0; i < 400 && made < 7; i++) {
    const x = R(400, W - 400), y = R(400, H - 400);
    if (roadDist(x, y) < 320 || spec.pois.some(p => d2(p, { x, y }) < p.r + 300) || blocked(x, y, 60)) continue;
    obj({ id: `chest-wild-${made++}`, kind: 'chest', x, y, name: 'Forgotten chest' });
  }
  const questItemName: Partial<Record<ItemIcon, string>> = {};
  for (const q of spec.quests as QuestDef[]) {
    if (q.kind !== 'collect') continue;
    const p = poi(q.near!), far = q.count === 1;
    if (q.icon) questItemName[q.icon] = q.item;
    for (let i = 0; i < q.count; i++) {
      const s = spot(p.x, p.y, far ? p.r * .6 : 120, far ? p.r + 500 : p.r + 380, 24, 0, 80) || { x: p.x + R(-200, 200), y: p.y + R(-200, 200) };
      obj({ id: `${q.id}-item-${i}`, kind: 'questItem', x: s.x, y: s.y, name: q.item || 'Item', questId: q.id, icon: q.icon });
    }
  }

  // ── wilderness: forests shaped by noise, thick around the map edge
  const treeGrid = 88;
  for (let gy = 0; gy < H; gy += treeGrid) for (let gx = 0; gx < W; gx += treeGrid) {
    const x = gx + R(8, treeGrid - 8), y = gy + R(8, treeGrid - 8);
    const edge = Math.min(x, y, W - x, H - y);
    const density = fbm(x, y, spec.seed) + (edge < 380 ? .6 : edge < 700 ? .2 : 0);
    if (density < .56 || rand() > (density - .5) * 2.2) continue;
    const rd = roadDist(x, y);
    if (rd < 80 || spec.pois.some(p => d2(p, { x, y }) < p.r * (p.kind === 'lair' || p.kind === 'grove' ? .6 : 1) + 40)) continue;
    const kind = rand() < .06 ? (rand() < .5 ? 'stump' : 'log') : pickW(rand, spec.trees);
    const r = kind === 'stump' ? 14 : kind === 'log' ? 12 : kind === 'rock' ? R(16, 26) : kind === 'bush' ? R(16, 24) : R(22, 34);
    if (blocked(x, y, r + 14)) continue;
    put(kind === 'log' ? { x, y, r, kind, seed: rand(), w: 34, h: 10 } : { x, y, r, kind, seed: rand() }, r + 12);
  }
  // scattered lone trees and rocks in the open
  for (let i = 0; i < 520; i++) {
    const x = R(150, W - 150), y = R(150, H - 150), kind = pickW(rand, spec.trees), r = kind === 'rock' ? R(16, 26) : R(20, 32);
    if (roadDist(x, y) < 90 || spec.pois.some(p => d2(p, { x, y }) < p.r + 30) || blocked(x, y, r + 50)) continue;
    put({ x, y, r, kind, seed: rand() }, r + 12);
  }

  // ── ground detail
  for (let i = 0; i < 26000; i++) {
    const x = R(20, W - 20), y = R(20, H - 20);
    if (inPond(ponds, x, y, 6)) continue;
    const bloom = fbm(x + 5000, y, spec.seed + 3);
    let kind = pickW(rand, spec.decorKinds);
    if (kind === 'grass' && bloom > .62 && rand() < .7) kind = 'flower';
    if (kind !== 'pebble' && roadIx.dist(x, y, 60) < 44) continue;
    addDecor(x, y, kind);
  }
  decor.sort((a, b) => a.y - b.y);

  // ── glow pods
  const pods: Point[] = [];
  for (let i = 0; i < 900 && pods.length < 46; i++) {
    const x = R(300, W - 300), y = R(300, H - 300);
    if (blocked(x, y, 40) || pods.some(p => d2(p, { x, y }) < 500)) continue;
    pods.push({ x, y }); solid.insert({ x, y, r: 34 });
  }

  // ── creatures: lair packs plus roaming groups in the wild
  const safe = spec.pois.filter(p => p.kind === 'start' || p.kind === 'village' || p.kind === 'farm');
  for (const p of spec.pois.filter(q => q.kind === 'lair')) {
    for (let i = 0; i < 8; i++) { const s = spot(p.x, p.y, 90, p.r * .9, 30, 0) || { x: p.x + R(-150, 150), y: p.y + R(-150, 150) }; enemies.push({ id: id(`e-${p.id}`), kind: pickW(rand, spec.enemyKinds), x: s.x, y: s.y, elite: i === 0 }); }
  }
  for (let i = 0, packs = 0; i < 600 && packs < 20; i++) {
    const x = R(400, W - 400), y = R(400, H - 400);
    if (safe.some(p => d2(p, { x, y }) < p.r + 650) || d2({ x, y }, spec.pois[0]) < 1400 || blocked(x, y, 40)) continue;
    if (enemies.some(e => d2(e, { x, y }) < 650)) continue;
    const n = 2 + Math.floor(rand() * 3), kind = pickW(rand, spec.enemyKinds);
    for (let k = 0; k < n; k++) { const s = spot(x, y, 0, 160, 26) || { x, y }; enemies.push({ id: id('e-wild'), kind: rand() < .7 ? kind : pickW(rand, spec.enemyKinds), x: s.x, y: s.y, elite: k === 0 && rand() < .2 }); }
    packs++;
  }

  // ── critters
  for (let i = 0, n = 0; i < 2000 && n < 90; i++) {
    const kind = pickW(rand, spec.critters);
    let x = R(200, W - 200), y = R(200, H - 200);
    if (kind === 'duck' || kind === 'frog') {
      const p = ponds[Math.floor(rand() * ponds.length)], a = rand() * 6.28, e = kind === 'duck' ? R(.2, .75) : R(1.05, 1.25);
      x = p.x + Math.cos(a) * p.r * e; y = p.y + Math.sin(a) * p.r * .58 * e;
    } else if (blocked(x, y, 20) || d2({ x, y }, spec.pois[0]) < 300) continue;
    critters.push({ kind, x, y }); n++;
  }

  const start = spec.pois[0];
  return {
    ...spec, width: W, height: H, spawn: { x: start.x + 60, y: start.y + 90 },
    roads, obstacles, decor, pods, ponds, enemies, critters, npcs, objects,
  } as WorldDefinition;
}
