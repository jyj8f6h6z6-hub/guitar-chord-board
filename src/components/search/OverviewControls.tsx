import { useEffect, useState } from "react";

interface StepperRangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  /** 例如 1 顯示成「自動」 */
  valueText?: (value: number) => string | null;
  onChange: (next: number) => void;
  hint?: string;
}

/** 滑桿＋數字輸入＋− ＋ 按鈕，一格 1。 */
export function StepperRange({ label, value, min, max, unit = "", valueText, onChange, hint }: StepperRangeProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clampValue = (next: number) => Math.min(max, Math.max(min, Math.round(next)));

  const commit = () => {
    const parsed = Number(text);
    const next = text.trim() !== "" && Number.isFinite(parsed) ? clampValue(parsed) : value;
    setText(String(next));
    onChange(next);
  };

  const special = valueText?.(value) ?? null;

  return (
    <div className="stepper-range" title={hint}>
      <div className="stepper-range__head">
        <span>{label}</span>
        <span className="stepper-range__box">
          <button type="button" aria-label={`${label} 減 1`} onClick={() => onChange(clampValue(value - 1))} disabled={value <= min}>
            −
          </button>
          <input
            type="number"
            min={min}
            max={max}
            step={1}
            value={text}
            aria-label={label}
            onChange={(event) => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commit();
              }
            }}
          />
          <button type="button" aria-label={`${label} 加 1`} onClick={() => onChange(clampValue(value + 1))} disabled={value >= max}>
            ＋
          </button>
          <span className="stepper-range__unit">{special ?? unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={`${label}（滑桿）`}
      />
    </div>
  );
}

interface PtSelectProps {
  value: number;
  min: number;
  max: number;
  presets: readonly number[];
  onChange: (next: number) => void;
}

/** 像 Word 的字級：下拉選單，旁邊有 − ＋。 */
export function PtSelect({ value, min, max, presets, onChange }: PtSelectProps) {
  const options = presets.includes(value) ? presets : [...presets, value].sort((a, b) => a - b);

  return (
    <div className="stepper-range">
      <div className="stepper-range__head">
        <span>歌詞字級</span>
        <span className="stepper-range__box">
          <button type="button" aria-label="歌詞字級 減 1" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
            −
          </button>
          <select value={value} aria-label="歌詞字級（pt）" onChange={(event) => onChange(Number(event.target.value))}>
            {options.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
          <button type="button" aria-label="歌詞字級 加 1" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
            ＋
          </button>
          <span className="stepper-range__unit">pt</span>
        </span>
      </div>
    </div>
  );
}
