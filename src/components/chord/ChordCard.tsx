import { useEffect, useState } from "react";
import {
  findChordShapes,
  getShapeVariantLabel,
} from "../../data/chordShapes";
import { getChordTheory } from "../../services/chordTheory";
import { ChordDiagram } from "./ChordDiagram";

interface ChordCardProps {
  symbol: string;
  compact?: boolean;
  onSelect?: (symbol: string) => void;
  selectedShapeId?: string;
  onShapeChange?: (shapeId: string) => void;
  eyebrow?: string;
}

export function ChordCard({
  symbol,
  compact = false,
  onSelect,
  selectedShapeId,
  onShapeChange,
  eyebrow,
}: ChordCardProps) {
  const shapes = findChordShapes(symbol);
  const theory = getChordTheory(symbol);
  const [internalSelectedShapeId, setInternalSelectedShapeId] = useState(shapes[0]?.id ?? "");

  useEffect(() => {
    if (selectedShapeId === undefined) {
      setInternalSelectedShapeId(shapes[0]?.id ?? "");
    }
  }, [symbol, selectedShapeId]);

  const activeShapeId = selectedShapeId ?? internalSelectedShapeId;
  const shape = shapes.find((candidate) => candidate.id === activeShapeId) ?? shapes[0];
  const isAlias = theory.resolvedSymbol !== theory.symbol;

  function selectShape(shapeId: string) {
    if (selectedShapeId === undefined) {
      setInternalSelectedShapeId(shapeId);
    }
    onShapeChange?.(shapeId);
  }

  const content = (
    <>
      <div className="chord-card__header">
        <div>
          <p className="eyebrow">{eyebrow ?? (compact ? "相關和弦" : "和弦")}</p>
          <h3>{symbol}</h3>
          {!compact && (
            <>
              <p className="chord-card__name">{shape?.displayName ?? theory.name}</p>
              {isAlias && (
                <p className="chord-card__alias">按法與音名採用 {theory.resolvedSymbol}</p>
              )}
            </>
          )}
        </div>
        {!compact && shape && (
          <div className="chord-card__badges">
            <span className="position-badge">{getShapeVariantLabel(shape)}</span>
            <span className="difficulty" aria-label={`難度 ${shape.difficulty} / 5`}>
              難度 {shape.difficulty}/5
            </span>
          </div>
        )}
      </div>
      {shape ? (
        <ChordDiagram shape={shape} compact={compact} displaySymbol={symbol} />
      ) : (
        <div className="empty-diagram">
          <span>可解析組成音，但尚未收錄吉他按法</span>
        </div>
      )}
      {!compact && shapes.length > 1 && (
        <div className="shape-selector" role="group" aria-label={`${symbol} 按法選擇`}>
          <span className="meta-label">切換把位</span>
          <div className="shape-selector__buttons">
            {shapes.map((candidate, index) => (
              <button
                key={candidate.id}
                type="button"
                className={candidate.id === shape?.id ? "is-active" : ""}
                onClick={() => selectShape(candidate.id)}
                aria-pressed={candidate.id === shape?.id}
              >
                {index + 1}. {getShapeVariantLabel(candidate)}
              </button>
            ))}
          </div>
        </div>
      )}
      {!compact && (
        <>
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
          <p className="finger-legend">手指：1 食指 · 2 中指 · 3 無名指 · 4 小指</p>
        </>
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
