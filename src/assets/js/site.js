/* Tompkins Software Systems site script. No dependencies, no tracking. */
(function () {
  "use strict";

  /* ---- Configuration -------------------------------------------------------
     Set these when the mailing list and contact form providers are chosen.
     Leave them empty and the forms explain that the channel is not open yet.
     Both expect a plain HTML form POST (Buttondown, Mailchimp, Formspree and
     similar services all accept one). */
  var NEWSLETTER_ENDPOINT = "";
  var CONTACT_ENDPOINT = "";

  /* ---- Mobile navigation --------------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.querySelector(".label").textContent = open ? "Close" : "Menu";
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.querySelector(".label").textContent = "Menu";
        toggle.focus();
      }
    });
  }

  /* ---- Forms --------------------------------------------------------------- */
  function wireForm(form, endpoint, pendingMessage, okMessage) {
    if (!form) return;
    var status = form.querySelector(".form-status");
    var button = form.querySelector("button[type=submit]");

    function say(text) {
      if (!status) return;
      status.textContent = text;
      status.hidden = false;
    }

    if (!endpoint) {
      // Channel not open yet: keep the form visible so the page reads correctly,
      // but do not pretend to send anything.
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        say(pendingMessage);
      });
      return;
    }

    form.setAttribute("action", endpoint);
    form.setAttribute("method", "post");
    form.addEventListener("submit", function (e) {
      // Honeypot: real people never fill this field.
      var hp = form.querySelector(".hp input");
      if (hp && hp.value) { e.preventDefault(); return; }
      if (!window.fetch) return; // plain POST fallback
      e.preventDefault();
      if (button) button.disabled = true;
      fetch(endpoint, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) {
          if (r.ok) { form.reset(); say(okMessage); }
          else { say("Something went wrong on our side. Please try again in a few minutes."); }
        })
        .catch(function () { say("Could not reach the server. Please check your connection and try again."); })
        .then(function () { if (button) button.disabled = false; });
    });
  }

  wireForm(
    document.querySelector("form[data-form=newsletter]"),
    NEWSLETTER_ENDPOINT,
    "The mailing list is not open yet. The first issue goes out after the company launch; check back here or on the Updates page.",
    "Thanks. Check your inbox for a confirmation email."
  );
  wireForm(
    document.querySelector("form[data-form=contact]"),
    CONTACT_ENDPOINT,
    "This form is not connected yet. Please email your message to admin@tompkinssoftwaresystems.com; what you typed is still here to copy.",
    "Thanks. We read every message and reply within three business days."
  );

  /* ---- Contact form prefilled from the sample apps on the home page -------- */
  var contactForm = document.querySelector("form[data-form=contact]");
  if (contactForm && window.URLSearchParams) {
    var params = new URLSearchParams(window.location.search);
    var draft = params.get("draft"), topic = params.get("topic");
    var msg = contactForm.querySelector("textarea[name=message]");
    var sel = contactForm.querySelector("select[name=topic]");
    if (draft && msg && !msg.value) msg.value = draft;
    if (topic && sel) {
      var want = topic === "idea" ? "An idea I want built" : "Custom build";
      Array.prototype.forEach.call(sel.options, function (o) { if (o.text.indexOf(want) === 0) sel.value = o.value || o.text; });
    }
    if (draft && msg) msg.style.minHeight = "16rem";
  }

  /* ---- Motion: things fade in as they arrive and out as they leave; the map drifts; a reading line ---- */
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    var REVEAL = ".card, .feat-grid > li, .timeline > li, .values > li, .sectors > li, .screens-grid figure, .checklist > li, .sidebar-note, .facts dl > div, .section-head, .demo-copy, .demo .panel, .phero-shots, .grp, .how-list > li, .prose > h2, .callout, .spec";
    var items = document.querySelectorAll(REVEAL), counts = [];
    Array.prototype.forEach.call(items, function (el) {
      if (el.closest("#try")) return;
      el.classList.add("rv");
      var parent = el.parentNode, entry = null;
      for (var i = 0; i < counts.length; i++) if (counts[i].p === parent) entry = counts[i];
      if (!entry) { entry = { p: parent, n: 0 }; counts.push(entry); }
      el.style.setProperty("--i", entry.n % 6); entry.n++;
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.target.classList.toggle("in", en.isIntersecting); });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      Array.prototype.forEach.call(document.querySelectorAll(".rv"), function (el) { io.observe(el); });
    } else { Array.prototype.forEach.call(document.querySelectorAll(".rv"), function (el) { el.classList.add("in"); }); }

    var bands = document.querySelectorAll(".band-dark"), header = document.querySelector(".site-header"), line = null;
    if (header) { line = document.createElement("div"); line.className = "read-line"; header.appendChild(line); }
    var ticking = false;
    var onScroll = function () {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      Array.prototype.forEach.call(bands, function (b) { var r = b.getBoundingClientRect(); if (r.bottom > 0 && r.top < window.innerHeight) b.style.setProperty("--py", Math.round((r.top - window.innerHeight / 2) * -0.12) + "px"); });
      if (line) { var h = document.documentElement.scrollHeight - window.innerHeight; line.style.width = (h > 0 ? Math.min(100, y / h * 100) : 0) + "%"; }
    };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  /* ---- Footer year ----------------------------------------------------------- */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
