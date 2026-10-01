import { useState } from "react";
import {
  AMMO_PACK_SIZE,
  WEAPONS,
  ammoPackPrice,
  canCarryTwoWeapons,
  effectiveDps,
  grenadeCapacity,
  isMelee,
  shotDamage,
  weaponById,
  weaponPhysics,
} from "../game/data";
import { GRENADE_PRICE, store, useSave, useStats } from "../game/save";
import { ammoPackYield } from "../game/skills";
import { CounterHeader, GameButton, Panel, StatBar, StatDelta, Tag, WeaponArt } from "../game/ui";
import type { Screen } from "../game/types";
import { cn } from "../utils/cn";

// ============================================================
// ОРУЖЕЙНАЯ ЛАВКА «ГРОМ»: витрина, физика стволов, патроны, гранаты
// ============================================================

export default function WeaponShopScreen({
  go,
  toast,
}: {
  go: (s: Screen) => void;
  toast: (msg: string) => void;
}) {
  const save = useSave();
  const stats = useStats();
  const equipped = weaponById(save.equippedWeapon);
  const [selectedId, setSelectedId] = useState<string>(save.equippedWeapon ?? WEAPONS[0].id);
  const sel = WEAPONS.find((w) => w.id === selectedId)!;
  const selPhys = weaponPhysics(sel);
  const eqPhys = equipped ? weaponPhysics(equipped) : null;
  const backpack = canCarryTwoWeapons(save.equipped.accessory);
  const grenadeLimit = grenadeCapacity(save.equipped.accessory);

  const owned = (id: string) => save.ownedWeapons.includes(id);
  const isEquipped = save.equippedWeapon === sel.id;

  const priceOf = (base: number) => store.priceFor(base);
  const ammoYield = ammoPackYield(AMMO_PACK_SIZE, save.skills);

  const buy = () => {
    if (owned(sel.id)) return;
    const price = priceOf(sel.price);
    if (save.currency < price) {
      toast(`Не хватает металлолома: нужно ${price} ⚙️, у вас ${save.currency} ⚙️.`);
      return;
    }
    if (store.buyWeapon(sel.id)) toast(`✅ Куплено: ${sel.name}. Оружие сохранено в арсенале.`);
  };

  const buyAmmo = () => {
    const price = priceOf(ammoPackPrice(sel));
    if (save.currency < price) {
      toast(`Не хватает металлолома: пачка стоит ${price} ⚙️.`);
      return;
    }
    if (store.buyAmmo(sel.id)) toast(`✅ +${ammoYield} патронов для «${sel.name}».`);
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-3">
      <CounterHeader
        title="ОРУЖЕЙНАЯ «ГРОМ»"
        clerk="Гром · оружейник"
        onBack={() => go("hub")}
        currency={save.currency}
        right={
          <button
            disabled={save.currency < priceOf(GRENADE_PRICE) || save.grenades >= grenadeLimit}
            onClick={() => {
              if (store.buyGrenades()) toast("✅ Граната помещена на пояс.");
            }}
            className="hidden border border-rust-400/60 bg-[#4c3026] px-2.5 py-1.5 font-mono text-[10px] text-rust-50 hover:border-[#e7c55a] disabled:opacity-50 sm:block"
            title={`Купить гранату за ${priceOf(GRENADE_PRICE)} металлолома. На складе ${save.grenades}, в рейде до ${grenadeLimit}`}
          >
            ✴ ГРАНАТА +{priceOf(GRENADE_PRICE)} ⚙ · {save.grenades} шт.
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ash-700 px-1 pb-2 text-[11px] text-ash-400">
        <span>Выберите оружие и сравните его с текущим. Нажмите «Взять в руки» после покупки.</span>
        <span className="text-toxic-300">{backpack ? "Рюкзак: 2 ствола / клавиши 1, 2" : "Без рюкзака: один ствол в рейде"}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_420px]">
        {/* ВИТРИНА */}
        <div className="grid gap-2 sm:grid-cols-2">
          {WEAPONS.map((w) => {
            const isSel = w.id === sel.id;
            const has = owned(w.id);
            const eq = save.equippedWeapon === w.id;
            const phys = weaponPhysics(w);
            const canBuy = !has && save.currency >= priceOf(w.price);
            return (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className={cn(
                  "ruined-sm flex gap-3 border-2 bg-ash-900/95 p-2.5 text-left transition-all",
                  isSel ? "border-[#c9a74a] bg-[#1a1813] shadow-[0_0_16px_rgba(201,167,74,0.2)]" : "border-ash-700 hover:border-ash-500"
                )}
              >
                <WeaponArt weapon={w} className="h-16 w-28" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[12px] font-bold text-ash-100">{w.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Tag tone="ash">{w.kind}</Tag>
                    <Tag tone="rust">{phys.weightKg} кг</Tag>
                    {eq && <Tag tone="toxic">В руках</Tag>}
                    {has && !isMelee(w) && <Tag tone={store.ammoOf(w.id) === 0 ? "blood" : "gold"}>▣ {store.ammoOf(w.id)}</Tag>}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className={cn("term text-base", has ? "text-ash-400" : canBuy ? "text-toxic-300" : "text-red-300")}>
                      {has ? "В АРСЕНАЛЕ" : `${priceOf(w.price)} ⚙️`}
                    </span>
                    <span className="text-ash-400">
                      DPS <b className="term text-base text-[#e7c55a]">{effectiveDps(w, stats)}</b>
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* КАРТОЧКА ВЫБРАННОГО СТВОЛА */}
        <div className="space-y-3">
          <Panel title="Тактико-технические данные" right={<Tag tone="rust">Масса {selPhys.weightKg} кг</Tag>}>
            <div className="flex items-start gap-3">
              <WeaponArt weapon={sel} className="h-20 w-36" />
              <div className="min-w-0">
                <h3 className="pixel text-[10px] leading-5 text-rust-50">{sel.name}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Tag tone="ash">{sel.kind}</Tag>
                  <Tag tone="blue">Дальность {Math.round(sel.range / 32)} тайлов</Tag>
                  {(sel.pierce ?? 1) > 1 && <Tag tone="gold">Пробитие ×{sel.pierce}</Tag>}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-ash-300">{sel.note}</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatCell label="Урон выстрела" value={sel.pellets > 1 ? `${sel.damage} × ${sel.pellets} (${shotDamage(sel)})` : shotDamage(sel)} />
              <StatCell label="Темп стрельбы" value={`${sel.rpm} в/мин`} />
              <StatCell label="Магазин" value={isMelee(sel) ? "не требуется" : `${sel.magSize} патр.`} />
              <StatCell label="Перезарядка" value={isMelee(sel) ? "—" : `${sel.reloadTime.toFixed(1)} с`} />
            </div>

            <div className="mt-3 space-y-2 border border-ash-700 bg-ash-950 p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rust-200">Физика и баллистика ствола</div>
              <StatBar label="Останавливающая сила (отброс и сбитие шага)" value={selPhys.stoppingRating} max={100} color="#7f9c3a" suffix="%" />
              <StatBar label="Импульс отдачи в плечо и подброс" value={selPhys.recoilRating} max={100} color="#b9764a" suffix="%" />
              <div className="flex justify-between pt-1 text-[11px] text-ash-400">
                <span>Влияние веса на скорость бега:</span>
                <span className={cn("font-mono font-bold", sel.moveSpeedMod < 0 ? "text-red-300" : sel.moveSpeedMod > 0 ? "text-toxic-300" : "text-ash-300")}>
                  {sel.moveSpeedMod > 0 ? "+" : ""}{sel.moveSpeedMod}%
                </span>
              </div>
            </div>

            {/* Сравнение с текущим */}
            {equipped && equipped.id !== sel.id && eqPhys && (
              <div className="mt-3 border border-ash-700 bg-ash-950 p-2.5">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-rust-200">
                  Сравнение с «{equipped.name}»
                </div>
                <StatDelta label="DPS" before={effectiveDps(equipped, stats)} after={effectiveDps(sel, stats)} />
                <StatDelta label="Урон залпа" before={shotDamage(equipped)} after={shotDamage(sel)} />
                <StatDelta label="Дальность (тайлы)" before={Math.round(equipped.range / 32)} after={Math.round(sel.range / 32)} />
                <StatDelta label="Магазин" before={equipped.magSize} after={sel.magSize} />
                <StatDelta label="Отдача" before={eqPhys.recoilRating} after={selPhys.recoilRating} invert />
                <StatDelta label="Вес, кг" before={eqPhys.weightKg} after={selPhys.weightKg} invert />
              </div>
            )}

            <div className="mt-3 grid gap-2">
              {!owned(sel.id) ? (
                <GameButton variant={save.currency >= priceOf(sel.price) ? "buy" : "owned"} disabled={save.currency < priceOf(sel.price)} onClick={buy} className="py-2.5">
                  🛒 Купить за {priceOf(sel.price)} ⚙️
                </GameButton>
              ) : (
                <GameButton
                  variant={isEquipped ? "owned" : "primary"}
                  disabled={isEquipped}
                  onClick={() => {
                    if (store.equipWeapon(sel.id)) toast(`🎽 «${sel.name}» теперь в руках.`);
                  }}
                  className="py-2.5"
                >
                  {isEquipped ? "✔ Уже в руках" : "🎽 Взять в руки"}
                </GameButton>
              )}
              {!isMelee(sel) && owned(sel.id) && (
                <GameButton variant="buy" onClick={buyAmmo} className="py-2">
                  ▣ Пачка {ammoYield} патр. — {priceOf(ammoPackPrice(sel))} ⚙️ · на складе {store.ammoOf(sel.id)}
                </GameButton>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-ash-800 bg-ash-950/70 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-ash-500">{label}</div>
      <div className="term text-lg text-ash-200">{value}</div>
    </div>
  );
}
