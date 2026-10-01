import type { Weapon } from "./types";

type Point = { x: number; y: number };
type Family = "pistol" | "revolver" | "shotgun" | "smg" | "rifle" | "sniper" | "machinegun" | "knife" | "machete" | "axe";
type Geometry = { family: Family; back: number; front: number; width: number; grip: Point; support: Point; wood?: boolean };

// One shared scale: a shoulder span is about 22 px; a 20 cm pistol is about 8 px.
const MODELS: Record<string, Geometry> = {
  w_pm17: { family: "pistol", back: 13, front: 21, width: 3.1, grip: { x: 14.8, y: 6.5 }, support: { x: 13.8, y: 4.2 } },
  w_magnum: { family: "revolver", back: 12.2, front: 24.5, width: 3.8, grip: { x: 14.2, y: 6.5 }, support: { x: 13.5, y: 4 } },
  w_obrez: { family: "shotgun", back: 7, front: 26, width: 5.1, grip: { x: 10.7, y: 6.5 }, support: { x: 19.5, y: 3.5 }, wood: true },
  w_remington: { family: "shotgun", back: -4, front: 36, width: 5.4, grip: { x: 10.8, y: 6.5 }, support: { x: 22, y: 3.2 }, wood: true },
  w_vihr: { family: "smg", back: 4, front: 27, width: 4.3, grip: { x: 13, y: 6.5 }, support: { x: 20, y: 3.5 } },
  w_ak74: { family: "rifle", back: -3, front: 33, width: 4.5, grip: { x: 11.5, y: 6.5 }, support: { x: 23, y: 3.1 }, wood: true },
  w_m4karat: { family: "rifle", back: -3, front: 31, width: 4.2, grip: { x: 11.5, y: 6.5 }, support: { x: 21.5, y: 3.1 } },
  w_barracuda: { family: "shotgun", back: -3, front: 34, width: 6.2, grip: { x: 11.5, y: 6.5 }, support: { x: 24, y: 3.2 } },
  w_svd: { family: "sniper", back: -5, front: 40, width: 4.2, grip: { x: 10.8, y: 6.5 }, support: { x: 24.5, y: 3.2 }, wood: true },
  w_mjasorubka: { family: "machinegun", back: -4, front: 38, width: 6, grip: { x: 11.2, y: 7 }, support: { x: 24, y: 3.6 } },
  w_knife_combat: { family: "knife", back: 12, front: 23, width: 2.7, grip: { x: 14.5, y: 5 }, support: { x: 6, y: -12 } },
  w_machete_stalker: { family: "machete", back: 10, front: 32, width: 3.9, grip: { x: 13, y: 5 }, support: { x: 6, y: -12 } },
  w_axe_fire: { family: "axe", back: 5, front: 35, width: 4, grip: { x: 13, y: 5 }, support: { x: 21, y: 4 } },
};

function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#0e1413";
  ctx.lineWidth = 0.7;
  ctx.strokeRect(x, y, w, h);
}

function limb(ctx: CanvasRenderingContext2D, from: Point, to: Point, a: number, b: number, color: string) {
  const length = Math.max(0.01, Math.hypot(to.x - from.x, to.y - from.y));
  const nx = -(to.y - from.y) / length;
  const ny = (to.x - from.x) / length;
  ctx.beginPath();
  ctx.moveTo(from.x + nx * a, from.y + ny * a);
  ctx.lineTo(to.x + nx * b, to.y + ny * b);
  ctx.quadraticCurveTo(to.x + (to.x - from.x) / length, to.y + (to.y - from.y) / length, to.x - nx * b, to.y - ny * b);
  ctx.lineTo(from.x - nx * a, from.y - ny * a);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#202922";
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

function arm(ctx: CanvasRenderingContext2D, shoulder: Point, elbow: Point, hand: Point, sleeve: string) {
  limb(ctx, shoulder, elbow, 3.1, 2.25, sleeve);
  const cuff = { x: elbow.x + (hand.x - elbow.x) * 0.5, y: elbow.y + (hand.y - elbow.y) * 0.5 };
  limb(ctx, elbow, cuff, 2.3, 1.8, sleeve);
  limb(ctx, cuff, hand, 1.65, 1.18, "#b39170");
  ctx.strokeStyle = "#8b967c";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(elbow.x - 1.3, elbow.y - 1);
  ctx.lineTo(elbow.x + 1.3, elbow.y + 1);
  ctx.stroke();
}

function hand(ctx: CanvasRenderingContext2D, at: Point, flip: boolean) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(1, flip ? -1 : 1);
  ctx.beginPath();
  ctx.moveTo(-2.7, 1.15);
  ctx.lineTo(-2.8, -0.9);
  ctx.quadraticCurveTo(-0.5, -1.65, 1.5, -1.2);
  ctx.lineTo(2.4, 0.7);
  ctx.lineTo(1.2, 2.1);
  ctx.lineTo(-1.4, 2.25);
  ctx.closePath();
  ctx.fillStyle = "#c6a17e";
  ctx.fill();
  ctx.strokeStyle = "#5c4637";
  ctx.lineWidth = 0.55;
  ctx.stroke();
  // Four fingers curl over the grip; the thumb crosses the opposite side.
  for (let finger = 0; finger < 4; finger++) {
    ctx.fillStyle = finger % 2 ? "#bd9370" : "#d1ac89";
    ctx.fillRect(-1.7 + finger * 0.94, -1.5, 0.72, 2.2 - finger * 0.15);
    ctx.strokeStyle = "#8b654c";
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(-1.65 + finger * 0.94, -0.35);
    ctx.lineTo(-1.1 + finger * 0.94, -0.45);
    ctx.stroke();
  }
  ctx.strokeStyle = "#d5b28e";
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-1.9, 1.5);
  ctx.quadraticCurveTo(-0.4, 1.9, 0.3, 0.75);
  ctx.stroke();
  ctx.restore();
}

function drawGun(ctx: CanvasRenderingContext2D, weapon: Weapon, m: Geometry) {
  const axis = 4;
  const half = m.width / 2;
  const small = m.family === "pistol" || m.family === "revolver";
  const wood = m.wood ? "#7a5032" : "#35433b";
  if (small) {
    plate(ctx, m.grip.x - 1.3, axis + 0.8, 2.8, 4.8, "#42382e");
    plate(ctx, m.back, axis - half, m.front - m.back, m.width, m.family === "revolver" ? "#697570" : "#56615b");
    ctx.fillStyle = "#8c9690";
    ctx.fillRect(m.back + 0.6, axis - half + 0.45, m.front - m.back - 1.2, 0.55);
    if (m.family === "revolver") {
      plate(ctx, m.back + 3, axis - half - 0.6, 3.7, m.width + 1.2, "#7b7c64");
      ctx.fillStyle = "#323831";
      ctx.fillRect(m.back + 3.5, axis - 0.6, 2.7, 0.8);
    } else {
      ctx.fillStyle = "#222c27";
      ctx.fillRect(m.back + 3, axis - 0.7, 1.8, 1.3);
    }
  } else if (["knife", "machete", "axe"].includes(m.family)) {
    plate(ctx, m.back, axis - 1.25, m.family === "axe" ? m.front - m.back - 1 : 6, 2.5, wood);
    if (m.family === "axe") {
      ctx.beginPath(); ctx.moveTo(m.front - 5, axis - 3); ctx.lineTo(m.front + 1, axis - 6); ctx.lineTo(m.front + 2, axis + 6); ctx.lineTo(m.front - 5, axis + 3); ctx.closePath();
      ctx.fillStyle = "#a44333"; ctx.fill(); ctx.strokeStyle = "#25251e"; ctx.stroke();
      ctx.strokeStyle = "#c3c9be"; ctx.beginPath(); ctx.moveTo(m.front + 1, axis - 6); ctx.lineTo(m.front + 2, axis + 6); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(m.back + 5, axis - half); ctx.lineTo(m.front - 2, axis - half); ctx.lineTo(m.front, axis); ctx.lineTo(m.front - 3, axis + half); ctx.lineTo(m.back + 5, axis + half); ctx.closePath();
      ctx.fillStyle = "#a8b8ad"; ctx.fill(); ctx.strokeStyle = "#24302a"; ctx.stroke();
      ctx.strokeStyle = "#e0e6d4"; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(m.back + 6, axis + half - 0.3); ctx.lineTo(m.front - 3, axis + half - 0.3); ctx.stroke();
    }
  } else {
    const receiver = m.family === "machinegun" ? 16 : 11;
    const start = m.grip.x - 2.2;
    ctx.beginPath();
    ctx.moveTo(m.back, axis - half * 0.8); ctx.lineTo(start, axis - 1.5); ctx.lineTo(start, axis + 1.5); ctx.lineTo(m.back, axis + half); ctx.closePath();
    ctx.fillStyle = wood; ctx.fill(); ctx.strokeStyle = "#17221c"; ctx.lineWidth = 0.8; ctx.stroke();
    plate(ctx, m.back, axis - half, 1.8, m.width, "#1e2823");
    plate(ctx, start, axis - half, receiver, m.width, "#46534b");
    plate(ctx, start + receiver - 1, axis - 1.2, m.front - start - receiver + 1, 2.4, "#68736c");
    if (m.family === "shotgun") {
      plate(ctx, m.support.x - 4, axis - half - 0.4, 8, m.width + 0.8, wood);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = "#292b22"; ctx.fillRect(m.support.x - 3 + i * 1.4, axis - half, 0.5, m.width); }
      ctx.fillStyle = "#6d7666"; ctx.fillRect(m.support.x + 4.5, axis + 1.1, m.front - m.support.x - 7, 1.1);
    } else {
      plate(ctx, m.support.x - 3.5, axis - half, 8, m.width, wood);
      ctx.fillStyle = "#111c17";
      for (let i = 0; i < 4; i++) ctx.fillRect(m.support.x - 2.5 + i * 1.7, axis - half + 0.5, 0.8, 0.8);
    }
    plate(ctx, m.grip.x - 0.9, axis + half - 0.3, 2.6, 3.5, "#2c3028");
    if (m.family === "machinegun") {
      plate(ctx, start + 6, axis + half, 7, 6, "#59613f");
      ctx.fillStyle = "#b1a368"; for (let i = 0; i < 5; i++) ctx.fillRect(start + 6.5 + i * 1.2, axis + half + 1, 0.6, 2);
      ctx.strokeStyle = "#7a8579"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m.front - 5, axis); ctx.lineTo(m.front - 9, axis + 5.5); ctx.moveTo(m.front - 5, axis); ctx.lineTo(m.front - 9, axis - 5.5); ctx.stroke();
    } else if (m.family !== "shotgun") {
      plate(ctx, start + 6, axis + half - 0.2, 3.4, 4.1, weapon.id === "w_ak74" ? "#6b4a2f" : "#27342c");
    }
    if (m.family === "sniper" || weapon.id === "w_m4karat") {
      plate(ctx, start + 0.5, axis - 1, m.family === "sniper" ? 10 : 6, 2.1, "#182320");
      ctx.fillStyle = "#83a6a0"; ctx.fillRect(start + (m.family === "sniper" ? 10 : 6), axis - 1, 0.8, 2.1);
    }
    ctx.fillStyle = "#7f8e7f";
    ctx.fillRect(start + 0.4, axis - half + 0.3, receiver - 1, 0.6);
    plate(ctx, m.front - 1, axis - 1.5, 1.5, 3, "#18241f");
  }
}

export function drawHeldWeapon(ctx: CanvasRenderingContext2D, weapon: Weapon, recoil: number, reload: number, fallbackKnife = false): Point {
  const model = MODELS[fallbackKnife ? "w_knife_combat" : weapon.id] ?? MODELS.w_pm17;
  const melee = ["knife", "machete", "axe"].includes(model.family);
  const recoilShift = Math.min(recoil, model.family === "pistol" ? 2 : 4) * 0.55;
  const grip = { x: model.grip.x - recoilShift, y: model.grip.y };
  const reloadReach = reload >= 0 ? Math.sin(Math.PI * reload) : 0;
  const support = { x: model.support.x - recoilShift - reloadReach * 7, y: model.support.y + reloadReach * 8 };
  const meleeAngle = melee ? -Math.max(0, recoil - 1) * 0.11 : 0;

  ctx.save();
  ctx.rotate(meleeAngle);
  arm(ctx, { x: 0, y: 8 }, { x: 7, y: 12 }, grip, "#65776a");
  arm(ctx, { x: 0, y: -8 }, { x: 9, y: -11 }, support, "#586c61");
  ctx.save();
  ctx.translate(-recoilShift, 0);
  drawGun(ctx, weapon, model);
  ctx.restore();
  hand(ctx, grip, false);
  hand(ctx, support, true);
  ctx.restore();
  return { x: model.front - recoilShift + 0.5, y: 4 };
}