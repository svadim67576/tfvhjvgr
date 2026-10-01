/**
 * Мрачный эмбиент через Web Audio API: низкий гул, шум ветра, редкие стоны
 * и тревожные пульсы. Без внешних файлов, без ударных и «эпичных» тембров.
 *
 * Настроения: menu (гул+ветер), hub (теплее, ровнее), raid (пульс тревоги).
 */
export type MusicMood = "off" | "menu" | "hub" | "raid";

interface MoodProfile {
  /** Базовые частоты низкого гула, Гц. */
  drone: number[];
  /** Частота LFO на громкость гула, Гц. */
  lfo: number;
  /** Глубина LFO. */
  lfoDepth: number;
  /** Громкость шума ветра, 0..1. */
  wind: number;
  /** Частота фильтра ветра, Гц. */
  windTone: number;
  /** Интервал редких звуков, с. */
  eventEvery: number;
  /** Частота тревожного пульса, Гц (0 — выключен). */
  pulse: number;
  /** Общая громкость настроения. */
  gain: number;
}

const MOODS: Record<Exclude<MusicMood, "off">, MoodProfile> = {
  menu: {
    drone: [55, 82.4, 110, 164.8],
    lfo: 0.05, lfoDepth: 0.35, wind: 0.16, windTone: 420,
    eventEvery: 13, pulse: 0, gain: 0.5,
  },
  hub: {
    drone: [49, 73.4, 98, 146.8],
    lfo: 0.07, lfoDepth: 0.22, wind: 0.1, windTone: 340,
    eventEvery: 17, pulse: 0, gain: 0.45,
  },
  raid: {
    drone: [43.6, 65.4, 87.3, 130.8],
    lfo: 0.16, lfoDepth: 0.5, wind: 0.14, windTone: 620,
    eventEvery: 9, pulse: 0.9, gain: 0.55,
  },
};

const MASTER_CEIL = 0.5;

class AmbientScore {
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private moodGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private pulseGain: GainNode | null = null;
  private voices: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode; lfoDepth: GainNode }[] = [];
  private noiseSource: AudioBufferSourceNode | null = null;
  private timers: number[] = [];
  private mood: MusicMood = "off";
  private menuVolume = 45;
  private started = false;
  private lastEvent = 0;

  /** Громкость музыки в меню и лобби (отдельный ползунок). */
  setMenuVolume(value: number) {
    this.menuVolume = Math.max(0, Math.min(100, value));
    this.applyGain();
  }

  get volume() {
    return this.menuVolume;
  }

  setMood(mood: MusicMood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (mood !== "off") this.unlock();
    this.applyGain();
  }

  get currentMood() {
    return this.mood;
  }

  private targetGain() {
    if (this.mood === "off" || !this.context || document.hidden) return 0;
    const moodGain = MOODS[this.mood].gain;
    // Рейд всегда тише меню: музыка не должна давить на стрельбу.
    const scale = this.mood === "raid" ? 0.5 : 1;
    return (this.menuVolume / 100) * MASTER_CEIL * moodGain * scale;
  }

  private applyGain() {
    if (!this.context || !this.bus) return;
    const target = this.targetGain();
    this.bus.gain.setTargetAtTime(target, this.context.currentTime, 1.4);
  }

  private build() {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    this.context = new Ctx();
    this.bus = this.context.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(this.context.destination);

    // Общий тёмный фильтр: убирает «дешёвые» верхние частоты.
    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 520;
    this.filter.Q.value = 0.4;
    this.filter.connect(this.bus);

    this.moodGain = this.context.createGain();
    this.moodGain.gain.value = 1;
    this.moodGain.connect(this.filter);

    // Ветер: белый шум через узкий полосовой фильтр + медленный LFO.
    const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < channel.length; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.96 * last + 0.04 * white; // «коричневый» шум мягче белого
      channel[i] = last * 3.2;
    }
    this.noiseSource = this.context.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;
    const windFilter = this.context.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.7;
    this.noiseGain = this.context.createGain();
    this.noiseGain.gain.value = 0;
    this.noiseSource.connect(windFilter).connect(this.noiseGain).connect(this.moodGain);
    this.noiseSource.start();

    // Тревожный пульс — тихий низкочастотный «сердцебиение» в рейде.
    this.pulseGain = this.context.createGain();
    this.pulseGain.gain.value = 0;
    const pulseOsc = this.context.createOscillator();
    pulseOsc.type = "sine";
    pulseOsc.frequency.value = 52;
    pulseOsc.connect(this.pulseGain).connect(this.moodGain);
    pulseOsc.start();
    this.pulseOsc = pulseOsc;
    this.windFilter = windFilter;
    this.started = true;
  }

  private pulseOsc: OscillatorNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private rebuildVoices() {
    if (!this.context || !this.moodGain) return;
    for (const voice of this.voices) {
      try { voice.osc.stop(); voice.lfo.stop(); } catch { /* уже остановлен */ }
      voice.gain.disconnect();
    }
    this.voices = [];
    const profile = this.mood === "off" ? MOODS.menu : MOODS[this.mood];
    for (let i = 0; i < profile.drone.length; i++) {
      const osc = this.context.createOscillator();
      osc.type = i === 0 ? "sine" : i === 3 ? "triangle" : "sine";
      osc.frequency.value = profile.drone[i];
      osc.detune.value = (i % 2 ? 4 : -4) + i;
      const gain = this.context.createGain();
      // Нижние голоса громче — получается «земляной» низ.
      gain.gain.value = 0.16 / (i * 0.55 + 1);
      // Медленный LFO: гул «дышит», без ритма.
      const lfo = this.context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = profile.lfo + i * 0.017;
      const lfoDepth = this.context.createGain();
      lfoDepth.gain.value = profile.lfoDepth / (i * 0.4 + 1);
      lfo.connect(lfoDepth).connect(gain.gain);
      const pan = this.context.createStereoPanner();
      pan.pan.value = (i - 1.5) * 0.22;
      osc.connect(gain).connect(pan).connect(this.moodGain);
      osc.start();
      lfo.start();
      this.voices.push({ osc, gain, lfo, lfoDepth });
    }
  }

  /** Редкий звук: далёкий стон, скрип, удар ветра. Никогда не совпадает с ударом по зомби. */
  private scheduleEvents() {
    if (this.timers.length) return;
    const tick = () => {
      if (this.mood === "off" || !this.context || document.hidden) return;
      const profile = MOODS[this.mood];
      const now = this.context.currentTime;
      if (now - this.lastEvent > profile.eventEvery * (0.6 + Math.random() * 0.9)) {
        this.lastEvent = now;
        this.playEvent(profile);
      }
    };
    const timer = window.setInterval(tick, 2200);
    this.timers.push(timer);
  }

  private playEvent(profile: MoodProfile) {
    const ctx = this.context;
    if (!ctx || !this.moodGain) return;
    const roll = Math.random();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 1.4;

    if (roll < 0.45) {
      // Далёкий стон за окном.
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const base = 70 + Math.random() * 40;
      osc.frequency.setValueAtTime(base, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(base * 0.62, ctx.currentTime + 1.5);
      filter.frequency.value = 380;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
      osc.connect(filter);
      osc.start();
      osc.stop(ctx.currentTime + 1.7);
    } else if (roll < 0.75) {
      // Скрежет металла / ветер в решётке.
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(160 + Math.random() * 220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.5);
      filter.frequency.value = 1400;
      filter.Q.value = 3;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.022, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
      osc.connect(filter);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else {
      // Тяжёлый «удар» где-то в секторе: глухой, без барабана.
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(58, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
      osc.connect(filter);
      osc.start();
      osc.stop(ctx.currentTime + 0.75);
    }
    filter.connect(gain).connect(pan).connect(this.moodGain);
    void profile;
  }

  unlock() {
    if (typeof window === "undefined") return;
    try {
      if (!this.started) {
        this.build();
        this.rebuildVoices();
        this.scheduleEvents();
      }
      if (this.context?.state === "suspended") void this.context.resume().catch(() => {});
      if (this.mood === "off") return;
      const profile = MOODS[this.mood];
      if (this.noiseGain && this.windFilter) {
        this.noiseGain.gain.setTargetAtTime(profile.wind * 0.5, this.context!.currentTime, 1.2);
        this.windFilter.frequency.setTargetAtTime(profile.windTone, this.context!.currentTime, 1.2);
      }
      if (this.pulseGain && this.pulseOsc && profile.pulse > 0) {
        // Тревога рейда: редкий низкий пульс, не метроном.
        const now = this.context!.currentTime;
        this.pulseOsc.frequency.setValueAtTime(48, now);
        this.pulseGain.gain.cancelScheduledValues(now);
        this.pulseGain.gain.setValueAtTime(0.0001, now);
        for (let i = 0; i < 3; i++) {
          const t = now + i * 1.9;
          this.pulseGain.gain.exponentialRampToValueAtTime(0.05, t + 0.12);
          this.pulseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        }
      } else if (this.pulseGain) {
        this.pulseGain.gain.setTargetAtTime(0, this.context!.currentTime, 0.8);
      }
      this.applyGain();
    } catch {
      // Браузер может запретить звук до жеста — визуальная часть работает.
    }
  }

  /** Плавно убрать музыку (например, при открытии модалок поверх). */
  duck(amount = 0.4) {
    if (!this.context || !this.bus) return;
    this.bus.gain.setTargetAtTime(this.targetGain() * amount, this.context.currentTime, 0.25);
  }
}

export const music = new AmbientScore();
