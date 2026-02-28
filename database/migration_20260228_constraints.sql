-- Migration: Agregar UNIQUE constraints y limpiar tablas innecesarias
-- Fecha: 2026-02-28
-- Descripción: Fixes para soportar ON CONFLICT y eliminar redundancias

-- ============================================================================
-- 1. AGREGAR UNIQUE CONSTRAINT A stock_noche
-- ============================================================================
-- Permite usar ON CONFLICT para upserts de stock diario
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_noche_unique 
ON public.stock_noche(botella_id, fecha);

-- ============================================================================
-- 2. AGREGAR UNIQUE CONSTRAINT A menu_tragos_noche
-- ============================================================================
-- Permite usar ON CONFLICT para upserts de configuración de noche
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_tragos_noche_unique 
ON public.menu_tragos_noche(trago_id, fecha);

-- ============================================================================
-- 3. ELIMINAR TABLA ANTIGUA DE DETALLES (opcional)
-- ============================================================================
-- Si no usas venta_detalles, descomenta esto:
-- DROP TABLE IF EXISTS public.venta_detalles CASCADE;

-- ============================================================================
-- 4. VERIFICACIÓN: Mostrar que todo está correcto
-- ============================================================================
-- Ejecuta esto para verificar:
-- SELECT indexname FROM pg_indexes 
-- WHERE schemaname='public' AND (indexname LIKE '%stock_noche%' OR indexname LIKE '%menu_tragos_noche%');
