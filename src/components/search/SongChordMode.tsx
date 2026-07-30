import type { ChangeEvent } from "react";
import { ChordCard } from "../chord/ChordCard";
import { getRelatedChords } from "../../services/relatedChords";

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
        <p>用空格、逗號或換行輸入；主和弦由上而下排列，右側提供可替換的相關和弦。</p>
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
            const related = getRelatedChords(symbol);
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
                      <p className="eyebrow">變化與轉位</p>
                      <h3>{symbol} 的相關和弦</h3>
                    </div>
                    <span>點選即可替換本列</span>
                  </div>
                  {related.length > 0 ? (
                    <div className="related-scroll">
                      {related.map((relatedSymbol) => (
                        <ChordCard
                          key={relatedSymbol}
                          symbol={relatedSymbol}
                          compact
                          onSelect={(newSymbol) => onReplaceChord(index, newSymbol)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="notice">目前沒有已收錄的相關按法。</div>
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
