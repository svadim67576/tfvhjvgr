import {
  EQUIPMENT_SLOTS,
  armorReduction,
  canCarryTwoWeapons,
  effectiveDps,
  equipmentById,
  grenadeCapacity,
  isMelee,
  isSidearm,
  shotDamage,
  weaponById,
  weaponPhysics,
} from "../game/data";
import { store, useSave, useStats } from "../game/save";
import { CounterHeader, EquipmentArt, GameButton, Panel, StatBar, Tag, WeaponArt } from "../game/ui";
import type { Screen, WeaponSlot } from "../game/types";
import { cn } from "../utils/cn";

// ============================================================
// СКЛАД: сводные статы, два слота оружия, арсенал и экипировка
// ============================================================

export default function InventoryScreen({
  go,
  toast,
}: {
  go: (s: Screen) => void;
  toast: (msg: string) => void;
}) {
  const save = useSave();
  const stats = useStats();
  const weapon = weaponById(save.equippedWeapon);
  const phys = weapon ? weaponPhysics(weapon) : null;
  const sidearm = weaponById(save.weaponSlots.sidearm);
  const primary = weaponById(save.weaponSlots.primary);
  const canSwap = canCarryTwoWeapons(save.equipped.accessory);
  const ownedWeapons = save.ownedWeapons.map((id) => weaponById(id)!).filter(Boolean);
  const ownedEquipment = save.ownedEquipment.map((id) => equipmentById(id)!).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-3">
      <CounterHeader title="СКЛАД СНАРЯЖЕНИЯ" clerk="Кладовщик Семёныч" onBack={() => go("hub")} currency={save.currency} />

      <div className="grid gap-3 lg:grid-cols-[390px_1fr]">
        <div className="space-y-3">
          {/* СВОДНЫЕ ХАРАКТЕРИСТИКИ */}
          <Panel title="Боец · сводка">
            <div className="space-y-2">
              <StatBar label="Здоровье" value={stats.maxHp} max={260} color="#7f9c3a" />
              <StatBar label={`Броня (−${armorReduction(stats.armor)}% урона)`} value={stats.armor} max={60} color="#8b9a96" />
              <StatBar label="Скорость" value={stats.speed} max={230} color="#5f8f8a" />
              <StatBar label="Множитель урона" value={stats.damagePct} max={140} color="#b9764a" suffix="%" />
              <StatBar label="Темп огня" value={stats.fireRatePct} max={140} color="#e7c55a" suffix="%" />
              <StatBar label="Бонус лома" value={stats.currencyPct} max={160} color="#b8d36a" suffix="%" />
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="border border-ash-800 bg-ash-950/60 py-1.5">
                <div className="text-ash-500">Убийств</div>
                <div className="term text-lg text-ash-100">{save.totalKills}</div>
              </div>
              <div className="border border-ash-800 bg-ash-950/60 py-1.5">
                <div className="text-ash-500">Рейдов</div>
                <div className="term text-lg text-ash-100">{save.runsPlayed}</div>
              </div>
              <div className="border border-ash-800 bg-ash-950/60 py-1.5">
                <div className="text-ash-500">Смертей</div>
                <div className="term text-lg text-red-300">{save.totalDeaths}</div>
              </div>
            </div>
          </Panel>

          {/* ДВА СЛОТА ОРУЖИЯ */}
          <Panel title="Слоты оружия" right={<Tag tone={canSwap ? "toxic" : "ash"}>{canSwap ? "Рюкзак надет" : "Нужен рюкзак"}</Tag>}>
            {weapon && phys ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {(["sidearm", "primary"] as const).map((slot: WeaponSlot) => {
                    const w = slot === "sidearm" ? sidearm : primary;
                    const active = save.activeWeaponSlot === slot;
                    const disabled = !w || (!canSwap && !active);
                    return (
                      <button
                        key={slot}
                        disabled={disabled}
                        onClick={() => {
                          if (store.selectWeaponSlot(slot)) toast(`🎽 Активен слот: ${slot === "sidearm" ? "запасной" : "основной"}.`);
                        }}
                        className={cn(
                          "border-2 px-2 py-2 text-left text-[11px]",
                          active ? "border-[#c9a74a] bg-[#1a1813]" : "border-ash-700 bg-ash-950/70",
                          disabled && !active && "opacity-50"
                        )}
                      >
                        <div className="text-[9px] uppercase tracking-wider text-ash-500">
                          [{slot === "sidearm" ? "1" : "2"}] {slot === "sidearm" ? "Запасной" : "Основной"}
                        </div>
                        <div className={cn("mt-0.5 truncate font-bold", active ? "text-[#e7c55a]" : "text-ash-200")}>
                          {w ? w.name : "— пусто —"}
                        </div>
                        {w && !isMelee(w) && (
                          <div className={cn("text-[10px]", store.ammoOf(w.id) === 0 ? "text-red-300" : "text-ash-400")}>
                            ▣ склад: {store.ammoOf(w.id)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!canSwap && (
                  <p className="text-[10px] leading-4 text-ash-500">
                    Без рюкзака можно нести только один активный ствол. Купите «Вещмешок» или «Тактический рюкзак» в
                    ателье Багрова, чтобы переключаться [1] / [2] в бою.
                  </p>
                )}
                <div className="flex items-center gap-3 border border-ash-800 bg-ash-950/60 p-2">
                  <WeaponArt weapon={weapon} className="h-14 w-24" />
                  <div className="min-w-0 text-[11px]">
                    <div className="truncate font-bold text-ash-100">{weapon.name}</div>
                    <div className="text-ash-400">{weapon.kind} · {phys.weightKg} кг</div>
                    <div className="text-ash-400">
                      Урон {shotDamage(weapon)} · {weapon.rpm} в/мин · DPS{" "}
                      <b className="term text-base text-[#e7c55a]">{effectiveDps(weapon, stats)}</b>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-ash-400">
                  ✴ Гранат на складе: {save.grenades} · в рейд возьмёте до {grenadeCapacity(save.equipped.accessory)} · бросок [G]
                </div>
                <GameButton className="w-full" onClick={() => go("weapons")}>
                  🔫 В оружейную лавку
                </GameButton>
              </div>
            ) : (
              <p className="text-[11px] text-ash-500">Слот пуст.</p>
            )}
          </Panel>

          {/* НАДЕТАЯ ЭКИПИРОВКА */}
          <Panel title="Надето">
            <div className="grid gap-1.5">
              {EQUIPMENT_SLOTS.map((s) => {
                const item = equipmentById(save.equipped[s.id]);
                return (
                  <div key={s.id} className="flex items-center gap-2 border border-ash-800 bg-ash-950/60 px-2 py-1.5">
                    <span className="text-base leading-none">{s.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] uppercase tracking-wider text-ash-500">{s.label}</div>
                      <div className={cn("truncate text-[11px] font-semibold", item ? "text-ash-100" : "text-ash-600")}>
                        {item ? item.name : "слот свободен"}
                      </div>
                    </div>
                    {item ? (
                      <button
                        onClick={() => {
                          store.unequipSlot(s.id);
                          toast(`Снято: ${item.name}.`);
                        }}
                        className="border border-ash-700 px-2 py-1 text-[10px] text-ash-400 hover:border-blood-400 hover:text-red-300"
                      >
                        снять
                      </button>
                    ) : (
                      <button onClick={() => go("equipment")} className="border border-ash-700 px-2 py-1 text-[10px] text-ash-400 hover:border-toxic-500 hover:text-toxic-300">
                        в ателье
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          {/* АРСЕНАЛ */}
          <Panel title={`Арсенал · ${ownedWeapons.length} ствол(ов)`}>
            <div className="grid gap-2 sm:grid-cols-2">
              {ownedWeapons.map((w) => {
                const eq = save.equippedWeapon === w.id;
                const assigned = save.weaponSlots[isSidearm(w) ? "sidearm" : "primary"] === w.id;
                const wPhys = weaponPhysics(w);
                return (
                  <div key={w.id} className={cn("flex gap-2.5 border-2 bg-ash-900/95 p-2", eq ? "border-[#c9a74a]" : "border-ash-700")}>
                    <WeaponArt weapon={w} className="h-14 w-24" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-bold text-ash-100">{w.name}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        <Tag tone="ash">{w.kind}</Tag>
                        <Tag tone="rust">{wPhys.weightKg} кг</Tag>
                        {eq && <Tag tone="gold">В руках</Tag>}
                        {assigned && !eq && <Tag tone="toxic">В слоте</Tag>}
                        {!isMelee(w) && <Tag tone={store.ammoOf(w.id) === 0 ? "blood" : "ash"}>▣ {store.ammoOf(w.id)}</Tag>}
                      </div>
                      {!eq && (
                        <button
                          onClick={() => {
                            if (store.equipWeapon(w.id)) toast(`🎽 «${w.name}» в руках.`);
                          }}
                          className="mt-1.5 border border-ash-600 px-2 py-0.5 text-[10px] text-ash-200 hover:border-rust-400"
                        >
                          взять в руки
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* КУПЛЕННАЯ ЭКИПИРОВКА */}
          <Panel title={`Склад брони · ${ownedEquipment.length} предм.`}>
            {ownedEquipment.length === 0 ? (
              <div className="space-y-2 text-[11px] text-ash-500">
                <p>Склад снаряжения пока пуст. Загляните в мастерскую Багрова перед вылазкой в город.</p>
                <GameButton onClick={() => go("equipment")}>🛡 Открыть мастерскую брони</GameButton>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {ownedEquipment.map((it) => {
                  const eq = save.equipped[it.slot] === it.id;
                  return (
                    <div key={it.id} className={cn("flex items-center gap-2.5 border-2 bg-ash-900/95 p-2", eq ? "border-toxic-500" : "border-ash-700")}>
                      <EquipmentArt slot={it.slot} color={it.color} tier={it.tier} className="h-11 w-11" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-bold text-ash-100">{it.name}</div>
                        <div className="text-[9px] uppercase tracking-wider text-ash-500">
                          {EQUIPMENT_SLOTS.find((s) => s.id === it.slot)?.label}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (eq) {
                            store.unequipSlot(it.slot);
                            toast(`Снято: ${it.name}.`);
                          } else if (store.equipItem(it.id)) {
                            toast(`🎽 Надето: ${it.name}.`);
                          }
                        }}
                        className={cn(
                          "border px-2 py-1 text-[10px]",
                          eq ? "border-ash-700 text-ash-400 hover:border-blood-400 hover:text-red-300" : "border-toxic-500/60 text-toxic-300 hover:border-toxic-500"
                        )}
                      >
                        {eq ? "снять" : "надеть"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
