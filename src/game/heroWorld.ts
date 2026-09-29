import { LEVEL_ORDER } from './worlds';
import { HERO_STORIES } from './heroes';
import type { HeroStory } from './heroes/kit';
import type { HeroId, QuestDef, RegionId, WorldDefinition } from './types';

/**
 * The quests one hero plays: the shared side quests, and their main story. A hero with a story of their own (heroes/)
 * plays its chain link by link. Mira plays the valley's story, and her own quests slot into it right after the quest
 * they name in `after` (whatever came next then waits for them).
 */
export function questsForHero(all: QuestDef[], hero: HeroId): QuestDef[] {
  const story = HERO_STORIES[hero]; if (story) return chainOf(all, story);
  const out = all.filter(q => !q.hero).map(q => ({ ...q, ...q.forHero?.[hero] })), last = new Map<string, string>();
  for (const hq of all.filter(q => q.hero === hero).map(q => ({ ...q }))) {
    const anchor = hq.after, prev = anchor ? last.get(anchor) || anchor : null, i = prev ? out.findIndex(q => q.id === prev) : -1;
    if (!anchor || !prev || i < 0) { out.push(hq); continue; }
    for (const q of out) if (q.main && q.requires === prev) q.requires = hq.id;
    hq.requires = prev; out.splice(i + 1, 0, hq); last.set(anchor, hq.id);
  }
  return out;
}
/** A local id in a land ('rowan', 'm3') as the world knows it ('meadow:rowan'). */
export const inLand = (region: RegionId, id: string | undefined) => id && (id.includes(':') || id === 'fox' ? id : `${region}:${id}`);
/** A hero's own main story: every chapter's links in order, each one waiting for the one before (across chapters too). */
export function chainOf(all: QuestDef[], s: HeroStory): QuestDef[] {
  const byId = new Map(all.map(q => [q.id, q])), out = all.filter(q => !q.main);
  let prev: string | undefined;
  for (const region of LEVEL_ORDER) for (const link of s.chains[region] || []) {
    const id = inLand(region, link)!, base = byId.get(id); if (!base) continue;
    const w = s.reuse[region]?.[link];
    const q: QuestDef = { ...base, main: true, requires: prev, after: undefined, forHero: undefined, textFor: undefined };
    if (w) Object.assign(q, w, { text: { ...base.text, ...w.text }, giver: inLand(region, w.giver) || base.giver, to: inLand(region, w.to) || base.to, turnIn: inLand(region, w.turnIn) || base.turnIn });
    out.push(q); prev = id;
  }
  return out;
}
/**
 * The world as one hero sees it: each land's words in their version, the people of their story (and of no one else's),
 * and only the quest things (cages, sites, lanterns, clues) of quests they can play, named the way their story names them.
 */
export function worldForHero(base: WorldDefinition, hero: HeroId, quests: QuestDef[]): Pick<WorldDefinition, 'regions' | 'npcs' | 'objects'> {
  const s = HERO_STORIES[hero], byId = new Map(quests.map(q => [q.id, q]));
  const regions = base.regions.map(r => {
    const w = s?.script?.[r.id]; if (!w) return r;
    const o = r.script;
    return { ...r, script: { ...o, ...w, finale: { ...o.finale, ...w.finale }, victory: { ...o.victory, ...w.victory }, guide: { ...o.guide, ...w.guide } } };
  });
  const npcs = base.npcs.flatMap(n => { const w = s?.npcFor?.[n.id]; if (!w) return [n]; if (w.hidden) return []; const { hidden: _, ...rest } = w; return [{ ...n, ...rest }]; });
  const objects = base.objects.filter(o => !o.questId || o.kind === 'barrier' || byId.has(o.questId)).map(o => {
    const q = o.questId ? byId.get(o.questId) : null; if (!q || o.kind === 'barrier') return o;
    if (o.kind === 'questItem' && q.item) return { ...o, name: q.item, icon: q.icon || o.icon };
    if (o.kind === 'cage' && q.captive) return { ...o, name: `${q.captive.name}’s cage`, captive: q.captive };
    if (o.kind === 'site' && q.siteName) return { ...o, name: q.siteName };
    if (o.kind === 'ward' && q.ward) return { ...o, name: q.ward };
    if (o.kind === 'switch' && q.order?.[o.step ?? -1]) return { ...o, name: q.order[o.step!] };
    return o;
  });
  return { regions, npcs, objects };
}
