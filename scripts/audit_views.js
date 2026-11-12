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

async function auditViewsAndCatalog() {
  const pool = await sql.connect(config);

  // Check columns of producto_carta and promocion
  const pcCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'producto_carta'
  `);
  console.log('--- PRODUCTO_CARTA COLUMNS ---');
  pcCols.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`));

  const promoCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'promocion'
  `);
  console.log('--- PROMOCION COLUMNS ---');
  promoCols.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`));

  // Check some records from producto_carta to see how products are named (do they have grams in the name?)
  const products = await pool.request().query(`
    SELECT TOP 10 id_producto, nombre, categoria, precio, descripcion, activo
    FROM producto_carta
  `);
  console.log('\n--- SAMPLE PRODUCTOS_CARTA ---');
  products.recordset.forEach(p => console.log(`  #${p.id_producto}: ${p.nombre} (${p.categoria}) - S/ ${p.precio} | Desc: ${p.descripcion}`));

  // Check definitions of views
  const viewDefs = await pool.request().query(`
    SELECT TABLE_NAME, VIEW_DEFINITION
    FROM INFORMATION_SCHEMA.VIEWS
  `);
  console.log('\n--- VIEW DEFINITIONS ---');
  viewDefs.recordset.forEach(v => {
    console.log(`\n*** VIEW: ${v.TABLE_NAME} ***`);
    console.log(v.VIEW_DEFINITION);
  });

  // Check persona columns
  const pCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'persona'
  `);
  console.log('\n--- PERSONA COLUMNS ---');
  pCols.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`));

  // Check current user permissions
  const perms = await pool.request().query(`
    SELECT CURRENT_USER AS currentUser, SYSTEM_USER AS systemUser, USER_NAME() AS dbUser;
  `);
  console.log('\n--- CURRENT DB USER ---');
  console.log(perms.recordset[0]);

  // Check roles of current user
  const roles = await pool.request().query(`
    SELECT r.name AS RoleName
    FROM sys.database_role_members rm
    JOIN sys.database_principals r ON rm.role_principal_id = r.principal_id
    JOIN sys.database_principals m ON rm.member_principal_id = m.principal_id
    WHERE m.name = USER_NAME();
  `);
  console.log('\n--- CURRENT DB USER ROLES ---');
  roles.recordset.forEach(r => console.log(`  Role: ${r.RoleName}`));

  pool.close();
}

auditViewsAndCatalog().catch(e => { console.error(e); process.exit(1); });

