<?php
/* =====================================================================
   One-time move from the old SQLite file into MySQL.

   Run this once, after filling the WESLEY_DB_* values into config.php,
   if the site already had content saved in data/content.db.

     From a terminal:   php migrate.php
     Or in a browser:   https://yourdomain.com/migrate.php
                        (it will ask you to confirm with a one-time code
                         it writes into data/migrate-key.txt)

   It copies content, revisions, messages, settings and media records
   across. Running it twice is safe -- it never duplicates rows, and by
   default it will not overwrite a MySQL database that already has page
   content in it (pass --force / &force=1 if you really mean to).

   DELETE THIS FILE once the migration is done.
   ===================================================================== */

require __DIR__ . '/config.php';
require __DIR__ . '/db.php';

$cli = (php_sapi_name() === 'cli');

/* ---------------------------------------------------------------------
   Proving you are the site owner.

   From a terminal there is nothing to prove -- you already have shell
   access. In a browser, this script writes a one-time code into
   data/migrate-key.txt and asks you to paste it back. Reading that file
   needs File Manager or FTP, which only the owner has, and the folder's
   .htaccess stops anyone fetching it over the web.

   The code is sent as a form POST, never in the address bar, so it stays
   out of server logs and browser history. WESLEY_SECRET is deliberately
   NOT used here: it signs admin sign-in tokens, and anything that ends up
   in a URL ends up in a log file.
   --------------------------------------------------------------------- */
function migrate_key_path(): string { return dirname(WESLEY_DB) . '/migrate-key.txt'; }

function migrate_key_issue(): ?string {
    $dir = dirname(migrate_key_path());
    if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
    $key = bin2hex(random_bytes(8));
    if (@file_put_contents(migrate_key_path(), $key . "\n") === false) return null;
    @chmod(migrate_key_path(), 0600);
    return $key;
}

function migrate_page(string $title, string $bodyHtml): void {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
       . '<title>' . htmlspecialchars($title) . '</title>'
       . '<style>body{font-family:system-ui,sans-serif;max-width:38rem;margin:3rem auto;padding:0 1.2rem;'
       . 'line-height:1.6;color:#201C17}h1{font-size:1.3rem}code{background:#F3F0E8;padding:.1rem .3rem;'
       . 'border-radius:4px}input[type=text]{width:100%;padding:.6rem;font-size:1rem;border:1px solid #ccc;'
       . 'border-radius:8px}button{margin-top:.8rem;padding:.7rem 1.2rem;font-size:1rem;border:0;'
       . 'border-radius:8px;background:#141210;color:#FBCB2E;cursor:pointer}pre{background:#F3F0E8;'
       . 'padding:1rem;border-radius:8px;white-space:pre-wrap}.warn{color:#C0392B}</style>'
       . '<h1>' . htmlspecialchars($title) . '</h1>' . $bodyHtml;
    exit;
}

$force = false;

if ($cli) {
    $force = in_array('--force', $argv, true);
} else {
    $given = isset($_POST['key']) ? (string)$_POST['key'] : '';
    $onFile = is_readable(migrate_key_path()) ? trim((string)file_get_contents(migrate_key_path())) : '';

    if ($given === '' || $onFile === '' || !hash_equals($onFile, $given)) {
        $key = migrate_key_issue();
        if ($key === null) {
            migrate_page('Cannot start the migration',
                '<p class="warn">The <code>data/</code> folder is not writable, so this page cannot issue a '
              . 'one-time code.</p><p>Either set that folder to <strong>755</strong> in File Manager and reload, '
              . 'or run the migration from cPanel &rarr; <strong>Terminal</strong> instead:</p>'
              . '<pre>cd ~/public_html &amp;&amp; php migrate.php</pre>');
        }
        migrate_page('Confirm the migration',
            '<p>To prove you own this site, open this file using cPanel&rsquo;s <strong>File Manager</strong> '
          . '(or FTP) and copy the short code inside it:</p>'
          . '<pre>' . htmlspecialchars(migrate_key_path()) . '</pre>'
          . ($given !== '' ? '<p class="warn">That code did not match. A fresh one has just been written &mdash; '
                             . 'reopen the file.</p>' : '')
          . '<form method="post"><label for="k">Paste the code</label>'
          . '<input type="text" id="k" name="key" autocomplete="off" spellcheck="false">'
          . '<label style="display:block;margin-top:.9rem"><input type="checkbox" name="force" value="1"> '
          . 'Overwrite content already in the MySQL database</label>'
          . '<button type="submit">Run the migration</button></form>'
          . '<p style="color:#7A7263;font-size:.9rem">Nothing has been changed yet. '
          . 'Delete <code>migrate.php</code> from the server when you are done.</p>');
    }

    $force = !empty($_POST['force']);
    header('Content-Type: text/plain; charset=utf-8');
    @unlink(migrate_key_path());   // the code is good for one run only
}

function say(string $line): void { echo $line . "\n"; }

/* ---- Checks ---- */
if (wesley_db_driver() !== 'mysql') {
    exit("Nothing to do: config.php has no WESLEY_DB_NAME set, so the site is still using SQLite.\n");
}

$sqlitePath = WESLEY_DB;
if (!file_exists($sqlitePath)) {
    exit("Nothing to migrate: no SQLite file at $sqlitePath.\nThe MySQL tables will be created automatically on first use.\n");
}

say('Source : ' . $sqlitePath);
say('Target : MySQL database ' . WESLEY_DB_NAME . ' on ' . WESLEY_DB_HOST);
say('');

try {
    $old = new PDO('sqlite:' . $sqlitePath, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $new = wesley_db();          // creates the MySQL schema if needed
} catch (Exception $e) {
    exit("Could not open a database: " . $e->getMessage() . "\n");
}

/* Does the old file actually have a given table? */
function has_table(PDO $pdo, string $name): bool {
    $st = $pdo->prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = :n");
    $st->execute([':n' => $name]);
    return (bool)$st->fetchColumn();
}

/* ---- Refuse to clobber a live MySQL database unless asked ---- */
$existing = $new->query('SELECT COUNT(*) FROM content')->fetchColumn();
if ($existing && !$force) {
    exit("The MySQL database already has page content.\n" .
         "Nothing was changed. Re-run with --force (or &force=1) to overwrite it.\n");
}

$new->beginTransaction();
try {
    /* ---- content ---- */
    if (has_table($old, 'content')) {
        $row = $old->query('SELECT json, updated_at FROM content WHERE id = 1')->fetch();
        if ($row) {
            $new->exec('DELETE FROM content WHERE id = 1');
            $st = $new->prepare('INSERT INTO content (id, json, updated_at) VALUES (1, :j, :u)');
            $st->execute([':j' => $row['json'], ':u' => $row['updated_at']]);
            say('content   : 1 row');
        }
    }

    /* ---- revisions ---- */
    if (has_table($old, 'revisions')) {
        $n = 0;
        $rows = $old->query('SELECT json, created_at, note FROM revisions ORDER BY id ASC');
        $st = $new->prepare('INSERT INTO revisions (json, created_at, note) VALUES (:j, :c, :n)');
        $new->exec('DELETE FROM revisions');
        foreach ($rows as $r) {
            $st->execute([':j' => $r['json'], ':c' => $r['created_at'], ':n' => $r['note']]);
            $n++;
        }
        say("revisions : $n rows");
    }

    /* ---- messages ---- */
    if (has_table($old, 'messages')) {
        $n = 0;
        $rows = $old->query('SELECT name, email, subject, body, ip, created_at, is_read, delivered
                             FROM messages ORDER BY id ASC');
        $new->exec('DELETE FROM messages');
        $st = $new->prepare('INSERT INTO messages (name, email, subject, body, ip, created_at, is_read, delivered)
                             VALUES (:n, :e, :s, :b, :ip, :c, :r, :d)');
        foreach ($rows as $r) {
            $st->execute([':n' => $r['name'], ':e' => $r['email'], ':s' => $r['subject'],
                          ':b' => $r['body'], ':ip' => $r['ip'], ':c' => $r['created_at'],
                          ':r' => (int)$r['is_read'], ':d' => (int)$r['delivered']]);
            $n++;
        }
        say("messages  : $n rows");
    }

    /* ---- settings (contact address, password hash) ---- */
    if (has_table($old, 'settings')) {
        $n = 0;
        foreach ($old->query('SELECT key, value FROM settings') as $r) {
            wesley_setting_put($new, $r['key'], $r['value']);
            $n++;
        }
        say("settings  : $n rows");
    }

    /* ---- media records, if the old file had them ---- */
    if (has_table($old, 'media')) {
        $n = 0;
        $st = $new->prepare('INSERT INTO media (filename, mime, width, height, bytes, alt_text, caption, created_at)
                             VALUES (:f, :m, :w, :h, :b, :a, :cap, :c)');
        $new->exec('DELETE FROM media');
        foreach ($old->query('SELECT * FROM media ORDER BY id ASC') as $r) {
            $st->execute([':f' => $r['filename'], ':m' => $r['mime'], ':w' => (int)$r['width'],
                          ':h' => (int)$r['height'], ':b' => (int)$r['bytes'],
                          ':a' => $r['alt_text'], ':cap' => $r['caption'], ':c' => $r['created_at']]);
            $n++;
        }
        say("media     : $n rows");
    }

    $new->commit();
} catch (Exception $e) {
    $new->rollBack();
    exit("\nMigration failed, nothing was changed: " . $e->getMessage() . "\n");
}

say('');
say('Done. The website is now reading from MySQL.');
say('');
say('Next:');
say('  1. Open the site and the CMS and check everything is there.');
say('  2. Keep ' . basename($sqlitePath) . ' somewhere safe as a backup.');
say('  3. DELETE migrate.php from the server.');
