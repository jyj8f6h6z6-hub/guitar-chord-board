import { useState } from "react";
import packageJson from "../package.json";
import { ScoreStudio } from "./components/score/ScoreStudio";
import { SingleChordSearch } from "./components/search/SingleChordSearch";
import { SongChordMode } from "./components/search/SongChordMode";
import { SongChordOverview } from "./components/search/SongChordOverview";
import "./mode3.css";
import "./score.css";
import type { AppMode, SongChordItem } from "./types/chord";

const REPOSITORY_URL =
  "https://github.com/jyj8f6h6z6-hub/guitar-chord-board";

function createSongChordItem(symbol: string): SongChordItem {
  return {
    id: crypto.randomUUID(),
    symbol,
  };
}

function createSongChordItems(symbols: readonly string[]): SongChordItem[] {
  return symbols.map(createSongChordItem);
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

function App() {
  const [mode, setMode] = useState<AppMode>("single");
  const [songItems, setSongItems] = useState<SongChordItem[]>(() =>
    createSongChordItems(["C", "G", "Am", "F"]),
  );
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [songShapeIds, setSongShapeIds] = useState<Record<string, string>>({});

  function updateSongItems(nextItems: SongChordItem[]) {
    const normalizedItems = removeDuplicates
      ? removeDuplicateItems(nextItems)
      : nextItems;

    setSongItems(normalizedItems);

    const remainingIds = new Set(normalizedItems.map((item) => item.id));

    setSongShapeIds((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([itemId]) =>
          remainingIds.has(itemId),
        ),
      ),
    );
  }

  function updateRemoveDuplicates(value: boolean) {
    setRemoveDuplicates(value);

    if (!value) {
      return;
    }

    setSongItems((current) => {
      const nextItems = removeDuplicateItems(current);
      const remainingIds = new Set(nextItems.map((item) => item.id));

      setSongShapeIds((currentShapes) =>
        Object.fromEntries(
          Object.entries(currentShapes).filter(([itemId]) =>
            remainingIds.has(itemId),
          ),
        ),
      );

      return nextItems;
    });
  }

  function replaceSongChord(itemId: string, newSymbol: string) {
    setSongItems((current) => {
      const replacedItems = current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              symbol: newSymbol,
            }
          : item,
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
    setSongShapeIds((current) => ({
      ...current,
      [itemId]: shapeId,
    }));
  }

  function replaceWithRecognizedChords(symbols: string[]) {
    const nextItems = createSongChordItems(symbols);

    setSongItems(
      removeDuplicates ? removeDuplicateItems(nextItems) : nextItems,
    );
    setSongShapeIds({});
  }

  function appendRecognizedChords(symbols: string[]) {
    setSongItems((current) => {
      const nextItems = [
        ...current,
        ...createSongChordItems(symbols),
      ];

      return removeDuplicates
        ? removeDuplicateItems(nextItems)
        : nextItems;
    });
  }

  function applyScoreChords(symbols: string[]) {
    replaceWithRecognizedChords(symbols);
    setMode("song");
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

        <a
          className="github-link"
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">PLAY · LEARN · ARRANGE</p>
            <h1>看懂和弦，立即開始彈。</h1>
          </div>
        </section>

        <nav className="mode-tabs" aria-label="選擇操作模式">
          <button
            type="button"
            className={mode === "single" ? "is-active" : ""}
            onClick={() => setMode("single")}
          >
            單一和弦查詢
          </button>

          <button
            type="button"
            className={mode === "song" ? "is-active" : ""}
            onClick={() => setMode("song")}
          >
            歌曲和弦清單
          </button>

          <button
            type="button"
            className={mode === "overview" ? "is-active" : ""}
            onClick={() => setMode("overview")}
          >
            精簡總覽
          </button>

          <button
            type="button"
            className={mode === "score" ? "is-active" : ""}
            onClick={() => setMode("score")}
          >
            智慧歌譜
          </button>
        </nav>

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
            onReplaceRecognized={replaceWithRecognizedChords}
            onAppendRecognized={appendRecognizedChords}
          />
        )}

        {mode === "overview" && (
          <SongChordOverview
            items={songItems}
            selectedShapeIds={songShapeIds}
          />
        )}

        {mode === "score" && (
          <ScoreStudio onApplyToSong={applyScoreChords} />
        )}
      </main>

      <footer>
        <span>Guitar Chord Board · {packageJson.version}</span>
        <span>React + TypeScript + Tonal + OCR + PDF</span>
      </footer>
    </div>
  );
}

export default App;
