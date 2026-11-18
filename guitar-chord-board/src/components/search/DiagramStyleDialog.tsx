import { useEffect, useMemo, useState } from "react";
import { ChordDiagram, DEFAULT_DIAGRAM_STYLE } from "../chord/ChordDiagram";
import { findChordShapes } from "../../data/chordShapes";
import type { ChordShape } from "../../types/chord";
import {
  DEFAULT_OVERVIEW_SETTINGS,
  DIAGRAM_MAX,
  DIAGRAM_MIN,
  DOT_PCT,
  FRET_PCT,
  LINE_PCT,
} from "../../services/overviewSettings";
import { StepperRange } from "./OverviewControls";

export interface DiagramStyleValues {
  diagramPx: number;
  fretPct: number;
  linePct: number;
  dotPct: number;
}

interface DiagramStyleDialogProps {
  initial: DiagramStyleValues;
  onApply: (values: DiagramStyleValues) => void;
  onClose: () => void;
}

/** 範例圖：開放和弦、封閉和弦、高把位、兩位數格數 */
function pickSamples(): { label: string; shape: ChordShape }[] {
  const symbols = ["C", "G", "F", "B♭", "E♭", "A", "D", "B", "F♯", "C♯", "G♯", "A♭"];
  const all = symbols.flatMap((symbol) => findChordShapes(symbol));
  const samples: { label: string; shape: ChordShape | undefined }[] = [
    { label: "開放", shape: all.find((shape) => shape.baseFret === 1 && !shape.barres?.length) },
    { label: "封閉", shape: all.find((shape) => shape.baseFret === 1 && shape.barres?.length) },
    { label: "高把位", shape: all.find((shape) => shape.baseFret >= 3 && shape.baseFret <= 9 && shape.barres?.length) },
    { label: "兩位數格", shape: all.find((shape) => shape.baseFret >= 10) },
  ];

  return samples.filter((sample): sample is { label: string; shape: ChordShape } => sample.shape !== undefined);
}

/** 和弦圖樣式視窗：先在範例圖上調整，滿意再按「套用」。 */
export function DiagramStyleDialog({ initial, onApply, onClose }: DiagramStyleDialogProps) {
  const [draft, setDraft] = useState<DiagramStyleValues>(initial);
  const samples = useMemo(pickSamples, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const patch = (next: Partial<DiagramStyleValues>) => setDraft((current) => ({ ...current, ...next }));
  const style = { fretPct: draft.fretPct, linePct: draft.linePct, dotPct: draft.dotPct };

  return (
    <div className="diagram-dialog" role="dialog" aria-modal="true" aria-label="和弦圖樣式" onClick={onClose}>
      <div className="diagram-dialog__panel" onClick={(event) => event.stopPropagation()}>
        <h3>和弦圖樣式</h3>
        <p className="diagram-dialog__note">範例圖依目前設定的實際大小顯示；按「套用」才會改到歌譜，按「取消」維持原樣。</p>

        <div className="diagram-dialog__body">
          <div className="diagram-dialog__samples">
            {samples.map(({ label, shape }) => (
              <figure key={label} className="diagram-dialog__sample">
                <div className="diagram-dialog__sample-figure">
                  <ChordDiagram shape={shape} compact width={draft.diagramPx} diagramStyle={style} displaySymbol={shape.symbol} />
                </div>
                <figcaption>
                  {label}・{shape.symbol}
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="diagram-dialog__controls">
            <StepperRange
              label="和弦圖大小"
              unit="px"
              value={draft.diagramPx}
              min={DIAGRAM_MIN}
              max={DIAGRAM_MAX}
              onChange={(value) => patch({ diagramPx: value })}
            />
            <StepperRange
              label="格數數字大小"
              unit="％格高"
              value={draft.fretPct}
              min={FRET_PCT.min}
              max={FRET_PCT.max}
              valueText={(value) => `${(value / 100).toFixed(1)} 格高`}
              onChange={(value) => patch({ fretPct: value })}
              hint="封閉和弦左邊的格數數字；100＝一格高，200＝兩格高"
            />
            <StepperRange
              label="琴弦與格線粗細"
              unit="％"
              value={draft.linePct}
              min={LINE_PCT.min}
              max={LINE_PCT.max}
              onChange={(value) => patch({ linePct: value })}
            />
            <StepperRange
              label="指位圓點大小"
              unit="％"
              value={draft.dotPct}
              min={DOT_PCT.min}
              max={DOT_PCT.max}
              onChange={(value) => patch({ dotPct: value })}
            />
          </div>
        </div>

        <div className="diagram-dialog__actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              setDraft({
                diagramPx: DEFAULT_OVERVIEW_SETTINGS.diagramPx,
                fretPct: DEFAULT_DIAGRAM_STYLE.fretPct,
                linePct: DEFAULT_DIAGRAM_STYLE.linePct,
                dotPct: DEFAULT_DIAGRAM_STYLE.dotPct,
              })
            }
          >
            還原預設
          </button>
          <span className="diagram-dialog__spacer" />
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={() => onApply(draft)}>
            套用
          </button>
        </div>
      </div>
    </div>
  );
}
