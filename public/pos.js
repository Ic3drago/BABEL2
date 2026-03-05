// ═══════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════
const API_URL = '/api';
const API_TOKEN = 'token_secreto_bar_123';

let menuItems = [];
let ticket = [];   // [{ trago_id, nombre, precio, vasos_por_botella, cantidad }]
let modeVentaGlobal = 'RAPIDO'; // 'RAPIDO' o 'MULTIPLE'
let metodoPago = 'EFECTIVO';
let categoriaActual = 'TODOS';

let itemPendientePago = null; // Guardará el payload temporal de la venta rápida antes de elegir método

function setModoVenta(modo) {
    modeVentaGlobal = modo;
    const btnR = document.getElementById('btn-modo-rapido');
    const btnM = document.getElementById('btn-modo-multiple');

    if (modo === 'RAPIDO') {
        btnR.style.background = 'var(--purple)';
        btnR.style.color = 'white';
        btnM.style.background = 'transparent';
        btnM.style.color = 'var(--sub)';
        document.getElementById('panel-ticket').style.display = 'none';
        document.getElementById('panel-recientes').style.display = 'flex';
    } else {
        btnM.style.background = 'var(--green)';
        btnM.style.color = 'white';
        btnR.style.background = 'transparent';
        btnR.style.color = 'var(--sub)';
        document.getElementById('panel-ticket').style.display = 'flex';
        document.getElementById('panel-recientes').style.display = 'none';
    }
}

function cerrarSesion() {
    if (confirm('¿Seguro que quieres salir a la pantalla principal?')) {
        localStorage.removeItem('babel_token');
        localStorage.removeItem('babel_role');
        window.location.href = '/login';
    }
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    actualizarReloj();
    setInterval(actualizarReloj, 1000);
    cargarMenu();

    try {
        const guardadas = localStorage.getItem('babel_ventas_recientes');
        if (guardadas) {
            const wrap = JSON.parse(guardadas);
            // Comprobar si las ventas son de hoy (turno actual termina a las 6am)
            if (wrap.fecha_turno === obtenerFechaTurnoLocal()) {
                ventasRecientes = wrap.ventas || [];
                renderizarVentasRecientes();
            } else {
                localStorage.removeItem('babel_ventas_recientes'); // Es de otra noche, borrar
            }
        }
    } catch (e) { }
});

// Función para determinar la fecha lógica del turno actual (corta a las 6:00 AM)
function obtenerFechaTurnoLocal() {
    const ahora = new Date();
    // Si la hora es antes de las 6:00 AM, pertenece al turno del día anterior
    if (ahora.getHours() < 6) {
        ahora.setDate(ahora.getDate() - 1);
    }
    return ahora.toISOString().split('T')[0]; // devuelve "YYYY-MM-DD"
}

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
// 4. TICKET (Y PAGO RÁPIDO)
// ═══════════════════════════════════════════════════════════
let ventasRecientes = [];

function agregarAlTicket(item) {
    if (modeVentaGlobal === 'RAPIDO') {
        itemPendientePago = {
            payload: {
                items: [{ trago_id: item.id, cantidad: 1 }],
                items_extra: []
            },
            precio: item.precio,
            nombre: item.nombre_boton
        };

        document.getElementById('pago-rapido-desc').textContent = `${item.nombre_boton} - Bs. ${item.precio.toFixed(2)}`;
        document.getElementById('modal-pago-rapido').classList.add('visible');
    } else {
        // MODO MULTIPLE: Agregar a la lista del ticket visual
        const existe = ticket.find(i => i.trago_id === item.id);
        if (existe) {
            existe.cantidad++;
        } else {
            ticket.push({
                trago_id: item.id,
                es_combo: item.tipo_venta === 'COMBO',
                licor_id: item.licor_id,
                refresco_id: item.refresco_id,
                nombre: item.nombre_boton,
                precio: item.precio,
                vasos_por_botella: item.vasos_por_botella,
                cantidad: 1,
                es_extra: false
            });
        }
        renderizarTicket();
        renderizarGrid(categoriaActual === 'TODOS' ? menuItems : menuItems.filter(i => i.tipo_venta === categoriaActual));
    }
}

function renderizarTicket() {
    const lista = document.getElementById('lista-ticket');
    lista.innerHTML = '';

    if (ticket.length === 0) {
        lista.innerHTML = `
            <div class="ticket-empty">
                <span class="icon">🍹</span>
                <p>Toca un trago para añadir</p>
            </div>
        `;
        document.getElementById('resumen-items').textContent = '0';
        document.getElementById('resumen-subtotal').textContent = 'Bs. 0.00';
        document.getElementById('resumen-total').textContent = 'Bs. 0.00';
        document.getElementById('btn-cobrar').disabled = true;
        return;
    }

    let totalItems = 0;
    let totalBs = 0;

    ticket.forEach((item, index) => {
        totalItems += item.cantidad;
        totalBs += item.precio * item.cantidad;

        const el = document.createElement('div');
        el.className = 'ticket-item';
        el.innerHTML = `
            <div class="ticket-item-nombre">${item.nombre}</div>
            <div class="ticket-item-precio">Bs. ${(item.precio * item.cantidad).toFixed(2)}</div>
            <div class="ticket-item-controles">
                <button onclick="restarDelTicket(${index})">-</button>
                <span>${item.cantidad}</span>
                <button onclick="sumarAlTicket(${index})">+</button>
            </div>
        `;
        lista.appendChild(el);
    });

    document.getElementById('resumen-items').textContent = totalItems;
    document.getElementById('resumen-subtotal').textContent = `Bs. ${totalBs.toFixed(2)}`;
    document.getElementById('resumen-total').textContent = `Bs. ${totalBs.toFixed(2)}`;
    document.getElementById('btn-cobrar').disabled = false;
}

function sumarAlTicket(index) {
    ticket[index].cantidad++;
    renderizarTicket();
    renderizarGrid(categoriaActual === 'TODOS' ? menuItems : menuItems.filter(i => i.tipo_venta === categoriaActual));
}

function restarDelTicket(index) {
    ticket[index].cantidad--;
    if (ticket[index].cantidad <= 0) ticket.splice(index, 1);
    renderizarTicket();
    renderizarGrid(categoriaActual === 'TODOS' ? menuItems : menuItems.filter(i => i.tipo_venta === categoriaActual));
}

function vaciarTicket() {
    ticket = [];
    renderizarTicket();
    renderizarGrid(categoriaActual === 'TODOS' ? menuItems : menuItems.filter(i => i.tipo_venta === categoriaActual));
}

function cerrarPagoRapido() {
    itemPendientePago = null;
    document.getElementById('modal-pago-rapido').classList.remove('visible');
}

function confirmarPagoRapido(metodo) {
    if (!itemPendientePago) return;

    const payload = itemPendientePago.payload;
    payload.tipo_pago = metodo;
    payload.efectivo_recibido = itemPendientePago.precio;

    enviarCobroRapido(payload, itemPendientePago.precio, itemPendientePago.nombre);
    cerrarPagoRapido();
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

            // NOTE: We do NOT call mostrarExito here to keep checkout instant.

            agregarVentaReciente({
                ticket: data.id_ticket, // Guardamos el UUID completo para la anulación
                nombre: nombreItemResumen,
                tipo: payload.items && payload.items[0] ? (payload.items[0].es_combo ? 'COMBO' : 'NORMAL') : '',
                total: totalEsperado,
                hora: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
                pago: payload.tipo_pago
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
    // Guardamos las ventas junto con la fecha lógica del turno actual
    const wrap = {
        fecha_turno: obtenerFechaTurnoLocal(),
        ventas: ventasRecientes
    };
    localStorage.setItem('babel_ventas_recientes', JSON.stringify(wrap));
}

function renderizarVentasRecientes() {
    const contenedor = document.getElementById('lista-recientes');
    if (!contenedor) return;
    if (ventasRecientes.length === 0) {
        contenedor.innerHTML = '<div style="text-align:center;color:var(--sub);font-size:0.9rem;margin-top:40px">Aún no hay ventas en este turno</div>';
        return;
    }
    contenedor.innerHTML = ventasRecientes.map(v => `
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:4px;box-shadow:0 2px 4px rgba(0,0,0,0.1); position:relative;">
            <button onclick="abrirModalAnular('${v.ticket}', '${v.nombre}', '${v.tipo || ''}')" style="position:absolute; top:8px; right:8px; background:var(--bg); border:1px solid var(--border); border-radius:4px; color:var(--red); font-size:1rem; cursor:pointer; padding:2px 8px; font-weight:bold; z-index:10; opacity:0.8;">✕</button>
            <div style="display:flex;justify-content:space-between;align-items:center; padding-right:32px;">
                <span style="font-weight:bold;font-size:0.95rem;">${v.nombre}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;color:var(--sub);font-size:0.75rem;font-family:var(--mono);">
                <span>#${v.ticket.substring(0, 8)} &middot; <span style="color:var(--green);font-weight:bold;">Bs. ${parseFloat(v.total).toFixed(2)}</span>${v.pago === 'QR' ? ' &middot; 📲 QR' : ''}</span>
                <span>${v.hora}</span>
            </div>
        </div>`).join('');
}

// ── VACIAR RECIENTES (SANDBOX) ──
function abrirModalVaciar() {
    if (ventasRecientes.length === 0) return;
    document.getElementById('modal-vaciar-recientes').classList.add('open');
}

function cerrarModalVaciar() {
    document.getElementById('modal-vaciar-recientes').classList.remove('open');
}

function confirmarVaciar() {
    ventasRecientes = [];
    localStorage.removeItem('babel_ventas_recientes');
    renderizarVentasRecientes();
    cerrarModalVaciar();
}

// ── ANULAR VENTA (SANDBOX) ──
let ticketAnularSelect = null;

function abrirModalAnular(ticketId, nombre, tipoItem) {
    if (ticketId.length < 20) {
        mostrarToast('Ticket muy antiguo para anular (error de versión)');
        return;
    }
    ticketAnularSelect = ticketId;

    let accionTexto = "se reabastecerá el inventario.";
    if (tipoItem === 'VASO' || tipoItem === 'ENTRADA' || nombre.toLowerCase().includes('vaso')) {
        accionTexto = "el vaso (fracción) volverá a la botella abierta.";
    } else if (tipoItem === 'BOTELLA') {
        accionTexto = "la botella entera volverá al stock cerrado.";
    } else if (tipoItem === 'COMBO') {
        accionTexto = "ambas botellas volverán al stock.";
    }

    document.getElementById('anular-desc').innerHTML = `Se eliminará el ticket <b>#${ticketId.substring(0, 8)}</b> (${nombre}) y ${accionTexto}`;
    document.getElementById('modal-anular').classList.add('open');
}

function cerrarModalAnular() {
    ticketAnularSelect = null;
    document.getElementById('modal-anular').classList.remove('open');
}

async function confirmarAnular() {
    if (!ticketAnularSelect) return;

    const btn = document.getElementById('btn-confirm-anular');
    btn.disabled = true;
    btn.textContent = 'Borrando...';

    try {
        const res = await fetch(`${API_URL}/caja/ventas/${ticketAnularSelect}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });
        const data = await res.json();

        if (data.success) {
            mostrarToast('🗑️ ' + data.mensaje);
            // Quitar de los recientes
            ventasRecientes = ventasRecientes.filter(v => v.ticket !== ticketAnularSelect);
            renderizarVentasRecientes();

            // Guardar en storage
            const wrap = {
                fecha_turno: obtenerFechaTurnoLocal(),
                ventas: ventasRecientes
            };
            localStorage.setItem('babel_ventas_recientes', JSON.stringify(wrap));

            cargarMenu(); // Refrescar los botones para ver el stock restaurado
        } else {
            mostrarToast(data.error || 'Error al anular venta');
        }
    } catch (e) {
        mostrarToast('Error de red al anular');
    }

    btn.disabled = false;
    btn.textContent = 'Sí, ANULAR';
    cerrarModalAnular();
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
            .map(i => ({ trago_id: i.trago_id, cantidad: i.cantidad, es_combo: i.es_combo, licor_id: i.licor_id, refresco_id: i.refresco_id, precio_forzado: i.precio })),
        items_extra: ticket
            .filter(i => i.es_extra)
            .map(i => ({ nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, tipo_venta: i.extra_tipo })),
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
            ticket = [];
            cargarMenu();
            renderizarTicket(); // Actualizar el ticket visual
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
        items: ticket.map(item => ({ trago_id: item.trago_id, cantidad: item.cantidad, es_combo: item.es_combo, licor_id: item.licor_id, refresco_id: item.refresco_id, precio_forzado: item.precio })),
        items_extra: ticket
            .filter(i => i.es_extra)
            .map(i => ({ nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, tipo_venta: i.extra_tipo })),
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
            cargarMenu();
            renderizarTicket(); // Actualizar el ticket visual
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

    // Ajustar botones según el modo de venta
    const btnAddE = document.getElementById('extra-btn-add-efectivo');
    const btnAddQ = document.getElementById('extra-btn-add-qr');
    if (modeVentaGlobal === 'MULTIPLE') {
        btnAddE.textContent = 'AÑADIR AL TICKET';
        btnAddE.style.background = 'var(--blue)';
        btnAddQ.style.display = 'none';
    } else {
        btnAddE.textContent = '💵 EFECTIVO';
        btnAddE.style.background = 'var(--green)';
        btnAddQ.style.display = 'block';
    }
}
function cerrarModalExtra() {
    document.getElementById('modal-extra').classList.remove('open');
}
function selExTipo(btn) {
    document.querySelectorAll('.mex-tipo').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
    exTipo = btn.dataset.t;
}
function confirmarExtra(metodo) {
    const desc = document.getElementById('ex-desc').value.trim();
    const precio = parseFloat(document.getElementById('ex-precio').value) || 0;
    if (!desc) { mostrarToast('Escribí una descripción'); return; }
    if (precio <= 0) { mostrarToast('Precio inválido'); return; }

    const payload = {
        items: [],
        items_extra: [{ nombre: desc, precio: precio, cantidad: 1, tipo_venta: exTipo }],
        tipo_pago: metodo,
        efectivo_recibido: precio
    };

    if (modeVentaGlobal === 'RAPIDO') {
        enviarCobroRapido(payload, precio, `EXTRA: ${desc}`);
        cerrarModalExtra();
    } else {
        // En MODO MULTIPLE, añadimos el extra al ticket en lugar de cobrarlo ya.
        ticket.push({
            trago_id: null,
            es_combo: false,
            nombre: `EXTRA: ${desc}`,
            precio: precio,
            cantidad: 1,
            es_extra: true,
            extra_tipo: exTipo
        });
        renderizarTicket();
        cerrarModalExtra();
    }
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
    actualizarPrecioCombo(); // Call to set initial button state
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
        const precioFloat = parseFloat(l.precio) || 0;
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ id: l.id, nombre: l.nombre_boton, precio: precioFloat });
        opt.textContent = `${l.nombre_boton} · ${l.volumen_ml}ml (Bs. ${precioFloat.toFixed(2)})`;
        licorSelect.appendChild(opt);
        refrescoSelect.appendChild(opt.cloneNode(true));
    });
}
function actualizarPrecioCombo() {
    const licorVal = document.getElementById('combo-licor').value;
    const refrescVal = document.getElementById('combo-refresco').value;
    const precioInput = parseFloat(document.getElementById('combo-precio-input').value) || 0;
    const btnAddE = document.getElementById('combo-btn-add-efectivo');
    const btnAddQ = document.getElementById('combo-btn-add-qr');

    if (!licorVal || !refrescVal) {
        document.getElementById('combo-precio-mostrado').textContent = 'Bs. 0.00';
        btnAddE.disabled = true;
        btnAddQ.disabled = true;
        return;
    }
    try {
        comboLicorSeleccionado = JSON.parse(licorVal);
        comboRefrescoSeleccionado = JSON.parse(refrescVal);
    } catch (e) { return; }

    const precioFinal = precioInput > 0 ? precioInput :
        Math.round((comboLicorSeleccionado.precio + comboRefrescoSeleccionado.precio) * 0.9 * 100) / 100;

    document.getElementById('combo-precio-mostrado').textContent = `Bs. ${precioFinal.toFixed(2)}`;

    if (modeVentaGlobal === 'MULTIPLE') {
        // En modo múltiple, solo necesitamos un botón de 'Agregar al Ticket'
        btnAddE.textContent = 'AÑADIR AL TICKET';
        btnAddE.style.background = 'var(--blue)'; // Or any distinct color
        btnAddQ.style.display = 'none';
    } else {
        btnAddE.textContent = '💵 EFECTIVO';
        btnAddE.style.background = 'var(--green)';
        btnAddQ.style.display = 'block';
    }

    btnAddE.disabled = false;
    btnAddQ.disabled = false;
}
function confirmarCombo(metodo) {
    if (!comboLicorSeleccionado || !comboRefrescoSeleccionado) {
        mostrarToast('Selecciona licor y refresco'); return;
    }
    const precioInput = parseFloat(document.getElementById('combo-precio-input').value) || 0;
    let precioCombo = precioInput > 0 ? precioInput :
        Math.round((comboLicorSeleccionado.precio + comboRefrescoSeleccionado.precio) * 0.9 * 100) / 100;
    const descCombo = `COMBO: ${comboLicorSeleccionado.nombre} + ${comboRefrescoSeleccionado.nombre}`;

    if (modeVentaGlobal === 'RAPIDO') {
        const payload = {
            items: [{
                trago_id: null,
                es_combo: true,
                licor_id: comboLicorSeleccionado.id,
                refresco_id: comboRefrescoSeleccionado.id,
                cantidad: 1,
                precio_forzado: precioCombo,
                nombre: descCombo
            }],
            items_extra: [],
            tipo_pago: metodo,
            efectivo_recibido: precioCombo
        };

        enviarCobroRapido(payload, precioCombo, descCombo);
        cerrarModalCombo();
    } else {
        ticket.push({
            trago_id: null,
            es_combo: true,
            licor_id: comboLicorSeleccionado.id,
            refresco_id: comboRefrescoSeleccionado.id,
            nombre: descCombo,
            precio: precioCombo,
            cantidad: 1,
            es_extra: false
        });
        renderizarTicket();
        cerrarModalCombo();
    }
}
document.getElementById('modal-combo').addEventListener('click', e => {
    if (e.target.id === 'modal-combo') cerrarModalCombo();
});

// ── MÓVIL: Toggle Panel Recientes ──
function toggleRecientesMobile() {
    const panel = document.getElementById('panel-recientes');
    if (panel) panel.classList.toggle('open');
}
