javascript
(() => {
  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );

  const list = document.getElementById("matches");
  const dateLabel = document.getElementById("date-label");

  let selectedDay = 0;
  let allMatches = [];
  let newsLoaded = false;

  const baghdadDate = date => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);

  const shiftDate = (ymd, amount) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + amount, 12));
    return date.toISOString().slice(0, 10);
  };

  const formatTime = value => new Intl.DateTimeFormat("ar-IQ", {
    timeZone: "Asia/Baghdad",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

  const formatDate = ymd => new Intl.DateTimeFormat("ar-IQ", {
    timeZone: "Asia/Baghdad",
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(`${ymd}T12:00:00+03:00`));

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  function getStatus(match) {
    const status = String(match.match_status || "").toUpperCase();
    const now = Date.now();
    const start = new Date(match.match_time).getTime();

    if (["FINISHED", "AWARDED"].includes(status)) {
      return { text: "انتهت", type: "finished" };
    }

    if (status === "IN_PLAY") {
      return { text: "مباشر", type: "live" };
    }

    if (status === "PAUSED") {
      return { text: "استراحة", type: "paused" };
    }

    if (status === "SUSPENDED") {
      return { text: "متوقفة مؤقتاً", type: "paused" };
    }

    if (status === "POSTPONED") {
      return { text: "تأجلت", type: "postponed" };
    }

    if (status === "CANCELLED") {
      return { text: "أُلغيت", type: "cancelled" };
    }

    if (status === "TIMED") {
      return { text: "موعد المباراة محدد", type: "upcoming" };
    }

    if (status === "SCHEDULED") {
      return { text: "لم تبدأ بعد", type: "upcoming" };
    }

    // حالات المباريات التي لا تحتوي على match_status
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

  function card(match, showWatch = false) {
    const now = Date.now();
    const start = new Date(match.match_time).getTime();
    const status = getStatus(match);

    const canWatch =
      showWatch &&
      !!match.stream_url &&
      status.type !== "finished" &&
      status.type !== "cancelled" &&
      status.type !== "postponed" &&
      now >= start - 60 * 60 * 1000 &&
      now <= start + 4 * 60 * 60 * 1000;

    const hasScore =
      match.home_score !== null &&
      match.home_score !== undefined &&
      match.away_score !== null &&
      match.away_score !== undefined;

    const homeLogo = match.home_logo
      ? `<img src="${escapeAttr(match.home_logo)}" alt="" loading="lazy">`
      : `<span class="logo-placeholder">⚽</span>`;

    const awayLogo = match.away_logo
      ? `<img src="${escapeAttr(match.away_logo)}" alt="" loading="lazy">`
      : `<span class="logo-placeholder">⚽</span>`;

    return `
      <article class="match-card">
        <div class="match-time">${formatTime(match.match_time)}</div>

        <div class="teams">
          <div class="team">
            ${homeLogo}
            <strong>${escapeHtml(match.home_team)}</strong>
          </div>

          <div class="vs">
            ${hasScore
              ? `<strong>${match.home_score} - ${match.away_score}</strong>`
              : "VS"}
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

          ${canWatch
            ? `<a class="watch-btn"
                 href="watch.html?id=${encodeURIComponent(match.id)}">
                 مشاهدة البث
               </a>`
            : showWatch && status.type !== "finished"
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

  function renderMatches() {
    const today = baghdadDate(new Date());
    const target = shiftDate(today, selectedDay);

    dateLabel.textContent = formatDate(target);

    const rows = allMatches
      .filter(m => baghdadDate(new Date(m.match_time)) === target)
      .sort((a, b) =>
        new Date(a.match_time) - new Date(b.match_time)
      );

    list.innerHTML = rows.length
      ? rows.map(m => card(m, false)).join("")
      : `<p class="notice">ماكو مباريات مضافة لهذا اليوم حالياً.</p>`;
  }

  function renderLive() {
    const container = document.getElementById("live-matches");
    const now = Date.now();

    const rows = allMatches
      .filter(m => {
        const start = new Date(m.match_time).getTime();
        const status = getStatus(m);

        return m.stream_url &&
          status.type !== "finished" &&
          status.type !== "cancelled" &&
          status.type !== "postponed" &&
          now >= start - 60 * 60 * 1000 &&
          now <= start + 4 * 60 * 60 * 1000;
      })
      .sort((a, b) =>
        new Date(a.match_time) - new Date(b.match_time)
      );

    container.innerHTML = rows.length
      ? rows.map(m => card(m, true)).join("")
      : `<p class="notice">لا توجد مباريات متاحة للبث المباشر حالياً.</p>`;
  }

  async function loadMatches() {
    list.innerHTML = `<p class="notice">جارٍ تحميل المباريات...</p>`;

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

    if (error) {
      list.innerHTML =
        `<p class="notice error">تعذر تحميل المباريات: ${escapeHtml(error.message)}</p>`;
      return;
    }

    allMatches = data || [];

    renderMatches();
    renderLive();
  }

  async function loadNews(force = false) {
    const container = document.getElementById("news-list");

    if (newsLoaded && !force) return;

    container.innerHTML =
      `<p class="notice">جارٍ تحميل الأخبار العربية...</p>`;

    const { data, error } = await client.functions.invoke(
      "football-news"
    );

    if (error || !data || !Array.isArray(data.articles)) {
      container.innerHTML =
        `<p class="notice error">تعذر تحميل الأخبار حالياً. حاول مرة أخرى لاحقاً.</p>`;
      return;
    }

    if (!data.articles.length) {
      container.innerHTML =
        `<p class="notice">لا توجد أخبار متاحة حالياً.</p>`;
      return;
    }

    container.innerHTML = data.articles.map(article => `
      <article class="news-card">
        <h3>${escapeHtml(article.title)}</h3>

        <div class="news-meta">
          ${escapeHtml(article.source || "مصدر إخباري")}
          ${article.published
            ? " • " + escapeHtml(article.published)
            : ""}
        </div>

        <a class="news-link"
           href="${escapeAttr(article.link)}"
           target="_blank"
           rel="noopener noreferrer">
          قراءة الخبر ←
        </a>
      </article>
    `).join("");

    newsLoaded = true;
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

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // أيام المباريات
  document.querySelectorAll(".day-tab").forEach(button => {
    button.addEventListener("click", () => {
      selectedDay = Number(button.dataset.day);

      document.querySelectorAll(".day-tab").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      renderMatches();
    });
  });

  document.getElementById("refresh-news")
    .addEventListener("click", () => loadNews(true));

  loadMatches();

  setInterval(() => {
    renderMatches();
    renderLive();
  }, 60 * 1000);

  setInterval(() => {
    newsLoaded = false;
  }, 15 * 60 * 1000);

})();

