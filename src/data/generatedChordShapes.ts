import type { Barre, ChordShape, FretValue } from "../types/chord";

type SixValues<T> = readonly [T, T, T, T, T, T];
type FretOffset = number | "x";

interface RootPosition {
  symbol: string;
  id: string;
  fret: number;
}

interface BarreTemplate {
  fretOffset: number;
  fromString: number;
  toString: number;
  finger?: number;
}

interface ChordTemplate {
  suffix: string;
  id: string;
  displayName: string;
  fretOffsets: SixValues<FretOffset>;
  fingers: SixValues<number | null>;
  barres?: readonly BarreTemplate[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: readonly string[];
}

/**
 * 所有自動補齊按法都以 A 弦為根音。
 * 第 1～12 格剛好涵蓋一個完整的十二平均律音域。
 */
const ROOT_POSITIONS: readonly RootPosition[] = [
  { symbol: "Bb", id: "b-flat", fret: 1 },
  { symbol: "B", id: "b", fret: 2 },
  { symbol: "C", id: "c", fret: 3 },
  { symbol: "C#", id: "c-sharp", fret: 4 },
  { symbol: "D", id: "d", fret: 5 },
  { symbol: "Eb", id: "e-flat", fret: 6 },
  { symbol: "E", id: "e", fret: 7 },
  { symbol: "F", id: "f", fret: 8 },
  { symbol: "F#", id: "f-sharp", fret: 9 },
  { symbol: "G", id: "g", fret: 10 },
  { symbol: "Ab", id: "a-flat", fret: 11 },
  { symbol: "A", id: "a", fret: 12 },
];

/**
 * fretOffsets 的順序固定為：低音 E、A、D、G、B、高音 e。
 * 數字是相對於 A 弦根音琴格的位移，x 表示不彈。
 */
const CHORD_TEMPLATES: readonly ChordTemplate[] = [
  {
    suffix: "",
    id: "major",
    displayName: "Major",
    fretOffsets: ["x", 0, 2, 2, 2, 0],
    fingers: [null, 1, 3, 3, 3, 1],
    barres: [
      { fretOffset: 0, fromString: 2, toString: 6, finger: 1 },
      { fretOffset: 2, fromString: 3, toString: 5, finger: 3 },
    ],
    difficulty: 4,
    tags: ["major", "barre"],
  },
  {
    suffix: "m",
    id: "minor",
    displayName: "Minor",
    fretOffsets: ["x", 0, 2, 2, 1, 0],
    fingers: [null, 1, 3, 4, 2, 1],
    barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
    difficulty: 3,
    tags: ["minor", "barre"],
  },
  {
    suffix: "7",
    id: "dominant-7",
    displayName: "Dominant 7",
    fretOffsets: ["x", 0, 2, 0, 2, 0],
    fingers: [null, 1, 3, 1, 4, 1],
    barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
    difficulty: 3,
    tags: ["seventh", "barre"],
  },
  {
    suffix: "maj7",
    id: "major-7",
    displayName: "Major 7",
    fretOffsets: ["x", 0, 2, 1, 2, 0],
    fingers: [null, 1, 3, 2, 4, 1],
    barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
    difficulty: 3,
    tags: ["major-seventh", "barre"],
  },
  {
    suffix: "m7",
    id: "minor-7",
    displayName: "Minor 7",
    fretOffsets: ["x", 0, 2, 0, 1, 0],
    fingers: [null, 1, 3, 1, 2, 1],
    barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
    difficulty: 3,
    tags: ["minor-seventh", "barre"],
  },
  {
    suffix: "sus4",
    id: "sus4",
    displayName: "Suspended 4",
    fretOffsets: ["x", 0, 2, 2, 3, 0],
    fingers: [null, 1, 2, 2, 4, 1],
    barres: [
      { fretOffset: 0, fromString: 2, toString: 6, finger: 1 },
      { fretOffset: 2, fromString: 3, toString: 4, finger: 2 },
    ],
    difficulty: 4,
    tags: ["suspended", "barre"],
  },
  {
    suffix: "add9",
    id: "add9",
    displayName: "Add 9",
    fretOffsets: ["x", 0, 2, 4, 2, 0],
    fingers: [null, 1, 2, 4, 3, 1],
    barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
    difficulty: 4,
    tags: ["add9", "barre"],
  },
  {
    suffix: "sus2",
    id: "sus2",
    displayName: "Suspended 2",
    fretOffsets: ["x", 0, 2, 2, 0, 0],
    fingers: [null, 1, 3, 3, 1, 1],
    barres: [
      { fretOffset: 0, fromString: 2, toString: 6, finger: 1 },
      { fretOffset: 2, fromString: 3, toString: 4, finger: 3 },
    ],
    difficulty: 3,
    tags: ["suspended", "barre"],
  },
  {
    suffix: "m7b5",
    id: "minor-7-flat-5",
    displayName: "Half-diminished",
    fretOffsets: ["x", 0, 1, 0, 1, "x"],
    fingers: [null, 1, 2, 1, 3, null],
    barres: [{ fretOffset: 0, fromString: 2, toString: 4, finger: 1 }],
    difficulty: 3,
    tags: ["half-diminished", "compact-voicing"],
  },
  {
    suffix: "mM7",
    id: "minor-major-7",
    displayName: "Minor Major 7",
    fretOffsets: ["x", 0, 2, 1, 1, 0],
    fingers: [null, 1, 4, 2, 2, 1],
    barres: [
      { fretOffset: 0, fromString: 2, toString: 6, finger: 1 },
      { fretOffset: 1, fromString: 4, toString: 5, finger: 2 },
    ],
    difficulty: 4,
    tags: ["minor-major-seventh", "barre"],
  },
  {
    suffix: "maj9",
    id: "major-9",
    displayName: "Major 9",
    fretOffsets: ["x", 0, -1, 1, 0, "x"],
    fingers: [null, 2, 1, 4, 3, null],
    difficulty: 4,
    tags: ["major-ninth", "compact-voicing"],
  },
  {
    suffix: "7#9",
    id: "dominant-7-sharp-9",
    displayName: "Dominant 7 Sharp 9",
    fretOffsets: ["x", 0, -1, 0, 1, "x"],
    fingers: [null, 2, 1, 3, 4, null],
    difficulty: 4,
    tags: ["seventh", "sharp-nine", "compact-voicing"],
  },
];

/**
 * 只產生手寫資料尚未收錄的和弦，避免同一個和弦出現重複按法。
 */
export function createGeneratedChordShapes(
  existingSymbols: ReadonlySet<string>,
): readonly ChordShape[] {
  const generated: ChordShape[] = [];

  for (const root of ROOT_POSITIONS) {
    for (const template of CHORD_TEMPLATES) {
      const symbol = `${root.symbol}${template.suffix}`;

      if (existingSymbols.has(symbol)) {
        continue;
      }

      generated.push(createShape(root, template, symbol));
    }
  }

  return generated;
}

function createShape(
  root: RootPosition,
  template: ChordTemplate,
  symbol: string,
): ChordShape {
  const frets = template.fretOffsets.map((offset) =>
    offset === "x" ? "x" : root.fret + offset,
  ) as unknown as SixValues<FretValue>;

  const positiveFrets = frets.filter(
    (fret): fret is number => typeof fret === "number" && fret > 0,
  );
  const baseFret = Math.min(...positiveFrets);
  const barres = template.barres?.map<Barre>((barre) => ({
    fret: root.fret + barre.fretOffset,
    fromString: barre.fromString,
    toString: barre.toString,
    finger: barre.finger,
  }));

  return {
    id: `generated-${root.id}-${template.id}-a-root`,
    symbol,
    displayName: `${formatDisplayRoot(root.symbol)} ${template.displayName}`,
    frets,
    fingers: template.fingers,
    baseFret,
    ...(barres && barres.length > 0 ? { barres } : {}),
    difficulty: template.difficulty,
    position: frets.includes(0) ? "open" : "movable",
    variantLabel: `A 弦第 ${root.fret} 格根音`,
    tags: ["generated", "a-string-root", ...template.tags],
  };
}

function formatDisplayRoot(root: string): string {
  return root.replace("#", "♯").replace("b", "♭");
}
