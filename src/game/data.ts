import type { BuildingClass, Faction, UnitClass } from "./types";

export interface UnitStats {
  name: Record<Faction, string>;
  hp: number;
  dmg: number;
  range: number;
  speed: number;
  attackCd: number;
  los: number;
  gold: number;
  lumber: number;
  food: number;
  time: number;
  radius: number;
  buildingDmg: number;
  aoe: number;
}

export interface BuildingStats {
  name: Record<Faction, string>;
  hp: number;
  tw: number;
  th: number;
  gold: number;
  lumber: number;
  time: number;
  los: number;
  food: number;
  dmg: number;
  range: number;
  attackCd: number;
}

export const UNIT: Record<UnitClass, UnitStats> = {
  worker: {
    name: { human: "Peasant", darkelf: "Thrall", corrupted: "Flesh Gatherer" },
    hp: 40,
    dmg: 3,
    range: 16,
    speed: 82,
    attackCd: 1.3,
    los: 5,
    gold: 70,
    lumber: 0,
    food: 1,
    time: 12,
    radius: 5.5,
    buildingDmg: 3,
    aoe: 0,
  },
  melee: {
    name: { human: "Footman", darkelf: "Duskblade", corrupted: "Ravenous" },
    hp: 90,
    dmg: 10,
    range: 18,
    speed: 70,
    attackCd: 1.15,
    los: 6,
    gold: 95,
    lumber: 0,
    food: 2,
    time: 15,
    radius: 6.5,
    buildingDmg: 10,
    aoe: 0,
  },
  ranged: {
    name: { human: "Archer", darkelf: "Nightbow", corrupted: "Marrow Spitter" },
    hp: 50,
    dmg: 7,
    range: 115,
    speed: 72,
    attackCd: 1.35,
    los: 8,
    gold: 80,
    lumber: 40,
    food: 2,
    time: 16,
    radius: 5.5,
    buildingDmg: 5,
    aoe: 0,
  },
  cavalry: {
    name: { human: "Crown Champion", darkelf: "Shade Runner", corrupted: "Frenzied" },
    hp: 135,
    dmg: 16,
    range: 20,
    speed: 118,
    attackCd: 1.2,
    los: 7,
    gold: 180,
    lumber: 55,
    food: 3,
    time: 22,
    radius: 8,
    buildingDmg: 16,
    aoe: 0,
  },
  siege: {
    name: { human: "Siege Adept", darkelf: "Void Caller", corrupted: "Godmouth" },
    hp: 70,
    dmg: 18,
    range: 175,
    speed: 42,
    attackCd: 3.2,
    los: 8,
    gold: 220,
    lumber: 90,
    food: 3,
    time: 30,
    radius: 9,
    buildingDmg: 42,
    aoe: 34,
  },
};

export const BUILDING: Record<BuildingClass, BuildingStats> = {
  hall: {
    name: { human: "Town Hall", darkelf: "Night Spire", corrupted: "Feasting Hall" },
    hp: 1400,
    tw: 4,
    th: 4,
    gold: 380,
    lumber: 320,
    time: 48,
    los: 8,
    food: 5,
    dmg: 0,
    range: 0,
    attackCd: 0,
  },
  farm: {
    name: { human: "Farm", darkelf: "Moon Garden", corrupted: "Flesh Larder" },
    hp: 400,
    tw: 2,
    th: 2,
    gold: 70,
    lumber: 170,
    time: 16,
    los: 4,
    food: 8,
    dmg: 0,
    range: 0,
    attackCd: 0,
  },
  barracks: {
    name: { human: "Barracks", darkelf: "Blade Sanctum", corrupted: "Raving Pit" },
    hp: 900,
    tw: 3,
    th: 3,
    gold: 170,
    lumber: 150,
    time: 26,
    los: 5,
    food: 0,
    dmg: 0,
    range: 0,
    attackCd: 0,
  },
  mill: {
    name: { human: "Lumber Mill", darkelf: "Gloam Mill", corrupted: "Bone Mill" },
    hp: 700,
    tw: 3,
    th: 3,
    gold: 110,
    lumber: 70,
    time: 20,
    los: 5,
    food: 0,
    dmg: 0,
    range: 0,
    attackCd: 0,
  },
  blacksmith: {
    name: { human: "Blacksmith", darkelf: "Void Forge", corrupted: "Marrow Forge" },
    hp: 760,
    tw: 3,
    th: 3,
    gold: 150,
    lumber: 110,
    time: 24,
    los: 4,
    food: 0,
    dmg: 0,
    range: 0,
    attackCd: 0,
  },
  stables: {
    name: { human: "Stables", darkelf: "Shade Lodge", corrupted: "Hunger Shrine" },
    hp: 820,
    tw: 3,
    th: 3,
    gold: 190,
    lumber: 150,
    time: 28,
    los: 4,
    food: 0,
    dmg: 0,
    range: 0,
    attackCd: 0,
  },
  tower: {
    name: { human: "Guard Tower", darkelf: "Obsidian Watch", corrupted: "Gore Watch" },
    hp: 550,
    tw: 2,
    th: 2,
    gold: 130,
    lumber: 80,
    time: 20,
    los: 10,
    food: 0,
    dmg: 11,
    range: 145,
    attackCd: 1.4,
  },
};

export const GATHER_GOLD = 10;
export const GATHER_LUMBER = 8;
export const GOLD_TIME = 2.1;
export const LUMBER_TIME = 1.55;
export const CARRY_RANGE = 26;
export const START_GOLD = 750;
export const START_LUMBER = 500;

export function unitName(type: UnitClass, f: Faction) {
  return UNIT[type].name[f];
}

export function buildingName(type: BuildingClass, f: Faction) {
  return BUILDING[type].name[f];
}

export const BUILD_ORDER: BuildingClass[] = [
  "farm",
  "barracks",
  "mill",
  "blacksmith",
  "stables",
  "tower",
  "hall",
];
