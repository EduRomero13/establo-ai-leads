import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";
import { toolRegistrarAccionAgente } from "@/lib/ai-agent";

// Clasificación de tiempo sin respuesta
function clasificarTiempo(horas: number): {
  categoria: string;
  severidad: 'normal' | 'advertencia' | 'riesgo' | 'critico';
  accionSugerida: string;
} {
  if (horas < 2) {
    return {
      categoria: "Espera normal (0-2 h)",
      severidad: "normal",
      accionSugerida: "Esperar respuesta natural del lead",
    };
  } else if (horas < 6) {
    return {
      categoria: "Respuesta demorada (2-6 h)",
      severidad: "advertencia",
      accionSugerida: "Monitorear chat sin insistir",
    };
  } else if (horas < 24) {
    return {
      categoria: "Posible desinterés (6-24 h)",
      severidad: "advertencia",
      accionSugerida: "Enviar mensaje de reactivación amable o valor agregado",
    };
  } else if (horas < 48) {
    return {
      categoria: "Riesgo alto de abandono (24-48 h)",
      severidad: "riesgo",
      accionSugerida: "Ofrecer promoción o combo especial del segmento",
    };
  } else if (horas < 72) {
    return {
      categoria: "Negociación inactiva (48-72 h)",
      severidad: "riesgo",
      accionSugerida: "Último intento de contacto antes de cierre por inactividad",
    };
  } else {
    return {
      categoria: "Inactividad prolongada (> 72 h)",
      severidad: "critico",
      accionSugerida: "Revisar para cierre por TIMEOUT_72H con confirmación del operador",
    };
  }
}

export async function GET() {
  try {
    const query = `
      SELECT 
        n.id_negociacion,
        n.id_persona,
        n.nro_ciclo,
        n.estado,
        n.fecha_inicio,
        n.resumen,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        p.id_segmento,
        s.nombre AS segmento_nombre,
        n.id_sesion_whatsapp,
        ult_m.contenido AS ultimo_mensaje_texto,
        ult_m.direccion AS ultimo_mensaje_direccion,
        ult_m.fecha_mensaje AS ultimo_mensaje_fecha,
        CAST(DATEDIFF_BIG(SECOND, COALESCE(ult_m.fecha_mensaje, n.fecha_inicio), SYSUTCDATETIME()) / 3600.0 AS DECIMAL(10,2)) AS horas_sin_respuesta
      FROM dbo.negociacion n
      JOIN dbo.persona p ON p.id_persona = n.id_persona
      LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
      OUTER APPLY (
        SELECT TOP 1 m.contenido, m.direccion, m.fecha_mensaje
        FROM dbo.mensaje_whatsapp m
        WHERE m.id_sesion = n.id_sesion_whatsapp
        ORDER BY m.fecha_mensaje DESC
      ) ult_m
      WHERE n.estado = 'ABIERTA'
      ORDER BY horas_sin_respuesta DESC;
    `;

    const abiertas = await executeQuery<any>(query);

    const negociacionesConClasificacion = abiertas.map(neg => {
      const horas = Number(neg.horas_sin_respuesta) || 0;
      const clasif = clasificarTiempo(horas);
      return {
        ...neg,
        horas_sin_respuesta: horas,
        clasificacion: clasif.categoria,
        severidad: clasif.severidad,
        accionSugerida: clasif.accionSugerida,
        esCandidatoTimeout: horas >= 72,
      };
    });

    return NextResponse.json({
      success: true,
      negociaciones: negociacionesConClasificacion,
      totalAbiertas: negociacionesConClasificacion.length,
    });
  } catch (error: any) {
    console.error("[API Followup GET Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Cerrar negociación como PERDIDA (RECHAZO o TIMEOUT_72H)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id_negociacion, motivo, detalle } = body;

    if (!id_negociacion || !motivo || !['RECHAZO', 'TIMEOUT_72H'].includes(motivo)) {
      return NextResponse.json(
        { success: false, error: "Parámetros inválidos. Motivo debe ser 'RECHAZO' o 'TIMEOUT_72H'" },
        { status: 400 }
      );
    }

    const updateQuery = `
      UPDATE dbo.negociacion
      SET estado = 'PERDIDA',
          motivo_perdida = @motivo,
          detalle_perdida = @detalle,
          fecha_fin = SYSUTCDATETIME()
      WHERE id_negociacion = @idNegociacion AND estado = 'ABIERTA';
    `;

    await executeQuery(updateQuery, {
      idNegociacion: { type: sql.BigInt, value: id_negociacion },
      motivo: { type: sql.VarChar(20), value: motivo },
      detalle: { type: sql.NVarChar(300), value: detalle || `Cierre registrado como ${motivo}` },
    });

    // Registrar en auditoría
    await toolRegistrarAccionAgente({
      id_negociacion,
      accion: 'MARCAR_PERDIDA',
      detalle: `Negociación cerrada como PERDIDA (${motivo}). Detalle: ${detalle}`,
      resultado: 'EXITOSO',
    });

    return NextResponse.json({
      success: true,
      mensaje: `Negociación marcada exitosamente como PERDIDA por ${motivo}.`,
    });
  } catch (error: any) {
    console.error("[API Followup POST Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

