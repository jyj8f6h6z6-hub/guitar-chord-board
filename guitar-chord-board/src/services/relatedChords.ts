import { hasChordShape } from "../data/chordShapes";
import { resolveChordAlias } from "../utils/chordAliases";
import { normalizeChordName } from "../utils/normalizeChordName";

const RECOMMENDATIONS: Readonly<Record<string, readonly string[]>> = {
  C: ["C7", "Cmaj7", "Cadd9", "Cm", "Csus2", "Csus4", "Cdim", "C/E", "C/G"],
  G: ["G7", "Gmaj7", "G6", "Gm", "Gsus2", "Gsus4", "G/B", "G/D"],
  Am: ["A", "Am7", "A7", "Amaj7", "Asus2", "Asus4", "Am/C", "Am/E"],
  F: ["F7", "Fmaj7", "Fm", "Fsus2", "Fsus4", "F/A", "F/C"],
  D: ["Dm", "Dm7", "D7", "Dmaj7", "Dsus2", "Dsus4", "D/F#"],
  E: ["Em", "Em7", "E7", "Emaj7", "Esus4"],
  B: ["Bm", "Bm7", "B7"],
  "F#": ["F#m", "F#m7"],
  Bb: ["Bbm", "Bb7", "Bbmaj7"],
};

export function getRelatedChords(rawSymbol: string, limit = 9): string[] {
  const symbol = normalizeChordName(rawSymbol);
  const resolvedSymbol = resolveChordAlias(symbol);
  const baseSymbol = resolvedSymbol.split("/")[0];
  const configured = RECOMMENDATIONS[baseSymbol];

  if (configured) {
    return configured
      .filter((candidate) => candidate !== resolvedSymbol)
      .filter(hasChordShape)
      .slice(0, limit);
  }

  const match = baseSymbol.match(/^([A-G](?:#|b)?)/);
  if (!match) {
    return [];
  }

  const root = match[1];
  const generated = [
    root,
    `${root}m`,
    `${root}7`,
    `${root}maj7`,
    `${root}m7`,
    `${root}sus2`,
    `${root}sus4`,
    `${root}dim`,
  ];

  return generated
    .filter((candidate) => candidate !== resolvedSymbol)
    .filter(hasChordShape)
    .slice(0, limit);
}
