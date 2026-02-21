const pool = require('../config/db');

class Inventario {
  static async setInitialInventory(producto_id, botellas, vasos) {
    const query = `
      INSERT INTO inventario (producto_id, botellas_disponibles, vasos_disponibles, vasos_vendidos)
      VALUES ($1, $2, $3, 0)
      ON CONFLICT (producto_id) DO UPDATE SET 
        botellas_disponibles = $2,
        vasos_disponibles = $3,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    
    const { rows } = await pool.query(query, [producto_id, botellas, vasos]);
    await this.registrarMovimiento(producto_id, 'INICIALIZACION', botellas, 0, botellas, 'Inventario inicial');
    return rows[0];
  }

  static async getInventory() {
    const query = `
      SELECT 
        i.id,
        i.producto_id,
        p.nombre,
        p.tipo,
        p.precio_base,
        i.botellas_disponibles,
        i.vasos_disponibles,
        i.vasos_vendidos,
        i.updated_at
      FROM inventario i
      JOIN productos p ON i.producto_id = p.id
      ORDER BY p.nombre;
    `;
    
    const { rows } = await pool.query(query);
    return rows;
  }

  // Descontar botellas cuando se vende
  static async descontarBotellas(producto_id, botellas_usadas) {
    const query = `
      UPDATE inventario
      SET botellas_disponibles = botellas_disponibles - $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE producto_id = $1
      RETURNING botellas_disponibles;
    `;
    
    const { rows } = await pool.query(query, [producto_id, botellas_usadas]);
    if (rows.length > 0) {
      await this.registrarMovimiento(producto_id, 'VENTA', botellas_usadas, null, rows[0]?.botellas_disponibles, 'Venta registrada');
    }
    return rows[0];
  }

  // Registrar movimiento de inventario (auditoría)
  static async registrarMovimiento(producto_id, tipo, cantidad, saldo_anterior, saldo_nuevo, razon) {
    const query = `
      INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, saldo_anterior, saldo_nuevo, razon)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    
    const { rows } = await pool.query(query, [producto_id, tipo, cantidad, saldo_anterior, saldo_nuevo, razon]);
    return rows[0];
  }

  // Obtener movimientos del día
  static async getTodayMovements() {
    const query = `
      SELECT 
        m.id,
        m.producto_id,
        p.nombre,
        m.tipo_movimiento,
        m.cantidad,
        m.saldo_anterior,
        m.saldo_nuevo,
        m.razon,
        m.fecha
      FROM movimientos_inventario m
      JOIN productos p ON m.producto_id = p.id
      WHERE DATE(m.fecha) = CURRENT_DATE
      ORDER BY m.fecha DESC;
    `;
    
    const { rows } = await pool.query(query);
    return rows;
  }

  // Obtener resumen de inventario actual
  static async getTotalSummary() {
    const query = `
      SELECT 
        SUM(botellas_disponibles) as total_botellas,
        SUM(vasos_disponibles) as total_vasos,
        SUM(vasos_vendidos) as total_vasos_vendidos
      FROM inventario;
    `;
    
    const { rows } = await pool.query(query);
    return rows[0];
  }
}

module.exports = Inventario;
