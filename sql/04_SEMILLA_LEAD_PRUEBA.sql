-- ============================================================================
-- 04_SEMILLA_LEAD_PRUEBA.sql
-- ----------------------------------------------------------------------------
-- PROPÓSITO
--   El Agente IA (Hermes) SOLO responde a números que ya existen en
--   dbo.persona y que tienen una negociación en estado 'ABIERTA'.
--   Si escribes desde un número no registrado, el bot solo envía el enlace
--   de captación (rama "no lead") y NUNCA registra en dbo.accion_agente.
--
--   Este script toma el teléfono de la ÚLTIMA sesión de WhatsApp (la de tus
--   pruebas), lo convierte en LEAD con una negociación ABIERTA y así el agente
--   te responderá con Hermes.
--
-- USO (en el servicio `database` de Dokploy, todo en una línea):
--   SQLCMD=$(ls /opt/mssql-tools*/bin/sqlcmd | tail -1); \
--   "$SQLCMD" -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d buyer -i /sql/04_SEMILLA_LEAD_PRUEBA.sql
--
-- Es idempotente: puedes ejecutarlo varias veces sin duplicar nada.
-- ============================================================================

SET NOCOUNT ON;

DECLARE @tel varchar(20), @idPersona bigint, @idSesion bigint, @idSegmento int;

-- 1) Teléfono de la última sesión de WhatsApp creada por el webhook
SELECT TOP 1
  @tel = telefono_cliente,
  @idSesion = id_sesion
FROM dbo.sesion_whatsapp
ORDER BY id_sesion DESC;

IF @tel IS NULL
BEGIN
  PRINT '>> No hay sesiones en dbo.sesion_whatsapp. Envía primero un WhatsApp al bot y vuelve a ejecutar.';
  RETURN;
END

PRINT '>> Teléfono de prueba: ' + @tel;

-- 2) Buscar o crear la persona (persona.telefono es UNIQUE)
SELECT TOP 1 @idPersona = id_persona
FROM dbo.persona
WHERE telefono = @tel;

IF @idPersona IS NULL
BEGIN
  SELECT TOP 1 @idSegmento = id_segmento
  FROM dbo.segmento_cliente
  ORDER BY id_segmento;

  INSERT INTO dbo.persona
    (nombres, apellidos, telefono, id_segmento, fase_actual,
     consentimiento_datos_fecha, consentimiento_marketing_fecha)
  VALUES
    (N'Cliente', N'Prueba Agente IA', @tel, @idSegmento, 'LEAD',
     SYSUTCDATETIME(), SYSUTCDATETIME());

  SET @idPersona = SCOPE_IDENTITY();
  PRINT '>> Persona creada: id_persona=' + CAST(@idPersona AS varchar(20));
END
ELSE
  PRINT '>> Persona existente: id_persona=' + CAST(@idPersona AS varchar(20));

-- 3) Vincular la sesión (y cualquier otra del mismo teléfono) a la persona
UPDATE dbo.sesion_whatsapp
SET id_persona = @idPersona,
    estado = 'ABIERTA'
WHERE telefono_cliente = @tel
  AND (id_persona IS NULL OR id_persona <> @idPersona);

-- 4) Asegurar una negociación ABIERTA (una por ciclo)
IF NOT EXISTS (
  SELECT 1 FROM dbo.negociacion
  WHERE id_persona = @idPersona AND estado = 'ABIERTA'
)
BEGIN
  DECLARE @ciclo int =
    ISNULL((SELECT MAX(nro_ciclo) FROM dbo.negociacion WHERE id_persona = @idPersona), 0) + 1;
  DECLARE @idPlataforma int, @idBuyer bigint, @idFormulario bigint;

  SELECT TOP 1 @idPlataforma = id_plataforma
  FROM dbo.plataforma
  ORDER BY CASE WHEN codigo = 'WHATSAPP' THEN 0 ELSE 1 END, id_plataforma;

  -- CK_negociacion_ciclo1: el ciclo 1 exige id_formulario NOT NULL, y
  -- formulario_captacion exige id_buyer. Por eso se crean buyer + formulario.
  IF @ciclo = 1
  BEGIN
    INSERT INTO dbo.buyer
      (id_persona, id_plataforma_origen, estado, fecha_primer_contacto, fecha_conversion)
    VALUES
      (@idPersona, @idPlataforma, 'CONVERTIDO_LEAD', SYSUTCDATETIME(), SYSUTCDATETIME());
    SET @idBuyer = SCOPE_IDENTITY();

    INSERT INTO dbo.formulario_captacion
      (id_persona, id_buyer, id_plataforma_origen, id_sesion_whatsapp,
       id_segmento_declarado, fecha_envio, acepta_politica_datos, acepta_marketing)
    VALUES
      (@idPersona, @idBuyer, @idPlataforma, @idSesion,
       @idSegmento, SYSUTCDATETIME(), 1, 0);
    SET @idFormulario = SCOPE_IDENTITY();
  END

  INSERT INTO dbo.negociacion
    (id_persona, id_sesion_whatsapp, id_formulario, nro_ciclo, fecha_inicio, estado, resumen)
  VALUES
    (@idPersona, @idSesion, @idFormulario, @ciclo, SYSUTCDATETIME(), 'ABIERTA',
     N'Negociación de prueba para validar el Agente IA (Hermes)');

  PRINT '>> Negociación ABIERTA creada: ciclo ' + CAST(@ciclo AS varchar(10));
END
ELSE
  PRINT '>> Ya existía una negociación ABIERTA.';

-- 5) Resultado final
SELECT
  p.id_persona, p.telefono, p.nombres, p.apellidos, p.fase_actual,
  n.id_negociacion, n.nro_ciclo, n.estado
FROM dbo.persona p
LEFT JOIN dbo.negociacion n
  ON n.id_persona = p.id_persona AND n.estado = 'ABIERTA'
WHERE p.id_persona = @idPersona;
