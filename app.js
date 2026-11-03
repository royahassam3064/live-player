javascript
(() => {
"use strict";

const $ = id => document.getElementById(id);

const required = [
  "matches","date-label","live-matches",
  "home-upcoming-preview","home-news-preview",
  "news-list"
];

if (required.some(id => !$(id))) return;

let client = null;
let selectedDay = 0;
let allMatches = [];

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#39;"
}[c]));

const baghdadDate = date =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Baghdad",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).format(date);

const shiftDate = (ymd, amount) => {
  const [y,m,d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y,m-1,d+amount,12))
    .toISOString().slice(0,10);
};

const fmtTime = value =>
  new Intl.DateTimeFormat("ar-IQ", {
    timeZone:"Asia/Baghdad",
    hour:"numeric",
    minute:"2-digit"
  }).format(new Date(value));

const fmtDate = ymd =>
  new Intl.DateTimeFormat("ar-IQ", {
    timeZone:"Asia/Baghdad",
    weekday:"long",
    day:"numeric",
    month:"long"
  }).format(new Date(`${ymd}T12:00:00+03:00`));

function matchCard(m, compact=false) {
  const start = new Date(m.match_time).getTime();
  const now = Date.now();

  const statusText = m.match_status ||
    (now < start-3600000 ? "لم تبدأ بعد" :
    now <= start+14400000 ? "مباشر / جارية" : "انتهت");

  const showStream = !!m.stream_url &&
    now >= start-3600000 &&
    now <= start+14400000;

  const homeLogo = m.home_logo
    ? `<img src="${escape(m.home_logo)}" alt="" loading="lazy">`
    : `<span class="team-fallback">H</span>`;

  const awayLogo = m.away_logo
    ? `<img src="${escape(m.away_logo)}" alt="" loading="lazy">`
    : `<span class="team-fallback">A</span>`;

  return `
  <article class="match-card ${compact?"compact":""}">
    <div class="match-meta">
      <span>${escape(m.competition || "مباراة كرة قدم")}</span>
      <time>${fmtTime(m.match_time)}</time>
    </div>

    <div class="teams">
      <div class="team">
        ${homeLogo}
        <strong>${escape(m.home_team)}</strong>
      </div>

      <span class="versus">VS</span>

      <div class="team">
        ${awayLogo}
        <strong>${escape(m.away_team)}</strong>
      </div>
    </div>

    <div class="match-bottom">
      <span class="status-pill">${escape(statusText)}</span>

      ${
        showStream
        ? `<a class="watch-btn" href="watch.html?id=${encodeURIComponent(m.id)}">▶ مشاهدة البث</a>`
        : `<span class="stream-wait">لا يتوفر بث حالياً</span>`
      }
    </div>
  </article>`;
}

function renderMatches() {
  const target = shiftDate(baghdadDate(new Date()), selectedDay);

  $("date-label").textContent = fmtDate(target);

  const rows = allMatches
    .filter(m => baghdadDate(new Date(m.match_time)) === target)
    .sort((a,b)=>new Date(a.match_time)-new Date(b.match_time));

  $("matches").innerHTML = rows.length
    ? rows.map(m=>matchCard(m)).join("")
    : `<p class="empty-state">ماكو مباريات مضافة لهذا اليوم حالياً.</p>`;
}

function renderLive() {
  const now = Date.now();

  const rows = allMatches.filter(m => {
    const start = new Date(m.match_time).getTime();
    return m.stream_url &&
      now >= start-3600000 &&
      now <= start+14400000;
  });

  $("live-matches").innerHTML = rows.length
    ? rows.map(m=>matchCard(m)).join("")
    : `<p class="empty-state">ماكو روابط بث متاحة حالياً.</p>`;
}

function renderHome() {
  const upcoming = allMatches
    .filter(m=>new Date(m.match_time).getTime()>Date.now()-3600000)
    .sort((a,b)=>new Date(a.match_time)-new Date(b.match_time))
    .slice(0,2);

  $("home-upcoming-preview").innerHTML = upcoming.length
    ? upcoming.map(m=>matchCard(m,true)).join("")
    : `<p class="empty-state">ماكو مباريات قادمة مضافة حالياً.</p>`;

  renderLive();
}

async function loadMatches() {
  if (
    !window.supabase ||
    !window.SUPABASE_URL ||
    !window.SUPABASE_PUBLISHABLE_KEY
  ) {
    $("matches").innerHTML =
      `<p class="empty-state">إعدادات الاتصال غير موجودة في config.js.</p>`;
    return;
  }

  client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );

  const {data,error} = await client
    .from("matches")
    .select(`
      id,home_team,away_team,home_logo,away_logo,
      match_time,stream_url,competition,
      match_status,home_score,away_score
    `)
    .order("match_time",{ascending:true});

  if(error) {
    $("matches").innerHTML =
      `<p class="empty-state error">تعذر تحميل المباريات.</p>`;
    return;
  }

  allMatches = data || [];

  renderMatches();
  renderHome();
}

function showPage(name) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active",page.id===`page-${name}`);
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active",button.dataset.page===name);
  });

  if(name==="matches") renderMatches();
  if(name==="live") renderLive();

  window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click",()=>showPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click",()=>showPage(button.dataset.go));
});

document.querySelectorAll(".day-tab").forEach(button => {
  button.addEventListener("click",()=>{
    selectedDay = Number(button.dataset.day);

    document.querySelectorAll(".day-tab").forEach(b => {
      b.classList.toggle("active",b===button);
    });

    renderMatches();
  });
});

async function loadNews() {
  const list = $("news-list");
  const preview = $("home-news-preview");

  list.innerHTML = `<p class="empty-state">جارٍ تحميل الأخبار...</p>`;

  if(!client) {
    list.innerHTML = `<p class="empty-state">الأخبار غير متاحة حالياً.</p>`;
    return;
  }

  try {
    const {data,error} = await client.functions.invoke("football-news");

    if(error) throw error;

    const items = Array.isArray(data)
      ? data
      : (data?.articles || data?.news || []);

    if(!items.length) throw new Error("لا توجد أخبار");

    const html = items.slice(0,12).map(n => {
      const url = /^https?:\/\//i.test(n.url || n.link || "")
        ? (n.url || n.link)
        : "#";

      return `
      <a class="news-card"
         href="${escape(url)}"
         target="_blank"
         rel="noopener noreferrer">
        <div>
          <small>${escape(n.source?.name || n.source || "أخبار كرة القدم")}</small>
          <h3>${escape(n.title || "خبر رياضي")}</h3>
          <p>${escape(n.description || "اضغط لقراءة التفاصيل.")}</p>
        </div>
        <span>↗</span>
      </a>`;
    }).join("");

    list.innerHTML = html;

    preview.innerHTML = items.slice(0,2).map(n => `
      <div class="news-mini">
        <small>${escape(n.source?.name || "أخبار الكرة")}</small>
        <strong>${escape(n.title || "خبر رياضي")}</strong>
      </div>
    `).join("");

  } catch(error) {
    list.innerHTML = `<p class="empty-state">تعذر تحميل الأخبار حالياً.</p>`;
    preview.innerHTML = `<p class="empty-state">الأخبار غير متاحة حالياً.</p>`;
  }
}

$("refresh-news").addEventListener("click",loadNews);

window.KoraTV = {showPage,renderMatches};

loadMatches().then(loadNews);

setInterval(()=>{
  renderMatches();
  renderHome();
},60000);


// إعدادات المظهر المحلية

const defaults = {
  theme:"dark",
  accent:"purple",
  font:"normal",
  bold:true
};

function applySettings(s) {
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.dataset.accent = s.accent;
  document.documentElement.dataset.font = s.font;

  document.documentElement.classList.toggle(
    "heavy-text",
    s.bold
  );

  $("theme-setting").value = s.theme;
  $("accent-setting").value = s.accent;
  $("font-setting").value = s.font;
  $("bold-setting").checked = s.bold;
}

let settings = {...defaults};

try {
  settings = {
    ...defaults,
    ...JSON.parse(localStorage.getItem("kora-tv-settings") || "{}")
  };
} catch {}

applySettings(settings);

function saveSettings() {
  settings = {
    theme:$("theme-setting").value,
    accent:$("accent-setting").value,
    font:$("font-setting").value,
    bold:$("bold-setting").checked
  };

  localStorage.setItem(
    "kora-tv-settings",
    JSON.stringify(settings)
  );

  applySettings(settings);
}

[
  "theme-setting",
  "accent-setting",
  "font-setting",
  "bold-setting"
].forEach(id => {
  $(id).addEventListener("change",saveSettings);
});

$("reset-settings").addEventListener("click",()=>{
  settings = {...defaults};

  localStorage.setItem(
    "kora-tv-settings",
    JSON.stringify(settings)
  );

  applySettings(settings);
});

})();
