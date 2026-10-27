import type { BattleStats, Difficulty, Ritual } from './warfare';
export type Faction = "human" | "darkelf" | "corrupted";
export type UnitClass = "worker" | "melee" | "ranged" | "cavalry" | "siege";
export type BuildingClass =
  | "hall"
  | "farm"
  | "barracks"
  | "mill"
  | "blacksmith"
  | "stables"
  | "tower";
export type UnitState =
  | "idle"
  | "move"
  | "attack"
  | "gather"
  | "return"
  | "build"
  | "dead";

export const TILE = 32;
export const MAP_W = 72;
export const MAP_H = 72;

export const TERRAIN = {
  GRASS: 0,
  DIRT: 1,
  WATER: 2,
  FOREST: 3,
  GOLD: 4,
  ROCK: 5,
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface Order { x: number; y: number; attack: boolean; }

export interface Unit {
  id: number;
  kind: "unit";
  faction: Faction;
  type: UnitClass;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  state: UnitState;
  targetId: number | null;
  targetX: number;
  targetY: number;
  path: Point[];
  attackCd: number;
  gatherType: "gold" | "lumber" | null;
  carried: number;
  nodeId: number | null;
  buildId: number | null;
  anim: number;
  stuck: number;
  lastX: number;
  lastY: number;
  attackMove: boolean;
  gatherTimer: number;
  bob: number;
  repath: number;
  hold: boolean;
  orders: Order[];
  destination: Point | null;
  abilityCd: number;
  abilityTime: number;
  revealed: number;
  poison: number;
  poisonSource: Faction | null;
  meals: number;
  flash: number;
}

export interface Building {
  id: number;
  kind: "building";
  faction: Faction;
  type: BuildingClass;
  tileX: number;
  tileY: number;
  tw: number;
  th: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  progress: number;
  complete: boolean;
  queue: { type: UnitClass; t: number; max: number }[];
  rallyX: number;
  rallyY: number;
  attackCd: number;
}

export interface GoldMine {
  id: number;
  kind: "mine";
  tileX: number;
  tileY: number;
  tw: number;
  th: number;
  x: number;
  y: number;
  gold: number;
}

export interface Tree {
  id: number;
  kind: "tree";
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  lumber: number;
  variant: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  dmg: number;
  aoe: number;
  faction: Faction;
  type: "arrow" | "boulder";
  life: number;
  targetId: number | null;
  poison?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  z: number;
}

export interface Floater {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

export interface Message {
  text: string;
  t: number;
}

export interface Decoration {
  x: number;
  y: number;
  type: "flower" | "rock" | "stump" | "bones" | "ruin";
  v: number;
}

export interface HudSelection {
  kind: "unit" | "building" | "mine" | "mixed";
  types: string[];
  count: number;
  hp: number;
  maxHp: number;
  faction: Faction | null;
  queue: { type: UnitClass; t: number; max: number }[];
  progress: number;
  complete: boolean;
  buildingType: BuildingClass | null;
  unitType: UnitClass | null;
  goldLeft?: number;
}

export interface HudState {
  gold: number;
  lumber: number;
  food: number;
  foodMax: number;
  time: number;
  selected: HudSelection | null;
  buildMode: BuildingClass | null;
  attackMove: boolean;
  hasStables: boolean;
  hasBlacksmith: boolean;
  hasHall: boolean;
  hasBarracks: boolean;
  outcome: "playing" | "victory" | "defeat";
  messages: Message[];
  enemyBuildings: number;
  enemyUnits: number;
  playerBuildings: number;
  playerUnits: number;
  ritual: Ritual;
  empowered: Record<Faction, boolean>;
  stats: Record<Faction, BattleStats>;
  resultReason: string;
  difficulty: Difficulty;
  idleWorkers: number;
  canPan: {left:boolean;right:boolean;up:boolean;down:boolean};
  abilityReady: number;
  abilityCooldown: number;
  holding: boolean;
  queuedOrders: number;
}

export const TEAM: Record<Faction, { primary: string; dark: string; light: string; name: string }> = {
  human: {
    primary: "#3b6ea8",
    dark: "#1e3d66",
    light: "#7eb3e0",
    name: "The Ashen Crown",
  },
  corrupted: { primary: "#bd493d", dark: "#491a19", light: "#ff9580", name: "The God-Eaters" },
  darkelf: {
    primary: "#9064bf",
    dark: "#352047",
    light: "#d1a8ff",
    name: "The Umbral Court",
  },
};
