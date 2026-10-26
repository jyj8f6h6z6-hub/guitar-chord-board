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
  /** 這個和弦之後是否畫小節線 */
  bar: boolean;
  /** 使用者選擇的按法 id，未選則用預設第一個 */
  shapeId?: string;
}

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
  lines: SongLine[];
  updatedAt: number;
}
