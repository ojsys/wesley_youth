# Deploying the site to Hostinger (hPanel)

The website is a small **PHP + MySQL** application. Content is edited in a proper admin
panel at `/admin`, stored in your hosting account's database, and shown to every
visitor on every device.

Photos are kept as ordinary files in `uploads/`, with a record of each one in the
database (dimensions, alt text, caption). That is how WordPress does it, and it keeps
pages fast — images are served straight by the web server and cached by browsers.

## Files in this project

| File | What it is |
|------|-----------|
| `index.html` | The public website — it draws whichever page the address asks for. |
| `admin.html` | The **Website Manager** (the CMS). Visit **`/admin`** to sign in. |
| `.htaccess` | Apache settings — this is what makes `/admin` and the page addresses work. Hidden file; make sure it uploads. |
| `blocks.js` | Every kind of section and element the builder offers. Don't edit by hand. |
| `content.js` | The shared content model used by both pages. Don't edit by hand. |
| `render.js` | Draws a page. Used by the website and the editor alike. Don't edit by hand. |
| `theme.css` | How the website looks. |
| `favicon.svg` | The built-in browser tab icon, used until a different one is set in the CMS. |
| `api.php` | The backend (content, messages, uploads, revisions). |
| `db.php` | Talks to the database. Creates the tables on first use. |
| `mailer.php` | Sends the contact form emails. |
| `migrate.php` | One-time move of old SQLite content into MySQL. Delete it afterwards. |
| `config.sample.php` | The template for the settings file. |
| `config.php` | Your password and email settings. **Create and edit before uploading** (see Step 1). Never share it or commit it to GitHub. |
| `data/` | Only used if you run without MySQL (holds a SQLite file). Its `.htaccess` blocks public downloads. |
| `uploads/` | Photos uploaded through the CMS + an `.htaccess` that stops anything there being executed. |

`wesley-foundation-admin.html` is an **older, superseded design** kept for reference.
Do not upload it.

---

## Step 1 — Create `config.php`

The project ships with `config.sample.php` as a template. Make your own copy of it and
name it `config.php` — that's the file the site actually reads:

```bash
cp config.sample.php config.php
```

(In hPanel's File Manager: right-click `config.sample.php` → **Copy**, then rename the
copy to `config.php`.)

Now open `config.php` and fill in the values below.

### Password

```php
define('WESLEY_ADMIN_PASSWORD', 'change-this-password');          // <- your admin password
define('WESLEY_SECRET', 'change-this-to-a-long-random-string');  // <- any long random text
```

- **WESLEY_ADMIN_PASSWORD** — what admins type at `/admin`.
  (It can also be changed later inside the CMS, under Settings.)
- **WESLEY_SECRET** — secures sign-ins. Change it to your own long random text (mash
  the keyboard). Changing it later just signs editors out.

### Database

First create it in your control panel:

1. Open **MySQL Databases** (hPanel: **Databases → Management**).
2. **Create a database** — call it something like `wesley`. The panel adds your account
   name as a prefix, so it becomes e.g. `myaccount_wesley`. Note the full name.
3. **Create a user** with a strong password. Same prefixing applies.
4. **Add the user to the database** and tick **ALL PRIVILEGES**.

Then paste all four values into `config.php`:

```php
define('WESLEY_DB_HOST', 'localhost');
define('WESLEY_DB_PORT', 3306);
define('WESLEY_DB_NAME', 'myaccount_wesley');   // the FULL name, with the prefix
define('WESLEY_DB_USER', 'myaccount_wesley');
define('WESLEY_DB_PASS', 'the password you just set');
```

The tables are created automatically the first time the site runs — there is no SQL
file to import.

> Use the full prefixed names. `wesley` on its own will not connect; it must be
> `myaccount_wesley`. This is the single most common mistake here.

> Leaving `WESLEY_DB_NAME` empty makes the site fall back to a SQLite file in `data/`.
> That is meant for running the site on a laptop. On real hosting use MySQL, so your
> content is inside the backups your host already takes.

### Contact form email

```php
define('WESLEY_CONTACT_TO',   'odanladi@icfirstchurch.org');  // where messages go
define('WESLEY_CONTACT_FROM', 'website@icfirstchurch.org');   // who they come from
```

**`WESLEY_CONTACT_FROM` must be a real mailbox on your own domain.** Create it in
hPanel → **Emails** if it doesn't exist. Sending "from" a Gmail or an address on
someone else's domain is the number one reason contact form emails land in spam or
never arrive.

`WESLEY_CONTACT_TO` can be changed later in the CMS under **Settings → Contact form**;
the value here is just the starting point.

---

## Step 2 — Upload to hPanel

In hPanel → **File Manager**, open `public_html` (or your domain's folder) and upload
so the structure looks like this:

```
public_html/
├── .htaccess           <- hidden; makes /admin and your page addresses work
├── index.html
├── admin.html
├── blocks.js
├── content.js
├── render.js
├── theme.css
├── favicon.svg
├── api.php
├── db.php
├── mailer.php
├── config.php          <- the copy you made and edited in Step 1
├── data/
│   └── .htaccess
└── uploads/
    └── .htaccess
```

Tips:
- Easiest way: zip the project, **Upload**, then **Extract** in File Manager.
- All the files must sit in the **same folder**.
- Make sure all three hidden `.htaccess` files came along — turn on "show hidden files"
  in File Manager if you don't see them. They matter: they give you the `/admin`
  address and the addresses of the pages you build, and they stop visitors downloading
  your database or running anything uploaded.
- Apache's **mod_rewrite** must be switched on, or every page except the home page will
  show "404 Not Found". It is on by default on Hostinger and essentially all shared
  hosting — if pages 404 after uploading, that is the first thing to check.

> **Upgrading an existing site?** `blocks.js`, `render.js` and `theme.css` are *new*
> files, not replacements. A File Manager upload that only overwrites the files already
> on the server will silently miss them, and the website cannot draw anything without
> them. If that happens the site now says exactly which file is missing instead of
> showing a blank page — upload it and reload. **Nothing is ever lost this way:** your
> content lives in the database, not in these files.
- `router.php` is only for running the site on a laptop. You don't need to upload it
  (it does no harm if you do).

---

## Step 3 — Permissions

`uploads/` must be writable so the CMS can save photos. Usually this works out of the
box. If uploading fails, in File Manager right-click the folder → **Permissions** →
set to **755** (or 775). The same applies to `data/` only if you are running without
MySQL.

---

## Step 3b — Only if the site already had content

**Skip this entirely on a fresh install** — if there is no old `data/content.db` with
pages and messages in it, there is nothing to migrate. Just delete `migrate.php` from
the server.

If the site *was* previously running the SQLite version, move that content into MySQL
once. From cPanel → **Terminal** (or SSH):

```bash
cd ~/public_html && php migrate.php
```

No terminal on your plan? Open `https://yourdomain.com/migrate.php` in a browser. It
will ask you to confirm you own the site:

1. It writes a short one-time code into `data/migrate-key.txt`.
2. Open that file in **File Manager** and copy the code.
3. Paste it into the page and press **Run the migration**.

That proves you have File Manager access, which only you do. The code works once and is
deleted afterwards.

It copies content, revisions, messages, settings (including your changed password) and
photo records across. It refuses to overwrite a MySQL database that already has content
unless you tick the overwrite box (or pass `--force` on the command line).

**Then delete `migrate.php` from the server.**

---

## Step 4 — Check it works

1. Visit your domain — the website should appear.
2. Visit `yourdomain.com/admin` and sign in. **Settings → Storage** should say your
   content is in the MySQL database.
3. Go to **Settings → Send a test email**. Check the inbox of
   `odanladi@icfirstchurch.org` **and its spam folder**.
4. Change something small and press **Publish changes**, then reload the website.

Hand **`ADMIN-PAGE-GUIDE.md`** to whoever will be updating the site day to day.

---

## If the site says the database is unavailable

The site shows *"The website database is unavailable"* when it cannot connect. In order:

1. **Use the full prefixed names.** cPanel creates `myaccount_wesley`, not `wesley`.
   Both the database name and the username need the prefix.
2. **Add the user to the database.** Creating a database and creating a user are two
   separate steps; the third step, adding the user to the database with **ALL
   PRIVILEGES**, is easy to miss.
3. **Check the password** for typos — retype it rather than pasting.
4. **Host** is `localhost` on almost all shared hosting. A few hosts use a separate
   database server; if yours does, the panel will tell you the hostname.

The exact error is written to your PHP error log (visible in cPanel → **Errors**), and
deliberately not shown in the browser so your credentials can't leak.

---

## If contact form emails don't arrive

In order, check:

1. **The spam folder.** First messages from a new domain often land there.
2. **`WESLEY_CONTACT_FROM` is a real mailbox on your domain** (hPanel → Emails).
3. **SPF/DKIM** are set for the domain (hPanel → Emails → DNS settings). Hostinger sets
   these up automatically for mailboxes it hosts.
4. Still nothing? Switch to SMTP. In `config.php`:

   ```php
   define('WESLEY_SMTP_HOST',   'smtp.hostinger.com');
   define('WESLEY_SMTP_PORT',   465);
   define('WESLEY_SMTP_SECURE', 'ssl');
   define('WESLEY_SMTP_USER',   'website@icfirstchurch.org');
   define('WESLEY_SMTP_PASS',   'that mailbox password');
   ```

   Then send another test email. Leave `WESLEY_SMTP_HOST` empty to go back to PHP's
   built-in mail.

Messages are **always** saved to the CMS inbox (**Messages**) whether or not the email
goes out, so nothing is ever lost while you sort this out. A message that couldn't be
emailed is tagged *not emailed* in the list.

---

## Backups

- In the CMS: **History → Download a backup** saves all the page content as one file.
- **History** also keeps the last 30 published versions for one-click restore.
- A full backup is **two things**: an export of the MySQL database (hPanel →
  phpMyAdmin → Export, or the panel's own backup tool) *and* a copy of the `uploads/`
  folder. The database holds the pages, messages and photo details; `uploads/` holds
  the photos themselves. One without the other is not a complete backup.

---

## How it works (for reference)

Public endpoints:
- `GET  api.php?action=content` → the site content as JSON.
- `POST api.php {action:"contact", …}` → emails the contact form + stores a copy.

Admin endpoints (all need a token from `action:"login"`): `save`, `messages`,
`message_read`, `message_delete`, `upload`, `media`, `media_update`, `media_delete`,
`revisions`, `revision_restore`, `settings`, `settings_save`, `change_password`,
`test_email`, `stats`.

Tables: `content` (the whole page as one JSON row), `revisions`, `messages`,
`settings`, `media`. All created automatically by `db.php` on first use.

## Requirements

- PHP 7.4+ with **PDO MySQL** (enabled by default on Hostinger and cPanel).
- A **MySQL / MariaDB database**, created in your control panel.
- **HTTPS** turned on in hPanel, so passwords and messages are encrypted in transit.

## Security notes

- Change `WESLEY_ADMIN_PASSWORD` and `WESLEY_SECRET` before going live.
- Uploads are restricted to real image files (JPG/PNG/GIF/WEBP), renamed, and the
  `uploads/.htaccess` prevents anything in there from being executed.
- The contact form has a hidden spam trap and accepts at most 5 messages an hour from
  the same visitor.
