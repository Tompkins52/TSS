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
    "bh": {"name": "Billhead", "base": os.environ.get("SCREENS_BH", "https://invoice.tompkinssoftwaresystems.com/"), "title": "Billhead"},
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
    e.activated[quarter] = true;
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


def wc_found(then=None):
    """Wait for the app to name the store it found (there is nothing to type), then run a step."""
    def step(page):
        page.wait_for_selector(".where-chip.here", timeout=10000)
        settle(page)
        if then:
            then(page)
    return step


def wc_best_cards(page):
    """Open the best cards at this store from the wallet pocket: yours marked, the rest ranked."""
    page.locator("#answer button.more").first.click(timeout=5000)
    page.wait_for_selector(".sheet .best-row", timeout=5000)


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


# Billhead keeps every invoice on the device, so each capture starts from the same sample
# company written into the app's storage: Hart Electric, two projects billed in stages, and
# invoices in every state (overdue, partly paid, paid, sent, a draft). Dates are counted
# from today, so the sample never ages. The logo is a drawn sample, not a real company's.
BH_LOGO = "data:image/png;base64,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"
BH_SEED = """(arg) => {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const L = (desc, q, r, t, u) => ({ d: desc, q: q, u: u || '', r: r, t: t !== false });
  const base = { v: 1, terms: 'Net 30', dueAuto: true, po: '', ref: '', ship: '', desc: '', from: '', to: '', disc: '', discPct: false, tax: 7.25, taxLabel: 'Sales tax',
    freight: '', deposit: '', retain: '', prog: { on: false, contract: '', n: 1, m: 2, prev: '' },
    pay: { to: 'Hart Electric LLC', instr: 'Mail checks to the address above, or ask for our ACH letter.', link: '', late: '', notes: 'Thank you for the work.' },
    fine: '', sig: { on: false, png: '', name: '', title: '', date: '' }, accept: false, currency: 'USD', vatLabel: '', vat: '', showTaxid: false, show: {}, payments: [], unlock: null, fingerprint: '', paidAt: '' };
  const inv = (o) => Object.assign(JSON.parse(JSON.stringify(base)), o);
  const nl = String.fromCharCode(10);
  const dental = { id: 'c1', name: 'Lakeside Dental', attn: 'Accounts payable', addr: '42 Lakeview Dr' + nl + 'Prairie City, IL 60000', email: 'ap@lakesidedental.example', phone: '', terms: '', notes: '' };
  const library = { id: 'c2', name: 'Prairie City Public Library', attn: 'Facilities', addr: '100 Library Ln' + nl + 'Prairie City, IL 60000', email: 'facilities@pcpl.example', phone: '', terms: '', notes: '' };
  const bakery = { id: 'c3', name: 'Oak Street Bakery', attn: '', addr: '18 Oak St' + nl + 'Prairie City, IL 60000', email: 'hello@oakstreetbakery.example', phone: '', terms: '', notes: '' };
  const cust = (c) => ({ name: c.name, attn: c.attn, addr: c.addr, email: c.email, phone: '' });
  const invoices = [
    inv({ id: 'i1040', tier: 'simple', status: 'sent', clientId: 'c3', projectId: '', num: 'INV-1040', date: d(-38), due: d(-8), sentAt: d(-38), createdAt: d(-38), updatedAt: d(-38), cust: cust(bakery),
      lines: [L('Walk-in cooler: new 30 A circuit and disconnect', 1, 640), L('Wire, conduit, and fittings', 1, 118.4)] }),
    inv({ id: 'i1041', tier: 'advanced', status: 'sent', clientId: 'c2', projectId: 'p2', num: 'INV-1041', date: d(-30), due: d(0), sentAt: d(-30), createdAt: d(-30), updatedAt: d(-9), cust: cust(library), po: 'PCPL-118',
      lines: [L('Mobilization, lighting survey, and layout', 1, 4600, false)], retain: 5, prog: { on: true, contract: 18400, n: 1, m: 4, prev: 0 },
      payments: [{ id: 'pay1', date: d(-9), amount: 4370, method: 'ACH', note: '' }], paidAt: d(-9) }),
    inv({ id: 'i1042', tier: 'advanced', status: 'sent', clientId: 'c1', projectId: 'p1', num: 'INV-1042', date: d(-21), due: d(9), sentAt: d(-21), createdAt: d(-21), updatedAt: d(-4), cust: cust(dental), po: 'PO 4471',
      lines: [L('Demolition and rough-in, second floor', 1, 3200, false)], retain: 10, prog: { on: true, contract: 9600, n: 1, m: 3, prev: 0 },
      payments: [{ id: 'pay2', date: d(0), amount: 1500, method: 'Check', note: 'Check 2231' }] }),
    inv({ id: 'i1043', tier: 'simple', status: 'sent', clientId: 'c1', projectId: '', num: 'INV-1043', date: d(-2), due: d(28), sentAt: d(-2), createdAt: d(-2), updatedAt: d(-2), cust: cust(dental),
      lines: [L('Service call: replace failed GFCI outlets', 1, 285), L('GFCI outlets, 20 A', 3, 24.5)] }),
    inv({ id: 'i1045', tier: 'advanced', status: 'sent', clientId: 'c2', projectId: 'p2', num: 'INV-1045', date: d(-6), due: d(24), sentAt: d(-6), createdAt: d(-6), updatedAt: d(-6), cust: cust(library), po: 'PCPL-118',
      lines: [L('LED fixtures and labor, first floor', 1, 5520, false)], retain: 5, prog: { on: true, contract: 18400, n: 2, m: 4, prev: 4600 } }),
    inv({ id: 'i1044', tier: 'advanced', status: 'draft', clientId: 'c1', projectId: 'p1', num: 'INV-1044', date: d(0), due: d(30), sentAt: '', createdAt: d(0), updatedAt: d(0), cust: cust(dental), po: 'PO 4471',
      desc: 'Panel upgrade and six new 20 A circuits for the exam rooms. Inspected and passed.',
      lines: [L('200 A panel and breakers', 1, 1180, true, 'ea'), L('Labor, panel replacement', 8, 95, false, 'hr'), L('20 A circuit materials', 6, 85, true, 'ea'), L('Labor, circuits', 12, 95, false, 'hr')],
      retain: 10, prog: { on: true, contract: 9600, n: 2, m: 3, prev: 3200 },
      pay: { to: 'Hart Electric LLC', instr: 'Mail checks to the address above, or ask for our ACH letter.', link: '', late: '1.5% per month after the due date', notes: 'Thank you for the work.' } })
  ];
  if (arg.ask) invoices.push(inv({ id: 'i1046', tier: 'simple', status: 'draft', clientId: 'c3', projectId: '', num: 'INV-1046', date: d(0), due: d(30), sentAt: '', createdAt: d(0), updatedAt: d(0), cust: cust(bakery),
    lines: [L('Replace exterior sign lighting', 1, 420), L('LED sign modules', 2, 65)], _step: 2 }));
  const state = { v: 1, credits: { simple: 0, advanced: 0 }, pass: { until: '' }, settings: { look: 'light', sounds: false, onboarded: true }, savedAt: new Date().toISOString(),
    company: { name: 'Hart Electric LLC', logo: arg.logo, addr: '300 Main St, Suite 2' + nl + 'Prairie City, IL 60000', phone: '(555) 010-0142', email: 'office@hartelectric.example', web: 'hartelectric.example',
      taxid: '', vatLabel: '', vat: '', accent: '#1C3F7A', currency: 'USD', paper: 'letter', terms: 'Net 30', taxRate: 7.25, taxLabel: 'Sales tax', payTo: 'Hart Electric LLC',
      payInstr: 'Mail checks to the address above, or ask for our ACH letter.', payLink: '', late: '1.5% per month after the due date', notes: 'Thank you for the work.', fine: '',
      prefix: 'INV-', next: arg.ask ? 1047 : 1046, sig: { png: '', name: 'Dana Hart', title: 'Owner' }, createdAt: d(-60) },
    clients: [dental, library, bakery],
    projects: [
      { id: 'p1', clientId: 'c1', name: 'Second-floor exam rooms', kind: 'progress', contract: 9600, planned: 3, po: 'PO 4471', retain: 10, status: 'open', notes: '', changes: [], createdAt: d(-24) },
      { id: 'p2', clientId: 'c2', name: 'Library LED retrofit', kind: 'progress', contract: 18400, planned: 4, po: 'PCPL-118', retain: 5, status: 'open', notes: '', changes: [], createdAt: d(-32) }
    ],
    invoices: invoices };
  localStorage.clear();
  localStorage.setItem('billhead.v1', JSON.stringify(state));
}"""


def r_bh(route="#/", ask=False):
    """Load Billhead with the sample company, then open one screen by its address."""
    def go(page, base):
        # Write the storage from a file that does not run the app (its icon), then open the app.
        page.goto(base + "icons/icon-192.png", wait_until="domcontentloaded")
        page.evaluate(BH_SEED, {"logo": BH_LOGO, "ask": ask})
        page.goto(base + "index.html" + route, wait_until="networkidle")
        settle(page)
    return go


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
    ("wc-phone", "wc", "phone", r_wc(then=wc_found())),
    ("wc-phone-anywhere", "wc", "phone", r_wc(then=wc_found(then=wc_best_cards))),
    ("wc-phone-compare", "wc", "phone", r_wc(then=wc_found(then=wc_tab("offers")))),
    ("wc-phone-perks", "wc", "phone", r_wc(then=wc_card("Sapphire Reserve", perk="Apple TV"))),
    ("wc-phone-wallet", "wc", "phone", r_wc(then=wc_tab("wallet"))),
    ("wc-phone-hello", "wc", "phone", r_wc(first_run=True)),
    ("bh-edit", "bh", "desktop", r_bh("#/edit/i1044")),
    ("bh-invoice", "bh", "desktop", r_bh("#/inv/i1041")),
    ("bh-phone", "bh", "phone", r_bh("#/")),
    ("bh-phone-ask", "bh", "phone", r_bh("#/ask/i1046", ask=True)),
    ("bh-phone-project", "bh", "phone", r_bh("#/project/p1")),
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
    ap.add_argument("--only", help="comma-separated product keys to capture (safe, pm, p107, ps, wc, bh)")
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
