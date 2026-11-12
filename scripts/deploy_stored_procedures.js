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

async function deploy() {
  const pool = await sql.connect(config);
  console.log('Conectado a SQL Server V3 (buyer)...');

  const sqlFile = path.resolve(process.cwd(), 'sql', 'sp_motor_reglas_establo.sql');
  const content = fs.readFileSync(sqlFile, 'utf8');

  // Dividir por bloques GO
  const batches = content
    .split(/^\s*GO\s*$/mi)
    .map(b => b.trim())
    .filter(b => b.length > 0 && !b.startsWith('USE '));

  console.log(`Ejecutando ${batches.length} procedimientos almacenados...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      await pool.request().query(batch);
      const match = batch.match(/CREATE\s+OR\s+ALTER\s+PROCEDURE\s+([a-zA-Z0-9_\.]+)/i);
      const procName = match ? match[1] : `Batch #${i+1}`;
      console.log(`  [OK] ${procName}`);
    } catch (err) {
      console.error(`  [ERROR en batch #${i+1}]:`, err.message);
      process.exit(1);
    }
  }

  // Verificar procedimientos creados
  const check = await pool.request().query(`
    SELECT ROUTINE_NAME, ROUTINE_TYPE
    FROM INFORMATION_SCHEMA.ROUTINES
    WHERE ROUTINE_TYPE = 'PROCEDURE'
    ORDER BY ROUTINE_NAME;
  `);

  console.log(`\n--- PROCEDIMIENTOS ALMACENADOS VERIFICADOS EN SQL SERVER (${check.recordset.length}) ---`);
  check.recordset.forEach(r => console.log(`  - ${r.ROUTINE_NAME}`));

  pool.close();
}

deploy().catch(console.error);

