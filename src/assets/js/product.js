/* Product pages: the piece of each product you can try on the page.
   No dependencies. Nothing is recorded or sent anywhere. */
(function () {
  "use strict";

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }
  function money(n) { return "$" + fmt(Math.round(n)); }
  function fill(range) { var min = Number(range.min || 0), max = Number(range.max || 100), v = Number(range.value); range.style.setProperty("--fill", ((v - min) / (max - min) * 100) + "%"); }
  function wireRange(range, fn) { fill(range); range.addEventListener("input", function () { fill(range); fn(); }); }

  /* ---------- Painless Project Management: the roll-up from the real rules ---------- */
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

  /* ---------- IntelliSafe: the binder and the platform ---------- */
  var cmp = document.getElementById("compare");
  if (cmp) {
    var cut = cmp.querySelector(".cut");
    var setCut = function () { cmp.style.setProperty("--cut", cut.value + "%"); };
    cut.addEventListener("input", setCut);
    setCut();
  }

  /* ---------- Part 107 Prep: a question from the bank ---------- */
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
    var qi = dayOfYear % QUESTIONS.length, answered = 0, correct = 0, goal = 5;
    var qCat = qd.querySelector("[data-q-cat]"), qText = qd.querySelector("[data-q-text]"), qOpts = qd.querySelector("[data-q-opts]"), qExp = qd.querySelector("[data-q-explain]"), qNext = qd.querySelector("[data-q-next]");
    var goalN = qd.querySelector("[data-goal-n]"), goalRing = qd.querySelector("[data-goal-ring]"), score = qd.querySelector("[data-score]");

    var showQ = function () {
      var Q = QUESTIONS[qi];
      qCat.textContent = Q.cat; qText.textContent = Q.q; qOpts.innerHTML = "";
      Q.a.forEach(function (t, i) { var b = el("button", "q-opt", esc(t)); b.type = "button"; b.addEventListener("click", function () { answer(i); }); qOpts.appendChild(b); });
      qExp.hidden = true; qNext.hidden = true;
    };
    var answer = function (i) {
      var Q = QUESTIONS[qi], btns = qOpts.querySelectorAll(".q-opt");
      btns.forEach(function (b, j) { b.disabled = true; if (j === Q.c) b.classList.add("right"); else if (j === i) b.classList.add("wrong"); });
      qExp.innerHTML = (i === Q.c ? "<strong>Right.</strong> " : "<strong>Not quite.</strong> ") + esc(Q.x) + '<span class="ref">' + esc(Q.ref) + "</span>";
      qExp.hidden = false; qNext.hidden = false;
      answered = Math.min(goal, answered + 1); if (i === Q.c) correct++;
      drawGoal();
    };
    var drawGoal = function () {
      var pct = answered / goal, r = 50, c = 2 * Math.PI * r;
      goalRing.innerHTML = '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#e3e5df" stroke-width="10"/>' +
        '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#2a7560" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - pct)) + '" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .5s ease"/>';
      goalN.textContent = answered + " of " + goal;
      score.textContent = answered ? correct + " right so far" : "Answer one to start the day";
      if (answered >= goal) score.textContent = "Daily goal done. " + correct + " of " + goal + " right.";
    };
    qNext.addEventListener("click", function () { qi = (qi + 1) % QUESTIONS.length; showQ(); });
    showQ(); drawGoal();
  }

  /* ---------- Witch Card: the answer screen, from the app's own card rules ---------- */
  // Six common cards and ten stores, copied from the app's card data (October 2026).
  // Rates are percent back, or points per dollar for Freedom Unlimited, counted at one cent
  // a point the way the app counts them when cash back is the priority. "not" lists the store
  // types a bonus leaves out; "prime" marks the rates that depend on Amazon Prime. A tie goes
  // to the card with more purchase protections, then the lower annual fee, as in the app.
  var WC_CARDS = [
    { id: "costco", name: "Costco Anywhere Visa", issuer: "Citi", network: "Visa", color: "#B52E31", fee: 0, base: 1, tie: 0,
      earn: [{ m: "costco-gas", r: 5, cap: 7000, why: "5% on Costco Gas" }, { c: "gas", r: 4, cap: 7000, not: ["superstore", "warehouse", "groceries"], why: "4% on gas" },
        { c: "dining", r: 3, why: "3% on dining" }, { m: "costco", r: 2, why: "2% on Costco" }] },
    { id: "bcp", name: "Amex Blue Cash Preferred", issuer: "American Express", network: "American Express", color: "#2B6CB0", fee: 95, base: 1, tie: 3,
      earn: [{ c: "groceries", r: 6, cap: 6000, not: ["superstore", "warehouse"], why: "6% on groceries" }, { c: "streaming", r: 6, why: "6% on streaming" },
        { c: "gas", r: 3, not: ["superstore", "warehouse"], why: "3% on gas" }] },
    { id: "prime", name: "Prime Visa (Amazon Visa)", issuer: "Chase", network: "Visa", color: "#0F3D6B", fee: 0, base: 1, tie: 1,
      earn: [{ m: "amazon", r: 5, prime: true, why: "5% on Amazon" }, { m: "whole-foods", r: 5, prime: true, why: "5% on Whole Foods" },
        { m: "amazon", r: 3, prime: false, why: "3% on Amazon" }, { m: "whole-foods", r: 3, prime: false, why: "3% on Whole Foods" },
        { c: "gas", r: 2, why: "2% on gas" }, { c: "dining", r: 2, why: "2% on dining" }] },
    { id: "active", name: "Wells Fargo Active Cash", issuer: "Wells Fargo", network: "Visa", color: "#8E1B1B", fee: 0, base: 2, tie: 5, earn: [] },
    { id: "fu", name: "Chase Freedom Unlimited", issuer: "Chase", network: "Visa", color: "#1D6BC4", fee: 0, base: 1.5, points: true, tie: 2,
      earn: [{ c: "dining", r: 3, why: "3x on dining" }, { c: "drugstore", r: 3, why: "3x on drugstore" }] },
    { id: "savor", name: "Capital One Savor", issuer: "Capital One", network: "Mastercard", color: "#602724", fee: 0, base: 1, tie: 4,
      earn: [{ c: "dining", r: 3, why: "3% on dining" }, { c: "streaming", r: 3, why: "3% on streaming" },
        { c: "groceries", r: 3, not: ["superstore", "warehouse"], why: "3% on groceries" }] }
  ];
  var WC_STORES = [
    { id: "shell", name: "Shell", cats: ["gas"] },
    { id: "costco-gas", name: "Costco Gas", cats: ["gas", "warehouse"], visaOnly: true },
    { id: "costco", name: "Costco", cats: ["warehouse"], visaOnly: true },
    { id: "whole-foods", name: "Whole Foods", cats: ["groceries"] },
    { id: "jewel-osco", name: "Jewel-Osco", cats: ["groceries"] },
    { id: "walmart", name: "Walmart", cats: ["superstore"] },
    { id: "chipotle", name: "Chipotle", cats: ["dining"] },
    { id: "amazon", name: "Amazon", cats: ["online"] },
    { id: "walgreens", name: "Walgreens", cats: ["drugstore"] },
    { id: "netflix", name: "Netflix", cats: ["streaming"] }
  ];

  // What one card earns on one purchase: cents (a point is a cent), the percent back, and why.
  function wcEvaluate(card, store, amount, prime) {
    var amt = amount > 0 ? amount : 1;
    var res = { card: card, accepted: true, cents: amt * card.base, why: card.base + (card.points ? "x" : "%") + " on everything", warn: "" };
    if (store.visaOnly && card.network !== "Visa") {
      res.accepted = false; res.why = "Not accepted here"; res.warn = store.name + " takes Visa only";
    } else {
      card.earn.forEach(function (r) {
        if (r.m ? r.m !== store.id : store.cats.indexOf(r.c) < 0) return;
        if (r.not && r.not.some(function (x) { return store.cats.indexOf(x) >= 0; })) return;
        if (r.prime !== undefined && r.prime !== prime) return;
        var over = r.cap && amt > r.cap;
        var cents = over ? r.cap * r.r + (amt - r.cap) * card.base : amt * r.r;
        if (cents > res.cents + 1e-9) { res.cents = cents; res.why = r.why; res.warn = over ? "Only " + money(r.cap) + " of the bonus cap is left this year" : ""; }
      });
    }
    res.pct = res.cents / amt;
    if (!(amount > 0)) res.cents = 0;
    return res;
  }
  // Every card in the wallet, best first: cards the store takes, then the most money, then the tie rule.
  function wcRank(cards, store, amount, prime) {
    return cards.map(function (c) { return wcEvaluate(c, store, amount, prime); }).sort(function (a, b) {
      if (a.accepted !== b.accepted) return a.accepted ? -1 : 1;
      var d = amount > 0 ? b.cents - a.cents : b.pct - a.pct;
      if (Math.abs(d) > 1e-9) return d;
      return a.card.tie - b.card.tie;
    });
  }

  var wc = document.getElementById("demo-wc");
  if (wc) {
    var wcOn = {}, wcStore = WC_STORES[0], wcLast = null, wcSeq = 0;
    var wcWallet = wc.querySelector("[data-wc-wallet]"), wcStores = wc.querySelector("[data-wc-stores]"), wcAmount = wc.querySelector("[data-wc-amount]");
    var wcPrime = wc.querySelector("[data-wc-prime]"), wcAnswer = wc.querySelector("[data-wc-answer]"), wcOthers = wc.querySelector("[data-wc-others]"), wcSay = wc.querySelector("[data-wc-say]");
    var wcHere = wc.querySelector("[data-wc-here]"), wcStoreName = wc.querySelector("[data-wc-store]"), wcStoreCat = wc.querySelector("[data-wc-cat]");
    var wcIc = wc.querySelector("[data-wc-ic]"), wcPocket = wc.querySelector("[data-wc-pocket]");
    // The names the app shows under the store, by the store's main category.
    var WC_CAT_NAMES = { gas: "Gas", warehouse: "Warehouse club", groceries: "Groceries", superstore: "Walmart or Target", dining: "Dining", online: "Online shopping", drugstore: "Drugstore", streaming: "Streaming" };
    // The app's icon and color for each category.
    var WC_TINTS = { gas: "#E0801B", warehouse: "#1C8DC9", groceries: "#1F9D55", superstore: "#D63E8C", dining: "#D9443A", online: "#7C5CD6", drugstore: "#139E8C", streaming: "#E0366A" };
    var WC_ICONS = {
      gas: "M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 7h6v5H6zM14 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-2.5-2.5",
      warehouse: "M4 20h16M4 17h16M6 14V8h5v6M13 14V5h5v9M6 20v-3M18 20v-3",
      groceries: "M3 4h2l2.4 11h11l2-7H7M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
      superstore: "M4 9l1-5h14l1 5M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0M5 11v9h14v-9M10 20v-5h4v5",
      dining: "M6 3v7a3 3 0 0 0 6 0V3M9 3v18M9 10v11M18 3c-2 2-3 5-3 8h3v10",
      online: "M3 8l9-4 9 4v9l-9 4-9-4zM3 8l9 4 9-4M12 12v9",
      drugstore: "M8.5 3.5l12 12a4.24 4.24 0 0 1-6 6l-12-12a4.24 4.24 0 0 1 6-6zM8.5 15.5l6-6",
      streaming: "M4 5h16v12H4zM9 20h6M10 8l5 3-5 3z",
      check: "M5 12l5 5 9-10"
    };
    var wcIcon = function (name, width) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="' + (width || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" d="' + WC_ICONS[name] + '"/></svg>';
    };

    var cents = function (c) { return "$" + (Math.round(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var rateText = function (r) { return (Math.round(r.pct * 100) / 100) + (r.card.points ? "x" : "%"); };
    var shade = function (hex, amt) {
      var n = parseInt(hex.slice(1), 16), out = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) {
        v = Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)); return Math.max(0, Math.min(255, v));
      });
      return "#" + out.map(function (v) { return (v < 16 ? "0" : "") + v.toString(16); }).join("");
    };
    // The same drawn card the app shows: the card's color, a chip, the issuer, and the network. No issuer artwork.
    var wcFace = function (card) { return { c1: shade(card.color, 0.22), c2: card.color, c3: shade(card.color, -0.3) }; };
    var wcArt = function (card, width) {
      var id = "wca" + (++wcSeq), mid = width >= 60, f = wcFace(card), font = "Archivo WC, Archivo, Helvetica, Arial, sans-serif";
      var net = { "American Express": "AMEX", "Mastercard": "MASTERCARD", "Visa": "VISA" }[card.network] || card.network.toUpperCase();
      var svg = '<svg viewBox="0 0 320 200" width="' + width + '" height="' + Math.round(width * 200 / 320) + '" aria-hidden="true" focusable="false">' +
        '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + f.c1 + '"/><stop offset=".55" stop-color="' + f.c2 + '"/><stop offset="1" stop-color="' + f.c3 + '"/></linearGradient>' +
        '<linearGradient id="' + id + 's" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="' + id + 'c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2D07A"/><stop offset="1" stop-color="#B8902F"/></linearGradient>' +
        '<clipPath id="' + id + 'k"><rect width="320" height="200" rx="18"/></clipPath></defs>' +
        '<g clip-path="url(#' + id + 'k)"><rect width="320" height="200" fill="url(#' + id + 'g)"/><path d="M-40 0 L140 0 L60 200 L-120 200 Z" fill="url(#' + id + 's)"/></g>' +
        '<rect x="28" y="62" width="52" height="38" rx="7" fill="url(#' + id + 'c)"/><path d="M28 81 h52 M54 62 v38" stroke="#B8902F" stroke-opacity=".7" stroke-width="2" fill="none"/>' +
        '<g fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="3" stroke-linecap="round" transform="translate(92,81)"><path d="M0-9a13 13 0 0 1 0 18"/><path d="M8-15a21 21 0 0 1 0 30"/><path d="M16-21a29 29 0 0 1 0 42"/></g>' +
        (mid ? '<text x="28" y="40" fill="#fff" fill-opacity=".82" font-family="' + font + '" font-size="15" font-weight="700" font-stretch="112%" letter-spacing="2">' + esc(card.issuer.toUpperCase()) + "</text>" : "") +
        '<text x="292" y="178" text-anchor="end" fill="#fff" fill-opacity=".9" font-family="' + font + '" font-size="' + (mid ? 16 : 26) + '" font-weight="850" font-style="italic" font-stretch="112%" letter-spacing="1">' + net + "</text></svg>";
      return el("span", "wc-art", svg);
    };
    // The witch hat that lands on the card to use, the same shape as in the app.
    var wcHat = function () {
      var id = "wch" + (++wcSeq);
      return '<svg viewBox="38 -44 102 96" aria-hidden="true" focusable="false">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A2F6E"/><stop offset="1" stop-color="#170D20"/></linearGradient></defs>' +
        '<path d="M64 39 Q 78 4 92 -22 Q 104 -42 126 -30 Q 129 -28 124 -26 Q 110 -28 104 -14 Q 98 8 114 39 Z" fill="url(#' + id + ')" stroke="#7A5AA8" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M67 32 Q 89 35.5 110.5 32 L 107.4 24 Q 89 27.5 70.2 24 Z" fill="#F6A623"/>' +
        '<rect x="84" y="24.6" width="10" height="8.6" rx="1.6" fill="none" stroke="#1E1328" stroke-width="2"/>' +
        '<ellipse cx="89" cy="40" rx="46" ry="8" fill="url(#' + id + ')" stroke="#7A5AA8" stroke-width="1.6"/></svg>';
    };

    var wcRender = function () {
      var amount = Math.min(parseFloat(String(wcAmount.value).replace(/[^0-9.]/g, "")) || 0, 1000000);
      var cards = WC_CARDS.filter(function (c) { return wcOn[c.id]; });
      wcAnswer.innerHTML = ""; wcOthers.innerHTML = ""; wcPocket.hidden = true;
      wcStoreName.textContent = wcStore.name; wcStoreCat.textContent = WC_CAT_NAMES[wcStore.cats[0]] || "";
      wcIc.innerHTML = wcIcon(wcStore.cats[0]); wcIc.style.setProperty("--tint", WC_TINTS[wcStore.cats[0]] || "#5F6B7A");
      var here = "You're at " + wcStore.name + ". ";
      if (!cards.length) { wcAnswer.appendChild(el("div", "wc-none", "<b>No cards in this wallet.</b>Turn one on to get an answer.")); wcSay.textContent = here + "No cards are turned on."; wcLast = null; return; }
      var list = wcRank(cards, wcStore, amount, wcPrime.checked), best = list[0];
      if (!best.accepted) {
        wcAnswer.appendChild(el("div", "wc-none", "<b>None of these cards work here.</b>" + esc(best.warn) + "."));
        wcSay.textContent = here + best.warn + ". None of the cards turned on will work here.";
        wcLast = null;
      } else {
        // As in the app: the card drawn big, its name, then "4%" with "on gas" under it and the dollars beside it.
        var changed = wcLast !== best.card.id; wcLast = best.card.id;
        var win = el("div", "wc-winner" + (changed ? " reveal" : ""));
        win.appendChild(el("div", "wc-wlabel", wcIcon("check", 2.5) + "Use this card"));
        var big = el("div", "wc-big"); big.appendChild(wcArt(best.card, 250)); big.appendChild(el("span", "wc-hat", wcHat())); win.appendChild(big);
        win.appendChild(el("div", "wc-name", esc(best.card.name)));
        var tail = best.why.replace(/^\s*[\d.]+\s*(%|x)\s*/i, "") + (best.card.points ? ", points worth " + (Math.round(best.pct * 10) / 10) + "%" : "");
        var row = el("div", "wc-row");
        row.appendChild(el("div", "wc-rate", rateText(best) + "<small>" + esc(tail) + "</small>"));
        if (amount > 0) row.appendChild(el("div", "wc-value", cents(best.cents) + "<small>" + (best.card.points ? "in value" : "back") + "</small>"));
        win.appendChild(row);
        if (best.warn) win.appendChild(el("div", "wc-flag", esc(best.warn)));
        var next = list[1], edgeText = "";
        if (amount > 0 && next && next.accepted) {
          var edge = best.cents - next.cents;
          if (edge >= 1) edgeText = cents(edge) + " more than your next best card";
          else if (edge > -1) edgeText = "Ties with " + next.card.name;
          if (edgeText) win.appendChild(el("div", "wc-edge", esc(edgeText)));
        }
        wcAnswer.appendChild(win);
        wcSay.textContent = here + "Use " + best.card.name + ": " + best.why + (amount > 0 ? ", " + cents(best.cents) + (best.card.points ? " in points" : " back") : "") + "." + (edgeText ? " " + edgeText + "." : "");
      }
      (best.accepted ? list.slice(1) : list).forEach(function (r) {
        var li = el("li", r.accepted ? "" : "off"), f = wcFace(r.card);
        li.style.setProperty("--c1", f.c1); li.style.setProperty("--c2", f.c2); li.style.setProperty("--c3", f.c3);
        li.innerHTML = '<span class="n">' + esc(r.card.name) + "<small>" + esc(r.why) + "</small>" +
          (r.warn ? '<small class="' + (r.accepted ? "warn" : "bad") + '">' + esc(r.warn) + "</small>" : "") + "</span>" +
          '<span class="r">' + (r.accepted ? rateText(r) + "<small>" + (amount > 0 ? cents(r.cents) : r.card.points ? (Math.round(r.pct * 10) / 10) + "% value" : "") + "</small>" : "×") + "</span>";
        wcOthers.appendChild(li);
        wcPocket.hidden = false;
      });
    };

    WC_CARDS.forEach(function (c) {
      wcOn[c.id] = true;
      var lab = el("label", "wc-card"), box = el("input");
      box.type = "checkbox"; box.checked = true;
      box.addEventListener("change", function () { wcOn[c.id] = box.checked; lab.classList.toggle("off", !box.checked); wcRender(); });
      lab.appendChild(box); lab.appendChild(wcArt(c, 46)); lab.appendChild(el("span", null, esc(c.name)));
      wcWallet.appendChild(lab);
    });
    WC_STORES.forEach(function (s) {
      var b = el("button", "wc-chip", esc(s.name));
      b.type = "button"; b.setAttribute("aria-pressed", s === wcStore ? "true" : "false");
      b.addEventListener("click", function () {
        if (wcStore === s) return;
        wcStore = s;
        Array.prototype.forEach.call(wcStores.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        wcHere.classList.remove("found"); void wcHere.offsetWidth; wcHere.classList.add("found");
        wcRender();
      });
      wcStores.appendChild(b);
    });
    wcAmount.addEventListener("input", wcRender);
    wcAmount.addEventListener("focus", function () { wcAmount.select(); });
    wcPrime.addEventListener("change", wcRender);
    wcRender();
  }
})();
