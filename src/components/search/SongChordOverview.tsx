import { useMemo, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import {
  KEY_OPTIONS,
  getTranspositionSemitones,
  keyPrefersFlats,
  transposeChordSymbol,
} from "../../services/chordTranspose";
import { allItems, countItems, effectiveSections, songMeta } from "../../services/songModel";
import type { Song } from "../../types/song";
import { ChordCard } from "../chord/ChordCard";
import { DIAGRAM_MODE_LABELS, LeadSheet } from "../song/LeadSheet";
import type { DiagramMode } from "../song/LeadSheet";

type OverviewLayout = "lead" | "cards" | "unique";

const LAYOUT_LABELS: Record<OverviewLayout, string> = {
  lead: "簡譜風格",
  cards: "和弦圖卡片",
  unique: "不重複和弦",
};

function keyDisplay(key: string): string {
  return KEY_OPTIONS.find((option) => option.value === key)?.label ?? key;
}

interface SongChordOverviewProps {
  song: Song;
  onApplyTransposition: (symbols: readonly string[], newKey: string) => void;
  onKeyChange: (key: string) => void;
  onPerform: () => void;
}

export function SongChordOverview({ song, onApplyTransposition, onKeyChange, onPerform }: SongChordOverviewProps) {
  const sourceKey = song.key ?? "C";
  const setSourceKey = onKeyChange;
  const [targetKey, setTargetKey] = useState("D");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [layout, setLayout] = usePersistentState<OverviewLayout>("guitar-chord-board:overview-layout", "lead");
  const [diagramMode, setDiagramMode] = usePersistentState<DiagramMode>("guitar-chord-board:diagram-mode", "legend");

  const items = useMemo(() => allItems(song), [song]);
  const printMeta = songMeta(isPreviewing ? { ...song, key: targetKey } : song);
  const total = countItems(song);
  const sections = effectiveSections(song);

  const transposedSymbols = useMemo(() => {
    const semitones = getTranspositionSemitones(sourceKey, targetKey);
    const preferFlats = keyPrefersFlats(targetKey);
    return items.map((item) => transposeChordSymbol(item.symbol, semitones, preferFlats));
  }, [items, sourceKey, targetKey]);

  const symbolById = useMemo(() => {
    if (!isPreviewing) return undefined;
    return Object.fromEntries(items.map((item, index) => [item.id, transposedSymbols[index]]));
  }, [isPreviewing, items, transposedSymbols]);

  const displayed = (itemId: string, fallback: string) => symbolById?.[itemId] ?? fallback;

  const uniqueEntries = useMemo(() => {
    const seen = new Map<string, { symbol: string; shapeId?: string; count: number }>();

    for (const item of items) {
      const symbol = displayed(item.id, item.symbol);
      const existing = seen.get(symbol);

      if (existing) {
        existing.count += 1;
      } else {
        seen.set(symbol, { symbol, shapeId: isPreviewing ? undefined : item.shapeId, count: 1 });
      }
    }

    return [...seen.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, symbolById, isPreviewing]);

  function applyTransposition() {
    if (!isPreviewing || sourceKey === targetKey) return;

    onApplyTransposition(transposedSymbols, targetKey);
    setIsPreviewing(false);
  }

  function restoreOriginalKey() {
    setTargetKey(sourceKey);
    setIsPreviewing(false);
  }

  return (
    <section className="workspace workspace--overview" aria-labelledby="overview-mode-title">
      <div className="workspace__intro">
        <p className="eyebrow">和弦編排・第二步</p>
        <h2 id="overview-mode-title">總覽與移調</h2>
      </div>

      <div className="print-only print-header">
        <h1>{song.title.trim() || "和弦譜"}</h1>
        {printMeta && (
          <p>
            {printMeta}
            {isPreviewing && sourceKey !== targetKey ? `（原調 ${keyDisplay(sourceKey)}）` : ""}
          </p>
        )}
      </div>

      <div className="overview-toolbar">
        <div className="segmented-control" role="group" aria-label="總覽排版">
          {(Object.keys(LAYOUT_LABELS) as OverviewLayout[]).map((key) => (
            <button
              key={key}
              type="button"
              className={layout === key ? "is-active" : ""}
              aria-pressed={layout === key}
              onClick={() => setLayout(key)}
            >
              {LAYOUT_LABELS[key]}
            </button>
          ))}
        </div>

        {layout === "lead" && (
          <div className="segmented-control" role="group" aria-label="和弦按法圖">
            {(Object.keys(DIAGRAM_MODE_LABELS) as DiagramMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={diagramMode === mode ? "is-active" : ""}
                aria-pressed={diagramMode === mode}
                onClick={() => setDiagramMode(mode)}
                title={mode === "off" ? "熟悉之後可以關掉按法圖" : undefined}
              >
                {DIAGRAM_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        )}

        <div className="overview-toolbar__actions">
          <button type="button" className="ghost-button" onClick={onPerform} disabled={total === 0}>
            進入演奏模式
          </button>
          <button type="button" className="ghost-button" onClick={() => window.print()} disabled={total === 0}>
            列印／存成 PDF
          </button>
        </div>
      </div>

      <section className="overview-transpose-panel" aria-labelledby="overview-transpose-title">
        <div className="overview-transpose-panel__heading">
          <div>
            <p className="eyebrow">移調</p>
            <h3 id="overview-transpose-title">調整歌曲調性</h3>
          </div>

          {isPreviewing && sourceKey !== targetKey && (
            <span className="overview-transpose-status">
              預覽中：{sourceKey} → {targetKey}
            </span>
          )}
        </div>

        <div className="overview-transpose-controls">
          <label className="overview-key-field" htmlFor="overview-source-key">
            <span className="overview-key-field__label">
              <span aria-hidden="true">♫</span>
              原調
            </span>
            <select
              id="overview-source-key"
              value={sourceKey}
              onChange={(event) => {
                setSourceKey(event.target.value);
                setIsPreviewing(false);
              }}
            >
              {KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <span className="overview-transpose-arrow" aria-hidden="true">
            →
          </span>

          <label className="overview-key-field" htmlFor="overview-target-key">
            <span className="overview-key-field__label">
              <span aria-hidden="true">⇄</span>
              目標調
            </span>
            <select
              id="overview-target-key"
              value={targetKey}
              onChange={(event) => {
                setTargetKey(event.target.value);
                setIsPreviewing(false);
              }}
            >
              {KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overview-transpose-actions">
          <button type="button" className="primary-button" onClick={() => setIsPreviewing(true)} disabled={total === 0}>
            預覽移調
          </button>
          <button
            type="button"
            className="secondary-button transpose-apply-button"
            onClick={applyTransposition}
            disabled={total === 0 || !isPreviewing || sourceKey === targetKey}
          >
            套用到和弦編排區
          </button>
          <button
            type="button"
            className="secondary-button transpose-reset-button"
            onClick={restoreOriginalKey}
            disabled={!isPreviewing && sourceKey === targetKey}
          >
            恢復原調
          </button>
        </div>
      </section>

      <div className="song-overview-summary" aria-live="polite">
        <strong>
          {song.lines.length} 行・{total} 個和弦
        </strong>
        <span>
          {isPreviewing ? "目前顯示移調預覽，尚未修改第一步的和弦編排。" : "內容與第一步建立的和弦編排同步。"}
        </span>
      </div>

      {total === 0 ? (
        <div className="notice">尚未建立和弦編排。請先前往「① 建立和弦編排」加入並排列歌曲和弦。</div>
      ) : layout === "lead" ? (
        <LeadSheet song={song} symbols={symbolById} diagramMode={diagramMode} />
      ) : layout === "cards" ? (
        <div className="cards-by-line">
          {song.lines.map((line, lineIndex) => {
            const section = sections[lineIndex];

            return (
              <div key={line.id} className={`cards-line${section.kind === "chorus" ? " is-chorus" : ""}`}>
                {section.badge && (
                  <span className={`section-badge${section.kind === "chorus" ? " section-badge--chorus" : ""}`}>
                    {section.badge}
                  </span>
                )}

                <div className="song-overview-grid">
                  {line.items.map((item) => (
                    <div className="song-overview-item" key={item.id}>
                      <ChordCard
                        symbol={displayed(item.id, item.symbol)}
                        compact
                        eyebrow={isPreviewing ? "移調預覽" : "歌曲和弦"}
                        selectedShapeId={isPreviewing ? undefined : item.shapeId}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="song-overview-grid">
          {uniqueEntries.map((entry) => (
            <div className="song-overview-item" key={entry.symbol}>
              <ChordCard
                symbol={entry.symbol}
                compact
                eyebrow={`出現 ${entry.count} 次`}
                selectedShapeId={entry.shapeId}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
