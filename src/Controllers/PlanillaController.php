<?php
namespace App\Controllers;
use App\Config\Database;

class PlanillaController {
    private \PDO $db;
    public function __construct() { $this->db = Database::getConnection(); }

    public function getPlanilla(string $fecha): void {
        try {
            // Un turno de bar cruza la medianoche.
            // Definimos el turno desde las 06:00 del día consultado hasta las 05:59:59 del día siguiente.
            $fechaInicio = $fecha . ' 06:00:00';
            $fechaFin = date('Y-m-d', strtotime($fecha . ' +1 day')) . ' 05:59:59';
            // 1. Stock inicial registrado al inicio de la noche
            $stmtB = $this->db->prepare("
                SELECT ib.id, ib.nombre, ib.volumen_ml, ib.vasos_por_botella,
                       COALESCE(sn.stock_cerrado, ib.stock_cerrado) AS stock_inicial
                FROM inventario_botellas ib
                LEFT JOIN stock_noche sn ON sn.botella_id = ib.id AND sn.fecha = :fecha
                ORDER BY ib.nombre ASC
            ");
            $stmtB->execute(['fecha' => $fecha]);
            $botellas = $stmtB->fetchAll(\PDO::FETCH_ASSOC);

            // ─────────────────────────────────────────────────────────
            // 2. Ventas por botella agrupadas por tipo (nota_wstra = fuente de verdad)
            //
            // Tipos en nota_extra:
            //   PROMO   → botella entera en promo O componente de un combo
            //   NORMAL  → botella entera precio normal
            //   BOTELLA → alias de NORMAL
            //   VASO    → copa vendida (botella abierta, fracción manual)
            //   ENTRADA → cortesía de entrada (botella abierta, fracción manual)
            //
            // Los COMBO (catálogo y custom) graban DOS líneas con nota_extra='PROMO':
            //   - licor:      precio completo, cantidad++
            //   - refresco:   precio $0,        cantidad++
            // Así cada botella aparece en su propia fila de la planilla.
            // ─────────────────────────────────────────────────────────
            $stmtV = $this->db->prepare("
                SELECT
                    ib.id AS botella_id,
                    CASE
                        WHEN vdt.nota_extra = 'PROMO'                    THEN 'PROMO'
                        WHEN vdt.nota_extra = 'ENTRADA'                  THEN 'ENTRADA'
                        WHEN vdt.nota_extra = 'VASO'                     THEN 'VASO'
                        WHEN vdt.nota_extra IN ('NORMAL', 'BOTELLA', '') THEN 'NORMAL'
                        ELSE COALESCE(mtn.tipo_venta_override, mt.tipo_venta)
                    END AS tipo_venta,
                    SUM(vdt.cantidad) AS unidades,
                    SUM(vdt.subtotal) AS recaudado
                FROM ventas_tickets vt
                JOIN ventas_detalles vdt    ON vt.id         = vdt.ticket_id
                JOIN menu_tragos mt         ON vdt.trago_id  = mt.id
                JOIN inventario_botellas ib ON mt.botella_id = ib.id
                LEFT JOIN menu_tragos_noche mtn
                       ON mtn.trago_id = mt.id AND mtn.fecha = :fecha
                WHERE vt.created_at >= :fechaInicio AND vt.created_at <= :fechaFin
                GROUP BY
                    ib.id,
                    CASE
                        WHEN vdt.nota_extra = 'PROMO'                    THEN 'PROMO'
                        WHEN vdt.nota_extra = 'ENTRADA'                  THEN 'ENTRADA'
                        WHEN vdt.nota_extra = 'VASO'                     THEN 'VASO'
                        WHEN vdt.nota_extra IN ('NORMAL', 'BOTELLA', '') THEN 'NORMAL'
                        ELSE COALESCE(mtn.tipo_venta_override, mt.tipo_venta)
                    END
                ORDER BY ib.nombre ASC
            ");
            $stmtV->execute([
                'fecha' => $fecha,
                'fechaInicio' => $fechaInicio,
                'fechaFin' => $fechaFin
            ]);
            $ventas = $stmtV->fetchAll(\PDO::FETCH_ASSOC);

            // map[botella_id][tipo] = {unidades, recaudado}
            $vm = [];
            foreach ($ventas as $v) {
                $bid  = $v['botella_id'];
                $tipo = $v['tipo_venta'] ?? 'NORMAL';
                if (!isset($vm[$bid])) $vm[$bid] = [];
                $vm[$bid][$tipo] = [
                    'unidades'  => (int)   $v['unidades'],
                    'recaudado' => (float) $v['recaudado'],
                ];
            }

            $filas = [];
            $totales = [
                'promo_unidades'   => 0, 'promo_recaudado'   => 0.0,
                'normal_unidades'  => 0, 'normal_recaudado'  => 0.0,
                'vaso_unidades'    => 0, 'vaso_recaudado'    => 0.0,
                'entrada_unidades' => 0, 'entrada_recaudado' => 0.0,
                'total_recaudado'  => 0.0,
            ];

            foreach ($botellas as $b) {
                $bid  = $b['id'];
                $data = $vm[$bid] ?? [];

                $promo_u   = (int)   ($data['PROMO']['unidades']   ?? 0);
                $promo_r   = (float) ($data['PROMO']['recaudado']  ?? 0);
                $normal_u  = (int)   ($data['NORMAL']['unidades']  ?? 0);
                $normal_r  = (float) ($data['NORMAL']['recaudado'] ?? 0);
                $vaso_u    = (int)   ($data['VASO']['unidades']    ?? 0);
                $vaso_r    = (float) ($data['VASO']['recaudado']   ?? 0);
                $entrada_u = (int)   ($data['ENTRADA']['unidades'] ?? 0);
                $entrada_r = (float) ($data['ENTRADA']['recaudado']?? 0);

                // RESTANTE: botellas que deberían quedar físicamente
                // Se descuentan PROMO y NORMAL como botellas enteras (1.0)
                // Se descuentan VASO y ENTRADA como fracción (1 / vasos_por_botella)
                $vxb = max(1, (int) ($b['vasos_por_botella'] ?? 18));
                
                // Botellas enteras consumidas
                $btl_enteras = $promo_u + $normal_u;
                // Botellas fraccionales consumidas
                $btl_fraccionales = ($vaso_u + $entrada_u) / $vxb;

                $total_consumido = $btl_enteras + $btl_fraccionales;
                
                $stock_ini = (float) $b['stock_inicial'];
                // Formateamos a 2 decimales para que sea amigable ("1.5 botellas", "2.0", etc.)
                $restante = max(0, $stock_ini - $total_consumido);
                $restante_fmt = round($restante, 2);

                $total_r = $promo_r + $normal_r + $vaso_r + $entrada_r;

                $filas[] = [
                    'id'               => $bid,
                    'nombre'           => $b['nombre'],
                    'volumen_ml'       => (int) $b['volumen_ml'],
                    'stock_inicial'    => $stock_ini,
                    'restante'         => $restante_fmt,

                    'promo_unidades'   => $promo_u,
                    'promo_recaudado'  => round($promo_r, 2),

                    'normal_unidades'  => $normal_u,
                    'normal_recaudado' => round($normal_r, 2),

                    'vaso_unidades'    => $vaso_u,
                    'vaso_recaudado'   => round($vaso_r, 2),

                    'entrada_unidades' => $entrada_u,
                    'entrada_recaudado'=> round($entrada_r, 2),

                    'total_recaudado'  => round($total_r, 2),
                ];

                $totales['promo_unidades']   += $promo_u;
                $totales['promo_recaudado']  += $promo_r;
                $totales['normal_unidades']  += $normal_u;
                $totales['normal_recaudado'] += $normal_r;
                $totales['vaso_unidades']    += $vaso_u;
                $totales['vaso_recaudado']   += $vaso_r;
                $totales['entrada_unidades'] += $entrada_u;
                $totales['entrada_recaudado']+= $entrada_r;
                $totales['total_recaudado']  += $total_r;
            }

            foreach ($totales as $k => $v) {
                if (str_contains($k, 'recaudado')) $totales[$k] = round((float)$v, 2);
            }
            
            // Buscar totales por método de pago de manera directa:
            $stmtMetodos = $this->db->prepare("
                SELECT tipo_pago, SUM(total_cobrado) as total 
                FROM ventas_tickets 
                WHERE created_at >= :fechaInicio AND created_at <= :fechaFin 
                GROUP BY tipo_pago
            ");
            $stmtMetodos->execute(['fechaInicio' => $fechaInicio, 'fechaFin' => $fechaFin]);
            $metodos = $stmtMetodos->fetchAll(\PDO::FETCH_ASSOC);
            
            $totales['efectivo_recaudado'] = 0.0;
            $totales['qr_recaudado'] = 0.0;
            $totales['transfer_recaudado'] = 0.0;
            
            foreach($metodos as $m) {
                if($m['tipo_pago'] === 'EFECTIVO') $totales['efectivo_recaudado'] += (float)$m['total'];
                elseif($m['tipo_pago'] === 'QR') $totales['qr_recaudado'] += (float)$m['total'];
                elseif($m['tipo_pago'] === 'TRANSFER') $totales['transfer_recaudado'] += (float)$m['total'];
            }

            // 3. Detalle exacto de productos vendidos (Agrupado)
            $stmtDetalle = $this->db->prepare("
                SELECT 
                    CASE 
                        WHEN mt.nombre_boton = '(Oculto) Complemento' THEN CONCAT('🥤 (Acompañante de Combo) ', ib.nombre)
                        WHEN vdt.nota_extra = 'PROMO' THEN CONCAT('🎁 (Promo/Combo) ', COALESCE(mt.nombre_boton, ib.nombre))
                        WHEN vdt.nota_extra LIKE 'EXTRA:%' THEN REPLACE(vdt.nota_extra, 'EXTRA: ', '➕ (Extra) ')
                        ELSE COALESCE(mt.nombre_boton, vdt.nota_extra)
                    END AS nombre,
                    SUM(vdt.cantidad) as cantidad_vendida,
                    SUM(vdt.subtotal) as subtotal
                FROM ventas_tickets vt
                JOIN ventas_detalles vdt ON vt.id = vdt.ticket_id
                LEFT JOIN menu_tragos mt ON vdt.trago_id = mt.id
                LEFT JOIN inventario_botellas ib ON mt.botella_id = ib.id
                WHERE vt.created_at >= :fechaInicio AND vt.created_at <= :fechaFin
                GROUP BY 
                    CASE 
                        WHEN mt.nombre_boton = '(Oculto) Complemento' THEN CONCAT('🥤 (Acompañante de Combo) ', ib.nombre)
                        WHEN vdt.nota_extra = 'PROMO' THEN CONCAT('🎁 (Promo/Combo) ', COALESCE(mt.nombre_boton, ib.nombre))
                        WHEN vdt.nota_extra LIKE 'EXTRA:%' THEN REPLACE(vdt.nota_extra, 'EXTRA: ', '➕ (Extra) ')
                        ELSE COALESCE(mt.nombre_boton, vdt.nota_extra)
                    END
                ORDER BY subtotal DESC, cantidad_vendida DESC
            ");
            $stmtDetalle->execute([
                'fechaInicio' => $fechaInicio,
                'fechaFin' => $fechaFin
            ]);
            $detalle_ventas = $stmtDetalle->fetchAll(\PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true, 
                'filas' => $filas, 
                'totales' => $totales,
                'detalle_ventas' => $detalle_ventas
            ]);

        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
}