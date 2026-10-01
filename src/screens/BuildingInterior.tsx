import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { BUILDINGS } from "../game/buildings";
import { sfx } from "../game/audio";
import { CurrencyChip } from "../game/ui";
import { store, useSave } from "../game/save";
import { profiles } from "../game/profiles";
import { createInterior, pushFromFurniture, roomRoute, type RoomRect, type RoomPoint } from "../game/interiors";
import type { BuildingId } from "../game/types";

// ============================================================
// ИНТЕРЬЕР ЗДАНИЯ: комната с прилавком и кассиром. Интерфейс
// раздела открывается только у NPC (клавиша E у прилавка).
// ============================================================

const W = 960;
const H = 560;
const CLERK_POINT = { x: 480, y: 268 };
const EXIT_POINT = { x: 480, y: 508 };

const pos: Record<string, { x: number; y: number; vx: number; vy: number; face: number; walk: number }> = {};

function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, face: number, color: string, now: number, walking = false) {
  const step = walking ? Math.sin(now * 0.02) * 3 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(face + Math.PI / 2);
  ctx.fillStyle = "#2c2f2c";
  ctx.fillRect(-6, -2 + step, 5, 7);
  ctx.fillRect(1, -2 - step, 5, 7);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#15181a";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#c9a074";
  ctx.beginPath();
  ctx.arc(0, -3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export default function BuildingInterior({
  id,
  onExit,
  onCounter,
}: {
  id: BuildingId;
  onExit: () => void;
  onCounter: (snapshot: string) => void;
}) {
  const info = BUILDINGS[id];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Record<string, boolean>>({});
  const destination = useRef<{ x: number; y: number; action?: string; path: RoomPoint[] } | null>(null);
  const solidsRef = useRef<RoomRect[]>([]);
  const nearRef = useRef<string | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const save = useSave();
  const cb = useRef({ onExit, onCounter });
  cb.current = { onExit, onCounter };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    pos[id] ??= { x: 480, y: 430, vx: 0, vy: 0, face: -Math.PI / 2, walk: 0 };
    const player = pos[id];
    keys.current = {};
    destination.current = null;

    const room = createInterior(id);
    const background = room.canvas;
    solidsRef.current = room.solids;
    pushFromFurniture(player, room.solids);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const k = keys.current;
      let dx = 0, dy = 0;
      if (k["KeyA"] || k["ArrowLeft"]) dx -= 1;
      if (k["KeyD"] || k["ArrowRight"]) dx += 1;
      if (k["KeyW"] || k["ArrowUp"]) dy -= 1;
      if (k["KeyS"] || k["ArrowDown"]) dy += 1;
      if (dx !== 0 || dy !== 0) {
        destination.current = null;
      } else if (destination.current) {
        const t = destination.current;
        const next = t.path[0];
        const tx = next.x - player.x;
        const ty = next.y - player.y;
        const td = Math.hypot(tx, ty);
        if (td < 8) {
          t.path.shift();
          if (!t.path.length) {
            const action = t.action;
            destination.current = null;
            player.vx = player.vy = 0;
            if (action === "counter") { sfx.uiConfirm(); cb.current.onCounter(canvas.toDataURL("image/png")); }
            else if (action === "exit") { pos[id] = { x: 480, y: 430, vx: 0, vy: 0, face: -Math.PI / 2, walk: 0 }; cb.current.onExit(); }
          }
        } else {
          dx = tx / td;
          dy = ty / td;
        }
      }
      const l = Math.hypot(dx, dy);
      if (l > 0) { dx /= l; dy /= l; }
      player.vx += (dx * 190 - player.vx) * Math.min(1, dt * 11);
      player.vy += (dy * 190 - player.vy) * Math.min(1, dt * 11);
      player.x = Math.max(40, Math.min(W - 40, player.x + player.vx * dt));
      player.y = Math.max(130, Math.min(H - 30, player.y + player.vy * dt));
      pushFromFurniture(player, room.solids);
      const len = Math.hypot(player.vx, player.vy);
      if (len > 25) {
        player.face = Math.atan2(player.vy, player.vx);
        sfx.footstep(false);
      }

      // ближайшая точка
      const dClerk = Math.hypot(player.x - CLERK_POINT.x, player.y - CLERK_POINT.y);
      const dExit = Math.hypot(player.x - EXIT_POINT.x, player.y - EXIT_POINT.y);
      const nearest = dClerk < 72 ? "counter" : dExit < 60 ? "exit" : null;
      if (nearest !== nearRef.current) {
        nearRef.current = nearest;
        setNear(nearest);
      }

      const graphics = store.getSnapshot().settings.graphicsQuality;
      const scale = graphics === "low" ? 0.75 : graphics === "high" ? 1.5 : 1;
      if (canvas.width !== W * scale) { canvas.width = W * scale; canvas.height = H * scale; }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = graphics !== "low";
      canvas.style.imageRendering = graphics === "low" ? "pixelated" : "auto";
      ctx.drawImage(background, 0, 0);
      // свет ламп
      for (const lx of [260, 480, 700]) {
        const gr = ctx.createRadialGradient(lx, 130, 0, lx, 130, 190);
        gr.addColorStop(0, id === "weapons" ? "rgba(233,153,67,0.16)" : "rgba(168,212,178,0.11)");
        gr.addColorStop(1, "transparent");
        ctx.fillStyle = gr;
        ctx.fillRect(lx - 190, 0, 380, 320);
      }
      // кассир за прилавком
      const clerkBody = id === "weapons" ? "#765037" : id === "equipment" ? "#547460" : id === "hq" ? "#657c5b" : "#6b6551";
      drawPerson(ctx, 480, 158 + Math.sin(now * 0.002) * 1.5, Math.PI / 2 + Math.sin(now * 0.0015) * 0.12, clerkBody, now);
      ctx.fillStyle = "#101615";
      ctx.fillRect(432, 108, 96, 22);
      ctx.strokeStyle = info.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(432, 108, 96, 22);
      ctx.fillStyle = info.accent;
      ctx.textAlign = "center";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillText(info.clerk, 480, 123);

      // дополнительные выжившие
      if (id === "weapons") {
        drawPerson(ctx, 303, 350, 0.3, "#555e53", now);
        ctx.font = "10px Inter, sans-serif";
        ctx.fillStyle = "#c0b8a0";
        ctx.fillText("Караульный", 303, 327);
      } else if (id === "equipment") {
        drawPerson(ctx, 650, 366, Math.PI, "#7b6954", now);
        ctx.font = "10px Inter, sans-serif";
        ctx.fillStyle = "#c0b8a0";
        ctx.fillText("Портной", 650, 342);
      } else if (id === "hq") {
        drawPerson(ctx, 310, 330, 0, "#5c6752", now);
      }

      if (nearRef.current === "counter") {
        ctx.strokeStyle = info.accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(CLERK_POINT.x, CLERK_POINT.y, 22 + Math.sin(now * 0.006) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      drawPerson(ctx, player.x, player.y, player.face, "#55736d", now, len > 25);
      ctx.fillStyle = "#f0d18c";
      ctx.textAlign = "center";
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.fillText(profiles.getSnapshot()?.displayName ?? "ВЫ", player.x, player.y - 21);

      // виньетка комнаты
      const grad = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 560);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      raf = requestAnimationFrame(loop);
    };

    const keydown = (ev: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(ev.code)) ev.preventDefault();
      if (ev.code === "Escape") {
        pos[id] = { x: 480, y: 430, vx: 0, vy: 0, face: -Math.PI / 2, walk: 0 };
        cb.current.onExit();
      } else if (ev.code === "KeyE" || ev.code === "Enter") {
        if (nearRef.current === "counter") { sfx.uiConfirm(); cb.current.onCounter(canvas.toDataURL("image/png")); }
        else if (nearRef.current === "exit") { sfx.uiClick(); pos[id] = { x: 480, y: 430, vx: 0, vy: 0, face: -Math.PI / 2, walk: 0 }; cb.current.onExit(); }
      }
      keys.current[ev.code] = true;
    };
    const keyup = (ev: KeyboardEvent) => { keys.current[ev.code] = false; };
    const blur = () => { keys.current = {}; };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }, [id, info.accent, info.clerk, info.floor, info.wall]);

  const walkTo = (target: RoomPoint & { action?: string }) => {
    const player = pos[id];
    if (!player) return;
    const path = roomRoute(player, target, solidsRef.current);
    destination.current = path.length ? { ...target, path } : null;
  };

  const click = (ev: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * W;
    const y = ((ev.clientY - rect.top) / rect.height) * H;
    if (y < 236 && x > 310 && x < 650) {
      if (nearRef.current === "counter") { sfx.uiConfirm(); onCounter(ev.currentTarget.toDataURL("image/png")); }
      else walkTo({ ...CLERK_POINT, action: "counter" });
    } else if (y > 500 && x > 380 && x < 580) {
      if (nearRef.current === "exit") onExit();
      else walkTo({ ...EXIT_POINT, action: "exit" });
    } else {
      walkTo({ x, y });
    }
  };

  return (
    <div className="w-full max-w-[1100px] space-y-2">
      <header className="ruined-sm relative flex flex-wrap items-center justify-between gap-2 bg-[#17201b] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="pixel text-[11px]" style={{ color: info.accent }}>{info.sign}</span>
          <span className="hidden text-[11px] text-ash-400 sm:inline">{info.clerkLine}</span>
        </div>
        <div className="flex items-center gap-2">
          <CurrencyChip amount={save.currency} compact />
          <button onClick={onExit} className="border border-ash-600 px-3 py-1.5 text-[11px] text-ash-200 hover:border-rust-400">← В лагерь</button>
        </div>
      </header>
      <div className="relative border-2 border-ash-600 bg-ash-950 shadow-2xl">
        <canvas ref={canvasRef} width={W} height={H} onClick={click} className="block h-auto w-full cursor-pointer" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 border border-ash-600 bg-[#0d1412]/95 px-4 py-2 text-center text-[11px] text-ash-300 shadow-xl">
          {near === "counter" ? (
            <span className="font-bold" style={{ color: info.accent }}>[ E ] {info.action.toUpperCase()}</span>
          ) : near === "exit" ? (
            <span className="text-[#e7c55a]">[ E ] ВЫЙТИ В ЛАГЕРЬ</span>
          ) : (
            <span>
              WASD — пройти по комнате · подойдите к <b style={{ color: info.accent }}>{info.clerk}</b> и нажмите E · клик — идти
            </span>
          )}
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1.5 sm:hidden">
          <button
            onClick={() =>
              near === "counter"
                ? onCounter(canvasRef.current?.toDataURL("image/png") ?? "")
                : walkTo({ ...CLERK_POINT, action: "counter" })
            }
            className="border border-ash-500 bg-ash-900 px-3 py-2 text-xs text-ash-100"
          >
            E · {info.action}
          </button>
        </div>
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-ash-500">
        <span>Сектор B-7 / {info.number} / {info.name}</span>
        <span>Освещение: автономная сеть</span>
      </div>
    </div>
  );
}
