(() => {
  "use strict";

  let client = null;

  const title = document.getElementById("watch-title");
  const frame = document.getElementById("video-frame");

  const params = new URLSearchParams(window.location.search);

  const matchId = params.get("id");
  const channelName = params.get("channel");

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

  function setTitle(text) {
    if (title) {
      title.textContent = text;
    }
  }

  function safeUrl(raw) {
    try {
      if (!raw || typeof raw !== "string") {
        return null;
      }

      const url = new URL(raw.trim());

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
    if (!frame) return;

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
      min-height:220px;
      padding:20px;
      color:#f1d27a;
      background:#080808;
      text-align:center;
      font-size:15px;
      line-height:1.9;
    `;

    frame.appendChild(notice);
  }

  function isFinished(data) {
    const status = String(
      data.match_status || data.status || ""
    ).toUpperCase().trim();

    return FINISHED_STATUSES.includes(status);
  }

  function playStream(rawUrl, streamTitle) {
    const url = safeUrl(rawUrl);

    if (!url) {
      setTitle(streamTitle || "المشغّل");
      showNotice("رابط بث القناة غير متوفر أو غير صالح.");
      return;
    }

    setTitle(streamTitle);

    if (!frame) return;

    frame.innerHTML = "";

    const iframe = document.createElement("iframe");

    iframe.src = url;
    iframe.title = streamTitle || "KORA TV Player";
    iframe.loading = "eager";

    iframe.allow =
      "autoplay; fullscreen; picture-in-picture; encrypted-media";

    iframe.allowFullscreen = true;

    iframe.setAttribute("allowfullscreen", "");

    iframe.referrerPolicy =
      "strict-origin-when-cross-origin";

    iframe.style.cssText = `
      display:block;
      width:100%;
      height:100%;
      min-height:220px;
      border:0;
      background:#000;
    `;

    frame.appendChild(iframe);
  }

  async function getChannel(name) {
    const cleanName = String(name || "").trim();

    if (!cleanName) {
      throw new Error("Channel name is empty");
    }

    const { data, error } = await client
      .from("tv_channels")
      .select("channel_name, stream_url")
      .eq("channel_name", cleanName)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Channel not found");
    }

    return data;
  }

  async function loadChannel(name) {
    setTitle(name || "القنوات");
    showNotice("جاري تحميل القناة...");

    const data = await getChannel(name);

    playStream(
      data.stream_url,
      data.channel_name
    );
  }

  async function loadMatch(id) {
    showNotice("جاري تحميل المباراة...");

    const { data, error } = await client
      .from("matches")
      .select(`
        home_team,
        away_team,
        channel,
        stream_url,
        match_status,
        status
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Match not found");
    }

    const matchTitle =
      `${data.home_team || "الفريق الأول"} × ${data.away_team || "الفريق الثاني"}`;

    setTitle(matchTitle);

    if (isFinished(data)) {
      showNotice("انتهت المباراة.");
      return;
    }

    // تشغيل القناة المرتبطة بالمباراة
    if (data.channel && data.channel.trim()) {
      try {
        const channelData = await getChannel(data.channel);

        if (channelData.stream_url) {
          playStream(
            channelData.stream_url,
            channelData.channel_name
          );

          return;
        }

      } catch (error) {
        console.warn(
          "تعذر تحميل القناة المرتبطة بالمباراة:",
          error
        );
      }
    }

    // استخدام رابط المباراة إذا لم يتوفر رابط القناة
    playStream(
      data.stream_url,
      matchTitle
    );
  }

  async function init() {
    if (!title || !frame) {
      console.error("KORA TV: watch.html elements are missing.");
      return;
    }

    if (
      !window.supabase ||
      !window.SUPABASE_URL ||
      !window.SUPABASE_PUBLISHABLE_KEY
    ) {
      setTitle("خطأ في الاتصال");
      showNotice("تعذر الاتصال بإعدادات التطبيق.");
      return;
    }

    if (!matchId && !channelName) {
      setTitle("المشغّل");
      showNotice("لم يتم تحديد قناة أو مباراة.");
      return;
    }

    try {
      client = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_PUBLISHABLE_KEY
      );

      if (channelName) {
        await loadChannel(channelName);
      } else {
        await loadMatch(matchId);
      }

    } catch (error) {
      console.error("KORA TV player:", error);

      setTitle("تعذر تشغيل البث");

      showNotice(
        "تعذر تحميل القناة. تحقق من وجودها ورابط البث واتصال الإنترنت."
      );
    }
  }

  init();

})();
