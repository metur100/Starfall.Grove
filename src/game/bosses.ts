import type { EnemyKind, HeroId } from './types';

// Every hero meets their own guardians. Umbra's shadow takes the shape of what each hero fears most, so the creature
// that guards a land's light (and Umbra itself) looks, fights and is named differently for each of them. Mira meets the
// valley's old guardians as they always were (Mossback, the Bramble Warden, the Hollow Star, Pyrrhus and Umbra).

export type BossAction = 'slam' | 'boulders' | 'nova' | 'roots' | 'charge' | 'spiral' | 'meteors' | 'blink'
  /** Aimed fans of shots, a string of blinks that each end in a slam, the ground erupting around the hero, and a howl
   *  that calls a few creatures and throws a ring of shots. */
  | 'volley' | 'shadowstrike' | 'geysers' | 'howl';
export type BossShot = 'thorn' | 'void' | 'fire' | 'ice' | 'web' | 'knife';
/** What falls from the sky in `meteors`, and what bursts out of the ground in `geysers`. */
export type BossRain = 'meteor' | 'lava' | 'blizzard';
export type BossGround = 'slam' | 'root' | 'lava' | 'frostnova';
/** How a guardian is drawn: its body shape, colours and a detail that sets it apart. */
export type BossForm = 'knight' | 'beast' | 'wraith' | 'serpent' | 'spider' | 'colossus' | 'mask' | 'eclipse';
export type BossStyle = 'shield' | 'thorns' | 'helm' | 'forge' | 'crystal' | 'hood' | 'feathers' | 'mirror' | 'mask' | 'tusks' | 'wolf' | 'antlers' | 'sand' | 'fins';
export type BossLook = { form: BossForm; body: string; trim: string; glow: string; eye: string; style?: BossStyle };
export type BossVariant = {
  name: string; title: string; look: BossLook;
  /** Attacks by phase: two phases for a land's guardian, three for Umbra. */
  patterns: BossAction[][];
  shot: BossShot; rain?: BossRain; ground?: BossGround;
  /** Creatures it calls for help (defaults to the land's own). */
  summons?: EnemyKind[];
  /** Throws shots behind it while it charges. */
  trail?: boolean;
};
type Guardian = 'mossback' | 'brambleWarden' | 'hollowStar' | 'cinderTyrant' | 'eclipse';

const UMBRA_PHASES = (extra: BossAction[]): BossAction[][] => [
  ['slam', 'nova', extra[0], 'roots', 'charge'],
  ['spiral', 'meteors', 'blink', extra[1], 'nova', 'roots'],
  ['meteors', 'spiral', extra[0], 'charge', 'blink', extra[1], 'nova', 'slam'],
];

export const BOSS_VARIANTS: Partial<Record<HeroId, Partial<Record<Guardian, BossVariant>>>> = {
  kael: {
    mossback: { name: 'The Hollow Bulwark', title: 'Fallen Wardens of the Rise', shot: 'knife', ground: 'slam', trail: true,
      look: { form: 'knight', body: '#5d6675', trim: '#3f5a8a', glow: '#8fb8ff', eye: '#ff6b5b', style: 'shield' },
      patterns: [['slam', 'volley', 'charge', 'slam'], ['charge', 'volley', 'slam', 'geysers', 'charge', 'volley']] },
    brambleWarden: { name: 'Ser Briarthorn', title: 'The Oathbreaker Knight', shot: 'thorn', ground: 'root', trail: true,
      look: { form: 'knight', body: '#3f4a2e', trim: '#b08a3a', glow: '#b6df91', eye: '#ff8f3d', style: 'thorns' },
      patterns: [['roots', 'volley', 'charge', 'nova'], ['nova', 'roots', 'charge', 'volley', 'geysers', 'slam']] },
    hollowStar: { name: 'The Frost Marshal', title: 'Captain of the Wraith Host', shot: 'ice', rain: 'blizzard', ground: 'frostnova',
      look: { form: 'wraith', body: '#bfe8ff', trim: '#5a6fc0', glow: '#8ee8ff', eye: '#ffffff', style: 'helm' },
      patterns: [['volley', 'meteors', 'blink', 'nova'], ['meteors', 'blink', 'volley', 'nova', 'geysers', 'blink']] },
    cinderTyrant: { name: 'The Iron Colossus', title: 'War Engine of the Dawn Forge', shot: 'fire', rain: 'lava', ground: 'lava', trail: true,
      look: { form: 'colossus', body: '#3a2e2c', trim: '#ff7a3d', glow: '#ff9a3d', eye: '#fff1b8', style: 'forge' },
      patterns: [['slam', 'meteors', 'charge', 'geysers'], ['meteors', 'charge', 'geysers', 'slam', 'boulders', 'charge']] },
    eclipse: { name: 'Umbra', title: 'The Black Oath', shot: 'knife', rain: 'meteor', ground: 'slam', trail: true,
      look: { form: 'eclipse', body: '#05020c', trim: '#8fb8ff', glow: '#3f5a8a', eye: '#ff3b3b', style: 'shield' },
      patterns: UMBRA_PHASES(['volley', 'geysers']) },
  },
  lyra: {
    mossback: { name: 'Gloamgill', title: 'The Serpent of Mirror Lake', shot: 'ice', ground: 'slam',
      look: { form: 'serpent', body: '#3f6f6a', trim: '#b8e0c8', glow: '#8ee8ff', eye: '#ffd35c', style: 'fins' },
      patterns: [['spiral', 'charge', 'geysers', 'nova'], ['geysers', 'spiral', 'charge', 'nova', 'volley', 'charge']] },
    brambleWarden: { name: 'The Pale Huntress', title: 'Rider of the Winter Mist', shot: 'ice', rain: 'blizzard', ground: 'frostnova',
      look: { form: 'wraith', body: '#e8f4ff', trim: '#8ee8ff', glow: '#bfe8ff', eye: '#5a6fc0', style: 'hood' },
      patterns: [['volley', 'blink', 'nova', 'meteors'], ['blink', 'volley', 'meteors', 'nova', 'blink', 'geysers']] },
    hollowStar: { name: 'Queen Hoarfrost', title: 'Heart of the Frozen Star', shot: 'ice', rain: 'blizzard', ground: 'frostnova',
      look: { form: 'colossus', body: '#dff6ff', trim: '#8ee8ff', glow: '#c9b6ff', eye: '#5a6fc0', style: 'crystal' },
      patterns: [['meteors', 'slam', 'spiral', 'blink'], ['spiral', 'meteors', 'blink', 'slam', 'geysers', 'spiral']] },
    cinderTyrant: { name: 'Cinderwyrm', title: 'The Serpent in the Slag', shot: 'fire', rain: 'lava', ground: 'lava', trail: true,
      look: { form: 'serpent', body: '#4a2a24', trim: '#ff7a3d', glow: '#ff9a3d', eye: '#fff1b8', style: 'fins' },
      patterns: [['meteors', 'charge', 'nova', 'spiral'], ['spiral', 'meteors', 'charge', 'nova', 'geysers', 'charge']] },
    eclipse: { name: 'Umbra', title: 'The Endless Winter Night', shot: 'ice', rain: 'blizzard', ground: 'frostnova',
      look: { form: 'eclipse', body: '#05020c', trim: '#bfe8ff', glow: '#5a6fc0', eye: '#8ee8ff', style: 'crystal' },
      patterns: UMBRA_PHASES(['volley', 'geysers']) },
  },
  riven: {
    mossback: { name: 'Corvane', title: 'The Feathered Shade', shot: 'void', ground: 'slam',
      look: { form: 'mask', body: '#1e1a26', trim: '#6a4bd6', glow: '#8a6ff0', eye: '#ff6b9a', style: 'feathers' },
      patterns: [['shadowstrike', 'volley', 'blink', 'nova'], ['volley', 'shadowstrike', 'nova', 'blink', 'shadowstrike', 'geysers']] },
    brambleWarden: { name: 'Silkmother Vesh', title: 'Queen of Silkshadow', shot: 'web', ground: 'root',
      look: { form: 'spider', body: '#3a1e4a', trim: '#e8e0f0', glow: '#b6df91', eye: '#ff5a4a' },
      patterns: [['volley', 'roots', 'charge', 'nova'], ['nova', 'volley', 'charge', 'roots', 'geysers', 'volley']] },
    hollowStar: { name: 'Nullface', title: 'The Mask Without a Face', shot: 'void', rain: 'meteor', ground: 'slam',
      look: { form: 'mask', body: '#e8e2f0', trim: '#1a1030', glow: '#c9b6ff', eye: '#05020c', style: 'mirror' },
      patterns: [['spiral', 'shadowstrike', 'meteors', 'blink'], ['shadowstrike', 'spiral', 'blink', 'meteors', 'volley', 'shadowstrike']] },
    cinderTyrant: { name: 'The Ashen Broker', title: 'Umbra’s Hand in the Wastes', shot: 'fire', rain: 'lava', ground: 'lava',
      look: { form: 'wraith', body: '#4a3a3a', trim: '#ff9a3d', glow: '#ff7a3d', eye: '#fff1b8', style: 'mask' },
      patterns: [['shadowstrike', 'meteors', 'volley', 'nova'], ['meteors', 'shadowstrike', 'nova', 'volley', 'geysers', 'shadowstrike']] },
    eclipse: { name: 'Umbra', title: 'The Shadow That Chose', shot: 'void', rain: 'meteor', ground: 'slam',
      look: { form: 'eclipse', body: '#05020c', trim: '#ff6b9a', glow: '#6a1a3a', eye: '#ff3b6b', style: 'feathers' },
      patterns: UMBRA_PHASES(['shadowstrike', 'volley']) },
  },
  wren: {
    mossback: { name: 'Gorehide', title: 'The Boar King of the Rise', shot: 'thorn', ground: 'root',
      look: { form: 'beast', body: '#6a3a24', trim: '#a3c46a', glow: '#b9f29d', eye: '#ff5a4a', style: 'tusks' },
      patterns: [['charge', 'slam', 'boulders', 'charge'], ['charge', 'boulders', 'slam', 'howl', 'charge', 'geysers']] },
    brambleWarden: { name: 'Shadowmane', title: 'Alpha of the Shadewolves', shot: 'void', ground: 'slam', summons: ['shadewolf', 'shadewolf', 'thornling'],
      look: { form: 'beast', body: '#2a2a44', trim: '#6a4bd6', glow: '#8a6ff0', eye: '#ff6b9a', style: 'wolf' },
      patterns: [['charge', 'howl', 'volley', 'nova'], ['howl', 'charge', 'nova', 'volley', 'charge', 'blink']] },
    hollowStar: { name: 'Skyhorn', title: 'The Stag of the Fallen Star', shot: 'void', rain: 'meteor', ground: 'slam',
      look: { form: 'beast', body: '#e8e2f0', trim: '#c9b6ff', glow: '#c9b6ff', eye: '#6a4bd6', style: 'antlers' },
      patterns: [['charge', 'meteors', 'blink', 'nova'], ['meteors', 'charge', 'blink', 'nova', 'howl', 'charge']] },
    cinderTyrant: { name: 'The Duneworm', title: 'Devourer Under the Wastes', shot: 'fire', rain: 'lava', ground: 'lava', trail: true,
      look: { form: 'serpent', body: '#9a7650', trim: '#ffd27a', glow: '#ff9a3d', eye: '#ff5a4a', style: 'sand' },
      patterns: [['charge', 'geysers', 'meteors', 'nova'], ['geysers', 'charge', 'meteors', 'boulders', 'nova', 'charge']] },
    eclipse: { name: 'Umbra', title: 'The Moon-Eater', shot: 'void', rain: 'meteor', ground: 'root',
      look: { form: 'eclipse', body: '#05020c', trim: '#e8e2f0', glow: '#2a2a44', eye: '#ffd35c', style: 'wolf' },
      patterns: UMBRA_PHASES(['howl', 'geysers']) },
  },
};

export function bossVariant(hero: HeroId, kind: EnemyKind): BossVariant | null {
  return (BOSS_VARIANTS[hero] as Partial<Record<EnemyKind, BossVariant>> | undefined)?.[kind] || null;
}
