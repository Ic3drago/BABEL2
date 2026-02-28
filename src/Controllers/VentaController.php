<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Botella;
use App\Models\Venta;
use Exception;

/**
 * VentaController - Motor de Cuentas y Descuentos
 * 
 * Procesa órdenes de venta, calcula totales exactos, y ajusta el inventario
 * de forma precisa considerando volúmenes en mililitros y porcentajes abiertos
 * 
 * @author Sistema BABEL
 * @version 1.0.0
 */
final class VentaController
{
    private Botella $botellaModel;
    private Venta $ventaModel;

    public function __construct(?Botella $botella = null, ?Venta $venta = null)
    {
        $this->botellaModel = $botella ?? new Botella();
        $this->ventaModel = $venta ?? new Venta();
    }

    /**
     * Procesa una nueva venta, calcula el total y descuenta el inventario
     * 
     * Este es el método principal. Recibe un array de ítems vendidos y:
     * 1. Valida que haya stock suficiente
     * 2. Calcula el total de la cuenta
     * 3. Actualiza el inventario de forma atómica
     * 4. Registra la transacción en la BD
     * 
     * @param array $items Array de ítems vendidos:
     *   [
     *     ['botella_id' => 'uuid', 'cantidad_vendida' => 2, 'cantidad_ml' => 50],
     *     ['botella_id' => 'uuid', 'cantidad_vendida' => 1, 'cantidad_ml' => 350]
     *   ]
     * 
     * @return array Respuesta estructurada:
     *   - success: bool
     *   - mensaje: string
     *   - total_cobrar: float
     *   - id_venta: string (si fue exitosa)
     *   - detalles: array (con información de cada ítem)
     */
    public function procesarVenta(array $items): array
    {
        try {
            // 1. Validación inicial
            if (empty($items)) {
                throw new Exception("La venta debe contener al menos un ítem", 400);
            }

            // 2. Validar y preparar datos
            $itemsValidos = [];
            $totalCuenta = 0.0;
            $operacionesInventario = [];

            foreach ($items as $item) {
                // Validar estructura
                if (!isset($item['botella_id'], $item['cantidad_vendida'], $item['cantidad_ml'])) {
                    throw new Exception(
                        "Ítem incompleto. Se requieren: botella_id, cantidad_vendida, cantidad_ml",
                        400
                    );
                }

                $botellaId = (string)$item['botella_id'];
                $cantidadVendida = (int)$item['cantidad_vendida'];
                $cantidadMl = (int)$item['cantidad_ml'];

                if ($cantidadVendida <= 0 || $cantidadMl <= 0) {
                    throw new Exception("Cantidad vendida y ml deben ser mayores a 0", 400);
                }

                // Obtener datos de la botella
                $botella = $this->botellaModel->obtenerPorId($botellaId);
                if (!$botella) {
                    throw new Exception("Botella con ID {$botellaId} no existe", 404);
                }

                // Calcular subtotal
                $precioUnitario = (float)$botella['precio_unitario'];
                $subtotal = $precioUnitario * $cantidadVendida;
                $totalCuenta += $subtotal;

                // Calcular mililitros a descontar
                $mlTotalADescontar = $cantidadMl * $cantidadVendida;

                // Validar stock disponible y calcular nuevo estado
                $nuevoEstado = $this->calcularNuevoStock(
                    (int)$botella['volumen_total_ml'],
                    (float)$botella['porcentaje_abierto'],
                    (int)$botella['stock_cerrado'],
                    $mlTotalADescontar
                );

                // Registrar operación de inventario
                $operacionesInventario[] = [
                    'botella_id' => $botellaId,
                    'nuevo_stock_cerrado' => $nuevoEstado['stock_cerrado'],
                    'nuevo_porcentaje' => $nuevoEstado['porcentaje']
                ];

                // Preparar detalle para la venta
                $itemsValidos[] = [
                    'botella_id' => $botellaId,
                    'cantidad_vendida' => $cantidadVendida,
                    'cantidad_ml' => $cantidadMl,
                    'precio_unitario' => $precioUnitario,
                    'subtotal' => round($subtotal, 2),
                    'nombre_botella' => $botella['nombre']
                ];
            }

            // 3. Si todo está validado, registrar la venta
            $idVenta = $this->ventaModel->registrarVenta($totalCuenta, $itemsValidos);

            // 4. Actualizar inventarios
            foreach ($operacionesInventario as $operacion) {
                $this->botellaModel->actualizarStock(
                    $operacion['botella_id'],
                    $operacion['nuevo_stock_cerrado'],
                    $operacion['nuevo_porcentaje']
                );
            }

            // 5. Retornar respuesta exitosa
            return [
                'success' => true,
                'mensaje' => 'Venta procesada exitosamente',
                'total_cobrar' => round($totalCuenta, 2),
                'id_venta' => $idVenta,
                'detalles' => $itemsValidos,
                'cantidad_items' => count($itemsValidos)
            ];

        } catch (Exception $e) {
            // Capturar errores y retornarlos de forma controlada
            $statusCode = $e->getCode() ?: 500;
            return [
                'success' => false,
                'mensaje' => $e->getMessage(),
                'total_cobrar' => 0,
                'status_code' => $statusCode
            ];
        }
    }

    /**
     * Realiza la matemática exacta para descontar líquido
     * 
     * Algoritmo:
     * - Si lo que se vende cabe en la botella abierta, solo ajustamos el porcentaje
     * - Si no cabe, terminamos la botella abierta y abrimos una nueva del stock
     * - Si no hay stock cerrado, lanzamos error
     * 
     * @param int $volumenTotalMl Volumen total de la botella (ej: 750ml)
     * @param float $porcentajeAbierto Porcentaje actual (0-100)
     * @param int $stockCerrado Botellas sin abrir
     * @param int $mlADescontar Mililitros que se van a vender
     * 
     * @return array ['stock_cerrado' => int, 'porcentaje' => float]
     * @throws Exception Si no hay stock disponible
     */
    private function calcularNuevoStock(
        int $volumenTotalMl,
        float $porcentajeAbierto,
        int $stockCerrado,
        int $mlADescontar
    ): array {
        // Convertir porcentaje a mililitros reales
        $mlDisponiblesAbiertos = ($porcentajeAbierto / 100) * $volumenTotalMl;

        // Caso 1: Alcanza con lo de la botella abierta
        if ($mlADescontar <= $mlDisponiblesAbiertos) {
            $mlRestantes = $mlDisponiblesAbiertos - $mlADescontar;
            $nuevoPorcentaje = ($mlRestantes / $volumenTotalMl) * 100;

            return [
                'stock_cerrado' => $stockCerrado,
                'porcentaje' => round($nuevoPorcentaje, 2)
            ];
        }

        // Caso 2: No alcanza, hay que abrir una botella nueva
        if ($stockCerrado <= 0) {
            throw new Exception(
                "Stock insuficiente. No hay botellas cerradas para cubrir esta venta.",
                400
            );
        }

        // Lo que falta após agotar la botella abierta
        $mlFaltantes = $mlADescontar - $mlDisponiblesAbiertos;

        // Abrimos botella nueva (restamos 1 al stock cerrado)
        $nuevoStockCerrado = $stockCerrado - 1;

        // Mililitros restantes en la botella recién abierta
        $mlRestantesNueva = $volumenTotalMl - $mlFaltantes;

        // Validación: una botella nueva debería alcanzar
        if ($mlRestantesNueva < 0) {
            throw new Exception(
                "Una botella completa no alcanza para esta venta. Se solicitan {$mlADescontar}ml " .
                "y la botella tiene {$volumenTotalMl}ml.",
                400
            );
        }

        $nuevoPorcentaje = ($mlRestantesNueva / $volumenTotalMl) * 100;

        return [
            'stock_cerrado' => $nuevoStockCerrado,
            'porcentaje' => round($nuevoPorcentaje, 2)
        ];
    }

    /**
     * Obtiene todas las botellas del inventario con su estado actual
     * 
     * @return array Lista de botellas
     */
    public function obtenerInventario(): array
    {
        try {
            $botellas = $this->botellaModel->obtenerTodas();

            // Enriquecer con información calculada
            foreach ($botellas as &$botella) {
                $botella['ml_disponibles'] = $this->botellaModel->calcularVolumenDisponible(
                    $botella['id']
                );
            }

            return [
                'success' => true,
                'botellas' => $botellas,
                'cantidad_total' => count($botellas)
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'mensaje' => $e->getMessage()
            ];
        }
    }

    /**
     * Obtiene el detalle completode una venta (incluye items)
     * 
     * @param string $ventaId UUID de la venta
     * @return array Información completa de la venta
     */
    public function obtenerDetalleVenta(string $ventaId): array
    {
        try {
            $venta = $this->ventaModel->obtenerPorId($ventaId);
            if (!$venta) {
                throw new Exception("Venta no encontrada", 404);
            }

            $detalles = $this->ventaModel->obtenerDetalles($ventaId);

            return [
                'success' => true,
                'venta' => $venta,
                'detalles' => $detalles,
                'cantidad_items' => count($detalles)
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'mensaje' => $e->getMessage()
            ];
        }
    }

    /**
     * Obtiene reporte de ventas en un período
     * 
     * @param string $fechaInicio YYYY-MM-DD
     * @param string $fechaFin YYYY-MM-DD
     * @return array Reporte con totales y estadísticas
     */
    public function obtenerReportePeriodo(string $fechaInicio, string $fechaFin): array
    {
        try {
            $ventas = $this->ventaModel->obtenerPeriodo($fechaInicio, $fechaFin);
            $total = $this->ventaModel->calcularTotalPeriodo($fechaInicio, $fechaFin);
            $productoMasVendido = $this->ventaModel->obtenerProductoMasVendido(
                $fechaInicio,
                $fechaFin
            );

            return [
                'success' => true,
                'periodo' => [
                    'inicio' => $fechaInicio,
                    'fin' => $fechaFin
                ],
                'total_ventas' => count($ventas),
                'total_ingresos' => round($total, 2),
                'promedio_venta' => round(count($ventas) > 0 ? $total / count($ventas) : 0, 2),
                'producto_mas_vendido' => $productoMasVendido,
                'ventas' => $ventas
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'mensaje' => $e->getMessage()
            ];
        }
    }

    /**
     * Anula una venta (para devoluciones o errores)
     * 
     * @param string $ventaId UUID de la venta
     * @return array Resultado de la operación
     */
    public function anularVenta(string $ventaId): array
    {
        try {
            $venta = $this->ventaModel->obtenerPorId($ventaId);
            if (!$venta) {
                throw new Exception("Venta no encontrada", 404);
            }

            if ($venta['estado'] === 'anulada') {
                throw new Exception("La venta ya está anulada", 400);
            }

            $this->ventaModel->anular($ventaId);

            return [
                'success' => true,
                'mensaje' => 'Venta anulada correctamente',
                'venta_id' => $ventaId
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'mensaje' => $e->getMessage()
            ];
        }
    }
}
