export type Point = { x: number; y: number };
export type LevelId = 'meadow' | 'woods' | 'summit';
export type SpellId = 'spark' | 'dash' | 'leaf' | 'sunfire' | 'shield' | 'starfall';

export type ObjectKind = 'npc' | 'key' | 'collectible' | 'item' | 'shrine' | 'finale';
export type NpcRole = 'guide' | 'helper' | 'courier';
export type WorldObject = { id: string; kind: ObjectKind; x: number; y: number; name: string; role?: NpcRole; color?: string; portrait?: string };

export type ObstacleKind = 'tree' | 'pine' | 'rock' | 'bush' | 'crystal' | 'mushroom';
export type Obstacle = { x: number; y: number; r: number; kind: ObstacleKind; seed: number };
export type DecorKind = 'grass' | 'flower' | 'fern' | 'pebble' | 'shroom' | 'shard';
export type Decor = { x: number; y: number; kind: DecorKind; seed: number; color: string };
export type Pond = { x: number; y: number; r: number };

export type EnemyKind = 'gloomling' | 'thornling' | 'wisp' | 'mossback' | 'brambleWarden' | 'hollowStar';
export type EnemySeed = { id: string; kind: EnemyKind; x: number; y: number; boss?: boolean };

export type Ambient = 'petals' | 'leaves' | 'stars';
export type Palette = {
  ground: string; alternate: string; path: string; pathEdge: string; accent: string; water: string; waterDeep: string;
  foliage: [string, string, string]; trunk: string; rock: string; pod: string;
};

export type WorldScript = {
  keyLabel: string; collectLabel: string; itemLabel: string;
  bossName: string; bossTitle: string; finaleName: string;
  guide: { intro: (found: number) => string[]; ready: string[] };
  helper: { ask: string[]; thanks: string[]; done: string[] };
  courier: { ask: string[]; thanks: string[]; done: string[] };
  shrine: { learn: string[]; again: string[] };
  finale: { locked: string[]; guarded: string[]; done: string[] };
  pickup: { key: string; collect: string; item: string };
  sealed: string; tip: string;
  victory: { title: string; text: string };
};

export type WorldDefinition = {
  id: LevelId; chapter: number; title: string; subtitle: string; region: string;
  width: number; height: number; spawn: Point; palette: Palette;
  darkness: number; ambient: Ambient; spell: SpellId;
  objects: WorldObject[]; obstacles: Obstacle[]; decor: Decor[]; pods: Point[]; ponds: Pond[];
  enemies: EnemySeed[]; route: Point[]; zoneLabels: Array<{ x: number; y: number; name: string }>;
  script: WorldScript;
};

export type QuestFlags = {
  talkedGuide: boolean; keys: string[]; collected: string[]; helperDone: boolean;
  talkedCourier: boolean; hasItem: boolean; courierDone: boolean;
  spellLearned: boolean; bossDefeated: boolean; finaleDone: boolean;
};

export type SpellState = { id: SpellId; name: string; key: string; icon: string; unlocked: boolean; cooldown: number; cost: number; affordable: boolean };
export type BossState = { name: string; title: string; hp: number; maxHp: number; phase: number };

export type GameSnapshot = {
  levelId: LevelId; hp: number; maxHp: number; mana: number; maxMana: number; shield: boolean;
  spells: SpellState[]; nearName: string | null; nearAction: string | null;
  objectives: string[]; sideQuests: Array<{ name: string; status: string; done: boolean }>;
  defeated: number; totalEnemies: number; combo: number; boss: BossState | null;
};

export type LevelStats = { stars: number; time: number; defeated: number; totalEnemies: number };
export type NoticeTone = 'info' | 'good' | 'warn' | 'epic';
export type EngineEvent =
  | { type: 'dialogue'; speaker: string; portrait: string; lines: string[]; then?: 'complete' }
  | { type: 'levelComplete'; levelId: LevelId; stats: LevelStats }
  | { type: 'notice'; text: string; tone: NoticeTone }
  | { type: 'spellLearned'; spell: SpellId }
  | { type: 'bossIntro'; name: string; title: string }
  | { type: 'zone'; name: string };
