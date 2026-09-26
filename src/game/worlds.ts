import type { Decor, DecorKind, EnemyKind, EnemySeed, LevelId, Obstacle, ObstacleKind, Point, Pond, WorldDefinition, WorldObject } from './types';

export const LEVEL_ORDER: LevelId[] = ['meadow', 'woods', 'summit'];
const W = 3000, H = 2100;

const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const obj = (id: string, kind: WorldObject['kind'], x: number, y: number, name: string, extra: Partial<WorldObject> = {}): WorldObject => ({ id, kind, x, y, name, ...extra });

// Shared story layout: every chapter follows the same readable arc from the camp (top-left) to the finale (bottom-right).
const L = {
  guide: { x: 470, y: 300 }, helper: { x: 500, y: 640 }, courier: { x: 330, y: 1510 },
  keys: [{ x: 730, y: 360 }, { x: 1410, y: 590 }, { x: 2400, y: 850 }],
  collect: [{ x: 790, y: 1160 }, { x: 1570, y: 1320 }, { x: 2380, y: 1510 }],
  item: { x: 980, y: 1660 }, shrine: { x: 760, y: 930 }, finale: { x: 2690, y: 1740 }, boss: { x: 2540, y: 1640 },
};
const route: Point[] = [{ x: 260, y: 260 }, { x: 720, y: 370 }, { x: 980, y: 680 }, { x: 1460, y: 600 }, { x: 1780, y: 880 }, { x: 2200, y: 930 }, { x: 2650, y: 1720 }];

function distToRoute(p: Point) {
  let best = Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

function scatterObstacles(seed: number, count: number, kinds: Array<[ObstacleKind, number]>, avoid: Point[], ponds: Pond[]): Obstacle[] {
  const rand = rng(seed), out: Obstacle[] = [];
  const total = kinds.reduce((s, [, w]) => s + w, 0);
  for (let tries = 0; out.length < count && tries < count * 20; tries++) {
    const x = 90 + rand() * (W - 180), y = 100 + rand() * (H - 200);
    if (avoid.some(p => Math.hypot(p.x - x, p.y - y) < 165)) continue;
    if (ponds.some(p => Math.hypot(p.x - x, (p.y - y) * 1.6) < p.r + 50)) continue;
    if (distToRoute({ x, y }) < 70) continue;
    if (out.some(p => Math.hypot(p.x - x, p.y - y) < 105)) continue;
    let pick = rand() * total, kind: ObstacleKind = kinds[0][0];
    for (const [k, w] of kinds) { if ((pick -= w) <= 0) { kind = k; break; } }
    out.push({ x, y, r: 18 + rand() * 14, kind, seed: rand() });
  }
  // A ring of border trees makes the map edge feel like a forest rather than a wall.
  const edge = kinds[0][0];
  for (let x = 40; x < W; x += 95) { out.push({ x, y: 30 + rand() * 20, r: 26 + rand() * 8, kind: edge, seed: rand() }); out.push({ x: x + 40, y: H - 30 - rand() * 20, r: 26 + rand() * 8, kind: edge, seed: rand() }); }
  for (let y = 120; y < H - 60; y += 95) { out.push({ x: 25 + rand() * 20, y, r: 26 + rand() * 8, kind: edge, seed: rand() }); out.push({ x: W - 25 - rand() * 20, y: y + 40, r: 26 + rand() * 8, kind: edge, seed: rand() }); }
  return out;
}

function scatterDecor(seed: number, count: number, kinds: Array<[DecorKind, number]>, colors: string[], ponds: Pond[]): Decor[] {
  const rand = rng(seed), out: Decor[] = [];
  const total = kinds.reduce((s, [, w]) => s + w, 0);
  for (let i = 0; i < count; i++) {
    const x = 30 + rand() * (W - 60), y = 30 + rand() * (H - 60);
    if (ponds.some(p => Math.hypot(p.x - x, (p.y - y) * 1.7) < p.r + 8)) continue;
    let pick = rand() * total, kind: DecorKind = kinds[0][0];
    for (const [k, w] of kinds) { if ((pick -= w) <= 0) { kind = k; break; } }
    if (kind !== 'pebble' && distToRoute({ x, y }) < 40) continue;
    out.push({ x, y, kind, seed: rand(), color: colors[Math.floor(rand() * colors.length)] });
  }
  return out.sort((a, b) => a.y - b.y);
}

function scatterPods(seed: number, count: number, obstacles: Obstacle[], avoid: Point[]): Point[] {
  const rand = rng(seed), out: Point[] = [];
  for (let tries = 0; out.length < count && tries < 800; tries++) {
    const x = 200 + rand() * (W - 400), y = 200 + rand() * (H - 400);
    if (obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 40)) continue;
    if (avoid.some(p => Math.hypot(p.x - x, p.y - y) < 120) || out.some(p => Math.hypot(p.x - x, p.y - y) < 260)) continue;
    out.push({ x, y });
  }
  return out;
}

function enemies(prefix: string, groups: Array<[EnemyKind, number[][]]>, boss: EnemyKind): EnemySeed[] {
  const out: EnemySeed[] = [];
  let n = 0;
  for (const [kind, spots] of groups) for (const [x, y] of spots) out.push({ id: `${prefix}-${kind}-${n++}`, kind, x, y });
  out.push({ id: `${prefix}-boss`, kind: boss, x: L.boss.x, y: L.boss.y, boss: true });
  return out;
}

const avoidAll: Point[] = [{ x: 260, y: 260 }, L.guide, L.helper, L.courier, ...L.keys, ...L.collect, L.item, L.shrine, L.finale, L.boss, { x: 2620, y: 1700 }];

function build(def: Omit<WorldDefinition, 'obstacles' | 'decor' | 'pods' | 'route' | 'width' | 'height' | 'spawn'> & { seed: number; treeKinds: Array<[ObstacleKind, number]>; decorKinds: Array<[DecorKind, number]>; decorColors: string[] }): WorldDefinition {
  const { seed, treeKinds, decorKinds, decorColors, ...rest } = def;
  const obstacles = scatterObstacles(seed, 64, treeKinds, avoidAll, def.ponds);
  return {
    ...rest, width: W, height: H, spawn: { x: 260, y: 260 }, route,
    obstacles, decor: scatterDecor(seed + 1, 1500, decorKinds, decorColors, def.ponds), pods: scatterPods(seed + 2, 16, obstacles, avoidAll),
  };
}

export const WORLDS: Record<LevelId, WorldDefinition> = {
  meadow: build({
    id: 'meadow', chapter: 1, title: 'Sunpetal Meadow', subtitle: 'The Broken Beacon', region: 'Sunpetal Valley', seed: 17,
    palette: { ground: '#7fa05a', alternate: '#8fb065', path: '#d8c48e', pathEdge: '#a8915f', accent: '#f5cd5c', water: '#58a7b4', waterDeep: '#3d7f8f', foliage: ['#35593f', '#5d8a4c', '#a3c46a'], trunk: '#6f5337', rock: '#8c8f80', pod: '#f2b84b' },
    darkness: 0, ambient: 'petals', spell: 'sunfire',
    ponds: [{ x: 1780, y: 450, r: 175 }, { x: 720, y: 1500, r: 125 }, { x: 2200, y: 1420, r: 135 }],
    treeKinds: [['tree', 6], ['bush', 3], ['rock', 2]], decorKinds: [['grass', 10], ['flower', 5], ['pebble', 1]], decorColors: ['#f7d774', '#f2a1b8', '#ffffff', '#c7a6f2', '#ff9b73'],
    objects: [
      obj('guide', 'npc', L.guide.x, L.guide.y, 'Bridgekeeper Tamsin', { role: 'guide', color: '#d99857', portrait: '🧑‍🌾' }),
      obj('helper', 'npc', L.helper.x, L.helper.y, 'Elder Rowan', { role: 'helper', color: '#818ca8', portrait: '🧙🏼' }),
      obj('courier', 'npc', L.courier.x, L.courier.y, 'Pip the Courier', { role: 'courier', color: '#c16d59', portrait: '🐿️' }),
      ...L.keys.map((p, i) => obj(`key-${i}`, 'key', p.x, p.y, 'Sun-crystal')),
      ...L.collect.map((p, i) => obj(`col-${i}`, 'collectible', p.x, p.y, 'Glowbug')),
      obj('item', 'item', L.item.x, L.item.y, 'Silver bell'),
      obj('shrine', 'shrine', L.shrine.x, L.shrine.y, 'Sunfire Tome'),
      obj('finale', 'finale', L.finale.x, L.finale.y, 'Meadow Beacon'),
    ],
    enemies: enemies('meadow', [['gloomling', [[800, 720], [1260, 930], [1960, 520], [2240, 1230], [1430, 1550], [560, 1030], [2010, 1680]]], ['thornling', [[1120, 400], [1840, 1040], [680, 1370]]]], 'mossback'),
    zoneLabels: [{ x: 410, y: 210, name: 'Bridgekeeper’s Rest' }, { x: 1160, y: 640, name: 'Sunpetal Fields' }, { x: 1920, y: 1180, name: 'Old Stone Garden' }, { x: 2510, y: 1560, name: 'The Beacon Rise' }],
    script: {
      keyLabel: 'Sun-crystals', collectLabel: 'Glowbugs', itemLabel: 'Pip’s silver bell', bossName: 'Mossback', bossTitle: 'Ancient Guardian of the Rise', finaleName: 'Meadow Beacon',
      guide: {
        intro: n => ['The beacon went dark the night the star fell. Three sun-crystals can wake it again.', `You carry ${n} of 3. Follow the glowing arrow — the fox and I marked the way.`, 'There is an old tome in the fields that teaches Sunfire. You will want it.'],
        ready: ['All three crystals! The Beacon Rise is open.', 'Mossback guards it. Watch the ground glow before its slam, and dodge the boulders it hurls.'],
      },
      helper: { ask: ['The night paths are hard to see. Could you catch three glowbugs for me?', 'Gentle hands. They are the tiny floating lights.'], thanks: ['All three! They will guide travelers home.', 'Take this heartwood charm — you feel sturdier already. (+1 max heart)'], done: ['The glowbugs hum happily in their jar.'] },
      courier: { ask: ['I dropped my silver bell on the far side of the meadow!', 'It has a tiny star scratched into it.'], thanks: ['My bell! You found it!', 'A star biscuit for you — your magic flows faster now.'], done: ['The Beacon Rise is just beyond the old stone garden.'] },
      shrine: { learn: ['The tome flips open by itself, pages blazing gold.', 'You learned SUNFIRE! Press R to hurl an exploding sun orb.'], again: ['The tome glows warmly. Sunfire is yours.'] },
      finale: { locked: ['The beacon is dim. Three sun-crystals are needed before its guardian stirs.'], guarded: ['Mossback is here. Defeat the guardian to restore the beacon.'], done: ['The beacon blazes gold! Across the valley, a second light answers from Whisperroot Woods.'] },
      pickup: { key: 'Sun-crystal found! {n}/3', collect: 'Glowbug caught gently. {n}/3', item: 'You found the silver bell. Return it to Pip.' },
      sealed: 'Mossback is sealed in stone. Find the three sun-crystals first.', tip: 'If the ground glows, move! Dash (Shift) makes you untouchable for a heartbeat.',
      victory: { title: 'The beacon shines again.', text: 'Mossback returns to its quiet grove, and a second light glimmers beyond the hills. Whisperroot Woods is calling.' },
    },
  }),
  woods: build({
    id: 'woods', chapter: 2, title: 'Whisperroot Woods', subtitle: 'The Bell Beneath the Roots', region: 'Whisperroot Wilds', seed: 72,
    palette: { ground: '#4d6a50', alternate: '#587757', path: '#ad9c72', pathEdge: '#7a7153', accent: '#b6df91', water: '#3f7580', waterDeep: '#2b5560', foliage: ['#1f3a2c', '#355c3e', '#6f9a5c'], trunk: '#553f2d', rock: '#6f7568', pod: '#9fe3c9' },
    darkness: .42, ambient: 'leaves', spell: 'shield',
    ponds: [{ x: 1760, y: 460, r: 175 }, { x: 720, y: 1500, r: 115 }, { x: 2190, y: 1400, r: 145 }],
    treeKinds: [['tree', 6], ['mushroom', 2], ['bush', 2], ['rock', 1]], decorKinds: [['grass', 6], ['fern', 5], ['shroom', 3], ['pebble', 1]], decorColors: ['#9fe3c9', '#f0c47a', '#d6a3f0', '#86d4ff'],
    objects: [
      obj('guide', 'npc', L.guide.x, L.guide.y, 'Mosskeeper Oda', { role: 'guide', color: '#728f5a', portrait: '🧝' }),
      obj('helper', 'npc', L.helper.x, L.helper.y, 'Old Bellkeeper', { role: 'helper', color: '#9c7860', portrait: '🧓' }),
      obj('courier', 'npc', L.courier.x, L.courier.y, 'Pip the Courier', { role: 'courier', color: '#c16d59', portrait: '🐿️' }),
      ...L.keys.map((p, i) => obj(`key-${i}`, 'key', p.x, p.y, 'Root rune')),
      ...L.collect.map((p, i) => obj(`col-${i}`, 'collectible', p.x, p.y, 'Moon moth')),
      obj('item', 'item', L.item.x, L.item.y, 'Courier satchel'),
      obj('shrine', 'shrine', L.shrine.x, L.shrine.y, 'Moss Shield Shrine'),
      obj('finale', 'finale', L.finale.x, L.finale.y, 'Ancient Root Bell'),
    ],
    enemies: enemies('woods', [['gloomling', [[800, 730], [1260, 930], [1970, 520], [2250, 1220], [1420, 1550], [560, 1030], [2010, 1680], [1740, 360]]], ['thornling', [[1110, 410], [1830, 1040], [680, 1370], [2290, 530]]]], 'brambleWarden'),
    zoneLabels: [{ x: 410, y: 200, name: 'Mosskeeper’s Camp' }, { x: 1160, y: 650, name: 'Whisperroot Trail' }, { x: 1920, y: 1180, name: 'Root-Cave Approach' }, { x: 2500, y: 1560, name: 'The Old Bell' }],
    script: {
      keyLabel: 'Root runes', collectLabel: 'Moon moths', itemLabel: 'Pip’s satchel', bossName: 'Bramble Warden', bossTitle: 'Thorn-Crowned Keeper of Roots', finaleName: 'Ancient Root Bell',
      guide: {
        intro: n => ['Welcome to Whisperroot. The ancient bell is strangled by roots.', `Three root runes can wake its guardian. You have ${n} of 3.`, 'Find the moss shrine first — its shield turns thorns back on those who throw them.'],
        ready: ['The runes are singing. The Bramble Warden stirs by the bell.', 'It throws rings of thorns and sends roots racing through the soil. Keep moving!'],
      },
      helper: { ask: ['My moon moths fled into the dark. Without them the lanterns won’t catch.', 'Three of them. Please.'], thanks: ['They’re home! Listen to them hum.', 'Take this bark-woven vest. (+1 max heart)'], done: ['The lantern tree glows again.'] },
      courier: { ask: ['I lost my satchel somewhere near the root-cave!', 'Red strap, very loud buckle.'], thanks: ['My satchel! The biscuits survived!', 'Have one — your magic will flow faster.'], done: ['The ancient bell is further east.'] },
      shrine: { learn: ['Moss curls around your arms and hardens into a glowing ward.', 'You learned MOSS SHIELD! Press F — it blocks harm and reflects projectiles.'], again: ['The shrine hums softly.'] },
      finale: { locked: ['Three root runes are needed to wake the guardian.'], guarded: ['The Bramble Warden blocks the bell.'], done: ['The ancient bell rings through every root. Shadows drift away as petals.', 'High above, the fallen star flickers on Starfall Summit…'] },
      pickup: { key: 'Root rune awakened. {n}/3', collect: 'A moon moth follows your lantern. {n}/3', item: 'Courier satchel recovered. It smells of apple cake.' },
      sealed: 'The Warden is wrapped in sleeping roots. Wake the three runes first.', tip: 'Moss Shield reflects thorns. Raise it just as a ring of thorns flies at you!',
      victory: { title: 'The bell rings through the valley.', text: 'The roots loosen and the woods breathe again. But high on Starfall Summit, the fallen star has gone hollow and dark.' },
    },
  }),
  summit: build({
    id: 'summit', chapter: 3, title: 'Starfall Summit', subtitle: 'The Hollow Star', region: 'The Silver Heights', seed: 131,
    palette: { ground: '#3e4a6b', alternate: '#46527a', path: '#8f93b8', pathEdge: '#62678c', accent: '#c9b6ff', water: '#5a6fc0', waterDeep: '#34408a', foliage: ['#1c2b45', '#2e4a63', '#6a93a8'], trunk: '#3c3346', rock: '#6f7493', pod: '#c9b6ff' },
    darkness: .6, ambient: 'stars', spell: 'starfall',
    ponds: [{ x: 1760, y: 460, r: 165 }, { x: 720, y: 1500, r: 120 }, { x: 2190, y: 1400, r: 140 }],
    treeKinds: [['pine', 6], ['crystal', 3], ['rock', 2]], decorKinds: [['grass', 4], ['shard', 3], ['pebble', 2], ['flower', 2]], decorColors: ['#c9b6ff', '#8ee8ff', '#ffffff', '#ffd6f5'],
    objects: [
      obj('guide', 'npc', L.guide.x, L.guide.y, 'Sky-warden Ilsa', { role: 'guide', color: '#6c78b8', portrait: '🧝‍♀️' }),
      obj('helper', 'npc', L.helper.x, L.helper.y, 'Astronomer Vale', { role: 'helper', color: '#8a6fb0', portrait: '🔭' }),
      obj('courier', 'npc', L.courier.x, L.courier.y, 'Pip the Courier', { role: 'courier', color: '#c16d59', portrait: '🐿️' }),
      ...L.keys.map((p, i) => obj(`key-${i}`, 'key', p.x, p.y, 'Star shard')),
      ...L.collect.map((p, i) => obj(`col-${i}`, 'collectible', p.x, p.y, 'Star wisp')),
      obj('item', 'item', L.item.x, L.item.y, 'Brass lens'),
      obj('shrine', 'shrine', L.shrine.x, L.shrine.y, 'Starfall Altar'),
      obj('finale', 'finale', L.finale.x, L.finale.y, 'Star Cradle'),
    ],
    enemies: enemies('summit', [['wisp', [[800, 730], [1960, 520], [1420, 1550], [2010, 1680], [1740, 360], [1200, 1200]]], ['gloomling', [[1260, 930], [2250, 1220], [560, 1030], [1650, 800]]], ['thornling', [[1110, 410], [1830, 1040], [680, 1370], [2290, 530]]]], 'hollowStar'),
    zoneLabels: [{ x: 410, y: 200, name: 'Warden’s Lookout' }, { x: 1160, y: 650, name: 'Silver Switchbacks' }, { x: 1920, y: 1180, name: 'Crystal Hollow' }, { x: 2500, y: 1560, name: 'The Star Cradle' }],
    script: {
      keyLabel: 'Star shards', collectLabel: 'Star wisps', itemLabel: 'Pip’s brass lens', bossName: 'The Hollow Star', bossTitle: 'Heart of the Fallen Light',
      finaleName: 'Star Cradle',
      guide: {
        intro: n => ['You made it to the Summit. The fallen star was hollowed out by the dark — and now it hunts.', `Three star shards can crack its shell. You carry ${n} of 3.`, 'The altar in the switchbacks teaches Starfall. Use the sky against it.'],
        ready: ['The shards are bright enough. The Hollow Star waits at the Cradle.', 'It spirals void-light, rains meteors, and blinks right next to you. Stay brave.'],
      },
      helper: { ask: ['Three star wisps escaped my telescope. Without them I cannot chart the way home.', 'They drift, glittering. Catch them for me?'], thanks: ['Wonderful! The constellations make sense again.', 'Wear this starsilver cloak. (+1 max heart)'], done: ['The stars align nicely tonight.'] },
      courier: { ask: ['I climbed all this way and dropped my brass lens!', 'It rolled toward the crystal hollow.'], thanks: ['My lens! Now I can see the whole valley!', 'Last biscuit, just for you. Your magic flows faster.'], done: ['I’ll deliver the news of your victory. Soon!'] },
      shrine: { learn: ['The altar opens to the sky. A star answers your call.', 'You learned STARFALL! Press T to rain stars on every nearby foe.'], again: ['The altar glitters like a tiny night sky.'] },
      finale: { locked: ['The Cradle is cold. Three star shards are needed.'], guarded: ['The Hollow Star circles the Cradle. Defeat it!'], done: ['You lay the shards into the Cradle. The star remembers its light and rises home.', 'Every beacon in the valley blazes at once.'] },
      pickup: { key: 'Star shard gathered. {n}/3', collect: 'A star wisp twirls around you. {n}/3', item: 'You found the brass lens. Pip will be thrilled.' },
      sealed: 'The Hollow Star hides behind a void shell. Gather three star shards first.', tip: 'When stars fall on you, dash out of their circles. Starfall (T) turns the sky on your enemies.',
      victory: { title: 'The star rises home.', text: 'The Hollow Star shines whole again and returns to the sky. Mira and the fox watch every light in the valley wake at once.' },
    },
  }),
};
