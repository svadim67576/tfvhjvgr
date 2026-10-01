import { useState } from "react";
import {
  EQUIPMENT_SLOTS,
  armorReduction,
  computeStats,
  equipmentById,
  getEquipmentForSlot,
} from "../game/data";
import { store, useSave, useStats } from "../game/save";
import { CounterHeader, EquipmentArt, GameButton, Panel, StatDelta, Tag } from "../game/ui";
import type { EquipmentSlot, Screen } from "../game/types";
import { cn } from "../utils/cn";

// ============================================================
// АТЕЛЬЕ БАГРОВА: броня и снаряжение по 5 слотам с примеркой
// ============================================================

const MOD_LABELS: Record<string, [string, string]> = {
  maxHp: ["HP", ""],
  armor: ["Броня", ""],
  speedPct: ["Скорость", "%"],
  damagePct: ["Урон", "%"],
  fireRatePct: ["Темп огня", "%"],
  currencyPct: ["Лом", "%"],
};

export default function EquipmentShopScreen({
  go,
  toast,
}: {
  go: (s: Screen) => void;
  toast: (msg: string) => void;
}) {
  const save = useSave();
  const stats = useStats();
  const [slot, setSlot] = useState<EquipmentSlot>("head");
  const [selectedId, setSelectedId] = useState<string>(getEquipmentForSlot("head")[0].id);
  const items = getEquipmentForSlot(slot);
  const sel = equipmentById(selectedId) && equipmentById(selectedId)!.slot === slot ? equipmentById(selectedId)! : items[0];
  const owned = save.ownedEquipment.includes(sel.id);
  const equipped = save.equipped[sel.slot] === sel.id;

  // примерка: статы, если надеть выбранное
  const tryIds = { ...save.equipped, [sel.slot]: sel.id };
  const tryStats = computeStats(Object.values(tryIds));
  const priceOf = (base: number) => store.priceFor(base);

  const buy = () => {
    if (owned) return;
    const price = priceOf(sel.price);
    if (save.currency < price) {
      toast(`Не хватает металлолома: нужно ${price} ⚙️, у вас ${save.currency} ⚙️.`);
      return;
    }
    if (store.buyEquipment(sel.id)) toast(`✅ Куплено: ${sel.name}.`);
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-3">
      <CounterHeader title="АТЕЛЬЕ БАГРОВА" clerk="Багров · портной-бронник" onBack={() => go("hub")} currency={save.currency} />

      {/* Вкладки слотов */}
      <div className="flex flex-wrap gap-1.5">
        {EQUIPMENT_SLOTS.map((s) => {
          const current = equipmentById(save.equipped[s.id]);
          return (
            <button
              key={s.id}
              onClick={() => {
                setSlot(s.id);
                setSelectedId(getEquipmentForSlot(s.id)[0].id);
              }}
              className={cn(
                "flex items-center gap-2 border-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide",
                slot === s.id ? "border-[#c9a74a] bg-[#1a1813] text-[#e7c55a]" : "border-ash-700 bg-ash-900 text-ash-400 hover:border-ash-500"
              )}
            >
              <span className="text-base leading-none">{s.icon}</span>
              {s.label}
              {current && <span className="ml-1 inline-block h-2 w-2 bg-toxic-500" title={current.name} />}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_400px]">
        {/* ВИТРИНА СЛОТА */}
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((it) => {
            const has = save.ownedEquipment.includes(it.id);
            const eq = save.equipped[it.slot] === it.id;
            const isSel = it.id === sel.id;
            const canBuy = !has && save.currency >= priceOf(it.price);
            return (
              <button
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                className={cn(
                  "ruined-sm flex gap-3 border-2 bg-ash-900/95 p-2.5 text-left transition-all",
                  isSel ? "border-[#c9a74a] bg-[#1a1813]" : "border-ash-700 hover:border-ash-500"
                )}
              >
                <EquipmentArt slot={it.slot} color={it.color} tier={it.tier} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-bold text-ash-100">{it.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(it.mods).map(([key, value]) => {
                      const [label, unit] = MOD_LABELS[key] ?? [key, ""];
                      return (
                        <Tag key={key} tone={(value as number) > 0 ? "toxic" : "blood"}>
                          {label} {(value as number) > 0 ? "+" : ""}{value}{unit}
                        </Tag>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className={cn("term text-base", has ? "text-ash-400" : canBuy ? "text-toxic-300" : "text-red-300")}>
                      {has ? "КУПЛЕНО" : `${priceOf(it.price)} ⚙️`}
                    </span>
                    {eq && <Tag tone="toxic">Надето</Tag>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ПРИМЕРОЧНАЯ */}
        <div className="space-y-3">
          <Panel title="Примерочная" right={<Tag tone="rust">T{sel.tier}</Tag>}>
            <div className="flex items-start gap-3">
              <EquipmentArt slot={sel.slot} color={sel.color} tier={sel.tier} className="h-20 w-20" />
              <div className="min-w-0">
                <h3 className="pixel text-[10px] leading-5 text-rust-50">{sel.name}</h3>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-ash-500">
                  {EQUIPMENT_SLOTS.find((s) => s.id === sel.slot)?.label}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-ash-300">{sel.note}</p>

            <div className="mt-3 border border-ash-700 bg-ash-950 p-2.5">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-rust-200">Если надеть</div>
              <StatDelta label="Здоровье" before={stats.maxHp} after={tryStats.maxHp} />
              <StatDelta label="Броня" before={stats.armor} after={tryStats.armor} />
              <StatDelta label="Снижение урона" before={armorReduction(stats.armor)} after={armorReduction(tryStats.armor)} unit="%" />
              <StatDelta label="Скорость" before={stats.speed} after={tryStats.speed} />
              <StatDelta label="Урон" before={stats.damagePct} after={tryStats.damagePct} unit="%" />
              <StatDelta label="Темп огня" before={stats.fireRatePct} after={tryStats.fireRatePct} unit="%" />
              <StatDelta label="Бонус лома" before={stats.currencyPct} after={tryStats.currencyPct} unit="%" />
            </div>

            <div className="mt-3 grid gap-2">
              {!owned ? (
                <GameButton variant={save.currency >= priceOf(sel.price) ? "buy" : "owned"} disabled={save.currency < priceOf(sel.price)} onClick={buy} className="py-2.5">
                  🛒 Купить за {priceOf(sel.price)} ⚙️
                </GameButton>
              ) : (
                <GameButton
                  variant={equipped ? "owned" : "primary"}
                  disabled={equipped}
                  onClick={() => {
                    if (store.equipItem(sel.id)) toast(`🎽 Надето: ${sel.name}.`);
                  }}
                  className="py-2.5"
                >
                  {equipped ? "✔ Уже надето" : "🎽 Надеть"}
                </GameButton>
              )}
              {equipped && (
                <GameButton
                  variant="ghost"
                  onClick={() => {
                    store.unequipSlot(sel.slot);
                    toast(`Снято: ${sel.name}.`);
                  }}
                >
                  Снять
                </GameButton>
              )}
            </div>
          </Panel>

          <Panel title="Текущий комплект">
            <div className="grid gap-1.5">
              {EQUIPMENT_SLOTS.map((s) => {
                const item = equipmentById(save.equipped[s.id]);
                return (
                  <div key={s.id} className="flex items-center justify-between border border-ash-800 bg-ash-950/60 px-2.5 py-1.5 text-[11px]">
                    <span className="text-ash-400">
                      {s.icon} {s.label}
                    </span>
                    <span className={item ? "font-semibold text-ash-100" : "text-ash-600"}>{item ? item.name : "пусто"}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
