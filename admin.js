(() => {
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

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));

  function localInputValue(iso) {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(d).reduce((o, p) => {
      o[p.type] = p.value;
      return o;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function baghdadInputToISO(value) {
    return new Date(`${value}:00+03:00`).toISOString();
  }

  async function showSession() {
    const { data } = await client.auth.getSession();
    const session = data.session;

    loginPanel.hidden = !!session;
    adminPanel.hidden = !session;

    if (session) loadMatches();
  }

  $("login-btn").addEventListener("click", async () => {
    loginMessage.textContent = "جارٍ تسجيل الدخول...";

    const { error } = await client.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    loginMessage.textContent = error ? error.message : "";

    if (!error) showSession();
  });

  $("logout-btn").addEventListener("click", async () => {
    await client.auth.signOut();
    showSession();
  });

  function resetForm() {
    form.reset();
    $("match-id").value = "";
    $("form-title").textContent = "إضافة مباراة";
    $("cancel-edit").hidden = true;
    formMessage.textContent = "";
  }

  $("cancel-edit").addEventListener("click", resetForm);

  form.addEventListener("submit", async e => {
    e.preventDefault();

    formMessage.textContent = "جارٍ الحفظ...";

    const id = $("match-id").value;

    const record = {
      home_team: $("home-team").value.trim(),
      away_team: $("away-team").value.trim(),
      home_logo: $("home-logo").value.trim() || null,
      away_logo: $("away-logo").value.trim() || null,
      competition: $("competition").value.trim() || null,
      match_time: baghdadInputToISO($("match-time").value),
      stream_url: $("stream-url").value.trim() || null
    };

    const result = id
      ? await client.from("matches").update(record).eq("id", id)
      : await client.from("matches").insert(record);

    if (result.error) {
      formMessage.textContent = "خطأ: " + result.error.message;
      return;
    }

    formMessage.textContent = "تم حفظ المباراة بنجاح.";
    resetForm();
    loadMatches();
  });

  // جلب المباريات من Edge Function
  $("fetch-matches-btn").addEventListener("click", fetchMatches);

  async function fetchMatches() {
    const btn = $("fetch-matches-btn");

    btn.disabled = true;
    apiMessage.textContent = "جارٍ جلب المباريات...";
    apiRows.innerHTML = "";

    try {
      const { data, error } = await client.functions.invoke(
        "football-matches",
        { method: "GET" }
      );

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const matches = data?.matches || [];

      if (!matches.length) {
        apiMessage.textContent = "لم يتم العثور على مباريات.";
        return;
      }

      apiMessage.textContent =
        `تم جلب ${matches.length} مباراة بنجاح.`;

      apiRows.innerHTML = matches.map(m => {
        const home = m.homeTeam?.name || "غير معروف";
        const away = m.awayTeam?.name || "غير معروف";
        const competition = m.competition?.name || "بطولة غير معروفة";

        return `
          <div class="admin-row">
            <div>
              <strong>${esc(home)} × ${esc(away)}</strong>
              <small>${esc(competition)}</small>
              <small>${new Date(m.utcDate).toLocaleString("ar-IQ", {
                timeZone: "Asia/Baghdad"
              })}</small>
            </div>

            <button class="primary import-btn"
              data-id="${esc(m.id)}">
              إضافة المباراة
            </button>
          </div>
        `;
      }).join("");

      apiRows.querySelectorAll(".import-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const match = matches.find(
            m => String(m.id) === btn.dataset.id
          );

          if (match) importMatch(match);
        });
      });

    } catch (error) {
      apiMessage.textContent =
        "تعذر جلب المباريات: " + error.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function importMatch(m) {
    const record = {
      external_match_id: m.id,
      home_team: m.homeTeam?.name || "غير معروف",
      away_team: m.awayTeam?.name || "غير معروف",
      home_logo: m.homeTeam?.crest || null,
      away_logo: m.awayTeam?.crest || null,
      competition: m.competition?.name || null,
      match_time: m.utcDate,
      match_status: m.status || null,
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null
    };

    apiMessage.textContent = "جارٍ إضافة المباراة...";

    const { error } = await client
      .from("matches")
      .upsert(record, { onConflict: "external_match_id" });

    if (error) {
      apiMessage.textContent = "خطأ: " + error.message;
      return;
    }

    apiMessage.textContent =
      "تمت إضافة المباراة بنجاح. أضف رابط البث من قائمة المباريات.";

    loadMatches();
  }

  async function loadMatches() {
    rows.innerHTML = `<p class="notice">جارٍ التحميل...</p>`;

    const { data, error } = await client
      .from("matches")
      .select("*")
      .order("match_time", { ascending: true });

    if (error) {
      rows.innerHTML =
        `<p class="notice error">${esc(error.message)}</p>`;
      return;
    }

    if (!data?.length) {
      rows.innerHTML = `<p class="notice">لا توجد مباريات.</p>`;
      return;
    }

    rows.innerHTML = data.map(m => `
      <div class="admin-row">
        <div>
          <strong>${esc(m.home_team)} × ${esc(m.away_team)}</strong>
          <small>${esc(m.competition || "بدون بطولة")}</small>
          <small>${new Date(m.match_time).toLocaleString("ar-IQ", {
            timeZone: "Asia/Baghdad"
          })}</small>
          <small>${m.stream_url ? "رابط البث مضاف ✓" : "رابط البث غير مضاف"}</small>
        </div>

        <div class="row-actions">
          <button class="secondary edit-btn" data-id="${esc(m.id)}">
            تعديل
          </button>
          <button class="danger delete-btn" data-id="${esc(m.id)}">
            حذف
          </button>
        </div>
      </div>
    `).join("");

    rows.querySelectorAll(".edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const m = data.find(x => x.id === btn.dataset.id);

        $("match-id").value = m.id;
        $("home-team").value = m.home_team || "";
        $("away-team").value = m.away_team || "";
        $("home-logo").value = m.home_logo || "";
        $("away-logo").value = m.away_logo || "";
        $("competition").value = m.competition || "";
        $("match-time").value = localInputValue(m.match_time);
        $("stream-url").value = m.stream_url || "";

        $("form-title").textContent = "تعديل مباراة";
        $("cancel-edit").hidden = false;

        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    rows.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("متأكد تريد حذف هذه المباراة؟")) return;

        const { error } = await client
          .from("matches")
          .delete()
          .eq("id", btn.dataset.id);

        if (error) alert("تعذر الحذف: " + error.message);
        else loadMatches();
      });
    });
  }

  client.auth.onAuthStateChange(() => showSession());
  showSession();
})();
