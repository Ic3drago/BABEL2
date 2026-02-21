const pool = require('../config/db');

class Promo {
    // Crear promo
    static async create({ producto_id, tipo, valor, hora_inicio, hora_fin }) {
        const query = `
            INSERT INTO promos (producto_id, tipo, valor, hora_inicio, hora_fin)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [producto_id, tipo, valor, hora_inicio, hora_fin]);
        return rows[0];
    }

    // Obtener todos
    static async getAll() {
        const query = `
            SELECT 
                p.id,
                p.producto_id,
                pr.nombre,
                p.tipo,
                p.valor,
                p.hora_inicio,
                p.hora_fin,
                p.activo
            FROM promos p
            JOIN productos pr ON p.producto_id = pr.id
            WHERE p.activo = true
            ORDER BY pr.nombre, p.hora_inicio;
        `;
        const { rows } = await pool.query(query);
        return rows;
    }

    // Obtener por ID
    static async getById(id) {
        const query = `
            SELECT * FROM promos WHERE id = $1;
        `;
        const { rows } = await pool.query(query, [id]);
        return rows[0];
    }

    // Eliminar
    static async delete(id) {
        const query = `DELETE FROM promos WHERE id = $1 RETURNING *;`;
        const { rows } = await pool.query(query, [id]);
        return rows[0];
    }
}

module.exports = Promo;
