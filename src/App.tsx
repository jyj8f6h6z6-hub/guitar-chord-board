import { useEffect, useState } from "react";
import packageJson from "../package.json";

import { SingleChordSearch } from "./components/search/SingleChordSearch";
import { SongChordMode } from "./components/search/SongChordMode";
import { SongChordOverview } from "./components/search/SongChordOverview";
import "./mode3.css";

import {
  DEFAULT_SONG_SYMBOLS,
  createSongState,
  loadSavedSong,
  parseSharedSong,
  saveSong,
  setLeftHanded,
  useLeftHanded,
} from "./services/persistence";
import type { SongState } from "./services/persistence";
import type { AppMode, SongChordItem } from "./types/chord";

const REPOSITORY_URL =
  "https://github.com/jyj8f6h6z6-hub/guitar-chord-board";

interface InitialState {
  song: SongState;
  fromShare: boolean;
}

function loadInitialState(): InitialState {
  const shared = parseSharedSong(window.location.search);

  if (shared) {
    return { song: shared, fromShare: true };
  }

  return {
    song: loadSavedSong() ?? createSongState(DEFAULT_SONG_SYMBOLS),
    fromShare: false,
  };
}

function removeDuplicateItems(
  items: readonly SongChordItem[],
): SongChordItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.symbol)) {
      return false;
    }

    seen.add(item.symbol);
    return true;
  });
}

function pruneShapeIds(
  shapeIds: Record<string, string>,
  items: readonly SongChordItem[],
): Record<string, string> {
  const remainingIds = new Set(items.map((item) => item.id));

  return Object.fromEntries(
    Object.entries(shapeIds).filter(([itemId]) => remainingIds.has(itemId)),
  );
}

function App() {
  const [initial] = useState(loadInitialState);
  const [mode, setMode] = useState<AppMode>(
    initial.fromShare ? "overview" : "single",
  );
  const [songItems, setSongItems] = useState<SongChordItem[]>(
    initial.song.items,
  );
  const [removeDuplicates, setRemoveDuplicates] = useState(
    initial.song.removeDuplicates,
  );
  const [songShapeIds, setSongShapeIds] = useState<Record<string, string>>(
    initial.song.shapeIds,
  );
  const [songTitle, setSongTitle] = useState(initial.song.title);
  // 開啟分享連結時，先不覆蓋使用者原本儲存的編排，等到有編輯才開始保存。
  const [persistEnabled, setPersistEnabled] = useState(!initial.fromShare);
  const leftHanded = useLeftHanded();

  useEffect(() => {
    if (!persistEnabled) {
      return;
    }

    saveSong({
      items: songItems,
      shapeIds: songShapeIds,
      removeDuplicates,
      title: songTitle,
    });
  }, [persistEnabled, songItems, songShapeIds, removeDuplicates, songTitle]);

  function updateSongItems(nextItems: SongChordItem[]) {
    const normalizedItems = removeDuplicates
      ? removeDuplicateItems(nextItems)
      : nextItems;

    setPersistEnabled(true);
    setSongItems(normalizedItems);
    setSongShapeIds((current) => pruneShapeIds(current, normalizedItems));
  }

  function updateRemoveDuplicates(value: boolean) {
    setPersistEnabled(true);
    setRemoveDuplicates(value);

    if (value) {
      updateSongItems(removeDuplicateItems(songItems));
    }
  }

  function replaceSongChord(itemId: string, newSymbol: string) {
    setPersistEnabled(true);
    setSongItems((current) => {
      const replacedItems = current.map((item) =>
        item.id === itemId ? { ...item, symbol: newSymbol } : item,
      );

      return removeDuplicates
        ? removeDuplicateItems(replacedItems)
        : replacedItems;
    });

    setSongShapeIds((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  function selectSongShape(itemId: string, shapeId: string) {
    setPersistEnabled(true);
    setSongShapeIds((current) => ({
      ...current,
      [itemId]: shapeId,
    }));
  }

  function applyOverviewTransposition(symbols: readonly string[]) {
    setPersistEnabled(true);
    setSongItems((current) =>
      current.map((item, index) => ({
        ...item,
        symbol: symbols[index] ?? item.symbol,
      })),
    );

    setSongShapeIds({});
  }

  function applyProgression(symbols: string[]) {
    const next = createSongState(symbols, [], removeDuplicates);

    setPersistEnabled(true);
    updateSongItems(next.items);
    setSongShapeIds({});
  }

  function updateSongTitle(title: string) {
    setPersistEnabled(true);
    setSongTitle(title);
  }

  function leaveSharedView() {
    // 回到不帶分享參數的網址，會重新載入本機保存的編排。
    window.location.assign(
      `${window.location.origin}${window.location.pathname}`,
    );
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
            <strong>Guitar Chord Board</strong>
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
          </div>
        </nav>

        {initial.fromShare && !persistEnabled && mode !== "single" && (
          <div className="share-banner" role="status">
            <span>你正在檢視分享連結的和弦編排。開始編輯後，會取代你本機儲存的內容。</span>
            <button type="button" className="ghost-button" onClick={leaveSharedView}>
              回到我的編排
            </button>
          </div>
        )}

        {mode === "single" && <SingleChordSearch />}

        {mode === "song" && (
          <SongChordMode
            items={songItems}
            onItemsChange={updateSongItems}
            removeDuplicates={removeDuplicates}
            onRemoveDuplicatesChange={updateRemoveDuplicates}
            selectedShapeIds={songShapeIds}
            onShapeChange={selectSongShape}
            onReplaceChord={replaceSongChord}
            onApplyProgression={applyProgression}
            title={songTitle}
          />
        )}

        {mode === "overview" && (
          <SongChordOverview
            items={songItems}
            selectedShapeIds={songShapeIds}
            onApplyTransposition={applyOverviewTransposition}
            title={songTitle}
            onTitleChange={updateSongTitle}
          />
        )}
      </main>

      <footer>
        <span>Guitar Chord Board · {packageJson.version}</span>
        <span>編排內容只儲存在你的瀏覽器</span>
      </footer>
    </div>
  );
}

export default App;
