(() => {
  "use strict";

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

  function playStream(rawUrl, streamTitle) {
    const url = safeUrl(rawUrl);

    if (!url) {
      showNotice("رابط بث القناة غير متوفر أو غير صالح.");
      return;
    }

    title.textContent = streamTitle;

    const iframe = document.createElement("iframe");

    iframe.src = url;
    iframe.title = streamTitle;
    iframe.loading = "eager";

    iframe.allow =
      "autoplay; fullscreen; picture-in-picture";

    iframe.allowFullscreen = true;

    iframe.setAttribute("allowfullscreen", "");

    iframe.referrerPolicy =
      "strict-origin-when-cross-origin";

    frame.innerHTML = "";
    frame.appendChild(iframe);
  }

  async function loadChannel(name) {
    title.textContent = name;

    const { data, error } = await client
      .from("tv_channels")
      .select("channel_name, stream_url")
      .eq("channel_name", name)
      .single();

    if (error || !data) {
      throw error || new Error("Channel not found");
    }

    playStream(
      data.stream_url,
      data.channel_name
    );
  }

  async function loadMatch(id) {
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
      .single();

    if (error || !data) {
      throw error || new Error("Match not found");
    }

    const matchTitle =
      `${data.home_team || "الفريق الأول"} × ${data.away_team || "الفريق الثاني"}`;

    title.textContent = matchTitle;

    if (isFinished(data)) {
      showNotice("انتهت المباراة.");
      return;
    }

    // إذا المباراة مرتبطة بقناة، نشغّل بث القناة
    if (data.channel) {
      const { data: channelData, error: channelError } =
        await client
          .from("tv_channels")
          .select("channel_name, stream_url")
          .eq("channel_name", data.channel)
          .single();

      if (!channelError && channelData?.stream_url) {
        playStream(
          channelData.stream_url,
          data.channel
        );

        return;
      }
    }

    // رابط المباراة القديم كخيار احتياطي
    playStream(data.stream_url, matchTitle);
  }

  async function init() {
    if (
      !window.supabase ||
      !window.SUPABASE_URL ||
      !window.SUPABASE_PUBLISHABLE_KEY
    ) {
      title.textContent = "خطأ في الاتصال";
      showNotice("تعذر الاتصال بإعدادات التطبيق.");
      return;
    }

    if (!matchId && !channelName) {
      title.textContent = "المشغّل";
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

      title.textContent = "تعذر تشغيل البث";

      showNotice(
        "تعذر تحميل القناة. تحقق من رابط البث واتصال الإنترنت."
      );
    }
  }

  let client = null;

  init();

})();
