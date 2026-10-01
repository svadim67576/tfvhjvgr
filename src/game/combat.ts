import { armorReduction, gradeTime, isMelee, weaponPhysics, type WeaponPhysics } from "./data";
import { sfx } from "./audio";
import { drawHeldWeapon } from "./heldWeapon";
import { NEUTRAL_MODS, type CombatSkillMods } from "./skills";
import type { LevelDef, Settings, Stats, Weapon, WeaponSlot } from "./types";

// ============================================================
// OUTBREAK — Боевой движок с тяжёлой физикой тела и оружия
// - Инерция движения (разгон, торможение, масса оружия, шаг с пылью)
// - Инерция наведения ствола (тяжёлые пулемёты и винтовки доворачиваются с весом)
// - Отдача при выстреле (импульс в плечо стрелка, откат затвора, подброс, гильзы, дым)
// - Зомби с массой, неравномерной тяжёлой походкой, оглушением (stagger) и импульсом от пули
// ============================================================

export const VIEW_W = 960;
export const VIEW_H = 560;
const WORLD_W = 2400;
const WORLD_H = 1600;
const MAX_ALIVE = 45;
const BULLET_SPEED = 980;

type ZKind = "walker" | "runner" | "spitter" | "fatty" | "armored" | "boss";

interface Zombie {
  id: number;
  kind: ZKind;
  name: string;
  x: number; y: number; vx: number; vy: number;
  r: number; mass: number;
  hp: number; maxHp: number;
  speed: number; dmg: number; dmgMul: number;
  color: string; scrap: number;
  flash: number; staggerT: number; hitTwist: number;
  atkCd: number; abilityCd: number; summonCd: number;
  state: "chase" | "telegraph" | "charge";
  stateT: number; dirX: number; dirY: number;
  phase: number; face: number;
  /** Элитная особь: больше HP/скорости/лута, красное свечение глаз. */
  elite: boolean;
  /** Рывок бегуна: >0 телеграф (мигает), <0 передышка */
  lungeT: number; lungeCd: number;
  /** Вариант внешности 0..3: одежда, кожа, повреждения (только визуал). */
  variant: number;
}

interface Obstacle { x: number; y: number; w: number; h: number; kind: "building" | "car" | "barricade" | "container"; }
interface Barrel { x: number; y: number; hp: number; alive: boolean; fuse: number; }
interface Bullet { x: number; y: number; vx: number; vy: number; range: number; dmg: number; pierce: number; hits: Set<number>; shotId: number; }
interface Shell { x: number; y: number; vx: number; vy: number; z: number; vz: number; rot: number; vrot: number; life: number; max: number; color: string; }
interface EnemyShot { x: number; y: number; vx: number; vy: number; life: number; dmg: number; }
interface Drop { x: number; y: number; kind: "scrap" | "medkit"; value: number; life: number; bob: number; }
interface Pool { x: number; y: number; r: number; life: number; acid: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grow?: number; rot?: number; vrot?: number; kind?: "spark" | "smoke" | "glow" | "ember" | "debris"; }
interface Scorch { x: number; y: number; r: number; life: number; max: number; }
interface FText { text: string; x: number; y: number; vy: number; life: number; color: string; size: number; }
interface Blast { x: number; y: number; t: number; r: number; }
interface SupplyCrate { x: number; y: number; kind: "scrap" | "grenade" | "medkit"; opened: boolean; phase: number; }
interface ThrownGrenade { x: number; y: number; vx: number; vy: number; z: number; vz: number; fuse: number; }

// Base cone per spread class (radians). Low spread must actually be tight.
const SPREAD_BASE: Record<string, number> = { низкий: 0.022, средний: 0.05, высокий: 0.095 };

/**
 * Lighter handling for a mouse-driven shooter: weapons keep their personality
 * (weight, stopping power) but recoil, bloom and turn inertia are softened.
 */
function easeWeapon(p: WeaponPhysics): WeaponPhysics {
  return {
    ...p,
    turnSpeed: Math.max(20, p.turnSpeed * 1.9),
    barrelKick: p.barrelKick * 0.6,
    shooterPush: p.shooterPush * 0.32,
    angleKick: p.angleKick * 0.38,
    bloomPerShot: p.bloomPerShot * 0.42,
    bloomRecovery: p.bloomRecovery * 1.9,
  };
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

// ---------- КУВЫРОК ----------
/** Полная длительность переката, с. */
const ROLL_TIME = 0.46;
/** Кулдаун после завершения переката, с. Не даёт спамить. */
const ROLL_CD = 1.15;
/** Пиковый множитель к скорости бойца на разгоне переката. */
const ROLL_PEAK = 3.1;

/**
 * Профиль скорости кувырка: короткий взрывной разгон (толчок ногами),
 * затем плавное торможение — боец гасит инерцию, вставая на ноги.
 */
function rollSpeedCurve(p: number) {
  if (p <= 0) return 0;
  if (p < 0.22) return easeOutCubic(p / 0.22);
  const t = (p - 0.22) / 0.78;
  return Math.pow(1 - t, 1.7);
}

export interface CombatInput {
  up: boolean; down: boolean; left: boolean; right: boolean;
  sprint: boolean; fire: boolean; autoAim: boolean; aim: boolean;
  mouseX: number; mouseY: number;
}

export interface HudState {
  hp: number; hpTrail: number; maxHp: number; armorPct: number;
  stamina: number; exhausted: boolean;
  ammo: number; mag: number; reserve: number;
  weaponId: string; activeSlot: WeaponSlot;
  sidearmId: string | null; primaryId: string | null; canSwap: boolean;
  grenades: number; crateNear: boolean; melee: boolean;
  slotAmmo: Record<WeaponSlot, number>;
  reload: number;
  /** готовность кувырка: 1 — готов, 0..1 — откат */
  roll: number;
  wave: number; waves: number; waveLeft: number; waveTotal: number;
  kills: number; accuracy: number; scrap: number; time: number;
  boss: { name: string; hp: number; max: number } | null;
  banner: { title: string; sub: string } | null;
  phase: "ready" | "wave" | "break" | "ended";
  breakLeft: number;
  stance: "steady" | "moving" | "recoil";
  camZoom: number;
  /** прицеливание по ПКМ активно */
  aiming: boolean;
}

export interface CombatResult {
  victory: boolean; stars: number; kills: number; accuracy: number;
  damageTaken: number; maxHp: number; scrap: number; time: number; wave: number;
  ammoLeft: Record<WeaponSlot, number>;
}

export interface CombatConfig {
  level: LevelDef;
  weapon: Weapon;
  weaponSlots: Record<WeaponSlot, Weapon | null>;
  activeSlot: WeaponSlot;
  canSwap: boolean;
  grenades: number;
  ammoStock: Record<string, number>;
  stats: Stats;
  settings: Settings;
  /** Модификаторы навыков; опционально для обратной совместимости. */
  skills?: CombatSkillMods;
}

export interface CombatCallbacks {
  onScrap: (amount: number) => void;
  onGrenadeUsed: () => boolean;
  onGrenadeFound: () => number;
  onSwitchWeapon: (slot: WeaponSlot) => void;
  onEnd: (result: CombatResult) => void;
}

// ---------- утилиты ----------
function makeRng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function angleDiff(target: number, current: number) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad = 0) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

/** Выталкивает круг из прямоугольника */
function pushOut(x: number, y: number, r: number, o: Obstacle): [number, number] | null {
  const cx = clamp(x, o.x, o.x + o.w);
  const cy = clamp(y, o.y, o.y + o.h);
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return [cx + (dx / d) * r, cy + (dy / d) * r];
  }
  const left = x - o.x;
  const right = o.x + o.w - x;
  const top = y - o.y;
  const bottom = o.y + o.h - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return [o.x - r, y];
  if (m === right) return [o.x + o.w + r, y];
  if (m === top) return [x, o.y - r];
  return [x, o.y + o.h + r];
}

function palette(level: LevelDef) {
  const n = level.num;
  if (n === 5) return { ground: "#343a3a", road: "#3b3f42", walk: "#4f5553", roof: "#6d7473", roofDark: "#4e5555", accent: "#8f5a4a", grass: "#2f3a33" };
  if (n === 6 || n === 9) return { ground: "#35342e", road: "#3c3b37", walk: "#4a4840", roof: "#5a5446", roofDark: "#433e33", accent: "#8a7f52", grass: "#34362b" };
  if (n === 7 || n === 8) return { ground: "#33372e", road: "#3d3e3a", walk: "#4b4c43", roof: "#51563f", roofDark: "#3c402f", accent: "#6d7a45", grass: "#2e3a28" };
  if (n === 10) return { ground: "#2a2826", road: "#343130", walk: "#403c38", roof: "#4a3a36", roofDark: "#362a27", accent: "#7a2b22", grass: "#2e2a24" };
  if (n === 3 || n === 4) return { ground: "#37392f", road: "#3f4142", walk: "#51524a", roof: "#5e5a4a", roofDark: "#46423a", accent: "#9c6b3f", grass: "#313a2c" };
  return { ground: "#343b30", road: "#3e4141", walk: "#4f5049", roof: "#5f5446", roofDark: "#473e34", accent: "#6b5c3f", grass: "#2f3c2b" };
}

function shade(hex: string, k: number) {
  const v = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((v >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((v >> 8) & 255) * k));
  const b = Math.min(255, Math.round((v & 255) * k));
  return `rgb(${r},${g},${b})`;
}

// ============================================================
export class CombatEngine {
  private cfg: CombatConfig;
  private cb: CombatCallbacks;
  private phys: WeaponPhysics;
  private pal: ReturnType<typeof palette>;
  private ground: HTMLCanvasElement;
  private gctx: CanvasRenderingContext2D;
  /** Separate overlay is vital: erasing light on the main canvas revealed the black page beneath it. */
  private light: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;

  input: CombatInput = {
    up: false, down: false, left: false, right: false,
    sprint: false, fire: false, autoAim: false, aim: false,
    mouseX: VIEW_W / 2, mouseY: VIEW_H / 2,
  };

  // игрок с физикой инерции
  private px = WORLD_W / 2;
  private py = WORLD_H / 2;
  private vx = 0; private vy = 0;
  private angle = 0;
  private targetAngle = 0;
  private recoilAngle = 0;
  private gunKick = 0;
  private bloom = 0;
  private hp: number; private hpTrail: number; private maxHp: number;
  private speed: number; private armorMul: number;
  private skillMods: CombatSkillMods = NEUTRAL_MODS;
  private rollTime = ROLL_TIME;
  private rollCdMax = ROLL_CD;
  private rollPeak = ROLL_PEAK;
  private invuln = 0;
  // Кувырок: время до конца переката, кулдаун, направление и сторона вращения.
  private rollT = 0; private rollCd = 0; private rollDX = 0; private rollDY = 0;
  private rollDir = 1;
  private hurtT = 0;
  private walkPhase = 0;
  private stepDustCd = 0;
  private stamina = 100;
  private exhausted = false;
  private staminaRegenDelay = 0;

  // оружие
  private slots: Record<WeaponSlot, Weapon | null>;
  private activeSlot: WeaponSlot;
  private magazines: Record<WeaponSlot, number>;
  private reserves: Record<WeaponSlot, number>;
  private ammo: number; private reserve: number;
  private reloadT = 0; private reloadMax: number;
  private fireCd = 0; private fireDelay: number;
  private muzzleT = 0;
  private shotCounter = 0;
  private hitShots = new Set<number>();
  private hitMarkerT = 0;
  private hitMarkerColor = "#e8e2d0";

  // мир
  private obstacles: Obstacle[] = [];
  private barrels: Barrel[] = [];
  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private shells: Shell[] = [];
  private enemyShots: EnemyShot[] = [];
  private drops: Drop[] = [];
  private pools: Pool[] = [];
  private particles: Particle[] = [];
  private particleSerial = 0;
  private texts: FText[] = [];
  private blasts: Blast[] = [];
  private scorch: Scorch[] = [];
  private nextId = 1;
  private crates: SupplyCrate[] = [];
  private thrown: ThrownGrenade[] = [];
  private grenades: number;
  private stains: { x: number; y: number; r: number; color: string }[] = [];

  // волны
  private phase: HudState["phase"] = "ready";
  private phaseT = 2.4;
  private wave = 0;
  private waveTotal = 0;
  private waveSpawned = 0;
  private spawnT = 0;
  private bossPending = false;
  private banner: { title: string; sub: string } | null = null;
  private bannerT = 0;

  // камера
  private camX = 0; private camY = 0;
  private camKickX = 0; private camKickY = 0;
  private camZoom = 1; private camTargetZoom = 1;
  private shake = 0;
  // кинематографичная камера
  private camVX = 0; private camVY = 0;
  private introT = 2.2;
  private letterbox = 1;
  private hitStop = 0;
  private outroT = 0;
  private outroVictory = false;

  private kills = 0;
  private damageTaken = 0;
  private scrap = 0;
  private time = 0;
  private poolTick = 0;
  private ended = false;
  /** Последний source-rect камеры (для конвертации кликов извне). */
  lastSrcX = 0;
  lastSrcY = 0;

  constructor(cfg: CombatConfig, cb: CombatCallbacks) {
    this.cfg = cfg;
    this.cb = cb;
    this.slots = cfg.weaponSlots;
    this.activeSlot = cfg.activeSlot;
    // Патроны берутся только со склада: магазин заряжается из взятого запаса.
    const stockOf = (slot: WeaponSlot) => {
      const w = cfg.weaponSlots[slot];
      if (!w) return 0;
      if (isMelee(w)) return 0;
      return Math.max(0, Math.floor(cfg.ammoStock[w.id] ?? 0));
    };
    const magFor = (slot: WeaponSlot) => {
      const w = cfg.weaponSlots[slot];
      return w ? Math.min(w.magSize, stockOf(slot)) : 0;
    };
    this.magazines = { sidearm: magFor("sidearm"), primary: magFor("primary") };
    this.reserves = {
      sidearm: stockOf("sidearm") - this.magazines.sidearm,
      primary: stockOf("primary") - this.magazines.primary,
    };
    this.grenades = cfg.grenades;
    this.skillMods = cfg.skills ?? NEUTRAL_MODS;
    this.rollTime = ROLL_TIME * this.skillMods.rollTimeMul;
    this.rollCdMax = ROLL_CD * this.skillMods.rollCdMul;
    this.rollPeak = ROLL_PEAK * this.skillMods.rollPeakMul;
    this.phys = easeWeapon(weaponPhysics(cfg.weapon));
    this.phys.turnSpeed *= this.skillMods.turnMul;
    this.pal = palette(cfg.level);

    const { stats, weapon } = cfg;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.hpTrail = stats.maxHp;
    this.speed = stats.speed * (1 + weapon.moveSpeedMod / 100);
    this.armorMul = 1 - armorReduction(stats.armor) / 100;
    this.ammo = this.magazines[cfg.activeSlot];
    this.reserve = this.reserves[cfg.activeSlot];
    this.fireDelay = 60 / (weapon.rpm * (stats.fireRatePct / 100));
    this.reloadMax = weapon.reloadTime * (100 / Math.max(50, stats.fireRatePct)) * this.skillMods.reloadMul;

    this.ground = document.createElement("canvas");
    this.ground.width = WORLD_W;
    this.ground.height = WORLD_H;
    this.gctx = this.ground.getContext("2d")!;
    this.light = document.createElement("canvas");
    this.light.width = VIEW_W;
    this.light.height = VIEW_H;
    this.lctx = this.light.getContext("2d")!;
    this.buildMap();

    // Всего 4 ящика на рейд, разбросанных по карте. Новых не появляется.
    this.spawnCrate("scrap");
    this.spawnCrate("scrap");
    this.spawnCrate("grenade");
    this.spawnCrate("medkit");

    // Кислотные лужи на опасных районах: постоянная угроза на земле.
    const acidLevel = [4, 5, 9, 10].includes(this.cfg.level.num);
    if (acidLevel) {
      const count = 5 + Math.floor(this.cfg.level.num / 2);
      for (let i = 0; i < count; i++) {
        for (let a = 0; a < 30; a++) {
          const x = 90 + Math.random() * (WORLD_W - 180);
          const y = 90 + Math.random() * (WORLD_H - 180);
          if (Math.hypot(x - this.px, y - this.py) < 260) continue;
          if (this.obstacles.some((o) => x > o.x - 20 && x < o.x + o.w + 20 && y > o.y - 20 && y < o.y + o.h + 20)) continue;
          this.pools.push({ x, y, r: 46 + Math.random() * 34, life: 1e9, acid: true });
          break;
        }
      }
    }

    this.camX = clamp(this.px - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    this.camY = clamp(this.py - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    this.showBanner(`РАЙОН ${cfg.level.num}`, cfg.level.name, 2.4);
  }

  setSettings(s: Settings) {
    this.cfg = { ...this.cfg, settings: s };
    if (!s.screenShake) { this.shake = 0; this.camKickX = 0; this.camKickY = 0; }
    if (s.particleQuality === "off") this.particles = [];
    else if (s.particleQuality === "low") this.particles = this.particles.slice(-120);
    if (!s.damageNumbers) this.texts = [];
  }

  clearInput() {
    this.input.up = this.input.down = this.input.left = this.input.right = false;
    this.input.sprint = this.input.fire = this.input.autoAim = false;
  }

  // ============================================================
  // ГЕНЕРАЦИЯ КАРТЫ
  // ============================================================
  private buildMap() {
    const g = this.gctx;
    const p = this.pal;
    const r = makeRng(this.cfg.level.id + "-map");
    const T = 32;

    for (let ty = 0; ty < WORLD_H / T; ty++) {
      for (let tx = 0; tx < WORLD_W / T; tx++) {
        const n = r();
        g.fillStyle = n > 0.8 ? shade(p.ground, 1.08) : n < 0.15 ? shade(p.ground, 0.92) : p.ground;
        g.fillRect(tx * T, ty * T, T, T);
        if (n > 0.93) {
          g.fillStyle = p.grass;
          g.fillRect(tx * T + 6, ty * T + 8, 12, 10);
        }
      }
    }

    const roads = [
      { x: 0, y: WORLD_H / 2 - 80, w: WORLD_W, h: 160 },
      { x: WORLD_W / 2 - 80, y: 0, w: 160, h: WORLD_H },
      r() > 0.5
        ? { x: 0, y: 180 + Math.floor(r() * 2) * 1050, w: WORLD_W, h: 110 }
        : { x: 260 + Math.floor(r() * 2) * 1700, y: 0, w: 110, h: WORLD_H },
    ];
    for (const rd of roads) {
      g.fillStyle = p.walk;
      g.fillRect(rd.x - 14, rd.y - 14, rd.w + 28, rd.h + 28);
    }
    for (const rd of roads) {
      g.fillStyle = p.road;
      g.fillRect(rd.x, rd.y, rd.w, rd.h);
      for (let i = 0; i < (rd.w * rd.h) / 900; i++) {
        g.fillStyle = r() > 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.03)";
        g.fillRect(rd.x + r() * rd.w, rd.y + r() * rd.h, 3, 2);
      }
      g.fillStyle = "rgba(200,190,150,0.28)";
      if (rd.w > rd.h) {
        for (let x = rd.x + 20; x < rd.x + rd.w; x += 70) g.fillRect(x, rd.y + rd.h / 2 - 2, 36, 4);
      } else {
        for (let y = rd.y + 20; y < rd.y + rd.h; y += 70) g.fillRect(rd.x + rd.w / 2 - 2, y, 4, 36);
      }
    }
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = r() * WORLD_W;
      const y = r() * WORLD_H;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 30);
      g.lineTo(x + (r() - 0.5) * 70, y + (r() - 0.5) * 50);
      g.stroke();
    }
    for (let i = 0; i < 30; i++) {
      g.fillStyle = r() > 0.6 ? "rgba(90,20,18,0.35)" : "rgba(0,0,0,0.25)";
      g.beginPath();
      g.arc(r() * WORLD_W, r() * WORLD_H, 6 + r() * 16, 0, Math.PI * 2);
      g.fill();
    }

    const center = { x: WORLD_W / 2 - 200, y: WORLD_H / 2 - 170, w: 400, h: 340 };
    const onRoad = (o: { x: number; y: number; w: number; h: number }) =>
      roads.some((rd) => rectsOverlap(o, rd, 18));
    const centerIn = (o: { x: number; y: number; w: number; h: number }) =>
      roads.some(
        (rd) =>
          o.x + o.w / 2 > rd.x && o.x + o.w / 2 < rd.x + rd.w &&
          o.y + o.h / 2 > rd.y && o.y + o.h / 2 < rd.y + rd.h
      );
    const place = (w: number, h: number, kind: Obstacle["kind"], rule: "off" | "on" | "any", pad: number) => {
      for (let a = 0; a < 60; a++) {
        const o = { x: 40 + r() * (WORLD_W - 80 - w), y: 40 + r() * (WORLD_H - 80 - h), w, h, kind };
        if (rectsOverlap(o, center)) continue;
        if (rule === "off" && onRoad(o)) continue;
        if (rule === "on" && !centerIn(o)) continue;
        if (this.obstacles.some((q) => rectsOverlap(o, q, pad))) continue;
        this.obstacles.push(o);
        return;
      }
    };
    const industrial = this.cfg.level.num === 6 || this.cfg.level.num === 9;
    const military = this.cfg.level.num === 7 || this.cfg.level.num === 8;
    for (let i = 0; i < 12; i++)
      place(150 + Math.floor(r() * 5) * 24, 110 + Math.floor(r() * 4) * 24, "building", "off", 70);
    for (let i = 0; i < 16; i++)
      r() > 0.5 ? place(70, 36, "car", "on", 40) : place(36, 70, "car", "on", 40);
    for (let i = 0; i < (military ? 9 : 4); i++)
      r() > 0.5 ? place(96, 22, "barricade", "any", 50) : place(22, 96, "barricade", "any", 50);
    for (let i = 0; i < (industrial ? 8 : 2); i++)
      r() > 0.5 ? place(120, 44, "container", "off", 50) : place(44, 120, "container", "off", 50);

    for (let i = 0; i < 9; i++) {
      for (let a = 0; a < 40; a++) {
        const x = 60 + r() * (WORLD_W - 120);
        const y = 60 + r() * (WORLD_H - 120);
        if (Math.hypot(x - WORLD_W / 2, y - WORLD_H / 2) < 200) continue;
        if (this.obstacles.some((o) => rectsOverlap({ x: x - 20, y: y - 20, w: 40, h: 40 }, o, 6))) continue;
        if (this.barrels.some((b) => Math.hypot(b.x - x, b.y - y) < 160)) continue;
        this.barrels.push({ x, y, hp: 30, alive: true, fuse: 0 });
        break;
      }
    }

    for (const o of this.obstacles) this.drawObstacle(g, o, r);
  }

  private drawObstacle(g: CanvasRenderingContext2D, o: Obstacle, r: () => number) {
    if (o.kind === "building") {
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(o.x + 8, o.y + 10, o.w, o.h);
      g.fillStyle = this.pal.roofDark;
      g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = this.pal.roof;
      g.fillRect(o.x + 5, o.y + 5, o.w - 10, o.h - 10);
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 2;
      g.strokeRect(o.x + 5, o.y + 5, o.w - 10, o.h - 10);
      // вентиляция и мусор на крыше
      for (let i = 0; i < Math.floor((o.w * o.h) / 9000); i++) {
        const bx = o.x + 14 + r() * (o.w - 40);
        const by = o.y + 14 + r() * (o.h - 40);
        g.fillStyle = this.pal.roofDark;
        g.fillRect(bx, by, 20, 14);
        g.strokeStyle = "rgba(0,0,0,0.4)";
        g.strokeRect(bx, by, 20, 14);
      }
      if (r() > 0.6) {
        g.fillStyle = this.pal.accent;
        g.fillRect(o.x + o.w * 0.2, o.y - 2, o.w * 0.25, 6);
      }
    } else if (o.kind === "car") {
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(o.x + 3, o.y + 4, o.w, o.h);
      const colors = ["#5a5f66", "#6b5648", "#4c5a50", "#75564a", "#4e4e58"];
      g.fillStyle = colors[Math.floor(r() * colors.length)];
      g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = "rgba(20,26,28,0.85)";
      if (o.w > o.h) {
        g.fillRect(o.x + o.w * 0.25, o.y + 3, o.w * 0.3, o.h - 6);
      } else {
        g.fillRect(o.x + 3, o.y + o.h * 0.25, o.w - 6, o.h * 0.3);
      }
      g.strokeStyle = "rgba(0,0,0,0.5)";
      g.strokeRect(o.x, o.y, o.w, o.h);
      if (r() > 0.5) {
        g.fillStyle = "rgba(120,30,20,0.5)";
        g.fillRect(o.x + r() * o.w * 0.5, o.y + r() * o.h * 0.5, o.w * 0.3, o.h * 0.25);
      }
    } else if (o.kind === "barricade") {
      g.fillStyle = "#6a5a40";
      g.fillRect(o.x, o.y, o.w, o.h);
      g.strokeStyle = "#3c3122";
      g.lineWidth = 2;
      g.strokeRect(o.x, o.y, o.w, o.h);
      g.fillStyle = "rgba(231,197,90,0.5)";
      if (o.w > o.h) for (let x = o.x + 4; x < o.x + o.w - 8; x += 18) g.fillRect(x, o.y + 3, 9, o.h - 6);
      else for (let y = o.y + 4; y < o.y + o.h - 8; y += 18) g.fillRect(o.x + 3, y, o.w - 6, 9);
    } else {
      // container
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(o.x + 5, o.y + 6, o.w, o.h);
      const cols = ["#7a4a35", "#4c6152", "#5c5a6e", "#7a6a3a"];
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.fillRect(o.x, o.y, o.w, o.h);
      g.strokeStyle = "rgba(0,0,0,0.45)";
      g.lineWidth = 2;
      g.strokeRect(o.x, o.y, o.w, o.h);
      g.strokeStyle = "rgba(0,0,0,0.25)";
      if (o.w > o.h) for (let x = o.x + 10; x < o.x + o.w; x += 14) { g.beginPath(); g.moveTo(x, o.y + 2); g.lineTo(x, o.y + o.h - 2); g.stroke(); }
      else for (let y = o.y + 10; y < o.y + o.h; y += 14) { g.beginPath(); g.moveTo(o.x + 2, y); g.lineTo(o.x + o.w - 2, y); g.stroke(); }
    }
  }

  /** Ящики остаются в мире рейда. */
  private spawnCrate(kind: SupplyCrate["kind"], near = false) {
    for (let attempt = 0; attempt < 45; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 130 + Math.random() * 150;
      const x = near ? this.px + Math.cos(angle) * distance : 60 + Math.random() * (WORLD_W - 120);
      const y = near ? this.py + Math.sin(angle) * distance : 60 + Math.random() * (WORLD_H - 120);
      if (x < 38 || y < 38 || x > WORLD_W - 38 || y > WORLD_H - 38) continue;
      if (Math.hypot(x - this.px, y - this.py) < 105) continue;
      if (this.obstacles.some((o) => rectsOverlap({ x: x - 24, y: y - 24, w: 48, h: 48 }, o, 12))) continue;
      if (this.crates.some((o) => !o.opened && Math.hypot(o.x - x, o.y - y) < 85)) continue;
      if (this.barrels.some((o) => o.alive && Math.hypot(o.x - x, o.y - y) < 45)) continue;
      this.crates.push({ x, y, kind, opened: false, phase: Math.random() * 6 });
      return;
    }
  }

  private nearestCrate() {
    let best: SupplyCrate | null = null;
    let bestDistance = 68;
    for (const crate of this.crates) {
      if (crate.opened) continue;
      const dist = Math.hypot(crate.x - this.px, crate.y - this.py);
      if (dist < bestDistance) { bestDistance = dist; best = crate; }
    }
    return best;
  }

  /** E у ящика: лом, граната или аптечка. Патронов в ящиках нет — они покупаются. */
  openCrate(): boolean {
    if (this.ended) return false;
    const crate = this.nearestCrate();
    if (!crate) return false;
    crate.opened = true;
    sfx.uiConfirm();
    if (crate.kind === "scrap") {
      const amount = 60 + this.cfg.level.num * 16;
      this.scrap += amount;
      this.cb.onScrap(amount);
      this.text(`+${amount} МЕТАЛЛОЛОМ`, crate.x, crate.y - 26, "#b8d36a", 11);
    } else if (crate.kind === "grenade") {
      const added = this.cb.onGrenadeFound();
      if (added) {
        this.grenades += added;
        this.text("+ ГРАНАТА", crate.x, crate.y - 26, "#edaa72", 1212);
      } else {
        const amount = 40 + this.cfg.level.num * 10;
        this.scrap += amount;
        this.cb.onScrap(amount);
        this.text(`ПОЯС ПОЛОН: +${amount} ЛОМА`, crate.x, crate.y - 26, "#b8d36a", 11);
      }
    } else {
      const missing = this.maxHp - this.hp;
      if (missing > 1) {
        const heal = Math.min(missing, Math.round(this.maxHp * 0.35));
        this.hp += heal;
        sfx.medkit();
        this.text(`+${heal} HP`, crate.x, crate.y - 26, "#5ee08a", 13);
      } else {
        const amount = 40 + this.cfg.level.num * 10;
        this.scrap += amount;
        this.cb.onScrap(amount);
        this.text(`ЗДОРОВ ПОЛНОСТЬЮ: +${amount} ЛОМА`, crate.x, crate.y - 26, "#b8d36a", 11);
      }
    }
    const burstColor = crate.kind === "scrap" ? "#b8d36a" : crate.kind === "grenade" ? "#edaa72" : "#5ee08a";
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 35 + Math.random() * 80;
      this.particle(crate.x, crate.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5, burstColor, 3);
    }
    return true;
  }

  // ============================================================
  // ВОЛНЫ
  // ============================================================
  private showBanner(title: string, sub: string, t = 2.2) {
    this.banner = { title, sub };
    this.bannerT = t;
  }

  private startWave() {
    this.wave++;
    this.phase = "wave";
    const lvl = this.cfg.level;
    this.waveTotal = Math.round(6 + this.wave * 3.4 + lvl.danger * 2.1);
    this.waveSpawned = 0;
    this.spawnT = 0.6;
    this.bossPending = !!lvl.boss && this.wave === lvl.waves;
    sfx.waveStart();
    this.showBanner(
      `ВОЛНА ${this.wave} / ${lvl.waves}`,
      this.bossPending ? `⚠ ${lvl.boss} идёт с волной` : "Заражённые приближаются",
      2.2
    );
  }

  private zombieTemplate(kind: ZKind): Omit<Zombie, "id" | "x" | "y"> {
    const n = this.cfg.level.num;
    const hpMul = 1 + (n - 1) * 0.16;
    const base = {
      vx: 0, vy: 0, flash: 0, staggerT: 0, hitTwist: 0, atkCd: 0,
      abilityCd: 2 + Math.random() * 2, summonCd: 6,
      state: "chase" as const, stateT: 0, dirX: 0, dirY: 0,
      phase: Math.random() * 6, face: 0, elite: false, lungeT: 0, lungeCd: 2 + Math.random() * 2,
      variant: (Math.random() * 4) | 0,
    };
    switch (kind) {
      case "runner":
        return { ...base, kind, name: "Бегун", r: 11, mass: 0.8, hp: 34 * hpMul, maxHp: 34 * hpMul, speed: 118, dmg: 9, dmgMul: 1, color: "#8a6a52", scrap: 14 };
      case "spitter":
        return { ...base, kind, name: "Плевун", r: 13, mass: 1, hp: 52 * hpMul, maxHp: 52 * hpMul, speed: 52, dmg: 10, dmgMul: 1, color: "#7f9c3a", scrap: 20 };
      case "fatty":
        return { ...base, kind, name: "Толстяк", r: 22, mass: 3.2, hp: 210 * hpMul, maxHp: 210 * hpMul, speed: 34, dmg: 26, dmgMul: 1, color: "#6b7a4a", scrap: 34 };
      case "armored":
        return { ...base, kind, name: "Бронированный", r: 15, mass: 2.1, hp: 150 * hpMul, maxHp: 150 * hpMul, speed: 46, dmg: 16, dmgMul: 0.55, color: "#55606c", scrap: 30 };
      case "boss": {
        const isMother = this.cfg.level.num === 10;
        return {
          ...base, kind,
          name: this.cfg.level.boss ?? "Босс",
          r: isMother ? 34 : 27, mass: isMother ? 7 : 5,
          hp: (isMother ? 2600 : 1250) * (1 + (n - 5) * 0.12),
          maxHp: (isMother ? 2600 : 1250) * (1 + (n - 5) * 0.12),
          speed: 46, dmg: 34, dmgMul: 1,
          color: isMother ? "#7a2b22" : "#8f5a4a", scrap: 400,
          summonCd: 7,
        };
      }
      default:
        return { ...base, kind: "walker", name: "Бродяга", r: 13, mass: 1.15, hp: 58 * hpMul, maxHp: 58 * hpMul, speed: 42, dmg: 12, dmgMul: 1, color: "#6d7565", scrap: 12 };
    }
  }

  private pickKind(): ZKind {
    const n = this.cfg.level.num;
    const roll = Math.random();
    if (n >= 7 && roll < 0.13) return "armored";
    if (n >= 4 && roll < 0.24) return "fatty";
    if (n >= 3 && roll < 0.38) return "spitter";
    if (n >= 2 && roll < Math.min(0.34 + n * 0.03, 0.58)) return "runner";
    return "walker";
  }

  private spawnZombie(kind?: ZKind, nearX?: number, nearY?: number) {
    if (this.zombies.length >= MAX_ALIVE) return;
    const k = kind ?? this.pickKind();
    const template = this.zombieTemplate(k);
    let x = 0, y = 0;
    if (nearX !== undefined && nearY !== undefined) {
      const a = Math.random() * Math.PI * 2;
      x = clamp(nearX + Math.cos(a) * (60 + Math.random() * 70), 30, WORLD_W - 30);
      y = clamp(nearY + Math.sin(a) * (60 + Math.random() * 70), 30, WORLD_H - 30);
    } else {
      // спавн за пределами экрана
      for (let a = 0; a < 30; a++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.max(VIEW_W, VIEW_H) * 0.62 + Math.random() * 260;
        x = clamp(this.px + Math.cos(ang) * dist, 30, WORLD_W - 30);
        y = clamp(this.py + Math.sin(ang) * dist, 30, WORLD_H - 30);
        if (Math.hypot(x - this.px, y - this.py) > 330) break;
      }
    }
    const z: Zombie = { ...template, id: this.nextId++, x, y };
    // Элиты с 4-го района: больше HP/скорости/лута, красные глаза.
    if (k !== "boss" && this.cfg.level.num >= 4 && Math.random() < 0.07 + this.cfg.level.num * 0.008) {
      z.elite = true;
      z.hp *= 1.9; z.maxHp *= 1.9;
      z.speed *= 1.18;
      z.scrap = Math.round(z.scrap * 2.6);
      z.r += 2;
    }
    if (k === "boss") sfx.bossRoar();
    this.zombies.push(z);
  }

  // ============================================================
  // ОБНОВЛЕНИЕ
  // ============================================================
  update(dt: number) {
    if (this.ended) return;
    // Cinematic outro: world keeps moving in slow motion before the result screen.
    if (this.outroT > 0) {
      this.outroT -= dt;
      this.clearInput();
      if (this.outroT <= 0) {
        this.finish(this.outroVictory);
        return;
      }
      dt *= 0.3;
    }
    // Hit-stop sells heavy kills and explosions without long pauses.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.14;
    }
    this.time += dt;
    this.poolTick += dt;

    // фазы волн
    if (this.phase === "ready" || this.phase === "break") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.startWave();
    } else if (this.phase === "wave") {
      if (this.waveSpawned < this.waveTotal) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = Math.max(0.28, 1.15 - this.cfg.level.danger * 0.07) * (0.7 + Math.random() * 0.6);
          this.spawnZombie();
          this.waveSpawned++;
          if (this.bossPending && this.waveSpawned === Math.ceil(this.waveTotal / 2)) {
            this.spawnZombie("boss");
            this.bossPending = false;
          }
        }
      } else if (this.zombies.length === 0 && !this.bossPending) {
        if (this.wave >= this.cfg.level.waves) {
          this.startOutro(true);
        } else {
          this.phase = "break";
          this.phaseT = 5;
          this.showBanner("ВОЛНА ЗАЧИЩЕНА", "Передышка: соберите лом и перезарядитесь", 2);
        }
      }
    }

    this.bannerT -= dt;
    if (this.bannerT <= 0) this.banner = null;

    this.updatePlayer(dt);
    this.updateWeapon(dt);
    this.updateZombies(dt);
    this.updateBullets(dt);
    this.updateGrenades(dt);
    this.updateMisc(dt);
    this.updateCamera(dt);

    // урон от кислотных луж
    if (this.poolTick > 0.5) {
      this.poolTick = 0;
      for (const p of this.pools) {
        if (Math.hypot(this.px - p.x, this.py - p.y) < p.r - 4) {
          const hazmat = this.cfg.stats.armor >= 9;
          this.hurt(hazmat ? 3 : 6, false);
          break;
        }
      }
    }

    // полоса HP с инерцией
    this.hpTrail += (this.hp - this.hpTrail) * Math.min(1, dt * 3.2);
  }

  private updatePlayer(dt: number) {
    const inp = this.input;
    let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }

    this.invuln = Math.max(0, this.invuln - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.hitMarkerT = Math.max(0, this.hitMarkerT - dt);

    // --- ВЫНОСЛИВОСТЬ ---
    const aimingMove = inp.aim && this.rollT <= 0;
    const wantsSprint = inp.sprint && !inp.fire && !inp.aim && len > 0 && !this.exhausted && this.stamina > 0;
    const weightDrain = (1 + this.phys.weightKg * 0.05) * this.skillMods.staminaCostMul;
    if (wantsSprint && this.rollT <= 0) {
      this.stamina = Math.max(0, this.stamina - 22 * weightDrain * dt);
      this.staminaRegenDelay = 0.9;
      if (this.stamina <= 0) {
        this.exhausted = true;
        sfx.staminaEmpty();
      }
    } else {
      this.staminaRegenDelay = Math.max(0, this.staminaRegenDelay - dt);
      if (this.staminaRegenDelay <= 0) {
        const regen = (len > 0 ? 14 : 24) * this.skillMods.staminaRegenMul;
        this.stamina = Math.min(100, this.stamina + regen * dt);
      }
      if (this.exhausted && this.stamina >= 35) this.exhausted = false;
    }
    if (this.stamina < 30 || this.exhausted) sfx.breath(this.exhausted);

    // Физика движения с массой и инерцией
    const massFactor = clamp(1.12 - this.phys.weightKg * 0.04, 0.72, 1.05);
    if (this.rollT > 0) {
      this.rollT = Math.max(0, this.rollT - dt);
      // Скорость идёт по кривой: толчок, затем плавное гашение инерции.
      const progress = 1 - this.rollT / this.rollTime;
      const speed = this.speed * this.rollPeak * rollSpeedCurve(progress);
      this.vx = this.rollDX * speed;
      this.vy = this.rollDY * speed;
      // Пыль и песок из-под переката
      if (Math.random() < 0.9) {
        this.particle(this.px, this.py + 2, -this.rollDX * 45 + (Math.random() - 0.5) * 40, -this.rollDY * 45 + (Math.random() - 0.5) * 40, 0.42, "rgba(150,140,120,0.45)", 5, "smoke");
      }
      if (Math.random() < 0.5) {
        this.particle(this.px, this.py + 6, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 30, 0.35, "rgba(190,180,160,0.4)", 3.5, "smoke");
      }
      // Кулдаун отсчитывается только после того, как боец встал на ноги.
      if (this.rollT <= 0) this.rollCd = this.rollCdMax;
    } else {
      const braceMul = inp.fire ? clamp(0.84 - this.phys.weightKg * 0.02, 0.62, 0.84) : 1;
      const sprintMul = wantsSprint ? 1.34 : 1;
      const fatigueMul = this.exhausted ? 0.78 : this.stamina < 20 ? 0.9 : 1;
      // Прицеливание: точность в обмен на мобильность.
      const aimMul = aimingMove ? 0.55 : 1;
      const targetSpd = this.speed * sprintMul * braceMul * fatigueMul * aimMul;
      const targetVX = dx * targetSpd;
      const targetVY = dy * targetSpd;
      const rate = (len > 0 ? 10.5 : 8.5) * massFactor;
      const blend = Math.min(1, rate * dt);
      this.vx += (targetVX - this.vx) * blend;
      this.vy += (targetVY - this.vy) * blend;
    }

    const curSpeed = Math.hypot(this.vx, this.vy);
    if (curSpeed > 18) {
      this.walkPhase += dt * (4.5 + curSpeed * 0.045);
      this.stepDustCd -= dt;
      if (this.stepDustCd <= 0) {
        this.stepDustCd = wantsSprint ? 0.19 : 0.28;
        sfx.footstep(wantsSprint);
        this.particle(
          this.px - (this.vx / curSpeed) * 6 + (Math.random() - 0.5) * 6,
          this.py + 9,
          -this.vx * 0.12 + (Math.random() - 0.5) * 18,
          -this.vy * 0.12 + (Math.random() - 0.5) * 18,
          0.32,
          "rgba(130,124,108,0.45)",
          3.5
        );
      }
    }

    this.px = clamp(this.px + this.vx * dt, 14, WORLD_W - 14);
    this.py = clamp(this.py + this.vy * dt, 14, WORLD_H - 14);
    for (const o of this.obstacles) {
      const p = pushOut(this.px, this.py, 12, o);
      if (p) { this.px = p[0]; this.py = p[1]; }
    }
    for (const b of this.barrels) {
      if (!b.alive) continue;
      const d = Math.hypot(this.px - b.x, this.py - b.y);
      if (d < 26 && d > 0) {
        this.px = b.x + ((this.px - b.x) / d) * 26;
        this.py = b.y + ((this.py - b.y) / d) * 26;
      }
    }

    // Инерция наведения ствола
    const zoomA = this.camZoom;
    const vwA = VIEW_W / zoomA;
    const vhA = VIEW_H / zoomA;
    const srcXA = clamp(this.camX + this.camKickX + VIEW_W / 2 - vwA / 2, 0, WORLD_W - vwA);
    const srcYA = clamp(this.camY + this.camKickY + VIEW_H / 2 - vhA / 2, 0, WORLD_H - vhA);
    const mwx = srcXA + this.input.mouseX / zoomA;
    const mwy = srcYA + this.input.mouseY / zoomA;
    this.targetAngle = Math.atan2(mwy - this.py, mwx - this.px);
    if (this.input.autoAim) {
      let nearest: Zombie | null = null;
      let nearestDistance = 720;
      for (const z of this.zombies) {
        const distance = Math.hypot(z.x - this.px, z.y - this.py);
        if (distance < nearestDistance) {
          nearest = z;
          nearestDistance = distance;
        }
      }
      if (nearest) this.targetAngle = Math.atan2(nearest.y - this.py, nearest.x - this.px);
    }
    const diff = angleDiff(this.targetAngle, this.angle);
    const maxTurn = this.phys.turnSpeed * dt;
    if (Math.abs(diff) <= maxTurn) {
      this.angle = this.targetAngle;
    } else {
      this.angle += Math.sign(diff) * maxTurn + diff * Math.min(1, dt * this.phys.turnSpeed * 0.65);
    }

    this.gunKick = Math.max(0, this.gunKick - dt * 38);
    this.recoilAngle *= Math.pow(0.002, dt);
    // В прицеле руки твёрже: меньше раскачки от движения и быстрее стабилизация.
    const aimSteady = inp.aim && this.rollT <= 0;
    const moveBloom = (curSpeed / Math.max(1, this.speed)) * (aimSteady ? 0.009 : 0.018);
    const minBloom = curSpeed > 25 ? moveBloom : 0;
    this.bloom = Math.max(minBloom, this.bloom - this.phys.bloomRecovery * (aimSteady ? 1.6 : 1) * dt);
  }

  /**
   * Кувырок: перекат по направлению движения (или взгляда, если стоим).
   * Даёт неуязвимость на всё время переката и уходит в кулдаун после него.
   */
  roll() {
    if (this.ended || this.rollCd > 0 || this.rollT > 0) return;
    if (this.exhausted || this.stamina < 30) {
      sfx.staminaEmpty();
      this.text("НЕТ СИЛ", this.px, this.py - 24, "#e7c55a", 11);
      return;
    }
    this.stamina -= 30 * this.skillMods.staminaCostMul;
    this.staminaRegenDelay = 1.1;
    if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; }
    const inp = this.input;
    let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (dx === 0 && dy === 0) {
      dx = Math.cos(this.angle);
      dy = Math.sin(this.angle);
    }
    const l = Math.hypot(dx, dy) || 1;
    this.rollDX = dx / l;
    this.rollDY = dy / l;
    this.rollDir = Math.random() > 0.5 ? 1 : -1;
    this.rollT = this.rollTime;
    // i-frames держатся весь перекат плюс небольшой запас на подъём.
    this.invuln = Math.max(this.invuln, this.rollTime + 0.1);
    // Толчок ногами в начале переката
    for (let i = 0; i < 7; i++) {
      const a = Math.atan2(this.rollDY, this.rollDX) + Math.PI + (Math.random() - 0.5) * 1.1;
      const sp = 60 + Math.random() * 120;
      this.particle(this.px, this.py + 4, Math.cos(a) * sp, Math.sin(a) * sp, 0.4, "rgba(165,155,135,0.5)", 4, "smoke");
    }
    sfx.roll();
  }

  switchWeapon(slot: WeaponSlot): boolean {
    if (this.ended || !this.cfg.canSwap || slot === this.activeSlot || !this.slots[slot]) return false;
    this.magazines[this.activeSlot] = this.ammo;
    this.reserves[this.activeSlot] = this.reserve;
    this.activeSlot = slot;
    const w = this.slots[slot]!;
    this.cfg.weapon = w;
    this.phys = easeWeapon(weaponPhysics(w));
    this.phys.turnSpeed *= this.skillMods.turnMul;
    this.speed = this.cfg.stats.speed * (1 + w.moveSpeedMod / 100);
    this.ammo = this.magazines[slot];
    this.reserve = this.reserves[slot];
    this.fireDelay = 60 / (w.rpm * (this.cfg.stats.fireRatePct / 100));
    this.reloadMax = w.reloadTime * (100 / Math.max(50, this.cfg.stats.fireRatePct)) * this.skillMods.reloadMul;
    this.reloadT = 0;
    this.fireCd = 0.27;
    this.bloom *= 0.6;
    sfx.reloadStart(w.kind);
    this.cb.onSwitchWeapon(slot);
    return true;
  }

  throwGrenade(): boolean {
    if (this.ended || this.grenades <= 0 || this.thrown.length >= 3) return false;
    if (!this.cb.onGrenadeUsed()) return false;
    this.grenades--;
    const zoomG = this.camZoom;
    const vwG = VIEW_W / zoomG;
    const vhG = VIEW_H / zoomG;
    const srcXG = clamp(this.camX + this.camKickX + VIEW_W / 2 - vwG / 2, 0, WORLD_W - vwG);
    const srcYG = clamp(this.camY + this.camKickY + VIEW_H / 2 - vhG / 2, 0, WORLD_H - vhG);
    const dist = Math.min(360, Math.max(110, Math.hypot(
      srcXG + this.input.mouseX / zoomG - this.px,
      srcYG + this.input.mouseY / zoomG - this.py
    )));
    const a = this.angle;
    this.thrown.push({
      x: this.px + Math.cos(a) * 18,
      y: this.py + Math.sin(a) * 18,
      vx: Math.cos(a) * dist * 1.35,
      vy: Math.sin(a) * dist * 1.35,
      z: 10, vz: 200, fuse: 0.9,
    });
    sfx.uiClick();
    return true;
  }

  reload() {
    const w = this.cfg.weapon;
    if (this.ended || isMelee(w) || this.reloadT > 0 || this.ammo >= w.magSize || this.reserve <= 0) return;
    this.reloadT = this.reloadMax;
    sfx.reloadStart(w.kind);
  }

  private updateWeapon(dt: number) {
    const w = this.cfg.weapon;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = w.magSize - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.reloadT = 0;
        sfx.reloadEnd(w.kind);
      }
      return;
    }
    if (!this.input.fire || this.fireCd > 0) return;

    const melee = isMelee(w) || this.ammo + this.reserve <= 0;
    if (melee) {
      // Холодное оружие / нож последнего шанса
      this.fireCd = isMelee(w) ? this.fireDelay : 0.45;
      const range = isMelee(w) ? w.range : 60;
      const dmg = (isMelee(w) ? w.damage : 22) * (this.cfg.stats.damagePct / 100);
      const pierce = isMelee(w) ? (w.pierce ?? 1) : 1;
      sfx.meleeSwing();
      this.gunKick = 6;
      let hitCount = 0;
      for (const z of this.zombies) {
        if (hitCount >= pierce) break;
        const d = Math.hypot(z.x - this.px, z.y - this.py);
        if (d > range + z.r) continue;
        const angTo = Math.atan2(z.y - this.py, z.x - this.px);
        if (Math.abs(angleDiff(angTo, this.angle)) > 1.1) continue;
        const crit = isMelee(w) && w.id === "w_machete_stalker" && Math.random() < 0.25;
        this.damageZombie(z, dmg, Math.cos(angTo), Math.sin(angTo), this.phys.knockbackImpulse, this.phys.staggerSec, crit);
        sfx.meleeImpact();
        hitCount++;
      }
      this.killCheck();
      return;
    }

    if (this.ammo <= 0) {
      sfx.dryFire();
      this.fireCd = 0.32;
      this.reload();
      return;
    }

    // ВЫСТРЕЛ
    this.ammo--;
    this.fireCd = this.fireDelay;
    this.muzzleT = 0.05;
    this.shotCounter++;
    const shotId = this.shotCounter;
    sfx.shoot(w.kind, w.id);

    // Точность ↔ мобильность: от бедра разброс выше, в прицеле — заметно ниже.
    const aimingShot = this.input.aim && !this.ended;
    const accuracy = (SPREAD_BASE[w.spread] ?? 0.11) * this.skillMods.spreadMul;
    const spreadNow = (accuracy + this.bloom) * (aimingShot ? 0.45 : 1.25);
    const pellets = w.pellets;
    const dmg = w.damage * (this.cfg.stats.damagePct / 100);
    const aimBase = this.assistedAngle(w.range);
    for (let i = 0; i < pellets; i++) {
      const off = pellets > 1
        ? ((i / (pellets - 1)) - 0.5) * spreadNow * 4 + (Math.random() - 0.5) * 0.05
        : (Math.random() - 0.5) * spreadNow * 2;
      const a = aimBase + this.recoilAngle * (aimingShot ? 0.3 : 0.6) + off;
      this.bullets.push({
        x: this.px + Math.cos(this.angle) * 20,
        y: this.py + Math.sin(this.angle) * 20,
        vx: Math.cos(a) * BULLET_SPEED,
        vy: Math.sin(a) * BULLET_SPEED,
        range: w.range * (0.9 + Math.random() * 0.2),
        dmg, pierce: w.pierce ?? 1,
        hits: new Set(), shotId,
      });
    }

    // отдача: импульс в тело, откат ствола, подброс, разброс
    this.vx -= Math.cos(this.angle) * this.phys.shooterPush;
    this.vy -= Math.sin(this.angle) * this.phys.shooterPush;
    this.gunKick = Math.min(14, this.gunKick + this.phys.barrelKick);
    this.recoilAngle += (Math.random() > 0.5 ? 1 : -1) * this.phys.angleKick;
    this.bloom = Math.min(0.32, this.bloom + this.phys.bloomPerShot);
    if (this.cfg.settings.screenShake) {
      this.camKickX -= Math.cos(this.angle) * this.phys.barrelKick * 0.35;
      this.camKickY -= Math.sin(this.angle) * this.phys.barrelKick * 0.35;
      this.shake = Math.max(this.shake, this.phys.recoilRating * 0.018);
    }

    // гильза: отскок с вращением, затем долго лежит на земле и плавно гаснет
    const heavy = w.kind === "Дробовик" || w.kind === "Дробовик помповый" || w.kind === "Снайперская винтовка";
    const perpA = this.angle + Math.PI / 2;
    if (this.shells.length >= 140) this.shells.shift();
    this.shells.push({
      x: this.px + Math.cos(this.angle) * 10,
      y: this.py + Math.sin(this.angle) * 10,
      vx: Math.cos(perpA) * (60 + Math.random() * 60) - Math.cos(this.angle) * 30,
      vy: Math.sin(perpA) * (60 + Math.random() * 60) - Math.sin(this.angle) * 30,
      z: 8, vz: 90 + Math.random() * 70,
      rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 20,
      life: 6.5, max: 6.5, color: heavy ? "#b03a2e" : "#c9a74a",
    });
    window.setTimeout(() => sfx.shellDrop(heavy), 320 + Math.random() * 180);

    // дым из ствола
    for (let i = 0; i < 3; i++) {
      this.particle(
        this.px + Math.cos(this.angle) * 26,
        this.py + Math.sin(this.angle) * 26,
        Math.cos(this.angle) * (60 + Math.random() * 60) + (Math.random() - 0.5) * 30,
        Math.sin(this.angle) * (60 + Math.random() * 60) + (Math.random() - 0.5) * 30,
        0.3 + Math.random() * 0.2,
        "rgba(180,175,160,0.3)", 3, );
    }

    if (this.ammo === 0 && this.reserve > 0) this.reload();
  }

  // ============================================================
  // ЗОМБИ
  // ============================================================
  private updateZombies(dt: number) {
    for (const z of this.zombies) {
      z.flash = Math.max(0, z.flash - dt);
      z.staggerT = Math.max(0, z.staggerT - dt);
      z.hitTwist *= Math.pow(0.01, dt);
      z.atkCd = Math.max(0, z.atkCd - dt);
      z.phase += dt * (z.kind === "runner" ? 9 : 5) * (z.staggerT > 0 ? 0.3 : 1);

      const bx = this.px - z.x;
      const by = this.py - z.y;
      const dist = Math.hypot(bx, by) || 1;
      const nx = bx / dist;
      const ny = by / dist;
      z.face = Math.atan2(ny, nx);

      const staggerMul = z.staggerT > 0 ? 0.25 : 1;
      const gaitPulse = 0.75 + Math.sin(z.phase) * 0.35; // тяжёлая неравномерная походка
      let mvx = 0, mvy = 0;

      if (z.kind === "boss") {
        // Босс: телеграф -> рывок; периодический призыв
        z.summonCd -= dt;
        if (z.summonCd <= 0 && this.zombies.length < MAX_ALIVE - 4) {
          z.summonCd = 8 + Math.random() * 3;
          const count = this.cfg.level.num === 10 ? 4 : 3;
          for (let i = 0; i < count; i++) this.spawnZombie(Math.random() < 0.5 ? "runner" : "walker", z.x, z.y);
          this.text("ПРИЗЫВ!", z.x, z.y - z.r - 14, "#ff6a4d", 13);
          sfx.bossRoar();
        }
        if (z.state === "chase") {
          z.stateT -= dt;
          mvx = nx * z.speed * gaitPulse * staggerMul;
          mvy = ny * z.speed * gaitPulse * staggerMul;
          if (z.stateT <= 0 && dist > 140 && dist < 620) {
            z.state = "telegraph";
            z.stateT = 0.7;
            z.dirX = nx; z.dirY = ny;
          }
        } else if (z.state === "telegraph") {
          z.stateT -= dt;
          z.x += (Math.random() - 0.5) * 2;
          if (z.stateT <= 0) {
            z.state = "charge";
            z.stateT = 0.55;
            sfx.explosion();
          }
        } else {
          z.stateT -= dt;
          mvx = z.dirX * 480;
          mvy = z.dirY * 480;
          if (Math.random() < 0.5) this.particle(z.x, z.y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.3, "rgba(140,60,40,0.5)", 5);
          if (z.stateT <= 0) {
            z.state = "chase";
            z.stateT = 2.2 + Math.random() * 1.4;
          }
        }
      } else if (z.kind === "runner") {
        // Рывок бегуна с телеграфом
        if (z.lungeT > 0) {
          if (z.staggerT > 0) {
            z.lungeT = 0;
            z.lungeCd = 1.6 + Math.random();
          } else {
            z.lungeT -= dt;
            z.x += (Math.random() - 0.5) * 1.4;
            if (z.lungeT <= 0) {
              z.vx += nx * 420;
              z.vy += ny * 420;
              z.lungeT = -0.35;
            }
          }
        } else if (z.lungeT < 0) {
          z.lungeT += dt;
          if (z.lungeT >= 0) {
            z.lungeCd = 2.6 + Math.random() * 1.4;
            z.staggerT = Math.max(z.staggerT, 0.3);
          }
        } else if (dist < 170 && dist > 40 && z.lungeCd <= 0) {
          z.lungeT = 0.4;
        } else {
          z.lungeCd = Math.max(0, z.lungeCd - dt);
          mvx = nx * z.speed * gaitPulse * staggerMul;
          mvy = ny * z.speed * gaitPulse * staggerMul;
        }
      } else if (z.kind === "spitter") {
        // держит дистанцию и плюётся
        z.abilityCd -= dt;
        if (dist < 190) { mvx = -nx * z.speed * 0.8; mvy = -ny * z.speed * 0.8; }
        else if (dist > 270) {
          mvx = nx * z.speed * gaitPulse * staggerMul;
          mvy = ny * z.speed * gaitPulse * staggerMul;
        }
        if (z.abilityCd <= 0 && dist < 460 && z.staggerT <= 0) {
          z.abilityCd = 2.4 + Math.random() * 1.4;
          this.enemyShots.push({ x: z.x, y: z.y, vx: nx * 300, vy: ny * 300, life: 2.2, dmg: z.dmg });
          for (let i = 0; i < 4; i++)
            this.particle(z.x, z.y, nx * 60 + (Math.random() - 0.5) * 50, ny * 60 + (Math.random() - 0.5) * 50, 0.3, "#9bd14a", 3);
        }
      } else {
        mvx = nx * z.speed * gaitPulse * staggerMul;
        mvy = ny * z.speed * gaitPulse * staggerMul;
      }

      // разделение зомби между собой
      for (const o of this.zombies) {
        if (o === z) continue;
        const ox = z.x - o.x;
        const oy = z.y - o.y;
        const min = z.r + o.r;
        if (Math.abs(ox) > min || Math.abs(oy) > min) continue;
        const od = Math.hypot(ox, oy);
        if (od > 0 && od < min) {
          const push = ((min - od) / min) * 34;
          mvx += (ox / od) * push;
          mvy += (oy / od) * push;
        }
      }

      // импульс от пуль + движение
      z.vx *= Math.pow(0.001, dt);
      z.vy *= Math.pow(0.001, dt);
      z.x += (mvx + z.vx) * dt;
      z.y += (mvy + z.vy) * dt;
      z.x = clamp(z.x, 16, WORLD_W - 16);
      z.y = clamp(z.y, 16, WORLD_H - 16);

      // обход препятствий: скольжение вдоль стены
      for (const o of this.obstacles) {
        if (z.x < o.x - 40 || z.x > o.x + o.w + 40 || z.y < o.y - 40 || z.y > o.y + o.h + 40) continue;
        const p = pushOut(z.x, z.y, z.r, o);
        if (p) {
          const sx = p[0] - z.x;
          const sy = p[1] - z.y;
          const sl = Math.hypot(sx, sy) || 1;
          let tx2 = -sy / sl;
          let ty2 = sx / sl;
          if (tx2 * nx + ty2 * ny < 0) { tx2 = -tx2; ty2 = -ty2; }
          z.x = p[0] + tx2 * z.speed * 0.4 * dt;
          z.y = p[1] + ty2 * z.speed * 0.4 * dt;
        }
      }

      // босс и толстяк толкают бочки
      for (const barrel of this.barrels) {
        if (!barrel.alive) continue;
        const bx2 = z.x - barrel.x;
        const by2 = z.y - barrel.y;
        const distance = Math.hypot(bx2, by2);
        const minimum = z.r + 14;
        if (distance <= 0 || distance >= minimum) continue;
        const normalX = bx2 / distance;
        const normalY = by2 / distance;
        if (z.kind === "boss" || z.kind === "fatty") {
          const push = (z.kind === "boss" ? 145 : 72) * dt;
          const oldX = barrel.x;
          const oldY = barrel.y;
          barrel.x = clamp(barrel.x - normalX * push, 20, WORLD_W - 20);
          barrel.y = clamp(barrel.y - normalY * push, 20, WORLD_H - 20);
          const hitWall = this.obstacles.some((o) => pushOut(barrel.x, barrel.y, 14, o));
          if (hitWall) {
            barrel.x = oldX;
            barrel.y = oldY;
            barrel.hp -= z.kind === "boss" ? 45 * dt : 22 * dt;
            if (barrel.hp <= 0) this.explodeBarrel(barrel);
          }
        } else {
          z.x = barrel.x + normalX * minimum;
          z.y = barrel.y + normalY * minimum;
        }
      }

      // атака игрока
      if (dist < z.r + 16 && z.atkCd <= 0 && z.staggerT <= 0) {
        z.atkCd = z.kind === "runner" ? 0.7 : 1.05;
        // игрока отбрасывает от удара
        this.vx += nx * (z.kind === "boss" ? 420 : z.kind === "fatty" ? 300 : 160);
        this.vy += ny * (z.kind === "boss" ? 420 : z.kind === "fatty" ? 300 : 160);
        const ps = Math.hypot(this.vx, this.vy);
        if (ps > 460) {
          this.vx = (this.vx / ps) * 460;
          this.vy = (this.vy / ps) * 460;
        }
        if (z.kind === "runner") z.lungeCd = Math.max(z.lungeCd, 1.4);
        this.hurt(z.dmg, true);
      }
    }
  }

  private damageZombie(z: Zombie, amount: number, dirX: number, dirY: number, impulse: number, staggerSec: number, crit = false) {
    const dmg = Math.max(1, Math.round(amount * z.dmgMul * (crit ? 1.75 : 1)));
    z.hp -= dmg;
    z.flash = crit ? 0.14 : 0.09;
    const effectiveImpulse = impulse / z.mass;
    z.vx += dirX * effectiveImpulse;
    z.vy += dirY * effectiveImpulse;
    z.staggerT = Math.max(z.staggerT, staggerSec / Math.sqrt(z.mass));
    z.hitTwist = (Math.random() > 0.5 ? 1 : -1) * Math.min(0.48, (impulse / 220) / Math.sqrt(z.mass));
    // Направленный выброс капель крови по вектору полёта пули
    for (let k = 0; k < (crit ? 7 : 4); k++) {
      this.particle(
        z.x, z.y,
        dirX * (60 + Math.random() * 130) + (Math.random() - 0.5) * 80,
        dirY * (60 + Math.random() * 130) + (Math.random() - 0.5) * 80,
        0.3 + Math.random() * 0.25,
        z.kind === "spitter" || z.kind === "fatty" ? "#6f8f2f" : "#8f1d18",
        2.5 + Math.random() * 2
      );
    }
    this.hitMarkerT = 0.09;
    this.hitMarkerColor = crit ? "#ffd34d" : dmg >= 60 ? "#ff6a4d" : "#e8e2d0";
    if (this.cfg.settings.damageNumbers) {
      this.text(
        crit ? `${dmg}!` : `${dmg}`,
        z.x + (Math.random() - 0.5) * 14,
        z.y - z.r - 4,
        crit ? "#ffd34d" : dmg >= 60 ? "#ff9a70" : "#e8e2d0",
        crit ? 15 : dmg >= 60 ? 14 : 11
      );
    }
  }

  private killCheck() {
    const zs = this.zombies;
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      if (z.hp > 0) continue;
      this.kills++;
      if (z.kind === "boss") this.hitStop = Math.max(this.hitStop, 0.4);
      else if (z.elite || z.kind === "fatty" || z.kind === "armored") this.hitStop = Math.max(this.hitStop, 0.045);
      sfx.zombieDeath();
      this.stain(
        z.x, z.y, z.r * 0.95,
        z.kind === "spitter" || z.kind === "fatty" ? "rgba(70,100,40,0.55)" : "rgba(110,18,16,0.6)"
      );
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 30 + Math.random() * 120;
        this.particle(z.x, z.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.4, z.kind === "spitter" || z.kind === "fatty" ? "#5f7f2a" : "#7d1a15", 3.5);
      }
      // Толстяк оставляет кислотную лужу
      if (z.kind === "fatty") {
        this.pools.push({ x: z.x, y: z.y, r: 52, life: 8, acid: false });
      }
      // лом с трупа (иногда двумя кучками)
      const pieces = z.scrap > 25 && Math.random() > 0.5 ? 2 : 1;
      for (let p = 0; p < pieces; p++) {
        this.drops.push({
          kind: "scrap",
          x: z.x + (Math.random() - 0.5) * (pieces > 1 ? 50 : 10),
          y: z.y + (Math.random() - 0.5) * (pieces > 1 ? 50 : 10),
          value: Math.max(1, Math.round(z.scrap / pieces)),
          life: 22,
          bob: Math.random() * 6,
        });
      }
      if (z.kind === "boss" || Math.random() < 0.05) {
        this.drops.push({ kind: "medkit", x: z.x + 12, y: z.y + 6, value: 0, life: 22, bob: 0 });
      }
      zs.splice(i, 1);
    }
  }

  // ============================================================
  // ПУЛИ / ГРАНАТЫ / ВЗРЫВЫ
  // ============================================================
  private updateBullets(dt: number) {
    const knock = this.cfg.weapon.pellets > 1 ? this.phys.knockbackImpulse * 0.34 : this.phys.knockbackImpulse;
    const stagger = this.phys.staggerSec;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const sx = b.vx * dt;
      const sy = b.vy * dt;
      b.x += sx;
      b.y += sy;
      b.range -= Math.hypot(sx, sy);
      let dead = b.range <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H;
      if (!dead) {
        for (const o of this.obstacles) {
          if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
            dead = true;
            for (let k = 0; k < 3; k++)
              this.particle(b.x, b.y, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 0.25, "#b8ab8c", 2);
            break;
          }
        }
      }
      if (!dead) {
        for (const barrel of this.barrels) {
          if (!barrel.alive) continue;
          if (Math.hypot(b.x - barrel.x, b.y - barrel.y) < 15) {
            barrel.hp -= b.dmg;
            barrel.fuse = 0.5;
            dead = true;
            if (barrel.hp <= 0) this.explodeBarrel(barrel);
            break;
          }
        }
      }
      if (!dead) {
        for (const z of this.zombies) {
          if (b.hits.has(z.id)) continue;
          const rr = z.r + 7;
          if (Math.abs(b.x - z.x) > rr || Math.abs(b.y - z.y) > rr) continue;
          if (Math.hypot(b.x - z.x, b.y - z.y) < rr) {
            const dl = Math.hypot(b.vx, b.vy) || 1;
            this.damageZombie(z, b.dmg, b.vx / dl, b.vy / dl, knock, stagger);
            this.hitShots.add(b.shotId);
            b.hits.add(z.id);
            b.pierce--;
            if (b.pierce <= 0) { dead = true; break; }
            b.dmg *= 0.75;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
    this.killCheck();

    // кислотные плевки по игроку
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      let dead = s.life <= 0;
      if (!dead && this.obstacles.some((o) => s.x > o.x && s.x < o.x + o.w && s.y > o.y && s.y < o.y + o.h)) dead = true;
      if (!dead && Math.hypot(s.x - this.px, s.y - this.py) < 15) {
        this.hurt(s.dmg, false);
        dead = true;
      }
      if (dead) {
        for (let k = 0; k < 5; k++)
          this.particle(s.x, s.y, (Math.random() - 0.5) * 110, (Math.random() - 0.5) * 110, 0.3, "#9bd14a", 2.6);
        this.enemyShots.splice(i, 1);
      }
    }
  }

  private updateGrenades(dt: number) {
    for (let i = this.thrown.length - 1; i >= 0; i--) {
      const g = this.thrown[i];
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= Math.pow(0.14, dt);
      g.vy *= Math.pow(0.14, dt);
      g.z += g.vz * dt;
      g.vz -= 900 * dt;
      if (g.z < 0) { g.z = 0; g.vz = -g.vz * 0.4; }
      g.fuse -= dt;
      if (g.fuse <= 0) {
        this.thrown.splice(i, 1);
        this.explode(g.x, g.y, 120, 150);
      }
    }
  }

  private explodeBarrel(barrel: Barrel) {
    if (!barrel.alive) return;
    barrel.alive = false;
    this.explode(barrel.x, barrel.y, 130, 170);
  }

  private explode(x: number, y: number, radius: number, dmg: number) {
    sfx.explosion();
    this.hitStop = Math.max(this.hitStop, 0.06);
    this.blasts.push({ x, y, t: 0, r: radius });
    this.scorch.push({ x, y, r: radius * 0.62, life: 2.6, max: 2.6 });
    if (this.scorch.length > 12) this.scorch.shift();
    // Тряска и толчок камеры зависят от дистанции до игрока.
    const pDist = Math.hypot(this.px - x, this.py - y);
    const close = 1 - Math.min(1, pDist / 620);
    if (this.cfg.settings.screenShake) {
      this.shake = Math.max(this.shake, 9 + close * 15);
      const ka = Math.atan2(this.py - y, this.px - x);
      this.camKickX += Math.cos(ka) * (4 + close * 10);
      this.camKickY += Math.sin(ka) * (4 + close * 10);
    }
    this.stain(x, y, radius * 0.5, "rgba(20,16,12,0.6)");
    // Искры: быстрые и короткие.
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 140 + Math.random() * 480;
      this.particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.22 + Math.random() * 0.3, i % 3 === 0 ? "#fff3c0" : i % 3 === 1 ? "#ffe08a" : "#ff9a3a", 1.6 + Math.random() * 2.4, "spark");
    }
    // Угольки: светятся и живут дольше искр.
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 150;
      this.particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, 0.7 + Math.random() * 0.6, i % 2 ? "#ff8a2a" : "#ffcf6a", 2.2 + Math.random() * 2, "ember");
    }
    // Осколки и куски металла: средние, с вращением.
    const debrisColors = ["#3a3f3d", "#5c5a50", "#7a6a4a", "#2b2f2e", "#8a4a2a"];
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 260;
      this.particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.7 + Math.random() * 0.6, debrisColors[i % debrisColors.length], 2.5 + Math.random() * 3, "debris");
    }
    // Дым: медленный и самый долгоживущий.
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 15 + Math.random() * 60;
      this.particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 22, 1.3 + Math.random() * 1.1, i % 3 === 0 ? "rgba(60,55,50,0.6)" : "rgba(95,85,72,0.55)", 9 + Math.random() * 11, "smoke");
    }
    // Мощная вспышка в центре.
    this.particle(x, y, 0, 0, 0.24, "rgba(255,246,214,0.95)", radius * 0.5, "glow");
    for (const z of this.zombies) {
      const d = Math.hypot(z.x - x, z.y - y);
      if (d > radius + z.r) continue;
      const fall = 1 - (d / (radius + z.r)) * 0.6;
      const dl = Math.max(1, d);
      this.damageZombie(z, dmg * fall, (z.x - x) / dl, (z.y - y) / dl, 380, 0.5);
    }
    this.killCheck();
    // цепная детонация
    for (const barrel of this.barrels) {
      if (!barrel.alive) continue;
      if (Math.hypot(barrel.x - x, barrel.y - y) < radius + 14) {
        barrel.fuse = Math.max(barrel.fuse, 0.18 + Math.random() * 0.2);
      }
    }
    const pd = Math.hypot(this.px - x, this.py - y);
    if (pd < radius) this.hurt(Math.round(dmg * 0.3 * (1 - pd / radius)), false);
  }

  private updateMisc(dt: number) {
    // бочки с подожжённым фитилём
    for (const barrel of this.barrels) {
      if (!barrel.alive || barrel.fuse <= 0) continue;
      barrel.fuse -= dt;
      if (Math.random() < 0.4)
        this.particle(barrel.x + (Math.random() - 0.5) * 10, barrel.y - 12, (Math.random() - 0.5) * 20, -40 - Math.random() * 40, 0.3, "#ffcf6e", 2.4);
      if (barrel.fuse <= 0 && barrel.hp <= 30) this.explodeBarrel(barrel);
    }

    // гильзы: физика полёта, затем покой на земле; исчезают только fade-out'ом
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      const settled = s.z <= 0 && Math.hypot(s.vx, s.vy) < 10;
      if (!settled) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= Math.pow(0.2, dt);
        s.vy *= Math.pow(0.2, dt);
        s.z += s.vz * dt;
        s.vz -= 800 * dt;
        s.rot += s.vrot * dt;
        if (s.z < 0) { s.z = 0; s.vz = -s.vz * 0.35; s.vrot *= 0.5; }
        if (s.z === 0 && Math.hypot(s.vx, s.vy) < 10) { s.vx = s.vy = s.vrot = 0; }
      }
      s.life -= dt;
      if (s.life <= 0) this.shells.splice(i, 1);
    }

    // временные лужи от толстяков
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.life -= dt;
      if (p.life <= 0) this.pools.splice(i, 1);
    }

    // лут: магнит к игроку
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.bob += dt * 5;
      if (d.life <= 0) { this.drops.splice(i, 1); continue; }
      const dist = Math.hypot(d.x - this.px, d.y - this.py);
      if (dist < 70) {
        d.x += ((this.px - d.x) / dist) * 260 * dt;
        d.y += ((this.py - d.y) / dist) * 260 * dt;
      }
      if (dist < 22) {
        if (d.kind === "scrap") {
          const bonus = Math.round(d.value * (this.cfg.stats.currencyPct / 100));
          this.scrap += bonus;
          this.cb.onScrap(bonus);
          sfx.pickupScrap();
          this.text(`+${bonus}`, this.px, this.py - 24, "#b8d36a", 11);
        } else {
          const heal = Math.min(this.maxHp - this.hp, Math.round(this.maxHp * 0.22));
          if (heal > 0) {
            this.hp += heal;
            sfx.medkit();
            this.text(`+${heal} HP`, this.px, this.py - 24, "#5ee08a", 12);
          }
        }
        this.drops.splice(i, 1);
      }
    }

    // частицы и тексты: у каждого типа своё время жизни и поведение
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "smoke") {
        p.vy -= 28 * dt;
        p.vx *= Math.pow(0.12, dt);
        p.vy *= Math.pow(0.25, dt);
        p.size += (p.grow ?? 0) * dt;
      } else if (p.kind === "debris") {
        p.vx *= Math.pow(0.02, dt);
        p.vy *= Math.pow(0.02, dt);
        p.rot = (p.rot ?? 0) + (p.vrot ?? 0) * dt;
        p.vrot = (p.vrot ?? 0) * Math.pow(0.1, dt);
      } else if (p.kind === "ember") {
        p.vy -= 60 * dt;
        p.vx *= Math.pow(0.08, dt);
        p.vy *= Math.pow(0.08, dt);
      } else {
        p.vx *= Math.pow(0.05, dt);
        p.vy *= Math.pow(0.05, dt);
      }
    }
    // временное выжженное пятно гаснет за пару секунд (постоянный след остаётся на земле)
    for (let i = this.scorch.length - 1; i >= 0; i--) {
      this.scorch[i].life -= dt;
      if (this.scorch[i].life <= 0) this.scorch.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      this.blasts[i].t += dt;
      if (this.blasts[i].t > 1.0) this.blasts.splice(i, 1);
    }
  }

  /**
   * Cinematic camera: critically damped spring follow, look-ahead toward the cursor
   * and movement, boss framing, combat-density zoom, intro dolly and outro push-in.
   */
  private updateCamera(dt: number) {
    let nearby = 0;
    let boss: Zombie | null = null;
    for (const z of this.zombies) {
      if (z.kind === "boss") boss = z;
      if (Math.hypot(z.x - this.px, z.y - this.py) < 380) nearby++;
    }
    const mx = clamp((this.input.mouseX - VIEW_W / 2) / (VIEW_W / 2), -1, 1);
    const my = clamp((this.input.mouseY - VIEW_H / 2) / (VIEW_H / 2), -1, 1);
    let focusX = this.px + mx * 115 + this.vx * 0.2;
    let focusY = this.py + my * 78 + this.vy * 0.2;
    if (boss) {
      const d = Math.hypot(boss.x - this.px, boss.y - this.py);
      if (d < 720) {
        // Keep the boss inside the frame: pull focus between player and boss.
        focusX += (boss.x - this.px) * 0.24;
        focusY += (boss.y - this.py) * 0.24;
      }
    }
    const tx = clamp(focusX - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    const ty = clamp(focusY - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    const k = this.outroT > 0 ? 12 : this.introT > 0 ? 18 : 30;
    const damp = 2 * Math.sqrt(k);
    this.camVX += ((tx - this.camX) * k - this.camVX * damp) * dt;
    this.camVY += ((ty - this.camY) * k - this.camVY * damp) * dt;
    this.camX += this.camVX * dt;
    this.camY += this.camVY * dt;

    this.camKickX *= Math.pow(0.0005, dt);
    this.camKickY *= Math.pow(0.0005, dt);
    this.shake = Math.max(0, this.shake - dt * 30);

    // Zoom: intro dolly-in, wider framing in heavy fights and boss duels.
    let zoom = 1 - Math.min(0.1, nearby * 0.011);
    if (boss) zoom = Math.min(zoom, 0.9);
    const sprinting = this.input.sprint && Math.hypot(this.vx, this.vy) > this.speed * 1.05;
    if (sprinting) zoom *= 0.96;
    if (this.cfg.weapon.kind === "Снайперская винтовка" && this.input.fire) zoom = 1.07;
    if (this.introT > 0) {
      this.introT = Math.max(0, this.introT - dt);
      zoom = 1.4 - 0.4 * easeOutCubic(1 - this.introT / 2.2);
    }
    if (this.outroT > 0) zoom = this.outroVictory ? 0.93 : 1.32;
    this.camTargetZoom = zoom;
    const zoomRate = this.introT > 0 ? 8 : this.outroT > 0 ? 1.6 : 2.2;
    this.camZoom += (this.camTargetZoom - this.camZoom) * Math.min(1, dt * zoomRate);

    // Letterbox bars during the intro, boss charges and the outro.
    const bossCharge = !!boss && boss.state !== "chase";
    const lbTarget = this.introT > 0.4 || this.outroT > 0 || bossCharge ? 1 : this.banner ? 0.5 : 0;
    this.letterbox += (lbTarget - this.letterbox) * Math.min(1, dt * 3.5);
  }

  /** Gentle aim assist: bends shots toward a hostile inside a narrow cone. */
  private assistedAngle(range: number) {
    const aiming = this.input.aim && !this.ended;
    let best: Zombie | null = null;
    let bestScore = Infinity;
    for (const z of this.zombies) {
      const d = Math.hypot(z.x - this.px, z.y - this.py);
      if (d > range * 1.05) continue;
      const off = Math.abs(angleDiff(Math.atan2(z.y - this.py, z.x - this.px), this.angle));
      const cone = (0.2 + Math.min(0.12, (z.r * 1.5) / Math.max(40, d))) * (aiming ? 1.3 : 1);
      if (off > cone) continue;
      const score = off * 3 + d / range;
      if (score < bestScore) { bestScore = score; best = z; }
    }
    if (!best) return this.angle;
    const target = Math.atan2(best.y - this.py, best.x - this.px);
    return this.angle + angleDiff(target, this.angle) * (aiming ? 0.85 : 0.65);
  }

  private startOutro(victory: boolean) {
    if (this.outroT > 0 || this.ended) return;
    this.outroVictory = victory;
    this.outroT = victory ? 1.7 : 1.6;
    this.clearInput();
    this.showBanner(victory ? "РАЙОН ЗАЧИЩЕН" : "ВЫ ПАЛИ", victory ? "Отход на базу" : "Сигнал потерян", 2.4);
  }

  private particle(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number, kind: Particle["kind"] = "spark") {
    const quality = this.cfg.settings.particleQuality;
    if (quality === "off") return;
    if (quality === "low" && ++this.particleSerial % 3 !== 0) return;
    if (this.particles.length >= (quality === "low" ? 120 : 520)) this.particles.shift();
    this.particles.push({ x, y, vx, vy, life, max: life, color, size, kind, grow: kind === "smoke" ? 2.4 : 0, rot: kind === "debris" ? Math.random() * 6 : 0, vrot: kind === "debris" ? (Math.random() - 0.5) * 14 : 0 });
  }

  private text(text: string, x: number, y: number, color: string, size: number) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ text, x, y, vy: -34, life: 0.8, color, size });
  }

  private stain(x: number, y: number, r: number, color: string) {
    this.stains.push({ x, y, r, color });
    const g = this.gctx;
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(x + (Math.random() - 0.5) * r * 2.2, y + (Math.random() - 0.5) * r * 2.2, r * (0.2 + Math.random() * 0.3), 0, Math.PI * 2);
      g.fill();
    }
  }

  private hurt(raw: number, melee: boolean) {
    if (this.ended || this.outroT > 0) return;
    // Во время кувырка боец неуязвим всегда, независимо от источника урона.
    if (this.rollT > 0) return;
    if (this.invuln > 0 && melee) return;
    const dmg = Math.max(1, Math.round(raw * this.armorMul));
    this.hp -= dmg;
    this.damageTaken += dmg;
    this.hurtT = 0.32;
    if (melee) this.invuln = 0.5;
    sfx.playerHit();
    if (this.cfg.settings.screenShake) this.shake = Math.max(this.shake, 9);
    if (this.cfg.settings.damageNumbers) this.text(`-${dmg}`, this.px, this.py - 22, "#ff4a3d", 13);
    if (this.hp <= 0) {
      this.hp = 0;
      this.startOutro(false);
    }
  }

  /** Снимок патронов по слотам: магазин + запас. */
  snapshotAmmo(): Record<WeaponSlot, number> {
    this.magazines[this.activeSlot] = this.ammo;
    this.reserves[this.activeSlot] = this.reserve;
    return {
      sidearm: this.magazines.sidearm + this.reserves.sidearm,
      primary: this.magazines.primary + this.reserves.primary,
    };
  }

  /** Остаток патронов по id оружия — для возврата на склад. */
  ammoLeftByWeapon(): Record<string, number> {
    const snap = this.snapshotAmmo();
    const out: Record<string, number> = {};
    (["sidearm", "primary"] as const).forEach((slot) => {
      const w = this.slots[slot];
      if (w && !isMelee(w)) out[w.id] = snap[slot];
    });
    return out;
  }

  /** Small tactical display is rendered separately from the arena for a clean HUD radar. */
  renderMinimap(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cssW = canvas.clientWidth || 150;
    const cssH = canvas.clientHeight || 94;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const sx = cssW / WORLD_W;
    const sy = cssH / WORLD_H;

    ctx.fillStyle = "rgba(9, 15, 13, 0.95)";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.strokeStyle = "rgba(138, 164, 142, 0.13)";
    ctx.lineWidth = 1;
    for (let x = 0; x < cssW; x += cssW / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cssH); ctx.stroke(); }
    for (let y = 0; y < cssH; y += cssH / 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssW, y); ctx.stroke(); }

    ctx.fillStyle = "rgba(126, 143, 129, 0.38)";
    for (const o of this.obstacles) ctx.fillRect(o.x * sx, o.y * sy, Math.max(1, o.w * sx), Math.max(1, o.h * sy));
    ctx.fillStyle = "#b9764a";
    for (const b of this.barrels) {
      if (!b.alive) continue;
      ctx.fillRect(b.x * sx - 1, b.y * sy - 1, 2, 2);
    }
    ctx.fillStyle = "#b8d36a";
    for (const crate of this.crates) {
      if (!crate.opened) ctx.fillRect(crate.x * sx - 1.5, crate.y * sy - 1.5, 3, 3);
    }
    for (const z of this.zombies) {
      ctx.fillStyle = z.kind === "boss" ? "#ffd067" : z.elite ? "#ff694f" : z.kind === "spitter" ? "#a4c95f" : "#d45247";
      ctx.beginPath();
      ctx.arc(z.x * sx, z.y * sy, z.kind === "boss" ? 4.2 : z.kind === "fatty" ? 2.6 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(240, 239, 222, 0.35)";
    ctx.strokeRect(this.camX * sx, this.camY * sy, VIEW_W / this.camZoom * sx, VIEW_H / this.camZoom * sy);
    ctx.save();
    ctx.translate(this.px * sx, this.py * sy);
    ctx.rotate(this.angle);
    ctx.fillStyle = "#eff4dd";
    ctx.beginPath();
    ctx.moveTo(5.5, 0);
    ctx.lineTo(-3.5, -3.4);
    ctx.lineTo(-3.5, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private finish(victory: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.phase = "ended";
    this.clearInput();
    if (victory) sfx.victory();
    else sfx.defeat();
    const acc = this.shotCounter > 0 ? this.hitShots.size / this.shotCounter : 1;
    const stars = victory ? gradeTime(this.cfg.level, this.time) : 0;
    this.cb.onEnd({
      victory,
      stars,
      kills: this.kills,
      accuracy: Math.round(acc * 100),
      damageTaken: this.damageTaken,
      maxHp: this.maxHp,
      scrap: this.scrap,
      time: Math.round(this.time),
      wave: this.wave,
      ammoLeft: this.snapshotAmmo(),
    });
  }

  getHud(): HudState {
    const w = this.cfg.weapon;
    const boss = this.zombies.find((z) => z.kind === "boss");
    const moving = Math.hypot(this.vx, this.vy) > 25;
    return {
      hp: Math.max(0, Math.round(this.hp)),
      hpTrail: Math.max(0, Math.round(this.hpTrail)),
      maxHp: this.maxHp,
      armorPct: Math.round((1 - this.armorMul) * 100),
      stamina: Math.round(this.stamina),
      exhausted: this.exhausted,
      ammo: this.ammo,
      mag: w.magSize,
      reserve: this.reserve,
      weaponId: w.id,
      activeSlot: this.activeSlot,
      sidearmId: this.slots.sidearm?.id ?? null,
      primaryId: this.slots.primary?.id ?? null,
      canSwap: this.cfg.canSwap,
      grenades: this.grenades,
      crateNear: !!this.nearestCrate(),
      melee: !isMelee(w) && this.ammo + this.reserve <= 0,
      slotAmmo: {
        sidearm: this.activeSlot === "sidearm" ? this.ammo + this.reserve : this.magazines.sidearm + this.reserves.sidearm,
        primary: this.activeSlot === "primary" ? this.ammo + this.reserve : this.magazines.primary + this.reserves.primary,
      },
      reload: this.reloadT > 0 ? 1 - this.reloadT / this.reloadMax : -1,
      roll: this.rollT > 0 ? 0 : this.rollCd > 0 ? 1 - this.rollCd / this.rollCdMax : 1,
      wave: this.wave,
      waves: this.cfg.level.waves,
      waveLeft: Math.max(0, this.waveTotal - this.waveSpawned) + this.zombies.length,
      waveTotal: this.waveTotal + (this.cfg.level.boss && this.wave === this.cfg.level.waves ? 1 : 0),
      kills: this.kills,
      accuracy: this.shotCounter > 0 ? Math.round((this.hitShots.size / this.shotCounter) * 100) : 100,
      scrap: this.scrap,
      time: Math.round(this.time),
      boss: boss ? { name: boss.name, hp: Math.max(0, boss.hp), max: boss.maxHp } : null,
      banner: this.banner,
      phase: this.phase,
      breakLeft: this.phase === "break" || this.phase === "ready" ? Math.ceil(this.phaseT) : 0,
      stance: this.bloom > 0.09 ? "recoil" : moving ? "moving" : "steady",
      camZoom: this.camZoom,
      aiming: this.input.aim && !this.ended,
    };
  }

  // ============================================================
  // ОТРИСОВКА
  // ============================================================
  render(ctx: CanvasRenderingContext2D) {
    const quality = this.cfg.settings.graphicsQuality;
    const scale = quality === "low" ? 0.75 : quality === "medium" ? 1 : Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
    if (ctx.canvas.width !== Math.round(VIEW_W * scale)) {
      ctx.canvas.width = Math.round(VIEW_W * scale);
      ctx.canvas.height = Math.round(VIEW_H * scale);
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.canvas.style.imageRendering = quality === "low" ? "pixelated" : "auto";
    const sh = this.shake;
    const zoom = this.camZoom;
    const vw = VIEW_W / zoom;
    const vh = VIEW_H / zoom;
    const centerX = this.camX + this.camKickX + VIEW_W / 2 + (Math.random() - 0.5) * sh;
    const centerY = this.camY + this.camKickY + VIEW_H / 2 + (Math.random() - 0.5) * sh;
    const cx = Math.round(clamp(centerX - vw / 2, 0, WORLD_W - vw));
    const cy = Math.round(clamp(centerY - vh / 2, 0, WORLD_H - vh));
    this.lastSrcX = cx;
    this.lastSrcY = cy;
    ctx.imageSmoothingEnabled = quality !== "low";

    ctx.drawImage(this.ground, cx, cy, vw, vh, 0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
    const inView = (x: number, y: number, m = 60) =>
      x > cx - m && x < cx + vw + m && y > cy - m && y < cy + vh + m;

    // кислотные лужи
    for (const p of this.pools) {
      const a = p.acid ? 1 : Math.min(1, p.life / 1.2);
      ctx.fillStyle = `rgba(110,165,45,${0.3 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(170,220,80,${0.28 * a})`;
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(this.time * 3) * 8, p.y, p.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      if (p.acid) {
        ctx.strokeStyle = `rgba(190,240,110,${0.35 + Math.sin(this.time * 5) * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        for (let b = 0; b < 3; b++) {
          const ba = this.time * 2 + b * 2.1;
          ctx.fillStyle = `rgba(210,250,150,${0.4 * a})`;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(ba) * p.r * 0.6, p.y + Math.sin(ba) * p.r * 0.6, 2 + Math.sin(this.time * 6 + b) * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // временное выжженное пятно: тёмная земля гаснет пару секунд
    for (const s of this.scorch) {
      if (!inView(s.x, s.y, s.r)) continue;
      const a = Math.max(0, s.life / s.max);
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(8,6,5,${0.72 * a})`);
      g.addColorStop(0.6, `rgba(14,10,8,${0.5 * a})`);
      g.addColorStop(1, "rgba(10,8,6,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      // тлеющая кромка в первую секунду
      if (s.life > s.max - 1) {
        const e = (s.life - (s.max - 1));
        ctx.strokeStyle = `rgba(255,140,50,${0.5 * e})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 0.82, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // лут
    for (const d of this.drops) {
      if (!inView(d.x, d.y)) continue;
      if (d.life < 4 && Math.floor(d.life * 8) % 2 === 0) continue;
      const by = Math.sin(d.bob) * 2;
      if (d.kind === "scrap") {
        ctx.fillStyle = "rgba(184,211,106,0.18)";
        ctx.beginPath();
        ctx.arc(d.x, d.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#9aa08a";
        ctx.fillRect(d.x - 5, d.y - 4 + by, 10, 8);
        ctx.fillStyle = "#c9cfb5";
        ctx.fillRect(d.x - 3, d.y - 2 + by, 4, 3);
        ctx.strokeStyle = "#2a2d26";
        ctx.lineWidth = 1;
        ctx.strokeRect(d.x - 5, d.y - 4 + by, 10, 8);
      } else {
        ctx.fillStyle = "rgba(94,224,138,0.2)";
        ctx.beginPath();
        ctx.arc(d.x, d.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e8e2d0";
        ctx.fillRect(d.x - 8, d.y - 6 + by, 16, 12);
        ctx.fillStyle = "#c8322a";
        ctx.fillRect(d.x - 2, d.y - 4 + by, 4, 8);
        ctx.fillRect(d.x - 4, d.y - 2 + by, 8, 4);
      }
    }

    // Ящики снабжения
    for (const crate of this.crates) {
      if (crate.opened || !inView(crate.x, crate.y)) continue;
      const pulse = 0.55 + Math.sin(this.time * 3 + crate.phase) * 0.15;
      const color = crate.kind === "scrap" ? "#a7cb72" : crate.kind === "grenade" ? "#da8f76" : "#e8e2d0";
      const glow = crate.kind === "scrap" ? "150,200,110" : crate.kind === "grenade" ? "230,150,110" : "230,235,220";
      ctx.fillStyle = `rgba(${glow},${pulse * 0.22})`;
      ctx.beginPath();
      ctx.arc(crate.x, crate.y, 29, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fillRect(crate.x - 15, crate.y - 11, 34, 30);
      ctx.fillStyle = "#514531";
      ctx.fillRect(crate.x - 17, crate.y - 16, 34, 29);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(crate.x - 17, crate.y - 16, 34, 29);
      ctx.fillStyle = "#816f4a";
      ctx.fillRect(crate.x - 17, crate.y - 5, 34, 4);
      ctx.fillStyle = color;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(crate.kind === "scrap" ? "⚙" : crate.kind === "grenade" ? "✴" : "✚", crate.x, crate.y + 7);
      if (Math.hypot(crate.x - this.px, crate.y - this.py) < 76) {
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#ffe7ac";
        ctx.fillText("[ E ] ОТКРЫТЬ", crate.x, crate.y - 27);
      }
    }

    // бочки
    for (const b of this.barrels) {
      if (!b.alive || !inView(b.x, b.y)) continue;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(b.x + 3, b.y + 5, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.fuse > 0 ? "#ffcc55" : "#9c2f25";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a120e";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#e7c55a";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a120e";
      ctx.fillRect(b.x - 1, b.y - 4, 2, 8);
    }

    // телеграф рывка босса
    for (const z of this.zombies) {
      if (z.kind === "boss" && z.state === "telegraph") {
        ctx.strokeStyle = `rgba(230,50,40,${0.35 + Math.sin(this.time * 30) * 0.2})`;
        ctx.lineWidth = z.r * 1.6;
        ctx.beginPath();
        ctx.moveTo(z.x, z.y);
      ctx.lineTo(z.x + z.dirX * 280, z.y + z.dirY * 280);
        ctx.stroke();
      }
    }

    // зомби
    for (const z of this.zombies) {
      if (!inView(z.x, z.y)) continue;
      this.drawZombie(ctx, z);
    }

    // гильзы: тень, блик и плавное затухание в последнюю секунду жизни
    for (const s of this.shells) {
      if (!inView(s.x, s.y)) continue;
      const a = Math.min(1, s.life / 1.2);
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(s.x + 1.5, s.y + 1, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(s.x, s.y - s.z * 0.5);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.color;
      ctx.fillRect(-3, -1.2, 6, 2.4);
      ctx.fillStyle = "rgba(255,240,200,0.55)";
      ctx.fillRect(-3, -1.2, 6, 0.8);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 0.6;
      ctx.strokeRect(-3, -1.2, 6, 2.4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // кислотные плевки
    for (const s of this.enemyShots) {
      ctx.fillStyle = "#9bd14a";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(155,209,74,0.3)";
      ctx.beginPath();
      ctx.arc(s.x - s.vx * 0.02, s.y - s.vy * 0.02, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // гранаты в воздухе
    for (const g of this.thrown) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(g.x, g.y + 4, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = g.fuse < 0.3 ? "#ff7a4a" : "#4c5a3f";
      ctx.beginPath();
      ctx.arc(g.x, g.y - g.z * 0.4, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // пули (трассеры)
    ctx.strokeStyle = "rgba(255,230,160,0.85)";
    ctx.lineWidth = 2;
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      ctx.stroke();
    }

    // взрывы: вспышка → огненный шар → двойная ударная волна → дымовое кольцо
    for (const bl of this.blasts) {
      // 1) Мощная вспышка: яркая первые 0.15 с.
      const flash = Math.max(0, 1 - bl.t / 0.16);
      if (flash > 0) {
        const fg = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, bl.r * 0.85);
        fg.addColorStop(0, `rgba(255,252,235,${0.95 * flash})`);
        fg.addColorStop(0.5, `rgba(255,220,130,${0.6 * flash})`);
        fg.addColorStop(1, "rgba(255,160,60,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, bl.r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
      // 2) Огненный шар: растёт и темнеет ~0.45 с.
      const fire = Math.max(0, 1 - bl.t / 0.45);
      if (fire > 0) {
        const core = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, bl.r * (0.3 + (1 - fire) * 0.45));
        core.addColorStop(0, `rgba(255,244,200,${0.9 * fire})`);
        core.addColorStop(0.4, `rgba(255,150,50,${0.55 * fire})`);
        core.addColorStop(0.75, `rgba(180,60,25,${0.3 * fire})`);
        core.addColorStop(1, "rgba(120,30,15,0)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, bl.r * (0.3 + (1 - fire) * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
      // 3) Двойная ударная волна: быстрая светлая + медленная пылевая.
      const w1 = Math.min(1, bl.t / 0.55);
      if (w1 < 1) {
        ctx.strokeStyle = `rgba(255,225,150,${0.85 * (1 - w1)})`;
        ctx.lineWidth = 1 + 4 * (1 - w1);
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, bl.r * (0.3 + w1 * 1.1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,240,${0.5 * (1 - w1)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, bl.r * (0.3 + w1 * 1.1) - 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      const w2 = Math.min(1, bl.t / 0.9);
      if (w2 < 1) {
        ctx.strokeStyle = `rgba(150,135,115,${0.4 * (1 - w2)})`;
        ctx.lineWidth = 2 + 9 * (1 - w2);
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, bl.r * (0.35 + w2 * 0.85), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // частицы
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      // Осколки — вращающиеся кусочки металла, а не кружки.
      if (p.kind === "debris") {
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, 0.8);
        ctx.restore();
        continue;
      }
      const r = p.size * (p.kind === "smoke" ? 1 + (1 - a) * 1.8 : p.kind === "glow" ? 1 + (1 - a) * 0.6 : 1);
      if (quality !== "low" && (p.kind === "glow" || p.kind === "spark" || p.kind === "ember")) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
        g.addColorStop(0, p.color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = a * (p.kind === "glow" ? 0.85 : p.kind === "ember" ? 0.8 : 0.7);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // всплывающие тексты
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2.4);
      ctx.font = `bold ${t.size}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // The darkness is built on an overlay, so the flashlight clears only the overlay,
    // not the world pixels drawn underneath it.
    this.renderLight(ctx, cx, cy, zoom);

    // Keep the survivor readable even in the deepest parts of a district.
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
    this.drawPlayer(ctx);
    ctx.restore();

    // виньетка при ранении
    if (this.hurtT > 0) {
      ctx.fillStyle = `rgba(160,20,14,${this.hurtT * 0.5})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    const lowHp = this.hp / this.maxHp;
    if (lowHp < 0.35) {
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
      g.addColorStop(0, "rgba(120,10,8,0)");
      g.addColorStop(1, `rgba(120,10,8,${(0.35 - lowHp) * 1.6 + Math.sin(this.time * 4) * 0.05})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // Soft cinematic vignette keeps the eye centered on the action.
    const vig = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.68);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (this.outroT <= 0) this.drawCrosshair(ctx);

    // Letterbox bars.
    if (this.letterbox > 0.01) {
      const bar = Math.round(46 * this.letterbox);
      ctx.fillStyle = "#030404";
      ctx.fillRect(0, 0, VIEW_W, bar);
      ctx.fillRect(0, VIEW_H - bar, VIEW_W, bar);
    }
  }

  private drawZombie(ctx: CanvasRenderingContext2D, z: Zombie) {
    ctx.save();
    ctx.translate(z.x, z.y);
    // тень
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.ellipse(3, 6, z.r * 1.15, z.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(z.face + z.hitTwist);
    const gait = Math.sin(z.phase) * (z.kind === "runner" ? 3.4 : 2.2);
    // Внешность стабильна для особи: вариант + детерминированный шум по id.
    const v = z.variant;
    const zn = (s: number) => {
      const x = Math.sin(z.id * 12.9898 + s * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    const SKINS = ["#a8b090", "#9aa37e", "#b39a80", "#8fa08a"];
    const TOXIC_SKINS = ["#8fae4a", "#7d9c42", "#9cb85a", "#86a047"];
    const SHIRTS: Record<string, string[]> = {
      walker: ["#5d6a72", "#71624e", "#5f5a6e", "#6e6258"],
      runner: ["#8a6a52", "#7a5a48", "#96755a", "#6b5a52"],
      spitter: ["#5f7040", "#6b7a45", "#55663a", "#75854a"],
      fatty: ["#6b7a4a", "#5f7040", "#77854f", "#67763f"],
      armored: ["#55606c", "#4c565f", "#5d6871", "#505a66"],
      boss: ["#7a2b22", "#8f5a4a", "#6e2a24", "#845046"],
    };
    const PANTS = ["#3a4048", "#4a4438", "#384044", "#413c34"];
    const toxic = z.kind === "spitter" || z.kind === "fatty";
    const skin = z.flash > 0 ? "#f0e8d8" : (toxic ? TOXIC_SKINS : SKINS)[v % 4];
    const shirt = z.flash > 0 ? "#e8ded0" : SHIRTS[z.kind][v % 4];
    const pants = PANTS[(v + z.id) % 4];
    const r = z.r;

    // ноги: штаны + ботинки, грязь внизу
    ctx.fillStyle = shade(pants, 1);
    ctx.fillRect(-r * 0.7 - gait * 0.3, -r * 0.75, r * 0.55, r * 0.5);
    ctx.fillRect(-r * 0.7 + gait * 0.3, r * 0.25, r * 0.55, r * 0.5);
    ctx.fillStyle = "#22211c";
    ctx.fillRect(-r * 0.7 - gait * 0.3 - r * 0.16, -r * 0.75, r * 0.2, r * 0.5);
    ctx.fillRect(-r * 0.7 + gait * 0.3 - r * 0.16, r * 0.25, r * 0.2, r * 0.5);
    ctx.fillStyle = "rgba(30,26,20,0.5)";
    ctx.fillRect(-r * 0.6 - gait * 0.3, -r * 0.72, r * 0.3, r * 0.14);
    ctx.fillRect(-r * 0.6 + gait * 0.3, r * 0.58, r * 0.3, r * 0.14);
    // тело: рубашка/куртка с объёмом
    const torsoG = ctx.createLinearGradient(0, -r * 0.85, 0, r * 0.85);
    torsoG.addColorStop(0, shade(shirt, 1.18));
    torsoG.addColorStop(0.55, shirt);
    torsoG.addColorStop(1, shade(shirt, 0.72));
    ctx.fillStyle = z.flash > 0 ? "#e8ded0" : torsoG;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (z.kind === "armored") {
      // бронежилет: пластины + заклёпки + ремень
      ctx.fillStyle = "#39424c";
      ctx.fillRect(-r * 0.6, -r * 0.55, r * 1.2, r * 1.1);
      ctx.strokeStyle = "#222a31";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-r * 0.6, -r * 0.55, r * 1.2, r * 1.1);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.55); ctx.lineTo(-r * 0.2, r * 0.55);
      ctx.moveTo(r * 0.2, -r * 0.55); ctx.lineTo(r * 0.2, r * 0.55);
      ctx.stroke();
      ctx.fillStyle = "#7d8a96";
      for (const [rx, ry] of [[-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]] as const) {
        ctx.beginPath();
        ctx.arc(r * rx, r * ry, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(120,30,22,0.5)";
      ctx.fillRect(-r * 0.5, r * 0.3, r * 0.3, r * 0.16);
    } else {
      // рваный край одежды: зубцы снизу
      ctx.fillStyle = shade(shirt, 0.8);
      ctx.beginPath();
      const teeth = 5;
      for (let i = 0; i <= teeth; i++) {
        const tx = -r * 0.7 + (i / teeth) * r * 1.4;
        const ty = r * 0.85 - (i % 2 === 0 ? 0 : r * 0.16);
        if (i === 0) ctx.moveTo(tx, r * 0.85);
        else ctx.lineTo(tx, ty);
        ctx.lineTo(tx + r * 0.14, r * 0.85);
      }
      ctx.fill();
      // пятна крови на одежде (фиксированные для особи)
      ctx.fillStyle = toxic ? "rgba(70,100,40,0.5)" : "rgba(110,20,16,0.55)";
      for (let i = 0; i < 2 + (v % 2); i++) {
        ctx.beginPath();
        ctx.ellipse(-r * 0.4 + zn(i) * r * 0.9, -r * 0.4 + zn(i + 9) * r * 0.8, r * (0.1 + zn(i + 3) * 0.12), r * (0.08 + zn(i + 5) * 0.1), zn(i) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // раны по степени повреждений: 0 — царапины, 1 — рваная рана, 2 — рёбра/кость
      const dmg = (v + (z.id % 2)) % 3;
      if (dmg === 0) {
        ctx.strokeStyle = toxic ? "#4d6626" : "#6e1a14";
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.3 + i * r * 0.1, -r * 0.25);
          ctx.lineTo(-r * 0.2 + i * r * 0.1, r * 0.05);
          ctx.stroke();
        }
      } else if (dmg === 1) {
        ctx.fillStyle = toxic ? "#55702c" : "#7d1a15";
        ctx.beginPath();
        ctx.ellipse(r * 0.1, -r * 0.2, r * 0.22, r * 0.15, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = toxic ? "#3d5520" : "#4d0f0c";
        ctx.beginPath();
        ctx.ellipse(r * 0.1, -r * 0.2, r * 0.12, r * 0.08, 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // обнажённые рёбра
        ctx.strokeStyle = "#cfc4a8";
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(-r * 0.1 + i * r * 0.12, r * 0.1, r * 0.16, -0.9, 0.9);
          ctx.stroke();
        }
        ctx.fillStyle = toxic ? "rgba(70,100,40,0.4)" : "rgba(110,20,16,0.45)";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // свисающий лоскут одежды, качается в такт походке
      const sway = gait * 0.35;
      ctx.fillStyle = shade(shirt, 0.65);
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.7);
      ctx.lineTo(-r * 0.25 + sway, r * 0.7);
      ctx.lineTo(-r * 0.4 + sway * 1.6, r * 1.02);
      ctx.closePath();
      ctx.fill();
    }
    if (z.kind === "fatty") {
      // гнойные волдыри толстяка
      ctx.fillStyle = "#a8c25a";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-r * 0.3 + zn(20 + i) * r * 0.7, -r * 0.4 + zn(30 + i) * r * 0.8, 2 + zn(40 + i) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (z.kind === "boss") {
      // шрамы и шипы босса
      ctx.strokeStyle = "#3d0d0a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(r * 0.2, r * 0.2);
      ctx.moveTo(-r * 0.1, -r * 0.5); ctx.lineTo(r * 0.5, r * 0.1);
      ctx.stroke();
      ctx.fillStyle = "#d8cfb0";
      for (const [sx, sy] of [[-0.55, -0.5], [-0.55, 0.5], [-0.2, -0.62]] as const) {
        ctx.beginPath();
        ctx.moveTo(r * sx, r * sy);
        ctx.lineTo(r * (sx - 0.16), r * (sy + (sy > 0 ? 0.12 : -0.12)));
        ctx.lineTo(r * (sx + 0.1), r * (sy + (sy > 0 ? 0.14 : -0.14)));
        ctx.closePath();
        ctx.fill();
      }
    }
    // руки тянутся вперёд: кожа + рваные рукава
    const armSkin = z.flash > 0 ? "#e8ded0" : skin;
    ctx.fillStyle = armSkin;
    ctx.fillRect(r * 0.3, -r * 0.75 + gait * 0.2, r * 0.85, r * 0.32);
    ctx.fillRect(r * 0.3, r * 0.43 - gait * 0.2, r * 0.85, r * 0.32);
    ctx.fillStyle = shade(shirt, 0.85);
    ctx.fillRect(r * 0.28, -r * 0.77 + gait * 0.2, r * 0.3, r * 0.36);
    ctx.fillRect(r * 0.28, r * 0.41 - gait * 0.2, r * 0.3, r * 0.36);
    // когти
    ctx.fillStyle = "#d5cba8";
    for (const ay of [-r * 0.59 + gait * 0.2, r * 0.59 - gait * 0.2]) {
      ctx.beginPath();
      ctx.moveTo(r * 1.12, ay - r * 0.08);
      ctx.lineTo(r * 1.3, ay);
      ctx.lineTo(r * 1.12, ay + r * 0.08);
      ctx.closePath();
      ctx.fill();
    }
    // голова: кожа, челюсть, рана на виске
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(r * 0.55, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = shade(skin, 0.72);
    ctx.fillRect(r * 0.72, -r * 0.28, r * 0.2, r * 0.56);
    ctx.fillStyle = z.kind === "spitter" ? "#4d6626" : "#571512";
    ctx.beginPath();
    ctx.arc(r * 0.42 + (zn(7) - 0.5) * r * 0.2, -r * 0.3, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    // глаза
    ctx.fillStyle = z.elite ? "#ff3b2a" : z.kind === "boss" ? "#ffd24d" : "#c8372a";
    ctx.beginPath();
    ctx.arc(r * 0.78, -r * 0.16, z.elite ? 2.4 : 1.7, 0, Math.PI * 2);
    ctx.arc(r * 0.78, r * 0.16, z.elite ? 2.4 : 1.7, 0, Math.PI * 2);
    ctx.fill();
    if (z.elite) {
      ctx.fillStyle = "rgba(255,60,40,0.25)";
      ctx.beginPath();
      ctx.arc(r * 0.55, 0, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    // телеграф рывка бегуна: дрожит и мигает
    if (z.kind === "runner" && z.lungeT > 0) {
      ctx.strokeStyle = `rgba(255,120,60,${0.5 + Math.sin(this.time * 40) * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, z.r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // полоска HP (не у полных)
    if (z.hp < z.maxHp) {
      const w = z.r * 2.2;
      const pct = Math.max(0, z.hp / z.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(z.x - w / 2, z.y - z.r - 10, w, 4);
      ctx.fillStyle = z.kind === "boss" ? "#d13b2f" : z.elite ? "#ff7a3c" : "#7f9c3a";
      ctx.fillRect(z.x - w / 2, z.y - z.r - 10, w * pct, 4);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const inv = this.invuln > 0 && Math.floor(this.time * 18) % 2 === 0;
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.globalAlpha = inv ? 0.55 : 1;
    // Прогресс переката 0..1 (0 — начало, 1 — боец уже встал).
    const rollP = this.rollT > 0 ? 1 - this.rollT / this.rollTime : -1;
    const rolling = rollP >= 0;

    // тень: в перекате тело ближе к земле, тень собирается и темнеет
    const shadowSquash = rolling ? 1 - Math.sin(rollP * Math.PI) * 0.4 : 1;
    ctx.fillStyle = rolling ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(2, 8 * shadowSquash, 16 * (rolling ? 0.82 : 1), 7 * shadowSquash, 0, 0, Math.PI * 2);
    ctx.fill();

    // Кувырок: полный оборот через плечо со сжатием тела в клубок.
    if (rolling) {
      const spin = easeOutCubic(rollP) * Math.PI * 2 * this.rollDir;
      const tuck = Math.sin(rollP * Math.PI);           // 0 → 1 → 0
      ctx.rotate(Math.atan2(this.rollDY, this.rollDX) + spin);
      // тело группируется: сжимается вдоль движения и раздаётся поперёк
      ctx.scale(1.22 * (1 - tuck * 0.3), 1.22 * (1 - tuck * 0.12));
      ctx.translate(0, -tuck * 3);                       // небольшой отрыв от земли
    } else {
      ctx.rotate(this.angle);
      ctx.scale(1.22, 1.22);
    }
    const kick = this.gunKick;
    const bodySway = Math.sin(this.walkPhase) * 1.6;
    const w = this.cfg.weapon;
    // Живая поза: наклон корпуса по ходу движения + дыхание.
    const fwdSpeed = this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
    const lean = Math.max(-1, Math.min(1, fwdSpeed / 260)) * 1.6;
    const breathe = Math.sin(this.time * 3.1) * 0.5;
    const heavyArmor = this.cfg.stats.armor >= 15;

    // Ноги: ботинки со шнуровкой + наколенники + складки штанин.
    const legSwingA = bodySway * 0.48;
    const legSwingB = -bodySway * 0.48;
    ctx.fillStyle = "#101514";
    ctx.fillRect(-12.5, -8 + legSwingA, 8.5, 5);
    ctx.fillRect(-12.5, 3 + legSwingB, 8.5, 5);
    ctx.fillStyle = "#3b4843";
    ctx.fillRect(-8, -7 + bodySway * 0.42, 9, 5);
    ctx.fillRect(-8, 2 - bodySway * 0.42, 9, 5);
    ctx.fillStyle = "#202927";
    ctx.fillRect(-7.5, -6.4 + bodySway * 0.42, 2.2, 3.8);
    ctx.fillRect(-7.5, 2.6 - bodySway * 0.42, 2.2, 3.8);
    ctx.fillStyle = "#59665c";
    ctx.fillRect(-4.5, -7 + bodySway * 0.42, 3.4, 5);
    ctx.fillRect(-4.5, 2 - bodySway * 0.42, 3.4, 5);
    ctx.strokeStyle = "rgba(12,18,15,0.6)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-6.5, -6.4 + bodySway * 0.42); ctx.lineTo(-1.5, -6.4 + bodySway * 0.42);
    ctx.moveTo(-6.5, 3.2 - bodySway * 0.42); ctx.lineTo(-1.5, 3.2 - bodySway * 0.42);
    ctx.stroke();
    // Грязь на ботинках.
    ctx.fillStyle = "rgba(52,44,32,0.7)";
    ctx.fillRect(-12.3, -7.4 + legSwingA, 3.4, 2);
    ctx.fillRect(-12.3, 5.4 + legSwingB, 3.4, 2);

    // Рюкзак с лямками и скаткой.
    ctx.fillStyle = this.cfg.stats.maxHp >= 145 ? "#3f5142" : "#2d3b35";
    ctx.beginPath();
    ctx.roundRect(-10.5, -10 + bodySway * 0.25, 8.5, 20, 3);
    ctx.fill();
    ctx.strokeStyle = "#17201d";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = "rgba(16,24,21,0.7)";
    ctx.fillRect(-9.5, -6 + bodySway * 0.25, 6.5, 2);
    ctx.fillRect(-9.5, 4 + bodySway * 0.25, 6.5, 2);
    ctx.fillStyle = "#6b6250";
    ctx.beginPath();
    ctx.roundRect(-11.5, -8 + bodySway * 0.25, 3.4, 16, 1.5);
    ctx.fill();

    // Торс: куртка/бронежилет с объёмом, воротником и наплечниками.
    const torsoX = -5 + lean * 0.5;
    const torsoG = ctx.createLinearGradient(torsoX, -9, torsoX, 9);
    torsoG.addColorStop(0, heavyArmor ? "#617361" : "#76867a");
    torsoG.addColorStop(0.55, heavyArmor ? "#536553" : "#68776b");
    torsoG.addColorStop(1, heavyArmor ? "#3d4c40" : "#4c5a51");
    ctx.fillStyle = torsoG;
    ctx.beginPath();
    ctx.roundRect(torsoX, -9 + bodySway * 0.3 + breathe * 0.3, 15, 18, 4);
    ctx.fill();
    ctx.strokeStyle = "#17201d";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Наплечники.
    ctx.fillStyle = heavyArmor ? "#46543f" : "#55645a";
    ctx.beginPath();
    ctx.roundRect(torsoX + 1, -10 + bodySway * 0.3, 7, 3.4, 1.2);
    ctx.roundRect(torsoX + 1, 6.6 + bodySway * 0.3, 7, 3.4, 1.2);
    ctx.fill();
    ctx.strokeStyle = "rgba(10,16,13,0.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Воротник-стойка.
    ctx.fillStyle = "#2b3530";
    ctx.fillRect(torsoX - 1.5, -6 + bodySway * 0.3, 3, 12);
    // Разгрузка: ремни, подсумки, рация.
    ctx.fillStyle = "rgba(16,24,21,0.7)";
    ctx.fillRect(torsoX + 4, -8 + bodySway * 0.3, 3, 16);
    ctx.fillRect(torsoX, -2 + bodySway * 0.3, 15, 2);
    ctx.fillStyle = "#3f4a3d";
    ctx.fillRect(torsoX + 6.5, -7 + bodySway * 0.3, 5, 5);
    ctx.fillRect(torsoX + 6.5, 2 + bodySway * 0.3, 5, 5);
    ctx.strokeStyle = "rgba(8,14,11,0.6)";
    ctx.lineWidth = 0.7;
    ctx.strokeRect(torsoX + 6.5, -7 + bodySway * 0.3, 5, 5);
    ctx.strokeRect(torsoX + 6.5, 2 + bodySway * 0.3, 5, 5);
    ctx.fillStyle = "#222b26";
    ctx.fillRect(torsoX - 3.5, 4 + bodySway * 0.3, 3.4, 5);
    // Складки ткани.
    ctx.strokeStyle = "rgba(10,16,13,0.35)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(torsoX + 1, -5 + bodySway * 0.3); ctx.quadraticCurveTo(torsoX + 4, 0, torsoX + 1, 5 + bodySway * 0.3);
    ctx.moveTo(torsoX + 11, -6 + bodySway * 0.3); ctx.quadraticCurveTo(torsoX + 13, 0, torsoX + 11, 6 + bodySway * 0.3);
    ctx.stroke();
    // Потёртости, грязь и кровь на одежде.
    ctx.fillStyle = "rgba(30,26,20,0.4)";
    ctx.beginPath(); ctx.ellipse(torsoX + 3, 5.5 + bodySway * 0.3, 3.2, 2, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(110,24,18,0.5)";
    ctx.beginPath(); ctx.ellipse(torsoX + 9, -6.5 + bodySway * 0.3, 2.2, 1.5, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(torsoX + 11.5, -5 + bodySway * 0.3, 0.9, 0, Math.PI * 2); ctx.fill();
    // Антенна рации.
    ctx.strokeStyle = "#a8bd9b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -8 + bodySway * 0.3);
    ctx.lineTo(-11, -15 + bodySway * 0.3);
    ctx.stroke();
    // Тень от рук на торсе для глубины.
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(torsoX + 8, -9 + bodySway * 0.3, 7, 18);

    const muzzle = drawHeldWeapon(ctx, w, kick, this.reloadT > 0 ? 1 - this.reloadT / this.reloadMax : -1, !isMelee(w) && this.ammo + this.reserve <= 0 && this.muzzleT <= 0);
    // Голова: кожа, шлем с ремнём и царапиной, фонарик-визор.
    const hx = 1 - kick * 0.15 + lean * 0.4;
    const hy = bodySway * 0.3 + breathe * 0.2;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(hx + 1.5, hy + 2, 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b9916d";
    ctx.beginPath();
    ctx.arc(hx, hy, 6.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(120,80,60,0.35)";
    ctx.beginPath();
    ctx.arc(hx + 3, hy + 2.5, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.cfg.stats.armor >= 10 ? "#55644d" : "#3f4c43";
    ctx.beginPath();
    ctx.arc(hx - 1.2, hy, 7.5, Math.PI * 0.82, Math.PI * 2.18);
    ctx.lineTo(hx + 4.5, hy - 5.2);
    ctx.lineTo(hx + 4.5, hy + 5.2);
    ctx.fill();
    ctx.strokeStyle = "#1c1a14";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Ремень шлема + царапина на каске.
    ctx.strokeStyle = "#2b241c";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(hx - 1, hy + 5.4);
    ctx.quadraticCurveTo(hx + 2, hy + 7.4, hx + 4.4, hy + 4.6);
    ctx.stroke();
    ctx.strokeStyle = "rgba(210,205,180,0.5)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx - 5.5, hy - 3);
    ctx.lineTo(hx - 2.5, hy - 5);
    ctx.stroke();
    ctx.fillStyle = "#d8e58c";
    ctx.fillRect(hx + 4.2, hy - 1.2, 2.5, 2.4);
    ctx.fillStyle = "rgba(216,229,140,0.25)";
    ctx.fillRect(hx + 3.4, hy - 2, 4.2, 4);
    // дульная вспышка
    if (this.muzzleT > 0) {
      const mx = muzzle.x;
      const my = muzzle.y;
      const flashSize = w.kind === "Пистолет" ? 12 : 22;
      const bloom = ctx.createRadialGradient(mx, my, 0, mx, my, flashSize);
      bloom.addColorStop(0, "rgba(255,245,200,0.95)");
      bloom.addColorStop(0.35, "rgba(255,170,70,0.55)");
      bloom.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(mx, my, flashSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe9a0";
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + flashSize * 0.5, my - 3.5);
      ctx.lineTo(mx + flashSize, my);
      ctx.lineTo(mx + flashSize * 0.5, my + 3.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Дистанция луча до первого непрозрачного объекта. */
  private lightRayDistance(angle: number, maximum: number) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let nearest = maximum;
    for (const o of this.obstacles) {
      let tMin = -Infinity;
      let tMax = Infinity;
      if (Math.abs(dx) < 1e-6) {
        if (this.px < o.x || this.px > o.x + o.w) continue;
      } else {
        const a = (o.x - this.px) / dx;
        const b = (o.x + o.w - this.px) / dx;
        tMin = Math.max(tMin, Math.min(a, b));
        tMax = Math.min(tMax, Math.max(a, b));
      }
      if (Math.abs(dy) < 1e-6) {
        if (this.py < o.y || this.py > o.y + o.h) continue;
      } else {
        const a = (o.y - this.py) / dy;
        const b = (o.y + o.h - this.py) / dy;
        tMin = Math.max(tMin, Math.min(a, b));
        tMax = Math.min(tMax, Math.max(a, b));
      }
      if (tMax >= Math.max(0, tMin) && tMin > 0) nearest = Math.min(nearest, tMin - 2);
    }
    return nearest;
  }

  private renderLight(ctx: CanvasRenderingContext2D, cx: number, cy: number, zoom: number) {
    // Тёмные районы: чем дальше, тем темнее. Первый район почти дневной.
    const darkness = Math.min(0.78, 0.28 + this.cfg.level.num * 0.055);
    const w2s = (x: number, y: number): [number, number] => [(x - cx) * zoom, (y - cy) * zoom];
    const [px, py] = w2s(this.px, this.py);

    const overlay = this.lctx;
    overlay.save();
    overlay.clearRect(0, 0, VIEW_W, VIEW_H);
    overlay.fillStyle = `rgba(6,8,10,${darkness})`;
    overlay.fillRect(0, 0, VIEW_W, VIEW_H);
    overlay.globalCompositeOperation = "destination-out";

    // круг ближнего света
    let g = overlay.createRadialGradient(px, py, 10 * zoom, px, py, 155 * zoom);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    overlay.fillStyle = g;
    overlay.beginPath();
    overlay.arc(px, py, 155 * zoom, 0, Math.PI * 2);
    overlay.fill();

    // Лучевая маска фонаря: лучи останавливаются на геометрии мира
    const points: [number, number][] = [];
    const halfCone = 0.47;
    const rayCount = this.cfg.settings.graphicsQuality === "low" ? 17 : this.cfg.settings.graphicsQuality === "medium" ? 31 : 63;
    for (let i = 0; i <= rayCount; i++) {
      const a = this.angle - halfCone + (i / rayCount) * halfCone * 2;
      const d = this.lightRayDistance(a, 330);
      points.push(w2s(this.px + Math.cos(a) * d, this.py + Math.sin(a) * d));
    }
    g = overlay.createRadialGradient(px, py, 20 * zoom, px, py, 330 * zoom);
    g.addColorStop(0, "rgba(0,0,0,0.95)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    overlay.fillStyle = g;
    overlay.beginPath();
    overlay.moveTo(px, py);
    for (const [x, y] of points) overlay.lineTo(x, y);
    overlay.closePath();
    overlay.fill();

    // вспышка выстрела освещает всё вокруг
    if (this.muzzleT > 0) {
      g = overlay.createRadialGradient(px, py, 0, px, py, 230 * zoom);
      g.addColorStop(0, "rgba(0,0,0,0.85)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      overlay.fillStyle = g;
      overlay.fillRect(px - 230 * zoom, py - 230 * zoom, 460 * zoom, 460 * zoom);
    }
    // взрывы освещают тьму, пока горит огненный шар
    for (const bl of this.blasts) {
      const [bx, by] = w2s(bl.x, bl.y);
      const la = Math.max(0, 1 - bl.t / 0.6);
      if (la <= 0) continue;
      g = overlay.createRadialGradient(bx, by, 0, bx, by, 300 * zoom);
      g.addColorStop(0, `rgba(0,0,0,${la})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      overlay.fillStyle = g;
      overlay.fillRect(bx - 300 * zoom, by - 300 * zoom, 600 * zoom, 600 * zoom);
    }
    // бочки чуть светятся
    for (const b of this.barrels) {
      if (!b.alive) continue;
      const [bx, by] = w2s(b.x, b.y);
      if (bx < -40 || by < -40 || bx > VIEW_W + 40 || by > VIEW_H + 40) continue;
      g = overlay.createRadialGradient(bx, by, 0, bx, by, 36 * zoom);
      g.addColorStop(0, "rgba(0,0,0,0.6)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      overlay.fillStyle = g;
      overlay.fillRect(bx - 36 * zoom, by - 36 * zoom, 72 * zoom, 72 * zoom);
    }
    overlay.globalCompositeOperation = "source-over";

    // Warm falloff is rendered after the cut-out so the flashlight is visible as light, never as a black cone.
    overlay.globalCompositeOperation = "screen";
    const warm = overlay.createRadialGradient(px, py, 0, px, py, 180 * zoom);
    warm.addColorStop(0, "rgba(255,236,180,0.14)");
    warm.addColorStop(0.48, "rgba(229,202,128,0.045)");
    warm.addColorStop(1, "rgba(229,202,128,0)");
    overlay.fillStyle = warm;
    overlay.beginPath();
    overlay.arc(px, py, 180 * zoom, 0, Math.PI * 2);
    overlay.fill();
    overlay.globalCompositeOperation = "source-over";
    overlay.restore();
    ctx.drawImage(this.light, 0, 0);
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D) {
    const { mouseX: mx, mouseY: my } = this.input;
    const aiming = this.input.aim && !this.ended;
    const gap = Math.round(6 + this.bloom * 65 * (aiming ? 0.45 : 1.25) + this.gunKick * 0.9);
    // Рваный коричневый прицел «выжившего»; в прицеле — холодный и собранный
    ctx.strokeStyle = aiming ? "rgba(184, 211, 106, 0.95)" : "rgba(185, 118, 74, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, gap + 3, 0, Math.PI * 2);
    ctx.stroke();
    // 4 щели
    ctx.beginPath();
    ctx.moveTo(mx - gap - 9, my); ctx.lineTo(mx - gap - 3, my);
    ctx.moveTo(mx + gap + 3, my); ctx.lineTo(mx + gap + 9, my);
    ctx.moveTo(mx, my - gap - 9); ctx.lineTo(mx, my - gap - 3);
    ctx.moveTo(mx, my + gap + 3); ctx.lineTo(mx, my + gap + 9);
    ctx.stroke();
    ctx.fillStyle = "#e8e2d0";
    ctx.fillRect(mx - 1, my - 1, 2, 2);

    // маркер попадания
    if (this.hitMarkerT > 0) {
      ctx.strokeStyle = this.hitMarkerColor;
      ctx.lineWidth = 2.2;
      const hm = 5;
      ctx.beginPath();
      ctx.moveTo(mx - hm - 4, my - hm - 4); ctx.lineTo(mx - 2, my - 2);
      ctx.moveTo(mx + hm + 4, my - hm - 4); ctx.lineTo(mx + 2, my - 2);
      ctx.moveTo(mx - hm - 4, my + hm + 4); ctx.lineTo(mx - 2, my + 2);
      ctx.moveTo(mx + hm + 4, my + hm + 4); ctx.lineTo(mx + 2, my + 2);
      ctx.stroke();
    }
    if (this.reloadT > 0) {
      ctx.strokeStyle = "#b8d36a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, my, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.reloadT / this.reloadMax));
      ctx.stroke();
    }
  }
}