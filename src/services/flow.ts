import type { Song } from "../types/song";

/**
 * 連續接排：把整首歌的和弦（欄）排成一串，依欄寬折成一列一列。
 * 折行只在小節線，一列放整數個小節；段落（主歌、副歌…）開頭強制換列。
 */
export interface FlowCell {
  id: string;
  lineIndex: number;
  itemIndex: number;
  /** 這個和弦後面是小節線（可以在這裡折行） */
  barEnd: boolean;
  /** 這個和弦是段落開頭，必須另起一列 */
  forceBreak: boolean;
}

export function buildFlowCells(song: Song, bars: ReadonlySet<string>): FlowCell[] {
  const cells: FlowCell[] = [];

  song.lines.forEach((line, lineIndex) => {
    line.items.forEach((item, itemIndex) => {
      cells.push({
        id: item.id,
        lineIndex,
        itemIndex,
        barEnd: bars.has(item.id) || Boolean(item.barStyle) || itemIndex === line.items.length - 1,
        forceBreak: itemIndex === 0 && (lineIndex === 0 || line.section !== ""),
      });
    });
  });

  return cells;
}

/**
 * 把欄依寬度排成列（傳回每一列的欄編號）。
 * perRow > 0：固定每列幾個和弦；否則依 avail（像素）折行，優先在小節線折行，
 * 這一列完全沒有小節線時才在任意和弦之間折行。
 */
export function packRows(cells: readonly FlowCell[], widths: readonly number[], avail: number, perRow: number): number[][] {
  const rows: number[][] = [];
  let current: number[] = [];
  let currentWidth = 0;
  let lastBreak = 0;

  const flush = () => {
    if (current.length > 0) {
      rows.push(current);
    }

    current = [];
    currentWidth = 0;
    lastBreak = 0;
  };

  cells.forEach((cell, index) => {
    if (cell.forceBreak) {
      flush();
    }

    if (perRow > 0) {
      if (current.length >= perRow) {
        flush();
      }

      current.push(index);
      return;
    }

    const width = widths[index] ?? 0;

    if (current.length > 0 && currentWidth + width > avail) {
      if (lastBreak > 0 && lastBreak < current.length) {
        const carry = current.slice(lastBreak);
        rows.push(current.slice(0, lastBreak));
        current = carry;
        currentWidth = carry.reduce((sum, cellIndex) => sum + (widths[cellIndex] ?? 0), 0);
      } else {
        flush();
      }

      lastBreak = 0;
    }

    current.push(index);
    currentWidth += width;

    if (cell.barEnd) {
      lastBreak = current.length;
    }
  });

  flush();
  return rows;
}
