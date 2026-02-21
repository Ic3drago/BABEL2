// Script para crear las tablas en PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    try {
        const sql = fs.readFileSync('./schema.sql', 'utf8');
        
        console.log('Conectando a BD...');
        const client = await pool.connect();
        
        console.log('Ejecutando schema SQL...');
        await client.query(sql);
        
        console.log('✅ Tablas creadas exitosamente');
        client.release();
        
        // Verificar que se crearon
        const result = await pool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        );
        
        console.log('\n📊 Tablas en la BD:');
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
        pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

initDB();
