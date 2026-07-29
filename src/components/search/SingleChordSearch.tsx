import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ChordCard } from "../chord/ChordCard";
import { getChordTheory } from "../../services/chordTheory";
import { normalizeChordName } from "../../utils/normalizeChordName";

export function SingleChordSearch() {
  const [input, setInput] = useState("C");
  const [selectedChord, setSelectedChord] = useState("C");
  const theory = getChordTheory(selectedChord);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeChordName(input);

    if (normalized) {
      setSelectedChord(normalized);
    }
  }

  return (
    <section className="workspace" aria-labelledby="single-mode-title">
      <div className="workspace__intro">
        <p className="eyebrow">模式一</p>
        <h2 id="single-mode-title">查一個不熟悉的和弦</h2>
        <p>輸入 C、F#m、Cmaj7 或 C/G；系統會顯示按法與組成音。</p>
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
          />
          <button type="submit" className="primary-button">
            顯示按法
          </button>
        </div>
        <p className="input-help">支援 #、♯、b、♭ 與斜線和弦格式。</p>
      </form>

      {theory.valid ? (
        <div className="single-result">
          <ChordCard symbol={selectedChord} />
        </div>
      ) : (
        <div className="notice notice--error" role="alert">
          無法辨識「{selectedChord}」。請檢查和弦名稱，例如 Cm、C7、F#m7。
        </div>
      )}
    </section>
  );
}
