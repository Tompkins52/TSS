/* Small sounds for the sample apps, made with the Web Audio API. No audio files.
   On by default; the speaker button turns them off, and that choice is kept in this browser. */
(function () {
  "use strict";
  var KEY = "tss-sound", ctx = null, on = true, master = null, stored = null;
  try { stored = window.localStorage ? localStorage.getItem(KEY) : null; } catch (e) { stored = null; }
  on = stored === null ? true : stored === "on";

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    return ctx;
  }
  function env(node, t0, attack, dur, peak) {
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g); g.connect(master); return g;
  }
  function tone(freq, dur, type, peak, slideTo, delay) {
    var t0 = ctx.currentTime + (delay || 0), o = ctx.createOscillator(); o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    env(o, t0, 0.006, dur, peak); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, kind, from, to, peak, delay, q) {
    var t0 = ctx.currentTime + (delay || 0), n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = kind || "bandpass"; f.Q.value = q || 0.8; f.frequency.setValueAtTime(from, t0); if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    src.connect(f); env(f, t0, 0.012, dur, peak); src.start(t0); src.stop(t0 + dur + 0.05);
  }

  var SOUNDS = {
    /* a view changes */
    tick: function () { tone(1250, 0.045, "triangle", 0.035, 900); },
    /* a new sample app: a page turning */
    flip: function () { noise(0.12, "bandpass", 1900, 420, 0.08, 0, 0.6); tone(170, 0.07, "sine", 0.025, 110, 0.04); },
    /* something added */
    pop: function () { tone(330, 0.07, "sine", 0.055, 720); },
    /* approved, paid, closed */
    stamp: function () { tone(140, 0.16, "sine", 0.12, 55); noise(0.06, "lowpass", 420, 120, 0.06); },
    /* an export, a certificate, a confirmation */
    chime: function () { tone(1046.5, 0.24, "sine", 0.05); tone(1318.5, 0.3, "sine", 0.045, null, 0.1); },
    /* paint hitting the screen, then the droplets */
    splat: function () {
      noise(0.2, "bandpass", 1400, 150, 0.1, 0, 0.5); tone(420, 0.16, "sine", 0.05, 110);
      [0.09, 0.14, 0.2, 0.27].forEach(function (d, i) { tone(1700 + i * 350 + Math.random() * 200, 0.03, "sine", 0.025, null, d); });
    },
    /* reset, desktop to phone */
    whoosh: function () { noise(0.22, "bandpass", 320, 2300, 0.05); },
    /* a conflict or a missing field */
    error: function () { tone(230, 0.06, "triangle", 0.035); tone(205, 0.08, "triangle", 0.035, null, 0.09); },
    /* the blueprint being drawn */
    draw: function () { noise(0.9, "highpass", 3200, 5200, 0.012); }
  };

  function play(name) {
    if (!on || !SOUNDS[name]) return;
    try { if (!ensure()) return; SOUNDS[name](); } catch (e) { /* a browser without audio is fine */ }
  }
  function set(value, quiet) {
    on = !!value;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* storage may be unavailable */ }
    Array.prototype.forEach.call(document.querySelectorAll("[data-sound]"), function (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var l = b.querySelector("[data-sound-label]"); if (l) l.textContent = on ? "Sound on" : "Sound off";
    });
    if (on && !quiet) { ensure(); play("chime"); }
  }
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-sound]"); if (b) set(!on); });
  // The audio context needs a real gesture before it can make a sound; the first touch or click provides it.
  document.addEventListener("pointerdown", function () { if (on) ensure(); }, { capture: true, passive: true });
  if (document.readyState !== "loading") set(on, true); else document.addEventListener("DOMContentLoaded", function () { set(on, true); });

  window.TSSound = { play: play, set: set, isOn: function () { return on; } };
})();
