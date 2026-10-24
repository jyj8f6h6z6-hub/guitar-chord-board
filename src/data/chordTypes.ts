export const ROOT_NOTES = ["C", "D", "E", "F", "G", "A", "B"] as const;

export type RootNote = (typeof ROOT_NOTES)[number];
export type Accidental = "" | "#" | "b";

export interface AccidentalOption {
  value: Accidental;
  label: string;
}

export const ACCIDENTAL_OPTIONS: readonly AccidentalOption[] = [
  { value: "", label: "自然音（無升降）" },
  { value: "#", label: "♯ 升半音" },
  { value: "b", label: "♭ 降半音" },
];

export interface ChordTypeOption {
  suffix: string;
  /** 按鈕上顯示的簡短名稱 */
  short: string;
  label: string;
  description: string;
}

export const CHORD_TYPE_OPTIONS: readonly ChordTypeOption[] = [
  {
    suffix: "",
    short: "Major",
    label: "大三和弦（Major）",
    description: "明亮、穩定、開闊，是最常見的基礎和弦色彩。",
  },
  {
    suffix: "m",
    short: "m",
    label: "m（小三和弦）",
    description: "黯淡、悲傷、沉穩。",
  },
  {
    suffix: "7",
    short: "7",
    label: "7（屬七和弦）",
    description: "具張力、不穩定，帶點調皮或衝動感。",
  },
  {
    suffix: "maj7",
    short: "maj7",
    label: "maj7（大七和弦）",
    description: "浪漫、柔和，帶有都市感與微微酸甜。",
  },
  {
    suffix: "m7",
    short: "m7",
    label: "m7（小七和弦）",
    description: "憂鬱但較柔和、放鬆，比純小和弦更溫和。",
  },
  {
    suffix: "sus4",
    short: "sus4",
    label: "sus4（掛四和弦）",
    description: "懸空、期待，有未完成與等待解決的感覺。",
  },
  {
    suffix: "add9",
    short: "add9",
    label: "add9（加九和弦）",
    description: "明亮、精緻，帶有晶瑩剔透的水晶感。",
  },
  {
    suffix: "sus2",
    short: "sus2",
    label: "sus2（掛二和弦）",
    description: "明亮、空靈、現代，空間感強。",
  },
  {
    suffix: "m7b5",
    short: "m7♭5",
    label: "m7♭5（半減七和弦）",
    description: "酸楚、憂鬱，具有很強的過渡張力。",
  },
  {
    suffix: "mM7",
    short: "mM7",
    label: "mM7（小大七和弦）",
    description: "神祕、戲劇化，像特務登場般帶有懸疑感。",
  },
  {
    suffix: "maj9",
    short: "maj9",
    label: "maj9（大九和弦）",
    description: "華麗、高級，像置身雲端般寬廣。",
  },
  {
    suffix: "7#9",
    short: "7♯9",
    label: "7♯9（屬七升九和弦）",
    description: "刺耳、霸道，極具爆發力與張力。",
  },
];

export function buildChordSymbol(
  root: RootNote,
  accidental: Accidental,
  suffix: string,
): string {
  return `${root}${accidental}${suffix}`;
}

export interface RootKeyOption {
  pitchClass: number;
  /** 常用寫法：吉他譜最常見的升降記號拼法 */
  common: string;
  sharp: string;
  flat: string;
}

export const ROOT_KEY_OPTIONS: readonly RootKeyOption[] = [
  { pitchClass: 0, common: "C", sharp: "C", flat: "C" },
  { pitchClass: 1, common: "C#", sharp: "C#", flat: "Db" },
  { pitchClass: 2, common: "D", sharp: "D", flat: "D" },
  { pitchClass: 3, common: "Eb", sharp: "D#", flat: "Eb" },
  { pitchClass: 4, common: "E", sharp: "E", flat: "E" },
  { pitchClass: 5, common: "F", sharp: "F", flat: "F" },
  { pitchClass: 6, common: "F#", sharp: "F#", flat: "Gb" },
  { pitchClass: 7, common: "G", sharp: "G", flat: "G" },
  { pitchClass: 8, common: "Ab", sharp: "G#", flat: "Ab" },
  { pitchClass: 9, common: "A", sharp: "A", flat: "A" },
  { pitchClass: 10, common: "Bb", sharp: "A#", flat: "Bb" },
  { pitchClass: 11, common: "B", sharp: "B", flat: "B" },
];

export type RootNotation = "common" | "sharp" | "flat";

/** 把 C# / Bb 這類寫法轉成畫面上的 ♯ ♭ 符號 */
export function formatNoteLabel(note: string): string {
  return note.length === 2 ? note.replace("#", "♯").replace("b", "♭") : note;
}
