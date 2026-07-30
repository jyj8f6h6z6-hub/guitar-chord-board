import type { ChangeEvent } from "react";

interface ScoreFileInputProps {
  id: string;
  multiple?: boolean;
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
}

export function ScoreFileInput({
  id,
  multiple = true,
  disabled = false,
  onFilesSelected,
}: ScoreFileInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    onFilesSelected(files);
    event.target.value = "";
  }

  return (
    <label className={`score-file-input${disabled ? " is-disabled" : ""}`} htmlFor={id}>
      <span className="score-file-input__icon" aria-hidden="true">
        ＋
      </span>
      <span>
        <strong>拍照或選擇歌譜</strong>
        <small>支援 PNG、JPG、JPEG、PDF，可一次選多張圖片</small>
      </span>
      <input
        id={id}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
      />
    </label>
  );
}
