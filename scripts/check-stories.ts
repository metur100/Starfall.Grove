// Checks every hero's main story for mistakes a player would hit: a quest giver who isn't there yet, a place that
// doesn't exist, a chapter without its guardian or gate, lines still written for Mira. Run with `npm run check:stories`.
import { getWorld, LEVEL_ORDER } from '../src/game/worlds';
import { questsForHero, worldForHero } from '../src/game/heroWorld';
import { HERO_STORIES } from '../src/game/heroes';
import { STORY } from '../src/game/story';
import { cineFor } from '../src/game/cutscenes';
import type { HeroId, NpcDef, QuestDef, RegionId } from '../src/game/types';

const ONLY = process.argv[2] as HeroId | undefined;
const HEROES = (['mira', 'kael', 'lyra', 'riven', 'wren'] as HeroId[]).filter(h => !ONLY || h === ONLY);
const GATE: Partial<Record<RegionId, string>> = { meadow: 'meadow:m12', woods: 'woods:m17', summit: 'summit:m20' };
const BOSS: Record<RegionId, string> = { meadow: 'meadow:m10', woods: 'woods:m15', summit: 'summit:m19', ember: 'ember:m12' };
/** The only quests of the shared story another hero plays: the guardians, and Umbra at the very end. */
const SHARED_OK = new Set([...Object.values(BOSS), 'ember:m13']);
/** Shared cutscenes that show Mira's story (Orrin, Sable, Pyrrhus); another hero should have their own version. */
const MIRA_CINES = new Set(['glade-memory', 'orrin-memory', 'star-rises', 'chapter-summit', 'pyrrhus-wakes', 'tarn-vision']);
const world = getWorld();
let errors = 0, warnings = 0;
const err = (h: string, m: string) => { errors++; console.log(`  ✖ [${h}] ${m}`); };
const warn = (h: string, m: string) => { warnings++; console.log(`  ! [${h}] ${m}`); };
const poi = new Set(world.pois.map(p => p.id));
const lines = (q: QuestDef) => [q.title, q.summary, ...Object.values(q.text).flat(), ...(q.clues || []), ...(q.choice ? [q.choice.a.label, q.choice.b.label, ...q.choice.a.lines, ...q.choice.b.lines] : [])].filter(Boolean) as string[];

for (const hero of HEROES) {
  console.log(`\n${hero}`);
  const quests = questsForHero(world.quests, hero), hw = worldForHero(world, hero, quests);
  const mains = quests.filter(q => q.main), byId = new Map(quests.map(q => [q.id, q]));
  const npcs = new Map<string, NpcDef>(hw.npcs.filter(n => !n.hero || n.hero === hero).map(n => [n.id, n]));
  const story = HERO_STORIES[hero];
  // Chain shape.
  if (story) for (const r of LEVEL_ORDER) {
    const links = story.chains[r] || [];
    for (const l of links) if (!byId.has(l.includes(':') ? l : `${r}:${l}`)) err(hero, `${r}: chain link '${l}' is not a quest`);
    if (new Set(links).size !== links.length) err(hero, `${r}: a quest appears twice in the chain`);
    for (const q of story.quests[r]) if (!links.includes(q.id)) warn(hero, `${r}: own quest ${q.id} is not in the chain`);
    for (const id of Object.keys(story.reuse[r] || {})) if (!links.includes(id)) warn(hero, `${r}: reuse.${id} is not in the chain`);
  }
  if (mains[0]?.region !== 'meadow' || mains[0].requires) err(hero, `the story must start in the meadow with a quest that needs nothing (starts with ${mains[0]?.id})`);
  if (hero !== 'mira') for (const q of mains) if (!q.hero && !SHARED_OK.has(q.id)) err(hero, `${q.id} “${q.title}” is a quest of the shared story (every link but the guardians must be the hero's own)`);
  for (const r of LEVEL_ORDER) {
    const list = mains.filter(q => q.region === r), last = list[list.length - 1];
    const own = list.filter(q => q.hero === hero).length;
    // Mira opens each gate with the shared story's gate quest; another hero with their own last quest of the land.
    const want = hero === 'mira' || r === 'ember' ? GATE[r] || 'ember:m13' : last?.id;
    if (last?.id !== want) err(hero, `${r}: the chapter must end with ${want} (ends with ${last?.id})`);
    if (hero !== 'mira' && r !== 'ember' && last && last.boss) err(hero, `${r}: the gate can't open with a guardian's fight`);
    const boss = list.findIndex(q => q.id === BOSS[r]);
    if (boss < 0) err(hero, `${r}: the guardian's quest ${BOSS[r]} is missing`);
    const keys = new Set<number>(); list.slice(0, boss < 0 ? list.length : boss).forEach(q => q.kind === 'key' && q.keys?.forEach(k => keys.add(k)));
    if (keys.size !== 3) err(hero, `${r}: only ${keys.size}/3 of the land's keys are found before the guardian`);
    const xp = list.reduce((n, q) => n + q.reward.xp, 0);
    console.log(`  ${r}: ${list.length} main quests (${own} own), ${xp} xp`);
    if (hero !== 'mira' && own < 6) err(hero, `${r}: only ${own} quests of the hero's own (at least 6 wanted)`);
  }
  // Walk the story: who has to be there when, where things happen, what is said.
  const done = new Set<string>(), started = new Set<string>();
  const visible = (id: string | undefined, when: 'offer' | 'active', q: QuestDef) => {
    if (!id || id === 'fox') return true;
    const n = npcs.get(id); if (!n) { err(hero, `${q.id}: nobody called '${id}'${hw.npcs.some(x => x.id === id) ? ' in this hero’s world (hidden or someone else’s)' : ''}`); return false; }
    if (n.after && !done.has(n.after)) { err(hero, `${q.id}: ${n.name} (${id}) only appears after ${n.after}${byId.has(n.after) ? '' : ', which this hero never plays'}`); return false; }
    if (n.until && (started.has(n.until) || (when === 'active' && n.until === q.id))) { err(hero, `${q.id}: ${n.name} (${id}) is gone once ${n.until} starts`); return false; }
    return true;
  };
  for (const q of mains) {
    visible(q.giver, 'offer', q); started.add(q.id);
    if (q.to) visible(q.to, 'active', q);
    if (q.turnIn) visible(q.turnIn, 'active', q);
    for (const p of [q.place, q.near, q.from]) if (p && !poi.has(p)) err(hero, `${q.id}: no place called ${p}`);
    const need: Record<string, Array<keyof QuestDef>> = { talk: ['to'], deliver: ['to', 'item'], rescue: ['place', 'captive'], escort: ['who', 'from', 'place'], chase: ['who', 'place'], defend: ['place', 'waves', 'foes'], build: ['near', 'place', 'item', 'site'], activate: ['near', 'order', 'switches'], trail: ['near', 'place', 'clues'], herd: ['near', 'place', 'animal'], collect: ['near', 'item', 'icon'], key: ['keys'], slay: ['enemy'], visit: ['place'], boss: ['boss'] };
    for (const f of need[q.kind] || []) if (q[f] === undefined) err(hero, `${q.id}: a ${q.kind} quest needs '${f}'`);
    if (q.kind === 'activate' && q.order && q.order.length !== q.count) err(hero, `${q.id}: ${q.order.length} names for ${q.count} switches`);
    if (q.kind === 'trail' && q.clues && q.clues.length !== q.count) err(hero, `${q.id}: ${q.clues.length} clues for a count of ${q.count}`);
    if (q.kind === 'defend' && q.waves && q.waves.length !== q.count) err(hero, `${q.id}: ${q.waves.length} waves for a count of ${q.count}`);
    for (const c of Object.values(q.cine || {})) if (c && !cineFor(c, hero)) err(hero, `${q.id}: no cutscene '${c}'`);
    else if (c && hero !== 'mira' && MIRA_CINES.has(c) && !cineFor(`${c}@${hero}`, hero)?.length) warn(hero, `${q.id}: plays Mira's cutscene '${c}' (add '${c}@${hero}')`);
    if (hero !== 'mira') {
      const bad = lines(q).filter(l => /\bMira\b|\bTuft\b|Orrin’s apprentice/.test(l));
      if (bad.length) err(hero, `${q.id}: Mira's lines: “${bad[0].slice(0, 80)}”`);
      const shared = STORY[q.region].find(s => `${q.region}:${s.id}` === q.id);
      if (shared) for (const k of Object.keys(shared.text) as Array<keyof typeof shared.text>) if ((shared.text[k]?.length || 0) && shared.text[k] === q.text[k]) warn(hero, `${q.id}: '${k}' lines are still the shared story's`);
      if (shared && shared.title === q.title) warn(hero, `${q.id}: keeps the shared title “${q.title}”`);
    }
    if (q.kind === 'boss' || q.kind === 'build') { /* finished at the light or the site */ }
    done.add(q.id);
  }
  // Every cutscene this hero plays points its camera and effects at things that exist in their world (a name that
  // doesn't resolve leaves the camera where it was, showing the wrong place).
  const objs = new Set(hw.objects.map(o => o.id)), people = new Set(npcs.keys());
  const played: Array<[string, QuestDef | null, string]> = [['arrive', null, 'arrive'], ['intro', null, 'intro'], ['depths-fall', null, 'fall'], ...LEVEL_ORDER.map(r => [`chapter-${r}`, null, 'chapter'] as [string, null, string])];
  for (const q of quests) for (const [when, c] of Object.entries(q.cine || {})) if (c) played.push([c, q, when]);
  for (const [id, q, when] of played) {
    const shots = cineFor(id, hero); if (!shots) continue;
    const has = (kind: string) => !!q && hw.objects.some(o => o.kind === kind && o.questId === q.id);
    // Umbra's own scene plays when it rises on its throne in the depths.
    const ctx = new Set(when === 'caught' ? ['$thief'] : [...(has('ward') ? ['$ward'] : []), ...(has('site') ? ['$site'] : []), ...(q?.boss?.endsWith(':final') ? ['$throne'] : [])]);
    const bad = (at?: string) => !!at && at !== 'hero' && (at.startsWith('$') ? !ctx.has(at) : at.startsWith('npc:') ? !people.has(at.slice(4)) : at.startsWith('obj:') ? !objs.has(at.slice(4)) : !poi.has(at));
    for (const sh of shots) for (const at of [sh.at, ...(sh.fx || []).map(x => x.at)]) if (bad(at)) err(hero, `cutscene '${id}'${q ? ` (${q.id} ${when})` : ''}: nothing called '${at}' here`);
  }
  if (hero !== 'mira') {
    for (const r of LEVEL_ORDER) {
      const c = `chapter-${r}`; if (MIRA_CINES.has(c) && !cineFor(`${c}@${hero}`, hero)) warn(hero, `no '${c}@${hero}' (the chapter ending shows Mira's story)`);
      if (!story?.script?.[r]) warn(hero, `${r}: no script words (the light's lines and chapter ending are Mira's)`);
    }
  }
}
// No two heroes' own quests share a title.
const titles = new Map<string, string>();
for (const hero of HEROES) for (const q of questsForHero(world.quests, hero).filter(q => q.main && (q.hero === hero || hero === 'mira') && !SHARED_OK.has(q.id))) {
  const k = q.title.toLowerCase(), o = titles.get(k); if (o && o !== hero) warn(hero, `${q.id}: title “${q.title}” is also ${o}'s`); titles.set(k, hero);
}
// Every hero's people have ids of their own.
const seen = new Map<string, string>();
for (const n of world.npcs) { const k = n.id; if (seen.has(k) && seen.get(k) !== (n.hero || '')) err('world', `two people share the id ${k}`); seen.set(k, n.hero || ''); }
console.log(`\n${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
