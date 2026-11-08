(() => {
  "use strict";

  const title = document.getElementById("watch-title");
  const frame = document.getElementById("video-frame");

  let client = null;

  const FINISHED_STATUSES = [
    "FINISHED",
    "FT",
    "AET",
    "PEN",
    "AFTER_EXTRA_TIME",
    "FULL_TIME",
    "ENDED",
    "COMPLETE",
    "COMPLETED",
    "AWARDED"
  ];

  function safeUrl(raw) {
    try {
      const url = new URL(raw);

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function showNotice(message) {
    frame.innerHTML = "";

    const notice = document.createElement("div");
    notice.className = "watch-loading";
    notice.textContent = message;

    notice.style.cssText = `
      display:flex;
      align-items:center;
      justify-content:center;
      width:100%;
      height:100%;
      min-height:200px;
      padding:20px;
      color:#f1d27a;
      background:#080808;
      text-align:center;
      font-size:14px;
      line-height:1.9;
    `;

    frame.appendChild(notice);
  }

  function isFinished(data) {
    const status = String(
      data.match_status || data.status || ""
    ).toUpperCase();

    return FINISHED_STATUSES.includes(status);
  }

  async function loadMatch() {
    const id = new URLSearchParams(
      window.location.search
    ).get("id");

    if (!id) {
      title.textContent = "رابط المباراة غير صحيح";
      showNotice("لم يتم تحديد مباراة.");
      return;
    }

    if (
      !window.supabase ||
      !window.SUPABASE_URL ||
      !window.SUPABASE_PUBLISHABLE_KEY
    ) {
      title.textContent = "خطأ في الاتصال";
      showNotice("تعذر الاتصال بإعدادات التطبيق.");
      return;
    }

    try {
      client = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_PUBLISHABLE_KEY
      );

      const { data, error } = await client
        .from("matches")
        .select(`
          home_team,
          away_team,
          stream_url,
          match_status,
          status
        `)
        .eq("id", id)
        .single();

      if (error || !data) {
        throw error || new Error("Match not found");
      }

      title.textContent =
        `${data.home_team || "الفريق الأول"} × ${data.away_team || "الفريق الثاني"}`;

      if (isFinished(data)) {
        showNotice("انتهت المباراة.");
        return;
      }

      const url = safeUrl(data.stream_url || "");

      if (!url) {
        showNotice("رابط البث غير متوفر أو غير صالح.");
        return;
      }

      const iframe = document.createElement("iframe");

      iframe.src = url;
      iframe.title = "مشاهدة المباراة";
      iframe.loading = "eager";
      iframe.allow =
        "autoplay; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;

      iframe.setAttribute("allowfullscreen", "");
      iframe.referrerPolicy =
        "strict-origin-when-cross-origin";

      frame.innerHTML = "";
      frame.appendChild(iframe);

    } catch (error) {
      console.error("Kora TV player error:", error);

      title.textContent = "تعذر تحميل المباراة";

      showNotice(
        "حدث خطأ أثناء تحميل المباراة. تحقق من الإنترنت أو إعدادات Supabase."
      );
    }
  }

  loadMatch();

})();
