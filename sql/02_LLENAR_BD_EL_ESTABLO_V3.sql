/* VERSION 3 - 10/11/2026
   DATOS DE DEMOSTRACION: ciclo completo BUYER -> LEAD -> PAYER -> CUSTOMER con recurrencia.
   Ejecutar UNA SOLA VEZ sobre la BD buyer V3 recien creada y vacia.
   NO ejecutar si ya cargaste datos: usar el parche V2 -> V3.
   Datos sinteticos, no extraidos de Meta real ni de WhatsApp real. Tiempos en UTC.
   Ajuste V3: el caso Diego (TIMEOUT_72H) termina a las 72 h + 1 minuto.

   Volumen: 17 personas, 18 buyers, 19 negociaciones (15 convertidas, 2 perdidas,
   2 abiertas), 15 pedidos, 34 detalles, 16 pagos (1 parcial, 1 reembolsado),
   4 reservas, 46 filas de historial de fases, 16 formularios, 14 ofertas.
   Se uso mas volumen que en V1 en personas/pedidos para que las vistas por
   segmento y los KPI muestren patrones reales de analisis.

   Casos de negocio incluidos:
   - Ana Ramirez (ESTUDIANTES): recurrente, 3 ciclos (2 completos, 1 en negociacion).
   - Luis Torres (FAMILIAS): recurrente, 2 ciclos, 2 veces CUSTOMER, reservas atendidas.
   - Maria Paredes: pago PARCIAL (PAGADO_PARCIAL, es PAYER).
   - Hugo Pineda y Carmen Ruiz: pagaron y aun no son atendidos (PAYER).
   - Sofia Vargas: negociacion PERDIDA por RECHAZO.
   - Diego Flores: negociacion PERDIDA por TIMEOUT_72H.
   - Jorge Mendoza: negociacion ABIERTA en curso (lead nuevo).
   - Andres Castillo: reserva NO_ASISTIO, pedido ANULADO y pago REEMBOLSADO
     (la fase alcanzada NO retrocede: sigue PAYER como evidencia).
   - Pedro Garcia: BUYER por WhatsApp sin formulario (nunca fue lead).
*/
USE buyer;
GO
-- IMPORTANTE: sqlcmd ejecuta con QUOTED_IDENTIFIER OFF por defecto; los indices unicos
-- filtrados de esta BD (UX_persona_telefono, UX_personal_plataforma_activa, etc.) exigen
-- QUOTED_IDENTIFIER ON durante los INSERT (Msg 1934). SSMS ya lo activa por defecto;
-- aqui se fija de forma explicita para que el script funcione identico en ambos entornos.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRY
 BEGIN TRANSACTION;
 IF EXISTS (SELECT 1 FROM dbo.plataforma)
     THROW 51001, 'Ya hay datos en buyer. El llenado se ejecuta solo sobre una base nueva y vacia.', 1;

 -- 1. Catalogos
 INSERT dbo.plataforma (codigo,nombre_pagina,url_pagina,meta_account_id) VALUES
  ('FACEBOOK',N'Parrilladas El Establo - Facebook',N'https://www.facebook.com/elestablo',NULL),
  ('INSTAGRAM',N'Parrilladas El Establo - Instagram',N'https://www.instagram.com/elestablo',NULL),
  ('LANDING_PAGE',N'Carta digital El Establo',N'https://ejemplo.test/menu',NULL),
  ('WHATSAPP',N'WhatsApp comercial El Establo',NULL,NULL);
 INSERT dbo.segmento_cliente(nombre,descripcion) VALUES
  (N'Familias',N'Grupos familiares'),
  (N'Estudiantes',N'Buscan promociones'),
  (N'Amigos',N'Consumo en grupo');
 INSERT dbo.producto_carta(nombre,categoria,descripcion,estilo,es_corte,peso_cantidad,peso_unidad,precio) VALUES
  (N'Tira de Cerdo','COMIDA',N'Tira de cerdo a la parrilla',N'Argentina',1,350,'g',32),
  (N'Picana a la Parrilla','COMIDA',N'Picana con guarnicion',N'Uruguaya',1,350,'g',39),
  (N'Bife Ancho','COMIDA',N'Bife ancho con guarnicion',N'Argentina',1,350,'g',38),
  (N'Parrilla Personal','COMIDA',N'Parrilla para una persona',N'Americana',0,NULL,NULL,35),
  (N'Parrilla Mixta Especial','COMIDA',N'Parrilla mixta',N'Argentina',0,NULL,NULL,58),
  (N'Chorizo a la Parrilla','COMIDA',N'Chorizo criollo a la parrilla',N'Argentina',1,150,'g',15),
  (N'Ensalada Cesar','COMIDA',N'Ensalada fresca de la casa',NULL,0,NULL,NULL,18),
  (N'Chicha Morada','BEBIDA',N'Bebida tradicional',NULL,0,1,'L',12),
  (N'Sangria','BEBIDA',N'Sangria de la casa (jarra 1 L)',NULL,0,1,'L',22),
  (N'Torta de Chocolate','POSTRE',N'Porcion de torta',NULL,0,150,'g',14);
 INSERT dbo.medio_pago(codigo,nombre) VALUES
  ('YAPE',N'Yape'), ('PLIN',N'Plin'), ('EFECTIVO',N'Efectivo'), ('TARJETA',N'Tarjeta');
 INSERT dbo.personal(nombres,apellidos,area,cargo,es_agente_ia,activo) VALUES
  (N'Agente Establo',NULL,N'IA',N'CHATBOT_NEGOCIADOR',1,1),
  (N'Rosa',N'Quispe Huaman',N'MARKETING',N'COMMUNITY MANAGER',0,1),
  (N'Carlos',N'Mendoza Rios',N'OPERACIONES',N'MESERO',0,1),
  (N'Elena',N'Vargas Prado',N'ADMINISTRACION',N'GERENTE',0,1);
 INSERT dbo.personal_plataforma(id_personal,id_plataforma) VALUES (2,1),(2,2),(2,3),(1,4);

 -- 2. Combos y promociones
 INSERT dbo.combo(nombre,descripcion,precio) VALUES
  (N'Parrilla Familiar',N'Combo parrillero para 4 personas a un precio especial reducido',149.00),
  (N'Combo Amigos',N'3 cortes a elegir mas una jarra de sangria por un precio fijo',110.00),
  (N'Combo Estudiante',N'Tira de cerdo 350 g + chicha morada para una persona',39.00);
 INSERT dbo.combo_detalle(id_combo,id_producto,cantidad) VALUES
  (1,2,1),(1,3,1),(1,1,1),(1,6,2),(1,9,1),(1,10,1), -- Parrilla Familiar: picana+bife+tira+2 chorizos+sangria+torta (175 -> 149)
  (2,1,1),(2,2,1),(2,3,1),(2,9,1),                   -- Combo Amigos: 3 cortes + sangria (131 -> 110)
  (3,1,1),(3,8,1);                                   -- Combo Estudiante: tira + chicha (44 -> 39)
 INSERT dbo.promocion(nombre_promocion,descripcion,tipo_beneficio,valor_beneficio,fecha_inicio,fecha_fin,dias_aplicables,id_segmento_objetivo,activa) VALUES
  (N'Promo Cumpleanero',N'1 bebida y 1 postre gratis por el consumo de un corte personal (valido en tu cumpleanos +/- 3 dias)','PRODUCTO_GRATIS',NULL,'2026-01-01','2026-12-31','TODOS',NULL,1),
  (N'Descuento Estudiante',N'15% de descuento en cortes individuales de lunes a jueves','PORCENTAJE',15.00,'2026-10-01',NULL,'L,M,X,J',2,1),
  (N'Happy Hour Amigos',N'10% de descuento en bebidas los viernes y sabados para grupos de amigos','PORCENTAJE',10.00,'2026-11-01','2026-11-30','V,S',3,1);
 INSERT dbo.promocion_aplicable(id_promocion,id_producto,id_combo,categoria) VALUES
  (1,8,NULL,NULL),(1,10,NULL,NULL),                 -- cumpleanero: regala chicha y torta
  (2,1,NULL,NULL),(2,2,NULL,NULL),(2,3,NULL,NULL),(2,6,NULL,NULL), -- estudiante: los 4 cortes
  (3,NULL,NULL,'BEBIDA');                           -- happy hour: toda bebida

 -- 3. Campanas y anuncios
 INSERT dbo.campana(id_plataforma,nombre,id_segmento_objetivo,id_producto_gancho,fecha_inicio,fecha_fin) VALUES
  (1,N'Promocion picana',3,2,'2026-10-15','2026-11-30'),
  (2,N'Sangria y parrilladas',1,9,'2026-10-15','2026-11-30'),
  (1,N'Campana estudiantes',2,1,'2026-10-01','2026-11-30');
 INSERT dbo.publicacion(id_plataforma,id_campana,meta_post_id,texto,url_publicacion,url_formulario,fecha_publicacion) VALUES
  (1,1,'DEMO_FB_POST_01',N'Disfruta nuestra picana! Registrate para recibir novedades.',NULL,N'https://ejemplo.test/formulario?utm_source=facebook','2026-10-18T15:00:00'),
  (1,1,'DEMO_FB_POST_02',N'Promocion para grupos de amigos. Consulta la carta.',NULL,N'https://ejemplo.test/formulario?utm_source=facebook','2026-11-04T17:00:00'),
  (2,2,'DEMO_IG_POST_01',N'Conoce nuestras parrilladas! Formulario en el enlace.',NULL,N'https://ejemplo.test/formulario?utm_source=instagram','2026-10-19T16:00:00'),
  (1,3,'DEMO_FB_POST_EST',N'Estudiante: 15% en cortes de lunes a jueves. Registrate!',NULL,N'https://ejemplo.test/formulario?utm_source=facebook','2026-10-05T12:00:00');
 INSERT dbo.anuncio(id_campana,id_publicacion,meta_ad_id,nombre,fecha_inicio) VALUES
  (1,1,'DEMO_FB_AD_01',N'Anuncio Picana','2026-10-18T15:00:00'),
  (2,3,'DEMO_IG_AD_01',N'Anuncio Sangria','2026-10-19T16:00:00'),
  (3,4,'DEMO_FB_AD_EST',N'Anuncio Estudiantes','2026-10-05T12:00:00');
 INSERT dbo.gasto_anuncio_diario(id_anuncio,fecha,monto) VALUES
  (1,'2026-10-18',30),(1,'2026-10-19',28),(1,'2026-11-04',24),
  (2,'2026-10-19',25),(3,'2026-10-05',20),(3,'2026-10-06',22);
 INSERT dbo.metrica_publicacion_diaria(id_publicacion,fecha_corte,total_reacciones,total_comentarios,total_compartidos,alcance,impresiones) VALUES
  (1,'2026-10-19',35,6,2,800,1200),
  (3,'2026-10-20',22,4,1,620,900),
  (4,'2026-10-06',41,8,3,950,1380),
  (2,'2026-11-05',29,5,2,750,1030);
 -- 4. Personas. fase_actual = fase del ciclo vigente (Ana esta en ciclo 3 = LEAD otra vez).
 INSERT dbo.persona(nombres,apellidos,telefono,email,fecha_nacimiento,id_segmento,fecha_registro,fase_actual,consentimiento_datos_fecha,consentimiento_marketing_fecha) VALUES
  (N'Ana',N'Ramirez',N'+51999000001',N'ana@example.test','1999-05-10',2,'2026-10-20T10:12:00','LEAD','2026-10-20T10:12:00',NULL),
  (N'Luis',N'Torres',N'+51999000002',N'luis@example.test','1988-03-22',1,'2026-10-21T11:20:00','CUSTOMER','2026-10-21T11:20:00','2026-10-21T11:20:00'),
  (N'Maria',N'Paredes',N'+51999000003',N'maria@example.test','1995-11-06',3,'2026-11-06T13:30:00','PAYER','2026-11-06T13:30:00',NULL),
  (N'Carmen',N'Ruiz',N'+51999000004',N'carmen@example.test','1992-01-18',3,'2026-11-07T18:30:00','PAYER','2026-11-07T18:30:00',NULL),
  (N'Pedro',N'Garcia',N'+51999000005',NULL,NULL,NULL,'2026-11-06T14:00:00','BUYER',NULL,NULL),
  (N'Sofia',N'Vargas',N'+51999000006',N'sofia@example.test','2000-09-02',2,'2026-11-05T09:30:00','LEAD','2026-11-05T09:30:00',NULL),
  (N'Diego',N'Flores',N'+51999000007',N'diego@example.test','1985-04-12',1,'2026-10-25T10:05:00','LEAD','2026-10-25T10:05:00',NULL),
  (N'Jorge',N'Mendoza',N'+51999000008',N'jorge@example.test','2001-07-25',2,'2026-11-09T10:30:00','LEAD','2026-11-09T10:30:00',NULL),
  (N'Valeria',N'Castro',N'+51999000009',N'valeria@example.test','1990-06-30',1,'2026-10-22T15:30:00','CUSTOMER','2026-10-22T15:30:00','2026-10-22T15:30:00'),
  (N'Fernando',N'Diaz',N'+51999000010',N'fernando@example.test','2002-02-14',2,'2026-10-21T09:40:00','CUSTOMER','2026-10-21T09:40:00','2026-10-21T09:40:00'),
  (N'Marco',N'Aguilar',N'+51999000011',N'marco@example.test','1993-12-05',3,'2026-11-04T20:15:00','CUSTOMER','2026-11-04T20:15:00',NULL),
  (N'Lucia',N'Herrera',N'+51999000012',N'lucia@example.test','1987-08-21',1,'2026-11-05T12:30:00','CUSTOMER','2026-11-05T12:30:00',NULL),
  (N'Pablo',N'Sanchez',N'+51999000013',N'pablo@example.test','2003-03-08',2,'2026-11-05T17:40:00','CUSTOMER','2026-11-05T17:40:00',NULL),
  (N'Renata',N'Flores',N'+51999000014',N'renata@example.test','1996-10-22',3,'2026-11-06T09:20:00','CUSTOMER','2026-11-06T09:20:00',NULL),
  (N'Hugo',N'Pineda',N'+51999000015',N'hugo@example.test','1994-05-17',3,'2026-11-06T13:30:00','PAYER','2026-11-06T13:30:00',NULL),
  (N'Camila',N'Rojas',N'+51999000016',N'camila@example.test','2001-11-30',2,'2026-10-24T16:20:00','CUSTOMER','2026-10-24T16:20:00',NULL),
  (N'Andres',N'Castillo',N'+51999000017',N'andres@example.test','1980-09-09',1,'2026-10-26T11:10:00','PAYER','2026-10-26T11:10:00',NULL);

 -- 5. Buyers (captacion). BUYER = interesado aun sin identificar; CONVERTIDO_LEAD = ya envio formulario.
 INSERT dbo.buyer(id_persona,id_plataforma_origen,id_publicacion_origen,id_anuncio_origen,referencia_externa,fecha_primer_contacto,estado,fecha_conversion) VALUES
  (1,1,4,3,'DEMO_FB_USER_ANA','2026-10-19T10:00:00','CONVERTIDO_LEAD','2026-10-20T10:12:00'),
  (2,2,3,2,'DEMO_IG_USER_LUIS','2026-10-20T12:00:00','CONVERTIDO_LEAD','2026-10-21T11:20:00'),
  (3,4,NULL,NULL,'WHATSAPP_51999000003','2026-11-06T13:10:00','CONVERTIDO_LEAD','2026-11-06T13:30:00'),
  (NULL,3,NULL,NULL,'COOKIE_ANON_01','2026-11-05T08:00:00','BUYER',NULL),
  (5,4,NULL,NULL,'WHATSAPP_51999000005','2026-11-06T14:00:00','BUYER',NULL),
  (10,1,4,3,'DEMO_FB_USER_FER','2026-10-20T09:30:00','CONVERTIDO_LEAD','2026-10-21T09:40:00'),
  (16,1,4,3,'DEMO_FB_USER_CAMI','2026-10-23T16:00:00','CONVERTIDO_LEAD','2026-10-24T16:20:00'),
  (9,2,3,2,'DEMO_IG_USER_VAL','2026-10-21T15:00:00','CONVERTIDO_LEAD','2026-10-22T15:30:00'),
  (17,2,3,2,'DEMO_IG_USER_AND','2026-10-25T11:00:00','CONVERTIDO_LEAD','2026-10-26T11:10:00'),
  (7,2,3,2,'DEMO_IG_USER_DIE','2026-10-24T10:00:00','CONVERTIDO_LEAD','2026-10-25T10:05:00'),
  (6,1,4,3,'DEMO_FB_USER_SOF','2026-11-04T09:00:00','CONVERTIDO_LEAD','2026-11-05T09:30:00'),
  (4,1,2,1,'DEMO_FB_USER_CAR','2026-11-06T18:00:00','CONVERTIDO_LEAD','2026-11-07T18:30:00'),
  (11,1,2,1,'DEMO_FB_USER_MAR','2026-11-04T18:00:00','CONVERTIDO_LEAD','2026-11-04T20:15:00'),
  (12,2,3,2,'DEMO_IG_USER_LUC','2026-11-04T12:00:00','CONVERTIDO_LEAD','2026-11-05T12:30:00'),
  (13,1,4,3,'DEMO_FB_USER_PAB','2026-11-04T17:00:00','CONVERTIDO_LEAD','2026-11-05T17:40:00'),
  (14,1,2,1,'DEMO_FB_USER_REN','2026-11-05T19:00:00','CONVERTIDO_LEAD','2026-11-06T09:20:00'),
  (15,1,2,1,'DEMO_FB_USER_HUG','2026-11-06T13:00:00','CONVERTIDO_LEAD','2026-11-06T13:30:00'),
  (8,4,NULL,NULL,'WHATSAPP_51999000008','2026-11-09T10:00:00','CONVERTIDO_LEAD','2026-11-09T10:30:00');
 INSERT dbo.persona_red_social(id_persona,id_plataforma,usuario,id_usuario_externo,fecha_vinculacion,metodo_vinculacion) VALUES
  (1,1,'ana.demo','DEMO_FB_USER_ANA','2026-10-20T10:12:00','FORMULARIO'),
  (2,2,'luis.demo','DEMO_IG_USER_LUIS','2026-10-21T11:20:00','FORMULARIO'),
  (11,1,'marco.demo','DEMO_FB_USER_MAR','2026-11-04T20:15:00','FORMULARIO'),
  (16,1,'camila.demo','DEMO_FB_USER_CAMI','2026-10-24T16:20:00','FORMULARIO');
 INSERT dbo.interaccion_publicacion(id_publicacion,id_buyer,id_interaccion_externa,tipo,id_usuario_externo,nombre_visible,texto,fecha_interaccion) VALUES
  (4,1,'DEMO_COMMENT_01','COMENTARIO','DEMO_FB_USER_ANA',N'Ana R.',N'La promo de estudiantes sigue vigente?','2026-10-19T10:05:00'),
  (3,2,'DEMO_COMMENT_02','COMENTARIO','DEMO_IG_USER_LUIS',N'Luis T.',N'Atienden grupos familiares?','2026-10-20T12:05:00'),
  (1,NULL,'DEMO_COMMENT_03','COMENTARIO',NULL,N'Visitante',N'Donde queda el local?','2026-10-18T16:00:00'),
  (4,11,'DEMO_COMMENT_04','COMENTARIO','DEMO_FB_USER_SOF',N'Sofia V.',N'Hacen descuentos para estudiantes?','2026-11-04T09:10:00');

 -- 6. Landing: visitantes, visitas y eventos web.
 INSERT dbo.visitante_web(token_visitante,id_persona,dispositivo_tipo,fecha_primera_visita,fecha_ultima_visita,cantidad_visitas) VALUES
  ('11111111-1111-1111-1111-111111111111',1,'MOVIL','2026-10-20T10:05:00','2026-10-20T10:12:00',1),
  ('22222222-2222-2222-2222-222222222222',NULL,'MOVIL','2026-11-05T08:00:00','2026-11-05T08:00:00',1),
  ('33333333-3333-3333-3333-333333333333',12,'ESCRITORIO','2026-11-05T12:20:00','2026-11-05T12:25:00',1);
 INSERT dbo.visita_web(id_visitante,id_buyer,fecha_inicio,fecha_ultima_actividad,utm_source,utm_campaign,id_publicacion_origen) VALUES
  (1,1,'2026-10-20T10:05:00','2026-10-20T10:12:00','facebook','campana_estudiantes',4),
  (2,4,'2026-11-05T08:00:00','2026-11-05T08:04:00',NULL,NULL,NULL),
  (3,14,'2026-11-05T12:20:00','2026-11-05T12:25:00','instagram','sangria_parrilladas',3);
 INSERT dbo.evento_web(id_visita,tipo,id_producto,fecha_evento,detalle) VALUES
  (1,'VER_MENU',1,'2026-10-20T10:06:00',N'Clic en carta'),
  (1,'ENVIO_FORMULARIO',NULL,'2026-10-20T10:12:00',N'Formulario enviado'),
  (2,'VER_MENU',NULL,'2026-11-05T08:02:00',N'Carta completa'),
  (2,'CLIC_WHATSAPP',NULL,'2026-11-05T08:03:00',N'Boton de contacto'),
  (3,'CLIC_FORMULARIO',NULL,'2026-11-05T12:22:00',N'Abre formulario');
 -- 7. WhatsApp: sesiones y mensajes. Unico canal de negociacion.
 --    Sesiones 4, 7 y 8 son de PERSONA RECURRENTE (sin buyer nuevo).
 INSERT dbo.sesion_whatsapp(id_buyer,id_persona,telefono_cliente,fecha_inicio,fecha_ultimo_mensaje,estado,origen) VALUES
  (3,3,N'+51999000003','2026-11-06T13:10:00','2026-11-06T13:55:00','CERRADA','DIRECTO'),
  (5,5,N'+51999000005','2026-11-06T14:00:00','2026-11-06T14:03:00','ABIERTA','DIRECTO'),
  (18,8,N'+51999000008','2026-11-09T10:00:00','2026-11-09T10:25:00','ABIERTA','DIRECTO'),
  (NULL,1,N'+51999000001','2026-11-09T18:00:00','2026-11-09T18:10:00','ABIERTA','RECURRENTE'),
  (11,6,N'+51999000006','2026-11-05T09:30:00','2026-11-05T10:55:00','CERRADA','DIRECTO'),
  (1,1,N'+51999000001','2026-10-20T10:15:00','2026-10-22T19:32:00','CERRADA','FORMULARIO'),
  (NULL,1,N'+51999000001','2026-11-07T12:00:00','2026-11-07T12:15:00','CERRADA','RECURRENTE'),
  (NULL,2,N'+51999000002','2026-11-08T13:00:00','2026-11-08T13:05:00','CERRADA','RECURRENTE');
 INSERT dbo.mensaje_whatsapp(id_sesion,wamid,direccion,tipo,contenido,opcion_seleccionada,fecha_mensaje,estado_entrega) VALUES
  (1,'DEMO_WAMID_01','ENTRANTE','TEXTO',N'Hola, tienen promos para grupos? Hoy cumplo anos',NULL,'2026-11-06T13:10:00',NULL),
  (1,'DEMO_WAMID_02','SALIENTE','TEXTO',N'Feliz cumpleanos! Tenemos el Combo Amigos (3 cortes + jarra de sangria) y de regalo una bebida y un postre',NULL,'2026-11-06T13:15:00','ENVIADO'),
  (1,'DEMO_WAMID_03','ENTRANTE','INTERACTIVO',N'Quiero el combo y registrarme','COMPLETAR_FORMULARIO','2026-11-06T13:20:00',NULL),
  (1,'DEMO_WAMID_04','SALIENTE','TEXTO',N'Pedido registrado. Total con promo cumpleanera: S/110.00. Yape disponible',NULL,'2026-11-06T13:55:00','ENVIADO'),
  (2,'DEMO_WAMID_05','ENTRANTE','TEXTO',N'Cuanto cuesta la picana?',NULL,'2026-11-06T14:00:00',NULL),
  (2,'DEMO_WAMID_06','SALIENTE','BOTONES',N'Te comparto la carta o completa el formulario para atenderte mejor',NULL,'2026-11-06T14:03:00','ENVIADO'),
  (3,'DEMO_WAMID_07','ENTRANTE','TEXTO',N'Buenas, que cortes tienen?',NULL,'2026-11-09T10:00:00',NULL),
  (3,'DEMO_WAMID_08','SALIENTE','TEXTO',N'Tenemos Tira de Cerdo (350 g, S/32), Picana (350 g, S/39), Bife Ancho (350 g, S/38) y Chorizo (150 g, S/15)',NULL,'2026-11-09T10:05:00','ENVIADO'),
  (3,'DEMO_WAMID_09','ENTRANTE','TEXTO',N'Hay promo para estudiantes?',NULL,'2026-11-09T10:20:00',NULL),
  (3,'DEMO_WAMID_10','SALIENTE','TEXTO',N'Si: 15% en cortes de lunes a jueves y el Combo Estudiante (tira + chicha) a S/39',NULL,'2026-11-09T10:25:00','ENVIADO'),
  (4,'DEMO_WAMID_11','ENTRANTE','TEXTO',N'Hola de nuevo! Antojo de parrilla',NULL,'2026-11-09T18:00:00',NULL),
  (4,'DEMO_WAMID_12','SALIENTE','TEXTO',N'Bienvenida de vuelta, Ana! Tu Combo Estudiante de siempre?',NULL,'2026-11-09T18:02:00','ENVIADO'),
  (4,'DEMO_WAMID_13','ENTRANTE','TEXTO',N'Dejame ver la carta primero',NULL,'2026-11-09T18:10:00',NULL),
  (5,'DEMO_WAMID_14','ENTRANTE','TEXTO',N'Cuanto cuesta la parrilla familiar?',NULL,'2026-11-05T09:30:00',NULL),
  (5,'DEMO_WAMID_15','SALIENTE','TEXTO',N'El Combo Parrilla Familiar (4 personas) esta a S/149. Deseas reserva de mesa?',NULL,'2026-11-05T09:35:00','ENVIADO'),
  (5,'DEMO_WAMID_16','ENTRANTE','TEXTO',N'Gracias, lo voy a pensar',NULL,'2026-11-05T10:55:00',NULL),
  (6,'DEMO_WAMID_17','ENTRANTE','TEXTO',N'Acabo de enviar el formulario. El descuento estudiante aplica en octubre?',NULL,'2026-10-20T10:15:00',NULL),
  (6,'DEMO_WAMID_18','SALIENTE','TEXTO',N'Si: 15% en cortes de lunes a jueves. Te armo un pedido?',NULL,'2026-10-20T10:18:00','ENVIADO'),
  (6,'DEMO_WAMID_19','ENTRANTE','TEXTO',N'La tira me llega en 350 g?',NULL,'2026-10-22T19:00:00',NULL),
  (6,'DEMO_WAMID_20','SALIENTE','TEXTO',N'Pedido confirmado: tira, chorizos y chicha. Total con descuento S/64.70',NULL,'2026-10-22T19:32:00','ENVIADO'),
  (7,'DEMO_WAMID_21','ENTRANTE','TEXTO',N'Hola! Quiero pedir de nuevo, algo ligero para hoy',NULL,'2026-11-07T12:00:00',NULL),
  (7,'DEMO_WAMID_22','SALIENTE','TEXTO',N'Te propongo el Combo Estudiante (S/39) o tu tira de siempre',NULL,'2026-11-07T12:05:00','ENVIADO'),
  (7,'DEMO_WAMID_23','ENTRANTE','INTERACTIVO',N'El combo estudiante con una torta','PEDIR_COMBO_ESTUDIANTE','2026-11-07T12:15:00',NULL),
  (8,'DEMO_WAMID_24','ENTRANTE','TEXTO',N'Buenas, mesa para 4 esta noche',NULL,'2026-11-08T13:00:00',NULL),
  (8,'DEMO_WAMID_25','SALIENTE','TEXTO',N'Reserva confirmada 20:30. El Parrilla Familiar de siempre?',NULL,'2026-11-08T13:05:00','ENVIADO');

 -- 8. Formularios: unico camino a LEAD del ciclo 1 (el segmento lo declara la persona aqui).
 INSERT dbo.formulario_captacion(id_persona,id_buyer,id_plataforma_origen,id_publicacion_origen,id_visita,id_sesion_whatsapp,id_producto_favorito,id_segmento_declarado,fecha_envio,acepta_politica_datos,acepta_marketing) VALUES
  (1,1,1,4,1,NULL,1,2,'2026-10-20T10:12:00',1,0),
  (2,2,2,3,NULL,NULL,5,1,'2026-10-21T11:20:00',1,1),
  (3,3,4,NULL,NULL,1,2,3,'2026-11-06T13:30:00',1,0),
  (4,12,1,2,NULL,NULL,2,3,'2026-11-07T18:30:00',1,0),
  (6,11,1,4,NULL,NULL,2,2,'2026-11-05T09:30:00',1,0),
  (7,10,2,3,NULL,NULL,4,1,'2026-10-25T10:05:00',1,0),
  (8,18,4,NULL,NULL,3,1,2,'2026-11-09T10:30:00',1,0),
  (9,8,2,3,NULL,NULL,5,1,'2026-10-22T15:30:00',1,0),
  (10,6,1,4,NULL,NULL,2,2,'2026-10-21T09:40:00',1,1),
  (11,13,1,2,NULL,NULL,3,3,'2026-11-04T20:15:00',1,1),
  (12,14,2,3,3,NULL,5,1,'2026-11-05T12:30:00',1,0),
  (13,15,1,4,NULL,NULL,3,2,'2026-11-05T17:40:00',1,0),
  (14,16,1,2,NULL,NULL,9,3,'2026-11-06T09:20:00',1,0),
  (15,17,1,2,NULL,NULL,3,3,'2026-11-06T13:30:00',1,0),
  (16,7,1,4,NULL,NULL,1,2,'2026-10-24T16:20:00',1,0),
  (17,9,2,3,NULL,NULL,5,1,'2026-10-26T11:10:00',1,0);
 /* 9. Negociaciones: UNA FILA POR CICLO.
    La relacion negociacion<->pedido es 1:1 bidireccional (FK circular), por lo que
    se cargan las negociaciones CONVERTIDAS con su id_pedido destino, se insertan los
    pedidos y luego se REVALIDAN las restricciones con WITH CHECK (si algo no cuadra,
    el script falla ahi). Es el patron estandar en SQL Server para FKs circulares. */
 ALTER TABLE dbo.negociacion NOCHECK CONSTRAINT FK_negociacion_pedido;
 ALTER TABLE dbo.negociacion NOCHECK CONSTRAINT CK_negociacion_estado;
 INSERT dbo.negociacion(id_persona,id_sesion_whatsapp,id_formulario,nro_ciclo,fecha_inicio,fecha_fin,estado,motivo_perdida,detalle_perdida,id_pedido,fecha_primer_pago,fecha_atencion,resumen) VALUES
  -- Ana (estudiante): 3 ciclos. Ciclo 1 completo, ciclo 2 completo, ciclo 3 en curso.
  (1,6,1,1,'2026-10-20T10:12:00','2026-10-22T19:35:00','CONVERTIDA',NULL,NULL,1,'2026-10-22T19:33:00','2026-10-22T21:00:00',N'Cerro con descuento estudiante en cortes'),
  (1,7,NULL,2,'2026-11-07T12:00:00','2026-11-07T12:45:00','CONVERTIDA',NULL,NULL,2,'2026-11-07T12:43:00','2026-11-07T14:00:00',N'Reincidencia: pidio combo estudiante y torta'),
  (1,4,NULL,3,'2026-11-09T18:00:00',NULL,'ABIERTA',NULL,NULL,NULL,NULL,NULL,N'Cliente recurrente volvio a escribir'),
  -- Luis (familia): 2 ciclos, 2 veces CUSTOMER, con reserva atendida en ambos.
  (2,NULL,2,1,'2026-10-21T11:20:00','2026-10-24T13:30:00','CONVERTIDA',NULL,NULL,3,'2026-10-24T13:28:00','2026-10-24T20:00:00',N'Reserva familiar atendida'),
  (2,8,NULL,2,'2026-11-08T13:00:00','2026-11-08T13:35:00','CONVERTIDA',NULL,NULL,4,'2026-11-08T13:33:00','2026-11-08T20:30:00',N'Reincidencia: reserva Parrilla Familiar'),
  -- Maria (amigos): cumplenos, pago PARCIAL -> PAYER, aun no atendida.
  (3,1,3,1,'2026-11-06T13:30:00','2026-11-06T14:00:00','CONVERTIDA',NULL,NULL,5,'2026-11-06T13:58:00',NULL,N'Combo Amigos + promo cumpleanera; saldo por cobrar en caja'),
  -- Carmen (amigos): pago completo, aun no atendida -> PAYER.
  (4,NULL,4,1,'2026-11-07T18:30:00','2026-11-07T19:10:00','CONVERTIDA',NULL,NULL,6,'2026-11-07T19:08:00',NULL,N'Cerro con happy hour en bebidas'),
  -- Sofia (estudiante): PERDIDA por RECHAZO.
  (6,5,5,1,'2026-11-05T09:30:00','2026-11-05T11:00:00','PERDIDA','RECHAZO',N'Dijo que el precio le parecia alto y preferiria cocinar en casa',NULL,NULL,NULL,N'Rechazo la promo estudiante'),
  -- Diego (familia): PERDIDA por TIMEOUT_72H (>72 h, solo dato sintetico).
  (7,NULL,6,1,'2026-10-25T10:05:00','2026-10-28T10:06:00','PERDIDA','TIMEOUT_72H',N'Demo: sin respuesta desde 2026-10-25; cerrada tras superar las 72 horas',NULL,NULL,NULL,N'Nunca respondio la propuesta'),
  -- Jorge (estudiante): ABIERTA, negociando ahora.
  (8,3,7,1,'2026-11-09T10:30:00',NULL,'ABIERTA',NULL,NULL,NULL,NULL,NULL,N'Consulto cortes y promos estudiante'),
  (9,NULL,8,1,'2026-10-22T15:30:00','2026-10-23T13:00:00','CONVERTIDA',NULL,NULL,7,'2026-10-23T12:58:00','2026-10-23T13:30:00',N'Parrilla mixta familiar'),
  (10,NULL,9,1,'2026-10-21T09:40:00','2026-10-22T20:00:00','CONVERTIDA',NULL,NULL,8,'2026-10-22T19:55:00','2026-10-22T20:30:00',N'Picana con descuento estudiante'),
  (11,NULL,10,1,'2026-11-04T20:15:00','2026-11-05T21:00:00','CONVERTIDA',NULL,NULL,9,'2026-11-05T20:58:00','2026-11-05T21:30:00',N'Dos combos amigos para grupo'),
  (12,NULL,11,1,'2026-11-05T12:30:00','2026-11-06T13:00:00','CONVERTIDA',NULL,NULL,10,'2026-11-06T12:58:00','2026-11-06T20:00:00',N'Reserva familiar atendida'),
  (13,NULL,12,1,'2026-11-05T17:40:00','2026-11-06T18:30:00','CONVERTIDA',NULL,NULL,11,'2026-11-06T18:28:00','2026-11-06T19:00:00',N'Bife ancho con chicha'),
  (14,NULL,13,1,'2026-11-06T09:20:00','2026-11-06T21:05:00','CONVERTIDA',NULL,NULL,12,'2026-11-06T21:02:00','2026-11-06T21:30:00',N'Combo amigos con happy hour'),
  (15,NULL,14,1,'2026-11-06T13:30:00','2026-11-07T20:10:00','CONVERTIDA',NULL,NULL,13,'2026-11-07T20:05:00',NULL,N'Combo amigos con happy hour sabatino'),
  (16,NULL,15,1,'2026-10-24T16:20:00','2026-10-25T13:00:00','CONVERTIDA',NULL,NULL,14,'2026-10-25T12:58:00','2026-10-25T13:30:00',N'Dos tiras de cerdo y sangria'),
  -- Andres (familia): pago y NO_ASISTIO -> pedido ANULADO, pago REEMBOLSADO. Fase NO retrocede.
  (17,NULL,16,1,'2026-10-26T11:10:00','2026-10-27T14:30:00','CONVERTIDA',NULL,NULL,15,'2026-10-27T13:28:00',NULL,N'No asistio a la reserva: pedido anulado y pago reembolsado');

 -- 10. Ofertas del agente: memoria para futuras negociaciones (que se ofrecio y como respondio).
 INSERT dbo.oferta_negociacion(id_negociacion,id_producto,id_combo,id_promocion,fecha_oferta,respuesta,detalle) VALUES
  (1,NULL,3,NULL,'2026-10-20T10:30:00','RECHAZADA',N'Prefirio cortes sueltos'),
  (1,NULL,NULL,2,'2026-10-22T19:00:00','ACEPTADA',N'15% en cortes aceptado'),
  (2,NULL,1,NULL,'2026-11-07T12:10:00','RECHAZADA',N'Demasiado grande para una persona'),
  (2,NULL,3,NULL,'2026-11-07T12:15:00','ACEPTADA',NULL),
  (3,NULL,3,NULL,'2026-11-09T18:05:00','SIN_RESPUESTA',N'Aun sin respuesta'),
  (5,NULL,2,NULL,'2026-11-06T13:15:00','ACEPTADA',NULL),
  (5,NULL,NULL,1,'2026-11-06T13:20:00','ACEPTADA',N'Promo cumpleanera aplicada'),
  (8,NULL,NULL,2,'2026-11-05T10:00:00','RECHAZADA',N'Dijo que igual le parecia caro'),
  (10,NULL,3,NULL,'2026-11-09T10:40:00','SIN_RESPUESTA',NULL),
  (10,1,NULL,NULL,'2026-11-09T10:42:00','SIN_RESPUESTA',N'Consulto la tira de cerdo'),
  (12,NULL,NULL,2,'2026-10-21T10:00:00','ACEPTADA',N'Descuento estudiante en picana'),
  (14,NULL,1,NULL,'2026-11-08T13:10:00','ACEPTADA',N'Combo familiar de siempre'),
  (17,NULL,2,NULL,'2026-11-06T13:45:00','ACEPTADA',NULL),
  (17,NULL,NULL,3,'2026-11-07T19:50:00','ACEPTADA',N'10% en bebidas por happy hour');
 -- 11. Pedidos (1:1 con negociacion convertida). tipo RESERVA implica fila en dbo.reserva.
 INSERT dbo.pedido(id_persona,id_negociacion,id_personal_atiende,tipo,fecha_registro,estado,fecha_atencion,id_promocion,subtotal,descuento,total) VALUES
  (1,1,3,'LOCAL','2026-10-22T19:30:00','ATENDIDO','2026-10-22T21:00:00',2,74.00,9.30,64.70),
  (1,2,3,'LOCAL','2026-11-07T12:40:00','ATENDIDO','2026-11-07T14:00:00',NULL,53.00,0.00,53.00),
  (2,4,3,'RESERVA','2026-10-24T13:25:00','ATENDIDO','2026-10-24T20:00:00',NULL,167.00,0.00,167.00),
  (2,5,3,'RESERVA','2026-11-08T13:30:00','ATENDIDO','2026-11-08T20:30:00',NULL,171.00,0.00,171.00),
  (3,6,NULL,'LOCAL','2026-11-06T13:50:00','PAGADO_PARCIAL',NULL,1,136.00,26.00,110.00),
  (4,7,NULL,'LOCAL','2026-11-07T19:00:00','PAGADO',NULL,3,79.00,2.20,76.80),
  (9,11,3,'LOCAL','2026-10-23T12:55:00','ATENDIDO','2026-10-23T13:30:00',NULL,110.00,0.00,110.00),
  (10,12,3,'LOCAL','2026-10-22T19:50:00','ATENDIDO','2026-10-22T20:30:00',2,51.00,5.85,45.15),
  (11,13,3,'LOCAL','2026-11-05T20:55:00','ATENDIDO','2026-11-05T21:30:00',NULL,244.00,0.00,244.00),
  (12,14,3,'RESERVA','2026-11-06T12:55:00','ATENDIDO','2026-11-06T20:00:00',NULL,191.00,0.00,191.00),
  (13,15,3,'LOCAL','2026-11-06T18:25:00','ATENDIDO','2026-11-06T19:00:00',NULL,50.00,0.00,50.00),
  (14,16,3,'LOCAL','2026-11-06T21:00:00','ATENDIDO','2026-11-06T21:30:00',3,154.00,4.40,149.60),
  (15,17,NULL,'LOCAL','2026-11-07T20:00:00','PAGADO',NULL,3,132.00,2.20,129.80),
  (16,18,3,'LOCAL','2026-10-25T12:55:00','ATENDIDO','2026-10-25T13:30:00',NULL,86.00,0.00,86.00),
  (17,19,NULL,'RESERVA','2026-10-27T13:25:00','ANULADO',NULL,NULL,173.00,0.00,173.00);
 INSERT dbo.pedido_detalle(id_pedido,id_producto,id_combo,cantidad,precio_unitario) VALUES
  (1,1,NULL,1,32.00),(1,6,NULL,2,15.00),(1,8,NULL,1,12.00),
  (2,NULL,3,1,39.00),(2,10,NULL,1,14.00),
  (3,NULL,1,1,149.00),(3,7,NULL,1,18.00),
  (4,NULL,1,1,149.00),(4,9,NULL,1,22.00),
  (5,NULL,2,1,110.00),(5,8,NULL,1,12.00),(5,10,NULL,1,14.00),
  (6,2,NULL,1,39.00),(6,7,NULL,1,18.00),(6,9,NULL,1,22.00),
  (7,5,NULL,1,58.00),(7,8,NULL,2,12.00),(7,10,NULL,2,14.00),
  (8,2,NULL,1,39.00),(8,8,NULL,1,12.00),
  (9,NULL,2,2,110.00),(9,8,NULL,2,12.00),
  (10,NULL,1,1,149.00),(10,10,NULL,3,14.00),
  (11,3,NULL,1,38.00),(11,8,NULL,1,12.00),
  (12,NULL,2,1,110.00),(12,9,NULL,2,22.00),
  (13,NULL,2,1,110.00),(13,9,NULL,1,22.00),
  (14,1,NULL,2,32.00),(14,9,NULL,1,22.00),
  (15,NULL,1,1,149.00),(15,8,NULL,2,12.00);
 INSERT dbo.reserva(id_pedido,fecha_reserva,nro_personas,estado) VALUES
  (3,'2026-10-24T20:00:00',4,'ATENDIDA'),
  (4,'2026-11-08T20:30:00',4,'ATENDIDA'),
  (10,'2026-11-06T20:00:00',5,'ATENDIDA'),
  (15,'2026-10-27T14:00:00',6,'NO_ASISTIO');
 -- Pagos: 15 pedidos + 1 adicional de Maria (parcial). TCP usa el primer pago CONFIRMADO.
 INSERT dbo.pago(id_pedido,id_medio_pago,monto,moneda,fecha_pago,estado,referencia) VALUES
  (1,3,64.70,'PEN','2026-10-22T19:33:00','CONFIRMADO','RECIBO-1001'),
  (2,1,53.00,'PEN','2026-11-07T12:43:00','CONFIRMADO','YAPE-2001'),
  (3,4,167.00,'PEN','2026-10-24T13:28:00','CONFIRMADO','TARJ-3001'),
  (4,1,171.00,'PEN','2026-11-08T13:33:00','CONFIRMADO','YAPE-2002'),
  (5,1,60.00,'PEN','2026-11-06T13:58:00','CONFIRMADO','YAPE-2003'),
  (5,3,50.00,'PEN','2026-11-06T14:05:00','PENDIENTE',NULL), -- saldo que pagara en caja al recoger
  (6,2,76.80,'PEN','2026-11-07T19:08:00','CONFIRMADO','PLIN-4001'),
  (7,3,110.00,'PEN','2026-10-23T12:58:00','CONFIRMADO','RECIBO-1002'),
  (8,1,45.15,'PEN','2026-10-22T19:55:00','CONFIRMADO','YAPE-2004'),
  (9,2,244.00,'PEN','2026-11-05T20:58:00','CONFIRMADO','PLIN-4002'),
  (10,4,191.00,'PEN','2026-11-06T12:58:00','CONFIRMADO','TARJ-3002'),
  (11,1,50.00,'PEN','2026-11-06T18:28:00','CONFIRMADO','YAPE-2005'),
  (12,3,149.60,'PEN','2026-11-06T21:02:00','CONFIRMADO','RECIBO-1003'),
  (13,2,129.80,'PEN','2026-11-07T20:05:00','CONFIRMADO','PLIN-4003'),
  (14,1,86.00,'PEN','2026-10-25T12:58:00','CONFIRMADO','YAPE-2006'),
  (15,2,173.00,'PEN','2026-10-27T13:28:00','REEMBOLSADO','PLIN-4004-REEMB');

 -- 12. Historial de fases: una fila por cambio real, sin unicidad (Ana es LEAD 3 veces,
 --     Luis y Ana son CUSTOMER 2 veces). Es la fuente de la recurrencia.
 INSERT dbo.historial_fases(id_persona,fase,fecha_cambio,id_buyer,id_negociacion,id_formulario,id_pedido) VALUES
  (1,'LEAD','2026-10-20T10:12:00',1,1,1,NULL),
  (1,'PAYER','2026-10-22T19:33:00',NULL,1,NULL,1),
  (1,'CUSTOMER','2026-10-22T21:00:00',NULL,1,NULL,1),
  (1,'LEAD','2026-11-07T12:00:00',NULL,2,NULL,NULL),
  (1,'PAYER','2026-11-07T12:43:00',NULL,2,NULL,2),
  (1,'CUSTOMER','2026-11-07T14:00:00',NULL,2,NULL,2),
  (1,'LEAD','2026-11-09T18:00:00',NULL,3,NULL,NULL),
  (2,'LEAD','2026-10-21T11:20:00',2,4,2,NULL),
  (2,'PAYER','2026-10-24T13:28:00',NULL,4,NULL,3),
  (2,'CUSTOMER','2026-10-24T20:00:00',NULL,4,NULL,3),
  (2,'LEAD','2026-11-08T13:00:00',NULL,5,NULL,NULL),
  (2,'PAYER','2026-11-08T13:33:00',NULL,5,NULL,4),
  (2,'CUSTOMER','2026-11-08T20:30:00',NULL,5,NULL,4),
  (3,'LEAD','2026-11-06T13:30:00',3,6,3,NULL),
  (3,'PAYER','2026-11-06T13:58:00',NULL,6,NULL,5),
  (4,'LEAD','2026-11-07T18:30:00',12,7,4,NULL),
  (4,'PAYER','2026-11-07T19:08:00',NULL,7,NULL,6),
  (5,'BUYER','2026-11-06T14:00:00',5,NULL,NULL,NULL),
  (6,'LEAD','2026-11-05T09:30:00',11,8,5,NULL),
  (7,'LEAD','2026-10-25T10:05:00',10,9,6,NULL),
  (8,'LEAD','2026-11-09T10:30:00',18,10,7,NULL),
  (9,'LEAD','2026-10-22T15:30:00',8,11,8,NULL),
  (9,'PAYER','2026-10-23T12:58:00',NULL,11,NULL,7),
  (9,'CUSTOMER','2026-10-23T13:30:00',NULL,11,NULL,7),
  (10,'LEAD','2026-10-21T09:40:00',6,12,9,NULL),
  (10,'PAYER','2026-10-22T19:55:00',NULL,12,NULL,8),
  (10,'CUSTOMER','2026-10-22T20:30:00',NULL,12,NULL,8),
  (11,'LEAD','2026-11-04T20:15:00',13,13,10,NULL),
  (11,'PAYER','2026-11-05T20:58:00',NULL,13,NULL,9),
  (11,'CUSTOMER','2026-11-05T21:30:00',NULL,13,NULL,9),
  (12,'LEAD','2026-11-05T12:30:00',14,14,11,NULL),
  (12,'PAYER','2026-11-06T12:58:00',NULL,14,NULL,10),
  (12,'CUSTOMER','2026-11-06T20:00:00',NULL,14,NULL,10),
  (13,'LEAD','2026-11-05T17:40:00',15,15,12,NULL),
  (13,'PAYER','2026-11-06T18:28:00',NULL,15,NULL,11),
  (13,'CUSTOMER','2026-11-06T19:00:00',NULL,15,NULL,11),
  (14,'LEAD','2026-11-06T09:20:00',16,16,13,NULL),
  (14,'PAYER','2026-11-06T21:02:00',NULL,16,NULL,12),
  (14,'CUSTOMER','2026-11-06T21:30:00',NULL,16,NULL,12),
  (15,'LEAD','2026-11-06T13:30:00',17,17,14,NULL),
  (15,'PAYER','2026-11-07T20:05:00',NULL,17,NULL,13),
  (16,'LEAD','2026-10-24T16:20:00',7,18,15,NULL),
  (16,'PAYER','2026-10-25T12:58:00',NULL,18,NULL,14),
  (16,'CUSTOMER','2026-10-25T13:30:00',NULL,18,NULL,14),
  (17,'LEAD','2026-10-26T11:10:00',9,19,16,NULL),
  (17,'PAYER','2026-10-27T13:28:00',NULL,19,NULL,15);

 -- Revalidacion de la relacion circular negociacion<->pedido (si los datos no cuadran, falla aqui).
 ALTER TABLE dbo.negociacion WITH CHECK CHECK CONSTRAINT FK_negociacion_pedido;
 ALTER TABLE dbo.negociacion WITH CHECK CHECK CONSTRAINT CK_negociacion_estado;

 -- 13. Auditoria.
 INSERT dbo.evento_integracion(proveedor,id_evento_externo,tipo,recibido_en,procesado_en,estado) VALUES
  ('META','DEMO_COMMENT_01','COMENTARIO','2026-10-19T10:05:05','2026-10-19T10:05:10','PROCESADO'),
  ('META','DEMO_COMMENT_02','COMENTARIO','2026-10-20T12:05:05','2026-10-20T12:05:10','PROCESADO'),
  ('WHATSAPP','DEMO_WAMID_01','MENSAJE','2026-11-06T13:10:05','2026-11-06T13:10:10','PROCESADO'),
  ('WHATSAPP','DEMO_WAMID_11','MENSAJE','2026-11-09T18:00:05','2026-11-09T18:00:10','PROCESADO'),
  ('LANDING','DEMO_VISITA_01','VISITA','2026-10-20T10:05:05','2026-10-20T10:05:10','PROCESADO'),
  ('META','DEMO_LEAD_SYNC','CONVERSION','2026-11-09T10:30:00',NULL,'RECIBIDO');
 INSERT dbo.accion_agente(id_personal,id_negociacion,id_buyer,id_sesion_whatsapp,accion,detalle,resultado,fecha_ejecucion) VALUES
  (1,1,1,6,'RESPONDER_WHATSAPP',N'Explico descuento estudiante','EXITOSO','2026-10-20T10:18:00'),
  (1,1,NULL,NULL,'REGISTRAR_PEDIDO',N'Pedido con promo estudiante en cortes','EXITOSO','2026-10-22T19:30:00'),
  (1,2,NULL,7,'OFRECER_COMBO',N'Combo estudiante aceptado en ciclo 2','EXITOSO','2026-11-07T12:15:00'),
  (1,6,3,1,'OFRECER_PROMOCION',N'Promo cumpleanera aplicada','EXITOSO','2026-11-06T13:20:00'),
  (1,8,11,5,'OFRECER_PROMOCION',N'Descuento estudiante rechazado','FALLIDO','2026-11-05T10:00:00'),
  (1,9,10,NULL,'MARCAR_PERDIDA',N'Cierre de demostracion por inactividad de mas de 72 horas','EXITOSO','2026-10-28T10:06:00'),
  (1,10,18,3,'RESPONDER_WHATSAPP',N'Envio carta y promos para estudiantes','EXITOSO','2026-11-09T10:25:00'),
  (1,NULL,5,2,'INVITAR_FORMULARIO',N'Invito a completar formulario','PENDIENTE','2026-11-06T14:03:00'),
  (1,3,NULL,4,'RECUPERAR_CLIENTE',N'Cliente recurrente recontactada','EXITOSO','2026-11-09T18:02:00'),
  (2,NULL,NULL,NULL,'PUBLICAR_CAMPANA',N'Publicacion Instagram programada','EXITOSO','2026-10-19T16:00:00');
 COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
GO

-- Conteo exacto de todas las tablas (validacion).
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql +
    CASE WHEN LEN(@sql) > 0 THEN N' UNION ALL ' ELSE N'' END +
    N'SELECT N''' + REPLACE(name,'''','''''') +
    N''' AS tabla, COUNT_BIG(*) AS registros FROM dbo.' + QUOTENAME(name)
FROM sys.tables
WHERE schema_id = SCHEMA_ID('dbo');
SET @sql = N'SELECT tabla, registros FROM (' + @sql + N') AS x ORDER BY tabla';
EXEC sys.sp_executesql @sql;
GO

-- Vista previa 1: indicadores TCP / TEN / TPN por mes (alimentan la BD dimensional).
SELECT * FROM dbo.vw_kpi_mensual;
GO
-- Vista previa 2: recurrencia (cuantas veces fue cada fase cada persona).
SELECT * FROM dbo.vw_veces_fase_persona;
GO
-- Vista previa 3: cortes mas vendidos por segmento (incluye los vendidos dentro de combos).
SELECT * FROM dbo.vw_top_cortes_segmento;
GO
-- Vista previa 4: promociones vigentes hoy con su alcance.
SELECT * FROM dbo.vw_promos_vigentes;
GO
PRINT 'Llenado V3 terminado. Si no aparecieron errores, todos los INSERT fueron confirmados.';
GO
