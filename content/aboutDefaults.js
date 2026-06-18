const ABOUT_PAGES = ["overview", "volleyball", "engineer"];

const ABOUT_DEFAULTS = {
  overview: {
    cards: [
      {
        badge: { label: "排球", class: "bg-warning text-dark" },
        title: "場上的我",
        description:
          "在競技中追求節奏與團隊默契，把每一次訓練與比賽當成累積。更多關於場上角色與理念，請見排球分頁。",
        link: { to: "/about/volleyball", label: "關於 · 排球" },
      },
      {
        badge: { label: "工程", class: "bg-primary" },
        title: "螢幕前的我",
        description:
          "用程式把想法變成可用的介面與系統，重視結構清楚與可維護。更多開發背景與技能，請見工程分頁。",
        link: { to: "/about/engineer", label: "關於 · 工程" },
      },
    ],
  },
  volleyball: {
    sections: [
      {
        title: "場上角色",
        body: "主攻手出身，重視接發球穩定與攻擊終結。在隊伍中扮演串連節奏、帶動士氣的角色，並在關鍵局保持專注執行戰術。",
      },
      {
        title: "運動理念",
        body: "個人表現建立在團隊溝通與信任之上；透過平時訓練累積，在比賽中把判斷轉成穩定的出手與防守。",
      },
    ],
  },
  engineer: {
    skills: ["Vue.js", "JavaScript", "HTML / CSS", "Bootstrap"],
    sections: [
      {
        title: "開發方向",
        body: "專注前端架構與使用者體驗，喜歡把需求拆成清楚的元件與資料流。本網站即為 Vue 3 + Vite 實作，並串接後端 CMS 管理排球文章。",
      },
    ],
  },
};

function aboutContentKey(page) {
  return `about.${page}`;
}

function isAboutPage(page) {
  return ABOUT_PAGES.includes(page);
}

module.exports = {
  ABOUT_PAGES,
  ABOUT_DEFAULTS,
  aboutContentKey,
  isAboutPage,
};
