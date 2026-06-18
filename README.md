# Court_and_Code · 後端

**Court_and_Code** 的 **後端 API 專案**，提供文章 CRUD、圖片上傳與資料庫連線。

> 本 repo 為全端工作區中的 **後端一半**。前端位於同層的 [`Court_and_Code_Frontend`](../Court_and_Code_Frontend/)。  
> 整體說明、同時啟動方式與 API 功能對照表見 [根目錄 README](../README.md)。

## 與前端的關係

前端透過 `VITE_API_BASE_URL`（預設 `http://localhost:3000`）呼叫本專案 API。

**建議啟動順序：**

1. 本專案（後端 + 資料庫連線）
2. 前端 `Court_and_Code_Frontend`

若後端未啟動，前端的文章列表、詳情與後台管理會載入失敗。

## 技術堆疊

- Node.js + [Express 5](https://expressjs.com/)
- [Prisma](https://www.prisma.io/) + PostgreSQL（[Supabase](https://supabase.com/)）
- `pg` 連線池 + `@prisma/adapter-pg`
- [Multer](https://github.com/expressjs/multer) 圖片上傳

## 環境建置

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定 `.env`

在 `Court_and_Code_Backend` 目錄建立 `.env`：

```env
DATABASE_URL="postgresql://<user>:<password>@<pooler-host>:<port>/<db>?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<direct-host>:5432/<db>?sslmode=require"
PORT=3000
```

- `DATABASE_URL`：API 執行用（建議 Supabase **Pooler** 連線）
- `DIRECT_URL`：`prisma migrate` 用（建議 Supabase **Direct** 連線）

### 3. 產生 Prisma Client

```bash
npm run prisma:generate
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

預設：`http://localhost:3000`

### 5. 驗證連線

```bash
curl http://localhost:3000/health
```

成功時回傳 `{ "ok": true }`。

## API 端點

| 方法 | 路徑 | 說明 | 前端使用處 |
|------|------|------|------------|
| `GET` | `/health` | 健康檢查（含 DB） | 維運／除錯用 |
| `GET` | `/articles` | 文章列表；`?includeDraft=1` 含草稿 | 前台列表、內容總覽、後台 Dashboard |
| `GET` | `/articles/:id` | 單篇文章；`?includeDraft=1` 可讀草稿 | 文章詳情、後台編輯頁 |
| `POST` | `/articles` | 新增文章 | 後台新增文章 |
| `PUT` | `/articles/:id` | 更新文章（部分欄位） | 後台編輯、上架／下架 |
| `DELETE` | `/articles/:id` | 刪除文章 | 後台 Dashboard |
| `POST` | `/uploads` | 上傳圖片（`image` 欄位，最大 5MB） | 後台新增／編輯文章封面 |
| — | `/uploads/:filename` | 靜態圖片存取 | 文章封面 URL |

### 文章欄位（Article）

| 欄位 | 說明 |
|------|------|
| `id` | 自訂字串 ID（前端以 UUID 產生） |
| `title` | 標題 |
| `content` | 內文 |
| `img` | 封面圖 URL（可為 null） |
| `isPublished` | 是否上架（預設 `false`） |
| `createdAt` / `updatedAt` | 建立與更新時間 |

前台 `GET /articles` 預設只回傳 `isPublished: true` 的文章。

## 架構說明

本專案為 `Express + Prisma + pg` 架構：

1. 以 `pg` 的 `Pool` 讀取 `DATABASE_URL` 建立連線池。
2. 透過 `@prisma/adapter-pg` 交給 Prisma Client 使用。
3. 將 Supabase 作為線上 PostgreSQL 資料庫（未使用 `@supabase/supabase-js` SDK）。

## Schema 變更時

```bash
npm run prisma:migrate
npm run prisma:generate
npm run dev
```

僅換裝置、schema 未變時：

```bash
npm install
npm run prisma:generate
npm run dev
```

## 新裝置 Clone 後

`.env` 不會進版控，需在新裝置重新建立 `.env` 並填入同一組 Supabase 連線字串，各裝置才會連到同一資料庫。

## 啟動排錯

| 狀況 | 處理方式 |
|------|----------|
| `Cannot find module 'multer'` | `npm install` |
| `Cannot find module '.prisma/client/default'` | `npm run prisma:generate` |
| `/health` 回傳 `DB_AUTH_FAILED` | 檢查 `.env` 帳密 |
| `/health` 回傳 `DB_HOST_NOT_FOUND` | 檢查 Supabase 連線 host |
| `/health` 回傳 `DB_TIMEOUT` | 檢查網路、`sslmode=require`、port |

## 相關文件

- [根目錄 README（雙專案總覽）](../README.md)
- [前端 README](../Court_and_Code_Frontend/README.md)
