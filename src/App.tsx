import { useState } from "react";
import { SingleChordSearch } from "./components/search/SingleChordSearch";
import { SongChordMode } from "./components/search/SongChordMode";
import type { AppMode } from "./types/chord";

const REPOSITORY_URL = "https://github.com/jyj8f6h6z6-hub/guitar-chord-board";

function App() {
  const [mode, setMode] = useState<AppMode>("single");

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
        </nav>

        {mode === "single" ? <SingleChordSearch /> : <SongChordMode />}
      </main>

      <footer>
        <span>Guitar Chord Board · 0.2.0</span>
        <span>React + TypeScript + Tonal + SVG</span>
      </footer>
    </div>
  );
}

export default App;
