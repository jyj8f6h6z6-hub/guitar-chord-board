import type { BarStyle, SectionKind, Song, SongItem, SongLine } from "../types/song";
import { SECTION_LABELS } from "../types/song";
import { createId } from "../utils/createId";
import { KEY_OPTIONS } from "./chordTranspose";
import {
  MAX_MELODY_LENGTH,
  MAX_MELODY_LINE_LENGTH,
  distributeTokens,
  formatTokens,
  parseMelody,
  totalBeats,
} from "./melody";

export const MAX_TITLE_LENGTH = 60;
export const MAX_LYRIC_LENGTH = 240;
export const MAX_LYRIC_ROWS = 6;
export const MAX_LABEL_LENGTH = 20;
export const MAX_LINES = 100;
export const MAX_ITEMS_PER_LINE = 64;
export const MAX_ITEMS_TOTAL = 600;
export const DEFAULT_SONG_SYMBOLS: readonly string[] = ["C", "G", "Am", "F"];

export function createItem(
  symbol: string,
  extra: Partial<Omit<SongItem, "id" | "symbol">> = {},
): SongItem {
  return { id: createId(), symbol, lyric: "", bar: false, ...extra };
}

export function createLine(
  items: SongItem[] = [],
  section: SectionKind = "",
  customLabel = "",
): SongLine {
  return { id: createId(), section, customLabel, items };
}

export const MAX_PALETTE = 40;
export const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "6/8", "12/8", "2/2", "3/8"] as const;
export const BEAT_CHOICES = [0.5, 1, 1.5, 2, 3, 4, 6, 8] as const;
export const MAX_BEATS = 32;

/** 拍數只接受 0.25 的倍數（0.25～32）。 */
export function isValidBeats(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.25 && value <= MAX_BEATS && Math.abs(value * 4 - Math.round(value * 4)) < 1e-9;
}

export function createSong(title = "", lines?: SongLine[], key?: string, palette?: string[]): Song {
  return {
    id: createId(),
    title,
    lines: lines && lines.length > 0 ? lines : [createLine()],
    updatedAt: Date.now(),
    ...(key ? { key } : {}),
    ...(palette && palette.length > 0 ? { palette } : {}),
  };
}

/** 依序把和弦切成每行 perLine 個（套用常用進行時使用）。 */
export function linesFromSymbols(symbols: readonly string[], perLine = 4): SongLine[] {
  const lines: SongLine[] = [];

  for (let start = 0; start < symbols.length; start += perLine) {
    lines.push(createLine(symbols.slice(start, start + perLine).map((symbol) => createItem(symbol))));
  }

  return lines.length > 0 ? lines : [createLine()];
}

export function createDefaultSong(): Song {
  return createSong("", linesFromSymbols(DEFAULT_SONG_SYMBOLS));
}

/** 加入本曲和弦（不重複、有上限）。 */
export function addPaletteChord(song: Song, symbol: string): Song {
  const palette = song.palette ?? [];

  if (palette.includes(symbol) || palette.length >= MAX_PALETTE) {
    return song;
  }

  return { ...song, palette: [...palette, symbol] };
}

export function removePaletteChord(song: Song, symbol: string): Song {
  const palette = (song.palette ?? []).filter((entry) => entry !== symbol);
  const { palette: _old, ...rest } = song;
  void _old;
  return palette.length > 0 ? { ...rest, palette } : rest;
}

export function allItems(song: Song): SongItem[] {
  return song.lines.flatMap((line) => line.items);
}

export function countItems(song: Song): number {
  return song.lines.reduce((total, line) => total + line.items.length, 0);
}

export function uniqueSymbols(song: Song): string[] {
  return [...new Set(allItems(song).map((item) => item.symbol))];
}

export interface ItemLocation {
  lineIndex: number;
  itemIndex: number;
  line: SongLine;
  item: SongItem;
}

export function locateItem(song: Song, itemId: string): ItemLocation | null {
  for (let lineIndex = 0; lineIndex < song.lines.length; lineIndex += 1) {
    const line = song.lines[lineIndex];
    const itemIndex = line.items.findIndex((item) => item.id === itemId);

    if (itemIndex >= 0) {
      return { lineIndex, itemIndex, line, item: line.items[itemIndex] };
    }
  }

  return null;
}

function withLines(song: Song, lines: SongLine[]): Song {
  return { ...song, lines: lines.length > 0 ? lines : [createLine()] };
}

function updateLine(song: Song, lineId: string, change: (line: SongLine) => SongLine): Song {
  return withLines(
    song,
    song.lines.map((line) => (line.id === lineId ? change(line) : line)),
  );
}

export function updateItem(song: Song, itemId: string, patch: Partial<SongItem>): Song {
  return withLines(
    song,
    song.lines.map((line) => ({
      ...line,
      items: line.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    })),
  );
}

/** 歌詞可以用換行分成多節（第 1 節、第 2 節…），最多 MAX_LYRIC_ROWS 行。 */
export function normalizeLyric(lyric: string): string {
  return lyric
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .slice(0, MAX_LYRIC_ROWS)
    .join("\n")
    .slice(0, MAX_LYRIC_LENGTH);
}

export function setLyric(song: Song, itemId: string, lyric: string): Song {
  return updateItem(song, itemId, { lyric: normalizeLyric(lyric) });
}

/** 每一小節有幾拍（取拍號的分子）；沒有設拍號時回傳 null。 */
export function measureBeats(timeSignature: string | undefined): number | null {
  const match = timeSignature?.match(/^(\d+)\/\d+$/);
  return match ? Number(match[1]) : null;
}

export function itemBeats(song: Song, item: SongItem): number | undefined {
  return item.beats ?? song.defaultBeats;
}

/** 依拍號與拍數算出的小節線：這一行每個和弦都有拍數時，累積滿一小節就在該和弦後畫線。 */
export function autoBarIds(song: Song): Set<string> {
  const result = new Set<string>();
  const measure = measureBeats(song.timeSignature);

  if (!measure) {
    return result;
  }

  for (const line of song.lines) {
    const beats = line.items.map((item) => itemBeats(song, item));

    if (beats.length === 0 || beats.some((value) => value === undefined)) {
      continue;
    }

    let total = 0;

    line.items.forEach((item, index) => {
      total += beats[index] as number;

      if (total % measure === 0) {
        result.add(item.id);
      }
    });
  }

  return result;
}

/** 全曲最後一個和弦（沒有和弦時為 undefined）。 */
function lastItem(song: Song): SongItem | undefined {
  return allItems(song).slice(-1)[0];
}

/** 實際要畫的小節線（自動＋手動＋全曲最後的終止線，扣掉被取消的）。 */
export function effectiveBarIds(song: Song): Set<string> {
  const auto = autoBarIds(song);
  const last = lastItem(song);
  const result = new Set<string>();

  for (const item of allItems(song)) {
    if (!item.noBar && (item.bar || auto.has(item.id) || item === last)) {
      result.add(item.id);
    }
  }

  return result;
}

/** 切換這個和弦後面的小節線：已經有就取消（自動的記為取消），沒有就手動加上。 */
export function toggleBar(song: Song, itemId: string): Song {
  const location = locateItem(song, itemId);

  if (!location) {
    return song;
  }

  const hasBar = effectiveBarIds(song).has(itemId);

  if (hasBar) {
    const forced = autoBarIds(song).has(itemId) || lastItem(song)?.id === itemId;
    return updateItem(song, itemId, { bar: false, noBar: forced ? true : undefined });
  }

  return updateItem(song, itemId, { bar: true, noBar: undefined });
}

export function setBeats(song: Song, itemId: string, beats: number | undefined): Song {
  return updateItem(song, itemId, { beats: beats !== undefined && isValidBeats(beats) ? beats : undefined });
}

/** 這首歌有沒有任何旋律。 */
export function hasMelody(song: Song): boolean {
  return song.lines.some((line) => line.items.some((item) => (item.melody ?? "").trim() !== ""));
}

function keyName(value: string): string {
  return value.replace("#", "♯").replace(/b$/, "♭");
}

/** 小調歌曲的簡譜寫在關係大調上（A 小調 → 1=C）。 */
function melodyTonic(song: Song): string | null {
  if (!song.key) {
    return null;
  }

  if (song.mode !== "minor") {
    return song.key;
  }

  const source = KEY_OPTIONS.find((option) => option.value === song.key);
  const relative = source && KEY_OPTIONS.find((option) => option.pitchClass === (source.pitchClass + 3) % 12);
  return relative ? relative.value : null;
}

/** 「D 大調 2/4」這樣的標題文字；有旋律時加上簡譜的「1=D」。 */
export function songMeta(song: Song): string {
  const parts: string[] = [];

  if (song.key) {
    parts.push(`${keyName(song.key)} ${song.mode === "minor" ? "小調" : "大調"}`);

    const tonic = hasMelody(song) ? melodyTonic(song) : null;
    if (tonic && song.mode === "minor") {
      parts.push(`1=${keyName(tonic)}`);
    } else if (tonic) {
      // 大調：「D 大調」已經說明 1=D，改寫成簡譜歌本常見的寫法。
      parts[0] = `1=${keyName(tonic)}`;
    }
  }

  if (song.timeSignature) {
    parts.push(song.timeSignature);
  }

  return parts.join(" ");
}

/* ---------- 旋律、小節線樣式 ---------- */

/** 一個和弦能放幾拍旋律：個別拍數 → 預設拍數 → 拍號分子 → 4。 */
export function itemCapacity(song: Song, item: SongItem): number {
  return itemBeats(song, item) ?? measureBeats(song.timeSignature) ?? 4;
}

/** 一行的旋律文字（各和弦的旋律依序接起來）。 */
export function lineMelodyText(line: SongLine): string {
  return line.items
    .map((item) => (item.melody ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/** 設定一行的旋律：依各和弦的拍數自動切到每個和弦。 */
export function setLineMelody(song: Song, lineId: string, text: string): Song {
  const line = song.lines.find((entry) => entry.id === lineId);

  if (!line || line.items.length === 0) {
    return song;
  }

  const { tokens } = parseMelody(text.slice(0, MAX_MELODY_LINE_LENGTH));
  const parts = distributeTokens(
    tokens,
    line.items.map((item) => itemCapacity(song, item)),
  );

  return updateLine(song, lineId, (current) => ({
    ...current,
    items: current.items.map((item, index) => {
      const { melody: _old, ...rest } = item;
      void _old;
      const segment = formatTokens(parts[index] ?? []).slice(0, MAX_MELODY_LENGTH * 2);
      return segment ? { ...rest, melody: segment } : rest;
    }),
  }));
}

export interface MelodyCellStatus {
  itemId: string;
  /** 旋律拍數 */
  have: number;
  /** 和弦拍數 */
  capacity: number;
}

export interface LineMelodyStatus {
  cells: MelodyCellStatus[];
  /** 有任何和弦的旋律拍數與和弦拍數不一致 */
  mismatch: boolean;
  haveTotal: number;
  capacityTotal: number;
}

export function lineMelodyStatus(song: Song, line: SongLine): LineMelodyStatus {
  const cells = line.items.map((item) => ({
    itemId: item.id,
    have: totalBeats(parseMelody(item.melody ?? "").tokens),
    capacity: itemCapacity(song, item),
  }));
  const hasAny = cells.some((cell) => cell.have > 0);

  return {
    cells,
    mismatch: hasAny && cells.some((cell) => Math.abs(cell.have - cell.capacity) > 1e-6),
    haveTotal: cells.reduce((sum, cell) => sum + cell.have, 0),
    capacityTotal: cells.reduce((sum, cell) => sum + cell.capacity, 0),
  };
}

export const MAX_ENDING = 3;

export function setBarStyle(song: Song, itemId: string, style: BarStyle | undefined): Song {
  return updateItem(song, itemId, { barStyle: style });
}

export function setRepeatStart(song: Song, itemId: string, on: boolean): Song {
  return updateItem(song, itemId, { repeatStart: on ? true : undefined });
}

export function setEnding(song: Song, itemId: string, ending: number | undefined): Song {
  const valid = ending !== undefined && Number.isInteger(ending) && ending >= 1 && ending <= MAX_ENDING;
  return updateItem(song, itemId, { ending: valid ? ending : undefined });
}

export function setBar(song: Song, itemId: string, bar: boolean): Song {
  return updateItem(song, itemId, { bar });
}

export function setShape(song: Song, itemId: string, shapeId: string | undefined): Song {
  return updateItem(song, itemId, { shapeId });
}

export function replaceSymbol(song: Song, itemId: string, symbol: string): Song {
  return updateItem(song, itemId, { symbol, shapeId: undefined });
}

export interface InsertResult {
  song: Song;
  itemId: string;
}

/** 在指定行的 index 位置插入新和弦；index 省略代表加到行尾，lineId 省略代表最後一行。 */
export function insertChord(
  song: Song,
  symbol: string,
  lineId?: string,
  index?: number,
): InsertResult {
  const found = lineId ? song.lines.findIndex((line) => line.id === lineId) : -1;
  const targetIndex = found >= 0 ? found : song.lines.length - 1;
  const item = createItem(symbol);

  const lines = song.lines.map((line, lineIndex) => {
    if (lineIndex !== targetIndex) {
      return line;
    }

    const items = [...line.items];
    const at = index === undefined ? items.length : Math.max(0, Math.min(index, items.length));
    items.splice(at, 0, item);
    return { ...line, items };
  });

  return { song: withLines(song, lines), itemId: item.id };
}

export function duplicateItem(song: Song, itemId: string): InsertResult | null {
  const location = locateItem(song, itemId);

  if (!location) {
    return null;
  }

  const copy = createItem(location.item.symbol, {
    shapeId: location.item.shapeId,
    ...(location.item.beats ? { beats: location.item.beats } : {}),
  });
  const lines = song.lines.map((line, lineIndex) => {
    if (lineIndex !== location.lineIndex) {
      return line;
    }

    const items = [...line.items];
    items.splice(location.itemIndex + 1, 0, copy);
    return { ...line, items };
  });

  return { song: withLines(song, lines), itemId: copy.id };
}

export function removeItem(song: Song, itemId: string): Song {
  return withLines(
    song,
    song.lines.map((line) => ({
      ...line,
      items: line.items.filter((item) => item.id !== itemId),
    })),
  );
}

/** 移到指定行；toIndex 是「目標行原本的第幾個之前」。 */
export function moveItem(song: Song, itemId: string, toLineId: string, toIndex: number): Song {
  const location = locateItem(song, itemId);
  const targetLine = song.lines.find((line) => line.id === toLineId);

  if (!location || !targetLine) {
    return song;
  }

  let insertAt = Math.max(0, Math.min(toIndex, targetLine.items.length));
  if (targetLine.id === location.line.id && location.itemIndex < insertAt) {
    insertAt -= 1;
  }

  const without = removeItem(song, itemId);
  return withLines(
    without,
    without.lines.map((line) => {
      if (line.id !== toLineId) {
        return line;
      }

      const items = [...line.items];
      items.splice(insertAt, 0, location.item);
      return { ...line, items };
    }),
  );
}

/** 往前或往後移一格，到行首／行尾時會跨到相鄰的行。 */
export function moveItemBy(song: Song, itemId: string, delta: -1 | 1): Song {
  const location = locateItem(song, itemId);

  if (!location) {
    return song;
  }

  const { lineIndex, itemIndex, line } = location;

  if (delta === -1) {
    if (itemIndex > 0) {
      return moveItem(song, itemId, line.id, itemIndex - 1);
    }

    const previous = song.lines[lineIndex - 1];
    return previous ? moveItem(song, itemId, previous.id, previous.items.length) : song;
  }

  if (itemIndex < line.items.length - 1) {
    return moveItem(song, itemId, line.id, itemIndex + 2);
  }

  const next = song.lines[lineIndex + 1];
  return next ? moveItem(song, itemId, next.id, 0) : song;
}

export interface LineResult {
  song: Song;
  lineId: string;
}

/** 從這個和弦之後換行：後面的和弦移到新的下一行。 */
export function splitLineAfter(song: Song, itemId: string): LineResult | null {
  const location = locateItem(song, itemId);

  if (!location || song.lines.length >= MAX_LINES) {
    return null;
  }

  const head = location.line.items.slice(0, location.itemIndex + 1);
  const tail = location.line.items.slice(location.itemIndex + 1);
  const newLine = createLine(tail);
  const lines = [...song.lines];
  lines.splice(location.lineIndex, 1, { ...location.line, items: head }, newLine);

  return { song: withLines(song, lines), lineId: newLine.id };
}

export function addLine(song: Song, afterLineId?: string): LineResult | null {
  if (song.lines.length >= MAX_LINES) {
    return null;
  }

  const newLine = createLine();
  const afterIndex = afterLineId
    ? song.lines.findIndex((line) => line.id === afterLineId)
    : song.lines.length - 1;
  const lines = [...song.lines];
  lines.splice(afterIndex + 1, 0, newLine);

  return { song: withLines(song, lines), lineId: newLine.id };
}

export function removeLine(song: Song, lineId: string): Song {
  return withLines(song, song.lines.filter((line) => line.id !== lineId));
}

/** 複製整行（歌詞一併複製，段落標籤不複製，避免重複標示）。 */
export function duplicateLine(song: Song, lineId: string): LineResult | null {
  const index = song.lines.findIndex((line) => line.id === lineId);

  if (index < 0 || song.lines.length >= MAX_LINES) {
    return null;
  }

  const source = song.lines[index];
  const copy = createLine(
    source.items.map((item) => ({ ...item, id: createId() })),
  );
  const lines = [...song.lines];
  lines.splice(index + 1, 0, copy);

  return { song: withLines(song, lines), lineId: copy.id };
}

export function moveLine(song: Song, lineId: string, delta: -1 | 1): Song {
  const index = song.lines.findIndex((line) => line.id === lineId);
  const target = index + delta;

  if (index < 0 || target < 0 || target >= song.lines.length) {
    return song;
  }

  const lines = [...song.lines];
  [lines[index], lines[target]] = [lines[target], lines[index]];
  return withLines(song, lines);
}

/** 把這一行併回上一行。 */
export function mergeLineUp(song: Song, lineId: string): Song {
  const index = song.lines.findIndex((line) => line.id === lineId);

  if (index <= 0) {
    return song;
  }

  const lines = [...song.lines];
  const [removed] = lines.splice(index, 1);
  lines[index - 1] = {
    ...lines[index - 1],
    items: [...lines[index - 1].items, ...removed.items],
  };

  return withLines(song, lines);
}

export function setSection(
  song: Song,
  lineId: string,
  section: SectionKind,
  customLabel = "",
): Song {
  return updateLine(song, lineId, (line) => ({
    ...line,
    section,
    customLabel: section === "custom" ? customLabel.slice(0, MAX_LABEL_LENGTH) : "",
  }));
}

export function sectionLabel(section: SectionKind, customLabel: string): string {
  if (section === "custom") {
    return customLabel.trim() || SECTION_LABELS.custom.replace("…", "");
  }

  return SECTION_LABELS[section];
}

export interface EffectiveSection {
  /** 這一行實際所屬的段落（沒有標籤時沿用前面的） */
  kind: SectionKind;
  /** 這一行自己有標籤時才有值，用來顯示徽章 */
  badge: string | null;
}

export function effectiveSections(song: Song): EffectiveSection[] {
  let current: SectionKind = "";

  return song.lines.map((line) => {
    if (line.section !== "") {
      current = line.section;
      return { kind: current, badge: sectionLabel(line.section, line.customLabel) };
    }

    return { kind: current, badge: null };
  });
}

/** 依先後順序把新和弦名稱套回每個和弦（移調使用），按法選擇會重設。 */
export function applySymbols(song: Song, symbols: readonly string[]): Song {
  let index = 0;

  return withLines(
    song,
    song.lines.map((line) => ({
      ...line,
      items: line.items.map((item) => {
        const next = symbols[index];
        index += 1;
        return next && next !== item.symbol
          ? { ...item, symbol: next, shapeId: undefined }
          : item;
      }),
    })),
  );
}
