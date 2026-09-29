import type { Captive, HeroId, NpcDef, NpcLook, QuestText, RegionId, WorldScript } from '../types';
import type { StoryQuest } from '../story';
import type { NpcSpec } from '../worldgen';
import type { Shot } from '../cutscenes';

// A hero's own story: the main questline they play, chapter by chapter, in their own words.
//
// Every chapter is a chain of main quests played in order (`chains`). A link is either one of the hero's own quests
// (`quests`) or a quest of the shared story (story.ts) played again with this hero's words (`reuse`): who gives it,
// what it is called and everything anyone says. Reused quests keep their shape (what kind of quest it is, where it
// happens, how many things to find), because the world is laid out around them.
//
// Side quests, regions and the gates between them are the same for every hero. Each chapter's gate quest (the bridge,
// the thorn wall, the ice seal) and its guardian's fight are always part of the chain.

/** What a reused quest may change. Ids (giver, to, turnIn) are local to the quest's land unless they hold a colon. */
export type QuestWords = Partial<Pick<StoryQuest,
  'title' | 'giver' | 'to' | 'turnIn' | 'summary' | 'reward' | 'captive' | 'who' | 'cine' | 'choice' | 'ambush' | 'ward'
  | 'item' | 'icon' | 'clues' | 'order' | 'siteName' | 'escapes' | 'beast' | 'auto'>> & {
  /** Lines left out are the shared quest's own, so a reused quest should say everything in this hero's words. */
  text?: Partial<QuestText>;
};

/** A land's words for this hero (the guardian's seal, the light's lines, the chapter's ending). */
export type ScriptWords = Partial<Pick<WorldScript, 'keyLabel' | 'pickupKey' | 'sealed' | 'tip' | 'finaleName'>> & {
  finale?: Partial<WorldScript['finale']>; victory?: Partial<WorldScript['victory']>; guide?: Partial<WorldScript['guide']>;
};

/** How a shared person changes in this hero's story: hidden, or shown at other points of the story, or saying other things. */
export type NpcWords = { hidden?: boolean } & Partial<Pick<NpcDef, 'after' | 'until' | 'lines' | 'barks'>>;

export type HeroStory = {
  hero: HeroId;
  /** The main quests of each chapter, in the order they are played (local ids, e.g. 'm1' or 'kael12'). */
  chains: Record<RegionId, string[]>;
  /** The hero's own quests. */
  quests: Record<RegionId, StoryQuest[]>;
  /** Shared quests told this hero's way, by land and local id. */
  reuse: Partial<Record<RegionId, Record<string, QuestWords>>>;
  /** People who only appear in this hero's story. */
  npcs: Partial<Record<RegionId, NpcSpec[]>>;
  /** Shared people changed for this hero, by full id ('summit:sable2'). `after`/`until` take full quest ids. */
  npcFor?: Record<string, NpcWords>;
  script?: Partial<Record<RegionId, ScriptWords>>;
  /** This hero's cutscenes: new ones, and their own versions of shared ones stored as '<id>@<hero>'. */
  cines?: Record<string, Shot[]>;
};

export const person = (name: string, portrait: string, look: Partial<NpcLook>): Captive => ({ name, portrait, look: { skin: '#f0c8a2', robe: '#8a6fb0', hat: 'none', hatColor: '#5b5480', hair: '#6b3f2a', ...look } });
export const look = (robe: string, hat: NpcLook['hat'], extra: Partial<NpcLook> = {}): Partial<NpcLook> => ({ robe, hat, hatColor: extra.hatColor || '#4a5b3e', skin: '#f0c8a2', hair: '#6b3f2a', ...extra });
/** One of a hero's own quests (its place in the story comes from the chain). */
export const own = (hero: HeroId) => (def: Omit<StoryQuest, 'hero' | 'after' | 'requires'>): StoryQuest => ({ ...def, hero });
