import { useSyncExternalStore } from "react";
import type { SaveData } from "./types";

const DIRECTORY_KEY = "outbreak_profiles_v1";
const SESSION_KEY = "outbreak_session_v1";
const ITERATIONS = 210_000;
const encoder = new TextEncoder();

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  /** Guest progress stays local and has no password-protected backup. */
  guest?: boolean;
}

interface StoredProfile extends Profile {
  salt: string;
  verifier: string;
}

interface BackupFile {
  format: "outbreak-profile";
  version: 1;
  profile: StoredProfile;
  iterations: number;
  iv: string;
  ciphertext: string;
  exportedAt: string;
}

export const profileSaveKey = (id: string) => `outbreak_progress_${id}`;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

/**
 * Каталог аккаунтов. Битые записи выбрасываются по одной, а не рушат весь
 * список: иначе одна испорченная запись блокировала бы вход во все аккаунты.
 */
function readDirectory(): StoredProfile[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(DIRECTORY_KEY); } catch { throw new Error("Хранилище браузера недоступно (приватный режим?)."); }
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    // Совсем битый каталог — не стираем, а аккуратно переносим в резервный ключ.
    try { localStorage.setItem(`${DIRECTORY_KEY}_broken_${Date.now()}`, raw); } catch { /* квота исчерпана */ }
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const valid: StoredProfile[] = [];
  for (const entry of parsed) {
    if (isStoredProfile(entry)) valid.push(entry);
  }
  if (valid.length !== parsed.length) {
    try { localStorage.setItem(DIRECTORY_KEY, JSON.stringify(valid)); } catch { /* не критично */ }
  }
  return valid;
}

function isStoredProfile(value: unknown): value is StoredProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<StoredProfile>;
  return typeof p.id === "string" && /^[a-f0-9-]{36}$/i.test(p.id)
    && typeof p.username === "string" && /^[a-z][a-z0-9_]{2,19}$/.test(p.username)
    && typeof p.displayName === "string" && p.displayName.length > 0 && p.displayName.length <= 32
    && typeof p.salt === "string" && p.salt.length <= 64
    && typeof p.verifier === "string" && p.verifier.length <= 128
    && typeof p.createdAt === "string"
    && (p.guest === undefined || typeof p.guest === "boolean");
}

function normalizeUsername(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function canonical(value: string) {
  return normalizeUsername(value).replace(/_/g, "").replace(/[0]/g, "o").replace(/[1il]/g, "l");
}

function looksSimilar(a: string, b: string) {
  a = canonical(a);
  b = canonical(b);
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + Number(a[i - 1] !== b[j - 1]));
      diagonal = previous;
    }
  }
  return row[b.length] <= 1;
}

export function usernameError(value: string): string | null {
  const username = normalizeUsername(value);
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(username)) {
    return "От 3 до 20 символов: латинские буквы, цифры и _. Начните с буквы.";
  }
  try {
    if (readDirectory().some((p) => looksSimilar(p.username, username))) {
      return "Такой или слишком похожий юз уже занят в этом браузере.";
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Хранилище недоступно.";
  }
  return null;
}

async function credentials(password: string, salt: Uint8Array<ArrayBuffer>) {
  if (!crypto.subtle) throw new Error("Для защиты пароля откройте игру по HTTPS или на localhost.");
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, material, 512);
  const bytes = new Uint8Array(bits);
  // Independent halves prevent the stored password verifier from becoming an encryption key.
  const verifier = toBase64(bytes.slice(0, 32));
  const key = await crypto.subtle.importKey("raw", bytes.slice(32), "AES-GCM", false, ["encrypt", "decrypt"]);
  bytes.fill(0);
  return { key, verifier };
}

function sameVerifier(a: string, b: string) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}

function publicProfile(p: StoredProfile): Profile {
  return { id: p.id, username: p.username, displayName: p.displayName, createdAt: p.createdAt, ...(p.guest ? { guest: true } : {}) };
}

class ProfileStore {
  private current: Profile | null = null;
  private record: StoredProfile | null = null;
  private key: CryptoKey | null = null;
  private listeners = new Set<() => void>();
  private failedAttempts = 0;
  private retryAt = 0;

  getSnapshot = () => this.current;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  hasProfiles() {
    try { return readDirectory().length > 0; } catch { return false; }
  }

  private open(record: StoredProfile, key: CryptoKey | null) {
    this.record = record;
    this.key = key;
    this.current = publicProfile(record);
    this.failedAttempts = 0;
    // Запоминаем сессию, чтобы вернуться без повторного входа.
    try { localStorage.setItem(SESSION_KEY, record.id); } catch { /* приватный режим */ }
    this.listeners.forEach((listener) => listener());
  }

  /** Кто вошёл в прошлый раз: без пароля, ключ уже был получен. */
  sessionProfile(): Profile | null {
    if (this.current) return this.current;
    let id: string | null = null;
    try { id = localStorage.getItem(SESSION_KEY); } catch { return null; }
    if (!id) return null;
    const record = readDirectory().find((p) => p.id === id);
    if (!record) return null;
    this.record = record;
    this.key = null;
    this.current = publicProfile(record);
    this.listeners.forEach((listener) => listener());
    return this.current;
  }

  /** Быстрый профиль без пароля; один и тот же гость сохраняет прогресс в этом браузере. */
  async guest(): Promise<Profile> {
    const directory = readDirectory();
    const existing = directory.find((p) => p.guest);
    if (existing) {
      this.open(existing, null);
      return publicProfile(existing);
    }

    let username = "";
    do {
      username = `guest_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    } while (directory.some((p) => p.username === username));

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verifier = crypto.getRandomValues(new Uint8Array(32));
    const record: StoredProfile = {
      id: crypto.randomUUID(),
      username,
      displayName: "Гость",
      createdAt: new Date().toISOString(),
      salt: toBase64(salt),
      verifier: toBase64(verifier),
      guest: true,
    };
    localStorage.setItem(DIRECTORY_KEY, JSON.stringify([...directory, record]));
    this.open(record, null);
    return publicProfile(record);
  }

  async register(username: string, displayName: string, password: string): Promise<Profile> {
    username = normalizeUsername(username);
    displayName = displayName.normalize("NFKC").trim();
    const issue = usernameError(username);
    if (issue) throw new Error(issue);
    if (!displayName || displayName.length > 32) throw new Error("Имя должно содержать от 1 до 32 символов.");
    if (password.length < 8 || password.length > 128) throw new Error("Пароль должен содержать от 8 до 128 символов.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const { key, verifier } = await credentials(password, salt);
    // Recheck after PBKDF2 in case another tab registered the same name meanwhile.
    const check = usernameError(username);
    if (check) throw new Error(check);
    const list = readDirectory();
    const record: StoredProfile = { id: crypto.randomUUID(), username, displayName, createdAt: new Date().toISOString(), salt: toBase64(salt), verifier };
    localStorage.setItem(DIRECTORY_KEY, JSON.stringify([...list, record]));
    this.open(record, key);
    return publicProfile(record);
  }

  async login(username: string, password: string): Promise<Profile> {
    if (Date.now() < this.retryAt) throw new Error("Слишком много попыток. Подождите 15 секунд.");
    const name = normalizeUsername(username);
    if (!name) throw new Error("Введите юз.");
    let directory: StoredProfile[];
    try {
      directory = readDirectory();
    } catch {
      throw new Error("Список профилей повреждён. Восстановите аккаунт из резервной копии.");
    }
    const record = directory.find((p) => normalizeUsername(p.username) === name);
    if (!record) {
      throw new Error(`Аккаунт с юзом «${name}» не найден в этом браузере. Проверьте юз, создайте новый профиль или восстановите его из резервной копии.`);
    }
    // PBKDF2 всегда выполняется, чтобы не раскрывать лишнего по времени ответа.
    const { key, verifier } = await credentials(password, fromBase64(record.salt));
    if (!sameVerifier(verifier, record.verifier)) {
      this.failedAttempts++;
      if (this.failedAttempts >= 5) { this.retryAt = Date.now() + 15000; this.failedAttempts = 0; }
      throw new Error(`Неверный пароль для юза «${record.username}». Попробуйте ещё раз.`);
    }
    this.open(record, key);
    return publicProfile(record);
  }

  /** Выход из аккаунта: прогресс и аккаунт остаются, стирается только сессия. */
  logout() {
    this.current = this.record = this.key = null;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* приватный режим */ }
    this.listeners.forEach((listener) => listener());
  }

  async exportBackup(save: SaveData): Promise<string> {
    const record = this.record;
    const key = this.key;
    if (!record) throw new Error("Сначала войдите в профиль.");
    if (record.guest) throw new Error("Гостевой прогресс хранится только в этом браузере. Создайте профиль, чтобы делать резервные копии.");
    if (!key) throw new Error("Для резервной копии войдите в профиль по паролю ещё раз.");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = encoder.encode(JSON.stringify({ profile: publicProfile(record), save }));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(record.id) }, key, payload);
    const file: BackupFile = {
      format: "outbreak-profile", version: 1, profile: record, iterations: ITERATIONS,
      iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)), exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(file, null, 2);
  }

  async restoreBackup(text: string, password: string): Promise<Profile> {
    if (text.length > 5_000_000) throw new Error("Файл слишком большой. Выберите резервную копию OUTBREAK.");
    let file: BackupFile;
    try { file = JSON.parse(text) as BackupFile; } catch { throw new Error("Не удалось прочитать резервную копию."); }
    if (!file || file.format !== "outbreak-profile" || file.version !== 1 || file.iterations !== ITERATIONS || !isStoredProfile(file.profile)
      || typeof file.iv !== "string" || typeof file.ciphertext !== "string") throw new Error("Это не файл профиля OUTBREAK.");
    const { key, verifier } = await credentials(password, fromBase64(file.profile.salt));
    if (!sameVerifier(verifier, file.profile.verifier)) throw new Error("Неверный пароль от резервной копии.");
    let save: SaveData;
    try {
      const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(file.iv), additionalData: encoder.encode(file.profile.id) }, key, fromBase64(file.ciphertext));
      const payload = JSON.parse(new TextDecoder().decode(clear)) as { profile: Profile; save: SaveData };
      if (payload.profile.username !== file.profile.username || payload.profile.displayName !== file.profile.displayName
        || payload.profile.id !== file.profile.id || !payload.save || !Array.isArray(payload.save.ownedWeapons)
        || !payload.save.levels || !Number.isFinite(payload.save.currency)) throw new Error("invalid");
      save = payload.save;
    } catch { throw new Error("Резервная копия повреждена или пароль неверен."); }
    const list = readDirectory();
    const occupied = list.find((p) => looksSimilar(p.username, file.profile.username));
    if (occupied && (occupied.id !== file.profile.id || occupied.verifier !== file.profile.verifier)) {
      throw new Error("Такой или похожий юз принадлежит другому локальному профилю.");
    }
    localStorage.setItem(profileSaveKey(file.profile.id), JSON.stringify(save));
    localStorage.setItem(DIRECTORY_KEY, JSON.stringify([...list.filter((p) => p.id !== file.profile.id), file.profile]));
    this.open(file.profile, key);
    return publicProfile(file.profile);
  }
}

export const profiles = new ProfileStore();
export const useProfile = () => useSyncExternalStore(profiles.subscribe, profiles.getSnapshot, profiles.getSnapshot);

export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}