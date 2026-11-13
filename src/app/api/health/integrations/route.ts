import { NextResponse } from "next/server";
import { checkDbHealth, executeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

// Endpoint de diagnóstico: semáforo de BD + Whapi + Hermes y últimas trazas.
// Útil para verificar el despliegue sin ejecutar comandos en el contenedor.
//   GET /api/health/integrations

const TIMEOUT_MS = 8000;

async function conTimeout<T>(
  tarea: (signal: AbortSignal) => Promise<T>,
  ms = TIMEOUT_MS,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await tarea(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function verificarWhapi() {
  const token = process.env.WHAPI_TOKEN?.trim();
  const apiUrl = (process.env.WHAPI_API_URL || "https://gate.whapi.cloud").replace(/\/+$/, "");

  if (!token) {
    return { configurado: false, ok: false, error: "WHAPI_TOKEN no configurado" };
  }

  try {
    const res = await conTimeout((signal) =>
      fetch(`${apiUrl}/health`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
        cache: "no-store",
      }),
    );

    const raw = await res.text();
    let status: any = raw;
    try {
      status = JSON.parse(raw);
    } catch {
      /* respuesta no JSON */
    }

    const texto = String(status?.status?.text || status?.text || "").toUpperCase();
    const conectado = res.ok && (texto === "AUTH" || status?.status?.code === 4 || status?.code === 4);

    return {
      configurado: true,
      ok: conectado,
      httpStatus: res.status,
      estado: status?.status || status,
      pista: conectado
        ? "Canal Whapi conectado (AUTH)"
        : "Canal no autenticado: escanea el QR en el panel de Whapi o revisa el token",
    };
  } catch (error: any) {
    return {
      configurado: true,
      ok: false,
      error: error?.name === "AbortError" ? "Timeout al consultar Whapi" : error.message,
    };
  }
}

async function verificarHermes(deep = false) {
  const url = process.env.HERMES_API_URL?.trim();
  const key = process.env.HERMES_API_KEY?.trim();
  const modelo = process.env.HERMES_MODEL?.trim() || "hermes-agent";

  if (!url || !key) {
    return {
      configurado: false,
      ok: false,
      modelo,
      error: "HERMES_API_URL y/o HERMES_API_KEY no configurados",
    };
  }

  const baseUrl = url.replace(/\/+$/, "");

  // /models es una comprobación barata (no consume tokens de generación).
  // Un 404 aquí NO significa que Hermes esté caído: muchos servidores
  // OpenAI-compatibles solo exponen /chat/completions.
  try {
    const res = await conTimeout((signal) =>
      fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal,
        cache: "no-store",
      }),
    );

    const alcanzable = res.status < 500;
    const resultado: Record<string, any> = {
      configurado: true,
      ok: alcanzable,
      alcanzable,
      httpStatus: res.status,
      url: baseUrl,
      modelo,
      pista:
        res.status === 401
          ? "HTTP 401: HERMES_API_KEY no coincide con API_SERVER_KEY de Hermes"
          : res.status === 404
            ? "Servidor alcanzable (sin /models); valida /chat/completions con ?deep=1"
            : res.ok
              ? "Hermes responde"
              : `Hermes respondió HTTP ${res.status}`,
    };

    // Prueba real de generación (consume tokens): solo con ?deep=1
    if (deep) {
      try {
        const chat = await conTimeout(
          (signal) =>
            fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              signal,
              cache: "no-store",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model: modelo,
                messages: [{ role: "user", content: "Responde solo: OK" }],
                temperature: 0,
                max_tokens: 5,
              }),
            }),
          30000,
        );

        const raw = await chat.text();
        let data: any = null;
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
        const contenido = data?.choices?.[0]?.message?.content ?? null;

        resultado.deep = {
          probado: true,
          ok: chat.ok && Boolean(contenido),
          httpStatus: chat.status,
          respuesta: contenido,
          error: chat.ok ? null : raw.slice(0, 300),
        };
        resultado.ok = Boolean(resultado.deep.ok);
      } catch (error: any) {
        resultado.deep = {
          probado: true,
          ok: false,
          error:
            error?.name === "AbortError"
              ? "Timeout en /chat/completions (modelo lento o red interna)"
              : error.message,
        };
        resultado.ok = false;
      }
    }

    return resultado;
  } catch (error: any) {
    return {
      configurado: true,
      ok: false,
      alcanzable: false,
      url: baseUrl,
      modelo,
      error:
        error?.name === "AbortError"
          ? "Timeout al conectar con Hermes (revisa red interna/puerto)"
          : error.message,
    };
  }
}

async function obtenerTrazas() {
  try {
    const eventos = await executeQuery<any>(`
      SELECT TOP 5 id_evento, proveedor, tipo, estado, recibido_en, procesado_en, error_resumen
      FROM dbo.evento_integracion
      ORDER BY id_evento DESC;
    `);

    const mensajes = await executeQuery<any>(`
      SELECT TOP 5 id_mensaje, id_sesion, direccion, tipo, LEFT(contenido, 80) AS contenido,
             estado_entrega, fecha_mensaje
      FROM dbo.mensaje_whatsapp
      ORDER BY id_mensaje DESC;
    `);

    return { eventos, mensajes, error: null as string | null };
  } catch (error: any) {
    return { eventos: [], mensajes: [], error: error.message };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deep = searchParams.get("deep") === "1" || searchParams.get("deep") === "true";

  const [db, whapi, hermes, trazas] = await Promise.all([
    checkDbHealth(),
    verificarWhapi(),
    verificarHermes(deep),
    obtenerTrazas(),
  ]);

  const ok = Boolean(db.connected && whapi.ok && hermes.ok);

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      resumen: {
        database: db.connected ? "OK" : "FALLA",
        whapi: whapi.ok ? "OK" : "FALLA",
        hermes: hermes.ok ? "OK" : "FALLA",
      },
      database: {
        ok: db.connected,
        base: db.database,
        tablas: db.tableCount ?? 0,
        error: db.error ?? null,
      },
      whapi,
      hermes,
      trazas,
    },
    { status: 200 },
  );
}
