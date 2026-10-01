import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  LEVELS,
  WEAPONS,
  canCarryTwoWeapons,
  formatTime,
  grenadeCapacity,
  isMelee,
  levelById,
  weaponById,
} from "../game/data";
import { store, useSave, useStats } from "../game/save";
import { GameButton, Modal, StarRow, WeaponArt } from "../game/ui";
import { CombatEngine, VIEW_H, VIEW_W, type CombatResult, type HudState } from "../game/combat";
import { combatMods, skillLevel } from "../game/skills";
import { useIsMobile } from "../game/device";
import TouchStick from "../game/TouchStick";
import { CombatHints } from "../game/tutorial";
import type { Screen, WeaponSlot } from "../game/types";
import { cn } from "../utils/cn";
import SettingsScreen from "./SettingsScreen";

type Outcome = CombatResult & { reward: number; nextId: string | null };

/** Портрет выжившего: строго центрирован, обрезан круглой маской, ничего не вылезает. */
function SurvivorAvatar({ hpPct, armor }: { hpPct: number; armor: number }) {
  const helmet = armor >= 10 ? "#55644d" : "#3f4c43";
  return (
    <svg viewBox="0 0 48 48" className="hud-avatar-art" aria-hidden="true">
      <defs>
        <clipPath id="hud-avatar-mask">
          <circle cx="24" cy="24" r="21" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="48" height="48" fill="#0d1311" />
      <g clipPath="url(#hud-avatar-mask)">
        <rect x="0" y="0" width="48" height="48" fill="#131b18" />
        <ellipse cx="24" cy="46" rx="17" ry="12" fill="#5c6b61" />
        <ellipse cx="11" cy="40" rx="7" ry="6" fill={heavyArmor(armor)} />
        <ellipse cx="37" cy="40" rx="7" ry="6" fill={heavyArmor(armor)} />
        <rect x="22" y="32" width="4" height="12" fill="#2b3530" />
        <circle cx="24" cy="21" r="10.5" fill="#b9916d" />
        <path d="M13.5 21 a10.5 10.5 0 0 1 21 0 L30 11 H18 Z" fill={helmet} />
        <rect x="14" y="19" width="20" height="2.6" fill="#1c1a14" opacity="0.55" />
        <path d="M16 12 l5 -3" stroke="#d2cdb4" strokeOpacity="0.6" strokeWidth="1.2" />
        <circle cx="30" cy="20" r="1.8" fill="#d8e58c" />
        <circle cx="30" cy="20" r="3" fill="#d8e58c" opacity="0.25" />
        {hpPct <= 35 && <path d="M9 39 l6 -4 M35 43 l5 -6" stroke="#a3231f" strokeWidth="2.4" strokeLinecap="round" />}
      </g>
      <circle cx="24" cy="24" r="21" fill="none" stroke="#000" strokeOpacity="0.6" strokeWidth="2" />
    </svg>
  );
}

function heavyArmor(armor: number) {
  return armor >= 15 ? "#46543f" : "#3d4c43";
}

export default function LevelScene({
  levelId,
  go,
  onStartLevel,
}: {
  levelId: string;
  go: (s: Screen) => void;
  onStartLevel: (id: string) => void;
}) {
  const lvl = levelById(levelId);
  const save = useSave();
  const stats = useStats();
  const isMobile = useIsMobile();
  const selectedWeapon = weaponById(save.equippedWeapon) ?? WEAPONS[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CombatEngine | null>(null);
  const pausedRef = useRef(false);
  const flushedRef = useRef(false);
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [fps, setFps] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef(false);
  optionsRef.current = optionsOpen;

  // Конфигурация фиксируется на старте рейда; переключение оружия идёт внутри движка.
  const cfg = useRef({
    lvl,
    stats,
    settings: save.settings,
    skills: combatMods(save.skills),
    selectedWeapon,
    sidearm: weaponById(save.weaponSlots.sidearm),
    primary: weaponById(save.weaponSlots.primary),
    activeSlot: save.activeWeaponSlot,
    canSwap: canCarryTwoWeapons(save.equipped.accessory),
    grenades: Math.min(save.grenades, grenadeCapacity(save.equipped.accessory)),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const c = cfg.current;
    // Патроны забираются со склада в рейд целиком; остаток вернётся в onEnd/flush.
    const ammoTaken: Record<string, number> = {};
    for (const w of [c.sidearm, c.primary]) {
      if (w && !isMelee(w)) ammoTaken[w.id] = (ammoTaken[w.id] ?? 0) + store.takeAmmo(w.id, Number.MAX_SAFE_INTEGER);
    }
    flushedRef.current = false;
    setOutcome(null);
    setPaused(false);
    pausedRef.current = false;

    const engine = new CombatEngine(
      {
        level: c.lvl,
        weapon: c.selectedWeapon,
        weaponSlots: { sidearm: c.sidearm, primary: c.primary },
        activeSlot: c.activeSlot,
        canSwap: c.canSwap,
        grenades: c.grenades,
        ammoStock: ammoTaken,
        stats: c.stats,
        settings: c.settings,
        skills: c.skills,
      },
      {
        onScrap: (amount) => {
          const bonus = 1 + 0.08 * skillLevel(store.getSnapshot().skills, "scavenger");
          store.addCurrency(Math.round(amount * bonus));
        },
        onGrenadeUsed: () => store.useGrenade(),
        onGrenadeFound: () => store.addGrenades(1),
        onSwitchWeapon: (slot) => store.selectWeaponSlot(slot),
        onEnd: (r) => {
          const reward = r.victory ? store.completeLevel(c.lvl.id, r.stars, r.kills, r.time) : 0;
          if (!r.victory) store.recordDeath(r.kills);
          // возврат остатка патронов на склад
          flushedRef.current = true;
          const left = engine.ammoLeftByWeapon();
          for (const [id, amount] of Object.entries(left)) store.refundAmmo(id, amount);
          const next = LEVELS.find((l) => l.unlockAfter === c.lvl.id);
          setOutcome({ ...r, reward, nextId: r.victory && next ? next.id : null });
        },
      }
    );
    // Открытие ящика засчитывает подсказку про лут (возвращает boolean — успех виден сразу).
    const origOpenCrate = engine.openCrate.bind(engine);
    engine.openCrate = () => {
      const ok = origOpenCrate();
      if (ok) store.completeCombatHint("loot");
      return ok;
    };
    engineRef.current = engine;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudT = 0;
    let frames = 0;
    let fpsT = 0;
    const loop = (now: number) => {
      const dtRaw = Math.min(0.12, (now - last) / 1000);
      last = now;
      frames++;
      fpsT += dtRaw;
      if (fpsT >= 0.5) {
        setFps(Math.round(frames / fpsT));
        frames = 0;
        fpsT = 0;
      }
      if (!pausedRef.current) {
        acc += dtRaw;
        const step = 1 / 120;
        let guard = 0;
        while (acc > step && guard < 12) {
          engine.update(step);
          acc -= step;
          guard++;
        }
        engine.render(ctx);
        if (radarRef.current) engine.renderMinimap(radarRef.current);
        hudT += dtRaw;
        if (hudT > 0.08) {
          hudT = 0;
          setHud(engine.getHud());
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ---------- ввод ----------
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Escape" && !e.repeat) {
        if (optionsRef.current) { optionsRef.current = false; setOptionsOpen(false); }
        else { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }
        engine.clearInput();
        return;
      }
      if (pausedRef.current || engine.getHud().phase === "ended") return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      const inp = engine.input;
      if (e.code === "KeyW" || e.code === "ArrowUp") inp.up = true;
      if (e.code === "KeyS" || e.code === "ArrowDown") inp.down = true;
      if (e.code === "KeyA" || e.code === "ArrowLeft") inp.left = true;
      if (e.code === "KeyD" || e.code === "ArrowRight") inp.right = true;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") inp.sprint = true;
      if (e.repeat) return;
      if (e.code === "Space") engine.roll();
      if (e.code === "KeyR") engine.reload();
      if (e.code === "KeyG") engine.throwGrenade();
      if (e.code === "KeyE") engine.openCrate();
      if (e.code === "Digit1") engine.switchWeapon("sidearm");
      if (e.code === "Digit2") engine.switchWeapon("primary");
    };
    const ku = (e: KeyboardEvent) => {
      const inp = engine.input;
      if (e.code === "KeyW" || e.code === "ArrowUp") inp.up = false;
      if (e.code === "KeyS" || e.code === "ArrowDown") inp.down = false;
      if (e.code === "KeyA" || e.code === "ArrowLeft") inp.left = false;
      if (e.code === "KeyD" || e.code === "ArrowRight") inp.right = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") inp.sprint = false;
    };
    let lastMouse: { x: number; y: number } | null = null;
    const resetMouse = () => { lastMouse = null; };
    const mm = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
      const sensitivity = store.getSnapshot().settings.mouseSensitivity / 100;
      engine.input.mouseX = Math.max(0, Math.min(VIEW_W, !lastMouse || sensitivity === 1 ? x : engine.input.mouseX + (x - lastMouse.x) * sensitivity));
      engine.input.mouseY = Math.max(0, Math.min(VIEW_H, !lastMouse || sensitivity === 1 ? y : engine.input.mouseY + (y - lastMouse.y) * sensitivity));
      lastMouse = { x, y };
    };
    const md = (e: MouseEvent) => {
      if (pausedRef.current) return;
      if (e.button === 0) engine.input.fire = true;
      if (e.button === 2) engine.input.aim = true;
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) engine.input.fire = false;
      if (e.button === 2) engine.input.aim = false;
    };
    // Прицел на ПК отпускается через mouseup, на телефоне — переключатель: глобально его не сбрасываем.
    const pointerUp = () => { engine.input.fire = false; engine.input.autoAim = false; };
    const cm = (e: Event) => e.preventDefault();
    const blur = () => engine.clearInput();

    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("mouseup", mu);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("blur", blur);
    canvas.addEventListener("mousemove", mm);
    canvas.addEventListener("mouseenter", resetMouse);
    canvas.addEventListener("mousedown", md);
    canvas.addEventListener("contextmenu", cm);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("blur", blur);
      canvas.removeEventListener("mousemove", mm);
      canvas.removeEventListener("mouseenter", resetMouse);
      canvas.removeEventListener("mousedown", md);
      canvas.removeEventListener("contextmenu", cm);
      // если рейд прерван (выход/рестарт) — вернуть невозвращённые патроны
      if (!flushedRef.current) {
        const left = engine.ammoLeftByWeapon();
        for (const [id, amount] of Object.entries(left)) store.refundAmmo(id, amount);
      }
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId, runId]);

  useEffect(() => {
    engineRef.current?.setSettings(save.settings);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && engineRef.current) engineRef.current.render(ctx);
  }, [save.settings]);

  const restart = () => {
    cfg.current = {
      lvl,
      stats,
      settings: save.settings,
      skills: combatMods(save.skills),
      selectedWeapon: weaponById(save.equippedWeapon) ?? WEAPONS[0],
      sidearm: weaponById(save.weaponSlots.sidearm),
      primary: weaponById(save.weaponSlots.primary),
      activeSlot: save.activeWeaponSlot,
      canSwap: canCarryTwoWeapons(save.equipped.accessory),
      grenades: Math.min(save.grenades, grenadeCapacity(save.equipped.accessory)),
    };
    setRunId((i) => i + 1);
  };

  const hpPct = hud ? (hud.hp / hud.maxHp) * 100 : 100;
  const trailPct = hud ? (hud.hpTrail / hud.maxHp) * 100 : 100;
  const activeWeapon = hud ? weaponById(hud.weaponId) : null;
  const otherSlot: WeaponSlot | null =
    hud && hud.canSwap ? (hud.activeSlot === "sidearm" ? "primary" : "sidearm") : null;

  /** Ручной прицел на телефоне: веди пальцем по экрану. Кнопки и стик не перехватываются. */
  const onAimDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    const t = e.target as Element | null;
    if (t && t.closest("button, .tstick, .combat-hint, .hud-cluster")) return;
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine || pausedRef.current) return;
    const rect = canvas.getBoundingClientRect();
    engine.input.mouseX = Math.max(0, Math.min(VIEW_W, ((e.clientX - rect.left) / rect.width) * VIEW_W));
    engine.input.mouseY = Math.max(0, Math.min(VIEW_H, ((e.clientY - rect.top) / rect.height) * VIEW_H));
  };

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-2 p-2">
      {/* ИГРОВОЕ ПОЛЕ + КОМПАКТНЫЙ HUD ПОВЕРХ */}
      <div
        className={cn("game-field relative border-2 border-ash-600 bg-black shadow-2xl", isMobile && "is-mobile")}
        onPointerMove={onAimDrag}
      >
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="block h-auto w-full cursor-none" aria-label="Игровое поле" />

        {/* Единый блок: портрет + HP + выносливость + патроны + ресурсы + оружие */}
        {hud && (
          <div className="hud-cluster" aria-live="off">
            <div className={cn("hud-avatar", hpPct <= 35 && "hud-avatar-low")}>
              <SurvivorAvatar hpPct={hpPct} armor={stats.armor} />
              <span className="hud-hp-num">{hud.hp}</span>
            </div>
            <div className="hud-cluster-main">
              <div className="hud-hpbar" role="progressbar" aria-label="Здоровье" aria-valuenow={hud.hp} aria-valuemax={hud.maxHp}>
                <div className="hud-hpbar-trail" style={{ width: `${trailPct}%` }} />
                <div className={cn("hud-hpbar-fill", hpPct > 55 ? "ok" : hpPct > 25 ? "warn" : "crit")} style={{ width: `${hpPct}%` }} />
                <span>{hud.hp}/{hud.maxHp}{hud.armorPct > 0 && <em> · −{hud.armorPct}%</em>}</span>
              </div>
              <div className={cn("hud-stbar", hud.exhausted && "exhausted")} role="progressbar" aria-label="Выносливость" aria-valuenow={hud.stamina} aria-valuemax={100}>
                <div style={{ width: `${hud.stamina}%` }} />
              </div>
              <div className="hud-ammo-row">
                {activeWeapon && <WeaponArt weapon={activeWeapon} className="hud-weapon-art" />}
                <div className="hud-ammo-nums">
                  <b>{activeWeapon && isMelee(activeWeapon) ? "∞" : hud.ammo}<i>/{activeWeapon && isMelee(activeWeapon) ? "∞" : hud.reserve}</i></b>
                  <span>{activeWeapon?.name ?? ""}</span>
                </div>
                {hud.reload >= 0 && <div className="hud-reload"><i style={{ width: `${hud.reload * 100}%` }} /></div>}
              </div>
              <div className="hud-res-row">
                <span title="Металлолом">⚙ {save.currency.toLocaleString("ru-RU")}</span>
                <span title="Гранаты">✴ {hud.grenades}</span>
                <span title="Кувырок" className={hud.roll >= 1 ? "ready" : ""}>↯ {hud.roll >= 1 ? "✓" : `${Math.round(hud.roll * 100)}%`}</span>
                {(["sidearm", "primary"] as WeaponSlot[]).map((slot) => {
                  const id = slot === "sidearm" ? hud.sidearmId : hud.primaryId;
                  if (!id) return null;
                  return (
                    <button
                      key={slot}
                      type="button"
                      data-plain-button
                      className={cn("hud-slot", hud.activeSlot === slot && "active")}
                      disabled={!hud.canSwap && hud.activeSlot !== slot}
                      onClick={() => engineRef.current?.switchWeapon(slot)}
                      title={slot === "sidearm" ? "Запасное [1]" : "Основное [2]"}
                    >
                      {slot === "sidearm" ? "1" : "2"}
                    </button>
                  );
                })}
                {hud.crateNear && !isMobile && (
                  <button type="button" data-plain-button className="hud-crate" onClick={() => engineRef.current?.openCrate()}>
                    [E] ЯЩИК
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Волна / босс / время — одна строка по центру */}
        {hud && (
          <div className="hud-wavepill">
            {hud.boss ? (
              <>
                <span className="anim-blink hud-boss-name">☠ {hud.boss.name}</span>
                <div className="hud-boss-bar"><i style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%` }} /></div>
              </>
            ) : (
              <>
                <span className="hud-wavepill-lvl">Р-{lvl.num}</span>
                <span>Волна <b>{hud.wave}/{lvl.waves}</b></span>
                {hud.phase === "wave" && <span className="dim">· осталось <b>{hud.waveLeft}</b></span>}
                {(hud.phase === "break" || hud.phase === "ready") && <span className="ok">· передышка {hud.breakLeft}с</span>}
                <span className="dim">· ⏱ {formatTime(hud.time)} · ☠ {hud.kills}</span>
                {save.settings.showFps && <span className="dim">· {fps} fps</span>}
              </>
            )}
          </div>
        )}

        {/* Пауза + мини-радар в углу */}
        <div className="hud-topright">
          <button
            type="button"
            data-plain-button
            className="hud-pause"
            aria-label="Пауза"
            onClick={() => { pausedRef.current = true; setPaused(true); engineRef.current?.clearInput(); }}
          >
            ⏸
          </button>
          <div className="combat-radar combat-radar-mini pointer-events-none">
            <div className="combat-radar-title"><span /> РАДАР</div>
            <canvas ref={radarRef} className="combat-radar-map" aria-label="Тактическая карта района" />
          </div>
        </div>

        {hud?.banner && (
          <div className="anim-banner pointer-events-none absolute left-1/2 top-[24%] -translate-x-1/2 text-center">
            <div className="pixel text-[22px] text-[#e9e2d6]" style={{ textShadow: "0 3px 0 #4d0f0b, 0 5px 14px #000" }}>
              {hud.banner.title}
            </div>
            <div className="mt-1 text-[12px] font-bold uppercase tracking-[0.25em] text-rust-200">{hud.banner.sub}</div>
          </div>
        )}
        {hud?.melee && (
          <div className="stripes-danger pointer-events-none absolute left-1/2 top-[13%] -translate-x-1/2 border border-blood-400 px-3 py-1 text-[11px] font-bold text-red-100">
            ПАТРОНЫ КОНЧИЛИСЬ — В ХОД ИДЁТ НОЖ
          </div>
        )}
        {hud?.aiming && (
          <div className="pointer-events-none absolute left-1/2 top-[8%] -translate-x-1/2 border border-toxic-500/70 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-toxic-300">
            ПРИЦЕЛИВАНИЕ · ТОЧНОСТЬ ВЫШЕ
          </div>
        )}

        {isMobile && (
          <div className="combat-touch-controls" aria-label="Сенсорное управление">
            <TouchStick
              label="Джойстик движения"
              onVector={(x, y, mag) => {
                const engine = engineRef.current;
                if (!engine) return;
                engine.input.left = x < -0.22;
                engine.input.right = x > 0.22;
                engine.input.up = y < -0.22;
                engine.input.down = y > 0.22;
                // Джойстик до упора — бег.
                engine.input.sprint = mag > 0.92;
              }}
              onEnd={() => {
                const input = engineRef.current?.input;
                if (!input) return;
                input.left = input.right = input.up = input.down = input.sprint = false;
              }}
            />
            <div className="combat-touch-right">
              <button
                type="button"
                className={cn("combat-touch-aim", hud?.aiming && "active")}
                aria-label="Прицеливание"
                aria-pressed={!!hud?.aiming}
                onPointerDown={() => {
                  const engine = engineRef.current;
                  if (engine && !pausedRef.current) engine.input.aim = !engine.input.aim;
                }}
              >
                ◎ ПРИЦЕЛ
              </button>
              {hud?.crateNear && (
                <button
                  type="button"
                  className="combat-touch-interact"
                  onPointerDown={() => engineRef.current?.openCrate()}
                >
                  E · ОТКРЫТЬ
                </button>
              )}
              <div className="combat-touch-grid">
                <button type="button" className="combat-touch-small" aria-label="Смена оружия" onPointerDown={() => { if (otherSlot) engineRef.current?.switchWeapon(otherSlot); }}>
                  <b>⇄</b><small>ствол</small>
                </button>
                <button
                  type="button"
                  className="combat-touch-fire"
                  aria-label="Стрельба"
                  onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); if (engineRef.current) { engineRef.current.input.fire = true; engineRef.current.input.autoAim = true; } }}
                  onPointerUp={() => { if (engineRef.current) { engineRef.current.input.fire = false; engineRef.current.input.autoAim = false; } }}
                  onPointerCancel={() => { if (engineRef.current) { engineRef.current.input.fire = false; engineRef.current.input.autoAim = false; } }}
                >
                  <b>◎</b><small>огонь</small>
                </button>
                <button type="button" className="combat-touch-small" aria-label="Кувырок" onPointerDown={() => engineRef.current?.roll()}>
                  <b>↯</b><small>кувырок</small>
                </button>
                <button type="button" className="combat-touch-small" aria-label="Перезарядка" onPointerDown={() => engineRef.current?.reload()}>
                  <b>R</b><small>патроны</small>
                </button>
                <button type="button" className="combat-touch-small" aria-label="Граната" onPointerDown={() => engineRef.current?.throwGrenade()}>
                  <b>✴</b><small>{hud?.grenades ?? 0}</small>
                </button>
              </div>
            </div>
          </div>
        )}

        <CombatHints hud={hud} engineRef={engineRef} isMobile={isMobile} />
      </div>

      {/* ПАУЗА */}
      <Modal open={paused && !outcome && !optionsOpen} title="ПАУЗА · РЕЙД ПРИОСТАНОВЛЕН" width="max-w-md">
        <div className="grid gap-2">
          <GameButton
            variant="primary"
            onClick={() => {
              pausedRef.current = false;
              setPaused(false);
            }}
          >
            ▶ Продолжить бой
          </GameButton>
          <GameButton onClick={() => setOptionsOpen(true)}>Настройки</GameButton>
          <GameButton onClick={restart}>↻ Начать рейд заново</GameButton>
          <GameButton variant="danger" onClick={() => go("worldmap")}>
            ⏏ Отступить на базу (прогресс рейда сгорит)
          </GameButton>
          <p className="text-[10px] text-ash-500">Патроны, не потраченные в рейде, вернутся на склад.</p>
        </div>
      </Modal>

      {optionsOpen && <div className="raid-settings-overlay"><SettingsScreen onBack={() => setOptionsOpen(false)} /></div>}

      {/* ИТОГИ */}
      <Modal open={!!outcome} title={outcome?.victory ? "РАЙОН ЗАЧИЩЕН" : "ВЫ ПОГИБЛИ"} width="max-w-lg">
        {outcome && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className={cn("pixel text-[13px]", outcome.victory ? "text-toxic-300" : "text-blood-400")}>
                  {outcome.victory ? `Р-${lvl.num} · ${lvl.name}` : "Орда оказалась сильнее"}
                </div>
                {outcome.victory && (
                  <div className="mt-1 text-[11px] text-ash-400">
                    Время {formatTime(outcome.time)} · золото {formatTime(lvl.goldTime)} · серебро {formatTime(lvl.silverTime)}
                  </div>
                )}
              </div>
              {outcome.victory && <StarRow stars={outcome.stars} size={26} />}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Cell label="Убийств" value={`${outcome.kills}`} />
              <Cell label="Точность" value={`${outcome.accuracy}%`} />
              <Cell label="Урон получен" value={`${outcome.damageTaken}`} />
              <Cell label="Волн пройдено" value={`${outcome.wave}/${lvl.waves}`} />
            </div>

            {outcome.victory ? (
              <div className="border border-toxic-500/50 bg-toxic-500/10 px-3 py-2 text-[12px] text-toxic-300">
                Награда за рейд: <b className="term text-lg">{outcome.reward} ⚙️</b> (лом с земли уже в кармане: {outcome.scrap} ⚙️)
              </div>
            ) : (
              <div className="border border-blood-400/50 bg-blood-500/10 px-3 py-2 text-[12px] text-red-200">
                Подобранный лом остаётся с вами: {outcome.scrap} ⚙️. Купите броню получше и возвращайтесь.
              </div>
            )}

            {store.lastSkillAward && store.lastSkillAward.points > 0 && (
              <div className="border border-[#c9a74a]/50 bg-[#c9a74a]/10 px-3 py-2 text-[12px] text-[#e7c55a]">
                <div>Очки навыков: <b className="term text-lg">+{store.lastSkillAward.points}</b> — потратьте их в лобби, кнопка «Навыки».</div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-ash-300">
                  {store.lastSkillAward.lines.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {outcome.victory && outcome.nextId ? (
                <GameButton variant="primary" onClick={() => onStartLevel(outcome.nextId!)}>
                  ▶ Следующий район
                </GameButton>
              ) : (
                <GameButton variant="primary" onClick={restart}>
                  ↻ Ещё раз
                </GameButton>
              )}
              {outcome.victory && <GameButton onClick={restart}>↻ Улучшить результат</GameButton>}
              <GameButton onClick={() => go("worldmap")}>🗺 Карта города</GameButton>
              <GameButton variant="ghost" onClick={() => go("hub")}>🏕 На базу</GameButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ash-800 bg-ash-950/70 px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-ash-500">{label}</div>
      <div className="term text-xl text-ash-100">{value}</div>
    </div>
  );
}
