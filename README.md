# First UMC & Wesley Foundation — website

The website for First United Methodist Church & Wesley Foundation, Iowa City, with a
built-in content management system so the church can build and update it without
touching code.

No build step, no framework, no npm. Plain HTML/CSS/JS on the front, PHP + MySQL on
the back — it runs on ordinary shared hosting.

---

## What's here

| | |
|---|---|
| **The website** | `index.html` — a shell that draws whichever page the address asks for. |
| **The CMS** | `admin.html` — sign in at **`/admin`** to build pages and edit every word and photo. |
| **The block library** | `blocks.js` — every kind of section and element, and the settings each one offers. |
| **The renderer** | `render.js` — turns a page into HTML. Used by the website *and* the editor. |
| **The look** | `theme.css` — shared by the site and the editing canvas. |
| **The content model** | `content.js` — the shape of the site, its defaults, and upgrades for older saved data. |
| **The backend** | `api.php` + `db.php` — content, contact form, media uploads, revisions. |

### The CMS

A WordPress-style page builder. Pages are made of **sections**; a section is either one
of the ready-made kinds (a hero, the gatherings grid, a photo gallery…) or a blank one
you fill with **rows**, **columns** and **elements** — headings, text, images, buttons,
icons, galleries, sliders, accordions, forms and more.

- **You edit on the real page.** The middle of the builder is the actual website in a
  frame. Click any part of it to select that part; the panel on the right edits it; the
  page updates as you type. There is no separate "preview" to disagree with the result.
- **Nothing is live until you publish.** Edits change a working copy, so a half-typed
  headline never reaches visitors. Unpublished work survives closing the tab.
- **Pages have real addresses** — `/about`, `/give`, `/events`. Add, rename and delete
  them from the builder; any page can be made the home page.
- **Media library** — drag-and-drop photo uploads, stored as real files and reusable
  anywhere.
- **Messages** — an inbox for contact form submissions, kept even if the email fails.
- **History** — the last 30 published versions, one-click restore, plus JSON backups.

Day-to-day instructions for whoever updates the site: **[ADMIN-PAGE-GUIDE.md](ADMIN-PAGE-GUIDE.md)**

---

## Running it locally

You need PHP 7.4+ (the PDO drivers it ships with are enough).

```bash
cp config.sample.php config.php     # then edit it — set a password
php -S 127.0.0.1:8000 router.php
```

Leave the `WESLEY_DB_*` values blank and it uses a SQLite file (`data/content.db`), so
there's no database to install locally. Fill them in to run against MySQL instead —
the code is identical either way.

- Website → <http://127.0.0.1:8000/>
- A page you have made → <http://127.0.0.1:8000/about-us>
- CMS → <http://127.0.0.1:8000/admin>

`router.php` exists only for this: PHP's built-in server ignores `.htaccess`, so it
stands in for the two rewrites the live site uses — serving the CMS at `/admin`, and
handing a page's address to `index.html`. Apache handles both in production, so
`router.php` is never used there.

The database tables are created on first use. Delete `data/content.db` to reset the
site to the built-in default content.

> Opening `index.html` straight from the filesystem shows the default home page, but
> the CMS, the contact form and other pages need PHP running.

## Deploying

See **[DEPLOY-HPANEL.md](DEPLOY-HPANEL.md)** for the full walkthrough (written for
Hostinger hPanel, but it applies to any PHP host). The short version:

1. Create a MySQL database and user in cPanel, and grant the user all privileges.
2. `cp config.sample.php config.php`, then set the `WESLEY_DB_*` values,
   `WESLEY_ADMIN_PASSWORD`, `WESLEY_SECRET` and the contact email addresses.
3. Upload everything to `public_html`, keeping the hidden `.htaccess` files.
4. Make `uploads/` writable (755).
5. Sign in at `/admin` and send a test email from Settings.

`mod_rewrite` must be on, or pages other than the home page will 404. It is on by
default on essentially all shared hosting.

---

## How it fits together

```
                    ┌─ blocks.js   what a section or element is,
                    │              and what settings it offers
index.html ─────────┼─ content.js  the shape of the site + upgrades
 (the page shell)   │              for older saved data
                    ├─ render.js   a page  ->  HTML
admin.html ─────────┤              (the site AND the editing canvas)
 (the builder)      └─ theme.css   one stylesheet for both

     both talk to  api.php ──────┬─ content   (public: the site's JSON)
                      │          ├─ contact   (public: emails the church)
                      │          ├─ save / revisions / settings
                      │          ├─ messages  (contact form inbox)
                      │          └─ upload / media
                      ├─ mailer.php ─── PHP mail() or SMTP
                      └─ db.php ─────── MySQL, or SQLite when unconfigured
                                          content · revisions · messages
                                          settings · media
                                        uploads/  the photo files themselves
```

The editor draws the page with the *same* `render.js` the website uses, loaded in a
frame with `?edit=1`. That is why what an editor sees is what visitors get: there is
only one piece of code that draws anything.

Everything the admin can edit is one JSON document stored in a single database row:

```
content
  brand      logo, name, tab title            (site-wide)
  nav        the menu across the top          (site-wide)
  contact    address, email, phone, socials   (site-wide)
  footer     the bottom of every page         (site-wide)
  pages[]    id, title, slug, seo, sections[]
               section -> style + data
               a blank section's data is rows[] -> columns[] -> elements[]
```

Photos are files in `uploads/`, with a `media` row each holding dimensions, alt text
and caption.

### Adding a new kind of block

Two steps, and the CMS picks it up on its own:

1. Add an entry to `BLOCKS.elements` (or `BLOCKS.sections`) in `blocks.js` — its label,
   icon, default content, and the `fields` it offers.
2. Add a renderer for it in `render.js`.

The editing panel is generated from `fields`, so there is no CMS code to write.

### Upgrading older content

`content.js` reads whatever is in the database and returns the current shape. Content
saved by the earlier one-page version of the site — where the six sections were fixed
top-level keys — is turned into a Home page made of those same six sections, in the
same order, with the same look. Hidden sections stay hidden, the old hero slideshow's
first photo becomes the still background, and the address, phone and social links move
to the site-wide `contact` record. Nothing is lost and nothing has to be re-entered.

The upgrade also adds the two pages a church site is always asked for next — **About**
(`/about`) and **Contact** (`/contact`) — already written and wired into the menu.
They are ordinary pages: edit or delete them like any other. They come from
`aboutPage()` and `contactPage()` in `content.js`, and a fresh install gets them too.

A section whose kind this copy of the site does not recognise is **carried through
untouched** rather than dropped, so opening the site with an older copy of the code and
publishing cannot destroy content built by a newer one. The renderer skips what it
cannot draw; the editor shows it as a stub you can remove.

### Security

- `config.php` holds the database login and admin password; it is git-ignored, and the
  template is `config.sample.php`.
- Database errors are logged server-side, never shown to visitors.
- Admin routes require a signed, expiring token; the password is stored hashed once
  changed from the CMS.
- Uploads are restricted to real image files (verified with `getimagesize`), renamed,
  and `uploads/.htaccess` prevents execution.
- `data/.htaccess` blocks public access to the SQLite file when one is in use.
- The contact form has a hidden spam trap and a per-IP rate limit, and mail headers are
  sanitised against injection.
- Text written in the editor is escaped when rendered; rich text has scripts, inline
  event handlers and `javascript:` links stripped, and link targets are checked. The
  one exception is the **Custom code** element, which exists to hold embed codes and is
  deliberately passed through — only a signed-in administrator can reach it.

---

## Notes

- An earlier design of the site (`wesley-foundation-admin.html`) is kept on disk but
  deliberately excluded from this repository — it hardcodes an admin password in
  client-side JavaScript, which is exactly what the current architecture avoids.
