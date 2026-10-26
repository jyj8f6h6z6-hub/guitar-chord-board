export interface ProgressionPreset {
  id: string;
  label: string;
  hint: string;
  /** 以 C 大調為基準的和弦，套用時會移調到選定的調。 */
  chords: readonly string[];
  /** 幾個和弦排成一行；沒有指定就全部放同一行 */
  lineSize?: number;
}

export const PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  { id: "pop", label: "Ⅰ–Ⅴ–ⅵ–Ⅳ", hint: "流行歌最常見", chords: ["C", "G", "Am", "F"] },
  { id: "classic", label: "Ⅰ–ⅵ–Ⅳ–Ⅴ", hint: "50 年代經典", chords: ["C", "Am", "F", "G"] },
  { id: "emotional", label: "ⅵ–Ⅳ–Ⅰ–Ⅴ", hint: "抒情、感傷", chords: ["Am", "F", "C", "G"] },
  { id: "one-four-five", label: "Ⅰ–Ⅳ–Ⅴ", hint: "民謠、搖滾基礎", chords: ["C", "F", "G"] },
  { id: "jazz", label: "ⅱ–Ⅴ–Ⅰ", hint: "爵士終止式", chords: ["Dm7", "G7", "Cmaj7"] },
  {
    id: "blues",
    label: "12 小節藍調",
    hint: "Ⅰ7 · Ⅳ7 · Ⅴ7",
    lineSize: 4,
    chords: ["C7", "C7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"],
  },
];
