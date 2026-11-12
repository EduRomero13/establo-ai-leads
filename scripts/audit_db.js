const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Leer .env.local manualmente si dotenv no está instalado
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

async function audit() {
  const pool = await sql.connect(config);
  console.log('Connected to SQL Server successfully.');

  // 1. Tables & Views
  const tables = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE 
    FROM INFORMATION_SCHEMA.TABLES 
    ORDER BY TABLE_TYPE, TABLE_NAME
  `);
  console.log('\n--- TABLAS & VISTAS (' + tables.recordset.length + ') ---');
  tables.recordset.forEach(r => console.log(`${r.TABLE_TYPE}: ${r.TABLE_SCHEMA}.${r.TABLE_NAME}`));

  // 2. Routines (Stored Procedures & Functions)
  const sps = await pool.request().query(`
    SELECT ROUTINE_SCHEMA, ROUTINE_NAME, ROUTINE_TYPE
    FROM INFORMATION_SCHEMA.ROUTINES
    ORDER BY ROUTINE_TYPE, ROUTINE_NAME
  `);
  console.log('\n--- PROCEDIMIENTOS & FUNCIONES (' + sps.recordset.length + ') ---');
  sps.recordset.forEach(r => console.log(`${r.ROUTINE_TYPE}: ${r.ROUTINE_SCHEMA}.${r.ROUTINE_NAME}`));

  // 3. Columns of key tables
  const targetTables = [
    'persona', 'formulario_captacion', 'segmento_cliente', 'negociacion',
    'producto_carta', 'combo', 'combo_detalle', 'pedido', 'pedido_detalle',
    'promocion', 'promocion_aplicable', 'oferta_negociacion', 'pago',
    'sesion_whatsapp', 'mensaje_whatsapp', 'accion_agente', 'historial_fases'
  ];

  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('${targetTables.join("','")}')
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

  console.log('\n--- COLUMNAS DE TABLAS CLAVE ---');
  let currentTable = '';
  cols.recordset.forEach(c => {
    if (c.TABLE_NAME !== currentTable) {
      currentTable = c.TABLE_NAME;
      console.log(`\n[${currentTable}]`);
    }
    console.log(`  - ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? '(' + c.CHARACTER_MAXIMUM_LENGTH + ')' : ''}, ${c.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
  });

  // 4. Check if grammage / weight exists in any column
  const weightCols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE COLUMN_NAME LIKE '%peso%' 
       OR COLUMN_NAME LIKE '%gram%' 
       OR COLUMN_NAME LIKE '%porcion%' 
       OR COLUMN_NAME LIKE '%unidad%'
  `);
  console.log('\n--- COLUMNAS RELACIONADAS CON PESO / GRAMAJE ---');
  if (weightCols.recordset.length === 0) {
    console.log('NINGUNA COLUMNA CONTIENE peso, gram, porcion.');
  } else {
    weightCols.recordset.forEach(w => console.log(`  ${w.TABLE_NAME}.${w.COLUMN_NAME} (${w.DATA_TYPE})`));
  }

  // 5. Existing foreign keys
  const fks = await pool.request().query(`
    SELECT 
      fk.name AS FK_Name,
      tp.name AS ParentTable,
      cp.name AS ParentColumn,
      tr.name AS ReferencedTable,
      cr.name AS ReferencedColumn
    FROM sys.foreign_keys fk
    INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
    INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
    INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
    INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
    ORDER BY tp.name, fk.name
  `);
  console.log('\n--- CLAVES FORÁNEAS (' + fks.recordset.length + ') ---');
  fks.recordset.forEach(fk => console.log(`  ${fk.ParentTable}.${fk.ParentColumn} -> ${fk.ReferencedTable}.${fk.ReferencedColumn} (${fk.FK_Name})`));

  pool.close();
}

audit().catch(e => { console.error('Audit failed:', e); process.exit(1); });

