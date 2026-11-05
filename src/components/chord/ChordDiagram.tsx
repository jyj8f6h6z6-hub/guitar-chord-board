import { useLeftHanded } from "../../services/persistence";
import type { ChordShape } from "../../types/chord";

/** 和弦圖樣式（百分比；100＝原本大小）。fretPct：格數數字高度，100＝一格高。 */
export interface DiagramStyle {
  fretPct: number;
  linePct: number;
  dotPct: number;
}

export const DEFAULT_DIAGRAM_STYLE: DiagramStyle = { fretPct: 200, linePct: 100, dotPct: 100 };

interface ChordDiagramProps {
  shape: ChordShape;
  compact?: boolean;
  displaySymbol?: string;
  /** 指定像素寬度（譜面用的小圖）；未指定時依 compact 決定 */
  width?: number;
  /** 指定樣式時（譜面用的圖）：格數數字畫在圖外、可調線條與圓點 */
  diagramStyle?: DiagramStyle;
}

const STRING_X = [40, 68, 96, 124, 152, 180] as const;
const GRID_TOP = 54;
const FRET_HEIGHT = 34;
const FRET_COUNT = 5;

export function ChordDiagram({ shape, compact = false, displaySymbol, width: widthProp, diagramStyle }: ChordDiagramProps) {
  const width = widthProp ?? (compact ? 136 : 220);
  const symbol = displaySymbol ?? shape.symbol;
  const leftHanded = useLeftHanded();
  // 左手模式：六弦到一弦由右往左排列，等同把圖左右鏡射。
  const xs = leftHanded ? [...STRING_X].reverse() : [...STRING_X];
  const line = (diagramStyle?.linePct ?? 100) / 100;
  const dot = (diagramStyle?.dotPct ?? 100) / 100;

  return (
    <svg
      className="chord-diagram"
      viewBox="-30 0 250 250"
      width={width}
      role="img"
      aria-label={`${symbol} 吉他和弦按法圖`}
      style={diagramStyle ? { overflow: "visible" } : undefined}
    >
      <title>{symbol} 吉他和弦按法圖</title>

      {shape.baseFret > 1 &&
        (diagramStyle ? (
          <text
            x={STRING_X[0] - 12}
            y={GRID_TOP + FRET_HEIGHT / 2}
            textAnchor="end"
            dominantBaseline="central"
            className="diagram-base-fret diagram-base-fret--styled"
            style={{
              // 數字高約等於 fretPct％ 格高；兩位數稍微縮小
              fontSize: `${((FRET_HEIGHT * diagramStyle.fretPct) / 100 / 0.72) * (shape.baseFret >= 10 ? 0.8 : 1)}px`,
              transform: "none",
            }}
          >
            {shape.baseFret}
          </text>
        ) : (
          <text x="9" y={GRID_TOP + 22} className="diagram-base-fret">
            {shape.baseFret}
          </text>
        ))}

      {shape.frets.map((fret, stringIndex) => {
        const x = xs[stringIndex];
        const marker = fret === "x" ? "×" : fret === 0 ? "○" : null;

        return marker ? (
          <text
            key={`marker-${stringIndex}`}
            x={x}
            y="29"
            textAnchor="middle"
            className="diagram-marker"
          >
            {marker}
          </text>
        ) : null;
      })}

      {Array.from({ length: FRET_COUNT + 1 }, (_, index) => {
        const y = GRID_TOP + index * FRET_HEIGHT;
        const isNut = index === 0 && shape.baseFret === 1;

        return (
          <line
            key={`fret-${index}`}
            x1={STRING_X[0]}
            y1={y}
            x2={STRING_X[STRING_X.length - 1]}
            y2={y}
            className={isNut ? "diagram-nut" : "diagram-fret"}
            style={diagramStyle ? { strokeWidth: (isNut ? 5 : 1.7) * line } : undefined}
          />
        );
      })}

      {STRING_X.map((x, index) => (
        <line
          key={`string-${index}`}
          x1={x}
          y1={GRID_TOP}
          x2={x}
          y2={GRID_TOP + FRET_COUNT * FRET_HEIGHT}
          className="diagram-string"
          style={diagramStyle ? { strokeWidth: 1.7 * line } : undefined}
        />
      ))}

      {shape.barres?.map((barre, index) => {
        const y = fretToY(barre.fret, shape.baseFret);
        const startX = xs[barre.fromString - 1];
        const endX = xs[barre.toString - 1];

        if (y === null || startX === undefined || endX === undefined) {
          return null;
        }

        return (
          <line
            key={`barre-${index}`}
            x1={startX}
            y1={y}
            x2={endX}
            y2={y}
            className="diagram-barre"
            style={diagramStyle ? { strokeWidth: 22 * dot } : undefined}
          />
        );
      })}

      {shape.frets.map((fret, stringIndex) => {
        if (typeof fret !== "number" || fret === 0) {
          return null;
        }

        const y = fretToY(fret, shape.baseFret);
        if (y === null) {
          return null;
        }

        const finger = shape.fingers[stringIndex];

        return (
          <g key={`dot-${stringIndex}`}>
            <circle cx={xs[stringIndex]} cy={y} r={12 * dot} className="diagram-dot" />
            {finger && (
              <text
                x={xs[stringIndex]}
                y={y + 4}
                textAnchor="middle"
                className="diagram-finger"
                style={diagramStyle ? { fontSize: `${12 * Math.min(dot, 1.4)}px` } : undefined}
              >
                {finger}
              </text>
            )}
          </g>
        );
      })}

      {(["E", "A", "D", "G", "B", "e"] as const).map((name, index) => (
        <text
          key={name}
          x={xs[index]}
          y="242"
          textAnchor="middle"
          className="diagram-string-name"
        >
          {name}
        </text>
      ))}
    </svg>
  );
}

function fretToY(fret: number, baseFret: number): number | null {
  const relativeFret = fret - baseFret;
  if (relativeFret < 0 || relativeFret >= FRET_COUNT) {
    return null;
  }

  return GRID_TOP + relativeFret * FRET_HEIGHT + FRET_HEIGHT / 2;
}
