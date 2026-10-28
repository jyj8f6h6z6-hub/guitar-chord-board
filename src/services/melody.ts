/**
 * 簡譜旋律：文字語法的解析、排版與分配。
 *
 * 語法（一個音符 = [升降] 數字 [八度] [底線] [附點]）：
 *   1～7         音高（首調，1 = 調號的主音）
 *   0            休止符
 *   -            延長一拍
 *   '  ,         高八度、低八度（可重複，例如 1'' ）
 *   #  b  n      升、降、還原，寫在數字前面（例如 #4、b7）
 *   _  __        八分音符、十六分音符（底線）
 *   .            附點（音長 × 1.5），寫在最後（例如 5_.）
 *   ( )          連音線：括號內的音符唱同一個字
 *   |            小節線（只是方便閱讀，解析時忽略）
 *
 * 音長的單位是「拍」：不加底線的音符 = 1 拍，與和弦拍數、拍號分子使用同一個單位。
 */

import type { SongItem } from "../types/song";

export type MelodyKind = "note" | "rest" | "hold";

export interface MelodyToken {
  kind: MelodyKind;
  /** 1～7；休止與延長為 0 */
  degree: number;
  accidental: "" | "#" | "b" | "n";
  /** 高八度為正、低八度為負 */
  octave: number;
  /** 底線數（0～3） */
  underlines: number;
  dotted: boolean;
  /** 音長（拍） */
  beats: number;
  /** 這個音符前面有幾個 "(" */
  open: number;
  /** 這個音符後面有幾個 ")" */
  close: number;
}

export interface MelodyError {
  /** 正規化後文字中的位置 */
  index: number;
  char: string;
}

export interface ParsedMelody {
  tokens: MelodyToken[];
  errors: MelodyError[];
  /** 正規化後的文字（解析使用的字串） */
  text: string;
}

export const MAX_MELODY_LENGTH = 240;
export const MAX_MELODY_LINE_LENGTH = 1200;
const MAX_UNDERLINES = 3;
const MAX_OCTAVE = 2;

/** 把全形、輸入法產生的符號換成語法使用的半形字元。 */
export function normalizeMelodyText(text: string): string {
  return text
    .replace(/[，、；]/g, " ")
    .replace(/[’‘′`´]/g, "'")
    .replace(/[—–―ー−]/g, "-")
    .replace(/[·•・。]/g, ".")
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/♮/g, "n")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenBeats(underlines: number, dotted: boolean): number {
  return (1 / 2 ** underlines) * (dotted ? 1.5 : 1);
}

export function parseMelody(rawText: string): ParsedMelody {
  const text = normalizeMelodyText(rawText);
  const tokens: MelodyToken[] = [];
  const errors: MelodyError[] = [];
  let pendingOpen = 0;
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === " " || char === "|" || char === "/") {
      index += 1;
      continue;
    }

    if (char === "(") {
      pendingOpen += 1;
      index += 1;
      continue;
    }

    if (char === ")") {
      const last = tokens[tokens.length - 1];

      if (last) {
        last.close += 1;
      } else {
        errors.push({ index, char });
      }

      index += 1;
      continue;
    }

    if (char === "-") {
      tokens.push({
        kind: "hold",
        degree: 0,
        accidental: "",
        octave: 0,
        underlines: 0,
        dotted: false,
        beats: 1,
        open: pendingOpen,
        close: 0,
      });
      pendingOpen = 0;
      index += 1;
      continue;
    }

    let accidental: MelodyToken["accidental"] = "";
    let cursor = index;

    if ((char === "#" || char === "b" || char === "n") && /[1-7]/.test(text[index + 1] ?? "")) {
      accidental = char;
      cursor += 1;
    }

    const digit = text[cursor];

    if (digit !== undefined && /[0-7]/.test(digit)) {
      cursor += 1;
      let octave = 0;
      let underlines = 0;
      let dotted = false;

      for (; cursor < text.length; cursor += 1) {
        const mark = text[cursor];

        if (mark === "'") {
          octave = Math.min(MAX_OCTAVE, octave + 1);
        } else if (mark === ",") {
          octave = Math.max(-MAX_OCTAVE, octave - 1);
        } else if (mark === "_") {
          underlines = Math.min(MAX_UNDERLINES, underlines + 1);
        } else if (mark === "." && !dotted) {
          dotted = true;
        } else {
          break;
        }
      }

      const isRest = digit === "0";
      tokens.push({
        kind: isRest ? "rest" : "note",
        degree: Number(digit),
        accidental: isRest ? "" : accidental,
        octave: isRest ? 0 : octave,
        underlines,
        dotted,
        beats: tokenBeats(underlines, dotted),
        open: pendingOpen,
        close: 0,
      });
      pendingOpen = 0;
      index = cursor;
      continue;
    }

    errors.push({ index, char });
    index += 1;
  }

  return { tokens, errors, text };
}

/* ---------- 轉回文字 ---------- */

export function formatToken(token: MelodyToken): string {
  let core: string;

  if (token.kind === "hold") {
    core = "-";
  } else {
    core =
      token.accidental +
      String(token.degree) +
      (token.octave > 0 ? "'".repeat(token.octave) : ",".repeat(-token.octave)) +
      "_".repeat(token.underlines) +
      (token.dotted ? "." : "");
  }

  return "(".repeat(token.open) + core + ")".repeat(token.close);
}

export function formatTokens(tokens: readonly MelodyToken[]): string {
  return tokens.map(formatToken).join(" ");
}

/** 用休止符填滿指定拍數（合併行、補空白用）。 */
export function restTokens(beats: number): MelodyToken[] {
  const tokens: MelodyToken[] = [];
  let remaining = Math.round(beats * 4) / 4;

  const push = (underlines: number, dotted: boolean) => {
    tokens.push({
      kind: "rest",
      degree: 0,
      accidental: "",
      octave: 0,
      underlines,
      dotted,
      beats: tokenBeats(underlines, dotted),
      open: 0,
      close: 0,
    });
  };

  while (remaining >= 1 - 1e-9) {
    push(0, false);
    remaining -= 1;
  }

  if (remaining >= 0.75 - 1e-9) {
    push(1, true);
    remaining -= 0.75;
  }

  if (remaining >= 0.5 - 1e-9) {
    push(1, false);
    remaining -= 0.5;
  }

  if (remaining >= 0.25 - 1e-9) {
    push(2, false);
  }

  return tokens;
}

export function totalBeats(tokens: readonly MelodyToken[]): number {
  return tokens.reduce((sum, token) => sum + token.beats, 0);
}

/* ---------- 依拍數分配到和弦 ---------- */

/**
 * 把一整行的音符依各和弦的拍數切開。每個和弦拿到從它開始的音符，直到累積的拍數
 * 填滿為止；超出的部分留在最後一個和弦（編輯畫面會提示拍數不符）。
 * 傳回的是每個和弦的音符清單，長度與 capacities 相同。
 */
export function distributeTokens(
  tokens: readonly MelodyToken[],
  capacities: readonly number[],
): MelodyToken[][] {
  const result: MelodyToken[][] = capacities.map(() => []);

  if (capacities.length === 0) {
    return result;
  }

  let cursor = 0;

  capacities.forEach((capacity, cellIndex) => {
    const isLast = cellIndex === capacities.length - 1;
    let filled = 0;

    while (cursor < tokens.length && (isLast || filled < capacity - 1e-6)) {
      result[cellIndex].push(tokens[cursor]);
      filled += tokens[cursor].beats;
      cursor += 1;
    }
  });

  return result;
}

/* ---------- 排版用的欄 ---------- */

/** 1 拍的欄寬（em）。 */
export const MELODY_BEAT_EM = 2;
/** 最窄的欄寬（em），避免十六分音符與歌詞字互相擠壓。 */
export const MELODY_MIN_COLUMN_EM = 1.15;

export type SlurRole = "start" | "mid" | "end" | "only";

export interface MelodyColumn {
  key: string;
  kind: MelodyKind;
  degree: number;
  accidental: MelodyToken["accidental"];
  octave: number;
  underlines: number;
  dotted: boolean;
  beats: number;
  widthEm: number;
  slur: SlurRole | null;
  /** 這一欄是否對應一個歌詞字 */
  syllable: boolean;
  /** 從整數拍開始（底線在這裡斷開，呈現拍的分組） */
  beatStart: boolean;
}

export interface LineMelodyLayout {
  cells: Map<string, MelodyColumn[]>;
  hasAny: boolean;
  needHigh: boolean;
  needLow: boolean;
  needSlur: boolean;
  needLines: boolean;
}

/**
 * 排出一行的旋律欄。capacityOf 回傳每個和弦的拍數，用來算拍的位置。
 * 連音線的狀態會跨和弦延續，所以一個連音線可以橫跨小節。
 */
export function layoutLineMelody(
  items: readonly SongItem[],
  capacityOf: (item: SongItem) => number,
): LineMelodyLayout {
  const cells = new Map<string, MelodyColumn[]>();
  let hasAny = false;
  let needHigh = false;
  let needLow = false;
  let needSlur = false;
  let needLines = false;
  let depth = 0;
  let cellStart = 0;

  for (const item of items) {
    const capacity = capacityOf(item);
    const text = item.melody ?? "";

    if (text.trim() === "") {
      cellStart += capacity;
      continue;
    }

    const { tokens } = parseMelody(text);
    const columns: MelodyColumn[] = [];
    let offset = 0;

    tokens.forEach((token, tokenIndex) => {
      depth += token.open;
      const inSlur = depth > 0;
      const slur: SlurRole | null = inSlur
        ? token.open > 0 && token.close > 0
          ? "only"
          : token.open > 0
            ? "start"
            : token.close > 0
              ? "end"
              : "mid"
        : null;
      depth = Math.max(0, depth - token.close);
      // 連音線裡只有第一個音符配一個字；其餘音符沿用同一個字。
      const syllable = token.kind === "note" && (slur === null || slur === "start" || slur === "only");
      const position = cellStart + offset;

      columns.push({
        key: `${item.id}:${tokenIndex}`,
        kind: token.kind,
        degree: token.degree,
        accidental: token.accidental,
        octave: token.octave,
        underlines: token.underlines,
        dotted: token.dotted,
        beats: token.beats,
        widthEm: Math.max(MELODY_MIN_COLUMN_EM, token.beats * MELODY_BEAT_EM),
        slur,
        syllable,
        beatStart: Math.abs(position - Math.round(position)) < 1e-6,
      });

      if (token.octave > 0) needHigh = true;
      if (token.octave < 0) needLow = true;
      if (slur) needSlur = true;
      if (token.underlines > 0 && token.kind !== "hold") needLines = true;

      offset += token.beats;
    });

    if (columns.length > 0) {
      hasAny = true;
      cells.set(item.id, columns);
    }

    cellStart += capacity;
  }

  return { cells, hasAny, needHigh, needLow, needSlur, needLines };
}

/* ---------- 歌詞對應 ---------- */

const ATTACH_TO_PREVIOUS = /^[，。、；：！？,.;:!?）)」』”’…～~》〉】]$/;
const ATTACH_TO_NEXT = /^[（(「『“‘《〈【]$/;

/** 把一節歌詞切成「一個字一個音」的單位；標點接在前一個字後面，左括號、引號接在後一個字前面。 */
export function splitLyricChars(text: string): string[] {
  const result: string[] = [];
  let prefix = "";

  for (const char of Array.from(text)) {
    if (ATTACH_TO_NEXT.test(char)) {
      prefix += char;
    } else if (ATTACH_TO_PREVIOUS.test(char) && result.length > 0 && prefix === "") {
      result[result.length - 1] += char;
    } else {
      result.push(prefix + char);
      prefix = "";
    }
  }

  if (prefix !== "") {
    if (result.length > 0) {
      result[result.length - 1] += prefix;
    } else {
      result.push(prefix);
    }
  }

  return result;
}

/**
 * 把一節歌詞分配到各欄：傳回每欄要顯示的字（沒有字為空字串）。
 * 字比音符多時，多出來的字接在最後一個音符的字後面。
 */
export function assignLyric(columns: readonly MelodyColumn[], lyric: string): string[] {
  const chars = splitLyricChars(lyric);
  const slots = columns.map((column, index) => (column.syllable ? index : -1)).filter((index) => index >= 0);
  const result = columns.map(() => "");

  if (slots.length === 0) {
    return result;
  }

  chars.forEach((char, charIndex) => {
    const slot = slots[Math.min(charIndex, slots.length - 1)];
    result[slot] += char;
  });

  return result;
}

/** 這些欄一共有幾個要配字的音。 */
export function countSyllables(columns: readonly MelodyColumn[]): number {
  return columns.filter((column) => column.syllable).length;
}
