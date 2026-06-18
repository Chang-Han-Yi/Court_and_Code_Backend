require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const {
  ABOUT_DEFAULTS,
  aboutContentKey,
  isAboutPage,
} = require("./content/aboutDefaults");
const {
  CONTACT_CONTENT_KEY,
  CONTACT_DEFAULT,
} = require("./content/contactDefaults");
const {
  EXPERIENCE_DEFAULTS,
  experienceContentKey,
  isExperiencePage,
} = require("./content/experienceDefaults");
const {
  buildOverviewFromEntries,
  normalizeExperiencePayload,
} = require("./content/experienceUtils");

const app = express();
// DIRECT_URL 優先：目前 pooler（DATABASE_URL）若 tenant 未就緒會連線失敗
const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
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

const ARTICLE_CATEGORIES = ["volleyball", "engineer"];

const articleSelect = {
  id: true,
  title: true,
  img: true,
  content: true,
  category: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
};

function normalizeArticlePayload(body) {
  const payload = {};

  if (body.title !== undefined) payload.title = String(body.title).trim();
  if (body.img !== undefined)
    payload.img = body.img ? String(body.img).trim() : null;
  if (body.content !== undefined) payload.content = String(body.content).trim();
  if (body.isPublished !== undefined)
    payload.isPublished = body.isPublished === true || body.isPublished === "true";
  if (body.category !== undefined) {
    const category = String(body.category).trim();
    if (ARTICLE_CATEGORIES.includes(category)) {
      payload.category = category;
    }
  }

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
  const category = String(req.query.category || "").trim();
  if (category && !ARTICLE_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: "Invalid category" });
  }

  try {
    const articles = await prisma.article.findMany({
      where: {
        ...(includeDraft ? {} : { isPublished: true }),
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: articleSelect,
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
      select: articleSelect,
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
        category: payload.category || "volleyball",
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

async function ensureAboutPage(page) {
  const key = aboutContentKey(page);
  const existing = await prisma.siteContent.findUnique({ where: { key } });
  if (existing) return existing.data;

  const created = await prisma.siteContent.create({
    data: { key, data: ABOUT_DEFAULTS[page] },
  });
  return created.data;
}

app.get("/about/:page", async (req, res) => {
  const page = req.params.page;
  if (!isAboutPage(page)) {
    return res.status(404).json({ message: "About page not found" });
  }

  try {
    const data = await ensureAboutPage(page);
    return res.json(data);
  } catch (error) {
    console.error("[about:get] Failed:", String(error?.message || error));
    return res.status(500).json({ message: "Failed to fetch about content" });
  }
});

app.put("/about/:page", async (req, res) => {
  const page = req.params.page;
  if (!isAboutPage(page)) {
    return res.status(404).json({ message: "About page not found" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ message: "Request body must be a JSON object" });
  }

  const key = aboutContentKey(page);
  try {
    const row = await prisma.siteContent.upsert({
      where: { key },
      create: { key, data: req.body },
      update: { data: req.body },
    });
    return res.json(row.data);
  } catch (error) {
    console.error("[about:put] Failed:", String(error?.message || error));
    return res.status(500).json({ message: "Failed to update about content" });
  }
});

async function ensureContact() {
  const existing = await prisma.siteContent.findUnique({
    where: { key: CONTACT_CONTENT_KEY },
  });
  if (existing) return existing.data;

  const legacy = await prisma.siteContent.findUnique({
    where: { key: "contact.overview" },
  });
  if (legacy) {
    const created = await prisma.siteContent.create({
      data: { key: CONTACT_CONTENT_KEY, data: legacy.data },
    });
    return created.data;
  }

  const created = await prisma.siteContent.create({
    data: { key: CONTACT_CONTENT_KEY, data: CONTACT_DEFAULT },
  });
  return created.data;
}

app.get("/contact", async (_req, res) => {
  try {
    const data = await ensureContact();
    return res.json(data);
  } catch (error) {
    console.error("[contact:get] Failed:", String(error?.message || error));
    return res.status(500).json({ message: "Failed to fetch contact content" });
  }
});

app.put("/contact", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ message: "Request body must be a JSON object" });
  }

  try {
    const row = await prisma.siteContent.upsert({
      where: { key: CONTACT_CONTENT_KEY },
      create: { key: CONTACT_CONTENT_KEY, data: req.body },
      update: { data: req.body },
    });
    return res.json(row.data);
  } catch (error) {
    console.error("[contact:put] Failed:", String(error?.message || error));
    return res.status(500).json({ message: "Failed to update contact content" });
  }
});

async function ensureExperiencePage(page) {
  const key = experienceContentKey(page);
  const existing = await prisma.siteContent.findUnique({ where: { key } });
  if (existing) return existing.data;

  const created = await prisma.siteContent.create({
    data: { key, data: EXPERIENCE_DEFAULTS[page] },
  });
  return created.data;
}

async function getExperienceEntries(page) {
  const data = await ensureExperiencePage(page);
  return Array.isArray(data.entries) ? data.entries : [];
}

async function syncExperienceOverview() {
  const volleyballEntries = await getExperienceEntries("volleyball");
  const engineerEntries = await getExperienceEntries("engineer");
  const overview = buildOverviewFromEntries(volleyballEntries, engineerEntries);
  const key = experienceContentKey("overview");

  await prisma.siteContent.upsert({
    where: { key },
    create: { key, data: overview },
    update: { data: overview },
  });

  return overview;
}

app.get("/experience/:page", async (req, res) => {
  const page = req.params.page;
  if (!isExperiencePage(page)) {
    return res.status(404).json({ message: "Experience page not found" });
  }

  try {
    if (page === "overview") {
      const data = await syncExperienceOverview();
      return res.json(data);
    }

    const data = await ensureExperiencePage(page);
    return res.json(data);
  } catch (error) {
    console.error("[experience:get] Failed:", String(error?.message || error));
    return res.status(500).json({ message: "Failed to fetch experience content" });
  }
});

app.put("/experience/:page", async (req, res) => {
  const page = req.params.page;
  if (!isExperiencePage(page)) {
    return res.status(404).json({ message: "Experience page not found" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ message: "Request body must be a JSON object" });
  }
  if (page === "overview") {
    return res.status(400).json({ message: "Overview is generated from volleyball and engineer entries" });
  }

  const key = experienceContentKey(page);
  try {
    const normalized = normalizeExperiencePayload(page, req.body);
    const row = await prisma.siteContent.upsert({
      where: { key },
      create: { key, data: normalized },
      update: { data: normalized },
    });
    await syncExperienceOverview();
    return res.json(row.data);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error("[experience:put] Failed:", String(error?.message || error));
    return res.status(500).json({ message: "Failed to update experience content" });
  }
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
