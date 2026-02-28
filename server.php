<?php
// 1. Cargar las variables del .env manualmente
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue; 
        $parts = explode('=', $line, 2);
        if(count($parts) === 2) {
            putenv(trim($parts[0]) . '=' . trim($parts[1]));
        }
    }
}

// 2. Enrutador principal
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// API Backend
if (strpos($uri, '/api') === 0) {
    require __DIR__ . '/api/index.php';
    return true;
}

// ==========================================
// ENRUTADOR FRONTEND (Vistas HTML)
// ==========================================
if ($uri === '/') {
    readfile(__DIR__ . '/public/index.html'); // El Menú Principal
    return true;
}

if ($uri === '/admin') {
    readfile(__DIR__ . '/public/admin.html');
    return true;
}

if ($uri === '/pos') {
    readfile(__DIR__ . '/public/pos.html');
    return true;
}

if ($uri === '/planilla') {
    readfile(__DIR__ . '/public/planilla.html');
    return true;
}

// ==========================================
// ENRUTADOR PARA ARCHIVOS JS Y CSS
// ==========================================
if (preg_match('/\.js$/', $uri)) {
    header('Content-Type: application/javascript');
    $filePath = __DIR__ . '/public' . $uri;
    if (file_exists($filePath)) {
        readfile($filePath);
        return true;
    }
}

return false;