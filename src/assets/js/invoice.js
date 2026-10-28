/* TSS Invoice Creator. Everything runs in the browser. The invoice in progress and the business
   details are kept in this browser's storage so a refresh or a new visit picks up where you left off.
   Nothing is sent anywhere. */
(function () {
  "use strict";
  var KEY = "tss-invoice-creator";
  var form = document.querySelector("[data-inv]"); if (!form) return;
  var preview = document.querySelector("[data-preview]"), linesEl = form.querySelector("[data-lines]"), savedEl = form.querySelector("[data-saved]");
  var progBox = form.querySelector("[data-prog]"), logoIn = form.querySelector("[data-logo]"), logoClear = form.querySelector("[data-logo-clear]");

  function sfx(n) { if (window.TSSound) window.TSSound.play(n); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { n = Number(n) || 0; return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function today() { return iso(new Date()); }
  function addDays(isoDate, n) { var p = (isoDate || today()).split("-").map(Number); var d = new Date(p[0], p[1] - 1, p[2]); d.setDate(d.getDate() + n); return iso(d); }
  function longDate(isoDate) { if (!isoDate) return ""; var p = isoDate.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
  function termDays(t) { var m = /Net (\d+)/.exec(t || ""); return m ? Number(m[1]) : 0; }
  function nextNumber(n) { var m = /^(.*?)(\d+)(\D*)$/.exec(n || ""); if (!m) return (n || "INV") + "-2"; var w = m[2].length; return m[1] + String(Number(m[2]) + 1).padStart(w, "0") + m[3]; }
  function get(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function set(o, path, v) { var ks = path.split("."), last = ks.pop(), t = ks.reduce(function (a, k) { if (a[k] == null) a[k] = {}; return a[k]; }, o); t[last] = v; }

  function blank() {
    return { biz: { name: "", addr: "", phone: "", email: "", web: "", taxid: "", accent: "#12352b", logo: "" },
      num: "INV-1001", date: today(), terms: "Net 30", due: addDays(today(), 30), dueAuto: true, po: "", ref: "",
      cust: { name: "", attn: "", addr: "", email: "" }, ship: "", desc: "", from: "", to: "",
      lines: [{ d: "", q: 1, u: "", r: "", t: true }], disc: "", tax: "", freight: "", paid: "",
      prog: { on: false, contract: "", n: 1, m: 3, prev: "" }, pay: { to: "", late: "", instr: "", notes: "" } };
  }
  function sample() {
    var s = blank();
    s.biz = { name: "Hart Electric LLC", addr: "300 Main St, Suite 2\nPrairie City, IL", phone: "(555) 010-0142", email: "office@hartelectric.example", web: "hartelectric.example", taxid: "", accent: "#12352b", logo: "" };
    s.num = "INV-1043"; s.po = "PO 4471"; s.ref = "Quote 1042";
    s.cust = { name: "Lakeside Dental", attn: "Accounts payable", addr: "42 Lakeview Dr\nPrairie City, IL", email: "ap@lakesidedental.example" };
    s.ship = "Same as billing"; s.desc = "Panel upgrade and six new 20 A circuits for the second-floor exam rooms. Inspected and passed."; s.from = addDays(today(), -16); s.to = addDays(today(), -3);
    s.lines = [{ d: "200 A panel and breakers (parts)", q: 1, u: "", r: 1180, t: true }, { d: "Labor, panel replacement (hours)", q: 8, u: "", r: 95, t: false }, { d: "20 A circuit materials", q: 6, u: "", r: 85, t: true }, { d: "Labor, circuits (hours)", q: 12, u: "", r: 95, t: false }, { d: "Permit and inspection", q: 1, u: "", r: 180, t: false }];
    s.tax = 7.25; s.freight = 48.5; s.paid = 1500;
    s.prog = { on: true, contract: 9600, n: 2, m: 3, prev: 3200 };
    s.pay = { to: "Hart Electric LLC", late: "1.5% per month after the due date", instr: "Mail checks to the address above, or ask for our ACH letter. Card payments add 3%.", notes: "Thank you for the work. The panel carries a two-year workmanship warranty; call us before you call anyone else." };
    return s;
  }

  var inv, store = null;
  try { store = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { store = null; }
  inv = store && store.last ? merge(blank(), store.last) : sample();
  var isSample = !(store && store.last);

  function merge(base, over) {
    Object.keys(over || {}).forEach(function (k) {
      if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k]) && base[k] && typeof base[k] === "object") base[k] = merge(base[k], over[k]);
      else base[k] = over[k];
    });
    return base;
  }

  /* ---------- Totals ---------- */
  function totals() {
    var sub = 0, taxable = 0;
    inv.lines.forEach(function (l) { var a = num(l.q) * num(l.r); sub += a; if (l.t) taxable += a; });
    var disc = Math.min(sub, num(inv.disc)), taxBase = sub ? Math.max(0, taxable - disc * (taxable / sub)) : 0;
    var tax = taxBase * num(inv.tax) / 100, freight = num(inv.freight), paid = num(inv.paid);
    var total = sub - disc + tax + freight;
    return { sub: sub, disc: disc, taxable: taxable, taxBase: taxBase, tax: tax, freight: freight, total: total, paid: paid, due: total - paid };
  }

  /* ---------- The form ---------- */
  function fill() {
    Array.prototype.forEach.call(form.querySelectorAll("[name]"), function (el) {
      if (el.name === "logo") return;
      var v = get(inv, el.name);
      if (el.type === "checkbox") el.checked = !!v; else el.value = v == null ? "" : v;
    });
    progBox.hidden = !inv.prog.on;
    logoClear.hidden = !inv.biz.logo;
    renderLines();
  }
  function renderLines() {
    var html = '<div class="lines-head"><span>Line item</span><span>Qty</span><span>Rate</span><span>Amount</span><span></span></div>';
    inv.lines.forEach(function (l, i) {
      html += '<div class="line" data-i="' + i + '">' +
        '<input type="text" value="' + esc(l.d) + '" placeholder="What was done or delivered (8 hr labor, 6 outlets)" data-k="d" aria-label="Line item">' +
        '<input class="num" type="number" min="0" step="any" value="' + esc(l.q) + '" data-k="q" aria-label="Quantity">' +
        '<input class="num" type="number" min="0" step="0.01" value="' + esc(l.r) + '" placeholder="0.00" data-k="r" aria-label="Rate">' +
        '<span class="amt" data-amt>' + money(num(l.q) * num(l.r)) + "</span>" +
        '<span class="tx"><label><input type="checkbox" data-k="t"' + (l.t ? " checked" : "") + '> tax</label><button type="button" class="rm" data-rm aria-label="Remove line">×</button></span></div>';
    });
    linesEl.innerHTML = html;
  }

  form.addEventListener("input", function (e) {
    var el = e.target;
    if (el.closest(".line")) {
      var row = el.closest(".line"), i = Number(row.getAttribute("data-i")), k = el.getAttribute("data-k"), l = inv.lines[i];
      if (k === "t") l.t = el.checked; else if (k === "q" || k === "r") l[k] = el.value === "" ? "" : num(el.value); else l[k] = el.value;
      row.querySelector("[data-amt]").textContent = money(num(l.q) * num(l.r));
    } else if (el.name && el.name !== "logo") {
      if (el.type === "checkbox") set(inv, el.name, el.checked); else set(inv, el.name, el.value);
      if (el.name === "due") inv.dueAuto = false;
      if ((el.name === "date" || el.name === "terms") && inv.dueAuto) { inv.due = addDays(inv.date, termDays(inv.terms)); form.querySelector('[name="due"]').value = inv.due; }
      if (el.name === "prog.on") { progBox.hidden = !inv.prog.on; sfx("tick"); }
    }
    render(); save();
  });
  form.addEventListener("click", function (e) {
    var b = e.target.closest("button, label.file-btn"); if (!b) return;
    if (b.hasAttribute("data-rm")) { var i = Number(b.closest(".line").getAttribute("data-i")); inv.lines.splice(i, 1); if (!inv.lines.length) inv.lines.push({ d: "", q: 1, u: "", r: "", t: true }); renderLines(); render(); save(); sfx("tick"); return; }
    if (b.hasAttribute("data-addline")) { inv.lines.push({ d: "", q: 1, u: "", r: "", t: true }); renderLines(); var last = linesEl.querySelector(".line:last-of-type input"); if (last) last.focus(); render(); save(); sfx("pop"); return; }
    if (b.hasAttribute("data-print")) { sfx("flip"); setTimeout(function () { window.print(); }, 120); return; }
    if (b.hasAttribute("data-new")) { newInvoice(); return; }
    if (b.hasAttribute("data-csv")) { downloadCsv(); return; }
    if (b.hasAttribute("data-save")) { download("invoice-" + safe(inv.num) + ".json", JSON.stringify(inv, null, 2), "application/json"); sfx("chime"); return; }
    if (b.hasAttribute("data-sample")) { inv = sample(); isSample = true; fill(); render(); save(); sfx("flip"); return; }
    if (b.hasAttribute("data-clear")) { if (!window.confirm("Forget the saved invoice, your business details, and the logo on this device?")) return; try { localStorage.removeItem(KEY); } catch (err) { } inv = blank(); fill(); render(); savedEl.textContent = "Nothing is saved on this device."; sfx("whoosh"); return; }
    if (b.hasAttribute("data-logo-clear")) { inv.biz.logo = ""; logoIn.value = ""; logoClear.hidden = true; render(); save(); return; }
  });
  form.querySelector("[data-open]").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () { try { var data = JSON.parse(r.result); if (!data || !data.lines) throw new Error("not an invoice"); inv = merge(blank(), data); isSample = false; fill(); render(); save(); sfx("chime"); } catch (err) { savedEl.textContent = "That file is not an invoice from this tool."; sfx("error"); } };
    r.readAsText(f); e.target.value = "";
  });
  logoIn.addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 400 / img.width, 160 / img.height), c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        inv.biz.logo = c.toDataURL("image/png"); logoClear.hidden = false; render(); save(); sfx("pop");
      };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  });
  function newInvoice() {
    var keep = inv;
    inv = blank();
    inv.biz = keep.biz; inv.pay = { to: keep.pay.to, late: keep.pay.late, instr: keep.pay.instr, notes: keep.pay.notes }; inv.terms = keep.terms; inv.tax = keep.tax;
    inv.num = nextNumber(keep.num); inv.date = today(); inv.due = addDays(inv.date, termDays(inv.terms)); inv.dueAuto = true;
    isSample = false; fill(); render(); save(); sfx("flip");
    var n = form.querySelector('[name="cust.name"]'); if (n) n.focus();
  }

  /* ---------- Saving in this browser ---------- */
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
    var t = totals(), rows = [["Invoice", inv.num], ["Date", inv.date], ["Due", inv.due], ["Terms", inv.terms], ["From", inv.biz.name], ["Bill to", inv.cust.name], ["Customer PO", inv.po], [], ["Description", "Qty", "Unit", "Rate", "Taxable", "Amount"]];
    inv.lines.forEach(function (l) { rows.push([l.d, l.q, l.u, num(l.r).toFixed(2), l.t ? "yes" : "no", (num(l.q) * num(l.r)).toFixed(2)]); });
    rows.push([], ["Subtotal", "", "", "", "", t.sub.toFixed(2)], ["Discount", "", "", "", "", t.disc.toFixed(2)], ["Taxable subtotal", "", "", "", "", t.taxBase.toFixed(2)], ["Sales tax " + num(inv.tax) + "%", "", "", "", "", t.tax.toFixed(2)], ["Freight", "", "", "", "", t.freight.toFixed(2)], ["Total", "", "", "", "", t.total.toFixed(2)], ["Paid", "", "", "", "", t.paid.toFixed(2)], ["Balance due", "", "", "", "", t.due.toFixed(2)]);
    if (inv.prog.on) rows.push([], ["Contract amount", num(inv.prog.contract).toFixed(2)], ["Invoice", inv.prog.n + " of " + inv.prog.m], ["Previously billed", num(inv.prog.prev).toFixed(2)], ["Billed to date", (num(inv.prog.prev) + t.total).toFixed(2)], ["Remaining", (num(inv.prog.contract) - num(inv.prog.prev) - t.total).toFixed(2)]);
    download("invoice-" + safe(inv.num) + ".csv", csvRows(rows), "text/csv"); sfx("chime");
  }

  /* ---------- The invoice itself ---------- */
  function render() {
    var t = totals(), b = inv.biz, c = inv.cust;
    preview.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(b.accent) ? b.accent : "#12352b");
    var contact = [b.phone, b.email, b.web].filter(Boolean).map(esc).join("<br>");
    var meta = [["Invoice", esc(inv.num) || "&ndash;", "big"], ["Date", longDate(inv.date)], ["Due", longDate(inv.due) || (inv.terms === "Due on receipt" ? "On receipt" : "")], ["Terms", esc(inv.terms)]];
    if (inv.po) meta.push(["Customer PO", esc(inv.po)]); if (inv.ref) meta.push(["Reference", esc(inv.ref)]);
    if (inv.prog.on) meta.push(["This is invoice", esc(inv.prog.n) + " of " + esc(inv.prog.m)]);
    var lines = inv.lines.filter(function (l) { return l.d || num(l.r); });
    var period = inv.from || inv.to ? (inv.from ? longDate(inv.from) : "") + (inv.from && inv.to ? " to " : "") + (inv.to ? longDate(inv.to) : "") : "";
    var html = '<header class="inv-top"><div class="inv-biz">' + (b.logo ? '<img src="' + b.logo + '" alt="">' : "") + '<span class="bn">' + (esc(b.name) || "Your business name") + "</span>" + (b.addr ? '<span class="bc pre">' + esc(b.addr) + "</span>" : "") + (contact ? '<span class="bc">' + contact + "</span>" : "") + (b.taxid ? '<span class="bc">Tax ID ' + esc(b.taxid) + "</span>" : "") + "</div>" +
      '<div class="inv-title"><h2>Invoice</h2><dl class="inv-meta">' + meta.map(function (m) { return '<div class="' + (m[2] || "") + '"><dt>' + m[0] + "</dt><dd>" + (m[1] || "&ndash;") + "</dd></div>"; }).join("") + "</dl></div></header>";
    html += '<section class="inv-parties"><div><h3>Bill to</h3><div class="bn">' + (esc(c.name) || "Customer") + "</div>" + (c.attn ? "<div>Attn: " + esc(c.attn) + "</div>" : "") + (c.addr ? '<div class="pre">' + esc(c.addr) + "</div>" : "") + (c.email ? "<div>" + esc(c.email) + "</div>" : "") + "</div>" +
      (inv.ship ? '<div><h3>Ship to / job site</h3><div class="pre">' + esc(inv.ship) + "</div></div>" : "") +
      (inv.desc || period ? '<div><h3>Services</h3>' + (period ? "<div>" + period + "</div>" : "") + (inv.desc ? '<div class="pre">' + esc(inv.desc) + "</div>" : "") + "</div>" : "") + "</section>";
    var units = lines.some(function (l) { return l.u; });
    html += '<table class="inv-lines"><thead><tr><th>Description</th><th class="num">Qty</th>' + (units ? "<th>Unit</th>" : "") + '<th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>' +
      (lines.length ? lines.map(function (l) { return "<tr><td>" + esc(l.d) + (l.t && num(inv.tax) ? '<span class="t">T</span>' : "") + '</td><td class="num">' + esc(l.q) + "</td>" + (units ? "<td>" + esc(l.u) + "</td>" : "") + '<td class="num">' + money(l.r) + '</td><td class="num">' + money(num(l.q) * num(l.r)) + "</td></tr>"; }).join("") : '<tr class="empty"><td colspan="5">Add a line item on the left.</td></tr>') + "</tbody></table>";
    var tot = '<div class="inv-totals"><div><span>Subtotal</span><span>' + money(t.sub) + "</span></div>" + (t.disc ? "<div><span>Discount</span><span>-" + money(t.disc) + "</span></div>" : "") +
      (num(inv.tax) ? "<div><span>Taxable subtotal</span><span>" + money(t.taxBase) + "</span></div><div><span>Sales tax (" + num(inv.tax) + "%)</span><span>" + money(t.tax) + "</span></div>" : "") +
      (t.freight ? "<div><span>Freight</span><span>" + money(t.freight) + "</span></div>" : "") + '<div class="total"><span>Total</span><span>' + money(t.total) + "</span></div>" +
      (t.paid ? "<div><span>Deposit received</span><span>-" + money(t.paid) + "</span></div>" : "") + '<div class="due"><span>Balance due</span><span>' + money(t.due) + "</span></div></div>";
    var prog = "";
    if (inv.prog.on) { var contract = num(inv.prog.contract), billed = num(inv.prog.prev) + t.total, pct = contract ? Math.max(0, Math.min(100, billed / contract * 100)) : 0; prog = '<div class="inv-prog"><h3>Progress on ' + (inv.po ? esc(inv.po) : "the contract") + "</h3><div><span>Contract amount</span><span>" + money(contract) + "</span></div><div><span>Previously billed</span><span>" + money(inv.prog.prev) + "</span></div><div><span>This invoice (" + esc(inv.prog.n) + " of " + esc(inv.prog.m) + ")</span><span>" + money(t.total) + "</span></div><div><span>Billed to date</span><span>" + money(billed) + "</span></div><div><span>Remaining</span><span>" + money(contract - billed) + '</span></div><div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div></div>'; }
    html += '<div class="inv-sum">' + (prog || "<div></div>") + tot + "</div>";
    var pay = inv.pay;
    if (pay.to || pay.instr || pay.late || pay.notes) html += '<section class="inv-pay">' + (pay.to || pay.instr || pay.late ? "<div><h3>Payment</h3>" + (pay.to ? "<div>Make checks payable to <b>" + esc(pay.to) + "</b></div>" : "") + (pay.instr ? '<div class="pre">' + esc(pay.instr) + "</div>" : "") + (pay.late ? "<div>" + esc(pay.late) + "</div>" : "") + "</div>" : "") + (pay.notes ? '<div><h3>Notes</h3><div class="pre">' + esc(pay.notes) + "</div></div>" : "") + "</section>";
    html += '<footer class="inv-foot"><span>' + (b.name ? "Questions? " + esc([b.phone, b.email].filter(Boolean).join(" or ")) : "") + "</span><span>Made with <b>TSS Invoice Creator</b>, free at tompkinssoftwaresystems.com</span></footer>";
    preview.innerHTML = html;
  }

  fill(); render();
  savedEl.textContent = isSample ? "This is a sample. Type over it; your details are kept on this device." : "Picked up where you left off.";
})();
