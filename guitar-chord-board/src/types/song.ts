export const SECTION_KINDS = [
  "",
  "verse",
  "prechorus",
  "chorus",
  "bridge",
  "interlude",
  "outro",
  "custom",
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

export const SECTION_LABELS: Readonly<Record<SectionKind, string>> = {
  "": "（無標籤）",
  verse: "主歌",
  prechorus: "預歌",
  chorus: "副歌",
  bridge: "橋段",
  interlude: "間奏",
  outro: "尾奏",
  custom: "自訂…",
};

/** 編排中的一個和弦；歌詞是這個和弦彈奏時唱的字。 */
export interface SongItem {
  id: string;
  symbol: string;
  lyric: string;
  /** 手動指定：這個和弦之後畫小節線 */
  bar: boolean;
  /** 取消自動算出來的小節線 */
  noBar?: boolean;
  /** 這個和弦持續幾拍（以拍號分子為單位）；未設定則用歌曲的預設拍數 */
  beats?: number;
  /** 使用者選擇的按法 id，未選則用預設第一個 */
  shapeId?: string;
  /** 這個和弦期間的旋律（簡譜文字，例如 "3 3 4 5"）；語法見 services/melody.ts */
  melody?: string;
  /** 這個和弦後面的小節線樣式；未設定則依自動／手動小節線決定 */
  barStyle?: BarStyle;
  /** 這個和弦前面畫反覆開始記號 ‖: */
  repeatStart?: boolean;
  /** 從這個和弦開始的「房子」（第 1、2、3 次結尾）；一直到有小節線樣式的和弦或行尾 */
  ending?: number;
}

export type BarStyle = "double" | "final" | "repeatEnd";
export const BAR_STYLES: readonly BarStyle[] = ["double", "final", "repeatEnd"];

/** 一行（一句）。有標籤的行是段落的開頭，後面沒有標籤的行沿用它。 */
export interface SongLine {
  id: string;
  section: SectionKind;
  customLabel: string;
  items: SongItem[];
}

export interface Song {
  id: string;
  title: string;
  /** 調號（C、C#、D…），未設定則不顯示 */
  key?: string;
  /** 這首歌預先設定的和弦（待選區的「本曲和弦」），例如 C/G */
  palette?: string[];
  /** 大調或小調，只影響標題顯示 */
  mode?: "major" | "minor";
  /** 拍號，例如 2/4 */
  timeSignature?: string;
  /** 每個和弦沒有個別設定時的預設拍數 */
  defaultBeats?: number;
  lines: SongLine[];
  updatedAt: number;
}
