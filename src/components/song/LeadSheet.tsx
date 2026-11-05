import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { findChordShapes } from "../../data/chordShapes";
import { MELODY_BEAT_EM, assignLyric, layoutLineMelody } from "../../services/melody";
import type { LineMelodyLayout, MelodyColumn } from "../../services/melody";
import { buildFlowCells, packRows } from "../../services/flow";
import type { FlowCell } from "../../services/flow";
import { effectiveBarIds, effectiveSections, itemBeats, itemCapacity } from "../../services/songModel";
import type { Song, SongItem } from "../../types/song";
import { ChordDiagram } from "../chord/ChordDiagram";
import { ChordName } from "../chord/ChordName";

export type DiagramMode = "legend" | "first" | "all" | "off";
export type DiagramSize = "medium" | "large" | "xlarge";

export const DIAGRAM_MODE_LABELS: Record<DiagramMode, string> = {
  legend: "上方圖例",
  first: "首次出現小圖",
  all: "每個和弦都顯示",
  off: "不顯示",
};

/** 和弦圖大小（像素寬）；視力不好時可選大一點。 */
export const DIAGRAM_SIZES: Record<DiagramSize, { label: string; width: number }> = {
  medium: { label: "標準", width: 72 },
  large: { label: "大", width: 96 },
  xlarge: { label: "特大", width: 128 },
};

/** 1 拍的欄寬（em）；歌詞比這個寬時，欄位會自動撐開。 */
const BEAT_WIDTH_EM = 1.6;
const VERSE_NUMBERS = ["一", "二", "三", "四", "五", "六"] as const;

interface LeadSheetProps {
  song: Song;
  /** 移調預覽：itemId → 顯示用和弦名稱 */
  symbols?: Readonly<Record<string, string>>;
  diagramMode: DiagramMode;
  /** 和弦圖寬度（像素） */
  diagramWidth?: number;
  /** 演奏模式：放大字體 */
  large?: boolean;
  /** 顯示簡譜旋律（預設顯示；歌曲沒有旋律時沒有影響） */
  showMelody?: boolean;
  markedLineId?: string | null;
  onLineClick?: (lineId: string) => void;
  /** 只畫其中一部分（譜架預覽用）：第 start～end-1 行，legend 為是否包含上方圖例；其餘照整首歌計算 */
  part?: { start: number; end: number; legend: boolean };
  /** 譜架模式：每一行的和弦依拍數拉開，填滿整欄寬 */
  stretch?: boolean;
  /** 連續接排：不再一行歌譜一列，而是依欄寬把和弦折成一列一列（只在小節線折行，段落開頭另起一列） */
  flow?: boolean;
  /** 連續接排時由外部算好的每一列（欄編號）；沒有給就自己依寬度排。part 此時指的是第幾列 */
  rows?: readonly (readonly number[])[] | null;
  /** 連續接排時，量好每個和弦的自然寬度後通知外部（外部據此排列） */
  onFlowMetrics?: (metrics: FlowMetrics) => void;
  /** 連續接排時，即使有給 rows 也要量寬度（譜架模式的量測用） */
  measureWidths?: boolean;
  /** 上下間距微調 */
  spacing?: Spacing;
  /** 連續接排時，上方圖例每一塊放幾張圖（一塊一列，才能分到不同欄）；沒給就是一整塊 */
  legendRows?: readonly number[];
}

/** 上下間距微調（像素，可為負）：和弦名稱、旋律、歌詞（各節之間）、列與列之間 */
export interface Spacing {
  chord: number;
  melody: number;
  lyric: number;
  row: number;
}

export const DEFAULT_SPACING: Spacing = { chord: 0, melody: 0, lyric: 0, row: 0 };

export interface FlowMetrics {
  cells: FlowCell[];
  widths: number[];
}

interface CellContext {
  rowCount: number;
  flags: LineMelodyLayout | null;
  showVerseNo: boolean;
}

function mergeFlags(list: readonly (LineMelodyLayout | null)[]): LineMelodyLayout | null {
  const real = list.filter((entry): entry is LineMelodyLayout => entry !== null);

  if (real.length === 0) {
    return null;
  }

  return {
    cells: new Map(),
    hasAny: real.some((entry) => entry.hasAny),
    needHigh: real.some((entry) => entry.needHigh),
    needLow: real.some((entry) => entry.needLow),
    needSlur: real.some((entry) => entry.needSlur),
    needLines: real.some((entry) => entry.needLines),
  };
}

function contentWidth(element: HTMLElement): number {
  return element.clientWidth - (parseFloat(getComputedStyle(element).paddingLeft) || 0);
}

interface DiagramEntry {
  key: string;
  symbol: string;
  shapeId?: string;
}

function DiagramFigure({ entry, width }: { entry: DiagramEntry; width: number }) {
  const shapes = findChordShapes(entry.symbol);
  const shape = shapes.find((candidate) => candidate.id === entry.shapeId) ?? shapes[0];

  if (!shape) {
    return <div className="lead-cell__diagram lead-cell__diagram--none">—</div>;
  }

  return (
    <div className="lead-cell__diagram">
      <ChordDiagram shape={shape} compact displaySymbol={entry.symbol} width={width} />
    </div>
  );
}

function verseRows(line: { items: SongItem[] }): number {
  return line.items.reduce((max, item) => Math.max(max, item.lyric ? item.lyric.split("\n").length : 0), 0);
}

const ACCIDENTALS: Record<string, string> = { "#": "♯", b: "♭", n: "♮" };

function dots(count: number): string {
  return "•".repeat(Math.abs(count));
}

/** 簡譜的一個音符欄：連音線、高八度點、數字（升降、附點）、底線、低八度點。 */
function MelodyColumnView({ column, flags, stretch }: { column: MelodyColumn; flags: LineMelodyLayout; stretch: boolean }) {
  const classes = [
    "mel-col",
    column.beatStart ? "is-beat-start" : "",
    column.slur ? `slur-${column.slur}` : "",
    column.kind === "hold" ? "is-hold" : "",
    column.kind === "rest" ? "is-rest" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      style={
        stretch
          ? { flexGrow: Math.max(column.beats, 0.25), flexShrink: 0, flexBasis: `${column.widthEm}em`, minWidth: `${column.widthEm}em` }
          : { width: `${column.widthEm}em` }
      }
    >
      {flags.needSlur && <span className="mel-slur" aria-hidden="true" />}
      {flags.needHigh && (
        <span className="mel-dots" aria-hidden="true">
          {column.octave > 0 ? dots(column.octave) : ""}
        </span>
      )}
      <span className="mel-num">
        {column.accidental && <sup className="mel-acc">{ACCIDENTALS[column.accidental]}</sup>}
        {column.kind === "hold" ? "–" : column.degree}
        {column.dotted && <span className="mel-dot">·</span>}
      </span>
      {flags.needLines && (
        <span className="mel-lines" aria-hidden="true">
          {Array.from({ length: column.underlines }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      )}
      {flags.needLow && (
        <span className="mel-dots mel-dots--low" aria-hidden="true">
          {column.octave < 0 ? dots(column.octave) : ""}
        </span>
      )}
    </span>
  );
}

/** 這個和弦後面的小節線樣式：明確設定 → 全曲最後一個和弦 → 一般小節線。 */
function barKind(item: SongItem, isSongEnd: boolean, hasBar: boolean): string | null {
  if (item.barStyle) {
    return item.barStyle === "repeatEnd" ? "repeat-end" : item.barStyle;
  }

  if (isSongEnd && !item.noBar) {
    return "final";
  }

  return hasBar ? "single" : null;
}

interface Volta {
  label: string;
  first: boolean;
}

/** 「房子」（第 1、2 次結尾）涵蓋的和弦：從標記的和弦到有小節線樣式的和弦或行尾。 */
function voltaRanges(items: readonly SongItem[]): Map<string, Volta> {
  const result = new Map<string, Volta>();
  let open: number | null = null;

  for (const item of items) {
    const first = item.ending !== undefined;

    if (first) {
      open = item.ending as number;
    }

    if (open !== null) {
      result.set(item.id, { label: `${open}.`, first });

      if (item.barStyle) {
        open = null;
      }
    }
  }

  return result;
}

/** 簡譜風格譜面：每個和弦上面是名稱，下面是要唱的歌詞；欄寬依拍數決定。 */
export function LeadSheet({
  song,
  symbols,
  diagramMode,
  diagramWidth = 72,
  large = false,
  showMelody = true,
  markedLineId = null,
  onLineClick,
  part,
  stretch = false,
  flow = false,
  rows: rowsProp,
  onFlowMetrics,
  measureWidths = false,
  spacing,
  legendRows,
}: LeadSheetProps) {
  const sections = effectiveSections(song);
  const bars = useMemo(() => effectiveBarIds(song), [song]);
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const metricsCallback = useRef(onFlowMetrics);
  metricsCallback.current = onFlowMetrics;

  // 每個和弦（名稱＋按法）第一次出現的位置，圖例與「首次出現小圖」共用。
  const { firstIds, legend } = useMemo(() => {
    const seen = new Set<string>();
    const ids = new Set<string>();
    const entries: DiagramEntry[] = [];

    for (const line of song.lines) {
      for (const item of line.items) {
        const override = symbols?.[item.id];
        const symbol = override ?? item.symbol;
        const shapeId = override !== undefined && override !== item.symbol ? undefined : item.shapeId;
        const key = `${symbol}|${shapeId ?? ""}`;

        if (!seen.has(key)) {
          seen.add(key);
          ids.add(item.id);
          entries.push({ key, symbol, shapeId });
        }
      }
    }

    return { firstIds: ids, legend: entries };
  }, [song, symbols]);

  // 每一行歌譜的固定資料（歌詞節數、旋律排版、房子、是否標節號）
  const lineInfo = useMemo(
    () =>
      song.lines.map((line, lineIndex) => {
        const verses = verseRows(line);
        const melody = showMelody ? layoutLineMelody(line.items, (item) => itemCapacity(song, item)) : null;

        return {
          verses,
          melody,
          melodyLine: melody?.hasAny === true,
          voltas: voltaRanges(line.items),
          // 比照原譜：每個段落的第一行，如果有 2 節以上歌詞，才標「一、二、…」。
          numbered: verses >= 2 && (line.section !== "" || lineIndex === 0),
        };
      }),
    [song, showMelody],
  );

  // 凸排：整首歌只要有一行標了節號，每一行左邊都留出同樣寬的空白，歌詞左緣才會對齊。
  const lastItemId = [...song.lines].reverse().find((line) => line.items.length > 0)?.items.slice(-1)[0]?.id ?? null;

  const hasGutter = song.lines.some(
    (line, lineIndex) => verseRows(line) >= 2 && (line.section !== "" || lineIndex === 0),
  );

  // ---- 連續接排：量每個和弦的自然寬度，再依欄寬排成列 ----
  const flowCells = useMemo(() => (flow ? buildFlowCells(song, bars) : []), [flow, song, bars]);
  const measureKey = useMemo(() => ({}), [song, symbols, diagramMode, diagramWidth, showMelody, large, stretch, flow]);
  const [measured, setMeasured] = useState<{ key: object; widths: number[]; avail: number } | null>(null);
  const [liveAvail, setLiveAvail] = useState<number | null>(null);
  const widths = measured && measured.key === measureKey ? measured.widths : null;
  const needMeasure = flow && widths === null && (measureWidths || !rowsProp);

  useLayoutEffect(() => {
    if (!needMeasure) {
      return;
    }

    const container = measureRef.current;
    const probe = probeRef.current?.querySelector<HTMLElement>(".lead-line__cells");

    if (!container) {
      return;
    }

    const measuredWidths = Array.from(container.children).map((element) => (element as HTMLElement).getBoundingClientRect().width);
    const avail = probe ? contentWidth(probe) : 0;
    setMeasured({ key: measureKey, widths: measuredWidths, avail });
    setLiveAvail(avail);
  }, [needMeasure, measureKey]);

  const hasMetricsCallback = onFlowMetrics !== undefined;

  useEffect(() => {
    if (widths) {
      metricsCallback.current?.({ cells: flowCells, widths });
    }
  }, [widths, flowCells, hasMetricsCallback]);

  // 自己排列時（沒有外部給 rows），欄寬改變就重排
  useEffect(() => {
    const root = rootRef.current;

    if (!flow || rowsProp || needMeasure || !root || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const update = () => {
      const cells = root.querySelector<HTMLElement>(".lead-line__cells");

      if (cells) {
        const next = contentWidth(cells);
        setLiveAvail((previous) => (previous !== null && Math.abs(previous - next) < 0.5 ? previous : next));
      }
    };

    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [flow, rowsProp, needMeasure]);

  const selfRows = useMemo(() => {
    if (!flow || rowsProp || !widths) {
      return null;
    }

    const avail = liveAvail ?? measured?.avail ?? 0;
    return avail > 0 ? packRows(flowCells, widths, avail - 2, 0) : null;
  }, [flow, rowsProp, widths, liveAvail, measured, flowCells]);

  const flowRows = rowsProp ?? selfRows;
  const rowsValid = flowRows !== null && flowRows.every((row) => row.every((index) => index < flowCells.length));

  function renderCell(lineIndex: number, itemIndex: number, context: CellContext): ReactNode {
    const line = song.lines[lineIndex];
    const item = line.items[itemIndex];
    const info = lineInfo[lineIndex];
    const override = symbols?.[item.id];
    const symbol = override ?? item.symbol;
    const beats = itemBeats(song, item);
    const lyricRows = (item.lyric || "").split("\n");
    const rowCount = context.rowCount;
    const showDiagram = diagramMode === "all" || (diagramMode === "first" && firstIds.has(item.id));
    const entry: DiagramEntry = {
      key: item.id,
      symbol,
      shapeId: override !== undefined && override !== item.symbol ? undefined : item.shapeId,
    };
    const columns = info.melody?.cells.get(item.id) ?? null;
    const flags = context.flags;
    const bar = barKind(item, item.id === lastItemId, bars.has(item.id));
    const volta = info.voltas.get(item.id);
    const assigned = columns
      ? Array.from({ length: rowCount }, (_, rowIndex) => assignLyric(columns, lyricRows[rowIndex] ?? ""))
      : null;
    const hasSlots = columns ? columns.some((column) => column.syllable) : false;
    const minWidth = info.melodyLine
      ? `${(itemCapacity(song, item) * MELODY_BEAT_EM).toFixed(2)}em`
      : beats
        ? `${beats * BEAT_WIDTH_EM}em`
        : undefined;
    const topClasses = ["lead-cell__top", bar ? `has-bar bar--${bar}` : "", item.repeatStart ? "has-repeat-start" : ""]
      .filter(Boolean)
      .join(" ");

    return (
      <Fragment key={item.id}>
        <div
          className={`lead-cell${item.repeatStart ? " is-repeat-start" : ""}`}
          style={
            stretch
              ? { minWidth, flexGrow: Math.max(itemCapacity(song, item) || beats || 1, 0.5), flexShrink: 0 }
              : minWidth
                ? { minWidth }
                : undefined
          }
        >
          {volta && <div className={`lead-cell__volta${volta.first ? " is-first" : ""}`}>{volta.first ? volta.label : ""}</div>}

          {showDiagram && <DiagramFigure entry={entry} width={diagramWidth} />}

          <div className={topClasses}>
            <div className="lead-cell__chordrow">
              <strong className="lead-cell__chord">
                <ChordName symbol={symbol} />
              </strong>
            </div>

            {columns && flags && (
              <div className="mel-row">
                {columns.map((column) => (
                  <MelodyColumnView key={column.key} column={column} flags={flags} stretch={stretch} />
                ))}
              </div>
            )}
          </div>

          <span className="lead-cell__lyrics">
            {Array.from({ length: rowCount }, (_, rowIndex) => {
              const verseNo = context.showVerseNo && (
                <span className="verse-no">{VERSE_NUMBERS[rowIndex] ?? rowIndex + 1}、</span>
              );

              if (columns && assigned && hasSlots) {
                return (
                  <span className="lead-cell__lyric is-aligned" key={rowIndex}>
                    {verseNo}
                    {columns.map((column, columnIndex) => (
                      <span
                        className="syl"
                        key={column.key}
                        style={
                          stretch
                            ? { minWidth: `${column.widthEm}em`, flexGrow: Math.max(column.beats, 0.25), flexBasis: `${column.widthEm}em` }
                            : { minWidth: `${column.widthEm}em` }
                        }
                      >
                        {assigned[rowIndex][columnIndex] || " "}
                      </span>
                    ))}
                  </span>
                );
              }

              return (
                <span className="lead-cell__lyric" key={rowIndex}>
                  {verseNo}
                  {lyricRows[rowIndex] || " "}
                </span>
              );
            })}
          </span>
        </div>
      </Fragment>
    );
  }

  const renderLegend = (entries: readonly DiagramEntry[], key: string) => (
    <div className="lead-legend" aria-label="本曲和弦按法" key={key}>
      {entries.map((entry) => (
        <figure className="lead-legend__item" key={entry.key}>
          <DiagramFigure entry={entry} width={diagramWidth} />
          <figcaption className="lead-cell__chord">
            <ChordName symbol={entry.symbol} />
          </figcaption>
        </figure>
      ))}
    </div>
  );

  const showLegend = diagramMode === "legend" && legend.length > 0;
  const legendBlock = showLegend && (!part || part.legend) && renderLegend(legend, "legend");

  // 連續接排：圖例也分成一塊一塊（每塊一列），和各列一起依序排進各欄
  const legendChunks: DiagramEntry[][] = [];

  if (showLegend) {
    const counts = legendRows && legendRows.length > 0 ? legendRows : [legend.length];
    let from = 0;

    for (const count of counts) {
      legendChunks.push(legend.slice(from, from + count));
      from += count;
    }

    if (from < legend.length) {
      legendChunks.push(legend.slice(from));
    }
  }

  const rootStyle = spacing
    ? ({
        "--sp-chord": `${spacing.chord}px`,
        "--sp-melody": `${spacing.melody}px`,
        "--sp-lyric": `${spacing.lyric}px`,
        "--sp-row": `${spacing.row}px`,
      } as CSSProperties)
    : undefined;
  const rootClass = `lead-sheet${large ? " lead-sheet--large" : ""}${hasGutter ? " has-gutter" : ""}${stretch ? " lead-sheet--stretch" : ""}${flow ? " lead-sheet--flow" : ""}`;

  if (flow) {
    const rowList = rowsValid && flowRows && !(needMeasure) ? flowRows : [];
    const blocks: ({ kind: "legend"; entries: DiagramEntry[] } | { kind: "row"; row: readonly number[] })[] = [
      ...legendChunks.map((entries) => ({ kind: "legend" as const, entries })),
      ...rowList.map((row) => ({ kind: "row" as const, row })),
    ];
    const visible = part ? blocks.slice(part.start, part.end) : blocks;

    return (
      <div className={rootClass} ref={rootRef} style={rootStyle}>

        {needMeasure && (
          <>
            <div className="lead-flow-measure" ref={measureRef} aria-hidden="true">
              {flowCells.map((cell) =>
                renderCell(cell.lineIndex, cell.itemIndex, {
                  rowCount: Math.max(lineInfo[cell.lineIndex].verses, 1),
                  flags: lineInfo[cell.lineIndex].melody,
                  showVerseNo: false,
                }),
              )}
            </div>
            <div className="lead-line lead-flow-probe" ref={probeRef} aria-hidden="true">
              <div className="lead-line__label" />
              <div className="lead-line__cells" />
            </div>
          </>
        )}

        {visible.map((block, rowIndex) => {
          if (block.kind === "legend") {
            return renderLegend(block.entries, `legend-${(part?.start ?? 0) + rowIndex}`);
          }

          const row = block.row;
          const first = flowCells[row[0]];
          const lineIndex = first.lineIndex;
          const section = sections[lineIndex];
          const isChorus = section.kind === "chorus";
          const startsLine = first.itemIndex === 0;
          const lineIndexes = Array.from(new Set(row.map((index) => flowCells[index].lineIndex)));
          const isMarked = markedLineId !== null && lineIndexes.some((index) => song.lines[index].id === markedLineId);
          const rowCount = Math.max(1, ...lineIndexes.map((index) => lineInfo[index].verses));
          const flags = mergeFlags(lineIndexes.map((index) => lineInfo[index].melody));
          const numbered = startsLine && lineInfo[lineIndex].numbered;
          const classes = [
            "lead-line",
            isChorus ? "is-chorus" : "",
            isMarked ? "is-marked" : "",
            numbered ? "is-numbered" : "",
            onLineClick ? "is-clickable" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={`${row[0]}-${(part?.start ?? 0) + rowIndex}`}
              className={classes}
              data-line-id={song.lines[lineIndex].id}
              onClick={onLineClick ? () => onLineClick(song.lines[lineIndex].id) : undefined}
            >
              <div className="lead-line__label">
                {isMarked && <span className="lead-line__marker">▶ 唱到這裡</span>}
                {startsLine && section.badge && (
                  <span className={`section-badge${isChorus ? " section-badge--chorus" : ""}`}>{section.badge}</span>
                )}
              </div>

              <div className="lead-line__cells">
                {row.map((index) => {
                  const cell = flowCells[index];
                  return renderCell(cell.lineIndex, cell.itemIndex, {
                    rowCount,
                    flags,
                    showVerseNo: numbered && cell.itemIndex === 0 && index === row[0],
                  });
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={rootClass} ref={rootRef} style={rootStyle}>
      {legendBlock}

      {song.lines.map((line, lineIndex) => {
        if (part && (lineIndex < part.start || lineIndex >= part.end)) {
          return null;
        }

        const section = sections[lineIndex];
        const isChorus = section.kind === "chorus";
        const isMarked = markedLineId === line.id;
        const info = lineInfo[lineIndex];
        const classes = [
          "lead-line",
          isChorus ? "is-chorus" : "",
          isMarked ? "is-marked" : "",
          info.numbered ? "is-numbered" : "",
          onLineClick ? "is-clickable" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={line.id}
            className={classes}
            data-line-id={line.id}
            onClick={onLineClick ? () => onLineClick(line.id) : undefined}
          >
            <div className="lead-line__label">
              {isMarked && <span className="lead-line__marker">▶ 唱到這裡</span>}
              {section.badge && (
                <span className={`section-badge${isChorus ? " section-badge--chorus" : ""}`}>{section.badge}</span>
              )}
            </div>

            <div className="lead-line__cells">
              {line.items.length === 0 && <span className="lead-line__empty">（空白行）</span>}

              {line.items.map((_item, itemIndex) =>
                renderCell(lineIndex, itemIndex, {
                  rowCount: Math.max(info.verses, 1),
                  flags: info.melody,
                  showVerseNo: info.numbered && itemIndex === 0,
                }),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
