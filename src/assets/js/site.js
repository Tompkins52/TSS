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

  /* ---- Footer year ----------------------------------------------------------- */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
