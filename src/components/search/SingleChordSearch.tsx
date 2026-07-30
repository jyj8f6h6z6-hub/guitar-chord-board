import { useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ACCIDENTAL_OPTIONS,
  CHORD_TYPE_OPTIONS,
  ROOT_NOTES,
  buildChordSymbol,
} from "../../data/chordTypes";
import type { Accidental, RootNote } from "../../data/chordTypes";
import { getChordTheory } from "../../services/chordTheory";
import { ChordCard } from "../chord/ChordCard";

export function SingleChordSearch() {
  const [rootNote, setRootNote] = useState<RootNote>("C");
  const [accidental, setAccidental] = useState<Accidental>("");
  const [chordType, setChordType] = useState("");
  const [selectedChord, setSelectedChord] = useState("C");
  const resultRef = useRef<HTMLDivElement>(null);

  const previewChord = buildChordSymbol(rootNote, accidental, chordType);
  const selectedType =
    CHORD_TYPE_OPTIONS.find((option) => option.suffix === chordType) ?? CHORD_TYPE_OPTIONS[0];
  const theory = getChordTheory(selectedChord);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedChord(previewChord);

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

          <form className="search-panel chord-builder" onSubmit={handleSubmit}>
            <div className="chord-builder__controls" aria-label="和弦選擇">
              <label className="chord-select-field" htmlFor="chord-root">
                <span>根音</span>
                <select
                  id="chord-root"
                  value={rootNote}
                  onChange={(event) => setRootNote(event.target.value as RootNote)}
                >
                  {ROOT_NOTES.map((note) => (
                    <option key={note} value={note}>
                      {note}
                    </option>
                  ))}
                </select>
              </label>

              <label className="chord-select-field" htmlFor="chord-accidental">
                <span>升降記號</span>
                <select
                  id="chord-accidental"
                  value={accidental}
                  onChange={(event) => setAccidental(event.target.value as Accidental)}
                >
                  {ACCIDENTAL_OPTIONS.map((option) => (
                    <option key={option.value || "natural"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className="chord-select-field chord-select-field--type"
                htmlFor="chord-type"
              >
                <span>和弦類型</span>
                <select
                  id="chord-type"
                  value={chordType}
                  onChange={(event) => setChordType(event.target.value)}
                >
                  {CHORD_TYPE_OPTIONS.map((option) => (
                    <option key={option.suffix || "major"} value={option.suffix}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="chord-builder__summary" aria-live="polite">
              <div className="chord-builder__selection">
                <span>目前選擇</span>
                <strong>{previewChord}</strong>
                <small>{selectedType.label}</small>
              </div>

              <div className="chord-feeling">
                <span>聽感描述</span>
                <p>{selectedType.description}</p>
              </div>
            </div>

            <button type="submit" className="primary-button chord-builder__submit">
              顯示按法
            </button>

            <p className="chord-builder__note">
              根音是 C、D、E、F、G、A、B；自然音表示不加 ♯ 或 ♭。若資料庫尚未收錄某個組合，右側仍會顯示組成音並提示尚未收錄吉他按法。
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
              無法辨識「{selectedChord}」。請改選其他根音、升降記號或和弦類型。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
