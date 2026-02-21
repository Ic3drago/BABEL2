const pool = require('../config/db');

class Inventory {
    // Establecer inventario inicial
    static async setInitialInventory({ producto_id, botellas_disponibles = 0, vasos_disponibles = 0 }) {
        const query = `
            INSERT INTO inventario (producto_id, botellas_disponibles, vasos_disponibles)
            VALUES ($1, $2, $3)
            ON CONFLICT (producto_id) 
            DO UPDATE SET 
                botellas_disponibles = $2,
                vasos_disponibles = $3,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [producto_id, botellas_disponibles, vasos_disponibles]);
        return rows[0];
    }

    // Decrementar vasos vendidos
    static async decrementSoldGlasses(producto_id, cantidad) {
        const query = `
            UPDATE inventario
            SET vasos_vendidos = vasos_vendidos + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE producto_id = $2
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [cantidad, producto_id]);
        return rows[0];
    }

    // Obtener inventario actual
    static async getInventory() {
        const query = `
            SELECT 
                i.id,
                p.id as producto_id,
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

    // Resumen de cuentas (inventario inicial vs final)
    static async getAccountsSummary() {
        const query = `
            SELECT 
                p.id,
                p.nombre,
                p.tipo,
                p.precio_base,
                COALESCE(i.botellas_disponibles, 0) as botellas_iniciales,
                COALESCE(i.vasos_disponibles, 0) as vasos_iniciales,
                COALESCE(SUM(v.cantidad), 0) as cantidad_vendida,
                COALESCE(SUM(v.total), 0) as dinero_generado,
                COALESCE(i.vasos_vendidos, 0) as vasos_vendidos_registrados
            FROM productos p
            LEFT JOIN inventario i ON p.id = i.producto_id
            LEFT JOIN ventas v ON p.id = v.producto_id AND DATE(v.fecha) = CURRENT_DATE
            WHERE p.activo = true
            GROUP BY p.id, p.nombre, p.tipo, p.precio_base, i.botellas_disponibles, i.vasos_disponibles, i.vasos_vendidos
            ORDER BY p.nombre;
        `;
        const { rows } = await pool.query(query);
        return rows;
    }

    // Total resumen
    static async getTotalAccountsSummary() {
        const query = `
            SELECT 
                COALESCE(SUM(i.botellas_disponibles), 0) as botellas_iniciales_total,
                COALESCE(SUM(i.vasos_disponibles), 0) as vasos_iniciales_total,
                COALESCE(SUM(v.total), 0) as total_dinero_vendido,
                COUNT(DISTINCT v.id) as cantidad_transacciones
            FROM inventario i
            LEFT JOIN ventas v ON i.producto_id = v.producto_id AND DATE(v.fecha) = CURRENT_DATE;
        `;
        const { rows } = await pool.query(query);
        return rows[0];
    }
}

module.exports = Inventory;
