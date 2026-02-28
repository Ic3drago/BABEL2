-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.botellas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre character varying NOT NULL,
  descripcion text,
  volumen_total_ml integer NOT NULL DEFAULT 750,
  stock_cerrado integer NOT NULL DEFAULT 0,
  porcentaje_abierto numeric NOT NULL DEFAULT 0,
  precio_unitario numeric,
  precio_por_ml boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  rendimiento_vasos integer DEFAULT 15,
  CONSTRAINT botellas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.daily_sheets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id character varying NOT NULL,
  product_id uuid NOT NULL,
  promo_btl integer DEFAULT 0,
  promo_pct numeric DEFAULT 0,
  promo_uso integer DEFAULT 0,
  promo_vnt integer DEFAULT 0,
  promo_cts integer DEFAULT 0,
  normal_btl integer DEFAULT 0,
  normal_pct numeric DEFAULT 0,
  normal_uso integer DEFAULT 0,
  normal_vnt integer DEFAULT 0,
  normal_cts integer DEFAULT 0,
  final_btl integer DEFAULT 0,
  final_pct numeric DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_sheets_pkey PRIMARY KEY (id),
  CONSTRAINT daily_sheets_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.inventario_botellas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre character varying NOT NULL,
  volumen_ml integer NOT NULL DEFAULT 750,
  stock_cerrado integer NOT NULL DEFAULT 0,
  porcentaje_abierto numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  vasos_por_botella integer NOT NULL DEFAULT 18,
  CONSTRAINT inventario_botellas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.menu_tragos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  botella_id uuid,
  nombre_boton character varying NOT NULL,
  tipo_venta character varying NOT NULL,
  vasos_por_botella integer NOT NULL,
  precio numeric NOT NULL,
  combo_desc text DEFAULT ''::text,
  complemento_id uuid,
  precio_promo numeric DEFAULT NULL::numeric,
  CONSTRAINT menu_tragos_pkey PRIMARY KEY (id),
  CONSTRAINT menu_tragos_botella_id_fkey FOREIGN KEY (botella_id) REFERENCES public.inventario_botellas(id),
  CONSTRAINT menu_tragos_complemento_id_fkey FOREIGN KEY (complemento_id) REFERENCES public.inventario_botellas(id)
);
CREATE TABLE public.menu_tragos_noche (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  trago_id uuid NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo_venta_override character varying NOT NULL DEFAULT 'NORMAL'::character varying,
  vasos_por_botella_override integer NOT NULL DEFAULT 1,
  precio_override numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT menu_tragos_noche_pkey PRIMARY KEY (id),
  CONSTRAINT menu_tragos_noche_trago_id_fkey FOREIGN KEY (trago_id) REFERENCES public.menu_tragos(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  glasses_per_bottle integer DEFAULT 15,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  status character varying DEFAULT 'OPEN'::character varying CHECK (status::text = ANY (ARRAY['OPEN'::character varying, 'CLOSED'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.stock_noche (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  botella_id uuid NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  stock_cerrado integer NOT NULL DEFAULT 0,
  porcentaje_abierto numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_noche_pkey PRIMARY KEY (id),
  CONSTRAINT stock_noche_botella_id_fkey FOREIGN KEY (botella_id) REFERENCES public.inventario_botellas(id)
);
CREATE TABLE public.venta_detalles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  venta_id uuid NOT NULL,
  botella_id uuid NOT NULL,
  cantidad_vendida integer NOT NULL,
  cantidad_ml integer NOT NULL,
  precio_unitario numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT venta_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT venta_detalles_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id),
  CONSTRAINT venta_detalles_botella_id_fkey FOREIGN KEY (botella_id) REFERENCES public.botellas(id)
);
CREATE TABLE public.ventas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  total_cobrar numeric NOT NULL,
  estado character varying DEFAULT 'completada'::character varying,
  fecha timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ventas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ventas_detalles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  ticket_id uuid,
  trago_id uuid,
  cantidad integer NOT NULL,
  subtotal numeric NOT NULL,
  nota_extra text DEFAULT ''::text,
  CONSTRAINT ventas_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT ventas_detalles_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.ventas_tickets(id),
  CONSTRAINT ventas_detalles_trago_id_fkey FOREIGN KEY (trago_id) REFERENCES public.menu_tragos(id)
);
CREATE TABLE public.ventas_tickets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  total_cobrado numeric NOT NULL,
  tipo_pago character varying DEFAULT 'EFECTIVO'::character varying,
  creado_por character varying DEFAULT 'Barman 1'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  efectivo_recibido numeric DEFAULT 0,
  CONSTRAINT ventas_tickets_pkey PRIMARY KEY (id)
);