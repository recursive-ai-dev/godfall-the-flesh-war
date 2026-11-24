import { FACTIONS, RELIC, DOCTRINE, DIFFICULTY, detectable, newStats, type Ritual, type Corpse, type Difficulty } from './warfare';
import { audio } from "./audio";
import {
  BUILDING,
  GATHER_GOLD,
  GATHER_LUMBER,
  GOLD_TIME,
  LUMBER_TIME,
  START_GOLD,
  START_LUMBER,
  UNIT,
  UPGRADE,
  buildingName,
  unitName,
} from "./data";
import { generateMap } from "./map";
import { astar, nearestWalkable, perimeterTile } from "./pathfinding";
import {
  TEAM,
  MAP_H,
  MAP_W,
  TERRAIN,
  TILE,
  type Building,
  type BuildingClass,
  type Faction,
  type Floater,
  type GoldMine,
  type HudState,
  type Message,
  type Particle,
  type Projectile,
  type Tree,
  type Unit,
  type UnitClass,
  type UpgradeId,
} from "./types";
import type { Cam, RenderView } from "./renderer";

type Target = Unit | Building;

function hypot(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function edgeDistance(u: Unit, b: Building | GoldMine) {
  const hw = (b.tw * TILE) / 2;
  const hh = (b.th * TILE) / 2;
  const r = 6;
  const qx = Math.max(0, Math.abs(u.x - b.x) - (hw - r));
  const qy = Math.max(0, Math.abs(u.y - b.y) - (hh - r));
  return Math.max(0, Math.hypot(qx, qy) - r);
}

function idx(x: number, y: number) {
  return y * MAP_W + x;
}

export class GameEngine {
  player: Faction;
  enemies: Faction[];
  terrain: Uint8Array;
  blocked: Uint8Array;
  trees: Tree[];
  mines: GoldMine[];
  decorations: ReturnType<typeof generateMap>["decorations"];
  units: Unit[] = [];
  buildings: Building[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  pings: { x: number; y: number; color: string; t: number }[] = [];
  gameSpeed = 1;
  upgrades: Record<Faction, Record<UpgradeId, boolean>> = {
    human: { forgeWeapons: false, ironArmor: false, keenAxes: false },
    darkelf: { forgeWeapons: false, ironArmor: false, keenAxes: false },
    corrupted: { forgeWeapons: false, ironArmor: false, keenAxes: false },
  };
  researching: Record<Faction, { id: UpgradeId; t: number; max: number } | null> = {
    human: null,
    darkelf: null,
    corrupted: null,
  };
  vis: Uint8Array;
  explored: Uint8Array;
  gold: Record<Faction, number> = { human: START_GOLD, darkelf: START_GOLD, corrupted: START_GOLD };
  lumber: Record<Faction, number> = { human: START_LUMBER, darkelf: START_LUMBER, corrupted: START_LUMBER };
  cam: Cam = { x: 0, y: 0, zoom: 1 };
  selected = new Set<number>();
  buildMode: BuildingClass | null = null;
  attackMoveMode = false;
  ghost: { tx: number; ty: number; ok: boolean } | null = null;
  box: { x1: number; y1: number; x2: number; y2: number } | null = null;
  time = 0;
  nextId = 10000;
  messages: Message[] = [];
  outcome: "playing" | "victory" | "defeat" = "playing";
  mouseWorld = { x: 0, y: 0 };
  aiT = 0;
  aiLastAttack: Record<Faction, number> = {human: -40, darkelf: -40, corrupted: -40};
  viewW = 800;
  viewH = 600;
  private framed = "";
  groups: Record<number, number[]> = {};

  ritual: Ritual = { owner: null, contested: false, progress: {human: 0, darkelf: 0, corrupted: 0} };
  empowered: Record<Faction, boolean> = {human: false, darkelf: false, corrupted: false};
  corpses: Corpse[] = [];
  stats = newStats();
  resultReason = '';
  lastWarning = -10;
  lastRitualOwner: Faction | null = null;

  centerOnRelic() {
    this.cam.x = RELIC.x - this.viewW / this.cam.zoom / 2;
    this.cam.y = RELIC.y - this.viewH / this.cam.zoom / 2;
  }

  holdSelected() {
    const units = this.selectedUnits().filter(u => !(u.faction === 'corrupted' && u.abilityTime > 0));
    const hold = !units.every(u => u.hold);
    for (const u of units) { u.hold = hold; u.state = 'idle'; u.path = []; u.targetId = null; u.orders = []; u.destination = null; u.attackMove = false; u.buildId = null; u.gatherType = null; }
  }

  activateAbility(units = this.selectedUnits(), target = this.mouseWorld) {
    let used = 0;
    for (const u of units) {
      if (u.state === 'dead' || u.type === 'worker' || u.abilityCd > 0) continue;
      if (u.faction === 'darkelf') {
        let dx = target.x - u.x, dy = target.y - u.y;
        const d = Math.hypot(dx,dy);
        if (d < 1) continue;
        dx /= d; dy /= d;
        // Stop at the farthest walkable, scouted destination within the blink radius.
        let spot: {x:number;y:number} | null = null;
        for (let distance = Math.min(96,d); distance >= 24; distance -= 8) {
          const x=u.x+dx*distance,y=u.y+dy*distance, tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
          if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) continue;
          if(!this.blocked[idx(tx,ty)] && (u.faction !== this.player || this.explored[idx(tx,ty)])) {spot={x,y};break;}
        }
        if(!spot) continue;
        this.burst(u.x,u.y,'#bc8aff',10);
        u.x=spot.x;u.y=spot.y;u.path=[];u.state='idle';u.orders=[];u.destination=null;u.targetId=null;u.hold=false;
        u.revealed=2;
      } else {
        u.abilityTime=8;
        if(u.faction==='corrupted') {u.hold=false;u.orders=[];u.destination=null;}
      }
      u.abilityCd=DOCTRINE[u.faction].cooldown;
      this.burst(u.x,u.y,TEAM[u.faction].light,8);
      used++;
    }
    if(used && units[0]?.faction===this.player) {
      audio.ability(this.player);
      this.notify(`${DOCTRINE[this.player].ability}: ${used} soldiers.`);
    }
    return used;
  }

  private spawnFloater(x: number, y: number, text: string, color: string) {
    if (this.floaters.length > 48) this.floaters.shift();
    this.floaters.push({ x, y, vy: -22, text, color, life: 1.15 });
  }

  private addPing(x: number, y: number, color: string, duration = 2.6) {
    if (this.pings.length > 8) this.pings.shift();
    this.pings.push({ x, y, color, t: duration });
  }

  research(id: UpgradeId, f: Faction = this.player): boolean {
    if (this.outcome !== "playing" && f === this.player) return false;
    const up = UPGRADE[id];
    if (this.upgrades[f][id] || this.researching[f]) {
      if (f === this.player) audio.error();
      return false;
    }
    if (!this.hasBuilding(f, up.building)) {
      if (f === this.player) {
        this.notify(`Requires a completed ${buildingName(up.building, f)}.`);
        audio.error();
      }
      return false;
    }
    if (this.gold[f] < up.gold || this.lumber[f] < up.lumber) {
      if (f === this.player) {
        this.notify("Not enough gold or lumber.");
        audio.error();
      }
      return false;
    }
    this.gold[f] -= up.gold;
    this.lumber[f] -= up.lumber;
    this.researching[f] = { id, t: 0, max: up.time };
    if (f === this.player) audio.click();
    return true;
  }

  private updateRitual(dt: number) {
    const factions = FACTIONS.filter(f => this.buildings.some(b=>b.faction===f) && this.units.some(u=>u.faction===f && u.state!=='dead' && u.type!=='worker' && hypot(u.x,u.y,RELIC.x,RELIC.y)<RELIC.radius));
    this.ritual.contested=factions.length>1;
    this.ritual.owner=factions.length===1?factions[0]:null;
    if(this.ritual.owner) {
      const f=this.ritual.owner;
      this.ritual.progress[f]=Math.min(RELIC.goal,this.ritual.progress[f]+dt);
      if(this.lastRitualOwner!==f) this.notify(`${TEAM[f].name} controls the god's remains.`);
      if(this.ritual.progress[f]>=RELIC.goal && !this.empowered[f]) {
        this.empowered[f]=true;
        for(const u of this.units.filter(u=>u.faction===f&&u.state!=='dead')) {u.hp*=2;u.maxHp*=2;}
        for(const b of this.buildings.filter(b=>b.faction===f)) {b.hp*=2;b.maxHp*=2;}
        this.notify(`${TEAM[f].name} has awakened divine power! Complete your ritual to match them.`);
        this.spawnFloater(RELIC.x, RELIC.y - 24, "AWAKENED!", TEAM[f].light);
        this.addPing(RELIC.x, RELIC.y, TEAM[f].light, 3.5);
        audio.horn();
      }
    }
    this.lastRitualOwner=this.ritual.owner;
  }

  private updateDoctrine(u: Unit, dt: number) {
    u.repath=Math.max(0,u.repath-dt);
    u.abilityCd=Math.max(0,u.abilityCd-dt);u.abilityTime=Math.max(0,u.abilityTime-dt);
    u.revealed=Math.max(0,u.revealed-dt);u.flash=Math.max(0,u.flash-dt);
    if(u.poison>0) {u.poison=Math.max(0,u.poison-dt);this.hurt(u,3*dt,u.poisonSource);if(u.state==='dead') return;}
    if(u.faction==='corrupted' && u.type!=='worker') {
      const corpse=this.corpses.find(c=>c.life>0&&hypot(c.x,c.y,u.x,u.y)<40&&(u.hp<u.maxHp||u.meals<3));
      if(corpse) {
        corpse.life=0;u.meals++;u.hp=Math.min(u.maxHp,u.hp+30);this.stats[u.faction].feasts++;
        if(u.meals===3) {u.maxHp*=1.25;u.hp=Math.min(u.maxHp,u.hp+25);}
        this.burst(u.x,u.y,'#e55252',8);
        if(u.faction===this.player) this.spawnFloater(u.x, u.y - 16, u.meals === 3 ? "MUTATED!" : "+30 HP", u.meals === 3 ? "#ff5252" : "#ff9a8a");
      }
      if(u.abilityTime>0) {
        const target=this.findEnemyNear(u.x,u.y,220,u.faction);
        if(target && u.targetId!==target.id) this.assignAttack(u,target);
      }
    }
  }

  private officerNear(u: Unit) {
    return u.faction==='human' && this.units.some(v=>v.faction===u.faction&&v.type==='cavalry'&&v.state!=='dead'&&hypot(v.x,v.y,u.x,u.y)<100);
  }

  private damageMultiplier(u: Unit) {
    return (this.empowered[u.faction]?1.8:1)*(u.meals>=3?1.25:1)*(this.officerNear(u)?1.15:1)*(this.upgrades[u.faction].forgeWeapons?1.15:1);
  }

  private nextOrder(u: Unit) {
    const order=u.orders.shift();
    if(order) this.orderUnit(u,order.x,order.y,order.attack);
  }

  private orderUnit(u: Unit, x: number, y: number, attack: boolean) {
    u.hold=false;u.destination=null;u.attackMove=false;
    const enemy=this.pickEnemy(x,y,u.faction);
    if(enemy) {this.assignAttack(u,enemy);return;}
    if(u.type==='worker') {
      const mine=this.pickMine(x,y),tree=this.pickTree(x,y),site=this.pickFriendlySite(x,y,u.faction);
      if(mine) {this.assignGatherGold(u,mine);return;}
      if(tree) {this.assignGatherLumber(u,tree);return;}
      if(site) {this.assignBuild(u,site);return;}
    }
    this.formationMove([u],x,y,attack);
  }

  constructor(player: Faction, seed = (Math.random() * 1e9) | 0, public difficulty: Difficulty = "normal") {
    this.player = player;
    this.enemies = (["human", "darkelf", "corrupted"] as Faction[]).filter(f => f !== player);
    const map = generateMap(seed);
    this.terrain = map.terrain;
    this.blocked = map.blocked;
    this.trees = map.trees;
    this.mines = map.mines;
    this.decorations = map.decorations;
    this.vis = new Uint8Array(MAP_W * MAP_H);
    this.explored = new Uint8Array(MAP_W * MAP_H);

    this.seedBase(this.player, map.playerStart);
    this.seedBase(this.enemies[0], map.aiStart);
    this.seedBase(this.enemies[1], map.thirdStart);

    const hall = this.buildings.find((b) => b.faction === this.player && b.type === "hall");
    if (hall) {
      this.cam.x = hall.x - 480;
      this.cam.y = hall.y - 280;
    }
    this.revealAllAround(this.player, 14);
    this.markSight(RELIC.x, RELIC.y, 6, true);
    this.notify("A god lies dead. Two rival hosts seek its remains. Build your army.");
  }

  private seedBase(f: Faction, s: { x: number; y: number }) {
    const hall = this.makeBuilding(f, "hall", s.x, s.y, true);
    this.makeBuilding(f, "farm", s.x + 5, s.y, true);
    const ox = (s.x + 2) * TILE;
    const oy = (s.y + 5) * TILE;
    for (let i = 0; i < 4; i++) {
      this.spawnUnit(f, "worker", ox + (i % 2) * 22, oy + ((i / 2) | 0) * 20);
    }
    hall.rallyX = ox + 10;
    hall.rallyY = oy + 50;
  }

  private makeBuilding(
    f: Faction,
    type: BuildingClass,
    tx: number,
    ty: number,
    complete: boolean,
  ): Building {
    const st = BUILDING[type];
    const b: Building = {
      id: this.nextId++,
      kind: "building",
      faction: f,
      type,
      tileX: tx,
      tileY: ty,
      tw: st.tw,
      th: st.th,
      x: (tx + st.tw / 2) * TILE,
      y: (ty + st.th / 2) * TILE,
      hp: complete ? st.hp : 40,
      maxHp: st.hp,
      progress: complete ? 1 : 0,
      complete,
      queue: [],
      rallyX: (tx + st.tw / 2) * TILE,
      rallyY: (ty + st.th + 1.2) * TILE,
      attackCd: 0,
    };
    if(f === "human" && type === "tower") {b.hp*=1.3;b.maxHp*=1.3;}
    if(this.empowered[f]) {b.hp*=2;b.maxHp*=2;}
    this.buildings.push(b);
    this.setBlockedRect(tx, ty, st.tw, st.th, 1);
    return b;
  }

  private setBlockedRect(tx: number, ty: number, tw: number, th: number, v: number) {
    for (let y = ty; y < ty + th; y++) {
      for (let x = tx; x < tx + tw; x++) {
        if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) this.blocked[idx(x, y)] = v;
      }
    }
  }

  spawnUnit(f: Faction, type: UnitClass, x: number, y: number): Unit {
    const st = UNIT[type];
    const u: Unit = {
      id: this.nextId++,
      kind: "unit",
      faction: f,
      type,
      x,
      y,
      angle: 0,
      hp: st.hp * (f === "human" ? 1.2 : 1),
      maxHp: st.hp * (f === "human" ? 1.2 : 1),
      state: "idle",
      targetId: null,
      targetX: x,
      targetY: y,
      path: [],
      attackCd: 0,
      gatherType: null,
      carried: 0,
      nodeId: null,
      buildId: null,
      anim: Math.random() * 10,
      stuck: 0,
      lastX: x,
      lastY: y,
      attackMove: false,
      gatherTimer: 0,
      bob: 0,
      repath: 0, hold: false, orders: [], destination: null, abilityCd: 0, abilityTime: 0,
      revealed: 0, poison: 0, poisonSource: null, meals: 0, flash: 0,
    };
    if(this.empowered[f]) {u.hp*=2;u.maxHp*=2;}
    this.units.push(u);
    return u;
  }

  notify(text: string) {
    this.messages.unshift({ text, t: 4.2 });
    if (this.messages.length > 5) this.messages.pop();
  }

  foodUsed(f: Faction) {
    let n = 0;
    for (const u of this.units) {
      if (u.faction === f && u.state !== "dead") n += UNIT[u.type].food;
    }
    for (const b of this.buildings) {
      if (b.faction !== f) continue;
      for (const q of b.queue) n += UNIT[q.type].food;
    }
    return n;
  }

  foodMax(f: Faction) {
    let n = 0;
    for (const b of this.buildings) {
      if (b.faction === f && b.complete) n += BUILDING[b.type].food;
    }
    return n;
  }

  hasBuilding(f: Faction, type: BuildingClass) {
    return this.buildings.some((b) => b.faction === f && b.type === type && b.complete);
  }

  private revealAllAround(f: Faction, extra: number) {
    for (const b of this.buildings) {
      if (b.faction !== f) continue;
      this.markSight(b.x, b.y, BUILDING[b.type].los + extra, true);
    }
  }

  private markSight(cx: number, cy: number, tiles: number, exploreOnly = false) {
    const tx = (cx / TILE) | 0;
    const ty = (cy / TILE) | 0;
    const r = tiles | 0;
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (Math.hypot(x - tx, y - ty) > r + 0.35) continue;
        const i = idx(x, y);
        this.explored[i] = 1;
        if (!exploreOnly) this.vis[i] = 2;
      }
    }
  }

  private updateVision() {
    this.vis.fill(0);
    for (const u of this.units) {
      if (u.faction !== this.player || u.state === "dead") continue;
      this.markSight(u.x, u.y, UNIT[u.type].los);
    }
    for (const b of this.buildings) {
      if (b.faction !== this.player) continue;
      this.markSight(b.x, b.y, BUILDING[b.type].los);
    }
  }

  canPlace(type: BuildingClass, tx: number, ty: number, forPlayer: boolean) {
    const st = BUILDING[type];
    if(hypot((tx+st.tw/2)*TILE,(ty+st.th/2)*TILE,RELIC.x,RELIC.y) < RELIC.radius+80) return false;
    // Leave a walkable lane between structures so builders cannot seal one another in.
    if(this.buildings.some(b=>tx<b.tileX+b.tw+1&&tx+st.tw>b.tileX-1&&ty<b.tileY+b.th+1&&ty+st.th>b.tileY-1)) return false;
    if (tx < 1 || ty < 1 || tx + st.tw >= MAP_W - 1 || ty + st.th >= MAP_H - 1) return false;
    for (let y = ty; y < ty + st.th; y++) {
      for (let x = tx; x < tx + st.tw; x++) {
        const i = idx(x, y);
        const t = this.terrain[i];
        if (this.blocked[i]) return false;
        if (
          t === TERRAIN.WATER ||
          t === TERRAIN.FOREST ||
          t === TERRAIN.GOLD ||
          t === TERRAIN.ROCK
        )
          return false;
        if (forPlayer && !this.explored[i]) return false;
      }
    }
    return true;
  }

  updateGhost(wx: number, wy: number) {
    this.mouseWorld.x = wx;
    this.mouseWorld.y = wy;
    if (!this.buildMode) {
      this.ghost = null;
      return;
    }
    const st = BUILDING[this.buildMode];
    const tx = Math.round(wx / TILE - st.tw / 2);
    const ty = Math.round(wy / TILE - st.th / 2);
    this.ghost = { tx, ty, ok: this.canPlace(this.buildMode, tx, ty, true) };
  }

  tryPlaceBuilding(): boolean {
    if (!this.buildMode || !this.ghost) return false;
    const type = this.buildMode;
    const { tx, ty, ok } = this.ghost;
    if (!ok) {
      this.notify("Cannot build there.");
      audio.error();
      return false;
    }
    const st = BUILDING[type];
    if (this.gold[this.player] < st.gold || this.lumber[this.player] < st.lumber) {
      this.notify("Not enough resources.");
      audio.error();
      return false;
    }
    this.gold[this.player] -= st.gold;
    this.lumber[this.player] -= st.lumber;
    const b = this.makeBuilding(this.player, type, tx, ty, false);
    const workers = this.selectedUnits().filter((u) => u.type === "worker" && u.faction === this.player);
    const builders = workers.length ? workers : this.units.filter((u) => u.faction === this.player && u.type === "worker" && u.state !== "dead").slice(0, 2);
    for (const w of builders) this.assignBuild(w, b);
    this.buildMode = null;
    this.ghost = null;
    audio.click();
    this.notify(`Founding ${buildingName(type, this.player)}…`);
    return true;
  }

  private assignBuild(u: Unit, b: Building) {
    u.state = "build";
    u.buildId = b.id;
    u.targetId = null;
    u.attackMove = false;
    u.carried=0;u.gatherType = null;
    this.pathToPerimeter(u, b.tileX, b.tileY, b.tw, b.th);
  }

  train(type: UnitClass): boolean {
    const kind: BuildingClass = type === "worker" ? "hall" : "barracks";
    const chosen = this.selectedBuildings().filter((b) => b.faction === this.player && b.type === kind);
    if (chosen.length && !chosen.some((b) => b.complete)) {
      this.notify(`${buildingName(kind, this.player)} is still under construction.`);
      audio.error();
      return false;
    }
    const buildings = this.selectedBuildings().filter((b) => b.faction === this.player && b.complete);
    let hall: Building | undefined;
    let barracks: Building | undefined;
    for (const b of buildings) {
      if (b.type === "hall") hall = b;
      if (b.type === "barracks") barracks = b;
    }
    if (!hall && !barracks) {
      hall = this.buildings.find((b) => b.faction === this.player && b.type === "hall" && b.complete);
      barracks = this.buildings.find((b) => b.faction === this.player && b.type === "barracks" && b.complete);
    }
    const b = type === "worker" ? hall : barracks;
    if (!b) {
      this.notify(type === "worker" ? "Select a Town Hall." : "Select a Barracks.");
      audio.error();
      return false;
    }
    return this.enqueue(b, type, true);
  }

  private enqueue(b: Building, type: UnitClass, talk: boolean) {
    if (!b.complete) {
      if (talk) this.notify(`${buildingName(b.type, b.faction)} is still under construction.`);
      return false;
    }
    if (b.queue.length >= 5) {
      if (talk) this.notify("Training queue is full.");
      return false;
    }
    if (type === "cavalry" && !this.hasBuilding(b.faction, "stables")) {
      if (talk) this.notify("Requires Stables.");
      audio.error();
      return false;
    }
    if (type === "siege" && !this.hasBuilding(b.faction, "blacksmith")) {
      if (talk) this.notify("Requires a Blacksmith.");
      audio.error();
      return false;
    }
    const st = UNIT[type];
    if (this.foodUsed(b.faction) + st.food > this.foodMax(b.faction)) {
      if (talk) this.notify("Build more farms — not enough food.");
      audio.error();
      return false;
    }
    if (this.gold[b.faction] < st.gold || this.lumber[b.faction] < st.lumber) {
      if (talk) this.notify("Not enough resources.");
      audio.error();
      return false;
    }
    this.gold[b.faction] -= st.gold;
    this.lumber[b.faction] -= st.lumber;
    b.queue.push({ type, t: 0, max: st.time });
    if (talk) {
      audio.train();
      this.notify(`Training ${unitName(type, b.faction)}`);
    }
    return true;
  }

  cancelQueue(index: number) {
    const b = this.selectedBuildings()[0];
    if (!b || !b.queue[index]) return;
    const q = b.queue.splice(index, 1)[0];
    const st = UNIT[q.type];
    this.gold[b.faction] += (st.gold * 0.75) | 0;
    this.lumber[b.faction] += (st.lumber * 0.75) | 0;
  }

  stopSelected() {
    for (const u of this.selectedUnits()) {
      if(u.faction === "corrupted" && u.abilityTime > 0) continue;
      u.hold = false; u.orders = []; u.destination = null; u.gatherType = null;
      u.state = "idle";
      u.path = [];
      u.targetId = null;
      u.attackMove = false;
      u.buildId = null;
    }
  }

  selectedUnits() {
    return this.units.filter(
      (u) => this.selected.has(u.id) && u.state !== "dead" && u.faction === this.player,
    );
  }
  selectedBuildings() {
    return this.buildings.filter((b) => this.selected.has(b.id) && b.faction === this.player);
  }

  selectAt(wx: number, wy: number, additive: boolean) {
    if (!additive) this.selected.clear();
    let best: { id: number; d: number } | null = null;
    for (const u of this.units) {
      if (u.state === "dead") continue;
      if (u.faction !== this.player) continue;
      const d = hypot(u.x, u.y, wx, wy);
      if (d < 16 && (!best || d < best.d)) best = { id: u.id, d };
    }
    if (!best) {
      for (const b of this.buildings) {
        if (b.faction !== this.player) continue;
        if (this.hitBuilding(b, wx, wy)) {
          this.selected.add(b.id);
          audio.select();
          return;
        }
      }
    }
    if (best) {
      this.selected.add(best.id);
      audio.select();
      return;
    }
    for (const u of this.units) {
      if (u.state === "dead" || u.faction === this.player || !detectable(u,this.player,this.units,this.terrain)) continue;
      const tx = Math.max(0, Math.min(MAP_W - 1, (u.x / TILE) | 0));
      const ty = Math.max(0, Math.min(MAP_H - 1, (u.y / TILE) | 0));
      if (this.vis[ty * MAP_W + tx] !== 2) continue;
      if (hypot(u.x, u.y, wx, wy) < 16) {
        this.selected.add(u.id);
        return;
      }
    }
    for (const b of this.buildings) {
      if (b.faction === this.player) continue;
      const i = b.tileY * MAP_W + b.tileX;
      if (!this.explored[i]) continue;
      if (this.hitBuilding(b, wx, wy)) {
        this.selected.add(b.id);
        return;
      }
    }
  }

  selectBox(x1: number, y1: number, x2: number, y2: number, additive: boolean) {
    const minx = Math.min(x1, x2);
    const maxx = Math.max(x1, x2);
    const miny = Math.min(y1, y2);
    const maxy = Math.max(y1, y2);
    if (!additive) this.selected.clear();
    let n = 0;
    for (const u of this.units) {
      if (u.faction !== this.player || u.state === "dead") continue;
      if (u.x >= minx && u.x <= maxx && u.y >= miny && u.y <= maxy) {
        this.selected.add(u.id);
        n++;
      }
    }
    if (n === 0) {
      for (const b of this.buildings) {
        if (b.faction !== this.player) continue;
        if (b.x >= minx && b.x <= maxx && b.y >= miny && b.y <= maxy) this.selected.add(b.id);
      }
    } else audio.select();
  }

  doubleSelect(wx: number, wy: number) {
    let type: UnitClass | null = null;
    for (const u of this.units) {
      if (u.faction !== this.player || u.state === "dead") continue;
      if (hypot(u.x, u.y, wx, wy) < 16) {
        type = u.type;
        break;
      }
    }
    if (!type) return;
    this.selected.clear();
    const z = this.cam.zoom;
    const minx = this.cam.x;
    const miny = this.cam.y;
    const maxx = this.cam.x + this.viewW / z;
    const maxy = this.cam.y + this.viewH / z;
    for (const u of this.units) {
      if (u.faction !== this.player || u.state === "dead" || u.type !== type) continue;
      if (u.x >= minx && u.x <= maxx && u.y >= miny && u.y <= maxy) this.selected.add(u.id);
    }
  }

  private hitBuilding(b: Building, wx: number, wy: number) {
    const rx = (b.tw * TILE) / 2;
    const ry = (b.th * TILE) / 2;
    const dx = Math.abs(wx - b.x) / rx;
    const dy = Math.abs(wy - b.y) / ry;
    return dx <= 1 && dy <= 1 && Math.pow(dx, 2.6) + Math.pow(dy, 2.6) <= 1.05;
  }

  commandAt(wx: number, wy: number, queued = false, attack = this.attackMoveMode) {
    if(this.outcome !== 'playing') return;
    const buildings=this.selectedBuildings(), units=this.selectedUnits();
    if(!units.length) {for(const b of buildings) {b.rallyX=wx;b.rallyY=wy;}return;}
    const cols=Math.ceil(Math.sqrt(units.length));
    const targeted=!!(this.pickEnemy(wx,wy,this.player)||this.pickMine(wx,wy)||this.pickTree(wx,wy)||this.pickFriendlySite(wx,wy,this.player));
    units.forEach((u,i)=> {
      if(u.faction==='corrupted'&&u.abilityTime>0) return;
      const x=wx+(targeted?0:((i%cols)-(cols-1)/2)*22), y=wy+(targeted?0:(Math.floor(i/cols)-(cols-1)/2)*22);
      if(queued && u.state!=='idle') {if(u.orders.length<12) u.orders.push({x,y,attack});}
      else {u.orders=[];this.orderUnit(u,x,y,attack);}
    });
    this.attackMoveMode=false;
    audio.click();
  }

  private pickEnemy(wx: number, wy: number, f: Faction): Target | null {
    let best: Target | null = null;
    let bd = 22;
    for (const u of this.units) {
      if (u.faction === f || u.state === "dead" || !detectable(u,f,this.units,this.terrain)) continue;
      if(f===this.player && this.vis[idx(Math.max(0,Math.min(MAP_W-1,Math.floor(u.x/TILE))),Math.max(0,Math.min(MAP_H-1,Math.floor(u.y/TILE))))]!==2) continue;
      const d = hypot(u.x, u.y, wx, wy);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    for (const b of this.buildings) {
      if (b.faction === f || (f===this.player&&!this.explored[idx(b.tileX,b.tileY)])) continue;
      if (this.hitBuilding(b, wx, wy)) return b;
    }
    return best;
  }

  private pickMine(wx: number, wy: number) {
    for (const m of this.mines) {
      if (m.gold <= 0) continue;
      if (
        wx >= m.tileX * TILE &&
        wx <= (m.tileX + m.tw) * TILE &&
        wy >= m.tileY * TILE &&
        wy <= (m.tileY + m.th) * TILE
      )
        return m;
      if (hypot(m.x, m.y, wx, wy) < 48) return m;
    }
    return null;
  }

  private pickTree(wx: number, wy: number) {
    let best: Tree | null = null;
    let bd = 22;
    for (const t of this.trees) {
      if (t.lumber <= 0) continue;
      const d = hypot(t.x, t.y, wx, wy);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  private pickFriendlySite(wx: number, wy: number, f: Faction) {
    for (const b of this.buildings) {
      if (b.faction !== f || (b.complete && b.hp >= b.maxHp)) continue;
      if (this.hitBuilding(b, wx, wy)) return b;
    }
    return null;
  }

  private assignAttack(u: Unit, t: Target) {
    u.state = "attack";
    u.targetId = t.id;
    u.attackMove = false;
    u.buildId = null;
    this.pathTo(u, t.x, t.y);
  }

  private assignGatherGold(u: Unit, m: GoldMine) {
    u.state = "gather";
    u.gatherType = "gold";
    u.nodeId = m.id;
    u.buildId = null;
    u.targetId = null;
    this.pathToPerimeter(u, m.tileX, m.tileY, m.tw, m.th);
  }

  private assignGatherLumber(u: Unit, t: Tree) {
    u.state = "gather";
    u.gatherType = "lumber";
    u.nodeId = t.id;
    u.buildId = null;
    u.targetId = null;
    this.pathToPerimeter(u,t.tileX,t.tileY,1,1);
  }

  formationMove(units: Unit[], wx: number, wy: number, attackMove: boolean) {
    const n = units.length;
    const cols = Math.ceil(Math.sqrt(n));
    units.forEach((u, i) => {
      u.hold = false;
      const ox = ((i % cols) - (cols - 1) / 2) * 20;
      const oy = ((Math.floor(i / cols) - (cols - 1) / 2) * 18);
      u.state = "move";
      u.attackMove = attackMove;
      u.targetId = null;
      u.buildId = null;
      u.targetX = wx + ox;
      u.targetY = wy + oy;
      this.pathTo(u, u.targetX, u.targetY);
      u.destination = attackMove ? {x:u.targetX,y:u.targetY} : null;
    });
  }

  private pathTo(u: Unit, wx: number, wy: number) {
    u.repath=.65;
    const sx = Math.max(0, Math.min(MAP_W - 1, (u.x / TILE) | 0));
    const sy = Math.max(0, Math.min(MAP_H - 1, (u.y / TILE) | 0));
    let gx = Math.max(0, Math.min(MAP_W - 1, (wx / TILE) | 0));
    let gy = Math.max(0, Math.min(MAP_H - 1, (wy / TILE) | 0));
    const g = nearestWalkable(this.blocked, gx, gy, u.x / TILE, u.y / TILE);
    gx = g.x;
    gy = g.y;
    u.path = astar(this.blocked, sx, sy, gx, gy);
    const end = u.path[u.path.length-1] || {x:sx,y:sy};
    u.targetX = (end.x+.5)*TILE;
    u.targetY = (end.y+.5)*TILE;
    u.stuck = 0;
  }

  private pathToPerimeter(u: Unit, tx: number, ty: number, tw: number, th: number) {
    const candidates: {x:number;y:number}[]=[];
    for(let y=ty-1;y<=ty+th;y++) for(let x=tx-1;x<=tx+tw;x++) {
      if(x<0||y<0||x>=MAP_W||y>=MAP_H||this.blocked[idx(x,y)]) continue;
      if(x===tx-1||x===tx+tw||y===ty-1||y===ty+th) candidates.push({x,y});
    }
    candidates.sort((a,b)=>hypot((a.x+.5)*TILE,(a.y+.5)*TILE,u.x,u.y)-hypot((b.x+.5)*TILE,(b.y+.5)*TILE,u.x,u.y));
    const sx=Math.floor(u.x/TILE),sy=Math.floor(u.y/TILE);
    u.repath=.8;
    for(const p of candidates) {
      const path=astar(this.blocked,sx,sy,p.x,p.y),last=path[path.length-1];
      if((sx!==p.x||sy!==p.y)&&(!last||last.x!==p.x||last.y!==p.y)) continue;
      u.path=path;
      // Approach the facade, rather than stopping in the middle of the adjacent tile.
      const cx=(tx+tw/2)*TILE,cy=(ty+th/2)*TILE;
      const px=(p.x+.5)*TILE,py=(p.y+.5)*TILE;
      u.targetX=px<tx*TILE?tx*TILE-7:px>(tx+tw)*TILE?(tx+tw)*TILE+7:Math.max(tx*TILE+7,Math.min((tx+tw)*TILE-7,px));
      u.targetY=py<ty*TILE?ty*TILE-7:py>(ty+th)*TILE?(ty+th)*TILE+7:Math.max(ty*TILE+7,Math.min((ty+th)*TILE-7,py));
      u.angle=Math.atan2(cy-u.y,cx-u.x);return;
    }
    u.path=[];u.targetX=u.x;u.targetY=u.y;
  }

  pan(dt: number, keys: Set<string>, edge: { x: number; y: number }) {
    const sp = (520 / this.cam.zoom) * dt;
    if (keys.has("w") || keys.has("arrowup")) this.cam.y -= sp;
    if (keys.has("s") || keys.has("arrowdown")) this.cam.y += sp;
    if (keys.has("a") || keys.has("arrowleft")) this.cam.x -= sp;
    if (keys.has("d") || keys.has("arrowright")) this.cam.x += sp;
    this.cam.x += edge.x * sp * 1.15;
    this.cam.y += edge.y * sp * 1.15;
    const worldW = MAP_W * TILE;
    const worldH = MAP_H * TILE;
    const vw = this.viewW / this.cam.zoom;
    const vh = this.viewH / this.cam.zoom;
    this.cam.x = Math.max(0, Math.min(worldW - vw, this.cam.x));
    this.cam.y = Math.max(0, Math.min(worldH - vh, this.cam.y));
  }

  surrender() {
    if (this.outcome !== "playing") return;
    this.resultReason = "You surrendered. The Flesh War belongs to another host.";
    this.outcome = "defeat";
    audio.defeat();
  }

  centerOnHall() {
    const h = this.buildings.find((b) => b.faction === this.player && b.type === "hall");
    if (!h) return;
    this.cam.x = h.x - this.viewW / this.cam.zoom / 2;
    this.cam.y = h.y - this.viewH / this.cam.zoom / 2;
  }

  cycleIdleWorker() {
    const idle = this.units.filter(
      (u) => u.faction === this.player && u.type === "worker" && u.state === "idle",
    );
    if (!idle.length) {
      this.notify("No idle workers.");
      return;
    }
    const cur = [...this.selected][0];
    let i = idle.findIndex((u) => u.id === cur);
    i = (i + 1) % idle.length;
    this.selected = new Set([idle[i].id]);
    this.cam.x = idle[i].x - this.viewW / this.cam.zoom / 2;
    this.cam.y = idle[i].y - this.viewH / this.cam.zoom / 2;
  }

  selectPlayerHall() {
    const h = this.buildings.find((b) => b.faction === this.player && b.type === "hall");
    if (!h) return;
    this.selected = new Set([h.id]);
    this.centerOnHall();
  }

  zoomAt(sx: number, sy: number, delta: number) {
    const before = worldFromLocal(this.cam, sx, sy);
    this.cam.zoom = Math.max(0.55, Math.min(1.85, this.cam.zoom * Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.0003)));
    const after = worldFromLocal(this.cam, sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
  }

  minimapClick(nx: number, ny: number, right: boolean) {
    const wx = nx * MAP_W * TILE;
    const wy = ny * MAP_H * TILE;
    if (right) {
      this.commandAt(wx, wy);
      return;
    }
    this.cam.x = wx - this.viewW / this.cam.zoom / 2;
    this.cam.y = wy - this.viewH / this.cam.zoom / 2;
  }

  assignGroup(n: number) {
    this.groups[n] = [...this.selected];
  }
  recallGroup(n: number) {
    const g = this.groups[n];
    if (!g) return;
    this.selected = new Set(g.filter((id) => this.units.some((u) => u.id === id && u.state !== "dead") || this.buildings.some((b) => b.id === id)));
  }

  update(dt: number, keys: Set<string>, edge: { x: number; y: number }, vw: number, vh: number) {
    if (this.outcome !== "playing") return;
    const rawDt = Math.min(dt, 0.05);
    this.viewW = vw;
    this.viewH = vh;
    // Frame the player's hall at the real viewport size (phones included). The HUD
    // mounts after the first frame and shrinks the playfield, so reframe on early resizes.
    if (this.time < 1 && this.framed !== `${vw}x${vh}`) {
      this.framed = `${vw}x${vh}`;
      this.centerOnHall();
    }
    this.pan(rawDt, keys, edge);

    dt = rawDt * this.gameSpeed;
    this.time += dt;

    for (const m of this.messages) m.t -= rawDt;
    this.messages = this.messages.filter((m) => m.t > 0);
    for (const p of this.pings) p.t -= rawDt;
    this.pings = this.pings.filter((p) => p.t > 0);
    for (const f of this.floaters) { f.y += f.vy * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    for (const f of FACTIONS) {
      const res = this.researching[f];
      if (!res) continue;
      if (!this.hasBuilding(f, UPGRADE[res.id].building)) { this.researching[f] = null; continue; }
      res.t += dt;
      if (res.t >= res.max) {
        this.upgrades[f][res.id] = true;
        this.researching[f] = null;
        if (f === this.player) {
          audio.complete();
          this.notify(`${UPGRADE[res.id].name} complete (${UPGRADE[res.id].desc}).`);
        }
      }
    }

    this.updateVision();

    for (const u of this.units) this.updateUnit(u, dt);
    this.separate();
    for (const b of this.buildings) this.updateBuilding(b, dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);

    this.units = this.units.filter((u) => !(u.state === "dead" && u.anim > 0.95));

    this.corpses.forEach(c=>c.life-=dt);
    this.corpses=this.corpses.filter(c=>c.life>0);
    this.updateRitual(dt);
    this.updateAI(dt);
    this.checkOutcome();
  }

  private updateUnit(u: Unit, dt: number) {
    if (u.state === "dead") {
      u.anim += dt;
      return;
    }
    this.updateDoctrine(u,dt);
    if(u.hp <= 0) return;
    if(u.state === "idle" && u.orders.length) this.nextOrder(u);
    u.anim += dt;
    u.attackCd = Math.max(0, u.attackCd - dt);

    if ((u.state === "idle" || (u.state === "move" && u.attackMove)) && u.type !== "worker") {
      const aggro = u.hold ? UNIT[u.type].range+8 : u.type === "siege" ? 190 : u.type === "ranged" ? 160 : 115;
      const e = this.findEnemyInRange(u, aggro);
      if (e) {
        u.state = "attack";
        u.targetId = e.id;
      }
    }

    switch (u.state) {
      case "idle":
        if (u.carried > 0 && u.gatherType) u.state = "return";
        break;
      case "move":
        this.followPath(u, dt);
        if (!u.path.length && hypot(u.x, u.y, u.targetX, u.targetY) < 10) {
          u.state = "idle";
          u.attackMove = false;
          u.destination = null;
        }
        break;
      case "attack":
        this.doAttack(u, dt);
        break;
      case "gather":
        this.doGather(u, dt);
        break;
      case "return":
        this.doReturn(u, dt);
        break;
      case "build":
        this.doBuild(u, dt);
        break;
    }
  }

  private followPath(u: Unit, dt: number) {
    const speed = UNIT[u.type].speed * (u.faction === "darkelf" ? 1.15 : 1) * (this.empowered[u.faction]?1.2:1) * (u.abilityTime>0 ? u.faction==="human"?.5:u.faction==="corrupted"?1.35:1 : 1);
    let tx: number, ty: number;
    if (u.path.length) {
      tx = (u.path[0].x + 0.5) * TILE;
      ty = (u.path[0].y + 0.5) * TILE;
    } else {
      tx = u.targetX;
      ty = u.targetY;
    }
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d < (u.path.length ? 5 : 2)) {
      if (u.path.length) u.path.shift();
      return;
    }
    const step = Math.min(d, speed * dt);
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
    u.angle = Math.atan2(dy, dx);

    const moved = hypot(u.x, u.y, u.lastX, u.lastY);
    if (moved < step * 0.12) {
      u.stuck += dt;
      if (u.stuck > 0.65) {
        u.stuck = 0;
        this.pathTo(u, u.targetX, u.targetY);
      }
    } else u.stuck = 0;
    u.lastX = u.x;
    u.lastY = u.y;
  }

  private doAttack(u: Unit, dt: number) {
    const t = this.getTarget(u.targetId);
    if (!t || (t.kind === "unit" && !detectable(t,u.faction,this.units,this.terrain))) {
      if(u.destination) {const d=u.destination;this.formationMove([u],d.x,d.y,true);return;}
      u.targetId = null;
      u.state = u.attackMove ? "move" : "idle";
      return;
    }
    const range = UNIT[u.type].range;
    const d = t.kind === "building" ? edgeDistance(u, t) : hypot(u.x, u.y, t.x, t.y) - UNIT[t.type].radius * 0.4;
    if (d > (t.kind === "building" ? Math.max(16, range) : range)) {
      if(u.hold) {u.targetId=null;u.state="idle";return;}
      if ((!u.path.length || u.stuck > 0.2) && u.repath<=0) {
        if (t.kind === "building") this.pathToPerimeter(u, t.tileX, t.tileY, t.tw, t.th);
        else this.pathTo(u, t.x, t.y);
      }
      this.followPath(u, dt);
      return;
    }
    u.path = [];
    u.angle = Math.atan2(t.y - u.y, t.x - u.x);
    if (u.attackCd <= 0) {
      u.attackCd = UNIT[u.type].attackCd * (u.faction === "corrupted" ? 0.75 : 1) * (u.faction === "corrupted" && u.abilityTime > 0 ? .55 : 1);
      u.revealed=4;u.flash=.18;
      if (u.type === "ranged" || u.type === "siege") {
        this.spawnProjectile(u, t);
        audio.bow();
      } else {
        const dmg = t.kind === "building" ? UNIT[u.type].buildingDmg : UNIT[u.type].dmg;
        this.hurt(t, dmg * this.damageMultiplier(u), u.faction);
        audio.attack();
        this.burst(t.x, t.y, t.kind === "building" ? "#c9a84c" : "#a03030", 5);
      }
    }
  }

  private spawnProjectile(u: Unit, t: Target) {
    const a = Math.atan2(t.y - u.y, t.x - u.x);
    const siege = u.type === "siege";
    const spd = siege ? 220 : 420;
    this.projectiles.push({
      x: u.x,
      y: u.y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      z: siege ? 24 : 8,
      vz: siege ? (140 * Math.pow(hypot(u.x,u.y,t.x,t.y)/spd,2)-24) / Math.max(.1,hypot(u.x,u.y,t.x,t.y)/spd) : 10,
      dmg: (t.kind === "building" ? UNIT[u.type].buildingDmg : UNIT[u.type].dmg) * this.damageMultiplier(u),
      poison: u.faction === "darkelf" && u.type === "ranged",
      aoe: UNIT[u.type].aoe,
      faction: u.faction,
      type: siege ? "boulder" : "arrow",
      life: 1.6,
      targetId: t.id,
    });
  }

  private doGather(u: Unit, dt: number) {
    if (u.gatherType === "gold") {
      const mine = this.mines.find((m) => m.id === u.nodeId);
      if (!mine || mine.gold <= 0) {
        if(u.orders.length) {u.state="idle";u.gatherType=null;return;}
        const alt = this.nearestMine(u.x, u.y);
        if (alt) this.assignGatherGold(u, alt);
        else {
          u.state = "idle";
          if (u.faction === this.player) this.notify("Gold mine depleted.");
        }
        return;
      }
      if (edgeDistance(u, mine) > 16) {
        if (!u.path.length && u.repath<=0 && hypot(u.x,u.y,u.targetX,u.targetY)<3) this.pathToPerimeter(u, mine.tileX, mine.tileY, mine.tw, mine.th);
        this.followPath(u, dt);
        return;
      }
      u.path = [];
      u.gatherTimer += dt * (this.upgrades[u.faction].keenAxes ? 1.25 : 1);
      if (u.gatherTimer >= GOLD_TIME) {
        u.gatherTimer = 0;
        const amt = Math.min(GATHER_GOLD, mine.gold);
        mine.gold -= amt;
        u.carried = amt;
        u.state = "return";
      }
    } else {
      let tree: Tree | null = this.trees.find((t) => t.id === u.nodeId) ?? null;
      if (!tree || tree.lumber <= 0) {
        if(u.orders.length) {u.state="idle";u.gatherType=null;return;}
        tree = this.nearestTree(u.x, u.y);
        if (!tree) {
          u.state = "idle";
          return;
        }
        u.nodeId = tree.id;
      }
      if (Math.hypot(Math.max(0,Math.abs(u.x-(tree.tileX+.5)*TILE)-16),Math.max(0,Math.abs(u.y-(tree.tileY+.5)*TILE)-16)) > 20) {
        if (!u.path.length && u.repath<=0 && hypot(u.x,u.y,u.targetX,u.targetY)<3) this.pathToPerimeter(u,tree.tileX,tree.tileY,1,1);
        this.followPath(u, dt);
        return;
      }
      u.path = [];
      u.angle = Math.atan2(tree.y - u.y, tree.x - u.x);
      u.gatherTimer += dt * (this.upgrades[u.faction].keenAxes ? 1.25 : 1);
      if (u.gatherTimer >= LUMBER_TIME) {
        u.gatherTimer = 0;
        const amt = Math.min(GATHER_LUMBER, tree.lumber);
        tree.lumber -= amt;
        u.carried = amt;
        if (tree.lumber <= 0) this.removeTree(tree);
        u.state = "return";
      }
    }
  }

  private doReturn(u: Unit, dt: number) {
    const drop = this.nearestDrop(u);
    if (!drop) {
      u.state = "idle";
      return;
    }
    if (edgeDistance(u, drop) > 16) {
      if (!u.path.length && u.repath<=0 && hypot(u.x,u.y,u.targetX,u.targetY)<3) this.pathToPerimeter(u, drop.tileX, drop.tileY, drop.tw, drop.th);
      this.followPath(u, dt);
      return;
    }
    if (u.gatherType === "gold") {
      this.gold[u.faction] += u.carried;
      this.stats[u.faction].gold += u.carried;
      if (u.faction === this.player) this.spawnFloater(u.x, u.y - 16, `+${u.carried}g`, "#f0cf5a");
    } else {
      this.lumber[u.faction] += u.carried;
      this.stats[u.faction].lumber += u.carried;
      if (u.faction === this.player) this.spawnFloater(u.x, u.y - 16, `+${u.carried}w`, "#c89a64");
    }
    u.carried = 0;
    if (u.faction === this.player) audio.gather();
    const exhausted = u.gatherType==='gold' ? !this.mines.some(m=>m.id===u.nodeId&&m.gold>0) : !this.trees.some(t=>t.id===u.nodeId&&t.lumber>0);
    if(exhausted && u.orders.length) {u.state='idle';u.gatherType=null;return;}
    if (u.gatherType === "gold") {
      const mine = this.mines.find((m) => m.id === u.nodeId && m.gold > 0) || this.nearestMine(u.x, u.y);
      if (mine) this.assignGatherGold(u, mine);
      else u.state = "idle";
    } else {
      const tree = this.trees.find((t) => t.id === u.nodeId && t.lumber > 0) || this.nearestTree(u.x, u.y);
      if (tree) this.assignGatherLumber(u, tree);
      else u.state = "idle";
    }
  }

  private doBuild(u: Unit, dt: number) {
    const b = this.buildings.find((x) => x.id === u.buildId);
    if (!b || (b.complete && b.hp >= b.maxHp)) {
      u.state = "idle";
      u.buildId = null;
      return;
    }
    if (edgeDistance(u, b) > 16) {
      if (!u.path.length && u.repath<=0 && hypot(u.x,u.y,u.targetX,u.targetY)<3) this.pathToPerimeter(u, b.tileX, b.tileY, b.tw, b.th);
      this.followPath(u, dt);
      return;
    }
    u.path = [];
    if (b.complete) {
      b.hp = Math.min(b.maxHp, b.hp + 24 * dt);
      if (b.hp >= b.maxHp) {
        b.hp = b.maxHp;
        u.state = "idle";
        u.buildId = null;
        if (b.faction === this.player) this.spawnFloater(b.x, b.y - 18, "REPAIRED", "#8fd16a");
      }
      return;
    }
    const st = BUILDING[b.type];
    b.progress += dt / st.time;
    b.hp = Math.min(b.maxHp, 40 + (b.maxHp - 40) * b.progress);
    if (b.progress >= 1) {
      b.progress = 1;
      b.complete = true;
      b.hp = b.maxHp;
      u.state = "idle";
      u.buildId = null;
      if (b.faction === this.player) {
        audio.complete();
        this.notify(`${buildingName(b.type, b.faction)} complete.`);
      }
    }
  }

  private nearestDrop(u: Unit): Building | null {
    const want: BuildingClass[] =
      u.gatherType === "lumber" ? ["mill", "hall"] : ["hall"];
    let best: Building | null = null;
    let bd = 1e9;
    for (const b of this.buildings) {
      if (b.faction !== u.faction || !b.complete) continue;
      if (!want.includes(b.type)) continue;
      const d = hypot(u.x, u.y, b.x, b.y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private nearestMine(x: number, y: number) {
    let best: GoldMine | null = null;
    let bd = 1e9;
    for (const m of this.mines) {
      if (m.gold <= 0) continue;
      const d = hypot(x, y, m.x, m.y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  private nearestTree(x: number, y: number) {
    let best: Tree | null = null;
    let bd = Infinity;
    for (const t of this.trees) {
      if (t.lumber <= 0) continue;
      const d = hypot(x, y, t.x, t.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  private removeTree(t: Tree) {
    this.trees = this.trees.filter((x) => x.id !== t.id);
    this.blocked[idx(t.tileX, t.tileY)] = 0;
    if (this.terrain[idx(t.tileX, t.tileY)] === TERRAIN.FOREST)
      this.terrain[idx(t.tileX, t.tileY)] = TERRAIN.GRASS;
    this.decorations.push({ x: t.x, y: t.y, type: "stump", v: 0.4 });
  }

  private updateBuilding(b: Building, dt: number) {
    b.attackCd = Math.max(0, b.attackCd - dt);
    if (b.complete && b.queue.length) {
      const q = b.queue[0];
      q.t += dt;
      if (q.t >= q.max) {
        b.queue.shift();
        this.stats[b.faction].trained++;
        const p = perimeterTile(this.blocked, b.tileX, b.tileY, b.tw, b.th, b.rallyX / TILE, b.rallyY / TILE);
        const u = this.spawnUnit(b.faction, q.type, (p.x + 0.5) * TILE, (p.y + 0.5) * TILE);
        u.state = "move";
        u.targetX = b.rallyX;
        u.targetY = b.rallyY;
        this.pathTo(u, b.rallyX, b.rallyY);
        if (b.faction === this.player) audio.train();
      }
    }
    if (b.type === "tower" && b.complete) {
      const range = BUILDING.tower.range;
      const e = this.findEnemyNear(b.x, b.y, range, b.faction);
      if (e && b.attackCd <= 0) {
        b.attackCd = BUILDING.tower.attackCd;
        const a = Math.atan2(e.y - b.y, e.x - b.x);
        this.projectiles.push({
          x: b.x,
          y: b.y - 20,
          vx: Math.cos(a) * 380,
          vy: Math.sin(a) * 380,
          z: 18,
          vz: 20,
          dmg: BUILDING.tower.dmg * (this.empowered[b.faction]?1.8:1),
          aoe: 0,
          faction: b.faction,
          type: "arrow",
          life: 1.2,
          targetId: e.id,
        });
      }
    }
  }

  private updateProjectiles(dt: number) {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      p.life -= dt;
      const t = this.getTarget(p.targetId);
      if (t && p.type === "arrow") {
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        const spd = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(a) * spd;
        p.vy = Math.sin(a) * spd;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if(p.type === "boulder") p.vz -= 280 * dt;
      else {p.z=8;p.vz=0;}
      let hit = false;
      if (p.type === "boulder" && p.z <= 0) {
        hit = true;
        this.burst(p.x, p.y, "#8a7a60", 12);
        for (const u of this.units) {
          if (u.faction === p.faction || u.state === "dead") continue;
          if (hypot(u.x, u.y, p.x, p.y) < (p.aoe || 30)) this.hurt(u, p.dmg, p.faction);
        }
        for (const b of this.buildings) {
          if (b.faction === p.faction) continue;
          if (hypot(b.x, b.y, p.x, p.y) < (p.aoe || 30) + 20) this.hurt(b, p.dmg, p.faction);
        }
      } else if (t && hypot(p.x, p.y, t.x, t.y) < 14 + (t.kind === "building" ? 16 : 0)) {
        hit = true;
        this.hurt(t, p.dmg, p.faction);
        if(p.poison && t.kind === "unit" && t.state !== "dead") {t.poison=4;t.poisonSource=p.faction;}
        this.burst(t.x, t.y, "#a03030", 4);
      }
      if (!hit && p.life > 0 && p.z > -4) keep.push(p);
    }
    this.projectiles = keep;
  }

  private updateParticles(dt: number) {
    const keep: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += 20 * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      if (p.life > 0) keep.push(p);
    }
    this.particles = keep;
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 50;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.3,
        max: 0.55,
        color,
        size: 1.5 + Math.random() * 2,
        z: 0,
      });
    }
  }

  private hurt(t: Target, dmg: number, source: Faction | null = null) {
    if(t.hp<=0) return;
    if(t.kind==='unit') {
      if(t.faction==='human' && t.abilityTime>0) dmg*=.5;
      if(this.officerNear(t)) dmg*=.85;
      if(this.upgrades[t.faction].ironArmor) dmg*=.85;
    }
    if(t.faction===this.player && this.time-this.lastWarning>10) {
      this.lastWarning=this.time;this.notify('Your forces are under attack!');this.addPing(t.x, t.y, '#ff5252', 3);audio.horn();
    }
    t.hp -= dmg;
    if (t.hp <= 0) {
      t.hp = 0;
      if (t.kind === "unit") {
        this.stats[t.faction].losses++;
        if(source && source!==t.faction) this.stats[source].kills++;
        this.corpses.push({x:t.x,y:t.y,life:35,faction:t.faction});
        t.state = "dead";
        t.anim = 0;
        t.path = [];
        if (t.faction !== this.player) audio.death();
      } else {
        if(source && source!==t.faction) this.stats[source].buildings++;
        this.destroyBuilding(t);
      }
    }
  }

  private destroyBuilding(b: Building) {
    this.setBlockedRect(b.tileX, b.tileY, b.tw, b.th, 0);
    this.buildings = this.buildings.filter((x) => x.id !== b.id);
    this.selected.delete(b.id);
    this.burst(b.x, b.y, "#6a5a3a", 18);
    if (b.faction === this.player) this.notify(`${buildingName(b.type, b.faction)} destroyed!`);
    audio.death();
  }

  private getTarget(id: number | null): Target | null {
    if (id == null) return null;
    const u = this.units.find((x) => x.id === id && x.state !== "dead");
    if (u) return u;
    const b = this.buildings.find((x) => x.id === id);
    return b || null;
  }

  private findEnemyInRange(u: Unit, range: number) {
    return this.findEnemyNear(u.x, u.y, range, u.faction);
  }

  private findEnemyNear(x: number, y: number, range: number, f: Faction): Target | null {
    let best: Target | null = null;
    let bd = range;
    for (const o of this.units) {
      if (o.faction === f || o.state === "dead" || !detectable(o,f,this.units,this.terrain)) continue;
      const d = hypot(x, y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    for (const b of this.buildings) {
      if (b.faction === f) continue;
      const d = hypot(x, y, b.x, b.y);
      if (d < bd + 12) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private separate() {
    const cell = 40;
    const grid = new Map<number, Unit[]>();
    const key = (x: number, y: number) => ((x / cell) | 0) * 4096 + ((y / cell) | 0);
    for (const u of this.units) {
      if (u.state === "dead") continue;
      if (u.state === "gather" || u.state === "build" || u.state === "return" || u.hold) continue;
      const k = key(u.x, u.y);
      let a = grid.get(k);
      if (!a) {
        a = [];
        grid.set(k, a);
      }
      a.push(u);
    }
    const bump = (a: Unit, b: Unit) => {
      const d = hypot(a.x, a.y, b.x, b.y);
      const min = UNIT[a.type].radius + UNIT[b.type].radius;
      if (d > 0.1 && d < min) {
        const px = ((a.x - b.x) / d) * (min - d) * 0.45;
        const py = ((a.y - b.y) / d) * (min - d) * 0.45;
        const clear=(x:number,y:number)=>x>=0&&y>=0&&x<MAP_W*TILE&&y<MAP_H*TILE&&!this.blocked[idx(Math.floor(x/TILE),Math.floor(y/TILE))];
        if(clear(a.x+px,a.y+py)) {a.x+=px;a.y+=py;}
        if(clear(b.x-px,b.y-py)) {b.x-=px;b.y-=py;}
      }
    };
    for (const [, list] of grid) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) bump(list[i], list[j]);
      }
    }
  }

  private checkOutcome() {
    if (this.time < 4) return;
    const eb = this.buildings.filter((b) => b.faction !== this.player).length;
    const pb = this.buildings.filter((b) => b.faction === this.player).length;
    if (eb === 0) {
      this.resultReason = "Both rival strongholds have fallen. The god’s remains are yours.";
      this.outcome = "victory";
      audio.victory();
    } else if (pb === 0) {
      this.resultReason = "Your last building has fallen. The Flesh War belongs to another host.";
      this.outcome = "defeat";
      audio.defeat();
    }
  }

  private updateAI(dt: number) {
    this.aiT += dt;
    if (this.aiT < DIFFICULTY[this.difficulty].interval) return;
    this.aiT = 0;
    for (const f of this.enemies) this.updateFactionAI(f);
  }

  private updateFactionAI(f: Faction) {
    if(!this.buildings.some(b=>b.faction===f)) return;
    const settings=DIFFICULTY[this.difficulty];
    const workers = this.units.filter((u) => u.faction === f && u.type === "worker" && u.state !== "dead");
    const army = this.units.filter((u) => u.faction === f && u.type !== "worker" && u.state !== "dead");
    const halls = this.buildings.filter((b) => b.faction === f && b.type === "hall");
    const barracks = this.buildings.filter((b) => b.faction === f && b.type === "barracks" && b.complete);
    const farms = this.buildings.filter((b) => b.faction === f && b.type === "farm");
    const hall = halls.find((b) => b.complete) || halls[0];
    if (!hall) {
      const w = workers[0];
      if (w) {
        this.aiTryBuild(f, "hall", {
          tileX: (w.x / TILE) | 0,
          tileY: (w.y / TILE) | 0,
        });
      }
      if (army.length && this.time - this.aiLastAttack[f] > 8) {
        const th = this.buildings.filter(b => b.faction !== f).sort((a,b) => Math.hypot(a.x-army[0].x,a.y-army[0].y)-Math.hypot(b.x-army[0].x,b.y-army[0].y))[0];
        if (th) {
          this.formationMove(army, th.x, th.y, true);
          this.aiLastAttack[f] = this.time;
        }
      }
      return;
    }

    const golders = workers.filter((w) => w.gatherType === "gold");
    const lumberers = workers.filter((w) => w.gatherType === "lumber");
    const idle = workers.filter((w) => w.state === "idle" && !w.buildId);
    const sites = this.buildings.filter((b) => b.faction === f && !b.complete);

    for(const site of sites) {
      if(workers.some(w=>w.state==='build'&&w.buildId===site.id)) continue;
      const w=idle.find(w=>w.state==='idle') || workers.find(w=>w.state!=='build' && w.carried===0);
      if(w) this.assignBuild(w,site);
    }

    for (const w of idle) {
      if (w.state !== "idle") continue;
      if (golders.length < 5) {
        const m = this.nearestMine(w.x, w.y);
        if (m) { this.assignGatherGold(w, m); golders.push(w); }
      } else {
        const t = this.nearestTree(w.x, w.y);
        if (t) this.assignGatherLumber(w, t);
      }
    }

    const foodGap = this.foodMax(f) - this.foodUsed(f);
    if (foodGap < 4 && farms.length < 10) {
      this.aiTryBuild(f, "farm", hall);
    }
    if (!this.buildings.some((b) => b.faction === f && b.type === "barracks") && this.time > 18) {
      this.aiTryBuild(f, "barracks", hall);
    } else if (this.difficulty !== "easy" && barracks.length < 2 && this.time > 85 && this.gold[f] > 320 && this.lumber[f] > 200) {
      this.aiTryBuild(f, "barracks", hall);
    }
    if (!this.buildings.some((b) => b.faction === f && b.type === "mill") && lumberers.length && this.time > 25) {
      this.aiTryBuild(f, "mill", hall);
    }
    if (this.time > 70 && !this.hasBuilding(f, "blacksmith")) this.aiTryBuild(f, "blacksmith", hall);
    if (this.time > 95 && !this.hasBuilding(f, "stables")) this.aiTryBuild(f, "stables", hall);
    if (this.time > 110 && this.buildings.filter((b) => b.faction === f && b.type === "tower").length < 2) {
      this.aiTryBuild(f, "tower", hall);
    }

    if (!this.researching[f] && this.difficulty !== "easy") {
      if (this.hasBuilding(f, "blacksmith") && !this.upgrades[f].forgeWeapons && this.gold[f] > 280) this.research("forgeWeapons", f);
      else if (this.hasBuilding(f, "blacksmith") && !this.upgrades[f].ironArmor && this.gold[f] > 300) this.research("ironArmor", f);
      else if (this.hasBuilding(f, "mill") && !this.upgrades[f].keenAxes && this.gold[f] > 240) this.research("keenAxes", f);
    }

    const nearbyGold=this.mines.some(m=>m.gold>150 && hypot(m.x,m.y,hall.x,hall.y)<480);
    if(this.time>150 && !nearbyGold && halls.length<3 && !sites.some(b=>b.type==='hall')) {
      const mine=this.nearestMine(hall.x,hall.y);
      if(mine) this.aiTryBuild(f,'hall',{tileX:mine.tileX-5,tileY:mine.tileY-5});
    }
    const workerNeed = this.time < 80 ? 8 : 10;
    if (workers.length < workerNeed && hall.complete && hall.queue.length < 2) {
      this.enqueue(hall, "worker", false);
    }

    for (const bx of barracks) {
      if (bx.queue.length >= 3 || foodGap < 2) continue;
      const nMelee = army.filter((a) => a.type === "melee").length;
      const nRange = army.filter((a) => a.type === "ranged").length;
      let t: UnitClass = "melee";
      if (nRange < nMelee / 2 && this.lumber[f] >= UNIT.ranged.lumber) t = "ranged";
      if (this.hasBuilding(f, "stables") && army.filter((a) => a.type === "cavalry").length < 3 && this.gold[f] > 400)
        t = "cavalry";
      if (this.hasBuilding(f, "blacksmith") && army.filter((a) => a.type === "siege").length < 2 && this.time > 130)
        t = "siege";
      this.enqueue(bx, t, false);
    }

    // Fall back with badly injured soldiers; recover slowly near a friendly hall.
    const healthy: Unit[]=[];
    for(const u of army) {
      if(u.hp/u.maxHp<settings.retreat && !(u.faction==='corrupted'&&u.abilityTime>0)) {
        if(hypot(u.x,u.y,hall.x,hall.y)>160) {
          if(u.state!=='move') this.formationMove([u],hall.rallyX,hall.rallyY,false);
        } else u.hp=Math.min(u.maxHp,u.hp+settings.interval*3);
      } else healthy.push(u);
    }
    const threat = this.findEnemyNear(hall.x, hall.y, 240, f);
    const engagement=healthy.find(u=>u.state==='attack');
    if(engagement && this.difficulty!=='easy') {
      const target=this.getTarget(engagement.targetId);
      if(target) this.activateAbility(healthy.filter(u=>hypot(u.x,u.y,engagement.x,engagement.y)<140),target);
    }
    if(threat && healthy.length) {
      const defenders=healthy.filter(u=>u.state!=='attack');
      if(defenders.length) this.formationMove(defenders,threat.x,threat.y,true);
    } else if(healthy.length>=settings.army && this.time>=settings.march && this.time-this.aiLastAttack[f]>18) {
      const rivalEmpowered=FACTIONS.some(other=>other!==f&&this.empowered[other]);
      const needsRitual=!this.empowered[f];
      if(needsRitual || (rivalEmpowered && this.ritual.contested)) {
        const marching=healthy.filter(u=>u.state!=='attack'&&hypot(u.x,u.y,RELIC.x,RELIC.y)>RELIC.radius*.55);
        if(marching.length) this.formationMove(marching,RELIC.x,RELIC.y,true);
      } else {
        const target=this.buildings.filter(b=>b.faction!==f).sort((a,b)=>hypot(a.x,a.y,hall.x,hall.y)-hypot(b.x,b.y,hall.x,hall.y))[0];
        if(target) {
          this.formationMove(healthy.filter(u=>u.state!=='attack'),target.x,target.y,true);
          if(target.faction===this.player) this.notify(`${TEAM[f].name} marches on your stronghold!`);
        }
      }
      this.aiLastAttack[f]=this.time;
    }
  }

  private aiTryBuild(f: Faction, type: BuildingClass, hall: { tileX: number; tileY: number }) {
    const st = BUILDING[type];
    if (this.gold[f] < st.gold || this.lumber[f] < st.lumber) return;
    if (this.buildings.some((b) => b.faction === f && b.type === type && !b.complete)) return;
    const worker=this.units.find(u=>u.faction===f&&u.type==="worker"&&u.state!=="dead"&&u.state!=="build"&&u.carried===0);
    if(!worker) return;
    const spot = this.findBuildSpot(type, hall);
    if (!spot) return;
    this.gold[f] -= st.gold;
    this.lumber[f] -= st.lumber;
    const b = this.makeBuilding(f, type, spot.x, spot.y, false);
    const w = this.units.find((u) => u.faction === f && u.type === "worker" && u.state !== "dead" && u.state !== "build");
    if (w) this.assignBuild(w, b);
  }

  private findBuildSpot(type: BuildingClass, hall: { tileX: number; tileY: number }) {
    const st = BUILDING[type];
    for (let r = 5; r < 22; r++) {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + r;
        const tx = ((hall.tileX + Math.cos(a) * r) | 0);
        const ty = ((hall.tileY + Math.sin(a) * r) | 0);
        if (this.canPlace(type, tx, ty, false)) return { x: tx, y: ty };
        if (this.canPlace(type, tx, ty + st.th, false)) return { x: tx, y: ty + st.th };
      }
    }
    return null;
  }

  renderView(): RenderView {
    const selB = this.selectedBuildings();
    return {
      ritual: this.ritual, empowered: this.empowered, corpses: this.corpses,
      terrain: this.terrain,
      trees: this.trees,
      mines: this.mines,
      decorations: this.decorations,
      units: this.units,
      buildings: this.buildings,
      projectiles: this.projectiles,
      particles: this.particles,
      floaters: this.floaters,
      pings: this.pings,
      vis: this.vis,
      explored: this.explored,
      player: this.player,
      cam: this.cam,
      selected: this.selected,
      buildMode: this.buildMode,
      ghost: this.ghost,
      box: this.box,
      time: this.time,
      rally: selB.length === 1 ? { x: selB[0].rallyX, y: selB[0].rallyY } : null,
    };
  }

  hud(): HudState {
    const selU = this.units.filter((u) => this.selected.has(u.id) && u.state !== "dead");
    const selB = this.buildings.filter((b) => this.selected.has(b.id));
    let selected: HudState["selected"] = null;
    if (selU.length + selB.length > 0) {
      if (selU.length && !selB.length) {
        const hp = selU.reduce((s, u) => s + u.hp, 0);
        const maxHp = selU.reduce((s, u) => s + u.maxHp, 0);
        selected = {
          kind: selU.length > 1 ? "mixed" : "unit",
          types: [...new Set(selU.map((u) => unitName(u.type, u.faction)))],
          count: selU.length,
          hp,
          maxHp,
          faction: selU[0].faction,
          queue: [],
          progress: 1,
          complete: true,
          buildingType: null,
          // A homogeneous group (e.g. several workers) keeps its unit type for the HUD.
          unitType: selU.every((u) => u.type === selU[0].type) ? selU[0].type : null,
        };
      } else if (selB.length && !selU.length) {
        const b = selB[0];
        selected = {
          kind: "building",
          types: [buildingName(b.type, b.faction)],
          count: selB.length,
          hp: b.hp,
          maxHp: b.maxHp,
          faction: b.faction,
          queue: b.queue.map((q) => ({ ...q })),
          progress: b.progress,
          complete: b.complete,
          buildingType: b.type,
          unitType: null,
        };
      } else {
        selected = {
          kind: "mixed",
          types: ["Mixed"],
          count: selU.length + selB.length,
          hp: 0,
          maxHp: 1,
          faction: this.player,
          queue: [],
          progress: 1,
          complete: true,
          buildingType: null,
          unitType: null,
        };
      }
    }
    const mineHover = this.pickMine(this.mouseWorld.x, this.mouseWorld.y);
    if (!selected && mineHover) {
      selected = {
        kind: "mine",
        types: ["Gold Mine"],
        count: 1,
        hp: mineHover.gold,
        maxHp: 2200,
        faction: null,
        queue: [],
        progress: 1,
        complete: true,
        buildingType: null,
        unitType: null,
        goldLeft: mineHover.gold,
      };
    }
    return {
      ritual: {...this.ritual,progress:{...this.ritual.progress}}, empowered: {...this.empowered},
      stats: structuredClone(this.stats), resultReason: this.resultReason, difficulty: this.difficulty,
      canPan: {left:this.cam.x>1,right:this.cam.x+this.viewW/this.cam.zoom<MAP_W*TILE-1,up:this.cam.y>1,down:this.cam.y+this.viewH/this.cam.zoom<MAP_H*TILE-1},
      idleWorkers: this.units.filter(u=>u.faction===this.player&&u.type==='worker'&&u.state==='idle').length,
      abilityReady: this.selectedUnits().filter(u=>u.type!=='worker'&&u.abilityCd<=0).length,
      abilityCooldown: Math.ceil(Math.min(...this.selectedUnits().filter(u=>u.type!=='worker').map(u=>u.abilityCd), 999)),
      holding: this.selectedUnits().some(u=>u.hold), queuedOrders: Math.max(0,...this.selectedUnits().map(u=>u.orders.length)),
      upgrades: { ...this.upgrades[this.player] },
      researching: this.researching[this.player] ? { ...this.researching[this.player]! } : null,
      groups: Object.fromEntries(
        Object.entries(this.groups).map(([k, ids]) => [
          k,
          ids.filter((id) => this.units.some((u) => u.id === id && u.state !== "dead") || this.buildings.some((b) => b.id === id)).length,
        ]),
      ),
      gameSpeed: this.gameSpeed,
      gold: this.gold[this.player] | 0,
      lumber: this.lumber[this.player] | 0,
      food: this.foodUsed(this.player),
      foodMax: this.foodMax(this.player),
      time: this.time,
      selected,
      buildMode: this.buildMode,
      attackMove: this.attackMoveMode,
      hasStables: this.hasBuilding(this.player, "stables"),
      hasBlacksmith: this.hasBuilding(this.player, "blacksmith"),
      hasHall: this.hasBuilding(this.player, "hall"),
      hasBarracks: this.hasBuilding(this.player, "barracks"),
      outcome: this.outcome,
      messages: this.messages,
      enemyBuildings: this.buildings.filter((b) => b.faction !== this.player).length,
      enemyUnits: this.units.filter((u) => u.faction !== this.player && u.state !== "dead").length,
      playerBuildings: this.buildings.filter((b) => b.faction === this.player).length,
      playerUnits: this.units.filter((u) => u.faction === this.player && u.state !== "dead").length,
    };
  }
}

function worldFromLocal(cam: Cam, sx: number, sy: number) {
  return { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom };
}
