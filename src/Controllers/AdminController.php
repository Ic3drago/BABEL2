<?php
namespace App\Controllers;
use App\Config\Database;
use Exception;

/**
 * AdminController.php — BABEL Bar POS
 *
 * Tipos: VASO | BOTELLA | COMBO
 *   VASO    = vaso suelto de licor (Fernet $3, Ron $4)
 *   BOTELLA = botella entera sin nada extra (Ron Bacardi 140bs)
 *   COMBO   = botella + algo incluido (Vodka Rebel 180bs + refresco 3L)
 *
 * vasos_por_botella vive en inventario_botellas — un dato por licor.
 */
class AdminController {
    private function json($d, int $c=200): void {
        http_response_code($c); header('Content-Type: application/json');
        echo json_encode($d); exit;
    }
    private function input(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }

    public function getBodega(): void {
        try {
            $stmt = Database::getConnection()->query(
                "SELECT id, nombre, volumen_ml, stock_cerrado, porcentaje_abierto,
                        COALESCE(vasos_por_botella, 18) AS vasos_por_botella
                 FROM inventario_botellas ORDER BY nombre ASC"
            );
            $this->json(['success'=>true, 'data'=>$stmt->fetchAll()]);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }

    public function agregarBotella(): void {
        try {
            $d = $this->input();
            if (empty($d['nombre']) || empty($d['volumen_ml'])) throw new Exception("Nombre y volumen son obligatorios.");
            Database::getConnection()->prepare(
                "INSERT INTO inventario_botellas (nombre, volumen_ml, stock_cerrado, porcentaje_abierto, vasos_por_botella)
                 VALUES (?, ?, ?, 0, ?)"
            )->execute([$d['nombre'], (int)$d['volumen_ml'], (int)($d['stock_cerrado']??0), (int)($d['vasos_por_botella']??18)]);
            $this->json(['success'=>true,'mensaje'=>'Licor registrado']);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }

    public function editarBotella(string $id): void {
        try {
            $d = $this->input();
            if (empty($d['nombre']) || empty($d['volumen_ml'])) throw new Exception("Nombre y volumen son obligatorios.");
            $db = Database::getConnection();
            $old = $db->prepare("SELECT volumen_ml, porcentaje_abierto FROM inventario_botellas WHERE id=?");
            $old->execute([$id]); $row = $old->fetch();
            $pct = $row['porcentaje_abierto'];
            if ($row && (int)$row['volumen_ml'] !== (int)$d['volumen_ml'] && (int)$row['volumen_ml'] > 0) {
                $pct = min(100, (((float)$row['porcentaje_abierto']/100)*(int)$row['volumen_ml']) / (int)$d['volumen_ml'] * 100);
            }
            $db->prepare("UPDATE inventario_botellas SET nombre=?,volumen_ml=?,porcentaje_abierto=?,vasos_por_botella=?,updated_at=NOW() WHERE id=?")
               ->execute([$d['nombre'],(int)$d['volumen_ml'],round($pct,4),(int)($d['vasos_por_botella']??18),$id]);
            $this->json(['success'=>true,'mensaje'=>'Licor actualizado']);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }

    public function eliminarBotella(string $id): void {
        try {
            $db = Database::getConnection();
            // 1. Nullear complemento_id en combos que usan esta botella como complemento
            $db->prepare("UPDATE menu_tragos SET complemento_id=NULL WHERE complemento_id=?")->execute([$id]);
            // 2. Borrar tragos donde esta botella es el licor principal
            $db->prepare("DELETE FROM menu_tragos WHERE botella_id=?")->execute([$id]);
            // 3. Borrar registros de stock noche
            $db->prepare("DELETE FROM stock_noche WHERE botella_id=?")->execute([$id]);
            // 4. Ahora sí se puede borrar la botella sin violar FK
            $db->prepare("DELETE FROM inventario_botellas WHERE id=?")->execute([$id]);
            $this->json(['success'=>true,'mensaje'=>'Licor eliminado']);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }

    public function guardarStockNoche(): void {
        try {
            $d = $this->input();
            if (empty($d['id'])) throw new Exception("Falta id.");
            $db = Database::getConnection(); $hoy = date('Y-m-d');
            // Solo guardar stock_cerrado, porcentaje_abierto se calcula automáticamente
            $db->prepare("INSERT INTO stock_noche (botella_id,fecha,stock_cerrado,porcentaje_abierto)
                VALUES (?,?,?,0) ON CONFLICT (botella_id,fecha) DO UPDATE
                SET stock_cerrado=EXCLUDED.stock_cerrado")
               ->execute([$d['id'],$hoy,(int)$d['stock_cerrado']]);
            // Actualizar solo stock_cerrado en inventario_botellas
            $db->prepare("UPDATE inventario_botellas SET stock_cerrado=?,updated_at=NOW() WHERE id=?")
                ->execute([(int)$d['stock_cerrado'],$d['id']]);
            $this->json(['success'=>true]);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }

    public function guardarConfigNoche(): void {
        try {
            $d = $this->input(); $db = Database::getConnection(); $hoy = date('Y-m-d');
            $db->prepare("DELETE FROM menu_tragos_noche WHERE fecha=?")->execute([$hoy]);
            if (empty($d['tragos'])) { $this->json(['success'=>true,'total_activos'=>0]); return; }
            $stmt = $db->prepare("INSERT INTO menu_tragos_noche
                (trago_id,fecha,tipo_venta_override,precio_override)
                VALUES (?,?,?,?)
                ON CONFLICT (trago_id,fecha) DO UPDATE
                SET tipo_venta_override=EXCLUDED.tipo_venta_override,
                    precio_override=EXCLUDED.precio_override");
            foreach ($d['tragos'] as $t) {
                if (empty($t['trago_id'])) continue;
                $stmt->execute([$t['trago_id'],$hoy,$t['tipo_venta']??'VASO',(float)($t['precio']??0)]);
            }
            $this->json(['success'=>true,'total_activos'=>count($d['tragos'])]);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }

    public function getMenu(): void {
        try {
            $stmt = Database::getConnection()->query("
                SELECT mt.id, mt.nombre_boton, mt.tipo_venta, mt.precio, mt.precio_promo,
                       mt.botella_id, COALESCE(mt.combo_desc,'') AS combo_desc,
                       ib.nombre AS nombre_botella, ib.volumen_ml,
                       COALESCE(ib.vasos_por_botella,18) AS vasos_por_botella
                FROM menu_tragos mt
                JOIN inventario_botellas ib ON mt.botella_id=ib.id
                WHERE mt.nombre_boton NOT LIKE '(Oculto)%'
                ORDER BY mt.tipo_venta, mt.nombre_boton");
            $rows = $stmt->fetchAll();
            foreach ($rows as &$r) { 
                $r['precio']=(float)$r['precio']; 
                $r['precio_promo']=$r['precio_promo']?(float)$r['precio_promo']:null; 
                $r['vasos_por_botella']=(int)$r['vasos_por_botella']; 
            }
            $this->json(['success'=>true,'data'=>$rows]);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }

    public function agregarItemMenu(): void {
        try {
            $d = $this->input();
            if (empty($d['nombre_boton'])||empty($d['botella_id'])) throw new Exception("Nombre y licor base son obligatorios.");
            // Si es COMBO, guardar el refresco/complemento en complemento_id
            $complemento_id = ($d['tipo_venta'] === 'COMBO' && !empty($d['refresco_id']))
                ? $d['refresco_id']
                : null;
            Database::getConnection()->prepare(
                "INSERT INTO menu_tragos (botella_id,nombre_boton,tipo_venta,vasos_por_botella,precio,precio_promo,combo_desc,complemento_id)
                 VALUES (?,?,?,1,?,?,?,?)"
            )->execute([$d['botella_id'],trim($d['nombre_boton']),$d['tipo_venta']??'VASO',(float)$d['precio'], 
                        isset($d['precio_promo']) && $d['precio_promo']!==null && $d['precio_promo']!=='' ? (float)$d['precio_promo'] : null,
                        trim($d['combo_desc']??''),
                        $complemento_id]);
            $this->json(['success'=>true,'mensaje'=>'Agregado al catálogo']);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }

    public function editarItemMenu(string $id): void {
        try {
            $d = $this->input();
            if (empty($d['nombre_boton'])||empty($d['botella_id'])) throw new Exception("Nombre y licor base son obligatorios.");
            Database::getConnection()->prepare(
                "UPDATE menu_tragos SET botella_id=?,nombre_boton=?,tipo_venta=?,precio=?,precio_promo=?,combo_desc=? WHERE id=?"
            )->execute([$d['botella_id'],trim($d['nombre_boton']),$d['tipo_venta']??'VASO',(float)$d['precio'], 
                        isset($d['precio_promo']) && $d['precio_promo']!==null && $d['precio_promo']!=='' ? (float)$d['precio_promo'] : null,
                        trim($d['combo_desc']??''),$id]);
            $this->json(['success'=>true,'mensaje'=>'Actualizado']);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }

    public function eliminarItemMenu(string $id): void {
        try {
            Database::getConnection()->prepare("DELETE FROM menu_tragos WHERE id=?")->execute([$id]);
            $this->json(['success'=>true]);
        } catch (Exception $e) { $this->json(['success'=>false,'error'=>$e->getMessage()],500); }
    }
}