<?php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$distPath = __DIR__ . '/dist';
$filePath = $distPath . $uri;

// Serve existing static files directly with correct MIME types
if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimeTypes = [
        'js'    => 'application/javascript',
        'mjs'   => 'application/javascript',
        'css'   => 'text/css',
        'html'  => 'text/html',
        'json'  => 'application/json',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'gif'   => 'image/gif',
        'svg'   => 'image/svg+xml',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'map'   => 'application/json',
        'webp'  => 'image/webp',
        'txt'   => 'text/plain',
    ];
    $mime = $mimeTypes[$ext] ?? 'application/octet-stream';
    header('Content-Type: ' . $mime);
    readfile($filePath);
    exit;
}

// For all other routes, serve the SPA entry point
header('Content-Type: text/html');
readfile($distPath . '/index.html');
