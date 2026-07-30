import { ChordCard } from "../chord/ChordCard";

interface SongChordOverviewProps {
  symbols: readonly string[];
  selectedShapeIds: Readonly<Record<number, string>>;
}

export function SongChordOverview({ symbols, selectedShapeIds }: SongChordOverviewProps) {
  return (
    <section className="workspace workspace--overview" aria-labelledby="overview-mode-title">
      <div className="workspace__intro">
        <p className="eyebrow">模式三</p>
        <h2 id="overview-mode-title">歌曲和弦精簡總覽</h2>
        <p>
          只顯示模式二每一列最左側的主和弦；右側未選取的相關和弦不會出現在這裡。
        </p>
      </div>

      <div className="song-overview-summary" aria-live="polite">
        <strong>{symbols.length} 個主和弦</strong>
        <span>內容會跟著模式二的輸入、替換與把位選擇同步更新。</span>
      </div>

      {symbols.length > 0 ? (
        <div className="song-overview-grid">
          {symbols.map((symbol, index) => (
            <div className="song-overview-item" key={`${symbol}-${index}`}>
              <span className="song-overview-number" aria-label={`第 ${index + 1} 個和弦`}>
                {index + 1}
              </span>
              <ChordCard
                symbol={symbol}
                compact
                eyebrow="歌曲和弦"
                selectedShapeId={selectedShapeIds[index]}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="notice">
          模式二目前沒有主和弦。請先到「歌曲和弦清單」輸入歌曲和弦。
        </div>
      )}
    </section>
  );
}
