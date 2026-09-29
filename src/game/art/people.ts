// Villagers, captives and cutscene actors as paper puppets. A villager's look (skin, robe, hat, hair) comes from the
// story; their build, outfit and hairstyle are picked from their id, so every town has short and tall, round and slim
// people, in dresses, coats, aprons and tunics.
import { hash, shade } from './color';
import type { Build, Figure, HairStyle, Hooks, Joints, Outfit } from './rig';
import type { NpcLook } from '../types';

const seedOf = (id: string) => { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 100000; };
const cache = new Map<string, Figure>();

export function villagerFigure(id: string, L: NpcLook): Figure {
  const key = `${id}|${L.robe}|${L.hat}|${L.hatColor}|${L.hair}|${L.skin}|${L.beard ? 1 : 0}|${L.small ? 1 : 0}`;
  const hit = cache.get(key); if (hit) return hit;
  const s = seedOf(id), r = (n: number) => hash(s + n * 17.31);
  const build: Build = L.small ? 'child' : (['slim', 'round', 'tall', 'stout', 'slim', 'round'] as Build[])[Math.floor(r(1) * 6)];
  const outfit: Outfit = L.hat === 'helm' ? (r(2) > .4 ? 'armor' : 'coat') : L.hat === 'wizard' ? 'robe' : L.hat === 'bonnet' ? (r(2) > .5 ? 'dress' : 'apron')
    : L.hat === 'straw' ? (r(2) > .5 ? 'apron' : 'tunic') : L.hat === 'hood' ? (r(2) > .5 ? 'coat' : 'robe') : (['tunic', 'coat', 'dress', 'apron', 'tunic'] as Outfit[])[Math.floor(r(2) * 5)];
  const bald = L.beard && r(3) > .6;
  const hairStyle: HairStyle = bald ? 'bald' : L.small ? (['bob', 'pony', 'curly', 'spiky', 'braid'] as HairStyle[])[Math.floor(r(3) * 5)]
    : (['short', 'bob', 'bun', 'long', 'curly', 'swept', 'pony', 'short'] as HairStyle[])[Math.floor(r(3) * 8)];
  const legs = ['#5a4a3e', '#4a4a5a', '#6a5040', '#3e4a5a'][Math.floor(r(4) * 4)];
  const f: Figure = {
    skin: L.skin, hair: L.hair, hairStyle, build, outfit,
    top: L.robe, trim: r(5) > .5 ? shade(L.robe, .35) : undefined, sleeves: r(6) > .7 ? shade(L.robe, -.12) : undefined,
    legs, boots: ['#4b3025', '#3a2a24', '#5a3a28'][Math.floor(r(7) * 3)],
    belt: outfit === 'tunic' || outfit === 'coat' || outfit === 'armor' ? (r(8) > .5 ? '#5a3a24' : '#3f2f28') : undefined,
    apron: outfit === 'apron' ? (r(9) > .5 ? '#f4ecd8' : '#e8dcc0') : undefined,
    scarf: L.hat === 'scarf' ? L.hatColor : undefined,
    hat: L.hat, hatColor: L.hatColor, hatTrim: L.hat === 'straw' ? shade(L.hatColor, -.35) : undefined,
    beard: L.beard ? (L.hair === '#e8e2d0' || L.hair === '#8a8a8a' ? '#e8e2d0' : L.hair) : undefined,
    brows: r(10) > .5, freckles: L.small ? r(11) > .4 : r(11) > .85,
    cape: outfit === 'robe' && r(12) > .6 ? shade(L.robe, -.2) : undefined,
  };
  cache.set(key, f); return f;
}

/** The tools villagers work with, held in the front hand. */
export function toolHooks(activity: string): Hooks {

  switch (activity) {
    case 'chop': return { held: (g, j) => tool(g, j, 26, g2 => { g2.fillStyle = '#b8bcc4'; g2.beginPath(); g2.moveTo(0, -26); g2.lineTo(9, -30); g2.lineTo(9, -18); g2.closePath(); g2.fill(); }) };
    case 'hammer': return { held: (g, j) => tool(g, j, 20, g2 => { g2.fillStyle = '#7a7d86'; g2.fillRect(-5, -24, 11, 7); }) };
    case 'farm': return { held: (g, j) => tool(g, j, 28, g2 => { g2.fillStyle = '#8a8f9a'; g2.fillRect(-1, -29, 10, 4); }) };
    case 'sweep': return { held: (g, j) => tool(g, j, 30, g2 => { g2.fillStyle = '#c9a44c'; g2.beginPath(); g2.moveTo(-5, 0); g2.lineTo(5, 0); g2.lineTo(8, 11); g2.lineTo(-8, 11); g2.closePath(); g2.fill(); }, true) };
    case 'fish': return { held: (g, j) => tool(g, j, 34, () => {}) };
    case 'patrol': return { held: (g, j) => tool(g, j, 40, g2 => { g2.fillStyle = '#b8bcc4'; g2.beginPath(); g2.moveTo(-3, -40); g2.lineTo(0, -49); g2.lineTo(3, -40); g2.closePath(); g2.fill(); }, false, true) };
    case 'travel': return { behind: (g, j) => { if (j.facing === 'front') return; const x = j.facing === 'back' ? 0 : -10; g.fillStyle = '#8a5a3a'; g.beginPath(); g.roundRect(x - 7, -16, 14, 20, 4); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(x - 8, -18, 16, 5); } };
  }
  return {};
}
/** A stick held in the hand along the arm's direction (upright for a spear), with a head drawn by `head`. */
function tool(g: CanvasRenderingContext2D, j: Joints, len: number, head: (g: CanvasRenderingContext2D) => void, down = false, upright = false) {
  g.save(); g.translate(j.handF.x, j.handF.y);
  g.rotate(upright ? 0 : j.angF + (down ? -Math.PI / 2 : Math.PI / 2));
  g.strokeStyle = '#6f5337'; g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, upright ? 14 : 4); g.lineTo(0, -len); g.stroke();
  if (down) { g.rotate(Math.PI); g.translate(0, -len); }
  head(g);
  g.restore();
}
