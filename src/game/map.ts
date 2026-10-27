import { MAP_H, MAP_W, TERRAIN, TILE } from "./types";
import type { Decoration, GoldMine, Tree } from "./types";

export interface GameMap {
  terrain: Uint8Array;
  blocked: Uint8Array;
  trees: Tree[];
  mines: GoldMine[];
  decorations: Decoration[];
  playerStart: { x: number; y: number };
  thirdStart: { x: number; y: number };
  aiStart: { x: number; y: number };
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function idx(x: number, y: number) {
  return y * MAP_W + x;
}

function inb(x: number, y: number) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

export function generateMap(seed: number): GameMap {
  const rnd = mulberry32(seed);
  const terrain = new Uint8Array(MAP_W * MAP_H);
  const blocked = new Uint8Array(MAP_W * MAP_H);
  const trees: Tree[] = [];
  const mines: GoldMine[] = [];
  const decorations: Decoration[] = [];
  let nextId = 1;

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      terrain[idx(x, y)] = TERRAIN.GRASS;
    }
  }

  const playerStart = { x: 7, y: MAP_H - 15 };
  const aiStart = { x: MAP_W - 15, y: 7 };

  const thirdStart = { x: 7, y: 7 };

  // Dirt patches
  for (let i = 0; i < 28; i++) {
    const cx = 4 + ((rnd() * (MAP_W - 8)) | 0);
    const cy = 4 + ((rnd() * (MAP_H - 8)) | 0);
    const r = 1.5 + rnd() * 3;
    stamp(terrain, cx, cy, r, TERRAIN.DIRT, rnd, 0.55);
  }

  // Lakes
  const lakes = [
    { x: MAP_W * 0.45, y: MAP_H * 0.18, r: 5 },
    { x: MAP_W * 0.62, y: MAP_H * 0.72, r: 6 },
    { x: MAP_W * 0.22, y: MAP_H * 0.42, r: 4.5 },
    { x: MAP_W * 0.78, y: MAP_H * 0.38, r: 4 },
  ];
  for (const l of lakes) {
    stamp(terrain, l.x, l.y, l.r, TERRAIN.WATER, rnd, 0.72);
  }

  // Winding stream with fords
  let sx = (MAP_W * 0.32) | 0;
  let sy = 2;
  while (sy < MAP_H - 2) {
    const w = 1 + ((rnd() * 2) | 0);
    for (let dx = -w; dx <= w; dx++) {
      if (inb(sx + dx, sy)) terrain[idx(sx + dx, sy)] = TERRAIN.WATER;
    }
    sy += 1;
    sx += ((rnd() * 3) | 0) - 1;
    sx = Math.max(18, Math.min(MAP_W - 18, sx));
  }
  // Fords
  for (const fy of [18, 36, 52]) {
    for (let x = 0; x < MAP_W; x++) {
      if (terrain[idx(x, fy)] === TERRAIN.WATER) {
        terrain[idx(x, fy)] = TERRAIN.DIRT;
        if (inb(x, fy - 1) && terrain[idx(x, fy - 1)] === TERRAIN.WATER)
          terrain[idx(x, fy - 1)] = TERRAIN.DIRT;
      }
    }
  }

  // Rock clusters
  for (let i = 0; i < 18; i++) {
    const cx = 3 + ((rnd() * (MAP_W - 6)) | 0);
    const cy = 3 + ((rnd() * (MAP_H - 6)) | 0);
    if (nearStart(cx, cy, playerStart, aiStart, 12)) continue;
    stamp(terrain, cx, cy, 1.2 + rnd() * 1.6, TERRAIN.ROCK, rnd, 0.7);
  }

  function clearStart(s: { x: number; y: number }, r: number) {
    for (let y = s.y - 1; y < s.y + r; y++) {
      for (let x = s.x - 1; x < s.x + r; x++) {
        if (!inb(x, y)) continue;
        terrain[idx(x, y)] = TERRAIN.GRASS;
      }
    }
  }
  clearStart(playerStart, 14);
  clearStart(aiStart, 14);
  clearStart(thirdStart, 14);

  // Forests
  const forests = [
    { x: 9, y: 20, r: 4 },
    { x: playerStart.x + 2, y: playerStart.y + 10, r: 5 },
    { x: playerStart.x + 14, y: playerStart.y + 6, r: 4 },
    { x: aiStart.x - 2, y: aiStart.y + 12, r: 5 },
    { x: aiStart.x - 10, y: aiStart.y + 2, r: 4 },
    { x: MAP_W * 0.5, y: MAP_H * 0.5, r: 7 },
    { x: MAP_W * 0.3, y: MAP_H * 0.62, r: 5.5 },
    { x: MAP_W * 0.68, y: MAP_H * 0.28, r: 5 },
    { x: MAP_W * 0.18, y: MAP_H * 0.22, r: 4 },
    { x: MAP_W * 0.82, y: MAP_H * 0.78, r: 4.5 },
    { x: MAP_W * 0.5, y: MAP_H * 0.82, r: 4 },
    { x: MAP_W * 0.4, y: MAP_H * 0.35, r: 4 },
  ];
  for (const f of forests) {
    stampForest(terrain, f.x, f.y, f.r, rnd);
  }
  clearStart(playerStart, 11);
  clearStart(aiStart, 11);
  clearStart(thirdStart, 11);

  // Gold mines
  const mineSpots = [
    { x: 18, y: 8, g: 2200 },
    { x: playerStart.x + 10, y: playerStart.y + 1, g: 2200 },
    { x: aiStart.x - 3, y: aiStart.y + 10, g: 2200 },
    { x: (MAP_W * 0.38) | 0, y: (MAP_H * 0.48) | 0, g: 1400 },
    { x: (MAP_W * 0.58) | 0, y: (MAP_H * 0.42) | 0, g: 1400 },
    { x: (MAP_W * 0.28) | 0, y: (MAP_H * 0.22) | 0, g: 1100 },
    { x: (MAP_W * 0.7) | 0, y: (MAP_H * 0.7) | 0, g: 1100 },
  ];
  for (const m of mineSpots) {
    placeMine(m.x, m.y, m.g);
  }

  function placeMine(tx: number, ty: number, gold: number) {
    tx = Math.max(1, Math.min(MAP_W - 4, tx));
    ty = Math.max(1, Math.min(MAP_H - 4, ty));
    for (let y = ty; y < ty + 3; y++) {
      for (let x = tx; x < tx + 3; x++) {
        terrain[idx(x, y)] = TERRAIN.GOLD;
        blocked[idx(x, y)] = 1;
      }
    }
    mines.push({
      id: nextId++,
      kind: "mine",
      tileX: tx,
      tileY: ty,
      tw: 3,
      th: 3,
      x: (tx + 1.5) * TILE,
      y: (ty + 1.5) * TILE,
      gold,
    });
  }

  // Wide approaches, a central clearing, and narrow forest flanking paths.
  // Carve after resources are placed, preserving mine footprints.
  function road(ax: number, ay: number, bx: number, by: number, width: number) {
    const steps = Math.ceil(Math.hypot(bx-ax, by-ay) * 2);
    for (let i=0; i<=steps; i++) {
      const cx=Math.round(ax+(bx-ax)*i/steps), cy=Math.round(ay+(by-ay)*i/steps);
      for(let dy=-width;dy<=width;dy++) for(let dx=-width;dx<=width;dx++) {
        const x=cx+dx,y=cy+dy;
        if(inb(x,y) && terrain[idx(x,y)] !== TERRAIN.GOLD) { terrain[idx(x,y)]=TERRAIN.DIRT; blocked[idx(x,y)]=0; }
      }
    }
  }
  for (const start of [playerStart, aiStart, thirdStart]) road(start.x+3,start.y+7,36,36,1);
  for(let y=30;y<=42;y++) for(let x=30;x<=42;x++) {
    if(Math.hypot(x-36,y-36)<6 && terrain[idx(x,y)] !== TERRAIN.GOLD) { terrain[idx(x,y)]=TERRAIN.DIRT; blocked[idx(x,y)]=0; }
  }
  road(12,26,26,44,0); road(44,18,54,38,0);
  for(const [x,y] of [[30,29],[41,29],[30,42],[43,42]]) {
    decorations.push({x:(x+.5)*TILE,y:(y+.5)*TILE,type:'ruin',v:rnd()});
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      if(terrain[idx(x+dx,y+dy)] !== TERRAIN.GOLD) { terrain[idx(x+dx,y+dy)]=TERRAIN.DIRT; blocked[idx(x+dx,y+dy)]=0; }
    }
  }

  // Trees from forest tiles
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = terrain[idx(x, y)];
      if (t === TERRAIN.WATER || t === TERRAIN.ROCK || t === TERRAIN.GOLD) {
        blocked[idx(x, y)] = 1;
      }
      if (t === TERRAIN.FOREST) {
        blocked[idx(x, y)] = 1;
        trees.push({
          id: nextId++,
          kind: "tree",
          tileX: x,
          tileY: y,
          x: (x + 0.5) * TILE + (rnd() - 0.5) * 6,
          y: (y + 0.5) * TILE + (rnd() - 0.5) * 6,
          lumber: 40 + ((rnd() * 30) | 0),
          variant: (rnd() * 4) | 0,
        });
      }
      if (t === TERRAIN.GRASS && rnd() < 0.045 && !nearStart(x, y, playerStart, aiStart, 8)) {
        decorations.push({
          x: (x + 0.5) * TILE,
          y: (y + 0.5) * TILE,
          type: rnd() < 0.7 ? "flower" : "rock",
          v: rnd(),
        });
      }
    }
  }

  return {
    terrain,
    blocked,
    trees,
    mines,
    decorations,
    playerStart,
    aiStart,
    thirdStart,
  };
}

function nearStart(
  x: number,
  y: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: number,
) {
  return (
    (x >= a.x - 1 && x <= a.x + r && y >= a.y - 1 && y <= a.y + r) ||
    (x >= b.x - 1 && x <= b.x + r && y >= b.y - 1 && y <= b.y + r)
  );
}

function stamp(
  terrain: Uint8Array,
  cx: number,
  cy: number,
  r: number,
  type: number,
  rnd: () => number,
  density: number,
) {
  const R = Math.ceil(r) + 1;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const tx = (cx + x) | 0;
      const ty = (cy + y) | 0;
      if (!inb(tx, ty)) continue;
      const d = Math.hypot(x, y);
      if (d < r - 0.4 && rnd() < density + 0.2) terrain[ty * MAP_W + tx] = type;
      else if (d < r + 0.6 && rnd() < density * 0.5) terrain[ty * MAP_W + tx] = type;
    }
  }
}

function stampForest(
  terrain: Uint8Array,
  cx: number,
  cy: number,
  r: number,
  rnd: () => number,
) {
  const R = Math.ceil(r) + 2;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const tx = (cx + x) | 0;
      const ty = (cy + y) | 0;
      if (!inb(tx, ty)) continue;
      const t = terrain[ty * MAP_W + tx];
      if (t === TERRAIN.WATER || t === TERRAIN.GOLD) continue;
      const d = Math.hypot(x, y) + (rnd() - 0.5) * 1.8;
      if (d < r) terrain[ty * MAP_W + tx] = TERRAIN.FOREST;
    }
  }
}

export { mulberry32 };
