<?php
/* =====================================================================
   Local development only.

       php -S 127.0.0.1:8000 router.php

   PHP's built-in server ignores .htaccess, so this reproduces the one
   rewrite the live site relies on: serving the CMS at /admin. Without it
   /admin would 404 locally while working fine in production.

   This file is not used on real hosting -- Apache handles it there.
   ===================================================================== */

$path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

if ($path === '/admin' || $path === '/admin.html') {
    // Keep one canonical address, exactly as .htaccess does.
    if (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) !== '/admin') {
        header('Location: /admin', true, 301);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/admin.html');
    return true;
}

// Everything else: let the built-in server handle it normally.
return false;
