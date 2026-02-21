const pool = require('../config/db');

class Venta {
  // Registrar venta detallada (vasos + botellas + sobrante)
  static async create({
    producto_id,
    vasos_vendidos,
    precio_vaso,
    botellas_usadas,
    sobrante_porcentaje,
    precio_botella,
    dinero_recibido,
    medio_pago = 'EFECTIVO'
  }) {
    const dia_semana = new Date().toLocaleString('es-AR', { weekday: 'long' });
    
    const query = `
      INSERT INTO ventas (
        producto_id, vasos_vendidos, precio_vaso, botellas_usadas,
        sobrante_porcentaje, precio_botella, dinero_recibido, medio_pago, dia_semana
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    
    const values = [
      producto_id, vasos_vendidos, precio_vaso, botellas_usadas,
      sobrante_porcentaje || 0, precio_botella, dinero_recibido, medio_pago, dia_semana
    ];
    
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  // Obtener resumen del día
  static async getTodaySummary() {
    const query = `
      SELECT 
        p.id,
        p.nombre,
        p.tipo,
        COUNT(v.id) as transacciones,
        COALESCE(SUM(v.vasos_vendidos), 0) as total_vasos_vendidos,
        COALESCE(SUM(v.botellas_usadas), 0) as total_botellas_usadas,
        COALESCE(SUM(v.dinero_recibido), 0) as dinero_generado,
        COALESCE(SUM(v.botellas_usadas * v.precio_botella), 0) as costo_botellas,
        COALESCE(SUM(v.dinero_recibido) - SUM(v.botellas_usadas * v.precio_botella), 0) as ganancia_neta
      FROM ventas v
      RIGHT JOIN productos p ON v.producto_id = p.id
      WHERE DATE(v.fecha) = CURRENT_DATE
      GROUP BY p.id, p.nombre, p.tipo
      ORDER BY dinero_generado DESC;
    `;
    
    const { rows } = await pool.query(query);
    return rows;
  }

  // Obtener detalle completo del día
  static async getTodayDetail() {
    const query = `
      SELECT 
        v.id,
        v.producto_id,
        p.nombre,
        p.tipo,
        v.vasos_vendidos,
        v.precio_vaso,
        v.botellas_usadas,
        v.sobrante_porcentaje,
        v.precio_botella,
        v.dinero_recibido,
        v.medio_pago,
        v.fecha,
        v.dia_semana,
        (v.vasos_vendidos * v.precio_vaso) as ingresos_vasos,
        (v.botellas_usadas * v.precio_botella) as costo_botellas
      FROM ventas v
      JOIN productos p ON v.producto_id = p.id
      WHERE DATE(v.fecha) = CURRENT_DATE
      ORDER BY v.fecha DESC;
    `;
    
    const { rows } = await pool.query(query);
    return rows;
  }

  // Total del día
  static async getTodayTotal() {
    const query = `
      SELECT 
        COALESCE(SUM(dinero_recibido), 0) as dinero_total,
        COALESCE(SUM(botellas_usadas * precio_botella), 0) as costo_total,
        COALESCE(SUM(dinero_recibido) - SUM(botellas_usadas * precio_botella), 0) as ganancia_total,
        COUNT(*) as total_transacciones,
        COALESCE(SUM(vasos_vendidos), 0) as total_vasos
      FROM ventas
      WHERE DATE(fecha) = CURRENT_DATE;
    `;
    
    const { rows } = await pool.query(query);
    return rows[0];
  }
}

module.exports = Venta;
