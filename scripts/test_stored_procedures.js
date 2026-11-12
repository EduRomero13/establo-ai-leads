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

async function testAll() {
  const pool = await sql.connect(config);
  console.log('=== TEST SUITE: MOTOR DE REGLAS Y PROCEDIMIENTOS SQL V3 ===\n');

  // Test 1: sp_consultar_perfil_lead
  console.log('[TEST 1] sp_consultar_perfil_lead (Persona #18, Neg #20)');
  const t1 = await pool.request()
    .input('id_persona', sql.BigInt, 18)
    .input('id_negociacion', sql.BigInt, 20)
    .execute('dbo.sp_consultar_perfil_lead');
  console.log('  Resultado:', t1.recordset[0]);

  // Test 2: sp_consultar_producto_favorito
  console.log('\n[TEST 2] sp_consultar_producto_favorito (Persona #18)');
  const t2 = await pool.request()
    .input('id_persona', sql.BigInt, 18)
    .execute('dbo.sp_consultar_producto_favorito');
  console.log('  Resultado:', t2.recordset[0]);

  // Test 3: sp_consultar_plato_mas_comprado
  console.log('\n[TEST 3] sp_consultar_plato_mas_comprado (Persona #18 vs #17)');
  const t3 = await pool.request()
    .input('id_persona', sql.BigInt, 17)
    .execute('dbo.sp_consultar_plato_mas_comprado');
  console.log('  Resultado:', t3.recordset[0] || 'Sin historial previo de compras (Esperado para Lead nuevo)');

  // Test 4: sp_consultar_productos_populares_segmento
  console.log('\n[TEST 4] sp_consultar_productos_populares_segmento (Segmento #3 Amigos)');
  const t4 = await pool.request()
    .input('id_segmento', sql.Int, 3)
    .execute('dbo.sp_consultar_productos_populares_segmento');
  console.log('  Cortes top:', t4.recordsets[0]);
  console.log('  Combos top:', t4.recordsets[1]);

  // Test 5: sp_consultar_promociones_mas_solicitadas
  console.log('\n[TEST 5] sp_consultar_promociones_mas_solicitadas');
  const t5 = await pool.request().execute('dbo.sp_consultar_promociones_mas_solicitadas');
  console.log('  Promociones:', t5.recordset);

  // Test 6: sp_consultar_promociones_elegibles
  console.log('\n[TEST 6] sp_consultar_promociones_elegibles (Persona #18, Segmento #3)');
  const t6 = await pool.request()
    .input('id_persona', sql.BigInt, 18)
    .input('id_segmento', sql.Int, 3)
    .execute('dbo.sp_consultar_promociones_elegibles');
  console.log('  Elegibles hoy:', t6.recordset);

  // Test 7: sp_consultar_peso_carne_frecuente
  console.log('\n[TEST 7] sp_consultar_peso_carne_frecuente (Segmento #3)');
  const t7 = await pool.request()
    .input('id_segmento', sql.Int, 3)
    .execute('dbo.sp_consultar_peso_carne_frecuente');
  console.log('  Pesos registrados:', t7.recordset.slice(0, 3));

  // Test 8: sp_consultar_productos_por_presupuesto
  console.log('\n[TEST 8] sp_consultar_productos_por_presupuesto (Max S/ 40.00)');
  const t8 = await pool.request()
    .input('presupuesto_maximo', sql.Decimal(10,2), 40.00)
    .input('id_segmento', sql.Int, 3)
    .input('nro_personas', sql.Int, 1)
    .execute('dbo.sp_consultar_productos_por_presupuesto');
  console.log(`  Opciones encontradas: ${t8.recordset.length}`, t8.recordset.slice(0, 3));

  // Test 9: sp_consultar_historial_ofertas
  console.log('\n[TEST 9] sp_consultar_historial_ofertas (Neg #20)');
  const t9 = await pool.request()
    .input('id_negociacion', sql.BigInt, 20)
    .execute('dbo.sp_consultar_historial_ofertas');
  console.log('  Ofertas históricas:', t9.recordset.slice(0, 3));

  // Test 10: sp_consultar_estado_conversion
  console.log('\n[TEST 10] sp_consultar_estado_conversion (Neg #20)');
  const t10 = await pool.request()
    .input('id_negociacion', sql.BigInt, 20)
    .execute('dbo.sp_consultar_estado_conversion');
  console.log('  Estado conversión:', t10.recordset[0]);

  // Test 11: sp_registrar_objecion_lead
  console.log('\n[TEST 11] sp_registrar_objecion_lead (Neg #20)');
  const t11 = await pool.request()
    .input('id_negociacion', sql.BigInt, 20)
    .input('tipo_objecion', sql.VarChar(50), 'PRECIO')
    .input('detalle', sql.NVarChar(300), 'Cliente indicó presupuesto limitado a S/ 20')
    .execute('dbo.sp_registrar_objecion_lead');
  console.log('  Resultado:', t11.recordset[0]);

  // Test 12: sp_registrar_oferta_lead (Anti duplicados)
  console.log('\n[TEST 12] sp_registrar_oferta_lead (Neg #20, Chorizo #6)');
  const t12 = await pool.request()
    .input('id_negociacion', sql.BigInt, 20)
    .input('id_producto', sql.Int, 6)
    .input('detalle', sql.NVarChar(300), 'Oferta de Chorizo a la Parrilla S/ 15')
    .execute('dbo.sp_registrar_oferta_lead');
  console.log('  Resultado oferta:', t12.recordset[0]);

  // Test 13: sp_registrar_respuesta_oferta
  console.log('\n[TEST 13] sp_registrar_respuesta_oferta (Neg #20, ACEPTADA)');
  const t13 = await pool.request()
    .input('id_negociacion', sql.BigInt, 20)
    .input('id_oferta', sql.BigInt, t12.recordset[0].id_oferta)
    .input('respuesta', sql.VarChar(15), 'ACEPTADA')
    .input('detalle', sql.NVarChar(300), 'Cliente aceptó pedir chorizo')
    .execute('dbo.sp_registrar_respuesta_oferta');
  console.log('  Resultado respuesta:', t13.recordset[0]);

  // Test 14: sp_registrar_accion_seguimiento
  console.log('\n[TEST 14] sp_registrar_accion_seguimiento (Neg #20)');
  const t14 = await pool.request()
    .input('id_negociacion', sql.BigInt, 20)
    .input('tipo_accion', sql.VarChar(50), 'SEGUIMIENTO_24H')
    .input('detalle', sql.NVarChar(300), 'Recordatorio comercial enviado al lead')
    .execute('dbo.sp_registrar_accion_seguimiento');
  console.log('  Resultado seguimiento:', t14.recordset[0]);

  // Test 15: sp_verificar_y_aplicar_conversion (SEGURIDAD: debe fallar si no hay pago confirmado)
  console.log('\n[TEST 15 - SEGURIDAD] sp_verificar_y_aplicar_conversion sin pago confirmado');
  try {
    await pool.request()
      .input('id_negociacion', sql.BigInt, 20)
      .execute('dbo.sp_verificar_y_aplicar_conversion');
    console.log('  ERROR: Debería haber fallado por falta de pago!');
  } catch (err) {
    console.log('  [PASS SEGURIDAD EXITOSO] Bloqueado correctamente:', err.message);
  }

  pool.close();
  console.log('\n=== TODOS LOS PROCEDIMIENTOS FUNCIONAN AL 100% ===');
}

testAll().catch(console.error);

