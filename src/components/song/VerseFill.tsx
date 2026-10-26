import { useMemo, useState } from "react";
import {
  applyVersePlan,
  defaultTargetLineIds,
  parseVerses,
  planVerses,
} from "../../services/lyricSplit";
import type { LineStatus, VersePlan } from "../../services/lyricSplit";
import { MAX_LYRIC_ROWS } from "../../services/songModel";
import type { Song } from "../../types/song";

interface VerseFillProps {
  song: Song;
  onApply: (change: (song: Song) => Song) => void;
  onClose: () => void;
}

const STATUS_TEXT: Record<LineStatus, string> = {
  ok: "",
  "too-many": "字比第一節多，多的字併入最後一個和弦",
  "too-few": "字比第一節少，後面的和弦會空白",
  missing: "這一節少了這一句",
};

export function VerseFill({ song, onApply, onClose }: VerseFillProps) {
  const [text, setText] = useState("");
  const [targets, setTargets] = useState<string[]>(() => defaultTargetLineIds(song));
  const [edits, setEdits] = useState<Record<string, string>>({});

  const verses = useMemo(() => parseVerses(text), [text]);
  const plans: VersePlan[] = useMemo(() => planVerses(song, targets, verses), [song, targets, verses]);

  // 預覽裡手動改過的字，優先於自動切分的結果。
  const finalPlans: VersePlan[] = plans.map((plan) => ({
    ...plan,
    lines: plan.lines.map((line) => ({
      ...line,
      pieces: line.pieces.map((piece, index) => edits[`${plan.verseNumber}:${line.lineId}:${index}`] ?? piece),
    })),
  }));

  const orderedTargets = song.lines.filter((line) => targets.includes(line.id)).map((line) => line.id);
  const tooManyVerses = verses.length > MAX_LYRIC_ROWS - 1;

  function toggleTarget(lineId: string) {
    setEdits({});
    setTargets((current) =>
      current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId],
    );
  }

  function apply() {
    onApply((current) => applyVersePlan(current, finalPlans));
    onClose();
  }

  const extraWarnings = plans.filter((plan) => plan.extraLines !== 0);

  return (
    <section className="verse-fill" aria-labelledby="verse-fill-title">
      <div className="verse-fill__heading">
        <div>
          <p className="eyebrow">其他節歌詞</p>
          <h3 id="verse-fill-title">貼上第 2、3… 節歌詞，自動照第一節排好</h3>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>
          關閉
        </button>
      </div>

      <ol className="verse-fill__steps">
        <li>先在編排區打好第一節（每個和弦下面的字）。</li>
        <li>勾選要補歌詞的行（預設是有歌詞、且不是副歌的行）。</li>
        <li>
          貼上其他節：<strong>每一句一行，節與節之間空一行</strong>。字數與第一節不同的句子，可以用 / 標出換和弦的位置，例如 <code>今天/天氣/真好</code>。
        </li>
      </ol>

      <fieldset className="verse-fill__targets">
        <legend>要補歌詞的行</legend>
        {song.lines.map((line, index) => {
          const first = line.items.map((item) => item.lyric.split("\n")[0]).join("");
          return (
            <label key={line.id} className="checkbox-label">
              <input type="checkbox" checked={targets.includes(line.id)} onChange={() => toggleTarget(line.id)} />
              第 {index + 1} 行　{line.items.map((item) => item.symbol).join(" ")}
              {first ? `　「${first.slice(0, 14)}${first.length > 14 ? "…" : ""}」` : ""}
            </label>
          );
        })}
      </fieldset>

      <label className="verse-fill__paste">
        <span>貼上其他節的歌詞</span>
        <textarea
          value={text}
          rows={8}
          placeholder={"第二節第一句\n第二節第二句\n\n第三節第一句\n第三節第二句"}
          onChange={(event) => {
            setText(event.target.value);
            setEdits({});
          }}
        />
      </label>

      {verses.length > 0 && orderedTargets.length === 0 && (
        <p className="verse-fill__warning">請至少勾選一行。</p>
      )}

      {tooManyVerses && (
        <p className="verse-fill__warning">最多支援 {MAX_LYRIC_ROWS} 節（含第一節），多出來的節不會加入。</p>
      )}

      {extraWarnings.map((plan) => (
        <p key={plan.verseNumber} className="verse-fill__warning">
          第 {plan.verseNumber} 節的句數與勾選的行數不同（
          {plan.extraLines > 0 ? `多 ${plan.extraLines} 句，多的不會加入` : `少 ${-plan.extraLines} 句，缺的留空`}
          ）。如果有例外，請調整上面勾選的行。
        </p>
      ))}

      {finalPlans.length > 0 && orderedTargets.length > 0 && (
        <div className="verse-fill__preview">
          <h4>預覽（可直接修改每個和弦下的字）</h4>

          {finalPlans.map((plan) => (
            <div key={plan.verseNumber} className="verse-fill__verse">
              <strong>第 {plan.verseNumber} 節</strong>

              {plan.lines.map((linePlan) => {
                const lineIndex = song.lines.findIndex((line) => line.id === linePlan.lineId);
                const line = song.lines[lineIndex];
                const original = plans.find((p) => p.verseNumber === plan.verseNumber)?.lines.find((l) => l.lineId === linePlan.lineId);

                return (
                  <div key={linePlan.lineId} className={`verse-fill__line${original && original.status !== "ok" ? " has-warning" : ""}`}>
                    <span className="verse-fill__line-label">
                      第 {lineIndex + 1} 行
                      {original && original.status !== "ok" && (
                        <em>{STATUS_TEXT[original.status]}</em>
                      )}
                    </span>

                    <div className="verse-fill__cells">
                      {line.items.map((item, itemIndex) => (
                        <div className="verse-fill__cell" key={item.id}>
                          <strong>{item.symbol}</strong>
                          <small>{item.lyric.split("\n")[0] || "—"}</small>
                          <input
                            type="text"
                            value={linePlan.pieces[itemIndex]}
                            aria-label={`第 ${plan.verseNumber} 節 第 ${lineIndex + 1} 行 ${item.symbol} 的歌詞`}
                            onChange={(event) =>
                              setEdits((current) => ({
                                ...current,
                                [`${plan.verseNumber}:${linePlan.lineId}:${itemIndex}`]: event.target.value,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="verse-fill__actions">
        <button
          type="button"
          className="primary-button"
          onClick={apply}
          disabled={finalPlans.length === 0 || orderedTargets.length === 0}
        >
          套用到編排（取代這些行原有的第 2 節之後歌詞）
        </button>
        <span>套用後可以用「↶ 復原」還原。</span>
      </div>
    </section>
  );
}
