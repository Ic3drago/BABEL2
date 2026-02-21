const Entrada = require('../models/Entrada');
const Inventario = require('../models/Inventario');

exports.getEntradas = async (req, res, next) => {
  try {
    const entradas = await Entrada.getAll();
    res.json({
      success: true,
      data: entradas
    });
  } catch (error) {
    next(error);
  }
};

exports.createEntrada = async (req, res, next) => {
  try {
    const { nombre, descripcion, precio, product_id, cantidad_items = 1, aplica_viernes_sabado } = req.body;

    if (!nombre || !precio) {
      return res.status(400).json({
        success: false,
        error: 'nombre y precio son obligatorios'
      });
    }

    const entrada = await Entrada.create({
      nombre,
      descripcion,
      precio,
      product_id: product_id || null,
      cantidad_items,
      aplica_viernes_sabado
    });

    res.status(201).json({
      success: true,
      data: entrada
    });
  } catch (error) {
    next(error);
  }
};

exports.registerEntradaSale = async (req, res, next) => {
  try {
    const { entrada_id, producto_id, dinero_recibido } = req.body;

    if (!entrada_id) {
      return res.status(400).json({
        success: false,
        error: 'entrada_id es obligatorio'
      });
    }

    const venta = await Entrada.registerSale(entrada_id, dinero_recibido, producto_id);

    if (!venta) {
      return res.status(404).json({
        success: false,
        error: 'Entrada no encontrada'
      });
    }

    res.status(201).json({
      success: true,
      data: venta,
      message: `Entrada vendida: $${dinero_recibido}`
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteEntrada = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'id es obligatorio'
      });
    }

    const entrada = await Entrada.delete(id);

    if (!entrada) {
      return res.status(404).json({
        success: false,
        error: 'Entrada no encontrada'
      });
    }

    res.json({
      success: true,
      data: entrada
    });
  } catch (error) {
    next(error);
  }
};
