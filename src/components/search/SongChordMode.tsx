import type { ChangeEvent } from "react";
import { ChordCard } from "../chord/ChordCard";
import { CHORD_TYPE_OPTIONS } from "../../data/chordTypes";

interface SongChordModeProps {
  input: string;
  onInputChange: (value: string) => void;
  removeDuplicates: boolean;
  onRemoveDuplicatesChange: (value: boolean) => void;
  symbols: readonly string[];
  selectedShapeIds: Readonly<Record<number, string>>;
  onShapeChange: (index: number, shapeId: string) => void;
  onReplaceChord: (index: number, newSymbol: string) => void;
}

const CHORD_ROOT_PATTERN = /^([A-G])([#b]?)/;

function getChordRoot(symbol: string): string | null {
  const match = symbol.match(CHORD_ROOT_PATTERN);
  return match ? `${match[1]}${match[2]}` : null;
}

export function SongChordMode({
  input,
  onInputChange,
  removeDuplicates,
  onRemoveDuplicatesChange,
  symbols,
  selectedShapeIds,
  onShapeChange,
  onReplaceChord,
}: SongChordModeProps) {
  return (
    <section className="workspace" aria-labelledby="song-mode-title">
      <div className="workspace__intro">
        <p className="eyebrow">模式二</p>
        <h2 id="song-mode-title">一次整理整首歌的和弦</h2>
        <p>
          用空格、逗號或換行輸入；每一列右側會列出與模式一相同的 12 種和弦類型，點選後立即替換左側主和弦。
        </p>
      </div>

      <div className="search-panel">
        <label htmlFor="song-chords">歌曲和弦</label>
        <textarea
          id="song-chords"
          value={input}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onInputChange(event.target.value)}
          rows={4}
          placeholder="C G Am F"
        />
        <div className="song-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={removeDuplicates}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onRemoveDuplicatesChange(event.target.checked)
              }
            />
            移除重複和弦
          </label>
          <span>{symbols.length} 個和弦</span>
        </div>
      </div>

      {symbols.length > 0 ? (
        <div className="song-list">
          {symbols.map((symbol, index) => {
            const root = getChordRoot(symbol);

            return (
              <article className="song-row" key={`${symbol}-${index}`}>
                <div className="song-row__main">
                  <span className="song-row__number">{index + 1}</span>
                  <ChordCard
                    symbol={symbol}
                    selectedShapeId={selectedShapeIds[index]}
                    onShapeChange={(shapeId) => onShapeChange(index, shapeId)}
                  />
                </div>

                <div className="song-row__related">
                  <div className="related-heading">
                    <div>
                      <p className="eyebrow">12 種和弦類型</p>
                      <h3>{root ? `${root} 的全部和弦類型` : `${symbol} 的和弦類型`}</h3>
                    </div>
                    <span>點選後立即替換左側主和弦</span>
                  </div>

                  {root ? (
                    <div className="chord-type-grid">
                      {CHORD_TYPE_OPTIONS.map((option) => {
                        const candidateSymbol = `${root}${option.suffix}`;
                        const isCurrent = candidateSymbol === symbol;

                        return (
                          <div
                            className={`chord-type-option${isCurrent ? " is-current" : ""}`}
                            key={option.suffix || "major"}
                          >
                            <ChordCard
                              symbol={candidateSymbol}
                              compact
                              eyebrow={option.label}
                              onSelect={(newSymbol) => onReplaceChord(index, newSymbol)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="notice">無法判斷這個和弦的根音，因此暫時不能建立類型選單。</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="notice">請先輸入至少一個和弦。</div>
      )}
    </section>
  );
}
