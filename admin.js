(() => {
  "use strict";

  if (
    !window.supabase ||
    !window.SUPABASE_URL ||
    !window.SUPABASE_PUBLISHABLE_KEY
  ) {
    console.error("Supabase configuration is missing.");
    return;
  }

  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );

  const $ = id => document.getElementById(id);

  const loginPanel = $("login-panel");
  const adminPanel = $("admin-panel");

  const loginMessage = $("login-message");
  const formMessage = $("form-message");
  const apiMessage = $("api-message");

  const form = $("match-form");
  const rows = $("admin-matches");
  const apiRows = $("api-matches");

  let loadingMatches = false;

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));

  // تحويل التاريخ إلى توقيت بغداد
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

  // تحويل وقت بغداد إلى ISO
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

  // إظهار جلسة الإدارة
  async function showSession() {
    try {
      const { data, error } = await client.auth.getSession();

      if (error) {
        throw error;
      }

      const session = data.session;

      loginPanel.hidden = !!session;
      adminPanel.hidden = !session;

      if (session) {
        await loadMatches();
      }

    } catch (error) {
      console.error("Session error:", error);
      loginMessage.textContent = "تعذر التحقق من تسجيل الدخول.";
    }
  }

  // تسجيل الدخول
  $("login-btn").addEventListener("click", async () => {
    loginMessage.textContent = "جارٍ تسجيل الدخول...";

    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email || !password) {
      loginMessage.textContent =
        "يرجى إدخال البريد الإلكتروني وكلمة المرور.";
      return;
    }

    const { error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      loginMessage.textContent = error.message;
      return;
    }

    loginMessage.textContent = "";
    await showSession();
  });

  // تسجيل الخروج
  $("logout-btn").addEventListener("click", async () => {
    await client.auth.signOut();
    await showSession();
  });

  // إعادة ضبط النموذج
  function resetForm() {
    form.reset();

    $("match-id").value = "";
    $("form-title").textContent = "إضافة مباراة";

    $("cancel-edit").hidden = true;

    formMessage.textContent = "";
  }

  $("cancel-edit").addEventListener("click", resetForm);

  // حفظ المباراة
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

      if (result.error) {
        throw result.error;
      }

      formMessage.textContent =
        "تم حفظ المباراة بنجاح.";

      resetForm();

      await loadMatches();

    } catch (error) {
      formMessage.textContent =
        "خطأ أثناء الحفظ: " + error.message;
    }
  });

  // جلب المباريات من API
  $("fetch-matches-btn").addEventListener(
    "click",
    fetchMatches
  );

  async function fetchMatches() {
    const button = $("fetch-matches-btn");

    button.disabled = true;

    apiMessage.textContent =
      "جارٍ جلب المباريات...";

    apiRows.innerHTML = "";

    try {
      const { data, error } =
        await client.functions.invoke(
          "football-matches",
          {
            method: "GET"
          }
        );

      if (error) {
        throw error;
      }

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
              <strong>
                ${esc(home)} × ${esc(away)}
              </strong>

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
      apiMessage.textContent =
        "تعذر جلب المباريات: " + error.message;

    } finally {
      button.disabled = false;
    }
  }

  // استيراد مباراة
// استيراد مباراة مع الحفاظ على القناة ورابط البث
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
    // البحث عن المباراة إذا كانت موجودة
    const { data: existing, error: findError } = await client
      .from("matches")
      .select("id, channel, stream_url")
      .eq("external_match_id", match.id)
      .maybeSingle();

    if (findError) throw findError;

    // الاحتفاظ بالقناة ورابط البث السابقين
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
      "تم تحديث المباراة بنجاح مع الحفاظ على القناة ورابط البث.";

    await loadMatches();

  } catch (error) {
    apiMessage.textContent =
      "خطأ أثناء إضافة المباراة: " + error.message;
  }
}

  // تحميل المباريات
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

      if (error) {
        throw error;
      }

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
              القناة:
              ${esc(match.channel || "لم يتم تحديد قناة")}
            </small>

            <small>
              ${
                match.stream_url
                  ? "رابط البث مضاف ✓"
                  : "رابط البث غير مضاف"
              }
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

      // تعديل المباراة
      rows.querySelectorAll(".edit-btn")
        .forEach(button => {
          button.addEventListener("click", () => {
            const match = data.find(
              item => item.id === button.dataset.id
            );

            if (!match) return;

            $("match-id").value = match.id;

            $("home-team").value =
              match.home_team || "";

            $("away-team").value =
              match.away_team || "";

            $("home-logo").value =
              match.home_logo || "";

            $("away-logo").value =
              match.away_logo || "";

            $("competition").value =
              match.competition || "";

            $("match-time").value =
              localInputValue(match.match_time);

            $("stream-url").value =
              match.stream_url || "";

            $("channel").value =
              match.channel || "";

            $("form-title").textContent =
              "تعديل مباراة";

            $("cancel-edit").hidden = false;

            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });
          });
        });

      // حذف المباراة
      rows.querySelectorAll(".delete-btn")
        .forEach(button => {
          button.addEventListener("click", async () => {
            if (!confirm("متأكد تريد حذف هذه المباراة؟")) {
              return;
            }

            const { error } = await client
              .from("matches")
              .delete()
              .eq("id", button.dataset.id);

            if (error) {
              alert("تعذر الحذف: " + error.message);
            } else {
              await loadMatches();
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

  // مراقبة تسجيل الدخول
  client.auth.onAuthStateChange(() => {
    showSession();
  });

  showSession();

})();
