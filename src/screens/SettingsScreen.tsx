import { useEffect, useState } from "react";
import { Volume2, Mouse, Monitor, SlidersHorizontal, X } from "lucide-react";
import { store, useSave } from "../game/save";
import { Slider, Toggle } from "../game/ui";
import { sfx } from "../game/audio";
import { music } from "../game/music";

export default function SettingsScreen({ onBack }: { onBack: () => void; toast?: (message: string) => void }) {
  const { settings } = useSave();
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const [fullscreenError, setFullscreenError] = useState("");
  const [fullscreenBusy, setFullscreenBusy] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const changeFullscreen = async (enabled: boolean) => {
    setFullscreenBusy(true);
    setFullscreenError("");
    try {
      if (enabled) await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
      setFullscreen(!!document.fullscreenElement);
    } catch {
      setFullscreenError("Браузер заблокировал полный экран. Откройте игру в отдельной вкладке или используйте F11.");
    } finally { setFullscreenBusy(false); }
  };

  return (
    <div className="settings-shell">
      <button className="settings-close" type="button" aria-label="Закрыть настройки" onClick={onBack}><X size={18} /></button>
      <section className="settings-terminal" aria-labelledby="settings-heading">
        <header className="settings-heading"><span><SlidersHorizontal size={14} /> КОНФИГУРАЦИЯ / B-7</span><h1 id="settings-heading">НАСТРОЙКИ</h1><p>Изменения применяются сразу и сохраняются в вашем профиле.</p></header>
        <div className="settings-sections">
          <section>
            <h2><span>01</span><Volume2 size={16} /> ЗВУК</h2>
            <Slider label="Громкость эффектов" value={settings.sfx} onChange={(volume) => { sfx.setVolume(volume); store.updateSettings({ sfx: volume }); }} />
            <Slider label="Громкость музыки в меню" value={settings.menuMusic} onChange={(volume) => { music.setMenuVolume(volume); music.unlock(); store.updateSettings({ menuMusic: volume }); }} />
            <p className="settings-hint">Мрачный эмбиент в главном меню и лобби. В рейде играет тише. Нажми кнопку — услышишь.</p>
            <button
              type="button"
              onClick={() => { music.setMood("menu"); music.unlock(); }}
              className="settings-hint text-left underline decoration-ash-600 underline-offset-4 hover:text-rust-200"
            >
              ▸ Проверить музыку
            </button>
          </section>
          <section>
            <h2><span>02</span><Mouse size={16} /> УПРАВЛЕНИЕ</h2>
            <Slider label="Чувствительность мыши" min={40} max={200} step={5} value={settings.mouseSensitivity} onChange={(mouseSensitivity) => store.updateSettings({ mouseSensitivity })} />
            <p className="settings-hint">Скорость игрового прицела. 100% соответствует движению курсора.</p>
          </section>
          <section>
            <h2><span>03</span><Monitor size={16} /> ИЗОБРАЖЕНИЕ</h2>
            <fieldset className="settings-choice"><legend>Качество графики</legend><div>
              {(["low", "medium", "high"] as const).map((quality, i) => <button type="button" key={quality} aria-pressed={settings.graphicsQuality === quality} onClick={() => store.updateSettings({ graphicsQuality: quality })}>{["Низкое", "Среднее", "Высокое"][i]}</button>)}
            </div><p className="settings-hint">Разрешение рендера, плавность света и детализация свечения.</p></fieldset>
            <fieldset className="settings-choice"><legend>Частицы</legend><div>
              {(["off", "low", "high"] as const).map((quality, i) => <button type="button" key={quality} aria-pressed={settings.particleQuality === quality} onClick={() => store.updateSettings({ particleQuality: quality })}>{["Выкл.", "Меньше", "Все"][i]}</button>)}
            </div><p className="settings-hint">Влияет на дым, искры и пыль. Снаряды и опасные зоны видны всегда.</p></fieldset>
            <Toggle label="Тряска камеры" hint="Отдача при выстрелах и взрывах" value={settings.screenShake} onChange={(screenShake) => store.updateSettings({ screenShake })} />
            <Toggle label="Числа урона" hint="Показывать значения попаданий" value={settings.damageNumbers} onChange={(damageNumbers) => store.updateSettings({ damageNumbers })} />
            <Toggle label="Счётчик FPS" hint="Частота кадров в правом верхнем углу" value={settings.showFps} onChange={(showFps) => store.updateSettings({ showFps })} />
            <Toggle label="Полноэкранный режим" hint={document.fullscreenEnabled ? "Esc возвращает оконный режим" : "Недоступен в этом браузере или встроенном окне"} value={fullscreen} disabled={!document.fullscreenEnabled || fullscreenBusy} onChange={(value) => { void changeFullscreen(value); }} />
            {fullscreenError && <p className="settings-error" role="status">{fullscreenError}</p>}
          </section>
        </div>
        <div className="settings-autosave"><i /> АВТОСОХРАНЕНИЕ ВКЛЮЧЕНО</div>
      </section>
    </div>
  );
}
