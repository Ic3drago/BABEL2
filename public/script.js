const API = '/api';
let productos = [];
let inventario = [];
let entradas = [];
let preciosPorHora = [];

document.addEventListener('DOMContentLoaded', async () => {
  actualizarHora();
  setInterval(actualizarHora, 1000);
  
  await cargarProductos();
  await cargarInventario();
  await cargarEntradas();
  await cargarPreciosPorHora();
  
  setupEventListeners();
  mostrarProductosVenta();
  mostrarEntradasVenta();
  cargarInventarioInicial();
  mostrarInventarioActual();
  mostrarCuentasEnTiempoReal();
  cargarSelects();
  cargarRendimientos();
  cargarPromos();
});


function actualizarHora() {
  const now = new Date();
  const el = document.getElementById('timeDisplay');
  if (el) el.textContent = now.toLocaleTimeString('es-AR');
}

// ===== CARGAR DATOS =====
async function cargarProductos() {
  try {
    const res = await fetch(`${API}/productos`);
    productos = await res.json();
  } catch (err) {
    console.error('Error cargando productos:', err);
    alert('⚠️ Error conectando a BD. Verifica DATABASE_URL en .env');
  }
}

async function cargarInventario() {
  try {
    const res = await fetch(`${API}/inventario`);
    const data = await res.json();
    if (data.success) {
      inventario = data.data || [];
    }
  } catch (err) {
    console.error('Error cargando inventario:', err);
  }
}

async function cargarEntradas() {
  try {
    const res = await fetch(`${API}/entradas`);
    const data = await res.json();
    if (data.success) {
      entradas = data.data || [];
    }
  } catch (err) {
    console.error('Error cargando entradas:', err);
  }
}

async function cargarPreciosPorHora() {
  try {
    const res = await fetch(`${API}/precios-por-hora`);
    const data = await res.json();
    if (data.success) {
      preciosPorHora = data.data || [];
    }
  } catch (err) {
    console.error('Error cargando precios:', err);
  }
}

// ===== EVENTOS =====
function setupEventListeners() {
  const btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) {
    btnAdmin.addEventListener('click', () => {
      document.getElementById('ventaSection').classList.add('hidden');
      document.getElementById('adminSection').classList.remove('hidden');
      cargarSelects();
      cargarRendimientos();
      cargarPromos();
    });
  }

  const btnVolverVenta = document.getElementById('btnVolverVenta');
  if (btnVolverVenta) {
    btnVolverVenta.addEventListener('click', () => {
      document.getElementById('adminSection').classList.add('hidden');
      document.getElementById('ventaSection').classList.remove('hidden');
    });
  }

  // Tabs del admin
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      const tabId = tabName + 'Tab';
      const tab = document.getElementById(tabId);
      if (tab) {
        tab.classList.add('active');
        // Cargar datos cuando se abre cada tab
        if (tabName === 'bebidas') cargarSelects();
        if (tabName === 'rendimientos') cargarRendimientos();
        if (tabName === 'promos') cargarPromos();
      }
    });
  });

  // Inventario Inicial
  document.getElementById('btnSetearInventario')?.addEventListener('click', setearInventarioInicial);

  // Productos
  document.getElementById('btnAgregarProd')?.addEventListener('click', agregarProducto);

  // Rendimientos
  document.getElementById('btnAgregarRend')?.addEventListener('click', agregarRendimiento);

  // Entradas
  document.getElementById('btnAgregarEntrada')?.addEventListener('click', agregarEntrada);

  // Precios Dinámicos
  document.getElementById('btnAgregarPrecio')?.addEventListener('click', agregarPrecio);

  // Promos
  document.getElementById('btnAgregarPromo')?.addEventListener('click', agregarPromo);

  // Reportes
  document.getElementById('btnReporteVentas')?.addEventListener('click', exportarReporteVentas);
  document.getElementById('btnReporteInventario')?.addEventListener('click', exportarReporteInventario);
  document.getElementById('btnReporteProductos')?.addEventListener('click', exportarReporteProductos);

  // Cierre de caja
  document.getElementById('btnCerrarCaja')?.addEventListener('click', cerrarCaja);
  document.getElementById('btnExportarCuentas')?.addEventListener('click', exportarCuentas);
  document.getElementById('btnCerrarModal')?.addEventListener('click', () => {
    document.getElementById('resumenModal').style.display = 'none';
  });
}

// ===== REGISTRO RÁPIDO DE VENTAS =====
async function registrarVentaDetallada(producto_id, vasos_vendidos, precio_vaso, botellas_usadas, sobrante_porcentaje, precio_botella) {
  try {
    const res = await fetch(`${API}/venta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producto_id,
        vasos_vendidos,
        precio_vaso,
        botellas_usadas,
        sobrante_porcentaje,
        precio_botella,
        dinero_recibido: vasos_vendidos * precio_vaso,
        medio_pago: 'EFECTIVO'
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}`);
      await cargarInventario();
      mostrarCuentasEnTiempoReal();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (err) {
    console.error('Error registrando venta:', err);
    alert('Error registrando venta');
  }
}

async function registrarEntrada(entrada_id, producto_id, dinero_recibido) {
  try {
    const res = await fetch(`${API}/entradas/venta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entrada_id,
        producto_id,
        dinero_recibido
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}`);
      await cargarInventario();
      mostrarCuentasEnTiempoReal();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (err) {
    console.error('Error registrando entrada:', err);
    alert('Error registrando entrada');
  }
}

function flashEfecto(elemento, tipo) {
  if (!elemento) return;
  elemento.classList.add(tipo);
  setTimeout(() => elemento.classList.remove(tipo), 350);
}

// ===== MOSTRAR PRODUCTOS VENTA =====
function mostrarProductosVenta() {
  const grid = document.getElementById('productosVentaGrid');
  if (!grid || productos.length === 0) return;

  grid.innerHTML = '';
  productos.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'producto-btn';
    btn.innerHTML = `
      <div class="producto-nombre">${p.nombre}</div>
      <div class="producto-tipo">${p.tipo}</div>
      <div class="producto-precio">$${parseFloat(p.precio_base).toFixed(2)}</div>
    `;
    btn.addEventListener('click', () => mostrarModalVenta(p));
    grid.appendChild(btn);
  });
}

function mostrarEntradasVenta() {
  const grid = document.getElementById('entradasVentaGrid');
  if (!grid || entradas.length === 0) return;

  grid.innerHTML = '';
  entradas.forEach(e => {
    const btn = document.createElement('button');
    btn.className = 'entrada-btn';
    btn.innerHTML = `
      <div>${e.nombre}</div>
      <div style="font-size: 14px; margin-top: 5px;">$${parseFloat(e.precio).toFixed(2)}</div>
    `;
    btn.addEventListener('click', () => registrarEntrada(e.id, e.product_id, e.precio));
    grid.appendChild(btn);
  });
}

// Modal para registrar venta detallada de bebida
async function mostrarModalVenta(producto) {
  const vasos = prompt(`¿Cuántos vasos de ${producto.nombre}?`);
  if (!vasos || vasos <= 0) return;

  const botellas = prompt(`¿Cuántas botellas usadas?`);
  if (!botellas || botellas < 0) return;

  const sobrante = prompt(`¿Porcentaje de sobrante? (0-100)`, '0');
  const precio = prompt(`¿Precio por vaso? ($${producto.precio_base})`);
  const precioBot = prompt(`¿Costo de botella? ($200)`);

  if (!precio || !precioBot) return;

  registrarVentaDetallada(
    producto.id,
    parseInt(vasos),
    parseFloat(precio),
    parseFloat(botellas),
    parseFloat(sobrante) || 0,
    parseFloat(precioBot)
  );
}

// ===== INVENTARIO INICIAL =====
async function setearInventarioInicial() {
  const productoId = parseInt(document.getElementById('prodInicial')?.value);
  const botellas = parseFloat(document.getElementById('botellasInicial')?.value) || 0;
  const vasos = parseFloat(document.getElementById('vasosInicial')?.value) || 0;

  if (!productoId) {
    alert('Selecciona un producto');
    return;
  }

  try {
    const res = await fetch(`${API}/inventario-inicial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        producto_id: productoId, 
        botellas_disponibles: botellas, 
        vasos_disponibles: vasos 
      })
    });

    const data = await res.json();
    if (data.success) {
      alert('✅ Inventario inicial registrado');
      document.getElementById('prodInicial').value = '';
      document.getElementById('botellasInicial').value = '';
      document.getElementById('vasosInicial').value = '';
      await cargarInventario();
      mostrarInventarioActual();
    }
  } catch (err) {
    console.error('Error:', err);
    alert('Error registrando inventario');
  }
}

function cargarInventarioInicial() {
  const select = document.getElementById('prodInicial');
  if (!select) return;

  select.innerHTML = '<option value="">-- Selecciona producto --</option>';
  productos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nombre;
    select.appendChild(opt);
  });
}

function mostrarInventarioActual() {
  const list = document.getElementById('inventarioActual');
  if (!list) return;

  if (inventario.length === 0) {
    list.innerHTML = '<p>Sin inventario registrado</p>';
    return;
  }

  list.innerHTML = '';
  inventario.forEach(inv => {
    const div = document.createElement('div');
    div.className = 'inventory-item';
    div.innerHTML = `
      <strong>${inv.nombre}</strong><br>
      Botellas: ${inv.botellas_disponibles} | Vasos: ${inv.vasos_disponibles} | Vendidos: ${inv.vasos_vendidos}
    `;
    list.appendChild(div);
  });
}

// ===== CUENTAS EN TIEMPO REAL =====
async function mostrarCuentasEnTiempoReal() {
  try {
    const res = await fetch(`${API}/ventas-resumen`);
    const data = await res.json();
    
    if (!data.success) return;

    const detalle = data.data.detalle || [];
    const total = data.data.total || {};
    const div = document.getElementById('cuentasEnTiempoReal');
    if (!div) return;

    let html = `
      <div class="resumen- stats">
        <div class="stat-item">
          <span class="stat-label">💵 Dinero Total:</span>
          <span class="stat-value">$${parseFloat(total.dinero_total || 0).toFixed(2)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">📦 Costo:</span>
          <span class="stat-value">$${parseFloat(total.costo_total || 0).toFixed(2)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">💚 Ganancia Neta:</span>
          <span class="stat-value">$${parseFloat(total.ganancia_total || 0).toFixed(2)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">🥃 Vasos:</span>
          <span class="stat-value">${total.total_vasos || 0}</span>
        </div>
      </div>
    `;
    
    html += '<table class="cuentas-table"><thead><tr><th>Producto</th><th>Vasos</th><th>Dinero</th><th>Costo</th><th>Ganancia</th></tr></thead><tbody>';
    
    detalle.forEach(p => {
      const dinero = parseFloat(p.dinero_generado) || 0;
      const costo = parseFloat(p.costo_botellas) || 0;
      const ganancia = dinero - costo;
      html += `
        <tr>
          <td>${p.nombre}</td>
          <td>${p.total_vasos_vendidos}</td>
          <td>$${dinero.toFixed(2)}</td>
          <td>$${costo.toFixed(2)}</td>
          <td style="color: var(--lime); font-weight: bold;">$${ganancia.toFixed(2)}</td>
        </tr>
      `;
    });
    
    html += `</tbody></table>`;
    div.innerHTML = html;
  } catch (err) {
    console.error('Error cargando cuentas:', err);
  }
}

// ===== CIERRE DE CAJA =====
async function cerrarCaja() {
  try {
    const resResumen = await fetch(`${API}/ventas-resumen`);
    const dataResumen = await resResumen.json();
    const detalle = dataResumen.data.detalle || [];
    const totales = dataResumen.data.total || {};

    let html = '<h2 style="color: var(--lime); text-align: center; margin-bottom: 30px;">📊 CIERRE DE CAJA</h2>';
    
    html += `<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px;">
      <div style="background: linear-gradient(135deg, rgba(233,30,99,0.2), rgba(233,30,99,0.05)); padding: 20px; border-radius: 8px; border: 2px solid var(--primary);">
        <p style="font-size: 12px; color: #aaa;">DINERO TOTAL</p>
        <p style="font-size: 28px; color: var(--primary); font-weight: bold; margin: 10px 0;">$${parseFloat(totales.dinero_total || 0).toFixed(2)}</p>
      </div>
      <div style="background: linear-gradient(135deg, rgba(244,67,54,0.2), rgba(244,67,54,0.05)); padding: 20px; border-radius: 8px; border: 2px solid #f44336;">
        <p style="font-size: 12px; color: #aaa;">COSTO BOTELLAS</p>
        <p style="font-size: 28px; color: #f44336; font-weight: bold; margin: 10px 0;">-$${parseFloat(totales.costo_total || 0).toFixed(2)}</p>
      </div>
      <div style="background: linear-gradient(135deg, rgba(127,255,0,0.2), rgba(127,255,0,0.05)); padding: 20px; border-radius: 8px; border: 2px solid var(--lime);">
        <p style="font-size: 12px; color: #aaa;">GANANCIA NETA</p>
        <p style="font-size: 28px; color: var(--lime); font-weight: bold; margin: 10px 0;">$${parseFloat(totales.ganancia_total || 0).toFixed(2)}</p>
      </div>
    </div>`;

    html += `<div style="background: rgba(156,39,176,0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid var(--secondary);">
      <p><strong>Transacciones:</strong> ${totales.total_transacciones || 0} | <strong>Vasos Vendidos:</strong> ${totales.total_vasos || 0}</p>
    </div>`;

    html += '<table style="width: 100%; border-collapse: collapse;"><thead style="background: var(--secondary); color: white;"><tr><th style="padding: 12px; text-align: left;">Producto</th><th style="padding: 12px; text-align: center;">Vasos</th><th style="padding: 12px; text-align: right;">Dinero</th><th style="padding: 12px; text-align: right;">Costo</th><th style="padding: 12px; text-align: right;">Ganancia</th></tr></thead><tbody>';
    
    detalle.forEach(p => {
      const dinero = parseFloat(p.dinero_generado) || 0;
      const costo = parseFloat(p.costo_botellas) || 0;
      const ganancia = dinero - costo;
      html += `
        <tr style="border-bottom: 1px solid rgba(233,30,99,0.2);">
          <td style="padding: 12px;">${p.nombre}</td>
          <td style="padding: 12px; text-align: center;">${p.total_vasos_vendidos || 0}</td>
          <td style="padding: 12px; text-align: right;">$${dinero.toFixed(2)}</td>
          <td style="padding: 12px; text-align: right;">-$${costo.toFixed(2)}</td>
          <td style="padding: 12px; text-align: right; color: var(--lime); font-weight: bold;">$${ganancia.toFixed(2)}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';

    document.getElementById('resumenCuentas').innerHTML = html;
    document.getElementById('resumenModal').style.display = 'flex';
  } catch (err) {
    console.error('Error cerrando caja:', err);
    alert('Error generando resumen');
  }
}

// ===== EXPORTAR CUENTAS =====
function exportarCuentas() {
  const resumen = document.getElementById('resumenCuentas').innerHTML;
  if (!resumen) {
    alert('Genera el resumen primero (CERRAR CAJA)');
    return;
  }

  const ventana = window.open('', '', 'width=900,height=600');
  ventana.document.write(`
    <html><head>
      <title>Resumen de Cuentas - BAR PRIDE</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 20px; 
          background: #f5f5f5;
          color: #333;
        }
        h2 { color: #e91e63; margin-bottom: 20px; }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 12px; 
          text-align: left; 
        }
        th { 
          background: linear-gradient(135deg, #e91e63, #9c27b0);
          color: white;
          font-weight: bold;
        }
        tr:hover { background: #f5f5f5; }
        .resumen-header { 
          background: linear-gradient(135deg, #e91e63, #9c27b0); 
          color: white;
          padding: 20px; 
          margin: 20px 0;
          border-radius: 8px;
        }
        .resumen-header p { margin: 10px 0; font-size: 16px; }
        .buttons {
          margin-top: 40px; 
          text-align: center;
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        button {
          padding: 10px 20px;
          font-size: 16px;
          cursor: pointer;
          border: none;
          border-radius: 5px;
          background: #e91e63;
          color: white;
          font-weight: bold;
        }
        button:hover { background: #9c27b0; }
      </style>
    </head><body>
      ${resumen}
      <div class="buttons">
        <button onclick="window.print()">Imprimir</button>
        <button onclick="window.close()">Cerrar</button>
      </div>
    </body></html>
  `);
}

// Actualizar cuentas cada 10 segundos
setInterval(mostrarCuentasEnTiempoReal, 10000);

// ===== PRODUCTOS =====
async function agregarProducto() {
  const nombre = document.getElementById('prodNombre')?.value;
  const tipo = document.getElementById('prodTipo')?.value;
  const precio = parseFloat(document.getElementById('prodPrecio')?.value);

  if (!nombre || !tipo || !precio) {
    alert('Completa todos los campos');
    return;
  }

  try {
    const res = await fetch(`${API}/productos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, tipo, contenedor: tipo, precio_base: precio })
    });

    const data = await res.json();
    if (data.success) {
      alert('✅ Bebida agregada');
      document.getElementById('prodNombre').value = '';
      document.getElementById('prodTipo').value = '';
      document.getElementById('prodPrecio').value = '';
      await cargarProductos();
      mostrarProductosVenta();
      cargarSelects();
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

// ===== RENDIMIENTOS =====
async function agregarRendimiento() {
  const producto = document.getElementById('rendProducto')?.value;
  const tamano = document.getElementById('rendTamano')?.value;
  const vasos = parseFloat(document.getElementById('rendVasos')?.value);

  if (!producto || !tamano || !vasos) {
    alert('Completa todos los campos');
    return;
  }

  try {
    const res = await fetch(`${API}/rendimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producto_botella_id: parseInt(producto),
        tamaño_vaso_id: parseInt(tamano),
        vasos_por_botella: vasos
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ Rendimiento: ${vasos} vasos por botella`);
      document.getElementById('rendProducto').value = '';
      document.getElementById('rendTamano').value = '';
      document.getElementById('rendVasos').value = '';
      cargarRendimientos();
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

async function cargarRendimientos() {
  try {
    const res = await fetch(`${API}/rendimientos`);
    const data = await res.json();
    const list = document.getElementById('rendimientosList');
    if (!list || !data.success) return;

    list.innerHTML = '';
    data.data.forEach(r => {
      const div = document.createElement('div');
      div.className = 'rendimiento-item';
      div.innerHTML = `
        <strong>${r.producto_nombre}</strong> → <strong>${r.vasos_por_botella} vasos</strong> (${r.tamaño_nombre})
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

// ===== PROMOS =====
async function agregarPromo() {
  const producto = document.getElementById('promoProducto')?.value;
  const tipo = document.getElementById('promoTipo')?.value;
  const valor = parseFloat(document.getElementById('promoValor')?.value);
  const horaIni = document.getElementById('promoHoraIni')?.value;
  const horaFin = document.getElementById('promoHoraFin')?.value;

  if (!producto || !tipo || !valor || !horaIni || !horaFin) {
    alert('Completa todos los campos');
    return;
  }

  try {
    const res = await fetch(`${API}/promos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producto_id: parseInt(producto),
        tipo,
        valor,
        hora_inicio: horaIni,
        hora_fin: horaFin
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ Promo: ${tipo === '2x1' ? '2 x 1' : valor + '% OFF'}`);
      document.getElementById('promoProducto').value = '';
      document.getElementById('promoTipo').value = '';
      document.getElementById('promoValor').value = '';
      document.getElementById('promoHoraIni').value = '';
      document.getElementById('promoHoraFin').value = '';
      cargarPromos();
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

async function cargarPromos() {
  try {
    const res = await fetch(`${API}/promos`);
    const data = await res.json();
    const list = document.getElementById('promosList');
    if (!list || !data.success) return;

    list.innerHTML = '';
    data.data.forEach(p => {
      const div = document.createElement('div');
      div.className = 'promo-item';
      const tipoText = p.tipo === '2x1' ? '2 x 1' : `${p.valor}% OFF`;
      div.innerHTML = `
        <div>
          <strong>${p.nombre}</strong><br>
          ${tipoText} | ${p.hora_inicio} - ${p.hora_fin}
        </div>
        <button class="btn-delete" onclick="eliminarPromo(${p.id})">X</button>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

async function eliminarPromo(id) {
  if (confirm('¿Eliminar esta promo?')) {
    try {
      await fetch(`${API}/promos/${id}`, { method: 'DELETE' });
      cargarPromos();
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

// ===== ENTRADAS =====
async function agregarEntrada() {
  const nombre = document.getElementById('entradaNombre')?.value;
  const descripcion = document.getElementById('entradaDescripcion')?.value;
  const precio = parseFloat(document.getElementById('entradaPrecio')?.value);
  const producto = document.getElementById('entradaProducto')?.value;
  const aplica = document.getElementById('entradaAplica')?.value;

  if (!nombre || !precio) {
    alert('nombre y precio obligatorios');
    return;
  }

  try {
    const res = await fetch(`${API}/entradas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        descripcion,
        precio,
        product_id: producto ? parseInt(producto) : null,
        aplica_viernes_sabado: aplica
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ Entrada creada: ${nombre}`);
      document.getElementById('entradaNombre').value = '';
      document.getElementById('entradaDescripcion').value = '';
      document.getElementById('entradaPrecio').value = '';
      document.getElementById('entradaProducto').value = '';
      document.getElementById('entradaAplica').value = '';
      await cargarEntradas();
      mostrarEntradasVenta();
      cargarEntradasAdmin();
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

async function cargarEntradasAdmin() {
  try {
    const res = await fetch(`${API}/entradas`);
    const data = await res.json();
    const list = document.getElementById('entradasList');
    if (!list || !data.success) return;

    list.innerHTML = '';
    data.data.forEach(e => {
      const div = document.createElement('div');
      div.className = 'entrada-item';
      div.innerHTML = `
        <div class="entrada-info">
          <strong>${e.nombre}</strong>
          <small>${e.descripcion || ''}</small>
          <small>$${parseFloat(e.precio).toFixed(2)}</small>
        </div>
        <button class="btn-delete" onclick="eliminarEntrada(${e.id})">X</button>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

async function eliminarEntrada(id) {
  if (confirm('¿Eliminar entrada?')) {
    try {
      await fetch(`${API}/entradas/${id}`, { method: 'DELETE' });
      await cargarEntradas();
      cargarEntradasAdmin();
      mostrarEntradasVenta();
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

// ===== PRECIOS DINÁMICOS =====
async function agregarPrecio() {
  const producto = document.getElementById('precioProducto')?.value;
  const horaIni = document.getElementById('precioHoraIni')?.value;
  const horaFin = document.getElementById('precioHoraFin')?.value;
  const precio = parseFloat(document.getElementById('precioPrecio')?.value);
  const aplica = document.getElementById('precioAplica')?.value;

  if (!producto || !horaIni || !horaFin || !precio) {
    alert('Completa todos los campos');
    return;
  }

  try {
    const res = await fetch(`${API}/precios-por-hora`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producto_id: parseInt(producto),
        hora_inicio: horaIni,
        hora_fin: horaFin,
        precio_vaso: precio,
        aplicable_viernes_sabado: aplica
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ Precio dinámico guardado`);
      document.getElementById('precioProducto').value = '';
      document.getElementById('precioHoraIni').value = '';
      document.getElementById('precioHoraFin').value = '';
      document.getElementById('precioPrecio').value = '';
      document.getElementById('precioAplica').value = '';
      await cargarPreciosPorHora();
      cargarPreciosAdmin();
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

async function cargarPreciosAdmin() {
  try {
    const res = await fetch(`${API}/precios-por-hora`);
    const data = await res.json();
    const list = document.getElementById('preciosList');
    if (!list || !data.success) return;

    list.innerHTML = '';
    data.data.forEach(p => {
      const div = document.createElement('div');
      div.className = 'precio-item';
      div.innerHTML = `
        <div class="precio-info">
          <strong>${p.nombre}</strong>
          <small>${p.hora_inicio} - ${p.hora_fin}</small>
          <small>$${parseFloat(p.precio_vaso).toFixed(2)}</small>
        </div>
        <button class="btn-delete" onclick="eliminarPrecio(${p.id})">X</button>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

async function eliminarPrecio(id) {
  if (confirm('¿Eliminar precio?')) {
    try {
      await fetch(`${API}/precios-por-hora/${id}`, { method: 'DELETE' });
      await cargarPreciosPorHora();
      cargarPreciosAdmin();
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

// ===== SELECTS DINÁMICOS =====
function cargarSelects() {
  // Selects para admin
  const selects = ['rendProducto', 'promoProducto', 'prodInicial', 'precioProducto', 'entradaProducto'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      select.innerHTML = '<option value="">-- Selecciona --</option>';
      productos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        select.appendChild(opt);
      });
    }
  });

  // Tamaños (si existe)
  const selectTamanos = document.getElementById('rendTamano');
  if (selectTamanos) {
    selectTamanos.innerHTML = '<option value="">-- Selecciona tamaño --</option>';
  }

  cargarInventarioInicial();
}

// ===== EXPORTAR A EXCEL =====
function exportarReporteVentas() {
  fetch(`${API}/ventas-detalle`)
    .then(res => res.json())
    .then(data => {
      const ventas = data.data.ventas || [];
      const total = data.data.total || {};
      
      // Datos de resumen
      const resumen = [{
        'RESUMEN': '',
        'Dinero Total': parseFloat(total.dinero_total || 0).toFixed(2),
        'Costo Total': parseFloat(total.costo_total || 0).toFixed(2),
        'Ganancia Neta': parseFloat(total.ganancia_total || 0).toFixed(2),
        'Total Vasos': total.total_vasos || 0,
        'Transacciones': total.total_transacciones || 0
      }];

      // Datos detallados
      const detalle = ventas.map(v => ({
        'Producto': v.nombre,
        'Vasos': v.vasos_vendidos,
        'Precio/Vaso': parseFloat(v.precio_vaso).toFixed(2),
        'Botellas': v.botellas_usadas,
        'Costo/Botella': parseFloat(v.precio_botella || 0).toFixed(2),
        'Dinero Recibido': parseFloat(v.dinero_recibido).toFixed(2),
        'Costo Botellas': (v.botellas_usadas * (v.precio_botella || 0)).toFixed(2),
        'Ganancia': (v.dinero_recibido - (v.botellas_usadas * (v.precio_botella || 0))).toFixed(2),
        'Hora': v.fecha
      }));

      const wb = XLSX.utils.book_new();
      const wsResumen = XLSX.utils.json_to_sheet(resumen);
      const wsDetalle = XLSX.utils.json_to_sheet(detalle);
      
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
      XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Ventas');
      XLSX.writeFile(wb, `Ventas_${new Date().toLocaleDateString('es-AR')}.xlsx`);
      alert('✅ Reporte de ventas exportado');
    })
    .catch(err => console.error('Error:', err));
}

function exportarReporteInventario() {
  fetch(`${API}/inventario/movimientos/hoy`)
    .then(res => res.json())
    .then(data => {
      const movimientos = data.data || [];
      const ws = XLSX.utils.json_to_sheet(movimientos.map(m => ({
        'Producto': m.nombre,
        'Tipo': m.tipo_movimiento,
        'Cantidad': m.cantidad,
        'Saldo Anterior': m.saldo_anterior,
        'Saldo Nuevo': m.saldo_nuevo,
        'Razón': m.razon,
        'Hora': m.fecha
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Movimientos Inventario');
      XLSX.writeFile(wb, `Inventario_${new Date().toLocaleDateString('es-AR')}.xlsx`);
      alert('✅ Reporte de inventario exportado');
    })
    .catch(err => console.error('Error:', err));
}

function exportarReporteProductos() {
  const ws = XLSX.utils.json_to_sheet(productos.map(p => ({
    'Producto': p.nombre,
    'Tipo': p.tipo,
    'Contenedor': p.contenedor,
    'Precio Base': parseFloat(p.precio_base).toFixed(2),
    'Activo': p.activo ? 'Si' : 'No'
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  XLSX.writeFile(wb, `Productos_${new Date().toLocaleDateString('es-AR')}.xlsx`);
  alert('✅ Reporte exportado');
}
