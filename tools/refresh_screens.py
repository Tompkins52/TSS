"""Keep the product screens on the site current.

Opens each live product in a headless browser, captures the same screens the
site shows (src/assets/img/products), and compares each capture with the file
in the repository. When a screen looks different, the file is replaced. The
daily workflow (.github/workflows/screens.yml) commits the result and redeploys.

Run it by hand:

    pip install playwright pillow
    playwright install chromium
    python3 tools/refresh_screens.py            # update what changed
    python3 tools/refresh_screens.py --force    # recapture everything
    python3 tools/refresh_screens.py --dry-run  # report only

The comparison is visual, not pixel-exact: both images are shrunk and blurred
before they are compared and the result is the percent of the picture that
moved, so a changed date does not count as a change, while a new layout, a
new color, or a missing section does. A product that cannot be reached, or that answers with something
other than its own page, is skipped and reported rather than replaced.
"""
import argparse
import json
import os
import sys
import time

from PIL import Image, ImageChops, ImageFilter, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "assets", "img", "products")

# Base addresses. Override with environment variables to capture from a local copy.
PRODUCTS = {
    "safe": {"name": "IntelliSafe", "base": os.environ.get("SCREENS_SAFE", "https://tompkins52.github.io/Safety-Training/"), "title": "IntelliSafe"},
    "pm": {"name": "Painless Project Management", "base": os.environ.get("SCREENS_PM", "https://tompkins52.github.io/painless-pm/"), "title": "Painless"},
    "p107": {"name": "Part 107 Prep", "base": os.environ.get("SCREENS_P107", "https://tompkins52.github.io/part107-prep/"), "title": "Part 107"},
    "ps": {"name": "Phantom Soldier", "base": os.environ.get("SCREENS_PS", "https://phantomsoldier.org/"), "title": "Phantom Soldier"},
    "wc": {"name": "Witch Card", "base": os.environ.get("SCREENS_WC", "https://tompkins52.github.io/which-card/"), "title": "Witch Card"},
}

DESKTOP = {"viewport": {"width": 1280, "height": 800}, "device_scale_factor": 1}
PHONE = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2}
WIDTHS = {"desktop": 1100, "phone": 390}
THRESHOLD = 2.0  # percent of the picture that may change before a screen counts as changed

# The practice exams pick questions at random. A fixed sequence makes the capture
# repeatable, so a different question is not mistaken for a changed product.
SEEDED_RANDOM = """(function () { var s = 20261028; Math.random = function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();"""


def click_first(page, selectors, timeout=4000):
    """Click the first selector that resolves. Returns True when something was clicked."""
    for sel in selectors:
        try:
            page.locator(sel).first.click(timeout=timeout)
            page.wait_for_timeout(500)
            return True
        except Exception:
            continue
    return False


def settle(page):
    page.wait_for_timeout(700)
    try:
        page.evaluate("document.fonts && document.fonts.ready")
    except Exception:
        pass


# Each screen: (file name, product key, device, recipe). A recipe takes the page and the base address.
def r_goto(path="index.html", scroll=0):
    def go(page, base):
        page.goto(base + path, wait_until="networkidle")
        if scroll:
            page.evaluate("window.scrollTo(0, %d)" % scroll)
        settle(page)
    return go


def r_safe_module(page, base):
    page.goto(base + "index.html", wait_until="networkidle")
    settle(page)
    click_first(page, ["a:has-text('Start')", "button:has-text('Start')"])
    settle(page)


def r_pm_view(label):
    def go(page, base):
        page.goto(base + "index.html", wait_until="networkidle")
        settle(page)
        click_first(page, ["button:has-text('%s')" % label, "a:has-text('%s')" % label])
        settle(page)
    return go


def r_p107_exam(page, base):
    page.goto(base + "exam.html", wait_until="networkidle")
    settle(page)
    click_first(page, ["button:has-text('quick')", "button:has-text('Quick')", "button:has-text('20')"])
    settle(page)


# Witch Card is a phone app that keeps everything on the phone, so every capture starts
# from the same sample wallet written into the app's own storage. Cards are picked by
# name; the app never holds a card number. Every Witch Card screen is a phone screen.
# Location is on in the sample wallet, and the phone stands at a gas station: its position
# is fixed and the OpenStreetMap lookup is answered with the two businesses there, so the
# app opens with "You're at Shell" every time, the way it does at a real pump.
WC_HERE = {"latitude": 41.87860, "longitude": -87.63590, "accuracy": 15}
WC_PLACES = {"elements": [
    {"type": "node", "lat": 41.87861, "lon": -87.63589, "tags": {"name": "Shell", "brand": "Shell", "amenity": "fuel"}},
    {"type": "way", "center": {"lat": 41.87920, "lon": -87.63630}, "tags": {"name": "Jewel-Osco", "shop": "supermarket"}},
]}
WC_WALLET = ["chase-sapphire-reserve", "citi-costco-anywhere-visa", "amex-blue-cash-preferred",
             "chase-prime-visa", "wells-fargo-active-cash", "chase-freedom-unlimited"]
WC_SEED = """(ids) => {
  const now = new Date(), at = now.toISOString();
  const quarter = now.getFullYear() + '-Q' + (Math.floor(now.getMonth() / 3) + 1);
  const wallet = ids.map((id) => {
    const e = { cardId: id, added: at, activated: {}, purchases: [] };
    if (id === 'chase-prime-visa') e.memberships = { 'amazon-prime': true };
    if (id === 'chase-sapphire-reserve') e.perkState = { 'apple-tv-music': { at }, 'dashpass': { at }, 'lyft-credit': { at }, 'travel-credit': { at } };
    return e;
  });
  const dismissed = {}; dismissed['perks:' + quarter] = true;
  localStorage.clear();
  localStorage.setItem('whichcard.state.v1', JSON.stringify({ wallet, customCards: [], trips: {}, dismissed,
    prefs: { priority: 'cash', payMethod: 'card', redeem: {}, theme: 'light', location: true, showAnywhere: true },
    disclaimed: true, onboarded: true, locationAsked: true }));
}"""


def r_wc(path="index.html", then=None, first_run=False):
    """Load Witch Card with the sample wallet (or as a first-time visitor), then run an optional step."""
    def go(page, base):
        # Write the storage from a file that does not run the app (its icon). Loading the app
        # itself here would start a store lookup that can finish later and save over the seed.
        page.goto(base + "icons/icon-192.png", wait_until="domcontentloaded")
        if first_run:
            page.evaluate("localStorage.clear()")
        else:
            page.evaluate(WC_SEED, WC_WALLET)
        page.goto(base + path, wait_until="networkidle")
        settle(page)
        if then:
            then(page)
            settle(page)
    return go


def wc_amount(value, then=None):
    """Wait for the app to name the store it found, then type the amount."""
    def step(page):
        page.wait_for_selector(".where-chip.here", timeout=10000)
        page.fill("#amount", value)
        page.evaluate("document.activeElement && document.activeElement.blur()")
        settle(page)
        if then:
            then(page)
    return step


def wc_scroll_to(selector):
    def step(page):
        page.locator(selector).first.scroll_into_view_if_needed(timeout=5000)
        page.evaluate("(s) => document.querySelector(s).scrollIntoView({block: 'center'})", selector)
    return step


def wc_tab(view):
    def step(page):
        page.locator(".tabs button[data-view='%s']" % view).click(timeout=5000)
    return step


def wc_card(name, perk=None):
    """Open a card from the wallet; with a perk name, scroll the perks list to it."""
    def step(page):
        wc_tab("wallet")(page)
        settle(page)
        page.locator(".tile", has_text=name).first.click(timeout=5000)
        settle(page)
        if perk:
            page.evaluate("""(t) => {
              const item = [...document.querySelectorAll('.perk-list > *')].find((e) => e.textContent.includes(t));
              if (item) item.scrollIntoView({block: 'center'});
            }""", perk)
    return step


SCREENS = [
    ("safe-training", "safe", "desktop", r_goto("index.html")),
    ("safe-module", "safe", "desktop", r_safe_module),
    ("safe-incidents", "safe", "desktop", r_goto("index.html#/incidents")),
    ("safe-inspections", "safe", "desktop", r_goto("index.html#/inspections")),
    ("safe-phone", "safe", "phone", r_goto("index.html")),
    ("safe-phone-incidents", "safe", "phone", r_goto("index.html#/incidents")),
    ("pm-rollup", "pm", "desktop", r_pm_view("Roll-up")),
    ("pm-projects", "pm", "desktop", r_pm_view("Projects")),
    ("pm-charter", "pm", "desktop", r_pm_view("Start a project")),
    ("pm-phone", "pm", "phone", r_goto("index.html")),
    ("pm-phone-rollup", "pm", "phone", r_pm_view("Roll-up")),
    ("p107-home", "p107", "desktop", r_goto("index.html")),
    ("p107-airspace", "p107", "desktop", r_goto("study-airspace.html", scroll=600)),
    ("p107-exam", "p107", "desktop", r_p107_exam),
    ("p107-phone", "p107", "phone", r_goto("index.html")),
    ("p107-phone-exam", "p107", "phone", r_p107_exam),
    ("ps-home", "ps", "desktop", r_goto("index.html")),
    ("ps-music", "ps", "desktop", r_goto("music/")),
    ("ps-phone", "ps", "phone", r_goto("index.html")),
    ("wc-phone", "wc", "phone", r_wc(then=wc_amount("45"))),
    ("wc-phone-anywhere", "wc", "phone", r_wc(then=wc_amount("45", then=wc_scroll_to(".anywhere")))),
    ("wc-phone-perks", "wc", "phone", r_wc(then=wc_card("Sapphire Reserve", perk="Apple TV"))),
    ("wc-phone-wallet", "wc", "phone", r_wc(then=wc_tab("wallet"))),
    ("wc-phone-hello", "wc", "phone", r_wc(first_run=True)),
]


def reachable(page, product):
    """The product answers with its own page: status 200 and its name in the title or the body."""
    try:
        resp = page.goto(product["base"] + "index.html", wait_until="domcontentloaded", timeout=30000)
        if resp is not None and resp.status >= 400:
            return False, "HTTP %d" % resp.status
        page.wait_for_timeout(500)
        title = page.title() or ""
        body = page.locator("body").inner_text(timeout=5000)[:4000]
        if product["title"].lower() in title.lower() or product["title"].lower() in body.lower():
            return True, "ok"
        return False, "page does not look like %s (title: %r)" % (product["name"], title[:60])
    except Exception as e:  # network, DNS, timeout
        return False, str(e).splitlines()[0][:120]


def shrink(im):
    """A small, blurred version for comparison. Color is kept so a new palette counts."""
    w = 120
    g = im.convert("RGB").resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
    return g.filter(ImageFilter.GaussianBlur(1.0))


def difference(a, b):
    """Percent of the picture that changed: pixels whose color moved by more than 16 (of 255)
    in any channel after shrinking and blurring. A changed date is a fraction of a percent;
    a new header color, a missing section, or a new layout is several percent or more."""
    sa, sb = shrink(a), shrink(b)
    if sa.size != sb.size:
        return 100.0
    r, g, bl = ImageChops.difference(sa, sb).split()
    worst = ImageChops.lighter(ImageChops.lighter(r, g), bl)
    h = worst.histogram()
    total = sum(h)
    return 100.0 * sum(h[17:]) / total if total else 0.0


def looks_blank(im):
    return ImageStat.Stat(im.convert("L")).stddev[0] < 4


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--force", action="store_true", help="replace every screen, changed or not")
    ap.add_argument("--dry-run", action="store_true", help="capture and compare, change nothing")
    ap.add_argument("--only", help="comma-separated product keys to capture (safe, pm, p107, ps, wc)")
    ap.add_argument("--report", help="append a Markdown summary to this file (the workflow passes $GITHUB_STEP_SUMMARY)")
    ap.add_argument("--threshold", type=float, default=THRESHOLD)
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    only = set(args.only.split(",")) if args.only else set(PRODUCTS)
    rows, changed, skipped = [], [], {}
    os.makedirs(OUT, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        pages = {"desktop": browser.new_context(**DESKTOP).new_page(), "phone": browser.new_context(**PHONE).new_page()}
        for page in pages.values():
            page.add_init_script(SEEDED_RANDOM)
        if "wc" in only:
            # Any origin: the app's address may forward to its own domain.
            phone = pages["phone"].context
            phone.grant_permissions(["geolocation"])
            phone.set_geolocation(WC_HERE)
            # The app asks one of two public map servers; both answer with the same two businesses.
            pages["phone"].route("**/api/interpreter", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(WC_PLACES)))

        # Is each product up and answering with its own page?
        for key, product in PRODUCTS.items():
            if key not in only:
                continue
            ok, why = reachable(pages["desktop"], product)
            if not ok:
                skipped[key] = why
                print("SKIP %s: %s" % (product["name"], why))

        for name, key, device, recipe in SCREENS:
            if key not in only or key in skipped:
                continue
            product, page = PRODUCTS[key], pages[device]
            path = os.path.join(OUT, name + ".webp")
            try:
                recipe(page, product["base"])
                # Finish any running animation first, so a card is never caught half way out of the wallet.
                png = page.screenshot(animations="disabled")
            except Exception as e:
                rows.append((name, "capture failed", str(e).splitlines()[0][:80]))
                print("FAIL %s: %s" % (name, str(e).splitlines()[0][:120]))
                continue
            from io import BytesIO
            new = Image.open(BytesIO(png)).convert("RGB")
            w = WIDTHS[device]
            new = new.resize((w, round(new.height * w / new.width)), Image.LANCZOS)
            if looks_blank(new):
                rows.append((name, "blank capture", "kept the old file"))
                print("BLANK %s" % name)
                continue
            diff = difference(Image.open(path).convert("RGB"), new) if os.path.exists(path) else 100.0
            status = "new file" if not os.path.exists(path) else ("changed" if diff > args.threshold else "same")
            if args.force and status == "same":
                status = "forced"
            rows.append((name, status, "%.1f%%" % diff))
            print("%-22s %-9s changed %.1f%%" % (name, status, diff))
            if status in ("changed", "new file", "forced") and not args.dry_run:
                new.save(path, "WEBP", quality=84, method=6)
                changed.append(name)
        browser.close()

    summary = ["## Product screens, %s" % time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), ""]
    if skipped:
        summary.append("Skipped (not reachable or not itself): " + "; ".join("%s: %s" % (PRODUCTS[k]["name"], v) for k, v in skipped.items()))
        summary.append("")
    summary.append("| Screen | Result | Difference |")
    summary.append("|---|---|---|")
    summary += ["| %s | %s | %s |" % r for r in rows]
    summary.append("")
    summary.append("%d screen%s %s." % (len(changed), "" if len(changed) == 1 else "s", "would change" if args.dry_run else "updated"))
    text = "\n".join(summary)
    print("\n" + text)
    if args.report:
        with open(args.report, "a", encoding="utf-8") as f:
            f.write(text + "\n")

    captured = [k for k in only if k not in skipped]
    if not captured:
        print("Nothing could be captured; leaving the repository as it is.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
