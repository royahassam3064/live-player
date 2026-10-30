(() => {
  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );
  const list = document.getElementById("matches");
  const dateLabel = document.getElementById("date-label");
  let selectedDay = 0;
  let allMatches = [];

  const baghdadDate = (date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);

  const shiftDate = (ymd, amount) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + amount, 12));
    return date.toISOString().slice(0, 10);
  };

  const formatTime = (value) => new Intl.DateTimeFormat("ar-IQ", {
    timeZone: "Asia/Baghdad", hour: "numeric", minute: "2-digit"
  }).format(new Date(value));

  const formatDate = (ymd) => new Intl.DateTimeFormat("ar-IQ", {
    timeZone: "Asia/Baghdad", weekday: "long", day: "numeric", month: "long"
  }).format(new Date(`${ymd}T12:00:00+03:00`));

  function card(match) {
    const now = Date.now();
    const start = new Date(match.match_time).getTime();
    // يظهر زر البث من ساعة قبل البداية وحتى 4 ساعات بعد البداية.
    const showStream = !!match.stream_url && now >= start - 60 * 60 * 1000 && now <= start + 4 * 60 * 60 * 1000;
    const status = now < start - 60 * 60 * 1000 ? "لم تبدأ بعد" :
      now < start ? "تبدأ قريباً" :
      now <= start + 4 * 60 * 60 * 1000 ? "مباشر / جارية" : "انتهت";

    const homeLogo = match.home_logo
      ? `<img src="${escapeAttr(match.home_logo)}" alt="" loading="lazy">`
      : `<span class="logo-placeholder">⚽</span>`;
    const awayLogo = match.away_logo
      ? `<img src="${escapeAttr(match.away_logo)}" alt="" loading="lazy">`
      : `<span class="logo-placeholder">⚽</span>`;

    return `<article class="match-card">
      <div class="match-time">${formatTime(match.match_time)}</div>
      <div class="teams">
        <div class="team">${homeLogo}<strong>${escapeHtml(match.home_team)}</strong></div>
        <div class="vs">VS</div>
        <div class="team">${awayLogo}<strong>${escapeHtml(match.away_team)}</strong></div>
      </div>
      <div class="match-bottom">
        <span class="status">${status}</span>
        ${showStream
          ? `<a class="watch-btn" href="watch.html?id=${encodeURIComponent(match.id)}">تشغيل البث المباشر</a>`
          : `<span class="stream-wait">${match.stream_url ? "زر البث يظهر قبل المباراة بساعة" : "لا يوجد رابط بث حالياً"}</span>`}
      </div>
    </article>`;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function render() {
    const today = baghdadDate(new Date());
    const target = shiftDate(today, selectedDay);
    dateLabel.textContent = formatDate(target);
    const rows = allMatches.filter(m => baghdadDate(new Date(m.match_time)) === target)
      .sort((a,b) => new Date(a.match_time) - new Date(b.match_time));
    list.innerHTML = rows.length
      ? rows.map(card).join("")
      : `<p class="notice">ماكو مباريات مضافة لهذا اليوم حالياً.</p>`;
  }

  async function load() {
    list.innerHTML = `<p class="notice">جارٍ تحميل المباريات...</p>`;
    const { data, error } = await client.from("matches")
      .select("id,home_team,away_team,home_logo,away_logo,match_time,stream_url")
      .order("match_time", { ascending: true });
    if (error) {
      list.innerHTML = `<p class="notice error">تعذر تحميل المباريات: ${escapeHtml(error.message)}</p>`;
      return;
    }
    allMatches = data || [];
    render();
  }

  document.querySelectorAll(".day-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedDay = Number(btn.dataset.day);
      document.querySelectorAll(".day-tab").forEach(b => b.classList.toggle("active", b === btn));
      render();
    });
  });

  load();
  setInterval(render, 60 * 1000);
})();
