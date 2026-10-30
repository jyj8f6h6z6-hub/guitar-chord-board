export type ProgressionCategory = "pop" | "folk-rock" | "jazz" | "minor";

export interface ProgressionCategoryInfo {
  id: ProgressionCategory;
  label: string;
  note?: string;
}

export const PROGRESSION_CATEGORIES: readonly ProgressionCategoryInfo[] = [
  { id: "pop", label: "流行" },
  { id: "folk-rock", label: "民謠搖滾" },
  { id: "jazz", label: "爵士" },
  {
    id: "minor",
    label: "小調",
    note: "小調歌曲請選「對應的大調」：例如 A 小調選 C，E 小調選 G。",
  },
];

export interface ProgressionPreset {
  id: string;
  category: ProgressionCategory;
  label: string;
  hint: string;
  /** 以 C 大調為基準的和弦，套用時會移調到選定的調。 */
  chords: readonly string[];
  /** 幾個和弦排成一行；沒有指定就全部放同一行 */
  lineSize?: number;
}

export const PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  /* ---- 流行（含抒情） ---- */
  { id: "pop", category: "pop", label: "Ⅰ–Ⅴ–ⅵ–Ⅳ", hint: "流行歌最常見", chords: ["C", "G", "Am", "F"] },
  { id: "classic", category: "pop", label: "Ⅰ–ⅵ–Ⅳ–Ⅴ", hint: "50 年代經典", chords: ["C", "Am", "F", "G"] },
  { id: "emotional", category: "pop", label: "ⅵ–Ⅳ–Ⅰ–Ⅴ", hint: "抒情、感傷", chords: ["Am", "F", "C", "G"] },
  { id: "pop-4-1-5-6", category: "pop", label: "Ⅳ–Ⅰ–Ⅴ–ⅵ", hint: "抒情歌副歌", chords: ["F", "C", "G", "Am"] },
  { id: "pop-1-3-4-5", category: "pop", label: "Ⅰ–Ⅲ–Ⅳ–Ⅴ", hint: "明亮、帶轉折", chords: ["C", "E", "F", "G"] },
  { id: "pop-1-3m-6-4", category: "pop", label: "Ⅰ–ⅲ–ⅵ–Ⅳ", hint: "柔和流行", chords: ["C", "Em", "Am", "F"] },
  { id: "pop-6-5-4-5", category: "pop", label: "ⅵ–Ⅴ–Ⅳ–Ⅴ", hint: "從小調和弦進入", chords: ["Am", "G", "F", "G"] },
  {
    id: "canon",
    category: "pop",
    label: "卡農進行",
    hint: "Ⅰ–Ⅴ–ⅵ–ⅲ–Ⅳ–Ⅰ–Ⅳ–Ⅴ",
    lineSize: 4,
    chords: ["C", "G", "Am", "Em", "F", "C", "F", "G"],
  },
  { id: "lyric-6-3-4-5", category: "pop", label: "ⅵ–Ⅲ–Ⅳ–Ⅴ", hint: "抒情、帶張力", chords: ["Am", "E", "F", "G"] },
  { id: "lyric-1-3m-4-5", category: "pop", label: "Ⅰ–ⅲ–Ⅳ–Ⅴ", hint: "抒情、上行", chords: ["C", "Em", "F", "G"] },
  { id: "royal-6-4-5-3", category: "pop", label: "ⅵ–Ⅳ–Ⅴ–ⅲ", hint: "日系王道進行", chords: ["Am", "F", "G", "Em"] },
  { id: "royal-4-5-3-6", category: "pop", label: "Ⅳ–Ⅴ–ⅲ–ⅵ", hint: "日系王道進行（常見寫法）", chords: ["F", "G", "Em", "Am"] },

  /* ---- 民謠搖滾（含藍調） ---- */
  { id: "one-four-five", category: "folk-rock", label: "Ⅰ–Ⅳ–Ⅴ", hint: "民謠、搖滾基礎", chords: ["C", "F", "G"] },
  { id: "folk-1-5-4", category: "folk-rock", label: "Ⅰ–Ⅴ–Ⅳ", hint: "鄉村、民謠", chords: ["C", "G", "F"] },
  { id: "folk-1-4-1-5", category: "folk-rock", label: "Ⅰ–Ⅳ–Ⅰ–Ⅴ", hint: "經典搖滾", chords: ["C", "F", "C", "G"] },
  { id: "rock-1-b7-4", category: "folk-rock", label: "Ⅰ–♭Ⅶ–Ⅳ", hint: "搖滾味", chords: ["C", "Bb", "F"] },
  {
    id: "blues",
    category: "folk-rock",
    label: "12 小節藍調",
    hint: "Ⅰ7 · Ⅳ7 · Ⅴ7",
    lineSize: 4,
    chords: ["C7", "C7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"],
  },
  {
    id: "blues-quick",
    category: "folk-rock",
    label: "快速變化 12 小節藍調",
    hint: "第 2 小節就換 Ⅳ7",
    lineSize: 4,
    chords: ["C7", "F7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"],
  },
  {
    id: "blues-8",
    category: "folk-rock",
    label: "8 小節藍調",
    hint: "Ⅰ–Ⅴ–ⅵ–ⅲ–Ⅳ–Ⅰ–Ⅳ–Ⅴ",
    lineSize: 4,
    chords: ["C", "G", "Am", "Em", "F", "C", "F", "G"],
  },

  /* ---- 爵士 ---- */
  { id: "jazz", category: "jazz", label: "ⅱ–Ⅴ–Ⅰ", hint: "爵士終止式", chords: ["Dm7", "G7", "Cmaj7"] },
  { id: "jazz-turnaround", category: "jazz", label: "Ⅰ–ⅵ–ⅱ–Ⅴ", hint: "輪轉進行", chords: ["C", "Am7", "Dm7", "G7"] },
  {
    id: "jazz-3-6-2-5-1",
    category: "jazz",
    label: "ⅲ–ⅵ–ⅱ–Ⅴ–Ⅰ",
    hint: "連續的五度下行",
    lineSize: 5,
    chords: ["Em7", "Am7", "Dm7", "G7", "Cmaj7"],
  },
  {
    id: "jazz-circle",
    category: "jazz",
    label: "Ⅰ–Ⅳ–ⅲ–ⅵ–ⅱ–Ⅴ–Ⅰ",
    hint: "完整五度圈",
    lineSize: 4,
    chords: ["Cmaj7", "Fmaj7", "Em7", "Am7", "Dm7", "G7", "Cmaj7"],
  },

  /* ---- 小調（以 A 小調／對應的 C 大調為基準） ---- */
  { id: "minor-6-4-1-5", category: "minor", label: "ⅰ–ⅵ–Ⅲ–Ⅶ", hint: "Am–F–C–G，流行小調", chords: ["Am", "F", "C", "G"] },
  { id: "minor-1-4-5", category: "minor", label: "ⅰ–ⅳ–Ⅴ", hint: "Am–Dm–E，和聲小調終止感", chords: ["Am", "Dm", "E"] },
  { id: "minor-andalusian", category: "minor", label: "ⅵ–Ⅴ–Ⅳ", hint: "Am–G–F，安達盧西亞", chords: ["Am", "G", "F"] },
  { id: "minor-descending", category: "minor", label: "ⅰ–ⅶ–ⅵ–Ⅴ", hint: "Am–G–F–E，下行、西班牙風", chords: ["Am", "G", "F", "E"] },
];
