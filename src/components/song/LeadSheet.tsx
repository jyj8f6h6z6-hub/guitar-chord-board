import { Fragment, useMemo } from "react";
import { findChordShapes } from "../../data/chordShapes";
import { effectiveBarIds, effectiveSections, itemBeats } from "../../services/songModel";
import type { Song, SongItem } from "../../types/song";
import { ChordDiagram } from "../chord/ChordDiagram";
import { ChordName } from "../chord/ChordName";

export type DiagramMode = "legend" | "first" | "off";

export const DIAGRAM_MODE_LABELS: Record<DiagramMode, string> = {
  legend: "上方圖例",
  first: "首次出現小圖",
  off: "不顯示",
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

/** 簡譜風格譜面：每個和弦上面是名稱，下面是要唱的歌詞；欄寬依拍數決定。 */
export function LeadSheet({
  song,
  symbols,
  diagramMode,
  diagramWidth = 72,
  large = false,
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
                const showDiagram = diagramMode === "first" && firstIds.has(item.id);
                const entry: DiagramEntry = {
                  key: item.id,
                  symbol,
                  shapeId: override !== undefined && override !== item.symbol ? undefined : item.shapeId,
                };

                return (
                  <Fragment key={item.id}>
                    <div
                      className="lead-cell"
                      style={beats ? { minWidth: `${beats * BEAT_WIDTH_EM}em` } : undefined}
                    >
                      {showDiagram && <DiagramFigure entry={entry} width={diagramWidth} />}

                      <div className={`lead-cell__chordrow${bars.has(item.id) ? " has-bar" : ""}`}>
                        <strong className="lead-cell__chord">
                          <ChordName symbol={symbol} />
                        </strong>
                      </div>

                      <span className="lead-cell__lyrics">
                        {Array.from({ length: rowCount }, (_, rowIndex) => (
                          <span className="lead-cell__lyric" key={rowIndex}>
                            {numbered && itemIndex === 0 && (
                              <span className="verse-no">{VERSE_NUMBERS[rowIndex] ?? rowIndex + 1}、</span>
                            )}
                            {lyricRows[rowIndex] || " "}
                          </span>
                        ))}
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
