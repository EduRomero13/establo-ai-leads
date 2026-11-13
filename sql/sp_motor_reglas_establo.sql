-- ==============================================================================
-- MOTOR DE REGLAS DE NEGOCIO Y HERRAMIENTAS SQL PARA ESTABLO AI (V3)
-- Arquitectura de Seguridad: Procedimientos Almacenados de Mínimo Privilegio
-- Base de Datos: buyer
-- ==============================================================================

USE [buyer];
GO

-- ------------------------------------------------------------------------------
-- 1. CONSULTA: Perfil del LEAD
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_perfil_lead
    @id_persona BIGINT,
    @id_negociacion BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        p.id_persona,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        p.id_segmento,
        s.nombre AS segmento,
        p.fase_actual,
        p.fecha_registro,
        -- Negociación actual abierta o solicitada
        n.id_negociacion,
        n.nro_ciclo,
        n.estado AS estado_negociacion,
        n.fecha_inicio AS fecha_inicio_negociacion,
        n.resumen AS resumen_negociacion,
        -- Preferencias declaradas y top histórico desde vista oficial
        pref.id_producto_favorito,
        pref.producto_favorito_declarado,
        pref.producto_mas_comprado,
        pref.nombre_mas_comprado,
        pref.unidades_mas_comprado,
        pref.ciclos_convertidos,
        pref.ciclos_perdidos
    FROM dbo.persona p
    LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
    LEFT JOIN dbo.vw_preferencias_persona pref ON pref.id_persona = p.id_persona
    LEFT JOIN dbo.negociacion n ON n.id_persona = p.id_persona 
        AND ((@id_negociacion IS NULL AND n.estado = 'ABIERTA') OR n.id_negociacion = @id_negociacion)
    WHERE p.id_persona = @id_persona;
END;
GO

-- ------------------------------------------------------------------------------
-- 2. CONSULTA: Producto favorito del LEAD (Declarado vs Comprado)
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_producto_favorito
    @id_persona BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        p.id_persona,
        p.nombres + ' ' + ISNULL(p.apellidos, '') AS cliente,
        pref.id_producto_favorito,
        pref.producto_favorito_declarado,
        CASE 
            WHEN pref.producto_favorito_declarado IS NOT NULL 
            THEN 'PREFERENCIA_DECLARADA_FORMULARIO'
            ELSE 'NO_DECLARADO'
        END AS origen_favorito,
        pref.producto_mas_comprado,
        pref.nombre_mas_comprado,
        pref.unidades_mas_comprado,
        CASE 
            WHEN pref.unidades_mas_comprado > 0 
            THEN 'HISTORIAL_VENTAS_REAL'
            ELSE 'SIN_COMPRAS_PREVIAS'
        END AS origen_historico
    FROM dbo.persona p
    LEFT JOIN dbo.vw_preferencias_persona pref ON pref.id_persona = p.id_persona
    WHERE p.id_persona = @id_persona;
END;
GO

-- ------------------------------------------------------------------------------
-- 3. CONSULTA: Plato más comprado por cliente (Historial Transaccional)
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_plato_mas_comprado
    @id_persona BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    -- Consultar plato con mayor cantidad de unidades válidas compradas
    SELECT TOP 1
        pr.id_producto,
        pr.nombre AS producto,
        pr.categoria,
        pr.es_corte,
        pr.precio,
        SUM(CASE WHEN d.id_producto IS NOT NULL THEN d.cantidad ELSE d.cantidad * cd.cantidad END) AS unidades_totales,
        COUNT(DISTINCT pd.id_pedido) AS frecuencia_pedidos,
        MAX(pd.fecha_registro) AS ultima_compra
    FROM dbo.pedido_detalle d
    JOIN dbo.pedido pd ON pd.id_pedido = d.id_pedido AND pd.estado <> 'ANULADO'
    LEFT JOIN dbo.combo_detalle cd ON cd.id_combo = d.id_combo
    JOIN dbo.producto_carta pr ON pr.id_producto = COALESCE(d.id_producto, cd.id_producto)
    WHERE pd.id_persona = @id_persona
    GROUP BY pr.id_producto, pr.nombre, pr.categoria, pr.es_corte, pr.precio
    ORDER BY unidades_totales DESC, frecuencia_pedidos DESC;
END;
GO

-- ------------------------------------------------------------------------------
-- 4. CONSULTA: Platos más vendidos por segmento (Vistas V3)
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_productos_populares_segmento
    @id_segmento INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Top 3 Cortes
    SELECT TOP 3 'CORTE' AS tipo, corte AS nombre, estilo, peso_cantidad, peso_unidad, unidades_vendidas
    FROM dbo.vw_top_cortes_segmento
    WHERE id_segmento = @id_segmento
    ORDER BY unidades_vendidas DESC;

    -- Top 3 Combos
    SELECT TOP 3 'COMBO' AS tipo, combo AS nombre, NULL AS estilo, NULL AS peso_cantidad, NULL AS peso_unidad, unidades_vendidas
    FROM dbo.vw_top_combos_segmento
    WHERE id_segmento = @id_segmento
    ORDER BY unidades_vendidas DESC;
END;
GO

-- ------------------------------------------------------------------------------
-- 5. CONSULTA: Promociones más solicitadas (Ofrecidas vs Usadas)
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_promociones_mas_solicitadas
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        pr.id_promocion,
        pr.nombre_promocion,
        pr.tipo_beneficio,
        pr.valor_beneficio,
        -- 1. Veces ofrecida por el agente
        ISNULL(o.veces_ofrecida, 0) AS veces_ofrecida,
        -- 2. Veces aceptada preliminarmente
        ISNULL(o.veces_aceptada, 0) AS veces_aceptada,
        -- 3. Veces efectivamente aplicada en un pedido facturado
        ISNULL(pd.veces_utilizada_pedido, 0) AS veces_utilizada_pedido
    FROM dbo.promocion pr
    -- Se agrega cada fuente por separado: unir oferta_negociacion y pedido en el
    -- mismo SELECT produce producto cartesiano e infla los conteos.
    LEFT JOIN (
        SELECT id_promocion,
               COUNT(id_oferta) AS veces_ofrecida,
               SUM(CASE WHEN respuesta = 'ACEPTADA' THEN 1 ELSE 0 END) AS veces_aceptada
        FROM dbo.oferta_negociacion
        WHERE id_promocion IS NOT NULL
        GROUP BY id_promocion
    ) o ON o.id_promocion = pr.id_promocion
    LEFT JOIN (
        SELECT id_promocion, COUNT(DISTINCT id_pedido) AS veces_utilizada_pedido
        FROM dbo.pedido
        WHERE estado <> 'ANULADO' AND id_promocion IS NOT NULL
        GROUP BY id_promocion
    ) pd ON pd.id_promocion = pr.id_promocion
    ORDER BY veces_ofrecida DESC, veces_utilizada_pedido DESC;
END;
GO

-- ------------------------------------------------------------------------------
-- 6. CONSULTA: Promociones vigentes y elegibles para un LEAD
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_promociones_elegibles
    @id_persona BIGINT,
    @id_segmento INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @id_segmento IS NULL
    BEGIN
        SELECT @id_segmento = id_segmento FROM dbo.persona WHERE id_persona = @id_persona;
    END

    SELECT DISTINCT
        pv.id_promocion,
        pv.nombre_promocion,
        pv.descripcion,
        pv.tipo_beneficio,
        pv.valor_beneficio,
        pv.dias_aplicables,
        pv.segmento_objetivo,
        pv.id_producto,
        pv.id_combo,
        pv.categoria
    FROM dbo.vw_promos_vigentes pv
    WHERE (pv.id_segmento_objetivo IS NULL OR pv.id_segmento_objetivo = @id_segmento);
END;
GO

-- ------------------------------------------------------------------------------
-- 7. CONSULTA: Gramajes y pesos registrados de carnes
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_peso_carne_frecuente
    @id_segmento INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Catálogo oficial de pesos y gramajes
    -- NOTA: el filtro por segmento y por pedido no anulado debe aplicarse sobre
    -- las ventas (subconsulta), no dentro de un LEFT JOIN: dentro del JOIN no
    -- filtra la agregación y las cantidades de pedidos ANULADOS se seguían contando.
    SELECT 
        pr.id_producto,
        pr.nombre,
        pr.categoria,
        pr.peso_cantidad,
        pr.peso_unidad,
        pr.precio,
        pr.estilo,
        -- Unidades vendidas en el segmento si se especifica
        ISNULL(SUM(v.cantidad), 0) AS unidades_vendidas
    FROM dbo.producto_carta pr
    LEFT JOIN (
        SELECT d.id_producto, d.cantidad
        FROM dbo.pedido_detalle d
        JOIN dbo.pedido pd ON pd.id_pedido = d.id_pedido
        JOIN dbo.persona pe ON pe.id_persona = pd.id_persona
        WHERE pd.estado <> 'ANULADO'
          AND (@id_segmento IS NULL OR pe.id_segmento = @id_segmento)
    ) v ON v.id_producto = pr.id_producto
    WHERE pr.activo = 1 AND pr.peso_cantidad IS NOT NULL
    GROUP BY pr.id_producto, pr.nombre, pr.categoria, pr.peso_cantidad, pr.peso_unidad, pr.precio, pr.estilo
    ORDER BY pr.peso_cantidad ASC, unidades_vendidas DESC;
END;
GO

-- ------------------------------------------------------------------------------
-- 8. CONSULTA: Productos y combos según presupuesto y comensales
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_productos_por_presupuesto
    @presupuesto_maximo DECIMAL(10,2),
    @id_segmento INT = NULL,
    @nro_personas INT = 1
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Cortes y platos individuales
    SELECT 
        'PRODUCTO' AS tipo,
        id_producto AS id,
        nombre,
        categoria,
        precio,
        peso_cantidad,
        peso_unidad,
        descripcion
    FROM dbo.producto_carta
    WHERE activo = 1 AND precio <= @presupuesto_maximo
    UNION ALL
    -- 2. Combos
    SELECT 
        'COMBO' AS tipo,
        id_combo AS id,
        nombre,
        'COMBO' AS categoria,
        precio,
        NULL AS peso_cantidad,
        NULL AS peso_unidad,
        descripcion
    FROM dbo.combo
    WHERE activo = 1 AND precio <= @presupuesto_maximo
    ORDER BY precio ASC;
END;
GO

-- ------------------------------------------------------------------------------
-- 9. CONSULTA: Historial de ofertas de la negociación
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_historial_ofertas
    @id_negociacion BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        o.id_oferta,
        o.id_negociacion,
        o.fecha_oferta,
        o.respuesta,
        o.detalle,
        CASE 
            WHEN o.id_producto IS NOT NULL THEN 'PRODUCTO'
            WHEN o.id_combo IS NOT NULL THEN 'COMBO'
            WHEN o.id_promocion IS NOT NULL THEN 'PROMOCION'
        END AS tipo_oferta,
        COALESCE(pr.nombre, c.nombre, prm.nombre_promocion) AS elemento_ofertado,
        COALESCE(pr.precio, c.precio, 0) AS precio_base
    FROM dbo.oferta_negociacion o
    LEFT JOIN dbo.producto_carta pr ON pr.id_producto = o.id_producto
    LEFT JOIN dbo.combo c ON c.id_combo = o.id_combo
    LEFT JOIN dbo.promocion prm ON prm.id_promocion = o.id_promocion
    WHERE o.id_negociacion = @id_negociacion
    ORDER BY o.fecha_oferta DESC;
END;
GO

-- ------------------------------------------------------------------------------
-- 10. CONSULTA: Estado de negociación y verificación de primer pago
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_consultar_estado_conversion
    @id_negociacion BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        n.id_negociacion,
        n.id_persona,
        n.nro_ciclo,
        n.estado,
        n.fecha_inicio,
        n.fecha_fin,
        n.fecha_primer_pago,
        n.motivo_perdida,
        -- Datos del pedido vinculado
        pd.id_pedido,
        pd.total AS total_pedido,
        pd.estado AS estado_pedido,
        -- Primer pago confirmado
        pg.id_pago,
        pg.monto AS monto_primer_pago,
        pg.fecha_pago AS fecha_primer_pago_registrado,
        pg.estado AS estado_pago,
        mp.codigo AS medio_pago,
        -- Evaluación de elegibilidad para conversión
        CASE 
            WHEN n.estado = 'CONVERTIDA' THEN 'YA_CONVERTIDO'
            WHEN n.estado = 'PERDIDA' THEN 'NEGOCIACION_CERRADA_PERDIDA'
            WHEN pg.estado = 'CONFIRMADO' AND pg.monto > 0 THEN 'ELEGIBLE_PARA_CONVERSION'
            ELSE 'SIN_PAGO_CONFIRMADO'
        END AS dictamen_conversion
    FROM dbo.negociacion n
    LEFT JOIN dbo.pedido pd ON pd.id_negociacion = n.id_negociacion
    OUTER APPLY (
        SELECT TOP 1 p.* 
        FROM dbo.pago p 
        WHERE p.id_pedido = pd.id_pedido AND p.estado = 'CONFIRMADO'
        ORDER BY p.fecha_pago ASC
    ) pg
    LEFT JOIN dbo.medio_pago mp ON mp.id_medio_pago = pg.id_medio_pago
    WHERE n.id_negociacion = @id_negociacion;
END;
GO

-- ------------------------------------------------------------------------------
-- 11. REGISTRO: Preferencia gastronómica expresada por el LEAD
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_registrar_preferencia_lead
    @id_persona BIGINT,
    @id_producto_favorito INT,
    @origen VARCHAR(50) = 'CONVERSACION_WHATSAPP'
AS
BEGIN
    SET NOCOUNT ON;

    -- Validar que el producto existe y está activo
    IF NOT EXISTS (SELECT 1 FROM dbo.producto_carta WHERE id_producto = @id_producto_favorito)
    BEGIN
        RAISERROR('El producto especificado no existe en la carta.', 16, 1);
        RETURN;
    END

    -- Actualizar el último formulario de captación si existe
    DECLARE @id_formulario BIGINT;
    SELECT TOP 1 @id_formulario = id_formulario 
    FROM dbo.formulario_captacion 
    WHERE id_persona = @id_persona 
    ORDER BY fecha_envio DESC;

    IF @id_formulario IS NOT NULL
    BEGIN
        UPDATE dbo.formulario_captacion
        SET id_producto_favorito = @id_producto_favorito
        WHERE id_formulario = @id_formulario;
    END

    -- Registrar auditoría en accion_agente
    INSERT INTO dbo.accion_agente (id_personal, id_negociacion, id_buyer, id_sesion_whatsapp, accion, detalle, resultado, fecha_ejecucion)
    VALUES (
        1, 
        NULL, 
        NULL, 
        NULL, 
        'REGISTRAR_PREFERENCIA', 
        CONCAT('Preferencia registrada id_producto: ', @id_producto_favorito, ' (Origen: ', @origen, ')'), 
        'EXITOSO', 
        SYSUTCDATETIME()
    );

    SELECT 1 AS exito, 'Preferencia registrada exitosamente' AS mensaje;
END;
GO

-- ------------------------------------------------------------------------------
-- 12. REGISTRO: Necesidad comercial detectada (comensales, presupuesto)
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_registrar_necesidad_lead
    @id_negociacion BIGINT,
    @nro_personas INT = NULL,
    @presupuesto DECIMAL(10,2) = NULL,
    @necesidad NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.negociacion WHERE id_negociacion = @id_negociacion AND estado = 'ABIERTA')
    BEGIN
        RAISERROR('La negociación no existe o no se encuentra abierta.', 16, 1);
        RETURN;
    END

    -- Actualizar resumen de la negociación de manera controlada
    DECLARE @texto_resumen NVARCHAR(500);
    SET @texto_resumen = CONCAT('Necesidad: ', @necesidad, 
                                ISNULL(CONCAT(' | Personas: ', @nro_personas), ''), 
                                ISNULL(CONCAT(' | Presupuesto: S/ ', @presupuesto), ''));

    UPDATE dbo.negociacion
    SET resumen = SUBSTRING(ISNULL(resumen + ' || ', '') + @texto_resumen, 1, 500)
    WHERE id_negociacion = @id_negociacion;

    -- Registrar auditoría de agente
    INSERT INTO dbo.accion_agente (id_personal, id_negociacion, accion, detalle, resultado, fecha_ejecucion)
    VALUES (1, @id_negociacion, 'REGISTRAR_NECESIDAD', SUBSTRING(@texto_resumen, 1, 500), 'EXITOSO', SYSUTCDATETIME());

    SELECT 1 AS exito, 'Necesidad comercial registrada exitosamente' AS mensaje;
END;
GO

-- ------------------------------------------------------------------------------
-- 13. REGISTRO: Objeción comercial clasificada
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_registrar_objecion_lead
    @id_negociacion BIGINT,
    @tipo_objecion VARCHAR(50), -- PRECIO, PRESUPUESTO, INDECISION, TAMANO, PROMO, OTRA
    @detalle NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.negociacion WHERE id_negociacion = @id_negociacion AND estado = 'ABIERTA')
    BEGIN
        RAISERROR('La negociación no existe o no se encuentra abierta.', 16, 1);
        RETURN;
    END

    -- Registrar en accion_agente
    INSERT INTO dbo.accion_agente (id_personal, id_negociacion, accion, detalle, resultado, fecha_ejecucion)
    VALUES (
        1, 
        @id_negociacion, 
        'REGISTRAR_OBJECION', 
        SUBSTRING(CONCAT('[', UPPER(@tipo_objecion), '] ', @detalle), 1, 500), 
        'EXITOSO', 
        SYSUTCDATETIME()
    );

    SELECT 1 AS exito, 'Objeción comercial registrada exitosamente' AS mensaje;
END;
GO

-- ------------------------------------------------------------------------------
-- 14. REGISTRO: Oferta realizada en la negociación
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_registrar_oferta_lead
    @id_negociacion BIGINT,
    @id_producto INT = NULL,
    @id_combo INT = NULL,
    @id_promocion INT = NULL,
    @detalle NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Validar restricción CK_oferta_objeto: exactamente UNO debe ser NOT NULL
    DECLARE @contador INT = 0;
    IF @id_producto IS NOT NULL SET @contador = @contador + 1;
    IF @id_combo IS NOT NULL SET @contador = @contador + 1;
    IF @id_promocion IS NOT NULL SET @contador = @contador + 1;

    IF @contador <> 1
    BEGIN
        RAISERROR('Debe especificar exactamente uno entre producto, combo o promocion.', 16, 1);
        RETURN;
    END

    -- Evitar duplicados consecutivos por reintentos de webhook (ventana 30s)
    IF EXISTS (
        SELECT 1 FROM dbo.oferta_negociacion
        WHERE id_negociacion = @id_negociacion
          AND (id_producto = @id_producto OR (@id_producto IS NULL AND id_producto IS NULL))
          AND (id_combo = @id_combo OR (@id_combo IS NULL AND id_combo IS NULL))
          AND (id_promocion = @id_promocion OR (@id_promocion IS NULL AND id_promocion IS NULL))
          AND DATEDIFF(SECOND, fecha_oferta, SYSUTCDATETIME()) < 30
    )
    BEGIN
        SELECT TOP 1 id_oferta, 'Oferta reciente ya registrada (evitado duplicado por webhook)' AS mensaje
        FROM dbo.oferta_negociacion
        WHERE id_negociacion = @id_negociacion
        ORDER BY fecha_oferta DESC;
        RETURN;
    END

    INSERT INTO dbo.oferta_negociacion (id_negociacion, id_producto, id_combo, id_promocion, fecha_oferta, respuesta, detalle)
    VALUES (@id_negociacion, @id_producto, @id_combo, @id_promocion, SYSUTCDATETIME(), 'SIN_RESPUESTA', @detalle);

    DECLARE @id_oferta_creada BIGINT = SCOPE_IDENTITY();

    -- Registrar auditoría
    INSERT INTO dbo.accion_agente (id_personal, id_negociacion, accion, detalle, resultado, fecha_ejecucion)
    VALUES (
        1, 
        @id_negociacion, 
        CASE WHEN @id_combo IS NOT NULL THEN 'OFRECER_COMBO' WHEN @id_promocion IS NOT NULL THEN 'OFRECER_PROMOCION' ELSE 'OFRECER_PRODUCTO' END, 
        SUBSTRING(ISNULL(@detalle, 'Oferta presentada al LEAD'), 1, 500), 
        'EXITOSO', 
        SYSUTCDATETIME()
    );

    SELECT @id_oferta_creada AS id_oferta, 'Oferta registrada con exito' AS mensaje;
END;
GO

-- ------------------------------------------------------------------------------
-- 15. REGISTRO: Respuesta a la oferta (ACEPTADA / RECHAZADA / SIN_RESPUESTA)
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_registrar_respuesta_oferta
    @id_negociacion BIGINT,
    @id_oferta BIGINT = NULL,
    @respuesta VARCHAR(15), -- ACEPTADA, RECHAZADA, SIN_RESPUESTA
    @detalle NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @respuesta NOT IN ('ACEPTADA', 'RECHAZADA', 'SIN_RESPUESTA')
    BEGIN
        RAISERROR('Estado de respuesta no valido. Permitidos: ACEPTADA, RECHAZADA, SIN_RESPUESTA.', 16, 1);
        RETURN;
    END

    -- Si no se pasó id_oferta, tomar la última oferta de la negociación
    IF @id_oferta IS NULL
    BEGIN
        SELECT TOP 1 @id_oferta = id_oferta 
        FROM dbo.oferta_negociacion 
        WHERE id_negociacion = @id_negociacion 
        ORDER BY fecha_oferta DESC;
    END

    IF @id_oferta IS NULL
    BEGIN
        RAISERROR('No se encontro ninguna oferta para registrar la respuesta.', 16, 1);
        RETURN;
    END

    UPDATE dbo.oferta_negociacion
    SET respuesta = @respuesta,
        detalle = COALESCE(@detalle, detalle)
    WHERE id_oferta = @id_oferta;

    -- Registrar auditoría
    INSERT INTO dbo.accion_agente (id_personal, id_negociacion, accion, detalle, resultado, fecha_ejecucion)
    VALUES (
        1, 
        @id_negociacion, 
        CONCAT('RESPUESTA_OFERTA_', @respuesta), 
        SUBSTRING(CONCAT('Oferta #', @id_oferta, ': ', @respuesta, ' | ', ISNULL(@detalle, '')), 1, 500), 
        'EXITOSO', 
        SYSUTCDATETIME()
    );

    SELECT @id_oferta AS id_oferta, @respuesta AS respuesta, 'Respuesta actualizada exitosamente' AS mensaje;
END;
GO

-- ------------------------------------------------------------------------------
-- 16. REGISTRO: Acción de seguimiento comercial (24h, 48h, 72h)
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_registrar_accion_seguimiento
    @id_negociacion BIGINT,
    @tipo_accion VARCHAR(50),
    @detalle NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;

    -- Registrar en auditoría oficial de agente
    INSERT INTO dbo.accion_agente (id_personal, id_negociacion, accion, detalle, resultado, fecha_ejecucion)
    VALUES (1, @id_negociacion, @tipo_accion, SUBSTRING(@detalle, 1, 500), 'EXITOSO', SYSUTCDATETIME());

    SELECT 1 AS exito, 'Accion de seguimiento registrada exitosamente' AS mensaje;
END;
GO

-- ------------------------------------------------------------------------------
-- 17. OPERACIÓN RESTRINGIDA: Verificación y aplicación transaccional de conversión a PAYER
-- REGLA DE ORO: Requiere primer pago CONFIRMADO en dbo.pago. El agente IA NO puede confirmarlo.
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_verificar_y_aplicar_conversion
    @id_negociacion BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- 1. Validar existencia y estado de la negociación
    DECLARE @id_persona BIGINT, @estado VARCHAR(15), @nro_ciclo INT;
    SELECT @id_persona = id_persona, @estado = estado, @nro_ciclo = nro_ciclo
    FROM dbo.negociacion
    WHERE id_negociacion = @id_negociacion;

    IF @id_persona IS NULL
    BEGIN
        RAISERROR('La negociacion no existe.', 16, 1);
        RETURN;
    END

    IF @estado = 'CONVERTIDA'
    BEGIN
        SELECT 1 AS ya_convertido, 'La negociacion ya se encuentra formalmente CONVERTIDA a PAYER.' AS mensaje;
        RETURN;
    END

    IF @estado = 'PERDIDA'
    BEGIN
        RAISERROR('La negociacion se encuentra cerrada como PERDIDA. No procede conversion directa.', 16, 1);
        RETURN;
    END

    -- 2. Verificar existencia de un pago CONFIRMADO asociado a un pedido
    DECLARE @id_pedido BIGINT, @id_pago BIGINT, @fecha_pago DATETIME2, @monto DECIMAL(10,2);

    SELECT TOP 1 
        @id_pedido = pd.id_pedido,
        @id_pago = pg.id_pago,
        @fecha_pago = pg.fecha_pago,
        @monto = pg.monto
    FROM dbo.pedido pd
    JOIN dbo.pago pg ON pg.id_pedido = pd.id_pedido
    WHERE (pd.id_negociacion = @id_negociacion OR pd.id_persona = @id_persona)
      AND pg.estado = 'CONFIRMADO'
      AND pg.monto > 0
    ORDER BY pg.fecha_pago ASC;

    IF @id_pago IS NULL
    BEGIN
        -- REGLA DE SEGURIDAD: Sin pago confirmado por caja/operador, SE RECHAZA LA CONVERSIÓN
        RAISERROR('CONVERSION_DENEGADA: No existe ningun pago CONFIRMADO en SQL Server para esta negociacion. La palabra del cliente o una captura no constituyen pago oficial.', 16, 1);
        RETURN;
    END

    -- 3. Si existe pago confirmado, ejecutar la transacción de conversión formal
    BEGIN TRANSACTION;
    BEGIN TRY
        -- A. Actualizar negociación a CONVERTIDA cumpliendo CHECK CK_negociacion_estado
        UPDATE dbo.negociacion
        SET estado = 'CONVERTIDA',
            fecha_fin = SYSUTCDATETIME(),
            id_pedido = @id_pedido,
            fecha_primer_pago = @fecha_pago,
            motivo_perdida = NULL
        WHERE id_negociacion = @id_negociacion;

        -- B. Actualizar fase actual de la persona a PAYER
        UPDATE dbo.persona
        SET fase_actual = 'PAYER'
        WHERE id_persona = @id_persona;

        -- C. Registrar en historial de fases cumpliendo CK_historial_coherencia
        INSERT INTO dbo.historial_fases (id_persona, fase, fecha_cambio, id_negociacion, id_pedido)
        VALUES (@id_persona, 'PAYER', SYSUTCDATETIME(), @id_negociacion, @id_pedido);

        -- D. Registrar en auditoría de acciones del agente
        INSERT INTO dbo.accion_agente (id_personal, id_negociacion, accion, detalle, resultado, fecha_ejecucion)
        VALUES (
            1, 
            @id_negociacion, 
            'CONVERSION_CONFIRMADA', 
            CONCAT('Conversion verificada formalmente. Pago #', @id_pago, ' por S/ ', @monto, ' (Pedido #', @id_pedido, ')'), 
            'EXITOSO', 
            SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;

        SELECT 
            1 AS exito, 
            @id_negociacion AS id_negociacion, 
            @id_pedido AS id_pedido, 
            @id_pago AS id_primer_pago, 
            @monto AS monto_pago, 
            'Conversion a PAYER aplicada exitosamente conforme a SQL Server V3' AS mensaje;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
