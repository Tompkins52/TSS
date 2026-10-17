# Tompkins Software Systems website

Company website for Tompkins Software Systems LLC. Static HTML, CSS, and a few lines of JavaScript, assembled by a small build script and published to GitHub Pages.

Working draft. The site is complete except for the items under "Before going live" below.

## How it is put together

```
src/
  pages/          one file per page: a metadata comment, then the page body
  pages/products/ one page per product
  partials/       head.html (doctype, head, header, nav) and footer.html
  assets/         css, js, fonts, img
  static/         files copied to the site root as is (manifest, .nojekyll)
build.py          assembles src/ into dist/ and writes sitemap.xml and robots.txt
.github/workflows/pages.yml   builds and deploys to GitHub Pages on every push to main
```

Each page starts with a comment block the build script reads:

```html
<!--
title: About
description: One sentence for search engines and link previews.
nav: about            which top-nav item is highlighted
priority: 0.8         sitemap priority (optional)
-->
```

Inside a page, write `{{root}}` in front of any link to another page or asset (`{{root}}about.html`, `{{root}}assets/img/mark.svg`). The build replaces it with the right relative prefix, so pages in subfolders work and the site runs from a subpath or a root domain without changes.

## Build and preview locally

Python 3.8 or newer, nothing to install.

```
python3 build.py
python3 -m http.server -d dist 8000
```

Open http://localhost:8000. The build also prints the revision date that appears in the footer.

## Deploying

Pushing to `main` runs the workflow, which builds the site and deploys it to GitHub Pages. One-time setup in the repository settings:

1. Settings, Pages, "Build and deployment", Source: **GitHub Actions**.
2. Push any commit (or run the workflow from the Actions tab). The site appears at https://tompkins52.github.io/TSS/ within a couple of minutes.

The repository must be public for Pages on a free personal account; it is.

### Connecting the domain

When the company is registered and the domain is ready:

1. At the domain registrar, add the DNS records GitHub documents for a custom domain: four `A` records for the apex (`tompkinssystems.com`) pointing at GitHub Pages, and a `CNAME` record for `www` pointing at `tompkins52.github.io`.
2. Settings, Pages, Custom domain: enter the domain, save, wait for the DNS check, then turn on "Enforce HTTPS".
3. Settings, Secrets and variables, Actions, Variables: add `SITE_BASE_URL` with the value `https://tompkinssystems.com/` (trailing slash). The workflow passes it to the build so canonical links, the sitemap, and the Open Graph image use the real address.
4. Push a commit to rebuild.

Point the second domain, `tompkinssoftwaresystems.com`, at the same place with a redirect at the registrar so there is one canonical address.

## Before going live

Everything below is a placeholder or a decision that is still open. Nothing here is a bug.

- [ ] **Contact details.** `src/pages/contact.html` says email and phone are "Published on registration". Replace with the real address once mail is set up on the domain. Also add a `.well-known/security.txt` (RFC 9116) with that address; government buyers look for it.
- [ ] **Newsletter provider.** Pick a mailing list service that accepts a plain form POST (Buttondown, Mailchimp, and similar all do) and put the form URL in `NEWSLETTER_ENDPOINT` at the top of `src/assets/js/site.js`. Until then the form explains that the list is not open yet.
- [ ] **Contact form provider.** Same idea: a form-to-email service URL in `CONTACT_ENDPOINT` in `site.js`. The form includes a honeypot field named `website`; configure the service to drop submissions where it is filled in.
- [ ] **Confirm every claim on the About, Customers, Veteran-owned, Support, Accessibility, and Phantom Soldier pages** reads the way you want it to. In particular: the founder bio, the response-time commitments on the Support page, the "we plan to apply for state certification" line on the Veteran-owned page, the NAICS codes, and the description of what Tompkins Software Systems does for Project Veteran Overwatch.
- [ ] **Dates on the Updates page** are month-level for the product releases. Tighten them if you want exact dates.
- [ ] **App store links.** When Part 107 Prep is live on the App Store and Google Play, add the store badges and links to `src/pages/products/part-107-prep.html` and change its status labels. The privacy policy URL for the store listings is `privacy.html#part-107-prep` and the support URL is `support.html#part-107-prep`.
- [ ] **Open Graph image.** `src/assets/img/og-image.png` is the mark on an evergreen field with no text. Fine for launch; a version with the company name can replace it any time.
- [ ] **Screenshots.** The product pages have no screenshots. Adding one per product (in `src/assets/img/`) is the single biggest visual upgrade available.

## Brand

Colors, typefaces, and logo usage are documented on the site itself at `brand.html`. The design tokens are the CSS custom properties at the top of `src/assets/css/site.css`; changing a color there changes it everywhere. The logo files in `src/assets/img/` have the type outlined, so they do not depend on the fonts.

The typefaces (Source Serif 4 and Public Sans) are self-hosted under the SIL Open Font License; the license texts are in `src/assets/fonts/`.

## Writing rules

Plain, specific, short. No exclamation points, no em dashes. Status labels are literal. See the Voice section of `brand.html`.

## License

Site content and design: copyright Tompkins Software Systems LLC. The fonts are under the SIL Open Font License (see `src/assets/fonts/`). Product licenses are listed on each product page.
