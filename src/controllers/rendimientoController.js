const Rendimiento = require('../models/Rendimiento');

exports.createRendimiento = async (req, res, next) => {
    try {
        const { producto_botella_id, tamaño_vaso_id, vasos_por_botella } = req.body;

        if (!producto_botella_id || !tamaño_vaso_id || !vasos_por_botella) {
            return res.status(400).json({ 
                success: false, 
                error: 'Faltan campos requeridos' 
            });
        }

        const rendimiento = await Rendimiento.create({
            producto_botella_id,
            tamaño_vaso_id,
            vasos_por_botella
        });

        res.status(201).json({ 
            success: true, 
            data: rendimiento 
        });
    } catch (error) {
        next(error);
    }
};

exports.getRendimientos = async (req, res, next) => {
    try {
        const rendimientos = await Rendimiento.getAll();
        res.json({ success: true, data: rendimientos });
    } catch (error) {
        next(error);
    }
};
