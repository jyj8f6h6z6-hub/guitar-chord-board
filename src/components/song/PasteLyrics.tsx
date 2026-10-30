import { useMemo, useState } from "react";
import {
  PASTE_KIND_LABEL,
  applyPaste,
  checkLine,
  defaultTargetIds,
  endsWithPunct,
  parsePaste,
  planPaste,
} from "../../services/pasteLyrics";
import type { BlockPlan } from "../../services/pasteLyrics";
import { MAX_LYRIC_ROWS } from "../../services/songModel";
import type { Song } from "../../types/song";

interface PasteLyricsProps {
  song: Song;
  onApply: (change: (song: Song) => Song) => void;
  onClose: () => void;
}

const PLACEHOLDER = [
  "一、我們何等眼瞎，只顧自己的事務，",
  "任憑神殿荒涼—哦主，你必須有路！",
  "",
  "二、第二節的歌詞…",
  "",
  "副歌一",
  "副歌第一次的歌詞…",
].join("\n");

export function PasteLyrics({ song, onApply, onClose }: PasteLyricsProps) {
  const [text, setText] = useState("");
  const [start, setStart] = useState(1);
  const [targets, setTargets] = useState<string[]>(() => defaultTargetIds(song));
  const [edits, setEdits] = useState<Record<string, string>>({});

  const blocks = useMemo(() => parsePaste(text, start), [text, start]);
  const { plans, notices } = useMemo(() => planPaste(song, targets, blocks), [song, targets, blocks]);

  const finalPlans: BlockPlan[] = plans.map((plan) => ({
    ...plan,
    lines: plan.lines.map((line) => ({
      ...line,
      pieces: line.pieces.map((piece, index) => edits[`${plan.blockIndex}:${line.lineId}:${index}`] ?? piece),
    })),
  }));

  const placeable = finalPlans.filter((plan) => plan.row !== null && plan.lines.length > 0);
  const hasText = text.trim() !== "";

  function toggleTarget(lineId: string) {
    setEdits({});
    setTargets((current) => (current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId]));
  }

  function apply() {
    onApply((current) => applyPaste(current, placeable));
    onClose();
  }

  return (
    <section className="verse-fill paste-lyrics" aria-labelledby="paste-lyrics-title">
      <div className="verse-fill__heading">
        <div>
          <p className="eyebrow">歌詞</p>
          <h3 id="paste-lyrics-title">貼上整首歌詞</h3>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>
          關閉
        </button>
      </div>

      <ol className="verse-fill__steps">
        <li>
          直接貼上歌詞。<strong>換行、空格都不影響</strong>，程式依旋律的音數（沒有旋律的行，依原本第 1 節的字數）切到每一行、每個和弦。
        </li>
        <li>
          <strong>空一整行＝下一節</strong>。開頭的「一、」「1.」「(一)」會自動去掉並決定是第幾節。
        </li>
        <li>
          副歌、橋段、預歌：單獨一行寫標題，例如 <code>副歌一</code>，後面的歌詞就會放到編排區標成「副歌」的行。沒有寫標題時，每一節的歌詞會從頭依序放滿所有勾選的行。
        </li>
        <li>
          還沒有旋律、字數也不同的行，可以用 <code>/</code> 標出換和弦的位置，例如 <code>今天/天氣/真好</code>。
        </li>
      </ol>

      <label className="verse-fill__paste">
        <span>貼上歌詞</span>
        <textarea
          value={text}
          rows={10}
          placeholder={PLACEHOLDER}
          onChange={(event) => {
            setText(event.target.value);
            setEdits({});
          }}
        />
      </label>

      <div className="paste-lyrics__options">
        <label>
          沒有寫節號時，從第
          <select
            value={start}
            onChange={(event) => {
              setStart(Number(event.target.value));
              setEdits({});
            }}
          >
            {Array.from({ length: MAX_LYRIC_ROWS }, (_, index) => index + 1).map((number) => (
              <option key={number} value={number}>
                {number}
              </option>
            ))}
          </select>
          節開始放（只會改寫貼上的那幾節，其他節不動）
        </label>
      </div>

      <details className="verse-fill__targets-details">
        <summary>要放歌詞的行（已勾 {targets.length}／{song.lines.length} 行）</summary>
        <fieldset className="verse-fill__targets">
          <legend>要放歌詞的行</legend>
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
      </details>

      {hasText && blocks.length === 0 && <p className="verse-fill__warning">沒有讀到可以放的歌詞。</p>}

      {notices.map((notice) => (
        <p key={notice} className="verse-fill__warning">
          {notice}
        </p>
      ))}

      {placeable.length > 0 && (
        <div className="verse-fill__preview">
          <h4>預覽（紅色＝字數和旋律音數不同，可以直接修改）</h4>

          {placeable.map((plan) => {
            const block = blocks[plan.blockIndex];
            const blockHasPunct = block.chars.some((char) => endsWithPunct(char));
            const heading =
              plan.kind === "verse" ? `第 ${plan.number} 節` : `${PASTE_KIND_LABEL[plan.kind]}　放在第 ${plan.number} 節的位置`;

            return (
              <div key={plan.blockIndex} className="verse-fill__verse">
                <strong>
                  {heading}
                  <small>　共 {plan.total} 字</small>
                </strong>

                {plan.lines.map((linePlan, lineOrder) => {
                  const lineIndex = song.lines.findIndex((line) => line.id === linePlan.lineId);
                  const line = song.lines[lineIndex];
                  const check = checkLine(linePlan, linePlan.pieces, lineOrder === plan.lines.length - 1, blockHasPunct);
                  const warn = check.bad.some(Boolean) || check.noPunct;

                  return (
                    <div key={linePlan.lineId} className={`verse-fill__line${warn ? " has-warning" : ""}`}>
                      <span className="verse-fill__line-label">
                        第 {lineIndex + 1} 行
                        {check.noPunct && <em>結尾不在標點上，字數可能對不上</em>}
                      </span>

                      <div className="verse-fill__cells">
                        {line.items.map((item, itemIndex) => {
                          const slot = linePlan.slots[itemIndex];
                          return (
                            <div className={`verse-fill__cell${check.bad[itemIndex] ? " is-bad" : ""}`} key={item.id}>
                              <strong>{item.symbol}</strong>
                              <small>{slot === null ? "—" : `${slot} 音`}</small>
                              <input
                                type="text"
                                value={linePlan.pieces[itemIndex]}
                                aria-label={`${heading} 第 ${lineIndex + 1} 行 ${item.symbol} 的歌詞`}
                                onChange={(event) =>
                                  setEdits((current) => ({
                                    ...current,
                                    [`${plan.blockIndex}:${linePlan.lineId}:${itemIndex}`]: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className="verse-fill__actions">
        <button type="button" className="primary-button" onClick={apply} disabled={placeable.length === 0}>
          套用到編排（只改寫貼上的那幾節）
        </button>
        <span>套用後可以用「↶ 復原」還原。</span>
      </div>
    </section>
  );
}
