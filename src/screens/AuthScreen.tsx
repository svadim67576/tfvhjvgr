import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, FileKey2, LockKeyhole, ShieldCheck, UserRound, Eye, EyeOff, LoaderCircle, Play } from "lucide-react";
import { profiles, usernameError } from "../game/profiles";
import { store } from "../game/save";
import { sfx } from "../game/audio";

type AuthTab = "register" | "login" | "restore";

export default function AuthScreen({ onEnter }: { onEnter: () => void }) {
  const [tab, setTab] = useState<AuthTab>(() => profiles.hasProfiles() ? "login" : "register");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nameIssue, setNameIssue] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const changeTab = (next: AuthTab) => {
    if (busy) return;
    setTab(next);
    setPassword("");
    setError("");
    setNameIssue(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    sfx.uiClick();
    try {
      let profile;
      if (tab === "register") profile = await profiles.register(username, displayName, password);
      else if (tab === "login") profile = await profiles.login(username, password);
      else {
        if (!file) throw new Error("Выберите зашифрованную резервную копию профиля.");
        if (file.size > 5_000_000) throw new Error("Размер файла не должен превышать 5 МБ.");
        profile = await profiles.restoreBackup(await file.text(), password);
      }
      store.activateProfile(profile.id, tab === "register");
      setPassword("");
      onEnter();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось открыть профиль. Проверьте данные.");
      setBusy(false);
    }
  };

  const startAsGuest = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    sfx.uiClick();
    try {
      const profile = await profiles.guest();
      store.activateProfile(profile.id);
      onEnter();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось начать игру.");
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="menu-bg-art" aria-hidden="true" />
      <div className="auth-shade" aria-hidden="true" />
      <header className="auth-topline"><span><i /> КОНТРОЛЬНЫЙ ПУНКТ B-7</span><span>ЛОКАЛЬНЫЙ ПРОФИЛЬ <LockKeyhole size={12} /></span></header>
      <div className="auth-content">
        <div className="auth-brand">OUT<span>BREAK</span></div>
        <div className="auth-rule"><span /> ДОПУСК В ЗОНУ КАРАНТИНА</div>
        <h1>{tab === "register" ? "Сначала представься." : tab === "login" ? "С возвращением, выживший." : "Верни свою историю."}</h1>
        <p className="auth-lead">{tab === "register" ? "Один позывной. Твой арсенал, твои районы, твой прогресс." : tab === "login" ? "Введи свой юз и пароль, чтобы продолжить кампанию." : "Выбери файл профиля и введи пароль, которым он защищён."}</p>
        <div className="auth-tabs" role="tablist" aria-label="Вход в игру">
          {(["register", "login", "restore"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={tab === item} aria-controls="auth-form" onClick={() => changeTab(item)} disabled={busy} className={tab === item ? "active" : ""}>
              {item === "register" ? "Новый профиль" : item === "login" ? "Вход" : "Восстановить"}
            </button>
          ))}
        </div>
        <form id="auth-form" className="auth-form" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy}>
            {tab !== "restore" ? (
              <label className="auth-field">
                <span>ЮЗ <small>ТВОЙ УНИКАЛЬНЫЙ ПОЗЫВНОЙ</small></span>
                <div><UserRound size={17} /><input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="survivor_07" value={username} onChange={(e) => { setUsername(e.target.value); setNameIssue(null); }} onBlur={() => { if (tab === "register" && username) setNameIssue(usernameError(username)); }} required minLength={3} maxLength={20} aria-invalid={!!nameIssue} /></div>
                {tab === "register" && <em className={nameIssue ? "field-error" : ""}>{nameIssue ?? "3-20 символов: a-z, цифры и _. Регистр не важен."}</em>}
              </label>
            ) : (
              <div className="auth-backup">
                <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); }} />
                <button type="button" className="auth-file-button" onClick={() => fileInput.current?.click()}><FileKey2 size={26} /><span>{file?.name ?? "Выбрать файл профиля"}<small>Зашифрованная копия .json</small></span></button>
                <p>При восстановлении существующий прогресс этого профиля заменяется данными из файла.</p>
              </div>
            )}
            {tab === "register" && (
              <label className="auth-field"><span>ИМЯ <small>КАК ТЕБЯ НАЗЫВАТЬ</small></span><div><UserRound size={17} /><input name="displayName" autoComplete="nickname" placeholder="Выживший" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={32} /></div></label>
            )}
            <label className="auth-field"><span>ПАРОЛЬ <small>{tab === "register" ? "НЕ МЕНЕЕ 8 СИМВОЛОВ" : "ПОДТВЕРЖДЕНИЕ ДОСТУПА"}</small></span><div><LockKeyhole size={17} /><input name="password" autoComplete={tab === "register" ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={tab === "register" ? 8 : 1} maxLength={128} placeholder="Введи пароль" /><button className="auth-reveal" type="button" data-plain-button aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="auth-submit" disabled={busy || (tab === "restore" && !file)}>{busy ? <><LoaderCircle size={18} className="auth-spinner" /> Проверка доступа...</> : <><span>{tab === "register" ? "Создать профиль" : tab === "login" ? "Войти" : "Восстановить"}</span><ArrowRight size={20} /></>}</button>
          </fieldset>
        </form>
        <button className="auth-guest" type="button" onClick={startAsGuest} disabled={busy}>
          <span className="auth-guest-mark"><Play size={15} fill="currentColor" /></span>
          <span className="auth-guest-copy"><strong>{busy ? "Открываем периметр…" : "Играть без регистрации"}</strong><small>Быстрый старт · прогресс на этом устройстве</small></span>
          <ArrowRight size={17} className="auth-guest-arrow" />
        </button>
        <div className="auth-notice"><ShieldCheck size={20} /><p><strong>Твой прогресс хранится на этом устройстве.</strong> Гостевой прогресс можно продолжить в этом браузере; для резервной копии создай профиль с паролем. Серверная синхронизация не подключена.</p></div>
      </div>
      <footer className="auth-footer"><span>РЕЕСТР ВЫЖИВШИХ / B-7</span><span>ПАРОЛЬ НЕ СОХРАНЯЕТСЯ ОТКРЫТЫМ ТЕКСТОМ</span></footer>
    </main>
  );
}