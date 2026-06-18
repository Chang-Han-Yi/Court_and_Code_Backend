require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const {
  ABOUT_PAGES,
  ABOUT_DEFAULTS,
  aboutContentKey,
} = require("../content/aboutDefaults");
const {
  CONTACT_CONTENT_KEY,
  CONTACT_DEFAULT,
} = require("../content/contactDefaults");
const {
  EXPERIENCE_PAGES,
  EXPERIENCE_DEFAULTS,
  experienceContentKey,
} = require("../content/experienceDefaults");

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const page of ABOUT_PAGES) {
    const key = aboutContentKey(page);
    await prisma.siteContent.upsert({
      where: { key },
      create: { key, data: ABOUT_DEFAULTS[page] },
      update: {},
    });
    console.log(`Seeded ${key}`);
  }

  await prisma.siteContent.upsert({
    where: { key: CONTACT_CONTENT_KEY },
    create: { key: CONTACT_CONTENT_KEY, data: CONTACT_DEFAULT },
    update: { data: CONTACT_DEFAULT },
  });
  console.log(`Seeded ${CONTACT_CONTENT_KEY}`);

  for (const page of EXPERIENCE_PAGES) {
    const key = experienceContentKey(page);
    await prisma.siteContent.upsert({
      where: { key },
      create: { key, data: EXPERIENCE_DEFAULTS[page] },
      update: {},
    });
    console.log(`Seeded ${key}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
