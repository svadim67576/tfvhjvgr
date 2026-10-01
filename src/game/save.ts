import { useSyncExternalStore } from "react";
import { profileSaveKey } from "./profiles";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";
import {
  ammoPackYield,
  applySkillStats,
  discountedPrice,
  normalizeSkills,
  skillById,
  skillLevel,
  skillPointsForRaid,
} from "./skills";
import {
  AMMO_PACK_SIZE,
  BASE_STATS,
  EQUIPMENT_SLOTS,
  LEVELS,
  STARTING_WEAPON,
  WEAPONS,
  ammoPackPrice,
  canCarryTwoWeapons,
  computeStats,
  equipmentById,
  grenadeCapacity,
  isSidearm,
  levelReward,
  weaponById,
} from "./data";
import type {
  CombatHintKey,
  LevelProgress,
  SaveData,
  Settings,
  Stats,
  TutorialState,
  WeaponSlot,
} from "./types";

// ============================================================
// Сохранение прогресса в localStorage (ключ outbreak_save_v1)
// ============================================================
const STORAGE_KEY = "outbreak_save_v1";
const SAVE_VERSION = 3;
export const GRENADE_PRICE = 160;

const defaultLevels = (): Record<string, LevelProgress> => {
  const out: Record<string, LevelProgress> = {};
  LEVELS.forEach((l) => {
    out[l.id] = { unlocked: l.unlockAfter === null, cleared: false, stars: 0, bestKills: 0 };
  });
  return out;
};

const defaultSettings = (): Settings => ({ ...DEFAULT_SETTINGS });

export const defaultTutorial = (): TutorialState => ({
  hubTour: "unseen",
  combat: { move: false, shoot: false, reload: false, roll: false, loot: false, swap: false },
  combatSkipped: false,
});

export const createDefaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  slot: "slot_1",
  currency: 750,
  ownedWeapons: [STARTING_WEAPON],
  equippedWeapon: STARTING_WEAPON,
  weaponSlots: { sidearm: STARTING_WEAPON, primary: null },
  activeWeaponSlot: "sidearm",
  grenades: 2,
  ammo: { [STARTING_WEAPON]: 120 },
  ownedEquipment: [],
  equipped: { head: null, torso: null, gloves: null, boots: null, accessory: null },
  levels: defaultLevels(),
  totalKills: 0,
  totalDeaths: 0,
  runsPlayed: 0,
  settings: defaultSettings(),
  tutorial: defaultTutorial(),
  skillPoints: 0,
  skills: {},
  createdAt: new Date().toISOString(),
});

function loadFromStorage(key: string): SaveData {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return createDefaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = createDefaultSave();
    const ownedWeapons = Array.isArray(parsed.ownedWeapons)
      ? Array.from(new Set([STARTING_WEAPON, ...parsed.ownedWeapons.filter((id) => !!weaponById(id))]))
      : base.ownedWeapons;
    const oldActive = weaponById(parsed.equippedWeapon ?? null);
    const slots = parsed.weaponSlots ?? {
      sidearm: oldActive && isSidearm(oldActive) ? oldActive.id : STARTING_WEAPON,
      primary: oldActive && !isSidearm(oldActive) ? oldActive.id : null,
    };
    const sidearm =
      slots.sidearm && ownedWeapons.includes(slots.sidearm) && isSidearm(weaponById(slots.sidearm)!)
        ? slots.sidearm
        : STARTING_WEAPON;
    const primary =
      slots.primary && ownedWeapons.includes(slots.primary) && !isSidearm(weaponById(slots.primary)!)
        ? slots.primary
        : null;
    const activeWeaponSlot: WeaponSlot =
      (parsed.activeWeaponSlot === "primary" ||
        (!parsed.weaponSlots && primary && oldActive?.id === primary)) &&
      primary
        ? "primary"
        : "sidearm";
    const levels = { ...base.levels, ...(parsed.levels ?? {}) };
    // Сохраняем старые звёзды; открываем следующий район, если предыдущий уже пройден.
    for (const level of LEVELS) {
      if (level.unlockAfter && levels[level.unlockAfter]?.cleared) {
        levels[level.id] = { ...levels[level.id], unlocked: true };
      }
    }
    // Миграция: у старых сейвов патронов не было — выдаём стартовый запас,
    // чтобы купленные стволы не остались пустыми.
    const ammo: Record<string, number> = { ...(parsed.ammo ?? {}) };
    for (const id of ownedWeapons) {
      const cur = Math.max(0, Math.floor(Number(ammo[id] ?? 0) || 0));
      ammo[id] = parsed.ammo ? cur : id === STARTING_WEAPON ? 120 : 60;
    }
    // Миграция обучения: ветеранам не показываем тур заново.
    const veteran =
      (parsed.runsPlayed ?? 0) > 0 ||
      Object.values(levels).some((l) => l.cleared) ||
      ownedWeapons.length > 1;
    const pt = parsed.tutorial;
    const tutorial: TutorialState = {
      hubTour:
        pt?.hubTour === "seen" || pt?.hubTour === "skipped"
          ? pt.hubTour
          : veteran
            ? "seen"
            : "unseen",
      combat: { ...defaultTutorial().combat, ...(pt?.combat ?? {}) },
      combatSkipped: pt?.combatSkipped ?? veteran,
    };
    // Миграция v2 → v3: навыки и очки. Старые сохранения не сбрасываются,
    // ветераны получают стартовые очки за уже пройденные районы.
    const skills = normalizeSkills(parsed.skills);
    let skillPoints = Math.max(0, Math.floor(Number(parsed.skillPoints ?? 0) || 0));
    const fromVersion = Math.floor(Number(parsed.version ?? 0) || 0);
    if (fromVersion < 3 && parsed.levels && skillPoints === 0 && Object.keys(skills).length === 0) {
      const cleared = Object.values(levels).filter((l) => l.cleared).length;
      skillPoints = Math.min(12, cleared * 2);
    }
    return {
      ...base,
      ...parsed,
      version: SAVE_VERSION,
      ownedWeapons,
      weaponSlots: { sidearm, primary },
      activeWeaponSlot,
      equippedWeapon: activeWeaponSlot === "primary" ? primary : sidearm,
      grenades: Math.max(0, Math.min(10, Math.floor(Number(parsed.grenades ?? base.grenades) || 0))),
      ammo,
      levels,
      equipped: { ...base.equipped, ...(parsed.equipped ?? {}) },
      settings: normalizeSettings(parsed.settings),
      tutorial,
      skillPoints,
      skills,
    };
  } catch {
    return createDefaultSave();
  }
}

type Listener = () => void;

class GameStore {
  private state: SaveData = createDefaultSave();
  private listeners = new Set<Listener>();
  private storageKey: string | null = null;
  storageError: string | null = null;
  lastSavedAt: string | null = null;

  init() {
    this.state = this.storageKey ? loadFromStorage(this.storageKey) : createDefaultSave();
    this.persist();
    this.emit();
  }

  activateProfile(id: string, migrateLegacy = false) {
    this.storageKey = profileSaveKey(id);
    this.storageError = null;
    try {
      if (migrateLegacy && !localStorage.getItem("outbreak_legacy_claimed") && !localStorage.getItem(this.storageKey)) {
        const legacy = localStorage.getItem(STORAGE_KEY);
        if (legacy) {
          localStorage.setItem(this.storageKey, legacy);
          localStorage.setItem("outbreak_legacy_claimed", id);
        }
      }
    } catch { this.storageError = "Хранилище недоступно. Скачайте резервную копию профиля."; }
    this.init();
  }

  deactivateProfile() {
    this.persist();
    this.storageKey = null;
    this.state = createDefaultSave();
    this.emit();
  }

  getSnapshot = (): SaveData => this.state;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private persist() {
    if (!this.storageKey) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      this.lastSavedAt = new Date().toLocaleTimeString("ru-RU");
      this.storageError = null;
    } catch {
      this.storageError = "Не удалось сохранить прогресс. Скачайте резервную копию в разделе «Файлы».";
    }
  }

  private set(patch: Partial<SaveData>, saveNow = true) {
    this.state = { ...this.state, ...patch };
    if (saveNow) this.persist();
    this.emit();
  }

  // ---------- CurrencyManager ----------
  addCurrency(amount: number) {
    this.set({ currency: Math.max(0, this.state.currency + Math.round(amount)) });
  }

  spendCurrency(amount: number): boolean {
    if (this.state.currency < amount) return false;
    this.set({ currency: this.state.currency - amount });
    return true;
  }

  // ---------- Оружие ----------
  /** Цена с учётом навыка торговца. Единая точка для покупки и отображения. */
  priceFor(base: number): number {
    return discountedPrice(base, this.state.skills);
  }

  buyWeapon(id: string): boolean {
    const weapon = weaponById(id);
    if (!weapon || this.state.ownedWeapons.includes(id)) return false;
    if (!this.spendCurrency(this.priceFor(weapon.price))) return false;
    const ammo = { ...this.state.ammo };
    if (weapon.magSize > 0) ammo[id] = Math.max(ammo[id] ?? 0, weapon.magSize * 2);
    this.set({ ownedWeapons: [...this.state.ownedWeapons, id], ammo });
    return true;
  }

  ammoOf(id: string): number {
    return Math.max(0, Math.floor(this.state.ammo[id] ?? 0));
  }

  buyAmmo(id: string): boolean {
    const weapon = weaponById(id);
    if (!weapon || weapon.magSize === 0) return false;
    const price = this.priceFor(ammoPackPrice(weapon));
    if (!this.spendCurrency(price)) return false;
    this.set({ ammo: { ...this.state.ammo, [id]: this.ammoOf(id) + ammoPackYield(AMMO_PACK_SIZE, this.state.skills) } });
    return true;
  }

  /** Забрать патроны со склада в рейд. Возвращает сколько реально взято. */
  takeAmmo(id: string, want: number): number {
    const have = this.ammoOf(id);
    const take = Math.max(0, Math.min(have, Math.floor(want)));
    if (take > 0) this.set({ ammo: { ...this.state.ammo, [id]: have - take } });
    return take;
  }

  /** Вернуть неизрасходованные патроны на склад (конец рейда, рестарт, выход). */
  refundAmmo(id: string, amount: number) {
    const n = Math.max(0, Math.floor(amount));
    if (!weaponById(id) || n <= 0) return;
    this.set({ ammo: { ...this.state.ammo, [id]: this.ammoOf(id) + n } });
  }

  equipWeapon(id: string): boolean {
    const weapon = weaponById(id);
    if (!weapon || !this.state.ownedWeapons.includes(id)) return false;
    const slot: WeaponSlot = isSidearm(weapon) ? "sidearm" : "primary";
    this.set({
      weaponSlots: { ...this.state.weaponSlots, [slot]: id },
      activeWeaponSlot: slot,
      equippedWeapon: id,
    });
    return true;
  }

  selectWeaponSlot(slot: WeaponSlot): boolean {
    const id = this.state.weaponSlots[slot];
    if (!id || (slot !== this.state.activeWeaponSlot && !canCarryTwoWeapons(this.state.equipped.accessory)))
      return false;
    this.set({ activeWeaponSlot: slot, equippedWeapon: id });
    return true;
  }

  // ---------- InventoryManager / экипировка ----------
  buyEquipment(id: string): boolean {
    const item = equipmentById(id);
    if (!item || this.state.ownedEquipment.includes(id)) return false;
    if (!this.spendCurrency(this.priceFor(item.price))) return false;
    this.set({ ownedEquipment: [...this.state.ownedEquipment, id] });
    return true;
  }

  equipItem(id: string): boolean {
    const item = equipmentById(id);
    if (!item || !this.state.ownedEquipment.includes(id)) return false;
    this.set({ equipped: { ...this.state.equipped, [item.slot]: id } });
    return true;
  }

  unequipSlot(slot: string) {
    this.set({ equipped: { ...this.state.equipped, [slot]: null } });
  }

  // ---------- Гранаты ----------
  buyGrenades(): boolean {
    const capacity = grenadeCapacity(this.state.equipped.accessory);
    const price = this.priceFor(GRENADE_PRICE);
    if (this.state.grenades >= capacity || this.state.currency < price) return false;
    if (!this.spendCurrency(price)) return false;
    this.set({ grenades: this.state.grenades + 1 });
    return true;
  }

  /** Покупка уровня навыка за очки. Проверяет цепочку prerequisites. */
  buySkill(id: string): boolean {
    const def = skillById(id);
    if (!def) return false;
    const level = skillLevel(this.state.skills, def.id);
    if (level >= def.maxLevel) return false;
    if (def.requires && skillLevel(this.state.skills, def.requires.id) < def.requires.level) return false;
    const cost = def.costs[level] ?? 1;
    if (this.state.skillPoints < cost) return false;
    this.set({
      skillPoints: this.state.skillPoints - cost,
      skills: { ...this.state.skills, [def.id]: level + 1 },
    });
    return true;
  }

  addGrenades(n: number): number {
    const capacity = grenadeCapacity(this.state.equipped.accessory);
    const added = Math.max(0, Math.min(n, capacity - this.state.grenades));
    if (added > 0) this.set({ grenades: this.state.grenades + added });
    return added;
  }

  useGrenade(): boolean {
    if (this.state.grenades <= 0) return false;
    this.set({ grenades: this.state.grenades - 1 });
    return true;
  }

  // ---------- Прогресс уровней ----------
  /** Разбор последнего начисления очков — для экрана итогов. */
  lastSkillAward: { points: number; lines: string[] } | null = null;

  completeLevel(levelId: string, stars: number, kills: number, seconds = 0): number {
    const lvl = LEVELS.find((l) => l.id === levelId);
    if (!lvl) return 0;
    const clamped = Math.max(1, Math.min(3, stars));
    const stats = applySkillStats(computeStats(Object.values(this.state.equipped)), this.state.skills);
    const levels = { ...this.state.levels };
    const prev = levels[levelId];
    // Повтор без улучшения результата даёт половину награды (защита от фарма)
    const improved = !prev?.cleared || clamped > (prev?.stars ?? 0);
    const fullReward = levelReward(lvl, clamped, stats.currencyPct);
    const reward = improved ? fullReward : Math.round(fullReward * 0.5);
    levels[levelId] = {
      unlocked: true,
      cleared: true,
      stars: Math.max(prev?.stars ?? 0, clamped),
      bestKills: Math.max(prev?.bestKills ?? 0, kills),
      bestTime: seconds > 0 ? Math.min(prev?.bestTime || Infinity, seconds) : prev?.bestTime,
    };
    // Открываем следующий уровень в цепочке
    const next = LEVELS.find((l) => l.unlockAfter === levelId);
    if (next) levels[next.id] = { ...levels[next.id], unlocked: true };
    const award = skillPointsForRaid({ victory: true, stars: clamped, kills, improved });
    this.lastSkillAward = award;
    this.state = {
      ...this.state,
      levels,
      currency: this.state.currency + reward,
      skillPoints: this.state.skillPoints + award.points,
      totalKills: this.state.totalKills + kills,
      runsPlayed: this.state.runsPlayed + 1,
    };
    this.persist();
    this.emit();
    return reward;
  }

  recordDeath(kills = 0) {
    const award = skillPointsForRaid({ victory: false, stars: 0, kills, improved: true });
    this.lastSkillAward = award.points > 0 ? award : null;
    this.set({
      totalDeaths: this.state.totalDeaths + 1,
      totalKills: this.state.totalKills + kills,
      runsPlayed: this.state.runsPlayed + 1,
      skillPoints: this.state.skillPoints + award.points,
    });
  }

  saveNow() {
    this.persist();
    this.emit();
  }

  hasProgress(): boolean {
    const s = this.state;
    return (
      s.runsPlayed > 0 ||
      s.ownedWeapons.length > 1 ||
      s.ownedEquipment.length > 0 ||
      s.currency !== 750 ||
      s.grenades !== 2 ||
      s.skillPoints > 0 ||
      Object.values(s.skills).some((l) => l > 0) ||
      Object.values(s.levels).some((level) => level.cleared)
    );
  }

  // ---------- GameManager ----------
  updateSettings(patch: Partial<Settings>) {
    this.set({ settings: normalizeSettings({ ...this.state.settings, ...patch }) });
  }

  resetSave() {
    // Обучение привязано к аккаунту: новая кампания его не сбрасывает.
    const tutorial = this.state.tutorial;
    this.state = { ...createDefaultSave(), tutorial };
    this.persist();
    this.emit();
  }

  // ---------- Обучение ----------
  completeHubTour(skipped = false) {
    this.set({ tutorial: { ...this.state.tutorial, hubTour: skipped ? "skipped" : "seen" } });
  }

  completeCombatHint(key: CombatHintKey) {
    if (this.state.tutorial.combat[key]) return;
    this.set({ tutorial: { ...this.state.tutorial, combat: { ...this.state.tutorial.combat, [key]: true } } });
  }

  skipCombatTutorial() {
    this.set({ tutorial: { ...this.state.tutorial, combatSkipped: true } });
  }

  /** Экспорт сохранения в JSON-строку (для скачивания файла). */
  exportSave(): string {
    return JSON.stringify(this.state);
  }

  /** Импорт сохранения из JSON-строки. Возвращает false при битом файле. */
  importSave(json: string): boolean {
    if (!this.storageKey) return false;
    try {
      const parsed = JSON.parse(json) as Partial<SaveData>;
      if (!parsed || typeof parsed !== "object") return false;
      if (typeof parsed.currency !== "number" || !parsed.levels || typeof parsed.levels !== "object") return false;
      if (!Array.isArray(parsed.ownedWeapons) || !parsed.equipped) return false;
      localStorage.setItem(this.storageKey, JSON.stringify(parsed));
      this.init(); // перечитываем с миграцией и валидацией
      return true;
    } catch {
      return false;
    }
  }

  grantDebugCurrency(amount = 500) {
    this.addCurrency(amount);
  }
}

export const store = new GameStore();

// ---------- Селекторы (то, что в Godot делают autoload'ы) ----------
export function useSave(): SaveData {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useStats(): Stats {
  const save = useSave();
  return applySkillStats(computeStats(Object.values(save.equipped)), save.skills);
}

export function useEquippedWeapon() {
  const save = useSave();
  return weaponById(save.equippedWeapon);
}

export const allWeapons = WEAPONS;
export const slotMeta = EQUIPMENT_SLOTS;
export const baseStats = BASE_STATS;
