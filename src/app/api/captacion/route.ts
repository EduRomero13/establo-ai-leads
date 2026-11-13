import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";
import { toolRegistrarPreferenciaLead } from "@/lib/sql-tools-engine";

function normalizarTelefonoPeru(raw: string): {
  digitos9: string;
  formatoE164: string;
} {
  const digits = raw.replace(/\D/g, "");
  const clean9 =
    digits.startsWith("51") && digits.length >= 11 ? digits.slice(2) : digits;
  const formatoE164 =
    clean9.length === 9 && clean9.startsWith("9")
      ? `+51${clean9}`
      : digits.startsWith("51")
        ? `+${digits}`
        : `+${digits}`;
  return { digitos9: clean9, formatoE164 };
}

export async function GET() {
  try {
    const [segmentos, productos] = await Promise.all([
      executeQuery<{ id_segmento: number; nombre: string; descripcion: string | null }>(
        `SELECT id_segmento, nombre, descripcion
         FROM dbo.segmento_cliente
         ORDER BY id_segmento;`
      ),
      executeQuery<{
        id_producto: number;
        nombre: string;
        categoria: string;
        es_corte: boolean;
        precio: number;
      }>(
        `SELECT id_producto, nombre, categoria, es_corte, precio
         FROM dbo.producto_carta
         WHERE activo = 1
         ORDER BY es_corte DESC, categoria, nombre;`
      ),
    ]);

    return NextResponse.json({
      success: true,
      segmentos,
      productos,
    });
  } catch (error: any) {
    console.error("[API Captacion GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al cargar opciones del formulario" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Honeypot anti-spam: si viene relleno, responder OK sin insertar
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return NextResponse.json({ success: true, ignored: true });
    }

    const nombres = typeof body.nombres === "string" ? body.nombres.trim() : "";
    const apellidos = typeof body.apellidos === "string" ? body.apellidos.trim() : "";
    const telefonoRaw = typeof body.telefono === "string" ? body.telefono.trim() : "";
    const email = typeof body.email === "string" && body.email.trim() !== "" ? body.email.trim() : null;
    const fechaNacimiento =
      typeof body.fecha_nacimiento === "string" && body.fecha_nacimiento.trim() !== ""
        ? body.fecha_nacimiento.trim()
        : null;
    const idSegmento = body.id_segmento ? parseInt(String(body.id_segmento), 10) : null;
    const idProductoFavorito = body.id_producto_favorito
      ? parseInt(String(body.id_producto_favorito), 10)
      : null;
    const nroPersonas = body.nro_personas ? parseInt(String(body.nro_personas), 10) : null;
    const notas = typeof body.notas === "string" && body.notas.trim() !== "" ? body.notas.trim() : null;
    const consentimientoDatos = Boolean(body.consentimiento_datos);
    const consentimientoMarketing = Boolean(body.consentimiento_marketing);

    if (!nombres || !apellidos || !telefonoRaw) {
      return NextResponse.json(
        { success: false, error: "Nombres, apellidos y teléfono son obligatorios." },
        { status: 400 }
      );
    }

    if (!consentimientoDatos) {
      return NextResponse.json(
        { success: false, error: "Debes autorizar el tratamiento de datos personales para continuar." },
        { status: 400 }
      );
    }

    const { digitos9, formatoE164 } = normalizarTelefonoPeru(telefonoRaw);
    if (digitos9.length < 7) {
      return NextResponse.json(
        { success: false, error: "Ingresa un número de teléfono o WhatsApp válido." },
        { status: 400 }
      );
    }

    // 1. Buscar persona existente por teléfono
    const existentes = await executeQuery<{
      id_persona: number;
      fase_actual: string;
    }>(
      `SELECT TOP 1 id_persona, fase_actual
       FROM dbo.persona
       WHERE telefono = @telE164
          OR telefono = @telRaw
          OR REPLACE(REPLACE(telefono, '+', ''), ' ', '') LIKE '%' + @tel9;`,
      {
        telE164: { type: sql.VarChar(20), value: formatoE164 },
        telRaw: { type: sql.VarChar(20), value: telefonoRaw },
        tel9: { type: sql.VarChar(20), value: digitos9 },
      }
    );

    let idPersona: number;

    if (existentes.length > 0) {
      idPersona = existentes[0].id_persona;
      await executeQuery(
        `UPDATE dbo.persona
         SET nombres = @nombres,
             apellidos = @apellidos,
             email = COALESCE(@email, email),
             fecha_nacimiento = COALESCE(@fechaNac, fecha_nacimiento),
             id_segmento = COALESCE(@idSegmento, id_segmento),
             fase_actual = CASE WHEN fase_actual = 'BUYER' THEN 'LEAD' ELSE fase_actual END,
             consentimiento_datos_fecha = COALESCE(consentimiento_datos_fecha, SYSUTCDATETIME()),
             consentimiento_marketing_fecha = CASE
               WHEN @consentMkt = 1 THEN COALESCE(consentimiento_marketing_fecha, SYSUTCDATETIME())
               ELSE consentimiento_marketing_fecha
             END
         WHERE id_persona = @idPersona;`,
        {
          idPersona: { type: sql.BigInt, value: idPersona },
          nombres: { type: sql.NVarChar(100), value: nombres },
          apellidos: { type: sql.NVarChar(100), value: apellidos },
          email: { type: sql.NVarChar(150), value: email },
          fechaNac: { type: sql.Date, value: fechaNacimiento },
          idSegmento: { type: sql.Int, value: idSegmento },
          consentMkt: { type: sql.Bit, value: consentimientoMarketing ? 1 : 0 },
        }
      );
    } else {
      const insertPersona = await executeQuery<{ id_persona: number }>(
        `INSERT INTO dbo.persona (
           nombres, apellidos, telefono, email, fecha_nacimiento,
           id_segmento, fecha_registro, fase_actual,
           consentimiento_datos_fecha, consentimiento_marketing_fecha
         )
         OUTPUT INSERTED.id_persona
         VALUES (
           @nombres, @apellidos, @telefono, @email, @fechaNac,
           @idSegmento, SYSUTCDATETIME(), 'LEAD',
           SYSUTCDATETIME(), CASE WHEN @consentMkt = 1 THEN SYSUTCDATETIME() ELSE NULL END
         );`,
        {
          nombres: { type: sql.NVarChar(100), value: nombres },
          apellidos: { type: sql.NVarChar(100), value: apellidos },
          telefono: { type: sql.VarChar(20), value: formatoE164 },
          email: { type: sql.NVarChar(150), value: email },
          fechaNac: { type: sql.Date, value: fechaNacimiento },
          idSegmento: { type: sql.Int, value: idSegmento },
          consentMkt: { type: sql.Bit, value: consentimientoMarketing ? 1 : 0 },
        }
      );
      idPersona = insertPersona[0].id_persona;
    }

    // 2. Registrar preferencia gastronómica declarada si eligió producto
    if (idProductoFavorito && !Number.isNaN(idProductoFavorito)) {
      try {
        await toolRegistrarPreferenciaLead(
          idPersona,
          idProductoFavorito,
          "FORMULARIO_CAPTACION"
        );
      } catch (prefErr) {
        console.warn("[API Captacion] No se pudo registrar preferencia en SP:", prefErr);
      }
    }

    // 3. Vincular sesión de WhatsApp huérfana si el usuario ya escribió antes
    const sesiones = await executeQuery<{ id_sesion: number }>(
      `SELECT TOP 1 id_sesion
       FROM dbo.sesion_whatsapp
       WHERE telefono_cliente = @telE164
          OR REPLACE(REPLACE(telefono_cliente, '+', ''), ' ', '') LIKE '%' + @tel9
       ORDER BY fecha_ultimo_mensaje DESC;`,
      {
        telE164: { type: sql.VarChar(20), value: formatoE164 },
        tel9: { type: sql.VarChar(20), value: digitos9 },
      }
    );
    const idSesionWhatsapp = sesiones[0]?.id_sesion || null;

    if (idSesionWhatsapp) {
      await executeQuery(
        `UPDATE dbo.sesion_whatsapp
         SET id_persona = @idPersona
         WHERE id_sesion = @idSesion AND id_persona IS NULL;`,
        {
          idPersona: { type: sql.BigInt, value: idPersona },
          idSesion: { type: sql.BigInt, value: idSesionWhatsapp },
        }
      );
    }

    // 4. Construir resumen inicial de pre-negociación
    const resumenPartes: string[] = ["Registro desde formulario web de captación."];
    if (nroPersonas && !Number.isNaN(nroPersonas)) {
      resumenPartes.push(`Comensales estimados: ${nroPersonas}.`);
    }
    if (notas) {
      resumenPartes.push(`Notas del cliente: ${notas}`);
    }
    const resumenInicial = resumenPartes.join(" ");

    // 5. Determinar la plataforma de origen (el formulario es una landing web)
    const plataformaRes = await executeQuery<{ id_plataforma: number }>(
      `SELECT TOP 1 id_plataforma
       FROM dbo.plataforma
       ORDER BY CASE WHEN codigo = 'LANDING_PAGE' THEN 0 ELSE 1 END, id_plataforma;`
    );
    const idPlataforma = plataformaRes[0]?.id_plataforma ?? null;

    // 6. Verificar si ya existe una negociación ABIERTA para no duplicar ciclo
    const negAbiertas = await executeQuery<{ id_negociacion: number }>(
      `SELECT TOP 1 id_negociacion
       FROM dbo.negociacion
       WHERE id_persona = @idPersona AND estado = 'ABIERTA'
       ORDER BY fecha_inicio DESC;`,
      { idPersona: { type: sql.BigInt, value: idPersona } }
    );

    let idNegociacion: number;
    let yaTeniaNegociacion = false;

    if (negAbiertas.length > 0) {
      idNegociacion = negAbiertas[0].id_negociacion;
      yaTeniaNegociacion = true;
      await executeQuery(
        `UPDATE dbo.negociacion
         SET id_sesion_whatsapp = COALESCE(id_sesion_whatsapp, @idSesion),
             resumen = CASE
               WHEN @notas IS NOT NULL OR @nroPersonas IS NOT NULL THEN @resumen
               ELSE resumen
             END
         WHERE id_negociacion = @idNeg;`,
        {
          idNeg: { type: sql.BigInt, value: idNegociacion },
          idSesion: { type: sql.BigInt, value: idSesionWhatsapp },
          notas: { type: sql.NVarChar(500), value: notas },
          nroPersonas: { type: sql.Int, value: nroPersonas },
          resumen: { type: sql.NVarChar(1000), value: resumenInicial },
        }
      );
    } else {
      const cicloRes = await executeQuery<{ next_ciclo: number }>(
        `SELECT COALESCE(MAX(nro_ciclo), 0) + 1 AS next_ciclo
         FROM dbo.negociacion
         WHERE id_persona = @idPersona;`,
        { idPersona: { type: sql.BigInt, value: idPersona } }
      );
      const nextCiclo = cicloRes[0]?.next_ciclo || 1;

      // El modelo exige que el ciclo 1 nazca de un formulario de captación:
      // CK_negociacion_ciclo1 => (nro_ciclo = 1 AND id_formulario IS NOT NULL).
      // Por eso creamos buyer + formulario_captacion antes de la negociación.
      let idFormulario: number | null = null;
      if (nextCiclo === 1) {
        const insertBuyer = await executeQuery<{ id_buyer: number }>(
          `INSERT INTO dbo.buyer (
             id_persona, id_plataforma_origen, estado,
             fecha_primer_contacto, fecha_conversion
           )
           OUTPUT INSERTED.id_buyer
           VALUES (@idPersona, @idPlataforma, 'CONVERTIDO_LEAD', SYSUTCDATETIME(), SYSUTCDATETIME());`,
          {
            idPersona: { type: sql.BigInt, value: idPersona },
            idPlataforma: { type: sql.Int, value: idPlataforma },
          }
        );
        const idBuyer = insertBuyer[0].id_buyer;

        const insertFormulario = await executeQuery<{ id_formulario: number }>(
          `INSERT INTO dbo.formulario_captacion (
             id_persona, id_buyer, id_plataforma_origen, id_sesion_whatsapp,
             id_producto_favorito, id_segmento_declarado, fecha_envio,
             acepta_politica_datos, acepta_marketing
           )
           OUTPUT INSERTED.id_formulario
           VALUES (
             @idPersona, @idBuyer, @idPlataforma, @idSesion,
             @idProducto, @idSegmento, SYSUTCDATETIME(), 1, @consentMkt
           );`,
          {
            idPersona: { type: sql.BigInt, value: idPersona },
            idBuyer: { type: sql.BigInt, value: idBuyer },
            idPlataforma: { type: sql.Int, value: idPlataforma },
            idSesion: { type: sql.BigInt, value: idSesionWhatsapp },
            idProducto: {
              type: sql.Int,
              value: Number.isFinite(idProductoFavorito as number) ? idProductoFavorito : null,
            },
            idSegmento: {
              type: sql.Int,
              value: Number.isFinite(idSegmento as number) ? idSegmento : null,
            },
            consentMkt: { type: sql.Bit, value: consentimientoMarketing ? 1 : 0 },
          }
        );
        idFormulario = insertFormulario[0].id_formulario;
      }

      const insertNeg = await executeQuery<{ id_negociacion: number }>(
        `INSERT INTO dbo.negociacion (
           id_persona, id_sesion_whatsapp, id_formulario, nro_ciclo,
           fecha_inicio, estado, resumen
         )
         OUTPUT INSERTED.id_negociacion
         VALUES (
           @idPersona, @idSesion, @idFormulario, @nroCiclo,
           SYSUTCDATETIME(), 'ABIERTA', @resumen
         );`,
        {
          idPersona: { type: sql.BigInt, value: idPersona },
          idSesion: { type: sql.BigInt, value: idSesionWhatsapp },
          idFormulario: { type: sql.BigInt, value: idFormulario },
          nroCiclo: { type: sql.Int, value: nextCiclo },
          resumen: { type: sql.NVarChar(1000), value: resumenInicial },
        }
      );
      idNegociacion = insertNeg[0].id_negociacion;
    }

    return NextResponse.json({
      success: true,
      id_persona: idPersona,
      id_negociacion: idNegociacion,
      ya_tenia_negociacion: yaTeniaNegociacion,
    });
  } catch (error: any) {
    console.error("[API Captacion POST Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo registrar tu solicitud." },
      { status: 500 }
    );
  }
}
