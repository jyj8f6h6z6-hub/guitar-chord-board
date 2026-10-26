import { Fragment } from "react";
import { findChordShapes } from "../../data/chordShapes";
import { effectiveSections } from "../../services/songModel";
import type { Song, SongItem } from "../../types/song";
import { ChordDiagram } from "../chord/ChordDiagram";

interface LeadSheetProps {
  song: Song;
  /** 移調預覽：itemId → 顯示用和弦名稱 */
  symbols?: Readonly<Record<string, string>>;
  showDiagrams: boolean;
  /** 和弦圖寬度（像素） */
  diagramWidth?: number;
  /** 演奏模式：放大字體 */
  large?: boolean;
  markedLineId?: string | null;
  onLineClick?: (lineId: string) => void;
}

function ChordMini({
  item,
  symbol,
  isOverridden,
  width,
}: {
  item: SongItem;
  symbol: string;
  isOverridden: boolean;
  width: number;
}) {
  const shapes = findChordShapes(symbol);
  const shape = (!isOverridden && shapes.find((candidate) => candidate.id === item.shapeId)) || shapes[0];

  if (!shape) {
    return <div className="lead-cell__diagram lead-cell__diagram--none">—</div>;
  }

  return (
    <div className="lead-cell__diagram">
      <ChordDiagram shape={shape} compact displaySymbol={symbol} width={width} />
    </div>
  );
}

/** 簡譜風格譜面：每個和弦上面是名稱（與可隱藏的按法圖），下面是要唱的歌詞。 */
export function LeadSheet({
  song,
  symbols,
  showDiagrams,
  diagramWidth = 72,
  large = false,
  markedLineId = null,
  onLineClick,
}: LeadSheetProps) {
  const sections = effectiveSections(song);

  return (
    <div className={`lead-sheet${large ? " lead-sheet--large" : ""}`}>
      {song.lines.map((line, lineIndex) => {
        const section = sections[lineIndex];
        const isChorus = section.kind === "chorus";
        const isMarked = markedLineId === line.id;
        const classes = [
          "lead-line",
          isChorus ? "is-chorus" : "",
          section.badge ? "has-badge" : "",
          isMarked ? "is-marked" : "",
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
                <span className={`section-badge${isChorus ? " section-badge--chorus" : ""}`}>
                  {section.badge}
                </span>
              )}
            </div>

            <div className="lead-line__cells">
              {line.items.length === 0 && <span className="lead-line__empty">（空白行）</span>}

              {line.items.map((item) => {
                const override = symbols?.[item.id];
                const symbol = override ?? item.symbol;

                return (
                  <Fragment key={item.id}>
                    <div className="lead-cell">
                      {showDiagrams && (
                        <ChordMini
                          item={item}
                          symbol={symbol}
                          isOverridden={override !== undefined && override !== item.symbol}
                          width={diagramWidth}
                        />
                      )}
                      <strong className="lead-cell__chord">{symbol}</strong>
                      <span className="lead-cell__lyrics">
                        {(item.lyric || " ").split("\n").map((row, rowIndex) => (
                          <span className="lead-cell__lyric" key={rowIndex}>
                            {row || " "}
                          </span>
                        ))}
                      </span>
                    </div>
                    {item.bar && <span className="lead-bar" aria-hidden="true" />}
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
