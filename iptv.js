(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const MODE_KEY = "kora_iptv_mode";
  const FAV_KEY = "kora_iptv_favs";

  let channels = [];
  let favorites = new Set(
    JSON.parse(localStorage.getItem(FAV_KEY) || "[]")
  );
  let favoritesOnly = false;
  let hls = null;

  function status(message) {
    const el = $("iptv-status");
    if (el) el.textContent = message;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function setPlayerMode(mode, save = true) {
    if (!["fg", "m3u", "xtream"].includes(mode)) {
      mode = null;
    }

    $("iptv-mode-chooser")?.classList.toggle("hidden", Boolean(mode));
    $("iptv-player-settings")?.classList.toggle("hidden", !mode);
    $("iptv-fg-form")?.classList.toggle("hidden", mode !== "fg");
    $("iptv-m3u-form")?.classList.toggle("hidden", mode !== "m3u");
    $("iptv-xtream-form")?.classList.toggle("hidden", mode !== "xtream");

    const titles = {
      fg: "FG Code",
      m3u: "M3U",
      xtream: "Xtream Codes"
    };

    if ($("selected-player-title")) {
      $("selected-player-title").textContent =
        titles[mode] || "طريقة التشغيل";
    }

    if (save && mode) {
      localStorage.setItem(MODE_KEY, mode);
    }

    if (!mode && save) {
      localStorage.removeItem(MODE_KEY);
    }
  }

  function parseM3U(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const result = [];
    let pending = null;

    for (const raw of lines) {
      const line = raw.trim();

      if (line.startsWith("#EXTINF")) {
        const name =
          line.split(",").slice(1).join(",").trim() || "قناة";

        const group =
          (line.match(/group-title="([^"]*)"/i) || [])[1] || "عام";

        const logo =
          (line.match(/tvg-logo="([^"]*)"/i) || [])[1] || "";

        pending = { name, group, logo };

      } else if (line && !line.startsWith("#") && pending) {
        result.push({
          ...pending,
          url: line
        });

        pending = null;
      }
    }

    return result;
  }

  function renderChannels() {
    const box = $("channel-list");
    if (!box) return;

    const q = ($("channel-search")?.value || "").toLowerCase();

    const shown = channels.filter(channel =>
      (!favoritesOnly || favorites.has(channel.url)) &&
      (
        !q ||
        channel.name.toLowerCase().includes(q) ||
        channel.group.toLowerCase().includes(q)
      )
    );

    box.innerHTML = shown.length
      ? shown.map(channel => `
          <div class="channel-row">
            <button
              type="button"
              class="channel-play"
              data-play="${channels.indexOf(channel)}"
            >
              ${esc(channel.name)}
              <small>${esc(channel.group)}</small>
            </button>

            <button
              type="button"
              class="fav-btn"
              data-fav="${esc(channel.url)}"
            >
              ${favorites.has(channel.url) ? "★" : "☆"}
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

    if (
      /\.m3u8($|\?)/i.test(channel.url) &&
      window.Hls &&
      Hls.isSupported()
    ) {
      hls = new Hls();

      hls.loadSource(channel.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          status("تعذر تشغيل القناة. تحقق من الرابط.");
        }
      });

    } else {
      video.src = channel.url;
    }

    video.play().catch(() => {
      status("اضغط زر التشغيل داخل المشغل.");
    });

    status("تم اختيار: " + channel.name);
  }

  // FG CODE
  async function loadFG() {
    const input = $("fg-code")?.value.trim() || "";

    if (!input) {
      return status("أدخل كود FG أولاً.");
    }

    let code = input
      .replace(/^https?:\/\/fgcode\.org\//i, "")
      .replace(/^https?:\/\/www\.fgcode\.org\//i, "")
      .replace(/\/$/, "");

    if (!/^[a-z0-9_-]{3,80}$/i.test(code)) {
      return status("صيغة كود FG غير صحيحة.");
    }

    try {
      status("جارِ الاتصال بخدمة FG...");

      const fgUrl =
        "https://fgcode.org/" + encodeURIComponent(code);

      const response = await fetch(fgUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const content = await response.text();

      const parsed = parseM3U(content);

      if (!parsed.length) {
        throw new Error("FG did not return a readable M3U playlist");
      }

      channels = parsed;
      favoritesOnly = false;

      renderChannels();

      status("تم تحميل " + channels.length + " قناة من FG.");

    } catch (error) {
      console.error("FG Code error:", error);

      status(
        "تعذر تحميل FG. قد تكون الخدمة متوقفة أو تمنع الاتصال من المتصفح (CORS)."
      );
    }
  }

  // M3U
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
          return status("أدخل رابط M3U أو اختر ملفاً.");
        }

        status("جار تحميل القائمة...");

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
          ? "تم تحميل " + channels.length + " قناة."
          : "لم يتم العثور على قنوات M3U."
      );

    } catch (error) {
      console.error(error);

      status(
        "فشل تحميل القائمة. تحقق من الرابط أو جرّب رفع ملف M3U."
      );
    }
  }

  // XTREAM
  async function loadXtream() {
    const serverRaw = $("xt-server")?.value.trim();
    const username = $("xt-user")?.value.trim();
    const password = $("xt-pass")?.value;

    if (!serverRaw || !username || !password) {
      return status("أدخل السيرفر واسم المستخدم وكلمة المرور.");
    }

    try {
      const server = new URL(serverRaw);

      if (!["https:", "http:"].includes(server.protocol)) {
        throw new Error("Invalid protocol");
      }

      status("جار الاتصال بسيرفر Xtream...");

      const basePath = server.pathname.replace(/\/$/, "");

      const api = new URL(
        server.origin + basePath + "/player_api.php"
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
        throw new Error("Invalid response");
      }

      channels = data.map(item => ({
        name: item.name || "قناة",
        group: item.category_name || "عام",
        logo: item.stream_icon || "",
        url:
          server.origin +
          basePath +
          "/live/" +
          encodeURIComponent(username) +
          "/" +
          encodeURIComponent(password) +
          "/" +
          item.stream_id +
          "." +
          (item.container_extension || "m3u8")
      }));

      favoritesOnly = false;

      renderChannels();

      status("تم تحميل " + channels.length + " قناة.");

    } catch (error) {
      console.error(error);

      status(
        "تعذر الاتصال. تحقق من بيانات Xtream."
      );
    }
  }

  document.addEventListener("DOMContentLoaded", () => {

    setPlayerMode(
      localStorage.getItem(MODE_KEY),
      false
    );

    document.querySelectorAll("[data-player-mode]").forEach(button => {
      button.addEventListener("click", () => {
        setPlayerMode(button.dataset.playerMode);
      });
    });

    $("change-player-mode")?.addEventListener("click", () => {
      setPlayerMode(null);
    });

    $("connect-fg")?.addEventListener("click", loadFG);

    $("fg-code")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        loadFG();
      }
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
          FAV_KEY,
          JSON.stringify([...favorites])
        );

        renderChannels();
      }
    });

  });

})();