import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  sfx: 80,
  music: 60,
  menuMusic: 45,
  mouseSensitivity: 100,
  graphicsQuality: "high",
  particleQuality: "high",
  screenShake: true,
  damageNumbers: true,
  showFps: false,
};

export function normalizeSettings(value: Partial<Settings> = {}): Settings {
  if (!value || typeof value !== "object") value = {};
  const bounded = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  return {
    sfx: bounded(value.sfx, 80, 0, 100),
    music: bounded(value.music, 60, 0, 100),
    menuMusic: bounded(value.menuMusic, 45, 0, 100),
    mouseSensitivity: bounded(value.mouseSensitivity, 100, 40, 200),
    graphicsQuality: value.graphicsQuality === "low" || value.graphicsQuality === "medium" ? value.graphicsQuality : "high",
    particleQuality: value.particleQuality === "off" || value.particleQuality === "low" ? value.particleQuality : "high",
    screenShake: typeof value.screenShake === "boolean" ? value.screenShake : true,
    damageNumbers: typeof value.damageNumbers === "boolean" ? value.damageNumbers : true,
    showFps: typeof value.showFps === "boolean" ? value.showFps : false,
  };
}