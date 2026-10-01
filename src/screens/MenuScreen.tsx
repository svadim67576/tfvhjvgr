import { useState } from "react";
import { LEVELS, TOTAL_STARS } from "../game/data";
import { store, useSave } from "../game/save";
import { sfx } from "../game/audio";
import { useProfile } from "../game/profiles";
import { Modal, RuinedButton, RuinedTitle, MiniStat } from "../game/ui";
import { cn } from "../utils/cn";
import type { Screen } from "../game/types";

// ============================================================
// ГЛАВНОЕ МЕНЮ: разрушенный город, кровь, рваные кнопки, тикер
// ============================================================

const TICKER = [
  "СВОДКА: 3-й сектор не отвечает на радиовызовы",
  "ПРЕДУПРЕЖДЕНИЕ: Толстяки после смерти оставляют кислотные лужи",
  "СОВЕТ: взрывайте красные бочки, когда орда соберётся в кучу",
  "СОВЕТ: спринт и рывок тратят выносливость — следите за шкалой",
  "СОВЕТ: стреляйте с места, в движении разброс выше",
  "СВОДКА: мастерская Багрова принимает металлолом в обмен на броню",
];

export default function MenuScreen({ go, onLogout }: { go: (s: Screen) => void; onLogout: () => void }) {
  const save = useSave();
  const profile = useProfile();
  const [help, setHelp] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const hasProgress = store.hasProgress();
  const stars = LEVELS.reduce((a, l) => a + (save.levels[l.id]?.stars ?? 0), 0);
  const cleared = LEVELS.filter((l) => save.levels[l.id]?.cleared).length;
  const allDone = cleared === LEVELS.length;
  const nextLevel = LEVELS.find((l) => save.levels[l.id]?.unlocked && !save.levels[l.id]?.cleared) ?? LEVELS[LEVELS.length - 1];

  const newGame = () => {
    if (hasProgress && !confirmNew) {
      setConfirmNew(true);
      return;
    }
    setConfirmNew(false);
    store.resetSave();
    sfx.uiConfirm();
    go("hub");
  };

  return (
    <div className="outbreak-bg grain relative flex min-h-screen flex-col overflow-hidden">
      {/* Кинематографичный фон: город, выживший с фонарём и орда в тумане */}
      <div className="menu-bg-art pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(90deg, rgba(7,11,10,0.98) 0%, rgba(7,11,10,0.92) 26%, rgba(7,11,10,0.45) 55%, rgba(7,11,10,0.06) 100%), linear-gradient(0deg, rgba(5,8,7,0.92) 0%, transparent 26%, transparent 76%, rgba(5,8,7,0.65) 100%)",
        }}
      />
      {/* Летящие угли и дым поверх фона */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="menu-ember"
            style={{
              left: `${48 + ((i * 37) % 50)}%`,
              animationDelay: `${(i * 0.73) % 6}s`,
              animationDuration: `${5 + (i % 5)}s`,
            }}
          />
        ))}
        {[18, 52, 80].map((x, i) => (
          <span
            key={x}
            className="menu-fog"
            style={{ left: `${x}%`, animationDelay: `${i * 3}s` }}
          />
        ))}
      </div>

      {/* верхняя статусная строка */}
      <div className="relative z-10 flex items-center justify-between gap-3 border-b border-blood-900/40 bg-black/60 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ash-400 backdrop-blur-sm">
        <span className="flex items-center gap-2">
          <span className="anim-blink inline-block h-2 w-2 bg-blood-400" />
          Карантинная зона · день 47
        </span>
        <span className="hidden text-blood-400/80 sm:inline">☣ биологическая угроза · класс 4</span>
        <div className="menu-profile"><span>{profile?.displayName}<small>@{profile?.username}</small></span><button type="button" onClick={onLogout}>Выйти</button></div>
      </div>

      <div className="relative z-10 flex flex-1 items-center px-5 py-6 sm:px-12">
        <div className="w-full max-w-4xl">
          {/* Заголовок с кровью */}
          <div className="relative inline-block">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-red-400/90">
              <span className="anim-blink inline-block h-1.5 w-1.5 bg-blood-400" />
              район прорван · выживших мало
            </div>
            <h1 className="pixel relative text-[38px] leading-none text-[#e9e2d6] sm:text-[64px]">
              <span className="relative z-10" style={{ textShadow: "0 4px 0 #4d0f0b, 0 6px 14px rgba(0,0,0,0.9)" }}>
                OUT
                <span className="text-blood-400" style={{ textShadow: "0 4px 0 #4d0f0b" }}>
                  BREAK
                </span>
              </span>
              {/* Потёки крови с букв */}
              <span className="pointer-events-none absolute -bottom-1 left-[8%] top-full z-0">
                {[14, 33, 57, 78, 94].map((left, i) => (
                  <span
                    key={left}
                    className="anim-drip absolute top-0 h-8 w-[3px] bg-gradient-to-b from-blood-500 to-transparent"
                    style={{ left: `${left}%`, animationDelay: `${i * 0.7}s` }}
                  />
                ))}
              </span>
            </h1>
          </div>

          <p className="mt-5 max-w-lg text-[13px] leading-6 text-ash-300/90">
            Город пал за одну ночь. Мертвецы ходят по улицам, а ты ещё дышишь. Удержи базу, зачисти{" "}
            <b className="text-rust-200">10 районов</b> и доберись до эпицентра заражения.
          </p>

          {/* Разрушенные кнопки */}
          <div className="mt-7 grid max-w-md gap-3">
            <RuinedTitle>Пункт управления</RuinedTitle>

            {hasProgress && !allDone && (
              <RuinedButton
                tone="primary"
                size="lg"
                badge={`Р-${nextLevel.num}`}
                subtitle={`${nextLevel.name} · опасность ${nextLevel.danger}/10`}
                onClick={() => {
                  sfx.uiConfirm();
                  go("hub");
                }}
              >
                ▶ Продолжить
              </RuinedButton>
            )}
            {hasProgress && allDone && (
              <RuinedButton tone="primary" size="lg" badge="100%" subtitle="Город зачищен · свободный режим" onClick={() => go("hub")}>
                ▶ Вернуться на базу
              </RuinedButton>
            )}

            <RuinedButton tone={hasProgress ? "rust" : "primary"} badge={hasProgress ? "сброс" : undefined} onClick={newGame}>
              {hasProgress ? "☣ Новая кампания" : "▶ Начать кампанию"}
            </RuinedButton>

            {confirmNew && (
              <div className="ruined-sm relative bg-[#2a0d0a] px-4 py-3 text-[12px] text-red-200">
                <span className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 0 2px #6b1a14" }} />
                <span className="font-bold">Всё будет потеряно.</span> Арсенал, броня, металлолом и открытые районы исчезнут навсегда.
                <div className="mt-2.5 flex gap-2">
                  <RuinedButton tone="primary" size="sm" onClick={newGame} className="flex-1">
                    Да, сжечь всё
                  </RuinedButton>
                  <RuinedButton tone="steel" size="sm" onClick={() => setConfirmNew(false)} className="flex-1">
                    Отмена
                  </RuinedButton>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <RuinedButton tone="steel" onClick={() => setHelp(true)}>
                ❔ Выживание
              </RuinedButton>
              <RuinedButton tone="steel" onClick={() => go("settings")}>
                ⚙ Настройки
              </RuinedButton>
            </div>
            <RuinedButton tone="rust" onClick={() => go("files")} subtitle="Сохранение и резервная копия профиля">
              📁 Файлы игры
            </RuinedButton>
          </div>

          {/* Компактная сводка кампании */}
          {hasProgress && (
            <div className="ruined-sm claws relative mt-7 max-w-md bg-black/60 p-3">
              <span className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 0 2px #232a28" }} />
              <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-ash-500">
                <span>Ход кампании</span>
                <span className="term text-base text-[#e7c55a]">
                  {stars}/{TOTAL_STARS} ★
                </span>
              </div>
              <div className="flex gap-1">
                {LEVELS.map((l) => {
                  const p = save.levels[l.id];
                  return (
                    <span
                      key={l.id}
                      title={l.name}
                      className={cn(
                        "h-2.5 flex-1 skew-x-[-12deg]",
                        p?.cleared ? (p.stars === 3 ? "bg-[#e7c55a]" : "bg-toxic-500") : p?.unlocked ? "bg-rust-400" : "bg-ash-800"
                      )}
                    />
                  );
                })}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Районов" value={`${cleared}/${LEVELS.length}`} />
                <MiniStat label="Звёзд" value={`${stars}`} />
                <MiniStat label="Лом ⚙" value={`${save.currency}`} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Нижняя бегущая строка */}
      <div className="relative z-10 overflow-hidden border-t border-blood-900/40 bg-black/75 py-1.5 backdrop-blur-sm">
        <div className="anim-ticker flex w-max whitespace-nowrap text-[11px] text-ash-400/80">
          {TICKER.concat(TICKER).map((t, i) => (
            <span key={i} className="mx-7 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 bg-blood-500" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Справка по выживанию */}
      <Modal open={help} title="ИНСТРУКЦИЯ ПО ВЫЖИВАНИЮ" onClose={() => setHelp(false)} width="max-w-2xl">
        <div className="space-y-4 text-[12px] leading-5 text-ash-300">
          <section>
            <h4 className="pixel mb-2 text-[9px] text-rust-200">УПРАВЛЕНИЕ В БОЮ</h4>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              <li>• WASD / стрелки — движение</li>
              <li>• Мышь — прицел, ЛКМ — огонь</li>
              <li>• Shift — спринт (тратит выносливость)</li>
              <li>• Space — кувырок с неуязвимостью</li>
              <li>• R — перезарядка</li>
              <li>• G — бросить гранату</li>
              <li>• E — открыть ящик снабжения</li>
              <li>• 1 / 2 — смена оружия (нужен рюкзак)</li>
              <li>• Esc — пауза</li>
            </ul>
          </section>
          <section>
            <h4 className="pixel mb-2 text-[9px] text-rust-200">ЦИКЛ ИГРЫ</h4>
            <p>
              База → карта города → рейд в район → волны заражённых → металлолом → магазины.
              Каждый район открывает следующий. Звёзды даются за скорость: уложись в серебряное или
              золотое время. В 5-м и 10-м районах ждут боссы.
            </p>
          </section>
          <section>
            <h4 className="pixel mb-2 text-[9px] text-rust-200">ЗАРАЖЁННЫЕ</h4>
            <ul className="grid gap-1.5">
              <li>• <b className="text-ash-100">Бродяга</b> — медленный, идёт толпой.</li>
              <li>• <b className="text-rust-200">Бегун</b> — телеграфирует рывок дрожью; сбивается выстрелом.</li>
              <li>• <b className="text-toxic-300">Плевун</b> — держит дистанцию, плюётся кислотой.</li>
              <li>• <b className="text-toxic-300">Толстяк</b> — таран; после смерти оставляет кислотную лужу.</li>
              <li>• <b className="text-ash-100">Бронированный</b> — режет входящий урон вдвое; берите снайперку.</li>
              <li>• <b className="text-blood-400">Боссы</b> — рывок по прямой (уклоняйтесь) и призыв орды.</li>
            </ul>
          </section>
        </div>
      </Modal>
    </div>
  );
}
