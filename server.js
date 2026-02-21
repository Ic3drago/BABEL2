const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares Globales
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Implementación de Rutas (MVC)
app.use('/api', apiRoutes);

// Manejador Global de Errores (Evita try/catch vacíos y caídas del servidor)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
    });
});

app.listen(PORT, () => {
    console.log(`Servidor POS corriendo en el puerto ${PORT}`);
});