import type { HeroId, NpcLook } from './types';

// Cutscenes: the camera leaves the hero and tells a piece of the story in shots.
//
// A shot points the camera at `at` (a place id such as 'meadow:rise', 'npc:<id>', 'obj:<id>', 'hero', or a quest spot
// such as '$ward') moved by dx/dy, shows a caption, runs effects and brings people on stage. `cut` fades to black and
// jumps instead of panning. Without `at` the camera stays where it is. A title shot shows big words instead of a caption.
// A hero's own version of a cutscene is stored as '<id>@<hero>'.
export type CineFxKind = 'starfall' | 'shadow' | 'gloom' | 'wolves' | 'imps' | 'wisps' | 'fire' | 'douse' | 'collapse' | 'light' | 'smoke' | 'build' | 'shatter' | 'wither' | 'memory' | 'quake' | 'ring';
export type CineFx = { kind: CineFxKind; at?: string; dx?: number; dy?: number; n?: number; delay?: number; t?: number; to?: { dx: number; dy: number } };
export type CineActor = { id: string; name?: string; look?: Partial<NpcLook>; dx?: number; dy?: number; walk?: { dx: number; dy: number }; face?: 1 | -1; beast?: boolean; spirit?: boolean };
/** `night` (0…1) darkens the world from this shot on, for scenes that happen after dark. */
export type Shot = { at?: string; dx?: number; dy?: number; text?: string; speaker?: string; portrait?: string; dur?: number; cut?: boolean; fx?: CineFx[]; actors?: CineActor[]; title?: string; sub?: string; night?: number };

const look = (l: Partial<NpcLook>): Partial<NpcLook> => ({ skin: '#f0c8a2', hat: 'none', hatColor: '#5b5480', hair: '#6b3f2a', ...l });
export const LOOKS = {
  orrin: look({ robe: '#5b5480', hat: 'wizard', hatColor: '#3f3a70', beard: true, hair: '#e8e2d0' }),
  youngOrrin: look({ robe: '#5b5480', hat: 'wizard', hatColor: '#3f3a70', beard: true, hair: '#8a6a4a' }),
  sable: look({ robe: '#2a2438', hat: 'hood', hatColor: '#1a1428', hair: '#1a1a24' }),
  littleSable: look({ robe: '#3a3458', hair: '#1a1a24', small: true }),
  aldric: look({ robe: '#3f5a8a', hat: 'helm', hatColor: '#b8bcc6', beard: true, hair: '#8a8a8a' }),
  blackKnight: look({ robe: '#1a1624', hat: 'helm', hatColor: '#2a2438', skin: '#3a3048', hair: '#1a1624' }),
  kael: look({ robe: '#8a3a2a', hat: 'helm', hatColor: '#c9cfd8', hair: '#6b3f2a' }),
  nessa: look({ robe: '#6f8fb8', hat: 'scarf', hatColor: '#dff6ff', hair: '#e8e2d0', small: true }),
  magpie: look({ robe: '#2e2a36', hat: 'hood', hatColor: '#1e1a26', hair: '#2e2420' }),
  riven: look({ robe: '#3a3048', hat: 'hood', hatColor: '#2a2438', hair: '#1a1a24' }),
};
const title = (t: string, sub: string, dur = 3.4): Shot => ({ title: t, sub, dur });

/** Every hero's intro starts the same way: the star falls, the Beacon dies and the gloom rises. */
const opening: Shot[] = [
  { at: 'meadow:sunpetal', cut: true, night: .72, text: 'Sunpetal Valley, on the night everything changed.', dur: 3.4 },
  { at: 'meadow:sunpetal', dx: 300, dy: -220, text: 'A light tore across the sky: a star, falling east toward the Summit.', fx: [{ kind: 'starfall', dx: 1500, dy: -260, delay: .3 }], dur: 4.2 },
  { at: 'meadow:rise', cut: true, dy: -70, text: 'On the Beacon Rise, the old flame shuddered… and went out.', fx: [{ kind: 'shadow', dy: -80, delay: .7 }], dur: 4.2 },
  { at: 'meadow:sunpetal', dx: -420, dy: 300, cut: true, text: 'And out of the tall grass, the gloom came creeping.', fx: [{ kind: 'gloom', n: 5, delay: .4 }], dur: 4 },
];

/** After a hero's intro film: a short look at the valley as it is now, then the hero where they woke. */
const arrival = (text: string, name: string, sub: string): Shot[] => [
  { at: 'meadow:rise', cut: true, dy: -70, night: .6, text: 'The Beacon Rise. Last night its light went out, and the dark came up out of the stones.', fx: [{ kind: 'shadow', dy: -80, delay: .5 }], dur: 4 },
  { at: 'meadow:sunpetal', dx: -420, dy: 300, cut: true, text: 'Now gloomlings creep through the tall grass, closer every dusk.', fx: [{ kind: 'gloom', n: 5, delay: .3 }], dur: 3.8 },
  { at: 'hero', cut: true, night: 0, text, dur: 4.2 },
  title(name, sub)];

export const CINES: Record<string, Shot[]> = {
  'arrive@mira': arrival('Morning at the Bridgekeeper’s Rest. Orrin’s lantern is gone, and Tuft is pointing east.', 'Mira', 'The Apprentice'),
  'arrive@kael': arrival('Morning at Millbrook Farm. Kael wakes in the hay, with Aldric’s last words still ringing.', 'Kael', 'The Oathsworn'),
  'arrive@lyra': arrival('Morning on the shore of Mirror Lake, where Nessa’s road ran. The reeds are white with Lyra’s frost.', 'Lyra', 'Winter’s Daughter'),
  'arrive@riven': arrival('Morning in Goldenhearth. Riven walks away from the Hushed for good, and into the crowd.', 'Riven', 'The Foundling'),
  'arrive@wren': arrival('Morning at the Old Stone Garden. The pack’s tracks run west, and Fenn won’t leave Wren’s side.', 'Wren', 'The Pack'),
  // ─────────────── intros, one per hero
  'intro@mira': [...opening,
    { at: 'meadow:rest', cut: true, text: 'At the Bridgekeeper’s Rest, Master Orrin took up his lantern and walked out into the dark.', actors: [{ id: 'orrin', name: 'Master Orrin', look: LOOKS.orrin, dx: -40, dy: 50, walk: { dx: 560, dy: 170 } }], dur: 5 },
    { speaker: 'Master Orrin', portrait: '🧙‍♂️', text: '“Stay here, Mira. Whatever you see tonight, stay here.”', dur: 4 },
    { at: 'hero', night: 0, text: 'By morning he was gone. Tuft was scratching at the door, nose pointed east.', dur: 4.2 },
    title('Mira', 'The Apprentice')],
  'intro@kael': [...opening,
    { at: 'meadow:rise', cut: true, text: 'Kael stood the night watch at the Rise beside Ser Aldric, Warden of the Rise, his teacher.', actors: [{ id: 'aldric', name: 'Ser Aldric', look: LOOKS.aldric, dx: -70, dy: 100 }, { id: 'kael', name: 'Kael', look: LOOKS.kael, dx: 50, dy: 120, face: -1 }], dur: 4.6 },
    { text: 'When the shadow burst out of the stones, Aldric threw himself in front of it…', fx: [{ kind: 'shadow', dx: -70, dy: 70 }, { kind: 'quake', delay: .3 }], dur: 3.8 },
    { speaker: 'Ser Aldric', portrait: '🛡️', text: '“Run, lad! Warn the valley! Hold the line where I can’t!”', dur: 4 },
    { at: 'hero', cut: true, night: 0, text: 'Kael woke at dawn in the hay at Millbrook Farm, with those words still ringing. The Warden never came down the hill.', dur: 4.6 },
    title('Kael', 'The Oathsworn')],
  'intro@lyra': [...opening,
    { at: 'meadow:mirror', dx: 200, dy: -560, cut: true, text: 'On the lake road, a courier ran through the dark with a satchel of letters. Nessa, Lyra’s little sister.', actors: [{ id: 'nessa', name: 'Nessa', look: LOOKS.nessa, dx: -240, dy: 30, walk: { dx: 460, dy: 30 } }], dur: 4.8 },
    { text: 'The gloom rose all around her, and her letters scattered like leaves.', fx: [{ kind: 'gloom', n: 4, dx: 240 }], dur: 4 },
    { at: 'hero', cut: true, night: 0, text: 'Far up in the Silver Heights, Lyra felt it: a cold that was not the weather. By dawn she stood on the shore of Mirror Lake, on her sister’s road.', dur: 5.2 },
    title('Lyra', 'Winter’s Daughter')],
  'intro@riven': [...opening,
    { at: 'meadow:city', cut: true, dy: -60, text: 'In Goldenhearth, in a room above the tannery, the Hushed took a strange contract: steal the Beacon’s sun-crystals. The pay: a pouch of black feathers.', actors: [{ id: 'magpie', name: 'Magpie', look: LOOKS.magpie, dx: -40, dy: 40 }, { id: 'riven', name: 'Riven', look: LOOKS.riven, dx: 44, dy: 40, face: -1 }], dur: 5.6 },
    { speaker: 'Magpie', portrait: '🐦‍⬛', text: '“One last job, Riven. Then you can vanish, like you always wanted.”', dur: 4 },
    { at: 'meadow:rise', cut: true, dy: -60, text: 'But when the Beacon died, Riven saw what poured out of it: the same shadow Riven was born with.', fx: [{ kind: 'shadow', dy: -60 }], dur: 4.6 },
    { at: 'hero', cut: true, night: 0, text: 'Riven left the Hushed before sunrise, and left the black feathers on the table.', dur: 4 },
    title('Riven', 'The Foundling')],
  'intro@wren': [...opening,
    { at: 'meadow:camp', cut: true, text: 'At the Hunter’s Camp, Wren’s wolves lifted their heads and howled at the falling star.', actors: [{ id: 'fenn', beast: true, dx: 40, dy: 70, face: -1 }], dur: 4.4 },
    { text: 'The shadow answered. One by one the pack’s eyes went black, and they ran into the night.', fx: [{ kind: 'shadow', dx: 220 }, { kind: 'wolves', n: 4, dx: 240, delay: .3 }], dur: 4.6 },
    { at: 'hero', cut: true, night: 0, text: 'Only Fenn, the youngest, stayed at her side. Wren followed the tracks as far as the Old Stone Garden.', dur: 4.6 },
    title('Wren', 'The Pack')],

  // ─────────────── Chapter I
  'sunpetal-attack': [
    { at: '$ward', dy: -40, night: .45, text: 'Dusk falls over Sunpetal, and the tall grass begins to move.', fx: [{ kind: 'gloom', n: 4, dx: 380, dy: 140 }], dur: 3.8 },
    { text: 'A spark catches a thatched roof. The village bell rings out!', fx: [{ kind: 'fire', n: 2, t: 120 }], dur: 3.6 },
    { speaker: 'Elder Rowan', portrait: '🧙🏼', text: '“Protect the barricade! Don’t let them reach the houses!”', dur: 3.4 }],
  'beacon-lit': [
    { at: 'meadow:rise', dy: -90, text: 'The Beacon roars back to life. Gold light spills across the meadow.', fx: [{ kind: 'light', dy: -90 }], dur: 4 },
    { at: 'obj:meadow:barrier', cut: true, text: 'Its light reaches all the way to the Eastern Gate… where the old Gloomwater Bridge lies in the river, broken the night the star fell.', fx: [{ kind: 'collapse' }], dur: 5.2 },
    { at: 'npc:meadow:holt', text: 'Bridgewright Holt is already there, staring at the wreck and scratching his head.', dur: 3.8 }],
  'chapter-meadow': [
    { at: 'obj:meadow:barrier', text: 'Plank by plank, the Gloomwater Bridge stands again.', fx: [{ kind: 'build' }], dur: 3.6 },
    { at: 'obj:meadow:barrier', dx: 900, text: 'Beyond it, the road dives under ancient trees: Whisperroot Woods.', dur: 3.8 },
    { at: 'woods:bell', cut: true, dy: -60, text: 'Deep in the woods, the Ancient Bell hangs silent, strangled in black roots.', fx: [{ kind: 'shadow', dy: -60 }], dur: 4.4 },
    title('Chapter II', 'The Bell Beneath the Roots')],

  // ─────────────── Chapter II
  'glade-memory': [
    { at: 'woods:glade', text: 'The last lantern catches. The glade fills with silver light…', fx: [{ kind: 'memory' }], dur: 3.6 },
    { text: '…and the rune shows what it remembers: a younger Orrin, and a little girl with a lantern almost as big as she is.', actors: [{ id: 'yorrin', name: 'Orrin', look: LOOKS.youngOrrin, dx: -50, dy: 50 }, { id: 'ysable', name: 'Sable', look: LOOKS.littleSable, dx: 30, dy: 60, face: -1 }], dur: 5.6 },
    { speaker: 'Little Sable', portrait: '👧', text: '“When I’m big, I’ll light every lantern in the valley. Then the dark won’t hurt anybody.”', dur: 4.6 },
    { text: 'The light fades. The glade is empty again.', fx: [{ kind: 'memory' }], dur: 3 }],
  'bell-rung': [
    { at: 'woods:bell', dy: -80, text: 'The Ancient Bell rings out, and its voice rolls through every root in Whisperroot.', fx: [{ kind: 'light', dy: -80 }], dur: 4 },
    { at: 'woods:city', cut: true, dx: 520, dy: -320, text: 'But deep in the woods, something answers with a howl. The shadow is not ready to give up its forest.', fx: [{ kind: 'wolves', n: 5 }, { kind: 'shadow', delay: .4 }], dur: 4.8 },
    { at: 'npc:woods:thessaly', text: 'In Lanternmarket, Warden Thessaly is calling the watch to arms.', dur: 3.6 }],
  'lantern-siege': [
    { at: '$ward', dy: -40, text: 'Shadewolves pour out of the trees, and one by one the lanterns of Lanternmarket go dark.', fx: [{ kind: 'wolves', n: 4, dx: 420 }, { kind: 'fire', n: 2, t: 140, delay: .8 }], dur: 4.6 },
    { speaker: 'Warden Thessaly', portrait: '🛡️', text: '“Hold the lantern gate! If it falls, the whole market burns!”', dur: 3.4 }],
  'chapter-woods': [
    { at: 'obj:woods:barrier', text: 'The Bell-lanterns blaze, and the Bell’s last echo rolls down the road…', fx: [{ kind: 'light' }], dur: 3.6 },
    { text: '…and the wall of thorns at the Eastern Gate withers into dust.', fx: [{ kind: 'wither' }], dur: 3.8 },
    { at: 'summit:cradle', cut: true, dy: -80, text: 'High above, on Starfall Summit, the fallen star glows black in its Cradle. Something inside it is waking.', fx: [{ kind: 'shadow', dy: -80 }], dur: 5 },
    title('Chapter III', 'The Hollow Star')],

  // ─────────────── Chapter III
  'tarn-vision': [
    { at: 'summit:tarn', text: 'You look into Mirrorsky Tarn. The water goes as still as glass…', fx: [{ kind: 'memory' }], dur: 3.4 },
    { at: 'summit:crystal', cut: true, text: '…and shows a light in Crystal Hollow,', fx: [{ kind: 'ring' }], dur: 2.8 },
    { at: 'summit:frostfang', cut: true, text: 'another high on Frostfang Crag,', fx: [{ kind: 'ring' }], dur: 2.8 },
    { at: 'summit:spire', cut: true, text: 'and a third at the Broken Spire: the three shards of the fallen star.', fx: [{ kind: 'ring' }], dur: 3.6 }],
  'orrin-memory': [
    { at: 'summit:cradle', cut: true, dy: -60, night: .5, text: 'Orrin’s memory: a winter night, years ago. He stands on the Summit with his staff raised to the sky.', actors: [{ id: 'morrin', name: 'Orrin', look: LOOKS.youngOrrin, dx: -80, dy: 70 }], dur: 4.8 },
    { text: 'He calls a star down to heal a little girl who hurts. The sky tears open.', fx: [{ kind: 'starfall', dy: -40 }], dur: 4 },
    { text: 'Something dark slips through the tear and curls up inside the falling light. Umbra.', fx: [{ kind: 'shadow', delay: .6 }], dur: 4.4 }],
  'pass-siege': [
    { at: '$ward', text: 'Void light spills over the ridge. Wisps and wraiths swarm toward Silver Pass.', fx: [{ kind: 'wisps', n: 5, dx: 420, dy: -200 }], dur: 4 },
    { speaker: 'Quartermaster Dov', portrait: '💂', text: '“Hold the barricade! If the pass falls, the road to the Spire falls with it!”', dur: 3.6 }],
  'star-rises': [
    { at: 'summit:cradle', dy: -100, text: 'The star rises from its Cradle, whole again, and the whole Summit shines.', fx: [{ kind: 'light', dy: -100 }], dur: 4 },
    { text: 'But a thread of black smoke tears loose from the broken shell…', fx: [{ kind: 'smoke', dy: -100, to: { dx: 1600, dy: 900 } }], dur: 3.8 },
    { at: 'obj:summit:barrier', cut: true, text: '…and flees east. Behind it, black ice creeps over the Eastern Gate and seals the pass.', fx: [{ kind: 'quake' }, { kind: 'shadow', delay: .3 }], dur: 4.6 },
    { at: 'npc:summit:orrin', cut: true, text: 'Orrin looks at Sable. For the first time in years, they are thinking the same thing.', dur: 4 }],
  'chapter-summit': [
    { at: 'obj:summit:barrier', text: 'Orrin raises his staff and Sable her hands: starlight and shadow, together.', actors: [{ id: 'corrin', name: 'Orrin', look: LOOKS.orrin, dx: -170, dy: 60 }, { id: 'csable', name: 'Sable', look: LOOKS.sable, dx: -170, dy: -60 }], fx: [{ kind: 'light', delay: .6 }, { kind: 'shadow', delay: 1.1 }], dur: 4.6 },
    { text: 'The black ice cracks from end to end, and shatters.', fx: [{ kind: 'shatter' }], dur: 3.4 },
    { at: 'ember:forge', cut: true, dy: -60, text: 'Beyond lie the Ember Wastes, where the Dawn Forge has gone cold… and a tyrant of cinder guards it.', fx: [{ kind: 'quake' }], dur: 4.8 },
    title('Chapter IV', 'The Dawn Forge')],

  // ─────────────── Chapter IV
  'outpost-siege': [
    { at: '$ward', text: 'Sparks rain from a black sky. Imps come shrieking out of the smoke toward Emberwatch Outpost.', fx: [{ kind: 'imps', n: 5, dx: 420, dy: -160 }, { kind: 'fire', n: 2, t: 140, delay: .6 }], dur: 4.4 },
    { speaker: 'Captain Ashka', portrait: '💂‍♀️', text: '“To the gate! Nobody sleeps until the outpost stands!”', dur: 3.2 }],
  'pyrrhus-wakes': [
    { at: 'ember:forge', dy: -60, text: 'The great bellows heave. For the first time in weeks, the Dawn Forge breathes.', fx: [{ kind: 'build' }], dur: 3.8 },
    { text: 'The ground splits, and magma wells up around the anvil…', fx: [{ kind: 'quake' }, { kind: 'fire', n: 2, t: 30, delay: .4 }], dur: 3.6 },
    { text: '…and Pyrrhus, the Cinder Tyrant, rises out of the fire, furious that anyone dared to wake his forge.', fx: [{ kind: 'shadow', delay: .2 }], dur: 4.6 }],
  'chapter-ember': [
    { at: 'ember:forge', dy: -60, text: 'The Dawn Forge burns white and gold, and a new dawn spills across the wastes.', fx: [{ kind: 'light', dy: -60 }], dur: 4.4 },
    { at: 'summit:cradle', cut: true, dy: -90, text: 'On the Summit, the Star shines in its Cradle.', fx: [{ kind: 'light', dy: -90 }], dur: 3.4 },
    { at: 'woods:bell', cut: true, dy: -60, text: 'In Whisperroot, the Bell rings for the dawn.', fx: [{ kind: 'light', dy: -60 }], dur: 3.4 },
    { at: 'meadow:rise', cut: true, dy: -80, text: 'And in the meadow, the Beacon blazes over the valley where it all began.', fx: [{ kind: 'light', dy: -80 }], dur: 4.2 },
    title('Every light is shining', 'The valley is whole again', 4)],

  // ─────────────── the heroes’ own stories
  'knight-vanish': [
    { at: '$thief', text: 'The black knight turns. For a heartbeat he lowers his sword, as if he knows you.', dur: 3.8 },
    { speaker: 'The Black Knight', portrait: '🖤', text: '“…Kael? No. Run, lad. Run while I can still—”', dur: 3.6 },
    { text: 'Shadow boils out of the visor, and the empty armour collapses into smoke.', fx: [{ kind: 'shadow' }], dur: 3.6 }],
  'sable-echo': [
    { at: 'woods:ruins', text: 'The third rune flares: moon, eye, door. The old shadow-game from the foundling house.', fx: [{ kind: 'memory' }], dur: 4 },
    { text: 'A shape of shadow rises from the stones: Sable, as she was at ten years old.', actors: [{ id: 'esable', name: 'Sable', look: LOOKS.littleSable, dy: 50, spirit: true }], dur: 4 },
    { speaker: 'Sable’s echo', portrait: '🌑', text: '“If you’re hearing this, Riven, you still remember our game. Don’t follow me. Please.”', dur: 5 },
    { text: 'The echo fades like breath on glass.', fx: [{ kind: 'shadow', dy: 40 }], dur: 3 }],
  'mira-star': [
    { at: 'ember:spring', dy: -60, text: 'Mira sets the last pane of starglass into the lantern and whispers the words Orrin taught her on her very first night.', dur: 4.8 },
    { text: 'The lantern fills with a light of her own: not Orrin’s, not the star’s. Hers.', fx: [{ kind: 'light', dy: -40 }], dur: 4 },
    { speaker: 'Tuft', portrait: '🦊', text: '(Tuft yips, tail wagging so hard the whole fox wiggles.)', dur: 3.4 }],
  'moonfang': [
    { at: 'ember:green', text: 'Under the last green tree lies a great white wolf, and the shadow is gone from her fur.', actors: [{ id: 'moonfang', beast: true, spirit: true, dx: 50, dy: 40, face: -1 }], fx: [{ kind: 'memory' }], dur: 4.8 },
    { text: 'Moonfang lifts her head. Fenn creeps close, and she licks his ear once, the way she did when he was a pup.', dur: 4.8 },
    { text: 'Then she stands and walks into the green, and the leaves close behind her like a door.', fx: [{ kind: 'memory', dx: 50 }], dur: 4.4 }],
};

/** A hero's own version of a cutscene wins over the shared one. */
export function cineFor(id: string, hero: HeroId): Shot[] | null { return CINES[`${id}@${hero}`] || CINES[id] || null; }
