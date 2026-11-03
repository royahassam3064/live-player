javascript
(() => {
"use strict";

const $ = id => document.getElementById(id);
const video = $("iptv-video");

if(!video) return;

let mode = "xtream";
let channels = [];
let categories = [];
let activeCategory = "all";
let favoritesOnly = false;
let hls = null;

const STORE = "kora-iptv-local-v1";

const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#39;"
}[c]));

const saved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}");
  } catch {
    return {};
  }
};

const persist = (key,value) => {
  const data = saved();
  data[key] = value;
  localStorage.setItem(STORE,JSON.stringify(data));
};

const msg = (id,text,error=false) => {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle("error",error);
};

function setMode(next) {
  mode = next;

  document.querySelectorAll(".iptv-tab").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.iptvMode === next
    );
  });

  $("xtream-panel").hidden = next !== "xtream";
  $("m3u-panel").hidden = next !== "m3u";
}

document.querySelectorAll(".iptv-tab").forEach(button => {
  button.addEventListener("click",()=>{
    setMode(button.dataset.iptvMode);
  });
});

function cleanServer(value) {
  const u = new URL(value.trim());

  if(!["http:","https:"].includes(u.protocol)) {
    throw new Error("استخدم رابط http أو https");
  }

  return u.origin + u.pathname.replace(/\/+$/,"");
}

async function xtreamRequest(server,user,pass,params={}) {
  const u = new URL(
    server.replace(/\/+$/,"") + "/player_api.php"
  );

  u.searchParams.set("username",user);
  u.searchParams.set("password",pass);

  Object.entries(params).forEach(([key,value])=>{
    u.searchParams.set(key,value);
  });

  const response = await fetch(u.toString());

  if(!response.ok) {
    throw new Error("السيرفر لم يستجب");
  }

  return response.json();
}


// Xtream Codes

$("xt-connect").addEventListener("click",async()=>{
  const button = $("xt-connect");

  button.disabled = true;
  msg("xt-message","جارٍ الاتصال...");

  try {
    const server = cleanServer($("xt-server").value);
    const user = $("xt-user").value.trim();
    const pass = $("xt-pass").value;

    if(!user || !pass) {
      throw new Error("أدخل اسم المستخدم وكلمة المرور");
    }

    const [cats,streams] = await Promise.all([
      xtreamRequest(server,user,pass,{
        action:"get_live_categories"
      }),
      xtreamRequest(server,user,pass,{
        action:"get_live_streams"
      })
    ]);

    if(!Array.isArray(streams)) {
      throw new Error("بيانات القنوات غير صالحة");
    }

    channels = streams.map(c=>({
      id:String(c.stream_id),
      name:c.name || "قناة",
      logo:c.stream_icon || "",
      group:c.category_name || "عام",
      url:
        `${server}/live/${encodeURIComponent(user)}/`+
        `${encodeURIComponent(pass)}/`+
        `${encodeURIComponent(c.stream_id)}.`+
        `${(c.container_extension || "m3u8").replace(/[^a-z0-9]/gi,"")}`,
      kind:"xtream"
    }));

    categories = Array.isArray(cats)
      ? cats.map(c=>({
          id:String(c.category_id),
          name:c.category_name
        }))
      : [];

    persist("xtream",{server,user,pass});
    persist("channels",channels);
    persist("categories",categories);

    activeCategory = "all";

    renderCategories();
    renderChannels();

    msg("xt-message",`تم تحميل ${channels.length} قناة.`);

  } catch(error) {
    msg(
      "xt-message",
      error.message || "فشل الاتصال. تحقق من البيانات.",
      true
    );
  } finally {
    button.disabled = false;
  }
});


// M3U

function parseM3U(text) {
  const lines = text.replace(/^\uFEFF/,"").split(/\r?\n/);
  const output = [];

  let meta = null;

  for(const raw of lines) {
    const line = raw.trim();

    if(!line) continue;

    if(line.startsWith("#EXTINF")) {
      const title =
        line.split(",").slice(1).join(",").trim() || "قناة";

      const group =
        (line.match(/group-title="([^"]*)"/i) || [])[1] || "عام";

      const logo =
        (line.match(/tvg-logo="([^"]*)"/i) || [])[1] || "";

      meta = {
        name:title,
        group,
        logo
      };

    } else if(
      !line.startsWith("#") &&
      meta &&
      /^https?:\/\//i.test(line)
    ) {
      output.push({
        id:`m3u-${output.length}`,
        name:meta.name,
        group:meta.group,
        logo:meta.logo,
        url:line,
        kind:"m3u"
      });

      meta = null;
    }
  }

  return output;
}

$("m3u-file").addEventListener("change",async event=>{
  const file = event.target.files?.[0];

  if(file) {
    $("m3u-text").value = await file.text();
  }
});

$("m3u-load").addEventListener("click",async()=>{
  const button = $("m3u-load");

  button.disabled = true;
  msg("m3u-message","جارٍ قراءة القائمة...");

  try {
    let text = $("m3u-text").value.trim();
    const url = $("m3u-url").value.trim();

    if(!text && url) {
      const response = await fetch(url);

      if(!response.ok) {
        throw new Error("تعذر تنزيل القائمة");
      }

      text = await response.text();
    }

    if(!text) {
      throw new Error("أدخل رابط القائمة أو محتواها أو اختر ملفاً");
    }

    channels = parseM3U(text);

    if(!channels.length) {
      throw new Error("لم يتم العثور على قنوات صالحة");
    }

    categories = [
      ...new Set(channels.map(c=>c.group))
    ].map((name,index)=>({
      id:String(index),
      name
    }));

    persist("m3u-url",url);
    persist("channels",channels);
    persist("categories",categories);

    activeCategory = "all";

    renderCategories();
    renderChannels();

    msg("m3u-message",`تم تحميل ${channels.length} قناة.`);

  } catch(error) {
    msg(
      "m3u-message",
      error.message || "فشل تحميل القائمة.",
      true
    );
  } finally {
    button.disabled = false;
  }
});


// تصنيفات القنوات

function renderCategories() {
  const groups = [
    ...new Set(channels.map(c=>c.group || "عام"))
  ];

  $("channel-categories").innerHTML = [
    `<button class="category-chip ${activeCategory==="all"?"active":""}" data-category="all">الكل</button>`,
    ...groups.map(group=>`
      <button class="category-chip ${activeCategory===group?"active":""}"
              data-category="${esc(group)}">
        ${esc(group)}
      </button>
    `)
  ].join("");

  $("channel-categories")
    .querySelectorAll("[data-category]")
    .forEach(button=>{
      button.addEventListener("click",()=>{
        activeCategory = button.dataset.category;
        renderCategories();
        renderChannels();
      });
    });
}


// عرض القنوات والمفضلة

function renderChannels() {
  const fav = new Set(saved().favorites || []);

  const list = channels.filter(channel =>
    (activeCategory==="all" || channel.group===activeCategory) &&
    (!favoritesOnly || fav.has(channel.id))
  );

  $("channel-list").innerHTML = list.length
    ? list.map(channel=>`
      <article class="channel-row">
        <button class="channel-play" data-play="${esc(channel.id)}">
          <span class="channel-logo">
            ${
              channel.logo
              ? `<img src="${esc(channel.logo)}" alt="">`
              : "▶"
            }
          </span>

          <span class="channel-name">
            ${esc(channel.name)}
            <small>${esc(channel.group)}</small>
          </span>
        </button>

        <button class="favorite-btn ${fav.has(channel.id)?"saved":""}"
                data-fav="${esc(channel.id)}">
          ${fav.has(channel.id)?"★":"☆"}
        </button>
      </article>
    `).join("")
    : `<p class="empty-state">ماكو قنوات بهذا التصنيف.</p>`;

  $("channel-list")
    .querySelectorAll("[data-play]")
    .forEach(button=>{
      button.addEventListener("click",()=>{
        playChannel(
          channels.find(c=>c.id===button.dataset.play)
        );
      });
    });

  $("channel-list")
    .querySelectorAll("[data-fav]")
    .forEach(button=>{
      button.addEventListener("click",()=>{
        const set = new Set(saved().favorites || []);

        set.has(button.dataset.fav)
          ? set.delete(button.dataset.fav)
          : set.add(button.dataset.fav);

        persist("favorites",[...set]);
        renderChannels();
      });
    });
}


// تشغيل القناة

function playChannel(channel) {
  if(!channel) return;

  if(hls) {
    hls.destroy();
    hls = null;
  }

  video.pause();
  video.removeAttribute("src");
  video.load();

  $("player-title").textContent = channel.name;
  $("player-state").textContent = "جارٍ التشغيل...";

  const url = channel.url;

  if(
    /\.m3u8($|\?)/i.test(url) &&
    window.Hls &&
    Hls.isSupported()
  ) {
    hls = new Hls({
      enableWorker:true
    });

    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED,()=>{
      video.play().catch(()=>{});
    });

    hls.on(Hls.Events.ERROR,(_,data)=>{
      if(data.fatal) {
        $("player-state").textContent = "تعذر تشغيل القناة";
      }
    });

  } else if(
    video.canPlayType("application/vnd.apple.mpegurl") ||
    !(/\.m3u8($|\?)/i.test(url))
  ) {
    video.src = url;

    video.play().catch(()=>{
      $("player-state").textContent = "اضغط تشغيل";
    });

  } else {
    $("player-state").textContent = "صيغة البث غير مدعومة";
  }

  video.onplaying = ()=>{
    $("player-state").textContent = "يعمل الآن";
  };

  video.onerror = ()=>{
    $("player-state").textContent = "فشل التشغيل";
  };
}

$("show-favorites").addEventListener("click",()=>{
  favoritesOnly = !favoritesOnly;

  $("show-favorites").textContent =
    favoritesOnly ? "عرض الكل" : "☆ المفضلة";

  renderChannels();
});


// استعادة البيانات المحفوظة محلياً

const old = saved();

if(Array.isArray(old.channels)) {
  channels = old.channels;
  categories = old.categories || [];

  renderCategories();
  renderChannels();
}

if(old.xtream) {
  $("xt-server").value = old.xtream.server || "";
  $("xt-user").value = old.xtream.user || "";
  $("xt-pass").value = old.xtream.pass || "";
}

if(old["m3u-url"]) {
  $("m3u-url").value = old["m3u-url"];
}

window.addEventListener("beforeunload",()=>{
  if(hls) hls.destroy();
});

})();
