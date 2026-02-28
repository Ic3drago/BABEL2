<?php
namespace App\Controllers;
use App\Config\Database;

class PlanillaController {
    private \PDO $db;
    public function __construct() { $this->db = Database::getConnection(); }

    public function getPlanilla(string $fecha): void {
        try {
            // 1. Stock inicial registrado al inicio de la noche
            $stmtB = $this->db->prepare("
                SELECT ib.id, ib.nombre, ib.volumen_ml,
                       COALESCE(sn.stock_cerrado, ib.stock_cerrado) AS stock_inicial
                FROM inventario_botellas ib
                LEFT JOIN stock_noche sn ON sn.botella_id = ib.id AND sn.fecha = :fecha
                ORDER BY ib.nombre ASC
            ");
            $stmtB->execute(['fecha' => $fecha]);
            $botellas = $stmtB->fetchAll(\PDO::FETCH_ASSOC);

            // ─────────────────────────────────────────────────────────
            // 2. Ventas por botella agrupadas por tipo (nota_extra = fuente de verdad)
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
                WHERE DATE(vt.created_at) = :fecha2
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
            $stmtV->execute(['fecha' => $fecha, 'fecha2' => $fecha]);
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

                // RESTANTE: botellas enteras que deberían quedar físicamente
                // Solo se descuentan PROMO y NORMAL (botellas cerradas que se abrieron y vaciaron)
                // VASO y ENTRADA no se cuentan — son de botella abierta (fracción manual)
                $btl_consumidas = $promo_u + $normal_u;
                $stock_ini      = (int) $b['stock_inicial'];
                $restante       = max(0, $stock_ini - $btl_consumidas);

                $total_r = $promo_r + $normal_r + $vaso_r + $entrada_r;

                $filas[] = [
                    'id'               => $bid,
                    'nombre'           => $b['nombre'],
                    'volumen_ml'       => (int) $b['volumen_ml'],
                    'stock_inicial'    => $stock_ini,
                    'restante'         => $restante,

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

            echo json_encode(['success' => true, 'filas' => $filas, 'totales' => $totales]);

        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
}