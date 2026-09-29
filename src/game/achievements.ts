// Achievements, in the spirit of an MMO: each one watches a counter (creatures defeated, chests opened, the highest
// level reached, a guardian beaten…) and is earned the moment that counter reaches its goal. Counters and earned
// achievements live in the hero's profile, so every hero collects their own.

export type AchCategory = 'Story' | 'Guardians' | 'Combat' | 'Exploration' | 'Quests' | 'Character';
export const ACH_CATEGORIES: AchCategory[] = ['Story', 'Guardians', 'Combat', 'Exploration', 'Quests', 'Character'];
/** `goal` can depend on the world (for "every place", "every runestone" and the like). */
export type Totals = { places: number; chests: number; lore: number; sideQuests: number; secrets: number };
export type AchDef = { id: string; name: string; description: string; icon: string; points: number; category: AchCategory; stat: string; goal: number | ((t: Totals) => number) };

const a = (category: AchCategory, id: string, name: string, description: string, icon: string, points: number, stat: string, goal: AchDef['goal'] = 1): AchDef => ({ id, name, description, icon, points, category, stat, goal });

export const ACHIEVEMENTS: AchDef[] = [
  a('Story', 'ch-meadow', 'The Beacon Shines', 'Relight the Meadow Beacon and finish Chapter I.', '☀', 10, 'chapter:meadow'),
  a('Story', 'ch-woods', 'The Bell Rings Again', 'Ring the Ancient Root Bell and finish Chapter II.', '🔔', 10, 'chapter:woods'),
  a('Story', 'ch-summit', 'Heart of the Fallen Light', 'Return the star to its Cradle and finish Chapter III.', '✦', 10, 'chapter:summit'),
  a('Story', 'ch-ember', 'The Dawn Forge', 'Light the Dawn Forge and finish Chapter IV.', '🔥', 25, 'chapter:ember'),
  a('Story', 'eclipse', 'The Eclipse Ends', 'Defeat Umbra, the Eclipse.', '🌑', 50, 'boss:eclipse'),

  // Every hero meets their own guardians (bosses.ts), so these name the place, not the creature.
  a('Guardians', 'b-mossback', 'Guardian of the Rise', 'Defeat the guardian of the Beacon Rise.', '🪨', 10, 'boss:mossback'),
  a('Guardians', 'b-warden', 'Thorns Unbound', 'Defeat the guardian of the Old Bell.', '🌿', 10, 'boss:brambleWarden'),
  a('Guardians', 'b-star', 'Starbreaker', 'Defeat the guardian of the Star Cradle.', '☄', 10, 'boss:hollowStar'),
  a('Guardians', 'b-tyrant', 'Cinderfall', 'Defeat the guardian of the Dawn Forge.', '🌋', 25, 'boss:cinderTyrant'),
  a('Guardians', 'flawless', 'Untouchable', 'Defeat a guardian without falling during the fight.', '🛡', 25, 'flawless'),

  a('Combat', 'k1', 'First Blood', 'Defeat your first creature.', '⚔', 5, 'kills', 1),
  a('Combat', 'k50', 'Monster Hunter', 'Defeat 50 creatures.', '⚔', 10, 'kills', 50),
  a('Combat', 'k250', 'Scourge of the Wilds', 'Defeat 250 creatures.', '⚔', 25, 'kills', 250),
  a('Combat', 'k1000', 'Legend of the Hunt', 'Defeat 1000 creatures.', '⚔', 50, 'kills', 1000),
  a('Combat', 'e10', 'Elite Hunter', 'Defeat 10 gold-starred elites.', '★', 10, 'elites', 10),
  a('Combat', 'e50', 'Champion Slayer', 'Defeat 50 gold-starred elites.', '★', 25, 'elites', 50),
  a('Combat', 'h1', 'Heroic Deed', 'Defeat a heroic creature, the named leader of a lair.', '♛', 10, 'heroics', 1),
  a('Combat', 'h8', 'Bane of the Lairs', 'Defeat 8 heroic creatures.', '♛', 25, 'heroics', 8),
  a('Combat', 'combo15', 'Combo Artist', 'Land a 15-hit combo.', '✺', 10, 'combo', 15),
  a('Combat', 'combo40', 'Unstoppable', 'Land a 40-hit combo.', '✺', 25, 'combo', 40),
  a('Combat', 'underdog', 'Giant Slayer', 'Defeat a creature four or more levels above you.', '💀', 10, 'underdog'),
  a('Combat', 'crits', 'Sharp Eye', 'Land 200 critical hits.', '✧', 10, 'crits', 200),
  a('Combat', 'bombs', 'Demolitionist', 'Throw 25 bombs and thunder jars.', '💣', 10, 'bombs', 25),

  a('Exploration', 'p10', 'Wanderer', 'Discover 10 places.', '🧭', 10, 'places', 10),
  a('Exploration', 'p30', 'Pathfinder', 'Discover 30 places.', '🧭', 25, 'places', 30),
  a('Exploration', 'pall', 'Cartographer', 'Discover every place in the valley.', '🗺', 50, 'places', t => t.places),
  a('Exploration', 'lands', 'Across the Valley', 'Set foot in all four lands.', '⛰', 25, 'lands', 4),
  a('Exploration', 'fog', 'Fog Lifter', 'Uncover half of the world map.', '☁', 25, 'explore', 50),
  a('Exploration', 's1', 'Something Hidden', 'Find a secret: break a cracked wall with a bomb, or look behind a waterfall.', '🔍', 10, 'secrets', 1),
  a('Exploration', 'sall', 'Keeper of Secrets', 'Find every secret in the valley.', '🗝', 50, 'secrets', t => t.secrets),
  a('Exploration', 'c10', 'Treasure Hunter', 'Open 10 chests.', '🧰', 10, 'chests', 10),
  a('Exploration', 'c40', 'Hoarder', 'Open 40 chests.', '🧰', 25, 'chests', 40),
  a('Exploration', 'lore10', 'Reader of Stones', 'Read 10 runestones.', '📜', 10, 'lore', 10),
  a('Exploration', 'loreall', 'Lorekeeper', 'Read every runestone in the valley.', '📜', 25, 'lore', t => t.lore),

  a('Quests', 'q10', 'Helping Hand', 'Finish 10 side quests.', '!', 10, 'sideQuests', 10),
  a('Quests', 'q25', 'Friend of the Valley', 'Finish 25 side quests.', '!', 25, 'sideQuests', 25),
  a('Quests', 'qall', 'Hero of the People', 'Finish every side quest in the valley.', '!', 50, 'sideQuests', t => t.sideQuests),
  a('Quests', 'rescue5', 'Cage Breaker', 'Free 5 captives.', '🔓', 10, 'rescues', 5),

  a('Character', 'lv10', 'Seasoned', 'Reach level 10.', '⬆', 10, 'level', 10),
  a('Character', 'lv20', 'Veteran', 'Reach level 20.', '⬆', 25, 'level', 20),
  a('Character', 'lv25', 'Living Legend', 'Reach level 25.', '⬆', 50, 'level', 25),
  a('Character', 'gold', 'Deep Pockets', 'Carry 1000 gold at once.', '🪙', 10, 'gold', 1000),
  a('Character', 'kitted', 'Fully Kitted', 'Wear a piece in every equipment slot, weapon included.', '🎽', 10, 'slots', 9),
  a('Character', 'epic', 'Purple Haze', 'Find an epic piece of equipment.', '◆', 10, 'epics'),
  a('Character', 'legend', 'Legendary!', 'Find a legendary piece of equipment.', '◆', 25, 'legendaries'),
  a('Character', 'spender', 'Big Spender', 'Buy a piece from an armourer.', '🛒', 10, 'bought'),
  a('Character', 'mastery', 'Mastery', 'Upgrade an ability to five stars.', '★', 10, 'stars', 5),
  a('Character', 'smith', 'Starsteel', 'Buy the fifth rank of a smith upgrade.', '⚒', 10, 'smith', 5),
  a('Character', 'potions', 'Potion Connoisseur', 'Drink 50 potions and brews.', '⚗', 10, 'potions', 50),
  a('Character', 'phoenix', 'From the Ashes', 'Rise again with a Phoenix Feather.', '🪶', 10, 'rebirths'),
  a('Character', 'dice5', 'Lucky Streak', 'Win 5 games of Starfall Dice against the valley folk.', '🎲', 10, 'diceWins', 5),
  a('Character', 'archer', 'Eagle Eye', 'Win a gold medal at an archery range (100 points).', '🎯', 10, 'archeryBest', 100),
  a('Character', 'scratch', 'Just a Scratch', 'Fall in battle for the first time.', '✚', 5, 'deaths'),
];

export const goalOf = (d: AchDef, t: Totals) => typeof d.goal === 'function' ? Math.max(1, d.goal(t)) : d.goal;
export const TOTAL_POINTS = ACHIEVEMENTS.reduce((s, d) => s + d.points, 0);
