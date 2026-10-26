import type { Song, SongLine } from "../types/song";
import { MAX_LYRIC_ROWS, effectiveSections, normalizeLyric } from "./songModel";

/** 切字數時略過的標點與空白（歌詞裡的標點不佔一個音）。 */
const IGNORED = /[\s　，。、；：！？「」『』（）《》〈〉…—～~,.;:!?'"()\[\]\-]/gu;
const MARKERS = /[/／|｜]/;

export type LineStatus = "ok" | "too-many" | "too-few" | "missing";

export interface LinePlan {
  lineId: string;
  /** 每個和弦分到的字，長度等於該行和弦數 */
  pieces: string[];
  status: LineStatus;
  /** 用 / 標記切分，而非照第一節字數 */
  usedMarkers: boolean;
}

export interface VersePlan {
  /** 第幾節（第一節已經打好，這裡從 2 開始） */
  verseNumber: number;
  lines: LinePlan[];
  /** 貼上的句數與目標行數的差（正數＝多出來的句子） */
  extraLines: number;
}

function chars(text: string): string[] {
  return Array.from(text.replace(IGNORED, ""));
}

/** 第一節（第一列歌詞）在每個和弦下的字數。 */
export function firstVerseCounts(line: SongLine): number[] {
  return line.items.map((item) => chars(item.lyric.split("\n")[0] ?? "").length);
}

/** 預設要補歌詞的行：第一節有字、而且不是副歌的行。 */
export function defaultTargetLineIds(song: Song): string[] {
  const sections = effectiveSections(song);

  return song.lines
    .filter(
      (line, index) =>
        sections[index].kind !== "chorus" && firstVerseCounts(line).some((count) => count > 0),
    )
    .map((line) => line.id);
}

/** 以空白行分節，每節再以換行分句。 */
export function parseVerses(text: string): string[][] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t　]*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((row) => row.trim())
        .filter((row) => row.length > 0),
    )
    .filter((rows) => rows.length > 0);
}

/** 把一句歌詞分給一行的各個和弦。 */
export function splitLyricLine(
  text: string,
  counts: readonly number[],
): { pieces: string[]; status: LineStatus; usedMarkers: boolean } {
  const voiced = counts.map((count, index) => (count > 0 ? index : -1)).filter((index) => index >= 0);
  const pieces = counts.map(() => "");

  if (MARKERS.test(text)) {
    const parts = text
      .split(/[/／|｜]/)
      .map((part) => chars(part).join(""))
      .filter((part) => part.length > 0);

    parts.forEach((part, order) => {
      const target = voiced[Math.min(order, voiced.length - 1)];
      pieces[target] += part;
    });

    const status: LineStatus =
      parts.length > voiced.length ? "too-many" : parts.length < voiced.length ? "too-few" : "ok";
    return { pieces, status, usedMarkers: true };
  }

  const all = chars(text);
  let cursor = 0;

  voiced.forEach((index) => {
    pieces[index] = all.slice(cursor, cursor + counts[index]).join("");
    cursor += counts[index];
  });

  let status: LineStatus = "ok";

  if (cursor < all.length) {
    pieces[voiced[voiced.length - 1]] += all.slice(cursor).join("");
    status = "too-many";
  } else if (all.length < cursor) {
    status = "too-few";
  }

  return { pieces, status, usedMarkers: false };
}

/** 依第一節的形式，替每一節、每個目標行算出各和弦的字。 */
export function planVerses(song: Song, targetLineIds: readonly string[], verses: readonly string[][]): VersePlan[] {
  const targets = targetLineIds
    .map((id) => song.lines.find((line) => line.id === id))
    .filter((line): line is SongLine => Boolean(line));

  return verses.slice(0, MAX_LYRIC_ROWS - 1).map((rows, verseIndex) => ({
    verseNumber: verseIndex + 2,
    extraLines: rows.length - targets.length,
    lines: targets.map((line, lineIndex) => {
      const counts = firstVerseCounts(line);
      const row = rows[lineIndex];

      if (row === undefined) {
        return { lineId: line.id, pieces: counts.map(() => ""), status: "missing" as const, usedMarkers: false };
      }

      return { lineId: line.id, ...splitLyricLine(row, counts) };
    }),
  }));
}

/** 把計畫寫回歌曲：每個和弦保留第一列，其餘列換成新的各節。 */
export function applyVersePlan(song: Song, plans: readonly VersePlan[]): Song {
  if (plans.length === 0) {
    return song;
  }

  const byLine = new Map<string, string[][]>();

  for (const plan of plans) {
    for (const linePlan of plan.lines) {
      const verses = byLine.get(linePlan.lineId) ?? [];
      verses.push(linePlan.pieces);
      byLine.set(linePlan.lineId, verses);
    }
  }

  return {
    ...song,
    lines: song.lines.map((line) => {
      const verses = byLine.get(line.id);

      if (!verses) {
        return line;
      }

      return {
        ...line,
        items: line.items.map((item, itemIndex) => {
          const rows = [item.lyric.split("\n")[0] ?? ""];

          for (const pieces of verses) {
            rows.push(pieces[itemIndex] ?? "");
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
