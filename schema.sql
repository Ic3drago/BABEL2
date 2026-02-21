-- ============================================
-- BAR PRIDE POS v2 - Schema PostgreSQL SIMPLIFICADO
-- ============================================

-- Limpiar tablas antiguas (si existen)
DROP TABLE IF EXISTS movimientos_inventario CASCADE;
DROP TABLE IF EXISTS cortesias CASCADE;
DROP TABLE IF EXISTS entradas CASCADE;
DROP TABLE IF EXISTS precios_por_hora CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS promos CASCADE;
DROP TABLE IF EXISTS rendimientos CASCADE;
DROP TABLE IF EXISTS inventario CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS tamaños_vasos CASCADE;

-- Tamaños de vasos
CREATE TABLE tamaños_vasos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  capacidad_ml INT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Productos (bebidas, entradas)
CREATE TABLE productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  tipo VARCHAR(50) NOT NULL,
  contenedor VARCHAR(50),
  tamaño_vaso_id INT REFERENCES tamaños_vasos(id),
  precio_base DECIMAL(10,2) NOT NULL,
  es_componible BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventario
CREATE TABLE inventario (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL UNIQUE REFERENCES productos(id) ON DELETE CASCADE,
  botellas_disponibles DECIMAL(10,2) NOT NULL DEFAULT 0,
  vasos_disponibles DECIMAL(10,2) NOT NULL DEFAULT 0,
  vasos_vendidos DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Precios Dinámicos por Horario
CREATE TABLE precios_por_hora (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES productos(id),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  precio_vaso DECIMAL(10,2) NOT NULL,
  aplicable_viernes_sabado VARCHAR(50),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VENTAS MEJORADA: Registra vasos vendidos, botellas usadas, sobrante
CREATE TABLE ventas (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES productos(id),
  vasos_vendidos INT NOT NULL,
  precio_vaso DECIMAL(10,2) NOT NULL,
  botellas_usadas DECIMAL(10,2) NOT NULL,
  sobrante_porcentaje DECIMAL(5,2),
  precio_botella DECIMAL(10,2),
  dinero_recibido DECIMAL(10,2) NOT NULL,
  medio_pago VARCHAR(50),
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  dia_semana VARCHAR(20)
);

-- Entradas (Paquetes Fijos): Ej: 30bs=lata cerveza, 40bs=vaso trago
CREATE TABLE entradas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2) NOT NULL,
  product_id INT REFERENCES productos(id),
  cantidad_items INT DEFAULT 1,
  aplica_viernes_sabado VARCHAR(50),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cortesías/Regalos
CREATE TABLE cortesias (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES productos(id),
  cantidad INT NOT NULL,
  motivo VARCHAR(100),
  registrado_por VARCHAR(100),
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Promos
CREATE TABLE promos (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES productos(id),
  tipo VARCHAR(50) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rendimientos (Vasos por botella)
CREATE TABLE rendimientos (
  id SERIAL PRIMARY KEY,
  producto_botella_id INT NOT NULL REFERENCES productos(id),
  tamaño_vaso_id INT REFERENCES tamaños_vasos(id),
  vasos_por_botella DECIMAL(10,2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auditoría de Inventario
CREATE TABLE movimientos_inventario (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES productos(id),
  tipo_movimiento VARCHAR(50),
  cantidad DECIMAL(10,2) NOT NULL,
  saldo_anterior DECIMAL(10,2),
  saldo_nuevo DECIMAL(10,2),
  razon TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_productos_activo ON productos(activo);
CREATE INDEX idx_ventas_fecha ON ventas(fecha);
CREATE INDEX idx_ventas_dia ON ventas(dia_semana);
CREATE INDEX idx_inventario_producto ON inventario(producto_id);
CREATE INDEX idx_precios_hora ON precios_por_hora(hora_inicio, hora_fin);
CREATE INDEX idx_movimientos_producto ON movimientos_inventario(producto_id);

-- Insertar algunos productos de ejemplo
INSERT INTO productos (nombre, tipo, contenedor, precio_base) VALUES
('Cerveza Heineken', 'cerveza_lata', 'lata', 150),
('Ron', 'trago_botella', 'botella', 200),
('Vodka', 'trago_botella', 'botella', 200),
('Agua', 'bebida', 'botella', 50),
('Cola', 'bebida', 'botella', 60),
('Energizante', 'bebida', 'lata', 80)
ON CONFLICT DO NOTHING;

-- Insertar tamaños de vasos
INSERT INTO tamaños_vasos (nombre, capacidad_ml) VALUES
('Pequeño', 250),
('Mediano', 350),
('Grande', 500)
ON CONFLICT DO NOTHING;

-- Entradas (Paquetes)
INSERT INTO entradas (nombre, descripcion, precio, product_id, aplica_viernes_sabado) VALUES
('Entrada Cerveza', 'Lata de Cerveza Heineken', 30, 1, 'viernes,sabado'),
('Entrada Trago', 'Vaso de Ron o Vodka', 40, 2, 'viernes,sabado'),
('Trago Premium', 'Vaso doble de licor', 60, 2, 'viernes,sabado')
ON CONFLICT DO NOTHING;
