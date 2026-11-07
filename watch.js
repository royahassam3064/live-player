(() => {
  "use strict";

  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );

  const id = new URLSearchParams(location.search).get("id");
  const title = document.getElementById("watch-title");
  const frame = document.getElementById("video-frame");

  function safeUrl(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function showNotice(message) {
    frame.innerHTML = "";
    const notice = document.createElement("p");
    notice.className = "notice";
    notice.textContent = message;
    frame.appendChild(notice);
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

    title.textContent = `${data.home_team} × ${data.away_team}`;

    const url = safeUrl(data.stream_url || "");
    if (!url) {
      showNotice("رابط البث غير متوفر أو غير صالح.");
      return;
    }

    frame.innerHTML = "";

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = "مشاهدة المباراة";
    iframe.loading = "eager";
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.setAttribute("allowfullscreen", "");
    frame.appendChild(iframe);
  }

  load();
})();
