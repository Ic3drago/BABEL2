<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Config\Database;
use PDO;

class BarRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::connect();
    }

    // Crear producto
    public function addProduct(string $name, int $glassesPerBottle): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO products (name, glasses_per_bottle)
            VALUES (:name, :glasses)
        ");

        $stmt->execute([
            ':name' => $name,
            ':glasses' => $glassesPerBottle
        ]);
    }

    // Listar productos
    public function getProducts(): array
    {
        $stmt = $this->db->query("SELECT * FROM products ORDER BY id DESC");
        return $stmt->fetchAll();
    }

    // Guardar fila planilla
    public function saveSheetRow(array $data): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO sheets (
                session_id, product_id,
                promo_btl, promo_pct, promo_uso, promo_vnt, promo_cts,
                normal_btl, normal_pct, normal_uso, normal_vnt, normal_cts,
                final_btl, final_pct
            )
            VALUES (
                :session_id, :product_id,
                :promo_btl, :promo_pct, :promo_uso, :promo_vnt, :promo_cts,
                :normal_btl, :normal_pct, :normal_uso, :normal_vnt, :normal_cts,
                :final_btl, :final_pct
            )
        ");

        $stmt->execute($data);
    }

    public function getCalculationReport(string $sessionId): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM sheets WHERE session_id = :session_id
        ");

        $stmt->execute([':session_id' => $sessionId]);

        return $stmt->fetchAll();
    }
}