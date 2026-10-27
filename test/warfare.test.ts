import { strict as assert } from 'node:assert';
import { GameEngine } from '../src/game/engine';
import { RELIC, detectable, FACTIONS } from '../src/game/warfare';
import { MAP_W, TILE, TERRAIN } from '../src/game/types';
import { generateMap } from '../src/game/map';
import { astar } from '../src/game/pathfinding';
function sandbox(f: 'human'|'darkelf'|'corrupted'='human') {
  const e=new GameEngine(f,42); e.units=[];e.blocked.fill(0);e.terrain.fill(TERRAIN.GRASS);e.explored.fill(1);e.vis.fill(2);return e;
}
const ritual=sandbox();
const human=ritual.spawnUnit('human','melee',RELIC.x,RELIC.y);
const hp=human.maxHp, hall=ritual.buildings.find(b=>b.faction==='human')!, hallHp=hall.maxHp;
(ritual as any).updateRitual(100);
const rival=ritual.spawnUnit('darkelf','melee',RELIC.x+30,RELIC.y);
(ritual as any).updateRitual(50);
assert.equal(ritual.ritual.progress.human,100);assert.ok(ritual.ritual.contested);
rival.x=100;(ritual as any).updateRitual(80);
assert.ok(ritual.empowered.human);assert.equal(human.maxHp,hp*2);assert.equal(hall.maxHp,hallHp*2);
assert.equal(ritual.outcome,'playing','ritual is a power spike, never instant victory');
(ritual as any).updateRitual(80);assert.equal(human.maxHp,hp*2,'awakening applies once');
assert.equal(ritual.spawnUnit('human','melee',100,100).maxHp,hp*2,'new recruits inherit awakening');
human.x=100;rival.x=RELIC.x;(ritual as any).updateRitual(180);
assert.ok(ritual.empowered.darkelf,'a second host can complete its own ritual');
assert.equal(ritual.outcome,'playing');
const shield=sandbox();const guard=shield.spawnUnit('human','melee',500,500);
shield.activateAbility([guard]);const before=guard.hp;(shield as any).hurt(guard,20,'corrupted');
assert.equal(before-guard.hp,10);assert.equal(shield.activateAbility([guard]),0,'cooldown prevents recasting');
const officer=shield.spawnUnit('human','cavalry',520,500);guard.abilityTime=0;const officerBefore=guard.hp;
(shield as any).hurt(guard,20,'corrupted');assert.equal(officerBefore-guard.hp,17);
assert.ok(officer.hp>0);
const elf=sandbox('darkelf'), scout=elf.spawnUnit('darkelf','ranged',500,500);
elf.activateAbility([scout],{x:700,y:500});assert.equal(scout.x,596);
scout.revealed=0;elf.terrain[Math.floor(scout.y/TILE)*MAP_W+Math.floor(scout.x/TILE)+1]=TERRAIN.FOREST;
assert.equal(detectable(scout,'human',elf.units,elf.terrain),false);
const detector=elf.spawnUnit('human','melee',scout.x+60,scout.y);
assert.equal(detectable(scout,'human',elf.units,elf.terrain),true);detector.x=900;
scout.state='attack';assert.equal(detectable(scout,'human',elf.units,elf.terrain),true);
const target=elf.spawnUnit('human','melee',scout.x+60,scout.y);
(elf as any).spawnProjectile(scout,target);
for(let i=0;i<20;i++) (elf as any).updateProjectiles(.05);
assert.ok(target.poison>0,'Nightbow projectiles apply poison');const poisonedHp=target.hp;
(elf as any).updateUnit(target,.05);assert.ok(target.hp<poisonedHp);
const cult=sandbox('corrupted'), eater=cult.spawnUnit('corrupted','melee',500,500),baseHp=eater.maxHp;
for(let i=0;i<3;i++) {cult.corpses.push({x:500,y:500,life:30,faction:'human'});(cult as any).updateDoctrine(eater,.05);}
assert.equal(eater.meals,3);assert.equal(eater.maxHp,baseHp*1.25);assert.equal(cult.stats.corrupted.feasts,3);
cult.selected.add(eater.id);cult.activateAbility();cult.commandAt(700,700);assert.notEqual(eater.state,'move','frenzied troops ignore retreat orders');
const movement=sandbox(), walker=movement.spawnUnit('human','melee',500,500);
movement.selected.add(walker.id);movement.commandAt(570,500);movement.commandAt(650,500,true);
assert.equal(walker.orders.length,1);
for(let i=0;i<100;i++) (movement as any).updateUnit(walker,.05);
assert.equal(walker.orders.length,0);assert.ok(walker.x>630);
movement.holdSelected();const heldX=walker.x;movement.spawnUnit('corrupted','melee',walker.x+100,walker.y);
for(let i=0;i<100;i++) (movement as any).updateUnit(walker,.05);
assert.equal(walker.x,heldX,'hold position does not chase');
for(const seed of [1,42,93,2026]) {
  const map=generateMap(seed);
  for(const start of [map.playerStart,map.aiStart,map.thirdStart]) {
    const path=astar(map.blocked,start.x+3,start.y+7,36,36);
    assert.deepEqual(path.at(-1),{x:36,y:36},`central route is reachable for seed ${seed}`);
  }
}
for(const f of FACTIONS) assert.ok(Number.isFinite(ritual.stats[f].gold));
console.log('Ritual counterplay, abilities, poison, concealment, mutation, orders, hold position and map routes passed.');
