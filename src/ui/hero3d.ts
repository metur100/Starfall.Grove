import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RARITY, lookOf } from '../game/gear';
import type { GearItem, GearSlot, HeroId } from '../game/types';

// The 3D hero viewer used on the character select screen and the character sheet. Every hero is built from simple
// shapes in the colours of their in-game sprite, stands on a rune pedestal, breathes, and turns when dragged.
// Worn equipment changes how they look: each slot owns the materials of its body part (hat, robe, gloves, belt,
// boots…), which take the piece's colour; shoulder pieces and leg guards appear when worn, and epic and legendary
// pieces glow.

export type Worn = Partial<Record<GearSlot, GearItem>>;
export type StageMode = 'select' | 'sheet';
export type Stage = { setHero(hero: HeroId): void; setGear(gear: Worn): void; dispose(): void };

const ACCENT: Record<HeroId, { rim: number; rune: number; mote: number }> = {
  mira: { rim: 0xa78bfa, rune: 0xffd35c, mote: 0xfff1b8 },
  kael: { rim: 0xff8a4a, rune: 0xffb35c, mote: 0xffd0a0 },
  lyra: { rim: 0x7fd0ff, rune: 0x9fe4ff, mote: 0xe0f6ff },
  riven: { rim: 0xb69cff, rune: 0xff6b9a, mote: 0xe0c8ff },
  wren: { rim: 0x9fe8b0, rune: 0xb9e27a, mote: 0xeaffc8 },
};

/** What one gear slot changes on a model: materials that take the piece's colour, and meshes shown only while worn. */
type Dye = { mats: THREE.MeshStandardMaterial[]; base: THREE.Color[]; show: THREE.Object3D[] };
/** The weapon: its shaft or blade takes the land's material, its gem the rarity dye; ornaments appear on higher tiers. */
type WeaponParts = { kind: 'wood' | 'metal'; shaft: THREE.MeshStandardMaterial[]; gem: THREE.MeshStandardMaterial[]; t2: THREE.Object3D[]; t3: THREE.Object3D[]; base?: { shaft: THREE.Color[]; gem: Array<[THREE.Color, THREE.Color, number]> } };
type Model = {
  group: THREE.Group; cape: THREE.Mesh; capeBase: Float32Array; glow?: THREE.Mesh; light?: THREE.PointLight;
  arm?: THREE.Object3D; head: THREE.Object3D; body: THREE.Object3D; gems: Partial<Record<GearSlot, THREE.Mesh>>;
  dyes: Partial<Record<GearSlot, Dye>>; weapon?: WeaponParts;
};
const TIER_WOOD = ['#7a5a3f', '#5f7a3a', '#d0d8e8', '#2e2630'], TIER_METAL = ['#c8ccd6', '#d8a860', '#cdefff', '#4a3434'];
const hide = <T extends THREE.Object3D>(o: T) => { o.visible = false; return o; };
/** A crescent (tier 2) and a crown of flame (tier 3) for a staff head at height y. */
function staffOrnaments(parent: THREE.Object3D, y: number, flameM: THREE.Material) {
  const cres = hide(mesh(new THREE.TorusGeometry(.13, .016, 8, 24, Math.PI * 1.2), mat('#e8f0ff', { metalness: .7, roughness: .25 }), 0, y, 0, parent)); cres.rotation.z = -Math.PI * .1;
  const flames = new THREE.Group(); flames.position.y = y + .06; parent.add(flames); flames.visible = false;
  for (const a of [0, 2.1, 4.2]) { const f = mesh(new THREE.ConeGeometry(.03, .16, 8), flameM, Math.cos(a) * .06, .06, Math.sin(a) * .06, flames); f.rotation.set(Math.sin(a) * .4, 0, -Math.cos(a) * .4); }
  return { t2: [cres], t3: [flames] };
}

const mat = (color: number | string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: 0, ...o });
const steelMat = (color: number | string) => mat(color, { roughness: .32, metalness: .75 });
function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
  const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent?.add(me); return me;
}
function gem(parent: THREE.Object3D, x: number, y: number, z: number, r = .045) {
  const g = mesh(new THREE.OctahedronGeometry(r), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0, roughness: .2 }), x, y, z, parent);
  g.visible = false; return g;
}
const dye = (mats: THREE.MeshStandardMaterial[], show: THREE.Object3D[] = []): Dye => { for (const o of show) o.visible = false; return { mats, base: mats.map(m => m.color.clone()), show }; };
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
/** Rounded shoulder caps, shown when a shoulder piece is worn. */
function mantle(parent: THREE.Object3D, x: number, y: number, r: number, m: THREE.Material) {
  const g = new THREE.Group(); parent.add(g);
  for (const s of [-1, 1]) { const p = mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, s * x, y, 0, g); p.scale.set(1, .65, 1); p.rotation.z = s * -.3; }
  return g;
}
/** A band around a robe's hem, shown when leg armour is worn under it. */
function hem(parent: THREE.Object3D, r: number, m: THREE.Material) { const t = mesh(new THREE.TorusGeometry(r, .045, 10, 36), m, 0, .06, 0, parent); t.rotation.x = Math.PI / 2; return t; }

function buildMira(): Model {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const skin = mat('#f0c8a2', { roughness: .6 }), robe = mat('#d06c50'), gold = mat('#f2c46a', { metalness: .6, roughness: .35 }), hatM = mat('#3f5a41'), hairM = mat('#6b3f2a');
  const beltM = mat('#f2c46a', { metalness: .6, roughness: .35 }), handM = mat('#f0c8a2', { roughness: .6 }), bootM = mat('#4b3025'), legM = mat('#8a6fb0', { roughness: .5 }), mantleM = mat('#8a6fb0', { roughness: .5 });
  // Robe: a bell shape from the hem to the chest.
  const prof = [[0, 0], [.52, 0], [.5, .12], [.42, .45], [.32, .75], [.26, .95], [.24, 1.05], [.18, 1.12], [0, 1.14]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(prof, 28), robe, 0, 0, 0, body);
  mesh(new THREE.TorusGeometry(.265, .035, 10, 32), beltM, 0, .8, 0, body).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(.05, 12, 10), mat('#fff1b8', { emissive: 0xffe38a, emissiveIntensity: .8 }), 0, .8, .27, body);
  const legs = hem(body, .52, legM);
  // Boots peeking out.
  mesh(new THREE.SphereGeometry(.1, 12, 8), bootM, -.16, .04, .28, body).scale.set(1, .6, 1.5);
  mesh(new THREE.SphereGeometry(.1, 12, 8), bootM, .16, .04, .28, body).scale.set(1, .6, 1.5);
  // Arms.
  const armGeo = new THREE.CapsuleGeometry(.075, .42, 6, 12);
  const left = mesh(armGeo, robe, -.3, .9, .02, body); left.rotation.z = -.35; left.rotation.x = .2;
  mesh(new THREE.SphereGeometry(.07, 12, 10), handM, -.42, .66, .1, body);
  const arm = new THREE.Group(); arm.position.set(.3, 1.08, .04); body.add(arm);
  const right = mesh(armGeo, robe, .08, -.2, .05, arm); right.rotation.z = .35; right.rotation.x = -.5;
  mesh(new THREE.SphereGeometry(.07, 12, 10), handM, .17, -.4, .22, arm);
  // Staff with a glowing star orb.
  const staff = new THREE.Group(); staff.position.set(.17, -.4, .22); arm.add(staff);
  const shaftM = mat('#7a5a3f');
  mesh(new THREE.CylinderGeometry(.025, .03, 1.55, 10), shaftM, 0, .3, 0, staff);
  mesh(new THREE.TorusGeometry(.09, .018, 8, 20), gold, 0, 1.1, 0, staff);
  const glowM = mat('#fff1b8', { emissive: 0xffe38a, emissiveIntensity: 2.4 });
  const glow = mesh(new THREE.SphereGeometry(.085, 20, 16), glowM, 0, 1.12, 0, staff);
  const light = new THREE.PointLight(0xffd98a, 2.2, 3.5, 1.6); light.position.set(0, 1.12, 0); staff.add(light);
  const orn = staffOrnaments(staff, 1.12, glowM);
  // Head, hair and face.
  const head = new THREE.Group(); head.position.set(0, 1.36, 0); body.add(head);
  mesh(new THREE.SphereGeometry(.25, 28, 22), skin, 0, 0, 0, head);
  const hair = mesh(new THREE.SphereGeometry(.27, 24, 18, 0, Math.PI * 2, 0, Math.PI * .62), hairM, 0, .02, -.03, head); hair.rotation.x = -.35;
  mesh(new THREE.CapsuleGeometry(.08, .3, 6, 10), hairM, 0, -.2, -.2, head).rotation.x = .5;
  face(head, .225, '#2d2420');
  // Wizard hat: a wide brim and a cone whose tip droops backwards.
  const hat = new THREE.Group(); hat.position.set(0, .17, 0); hat.rotation.x = -.12; head.add(hat);
  mesh(new THREE.CylinderGeometry(.46, .46, .03, 36), hatM, 0, 0, 0, hat);
  mesh(new THREE.CylinderGeometry(.21, .24, .07, 28), gold, 0, .05, 0, hat);
  mesh(new THREE.ConeGeometry(.23, .38, 28), hatM, 0, .27, 0, hat);
  const tip = new THREE.Group(); tip.position.set(0, .42, 0); tip.rotation.x = -.7; hat.add(tip);
  mesh(new THREE.ConeGeometry(.13, .32, 20), hatM, 0, .12, 0, tip);
  mesh(new THREE.OctahedronGeometry(.055), mat('#fff1b8', { emissive: 0xffe38a, emissiveIntensity: 1.6 }), 0, .3, 0, tip);
  const { cape, base, m } = makeCape('#7a3a52', .62, 1.02, 1.12, -.2); body.add(cape);
  const shoulders = mantle(body, .25, 1.07, .13, mantleM);
  const gems = { head: gem(hat, 0, .06, .24), chest: gem(body, 0, .8, .3, .04) };
  group.scale.setScalar(1.12);
  return { group, cape, capeBase: base, glow, light, arm, head, body, gems, weapon: { kind: 'wood', shaft: [shaftM], gem: [glowM], ...orn }, dyes: {
    head: dye([hatM]), chest: dye([robe]), back: dye([m]), shoulders: dye([mantleM], [shoulders]), hands: dye([handM]), waist: dye([beltM]), legs: dye([legM], [legs]), feet: dye([bootM]),
  } };
}
/** Eyes and blushing cheeks on a head of radius r. */
function face(head: THREE.Object3D, z: number, eye: string) {
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(.032, 12, 10), mat(eye, { roughness: .3 }), s * .085, .01, z, head);
    mesh(new THREE.SphereGeometry(.011, 8, 6), mat('#ffffff', { emissive: 0xffffff, emissiveIntensity: .6 }), s * .085 + .01, .025, z + .027, head);
    mesh(new THREE.SphereGeometry(.04, 10, 8), mat('#ec8a80', { transparent: true, opacity: .45 }), s * .14, -.07, z - .035, head).scale.set(1, .6, .4);
  }
}

function buildKael(): Model {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const skin = mat('#f0c8a2', { roughness: .6 }), steel = steelMat('#aab6c8'), gold = mat('#e8c46a', { metalness: .8, roughness: .3 }), leather = mat('#6a4a30');
  const legM = steelMat('#5a6478'), bootM = mat('#3a3040', { roughness: .6 }), beltM = mat('#6a4a30'), chestM = steelMat('#aab6c8'), pauldronM = steelMat('#5a6478'), helmM = steelMat('#aab6c8'), handM = mat('#6a4a30');
  // Legs and boots.
  for (const s of [-1, 1]) {
    mesh(new THREE.CapsuleGeometry(.09, .42, 6, 12), legM, s * .13, .38, 0, body);
    mesh(new THREE.BoxGeometry(.18, .14, .3), bootM, s * .13, .07, .05, body);
    mesh(new THREE.SphereGeometry(.07, 12, 10), steel, s * .13, .48, .07, body);
  }
  // Tassets, belt and breastplate.
  mesh(new THREE.CylinderGeometry(.27, .32, .22, 20), legM, 0, .66, 0, body);
  mesh(new THREE.CylinderGeometry(.3, .3, .07, 24), beltM, 0, .78, 0, body);
  mesh(new THREE.BoxGeometry(.1, .08, .04), gold, 0, .78, .3, body);
  const chest = mesh(new THREE.SphereGeometry(.36, 28, 20), chestM, 0, 1.02, 0, body); chest.scale.set(1, 1, .72);
  mesh(new THREE.BoxGeometry(.05, .34, .04), gold, 0, 1.03, .27, body);
  // Pauldrons.
  for (const s of [-1, 1]) {
    const p = mesh(new THREE.SphereGeometry(.18, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), pauldronM, s * .38, 1.2, 0, body); p.scale.set(1, .75, 1); p.rotation.z = s * -.35;
    mesh(new THREE.TorusGeometry(.17, .018, 8, 24), gold, s * .38, 1.2, 0, body).rotation.set(Math.PI / 2, 0, s * -.35);
  }
  // Shield arm (left) with a kite shield.
  const left = mesh(new THREE.CapsuleGeometry(.08, .38, 6, 12), steel, -.46, .92, .06, body); left.rotation.z = -.15; left.rotation.x = .5;
  mesh(new THREE.SphereGeometry(.07, 12, 10), handM, -.5, .72, .2, body);
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
  mesh(new THREE.SphereGeometry(.075, 12, 10), handM, .08, -.44, .14, arm);
  const sword = new THREE.Group(); sword.position.set(.08, -.44, .14); sword.rotation.set(.35, 0, -.15); arm.add(sword);
  mesh(new THREE.CylinderGeometry(.028, .028, .2, 10), leather, 0, 0, 0, sword);
  const pommelM = mat('#e8c46a', { metalness: .8, roughness: .3, emissive: 0x000000 });
  mesh(new THREE.SphereGeometry(.045, 12, 10), pommelM, 0, -.12, 0, sword);
  mesh(new THREE.BoxGeometry(.3, .04, .06), gold, 0, .11, 0, sword);
  const guardGem = mesh(new THREE.OctahedronGeometry(.035), pommelM, 0, .11, .04, sword);
  const bladeM = steelMat('#eef3fa');
  const edge = hide(mesh(new THREE.BoxGeometry(.012, .78, .03), mat('#ffffff', { emissive: 0xffffff, emissiveIntensity: 1 }), 0, .52, 0, sword));
  const wings = hide(new THREE.Group()); sword.add(wings);
  for (const s of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(.03, .14, 6), gold, s * .19, .1, 0, wings); w.rotation.z = s * -1.8; }
  const blade = new THREE.Shape(); blade.moveTo(-.045, 0); blade.lineTo(.045, 0); blade.lineTo(.035, .82); blade.lineTo(0, .92); blade.lineTo(-.035, .82); blade.closePath();
  mesh(new THREE.ExtrudeGeometry(blade, { depth: .015, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1 }), bladeM, 0, .12, -.008, sword);
  void guardGem;
  // Head, helm with a red plume.
  const head = new THREE.Group(); head.position.set(0, 1.46, 0); body.add(head);
  mesh(new THREE.SphereGeometry(.22, 24, 20), skin, 0, 0, 0, head);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.03, 12, 10), mat('#2d2420', { roughness: .3 }), s * .08, -.01, .2, head);
  mesh(new THREE.SphereGeometry(.245, 28, 20, 0, Math.PI * 2, 0, Math.PI * .52), helmM, 0, .02, 0, head);
  mesh(new THREE.TorusGeometry(.24, .02, 8, 32), gold, 0, .02, 0, head).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(.04, .16, .05), helmM, 0, -.02, .23, head);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.05, .2, .14), helmM, s * .22, -.08, .05, head);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .24, .05), new THREE.Vector3(0, .36, -.1), new THREE.Vector3(0, .3, -.32), new THREE.Vector3(0, .1, -.45)]);
  mesh(new THREE.TubeGeometry(curve, 24, .06, 10), mat('#c0392b', { roughness: .9 }), 0, 0, 0, head);
  const { cape, base, m } = makeCape('#8a2a2a', .72, 1.1, 1.22, -.26); body.add(cape);
  const gems = { head: gem(head, 0, .18, .2), chest: gem(body, 0, 1.2, .27, .05) };
  return { group, cape, capeBase: base, arm, head, body, gems, weapon: { kind: 'metal', shaft: [bladeM], gem: [pommelM, edge.material as THREE.MeshStandardMaterial], t2: [wings], t3: [edge] }, dyes: {
    head: dye([helmM]), chest: dye([chestM]), back: dye([m]), shoulders: dye([pauldronM]), hands: dye([handM]), waist: dye([beltM]), legs: dye([legM]), feet: dye([bootM]),
  } };
}

/** Lyra: a layered frost-blue robe, long pale hair, a crystal circlet and a staff crowned with a floating ice shard. */
function buildLyra(): Model {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const skin = mat('#f6dcc8', { roughness: .6 }), robe = mat('#5a8ac8'), under = mat('#e6f4ff', { roughness: .6 }), hairM = mat('#dff2ff', { roughness: .5 });
  const circletM = mat('#bfeaff', { metalness: .5, roughness: .25 }), beltM = mat('#e6f4ff', { roughness: .5 }), handM = mat('#f6dcc8', { roughness: .6 }), bootM = mat('#3a4a6a'), legM = mat('#bfeaff', { roughness: .4 }), mantleM = mat('#9fd0ee', { roughness: .4 });
  const ice = mat('#dff6ff', { emissive: 0x7fd0ff, emissiveIntensity: 1.4, roughness: .15, metalness: .1, transparent: true, opacity: .92 });
  // An inner white skirt under an open blue over-robe.
  const inner = [[0, 0], [.46, 0], [.42, .3], [.3, .7], [.22, 1.05], [0, 1.1]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(inner, 24), under, 0, 0, 0, body);
  const outer = [[.5, .02], [.47, .2], [.38, .55], [.3, .85], [.26, 1.02], [.2, 1.12], [0, 1.14]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(outer, 28, Math.PI * .62, Math.PI * 1.76), robe, 0, 0, 0, body);
  mesh(new THREE.TorusGeometry(.25, .03, 10, 32), beltM, 0, .82, 0, body).rotation.x = Math.PI / 2;
  mesh(new THREE.OctahedronGeometry(.05), ice, 0, .82, .26, body);
  const legs = hem(body, .47, legM);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.09, 12, 8), bootM, s * .15, .04, .26, body).scale.set(1, .6, 1.5);
  // Arms: the left one open, the right holding the staff.
  const armGeo = new THREE.CapsuleGeometry(.07, .4, 6, 12);
  const left = mesh(armGeo, robe, -.29, .9, .02, body); left.rotation.z = -.5; left.rotation.x = .1;
  mesh(new THREE.SphereGeometry(.065, 12, 10), handM, -.45, .7, .08, body);
  mesh(new THREE.IcosahedronGeometry(.07, 0), ice, -.5, .78, .16, body);
  const arm = new THREE.Group(); arm.position.set(.29, 1.08, .04); body.add(arm);
  const right = mesh(armGeo, robe, .08, -.2, .05, arm); right.rotation.z = .35; right.rotation.x = -.5;
  mesh(new THREE.SphereGeometry(.065, 12, 10), handM, .17, -.4, .22, arm);
  const staff = new THREE.Group(); staff.position.set(.17, -.4, .22); arm.add(staff);
  const lshaftM = mat('#c8d8e8', { metalness: .4, roughness: .35 }), shardM = ice.clone();
  mesh(new THREE.CylinderGeometry(.022, .028, 1.5, 10), lshaftM, 0, .3, 0, staff);
  const lorn = staffOrnaments(staff, 1.2, shardM);
  for (const a of [0, 2.1, 4.2]) { const p = mesh(new THREE.ConeGeometry(.03, .16, 8), circletM, Math.cos(a) * .07, 1.04, Math.sin(a) * .07, staff); p.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); }
  const glow = mesh(new THREE.OctahedronGeometry(.11), shardM, 0, 1.2, 0, staff); glow.scale.set(.7, 1.3, .7);
  const light = new THREE.PointLight(0x9fe4ff, 2.4, 3.5, 1.6); light.position.set(0, 1.2, 0); staff.add(light);
  // Head with long pale hair and a crystal circlet.
  const head = new THREE.Group(); head.position.set(0, 1.36, 0); body.add(head);
  mesh(new THREE.SphereGeometry(.24, 28, 22), skin, 0, 0, 0, head);
  const hair = mesh(new THREE.SphereGeometry(.265, 24, 18, 0, Math.PI * 2, 0, Math.PI * .6), hairM, 0, .02, -.03, head); hair.rotation.x = -.3;
  for (const s of [-1, 1]) mesh(new THREE.CapsuleGeometry(.07, .5, 6, 10), hairM, s * .17, -.3, -.08, head).rotation.z = s * .1;
  mesh(new THREE.CapsuleGeometry(.12, .45, 6, 10), hairM, 0, -.32, -.2, head).rotation.x = .25;
  face(head, .215, '#2a4a6a');
  const circ = mesh(new THREE.TorusGeometry(.255, .018, 8, 36), circletM, 0, .1, 0, head); circ.rotation.x = Math.PI / 2 - .25;
  const crown = mesh(new THREE.OctahedronGeometry(.06), ice, 0, .2, .22, head); crown.scale.set(.7, 1.3, .5);
  const { cape, base, m } = makeCape('#9fd0ee', .6, 1.02, 1.12, -.2); body.add(cape);
  const shoulders = mantle(body, .24, 1.07, .12, mantleM);
  const gems = { chest: gem(body, 0, .95, .26, .04) };
  group.scale.setScalar(1.12);
  return { group, cape, capeBase: base, glow, light, arm, head, body, gems, weapon: { kind: 'wood', shaft: [lshaftM], gem: [shardM], ...lorn }, dyes: {
    head: dye([circletM]), chest: dye([robe]), back: dye([m]), shoulders: dye([mantleM], [shoulders]), hands: dye([handM]), waist: dye([beltM]), legs: dye([legM], [legs]), feet: dye([bootM]),
  } };
}

/** Riven: slim and hooded, a mask over the lower face, a short scarf-cape and a dagger in each hand. */
function buildRiven(): Model {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const skin = mat('#e8c4a8', { roughness: .6 }), steel = steelMat('#d8dce8');
  const legM = mat('#3a3448'), bootM = mat('#241c2c'), chestM = mat('#4a3e62', { roughness: .6 }), beltM = mat('#6a4a3a'), hoodM = mat('#3a2e52', { roughness: .8 }), handM = mat('#2a2236'), mantleM = mat('#5a4a7a', { roughness: .5 });
  for (const s of [-1, 1]) {
    mesh(new THREE.CapsuleGeometry(.075, .46, 6, 12), legM, s * .11, .4, 0, body);
    const boot = mesh(new THREE.CapsuleGeometry(.08, .16, 6, 10), bootM, s * .11, .12, .03, body); boot.rotation.x = .2;
  }
  // Torso: a lean jerkin with a wrapped sash and pouches.
  const torso = mesh(new THREE.CapsuleGeometry(.22, .36, 8, 16), chestM, 0, .98, 0, body); torso.scale.set(1, 1, .75);
  mesh(new THREE.CylinderGeometry(.23, .23, .08, 20), beltM, 0, .74, 0, body);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.08, .09, .06), beltM, s * .17, .7, .16, body);
  mesh(new THREE.BoxGeometry(.05, .5, .03), mat('#6a4a8a'), .06, 1.0, .17, body).rotation.z = .55;
  // Arms, each with a dagger held point-down.
  const armGeo = new THREE.CapsuleGeometry(.065, .38, 6, 12);
  const dgemM = mat('#e0c8ff', { roughness: .2 }), dt2: THREE.Object3D[] = [], dt3: THREE.Object3D[] = [];
  const dagger = (parent: THREE.Object3D) => {
    const d = new THREE.Group(); parent.add(d);
    mesh(new THREE.CylinderGeometry(.02, .02, .12, 8), mat('#3a2a26'), 0, 0, 0, d);
    mesh(new THREE.BoxGeometry(.14, .025, .04), steel, 0, -.07, 0, d);
    mesh(new THREE.OctahedronGeometry(.022), dgemM, 0, .07, 0, d);
    dt2.push(hide(mesh(new THREE.TorusGeometry(.04, .008, 6, 16), steel, 0, -.07, 0, d)));
    dt3.push(hide(mesh(new THREE.BoxGeometry(.006, .3, .02), dgemM, 0, -.25, 0, d)));
    const b = new THREE.Shape(); b.moveTo(-.03, 0); b.lineTo(.03, 0); b.lineTo(0, -.34); b.closePath();
    mesh(new THREE.ExtrudeGeometry(b, { depth: .012, bevelEnabled: false }), steel, 0, -.08, -.006, d);
    return d;
  };
  const left = mesh(armGeo, chestM, -.29, .95, .02, body); left.rotation.z = -.3; left.rotation.x = .3;
  mesh(new THREE.SphereGeometry(.06, 12, 10), handM, -.38, .74, .12, body);
  const dl = dagger(body); dl.position.set(-.38, .74, .12); dl.rotation.set(.4, 0, .2);
  const arm = new THREE.Group(); arm.position.set(.29, 1.12, .04); body.add(arm);
  const right = mesh(armGeo, chestM, .06, -.2, .05, arm); right.rotation.z = .3; right.rotation.x = -.4;
  mesh(new THREE.SphereGeometry(.06, 12, 10), handM, .12, -.4, .18, arm);
  const dr = dagger(arm); dr.position.set(.12, -.4, .18); dr.rotation.set(-.4, 0, -.3);
  // Hooded head with glowing violet eyes and a mask.
  const head = new THREE.Group(); head.position.set(0, 1.44, 0); body.add(head);
  mesh(new THREE.SphereGeometry(.21, 24, 20), skin, 0, 0, 0, head);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.028, 12, 10), mat('#b69cff', { emissive: 0x8a6ae0, emissiveIntensity: 1.2 }), s * .075, .02, .19, head);
  const mask = mesh(new THREE.SphereGeometry(.215, 24, 16, 0, Math.PI * 2, Math.PI * .56, Math.PI * .44), mat('#2e2440'), 0, 0, .01, head); mask.rotation.x = -.15;
  const hood = mesh(new THREE.SphereGeometry(.26, 24, 18, 0, Math.PI * 2, 0, Math.PI * .6), hoodM, 0, .03, -.03, head); hood.rotation.x = -.4;
  const peak = mesh(new THREE.ConeGeometry(.12, .24, 12), hoodM, 0, .16, -.2, head); peak.rotation.x = -1.2;
  const { cape, base, m } = makeCape('#2e2440', .46, .78, 1.24, -.2); body.add(cape);
  const shoulders = mantle(body, .24, 1.2, .11, mantleM);
  const gems = { head: gem(head, 0, .2, .2), chest: gem(body, 0, 1.08, .22, .04) };
  group.scale.setScalar(1.06);
  return { group, cape, capeBase: base, arm, head, body, gems, weapon: { kind: 'metal', shaft: [steel], gem: [dgemM], t2: dt2, t3: dt3 }, dyes: {
    head: dye([hoodM]), chest: dye([chestM]), back: dye([m]), shoulders: dye([mantleM], [shoulders]), hands: dye([handM]), waist: dye([beltM]), legs: dye([legM]), feet: dye([bootM]),
  } };
}
/** Wren: a hooded green cloak over leather, an auburn braid, a quiver and a longbow, and Fenn the wolf sitting at her side. */
function buildWren(): Model {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const skin = mat('#f0c8a2', { roughness: .6 }), hairM = mat('#a8502e', { roughness: .7 }), wood = mat('#7a5230', { roughness: .6 }), leather = mat('#6a4a30');
  const legM = mat('#5a4a36'), bootM = mat('#4b3025'), chestM = mat('#8a6a44', { roughness: .7 }), beltM = mat('#5a3a24'), hoodM = mat('#4a7a44', { roughness: .85 }), handM = mat('#6a4a30'), mantleM = mat('#6f9a4a', { roughness: .6 });
  for (const s of [-1, 1]) {
    mesh(new THREE.CapsuleGeometry(.08, .44, 6, 12), legM, s * .12, .4, 0, body);
    const boot = mesh(new THREE.CapsuleGeometry(.085, .16, 6, 10), bootM, s * .12, .12, .03, body); boot.rotation.x = .2;
  }
  const torso = mesh(new THREE.CapsuleGeometry(.23, .36, 8, 16), chestM, 0, .98, 0, body); torso.scale.set(1, 1, .78);
  mesh(new THREE.CylinderGeometry(.24, .24, .07, 20), beltM, 0, .75, 0, body);
  mesh(new THREE.BoxGeometry(.1, .1, .07), leather, .18, .72, .15, body);
  // Quiver across the back with red-fletched arrows.
  const quiver = new THREE.Group(); quiver.position.set(-.1, 1.05, -.22); quiver.rotation.z = .45; body.add(quiver);
  mesh(new THREE.CylinderGeometry(.07, .06, .5, 12), leather, 0, 0, 0, quiver);
  for (let i = 0; i < 3; i++) { mesh(new THREE.CylinderGeometry(.008, .008, .22, 6), mat('#e8e0c8'), (i - 1) * .03, .32, 0, quiver); mesh(new THREE.BoxGeometry(.03, .05, .005), mat('#c0392b'), (i - 1) * .03, .4, 0, quiver); }
  const armGeo = new THREE.CapsuleGeometry(.065, .38, 6, 12);
  const left = mesh(armGeo, chestM, -.3, .94, .06, body); left.rotation.z = -.2; left.rotation.x = .9;
  mesh(new THREE.SphereGeometry(.06, 12, 10), handM, -.34, .84, .3, body);
  // The longbow, held upright in the left hand.
  const bow = new THREE.Group(); bow.position.set(-.34, .86, .32); body.add(bow);
  const bc = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -.6, 0), new THREE.Vector3(0, 0, .22), new THREE.Vector3(0, .6, 0));
  mesh(new THREE.TubeGeometry(bc, 24, .02, 8), wood, 0, 0, 0, bow);
  const bgemM = mat('#e8e0c8', { roughness: .3 });
  mesh(new THREE.SphereGeometry(.03, 10, 8), bgemM, 0, 0, .11, bow);
  const tips = hide(new THREE.Group()); bow.add(tips);
  for (const s of [-1, 1]) { const tp = mesh(new THREE.ConeGeometry(.02, .12, 6), wood, 0, s * .64, -.03, tips); tp.rotation.x = s * -.8; }
  const bglow = hide(mesh(new THREE.TorusGeometry(.05, .01, 6, 16), bgemM, 0, 0, .11, bow));
  const string = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -.6, 0), new THREE.Vector3(0, .6, 0)]); bow.add(new THREE.Line(string, new THREE.LineBasicMaterial({ color: 0xe8e0c8 })));
  const arm = new THREE.Group(); arm.position.set(.3, 1.12, .04); body.add(arm);
  const right = mesh(armGeo, chestM, .06, -.2, .05, arm); right.rotation.z = .3; right.rotation.x = -.3;
  mesh(new THREE.SphereGeometry(.06, 12, 10), handM, .12, -.42, .14, arm);
  // Head: auburn braid, hood.
  const head = new THREE.Group(); head.position.set(0, 1.44, 0); body.add(head);
  mesh(new THREE.SphereGeometry(.22, 24, 20), skin, 0, 0, 0, head);
  face(head, .2, '#2d3a20');
  const hair = mesh(new THREE.SphereGeometry(.235, 24, 18, 0, Math.PI * 2, 0, Math.PI * .55), hairM, 0, .02, -.02, head); hair.rotation.x = -.3;
  const braid = new THREE.CatmullRomCurve3([new THREE.Vector3(-.12, -.05, -.16), new THREE.Vector3(-.2, -.25, -.12), new THREE.Vector3(-.18, -.48, -.02)]);
  mesh(new THREE.TubeGeometry(braid, 16, .045, 8), hairM, 0, 0, 0, head);
  const hood = mesh(new THREE.SphereGeometry(.27, 24, 18, 0, Math.PI * 2, 0, Math.PI * .58), hoodM, 0, .04, -.05, head); hood.rotation.x = -.5;
  const { cape, base, m } = makeCape('#3f6a3a', .62, 1.06, 1.24, -.24); body.add(cape);
  const shoulders = mantle(body, .25, 1.2, .12, mantleM);
  // Fenn, sitting at her right side.
  const fur = mat('#8a8a96', { roughness: .85 }), furL = mat('#d8d8e0', { roughness: .85 }), wolf = new THREE.Group(); wolf.position.set(.62, 0, .18); wolf.rotation.y = -.5; group.add(wolf);
  const wb = mesh(new THREE.SphereGeometry(.2, 18, 14), fur, 0, .3, -.05, wolf); wb.scale.set(.9, 1.2, 1.3);
  mesh(new THREE.SphereGeometry(.12, 14, 10), furL, 0, .36, .12, wolf).scale.set(1, 1.2, .6);
  for (const s of [-1, 1]) { mesh(new THREE.CapsuleGeometry(.04, .2, 4, 8), fur, s * .09, .14, .12, wolf); mesh(new THREE.SphereGeometry(.07, 10, 8), fur, s * .12, .08, -.12, wolf).scale.set(1, .7, 1.6); }
  const wh = new THREE.Group(); wh.position.set(0, .58, .08); wolf.add(wh);
  mesh(new THREE.SphereGeometry(.13, 16, 12), fur, 0, 0, 0, wh);
  mesh(new THREE.ConeGeometry(.07, .18, 10), fur, 0, -.03, .16, wh).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(.025, 8, 6), mat('#2a2a30'), 0, -.03, .25, wh);
  for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(.045, .12, 8), fur, s * .07, .13, -.01, wh); mesh(new THREE.SphereGeometry(.018, 8, 6), mat('#2a2a30'), s * .05, .03, .11, wh); }
  mesh(new THREE.TorusGeometry(.15, .03, 8, 24), mat('#4f8a3a'), 0, .44, .02, wolf).rotation.x = Math.PI / 2 + .35;
  const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .15, -.3), new THREE.Vector3(.1, .08, -.45), new THREE.Vector3(.25, .06, -.4)]);
  mesh(new THREE.TubeGeometry(tail, 12, .05, 8), fur, 0, 0, 0, wolf);
  const gems = { head: gem(head, 0, .2, .2), chest: gem(body, 0, 1.08, .22, .04) };
  group.scale.setScalar(1.06);
  return { group, cape, capeBase: base, arm, head, body, gems, weapon: { kind: 'wood', shaft: [wood], gem: [bgemM], t2: [tips], t3: [bglow] }, dyes: {
    head: dye([hoodM]), chest: dye([chestM]), back: dye([m]), shoulders: dye([mantleM], [shoulders]), hands: dye([handM]), waist: dye([beltM]), legs: dye([legM]), feet: dye([bootM]),
  } };
}
const BUILD: Record<HeroId, () => Model> = { mira: buildMira, kael: buildKael, lyra: buildLyra, riven: buildRiven, wren: buildWren };

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
  /** Each worn piece colours its body part; empty slots go back to the hero's own colours. */
  const applyGear = () => {
    if (!model) return;
    const look = lookOf(worn);
    for (const [slot, d] of Object.entries(model.dyes) as Array<[GearSlot, Dye]>) {
      const l = look[slot];
      d.mats.forEach((m, i) => {
        if (l) { m.color.set(l.color); m.emissive.set(l.glow ? l.color : 0x000000); m.emissiveIntensity = l.glow ? .35 : 0; }
        else { m.color.copy(d.base[i]); m.emissive.set(0x000000); m.emissiveIntensity = 0; }
      });
      for (const o of d.show) o.visible = !!l;
    }
    const wp = model.weapon, wl = look.weapon;
    if (wp) {
      wp.base ??= { shaft: wp.shaft.map(m => m.color.clone()), gem: wp.gem.map(m => [m.color.clone(), m.emissive.clone(), m.emissiveIntensity] as [THREE.Color, THREE.Color, number]) };
      const b = wp.base, tier = wl ? wl.tier : -1;
      wp.shaft.forEach((m, i) => m.color.set(wl ? (wp.kind === 'wood' ? TIER_WOOD : TIER_METAL)[tier] : b.shaft[i]));
      wp.gem.forEach((m, i) => { if (wl) { m.color.set(wl.color); m.emissive.set(wl.color); m.emissiveIntensity = wl.glow ? 1.8 : .7; } else { m.color.copy(b.gem[i][0]); m.emissive.copy(b.gem[i][1]); m.emissiveIntensity = b.gem[i][2]; } });
      for (const o of wp.t2) o.visible = tier >= 2; for (const o of wp.t3) o.visible = tier >= 3;
      if (model.light) model.light.color.set(wl ? wl.color : hero === 'lyra' ? 0x9fe4ff : 0xffd98a);
    }
    for (const [slot, g] of Object.entries(model.gems) as Array<[GearSlot, THREE.Mesh]>) {
      const item = worn[slot]; g.visible = !!item;
      if (item) { const c = new THREE.Color(RARITY[item.rarity].color), m = g.material as THREE.MeshStandardMaterial; m.color.copy(c); m.emissive.copy(c); m.emissiveIntensity = 1.4; }
    }
  };
  const setHero = (h: HeroId) => {
    hero = h;
    if (model) { pivot.remove(model.group); model.group.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); }
    model = BUILD[h]();
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
      if (model.glow) { const k = 2.2 + Math.sin(t * 3) * .8; (model.glow.material as THREE.MeshStandardMaterial).emissiveIntensity = hero === 'lyra' ? k * .6 : k; model.light!.intensity = 1.6 + Math.sin(t * 3) * .6; if (hero === 'lyra') model.glow.rotation.y = t * 1.2; }
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
