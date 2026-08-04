import type { SongChordItem } from "../../types/chord";
import { ChordCard } from "../chord/ChordCard";

interface SongChordOverviewProps {
  items: readonly SongChordItem[];
  selectedShapeIds: Readonly<Record<string, string>>;
}

export function SongChordOverview({
  items,
  selectedShapeIds,
}: SongChordOverviewProps) {
  return (
    <section
      className="workspace workspace--overview"
      aria-labelledby="overview-mode-title"
    >
      <div className="workspace__intro">
        <p className="eyebrow">模式三</p>
        <h2 id="overview-mode-title">歌曲和弦精簡總覽</h2>
      </div>

      <div className="song-overview-summary" aria-live="polite">
        <strong>{items.length} 個和弦</strong>
        <span>內容與模式二的和弦編排區同步。</span>
      </div>

      {items.length > 0 ? (
        <div className="song-overview-grid">
          {items.map((item, index) => (
            <div
              className="song-overview-item"
              key={item.id}
            >
              <span
                className="song-overview-number"
                aria-label={`第 ${index + 1} 個和弦`}
              >
                {index + 1}
              </span>

              <ChordCard
                symbol={item.symbol}
                compact
                eyebrow="歌曲和弦"
                selectedShapeId={
                  selectedShapeIds[item.id]
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="notice">
          模式二目前沒有和弦。請先到「歌曲和弦清單」加入和弦。
        </div>
      )}
    </section>
  );
}
