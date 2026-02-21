const pool = require('../config/db');

class Product {
    static async findAll() {
        const query = 'SELECT * FROM productos WHERE activo = true';
        const { rows } = await pool.query(query);
        return rows;
    }

    static async create({ nombre, tipo, contenedor, tamaño_vaso_id, precio_base }) {
        const query = `
            INSERT INTO productos (nombre, tipo, contenedor, tamaño_vaso_id, precio_base)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [nombre, tipo, contenedor, tamaño_vaso_id || null, precio_base];
        const { rows } = await pool.query(query, values);
        return rows[0];
    }
}

module.exports = Product;