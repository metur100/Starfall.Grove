import type { HeroId, RegionId } from './types';
import type { StoryQuest } from './story';

// Mira's own quests, woven through the valley's story (story.ts), which is hers: Orrin's apprentice follows her teacher
// and grows into her own starlight. The other heroes play stories of their own (heroes/).
//
// A quest goes into the main story right after the quest named in `after` (a local id, or 'region:id'). Quests from
// `fox` are Tuft nudging Mira along and start by themselves.
const h = (hero: HeroId, def: Omit<StoryQuest, 'hero'>): StoryQuest => ({ ...def, hero });

export const HERO_QUESTS: Record<RegionId, StoryQuest[]> = {
  // ═════════════════════════════ Chapter I
  meadow: [
    h('mira', { id: 'mira1', title: 'Tuft’s Nose', giver: 'fox', kind: 'trail', count: 4, near: 'sunpetal', place: 'stones', after: 'm2', auto: true, summary: 'Follow Tuft along Master Orrin’s trail to the Old Stone Garden.', reward: { xp: 110, mana: 10 },
      clues: ['(Tuft yips.) A bootprint in the mud, the heel worn crooked. Orrin’s boot. He always walks on the outside of his foot.', 'His lantern, dropped in the grass. The glass is cracked, and the wick smells of starlight.', 'Scorch marks in a perfect circle. He cast something here… something big. Something frightened him.', 'Star-dust, glittering on the old stones. He came this way, and he was not alone.'],
      text: { offer: ['(Tuft sneezes, spins round twice and puts his nose to the ground. He has Master Orrin’s scent!)', 'Follow him. Wherever Orrin went that night, the trail starts here in Sunpetal.'], progress: ['Follow the glowing footprints. Tuft is very sure.'], complete: ['(Tuft sits down among the stones, very pleased with himself.)', 'Orrin came to the Old Stone Garden looking for something. Elder Rowan will know what.'], after: [] } }),
    h('mira', { id: 'mira0', title: 'Follow the Lights', giver: 'fox', kind: 'activate', count: 3, near: 'sunpetal', switches: 'lantern', order: ['Well lantern', 'Mill lantern', 'Gate lantern'], after: 'm1', auto: true, cine: { done: 'orrin-lanterns' }, summary: 'Relight the three lanterns Master Orrin hung in Sunpetal on the night he left.', reward: { xp: 90, mana: 8 },
      text: { offer: ['(Tuft runs to a lantern by the well and whines. It’s one of Orrin’s: star-glass, with his mark scratched on the frame.)', 'He hung lanterns here that night, three of them. He always said a lit lantern remembers who lit it. Let’s wake them.'], progress: ['Three of Orrin’s lanterns around Sunpetal.'], complete: [], after: [] } }),
    h('mira', { id: 'mira5', title: 'Starmoss', giver: 'maren', kind: 'collect', count: 4, near: 'faerie', item: 'Starmoss', icon: 'herb', after: 'm7', turnIn: 'maren', summary: 'Gather starmoss at the Faerie Ring for Healer Maren.', reward: { xp: 170, hearts: 1 },
      text: { offer: ['Orrin’s girl! He used to bring me starmoss from the Faerie Ring. Nothing mends a gloom-bite faster.', 'Half the village has bites since the Beacon died. Would you fetch four clumps? It glows at the roots. You can’t miss it.'], progress: ['Starmoss grows in the Faerie Ring, south of Goldenhearth.'], complete: ['Oh, it’s good and bright. He taught you where to look, didn’t he?', 'Here. Take this for your trouble, and keep that fox fed.'], after: ['Starmoss tea, anyone?'] } }),
  ],

  // ═════════════════════════════ Chapter II
  woods: [
    h('mira', { id: 'mira2', title: 'The Apprentice’s Test', giver: 'fox', kind: 'activate', count: 3, near: 'spring', switches: 'rune', order: ['Root', 'Leaf', 'Star'], ordered: true, after: 'm12', auto: true, summary: 'Wake the runes at the Moss Shrine in the order Orrin taught you.', reward: { xp: 200, mana: 12 },
      text: { offer: ['(Tuft trots north, toward the Moss Shrine, and sits beside three old runestones as if he has been here before.)', 'Orrin brought me here once, when I was little. “First the root that holds, then the leaf that grows, then the star that guides.” He said I would understand one day.'],
        progress: ['Root, then Leaf, then Star.'], complete: ['(The runes blaze, one after another. Orrin’s voice rises out of the stones, warm and a little tired.)', '“If you are hearing this, Mira, you remembered. Then you are ready for more than I ever taught you. Be braver than me.”'], after: [] } }),
    h('mira', { id: 'mira7', title: 'Guard the Moss Shrine', giver: 'fox', kind: 'defend', count: 3, place: 'spring', waves: [3, 4, 4], foes: ['wisp', 'thornling', 'gloomling'], ward: 'the Moss Shrine', after: 'mira2', auto: true, cine: { start: 'mira-shrine' }, summary: 'Protect the Moss Shrine and Orrin’s runes from a swarm of wisps.', reward: { xp: 240, mana: 12 },
      text: { offer: ['(Tuft’s ears go flat. The wisps heard Orrin’s voice in the runes, and they’re coming for it.)', 'Not his runes. Not while I’m standing here. Stay by the shrine, Tuft.'], progress: ['Stay by the Moss Shrine. Stop the wisps before they reach it.'], complete: ['(The last wisp pops like a soap bubble. The runes hum, safe.)', 'He left a piece of himself here for me. Nobody takes it.'], after: [] } }),
  ],

  // ═════════════════════════════ Chapter III
  summit: [
    h('mira', { id: 'mira3', title: 'What Mira Believes', giver: 'orrin', kind: 'talk', count: 1, to: 'orrin', after: 'm11', summary: 'Tell Master Orrin what you think of what he did.', reward: { xp: 180 },
      text: { offer: ['I have told you everything, Mira. Every foolish, proud thing I did.', 'Before we go on, I need to hear it from you. Say what you think of me. I have earned it, whatever it is.'], progress: ['Orrin is waiting for your answer.'], complete: [], after: [],
        deliver: ['(Orrin looks at you the way he did on your very first day as his apprentice: hopeful, and a little afraid.)'] },
      choice: {
        a: { label: 'I forgive you', lines: ['(He lets out a breath he must have held for ten years.)', 'Then I will try to deserve it. Thank you, my brave girl. Now: the Crag Shard.'], reward: { hearts: 1 } },
        b: { label: 'Make it right first', lines: ['Yes. Yes, that is fair. That is exactly what I would have told you.', 'Then let us make it right, together. Starting with the Crag Shard.'], reward: { mana: 15 } },
      } }),
  ],

  // ═════════════════════════════ Chapter IV
  ember: [
    h('mira', { id: 'mira4', title: 'A Light of Her Own', giver: 'fox', kind: 'build', count: 3, near: 'spring', item: 'Starglass', icon: 'gem', place: 'spring', site: 'lantern', siteName: 'Star lantern', after: 'm11', auto: true, cine: { done: 'mira-star' }, summary: 'Gather starglass in the Phoenix Spring and build a star lantern of your own.', reward: { xp: 320, hearts: 1 },
      text: { offer: ['(Tuft paws at the glittering shards in the shallows of the spring. Starglass: glass that remembers light.)', 'Orrin’s last lesson was that a light has to be your own. Let’s make one. Three pieces of starglass, and a lantern to put them in.'], progress: ['Three pieces of starglass around the Phoenix Spring.'], complete: [], after: [] } }),
  ],
};

