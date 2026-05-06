# 後端說明（Supabase + Prisma + pg）

## 1. 架構說明

本後端目前是 `Express + Prisma + pg` 架構，資料庫使用 PostgreSQL 協定連線。

重點如下：

1. 有使用 `pg` 套件（`package.json` 可見 `pg` dependency）。
2. API 執行時由 `index.js` 讀取 `process.env.DATABASE_URL` 建立 `Pool`。
3. 再把該連線池交給 Prisma adapter（`@prisma/adapter-pg`）使用。
4. 沒有使用 `@supabase/supabase-js` SDK。

這代表目前是把 Supabase 當成「線上 PostgreSQL 資料庫」使用。

## 2. 為什麼要分兩條連線字串

本專案分為兩種用途：

1. `DATABASE_URL`（執行用）
   - 用途：後端 API 平常查詢與寫入資料。
   - 建議：使用 Supabase 的 Pooler connection。

2. `DIRECT_URL`（migration 用）
   - 用途：`prisma migrate`、資料庫結構異動。
   - 建議：使用 Supabase 的 Direct connection（通常為 5432）。

簡單記法：

1. 平常跑 API 走 `DATABASE_URL`。
2. 改資料表結構走 `DIRECT_URL`。

## 3. 重新連上 Supabase 的操作步驟

### 步驟 1：取得 Supabase 連線字串

在 Supabase 後台進入 `Project Settings > Database > Connection string`，複製：

1. `Pooler connection`。
2. `Direct connection`。

### 步驟 2：更新 `.env`

在 `back/.env` 設定：

```env
DATABASE_URL="postgresql://<user>:<password>@<pooler-host>:<port>/<db>?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<direct-host>:5432/<db>?sslmode=require"
PORT=3000
```

注意事項：

1. `DATABASE_URL` 要放 Pooler。
2. `DIRECT_URL` 要放 Direct。
3. 連線字串請使用 `postgres://` 或 `postgresql://`。
4. 不要使用 `prisma+postgres://localhost:...` 這種本機開發字串來連 Supabase。

### 步驟 3：啟動後端

在 `back` 目錄執行：

```bash
npm install
npm run dev
```

### 步驟 4：驗證連線

呼叫健康檢查：

`GET /health`

成功時應回傳 `ok: true`。  
若失敗，常見代碼：

1. `DB_AUTH_FAILED`：帳號或密碼錯誤。
2. `DB_HOST_NOT_FOUND`：主機名稱錯誤。
3. `DB_TIMEOUT` 或 `DB_UNREACHABLE`：網路或連線參數錯誤。

## 4. 常見誤解

1. 「走 `pg`」不等於沒用 Supabase。  
   只要 `DATABASE_URL` 指向 Supabase 的 PostgreSQL host，就是在使用 Supabase 資料庫。

2. `@supabase/supabase-js` 不是連 Supabase 資料庫的唯一方式。  
   本專案目前是走 PostgreSQL 直連路線（`pg + Prisma`）。

## 5. 不同裝置 clone 後，如何連上同一個 DB 並做 CRUD

### 情境

當你在新裝置 `git clone` 此專案時，因為 `.env` 不會被版控，你一定要在該裝置重新設定環境變數，才會連到同一個 Supabase 資料庫。

### 操作步驟

1. clone 專案後，進入 `back` 目錄並安裝依賴。

```bash
npm install
```

2. 在新裝置建立 `back/.env`，填入同一組 Supabase 連線設定。

```env
DATABASE_URL="postgresql://<user>:<password>@<pooler-host>:<port>/<db>?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<direct-host>:5432/<db>?sslmode=require"
PORT=3000
```

3. 產生 Prisma Client（新裝置首次建議執行）。

```bash
npm run prisma:generate
```

4. 啟動後端。

```bash
npm run dev
```

5. 驗證資料庫連線。
   - 呼叫 `GET /health`。
   - 回傳 `ok: true` 代表已連線成功。

6. 開始 CRUD。
   - 只要 API 可用且 DB 連線成功，呼叫 `/articles` 相關 API 即可對同一個 Supabase 資料庫做 CRUD。

### 團隊建議

1. 僅在指定人員或 CI 環境執行 `prisma migrate`，避免多人同時變更正式 schema。
2. 所有裝置都使用同一個 Supabase 專案連線字串，避免發生資料不一致。

## 6. 欄位（schema）有變更時，開發前要跑什麼

### 什麼時候需要跑 Prisma 指令

當你有以下變更時，開發前要先同步資料庫與 Prisma Client：

1. 新增或刪除欄位。
2. 修改欄位型別。
3. 新增 model 或 relation。
4. 拉下來的程式碼包含新的 migration 檔案。

### 建議流程

在 `back` 目錄執行：

```bash
npm run prisma:migrate
npm run prisma:generate
npm run dev
```

### 只換裝置但 schema 沒改時

若只是新裝置 clone，且 schema 沒有變更，通常執行以下流程即可：

```bash
npm install
npm run prisma:generate
npm run dev
```

### 注意

若未先同步 migration，就直接啟動開發並做 CRUD，常見錯誤是欄位不存在或型別不一致。
