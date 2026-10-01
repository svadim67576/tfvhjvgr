// ============================================================
// OUTBREAK — типы данных (TypeScript-зеркало GDScript-ресурсов)
// ============================================================

/** Экраны-навигация игры */
export type Screen =
  | "menu"
  | "hub"
  | "building"
  | "worldmap"
  | "weapons"
  | "equipment"
  | "inventory"
  | "settings"
  | "skills"
  | "level"
  | "files";

export type WeaponKind =
  | "Пистолет"
  | "Дробовик помповый"
  | "Дробовик"
  | "Пистолет-пулемёт"
  | "Автомат"
  | "Снайперская винтовка"
  | "Пулемёт"
  | "Холодное оружие";

export interface Weapon {
  id: string;
  name: string;
  kind: WeaponKind;
  tier: number;
  /** урон одной пули/дроби */
  damage: number;
  /** количество дробин/пуль за выстрел (дробовики) */
  pellets: number;
  /** выстрелов в минуту */
  rpm: number;
  /** патронов в магазине */
  magSize: number;
  /** секунд на перезарядку */
  reloadTime: number;
  /** дальность в пикселях (32 px = 1 тайл) */
  range: number;
  /** штраф/бонус к скорости передвижения владельца, % */
  moveSpeedMod: number;
  spread: "низкий" | "средний" | "высокий";
  /** сколько целей пробивает пуля (по умолчанию 1) */
  pierce?: number;
  price: number;
  color: string;
  note: string;
}

export type EquipmentSlot = "head" | "torso" | "gloves" | "boots" | "accessory";
export type WeaponSlot = "sidearm" | "primary";
export type BuildingId = "hq" | "weapons" | "equipment" | "inventory" | "radio";

export interface EquipmentMods {
  maxHp?: number;
  armor?: number;
  speedPct?: number;
  damagePct?: number;
  fireRatePct?: number;
  currencyPct?: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  tier: number;
  mods: EquipmentMods;
  price: number;
  color: string;
  note: string;
}

export interface Stats {
  maxHp: number;
  armor: number;
  speed: number;
  damagePct: number;
  fireRatePct: number;
  currencyPct: number;
}

export interface LevelDef {
  id: string;
  num: number;
  name: string;
  zone: string;
  icon: string;
  description: string;
  waves: number;
  boss: string | null;
  /** Лимиты времени: 3 звезды и 2 звезды, секунды; одна звезда за прохождение */
  goldTime: number;
  silverTime: number;
  /** металлолом за прохождение (1 звезда) */
  reward: number;
  /** надбавка за каждую дополнительную звезду */
  starBonus: number;
  danger: number;
  /** рекомендованный DPS отряда для 3 звёзд */
  recommendedDps: number;
  /** координаты узла на карте (viewBox 1480x780) */
  mapX: number;
  mapY: number;
  /** индекс предыдущего уровня в цепочке */
  unlockAfter: string | null;
}

export interface LevelProgress {
  unlocked: boolean;
  cleared: boolean;
  stars: number;
  bestKills: number;
  bestTime?: number;
}

export type CombatHintKey = "move" | "shoot" | "reload" | "roll" | "loot" | "swap";

export interface TutorialState {
  hubTour: "unseen" | "seen" | "skipped";
  combat: Record<CombatHintKey, boolean>;
  combatSkipped: boolean;
}

export interface Settings {
  sfx: number;
  music: number;
  /** Отдельная громкость мрачной музыки главного меню. */
  menuMusic: number;
  mouseSensitivity: number;
  graphicsQuality: "low" | "medium" | "high";
  particleQuality: "off" | "low" | "high";
  screenShake: boolean;
  damageNumbers: boolean;
  showFps: boolean;
}

export interface SaveData {
  version: number;
  slot: string;
  currency: number;
  ownedWeapons: string[];
  equippedWeapon: string | null;
  weaponSlots: Record<WeaponSlot, string | null>;
  activeWeaponSlot: WeaponSlot;
  grenades: number;
  /** Запас патронов на складе по id оружия. В рейд берётся из этого запаса. */
  ammo: Record<string, number>;
  ownedEquipment: string[];
  equipped: Record<EquipmentSlot, string | null>;
  levels: Record<string, LevelProgress>;
  totalKills: number;
  totalDeaths: number;
  runsPlayed: number;
  settings: Settings;
  tutorial: TutorialState;
  /** Свободные очки навыков. */
  skillPoints: number;
  /** Уровни навыков по id. */
  skills: Record<string, number>;
  createdAt: string;
}
