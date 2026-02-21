const pool = require('../config/db');

class Sale {
    // Registrar venta
    static async create({ producto_id, cantidad, precio_unitario, medio_pago, mozo_nombre = 'Admin' }) {
        const total = cantidad * precio_unitario;
        const query = `
            INSERT INTO ventas (producto_id, cantidad, precio_unitario, total, medio_pago, mozo_nombre)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const values = [producto_id, cantidad, precio_unitario, total, medio_pago, mozo_nombre];
        const { rows } = await pool.query(query, values);
        return rows[0];
    }

    // Obtener ventas del día
    static async getTodaySales() {
        const query = `
            SELECT 
                v.id,
                p.nombre,
                p.tipo,
                v.cantidad,
                v.precio_unitario,
                v.total,
                v.medio_pago,
                v.fecha
            FROM ventas v
            JOIN productos p ON v.producto_id = p.id
            WHERE DATE(v.fecha) = CURRENT_DATE
            ORDER BY v.fecha DESC;
        `;
        const { rows } = await pool.query(query);
        return rows;
    }

    // Resumen de ventas por producto (para cierre)
    static async getSalesSummary() {
        const query = `
            SELECT 
                p.id,
                p.nombre,
                p.tipo,
                p.precio_base,
                COALESCE(SUM(v.cantidad), 0) as cantidad_vendida,
                COALESCE(SUM(v.total), 0) as total_vendido
            FROM productos p
            LEFT JOIN ventas v ON p.id = v.producto_id AND DATE(v.fecha) = CURRENT_DATE
            WHERE p.activo = true
            GROUP BY p.id, p.nombre, p.tipo, p.precio_base
            ORDER BY p.nombre;
        `;
        const { rows } = await pool.query(query);
        return rows;
    }

    // Total ventas del día
    static async getTotalSales() {
        const query = `
            SELECT 
                COALESCE(SUM(total), 0) as total_dinero,
                COUNT(*) as cantidad_operaciones,
                COUNT(DISTINCT DATE(fecha)) as dias
            FROM ventas
            WHERE DATE(fecha) = CURRENT_DATE;
        `;
        const { rows } = await pool.query(query);
        return rows[0];
    }
}

module.exports = Sale;
