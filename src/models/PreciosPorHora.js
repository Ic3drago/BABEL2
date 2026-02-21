const pool = require('../config/db');

class PreciosPorHora {
  static async getAll() {
    const query = `
      SELECT 
        ph.id,
        ph.producto_id,
        p.nombre,
        ph.hora_inicio,
        ph.hora_fin,
        ph.precio_vaso,
        ph.aplicable_viernes_sabado,
        ph.activo
      FROM precios_por_hora ph
      JOIN productos p ON ph.producto_id = p.id
      WHERE ph.activo = true
      ORDER BY ph.hora_inicio;
    `;
    
    const { rows } = await pool.query(query);
    return rows;
  }

  static async create({ producto_id, hora_inicio, hora_fin, precio_vaso, aplicable_viernes_sabado }) {
    const query = `
      INSERT INTO precios_por_hora (producto_id, hora_inicio, hora_fin, precio_vaso, aplicable_viernes_sabado)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (producto_id, hora_inicio, hora_fin) DO UPDATE SET precio_vaso = $4
      RETURNING *;
    `;
    
    const values = [producto_id, hora_inicio, hora_fin, precio_vaso, aplicable_viernes_sabado];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  // Obtener precio vigente para un producto
  static async getPrecioActual(producto_id) {
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    const dia = new Date().toLocaleString('es-AR', { weekday: 'long' });
    
    const query = `
      SELECT precio_vaso
      FROM precios_por_hora
      WHERE producto_id = $1
        AND $2::TIME BETWEEN hora_inicio AND hora_fin
        AND activo = true
        AND (aplicable_viernes_sabado IS NULL 
             OR aplicable_viernes_sabado ILIKE $3)
      LIMIT 1;
    `;
    
    const { rows } = await pool.query(query, [producto_id, now, `%${dia}%`]);
    return rows.length > 0 ? rows[0].precio_vaso : null;
  }

  static async delete(id) {
    const query = `UPDATE precios_por_hora SET activo = false WHERE id = $1 RETURNING *;`;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }
}

module.exports = PreciosPorHora;
