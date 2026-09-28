export type Point = { x: number; y: number };
/** The valley is one continuous world made of four regions, one per story chapter. */
export type RegionId = 'meadow' | 'woods' | 'summit' | 'ember';
export type LevelId = RegionId;
export type HeroId = 'mira' | 'kael' | 'lyra' | 'riven';
export type SpellId = 'spark' | 'dash' | 'sunfire' | 'shield' | 'starfall' | 'slash' | 'charge' | 'guard' | 'slam' | 'bladestorm'
  | 'frostbolt' | 'blink' | 'frostnova' | 'iceBarrier' | 'blizzard' | 'stab' | 'shadowstep' | 'knives' | 'veil' | 'deathmark';
export type ItemId =
  | 'healthPotion' | 'manaPotion' | 'swiftTonic' | 'powerElixir' | 'barkskin'
  | 'fireBomb' | 'frostBomb' | 'thunderJar' | 'smokeBomb' | 'giantBrew' | 'hourglass' | 'luckyClover' | 'phoenixFeather';

// ───────────────────────────── equipment
export type GearSlot = 'head' | 'shoulders' | 'back' | 'chest' | 'hands' | 'waist' | 'legs' | 'feet';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
/** armor, power, speed and crit are percentages; health and mana are points; regen is per second. */
export type GearStat = 'armor' | 'power' | 'health' | 'mana' | 'regen' | 'speed' | 'crit';
export type GearStats = Partial<Record<GearStat, number>>;
export type GearItem = { uid: string; slot: GearSlot; rarity: Rarity; ilvl: number; name: string; stats: GearStats };
export type UpgradeId = 'staff' | 'mantle' | 'amulet';

// ───────────────────────────── world layout
export type PoiKind = 'start' | 'village' | 'city' | 'farm' | 'camp' | 'ruins' | 'lake' | 'lair' | 'grove' | 'shrine' | 'lookout' | 'finale' | 'gate';
export type Poi = { id: string; name: string; kind: PoiKind; x: number; y: number; r: number; region: RegionId; pack?: EnemyKind[] };

export type ObstacleKind =
  | 'tree' | 'pine' | 'rock' | 'bush' | 'crystal' | 'mushroom' | 'deadtree' | 'stump' | 'log'
  | 'house' | 'manor' | 'well' | 'fountain' | 'windmill' | 'tent' | 'stall' | 'pillar' | 'statue' | 'lamppost' | 'crate' | 'hay' | 'fence' | 'tower' | 'campfire'
  | 'barrel' | 'cart' | 'bench' | 'banner' | 'planter' | 'cliff';
/** Round obstacles collide as circles; ones with w/h collide as boxes (half extents). */
export type Obstacle = { x: number; y: number; r: number; kind: ObstacleKind; seed: number; w?: number; h?: number; color?: string };
export type DecorKind = 'grass' | 'flower' | 'fern' | 'pebble' | 'shroom' | 'shard' | 'crop' | 'reed' | 'clover';
export type Decor = { x: number; y: number; kind: DecorKind; seed: number; color: string };
export type Pond = { x: number; y: number; r: number };

export type EnemyKind =
  | 'gloomling' | 'thornling' | 'wisp' | 'bristleboar' | 'sporecap' | 'shadewolf' | 'webspinner' | 'frostwraith' | 'cragGolem'
  | 'emberImp' | 'ashScorpion' | 'magmaHulk'
  | 'mossback' | 'brambleWarden' | 'hollowStar' | 'cinderTyrant' | 'eclipse';
/** `guard` names the rescue quest whose captive this creature keeps caged. */
export type EnemySeed = { id: string; kind: EnemyKind; x: number; y: number; level: number; region: RegionId; boss?: boolean; elite?: boolean; guard?: string };

export type CritterKind = 'rabbit' | 'deer' | 'bird' | 'duck' | 'frog' | 'goat' | 'squirrel';
export type CritterSeed = { kind: CritterKind; x: number; y: number };

export type NpcHat = 'none' | 'straw' | 'hood' | 'cap' | 'wizard' | 'bonnet' | 'helm' | 'ears' | 'scarf';
export type NpcLook = { skin: string; robe: string; hat: NpcHat; hatColor: string; hair: string; beard?: boolean; small?: boolean };
export type NpcActivity = 'idle' | 'wander' | 'patrol' | 'travel' | 'chop' | 'farm' | 'fish' | 'sweep' | 'hammer' | 'play';
/** Merchants sell potions, smiths forge upgrades, armourers sell equipment, innkeepers let Mira rest. */
export type NpcRole = 'guide' | 'villager' | 'merchant' | 'smith' | 'inn' | 'armorer';
export type NpcDef = {
  id: string; name: string; portrait: string; look: NpcLook; activity: NpcActivity; x: number; y: number; region: RegionId;
  role?: NpcRole; route?: Point[]; lines: string[]; barks: string[];
  /** The person only appears once this quest is done. */
  after?: string;
};

export type ObjectKind = 'key' | 'questItem' | 'shrine' | 'finale' | 'chest' | 'sign' | 'lore' | 'well' | 'fountain' | 'campfire' | 'cage';
export type ItemIcon = 'herb' | 'flower' | 'bottle' | 'bundle' | 'gem' | 'letter' | 'mushroom' | 'feather' | 'toy' | 'bug';
export type Captive = { name: string; portrait: string; look: NpcLook };
export type WorldObject = { id: string; kind: ObjectKind; x: number; y: number; name: string; region: RegionId; text?: string[]; questId?: string; icon?: ItemIcon; captive?: Captive };

// ───────────────────────────── quests
/** talk: speak with `to` · key: find the relic `keys` · boss: defeat `boss` (and restore the finale if `finale`) · rescue: free the captive at `place`. */
export type QuestKind = 'collect' | 'slay' | 'deliver' | 'visit' | 'talk' | 'key' | 'boss' | 'rescue';
/** `hearts` is a permanent max-health bonus (one heart = 20 HP). */
export type QuestReward = { xp: number; gold?: number; hearts?: number; mana?: number; regen?: number; item?: ItemId };
export type QuestDef = {
  id: string; region: RegionId; title: string; giver: string; kind: QuestKind; count: number; summary: string;
  enemy?: EnemyKind | 'any'; near?: string; item?: string; icon?: ItemIcon; to?: string; place?: string; requires?: string;
  /** Main story quests are gold and chained with `requires`; `turnIn` is who to report to when it isn't the giver. */
  main?: boolean; turnIn?: string; keys?: number[];
  boss?: string; finale?: boolean; captive?: Captive; guards?: number;
  reward: QuestReward;
  text: { offer: string[]; progress: string[]; complete: string[]; after: string[]; deliver?: string[] };
};
export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'done';
export type QuestState = { status: QuestStatus; progress: number };

export type Ambient = 'petals' | 'leaves' | 'stars' | 'embers';
export type Ground = 'grass' | 'snow' | 'ash';
export type Palette = {
  ground: string; alternate: string; path: string; pathEdge: string; accent: string; water: string; waterDeep: string;
  foliage: [string, string, string]; trunk: string; rock: string; pod: string; roof: string[]; wall: string;
};

export type WorldScript = {
  keyLabel: string; bossName: string; bossTitle: string; finaleName: string;
  guide: { done: string[] };
  shrine: { bless: string[]; again: string[] };
  finale: { locked: string[]; guarded: string[]; done: string[] };
  pickupKey: string; sealed: string; tip: string;
  victory: { title: string; text: string };
  final?: { name: string; title: string };
};

export type Region = {
  id: RegionId; chapter: number; title: string; subtitle: string; name: string;
  x0: number; x1: number; palette: Palette; darkness: number; ambient: Ambient; ground: Ground;
  /** Creature levels rise from `levels[0]` near the region's entrance to `levels[1]` at its far side. */
  levels: [number, number]; xpScale: number; script: WorldScript;
};

export type WorldDefinition = {
  width: number; height: number; spawn: Point; regions: Region[];
  pois: Poi[]; roads: Point[][]; obstacles: Obstacle[]; decor: Decor[]; pods: Point[]; ponds: Pond[];
  enemies: EnemySeed[]; critters: CritterSeed[]; npcs: NpcDef[]; objects: WorldObject[]; quests: QuestDef[];
};

export type MainQuest = { keys: string[]; bosses: string[]; finales: RegionId[] };

/** A spell's upgrade stars: `bonus` is what the stars give now, `next` what the next star adds. */
export type SpellRank = { rank: number; max: number; bonus: string; next: string | null; cost: number; needLevel: number; canBuy: boolean };
export type SpellState = { id: SpellId; name: string; key: string; icon: string; unlocked: boolean; level: number; cooldown: number; cost: number; affordable: boolean; damage: number; rank: SpellRank; cd: number };
export type BossState = { name: string; title: string; hp: number; maxHp: number; phase: number; level: number };
export type QuestRow = { id: string; title: string; giver: string; status: QuestStatus; detail: string; goal: string; progress: number; count: number; xp: number; reward: string; tracked: boolean; chapter: number };
export type ItemStack = { id: ItemId; count: number };
export type BuffState = { id: ItemId; time: number; max: number };
export type HeroStats = { regen: number; power: number; speed: number; spark: number; guard: number; crit: number; elapsed: number; questsDone: number; totalQuests: number };

export type GameSnapshot = {
  hero: HeroId; region: RegionId; chapter: number; hp: number; maxHp: number; mana: number; maxMana: number; shield: boolean;
  level: number; xp: number; xpNext: number; gold: number; upgrades: Partial<Record<UpgradeId, number>>;
  spells: SpellState[]; nearName: string | null; nearAction: string | null;
  main: { title: string; step: string; progress: number; count: number; index: number; total: number }; mainQuests: QuestRow[]; quests: QuestRow[];
  items: ItemStack[]; buffs: BuffState[]; stats: HeroStats;
  /** Equipment in the bag, what is worn, the bag's size and the item on the second quick button. */
  gear: GearItem[]; equipped: Partial<Record<GearSlot, GearItem>>; bagSize: number; quick: ItemId;
  defeated: number; combo: number; boss: BossState | null;
  discovered: number; totalPlaces: number; chests: number; totalChests: number; lore: number; totalLore: number;
};

export type LevelStats = { stars: number; time: number; defeated: number; quests: number; totalQuests: number; level: number };
export type NoticeTone = 'info' | 'good' | 'warn' | 'epic';
/** A quest being offered: the dialogue ends with Accept / Decline instead of closing. */
export type QuestOffer = { id: string; title: string; summary: string; reward: string; main: boolean };
export type ShopKind = 'merchant' | 'smith' | 'armorer';
/** A piece on an armourer's shelf. `sold` pieces stay on the shelf, marked, until the stock changes. */
export type ShopGear = { item: GearItem; price: number; needLevel: number; sold: boolean };
export type EngineEvent =
  | { type: 'dialogue'; speaker: string; portrait: string; lines: string[]; then?: 'complete'; offer?: QuestOffer }
  | { type: 'item'; id: ItemId; count: number }
  | { type: 'loot'; item: GearItem; equipped?: boolean }
  /** A chapter's light is restored: the adventure simply carries on east. `last` is the end of the whole story. */
  | { type: 'levelComplete'; region: RegionId; stats: LevelStats; last: boolean }
  | { type: 'achievement'; id: string; name: string; description: string; icon: string; points: number }
  /** `short` is the phone version: small screens get a few words instead of a sentence. */
  | { type: 'notice'; text: string; tone: NoticeTone; short?: string }
  | { type: 'spellLearned'; spell: SpellId }
  | { type: 'levelUp'; level: number }
  | { type: 'quest'; title: string; state: 'accepted' | 'ready' | 'completed'; xp?: number }
  | { type: 'bossIntro'; name: string; title: string }
  | { type: 'zone'; name: string; discovered: boolean }
  | { type: 'region'; region: RegionId; danger: boolean }
  | { type: 'shop'; kind: ShopKind; name: string; portrait: string };
