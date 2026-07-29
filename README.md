# Guitar Chord Board

一個以 React、TypeScript、Tonal 與 SVG 製作的吉他和弦工具。

## 目前功能

- 輸入單一和弦，顯示吉他按法與組成音。
- 一次輸入多個和弦，依歌曲順序由上而下排列。
- 每個主和弦右側顯示常見變化、掛留和弦與轉位。
- 點擊相關和弦即可替換歌曲清單中的該列。
- 常用和弦可切換開放位、簡易位或封閉位。
- 支援 A#／Bb、Gb／F# 等已收錄的同音異名按法。
- 72 個按法、61 個不重複和弦名稱。
- 響應式版面：手機上相關和弦與把位按鈕可左右滑動。
- GitHub Actions 自動部署至 GitHub Pages。

## 在 VS Code 開始

1. 安裝 Node.js 20.19 以上版本。
2. 在 VS Code 選擇 **File → Open Folder**，開啟本專案資料夾。
3. 開啟終端機並執行：

```bash
npm install
npm run dev
```

瀏覽器開啟 `http://localhost:5173`。

## 驗收與建置

```bash
npm run typecheck
npm run build
npm run preview
```

0.2.0 建議測試：

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

歌曲模式：

```text
C G Am F
```

## GitHub

Repository：

```text
https://github.com/jyj8f6h6z6-hub/guitar-chord-board
```

完成修改後：

```bash
git add .
git commit -m "描述這次修改"
git push
```

推送至 `main` 後，GitHub Actions 會自動建置並發布到 GitHub Pages。

## Repository 名稱不同時

若 fork 或更名，請修改 `vite.config.ts`：

```ts
const repositoryName = "新的-repository-名稱";
```

## 專案文件

- [PROJECT_STATUS.md](./PROJECT_STATUS.md)：目前進度、驗收項目與後續工作。
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)：程式架構與資料流。
- [docs/GITHUB_SETUP.md](./docs/GITHUB_SETUP.md)：GitHub 與 Pages 設定。
- [docs/PHASE_2_UPDATE.md](./docs/PHASE_2_UPDATE.md)：0.2.0 更新套用與驗收步驟。
