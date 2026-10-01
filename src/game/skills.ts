import type { Stats } from "./types";

export type SkillId =
  | "run_speed"
  | "aim_speed"
  | "steady_aim"
  | "roll_flow"
  | "roll_cd"
  | "fast_hands"
  | "vitality"
  | "stamina"
  | "ammo_hoarder"
  | "trader"
  | "scavenger";

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  branch: "Бой" | "Тело" | "Снабжение";
  maxLevel: number;
  /** Цена каждого уровня в очках навыков. */
  costs: number[];
  requires?: { id: SkillId; level: number };
  /** Короткое описание эффекта одного уровня. */
  perLevel: string;
}

/** Цепочки: aim требует бега, разброс — прицеливания, кувырки — бега и друг друга и т.д. */
export const SKILLS: SkillDef[] = [
  { id: "run_speed", name: "Скорость бега", icon: "🏃", branch: "Бой", maxLevel: 5, costs: [1, 1, 2, 2, 3], perLevel: "+4% к скорости движения" },
  { id: "aim_speed", name: "Скорость прицеливания", icon: "🎯", branch: "Бой", maxLevel: 4, costs: [1, 2, 2, 3], requires: { id: "run_speed", level: 2 }, perLevel: "+8% к скорости доводки" },
  { id: "steady_aim", name: "Твёрдая рука", icon: "🤏", branch: "Бой", maxLevel: 5, costs: [1, 2, 2, 3, 3], requires: { id: "aim_speed", level: 2 }, perLevel: "−7% разброса" },
  { id: "roll_flow", name: "Кувырок: рывок", icon: "🤸", branch: "Бой", maxLevel: 4, costs: [1, 2, 2, 3], requires: { id: "run_speed", level: 2 }, perLevel: "+7% дальности и +6% времени кувырка" },
  { id: "roll_cd", name: "Кувырок: восстановление", icon: "⏱", branch: "Бой", maxLevel: 4, costs: [1, 1, 2, 3], requires: { id: "roll_flow", level: 2 }, perLevel: "−9% кулдауна кувырка" },
  { id: "fast_hands", name: "Быстрые руки", icon: "🧤", branch: "Бой", maxLevel: 5, costs: [1, 1, 2, 2, 3], requires: { id: "steady_aim", level: 1 }, perLevel: "−7% времени перезарядки" },
  { id: "vitality", name: "Закалка", icon: "❤", branch: "Тело", maxLevel: 5, costs: [1, 2, 2, 3, 3], perLevel: "+12 макс. здоровья" },
  { id: "stamina", name: "Второе дыхание", icon: "🫁", branch: "Тело", maxLevel: 5, costs: [1, 1, 2, 3, 3], requires: { id: "vitality", level: 2 }, perLevel: "+10% восстановления и −6% расхода выносливости" },
  { id: "ammo_hoarder", name: "Запасливость", icon: "📦", branch: "Снабжение", maxLevel: 4, costs: [1, 2, 2, 3], perLevel: "+15% патронов в пачке" },
  { id: "trader", name: "Свой человек", icon: "🤝", branch: "Снабжение", maxLevel: 4, costs: [2, 2, 3, 3], requires: { id: "ammo_hoarder", level: 2 }, perLevel: "−7% цен у торговцев" },
  { id: "scavenger", name: "Мародёр", icon: "⚙", branch: "Снабжение", maxLevel: 5, costs: [1, 2, 2, 3, 3], requires: { id: "trader", level: 1 }, perLevel: "+8% лома за рейд" },
];

export const skillById = (id: string): SkillDef | null => SKILLS.find((s) => s.id === id) ?? null;

export const skillLevel = (skills: Record<string, number> | undefined, id: SkillId): number => {
  const v = Math.floor(Number(skills?.[id] ?? 0));
  const def = skillById(id);
  return Math.max(0, Math.min(def?.maxLevel ?? 0, Number.isFinite(v) ? v : 0));
};

export function normalizeSkills(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (value && typeof value === "object") {
    for (const def of SKILLS) {
      const v = Math.floor(Number((value as Record<string, unknown>)[def.id] ?? 0));
      if (Number.isFinite(v) && v > 0) out[def.id] = Math.min(def.maxLevel, v);
    }
  }
  return out;
}

export function skillUnlocked(skills: Record<string, number>, def: SkillDef): { open: boolean; need?: string } {
  if (!def.requires) return { open: true };
  const have = skillLevel(skills, def.requires.id);
  if (have >= def.requires.level) return { open: true };
  const req = skillById(def.requires.id);
  return { open: false, need: `Нужен навык «${req?.name ?? def.requires.id}» ${def.requires.level} ур.` };
}

/** Множители боя, которые движок забирает из сейва. */
export interface CombatSkillMods {
  spreadMul: number;
  turnMul: number;
  reloadMul: number;
  rollPeakMul: number;
  rollTimeMul: number;
  rollCdMul: number;
  staminaRegenMul: number;
  staminaCostMul: number;
}

export const NEUTRAL_MODS: CombatSkillMods = {
  spreadMul: 1, turnMul: 1, reloadMul: 1, rollPeakMul: 1,
  rollTimeMul: 1, rollCdMul: 1, staminaRegenMul: 1, staminaCostMul: 1,
};

export function combatMods(skills: Record<string, number> | undefined): CombatSkillMods {
  const lv = (id: SkillId) => skillLevel(skills, id);
  return {
    spreadMul: Math.pow(0.93, lv("steady_aim")),
    turnMul: 1 + 0.08 * lv("aim_speed"),
    reloadMul: Math.pow(0.93, lv("fast_hands")),
    rollPeakMul: 1 + 0.07 * lv("roll_flow"),
    rollTimeMul: 1 + 0.06 * lv("roll_flow"),
    rollCdMul: Math.pow(0.91, lv("roll_cd")),
    staminaRegenMul: 1 + 0.1 * lv("stamina"),
    staminaCostMul: Math.pow(0.94, lv("stamina")),
  };
}

/** Бонусы к характеристикам поверх экипировки. */
export function applySkillStats(base: Stats, skills: Record<string, number> | undefined): Stats {
  const lv = (id: SkillId) => skillLevel(skills, id);
  return {
    ...base,
    maxHp: base.maxHp + 12 * lv("vitality"),
    speed: Math.round(base.speed * (1 + 0.04 * lv("run_speed"))),
    currencyPct: base.currencyPct + 8 * lv("scavenger"),
  };
}

/** Цена со скидкой торговца. Округляем вверх, минимум 1. */
export function discountedPrice(base: number, skills: Record<string, number> | undefined): number {
  const cut = Math.min(0.5, 0.07 * skillLevel(skills, "trader"));
  return Math.max(1, Math.ceil(base * (1 - cut)));
}

/** Сколько патронов реально даёт пачка с учётом запасливости. */
export function ammoPackYield(baseSize: number, skills: Record<string, number> | undefined): number {
  return Math.round(baseSize * (1 + 0.15 * skillLevel(skills, "ammo_hoarder")));
}

/** Очки навыков за рейд. Победа ценится выше, повторы без прогресса — вдвое меньше. */
export function skillPointsForRaid(args: {
  victory: boolean;
  stars: number;
  kills: number;
  improved: boolean;
}): { points: number; lines: string[] } {
  const { victory, stars, kills } = args;
  const lines: string[] = [];
  let points = 0;
  if (victory) {
    const clamped = Math.max(1, Math.min(3, stars));
    points += 3;
    lines.push("Зачистка района: +3");
    points += clamped;
    lines.push(`Звёзды ${clamped}★: +${clamped}`);
    const bonus = Math.min(2, Math.floor(kills / 20));
    if (bonus > 0) {
      points += bonus;
      lines.push(`Убийства (${kills}): +${bonus}`);
    }
  } else {
    const bonus = kills >= 40 ? 2 : kills >= 15 ? 1 : 0;
    points += bonus;
    if (bonus > 0) lines.push(`Убийства (${kills}): +${bonus}`);
  }
  if (!args.improved && points > 0) {
    points = Math.max(victory ? 1 : 0, Math.round(points / 2));
    lines.push("Повтор без улучшения: ÷2");
  }
  return { points, lines };
}
