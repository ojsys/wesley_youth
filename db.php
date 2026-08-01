<?php
/* =====================================================================
   Database layer.

   Talks to MySQL when database credentials are filled in in config.php,
   and falls back to a local SQLite file when they are not. That keeps
   production on the cPanel MySQL database (backed up by the host, visible
   in phpMyAdmin) while the site still runs on a laptop with nothing to
   install.

   The two engines differ in only a handful of places; everything that is
   not portable SQL is isolated in this file.

     wesley_db()          the shared PDO handle, schema created on demand
     wesley_db_driver()   'mysql' | 'sqlite'
     wesley_upsert(...)   insert-or-update, written for the active engine
   ===================================================================== */

function wesley_db_driver() {
    return (defined('WESLEY_DB_HOST') && WESLEY_DB_HOST !== '' &&
            defined('WESLEY_DB_NAME') && WESLEY_DB_NAME !== '')
        ? 'mysql' : 'sqlite';
}

function wesley_db() {
    static $pdo = null;
    if ($pdo) return $pdo;

    if (wesley_db_driver() === 'mysql') {
        $port = defined('WESLEY_DB_PORT') && WESLEY_DB_PORT ? (int)WESLEY_DB_PORT : 3306;
        $dsn  = 'mysql:host=' . WESLEY_DB_HOST . ';port=' . $port .
                ';dbname=' . WESLEY_DB_NAME . ';charset=utf8mb4';
        $pdo  = new PDO($dsn, WESLEY_DB_USER, WESLEY_DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } else {
        $path = WESLEY_DB;
        $dir  = dirname($path);
        if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL');
    }

    wesley_db_schema($pdo);
    return $pdo;
}

/* ---------------------------------------------------------------------
   Schema. Created on first use so there is no separate install step.
   --------------------------------------------------------------------- */
function wesley_db_schema(PDO $pdo) {
    static $done = false;
    if ($done) return;
    $done = true;

    if (wesley_db_driver() === 'mysql') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS content (
            id         TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            json       LONGTEXT NOT NULL,
            updated_at VARCHAR(32) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS revisions (
            id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            json       LONGTEXT NOT NULL,
            created_at VARCHAR(32) NOT NULL,
            note       VARCHAR(160) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS messages (
            id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name       VARCHAR(160) NOT NULL,
            email      VARCHAR(255) NOT NULL,
            subject    VARCHAR(255) NULL,
            body       TEXT NOT NULL,
            ip         VARCHAR(45) NULL,
            created_at VARCHAR(32) NOT NULL,
            is_read    TINYINT(1) NOT NULL DEFAULT 0,
            delivered  TINYINT(1) NOT NULL DEFAULT 0,
            INDEX idx_messages_ip_time (ip, created_at),
            INDEX idx_messages_unread (is_read)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS settings (
            `key`  VARCHAR(64) NOT NULL PRIMARY KEY,
            value  TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS media (
            id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            filename   VARCHAR(255) NOT NULL UNIQUE,
            mime       VARCHAR(64) NOT NULL,
            width      INT UNSIGNED NOT NULL DEFAULT 0,
            height     INT UNSIGNED NOT NULL DEFAULT 0,
            bytes      INT UNSIGNED NOT NULL DEFAULT 0,
            alt_text   VARCHAR(255) NOT NULL DEFAULT \'\',
            caption    VARCHAR(255) NOT NULL DEFAULT \'\',
            created_at VARCHAR(32) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    } else {
        $pdo->exec('CREATE TABLE IF NOT EXISTS content (
            id         INTEGER PRIMARY KEY CHECK (id = 1),
            json       TEXT NOT NULL,
            updated_at TEXT NOT NULL )');

        $pdo->exec('CREATE TABLE IF NOT EXISTS revisions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            json       TEXT NOT NULL,
            created_at TEXT NOT NULL,
            note       TEXT )');

        $pdo->exec('CREATE TABLE IF NOT EXISTS messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            email      TEXT NOT NULL,
            subject    TEXT,
            body       TEXT NOT NULL,
            ip         TEXT,
            created_at TEXT NOT NULL,
            is_read    INTEGER NOT NULL DEFAULT 0,
            delivered  INTEGER NOT NULL DEFAULT 0 )');

        $pdo->exec('CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL )');

        $pdo->exec('CREATE TABLE IF NOT EXISTS media (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            filename   TEXT NOT NULL UNIQUE,
            mime       TEXT NOT NULL,
            width      INTEGER NOT NULL DEFAULT 0,
            height     INTEGER NOT NULL DEFAULT 0,
            bytes      INTEGER NOT NULL DEFAULT 0,
            alt_text   TEXT NOT NULL DEFAULT \'\',
            caption    TEXT NOT NULL DEFAULT \'\',
            created_at TEXT NOT NULL )');
    }
}

/* ---------------------------------------------------------------------
   Helpers for the places where the two engines disagree.
   --------------------------------------------------------------------- */

// `key` is a reserved word in MySQL and has to be quoted; SQLite is happy
// with the bare name but accepts double quotes too.
function wesley_q($identifier) {
    return wesley_db_driver() === 'mysql' ? '`' . $identifier . '`' : '"' . $identifier . '"';
}

// Insert a settings row, or update it if the key already exists.
function wesley_setting_put(PDO $pdo, $key, $value) {
    $k = wesley_q('key');
    if (wesley_db_driver() === 'mysql') {
        $sql = "INSERT INTO settings ($k, value) VALUES (:k, :v)
                ON DUPLICATE KEY UPDATE value = VALUES(value)";
    } else {
        $sql = "INSERT INTO settings ($k, value) VALUES (:k, :v)
                ON CONFLICT($k) DO UPDATE SET value = :v";
    }
    $pdo->prepare($sql)->execute([':k' => $key, ':v' => (string)$value]);
}

// Trim the revisions table to the newest $keep rows. MySQL will not let a
// DELETE subquery read the table being deleted from, so the ids are read
// out first.
function wesley_trim_revisions(PDO $pdo, $keep) {
    $keep = (int)$keep;
    $ids = $pdo->query("SELECT id FROM revisions ORDER BY id DESC LIMIT $keep")
               ->fetchAll(PDO::FETCH_COLUMN);
    if (!$ids) return;
    $in = implode(',', array_map('intval', $ids));
    $pdo->exec("DELETE FROM revisions WHERE id NOT IN ($in)");
}
