import type { EquipmentItem, EquipmentSlot, LevelDef, Stats, Weapon } from "./types";

// ============================================================
// БАЗОВЫЕ ХАРАКТЕРИСТИКИ ИГРОКА (EquipmentManager пересчитывает всегда)
// ============================================================
export const BASE_STATS: Stats = {
  maxHp: 100,
  armor: 0,
  speed: 150,
  damagePct: 100,
  fireRatePct: 100,
  currencyPct: 100,
};

export const EQUIPMENT_SLOTS: { id: EquipmentSlot; label: string; icon: string }[] = [
  { id: "head", label: "Головной убор", icon: "🧢" },
  { id: "torso", label: "Верхняя одежда", icon: "🧥" },
  { id: "gloves", label: "Перчатки", icon: "🧤" },
  { id: "boots", label: "Обувь", icon: "🥾" },
  { id: "accessory", label: "Аксессуар", icon: "🎒" },
];

export const STARTING_WEAPON = "w_pm17";

// ============================================================
// ОРУЖИЕ — магазин оружия, редкость = tier 1..4. 32 px = 1 тайл.
// ============================================================
export const WEAPONS: Weapon[] = [
  { id: "w_pm17", name: "Ржавый ПМ-17", kind: "Пистолет", tier: 1, damage: 12, pellets: 1, rpm: 180, magSize: 12, reloadTime: 1.4, range: 300, moveSpeedMod: 0, spread: "средний", price: 0, color: "#7d8b88", note: "Стартовый пистолет. Найден в бардачке патрульной машины. Никогда не бросает — почти." },
  { id: "w_obrez", name: 'Обрез «Сурок»', kind: "Дробовик помповый", tier: 1, damage: 9, pellets: 6, rpm: 55, magSize: 2, reloadTime: 2.2, range: 170, moveSpeedMod: 0, spread: "высокий", price: 350, color: "#8a6a45", note: "Дешёвый и злой. В упор снимает голову, дальше 4 тайлов — почти безвреден." },
  { id: "w_magnum", name: "Револьвер «Магнум-45»", kind: "Пистолет", tier: 2, damage: 44, pellets: 1, rpm: 95, magSize: 6, reloadTime: 2.6, range: 430, moveSpeedMod: 0, spread: "низкий", pierce: 2, price: 750, color: "#b98c3a", note: "Пробивает двух зомби на линии. Промах стоит дорого: всего 6 патронов." },
  { id: "w_remington", name: "Дробовик «Ремингтон-870»", kind: "Дробовик помповый", tier: 2, damage: 10, pellets: 8, rpm: 65, magSize: 7, reloadTime: 3.0, range: 210, moveSpeedMod: -3, spread: "высокий", price: 1400, color: "#9c6b3f", note: "Рабочая лошадка выжившего. Зачищает коридоры больницы и склада." },
  { id: "w_vihr", name: "ПП «Вихрь-9»", kind: "Пистолет-пулемёт", tier: 2, damage: 14, pellets: 1, rpm: 620, magSize: 30, reloadTime: 1.7, range: 340, moveSpeedMod: 2, spread: "средний", price: 1900, color: "#5f8f8a", note: "Мобильность и плотность огня. Идеален против стай «бегунов»." },
  { id: "w_ak74", name: "Автомат «АК-74»", kind: "Автомат", tier: 3, damage: 26, pellets: 1, rpm: 480, magSize: 30, reloadTime: 2.2, range: 520, moveSpeedMod: 0, spread: "средний", price: 3400, color: "#8a7f52", note: "Универсал: дальность, урон, магазин. Первый серьёзный апгрейд игрока." },
  { id: "w_m4karat", name: "Карабин «M4-Карат»", kind: "Автомат", tier: 3, damage: 24, pellets: 1, rpm: 660, magSize: 30, reloadTime: 2.0, range: 560, moveSpeedMod: 0, spread: "низкий", price: 4600, color: "#6e8f5f", note: "Точный и скорострельный. Стабильный DPS для волнового режима." },
  { id: "w_barracuda", name: 'Штурмовой дробовик «Барракуда»', kind: "Дробовик", tier: 3, damage: 12, pellets: 6, rpm: 190, magSize: 8, reloadTime: 3.2, range: 250, moveSpeedMod: -6, spread: "высокий", price: 5600, color: "#b06a52", note: "Оружие для удержания точек: держит поток зомби без перезарядки." },
  { id: "w_svd", name: "Винтовка «СВД-Тайфун»", kind: "Снайперская винтовка", tier: 4, damage: 130, pellets: 1, rpm: 55, magSize: 10, reloadTime: 3.0, range: 900, moveSpeedMod: -5, spread: "низкий", pierce: 3, price: 6800, color: "#4f7fa8", note: "Пробивает 3 цели насквозь. Оружие для элит, «Крикунов» и боссов." },
  { id: "w_mjasorubka", name: 'Пулемёт «Мясорубка»', kind: "Пулемёт", tier: 4, damage: 19, pellets: 1, rpm: 900, magSize: 150, reloadTime: 5.5, range: 480, moveSpeedMod: -12, spread: "средний", price: 9500, color: "#a33d33", note: "150 патронов ярости. Замедляет игрока, но превращает экран в мясной фарш." },
  // ---- Холодное оружие (Melee) ----
  { id: "w_knife_combat", name: "Боевой нож «Штык»", kind: "Холодное оружие", tier: 1, damage: 38, pellets: 1, rpm: 160, magSize: 0, reloadTime: 0, range: 85, moveSpeedMod: 6, spread: "низкий", price: 280, color: "#4e5956", note: "Острый армейский клинок. Не тратит патронов, бесшумный и повышает скорость бега на +6%." },
  { id: "w_machete_stalker", name: "Мачете сталкера", kind: "Холодное оружие", tier: 2, damage: 68, pellets: 1, rpm: 120, magSize: 0, reloadTime: 0, range: 100, moveSpeedMod: 3, spread: "средний", pierce: 2, price: 950, color: "#7a4a35", note: "Широкий рубящий клинок. Задевает до 2 зомби за удар и часто наносит критический урон." },
  { id: "w_axe_fire", name: "Пожарный топор", kind: "Холодное оружие", tier: 3, damage: 110, pellets: 1, rpm: 85, magSize: 0, reloadTime: 0, range: 115, moveSpeedMod: -2, spread: "высокий", pierce: 3, price: 2200, color: "#b03a2e", note: "Тяжёлый топор спасателей. Рассекает до 3 заражённых разом и отбрасывает толпу на шаг назад." },
];

// ============================================================
// ЭКИПИРОВКА — 21+ предмет в 5 категориях
// ============================================================
export const EQUIPMENT: EquipmentItem[] = [
  // ---- Головной убор
  { id: "e_cap", name: "Кепка выжившего", slot: "head", tier: 1, mods: { maxHp: 15, speedPct: 2 }, price: 180, color: "#7d6a4f", note: "Козырёк от солнца и дождя. Немного уверенности — немного здоровья." },
  { id: "e_helmet_build", name: "Каска строителя", slot: "head", tier: 1, mods: { maxHp: 8, armor: 6, speedPct: -2 }, price: 480, color: "#c19235", note: "Дешёвая броня для головы. Первые 6 единиц защиты за малые деньги." },
  { id: "e_ratnik_l", name: "Шлем «Ратник-Л»", slot: "head", tier: 3, mods: { maxHp: 14, armor: 13, damagePct: 3, speedPct: -5 }, price: 1750, color: "#5c6b52", note: "Военный шлем с наушниками. Держит укусы сзади, чуть снижает обзор." },
  { id: "e_gasmask", name: "Противогаз «Туман-3»", slot: "head", tier: 3, mods: { maxHp: 24, armor: 4, currencyPct: 12 }, price: 2600, color: "#6f8f7a", note: "Фильтры снижают токсичный урон и повышают находки лома на 12%." },
  // ---- Верхняя одежда
  { id: "e_jacket", name: "Потёртая куртка", slot: "torso", tier: 1, mods: { maxHp: 28, speedPct: 3 }, price: 220, color: "#6b5c4c", note: "Просто куртка. Но с ней ночи на улице не так страшны." },
  { id: "e_leather", name: "Кожанка байкера", slot: "torso", tier: 2, mods: { maxHp: 18, armor: 5, damagePct: 6 }, price: 820, color: "#54413a", note: "Плотная кожа: укусы скользят, а в крови сильнее азарт (+6% урона)." },
  { id: "e_spas_k", name: 'Бронежилет «Спас-К»', slot: "torso", tier: 3, mods: { maxHp: 42, armor: 21, speedPct: -6 }, price: 2400, color: "#4c5c53", note: "Класс защиты К. -33% входящего урона при броне 21. Тяжёлый." },
  { id: "e_ratnik_t", name: 'Жилет «Ратник-Т»', slot: "torso", tier: 4, mods: { maxHp: 32, armor: 15, fireRatePct: 10, currencyPct: 5 }, price: 4200, color: "#6d7a45", note: "Разгрузочные карманы: быстрее перезарядка, больше лома в карманах." },
  // ---- Перчатки
  { id: "e_gloves_work", name: "Рабочие перчатки", slot: "gloves", tier: 1, mods: { fireRatePct: 3 }, price: 140, color: "#8a7550", note: "Ладонь не скользит по затвору: небольшая прибавка к темпу огня." },
  { id: "e_gloves_leather", name: "Кожаные перчатки", slot: "gloves", tier: 2, mods: { damagePct: 4, fireRatePct: 4 }, price: 520, color: "#7a4f34", note: "Удобный хват на рукояти и цевье." },
  { id: "e_gloves_hvat", name: 'Тактические «Хват»', slot: "gloves", tier: 3, mods: { damagePct: 8, fireRatePct: 10 }, price: 1600, color: "#4f5f66", note: "Профессиональный тактический комплект: +18% суммарной огневой мощи." },
  { id: "e_gloves_saper", name: "Бронеперчатки сапёра", slot: "gloves", tier: 3, mods: { armor: 7, damagePct: 6, fireRatePct: -3 }, price: 2500, color: "#8f8f5e", note: "Тяжёлые, но защищают кисти от укусов и осколков." },
  // ---- Обувь
  { id: "e_boots_run", name: "Стоптанные кроссовки", slot: "boots", tier: 1, mods: { speedPct: 7 }, price: 160, color: "#6a7d86", note: "Тихая подошва: проще уйти от «толпы» на выходе из района." },
  { id: "e_boots_bercy", name: "Берцы «Топот»", slot: "boots", tier: 2, mods: { speedPct: 5, armor: 3 }, price: 540, color: "#5a4a38", note: "Держат голеностоп на обломках асфальта." },
  { id: "e_boots_rys", name: "Ботинки «Рысь»", slot: "boots", tier: 3, mods: { speedPct: 13, armor: 4 }, price: 1500, color: "#3f4d46", note: "Легкие и цепкие: помогают кайтить волну на открытой торговой улице." },
  { id: "e_boots_hazmat", name: "Сапоги химзащиты", slot: "boots", tier: 3, mods: { speedPct: 6, armor: 9, currencyPct: 6 }, price: 2400, color: "#7d8f5a", note: "Можно ходить по токсичным лужам завода и подбирать больше лома." },
  // ---- Аксессуар
  { id: "e_backpack", name: "Вещмешок", slot: "accessory", tier: 1, mods: { currencyPct: 7 }, price: 200, color: "#6f6144", note: "Открывает второй слот оружия: пистолет + основной ствол. +7% к лому." },
  { id: "e_tactical_pack", name: "Тактический рюкзак", slot: "accessory", tier: 2, mods: { maxHp: 15, currencyPct: 10 }, price: 1100, color: "#596d54", note: "Открывает второй слот оружия и вмещает до 6 гранат. +15 HP и +10% к лому." },
  { id: "e_heavy_pack", name: "Рейдовый ранец «Экспедиция»", slot: "accessory", tier: 3, mods: { maxHp: 30, armor: 4, currencyPct: 14 }, price: 2400, color: "#4d5b4a", note: "Тяжёлый экспедиционный рюкзак: вмещает до 8 гранат, 2 слота оружия, +30 HP и +4 к броне." },
  { id: "e_specops_pack", name: "Штурмовой ранец «Спецназ»", slot: "accessory", tier: 4, mods: { maxHp: 45, armor: 8, damagePct: 6, currencyPct: 18 }, price: 4500, color: "#2f3833", note: "Элитный штурмовой ранец: вмещает до 10 гранат, 2 слота оружия, +45 HP, +8 брони и +6% урона." },
  { id: "e_podsumok", name: "Подсумок стрелка", slot: "accessory", tier: 2, mods: { fireRatePct: 12 }, price: 680, color: "#5d6b5a", note: "Быстрая смена магазина и подсумки под патроны." },
  { id: "e_radiomayak", name: "Радиомаяк выжившего", slot: "accessory", tier: 3, mods: { currencyPct: 12, speedPct: 5 }, price: 1300, color: "#8a8a4a", note: "Ловит сигналы схронов города: больше лома за зачистку." },
  { id: "e_medkit", name: "Аптечка на плечо", slot: "accessory", tier: 3, mods: { maxHp: 30, armor: 2 }, price: 1900, color: "#a8452f", note: "Экстренный набор первой помощи всегда под рукой." },
  { id: "e_talisman", name: "Кровавый талисман", slot: "accessory", tier: 4, mods: { damagePct: 11, currencyPct: 8 }, price: 3200, color: "#9c2b2b", note: "Трофей из центра города. Ветераны верят, что он приносит лом и удачу." },
];

// ============================================================
// УРОВНИ — цепочка из 10 локаций
// ============================================================
export const LEVELS: LevelDef[] = [
  { id: "l1", num: 1, name: "Район жилых домов", zone: "Спальный район", icon: "🏚️", description: "Первые улицы после прорыва карантина. Разбитые дворы, брошенные машины, редкие одиночки-«бродяги». Обучающий уровень: знакомим игрока с движением, стрельбой и волнами.", waves: 3, boss: null, goldTime: 129, silverTime: 213, reward: 250, starBonus: 90, danger: 1, recommendedDps: 32, mapX: 165, mapY: 635, unlockAfter: null },
  { id: "l2", num: 2, name: "Торговая улица", zone: "Центр района", icon: "🏬", description: "Разграбленные витрины и узкая улица: зомби выходят с двух сторон. Первое появление «бегунов» — быстрых врагов, требующих кайтинга.", waves: 4, boss: null, goldTime: 174, silverTime: 287, reward: 420, starBonus: 120, danger: 2, recommendedDps: 45, mapX: 355, mapY: 510, unlockAfter: "l1" },
  { id: "l3", num: 3, name: "Супермаркет «Провиант»", zone: "Торгово-складской", icon: "🛒", description: "Замкнутое пространство с узкими проходами между стеллажами. Много лута и много «гнилых»: урон токсином при близком контакте.", waves: 4, boss: null, goldTime: 186, silverTime: 307, reward: 620, starBonus: 160, danger: 3, recommendedDps: 58, mapX: 240, mapY: 355, unlockAfter: "l2" },
  { id: "l4", num: 4, name: "Автозаправочная станция", zone: "Трасса", icon: "⛽", description: "Открытая площадка с бочками. Заманивайте заражённых под взрыв и держите дистанцию от толстяков.", waves: 5, boss: null, goldTime: 240, silverTime: 396, reward: 820, starBonus: 200, danger: 4, recommendedDps: 72, mapX: 495, mapY: 310, unlockAfter: "l3" },
  { id: "l5", num: 5, name: "Городская больница", zone: "Медицинский квартал", icon: "🏥", description: "Больница — первый рубеж с боссом. Санитар-мутант налетает рывком и зовёт заражённых. Заберите припасы из ящиков перед последней волной.", waves: 6, boss: "Санитар-мутант", goldTime: 360, silverTime: 594, reward: 1080, starBonus: 250, danger: 5, recommendedDps: 88, mapX: 695, mapY: 455, unlockAfter: "l4" },
  { id: "l6", num: 6, name: "Складской район", zone: "Промзона", icon: "📦", description: "Огромные ангары, пути для вилочных погрузчиков, теснота между контейнерами. Враги приходят толпами — пригодится автоматический дробовик.", waves: 6, boss: null, goldTime: 312, silverTime: 515, reward: 1380, starBonus: 300, danger: 6, recommendedDps: 108, mapX: 910, mapY: 615, unlockAfter: "l5" },
  { id: "l7", num: 7, name: "Полицейский участок", zone: "Карантинная зона", icon: "🚔", description: "Штурм последнего оплота порядка. Бронированные зомби держат удар, но снайперка и гранаты выравнивают шансы.", waves: 7, boss: null, goldTime: 387, silverTime: 638, reward: 1720, starBonus: 360, danger: 7, recommendedDps: 120, mapX: 1140, mapY: 505, unlockAfter: "l6" },
  { id: "l8", num: 8, name: "Военный блокпост", zone: "Окраина", icon: "🪖", description: "Мешки с песком, БТР и вышки наблюдения. Прорывайтесь сквозь плотные волны, а патроны ищите в ящиках снабжения.", waves: 7, boss: null, goldTime: 408, silverTime: 673, reward: 2150, starBonus: 420, danger: 8, recommendedDps: 138, mapX: 1300, mapY: 335, unlockAfter: "l7" },
  { id: "l9", num: 9, name: "Заброшенный завод", zone: "Промзона №2", icon: "🏭", description: "Токсичные лужи и теснота между контейнерами. Не подпускайте толстяков: их кислотные следы перекрывают дорогу.", waves: 8, boss: null, goldTime: 486, silverTime: 802, reward: 2650, starBonus: 480, danger: 9, recommendedDps: 154, mapX: 1010, mapY: 155, unlockAfter: "l8" },
  { id: "l10", num: 10, name: "Центр заражённого города", zone: "Эпицентр", icon: "☣️", description: "Финальный маршрут к эпицентру. Все типы заражённых на улицах и Мать Роя в центре. Запасайте патроны и гранаты.", waves: 9, boss: "Мать Роя", goldTime: 690, silverTime: 1138, reward: 3600, starBonus: 600, danger: 10, recommendedDps: 176, mapX: 710, mapY: 105, unlockAfter: "l9" },
];

// ============================================================
// ХЕЛПЕРЫ: расчёт характеристик, DPS, покупок
// ============================================================
export const weaponById = (id: string | null) => WEAPONS.find((w) => w.id === id) ?? null;
export const equipmentById = (id: string | null) => EQUIPMENT.find((e) => e.id === id) ?? null;
export const getEquipmentForSlot = (slot: EquipmentSlot) => EQUIPMENT.filter((e) => e.slot === slot);
export const levelById = (id: string) => LEVELS.find((l) => l.id === id)!;

/** Суммарный урон одного выстрела */
export const shotDamage = (w: Weapon) => w.damage * w.pellets;
/** Базовый DPS оружия без экипировки */
export const weaponDps = (w: Weapon) => Math.round((shotDamage(w) * w.rpm) / 60);
/** DPS с учётом множителей игрока */
export const effectiveDps = (w: Weapon, s: Stats) =>
  Math.round((shotDamage(w) * w.rpm * (s.damagePct / 100) * (s.fireRatePct / 100)) / 60);

/** Итоговые характеристики игрока: база + вся надетая экипировка */
export function computeStats(equippedIds: (string | null)[]): Stats {
  const s: Stats = { ...BASE_STATS };
  for (const id of equippedIds) {
    const item = equipmentById(id);
    if (!item) continue;
    s.maxHp += item.mods.maxHp ?? 0;
    s.armor += item.mods.armor ?? 0;
    s.speed += Math.round((BASE_STATS.speed * (item.mods.speedPct ?? 0)) / 100);
    s.damagePct += item.mods.damagePct ?? 0;
    s.fireRatePct += item.mods.fireRatePct ?? 0;
    s.currencyPct += item.mods.currencyPct ?? 0;
  }
  return s;
}

/** Ожидаемый урон по игроку с учётом брони (мягкое снижение, максимум 70%) */
export const armorReduction = (armor: number) => Math.min(70, Math.round((armor / (armor + 45)) * 100));

/** Награда за уровень: базис + звёзды, умноженная на бонус к валюте */
export const levelReward = (lvl: LevelDef, stars: number, currencyPct: number) => {
  const raw = lvl.reward + lvl.starBonus * Math.max(0, stars - 1);
  return Math.round((raw * currencyPct) / 100);
};

export const TOTAL_STARS = LEVELS.length * 3;

/** Время вместо точности и потери HP: даже медленный билд может получить 3 звезды. */
export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export const gradeTime = (level: LevelDef, seconds: number) =>
  seconds <= level.goldTime ? 3 : seconds <= level.silverTime ? 2 : 1;

export const starRulesText = (level: LevelDef) => [
  `1★ — пройти все ${level.waves} волн`,
  `2★ — успеть за ${formatTime(level.silverTime)}`,
  `3★ — успеть за ${formatTime(level.goldTime)}`,
];

/** Пачка патронов: фиксированный размер, продаётся в оружейной. */
export const AMMO_PACK_SIZE = 30;

/** Цена пачки зависит от калибра: пистолетные дёшевы, винтовочные и пулемётные дороги. */
export function ammoPackPrice(w: Weapon): number {
  switch (w.kind) {
    case "Пистолет": return w.tier >= 2 ? 45 : 25;
    case "Пистолет-пулемёт": return 55;
    case "Дробовик помповый": return 47.5;
    case "Дробовик": return 70;
    case "Автомат": return 75;
    case "Снайперская винтовка": return 85;
    case "Пулемёт": return 115;
    default: return 50;
  }
}

export const isSidearm = (weapon: Weapon) => weapon.kind === "Пистолет";
export const isMelee = (weapon: Weapon) => weapon.kind === "Холодное оружие";

export const canCarryTwoWeapons = (accessoryId: string | null) =>
  accessoryId === "e_backpack" ||
  accessoryId === "e_tactical_pack" ||
  accessoryId === "e_heavy_pack" ||
  accessoryId === "e_specops_pack";

export const grenadeCapacity = (accessoryId: string | null) => {
  switch (accessoryId) {
    case "e_specops_pack": return 10;
    case "e_heavy_pack": return 8;
    case "e_tactical_pack": return 6;
    case "e_backpack": return 4;
    default: return 3;
  }
};

/** Ожидаемый урон за рейд для подсказки готовности; не ограничивает вход. */
export const recommendedLoadoutDps = (level: LevelDef) => level.recommendedDps;

/** Иконка-заглушка оружия по типу (используется и в магазине, и в инвентаре) */
export function weaponIcon(kind: Weapon["kind"]): string {
  switch (kind) {
    case "Пистолет": return "🔫";
    case "Дробовик помповый": return "🧨";
    case "Дробовик": return "💥";
    case "Пистолет-пулемёт": return "⚡";
    case "Автомат": return "🎯";
    case "Снайперская винтовка": return "🔭";
    case "Пулемёт": return "🌀";
    case "Холодное оружие": return "🗡️";
    default: return "🔫";
  }
}

export interface WeaponPhysics {
  /** масса оружия, кг */
  weightKg: number;
  /** скорость поворота ствола за прицелом, рад/с (меньше = тяжелее поводка) */
  turnSpeed: number;
  /** откат ствола назад в руках при выстреле, px */
  barrelKick: number;
  /** физический импульс отдачи в тело стрелка назад, px/с */
  shooterPush: number;
  /** подброс угла ствола при выстреле, рад */
  angleKick: number;
  /** прирост разброса (bloom) за выстрел, рад */
  bloomPerShot: number;
  /** скорость стабилизации прицела, рад/с */
  bloomRecovery: number;
  /** останавливающий импульс по зомби, px/с */
  knockbackImpulse: number;
  /** длительность оглушения/сбития шага зомби при попадании, с */
  staggerSec: number;
  /** оценка отдачи 0..100 для UI */
  recoilRating: number;
  /** оценка останавливающей силы 0..100 для UI */
  stoppingRating: number;
}

/** Единая физическая модель оружия для боя и для карточек магазина/инвентаря */
export function weaponPhysics(w: Weapon): WeaponPhysics {
  switch (w.id) {
    case "w_pm17":
      return { weightKg: 0.8, turnSpeed: 18, barrelKick: 4.5, shooterPush: 24, angleKick: 0.045, bloomPerShot: 0.045, bloomRecovery: 0.28, knockbackImpulse: 95, staggerSec: 0.09, recoilRating: 22, stoppingRating: 28 };
    case "w_obrez":
      return { weightKg: 2.3, turnSpeed: 14, barrelKick: 12, shooterPush: 155, angleKick: 0.14, bloomPerShot: 0.16, bloomRecovery: 0.32, knockbackImpulse: 270, staggerSec: 0.26, recoilRating: 86, stoppingRating: 88 };
    case "w_magnum":
      return { weightKg: 1.3, turnSpeed: 15, barrelKick: 10, shooterPush: 110, angleKick: 0.12, bloomPerShot: 0.11, bloomRecovery: 0.26, knockbackImpulse: 250, staggerSec: 0.24, recoilRating: 74, stoppingRating: 82 };
    case "w_remington":
      return { weightKg: 3.6, turnSpeed: 11.5, barrelKick: 11, shooterPush: 145, angleKick: 0.12, bloomPerShot: 0.14, bloomRecovery: 0.28, knockbackImpulse: 290, staggerSec: 0.28, recoilRating: 80, stoppingRating: 92 };
    case "w_vihr":
      return { weightKg: 2.1, turnSpeed: 16, barrelKick: 3.5, shooterPush: 18, angleKick: 0.032, bloomPerShot: 0.026, bloomRecovery: 0.36, knockbackImpulse: 80, staggerSec: 0.07, recoilRating: 34, stoppingRating: 35 };
    case "w_ak74":
      return { weightKg: 3.4, turnSpeed: 12, barrelKick: 6.5, shooterPush: 42, angleKick: 0.055, bloomPerShot: 0.038, bloomRecovery: 0.32, knockbackImpulse: 155, staggerSec: 0.14, recoilRating: 58, stoppingRating: 64 };
    case "w_m4karat":
      return { weightKg: 3.1, turnSpeed: 13, barrelKick: 5.2, shooterPush: 32, angleKick: 0.04, bloomPerShot: 0.028, bloomRecovery: 0.38, knockbackImpulse: 135, staggerSec: 0.12, recoilRating: 44, stoppingRating: 58 };
    case "w_barracuda":
      return { weightKg: 4.5, turnSpeed: 9.8, barrelKick: 9.5, shooterPush: 115, angleKick: 0.095, bloomPerShot: 0.1, bloomRecovery: 0.3, knockbackImpulse: 240, staggerSec: 0.22, recoilRating: 76, stoppingRating: 86 };
    case "w_svd":
      return { weightKg: 4.3, turnSpeed: 8.8, barrelKick: 13, shooterPush: 165, angleKick: 0.15, bloomPerShot: 0.14, bloomRecovery: 0.25, knockbackImpulse: 380, staggerSec: 0.35, recoilRating: 88, stoppingRating: 98 };
    case "w_knife_combat":
      return { weightKg: 0.4, turnSpeed: 24, barrelKick: 0, shooterPush: 0, angleKick: 0, bloomPerShot: 0, bloomRecovery: 1, knockbackImpulse: 110, staggerSec: 0.15, recoilRating: 0, stoppingRating: 40 };
    case "w_machete_stalker":
      return { weightKg: 0.9, turnSpeed: 21, barrelKick: 0, shooterPush: 0, angleKick: 0, bloomPerShot: 0, bloomRecovery: 1, knockbackImpulse: 210, staggerSec: 0.24, recoilRating: 0, stoppingRating: 65 };
    case "w_axe_fire":
      return { weightKg: 2.1, turnSpeed: 16, barrelKick: 0, shooterPush: 0, angleKick: 0, bloomPerShot: 0, bloomRecovery: 1, knockbackImpulse: 340, staggerSec: 0.36, recoilRating: 0, stoppingRating: 92 };
    case "w_mjasorubka":
    default:
      return { weightKg: 8.2, turnSpeed: 7.4, barrelKick: 5.8, shooterPush: 34, angleKick: 0.048, bloomPerShot: 0.024, bloomRecovery: 0.28, knockbackImpulse: 145, staggerSec: 0.13, recoilRating: 68, stoppingRating: 74 };
  }
}
