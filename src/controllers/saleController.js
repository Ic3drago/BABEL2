const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');

exports.recordSale = async (req, res, next) => {
    try {
        const { producto_id, cantidad, precio_unitario, medio_pago = 'EFECTIVO' } = req.body;

        if (!producto_id || !cantidad || !precio_unitario) {
            return res.status(400).json({ 
                success: false, 
                error: 'Faltan: producto_id, cantidad, precio_unitario' 
            });
        }

        // Registrar venta
        const sale = await Sale.create({
            producto_id,
            cantidad,
            precio_unitario,
            medio_pago
        });

        // Actualizar inventario (restar vasos vendidos)
        await Inventory.decrementSoldGlasses(producto_id, cantidad);

        res.status(201).json({ 
            success: true, 
            data: sale 
        });
    } catch (error) {
        next(error);
    }
};

exports.getDaySales = async (req, res, next) => {
    try {
        const sales = await Sale.getTodaySales();
        res.json({ success: true, data: sales });
    } catch (error) {
        next(error);
    }
};

exports.getSalesSummary = async (req, res, next) => {
    try {
        const summary = await Sale.getSalesSummary();
        const total = await Sale.getTotalSales();
        
        res.json({ 
            success: true, 
            data: {
                productos: summary,
                totales: total
            }
        });
    } catch (error) {
        next(error);
    }
};
