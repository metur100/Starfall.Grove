// Every land has creatures of its own. This lists any quest, pack or siege that would bring a creature from another
// land into it (the engine swaps such kinds for the land's own, but the quest's words should name the right ones).
import { getWorld } from '../src/game/worlds';
import { HERO_STORIES } from '../src/game/heroes';
import { LAND_KINDS } from '../src/game/worlds';

const w = getWorld();
/** Wren's own pack, turned by the shadow, comes back for her at the Hunter's Camp: those wolves are the story's, not the Meadow's. */
const STORY = new Set(['meadow:wren9', 'wren9']);
let bad = 0;
const check = (where: string, region: string, kinds: Array<string | undefined>) => {
  for (const k of kinds) if (k && k !== 'any' && !(LAND_KINDS as Record<string, string[]>)[region].includes(k)) { console.log(`${where} (${region}): ${k}`); bad++; }
};
for (const q of w.quests) if (!STORY.has(q.id)) check(`quest ${q.id} "${q.title}"`, q.region, [q.enemy, ...(q.foes || []), ...(q.ambush || [])]);
for (const p of w.pois) check(`pack at ${p.id}`, p.region, p.pack || []);
for (const e of w.enemies) if (!e.boss) check(`creature ${e.id}`, e.region, [e.kind]);
for (const [hero, s] of Object.entries(HERO_STORIES)) {
  for (const [reg, qs] of Object.entries(s!.quests)) for (const q of qs) if (!STORY.has(q.id)) check(`${hero} ${q.id} "${q.title}"`, reg, [q.enemy, ...(q.foes || []), ...(q.ambush || [])]);
  for (const [reg, m] of Object.entries(s!.reuse || {})) for (const [id, q] of Object.entries(m || {})) check(`${hero} reuse ${id}`, reg, q.ambush || []);
}
console.log(bad ? `${bad} creatures out of place` : 'Every land keeps to its own creatures.');
if (bad) process.exitCode = 1;
