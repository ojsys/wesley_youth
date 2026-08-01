# First UMC & Wesley Foundation — website

The website for First United Methodist Church & Wesley Foundation, Iowa City, with a
built-in content management system so the church can update it without touching code.

No build step, no framework, no npm. Plain HTML/CSS/JS on the front, PHP + SQLite on
the back — it runs on ordinary shared hosting.

---

## What's here

| | |
|---|---|
| **The website** | `index.html` — one page: hero, vision & mission, impact areas, gatherings, photo gallery, contact. |
| **The CMS** | `admin.html` — sign in at `/admin.html` to edit every word and photo on the site. |
| **The backend** | `api.php` — content, contact form, media uploads, revisions. |

### The CMS

A single admin panel, styled after WordPress: sign-in screen, left-hand menu, and a
**Publish changes** button.

- **Nothing is live until you publish.** Edits change a working copy, so a half-typed
  headline never reaches visitors. Unpublished work survives closing the tab.
- **Live preview** — the real site sits beside the editor and updates as you type.
- **Media library** — drag-and-drop photo uploads, stored as real files and reusable
  anywhere.
- **Messages** — an inbox for contact form submissions, kept even if the email fails.
- **History** — the last 30 published versions, one-click restore, plus JSON backups.
- Reorderable lists, per-section show/hide, and password change built in.

Day-to-day instructions for whoever updates the site: **[ADMIN-PAGE-GUIDE.md](ADMIN-PAGE-GUIDE.md)**

---

## Running it locally

You need PHP 7.4+ with PDO SQLite (bundled with PHP on macOS and most Linux distros).

```bash
cp config.sample.php config.php     # then edit it — set a password
php -S 127.0.0.1:8000
```

- Website → <http://127.0.0.1:8000/index.html>
- CMS → <http://127.0.0.1:8000/admin.html>

`data/content.db` is created on first use. Delete it to reset the site to the built-in
default content in `content.js`.

> Opening `index.html` straight from the filesystem also works — it falls back to the
> default content — but the CMS and contact form need PHP running.

## Deploying

See **[DEPLOY-HPANEL.md](DEPLOY-HPANEL.md)** for the full walkthrough (written for
Hostinger hPanel, but it applies to any PHP host). The short version:

1. `cp config.sample.php config.php` and set `WESLEY_ADMIN_PASSWORD`, `WESLEY_SECRET`
   and the contact email addresses.
2. Upload everything to `public_html`, keeping the hidden `.htaccess` files in `data/`
   and `uploads/`.
3. Make `data/` and `uploads/` writable (755).
4. Sign in at `/admin.html` and send a test email from Settings.

---

## How it fits together

```
index.html ─┐                        ┌─ content   (public: the site's JSON)
            ├─ content.js ─ shared   ├─ contact   (public: emails the church)
admin.html ─┘   content model        │
                                     ├─ save / revisions / settings
     both talk to  api.php ──────────┼─ messages  (contact form inbox)
                      │              └─ upload / media
                      ├─ mailer.php ─── PHP mail() or SMTP
                      ├─ data/content.db  (SQLite)
                      └─ uploads/         (photos)
```

`content.js` is the single source of truth for the shape of the site's content — the
defaults every field falls back to, plus a migration step that upgrades older saved
data. Both the website and the CMS load it, so they can't drift apart.

Everything the admin can edit is one JSON document stored in a single SQLite row.

### Security

- `config.php` is git-ignored; the template is `config.sample.php`.
- Admin routes require a signed, expiring token; the password is stored hashed once
  changed from the CMS.
- Uploads are restricted to real image files (verified with `getimagesize`), renamed,
  and `uploads/.htaccess` prevents execution.
- `data/.htaccess` blocks public access to the database.
- The contact form has a hidden spam trap and a per-IP rate limit, and mail headers are
  sanitised against injection.

---

## Notes

- An earlier design of the site (`wesley-foundation-admin.html`) is kept on disk but
  deliberately excluded from this repository — it hardcodes an admin password in
  client-side JavaScript, which is exactly what the current architecture avoids.
