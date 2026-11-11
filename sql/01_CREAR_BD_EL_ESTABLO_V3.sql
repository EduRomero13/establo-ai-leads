/* VERSION 3 - 10/11/2026
   PARRILLADAS EL ESTABLO - CICLO COMPLETO: BUYER -> LEAD -> PAYER -> CUSTOMER (con recurrencia)
   SQL Server 2019+ | Recrea la base 'buyer' | Fechas UTC | Ejecutar una vez.
   ADVERTENCIA: este script ELIMINA y recrea la base 'buyer' completa.
   Si ya hay datos importantes, usar solo el PARCHE V2 -> V3; no ejecutar este archivo.

   Novedades V3 (incluye mejoras sobre V2):
   - persona.fase_actual ahora admite BUYER/LEAD/PAYER/CUSTOMER (reincidencia vuelve a LEAD).
   - negociacion: una fila por cada ciclo de vida de la persona (reemplaza lead_conversion).
   - historial_fases sin unicidad (persona,fase): permite contar cuantas veces fue cada fase.
   - Ventas: pedido, pedido_detalle, reserva, medio_pago, pago (pagos parciales permitidos).
   - Combos y promociones separados: combo (paquete de productos) vs promocion (regla de descuento).
   - personal (incluye al agente IA) y personal_plataforma.
   - accion_agente ya referencia a personal y negociacion por clave, no por nombre.
   - Vistas para el agente IA (recomendaciones por segmento) y KPI (TCP/TEN/TPN).
   - Correccion V3: TCP con precision decimal, primer pago reembolsado
     conservado en detalle, promociones filtradas por dia local de Peru.
   - Para el agente: validar adicionalmente segmento, cumpleaños y
     articulos/condiciones de compra antes de ofrecer descuentos.

   Reglas de negocio acordadas:
   - Camino a LEAD (ciclo 1): solo formulario web. Ciclos 2+: basta escribir por WhatsApp.
   - PAYER: primer pago CONFIRMADO del ciclo. CUSTOMER: pedido atendido/entregado.
   - Negociacion PERDIDA: rechazo explicito o inactividad mayor a 72 horas (TIMEOUT_72H).
   - El agente solo ofrece promos/combos vigentes; no crea descuentos propios.
   - Una sola promocion por pedido. Anulacion/reembolso NO revierte la fase alcanzada.
   - Convencion dias_aplicables: 'TODOS' o lista separada por comas: L,M,X,J,V,S,D
     (L=lunes, M=martes, X=miercoles, J=jueves, V=viernes, S=sabado, D=domingo).
*/
USE master;
GO
IF DB_ID(N'buyer') IS NOT NULL
    DROP DATABASE buyer; -- Regeneracion completa aprobada: elimina la version anterior.
GO
CREATE DATABASE buyer;
GO
USE buyer;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================
-- 1. Catalogos
-- ============================================================
CREATE TABLE dbo.plataforma (
 id_plataforma int IDENTITY(1,1) PRIMARY KEY,
 codigo varchar(20) NOT NULL UNIQUE CHECK (codigo IN ('FACEBOOK','INSTAGRAM','LANDING_PAGE','WHATSAPP')),
 nombre_pagina nvarchar(150) NOT NULL,
 url_pagina nvarchar(500) NULL,
 meta_account_id varchar(100) NULL,
 activa bit NOT NULL DEFAULT 1
);
CREATE TABLE dbo.segmento_cliente (
 id_segmento int IDENTITY(1,1) PRIMARY KEY,
 nombre nvarchar(50) NOT NULL UNIQUE,
 descripcion nvarchar(250) NULL
);
CREATE TABLE dbo.producto_carta (
 id_producto int IDENTITY(1,1) PRIMARY KEY,
 nombre nvarchar(120) NOT NULL UNIQUE,
 categoria varchar(15) NOT NULL CHECK (categoria IN ('COMIDA','BEBIDA','POSTRE')),
 descripcion nvarchar(500) NULL,
 estilo nvarchar(50) NULL,
 es_corte bit NOT NULL DEFAULT 0, -- corte de parrilla: alimenta 'cortes mas pedidos por segmento'
 peso_cantidad decimal(9,2) NULL CHECK (peso_cantidad > 0),
 peso_unidad varchar(5) NULL CHECK (peso_unidad IN ('g','ml','L')),
 precio decimal(10,2) NOT NULL CHECK (precio >= 0),
 activo bit NOT NULL DEFAULT 1,
 CONSTRAINT CK_producto_peso CHECK ((peso_cantidad IS NULL AND peso_unidad IS NULL) OR (peso_cantidad IS NOT NULL AND peso_unidad IS NOT NULL))
);
CREATE TABLE dbo.medio_pago (
 id_medio_pago int IDENTITY(1,1) PRIMARY KEY,
 codigo varchar(20) NOT NULL UNIQUE CHECK (codigo IN ('YAPE','PLIN','EFECTIVO','TARJETA')),
 nombre nvarchar(50) NOT NULL,
 activo bit NOT NULL DEFAULT 1
);
CREATE TABLE dbo.personal (
 id_personal int IDENTITY(1,1) PRIMARY KEY,
 nombres nvarchar(100) NOT NULL,
 apellidos nvarchar(100) NULL, -- NULL permitido para el agente IA
 area nvarchar(50) NOT NULL,
 cargo nvarchar(50) NOT NULL,
 es_agente_ia bit NOT NULL DEFAULT 0,
 activo bit NOT NULL DEFAULT 1
);
CREATE TABLE dbo.personal_plataforma (
 id_asignacion int IDENTITY(1,1) PRIMARY KEY,
 id_personal int NOT NULL REFERENCES dbo.personal(id_personal),
 id_plataforma int NOT NULL REFERENCES dbo.plataforma(id_plataforma),
 fecha_asignacion datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 activa bit NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX UX_personal_plataforma_activa
 ON dbo.personal_plataforma(id_personal,id_plataforma) WHERE activa = 1;

-- ============================================================
-- 2. Combos (paquetes de productos a precio cerrado) y promociones (reglas de descuento)
--    'Parrilla Familiar' y 'Combo Amigos' son COMBOS; 'Cumpleanero' y
--    'Descuento Estudiante' son PROMOCIONES. No mezclar conceptos.
-- ============================================================
CREATE TABLE dbo.combo (
 id_combo int IDENTITY(1,1) PRIMARY KEY,
 nombre nvarchar(120) NOT NULL UNIQUE,
 descripcion nvarchar(500) NULL,
 precio decimal(10,2) NOT NULL CHECK (precio >= 0),
 activo bit NOT NULL DEFAULT 1
);
CREATE TABLE dbo.combo_detalle (
 id_detalle int IDENTITY(1,1) PRIMARY KEY,
 id_combo int NOT NULL REFERENCES dbo.combo(id_combo),
 id_producto int NOT NULL REFERENCES dbo.producto_carta(id_producto),
 cantidad decimal(9,2) NOT NULL CHECK (cantidad > 0),
 CONSTRAINT UQ_combo_detalle UNIQUE (id_combo,id_producto)
);
CREATE TABLE dbo.promocion (
 id_promocion int IDENTITY(1,1) PRIMARY KEY,
 nombre_promocion nvarchar(100) NOT NULL,
 descripcion nvarchar(255) NOT NULL,
 tipo_beneficio varchar(20) NOT NULL CHECK (tipo_beneficio IN ('PORCENTAJE','MONTO_FIJO','PRECIO_FIJO','PRODUCTO_GRATIS')),
 valor_beneficio decimal(10,2) NULL CHECK (valor_beneficio >= 0),
 fecha_inicio date NOT NULL,
 fecha_fin date NULL,
 dias_aplicables varchar(30) NOT NULL DEFAULT 'TODOS', -- 'TODOS' o 'L,M,X,J,V,S,D'
 id_segmento_objetivo int NULL REFERENCES dbo.segmento_cliente(id_segmento),
 activa bit NOT NULL DEFAULT 1,
 CONSTRAINT CK_promocion_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
 CONSTRAINT CK_promocion_valor CHECK (
   (tipo_beneficio = 'PRODUCTO_GRATIS' AND valor_beneficio IS NULL) OR
   (tipo_beneficio <> 'PRODUCTO_GRATIS' AND valor_beneficio IS NOT NULL)
 )
);
CREATE TABLE dbo.promocion_aplicable (
 id_aplicacion int IDENTITY(1,1) PRIMARY KEY,
 id_promocion int NOT NULL REFERENCES dbo.promocion(id_promocion),
 id_producto int NULL REFERENCES dbo.producto_carta(id_producto),
 id_combo int NULL REFERENCES dbo.combo(id_combo),
 categoria varchar(15) NULL CHECK (categoria IN ('COMIDA','BEBIDA','POSTRE')),
 CONSTRAINT CK_promocion_alcance CHECK ( -- exactamente un objetivo por fila
   (id_producto IS NOT NULL AND id_combo IS NULL AND categoria IS NULL) OR
   (id_producto IS NULL AND id_combo IS NOT NULL AND categoria IS NULL) OR
   (id_producto IS NULL AND id_combo IS NULL AND categoria IS NOT NULL)
 )
);
CREATE UNIQUE INDEX UX_promocion_producto ON dbo.promocion_aplicable(id_promocion,id_producto) WHERE id_producto IS NOT NULL;
CREATE UNIQUE INDEX UX_promocion_combo ON dbo.promocion_aplicable(id_promocion,id_combo) WHERE id_combo IS NOT NULL;
CREATE UNIQUE INDEX UX_promocion_categoria ON dbo.promocion_aplicable(id_promocion,categoria) WHERE categoria IS NOT NULL;

-- ============================================================
-- 3. Campanas y publicaciones publicitarias. Publicacion != anuncio.
-- ============================================================
CREATE TABLE dbo.campana (
 id_campana int IDENTITY(1,1) PRIMARY KEY,
 id_plataforma int NOT NULL REFERENCES dbo.plataforma(id_plataforma),
 nombre nvarchar(150) NOT NULL,
 id_segmento_objetivo int NULL REFERENCES dbo.segmento_cliente(id_segmento),
 id_producto_gancho int NULL REFERENCES dbo.producto_carta(id_producto),
 fecha_inicio date NOT NULL,
 fecha_fin date NULL,
 meta_campaign_id varchar(100) NULL,
 activa bit NOT NULL DEFAULT 1,
 CONSTRAINT CK_campana_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE UNIQUE INDEX UX_campana_meta_campaign_id ON dbo.campana(meta_campaign_id) WHERE meta_campaign_id IS NOT NULL;
CREATE TABLE dbo.publicacion (
 id_publicacion int IDENTITY(1,1) PRIMARY KEY,
 id_plataforma int NOT NULL REFERENCES dbo.plataforma(id_plataforma),
 id_campana int NULL REFERENCES dbo.campana(id_campana),
 meta_post_id varchar(150) NOT NULL,
 texto nvarchar(2000) NULL,
 url_publicacion nvarchar(600) NULL,
 url_formulario nvarchar(600) NULL,
 fecha_publicacion datetime2(0) NOT NULL,
 estado varchar(20) NOT NULL DEFAULT 'PUBLICADA' CHECK (estado IN ('PROGRAMADA','PUBLICADA','ARCHIVADA')),
 CONSTRAINT UQ_publicacion_externa UNIQUE (id_plataforma,meta_post_id)
);
CREATE TABLE dbo.anuncio (
 id_anuncio int IDENTITY(1,1) PRIMARY KEY,
 id_campana int NOT NULL REFERENCES dbo.campana(id_campana),
 id_publicacion int NULL REFERENCES dbo.publicacion(id_publicacion),
 meta_ad_id varchar(150) NULL,
 nombre nvarchar(150) NOT NULL,
 fecha_inicio datetime2(0) NOT NULL,
 fecha_fin datetime2(0) NULL,
 CONSTRAINT CK_anuncio_fecha CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE UNIQUE INDEX UX_anuncio_meta_ad_id ON dbo.anuncio(meta_ad_id) WHERE meta_ad_id IS NOT NULL;
CREATE TABLE dbo.gasto_anuncio_diario (
 id_gasto bigint IDENTITY(1,1) PRIMARY KEY,
 id_anuncio int NOT NULL REFERENCES dbo.anuncio(id_anuncio),
 fecha date NOT NULL,
 monto decimal(12,2) NOT NULL CHECK (monto >= 0),
 moneda char(3) NOT NULL DEFAULT 'PEN',
 CONSTRAINT UQ_gasto_anuncio_dia UNIQUE(id_anuncio,fecha)
);
CREATE TABLE dbo.metrica_publicacion_diaria (
 id_metrica bigint IDENTITY(1,1) PRIMARY KEY,
 id_publicacion int NOT NULL REFERENCES dbo.publicacion(id_publicacion),
 fecha_corte date NOT NULL,
 total_reacciones int NULL CHECK (total_reacciones >= 0),
 total_comentarios int NULL CHECK (total_comentarios >= 0),
 total_compartidos int NULL CHECK (total_compartidos >= 0),
 alcance int NULL CHECK (alcance >= 0),
 impresiones int NULL CHECK (impresiones >= 0),
 fecha_obtencion datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_metrica_publicacion_fecha UNIQUE(id_publicacion,fecha_corte)
);

-- ============================================================
-- 4. Persona central y captacion. El identificador del canal NO equivale a persona real.
--    fase_actual = ultima fase del ciclo vigente. Una persona identificada que ya fue
--    customer y vuelve a negociar REINCIDE como LEAD (ciclo nuevo en dbo.negociacion).
--    BUYER queda reservado para el interesado aun no identificado / sin formulario.
-- ============================================================
CREATE TABLE dbo.persona (
 id_persona bigint IDENTITY(1,1) PRIMARY KEY,
 nombres nvarchar(100) NOT NULL,
 apellidos nvarchar(100) NOT NULL,
 telefono varchar(20) NULL,
 email nvarchar(150) NULL,
 fecha_nacimiento date NULL,
 id_segmento int NULL REFERENCES dbo.segmento_cliente(id_segmento),
 fecha_registro datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 fase_actual varchar(10) NOT NULL DEFAULT 'LEAD' CHECK (fase_actual IN ('BUYER','LEAD','PAYER','CUSTOMER')),
 consentimiento_datos_fecha datetime2(0) NULL,
 consentimiento_marketing_fecha datetime2(0) NULL,
 CONSTRAINT CK_persona_contacto CHECK (telefono IS NOT NULL OR email IS NOT NULL)
);
CREATE UNIQUE INDEX UX_persona_telefono ON dbo.persona(telefono) WHERE telefono IS NOT NULL;
CREATE UNIQUE INDEX UX_persona_email ON dbo.persona(email) WHERE email IS NOT NULL;
CREATE TABLE dbo.buyer (
 id_buyer bigint IDENTITY(1,1) PRIMARY KEY,
 id_persona bigint NULL REFERENCES dbo.persona(id_persona),
 id_plataforma_origen int NOT NULL REFERENCES dbo.plataforma(id_plataforma),
 id_publicacion_origen int NULL REFERENCES dbo.publicacion(id_publicacion),
 id_anuncio_origen int NULL REFERENCES dbo.anuncio(id_anuncio),
 referencia_externa varchar(150) NULL,
 fecha_primer_contacto datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 estado varchar(15) NOT NULL DEFAULT 'BUYER' CHECK (estado IN ('BUYER','CONVERTIDO_LEAD','DESCARTADO')),
 fecha_conversion datetime2(0) NULL,
 CONSTRAINT CK_buyer_conversion CHECK ((estado = 'CONVERTIDO_LEAD' AND id_persona IS NOT NULL AND fecha_conversion IS NOT NULL) OR (estado <> 'CONVERTIDO_LEAD' AND fecha_conversion IS NULL))
);
CREATE INDEX IX_buyer_plataforma_fecha ON dbo.buyer(id_plataforma_origen,fecha_primer_contacto);
CREATE TABLE dbo.persona_red_social (
 id_cuenta bigint IDENTITY(1,1) PRIMARY KEY,
 id_persona bigint NOT NULL REFERENCES dbo.persona(id_persona),
 id_plataforma int NOT NULL REFERENCES dbo.plataforma(id_plataforma),
 usuario varchar(150) NULL,
 id_usuario_externo varchar(150) NULL,
 fecha_vinculacion datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 metodo_vinculacion varchar(30) NOT NULL CHECK (metodo_vinculacion IN ('VERIFICACION','FORMULARIO','AUTORIZACION')),
 CONSTRAINT CK_cuenta_identificador CHECK (usuario IS NOT NULL OR id_usuario_externo IS NOT NULL)
);
CREATE UNIQUE INDEX UX_cuenta_externa ON dbo.persona_red_social(id_plataforma,id_usuario_externo) WHERE id_usuario_externo IS NOT NULL;
CREATE TABLE dbo.interaccion_publicacion (
 id_interaccion bigint IDENTITY(1,1) PRIMARY KEY,
 id_publicacion int NOT NULL REFERENCES dbo.publicacion(id_publicacion),
 id_buyer bigint NULL REFERENCES dbo.buyer(id_buyer),
 id_interaccion_externa varchar(150) NOT NULL,
 tipo varchar(15) NOT NULL CHECK (tipo IN ('COMENTARIO','RESPUESTA','REACCION')),
 id_usuario_externo varchar(150) NULL,
 nombre_visible nvarchar(150) NULL,
 texto nvarchar(2000) NULL,
 fecha_interaccion datetime2(0) NOT NULL,
 fecha_ingesta datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_interaccion_publicacion UNIQUE(id_publicacion,id_interaccion_externa)
);
-- REACCION individual solo si la API devuelve el evento permitido: no inventar IDs desde conteos.

-- ============================================================
-- 5. Landing page: un visitante por cookie de navegador, multiples sesiones.
-- ============================================================
CREATE TABLE dbo.visitante_web (
 id_visitante bigint IDENTITY(1,1) PRIMARY KEY,
 token_visitante uniqueidentifier NOT NULL UNIQUE DEFAULT NEWID(),
 id_persona bigint NULL REFERENCES dbo.persona(id_persona),
 dispositivo_tipo varchar(20) NULL CHECK (dispositivo_tipo IN ('MOVIL','ESCRITORIO','TABLETA','DESCONOCIDO')),
 fecha_primera_visita datetime2(0) NOT NULL,
 fecha_ultima_visita datetime2(0) NOT NULL,
 cantidad_visitas int NOT NULL DEFAULT 0 CHECK (cantidad_visitas >= 0),
 CONSTRAINT CK_visitante_fechas CHECK (fecha_ultima_visita >= fecha_primera_visita)
);
CREATE TABLE dbo.visita_web (
 id_visita bigint IDENTITY(1,1) PRIMARY KEY,
 id_visitante bigint NOT NULL REFERENCES dbo.visitante_web(id_visitante),
 id_buyer bigint NULL REFERENCES dbo.buyer(id_buyer),
 fecha_inicio datetime2(0) NOT NULL,
 fecha_ultima_actividad datetime2(0) NOT NULL,
 utm_source varchar(100) NULL,
 utm_campaign varchar(150) NULL,
 id_publicacion_origen int NULL REFERENCES dbo.publicacion(id_publicacion),
 CONSTRAINT CK_visita_fecha CHECK (fecha_ultima_actividad >= fecha_inicio)
);
CREATE TABLE dbo.evento_web (
 id_evento bigint IDENTITY(1,1) PRIMARY KEY,
 id_visita bigint NOT NULL REFERENCES dbo.visita_web(id_visita),
 tipo varchar(30) NOT NULL CHECK (tipo IN ('VER_MENU','CLIC_FORMULARIO','CLIC_WHATSAPP','ENVIO_FORMULARIO')),
 id_producto int NULL REFERENCES dbo.producto_carta(id_producto),
 fecha_evento datetime2(0) NOT NULL,
 detalle nvarchar(300) NULL
);

-- ============================================================
-- 6. WhatsApp: unico canal de negociacion del agente. Mensajes reales via webhook.
--    Ciclos 2+ de una persona recurrente nacen de una sesion nueva aqui.
-- ============================================================
CREATE TABLE dbo.sesion_whatsapp (
 id_sesion bigint IDENTITY(1,1) PRIMARY KEY,
 id_buyer bigint NULL REFERENCES dbo.buyer(id_buyer),
 id_persona bigint NULL REFERENCES dbo.persona(id_persona),
 telefono_cliente varchar(20) NOT NULL,
 fecha_inicio datetime2(0) NOT NULL,
 fecha_ultimo_mensaje datetime2(0) NOT NULL,
 estado varchar(15) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA','CERRADA')),
 origen varchar(30) NULL,
 CONSTRAINT CK_sesion_whatsapp_fechas CHECK (fecha_ultimo_mensaje >= fecha_inicio)
);
CREATE TABLE dbo.mensaje_whatsapp (
 id_mensaje bigint IDENTITY(1,1) PRIMARY KEY,
 id_sesion bigint NOT NULL REFERENCES dbo.sesion_whatsapp(id_sesion),
 wamid varchar(200) NULL,
 direccion varchar(10) NOT NULL CHECK (direccion IN ('ENTRANTE','SALIENTE')),
 tipo varchar(20) NOT NULL CHECK (tipo IN ('TEXTO','BOTONES','INTERACTIVO','IMAGEN','OTRO')),
 contenido nvarchar(max) NULL,
 opcion_seleccionada varchar(50) NULL,
 fecha_mensaje datetime2(0) NOT NULL,
 estado_entrega varchar(20) NULL,
 CONSTRAINT CK_mensaje_contenido CHECK (contenido IS NOT NULL OR opcion_seleccionada IS NOT NULL)
);
CREATE UNIQUE INDEX UX_mensaje_wamid ON dbo.mensaje_whatsapp(wamid) WHERE wamid IS NOT NULL;

-- ============================================================
-- 7. Formulario: unico camino a LEAD del ciclo 1. Evidencia enviada + FK a persona.
--    id_segmento_declarado: el segmento lo declara la persona aqui (fuente unica).
-- ============================================================
CREATE TABLE dbo.formulario_captacion (
 id_formulario bigint IDENTITY(1,1) PRIMARY KEY,
 id_persona bigint NOT NULL REFERENCES dbo.persona(id_persona),
 id_buyer bigint NOT NULL REFERENCES dbo.buyer(id_buyer),
 id_plataforma_origen int NOT NULL REFERENCES dbo.plataforma(id_plataforma),
 id_publicacion_origen int NULL REFERENCES dbo.publicacion(id_publicacion),
 id_visita bigint NULL REFERENCES dbo.visita_web(id_visita),
 id_sesion_whatsapp bigint NULL REFERENCES dbo.sesion_whatsapp(id_sesion),
 id_producto_favorito int NULL REFERENCES dbo.producto_carta(id_producto),
 id_segmento_declarado int NULL REFERENCES dbo.segmento_cliente(id_segmento),
 fecha_envio datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 acepta_politica_datos bit NOT NULL CHECK (acepta_politica_datos = 1),
 acepta_marketing bit NOT NULL DEFAULT 0,
 CONSTRAINT CK_formulario_un_origen CHECK (NOT (id_visita IS NOT NULL AND id_sesion_whatsapp IS NOT NULL))
);

-- ============================================================
-- 8. Negociacion: UNA FILA POR CICLO de vida (reemplaza a lead_conversion).
--    fecha_inicio = momento en que la persona se vuelve LEAD del ciclo
--      (ciclo 1: envio del formulario; ciclos 2+: primer mensaje de vuelta).
--    fecha_primer_pago = primer pago CONFIRMADO -> la persona es PAYER.
--    fecha_atencion = pedido atendido/entregado -> la persona es CUSTOMER.
--    estado PERDIDA con motivo RECHAZO o TIMEOUT_72H alimenta el TPN.
-- ============================================================
CREATE TABLE dbo.negociacion (
 id_negociacion bigint IDENTITY(1,1) PRIMARY KEY,
 id_persona bigint NOT NULL REFERENCES dbo.persona(id_persona),
 id_sesion_whatsapp bigint NULL REFERENCES dbo.sesion_whatsapp(id_sesion),
 id_formulario bigint NULL REFERENCES dbo.formulario_captacion(id_formulario), -- obligatorio solo en ciclo 1
 nro_ciclo int NOT NULL CHECK (nro_ciclo >= 1),
 fecha_inicio datetime2(0) NOT NULL,
 fecha_fin datetime2(0) NULL,
 estado varchar(15) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA','CONVERTIDA','PERDIDA')),
 motivo_perdida varchar(20) NULL CHECK (motivo_perdida IN ('RECHAZO','TIMEOUT_72H')),
 detalle_perdida nvarchar(300) NULL,
 id_pedido bigint NULL, -- FK se agrega tras crear dbo.pedido (relacion 1:1 bidireccional)
 fecha_primer_pago datetime2(0) NULL,
 fecha_atencion datetime2(0) NULL,
 resumen nvarchar(500) NULL,
 CONSTRAINT UQ_negociacion_ciclo UNIQUE (id_persona,nro_ciclo),
 CONSTRAINT CK_negociacion_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
 CONSTRAINT CK_negociacion_atencion CHECK (fecha_atencion IS NULL OR fecha_primer_pago IS NOT NULL AND fecha_atencion >= fecha_primer_pago),
 CONSTRAINT CK_negociacion_ciclo1 CHECK (
   (nro_ciclo = 1 AND id_formulario IS NOT NULL) OR (nro_ciclo > 1 AND id_formulario IS NULL)
 ),
 CONSTRAINT CK_negociacion_estado CHECK (
   (estado = 'ABIERTA'  AND fecha_fin IS NULL AND motivo_perdida IS NULL AND id_pedido IS NULL AND fecha_primer_pago IS NULL) OR
   (estado = 'CONVERTIDA' AND fecha_fin IS NOT NULL AND motivo_perdida IS NULL AND id_pedido IS NOT NULL AND fecha_primer_pago IS NOT NULL) OR
   (estado = 'PERDIDA'  AND fecha_fin IS NOT NULL AND motivo_perdida IS NOT NULL AND id_pedido IS NULL AND fecha_primer_pago IS NULL)
 )
);
CREATE INDEX IX_negociacion_persona_ciclo ON dbo.negociacion(id_persona,nro_ciclo);
CREATE INDEX IX_negociacion_estado_fecha ON dbo.negociacion(estado,fecha_inicio);

-- Memoria del agente: que se ofrecio en cada negociacion y como respondio el lead.
-- Se usa para futuras negociaciones (no repetir ofertas rechazadas, reforzar aceptadas).
CREATE TABLE dbo.oferta_negociacion (
 id_oferta bigint IDENTITY(1,1) PRIMARY KEY,
 id_negociacion bigint NOT NULL REFERENCES dbo.negociacion(id_negociacion),
 id_producto int NULL REFERENCES dbo.producto_carta(id_producto),
 id_combo int NULL REFERENCES dbo.combo(id_combo),
 id_promocion int NULL REFERENCES dbo.promocion(id_promocion),
 fecha_oferta datetime2(0) NOT NULL,
 respuesta varchar(15) NOT NULL DEFAULT 'SIN_RESPUESTA' CHECK (respuesta IN ('ACEPTADA','RECHAZADA','SIN_RESPUESTA')),
 detalle nvarchar(300) NULL,
 CONSTRAINT CK_oferta_objeto CHECK ( -- exactamente un objeto ofrecido por fila
   (id_producto IS NOT NULL AND id_combo IS NULL AND id_promocion IS NULL) OR
   (id_producto IS NULL AND id_combo IS NOT NULL AND id_promocion IS NULL) OR
   (id_producto IS NULL AND id_combo IS NULL AND id_promocion IS NOT NULL)
 )
);
CREATE INDEX IX_oferta_negociacion ON dbo.oferta_negociacion(id_negociacion);

-- ============================================================
-- 9. Ventas: pedido (1:1 con negociacion convertida), detalle, reserva y pagos.
--    tipo 'RESERVA' exige fila en dbo.reserva (responsabilidad del backend).
--    estado: REGISTRADO -> PAGADO_PARCIAL -> PAGADO -> ATENDIDO (o ANULADO).
--    Una sola promocion por pedido (id_promocion).
-- ============================================================
CREATE TABLE dbo.pedido (
 id_pedido bigint IDENTITY(1,1) PRIMARY KEY,
 id_persona bigint NOT NULL REFERENCES dbo.persona(id_persona),
 id_negociacion bigint NOT NULL UNIQUE REFERENCES dbo.negociacion(id_negociacion),
 id_personal_atiende int NULL REFERENCES dbo.personal(id_personal),
 tipo varchar(15) NOT NULL DEFAULT 'LOCAL' CHECK (tipo IN ('LOCAL','RESERVA')),
 fecha_registro datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 estado varchar(15) NOT NULL DEFAULT 'REGISTRADO' CHECK (estado IN ('REGISTRADO','PAGADO_PARCIAL','PAGADO','ATENDIDO','ANULADO')),
 fecha_atencion datetime2(0) NULL, -- seteo simultaneo con estado ATENDIDO -> CUSTOMER
 id_promocion int NULL REFERENCES dbo.promocion(id_promocion),
 subtotal decimal(12,2) NOT NULL CHECK (subtotal >= 0),
 descuento decimal(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
 total decimal(12,2) NOT NULL CHECK (total >= 0),
 CONSTRAINT CK_pedido_total CHECK (total = subtotal - descuento),
 CONSTRAINT CK_pedido_atendido CHECK ((estado = 'ATENDIDO' AND fecha_atencion IS NOT NULL) OR (estado <> 'ATENDIDO' AND fecha_atencion IS NULL))
);
ALTER TABLE dbo.negociacion WITH CHECK ADD CONSTRAINT FK_negociacion_pedido
 FOREIGN KEY (id_pedido) REFERENCES dbo.pedido(id_pedido);
CREATE INDEX IX_pedido_persona_fecha ON dbo.pedido(id_persona,fecha_registro);
CREATE TABLE dbo.pedido_detalle (
 id_detalle bigint IDENTITY(1,1) PRIMARY KEY,
 id_pedido bigint NOT NULL REFERENCES dbo.pedido(id_pedido),
 id_producto int NULL REFERENCES dbo.producto_carta(id_producto),
 id_combo int NULL REFERENCES dbo.combo(id_combo),
 cantidad int NOT NULL CHECK (cantidad > 0),
 precio_unitario decimal(10,2) NOT NULL CHECK (precio_unitario >= 0),
 CONSTRAINT CK_detalle_objeto CHECK (
   (id_producto IS NOT NULL AND id_combo IS NULL) OR (id_producto IS NULL AND id_combo IS NOT NULL)
 ),
 -- Con NULLs de por medio, SQL Server trata dos NULL como duplicados: evita lineas repetidas.
 CONSTRAINT UQ_detalle_objeto UNIQUE (id_pedido,id_producto,id_combo)
);
CREATE INDEX IX_detalle_pedido ON dbo.pedido_detalle(id_pedido);
CREATE TABLE dbo.reserva (
 id_reserva bigint IDENTITY(1,1) PRIMARY KEY,
 id_pedido bigint NOT NULL UNIQUE REFERENCES dbo.pedido(id_pedido),
 fecha_reserva datetime2(0) NOT NULL,
 nro_personas int NOT NULL CHECK (nro_personas >= 1),
 estado varchar(15) NOT NULL DEFAULT 'CONFIRMADA' CHECK (estado IN ('CONFIRMADA','ATENDIDA','NO_ASISTIO','CANCELADA'))
);
CREATE TABLE dbo.pago (
 id_pago bigint IDENTITY(1,1) PRIMARY KEY,
 id_pedido bigint NOT NULL REFERENCES dbo.pedido(id_pedido),
 id_medio_pago int NOT NULL REFERENCES dbo.medio_pago(id_medio_pago),
 monto decimal(12,2) NOT NULL CHECK (monto > 0),
 moneda char(3) NOT NULL DEFAULT 'PEN',
 fecha_pago datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 estado varchar(15) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','CONFIRMADO','ANULADO','REEMBOLSADO')),
 referencia varchar(100) NULL
 -- TCP usa el primer pago con estado CONFIRMADO. REEMBOLSADO = pago confirmado y luego
 -- devuelto (la fase alcanzada NO retrocede; queda como evidencia).
);
CREATE INDEX IX_pago_pedido ON dbo.pago(id_pedido,fecha_pago);

-- Historial de fases SIN unicidad persona+fase: una persona puede ser LEAD/PAYER/CUSTOMER
-- varias veces (recurrencia). 'Cuantas veces fue customer' = COUNT(*) por fase y persona.
CREATE TABLE dbo.historial_fases (
 id_historial bigint IDENTITY(1,1) PRIMARY KEY,
 id_persona bigint NOT NULL REFERENCES dbo.persona(id_persona),
 fase varchar(10) NOT NULL CHECK (fase IN ('BUYER','LEAD','PAYER','CUSTOMER')),
 fecha_cambio datetime2(0) NOT NULL,
 id_buyer bigint NULL REFERENCES dbo.buyer(id_buyer),
 id_negociacion bigint NULL REFERENCES dbo.negociacion(id_negociacion),
 id_formulario bigint NULL REFERENCES dbo.formulario_captacion(id_formulario),
 id_pedido bigint NULL REFERENCES dbo.pedido(id_pedido),
 CONSTRAINT CK_historial_coherencia CHECK (
   fase = 'BUYER' OR
   (fase = 'LEAD' AND id_negociacion IS NOT NULL) OR
   ((fase IN ('PAYER','CUSTOMER')) AND id_negociacion IS NOT NULL AND id_pedido IS NOT NULL)
 )
);
CREATE INDEX IX_historial_persona_fecha ON dbo.historial_fases(id_persona,fecha_cambio);

-- ============================================================
-- 10. Auditoria de agentes y deduplicacion de eventos.
--     accion_agente referencia personal por CLAVE (DIM_PERSONAL: no usar nombre como clave).
-- ============================================================
CREATE TABLE dbo.evento_integracion (
 id_evento bigint IDENTITY(1,1) PRIMARY KEY,
 proveedor varchar(20) NOT NULL CHECK (proveedor IN ('META','WHATSAPP','LANDING')),
 id_evento_externo varchar(200) NOT NULL,
 tipo varchar(50) NOT NULL,
 recibido_en datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 procesado_en datetime2(0) NULL,
 estado varchar(15) NOT NULL DEFAULT 'RECIBIDO' CHECK (estado IN ('RECIBIDO','PROCESADO','ERROR')),
 error_resumen nvarchar(300) NULL,
 CONSTRAINT UQ_evento_integracion UNIQUE(proveedor,id_evento_externo)
);
CREATE TABLE dbo.accion_agente (
 id_accion bigint IDENTITY(1,1) PRIMARY KEY,
 id_personal int NOT NULL REFERENCES dbo.personal(id_personal), -- el agente (IA o humano)
 id_negociacion bigint NULL REFERENCES dbo.negociacion(id_negociacion),
 id_buyer bigint NULL REFERENCES dbo.buyer(id_buyer),
 id_sesion_whatsapp bigint NULL REFERENCES dbo.sesion_whatsapp(id_sesion),
 accion varchar(50) NOT NULL,
 detalle nvarchar(500) NULL,
 resultado varchar(20) NOT NULL CHECK (resultado IN ('EXITOSO','FALLIDO','PENDIENTE')),
 fecha_ejecucion datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_accion_agente_fecha ON dbo.accion_agente(id_personal,fecha_ejecucion);

-- ============================================================
-- 11. Indices principales para agente y reportes
-- ============================================================
CREATE INDEX IX_interaccion_fecha ON dbo.interaccion_publicacion(id_publicacion,fecha_interaccion);
CREATE INDEX IX_visita_visitante_fecha ON dbo.visita_web(id_visitante,fecha_inicio);
CREATE INDEX IX_evento_web_fecha ON dbo.evento_web(tipo,fecha_evento);
CREATE INDEX IX_mensaje_sesion_fecha ON dbo.mensaje_whatsapp(id_sesion,fecha_mensaje);
CREATE INDEX IX_formulario_fecha ON dbo.formulario_captacion(fecha_envio);
CREATE INDEX IX_sesion_telefono ON dbo.sesion_whatsapp(telefono_cliente,fecha_inicio DESC);
GO

-- ============================================================
-- 12. Vistas para el AGENTE IA (recomendaciones en vivo por segmento)
-- ============================================================
-- Cortes mas vendidos por segmento (incluye los vendidos DENTRO de combos).
CREATE VIEW dbo.vw_top_cortes_segmento
AS
SELECT p.id_segmento, s.nombre AS segmento,
       pr.id_producto, pr.nombre AS corte, pr.estilo, pr.peso_cantidad, pr.peso_unidad,
       SUM(CASE WHEN d.id_producto IS NOT NULL THEN d.cantidad ELSE d.cantidad * cd.cantidad END) AS unidades_vendidas
FROM dbo.pedido_detalle d
JOIN dbo.pedido pd ON pd.id_pedido = d.id_pedido AND pd.estado <> 'ANULADO'
JOIN dbo.persona p ON p.id_persona = pd.id_persona
LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
LEFT JOIN dbo.combo_detalle cd ON cd.id_combo = d.id_combo
JOIN dbo.producto_carta pr ON pr.id_producto = COALESCE(d.id_producto,cd.id_producto)
WHERE pr.es_corte = 1
GROUP BY p.id_segmento, s.nombre, pr.id_producto, pr.nombre, pr.estilo, pr.peso_cantidad, pr.peso_unidad;
GO
-- Productos mas vendidos por segmento (lineas directas, sin explotar combos).
CREATE VIEW dbo.vw_top_productos_segmento
AS
SELECT p.id_segmento, s.nombre AS segmento,
       pr.id_producto, pr.nombre AS producto, pr.categoria, pr.es_corte,
       pr.peso_cantidad, pr.peso_unidad,
       SUM(d.cantidad) AS unidades_vendidas, COUNT(DISTINCT pd.id_pedido) AS pedidos
FROM dbo.pedido_detalle d
JOIN dbo.pedido pd ON pd.id_pedido = d.id_pedido AND pd.estado <> 'ANULADO'
JOIN dbo.persona p ON p.id_persona = pd.id_persona
LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
JOIN dbo.producto_carta pr ON pr.id_producto = d.id_producto
GROUP BY p.id_segmento, s.nombre, pr.id_producto, pr.nombre, pr.categoria, pr.es_corte, pr.peso_cantidad, pr.peso_unidad;
GO
-- Combos mas pedidos por segmento.
CREATE VIEW dbo.vw_top_combos_segmento
AS
SELECT p.id_segmento, s.nombre AS segmento,
       c.id_combo, c.nombre AS combo, c.precio,
       SUM(d.cantidad) AS unidades_vendidas, COUNT(DISTINCT pd.id_pedido) AS pedidos
FROM dbo.pedido_detalle d
JOIN dbo.pedido pd ON pd.id_pedido = d.id_pedido AND pd.estado <> 'ANULADO'
JOIN dbo.persona p ON p.id_persona = pd.id_persona
LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
JOIN dbo.combo c ON c.id_combo = d.id_combo
GROUP BY p.id_segmento, s.nombre, c.id_combo, c.nombre, c.precio;
GO
-- Promociones vigentes hoy con su alcance y segmento objetivo (menu del agente).
CREATE VIEW dbo.vw_promos_vigentes
AS
SELECT
    pr.id_promocion,
    pr.nombre_promocion,
    pr.descripcion,
    pr.tipo_beneficio,
    pr.valor_beneficio,
    pr.dias_aplicables,
    pr.fecha_inicio,
    pr.fecha_fin,
    pr.id_segmento_objetivo,
    seg.nombre AS segmento_objetivo,
    pa.id_producto,
    pa.id_combo,
    pa.categoria
FROM dbo.promocion AS pr
LEFT JOIN dbo.segmento_cliente AS seg
    ON seg.id_segmento = pr.id_segmento_objetivo
LEFT JOIN dbo.promocion_aplicable AS pa
    ON pa.id_promocion = pr.id_promocion
CROSS JOIN (
    SELECT CONVERT(date,
        SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'SA Pacific Standard Time'
    ) AS fecha_peru
) AS f
CROSS APPLY (
    SELECT CASE DATEDIFF(DAY, CONVERT(date,'19000101'), f.fecha_peru) % 7
        WHEN 0 THEN 'L'
        WHEN 1 THEN 'M'
        WHEN 2 THEN 'X'
        WHEN 3 THEN 'J'
        WHEN 4 THEN 'V'
        WHEN 5 THEN 'S'
        ELSE 'D'
    END AS letra_dia
) AS dd
WHERE pr.activa = 1
  AND f.fecha_peru >= pr.fecha_inicio
  AND (pr.fecha_fin IS NULL OR f.fecha_peru <= pr.fecha_fin)
  AND (
      UPPER(LTRIM(RTRIM(pr.dias_aplicables))) = 'TODOS'
      OR CHARINDEX(
            ',' + dd.letra_dia + ',',
            ',' + UPPER(REPLACE(pr.dias_aplicables,' ','')) + ','
         ) > 0
  );
GO

-- Preferencias por persona: favorito declarado + mas comprado (incluye productos
-- dentro de combos) + ciclos cerrados/perdidos.
CREATE VIEW dbo.vw_preferencias_persona
AS
SELECT pe.id_persona, pe.nombres, pe.apellidos, pe.id_segmento, seg.nombre AS segmento, pe.fase_actual,
       fav.id_producto_favorito, favp.nombre AS producto_favorito_declarado,
       topc.id_producto AS producto_mas_comprado, topc.nombre AS nombre_mas_comprado, topc.unidades AS unidades_mas_comprado,
       cic.ciclos_convertidos, cic.ciclos_perdidos
FROM dbo.persona pe
LEFT JOIN dbo.segmento_cliente seg ON seg.id_segmento = pe.id_segmento
OUTER APPLY (SELECT TOP 1 f.id_producto_favorito
             FROM dbo.formulario_captacion f
             WHERE f.id_persona = pe.id_persona AND f.id_producto_favorito IS NOT NULL
             ORDER BY f.fecha_envio DESC) fav
LEFT JOIN dbo.producto_carta favp ON favp.id_producto = fav.id_producto_favorito
OUTER APPLY (SELECT TOP 1 pr.id_producto, pr.nombre,
                    SUM(CASE WHEN d.id_producto IS NOT NULL THEN d.cantidad ELSE d.cantidad * cd.cantidad END) AS unidades
             FROM dbo.pedido_detalle d
             JOIN dbo.pedido pd ON pd.id_pedido = d.id_pedido AND pd.estado <> 'ANULADO'
                 AND pd.id_persona = pe.id_persona
             LEFT JOIN dbo.combo_detalle cd ON cd.id_combo = d.id_combo
             JOIN dbo.producto_carta pr ON pr.id_producto = COALESCE(d.id_producto, cd.id_producto)
             GROUP BY pr.id_producto, pr.nombre
             ORDER BY SUM(CASE WHEN d.id_producto IS NOT NULL THEN d.cantidad ELSE d.cantidad * cd.cantidad END) DESC, pr.id_producto) topc
OUTER APPLY (SELECT COUNT(CASE WHEN n.estado = 'CONVERTIDA' THEN 1 END) AS ciclos_convertidos,
                    COUNT(CASE WHEN n.estado = 'PERDIDA' THEN 1 END) AS ciclos_perdidos
             FROM dbo.negociacion n
             WHERE n.id_persona = pe.id_persona) cic;
GO
-- Recurrencia: cuantas veces fue cada fase cada persona.
CREATE VIEW dbo.vw_veces_fase_persona
AS
SELECT id_persona, fase, COUNT(*) AS veces,
       MIN(fecha_cambio) AS primera_vez, MAX(fecha_cambio) AS ultima_vez
FROM dbo.historial_fases
GROUP BY id_persona, fase;
GO
-- Saldo por pedido (pagos parciales). Un pedido ANULADO no genera saldo pendiente.
CREATE VIEW dbo.vw_pedido_saldo
AS
SELECT pd.id_pedido, pd.id_persona, pd.id_negociacion, pd.estado, pd.total,
       COALESCE(SUM(CASE WHEN pg.estado = 'CONFIRMADO' THEN pg.monto END),0) AS pagado_confirmado,
       CASE WHEN pd.estado = 'ANULADO' THEN NULL
            ELSE pd.total - COALESCE(SUM(CASE WHEN pg.estado = 'CONFIRMADO' THEN pg.monto END),0) END AS saldo_pendiente
FROM dbo.pedido pd
LEFT JOIN dbo.pago pg ON pg.id_pedido = pd.id_pedido
GROUP BY pd.id_pedido, pd.id_persona, pd.id_negociacion, pd.estado, pd.total;
GO

-- ============================================================
-- 13. Vistas para los INDICADORES (alimentan la BD dimensional)
--     TCP: promedio horas entre fecha_inicio y fecha_primer_pago (por ciclo).
--     TEN: CONVERTIDAS / total ciclos lead.  TPN: PERDIDAS / total ciclos lead.
-- ============================================================
CREATE VIEW dbo.vw_kpi_mensual
AS
SELECT
    YEAR(n.fecha_inicio) AS anio,
    MONTH(n.fecha_inicio) AS mes,
    COUNT(*) AS ciclos_lead,
    SUM(CASE WHEN n.estado = 'CONVERTIDA' THEN 1 ELSE 0 END) AS payers,
    SUM(CASE WHEN n.estado = 'PERDIDA' THEN 1 ELSE 0 END) AS perdidas,
    SUM(CASE WHEN n.estado = 'ABIERTA' THEN 1 ELSE 0 END) AS abiertas,
    CAST(AVG(CASE
        WHEN n.estado = 'CONVERTIDA' AND n.fecha_primer_pago IS NOT NULL
        THEN DATEDIFF_BIG(SECOND, n.fecha_inicio, n.fecha_primer_pago) / 3600.0
    END) AS DECIMAL(10,2)) AS tcp_horas,
    CAST(100.0 * SUM(CASE WHEN n.estado = 'CONVERTIDA' THEN 1 ELSE 0 END)
         / NULLIF(COUNT(*),0) AS DECIMAL(6,2)) AS tasa_exito_ten,
    CAST(100.0 * SUM(CASE WHEN n.estado = 'PERDIDA' THEN 1 ELSE 0 END)
         / NULLIF(COUNT(*),0) AS DECIMAL(6,2)) AS tasa_perdida_tpn
FROM dbo.negociacion AS n
GROUP BY YEAR(n.fecha_inicio), MONTH(n.fecha_inicio);
GO

-- Detalle por ciclo para la fact de conversion de la BD dimensional.
CREATE VIEW dbo.vw_negociacion_detalle
AS
SELECT
    n.id_negociacion,
    n.id_persona,
    n.nro_ciclo,
    n.estado,
    n.motivo_perdida,
    n.fecha_inicio,
    n.fecha_fin,
    n.fecha_primer_pago,
    n.fecha_atencion,
    CASE WHEN n.nro_ciclo = 1 THEN 'NUEVO' ELSE 'RECURRENTE' END AS tipo_lead,
    CAST(CASE WHEN n.fecha_primer_pago IS NOT NULL
         THEN DATEDIFF_BIG(SECOND, n.fecha_inicio, n.fecha_primer_pago) / 3600.0
    END AS DECIMAL(10,2)) AS horas_conversion,
    p.id_segmento,
    pd.id_pedido,
    pd.id_promocion,
    pd.total AS total_pedido,
    pg.id_medio_pago,
    pg.id_pago AS id_primer_pago,
    pg.estado AS estado_actual_primer_pago
FROM dbo.negociacion AS n
JOIN dbo.persona AS p ON p.id_persona = n.id_persona
LEFT JOIN dbo.pedido AS pd ON pd.id_pedido = n.id_pedido
OUTER APPLY (
    SELECT TOP (1) q.id_pago, q.id_medio_pago, q.estado
    FROM dbo.pago AS q
    WHERE q.id_pedido = pd.id_pedido
      AND q.estado IN ('CONFIRMADO', 'REEMBOLSADO')
    ORDER BY q.fecha_pago ASC, q.id_pago ASC
) AS pg;
GO

PRINT 'Base buyer V3: 34 tablas, relaciones y 9 vistas creadas correctamente.';
GO
