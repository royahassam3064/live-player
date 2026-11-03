(() => {
  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );

  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  const title = document.getElementById("watch-title");
  const frame = document.getElementById("video-frame");

  function safeUrl(raw) {
    try {
      const url = new URL(raw);

      if (url.protocol !== "https:") {
        return null;
      }

      return url.href;

    } catch {
      return null;
    }
  }

  async function load() {

    if (!id) {
      title.textContent = "رابط المباراة غير صحيح";
      showNotice("لم يتم تحديد مباراة.");
      return;
    }

    const { data, error } = await client
      .from("matches")
      .select("home_team,away_team,stream_url")
      .eq("id", id)
      .single();

    if (error || !data) {
      title.textContent = "تعذر العثور على المباراة";
      showNotice("تعذر تحميل بيانات المباراة.");
      return;
    }

    title.textContent =
      `${data.home_team} × ${data.away_team}`;

    const url = safeUrl(data.stream_url || "");

    if (!url) {
      showNotice("رابط البث غير متوفر أو غير صالح.");
      return;
    }

    const oldIframe = frame.querySelector("iframe");

    if (oldIframe) {
      oldIframe.remove();
    }

    const notice = document.getElementById("loading-notice");

    if (notice) {
      notice.remove();
    }

    const iframe = document.createElement("iframe");

    iframe.src = url;
    iframe.width = "640";
    iframe.height = "360";
    iframe.frameBorder = "0";
    iframe.scrolling = "no";

    iframe.allow =
      "autoplay; fullscreen; picture-in-picture";

    iframe.allowFullscreen = true;
    iframe.title = "مشغل البث";

    // يبقى الشعار وزر ملء الشاشة فوق إطار البث
    frame.insertBefore(
      iframe,
      frame.querySelector(".kora-logo")
    );
  }

  function showNotice(message) {

    const oldNotice = frame.querySelector(".notice");

    if (oldNotice) {
      oldNotice.remove();
    }

    const notice = document.createElement("p");

    notice.className = "notice";
    notice.textContent = message;

    frame.prepend(notice);
  }

  load();
})();
