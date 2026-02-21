const pool = require('../config/db');

class Entrada {
  static async getAll() {
    const query = `
      SELECT 
        e.id,
        e.nombre,
        e.descripcion,
        e.precio,
        e.product_id,
        p.nombre as producto_nombre,
        e.cantidad_items,
        e.aplica_viernes_sabado,
        e.activo
      FROM entradas e
      LEFT JOIN productos p ON e.product_id = p.id
      WHERE e.activo = true
      ORDER BY e.precio;
    `;
    
    const { rows } = await pool.query(query);
    return rows;
  }

  static async create({ nombre, descripcion, precio, product_id, cantidad_items = 1, aplica_viernes_sabado }) {
    const query = `
      INSERT INTO entradas (nombre, descripcion, precio, product_id, cantidad_items, aplica_viernes_sabado)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    
    const values = [nombre, descripcion, precio, product_id || null, cantidad_items, aplica_viernes_sabado];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async delete(id) {
    const query = `UPDATE entradas SET activo = false WHERE id = $1 RETURNING *;`;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  // Registrar venta de entrada
  static async registerSale(entrada_id, dinero_recibido, producto_id) {
    const entrada = await pool.query(`SELECT * FROM entradas WHERE id = $1`, [entrada_id]);
    if (entrada.rows.length === 0) return null;

    const e = entrada.rows[0];
    
    // Registrar como venta en tabla ventas si es necesario
    const query = `
      INSERT INTO ventas (
        producto_id, vasos_vendidos, precio_vaso, botellas_usadas,
        dinero_recibido, medio_pago, dia_semana
      ) VALUES ($1, $2, $3, $4, $5, 'EFECTIVO', 'entrada')
      RETURNING *;
    `;
    
    const values = [
      producto_id || e.product_id,
      e.cantidad_items,
      e.precio,
      0,
      dinero_recibido || e.precio
    ];
    
    const { rows } = await pool.query(query, values);
    return rows[0];
  }
}

module.exports = Entrada;
