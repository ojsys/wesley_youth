<?php
/* =====================================================================
   First United Methodist Church & Wesley Foundation — configuration
   ---------------------------------------------------------------------
   THIS IS THE TEMPLATE. Copy it to `config.php`, then fill in sections
   1 to 3 below:

       cp config.sample.php config.php

   `config.php` holds your password and database login, and is
   deliberately NOT stored in version control (see .gitignore) — never
   commit it or paste it anywhere public.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1) ADMIN SIGN-IN
   --------------------------------------------------------------------- */

// The password admins type to sign in at /admin.html. CHANGE THIS.

// (You can also change the password later from inside the CMS, under
//  Settings -> Change password. Once you do, this value is ignored.)
define('WESLEY_ADMIN_PASSWORD', 'change-this-password');

// A long random string that keeps sign-ins secure. CHANGE THIS to your own
// random text and never share it. (Changing it signs everyone out.)
// Generate one with:  php -r "echo bin2hex(random_bytes(24));"
define('WESLEY_SECRET', 'change-this-to-a-long-random-string');


/* ---------------------------------------------------------------------
   2) DATABASE
   ---------------------------------------------------------------------
   Create a MySQL database and user in cPanel (MySQL Databases), tick
   ALL PRIVILEGES when adding the user to the database, then paste the
   four values here. cPanel prefixes both names with your account name,
   e.g. 'myaccount_wesley'.

   Leave WESLEY_DB_NAME empty to use a local SQLite file instead
   (data/content.db) -- handy for running the site on a laptop, but use
   MySQL on real hosting so the host's backups include your content.
   --------------------------------------------------------------------- */
define('WESLEY_DB_HOST', 'localhost');
define('WESLEY_DB_PORT', 3306);
define('WESLEY_DB_NAME', '');          // e.g. 'myaccount_wesley'
define('WESLEY_DB_USER', '');          // e.g. 'myaccount_wesley'
define('WESLEY_DB_PASS', '');


/* ---------------------------------------------------------------------
   3) CONTACT FORM EMAIL
   --------------------------------------------------------------------- */

// Where messages from the website contact form are delivered.
// This can also be changed later inside the CMS (Settings -> Contact form).
define('WESLEY_CONTACT_TO', 'odanladi@icfirstchurch.org');

// The "From" address the website sends with. IMPORTANT: for mail to actually
// arrive (and not land in spam) this MUST be an address on your own domain.
// Create it in hPanel -> Emails if it doesn't exist yet.
define('WESLEY_CONTACT_FROM', 'website@icfirstchurch.org');
define('WESLEY_CONTACT_FROM_NAME', 'First UMC & Wesley Foundation Website');

/* Optional: send through SMTP instead of PHP's built-in mail().
   Leave WESLEY_SMTP_HOST empty ('') to use PHP mail() -- that works on most
   hosting including Hostinger. Fill these in only if mail() is disabled or
   messages aren't arriving. Use the mailbox credentials from hPanel -> Emails. */
define('WESLEY_SMTP_HOST', '');                 // e.g. 'smtp.hostinger.com'
define('WESLEY_SMTP_PORT', 465);                // 465 = SSL, 587 = STARTTLS
define('WESLEY_SMTP_SECURE', 'ssl');            // 'ssl' | 'tls' | ''
define('WESLEY_SMTP_USER', '');                 // e.g. 'website@icfirstchurch.org'
define('WESLEY_SMTP_PASS', '');                 // that mailbox's password


/* ---- You normally do not need to change anything below this line ---- */

// How long an editor stays signed in, in seconds (default 12 hours).
define('WESLEY_TOKEN_TTL', 60 * 60 * 12);

// Where the SQLite database file is stored (created automatically).
// Kept in the protected /data folder so visitors can't download it.
define('WESLEY_DB', __DIR__ . '/data/content.db');

// Where photos uploaded through the CMS media library are stored.
define('WESLEY_UPLOAD_DIR', __DIR__ . '/uploads');
define('WESLEY_UPLOAD_URL', 'uploads');

// Largest single upload accepted, in bytes (8 MB).
define('WESLEY_MAX_UPLOAD', 8 * 1024 * 1024);

// How many past versions of the site content to keep for one-click restore.
define('WESLEY_REVISIONS', 30);

// Anti-spam: max contact messages accepted from one IP address per hour.
define('WESLEY_CONTACT_RATE', 5);
