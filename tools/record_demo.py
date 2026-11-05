"""Record the phone demo for the Witch Card video.

Plays the real app in a phone frame on a 1920x1080 stage (tools/demo/stage.html) with big
captions beside it, and records the screen with a headless browser. The app is served from a
local checkout (DEMO_APP, default ../which-card next to this repo) with the same sample wallet
the site screens use, standing in a grocery store so it opens with the right card.

    python3 tools/record_demo.py                 # writes marketing/demo/demo.mp4
    python3 tools/record_demo.py --beats beats.json --out demo.mp4

Beats are the second each caption lands; pass a JSON file to re-time them to the narration.
"""
import argparse
import functools
import http.server
import json
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from refresh_screens import WC_SEED, WC_WALLET  # noqa: E402

APP = os.environ.get("DEMO_APP", os.path.join(os.path.dirname(ROOT), "which-card"))
HERE = {"latitude": 42.0372, "longitude": -88.2812, "accuracy": 12}
PLACES = {"elements": [{"type": "way", "center": {"lat": 42.0373, "lon": -88.2810}, "tags": {"name": "Jewel-Osco", "brand": "Jewel-Osco", "shop": "supermarket"}}]}

# The default timeline: when each caption lands, in seconds from the first visible frame.
BEATS = {
    "title": 0.0,
    "open": 1.6,
    "knows": 4.2,
    "pulls": 6.6,
    "ranked": 9.8,
    "pledge": 13.0,
    "end": 16.6,
    "stop": 22.0,
}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--beats", help="JSON file of beat name to second")
    ap.add_argument("--out", default=os.path.join(ROOT, "marketing", "demo", "demo.mp4"))
    ap.add_argument("--scale", type=float, default=2.0, help="device scale factor while recording (2 keeps text crisp)")
    args = ap.parse_args()
    beats = dict(BEATS)
    if args.beats:
        with open(args.beats) as f:
            beats.update(json.load(f))

    from playwright.sync_api import sync_playwright

    work = tempfile.mkdtemp(prefix="wc-demo-")
    os.symlink(APP, os.path.join(work, "app"))
    shutil.copy(os.path.join(ROOT, "tools", "demo", "stage.html"), os.path.join(work, "stage.html"))
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=work))
    base = "http://127.0.0.1:%d/" % srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    vids = tempfile.mkdtemp(prefix="wc-vid-")

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=args.scale,
                                  record_video_dir=vids, record_video_size={"width": 1920, "height": 1080},
                                  geolocation=HERE, permissions=["geolocation"])
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        def places(route):
            # A short wait, so "finding your store" is on screen long enough to read.
            time.sleep(0.9)
            route.fulfill(status=200, content_type="application/json", body=json.dumps(PLACES))
        page.route("**/api/interpreter", places)

        # Seed the wallet in the app's own storage from a file that does not run the app.
        page.goto(base + "app/icons/icon-192.png", wait_until="domcontentloaded")
        page.evaluate(WC_SEED, WC_WALLET)
        page.goto(base + "stage.html", wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(600)

        t0 = time.time()

        def at(name):
            wait = beats[name] - (time.time() - t0)
            if wait > 0:
                page.wait_for_timeout(int(wait * 1000))

        at("title")
        page.evaluate("stage.begin(); stage.title()")
        at("open")
        page.evaluate("stage.phone('app/index.html'); stage.say(['Open it', 'at the register.'])")
        at("knows")
        page.evaluate("stage.say(['It knows', 'where you are.'])")
        try:
            page.frame_locator("#app").locator(".where-chip.here").wait_for(timeout=6000)
        except Exception as e:
            print("store not found in time:", str(e).splitlines()[0][:80])
        at("pulls")
        page.evaluate("stage.say(['It pulls out the card', 'that <em>earns the most</em>.'])")
        at("ranked")
        page.evaluate("stage.say(['The rest of your wallet', 'sits under it, ranked.'])")
        at("pledge")
        page.evaluate("stage.say(['No ads.', 'No sponsors.', '<em>99 cents</em>, once.'])")
        at("end")
        page.evaluate("stage.end()")
        at("stop")
        path = page.video.path()
        ctx.close()
        browser.close()
    srv.shutdown()
    if errors:
        print("page errors:", errors[:3])

    # Trim the black lead-in and encode for the web.
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-vf", "blackdetect=d=0.1:pix_th=0.02", "-an", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    start = 0.0
    for line in probe.splitlines():
        if "black_end:" in line:
            start = float(line.split("black_end:")[1].split()[0])
            break
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", "%.3f" % start, "-i", path,
                    "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-an", args.out], check=True)
    print("wrote", args.out, "(lead-in %.2fs trimmed)" % start)
    shutil.rmtree(work, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
