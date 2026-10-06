import type { HeroId, NpcLook } from './types';

// Cutscenes: the camera leaves the hero and tells a piece of the story in shots.
//
// A shot points the camera at `at` (a place id such as 'meadow:rise', 'npc:<id>', 'obj:<id>', 'hero', or a quest spot
// such as '$ward') moved by dx/dy, shows a caption, runs effects and brings people on stage. `cut` fades to black and
// jumps instead of panning. Without `at` the camera stays where it is. A title shot shows big words instead of a caption.
// A hero's own version of a cutscene is stored as '<id>@<hero>'.
export type CineFxKind = 'starfall' | 'shadow' | 'gloom' | 'wolves' | 'imps' | 'wisps' | 'fire' | 'douse' | 'collapse' | 'light' | 'smoke' | 'build' | 'shatter' | 'wither' | 'memory' | 'quake' | 'ring'
  | 'kindle' | 'snuff' | 'feathers' | 'letters' | 'frost' | 'howl' | 'lantern' | 'embers';
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
  littleRiven: look({ robe: '#3a3048', hat: 'hood', hatColor: '#2a2438', hair: '#1a1a24', small: true }),
  youngAldric: look({ robe: '#3f5a8a', hat: 'helm', hatColor: '#b8bcc6', hair: '#6b3f2a' }),
  youngTobb: look({ robe: '#3f5a8a', hat: 'helm', hatColor: '#9aa0aa', hair: '#a0785a' }),
  brin: look({ robe: '#3f5a8a', hat: 'helm', hatColor: '#b8bcc6', hair: '#b8743c' }),
  bram: look({ robe: '#a0785a', hat: 'straw', hatColor: '#d9b45a', beard: true }),
};
const title = (t: string, sub: string, dur = 3.4): Shot => ({ title: t, sub, dur });

/** Every hero's intro starts the same way: the star falls, the Beacon dies and the gloom rises. */
const opening: Shot[] = [
  { at: 'meadow:sunpetal', cut: true, night: .72, text: 'Sunpetal Valley, on the night everything changed.', dur: 3.4 },
  { at: 'meadow:sunpetal', dx: 300, dy: -220, text: 'A light tore across the sky: a star, falling east toward the Summit.', fx: [{ kind: 'starfall', dx: 1500, dy: -260, delay: .3 }], dur: 4.2 },
  { at: 'meadow:rise', cut: true, dy: -70, text: 'On the Beacon Rise, the old flame shuddered… and went out.', fx: [{ kind: 'kindle', dy: -80 }, { kind: 'snuff', dy: -80, delay: 1.1 }, { kind: 'shadow', dy: -80, delay: 1.3 }], dur: 4.6 },
  { at: 'meadow:sunpetal', dx: -420, dy: 300, cut: true, text: 'And out of the tall grass, the gloom came creeping.', fx: [{ kind: 'gloom', n: 5, delay: .4 }], dur: 4 },
];

export const CINES: Record<string, Shot[]> = {
  // ─────────────── after each hero's intro film: that hero's own night in the valley, the Beacon going dark, and where they wake
  'arrive@mira': [
    { at: 'meadow:rest', cut: true, night: .7, text: 'The Bridgekeeper’s Rest, the night the star fell. Mira slept by the fire. Master Orrin did not.', actors: [{ id: 'orrin', name: 'Master Orrin', look: LOOKS.orrin, dx: -30, dy: 50, walk: { dx: 640, dy: 180 } }], fx: [{ kind: 'lantern', dx: -30, dy: 20, to: { dx: 900, dy: 260 }, delay: 1.2 }], dur: 4.8 },
    { at: 'meadow:rise', cut: true, dy: -80, text: 'Far away on the Beacon Rise, the old flame was still burning…', fx: [{ kind: 'kindle', dy: -80 }], dur: 3.2 },
    { text: '…until a star tore across the sky, and the Beacon went dark.', fx: [{ kind: 'starfall', dy: -80 }, { kind: 'snuff', dy: -80, delay: 1.3 }, { kind: 'shadow', dy: -60, delay: 1.5 }], dur: 4.4 },
    { at: 'hero', cut: true, night: 0, text: 'By morning Orrin was gone. Tuft sat by the door with his nose pointed east.', dur: 4.2 },
    title('Mira', 'The Apprentice')],
  'arrive@kael': [
    { at: 'meadow:rise', cut: true, dy: -60, night: .7, text: 'The Beacon Rise. Kael and Ser Aldric kept the night watch beside the flame.', fx: [{ kind: 'kindle', dy: -20 }], actors: [{ id: 'aldric', name: 'Ser Aldric', look: LOOKS.aldric, dx: -80, dy: 110 }, { id: 'kael', name: 'Kael', look: LOOKS.kael, dx: 40, dy: 130, face: -1 }], dur: 4.4 },
    { text: 'At midnight the flame choked and died, and the shadow came up out of the stones.', fx: [{ kind: 'snuff', dy: -20, delay: .4 }, { kind: 'shadow', dx: -80, dy: 60, delay: .9 }, { kind: 'quake', delay: 1 }], dur: 4.2 },
    { speaker: 'Ser Aldric', portrait: '🛡️', text: '“Run, lad! Warn the valley! Hold the line where I can’t!”', dur: 3.8 },
    { at: 'meadow:millbrook', cut: true, night: .35, text: 'Kael ran through the dark until his legs gave out, into the hay at Millbrook Farm.', fx: [{ kind: 'gloom', n: 3, dx: 420, dy: 200 }], dur: 4.2 },
    { at: 'hero', night: 0, text: 'At dawn Farmer Bram found him there, still in his armour, still holding his sword.', dur: 4 },
    title('Kael', 'The Oathsworn')],
  'arrive@lyra': [
    { at: 'meadow:mirror', dx: 200, dy: -560, cut: true, night: .7, text: 'The lake road, the night the star fell. Nessa ran the late post along the shore.', actors: [{ id: 'nessa', name: 'Nessa', look: LOOKS.nessa, dx: -300, dy: 30, walk: { dx: 560, dy: 30 } }], dur: 4.4 },
    { at: 'meadow:rise', cut: true, dy: -80, text: 'Across the valley the Beacon flickered…', fx: [{ kind: 'kindle', dy: -80 }, { kind: 'snuff', dy: -80, delay: 1.4 }], dur: 3.8 },
    { at: 'meadow:mirror', dx: 200, dy: -560, cut: true, text: '…and went dark. The gloom rose out of the reeds, and Nessa’s letters flew away on the wind.', fx: [{ kind: 'gloom', n: 3, dx: -80 }, { kind: 'letters', dx: 260, delay: .6 }, { kind: 'wisps', n: 2, dx: 360, delay: 1.2 }], dur: 4.8 },
    { at: 'hero', cut: true, night: 0, text: 'At dawn Lyra came down to the shore. Wherever she walked, the reeds turned white.', fx: [{ kind: 'frost', delay: .5 }], dur: 4.4 },
    title('Lyra', 'Winter’s Daughter')],
  'arrive@riven': [
    { at: 'meadow:city', cut: true, dy: -60, night: .7, text: 'Goldenhearth, above the tannery. The Hushed counted their pay: a pouch of black feathers.', actors: [{ id: 'magpie', name: 'Magpie', look: LOOKS.magpie, dx: -40, dy: 40 }, { id: 'riven', name: 'Riven', look: LOOKS.riven, dx: 44, dy: 40, face: -1 }], fx: [{ kind: 'feathers', dy: 20, delay: .8 }], dur: 4.8 },
    { speaker: 'Magpie', portrait: '🐦‍⬛', text: '“One last job, Riven. The Beacon’s sun-crystals. Then you can vanish, like you always wanted.”', dur: 4.2 },
    { at: 'meadow:rise', cut: true, dy: -80, text: 'At midnight, from the rooftops, Riven watched the Beacon die.', fx: [{ kind: 'kindle', dy: -80 }, { kind: 'snuff', dy: -80, delay: 1.2 }, { kind: 'shadow', dy: -60, delay: 1.4 }], dur: 4.4 },
    { text: 'What poured out of it was the same shadow Riven was born with.', fx: [{ kind: 'feathers', dy: -60 }], dur: 3.6 },
    { at: 'hero', cut: true, night: 0, text: 'Riven left the feathers on the table and walked out into the morning crowd.', dur: 4 },
    title('Riven', 'The Foundling')],
  'arrive@wren': [
    { at: 'meadow:camp', cut: true, night: .7, text: 'The Hunter’s Camp. Wren’s wolves lifted their heads and howled at the falling star.', actors: [{ id: 'fenn', beast: true, dx: 40, dy: 70, face: -1 }], fx: [{ kind: 'starfall', dy: -200 }, { kind: 'howl', dx: 160, delay: .8 }], dur: 4.6 },
    { at: 'meadow:rise', cut: true, dy: -80, text: 'On the Rise the Beacon went dark, and the shadow answered the howl.', fx: [{ kind: 'kindle', dy: -80 }, { kind: 'snuff', dy: -80, delay: 1 }, { kind: 'shadow', dy: -60, delay: 1.2 }], dur: 4.2 },
    { at: 'meadow:stones', cut: true, text: 'One by one the pack’s eyes went black, and they ran with the shadow over the Old Stone Garden.', fx: [{ kind: 'wolves', n: 4, dx: 200 }, { kind: 'howl', dx: 300, delay: 1.5 }], dur: 4.6 },
    { at: 'hero', cut: true, night: 0, text: 'Only Fenn stayed. At dawn Wren found their tracks among the stones.', dur: 4 },
    title('Wren', 'The Pack')],
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
    { speaker: 'Elder Rowan', portrait: '🧙🏼', text: '“They’re coming for the houses! Drive them back into the grass!”', dur: 3.4 }],
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
    { speaker: 'Warden Thessaly', portrait: '🛡️', text: '“Into the streets! If they reach the houses, the whole market burns!”', dur: 3.4 }],
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
    { speaker: 'Quartermaster Dov', portrait: '💂', text: '“Hold the camp! If the pass falls, the road to the Spire falls with it!”', dur: 3.6 }],
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
    { speaker: 'Captain Ashka', portrait: '💂‍♀️', text: '“To the tents! Nobody sleeps until the outpost stands!”', dur: 3.2 }],
  'pyrrhus-wakes': [
    { at: 'ember:forge', dy: -60, text: 'The great bellows heave. For the first time in weeks, the Dawn Forge breathes.', fx: [{ kind: 'build' }], dur: 3.8 },
    { text: 'The ground splits, and magma wells up around the anvil…', fx: [{ kind: 'quake' }, { kind: 'fire', n: 2, t: 30, delay: .4 }], dur: 3.6 },
    { text: '…and Pyrrhus, the Cinder Tyrant, rises out of the fire, furious that anyone dared to wake his forge.', fx: [{ kind: 'shadow', delay: .2 }], dur: 4.6 }],
  // The ground gives way under the hero after the last guardian falls: down into the depths, where Umbra waits.
  'depths-fall': [
    { at: 'ember:forge', dy: -40, text: 'The last guardian crumbles. For a heartbeat the wastes are silent…', fx: [{ kind: 'embers', dy: -40 }], dur: 3.2 },
    { text: '…then the ground shakes. Every shadow in the four lands pours toward the Forge and sinks into the earth beneath it.', fx: [{ kind: 'quake' }, { kind: 'shadow', delay: .5 }, { kind: 'smoke', dx: -900, dy: -300, to: { dx: 900, dy: 300 }, delay: .2 }], dur: 4.6 },
    { at: 'obj:ember:hole', cut: true, text: 'The ground splits open, and the dark drags you down with it.', fx: [{ kind: 'collapse' }, { kind: 'quake', delay: .3 }], dur: 3.6 },
    title('The Depths', 'Beneath the Dawn Forge', 3.2)],
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
    { text: 'Snowmoon lifts her head. Fenn creeps close, and she licks his ear once, the way she did when he was a pup.', dur: 4.8 },
    { text: 'Then she stands and walks into the green, and the leaves close behind her like a door.', fx: [{ kind: 'memory', dx: 50 }], dur: 4.4 }],
  // ─────────────── more of the heroes’ own stories
  'orrin-lanterns': [
    { at: 'meadow:sunpetal', night: .55, text: '(The third lantern flares, and for a moment the lane remembers another night.)', fx: [{ kind: 'memory' }], dur: 3.6 },
    { dx: 120, text: 'Master Orrin, lantern held high, hurrying east past the well…', actors: [{ id: 'morrin', name: 'Master Orrin', look: LOOKS.orrin, dx: -120, dy: 40, walk: { dx: 520, dy: -60 } }], fx: [{ kind: 'lantern', dx: -120, dy: 20, to: { dx: 900, dy: -400 }, delay: .4 }], dur: 4.8 },
    { speaker: 'Master Orrin', portrait: '🧙‍♂️', text: '“Stay at the Rest, Mira. And if I am not back by morning… follow the lights.”', dur: 4.4 },
    { at: 'hero', night: 0, text: 'He left the lanterns burning for her. He knew she wouldn’t stay.', dur: 3.8 }],
  'mira-shrine': [
    { at: '$ward', dy: -40, night: .5, text: 'Wisps pour out of the dark woods toward the Moss Shrine, where Orrin’s voice still sleeps in the stones.', fx: [{ kind: 'wisps', n: 4, dx: 360, dy: 100 }], dur: 4.2 },
    { speaker: 'Tuft', portrait: '🦊', text: '(Tuft plants his paws on the shrine step and growls. Nobody touches Orrin’s runes.)', dur: 3.8 }],
  'barricade-kael': [
    { at: '$site', dy: -30, text: 'The last stake goes in. Millbrook has a wall again, and a Warden built it.', fx: [{ kind: 'build' }], dur: 3.8 },
    { at: '$site', dx: 360, dy: -100, night: .45, text: 'That night the gloomlings came to the fence… sniffed at it… and turned back.', fx: [{ kind: 'gloom', n: 3 }], dur: 4.2 },
    { at: '$site', night: 0, speaker: 'Farmer Bram', portrait: '👨‍🌾', text: '“Your Warden would be proud of you, lad. I know I am.”', actors: [{ id: 'cbram', name: 'Farmer Bram', look: LOOKS.bram, dx: -60, dy: 40 }], dur: 3.8 }],
  'wardens-oath': [
    { at: 'npc:meadow:brannoc', text: 'Warden Brin kneels before Captain Brannoc and lays down her broken spear.', actors: [{ id: 'cbrin', name: 'Warden Brin', look: LOOKS.brin, dx: -60, dy: 30 }], dur: 4 },
    { speaker: 'Warden Brin', portrait: '🛡️', text: '“Two Wardens left in the whole valley, then. You and me, squire. We’ll have to be enough.”', dur: 4.4 },
    { at: 'meadow:rise', cut: true, dy: -80, night: .5, text: 'Far off on its hill, the cold Beacon waits for anyone brave enough to climb the Rise.', fx: [{ kind: 'ring', dy: -80 }], dur: 4 },
    { at: 'hero', cut: true, night: 0, text: 'Kael tightens the straps on Aldric’s shield.', dur: 3 }],
  'warden-lore': [
    { at: 'npc:woods:thessaly', night: .35, text: '(Old Tobb sits down by the fire and, for the first time in years, tells the story.)', fx: [{ kind: 'memory' }], dur: 3.6 },
    { text: 'Forty winters ago, two squires held the Silver Pass alone for a whole night: Tobb, and a boy called Aldric.', actors: [{ id: 'yald', name: 'Young Aldric', look: LOOKS.youngAldric, dx: -60, dy: 30, face: 1 }, { id: 'ytobb', name: 'Young Tobb', look: LOOKS.youngTobb, dx: 60, dy: 30, face: -1 }], fx: [{ kind: 'embers', dy: 40, delay: .5 }], dur: 5 },
    { speaker: 'Old Tobb', portrait: '🧓', text: '“He never once stepped back. Not for wolves, not for winter. You fight like him, you know. Like a wall.”', dur: 4.6 },
    { at: 'hero', night: 0, text: 'Hold the line where I cannot. Aldric learned it on that pass.', dur: 3.6 }],
  'nessa-echo': [
    { at: 'meadow:mirror', dx: 200, dy: -560, night: .6, text: '(The frost runes ring like bells. Frost races across the water, and the lake remembers.)', fx: [{ kind: 'frost' }, { kind: 'memory', delay: .6 }], dur: 4 },
    { text: 'Nessa, the night the star fell, running along this very shore.', actors: [{ id: 'enessa', name: 'Nessa', look: LOOKS.nessa, dx: -300, dy: 30, walk: { dx: 560, dy: 40 } }], fx: [{ kind: 'letters', dx: 100, delay: 1.6 }], dur: 4.8 },
    { text: 'Behind her, pale shapes came drifting out of the reeds.', fx: [{ kind: 'wisps', n: 3, dx: -260 }], dur: 3.8 },
    { at: 'hero', night: 0, speaker: 'Lyra', portrait: '❄️', text: '“Frost wraiths. They come down from the Summit. Hold on, Nessa. I’m coming.”', dur: 4 }],
  'rider-flees': [
    { at: '$thief', text: 'The pale rider shrieks, and a gust of snow tears it free of your grip.', fx: [{ kind: 'frost' }], dur: 3.6 },
    { dy: -200, text: 'It streaks away north over the treetops, toward the white peaks of the Summit.', fx: [{ kind: 'lantern', to: { dx: 1400, dy: -1400 } }, { kind: 'wisps', n: 2, delay: .8 }], dur: 4 },
    { at: 'hero', speaker: 'Lyra', portrait: '❄️', text: '“North. They took her north. Then so do I.”', dur: 3.4 }],
  'feather-trail': [
    { at: 'meadow:willow', night: .5, text: 'The last feather lies on the Willowmere jetty. Someone stood here, that night, and waited.', fx: [{ kind: 'feathers' }], dur: 4 },
    { text: 'A girl in a black cloak, with a shadow that moved when she didn’t.', actors: [{ id: 'esable2', name: '???', look: LOOKS.sable, dx: 120, dy: -20, walk: { dx: 320, dy: -200 } }], fx: [{ kind: 'feathers', dx: 120, delay: 1 }, { kind: 'shadow', dx: 440, dy: -220, delay: 3.4 }], dur: 5 },
    { at: 'hero', night: 0, speaker: 'Riven', portrait: '🗡️', text: '“I know that walk. I learned it from her.”', dur: 3.8 }],
  'foundling-memory': [
    { at: 'npc:woods:juna', text: '(Tib clutches Riven’s sleeve. Riven remembers another frightened child.)', fx: [{ kind: 'memory' }], dur: 3.6 },
    { night: .4, text: 'The foundling house, years ago. Two children who could make the candles flicker without touching them.', actors: [{ id: 'lsable', name: 'Little Sable', look: LOOKS.littleSable, dx: -50, dy: 30 }, { id: 'lriven', name: 'Little Riven', look: LOOKS.littleRiven, dx: 40, dy: 30, face: -1 }], fx: [{ kind: 'feathers', delay: 1.5 }], dur: 5 },
    { speaker: 'Little Sable', portrait: '👧', text: '“If they ever send you away, I’ll find you. Promise.”', dur: 4 },
    { at: 'hero', night: 0, text: 'She kept that promise, in her way. So will Riven.', dur: 3.8 }],
  'pack-attack': [
    { at: '$ward', dy: -40, night: .55, text: 'Dusk at the Hunter’s Camp. Out in the dark, a howl Wren knows by heart.', fx: [{ kind: 'howl', dx: 420, dy: -120 }], dur: 4 },
    { at: '$ward', dx: 420, dy: -120, text: 'Her own pack, eyes burning black, circling the camp.', fx: [{ kind: 'wolves', n: 4 }], dur: 4 },
    { at: '$ward', speaker: 'Hunter Garrick', portrait: '🏹', text: '“Hold the camp, girl. Drive them off. They were ours once. Maybe they will be again.”', dur: 4.2 }],
};

/** A hero's own version of a cutscene wins over the shared one. */
export function cineFor(id: string, hero: HeroId): Shot[] | null { return CINES[`${id}@${hero}`] || CINES[id] || null; }
