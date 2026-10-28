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
})();
