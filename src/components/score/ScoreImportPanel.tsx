import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { parseChordInput } from "../../services/chordParser";
import {
  recognizeScoreChords,
  uniqueRecognizedSymbols,
} from "../../services/chordRecognition";
import { loadScoreFiles } from "../../services/scoreFiles";
import type { ScoreChordMark, ScorePage } from "../../types/score";
import { ScoreFileInput } from "./ScoreFileInput";

interface ScoreImportPanelProps {
  currentInput: string;
  onInputChange: (value: string) => void;
}

export function ScoreImportPanel({ currentInput, onInputChange }: ScoreImportPanelProps) {
  const [pages, setPages] = useState<ScorePage[]>([]);
  const [marks, setMarks] = useState<ScoreChordMark[]>([]);
  const [recognizedInput, setRecognizedInput] = useState("");
  const [status, setStatus] = useState("尚未選擇歌譜");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const previewPages = useMemo(() => pages.slice(0, 4), [pages]);

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
      setStatus(`已載入 ${loadedPages.length} 頁，請按「開始辨識和弦」`);
    } catch (caughtError) {
      setPages([]);
      setError(caughtError instanceof Error ? caughtError.message : "無法載入歌譜。");
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
      const recognizedMarks = await recognizeScoreChords(pages, (nextProgress) => {
        const completedPages = nextProgress.pageIndex;
        const totalProgress =
          (completedPages + Math.max(0, Math.min(1, nextProgress.progress))) /
          nextProgress.pageCount;
        setProgress(totalProgress);
        setStatus(
          `第 ${nextProgress.pageIndex + 1}/${nextProgress.pageCount} 頁：${nextProgress.status}`,
        );
      });
      const symbols = uniqueRecognizedSymbols(recognizedMarks);
      setMarks(recognizedMarks);
      setRecognizedInput(symbols.join(" "));
      setProgress(1);
      setStatus(
        symbols.length > 0
          ? `完成：找到 ${recognizedMarks.length} 個標記、${symbols.length} 種和弦`
          : "辨識完成，但沒有找到可信的和弦名稱。",
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "OCR 辨識失敗。");
      setStatus("辨識失敗");
    } finally {
      setIsLoading(false);
    }
  }

  function applyRecognized(replaceExisting: boolean) {
    const recognizedSymbols = parseChordInput(recognizedInput);
    if (recognizedSymbols.length === 0) {
      return;
    }

    if (replaceExisting || !currentInput.trim()) {
      onInputChange(recognizedSymbols.join(" "));
      return;
    }

    onInputChange(`${currentInput.trim()} ${recognizedSymbols.join(" ")}`.trim());
  }

  return (
    <section className="score-import-panel" aria-labelledby="score-import-title">
      <div className="score-import-panel__heading">
        <div>
          <p className="eyebrow">拍照視譜 · 第一期</p>
          <h3 id="score-import-title">從歌譜辨識已印出的和弦</h3>
        </div>
        <span className="score-local-badge">在瀏覽器內處理</span>
      </div>

      <p className="score-help-text">
        上傳照片、掃描圖或 PDF。系統會先辨識譜面上已經印出的 C、Am、G7、Fmaj7 等和弦名稱，確認後可直接放入下方歌曲和弦欄位。
      </p>

      <ScoreFileInput id="song-score-files" disabled={isLoading} onFilesSelected={handleFiles} />

      {pages.length > 0 && (
        <>
          <div className="score-thumbnail-grid" aria-label="已載入的歌譜頁面">
            {previewPages.map((page) => (
              <figure key={page.id}>
                <img src={page.dataUrl} alt={`歌譜第 ${page.pageNumber} 頁`} />
                <figcaption>第 {page.pageNumber} 頁</figcaption>
              </figure>
            ))}
            {pages.length > previewPages.length && (
              <div className="score-thumbnail-more">另有 {pages.length - previewPages.length} 頁</div>
            )}
          </div>

          <div className="score-action-row">
            <button className="primary-button" type="button" onClick={analyzeScore} disabled={isLoading}>
              {isLoading ? "處理中…" : "開始辨識和弦"}
            </button>
            <span>{status}</span>
          </div>

          {(isLoading || progress > 0) && (
            <progress className="score-progress" max={1} value={progress} aria-label="辨識進度" />
          )}
        </>
      )}

      {error && <div className="notice notice--error">{error}</div>}

      {(marks.length > 0 || recognizedInput) && (
        <div className="score-recognition-result">
          <label htmlFor="recognized-song-chords">辨識結果（可先手動修正）</label>
          <textarea
            id="recognized-song-chords"
            rows={3}
            value={recognizedInput}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setRecognizedInput(event.target.value)
            }
            placeholder="C G Am F"
          />
          <div className="score-action-row score-action-row--buttons">
            <button type="button" className="primary-button" onClick={() => applyRecognized(true)}>
              取代歌曲和弦清單
            </button>
            <button type="button" className="secondary-button" onClick={() => applyRecognized(false)}>
              加到目前清單後面
            </button>
          </div>
        </div>
      )}

      <div className="score-phase-note">
        <strong>目前範圍：</strong>
        這一期先完成檔案上傳、PDF 轉頁、文字和弦辨識與匯入。只有旋律、完全沒有和弦文字的歌譜，需要模式四後續的 OMR 音符辨識與和聲推演服務。
      </div>
    </section>
  );
}
