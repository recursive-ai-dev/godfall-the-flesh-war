import { RELIC, detectable, concealed, type Ritual, type Corpse } from './warfare';
import { sprite } from "../media";
import { BUILDING } from "./data";
import {
  MAP_H,
  MAP_W,
  TEAM,
  TERRAIN,
  TILE,
  type Building,
  type BuildingClass,
  type Decoration,
  type Faction,
  type GoldMine,
  type Particle,
  type Projectile,
  type Tree,
  type Unit,
} from "./types";

const TAU = Math.PI * 2;

export interface Cam {
  x: number;
  y: number;
  zoom: number;
}

export interface RenderView {
  ritual: Ritual;
  empowered: Record<Faction, boolean>;
  corpses: Corpse[];
  terrain: Uint8Array;
  trees: Tree[];
  mines: GoldMine[];
  decorations: Decoration[];
  units: Unit[];
  buildings: Building[];
  projectiles: Projectile[];
  particles: Particle[];
  vis: Uint8Array;
  explored: Uint8Array;
  player: Faction;
  cam: Cam;
  selected: Set<number>;
  buildMode: BuildingClass | null;
  ghost: { tx: number; ty: number; ok: boolean } | null;
  box: { x1: number; y1: number; x2: number; y2: number } | null;
  time: number;
  rally: { x: number; y: number } | null;
}



export function worldFromScreen(
  cam: Cam,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom };
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  v: RenderView,
  vw: number,
  vh: number,
) {
  ctx.save();
  ctx.fillStyle = "#07110c";
  ctx.fillRect(0, 0, vw, vh);

  const z = v.cam.zoom;
  ctx.translate(-v.cam.x*z,-v.cam.y*z);
  ctx.scale(z,z);

  const ts = TILE;
  const x0 = Math.max(0, Math.floor(v.cam.x / ts) - 1);
  const y0 = Math.max(0, Math.floor(v.cam.y / ts) - 1);
  const x1 = Math.min(MAP_W, Math.ceil((v.cam.x + vw / z) / ts) + 1);
  const y1 = Math.min(MAP_H, Math.ceil((v.cam.y + vh / z) / ts) + 1);

  drawTerrain(ctx, v, x0, y0, x1, y1);
  drawDecorations(ctx, v, x0, y0, x1, y1);
  drawRelic(ctx,v);
  for(const c of v.corpses) {
    const tx=Math.floor(c.x/TILE),ty=Math.floor(c.y/TILE);
    if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H||v.vis[ty*MAP_W+tx]!==2) continue;
    ctx.fillStyle='#713a3d';ctx.fillRect(c.x-7,c.y-2,14,4);
    ctx.fillStyle='#b8a28a';ctx.fillRect(c.x-4,c.y-1,8,2);
  }

  const visTrees = v.trees.filter((t) => {
    const i = t.tileY * MAP_W + t.tileX;
    return v.explored[i] && t.x > v.cam.x - 40 && t.x < v.cam.x + vw / z + 40;
  });
  for (const t of visTrees) drawTree(ctx, t, v.time);

  for (const m of v.mines) {
    const i = m.tileY * MAP_W + m.tileX;
    if (!v.explored[i]) continue;
    drawMine(ctx, m, v.time);
  }

  const drawables: { y: number; draw: () => void }[] = [];
  for (const b of v.buildings) {
    const i = b.tileY * MAP_W + b.tileX;
    if (!v.explored[i] && b.faction !== v.player) continue;
    drawables.push({ y: b.y + b.th * 10, draw: () => drawBuilding(ctx, b, v) });
  }
  for (const u of v.units) {
    if (u.faction !== v.player) {
      const tx = Math.max(0, Math.min(MAP_W - 1, (u.x / TILE) | 0));
      const ty = Math.max(0, Math.min(MAP_H - 1, (u.y / TILE) | 0));
      if (v.vis[ty * MAP_W + tx] !== 2 || !detectable(u,v.player,v.units,v.terrain)) continue;
    }
    if (
      u.x < v.cam.x - 30 ||
      u.y < v.cam.y - 30 ||
      u.x > v.cam.x + vw / z + 30 ||
      u.y > v.cam.y + vh / z + 30
    )
      continue;
    drawables.push({ y: u.y, draw: () => drawUnit(ctx, u, v) });
  }
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  for (const p of v.projectiles) drawProjectile(ctx, p);
  for (const p of v.particles) drawParticle(ctx, p);

  if (v.rally) {
    for(const b of v.buildings.filter(b=>v.selected.has(b.id)&&b.faction===v.player)) {
      ctx.save();ctx.setLineDash([5,5]);ctx.strokeStyle='#e8c84a80';ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(v.rally.x,v.rally.y);ctx.stroke();ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = "rgba(240,200,80,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(v.rally.x, v.rally.y - 16);
    ctx.lineTo(v.rally.x, v.rally.y);
    ctx.stroke();
    ctx.fillStyle = "#e8c84a";
    ctx.beginPath();
    ctx.moveTo(v.rally.x, v.rally.y - 16);
    ctx.lineTo(v.rally.x + 10, v.rally.y - 12);
    ctx.lineTo(v.rally.x, v.rally.y - 8);
    ctx.fill();
    ctx.restore();
  }

  drawFog(ctx, v, x0, y0, x1, y1);

  if (v.ghost && v.buildMode) drawGhost(ctx, v.buildMode, v.ghost, v.player);
  if (v.box) {
    const x = Math.min(v.box.x1, v.box.x2);
    const y = Math.min(v.box.y1, v.box.y2);
    const w = Math.abs(v.box.x2 - v.box.x1);
    const h = Math.abs(v.box.y2 - v.box.y1);
    ctx.strokeStyle = "rgba(255, 236, 140, 0.95)";
    ctx.fillStyle = "rgba(255, 220, 80, 0.08)";
    ctx.lineWidth = 1 / z;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  ctx.restore();
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  v: RenderView,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * MAP_W + x;
      if (!v.explored[i]) continue;
      const t = v.terrain[i];
      const px = x * TILE;
      const py = y * TILE;
      const name = ["grass", "dirt", "water", "moss", "sand", "stone"][t];
      const img = sprite(name);
      ctx.imageSmoothingEnabled = false;
      if (img) ctx.drawImage(img, px, py, TILE, TILE);
      else { ctx.fillStyle = "#26332a"; ctx.fillRect(px, py, TILE, TILE); }

    }
  }

  // Shore highlight
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * MAP_W + x;
      if (v.terrain[i] === TERRAIN.WATER || !v.explored[i]) continue;
      let shore = false;
      for (let dy = -1; dy <= 1 && !shore; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
          if (v.terrain[ny * MAP_W + nx] === TERRAIN.WATER) shore = true;
        }
      }
      if (shore) {
        ctx.fillStyle = "rgba(214, 186, 110, 0.35)";
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
}

function drawDecorations(
  ctx: CanvasRenderingContext2D,
  v: RenderView,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const pad = 40;
  const minx = x0 * TILE - pad;
  const maxx = x1 * TILE + pad;
  const miny = y0 * TILE - pad;
  const maxy = y1 * TILE + pad;
  for (const d of v.decorations) {
    if (d.x < minx || d.x > maxx || d.y < miny || d.y > maxy) continue;
    const tx = Math.max(0, Math.min(MAP_W - 1, (d.x / TILE) | 0));
    const ty = Math.max(0, Math.min(MAP_H - 1, (d.y / TILE) | 0));
    if (!v.explored[ty * MAP_W + tx]) continue;
    if(d.type === 'ruin') {
      const img=sprite('ruin');if(img) {ctx.globalAlpha=.7;ctx.drawImage(img,d.x-32,d.y-36,64,64);ctx.globalAlpha=1;}
    } else if (d.type === "flower") {
      ctx.fillStyle = d.v > 0.5 ? "#d4c85a" : "#c45a7a";
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.6, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = "#6a6458";
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 4 + d.v * 3, 2.5, d.v, 0, TAU);
      ctx.fill();
    }
  }
}

function drawTree(ctx: CanvasRenderingContext2D, t: Tree, time: number) {
  const s = 0.55 + Math.min(1, t.lumber / 55) * 0.55;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 5, 11 * s, 5 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#4a3018";
  ctx.fillRect(-2.4 * s, -2, 4.8 * s, 9 * s);
  const sway = Math.sin(time * 0.7 + t.x * 0.04) * 1.4;
  const cols = ["#1c5a28", "#164a22", "#227030", "#1a4e26"];
  ctx.fillStyle = cols[t.variant & 3];
  ctx.beginPath();
  ctx.arc(sway, -11 * s, 12 * s, 0, TAU);
  ctx.arc(sway - 7 * s, -8 * s, 8 * s, 0, TAU);
  ctx.arc(sway + 7 * s, -8 * s, 8 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(80,160,70,0.35)";
  ctx.beginPath();
  ctx.arc(sway - 3, -14 * s, 5 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawMine(ctx: CanvasRenderingContext2D, m: GoldMine, time: number) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 28, 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#5a4a32";
  ctx.beginPath();
  ctx.ellipse(-10, 4, 16, 12, -0.3, 0, TAU);
  ctx.ellipse(12, 6, 18, 13, 0.2, 0, TAU);
  ctx.ellipse(0, -6, 14, 11, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#8a7a62";
  ctx.beginPath();
  ctx.ellipse(-8, 0, 8, 6, 0, 0, TAU);
  ctx.fill();
  const spark = 0.5 + Math.sin(time * 3 + m.id) * 0.5;
  ctx.fillStyle = `rgba(240,200,60,${0.45 + spark * 0.4})`;
  ctx.beginPath();
  ctx.arc(-6, 2, 3, 0, TAU);
  ctx.arc(8, 4, 2.4, 0, TAU);
  ctx.arc(2, -4, 2.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#c9a227";
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "center";
  if (m.gold <= 0) {
    ctx.fillStyle = "#888";
    ctx.fillText("depleted", 0, 24);
  }
  ctx.restore();
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, v: RenderView) {
  ctx.save();
  ctx.translate(b.x, b.y);
  const selected = v.selected.has(b.id);
  if (selected) {
    ctx.strokeStyle = "rgba(255, 230, 120, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-b.tw * 16 + 2, -b.th * 16 + 2, b.tw * 32 - 4, b.th * 32 - 4);
  }

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(0, b.th * 12, b.tw * 13, b.th * 6, 0, 0, TAU);
  ctx.fill();

  if (!b.complete) {
    ctx.globalAlpha = 0.35 + b.progress * 0.65;
  }

  drawBuildingSprite(ctx, b);

  ctx.globalAlpha = 1;
  if (!b.complete) {
    drawScaffold(ctx, b);
    const w = b.tw * 24;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(-w / 2, b.th * 14, w, 5);
    ctx.fillStyle = "#d4b44a";
    ctx.fillRect(-w / 2, b.th * 14, w * b.progress, 5);
  }

  if (selected || b.hp < b.maxHp) {
    drawHpBar(ctx, 0, -b.th * 16 - 6, b.tw * 22, b.hp / b.maxHp, b.faction);
  }

  if (b.queue.length && b.faction === v.player) {
    const q = b.queue[0];
    const w = b.tw * 22;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-w / 2, b.th * 16 + 4, w, 4);
    ctx.fillStyle = "#6ec4ff";
    ctx.fillRect(-w / 2, b.th * 16 + 4, w * Math.min(1, q.t / q.max), 4);
  }
  ctx.restore();
}

function drawBuildingSprite(ctx: CanvasRenderingContext2D, b: Building) {
  const img = sprite(`${b.faction}-${b.type}`);
  ctx.imageSmoothingEnabled = false;
  if (img) ctx.drawImage(img, -b.tw * 16, -b.th * 16, b.tw * 32, b.th * 32);
  ctx.fillStyle = TEAM[b.faction].primary;
  ctx.fillRect(-b.tw * 12, b.th * 12, b.tw * 24, 3);
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#eee5d4";
  ctx.fillText(BUILDING[b.type].name[b.faction], 0, b.th * 16);
}

function drawScaffold(ctx: CanvasRenderingContext2D, b: Building) {
  ctx.strokeStyle = "rgba(160,120,60,0.85)";
  ctx.lineWidth = 2;
  const w = b.tw * 16;
  const h = b.th * 16;
  ctx.strokeRect(-w + 6, -h + 6, w * 2 - 12, h * 2 - 12);
  ctx.beginPath();
  ctx.moveTo(-w + 6, -h + 6);
  ctx.lineTo(w - 6, h - 6);
  ctx.moveTo(w - 6, -h + 6);
  ctx.lineTo(-w + 6, h - 6);
  ctx.stroke();
}

function drawUnit(ctx: CanvasRenderingContext2D, u: Unit, v: RenderView) {
  const selected = v.selected.has(u.id);
  const dead = u.state === "dead";
  ctx.save();
  ctx.translate(u.x, u.y);
  if (dead) {
    ctx.globalAlpha = Math.max(0, 1 - u.anim * 1.1);
    ctx.rotate(0.8);
    ctx.scale(1, 0.45);
  }

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(0, 7, u.type === "cavalry" ? 12 : 8, 4, 0, 0, TAU);
  ctx.fill();

  if (selected && !dead) {
    ctx.strokeStyle = TEAM[u.faction].light;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 7, u.type === "cavalry" ? 14 : 11, 5.5, 0, 0, TAU);
    ctx.stroke();
  }

  if(concealed(u,v.terrain) && !dead) ctx.globalAlpha=.5;
  if(v.empowered[u.faction] || u.abilityTime>0 || u.meals>=3) {
    ctx.strokeStyle=v.empowered[u.faction]?'#ffe0a1':TEAM[u.faction].light;
    ctx.lineWidth=v.empowered[u.faction]?2.5:1.5;
    ctx.beginPath();ctx.ellipse(0,5,17,8,0,0,TAU);ctx.stroke();
  }
  if(u.type==='cavalry' && u.faction==='human' && selected) {
    ctx.strokeStyle='#7eb3e040';ctx.beginPath();ctx.arc(0,0,100,0,TAU);ctx.stroke();
  }
  const moving=u.path.length>0 || u.state==='move' || u.state==='return';
  const attacking=u.state==='attack'&&!moving;
  const dir=Math.abs(Math.cos(u.angle))>Math.abs(Math.sin(u.angle)) ? (Math.cos(u.angle)>0?1:3) : (Math.sin(u.angle)>0?0:2);
  const working=!dead&&!moving&&!attacking&&u.type==='worker'&&(u.state==='build'||(u.state==='gather'&&!!u.gatherType));
  const workRow=u.state==='build'?16:u.gatherType==='gold'?12:8;
  const frame=dead||(!moving&&!attacking&&!working)?0:Math.floor(u.anim*(working?8:attacking?12:9))%8;
  const img=sprite(`${u.faction}-${u.type}-atlas`);
  ctx.imageSmoothingEnabled=false;
  const size=(u.type==='siege'?52:u.type==='cavalry'?48:36)*(u.meals>=3?1.15:1);
  const cell=img?img.width/8:32;
  if(img) ctx.drawImage(img,frame*cell,(dir+(working?workRow:attacking?4:0))*cell,cell,cell,-size/2,-size+12,size,size);
  const role=u.type==='cavalry'||u.type==='siege'||working?null:sprite('role-'+({worker:'hammer',melee:'sword',ranged:'bow',cavalry:'shield',siege:'staff'}[u.type]));
  if(role) ctx.drawImage(role,7,-16,14,14);
  ctx.fillStyle=TEAM[u.faction].light;
  ctx.fillRect(-7,10,14,3);
  if(u.hold) {ctx.strokeStyle='#a9c7ec';ctx.strokeRect(-9,8,18,7);}
  if(u.poison>0) {ctx.fillStyle='#a9e060';ctx.beginPath();ctx.arc(10,-22,3,0,TAU);ctx.fill();}
  if(u.flash>0) {
    ctx.strokeStyle=u.faction==='darkelf'?'#cb9aff':u.faction==='corrupted'?'#f88570':'#faf2dc';
    ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,24,u.angle-.6,u.angle+.6);ctx.stroke();
  }

  if (u.carried > 0) {
    ctx.fillStyle = u.gatherType === "gold" ? "#e8c84a" : "#7a4a20";
    ctx.beginPath();
    ctx.arc(8, 4, 3.2, 0, TAU);
    ctx.fill();
  }

  ctx.restore();

  if(selected && !dead && u.orders.length) {
    ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle=TEAM[u.faction].light;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(u.x,u.y);
    for(const o of u.orders) ctx.lineTo(o.x,o.y);
    ctx.stroke();ctx.setLineDash([]);
    u.orders.forEach((o,i)=>{ctx.fillStyle='#ede1c0';ctx.font='10px sans-serif';ctx.fillText(String(i+1),o.x,o.y);});ctx.restore();
  }
  if (!dead && (selected || u.hp < u.maxHp)) {
    drawHpBar(ctx, u.x, u.y - 18, 16, u.hp / u.maxHp, u.faction);
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile) {
  ctx.save();
  ctx.translate(p.x, p.y - p.z);
  if (p.type === "boulder") {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, p.z + 6, 6, 3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#6a6458";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = p.poison ? "#a4e45c" : TEAM[p.faction].light;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const a = Math.atan2(p.vy, p.vx);
    ctx.moveTo(-Math.cos(a) * 6, -Math.sin(a) * 6);
    ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.globalAlpha = Math.max(0, p.life / p.max);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y - p.z, p.size, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  r: number,
  f: Faction,
) {
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(x - w / 2, y, w, 3.5);
  const col = r > 0.55 ? "#4caf50" : r > 0.3 ? "#d4b44a" : "#c62828";
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, r), 3.5);
  ctx.strokeStyle = TEAM[f].primary;
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x - w / 2, y, w, 3.5);
}

function drawFog(
  ctx: CanvasRenderingContext2D,
  v: RenderView,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * MAP_W + x;
      if (!v.explored[i]) {
        ctx.fillStyle = "#05080a";
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      } else if (v.vis[i] !== 2) {
        ctx.fillStyle = "rgba(0,0,0,0.48)";
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  type: BuildingClass,
  ghost: { tx: number; ty: number; ok: boolean },
  faction: Faction,
) {
  const st = BUILDING[type];
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ghost.ok ? "rgba(80,200,80,0.35)" : "rgba(200,40,40,0.4)";
  ctx.strokeStyle = ghost.ok ? "#6f6" : "#f66";
  ctx.lineWidth = 2;
  ctx.fillRect(ghost.tx * TILE, ghost.ty * TILE, st.tw * TILE, st.th * TILE);
  ctx.strokeRect(ghost.tx * TILE, ghost.ty * TILE, st.tw * TILE, st.th * TILE);
  ctx.translate((ghost.tx + st.tw / 2) * TILE, (ghost.ty + st.th / 2) * TILE);
  const fake = {
    id: 0,
    kind: "building" as const,
    faction,
    type,
    tileX: ghost.tx,
    tileY: ghost.ty,
    tw: st.tw,
    th: st.th,
    x: 0,
    y: 0,
    hp: st.hp,
    maxHp: st.hp,
    progress: 1,
    complete: true,
    queue: [],
    rallyX: 0,
    rallyY: 0,
    attackCd: 0,
  };
  drawBuildingSprite(ctx, fake);
  ctx.restore();
}

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  v: RenderView,
  w: number,
  h: number,
  viewW: number,
  viewH: number,
) {
  ctx.fillStyle = "#0a120c";
  ctx.fillRect(0, 0, w, h);
  const sx = w / MAP_W;
  const sy = h / MAP_H;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      if (!v.explored[i]) {
        ctx.fillStyle = "#05070a";
        ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
        continue;
      }
      const t = v.terrain[i];
      let col = "#3a7a32";
      if (t === TERRAIN.WATER) col = "#215a84";
      else if (t === TERRAIN.DIRT) col = "#8a6a38";
      else if (t === TERRAIN.FOREST) col = "#1c4a22";
      else if (t === TERRAIN.GOLD) col = "#c9a227";
      else if (t === TERRAIN.ROCK) col = "#5a5e58";
      if (v.vis[i] !== 2) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.45;
      } else {
        ctx.fillStyle = col;
        ctx.globalAlpha = 1;
      }
      ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
      ctx.globalAlpha = 1;
    }
  }
  for (const b of v.buildings) {
    const i = b.tileY * MAP_W + b.tileX;
    if (!v.explored[i] && b.faction !== v.player) continue;
    ctx.fillStyle = TEAM[b.faction].primary;
    ctx.fillRect(b.tileX * sx, b.tileY * sy, b.tw * sx, b.th * sy);
  }
  for (const u of v.units) {
    if (u.state === "dead") continue;
    if (u.faction !== v.player) {
      const tx = Math.max(0, Math.min(MAP_W - 1, (u.x / TILE) | 0));
      const ty = Math.max(0, Math.min(MAP_H - 1, (u.y / TILE) | 0));
      if (v.vis[ty * MAP_W + tx] !== 2 || !detectable(u,v.player,v.units,v.terrain)) continue;
    }
    ctx.fillStyle = u.faction === v.player ? "#fff" : TEAM[u.faction].light;
    ctx.fillRect((u.x / TILE) * sx - 1, (u.y / TILE) * sy - 1, 2.4, 2.4);
  }
  ctx.fillStyle=v.ritual.contested?'#ff775f':v.ritual.owner?TEAM[v.ritual.owner].light:'#f3d8a1';
  ctx.beginPath();ctx.arc(RELIC.x/TILE*sx,RELIC.y/TILE*sy,5,0,TAU);ctx.fill();
  ctx.strokeStyle = "#f2e6a0";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    (v.cam.x / TILE) * sx,
    (v.cam.y / TILE) * sy,
    (viewW / v.cam.zoom / TILE) * sx,
    (viewH / v.cam.zoom / TILE) * sy,
  );
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

function drawRelic(ctx: CanvasRenderingContext2D,v:RenderView) {
  ctx.save();ctx.translate(RELIC.x,RELIC.y);
  const col=v.ritual.contested?'#ed7265':v.ritual.owner?TEAM[v.ritual.owner].light:'#c8a98c';
  ctx.strokeStyle=col;ctx.fillStyle='#3d20214a';ctx.lineWidth=2;ctx.setLineDash([8,8]);
  ctx.beginPath();ctx.arc(0,0,RELIC.radius,0,TAU);ctx.fill();ctx.stroke();ctx.setLineDash([]);
  const img=sprite('relic');if(img) {ctx.imageSmoothingEnabled=false;ctx.drawImage(img,-48,-60,96,96);}
  ctx.font='bold 12px serif';ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText('THE DEAD GOD',0,48);
  ctx.font='10px sans-serif';ctx.fillText(v.ritual.contested?'CONTESTED — RITUALS PAUSED':v.ritual.owner?(v.empowered[v.ritual.owner]?'AN AWAKENED HOST HOLDS THE REMAINS':'RITUAL IN PROGRESS'):'BRING SOLDIERS TO CLAIM',0,64);
  ctx.restore();
}
