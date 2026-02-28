<?php
declare(strict_types=1);

namespace App\Models;

use PDO;
use PDOException;

/**
 * Modelo de Botella - Gestiona el inventario de botellas
 * 
 * Responsabilidades:
 * - Obtener información de botellas
 * - Actualizar stock cerrado y porcentaje abierto
 * - Validar disponibilidad de inventario
 */
final class Botella
{
    private PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? \App\Config\Database::getConnection();
    }

    /**
     * Obtiene una botella por su ID
     * 
     * @param string $id UUID de la botella
     * @return array|null Datos de la botella o null si no existe
     * @throws PDOException
     */
    public function obtenerPorId(string $id): ?array
    {
        try {
            $stmt = $this->db->prepare("
                SELECT id, nombre, descripcion, volumen_total_ml, stock_cerrado, 
                       porcentaje_abierto, precio_unitario, precio_por_ml, created_at, updated_at
                FROM botellas
                WHERE id = :id
            ");
            $stmt->execute(['id' => $id]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ?: null;
        } catch (PDOException $e) {
            throw new PDOException("Error al obtener botella: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Obtiene todas las botellas del inventario
     * 
     * @return array Lista de botellas
     * @throws PDOException
     */
    public function obtenerTodas(): array
    {
        try {
            $stmt = $this->db->query("
                SELECT id, nombre, descripcion, volumen_total_ml, stock_cerrado, 
                       porcentaje_abierto, precio_unitario, precio_por_ml, created_at, updated_at
                FROM botellas
                ORDER BY nombre ASC
            ");
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new PDOException("Error al obtener botellas: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Obtiene botellas con stock disponible
     * 
     * @return array Botellas con stock > 0
     * @throws PDOException
     */
    public function obtenerConStock(): array
    {
        try {
            $stmt = $this->db->query("
                SELECT id, nombre, descripcion, volumen_total_ml, stock_cerrado, 
                       porcentaje_abierto, precio_unitario, precio_por_ml
                FROM botellas
                WHERE stock_cerrado > 0 OR porcentaje_abierto > 0
                ORDER BY nombre ASC
            ");
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new PDOException("Error al obtener botellas con stock: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Actualiza el stock cerrado y porcentaje abierto de una botella
     * 
     * @param string $id UUID de la botella
     * @param int $nuevoStockCerrado Cantidad de botellas cerradas
     * @param float $nuevoPorcentajeAbierto Porcentaje (0-100) de la botella abierta
     * @return bool true si se actualizó correctamente
     * @throws PDOException
     */
    public function actualizarStock(string $id, int $nuevoStockCerrado, float $nuevoPorcentajeAbierto): bool
    {
        // Validar que los valores sean realistas
        if ($nuevoStockCerrado < 0 || $nuevoPorcentajeAbierto < 0 || $nuevoPorcentajeAbierto > 100) {
            throw new \InvalidArgumentException(
                "Valores inválidos: stock_cerrado debe ser >= 0, porcentaje debe estar entre 0-100"
            );
        }

        try {
            $stmt = $this->db->prepare("
                UPDATE botellas
                SET stock_cerrado = :stock_cerrado,
                    porcentaje_abierto = :porcentaje_abierto,
                    updated_at = NOW()
                WHERE id = :id
            ");

            return $stmt->execute([
                'id' => $id,
                'stock_cerrado' => $nuevoStockCerrado,
                'porcentaje_abierto' => round($nuevoPorcentajeAbierto, 2)
            ]);
        } catch (PDOException $e) {
            throw new PDOException("Error al actualizar stock de botella: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Crea una nueva botella
     * 
     * @param string $nombre Nombre de la botella
     * @param string|null $descripcion Descripción opcional
     * @param int $volumenTotalMl Volumen total en mililitros
     * @param int $stockCerrado Cantidad inicial de botellas cerradas
     * @param float $precioUnitario Precio por unidad (en ml o botella)
     * @param bool $precioPorMl Si es true, el precio es por ml; si false, por botella
     * @return string UUID de la botella creada
     * @throws PDOException
     */
    public function crear(
        string $nombre,
        ?string $descripcion,
        int $volumenTotalMl,
        int $stockCerrado,
        float $precioUnitario,
        bool $precioPorMl = true
    ): string {
        if (empty($nombre) || $volumenTotalMl <= 0 || $precioUnitario < 0) {
            throw new \InvalidArgumentException(
                "Nombre, volumen, y precio son requeridos y válidos"
            );
        }

        try {
            $id = \bin2hex(\random_bytes(16));
            $id = sprintf(
                '%s-%s-%s-%s-%s',
                substr($id, 0, 8),
                substr($id, 8, 4),
                substr($id, 12, 4),
                substr($id, 16, 4),
                substr($id, 20, 12)
            );

            $stmt = $this->db->prepare("
                INSERT INTO botellas (
                    id, nombre, descripcion, volumen_total_ml, stock_cerrado,
                    porcentaje_abierto, precio_unitario, precio_por_ml
                ) VALUES (
                    :id, :nombre, :descripcion, :volumen_total_ml, :stock_cerrado,
                    :porcentaje_abierto, :precio_unitario, :precio_por_ml
                )
            ");

            $stmt->execute([
                'id' => $id,
                'nombre' => $nombre,
                'descripcion' => $descripcion,
                'volumen_total_ml' => $volumenTotalMl,
                'stock_cerrado' => $stockCerrado,
                'porcentaje_abierto' => 0,
                'precio_unitario' => $precioUnitario,
                'precio_por_ml' => $precioPorMl ? 1 : 0
            ]);

            return $id;
        } catch (PDOException $e) {
            throw new PDOException("Error al crear botella: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Elimina una botella del inventario
     * 
     * @param string $id UUID de la botella
     * @return bool true si se eliminó correctamente
     * @throws PDOException
     */
    public function eliminar(string $id): bool
    {
        try {
            $stmt = $this->db->prepare("DELETE FROM botellas WHERE id = :id");
            return $stmt->execute(['id' => $id]);
        } catch (PDOException $e) {
            throw new PDOException("Error al eliminar botella: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Calcula el volumen total disponible en ml de una botella
     * 
     * @param string $botellaId UUID de la botella
     * @return float Mililitros totales disponibles
     * @throws PDOException
     */
    public function calcularVolumenDisponible(string $botellaId): float
    {
        $botella = $this->obtenerPorId($botellaId);
        if (!$botella) {
            throw new \InvalidArgumentException("Botella no encontrada");
        }

        // Mililitros en la botella abierta
        $mlAbiertos = ($botella['porcentaje_abierto'] / 100) * $botella['volumen_total_ml'];
        
        // Mililitros en las botellas cerradas
        $mlCerrados = $botella['stock_cerrado'] * $botella['volumen_total_ml'];

        return $mlAbiertos + $mlCerrados;
    }
}
