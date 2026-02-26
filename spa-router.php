<?php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$filePath = __DIR__ . '/dist' . $uri;

// Serve existing static files (JS, CSS, images, etc.) directly
if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    return false;
}

// For all other routes, serve the SPA entry point
readfile(__DIR__ . '/dist/index.html');
