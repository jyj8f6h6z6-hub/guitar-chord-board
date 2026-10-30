import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_MELODY_LINE_LENGTH, layoutLineMelody, parseMelody, splitLyricChars, countSyllables } from "../../services/melody";
import { itemCapacity, lineMelodyStatus, lineMelodyText, setLineMelody } from "../../services/songModel";
import type { Song, SongLine } from "../../types/song";
import { LeadSheet } from "./LeadSheet";

interface MelodyEditorProps {
  song: Song;
  line: SongLine;
  onChange: (change: (song: Song) => Song, coalesceKey?: string) => void;
}

interface KeyDef {
  label: string;
  insert: string;
  title: string;
  /** note：開始一個新音符，需要與前一個音符分開；mark：附加在前一個音符後面 */
  kind: "note" | "mark";
}

const NOTE_KEYS: readonly KeyDef[] = [
  ...["1", "2", "3", "4", "5", "6", "7"].map((digit): KeyDef => ({ label: digit, insert: digit, title: `音符 ${digit}`, kind: "note" })),
  { label: "0", insert: "0", title: "休止符", kind: "note" },
  { label: "－", insert: "-", title: "延長一拍", kind: "note" },
];

const MARK_KEYS: readonly KeyDef[] = [
  { label: "高八度 ·", insert: "'", title: "加在音符後面：高八度（上面一點）", kind: "mark" },
  { label: "低八度 ·", insert: ",", title: "加在音符後面：低八度（下面一點）", kind: "mark" },
  { label: "♯", insert: "#", title: "先按升記號，再按數字", kind: "note" },
  { label: "♭", insert: "b", title: "先按降記號，再按數字", kind: "note" },
  { label: "♮", insert: "n", title: "先按還原記號，再按數字", kind: "note" },
  { label: "底線 _", insert: "_", title: "加在音符後面：八分音符；再按一次是十六分音符", kind: "mark" },
  { label: "附點 .", insert: ".", title: "加在音符後面：附點（音長 × 1.5）", kind: "mark" },
  { label: "（", insert: "(", title: "連音線開始", kind: "note" },
  { label: "）", insert: ")", title: "連音線結束", kind: "mark" },
  { label: "｜", insert: "|", title: "小節線（只是方便閱讀，不影響排版）", kind: "note" },
];

function formatBeats(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** 一行的旋律輸入：文字欄＋按鈕面板＋檢查＋預覽。 */
export function MelodyEditor({ song, line, onChange }: MelodyEditorProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const saved = lineMelodyText(line);
  const [draft, setDraft] = useState(saved);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focused) {
      setDraft(saved);
    }
  }, [saved, focused]);

  const parsed = useMemo(() => parseMelody(draft), [draft]);
  const status = useMemo(() => lineMelodyStatus(song, line), [song, line]);
  const layout = useMemo(
    () => layoutLineMelody(line.items, (item) => itemCapacity(song, item)),
    [song, line],
  );

  // 每個和弦：音符（要配字的）數 vs 第 1 節歌詞字數
  const lyricIssues = line.items
    .map((item, index) => {
      const columns = layout.cells.get(item.id);

      if (!columns) {
        return null;
      }

      const syllables = countSyllables(columns);
      const chars = splitLyricChars((item.lyric || "").split("\n")[0] ?? "").length;
      return chars > 0 && chars !== syllables ? { index, symbol: item.symbol, syllables, chars } : null;
    })
    .filter((entry): entry is { index: number; symbol: string; syllables: number; chars: number } => entry !== null);

  const beatIssues = status.cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => status.haveTotal > 0 && Math.abs(cell.have - cell.capacity) > 1e-6);

  function commit(next: string) {
    const limited = next.slice(0, MAX_MELODY_LINE_LENGTH);
    setDraft(limited);
    onChange((current) => setLineMelody(current, line.id, limited), `melody:${line.id}`);
  }

  function insert(key: KeyDef) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const before = draft.slice(0, start);
    const previous = before.slice(-1);
    const needsSpace = key.kind === "note" && previous !== "" && !/[\s(|#bn]/.test(previous);
    const piece = (needsSpace ? " " : "") + key.insert;
    const next = before + piece + draft.slice(end);
    const caret = before.length + piece.length;

    commit(next);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(caret, caret);
    });
  }

  function backspace() {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    commit(draft.slice(0, from) + draft.slice(end));
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(from, from);
    });
  }

  const hasMelody = saved !== "";
  const summary = hasMelody ? `${formatBeats(status.haveTotal)} 拍` : "尚未輸入";
  const previewSong: Song = { ...song, lines: [line] };

  return (
    <div className="melody-editor" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`melody-editor__toggle${open ? " is-open" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ♪ 旋律（簡譜）<small>{summary}</small>
        {hasMelody && status.mismatch && <span className="melody-editor__flag">拍數不符</span>}
      </button>

      {!open && hasMelody && <code className="melody-editor__peek">{saved}</code>}

      {open && (
        <div className="melody-editor__body">
          <textarea
            ref={textareaRef}
            className="melody-editor__input"
            value={draft}
            rows={2}
            maxLength={MAX_MELODY_LINE_LENGTH}
            spellCheck={false}
            placeholder="例如：3 3 4 5 | 5 4 3 2　（0 休止、- 延長、5_ 八分、5. 附點、1' 高八度、(1 2) 連音線）"
            aria-label={`第 ${song.lines.indexOf(line) + 1} 行的簡譜旋律`}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => commit(event.target.value)}
          />

          <div className="melody-keypad" role="group" aria-label="簡譜按鈕">
            {NOTE_KEYS.map((key) => (
              <button key={key.label} type="button" title={key.title} onClick={() => insert(key)}>
                {key.label}
              </button>
            ))}
            {MARK_KEYS.map((key) => (
              <button key={key.label} type="button" className="is-mark" title={key.title} onClick={() => insert(key)}>
                {key.label}
              </button>
            ))}
            <button type="button" className="is-mark" title="刪除前一個字元" onClick={backspace}>
              ⌫
            </button>
            <button type="button" className="is-mark" title="清除這一行的旋律" onClick={() => commit("")} disabled={draft === ""}>
              清除
            </button>
          </div>

          <ul className="melody-editor__checks">
            {parsed.errors.length > 0 && (
              <li className="is-error">
                有無法辨識的字元（已略過）：{[...new Set(parsed.errors.map((error) => error.char))].join(" ")}
              </li>
            )}
            {hasMelody && (
              <li className={status.mismatch ? "is-warn" : "is-ok"}>
                旋律共 {formatBeats(status.haveTotal)} 拍／和弦共 {formatBeats(status.capacityTotal)} 拍
                {status.mismatch ? "，有些和弦的拍數不一致" : "，拍數吻合"}
              </li>
            )}
            {beatIssues.slice(0, 6).map(({ cell, index }) => (
              <li className="is-warn" key={cell.itemId}>
                第 {index + 1} 個和弦（{line.items[index].symbol}）：旋律 {formatBeats(cell.have)} 拍，和弦 {formatBeats(cell.capacity)} 拍
              </li>
            ))}
            {lyricIssues.slice(0, 6).map((issue) => (
              <li className="is-warn" key={`${issue.index}`}>
                第 {issue.index + 1} 個和弦（{issue.symbol}）：音符 {issue.syllables} 個、第 1 節歌詞 {issue.chars} 字
              </li>
            ))}
            {!song.timeSignature && !song.defaultBeats && hasMelody && (
              <li className="is-hint">提示：先在上方設定「拍號」與「預設拍數」，旋律才能正確分配到每個和弦。</li>
            )}
          </ul>

          {hasMelody && (
            <div className="melody-editor__preview" aria-label="這一行的預覽">
              <LeadSheet song={previewSong} diagramMode="off" />
            </div>
          )}

          <details className="melody-editor__help">
            <summary>寫法說明</summary>
            <p>
              音符 <code>1</code>～<code>7</code>（首調，1 = 調號的主音）、休止 <code>0</code>、延長一拍 <code>-</code>。
              不加底線 = 1 拍；<code>5_</code> = 八分（半拍）；<code>5__</code> = 十六分；<code>5.</code> = 附點（× 1.5）。
              高八度 <code>1'</code>、低八度 <code>5,</code>；升降寫在數字前面：<code>#4</code>、<code>b7</code>。
              同一個字唱多個音，用括號：<code>(5 6)</code>。拍號分母是 8 的歌（如 6/8），1 拍是一個八分音符。
              整行打完即可，程式會依每個和弦的拍數自動分到各個和弦。
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
