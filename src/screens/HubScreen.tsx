import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { EQUIPMENT, LEVELS } from "../game/data";
import { store, useSave } from "../game/save";
import { useIsMobile } from "../game/device";
import TouchStick from "../game/TouchStick";
import { profiles } from "../game/profiles";
import { sfx } from "../game/audio";
import DialogueScene from "../game/dialogues";
import { NPC_SCRIPTS } from "../game/npcScripts";
import { GameButton, Modal, Panel, Tag, CurrencyChip } from "../game/ui";
import type { BuildingId, Screen } from "../game/types";

// ============================================================
// БАЗА ВЫЖИВШИХ B-7
// Бетонный периметр с колючей проволокой, ворота на север ведут к выбору
// районов. Все службы стоят вокруг центральной площади и смотрят на неё
// дверьми — от костра видно каждый вход.
// ============================================================

const VIEW_W = 960;
const VIEW_H = 560;
const WORLD_W = 1600;
const WORLD_H = 1040;
const WALL = { x: 90, y: 120, w: 1420, h: 860, t: 26 };
const GATE = { x: 800, half: 78 };
const PLAZA = { x: 800, y: 565, r: 150 };

type Rect = { x: number; y: number; w: number; h: number };

interface HubObject {
  id: string;
  kind: "portal" | "npc" | "gate";
  /** центр объекта */
  x: number;
  y: number;
  w: number;
  h: number;
  door?: "top" | "bottom";
  name: string;
  icon: string;
  label: string;
  desc: string;
  building?: BuildingId;
  color?: string;
  body?: string;
  /** id скрипта из NPC_SCRIPTS: кинематографичный диалог с выборами. */
  script?: string;
  dialog?: string[];
}

const HUB_OBJECTS: HubObject[] = [
  { id: "gate", kind: "gate", x: GATE.x, y: WALL.y, w: GATE.half * 2, h: 40, name: "Северные ворота", icon: "🚧", label: "Выбор района для рейда", desc: "выйти в город" },
  { id: "hq", kind: "portal", building: "hq", door: "bottom", x: 470, y: 300, w: 240, h: 140, name: "Штаб", icon: "🗺", label: "Командир Орлова", desc: "войти в штаб", color: "#5c6b52" },
  { id: "gun_shop", kind: "portal", building: "weapons", door: "bottom", x: 1130, y: 300, w: 230, h: 140, name: "Оружейная «Гром»", icon: "🔫", label: "Оружие и патроны", desc: "войти в оружейную", color: "#6e4c36" },
  { id: "radio", kind: "portal", building: "radio", door: "top", x: 400, y: 830, w: 190, h: 120, name: "Радиорубка", icon: "📻", label: "Настройки", desc: "войти в рубку", color: "#534a5c" },
  { id: "inventory", kind: "portal", building: "inventory", door: "top", x: 800, y: 860, w: 270, h: 120, name: "Склад", icon: "🎒", label: "Инвентарь", desc: "войти на склад", color: "#4a545c" },
  { id: "equip_shop", kind: "portal", building: "equipment", door: "top", x: 1200, y: 830, w: 210, h: 120, name: "Ателье Багрова", icon: "🛡", label: "Броня и ранцы", desc: "войти в мастерскую", color: "#4c5c46" },
  {
    id: "npc_commander", kind: "npc", script: "commander", x: 470, y: 400, w: 30, h: 30, name: "Орлова", icon: "🎖", label: "поговорить", desc: "поговорить", body: "#3f4a40",
  },
  {
    id: "npc_gunman", kind: "npc", script: "gunman", x: 1130, y: 400, w: 30, h: 30, name: "Гром", icon: "🔫", label: "поговорить", desc: "поговорить", body: "#4a3a2a",
  },
  {
    id: "npc_armorer", kind: "npc", script: "armorer", x: 1200, y: 720, w: 30, h: 30, name: "Багров", icon: "🛡", label: "поговорить", desc: "поговорить", body: "#3f4a3a",
  },
  {
    id: "npc_medic", kind: "npc", script: "medic", x: 305, y: 610, w: 30, h: 30, name: "Анна", icon: "⚕️", label: "поговорить", desc: "поговорить", body: "#55685c",
  },
  {
    id: "npc_mechanic", kind: "npc", script: "mechanic", x: 1345, y: 630, w: 30, h: 30, name: "Кузя", icon: "🔧", label: "поговорить", desc: "поговорить", body: "#3f4a4a",
  },
  {
    id: "npc_survivor", kind: "npc", script: "survivor", x: 560, y: 640, w: 30, h: 30, name: "Тень", icon: "🕯", label: "поговорить", desc: "поговорить", body: "#4c4438",
  },
];

/** Декор-препятствия (x/y — левый верхний угол). */
const DECOR: (Rect & { kind: "tent" | "med" | "generator" | "container" | "tower" | "crates" | "tank"; color?: string })[] = [
  { kind: "med", x: 128, y: 485, w: 135, h: 96, color: "#5d6a58" },
  { kind: "tent", x: 1335, y: 440, w: 125, h: 82, color: "#655646" },
  { kind: "generator", x: 1385, y: 602, w: 80, h: 54 },
  { kind: "container", x: 1335, y: 700, w: 145, h: 50, color: "#7a4a35" },
  { kind: "tower", x: GATE.x - GATE.half - 58, y: WALL.y + 6, w: 48, h: 48 },
  { kind: "tower", x: GATE.x + GATE.half + 10, y: WALL.y + 6, w: 48, h: 48 },
  { kind: "crates", x: 140, y: 225, w: 96, h: 62 },
  { kind: "tank", x: 150, y: 700, w: 72, h: 72 },
];

/** Фонарные столбы вдоль центральной аллеи и площади. */
const LAMP_POSTS: [number, number][] = [
  [GATE.x - 96, 300],
  [GATE.x + 96, 300],
  [GATE.x - 96, 430],
  [GATE.x + 96, 430],
  [PLAZA.x - 210, PLAZA.y + 130],
  [PLAZA.x + 210, PLAZA.y + 130],
];

/** Кусты и трава, разбросанные по двору вне дорожек. */
const BUSHES: [number, number, number][] = [
  [255, 300, 13], [300, 360, 10], [1240, 250, 12],
  [1150, 200, 9], [255, 905, 12], [1250, 930, 11],
  [640, 905, 10], [980, 905, 12], [150, 610, 11],
  [1455, 300, 10],
];

const CORNER_LIGHTS: [number, number, string][] = [
  [WALL.x + 30, WALL.y + 30, "#e7c55a"],
  [WALL.x + WALL.w - 30, WALL.y + 30, "#b8d36a"],
  [WALL.x + 30, WALL.y + WALL.h - 30, "#d78f56"],
  [WALL.x + WALL.w - 30, WALL.y + WALL.h - 30, "#b8d36a"],
];

const pos = { x: 800, y: 640, vx: 0, vy: 0, face: -Math.PI / 2, walk: 0 };

// Кинематографичный облёт лобби при первом входе. Фокус — мировые координаты,
// радиус — зона подсветки.
interface TourStep { id: string; title: string; text: string; fx: number; fy: number; r: number }
const TOUR_STEPS: TourStep[] = [
  { id: "intro", title: "ЛОББИ B-7", text: "Твоя база. Отсюда — магазины, навыки и рейды. Покажу главное за полминуты.", fx: PLAZA.x, fy: PLAZA.y, r: 150 },
  { id: "gun_shop", title: "ОРУЖЕЙНАЯ «ГРОМ»", text: "Стволы и патроны. Подойди к двери и нажми E.", fx: 1130, fy: 300, r: 130 },
  { id: "equip_shop", title: "АТЕЛЬЕ БАГРОВА", text: "Броня и ранцы. Второй слот оружия — только с рюкзаком.", fx: 1200, fy: 830, r: 120 },
  { id: "inventory", title: "СКЛАД", text: "Твоё снаряжение и улучшения. Здесь же переключаются слоты и броня.", fx: 800, fy: 860, r: 140 },
  { id: "radio", title: "РАДИОРУБКА", text: "Настройки: звук, графика и управление.", fx: 400, fy: 830, r: 115 },
  { id: "gate", title: "СЕВЕРНЫЕ ВОРОТА", text: "Выход в город: выбор района и кнопка «Начать рейд». Кнопка «К воротам» справа ведёт сюда.", fx: GATE.x, fy: WALL.y + 30, r: 120 },
];

function rnd(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function shade(hex: string, k: number) {
  const v = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((v >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((v >> 8) & 255) * k));
  const b = Math.min(255, Math.round((v & 255) * k));
  return `rgb(${r},${g},${b})`;
}

const objRect = (o: HubObject): Rect => ({ x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h });

/** Точка, где игрок стоит перед входом. */
function doorPoint(o: HubObject) {
  if (o.kind === "gate") return { x: GATE.x, y: WALL.y + 34 };
  if (o.kind === "npc") return { x: o.x, y: o.y + 30 };
  return o.door === "top" ? { x: o.x, y: o.y - o.h / 2 - 26 } : { x: o.x, y: o.y + o.h / 2 + 26 };
}

const OBSTACLES: Rect[] = [
  ...HUB_OBJECTS.filter((o) => o.kind === "portal").map(objRect),
  ...DECOR,
];

function segmentHitsRect(ax: number, ay: number, bx: number, by: number, r: Rect) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 12);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (x > r.x - 14 && x < r.x + r.w + 14 && y > r.y - 14 && y < r.y + r.h + 14) return true;
  }
  return false;
}

/** Простая навигация: если путь упирается в здание — идём через площадь. */
function route(fromX: number, fromY: number, toX: number, toY: number) {
  const blocked = OBSTACLES.some((r) => segmentHitsRect(fromX, fromY, toX, toY, r));
  if (!blocked) return [{ x: toX, y: toY }];
  const mid = { x: PLAZA.x, y: PLAZA.y - (toY < PLAZA.y ? 120 : -120) };
  return [mid, { x: toX, y: toY }];
}

// ============================================================
// СТАТИЧНЫЙ ПРЕДРЕНДЕР: грунт, дорога, площадь, дорожки, стена
// ============================================================
function drawGround(ctx: CanvasRenderingContext2D) {
  // Пустырь за стеной
  for (let y = 0; y < WORLD_H; y += 32) {
    for (let x = 0; x < WORLD_W; x += 32) {
      const n = rnd(x * 0.13 + y * 0.37);
      ctx.fillStyle = n > 0.78 ? "#2d3429" : n < 0.2 ? "#1f251f" : "#262d25";
      ctx.fillRect(x, y, 32, 32);
      if (n > 0.92) {
        ctx.strokeStyle = "#3f4834";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 22);
        ctx.lineTo(x + 8, y + 12);
        ctx.moveTo(x + 15, y + 22);
        ctx.lineTo(x + 16, y + 11);
        ctx.stroke();
      }
    }
  }

  // Дорога в город от ворот на север
  ctx.fillStyle = "#34383a";
  ctx.fillRect(GATE.x - 70, 0, 140, WALL.y);
  ctx.fillStyle = "#2a2e2f";
  ctx.fillRect(GATE.x - 82, 0, 12, WALL.y);
  ctx.fillRect(GATE.x + 70, 0, 12, WALL.y);
  ctx.fillStyle = "rgba(202,189,128,0.4)";
  for (let y = 6; y < WALL.y - 20; y += 38) ctx.fillRect(GATE.x - 2, y, 4, 20);
  ctx.fillStyle = "rgba(10,13,11,0.3)";
  ctx.fillRect(GATE.x - 38, 0, 7, WALL.y);
  ctx.fillRect(GATE.x + 30, 0, 7, WALL.y);
  // Брошенная машина у дороги
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(GATE.x + 112, 26, 70, 34);
  ctx.fillStyle = "#4a3f38";
  ctx.fillRect(GATE.x + 106, 20, 70, 32);
  ctx.fillStyle = "#1c2222";
  ctx.fillRect(GATE.x + 124, 24, 26, 24);
  ctx.fillStyle = "rgba(150,50,35,0.55)";
  ctx.fillRect(GATE.x + 106, 22, 14, 12);

  // Бетонная площадка внутри периметра
  ctx.fillStyle = "#43453e";
  ctx.fillRect(WALL.x, WALL.y, WALL.w, WALL.h);
  for (let y = WALL.y; y < WALL.y + WALL.h; y += 64) {
    for (let x = WALL.x; x < WALL.x + WALL.w; x += 64) {
      const n = rnd(x * 0.71 + y * 0.29);
      ctx.fillStyle = n > 0.7 ? "#474941" : n < 0.25 ? "#3f413a" : "#43453e";
      ctx.fillRect(x, y, 64, 64);
      ctx.strokeStyle = "rgba(0,0,0,0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 63, 63);
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.24)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) {
    const x = WALL.x + 20 + rnd(i * 4.1) * (WALL.w - 40);
    const y = WALL.y + 20 + rnd(i * 6.7) * (WALL.h - 40);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd(i) - 0.5) * 44, y + (rnd(i * 2) - 0.5) * 30);
    ctx.lineTo(x + (rnd(i * 3) - 0.5) * 70, y + (rnd(i * 5) - 0.5) * 44);
    ctx.stroke();
  }

  // Центральная аллея от ворот к площади
  ctx.fillStyle = "#383b3c";
  ctx.fillRect(GATE.x - 58, WALL.y, 116, PLAZA.y - PLAZA.r - WALL.y + 30);
  ctx.fillStyle = "rgba(215,195,130,0.35)";
  for (let y = WALL.y + 30; y < PLAZA.y - PLAZA.r; y += 44) ctx.fillRect(GATE.x - 2, y, 4, 22);

  // Дорожки от площади к каждой двери
  ctx.lineCap = "round";
  for (const o of HUB_OBJECTS) {
    if (o.kind !== "portal") continue;
    const d = doorPoint(o);
    ctx.strokeStyle = "#52544b";
    ctx.lineWidth = 50;
    ctx.beginPath();
    ctx.moveTo(PLAZA.x, PLAZA.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  for (const o of HUB_OBJECTS) {
    if (o.kind !== "portal") continue;
    const d = doorPoint(o);
    const len = Math.hypot(d.x - PLAZA.x, d.y - PLAZA.y);
    for (let s = 0; s < len; s += 22) {
      const t = s / len;
      const px = PLAZA.x + (d.x - PLAZA.x) * t;
      const py = PLAZA.y + (d.y - PLAZA.y) * t;
      ctx.beginPath();
      ctx.moveTo(px - 18, py + 18);
      ctx.lineTo(px + 18, py - 18);
      ctx.stroke();
    }
  }
  ctx.lineCap = "butt";

  // Площадь с каменной кладкой и скамьями-брёвнами
  ctx.fillStyle = "#4d4c42";
  ctx.beginPath();
  ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  for (let r = 40; r < PLAZA.r; r += 30) {
    ctx.beginPath();
    ctx.arc(PLAZA.x, PLAZA.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? "#5e5c52" : "#504e45";
    ctx.beginPath();
    ctx.ellipse(PLAZA.x + Math.cos(a) * (PLAZA.r - 8), PLAZA.y + Math.sin(a) * (PLAZA.r - 8), 14, 10, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.stroke();
  }
  for (const a of [-2.35, -0.8, 0.8, 2.35]) {
    const lx = PLAZA.x + Math.cos(a) * 72;
    const ly = PLAZA.y + Math.sin(a) * 72;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = "#5e432c";
    ctx.strokeStyle = "#241911";
    ctx.lineWidth = 2;
    ctx.fillRect(-42, -8, 84, 16);
    ctx.strokeRect(-42, -8, 84, 16);
    ctx.fillStyle = "#6f5138";
    ctx.beginPath();
    ctx.ellipse(-42, 0, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Старые пятна крови
  for (const [sx, sy, sr] of [[630, 505, 15], [1035, 592, 12], [430, 640, 10], [1160, 470, 13], [900, 760, 9]] as const) {
    ctx.fillStyle = "rgba(112,18,16,0.32)";
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + sr, sy + 4, sr * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Полоса опасности на пороге ворот
  ctx.save();
  ctx.beginPath();
  ctx.rect(GATE.x - GATE.half, WALL.y - WALL.t, GATE.half * 2, WALL.t + 10);
  ctx.clip();
  for (let x = GATE.x - GATE.half - 30; x < GATE.x + GATE.half + 30; x += 18) {
    ctx.fillStyle = "rgba(231,197,90,0.55)";
    ctx.beginPath();
    ctx.moveTo(x, WALL.y + 10);
    ctx.lineTo(x + 9, WALL.y + 10);
    ctx.lineTo(x + 9 + 36, WALL.y - WALL.t);
    ctx.lineTo(x + 36, WALL.y - WALL.t);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Направляющие откатных створок
  ctx.strokeStyle = "#8a8f8c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(GATE.x - GATE.half - 90, WALL.y - 6);
  ctx.lineTo(GATE.x + GATE.half + 90, WALL.y - 6);
  ctx.stroke();

  drawWall(ctx);
}

/** Бетонный забор из плит с колючей проволокой по внешнему краю. */
function drawWall(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h, t } = WALL;
  const segs: (Rect & { horizontal: boolean; outer: "top" | "bottom" | "left" | "right" })[] = [
    { x: x - t, y: y - t, w: GATE.x - GATE.half - (x - t), h: t, horizontal: true, outer: "top" },
    { x: GATE.x + GATE.half, y: y - t, w: x + w + t - (GATE.x + GATE.half), h: t, horizontal: true, outer: "top" },
    { x: x - t, y: y + h, w: w + t * 2, h: t, horizontal: true, outer: "bottom" },
    { x: x - t, y, w: t, h, horizontal: false, outer: "left" },
    { x: x + w, y, w: t, h, horizontal: false, outer: "right" },
  ];

  for (const s of segs) {
    // тень от стены внутрь двора
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    if (s.outer === "top") ctx.fillRect(s.x, s.y + s.h, s.w, 12);
    if (s.outer === "left") ctx.fillRect(s.x + s.w, s.y, 12, s.h);
    if (s.outer === "right") ctx.fillRect(s.x - 8, s.y, 8, s.h);
    if (s.outer === "bottom") ctx.fillRect(s.x, s.y - 6, s.w, 6);

    // тело плит
    const grad = s.horizontal
      ? ctx.createLinearGradient(0, s.y, 0, s.y + s.h)
      : ctx.createLinearGradient(s.x, 0, s.x + s.w, 0);
    grad.addColorStop(0, "#8b8c85");
    grad.addColorStop(0.5, "#76776f");
    grad.addColorStop(1, "#5f6059");
    ctx.fillStyle = grad;
    ctx.fillRect(s.x, s.y, s.w, s.h);

    // стыки плит и пятна
    const len = s.horizontal ? s.w : s.h;
    const panel = 58;
    for (let p = 0; p < len; p += panel) {
      const px = s.horizontal ? s.x + p : s.x;
      const py = s.horizontal ? s.y : s.y + p;
      const n = rnd(px * 0.37 + py * 0.91);
      if (n > 0.55) {
        ctx.fillStyle = `rgba(40,35,28,${0.12 + n * 0.12})`;
        if (s.horizontal) ctx.fillRect(px + 8, py + 3, 22 + n * 18, s.h - 6);
        else ctx.fillRect(px + 3, py + 8, s.w - 6, 22 + n * 18);
      }
      if (n < 0.18) {
        // выбоина / трещина
        ctx.strokeStyle = "rgba(25,25,22,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (s.horizontal) {
          ctx.moveTo(px + 20, py + 4);
          ctx.lineTo(px + 28, py + 12);
          ctx.lineTo(px + 24, py + s.h - 4);
        } else {
          ctx.moveTo(px + 4, py + 20);
          ctx.lineTo(px + 12, py + 28);
          ctx.lineTo(px + s.w - 4, py + 24);
        }
        ctx.stroke();
      }
      // стык
      ctx.fillStyle = "#3c3d38";
      if (s.horizontal) ctx.fillRect(px, py, 2, s.h);
      else ctx.fillRect(px, py, s.w, 2);
      // опорный столб каждые две плиты
      if ((p / panel) % 2 === 0) {
        ctx.fillStyle = "#52534d";
        if (s.horizontal) ctx.fillRect(px - 4, py - 3, 9, s.h + 6);
        else ctx.fillRect(px - 3, py - 4, s.w + 6, 9);
      }
    }
    ctx.strokeStyle = "#2a2b27";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);

    // колючая проволока (спираль «Егоза») по внешнему краю
    const wireStep = 9;
    for (let p = 4; p < len - 2; p += wireStep) {
      let cx: number;
      let cy: number;
      if (s.outer === "top") { cx = s.x + p; cy = s.y - 5; }
      else if (s.outer === "bottom") { cx = s.x + p; cy = s.y + s.h + 5; }
      else if (s.outer === "left") { cx = s.x - 5; cy = s.y + p; }
      else { cx = s.x + s.w + 5; cy = s.y + p; }
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(cx + 1.5, cy + 2, 7, 5.5, s.horizontal ? 0.4 : 1.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#a2a8a9";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 7, 5.5, s.horizontal ? 0.4 : 1.2, 0, Math.PI * 2);
      ctx.stroke();
      // шипы
      if ((p / wireStep) % 2 === 0) {
        ctx.strokeStyle = "#cfd4d4";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 7);
        ctx.lineTo(cx + 2, cy - 3);
        ctx.moveTo(cx + 2, cy - 7);
        ctx.lineTo(cx - 2, cy - 3);
        ctx.stroke();
      }
    }
    // натянутая струна вдоль спирали
    ctx.strokeStyle = "rgba(170,176,176,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (s.outer === "top") { ctx.moveTo(s.x, s.y - 5); ctx.lineTo(s.x + s.w, s.y - 5); }
    else if (s.outer === "bottom") { ctx.moveTo(s.x, s.y + s.h + 5); ctx.lineTo(s.x + s.w, s.y + s.h + 5); }
    else if (s.outer === "left") { ctx.moveTo(s.x - 5, s.y); ctx.lineTo(s.x - 5, s.y + s.h); }
    else { ctx.moveTo(s.x + s.w + 5, s.y); ctx.lineTo(s.x + s.w + 5, s.y + s.h); }
    ctx.stroke();
  }

  // Трафареты на стене
  ctx.save();
  ctx.fillStyle = "rgba(170,40,30,0.55)";
  ctx.font = "bold 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ЗАПРЕТНАЯ ЗОНА", 330, WALL.y - 8);
  ctx.fillText("ЗАПРЕТНАЯ ЗОНА", 1270, WALL.y - 8);
  ctx.fillStyle = "rgba(231,197,90,0.6)";
  ctx.fillText("B-7", WALL.x + WALL.w / 2, WALL.y + WALL.h + 18);
  ctx.restore();

  // Откатные створки ворот, отведённые в стороны за стену
  for (const dir of [-1, 1]) {
    const gx = dir < 0 ? GATE.x - GATE.half - 70 : GATE.x + GATE.half;
    ctx.fillStyle = "#3c4241";
    ctx.fillRect(gx, WALL.y - WALL.t - 10, 70, 8);
    ctx.fillStyle = "#e7c55a";
    for (let i = 0; i < 70; i += 14) ctx.fillRect(gx + i, WALL.y - WALL.t - 10, 7, 8);
    ctx.strokeStyle = "#1f2322";
    ctx.strokeRect(gx, WALL.y - WALL.t - 10, 70, 8);
  }
}

function drawDecor(ctx: CanvasRenderingContext2D, d: (typeof DECOR)[number], now: number) {
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(d.x + 6, d.y + 8, d.w, d.h);
  if (d.kind === "tent" || d.kind === "med") {
    ctx.fillStyle = shade(d.color ?? "#5d6a58", 0.8);
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = d.color ?? "#5d6a58";
    ctx.fillRect(d.x, d.y, d.w, d.h / 2);
    ctx.strokeStyle = "#252a24";
    ctx.lineWidth = 2;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y + d.h / 2);
    ctx.lineTo(d.x + d.w, d.y + d.h / 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(15,19,17,0.8)";
    ctx.fillRect(d.x + d.w / 2 - 14, d.y + d.h - 20, 28, 20);
    if (d.kind === "med") {
      ctx.fillStyle = "#e8e2d0";
      ctx.fillRect(d.x + d.w / 2 - 16, d.y + 12, 32, 32);
      ctx.fillStyle = "#c8322a";
      ctx.fillRect(d.x + d.w / 2 - 4, d.y + 16, 8, 24);
      ctx.fillRect(d.x + d.w / 2 - 12, d.y + 24, 24, 8);
      ctx.fillStyle = "#d8cfae";
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ЛАЗАРЕТ", d.x + d.w / 2, d.y - 5);
    }
  } else if (d.kind === "generator") {
    ctx.fillStyle = "#2b342e";
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = "#111713";
    ctx.lineWidth = 2;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = "#8c9b4c";
    ctx.fillRect(d.x + 8, d.y + 9, 20, d.h - 18);
    ctx.fillStyle = "#1b221d";
    for (let i = 0; i < 4; i++) ctx.fillRect(d.x + 36, d.y + 10 + i * 9, 34, 4);
    const on = Math.sin(now * 0.01) > 0;
    ctx.fillStyle = on ? "#b8d36a" : "#4d5a3a";
    ctx.fillRect(d.x + d.w - 10, d.y + 6, 5, 5);
  } else if (d.kind === "container") {
    ctx.fillStyle = d.color ?? "#7a4a35";
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    for (let x = d.x + 10; x < d.x + d.w; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, d.y + 2);
      ctx.lineTo(x, d.y + d.h - 2);
      ctx.stroke();
    }
  } else if (d.kind === "crates") {
    for (const [cx, cy] of [[0, 0], [48, 0], [22, 28]] as const) {
      ctx.fillStyle = "#6a5a3c";
      ctx.fillRect(d.x + cx, d.y + cy, 46, 32);
      ctx.strokeStyle = "#2e2618";
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x + cx, d.y + cy, 46, 32);
      ctx.beginPath();
      ctx.moveTo(d.x + cx, d.y + cy);
      ctx.lineTo(d.x + cx + 46, d.y + cy + 32);
      ctx.stroke();
    }
  } else if (d.kind === "tank") {
    ctx.fillStyle = "#4c5a5e";
    ctx.beginPath();
    ctx.arc(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1e2527";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.arc(d.x + d.w / 2, d.y + d.h / 2, d.w / 2 - 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#d8cfae";
    ctx.font = "bold 9px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ВОДА", d.x + d.w / 2, d.y + d.h / 2 + 3);
  } else if (d.kind === "tower") {
    // караульная вышка у ворот
    ctx.fillStyle = "#3a3226";
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = "#5a4a35";
    ctx.fillRect(d.x + 4, d.y + 4, d.w - 8, d.h - 8);
    ctx.strokeStyle = "#1c1710";
    ctx.lineWidth = 2;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + d.w, d.y + d.h);
    ctx.moveTo(d.x + d.w, d.y);
    ctx.lineTo(d.x, d.y + d.h);
    ctx.stroke();
  }
}

/** Прожектор вышки: конус шарит по дороге за воротами. */
function drawSearchlight(ctx: CanvasRenderingContext2D, d: (typeof DECOR)[number], now: number, phase: number) {
  const cx = d.x + d.w / 2;
  const cy = d.y + d.h / 2;
  const a = -Math.PI / 2 + Math.sin(now * 0.0007 + phase) * 0.75;
  const len = 260;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, len);
  g.addColorStop(0, "rgba(255,240,190,0.32)");
  g.addColorStop(1, "rgba(255,240,190,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, len, a - 0.2, a + 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff1c0";
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

/** Окно с рамой: целое, разбитое или заколоченное досками. */
function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  state: "lit" | "dark" | "broken" | "boarded",
  now: number,
  seed: number
) {
  // проём
  ctx.fillStyle = "#0d1211";
  ctx.fillRect(x, y, w, h);
  if (state === "lit") {
    const flick = 0.5 + Math.sin(now * 0.003 + seed * 9) * 0.08;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, `rgba(255,206,126,${0.55 * flick + 0.2})`);
    g.addColorStop(1, `rgba(214,140,70,${0.3 * flick + 0.1})`);
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  } else if (state === "dark") {
    ctx.fillStyle = "rgba(90,120,120,0.16)";
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  } else if (state === "broken") {
    // осколки по краям тёмного проёма
    ctx.fillStyle = "rgba(150,170,168,0.3)";
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 1);
    ctx.lineTo(x + w * 0.45, y + 1);
    ctx.lineTo(x + 1, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w - 1, y + h - 1);
    ctx.lineTo(x + w * 0.55, y + h - 1);
    ctx.lineTo(x + w - 1, y + h * 0.45);
    ctx.closePath();
    ctx.fill();
  }
  // рама
  ctx.strokeStyle = "#2a2f2b";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  if (state !== "broken") {
    ctx.strokeStyle = "rgba(20,26,24,0.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 1);
    ctx.lineTo(x + w / 2, y + h - 1);
    ctx.moveTo(x + 1, y + h / 2);
    ctx.lineTo(x + w - 1, y + h / 2);
    ctx.stroke();
  }
  // доски крест-накрест
  if (state === "boarded") {
    ctx.fillStyle = "#6b5436";
    ctx.strokeStyle = "#2b2116";
    ctx.lineWidth = 1;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    for (const a of [-0.32, 0.36]) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(-w * 0.62, -3, w * 1.24, 6);
      ctx.strokeRect(-w * 0.62, -3, w * 1.24, 6);
      ctx.restore();
    }
    ctx.restore();
  }
}

/** Дверь с косяком и ручкой; заколоченная — с досками и гвоздями. */
function drawDoor(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  w: number,
  h: number,
  boarded: boolean,
  near: boolean,
  now: number
) {
  const x = cx - w / 2;
  // косяк
  ctx.fillStyle = "#171d1a";
  ctx.fillRect(x - 3, y - 2, w + 6, h + 3);
  // полотно
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, "#3d4640");
  g.addColorStop(0.5, "#4c574e");
  g.addColorStop(1, "#333c37");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // филёнки
  ctx.strokeStyle = "rgba(15,20,18,0.7)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 4, y + 3, w - 8, h * 0.42);
  ctx.strokeRect(x + 4, y + h * 0.52, w - 8, h * 0.4);
  // щель света снизу
  ctx.fillStyle = `rgba(255,210,140,${near ? 0.4 : 0.16})`;
  ctx.fillRect(x + 2, y + h - 3, w - 4, 2.5);
  // ручка
  ctx.fillStyle = "#c9a74a";
  ctx.beginPath();
  ctx.arc(x + w - 8, y + h / 2, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5c4a1e";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (boarded) {
    ctx.save();
    ctx.translate(cx, y + h / 2);
    for (const [a, oy] of [[-0.2, -4], [0.22, 6]] as const) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = "#6b5436";
      ctx.fillRect(-w * 0.66, oy - 4, w * 1.32, 8);
      ctx.strokeStyle = "#2b2116";
      ctx.lineWidth = 1;
      ctx.strokeRect(-w * 0.66, oy - 4, w * 1.32, 8);
      ctx.fillStyle = "#9aa3a0";
      ctx.beginPath();
      ctx.arc(-w * 0.5, oy, 1.2, 0, Math.PI * 2);
      ctx.arc(w * 0.5, oy, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  // подсветка контура при подходе
  ctx.strokeStyle = `rgba(231,197,90,${near ? 0.6 + Math.sin(now * 0.007) * 0.25 : 0.25})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 3, y - 2, w + 6, h + 3);
}

/** Мелкое окружение вокруг зданий: баки, ящики, бочки, фонари, заборы, кусты. */
function drawBuildingProps(ctx: CanvasRenderingContext2D, o: HubObject, now: number) {
  const r = objRect(o);
  const s = o.x * 0.013 + o.y * 0.021;
  const doorTop = o.door === "top";
  // сторона «двора» — противоположна двери
  const yardY = doorTop ? r.y + r.h + 16 : r.y - 16;

  const shadow = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 3, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // --- мусорный бак у левого угла
  const bx = r.x + 12;
  const by = yardY;
  shadow(bx + 14, by + 10, 17, 9);
  ctx.fillStyle = "#3f5148";
  ctx.beginPath();
  ctx.roundRect(bx, by - 10, 30, 22, 3);
  ctx.fill();
  ctx.strokeStyle = "#151d19";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#54685d";
  ctx.beginPath();
  ctx.roundRect(bx + 2, by - 12, 26, 9, 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.moveTo(bx + 15, by - 12);
  ctx.lineTo(bx + 15, by - 3);
  ctx.stroke();
  // торчащий мусор
  ctx.fillStyle = "#7d7a63";
  ctx.fillRect(bx + 6, by - 16, 7, 5);
  ctx.fillStyle = "#6a4f3a";
  ctx.fillRect(bx + 19, by - 15, 5, 4);

  // --- штабель ящиков у правого угла
  const kx = r.x + r.w - 54;
  shadow(kx + 20, yardY + 9, 20, 9);
  for (const [ox, oy, sz] of [[0, -2, 22], [24, 0, 20], [10, -20, 18]] as const) {
    ctx.fillStyle = "#6a5a3c";
    ctx.fillRect(kx + ox, yardY + oy - sz / 2, sz, sz);
    ctx.strokeStyle = "#2e2618";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(kx + ox, yardY + oy - sz / 2, sz, sz);
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(kx + ox, yardY + oy - sz / 2);
    ctx.lineTo(kx + ox + sz, yardY + oy + sz / 2);
    ctx.moveTo(kx + ox + sz, yardY + oy - sz / 2);
    ctx.lineTo(kx + ox, yardY + oy + sz / 2);
    ctx.stroke();
  }

  // --- пара бочек
  for (let i = 0; i < 2; i++) {
    const px = r.x + r.w * (0.42 + i * 0.16);
    const py = yardY + (i ? 14 : -6);
    shadow(px + 2, py + 4, 11, 6);
    ctx.fillStyle = i ? "#7b4a33" : "#4a5b57";
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1b1410";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- фонарный столб со световым пятном у двери
  const lampX = r.x + r.w + 22;
  const lampY = r.y + r.h / 2;
  const glow = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, 86);
  glow.addColorStop(0, "rgba(255,214,150,0.2)");
  glow.addColorStop(1, "rgba(255,214,150,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(lampX - 86, lampY - 86, 172, 172);
  shadow(lampX + 4, lampY + 6, 8, 4);
  ctx.strokeStyle = "#39423c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(lampX, lampY + 10);
  ctx.lineTo(lampX, lampY - 14);
  ctx.stroke();
  ctx.fillStyle = "#2c3430";
  ctx.beginPath();
  ctx.roundRect(lampX - 9, lampY - 20, 18, 8, 2);
  ctx.fill();
  ctx.strokeStyle = "#151b18";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const on = Math.sin(now * 0.0012 + s * 5) > -0.75;   // изредка мигает
  ctx.fillStyle = on ? "#ffe0a2" : "#4d4a3a";
  ctx.fillRect(lampX - 6, lampY - 13, 12, 3);

  // --- низкий забор-сетка вдоль боковой стены
  const fenceX = r.x - 20;
  ctx.strokeStyle = "#4a534d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fenceX, r.y + 10);
  ctx.lineTo(fenceX, r.y + r.h - 10);
  ctx.stroke();
  ctx.strokeStyle = "rgba(122,136,128,0.45)";
  ctx.lineWidth = 1;
  for (let y = r.y + 12; y < r.y + r.h - 12; y += 9) {
    ctx.beginPath();
    ctx.moveTo(fenceX - 6, y);
    ctx.lineTo(fenceX + 6, y + 6);
    ctx.moveTo(fenceX + 6, y);
    ctx.lineTo(fenceX - 6, y + 6);
    ctx.stroke();
  }
  for (let y = r.y + 10; y <= r.y + r.h - 10; y += 34) {
    ctx.fillStyle = "#39423c";
    ctx.fillRect(fenceX - 2.5, y, 5, 5);
  }

  // --- кусты
  for (let i = 0; i < 3; i++) {
    const px = r.x + 26 + i * (r.w - 52) * 0.5;
    const py = doorTop ? r.y - 18 : r.y + r.h + 18;
    const rad = 9 + rnd(s + i * 3.1) * 5;
    shadow(px + 2, py + 3, rad, rad * 0.5);
    for (let b = 0; b < 4; b++) {
      const ox = (rnd(s + i * 7 + b) - 0.5) * rad;
      const oy = (rnd(s + i * 11 + b) - 0.5) * rad * 0.7;
      ctx.fillStyle = b % 2 ? "#37482f" : "#2c3a26";
      ctx.beginPath();
      ctx.arc(px + ox, py + oy, rad * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(20,28,18,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, rad * 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, o: HubObject, now: number, near: boolean) {
  const r = objRect(o);
  const color = o.color ?? "#5c6b52";
  const doorTop = o.door === "top";
  const seed = o.x * 0.017 + o.y * 0.029;

  // мягкая отбрасываемая тень (смещена вниз-вправо, как от прожектора)
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.filter = "blur(6px)";
  ctx.fillStyle = "#040706";
  ctx.beginPath();
  ctx.roundRect(r.x + 12, r.y + 16, r.w, r.h, 10);
  ctx.fill();
  ctx.restore();

  // ---------- СТЕНЫ ----------
  const wallBase = shade(color, 0.52);
  ctx.fillStyle = wallBase;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // бетонные панели со швами
  ctx.strokeStyle = "rgba(0,0,0,0.26)";
  ctx.lineWidth = 1;
  for (let x = r.x + 26; x < r.x + r.w; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
    ctx.stroke();
  }
  for (let y = r.y + 22; y < r.y + r.h; y += 22) {
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
    ctx.stroke();
  }
  // пятна сырости и подтёки ржавчины
  for (let i = 0; i < 7; i++) {
    const px = r.x + rnd(seed + i * 2.3) * r.w;
    const py = r.y + rnd(seed + i * 5.7) * r.h;
    ctx.fillStyle = i % 3 === 0 ? "rgba(120,70,40,0.16)" : "rgba(20,26,22,0.18)";
    ctx.beginPath();
    ctx.ellipse(px, py, 8 + rnd(seed + i) * 14, 5 + rnd(seed + i * 3) * 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // общий контур здания
  ctx.strokeStyle = "#111614";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(r.x, r.y, r.w, r.h);

  // ---------- КРЫША ----------
  const roofY = doorTop ? r.y + 22 : r.y + 5;
  const roofH = r.h - 27;
  const roofX = r.x + 7;
  const roofW = r.w - 14;
  // карниз: тёмная подложка создаёт высоту
  ctx.fillStyle = shade(color, 0.32);
  ctx.fillRect(roofX - 4, roofY - 3, roofW + 8, roofH + 7);
  // полотно крыши
  const rg = ctx.createLinearGradient(roofX, roofY, roofX, roofY + roofH);
  rg.addColorStop(0, shade(color, 1.12));
  rg.addColorStop(0.55, color);
  rg.addColorStop(1, shade(color, 0.78));
  ctx.fillStyle = rg;
  ctx.fillRect(roofX, roofY, roofW, roofH);
  // профлист
  ctx.strokeStyle = "rgba(0,0,0,0.17)";
  ctx.lineWidth = 1;
  for (let x = roofX + 8; x < roofX + roofW - 4; x += 11) {
    ctx.beginPath();
    ctx.moveTo(x, roofY + 2);
    ctx.lineTo(x, roofY + roofH - 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  for (let x = roofX + 12; x < roofX + roofW - 4; x += 11) {
    ctx.beginPath();
    ctx.moveTo(x, roofY + 2);
    ctx.lineTo(x, roofY + roofH - 2);
    ctx.stroke();
  }
  // ржавые заплаты на крыше
  for (let i = 0; i < 4; i++) {
    const px = roofX + 10 + rnd(seed + i * 4.1) * (roofW - 24);
    const py = roofY + 8 + rnd(seed + i * 6.3) * (roofH - 20);
    ctx.fillStyle = "rgba(150,88,45,0.3)";
    ctx.beginPath();
    ctx.ellipse(px, py, 7 + rnd(seed + i) * 9, 5 + rnd(seed + i * 2) * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // тень карниза внутрь крыши + контур
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(roofX, roofY, roofW, 4);
  ctx.fillRect(roofX, roofY, 4, roofH);
  ctx.strokeStyle = "#111614";
  ctx.lineWidth = 2;
  ctx.strokeRect(roofX, roofY, roofW, roofH);
  // светлая кромка сверху
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(roofX + 1, roofY + 1.5);
  ctx.lineTo(roofX + roofW - 1, roofY + 1.5);
  ctx.stroke();

  // детали крыши по типу здания
  const cx = o.x;
  const cy = roofY + roofH / 2;
  if (o.building === "hq") {
    ctx.fillStyle = "#39443a";
    ctx.beginPath();
    ctx.arc(r.x + 42, cy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a9b89d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x + 42, cy, 14, Math.PI * 0.2, Math.PI * 1.3);
    ctx.stroke();
    ctx.fillStyle = "#c8322a";
    ctx.fillRect(r.x + r.w - 40, roofY + 10, 20, 12);
  } else if (o.building === "weapons") {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = "#4e3d2a";
      ctx.fillRect(r.x + 20 + i * 30, cy - 12, 24, 24);
      ctx.strokeStyle = "#241b10";
      ctx.strokeRect(r.x + 20 + i * 30, cy - 12, 24, 24);
    }
    ctx.fillStyle = "#e99943";
    ctx.fillRect(r.x + 5, roofY + roofH - 6, r.w - 10, 4);
  } else if (o.building === "equipment") {
    ctx.fillStyle = "#39463a";
    ctx.fillRect(r.x + r.w - 60, cy - 14, 40, 28);
    ctx.strokeStyle = "#1a211b";
    ctx.strokeRect(r.x + r.w - 60, cy - 14, 40, 28);
    ctx.strokeStyle = "#8fae4a";
    ctx.beginPath();
    ctx.moveTo(r.x + 20, cy - 10);
    ctx.lineTo(r.x + 90, cy - 10);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ["#6b5c4c", "#4c5c53", "#7d6a4f"][i];
      ctx.fillRect(r.x + 26 + i * 22, cy - 9, 14, 16);
    }
  } else if (o.building === "inventory") {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.font = "bold 22px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("СКЛАД", cx, cy + 8);
  } else if (o.building === "radio") {
    // мачта с растяжками и мигающим огнём
    ctx.strokeStyle = "#8b9a96";
    ctx.lineWidth = 1;
    for (const [dx, dy] of [[-30, -22], [30, -22], [-30, 22], [30, 22]] as const) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
    }
    ctx.fillStyle = "#2c3230";
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
    const blink = Math.floor(now / 600) % 2 === 0;
    ctx.fillStyle = blink ? "#ff4a3d" : "#5a1a14";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- ОКНА ----------
  // Полоса стены со стороны площади — там же, где вход.
  const bandY = doorTop ? r.y + 3 : r.y + r.h - 19;
  const winStates: ("lit" | "dark" | "broken" | "boarded")[] = ["lit", "dark", "broken", "boarded"];
  const winW = 17;
  const winH = 13;
  const slots = Math.max(2, Math.floor((r.w - 80) / 34));
  for (let i = 0; i < slots; i++) {
    const wx = r.x + 16 + i * ((r.w - 32 - winW) / Math.max(1, slots - 1));
    // Дверь посередине — окна рядом с ней пропускаем.
    if (Math.abs(wx + winW / 2 - cx) < 34) continue;
    const st = winStates[Math.floor(rnd(seed + i * 3.7) * 4)];
    drawWindow(ctx, wx, bandY, winW, winH, st, now, seed + i);
  }
  // Пара окон на противоположной стене
  const backY = doorTop ? r.y + r.h - 15 : r.y + 4;
  for (let i = 0; i < 2; i++) {
    const wx = r.x + r.w * (0.26 + i * 0.42);
    const st = rnd(seed + i * 8.3) > 0.55 ? "boarded" : "dark";
    drawWindow(ctx, wx, backY, winW - 3, 10, st, now, seed + i * 2);
  }

  // ---------- ДВЕРЬ ----------
  const doorY = doorTop ? r.y : r.y + r.h - 26;
  // Склад всегда открыт, радиорубка заколочена наполовину — для разнообразия.
  const boarded = o.building === "radio";
  drawDoor(ctx, cx, doorY, 46, 26, boarded, near, now);
  // ступенька-порог
  ctx.fillStyle = "rgba(60,66,60,0.75)";
  ctx.fillRect(cx - 26, doorTop ? doorY - 6 : doorY + 26, 52, 5);
  // свет над дверью, падающий на дорожку
  const lightY = doorTop ? r.y - 6 : r.y + r.h + 6;
  const lg = ctx.createRadialGradient(cx, lightY, 0, cx, lightY, 70);
  lg.addColorStop(0, `rgba(255,210,140,${near ? 0.28 : 0.14})`);
  lg.addColorStop(1, "rgba(255,210,140,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(cx - 70, lightY - 70, 140, 140);

  // вывеска
  const signY = doorTop ? r.y + r.h - 16 : r.y - 13;
  ctx.fillStyle = "#101615";
  ctx.fillRect(r.x + 14, signY, r.w - 28, 18);
  ctx.strokeStyle = near ? "#e7c55a" : "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x + 14, signY, r.w - 28, 18);
  ctx.fillStyle = near ? "#ffe7ac" : "#d8cfae";
  ctx.font = "bold 10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${o.icon} ${o.name.toUpperCase()}`, cx, signY + 13);
}

function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, face: number, color: string, now: number, walking = false) {
  const step = walking ? Math.sin(now * 0.02) * 3 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(1, 6, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(face);
  ctx.fillStyle = "#1e2322";
  ctx.fillRect(-9, -7 + step, 7, 5);
  ctx.fillRect(-9, 2 - step, 7, 5);
  ctx.fillStyle = shade(color, 0.7);
  ctx.beginPath();
  ctx.roundRect(-9, -8, 12, 16, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-5, -8, 13, 16, 4);
  ctx.fill();
  ctx.strokeStyle = "#15181a";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#c9a074";
  ctx.beginPath();
  ctx.arc(6, -7, 2.6, 0, Math.PI * 2);
  ctx.arc(6, 7, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b9916d";
  ctx.beginPath();
  ctx.arc(2, 0, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Игрок в лагере: крупнее, с рюкзаком и винтовкой за спиной. */
function drawSurvivor(ctx: CanvasRenderingContext2D, x: number, y: number, face: number, now: number, walking: boolean) {
  const step = walking ? Math.sin(now * 0.02) * 3.2 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(1, 7, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(face);
  ctx.scale(1.15, 1.15);
  ctx.fillStyle = "#161c1b";
  ctx.fillRect(-11, -8 + step, 8, 5);
  ctx.fillRect(-11, 3 - step, 8, 5);
  // рюкзак
  ctx.fillStyle = "#3f4a37";
  ctx.beginPath();
  ctx.roundRect(-13, -7, 8, 14, 3);
  ctx.fill();
  // корпус
  ctx.fillStyle = "#55736d";
  ctx.beginPath();
  ctx.roundRect(-7, -9, 15, 18, 4);
  ctx.fill();
  ctx.strokeStyle = "#17201d";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = "rgba(16,24,21,0.6)";
  ctx.fillRect(-2, -9, 3, 18);
  // винтовка за спиной
  ctx.strokeStyle = "#23272a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-10, 8);
  ctx.lineTo(6, -10);
  ctx.stroke();
  // руки
  ctx.fillStyle = "#c89a74";
  ctx.beginPath();
  ctx.arc(7, -8, 2.8, 0, Math.PI * 2);
  ctx.arc(7, 8, 2.8, 0, Math.PI * 2);
  ctx.fill();
  // голова в кепке
  ctx.fillStyle = "#b9916d";
  ctx.beginPath();
  ctx.arc(2, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3f4c43";
  ctx.beginPath();
  ctx.arc(1, 0, 6.3, Math.PI * 0.6, Math.PI * 1.4);
  ctx.lineTo(9, -3);
  ctx.lineTo(9, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ============================================================
export default function HubScreen({
  go,
  enterBuilding,
  onMap,
}: {
  go: (s: Screen) => void;
  enterBuilding: (id: BuildingId) => void;
  onMap: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef({ x: 0, y: 0 });
  const keys = useRef<Record<string, boolean>>({});
  const walkPath = useRef<{ x: number; y: number }[]>([]);
  const walkOpen = useRef<string | null>(null);
  const nearestRef = useRef<string | null>(null);
  const [prompt, setPrompt] = useState<HubObject | null>(null);
  const [dialog, setDialog] = useState<HubObject | null>(null);
  const [dialogIdx, setDialogIdx] = useState(0);
  const [rapport, setRapport] = useState<Record<string, number>>({});
  const [npcDiscount, setNpcDiscount] = useState(0);
  const [npcNote, setNpcNote] = useState("");
  const [paused, setPaused] = useState(false);
  const [plan, setPlan] = useState({ x: pos.x, y: pos.y });
  const [tourIdx, setTourIdx] = useState<number | null>(null);
  const tourIdxRef = useRef<number | null>(null);
  tourIdxRef.current = tourIdx;
  const isMobile = useIsMobile();
  const save = useSave();
  const affordableEquip = EQUIPMENT.filter((e) => !save.ownedEquipment.includes(e.id) && save.currency >= store.priceFor(e.price)).length;
  const nextLevel = LEVELS.find((l) => save.levels[l.id]?.unlocked && !save.levels[l.id]?.cleared) ?? LEVELS[LEVELS.length - 1];

  const interact = (id: string) => {
    if (tourIdxRef.current !== null) return;
    const o = HUB_OBJECTS.find((x) => x.id === id);
    if (!o) return;
    sfx.uiClick();
    walkPath.current = [];
    walkOpen.current = null;
    if (o.kind === "npc") {
      setDialogIdx(0);
      setDialog(o);
      return;
    }
    if (o.kind === "gate") {
      onMap();
      return;
    }
    if (o.building) enterBuilding(o.building);
  };

  const walkTo = (o: HubObject) => {
    const d = doorPoint(o);
    walkPath.current = route(pos.x, pos.y, d.x, d.y);
    walkOpen.current = o.id;
  };

  // Кнопки лагеря ведут игрока пешком к нужной двери/воротам.
  const navigateFromCamp = (screen: Screen) => {
    if (paused) setPaused(false);
    if (screen === "menu") { go("menu"); return; }
    if (screen === "hub") { walkPath.current = []; return; }
    const byScreen: Partial<Record<Screen, string>> = {
      worldmap: "gate",
      weapons: "gun_shop",
      equipment: "equip_shop",
      inventory: "inventory",
      settings: "radio",
    };
    const target = HUB_OBJECTS.find((o) => o.id === byScreen[screen]);
    if (!target) { go(screen); return; }
    walkTo(target);
  };

  const endTour = (skipped: boolean) => {
    setTourIdx(null);
    keys.current = {};
    walkPath.current = [];
    walkOpen.current = null;
    store.completeHubTour(skipped);
  };

  // Первый вход в лобби — запускаем облёт после короткой паузы.
  useEffect(() => {
    if (save.tutorial.hubTour !== "unseen") return;
    const t = window.setTimeout(() => {
      keys.current = {};
      walkPath.current = [];
      walkOpen.current = null;
      setTourIdx(0);
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused || dialog) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bg = document.createElement("canvas");
    bg.width = WORLD_W;
    bg.height = WORLD_H;
    const bctx = bg.getContext("2d");
    if (bctx) drawGround(bctx);
    ctx.imageSmoothingEnabled = true;

    let raf = 0;
    let last = performance.now();
    let planT = 0;
    const cam = cameraRef.current;
    cam.x = Math.max(0, Math.min(WORLD_W - VIEW_W, pos.x - VIEW_W / 2));
    cam.y = Math.max(0, Math.min(WORLD_H - VIEW_H, pos.y - VIEW_H / 2));
    const fx: { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }[] = [];
    const towers = DECOR.filter((d) => d.kind === "tower");
    const generator = DECOR.find((d) => d.kind === "generator")!;

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const settings = store.getSnapshot().settings;
      const particleDensity = settings.particleQuality === "off" ? 0 : settings.particleQuality === "low" ? 0.3 : 1;
      if (!particleDensity) fx.length = 0;
      const k = keys.current;
      const touring = tourIdxRef.current !== null;
      let dx = 0;
      let dy = 0;
      if (!touring) {
        if (k["a"] || k["arrowleft"]) dx -= 1;
        if (k["d"] || k["arrowright"]) dx += 1;
        if (k["w"] || k["arrowup"]) dy -= 1;
        if (k["s"] || k["arrowdown"]) dy += 1;
      }
      if (dx !== 0 || dy !== 0) {
        walkPath.current = [];
        walkOpen.current = null;
      } else if (walkPath.current.length && !touring) {
        const t = walkPath.current[0];
        const tx = t.x - pos.x;
        const ty = t.y - pos.y;
        const td = Math.hypot(tx, ty);
        if (td < 9) {
          walkPath.current.shift();
          if (!walkPath.current.length && walkOpen.current) {
            const id = walkOpen.current;
            walkOpen.current = null;
            interact(id);
          }
        } else {
          dx = tx / td;
          dy = ty / td;
        }
      }
      const l = Math.hypot(dx, dy);
      if (l > 0) { dx /= l; dy /= l; }
      const sprint = k["shift"] || walkPath.current.length > 0;
      const spd = sprint ? 270 : 180;
      pos.vx += (dx * spd - pos.vx) * Math.min(1, dt * 10);
      pos.vy += (dy * spd - pos.vy) * Math.min(1, dt * 10);
      pos.x = Math.max(WALL.x + 16, Math.min(WALL.x + WALL.w - 16, pos.x + pos.vx * dt));
      pos.y = Math.max(WALL.y + 16, Math.min(WALL.y + WALL.h - 16, pos.y + pos.vy * dt));
      const speedNow = Math.hypot(pos.vx, pos.vy);
      if (speedNow > 25) {
        pos.face = Math.atan2(pos.vy, pos.vx);
        pos.walk += dt * speedNow * 0.05;
        sfx.footstep(!!k["shift"]);
      }

      // столкновения со зданиями и декором
      for (const r of OBSTACLES) {
        const hx = Math.max(r.x, Math.min(pos.x, r.x + r.w));
        const hy = Math.max(r.y, Math.min(pos.y, r.y + r.h));
        const ddx = pos.x - hx;
        const ddy = pos.y - hy;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= 13 * 13) continue;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          pos.x = hx + (ddx / d) * 13;
          pos.y = hy + (ddy / d) * 13;
        } else {
          pos.y = r.y + r.h + 13;
        }
      }

      // ближайший интерактив
      let nearest: HubObject | null = null;
      let nd = 70;
      for (const o of HUB_OBJECTS) {
        const p = o.kind === "npc" ? { x: o.x, y: o.y } : doorPoint(o);
        const d = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (d < nd) { nd = d; nearest = o; }
      }
      const nextNearest = nearest?.id ?? null;
      if (nextNearest !== nearestRef.current) {
        nearestRef.current = nextNearest;
        setPrompt(nearest);
      }

      planT += dt;
      if (planT > 0.15) {
        planT = 0;
        setPlan({ x: pos.x, y: pos.y });
      }

      // камера: в туре — медленный кинематографичный облёт точек, иначе — за игроком
      const tourStep = tourIdxRef.current !== null ? TOUR_STEPS[tourIdxRef.current] : null;
      const focusX = tourStep ? tourStep.fx : pos.x;
      const focusY = tourStep ? tourStep.fy : pos.y;
      const camRate = tourStep ? 1.7 : 5;
      cam.x += (Math.max(0, Math.min(WORLD_W - VIEW_W, focusX - VIEW_W / 2)) - cam.x) * Math.min(1, dt * camRate);
      cam.y += (Math.max(0, Math.min(WORLD_H - VIEW_H, focusY - VIEW_H / 2)) - cam.y) * Math.min(1, dt * camRate);

      // ---------- отрисовка ----------
      const scale = settings.graphicsQuality === "low" ? 0.75 : settings.graphicsQuality === "high" ? 1.5 : 1;
      if (canvas.width !== VIEW_W * scale) { canvas.width = VIEW_W * scale; canvas.height = VIEW_H * scale; }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = settings.graphicsQuality !== "low";
      canvas.style.imageRendering = settings.graphicsQuality === "low" ? "pixelated" : "auto";
      ctx.drawImage(bg, cam.x, cam.y, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
      ctx.save();
      ctx.translate(-cam.x, -cam.y);

      // прожекторы по углам двора
      for (const [lx, ly, color] of CORNER_LIGHTS) {
        const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 230);
        glow.addColorStop(0, `${color}30`);
        glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow;
        ctx.fillRect(lx - 230, ly - 230, 460, 460);
        ctx.fillStyle = "#353d35";
        ctx.fillRect(lx - 4, ly - 4, 8, 8);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // кусты по двору
      for (const [bxp, byp, brad] of BUSHES) {
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.beginPath();
        ctx.ellipse(bxp + 3, byp + 4, brad, brad * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let b = 0; b < 4; b++) {
          const ox = (rnd(bxp * 0.11 + b) - 0.5) * brad;
          const oy = (rnd(byp * 0.13 + b) - 0.5) * brad * 0.7;
          ctx.fillStyle = b % 2 ? "#37482f" : "#2c3a26";
          ctx.beginPath();
          ctx.arc(bxp + ox, byp + oy, brad * 0.62, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "rgba(20,28,18,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bxp, byp, brad * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // фонарные столбы вдоль аллеи
      for (const [lx, ly] of LAMP_POSTS) {
        const lampGlow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 96);
        lampGlow.addColorStop(0, "rgba(255,214,150,0.19)");
        lampGlow.addColorStop(1, "rgba(255,214,150,0)");
        ctx.fillStyle = lampGlow;
        ctx.fillRect(lx - 96, ly - 96, 192, 192);
        ctx.fillStyle = "rgba(0,0,0,0.36)";
        ctx.beginPath();
        ctx.ellipse(lx + 5, ly + 8, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#39423c";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(lx, ly + 10);
        ctx.lineTo(lx, ly - 16);
        ctx.stroke();
        ctx.fillStyle = "#2c3430";
        ctx.beginPath();
        ctx.roundRect(lx - 9, ly - 23, 18, 9, 2);
        ctx.fill();
        ctx.strokeStyle = "#151b18";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = Math.sin(now * 0.0011 + lx) > -0.8 ? "#ffe0a2" : "#4d4a3a";
        ctx.fillRect(lx - 6, ly - 15, 12, 3);
      }

      for (const d of DECOR) drawDecor(ctx, d, now);
      towers.forEach((t, i) => drawSearchlight(ctx, t, now, i * 2.4));

      // выхлоп генератора
      if (Math.random() < 0.25 * particleDensity) {
        fx.push({
          x: generator.x + generator.w - 8, y: generator.y + 4,
          vx: 8 + Math.random() * 10, vy: -20 - Math.random() * 20,
          life: 1.4, max: 1.4, size: 4 + Math.random() * 4, color: "rgba(120,120,112,0.35)",
        });
      }

      // Сначала окружение, затем сами здания — постройки перекрывают реквизит.
      for (const o of HUB_OBJECTS) {
        if (o.kind === "portal") drawBuildingProps(ctx, o, now);
      }
      for (const o of HUB_OBJECTS) {
        if (o.kind === "portal") drawBuilding(ctx, o, now, nearestRef.current === o.id);
      }

      // подсветка ворот
      const gateNear = nearestRef.current === "gate";
      const gg = ctx.createRadialGradient(GATE.x, WALL.y, 0, GATE.x, WALL.y, 120);
      gg.addColorStop(0, `rgba(231,197,90,${gateNear ? 0.3 : 0.12})`);
      gg.addColorStop(1, "rgba(231,197,90,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(GATE.x - 120, WALL.y - 120, 240, 240);
      ctx.fillStyle = "#101615";
      ctx.fillRect(GATE.x - 76, WALL.y + 12, 152, 20);
      ctx.strokeStyle = gateNear ? "#e7c55a" : "rgba(231,197,90,0.45)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(GATE.x - 76, WALL.y + 12, 152, 20);
      ctx.fillStyle = gateNear ? "#ffe7ac" : "#d8cfae";
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("▲ ВЫХОД В ГОРОД ▲", GATE.x, WALL.y + 26);

      // костёр в центре площади
      ctx.fillStyle = "#33322c";
      ctx.beginPath();
      ctx.arc(PLAZA.x, PLAZA.y, 22, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.fillStyle = "#4c4238";
        ctx.save();
        ctx.translate(PLAZA.x + Math.cos(a) * 15, PLAZA.y + Math.sin(a) * 15);
        ctx.rotate(a);
        ctx.fillRect(-9, -3, 18, 6);
        ctx.restore();
      }
      if (Math.random() < 0.6 * particleDensity) {
        fx.push({
          x: PLAZA.x + (Math.random() - 0.5) * 14, y: PLAZA.y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 16, vy: -40 - Math.random() * 45,
          life: 0.7 + Math.random() * 0.4, max: 1, size: 2.5 + Math.random() * 3,
          color: Math.random() > 0.4 ? "#ff9c3f" : "#ffd24d",
        });
      }
      const flick = 0.85 + Math.sin(now * 0.011) * 0.1 + Math.sin(now * 0.003) * 0.05;
      const fgrad = ctx.createRadialGradient(PLAZA.x, PLAZA.y, 0, PLAZA.x, PLAZA.y, 210 * flick);
      fgrad.addColorStop(0, "rgba(255,150,60,0.3)");
      fgrad.addColorStop(1, "rgba(255,150,60,0)");
      ctx.fillStyle = fgrad;
      ctx.fillRect(PLAZA.x - 220, PLAZA.y - 220, 440, 440);

      for (let i = fx.length - 1; i >= 0; i--) {
        const p = fx[i];
        p.life -= dt;
        if (p.life <= 0) { fx.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + (p.life / p.max) * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // NPC
      for (const o of HUB_OBJECTS) {
        if (o.kind !== "npc") continue;
        const bob = Math.sin(now * 0.002 + o.x) * 1.2;
        drawPerson(ctx, o.x, o.y + bob, Math.atan2(pos.y - o.y, pos.x - o.x), o.body ?? "#555e53", now);
        ctx.fillStyle = "#c0b8a0";
        ctx.font = "10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(o.name, o.x, o.y - 22);
        if (nearestRef.current === o.id) {
          ctx.strokeStyle = "rgba(231,197,90,0.85)";
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.arc(o.x, o.y, 20 + Math.sin(now * 0.006) * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // маршрут пешком
      if (walkPath.current.length) {
        ctx.strokeStyle = "rgba(184,211,106,0.5)";
        ctx.setLineDash([4, 7]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        for (const p of walkPath.current) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const end = walkPath.current[walkPath.current.length - 1];
        ctx.beginPath();
        ctx.arc(end.x, end.y, 8 + Math.sin(now * 0.01) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // игрок
      drawSurvivor(ctx, pos.x, pos.y, pos.face, now, speedNow > 25);
      ctx.strokeStyle = "rgba(223,243,201,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 19, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#f0d18c";
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(profiles.getSnapshot()?.displayName ?? "ВЫ", pos.x, pos.y - 24);

      ctx.restore();

      // ночная виньетка
      const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 220, VIEW_W / 2, VIEW_H / 2, 640);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(4,7,8,0.6)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Кинематографичный тур: полосы, прожектор на точке и пульсирующее кольцо.
      if (tourStep) {
        ctx.fillStyle = "#030404";
        ctx.fillRect(0, 0, VIEW_W, 34);
        ctx.fillRect(0, VIEW_H - 34, VIEW_W, 34);
        const sx = tourStep.fx - cam.x;
        const sy = tourStep.fy - cam.y;
        const spot = ctx.createRadialGradient(sx, sy, tourStep.r * 0.45, sx, sy, tourStep.r * 1.5);
        spot.addColorStop(0, "rgba(2,5,4,0)");
        spot.addColorStop(0.62, "rgba(2,5,4,0.25)");
        spot.addColorStop(1, "rgba(2,5,4,0.66)");
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        const pulse = 1 + Math.sin(now * 0.005) * 0.04;
        ctx.strokeStyle = "rgba(231,197,90,0.9)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(sx, sy, tourStep.r * 0.72 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Стрелка над точкой.
        const bobY = Math.sin(now * 0.006) * 6;
        ctx.fillStyle = "#e7c55a";
        ctx.beginPath();
        ctx.moveTo(sx - 10, sy - tourStep.r * 0.72 - 26 + bobY);
        ctx.lineTo(sx + 10, sy - tourStep.r * 0.72 - 26 + bobY);
        ctx.lineTo(sx, sy - tourStep.r * 0.72 - 12 + bobY);
        ctx.closePath();
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, dialog]);

  useEffect(() => {
    const CODE_MAP: Record<string, string> = {
      KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d",
      ArrowUp: "arrowup", ArrowDown: "arrowdown", ArrowLeft: "arrowleft", ArrowRight: "arrowright",
      ShiftLeft: "shift", ShiftRight: "shift",
    };
    const down = (e: KeyboardEvent) => {
      // Во время тура Esc пропускает обучение, остальной ввод заблокирован.
      if (tourIdxRef.current !== null) {
        if (e.code === "Escape" || e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          endTour(true);
        }
        return;
      }
      const key = CODE_MAP[e.code];
      if (key) keys.current[key] = true;
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
      if (e.code === "Escape") {
        keys.current = {};
        if (dialog) setDialog(null);
        else setPaused((p) => !p);
        return;
      }
      if (!dialog && !paused) {
        if (e.code === "Digit2") navigateFromCamp("worldmap");
        if (e.code === "Digit3") navigateFromCamp("weapons");
        if (e.code === "Digit4") navigateFromCamp("equipment");
        if (e.code === "Digit5") navigateFromCamp("inventory");
        if (e.code === "Digit6") navigateFromCamp("settings");
      }
      if ((e.code === "KeyE" || e.code === "Enter" || e.code === "Space") && !dialog && !paused) {
        if (nearestRef.current) {
          keys.current = {};
          interact(nearestRef.current);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = CODE_MAP[e.code];
      if (key) keys.current[key] = false;
    };
    const blur = () => { keys.current = {}; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, paused]);

  const onCanvasClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || dialog || paused || tourIdx !== null) return;
    const rect = canvas.getBoundingClientRect();
    const wx = ((e.clientX - rect.left) / rect.width) * VIEW_W + cameraRef.current.x;
    const wy = ((e.clientY - rect.top) / rect.height) * VIEW_H + cameraRef.current.y;
    for (const o of HUB_OBJECTS) {
      const r = o.kind === "gate" ? { x: GATE.x - GATE.half, y: WALL.y - WALL.t, w: GATE.half * 2, h: 70 } : objRect(o);
      if (wx >= r.x - 14 && wx <= r.x + r.w + 14 && wy >= r.y - 24 && wy <= r.y + r.h + 14) {
        const p = o.kind === "npc" ? { x: o.x, y: o.y } : doorPoint(o);
        if (Math.hypot(p.x - pos.x, p.y - pos.y) < 60) interact(o.id);
        else walkTo(o);
        return;
      }
    }
    const tx = Math.max(WALL.x + 16, Math.min(WALL.x + WALL.w - 16, wx));
    const ty = Math.max(WALL.y + 16, Math.min(WALL.y + WALL.h - 16, wy));
    walkPath.current = route(pos.x, pos.y, tx, ty);
    walkOpen.current = null;
  };

  const dpad = (dir: string, on: boolean) => {
    keys.current[dir] = on;
  };

  const planScale = 0.125;

  return (
    <div className="mx-auto w-full max-w-[1420px] space-y-3 p-1 sm:p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative overflow-hidden border-2 border-ash-600 bg-ash-950 shadow-2xl">
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            onClick={onCanvasClick}
            className="block h-auto w-full cursor-pointer"
          />
          <div className="pointer-events-none absolute left-3 top-3 border border-ash-700 bg-black/70 px-3 py-1.5 text-[10px] text-ash-300">
            WASD — шаг · Shift — бег · E / клик — войти · 2 — к воротам
          </div>

          {prompt && !dialog && !paused && tourIdx === null && (
            <div className="anim-fade-up absolute bottom-3 left-1/2 -translate-x-1/2 border-2 border-[#c9a74a] bg-ash-950/95 px-5 py-2 text-center shadow-[0_0_26px_rgba(0,0,0,0.9)]">
              <div className="pixel text-[9px] text-[#e7c55a]">[ E ] {prompt.desc.toUpperCase()}</div>
              <div className="mt-1 text-[11px] text-ash-300">
                {prompt.icon} {prompt.name} — {prompt.label}
              </div>
            </div>
          )}

          <div className="absolute bottom-14 left-4 grid grid-cols-3 gap-1 sm:hidden">
            {[["", "w", ""], ["a", "", "d"], ["", "s", ""]].map((row, ri) =>
              row.map((dir, ci) =>
                dir ? (
                  <button
                    key={`${ri}-${ci}`}
                    onPointerDown={() => dpad(dir, true)}
                    onPointerUp={() => dpad(dir, false)}
                    onPointerLeave={() => dpad(dir, false)}
                    className="h-11 w-11 border-2 border-ash-600 bg-ash-900/90 text-lg text-ash-300"
                  >
                    {dir === "w" ? "▲" : dir === "s" ? "▼" : dir === "a" ? "◀" : "▶"}
                  </button>
                ) : (
                  <span key={`${ri}-${ci}`} />
                )
              )
            )}
          </div>
          {isMobile ? (
            <div className="hub-touch-controls">
              <TouchStick
                label="Джойстик движения по лагерю"
                size={116}
                onVector={(x, y, mag) => {
                  keys.current["a"] = x < -0.25;
                  keys.current["d"] = x > 0.25;
                  keys.current["w"] = y < -0.25;
                  keys.current["s"] = y > 0.25;
                  keys.current["shift"] = mag > 0.92;
                }}
                onEnd={() => {
                  keys.current["a"] = keys.current["d"] = keys.current["w"] = keys.current["s"] = keys.current["shift"] = false;
                }}
              />
              {prompt && !dialog && !paused && tourIdx === null && (
                <button
                  type="button"
                  className="hub-touch-interact"
                  onPointerDown={() => interact(prompt.id)}
                >
                  <b>E</b>
                  <small>войти</small>
                </button>
              )}
            </div>
          ) : (
            prompt && !dialog && !paused && (
              <button
                onClick={() => interact(prompt.id)}
                className="absolute bottom-16 right-4 border-2 border-[#c9a74a] bg-ash-950/95 px-4 py-3 text-[12px] font-bold text-[#e7c55a] sm:hidden"
              >
                E
              </button>
            )
          )}
          {tourIdx !== null && (
            <div className="tour-card" role="dialog" aria-label="Обучение в лобби">
              <div className="tour-card-head">
                <span>ОБЛЁТ БАЗЫ · {tourIdx + 1}/{TOUR_STEPS.length}</span>
                <button type="button" onClick={() => endTour(true)}>Пропустить</button>
              </div>
              <div className="tour-card-title">{TOUR_STEPS[tourIdx].title}</div>
              <div className="tour-card-text">{TOUR_STEPS[tourIdx].text}</div>
              <div className="tour-card-dots">
                {TOUR_STEPS.map((s, i) => (
                  <i key={s.id} className={i === tourIdx ? "on" : i < tourIdx ? "done" : ""} />
                ))}
              </div>
              <div className="tour-card-actions">
                {tourIdx > 0 && (
                  <button type="button" className="tour-back" onClick={() => setTourIdx(tourIdx - 1)}>
                    ← Назад
                  </button>
                )}
                <button
                  type="button"
                  className="tour-next"
                  onClick={() => {
                    if (tourIdx >= TOUR_STEPS.length - 1) endTour(false);
                    else setTourIdx(tourIdx + 1);
                  }}
                >
                  {tourIdx >= TOUR_STEPS.length - 1 ? "В бой! ✓" : "Далее →"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {npcNote && (
            <div className="ruined-sm border border-[#c9a74a]/50 bg-[#c9a74a]/10 px-3 py-2 text-[11px] leading-4 text-[#e7c55a]">{npcNote}</div>
          )}

          <Panel tone="rust" title={`Следующий рейд · Р-${nextLevel.num}`} right={<Tag tone="blood">Опасность {nextLevel.danger}/10</Tag>}>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-rust-400/60 bg-ash-950 text-2xl">
                {nextLevel.icon}
              </div>
              <div className="min-w-0">
                <div className="pixel text-[10px] leading-4 text-rust-50">{nextLevel.name}</div>
                <div className="mt-1 text-[11px] text-ash-400">
                  {nextLevel.waves} волн · от <span className="term text-base text-toxic-300">{nextLevel.reward} ⚙️</span>
                </div>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-ash-400">{nextLevel.description}</p>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <GameButton variant="primary" className="py-2.5" onClick={() => navigateFromCamp("worldmap")}>
                🚶 К воротам
              </GameButton>
              <GameButton className="py-2.5" onClick={onMap} title="Сразу открыть выбор района">
                🗺
              </GameButton>
            </div>
          </Panel>

          <Panel title="План лагеря B-7">
            <svg viewBox={`0 0 ${WORLD_W * planScale} ${WORLD_H * planScale}`} className="block w-full border border-ash-800 bg-[#10150f]">
              <rect x={WALL.x * planScale} y={WALL.y * planScale} width={WALL.w * planScale} height={WALL.h * planScale} fill="#2b2e28" stroke="#8b8c85" strokeWidth={3} />
              <rect x={(GATE.x - GATE.half) * planScale} y={(WALL.y - 4) * planScale} width={GATE.half * 2 * planScale} height={6} fill="#e7c55a" />
              <circle cx={PLAZA.x * planScale} cy={PLAZA.y * planScale} r={PLAZA.r * planScale} fill="#3d3c34" />
              <circle cx={PLAZA.x * planScale} cy={PLAZA.y * planScale} r={3} fill="#ff9c3f" />
              {HUB_OBJECTS.filter((o) => o.kind === "portal").map((o) => {
                const r = objRect(o);
                return (
                  <g key={o.id} className="cursor-pointer" onClick={() => walkTo(o)}>
                    <rect x={r.x * planScale} y={r.y * planScale} width={r.w * planScale} height={r.h * planScale} fill={o.color} stroke={prompt?.id === o.id ? "#e7c55a" : "#1c211f"} strokeWidth={1.5} />
                    <text x={o.x * planScale} y={o.y * planScale + 4} textAnchor="middle" fontSize={11}>{o.icon}</text>
                  </g>
                );
              })}
              <circle cx={plan.x * planScale} cy={plan.y * planScale} r={4} fill="#f0d18c" stroke="#fff6d8" strokeWidth={1.5} />
            </svg>
            <div className="mt-1.5 flex justify-between text-[9px] uppercase tracking-wider text-ash-500">
              <span>клик по зданию — идти</span>
              <span className="text-[#e7c55a]">▲ ворота</span>
            </div>
          </Panel>

          <Panel title="Навыки" right={<Tag tone={save.skillPoints > 0 ? "gold" : "ash"}>{save.skillPoints} очк.</Tag>}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center border-2 border-[#c9a74a] bg-[#221d12] text-xl">🎖</div>
              <div className="min-w-0 flex-1 text-[11px] text-ash-300">
                Очки навыков капают <b className="text-toxic-300">после рейда</b>: за зачистку, звёзды и убийства.
                Прокачка открывает новые уровни и целые ветки.
              </div>
            </div>
            <div className="mt-2.5 grid gap-2">
              <GameButton variant={save.skillPoints > 0 ? "primary" : "default"} onClick={() => go("skills")}>
                🎖 Навыки
              </GameButton>
              <div className="grid grid-cols-2 gap-2">
                <GameButton onClick={() => navigateFromCamp("weapons")}>🔫 Оружейная</GameButton>
                <GameButton onClick={() => navigateFromCamp("equipment")}>🛡 Броня{affordableEquip > 0 ? ` (${affordableEquip})` : ""}</GameButton>
              </div>
            </div>
          </Panel>

          <div className="flex items-center justify-between gap-2">
            <CurrencyChip amount={save.currency} />
            <GameButton variant="ghost" onClick={() => { if (tourIdx === null) setPaused(true); }}>⏸ Меню</GameButton>
          </div>
        </div>
      </div>

      <Modal open={paused} title="МЕНЮ БАЗЫ" onClose={() => setPaused(false)} width="max-w-md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <GameButton onClick={() => setPaused(false)} variant="primary" className="col-span-2">▶ Продолжить</GameButton>
            <GameButton onClick={() => navigateFromCamp("worldmap")}>🚧 К воротам</GameButton>
            <GameButton onClick={() => navigateFromCamp("weapons")}>🔫 В оружейную</GameButton>
            <GameButton onClick={() => navigateFromCamp("equipment")}>🛡 К броннику</GameButton>
            <GameButton onClick={() => navigateFromCamp("inventory")}>🎒 На склад</GameButton>
            <GameButton onClick={() => navigateFromCamp("settings")}>⚙ В радиорубку</GameButton>
            <GameButton onClick={() => go("menu")}>⏏ Главное меню</GameButton>
          </div>
          <p className="text-[11px] text-ash-500">Прогресс сохраняется автоматически.</p>
        </div>
      </Modal>

      {dialog && dialog.script && NPC_SCRIPTS[dialog.script] && (
        <DialogueScene
          script={NPC_SCRIPTS[dialog.script]}
          rapport={rapport[dialog.script] ?? 0}
          onClose={() => setDialog(null)}
          onEffects={(effects) => {
            if (!effects.length) return;
            let mood = rapport[dialog.script!] ?? 0;
            let discount = npcDiscount;
            for (const effect of effects) {
              if (effect.mood) mood = Math.max(-2, Math.min(2, mood + effect.mood));
              if (effect.discount) discount = Math.max(discount, effect.discount);
            }
            setRapport((prev) => ({ ...prev, [dialog.script!]: mood }));
            setNpcDiscount(discount);
            const note = effects.find((e) => e.note)?.note;
            if (note) setNpcNote(note);
          }}
        />
      )}

      {dialog && !dialog.script && (
        <Modal open onClose={() => setDialog(null)} title={dialog.name} width="max-w-lg">
          <div className="space-y-4">
            <p className="term text-xl leading-6 text-ash-200">{dialog.dialog?.[dialogIdx]}</p>
            <div className="flex justify-end gap-2">
              {dialog.dialog && dialogIdx < dialog.dialog.length - 1 ? (
                <GameButton variant="primary" onClick={() => setDialogIdx((i) => i + 1)}>Далее ▶</GameButton>
              ) : (
                <GameButton variant="primary" onClick={() => setDialog(null)}>Понял</GameButton>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
