# First UMC & Wesley Foundation — website

The website for First United Methodist Church & Wesley Foundation, Iowa City, with a
built-in content management system so the church can update it without touching code.

No build step, no framework, no npm. Plain HTML/CSS/JS on the front, PHP + MySQL on
the back — it runs on ordinary shared hosting.

---

## What's here

| | |
|---|---|
| **The website** | `index.html` — one page: hero, vision & mission, impact areas, gatherings, photo gallery, contact. |
| **The CMS** | `admin.html` — sign in at **`/admin`** to edit every word and photo on the site. |
| **The backend** | `api.php` + `db.php` — content, contact form, media uploads, revisions. |

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

You need PHP 7.4+ (the PDO drivers it ships with are enough).

```bash
cp config.sample.php config.php     # then edit it — set a password
php -S 127.0.0.1:8000 router.php
```

Leave the `WESLEY_DB_*` values blank and it uses a SQLite file (`data/content.db`), so
there's no database to install locally. Fill them in to run against MySQL instead —
the code is identical either way.

- Website → <http://127.0.0.1:8000/index.html>
- CMS → <http://127.0.0.1:8000/admin>

`router.php` exists only for this: PHP's built-in server ignores `.htaccess`, so it
stands in for the one rewrite the live site uses (serving the CMS at `/admin`). Apache
handles that in production, so `router.php` is never used there.

The database tables are created on first use. Delete `data/content.db` to reset the
site to the built-in default content in `content.js`.

> Opening `index.html` straight from the filesystem also works — it falls back to the
> default content — but the CMS and contact form need PHP running.

## Deploying

See **[DEPLOY-HPANEL.md](DEPLOY-HPANEL.md)** for the full walkthrough (written for
Hostinger hPanel, but it applies to any PHP host). The short version:

1. Create a MySQL database and user in cPanel, and grant the user all privileges.
2. `cp config.sample.php config.php`, then set the `WESLEY_DB_*` values,
   `WESLEY_ADMIN_PASSWORD`, `WESLEY_SECRET` and the contact email addresses.
3. Upload everything to `public_html`, keeping the hidden `.htaccess` files.
4. Make `uploads/` writable (755).
5. Sign in at `/admin` and send a test email from Settings.

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
                      └─ db.php ─────── MySQL, or SQLite when unconfigured
                                          content · revisions · messages
                                          settings · media
                                        uploads/  the photo files themselves
```

`content.js` is the single source of truth for the shape of the site's content — the
defaults every field falls back to, plus a migration step that upgrades older saved
data. Both the website and the CMS load it, so they can't drift apart.

Everything the admin can edit is one JSON document stored in a single database row.
Photos are files in `uploads/`, with a `media` row each holding dimensions, alt text
and caption.

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

---

## Notes

- An earlier design of the site (`wesley-foundation-admin.html`) is kept on disk but
  deliberately excluded from this repository — it hardcodes an admin password in
  client-side JavaScript, which is exactly what the current architecture avoids.
