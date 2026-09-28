import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RARITY } from '../game/gear';
import type { GearItem, GearSlot, HeroId } from '../game/types';

// The 3D hero viewer used on the character select screen and the character sheet. Both heroes are built from simple
// shapes in the colours of their in-game sprites, stand on a rune pedestal, breathe, and turn when dragged.

export type Worn = Partial<Record<GearSlot, GearItem>>;
export type StageMode = 'select' | 'sheet';
export type Stage = { setHero(hero: HeroId): void; setGear(gear: Worn): void; dispose(): void };

const ACCENT: Record<HeroId, { rim: number; rune: number; mote: number }> = {
  mira: { rim: 0xa78bfa, rune: 0xffd35c, mote: 0xfff1b8 },
  kael: { rim: 0xff8a4a, rune: 0xffb35c, mote: 0xffd0a0 },
};

type Model = {
  group: THREE.Group; cape: THREE.Mesh; capeBase: Float32Array; glow?: THREE.Mesh; light?: THREE.PointLight;
  arm?: THREE.Object3D; head: THREE.Object3D; body: THREE.Object3D; gems: Partial<Record<GearSlot, THREE.Mesh>>; mantle?: THREE.Group; capeMat: THREE.MeshStandardMaterial; capeColor: THREE.Color;
};

const mat = (color: number | string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: 0, ...o });
const steelMat = (color: number | string) => mat(color, { roughness: .32, metalness: .75 });
function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
  const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent?.add(me); return me;
}
function gem(parent: THREE.Object3D, x: number, y: number, z: number, r = .045) {
  const g = mesh(new THREE.OctahedronGeometry(r), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0, roughness: .2 }), x, y, z, parent);
  g.visible = false; return g;
}
/** A cape: a bent plane hanging from the shoulders, waved in the idle loop. */
function makeCape(color: string, width: number, height: number, top: number, back: number) {
  const geo = new THREE.PlaneGeometry(width, height, 8, 12);
  geo.translate(0, -height / 2, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  // Clamped: rounding can leave the top edge a hair above 0, and a negative base would make pow() NaN.
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), f = Math.max(0, -pos.getY(i) / height); pos.setZ(i, -Math.pow(f, 1.4) * .25 - x * x * .6); pos.setX(i, x * (1 + f * .35)); }
  geo.computeVertexNormals();
  const m = mat(color, { side: THREE.DoubleSide, roughness: .85 });
  const cape = mesh(geo, m, 0, top, back);
  return { cape, base: Float32Array.from(pos.array as Float32Array), m };
}

function buildMira(): Model {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const skin = mat('#f0c8a2', { roughness: .6 }), robe = mat('#d06c50'), gold = mat('#f2c46a', { metalness: .6, roughness: .35 }), hatM = mat('#3f5a41'), hairM = mat('#6b3f2a');
  // Robe: a bell shape from the hem to the chest.
  const prof = [[0, 0], [.52, 0], [.5, .12], [.42, .45], [.32, .75], [.26, .95], [.24, 1.05], [.18, 1.12], [0, 1.14]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(prof, 28), robe, 0, 0, 0, body);
  mesh(new THREE.TorusGeometry(.265, .035, 10, 32), gold, 0, .8, 0, body).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(.05, 12, 10), mat('#fff1b8', { emissive: 0xffe38a, emissiveIntensity: .8 }), 0, .8, .27, body);
  // Boots peeking out.
  mesh(new THREE.SphereGeometry(.1, 12, 8), mat('#4b3025'), -.16, .04, .28, body).scale.set(1, .6, 1.5);
  mesh(new THREE.SphereGeometry(.1, 12, 8), mat('#4b3025'), .16, .04, .28, body).scale.set(1, .6, 1.5);
  // Arms.
  const armGeo = new THREE.CapsuleGeometry(.075, .42, 6, 12);
  const left = mesh(armGeo, robe, -.3, .9, .02, body); left.rotation.z = -.35; left.rotation.x = .2;
  mesh(new THREE.SphereGeometry(.07, 12, 10), skin, -.42, .66, .1, body);
  const arm = new THREE.Group(); arm.position.set(.3, 1.08, .04); body.add(arm);
  const right = mesh(armGeo, robe, .08, -.2, .05, arm); right.rotation.z = .35; right.rotation.x = -.5;
  mesh(new THREE.SphereGeometry(.07, 12, 10), skin, .17, -.4, .22, arm);
  // Staff with a glowing star orb.
  const staff = new THREE.Group(); staff.position.set(.17, -.4, .22); arm.add(staff);
  mesh(new THREE.CylinderGeometry(.025, .03, 1.55, 10), mat('#7a5a3f'), 0, .3, 0, staff);
  mesh(new THREE.TorusGeometry(.09, .018, 8, 20), gold, 0, 1.1, 0, staff);
  const glow = mesh(new THREE.SphereGeometry(.085, 20, 16), mat('#fff1b8', { emissive: 0xffe38a, emissiveIntensity: 2.4 }), 0, 1.12, 0, staff);
  const light = new THREE.PointLight(0xffd98a, 2.2, 3.5, 1.6); light.position.set(0, 1.12, 0); staff.add(light);
  // Head, hair and face.
  const head = new THREE.Group(); head.position.set(0, 1.36, 0); body.add(head);
  mesh(new THREE.SphereGeometry(.25, 28, 22), skin, 0, 0, 0, head);
  const hair = mesh(new THREE.SphereGeometry(.27, 24, 18, 0, Math.PI * 2, 0, Math.PI * .62), hairM, 0, .02, -.03, head); hair.rotation.x = -.35;
  mesh(new THREE.CapsuleGeometry(.08, .3, 6, 10), hairM, 0, -.2, -.2, head).rotation.x = .5;
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(.032, 12, 10), mat('#2d2420', { roughness: .3 }), s * .085, .01, .225, head);
    mesh(new THREE.SphereGeometry(.011, 8, 6), mat('#ffffff', { emissive: 0xffffff, emissiveIntensity: .6 }), s * .085 + .01, .025, .252, head);
    mesh(new THREE.SphereGeometry(.04, 10, 8), mat('#ec8a80', { transparent: true, opacity: .45 }), s * .14, -.07, .19, head).scale.set(1, .6, .4);
  }
  // Wizard hat: a wide brim and a cone whose tip droops backwards.
  const hat = new THREE.Group(); hat.position.set(0, .17, 0); hat.rotation.x = -.12; head.add(hat);
  mesh(new THREE.CylinderGeometry(.46, .46, .03, 36), hatM, 0, 0, 0, hat);
  mesh(new THREE.CylinderGeometry(.21, .24, .07, 28), gold, 0, .05, 0, hat);
  mesh(new THREE.ConeGeometry(.23, .38, 28), hatM, 0, .27, 0, hat);
  const tip = new THREE.Group(); tip.position.set(0, .42, 0); tip.rotation.x = -.7; hat.add(tip);
  mesh(new THREE.ConeGeometry(.13, .32, 20), hatM, 0, .12, 0, tip);
  mesh(new THREE.OctahedronGeometry(.055), mat('#fff1b8', { emissive: 0xffe38a, emissiveIntensity: 1.6 }), 0, .3, 0, tip);
  const { cape, base, m } = makeCape('#7a3a52', .62, 1.02, 1.12, -.2); body.add(cape);
  // Mantle pieces only appear when shoulders are worn.
  const mantle = new THREE.Group(); body.add(mantle); mantle.visible = false;
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#8a6fb0', { roughness: .5 }), s * .25, 1.07, 0, mantle).scale.set(1, .6, 1);
  const gems = { head: gem(hat, 0, .06, .24), shoulders: gem(mantle, 0, 1.1, .2), chest: gem(body, 0, .8, .3, .04) };
  group.scale.setScalar(1.12);
  return { group, cape, capeBase: base, glow, light, arm, head, body, gems, mantle, capeMat: m, capeColor: new THREE.Color('#7a3a52') };
}

function buildKael(): Model {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const skin = mat('#f0c8a2', { roughness: .6 }), steel = steelMat('#aab6c8'), dark = steelMat('#5a6478'), gold = mat('#e8c46a', { metalness: .8, roughness: .3 }), leather = mat('#6a4a30');
  // Legs and boots.
  for (const s of [-1, 1]) {
    mesh(new THREE.CapsuleGeometry(.09, .42, 6, 12), dark, s * .13, .38, 0, body);
    mesh(new THREE.BoxGeometry(.18, .14, .3), mat('#3a3040', { roughness: .6 }), s * .13, .07, .05, body);
    mesh(new THREE.SphereGeometry(.07, 12, 10), steel, s * .13, .48, .07, body);
  }
  // Tassets, belt and breastplate.
  mesh(new THREE.CylinderGeometry(.27, .32, .22, 20), dark, 0, .66, 0, body);
  mesh(new THREE.CylinderGeometry(.3, .3, .07, 24), leather, 0, .78, 0, body);
  mesh(new THREE.BoxGeometry(.1, .08, .04), gold, 0, .78, .3, body);
  const chest = mesh(new THREE.SphereGeometry(.36, 28, 20), steel, 0, 1.02, 0, body); chest.scale.set(1, 1, .72);
  mesh(new THREE.BoxGeometry(.05, .34, .04), gold, 0, 1.03, .27, body);
  // Pauldrons.
  for (const s of [-1, 1]) {
    const p = mesh(new THREE.SphereGeometry(.18, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), dark, s * .38, 1.2, 0, body); p.scale.set(1, .75, 1); p.rotation.z = s * -.35;
    mesh(new THREE.TorusGeometry(.17, .018, 8, 24), gold, s * .38, 1.2, 0, body).rotation.set(Math.PI / 2, 0, s * -.35);
  }
  // Shield arm (left) with a kite shield.
  const left = mesh(new THREE.CapsuleGeometry(.08, .38, 6, 12), steel, -.46, .92, .06, body); left.rotation.z = -.15; left.rotation.x = .5;
  const shape = new THREE.Shape(); shape.moveTo(-.28, .3); shape.lineTo(.28, .3); shape.lineTo(.26, -.05); shape.quadraticCurveTo(.2, -.34, 0, -.5); shape.quadraticCurveTo(-.2, -.34, -.26, -.05); shape.closePath();
  const shield = new THREE.Group(); shield.position.set(-.52, .82, .34); shield.rotation.y = -.35; body.add(shield);
  mesh(new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: true, bevelSize: .03, bevelThickness: .02, bevelSegments: 2 }), mat('#3f5a8a', { roughness: .45, metalness: .3 }), 0, 0, 0, shield);
  const rim = new THREE.Shape(); rim.moveTo(-.32, .34); rim.lineTo(.32, .34); rim.lineTo(.3, -.06); rim.quadraticCurveTo(.23, -.38, 0, -.56); rim.quadraticCurveTo(-.23, -.38, -.3, -.06); rim.closePath();
  mesh(new THREE.ExtrudeGeometry(rim, { depth: .03, bevelEnabled: false }), gold, 0, 0, -.015, shield);
  const star = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? .05 : .13; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  mesh(new THREE.ExtrudeGeometry(star, { depth: .02, bevelEnabled: false }), gold, 0, .02, .09, shield);
  // Sword arm (right).
  const arm = new THREE.Group(); arm.position.set(.44, 1.12, .04); body.add(arm);
  const right = mesh(new THREE.CapsuleGeometry(.08, .38, 6, 12), steel, .04, -.22, .06, arm); right.rotation.z = .2; right.rotation.x = -.3;
  mesh(new THREE.SphereGeometry(.075, 12, 10), leather, .08, -.44, .14, arm);
  const sword = new THREE.Group(); sword.position.set(.08, -.44, .14); sword.rotation.set(.35, 0, -.15); arm.add(sword);
  mesh(new THREE.CylinderGeometry(.028, .028, .2, 10), leather, 0, 0, 0, sword);
  mesh(new THREE.SphereGeometry(.045, 12, 10), gold, 0, -.12, 0, sword);
  mesh(new THREE.BoxGeometry(.3, .04, .06), gold, 0, .11, 0, sword);
  const blade = new THREE.Shape(); blade.moveTo(-.045, 0); blade.lineTo(.045, 0); blade.lineTo(.035, .82); blade.lineTo(0, .92); blade.lineTo(-.035, .82); blade.closePath();
  mesh(new THREE.ExtrudeGeometry(blade, { depth: .015, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1 }), steelMat('#eef3fa'), 0, .12, -.008, sword);
  // Head, helm with a red plume.
  const head = new THREE.Group(); head.position.set(0, 1.46, 0); body.add(head);
  mesh(new THREE.SphereGeometry(.22, 24, 20), skin, 0, 0, 0, head);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.03, 12, 10), mat('#2d2420', { roughness: .3 }), s * .08, -.01, .2, head);
  mesh(new THREE.SphereGeometry(.245, 28, 20, 0, Math.PI * 2, 0, Math.PI * .52), steel, 0, .02, 0, head);
  mesh(new THREE.TorusGeometry(.24, .02, 8, 32), gold, 0, .02, 0, head).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(.04, .16, .05), steel, 0, -.02, .23, head);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.05, .2, .14), steel, s * .22, -.08, .05, head);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .24, .05), new THREE.Vector3(0, .36, -.1), new THREE.Vector3(0, .3, -.32), new THREE.Vector3(0, .1, -.45)]);
  mesh(new THREE.TubeGeometry(curve, 24, .06, 10), mat('#c0392b', { roughness: .9 }), 0, 0, 0, head);
  const { cape, base, m } = makeCape('#8a2a2a', .72, 1.1, 1.22, -.26); body.add(cape);
  const gems = { head: gem(head, 0, .18, .2), shoulders: gem(body, .38, 1.3, .1), chest: gem(body, 0, 1.2, .27, .05) };
  return { group, cape, capeBase: base, arm, head, body, gems, capeMat: m, capeColor: new THREE.Color('#8a2a2a') };
}

export function createStage(canvas: HTMLCanvasElement, first: HeroId, mode: StageMode): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environment = env; scene.environmentIntensity = .55;
  const camera = new THREE.PerspectiveCamera(mode === 'select' ? 30 : 28, 1, .1, 50);
  const look = new THREE.Vector3(0, mode === 'select' ? .95 : 1, 0);
  camera.position.set(0, mode === 'select' ? 1.5 : 1.35, mode === 'select' ? 6 : 5.4);

  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a2a20, .7));
  const key = new THREE.SpotLight(0xfff0d8, 38, 14, .5, .6, 1.4); key.position.set(1.6, 5.2, 3.6); key.target.position.set(0, .8, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004; scene.add(key, key.target);
  const rim = new THREE.PointLight(0xa78bfa, 14, 8, 1.5); rim.position.set(-1.8, 2.2, -2); scene.add(rim);
  const fill = new THREE.PointLight(0xffc890, 4, 8, 1.8); fill.position.set(2.2, 1, 2.4); scene.add(fill);

  // Rune pedestal.
  const stone = mat('#3a3448', { roughness: .9 });
  const ped = mesh(new THREE.CylinderGeometry(1.05, 1.18, .24, 48), stone, 0, -.12, 0, scene);
  mesh(new THREE.CylinderGeometry(1.2, 1.3, .1, 48), mat('#2a2536', { roughness: .95 }), 0, -.27, 0, scene);
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xffd35c, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.92, .012, 6, 96), runeMat); ring.rotation.x = Math.PI / 2; ring.position.y = .005; scene.add(ring);
  const runes = new THREE.Group(); runes.position.y = .006; scene.add(runes);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, r = new THREE.Mesh(new THREE.PlaneGeometry(.1, .1), runeMat); r.rotation.x = -Math.PI / 2; r.rotation.z = a;
    r.position.set(Math.cos(a) * .8, 0, Math.sin(a) * .8); runes.add(r);
  }
  // A soft pool of light under the hero.
  const pool = document.createElement('canvas'); pool.width = pool.height = 128;
  const pc = pool.getContext('2d')!, grad = pc.createRadialGradient(64, 64, 0, 64, 64, 64); grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); pc.fillStyle = grad; pc.fillRect(0, 0, 128, 128);
  const poolTex = new THREE.CanvasTexture(pool);
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffd35c, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowDisc = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), poolMat); glowDisc.rotation.x = -Math.PI / 2; glowDisc.position.y = .01; scene.add(glowDisc);
  if (mode === 'sheet') { ped.scale.set(.8, 1, .8); runes.visible = false; }

  // Rising motes.
  const N = 70, motePos = new Float32Array(N * 3), moteSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = .4 + Math.random() * 1.1; motePos.set([Math.cos(a) * r, Math.random() * 2.4, Math.sin(a) * r], i * 3); moteSeed[i] = Math.random(); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ color: 0xfff1b8, size: .05, map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(moteGeo, moteMat));

  let model: Model | null = null, hero = first, pop = 1, worn: Worn = {};
  const pivot = new THREE.Group(); scene.add(pivot);
  const applyGear = () => {
    if (!model) return;
    for (const slot of ['head', 'shoulders', 'chest'] as GearSlot[]) {
      const g = model.gems[slot], item = worn[slot]; if (!g) continue;
      g.visible = !!item;
      if (item) { const c = new THREE.Color(RARITY[item.rarity].color); (g.material as THREE.MeshStandardMaterial).color.copy(c); (g.material as THREE.MeshStandardMaterial).emissive.copy(c); (g.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4; }
    }
    if (model.mantle) {
      model.mantle.visible = !!worn.shoulders;
      if (worn.shoulders) model.mantle.children.forEach(ch => { const m = (ch as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m?.color && ch !== model!.gems.shoulders) m.color.set(RARITY[worn.shoulders!.rarity].color).multiplyScalar(.7); });
    }
    const back = worn.back;
    model.capeMat.color.copy(back ? new THREE.Color(RARITY[back.rarity].color).multiplyScalar(.55) : model.capeColor);
    model.capeMat.emissive.set(back && (back.rarity === 'epic' || back.rarity === 'legendary') ? RARITY[back.rarity].color : 0x000000);
    model.capeMat.emissiveIntensity = .18;
  };
  const setHero = (h: HeroId) => {
    hero = h;
    if (model) { pivot.remove(model.group); model.group.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); }
    model = h === 'kael' ? buildKael() : buildMira();
    pivot.add(model.group); pop = 0; angle = -.35; vel = 0;
    const a = ACCENT[h]; rim.color.setHex(a.rim); runeMat.color.setHex(a.rune); poolMat.color.setHex(a.rune); moteMat.color.setHex(a.mote);
    applyGear();
  };

  // Drag to turn; the hero drifts back to a three-quarter view when left alone.
  let angle = -.35, vel = 0, dragging = false, lastX = 0, idle = 0;
  const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; idle = 0; canvas.setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; angle += dx * .012; vel = dx * .012 * 60; };
  const up = (e: PointerEvent) => { dragging = false; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // Narrow views step back so the whole hero stays in frame.
    const fit = Math.max(1, (mode === 'select' ? .75 : .62) / camera.aspect);
    camera.position.z = (mode === 'select' ? 6 : 5.4) * Math.min(1.8, fit);
    camera.updateProjectionMatrix(); camera.lookAt(look);
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  let seenW = 0, seenH = 0;

  let raf = 0, last = performance.now(), t = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    // rAF timestamps can be a little older than the moment the stage was made: never step backwards.
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = Math.max(last, now); t += dt;
    // Layout can settle after the first measure (panels sliding in): follow the real size.
    if (canvas.clientWidth !== seenW || canvas.clientHeight !== seenH) { seenW = canvas.clientWidth; seenH = canvas.clientHeight; resize(); }
    if (!dragging) { angle += vel * dt; vel *= Math.pow(.02, dt); idle += dt; if (idle > 2.5) angle += (-.35 - Math.atan2(Math.sin(angle), Math.cos(angle))) * Math.min(1, dt * .8); }
    pivot.rotation.y = angle;
    pop = Math.min(1, pop + dt * 2.2);
    const e = 1 - Math.pow(1 - pop, 3), s = .7 + .3 * e + Math.sin(pop * Math.PI) * .06;
    pivot.scale.setScalar(s); pivot.position.y = Math.sin(pop * Math.PI) * .25;
    if (model) {
      const breathe = Math.sin(t * 2.2);
      model.body.scale.set(1 + breathe * .006, 1 + breathe * .012, 1 + breathe * .006);
      model.head.rotation.y = Math.sin(t * .7) * .12; model.head.rotation.z = Math.sin(t * .9) * .03;
      if (model.arm) model.arm.rotation.z = Math.sin(t * 1.4) * .04;
      if (model.glow) { const k = 2.2 + Math.sin(t * 3) * .8; (model.glow.material as THREE.MeshStandardMaterial).emissiveIntensity = k; model.light!.intensity = 1.6 + Math.sin(t * 3) * .6; }
      const pos = model.cape.geometry.attributes.position as THREE.BufferAttribute, b = model.capeBase;
      for (let i = 0; i < pos.count; i++) { const y = b[i * 3 + 1], x = b[i * 3], d = -y; pos.setZ(i, b[i * 3 + 2] - Math.sin(t * 2.4 + d * 4 + x * 3) * .045 * d - Math.abs(vel) * .015 * d); }
      pos.needsUpdate = true; model.cape.geometry.computeVertexNormals();
    }
    runes.rotation.y = t * .25; runeMat.opacity = .55 + Math.sin(t * 2) * .25; poolMat.opacity = .28 + Math.sin(t * 2) * .08;
    const mp = moteGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) { let y = mp.getY(i) + dt * (.15 + moteSeed[i] * .25); if (y > 2.6) y = 0; mp.setY(i, y); }
    mp.needsUpdate = true;
    renderer.render(scene, camera);
  };
  setHero(first);
  raf = requestAnimationFrame(frame);

  return {
    setHero: h => { if (h !== hero || !model) setHero(h); },
    setGear: g => { worn = g; applyGear(); },
    dispose: () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mm = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mm)) mm.forEach(x => x.dispose()); else mm?.dispose(); });
      poolTex.dispose(); env.dispose(); pmrem.dispose(); renderer.dispose();
    },
  };
}
