<?php
/* =====================================================================
   Local development only.

       php -S 127.0.0.1:8000 router.php

   PHP's built-in server ignores .htaccess, so this reproduces the two
   rewrites the live site relies on: serving the CMS at /admin, and
   handing the address of a CMS-made page (/about, /events...) to
   index.html so it can draw it. Without this they would 404 locally
   while working fine in production.

   This file is not used on real hosting -- Apache handles it there.
   ===================================================================== */

$requested = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = rtrim($requested, '/');

if ($path === '/admin' || $path === '/admin.html') {
    // Keep one canonical address, exactly as .htaccess does.
    if ($requested !== '/admin') {
        header('Location: /admin', true, 301);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/admin.html');
    return true;
}

// A real file on disk (index.html, api.php, theme.css, an upload...) is
// served as usual.
$file = __DIR__ . urldecode($requested);
if ($requested !== '/' && is_file($file)) return false;

// Anything else is the address of a page made in the CMS. index.html
// reads the address and draws the matching page.
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/index.html');
return true;
