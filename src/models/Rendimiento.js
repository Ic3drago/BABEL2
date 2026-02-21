const pool = require('../config/db');

class Rendimiento {
    // Crear rendimiento (botellas a vasos)
    static async create({ producto_botella_id, tamaño_vaso_id, vasos_por_botella }) {
        const query = `
            INSERT INTO rendimientos (producto_botella_id, tamaño_vaso_id, vasos_por_botella)
            VALUES ($1, $2, $3)
            ON CONFLICT (producto_botella_id, tamaño_vaso_id)
            DO UPDATE SET vasos_por_botella = $3
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [producto_botella_id, tamaño_vaso_id, vasos_por_botella]);
        return rows[0];
    }

    // Obtener todos
    static async getAll() {
        const query = `
            SELECT 
                r.id,
                r.producto_botella_id,
                pb.nombre as producto_nombre,
                r.tamaño_vaso_id,
                tv.nombre as tamaño_nombre,
                r.vasos_por_botella,
                r.activo
            FROM rendimientos r
            JOIN productos pb ON r.producto_botella_id = pb.id
            JOIN tamaños_vasos tv ON r.tamaño_vaso_id = tv.id
            ORDER BY pb.nombre, tv.nombre;
        `;
        const { rows } = await pool.query(query);
        return rows;
    }
}

module.exports = Rendimiento;
