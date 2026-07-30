import { useMemo, useState } from "react";
import packageJson from "../package.json";
import { SingleChordSearch } from "./components/search/SingleChordSearch";
import { SongChordMode } from "./components/search/SongChordMode";
import { SongChordOverview } from "./components/search/SongChordOverview";
import "./mode3.css";
import { parseChordInput, uniqueChordSymbols } from "./services/chordParser";
import type { AppMode } from "./types/chord";

const REPOSITORY_URL = "https://github.com/jyj8f6h6z6-hub/guitar-chord-board";

function App() {
  const [mode, setMode] = useState<AppMode>("single");
  const [songInput, setSongInput] = useState("C G Am F");
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [songShapeIds, setSongShapeIds] = useState<Record<number, string>>({});

  const songSymbols = useMemo(() => {
    const parsed = parseChordInput(songInput);
    return removeDuplicates ? uniqueChordSymbols(parsed) : parsed;
  }, [songInput, removeDuplicates]);

  function updateSongInput(value: string) {
    setSongInput(value);
    setSongShapeIds({});
  }

  function updateRemoveDuplicates(value: boolean) {
    setRemoveDuplicates(value);
    setSongShapeIds({});
  }

  function replaceSongChord(index: number, newSymbol: string) {
    const nextSymbols = [...songSymbols];
    nextSymbols[index] = newSymbol;
    setSongInput(nextSymbols.join(" "));
    setSongShapeIds((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  }

  function selectSongShape(index: number, shapeId: string) {
    setSongShapeIds((current) => ({ ...current, [index]: shapeId }));
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./" aria-label="Guitar Chord Board 首頁">
          <span className="brand-mark" aria-hidden="true">
            G♯
          </span>
          <span>
            <strong>Guitar Chord Board</strong>
            <small>和弦按法與組成音工具</small>
          </span>
        </a>
        <a className="github-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
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
        </nav>

        {mode === "single" && <SingleChordSearch />}
        {mode === "song" && (
          <SongChordMode
            input={songInput}
            onInputChange={updateSongInput}
            removeDuplicates={removeDuplicates}
            onRemoveDuplicatesChange={updateRemoveDuplicates}
            symbols={songSymbols}
            selectedShapeIds={songShapeIds}
            onShapeChange={selectSongShape}
            onReplaceChord={replaceSongChord}
          />
        )}
        {mode === "overview" && (
          <SongChordOverview symbols={songSymbols} selectedShapeIds={songShapeIds} />
        )}
      </main>

      <footer>
        <span>Guitar Chord Board · {packageJson.version}</span>
        <span>React + TypeScript + Tonal + SVG</span>
      </footer>
    </div>
  );
}

export default App;
