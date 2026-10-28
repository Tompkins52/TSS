/* TSS Invoice Creator. The invoice on the page is the form: tap any part of it and type.
   Everything runs in the browser. The invoice in progress and the business details are kept in
   this browser's storage so a refresh or a new visit picks up where you left off. Nothing is sent anywhere. */
(function () {
  "use strict";
  var KEY = "tss-invoice-creator";
  var inv_el = document.querySelector("[data-inv]"); if (!inv_el) return;
  var savedEl = document.querySelector("[data-saved]"), logoIn = document.querySelector("[data-logo]"), toolbar = document.querySelector("[data-toolbar]");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { n = Number(n) || 0; return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(v) { if (typeof v === "number") return isFinite(v) ? v : 0; var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function today() { return iso(new Date()); }
  function addDays(isoDate, n) { var p = (isoDate || today()).split("-").map(Number); var d = new Date(p[0], p[1] - 1, p[2]); d.setDate(d.getDate() + n); return iso(d); }
  function longDate(isoDate) { if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return ""; var p = isoDate.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
  function termDays(t) { var m = /Net (\d+)/.exec(t || ""); return m ? Number(m[1]) : 0; }
  function nextNumber(n) { var m = /^(.*?)(\d+)(\D*)$/.exec(n || ""); if (!m) return (n || "INV") + "-2"; var w = m[2].length; return m[1] + String(Number(m[2]) + 1).padStart(w, "0") + m[3]; }
  function get(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function set(o, path, v) { var ks = path.split("."), last = ks.pop(), t = ks.reduce(function (a, k) { if (a[k] == null) a[k] = {}; return a[k]; }, o); t[last] = v; }
  var TERMS = ["Due on receipt", "Net 15", "Net 30", "Net 45", "Net 60"];

  function blank() {
    return { biz: { name: "", addr: "", phone: "", email: "", web: "", taxid: "", accent: "#12352b", logo: "" },
      num: "INV-1001", date: today(), terms: "Net 30", due: addDays(today(), 30), dueAuto: true, po: "", ref: "",
      cust: { name: "", attn: "", addr: "", email: "" }, ship: "", desc: "", from: "", to: "",
      lines: [{ d: "", q: 1, r: "", t: true }], disc: "", tax: "", freight: "", paid: "",
      prog: { on: false, contract: "", n: 1, m: 3, prev: "" }, pay: { to: "", late: "", instr: "", notes: "" }, show: {} };
  }
  function sample() {
    var s = blank();
    s.biz = { name: "Hart Electric LLC", addr: "300 Main St, Suite 2\nPrairie City, IL", phone: "(555) 010-0142", email: "office@hartelectric.example", web: "hartelectric.example", taxid: "", accent: "#12352b", logo: "" };
    s.num = "INV-1043"; s.po = "PO 4471"; s.ref = "Quote 1042";
    s.cust = { name: "Lakeside Dental", attn: "Accounts payable", addr: "42 Lakeview Dr\nPrairie City, IL", email: "ap@lakesidedental.example" };
    s.ship = "Same as billing"; s.desc = "Panel upgrade and six new 20 A circuits for the second-floor exam rooms. Inspected and passed."; s.from = addDays(today(), -16); s.to = addDays(today(), -3);
    s.lines = [{ d: "200 A panel and breakers (parts)", q: 1, r: 1180, t: true }, { d: "Labor, panel replacement (hours)", q: 8, r: 95, t: false }, { d: "20 A circuit materials", q: 6, r: 85, t: true }, { d: "Labor, circuits (hours)", q: 12, r: 95, t: false }, { d: "Permit and inspection", q: 1, r: 180, t: false }];
    s.tax = 7.25; s.freight = 48.5; s.paid = 1500;
    s.prog = { on: true, contract: 9600, n: 2, m: 3, prev: 3200 };
    s.pay = { to: "Hart Electric LLC", late: "1.5% per month after the due date", instr: "Mail checks to the address above, or ask for our ACH letter. Card payments add 3%.", notes: "Thank you for the work. The panel carries a two-year workmanship warranty; call us before you call anyone else." };
    return s;
  }
  function merge(base, over) {
    Object.keys(over || {}).forEach(function (k) {
      if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k]) && base[k] && typeof base[k] === "object") base[k] = merge(base[k], over[k]);
      else base[k] = over[k];
    });
    return base;
  }

  var inv, store = null;
  try { store = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { store = null; }
  inv = store && store.last ? merge(blank(), store.last) : sample();
  var isSample = !(store && store.last);

  /* ---------- Totals ---------- */
  function totals() {
    var sub = 0, taxable = 0;
    inv.lines.forEach(function (l) { var a = num(l.q) * num(l.r); sub += a; if (l.t) taxable += a; });
    var disc = Math.min(sub, num(inv.disc)), taxBase = sub ? Math.max(0, taxable - disc * (taxable / sub)) : 0;
    var tax = taxBase * num(inv.tax) / 100, freight = num(inv.freight), paid = num(inv.paid);
    var total = sub - disc + tax + freight;
    return { sub: sub, disc: disc, taxBase: taxBase, tax: tax, freight: freight, total: total, paid: paid, due: total - paid };
  }
  function shown(key, value) { return !!(inv.show && inv.show[key]) || !!(value && String(value).trim()); }

  /* ---------- Pieces of the editable invoice ---------- */
  function ed(path, ph, cls, multi, extra) {
    var v = get(inv, path); v = v == null ? "" : String(v);
    return '<span class="ed' + (cls ? " " + cls : "") + (multi ? " multi" : "") + '" contenteditable="true" data-f="' + path + '" data-ph="' + esc(ph) + '"' + (extra || "") + ">" + esc(v) + "</span>";
  }
  function edNum(path, ph, cls, fmt) {
    var v = get(inv, path), text = v === "" || v == null ? "" : (fmt === "money" ? money(v) : fmt === "pct" ? num(v) + "%" : String(v));
    return '<span class="ed num' + (cls ? " " + cls : "") + '" contenteditable="true" inputmode="decimal" data-f="' + path + '" data-num="' + (fmt || "plain") + '" data-ph="' + esc(ph) + '">' + esc(text) + "</span>";
  }
  function dateField(path, ph) {
    var v = get(inv, path) || "";
    return '<span class="dt" data-date="' + path + '"><input type="date" value="' + esc(v) + '" aria-label="' + esc(ph) + '"><b class="dt-text' + (v ? "" : " ph") + '">' + (longDate(v) || ph) + "</b></span>";
  }
  function addLink(key, label) { return '<button type="button" class="add" data-show="' + key + '">+ ' + esc(label) + "</button>"; }
  function removeLink(key, label) { return '<button type="button" class="rm" data-hide="' + key + '" aria-label="Remove ' + esc(label) + '">×</button>'; }

  function render() {
    var t = totals(), b = inv.biz, c = inv.cust;
    inv_el.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(b.accent) ? b.accent : "#12352b");
    var html = '<header class="inv-top"><div class="inv-biz">' +
      (b.logo ? '<span class="logo-wrap"><img src="' + b.logo + '" alt=""><button type="button" class="rm logo-rm" data-logo-clear aria-label="Remove logo">×</button></span>' : '<button type="button" class="add logo-add" data-logo-pick>+ Add your logo</button>') +
      ed("biz.name", "Your business name", "bn") + ed("biz.addr", "Street, city, state, ZIP", "bc", true) + ed("biz.phone", "Phone", "bc") + ed("biz.email", "Email", "bc") +
      (shown("web", b.web) ? ed("biz.web", "Website", "bc") : "") + (shown("taxid", b.taxid) ? '<span class="bc">Tax ID ' + ed("biz.taxid", "00-0000000", "inl") + "</span>" : "") +
      '<span class="adds">' + (shown("web", b.web) ? "" : addLink("web", "Website")) + (shown("taxid", b.taxid) ? "" : addLink("taxid", "Tax ID")) + "</span></div>" +
      '<div class="inv-title"><h2>Invoice</h2><label class="color-pick" title="Color on the invoice"><input type="color" value="' + esc(/^#[0-9a-f]{6}$/i.test(b.accent) ? b.accent : "#12352b") + '" data-accent aria-label="Color on the invoice"><i></i>Color</label>' +
      '<dl class="inv-meta"><div class="big"><dt>Invoice</dt><dd>' + ed("num", "INV-1001") + "</dd></div><div><dt>Date</dt><dd>" + dateField("date", "Pick a date") + "</dd></div>" +
      '<div><dt>Terms</dt><dd><span class="sel"><select data-f="terms" aria-label="Terms">' + TERMS.map(function (x) { return "<option" + (x === inv.terms ? " selected" : "") + ">" + x + "</option>"; }).join("") + '</select><b class="sel-text">' + esc(inv.terms) + "</b></span></dd></div>" +
      "<div><dt>Due</dt><dd>" + dateField("due", "Due date") + "</dd></div>" +
      "<div><dt>Customer PO</dt><dd>" + ed("po", "PO number", "", false, ' data-opt="1"') + "</dd></div>" +
      (shown("ref", inv.ref) ? "<div><dt>Reference</dt><dd>" + ed("ref", "Job or quote") + "</dd></div>" : "") +
      (inv.prog.on ? "<div><dt>This is invoice</dt><dd>" + edNum("prog.n", "1", "inl") + " of " + edNum("prog.m", "3", "inl") + "</dd></div>" : "") +
      '</dl><span class="adds right">' + (shown("ref", inv.ref) ? "" : addLink("ref", "Reference")) + "</span></div></header>";

    html += '<section class="inv-parties"><div><h3>Bill to</h3>' + ed("cust.name", "Customer name", "bn") + (shown("attn", c.attn) ? "<div>Attn: " + ed("cust.attn", "Accounts payable, a person", "inl") + "</div>" : "") + ed("cust.addr", "Billing address", "", true) + ed("cust.email", "Email", "") +
      '<span class="adds">' + (shown("attn", c.attn) ? "" : addLink("attn", "Attention line")) + (shown("ship", inv.ship) ? "" : addLink("ship", "Ship to or job site")) + "</span></div>" +
      (shown("ship", inv.ship) ? "<div><h3>Ship to / job site " + removeLink("ship", "ship to") + "</h3>" + ed("ship", "Address or job site", "", true) + "</div>" : "") +
      '<div><h3>Services</h3>' + ed("desc", "What you did, in a sentence or two", "", true) +
      (shown("period", inv.from || inv.to) ? '<div class="period">' + dateField("from", "From") + " to " + dateField("to", "To") + " " + removeLink("period", "service period") + "</div>" : '<span class="adds">' + addLink("period", "Service period") + "</span>") + "</div></section>";

    html += '<table class="inv-lines"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th><th class="ctl"></th></tr></thead><tbody>' +
      inv.lines.map(function (l, i) {
        return '<tr data-i="' + i + '"><td>' + ed("lines." + i + ".d", "What was done or delivered", "ld") + '</td><td class="num">' + edNum("lines." + i + ".q", "1", "", "plain") + '</td><td class="num">' + edNum("lines." + i + ".r", "$0.00", "", "money") + '</td><td class="num amt" data-amt="' + i + '">' + money(num(l.q) * num(l.r)) + (l.t && num(inv.tax) ? '<span class="t">T</span>' : "") + '</td><td class="ctl"><button type="button" class="tax" data-tax="' + i + '" aria-pressed="' + (l.t ? "true" : "false") + '" title="Sales tax applies to this line">tax</button><button type="button" class="rm" data-rmline="' + i + '" aria-label="Remove line">×</button></td></tr>';
      }).join("") + '<tr class="addrow"><td colspan="5">' + addLink("line", "Add a line item") + "</td></tr></tbody></table>";

    var prog = "";
    if (inv.prog.on) {
      var contract = num(inv.prog.contract), billed = num(inv.prog.prev) + t.total, pct = contract ? Math.max(0, Math.min(100, billed / contract * 100)) : 0;
      prog = '<div class="inv-prog"><h3>Progress on ' + (inv.po ? esc(inv.po) : "the contract") + " " + removeLink("prog", "progress billing") + "</h3><div><span>Contract or PO amount</span>" + edNum("prog.contract", "$0.00", "", "money") + "</div><div><span>Previously billed</span>" + edNum("prog.prev", "$0.00", "", "money") + '</div><div><span>This invoice (<span data-prog-n>' + esc(inv.prog.n) + "</span> of <span data-prog-m>" + esc(inv.prog.m) + '</span>)</span><span data-prog-this>' + money(t.total) + '</span></div><div><span>Billed to date</span><span data-prog-billed>' + money(billed) + '</span></div><div><span>Remaining</span><span data-prog-left>' + money(contract - billed) + '</span></div><div class="bar"><i data-prog-bar style="width:' + pct.toFixed(1) + '%"></i></div></div>';
    } else prog = '<div class="adds col">' + addLink("prog", "Progress billing (invoice 2 of 3 on a PO)") + "</div>";
    var tot = '<div class="inv-totals"><div><span>Subtotal</span><span data-sub>' + money(t.sub) + "</span></div>" +
      (shown("disc", inv.disc) ? "<div><span>Discount " + removeLink("disc", "discount") + "</span>" + edNum("disc", "$0.00", "", "money") + "</div>" : "") +
      '<div data-taxrow' + (num(inv.tax) ? "" : ' class="quiet"') + '><span>Taxable subtotal</span><span data-taxbase>' + money(t.taxBase) + "</span></div>" +
      "<div><span>Sales tax at " + edNum("tax", "0%", "inl", "pct") + '</span><span data-taxamt>' + money(t.tax) + "</span></div>" +
      "<div><span>Freight</span>" + edNum("freight", "$0.00", "", "money") + "</div>" +
      '<div class="total"><span>Total</span><span data-total>' + money(t.total) + "</span></div>" +
      (shown("paid", inv.paid) ? "<div><span>Deposit received " + removeLink("paid", "deposit") + "</span>" + edNum("paid", "$0.00", "", "money") + "</div>" : "") +
      '<div class="due"><span>Balance due</span><span data-due>' + money(t.due) + "</span></div>" +
      '<span class="adds">' + (shown("disc", inv.disc) ? "" : addLink("disc", "Discount")) + (shown("paid", inv.paid) ? "" : addLink("paid", "Deposit received")) + "</span></div>";
    html += '<div class="inv-sum">' + prog + tot + "</div>";

    var pay = inv.pay;
    html += '<section class="inv-pay"><div><h3>Payment</h3><div>Make checks payable to ' + ed("pay.to", "your business", "inl b") + "</div>" + ed("pay.instr", "Where to send a check, ACH details, or a card link", "", true) +
      (shown("late", pay.late) ? "<div>" + ed("pay.late", "Late fee or early-pay terms", "") + " " + removeLink("late", "late fee") + "</div>" : '<span class="adds">' + addLink("late", "Late fee or early-pay terms") + "</span>") + "</div>" +
      (shown("notes", pay.notes) ? "<div><h3>Notes " + removeLink("notes", "notes") + "</h3>" + ed("pay.notes", "Thank you, warranty, or what happens next", "", true) + "</div>" : '<div class="adds col">' + addLink("notes", "Note to the customer") + "</div>") + "</section>";
    html += '<footer class="inv-foot"><span>' + (b.name ? "Questions? " + esc([b.phone, b.email].filter(Boolean).join(" or ")) : "") + "</span><span>Made with <b>TSS Invoice Creator</b>, free at tompkinssoftwaresystems.com</span></footer>";
    inv_el.innerHTML = html;
  }

  /* Numbers that follow a keystroke, without redrawing the invoice */
  function patch() {
    var t = totals(), setText = function (sel, v) { var e = inv_el.querySelector(sel); if (e) e.textContent = v; };
    inv.lines.forEach(function (l, i) { var a = inv_el.querySelector('[data-amt="' + i + '"]'); if (a) a.innerHTML = money(num(l.q) * num(l.r)) + (l.t && num(inv.tax) ? '<span class="t">T</span>' : ""); });
    setText("[data-sub]", money(t.sub)); setText("[data-taxbase]", money(t.taxBase)); setText("[data-taxamt]", money(t.tax)); setText("[data-total]", money(t.total)); setText("[data-due]", money(t.due));
    var tr = inv_el.querySelector("[data-taxrow]"); if (tr) tr.classList.toggle("quiet", !num(inv.tax));
    if (inv.prog.on) { var contract = num(inv.prog.contract), billed = num(inv.prog.prev) + t.total; setText("[data-prog-this]", money(t.total)); setText("[data-prog-billed]", money(billed)); setText("[data-prog-left]", money(contract - billed)); setText("[data-prog-n]", inv.prog.n); setText("[data-prog-m]", inv.prog.m); var bar = inv_el.querySelector("[data-prog-bar]"); if (bar) bar.style.width = (contract ? Math.max(0, Math.min(100, billed / contract * 100)) : 0).toFixed(1) + "%"; }
  }

  /* ---------- Editing ---------- */
  inv_el.addEventListener("input", function (e) {
    var el = e.target;
    if (el.matches("[contenteditable][data-f]")) {
      var path = el.getAttribute("data-f"), fmt = el.getAttribute("data-num");
      if (fmt) { var raw = el.textContent.trim(); set(inv, path, raw === "" ? "" : num(raw)); }
      else set(inv, path, el.classList.contains("multi") ? el.innerText.replace(/\n$/, "") : el.textContent);
      if (path === "biz.name") { var f = inv_el.querySelector(".inv-foot span:first-child"); if (f) f.textContent = inv.biz.name ? "Questions? " + [inv.biz.phone, inv.biz.email].filter(Boolean).join(" or ") : ""; }
      patch(); save(); return;
    }
    if (el.matches("select[data-f]")) { inv.terms = el.value; var st = el.parentNode.querySelector(".sel-text"); if (st) st.textContent = inv.terms; if (inv.dueAuto) { inv.due = addDays(inv.date, termDays(inv.terms)); refreshDate("due"); } save(); return; }
    if (el.matches('input[type="date"]')) {
      var p = el.closest("[data-date]").getAttribute("data-date"); set(inv, p, el.value);
      if (p === "due") inv.dueAuto = false;
      if (p === "date" && inv.dueAuto) { inv.due = addDays(inv.date, termDays(inv.terms)); refreshDate("due"); }
      refreshDate(p); save(); return;
    }
    if (el.matches("[data-accent]")) { inv.biz.accent = el.value; inv_el.style.setProperty("--accent", inv.biz.accent); save(); }
  });
  function refreshDate(path) { var wrap = inv_el.querySelector('[data-date="' + path + '"]'); if (!wrap) return; var v = get(inv, path) || "", b = wrap.querySelector(".dt-text"), i = wrap.querySelector("input"); b.textContent = longDate(v) || i.getAttribute("aria-label"); b.classList.toggle("ph", !v); if (i.value !== v) i.value = v; }
  inv_el.addEventListener("keydown", function (e) {
    var el = e.target; if (!el.matches || !el.matches("[contenteditable][data-f]")) return;
    if (e.key === "Enter" && !el.classList.contains("multi")) {
      e.preventDefault();
      var m = /^lines\.(\d+)\.r$/.exec(el.getAttribute("data-f"));
      if (m && Number(m[1]) === inv.lines.length - 1) { addLine(); return; }
      var all = Array.prototype.slice.call(inv_el.querySelectorAll("[contenteditable][data-f]")), i = all.indexOf(el); if (all[i + 1]) all[i + 1].focus();
    }
  });
  inv_el.addEventListener("paste", function (e) {
    var el = e.target; if (!el.matches || !el.matches("[contenteditable][data-f]")) return;
    e.preventDefault(); var text = (e.clipboardData || window.clipboardData).getData("text/plain"); if (!el.classList.contains("multi")) text = text.replace(/\s*\n\s*/g, " ");
    document.execCommand("insertText", false, text);
  });
  inv_el.addEventListener("focusout", function (e) {
    var el = e.target; if (!el.matches || !el.matches("[contenteditable][data-num]")) return;
    var fmt = el.getAttribute("data-num"), v = get(inv, el.getAttribute("data-f"));
    el.textContent = v === "" || v == null ? "" : fmt === "money" ? money(v) : fmt === "pct" ? num(v) + "%" : String(v);
  });
  inv_el.addEventListener("focusin", function (e) {
    var el = e.target; if (!el.matches || !el.matches("[contenteditable][data-num]")) return;
    var v = get(inv, el.getAttribute("data-f")); el.textContent = v === "" || v == null ? "" : String(v);
  });
  inv_el.addEventListener("click", function (e) {
    var b = e.target.closest("button, [data-date]"); if (!b) return;
    if (b.hasAttribute("data-show")) { var k = b.getAttribute("data-show"); if (k === "line") { addLine(); return; } if (k === "prog") inv.prog.on = true; inv.show = inv.show || {}; inv.show[k] = true; render(); save(); var first = inv_el.querySelector('[data-f^="' + ({ web: "biz.web", taxid: "biz.taxid", ref: "ref", attn: "cust.attn", ship: "ship", period: "from", disc: "disc", paid: "paid", prog: "prog.contract", late: "pay.late", notes: "pay.notes" })[k] + '"]'); if (first) first.focus(); return; }
    if (b.hasAttribute("data-hide")) { var h = b.getAttribute("data-hide"); if (inv.show) inv.show[h] = false; if (h === "prog") inv.prog.on = false; if (h === "ship") inv.ship = ""; if (h === "period") { inv.from = ""; inv.to = ""; } if (h === "disc") inv.disc = ""; if (h === "paid") inv.paid = ""; if (h === "late") inv.pay.late = ""; if (h === "notes") inv.pay.notes = ""; render(); save(); return; }
    if (b.hasAttribute("data-tax")) { var li = Number(b.getAttribute("data-tax")); inv.lines[li].t = !inv.lines[li].t; b.setAttribute("aria-pressed", inv.lines[li].t ? "true" : "false"); patch(); save(); return; }
    if (b.hasAttribute("data-rmline")) { inv.lines.splice(Number(b.getAttribute("data-rmline")), 1); if (!inv.lines.length) inv.lines.push({ d: "", q: 1, r: "", t: true }); render(); save(); return; }
    if (b.hasAttribute("data-logo-pick")) { logoIn.click(); return; }
    if (b.hasAttribute("data-logo-clear")) { inv.biz.logo = ""; logoIn.value = ""; render(); save(); return; }
    if (b.hasAttribute("data-date") && !e.target.matches("input")) { var di = b.querySelector("input"); try { if (di.showPicker) di.showPicker(); else di.focus(); } catch (err) { di.focus(); } }
  });
  function addLine() { inv.lines.push({ d: "", q: 1, r: "", t: true }); render(); save(); var last = inv_el.querySelector('[data-f="lines.' + (inv.lines.length - 1) + '.d"]'); if (last) last.focus(); }

  logoIn.addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () { var scale = Math.min(1, 400 / img.width, 160 / img.height), c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); inv.biz.logo = c.toDataURL("image/png"); render(); save(); };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  });

  /* ---------- Toolbar ---------- */
  toolbar.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-print")) { prepareOnePage(); setTimeout(function () { window.print(); }, 60); return; }
    if (b.hasAttribute("data-new")) { newInvoice(); return; }
    if (b.hasAttribute("data-csv")) { downloadCsv(); return; }
    if (b.hasAttribute("data-save")) { download("invoice-" + safe(inv.num) + ".json", JSON.stringify(inv, null, 2), "application/json"); return; }
    if (b.hasAttribute("data-sample")) { inv = sample(); isSample = true; render(); save(); return; }
    if (b.hasAttribute("data-clear")) { if (!window.confirm("Forget the saved invoice, your business details, and the logo on this device?")) return; try { localStorage.removeItem(KEY); } catch (err) { } inv = blank(); render(); savedEl.textContent = "Nothing is saved on this device."; return; }
  });
  document.querySelector("[data-open]").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () { try { var data = JSON.parse(r.result); if (!data || !data.lines) throw new Error("not an invoice"); inv = merge(blank(), data); isSample = false; render(); save(); } catch (err) { savedEl.textContent = "That file is not an invoice from this tool."; } };
    r.readAsText(f); e.target.value = "";
  });
  function newInvoice() {
    var keep = inv;
    inv = blank();
    inv.biz = keep.biz; inv.pay = { to: keep.pay.to, late: keep.pay.late, instr: keep.pay.instr, notes: "" }; inv.terms = keep.terms; inv.tax = keep.tax;
    inv.num = nextNumber(keep.num); inv.date = today(); inv.due = addDays(inv.date, termDays(inv.terms)); inv.dueAuto = true;
    isSample = false; render(); save();
    var n = inv_el.querySelector('[data-f="cust.name"]'); if (n) n.focus();
  }

  /* Printing: fit on one page when the browser can scale (the zoom property), and keep blocks whole otherwise. */
  function prepareOnePage() {
    var usable = 960, w = inv_el.clientWidth || 760, h = inv_el.scrollHeight;
    var expected = h * (710 / w);
    document.documentElement.style.setProperty("--inv-zoom", expected > usable ? (usable / expected).toFixed(3) : "1");
  }
  window.addEventListener("beforeprint", prepareOnePage);

  /* ---------- Saving in this browser, exports ---------- */
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify({ last: inv, t: Date.now() })); savedEl.textContent = "Saved on this device " + new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
      catch (e) { savedEl.textContent = "Could not save on this device (storage is full or blocked)."; }
    }, 400);
  }
  function safe(s) { return String(s || "invoice").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "invoice"; }
  function download(name, text, type) {
    try { var blob = new Blob([text], { type: type }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500); } catch (e) { }
  }
  function csvRows(rows) { return rows.map(function (r) { return r.map(function (c) { c = String(c == null ? "" : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\r\n"); }
  function downloadCsv() {
    var t = totals(), rows = [["Invoice", inv.num], ["Date", inv.date], ["Due", inv.due], ["Terms", inv.terms], ["From", inv.biz.name], ["Bill to", inv.cust.name], ["Customer PO", inv.po], [], ["Description", "Qty", "Rate", "Taxable", "Amount"]];
    inv.lines.forEach(function (l) { rows.push([l.d, l.q, num(l.r).toFixed(2), l.t ? "yes" : "no", (num(l.q) * num(l.r)).toFixed(2)]); });
    rows.push([], ["Subtotal", "", "", "", t.sub.toFixed(2)], ["Discount", "", "", "", t.disc.toFixed(2)], ["Taxable subtotal", "", "", "", t.taxBase.toFixed(2)], ["Sales tax " + num(inv.tax) + "%", "", "", "", t.tax.toFixed(2)], ["Freight", "", "", "", t.freight.toFixed(2)], ["Total", "", "", "", t.total.toFixed(2)], ["Paid", "", "", "", t.paid.toFixed(2)], ["Balance due", "", "", "", t.due.toFixed(2)]);
    if (inv.prog.on) rows.push([], ["Contract amount", num(inv.prog.contract).toFixed(2)], ["Invoice", inv.prog.n + " of " + inv.prog.m], ["Previously billed", num(inv.prog.prev).toFixed(2)], ["Billed to date", (num(inv.prog.prev) + t.total).toFixed(2)], ["Remaining", (num(inv.prog.contract) - num(inv.prog.prev) - t.total).toFixed(2)]);
    download("invoice-" + safe(inv.num) + ".csv", csvRows(rows), "text/csv");
  }

  render();
  savedEl.textContent = isSample ? "This is a sample. Tap anything and type over it; your details are kept on this device." : "Picked up where you left off.";
})();
