require("dotenv").config();
const express = require("express");
const cors = require("cors");
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

app.use(cors());
app.use(express.json());

function normalizeArticlePayload(body) {
  const payload = {};

  if (body.title !== undefined) payload.title = String(body.title).trim();
  if (body.img !== undefined) payload.img = body.img ? String(body.img).trim() : null;
  if (body.content !== undefined) payload.content = String(body.content).trim();

  return payload;
}

function validateRequiredFields(payload, requiredFields) {
  const missingFields = requiredFields.filter((field) => !payload[field]);
  return missingFields;
}

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (error) {
    const errorText = String(error?.message || "");
    let errorCode = "DB_CONNECTION_FAILED";

    if (errorText.includes("Can't reach database server")) {
      errorCode = "DB_UNREACHABLE";
    } else if (errorText.toLowerCase().includes("password authentication failed")) {
      errorCode = "DB_AUTH_FAILED";
    }

    res.status(500).json({ ok: false, error: "Database connection failed", code: errorCode });
  }
});

app.get("/articles", async (_req, res) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        img: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ data: articles });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch articles" });
  }
});

app.get("/articles/:id", async (req, res) => {
  try {
    const article = await prisma.article.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        title: true,
        img: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!article) {
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
  const missingFields = validateRequiredFields({ id, ...payload }, ["id", "title", "content"]);

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
      },
    });

    return res.status(201).json(article);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Article id already exists" });
    }
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
    return res.status(500).json({ message: "Failed to delete article" });
  }
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
