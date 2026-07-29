import { Chord } from "tonal";
import type { ChordTheoryResult } from "../types/chord";
import { normalizeChordName } from "../utils/normalizeChordName";

export function getChordTheory(rawSymbol: string): ChordTheoryResult {
  const symbol = normalizeChordName(rawSymbol);
  const [chordSymbol, bass] = symbol.split("/");
  const chord = Chord.get(chordSymbol);

  if (!symbol || chord.empty) {
    return {
      symbol,
      name: "",
      notes: [],
      intervals: [],
      valid: false,
    };
  }

  return {
    symbol,
    name: chord.name || symbol,
    notes: chord.notes,
    intervals: chord.intervals,
    bass,
    valid: true,
  };
}
