import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ChordCard } from "../chord/ChordCard";
import { getChordTheory } from "../../services/chordTheory";
import { normalizeChordName } from "../../utils/normalizeChordName";

export function SingleChordSearch() {
  const [input, setInput] = useState("C");
  const [selectedChord, setSelectedChord] = useState("C");
  const resultRef = useRef<HTMLDivElement>(null);
  const theory = getChordTheory(selectedChord);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeChordName(input);

    if (!normalized) {
      return;
    }

    setSelectedChord(normalized);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (window.matchMedia("(max-width: 700px)").matches) {
      window.requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  return (
    <section className="workspace workspace--single" aria-labelledby="single-mode-title">
      <div className="single-workspace-grid">
        <div className="single-search-column">
          <div className="workspace__intro">
            <h2 id="single-mode-title">查單一和弦</h2>
          </div>

          <form className="search-panel" onSubmit={handleSubmit}>
            <label htmlFor="single-chord">和弦名稱</label>
            <div className="search-row">
              <input
                id="single-chord"
                value={input}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setInput(event.target.value)}
                placeholder="例如：Cmaj7"
                autoComplete="off"
                enterKeyHint="search"
              />
              <button type="submit" className="primary-button">
                顯示按法
              </button>
            </div>
            <p className="input-help">
              支援 #、♯、b、♭、同音異名與斜線和弦格式，例如 A# 會套用 Bb 按法。
            </p>
          </form>
        </div>

        <div ref={resultRef} className="single-result-region" aria-live="polite">
          {theory.valid ? (
            <div className="single-result">
              <ChordCard symbol={selectedChord} />
            </div>
          ) : (
            <div className="notice notice--error" role="alert">
              無法辨識「{selectedChord}」。請檢查和弦名稱，例如 Cm、C7、F#m7。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
