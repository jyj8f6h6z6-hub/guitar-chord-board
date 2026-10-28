import { Fragment, useMemo } from "react";
import { findChordShapes } from "../../data/chordShapes";
import { MELODY_BEAT_EM, assignLyric, layoutLineMelody } from "../../services/melody";
import type { LineMelodyLayout, MelodyColumn } from "../../services/melody";
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
function MelodyColumnView({ column, flags }: { column: MelodyColumn; flags: LineMelodyLayout }) {
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
    <span className={classes} style={{ width: `${column.widthEm}em` }}>
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
}: LeadSheetProps) {
  const sections = effectiveSections(song);
  const bars = useMemo(() => effectiveBarIds(song), [song]);

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

  // 凸排：整首歌只要有一行標了節號，每一行左邊都留出同樣寬的空白，歌詞左緣才會對齊。
  const lastItemId = [...song.lines].reverse().find((line) => line.items.length > 0)?.items.slice(-1)[0]?.id ?? null;

  const hasGutter = song.lines.some(
    (line, lineIndex) => verseRows(line) >= 2 && (line.section !== "" || lineIndex === 0),
  );

  return (
    <div className={`lead-sheet${large ? " lead-sheet--large" : ""}${hasGutter ? " has-gutter" : ""}`}>
      {diagramMode === "legend" && legend.length > 0 && (
        <div className="lead-legend" aria-label="本曲和弦按法">
          {legend.map((entry) => (
            <figure className="lead-legend__item" key={entry.key}>
              <DiagramFigure entry={entry} width={diagramWidth} />
              <figcaption className="lead-cell__chord">
                <ChordName symbol={entry.symbol} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {song.lines.map((line, lineIndex) => {
        const section = sections[lineIndex];
        const isChorus = section.kind === "chorus";
        const isMarked = markedLineId === line.id;
        const rows = verseRows(line);
        const melody = showMelody ? layoutLineMelody(line.items, (item) => itemCapacity(song, item)) : null;
        const melodyLine = melody?.hasAny === true;
        const voltas = voltaRanges(line.items);
        // 比照原譜：每個段落的第一行，如果有 2 節以上歌詞，才標「一、二、…」。
        const numbered = rows >= 2 && (line.section !== "" || lineIndex === 0);
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

              {line.items.map((item, itemIndex) => {
                const override = symbols?.[item.id];
                const symbol = override ?? item.symbol;
                const beats = itemBeats(song, item);
                const lyricRows = (item.lyric || "").split("\n");
                const rowCount = Math.max(rows, 1);
                const showDiagram = diagramMode === "all" || (diagramMode === "first" && firstIds.has(item.id));
                const entry: DiagramEntry = {
                  key: item.id,
                  symbol,
                  shapeId: override !== undefined && override !== item.symbol ? undefined : item.shapeId,
                };
                const columns = melody?.cells.get(item.id) ?? null;
                const bar = barKind(item, item.id === lastItemId, bars.has(item.id));
                const volta = voltas.get(item.id);
                const assigned = columns
                  ? Array.from({ length: rowCount }, (_, rowIndex) => assignLyric(columns, lyricRows[rowIndex] ?? ""))
                  : null;
                const hasSlots = columns ? columns.some((column) => column.syllable) : false;
                const minWidth = melodyLine
                  ? `${(itemCapacity(song, item) * MELODY_BEAT_EM).toFixed(2)}em`
                  : beats
                    ? `${beats * BEAT_WIDTH_EM}em`
                    : undefined;
                const topClasses = [
                  "lead-cell__top",
                  bar ? `has-bar bar--${bar}` : "",
                  item.repeatStart ? "has-repeat-start" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <Fragment key={item.id}>
                    <div
                      className={`lead-cell${item.repeatStart ? " is-repeat-start" : ""}`}
                      style={minWidth ? { minWidth } : undefined}
                    >
                      {volta && (
                        <div className={`lead-cell__volta${volta.first ? " is-first" : ""}`}>
                          {volta.first ? volta.label : ""}
                        </div>
                      )}

                      {showDiagram && <DiagramFigure entry={entry} width={diagramWidth} />}

                      <div className={topClasses}>
                        <div className="lead-cell__chordrow">
                          <strong className="lead-cell__chord">
                            <ChordName symbol={symbol} />
                          </strong>
                        </div>

                        {columns && melody && (
                          <div className="mel-row">
                            {columns.map((column) => (
                              <MelodyColumnView key={column.key} column={column} flags={melody} />
                            ))}
                          </div>
                        )}
                      </div>

                      <span className="lead-cell__lyrics">
                        {Array.from({ length: rowCount }, (_, rowIndex) => {
                          const verseNo = numbered && itemIndex === 0 && (
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
                                    style={{ minWidth: `${column.widthEm}em` }}
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
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
