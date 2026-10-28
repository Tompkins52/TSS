/* Small sounds for the interactive pages, made with the Web Audio API. No audio files.
   Off until the visitor turns them on; the choice is kept in this browser only. */
(function () {
  "use strict";
  var KEY = "tss-sound", ctx = null, on = false, master = null;
  try { on = window.localStorage && localStorage.getItem(KEY) === "on"; } catch (e) { on = false; }

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    return ctx;
  }
  function env(node, t0, attack, dur, peak) {
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g); g.connect(master); return g;
  }
  function tone(freq, dur, type, peak, slideTo, delay) {
    var t0 = ctx.currentTime + (delay || 0), o = ctx.createOscillator(); o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    env(o, t0, 0.005, dur, peak); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, kind, from, to, peak, delay) {
    var t0 = ctx.currentTime + (delay || 0), n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = kind || "bandpass"; f.Q.value = 0.9; f.frequency.setValueAtTime(from, t0); if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    src.connect(f); env(f, t0, 0.01, dur, peak); src.start(t0); src.stop(t0 + dur + 0.05);
  }

  var SOUNDS = {
    tick: function () { tone(1300, 0.05, "triangle", 0.05, 900); },
    pop: function () { tone(280, 0.08, "sine", 0.09, 640); },
    flip: function () { noise(0.11, "bandpass", 2200, 500, 0.14); tone(520, 0.04, "sine", 0.03, 380, 0.03); },
    stamp: function () { tone(120, 0.16, "sine", 0.18, 60); noise(0.05, "lowpass", 500, 120, 0.1); },
    chime: function () { tone(1046.5, 0.22, "sine", 0.07); tone(1318.5, 0.26, "sine", 0.06, null, 0.09); },
    splash: function () { noise(0.28, "bandpass", 3200, 260, 0.1); tone(320, 0.14, "sine", 0.05, 140); },
    whoosh: function () { noise(0.24, "bandpass", 380, 2600, 0.08); },
    error: function () { tone(190, 0.07, "square", 0.045); tone(170, 0.09, "square", 0.045, null, 0.1); },
    draw: function () { noise(0.9, "highpass", 3500, 5000, 0.018); }
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
  if (document.readyState !== "loading") set(on, true); else document.addEventListener("DOMContentLoaded", function () { set(on, true); });

  window.TSSound = { play: play, set: set, isOn: function () { return on; } };
})();
