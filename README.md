# Tompkins Software Systems website

Company website for Tompkins Software Systems LLC. Static HTML, CSS, and a few lines of JavaScript, assembled by a small build script and published to GitHub Pages.

Working draft. The site is complete except for the items under "Before going live" below.

## How it is put together

```
src/
  pages/          one file per page: a metadata comment, then the page body
  pages/products/ one page per product
  pages/upfront/, pages/squared-away/  the product family pages (one folder per family)
  pages/products.html           Our products (the families, plus Painless PM and Witch Card)
  pages/customer-products.html  Customer products (IntelliSafe, Phantom Soldier) and how a build works
  partials/       head.html (doctype, head, header, nav) and footer.html
  assets/         css, js, fonts, img (img/products holds the product screens,
                  img/families the family marks; css/family.css the family styles)
  static/         files copied to the site root as is (manifest, .nojekyll)
build.py          assembles src/ into dist/ and writes sitemap.xml and robots.txt
tools/refresh_screens.py      captures the product screens from the live products
.github/workflows/pages.yml   builds and deploys to GitHub Pages on every push to main
.github/workflows/screens.yml refreshes the product screens once a day
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

Optional keys: `body_class` (a class on `<body>`, the home page uses `home`), `styles` and `scripts` (comma-separated files under the site root, loaded on that page only), `redirect` (the page has moved; sends visitors on and stays out of the sitemap), and `noindex`.

Inside a page, write `{{root}}` in front of any link to another page or asset (`{{root}}about.html`, `{{root}}assets/img/mark.svg`). The build replaces it with the right relative prefix, so pages in subfolders work and the site runs from a subpath or a root domain without changes.

## The home page

The home page opens by saying what the company does: we make our own apps, and we build software for partners under their name (`.intro`, with two doors to Our products and Customer products). Then 01 Our products (a card for each family, and "Also from TSS"), 02 Customer products, 03 How a build goes, 04 Try it (the sample apps below), the veteran-owned band, Latest, and the newsletter. It lives in three files: `src/pages/index.html` (markup), `src/assets/css/home.css` (styles), and `src/assets/js/home.js` (behavior). Nothing is sent anywhere; everything runs in the visitor's browser and is gone when the tab closes.

- **Eleven sample apps** (`#try`). The visitor picks who they are and gets a working sample app in a device frame: work orders (public works), a permit desk (local government), reservations with a conflict check (park district), an estimate builder (small business), pre-trip inspections (fleet and trucking), resident requests, dues, and notices (property and HOAs), volunteer shifts (nonprofit), members, renewals, and events (membership organization), a season scheduler with standings (sports league), a course player with a quiz and a certificate (learning platform), and a licensing console (my own idea). Each app is an object in `home.js` with `views`, `init` (the sample data), `render`, `act` (clicks and form submits), and optionally `live` (inputs that update numbers without redrawing). The shell at the bottom of the file draws the top bar, the side navigation or phone tabs, and the main area, and wires events by delegation. Exports are real CSV and SVG downloads built in the browser.
- **Each app has its own look.** Every audience in `AUD` carries a `look` (palette, font, layout, icon) that the app starts in, so switching apps changes the whole feel. The four layouts in `LAYOUTS` change where the navigation lives and the density and corner radius through CSS variables on `.screen[data-layout]`. On the desktop they are a sidebar (Classic), tabs across the top (Tabs), an icon rail (Compact), and pills (Friendly); on the phone the same four become bottom tabs, a scrolling strip under the title, a menu button with a slide-in drawer, and pills, so the phone has four looks of its own (`data-shell` on `.screen` names the shell actually drawn). Eleven palettes, one per app, in `PALETTES`.
- **Desktop and phone, palette and font.** The desktop screen is drawn at 720 by 450 pixels and scaled to fit its column; the phone frame is 320 wide. Narrow viewports start on the phone layout. The swatches show each palette's two main colors; the last swatch opens the device's own color picker and `derivePalette()` builds a whole palette from that one color. The font menu shows every typeface in itself. Both set CSS variables on the screen (`--ui-top`, `--ui-accent`, `--ui-font`, and so on; the defaults are at the top of the `.screen` rule in `home.css`); the choices are in `PALETTES` and `FONTS` in `home.js`, and each app keeps its own choice for the visit. A non-default look is mentioned in the drafted contact message. Reset restores the sample data for the current app and keeps the look.
- **The pickable typefaces** live in `src/assets/fonts/picker/` (Inter, IBM Plex Sans, Atkinson Hyperlegible, Nunito, Barlow, Space Grotesk, Lora, Merriweather, JetBrains Mono; all SIL Open Font License, licenses alongside), subset to Latin at two weights with fontTools. They are declared in `home.css` and a font is only downloaded when it is shown. To add one, drop in the two WOFF2 files and the license, add the `@font-face` rules, and add an entry to `FONTS`.
- **Sound and motion.** `assets/js/sfx.js` makes a handful of small sounds with the Web Audio API (a tick for a view change, a page turn for a new app, a pop for an added item, a stamp for an approval, a chime for an export, a paint splat for a palette) with no audio files. Sound is on in the sample apps until the visitor turns it off with the speaker button, and the choice is kept in that browser; the audio context starts on the first tap. The sample apps are the only place on the site with sound. A palette choice lands on the screen as an animated paint splash (an SVG blob and droplets drawn on the spot). Apps set `st.flash` (a new card), `st.stamp`, `st.chime`, or `st.err` and the shell plays the matching cue and animates the card. Stat tiles count up when a view opens, and a palette choice spreads across the screen from the swatch.
- **The reveal.** On load and on every switch, the app is drawn twice: the built one, and a blueprint copy (`.plan`) on top that is wiped away left to right with a brass scan line. The blueprint is the same markup with the colors stripped by CSS, so it never needs its own drawing. The headline arrives a word at a time, the contour map (`assets/img/contours.svg`, generated once with marching squares over smooth noise) drifts with the scroll, and section labels and product cards draw in as they enter the viewport. All of it is off for visitors who prefer reduced motion.
- **Start from this.** The box under the device opens the contact page with the topic and a message prefilled through URL parameters (`?topic=build|idea&draft=...`); `site.js` reads them.
- To add an audience, add an entry to `AUD` (label, kind, title, why, ask, hint, topic, app) and a matching radio in `index.html`. To change sample data, edit the `init` function of the app.

## Motion on every page

`site.js` marks cards, list items, section heads, figures, and form groups with `.rv` and toggles `.in` as they enter and leave the viewport, so things fade in as they arrive and out as they go, with a small stagger among siblings. A brass reading line under the header shows how far down the page the visitor is, and the contour map behind every dark band drifts with the scroll (`--py`). Buttons lift, cards lift, nav links underline, and page heads arrive with a short rise. All of it is off for visitors who prefer reduced motion. Product cards and section labels on the home and products pages also get `.seen` once, the first time they come into view, which is what draws them in.

## The retired Invoice Creator

The free TSS Invoice Creator that lived at `invoice-creator.html` was replaced on November 3, 2026 by Billhead, its own app at invoice.tompkinssoftwaresystems.com (repo Tompkins52/Invoice). The page is kept, out of the sitemap, for old links: a visitor with nothing saved from the old tool goes straight to `products/billhead.html?from=invoice-creator`, which shows a one-line "now Billhead" note. A visitor whose browser still holds an invoice from the old tool (`localStorage`, key `tss-invoice-creator`) sees it named, with a **Move it to Billhead** button and a **Forget it on this device** button. The move opens Billhead with the invoice inside the link after `#import=` (base64url JSON; browsers never send the part after `#` to a server), and Billhead fills in the company profile and the invoice from it. A logo too large for a link is left behind with a note. The old tool's `invoice.js` and `invoice.css` are gone.

## Product pages

Each product page starts with the real screens (`src/assets/img/products/`, WebP, 1100 pixels wide for desktop and 390 for phone), then a piece of the product to try, then a six-item feature grid with the long details in a disclosure, three more screens, a facts strip, and the release history. The interactive pieces live in `src/assets/js/product.js` and `src/assets/css/product.css`:

- **Painless Project Management** (`#demo-pm`). Sliders feed the product's own roll-up rules (overdue milestone: amber, red past 14 days; forecast over approved: amber, red past 110 percent; quiet after 14 days without an update).
- **IntelliSafe** (`#demo-safe`). A drag-to-compare between a paper sign-in sheet (inline SVG) and a compliance matrix. The handle is a native range input, so it works with a keyboard.
- **Part 107 Prep** (`#demo-107`). The question of the day rotates by day of year through the `QUESTIONS` list. Add questions there; each has a category, the choices, the correct index, an explanation, and the regulation it comes from.
- **Billhead** (`#demo-bh`). What a year of invoicing costs once paid downloads start: two sliders (invoices a month, the share that are advanced) and the three ways to pay, singles, packs topped up with singles, or the year pass, with the cheapest marked. The prices are `BH` at the top of the Billhead section in `product.js` and must match `M.PRICING` in the app's `js/model.js`. Billhead is shown with a desktop frame and a phone in its hero and as three phones in its cards; every button uses the short address tompkinssoftwaresystems.com/billhead/ (`src/pages/billhead/index.html`, `go:`).
- **Which Card** (`#demo-wc`). The app's answer screen in a phone frame, with six cards and ten stores. The app opens with "You're at" and the store your location finds; in the demo, tapping a store stands you in it. `WC_CARDS` and `WC_STORES` are copied from the app's card data and dated on the page; `wcRank` ranks them the way the app does (cards the store takes, then the most money, then purchase protections and the lower fee). If the app's rates for those six cards change, update `WC_CARDS` and the date. Which Card is an app for phones, so it is shown only in phone screens: the hero (`.phero-phones`), the product cards on the home and products pages (`.prod-app`, `.phones`), and the screens grid (`.screens-grid.phones`). The QR code in its hero opens the app and shows only on computers. Every Which Card button and the QR code use the short address tompkinssoftwaresystems.com/which-card/ (`src/pages/which-card/index.html`), which forwards at once to wherever the app lives, set with `go:` in that page's metadata. When the app's own domain answers, change `go:` there and every link and printed QR code follows.

## Product families

The apps are published in families, and more families will be added, so site copy never gives a count of them ("in families", "our families"). Each family is its own brand, with its own name, mark, colors, and typeface; TSS is the maker of all of them. Every app keeps its own name, and its logo is drawn from its family's mark: the family's tile, colors, and drawing style, with the app's own symbol.

- **Upfront for Small Business** ("Upfront" after the first mention): apps for running a small business with the price on the tag: no subscription, no ads, never a cut of the customer's money, records that belong to the business. Billhead's navy and paper with a price-tag red (`#e4572e`), IBM Plex Sans. Page: `src/pages/upfront/index.html` (tompkinssoftwaresystems.com/upfront/). In it: Billhead. Planned: fleet tracking, timesheets.
- **Squared Away Training** ("Squared Away" after the first mention): study apps for licenses, certifications, and entrance exams on one study engine. Part 107 Prep's night, cream, and amber, Barlow. Page: `src/pages/squared-away/index.html` (tompkinssoftwaresystems.com/squared-away/). In it: Part 107 Prep. Planned: PMP exam prep, CDL knowledge test prep, ASVAB prep.
- Painless Project Management and Witch Card are our own apps outside the families ("Also from TSS" on the Our products page). IntelliSafe (licensed by IntelliSafe Systems LLC) and Phantom Soldier (Project Veteran Overwatch, pro bono) are customer products, on `customer-products.html`; their product pages carry a "Customer product, built for ..." tag and `nav: customer`.

The family colors and type are CSS variables on `.fam-up` and `.fam-sq` at the top of `src/assets/css/family.css` (`--f-main`, `--f-deep`, `--f-accent`, `--f-font`, and so on); a family page puts the class on `<body>` through `body_class`, and the cards and blocks carry it themselves. The marks are `src/assets/img/families/upfront-mark.svg` and `squared-away-mark.svg`, also offered for download on the brand page. IBM Plex Sans and Barlow come from `assets/fonts/picker/`.

To add an app to a family: its card goes in the family's block on `products.html` (`.fam-block`), in the family card on the home page (`.fam-card`, the `.fam-apps` list and the phones), and under "In the family" on the family page; its product page gets the `.fam-tag` link in the hero (in place of the "Product" eyebrow), a Family row in the facts strip, and `nav: products`; and the footer lists it under the family. A planned app is a dashed card (`.planned-card` in a `.planned-row` under a "Planned" heading) with a Planned badge until it is in testing; each family block ends with one newsletter sign-up (`.fam-signup`). The home page's Squared Away card also shows the next planned app as a drawn phone (`.phone-planned`). Store listings for a family's apps end with the family line, for example "Billhead is part of Upfront for Small Business, small business apps from Tompkins Software Systems with the price on the tag: tompkinssoftwaresystems.com/upfront".

To add a family: give it a class with its own tokens at the top of `src/assets/css/family.css` (copy `.fam-up` and change the values), its mark in `src/assets/img/families/`, and a page in its own folder (`src/pages/<name>/index.html`, with `nav: products`, `styles: home.css, family.css`, and its class in `body_class`). Then add a block on `products.html` (a `.fam-block` with its own `.fam-signup`) and a link in the jump row at the top (`.fam-jump`), a card on the home page (`.fam-card` inside `.fam-duo`; the cards wrap to as many columns as fit), a sheet on the brand page (`.fam-sheet`), and a heading with its apps in the footer's Our products column. Then add its apps as above.

The top navigation is Our products (`nav: products`), Customer products (`nav: customer`, also used by the Who we work with page), About, Updates, Contact, and the newsletter button; the two products pages share a pair of tabs at the top (`.ptabs`). The full navigation shows from 880 pixels up; narrower screens use the menu button. The sample apps are still at `index.html#try`.

### The screens keep themselves current

`.github/workflows/screens.yml` runs `tools/refresh_screens.py` once a day (and on demand from the Actions tab). The script opens each live product in a headless browser, captures the same screens the site shows, and compares each one with the file in the repository. The comparison is visual: both images are shrunk and blurred, and the result is the percent of the picture that moved, so a changed date or a timer does not count, while a new layout, a new color, or a missing section does (the threshold is 2 percent; the practice exams are captured with a fixed random sequence so they show the same questions every day). When a screen has changed, the workflow commits the new file as `github-actions[bot]` and starts the deploy workflow, so the site follows the products without anyone touching it. A product that is down, or that answers with something other than its own page, is skipped and listed in the run summary rather than replaced. "Force" on a manual run recaptures everything.

To add a screen: capture it in `SCREENS` in `tools/refresh_screens.py` (a file name, a product, desktop or phone, and a recipe) and reference the file from a page. To run it locally: `pip install playwright pillow`, `playwright install chromium`, then `python3 tools/refresh_screens.py --dry-run`. The `SCREENS_SAFE`, `SCREENS_PM`, `SCREENS_P107`, `SCREENS_PS`, `SCREENS_WC`, and `SCREENS_BH` environment variables point it at local copies. Billhead keeps invoices on the device too, so its recipes write a sample company into the app's storage first (`BH_SEED`: Hart Electric, two projects billed in stages, and invoices in every state, with dates counted from today so the sample never ages). Which Card keeps everything on the phone, so its recipes first write a sample wallet into the app's storage (`WC_SEED`), with location on. The phone's position and the OpenStreetMap lookup are faked (`WC_HERE`, `WC_PLACES`), so the app opens at the same gas station every day and shows "You're at Shell" the way it does at a real pump.

Text on the site (status labels, feature lists, release notes) is still written by hand; the workflow only keeps the pictures honest.

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

- [ ] **Contact details.** The email address, admin@tompkinssoftwaresystems.com, is published on `src/pages/contact.html`. Add a phone number there when there is one, and add a `.well-known/security.txt` (RFC 9116) with the email address; government buyers look for it.
- [ ] **Newsletter provider.** Pick a mailing list service that accepts a plain form POST (Buttondown, Mailchimp, and similar all do) and put the form URL in `NEWSLETTER_ENDPOINT` at the top of `src/assets/js/site.js`. Until then the form explains that the list is not open yet.
- [ ] **Contact form provider.** Same idea: a form-to-email service URL in `CONTACT_ENDPOINT` in `site.js`. The form includes a honeypot field named `website`; configure the service to drop submissions where it is filled in.
- [ ] **Confirm every claim on the About, Customers, Veteran-owned, Support, Accessibility, and Phantom Soldier pages** reads the way you want it to. In particular: the response-time commitments on the Support page, the "we plan to apply for state certification" line on the Veteran-owned page, the NAICS codes, and the description of what Tompkins Software Systems does for Project Veteran Overwatch.
- [ ] **Dates on the Updates page** are month-level for the product releases. Tighten them if you want exact dates.
- [ ] **App store links.** When Part 107 Prep is live on the App Store and Google Play, add the store badges and links to `src/pages/products/part-107-prep.html` and change its status labels. The privacy policy URL for the store listings is `privacy.html#part-107-prep` and the support URL is `support.html#part-107-prep`. The same goes for Which Card when its store versions are approved: `src/pages/products/which-card.html`, the product cards on `index.html` and `products.html`, `privacy.html#which-card`, and `support.html#which-card`.
- [ ] **Billhead prices.** Billhead is free during launch; the site states the prices (any invoice under $100 free, first invoice free, 99 cents and $1.99, packs, $99 a year). When payments switch on in the app, change "Free during launch" on `products/billhead.html`, the cards on `index.html` and `products.html`, the Upfront page (`upfront/index.html`, including the price tag in its hero), section 04 of the home page, and the Billhead sections of `privacy.html` and `terms.html`. The store versions, when they exist, get the same badges and links treatment as Part 107 Prep.
- [ ] **Open Graph image.** `src/assets/img/og-image.png` is the mark on an evergreen field with no text. Fine for launch; a version with the company name can replace it any time.

## Brand

Colors, typefaces, and logo usage are documented on the site itself at `brand.html`. The design tokens are the CSS custom properties at the top of `src/assets/css/site.css`; changing a color there changes it everywhere. The logo files in `src/assets/img/` have the type outlined, so they do not depend on the fonts.

The typefaces (Source Serif 4 and Public Sans) are self-hosted under the SIL Open Font License; the license texts are in `src/assets/fonts/`. The nine extra typefaces in `src/assets/fonts/picker/` exist only for the sample apps on the home page. The contour map behind every dark band is `src/assets/img/contours.svg`.

## Writing rules

Plain, specific, short. No exclamation points, no em dashes. Status labels are literal. See the Voice section of `brand.html`.

## License

Site content and design: copyright Tompkins Software Systems LLC. The fonts are under the SIL Open Font License (see `src/assets/fonts/`). Product licenses are listed on each product page.
