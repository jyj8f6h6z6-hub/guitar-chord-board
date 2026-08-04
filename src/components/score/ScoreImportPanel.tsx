import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { parseChordInput } from "../../services/chordParser";
import {
  recognizeScoreChords,
  uniqueRecognizedSymbols,
} from "../../services/chordRecognition";
import { loadScoreFiles } from "../../services/scoreFiles";
import type {
  ScoreChordMark,
  ScorePage,
} from "../../types/score";
import { ScoreFileInput } from "./ScoreFileInput";

interface ScoreImportPanelProps {
  currentSymbols: readonly string[];
  onReplaceRecognized: (symbols: string[]) => void;
  onAppendRecognized: (symbols: string[]) => void;
}

export function ScoreImportPanel({
  currentSymbols,
  onReplaceRecognized,
  onAppendRecognized,
}: ScoreImportPanelProps) {
  const [pages, setPages] = useState<ScorePage[]>([]);
  const [marks, setMarks] = useState<ScoreChordMark[]>([]);
  const [recognizedInput, setRecognizedInput] = useState("");
  const [status, setStatus] = useState("尚未選擇歌譜");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const previewPages = useMemo(
    () => pages.slice(0, 4),
    [pages],
  );

  async function handleFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setIsLoading(true);
    setError("");
    setMarks([]);
    setRecognizedInput("");
    setProgress(0);
    setStatus("正在建立歌譜預覽…");

    try {
      const loadedPages = await loadScoreFiles(files);
      setPages(loadedPages);
      setStatus(
        `已載入 ${loadedPages.length} 頁，請按「開始辨識和弦」`,
      );
    } catch (caughtError) {
      setPages([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "無法載入歌譜。",
      );
      setStatus("載入失敗");
    } finally {
      setIsLoading(false);
    }
  }

  async function analyzeScore() {
    if (pages.length === 0) {
      return;
    }

    setIsLoading(true);
    setError("");
    setProgress(0);
    setStatus("正在啟動本機 OCR…");

    try {
      const recognizedMarks = await recognizeScoreChords(
        pages,
        (nextProgress) => {
          const completedPages = nextProgress.pageIndex;
          const totalProgress =
            (completedPages +
              Math.max(
                0,
                Math.min(1, nextProgress.progress),
              )) /
            nextProgress.pageCount;

          setProgress(totalProgress);
          setStatus(
            `第 ${nextProgress.pageIndex + 1}/${nextProgress.pageCount} 頁：${nextProgress.status}`,
          );
        },
      );

      const symbols =
        uniqueRecognizedSymbols(recognizedMarks);

      setMarks(recognizedMarks);
      setRecognizedInput(symbols.join(" "));
      setProgress(1);
      setStatus(
        symbols.length > 0
          ? `完成：找到 ${recognizedMarks.length} 個標記、${symbols.length} 種和弦`
          : "辨識完成，但沒有找到可信的和弦名稱。",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "OCR 辨識失敗。",
      );
      setStatus("辨識失敗");
    } finally {
      setIsLoading(false);
    }
  }

  function getRecognizedSymbols() {
    return parseChordInput(recognizedInput);
  }

  function replaceRecognized() {
    const symbols = getRecognizedSymbols();

    if (symbols.length === 0) {
      return;
    }

    onReplaceRecognized(symbols);
  }

  function appendRecognized() {
    const symbols = getRecognizedSymbols();

    if (symbols.length === 0) {
      return;
    }

    onAppendRecognized(symbols);
  }

  return (
    <section
      className="score-import-panel"
      aria-labelledby="score-import-title"
    >
      <div className="score-import-panel__heading">
        <p
          className="eyebrow"
          id="score-import-title"
        >
          拍照視譜（開發中）
        </p>
      </div>

      <ScoreFileInput
        id="song-score-files"
        disabled={isLoading}
        onFilesSelected={handleFiles}
      />

      {pages.length > 0 && (
        <>
          <div
            className="score-thumbnail-grid"
            aria-label="已載入的歌譜頁面"
          >
            {previewPages.map((page) => (
              <figure key={page.id}>
                <img
                  src={page.dataUrl}
                  alt={`歌譜第 ${page.pageNumber} 頁`}
                />
                <figcaption>
                  第 {page.pageNumber} 頁
                </figcaption>
              </figure>
            ))}

            {pages.length > previewPages.length && (
              <div className="score-thumbnail-more">
                另有{" "}
                {pages.length - previewPages.length} 頁
              </div>
            )}
          </div>

          <div className="score-action-row">
            <button
              className="primary-button"
              type="button"
              onClick={analyzeScore}
              disabled={isLoading}
            >
              {isLoading
                ? "處理中…"
                : "開始辨識和弦"}
            </button>

            <span>{status}</span>
          </div>

          {(isLoading || progress > 0) && (
            <progress
              className="score-progress"
              max={1}
              value={progress}
              aria-label="辨識進度"
            />
          )}
        </>
      )}

      {error && (
        <div className="notice notice--error">
          {error}
        </div>
      )}

      {(marks.length > 0 || recognizedInput) && (
        <div className="score-recognition-result">
          <label htmlFor="recognized-song-chords">
            辨識結果（可先手動修正）
          </label>

          <textarea
            id="recognized-song-chords"
            rows={3}
            value={recognizedInput}
            onChange={(
              event: ChangeEvent<HTMLTextAreaElement>,
            ) =>
              setRecognizedInput(event.target.value)
            }
            placeholder="C G Am F"
          />

          <div className="score-action-row score-action-row--buttons">
            <button
              type="button"
              className="primary-button"
              onClick={replaceRecognized}
            >
              取代和弦編排區
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={appendRecognized}
            >
              加到編排區最後面
            </button>
          </div>

          <span className="score-current-count">
            目前編排區有 {currentSymbols.length} 個和弦
          </span>
        </div>
      )}
    </section>
  );
}
