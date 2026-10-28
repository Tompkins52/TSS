/* Tompkins Software Systems home page: six working sample apps.
   No dependencies. Everything runs in the visitor's browser; nothing is sent anywhere. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Small helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }
  function money(n) { return "$" + fmt(Math.round(n)); }
  function money2(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function dateAt(offsetDays) { var d = new Date(); d.setDate(d.getDate() + (offsetDays || 0)); return d; }
  function longDate(d) { return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
  function shortDate(d) { return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
  function nextWeekday(dow) { var d = new Date(); var diff = (dow - d.getDay() + 7) % 7; if (diff === 0) diff = 7; d.setDate(d.getDate() + diff); return d; }
  function isoDate(d) { return d.toISOString().slice(0, 10); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function licenseKey(seed) {
    var alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out = "", h = hash(seed);
    for (var i = 0; i < 16; i++) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; out += alpha[h % 32]; if (i % 4 === 3 && i < 15) out += "-"; }
    return out;
  }
  function csv(rows) {
    return rows.map(function (r) { return r.map(function (c) { c = String(c == null ? "" : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\r\n");
  }
  function download(name, text, type) {
    try {
      var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      return true;
    } catch (e) { return false; }
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); }); return true; }
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.top = "-1000px";
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta); return ok;
  }
  function initials(name) { return name.split(/\s+/).map(function (p) { return p.charAt(0); }).join("").toUpperCase().slice(0, 2); }

  /* ---------- HTML snippets used by every app ---------- */
  function pill(text, kind) { return '<span class="pill' + (kind ? " " + kind : "") + '">' + esc(text) + "</span>"; }
  function stat(label, value, sub) { return '<div class="stat"><span class="v">' + value + '</span><span class="l">' + esc(label) + "</span>" + (sub ? '<span class="s">' + esc(sub) + "</span>" : "") + "</div>"; }
  function btn(act, label, cls, extra) { return '<button type="button" class="b' + (cls ? " " + cls : "") + '" data-act="' + act + '"' + (extra || "") + ">" + esc(label) + "</button>"; }
  function field(label, inner, cls) { return '<label class="f' + (cls ? " " + cls : "") + '"><span>' + (cls === "raw" ? label : esc(label)) + "</span>" + inner + "</label>"; }
  function input(name, value, attrs) { return '<input class="in" name="' + name + '" value="' + esc(value) + '"' + (attrs || "") + ">"; }
  function select(name, opts, value, attrs) {
    return '<select class="in" name="' + name + '"' + (attrs || "") + ">" + opts.map(function (o) { return '<option' + (o === value ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>";
  }
  function range(name, min, max, step, value, attrs) { return '<input class="rng" type="range" name="' + name + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"' + (attrs || "") + ">"; }
  function bar(pct, cls) { return '<div class="bar"><i class="' + (cls || "") + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>'; }
  function head(title, right) { return '<div class="mh"><h3>' + esc(title) + "</h3>" + (right || "") + "</div>"; }
  function note(text) { return '<p class="note">' + esc(text) + "</p>"; }
  function progress(pct, label) { return '<div class="prog"><span>' + esc(label) + "</span>" + bar(pct) + "</div>"; }

  /* =====================================================================
     1. Public works: work orders for a streets crew
     ===================================================================== */
  var WorkOrders = {
    name: function () { return "Streets work orders"; },
    who: function () { return "Streets Division"; },
    section: "Streets",
    views: function () { return [{ id: "board", label: "Board" }, { id: "new", label: "New request", tab: "New" }, { id: "report", label: "This week", tab: "Week" }]; },
    init: function () {
      function o(id, type, addr, pri, status, age, crew) { return { id: id, type: type, addr: addr, pri: pri, status: status, age: age, crew: crew || "" }; }
      return { view: "board", filter: "new", next: 1043, orders: [
        o(1042, "Pothole", "400 block of W Main St", "Urgent", "new", 0),
        o(1041, "Streetlight out", "Pole 17, Liberty and 3rd", "Normal", "new", 1),
        o(1040, "Catch basin clogged", "Elm and 5th", "Low", "new", 2),
        o(1038, "Stop sign down", "Ash and Grove", "Urgent", "doing", 1, "Crew 2"),
        o(1036, "Sidewalk heave", "212 N Park Ave", "Low", "doing", 5, "Crew 1"),
        o(1034, "Tree limb in road", "Spring Rd at the creek", "Normal", "done", 3, "Crew 2"),
        o(1033, "Hydrant leaking", "9 Oak Ln", "Urgent", "done", 4, "Crew 1"),
        o(1031, "Pothole", "County Rd 6 eastbound, mile 3", "Normal", "done", 6, "Crew 2")
      ] };
    },
    types: ["Pothole", "Streetlight out", "Stop sign down", "Sidewalk heave", "Catch basin clogged", "Tree limb in road", "Hydrant leaking", "Something else"],
    card: function (o) {
      var pri = o.pri === "Urgent" ? "bad" : o.pri === "Normal" ? "" : "quiet";
      var age = o.age === 0 ? "opened today" : "open " + plural(o.age, "day", "days");
      var action = o.status === "new" ? btn("start", "Start", "small", ' data-id="' + o.id + '"') : o.status === "doing" ? btn("done", "Done", "small", ' data-id="' + o.id + '"') : "";
      return '<div class="card"><div class="ch"><b>#' + o.id + " " + esc(o.type) + "</b>" + pill(o.pri, pri) + "</div><div class=\"addr\">" + esc(o.addr) + '</div><div class="cf"><span>' + (o.crew ? esc(o.crew) + ", " : "") + age + "</span>" + action + "</div></div>";
    },
    render: function (st, view, phone) {
      var byStatus = function (s) { return st.orders.filter(function (o) { return o.status === s; }); };
      var n = byStatus("new").length, d = byStatus("doing").length, f = byStatus("done").length;
      if (view === "board") {
        var summary = '<span class="sum">' + n + " new, " + d + " in progress, " + f + " done this week</span>";
        if (phone) {
          var tabs = ["new", "doing", "done"].map(function (s) { return '<button type="button" class="chip' + (st.filter === s ? " on" : "") + '" data-act="filter" data-f="' + s + '">' + ({ "new": "New " + n, doing: "In progress " + d, done: "Done " + f })[s] + "</button>"; }).join("");
          return head("Board", btn("export", "Export", "ghost small")) + '<div class="chips">' + tabs + "</div>" + '<div class="stack">' + (byStatus(st.filter).map(WorkOrders.card).join("") || '<p class="empty">Nothing here.</p>') + "</div>";
        }
        return head("Board", summary + btn("export", "Export CSV", "ghost small")) +
          '<div class="kan">' + [["new", "New"], ["doing", "In progress"], ["done", "Done"]].map(function (c) {
            return '<div class="kcol"><div class="kh">' + c[1] + " <span>" + byStatus(c[0]).length + "</span></div>" + (byStatus(c[0]).map(WorkOrders.card).join("") || '<p class="empty">Empty</p>') + "</div>";
          }).join("") + "</div>";
      }
      if (view === "new") {
        return head("New request") + note("The same form the website and the front desk use, so the crew sees one list.") +
          '<form class="frm" data-act="add">' +
          field("What is it?", select("type", WorkOrders.types, "Pothole")) +
          field("Where?", input("addr", "", ' placeholder="Address or intersection" required')) +
          field("Priority", select("pri", ["Normal", "Urgent", "Low"], "Normal")) +
          '<div class="fa"><button type="submit" class="b">Add to the board</button></div></form>';
      }
      // report
      var open = st.orders.filter(function (o) { return o.status !== "done"; });
      var avg = open.length ? (open.reduce(function (a, o) { return a + o.age; }, 0) / open.length) : 0;
      var types = {}; st.orders.forEach(function (o) { types[o.type] = (types[o.type] || 0) + 1; });
      var keys = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; });
      var max = types[keys[0]] || 1;
      return head("This week", btn("export", "Export CSV", "ghost small")) +
        '<div class="stats">' + stat("Requests", st.orders.length) + stat("Closed", f) + stat("Still open", open.length) + stat("Avg days open", avg.toFixed(1)) + "</div>" +
        '<div class="box"><h4>By type</h4>' + keys.map(function (k) { return '<div class="brow"><span>' + esc(k) + "</span>" + bar(types[k] / max * 100) + "<b>" + types[k] + "</b></div>"; }).join("") + "</div>" +
        note("This is the page the director gets by email on Friday afternoon. Nobody has to write it.");
    },
    act: function (st, act, el, form) {
      var byId = function (id) { return st.orders.filter(function (o) { return o.id === Number(id); })[0]; };
      if (act === "filter") { st.filter = el.getAttribute("data-f"); return true; }
      if (act === "start") { var o = byId(el.getAttribute("data-id")); o.status = "doing"; o.crew = st.orders.filter(function (x) { return x.crew === "Crew 1"; }).length <= st.orders.filter(function (x) { return x.crew === "Crew 2"; }).length ? "Crew 1" : "Crew 2"; st.msg = "#" + o.id + " assigned to " + o.crew + ". They see it on the truck tablet."; return true; }
      if (act === "done") { var d = byId(el.getAttribute("data-id")); d.status = "done"; st.msg = "#" + d.id + " closed. The person who reported it gets a text."; return true; }
      if (act === "add") {
        var addr = form.addr.value.trim(); if (!addr) { form.addr.focus(); return false; }
        st.orders.unshift({ id: st.next, type: form.type.value, addr: addr, pri: form.pri.value, status: "new", age: 0, crew: "" });
        st.msg = "#" + st.next + " is on the board under New."; st.next++; st.view = "board"; st.filter = "new"; return true;
      }
      if (act === "export") {
        var rows = [["Number", "Type", "Location", "Priority", "Status", "Crew", "Days open"]].concat(st.orders.map(function (o) { return [o.id, o.type, o.addr, o.pri, { "new": "New", doing: "In progress", done: "Done" }[o.status], o.crew, o.age]; }));
        st.msg = download("work-orders.csv", csv(rows), "text/csv") ? "work-orders.csv downloaded, " + st.orders.length + " rows." : "Your browser blocked the download."; return true;
      }
      return false;
    }
  };

  /* =====================================================================
     2. Local government: a permit desk residents can use from a phone
     ===================================================================== */
  var FEES = { Deck: { base: 75, perSqft: 0.25 }, Fence: { base: 50 }, Sign: { base: 100 }, Driveway: { base: 60 }, "Garage sale": { base: 0 } };
  function permitFee(type, sqft) { var r = FEES[type]; return r.base + (r.perSqft ? r.perSqft * sqft : 0); }
  var Permits = {
    name: function () { return "Permit desk"; },
    who: function () { return "Clerk's office"; },
    section: "Permits",
    views: function () { return [{ id: "apply", label: "Apply (resident)", tab: "Apply" }, { id: "queue", label: "Queue (clerk)", tab: "Queue" }, { id: "fees", label: "Fee table", tab: "Fees" }]; },
    init: function () {
      return { view: "apply", type: "Deck", sqft: 240, next: 143, collected: 50, receipt: null, apps: [
        { n: "2026-0139", type: "Fence", addr: "118 Birch Ct", who: "M. Alvarez", fee: 50, status: "Approved", permit: "P-26-0139" },
        { n: "2026-0140", type: "Deck", addr: "42 Lakeview Dr", who: "T. Brennan", fee: 135, sqft: 240, status: "Received" },
        { n: "2026-0141", type: "Sign", addr: "300 Main St", who: "Hart Electric", fee: 100, status: "Needs info", note: "Site plan missing" },
        { n: "2026-0142", type: "Garage sale", addr: "7 Pine St", who: "D. Kowalski", fee: 0, status: "Approved", permit: "P-26-0142" }
      ] };
    },
    render: function (st, view, phone) {
      var waiting = st.apps.filter(function (a) { return a.status === "Received"; }).length;
      if (view === "apply") {
        if (st.receipt) {
          var r = st.receipt;
          return head("Application received") + '<div class="receipt"><div class="rn">' + esc(r.n) + "</div><dl><dt>Permit</dt><dd>" + esc(r.type) + (r.sqft ? ", " + fmt(r.sqft) + " sq ft" : "") + "</dd><dt>Address</dt><dd>" + esc(r.addr) + "</dd><dt>Fee</dt><dd>" + money2(r.fee) + (r.fee ? ", due when approved" : "") + "</dd><dt>Status</dt><dd>" + pill("Received", "warn") + "</dd></dl></div>" +
            note("The clerk sees it in the queue now. You get an email at every step, and a copy of the permit when it is issued.") +
            '<div class="fa">' + btn("another", "Apply for another", "ghost") + btn("view", "See the clerk's queue", "ghost", ' data-v="queue"') + "</div>";
        }
        var isDeck = st.type === "Deck";
        return head("Apply for a permit") + note("Residents see this page. No account, no PDF to print.") +
          '<form class="frm" data-act="submit">' +
          field("Permit type", select("type", Object.keys(FEES), st.type, ' data-change="type"')) +
          (isDeck ? field("Deck size: <output data-sqft-out>" + fmt(st.sqft) + "</output> sq ft", range("sqft", 40, 1200, 10, st.sqft, ' data-live="sqft"'), "raw") : "") +
          field("Property address", input("addr", st.addr || "", ' placeholder="Street address" required data-live="addr"')) +
          field("Your name", input("who", st.who || "", ' placeholder="First and last name" required data-live="who"')) +
          '<div class="fee">Fee <b data-fee>' + money2(permitFee(st.type, st.sqft)) + "</b></div>" +
          '<div class="fa"><button type="submit" class="b">Submit application</button></div></form>';
      }
      if (view === "queue") {
        var rows = st.apps.map(function (a, i) {
          var status = a.status === "Approved" ? pill("Approved", "ok") : a.status === "Needs info" ? pill("Needs info", "bad") : pill("Received", "warn");
          var actions = a.status === "Received" ? btn("approve", "Approve", "small", ' data-i="' + i + '"') + btn("info", "Needs info", "ghost small", ' data-i="' + i + '"') : a.permit ? '<span class="mono">' + esc(a.permit) + "</span>" : '<span class="dim">' + esc(a.note || "Applicant emailed") + "</span>";
          return "<tr><td>" + esc(a.n) + '</td><td>' + esc(a.type) + (a.sqft ? '<span class="dim"> ' + fmt(a.sqft) + " sq ft</span>" : "") + '</td><td class="xw">' + esc(a.addr) + '<span class="dim"> ' + esc(a.who) + "</span></td><td>" + money2(a.fee) + "</td><td>" + status + '</td><td class="ta">' + actions + "</td></tr>";
        }).join("");
        if (phone) {
          var cards = st.apps.map(function (a, i) {
            var status = a.status === "Approved" ? pill("Approved", "ok") : a.status === "Needs info" ? pill("Needs info", "bad") : pill("Received", "warn");
            var actions = a.status === "Received" ? btn("approve", "Approve", "small", ' data-i="' + i + '"') + btn("info", "Needs info", "ghost small", ' data-i="' + i + '"') : a.permit ? '<span class="mono">' + esc(a.permit) + "</span>" : '<span class="dim">' + esc(a.note || "Applicant emailed") + "</span>";
            return '<div class="card"><div class="ch"><b>' + esc(a.n) + " " + esc(a.type) + (a.sqft ? ", " + fmt(a.sqft) + " sq ft" : "") + "</b>" + status + '</div><div class="addr">' + esc(a.addr) + ", " + esc(a.who) + '</div><div class="cf"><span>' + money2(a.fee) + "</span><span>" + actions + "</span></div></div>";
          }).join("");
          return head("Queue", '<span class="sum">' + plural(waiting, "application", "applications") + " waiting, " + money(st.collected) + " collected</span>") + '<div class="stack">' + cards + "</div>" +
            note("Approve issues the permit number, records the fee, and emails the resident. Needs info sends them a note and holds the spot in line.");
        }
        return head("Queue", '<span class="sum">' + plural(waiting, "application", "applications") + " waiting, " + money(st.collected) + " collected this week</span>") +
          '<table class="tbl"><thead><tr><th>Number</th><th>Permit</th><th class="xw">Address</th><th>Fee</th><th>Status</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>" +
          note("Approve issues the permit number, records the fee, and emails the resident. Needs info sends them a note and holds the spot in line.");
      }
      // fees
      return head("Fee table") +
        '<table class="tbl"><thead><tr><th>Permit</th><th>Fee</th><th class="xw">Who reviews it</th></tr></thead><tbody>' +
        [["Deck", "$75 plus $0.25 per sq ft", "Building"], ["Fence", "$50", "Zoning"], ["Sign", "$100", "Zoning"], ["Driveway", "$60", "Engineering"], ["Garage sale", "No fee", "Clerk"]].map(function (r) { return "<tr><td>" + r[0] + "</td><td>" + r[1] + '</td><td class="xw">' + r[2] + "</td></tr>"; }).join("") +
        "</tbody></table>" + '<div class="stats">' + stat("Collected this week", money(st.collected)) + stat("Waiting", waiting) + stat("Approved", st.apps.filter(function (a) { return a.status === "Approved"; }).length) + "</div>" +
        note("When council changes a fee, the clerk edits this table. The form and the queue follow.");
    },
    live: function (st, el, main) {
      var k = el.getAttribute("data-live");
      if (k === "addr" || k === "who") { st[k] = el.value; return; }
      if (k === "sqft") {
        st.sqft = Number(el.value);
        var out = main.querySelector("[data-sqft-out]"), fee = main.querySelector("[data-fee]");
        if (out) out.textContent = fmt(st.sqft);
        if (fee) fee.textContent = money2(permitFee(st.type, st.sqft));
      }
    },
    act: function (st, act, el, form) {
      if (act === "type") { st.type = el.value; return true; }
      if (act === "submit") {
        var addr = form.addr.value.trim(), who = form.who.value.trim();
        if (!addr) { form.addr.focus(); return false; } if (!who) { form.who.focus(); return false; }
        var a = { n: "2026-0" + st.next, type: st.type, addr: addr, who: who, fee: permitFee(st.type, st.sqft), status: "Received" };
        if (st.type === "Deck") a.sqft = st.sqft;
        st.next++; st.apps.push(a); st.receipt = a; st.addr = ""; st.who = ""; return true;
      }
      if (act === "another") { st.receipt = null; return true; }
      if (act === "approve") { var ap = st.apps[Number(el.getAttribute("data-i"))]; ap.status = "Approved"; ap.permit = "P-26-" + ap.n.slice(5); st.collected += ap.fee; st.msg = "Permit " + ap.permit + " issued" + (ap.fee ? ", " + money2(ap.fee) + " recorded" : "") + ". " + ap.who + " has it by email."; return true; }
      if (act === "info") { var ni = st.apps[Number(el.getAttribute("data-i"))]; ni.status = "Needs info"; ni.note = "Asked for a site plan"; st.msg = ni.who + " was asked for a site plan. The application keeps its place in line."; return true; }
      return false;
    }
  };

  /* =====================================================================
     3. Small business: estimates that go out before you leave the driveway
     ===================================================================== */
  var Estimates = {
    name: function () { return "Hart Electric estimates"; },
    who: function () { return "Hart Electric"; },
    section: "Office",
    views: function () { return [{ id: "new", label: "New estimate", tab: "New" }, { id: "recent", label: "Recent" }]; },
    init: function () {
      return { view: "new", customer: "Lakeside Dental", job: "Panel upgrade and six new circuits", tax: 7.25, disc: 0, next: 1043,
        lines: [{ d: "200 A panel, parts and labor", q: 1, r: 1850 }, { d: "20 A circuit, each", q: 6, r: 240 }, { d: "Permit and inspection", q: 1, r: 180 }],
        saved: [{ n: 1042, cust: "Oak St Bakery", job: "Walk-in cooler circuit", total: 1420, st: "Sent" }, { n: 1041, cust: "Hart residence", job: "Service upgrade", total: 6200, st: "Accepted" }, { n: 1040, cust: "Northside Clinic", job: "Exam room outlets", total: 980, st: "Draft" }] };
    },
    totals: function (st) {
      var sub = st.lines.reduce(function (a, l) { return a + (Number(l.q) || 0) * (Number(l.r) || 0); }, 0);
      var disc = Math.min(sub, Number(st.disc) || 0), tax = (sub - disc) * st.tax / 100;
      return { sub: sub, disc: disc, tax: tax, total: sub - disc + tax };
    },
    text: function (st) {
      var t = Estimates.totals(st);
      return ["Hart Electric, estimate #" + st.next, "For: " + st.customer, "Job: " + st.job, "Date: " + longDate(new Date()), ""].concat(st.lines.map(function (l) { return (l.d || "Item") + "  " + l.q + " x " + money2(l.r) + " = " + money2(l.q * l.r); }))
        .concat(["", "Subtotal " + money2(t.sub), st.disc ? "Discount " + money2(t.disc) : null, "Tax " + st.tax + "% " + money2(t.tax), "Total " + money2(t.total), "", "Valid for 30 days. Reply to this message to accept."]).filter(function (x) { return x !== null; }).join("\n");
    },
    render: function (st, view, phone) {
      if (view === "new") {
        var t = Estimates.totals(st);
        var lines = st.lines.map(function (l, i) {
          return '<tr><td>' + input("d", l.d, ' placeholder="Description" data-live="d" data-i="' + i + '"') + "</td><td>" + input("q", l.q, ' type="number" min="0" step="1" data-live="q" data-i="' + i + '"') + "</td><td>" + input("r", l.r, ' type="number" min="0" step="0.01" data-live="r" data-i="' + i + '"') + '</td><td class="num" data-lt="' + i + '">' + money2(l.q * l.r) + '</td><td>' + btn("rm", "×", "x", ' data-i="' + i + '" aria-label="Remove line"') + "</td></tr>";
        }).join("");
        return head("New estimate", '<span class="sum">#' + st.next + ", " + longDate(new Date()) + "</span>") +
          '<div class="two">' + field("Customer", input("customer", st.customer, ' data-live="customer"')) + field("Job", input("job", st.job, ' data-live="job"')) + "</div>" +
          '<table class="tbl lines"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th><th></th></tr></thead><tbody>' + lines + "</tbody></table>" +
          '<div class="fa left">' + btn("addline", "Add a line", "ghost small") + "</div>" +
          '<div class="two tot"><div>' + field("Tax rate: <output data-tax-out>" + st.tax + "</output>%", range("tax", 0, 10, 0.25, st.tax, ' data-live="tax"'), "raw") + field("Discount", input("disc", st.disc || "", ' type="number" min="0" step="1" placeholder="0" data-live="disc"')) + "</div>" +
          '<div class="totals"><div><span>Subtotal</span><b data-sub>' + money2(t.sub) + '</b></div><div><span>Discount</span><b data-discv>' + money2(t.disc) + '</b></div><div><span>Tax</span><b data-taxv>' + money2(t.tax) + '</b></div><div class="grand"><span>Total</span><b data-total>' + money2(t.total) + "</b></div></div></div>" +
          '<div class="fa">' + btn("save", "Save", "") + btn("copy", "Copy for the customer", "ghost") + btn("csv", "Download CSV", "ghost") + "</div>";
      }
      var acc = st.saved.filter(function (s) { return s.st === "Accepted"; }).reduce(function (a, s) { return a + s.total; }, 0);
      var out = st.saved.filter(function (s) { return s.st === "Sent"; }).reduce(function (a, s) { return a + s.total; }, 0);
      return head("Recent estimates", '<span class="sum">' + money(acc) + " accepted, " + money(out) + " waiting on a yes</span>") +
        '<table class="tbl"><thead><tr><th>#</th><th>Customer</th><th class="xw">Job</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>' +
        st.saved.map(function (s, i) { var k = s.st === "Accepted" ? "ok" : s.st === "Sent" ? "warn" : ""; return '<tr class="rowb" data-act="cycle" data-i="' + i + '" tabindex="0"><td>' + s.n + "</td><td>" + esc(s.cust) + '</td><td class="xw dim">' + esc(s.job) + '</td><td class="num">' + money2(s.total) + "</td><td>" + pill(s.st, k) + "</td></tr>"; }).join("") +
        "</tbody></table>" + note("Tap a row to move it along: draft, sent, accepted. Accepted estimates become invoices with one more tap.");
    },
    live: function (st, el, main) {
      var k = el.getAttribute("data-live"), i = Number(el.getAttribute("data-i"));
      if (k === "customer" || k === "job") { st[k] = el.value; return; }
      if (k === "d") { st.lines[i].d = el.value; return; }
      if (k === "q" || k === "r") st.lines[i][k] = Number(el.value) || 0;
      if (k === "tax") { st.tax = Number(el.value); var o = main.querySelector("[data-tax-out]"); if (o) o.textContent = st.tax; }
      if (k === "disc") st.disc = Number(el.value) || 0;
      var t = Estimates.totals(st), set = function (sel, v) { var e = main.querySelector(sel); if (e) e.textContent = v; };
      if (k === "q" || k === "r") set('[data-lt="' + i + '"]', money2(st.lines[i].q * st.lines[i].r));
      set("[data-sub]", money2(t.sub)); set("[data-discv]", money2(t.disc)); set("[data-taxv]", money2(t.tax)); set("[data-total]", money2(t.total));
    },
    act: function (st, act, el) {
      if (act === "addline") { st.lines.push({ d: "", q: 1, r: 0 }); return true; }
      if (act === "rm") { st.lines.splice(Number(el.getAttribute("data-i")), 1); if (!st.lines.length) st.lines.push({ d: "", q: 1, r: 0 }); return true; }
      if (act === "save") { var t = Estimates.totals(st); st.saved.unshift({ n: st.next, cust: st.customer || "New customer", job: st.job || "Untitled job", total: t.total, st: "Draft" }); st.msg = "Estimate #" + st.next + " saved as a draft. Open Recent to send it."; st.next++; return true; }
      if (act === "copy") { st.msg = copyText(Estimates.text(st)) ? "Copied. Paste it into a text or an email." : "Your browser blocked the clipboard."; return true; }
      if (act === "csv") { var tt = Estimates.totals(st); var rows = [["Item", "Qty", "Rate", "Amount"]].concat(st.lines.map(function (l) { return [l.d, l.q, l.r, (l.q * l.r).toFixed(2)]; })).concat([["Subtotal", "", "", tt.sub.toFixed(2)], ["Discount", "", "", tt.disc.toFixed(2)], ["Tax " + st.tax + "%", "", "", tt.tax.toFixed(2)], ["Total", "", "", tt.total.toFixed(2)]]); st.msg = download("estimate-" + st.next + ".csv", csv(rows), "text/csv") ? "estimate-" + st.next + ".csv downloaded." : "Your browser blocked the download."; return true; }
      if (act === "cycle") { var s = st.saved[Number(el.getAttribute("data-i"))]; s.st = s.st === "Draft" ? "Sent" : s.st === "Sent" ? "Accepted" : "Draft"; st.msg = "#" + s.n + " marked " + s.st.toLowerCase() + (s.st === "Sent" ? ". The customer gets a link to accept." : s.st === "Accepted" ? ". Ready to invoice." : "."); return true; }
      return false;
    }
  };

  /* =====================================================================
     4. Nonprofit: volunteer shifts that fill themselves
     ===================================================================== */
  var Volunteers = {
    name: function () { return "Northside Pantry volunteers"; },
    who: function () { return "Volunteer coordinator"; },
    section: "Volunteers",
    views: function () { return [{ id: "shifts", label: "Shifts" }, { id: "people", label: "People and hours", tab: "People" }]; },
    init: function () {
      return { view: "shifts", signing: null, waitlist: [], shifts: [
        { id: 1, name: "Food pantry sorting", day: 6, time: "9 to noon", hours: 3, need: 4, people: ["Maria G.", "Devon P."] },
        { id: 2, name: "Delivery drivers", day: 0, time: "1 to 4", hours: 3, need: 2, people: ["Lee T."] },
        { id: 3, name: "Intake desk", day: 2, time: "6 to 8", hours: 2, need: 3, people: [] },
        { id: 4, name: "Coat drive setup", day: 4, time: "5 to 8", hours: 3, need: 4, people: ["Ana R.", "Sam K.", "Priya N.", "Jo B."] }
      ], hours: [["Maria G.", 12], ["Devon P.", 9], ["Lee T.", 6], ["Ana R.", 5], ["Chris O.", 4], ["Sam K.", 3], ["Priya N.", 3], ["Jo B.", 2]] };
    },
    render: function (st, view, phone) {
      if (view === "shifts") {
        var open = st.shifts.reduce(function (a, s) { return a + Math.max(0, s.need - s.people.length); }, 0);
        return head("This week's shifts", '<span class="sum">' + plural(open, "spot", "spots") + " still open</span>") +
          '<div class="stack g2">' + st.shifts.map(function (s) {
            var full = s.people.length >= s.need;
            var chips = s.people.map(function (p) { return '<span class="av" title="' + esc(p) + '">' + esc(initials(p)) + "</span>"; }).join("");
            var form = st.signing === s.id ? '<form class="inline" data-act="join" data-id="' + s.id + '">' + input("name", "", ' placeholder="Your name" required autofocus') + '<button type="submit" class="b small">' + (full ? "Join the waitlist" : "Add me") + "</button>" + btn("cancel", "Cancel", "ghost small") + "</form>" : "";
            return '<div class="card shift"><div class="ch"><b>' + esc(s.name) + "</b>" + (full ? pill("Full", "ok") : pill((s.need - s.people.length) + " open", "warn")) + '</div><div class="addr">' + shortDate(nextWeekday(s.day)) + ", " + s.time + ", " + plural(s.hours, "hour", "hours") + "</div>" +
              '<div class="cf"><span class="avs">' + chips + (s.people.length ? "" : '<span class="dim">Nobody yet</span>') + "</span>" + (st.signing === s.id ? "" : btn("signup", full ? "Waitlist" : "Sign up", (full ? "ghost " : "") + "small", ' data-id="' + s.id + '"')) + "</div>" + form + bar(s.people.length / s.need * 100, full ? "" : "amber") + "</div>";
          }).join("") + "</div>" + (st.waitlist.length ? note("Waitlist: " + st.waitlist.join(", ") + ". They are texted if a spot opens.") : note("Sign-ups get a reminder the day before, and the coordinator gets a list the morning of."));
      }
      var scheduled = {}; st.shifts.forEach(function (s) { s.people.forEach(function (p) { scheduled[p] = (scheduled[p] || 0) + s.hours; }); });
      var names = {}; st.hours.forEach(function (h) { names[h[0]] = { h: h[1], up: 0 }; }); Object.keys(scheduled).forEach(function (p) { if (!names[p]) names[p] = { h: 0, up: 0 }; names[p].up = scheduled[p]; });
      var list = Object.keys(names).sort(function (a, b) { return (names[b].h + names[b].up) - (names[a].h + names[a].up); });
      var totalH = list.reduce(function (a, p) { return a + names[p].h; }, 0), totalUp = list.reduce(function (a, p) { return a + names[p].up; }, 0);
      return head("People and hours", btn("export", "Export CSV", "ghost small")) +
        '<div class="stats">' + stat("Volunteers", list.length) + stat("Hours this month", totalH) + stat("Hours scheduled", totalUp) + "</div>" +
        '<table class="tbl"><thead><tr><th>Name</th><th class="num">This month</th><th class="num">Scheduled</th></tr></thead><tbody>' +
        list.map(function (p) { return "<tr><td>" + esc(p) + '</td><td class="num">' + names[p].h + '</td><td class="num">' + names[p].up + "</td></tr>"; }).join("") + "</tbody></table>" +
        note("The export is the hours report your board and your grant reports ask for.");
    },
    act: function (st, act, el, form) {
      if (act === "signup") { st.signing = Number(el.getAttribute("data-id")); return true; }
      if (act === "cancel") { st.signing = null; return true; }
      if (act === "join") {
        var name = form.name.value.trim(); if (!name) { form.name.focus(); return false; }
        var s = st.shifts.filter(function (x) { return x.id === Number(form.getAttribute("data-id")); })[0];
        if (s.people.length >= s.need) { st.waitlist.push(name); st.msg = name + " is on the waitlist for " + s.name + "."; }
        else { s.people.push(name); st.msg = name + " is signed up for " + s.name + ". A reminder goes out the day before."; }
        st.signing = null; return true;
      }
      if (act === "export") {
        var rows = [["Name", "Hours this month", "Hours scheduled"]];
        var sched = {}; st.shifts.forEach(function (sh) { sh.people.forEach(function (p) { sched[p] = (sched[p] || 0) + sh.hours; }); });
        st.hours.forEach(function (h) { rows.push([h[0], h[1], sched[h[0]] || 0]); });
        Object.keys(sched).forEach(function (p) { if (!st.hours.some(function (h) { return h[0] === p; })) rows.push([p, 0, sched[p]]); });
        st.msg = download("volunteer-hours.csv", csv(rows), "text/csv") ? "volunteer-hours.csv downloaded." : "Your browser blocked the download."; return true;
      }
      return false;
    }
  };

  /* =====================================================================
     5. Learning platform: a course player with a quiz and a certificate
     ===================================================================== */
  var LESSONS = [
    { id: "l1", title: "What phishing looks like", short: "Spotting it", body: ["Phishing is a message that pretends to come from someone you trust so that you will click a link, open a file, pay something, or hand over a password. It arrives by email, text, and chat, and it is usually in a hurry.", "The tells: urgency (your account closes today), a sender address that is almost right, a link whose real destination does not match its text, and an attachment you were not expecting."] },
    { id: "l2", title: "Check before you click", short: "Checking links", body: ["Hover over a link, or press and hold it on a phone, to see where it really goes. Read the sender's full address, not just the display name.", "If a message asks for a password, a gift card, or a wire transfer, stop. No real request arrives that way. When in doubt, close the message and go to the site yourself."] },
    { id: "l3", title: "Report it", short: "Reporting it", body: ["Reporting is the whole game. Use the report button in your mail app or forward the message to your IT contact, then delete it.", "If you already clicked or typed a password, say so right away. The fix takes minutes when it is reported the same hour and weeks when it is not. Nobody gets in trouble for reporting."] }
  ];
  var QUIZ = [
    { q: "An email from “IT Support” says your password expires in one hour and gives a link to reset it. What is the best first step?", a: ["Click the link and reset it quickly", "Check the sender's full address and where the link really goes", "Reply and ask whether it is real"], c: 1, x: "Check first. Urgency plus a link is the classic combination, and the reply would go to the attacker." },
    { q: "Which of these is the strongest sign that a message is phishing?", a: ["It has the company logo", "It arrived on a Monday morning", "It asks you to buy gift cards and send the codes"], c: 2, x: "Logos are easy to copy. A request for gift cards, a wire, or a password is the sign." },
    { q: "You clicked a link in a suspicious email and typed your password. What now?", a: ["Change the password and tell nobody", "Report it right away, then change the password", "Wait and see whether anything happens"], c: 1, x: "Report first so the account can be watched and other staff warned, then change the password." }
  ];
  var Course = {
    name: function () { return "Phishing basics for staff"; },
    who: function () { return "Staff training"; },
    section: "Course",
    views: function (st) {
      return LESSONS.map(function (l, i) { return { id: l.id, label: (i + 1) + ". " + l.short, tab: "Lesson " + (i + 1), done: st.done[l.id] }; })
        .concat([{ id: "quiz", label: "4. Quiz", tab: "Quiz", done: st.passed }, { id: "cert", label: "Certificate", tab: "Certificate", locked: !st.passed }]);
    },
    init: function () { return { view: "l1", done: { l1: false, l2: false, l3: false }, qi: 0, score: 0, answered: null, finished: false, passed: false, name: "", cert: null }; },
    steps: function (st) { return (st.done.l1 ? 1 : 0) + (st.done.l2 ? 1 : 0) + (st.done.l3 ? 1 : 0) + (st.passed ? 1 : 0); },
    certSvg: function (st) {
      var w = 640, h = 440;
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" font-family="Georgia, serif">' +
        '<rect width="' + w + '" height="' + h + '" fill="#fbfbf8"/><rect x="14" y="14" width="' + (w - 28) + '" height="' + (h - 28) + '" fill="none" stroke="#12352b" stroke-width="3"/><rect x="22" y="22" width="' + (w - 44) + '" height="' + (h - 44) + '" fill="none" stroke="#d4a84b" stroke-width="1"/>' +
        '<text x="320" y="92" text-anchor="middle" font-size="13" letter-spacing="4" fill="#7f5f1b">CERTIFICATE OF COMPLETION</text>' +
        '<text x="320" y="150" text-anchor="middle" font-size="30" fill="#12352b">Phishing basics for staff</text>' +
        '<text x="320" y="196" text-anchor="middle" font-size="13" fill="#5e675f">is awarded to</text>' +
        '<text x="320" y="246" text-anchor="middle" font-size="34" font-style="italic" fill="#1a221e">' + esc(st.cert.name) + "</text>" +
        '<line x1="160" y1="262" x2="480" y2="262" stroke="#cbcfc6"/>' +
        '<text x="320" y="300" text-anchor="middle" font-size="14" fill="#3a443f">Completed on ' + esc(st.cert.date) + " with a score of " + st.cert.score + " of " + QUIZ.length + "</text>" +
        '<text x="320" y="372" text-anchor="middle" font-size="11" fill="#5e675f">Certificate ' + esc(st.cert.id) + " · Sample certificate from a Tompkins Software Systems demo</text></svg>";
    },
    render: function (st, view, phone) {
      var prog = progress(Course.steps(st) / 4 * 100, Course.steps(st) + " of 4 steps");
      var li = LESSONS.map(function (l) { return l.id; }).indexOf(view);
      if (li >= 0) {
        var l = LESSONS[li];
        return prog + '<div class="eyebrow">Lesson ' + (li + 1) + " of " + LESSONS.length + "</div><h3 class=\"lt\">" + esc(l.title) + "</h3>" + l.body.map(function (p) { return '<p class="lp">' + esc(p) + "</p>"; }).join("") +
          '<div class="fa left">' + (st.done[l.id] ? pill("Completed", "ok") + btn("view", li < 2 ? "Next lesson" : "Go to the quiz", "ghost", ' data-v="' + (li < 2 ? LESSONS[li + 1].id : "quiz") + '"') : btn("complete", li < 2 ? "Mark complete and continue" : "Mark complete and start the quiz", "", ' data-id="' + l.id + '"')) + "</div>";
      }
      if (view === "quiz") {
        var lessonsLeft = LESSONS.filter(function (x) { return !st.done[x.id]; }).length;
        if (lessonsLeft) return prog + head("Quiz") + note("Finish the " + plural(lessonsLeft, "lesson", "lessons") + " first. The quiz is three questions and you need two right.") + '<div class="fa left">' + btn("view", "Back to the lessons", "ghost", ' data-v="' + LESSONS.filter(function (x) { return !st.done[x.id]; })[0].id + '"') + "</div>";
        if (st.finished) {
          return prog + head("Quiz result") + '<div class="stats">' + stat("Score", st.score + " of " + QUIZ.length) + stat("Result", st.passed ? pill("Passed", "ok") : pill("Not yet", "bad")) + "</div>" +
            (st.passed ? note("Passed. Your certificate is ready.") + '<div class="fa left">' + btn("view", "Get the certificate", "", ' data-v="cert"') + "</div>" : note("You need two of three. The lessons are short; take another look and try again.") + '<div class="fa left">' + btn("retake", "Try again", "") + "</div>");
        }
        var Q = QUIZ[st.qi];
        var opts = Q.a.map(function (t, i) { var cls = st.answered === null ? "" : i === Q.c ? " right" : i === st.answered ? " wrong" : ""; return '<button type="button" class="opt' + cls + '" data-act="answer" data-i="' + i + '"' + (st.answered === null ? "" : " disabled") + ">" + esc(t) + "</button>"; }).join("");
        return prog + '<div class="eyebrow">Question ' + (st.qi + 1) + " of " + QUIZ.length + '</div><p class="qq">' + esc(Q.q) + '</p><div class="opts">' + opts + "</div>" +
          (st.answered === null ? "" : '<div class="explain"><b>' + (st.answered === Q.c ? "Right." : "Not quite.") + "</b> " + esc(Q.x) + "</div>" + '<div class="fa left">' + btn("qnext", st.qi < QUIZ.length - 1 ? "Next question" : "See the result", "") + "</div>");
      }
      // certificate
      if (!st.passed) return prog + head("Certificate") + note("Locked until the quiz is passed.");
      if (st.cert) return prog + head("Certificate", btn("certdl", "Download", "small")) + '<div class="cert">' + Course.certSvg(st) + "</div>" + note("Downloads as an SVG that prints on one page. In a real deployment it is also emailed to the learner and their supervisor, and the training record keeps the date.");
      return prog + head("Certificate") + note("Passed. Type the name that should appear on it.") + '<form class="frm" data-act="issue">' + field("Name on the certificate", input("name", st.name, ' placeholder="First and last name" required')) + '<div class="fa"><button type="submit" class="b">Issue the certificate</button></div></form>';
    },
    act: function (st, act, el, form) {
      if (act === "complete") { st.done[el.getAttribute("data-id")] = true; var i = LESSONS.map(function (l) { return l.id; }).indexOf(el.getAttribute("data-id")); st.view = i < 2 ? LESSONS[i + 1].id : "quiz"; return true; }
      if (act === "answer") { if (st.answered !== null) return false; st.answered = Number(el.getAttribute("data-i")); if (st.answered === QUIZ[st.qi].c) st.score++; return true; }
      if (act === "qnext") { st.answered = null; if (st.qi < QUIZ.length - 1) st.qi++; else { st.finished = true; st.passed = st.score >= 2; } return true; }
      if (act === "retake") { st.qi = 0; st.score = 0; st.answered = null; st.finished = false; return true; }
      if (act === "issue") { var name = form.name.value.trim(); if (!name) { form.name.focus(); return false; } st.name = name; st.cert = { name: name, date: longDate(new Date()), score: st.score, id: "PB-" + new Date().getFullYear() + "-" + String(hash(name + isoDate(new Date())) % 100000).padStart(5, "0") }; return true; }
      if (act === "certdl") { st.msg = download("certificate-" + st.cert.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".svg", Course.certSvg(st), "image/svg+xml") ? "Certificate downloaded." : "Your browser blocked the download."; return true; }
      return false;
    },
    locked: function (st, view) { return view === "cert" && !st.passed; }
  };

  /* =====================================================================
     6. My own idea: the back office an app needs once it is a product
     ===================================================================== */
  function tierMult(seats) { return seats >= 50 ? 0.7 : seats >= 10 ? 0.85 : 1; }
  var Console = {
    name: function (st) { return (st.app || "Your app") + " admin"; },
    who: function () { return "Owner"; },
    section: "Admin",
    views: function () { return [{ id: "overview", label: "Overview" }, { id: "customers", label: "Customers" }, { id: "plans", label: "Plans" }]; },
    init: function () {
      var st = { view: "overview", app: "Trailhead", price: 12, newSeats: 10, next: 6, customers: [
        { name: "Riverside Park District", seats: 25, since: "Aug 2026" }, { name: "Hart Electric", seats: 8, since: "Sep 2026" }, { name: "Prairie Trails Council", seats: 60, since: "Sep 2026" }, { name: "Northside Clinic", seats: 12, since: "Oct 2026" }, { name: "Blue Ridge Tours", seats: 5, since: "Oct 2026", trial: true }
      ] };
      st.customers.forEach(function (c, i) { c.key = licenseKey(st.app + c.name + i); });
      return st;
    },
    monthly: function (st, c) { return c.trial ? 0 : c.seats * st.price * tierMult(c.seats); },
    mrr: function (st) { return st.customers.reduce(function (a, c) { return a + Console.monthly(st, c); }, 0); },
    render: function (st, view, phone) {
      var seats = st.customers.reduce(function (a, c) { return a + c.seats; }, 0), trials = st.customers.filter(function (c) { return c.trial; }).length;
      if (view === "overview") {
        return head("Overview") + '<div class="two">' + field("App name", input("app", st.app, ' data-live="app" maxlength="24"')) + field("Price per seat per month: $<output data-price-out>" + st.price + "</output>", range("price", 3, 60, 1, st.price, ' data-live="price"'), "raw") + "</div>" +
          '<div class="stats">' + stat("Customers", st.customers.length) + stat("Seats", '<span data-seats>' + fmt(seats) + "</span>") + stat("Monthly revenue", '<span data-mrr>' + money(Console.mrr(st)) + "</span>") + stat("Trials", trials) + "</div>" +
          note("This is the part people forget to plan for: who bought it, how many seats, what they owe, and the key that unlocks it. We set this up so you can sell what you own.");
      }
      if (view === "customers") {
        var rows = st.customers.map(function (c, i) {
          return "<tr><td>" + esc(c.name) + '<span class="dim xw"> since ' + esc(c.since) + '</span></td><td class="num">' + c.seats + '</td><td class="num">' + (c.trial ? pill("Trial", "warn") : money(Console.monthly(st, c))) + '</td><td class="xw"><span class="mono">' + c.key + "</span></td><td class=\"ta\">" + btn("copykey", "Copy key", "ghost small", ' data-i="' + i + '"') + "</td></tr>";
        }).join("");
        return head("Customers", btn("exportcust", "Export CSV", "ghost small")) +
          '<table class="tbl"><thead><tr><th>Customer</th><th class="num">Seats</th><th class="num">Monthly</th><th class="xw">License key</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>" +
          '<form class="frm boxed" data-act="addcust"><h4>Add a customer</h4><div class="two">' + field("Organization", input("name", "", ' placeholder="Who is buying" required')) + field("Seats: <output data-seats-out>" + st.newSeats + "</output>", range("seats", 1, 200, 1, st.newSeats, ' data-live="newSeats"'), "raw") + "</div>" +
          '<label class="ck"><input type="checkbox" name="trial"> 30-day trial, no charge yet</label><div class="fa"><button type="submit" class="b">Create the license</button></div></form>';
      }
      var tiers = [["1 to 9 seats", 1, "Monthly, card on file"], ["10 to 49 seats", 0.85, "Monthly, card or invoice"], ["50 seats and up", 0.7, "Annual invoice, purchase orders accepted"]];
      return head("Plans") + '<table class="tbl"><thead><tr><th>Plan</th><th class="num">Per seat</th><th class="xw">Billing</th></tr></thead><tbody>' +
        tiers.map(function (t) { return "<tr><td>" + t[0] + '</td><td class="num">' + money2(st.price * t[1]) + '</td><td class="xw">' + t[2] + "</td></tr>"; }).join("") + "</tbody></table>" +
        note("Change the price on the Overview page and these follow. Discounts are 15 percent at 10 seats and 30 percent at 50. The terms are written down once and the system enforces them.");
    },
    live: function (st, el, main, screen) {
      var k = el.getAttribute("data-live");
      if (k === "app") { st.app = el.value.trim(); var nm = screen.querySelector("[data-appname]"); if (nm) nm.textContent = Console.name(st); }
      if (k === "price") { st.price = Number(el.value); var o = main.querySelector("[data-price-out]"), m = main.querySelector("[data-mrr]"); if (o) o.textContent = st.price; if (m) m.textContent = money(Console.mrr(st)); }
      if (k === "newSeats") { st.newSeats = Number(el.value); var so = main.querySelector("[data-seats-out]"); if (so) so.textContent = st.newSeats; }
    },
    act: function (st, act, el, form) {
      if (act === "addcust") {
        var name = form.name.value.trim(); if (!name) { form.name.focus(); return false; }
        var c = { name: name, seats: st.newSeats, since: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }), trial: form.trial.checked };
        c.key = licenseKey(st.app + name + st.next); st.next++; st.customers.unshift(c);
        st.msg = "License " + c.key + " created for " + name + (c.trial ? " as a trial." : ", " + money(Console.monthly(st, c)) + " a month."); return true;
      }
      if (act === "copykey") { var ck = st.customers[Number(el.getAttribute("data-i"))]; st.msg = copyText(ck.key) ? "Key for " + ck.name + " copied." : "Your browser blocked the clipboard."; return true; }
      if (act === "exportcust") { var rows = [["Customer", "Seats", "Monthly", "Status", "Since", "License key"]].concat(st.customers.map(function (c) { return [c.name, c.seats, Console.monthly(st, c).toFixed(2), c.trial ? "Trial" : "Active", c.since, c.key]; })); st.msg = download("customers.csv", csv(rows), "text/csv") ? "customers.csv downloaded." : "Your browser blocked the download."; return true; }
      return false;
    }
  };

  /* =====================================================================
     The shell: who it is for, the device, and the start-from-this form
     ===================================================================== */
  var AUD = [
    { id: "works", label: "Public works", kind: "Work orders", app: WorkOrders, ask: "Want a work order board like this for your department?", hint: "For example: photos from the truck, and a public map of what is open", title: "Work orders for a streets crew", why: "Requests come in from the website, the front desk, and the phone. The board is the one list the crew works from, and the Friday report writes itself.", topic: "build" },
    { id: "gov", label: "Local government", kind: "Permit desk", app: Permits, ask: "Want a permit desk like this for your office?", hint: "For example: online payment, and inspections scheduled from the permit", title: "A permit desk residents can use from a phone", why: "Apply, see the fee, get the permit by email. The clerk works one queue instead of a stack of PDFs, and the fee table is theirs to edit.", topic: "build" },
    { id: "biz", label: "Small business", kind: "Estimates", app: Estimates, ask: "Want estimates like this for your business?", hint: "For example: customer signatures, and an export for the bookkeeper", title: "Estimates that go out before you leave the driveway", why: "Line items, tax, a copy the customer can read on a phone, and a list of what is still waiting on a yes.", topic: "build" },
    { id: "np", label: "Nonprofit", kind: "Volunteer shifts", app: Volunteers, ask: "Want volunteer sign-ups like this for your organization?", hint: "For example: background check status, and text reminders", title: "Volunteer shifts that fill themselves", why: "Open spots, sign-ups, reminders, and the hours report your board asks for, without a shared spreadsheet that nobody trusts.", topic: "build" },
    { id: "learn", label: "Learning platform", kind: "Course player", app: Course, ask: "Want a course player like this for your learners?", hint: "For example: our own videos, and a report for managers", title: "A course player with a quiz and a certificate", why: "Lessons, a pass mark, and a certificate the learner downloads. The sample course is three short lessons on spotting phishing; yours would be your content.", topic: "build" },
    { id: "idea", label: "My own idea", kind: "Licensing console", app: Console, ask: "Have an idea that needs this behind it?", hint: "For example: what it does and who would pay for it", title: "The back office your idea needs once it is a product", why: "Name the app, set a price per seat, add a customer, and the license key is generated. This is what we set up so you can sell what you own.", topic: "idea" }
  ];
  var byId = {}; AUD.forEach(function (a) { byId[a.id] = a; });

  /* Palettes and fonts the visitor can pick for each sample app. Applied as CSS variables on the screen. */
  var PALETTES = [
    { id: "evergreen", label: "Evergreen and brass", top: "#12352b", side: "#0c241d", accent: "#184a3c", accentDark: "#12352b", soft: "#dfeae3", hi: "#d4a84b", bg: "#f4f5f1" },
    { id: "navy", label: "Navy and amber", top: "#1b2a4a", side: "#111c33", accent: "#24407a", accentDark: "#1b2f5c", soft: "#dfe6f3", hi: "#f0b44c", bg: "#f3f4f7" },
    { id: "slate", label: "Slate and teal", top: "#2f3e46", side: "#1f2a30", accent: "#2a7f80", accentDark: "#1f6364", soft: "#d9eeee", hi: "#8fd8cc", bg: "#f4f6f6" },
    { id: "oxblood", label: "Oxblood and gold", top: "#5c1a1f", side: "#3b1013", accent: "#8b2a30", accentDark: "#6a1f24", soft: "#f3e0e1", hi: "#e3b85b", bg: "#f7f4f1" },
    { id: "graphite", label: "Graphite and lime", top: "#2b2b2b", side: "#1a1a1a", accent: "#3f3f3f", accentDark: "#262626", soft: "#e6e6e6", hi: "#b5e03d", bg: "#f5f5f5" },
    { id: "paper", label: "Paper and blue", top: "#ffffff", topInk: "#1a221e", topMuted: "#6b7280", side: "#f1f2ee", sideInk: "#1a221e", sideMuted: "#5e675f", sideOn: "rgba(0, 0, 0, 0.05)", accent: "#1f5c9b", accentDark: "#174a7e", soft: "#dde9f6", hi: "#1f5c9b", bg: "#fafafa" }
  ];
  var FONTS = [
    { id: "sans", label: "Public Sans", kind: "Sans, the site's own", body: '"Public Sans", "Helvetica Neue", Arial, sans-serif', head: '"Source Serif 4", Georgia, serif', size: "12px" },
    { id: "inter", label: "Inter", kind: "Sans, plain and modern", body: 'Inter, "Helvetica Neue", Arial, sans-serif', head: 'Inter, "Helvetica Neue", Arial, sans-serif', size: "12px" },
    { id: "plex", label: "IBM Plex Sans", kind: "Sans, technical", body: '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif', head: '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif', size: "12px" },
    { id: "atkinson", label: "Atkinson Hyperlegible", kind: "Sans, built for low vision", body: '"Atkinson Hyperlegible", Arial, sans-serif', head: '"Atkinson Hyperlegible", Arial, sans-serif', size: "12px" },
    { id: "nunito", label: "Nunito", kind: "Sans, rounded and friendly", body: 'Nunito, "Trebuchet MS", sans-serif', head: 'Nunito, "Trebuchet MS", sans-serif', size: "12.5px" },
    { id: "barlow", label: "Barlow", kind: "Sans, narrow and industrial", body: 'Barlow, "Arial Narrow", sans-serif', head: 'Barlow, "Arial Narrow", sans-serif', size: "12.5px" },
    { id: "grotesk", label: "Space Grotesk", kind: "Sans, a little odd", body: '"Space Grotesk", "Helvetica Neue", Arial, sans-serif', head: '"Space Grotesk", "Helvetica Neue", Arial, sans-serif', size: "12px" },
    { id: "serif", label: "Source Serif", kind: "Serif, the site's own", body: '"Source Serif 4", Georgia, serif', head: '"Source Serif 4", Georgia, serif', size: "12.5px" },
    { id: "lora", label: "Lora", kind: "Serif, warm", body: 'Lora, Georgia, serif', head: 'Lora, Georgia, serif', size: "12px" },
    { id: "merriweather", label: "Merriweather", kind: "Serif, sturdy", body: 'Merriweather, Georgia, serif', head: 'Merriweather, Georgia, serif', size: "11.5px" },
    { id: "mono", label: "JetBrains Mono", kind: "Monospace", body: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', head: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', size: "11px" },
    { id: "system", label: "System", kind: "Whatever the device uses", body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', head: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', size: "12px" }
  ];
  /* A palette made from one color the visitor picks. */
  function hexToHsl(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return { h: 160, s: 50, l: 14 };
    var r = parseInt(m[1].slice(0, 2), 16) / 255, g = parseInt(m[1].slice(2, 4), 16) / 255, b = parseInt(m[1].slice(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) { s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function hsl(h, s, l) { return "hsl(" + Math.round(h) + " " + Math.round(s) + "% " + Math.round(l) + "%)"; }
  function derivePalette(hex) {
    var c = hexToHsl(hex), h = c.h, s = c.s < 8 ? 0 : Math.min(c.s, 72);
    var hi = s === 0 ? "#d4a84b" : hsl((h + 45) % 360, 70, 62);
    if (c.l > 62) return { id: "custom", label: "your color " + hex, top: "#ffffff", topInk: "#1a221e", topMuted: "#6b7280", side: hsl(h, Math.min(s, 30), 95), sideInk: "#1a221e", sideMuted: "#5e675f", sideOn: "rgba(0, 0, 0, 0.05)", accent: hsl(h, s, 34), accentDark: hsl(h, s, 26), soft: hsl(h, Math.max(30, s), 92), hi: hsl(h, s, 34), bg: hsl(h, 15, 97) };
    return { id: "custom", label: "your color " + hex, top: hsl(h, s, Math.min(c.l, 24)), side: hsl(h, s, 13), accent: hsl(h, s, 34), accentDark: hsl(h, s, 26), soft: hsl(h, Math.max(25, s * 0.6), 92), hi: hi, bg: hsl(h, 12, 96.5) };
  }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return list[0]; }

  var hero = document.getElementById("try");
  if (!hero) return;
  var screen = hero.querySelector("[data-screen]"), device = hero.querySelector("[data-device]"), devSeg = hero.querySelector("[data-devseg]");
  var audSeg = hero.querySelector("[data-aud]"), titleEl = hero.querySelector("[data-title]"), whyEl = hero.querySelector("[data-why]"), kindEl = hero.querySelector("[data-kind]");
  var resetBtn = hero.querySelector("[data-reset]"), startForm = hero.querySelector("[data-start]"), startLabel = hero.querySelector("[data-start-label]"), needEl = hero.querySelector("[data-need]");
  var swatches = hero.querySelector("[data-swatches]"), fontBtn = hero.querySelector("[data-fontbtn]"), fontMenu = hero.querySelector("[data-fontmenu]"), fontName = hero.querySelector("[data-fontname]");
  var state = { aud: "works", device: window.innerWidth < 760 ? "phone" : "desktop" };
  var states = {}, themes = {};
  function current() { return byId[state.aud]; }
  function st() { if (!states[state.aud]) states[state.aud] = current().app.init(); return states[state.aud]; }
  function theme() { if (!themes[state.aud]) themes[state.aud] = { palette: "evergreen", font: "sans", custom: "#1b3a6b" }; return themes[state.aud]; }
  function palette() { var t = theme(); return t.palette === "custom" ? derivePalette(t.custom) : find(PALETTES, t.palette); }

  // The swatches: one per palette, then one that opens the device's own color picker.
  PALETTES.forEach(function (p) {
    var l = document.createElement("label"); l.className = "sw";
    l.innerHTML = '<input type="radio" name="palette" value="' + p.id + '"' + (p.id === "evergreen" ? " checked" : "") + ' aria-label="' + esc(p.label) + '"><i style="--a:' + p.top + ';--b:' + p.hi + '"></i><span class="tip">' + esc(p.label) + "</span>";
    swatches.appendChild(l);
  });
  var customSw = document.createElement("label"); customSw.className = "sw custom";
  customSw.innerHTML = '<input type="color" value="#1b3a6b" data-custom aria-label="Your own color"><i></i><span class="tip">Your own color</span>';
  swatches.appendChild(customSw);
  var customIn = customSw.querySelector("[data-custom]");
  swatches.addEventListener("change", function (e) { if (e.target.name === "palette") { theme().palette = e.target.value; applyTheme(); } });
  customIn.addEventListener("input", function () { var t = theme(); t.custom = customIn.value; t.palette = "custom"; applyTheme(); });

  // The font menu: every typeface shown in itself, so the choice is visible before it is made.
  FONTS.forEach(function (f) {
    var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "option"); b.setAttribute("data-font", f.id);
    b.innerHTML = '<span class="aa" style="font-family:' + f.head.replace(/"/g, "&quot;") + '">Aa</span><span><span class="fn" style="font-family:' + f.body.replace(/"/g, "&quot;") + '">' + esc(f.label) + '</span><span class="fd">' + esc(f.kind) + "</span></span>";
    b.addEventListener("click", function () { theme().font = f.id; applyTheme(); closeFonts(); fontBtn.focus(); });
    fontMenu.appendChild(b);
  });
  function openFonts() { fontMenu.hidden = false; fontBtn.setAttribute("aria-expanded", "true"); var sel = fontMenu.querySelector('[aria-selected="true"]'); if (sel) sel.focus(); }
  function closeFonts() { fontMenu.hidden = true; fontBtn.setAttribute("aria-expanded", "false"); }
  fontBtn.addEventListener("click", function () { if (fontMenu.hidden) openFonts(); else closeFonts(); });
  document.addEventListener("click", function (e) { if (!fontMenu.hidden && !fontMenu.contains(e.target) && e.target !== fontBtn && !fontBtn.contains(e.target)) closeFonts(); });
  document.addEventListener("keydown", function (e) {
    if (fontMenu.hidden) return;
    if (e.key === "Escape") { closeFonts(); fontBtn.focus(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); var opts = Array.prototype.slice.call(fontMenu.querySelectorAll("button")), i = opts.indexOf(document.activeElement); opts[(i + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length].focus(); }
  });

  function applyTheme() {
    var t = theme(), p = palette(), f = find(FONTS, t.font), cs = screen.style;
    cs.setProperty("--ui-top", p.top); cs.setProperty("--ui-top-ink", p.topInk || "#ffffff"); cs.setProperty("--ui-top-muted", p.topMuted || "rgba(255, 255, 255, 0.7)");
    cs.setProperty("--ui-side", p.side); cs.setProperty("--ui-side-ink", p.sideInk || "#ffffff"); cs.setProperty("--ui-side-muted", p.sideMuted || "rgba(255, 255, 255, 0.72)"); cs.setProperty("--ui-side-on", p.sideOn || "rgba(255, 255, 255, 0.06)");
    cs.setProperty("--ui-accent", p.accent); cs.setProperty("--ui-accent-dark", p.accentDark); cs.setProperty("--ui-accent-soft", p.soft); cs.setProperty("--ui-hi", p.hi); cs.setProperty("--ui-bg", p.bg);
    cs.setProperty("--ui-font", f.body); cs.setProperty("--ui-font-head", f.head); cs.setProperty("--ui-size", f.size);
    var radio = swatches.querySelector('input[name="palette"][value="' + t.palette + '"]');
    Array.prototype.forEach.call(swatches.querySelectorAll('input[name="palette"]'), function (r) { r.checked = false; });
    if (radio) radio.checked = true;
    customSw.classList.toggle("on", t.palette === "custom"); customSw.querySelector("i").style.background = t.palette === "custom" ? p.top : ""; if (customIn.value !== t.custom) customIn.value = t.custom;
    fontName.textContent = f.label;
    Array.prototype.forEach.call(fontMenu.querySelectorAll("button"), function (b) { b.setAttribute("aria-selected", b.getAttribute("data-font") === t.font ? "true" : "false"); });
    fitScreen();
  }

  function clock() { return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }

  function draw(animate, fromUser) {
    var a = current(), app = a.app, s = st(), phone = state.device === "phone";
    var views = app.views(s);
    var nav = views.map(function (v) {
      var on = s.view === v.id ? " on" : "", lock = v.locked ? " locked" : "", done = v.done ? " done" : "";
      return '<button type="button" class="nv' + on + lock + done + '" data-act="view" data-v="' + v.id + '"' + (v.locked ? ' aria-disabled="true"' : "") + "><span>" + esc(phone && v.tab ? v.tab : v.label) + "</span></button>";
    }).join("");
    var html = '<div class="app-top"><span class="app-name" data-appname>' + esc(app.name(s)) + '</span><span class="who">' + esc(app.who(s)) + '</span><span class="clock" data-clock>' + clock() + "</span></div>";
    html += '<div class="app-body">' + (phone ? "" : '<nav class="app-side" aria-label="' + esc(app.section) + '"><div class="side-head">' + esc(app.section) + "</div>" + nav + "</nav>");
    html += '<div class="app-main" data-main>' + app.render(s, s.view, phone) + (s.msg ? '<div class="toast" role="status">' + esc(s.msg) + "</div>" : "") + "</div></div>";
    if (phone) html += '<nav class="app-tabs" aria-label="' + esc(app.section) + '">' + nav + "</nav>";
    // The built app, and on a switch, the same app as a blueprint on top of it, wiped away left to right.
    var plan = animate && !reduceMotion;
    screen.innerHTML = '<div class="layer real">' + html + "</div>" + (plan ? '<div class="layer plan" aria-hidden="true" inert>' + html.replace(/ (data-[a-z-]+|name|aria-label|title|placeholder)="[^"]*"/g, "").replace(/ (data-[a-z-]+|required|autofocus|checked|disabled|tabindex="0")(?=[ >])/g, "") + '</div><div class="scan" aria-hidden="true"></div>' : "");
    if (plan) setTimeout(function () { Array.prototype.forEach.call(screen.querySelectorAll(".plan, .scan"), function (e) { if (e.parentNode) e.parentNode.removeChild(e); }); }, 1400);
    if (s.msg) { s.msg = null; var t = screen.querySelector(".toast"); setTimeout(function () { if (t && t.parentNode) t.parentNode.removeChild(t); }, 3200); }
    var auto = screen.querySelector(".real [autofocus]"); if (auto && fromUser) { try { auto.focus({ preventScroll: true }); } catch (e) { auto.focus(); } }
    fitScreen();
  }

  function fitScreen() {
    device.className = "device " + state.device;
    if (state.device === "desktop") {
      var scale = Math.min(1, device.clientWidth / 720);
      screen.style.transform = "scale(" + scale + ")";
      device.style.height = Math.round(450 * scale) + "px";
    } else { screen.style.transform = ""; device.style.height = ""; }
  }

  var headEl = hero.querySelector("[data-head]");
  function setAud(id, animate) {
    state.aud = id;
    var a = current();
    if (animate && !reduceMotion && headEl) { headEl.classList.add("swap"); setTimeout(function () { titleEl.textContent = a.title; whyEl.textContent = a.why; headEl.classList.remove("swap"); }, 220); }
    else { titleEl.textContent = a.title; whyEl.textContent = a.why; }
    if (kindEl) kindEl.textContent = a.kind;
    startLabel.textContent = a.ask; needEl.placeholder = a.hint;
    applyTheme();
    draw(animate);
  }

  // Events inside the screen: clicks, form submits, live inputs, and selects.
  screen.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]"); if (!el || el.tagName === "FORM") return;
    var act = el.getAttribute("data-act"), s = st(), app = current().app;
    if (act === "view") {
      var v = el.getAttribute("data-v");
      if (app.locked && app.locked(s, v)) { s.msg = "Pass the quiz first."; draw(false, true); return; }
      s.view = v; draw(false, true); return;
    }
    if (app.act(s, act, el, null)) draw(false, true);
  });
  screen.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var el = e.target.closest("tr[data-act]"); if (!el) return;
    e.preventDefault(); var s = st(); if (current().app.act(s, el.getAttribute("data-act"), el, null)) draw(false, true);
  });
  screen.addEventListener("submit", function (e) {
    var form = e.target.closest("form[data-act]"); if (!form) return;
    e.preventDefault(); var s = st();
    if (current().app.act(s, form.getAttribute("data-act"), form, form)) draw(false, true);
  });
  screen.addEventListener("input", function (e) {
    var el = e.target; if (!el.hasAttribute("data-live")) return;
    var app = current().app; if (app.live) app.live(st(), el, screen.querySelector(".real [data-main]"), screen);
    if (el.type === "range") fill(el);
  });
  screen.addEventListener("change", function (e) {
    var el = e.target; if (!el.hasAttribute("data-change")) return;
    if (current().app.act(st(), el.getAttribute("data-change"), el, null)) draw(false, true);
  });
  function fill(r) { var min = Number(r.min || 0), max = Number(r.max || 100), v = Number(r.value); r.style.setProperty("--fill", ((v - min) / (max - min) * 100) + "%"); }
  new MutationObserver(function () { Array.prototype.forEach.call(screen.querySelectorAll(".rng"), fill); }).observe(screen, { childList: true, subtree: true });

  // Who it is for
  audSeg.addEventListener("change", function (e) { if (e.target.name === "aud") setAud(e.target.value, true); });
  devSeg.addEventListener("change", function (e) { if (e.target.name === "device") { state.device = e.target.value; draw(); } });
  resetBtn.addEventListener("click", function () { states[state.aud] = current().app.init(); states[state.aud].msg = "Sample data restored."; draw(true); });
  window.addEventListener("resize", fitScreen);
  setInterval(function () { var c = screen.querySelector(".real [data-clock]"); if (c) c.textContent = clock(); }, 30000);

  // Start from this: opens the contact page with the message drafted.
  startForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var a = current(), need = needEl.value.trim();
    var t = theme(), look = (t.palette !== "evergreen" || t.font !== "sans") ? " Look: " + palette().label.toLowerCase() + ", " + find(FONTS, t.font).label + " type." : "";
    var draft = "I tried the " + a.kind.toLowerCase() + " sample for " + a.label.toLowerCase() + " on your site." + look + (need ? " Our version would need: " + need : " Here is what we need: ");
    window.location.href = startForm.getAttribute("action") + "?topic=" + a.topic + "&draft=" + encodeURIComponent(draft);
  });

  // The headline arrives a word at a time; the map drifts as the page scrolls; sections draw in as they arrive.
  var h1 = hero.querySelector("[data-words]");
  if (h1 && !reduceMotion) {
    var n = 0;
    Array.prototype.forEach.call(h1.childNodes, function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) { if (!part) return; if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; } var w = document.createElement("span"); w.className = "w"; w.style.setProperty("--i", n++); w.textContent = part; frag.appendChild(w); });
        h1.replaceChild(frag, node);
      } else if (node.nodeType === 1) {
        var inner = node.textContent; node.textContent = "";
        inner.split(/(\s+)/).forEach(function (part) { if (!part) return; if (/^\s+$/.test(part)) { node.appendChild(document.createTextNode(part)); return; } var w2 = document.createElement("span"); w2.className = "w"; w2.style.setProperty("--i", n++); w2.textContent = part; node.appendChild(w2); });
      }
    });
    h1.classList.add("words");
  }
  var topo = hero.querySelector("[data-topo]");
  if (topo && !reduceMotion) {
    var ticking = false;
    var drift = function () { topo.style.transform = "translate3d(0," + Math.round(window.scrollY * 0.18) + "px,0)"; ticking = false; };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; window.requestAnimationFrame(drift); } }, { passive: true });
    drift();
  }
  var seenEls = document.querySelectorAll("[data-seen], .prod, .probono");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("seen"); io.unobserve(en.target); } }); }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    Array.prototype.forEach.call(seenEls, function (e) { io.observe(e); });
  } else { Array.prototype.forEach.call(seenEls, function (e) { e.classList.add("seen"); }); }

  // Boot
  devSeg.querySelector('input[value="' + state.device + '"]').checked = true;
  var startAud = (location.hash.match(/^#try-(\w+)$/) || [])[1];
  if (startAud && byId[startAud]) audSeg.querySelector('input[value="' + startAud + '"]').checked = true; else startAud = "works";
  setAud(startAud, true);
})();
