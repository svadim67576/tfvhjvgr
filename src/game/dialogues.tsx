import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { sfx } from "./audio";

// ============================================================
// Кинематографичные диалоги: затемнение сцены, наезд на портрет,
// печатная машинка, варианты ответа игрока с последствиями.
// ============================================================

export type Mood = "neutral" | "warm" | "grim" | "tense" | "greed" | "tired" | "mad";

export interface NpcPortrait {
  skin: string;
  hair: string;
  cloth: string;
  accent: string;
  hat?: "cap" | "helm" | "beanie" | "bandage" | "none";
  scar?: boolean;
  beard?: boolean;
}

export interface DialogueNode {
  /** Реплика NPC. */
  say: string;
  /** Настроение сцены: красит подсветку, качает камеру, меняет эмбиент. */
  mood?: Mood;
  /** Варианты ответа игрока. */
  choices?: { text: string; next?: number; effect?: DialogueEffect; hint?: string }[];
}

export interface DialogueEffect {
  /** Скидка в оружейной/броне, например −12%. */
  discount?: number;
  /** Открыть особый товар: id снаряжения. */
  unlockItem?: string;
  /** Отношение к игроку, −2..+2. */
  mood?: number;
  /** Текст системного отклика после выбора. */
  note?: string;
}

export interface NpcScript {
  id: string;
  name: string;
  role: string;
  portrait: NpcPortrait;
  mood: Mood;
  ambient: "wind" | "hum" | "groan" | "camp";
  root: DialogueNode[];
}

const MOOD_STYLE: Record<Mood, { tint: string; shake: number; glow: string; dim: string }> = {
  neutral: { tint: "rgba(150,160,150,0.10)", shake: 0, glow: "rgba(231,225,200,0.16)", dim: "rgba(4,7,6,0.72)" },
  warm: { tint: "rgba(210,150,80,0.14)", shake: 0, glow: "rgba(255,214,150,0.22)", dim: "rgba(10,6,3,0.70)" },
  grim: { tint: "rgba(90,105,95,0.14)", shake: 0, glow: "rgba(160,180,170,0.14)", dim: "rgba(3,6,6,0.78)" },
  tense: { tint: "rgba(150,40,30,0.16)", shake: 5, glow: "rgba(230,90,60,0.24)", dim: "rgba(8,3,2,0.80)" },
  greed: { tint: "rgba(170,130,40,0.14)", shake: 1.5, glow: "rgba(231,197,90,0.26)", dim: "rgba(7,5,2,0.74)" },
  tired: { tint: "rgba(110,120,130,0.12)", shake: 0, glow: "rgba(180,200,210,0.12)", dim: "rgba(5,6,8,0.76)" },
  mad: { tint: "rgba(180,60,40,0.18)", shake: 8, glow: "rgba(255,110,70,0.26)", dim: "rgba(10,3,2,0.82)" },
};

/** Портрет NPC: рисованный в стиле игры, без внешних картинок. */
function NpcFace({ p, talking, mood }: { p: NpcPortrait; talking: boolean; mood: Mood }) {
  const style = MOOD_STYLE[mood];
  return (
    <svg viewBox="0 0 120 150" className="npc-face" aria-hidden="true">
      <ellipse cx="60" cy="146" rx="46" ry="12" fill="rgba(0,0,0,0.45)" />
      {/* плечи */}
      <path d="M18 150 Q22 112 60 108 Q98 112 102 150 Z" fill={p.cloth} />
      <path d="M44 112 L60 128 L76 112 L82 150 L38 150 Z" fill={p.accent} opacity="0.85" />
      {/* шея и голова */}
      <rect x="50" y="92" width="20" height="18" fill={p.skin} />
      <ellipse cx="60" cy="70" rx="27" ry="32" fill={p.skin} />
      {/* тень скулы */}
      <path d="M60 38 Q84 46 84 72 Q84 100 60 102 Q74 76 60 38 Z" fill="rgba(0,0,0,0.16)" />
      {/* волосы */}
      {p.hat === "none" ? (
        <path d="M33 62 Q34 34 60 32 Q86 34 87 62 Q76 50 60 48 Q44 50 33 62 Z" fill={p.hair} />
      ) : (
        <g>
          <path d="M30 60 Q30 26 60 24 Q90 26 90 60 L84 62 Q82 44 60 42 Q38 44 36 62 Z" fill={p.hair} />
          {p.hat === "cap" && <path d="M28 58 Q60 34 92 58 L92 64 Q60 46 28 64 Z" fill={p.accent} />}
          {p.hat === "helm" && (
            <g>
              <path d="M28 62 Q28 22 60 22 Q92 22 92 62 Z" fill={p.accent} />
              <rect x="24" y="58" width="72" height="7" rx="3" fill={p.accent} />
              <rect x="44" y="44" width="32" height="7" rx="3" fill="#0f1413" opacity="0.8" />
            </g>
          )}
          {p.hat === "beanie" && <path d="M32 56 Q32 30 60 30 Q88 30 88 56 Z" fill={p.accent} />}
          {p.hat === "bandage" && <path d="M33 58 Q36 34 60 34 Q84 34 87 58 L82 60 Q78 44 60 44 Q42 44 38 60 Z" fill="#d8d2c0" />}
        </g>
      )}
      {p.beard && <path d="M44 84 Q60 106 76 84 Q74 100 60 102 Q46 100 44 84 Z" fill={p.hair} opacity="0.9" />}
      {/* глаза */}
      <g className={cn("npc-eyes", talking && "talking")}>
        <ellipse cx="49" cy="68" rx="5.5" ry="3.4" fill="#f0ead8" />
        <ellipse cx="71" cy="68" rx="5.5" ry="3.4" fill="#f0ead8" />
        <circle cx="50" cy="68" r="2.3" fill="#1a1512" />
        <circle cx="72" cy="68" r="2.3" fill="#1a1512" />
        <path d="M42 60 q7 -4 14 -1" stroke="rgba(0,0,0,0.5)" strokeWidth="2" fill="none" />
        <path d="M64 59 q7 -3 14 1" stroke="rgba(0,0,0,0.5)" strokeWidth="2" fill="none" />
      </g>
      {/* шрам */}
      {p.scar && <path d="M78 50 l-6 16 l4 3 l6 -16 z" fill="#8e3a2c" opacity="0.75" />}
      {/* рот: реплика идёт — рот открыт */}
      {talking ? (
        <ellipse cx="60" cy="88" rx="7" ry="5" fill="#4a1f18" />
      ) : (
        <path d="M52 88 q8 4 16 0" stroke="rgba(0,0,0,0.55)" strokeWidth="2" fill="none" />
      )}
      {/* подсветка говорящего */}
      <ellipse cx="60" cy="76" rx="34" ry="42" fill={style.glow} opacity={talking ? 0.55 : 0.14} />
    </svg>
  );
}

interface Props {
  script: NpcScript;
  onClose: () => void;
  /** Возвращает применённые эффекты, чтобы лобби их зафиксировало. */
  onEffects?: (effects: DialogueEffect[]) => void;
  /** Отношения NPC к игроку, −2..+2. */
  rapport?: number;
}

export default function DialogueScene({ script, onClose, onEffects, rapport = 0 }: Props) {
  const [nodeIdx, setNodeIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [entered, setEntered] = useState(false);
  const [shake, setShake] = useState(0);
  const effectsRef = useRef<DialogueEffect[]>([]);
  const timerRef = useRef<number | null>(null);

  const node = script.root[Math.min(nodeIdx, script.root.length - 1)];
  const mood = node.mood ?? script.mood;
  const style = MOOD_STYLE[mood];
  const full = node.say;

  useEffect(() => {
    setEntered(false);
    const t = window.setTimeout(() => setEntered(true), 30);
    return () => window.clearTimeout(t);
  }, [nodeIdx]);

  useEffect(() => {
    setTyped("");
    let i = 0;
    const tick = () => {
      i += 2;
      setTyped(full.slice(0, i));
      if (i < full.length) timerRef.current = window.setTimeout(tick, 16);
    };
    timerRef.current = window.setTimeout(tick, 120);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [full, nodeIdx]);

  useEffect(() => {
    if (!style.shake) { setShake(0); return; }
    const t = window.setTimeout(() => setShake(style.shake), 0);
    return () => window.clearTimeout(t);
  }, [style.shake]);

  // Сцена реагирует на настроение коротким звуком и лёгкой тряской.
  useEffect(() => {
    if (!entered) return;
    if (mood === "tense" || mood === "mad") { sfx.dryFire(); setShake(style.shake); }
    else if (mood === "warm" || mood === "greed") sfx.uiConfirm();
    else sfx.uiClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIdx, entered]);

  const finish = () => {
    onEffects?.(effectsRef.current);
    onClose();
  };

  const pick = (index: number) => {
    const choice = node.choices?.[index];
    if (!choice || chosen !== null) return;
    setChosen(index);
    sfx.uiClick();
    if (choice.effect) {
      effectsRef.current.push(choice.effect);
      if (choice.effect.note) setNote(choice.effect.note);
    }
    if (choice.next !== undefined) {
      window.setTimeout(() => { setChosen(null); setNodeIdx(choice.next!); }, 620);
    } else {
      window.setTimeout(finish, choice.effect?.note ? 1600 : 480);
    }
  };

  const skipTyping = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setTyped(full);
  };

  const done = typed.length >= full.length;
  const rapportLabel = rapport > 1 ? "свой" : rapport > 0 ? "знакомый" : rapport < -1 ? "чужак" : rapport < 0 ? "насторожен" : "нейтрально";

  return (
    <div className="dialogue-root" role="dialog" aria-label={`Диалог: ${script.name}`}>
      <div
        className="dialogue-scene"
        style={{
          background: `radial-gradient(120% 90% at 22% 40%, ${style.dim} 0%, rgba(2,4,4,0.94) 70%)`,
          transform: shake ? `translate(${Math.sin(Date.now() / 40) * shake}px, ${Math.cos(Date.now() / 33) * shake * 0.6}px)` : undefined,
        }}
      >
        <div className="dialogue-vignette" style={{ background: style.tint }} />

        <div className="dialogue-portrait" style={{ animation: "dialogue-zoom 1.1s cubic-bezier(.2,.7,.2,1) both" }}>
          <NpcFace p={script.portrait} talking={done} mood={mood} />
          <div className="dialogue-names">
            <div className="dialogue-name">{script.name}</div>
            <div className="dialogue-role">{script.role} · отношение: {rapportLabel}</div>
          </div>
        </div>

        <div className="dialogue-side">
          <div className="dialogue-ambient" data-ambient={script.ambient}>
            {script.ambient === "wind" && "🌬 ветер за стеной"}
            {script.ambient === "hum" && "📻 гул генератора"}
            {script.ambient === "groan" && "🩸 стоны снаружи"}
            {script.ambient === "camp" && "🔥 треск костра"}
          </div>

          <div className={cn("dialogue-line", entered && "in")} onClick={skipTyping}>
            {!done && <span className="dialogue-caret" />}
            {typed}
          </div>

          {note && <div className="dialogue-note">{note}</div>}

          {done && node.choices && node.choices.length > 0 && (
            <div className={cn("dialogue-choices", entered && "in")}>
              {node.choices.map((choice, i) => (
                <button
                  key={choice.text}
                  type="button"
                  className={cn("dialogue-choice", chosen === i && "picked", chosen !== null && chosen !== i && "dim")}
                  disabled={chosen !== null}
                  onClick={() => pick(i)}
                >
                  <span className="dialogue-choice-mark">▸</span>
                  <span className="dialogue-choice-text">{choice.text}</span>
                  {choice.hint && <span className="dialogue-choice-hint">{choice.hint}</span>}
                </button>
              ))}
            </div>
          )}

          {done && (!node.choices || node.choices.length === 0) && (
            <button type="button" className="dialogue-close" onClick={finish}>
              Завершить разговор →
            </button>
          )}

          <button type="button" className="dialogue-skip" onClick={finish}>
            Esc · уйти
          </button>
        </div>
      </div>
    </div>
  );
}
