(() => {
  const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const title = document.getElementById("watch-title");
  const frame = document.getElementById("video-frame");

  function safeUrl(raw) {
    try {
      const u = new URL(raw);
      return u.protocol === "https:" ? u.href : null;
    } catch { return null; }
  }

  async function load() {
    if (!id) {
      title.textContent = "رابط المباراة غير صحيح";
      frame.innerHTML = "";
      return;
    }
    const { data, error } = await client.from("matches")
      .select("home_team,away_team,stream_url")
      .eq("id", id).single();
    if (error || !data) {
      title.textContent = "تعذر العثور على المباراة";
      frame.innerHTML = "";
      return;
    }
    title.textContent = `${data.home_team} × ${data.away_team}`;
    const url = safeUrl(data.stream_url || "");
    if (!url) {
      frame.innerHTML = `<p class="notice">رابط البث غير متوفر أو غير صالح.</p>`;
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.title = "مشغل البث";
    frame.replaceChildren(iframe);
  }
  load();
})();
