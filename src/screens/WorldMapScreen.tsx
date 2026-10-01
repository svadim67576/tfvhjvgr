import { useState } from "react";
import {
  LEVELS,
  canCarryTwoWeapons,
  effectiveDps,
  formatTime,
  starRulesText,
  weaponById,
} from "../game/data";
import { store, useSave, useStats } from "../game/save";
import { CurrencyChip, GameButton, StarRow, Tag, WeaponArt } from "../game/ui";
import type { LevelDef, Screen } from "../game/types";
import { cn } from "../utils/cn";

// ============================================================
// ТАКТИЧЕСКАЯ КАРТА ГОРОДА: цепочка из 10 районов (viewBox 1480x780)
// ============================================================

export default function WorldMapScreen({
  go,
  onStart,
  toast,
}: {
  go: (s: Screen) => void;
  onStart: (id: string) => void;
  toast: (msg: string) => void;
}) {
  const save = useSave();
  const stats = useStats();
  const weapon = weaponById(save.equippedWeapon);
  const sidearm = weaponById(save.weaponSlots.sidearm);
  const primary = weaponById(save.weaponSlots.primary);
  const stars = LEVELS.reduce((a, l) => a + (save.levels[l.id]?.stars ?? 0), 0);
  const cleared = LEVELS.filter((l) => save.levels[l.id]?.cleared).length;
  const [selectedId, setSelectedId] = useState(
    LEVELS.find((l) => save.levels[l.id]?.unlocked && !save.levels[l.id]?.cleared)?.id ?? "l1"
  );
  const level = LEVELS.find((l) => l.id === selectedId) ?? LEVELS[0];
  const progress = save.levels[level.id];
  const unlocked = progress?.unlocked;
  const dps = weapon ? effectiveDps(weapon, stats) + (primary && weapon !== primary ? 0 : 0) : 0;
  const totalAmmo = [sidearm, primary].reduce((a, w) => a + (w ? store.ammoOf(w.id) : 0), 0);
  const ready = dps >= level.recommendedDps;

  const launch = (l: LevelDef) => {
    if (!save.levels[l.id]?.unlocked) {
      toast(`🔒 Район закрыт. Сначала зачистите «${LEVELS.find((p) => p.id === l.unlockAfter)?.name}».`);
      return;
    }
    if (totalAmmo <= 0 && weapon && weapon.magSize > 0) {
      toast("Не хватает патронов: склад пуст. Купите пачки в оружейной «Гром».");
      return;
    }
    onStart(l.id);
  };

  return (
    <div className="mx-auto w-full max-w-[1420px] space-y-3 p-3">
      <header className="flex flex-wrap items-center justify-between gap-2 border-2 border-ash-700 bg-ash-900/95 px-3 py-2.5 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => go("hub")} className="border border-ash-600 px-3 py-1.5 text-[11px] text-ash-200 hover:border-rust-400">
            ← На базу
          </button>
          <div>
            <h1 className="pixel text-[11px] text-rust-50">КАРТА ЗАРАЖЁННОГО ГОРОДА</h1>
            <div className="text-[10px] uppercase tracking-widest text-ash-500">
              штаб обороны · зачищено {cleared}/{LEVELS.length} · {stars} ★
            </div>
          </div>
        </div>
        <CurrencyChip amount={save.currency} />
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* КАРТА */}
        <div className="tactical-grid scanline-box relative overflow-hidden border-2 border-ash-700 bg-[#141a17]">
          <svg viewBox="0 0 1480 780" className="block h-auto w-full">
            {/* фоновые кварталы */}
            <g fill="#1a211d" stroke="#242d27" strokeWidth="2">
              {[
                [60, 60, 300, 180], [420, 40, 340, 160], [820, 50, 280, 150], [1160, 60, 260, 170],
                [50, 300, 260, 200], [370, 280, 300, 190], [740, 260, 320, 200], [1120, 280, 300, 190],
                [80, 560, 320, 170], [460, 570, 340, 160], [860, 560, 300, 170], [1200, 540, 230, 180],
              ].map(([x, y, w, h], i) => (
                <rect key={i} x={x} y={y} width={w} height={h} rx={4} />
              ))}
            </g>
            {/* дороги между узлами */}
            {LEVELS.map((l) => {
              if (!l.unlockAfter) return null;
              const prev = LEVELS.find((p) => p.id === l.unlockAfter)!;
              const open = save.levels[l.id]?.unlocked;
              return (
                <line
                  key={l.id}
                  x1={prev.mapX}
                  y1={prev.mapY}
                  x2={l.mapX}
                  y2={l.mapY}
                  stroke={open ? "#b9764a" : "#3a443e"}
                  strokeWidth={4}
                  strokeDasharray={open ? "2 10" : "6 8"}
                  strokeLinecap="round"
                />
              );
            })}
            {/* узлы районов */}
            {LEVELS.map((l) => {
              const p = save.levels[l.id];
              const isSel = l.id === selectedId;
              const open = p?.unlocked;
              return (
                <g
                  key={l.id}
                  transform={`translate(${l.mapX}, ${l.mapY})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(l.id)}
                >
                  {isSel && <circle r={46} fill="none" stroke="#e7c55a" strokeWidth={2} strokeDasharray="5 7" className="anim-blink" />}
                  <circle
                    r={34}
                    fill={p?.cleared ? "#243024" : open ? "#2c241c" : "#191e1b"}
                    stroke={p?.cleared ? "#7f9c3a" : open ? "#b9764a" : "#3a443e"}
                    strokeWidth={3}
                  />
                  <text y={9} textAnchor="middle" fontSize={26}>{open ? l.icon : "🔒"}</text>
                  <text y={-44} textAnchor="middle" fontSize={13} fontWeight={800} fill={open ? "#d7cfa8" : "#5b6a67"}>
                    Р-{l.num}
                  </text>
                  {p?.cleared && (
                    <text y={54} textAnchor="middle" fontSize={13} fill="#e7c55a">
                      {"★".repeat(p.stars)}{"☆".repeat(3 - p.stars)}
                    </text>
                  )}
                  {l.boss && open && !p?.cleared && (
                    <text y={54} textAnchor="middle" fontSize={11} fill="#d13b2f" fontWeight={700}>
                      БОСС
                    </text>
                  )}
                </g>
              );
            })}
            {/* база */}
            <g transform="translate(70, 740)">
              <rect x={-14} y={-16} width={110} height={30} fill="#1c241f" stroke="#7f9c3a" strokeWidth={2} />
              <text x={40} y={4} textAnchor="middle" fontSize={13} fill="#b8d36a" fontWeight={700}>🏕 БАЗА B-7</text>
            </g>
          </svg>
        </div>

        {/* ПАНЕЛЬ РАЙОНА */}
        <aside className="flex flex-col gap-3">
          <div className="border-2 border-ash-700 bg-ash-900/95 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center border-2 border-ash-600 bg-ash-950 text-2xl">
                  {unlocked ? level.icon : "🔒"}
                </div>
                <div>
                  <div className="pixel text-[10px] leading-4 text-rust-50">{level.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ash-500">
                    Район {level.num} · {level.zone}
                  </div>
                </div>
              </div>
              <Tag tone="blood">☠ {level.danger}/10</Tag>
            </div>

            <p className="mt-2.5 text-[11px] leading-5 text-ash-300">{level.description}</p>

            <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="border border-ash-800 bg-ash-950/60 px-2 py-1.5">
                <span className="block text-[9px] uppercase text-ash-500">Волны</span>
                <span className="term text-lg text-ash-100">{level.waves}{level.boss ? " + босс" : ""}</span>
              </div>
              <div className="border border-ash-800 bg-ash-950/60 px-2 py-1.5">
                <span className="block text-[9px] uppercase text-ash-500">Награда</span>
                <span className="term text-lg text-toxic-300">{level.reward}+ ⚙</span>
              </div>
              <div className="border border-ash-800 bg-ash-950/60 px-2 py-1.5">
                <span className="block text-[9px] uppercase text-ash-500">Золото</span>
                <span className="term text-lg text-[#e7c55a]">{formatTime(level.goldTime)}</span>
              </div>
              <div className="border border-ash-800 bg-ash-950/60 px-2 py-1.5">
                <span className="block text-[9px] uppercase text-ash-500">Серебро</span>
                <span className="term text-lg text-ash-200">{formatTime(level.silverTime)}</span>
              </div>
            </div>

            {level.boss && (
              <div className="stripes-danger mt-2 border border-blood-400/60 px-2.5 py-1.5 text-[11px] font-bold text-red-200">
                ⚠ Босс района: {level.boss}
              </div>
            )}

            <div className="mt-2.5 space-y-1 text-[10px] text-ash-400">
              {starRulesText(level).map((rule) => (
                <div key={rule}>• {rule}</div>
              ))}
            </div>

            {progress?.cleared && (
              <div className="mt-2.5 flex items-center justify-between border border-ash-800 bg-ash-950/60 px-2.5 py-1.5">
                <StarRow stars={progress.stars} />
                <span className="text-[10px] text-ash-400">
                  рекорд: {progress.bestKills} убийств{progress.bestTime ? ` · ${formatTime(progress.bestTime)}` : ""}
                </span>
              </div>
            )}
          </div>

          {/* СНАРЯЖЕНИЕ ПЕРЕД РЕЙДОМ */}
          <div className="border-2 border-ash-700 bg-ash-900/95 p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-rust-200">Готовность отряда</div>
            {weapon && (
              <div className="flex items-center gap-2.5">
                <WeaponArt weapon={weapon} className="h-12 w-20" />
                <div className="min-w-0 flex-1 text-[11px]">
                  <div className="truncate font-bold text-ash-100">{weapon.name}</div>
                  <div className="text-ash-400">
                    DPS <b className={cn("term text-base", ready ? "text-toxic-300" : "text-red-300")}>{dps}</b>
                    <span className="text-ash-500"> / нужно {level.recommendedDps}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="border border-ash-800 bg-ash-950/60 py-1">
                <div className="text-ash-500">Патроны</div>
                <div className={cn("term text-base", totalAmmo > 0 ? "text-ash-100" : "text-red-300")}>{totalAmmo}</div>
              </div>
              <div className="border border-ash-800 bg-ash-950/60 py-1">
                <div className="text-ash-500">Гранаты</div>
                <div className="term text-base text-ash-100">{save.grenades}</div>
              </div>
              <div className="border border-ash-800 bg-ash-950/60 py-1">
                <div className="text-ash-500">Слоты</div>
                <div className="term text-base text-ash-100">{canCarryTwoWeapons(save.equipped.accessory) ? "2" : "1"}</div>
              </div>
            </div>
            {!ready && unlocked && (
              <div className="stripes-warn mt-2 border border-[#c9a74a]/60 px-2.5 py-1.5 text-[10px] font-semibold text-[#e7c55a]">
                DPS ниже рекомендованного. Можно идти, но будет жарко.
              </div>
            )}
            <GameButton
              variant={unlocked ? "primary" : "owned"}
              disabled={!unlocked}
              className="mt-2.5 w-full py-3 text-[13px]"
              onClick={() => launch(level)}
            >
              {unlocked ? `☣ Начать рейд · Р-${level.num}` : "🔒 Район закрыт"}
            </GameButton>
          </div>
        </aside>
      </div>
    </div>
  );
}
