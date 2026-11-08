(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let allMatches = [];
  let selectedDay = 0;
  let selectedChannel = "beIN Sports 1";
  let supabaseClient = null;
  let refreshBusy = false;

  const TIME_ZONE = "Asia/Baghdad";

  const CHANNELS = [
    {
      name: "beIN Sports 1",
      logo: "https://commons.wikimedia.org/wiki/Special:FilePath/BeIN%20Sports%201%20logo.svg"
    },
    {
      name: "beIN Sports 2",
      logo: "https://commons.wikimedia.org/wiki/Special:FilePath/BeIN%20Sports%202%20logo.svg"
    },
    {
      name: "beIN Sports 3",
      logo: "https://commons.wikimedia.org/wiki/Special:FilePath/BeIN%20Sports%203%20logo.svg"
    },
    {
      name: "beIN Sports 4",
      logo: "https://commons.wikimedia.org/wiki/Special:FilePath/BeIN%20Sports%204%20logo.svg"
    },
    {
      name: "beIN Sports 5",
      logo: "https://commons.wikimedia.org/wiki/Special:FilePath/BeIN%20Sports%205%20logo.svg"
    }
  ];

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


  // =========================
  // أدوات عامة
  // =========================

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }


  function safeHttpUrl(value) {
    try {
      const url = new URL(value);

      return ["https:", "http:"].includes(url.protocol)
        ? url.href
        : "";

    } catch {
      return "";
    }
  }


  function baghdadDate(offset = 0) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    const [year, month, day] = parts.split("-").map(Number);

    return new Date(
      Date.UTC(year, month - 1, day + offset, 12)
    ).toISOString().slice(0, 10);
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


  // =========================
  // حالة المباراة
  // =========================

  function getRawStatus(match) {
    return String(
      match.match_status || match.status || ""
    ).toUpperCase().trim();
  }


  function getStatus(match) {
    const status = getRawStatus(match);

    if (FINISHED_STATUSES.includes(status)) {
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
        live: true,
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
        live: false,
        finished: true
      };
    }

    if (
      status === "TIMED" ||
      status === "SCHEDULED" ||
      status === ""
    ) {
      return {
        label: "لم تبدأ بعد",
        css: "status-label",
        live: false
      };
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

    return "";
  }


  // =========================
  // شعارات الفرق
  // =========================

  function logoHtml(url, name) {
    const safeUrl = safeHttpUrl(url);

    if (!safeUrl) {
      return `
        <span class="team-logo-fallback">⚽</span>
      `;
    }

    return `
      <img
        src="${safeText(safeUrl)}"
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
      >
        ⚽
      </span>
    `;
  }


  // =========================
  // التنقل بين الصفحات
  // =========================

  function showPage(name) {
    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle(
        "active",
        page.id === `page-${name}`
      );
    });

    document.querySelectorAll(
      ".bottom-nav [data-page]"
    ).forEach(button => {
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

    if (name === "channels") {
      renderChannels();
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


    // اختيار اليوم
    document.querySelectorAll(
      ".day-tabs [data-day]"
    ).forEach(button => {

      button.addEventListener("click", () => {

        selectedDay = Number(button.dataset.day);

        document.querySelectorAll(
          ".day-tabs [data-day]"
        ).forEach(tab => {
          tab.classList.toggle(
            "active",
            tab === button
          );

          tab.classList.toggle(
            "selected",
            tab === button
          );
        });

        renderMatches();
      });

    });


    // فتح القناة من بطاقة المباراة
    document.addEventListener("click", event => {

      const button = event.target.closest(
        "[data-open-channel]"
      );

      if (!button) return;

      const channel = button.dataset.openChannel;

      if (!CHANNELS.some(item => item.name === channel)) {
        return;
      }

      selectedChannel = channel;

      showPage("channels");

      renderChannels();

    });

  }


  // =========================
  // بطاقات المباريات
  // =========================

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
        <strong class="score" dir="ltr">
          ${safeText(match.home_score)}
          -
          ${safeText(match.away_score)}
        </strong>
      `
      : `
        <span class="vs">VS</span>
      `;

    const time = formatMatchTime(match.match_time);

    const competition = safeText(
      match.competition || "مباراة"
    );

    const channel = String(
      match.channel || ""
    ).trim();

    const hasChannel = CHANNELS.some(
      item => item.name === channel
    );

    // البث يظهر فقط للحالات المباشرة المؤكدة
    const showStream =
      Boolean(safeHttpUrl(match.stream_url)) &&
      statusInfo.live &&
      !statusInfo.finished;


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
              ? `
                <span class="match-minute">
                  ${safeText(minute)}
                </span>
              `
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
          hasChannel
            ? `
              <button
                type="button"
                class="match-channel"
                data-open-channel="${safeText(channel)}"
              >
                ${safeText(channel)}
              </button>
            `
            : ""
        }


        ${
          showStream
            ? `
              <a
                class="watch-btn"
                href="watch.html?id=${encodeURIComponent(match.id)}"
              >
                مشاهدة البث
              </a>
            `
            : ""
        }

      </article>
    `;
  }


  // =========================
  // فلترة المباريات حسب اليوم
  // =========================

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
      .filter(match =>
        isSameBaghdadDay(match, targetDate)
      )
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


    // مباريات الرئيسية
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


    // تحديث القنوات إذا كانت مفتوحة
    if (
      $("page-channels")?.classList.contains("active")
    ) {
      renderChannels();
    }

  }


  // =========================
  // صفحة القنوات
  // =========================

  function renderChannels() {

    const channelsBox = $("channels-list");
    const matchesBox = $("channel-matches");
    const infoBox = $("selected-channel-info");

    if (!channelsBox || !matchesBox || !infoBox) {
      return;
    }


    // أزرار القنوات مع الشعارات
    channelsBox.innerHTML = CHANNELS.map(channel => {

      const selected =
        selectedChannel === channel.name;

      return `
        <button
          type="button"
          class="channel-button ${selected ? "selected" : ""}"
          data-channel="${safeText(channel.name)}"
        >

          <img
            class="channel-logo"
            src="${safeText(channel.logo)}"
            alt="${safeText(channel.name)}"
            loading="lazy"
          >

          <span class="channel-name">
            ${safeText(channel.name)}
          </span>

        </button>
      `;

    }).join("");


    // اختيار قناة
    channelsBox.querySelectorAll(
      "[data-channel]"
    ).forEach(button => {

      button.addEventListener("click", () => {

        selectedChannel = button.dataset.channel;

        renderChannels();

      });

    });


    // معلومات القناة المختارة
    const currentChannel = CHANNELS.find(
      item => item.name === selectedChannel
    );


    if (currentChannel) {

      infoBox.innerHTML = `
        <div class="selected-channel-card">

          <img
            class="selected-channel-logo"
            src="${safeText(currentChannel.logo)}"
            alt="${safeText(currentChannel.name)}"
          >

          <h2>
            ${safeText(currentChannel.name)}
          </h2>

          <span>
            مباريات القناة
          </span>

        </div>
      `;

    }


    // مباريات القناة المختارة
    const channelMatches = allMatches
      .filter(match =>
        String(match.channel || "").trim() === selectedChannel
      )
      .sort((a, b) =>
        new Date(a.match_time || 0) -
        new Date(b.match_time || 0)
      );


    matchesBox.innerHTML = channelMatches.length
      ? channelMatches.map(matchCard).join("")
      : `
        <div class="notice">
          ماكو مباريات مضافة على
          ${safeText(selectedChannel)}
          حالياً.
        </div>
      `;

  }


  // =========================
  // تحميل المباريات من Supabase
  // =========================

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
      renderChannels();


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

    }

  }


  // =========================
  // تحديث المباريات المستوردة
  // =========================

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

        if (!match.external_match_id) {
          return match;
        }

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


  // =========================
  // الأخبار
  // =========================

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
        ? articles.slice(0, 20).map(item => {

            const url = safeHttpUrl(item.url);

            return `
              <a
                class="news-card"
                href="${safeText(url || "#")}"
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
            `;

          }).join("")
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


  // =========================
  // الإعدادات
  // =========================

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


  // =========================
  // تشغيل التطبيق
  // =========================

  document.addEventListener(
    "DOMContentLoaded",
    async () => {

      initNavigation();

      initSettings();

      await loadMatches();

      await loadNews();

      await refreshImportedMatches();


      // تحديث النتائج كل دقيقتين
      setInterval(() => {

        if (!document.hidden) {
          refreshImportedMatches();
        }

      }, 120000);


      // تحديث عند الرجوع للتطبيق
      document.addEventListener(
        "visibilitychange",
        () => {

          if (!document.hidden) {
            refreshImportedMatches();
          }

        }
      );


      // تحديث عرض الوقت والحالة
      setInterval(() => {
        renderMatches();
      }, 60000);

    }
  );

})();
