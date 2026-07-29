# PROJECT_STATUS

> 專案：Guitar Chord Board  
> 版本：0.1.0  
> 狀態：MVP 基礎版已架設，待本機安裝依賴與驗收  
> 最後更新：2026-07-29  
> 主要開發環境：VS Code  
> 原始碼管理與部署：GitHub／GitHub Pages

## 1. 專案目標

建立一個吉他和弦按法網站，讓使用者可以：

1. 輸入單一和弦名稱，查詢按法與組成音。
2. 一次輸入多個歌曲和弦，由上而下顯示全部按法。
3. 在每個主和弦右側查看常見變化、掛留和弦及轉位和弦。
4. 在桌機與手機上清楚閱讀和弦圖。

## 2. 目前完成項目

### 專案與開發環境

- [x] 建立 React＋TypeScript＋Vite 專案結構。
- [x] 建立 VS Code workspace 設定。
- [x] 建立 VS Code 推薦擴充套件清單。
- [x] 建立 VS Code 開發、型別檢查及建置工作。
- [x] 建立瀏覽器偵錯設定。
- [x] 建立 `.gitignore`。
- [x] 建立 GitHub Pages deployment workflow。

### 功能

- [x] 建立「單一和弦查詢」模式。
- [x] 建立「歌曲和弦清單」模式。
- [x] 支援空格、逗號、頓號、直線與換行分隔。
- [x] 支援移除重複和弦選項。
- [x] 使用 Tonal 解析和弦名稱與組成音。
- [x] 使用 SVG 繪製六弦、琴格、指法、空弦、禁彈與橫按。
- [x] 顯示按法難度。
- [x] 顯示相關和弦與常見轉位。
- [x] 點擊相關和弦可替換歌曲清單中的和弦。
- [x] 建立桌機與手機響應式版面。

### 和弦資料

- [x] 收錄 C、G、A、Am、F、D、Dm、E、Em、B、Bm 等基礎按法。
- [x] 收錄部分 7、maj7、sus2、sus4、dim 和弦。
- [x] 收錄 C/E、C/G、G/B、G/D、Am/C、Am/E、F/A、F/C、D/F# 等轉位。
- [x] 目前資料量為 48 個按法，且和弦 symbol 不重複。

## 3. 目前未完成／待確認

- [ ] 在使用者電腦執行 `npm install` 並產生 `package-lock.json`。
- [ ] 執行 `npm run typecheck` 與 `npm run build` 完整驗收。
- [ ] 建立實際 GitHub repository。
- [ ] 將本機專案連接到 GitHub remote。
- [ ] 在 GitHub 設定 Pages 的 Source 為 GitHub Actions。
- [ ] 將頁首 GitHub 連結替換為實際 repository 網址。
- [ ] 確認 repository 名稱；若不是 `guitar-chord-board`，修改 `vite.config.ts`。
- [ ] 逐一進行和弦指法的音樂性與人體工學校對。

## 4. 已知限制

1. 每個和弦目前只有一種主要按法，尚未提供把位切換。
2. 相關和弦使用預先定義的實用規則，尚未根據歌曲調性自動推薦。
3. 和弦指法資料為專案內建資料，並非完整和弦資料庫。
4. 尚未支援自訂調弦、七弦吉他、烏克麗麗或左手模式。
5. 尚未提供登入、雲端儲存或歌曲收藏；MVP 為純前端靜態網站。
6. 目前沒有自動化測試。

## 5. 技術架構

| 項目 | 選擇 | 用途 |
|---|---|---|
| UI | React | 元件與畫面狀態 |
| 語言 | TypeScript | 型別安全與資料模型 |
| 開發／建置 | Vite | 本機伺服器與正式版建置 |
| 音樂理論 | Tonal | 和弦解析、組成音與音程 |
| 和弦圖 | SVG | 清晰且可縮放的吉他按法圖 |
| 資料 | TypeScript 靜態資料 | 第一版和弦按法資料庫 |
| 原始碼管理 | Git／GitHub | 版本控制與協作 |
| 部署 | GitHub Actions＋Pages | 自動建置與靜態網站發布 |

## 6. 主要資料流

```text
使用者輸入
  ↓
normalizeChordName / parseChordInput
  ↓
和弦名稱陣列
  ├─ Tonal → 組成音、音程、正式名稱
  ├─ chordShapes → 吉他按法
  └─ relatedChords → 相關變化與轉位
  ↓
ChordCard / ChordDiagram
  ↓
單一查詢畫面或歌曲清單畫面
```

## 7. 近期開發順序

### P0：啟動與發布

1. 在 VS Code 開啟專案。
2. 執行 `npm install`。
3. 執行 `npm run dev`。
4. 檢查 C、Cmaj7、C/G、F、Bm 等圖形。
5. 執行 `npm run typecheck` 與 `npm run build`。
6. 建立 GitHub repository 並推送 `main`。
7. 啟用 GitHub Pages。

### P1：資料品質

1. 為每個和弦增加至少兩種按法。
2. 增加指法來源與校對註記。
3. 增加降記號與升記號同音異名對應，例如 Bb／A#。
4. 為無指法但 Tonal 可解析的和弦顯示更明確狀態。

### P2：歌曲工具

1. 加入歌曲名稱與段落，例如 Verse、Chorus。
2. 支援拖曳調整和弦順序。
3. 支援升降 Key 與移調。
4. 將歌曲和弦清單匯出成列印版或 PDF。
5. 使用 localStorage 保存最近使用的歌曲。

### P3：進階推薦

1. 偵測可能的歌曲調性。
2. 顯示調內和弦與級數。
3. 根據前後和弦推薦替代和弦。
4. 依初學、開放和弦、封閉和弦或爵士按法篩選。

## 8. GitHub 初次設定

建議 repository 名稱：`guitar-chord-board`

```bash
git init
git add .
git commit -m "feat: initialize guitar chord board MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/guitar-chord-board.git
git push -u origin main
```

推送後到 GitHub：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

## 9. 完成定義

MVP 可標記為完成，必須同時符合：

- [ ] `npm run build` 成功。
- [ ] 單一和弦查詢可顯示按法與組成音。
- [ ] 多和弦輸入可保留輸入順序。
- [ ] 相關和弦可正常替換主和弦。
- [ ] 桌機、平板與手機沒有明顯版面溢位。
- [ ] GitHub Pages 公開網址可正常開啟。
- [ ] README 與 PROJECT_STATUS 反映實際狀態。

## 10. 下一個明確工作

**在本機 VS Code 執行安裝與建置驗收，取得 `package-lock.json`，再建立 GitHub repository 並首次推送。**

## 11. 2026-07-29 驗證紀錄

- [x] 所有 JSON 設定檔可正常解析。
- [x] GitHub Actions YAML 結構可正常解析。
- [x] TypeScript 原始碼通過離線型別結構檢查。
- [x] 48 筆和弦資料皆包含六弦 fret 與 finger 欄位。
- [x] 和弦 ID 與 symbol 無重複。
- [x] 多和弦解析測試通過：`C, G\nAm、F` → `C G Am F`。
- [x] C 相關和弦測試通過：包含 `C7`、`Cdim`、`C/E`、`C/G`。
- [ ] 因目前建置環境無法連線至 npm registry，尚未執行真實 dependency 安裝與 Vite production build；此項必須在使用者本機完成。
