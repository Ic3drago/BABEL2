/**
 * POS.JS - Sistema de Caja BABEL
 * Gestión de tickets, combos y cobro
 */

const API_URL = '/api';
const API_TOKEN = 'token_secreto_bar_123';

let menuItems = [];
let ticket = [];
let metodoPago = 'EFECTIVO';
let categoriaActual = 'TODOS';

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    actualizarReloj();
    setInterval(actualizarReloj, 1000);
    cargarMenu();
});

function actualizarReloj() {
    const ahora = new Date();
    const el = document.getElementById('turno-hora');
    if (el) el.textContent = ahora.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════════════════════════
// 1. CARGAR MENÚ
// ═══════════════════════════════════════════════════════════
async function cargarMenu() {
    const grid = document.getElementById('grid-tragos');
    grid.innerHTML = Array(8).fill(0).map(() => `<div class="skeleton"></div>`).join('');

    try {
        const res = await fetch(`${API_URL}/caja/menu`, {
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });
        const data = await res.json();

        if (data.success && data.data.length > 0) {
            menuItems = data.data;
            renderizarGrid(menuItems);
        } else {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--sub)">
                <div style="font-size:2rem;margin-bottom:12px">🍾</div>
                <div style="font-weight:700;margin-bottom:6px">Sin tragos</div>
            </div>`;
        }
    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--red)">❌ Error</div>`;
    }
}

// ═══════════════════════════════════════════════════════════
// 2. RENDERIZAR GRID
// ═══════════════════════════════════════════════════════════
function renderizarGrid(items) {
    const grid = document.getElementById('grid-tragos');
    grid.innerHTML = '';

    // FILTRAR: NO mostrar COMBO en grid
    const filtrados = items.filter(i => i.tipo_venta !== 'COMBO');

    if (filtrados.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--sub)">Sin tragos</div>`;
        return;
    }

    filtrados.forEach(item => {
        const sinStock = item.unidades_disponibles <= 0;
        const btn = document.createElement('button');
        btn.className = `trago-btn`;
        btn.dataset.tipo = item.tipo_venta;
        btn.disabled = sinStock;
        if (!sinStock) btn.onclick = () => agregarAlTicket(item);

        btn.innerHTML = `
            <span class="trago-badge badge-${item.tipo_venta}">${item.tipo_venta}</span>
            <span class="trago-nombre">${item.nombre_boton}</span>
            <span class="trago-precio">$${item.precio.toFixed(2)}</span>
            <span class="trago-ml">${item.vasos_por_botella} vasos/btl</span>
        `;
        grid.appendChild(btn);
    });
}

// ═══════════════════════════════════════════════════════════
// 3. FILTROS
// ═══════════════════════════════════════════════════════════
function filtrar(tipo, tabEl) {
    categoriaActual = tipo;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    const filtrados = tipo === 'TODOS' ? menuItems : menuItems.filter(i => i.tipo_venta === tipo);
    renderizarGrid(filtrados);
}

// ═══════════════════════════════════════════════════════════
// 4. TICKET
// ═══════════════════════════════════════════════════════════
function agregarAlTicket(item) {
    const existente = ticket.find(t => t.trago_id === item.id);
    if (existente) {
        existente.cantidad++;
    } else {
        ticket.push({
            trago_id: item.id,
            nombre: item.nombre_boton,
            precio: item.precio,
            vasos_por_botella: item.vasos_por_botella,
            cantidad: 1,
        });
    }
    renderTicket();
}

function cambiarCantidad(tragoId, delta) {
    const idx = ticket.findIndex(t => t.trago_id === tragoId);
    if (idx === -1) return;
    ticket[idx].cantidad += delta;
    if (ticket[idx].cantidad <= 0) {
        ticket.splice(idx, 1);
    }
    renderTicket();
}

function vaciarTicket() {
    if (ticket.length === 0) return;
    ticket = [];
    renderTicket();
}

function renderTicket() {
    const contenedor = document.getElementById('lista-ticket');
    const btnCobrar = document.getElementById('btn-cobrar');

    if (ticket.length === 0) {
        contenedor.innerHTML = `
            <div class="ticket-empty">
                <span class="icon">🍹</span>
                <p>Toca un trago para añadir</p>
            </div>`;
        document.getElementById('resumen-items').textContent = '0';
        document.getElementById('resumen-subtotal').textContent = '$0.00';
        document.getElementById('resumen-total').textContent = '$0.00';
        btnCobrar.disabled = true;
        return;
    }

    let total = 0, totalItems = 0;
    contenedor.innerHTML = '';

    ticket.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        totalItems += item.cantidad;

        const div = document.createElement('div');
        div.className = 'ticket-item';
        div.innerHTML = `
            <div class="ticket-item-info">
                <div class="ticket-item-nombre">${item.nombre}</div>
                <div class="ticket-item-sub">
                    $${item.precio.toFixed(2)} × ${item.cantidad}
                </div>
            </div>
            <div class="qty-ctrl">
                <button class="qty-btn minus" onclick="cambiarCantidad('${item.trago_id}', -1)">−</button>
                <span class="qty-num">${item.cantidad}</span>
                <button class="qty-btn plus" onclick="cambiarCantidad('${item.trago_id}', 1)">+</button>
            </div>
            <div class="ticket-item-subtotal">$${subtotal.toFixed(2)}</div>
        `;
        contenedor.appendChild(div);
    });

    document.getElementById('resumen-items').textContent = totalItems;
    document.getElementById('resumen-subtotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('resumen-total').textContent = `$${total.toFixed(2)}`;
    btnCobrar.disabled = false;
}

// ═══════════════════════════════════════════════════════════
// 5. MODAL DE COBRO
// ═══════════════════════════════════════════════════════════
function abrirModalCobro() {
    if (ticket.length === 0) return;

    const total = ticket.reduce((s, i) => s + i.precio * i.cantidad, 0);

    const lista = document.getElementById('modal-items-lista');
    lista.innerHTML = ticket.map(item => `
        <div class="modal-item-row">
            <span class="modal-item-nombre">${item.nombre}</span>
            <span class="modal-item-qty">×${item.cantidad}</span>
            <span class="modal-item-precio">$${(item.precio * item.cantidad).toFixed(2)}</span>
        </div>
    `).join('');

    document.getElementById('modal-total-num').textContent = `$${total.toFixed(2)}`;
    document.getElementById('input-efectivo').value = '';
    document.getElementById('vuelto-monto').textContent = '—';

    metodoPago = 'EFECTIVO';
    document.querySelectorAll('.pago-opt').forEach(b => b.classList.remove('selected'));
    document.querySelector('[data-metodo="EFECTIVO"]').classList.add('selected');
    document.getElementById('efectivo-wrap').classList.add('visible');

    document.getElementById('modal-cobro').classList.add('visible');
}

function cerrarModalCobro() {
    document.getElementById('modal-cobro').classList.remove('visible');
}

function seleccionarPago(btn) {
    document.querySelectorAll('.pago-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    metodoPago = btn.dataset.metodo;

    const wrap = document.getElementById('efectivo-wrap');
    wrap.classList.toggle('visible', metodoPago === 'EFECTIVO');
}

function calcularVuelto() {
    const total = ticket.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const recibido = parseFloat(document.getElementById('input-efectivo').value) || 0;
    const vuelto = recibido - total;
    const el = document.getElementById('vuelto-monto');

    if (recibido === 0) { el.textContent = '—'; el.className = 'monto'; return; }
    el.textContent = `$${Math.abs(vuelto).toFixed(2)}`;
    el.className = vuelto < 0 ? 'monto negativo' : 'monto';
}

async function confirmarCobro() {
    const total = ticket.reduce((s, i) => s + i.precio * i.cantidad, 0);

    if (metodoPago === 'EFECTIVO') {
        const recibido = parseFloat(document.getElementById('input-efectivo').value) || 0;
        if (recibido < total) {
            mostrarToast('El monto recibido es menor al total');
            return;
        }
    }

    const btn = document.getElementById('btn-confirmar');
    btn.textContent = '⏳ Procesando...';
    btn.disabled = true;

    const payload = {
        items: ticket.filter(i => !i.es_extra).map(i => {
            const obj = { trago_id: i.trago_id, cantidad: i.cantidad };
            if (i.es_combo) {
                obj.licor_id = i.licor_id;
                obj.refresco_id = i.refresco_id;
                obj.nombre = i.nombre;
                obj.precio = i.precio;
            }
            return obj;
        }),
        items_extra: ticket.filter(i => i.es_extra).map(i => ({
            nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, tipo_venta: i.tipo_venta
        })),
        tipo_pago: metodoPago,
        efectivo_recibido: metodoPago === 'EFECTIVO'
            ? (parseFloat(document.getElementById('input-efectivo').value) || 0)
            : total,
    };

    try {
        const res = await fetch(`${API_URL}/caja/cobrar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok && data.success) {
            const vuelto = payload.efectivo_recibido - total;
            cerrarModalCobro();
            mostrarExito(total, vuelto > 0 ? vuelto : 0, data.id_ticket);
            ticket = [];
            renderTicket();
            cargarMenu();
        } else {
            mostrarToast(data.error || 'Error al procesar el cobro');
        }
    } catch (err) {
        console.error(err);
        mostrarToast('Error de conexión con el servidor');
    }

    btn.textContent = 'CONFIRMAR COBRO';
    btn.disabled = false;
}

function mostrarExito(total, vuelto, ticketId) {
    document.getElementById('exito-total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('exito-vuelto').textContent = vuelto > 0 ? `Vuelto: $${vuelto.toFixed(2)}` : '';
    document.getElementById('exito-ticket').textContent = ticketId ? `Ticket #${ticketId.substring(0, 8)}` : '';

    const modal = document.getElementById('modal-exito');
    modal.classList.add('visible');

    setTimeout(() => {
        modal.classList.remove('visible');
    }, 2500);
}

async function procesarFiado() {
    if (ticket.length === 0) { mostrarToast('El ticket está vacío'); return; }
    if (!confirm('¿Registrar este ticket como FIADO?')) return;

    const payload = {
        items: ticket.map(item => ({ trago_id: item.trago_id, cantidad: item.cantidad })),
        tipo_pago: 'FIADO',
        efectivo_recibido: 0,
    };

    try {
        const res = await fetch(`${API_URL}/caja/cobrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
            mostrarExito(ticket.reduce((s, i) => s + i.precio * i.cantidad, 0), 0, data.id_ticket);
            ticket = [];
            renderTicket();
            cargarMenu();
        } else {
            mostrarToast(data.error || 'Error al registrar fiado');
        }
    } catch (e) {
        mostrarToast('Error de conexión');
    }
}

// ═══════════════════════════════════════════════════════════
// 6. UTILIDADES
// ═══════════════════════════════════════════════════════════
let toastTimer;
function mostrarToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = '⚠ ' + msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// Modal de cobro fuera
document.addEventListener('click', function (e) {
    const mcobro = document.getElementById('modal-cobro');
    if (mcobro && e.target === mcobro) cerrarModalCobro();
});

// ═══════════════════════════════════════════════════════════
// 7. MODAL EXTRA
// ═══════════════════════════════════════════════════════════
let exTipo = 'VASO';

function abrirModalExtra() {
    document.getElementById('ex-desc').value = '';
    document.getElementById('ex-precio').value = '';
    exTipo = 'VASO';
    document.querySelectorAll('.mex-tipo').forEach(b => b.classList.remove('sel'));
    document.querySelector('[data-t="VASO"]').classList.add('sel');
    document.getElementById('modal-extra').classList.add('open');
    setTimeout(() => document.getElementById('ex-desc').focus(), 80);
}

function cerrarModalExtra() {
    document.getElementById('modal-extra').classList.remove('open');
}

function selExTipo(btn) {
    document.querySelectorAll('.mex-tipo').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
    exTipo = btn.dataset.t;
}

function confirmarExtra() {
    const desc = document.getElementById('ex-desc').value.trim();
    const precio = parseFloat(document.getElementById('ex-precio').value) || 0;
    if (!desc) { mostrarToast('Escribí una descripción'); return; }

    const fakeId = 'EXTRA_' + Date.now();
    const existe = ticket.find(t => t.nombre === desc && t.es_extra);
    if (existe) { existe.cantidad++; }
    else {
        ticket.push({
            trago_id: fakeId,
            nombre: desc,
            precio: precio,
            cantidad: 1,
            es_extra: true,
            tipo_venta: exTipo,
            vasos_por_botella: 0
        });
    }
    cerrarModalExtra();
    renderTicket();
    mostrarToast('✓ Extra agregado');
}

// ═══════════════════════════════════════════════════════════
// 8. MODAL COMBO
// ═══════════════════════════════════════════════════════════
let comboLicorSeleccionado = null;
let comboRefrescoSeleccionado = null;

function abrirModalCombo(item) {
    document.getElementById('combo-licor').value = '';
    document.getElementById('combo-refresco').value = '';
    document.getElementById('combo-precio-input').value = '';
    comboLicorSeleccionado = null;
    comboRefrescoSeleccionado = null;

    poblarSelectoresCombo();
    document.getElementById('modal-combo').classList.add('open');
    setTimeout(() => document.getElementById('combo-licor').focus(), 80);
}

function cerrarModalCombo() {
    document.getElementById('modal-combo').classList.remove('open');
    comboLicorSeleccionado = null;
    comboRefrescoSeleccionado = null;
}

function poblarSelectoresCombo() {
    const licorSelect = document.getElementById('combo-licor');
    const refrescoSelect = document.getElementById('combo-refresco');

    while (licorSelect.length > 1) licorSelect.remove(1);
    while (refrescoSelect.length > 1) refrescoSelect.remove(1);

    const todosLosItems = menuItems.filter(i => i.tipo_venta !== 'COMBO');
    const licores = todosLosItems; // Dejar que todos pasen como licor
    const refrescos = todosLosItems; // Dejar que todos pasen como refresco

    if (licores.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = '— Sin licores —';
        licorSelect.appendChild(opt);
    } else {
        licores.forEach(l => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify({ id: l.id, nombre: l.nombre_boton, precio: l.precio });
            opt.textContent = `${l.nombre_boton} · ${l.volumen_ml}ml ($${l.precio.toFixed(2)})`;
            licorSelect.appendChild(opt);
        });
    }

    if (refrescos.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = '— Sin refrescos —';
        refrescoSelect.appendChild(opt);
    } else {
        refrescos.forEach(r => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify({ id: r.id, nombre: r.nombre_boton, precio: r.precio });
            opt.textContent = `${r.nombre_boton} · ${r.volumen_ml}ml ($${r.precio.toFixed(2)})`;
            refrescoSelect.appendChild(opt);
        });
    }
}

function actualizarPrecioCombo() {
    const licorVal = document.getElementById('combo-licor').value;
    const refrescVal = document.getElementById('combo-refresco').value;
    const precioInput = parseFloat(document.getElementById('combo-precio-input').value) || 0;

    if (!licorVal || !refrescVal) {
        document.getElementById('combo-precio-mostrado').textContent = '$0.00';
        document.getElementById('combo-btn-add').disabled = true;
        return;
    }

    try {
        comboLicorSeleccionado = JSON.parse(licorVal);
        comboRefrescoSeleccionado = JSON.parse(refrescVal);
    } catch (e) {
        return;
    }

    const precioFinal = precioInput > 0 ? precioInput :
        Math.round((comboLicorSeleccionado.precio + comboRefrescoSeleccionado.precio) * 0.9 * 100) / 100;

    document.getElementById('combo-precio-mostrado').textContent = `$${precioFinal.toFixed(2)}`;
    document.getElementById('combo-btn-add').disabled = false;
}

function confirmarCombo() {
    if (!comboLicorSeleccionado || !comboRefrescoSeleccionado) {
        mostrarToast('Selecciona licor y refresco');
        return;
    }

    const precioCombo = parseFloat(document.getElementById('combo-precio-input').value) ||
        Math.round((comboLicorSeleccionado.precio + comboRefrescoSeleccionado.precio) * 0.9 * 100) / 100;

    if (precioCombo <= 0) {
        mostrarToast('Ingresa un precio válido');
        return;
    }

    const comboId = 'COMBO_' + Date.now();
    const comboNombre = `${comboLicorSeleccionado.nombre} + ${comboRefrescoSeleccionado.nombre}`;

    ticket.push({
        trago_id: comboId,
        nombre: comboNombre,
        precio: precioCombo,
        cantidad: 1,
        tipo_venta: 'COMBO',
        es_combo: true,
        licor_id: comboLicorSeleccionado.id,
        refresco_id: comboRefrescoSeleccionado.id,
        vasos_por_botella: 0
    });

    cerrarModalCombo();
    renderTicket();
    mostrarToast('✓ Combo agregado');
}

// Cerrar combo al hacer click fuera
document.addEventListener('click', function (e) {
    const mcombo = document.getElementById('modal-combo');
    if (mcombo && e.target === mcombo) {
        cerrarModalCombo();
    }
});

// Cerrar extra al hacer click fuera
document.addEventListener('click', function (e) {
    const mextra = document.getElementById('modal-extra');
    if (mextra && e.target === mextra) {
        cerrarModalExtra();
    }
});

// Modo promo
function verificarModoPromo() {
    const on = localStorage.getItem('babel_modo_promo') === '1';
    const banner = document.getElementById('banner-promo');
    if (banner) {
        if (on) {
            banner.classList.add('visible');
            document.body.classList.add('promo-on');
        } else {
            banner.classList.remove('visible');
            document.body.classList.remove('promo-on');
        }
    }
}
verificarModoPromo();
setInterval(verificarModoPromo, 5000);
window.addEventListener('storage', () => verificarModoPromo());


// ============================================================================
// INICIO
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    cargarMenu();
});

// ============================================================================
// 1. CARGAR MENÚ DESDE LA BD (menu_tragos JOIN inventario_botellas)
// ============================================================================
async function cargarMenu() {
    const grid = document.getElementById('grid-tragos');
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-20">⏳ Cargando bebidas...</div>';

    try {
        const res = await fetch(`${API_URL}/caja/menu`, {
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });
        const data = await res.json();

        if (data.success && data.data.length > 0) {
            menuItems = data.data;
            renderizarGrid(menuItems);
        } else {
            grid.innerHTML = `
                <div class="col-span-full text-center text-gray-500 py-20">
                    <p class="text-4xl mb-4">🍾</p>
                    <p class="font-bold text-lg">No hay tragos en el menú</p>
                    <p class="text-sm mt-2">El administrador debe crearlos en el 
                       <a href="/admin" class="text-blue-400 underline">Panel de Admin</a>.
                    </p>
                </div>`;
        }
    } catch (err) {
        console.error('Error cargando menú:', err);
        grid.innerHTML = '<div class="col-span-full text-center text-red-500 py-20">❌ Error al conectar con el servidor.</div>';
    }
}

// ============================================================================
// 2. DIBUJAR LOS BOTONES DEL GRID
// ============================================================================
const TIPO_ESTILOS = {
    PROMO: { borde: 'border-purple-500', sombra: 'hover:shadow-purple-500/30', badge: 'bg-purple-900 text-purple-300', emoji: '🎉' },
    NORMAL: { borde: 'border-orange-500', sombra: 'hover:shadow-orange-500/30', badge: 'bg-orange-900 text-orange-300', emoji: '🥃' },
    VASO: { borde: 'border-blue-500', sombra: 'hover:shadow-blue-500/30', badge: 'bg-blue-900 text-blue-300', emoji: '🍺' },
    COMBO: { borde: 'border-emerald-500', sombra: 'hover:shadow-emerald-500/30', badge: 'bg-emerald-900 text-emerald-300', emoji: '🎁' },
};

function renderizarGrid(items) {
    const grid = document.getElementById('grid-tragos');
    grid.innerHTML = '';

    // Filtrar: NO mostrar items tipo COMBO
    const itemsFiltrados = items.filter(i => i.tipo_venta !== 'COMBO');

    if (itemsFiltrados.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-20">No hay tragos en esta categoría.</div>';
        return;
    }

    itemsFiltrados.forEach(item => {
        const estilo = TIPO_ESTILOS[item.tipo_venta] || TIPO_ESTILOS.NORMAL;
        const sinStock = item.unidades_disponibles <= 0;

        const btn = document.createElement('button');
        btn.className = `
            h-28 bg-gray-800 border-2 ${estilo.borde} rounded-lg shadow
            flex flex-col items-center justify-center
            transition p-2 ${estilo.sombra} hover:shadow-lg hover:bg-gray-700
            ${sinStock ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        `.replace(/\s+/g, ' ').trim();
        btn.disabled = sinStock;

        // Para COMBO, no mostrar ml_a_descontar
        if (item.tipo_venta === 'COMBO') {
            btn.innerHTML = `
                <span class="text-xl mb-1">${estilo.emoji}</span>
                <span class="font-bold text-sm leading-tight text-center line-clamp-2">${item.nombre_boton}</span>
                <span class="text-purple-400 font-mono mt-1 text-sm font-bold">Personalizado</span>
            `;
        } else {
            // Para otros tipos, mostrar info de stock y ml
            const infoStock = item.porcentaje_abierto > 0
                ? `${Math.round(item.porcentaje_abierto)}% abierta + ${item.stock_cerrado} cerradas`
                : `${item.stock_cerrado} botellas cerradas`;

            btn.innerHTML = `
                <span class="text-xs ${estilo.badge} px-2 py-0.5 rounded-full mb-1 shrink-0">
                    ${estilo.emoji} ${item.tipo_venta}
                </span>
                <span class="font-bold text-sm leading-tight text-center line-clamp-2">${item.nombre_boton}</span>
                <span class="text-emerald-400 font-mono mt-1 text-base font-bold">$${item.precio.toFixed(2)}</span>
                <span class="text-gray-500 text-xs truncate max-w-full px-1">${item.nombre_botella}</span>
            `;
        }

        if (!sinStock) {
            btn.onclick = () => agregarAlTicket(item);
        }

        grid.appendChild(btn);
    });
}

// ============================================================================
// 3. FILTROS DE CATEGORÍA
// ============================================================================
function filtrar(tipo, btn) {
    if (btn) {
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }

    categoriaActual = tipo.toUpperCase();

    if (categoriaActual === 'TODOS') {
        renderizarGrid(menuItems);
    } else {
        renderizarGrid(menuItems.filter(i => i.tipo_venta === categoriaActual));
    }
}

// ============================================================================
// 4. GESTIÓN DEL TICKET
// ============================================================================

/**
 * Agrega o incrementa un trago en el ticket.
 * Los combos se crean desde el botón CREAR COMBO, no desde grid
 */
function agregarAlTicket(item) {
    const existente = ticket.find(t => t.trago_id === item.id);

    if (existente) {
        existente.cantidad++;
    } else {
        ticket.push({
            trago_id: item.id,
            nombre: item.nombre_boton,
            precio: item.precio,
            ml_a_descontar: item.ml_a_descontar,
            cantidad: 1,
        });
    }

    actualizarVistaTicket();
}

function quitarDelTicket(tragoId) {
    const idx = ticket.findIndex(t => t.trago_id === tragoId);
    if (idx === -1) return;

    ticket[idx].cantidad--;
    if (ticket[idx].cantidad <= 0) {
        ticket.splice(idx, 1);
    }
    actualizarVistaTicket();
}

function vaciarTicket() {
    if (ticket.length === 0) return;
    if (!confirm('¿Vaciar el ticket?')) return;
    ticket = [];
    actualizarVistaTicket();
}

// ============================================================================
// 5. RENDERIZAR TICKET EN PANTALLA
// ============================================================================
function actualizarVistaTicket() {
    const contenedor = document.getElementById('lista-ticket');
    const btnCobrar = document.getElementById('btn-cobrar');

    if (ticket.length === 0) {
        contenedor.innerHTML = '<div class="ticket-empty"><span class="icon">🍹</span><p>Toca un trago para añadir</p></div>';
        document.getElementById('resumen-items').textContent = '0';
        document.getElementById('resumen-subtotal').textContent = '$0.00';
        document.getElementById('resumen-total').textContent = '$0.00';
        btnCobrar.disabled = true;
        return;
    }

    let total = 0;
    let totalItems = 0;
    contenedor.innerHTML = '';

    ticket.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        totalItems += item.cantidad;

        const div = document.createElement('div');
        div.className = 'ticket-item';
        const infoExtra = item.es_combo ? 'Combo (2 botellas)' : '';
        div.innerHTML = `
            <div class="ticket-item-info">
                <div class="ticket-item-nombre">${item.nombre}</div>
                <div class="ticket-item-sub">
                    $${item.precio.toFixed(2)} × ${item.cantidad} ${infoExtra ? '· ' + infoExtra : ''}
                </div>
            </div>
            <div class="ticket-item-subtotal">$${subtotal.toFixed(2)}</div>
            <button
                onclick="quitarDelTicket('${item.trago_id}')"
                class="qty-btn minus"
            >−</button>
        `;
        contenedor.appendChild(div);
    });

    document.getElementById('resumen-items').textContent = totalItems;
    document.getElementById('resumen-subtotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('resumen-total').textContent = `$${total.toFixed(2)}`;
    btnCobrar.disabled = false;
}

// ============================================================================
// 6. PROCESAR EL COBRO
// ============================================================================
async function procesarCobro() {
    if (ticket.length === 0) {
        alert('El ticket está vacío.');
        return;
    }

    const btn = document.getElementById('btn-cobrar');
    btn.innerHTML = '⏳ Procesando...';
    btn.disabled = true;

    try {
        // Formato que espera CajaController::cobrar()
        const payload = {
            items: ticket.map(item => {
                const obj = {
                    trago_id: item.trago_id,   // UUID del menu_tragos
                    cantidad: item.cantidad,
                };
                // Si es combo, incluir licor_id y refresco_id
                if (item.es_combo) {
                    obj.licor_id = item.licor_id;
                    obj.refresco_id = item.refresco_id;
                    obj.nombre = item.nombre;
                    obj.precio = item.precio;
                }
                return obj;
            })
        };

        const res = await fetch(`${API_URL}/caja/cobrar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            const resumen = data.detalle
                .map(d => `  • ${d.nombre} ×${d.cantidad}  →  $${Number(d.subtotal).toFixed(2)}`)
                .join('\n');

            alert(`✅ ¡COBRO EXITOSO!\n\n${resumen}\n\n──────────────────\nTOTAL: $${data.total_cobrar}\nTicket #${data.id_ticket.substring(0, 8)}...`);

            ticket = [];
            actualizarVistaTicket();
            cargarMenu(); // Refresca stock en los botones
        } else {
            alert('❌ Error al cobrar:\n' + (data.error || 'Error desconocido'));
        }

    } catch (err) {
        console.error('Error en procesarCobro:', err);
        alert('❌ Error de conexión al servidor.');
    }

    btn.innerHTML = '💸 COBRAR';
    btn.disabled = false;
}

