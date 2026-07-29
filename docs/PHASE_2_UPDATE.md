# 0.2.0 更新套用方式

## 建議方式：使用 Git patch

先在 VS Code 終端機確認工作區乾淨：

```bash
git status
```

建立更新分支：

```bash
git switch -c feat/chord-positions
```

將 `guitar-chord-board-v0.2.0.patch` 放到專案根目錄後執行：

```bash
git apply --check guitar-chord-board-v0.2.0.patch
git apply guitar-chord-board-v0.2.0.patch
```

## 替代方式：覆蓋更新檔

解壓縮 `guitar-chord-board-v0.2.0-update.zip`，將其中檔案依原資料夾結構覆蓋到專案根目錄。既有的 `package-lock.json` 不需要刪除。

## 驗收

```bash
npm run typecheck
npm run build
npm run dev
```

瀏覽器測試：

```text
C
F
F#m
Bbmaj7
A#
Gb
Cadd9
Bm7
```

其中：

- `C` 應可切換開放位與第 3 格封閉位。
- `F` 應預設使用四弦簡易位，並可切換完整封閉位。
- `A#` 應套用 `Bb` 指法。
- `Gb` 應套用 `F#` 指法。

## 提交與部署

```bash
git add .
git commit -m "feat: add multiple chord positions and enharmonic aliases"
git push -u origin feat/chord-positions
```

可在 GitHub 建立 Pull Request；或確認無誤後合併至 `main`，GitHub Pages 便會自動重新部署。
