import { strict as assert } from 'node:assert';
import { GameEngine } from '../src/game/engine';
import { FACTIONS, DIFFICULTY, type Difficulty } from '../src/game/warfare';
for(const [index,faction] of FACTIONS.entries()) {
  const difficulty: Difficulty = index===0?'normal':index===1?'hard':'easy';
  const e=new GameEngine(faction,[42,93,2026][index],difficulty);
  let commander=0;
  for(let i=0;i<30000&&e.outcome==='playing';i++) {
    commander+=.05;
    if(commander>=DIFFICULTY[difficulty].interval) {(e as any).updateFactionAI(faction);commander=0;}
    e.update(.05,new Set(),{x:0,y:0},1280,720);
  }
  assert.notEqual(e.outcome,'playing',`${faction} simulation reaches a result within 25 minutes`);
  assert.ok(Object.values(e.empowered).some(Boolean),'at least one ritual completes');
  for(const f of FACTIONS) {
    assert.ok(e.stats[f].trained>5,`${f} sustains recruitment`);
    assert.ok(e.stats[f].gold>200&&e.stats[f].lumber>200,`${f} sustains both resources`);
  }
  assert.ok(Object.values(e.stats).some(s=>s.buildings>0),'armies destroy buildings');
  console.log(`${faction} / ${difficulty}: ${e.outcome} after ${Math.round(e.time)}s; awakened: ${FACTIONS.filter(f=>e.empowered[f]).join(', ')}.`);
}
