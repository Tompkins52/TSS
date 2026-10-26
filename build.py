#!/usr/bin/env python3
"""Build the Tompkins Software Systems site.

Reads src/pages (one HTML fragment per page, with a metadata comment at the
top), wraps each one in the shared head and footer from src/partials, copies
assets and static files, writes a sitemap, and puts the result in dist/.

    python3 build.py                      # build to dist/
    python3 build.py --base-url https://tompkinssystems.com/

No dependencies beyond the Python standard library.
"""
import argparse
import datetime as dt
import html
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
SITE_NAME = "Tompkins Software Systems"
DEFAULT_BASE_URL = "https://tompkinssoftwaresystems.com/"

META_RE = re.compile(r"^\s*<!--(.*?)-->", re.S)

ORG_JSONLD = """<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Tompkins Software Systems LLC",
  "alternateName": "TSS",
  "url": "%(base)s",
  "logo": "%(base)sassets/img/icon-512.png",
  "foundingDate": "2026-10",
  "address": {"@type": "PostalAddress", "addressRegion": "IL", "addressCountry": "US"}
}
</script>"""


def parse_page(path):
    text = open(path, encoding="utf-8").read()
    m = META_RE.match(text)
    meta = {}
    if m:
        for line in m.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text.lstrip("\n")


def render(template, values):
    out = template
    for k, v in values.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def mark_active_nav(head, nav_key):
    if not nav_key:
        return head
    return head.replace('data-nav="%s"' % nav_key, 'data-nav="%s" aria-current="page"' % nav_key)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL, help="absolute URL the site is served from, with trailing slash")
    ap.add_argument("--out", default=os.path.join(ROOT, "dist"))
    args = ap.parse_args()
    base = args.base_url if args.base_url.endswith("/") else args.base_url + "/"
    out = args.out

    head_t = open(os.path.join(SRC, "partials", "head.html"), encoding="utf-8").read()
    foot_t = open(os.path.join(SRC, "partials", "footer.html"), encoding="utf-8").read()
    revision = dt.date.today().strftime("%Y.%m.%d")

    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)

    pages_dir = os.path.join(SRC, "pages")
    written = []
    for dirpath, _, files in os.walk(pages_dir):
        for name in sorted(files):
            if not name.endswith(".html"):
                continue
            src_path = os.path.join(dirpath, name)
            rel = os.path.relpath(src_path, pages_dir).replace(os.sep, "/")
            depth = rel.count("/")
            meta, body = parse_page(src_path)
            # The 404 page is served at any path, so its links must be absolute.
            root = base if meta.get("absolute") == "true" else "../" * depth
            if "title" not in meta or "description" not in meta:
                sys.exit("missing title or description in %s" % rel)
            canonical = base + ("" if rel == "index.html" else rel)
            page_title = meta.get("title_full") or "%s | %s" % (meta["title"], SITE_NAME)
            extra_head = ""
            if meta.get("jsonld") == "organization":
                extra_head = ORG_JSONLD % {"base": base}
            # A page that has moved: "redirect: products/new-page.html" sends visitors
            # on, points search engines at the new address, and stays out of the sitemap.
            if meta.get("redirect"):
                canonical = base + meta["redirect"]
                extra_head += '\n<meta http-equiv="refresh" content="0; url=%s%s">' % (root, meta["redirect"])
                meta["noindex"] = "true"
            if meta.get("noindex") == "true":
                extra_head += '\n<meta name="robots" content="noindex">'
            values = {
                "root": root,
                "base_url": base,
                "canonical": canonical,
                "page_title": html.escape(page_title, quote=True),
                "description": html.escape(meta["description"], quote=True),
                "extra_head": extra_head,
                "revision": revision,
            }
            page = mark_active_nav(render(head_t, values), meta.get("nav")) + render(body, values) + render(foot_t, values)
            dest = os.path.join(out, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            open(dest, "w", encoding="utf-8").write(page)
            if meta.get("noindex") != "true":
                written.append((rel, meta.get("priority", "0.6")))

    shutil.copytree(os.path.join(SRC, "assets"), os.path.join(out, "assets"))
    static_dir = os.path.join(SRC, "static")
    if os.path.isdir(static_dir):
        for name in os.listdir(static_dir):
            shutil.copy2(os.path.join(static_dir, name), os.path.join(out, name))

    today = dt.date.today().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for rel, prio in sorted(written):
        loc = base + ("" if rel == "index.html" else rel)
        lines.append("  <url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>" % (loc, today, prio))
    lines.append("</urlset>")
    open(os.path.join(out, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    open(os.path.join(out, "robots.txt"), "w", encoding="utf-8").write("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % base)

    print("built %d pages to %s (base %s, revision %s)" % (len(written) + 1, out, base, revision))


if __name__ == "__main__":
    main()
