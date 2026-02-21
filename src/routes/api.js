const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const ventaController = require('../controllers/ventaController');
const inventarioController = require('../controllers/inventarioController');
const entradaController = require('../controllers/entradaController');
const preciosController = require('../controllers/preciosController');
const rendimientoController = require('../controllers/rendimientoController');
const promoController = require('../controllers/promoController');

// ===== PRODUCTOS =====
router.get('/productos', productController.getAllProducts);
router.post('/productos', productController.createProduct);

// ===== VENTAS (Registro detallado: vasos, botellas, sobrante) =====
router.post('/venta', ventaController.recordSale);
router.get('/ventas-resumen', ventaController.getTodaySummary);
router.get('/ventas-detalle', ventaController.getTodayDetail);
router.get('/ventas-total', ventaController.getTodayTotal);

// ===== ENTRADAS (Paquetes fijos) =====
router.get('/entradas', entradaController.getEntradas);
router.post('/entradas', entradaController.createEntrada);
router.post('/entradas/venta', entradaController.registerEntradaSale);
router.delete('/entradas/:id', entradaController.deleteEntrada);

// ===== INVENTARIO =====
router.post('/inventario-inicial', inventarioController.setInitialInventory);
router.get('/inventario', inventarioController.getInventory);
router.get('/inventario/movimientos/hoy', inventarioController.getTodayMovements);
router.get('/inventario/resumen', inventarioController.getTotalSummary);

// ===== PRECIOS DINÁMICOS =====
router.get('/precios-por-hora', preciosController.getPreciosPorHora);
router.post('/precios-por-hora', preciosController.createPrecio);
router.get('/precios-por-hora/:producto_id/actual', preciosController.getPrecioActual);
router.delete('/precios-por-hora/:id', preciosController.deletePrecio);

// ===== RENDIMIENTOS (Vasos por botella) =====
router.post('/rendimientos', rendimientoController.createRendimiento);
router.get('/rendimientos', rendimientoController.getRendimientos);

// ===== PROMOS =====
router.post('/promos', promoController.createPromo);
router.get('/promos', promoController.getPromos);
router.delete('/promos/:id', promoController.deletePromo);

module.exports = router;