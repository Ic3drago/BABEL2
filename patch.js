const fs = require('fs');

function applyPatch() {
    // 1. POS.JS
    let posjs = fs.readFileSync('public/pos.js', 'utf8');

    // A. Replace logic for agregarAlTicket -> enviarCobroRapido
    let targetTicket = `function agregarAlTicket(item) {
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
}`;

    let newTicket = `let ventasRecientes = [];
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
        const res = await fetch(\`\${API_URL}/caja/cobrar\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${getToken()}\` },
            body: JSON.stringify(payload),
        });

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('babel_token'); window.location.href = '/login'; return;
        }

        const data = await res.json();
        if (res.ok && data.success) {
            mostrarToast(\`✓ ¡Vendido! \${nombreItemResumen}\`);
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
    contenedor.innerHTML = ventasRecientes.map(v => \`
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:4px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:bold;font-size:0.95rem;">\${v.nombre}</span>
                <span style="color:var(--green);font-weight:bold;font-family:var(--mono);font-size:0.9rem;">Bs. \${parseFloat(v.total).toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;color:var(--sub);font-size:0.75rem;font-family:var(--mono);">
                <span>#\${v.ticket}</span><span>\${v.hora}</span>
            </div>
        </div>\`).join('');
}`;
    if (posjs.includes('agregarAlTicket(item) {')) {
        posjs = posjs.substring(0, posjs.indexOf(targetTicket)) + newTicket + posjs.substring(posjs.indexOf('function abrirModalCobro()'));
    }

    // B. Remove "vasos/btl" label from renderizarGrid
    let targetBtn = `        btn.innerHTML = \`
            <span class="trago-badge badge-\${item.tipo_venta}">\${item.tipo_venta}</span>
            <span class="trago-nombre">\${item.nombre_boton}</span>
            <span class="trago-precio">$\${item.precio.toFixed(2)}</span>
            <span class="trago-ml">\${item.vasos_por_botella} vasos/btl</span>
        \`;`;
    let cleanBtn = `        btn.innerHTML = \`
            <span class="trago-badge badge-\${item.tipo_venta}">\${item.tipo_venta}</span>
            <span class="trago-nombre">\${item.nombre_boton}</span>
            <span class="trago-precio">Bs. \${item.precio.toFixed(2)}</span>
        \`;`;
    posjs = posjs.replace(targetBtn, cleanBtn);

    // Replace currency $ with Bs.
    posjs = posjs.replace(/\$/g, 'Bs. ');
    fs.writeFileSync('public/pos.js', posjs);


    // 2. POS.HTML
    let poshtml = fs.readFileSync('public/pos.html', 'utf8');

    // Remove inline styles
    let styleStart = poshtml.indexOf('<style>');
    let styleEnd = poshtml.indexOf('</style>') + 8;
    if (styleStart !== -1) {
        poshtml = poshtml.substring(0, styleStart) + '<link rel="stylesheet" href="css/pos.css">' + poshtml.substring(styleEnd);
    }

    poshtml = poshtml.replace(/\$/g, 'Bs. ');

    let extraBtnHtml = `<div style="display: flex; gap: 10px;">
                <button class="btn-extra"
                    style="padding: 8px 16px; background: var(--green); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;"
                    onclick="abrirModalCombo(null)">🎉 CREAR COMBO</button>
                <button class="btn-extra"
                    style="padding: 8px 16px; background: var(--purple); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;"
                    onclick="abrirModalExtra()">➕ EXTRA</button>
            </div>`;
    poshtml = poshtml.replace('<div class="turno">Turno: <span id="turno-hora">--:--</span></div>', '<div class="turno">Turno: <span id="turno-hora">--:--</span></div>\n' + extraBtnHtml);

    poshtml = poshtml.replace('<div id="panel-ticket"', '<div id="panel-ticket" style="display:none;"');

    let panelRecientes = `<!-- PANEL RECIENTES -->
    <div id="panel-recientes"
        style="width: 320px; background: var(--bg2); border-left: 1px solid var(--border); display: flex; flex-direction: column;">
        <div
            style="padding: 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
            <h2 style="font-size: 1.1rem; color: var(--green);">🕒 Vendido Recién</h2>
        </div>
        <div id="lista-recientes"
            style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="text-align: center; color: var(--sub); font-size: 0.9rem; margin-top: 40px;">
                Aún no hay ventas en este turno
            </div>
        </div>
    </div>`;
    poshtml = poshtml.replace('<!-- MODAL EXITO -->', panelRecientes + '\n\n    <!-- MODAL EXITO -->');
    fs.writeFileSync('public/pos.html', poshtml);

    // 3. PLANILLA.HTML
    let phtml = fs.readFileSync('public/planilla.html', 'utf8');
    let pStyleStart = phtml.indexOf('<style>');
    let pStyleEnd = phtml.indexOf('</style>') + 8;
    if (pStyleStart !== -1) {
        phtml = phtml.substring(0, pStyleStart) + '<link rel="stylesheet" href="css/planilla.css">' + phtml.substring(pStyleEnd);
    }
    phtml = phtml.replace(/\$/g, 'Bs. ');

    let summaryCardInject = `<!-- DETALLE EXACTO (NUEVO) -->
        <section class="summary-card" style="margin-top: 24px;">
            <h2 style="font-size: 1.1rem; color: var(--teal); margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">Detalle Exacto de Productos Vendidos</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="padding-left: 16px;">Producto</th>
                            <th style="text-align: center;">Cantidad</th>
                            <th style="text-align: right; padding-right: 16px;">Subtotal (Bs.)</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-detalle">
                        <tr><td colspan="3" class="estado-tabla">Cargando detalles...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>`;
    phtml = phtml.replace('</main>', summaryCardInject + '\n    </main>');

    phtml = phtml.replace('function renderizar(filas, totales) {', 'function renderizar(filas, totales, detalle) {\nrenderizarDetalle(detalle);');

    let renderDetalleFn = `function renderizarDetalle(detalle) {
            const tbody = document.getElementById('tbody-detalle');
            if (!detalle || detalle.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="estado-tabla">No hay ventas registradas</td></tr>';
                return;
            }

            tbody.innerHTML = detalle.map(d => {
                let colorNombre = 'inherit';
                let styleExtras = '';
                
                if (d.nombre.includes('🥤 (Acompañante')) {
                    colorNombre = 'var(--sub)';
                    styleExtras = 'font-style: italic; opacity: 0.9;';
                } else if (d.nombre.includes('🎁 (Promo')) {
                    colorNombre = 'var(--purple)';
                } else if (d.nombre.includes('➕ (Extra)')) {
                    colorNombre = 'var(--orange)';
                }

                return \`<tr>
                    <td style="padding-left: 16px; font-weight: bold; color: \${colorNombre}; \${styleExtras}">\${d.nombre || 'Desconocido'}</td>
                    <td style="text-align: center; color: var(--blue); font-weight: bold; font-family: var(--mono);">\${d.cantidad_vendida}</td>
                    <td style="text-align: right; padding-right: 16px; color: var(--green); font-weight: bold; font-family: var(--mono);">Bs. \${parseFloat(d.subtotal).toFixed(2)}</td>
                </tr>\`;
            }).join('');
        }`;
    phtml = phtml.replace('function exportarExcel() {', renderDetalleFn + '\n\n        function exportarExcel() {');
    phtml = phtml.replace('renderizar(data.filas, data.totales);', 'renderizar(data.filas, data.totales, data.detalle_ventas);');

    fs.writeFileSync('public/planilla.html', phtml);
    console.log("Patch complete.");
}

applyPatch();
