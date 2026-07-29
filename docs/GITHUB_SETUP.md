# GitHub 與 GitHub Pages 設定

## 1. 建立 repository

在 GitHub 建立空白 repository：

```text
guitar-chord-board
```

不要勾選自動建立 README、`.gitignore` 或 License，避免第一次 push 產生衝突。

## 2. 初始化並推送

```bash
git init
git add .
git commit -m "feat: initialize guitar chord board MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/guitar-chord-board.git
git push -u origin main
```

## 3. 啟用 Pages

進入 repository：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

`.github/workflows/deploy.yml` 會在每次 push 到 `main` 時：

1. 取出程式碼。
2. 安裝 Node.js。
3. 安裝 dependencies。
4. 執行型別檢查與 Vite build。
5. 上傳 `dist`。
6. 發布到 GitHub Pages。

## 4. 修改 repository 名稱

若 repository 名稱不是 `guitar-chord-board`，修改 `vite.config.ts`：

```ts
const repositoryName = "新的-repository-名稱";
```

## 5. 更新頁首 GitHub 連結

修改 `src/App.tsx` 內的 GitHub 連結：

```tsx
href="https://github.com/YOUR_USERNAME/guitar-chord-board"
```
