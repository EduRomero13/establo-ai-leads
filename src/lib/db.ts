import sql from "mssql";

let pool: sql.ConnectionPool | null = null;

export function getDbConfig(): sql.config {
  return {
    server: process.env.DB_SERVER || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "1434", 10),
    database: process.env.DB_NAME || "buyer",
    user: process.env.DB_USER || "establo_app",
    password: process.env.DB_PASSWORD || "EstabloLeads2026!",
    options: {
      encrypt: false,
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
      enableArithAbort: true,
      connectTimeout: 8000,
      requestTimeout: 15000,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

export async function getDbPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  try {
    const config = getDbConfig();
    pool = await new sql.ConnectionPool(config).connect();
    return pool;
  } catch (error) {
    console.error("[SQL Server] Error al conectar a la base de datos:", error);
    pool = null;
    throw error;
  }
}

export async function executeQuery<T = any>(
  queryText: string,
  params: Record<string, { type: any; value: any }> = {}
): Promise<T[]> {
  try {
    const p = await getDbPool();
    const request = p.request();

    for (const [key, { type, value }] of Object.entries(params)) {
      request.input(key, type, value);
    }

    const result = await request.query<T>(queryText);
    return result.recordset;
  } catch (err: any) {
    // Si la conexión se reinició o cayó, cerrar pool viejo y reintentar de inmediato
    if (
      err?.code === 'ESOCKET' ||
      err?.message?.includes('Connection lost') ||
      err?.message?.includes('ECONNRESET') ||
      !pool?.connected
    ) {
      console.warn("[SQL Server] Conexión caída/reset, reconectando pool automáticamente...");
      try {
        if (pool) {
          await pool.close().catch(() => {});
        }
      } catch {}
      pool = null;

      const newPool = await getDbPool();
      const retryReq = newPool.request();
      for (const [key, { type, value }] of Object.entries(params)) {
        retryReq.input(key, type, value);
      }
      const retryRes = await retryReq.query<T>(queryText);
      return retryRes.recordset;
    }
    throw err;
  }
}

export async function checkDbHealth(): Promise<{
  connected: boolean;
  database: string;
  error?: string;
  tableCount?: number;
  kpiSummary?: any[];
  serverTime?: string;
}> {
  try {
    const p = await getDbPool();
    const countRes = await p.request().query<{ count: number }>(`
      SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE';
    `);
    const kpiRes = await p.request().query(`
      SELECT * FROM dbo.vw_kpi_mensual ORDER BY anio DESC, mes DESC;
    `);
    const timeRes = await p.request().query<{ server_time: Date }>(`
      SELECT SYSUTCDATETIME() AS server_time;
    `);

    return {
      connected: true,
      database: (p as any).config?.database || process.env.DB_NAME || "buyer",
      tableCount: countRes.recordset[0]?.count ?? 0,
      kpiSummary: kpiRes.recordset,
      serverTime: timeRes.recordset[0]?.server_time?.toISOString(),
    };
  } catch (err: any) {
    return {
      connected: false,
      database: process.env.DB_NAME || "buyer",
      error: err.message || "Error desconocido al conectar a SQL Server",
    };
  }
}

export { sql };
