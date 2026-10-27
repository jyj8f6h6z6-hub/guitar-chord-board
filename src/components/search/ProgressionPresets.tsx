import { useState } from "react";
import { PROGRESSION_CATEGORIES, PROGRESSION_PRESETS } from "../../data/progressions";
import type { ProgressionCategory, ProgressionPreset } from "../../data/progressions";
import {
  KEY_OPTIONS,
  getTranspositionSemitones,
  keyPrefersFlats,
  transposeChordSymbol,
} from "../../services/chordTranspose";

interface ProgressionPresetsProps {
  hasItems: boolean;
  onApply: (symbols: string[], lineSize?: number) => void;
}

export function ProgressionPresets({ hasItems, onApply }: ProgressionPresetsProps) {
  const [key, setKey] = useState("C");
  const [category, setCategory] = useState<ProgressionCategory>("pop");
  const categoryInfo = PROGRESSION_CATEGORIES.find((entry) => entry.id === category);
  const visible = PROGRESSION_PRESETS.filter((preset) => preset.category === category);

  function apply(preset: ProgressionPreset) {
    if (hasItems && !window.confirm("要用這組進行取代目前這首歌的和弦（含歌詞）嗎？可以用「復原」找回。")) {
      return;
    }

    const semitones = getTranspositionSemitones("C", key);
    const preferFlats = keyPrefersFlats(key);

    onApply(
      preset.chords.map((chord) => transposeChordSymbol(chord, semitones, preferFlats)),
      preset.lineSize,
    );
  }

  return (
    <details className="progression-presets" open={!hasItems}>
      <summary>
        <span>快速套用常用進行</span>
        <small>選調後一鍵帶入</small>
      </summary>

      <div className="progression-presets__body">
        <label className="progression-presets__key">
          <span>調</span>
          <select value={key} onChange={(event) => setKey(event.target.value)}>
            {KEY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="progression-presets__main">
        <div className="progression-presets__tabs" role="group" aria-label="進行類別">
          {PROGRESSION_CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={category === entry.id ? "is-active" : ""}
              aria-pressed={category === entry.id}
              onClick={() => setCategory(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {categoryInfo?.note && <p className="progression-presets__note">{categoryInfo.note}</p>}

        <div className="progression-presets__list">
          {visible.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="progression-preset"
              onClick={() => apply(preset)}
            >
              <strong>{preset.label}</strong>
              <small>{preset.hint}</small>
            </button>
          ))}
        </div>
        </div>
      </div>
    </details>
  );
}
