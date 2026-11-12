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

async function auditConstraints() {
  const pool = await sql.connect(config);

  // Check constraints
  const checks = await pool.request().query(`
    SELECT 
      cc.name AS ConstraintName,
      t.name AS TableName,
      cc.definition AS CheckDefinition
    FROM sys.check_constraints cc
    JOIN sys.tables t ON cc.parent_object_id = t.object_id
    ORDER BY t.name, cc.name
  `);
  console.log('--- CHECK CONSTRAINTS (' + checks.recordset.length + ') ---');
  checks.recordset.forEach(c => console.log(`[${c.TableName}] ${c.ConstraintName}: ${c.CheckDefinition}`));

  // Weights in producto_carta
  const weights = await pool.request().query(`
    SELECT id_producto, nombre, categoria, es_corte, peso_cantidad, peso_unidad, precio
    FROM producto_carta
    WHERE peso_cantidad IS NOT NULL
  `);
  console.log('\n--- PRODUCTOS CON PESO/GRAMAJE REGISTRADO (' + weights.recordset.length + ') ---');
  weights.recordset.forEach(w => console.log(`  #${w.id_producto}: ${w.nombre} | ${w.peso_cantidad} ${w.peso_unidad} | S/ ${w.precio} | es_corte: ${w.es_corte}`));

  // Promociones data
  const promos = await pool.request().query(`
    SELECT id_promocion, nombre_promocion, tipo_beneficio, valor_beneficio, dias_aplicables, id_segmento_objetivo, activa
    FROM promocion
  `);
  console.log('\n--- PROMOCIONES (' + promos.recordset.length + ') ---');
  promos.recordset.forEach(pr => console.log(`  #${pr.id_promocion}: ${pr.nombre_promocion} | Tipo: ${pr.tipo_beneficio} ${pr.valor_beneficio} | Días: ${pr.dias_aplicables} | Segmento: ${pr.id_segmento_objetivo} | Activa: ${pr.activa}`));

  // Check personal table for agent personal ID
  const personal = await pool.request().query(`
    SELECT id_personal, nombres, apellidos, rol, activo
    FROM personal
  `);
  console.log('\n--- PERSONAL DE ATENCIÓN/SISTEMA ---');
  personal.recordset.forEach(p => console.log(`  #${p.id_personal}: ${p.nombres} ${p.apellidos} (${p.rol}) | Activo: ${p.activo}`));

  pool.close();
}

auditConstraints().catch(e => { console.error('Constraint audit failed:', e); process.exit(1); });

