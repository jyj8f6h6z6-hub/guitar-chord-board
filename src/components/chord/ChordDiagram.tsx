import type { ChordShape } from "../../types/chord";

interface ChordDiagramProps {
  shape: ChordShape;
  compact?: boolean;
  displaySymbol?: string;
}

const STRING_X = [40, 68, 96, 124, 152, 180] as const;
const GRID_TOP = 54;
const FRET_HEIGHT = 34;
const FRET_COUNT = 5;

export function ChordDiagram({ shape, compact = false, displaySymbol }: ChordDiagramProps) {
  const width = compact ? 136 : 220;
  const symbol = displaySymbol ?? shape.symbol;

  return (
    <svg
      className="chord-diagram"
      viewBox="0 0 220 250"
      width={width}
      role="img"
      aria-label={`${symbol} 吉他和弦按法圖`}
    >
      <title>{symbol} 吉他和弦按法圖</title>

      {shape.baseFret > 1 && (
        <text x="9" y={GRID_TOP + 22} className="diagram-base-fret">
          {shape.baseFret}fr
        </text>
      )}

      {shape.frets.map((fret, stringIndex) => {
        const x = STRING_X[stringIndex];
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
        />
      ))}

      {shape.barres?.map((barre, index) => {
        const y = fretToY(barre.fret, shape.baseFret);
        const startX = STRING_X[barre.fromString - 1];
        const endX = STRING_X[barre.toString - 1];

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
            <circle cx={STRING_X[stringIndex]} cy={y} r="12" className="diagram-dot" />
            {finger && (
              <text
                x={STRING_X[stringIndex]}
                y={y + 4}
                textAnchor="middle"
                className="diagram-finger"
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
          x={STRING_X[index]}
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
