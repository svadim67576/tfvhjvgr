import type { BuildingId, Screen } from "./types";

// ============================================================
// Здания базы: у каждого — вывеска, кассир-NPC и экран-интерфейс,
// который открывается только у прилавка (E у NPC).
// ============================================================

export interface BuildingInfo {
  id: BuildingId;
  name: string;
  number: string;
  sign: string;
  clerk: string;
  clerkLine: string;
  action: string;
  accent: string;
  target: Screen;
  floor: string;
  wall: string;
}

export const BUILDINGS: Record<BuildingId, BuildingInfo> = {
  hq: {
    id: "hq",
    name: "Штаб",
    number: "СТР-01",
    sign: "ШТАБ ОБОРОНЫ",
    clerk: "Командир Орлова",
    clerkLine: "Карта рейдов на столе. Подойдите и доложитесь.",
    action: "Открыть карту рейдов",
    accent: "#e7c55a",
    target: "worldmap",
    floor: "#3a3f3a",
    wall: "#2c332f",
  },
  weapons: {
    id: "weapons",
    name: "Оружейная",
    number: "СТР-02",
    sign: "ОРУЖЕЙНАЯ «ГРОМ»",
    clerk: "Гром · оружейник",
    clerkLine: "Стволы, патроны и гранаты. Лом вперёд.",
    action: "Открыть витрину оружия",
    accent: "#e99943",
    target: "weapons",
    floor: "#3b3733",
    wall: "#332d27",
  },
  equipment: {
    id: "equipment",
    name: "Мастерская брони",
    number: "СТР-03",
    sign: "АТЕЛЬЕ БАГРОВА",
    clerk: "Багров · портной-бронник",
    clerkLine: "Шью на совесть: каски, жилеты, ранцы.",
    action: "Открыть мастерскую брони",
    accent: "#8fae4a",
    target: "equipment",
    floor: "#373b34",
    wall: "#2b312a",
  },
  inventory: {
    id: "inventory",
    name: "Склад",
    number: "СТР-04",
    sign: "СКЛАД СНАРЯЖЕНИЯ",
    clerk: "Кладовщик Семёныч",
    clerkLine: "Всё, что нажито: арсенал, броня и слоты.",
    action: "Открыть инвентарь",
    accent: "#8bbbe0",
    target: "inventory",
    floor: "#36383b",
    wall: "#2a2d31",
  },
  radio: {
    id: "radio",
    name: "Радиорубка",
    number: "СТР-05",
    sign: "РАДИОРУБКА",
    clerk: "Радист Юля",
    clerkLine: "Настройки станции: звук, тряска, счётчики.",
    action: "Открыть настройки",
    accent: "#b58fd8",
    target: "settings",
    floor: "#383439",
    wall: "#2d2a30",
  },
};
