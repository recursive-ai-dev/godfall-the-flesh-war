import { MAP_W, MAP_H, TILE, TERRAIN, type Faction, type Unit } from './types';
export const FACTIONS: Faction[] = ['human', 'darkelf', 'corrupted'];
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY = {
  easy: { label: 'Initiate', interval: 1.4, march: 95, army: 7, retreat: .2 },
  normal: { label: 'Warlord', interval: .7, march: 55, army: 5, retreat: .3 },
  hard: { label: 'Godslayer', interval: .4, march: 35, army: 4, retreat: .4 },
};
export const RELIC = { x: MAP_W * TILE / 2, y: MAP_H * TILE / 2, radius: 144, goal: 180 };
export const DOCTRINE = {
  human: { ability: 'Shield wall', ritual: 'Purification', description: '8s: selected soldiers take 50% less damage but move at half speed. Champions support allies within 100px. Human towers have 30% more health.', cooldown: 24 },
  darkelf: { ability: 'Shadow-step', ritual: 'Ascension', description: 'Blink selected soldiers 96px toward the cursor through scouted ground. Forest edges conceal units; attacking reveals them. Nightbows poison enemies.', cooldown: 18 },
  corrupted: { ability: 'Frenzy', ritual: 'The Great Feast', description: '8s: selected soldiers attack faster and chase nearby enemies, ignoring new orders. Consume nearby corpses to heal; three meals grant a permanent mutation.', cooldown: 28 },
};
export interface Corpse { x: number; y: number; life: number; faction: Faction; }
export interface Ritual { owner: Faction | null; contested: boolean; progress: Record<Faction, number>; }
export interface BattleStats { trained: number; kills: number; losses: number; buildings: number; gold: number; lumber: number; feasts: number; }
export function newStats(): Record<Faction, BattleStats> {
  return Object.fromEntries(FACTIONS.map(f => [f, { trained: 0, kills: 0, losses: 0, buildings: 0, gold: 0, lumber: 0, feasts: 0 }])) as Record<Faction, BattleStats>;
}
export function forestCover(u: Unit, terrain: Uint8Array) {
  const tx = Math.floor(u.x / TILE), ty = Math.floor(u.y / TILE);
  for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && terrain[y * MAP_W + x] === TERRAIN.FOREST) return true;
  }
  return false;
}
export function concealed(u: Unit, terrain: Uint8Array) {
  return u.faction === 'darkelf' && u.type !== 'siege' && u.revealed <= 0 && u.state !== 'attack' && forestCover(u, terrain);
}
export function detectable(u: Unit, observer: Faction, units: Unit[], terrain: Uint8Array) {
  return u.faction === observer || !concealed(u, terrain) || units.some(v => v.faction === observer && v.state !== 'dead' && Math.hypot(v.x-u.x,v.y-u.y) < 80);
}
