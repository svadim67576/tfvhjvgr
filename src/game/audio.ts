// ============================================================
// OUTBREAK — звуковой движок. ВСЕ звуки — реальные CC0-сэмплы с GitHub.
// Синтеза нет: если сэмпл не загрузился (нет сети), звук молчит.
//
// Источники (CC0-1.0):
// - lavenderdotpet/CC0-Public-Domain-Sounds (bang/cannon/creature/wood-metal/sfx)
// - PanderMusubi/sound-effects-library-weapons (запись ППШ)
// ============================================================

const CC0 = "https://raw.githubusercontent.com/lavenderdotpet/CC0-Public-Domain-Sounds/main";
const FIREARM = "https://raw.githubusercontent.com/PanderMusubi/sound-effects-library-weapons/master/samples";
const KENNEY = "https://cdn.jsdelivr.net/gh/KenneyNL/Impact-Sounds@master/Audio";

/** Несколько URL на звук: если GitHub не отдал файл, берём следующий CC0-источник. */
const SAMPLE_URLS: Record<string, string[]> = {
  // Каждый ствол — свой сэмпл. Пулемёт больше не делит ППШ с «Вихрем».
  w_pm17: [`${CC0}/25-CC0-bang-sfx/shot_01.ogg`, `${CC0}/25-CC0-bang-sfx/bang_01.ogg`],
  w_obrez: [`${CC0}/25-CC0-bang-sfx/bang_07.ogg`, `${CC0}/25-CC0-bang-sfx/bang_02.ogg`],
  w_magnum: [`${CC0}/25-CC0-bang-sfx/cannon_01.ogg`, `${CC0}/25-CC0-bang-sfx/cannon_03.ogg`],
  w_remington: [`${CC0}/25-CC0-bang-sfx/bang_05.ogg`, `${CC0}/25-CC0-bang-sfx/bang_04.ogg`],
  w_vihr: [`${FIREARM}/ppsh_P_22P.ogg`, `${CC0}/25-CC0-bang-sfx/bang_06.ogg`],
  w_ak74: [`${CC0}/25-CC0-bang-sfx/shot_03.ogg`, `${CC0}/25-CC0-bang-sfx/shot_02.ogg`],
  w_m4karat: [`${CC0}/25-CC0-bang-sfx/bang_03.ogg`, `${CC0}/25-CC0-bang-sfx/bang_01.ogg`],
  w_barracuda: [`${CC0}/25-CC0-bang-sfx/bang_09.ogg`, `${CC0}/25-CC0-bang-sfx/bang_08.ogg`],
  w_svd: [`${CC0}/25-CC0-bang-sfx/cannon_02.ogg`, `${CC0}/25-CC0-bang-sfx/cannon_04.ogg`],
  w_mjasorubka: [`${CC0}/25-CC0-bang-sfx/bang_04.ogg`, `${CC0}/25-CC0-bang-sfx/cannon_05.ogg`],
  melee_swing: [`${FIREARM}/axe-norse-sword-blade-on-blade.ogg`, `${CC0}/100-CC0-SFX/spring_01.ogg`],
  melee_hit: [`${KENNEY}/impactPunch_heavy_000.ogg`, `${CC0}/100-CC0-SFX/hit_01.ogg`],
  flesh_impact: [`${KENNEY}/impactPunch_medium_000.ogg`, `${CC0}/100-CC0-SFX/hit_01.ogg`],
  // Бой и окружение
  explosion: [`${CC0}/25-CC0-bang-sfx/cannon_05.ogg`, `${KENNEY}/lowFrequency_explosion_000.ogg`],
  wave_start: [`${CC0}/25-CC0-bang-sfx/cannon_03.ogg`, `${CC0}/25-CC0-bang-sfx/cannon_01.ogg`],
  // Кувырок: глухой мягкий удар тела о землю, без «свиста».
  roll: [`${KENNEY}/impactSoft_heavy_000.ogg`, `${CC0}/100-CC0-SFX/hit_01.ogg`],
  breath: [`${CC0}/80-CC0-creature-SFX/breath.ogg`],
  hurt1: [`${CC0}/80-CC0-creature-SFX/hurt_01.ogg`],
  hurt2: [`${CC0}/80-CC0-creature-SFX/hurt_02.ogg`],
  hurt3: [`${CC0}/80-CC0-creature-SFX/hurt_03.ogg`],
  zombie_grunt: [`${CC0}/80-CC0-creature-SFX/hurt_02.ogg`, `${CC0}/100-CC0-SFX/hit_01.ogg`],
  // Смерть зомби собирается из трёх слоёв: низкий стон, влажное бульканье и падение тела.
  zombie_death_groan: [`${CC0}/80-CC0-creature-SFX/roar_02.ogg`, `${CC0}/80-CC0-creature-SFX/hurt_03.ogg`],
  zombie_death_gurgle: [`${CC0}/80-CC0-creature-SFX/breath.ogg`, `${CC0}/80-CC0-creature-SFX/hurt_02.ogg`],
  zombie_death_fall: [`${KENNEY}/impactSoft_heavy_001.ogg`, `${KENNEY}/impactSoft_heavy_000.ogg`],
  zombie_roar: [`${CC0}/80-CC0-creature-SFX/roar_02.ogg`],
  reload_clank: [`${CC0}/100-CC0-wood-metal-SFX/hammer_02.ogg`],
  reload_pump: [`${CC0}/100-CC0-wood-metal-SFX/hammer_03.ogg`],
  reload_done: [`${CC0}/100-CC0-wood-metal-SFX/door_open_01.ogg`],
  shell_drop: [`${CC0}/100-CC0-SFX/dishes_02.ogg`],
  footstep: [`${CC0}/100-CC0-wood-metal-SFX/hammer_01.ogg`],
  ui_click: [`${CC0}/100-CC0-wood-metal-SFX/keys_02.ogg`],
  ui_creak: [`${CC0}/100-CC0-wood-metal-SFX/door_open_01.ogg`],
  ui_confirm: [`${CC0}/100-CC0-SFX/bell_02.ogg`],
  ui_deny: [`${CC0}/100-CC0-wood-metal-SFX/hammer_04.ogg`],
  pickup_scrap: [`${CC0}/100-CC0-SFX/dishes_03.ogg`],
  pickup_medkit: [`${CC0}/100-CC0-SFX/bell_01.ogg`],
};

/** Обработка сэмпла: темп, громкость, обрезка, фильтр. */
interface PlayOpts {
  rate?: number;
  gain?: number;
  maxDuration?: number;
  lowpass?: number;
  offset?: number;
}

class SoundFx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.7;
  private lastStep = 0;
  private lastBreath = 0;
  private lastDeath = 0;
  private deathBurst = 0;
  private lastHover = -Infinity;
  private buffers = new Map<string, AudioBuffer>();

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      }
    }
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
    this.loadAll();
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol / 100));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  unlock() {
    try { this.init(); } catch { /* Audio permission is controlled by the browser. */ }
  }

  uiHover() {
    if (!this.ctx || this.ctx.state !== "running" || this.volume <= 0) return;
    const now = performance.now();
    if (now - this.lastHover < 350) return;
    this.lastHover = now;
    this.play("ui_creak", { gain: 0.085, rate: 0.68, lowpass: 1500, maxDuration: 0.2 });
  }

  /** Загружаем все сэмплы один раз. Если первый URL не открылся — пробуем запасной. */
  private loading = false;
  private loadAll() {
    if (!this.ctx || this.loading) return;
    this.loading = true;
    for (const [key, urls] of Object.entries(SAMPLE_URLS)) {
      void this.loadOne(key, urls, 0);
    }
  }

  private async loadOne(key: string, urls: string[], index: number) {
    if (!this.ctx || index >= urls.length) return;
    try {
      const response = await fetch(urls[index], { mode: "cors", cache: "force-cache" });
      if (!response.ok) throw new Error("missing");
      const data = await response.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(data.slice(0));
      this.buffers.set(key, buf);
    } catch {
      await this.loadOne(key, urls, index + 1);
    }
  }

  private play(key: string, o: PlayOpts = {}) {
    if (!this.ctx || !this.master) return;
    const buf = this.buffers.get(key);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (o.rate ?? 1) * (0.97 + Math.random() * 0.06);
    const gain = this.ctx.createGain();
    gain.gain.value = o.gain ?? 0.5;
    let node: AudioNode = src;
    if (o.lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.lowpass;
      src.connect(f);
      node = f;
    }
    node.connect(gain);
    gain.connect(this.master);
    src.onended = () => {
      src.disconnect();
      if (node !== src) node.disconnect();
      gain.disconnect();
    };
    const start = o.offset ?? 0;
    const dur = Math.min(buf.duration - start, o.maxDuration ?? buf.duration);
    try {
      src.start(this.ctx.currentTime, start, Math.max(0.02, dur));
    } catch {
      /* уже уничтожен */
    }
  }

  // ---------- Боевые ----------
  shoot(kind: string = "Пистолет", weaponId?: string) {
    this.init();
    const kindDefault: Record<string, string> = {
      "Пистолет": "w_pm17",
      "Дробовик помповый": "w_remington",
      "Дробовик": "w_barracuda",
      "Пистолет-пулемёт": "w_vihr",
      "Автомат": "w_ak74",
      "Снайперская винтовка": "w_svd",
      "Пулемёт": "w_mjasorubka",
    };
    const map: Record<string, PlayOpts> = {
      w_pm17: { gain: 0.5, rate: 1.12, maxDuration: 0.5 },
      w_obrez: { gain: 0.8, rate: 0.82, maxDuration: 0.7 },
      w_magnum: { gain: 0.72, rate: 0.9, maxDuration: 0.9 },
      w_remington: { gain: 0.78, rate: 0.86, maxDuration: 0.7 },
      w_vihr: { gain: 0.42, rate: 1.1, maxDuration: 0.16 },
      w_ak74: { gain: 0.55, rate: 1.0, maxDuration: 0.22 },
      w_m4karat: { gain: 0.5, rate: 1.08, maxDuration: 0.2 },
      w_barracuda: { gain: 0.72, rate: 0.84, maxDuration: 0.45 },
      w_svd: { gain: 0.85, rate: 0.78, maxDuration: 1.2 },
      w_mjasorubka: { gain: 0.5, rate: 0.92, maxDuration: 0.18 },
    };
    const key = weaponId ?? kindDefault[kind] ?? "w_pm17";
    this.play(key, map[key] ?? map.w_pm17);
  }

  /** Взмах холодным оружием (нож, топор, мачете) */
  meleeSwing() {
    this.init();
    this.play("melee_swing", { gain: 0.28, rate: 1.25 + Math.random() * 0.2, maxDuration: 0.22 });
  }

  /** Крик босса при появлении. */
  bossRoar() {
    this.init();
    this.play("zombie_roar", { gain: 0.55, rate: 0.75, maxDuration: 1.2 });
    this.play("explosion", { gain: 0.3, rate: 0.65, lowpass: 500, maxDuration: 1 });
  }

  /** Попадание по зомби. */
  hitZombie() {
    this.zombieHit();
  }

  /**
   * Смерть зомби: низкий глухой предсмертный стон с бульканьем и падением тела.
   * Специально очень тихий; при массовой гибели звук прореживается и глушится,
   * чтобы десяток трупов не резал слух.
   */
  zombieDeath() {
    this.init();
    const now = performance.now();
    // Не чаще одного стона в 110 мс.
    if (now - this.lastDeath < 110) return;
    // Чем плотнее идут смерти, тем тише каждая следующая.
    const burst = now - this.lastDeath < 420 ? Math.min(3, this.deathBurst + 1) : 0;
    this.deathBurst = burst;
    this.lastDeath = now;
    const duck = 1 / (1 + burst * 0.85);

    const detune = 0.94 + Math.random() * 0.12;
    // Слой 1: горловой стон, сильно опущенный по тону и срезанный фильтром.
    this.play("zombie_death_groan", {
      gain: 0.1 * duck,
      rate: 0.4 * detune,
      lowpass: 430,
      maxDuration: 0.85,
    });
    // Слой 2: влажный хрип/бульканье.
    this.play("zombie_death_gurgle", {
      gain: 0.07 * duck,
      rate: 0.52 * detune,
      lowpass: 720,
      maxDuration: 0.6,
      offset: 0.04 + Math.random() * 0.05,
    });
    // Слой 3: мягкое падение тела чуть позже.
    window.setTimeout(() => {
      this.play("zombie_death_fall", {
        gain: 0.055 * duck,
        rate: 0.68 + Math.random() * 0.1,
        lowpass: 500,
        maxDuration: 0.3,
      });
    }, 90 + Math.random() * 70);
  }

  /** Холостой щелчок при пустом магазине. */
  dryFire() {
    this.init();
    this.play("reload_clank", { gain: 0.22, rate: 1.4, maxDuration: 0.18, lowpass: 3200 });
  }

  /** Отказ рывка: выдох + глухой стук. */
  staminaEmpty() {
    this.init();
    this.play("breath", { gain: 0.3, rate: 1.1, maxDuration: 0.5 });
    this.play("ui_deny", { gain: 0.2, rate: 0.75, maxDuration: 0.2 });
  }

  /** Победа: звон + далёкий залп. */
  victory() {
    this.init();
    this.play("ui_confirm", { gain: 0.4, rate: 0.9 });
    this.play("wave_start", { gain: 0.4, rate: 0.55, lowpass: 700, maxDuration: 1.2 });
  }

  /** Поражение: низкий удар. */
  defeat() {
    this.init();
    this.play("explosion", { gain: 0.55, rate: 0.5, lowpass: 600, maxDuration: 1.3 });
    this.play("hurt2", { gain: 0.4, rate: 0.7, maxDuration: 0.8 });
  }

  explosion() {
    this.init();
    this.play("explosion", { gain: 0.85, rate: 0.9, maxDuration: 1.4 });
  }

  waveStart() {
    this.init();
    this.play("wave_start", { gain: 0.6, rate: 0.7, lowpass: 900, maxDuration: 1.6 });
    this.play("zombie_roar", { gain: 0.4, rate: 0.85 });
  }

  /** Кувырок: шорох одежды и мягкий удар корпуса о землю. */
  roll() {
    this.init();
    this.play("roll", { gain: 0.26, rate: 0.85 + Math.random() * 0.12, lowpass: 1500, maxDuration: 0.4 });
    this.play("breath", { gain: 0.12, rate: 1.15, maxDuration: 0.35 });
  }

  zombieHit() {
    // Звук попадания в тело теперь звучит только при ударе холодным оружием.
  }

  meleeImpact() {
    this.init();
    this.play("melee_hit", { gain: 0.5, rate: 0.95 + Math.random() * 0.2, maxDuration: 0.22 });
  }

  // ---------- Тело ----------
  breath(exhausted: boolean) {
    this.init();
    const now = performance.now();
    if (now - this.lastBreath < (exhausted ? 620 : 950)) return;
    this.lastBreath = now;
    this.play("breath", { gain: exhausted ? 0.32 : 0.18, rate: exhausted ? 0.92 : 1.02, maxDuration: 0.8 });
  }

  playerHit() {
    this.init();
    this.play(`hurt${1 + Math.floor(Math.random() * 3)}`, {
      gain: 0.45,
      rate: 0.9 + Math.random() * 0.15,
      maxDuration: 0.7,
    });
  }

  // ---------- Механика оружия ----------
  reloadStart(kind: string) {
    this.init();
    if (kind.includes("Дробовик")) {
      this.play("reload_pump", { gain: 0.3, rate: 1.05, maxDuration: 0.4 });
    } else {
      this.play("reload_clank", { gain: 0.28, rate: 1.1, maxDuration: 0.35 });
    }
  }

  reloadEnd(kind: string) {
    this.init();
    if (kind.includes("Дробовик")) {
      this.play("reload_pump", { gain: 0.34, rate: 0.9, maxDuration: 0.45 });
    } else if (kind === "Пулемёт" || kind === "Снайперская винтовка") {
      this.play("reload_done", { gain: 0.3, rate: 1.15, maxDuration: 0.3 });
    } else {
      this.play("reload_clank", { gain: 0.32, rate: 0.85, maxDuration: 0.35 });
    }
  }

  shellDrop(heavy = false) {
    this.init();
    this.play("shell_drop", {
      gain: heavy ? 0.14 : 0.1,
      rate: (heavy ? 0.8 : 1.15) + Math.random() * 0.1,
      maxDuration: 0.22,
      lowpass: 6500,
      offset: 0.02 + Math.random() * 0.05,
    });
  }

  footstep(sprint = false) {
    this.init();
    const now = performance.now();
    if (now - this.lastStep < (sprint ? 210 : 300)) return;
    this.lastStep = now;
    this.play("footstep", { gain: sprint ? 0.12 : 0.07, rate: 0.7 + Math.random() * 0.15, lowpass: 700, maxDuration: 0.18 });
  }

  // ---------- Интерфейс ----------
  uiClick() {
    this.init();
    this.play("ui_click", { gain: 0.22, rate: 1.1, maxDuration: 0.15, lowpass: 5000 });
  }

  uiConfirm() {
    this.init();
    this.play("ui_confirm", { gain: 0.3, rate: 1.05, maxDuration: 0.5 });
  }

  uiDeny() {
    this.init();
    this.play("ui_deny", { gain: 0.28, rate: 0.8, maxDuration: 0.25 });
  }

  pickupScrap() {
    this.init();
    this.play("pickup_scrap", { gain: 0.25, rate: 1.2, maxDuration: 0.3 });
  }

  medkit() {
    this.init();
    this.play("pickup_medkit", { gain: 0.3, rate: 1.1, maxDuration: 0.6 });
  }
}

export const sfx = new SoundFx();
