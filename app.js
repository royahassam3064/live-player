(() => {
  "use strict";

  // إظهار الأخطاء داخل الموقع بدلاً من توقفه بصمت
  function showError(message) {
    let box = document.getElementById("app-error");

    if (!box) {
      box = document.createElement("div");
      box.id = "app-error";
      box.style.cssText =
        "background:#8b0000;color:white;padding:12px;margin:12px;" +
        "border-radius:10px;direction:rtl;text-align:center;";

      document.body.prepend(box);
    }

    box.textContent = message;
  }

  // التأكد من تحميل Supabase والإعدادات
  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    showError("تعذر تحميل مكتبة Supabase. تحقق من اتصال الإنترنت.");
    return;
  }

  if (!window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY) {
    showError("إعدادات Supabase غير مكتملة. تحقق من ملف config.js.");
    return;
  }

  let client;

  try {
    client = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_PUBLISHABLE_KEY
    );
  } catch (error) {
    showError("خطأ في إعداد الاتصال بقاعدة البيانات.");
    console.error(error);
    return;
  }

  const list = document.getElementById("matches");
  const dateLabel = document.getElementById("date-label");
  const liveContainer = document.getElementById("live-matches");
  const newsContainer = document.getElementById("news-list");
  const refreshButton = document.getElementById("refresh-news");

  if (!list || !dateLabel || !liveContainer || !newsContainer || !refreshButton) {
    showError("بعض عناصر الصفحة غير موجودة. تحقق من ملف index.html.");
    return;
  }

  let selectedDay = 0;
  let allMatches = [];
  let newsLoaded = false;

  // تاريخ بغداد
  function baghdadDate(date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function shiftDate(ymd, amount) {
    const [year, month, day] = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
    return date.toISOString().slice(0, 10);
  }

  function formatTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "--:--";

    return new Intl.DateTimeFormat("ar-IQ", {
      timeZone: "Asia/Baghdad",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function formatDate(ymd) {
    return new Intl.DateTimeFormat("ar-IQ", {
      timeZone: "Asia/Baghdad",
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(new Date(`${ymd}T12:00:00+03:00`));
  }

  // حماية النصوص قبل عرضها في HTML
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function getStatus(match) {
    const status = String(match.match_status || "").toUpperCase();
    const now = Date.now();
    const start = new Date(match.match_time).getTime();

    const knownStatuses = {
      FINISHED: ["انتهت", "finished"],
      AWARDED: ["انتهت", "finished"],
      IN_PLAY: ["مباشر", "live"],
      PAUSED: ["استراحة", "paused"],
      SUSPENDED: ["متوقفة مؤقتاً", "paused"],
      POSTPONED: ["تأجلت", "postponed"],
      CANCELLED: ["أُلغيت", "cancelled"],
      TIMED: ["موعد المباراة محدد", "upcoming"],
      SCHEDULED: ["لم تبدأ بعد", "upcoming"]
    };

    if (knownStatuses[status]) {
      return {
        text: knownStatuses[status][0],
        type: knownStatuses[status][1]
      };
    }

    if (Number.isFinite(start)) {
      if (now < start - 60 * 60 * 1000) {
        return { text: "لم تبدأ بعد", type: "upcoming" };
      }

      if (now < start) {
        return { text: "تبدأ قريباً", type: "upcoming" };
      }

      if (now <= start + 4 * 60 * 60 * 1000) {
        return { text: "مباشر / جارية", type: "live" };
      }

      return { text: "انتهت", type: "finished" };
    }

    return { text: "غير محدد", type: "upcoming" };
  }

  // بطاقة المباراة
  function card(match, showWatch = false) {
    const now = Date.now();
    const start = new Date(match.match_time).getTime();
    const status = getStatus(match);

    const canWatch =
      showWatch &&
      Boolean(match.stream_url) &&
      Number.isFinite(start) &&
      !["finished", "cancelled", "postponed"].includes(status.type) &&
      now >= start - 60 * 60 * 1000 &&
      now <= start + 4 * 60 * 60 * 1000;

    const hasScore =
      match.home_score !== null &&
      match.home_score !== undefined &&
      match.away_score !== null &&
      match.away_score !== undefined;

    const homeLogo = match.home_logo
      ? `<img src="${escapeHtml(match.home_logo)}" alt="" loading="lazy">`
      : `<span class="logo-placeholder">⚽</span>`;

    const awayLogo = match.away_logo
      ? `<img src="${escapeHtml(match.away_logo)}" alt="" loading="lazy">`
      : `<span class="logo-placeholder">⚽</span>`;

    return `
      <article class="match-card">
        <div class="match-time">
          ${formatTime(match.match_time)}
        </div>

        <div class="teams">
          <div class="team">
            ${homeLogo}
            <strong>${escapeHtml(match.home_team)}</strong>
          </div>

          <div class="vs">
            ${
              hasScore
                ? `<strong>${escapeHtml(match.home_score)} - ${escapeHtml(match.away_score)}</strong>`
                : "VS"
            }
          </div>

          <div class="team">
            ${awayLogo}
            <strong>${escapeHtml(match.away_team)}</strong>
          </div>
        </div>

        <div class="match-bottom">
          <span class="status status-${status.type}">
            ${status.text}
          </span>

          ${
            canWatch
              ? `<a class="watch-btn"
                   href="watch.html?id=${encodeURIComponent(match.id)}">
                   مشاهدة البث
                 </a>`
              : showWatch && !["finished", "cancelled", "postponed"].includes(status.type)
                ? `<span class="stream-wait">
                     ${match.stream_url
                       ? "البث غير متاح حالياً"
                       : "لا يوجد رابط بث حالياً"}
                   </span>`
                : ""
          }
        </div>
      </article>
    `;
  }

  // عرض مباريات اليوم أو الأمس أو الغد
  function renderMatches() {
    const today = baghdadDate(new Date());
    const target = shiftDate(today, selectedDay);

    dateLabel.textContent = formatDate(target);

    const rows = allMatches
      .filter(match => {
        const date = new Date(match.match_time);

        return (
          !Number.isNaN(date.getTime()) &&
          baghdadDate(date) === target
        );
      })
      .sort((a, b) =>
        new Date(a.match_time) - new Date(b.match_time)
      );

    list.innerHTML = rows.length
      ? rows.map(match => card(match)).join("")
      : `<p class="notice">ماكو مباريات مضافة لهذا اليوم حالياً.</p>`;
  }

  // عرض البث المباشر
  function renderLive() {
    const now = Date.now();

    const rows = allMatches
      .filter(match => {
        const start = new Date(match.match_time).getTime();
        const status = getStatus(match);

        return (
          Boolean(match.stream_url) &&
          Number.isFinite(start) &&
          !["finished", "cancelled", "postponed"].includes(status.type) &&
          now >= start - 60 * 60 * 1000 &&
          now <= start + 4 * 60 * 60 * 1000
        );
      })
      .sort((a, b) =>
        new Date(a.match_time) - new Date(b.match_time)
      );

    liveContainer.innerHTML = rows.length
      ? rows.map(match => card(match, true)).join("")
      : `<p class="notice">لا توجد مباريات متاحة للبث المباشر حالياً.</p>`;
  }

  // تحميل المباريات من Supabase
  async function loadMatches() {
    list.innerHTML =
      `<p class="notice">جارٍ تحميل المباريات...</p>`;

    try {
      const { data, error } = await client
        .from("matches")
        .select(`
          id,
          home_team,
          away_team,
          home_logo,
          away_logo,
          match_time,
          stream_url,
          match_status,
          home_score,
          away_score
        `)
        .order("match_time", { ascending: true });

      if (error) throw error;

      allMatches = Array.isArray(data) ? data : [];

      renderMatches();
      renderLive();

    } catch (error) {
      console.error("Matches error:", error);

      list.innerHTML = `
        <p class="notice error">
          تعذر تحميل المباريات: ${escapeHtml(error.message)}
        </p>
      `;

      liveContainer.innerHTML =
        `<p class="notice error">تعذر تحميل البث حالياً.</p>`;
    }
  }

  // تحميل الأخبار
  async function loadNews(force = false) {
    if (newsLoaded && !force) return;

    newsContainer.innerHTML =
      `<p class="notice">جارٍ تحميل الأخبار العربية...</p>`;

    refreshButton.disabled = true;

    try {
      const { data, error } = await client.functions.invoke(
        "football-news"
      );

      if (error) throw error;

      if (!data || !Array.isArray(data.articles)) {
        throw new Error("استجابة الأخبار غير صحيحة");
      }

      if (!data.articles.length) {
        newsContainer.innerHTML =
          `<p class="notice">لا توجد أخبار متاحة حالياً.</p>`;

        newsLoaded = true;
        return;
      }

      newsContainer.innerHTML = data.articles.map(article => `
        <article class="news-card">
          <h3>${escapeHtml(article.title)}</h3>

          <div class="news-meta">
            ${escapeHtml(article.source || "مصدر إخباري")}
            ${
              article.published
                ? " • " + escapeHtml(article.published)
                : ""
            }
          </div>

          <a class="news-link"
             href="${escapeHtml(article.link)}"
             target="_blank"
             rel="noopener noreferrer">
            قراءة الخبر ←
          </a>
        </article>
      `).join("");

      newsLoaded = true;

    } catch (error) {
      console.error("News error:", error);

      newsContainer.innerHTML = `
        <p class="notice error">
          تعذر تحميل الأخبار حالياً. حاول مرة أخرى لاحقاً.
        </p>
      `;

    } finally {
      refreshButton.disabled = false;
    }
  }

  // التنقل بين الأقسام
  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;

      document.querySelectorAll(".page").forEach(section => {
        section.classList.toggle(
          "active",
          section.id === `page-${page}`
        );
      });

      document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      if (page === "news") loadNews();
      if (page === "live") renderLive();

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  });

  // التنقل بين الأيام
  document.querySelectorAll(".day-tab").forEach(button => {
    button.addEventListener("click", () => {
      selectedDay = Number(button.dataset.day);

      document.querySelectorAll(".day-tab").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      renderMatches();
    });
  });

  // تحديث الأخبار
  refreshButton.addEventListener("click", () => {
    loadNews(true);
  });

  // بدء تحميل البيانات
  loadMatches();

  // تحديث حالة المباريات كل دقيقة
  setInterval(() => {
    renderMatches();
    renderLive();
  }, 60 * 1000);

  // إعادة السماح بتحديث الأخبار بعد 15 دقيقة
  setInterval(() => {
    newsLoaded = false;
  }, 15 * 60 * 1000);

})();
