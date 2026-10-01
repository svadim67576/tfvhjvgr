import { useRef, useState } from "react";

interface Props {
  /** Нормализованный вектор (-1..1) + магнитуда 0..1. */
  onVector: (x: number, y: number, mag: number) => void;
  onEnd?: () => void;
  size?: number;
  label?: string;
}

/** Виртуальный джойстик: общий для боя и лагеря. */
export default function TouchStick({ onVector, onEnd, size = 124, label = "Движение" }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const radius = size / 2 - 8;
  const knobSize = Math.round(size * 0.38);

  const update = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const len = Math.max(1, Math.hypot(dx, dy));
    const cl = Math.min(len, radius);
    const nx = (dx / len) * Math.min(1, len / radius);
    const ny = (dy / len) * Math.min(1, len / radius);
    setKnob({ x: (dx / len) * cl, y: (dy / len) * cl });
    onVector(nx, ny, Math.min(1, len / radius));
  };

  const release = () => {
    setKnob({ x: 0, y: 0 });
    onEnd?.();
  };

  return (
    <div
      ref={baseRef}
      className="tstick"
      role="application"
      aria-label={label}
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        className="tstick-knob"
        style={{ width: knobSize, height: knobSize, transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
