// Art lab (dev only, open /lab.html#people): every asset of the paper look side by side, to judge and test the style.
import { Cutter, STICKER, grainPattern } from '../game/art/cutout';
import { FIGURE_BOX, drawFigure, type Facing, type Pose } from '../game/art/rig';
import { heroFigure, heroHooks } from '../game/art/heroes';
import { villagerFigure } from '../game/art/people';
import type { HeroId, NpcLook } from '../game/types';

const canvas = document.getElementById('lab') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const cut = new Cutter();
const dpr = Math.min(2, window.devicePixelRatio || 1);
const W = 1280, H = 720;
canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;

function page(color: string) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = .5; ctx.fillStyle = grainPattern(ctx); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
}
function shadowAt(x: number, y: number, rx: number) { ctx.fillStyle = 'rgba(40,24,40,.22)'; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .34, 0, 0, Math.PI * 2); ctx.fill(); }
function label(x: number, y: number, text: string) { ctx.fillStyle = '#3a2a30'; ctx.font = '700 12px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, x, y); }

const HEROES: HeroId[] = ['mira', 'kael', 'lyra', 'riven', 'wren'];
const FACES: Array<[Facing, 1 | -1]> = [['front', 1], ['side', 1], ['back', 1], ['side', -1]];
const VILLAGERS: Array<[string, NpcLook]> = [
  ['tamsin', { skin: '#f0c8a2', robe: '#d99857', hat: 'straw', hatColor: '#d9b45a', hair: '#6b3f2a' }],
  ['rowan', { skin: '#f0c8a2', robe: '#818ca8', hat: 'wizard', hatColor: '#5b5480', hair: '#e8e2d0', beard: true }],
  ['maren', { skin: '#e8b890', robe: '#7a9a5a', hat: 'bonnet', hatColor: '#e8e2d0', hair: '#6b3f2a' }],
  ['wynne', { skin: '#8a5a3a', robe: '#6f8fb8', hat: 'cap', hatColor: '#3f5a8a', hair: '#2a1a14' }],
  ['bram', { skin: '#f0c8a2', robe: '#a0785a', hat: 'straw', hatColor: '#d9b45a', hair: '#6b3f2a', beard: true }],
  ['brannoc', { skin: '#c89070', robe: '#8a4a3a', hat: 'helm', hatColor: '#9aa0aa', hair: '#3a2a20', beard: true }],
  ['pell', { skin: '#f0c8a2', robe: '#3f7a6a', hat: 'scarf', hatColor: '#c9a24c', hair: '#a8502e' }],
  ['tilly', { skin: '#f0c8a2', robe: '#f2a1b8', hat: 'none', hatColor: '#000', hair: '#b8743c', small: true }],
  ['garrick', { skin: '#d8a880', robe: '#556b3a', hat: 'hood', hatColor: '#3f4f2a', hair: '#4a3020', beard: true }],
  ['pip', { skin: '#f0c8a2', robe: '#c16d59', hat: 'ears', hatColor: '#a0522d', hair: '#8a4a2a', small: true }],
  ['ilse', { skin: '#f6dcc8', robe: '#6a5a8a', hat: 'bonnet', hatColor: '#3f3560', hair: '#8a8a8a' }],
  ['tom', { skin: '#f0c8a2', robe: '#e8e2d0', hat: 'cap', hatColor: '#ffffff', hair: '#6b3f2a' }],
];

function figure(x: number, y: number, draw: (g: CanvasRenderingContext2D) => void, s = 1) {
  shadowAt(x, y + 22 * s, 17 * s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  cut.stamp(ctx, 0, 0, FIGURE_BOX, dpr * s, STICKER, draw);
  ctx.restore();
}

function people(t: number) {
  page('#e9dcbf');
  HEROES.forEach((h, row) => {
    FACES.forEach(([facing, dir], i) => {
      const x = 90 + i * 110, y = 70 + row * 128, moving = i % 2 === 1;
      const pose: Pose = { facing, dir, walk: t * 10, moving, t, arm: 'idle', seed: row };
      figure(x, y, g => drawFigure(g, heroFigure(h, {}), pose, heroHooks(h, {}, 0, t)));
    });
    const acts: Pose['arm'][] = h === 'kael' ? ['swing'] : h === 'riven' ? ['thrust'] : h === 'wren' ? ['draw'] : ['raise'];
    const k = (t * 1.5) % 1;
    figure(540, 70 + row * 128, g => drawFigure(g, heroFigure(h, {}), { facing: 'side', dir: 1, walk: 0, moving: false, t, arm: acts[0], k }, heroHooks(h, {}, k, t, { bowDraw: Math.sin(k * Math.PI) })));
    label(540, 70 + row * 128 + 52, h);
  });
  VILLAGERS.forEach(([id, L], i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 700 + col * 140, y = 110 + row * 190;
    const facing: Facing = (['front', 'side', 'front', 'back'] as Facing[])[(i + row) % 4];
    figure(x, y, g => drawFigure(g, villagerFigure(id, L), { facing, dir: 1, walk: t * 8, moving: i % 3 === 0, t, seed: i }), 1.4);
    label(x, y + 70, id);
  });
}

const scenes: Record<string, (t: number) => void> = { people };
function frame(now: number) {
  const scene = scenes[location.hash.slice(1)] || people;
  scene(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
