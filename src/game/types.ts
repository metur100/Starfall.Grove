export type Point = { x: number; y: number };
export type LevelId = 'meadow' | 'woods' | 'summit';
export type SpellId = 'spark' | 'dash' | 'leaf' | 'sunfire' | 'shield' | 'starfall';
export type ItemId = 'healthPotion' | 'manaPotion' | 'swiftTonic' | 'powerElixir' | 'barkskin';

// ───────────────────────────── world layout
export type PoiKind = 'start' | 'village' | 'farm' | 'camp' | 'ruins' | 'lake' | 'lair' | 'grove' | 'shrine' | 'lookout' | 'finale';
export type Poi = { id: string; name: string; kind: PoiKind; x: number; y: number; r: number };

export type ObstacleKind =
  | 'tree' | 'pine' | 'rock' | 'bush' | 'crystal' | 'mushroom' | 'deadtree' | 'stump' | 'log'
  | 'house' | 'well' | 'windmill' | 'tent' | 'stall' | 'pillar' | 'statue' | 'lamppost' | 'crate' | 'hay' | 'fence' | 'tower' | 'campfire';
/** Round obstacles collide as circles; ones with w/h collide as boxes (half extents). */
export type Obstacle = { x: number; y: number; r: number; kind: ObstacleKind; seed: number; w?: number; h?: number; color?: string };
export type DecorKind = 'grass' | 'flower' | 'fern' | 'pebble' | 'shroom' | 'shard' | 'crop' | 'reed' | 'clover';
export type Decor = { x: number; y: number; kind: DecorKind; seed: number; color: string };
export type Pond = { x: number; y: number; r: number };

export type EnemyKind = 'gloomling' | 'thornling' | 'wisp' | 'mossback' | 'brambleWarden' | 'hollowStar';
export type EnemySeed = { id: string; kind: EnemyKind; x: number; y: number; boss?: boolean; elite?: boolean };

export type CritterKind = 'rabbit' | 'deer' | 'bird' | 'duck' | 'frog' | 'goat' | 'squirrel';
export type CritterSeed = { kind: CritterKind; x: number; y: number };

export type NpcHat = 'none' | 'straw' | 'hood' | 'cap' | 'wizard' | 'bonnet' | 'helm' | 'ears' | 'scarf';
export type NpcLook = { skin: string; robe: string; hat: NpcHat; hatColor: string; hair: string; beard?: boolean; small?: boolean };
export type NpcActivity = 'idle' | 'wander' | 'patrol' | 'travel' | 'chop' | 'farm' | 'fish' | 'sweep' | 'hammer' | 'play';
export type NpcDef = {
  id: string; name: string; portrait: string; look: NpcLook; activity: NpcActivity; x: number; y: number;
  role?: 'guide' | 'villager'; route?: Point[]; lines: string[]; barks: string[];
};

export type ObjectKind = 'key' | 'questItem' | 'shrine' | 'finale' | 'chest' | 'sign' | 'lore' | 'well' | 'campfire';
export type ItemIcon = 'herb' | 'flower' | 'bottle' | 'bundle' | 'gem' | 'letter' | 'mushroom' | 'feather' | 'toy' | 'bug';
export type WorldObject = { id: string; kind: ObjectKind; x: number; y: number; name: string; text?: string[]; questId?: string; icon?: ItemIcon };

// ───────────────────────────── quests
export type QuestKind = 'collect' | 'slay' | 'deliver' | 'visit';
/** `hearts` is a permanent max-health bonus (one heart = 20 HP). */
export type QuestReward = { xp: number; hearts?: number; mana?: number; regen?: number; item?: ItemId };
export type QuestDef = {
  id: string; title: string; giver: string; kind: QuestKind; count: number; summary: string;
  enemy?: EnemyKind | 'any'; near?: string; item?: string; icon?: ItemIcon; to?: string; place?: string; requires?: string;
  reward: QuestReward;
  text: { offer: string[]; progress: string[]; complete: string[]; after: string[]; deliver?: string[] };
};
export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'done';
export type QuestState = { status: QuestStatus; progress: number };

export type Ambient = 'petals' | 'leaves' | 'stars';
export type Palette = {
  ground: string; alternate: string; path: string; pathEdge: string; accent: string; water: string; waterDeep: string;
  foliage: [string, string, string]; trunk: string; rock: string; pod: string; roof: string[]; wall: string;
};

export type WorldScript = {
  keyLabel: string; bossName: string; bossTitle: string; finaleName: string;
  guide: { intro: (found: number) => string[]; ready: string[]; done: string[] };
  shrine: { bless: string[]; again: string[] };
  finale: { locked: string[]; guarded: string[]; done: string[] };
  pickupKey: string; sealed: string; tip: string;
  victory: { title: string; text: string };
};

export type WorldDefinition = {
  id: LevelId; chapter: number; title: string; subtitle: string; region: string;
  width: number; height: number; spawn: Point; palette: Palette; darkness: number; ambient: Ambient;
  levelHint: number; enemyScale: number; xpScale: number;
  pois: Poi[]; roads: Point[][]; obstacles: Obstacle[]; decor: Decor[]; pods: Point[]; ponds: Pond[];
  enemies: EnemySeed[]; critters: CritterSeed[]; npcs: NpcDef[]; objects: WorldObject[]; quests: QuestDef[];
  script: WorldScript;
};

export type MainQuest = { talkedGuide: boolean; keys: string[]; bossDefeated: boolean; finaleDone: boolean; readySeen: boolean };

export type SpellState = { id: SpellId; name: string; key: string; icon: string; unlocked: boolean; level: number; cooldown: number; cost: number; affordable: boolean };
export type BossState = { name: string; title: string; hp: number; maxHp: number; phase: number };
export type QuestRow = { id: string; title: string; giver: string; status: QuestStatus; detail: string; goal: string; progress: number; count: number; xp: number; reward: string; tracked: boolean };
export type ItemStack = { id: ItemId; count: number };
export type BuffState = { id: ItemId; time: number; max: number };
export type HeroStats = { regen: number; power: number; speed: number; spark: number; guard: number; elapsed: number; questsDone: number; totalQuests: number };

export type GameSnapshot = {
  levelId: LevelId; hp: number; maxHp: number; mana: number; maxMana: number; shield: boolean;
  level: number; xp: number; xpNext: number;
  spells: SpellState[]; nearName: string | null; nearAction: string | null;
  main: { title: string; step: string; progress: number; count: number }; quests: QuestRow[];
  items: ItemStack[]; buffs: BuffState[]; stats: HeroStats;
  defeated: number; combo: number; boss: BossState | null;
  discovered: number; totalPlaces: number; chests: number; totalChests: number; lore: number; totalLore: number;
};

export type LevelStats = { stars: number; time: number; defeated: number; quests: number; totalQuests: number; level: number };
export type NoticeTone = 'info' | 'good' | 'warn' | 'epic';
/** A quest being offered: the dialogue ends with Accept / Decline instead of closing. */
export type QuestOffer = { id: string; title: string; summary: string; reward: string };
export type EngineEvent =
  | { type: 'dialogue'; speaker: string; portrait: string; lines: string[]; then?: 'complete'; offer?: QuestOffer }
  | { type: 'item'; id: ItemId; count: number }
  | { type: 'levelComplete'; levelId: LevelId; stats: LevelStats }
  | { type: 'notice'; text: string; tone: NoticeTone }
  | { type: 'spellLearned'; spell: SpellId }
  | { type: 'levelUp'; level: number }
  | { type: 'quest'; title: string; state: 'accepted' | 'ready' | 'completed'; xp?: number }
  | { type: 'bossIntro'; name: string; title: string }
  | { type: 'zone'; name: string; discovered: boolean };
