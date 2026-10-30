import { Chord } from "tonal";
import type { ChordTheoryResult } from "../types/chord";
import { resolveChordAlias } from "../utils/chordAliases";
import { normalizeChordName } from "../utils/normalizeChordName";

export function getChordTheory(rawSymbol: string): ChordTheoryResult {
  const symbol = normalizeChordName(rawSymbol);
  const resolvedSymbol = resolveChordAlias(symbol);
  const [chordSymbol, bass] = resolvedSymbol.split("/");
  const chord = Chord.get(chordSymbol);

  if (!symbol || chord.empty) {
    return {
      symbol,
      resolvedSymbol,
      name: "",
      notes: [],
      intervals: [],
      valid: false,
    };
  }

  return {
    symbol,
    resolvedSymbol,
    name: chord.name || resolvedSymbol,
    notes: chord.notes,
    intervals: chord.intervals,
    bass,
    valid: true,
  };
}
