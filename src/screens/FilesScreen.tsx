import { useRef, useState } from "react";
import { store, useSave } from "../game/save";
import { GameButton, Panel } from "../game/ui";
import type { Screen } from "../game/types";
import { downloadText, profiles, useProfile } from "../game/profiles";

// ============================================================
// ФАЙЛЫ ИГРЫ: экспорт и импорт сохранения
// ============================================================

export default function FilesScreen({ go, toast }: { go: (s: Screen) => void; toast: (msg: string) => void }) {
  const save = useSave();
  const profile = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");

  const backupProfile = async () => {
    setBackupBusy(true);
    setBackupMessage("");
    try {
      const text = await profiles.exportBackup(store.getSnapshot());
      downloadText(text, `outbreak-${profile?.username}-${new Date().toISOString().slice(0, 10)}.profile.json`);
      setBackupMessage("Копия скачана. Храните её вне браузера. Для восстановления понадобятся файл и пароль.");
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Не удалось создать копию.");
    } finally { setBackupBusy(false); }
  };

  const download = () => {
    const blob = new Blob([store.exportSave()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outbreak-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("✅ Сохранение скачано.");
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      if (store.importSave(text)) {
        setImportError(false);
        toast("✅ Сохранение загружено.");
      } else {
        setImportError(true);
      }
    } catch {
      setImportError(true);
    }
  };

  return (
    <div className="w-full max-w-[720px] space-y-3">
      <header className="ruined-sm relative flex items-center justify-between gap-2 bg-[#17201b] px-4 py-3">
        <span className="pixel text-[11px] text-rust-200">📁 ФАЙЛЫ ИГРЫ</span>
        <button onClick={() => go("menu")} className="border border-ash-600 px-3 py-1.5 text-[11px] text-ash-200 hover:border-rust-400">
          ← В меню
        </button>
      </header>

      <Panel title="Резервная копия профиля" tone="rust">
        <div className="space-y-3 text-[12px] leading-5 text-ash-300">
          <p><strong className="text-rust-200">{profile?.displayName}</strong> / @{profile?.username}</p>
          <p>Копия содержит аккаунт и текущий прогресс, зашифрованные вашим паролем. После очистки данных браузера откройте «Восстановить» на экране входа, выберите этот файл и введите пароль.</p>
          <GameButton variant="primary" disabled={backupBusy} onClick={() => { void backupProfile(); }}>{backupBusy ? "Шифрование..." : "Скачать копию профиля"}</GameButton>
          {backupMessage && <p className="text-toxic-300" role="status">{backupMessage}</p>}
          <p className="text-[10px] text-ash-400">Это снимок на момент скачивания, не облачная синхронизация. Обновляйте копию после рейдов. Пароль без файла не восстановит удалённый аккаунт.</p>
        </div>
      </Panel>

      <Panel title="Сохранение кампании">
        <div className="space-y-3 text-[12px] text-ash-300">
          <p>
            Прогресс хранится в браузере (localStorage). Скачайте файл сохранения, чтобы перенести кампанию на другое
            устройство или сохранить резервную копию.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <GameButton variant="primary" onClick={download}>
              ⬇ Скачать сохранение
            </GameButton>
            <GameButton onClick={() => fileRef.current?.click()}>⬆ Загрузить сохранение</GameButton>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
          {importError && (
            <div className="stripes-danger border border-blood-400/60 px-3 py-2 text-[11px] font-bold text-red-200">
              Файл повреждён или не является сохранением OUTBREAK.
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="border border-ash-800 bg-ash-950/60 py-1.5">
              <div className="text-ash-500">Лом</div>
              <div className="term text-lg text-toxic-300">{save.currency}</div>
            </div>
            <div className="border border-ash-800 bg-ash-950/60 py-1.5">
              <div className="text-ash-500">Оружия</div>
              <div className="term text-lg text-ash-100">{save.ownedWeapons.length}</div>
            </div>
            <div className="border border-ash-800 bg-ash-950/60 py-1.5">
              <div className="text-ash-500">Рейдов</div>
              <div className="term text-lg text-ash-100">{save.runsPlayed}</div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Опасная зона" tone="rust">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ash-300">
          <span>Полный сброс кампании без возможности восстановления.</span>
          <GameButton
            variant="danger"
            onClick={() => {
              store.resetSave();
              toast("☣ Кампания сброшена.");
            }}
          >
            ☣ Сжечь сохранение
          </GameButton>
        </div>
      </Panel>
    </div>
  );
}
