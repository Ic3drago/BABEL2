const Product = require('../models/Product');

exports.getAllProducts = async (req, res, next) => {
    try {
        const products = await Product.findAll();
        res.json(products);
    } catch (error) {
        // Pasar el error al manejador global
        next(error); 
    }
};

exports.createProduct = async (req, res, next) => {
    try {
        const { nombre, tipo, contenedor, tamaño_vaso_id, precio_base } = req.body;
        
        if (!nombre || !tipo || !precio_base) {
            return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
        }

        const newProduct = await Product.create({ nombre, tipo, contenedor, tamaño_vaso_id, precio_base });
        res.status(201).json({ success: true, data: newProduct });
    } catch (error) {
        next(error);
    }
};