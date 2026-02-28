<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Repositories\BarRepository;
use Exception;

class BarController {
    private BarRepository $repo;
    public function __construct(BarRepository $repo) { $this->repo = $repo; }

    private function sendResponse($data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    // --- NUEVAS FUNCIONES PARA LOS TRAGOS ---
    public function createProduct(): void {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['name']) || empty($data['glasses_per_bottle'])) {
                throw new Exception("Nombre y rendimiento son requeridos", 400);
            }
            $this->repo->addProduct($data['name'], (int)$data['glasses_per_bottle']);
            $this->sendResponse(['message' => 'Producto agregado'], 201);
        } catch (Exception $e) { $this->sendResponse(['error' => $e->getMessage()], 400); }
    }

    public function listProducts(): void {
        try {
            $products = $this->repo->getProducts();
            $this->sendResponse($products, 200);
        } catch (Exception $e) { $this->sendResponse(['error' => 'Error al obtener productos'], 500); }
    }
    // ----------------------------------------

    public function saveSheet(): void {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['session_id']) || empty($data['product_id'])) {
                throw new Exception("Campos requeridos faltantes: session_id o product_id", 400);
            }
            
            $fields = ['promo_btl', 'promo_pct', 'promo_uso', 'promo_vnt', 'promo_cts', 
                       'normal_btl', 'normal_pct', 'normal_uso', 'normal_vnt', 'normal_cts', 
                       'final_btl', 'final_pct'];
            
            $cleanData = ['session_id' => $data['session_id'], 'product_id' => $data['product_id']];
            foreach ($fields as $field) {
                $cleanData[$field] = isset($data[$field]) ? (float)$data[$field] : 0;
            }

            $this->repo->saveSheetRow($cleanData);
            $this->sendResponse(['message' => 'Fila guardada exitosamente'], 201);
        } catch (Exception $e) { 
            $this->sendResponse(['error' => $e->getMessage(), 'code' => $e->getCode()], $e->getCode() ?: 400); 
        }
    }

    public function getReport(string $sessionId): void {
        try {
            $report = $this->repo->getCalculationReport($sessionId);
            $this->sendResponse(['session_id' => $sessionId, 'report' => $report]);
        } catch (Exception $e) { $this->sendResponse(['error' => 'Error al generar reporte'], 500); }
    }
}