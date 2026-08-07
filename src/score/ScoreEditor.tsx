import { useRef, useState } from "react";

import {
    NoteSymbol,
    type NoteSymbolData,
} from "./NoteSymbol";

import "../score.css";



interface ScoreRow {
  id: string;
  chords: string;
  notation: string;
  lyrics: string;
}

function createScoreRow(): ScoreRow {
  return {
    id: crypto.randomUUID(),
    chords: "",
    notation: "",
    lyrics: "",
  };
}

const HIGH_DOT = "\u0307";
const LOW_DOT = "\u0323";
const NOTE_UNDERLINE = "\u0332";

function toggleNotationMark(text: string, mark: string): string {
  const notePattern = /[1-7][\u0307\u0323\u0332]*/g;
  const notes = text.match(notePattern) ?? [];

  if (notes.length === 0) {
    return text;
  }

  const shouldRemove = notes.every((note) => note.includes(mark));

  return text.replace(notePattern, (note) => {
    if (shouldRemove) {
      return note.replaceAll(mark, "");
    }

    if (note.includes(mark)) {
      return note;
    }

    return `${note}${mark}`;
  });
}



export function ScoreEditor() {
  const [songNumber, setSongNumber] = useState("");
  const [title, setTitle] = useState("");
  const [keySignature, setKeySignature] = useState("C");
  const [timeSignature, setTimeSignature] = useState("4/4");

  const [rows, setRows] = useState<ScoreRow[]>([
    {
      id: crypto.randomUUID(),
      chords: "C              F              G7",
      notation: "| 5  1 | 3  3  3  4  3 | 2  1 |",
      lyrics: "  不  管   你  來  自  何  地   不  管",
    },
  ]);

  const [activeNotationRowId, setActiveNotationRowId] =
    useState<string | null>(null);

  const [testNotes] = useState<NoteSymbolData[]>([
    {
        id: crypto.randomUUID(),
        value: "1",
        octave: "normal",
        underline: false,
    },
    {
        id: crypto.randomUUID(),
        value: "2",
        octave: "high",
        underline: false,
    },
    {
        id: crypto.randomUUID(),
        value: "3",
        octave: "low",
        underline: false,
    },
    {
        id: crypto.randomUUID(),
        value: "4",
        octave: "normal",
        underline: true,
    },
    ]);

    const [selectedTestNoteId, setSelectedTestNoteId] =
    useState<string | null>(null);

  const notationRefs = useRef<
    Record<string, HTMLTextAreaElement | null>
  >({});

  function updateRow(
    id: string,
    field: "chords" | "notation" | "lyrics",
    value: string,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  function addRow() {
    const newRow = createScoreRow();

    setRows((current) => [...current, newRow]);

    requestAnimationFrame(() => {
      const textarea = notationRefs.current[newRow.id];

      if (!textarea) {
        return;
      }

      textarea.focus();
      setActiveNotationRowId(newRow.id);
    });
  }

  function removeRow(id: string) {
    setRows((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((row) => row.id !== id);
    });

    if (activeNotationRowId === id) {
      setActiveNotationRowId(null);
    }
  }

  function insertNotation(text: string) {
    if (!activeNotationRowId) {
      return;
    }

    const textarea = notationRefs.current[activeNotationRowId];

    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const currentRow = rows.find(
      (row) => row.id === activeNotationRowId,
    );

    if (!currentRow) {
      return;
    }

    const nextNotation =
      currentRow.notation.slice(0, start) +
      text +
      currentRow.notation.slice(end);

    updateRow(
      activeNotationRowId,
      "notation",
      nextNotation,
    );

    const nextCursorPosition = start + text.length;

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        nextCursorPosition,
        nextCursorPosition,
      );
    });
  }

  function applyNotationMark(mark: string) {
    if (!activeNotationRowId) {
        return;
    }

    const textarea = notationRefs.current[activeNotationRowId];

    if (!textarea) {
        return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
        return;
    }

    const currentRow = rows.find(
        (row) => row.id === activeNotationRowId,
    );

    if (!currentRow) {
        return;
    }

    const selectedText = currentRow.notation.slice(start, end);
    const formattedText = toggleNotationMark(selectedText, mark);

    const nextNotation =
        currentRow.notation.slice(0, start) +
        formattedText +
        currentRow.notation.slice(end);

    updateRow(
        activeNotationRowId,
        "notation",
        nextNotation,
    );

    requestAnimationFrame(() => {
        textarea.focus();

        textarea.setSelectionRange(
        start,
        start + formattedText.length,
        );
    });
    }

  return (
    <section className="score-editor">
      <header className="score-editor__heading">
        <p className="eyebrow">
          NUMBERED MUSICAL NOTATION
        </p>

        <h2>簡譜製作</h2>

        <p>
          直接在白色譜面上編輯和弦、簡譜與歌詞。
        </p>
      </header>

      <section className="score-editor__settings">
        <h3>歌曲設定</h3>

        <div className="score-editor__form-grid">
          <label>
            <span>編號</span>

            <input
              type="text"
              value={songNumber}
              onChange={(event) =>
                setSongNumber(event.target.value)
              }
              placeholder="例如：001"
            />
          </label>

          <label>
            <span>歌名</span>

            <input
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="例如：歡迎你"
            />
          </label>

          <label>
            <span>調性</span>

            <select
              value={keySignature}
              onChange={(event) =>
                setKeySignature(event.target.value)
              }
            >
              <option value="C">C</option>
              <option value="Db">D♭</option>
              <option value="D">D</option>
              <option value="Eb">E♭</option>
              <option value="E">E</option>
              <option value="F">F</option>
              <option value="F#">F♯</option>
              <option value="G">G</option>
              <option value="Ab">A♭</option>
              <option value="A">A</option>
              <option value="Bb">B♭</option>
              <option value="B">B</option>
            </select>
          </label>

          <label>
            <span>拍號</span>

            <select
              value={timeSignature}
              onChange={(event) =>
                setTimeSignature(event.target.value)
              }
            >
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="2/4">2/4</option>
              <option value="6/8">6/8</option>
            </select>
          </label>
        </div>
      </section>

      <section className="score-toolbar">
        <div className="score-toolbar__title">
          簡譜工具
        </div>

        <div className="score-toolbar__buttons">
          {["1", "2", "3", "4", "5", "6", "7"].map(
            (number) => (
              <button
                key={number}
                type="button"
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() =>
                  insertNotation(number)
                }
                disabled={!activeNotationRowId}
              >
                {number}
              </button>
            ),
          )}

          <span className="score-toolbar__divider" />

          <button
            type="button"
            onMouseDown={(event) =>
              event.preventDefault()
            }
            onClick={() => insertNotation("-")}
            disabled={!activeNotationRowId}
          >
            -
          </button>

          <button
            type="button"
            onMouseDown={(event) =>
              event.preventDefault()
            }
            onClick={() => insertNotation("|")}
            disabled={!activeNotationRowId}
          >
            |
          </button>

          <button
            type="button"
            onMouseDown={(event) =>
              event.preventDefault()
            }
            onClick={() => insertNotation("||")}
            disabled={!activeNotationRowId}
          >
            ||
          </button>
        </div>

        <span className="score-toolbar__divider" />

        <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => applyNotationMark(HIGH_DOT)}
        disabled={!activeNotationRowId}
        title="先選取簡譜數字，再按此按鈕"
        >
        1̇ 高音
        </button>

        <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => applyNotationMark(LOW_DOT)}
        disabled={!activeNotationRowId}
        title="先選取簡譜數字，再按此按鈕"
        >
        1̣ 低音
        </button>

        <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => applyNotationMark(NOTE_UNDERLINE)}
        disabled={!activeNotationRowId}
        title="先選取簡譜數字，再按此按鈕"
        >
        1̲ 八分
        </button>

        <small>
          先點一下白色譜面中的「簡譜列」，
          再按上面的按鈕。
        </small>
      </section>

      <section className="score-paper">
        <div className="score-paper__title">
          {songNumber && <strong>{songNumber}</strong>}

          <input
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="未命名歌曲"
            aria-label="歌名"
          />
        </div>

        <div className="score-paper__meta">
          <span>{keySignature}</span>
          <span>{timeSignature}</span>
        </div>

        <div className="score-paper__rows">
          {rows.map((row, index) => (
            <div
              className="score-paper__row"
              key={row.id}
            >
              <div className="score-paper__row-tools">
                <span>第 {index + 1} 行</span>

                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  title="刪除這一行"
                >
                  ×
                </button>
              </div>

              <textarea
                className="score-paper__edit score-paper__chords"
                value={row.chords}
                onChange={(event) =>
                  updateRow(
                    row.id,
                    "chords",
                    event.target.value,
                  )
                }
                placeholder="和弦"
                rows={1}
                spellCheck={false}
              />

              <textarea
                ref={(element) => {
                  notationRefs.current[row.id] = element;
                }}
                className={`score-paper__edit score-paper__notation${
                  activeNotationRowId === row.id
                    ? " is-active"
                    : ""
                }`}
                value={row.notation}
                onFocus={() =>
                  setActiveNotationRowId(row.id)
                }
                onClick={() =>
                  setActiveNotationRowId(row.id)
                }
                onChange={(event) =>
                  updateRow(
                    row.id,
                    "notation",
                    event.target.value,
                  )
                }
                placeholder="簡譜"
                rows={1}
                spellCheck={false}
              />

              <textarea
                className="score-paper__edit score-paper__lyrics"
                value={row.lyrics}
                onChange={(event) =>
                  updateRow(
                    row.id,
                    "lyrics",
                    event.target.value,
                  )
                }
                placeholder="歌詞"
                rows={1}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="score-paper__add-row"
          onClick={addRow}
        >

        <div className="notation-test">
        {testNotes.map((note) => (
            <NoteSymbol
            key={note.id}
            note={note}
            selected={selectedTestNoteId === note.id}
            onSelect={() => setSelectedTestNoteId(note.id)}
            />
        ))}
        </div>

          ＋ 新增下一行
        </button>
      </section>
    </section>
  );
}
