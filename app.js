(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let allMatches = [];
  let selectedDay = 0;
  let supabaseClient = null;
  let refreshBusy = false;

  const TIME_ZONE = "Asia/Baghdad";

  const FINISHED_STATUSES = [
    "FINISHED",
    "FT",
    "AET",
    "PEN",
    "AFTER_EXTRA_TIME",
    "FULL_TIME",
    "ENDED",
    "COMPLETE",
    "COMPLETED"
  ];

  const LIVE_STATUSES = [
    "IN_PLAY",
    "LIVE",
    "1H",
    "2H",
    "EXTRA_TIME",
    "PENALTY_SHOOTOUT"
  ];

  const BREAK_STATUSES = [
    "PAUSED",
    "BREAK",
    "HALF_TIME",
    "HALFTIME",
    "HT"
  ];

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function baghdadDate(offset = 0) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    const [year, month, day] = parts.split("-").map(Number);

    const shifted = new Date(
      Date.UTC(year, month - 1, day + offset, 12)
    );

    return shifted.toISOString().slice(0, 10);
  }

  function formatMatchTime(value) {
    if (!value) return "الوقت غير محدد";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "الوقت غير محدد";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
      timeZone: TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);
  }

  function showPage(name) {
    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle(
        "active",
        page.id === `page-${name}`
      );
    });

    document.querySelectorAll(".bottom-nav [data-page]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === name
      );
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    if (name === "news") {
      loadNews();
    }
  }

  function initNavigation() {
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-page]");

      if (!button) return;

      const page = button.dataset.page;

      if (!page) return;

      event.preventDefault();
      showPage(page);
    });

    document.querySelectorAll(".day-tabs [data-day]").forEach(button => {
      button.addEventListener("click", () => {
        selectedDay = Number(button.dataset.day);

        document.querySelectorAll(".day-tabs [data-day]").forEach(tab => {
          tab.classList.toggle("selected", tab === button);
        });

        renderMatches();
      });
    });
  }

  function isFinished(match) {
    const status = String(
      match.match_status || ""
    ).toUpperCase();

    return FINISHED_STATUSES.includes(status);
  }

  function getStatus(match) {
    const status = String(
      match.match_status || ""
    ).toUpperCase();

    const start = new Date(match.match_time).getTime();
    const now = Date.now();

    if (isFinished(match)) {
      return {
        label: "انتهت المباراة",
        css: "finished-label",
        live: false,
        finished: true
      };
    }

    if (BREAK_STATUSES.includes(status)) {
      return {
        label: "استراحة",
        css: "break-label",
        live: false,
        paused: true
      };
    }

    if (LIVE_STATUSES.includes(status)) {
      return {
        label: "مباشر",
        css: "live-label",
        live: true
      };
    }

    if (status === "POSTPONED") {
      return {
        label: "تأجلت",
        css: "finished-label",
        live: false
      };
    }

    if (status === "SUSPENDED") {
      return {
        label: "متوقفة",
        css: "break-label",
        live: false
      };
    }

    if (status === "CANCELLED") {
      return {
        label: "أُلغيت",
        css: "finished-label",
        live: false
      };
    }

    if (status === "AWARDED") {
      return {
        label: "حُسمت إدارياً",
        css: "finished-label",
        live: false
      };
    }

    if (
      status === "TIMED" ||
      status === "SCHEDULED" ||
      status === ""
    ) {
      if (!Number.isNaN(start) && now < start) {
        return {
          label: "لم تبدأ بعد",
          css: "status-label",
          live: false
        };
      }

      if (
        !Number.isNaN(start) &&
        now <= start + 150 * 60000
      ) {
        return {
          label: "محتمل أنها جارية",
          css: "live-label",
          live: true,
          estimated: true
        };
      }

      if (
        !Number.isNaN(start) &&
        now > start + 150 * 60000
      ) {
        return {
          label: "انتهى وقت المباراة المتوقع",
          css: "finished-label",
          live: false,
          estimated: true
        };
      }
    }

    return {
      label: "موعد المباراة",
      css: "status-label",
      live: false
    };
  }

  function getMinute(match, statusInfo) {
    if (
      !statusInfo.live ||
      statusInfo.paused ||
      statusInfo.finished
    ) {
      return "";
    }

    const officialMinute =
      match.minute ??
      match.elapsed ??
      match.match_minute;

    if (
      officialMinute !== null &&
      officialMinute !== undefined &&
      officialMinute !== ""
    ) {
      const number = Number(officialMinute);

      if (Number.isFinite(number) && number >= 0) {
        return `${Math.floor(number)}′`;
      }
    }

    const start = new Date(match.match_time).getTime();

    if (Number.isNaN(start)) return "";

    const minute = Math.floor(
      (Date.now() - start) / 60000
    );

    if (minute < 0 || minute > 150) return "";

    return `${minute}′`;
  }

  function logoHtml(url, name) {
    if (!url) {
      return `<span class="team-logo-fallback">⚽</span>`;
    }

    return `
      <img
        src="${safeText(url)}"
        alt="${safeText(name)}"
        loading="lazy"
        onerror="
          this.style.display='none';
          this.nextElementSibling.style.display='grid'
        "
      >
      <span
        class="team-logo-fallback"
        style="display:none"
      >⚽</span>
    `;
  }

  function matchCard(match) {
    const homeName = match.home_team || "الفريق الأول";
    const awayName = match.away_team || "الفريق الثاني";

    const home = safeText(homeName);
    const away = safeText(awayName);

    const statusInfo = getStatus(match);
    const minute = getMinute(match, statusInfo);

    const hasScore =
      match.home_score !== null &&
      match.home_score !== undefined &&
      match.away_score !== null &&
      match.away_score !== undefined;

    const scoreHtml = hasScore
      ? `
        <strong class="score">
          ${safeText(match.home_score)}
          -
          ${safeText(match.away_score)}
        </strong>
      `
      : `<span class="vs">VS</span>`;

    const time = formatMatchTime(match.match_time);

    const competition = safeText(
      match.competition || "مباراة"
    );

    const start = new Date(match.match_time).getTime();
    const now = Date.now();

    const finished = isFinished(match);

    const showStream =
      Boolean(match.stream_url) &&
      !finished &&
      !statusInfo.finished &&
      !Number.isNaN(start) &&
      now >= start - 3600000 &&
      now <= start + 4 * 3600000;

    return `
      <article class="match-card">

        <div class="match-meta">

          <span>${competition}</span>

          <span class="match-time-label">
            ${safeText(time)}
          </span>

          <span class="${statusInfo.css}">
            ${safeText(statusInfo.label)}
          </span>

          ${
            minute
              ? `<span class="match-minute">${safeText(minute)}</span>`
              : ""
          }

        </div>


        <div class="teams">

          <div class="team">

            ${logoHtml(match.home_logo, homeName)}

            <b>${home}</b>

          </div>


          <div class="match-middle">

            ${scoreHtml}

          </div>


          <div class="team">

            ${logoHtml(match.away_logo, awayName)}

            <b>${away}</b>

          </div>

        </div>


        ${
          showStream
            ? `
              <a
                class="watch-btn"
                href="watch.html?id=${encodeURIComponent(match.id)}"
              >
                مشاهدة البث المباشر
              </a>
            `
            : (
                match.stream_url && !finished
                  ? `
                    <div class="stream-notice">
                      سيظهر زر البث قبل المباراة بساعة
                    </div>
                  `
                  : ""
              )
        }

      </article>
    `;
  }

  function isMatchLive(match) {
    const status = String(
      match.match_status || ""
    ).toUpperCase();

    if (isFinished(match)) return false;

    if (
      LIVE_STATUSES.includes(status) ||
      BREAK_STATUSES.includes(status)
    ) {
      return true;
    }

    if (
      !status ||
      status === "TIMED" ||
      status === "SCHEDULED"
    ) {
      const start = new Date(match.match_time).getTime();

      return (
        !Number.isNaN(start) &&
        Date.now() >= start &&
        Date.now() <= start + 150 * 60000
      );
    }

    return false;
  }

  function isSameBaghdadDay(match, targetDate) {
    if (!match.match_time) return false;

    const date = new Date(match.match_time);

    if (Number.isNaN(date.getTime())) {
      return (
        String(match.match_time).slice(0, 10) === targetDate
      );
    }

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date) === targetDate;
  }

  function renderMatches() {
    const targetDate = baghdadDate(selectedDay);

    const dayMatches = allMatches
      .filter(match => isSameBaghdadDay(match, targetDate))
      .sort((a, b) => {
        return (
          new Date(a.match_time || 0) -
          new Date(b.match_time || 0)
        );
      });

    const html = dayMatches.length
      ? dayMatches.map(matchCard).join("")
      : `
        <div class="notice">
          ماكو مباريات بهذا اليوم حالياً.
        </div>
      `;

    if ($("matches-list")) {
      $("matches-list").innerHTML = html;
    }

    if ($("home-matches")) {
      const todayMatches = allMatches
        .filter(match =>
          isSameBaghdadDay(match, baghdadDate(0))
        )
        .slice(0, 3);

      $("home-matches").innerHTML = todayMatches.length
        ? todayMatches.map(matchCard).join("")
        : `
          <div class="notice">
            ماكو مباريات اليوم حالياً.
          </div>
        `;
    }

    if ($("live-list")) {
      const liveMatches = allMatches.filter(isMatchLive);

      $("live-list").innerHTML = liveMatches.length
        ? liveMatches.map(matchCard).join("")
        : `
          <div class="notice">
            ماكو مباريات مباشرة حالياً.
          </div>
        `;
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
      const message = `
        <div class="notice">
          تأكد من إعدادات config.js واتصال Supabase.
        </div>
      `;

      if (home) home.innerHTML = message;
      if (list) list.innerHTML = message;

      return;
    }

    try {
      supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_PUBLISHABLE_KEY
      );

      const { data, error } = await supabaseClient
        .from("matches")
        .select("*")
        .order("match_time", {
          ascending: true
        })
        .limit(150);

      if (error) throw error;

      allMatches = Array.isArray(data) ? data : [];

      renderMatches();

    } catch (error) {
      console.error("Kora TV matches:", error);

      const message = `
        <div class="notice">
          تعذر تحميل المباريات.
          تحقق من الإنترنت أو إعدادات Supabase ثم حدّث الصفحة.
        </div>
      `;

      if (home) home.innerHTML = message;
      if (list) list.innerHTML = message;

      if ($("live-list")) {
        $("live-list").innerHTML = message;
      }
    }
  }

  async function refreshImportedMatches() {
    if (!supabaseClient || refreshBusy) return;

    const hasImported = allMatches.some(
      match => match.external_match_id
    );

    if (!hasImported) return;

    refreshBusy = true;

    try {
      const { data, error } =
        await supabaseClient.functions.invoke(
          "football-matches",
          {
            method: "GET"
          }
        );

      if (error) throw error;

      const apiMatches = Array.isArray(data?.matches)
        ? data.matches
        : (Array.isArray(data) ? data : []);

      const apiMap = new Map(
        apiMatches.map(match => [
          String(match.id),
          match
        ])
      );

      allMatches = allMatches.map(match => {
        if (!match.external_match_id) return match;

        const apiMatch = apiMap.get(
          String(match.external_match_id)
        );

        if (!apiMatch) return match;

        const score = apiMatch.score?.fullTime || {};

        return {
          ...match,

          match_status:
            apiMatch.status || match.match_status,

          home_score:
            score.home ??
            apiMatch.home_score ??
            match.home_score,

          away_score:
            score.away ??
            apiMatch.away_score ??
            match.away_score,

          minute:
            apiMatch.minute ??
            apiMatch.elapsed ??
            match.minute
        };
      });

      renderMatches();

    } catch (error) {
      console.warn("Kora TV live update:", error);

    } finally {
      refreshBusy = false;
    }
  }

  async function loadNews() {
    const box = $("news-list");

    if (!box || !supabaseClient) return;

    try {
      const { data, error } =
        await supabaseClient.functions.invoke(
          "football-news"
        );

      if (error) throw error;

      const articles = Array.isArray(data)
        ? data
        : (data?.articles || data?.news || []);

      box.innerHTML = articles.length
        ? articles.slice(0, 20).map(item => `
            <a
              class="news-card"
              href="${safeText(item.url || "#")}"
              target="_blank"
              rel="noopener"
            >
              <b>
                ${safeText(item.title || "خبر رياضي")}
              </b>

              <span>
                ${safeText(item.description || "")}
              </span>
            </a>
          `).join("")
        : `
          <div class="notice">
            ماكو أخبار متاحة حالياً.
          </div>
        `;

    } catch (error) {
      console.warn("Kora TV news:", error);

      box.innerHTML = `
        <div class="notice">
          الأخبار غير متاحة حالياً.
        </div>
      `;
    }
  }

  function initSettings() {
    const root = document.documentElement;

    const font = $("font-setting");
    const bold = $("bold-setting");

    if (!font || !bold) return;

    font.value =
      localStorage.getItem("kora_font") || "16";

    bold.checked =
      localStorage.getItem("kora_bold") === "true";

    function apply() {
      root.dataset.theme = "dark";

      root.style.setProperty(
        "--accent",
        "#d6ad45"
      );

      root.style.setProperty(
        "--base-font",
        font.value + "px"
      );

      root.classList.toggle(
        "heavy-text",
        bold.checked
      );

      localStorage.setItem(
        "kora_font",
        font.value
      );

      localStorage.setItem(
        "kora_bold",
        String(bold.checked)
      );
    }

    font.addEventListener("change", apply);
    bold.addEventListener("change", apply);

    apply();
  }

  document.addEventListener(
    "DOMContentLoaded",
    async () => {

      initNavigation();
      initSettings();

      await loadMatches();
      await loadNews();
      await refreshImportedMatches();

      // تحديث بيانات المباريات كل دقيقتين.
      setInterval(() => {
        if (!document.hidden) {
          refreshImportedMatches();
        }
      }, 120000);

      // تحديث عند الرجوع إلى الموقع.
      document.addEventListener(
        "visibilitychange",
        () => {
          if (!document.hidden) {
            refreshImportedMatches();
          }
        }
      );

      // تحديث الدقيقة المعروضة كل دقيقة.
      setInterval(renderMatches, 60000);

    }
  );

})();
