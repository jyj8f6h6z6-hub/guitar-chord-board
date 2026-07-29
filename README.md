# Guitar Chord Board

一個以 React、TypeScript 與 SVG 製作的吉他和弦工具。

## MVP 功能

- 輸入單一和弦，顯示吉他按法與組成音。
- 一次輸入多個和弦，依歌曲順序由上而下排列。
- 每個主和弦右側顯示常見變化、掛留和弦與轉位。
- 點擊相關和弦即可替換歌曲清單中的該列。
- 響應式版面：手機上相關和弦可左右滑動。
- GitHub Actions 自動部署至 GitHub Pages。

## 在 VS Code 開始

1. 安裝 Node.js 20.19 以上版本；建議使用目前的 LTS。
2. 在 VS Code 選擇 **File → Open Folder**，開啟本專案資料夾。
3. 接受 VS Code 顯示的推薦擴充套件。
4. 開啟終端機並執行：

```bash
npm install
npm run dev
```

瀏覽器開啟 `http://localhost:5173`。

也可以按 `Ctrl/Cmd + Shift + B` 執行預設的 VS Code 工作。

## 建置

```bash
npm run typecheck
npm run build
npm run preview
```

## 建立 GitHub repository

請先在 GitHub 建立空白 repository，建議名稱為 `guitar-chord-board`，不要在 GitHub 端額外建立 README。

```bash
git init
git add .
git commit -m "feat: initialize guitar chord board MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/guitar-chord-board.git
git push -u origin main
```

接著前往 repository：

1. `Settings → Pages`
2. `Build and deployment → Source`
3. 選擇 `GitHub Actions`

workflow 成功後，網站位址通常為：

```text
https://YOUR_USERNAME.github.io/guitar-chord-board/
```

## Repository 名稱不同時

如果 GitHub repository 不叫 `guitar-chord-board`，請修改 `vite.config.ts`：

```ts
const repositoryName = "你的-repository-名稱";
```

## 專案文件

- [PROJECT_STATUS.md](./PROJECT_STATUS.md)：目前進度、風險與後續工作。
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)：程式架構與資料流。
- [docs/GITHUB_SETUP.md](./docs/GITHUB_SETUP.md)：GitHub 與 Pages 詳細設定。
