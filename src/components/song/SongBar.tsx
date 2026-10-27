import { useEffect, useRef, useState } from "react";
import type { SongLibrary } from "../../hooks/useSongLibrary";
import { KEY_OPTIONS } from "../../services/chordTranspose";
import { BEAT_CHOICES, MAX_TITLE_LENGTH, TIME_SIGNATURES } from "../../services/songModel";
import { exportSongsToJson, parseImportedJson } from "../../services/songStorage";
import { ShareButton } from "../ShareButton";

function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, "").trim();
  return cleaned || "guitar-songs";
}

function download(fileName: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface SongBarProps {
  library: SongLibrary;
  /** 是否顯示分享按鈕 */
  showShare?: boolean;
}

export function SongBar({ library, showShare = true }: SongBarProps) {
  const { song, songs, draft } = library;
  const fileRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);

  // 點選單以外的地方、按 Esc，或選了其中一項後，自動收起「更多」。
  useEffect(() => {
    const closeIfOutside = (event: Event) => {
      const menu = moreRef.current;

      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && moreRef.current?.open) {
        moreRef.current.open = false;
      }
    };

    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function closeMenu() {
    if (moreRef.current) moreRef.current.open = false;
  }
  const [message, setMessage] = useState("");

  function exportCurrent() {
    download(`${safeFileName(song.title || "未命名歌曲")}.json`, exportSongsToJson([song]));
  }

  function exportAll() {
    download("guitar-chord-board-songs.json", exportSongsToJson(songs));
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    try {
      const imported = parseImportedJson(await file.text());

      if (!imported || imported.length === 0) {
        setMessage("這個檔案不是有效的歌曲備份。");
      } else {
        library.importSongs(imported);
        setMessage(`已匯入 ${imported.length} 首歌。`);
      }
    } catch {
      setMessage("讀取檔案失敗。");
    }

    if (fileRef.current) fileRef.current.value = "";
  }

  function remove() {
    if (window.confirm(`要刪除「${song.title || "未命名歌曲"}」嗎？此動作無法復原。`)) {
      library.deleteSong();
    }
  }

  return (
    <div className="song-bar">
      {library.saveFailed && (
        <div className="song-bar__warning" role="alert">
          無法儲存到瀏覽器（可能是無痕模式或空間已滿）。請用「更多 → 匯出」備份，否則關閉頁面後內容會消失。
        </div>
      )}

      {draft && (
        <div className="share-banner" role="status">
          <span>你正在檢視別人分享的歌曲，還沒有存進你的歌單。</span>
          <span className="share-banner__actions">
            <button type="button" className="primary-button" onClick={library.saveDraft}>
              存入我的歌單
            </button>
            <button type="button" className="ghost-button" onClick={library.discardDraft}>
              放棄
            </button>
          </span>
        </div>
      )}

      <div className="song-bar__row">
        {!draft && (
          <label className="song-bar__select">
            <span>歌單</span>
            <select value={song.id} onChange={(event) => library.selectSong(event.target.value)}>
              {songs.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title || "未命名歌曲"}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="song-bar__title">
          <span>歌名</span>
          <input
            type="text"
            value={song.title}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="例如：傾訴"
            onChange={(event) => {
              const title = event.target.value;
              library.updateSong((current) => ({ ...current, title }), "title");
            }}
          />
        </label>

        <label className="song-bar__key">
          <span>調號</span>
          <select
            value={song.key ?? ""}
            onChange={(event) => {
              const key = event.target.value || undefined;
              library.updateSong((current) => ({ ...current, key }));
            }}
          >
            <option value="">未設定</option>
            {KEY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="song-bar__key">
          <span>大調／小調</span>
          <select
            value={song.mode === "minor" ? "minor" : "major"}
            onChange={(event) => {
              const mode = event.target.value === "minor" ? ("minor" as const) : undefined;
              library.updateSong((current) => ({ ...current, mode }));
            }}
          >
            <option value="major">大調</option>
            <option value="minor">小調</option>
          </select>
        </label>

        <label className="song-bar__key">
          <span>拍號</span>
          <select
            value={song.timeSignature ?? ""}
            onChange={(event) => {
              const timeSignature = event.target.value || undefined;
              library.updateSong((current) => ({ ...current, timeSignature }));
            }}
          >
            <option value="">未設定</option>
            {TIME_SIGNATURES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="song-bar__key" title="沒有個別設定拍數的和弦，都用這個拍數（以拍號分子為單位）">
          <span>預設拍數</span>
          <select
            value={song.defaultBeats ?? ""}
            onChange={(event) => {
              const defaultBeats = event.target.value ? Number(event.target.value) : undefined;
              library.updateSong((current) => ({ ...current, defaultBeats }));
            }}
          >
            <option value="">未設定</option>
            {BEAT_CHOICES.map((value) => (
              <option key={value} value={value}>
                {value} 拍
              </option>
            ))}
          </select>
        </label>

        <div className="song-bar__actions">
          <button
            type="button"
            className="ghost-button"
            onClick={library.undo}
            disabled={!library.canUndo}
            title="復原上一個動作"
          >
            ↶ 復原
          </button>

          {!draft && (
            <button type="button" className="ghost-button" onClick={library.newSong}>
              ＋ 新歌
            </button>
          )}

          {showShare && <ShareButton song={song} />}

          <details className="song-bar__more" ref={moreRef}>
            <summary>更多</summary>
            <div className="song-bar__menu" onClick={closeMenu}>
              {!draft && (
                <button type="button" onClick={library.duplicateSong}>
                  複製這首歌
                </button>
              )}
              <button type="button" onClick={exportCurrent}>
                匯出這首（檔案）
              </button>
              <button type="button" onClick={exportAll}>
                匯出全部歌曲
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}>
                從檔案匯入
              </button>
              {!draft && (
                <button type="button" className="is-danger" onClick={remove}>
                  刪除這首歌
                </button>
              )}
            </div>
          </details>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      </div>

      {message && (
        <p className="song-bar__message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
