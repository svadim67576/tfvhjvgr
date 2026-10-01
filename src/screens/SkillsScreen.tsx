import { SKILLS, skillLevel, skillUnlocked, type SkillDef } from "../game/skills";
import { store, useSave } from "../game/save";
import { GameButton, Panel } from "../game/ui";
import { cn } from "../utils/cn";

// ============================================================
// МЕНЮ НАВЫКОВ: цепочки прокачки за очки, полученные после рейдов
// ============================================================

const BRANCHES: { id: SkillDef["branch"]; note: string }[] = [
  { id: "Бой", note: "точность и уворот" },
  { id: "Тело", note: "живучесть и дыхание" },
  { id: "Снабжение", note: "лом, патроны, скидки" },
];

export default function SkillsScreen({ onBack, toast }: { onBack: () => void; toast: (msg: string) => void }) {
  const save = useSave();
  const points = save.skillPoints;

  const buy = (def: SkillDef) => {
    if (store.buySkill(def.id)) {
      toast(`✅ Навык «${def.name}» повышен.`);
    } else {
      toast(`Не хватает очков навыков: нужно ${def.costs[skillLevel(save.skills, def.id)] ?? 1}.`);
    }
  };

  const totalLevels = SKILLS.reduce((a, s) => a + skillLevel(save.skills, s.id), 0);
  const maxLevels = SKILLS.reduce((a, s) => a + s.maxLevel, 0);

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-3">
      <header className="ruined-sm relative flex flex-wrap items-center justify-between gap-3 bg-[#17201b] px-4 py-3">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-toxic-300">тренировка · пункт B-7</div>
          <h1 className="pixel mt-1 text-[12px] text-rust-50">НАВЫКИ</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="border-2 border-[#c9a74a] bg-[#221d12] px-3 py-1.5 text-center">
            <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-ash-400">очки навыков</div>
            <div className="term text-2xl leading-6 text-[#e7c55a]">{points}</div>
          </div>
          <GameButton variant="ghost" onClick={onBack}>← В лагерь</GameButton>
        </div>
      </header>

      <p className="px-1 text-[11px] leading-5 text-ash-400">
        Очки начисляются после каждого рейда: за зачистку района, звёзды и убийства. Повтор без улучшения
        результата даёт вдвое меньше. Всего прокачано {totalLevels} из {maxLevels} уровней.
      </p>

      {BRANCHES.map((branch) => (
        <Panel key={branch.id} title={branch.id} right={<span className="text-[10px] text-ash-500">{branch.note}</span>}>
          <div className="grid gap-2 sm:grid-cols-2">
            {SKILLS.filter((s) => s.branch === branch.id).map((def) => {
              const level = skillLevel(save.skills, def.id);
              const maxed = level >= def.maxLevel;
              const gate = skillUnlocked(save.skills, def);
              const cost = def.costs[level] ?? 0;
              const affordable = !maxed && gate.open && points >= cost;
              return (
                <div
                  key={def.id}
                  className={cn(
                    "ruined-sm relative border-2 p-2.5",
                    maxed ? "border-toxic-500/70 bg-[#1a2414]" : gate.open ? "border-ash-700 bg-ash-900/90" : "border-ash-800 bg-ash-950/80",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center border text-base", maxed ? "border-toxic-500/60 text-toxic-300" : "border-ash-600 text-ash-300")}>
                      {def.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[12px] font-bold text-ash-100">{def.name}</span>
                        <span className="term shrink-0 text-sm text-[#e7c55a]">
                          {level}/{def.maxLevel}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-0.5" aria-hidden="true">
                        {Array.from({ length: def.maxLevel }).map((_, i) => (
                          <i
                            key={i}
                            className={cn(
                              "h-1.5 flex-1 skew-x-[-12deg]",
                              i < level ? "bg-toxic-500" : "bg-ash-800",
                            )}
                          />
                        ))}
                      </div>
                      <div className="mt-1.5 text-[10px] leading-4 text-ash-400">
                        <span className="text-ash-300">{def.perLevel}</span>
                        {!maxed && <span className="text-ash-500"> · след. ур.: {def.perLevel}</span>}
                      </div>
                      {!gate.open && (
                        <div className="mt-1.5 border-l-2 border-ash-600 pl-2 text-[10px] text-ash-500">
                          🔒 {gate.need}
                        </div>
                      )}
                      {gate.open && !maxed && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-ash-400">
                            цена <b className={cn(affordable ? "text-toxic-300" : "text-red-300")}>{cost}</b> очк.
                          </span>
                          <button
                            type="button"
                            className="skill-buy"
                            disabled={!affordable}
                            onClick={() => buy(def)}
                          >
                            {maxed ? "МАКС" : "ПРОКАЧАТЬ"}
                          </button>
                        </div>
                      )}
                      {maxed && <div className="mt-2 font-mono text-[10px] text-toxic-300">МАКСИМАЛЬНЫЙ УРОВЕНЬ</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}
