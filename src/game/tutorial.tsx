import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { store, useSave } from "./save";
import type { CombatHintKey } from "./types";
import type { CombatEngine, HudState } from "./combat";

const ORDER: CombatHintKey[] = ["move", "shoot", "reload", "roll", "loot", "swap"];

const TEXTS: Record<CombatHintKey, { title: string; pc: string; mobile: string }> = {
  move: { title: "ДВИЖЕНИЕ", pc: "WASD или стрелки — движение. Shift — бег.", mobile: "Левый джойстик — движение. Жми до края — бег." },
  shoot: { title: "СТРЕЛЬБА", pc: "ЛКМ — огонь. Прицел следует за мышью.", mobile: "Кнопка ОГОНЬ — стрельба с автонаведением. Тяни по экрану — ручной прицел." },
  reload: { title: "ПЕРЕЗАРЯДКА", pc: "R — перезарядить магазин.", mobile: "Кнопка R — перезарядить магазин." },
  roll: { title: "КУВЫРОК", pc: "SPACE — перекат с неуязвимостью.", mobile: "Кнопка ↯ — перекат с неуязвимостью." },
  loot: { title: "ЛУТ", pc: "E — открыть ящик снабжения рядом.", mobile: "Кнопка E — открыть ящик снабжения рядом." },
  swap: { title: "СМЕНА ОРУЖИЯ", pc: "1 / 2 — слоты оружия.", mobile: "Кнопка ⇄ — смена оружия." },
};

interface Props {
  hud: HudState | null;
  engineRef: MutableRefObject<CombatEngine | null>;
  isMobile: boolean;
}

/** Подсказки появляются по ходу боя, каждая — один раз. Прогресс — в сейве аккаунта. */
export function CombatHints({ hud, engineRef, isMobile }: Props) {
  const save = useSave();
  const prev = useRef({ scrap: -1, slot: "", ammoSum: -1, kills: -1 });
  const crateSeen = useRef(false);

  useEffect(() => {
    if (!hud) return;
    if (save.tutorial.combatSkipped) return;
    const inp = engineRef.current?.input;
    const done = store.getSnapshot().tutorial.combat;

    if (hud.crateNear) crateSeen.current = true;

    // Движение: клавиши/стик или фактическое перемещение.
    if (!done.move && ((inp && (inp.up || inp.down || inp.left || inp.right)) || hud.stance === "moving")) {
      store.completeCombatHint("move");
    }
    // Стрельба: огонь, расход патронов или убийство.
    const ammoSum = hud.ammo + hud.reserve;
    if (prev.current.ammoSum < 0) prev.current.ammoSum = ammoSum;
    if (prev.current.kills < 0) prev.current.kills = hud.kills;
    if (!done.shoot && (inp?.fire || hud.kills > 0 || ammoSum < prev.current.ammoSum)) {
      store.completeCombatHint("shoot");
    }
    // Перезарядка: виден прогресс перезарядки.
    if (!done.reload && hud.reload >= 0) store.completeCombatHint("reload");
    // Кувырок: откат пошёл.
    if (!done.roll && hud.roll < 0.99) store.completeCombatHint("roll");
    // Лут: подобран лом.
    if (prev.current.scrap < 0) prev.current.scrap = hud.scrap;
    if (!done.loot && hud.scrap > prev.current.scrap) store.completeCombatHint("loot");
    // Смена оружия: сменился активный слот.
    if (prev.current.slot === "") prev.current.slot = hud.activeSlot;
    if (!done.swap && prev.current.slot !== hud.activeSlot) store.completeCombatHint("swap");
  }, [hud, save.tutorial.combatSkipped, engineRef]);

  if (!hud || save.tutorial.combatSkipped) return null;
  if (hud.phase === "ended") return null;
  const done = save.tutorial.combat;

  // Первая незавершённая подсказка; лут ждёт ящик рядом, смена — второй ствол.
  let current: CombatHintKey | null = null;
  for (const key of ORDER) {
    if (done[key]) continue;
    if (key === "loot" && !crateSeen.current) break; // ждём возможность, дальше не идём
    if (key === "swap" && !hud.canSwap) continue; // ствола нет — пропускаем молча
    current = key;
    break;
  }
  if (!current) return null;

  const meta = TEXTS[current];
  const stepNo = ORDER.indexOf(current) + 1;

  return (
    <div className="combat-hint" role="status" aria-live="polite">
      <div className="combat-hint-head">
        <span className="combat-hint-kicker">ОБУЧЕНИЕ · {stepNo}/{ORDER.length}</span>
        <button
          type="button"
          className="combat-hint-skip"
          onClick={() => store.skipCombatTutorial()}
        >
          Пропустить
        </button>
      </div>
      <div className="combat-hint-title">{meta.title}</div>
      <div className="combat-hint-text">{isMobile ? meta.mobile : meta.pc}</div>
      <button
        type="button"
        className="combat-hint-next"
        onClick={() => store.completeCombatHint(current!)}
      >
        Понятно ✓
      </button>
    </div>
  );
}
