import { executeQuery, sql } from '../src/lib/db';

async function main() {
  console.log('=== ACTUALIZANDO FAVORITO DECLARADO VIA LIB DB ===\n');

  // Actualizar formulario de Cristhian (id_persona = 18)
  await executeQuery(`
    UPDATE dbo.formulario_captacion 
    SET id_producto_favorito = 2 
    WHERE id_persona = 18;
  `);

  console.log('✅ Formulario actualizado a id_producto_favorito = 2 (Picaña a la Parrilla 350g)');

  // Consultar vista vw_preferencias_persona
  const res = await executeQuery(`
    SELECT id_persona, nombres, apellidos, segmento, id_producto_favorito, producto_favorito_declarado
    FROM dbo.vw_preferencias_persona
    WHERE id_persona = 18;
  `);

  console.log('\n--- VISTA ACTUALIZADA:');
  console.table(res);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
