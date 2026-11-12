const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envVars = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      envVars[key] = val;
    }
  }
}

const config = {
  server: envVars.DB_SERVER || '127.0.0.1',
  port: parseInt(envVars.DB_PORT || '1434', 10),
  database: envVars.DB_NAME || 'buyer',
  user: envVars.DB_USER || 'establo_app',
  password: envVars.DB_PASSWORD || 'EstabloLeads2026!',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};

async function inspectLeads() {
  const pool = await sql.connect(config);

  const leads = await pool.request().query(`
    SELECT TOP 5 
      p.id_persona, p.nombres, p.apellidos, p.telefono, p.fase_actual, p.id_segmento,
      s.nombre AS segmento,
      n.id_negociacion, n.nro_ciclo, n.estado AS estado_neg, n.fecha_inicio
    FROM persona p
    LEFT JOIN segmento_cliente s ON s.id_segmento = p.id_segmento
    LEFT JOIN negociacion n ON n.id_persona = p.id_persona AND n.estado = 'ABIERTA'
    ORDER BY p.id_persona DESC
  `);
  console.log('--- LEADS TOP 5 ---');
  console.log(leads.recordset);

  // Check oferta_negociacion records
  const ofertas = await pool.request().query(`
    SELECT TOP 5 * FROM oferta_negociacion ORDER BY fecha_oferta DESC
  `);
  console.log('--- OFERTAS TOP 5 ---');
  console.log(ofertas.recordset);

  // Check accion_agente records
  const acciones = await pool.request().query(`
    SELECT TOP 5 * FROM accion_agente ORDER BY fecha_ejecucion DESC
  `);
  console.log('--- ACCIONES AGENTE TOP 5 ---');
  console.log(acciones.recordset);

  pool.close();
}

inspectLeads().catch(console.error);

