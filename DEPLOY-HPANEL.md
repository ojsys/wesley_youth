# Deploying the site to Hostinger (hPanel)

The website is a small **PHP + SQLite** application. Content is edited in a proper
admin panel (`admin.html`), stored on the server, and shown to every visitor on every
device. There is no database server to set up.

## Files in this project

| File | What it is |
|------|-----------|
| `index.html` | The public website. |
| `admin.html` | The **Website Manager** (the CMS). Visit **`/admin`** to sign in. |
| `.htaccess` | Apache settings — this is what makes `/admin` work. Hidden file; make sure it uploads. |
| `content.js` | The shared content model used by both pages. Don't edit by hand. |
| `api.php` | The backend (content, messages, uploads, revisions). |
| `mailer.php` | Sends the contact form emails. |
| `config.sample.php` | The template for the settings file. |
| `config.php` | Your password and email settings. **Create and edit before uploading** (see Step 1). Never share it or commit it to GitHub. |
| `data/` | The SQLite database (`content.db`, created automatically) + an `.htaccess` that blocks public downloads. |
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
├── .htaccess           <- hidden; makes /admin work
├── index.html
├── admin.html
├── content.js
├── api.php
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
  address, and they stop visitors downloading your database or running anything
  uploaded.
- `router.php` is only for running the site on a laptop. You don't need to upload it
  (it does no harm if you do).

---

## Step 3 — Permissions

`data/` and `uploads/` must be writable so PHP can create the database and save
photos. Usually this works out of the box. If saving or uploading fails, in File
Manager right-click each folder → **Permissions** → set to **755** (or 775).

---

## Step 4 — Check it works

1. Visit your domain — the website should appear.
2. Visit `yourdomain.com/admin` and sign in.
3. Go to **Settings → Send a test email**. Check the inbox of
   `odanladi@icfirstchurch.org` **and its spam folder**.
4. Change something small and press **Publish changes**, then reload the website.

Hand **`ADMIN-PAGE-GUIDE.md`** to whoever will be updating the site day to day.

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

- In the CMS: **History → Download a backup** saves everything as one file.
- **History** also keeps the last 30 published versions for one-click restore.
- From hPanel you can download `data/content.db` (all content and messages) and the
  `uploads/` folder (all photos) as a raw backup.

---

## How it works (for reference)

Public endpoints:
- `GET  api.php?action=content` → the site content as JSON.
- `POST api.php {action:"contact", …}` → emails the contact form + stores a copy.

Admin endpoints (all need a token from `action:"login"`): `save`, `messages`,
`message_read`, `message_delete`, `upload`, `media`, `media_delete`, `revisions`,
`revision_restore`, `settings`, `settings_save`, `change_password`, `test_email`,
`stats`.

Content lives as one JSON row in `data/content.db` (SQLite), alongside tables for
messages, revisions and settings.

## Requirements

- PHP 7.4+ with **PDO SQLite** (enabled by default on Hostinger).
- **HTTPS** turned on in hPanel, so passwords and messages are encrypted in transit.

## Security notes

- Change `WESLEY_ADMIN_PASSWORD` and `WESLEY_SECRET` before going live.
- Uploads are restricted to real image files (JPG/PNG/GIF/WEBP), renamed, and the
  `uploads/.htaccess` prevents anything in there from being executed.
- The contact form has a hidden spam trap and accepts at most 5 messages an hour from
  the same visitor.
