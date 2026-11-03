(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let channels = [];
  let favorites = new Set(
    JSON.parse(localStorage.getItem("kora_iptv_favs") || "[]")
  );

  let favoritesOnly = false;
  let hls = null;

  function status(message) {
    const el = $("iptv-status");
    if (el) el.textContent = message;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[c]));
  }

  function switchTab(tab) {
    $("iptv-m3u-form")?.classList.toggle("hidden", tab !== "m3u");
    $("iptv-xtream-form")?.classList.toggle("hidden", tab !== "xtream");

    document.querySelectorAll("[data-iptv-tab]").forEach(b => {
      b.classList.toggle("selected", b.dataset.iptvTab === tab);
    });
  }

  function parseM3U(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const result = [];
    let pending = null;

    for (const lineRaw of lines) {
      const line = lineRaw.trim();

      if (line.startsWith("#EXTINF")) {
        const name = line.split(",").slice(1).join(",").trim() || "قناة";
        const group = (line.match(/group-title="([^"]*)"/i) || [])[1] || "عام";
        const logo = (line.match(/tvg-logo="([^"]*)"/i) || [])[1] || "";

        pending = { name, group, logo };

      } else if (line && !line.startsWith("#") && pending) {
        result.push({ ...pending, url: line });
        pending = null;
      }
    }

    return result;
  }

  function renderChannels() {
    const box = $("channel-list");
    if (!box) return;

    const q = ($("channel-search")?.value || "").toLowerCase();

    const shown = channels.filter(c =>
      (!favoritesOnly || favorites.has(c.url)) &&
      (!q || c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
    );

    box.innerHTML = shown.length
      ? shown.map(c => `
        <div class="channel-row">
          <button type="button" class="channel-play" data-play="${channels.indexOf(c)}">
            ${esc(c.name)}
            <small>${esc(c.group)}</small>
          </button>
          <button type="button" class="fav-btn ${favorites.has(c.url) ? "is-fav" : ""}" data-fav="${esc(c.url)}">
            ${favorites.has(c.url) ? "★" : "☆"}
          </button>
        </div>
      `).join("")
      : `<div class="notice">ماكو قنوات تطابق البحث.</div>`;
  }

  function playChannel(channel) {
    const video = $("iptv-video");

    if (!video || !channel?.url) return;

    if (hls) {
      hls.destroy();
      hls = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();

    const url = channel.url;

    if (/\.m3u8($|\?)/i.test(url) && window.Hls && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          status("تعذر تشغيل القناة. قد يكون الرابط غير مدعوم أو يمنع الاتصال.");
        }
      });

    } else {
      video.src = url;
    }

    video.play().catch(() => {
      status("اضغط زر التشغيل داخل المشغل إذا ما بدأ الفيديو تلقائياً.");
    });

    status("تم اختيار: " + channel.name);
  }

  async function loadM3U() {
    try {
      let text = $("m3u-text")?.value.trim() || "";
      const file = $("m3u-file")?.files?.[0];

      if (file) {
        text = await file.text();
      }

      if (!text) {
        const url = $("m3u-url")?.value.trim();

        if (!url) {
          status("الصق القائمة أو أدخل رابطها أو اختر ملفاً.");
          return;
        }

        status("جار جلب القائمة...");

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        text = await response.text();
      }

      channels = parseM3U(text);
      favoritesOnly = false;
      renderChannels();

      status(
        channels.length
          ? `تم تحميل ${channels.length} قناة.`
          : "ما حصلت قنوات بالقائمة. تأكد من صيغة M3U."
      );

    } catch (error) {
      console.error(error);

      status(
        "فشل تحميل القائمة. قد يكون رابط M3U يمنع الوصول من المتصفح (CORS). جرّب رفع الملف أو لصق محتواه."
      );
    }
  }

  async function loadXtream() {
    const serverRaw = $("xt-server")?.value.trim();
    const username = $("xt-user")?.value.trim();
    const password = $("xt-pass")?.value;

    if (!serverRaw || !username || !password) {
      status("أدخل السيرفر واسم المستخدم وكلمة المرور.");
      return;
    }

    try {
      const server = new URL(serverRaw);

      status("جار الاتصال بسيرفر Xtream...");

      const api = new URL(
        server.origin + server.pathname.replace(/\/$/, "") + "/player_api.php"
      );

      api.search = new URLSearchParams({
        username,
        password,
        action: "get_live_streams"
      }).toString();

      const response = await fetch(api.toString());

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("استجابة السيرفر غير صحيحة");
      }

      channels = data.map(item => ({
        name: item.name || "قناة",
        group: item.category_name || item.category_id || "عام",
        logo: item.stream_icon || "",
        url: `${server.origin}${server.pathname.replace(/\/$/, "")}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${item.stream_id}.${item.container_extension || "m3u8"}`
      }));

      favoritesOnly = false;
      renderChannels();

      status(
        channels.length
          ? `تم الاتصال وتحميل ${channels.length} قناة.`
          : "ماكو قنوات مباشرة بهذا الحساب."
      );

    } catch (error) {
      console.error(error);
      status("تعذر الاتصال. تحقق من البيانات؛ بعض السيرفرات تمنع الاتصال من المتصفح (CORS).");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-iptv-tab]").forEach(b => {
      b.addEventListener("click", () => switchTab(b.dataset.iptvTab));
    });

    $("load-m3u")?.addEventListener("click", loadM3U);
    $("load-xtream")?.addEventListener("click", loadXtream);

    $("channel-search")?.addEventListener("input", renderChannels);

    $("show-favorites")?.addEventListener("click", () => {
      favoritesOnly = !favoritesOnly;
      renderChannels();
    });

    $("channel-list")?.addEventListener("click", event => {
      const play = event.target.closest("[data-play]");
      const fav = event.target.closest("[data-fav]");

      if (play) {
        playChannel(channels[Number(play.dataset.play)]);
      }

      if (fav) {
        const url = fav.dataset.fav;

        if (favorites.has(url)) {
          favorites.delete(url);
        } else {
          favorites.add(url);
        }

        localStorage.setItem(
          "kora_iptv_favs",
          JSON.stringify([...favorites])
        );

        renderChannels();
      }
    });
  });
})();
