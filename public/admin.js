const API_URL = '/api';
const API_TOKEN = 'token_secreto_bar_123';

document.addEventListener('DOMContentLoaded', () => {
    cargarBodega();
    cargarMenu();
});

// --- 1. SECCIÓN BODEGA ---
async function cargarBodega() {
    try {
        const res = await fetch(`${API_URL}/admin/bodega`, { headers: { 'Authorization': `Bearer ${API_TOKEN}` } });
        const data = await res.json();
        
        if (data.success) {
            // Llenar los selectores de botellas
            [
                { id: 'menu-licor', label: '-- Selecciona una Botella --' },
                { id: 'combo-licor-admin', label: '-- Selecciona un Licor --' },
                { id: 'combo-refresco-admin', label: '-- Selecciona un Refresco --' }
            ].forEach(sel => {
                const element = document.getElementById(sel.id);
                if (element) {
                    element.innerHTML = `<option value="">${sel.label}</option>`;
                    data.data.forEach(b => {
                        element.innerHTML += `<option value="${b.id}">${b.nombre} (${b.volumen_ml}ml)</option>`;
                    });
                }
            });
        }
    } catch (error) {
        console.error("Error al cargar bodega:", error);
    }
}

// --- MODAL COMBO ADMIN ---
function abrirModalComboAdmin() {
    document.getElementById('combo-nombre-admin').value = '';
    document.getElementById('combo-licor-admin').value = '';
    document.getElementById('combo-refresco-admin').value = '';
    document.getElementById('combo-precio-admin').value = '';
    abrirModal('modal-combo-admin');
    setTimeout(() => document.getElementById('combo-nombre-admin').focus(), 80);
}

async function guardarComboAdmin() {
    const nombre = document.getElementById('combo-nombre-admin').value.trim();
    const licor_id = document.getElementById('combo-licor-admin').value;
    const refresco_id = document.getElementById('combo-refresco-admin').value;
    const precio = parseFloat(document.getElementById('combo-precio-admin').value);
    
    if (!nombre || !licor_id || !refresco_id) {
        toast('Completa todos los campos', 'err');
        return;
    }
    if (isNaN(precio) || precio <= 0) {
        toast('Ingresa un precio válido', 'err');
        return;
    }
    
    const payload = {
        nombre_boton: nombre,
        tipo_venta: 'COMBO',
        botella_id: licor_id,  // El sistema lo necesita aunque es combo
        precio: precio,
        // Para combos, el backend necesitará procesar licor_id y refresco_id
        licor_id: licor_id,
        refresco_id: refresco_id
    };
    
    try {
        const res = await fetch(`${API_URL}/admin/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
            toast('🎁 Combo creado exitosamente', 'ok');
            cerrarModal('modal-combo-admin');
            cargarMenu();
        } else {
            toast(data.error || 'Error al crear combo', 'err');
        }
    } catch (error) {
        console.error('Error:', error);
        toast('Error de conexión', 'err');
    }
}

async function guardarBotella() {
    const payload = {
        nombre: document.getElementById('botella-nombre').value,
        volumen_ml: parseInt(document.getElementById('botella-ml').value),
        stock_cerrado: parseInt(document.getElementById('botella-stock').value)
    };

    const res = await fetch(`${API_URL}/admin/bodega`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
        body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (data.success) {
        alert("¡Botella guardada con éxito!");
        document.getElementById('botella-nombre').value = '';
        cargarBodega(); // Recargar la lista
    } else {
        alert("Error: " + data.error);
    }
}

// --- 2. SECCIÓN MENÚ ---
async function cargarMenu() {
    try {
        const res = await fetch(`${API_URL}/admin/menu`, { headers: { 'Authorization': `Bearer ${API_TOKEN}` } });
        const data = await res.json();
        
        if (data.success) {
            const tbody = document.getElementById('tabla-menu-body');
            tbody.innerHTML = '';
            
            data.data.forEach(m => {
                let colorCategoria = m.tipo_venta === 'PROMO' ? 'bg-purple-900 text-purple-300' : 
                                     m.tipo_venta === 'ENTRADA' ? 'bg-blue-900 text-blue-300' : 'bg-orange-900 text-orange-300';
                                     
                tbody.innerHTML += `
                    <tr class="hover:bg-gray-750">
                        <td class="p-3 font-medium">${m.nombre_boton}</td>
                        <td class="p-3"><span class="${colorCategoria} px-2 py-1 rounded text-xs">${m.tipo_venta}</span></td>
                        <td class="p-3">${m.nombre_botella}</td>
                        <td class="p-3">${m.ml_a_descontar} ml</td>
                        <td class="p-3 font-bold text-emerald-400">$${parseFloat(m.precio).toFixed(2)}</td>
                        <td class="p-3 text-center"><button class="text-red-400 hover:text-red-300">Eliminar</button></td>
                    </tr>
                `;
            });
        }
    } catch (error) {
        console.error("Error al cargar menú:", error);
    }
}

async function guardarItemMenu() {
    const payload = {
        tipo_venta: document.getElementById('menu-tipo').value,
        botella_id: document.getElementById('menu-licor').value,
        nombre_boton: document.getElementById('menu-nombre').value,
        ml_a_descontar: parseInt(document.getElementById('menu-ml').value),
        precio: parseFloat(document.getElementById('menu-precio').value)
    };

    if (!payload.botella_id) return alert("Debes seleccionar un licor base.");

    const res = await fetch(`${API_URL}/admin/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
        body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (data.success) {
        alert("¡Botón añadido al menú!");
        cargarMenu(); // Recargar la tabla
    } else {
        alert("Error: " + data.error);
    }
}