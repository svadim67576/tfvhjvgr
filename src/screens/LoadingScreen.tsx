import { useEffect, useMemo, useState } from "react";

// ============================================================
// ЭКРАН ЗАГРУЗКИ: рваный стиль, прогресс-бар, случайные советы.
// Никогда не блокирует игру: страховый таймер всегда уводит дальше.
// ============================================================

const BOOT_TIPS = [
  "ПКМ — прицеливание: точность выше, но двигаться медленнее.",
  "Кувырок даёт неуязвимость. Пользуйся им, а не геройством.",
  "Стреляй с места: в движении разброс заметно выше.",
  "Красные бочки рвутся от любого выстрела — заводи орду в кучу.",
  "Толстяк после смерти оставляет кислотную лужу. Не стой в ней.",
  "Аптечка лечит треть здоровья. Не таскай её «на потом».",
  "Пробитие пули: револьвер и снайперка прошивают нескольких зомби.",
  "Рюкзак открывает второй слот оружия и больше гранат.",
  "Очки навыков падают после рейда: за зачистку, звёзды и убийства.",
  "Повтор без улучшения результата даёт вдвое меньше очков навыков.",
  "Звёзды дают время: уложился в золотое время — три звезды.",
  "Плевуны держат дистанцию — сбивай их одним точным выстрелом.",
  "Бегуны телеграфируют рывок дрожью. Их можно остановить выстрелом.",
  "В 5-м и 10-м районах ждут боссы. Береги патроны для них.",
  "Слушай выжившего: у него всегда есть слух о новом шоссе.",
];

const RAID_TIPS = [
  "Перезарядка (R) не тратит выносливость — делай её в передышку.",
  "Кувырок (SPACE) не отменяет перезарядку, но сбивает с прицела.",
  "Пистолетом в упор стрелять бесполезно — дробовик убьёт пятерых.",
  "Не жадничай с ящиком: вокруг всегда есть кто-то ещё.",
  "Граната в толпу бьёт сильнее, чем автомат в одиночку.",
  "Свет фонаря выдаёт тебя. На тёмных улицах иди боком.",
  "Элиты с красными глазами вдвое крепче. Бей их в голову.",
  "Скорость прицеливания растёт от навыка — прокачай в лобби.",
  "Смерть в рейде не отнимает награду, только очки навыков.",
  "Чистый залп в толпу — и сразу кувырок назад.",
];

function useTip(pool: string[]) {
  const tip = useMemo(() => pool[Math.floor(Math.random() * pool.length)], [pool]);
  return tip;
}

/** Плавная полоса с рваным краем и «заусенцами». */
function Bar({ value }: { value: number }) {
  return (
    <div className="load-bar">
      <div className="load-bar-fill" style={{ width: `${Math.max(2, Math.min(100, value))}%` }}>
        <i /><i /><i />
      </div>
    </div>
  );
}

export function BootLoading({ onDone, displayName }: { onDone: () => void; displayName?: string }) {
  const tip = useTip(BOOT_TIPS);
  const [value, setValue] = useState(4);

  useEffect(() => {
    let v = 4;
    const interval = window.setInterval(() => {
      // Идём к 100 с небольшими задержками, как реальная подготовка.
      const step = Math.max(2, (100 - v) * 0.09);
      v = Math.min(100, v + step);
      setValue(v);
    }, 70);
    // Страховка: экран уйдёт сам даже если что-то пойдёт не так.
    const guard = window.setTimeout(() => {
      setValue(100);
      window.setTimeout(onDone, 260);
    }, 2600);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(guard);
    };
  }, [onDone]);

  useEffect(() => {
    if (value >= 99.5) {
      const t = window.setTimeout(onDone, 320);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="load-screen" role="status" aria-label="Загрузка игры">
      <div className="load-sky" />
      <div className="load-silhouette" aria-hidden="true">
        <svg viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
          <g fill="#070b09">
            <path d="M0 260 L0 120 L70 120 L70 66 L96 66 L96 120 L150 120 L150 44 L166 36 L182 44 L182 260 Z" />
            <path d="M210 260 L210 150 L280 150 L280 96 L300 88 L320 96 L320 260 Z" />
            <path d="M350 260 L350 40 L362 30 L374 40 L374 260 Z" />
            <path d="M400 260 L400 170 L480 170 L480 120 L520 120 L520 260 Z" />
            <path d="M560 260 L560 70 L640 70 L640 30 L700 30 L700 70 L760 70 L760 260 Z" />
            <path d="M800 260 L800 140 L880 140 L880 96 L920 96 L920 260 Z" />
            <path d="M960 260 L960 56 L970 46 L980 56 L980 260 Z" />
            <path d="M1010 260 L1010 160 L1090 160 L1090 110 L1130 110 L1130 260 Z" />
            <path d="M1160 260 L1160 90 L1200 74 L1240 90 L1240 260 Z" />
            <path d="M1270 260 L1270 176 L1330 176 L1330 130 L1380 130 L1380 260 Z" />
          </g>
          {[{ x: 366, y: 70 }, { x: 604, y: 100 }, { x: 972, y: 90 }, { x: 1200, y: 130 }].map((w, i) => (
            <rect key={i} x={w.x} y={w.y} width="8" height="11" fill={i % 2 ? "#8a5a22" : "#2b241a"} className={i % 2 ? "anim-flicker" : ""} />
          ))}
        </svg>
      </div>

      <div className="load-core">
        <div className="load-eyebrow"><span className="anim-blink inline-block h-1.5 w-1.5 bg-blood-400" /> карантинная зона · день 47</div>
        <h1 className="load-logo">OUT<span>BREAK</span></h1>
        <div className="load-sub">{displayName ? `С возвращением, ${displayName}` : "Инициализация периметра B-7"}</div>
        <Bar value={value} />
        <div className="load-status">{Math.round(value)}% · {value < 35 ? "проверка периметра" : value < 70 ? "загрузка районов" : value < 95 ? "калибровка оружия" : "открываем ворота"}</div>
        <div className="load-tip"><b>СОВЕТ</b> {tip}</div>
      </div>
    </div>
  );
}

export function RaidLoading({
  levelName,
  levelIcon,
  danger,
  description,
  onDone,
}: {
  levelName: string;
  levelIcon: string;
  danger: number;
  description: string;
  onDone: () => void;
}) {
  const tip = useTip(RAID_TIPS);
  const [value, setValue] = useState(3);

  useEffect(() => {
    let v = 3;
    const interval = window.setInterval(() => {
      v = Math.min(100, v + Math.max(6, (100 - v) * 0.16));
      setValue(v);
    }, 60);
    // Короткий экран: 1.2–2 секунды, но всегда с гарантированным выходом.
    const guard = window.setTimeout(() => {
      setValue(100);
      window.setTimeout(onDone, 200);
    }, 1500);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(guard);
    };
  }, [onDone]);

  useEffect(() => {
    if (value >= 99.5) {
      const t = window.setTimeout(onDone, 240);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="load-screen" role="status" aria-label={`Подготовка к рейду: ${levelName}`}>
      <div className="load-sky" />
      <div className="load-core">
        <div className="load-eyebrow"><span className="anim-blink inline-block h-1.5 w-1.5 bg-blood-400" /> выдвижение к рейду</div>
        <div className="raid-load-card">
          <div className="raid-load-icon">{levelIcon}</div>
          <div className="min-w-0">
            <div className="raid-load-name">{levelName}</div>
            <div className="raid-load-desc">{description}</div>
            <div className="raid-load-danger">
              ОПАСНОСТЬ <b>{danger}</b>/10
              <span>{"█".repeat(danger)}<span className="dim">{"░".repeat(10 - danger)}</span></span>
            </div>
          </div>
        </div>
        <Bar value={value} />
        <div className="load-status">ПЕРЕБРОС СНАРЯЖЕНИЯ · {Math.round(value)}%</div>
        <div className="load-tip"><b>СОВЕТ</b> {tip}</div>
      </div>
    </div>
  );
}
