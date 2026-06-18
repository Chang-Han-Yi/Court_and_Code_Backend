const EXPERIENCE_PAGES = ["overview", "volleyball", "engineer"];

const VOLLEYBALL_ENTRIES = [
  {
    id: "vb-2024-03-uiva",
    year: "2024",
    month: 3,
    title: "大專盃甲級聯賽",
    subtitle: "先發主攻手",
    description:
      "負責接發球穩定與四號位終結，在準決賽關鍵局調整輪次與攻擊節奏，帶領隊伍維持系統運作。",
  },
  {
    id: "vb-2023-11-national",
    year: "2023",
    month: 11,
    title: "全國排球錦標賽",
    subtitle: "主攻手",
    description:
      "決勝局透過戰術口令一致與攔網站位，完成數次關鍵攔網與反擊，累積高張力比賽經驗。",
  },
];

const ENGINEER_ENTRIES = [
  {
    id: "en-2025-01-court-code",
    year: "2025",
    month: 1,
    title: "Court_and_Code（本專案）",
    subtitle: "個人專案",
    description:
      "Vue 3 + JavaScript 前台、Express + Prisma 後台 API、Supabase PostgreSQL，實作文章 CMS 與雙身分內容架構。",
  },
  {
    id: "en-2024-06-frontend",
    year: "2024",
    month: 6,
    title: "前端工程師 / 軟體開發",
    subtitle: "網站架構與開發",
    description:
      "負責網站前端架構設計、系統開發與維護，專注於提供使用者清晰的操作流程與可維護的程式結構。",
  },
];

const EXPERIENCE_DEFAULTS = {
  overview: {
    sections: [
      {
        key: "volleyball",
        title: "排球經歷",
        link: { to: "/experience/volleyball", label: "完整排球經歷" },
        entries: VOLLEYBALL_ENTRIES,
      },
      {
        key: "engineer",
        title: "工程經歷",
        link: { to: "/experience/engineer", label: "完整工程經歷" },
        entries: ENGINEER_ENTRIES,
      },
    ],
  },
  volleyball: {
    entries: VOLLEYBALL_ENTRIES,
  },
  engineer: {
    entries: ENGINEER_ENTRIES,
  },
};

function experienceContentKey(page) {
  return `experience.${page}`;
}

function isExperiencePage(page) {
  return EXPERIENCE_PAGES.includes(page);
}

module.exports = {
  EXPERIENCE_PAGES,
  EXPERIENCE_DEFAULTS,
  experienceContentKey,
  isExperiencePage,
};
