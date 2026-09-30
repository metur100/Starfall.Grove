import type { HeroId, LevelId } from '../../src/game/types';

// What the landing page tells about each hero, beyond what the game's own hero data (spells.ts) already says:
// the story they play, the guardians Umbra's shadow becomes for them, and the land shown behind them.

export type HeroPitch = { epithet: string; story: string; guardians: string[]; land: LevelId; companion?: string };

export const PITCH: Record<HeroId, HeroPitch> = {
  mira: {
    epithet: 'The Apprentice',
    story: 'Master Orrin vanished the night the star fell. With Tuft the fox on his scent, Mira follows his trail across the valley and learns what the three lights were lit to hold back.',
    guardians: ['Mossback', 'Bramble Warden', 'The Hollow Star', 'Pyrrhus', 'The Eclipse Sovereign'],
    land: 'summit', companion: 'Tuft the fox',
  },
  kael: {
    epithet: 'The Oathsworn',
    story: 'Ser Aldric made his last stand the night the Beacon died. Kael musters the farms and the city guard, finds the Wardens’ lost hall and swears to bring his knight home.',
    guardians: ['The Hollow Bulwark', 'Ser Briarthorn', 'The Frost Marshal', 'The Iron Colossus', 'The Black Oath'],
    land: 'meadow',
  },
  lyra: {
    epithet: 'Winter’s Daughter',
    story: 'Her sister Nessa vanished on the lake road, her letters scattered in the snow. Following them, Lyra learns her family are Rimewards, frost-singers, and that some songs need two voices.',
    guardians: ['Gloamgill', 'The Pale Huntress', 'Queen Hoarfrost', 'Cinderwyrm', 'The Endless Winter Night'],
    land: 'woods',
  },
  riven: {
    epithet: 'The Foundling',
    story: 'His last contract for the Hushed ended in black feathers and a shadow he knew. Riven steals the Beacon’s crystals back, finds the foundling house he grew up in and faces a double wearing his face.',
    guardians: ['Corvane', 'Silkmother Vesh', 'Nullface', 'The Ashen Broker', 'The Shadow That Chose'],
    land: 'ember',
  },
  wren: {
    epithet: 'The Pack',
    story: 'The valley blames the wolves. Wren knows better: her pack ran into the shadow the night the star fell. With Fenn at her heel she hunts the truth and goes looking for Moonfang.',
    guardians: ['Gorehide', 'Shadowmane', 'Skyhorn', 'The Duneworm', 'The Moon-Eater'],
    land: 'meadow', companion: 'Fenn the wolf',
  },
};

/** How each hero plays, as the game's own select screen shows it (pips out of five). */
export const TRAITS: Record<HeroId, Array<[string, number]>> = {
  mira: [['Range', 5], ['Toughness', 1], ['Magic', 5], ['Speed', 3]],
  kael: [['Range', 1], ['Toughness', 5], ['Might', 5], ['Speed', 3]],
  lyra: [['Range', 5], ['Toughness', 2], ['Control', 5], ['Speed', 3]],
  riven: [['Range', 2], ['Toughness', 3], ['Burst', 5], ['Speed', 4]],
  wren: [['Range', 5], ['Toughness', 3], ['Companion', 5], ['Speed', 5]],
};

/** The game remembers the hero picked last under this key; "Play as" sets it so the game opens on that hero. */
export const CHOICE_KEY = 'starfall-grove-hero-choice';
export function playAs(hero: HeroId) {
  try { localStorage.setItem(CHOICE_KEY, hero); } catch { /* the game falls back to its own choice */ }
}
