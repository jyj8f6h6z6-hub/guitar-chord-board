export type FretValue = number | "x";

export interface Barre {
  fret: number;
  fromString: number;
  toString: number;
  finger?: number;
}

export interface ChordShape {
  id: string;
  symbol: string;
  displayName: string;
  frets: readonly FretValue[];
  fingers: readonly (number | null)[];
  baseFret: number;
  barres?: readonly Barre[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  position: "open" | "movable";
  variantLabel?: string;
  tags: readonly string[];
}

export interface ChordTheoryResult {
  symbol: string;
  resolvedSymbol: string;
  name: string;
  notes: string[];
  intervals: string[];
  bass?: string;
  valid: boolean;
}

export type AppMode = "single" | "song" | "overview" | "score";
