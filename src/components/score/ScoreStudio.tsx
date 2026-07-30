import { useMemo, useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import {
  getTranspositionSemitones,
  keyPrefersFlats,
  KEY_OPTIONS,
  transposeChordSymbol,
} from "../../services/chordTranspose";
import { recognizeScoreChords, uniqueRecognizedSymbols } from "../../services/chordRecognition";
import { downloadAnnotatedPdf, downloadAnnotatedPng } from "../../services/scoreExport";
import { loadScoreFiles } from "../../services/scoreFiles";
import { normalizeChordName } from "../../utils/normalizeChordName";
import type { ScoreChordMark, ScorePage } from "../../types/score";
import { ScoreFileInput } from "./ScoreFileInput";

interface ScoreStudioProps {
  onApplyToSong: (symbols: string[]) => void;
}

function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

export function ScoreStudio({ onApplyToSong }: ScoreStudioProps) {
  const [pages, setPages] = useState<ScorePage[]>([]);
  const [marks, setMarks] = useState<ScoreChordMark[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [sourceKey, setSourceKey] = useState("C");
  const [targetKey, setTargetKey] = useState("C");
  const [manualSymbol, setManualSymbol] = useState("C");
  const [addMode, setAddMode] = useState(false);
  const [status, setStatus] = useState("請先上傳歌譜");
  const [progress, setProgress] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedPage = pages[selectedPageIndex];
  const selectedPageMarks = useMemo(
    () => marks.filter((mark) => mark.pageIndex === selectedPageIndex),
    [marks, selectedPageIndex],
  );
  const recognizedSymbols = useMemo(() => uniqueRecognizedSymbols(marks), [marks]);

  async function handleFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setIsBusy(true);
    setError("");
    setMarks([]);
    setSelectedPageIndex(0);
    setProgress(0);
    setStatus("正在建立可編輯預覽…");

    try {
      const loadedPages = await loadScoreFiles(files);
      setPages(loadedPages);
      setStatus(`已載入 ${loadedPages.length} 頁。可辨識原有和弦，或直接手動加上和弦。`);
    } catch (caughtError) {
      setPages([]);
      setError(caughtError instanceof Error ? caughtError.message : "無法載入歌譜。");
      setStatus("載入失敗");
    } finally {
      setIsBusy(false);
    }
  }

  async function analyzeExistingChords() {
    if (pages.length === 0) {
      return;
    }

    setIsBusy(true);
    setError("");
    setProgress(0);
    setStatus("正在啟動本機 OCR…");

    try {
      const recognizedMarks = await recognizeScoreChords(pages, (nextProgress) => {
        const totalProgress =
          (nextProgress.pageIndex + Math.max(0, Math.min(1, nextProgress.progress))) /
          nextProgress.pageCount;
        setProgress(totalProgress);
        setStatus(
          `第 ${nextProgress.pageIndex + 1}/${nextProgress.pageCount} 頁：${nextProgress.status}`,
        );
      });
      setMarks(recognizedMarks);
      setProgress(1);
      setStatus(
        recognizedMarks.length > 0
          ? `找到 ${recognizedMarks.length} 個和弦標記。請檢查後移調或下載。`
          : "沒有辨識到和弦名稱。可開啟「點圖新增和弦」手動標記。",
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "OCR 辨識失敗。");
      setStatus("辨識失敗");
    } finally {
      setIsBusy(false);
    }
  }

  function transposeMarks() {
    const semitones = getTranspositionSemitones(sourceKey, targetKey);
    const preferFlats = keyPrefersFlats(targetKey);

    setMarks((current) =>
      current.map((mark) => ({
        ...mark,
        symbol: transposeChordSymbol(mark.sourceSymbol, semitones, preferFlats),
      })),
    );
    setStatus(`已將原調 ${sourceKey} 的和弦轉成 ${targetKey}。`);
  }

  function resetTransposition() {
    setMarks((current) => current.map((mark) => ({ ...mark, symbol: mark.sourceSymbol })));
    setTargetKey(sourceKey);
    setStatus("已恢復 OCR 原始和弦。");
  }

  function updateMark(markId: string, symbol: string) {
    setMarks((current) =>
      current.map((mark) => (mark.id === markId ? { ...mark, symbol } : mark)),
    );
  }

  function removeMark(markId: string) {
    setMarks((current) => current.filter((mark) => mark.id !== markId));
  }

  function addManualMark(event: MouseEvent<HTMLDivElement>) {
    if (!addMode || !selectedPage) {
      return;
    }

    const normalizedSymbol = normalizeChordName(manualSymbol);
    if (!normalizedSymbol) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * selectedPage.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * selectedPage.height;
    const height = Math.max(26, selectedPage.height * 0.025);
    const width = Math.max(70, normalizedSymbol.length * height * 0.72);

    setMarks((current) => [
      ...current,
      {
        id: createId("manual-chord"),
        pageIndex: selectedPageIndex,
        sourceText: normalizedSymbol,
        sourceSymbol: normalizedSymbol,
        symbol: normalizedSymbol,
        confidence: 100,
        bbox: {
          x: Math.max(0, x - width / 2),
          y: Math.max(0, y - height / 2),
          width,
          height,
        },
        manual: true,
      },
    ]);
  }

  async function downloadCurrentPage() {
    if (!selectedPage) {
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      await downloadAnnotatedPng(selectedPage, selectedPageMarks);
      setStatus(`已下載第 ${selectedPage.pageNumber} 頁 PNG。`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "下載 PNG 失敗。");
    } finally {
      setIsBusy(false);
    }
  }

  async function downloadAllPages() {
    if (pages.length === 0) {
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      await downloadAnnotatedPdf(pages, marks, pages[0].name);
      setStatus("已下載加上和弦的 PDF。");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "下載 PDF 失敗。");
    } finally {
      setIsBusy(false);
    }
  }

  function applyToSongMode() {
    const symbols = uniqueRecognizedSymbols(marks);
    if (symbols.length > 0) {
      onApplyToSong(symbols);
    }
  }

  return (
    <section className="workspace score-studio" aria-labelledby="score-studio-title">
      <div className="workspace__intro">
        <p className="eyebrow">模式四 · 智慧歌譜</p>
        <h2 id="score-studio-title">辨識、移調、覆蓋和弦並下載</h2>
        <p>
          第一期已完成圖片／PDF 上傳、既有和弦 OCR、整體移調、原位覆蓋、手動增修，以及 PNG／PDF 下載。
        </p>
      </div>

      <div className="score-studio__notice">
        <strong>關於沒有和弦名稱的五線譜、簡譜或六線譜：</strong>
        自動讀取音符並推演每小節和弦屬於 OMR 與和聲分析，後續需要獨立模型服務。現在可以先選調性，使用「點圖新增和弦」完成手動標記與下載。
      </div>

      <ScoreFileInput id="score-studio-files" disabled={isBusy} onFilesSelected={handleFiles} />

      {pages.length > 0 && (
        <>
          <div className="score-toolbar">
            <button type="button" className="primary-button" onClick={analyzeExistingChords} disabled={isBusy}>
              {isBusy ? "處理中…" : "辨識圖片上的原有和弦"}
            </button>
            <div className="score-transpose-controls">
              <label>
                <span>原調</span>
                <select value={sourceKey} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSourceKey(event.target.value)}>
                  {KEY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <span aria-hidden="true">→</span>
              <label>
                <span>新調</span>
                <select value={targetKey} onChange={(event: ChangeEvent<HTMLSelectElement>) => setTargetKey(event.target.value)}>
                  {KEY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="secondary-button" onClick={transposeMarks} disabled={marks.length === 0}>
                套用移調
              </button>
              <button type="button" className="text-button" onClick={resetTransposition} disabled={marks.length === 0}>
                恢復原調
              </button>
            </div>
          </div>

          <div className="score-manual-toolbar">
            <label htmlFor="manual-score-chord">手動新增的和弦</label>
            <input
              id="manual-score-chord"
              value={manualSymbol}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setManualSymbol(event.target.value)}
              placeholder="Cmaj7"
            />
            <button
              type="button"
              className={addMode ? "secondary-button is-active" : "secondary-button"}
              onClick={() => setAddMode((current) => !current)}
              aria-pressed={addMode}
            >
              {addMode ? "點圖新增：開啟" : "點圖新增和弦"}
            </button>
            <span>{addMode ? "請直接點歌譜上要放和弦的位置" : "可用於原圖沒有和弦文字的歌譜"}</span>
          </div>

          <div className="score-page-tabs" aria-label="選擇歌譜頁面">
            {pages.map((page, index) => (
              <button
                type="button"
                key={page.id}
                className={index === selectedPageIndex ? "is-active" : ""}
                onClick={() => setSelectedPageIndex(index)}
              >
                第 {page.pageNumber} 頁
              </button>
            ))}
          </div>

          {selectedPage && (
            <div
              className={`score-page-stage${addMode ? " is-adding" : ""}`}
              onClick={addManualMark}
              role={addMode ? "button" : undefined}
              tabIndex={addMode ? 0 : undefined}
              aria-label={addMode ? "點選歌譜位置新增和弦" : undefined}
            >
              <img src={selectedPage.dataUrl} alt={`歌譜第 ${selectedPage.pageNumber} 頁`} />
              {selectedPageMarks.map((mark) => (
                <span
                  className={`score-chord-overlay${mark.manual ? " is-manual" : ""}`}
                  key={mark.id}
                  style={{
                    left: `${(mark.bbox.x / selectedPage.width) * 100}%`,
                    top: `${(mark.bbox.y / selectedPage.height) * 100}%`,
                    minWidth: `${(mark.bbox.width / selectedPage.width) * 100}%`,
                    minHeight: `${(mark.bbox.height / selectedPage.height) * 100}%`,
                  }}
                  onClick={(event: MouseEvent<HTMLSpanElement>) => event.stopPropagation()}
                >
                  {mark.symbol}
                </span>
              ))}
            </div>
          )}

          <div className="score-status-row">
            <span>{status}</span>
            {(isBusy || progress > 0) && <progress max={1} value={progress} aria-label="處理進度" />}
          </div>

          {error && <div className="notice notice--error">{error}</div>}

          <div className="score-mark-editor">
            <div className="score-mark-editor__heading">
              <div>
                <p className="eyebrow">第 {selectedPageIndex + 1} 頁</p>
                <h3>和弦位置與文字修正</h3>
              </div>
              <span>{selectedPageMarks.length} 個標記</span>
            </div>

            {selectedPageMarks.length > 0 ? (
              <div className="score-mark-list">
                {selectedPageMarks.map((mark, index) => (
                  <div className="score-mark-row" key={mark.id}>
                    <span>{index + 1}</span>
                    <label>
                      <span className="sr-only">和弦名稱</span>
                      <input
                        value={mark.symbol}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateMark(mark.id, event.target.value)
                        }
                      />
                    </label>
                    <small>
                      {mark.manual ? "手動" : `OCR ${Math.round(mark.confidence)}% · 原文 ${mark.sourceText}`}
                    </small>
                    <button type="button" className="text-button text-button--danger" onClick={() => removeMark(mark.id)}>
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="notice">這一頁目前沒有和弦標記。</div>
            )}
          </div>

          <div className="score-download-panel">
            <div>
              <strong>{recognizedSymbols.length} 種和弦</strong>
              <span>{recognizedSymbols.join(" · ") || "尚未建立和弦"}</span>
            </div>
            <div className="score-action-row score-action-row--buttons">
              <button type="button" className="secondary-button" onClick={applyToSongMode} disabled={recognizedSymbols.length === 0}>
                放入模式二
              </button>
              <button type="button" className="secondary-button" onClick={downloadCurrentPage} disabled={isBusy || !selectedPage}>
                下載本頁 PNG
              </button>
              <button type="button" className="primary-button" onClick={downloadAllPages} disabled={isBusy}>
                下載全部 PDF
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
