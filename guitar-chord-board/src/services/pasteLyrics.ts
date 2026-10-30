import type { SectionKind, Song, SongLine } from "../types/song";
import { MAX_LYRIC_ROWS, effectiveSections, itemCapacity, normalizeLyric } from "./songModel";
import { countSyllables, layoutLineMelody, splitLyricChars } from "./melody";

/**
 * 「貼上整首歌詞」：
 * - 換行與空格完全不看，一節歌詞當作連續的字，依旋律音數（或第 1 節字數）切到各行、各和弦。
 * - 空一整行＝下一節；開頭的「一、」「1.」「(一)」「第一節」會去掉並決定節號。
 * - 單獨一行的「副歌一」「橋段」等標題，會把後面的歌詞放到編排區對應段落的行。
 */

export type PasteKind = "verse" | "prechorus" | "chorus" | "bridge";

const KIND_BY_WORD: Readonly<Record<string, PasteKind>> = {
  主歌: "verse",
  預歌: "prechorus",
  副歌: "chorus",
  橋段: "bridge",
};

export const PASTE_KIND_LABEL: Readonly<Record<PasteKind, string>> = {
  verse: "主歌",
  prechorus: "預歌",
  chorus: "副歌",
  bridge: "橋段",
};

const CN_DIGITS: Readonly<Record<string, number>> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 「一」「十二」「3」→ 數字；無法辨識回傳 null。 */
export function parseNumber(text: string): number | null {
  const value = text.trim();

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (value === "十") {
    return 10;
  }

  const ten = value.match(/^([一二三四五六七八九])?十([一二三四五六七八九])?$/);

  if (ten) {
    return (ten[1] ? CN_DIGITS[ten[1]] : 1) * 10 + (ten[2] ? CN_DIGITS[ten[2]] : 0);
  }

  return value in CN_DIGITS ? CN_DIGITS[value] : null;
}

const NUM = "[一二三四五六七八九十\\d]+";
const HEADING = new RegExp(
  `^[【\\[（(]?\\s*(主歌|副歌|預歌|橋段)\\s*(第)?\\s*(${NUM})?\\s*(節|段)?\\s*[】\\]）)]?\\s*[:：]?$`,
);
const VERSE_PREFIX = new RegExp(
  `^\\s*(?:第\\s*(${NUM})\\s*節|[（(]\\s*(${NUM})\\s*[）)]|(${NUM})\\s*[、.．:：）)])\\s*`,
);

export interface PasteBlock {
  kind: PasteKind;
  /** 第幾節（1 起算），也是歌詞列的位置 */
  number: number;
  /** 號碼是歌詞裡寫的（而不是依序推算的） */
  explicit: boolean;
  /** 連續的字（標點接在前一個字後面） */
  chars: string[];
  /** 第 i 個字是否由使用者用 / 標成新的和弦開頭 */
  breaks: boolean[];
}

interface RawGroup {
  lines: string[];
}

function splitGroups(text: string): RawGroup[] {
  const groups: RawGroup[] = [];

  for (const block of text.replace(/\r\n?/g, "\n").split(/\n[ \t　]*\n+/)) {
    let current: string[] = [];

    for (const row of block.split("\n").map((entry) => entry.trim()).filter((entry) => entry !== "")) {
      const startsVerse = VERSE_PREFIX.test(row);
      const hasLyric = current.some((entry) => !HEADING.test(entry));

      if (startsVerse && hasLyric) {
        groups.push({ lines: current });
        current = [];
      }

      current.push(row);
    }

    if (current.length > 0) {
      groups.push({ lines: current });
    }
  }

  return groups;
}

function buildChars(text: string): { chars: string[]; breaks: boolean[] } {
  const chars: string[] = [];
  const breaks: boolean[] = [];

  text.split(/[/／|｜]/).forEach((part, partIndex) => {
    const partChars = splitLyricChars(part.replace(/[\s　]/g, ""));

    partChars.forEach((char, charIndex) => {
      chars.push(char);
      breaks.push(partIndex > 0 && charIndex === 0);
    });
  });

  return { chars, breaks };
}

export function parsePaste(text: string, startVerse: number): PasteBlock[] {
  const blocks: PasteBlock[] = [];
  const next: Record<PasteKind, number> = { verse: startVerse, prechorus: startVerse, chorus: startVerse, bridge: startVerse };
  let pending: { kind: PasteKind; number: number | null } | null = null;

  for (const group of splitGroups(text)) {
    const rows = [...group.lines];
    let kind: PasteKind = "verse";
    let number: number | null = null;
    let hadHeading = false;

    const headingMatch = rows[0]?.match(HEADING);

    if (headingMatch) {
      rows.shift();
      kind = KIND_BY_WORD[headingMatch[1]];
      number = headingMatch[3] ? parseNumber(headingMatch[3]) : null;
      hadHeading = true;
    }

    if (rows.length === 0) {
      pending = { kind, number };
      continue;
    }

    if (!hadHeading && pending) {
      kind = pending.kind;
      number = pending.number;
    }

    pending = null;

    const prefix = rows[0].match(VERSE_PREFIX);

    if (prefix) {
      const value = parseNumber(prefix[1] ?? prefix[2] ?? prefix[3] ?? "");
      rows[0] = rows[0].replace(VERSE_PREFIX, "");

      if (value !== null && number === null) {
        number = value;
      }
    }

    const { chars, breaks } = buildChars(rows.join(""));

    if (chars.length === 0) {
      continue;
    }

    const explicit = number !== null;
    const finalNumber = number ?? next[kind];
    next[kind] = finalNumber + 1;
    blocks.push({ kind, number: finalNumber, explicit, chars, breaks });
  }

  return blocks;
}

/* ---------- 規劃 ---------- */

export type FillMode = "melody" | "counts" | "markers" | "sentence";

export interface LinePlan {
  lineId: string;
  mode: FillMode;
  /** 每個和弦分到的字 */
  pieces: string[];
  /** 每個和弦預期的字數；不知道時為 null */
  slots: (number | null)[];
}

export interface BlockPlan {
  blockIndex: number;
  kind: PasteKind;
  number: number;
  /** 寫到歌詞的第幾列（0 起算）；超出上限時為 null */
  row: number | null;
  lines: LinePlan[];
  /** 沒有放進去的字數 */
  leftover: number;
  total: number;
}

export interface PlanResult {
  plans: BlockPlan[];
  notices: string[];
}

const END_PUNCT = /[，。、；：！？,.;:!?…—─]['"’”」』）)》〉】]*$/;

export function endsWithPunct(piece: string): boolean {
  return END_PUNCT.test(piece);
}

function firstRow(lyric: string): string {
  return lyric.split("\n")[0] ?? "";
}

/** 這一行每個和弦預期的字數。 */
export function lineSlotInfo(song: Song, line: SongLine): { slots: number[]; mode: "melody" | "counts" | null } {
  const layout = layoutLineMelody(line.items, (item) => itemCapacity(song, item));

  if (layout.hasAny) {
    const slots = line.items.map((item) => {
      const columns = layout.cells.get(item.id);
      return columns ? countSyllables(columns) : 0;
    });

    if (slots.some((count) => count > 0)) {
      return { slots, mode: "melody" };
    }
  }

  const counts = line.items.map((item) => splitLyricChars(firstRow(item.lyric).replace(/[\s　]/g, "")).length);
  return counts.some((count) => count > 0) ? { slots: counts, mode: "counts" } : { slots: counts, mode: null };
}

/** 預設要放歌詞的行。 */
export function defaultTargetIds(song: Song): string[] {
  const sections = effectiveSections(song);
  const informed = song.lines.map((line) => lineSlotInfo(song, line).mode !== null);
  const anyInformed = informed.some(Boolean);

  return song.lines
    .filter((line, index) => {
      if (line.items.length === 0 || sections[index].kind === "interlude" || sections[index].kind === "outro") {
        return false;
      }

      return anyInformed ? informed[index] : true;
    })
    .map((line) => line.id);
}

function evenSplit(chars: string[], parts: number): string[] {
  const result: string[] = [];
  let cursor = 0;

  for (let index = 0; index < parts; index += 1) {
    const size = Math.ceil((chars.length - cursor) / (parts - index));
    result.push(chars.slice(cursor, cursor + size).join(""));
    cursor += size;
  }

  return result;
}

function fillLine(
  song: Song,
  line: SongLine,
  block: PasteBlock,
  start: number,
): { plan: LinePlan; next: number } {
  const info = lineSlotInfo(song, line);
  const { chars, breaks } = block;
  const count = line.items.length;

  if (info.mode === "melody" || (info.mode === "counts" && !breaks.some(Boolean))) {
    const pieces: string[] = [];
    let cursor = start;

    info.slots.forEach((size) => {
      pieces.push(chars.slice(cursor, cursor + size).join(""));
      cursor += size;
    });

    return { plan: { lineId: line.id, mode: info.mode, pieces, slots: info.slots }, next: cursor };
  }

  const voiced = info.mode === "counts"
    ? info.slots.map((size, index) => (size > 0 ? index : -1)).filter((index) => index >= 0)
    : line.items.map((_, index) => index);

  if (breaks.some(Boolean)) {
    const pieces = line.items.map(() => "");
    let cursor = start;

    voiced.forEach((itemIndex) => {
      let end = cursor + 1;

      while (end < chars.length && !breaks[end]) {
        end += 1;
      }

      pieces[itemIndex] = chars.slice(cursor, Math.min(end, chars.length)).join("");
      cursor = Math.min(end, chars.length);
    });

    return { plan: { lineId: line.id, mode: "markers", pieces, slots: line.items.map(() => null) }, next: cursor };
  }

  // 沒有任何線索：取到下一個句讀為止，平均分給各和弦
  let end = start;

  while (end < chars.length) {
    end += 1;

    if (endsWithPunct(chars[end - 1])) {
      break;
    }
  }

  const parts = evenSplit(chars.slice(start, end), Math.max(1, voiced.length));
  const pieces = line.items.map(() => "");
  voiced.forEach((itemIndex, order) => {
    pieces[itemIndex] = parts[order] ?? "";
  });

  return { plan: { lineId: line.id, mode: "sentence", pieces, slots: new Array(count).fill(null) }, next: end };
}

export function planPaste(song: Song, targetIds: readonly string[], blocks: readonly PasteBlock[]): PlanResult {
  const sections = effectiveSections(song);
  const notices: string[] = [];
  const typedKinds = new Set<SectionKind>(blocks.filter((block) => block.kind !== "verse").map((block) => block.kind));
  const plans: BlockPlan[] = [];

  blocks.forEach((block, blockIndex) => {
    const label = block.kind === "verse" ? `第 ${block.number} 節` : `${PASTE_KIND_LABEL[block.kind]}（第 ${block.number} 節位置）`;
    const row = block.number - 1;

    if (row < 0 || row >= MAX_LYRIC_ROWS) {
      notices.push(`${label}超出上限（最多 ${MAX_LYRIC_ROWS} 節），沒有放入。`);
      plans.push({ blockIndex, kind: block.kind, number: block.number, row: null, lines: [], leftover: 0, total: block.chars.length });
      return;
    }

    const targets = song.lines.filter((line, index) => {
      if (!targetIds.includes(line.id)) {
        return false;
      }

      const kind = sections[index].kind;
      return block.kind === "verse" ? !typedKinds.has(kind) : kind === block.kind;
    });

    if (targets.length === 0) {
      notices.push(
        block.kind === "verse"
          ? `${label}沒有可以放的行（請在「要放歌詞的行」勾選）。`
          : `編排區沒有標成「${PASTE_KIND_LABEL[block.kind]}」的行，${label}沒有放入。`,
      );
    }

    const lines: LinePlan[] = [];
    let cursor = 0;

    for (const line of targets) {
      if (cursor >= block.chars.length) {
        const info = lineSlotInfo(song, line);
        lines.push({
          lineId: line.id,
          mode: info.mode ?? "sentence",
          pieces: line.items.map(() => ""),
          slots: info.mode ? info.slots : line.items.map(() => null),
        });
        continue;
      }

      const result = fillLine(song, line, block, cursor);
      lines.push(result.plan);
      cursor = result.next;
    }

    const leftover = Math.max(0, block.chars.length - cursor);

    if (leftover > 0 && targets.length > 0) {
      notices.push(`${label}有 ${leftover} 個字放不進去（字比編排區的音數多），請檢查最後一行或貼上的內容。`);
    }

    plans.push({ blockIndex, kind: block.kind, number: block.number, row, lines, leftover, total: block.chars.length });
  });

  return { plans, notices };
}

/* ---------- 檢查與套用 ---------- */

export function pieceLength(piece: string): number {
  return splitLyricChars(piece).length;
}

export interface LineCheck {
  /** 每個和弦的字數和預期不同 */
  bad: boolean[];
  /** 這一行的結尾不是標點（可能是字數對不上），只在整段有標點時才判斷 */
  noPunct: boolean;
}

export function checkLine(plan: LinePlan, pieces: readonly string[], isLastOfBlock: boolean, blockHasPunct: boolean): LineCheck {
  const bad = pieces.map((piece, index) => plan.slots[index] !== null && pieceLength(piece) !== plan.slots[index]);
  const last = [...pieces].reverse().find((piece) => piece !== "") ?? "";
  const noPunct = blockHasPunct && !isLastOfBlock && last !== "" && !endsWithPunct(last);
  return { bad, noPunct };
}

export function applyPaste(song: Song, plans: readonly BlockPlan[]): Song {
  const byLine = new Map<string, Map<number, string[]>>();

  for (const plan of plans) {
    if (plan.row === null) {
      continue;
    }

    for (const linePlan of plan.lines) {
      const rows = byLine.get(linePlan.lineId) ?? new Map<number, string[]>();
      rows.set(plan.row, linePlan.pieces);
      byLine.set(linePlan.lineId, rows);
    }
  }

  if (byLine.size === 0) {
    return song;
  }

  return {
    ...song,
    lines: song.lines.map((line) => {
      const rowsByIndex = byLine.get(line.id);

      if (!rowsByIndex) {
        return line;
      }

      return {
        ...line,
        items: line.items.map((item, itemIndex) => {
          const rows = item.lyric.split("\n");

          for (const [row, pieces] of rowsByIndex) {
            while (rows.length <= row) {
              rows.push("");
            }

            rows[row] = pieces[itemIndex] ?? "";
          }

          while (rows.length > 1 && rows[rows.length - 1] === "") {
            rows.pop();
          }

          return { ...item, lyric: normalizeLyric(rows.join("\n")) };
        }),
      };
    }),
  };
}
