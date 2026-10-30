import type { Barre, ChordShape, FretValue } from "../types/chord";

type SixValues<T> = readonly [T, T, T, T, T, T];
type FretOffset = number | "x";
type RootString = "low-e" | "a";

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

interface RootShapeTemplate {
  fretOffsets: SixValues<FretOffset>;
  fingers: SixValues<number | null>;
  barres?: readonly BarreTemplate[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: readonly string[];
}

interface ChordTemplate {
  suffix: string;
  id: string;
  displayName: string;
  lowERoot: RootShapeTemplate;
  aRoot: RootShapeTemplate;
}

interface RootFamily {
  rootString: RootString;
  label: string;
  positions: readonly RootPosition[];
}

/**
 * 低音 E 弦與 A 弦的根音把位。
 * 只列出第 1～11 格；第 12 格會重複空弦音高，因此不另外產生。
 */
const ROOT_FAMILIES: readonly RootFamily[] = [
  {
    rootString: "low-e",
    label: "低音 E 弦",
    positions: [
      { symbol: "F", id: "f", fret: 1 },
      { symbol: "F#", id: "f-sharp", fret: 2 },
      { symbol: "G", id: "g", fret: 3 },
      { symbol: "Ab", id: "a-flat", fret: 4 },
      { symbol: "A", id: "a", fret: 5 },
      { symbol: "Bb", id: "b-flat", fret: 6 },
      { symbol: "B", id: "b", fret: 7 },
      { symbol: "C", id: "c", fret: 8 },
      { symbol: "C#", id: "c-sharp", fret: 9 },
      { symbol: "D", id: "d", fret: 10 },
      { symbol: "Eb", id: "e-flat", fret: 11 },
    ],
  },
  {
    rootString: "a",
    label: "A 弦",
    positions: [
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
    ],
  },
];

/**
 * fretOffsets 的順序固定為：低音 E、A、D、G、B、高音 e。
 * 數字是相對於該把位根音琴格的位移，x 表示不彈。
 */
const CHORD_TEMPLATES: readonly ChordTemplate[] = [
  {
    suffix: "",
    id: "major",
    displayName: "Major",
    lowERoot: {
      fretOffsets: [0, 2, 2, 1, 0, 0],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [{ fretOffset: 0, fromString: 1, toString: 6, finger: 1 }],
      difficulty: 3,
      tags: ["major", "barre"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 2, 2, 2, 0],
      fingers: [null, 1, 3, 3, 3, 1],
      barres: [
        { fretOffset: 0, fromString: 2, toString: 6, finger: 1 },
        { fretOffset: 2, fromString: 3, toString: 5, finger: 3 },
      ],
      difficulty: 4,
      tags: ["major", "barre"],
    },
  },
  {
    suffix: "m",
    id: "minor",
    displayName: "Minor",
    lowERoot: {
      fretOffsets: [0, 2, 2, 0, 0, 0],
      fingers: [1, 3, 4, 1, 1, 1],
      barres: [{ fretOffset: 0, fromString: 1, toString: 6, finger: 1 }],
      difficulty: 3,
      tags: ["minor", "barre"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 2, 2, 1, 0],
      fingers: [null, 1, 3, 4, 2, 1],
      barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
      difficulty: 3,
      tags: ["minor", "barre"],
    },
  },
  {
    suffix: "7",
    id: "dominant-7",
    displayName: "Dominant 7",
    lowERoot: {
      fretOffsets: [0, 2, 0, 1, 0, 0],
      fingers: [1, 3, 1, 2, 1, 1],
      barres: [{ fretOffset: 0, fromString: 1, toString: 6, finger: 1 }],
      difficulty: 3,
      tags: ["seventh", "barre"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 2, 0, 2, 0],
      fingers: [null, 1, 3, 1, 4, 1],
      barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
      difficulty: 3,
      tags: ["seventh", "barre"],
    },
  },
  {
    suffix: "maj7",
    id: "major-7",
    displayName: "Major 7",
    lowERoot: {
      fretOffsets: [0, 2, 1, 1, 0, 0],
      fingers: [1, 4, 2, 3, 1, 1],
      barres: [{ fretOffset: 0, fromString: 1, toString: 6, finger: 1 }],
      difficulty: 3,
      tags: ["major-seventh", "barre"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 2, 1, 2, 0],
      fingers: [null, 1, 3, 2, 4, 1],
      barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
      difficulty: 3,
      tags: ["major-seventh", "barre"],
    },
  },
  {
    suffix: "m7",
    id: "minor-7",
    displayName: "Minor 7",
    lowERoot: {
      fretOffsets: [0, 2, 0, 0, 0, 0],
      fingers: [1, 3, 1, 1, 1, 1],
      barres: [{ fretOffset: 0, fromString: 1, toString: 6, finger: 1 }],
      difficulty: 3,
      tags: ["minor-seventh", "barre"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 2, 0, 1, 0],
      fingers: [null, 1, 3, 1, 2, 1],
      barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
      difficulty: 3,
      tags: ["minor-seventh", "barre"],
    },
  },
  {
    suffix: "sus4",
    id: "sus4",
    displayName: "Suspended 4",
    lowERoot: {
      fretOffsets: [0, 2, 2, 2, 0, 0],
      fingers: [1, 2, 3, 4, 1, 1],
      barres: [{ fretOffset: 0, fromString: 1, toString: 6, finger: 1 }],
      difficulty: 4,
      tags: ["suspended", "barre"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 2, 2, 3, 0],
      fingers: [null, 1, 2, 2, 4, 1],
      barres: [
        { fretOffset: 0, fromString: 2, toString: 6, finger: 1 },
        { fretOffset: 2, fromString: 3, toString: 4, finger: 2 },
      ],
      difficulty: 4,
      tags: ["suspended", "barre"],
    },
  },
  {
    suffix: "add9",
    id: "add9",
    displayName: "Add 9",
    lowERoot: {
      fretOffsets: [0, 2, 2, 1, 0, 2],
      fingers: [1, 3, 3, 2, 1, 4],
      barres: [
        { fretOffset: 0, fromString: 1, toString: 5, finger: 1 },
        { fretOffset: 2, fromString: 2, toString: 3, finger: 3 },
      ],
      difficulty: 5,
      tags: ["add9", "barre"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 2, 4, 2, 0],
      fingers: [null, 1, 2, 4, 3, 1],
      barres: [{ fretOffset: 0, fromString: 2, toString: 6, finger: 1 }],
      difficulty: 4,
      tags: ["add9", "barre"],
    },
  },
  {
    suffix: "sus2",
    id: "sus2",
    displayName: "Suspended 2",
    lowERoot: {
      fretOffsets: [0, 2, 4, 4, 0, 0],
      fingers: [1, 2, 4, 4, 1, 1],
      barres: [
        { fretOffset: 0, fromString: 1, toString: 6, finger: 1 },
        { fretOffset: 4, fromString: 3, toString: 4, finger: 4 },
      ],
      difficulty: 4,
      tags: ["suspended", "barre"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 2, 2, 0, 0],
      fingers: [null, 1, 3, 3, 1, 1],
      barres: [
        { fretOffset: 0, fromString: 2, toString: 6, finger: 1 },
        { fretOffset: 2, fromString: 3, toString: 4, finger: 3 },
      ],
      difficulty: 3,
      tags: ["suspended", "barre"],
    },
  },
  {
    suffix: "m7b5",
    id: "minor-7-flat-5",
    displayName: "Half-diminished",
    lowERoot: {
      fretOffsets: [0, "x", 0, 0, -1, "x"],
      fingers: [2, null, 3, 4, 1, null],
      difficulty: 3,
      tags: ["half-diminished", "compact-voicing"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 1, 0, 1, "x"],
      fingers: [null, 1, 2, 1, 3, null],
      barres: [{ fretOffset: 0, fromString: 2, toString: 4, finger: 1 }],
      difficulty: 3,
      tags: ["half-diminished", "compact-voicing"],
    },
  },
  {
    suffix: "mM7",
    id: "minor-major-7",
    displayName: "Minor Major 7",
    lowERoot: {
      fretOffsets: [0, 2, 1, 0, 0, 0],
      fingers: [1, 4, 2, 1, 1, 1],
      barres: [{ fretOffset: 0, fromString: 1, toString: 6, finger: 1 }],
      difficulty: 4,
      tags: ["minor-major-seventh", "barre"],
    },
    aRoot: {
      fretOffsets: ["x", 0, 2, 1, 1, 0],
      fingers: [null, 1, 4, 2, 2, 1],
      barres: [
        { fretOffset: 0, fromString: 2, toString: 6, finger: 1 },
        { fretOffset: 1, fromString: 4, toString: 5, finger: 2 },
      ],
      difficulty: 4,
      tags: ["minor-major-seventh", "barre"],
    },
  },
  {
    suffix: "maj9",
    id: "major-9",
    displayName: "Major 9",
    lowERoot: {
      fretOffsets: [0, "x", 1, 1, 0, 2],
      fingers: [1, null, 2, 3, 1, 4],
      barres: [{ fretOffset: 0, fromString: 1, toString: 5, finger: 1 }],
      difficulty: 4,
      tags: ["major-ninth", "compact-voicing"],
    },
    aRoot: {
      fretOffsets: ["x", 0, -1, 1, 0, "x"],
      fingers: [null, 2, 1, 4, 3, null],
      difficulty: 4,
      tags: ["major-ninth", "compact-voicing"],
    },
  },
  {
    suffix: "7#9",
    id: "dominant-7-sharp-9",
    displayName: "Dominant 7 Sharp 9",
    lowERoot: {
      fretOffsets: [0, "x", 0, 1, "x", 3],
      fingers: [1, null, 2, 3, null, 4],
      difficulty: 4,
      tags: ["seventh", "sharp-nine", "compact-voicing"],
    },
    aRoot: {
      fretOffsets: ["x", 0, -1, 0, 1, "x"],
      fingers: [null, 2, 1, 3, 4, null],
      difficulty: 4,
      tags: ["seventh", "sharp-nine", "compact-voicing"],
    },
  },
];

/**
 * 為每個支援的和弦建立低音 E 弦根音與 A 弦根音把位。
 * 若手寫資料已經有完全相同的 symbol 與 frets，就不重複加入。
 */
export function createGeneratedChordShapes(
  existingShapes: readonly ChordShape[],
): readonly ChordShape[] {
  const generated: ChordShape[] = [];
  const fingerprints = new Set(existingShapes.map(createFingerprint));

  for (const family of ROOT_FAMILIES) {
    for (const root of family.positions) {
      for (const chordTemplate of CHORD_TEMPLATES) {
        const symbol = `${root.symbol}${chordTemplate.suffix}`;
        const template =
          family.rootString === "low-e"
            ? chordTemplate.lowERoot
            : chordTemplate.aRoot;
        const shape = createShape(family, root, chordTemplate, template, symbol);
        const fingerprint = createFingerprint(shape);

        if (fingerprints.has(fingerprint)) {
          continue;
        }

        fingerprints.add(fingerprint);
        generated.push(shape);
      }
    }
  }

  return generated;
}

function createShape(
  family: RootFamily,
  root: RootPosition,
  chordTemplate: ChordTemplate,
  template: RootShapeTemplate,
  symbol: string,
): ChordShape {
  const frets = template.fretOffsets.map((offset) =>
    offset === "x" ? "x" : root.fret + offset,
  ) as unknown as SixValues<FretValue>;
  const positiveFrets = frets.filter(
    (fret): fret is number => typeof fret === "number" && fret > 0,
  );
  const baseFret = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
  const barres = template.barres?.map<Barre>((barre) => ({
    fret: root.fret + barre.fretOffset,
    fromString: barre.fromString,
    toString: barre.toString,
    finger: barre.finger,
  }));

  return {
    id: `generated-${root.id}-${chordTemplate.id}-${family.rootString}-root`,
    symbol,
    displayName: `${formatDisplayRoot(root.symbol)} ${chordTemplate.displayName}`,
    frets,
    fingers: template.fingers,
    baseFret,
    ...(barres && barres.length > 0 ? { barres } : {}),
    difficulty: template.difficulty,
    position: "movable",
    variantLabel: `第 ${root.fret} 格・${family.label}根音`,
    tags: ["generated", `${family.rootString}-string-root`, ...template.tags],
  };
}

function createFingerprint(shape: ChordShape): string {
  return `${shape.symbol}|${shape.frets.join(",")}`;
}

function formatDisplayRoot(root: string): string {
  return root.replace("#", "♯").replace("b", "♭");
}
