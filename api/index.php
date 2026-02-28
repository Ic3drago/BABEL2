<?php
/**
 * api/index.php — Enrutador completo de la API BABEL
 */
declare(strict_types=1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

spl_autoload_register(function (string $class): void {
    $file = __DIR__ . '/../src/' . str_replace(['App\\', '\\'], ['', '/'], $class) . '.php';
    if (file_exists($file)) require_once $file;
});

$token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
if ($token !== 'token_secreto_bar_123') {
    http_response_code(401); echo json_encode(['error' => 'No autorizado']); exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$uri    = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

$adminCtrl    = new \App\Controllers\AdminController();
$cajaCtrl     = new \App\Controllers\CajaController();
$planillaCtrl = new \App\Controllers\PlanillaController();
$db           = \App\Config\Database::getConnection();
$barRepo      = new \App\Repositories\BarRepository($db);
$barCtrl      = new \App\Controllers\BarController($barRepo);

// ADMIN
if ($method==='POST' && $uri==='/api/admin/noche')             { $adminCtrl->guardarConfigNoche(); exit; }
if ($method==='GET'  && $uri==='/api/admin/bodega')            { $adminCtrl->getBodega(); exit; }
if ($method==='POST' && $uri==='/api/admin/bodega')            { $adminCtrl->agregarBotella(); exit; }
if ($method==='POST' && $uri==='/api/admin/bodega/stock')      { $adminCtrl->guardarStockNoche(); exit; }
if ($method==='PUT'    && preg_match('#^/api/admin/bodega/([^/]+)$#', $uri, $m)) { $adminCtrl->editarBotella($m[1]); exit; }
if ($method==='DELETE' && preg_match('#^/api/admin/bodega/([^/]+)$#', $uri, $m)) { $adminCtrl->eliminarBotella($m[1]); exit; }
if ($method==='GET'  && $uri==='/api/admin/menu')              { $adminCtrl->getMenu(); exit; }
if ($method==='POST' && $uri==='/api/admin/menu')              { $adminCtrl->agregarItemMenu(); exit; }
if ($method==='PUT'    && preg_match('#^/api/admin/menu/([^/]+)$#', $uri, $m)) { $adminCtrl->editarItemMenu($m[1]); exit; }
if ($method==='DELETE' && preg_match('#^/api/admin/menu/([^/]+)$#', $uri, $m)) { $adminCtrl->eliminarItemMenu($m[1]); exit; }

// CAJA
if ($method==='GET'  && $uri==='/api/caja/menu')               { $cajaCtrl->getMenu(); exit; }
if ($method==='POST' && $uri==='/api/caja/cobrar')             { $cajaCtrl->cobrar(); exit; }

// PLANILLA
if ($method==='GET'  && preg_match('#^/api/planilla/(\d{4}-\d{2}-\d{2})$#', $uri, $m)) { $planillaCtrl->getPlanilla($m[1]); exit; }

// LEGACY
if ($method==='GET'  && $uri==='/api/products')                { $barCtrl->listProducts(); exit; }
if ($method==='POST' && $uri==='/api/products')                { $barCtrl->createProduct(); exit; }
if ($method==='POST' && $uri==='/api/sheet')                   { $barCtrl->saveSheet(); exit; }
if ($method==='GET'  && preg_match('#^/api/report/(.+)$#', $uri, $m)) { $barCtrl->getReport($m[1]); exit; }

http_response_code(404);
echo json_encode(['error' => 'Ruta no encontrada', 'uri' => $uri]);