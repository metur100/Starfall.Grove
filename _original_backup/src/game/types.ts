export type Point = { x: number; y: number };
export type LevelId = 'meadow' | 'woods';
export type ObjectKind = 'npc' | 'crystal' | 'glowbug' | 'bell' | 'satchel' | 'rune' | 'moth' | 'beacon' | 'shrine' | 'rootbell';
export type EnemyKind = 'gloomling' | 'thornling' | 'mossback' | 'brambleWarden';
export type WorldObject = { id: string; kind: ObjectKind; x: number; y: number; name: string; icon?: string };
export type Obstacle = { x: number; y: number; r: number; kind: 'tree' | 'rock' | 'bush' };
export type EnemySeed = { id: string; kind: EnemyKind; x: number; y: number; boss?: boolean };
export type Palette = { ground: string; alternate: string; path: string; pathEdge: string; accent: string; water: string };
export type WorldDefinition = {
  id: LevelId; title: string; subtitle: string; width: number; height: number; spawn: Point;
  palette: Palette; objects: WorldObject[]; obstacles: Obstacle[]; enemies: EnemySeed[];
  route: Point[]; zoneLabels: Array<{ x:number; y:number; name:string }>;
};
export type Enemy = EnemySeed & { hp: number; maxHp: number; dead: boolean; attackCooldown: number; windup: number; hitFlash: number };
export type Projectile = { x:number; y:number; vx:number; vy:number; life:number; damage:number; targetId:string };
export type FloatingText = { x:number; y:number; text:string; life:number; color:string };
export type QuestFlags = {
  bridgekeeper:boolean; crystals:string[]; elder:boolean; glowbugs:string[]; glowbugsDone:boolean;
  courier:boolean; hasBell:boolean; bellDone:boolean; bossDefeated:boolean; beaconRestored:boolean;
  forestKeeper:boolean; runes:string[]; moths:string[]; mothsDone:boolean; hasSatchel:boolean; satchelDone:boolean;
  shrine:boolean; wardenDefeated:boolean; rootBellRung:boolean;
};
export type GameSnapshot = {
  levelId:LevelId; hp:number; maxHp:number; mana:number; maxMana:number; shield:boolean;
  shieldUnlocked:boolean; leafReady:boolean; shieldReady:boolean; nearName:string|null;
  objectives:string[]; sideQuests:Array<{name:string;status:string;done:boolean}>;
  defeated:number; totalEnemies:number; progress:number; message:string;
};
export type EngineEvent =
  | {type:'dialogue'; speaker:string; lines:string[]}
  | {type:'levelComplete'; levelId:LevelId; stars:number}
  | {type:'notice'; text:string};
