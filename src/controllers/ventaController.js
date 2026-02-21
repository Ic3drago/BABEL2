const Venta = require('../models/Venta');
const Inventario = require('../models/Inventario');

exports.recordSale = async (req, res, next) => {
  try {
    const {
      producto_id,
      vasos_vendidos,
      precio_vaso,
      botellas_usadas,
      sobrante_porcentaje,
      precio_botella,
      dinero_recibido,
      medio_pago = 'EFECTIVO'
    } = req.body;

    if (!producto_id || vasos_vendidos === undefined || !precio_vaso || botellas_usadas === undefined || !precio_botella) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos: producto_id, vasos_vendidos, precio_vaso, botellas_usadas, precio_botella'
      });
    }

    // Registrar venta
    const venta = await Venta.create({
      producto_id,
      vasos_vendidos,
      precio_vaso,
      botellas_usadas,
      sobrante_porcentaje: sobrante_porcentaje || 0,
      precio_botella,
      dinero_recibido: dinero_recibido || (vasos_vendidos * precio_vaso),
      medio_pago
    });

    // Descontar del inventario
    await Inventario.descontarBotellas(producto_id, botellas_usadas);

    res.status(201).json({
      success: true,
      data: venta,
      message: `Venta registrada: ${vasos_vendidos} vasos, ${botellas_usadas} botellas, Ganancia: $${dinero_recibido - (botellas_usadas * precio_botella)}`
    });
  } catch (error) {
    next(error);
  }
};

exports.getTodaySummary = async (req, res, next) => {
  try {
    const resumen = await Venta.getTodaySummary();
    const total = await Venta.getTodayTotal();
    
    res.json({
      success: true,
      data: {
        detalle: resumen,
        total: total
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTodayDetail = async (req, res, next) => {
  try {
    const detalle = await Venta.getTodayDetail();
    const total = await Venta.getTodayTotal();

    res.json({
      success: true,
      data: {
        ventas: detalle,
        total: total
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTodayTotal = async (req, res, next) => {
  try {
    const total = await Venta.getTodayTotal();
    
    res.json({
      success: true,
      data: total
    });
  } catch (error) {
    next(error);
  }
};
