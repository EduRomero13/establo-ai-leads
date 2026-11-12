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
  options: { encrypt: false, trustServerCertificate: true }
};

async function check() {
  const pool = await sql.connect(config);
  
  // Perfiles en vw_preferencias_persona
  const res = await pool.request().query('SELECT * FROM dbo.vw_preferencias_persona');
  console.log('--- PREFERENCIAS PERSONAS ---');
  res.recordset.forEach(p => console.log(`#${p.id_persona} ${p.nombres} ${p.apellidos} (${p.segmento}) -> Fav: ${p.producto_favorito_declarado} | Top: ${p.nombre_mas_comprado}`));

  // Negociaciones
  const negs = await pool.request().query('SELECT id_negociacion, id_persona, nro_ciclo, estado FROM dbo.negociacion');
  console.log('\n--- NEGOCIACIONES ---');
  negs.recordset.forEach(n => console.log(`Neg #${n.id_negociacion} -> Persona #${n.id_persona}, Ciclo: ${n.nro_ciclo}, Estado: ${n.estado}`));

  pool.close();
}

check().catch(console.error);
