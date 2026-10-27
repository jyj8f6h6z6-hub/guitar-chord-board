import { useCallback, useEffect, useRef, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import type { Song } from "../../types/song";
import { songMeta } from "../../services/songModel";
import { DIAGRAM_MODE_LABELS, LeadSheet } from "./LeadSheet";
import type { DiagramMode } from "./LeadSheet";


interface PerformViewProps {
  song: Song;
  onExit: () => void;
}

const SCALES = [0.8, 1, 1.25, 1.5, 1.8, 2.2] as const;

type WakeStatus = "unsupported" | "on" | "off";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

export function PerformView({ song, onExit }: PerformViewProps) {
  const [scaleIndex, setScaleIndex] = usePersistentState<number>("guitar-chord-board:perform-scale", 2);
  const [diagramMode, setDiagramMode] = usePersistentState<DiagramMode>("guitar-chord-board:perform-diagram-mode", "first");
  const [markedLineId, setMarkedLineId] = useState<string | null>(null);
  const [wake, setWake] = useState<WakeStatus>("off");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lockRef = useRef<WakeLockSentinelLike | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const safeIndex = Math.min(Math.max(Math.round(scaleIndex), 0), SCALES.length - 1);
  const scale = SCALES[safeIndex];
  const lineIds = song.lines.map((line) => line.id);

  const requestWake = useCallback(async () => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };

    if (!nav.wakeLock) {
      setWake("unsupported");
      return;
    }

    try {
      lockRef.current = await nav.wakeLock.request("screen");
      setWake("on");
    } catch {
      setWake("off");
    }
  }, []);

  useEffect(() => {
    void requestWake();

    const onVisible = () => {
      if (document.visibilityState === "visible") void requestWake();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lockRef.current?.release().catch(() => undefined);
      lockRef.current = null;
    };
  }, [requestWake]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("is-performing");
    return () => document.body.classList.remove("is-performing");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  useEffect(() => {
    if (!markedLineId) return;

    const target = rootRef.current?.querySelector(`[data-line-id="${markedLineId}"]`);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [markedLineId]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void rootRef.current?.requestFullscreen?.().catch(() => undefined);
    }
  }

  function moveMarker(delta: -1 | 1) {
    const current = markedLineId ? lineIds.indexOf(markedLineId) : -1;
    const next = Math.min(Math.max(current + delta, 0), lineIds.length - 1);
    setMarkedLineId(lineIds[next] ?? null);
  }

  function toggleLine(lineId: string) {
    setMarkedLineId((current) => (current === lineId ? null : lineId));
  }

  const wakeLabel = wake === "on" ? "螢幕常亮中" : wake === "unsupported" ? "此瀏覽器不支援螢幕常亮" : "螢幕常亮未啟用";
  const canFullscreen = typeof document.documentElement.requestFullscreen === "function";

  return (
    <div className="perform" ref={rootRef} role="dialog" aria-label="演奏模式" aria-modal="true">
      <div className="perform__bar">
        <button type="button" className="perform__btn perform__btn--exit" onClick={onExit}>
          ✕ 結束
        </button>

        <strong className="perform__title">
          {song.title.trim() || "和弦譜"}
          {songMeta(song) && <span className="perform__key">{songMeta(song)}</span>}
        </strong>

        <div className="perform__tools">
          <button
            type="button"
            className="perform__btn"
            onClick={() => setScaleIndex(Math.max(safeIndex - 1, 0))}
            disabled={safeIndex === 0}
            aria-label="縮小字體"
          >
            A−
          </button>
          <button
            type="button"
            className="perform__btn"
            onClick={() => setScaleIndex(Math.min(safeIndex + 1, SCALES.length - 1))}
            disabled={safeIndex === SCALES.length - 1}
            aria-label="放大字體"
          >
            A+
          </button>
          <button
            type="button"
            className={`perform__btn${diagramMode !== "off" ? " is-active" : ""}`}
            onClick={() => setDiagramMode(diagramMode === "first" ? "legend" : diagramMode === "legend" ? "off" : "first")}
            title="切換：首次出現小圖／上方圖例／不顯示"
          >
            按法：{DIAGRAM_MODE_LABELS[diagramMode]}
          </button>
          {canFullscreen && (
            <button type="button" className="perform__btn" onClick={toggleFullscreen}>
              {isFullscreen ? "退出全螢幕" : "全螢幕"}
            </button>
          )}
        </div>
      </div>

      <div className="perform__body" style={{ fontSize: `${scale}rem` }}>
        <LeadSheet
          song={song}
          diagramMode={diagramMode}
          diagramWidth={Math.round(72 * scale)}
          large
          markedLineId={markedLineId}
          onLineClick={toggleLine}
        />
      </div>

      <div className="perform__footer">
        <span className="perform__hint">點一行標記「唱到這裡」　·　{wakeLabel}</span>
        <div className="perform__tools">
          <button type="button" className="perform__btn" onClick={() => moveMarker(-1)} aria-label="標記上移一行">
            ▲
          </button>
          <button type="button" className="perform__btn" onClick={() => moveMarker(1)} aria-label="標記下移一行">
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}
