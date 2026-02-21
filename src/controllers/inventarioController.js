const Inventario = require('../models/Inventario');

exports.setInitialInventory = async (req, res, next) => {
  try {
    const { producto_id, botellas, vasos } = req.body;

    if (!producto_id || botellas === undefined || vasos === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos: producto_id, botellas, vasos'
      });
    }

    const inventario = await Inventario.setInitialInventory(producto_id, botellas, vasos);

    res.status(201).json({
      success: true,
      data: inventario,
      message: `Inventario iniciado: ${botellas} botellas, ${vasos} vasos`
    });
  } catch (error) {
    next(error);
  }
};

exports.getInventory = async (req, res, next) => {
  try {
    const inventario = await Inventario.getInventory();
    res.json({
      success: true,
      data: inventario
    });
  } catch (error) {
    next(error);
  }
};

exports.getTodayMovements = async (req, res, next) => {
  try {
    const movimientos = await Inventario.getTodayMovements();
    res.json({
      success: true,
      data: movimientos
    });
  } catch (error) {
    next(error);
  }
};

exports.getTotalSummary = async (req, res, next) => {
  try {
    const resumen = await Inventario.getTotalSummary();
    res.json({
      success: true,
      data: resumen
    });
  } catch (error) {
    next(error);
  }
};
