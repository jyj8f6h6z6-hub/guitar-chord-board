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
  const [bassPitchClass, setBassPitchClass] = useState<number | null>(null);

  const rootOption =
    ROOT_KEY_OPTIONS.find((option) => option.pitchClass === pitchClass) ??
    ROOT_KEY_OPTIONS[0];
  const rootSymbol = rootOption[notation];
  // 低音與根音相同就等於原位和弦，不加斜線。
  const bassOption =
    bassPitchClass !== null && bassPitchClass !== pitchClass
      ? ROOT_KEY_OPTIONS.find((option) => option.pitchClass === bassPitchClass)
      : undefined;
  const selectedChord = `${rootSymbol}${chordType}${
    bassOption ? `/${bassOption[notation]}` : ""
  }`;
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

            <fieldset className="ux-fieldset">
              <legend className="ux-legend">
                <span>
                  低音<small className="ux-legend__hint">（選填，分數和弦如 C/G）</small>
                </span>

                {bassOption && (
                  <button
                    type="button"
                    className="ux-clear"
                    onClick={() => setBassPitchClass(null)}
                  >
                    恢復原位
                  </button>
                )}
              </legend>

              <div className="ux-key-grid">
                {ROOT_KEY_OPTIONS.map((option) => {
                  const isRoot = option.pitchClass === pitchClass;
                  const isActive = bassOption?.pitchClass === option.pitchClass;

                  return (
                    <button
                      key={option.pitchClass}
                      type="button"
                      className={`ux-key${
                        option.sharp !== option.flat ? " is-black" : ""
                      }${isActive ? " is-active" : ""}`}
                      aria-pressed={isActive}
                      disabled={isRoot}
                      title={isRoot ? "與根音相同" : undefined}
                      onClick={() =>
                        setBassPitchClass(isActive ? null : option.pitchClass)
                      }
                    >
                      {formatNoteLabel(option[notation])}
                    </button>
                  );
                })}
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
