# BAR PRIDE POS - Sistema de Gestión de Bar

Sistema POS completo para control de ventas, inventario y ganancias en tiempo real.

## Características

✅ **Ventas Rápidas** - Click en producto y registra venta instantáneamente  
✅ **Control de Inventario** - Botellas y vasos en tiempo real, auditoría de movimientos  
✅ **Dinero vs Costo** - Calcula automáticamente la ganancia neta por producto  
✅ **Precios Dinámicos** - Diferentes precios por hora  
✅ **Entradas/Paquetes** - Combos fijos (ej: 30 bs = lata cerveza)  
✅ **Reportes en Excel** - Ventas, inventario, productos con detalles  
✅ **Panel de Admin** - Gestión de bebidas, promos, rendimientos  
✅ **Cierre de Caja** - Resumen diario con dinero, costo y ganancia neta

## Requisitos

- Node.js 16+
- PostgreSQL (Supabase recomendado)
- npm

## Instalación Local

```bash
# Clonar el repositorio
git clone <tu-repo>
cd babel

# Instalar dependencias
npm install

# Configurar variables de entorno
# Crear archivo .env con:
DATABASE_URL=postgresql://usuario:contraseña@host:5432/dbname
PORT=3000
NODE_ENV=development

# Inicializar BD
node init-db.js

# Iniciar servidor
npm start
```

Acceder a: `http://localhost:3000`

## Deploy en Render

### Paso 1: Preparar el repositorio en GitHub

```bash
# Inicializar git (si no está hecho)
git init

# Agregar archivos
git add .

# Commit inicial
git commit -m "Initial commit - BAR PRIDE POS"

# Crear repo en GitHub y pushear (reemplazar URL)
git remote add origin https://github.com/tu-usuario/babel-pos.git
git branch -M main
git push -u origin main
```

### Paso 2: Crear cuenta en Render

1. Ir a https://render.com
2. Registrarse con GitHub
3. Autorizar a Render

### Paso 3: Crear servicio web en Render

1. Dashboard → **New** → **Web Service**
2. Seleccionar repositorio `babel-pos`
3. Configurar:
   - **Name**: `babel-pos` (o tu preferencia)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free (o Starter según necesidad)

### Paso 4: Configurar variables de entorno

En Render dashboard, ir a la sección **Environment**:

Agregar variable:
```
DATABASE_URL: postgresql://usuario:contraseña@host:5432/dbname
```

**Nota**: La URL de BD debe estar accesible desde Render. Si usas Supabase:
- Ir a Supabase → Settings → Database
- Copiar la connection string "Pooling mode" o "Session mode"
- Agregar en Render

### Paso 5: Deploy

1. Dar clic en **Deploy**
2. Render build y deploy automáticamente
3. Esperar mensaje ✅ "Service is live"
4. Tu app estará en: `https://babel-pos.onrender.com`

## Estructura del Proyecto

```
babel-pos/
├── src/
│   ├── config/          # Configuración de BD
│   ├── models/          # Lógica de datos
│   ├── controllers/     # Handlers de API
│   └── routes/          # Rutas
├── public/
│   ├── index.html       # Frontend
│   ├── script.js        # Lógica cliente
│   └── style.css        # Estilos
├── server.js            # Entrada principal
├── init-db.js           # Inicializador de BD
├── schema.sql           # Esquema de tablas
├── package.json
├── render.yaml          # Config para Render
└── .env                 # Variables (no subir)
```

## API Endpoints

### Ventas
- `POST /api/venta` - Registrar venta
- `GET /api/ventas-resumen` - Resumen del día
- `GET /api/ventas-detalle` - Detalle completo
- `GET /api/ventas-total` - Totales

### Inventario
- `POST /api/inventario-inicial` - Set inicial
- `GET /api/inventario` - Stock actual
- `GET /api/inventario/movimientos/hoy` - Auditoría

### Entradas
- `GET /api/entradas` - Listar paquetes
- `POST /api/entradas` - Crear paquete
- `POST /api/entradas/venta` - Vender entrada

### Precios Dinámicos
- `GET /api/precios-por-hora` - Listar
- `POST /api/precios-por-hora` - Crear
- `GET /api/precios-por-hora/:id/actual` - Precio vigente

### Otros
- `GET /api/productos` - Bebidas activas
- `GET /api/promos` - Promociones
- `GET /api/rendimientos` - Ratios botella→vasos

## Troubleshooting

**Error: "Cannot GET /"**
- Verificar que `public/index.html` existe
- Verificar que express.static está bien configurado

**Error: "CONNECTION REFUSED"**
- Verificar DATABASE_URL en .env
- Verificar que BD está accesible
- En Render: agregar IP 0.0.0.0 en firewall de BD

**Logs en Render**
- Dashboard → Logs tab para ver errores

## Contacto & Soporte

Para reportar bugs o sugerencias, crear un issue en GitHub.

---

**BAR PRIDE POS** - Sistema de gestión para bares y locales 🍾💰
"# BABEL" 
