import { useState } from "react";
import {
  CHORD_TYPE_OPTIONS,
  ROOT_KEY_OPTIONS,
  formatNoteLabel,
} from "../../data/chordTypes";
import type { RootNotation } from "../../data/chordTypes";
import { getChordTheory } from "../../services/chordTheory";
import { ChordCard } from "../chord/ChordCard";

const NOTATION_OPTIONS: readonly { value: RootNotation; label: string }[] = [
  { value: "common", label: "常用" },
  { value: "sharp", label: "♯" },
  { value: "flat", label: "♭" },
];

export function SingleChordSearch() {
  const [pitchClass, setPitchClass] = useState(0);
  const [notation, setNotation] = useState<RootNotation>("common");
  const [chordType, setChordType] = useState("");

  const rootOption =
    ROOT_KEY_OPTIONS.find((option) => option.pitchClass === pitchClass) ??
    ROOT_KEY_OPTIONS[0];
  const rootSymbol = rootOption[notation];
  const selectedChord = `${rootSymbol}${chordType}`;
  const selectedType =
    CHORD_TYPE_OPTIONS.find((option) => option.suffix === chordType) ??
    CHORD_TYPE_OPTIONS[0];
  const theory = getChordTheory(selectedChord);

  return (
    <section className="workspace workspace--single" aria-labelledby="single-mode-title">
      <div className="single-workspace-grid">
        <div className="single-search-column">
          <div className="workspace__intro">
            <h2 id="single-mode-title">查單一和弦</h2>
          </div>

          <div className="search-panel chord-builder ux-builder">
            <fieldset className="ux-fieldset">
              <legend className="ux-legend">
                <span>根音</span>

                <span className="ux-segmented" role="group" aria-label="升降記號寫法">
                  {NOTATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={notation === option.value ? "is-active" : ""}
                      aria-pressed={notation === option.value}
                      onClick={() => setNotation(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </span>
              </legend>

              <div className="ux-key-grid">
                {ROOT_KEY_OPTIONS.map((option) => {
                  const isActive = option.pitchClass === pitchClass;
                  const isBlackKey = option.sharp !== option.flat;

                  return (
                    <button
                      key={option.pitchClass}
                      type="button"
                      className={`ux-key${isBlackKey ? " is-black" : ""}${
                        isActive ? " is-active" : ""
                      }`}
                      aria-pressed={isActive}
                      onClick={() => setPitchClass(option.pitchClass)}
                    >
                      {formatNoteLabel(option[notation])}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="ux-fieldset">
              <legend className="ux-legend">
                <span>和弦類型</span>
              </legend>

              <div className="ux-type-grid">
                {CHORD_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.suffix || "major"}
                    type="button"
                    className={`ux-type${
                      option.suffix === chordType ? " is-active" : ""
                    }`}
                    aria-pressed={option.suffix === chordType}
                    onClick={() => setChordType(option.suffix)}
                  >
                    {option.short}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="ux-feeling" aria-live="polite">
              <strong>{selectedType.label}</strong>
              <span>{selectedType.description}</span>
            </p>
          </div>
        </div>

        <div className="single-result-region" aria-live="polite">
          {theory.valid ? (
            <div className="single-result">
              <ChordCard symbol={selectedChord} />
            </div>
          ) : (
            <div className="notice notice--error" role="alert">
              無法辨識「{selectedChord}」。請改選其他根音或和弦類型。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
