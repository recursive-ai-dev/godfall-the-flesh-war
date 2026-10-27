import './warfare.test';
import './commands.test';
import { strict as assert } from 'node:assert';
import { GameEngine } from '../src/game/engine';
import { UNIT } from '../src/game/data';
import type { Faction } from '../src/game/types';
const factions: Faction[] = ['human', 'darkelf', 'corrupted'];
for (const faction of factions) {
  const e = new GameEngine(faction, 42);
  assert.equal(new Set(e.buildings.map(b => b.faction)).size, 3);
  assert.equal(e.hud().enemyBuildings, 4);
  assert.equal(e.hud().enemyUnits, 8);
  assert.equal(e.enemies.length, 2);
  for (const f of factions) {
    const u = e.units.find(u => u.faction === f)!;
    assert.equal(u.hp, UNIT.worker.hp * (f === 'human' ? 1.2 : 1));
  }
  // The match must continue after only one rival is eliminated.
  e.time = 10;
  e.buildings = e.buildings.filter(b => b.faction !== e.enemies[0]);
  (e as any).checkOutcome();
  assert.equal(e.outcome, 'playing');
  e.buildings = e.buildings.filter(b => b.faction === faction);
  (e as any).checkOutcome();
  assert.equal(e.outcome, 'victory');
  const lost = new GameEngine(faction, 42);
  lost.time = 10;
  lost.buildings = lost.buildings.filter(b => b.faction !== faction);
  (lost as any).checkOutcome();
  assert.equal(lost.outcome, 'defeat');
}
// Both AI economies must build, train, and gather independently.
const e = new GameEngine('human', 42);
for (let i = 0; i < 2400; i++) e.update(.05, new Set(), {x: 0, y: 0}, 1280, 720);
for (const f of e.enemies) {
  assert.ok(e.buildings.some(b => b.faction === f && b.type === 'barracks'), `${f} builds barracks`);
  assert.ok(e.units.some(u => u.faction === f && u.type !== 'worker'), `${f} trains troops`);
  assert.ok(e.units.some(u => u.faction === f && u.gatherType === 'lumber'), `${f} gathers lumber`);
}
console.log('Three-faction setup, bonuses, victory/defeat, and 120-second AI simulation passed.');

// Gathering at a solid mine and depositing outside the hall must produce income.
const economy = new GameEngine('human', 42);
const worker = economy.units.find(u => u.faction === 'human')!;
const mine = economy.mines.reduce((a,b) => Math.hypot(a.x-worker.x,a.y-worker.y) < Math.hypot(b.x-worker.x,b.y-worker.y) ? a : b);
const initialGold = economy.gold.human;
(economy as any).assignGatherGold(worker, mine);
for (let i = 0; i < 1200; i++) economy.update(.05, new Set(), {x:0,y:0}, 1280,720);
assert.ok(economy.gold.human > initialGold, 'worker completes mine-to-hall round trip');
console.log('Resource delivery regression passed.');

const battle = new GameEngine('human', 42);
const hall = battle.buildings.find(b => b.faction === 'darkelf' && b.type === 'hall')!;
const soldier = battle.spawnUnit('human', 'melee', (hall.tileX - .5) * 32, hall.y);
(battle as any).assignAttack(soldier, hall);
const before = hall.hp;
for(let i=0;i<100;i++) (battle as any).updateUnit(soldier,.05);
assert.ok(hall.hp < before, 'melee units can damage a hall from its perimeter');
console.log('Building combat regression passed.');
