const fs = require('fs');
let html = fs.readFileSync('public/pos.html', 'utf8');

let panel = `    <!-- PANEL RECIENTES -->
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

html = html.replace('<!-- ═══════════════ MODAL ÉXITO ═══════════════ -->', panel + '\n\n    <!-- ═══════════════ MODAL ÉXITO ═══════════════ -->');

fs.writeFileSync('public/pos.html', html);
console.log('Injected panel recientes');
