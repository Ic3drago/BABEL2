// ═══════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════
const API_URL = '/api';
const API_TOKEN = 'token_secreto_bar_123';

let menuItems = [];
let ticket = [];   // [{ trago_id, nombre, precio, vasos_por_botella, cantidad }]
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
    document.getElementById('turno-hora').textContent =
        ahora.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════════════════════════
// 1. CARGAR MENÚ
// ═══════════════════════════════════════════════════════════
async function cargarMenu() {
    const grid = document.getElementById('grid-tragos');

    // Skeleton loader
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
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--sub)">
                    <div style="font-size:2rem;margin-bottom:12px">🍾</div>
                    <div style="font-weight:700;margin-bottom:6px">Sin tragos en el menú</div>
                    <div style="font-size:0.75rem">El admin debe crear los botones primero</div>
                    <a href="/admin" style="color:var(--blue);font-size:0.75rem;margin-top:8px;display:inline-block">
                        → Ir al Panel de Admin
                    </a>
                </div>`;
        }
    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--red)">
            ❌ Error al conectar con el servidor
        </div>`;
    }
}

// ═══════════════════════════════════════════════════════════
// 2. RENDERIZAR GRID
// ═══════════════════════════════════════════════════════════
function renderizarGrid(items) {
    const grid = document.getElementById('grid-tragos');
    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--sub)">
            Sin tragos en esta categoría
        </div>`;
        return;
    }

    items.forEach(item => {
        const sinStock = item.unidades_disponibles <= 0;
        const enTicket = ticket.find(t => t.trago_id === item.id);
        const qty = enTicket ? enTicket.cantidad : 0;

        const btn = document.createElement('button');
        btn.className = `trago-btn ${item.tipo_venta === 'COMBO' ? 'border-purple-500' : 'border-gray-700'}`;
        btn.dataset.tipo = item.tipo_venta;
        btn.dataset.id = item.id;
        btn.disabled = sinStock;
        if (!sinStock) btn.onclick = (e) => { crearRipple(e, btn); agregarAlTicket(item); };

        btn.innerHTML = `
            ${qty > 0 ? `<div class="trago-qty-badge" id="qty-${item.id}">${qty}</div>` : `<div class="trago-qty-badge" id="qty-${item.id}" style="display:none">${qty}</div>`}
            <span class="trago-badge badge-${item.tipo_venta}">${{ VASO: '🥃 Vaso', BOTELLA: '🍾 Botella', COMBO: '🎁 Combo', PROMO: '🎉 Promo', NORMAL: '🥃 Normal', ENTRADA: '🎫 Entrada' }[item.tipo_venta] || item.tipo_venta
            }</span>
            <span class="trago-nombre">${item.nombre_boton}</span>
            <span class="trago-precio">Bs. ${item.precio.toFixed(2)}</span>
            <span class="trago-ml">${item.nombre_botella}</span>
        `;

        grid.appendChild(btn);
    });
}

function crearRipple(e, btn) {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

// ═══════════════════════════════════════════════════════════
// 3. FILTROS
// ═══════════════════════════════════════════════════════════
function filtrar(tipo, tabEl) {
    categoriaActual = tipo;
    if (tabEl) {
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
    }
    const filtrados = tipo === 'TODOS' ? menuItems : menuItems.filter(i => i.tipo_venta === tipo);
    renderizarGrid(filtrados);
}

// ═══════════════════════════════════════════════════════════
// 4. TICKET
// ═══════════════════════════════════════════════════════════
let ventasRecientes = [];
function agregarAlTicket(item) {
    const payload = {
        items: [{ trago_id: item.id, cantidad: 1 }],
        items_extra: [],
        tipo_pago: 'EFECTIVO',
        efectivo_recibido: item.precio
    };
    enviarCobroRapido(payload, item.precio, item.nombre_boton);
}

async function enviarCobroRapido(payload, totalEsperado, nombreItemResumen) {
    try {
        const res = await fetch(`${API_URL}/caja/cobrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
            body: JSON.stringify(payload),
        });

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('babel_token'); window.location.href = '/login'; return;
        }

        const data = await res.json();
        if (res.ok && data.success) {
            mostrarToast(`✓ Vendido ${nombreItemResumen}`);
            mostrarExito(totalEsperado, 0, data.id_ticket);
            agregarVentaReciente({
                ticket: data.id_ticket.substring(0, 8),
                nombre: nombreItemResumen,
                total: totalEsperado,
                hora: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
            });
            restarStockLocal(payload);
        } else {
            alert('Error al cobrar: ' + (data.error || 'Desconocido'));
        }
    } catch (err) { alert('Error de red al cobrar.'); }
}

function restarStockLocal(payload) {
    if (!payload.items) return;
    let huboCambios = false;
    payload.items.forEach(vendido => {
        if (vendido.es_combo) {
            let licor = menuItems.find(m => m.id === vendido.licor_id);
            if (licor) { licor.unidades_disponibles--; huboCambios = true; }
            let ref = menuItems.find(m => m.id === vendido.refresco_id);
            if (ref) { ref.unidades_disponibles--; huboCambios = true; }
        } else {
            let trago = menuItems.find(m => m.id === vendido.trago_id);
            if (trago) {
                if (trago.tipo_venta === 'VASO' || trago.tipo_venta === 'ENTRADA') {
                    trago.unidades_disponibles -= (1 / Math.max(1, trago.vasos_por_botella));
                } else {
                    trago.unidades_disponibles -= 1;
                }
                huboCambios = true;
            }
        }
    });
    if (huboCambios) filtrar(categoriaActual);
}

function agregarVentaReciente(venta) {
    ventasRecientes.unshift(venta);
    if (ventasRecientes.length > 30) ventasRecientes.pop();
    renderizarVentasRecientes();
}

function renderizarVentasRecientes() {
    const contenedor = document.getElementById('lista-recientes');
    if (!contenedor) return;
    if (ventasRecientes.length === 0) {
        contenedor.innerHTML = '<div style="text-align:center;color:var(--sub);font-size:0.9rem;margin-top:40px">Aún no hay ventas en este turno</div>';
        return;
    }
    contenedor.innerHTML = ventasRecientes.map(v => `
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:4px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:bold;font-size:0.95rem;">${v.nombre}</span>
                <span style="color:var(--green);font-weight:bold;font-family:var(--mono);font-size:0.9rem;">Bs. ${parseFloat(v.total).toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;color:var(--sub);font-size:0.75rem;font-family:var(--mono);">
                <span>#${v.ticket}</span><span>${v.hora}</span>
            </div>
        </div>`).join('');
}

function abrirModalCobro() {
    if (ticket.length === 0) return;

    const total = ticket.reduce((s, i) => s + i.precio * i.cantidad, 0);

    // Llenar la lista del modal
    const lista = document.getElementById('modal-items-lista');
    lista.innerHTML = ticket.map(item => `
        <div class="modal-item-row">
            <span class="modal-item-nombre">${item.nombre}</span>
            <span class="modal-item-qty">×${item.cantidad}</span>
            <span class="modal-item-precio">Bs. ${(item.precio * item.cantidad).toFixed(2)}</span>
        </div>
    `).join('');

    document.getElementById('modal-total-num').textContent = `Bs. ${total.toFixed(2)}`;
    document.getElementById('input-efectivo').value = '';
    document.getElementById('vuelto-monto').textContent = '—';

    // Resetear método de pago
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
    if (metodoPago === 'EFECTIVO') {
        wrap.classList.add('visible');
    } else {
        wrap.classList.remove('visible');
    }
}

function calcularVuelto() {
    const total = ticket.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const recibido = parseFloat(document.getElementById('input-efectivo').value) || 0;
    const vuelto = recibido - total;
    const el = document.getElementById('vuelto-monto');

    if (recibido === 0) { el.textContent = '—'; el.className = 'monto'; return; }
    el.textContent = `Bs. ${Math.abs(vuelto).toFixed(2)}`;
    if (vuelto < 0) {
        el.textContent = `−Bs. ${Math.abs(vuelto).toFixed(2)} (falta)`;
        el.className = 'monto negativo';
    } else {
        el.className = 'monto';
    }
}

// ═══════════════════════════════════════════════════════════
// 6. CONFIRMAR COBRO → POST a la BD
// ═══════════════════════════════════════════════════════════
async function confirmarCobro() {
    const total = ticket.reduce((s, i) => s + i.precio * i.cantidad, 0);

    // Validar efectivo si aplica
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
        items: ticket
            .filter(i => !i.es_extra)
            .map(i => ({ trago_id: i.trago_id, cantidad: i.cantidad })),
        items_extra: ticket
            .filter(i => i.es_extra)
            .map(i => ({ nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, tipo_venta: i.tipo_venta })),
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

            // Cerrar modal de cobro
            cerrarModalCobro();

            // Mostrar pantalla de éxito
            mostrarExito(total, vuelto > 0 ? vuelto : 0, data.id_ticket);

            // Limpiar ticket
            ticket.forEach(t => actualizarBadgeBoton(t.trago_id, 0));
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

// ═══════════════════════════════════════════════════════════
// 7. PANTALLA DE ÉXITO
// ═══════════════════════════════════════════════════════════
function mostrarExito(total, vuelto, ticketId) {
    document.getElementById('exito-total').textContent = `Bs. ${total.toFixed(2)}`;
    document.getElementById('exito-vuelto').textContent = vuelto > 0 ? `Vuelto: Bs. ${vuelto.toFixed(2)}` : '';
    document.getElementById('exito-ticket').textContent = ticketId ? `Ticket #${ticketId.substring(0, 8)}` : '';

    const modal = document.getElementById('modal-exito');
    modal.classList.add('visible');

    setTimeout(() => {
        modal.classList.remove('visible');
    }, 2500);
}

// ═══════════════════════════════════════════════════════════
// 8. FIADO
// ═══════════════════════════════════════════════════════════
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
            ticket.forEach(t => actualizarBadgeBoton(t.trago_id, 0));
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
// 9. UTILIDADES
// ═══════════════════════════════════════════════════════════
let toastTimer;
function mostrarToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = '⚠ ' + msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// Cerrar modal al hacer click fuera
document.getElementById('modal-cobro').addEventListener('click', function (e) {
    if (e.target === this) cerrarModalCobro();
});

// ── MODO PROMO — sincronización con admin ──────────
function verificarModoPromo() {
    const on = localStorage.getItem('babel_modo_promo') === '1';
    const banner = document.getElementById('banner-promo');
    if (on) {
        banner.classList.add('visible');
        document.body.classList.add('promo-on');
    } else {
        banner.classList.remove('visible');
        document.body.classList.remove('promo-on');
    }
}
// Revisar al cargar y cada 5 segundos (el admin puede cambiarlo)
verificarModoPromo();
setInterval(verificarModoPromo, 5000);
// También escuchar cambios de storage (si admin y caja están en misma PC)
window.addEventListener('storage', e => {
    if (e.key === 'babel_modo_promo' || e.key === 'babel_promo_ts') verificarModoPromo();
});

// ── MODAL EXTRA ─────────────────────────────────────
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
    // Si ya hay uno igual, incrementa cantidad
    const existe = ticket.find(t => t.nombre === desc && t.es_extra);
    if (existe) { existe.cantidad++; }
    else {
        ticket.push({
            trago_id: fakeId, nombre: desc, precio,
            cantidad: 1, tipo_venta: exTipo, es_extra: true,
        });
    }
    cerrarModalExtra();
    renderTicket();
    mostrarToast('✓ Extra añadido');
}
document.getElementById('modal-extra').addEventListener('click', e => {
    if (e.target.id === 'modal-extra') cerrarModalExtra();
});

// ── MODAL COMBO ─────────────────────────────────────
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
}
function poblarSelectoresCombo() {
    const licorSelect = document.getElementById('combo-licor');
    const refrescoSelect = document.getElementById('combo-refresco');
    while (licorSelect.length > 1) licorSelect.remove(1);
    while (refrescoSelect.length > 1) refrescoSelect.remove(1);

    const todosLosItems = menuItems.filter(i => i.tipo_venta !== 'COMBO');

    todosLosItems.forEach(l => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ id: l.id, nombre: l.nombre_boton, precio: l.precio });
        opt.textContent = `${l.nombre_boton} · ${l.volumen_ml}ml (Bs. ${l.precio.toFixed(2)})`;
        licorSelect.appendChild(opt);
        refrescoSelect.appendChild(opt.cloneNode(true));
    });
}
function actualizarPrecioCombo() {
    const licorVal = document.getElementById('combo-licor').value;
    const refrescVal = document.getElementById('combo-refresco').value;
    const precioInput = parseFloat(document.getElementById('combo-precio-input').value) || 0;
    const btnAdd = document.getElementById('combo-btn-add');

    if (!licorVal || !refrescVal) {
        document.getElementById('combo-precio-mostrado').textContent = 'Bs. 0.00';
        btnAdd.disabled = true;
        return;
    }
    try {
        comboLicorSeleccionado = JSON.parse(licorVal);
        comboRefrescoSeleccionado = JSON.parse(refrescVal);
    } catch (e) { return; }

    const precioFinal = precioInput > 0 ? precioInput :
        Math.round((comboLicorSeleccionado.precio + comboRefrescoSeleccionado.precio) * 0.9 * 100) / 100;

    document.getElementById('combo-precio-mostrado').textContent = `Bs. ${precioFinal.toFixed(2)}`;
    btnAdd.disabled = false;
}
function confirmarCombo() {
    if (!comboLicorSeleccionado || !comboRefrescoSeleccionado) {
        mostrarToast('Selecciona licor y refresco'); return;
    }
    const precioCombo = parseFloat(document.getElementById('combo-precio-input').value) ||
        Math.round((comboLicorSeleccionado.precio + comboRefrescoSeleccionado.precio) * 0.9 * 100) / 100;
    if (precioCombo <= 0) { mostrarToast('Ingresa un precio válido'); return; }

    ticket.push({
        trago_id: 'COMBO_' + Date.now(),
        nombre: `${comboLicorSeleccionado.nombre} + ${comboRefrescoSeleccionado.nombre}`,
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
document.getElementById('modal-combo').addEventListener('click', e => {
    if (e.target.id === 'modal-combo') cerrarModalCombo();
});