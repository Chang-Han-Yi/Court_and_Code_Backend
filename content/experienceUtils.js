const crypto = require("crypto");
const { EXPERIENCE_DEFAULTS } = require("./experienceDefaults");

function normalizeMonth(value) {
  if (value == null || value === "") return null;
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month;
}

function getStartTimestamp(entry) {
  const year = Number(entry?.year);
  const month = normalizeMonth(entry?.month) ?? 0;
  if (!Number.isFinite(year)) return 0;
  return year * 100 + month;
}

function normalizeExperienceEntry(entry = {}) {
  const year = String(entry.year ?? "").trim();
  const month = normalizeMonth(entry.month);
  const isOngoing = Boolean(entry.isOngoing);
  const endYear = isOngoing ? "" : String(entry.endYear ?? "").trim();
  const endMonth = isOngoing || !endYear ? null : normalizeMonth(entry.endMonth);

  return {
    id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : crypto.randomUUID(),
    year,
    month,
    isOngoing,
    endYear,
    endMonth,
    title: String(entry.title ?? "").trim(),
    subtitle: String(entry.subtitle ?? "").trim(),
    description: String(entry.description ?? "").trim(),
    sortOrder: Number.isFinite(Number(entry.sortOrder)) ? Number(entry.sortOrder) : 0,
  };
}

function compareExperienceEntries(a, b) {
  const startDiff = getStartTimestamp(b) - getStartTimestamp(a);
  if (startDiff !== 0) return startDiff;
  return (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
}

function sortExperienceEntries(entries = []) {
  return [...entries].sort(compareExperienceEntries);
}

function buildOverviewFromEntries(volleyballEntries, engineerEntries) {
  const sections = EXPERIENCE_DEFAULTS.overview.sections.map((section) => ({
    ...section,
    entries: section.key === "volleyball" ? volleyballEntries : engineerEntries,
  }));

  return { sections };
}

function normalizeExperiencePayload(page, body) {
  if (page === "overview") {
    return buildOverviewFromEntries(
      sortExperienceEntries(body?.sections?.find((s) => s.key === "volleyball")?.entries ?? []),
      sortExperienceEntries(body?.sections?.find((s) => s.key === "engineer")?.entries ?? [])
    );
  }

  const entries = Array.isArray(body?.entries) ? body.entries.map(normalizeExperienceEntry) : [];
  const invalidEntry = entries.find((entry) => !entry.year || !entry.title);
  if (invalidEntry) {
    const error = new Error("Each experience entry requires year and title");
    error.statusCode = 400;
    throw error;
  }

  return { entries: sortExperienceEntries(entries) };
}

module.exports = {
  buildOverviewFromEntries,
  normalizeExperiencePayload,
  sortExperienceEntries,
};
