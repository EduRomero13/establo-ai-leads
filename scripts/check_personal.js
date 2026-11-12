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

async function checkPersonal() {
  const pool = await sql.connect(config);
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'personal'
  `);
  console.log('personal columns:', cols.recordset);

  const data = await pool.request().query(`SELECT * FROM personal`);
  console.log('personal data:', data.recordset);

  pool.close();
}

checkPersonal().catch(console.error);

