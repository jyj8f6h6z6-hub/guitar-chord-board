import { useMemo, useState } from "react";
import {
  KEY_OPTIONS,
  getTranspositionSemitones,
  keyPrefersFlats,
  transposeChordSymbol,
} from "../../services/chordTranspose";
import type { SongChordItem } from "../../types/chord";
import { ChordCard } from "../chord/ChordCard";

interface SongChordOverviewProps {
  items: readonly SongChordItem[];
  selectedShapeIds: Readonly<Record<string, string>>;
  onApplyTransposition: (symbols: readonly string[]) => void;
}

export function SongChordOverview({
  items,
  selectedShapeIds,
  onApplyTransposition,
}: SongChordOverviewProps) {
  const [sourceKey, setSourceKey] = useState("C");
  const [targetKey, setTargetKey] = useState("D");
  const [isPreviewing, setIsPreviewing] = useState(false);

  const transposedSymbols = useMemo(() => {
    const semitones = getTranspositionSemitones(sourceKey, targetKey);
    const preferFlats = keyPrefersFlats(targetKey);

    return items.map((item) =>
      transposeChordSymbol(item.symbol, semitones, preferFlats),
    );
  }, [items, sourceKey, targetKey]);

  const displayedSymbols = isPreviewing
    ? transposedSymbols
    : items.map((item) => item.symbol);

  function previewTransposition() {
    setIsPreviewing(true);
  }

  function restoreOriginalKey() {
    setTargetKey(sourceKey);
    setIsPreviewing(false);
  }

  function applyTransposition() {
    if (!isPreviewing || sourceKey === targetKey) {
      return;
    }

    onApplyTransposition(transposedSymbols);

    setSourceKey(targetKey);
    setIsPreviewing(false);
  }

  return (
    <section
      className="workspace workspace--overview"
      aria-labelledby="overview-mode-title"
    >
      <div className="workspace__intro">
        <p className="eyebrow">和弦編排・第二步</p>
        <h2 id="overview-mode-title">總覽與移調</h2>
      </div>

      <section
        className="overview-transpose-panel"
        aria-labelledby="overview-transpose-title"
      >
        <div className="overview-transpose-panel__heading">
          <div>
            <p className="eyebrow">移調</p>
            <h3 id="overview-transpose-title">調整歌曲調性</h3>
          </div>

          {isPreviewing && sourceKey !== targetKey && (
            <span className="overview-transpose-status">
              預覽中：{sourceKey} → {targetKey}
            </span>
          )}
        </div>

        <div className="overview-transpose-controls">
          <label className="overview-key-field" htmlFor="overview-source-key">
            <span className="overview-key-field__label">
              <span aria-hidden="true">♫</span>
              原調
            </span>

            <select
              id="overview-source-key"
              value={sourceKey}
              onChange={(event) => {
                setSourceKey(event.target.value);
                setIsPreviewing(false);
              }}
            >
              {KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <span className="overview-transpose-arrow" aria-hidden="true">
            →
          </span>

          <label className="overview-key-field" htmlFor="overview-target-key">
            <span className="overview-key-field__label">
              <span aria-hidden="true">⇄</span>
              目標調
            </span>

            <select
              id="overview-target-key"
              value={targetKey}
              onChange={(event) => {
                setTargetKey(event.target.value);
                setIsPreviewing(false);
              }}
            >
              {KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overview-transpose-actions">
          <button
            type="button"
            className="primary-button"
            onClick={previewTransposition}
            disabled={items.length === 0}
          >
            預覽移調
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={applyTransposition}
            disabled={
              items.length === 0 ||
              !isPreviewing ||
              sourceKey === targetKey
            }
          >
            套用到和弦編排區
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={restoreOriginalKey}
            disabled={!isPreviewing && sourceKey === targetKey}
          >
            恢復原調
          </button>
        </div>
      </section>

      <div className="song-overview-summary" aria-live="polite">
        <strong>{items.length} 個和弦</strong>

        <span>
          {isPreviewing
            ? "目前顯示移調預覽，尚未修改第一步的和弦編排。"
            : "內容與第一步建立的和弦編排同步。"}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="song-overview-grid">
          {items.map((item, index) => (
            <div className="song-overview-item" key={item.id}>
              <span
                className="song-overview-number"
                aria-label={`第 ${index + 1} 個和弦`}
              >
                {index + 1}
              </span>

              <ChordCard
                symbol={displayedSymbols[index]}
                compact
                eyebrow={isPreviewing ? "移調預覽" : "歌曲和弦"}
                selectedShapeId={
                  isPreviewing ? undefined : selectedShapeIds[item.id]
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="notice">
          尚未建立和弦編排。請先前往「① 建立和弦編排」加入並排列歌曲和弦。
        </div>
      )}
    </section>
  );
}
