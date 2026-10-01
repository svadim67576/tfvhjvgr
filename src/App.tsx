import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BUILDINGS } from "./game/buildings";
import { LEVELS } from "./game/data";
import { sfx } from "./game/audio";
import { music } from "./game/music";
import { profiles, useProfile } from "./game/profiles";
import { store, useSave } from "./game/save";
import { cn } from "./utils/cn";
import type { BuildingId, Screen } from "./game/types";
import MenuScreen from "./screens/MenuScreen";
import HubScreen from "./screens/HubScreen";
import BuildingInterior from "./screens/BuildingInterior";
import WorldMapScreen from "./screens/WorldMapScreen";
import WeaponShopScreen from "./screens/WeaponShopScreen";
import EquipmentShopScreen from "./screens/EquipmentShopScreen";
import InventoryScreen from "./screens/InventoryScreen";
import SettingsScreen from "./screens/SettingsScreen";
import LevelScene from "./screens/LevelScene";
import FilesScreen from "./screens/FilesScreen";
import SkillsScreen from "./screens/SkillsScreen";
import AuthScreen from "./screens/AuthScreen";
import { BootLoading, RaidLoading } from "./screens/LoadingScreen";

export default function App() {
  const [booted, setBooted] = useState(false);
  const [screen, setScreen] = useState<Screen>("menu");
  const [buildingId, setBuildingId] = useState<BuildingId>("hq");
  const [interiorSnapshot, setInteriorSnapshot] = useState("");
  const [levelId, setLevelId] = useState(LEVELS[0].id);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const prevScreen = useRef<Screen>("menu");
  const save = useSave();
  const profile = useProfile();

  // громкость эффектов из настроек
  useEffect(() => {
    sfx.setVolume(save.settings.sfx);
  }, [save.settings.sfx]);

  useEffect(() => {
    // Меню и лобби — своя громкость, рейд всегда тише.
    music.setMenuVolume(screen === "level" ? Math.min(save.settings.music, save.settings.menuMusic * 0.7) : save.settings.menuMusic);
  }, [save.settings.music, save.settings.menuMusic, screen]);

  useEffect(() => {
    if (!profile) return music.setMood("off");
    if (screen === "level") music.setMood("raid");
    else if (screen === "menu") music.setMood("menu");
    else music.setMood("hub");
  }, [screen, profile]);

  useEffect(() => {
    const saveBeforeClose = () => store.saveNow();
    window.addEventListener("pagehide", saveBeforeClose);
    return () => window.removeEventListener("pagehide", saveBeforeClose);
  }, []);

  // Возврат в профиль без повторного ввода: сессия живёт в localStorage.
  useEffect(() => {
    if (profile) return;
    const session = profiles.sessionProfile();
    if (session) store.activateProfile(session.id);
  }, [profile]);

  const unlockAudio = () => { sfx.unlock(); music.unlock(); };
  const buttonHover = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!button || button.disabled || button.hasAttribute("data-plain-button")) return;
    if (event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) return;
    sfx.uiHover();
  };

  const logout = () => {
    store.deactivateProfile();
    profiles.logout();
    setScreen("menu");
    setInteriorSnapshot("");
    setToasts([]);
  };

  const toast = (text: string) => {
    const id = Date.now() + Math.random();
    if (text.startsWith("Не хватает") || text.startsWith("🔒")) sfx.uiDeny();
    else if (text.startsWith("✅")) sfx.uiConfirm();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };

  const go = (s: Screen) => {
    setScreen((cur) => {
      if (cur !== s) prevScreen.current = cur;
      return s;
    });
    window.scrollTo({ top: 0 });
  };

  const enterBuilding = (id: BuildingId) => {
    setBuildingId(id);
    setInteriorSnapshot("");
    go("building");
  };

  // Все разделы лагеря открываются через двери. Интерфейс доступен только у NPC внутри.
  const navigateLobby = (s: Screen) => {
    // Карта рейдов открывается сразу (как выход через ворота), остальные — через здания.
    const rooms: Partial<Record<Screen, BuildingId>> = {
      weapons: "weapons",
      equipment: "equipment",
      inventory: "inventory",
      settings: "radio",
    };
    if (rooms[s]) enterBuilding(rooms[s]!);
    else go(s);
  };

  // Кнопки внутри интерфейса магазина ведут в другое помещение, не обходя его кассира.
  const navigateCounter = (s: Screen) => {
    if (s === "hub") go(prevScreen.current === "building" ? "building" : "hub");
    else if (s === "building") go("building");
    else navigateLobby(s);
  };

  /** Назад — туда, откуда пришли (для настроек: меню или база) */
  const back = () => {
    const p = prevScreen.current;
    go(p === "settings" || p === "level" ? "hub" : p);
  };

  const [raidLoading, setRaidLoading] = useState<string | null>(null);

  const startLevel = (id: string) => {
    // Обязательный экран загрузки перед рейдом; дальше уводит в игру всегда.
    setRaidLoading(id);
  };

  const enterLevel = (id: string) => {
    setLevelId(id);
    setRaidLoading(null);
    go("level");
  };

  // Esc в меню-экранах = назад на базу (в хабе и бою Esc — пауза)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!profile) return;
      if (e.code !== "Escape") return;
      if (screen === "menu" || screen === "hub" || screen === "level" || screen === "building") return;
      if (screen === "settings") back();
      else if (prevScreen.current === "building") go("building");
      else go("hub");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, profile]);

  const overCounter = ["weapons", "equipment", "inventory", "worldmap", "settings"].includes(screen);

  if (!booted) {
    return (
      <div className="ob-app" onPointerDownCapture={unlockAudio} onKeyDownCapture={unlockAudio} onPointerOverCapture={buttonHover}>
        <BootLoading displayName={profile?.displayName} onDone={() => setBooted(true)} />
      </div>
    );
  }

  if (!profile) {
    return <div className="ob-app" onPointerDownCapture={unlockAudio} onKeyDownCapture={unlockAudio} onPointerOverCapture={buttonHover}>
      <AuthScreen onEnter={() => { setScreen("menu"); prevScreen.current = "menu"; }} />
    </div>;
  }

  return (
    <div className="ob-app outbreak-bg relative min-h-screen" data-graphics={save.settings.graphicsQuality} data-particles={save.settings.particleQuality} onPointerDownCapture={unlockAudio} onKeyDownCapture={unlockAudio} onPointerOverCapture={buttonHover}>
      {/* Снимок интерьера как фон под интерфейсом магазина */}
      {interiorSnapshot && prevScreen.current === "building" && overCounter && (
        <div
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center opacity-25 blur-[4px]"
          style={{ backgroundImage: `url(${interiorSnapshot})` }}
        />
      )}

      {screen === "menu" ? (
        <MenuScreen go={go} onLogout={logout} />
      ) : (
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-start px-2 py-3 sm:p-4">
          {screen === "hub" && (
            <HubScreen
              go={go}
              enterBuilding={enterBuilding}
              onMap={() => {
                setInteriorSnapshot("");
                go("worldmap");
              }}
            />
          )}
          {screen === "building" && (
            <BuildingInterior
              id={buildingId}
              onExit={() => go("hub")}
              onCounter={(snapshot) => {
                setInteriorSnapshot(snapshot);
                go(BUILDINGS[buildingId].target);
              }}
            />
          )}
          {screen === "worldmap" && <WorldMapScreen go={navigateCounter} onStart={startLevel} toast={toast} />}
          {screen === "weapons" && <WeaponShopScreen go={navigateCounter} toast={toast} />}
          {screen === "equipment" && <EquipmentShopScreen go={navigateCounter} toast={toast} />}
          {screen === "inventory" && <InventoryScreen go={navigateCounter} toast={toast} />}
          {screen === "settings" && <SettingsScreen onBack={back} toast={toast} />}
          {screen === "skills" && <SkillsScreen onBack={() => go("hub")} toast={toast} />}
          {screen === "level" && <LevelScene key={levelId} levelId={levelId} go={go} onStartLevel={enterLevel} />}
          {screen === "files" && <FilesScreen go={go} toast={toast} />}
        </div>
      )}

      {save.settings.showFps && screen !== "level" && <FpsCounter />}
      {store.storageError && <div className="save-warning" role="alert">{store.storageError}</div>}

      {raidLoading && (() => {
        const lvl = LEVELS.find((l) => l.id === raidLoading) ?? LEVELS[0];
        return (
          <RaidLoading
            levelName={lvl.name}
            levelIcon={lvl.icon}
            danger={lvl.danger}
            description={lvl.description}
            onDone={() => enterLevel(raidLoading)}
          />
        );
      })()}

      {/* Тосты */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-3">
        {toasts.map((t) => {
          const warn = t.text.startsWith("Не хватает") || t.text.startsWith("🔒");
          const good = t.text.startsWith("✅") || t.text.startsWith("🎽");
          return (
            <div
              key={t.id}
              className={cn(
                "anim-fade-up w-full border-2 px-4 py-2 text-center text-[12px] font-semibold shadow-2xl",
                warn
                  ? "border-blood-400 bg-[#2a0d0a]/95 text-red-200"
                  : good
                    ? "border-toxic-500 bg-[#141d10]/95 text-toxic-300"
                    : "border-ash-600 bg-ash-900/95 text-ash-200"
              )}
            >
              {t.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FpsCounter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frame = 0;
    let count = 0;
    let last = performance.now();
    const tick = (now: number) => {
      count++;
      if (now - last > 600) { setFps(Math.round(count * 1000 / (now - last))); count = 0; last = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <output className="global-fps">{fps} FPS</output>;
}
