<?php
/* =====================================================================
   Content API for the First UMC & Wesley Foundation website.

   Public (no sign-in)
     GET  api.php?action=content              -> { content, updated_at }
     POST api.php {action:"contact", ...}     -> { ok:true }

   Admin (needs a token from action:"login")
     POST api.php {action:"login", password}  -> { token, expires }
     POST api.php {action:"save", token, content}
     GET  api.php?action=messages&token=...   -> { messages:[...] }
     POST api.php {action:"message_read"|"message_delete", token, id}
     POST api.php {action:"upload", ...}      (multipart: token + file)
     GET  api.php?action=media&token=...      -> { media:[...] }
     POST api.php {action:"media_delete", token, name}
     GET  api.php?action=revisions&token=...  -> { revisions:[...] }
     POST api.php {action:"revision_restore", token, id}
     GET  api.php?action=settings&token=...   -> { settings:{...} }
     POST api.php {action:"settings_save", token, settings}
     POST api.php {action:"change_password", token, current, new}
     GET  api.php?action=stats&token=...      -> dashboard counters

   No external libraries -- PHP with PDO SQLite (standard on Hostinger).
   ===================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// config.php holds the password and is not kept in version control.
// A fresh copy of the project has to have one made from the template.
if (!file_exists(__DIR__ . '/config.php')) {
    http_response_code(500);
    echo json_encode(['error' => 'Setup needed: copy config.sample.php to config.php and set your password.']);
    exit;
}

require __DIR__ . '/config.php';
require __DIR__ . '/db.php';
require __DIR__ . '/mailer.php';

function out($obj, $code = 200) {
    http_response_code($code);
    echo json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/* =====================================================================
   Database  (MySQL when configured, SQLite otherwise -- see db.php)
   ===================================================================== */
function db() {
    try {
        return wesley_db();
    } catch (Exception $e) {
        // Never leak credentials or table names to the browser.
        error_log('Wesley CMS database error: ' . $e->getMessage());
        out(['error' => 'The website database is unavailable. Check the database settings in config.php.'], 500);
    }
}

function setting_get($key, $default = null) {
    $st = db()->prepare('SELECT value FROM settings WHERE ' . wesley_q('key') . ' = :k');
    $st->execute([':k' => $key]);
    $v = $st->fetchColumn();
    return $v === false ? $default : $v;
}
function setting_set($key, $value) {
    wesley_setting_put(db(), $key, $value);
}

/* =====================================================================
   Auth -- stateless signed tokens, no session storage needed
   ===================================================================== */
function password_ok($candidate) {
    $hash = setting_get('password_hash');
    if ($hash) return password_verify((string)$candidate, $hash);
    return hash_equals(WESLEY_ADMIN_PASSWORD, (string)$candidate);
}
function make_token() {
    $exp = time() + WESLEY_TOKEN_TTL;
    $sig = hash_hmac('sha256', (string)$exp, WESLEY_SECRET);
    return $exp . '.' . $sig;
}
function valid_token($tok) {
    if (!is_string($tok) || strpos($tok, '.') === false) return false;
    list($exp, $sig) = explode('.', $tok, 2);
    if (!ctype_digit($exp)) return false;
    $calc = hash_hmac('sha256', $exp, WESLEY_SECRET);
    return hash_equals($calc, $sig) && ((int)$exp > time());
}
function require_auth($tok) {
    if (!valid_token($tok)) out(['error' => 'unauthorized'], 401);
}

/* =====================================================================
   Request
   ===================================================================== */
$method = $_SERVER['REQUEST_METHOD'];
$isMultipart = isset($_SERVER['CONTENT_TYPE']) &&
               stripos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false;

if ($isMultipart) {
    $body = $_POST;
} else {
    $raw  = file_get_contents('php://input');
    $body = $raw ? json_decode($raw, true) : [];
    if (!is_array($body)) $body = [];
}

$action = isset($_GET['action']) ? $_GET['action']
        : (isset($body['action']) ? $body['action'] : '');
$token  = isset($body['token']) ? $body['token']
        : (isset($_GET['token']) ? $_GET['token'] : '');

function field($k, $default = '') {
    global $body;
    return isset($body[$k]) ? $body[$k] : $default;
}
function now() { return gmdate('Y-m-d\TH:i:s\Z'); }
function client_ip() {
    return isset($_SERVER['REMOTE_ADDR']) ? substr($_SERVER['REMOTE_ADDR'], 0, 45) : '';
}

/* =====================================================================
   PUBLIC ROUTES
   ===================================================================== */

/* ---- current site content ---- */
if ($method === 'GET' && $action === 'content') {
    $row = db()->query('SELECT json, updated_at FROM content WHERE id = 1')
               ->fetch(PDO::FETCH_ASSOC);
    if (!$row) out(['content' => null, 'updated_at' => null]);
    out(['content' => json_decode($row['json']), 'updated_at' => $row['updated_at']]);
}

/* ---- contact form submission ---- */
if ($method === 'POST' && $action === 'contact') {
    // Honeypot: real people never fill this hidden field in.
    if (trim((string)field('website')) !== '') out(['ok' => true]);

    $name    = trim((string)field('name'));
    $email   = trim((string)field('email'));
    $subject = trim((string)field('subject'));
    $msg     = trim((string)field('message'));

    if ($name === '' || $msg === '')                         out(['error' => 'Please fill in your name and message.'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))          out(['error' => 'Please enter a valid email address.'], 400);
    if (mb_strlen($name) > 120 || mb_strlen($subject) > 200) out(['error' => 'That name or subject is too long.'], 400);
    if (mb_strlen($msg) > 8000)                              out(['error' => 'That message is too long.'], 400);

    // Rate limit per IP address.
    $ip = client_ip();
    if ($ip !== '') {
        $st = db()->prepare('SELECT COUNT(*) FROM messages WHERE ip = :ip AND created_at > :since');
        $st->execute([':ip' => $ip, ':since' => gmdate('Y-m-d\TH:i:s\Z', time() - 3600)]);
        if ((int)$st->fetchColumn() >= WESLEY_CONTACT_RATE) {
            out(['error' => 'Too many messages sent from here. Please try again later.'], 429);
        }
    }

    $to = setting_get('contact_to', WESLEY_CONTACT_TO);
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) $to = WESLEY_CONTACT_TO;

    $mailSubject = 'Website message from ' . $name . ($subject !== '' ? ' - ' . $subject : '');
    $mailBody =
        "You have a new message from the church website.\n\n" .
        "Name:    " . $name . "\n" .
        "Email:   " . $email . "\n" .
        ($subject !== '' ? "Subject: " . $subject . "\n" : '') .
        "Sent:    " . gmdate('D, d M Y H:i') . " UTC\n" .
        "\n-------------------------------------------\n\n" .
        $msg . "\n\n" .
        "-------------------------------------------\n" .
        "Reply straight to this email to answer " . $name . ".\n";

    $delivered = wesley_send_mail($to, $mailSubject, $mailBody, $email, $name);

    // Always keep a copy in the CMS inbox, even if the email failed to send.
    $st = db()->prepare('INSERT INTO messages (name, email, subject, body, ip, created_at, is_read, delivered)
                         VALUES (:n, :e, :s, :b, :ip, :c, 0, :d)');
    $st->execute([':n' => $name, ':e' => $email, ':s' => $subject, ':b' => $msg,
                  ':ip' => $ip, ':c' => now(), ':d' => $delivered ? 1 : 0]);

    out(['ok' => true, 'delivered' => (bool)$delivered]);
}

/* =====================================================================
   AUTH
   ===================================================================== */
if ($method === 'POST' && $action === 'login') {
    $pw = isset($body['password']) ? (string)$body['password'] : '';
    if (password_ok($pw)) {
        $t = make_token();
        out(['token' => $t, 'expires' => (int)explode('.', $t)[0]]);
    }
    usleep(400000); // slow down guessing
    out(['error' => 'invalid password'], 401);
}

if ($action === 'ping') {
    out(['ok' => true, 'authed' => valid_token($token)]);
}

/* =====================================================================
   ADMIN ROUTES -- everything below requires a valid token
   ===================================================================== */

/* ---- save site content (optionally keeping a revision) ---- */
if ($method === 'POST' && $action === 'save') {
    require_auth($token);
    if (!isset($body['content']) || !is_array($body['content'])) out(['error' => 'bad request'], 400);

    $json  = json_encode($body['content'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stamp = now();
    $pdo   = db();

    $exists = $pdo->query('SELECT 1 FROM content WHERE id = 1')->fetchColumn();
    if ($exists) {
        $prev = $pdo->query('SELECT json FROM content WHERE id = 1')->fetchColumn();
        $stmt = $pdo->prepare('UPDATE content SET json = :j, updated_at = :u WHERE id = 1');
    } else {
        $prev = null;
        $stmt = $pdo->prepare('INSERT INTO content (id, json, updated_at) VALUES (1, :j, :u)');
    }
    $stmt->execute([':j' => $json, ':u' => $stamp]);

    // Snapshot the previous version so it can be restored -- but only when the
    // caller asks (a deliberate publish), not on every autosave keystroke.
    if ($prev && !empty($body['revision'])) {
        $r = $pdo->prepare('INSERT INTO revisions (json, created_at, note) VALUES (:j, :c, :n)');
        $r->execute([':j' => $prev, ':c' => $stamp,
                     ':n' => substr((string)field('note', 'Published update'), 0, 120)]);
        wesley_trim_revisions($pdo, WESLEY_REVISIONS);
    }
    out(['ok' => true, 'updated_at' => $stamp]);
}

/* ---- inbox ---- */
if ($method === 'GET' && $action === 'messages') {
    require_auth($token);
    $rows = db()->query('SELECT id, name, email, subject, body, created_at, is_read, delivered
                         FROM messages ORDER BY id DESC LIMIT 300')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) { $r['is_read'] = (int)$r['is_read']; $r['delivered'] = (int)$r['delivered']; }
    out(['messages' => $rows]);
}
if ($method === 'POST' && $action === 'message_read') {
    require_auth($token);
    $st = db()->prepare('UPDATE messages SET is_read = :v WHERE id = :id');
    $st->execute([':v' => empty($body['unread']) ? 1 : 0, ':id' => (int)field('id', 0)]);
    out(['ok' => true]);
}
if ($method === 'POST' && $action === 'message_delete') {
    require_auth($token);
    $st = db()->prepare('DELETE FROM messages WHERE id = :id');
    $st->execute([':id' => (int)field('id', 0)]);
    out(['ok' => true]);
}

/* ---- media library ---- */
function upload_dir() {
    $dir = WESLEY_UPLOAD_DIR;
    if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
    // Keep anything that lands in here from ever being executed.
    $ht = $dir . '/.htaccess';
    if (!file_exists($ht)) {
        @file_put_contents($ht,
            "php_flag engine off\n" .
            "<FilesMatch \"\\.(php|phtml|php[0-9]|phar|cgi|pl|py|sh|html?)$\">\n" .
            "  <IfModule mod_authz_core.c>\n    Require all denied\n  </IfModule>\n" .
            "  <IfModule !mod_authz_core.c>\n    Order allow,deny\n    Deny from all\n  </IfModule>\n" .
            "</FilesMatch>\n");
    }
    return $dir;
}
function media_files() {
    return glob(upload_dir() . '/*.{jpg,jpeg,png,gif,webp}', GLOB_BRACE) ?: [];
}

/* Photos live on disk; the database holds a record per photo so captions,
   alt text and dimensions survive. Files that predate the media table (or
   that were copied in over FTP) are adopted here rather than ignored, so
   the library always reflects what is actually in the folder. */
function media_sync() {
    $pdo  = db();
    $rows = $pdo->query('SELECT id, filename FROM media')->fetchAll(PDO::FETCH_ASSOC);
    $known = [];
    foreach ($rows as $r) $known[$r['filename']] = $r['id'];

    foreach (media_files() as $path) {
        $name = basename($path);
        if (isset($known[$name])) { unset($known[$name]); continue; }
        $info = @getimagesize($path);
        $st = $pdo->prepare('INSERT INTO media (filename, mime, width, height, bytes, alt_text, caption, created_at)
                             VALUES (:f, :m, :w, :h, :b, \'\', \'\', :c)');
        $st->execute([
            ':f' => $name,
            ':m' => $info ? $info['mime'] : 'image/jpeg',
            ':w' => $info ? $info[0] : 0,
            ':h' => $info ? $info[1] : 0,
            ':b' => filesize($path) ?: 0,
            ':c' => gmdate('Y-m-d\TH:i:s\Z', filemtime($path) ?: time()),
        ]);
    }

    // Anything left in $known has a record but no file behind it any more.
    if ($known) {
        $in = implode(',', array_map('intval', $known));
        $pdo->exec("DELETE FROM media WHERE id IN ($in)");
    }
}

function media_list() {
    media_sync();
    $rows = db()->query('SELECT id, filename, mime, width, height, bytes, alt_text, caption, created_at
                         FROM media ORDER BY id DESC')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        $r['url']    = WESLEY_UPLOAD_URL . '/' . $r['filename'];
        $r['name']   = $r['filename'];
        $r['size']   = (int)$r['bytes'];
        $r['width']  = (int)$r['width'];
        $r['height'] = (int)$r['height'];
        $r['id']     = (int)$r['id'];
    }
    return $rows;
}

if ($method === 'POST' && $action === 'upload') {
    require_auth($token);
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        out(['error' => 'No file received (it may be larger than the server allows).'], 400);
    }
    $f = $_FILES['file'];
    if ($f['size'] > WESLEY_MAX_UPLOAD) {
        out(['error' => 'That image is larger than ' . round(WESLEY_MAX_UPLOAD / 1048576) . ' MB.'], 400);
    }

    $info = @getimagesize($f['tmp_name']);
    $allowed = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png',
                IMAGETYPE_GIF  => 'gif', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($allowed[$info[2]])) {
        out(['error' => 'Only JPG, PNG, GIF or WEBP images can be uploaded.'], 400);
    }
    $ext = $allowed[$info[2]];

    $base = pathinfo($f['name'], PATHINFO_FILENAME);
    $base = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $base));
    $base = trim(preg_replace('/-+/', '-', $base), '-');
    if ($base === '') $base = 'photo';
    $base = substr($base, 0, 50);

    $dir  = upload_dir();
    $name = $base . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
    if (!@move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
        out(['error' => 'Could not save the file. Check that the uploads folder is writable (permissions 755).'], 500);
    }
    @chmod($dir . '/' . $name, 0644);

    $st = db()->prepare('INSERT INTO media (filename, mime, width, height, bytes, alt_text, caption, created_at)
                         VALUES (:f, :m, :w, :h, :b, :a, :cap, :c)');
    $st->execute([
        ':f' => $name, ':m' => $info['mime'], ':w' => $info[0], ':h' => $info[1],
        ':b' => $f['size'],
        ':a' => substr(trim((string)field('alt_text')), 0, 255),
        ':cap' => substr(trim((string)field('caption')), 0, 255),
        ':c' => now(),
    ]);

    out(['ok' => true, 'id' => (int)db()->lastInsertId(),
         'url' => WESLEY_UPLOAD_URL . '/' . $name, 'name' => $name,
         'width' => $info[0], 'height' => $info[1], 'size' => $f['size'],
         'alt_text' => '', 'caption' => '']);
}

if ($method === 'GET' && $action === 'media') {
    require_auth($token);
    out(['media' => media_list()]);
}

if ($method === 'POST' && $action === 'media_update') {
    require_auth($token);
    $st = db()->prepare('UPDATE media SET alt_text = :a, caption = :c WHERE id = :id');
    $st->execute([
        ':a'  => substr(trim((string)field('alt_text')), 0, 255),
        ':c'  => substr(trim((string)field('caption')), 0, 255),
        ':id' => (int)field('id', 0),
    ]);
    out(['ok' => true]);
}

if ($method === 'POST' && $action === 'media_delete') {
    require_auth($token);
    $name = basename((string)field('name'));
    if (!preg_match('/^[A-Za-z0-9._\-]+\.(jpg|jpeg|png|gif|webp)$/i', $name)) out(['error' => 'bad name'], 400);
    $p = upload_dir() . '/' . $name;
    if (is_file($p)) @unlink($p);
    $st = db()->prepare('DELETE FROM media WHERE filename = :f');
    $st->execute([':f' => $name]);
    out(['ok' => true]);
}

/* ---- revisions ---- */
if ($method === 'GET' && $action === 'revisions') {
    require_auth($token);
    $rows = db()->query('SELECT id, created_at, note, length(json) AS size
                         FROM revisions ORDER BY id DESC')->fetchAll(PDO::FETCH_ASSOC);
    out(['revisions' => $rows]);
}
if ($method === 'POST' && $action === 'revision_restore') {
    require_auth($token);
    $st = db()->prepare('SELECT json FROM revisions WHERE id = :id');
    $st->execute([':id' => (int)field('id', 0)]);
    $json = $st->fetchColumn();
    if (!$json) out(['error' => 'not found'], 404);

    $pdo  = db();
    $prev = $pdo->query('SELECT json FROM content WHERE id = 1')->fetchColumn();
    if ($prev) {
        $r = $pdo->prepare('INSERT INTO revisions (json, created_at, note) VALUES (:j, :c, :n)');
        $r->execute([':j' => $prev, ':c' => now(), ':n' => 'Before restore']);
    }
    $u = $pdo->prepare('UPDATE content SET json = :j, updated_at = :u WHERE id = 1');
    $u->execute([':j' => $json, ':u' => now()]);
    out(['ok' => true, 'content' => json_decode($json)]);
}

/* ---- settings ---- */
if ($method === 'GET' && $action === 'settings') {
    require_auth($token);
    out(['settings' => [
        'contact_to'      => setting_get('contact_to', WESLEY_CONTACT_TO),
        'contact_from'    => WESLEY_CONTACT_FROM,
        'smtp'            => WESLEY_SMTP_HOST !== '',
        'custom_password' => setting_get('password_hash') ? true : false,
    ]]);
}
if ($method === 'POST' && $action === 'settings_save') {
    require_auth($token);
    $s = field('settings', []);
    if (isset($s['contact_to'])) {
        $to = trim((string)$s['contact_to']);
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) out(['error' => 'That is not a valid email address.'], 400);
        setting_set('contact_to', $to);
    }
    out(['ok' => true]);
}
if ($method === 'POST' && $action === 'change_password') {
    require_auth($token);
    $cur = (string)field('current');
    $new = (string)field('new');
    if (!password_ok($cur)) out(['error' => 'Your current password is not correct.'], 400);
    if (strlen($new) < 8)   out(['error' => 'Please choose a password of at least 8 characters.'], 400);
    setting_set('password_hash', password_hash($new, PASSWORD_DEFAULT));
    out(['ok' => true]);
}

/* ---- send a test email ---- */
if ($method === 'POST' && $action === 'test_email') {
    require_auth($token);
    $to = setting_get('contact_to', WESLEY_CONTACT_TO);
    $ok = wesley_send_mail($to, 'Test message from your website',
        "This is a test from the website CMS.\n\n" .
        "If you can read this, contact form messages will reach " . $to . ".\n");
    out(['ok' => $ok, 'to' => $to]);
}

/* ---- dashboard counters ---- */
if ($method === 'GET' && $action === 'stats') {
    require_auth($token);
    $pdo = db();
    out([
        'unread'     => (int)$pdo->query('SELECT COUNT(*) FROM messages WHERE is_read = 0')->fetchColumn(),
        'messages'   => (int)$pdo->query('SELECT COUNT(*) FROM messages')->fetchColumn(),
        'revisions'  => (int)$pdo->query('SELECT COUNT(*) FROM revisions')->fetchColumn(),
        'updated_at' => $pdo->query('SELECT updated_at FROM content WHERE id = 1')->fetchColumn() ?: null,
        'media'      => count(media_files()),
        'driver'     => wesley_db_driver(),
    ]);
}

out(['error' => 'not found'], 404);
