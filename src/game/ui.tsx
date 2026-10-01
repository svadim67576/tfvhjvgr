import type { ReactNode, CSSProperties } from "react";
import { cn } from "../utils/cn";
import { sfx } from "./audio";
import type { EquipmentSlot, Weapon } from "./types";

// ============================================================
// Общие UI-компоненты: тактические панели, кнопки, силуэты оружия
// и экипировки
// ============================================================

export function Panel({
  children,
  className,
  title,
  right,
  tone = "dark",
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  right?: ReactNode;
  tone?: "dark" | "rust" | "panel";
}) {
  return (
    <div
      className={cn(
        "relative border-2 border-ash-700 bg-ash-900/90 shadow-[0_4px_16px_rgba(0,0,0,0.6),0_0_0_2px_#0b0e0d]",
        tone === "rust" && "border-rust-500/80 bg-[#1b1512]",
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 border-b-2 border-ash-700 bg-gradient-to-r from-ash-850 via-ash-800/80 to-ash-850 px-3 py-2">
          <h3 className="pixel flex items-center gap-2 text-[9px] leading-4 tracking-tight text-rust-200 uppercase">
            <span className="inline-block h-2 w-2 bg-rust-400" />
            {title}
          </h3>
          {right}
        </div>
      )}
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

export function GameButton({
  children,
  onClick,
  variant = "default",
  disabled,
  className,
  title,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "buy" | "danger" | "ghost" | "owned";
  disabled?: boolean;
  className?: string;
  title?: string;
  icon?: ReactNode;
}) {
  const styles: Record<string, string> = {
    default:
      "bg-gradient-to-b from-ash-700 to-ash-800 border-ash-600 text-ash-100 hover:border-rust-400 hover:from-ash-600 hover:to-ash-700 hover:text-rust-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_0_#0b0e0d]",
    primary:
      "bg-gradient-to-b from-rust-400 to-rust-700 border-rust-200/70 text-rust-50 hover:from-[#d08a5c] hover:to-rust-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_0_#3e2110]",
    buy: "bg-gradient-to-b from-toxic-500/45 to-toxic-500/20 border-toxic-500 text-toxic-300 hover:from-toxic-500/60 hover:to-toxic-500/35 shadow-[inset_0_1px_0_rgba(184,211,106,0.25),0_2px_0_#1f2a12]",
    danger:
      "bg-gradient-to-b from-blood-500/45 to-blood-500/20 border-blood-400 text-red-100 hover:from-blood-500/65 hover:to-blood-500/35 shadow-[0_2px_0_#3a0d0a]",
    ghost: "bg-ash-950/60 border-ash-700 text-ash-400 hover:text-ash-100 hover:border-ash-500",
    owned: "bg-ash-800/40 border-ash-700 text-ash-500 cursor-not-allowed",
  };
  return (
    <button
      type="button"
      data-tone={variant}
      title={title}
      disabled={disabled}
      onClick={() => {
        if (!disabled) sfx.uiClick();
        onClick?.();
      }}
      className={cn(
        "ruined-btn relative inline-flex items-center justify-center gap-2 border-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-all hover:-translate-y-[1px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
        styles[variant],
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function CurrencyChip({
  amount,
  suffix,
  compact = false,
}: {
  amount: number;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 border-2 border-ash-600 bg-ash-950 px-3 py-1.5 shadow-inner">
      <span className="text-base leading-none">⚙️</span>
      <span className="term text-xl leading-5 text-toxic-300">{amount.toLocaleString("ru-RU")}</span>
      {!compact && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ash-400">
          {suffix ?? "лом"}
        </span>
      )}
    </div>
  );
}

export function StarRow({ stars, size = 16 }: { stars: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5" style={{ fontSize: size }}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "leading-none",
            i <= stars ? "text-[#e7c55a] drop-shadow-[0_0_4px_rgba(231,197,90,0.6)]" : "text-ash-700"
          )}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function StatBar({
  label,
  value,
  max,
  color = "#7f9c3a",
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  suffix?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-wider text-ash-400">
        <span>{label}</span>
        <span className="term text-base text-ash-200">
          {value.toLocaleString("ru-RU")}
          {suffix ?? ""}
        </span>
      </div>
      <div className="h-2.5 border border-ash-700 bg-ash-950 p-0.5">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function StatDelta({
  label,
  before,
  after,
  unit = "",
  invert = false,
}: {
  label: string;
  before: number;
  after: number;
  unit?: string;
  invert?: boolean;
}) {
  const diff = Number((after - before).toFixed(1));
  const better = invert ? diff < 0 : diff > 0;
  const worse = invert ? diff > 0 : diff < 0;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-ash-800/80 py-1 last:border-0">
      <span className="text-[11px] text-ash-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="term text-base text-ash-400">
          {before}
          {unit}
        </span>
        <span className="text-ash-600">→</span>
        <span
          className={cn(
            "term text-base font-bold",
            better && "text-toxic-300",
            worse && "text-blood-400",
            !better && !worse && "text-ash-300"
          )}
        >
          {after}
          {unit}
        </span>
        {diff !== 0 && (
          <span className={cn("min-w-[34px] text-right text-[10px] font-bold", better ? "text-toxic-300" : "text-blood-400")}>
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        )}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-3xl",
}: {
  open: boolean;
  onClose?: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className={cn("w-full border-2 border-rust-500 bg-ash-900 shadow-2xl", width)}>
        <div className="flex items-center justify-between border-b-2 border-ash-700 bg-ash-850 px-4 py-2.5">
          <h3 className="pixel text-[10px] text-rust-200 uppercase">{title}</h3>
          {onClose && (
            <button
              onClick={() => {
                sfx.uiClick();
                onClose();
              }}
              className="border border-ash-600 px-2 py-0.5 text-sm text-ash-400 hover:border-blood-400 hover:text-red-300"
            >
              ✕
            </button>
          )}
        </div>
        <div className="max-h-[82vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function Tag({
  children,
  tone = "ash",
}: {
  children: ReactNode;
  tone?: "ash" | "rust" | "toxic" | "blood" | "gold" | "blue";
}) {
  const tones: Record<string, string> = {
    ash: "border-ash-600 bg-ash-950/60 text-ash-300",
    rust: "border-rust-400 bg-rust-700/20 text-rust-200",
    toxic: "border-toxic-500 bg-toxic-500/15 text-toxic-300",
    blood: "border-blood-400 bg-blood-500/20 text-red-300",
    gold: "border-[#c9a74a] bg-[#c9a74a]/15 text-[#e7c55a]",
    blue: "border-[#4f7fa8] bg-[#4f7fa8]/15 text-[#8bbbe0]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

/** Рваная разрушенная кнопка главного меню */
export function RuinedButton({
  children,
  onClick,
  tone = "steel",
  size = "md",
  badge,
  subtitle,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "steel" | "rust";
  size?: "sm" | "md" | "lg";
  badge?: string;
  subtitle?: string;
  className?: string;
}) {
  const tones: Record<string, string> = {
    primary: "bg-gradient-to-b from-[#7e2c20] to-[#4d150e] text-rust-50 hover:from-[#a03a29]",
    steel: "bg-gradient-to-b from-ash-700 to-ash-850 text-ash-200 hover:from-ash-600 hover:text-ash-50",
    rust: "bg-gradient-to-b from-[#5c4426] to-[#3a2a16] text-rust-200 hover:from-[#75552e]",
  };
  return (
    <button
      type="button"
      data-tone={tone === "primary" ? "primary" : tone === "rust" ? "wood" : "default"}
      onClick={() => {
        sfx.uiClick();
        onClick?.();
      }}
      className={cn(
        "ruined drips relative px-5 text-left font-bold uppercase tracking-wide transition-all hover:-translate-y-[2px] active:translate-y-[1px]",
        size === "lg" ? "py-4 text-[14px]" : size === "sm" ? "py-2 text-[11px]" : "py-3 text-[12px]",
        tones[tone],
        className
      )}
    >
      <span className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.08)" }} />
      <span className="relative z-10 flex items-center justify-between gap-3">
        <span>
          {children}
          {subtitle && <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-normal opacity-70">{subtitle}</span>}
        </span>
        {badge && <span className="pixel shrink-0 bg-black/50 px-2 py-1 text-[8px] text-[#e7c55a]">{badge}</span>}
      </span>
    </button>
  );
}

export function RuinedTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ash-500">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ash-700" />
      {children}
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-ash-700" />
    </div>
  );
}

/** Заголовок экрана-магазина: вывеска + кассир + валюта + назад */
export function CounterHeader({
  title,
  clerk,
  onBack,
  currency,
  right,
}: {
  title: string;
  clerk: string;
  onBack: () => void;
  currency: number;
  right?: ReactNode;
}) {
  return (
    <header className="ruined-sm relative flex flex-wrap items-center justify-between gap-2 bg-[#17201b] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="pixel text-[11px] text-rust-200">{title}</span>
        <span className="hidden text-[11px] text-ash-400 sm:inline">{clerk}</span>
      </div>
      <div className="flex items-center gap-2">
        {right}
        <CurrencyChip amount={currency} compact />
        <button
          onClick={() => {
            sfx.uiClick();
            onBack();
          }}
          className="border border-ash-600 px-3 py-1.5 text-[11px] text-ash-200 hover:border-rust-400"
        >
          ← Назад
        </button>
      </div>
    </header>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <label className="ob-slider block">
      <div className="flex items-baseline justify-between text-[11px] text-ash-300">
        <span>{label}</span>
        <span className="term text-base text-toxic-300">{value}{suffix}</span>
      </div>
      <div className="ob-slider-track mt-2" style={{ "--ob-slider": `${percent}%` } as CSSProperties}>
        <span className="ob-slider-fill" style={{ width: `${percent}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </label>
  );
}

export function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => {
        sfx.uiClick();
        onChange(!value);
      }}
      className="flex w-full items-center justify-between gap-3 border border-ash-700 bg-ash-950/60 px-3 py-2 text-left hover:border-ash-500"
    >
      <span>
        <span className="block text-[12px] font-semibold text-ash-200">{label}</span>
        {hint && <span className="block text-[10px] text-ash-500">{hint}</span>}
      </span>
      <span
        className={cn(
          "pixel shrink-0 px-2 py-1 text-[8px]",
          value ? "bg-toxic-500/25 text-toxic-300" : "bg-ash-800 text-ash-500"
        )}
      >
        {value ? "ВКЛ" : "ВЫКЛ"}
      </span>
    </button>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ash-800 bg-ash-950/70 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-ash-500">{label}</div>
      <div className="term text-lg leading-5 text-ash-200">{value}</div>
    </div>
  );
}

// ============================================================
// Векторные силуэты оружия
// ============================================================
export function WeaponArt({ weapon, className = "h-14 w-24" }: { weapon: Weapon; className?: string }) {
  const c = weapon.color;
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border-2 border-ash-700 bg-gradient-to-br from-ash-950 via-[#151b19] to-ash-900",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${c}, transparent 75%)` }}
      />
      <svg viewBox="0 0 96 48" className="relative z-10 h-full w-full p-1 drop-shadow-[0_2px_0_rgba(0,0,0,0.85)]">
        {weapon.id === "w_pm17" && (
          <g>
            <rect x="26" y="18" width="34" height="9" fill={c} stroke="#111" strokeWidth="2" />
            <rect x="60" y="19.5" width="12" height="5" fill="#3d4947" stroke="#111" strokeWidth="1.5" />
            <path d="M30 27 L40 27 L37 40 L28 40 Z" fill="#5a4a38" stroke="#111" strokeWidth="2" />
            <rect x="42" y="26" width="7" height="5" fill="#222" />
          </g>
        )}
        {weapon.id === "w_obrez" && (
          <g>
            <path d="M12 22 L30 19 L30 29 L12 28 Z" fill="#6e4b2e" stroke="#111" strokeWidth="2" />
            <rect x="30" y="18" width="32" height="6" fill="#2f3835" stroke="#111" strokeWidth="2" />
            <rect x="30" y="25" width="26" height="5" fill={c} stroke="#111" strokeWidth="1.5" />
            <path d="M36 30 L44 30 L41 39 L34 39 Z" fill="#5a4a38" stroke="#111" strokeWidth="1.5" />
          </g>
        )}
        {weapon.id === "w_magnum" && (
          <g>
            <rect x="28" y="17" width="38" height="7" fill="#3d4947" stroke="#111" strokeWidth="2" />
            <circle cx="40" cy="27" r="6.5" fill={c} stroke="#111" strokeWidth="2" />
            <path d="M46 27 L54 27 L51 40 L43 40 Z" fill="#5a3b24" stroke="#111" strokeWidth="2" />
          </g>
        )}
        {weapon.id === "w_remington" && (
          <g>
            <path d="M8 21 L26 18 L26 28 L8 27 Z" fill="#6e4b2e" stroke="#111" strokeWidth="2" />
            <rect x="26" y="17" width="42" height="7" fill="#2f3835" stroke="#111" strokeWidth="2" />
            <rect x="34" y="25" width="24" height="6" fill={c} stroke="#111" strokeWidth="2" />
            <rect x="68" y="18.5" width="18" height="4" fill="#222" stroke="#111" strokeWidth="1.5" />
          </g>
        )}
        {weapon.id === "w_vihr" && (
          <g>
            <rect x="18" y="17" width="40" height="10" fill={c} stroke="#111" strokeWidth="2" />
            <rect x="58" y="19" width="16" height="5" fill="#222" stroke="#111" strokeWidth="1.5" />
            <path d="M28 27 L36 27 L33 38 L26 38 Z" fill="#2a3331" stroke="#111" strokeWidth="1.5" />
            <rect x="40" y="27" width="7" height="12" fill="#222" stroke="#111" strokeWidth="1.5" />
            <rect x="10" y="19" width="8" height="6" fill="#3d4947" stroke="#111" strokeWidth="1.5" />
          </g>
        )}
        {weapon.id === "w_ak74" && (
          <g>
            <path d="M6 20 L22 17 L22 27 L8 26 Z" fill="#6e4b2e" stroke="#111" strokeWidth="2" />
            <rect x="22" y="16" width="34" height="10" fill={c} stroke="#111" strokeWidth="2" />
            <rect x="56" y="18" width="22" height="6" fill="#3d4947" stroke="#111" strokeWidth="1.5" />
            <rect x="78" y="19.5" width="12" height="3.5" fill="#222" stroke="#111" strokeWidth="1.2" />
            <path d="M40 26 L48 26 L52 27 L58 42 L48 42 Z" fill="#b9764a" stroke="#111" strokeWidth="2" />
            <path d="M28 27 L35 27 L32 37 L25 37 Z" fill="#5a3b24" stroke="#111" strokeWidth="1.5" />
          </g>
        )}
        {weapon.id === "w_m4karat" && (
          <g>
            <path d="M8 18 L24 18 L24 28 L10 26 Z" fill="#2f3835" stroke="#111" strokeWidth="2" />
            <rect x="24" y="16" width="30" height="11" fill={c} stroke="#111" strokeWidth="2" />
            <rect x="33" y="11" width="14" height="5" fill="#1d2523" stroke="#8bbbe0" strokeWidth="1.2" />
            <rect x="54" y="17" width="20" height="7" fill="#3d4947" stroke="#111" strokeWidth="1.5" />
            <rect x="74" y="19" width="16" height="3.5" fill="#222" stroke="#111" strokeWidth="1.5" />
            <rect x="42" y="27" width="8" height="14" fill="#2a3331" stroke="#111" strokeWidth="1.5" />
            <path d="M27 27 L34 27 L31 37 L24 37 Z" fill="#222" stroke="#111" strokeWidth="1.5" />
          </g>
        )}
        {weapon.id === "w_barracuda" && (
          <g>
            <path d="M8 20 L24 18 L24 28 L8 29 Z" fill="#2a2d2c" stroke="#111" strokeWidth="2" />
            <rect x="24" y="15" width="36" height="12" fill={c} stroke="#111" strokeWidth="2" />
            <rect x="60" y="17" width="24" height="7" fill="#3b4240" stroke="#111" strokeWidth="2" />
            <circle cx="46" cy="33" r="9" fill="#3d4947" stroke="#111" strokeWidth="2" />
            <circle cx="46" cy="33" r="4" fill={c} />
          </g>
        )}
        {weapon.id === "w_svd" && (
          <g>
            <path d="M5 27 L24 19 L24 28 L9 34 Z" fill="#6e4b2e" stroke="#111" strokeWidth="2" />
            <rect x="24" y="18" width="28" height="8" fill="#3d4947" stroke="#111" strokeWidth="2" />
            <rect x="30" y="10" width="22" height="5" fill="#1c2422" stroke="#8bbbe0" strokeWidth="1.4" />
            <rect x="52" y="18" width="20" height="6" fill={c} stroke="#111" strokeWidth="1.5" />
            <rect x="72" y="19" width="21" height="3" fill="#222" stroke="#111" strokeWidth="1.5" />
            <rect x="40" y="26" width="8" height="9" fill="#2a3331" stroke="#111" strokeWidth="1.5" />
          </g>
        )}
        {weapon.id === "w_mjasorubka" && (
          <g>
            <path d="M6 20 L20 18 L20 29 L6 28 Z" fill="#2a2826" stroke="#111" strokeWidth="2" />
            <rect x="20" y="13" width="38" height="15" fill={c} stroke="#111" strokeWidth="2" />
            <rect x="58" y="15" width="28" height="4" fill="#5b6a67" stroke="#111" strokeWidth="1.5" />
            <rect x="58" y="20" width="28" height="4" fill="#3d4947" stroke="#111" strokeWidth="1.5" />
            <rect x="32" y="28" width="18" height="13" fill="#4c5c53" stroke="#111" strokeWidth="2" />
            <rect x="35" y="30" width="12" height="4" fill="#d8b571" />
          </g>
        )}
        {weapon.id === "w_knife_combat" && (
          <g>
            <rect x="18" y="21" width="18" height="6" rx="2" fill="#2b2d2b" stroke="#111" strokeWidth="2" />
            <rect x="36" y="18" width="4" height="12" fill="#5a4d3f" stroke="#111" strokeWidth="1.5" />
            <path d="M40 20 L76 20 L84 24 L76 27 L40 27 Z" fill="#dfe8e4" stroke="#111" strokeWidth="2" />
            <line x1="42" y1="24" x2="72" y2="24" stroke="#8fa39c" strokeWidth="1.5" />
          </g>
        )}
        {weapon.id === "w_machete_stalker" && (
          <g>
            <rect x="14" y="22" width="20" height="7" rx="2" fill="#654228" stroke="#111" strokeWidth="2" />
            <path d="M34 18 L76 16 L88 23 L80 32 L34 30 Z" fill="#cfdcd6" stroke="#111" strokeWidth="2" />
            <path d="M40 22 L72 20 L80 24 L74 27 L40 26 Z" fill="#758a82" opacity="0.6" />
          </g>
        )}
        {weapon.id === "w_axe_fire" && (
          <g>
            <rect x="12" y="22" width="58" height="6" rx="2" fill="#c47a32" stroke="#111" strokeWidth="2" />
            <rect x="56" y="11" width="14" height="28" fill="#2a2e2b" stroke="#111" strokeWidth="2" />
            <path d="M68 8 L86 4 L88 24 L68 22 Z" fill="#c9382b" stroke="#111" strokeWidth="2" />
            <path d="M56 18 L46 16 L44 26 L56 24 Z" fill="#889892" stroke="#111" strokeWidth="2" />
          </g>
        )}
      </svg>
      <span className="pixel absolute top-1 right-1 bg-black/70 px-1 py-0.5 text-[7px] text-ash-300">
        T{weapon.tier}
      </span>
    </div>
  );
}

export function EquipmentArt({
  slot,
  color,
  tier,
  className = "h-14 w-14",
}: {
  slot: EquipmentSlot;
  color: string;
  tier?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border-2 border-ash-700 bg-gradient-to-br from-ash-950 via-[#151b19] to-ash-900",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${color}, transparent 75%)` }}
      />
      <svg viewBox="0 0 48 48" className="relative z-10 h-full w-full p-1.5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)]">
        {slot === "head" && (
          <g>
            <path d="M10 28 C10 14, 38 14, 38 28 L42 32 L8 32 Z" fill={color} stroke="#111" strokeWidth="2.2" />
            <rect x="14" y="22" width="20" height="5" fill="#1d2523" opacity="0.7" />
          </g>
        )}
        {slot === "torso" && (
          <g>
            <path d="M14 10 L20 14 L28 14 L34 10 L40 18 L35 22 L35 39 L13 39 L13 22 L8 18 Z" fill={color} stroke="#111" strokeWidth="2.2" />
            <rect x="18" y="20" width="12" height="13" fill="#1d2523" opacity="0.55" stroke="#111" strokeWidth="1.2" />
          </g>
        )}
        {slot === "gloves" && (
          <g>
            <path d="M14 36 L14 20 L18 14 L22 14 L24 12 L28 12 L30 15 L34 18 L34 36 Z" fill={color} stroke="#111" strokeWidth="2.2" />
            <rect x="15" y="26" width="18" height="4" fill="#1d2523" opacity="0.6" />
          </g>
        )}
        {slot === "boots" && (
          <g>
            <path d="M14 12 L25 12 L25 27 L37 30 L37 37 L12 37 L12 28 Z" fill={color} stroke="#111" strokeWidth="2.2" />
            <rect x="12" y="34" width="25" height="4" fill="#1a1d1b" />
          </g>
        )}
        {slot === "accessory" && (
          <g>
            <rect x="12" y="13" width="24" height="25" rx="4" fill={color} stroke="#111" strokeWidth="2.2" />
            <rect x="16" y="22" width="16" height="11" fill="#1d2523" opacity="0.55" stroke="#111" strokeWidth="1.5" />
            <path d="M18 13 L18 9 L30 9 L30 13" fill="none" stroke="#8b9a96" strokeWidth="2" />
          </g>
        )}
      </svg>
      {tier && (
        <span className="pixel absolute top-0.5 right-0.5 bg-black/70 px-1 text-[7px] text-ash-300">
          T{tier}
        </span>
      )}
    </div>
  );
}
