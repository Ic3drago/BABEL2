const Promo = require('../models/Promo');

exports.createPromo = async (req, res, next) => {
    try {
        const { producto_id, tipo, valor, hora_inicio, hora_fin } = req.body;

        if (!producto_id || !tipo || !valor || !hora_inicio || !hora_fin) {
            return res.status(400).json({ 
                success: false, 
                error: 'Faltan campos requeridos' 
            });
        }

        const promo = await Promo.create({
            producto_id,
            tipo,
            valor,
            hora_inicio,
            hora_fin
        });

        res.status(201).json({ 
            success: true, 
            data: promo 
        });
    } catch (error) {
        next(error);
    }
};

exports.getPromos = async (req, res, next) => {
    try {
        const promos = await Promo.getAll();
        res.json({ success: true, data: promos });
    } catch (error) {
        next(error);
    }
};

exports.deletePromo = async (req, res, next) => {
    try {
        const { id } = req.params;
        const promo = await Promo.delete(id);
        
        if (!promo) {
            return res.status(404).json({ success: false, error: 'Promo no encontrada' });
        }

        res.json({ success: true, data: promo });
    } catch (error) {
        next(error);
    }
};
