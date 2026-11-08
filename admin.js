(() => {
  "use strict";

  // =====================================
  // التحقق من الاتصال والإعدادات
  // =====================================

  const $ = id => document.getElementById(id);

  const loginMessage = $("login-message");

  if (!window.supabase) {
    loginMessage.textContent =
      "تعذر تحميل مكتبة Supabase. تحقق من الإنترنت.";

    return;
  }

  if (
    !window.SUPABASE_URL ||
    !window.SUPABASE_PUBLISHABLE_KEY
  ) {
    loginMessage.textContent =
      "إعدادات Supabase غير موجودة. تحقق من config.js.";

    return;
  }

  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );

  const loginPanel = $("login-panel");
  const adminPanel = $("admin-panel");

  const formMessage = $("form-message");
  const apiMessage = $("api-message");
  const channelMessage = $("channel-message");

  const form = $("match-form");
  const rows = $("admin-matches");
  const apiRows = $("api-matches");

  const channelForm = $("channel-form");
  const channelRows = $("admin-channels");

  let loadingMatches = false;
  let loadingChannels = false;
  let editingChannelName = null;
  let sessionRequest = 0;

  // =====================================
  // حماية النصوص
  // =====================================

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));

  // =====================================
  // التاريخ وتوقيت بغداد
  // =====================================

  function localInputValue(iso) {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function baghdadInputToISO(value) {
    if (!value) {
      throw new Error("يرجى تحديد موعد المباراة.");
    }

    const date = new Date(`${value}:00+03:00`);

    if (Number.isNaN(date.getTime())) {
      throw new Error("موعد المباراة غير صحيح.");
    }

    return date.toISOString();
  }

  // =====================================
  // رسائل الأخطاء
  // =====================================

  function showError(element, error, prefix = "") {
    console.error(error);

    element.textContent =
      prefix + (error?.message || "حدث خطأ غير معروف.");
  }

  // =====================================
  // تسجيل الدخول والجلسة
  // =====================================

  async function showSession() {
    const request = ++sessionRequest;

    try {
      const { data, error } = await client.auth.getSession();

      if (error) throw error;

      if (request !== sessionRequest) return;

      const session = data.session;

      loginPanel.hidden = !!session;
      adminPanel.hidden = !session;

      if (session) {
        await Promise.all([
          loadMatches(),
          loadChannels()
        ]);
      }

    } catch (error) {
      showError(
        loginMessage,
        error,
        "تعذر التحقق من تسجيل الدخول: "
      );
    }
  }

  $("login-btn").addEventListener("click", async () => {
    const button = $("login-btn");

    loginMessage.textContent = "";

    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email || !password) {
      loginMessage.textContent =
        "يرجى إدخال البريد الإلكتروني وكلمة المرور.";

      return;
    }

    button.disabled = true;
    button.textContent = "جارٍ الدخول...";

    try {
      const { error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      loginMessage.textContent = "";

      await showSession();

    } catch (error) {
      showError(loginMessage, error);

    } finally {
      button.disabled = false;
      button.textContent = "دخول";
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    try {
      const { error } = await client.auth.signOut();

      if (error) throw error;

      resetForm();
      resetChannelForm();

      await showSession();

    } catch (error) {
      alert("تعذر تسجيل الخروج: " + error.message);
    }
  });

  // =====================================
  // إضافة وتعديل المباريات
  // =====================================

  function resetForm() {
    form.reset();

    $("match-id").value = "";
    $("form-title").textContent = "إضافة مباراة";
    $("cancel-edit").hidden = true;

    formMessage.textContent = "";
  }

  $("cancel-edit").addEventListener("click", resetForm);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    formMessage.textContent = "جارٍ الحفظ...";

    const id = $("match-id").value;

    let matchTime;

    try {
      matchTime = baghdadInputToISO(
        $("match-time").value
      );
    } catch (error) {
      formMessage.textContent = error.message;
      return;
    }

    const record = {
      home_team: $("home-team").value.trim(),
      away_team: $("away-team").value.trim(),

      home_logo:
        $("home-logo").value.trim() || null,

      away_logo:
        $("away-logo").value.trim() || null,

      competition:
        $("competition").value.trim() || null,

      match_time: matchTime,

      channel:
        $("channel").value || null,

      stream_url:
        $("stream-url").value.trim() || null
    };

    if (!record.home_team || !record.away_team) {
      formMessage.textContent =
        "يرجى إدخال اسمي الفريقين.";

      return;
    }

    try {
      const result = id
        ? await client
            .from("matches")
            .update(record)
            .eq("id", id)
        : await client
            .from("matches")
            .insert(record);

      if (result.error) throw result.error;

      formMessage.textContent =
        "تم حفظ المباراة بنجاح.";

      resetForm();

      await loadMatches();

    } catch (error) {
      showError(
        formMessage,
        error,
        "خطأ أثناء الحفظ: "
      );
    }
  });

  // =====================================
  // استيراد المباريات من API
  // =====================================

  $("fetch-matches-btn").addEventListener(
    "click",
    fetchMatches
  );

  async function fetchMatches() {
    const button = $("fetch-matches-btn");

    button.disabled = true;
    apiMessage.textContent = "جارٍ جلب المباريات...";
    apiRows.innerHTML = "";

    try {
      const { data, error } =
        await client.functions.invoke(
          "football-matches",
          { method: "GET" }
        );

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const matches = data?.matches || [];

      if (!matches.length) {
        apiMessage.textContent =
          "لم يتم العثور على مباريات.";

        return;
      }

      apiMessage.textContent =
        `تم جلب ${matches.length} مباراة بنجاح.`;

      apiRows.innerHTML = matches.map(match => {
        const home =
          match.homeTeam?.name || "غير معروف";

        const away =
          match.awayTeam?.name || "غير معروف";

        const competition =
          match.competition?.name || "بطولة غير معروفة";

        const date = match.utcDate
          ? new Date(match.utcDate).toLocaleString(
              "ar-IQ",
              { timeZone: "Asia/Baghdad" }
            )
          : "موعد غير معروف";

        return `
          <div class="admin-row">
            <div>
              <strong>${esc(home)} × ${esc(away)}</strong>
              <small>${esc(competition)}</small>
              <small>${esc(date)}</small>
            </div>

            <button
              class="primary import-btn"
              data-id="${esc(match.id)}"
              type="button"
            >
              إضافة المباراة
            </button>
          </div>
        `;
      }).join("");

      apiRows.querySelectorAll(".import-btn")
        .forEach(button => {
          button.addEventListener("click", () => {
            const match = matches.find(
              item => String(item.id) === button.dataset.id
            );

            if (match) {
              importMatch(match);
            }
          });
        });

    } catch (error) {
      showError(
        apiMessage,
        error,
        "تعذر جلب المباريات: "
      );

    } finally {
      button.disabled = false;
    }
  }

  // =====================================
  // استيراد مباراة مع الاحتفاظ بالقناة
  // =====================================

  async function importMatch(match) {
    const record = {
      external_match_id: match.id,

      home_team:
        match.homeTeam?.name || "غير معروف",

      away_team:
        match.awayTeam?.name || "غير معروف",

      home_logo:
        match.homeTeam?.crest || null,

      away_logo:
        match.awayTeam?.crest || null,

      competition:
        match.competition?.name || null,

      match_time:
        match.utcDate,

      match_status:
        match.status || null,

      home_score:
        match.score?.fullTime?.home ?? null,

      away_score:
        match.score?.fullTime?.away ?? null
    };

    apiMessage.textContent = "جارٍ إضافة المباراة...";

    try {
      const { data: existing, error: findError } =
        await client
          .from("matches")
          .select("id, channel, stream_url")
          .eq("external_match_id", match.id)
          .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        record.channel = existing.channel;
        record.stream_url = existing.stream_url;
      }

      const { error } = await client
        .from("matches")
        .upsert(record, {
          onConflict: "external_match_id"
        });

      if (error) throw error;

      apiMessage.textContent =
        "تم تحديث المباراة مع الحفاظ على القناة ورابط البث.";

      await loadMatches();

    } catch (error) {
      showError(
        apiMessage,
        error,
        "خطأ أثناء إضافة المباراة: "
      );
    }
  }

  // =====================================
  // تحميل المباريات
  // =====================================

  async function loadMatches() {
    if (loadingMatches) return;

    loadingMatches = true;

    rows.innerHTML =
      `<p class="notice">جارٍ التحميل...</p>`;

    try {
      const { data, error } = await client
        .from("matches")
        .select("*")
        .order("match_time", {
          ascending: true
        });

      if (error) throw error;

      if (!data?.length) {
        rows.innerHTML =
          `<p class="notice">لا توجد مباريات.</p>`;

        return;
      }

      rows.innerHTML = data.map(match => `
        <div class="admin-row">

          <div>
            <strong>
              ${esc(match.home_team)} × ${esc(match.away_team)}
            </strong>

            <small>
              ${esc(match.competition || "بدون بطولة")}
            </small>

            <small>
              ${esc(
                new Date(match.match_time).toLocaleString(
                  "ar-IQ",
                  { timeZone: "Asia/Baghdad" }
                )
              )}
            </small>

            <small>
              القناة: ${esc(match.channel || "لم يتم تحديد قناة")}
            </small>

            <small>
              ${match.stream_url
                ? "رابط البث مضاف ✓"
                : "رابط البث غير مضاف"}
            </small>
          </div>

          <div class="row-actions">

            <button
              class="secondary edit-btn"
              data-id="${esc(match.id)}"
              type="button"
            >
              تعديل
            </button>

            <button
              class="danger delete-btn"
              data-id="${esc(match.id)}"
              type="button"
            >
              حذف
            </button>

          </div>

        </div>
      `).join("");

      rows.querySelectorAll(".edit-btn")
        .forEach(button => {
          button.addEventListener("click", () => {
            const match = data.find(
              item => item.id === button.dataset.id
            );

            if (!match) return;

            $("match-id").value = match.id;
            $("home-team").value = match.home_team || "";
            $("away-team").value = match.away_team || "";
            $("home-logo").value = match.home_logo || "";
            $("away-logo").value = match.away_logo || "";
            $("competition").value = match.competition || "";

            $("match-time").value =
              localInputValue(match.match_time);

            $("stream-url").value = match.stream_url || "";
            $("channel").value = match.channel || "";

            $("form-title").textContent = "تعديل مباراة";
            $("cancel-edit").hidden = false;

            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });
          });
        });

      rows.querySelectorAll(".delete-btn")
        .forEach(button => {
          button.addEventListener("click", async () => {
            if (!confirm("متأكد تريد حذف هذه المباراة؟")) {
              return;
            }

            try {
              const { error } = await client
                .from("matches")
                .delete()
                .eq("id", button.dataset.id);

              if (error) throw error;

              await loadMatches();

            } catch (error) {
              alert("تعذر الحذف: " + error.message);
            }
          });
        });

    } catch (error) {
      rows.innerHTML =
        `<p class="notice error">${esc(error.message)}</p>`;

    } finally {
      loadingMatches = false;
    }
  }

  // =====================================
  // إدارة القنوات
  // =====================================

  function resetChannelForm() {
    channelForm.reset();

    editingChannelName = null;

    $("channel-name").disabled = false;

    $("save-channel-btn").textContent =
      "حفظ القناة";

    $("cancel-channel-edit").hidden = true;

    channelMessage.textContent = "";
  }

  $("cancel-channel-edit").addEventListener(
    "click",
    resetChannelForm
  );

  async function loadChannels() {
    if (loadingChannels) return;

    loadingChannels = true;

    channelRows.innerHTML =
      `<p class="notice">جارٍ تحميل القنوات...</p>`;

    try {
      const { data, error } = await client
        .from("tv_channels")
        .select("id, channel_name, stream_url")
        .order("channel_name");

      if (error) throw error;

      if (!data?.length) {
        channelRows.innerHTML =
          `<p class="notice">لا توجد قنوات محفوظة.</p>`;

        return;
      }

      channelRows.innerHTML = data.map(channel => `
        <div class="admin-row">

          <div>
            <strong>${esc(channel.channel_name)}</strong>

            <small>
              ${channel.stream_url
                ? "رابط المشغّل محفوظ ✓"
                : "رابط المشغّل غير مضاف"}
            </small>
          </div>

          <div class="row-actions">

            <button
              class="secondary channel-edit-btn"
              data-name="${esc(channel.channel_name)}"
              type="button"
            >
              تعديل الرابط
            </button>

          </div>

        </div>
      `).join("");

      channelRows.querySelectorAll(".channel-edit-btn")
        .forEach(button => {
          button.addEventListener("click", () => {
            const channel = data.find(
              item => item.channel_name === button.dataset.name
            );

            if (!channel) return;

            editingChannelName = channel.channel_name;

            $("channel-name").value =
              channel.channel_name;

            $("channel-stream-url").value =
              channel.stream_url || "";

            $("channel-name").disabled = true;

            $("save-channel-btn").textContent =
              "تحديث القناة";

            $("cancel-channel-edit").hidden = false;

            channelMessage.textContent =
              "أنت تعدّل رابط هذه القناة.";

            channelForm.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
          });
        });

    } catch (error) {
      channelRows.innerHTML =
        `<p class="notice error">${esc(error.message)}</p>`;

    } finally {
      loadingChannels = false;
    }
  }

  channelForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("channel-name").value.trim();
    const rawUrl = $("channel-stream-url").value.trim();

    if (!name || !rawUrl) {
      channelMessage.textContent =
        "يرجى إدخال اسم القناة والرابط.";

      return;
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(rawUrl);

      if (
        parsedUrl.protocol !== "https:" &&
        parsedUrl.protocol !== "http:"
      ) {
        throw new Error("رابط غير مدعوم");
      }

    } catch {
      channelMessage.textContent =
        "الرابط غير صحيح. تأكد من كتابته كاملاً.";

      return;
    }

    const saveButton = $("save-channel-btn");

    saveButton.disabled = true;

    channelMessage.textContent =
      "جارٍ حفظ القناة...";

    try {
      let result;

      if (editingChannelName) {
        result = await client
          .from("tv_channels")
          .update({
            stream_url: parsedUrl.href
          })
          .eq("channel_name", editingChannelName);

      } else {
        result = await client
          .from("tv_channels")
          .upsert({
            channel_name: name,
            stream_url: parsedUrl.href
          }, {
            onConflict: "channel_name"
          });
      }

      if (result.error) throw result.error;

      channelMessage.textContent =
        "تم حفظ القناة بنجاح.";

      resetChannelForm();

      await loadChannels();

    } catch (error) {
      showError(
        channelMessage,
        error,
        "تعذر حفظ القناة: "
      );

    } finally {
      saveButton.disabled = false;
    }
  });

  // =====================================
  // مراقبة تسجيل الدخول
  // =====================================

  client.auth.onAuthStateChange(() => {
    setTimeout(showSession, 0);
  });

  // تشغيل الصفحة
  showSession();

})();
