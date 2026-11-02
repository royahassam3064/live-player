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
      return url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }

  async function load() {
    if (!id) {
      title.textContent = "رابط المباراة غير صحيح";
      return;
    }

    const { data, error } = await client
      .from("matches")
      .select("home_team,away_team,stream_url")
      .eq("id", id)
      .single();

    if (error || !data) {
      title.textContent = "تعذر العثور على المباراة";
      return;
    }

    title.textContent =
      `${data.home_team} × ${data.away_team}`;

    const url = safeUrl(data.stream_url || "");

    if (!url) {
      const notice = document.createElement("p");
      notice.className = "notice";
      notice.textContent = "رابط البث غير متوفر أو غير صالح.";

      const oldIframe = frame.querySelector("iframe");
      if (oldIframe) oldIframe.remove();

      frame.prepend(notice);
      return;
    }

    // حذف رسالة التحميل وإطار البث القديم فقط
    frame.querySelectorAll(".notice, iframe").forEach(element => {
      element.remove();
    });

    // إنشاء إطار البث
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

    // إضافة البث دون حذف الشعار أو زر ملء الشاشة
    frame.prepend(iframe);
  }

  load();
})();
