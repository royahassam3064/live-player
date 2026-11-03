(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let allMatches = [];
  let selectedDay = 0;
  let supabaseClient = null;

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[ch]));
  }

  function baghdadDate(offset = 0) {
    const now = new Date(Date.now() + offset * 86400000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now);
  }

  function showPage(name) {
    document.querySelectorAll(".page").forEach(p => {
      p.classList.toggle("active", p.id === `page-${name}`);
    });

    document.querySelectorAll("[data-page]").forEach(b => {
      b.classList.toggle("active", b.dataset.page === name);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initNavigation() {
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-page]");
      if (!button) return;

      event.preventDefault();
      showPage(button.dataset.page);
    });

    document.querySelectorAll("[data-day]").forEach(button => {
      button.addEventListener("click", () => {
        selectedDay = Number(button.dataset.day);

        document.querySelectorAll("[data-day]").forEach(b => {
          b.classList.toggle("selected", b === button);
        });

        renderMatches();
      });
    });
  }

  function matchCard(match) {
    const home = safeText(match.home_team || "الفريق الأول");
    const away = safeText(match.away_team || "الفريق الثاني");

    const homeLogo = match.home_logo
      ? `<img src="${safeText(match.home_logo)}" alt="" onerror="this.style.display='none'">`
      : "";

    const awayLogo = match.away_logo
      ? `<img src="${safeText(match.away_logo)}" alt="" onerror="this.style.display='none'">`
      : "";

    const status = safeText(match.match_status || "");

    const score = match.home_score != null && match.away_score != null
      ? `<strong class="score">${match.home_score} - ${match.away_score}</strong>`
      : "";

    const time = safeText(match.match_time || "");
    const live = /live|in_play|1h|2h/i.test(status);

    return `
      <article class="match-card">
        <div class="match-meta">
          <span>${safeText(match.competition || "مباراة")}</span>
          <span class="${live ? "live-label" : ""}">${live ? "مباشر" : (status || time || "قريباً")}</span>
        </div>

        <div class="teams">
          <div class="team">${homeLogo}<b>${home}</b></div>
          <div class="match-middle">${score || `<span class="vs">VS</span>`}</div>
          <div class="team">${awayLogo}<b>${away}</b></div>
        </div>

        ${match.stream_url
          ? `<a class="watch-btn" href="watch.html?id=${encodeURIComponent(match.id)}">مشاهدة البث</a>`
          : ""}
      </article>`;
  }

  function renderMatches() {
    const date = baghdadDate(selectedDay);

    const dayMatches = allMatches.filter(m => {
      if (!m.match_time) return selectedDay === 0;

      const parsed = new Date(m.match_time);

      if (Number.isNaN(parsed.getTime())) {
        return String(m.match_time).slice(0, 10) === date;
      }

      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Baghdad",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(parsed) === date;
    });

    const html = dayMatches.length
      ? dayMatches.map(matchCard).join("")
      : `<div class="notice">ماكو مباريات بهذا اليوم حالياً.</div>`;

    if ($("matches-list")) $("matches-list").innerHTML = html;

    if ($("home-matches")) {
      $("home-matches").innerHTML =
        dayMatches.slice(0, 3).map(matchCard).join("") ||
        `<div class="notice">ماكو مباريات اليوم حالياً.</div>`;
    }

    if ($("live-list")) {
      const liveMatches = allMatches.filter(m =>
        /live|in_play|1h|2h/i.test(String(m.match_status || ""))
      );

      $("live-list").innerHTML =
        liveMatches.map(matchCard).join("") ||
        `<div class="notice">ماكو مباريات مباشرة حالياً.</div>`;
    }
  }

  async function loadMatches() {
    const home = $("home-matches");
    const list = $("matches-list");

    if (
      !window.supabase ||
      !window.SUPABASE_URL ||
      !window.SUPABASE_PUBLISHABLE_KEY
    ) {
      const msg = `<div class="notice">تأكد من إعدادات config.js واتصال Supabase.</div>`;
      if (home) home.innerHTML = msg;
      if (list) list.innerHTML = msg;
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_PUBLISHABLE_KEY
      );

      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("انتهى وقت الاتصال")), 12000);
      });

      const request = supabaseClient
        .from("matches")
        .select("*")
        .order("match_time", { ascending: true })
        .limit(150);

      const { data, error } = await Promise.race([request, timeout]);

      if (error) throw error;

      allMatches = Array.isArray(data) ? data : [];
      renderMatches();

    } catch (error) {
      console.error("Kora TV matches:", error);

      const msg = `
        <div class="notice">
          تعذر تحميل المباريات. تحقق من الإنترنت أو إعدادات Supabase ثم حدّث الصفحة.
        </div>`;

      if (home) home.innerHTML = msg;
      if (list) list.innerHTML = msg;
      if ($("live-list")) $("live-list").innerHTML = msg;
    }
  }

  async function loadNews() {
    const box = $("news-list");
    if (!box || !supabaseClient) return;

    try {
      const { data, error } = await supabaseClient.functions.invoke("football-news");

      if (error) throw error;

      const articles = Array.isArray(data)
        ? data
        : (data?.articles || data?.news || []);

      box.innerHTML = articles.length
        ? articles.slice(0, 20).map(item => `
          <a class="news-card" href="${safeText(item.url || "#")}" target="_blank" rel="noopener">
            <b>${safeText(item.title || "خبر رياضي")}</b>
            <span>${safeText(item.description || "")}</span>
          </a>
        `).join("")
        : `<div class="notice">ماكو أخبار متاحة حالياً.</div>`;

    } catch (error) {
      console.warn("Kora TV news:", error);
      box.innerHTML = `<div class="notice">الأخبار غير متاحة حالياً.</div>`;
    }
  }

  function initSettings() {
    const root = document.documentElement;

    const saved = (key, fallback) =>
      localStorage.getItem("kora_" + key) || fallback;

    const theme = $("theme-setting");
    const accent = $("accent-setting");
    const font = $("font-setting");
    const bold = $("bold-setting");

    if (!theme) return;

    theme.value = saved("theme", "dark");
    accent.value = saved("accent", "#7657f6");
    font.value = saved("font", "16");
    bold.checked = saved("bold", "false") === "true";

    function apply() {
      root.dataset.theme = theme.value;
      root.style.setProperty("--accent", accent.value);
      root.style.setProperty("--base-font", font.value + "px");
      root.classList.toggle("heavy-text", bold.checked);

      localStorage.setItem("kora_theme", theme.value);
      localStorage.setItem("kora_accent", accent.value);
      localStorage.setItem("kora_font", font.value);
      localStorage.setItem("kora_bold", String(bold.checked));
    }

    [theme, accent, font, bold].forEach(el => {
      el.addEventListener("change", apply);
    });

    apply();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initSettings();

    loadMatches().then(loadNews);
  });
})();
