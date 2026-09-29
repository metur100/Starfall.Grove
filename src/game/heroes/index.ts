import { CINES } from '../cutscenes';
import type { HeroId } from '../types';
import type { HeroStory } from './kit';
import { KAEL } from './kael';
import { LYRA } from './lyra';
import { RIVEN } from './riven';
import { WREN } from './wren';

/** The heroes who play a story of their own. Mira plays the valley's story as it was first told (story.ts). */
export const HERO_STORIES: Partial<Record<HeroId, HeroStory>> = { kael: KAEL, lyra: LYRA, riven: RIVEN, wren: WREN };
for (const s of Object.values(HERO_STORIES)) if (s?.cines) Object.assign(CINES, s.cines);
