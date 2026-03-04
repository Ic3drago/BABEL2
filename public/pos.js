/**
 * POS.JS - Sistema de Caja BABEL
 * Gestión de tickets, combos y cobro
 */

const API_URL = '/api';
function getToken() {
    return localStorage.getItem('babel_token');
}

let menuItems = [];
let ventasRecientes = []; // Guarda las últimas ventas para visibilidad rápida
let categoriaActual = 'TODOS';

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        window.location.href = '/login';
        return;
    }
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
        const res = await fetch(`Bs. {API_URL}/caja/menu`, {
            headers: { 'Authorization': `Bearer Bs. {getToken()}` }
        });
        if (res.status === 401 || res.status === 403) { localStorage.removeItem('babel_token'); window.location.href = '/login'; return; }
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
// 2. DIBUJAR LOS BOTONES DEL GRID
// ═══════════════════════════════════════════════════════════
function renderizarGrid(items) {
    const grid = document.getElementById('grid-tragos');
    grid.innerHTML = '';

    // Filtrar: NO mostrar items tipo COMBO en la grilla principal
    const itemsFiltrados = items.filter(i => i.tipo_venta !== 'COMBO');

    if (itemsFiltrados.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-20" style="color: var(--sub);">No hay tragos en esta categoría.</div>';
        return;
    }

    itemsFiltrados.forEach(item => {
        const sinStock = item.unidades_disponibles <= 0;

        const btn = document.createElement('button');
        btn.className = `trago-btn`;
        btn.dataset.tipo = item.tipo_venta;
        btn.disabled = sinStock;

        if (!sinStock) {
            btn.onclick = () => agregarAlTicket(item);
        }

        btn.innerHTML = `
            <span class="trago-badge badge-Bs. {item.tipo_venta}">Bs. {item.tipo_venta}</span>
            <span class="trago-nombre">Bs. {item.nombre_boton}</span>
            <span class="trago-precio">Bs. Bs. {item.precio.toFixed(2)}</span>
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
// 4. FLUJO DE CAJA INMEDIATA
// ═══════════════════════════════════════════════════════════
function agregarAlTicket(item) {
    // Construir el payload directo para un solo ítem
    const payload = {
        items: [{
            trago_id: item.id,
            cantidad: 1,
            // Si estuviéramos guardando un combo pre-armado iría acá, pero acá solo llegan tragos normales
        }],
        items_extra: [],
        tipo_pago: 'EFECTIVO',
        efectivo_recibido: item.precio
    };

    enviarCobroRapido(payload, item.precio, item.nombre_boton);
}

// Envío general a la API
async function enviarCobroRapido(payload, totalEsperado, nombreItemResumen) {
    try {
        const res = await fetch(`Bs. {API_URL}/caja/cobrar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer Bs. {getToken()}`,
            },
            body: JSON.stringify(payload),
        });

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('babel_token');
            window.location.href = '/login';
            return;
        }

        const textResponse = await res.text();
        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            console.error("Error parseando respuesta del servidor:", textResponse);
            alert('Error 500: El servidor falló silenciosamente. Revisa la red.');
            return;
        }

        if (res.ok && data.success) {
            mostrarToast(`✓ ¡Vendido! Bs. {nombreItemResumen}`);
            mostrarExito(totalEsperado, 0, data.id_ticket);

            // Agregar al listado rápido
            agregarVentaReciente({
                ticket: data.id_ticket.substring(0, 8),
                nombre: nombreItemResumen,
                total: totalEsperado,
                hora: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
            });

            // Disminuir stock visualmente sin recargar
            restarStockLocal(payload);

        } else {
            alert('Error al cobrar: ' + (data.error || 'Desconocido'));
        }
    } catch (err) {
        alert('Error de red al intentar cobrar.');
        console.error("CATCH ERROR:", err);
    }
}

function mostrarExito(total, vuelto, ticketId) {
    document.getElementById('exito-total').textContent = `Bs. Bs. {total.toFixed(2)}`;
    document.getElementById('exito-vuelto').textContent = vuelto > 0 ? `Vuelto: Bs. Bs. {vuelto.toFixed(2)}` : '';
    document.getElementById('exito-ticket').textContent = ticketId ? `Ticket #Bs. {ticketId.substring(0, 8)}` : '';

    const modal = document.getElementById('modal-exito');
    modal.classList.add('visible');

    setTimeout(() => {
        modal.classList.remove('visible');
    }, 2500);
}



// ═══════════════════════════════════════════════════════════
// 6. UTILIDADES, LOCAL STOCK Y RECIENTES
// ═══════════════════════════════════════════════════════════

function restarStockLocal(payload) {
    if (!payload.items || payload.items.length === 0) return;

    let huboCambios = false;

    payload.items.forEach(vendido => {
        if (vendido.es_combo) {
            // Descontar licor
            let licor = menuItems.find(m => m.id === vendido.licor_id);
            if (licor) { licor.unidades_disponibles--; huboCambios = true; }

            // Descontar refresco
            let ref = menuItems.find(m => m.id === vendido.refresco_id);
            if (ref) { ref.unidades_disponibles--; huboCambios = true; }
        } else {
            // Trago normal
            let trago = menuItems.find(m => m.id === vendido.trago_id);
            if (trago) {
                if (trago.tipo_venta === 'BOTELLA' || trago.tipo_venta === 'NORMAL' || trago.tipo_venta === 'PROMO') {
                    trago.unidades_disponibles -= 1;
                } else if (trago.tipo_venta === 'VASO' || trago.tipo_venta === 'ENTRADA') {
                    // Restar una fraccion (un vaso) a botellas_entera = 1 / vasos_por_botella. Simplificado:
                    trago.unidades_disponibles -= (1 / Math.max(1, trago.vasos_por_botella));
                }
                huboCambios = true;
            }
        }
    });

    if (huboCambios) {
        filtrar(categoriaActual); // Re-renderizar con el stock actualizado en memoria
    }
}

function agregarVentaReciente(venta) {
    ventasRecientes.unshift(venta); // Al principio
    if (ventasRecientes.length > 30) ventasRecientes.pop(); // Max 30 en UI

    renderizarVentasRecientes();
}

function renderizarVentasRecientes() {
    const lista = document.getElementById('lista-recientes');
    if (!lista) return;

    if (ventasRecientes.length === 0) {
        lista.innerHTML = `
            <div style="text-align: center; color: var(--sub); font-size: 0.9rem; margin-top: 40px;">
                Aún no hay ventas en este turno
            </div>`;
        return;
    }

    lista.innerHTML = ventasRecientes.map(v => `
        <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: var(--text);">Bs. {v.nombre}</div>
                <div style="font-size: 0.75rem; color: var(--sub); font-family: var(--mono);">#Bs. {v.ticket} · Bs. {v.hora}</div>
            </div>
            <div style="font-family: var(--mono); font-weight: bold; color: var(--green);">
                Bs. Bs. {v.total.toFixed(2)}
            </div>
        </div>
    `).join('');
}

let toastTimer;
function mostrarToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = '⚠ ' + msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}



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

    const payload = {
        items: [],
        items_extra: [{
            nombre: desc,
            precio: precio,
            cantidad: 1,
            tipo_venta: exTipo
        }],
        tipo_pago: 'EFECTIVO',
        efectivo_recibido: precio
    };

    cerrarModalExtra();
    enviarCobroRapido(payload, precio, desc);
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
            opt.textContent = `Bs. {l.nombre_boton} · Bs. {l.volumen_ml}ml (Bs. Bs. {l.precio.toFixed(2)})`;
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
            opt.textContent = `Bs. {r.nombre_boton} · Bs. {r.volumen_ml}ml (Bs. Bs. {r.precio.toFixed(2)})`;
            refrescoSelect.appendChild(opt);
        });
    }
}

function actualizarPrecioCombo() {
    const licorVal = document.getElementById('combo-licor').value;
    const refrescVal = document.getElementById('combo-refresco').value;
    const precioInput = parseFloat(document.getElementById('combo-precio-input').value) || 0;

    if (!licorVal || !refrescVal) {
        document.getElementById('combo-precio-mostrado').textContent = 'Bs. 0.00';
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

    document.getElementById('combo-precio-mostrado').textContent = `Bs. Bs. {precioFinal.toFixed(2)}`;
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
    const comboNombre = `Bs. {comboLicorSeleccionado.nombre} + Bs. {comboRefrescoSeleccionado.nombre}`;

    const payload = {
        items: [{
            trago_id: comboId,
            cantidad: 1,
            es_combo: true,
            licor_id: comboLicorSeleccionado.id,
            refresco_id: comboRefrescoSeleccionado.id,
            nombre: comboNombre,
            precio: precioCombo
        }],
        items_extra: [],
        tipo_pago: 'EFECTIVO',
        efectivo_recibido: precioCombo
    };

    cerrarModalCombo();
    enviarCobroRapido(payload, precioCombo, comboNombre);
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


