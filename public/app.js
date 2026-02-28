const API_URL = '/api';
const API_TOKEN = 'token_secreto_bar_123'; // Esto protege tu API para que nadie más meta datos

// Establecer la fecha de hoy por defecto en el input
const dateInput = document.getElementById('session-date');
dateInput.valueAsDate = new Date();

// Función dinámica para saber qué sesión estamos editando (usa la fecha seleccionada)
function getSessionId() {
    return dateInput.value; // Ej: "2026-02-25"
}

// Función base para comunicarse con Supabase a través de tu API PHP
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = { 
        method, 
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${API_TOKEN}` 
        } 
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_URL}${endpoint}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en el servidor');
    return data;
}

// 1. Cargar los tragos al iniciar la página
document.addEventListener('DOMContentLoaded', loadProducts);

async function loadProducts() {
    try {
        const products = await apiCall('/products');
        const tbody = document.getElementById('sheet-body');
        tbody.innerHTML = ''; 

        if(products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" class="p-8 text-gray-500 text-center">No hay licores registrados. Agrega uno en el panel de arriba.</td></tr>';
            return;
        }

        // Crear las filas dinámicamente
        products.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-700 hover:bg-gray-750 transition product-row';
            tr.setAttribute('data-id', p.id);
            tr.innerHTML = `
                <td class="p-2 border-r border-gray-600 font-medium text-left">
                    ${p.name} <br>
                    <span class="text-xs text-gray-500">Rinde: ${p.glasses_per_bottle} vasos</span>
                </td>
                
                <td class="p-1 border-r border-gray-600 bg-blue-900/5"><input type="number" class="w-12 bg-gray-900 border border-gray-600 rounded text-center" name="promo_btl" value="0"></td>
                <td class="p-1 border-r border-gray-600 bg-blue-900/5"><input type="number" class="w-12 bg-gray-900 border border-gray-600 rounded text-center" name="promo_pct" value="0"></td>
                <td class="p-1 border-r border-gray-600 bg-blue-900/5"><input type="number" class="w-12 bg-gray-900 border border-blue-500 rounded text-center text-blue-300 font-bold" name="promo_uso" value="0"></td>
                <td class="p-1 border-r border-gray-600 bg-blue-900/5"><input type="number" class="w-12 bg-gray-900 border border-gray-600 rounded text-center" name="promo_vnt" value="0"></td>
                <td class="p-1 border-r border-gray-600 bg-blue-900/5"><input type="number" class="w-12 bg-gray-900 border border-gray-600 rounded text-center" name="promo_cts" value="0"></td>
                
                <td class="p-1 border-r border-gray-600 bg-orange-900/5"><input type="number" class="w-12 bg-gray-900 border border-gray-600 rounded text-center" name="normal_btl" value="0"></td>
                <td class="p-1 border-r border-gray-600 bg-orange-900/5"><input type="number" class="w-12 bg-gray-900 border border-gray-600 rounded text-center" name="normal_pct" value="0"></td>
                <td class="p-1 border-r border-gray-600 bg-orange-900/5"><input type="number" class="w-12 bg-gray-900 border border-orange-500 rounded text-center text-orange-300 font-bold" name="normal_uso" value="0"></td>
                <td class="p-1 border-r border-gray-600 bg-orange-900/5"><input type="number" class="w-12 bg-gray-900 border border-gray-600 rounded text-center" name="normal_vnt" value="0"></td>
                <td class="p-1 border-r border-gray-600 bg-orange-900/5"><input type="number" class="w-12 bg-gray-900 border border-gray-600 rounded text-center" name="normal_cts" value="0"></td>
                
                <td class="p-1 border-r border-gray-600 bg-emerald-900/5"><input type="number" class="w-12 bg-gray-900 border border-emerald-500 rounded text-center" name="final_btl" value="0"></td>
                <td class="p-1 bg-emerald-900/5"><input type="number" class="w-12 bg-gray-900 border border-emerald-500 rounded text-center" name="final_pct" value="0"></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar tragos:", error);
    }
}

// 2. Evento para añadir un nuevo trago a Supabase
document.getElementById('btn-add-product').addEventListener('click', async () => {
    const nameInput = document.getElementById('new-product-name');
    const glassesInput = document.getElementById('new-product-glasses');
    
    if (!nameInput.value) {
        alert('Por favor, ingresa el nombre del trago');
        return;
    }

    const payload = {
        name: nameInput.value,
        glasses_per_bottle: parseInt(glassesInput.value)
    };

    const btn = document.getElementById('btn-add-product');
    btn.innerText = 'Guardando...';
    btn.disabled = true;

    try {
        await apiCall('/products', 'POST', payload);
        nameInput.value = ''; 
        await loadProducts(); 
    } catch (error) {
        alert("Error al guardar el trago en la base de datos.");
    }

    btn.innerText = '+ Añadir al Menú';
    btn.disabled = false;
});

// 3. Evento para guardar toda la planilla en Supabase
document.getElementById('btn-calcular').addEventListener('click', async () => {
    const sessionId = getSessionId();
    if (!sessionId) {
        alert("Por favor selecciona una fecha válida para la planilla.");
        return;
    }

    const btn = document.getElementById('btn-calcular');
    btn.innerText = 'Guardando datos...';
    btn.disabled = true;

    try {
        const rows = document.querySelectorAll('.product-row');
        for (const row of rows) {
            const payload = {
                session_id: sessionId, // Usa la fecha elegida como identificador único
                product_id: row.getAttribute('data-id'),
            };
            // Recolectar valores de los 12 inputs de esa fila
            row.querySelectorAll('input').forEach(input => {
                payload[input.name] = parseFloat(input.value) || 0;
            });
            // Enviar a la BD
            await apiCall('/sheet', 'POST', payload);
        }

        // Pedir el cálculo de cuadre al servidor
        const reportData = await apiCall(`/report/${sessionId}`);
        renderReport(reportData.report);
    } catch (error) {
        alert("Error al procesar la planilla: " + error.message);
    }

    btn.innerText = '💾 Guardar Planilla y Calcular';
    btn.disabled = false;
});

// 4. Pintar el reporte de resultados
function renderReport(report) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';

    report.forEach(item => {
        let diffColor = 'text-emerald-400';
        let diffText = 'INVENTARIO PERFECTO';
        
        if (item.diferencia_botellas < 0) { 
            diffColor = 'text-red-500'; 
            diffText = `⚠️ FALTAN ${Math.abs(item.diferencia_botellas)} BOTELLAS (Posible merma/robo)`; 
        }
        if (item.diferencia_botellas > 0) { 
            diffColor = 'text-yellow-400'; 
            diffText = `SOBRAN ${item.diferencia_botellas} BOTELLAS (Revisar conteo)`; 
        }

        const card = `
            <div class="bg-gray-900 p-5 rounded-lg border border-gray-700 flex flex-wrap lg:flex-nowrap justify-between items-center gap-4">
                <div class="w-full lg:w-1/4">
                    <h3 class="font-bold text-xl text-white">${item.producto}</h3>
                    <p class="text-sm text-gray-400">Botellas vendidas enteras: <span class="text-white">${item.botellas_vendidas_total}</span></p>
                </div>
                
                <div class="w-full sm:w-1/3 lg:w-1/4 text-center bg-gray-800 p-3 rounded">
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Vasos por Promociones</p>
                    <p class="text-3xl text-blue-400 font-mono">${item.vasos_estimados_promo}</p>
                    <p class="text-xs text-gray-500 mt-1">Cobrar al barman</p>
                </div>
                
                <div class="w-full sm:w-1/3 lg:w-1/4 text-center bg-gray-800 p-3 rounded">
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Vasos por Venta Normal</p>
                    <p class="text-3xl text-orange-400 font-mono">${item.vasos_estimados_normal}</p>
                    <p class="text-xs text-gray-500 mt-1">Cobrar al barman</p>
                </div>
                
                <div class="w-full lg:w-1/4 text-right">
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Auditoría Física</p>
                    <p class="font-bold text-lg ${diffColor}">${diffText}</p>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
}