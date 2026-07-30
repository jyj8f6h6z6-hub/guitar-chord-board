# Guitar Chord Board 專案操作手冊

這份文件整合原本的：

- `ARCHITECTURE.md`
- `GITHUB_SETUP.md`
- `PHASE_2_UPDATE.md`

適合目前專案的日常修改、測試、發布與基本架構查閱。

---

## 1. 專案資訊

GitHub Repository：

```text
https://github.com/jyj8f6h6z6-hub/guitar-chord-board
```

GitHub Pages 網站：

```text
https://jyj8f6h6z6-hub.github.io/guitar-chord-board/
```

本機專案資料夾：

```text
D:\guitar-chord-board
```

主要分支：

```text
main
```

自動部署設定：

```text
.github/workflows/deploy.yml
```

---

## 2. 平常修改網站的流程

### 第一步：開啟專案

使用 VS Code 開啟：

```text
D:\guitar-chord-board
```

終端機應顯示類似：

```text
PS D:\guitar-chord-board>
```

若不在正確資料夾，執行：

```powershell
cd D:\guitar-chord-board
```

### 第二步：查看目前狀態

```bash
git status
```

修改前若顯示：

```text
nothing to commit, working tree clean
```

代表目前沒有尚未提交的修改。

### 第三步：啟動本機網站

```bash
npm run dev
```

瀏覽器通常會開啟：

```text
http://localhost:5173
```

停止本機網站時，在終端機按：

```text
Ctrl + C
```

### 第四步：修改程式

修改完成後，先儲存所有檔案。

VS Code 分頁旁若還有小圓點，代表檔案尚未儲存。

### 第五步：檢查程式

```bash
npm run typecheck
npm run build
```

兩個指令都成功後，再啟動本機網站確認畫面：

```bash
npm run dev
```

### 第六步：提交到 GitHub

確認畫面正常後：

```bash
git status
git add .
git status
git commit -m "描述這次修改"
git push
```

例如：

```bash
git add .
git commit -m "調整首頁和弦查詢版面"
git push
```

---

## 3. GitHub Pages 自動發布

每次 push 到 `main` 後，GitHub Actions 會自動：

1. 取得最新程式碼。
2. 安裝 Node.js。
3. 安裝 dependencies。
4. 執行 TypeScript 檢查。
5. 執行 Vite build。
6. 建立 `dist`。
7. 發布到 GitHub Pages。

查看部署狀態：

```text
GitHub Repository
→ Actions
→ Deploy Guitar Chord Board to GitHub Pages
```

狀態說明：

- 綠色勾勾：部署成功。
- 黃色圓點：正在部署。
- 紅色叉叉：部署失敗。

部署成功後開啟：

```text
https://jyj8f6h6z6-hub.github.io/guitar-chord-board/
```

若仍看到舊畫面，可按：

```text
Ctrl + F5
```

---

## 4. 部署失敗時

先回到 VS Code 執行：

```bash
npm install
npm run typecheck
npm run build
```

若本機也失敗，先修正終端機顯示的錯誤。

若本機成功，可在 GitHub 重新執行：

```text
Repository
→ Actions
→ 選擇失敗的 workflow
→ Re-run jobs
→ Re-run all jobs
```

---

## 5. 常見 Git 訊息

### `nothing to commit`

代表目前沒有新的修改可以提交。

可能原因：

- 檔案沒有修改。
- 檔案尚未儲存。
- 修改已經提交。

先確認檔案已儲存，再執行：

```bash
git status
```

### `Everything up-to-date`

代表本機沒有新的 commit 需要推送。

### `LF will be replaced by CRLF`

這是 Windows 換行格式提醒，通常不是程式錯誤。

### Push 被拒絕

不要使用 `git push --force`。

先執行：

```bash
git pull --rebase
```

沒有衝突時再執行：

```bash
git push
```

若出現 conflict，先停止操作並確認衝突檔案。

---

## 6. 不需要上傳的資料夾

以下資料夾不需要手動提交：

```text
node_modules/
dist/
```

原因：

- `node_modules` 可由 `npm install` 重新建立。
- `dist` 可由 `npm run build` 重新建立。
- GitHub Actions 會自動建立正式版 `dist`。

---

## 7. 網站主要架構

```text
App
├── 網站標頭
├── 首頁標題
├── 模式切換
├── SingleChordSearch
│   ├── 單一和弦輸入
│   └── ChordCard
│       ├── 把位選擇
│       └── ChordDiagram
├── SongChordMode
│   ├── 歌曲和弦輸入
│   ├── 主要和弦 ChordCard
│   └── 相關和弦 ChordCard
└── 頁尾
```

目前首頁預設顯示：

```text
查單一和弦
```

使用者可以切換到歌曲和弦模式。

---

## 8. 主要檔案用途

### `src/App.tsx`

負責：

- 整個頁面骨架。
- 首頁標題。
- 模式切換。
- 單一和弦與歌曲和弦模式切換。
- GitHub Repository 連結。

### `src/components/search/SingleChordSearch.tsx`

負責：

- 單一和弦輸入。
- 查詢送出。
- 顯示查詢結果。
- 手機版送出後收起鍵盤。
- 手機版自動捲動到和弦圖。

### `src/components/search/SongChordMode.tsx`

負責：

- 多個歌曲和弦輸入。
- 分割和弦文字。
- 移除重複和弦。
- 顯示主要和弦。
- 顯示與替換相關和弦。

### `src/components/chord/ChordCard.tsx`

負責：

- 和弦名稱。
- 和弦按法。
- 多把位選擇。
- 組成音。
- 同音異名提示。
- 一般與 compact 顯示模式。

### `src/components/chord/ChordDiagram.tsx`

負責使用 SVG 繪製：

- 六條琴弦。
- 琴格。
- 按弦點。
- 空弦與不彈標示。
- 橫按。
- 手指編號。

### `src/data/chordShapes.ts`

負責：

- 吉他和弦按法資料。
- 多把位資料。
- 查詢與排序。
- 資料驗證。

新增或修改按法時，主要會編輯這個檔案。

### `src/services/chordTheory.ts`

負責和弦理論解析，例如：

- 和弦名稱。
- 組成音。
- 斜線和弦低音。

### `src/services/chordParser.ts`

負責將歌曲和弦文字分割成個別和弦。

### `src/services/relatedChords.ts`

負責產生相關和弦推薦。

### `src/utils/normalizeChordName.ts`

負責清理使用者輸入的和弦名稱。

### `src/utils/chordAliases.ts`

負責同音異名，例如：

```text
A# → Bb
Gb → F#
```

### `src/styles.css`

負責：

- 全站外觀。
- 電腦版版面。
- 手機版版面。
- 和弦卡。
- 按鈕。
- 查詢區與結果區排列。

---

## 9. 單一和弦查詢流程

```text
使用者輸入和弦
    ↓
normalizeChordName()
    ↓
getChordTheory()
    ↓
findChordShapes()
    ↓
ChordCard
    ↓
ChordDiagram
```

若同一個和弦有多個按法，`ChordCard` 會顯示把位選擇按鈕。

例如：

```ts
findChordShapes("C");
```

可能找到：

```text
C 開放位
C 第 3 格封閉位
```

預設按法優先順序：

1. 有 `beginner` 標籤。
2. 開放位。
3. 難度較低。
4. 把位較低。

---

## 10. 和弦按法資料規則

`frets` 順序固定為：

```text
低音 E、A、D、G、B、高音 e
```

數值規則：

- `x`：不彈。
- `0`：空弦。
- 正整數：實際琴格。
- `baseFret`：和弦圖第一格的實際琴格。
- `barres`：橫按資料。
- `fingers`：六條弦的手指編號。

理論資料與吉他按法資料分開處理。

因此可能發生：

- 理論上能解析，但專案尚未收錄按法。
- 使用另一個同音異名的按法。
- 輸入格式無法解析。

---

## 11. 電腦版與手機版

### 電腦版

首頁單一和弦模式使用雙欄排列：

```text
左側：查詢輸入
右側：和弦圖
```

### 手機版

螢幕較窄時改成單欄：

```text
查詢輸入
↓
和弦圖
```

送出查詢後：

1. 收起手機鍵盤。
2. 等待查詢結果更新。
3. 自動捲動到和弦圖。

---

## 12. 基本功能測試

修改和弦相關程式後，可測試：

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

預期結果：

- `C`：可切換開放位與第 3 格封閉位。
- `F`：可切換簡易位與完整封閉位。
- `A#`：使用 Bb 指法。
- `Gb`：使用 F# 指法。
- `F#m`、`Bbmaj7`、`Cadd9`、`Bm7`：可正常顯示。

歌曲模式可測試：

```text
C G Am F
```

確認：

- 和弦順序正確。
- 多把位可以切換。
- 相關和弦可以顯示。
- 點擊相關和弦可以替換。

---

## 13. 0.2.0 更新紀錄

0.2.0 主要加入：

- 一個和弦可有多個吉他按法。
- 多把位切換。
- 同音異名映射。
- 新增常用和弦資料。
- 和弦資料啟動驗證。
- 手機版和弦卡改善。

目前專案已經包含這些功能。

因此不要再次套用：

```text
guitar-chord-board-v0.2.0.patch
guitar-chord-board-v0.2.0-update.zip
```

重複套用可能覆蓋後來完成的首頁修改。

---

## 14. Repository 改名時

若 GitHub Repository 不再叫：

```text
guitar-chord-board
```

需要修改三個地方。

### `vite.config.ts`

```ts
const repositoryName = "新的-repository-名稱";
```

### `src/App.tsx`

```ts
const REPOSITORY_URL =
  "https://github.com/jyj8f6h6z6-hub/新的-repository-名稱";
```

### Git remote

```bash
git remote set-url origin https://github.com/jyj8f6h6z6-hub/新的-repository-名稱.git
git remote -v
```

修改後執行：

```bash
npm run build
git add .
git commit -m "更新 repository 名稱與部署路徑"
git push
```

---

## 15. 修改出錯時的安全復原

先查看最近的 commit：

```bash
git log --oneline -5
```

已經 push 的修改若需要取消，建議使用：

```bash
git revert COMMIT編號
git push
```

例如：

```bash
git revert a1b2c3d
git push
```

不要使用：

```text
git push --force
```

`git revert` 會保留修改紀錄，也能讓 GitHub Pages 自動部署復原版本。

---

## 16. 每次發布前檢查

```text
□ 所有修改檔案都已儲存
□ npm run typecheck 成功
□ npm run build 成功
□ 本機畫面正常
□ 手機版畫面正常
□ git status 只有預期修改
□ commit 訊息能說明修改內容
□ git push 成功
□ GitHub Actions 顯示綠色勾勾
□ GitHub Pages 正式網站已確認
```
