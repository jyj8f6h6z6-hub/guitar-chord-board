import { normalizeChordName } from "../utils/normalizeChordName";

export interface KeyOption {
  value: string;
  label: string;
  pitchClass: number;
  preferFlats: boolean;
}

export const KEY_OPTIONS: readonly KeyOption[] = [
  { value: "C", label: "C", pitchClass: 0, preferFlats: false },
  { value: "C#", label: "C♯ / D♭", pitchClass: 1, preferFlats: false },
  { value: "D", label: "D", pitchClass: 2, preferFlats: false },
  { value: "Eb", label: "E♭ / D♯", pitchClass: 3, preferFlats: true },
  { value: "E", label: "E", pitchClass: 4, preferFlats: false },
  { value: "F", label: "F", pitchClass: 5, preferFlats: true },
  { value: "F#", label: "F♯ / G♭", pitchClass: 6, preferFlats: false },
  { value: "G", label: "G", pitchClass: 7, preferFlats: false },
  { value: "Ab", label: "A♭ / G♯", pitchClass: 8, preferFlats: true },
  { value: "A", label: "A", pitchClass: 9, preferFlats: false },
  { value: "Bb", label: "B♭ / A♯", pitchClass: 10, preferFlats: true },
  { value: "B", label: "B", pitchClass: 11, preferFlats: false },
];

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_TO_PITCH_CLASS: Readonly<Record<string, number>> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  "B#": 0,
};

const CHORD_PATTERN = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/;

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function transposeNote(note: string, semitones: number, preferFlats: boolean): string {
  const pitchClass = NOTE_TO_PITCH_CLASS[note];

  if (pitchClass === undefined) {
    return note;
  }

  const notes = preferFlats ? FLAT_NOTES : SHARP_NOTES;
  return notes[positiveModulo(pitchClass + semitones, 12)];
}

export function getTranspositionSemitones(sourceKey: string, targetKey: string): number {
  const source = KEY_OPTIONS.find((option) => option.value === sourceKey);
  const target = KEY_OPTIONS.find((option) => option.value === targetKey);

  if (!source || !target) {
    return 0;
  }

  return positiveModulo(target.pitchClass - source.pitchClass, 12);
}

export function keyPrefersFlats(key: string): boolean {
  return KEY_OPTIONS.find((option) => option.value === key)?.preferFlats ?? false;
}

export function transposeChordSymbol(
  rawSymbol: string,
  semitones: number,
  preferFlats: boolean,
): string {
  const symbol = normalizeChordName(rawSymbol);
  const match = symbol.match(CHORD_PATTERN);

  if (!match) {
    return rawSymbol;
  }

  const [, rootNote, rootAccidental, suffix, bassNote, bassAccidental] = match;
  const root = transposeNote(`${rootNote}${rootAccidental}`, semitones, preferFlats);
  const bass = bassNote
    ? `/${transposeNote(`${bassNote}${bassAccidental}`, semitones, preferFlats)}`
    : "";

  return `${root}${suffix}${bass}`;
}
