import { BUILDINGS } from "./buildings";
import type { BuildingId } from "./types";

export type RoomRect = { x: number; y: number; w: number; h: number };
export type RoomPoint = { x: number; y: number };
type FurnitureKind = "desk" | "map" | "workbench" | "sewing" | "radio" | "cabinet" | "shelf" | "bed" | "chair" | "crate";
type Furniture = RoomRect & { kind: FurnitureKind; angle?: number };

const LAYOUTS: Record<BuildingId, Furniture[]> = {
  hq: [
    { kind: "map", x: 105, y: 306, w: 176, h: 78 },
    { kind: "chair", x: 134, y: 400, w: 29, h: 30 },
    { kind: "chair", x: 230, y: 263, w: 28, h: 30 },
    { kind: "cabinet", x: 72, y: 130, w: 167, h: 53 },
    { kind: "bed", x: 744, y: 306, w: 68, h: 140 },
    { kind: "desk", x: 676, y: 159, w: 165, h: 66 },
    { kind: "chair", x: 712, y: 244, w: 30, h: 29 },
    { kind: "crate", x: 856, y: 412, w: 42, h: 38 },
  ],
  weapons: [
    { kind: "workbench", x: 82, y: 292, w: 194, h: 77 },
    { kind: "chair", x: 155, y: 387, w: 28, h: 28 },
    { kind: "shelf", x: 58, y: 137, w: 198, h: 73 },
    { kind: "cabinet", x: 696, y: 134, w: 181, h: 64 },
    { kind: "crate", x: 745, y: 276, w: 61, h: 45 },
    { kind: "crate", x: 826, y: 283, w: 57, h: 51 },
    { kind: "workbench", x: 695, y: 381, w: 182, h: 66 },
    { kind: "crate", x: 230, y: 447, w: 45, h: 42 },
  ],
  equipment: [
    { kind: "sewing", x: 99, y: 312, w: 173, h: 77 },
    { kind: "chair", x: 194, y: 410, w: 29, h: 30 },
    { kind: "cabinet", x: 61, y: 136, w: 183, h: 63 },
    { kind: "bed", x: 770, y: 327, w: 77, h: 141 },
    { kind: "shelf", x: 681, y: 145, w: 192, h: 77 },
    { kind: "crate", x: 681, y: 440, w: 42, h: 39 },
  ],
  inventory: [
    { kind: "shelf", x: 65, y: 143, w: 201, h: 80 },
    { kind: "shelf", x: 64, y: 293, w: 131, h: 130 },
    { kind: "crate", x: 243, y: 303, w: 51, h: 44 },
    { kind: "crate", x: 248, y: 367, w: 57, h: 46 },
    { kind: "cabinet", x: 686, y: 140, w: 192, h: 65 },
    { kind: "shelf", x: 733, y: 300, w: 146, h: 142 },
    { kind: "desk", x: 681, y: 454, w: 179, h: 45 },
    { kind: "bed", x: 238, y: 437, w: 63, h: 88 },
  ],
  radio: [
    { kind: "radio", x: 73, y: 290, w: 207, h: 84 },
    { kind: "chair", x: 161, y: 394, w: 31, h: 30 },
    { kind: "cabinet", x: 75, y: 139, w: 183, h: 75 },
    { kind: "radio", x: 690, y: 145, w: 186, h: 68 },
    { kind: "bed", x: 778, y: 329, w: 69, h: 138 },
    { kind: "desk", x: 650, y: 385, w: 89, h: 58 },
    { kind: "crate", x: 257, y: 439, w: 43, h: 39 },
  ],
};

function rng(seed: number) { const n = Math.sin(seed * 12.9898) * 43758.5453; return n - Math.floor(n); }

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#141b17";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function paper(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number, large = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rng(seed) - 0.5) * 0.9);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(2, 2, large ? 29 : 12, large ? 18 : 17);
  ctx.fillStyle = seed % 2 ? "#a29f83" : "#b5af92";
  ctx.fillRect(0, 0, large ? 29 : 12, large ? 18 : 17);
  ctx.fillStyle = "#726f58";
  for (let i = 0; i < 3; i++) ctx.fillRect(2, 4 + i * 3, (large ? 20 : 7) - i, 0.7);
  ctx.restore();
}

function bottle(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = "#151f19"; ctx.fillRect(-2, -7, 6, 15);
  ctx.fillStyle = "#426347"; ctx.fillRect(-2, -4, 5, 11); ctx.fillRect(-1, -9, 3, 6);
  ctx.fillStyle = "#9b9a73"; ctx.fillRect(-2, 0, 5, 4);
  ctx.fillStyle = "#8b9a77"; ctx.fillRect(-1, -4, 1, 3); ctx.fillRect(-1, -9, 3, 1);
  ctx.restore();
}

function rifleOnTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  box(ctx, x, y, 15, 7, "#704c31");
  box(ctx, x + 14, y - 1, 25, 7, "#404e42");
  box(ctx, x + 38, y + 1, 31, 3, "#909681");
  box(ctx, x + 28, y + 6, 6, 10, "#323e32");
  ctx.fillStyle = "#858f7b"; ctx.fillRect(x + 19, y, 12, 1);
}

function drawFurniture(ctx: CanvasRenderingContext2D, f: Furniture, id: BuildingId) {
  const { x, y, w, h, kind } = f;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + 6, y + 8, w + 2, h + 1);
  if (kind === "chair") {
    box(ctx, x + 2, y, w - 4, h, "#292e28");
    box(ctx, x + 4, y + 6, w - 8, h - 9, "#615d43");
    box(ctx, x, y, w, 7, "#777059");
    ctx.strokeStyle = "#a09679"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 7, y + 8); ctx.lineTo(x + w - 8, y + h - 5); ctx.stroke();
    return;
  }
  if (kind === "bed") {
    box(ctx, x, y, w, h, "#303b36");
    box(ctx, x + 4, y + 5, w - 8, h - 10, "#787969");
    box(ctx, x + 8, y + 10, w - 16, 23, "#aea993");
    ctx.fillStyle = "#565f4a"; ctx.fillRect(x + 5, y + 43, w - 10, h - 47);
    ctx.strokeStyle = "#394534"; ctx.lineWidth = 1;
    for (let j = 0; j < 6; j++) { ctx.beginPath(); ctx.moveTo(x + 7, y + 51 + j * 11); ctx.lineTo(x + w - 7, y + 54 + j * 11); ctx.stroke(); }
    ctx.fillStyle = "#353c32"; ctx.fillRect(x + w - 23, y + h - 23, 14, 7);
    ctx.fillStyle = "#819085"; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3);
    return;
  }
  if (kind === "cabinet") {
    box(ctx, x, y, w, h, "#49584d");
    const count = Math.floor(w / 36);
    for (let i = 0; i < count; i++) {
      const dx = x + 3 + i * ((w - 6) / count);
      box(ctx, dx, y + 3, (w - 6) / count - 2, h - 6, i % 2 ? "#4d5a4b" : "#3c4b40");
      ctx.fillStyle = "#96a18c"; ctx.fillRect(dx + 5, y + h * 0.6, 2, 8);
      for (let slit = 0; slit < 4; slit++) { ctx.fillStyle = "#242e27"; ctx.fillRect(dx + 7, y + 8 + slit * 3, 18, 1); }
      ctx.fillStyle = "#85866e"; ctx.fillRect(dx + 10, y + h - 15, 13, 5);
    }
    return;
  }
  if (kind === "shelf") {
    box(ctx, x, y, w, h, "#514733");
    for (let row = 0; row < Math.floor(h / 25); row++) {
      ctx.fillStyle = "#212b22"; ctx.fillRect(x + 5, y + 5 + row * 25, w - 10, 20);
      for (let n = 0; n < Math.floor(w / 27); n++) {
        const color = ["#6c6947", "#60513c", "#445741", "#6b6757"][n % 4];
        box(ctx, x + 9 + n * 26, y + 8 + row * 25, 18 + rng(n + row) * 4, 15, color);
        ctx.fillStyle = "#a6a47c"; ctx.fillRect(x + 12 + n * 26, y + 12 + row * 25, 8, 4);
      }
      ctx.fillStyle = "#8c7d59"; ctx.fillRect(x + 2, y + 23 + row * 25, w - 4, 3);
    }
    return;
  }
  if (kind === "crate") {
    box(ctx, x, y, w, h, "#706046");
    ctx.strokeStyle = "#352a1a"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 5); ctx.lineTo(x + w - 5, y + h - 5); ctx.moveTo(x + w - 5, y + 5); ctx.lineTo(x + 4, y + h - 5); ctx.stroke();
    ctx.fillStyle = "#a79465"; ctx.fillRect(x + w * 0.25, y + h * 0.4, w * 0.5, 7);
    return;
  }
  box(ctx, x, y, w, h, "#302d23");
  box(ctx, x + 2, y + 2, w - 4, h - 7, kind === "workbench" ? "#647167" : "#766248");
  ctx.strokeStyle = "rgba(28,27,19,0.24)"; ctx.lineWidth = 1;
  for (let line = 10; line < h - 4; line += 11) { ctx.beginPath(); ctx.moveTo(x + 4, y + line); ctx.lineTo(x + w - 4, y + line + 1); ctx.stroke(); }
  if (kind === "map") {
    box(ctx, x + 16, y + 12, w - 40, h - 26, "#959373");
    ctx.strokeStyle = "#5b6851"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 22, y + 26); ctx.lineTo(x + 100, y + 48); ctx.lineTo(x + 121, y + 18); ctx.moveTo(x + 55, y + 16); ctx.lineTo(x + 65, y + 60); ctx.stroke();
    ctx.fillStyle = "#962f21"; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + 26 + i * 23, y + 20 + rng(i) * 32, 2, 0, Math.PI * 2); ctx.fill(); }
    bottle(ctx, x + w - 15, y + 19, 0.2);
  } else if (kind === "workbench") {
    rifleOnTable(ctx, x + 18, y + 18);
    rifleOnTable(ctx, x + w * 0.47, y + h * 0.57);
    box(ctx, x + w - 36, y + 9, 23, 17, "#7c774e");
    ctx.fillStyle = "#b2a063"; for (let j = 0; j < 8; j++) ctx.fillRect(x + 17 + j * 5, y + h - 22, 3, 7);
    ctx.strokeStyle = "#a7b0a1"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 99, y + 13); ctx.lineTo(x + 113, y + 28); ctx.stroke();
  } else if (kind === "radio") {
    box(ctx, x + 12, y + 12, 74, 43, "#293a33");
    box(ctx, x + 18, y + 17, 39, 19, "#69936c");
    ctx.strokeStyle = "#a8c28b"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 21, y + 29); ctx.lineTo(x + 27, y + 23); ctx.lineTo(x + 31, y + 32); ctx.lineTo(x + 39, y + 21); ctx.lineTo(x + 52, y + 29); ctx.stroke();
    for (let j = 0; j < 3; j++) { ctx.fillStyle = "#b0aa77"; ctx.beginPath(); ctx.arc(x + 66 + j * 5, y + 45, 2, 0, Math.PI * 2); ctx.fill(); }
    box(ctx, x + 96, y + 13, 44, 37, "#3d4940");
    for (const offset of [106, 129]) { ctx.fillStyle = "#8a9386"; ctx.beginPath(); ctx.arc(x + offset, y + 26, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#2b352c"; ctx.beginPath(); ctx.arc(x + offset, y + 26, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = "#17231c"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 86, y + 43); ctx.bezierCurveTo(x + 125, y + 64, x + 83, y + 64, x + 107, y + 48); ctx.stroke();
    if (w > 160) paper(ctx, x + w - 32, y + 31, 41);
  } else if (kind === "sewing") {
    box(ctx, x + 8, y + 7, 70, h - 22, "#526752");
    ctx.strokeStyle = "#9aaa7f"; ctx.lineWidth = 0.8; ctx.strokeRect(x + 16, y + 15, 55, h - 40);
    box(ctx, x + 94, y + 16, 44, 26, "#1f2b28");
    box(ctx, x + 100, y + 21, 27, 8, "#658076");
    ctx.fillStyle = "#a29c77"; ctx.fillRect(x + 111, y + 8, 7, 8);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = ["#875549", "#82905a", "#a19173"][i]; ctx.fillRect(x + 98 + i * 11, y + h - 23, 6, 9); }
  } else {
    paper(ctx, x + 12, y + 14, 3, true);
    paper(ctx, x + 38, y + 16, 7);
    bottle(ctx, x + w - 16, y + 21, 0);
    ctx.fillStyle = "#b5ac8b"; ctx.beginPath(); ctx.arc(x + w - 35, y + 37, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#322a1f"; ctx.beginPath(); ctx.arc(x + w - 35, y + 37, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (id === "weapons" && kind === "desk") rifleOnTable(ctx, x + 58, y + 18);
}

export function createInterior(id: BuildingId) {
  const info = BUILDINGS[id];
  const canvas = document.createElement("canvas");
  canvas.width = 960; canvas.height = 560;
  const ctx = canvas.getContext("2d")!;
  const seed = id.length * 31;
  for (let y = 0; y < 560; y += 32) for (let x = 0; x < 960; x += 32) {
    ctx.fillStyle = info.floor; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = `rgba(8,13,10,${rng(x + y * 2 + seed) * 0.14})`; ctx.fillRect(x, y, 32, 32);
    ctx.strokeStyle = "rgba(12,19,14,0.27)"; ctx.lineWidth = 0.8; ctx.strokeRect(x, y, 32, 32);
  }
  // Damage and debris are deterministic, so a room never reshuffles while moving.
  for (let i = 0; i < 36; i++) {
    const x = 43 + rng(seed + i * 4.4) * 863;
    const y = 120 + rng(seed + i * 7.9) * 411;
    ctx.strokeStyle = i % 2 ? "#252a24" : "#282e28"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y - 9); ctx.lineTo(x + 24, y - 2); ctx.lineTo(x + 43, y - 7); ctx.moveTo(x + 18, y - 9); ctx.lineTo(x + 21, y - 24); ctx.stroke();
    ctx.fillStyle = i % 6 === 0 ? "rgba(84,24,19,0.48)" : "rgba(10,17,13,0.16)";
    ctx.beginPath(); ctx.ellipse(x, y, 10 + rng(i) * 25, 5 + rng(i + 1) * 17, i, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = 62 + rng(i * 9.7 + seed) * 820;
    const y = 264 + rng(i * 3.9 + seed) * 250;
    if (i % 3 === 0) bottle(ctx, x, y, i * 0.6);
    else paper(ctx, x, y, seed + i);
  }
  ctx.fillStyle = info.wall; ctx.fillRect(0, 0, 960, 98);
  ctx.fillStyle = "#1d2821"; ctx.fillRect(0, 93, 960, 9); ctx.fillRect(0, 94, 21, 466); ctx.fillRect(939, 94, 21, 466);
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(21, 98, 918, 11); ctx.fillRect(21, 98, 12, 462);
  for (let i = 0; i < 5; i++) {
    const x = 72 + i * 174;
    box(ctx, x, 21, 125, 52, i % 2 ? "#424d3d" : "#494b3a");
    box(ctx, x + 5, 27, 115, 38, "#29372d");
    for (let p = 0; p < 5; p++) box(ctx, x + 12 + p * 20, 39, 15, 18, ["#736047", "#6d7452", "#455e4a"][p % 3]);
  }
  for (const f of LAYOUTS[id]) drawFurniture(ctx, f, id);
  box(ctx, 322, 195, 316, 42, "#5c4b32");
  ctx.fillStyle = "#85704a"; ctx.fillRect(323, 196, 314, 4);
  paper(ctx, 354, 204, 13, true);
  bottle(ctx, 598, 211, -0.1);
  box(ctx, 536, 205, 36, 16, "#364339");
  if (id === "weapons") rifleOnTable(ctx, 416, 203);
  if (id === "equipment") box(ctx, 420, 202, 51, 25, "#667b57");
  ctx.fillStyle = "#384032"; ctx.fillRect(412, 494, 136, 51);
  ctx.strokeStyle = "#6b6b50"; ctx.lineWidth = 1; ctx.strokeRect(417, 499, 126, 40);
  ctx.fillStyle = "#b2ad82"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("EXIT", 480, 527);
  const solids = [...LAYOUTS[id].map(({ x, y, w, h }) => ({ x, y, w, h })), { x: 322, y: 195, w: 316, h: 42 }];
  return { canvas, solids };
}

export function pushFromFurniture(point: RoomPoint, solids: RoomRect[], radius = 12) {
  for (const r of solids) {
    const x = Math.max(r.x, Math.min(point.x, r.x + r.w));
    const y = Math.max(r.y, Math.min(point.y, r.y + r.h));
    const dx = point.x - x, dy = point.y - y, distance = Math.hypot(dx, dy);
    if (distance >= radius) continue;
    if (distance > 0.001) { point.x = x + dx / distance * radius; point.y = y + dy / distance * radius; }
    else {
      const distances = [point.x - r.x, r.x + r.w - point.x, point.y - r.y, r.y + r.h - point.y];
      const nearest = distances.indexOf(Math.min(...distances));
      if (nearest === 0) point.x = r.x - radius;
      else if (nearest === 1) point.x = r.x + r.w + radius;
      else if (nearest === 2) point.y = r.y - radius;
      else point.y = r.y + r.h + radius;
    }
  }
}

/** Grid navigation keeps the route to the clerk clear even after furnishing a room. */
export function roomRoute(from: RoomPoint, target: RoomPoint, solids: RoomRect[]): RoomPoint[] {
  const cell = 20, cols = 48, rows = 28;
  const walkable = (x: number, y: number) => x >= 40 && x <= 920 && y >= 130 && y <= 530
    && !solids.some((r) => x > r.x - 15 && x < r.x + r.w + 15 && y > r.y - 15 && y < r.y + r.h + 15);
  const center = (i: number) => ({ x: i % cols * cell + cell / 2, y: Math.floor(i / cols) * cell + cell / 2 });
  const nearest = (p: RoomPoint) => {
    let chosen = -1, distance = Infinity;
    for (let i = 0; i < cols * rows; i++) {
      const c = center(i);
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < distance && walkable(c.x, c.y)) { chosen = i; distance = d; }
    }
    return chosen;
  };
  const start = nearest(from), goal = nearest(target);
  if (start < 0 || goal < 0) return [];
  const queue = [start], previous = new Int32Array(cols * rows).fill(-1);
  previous[start] = start;
  let found = start === goal;
  for (let head = 0; head < queue.length && !found; head++) {
    const current = queue[head], x = current % cols, y = Math.floor(current / cols);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const next = ny * cols + nx, p = center(next);
      if (previous[next] >= 0 || !walkable(p.x, p.y)) continue;
      previous[next] = current;
      queue.push(next);
      if (next === goal) { found = true; break; }
    }
  }
  if (!found) return [];
  const path: RoomPoint[] = [];
  for (let i = goal; i !== start; i = previous[i]) path.unshift(center(i));
  if (!path.length) path.push(center(start));
  if (walkable(target.x, target.y)) path.push(target);
  return path;
}