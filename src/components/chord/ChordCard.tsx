import { findChordShape } from "../../data/chordShapes";
import { getChordTheory } from "../../services/chordTheory";
import { ChordDiagram } from "./ChordDiagram";

interface ChordCardProps {
  symbol: string;
  compact?: boolean;
  onSelect?: (symbol: string) => void;
}

export function ChordCard({ symbol, compact = false, onSelect }: ChordCardProps) {
  const shape = findChordShape(symbol);
  const theory = getChordTheory(symbol);

  const content = (
    <>
      <div className="chord-card__header">
        <div>
          <p className="eyebrow">{compact ? "相關和弦" : "和弦"}</p>
          <h3>{symbol}</h3>
          {!compact && <p className="chord-card__name">{shape?.displayName ?? theory.name}</p>}
        </div>
        {!compact && shape && (
          <span className="difficulty" aria-label={`難度 ${shape.difficulty} / 5`}>
            難度 {shape.difficulty}/5
          </span>
        )}
      </div>

      {shape ? (
        <ChordDiagram shape={shape} compact={compact} />
      ) : (
        <div className="empty-diagram">
          <span>尚未收錄按法</span>
        </div>
      )}

      {!compact && (
        <div className="chord-card__meta">
          <div>
            <span className="meta-label">組成音</span>
            <strong>{theory.valid ? theory.notes.join(" · ") : "無法解析"}</strong>
          </div>
          {theory.bass && (
            <div>
              <span className="meta-label">低音</span>
              <strong>{theory.bass}</strong>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={`chord-card chord-card--button ${compact ? "chord-card--compact" : ""}`}
        onClick={() => onSelect(symbol)}
      >
        {content}
      </button>
    );
  }

  return <article className={`chord-card ${compact ? "chord-card--compact" : ""}`}>{content}</article>;
}
