import { MAP_H, MAP_W } from "./types";

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.414],
  [1, -1, 1.414],
  [-1, 1, 1.414],
  [-1, -1, 1.414],
];

function clampTile(v: number, max: number) {
  return v < 0 ? 0 : v >= max ? max - 1 : v | 0;
}

const MAP_SIZE = MAP_W * MAP_H;
const bufCame = new Int32Array(MAP_SIZE);
const bufGScore = new Float32Array(MAP_SIZE);
const bufClosed = new Uint8Array(MAP_SIZE);

export function astar(
  blocked: Uint8Array,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
): { x: number; y: number }[] {
  sx = clampTile(sx, MAP_W);
  sy = clampTile(sy, MAP_H);
  gx = clampTile(gx, MAP_W);
  gy = clampTile(gy, MAP_H);

  if (sx === gx && sy === gy) return [];

  const w = MAP_W;
  const h = MAP_H;
  const came = bufCame;
  const gScore = bufGScore;
  const closed = bufClosed;
  came.fill(-1);
  gScore.fill(1e9);
  closed.fill(0);
  const open: { id: number; score: number }[] = [];
  function push(id: number, score: number) {
    let i=open.length;open.push({id,score});
    while(i>0) {const parent=(i-1)>>1;if(open[parent].score<=score) break;open[i]=open[parent];i=parent;}
    open[i]={id,score};
  }
  function pop() {
    const first=open[0],last=open.pop()!;
    if(open.length) {
      let i=0;
      while(i*2+1<open.length) {let child=i*2+1;if(child+1<open.length&&open[child+1].score<open[child].score) child++;if(open[child].score>=last.score) break;open[i]=open[child];i=child;}
      open[i]=last;
    }
    return first.id;
  }

  const si = sy * w + sx;
  const gi = gy * w + gx;
  gScore[si] = 0;
  push(si,0);

  let found = false;
  let bestNode = si;
  let bestH = Math.hypot(gx - sx, gy - sy);
  let guard = 0;

  while (open.length && guard++ < 6000) {
    const current = pop();

    if (closed[current]) continue;
    closed[current] = 1;

    const cx = current % w;
    const cy = (current / w) | 0;
    const ch = Math.hypot(gx - cx, gy - cy);
    if (ch < bestH) {
      bestH = ch;
      bestNode = current;
    }
    if (current === gi) {
      found = true;
      bestNode = current;
      break;
    }

    for (let d = 0; d < 8; d++) {
      const dx = DIRS[d][0];
      const dy = DIRS[d][1];
      const c = DIRS[d][2];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (dx && dy) {
        if (blocked[cy * w + nx] || blocked[ny * w + cx]) continue;
      }
      const ni = ny * w + nx;
      if (closed[ni] || blocked[ni]) continue;
      const ng = gScore[current] + c;
      if (ng < gScore[ni]) {
        gScore[ni] = ng;
        came[ni] = current;
        push(ni, ng + Math.hypot(gx-nx,gy-ny));
      }
    }
  }

  const end = found ? gi : bestNode;
  if (end === si) return [];
  const path: { x: number; y: number }[] = [];
  let cur = end;
  let hops = 0;
  while (cur !== si && cur !== -1 && hops++ < 2000) {
    path.push({ x: cur % w, y: (cur / w) | 0 });
    cur = came[cur];
  }
  path.reverse();
  return path;
}

export function nearestWalkable(
  blocked: Uint8Array,
  tx: number,
  ty: number,
  fromX: number,
  fromY: number,
): { x: number; y: number } {
  tx = clampTile(tx, MAP_W);
  ty = clampTile(ty, MAP_H);
  if (!blocked[ty * MAP_W + tx]) return { x: tx, y: ty };
  let best = { x: tx, y: ty };
  let bestD = 1e9;
  for (let r = 1; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (blocked[y * MAP_W + x]) continue;
        const d = Math.hypot(x + 0.5 - fromX, y + 0.5 - fromY);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (bestD < 1e8) return best;
  }
  return best;
}

export function perimeterTile(
  blocked: Uint8Array,
  tileX: number,
  tileY: number,
  tw: number,
  th: number,
  fromX: number,
  fromY: number,
): { x: number; y: number } {
  let best = { x: tileX, y: tileY };
  let bestD = 1e9;
  for (let y = tileY - 1; y <= tileY + th; y++) {
    for (let x = tileX - 1; x <= tileX + tw; x++) {
      const edge =
        x === tileX - 1 ||
        x === tileX + tw ||
        y === tileY - 1 ||
        y === tileY + th;
      if (!edge) continue;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      if (blocked[y * MAP_W + x]) continue;
      const d = Math.hypot(x + 0.5 - fromX, y + 0.5 - fromY);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  if (bestD < 1e8) return best;
  return nearestWalkable(blocked, tileX, tileY, fromX, fromY);
}
