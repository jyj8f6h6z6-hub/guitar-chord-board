import { useEffect, useState } from "react";
import { APP_VERSION, experimentalLabel } from "./version";

import { SingleChordSearch } from "./components/search/SingleChordSearch";
import { SongChordMode } from "./components/search/SongChordMode";
import { SongChordOverview } from "./components/search/SongChordOverview";
import { PerformView } from "./components/song/PerformView";
import { SongBar } from "./components/song/SongBar";
import "./mode3.css";

import { useSongLibrary } from "./hooks/useSongLibrary";
import { setLeftHanded, useLeftHanded } from "./services/persistence";
import { getTranspositionSemitones, keyPrefersFlats, transposeChordSymbol } from "./services/chordTranspose";
import { applySymbols, linesFromSymbols } from "./services/songModel";
import { hasSharedSongInUrl, readSharedSongFromUrl } from "./services/songStorage";
import type { AppMode } from "./types/chord";

const REPOSITORY_URL =
  "https://github.com/jyj8f6h6z6-hub/guitar-chord-board";

function stripShareParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("s");
  url.searchParams.delete("chords");
  url.searchParams.delete("title");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function App() {
  const library = useSongLibrary();
  const { song, draft, openDraft } = library;
  const [mode, setMode] = useState<AppMode>(
    hasSharedSongInUrl(window.location.search) ? "overview" : "single",
  );
  const [shareFailed, setShareFailed] = useState(false);
  const leftHanded = useLeftHanded();

  // 分享連結：開成「草稿」，使用者按「存入我的歌單」才會保存。
  useEffect(() => {
    if (!hasSharedSongInUrl(window.location.search)) {
      return;
    }

    let cancelled = false;

    void readSharedSongFromUrl(window.location.search).then((shared) => {
      if (cancelled) return;

      if (shared) {
        openDraft(shared);
      } else {
        setShareFailed(true);
        setMode("single");
      }

      stripShareParams();
    });

    return () => {
      cancelled = true;
    };
  }, [openDraft]);

  function applyProgression(symbols: string[], lineSize = 4) {
    library.updateSong((current) => ({ ...current, lines: linesFromSymbols(symbols, lineSize) }));
  }

  function applyTransposition(symbols: readonly string[], newKey: string) {
    library.updateSong((current) => {
      const semitones = getTranspositionSemitones(current.key ?? "C", newKey);
      const preferFlats = keyPrefersFlats(newKey);
      const palette = current.palette?.map((symbol) => transposeChordSymbol(symbol, semitones, preferFlats));

      return { ...applySymbols(current, symbols), key: newKey, ...(palette ? { palette } : {}) };
    });
  }

  function changeKey(key: string) {
    library.updateSong((current) => ({ ...current, key }));
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="brand"
          href="./"
          aria-label="Guitar Chord Board 首頁"
        >
          <span className="brand-mark" aria-hidden="true">
            G♯
          </span>

          <span>
            <strong>
              Guitar Chord Board
              {experimentalLabel() && <em className="exp-badge">{experimentalLabel()}</em>}
            </strong>
            <small>和弦按法與組成音工具</small>
          </span>
        </a>

        <div className="site-header__actions">
          <button
            type="button"
            className={`header-toggle${leftHanded ? " is-active" : ""}`}
            aria-pressed={leftHanded}
            onClick={() => setLeftHanded(!leftHanded)}
            title="將和弦圖左右鏡射，適合左手彈奏"
          >
            左手模式
          </button>

          <a
            className="github-link"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">PLAY · LEARN · ARRANGE</p>
            <h1>看懂和弦，立即開始彈。</h1>
          </div>
        </section>

        <nav className="main-navigation" aria-label="主要功能">
          <button
            type="button"
            className={`main-navigation__single${
              mode === "single" ? " is-active" : ""
            }`}
            onClick={() => setMode("single")}
          >
            單一和弦查詢
          </button>

          <span className="main-navigation__divider" aria-hidden="true" />

          <div className="arrangement-navigation">
            <button
              type="button"
              className={`arrangement-navigation__step${
                mode === "song" ? " is-active" : ""
              }`}
              onClick={() => setMode("song")}
            >
              <span className="arrangement-navigation__number">①</span>
              <span className="nav-label-long">建立和弦編排</span>
              <span className="nav-label-short">建立編排</span>
            </button>

            <span className="arrangement-navigation__arrow" aria-hidden="true">
              →
            </span>

            <button
              type="button"
              className={`arrangement-navigation__step${
                mode === "overview" ? " is-active" : ""
              }`}
              onClick={() => setMode("overview")}
            >
              <span className="arrangement-navigation__number">②</span>
              <span className="nav-label-long">精簡總覽與移調</span>
              <span className="nav-label-short">總覽移調</span>
            </button>

            <span className="arrangement-navigation__arrow" aria-hidden="true">
              →
            </span>

            <button
              type="button"
              className={`arrangement-navigation__step${
                mode === "perform" ? " is-active" : ""
              }`}
              onClick={() => setMode("perform")}
            >
              <span className="arrangement-navigation__number">③</span>
              <span className="nav-label-long">演奏模式</span>
              <span className="nav-label-short">演奏</span>
            </button>
          </div>
        </nav>

        {shareFailed && mode === "single" && (
          <div className="share-banner" role="alert">
            <span>這個分享連結無法讀取（可能不完整或已損壞）。</span>
            <button type="button" className="ghost-button" onClick={() => setShareFailed(false)}>
              知道了
            </button>
          </div>
        )}

        {mode !== "single" && <SongBar library={library} showShare={mode !== "perform"} />}

        {mode === "single" && <SingleChordSearch />}

        {mode === "song" && (
          <SongChordMode
            song={song}
            onChange={library.updateSong}
            onApplyProgression={applyProgression}
          />
        )}

        {mode === "overview" && (
          <SongChordOverview
            song={song}
            onApplyTransposition={applyTransposition}
            onKeyChange={changeKey}
            onPerform={() => setMode("perform")}
          />
        )}

        {mode === "perform" && (
          <>
            <div className="notice">演奏模式已開啟。按「✕ 結束」或 Esc 可離開。</div>
            <PerformView song={song} onExit={() => setMode("overview")} />
          </>
        )}
      </main>

      <footer>
        <span>
          Guitar Chord Board · {APP_VERSION}
          {experimentalLabel() ? `（${experimentalLabel()}）` : ""}
        </span>
        <span>{draft ? "分享的歌曲尚未存入" : "歌曲只儲存在你的瀏覽器"}</span>
      </footer>
    </div>
  );
}

export default App;
