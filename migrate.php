<?php
/* =====================================================================
   One-time move from the old SQLite file into MySQL.

   Run this once, after filling the WESLEY_DB_* values into config.php,
   if the site already had content saved in data/content.db.

     From a terminal:   php migrate.php
     Or in a browser:   https://yourdomain.com/migrate.php?key=YOUR_SECRET

   It copies content, revisions, messages, settings and media records
   across. Running it twice is safe -- it never duplicates rows, and by
   default it will not overwrite a MySQL database that already has page
   content in it (pass --force / &force=1 if you really mean to).

   DELETE THIS FILE once the migration is done.
   ===================================================================== */

require __DIR__ . '/config.php';
require __DIR__ . '/db.php';

$cli = (php_sapi_name() === 'cli');

/* ---- Only the site owner may run this ---- */
if (!$cli) {
    header('Content-Type: text/plain; charset=utf-8');
    $key = isset($_GET['key']) ? (string)$_GET['key'] : '';
    if (!hash_equals(WESLEY_SECRET, $key)) {
        http_response_code(403);
        exit("Forbidden.\n\nAdd ?key=<the WESLEY_SECRET value from config.php> to the address.\n");
    }
}
$force = $cli
    ? in_array('--force', $argv, true)
    : !empty($_GET['force']);

function say($line) { echo $line . "\n"; }

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
function has_table(PDO $pdo, $name) {
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
