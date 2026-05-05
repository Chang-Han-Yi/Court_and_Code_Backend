require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const port = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || "").startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    return cb(null, true);
  },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

function normalizeArticlePayload(body) {
  const payload = {};

  if (body.title !== undefined) payload.title = String(body.title).trim();
  if (body.img !== undefined)
    payload.img = body.img ? String(body.img).trim() : null;
  if (body.content !== undefined) payload.content = String(body.content).trim();
  if (body.isPublished !== undefined)
    payload.isPublished = body.isPublished === true || body.isPublished === "true";

  return payload;
}

function validateRequiredFields(payload, requiredFields) {
  const missingFields = requiredFields.filter((field) => !payload[field]);
  return missingFields;
}

app.post("/uploads", (req, res) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: error.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Missing image file" });
    }
    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    return res.status(201).json({ url: imageUrl });
  });
});

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (error) {
    const errorText = String(error?.message || "");
    let errorCode = "DB_CONNECTION_FAILED";

    if (errorText.includes("Can't reach database server")) {
      errorCode = "DB_UNREACHABLE";
    } else if (errorText.includes("ENOTFOUND")) {
      errorCode = "DB_HOST_NOT_FOUND";
    } else if (errorText.includes("ETIMEDOUT")) {
      errorCode = "DB_TIMEOUT";
    } else if (
      errorText.toLowerCase().includes("password authentication failed")
    ) {
      errorCode = "DB_AUTH_FAILED";
    }

    console.error("[health] Database check failed:", errorText);

    res.status(500).json({
      ok: false,
      error: "Database connection failed",
      code: errorCode,
    });
  }
});

app.get("/articles", async (req, res) => {
  const includeDraft = req.query.includeDraft === "1";
  try {
    const articles = await prisma.article.findMany({
      where: includeDraft ? {} : { isPublished: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        img: true,
        content: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ data: articles });
  } catch (error) {
    console.error(
      "[articles] Failed to fetch:",
      String(error?.message || error),
    );
    return res.status(500).json({ message: "Failed to fetch articles" });
  }
});

app.get("/articles/:id", async (req, res) => {
  const includeDraft = req.query.includeDraft === "1";
  try {
    const article = await prisma.article.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        title: true,
        img: true,
        content: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }
    if (!includeDraft && !article.isPublished) {
      return res.status(404).json({ message: "Article not found" });
    }

    return res.json(article);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch article" });
  }
});

app.post("/articles", async (req, res) => {
  const id = String(req.body.id || "").trim();
  const payload = normalizeArticlePayload(req.body);
  const missingFields = validateRequiredFields({ id, ...payload }, [
    "id",
    "title",
    "content",
  ]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Missing required fields",
      fields: missingFields,
    });
  }

  try {
    const article = await prisma.article.create({
      data: {
        id,
        title: payload.title,
        img: payload.img || null,
        content: payload.content,
        isPublished: payload.isPublished ?? false,
      },
    });

    return res.status(201).json(article);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Article id already exists" });
    }
    console.error("[articles:create] Failed:", String(error?.message || error));
    return res.status(500).json({ message: "Failed to create article" });
  }
});

app.put("/articles/:id", async (req, res) => {
  const payload = normalizeArticlePayload(req.body);

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  try {
    const article = await prisma.article.update({
      where: { id: req.params.id },
      data: payload,
    });

    return res.json(article);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Article not found" });
    }
    console.error("[articles:update] Failed:", String(error?.message || error));
    return res.status(500).json({ message: "Failed to update article" });
  }
});

app.delete("/articles/:id", async (req, res) => {
  try {
    await prisma.article.delete({
      where: { id: req.params.id },
    });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Article not found" });
    }
    console.error("[articles:delete] Failed:", String(error?.message || error));
    return res.status(500).json({ message: "Failed to delete article" });
  }
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
