/* Tompkins Software Systems home page: the drafting table and the live demos.
   No dependencies. Nothing is recorded or sent anywhere. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }
  function money(n) { return "$" + fmt(Math.round(n)); }
  function fill(range) {
    var min = Number(range.min || 0), max = Number(range.max || 100), v = Number(range.value);
    range.style.setProperty("--fill", ((v - min) / (max - min) * 100) + "%");
  }
  function wireRange(range, fn) {
    fill(range);
    range.addEventListener("input", function () { fill(range); fn(); });
  }

  /* =====================================================================
     1. The drafting table
     ===================================================================== */
  var AUD = {
    works: { label: "Public works", org: "a public works department", unit: ["crew member", "crew members"], app: "Streets Division", preset: ["training", "incidents", "inspections"],
      modules: ["training", "incidents", "inspections", "workorders", "inventory", "scheduling", "photos", "offline", "reports"] },
    city: { label: "City hall", org: "a city or county office", unit: ["staff member", "staff members"], app: "Clerk's Office", preset: ["permits", "portal", "payments"],
      modules: ["permits", "forms", "portal", "payments", "records", "scheduling", "inspections", "reports"] },
    biz: { label: "Small business", org: "a small business", unit: ["employee", "employees"], app: "Shop Manager", preset: ["scheduling", "workorders", "invoices"],
      modules: ["scheduling", "workorders", "invoices", "portal", "inventory", "photos", "offline", "reports"] },
    np: { label: "Nonprofit", org: "a nonprofit", unit: ["staff member or volunteer", "staff and volunteers"], app: "Program Office", preset: ["volunteers", "donations", "events"],
      modules: ["volunteers", "donations", "events", "portal", "forms", "training", "records", "reports"] },
    idea: { label: "My own idea", org: "your own venture", unit: ["user", "users"], app: "Your App", preset: ["accounts", "portal", "payments"],
      modules: ["accounts", "portal", "payments", "licensing", "content", "notifications", "offline", "reports"] }
  };

  var MOD = {
    training: { short: "training", label: "Training and quizzes", does: "annual training with a quiz per module, certificates, and reminders before anything is overdue" },
    incidents: { short: "incident reporting", label: "Incident reports", does: "incident reports with statements, diagrams, and an investigation that has to be finished before it closes" },
    inspections: { short: "inspections", label: "Inspections and checklists", does: "inspections and audits from checklists, with findings assigned to a person and a date" },
    workorders: { short: "work order", label: "Work orders", does: "work orders from request to done, with who has it and what it cost" },
    inventory: { short: "inventory", label: "Inventory and assets", does: "inventory and asset tracking with reorder points" },
    scheduling: { short: "scheduling", label: "Scheduling and shifts", does: "schedules and shifts that people can see from their phone" },
    photos: { short: "photo", label: "Photos and diagrams", does: "photos and marked-up diagrams attached to the record they belong to" },
    offline: { short: "field", label: "Works offline in the field", does: "field use with no signal, syncing when the truck is back in range" },
    reports: { short: "reporting", label: "Reports for leadership", does: "a one-page roll-up for the people who approve the budget" },
    permits: { short: "permit", label: "Permits and applications", does: "permit applications with a queue, status, and fees" },
    forms: { short: "forms", label: "Online forms", does: "online forms that replace the PDF nobody can fill in on a phone" },
    portal: { short: "portal", label: "Customer or member portal", does: "a portal where customers, residents, or members sign in and see where things stand" },
    payments: { short: "payment", label: "Payments and fees", does: "payments and fees taken online, with receipts" },
    invoices: { short: "invoicing", label: "Invoices and estimates", does: "estimates and invoices sent from the job, paid online" },
    records: { short: "records", label: "Records and documents", does: "records and documents that are searchable and retained on a schedule" },
    volunteers: { short: "volunteer", label: "Volunteers and hours", does: "volunteer sign-up and hours tracking" },
    donations: { short: "donation", label: "Donations and goals", does: "donations with goals, receipts, and year-end statements" },
    events: { short: "event", label: "Events and sign-ups", does: "events with sign-ups, reminders, and attendance" },
    accounts: { short: "account", label: "Accounts and roles", does: "accounts with roles, so each person sees only what they should" },
    licensing: { short: "licensing", label: "Licenses you sell", does: "licensing, so you can sell seats or subscriptions under your own name" },
    content: { short: "content", label: "Content you publish", does: "content you publish and update without a developer" },
    notifications: { short: "notification", label: "Email and text notifications", does: "email and text notifications when something needs attention" }
  };

  var PLAT = {
    browser: { label: "Any browser", runs: "in any browser, nothing to install" },
    server: { label: "Your own server", runs: "on a server your organization controls" },
    hosted: { label: "We host it", runs: "hosted and kept running by us" },
    app: { label: "Phone app", runs: "as an iOS and Android app, with the web version alongside" }
  };

  var PEOPLE = [1, 3, 5, 10, 15, 25, 40, 60, 100, 150, 250, 500];

  var state = { aud: "works", people: 5, modules: ["training", "incidents", "inspections"], plat: "browser", device: window.innerWidth < 640 ? "phone" : "desktop", deviceAuto: true };
  var prevModules = [];

  var table = document.getElementById("table");
  if (table) initTable();

  function initTable() {
    var audSeg = table.querySelector("[data-aud]");
    var chips = table.querySelector("[data-chips]");
    var peopleRange = table.querySelector("[data-people]");
    var peopleOut = table.querySelector("[data-people-out]");
    var platSeg = table.querySelector("[data-plat]");
    var devSeg = table.querySelector("[data-device]");
    var device = table.querySelector("[data-preview]");
    var charter = table.querySelector("[data-charter]");
    var copyBtn = table.querySelector("[data-copy]");
    var sendBtn = table.querySelector("[data-send]");
    var copied = table.querySelector("[data-copied]");

    devSeg.querySelector('input[value="' + state.device + '"]').checked = true;
    peopleRange.min = 0; peopleRange.max = PEOPLE.length - 1; peopleRange.value = PEOPLE.indexOf(25);
    state.people = PEOPLE[Number(peopleRange.value)];

    audSeg.addEventListener("change", function (e) {
      if (e.target.name !== "aud") return;
      state.aud = e.target.value;
      state.modules = AUD[state.aud].preset.slice();
      renderChips();
      update();
    });
    platSeg.addEventListener("change", function (e) {
      if (e.target.name !== "plat") return;
      state.plat = e.target.value;
      if (state.deviceAuto) {
        state.device = state.plat === "app" ? "phone" : "desktop";
        devSeg.querySelector('input[value="' + state.device + '"]').checked = true;
      }
      update();
    });
    devSeg.addEventListener("change", function (e) {
      if (e.target.name !== "device") return;
      state.device = e.target.value;
      state.deviceAuto = false;
      update();
    });
    wireRange(peopleRange, function () { state.people = PEOPLE[Number(peopleRange.value)]; update(); });
    chips.addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      var id = b.getAttribute("data-mod");
      var i = state.modules.indexOf(id);
      if (i >= 0) state.modules.splice(i, 1); else state.modules.push(id);
      b.setAttribute("aria-pressed", i >= 0 ? "false" : "true");
      update();
    });
    copyBtn.addEventListener("click", function () {
      var text = charterText();
      function done() { copied.hidden = false; setTimeout(function () { copied.hidden = true; }, 2500); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else { fallbackCopy(text); done(); }
    });

    window.addEventListener("resize", fitScreen);
    function fitScreen() {
      var screen = device.querySelector(".screen");
      if (state.device !== "desktop") { screen.style.transform = ""; device.style.height = ""; return; }
      var s = Math.min(1, device.clientWidth / 720);
      screen.style.transform = "scale(" + s + ")";
      device.style.height = Math.round(410 * s) + "px";
    }

    // Drafting crosshair: only where there is a fine pointer and motion is welcome.
    if (!reduceMotion && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
      var xh = el("div", "xhair h"), xv = el("div", "xhair v"), raf = null, mx = 0, my = 0;
      table.appendChild(xh); table.appendChild(xv);
      table.addEventListener("mousemove", function (e) {
        var r = table.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
        table.classList.add("tracking");
        if (!raf) raf = requestAnimationFrame(function () { xh.style.top = my + "px"; xv.style.left = mx + "px"; raf = null; });
      });
      table.addEventListener("mouseleave", function () { table.classList.remove("tracking"); });
    }

    renderChips();
    update();

    // One orchestrated moment on load: the screen resolves out of draft lines.
    if (!reduceMotion) {
      device.classList.add("drafting");
      device.querySelector(".screen").classList.add("boot");
      setTimeout(function () { device.classList.remove("drafting"); }, 1100);
    }

    function renderChips() {
      chips.innerHTML = "";
      AUD[state.aud].modules.forEach(function (id) {
        var b = el("button", "chip", esc(MOD[id].label));
        b.type = "button";
        b.setAttribute("data-mod", id);
        b.setAttribute("aria-pressed", state.modules.indexOf(id) >= 0 ? "true" : "false");
        chips.appendChild(b);
      });
    }

    function update() {
      var a = AUD[state.aud];
      peopleOut.textContent = fmt(state.people) + " " + (state.people === 1 ? a.unit[0] : a.unit[1]);
      table.querySelector("[data-count]").textContent = state.modules.length ? state.modules.length + " selected" : "none yet";
      device.className = "device " + state.device;
      renderPreview(device.querySelector(".screen"));
      fitScreen();
      renderCharter();
      var topic = state.aud === "idea" ? "idea" : "build";
      sendBtn.href = "contact.html?topic=" + topic + "&draft=" + encodeURIComponent(charterText());
      prevModules = state.modules.slice();
    }

    function renderCharter() {
      var a = AUD[state.aud];
      var mods = state.modules.map(function (id) { return MOD[id]; });
      var size = buildSize();
      var name = projectName();
      var own = state.aud === "idea"
        ? "You own the name and the rights. We build it and set up the licensing so you can sell it."
        : "You own your data and your records. The software is licensed to you or built for you, as the charter says.";
      charter.querySelector("[data-c-name]").textContent = name;
      charter.querySelector("[data-c-for]").textContent = a.org + ", " + fmt(state.people) + " " + (state.people === 1 ? a.unit[0] : a.unit[1]);
      var list = charter.querySelector("[data-c-does]");
      list.innerHTML = mods.length ? mods.map(function (m) { return "<li>" + esc(cap(m.does)) + "</li>"; }).join("") : "<li>Pick at least one thing it needs to do.</li>";
      charter.querySelector("[data-c-runs]").textContent = cap(PLAT[state.plat].runs);
      charter.querySelector("[data-c-size] b").textContent = size.label;
      charter.querySelector("[data-c-size] span").textContent = size.weeks;
      charter.querySelector("[data-c-own]").textContent = own;
    }

    function charterText() {
      var a = AUD[state.aud];
      var size = buildSize();
      var lines = [
        "DRAFT CHARTER (from tompkinssoftwaresystems.com)",
        "Project: " + projectName(),
        "For: " + a.org + ", " + fmt(state.people) + " " + (state.people === 1 ? a.unit[0] : a.unit[1]),
        "What it does:"
      ];
      state.modules.forEach(function (id) { lines.push("  - " + cap(MOD[id].does)); });
      lines.push("Runs: " + cap(PLAT[state.plat].runs));
      lines.push("Build size: " + size.label + ", typically " + size.weeks);
      lines.push("");
      lines.push("Anything else we should know:");
      return lines.join("\n");
    }

    function projectName() {
      var a = AUD[state.aud];
      if (!state.modules.length) return "A tool for " + a.org;
      var first = MOD[state.modules[0]].short;
      var second = state.modules[1] ? MOD[state.modules[1]].short : null;
      var what = second ? first + " and " + second : first;
      if (state.aud === "idea") return cap(what) + " platform";
      return cap(what) + " tool for " + a.org;
    }

    function buildSize() {
      var pts = state.modules.length + (state.plat === "app" ? 2 : state.plat === "browser" ? 0 : 1) + (state.people >= 100 ? 1 : 0);
      if (pts <= 3) return { label: "Small build", weeks: "3 to 5 weeks" };
      if (pts <= 6) return { label: "Medium build", weeks: "6 to 10 weeks" };
      return { label: "Large build", weeks: "10 to 16 weeks" };
    }
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  /* ---- The app preview ---- */
  function renderPreview(screen) {
    var a = AUD[state.aud];
    var n = state.people;
    var mods = state.modules.slice();
    var phone = state.device === "phone";
    screen.innerHTML = "";

    var top = el("div", "app-top");
    if (!phone) top.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    top.appendChild(el("span", "app-name", esc(a.app)));
    if (mods.indexOf("offline") >= 0) top.appendChild(el("span", "sync", phone ? "Synced" : "Offline ready, 3 records waiting to sync"));
    screen.appendChild(top);

    var body = el("div", "app-body");
    if (!phone) {
      var side = el("div", "app-side");
      side.appendChild(el("div", "side-head", "Modules"));
      mods.forEach(function (id, i) { var s = el("a", i === 0 ? "on" : "", esc(MOD[id].label)); s.href = "#"; s.tabIndex = -1; s.setAttribute("aria-hidden", "true"); side.appendChild(s); });
      body.appendChild(side);
    }
    var main = el("div", "app-main");
    if (!mods.length) main.appendChild(el("div", "app-empty", "Nothing selected yet. Turn on something it needs to do."));
    mods.forEach(function (id) {
      var w = widget(id, n, a);
      if (prevModules.indexOf(id) < 0 && !reduceMotion) w.classList.add("in");
      main.appendChild(w);
    });
    body.appendChild(main);
    screen.appendChild(body);

    if (phone) {
      var tabs = el("div", "app-tabs");
      var shown = mods.slice(0, 4);
      shown.forEach(function (id, i) { tabs.appendChild(el("span", i === 0 ? "on" : "", "<i></i>" + esc(shortLabel(id)))); });
      if (mods.length > 4) tabs.appendChild(el("span", "", "<i></i>More"));
      if (!mods.length) tabs.appendChild(el("span", "on", "<i></i>Home"));
      screen.appendChild(tabs);
    }
  }

  function shortLabel(id) {
    return { training: "Training", incidents: "Incidents", inspections: "Inspect", workorders: "Orders", inventory: "Stock", scheduling: "Schedule", photos: "Photos",
      offline: "Sync", reports: "Reports", permits: "Permits", forms: "Forms", portal: "Portal", payments: "Pay", invoices: "Invoices", records: "Records",
      volunteers: "Volunteers", donations: "Giving", events: "Events", accounts: "People", licensing: "Licenses", content: "Content", notifications: "Alerts" }[id] || MOD[id].label;
  }

  function ring(pct) {
    var r = 17, c = 2 * Math.PI * r;
    return '<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="' + r + '" fill="none" stroke="#e3e5df" stroke-width="6"/>' +
      '<circle cx="22" cy="22" r="' + r + '" fill="none" stroke="#2a7560" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - pct)) + '" transform="rotate(-90 22 22)"/>' +
      '<text x="22" y="26" text-anchor="middle" font-size="11" font-weight="600" fill="#1a221e">' + Math.round(pct * 100) + '%</text></svg>';
  }
  function rows(items) { return '<div class="rows">' + items.map(function (r) { return '<div class="row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>'; }).join("") + "</div>"; }
  function pill(t, k) { return '<span class="pill ' + (k || "") + '">' + t + "</span>"; }

  function widget(id, n, a) {
    var w = el("div", "w");
    var cur, due, h;
    switch (id) {
      case "training":
        cur = Math.max(0, Math.round(n * 0.86)); due = n - cur;
        w.innerHTML = "<h4>Training <small>this year</small></h4><div class=\"ring\">" + ring(n ? cur / n : 0) +
          rows([["Current", cur + " of " + fmt(n)], ["Due in 30 days", pill(String(Math.max(due, n > 3 ? 1 : 0)), due ? "warn" : "ok")], ["Overdue", pill(String(Math.round(due * 0.4)), due > 2 ? "bad" : "ok")]]) + "</div>";
        break;
      case "incidents":
        h = Math.max(1, Math.round(n / 12));
        w.innerHTML = "<h4>Incident reports <small>open " + h + "</small></h4>" + rows([
          ["Vehicle, Unit 14", pill("Investigating", "warn")], ["Near miss, trench", pill("Statements", "warn")], ["Injury, hand", pill("Closed", "ok")]]);
        break;
      case "inspections":
        w.innerHTML = "<h4>Inspections <small>this week</small></h4><div class=\"check\"><span class=\"done\">Shop, general industry (137 items)</span><span class=\"done\">Trench at Oak St</span><span>Bucket truck, Unit 7</span><span>Annual audit, " + Math.max(1, Math.round(n / 15)) + " findings open</span></div>";
        break;
      case "workorders":
        w.innerHTML = "<h4>Work orders</h4><div class=\"cols\"><div class=\"col\"><b>New " + (Math.round(n / 5) + 2) + "</b><i></i><i></i></div><div class=\"col\"><b>In progress " + (Math.round(n / 8) + 1) + "</b><i></i></div><div class=\"col\"><b>Done " + (Math.round(n / 3) + 4) + "</b><i></i><i></i><i></i></div></div>";
        break;
      case "inventory":
        w.innerHTML = "<h4>Inventory <small>reorder 2</small></h4>" + rows([["Hydrant caps", '<div class="bar" style="width:60px"><i style="width:70%"></i></div>'], ["Cold patch, tons", '<div class="bar" style="width:60px"><i class="amber" style="width:22%"></i></div>'], ["Sign posts", '<div class="bar" style="width:60px"><i style="width:85%"></i></div>']]);
        break;
      case "scheduling":
        w.innerHTML = "<h4>This week <small>" + fmt(n) + " on the schedule</small></h4><div class=\"week\"><span>M<i class=\"on\"></i></span><span>T<i class=\"on\"></i></span><span>W<i class=\"hot\"></i></span><span>T<i class=\"on\"></i></span><span>F<i class=\"on\"></i></span><span>S<i></i></span><span>S<i></i></span></div>";
        break;
      case "photos":
        w.innerHTML = "<h4>Photos and diagrams</h4><div class=\"tiles\"><i></i><i></i><i class=\"diagram\"></i></div>";
        break;
      case "offline":
        w.innerHTML = "<h4>Field sync</h4>" + rows([["Saved on device", "3 records"], ["Last sync", "11 min ago"], ["Signal", pill("None", "warn")]]);
        break;
      case "reports":
        w.className += " wide";
        var bars = [40, 55, 48, 70, 62, 85, 78, 90].map(function (v) { return '<i style="height:' + v + '%"></i>'; }).join("");
        w.innerHTML = "<h4>Roll-up for leadership <small>last 8 weeks</small></h4><div class=\"chart\">" + bars + "</div>";
        break;
      case "permits":
        w.innerHTML = "<h4>Permits <small>queue " + (Math.round(n / 4) + 3) + "</small></h4>" + rows([["Fence, 412 Elm", pill("Review", "warn")], ["Driveway, 9 Oak", pill("Approved", "ok")], ["Sign, Main St", pill("Fee due")]]);
        break;
      case "forms":
        w.innerHTML = "<h4>Online forms</h4><div class=\"field\" data-label=\"Name\"></div><div class=\"field\" data-label=\"Address\"></div><div class=\"field\" data-label=\"What do you need?\"></div>";
        break;
      case "portal":
        w.innerHTML = "<h4>Portal</h4><div class=\"login\"><div class=\"field\" data-label=\"Email\"></div><div class=\"field\" data-label=\"Password\"></div><div class=\"btnm\">Sign in</div></div>";
        break;
      case "payments":
        var pay = state.aud === "city" ? [["Permit fee", "$75.00 " + pill("Paid", "ok")], ["Water bill", "$112.40 " + pill("Paid", "ok")], ["Rental deposit", "$250.00 " + pill("Pending", "warn")]]
          : [["Monthly plan", "$29.00 " + pill("Paid", "ok")], ["Setup fee", "$149.00 " + pill("Paid", "ok")], ["Invoice 1042", "$480.00 " + pill("Pending", "warn")]];
        w.innerHTML = "<h4>Payments <small>today</small></h4>" + rows(pay);
        break;
      case "invoices":
        w.innerHTML = "<h4>Invoices <small>" + (Math.round(n / 2) + 3) + " open</small></h4>" + rows([["#1042, panel upgrade", "$1,850 " + pill("Sent")], ["#1041, service call", "$240 " + pill("Paid", "ok")], ["Estimate, Hart job", "$6,200 " + pill("Draft")]]);
        break;
      case "records":
        w.innerHTML = "<h4>Records</h4>" + rows([["Council minutes, Oct", "PDF"], ["Ordinance 26-14", "PDF"], ["Easement, Lot 9", "Scan"]]);
        break;
      case "volunteers":
        w.innerHTML = "<h4>Volunteers <small>" + fmt(n) + " active</small></h4>" + rows([["Hours this month", fmt(n * 6)], ["Saturday cleanup", pill(Math.round(n * 0.3) + " signed up", "ok")], ["Background checks", pill("2 pending", "warn")]]);
        break;
      case "donations":
        var goal = 25000, got = Math.min(goal, 4200 + n * 140);
        w.innerHTML = "<h4>Fall campaign</h4><div class=\"big\">" + money(got) + "</div><div class=\"bar\"><i style=\"width:" + Math.round(got / goal * 100) + "%\"></i></div>" + rows([["Goal", money(goal)], ["Receipts sent", pill("Automatic", "ok")]]);
        break;
      case "events":
        w.innerHTML = "<h4>Events</h4>" + rows([["Coat drive, Sat", Math.round(n * 0.5) + " going"], ["Board meeting, Tue", "7 going"], ["Reminder", pill("Sent", "ok")]]);
        break;
      case "accounts":
        w.innerHTML = "<h4>People <small>" + fmt(n) + "</small></h4>" + rows([["Admins", "2"], ["Members", fmt(Math.max(0, n - 2))], ["Invites", pill("3 open", "warn")]]);
        break;
      case "licensing":
        w.innerHTML = "<h4>Licenses</h4><div class=\"big\">" + fmt(Math.max(1, Math.round(n / 5))) + " customers</div>" + rows([["Seats in use", fmt(n)], ["Renewals this month", pill("4", "ok")]]);
        break;
      case "content":
        w.innerHTML = "<h4>Content</h4>" + rows([["Getting started guide", pill("Published", "ok")], ["Pricing page", pill("Draft")], ["Release notes 1.2", pill("Scheduled", "warn")]]);
        break;
      case "notifications":
        w.innerHTML = "<h4>Notifications</h4>" + rows([["Due in 7 days", "Email, " + fmt(Math.max(1, Math.round(n * 0.1)))], ["Signed statement", "Text, 1"], ["Weekly roll-up", "Email, 3"]]);
        break;
      default:
        w.innerHTML = "<h4>" + esc(MOD[id].label) + "</h4>";
    }
    return w;
  }

  /* =====================================================================
     2. Painless Project Management: the roll-up from the real rules
     ===================================================================== */
  var pm = document.getElementById("demo-pm");
  if (pm) {
    var approved = pm.querySelector("[data-approved]"), spent = pm.querySelector("[data-spent]"), forecast = pm.querySelector("[data-forecast]");
    var done = pm.querySelector("[data-done]"), nextDue = pm.querySelector("[data-next]"), lastUp = pm.querySelector("[data-last]");
    var help = pm.querySelector("[data-help]"), where = pm.querySelector("[data-where]");
    [approved, spent, forecast, done, nextDue, lastUp].forEach(function (r) { wireRange(r, pmUpdate); });
    help.addEventListener("change", pmUpdate);
    where.addEventListener("input", pmUpdate);
    pmUpdate();
  }
  function pmUpdate() {
    var A = Number(approved.value), S = Number(spent.value), F = Number(forecast.value);
    var D = Number(done.value), N = Number(nextDue.value), L = Number(lastUp.value);
    if (S > A * 1.5) { S = A * 1.5; spent.value = S; fill(spent); }
    pm.querySelector("[data-approved-v]").textContent = money(A);
    pm.querySelector("[data-spent-v]").textContent = money(S) + " (" + Math.round(S / A * 100) + "%)";
    pm.querySelector("[data-forecast-v]").textContent = money(F) + " (" + Math.round(F / A * 100) + "%)";
    pm.querySelector("[data-done-v]").textContent = D + " of 8";
    pm.querySelector("[data-next-v]").textContent = N < 0 ? Math.abs(N) + (N === -1 ? " day overdue" : " days overdue") : N === 0 ? "due today" : "due in " + N + (N === 1 ? " day" : " days");
    pm.querySelector("[data-last-v]").textContent = L === 0 ? "today" : L + (L === 1 ? " day ago" : " days ago");

    // The product's rules: an overdue milestone turns schedule amber, red past 14 days;
    // a forecast over approved turns budget amber, red past 110 percent; quiet after 14 days.
    var sched = D >= 8 ? "g" : N < -14 ? "r" : N < 0 ? "a" : "g";
    var budget = F > A * 1.1 ? "r" : F > A ? "a" : "g";
    var quiet = L > 14;
    var needs = help.checked;
    var name = { g: "On track", a: "Watch", r: "Off track" };
    var rag = pm.querySelector("[data-rag]");
    rag.innerHTML = '<span class="' + sched + '">Schedule: ' + name[sched] + '</span><span class="' + budget + '">Budget: ' + name[budget] + "</span>" +
      (quiet ? '<span class="a">Quiet ' + L + " days</span>" : "") + (needs ? '<span class="r">Needs help</span>' : "");
    var ms = pm.querySelector("[data-ms]");
    ms.innerHTML = "";
    for (var i = 0; i < 8; i++) ms.appendChild(el("i", i < D ? "done" : (i === D && N < 0) ? "late" : ""));

    var s = "Fleet telematics rollout is " + (sched === "g" && budget === "g" && !needs ? "on track" : sched === "r" || budget === "r" ? "off track" : "being watched") + ": " +
      D + " of 8 milestones done, " + Math.round(S / A * 100) + "% of the approved budget spent, forecast " +
      (F > A ? money(F - A) + " over" : F < A ? money(A - F) + " under" : "at") + " approved";
    if (N < 0 && D < 8) s += ", next milestone " + Math.abs(N) + " days overdue";
    if (quiet) s += ". No update in " + L + " days";
    if (needs) s += ". Help requested" + (where.value.trim() ? ": " + where.value.trim() : "");
    pm.querySelector("[data-summary]").textContent = s + ".";
  }

  /* =====================================================================
     3. IntelliSafe: the binder and the platform
     ===================================================================== */
  var cmp = document.getElementById("compare");
  if (cmp) {
    var cut = cmp.querySelector(".cut");
    function setCut() { cmp.style.setProperty("--cut", cut.value + "%"); }
    cut.addEventListener("input", setCut);
    setCut();
  }

  /* =====================================================================
     4. Part 107 Prep: a question from the bank
     ===================================================================== */
  var QUESTIONS = [
    { cat: "Regulations", q: "Under Part 107, what is the maximum groundspeed for a small unmanned aircraft?", a: ["87 miles per hour", "100 miles per hour", "120 miles per hour"], c: 1,
      x: "The limit is 100 miles per hour, which is 87 knots. The two numbers describe the same speed in different units, and the exam likes to mix them.", ref: "14 CFR 107.51(a)" },
    { cat: "Airspace", q: "You want to fly near a towered airport inside Class D airspace. What do you need before takeoff?", a: ["Nothing; Class D is uncontrolled for drones", "A phone call to the tower", "FAA authorization, through LAANC or DroneZone"], c: 2,
      x: "Operations in Class B, C, D, or the surface area of Class E airspace need prior FAA authorization. A call to the tower is not an authorization.", ref: "14 CFR 107.41" },
    { cat: "Weather", q: "A METAR reports BKN012. What does that tell you?", a: ["Broken clouds with bases at 120 feet", "Broken clouds with bases at 1,200 feet", "Broken clouds with bases at 12,000 feet"], c: 1,
      x: "Cloud heights in a METAR are in hundreds of feet above ground level, so 012 is 1,200 feet. You must stay 500 feet below the clouds, so that puts your ceiling at 700 feet AGL, which is above the 400-foot limit anyway.", ref: "14 CFR 107.51(d); AC 00-45" },
    { cat: "Operations", q: "What is the minimum flight visibility for a Part 107 operation without a waiver?", a: ["1 statute mile", "3 statute miles", "5 statute miles"], c: 1,
      x: "Three statute miles, measured from the control station. Less than that needs a waiver.", ref: "14 CFR 107.51(c)" },
    { cat: "Regulations", q: "You move. How long do you have to tell the FAA your new mailing address before you may no longer exercise your certificate?", a: ["10 days", "30 days", "90 days"], c: 1,
      x: "Thirty days. After that, the certificate privileges pause until the FAA has the new address.", ref: "14 CFR 107.77" },
    { cat: "Operations", q: "How many hours must pass between consuming alcohol and acting as remote pilot in command?", a: ["4 hours", "8 hours", "12 hours"], c: 1,
      x: "Eight hours, and no operating with a blood alcohol level of 0.04 or above, the same rule that applies to manned pilots.", ref: "14 CFR 107.27 and 91.17" }
  ];
  var qd = document.getElementById("demo-107");
  if (qd) {
    var dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    var qi = dayOfYear % QUESTIONS.length, answered = 0, correct = 0;
    var goal = 5;
    var qCat = qd.querySelector("[data-q-cat]"), qText = qd.querySelector("[data-q-text]"), qOpts = qd.querySelector("[data-q-opts]"), qExp = qd.querySelector("[data-q-explain]"), qNext = qd.querySelector("[data-q-next]");
    var goalN = qd.querySelector("[data-goal-n]"), goalRing = qd.querySelector("[data-goal-ring]"), score = qd.querySelector("[data-score]");

    function showQ() {
      var Q = QUESTIONS[qi];
      qCat.textContent = Q.cat;
      qText.textContent = Q.q;
      qOpts.innerHTML = "";
      Q.a.forEach(function (t, i) {
        var b = el("button", "q-opt", esc(t)); b.type = "button";
        b.addEventListener("click", function () { answer(i); });
        qOpts.appendChild(b);
      });
      qExp.hidden = true; qNext.hidden = true;
    }
    function answer(i) {
      var Q = QUESTIONS[qi];
      var btns = qOpts.querySelectorAll(".q-opt");
      btns.forEach(function (b, j) { b.disabled = true; if (j === Q.c) b.classList.add("right"); else if (j === i) b.classList.add("wrong"); });
      qExp.innerHTML = (i === Q.c ? "<strong>Right.</strong> " : "<strong>Not quite.</strong> ") + esc(Q.x) + '<span class="ref">' + esc(Q.ref) + "</span>";
      qExp.hidden = false; qNext.hidden = false;
      answered = Math.min(goal, answered + 1); if (i === Q.c) correct++;
      drawGoal();
    }
    function drawGoal() {
      var pct = answered / goal, r = 50, c = 2 * Math.PI * r;
      goalRing.innerHTML = '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#e3e5df" stroke-width="10"/>' +
        '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#2a7560" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - pct)) + '" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .5s ease"/>';
      goalN.textContent = answered + " of " + goal;
      score.textContent = answered ? correct + " right so far" : "Answer one to start the day";
      if (answered >= goal) score.textContent = "Daily goal done. " + correct + " of " + goal + " right.";
    }
    qNext.addEventListener("click", function () { qi = (qi + 1) % QUESTIONS.length; showQ(); });
    showQ(); drawGoal();
  }
})();
