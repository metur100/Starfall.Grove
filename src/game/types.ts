export type Point = { x: number; y: number };
/** The valley is one continuous world made of four regions, one per story chapter. */
export type RegionId = 'meadow' | 'woods' | 'summit' | 'ember';
export type LevelId = RegionId;
export type HeroId = 'mira' | 'kael' | 'lyra' | 'riven' | 'wren';
/** Mounts are earned through achievements; riding one makes crossing the valley much faster. */
export type MountId = 'pony' | 'boar' | 'stag' | 'frostwolf' | 'drake' | 'unicorn';
export type SpellId = 'spark' | 'gravity' | 'sunfire' | 'starguard' | 'starfall' | 'slash' | 'charge' | 'guard' | 'slam' | 'bladestorm'
  | 'frostbolt' | 'blink' | 'frostnova' | 'iceBlock' | 'blizzard' | 'stab' | 'shadowstep' | 'knives' | 'stealth' | 'deathmark'
  | 'arrow' | 'command' | 'volley' | 'snare' | 'wildcall';
export type ItemId =
  | 'healthPotion' | 'manaPotion' | 'swiftTonic' | 'powerElixir' | 'barkskin'
  | 'fireBomb' | 'frostBomb' | 'thunderJar' | 'smokeBomb' | 'giantBrew' | 'hourglass' | 'luckyClover' | 'phoenixFeather';

// ───────────────────────────── equipment
export type GearSlot = 'head' | 'shoulders' | 'back' | 'chest' | 'hands' | 'waist' | 'legs' | 'feet' | 'weapon';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
/** armor, power, speed and crit are percentages; health and mana are points; regen is per second. */
export type GearStat = 'armor' | 'power' | 'health' | 'mana' | 'regen' | 'speed' | 'crit';
export type GearStats = Partial<Record<GearStat, number>>;
/** `hero` is set on weapons: each hero has their own kind (staff, sword, bow, daggers). */
export type GearItem = { uid: string; slot: GearSlot; rarity: Rarity; ilvl: number; name: string; stats: GearStats; hero?: HeroId };
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
export type EnemySeed = { id: string; kind: EnemyKind; x: number; y: number; level: number; region: RegionId; boss?: boolean; elite?: boolean; guard?: string;
  /** A heroic creature: a named little boss that leads a lair's pack (it also counts as an elite). */
  heroic?: string };

export type CritterKind = 'rabbit' | 'deer' | 'bird' | 'duck' | 'frog' | 'goat' | 'squirrel' | 'sheep';
export type CritterSeed = { kind: CritterKind; x: number; y: number };

export type NpcHat = 'none' | 'straw' | 'hood' | 'cap' | 'wizard' | 'bonnet' | 'helm' | 'ears' | 'scarf';
export type NpcLook = { skin: string; robe: string; hat: NpcHat; hatColor: string; hair: string; beard?: boolean; small?: boolean };
export type NpcActivity = 'idle' | 'wander' | 'patrol' | 'travel' | 'chop' | 'farm' | 'fish' | 'sweep' | 'hammer' | 'play';
/** Merchants sell potions, smiths forge upgrades, armourers sell equipment, innkeepers let Mira rest. */
export type NpcRole = 'guide' | 'villager' | 'merchant' | 'smith' | 'inn' | 'armorer'
  /** Quest people: someone walking with the hero, someone running away, and people in a cutscene. */
  | 'follower' | 'thief' | 'actor';
export type NpcDef = {
  id: string; name: string; portrait: string; look: NpcLook; activity: NpcActivity; x: number; y: number; region: RegionId;
  role?: NpcRole; route?: Point[]; lines: string[]; barks: string[];
  /** The person only appears once this quest is done, and is gone once `until` is under way. */
  after?: string; until?: string;
  /** Someone in one hero's own story only. */
  hero?: HeroId;
};

export type ObjectKind = 'key' | 'questItem' | 'shrine' | 'finale' | 'chest' | 'sign' | 'lore' | 'well' | 'fountain' | 'campfire' | 'cage' | 'crack' | 'waterfall'
  /** Quest places: something to build, things to light in turn, clues on a trail, a sheep pen, what a siege attacks,
   *  and the broken crossing between two lands. */
  | 'site' | 'switch' | 'clue' | 'pen' | 'ward' | 'barrier';
/** What a build site becomes; how a switch looks; what blocks a land's eastern gate. */
export type SiteKind = 'bridge' | 'tower' | 'barricade' | 'well' | 'lantern' | 'bellows';
export type SwitchKind = 'brazier' | 'lantern' | 'rune' | 'totem' | 'vent';
export type BarrierKind = 'bridge' | 'thorns' | 'ice';
export type ItemIcon = 'herb' | 'flower' | 'bottle' | 'bundle' | 'gem' | 'letter' | 'mushroom' | 'feather' | 'toy' | 'bug';
export type Captive = { name: string; portrait: string; look: NpcLook };
/** Secrets: a `crack` (a cracked wall, broken with a bomb) or a `waterfall` (a cave behind it) hides the object whose
 *  `hiddenBy` names it. `rich` chests hold better loot. */
export type WorldObject = { id: string; kind: ObjectKind; x: number; y: number; name: string; region: RegionId; text?: string[]; questId?: string; icon?: ItemIcon; captive?: Captive; hiddenBy?: string; rich?: boolean;
  /** Sites, switches and barriers: which kind. `step` is a switch's or clue's place in its quest. */
  variant?: string; step?: number };

// ───────────────────────────── quests
/**
 * talk: speak with `to` · key: find the relic `keys` · boss: defeat `boss` (and restore the finale if `finale`) · rescue: free the captive at `place`
 * escort: walk `who` from `from` to `place` · defend: hold `place` against `waves` · build: gather `count` materials near `near`, then build at `place`
 * activate: light the switches near `near` (in order if `ordered`) · chase: catch `who` near `place` · trail: follow `clues` from `near` to `place`
 * herd: drive `count` animals from `near` into the pen at `place`.
 */
export type QuestKind = 'collect' | 'slay' | 'deliver' | 'visit' | 'talk' | 'key' | 'boss' | 'rescue' | 'escort' | 'defend' | 'build' | 'activate' | 'chase' | 'trail' | 'herd';
export type QuestText = { offer: string[]; progress: string[]; complete: string[]; after: string[]; deliver?: string[]; arrive?: string[] };
/** One side of a choice at the end of a conversation: what the button says, what is said after, and a bonus. */
export type ChoiceOption = { label: string; lines: string[]; reward?: Partial<QuestReward> };
/** Cutscenes a quest plays: when accepted (for a siege, when it begins), when its goal is met, and once it is done. */
export type QuestCines = { start?: string; ready?: string; done?: string; caught?: string };
/** `hearts` is a permanent max-health bonus (one heart = 20 HP). */
export type QuestReward = { xp: number; gold?: number; hearts?: number; mana?: number; regen?: number; item?: ItemId };
export type QuestDef = {
  id: string; region: RegionId; title: string; giver: string; kind: QuestKind; count: number; summary: string;
  enemy?: EnemyKind | 'any'; near?: string; item?: string; icon?: ItemIcon; to?: string; place?: string; requires?: string;
  /** Main story quests are gold and chained with `requires`; `turnIn` is who to report to when it isn't the giver. */
  main?: boolean; turnIn?: string; keys?: number[];
  boss?: string; finale?: boolean; captive?: Captive; guards?: number;
  reward: QuestReward;
  text: QuestText;
  /** One hero's own story: only that hero gets the quest, and it slots into the main story right after `after`. */
  hero?: HeroId; after?: string;
  /** Other heroes' versions of the lines. */
  textFor?: Partial<Record<HeroId, Partial<QuestText>>>;
  /** Other heroes' version of who gives the quest and who it sends them to (heroes start in different places). */
  forHero?: Partial<Record<HeroId, Partial<Pick<QuestDef, 'giver' | 'to' | 'summary'>>>>;
  /** Rescue: the freed captive then walks home with you. Escort and chase: who. */
  escort?: boolean; who?: Captive; from?: string; ambush?: EnemyKind[];
  /** A follower drawn as a beast instead of a person. */
  beast?: 'wolf';
  /** Defend: creatures in each wave, which kinds, and what they attack. */
  waves?: number[]; foes?: EnemyKind[]; ward?: string;
  /** Build: what gets built. Activate: what the switches are, their names (in the right order), and whether order matters. */
  site?: SiteKind; siteName?: string; switches?: SwitchKind; order?: string[]; ordered?: boolean;
  clues?: string[]; animal?: 'sheep' | 'goat';
  /** Chase: the one you catch slips away in a puff of shadow. */
  escapes?: boolean;
  /** Done the moment its goal is met, with no one to report to. */
  auto?: boolean;
  cine?: QuestCines; choice?: { a: ChoiceOption; b: ChoiceOption };
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
export type SpellState = { id: SpellId; name: string; key: string; icon: string; unlocked: boolean;
  /** A toggle that is switched on right now: Ice Block, Stealth, or Fenn sent to attack. */
  active?: boolean; level: number; cooldown: number; cost: number; affordable: boolean; damage: number; rank: SpellRank; cd: number };
export type BossState = { name: string; title: string; hp: number; maxHp: number; phase: number; level: number };
export type QuestRow = { id: string; title: string; giver: string; status: QuestStatus; detail: string; goal: string; progress: number; count: number; xp: number; reward: string; tracked: boolean; chapter: number;
  /** One of the hero's own quests. */
  personal?: boolean;
  /** It can be given up from the journal; `abandoned` ones can be taken up again there. */
  canAbandon?: boolean; abandoned?: boolean };
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
  /** The mount the hero rides (or would summon), or null before one is earned. */
  mount: { id: MountId; name: string; riding: boolean } | null;
  discovered: number; totalPlaces: number; chests: number; totalChests: number; lore: number; totalLore: number;
  /** A cutscene playing, a siege under way, and something being built. */
  cine: CineState | null; siege: SiegeState | null; work: { label: string; t: number } | null;
};
export type CineState = { key: string; text: string; speaker: string; portrait: string; title: string; sub: string; last: boolean };
export type SiegeState = { title: string; ward: string; wave: number; waves: number; hp: number; max: number; left: number; resting: number };

export type LevelStats = { stars: number; time: number; defeated: number; quests: number; totalQuests: number; level: number };
export type NoticeTone = 'info' | 'good' | 'warn' | 'epic';
/** A quest being offered: the dialogue ends with Accept / Decline instead of closing. */
export type QuestOffer = { id: string; title: string; summary: string; reward: string; main: boolean;
  /** Set when a villager offers a mini-game instead of a quest: Play opens it. */
  game?: { kind: MiniGame; stake: number; opponent: string; portrait: string } };
export type MiniGame = 'dice' | 'archery';
/** Cosmetic trails that follow the hero, earned by achievements. */
export type TrailId = 'sparks' | 'clovers' | 'stardust';
export type ShopKind = 'merchant' | 'smith' | 'armorer';
/** A piece on an armourer's shelf. `sold` pieces stay on the shelf, marked, until the stock changes. */
export type ShopGear = { item: GearItem; price: number; needLevel: number; sold: boolean };
export type EngineEvent =
  | { type: 'dialogue'; speaker: string; portrait: string; lines: string[]; then?: 'complete'; offer?: QuestOffer }
  /** A conversation that ends with two answers to pick from. */
  | { type: 'choice'; speaker: string; portrait: string; lines: string[]; quest: string; title: string; a: string; b: string }
  | { type: 'item'; id: ItemId; count: number }
  | { type: 'loot'; item: GearItem; equipped?: boolean }
  /** A chapter's light is restored: the adventure simply carries on east. `last` is the end of the whole story. */
  | { type: 'levelComplete'; region: RegionId; stats: LevelStats; last: boolean }
  | { type: 'achievement'; id: string; name: string; description: string; icon: string; points: number }
  /** `short` is the phone version: small screens get a few words instead of a sentence. */
  | { type: 'notice'; text: string; tone: NoticeTone; short?: string }
  | { type: 'spellLearned'; spell: SpellId }
  | { type: 'levelUp'; level: number }
  | { type: 'quest'; title: string; state: 'accepted' | 'ready' | 'completed' | 'abandoned'; xp?: number }
  | { type: 'bossIntro'; name: string; title: string }
  | { type: 'zone'; name: string; discovered: boolean }
  | { type: 'region'; region: RegionId; danger: boolean }
  | { type: 'shop'; kind: ShopKind; name: string; portrait: string };
