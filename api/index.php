<?php
/**
 * api/index.php — Enrutador completo de la API BABEL
 */
declare(strict_types=1);

header('Content-Type: application/json');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [getenv('ALLOWED_ORIGIN') ?: ''];
if (in_array($origin, $allowedOrigins) && $origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
} 
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

spl_autoload_register(function (string $class): void {
    $file = __DIR__ . '/../src/' . str_replace(['App\\', '\\'], ['', '/'], $class) . '.php';
    if (file_exists($file)) require_once $file;
});

$method = $_SERVER['REQUEST_METHOD'];
$uri    = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

// PUBLIC ROUTES
if ($method === 'POST' && $uri === '/api/login') {
    $db = \App\Config\Database::getConnection();
    $authCtrl = new \App\Controllers\AuthController($db);
    $authCtrl->login();
    exit;
}

if ($method === 'PUT' && $uri === '/api/auth/password') {
    $db = \App\Config\Database::getConnection();
    $authCtrl = new \App\Controllers\AuthController($db);
    $authCtrl->changePassword();
    exit;
}

// TOKEN VALIDATION (for all protected routes)
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$token = str_replace('Bearer ', '', $authHeader);

$payload = \App\Config\JWT::decode($token);

if (!$payload) {
    http_response_code(401); echo json_encode(['error' => 'No autorizado o token expirado']); exit;
}

$userRole = $payload['role'];

// ROLE AUTHORIZATION HELPER
function requireRole($allowedRoles) {
    global $userRole;
    if (!in_array($userRole, (array)$allowedRoles)) {
        http_response_code(403);
        echo json_encode(['error' => 'Acceso denegado. Rol insuficiente.']);
        exit;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
// NOTE: $uri is already defined earlier, reusing it is fine or redefine it without error
$uri    = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

$adminCtrl    = new \App\Controllers\AdminController();
$cajaCtrl     = new \App\Controllers\CajaController();
$planillaCtrl = new \App\Controllers\PlanillaController();
$db           = \App\Config\Database::getConnection();
$barRepo      = new \App\Repositories\BarRepository($db);
$barCtrl      = new \App\Controllers\BarController($barRepo);

// ADMIN (Only 'admin')
if ($method==='POST' && $uri==='/api/admin/noche')             { requireRole('admin'); $adminCtrl->guardarConfigNoche(); exit; }
if ($method==='GET'  && $uri==='/api/admin/bodega')            { requireRole('admin'); $adminCtrl->getBodega(); exit; }
if ($method==='POST' && $uri==='/api/admin/bodega')            { requireRole('admin'); $adminCtrl->agregarBotella(); exit; }
if ($method==='POST' && $uri==='/api/admin/bodega/agregar_stock') { requireRole('admin'); $adminCtrl->sumarStockMidShift(); exit; }
if ($method==='POST' && $uri==='/api/admin/bodega/stock')      { requireRole('admin'); $adminCtrl->guardarStockNoche(); exit; }
if ($method==='PUT'    && preg_match('#^/api/admin/bodega/([^/]+)$#', $uri, $m)) { requireRole('admin'); $adminCtrl->editarBotella($m[1]); exit; }
if ($method==='DELETE' && preg_match('#^/api/admin/bodega/([^/]+)$#', $uri, $m)) { requireRole('admin'); $adminCtrl->eliminarBotella($m[1]); exit; }
if ($method==='GET'  && $uri==='/api/admin/menu')              { requireRole('admin'); $adminCtrl->getMenu(); exit; }
if ($method==='POST' && $uri==='/api/admin/menu')              { requireRole('admin'); $adminCtrl->agregarItemMenu(); exit; }
if ($method==='PUT'    && preg_match('#^/api/admin/menu/([^/]+)$#', $uri, $m)) { requireRole('admin'); $adminCtrl->editarItemMenu($m[1]); exit; }
if ($method==='DELETE' && preg_match('#^/api/admin/menu/([^/]+)$#', $uri, $m)) { requireRole('admin'); $adminCtrl->eliminarItemMenu($m[1]); exit; }
if ($method==='DELETE' && $uri==='/api/admin/reset_ventas')    { requireRole('admin'); $adminCtrl->resetearVentas(); exit; }

// CAJA (Both 'admin' and 'bartender')
if ($method==='GET'  && $uri==='/api/caja/menu')               { requireRole(['admin', 'bartender']); $cajaCtrl->getMenu(); exit; }
if ($method==='POST' && $uri==='/api/caja/cobrar')             { requireRole(['admin', 'bartender']); $cajaCtrl->cobrar(); exit; }
if ($method==='DELETE' && preg_match('#^/api/caja/ventas/([^/]+)$#', $uri, $m)) { requireRole(['admin', 'bartender']); $cajaCtrl->anularVenta($m[1]); exit; }

// PLANILLA (Admin only usually, or both?) Let's restrict to admin for now, or allow both to view.
if ($method==='GET'  && preg_match('#^/api/planilla/(\d{4}-\d{2}-\d{2})$#', $uri, $m)) { requireRole(['admin', 'bartender']); $planillaCtrl->getPlanilla($m[1]); exit; }

// LEGACY (Products & Sheet APIs used by POS usually, restrict based on reasonable assumption)
if ($method==='GET'  && $uri==='/api/products')                { requireRole(['admin', 'bartender']); $barCtrl->listProducts(); exit; }
if ($method==='POST' && $uri==='/api/products')                { requireRole('admin'); /* Only admin creates products */ $barCtrl->createProduct(); exit; }
if ($method==='POST' && $uri==='/api/sheet')                   { requireRole(['admin', 'bartender']); $barCtrl->saveSheet(); exit; }
if ($method==='GET'  && preg_match('#^/api/report/(.+)$#', $uri, $m)) { requireRole(['admin', 'bartender']); $barCtrl->getReport($m[1]); exit; }

http_response_code(404);
echo json_encode(['error' => 'Ruta no encontrada', 'uri' => $uri]);