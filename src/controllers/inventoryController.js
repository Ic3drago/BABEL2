const Inventory = require('../models/Inventory');

exports.setInitialInventory = async (req, res, next) => {
    try {
        const { producto_id, botellas_disponibles = 0, vasos_disponibles = 0 } = req.body;

        if (!producto_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Se requiere producto_id' 
            });
        }

        const inventory = await Inventory.setInitialInventory({
            producto_id,
            botellas_disponibles,
            vasos_disponibles
        });

        res.status(201).json({ 
            success: true, 
            data: inventory 
        });
    } catch (error) {
        next(error);
    }
};

exports.getInventory = async (req, res, next) => {
    try {
        const inventory = await Inventory.getInventory();
        res.json({ success: true, data: inventory });
    } catch (error) {
        next(error);
    }
};

exports.getAccountsSummary = async (req, res, next) => {
    try {
        const detail = await Inventory.getAccountsSummary();
        const totals = await Inventory.getTotalAccountsSummary();

        res.json({ 
            success: true, 
            data: {
                detalle: detail,
                totales: totals
            }
        });
    } catch (error) {
        next(error);
    }
};
