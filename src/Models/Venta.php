<?php
declare(strict_types=1);

namespace App\Models;

use PDO;
use PDOException;

/**
 * Modelo de Venta - Gestiona el registro de transacciones
 * 
 * Responsabilidades:
 * - Registrar nuevas ventas
 * - Registrar detalles de cada ítem vendido
 * - Obtener historial de ventas
 * - Generar reportes de ventas
 */
final class Venta
{
    private PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? \App\Config\Database::getConnection();
    }

    /**
     * Registra una nueva venta en la base de datos
     * 
     * @param float $totalCobrar Monto total de la venta
     * @param array $detalles Array con los ítems vendidos
     * @return string UUID de la venta creada
     * @throws PDOException
     */
    public function registrarVenta(float $totalCobrar, array $detalles): string
    {
        if ($totalCobrar < 0) {
            throw new \InvalidArgumentException("El total cobrar no puede ser negativo");
        }

        try {
            // Iniciar transacción para asegurar integridad
            $this->db->beginTransaction();

            // 1. Insertar la venta principal
            $ventaId = $this->generarUUID();
            $stmt = $this->db->prepare("
                INSERT INTO ventas (id, total_cobrar, estado)
                VALUES (:id, :total_cobrar, 'completada')
            ");

            $stmt->execute([
                'id' => $ventaId,
                'total_cobrar' => round($totalCobrar, 2)
            ]);

            // 2. Insertar los detalles de cada ítem
            foreach ($detalles as $detalle) {
                $this->registrarDetalleVenta($ventaId, $detalle);
            }

            // Confirmar transacción
            $this->db->commit();

            return $ventaId;
        } catch (PDOException $e) {
            // Revertir si algo falla
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw new PDOException("Error al registrar venta: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Registra un detalle de un ítem vendido
     * 
     * @param string $ventaId UUID de la venta
     * @param array $detalle Datos del ítem (botella_id, cantidad_vendida, cantidad_ml, precio_unitario, subtotal)
     * @return bool true si se registró correctamente
     * @throws PDOException
     */
    private function registrarDetalleVenta(string $ventaId, array $detalle): bool
    {
        try {
            $detalleId = $this->generarUUID();
            $stmt = $this->db->prepare("
                INSERT INTO venta_detalles (
                    id, venta_id, botella_id, cantidad_vendida, cantidad_ml,
                    precio_unitario, subtotal
                ) VALUES (
                    :id, :venta_id, :botella_id, :cantidad_vendida, :cantidad_ml,
                    :precio_unitario, :subtotal
                )
            ");

            return $stmt->execute([
                'id' => $detalleId,
                'venta_id' => $ventaId,
                'botella_id' => $detalle['botella_id'],
                'cantidad_vendida' => (int)$detalle['cantidad_vendida'],
                'cantidad_ml' => (int)$detalle['cantidad_ml'],
                'precio_unitario' => (float)$detalle['precio_unitario'],
                'subtotal' => round((float)$detalle['precio_unitario'] * (int)$detalle['cantidad_vendida'], 2)
            ]);
        } catch (PDOException $e) {
            throw new PDOException("Error al registrar detalle de venta: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Obtiene una venta por su ID
     * 
     * @param string $id UUID de la venta
     * @return array|null Datos de la venta o null
     * @throws PDOException
     */
    public function obtenerPorId(string $id): ?array
    {
        try {
            $stmt = $this->db->prepare("
                SELECT id, total_cobrar, estado, fecha, created_at, updated_at
                FROM ventas
                WHERE id = :id
            ");
            $stmt->execute(['id' => $id]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ?: null;
        } catch (PDOException $e) {
            throw new PDOException("Error al obtener venta: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Obtiene todos los detalles de una venta
     * 
     * @param string $ventaId UUID de la venta
     * @return array Lista de detalles
     * @throws PDOException
     */
    public function obtenerDetalles(string $ventaId): array
    {
        try {
            $stmt = $this->db->prepare("
                SELECT 
                    vd.id, vd.botella_id, b.nombre, vd.cantidad_vendida, vd.cantidad_ml,
                    vd.precio_unitario, vd.subtotal, vd.created_at
                FROM venta_detalles vd
                JOIN botellas b ON vd.botella_id = b.id
                WHERE vd.venta_id = :venta_id
                ORDER BY vd.created_at ASC
            ");
            $stmt->execute(['venta_id' => $ventaId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new PDOException("Error al obtener detalles de venta: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Obtiene todas las ventas de un período
     * 
     * @param string $fechaInicio Fecha inicial (YYYY-MM-DD)
     * @param string $fechaFin Fecha final (YYYY-MM-DD)
     * @return array Lista de ventas
     * @throws PDOException
     */
    public function obtenerPeriodo(string $fechaInicio, string $fechaFin): array
    {
        try {
            $stmt = $this->db->prepare("
                SELECT id, total_cobrar, estado, fecha, created_at
                FROM ventas
                WHERE DATE(fecha) BETWEEN :fecha_inicio AND :fecha_fin
                ORDER BY fecha DESC
            ");
            $stmt->execute([
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin
            ]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new PDOException("Error al obtener período de ventas: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Calcula el total de ventas en un período
     * 
     * @param string $fechaInicio Fecha inicial (YYYY-MM-DD)
     * @param string $fechaFin Fecha final (YYYY-MM-DD)
     * @return float Total de ventas
     * @throws PDOException
     */
    public function calcularTotalPeriodo(string $fechaInicio, string $fechaFin): float
    {
        try {
            $stmt = $this->db->prepare("
                SELECT COALESCE(SUM(total_cobrar), 0) as total
                FROM ventas
                WHERE estado = 'completada' AND DATE(fecha) BETWEEN :fecha_inicio AND :fecha_fin
            ");
            $stmt->execute([
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin
            ]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return (float)$result['total'] ?? 0.0;
        } catch (PDOException $e) {
            throw new PDOException("Error al calcular total: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Obtiene el producto más vendido en un período
     * 
     * @param string $fechaInicio Fecha inicial (YYYY-MM-DD)
     * @param string $fechaFin Fecha final (YYYY-MM-DD)
     * @return array|null Datos del producto más vendido
     * @throws PDOException
     */
    public function obtenerProductoMasVendido(string $fechaInicio, string $fechaFin): ?array
    {
        try {
            $stmt = $this->db->prepare("
                SELECT 
                    b.id, b.nombre, SUM(vd.cantidad_vendida) as total_unidades,
                    SUM(vd.subtotal) as total_ingresos
                FROM venta_detalles vd
                JOIN botellas b ON vd.botella_id = b.id
                JOIN ventas v ON vd.venta_id = v.id
                WHERE DATE(v.fecha) BETWEEN :fecha_inicio AND :fecha_fin
                GROUP BY b.id, b.nombre
                ORDER BY total_unidades DESC
                LIMIT 1
            ");
            $stmt->execute([
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin
            ]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ?: null;
        } catch (PDOException $e) {
            throw new PDOException("Error al obtener producto más vendido: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Anula una venta (cambiar estado)
     * 
     * @param string $id UUID de la venta
     * @return bool true si se anuló correctamente
     * @throws PDOException
     */
    public function anular(string $id): bool
    {
        try {
            $stmt = $this->db->prepare("
                UPDATE ventas
                SET estado = 'anulada', updated_at = NOW()
                WHERE id = :id
            ");
            return $stmt->execute(['id' => $id]);
        } catch (PDOException $e) {
            throw new PDOException("Error al anular venta: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Genera un UUID v4
     * 
     * @return string UUID formateado
     */
    private function generarUUID(): string
    {
        $bytes = \random_bytes(16);
        $bytes[6] = chr(ord($bytes[6]) & 0x0f | 0x40);
        $bytes[8] = chr(ord($bytes[8]) & 0x3f | 0x80);

        return \sprintf(
            '%s-%s-%s-%s-%s',
            \bin2hex(substr($bytes, 0, 4)),
            \bin2hex(substr($bytes, 4, 2)),
            \bin2hex(substr($bytes, 6, 2)),
            \bin2hex(substr($bytes, 8, 2)),
            \bin2hex(substr($bytes, 10, 6))
        );
    }
}
