import { strict as assert } from 'node:assert';
import { GameEngine } from '../src/game/engine';
import { selectionCommands } from '../src/game/commands';
// Drag-selecting several workers must still offer Build and no soldier ability.
const crew=new GameEngine('human',42);
const peasants=crew.units.filter(u=>u.faction==='human'&&u.type==='worker');
assert.ok(peasants.length>=2);
crew.selected=new Set(peasants.map(u=>u.id));
let cmds=selectionCommands(crew.hud().selected,'human');
assert.ok(cmds.worker,'multi-worker selection offers worker commands (Build)');
assert.ok(!cmds.military,'multi-worker selection hides Shield wall and other soldier commands');
const soldier=crew.spawnUnit('human','melee',peasants[0].x+20,peasants[0].y);
crew.selected=new Set([soldier.id,crew.spawnUnit('human','melee',soldier.x+20,soldier.y).id]);
cmds=selectionCommands(crew.hud().selected,'human');
assert.ok(cmds.military&&!cmds.worker,'several soldiers get military commands');
crew.selected=new Set([peasants[0].id,soldier.id]);
cmds=selectionCommands(crew.hud().selected,'human');
assert.ok(cmds.military&&!cmds.worker,'workers mixed with soldiers get military commands');
// Production buildings cannot train until construction finishes.
const site=new GameEngine('human',42);
const hall=site.buildings.find(b=>b.faction==='human'&&b.type==='hall')!;
const barracks=(site as any).makeBuilding('human','barracks',hall.tileX+8,hall.tileY+6,false);
site.gold.human=5000;site.lumber.human=5000;
site.selected=new Set([barracks.id]);
cmds=selectionCommands(site.hud().selected,'human');
assert.ok(cmds.barracks&&cmds.constructing,'unfinished barracks is reported as constructing');
assert.equal(site.train('melee'),false,'training on an unfinished barracks is rejected');
assert.equal(barracks.queue.length,0);
assert.equal(site.gold.human,5000,'no gold is spent on a rejected order');
assert.equal((site as any).enqueue(barracks,'melee',false),false,'engine rejects queueing on unfinished buildings');
const other=(site as any).makeBuilding('human','barracks',hall.tileX-8,hall.tileY+6,true);
assert.equal(site.train('melee'),false,'a selected unfinished barracks does not hand its order to another barracks');
assert.equal(other.queue.length,0);
barracks.complete=true;barracks.progress=1;
assert.ok(!selectionCommands(site.hud().selected,'human').constructing);
assert.equal(site.train('melee'),true,'a finished barracks trains');
// Surrender shows the defeat screen instead of quitting silently.
const quitter=new GameEngine('darkelf',42);
quitter.surrender();
assert.equal(quitter.outcome,'defeat');
assert.match(quitter.hud().resultReason,/surrender/i);

// Workers can repair damaged completed buildings.
const repairGame=new GameEngine('human',42);
const rHall=repairGame.buildings.find(b=>b.faction==='human'&&b.type==='hall')!;
const rWorker=repairGame.units.find(u=>u.faction==='human'&&u.type==='worker')!;
rHall.hp=rHall.maxHp-120;
repairGame.selected=new Set([rWorker.id]);
repairGame.commandAt(rHall.x,rHall.y);
assert.equal(rWorker.state,'build');
assert.equal(rWorker.buildId,rHall.id);
for(let i=0;i<200;i++) repairGame.update(0.05,new Set(),{x:0,y:0},800,600);
assert.equal(rHall.hp,rHall.maxHp,'worker repairs damaged hall to full hp');

// Blacksmith & Mill upgrades research and apply bonuses, and gameSpeed scales simulation time.
const techGame=new GameEngine('human',42);
const tHall=techGame.buildings.find(b=>b.faction==='human'&&b.type==='hall')!;
(techGame as any).makeBuilding('human','blacksmith',tHall.tileX+6,tHall.tileY,true);
techGame.gold.human=1000;techGame.lumber.human=1000;
assert.equal(techGame.research('forgeWeapons'),true);
assert.ok(techGame.hud().researching?.id==='forgeWeapons');
techGame.gameSpeed=2;
const t0=techGame.time;
for(let i=0;i<300;i++) techGame.update(0.05,new Set(),{x:0,y:0},800,600);
assert.ok(Math.abs((techGame.time-t0)-30)<0.2,'2x gameSpeed advances simulation twice as fast');
assert.equal(techGame.upgrades.human.forgeWeapons,true,'forgeWeapons completes after research timer');

console.log('Selection commands, construction gating, repair, research, gameSpeed and surrender passed.');
