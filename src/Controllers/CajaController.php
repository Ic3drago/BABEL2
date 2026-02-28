<?php
namespace App\Controllers;
use App\Config\Database;
use Exception;

class CajaController {
    private \PDO $db;
    public function __construct() { $this->db = Database::getConnection(); }

    // ── NUEVO: muestra los tragos activos de hoy al bartender ──
    public function getMenu(): void {
        $hoy = date('Y-m-d');
        try {
            $stmt = $this->db->prepare("
                SELECT
                    mt.id,
                    mt.nombre_boton,
                    COALESCE(mtn.tipo_venta_override, mt.tipo_venta)  AS tipo_venta,
                    COALESCE(mtn.precio_override,     mt.precio)       AS precio,
                    mt.botella_id,
                    COALESCE(mt.combo_desc, '')                        AS combo_desc,
                    ib.nombre                                          AS nombre_botella,
                    ib.volumen_ml,
                    CASE 
                        WHEN COALESCE(mtn.tipo_venta_override, mt.tipo_venta) = 'VASO' 
                        THEN ROUND(ib.volumen_ml::numeric / COALESCE(ib.vasos_por_botella, 18))
                        ELSE ib.volumen_ml
                    END AS ml_a_descontar,
                    COALESCE(ib.vasos_por_botella, 18)                 AS vasos_por_botella,
                    ib.stock_cerrado,
                    ib.porcentaje_abierto,
                    (ib.stock_cerrado + CASE WHEN ib.porcentaje_abierto > 0 THEN 1 ELSE 0 END)
                        AS unidades_disponibles
                FROM menu_tragos_noche mtn
                JOIN menu_tragos        mt  ON mtn.trago_id  = mt.id
                JOIN inventario_botellas ib ON mt.botella_id = ib.id
                WHERE mtn.fecha = :hoy
                ORDER BY tipo_venta, mt.nombre_boton
            ");
            $stmt->execute(['hoy' => $hoy]);
            $items = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            foreach ($items as &$it) {
                $it['precio']               = (float) $it['precio'];
                $it['volumen_ml']           = (int)   $it['volumen_ml'];
                $it['ml_a_descontar']       = (int)   $it['ml_a_descontar'];
                $it['vasos_por_botella']    = (int)   $it['vasos_por_botella'];
                $it['stock_cerrado']        = (int)   $it['stock_cerrado'];
                $it['porcentaje_abierto']   = (float) $it['porcentaje_abierto'];
                $it['unidades_disponibles'] = (int)   $it['unidades_disponibles'];
            }
            echo json_encode(['success' => true, 'data' => $items]);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    public function cobrar(): void {
        $body = json_decode(file_get_contents('php://input'), true);
        $items = $body['items'] ?? [];
        $extras = $body['items_extra'] ?? [];
        $tipoPago = $body['tipo_pago'] ?? 'EFECTIVO';
        $hoy = date('Y-m-d');

        if (empty($items) && empty($extras)) {
            http_response_code(400); echo json_encode(['success'=>false,'error'=>'Ticket vacío.']); return;
        }

        $this->db->beginTransaction();
        try {
            $total = 0.0;
            $ticketId = $this->uuid();
            $pendientes = [];

            foreach ($items as $linea) {
                // Verificar si es un combo personalizado (tiene licor_id y refresco_id)
                if (!empty($linea['licor_id']) && !empty($linea['refresco_id'])) {
                    // COMBO personalizado: licor + refresco
                    $qty = (int)($linea['cantidad'] ?? 1);
                    $precio = (float)($linea['precio'] ?? 0);
                    $sub = $precio * $qty;
                    $total += $sub;
                    
                    $pendientes[] = [
                        'tipo' => 'COMBO_CUSTOM',
                        'nombre' => $linea['nombre'] ?? 'Combo',
                        'licor_id' => $linea['licor_id'],
                        'refresco_id' => $linea['refresco_id'],
                        'qty' => $qty,
                        'sub' => $sub,
                    ];
                } else {
                    // Trago del menú tradicional
                    $stmt = $this->db->prepare("SELECT mt.*, ib.vasos_por_botella FROM menu_tragos mt JOIN inventario_botellas ib ON mt.botella_id = ib.id WHERE mt.id = ?");
                    $stmt->execute([$linea['trago_id']]);
                    $tr = $stmt->fetch(\PDO::FETCH_ASSOC);
                    if (!$tr) throw new Exception("Trago no encontrado.");
                    $qty = (int)$linea['cantidad'];
                    $sub = (float)$tr['precio'] * $qty;
                    $total += $sub;
                    $pendientes[] = ['tipo'=>'MENU', 'data'=>$tr, 'qty'=>$qty, 'sub'=>$sub];
                }
            }

            foreach ($extras as $ex) {
                $qty = (int)($ex['cantidad'] ?? 1);
                $sub = (float)($ex['precio'] ?? 0) * $qty;
                $total += $sub;
                $pendientes[] = ['tipo'=>'EXTRA', 'nombre'=>$ex['nombre'], 'qty'=>$qty, 'sub'=>$sub];
            }

            $this->db->prepare("INSERT INTO ventas_tickets (id, total_cobrado, tipo_pago, creado_por, created_at, efectivo_recibido)
                VALUES (?, ?, ?, 'Barman', NOW(), ?)")
                ->execute([$ticketId, $total, $tipoPago, (float)($body['efectivo_recibido'] ?? $total)]);

            foreach ($pendientes as $p) {
                $tragoId = null;
                if ($p['tipo'] === 'MENU') {
                    $tr = $p['data'];
                    $tragoId = $tr['id'];
                    $this->procesarBajaInventario($tr['botella_id'], $tr['tipo_venta'], $p['qty'], (int)$tr['vasos_por_botella']);

                    if ($tr['tipo_venta'] === 'COMBO' && !empty($tr['complemento_id'])) {
                        // COMBO de catálogo = PROMO: licor + complemento, ambos como PROMO
                        // El complemento descuenta 1 botella entera igual que el licor
                        $this->procesarBajaInventario($tr['complemento_id'], 'BOTELLA', $p['qty'], 1);

                        // Buscar trago_id del complemento
                        $stmtComp = $this->db->prepare(
                            "SELECT id FROM menu_tragos WHERE botella_id = ? LIMIT 1"
                        );
                        $stmtComp->execute([$tr['complemento_id']]);
                        $compTrago = $stmtComp->fetch(\PDO::FETCH_ASSOC);

                        // Línea 1: licor — nota_extra='PROMO', precio completo del combo
                        $this->db->prepare("INSERT INTO ventas_detalles (id, ticket_id, trago_id, cantidad, subtotal, nota_extra) VALUES (?,?,?,?,?,?)")
                                 ->execute([$this->uuid(), $ticketId, $tragoId, $p['qty'], $p['sub'], 'PROMO']);

                        // Línea 2: complemento — nota_extra='PROMO', precio 0
                        if (!$compTrago) {
                            // Crear un botón oculto para que la venta pueda asociarse a un trago_id
                            $nuevoTragoId = $this->uuid();
                            $this->db->prepare("INSERT INTO menu_tragos (id, botella_id, nombre_boton, tipo_venta, vasos_por_botella, precio) VALUES (?, ?, ?, 'NORMAL', 1, 0)")
                                     ->execute([$nuevoTragoId, $tr['complemento_id'], '(Oculto) Complemento']);
                            $compTrago = ['id' => $nuevoTragoId];
                        }
                        
                        $this->db->prepare("INSERT INTO ventas_detalles (id, ticket_id, trago_id, cantidad, subtotal, nota_extra) VALUES (?,?,?,?,?,?)")
                                 ->execute([$this->uuid(), $ticketId, $compTrago['id'], $p['qty'], 0, 'PROMO']);
                    } else {
                        // Trago normal: grabar tipo_venta real en nota_extra
                        $nota = $tr['tipo_venta']; // 'VASO', 'PROMO', 'NORMAL', 'BOTELLA', 'ENTRADA'
                        $this->db->prepare("INSERT INTO ventas_detalles (id, ticket_id, trago_id, cantidad, subtotal, nota_extra) VALUES (?,?,?,?,?,?)")
                                 ->execute([$this->uuid(), $ticketId, $tragoId, $p['qty'], $p['sub'], $nota]);
                    }
                } elseif ($p['tipo'] === 'COMBO_CUSTOM') {
                    // Combo personalizado: obtener info de ambas botellas y registrar DOS líneas en venta_detalles
                    $stmt1 = $this->db->prepare("SELECT id, botella_id, vasos_por_botella FROM menu_tragos WHERE id = ?");
                    $stmt1->execute([$p['licor_id']]);
                    $licor = $stmt1->fetch(\PDO::FETCH_ASSOC);
                    
                    $stmt2 = $this->db->prepare("SELECT id, botella_id, vasos_por_botella FROM menu_tragos WHERE id = ?");
                    $stmt2->execute([$p['refresco_id']]);
                    $refresco = $stmt2->fetch(\PDO::FETCH_ASSOC);
                    
                    if ($licor && $refresco) {
                        // COMBO_CUSTOM = PROMO: ambas botellas enteras
                        $this->procesarBajaInventario($licor['botella_id'], 'BOTELLA', $p['qty'], 1);
                        $this->procesarBajaInventario($refresco['botella_id'], 'BOTELLA', $p['qty'], 1);

                        // Línea 1: Licor — nota_extra='PROMO', precio completo del combo
                        $this->db->prepare("INSERT INTO ventas_detalles (id, ticket_id, trago_id, cantidad, subtotal, nota_extra) VALUES (?,?,?,?,?,?)")
                                 ->execute([$this->uuid(), $ticketId, $licor['id'], $p['qty'], $p['sub'], 'PROMO']);

                        // Línea 2: Refresco — nota_extra='PROMO', precio 0
                        $this->db->prepare("INSERT INTO ventas_detalles (id, ticket_id, trago_id, cantidad, subtotal, nota_extra) VALUES (?,?,?,?,?,?)")
                                 ->execute([$this->uuid(), $ticketId, $refresco['id'], $p['qty'], 0, 'PROMO']);
                    }
                } elseif ($p['tipo'] === 'EXTRA') {
                    // Extras no se vinculan a un trago_id específico
                    $this->db->prepare("INSERT INTO ventas_detalles (id, ticket_id, trago_id, cantidad, subtotal) VALUES (?,?,?,?,?)")
                             ->execute([$this->uuid(), $ticketId, null, $p['qty'], $p['sub']]);
                }
            }

            $this->db->commit();
            
            // Preparar detalles para la respuesta
            $detalles = [];
            foreach ($pendientes as $p) {
                if ($p['tipo'] === 'MENU') {
                    $detalles[] = [
                        'nombre' => $p['data']['nombre_boton'],
                        'cantidad' => $p['qty'],
                        'subtotal' => $p['sub'],
                    ];
                } elseif ($p['tipo'] === 'COMBO_CUSTOM') {
                    $detalles[] = [
                        'nombre' => $p['nombre'],
                        'cantidad' => $p['qty'],
                        'subtotal' => $p['sub'],
                    ];
                } elseif ($p['tipo'] === 'EXTRA') {
                    $detalles[] = [
                        'nombre' => $p['nombre'],
                        'cantidad' => $p['qty'],
                        'subtotal' => $p['sub'],
                    ];
                }
            }
            
            echo json_encode(['success' => true, 'id_ticket' => $ticketId, 'total_cobrar' => $total, 'detalle' => $detalles]);
        } catch (Exception $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    private function procesarBajaInventario($bid, $tipo, $qty, $vxb) {
        $st = $this->db->prepare("SELECT stock_cerrado, porcentaje_abierto FROM inventario_botellas WHERE id = ? FOR UPDATE");
        $st->execute([$bid]);
        $res = $st->fetch(\PDO::FETCH_ASSOC);
        if (!$res) throw new Exception("Botella no encontrada en inventario.");

        $sc  = (int)   $res['stock_cerrado'];
        $pct = (float) $res['porcentaje_abierto'];

        // VASO y ENTRADA: solo marcar como "abierta" si no lo está ya.
        // No sabemos exactamente cuánto queda → lo registra el admin manualmente al cerrar.
        if ($tipo === 'VASO' || $tipo === 'ENTRADA') {
            if ($pct <= 0 && $sc > 0) {
                // Abrir una botella del stock cerrado
                $sc--;
                $pct = 100.0;
                $this->db->prepare("UPDATE inventario_botellas SET stock_cerrado=?, porcentaje_abierto=?, updated_at=NOW() WHERE id=?")
                         ->execute([$sc, $pct, $bid]);
            }
            // Si ya hay una botella abierta (pct > 0), no hacemos nada más.
            // El campo manual de la planilla registrará cuánto sobró al cierre.
            return;
        }

        // PROMO, NORMAL, BOTELLA, COMBO: descuenta 1 botella entera por unidad vendida
        $consumo  = 100.0 * $qty;
        $nuevoPct = $pct - $consumo;
        while ($nuevoPct < -0.001 && $sc > 0) { $sc--; $nuevoPct += 100.0; }
        if ($nuevoPct < -0.001) throw new Exception("Stock insuficiente para esta venta.");
        $this->db->prepare("UPDATE inventario_botellas SET stock_cerrado=?, porcentaje_abierto=?, updated_at=NOW() WHERE id=?")
                 ->execute([$sc, round(max(0, $nuevoPct), 4), $bid]);
    }

    private function uuid(): string {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff), mt_rand(0,0x0fff)|0x4000,mt_rand(0,0x3fff)|0x8000, mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
    }
}