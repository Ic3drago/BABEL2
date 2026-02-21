const PreciosPorHora = require('../models/PreciosPorHora');

exports.getPreciosPorHora = async (req, res, next) => {
  try {
    const precios = await PreciosPorHora.getAll();
    res.json({
      success: true,
      data: precios
    });
  } catch (error) {
    next(error);
  }
};

exports.createPrecio = async (req, res, next) => {
  try {
    const { producto_id, hora_inicio, hora_fin, precio_vaso, aplicable_viernes_sabado } = req.body;

    if (!producto_id || !hora_inicio || !hora_fin || !precio_vaso) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos: producto_id, hora_inicio, hora_fin, precio_vaso'
      });
    }

    const precio = await PreciosPorHora.create({
      producto_id,
      hora_inicio,
      hora_fin,
      precio_vaso,
      aplicable_viernes_sabado
    });

    res.status(201).json({
      success: true,
      data: precio
    });
  } catch (error) {
    next(error);
  }
};

exports.getPrecioActual = async (req, res, next) => {
  try {
    const { producto_id } = req.params;

    if (!producto_id) {
      return res.status(400).json({
        success: false,
        error: 'producto_id es obligatorio'
      });
    }

    const precio = await PreciosPorHora.getPrecioActual(producto_id);

    res.json({
      success: true,
      data: { precio_actual: precio }
    });
  } catch (error) {
    next(error);
  }
};

exports.deletePrecio = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'id es obligatorio'
      });
    }

    const precio = await PreciosPorHora.delete(id);

    if (!precio) {
      return res.status(404).json({
        success: false,
        error: 'Precio no encontrado'
      });
    }

    res.json({
      success: true,
      data: precio
    });
  } catch (error) {
    next(error);
  }
};
