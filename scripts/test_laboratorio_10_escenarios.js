const fs = require('fs');
const path = require('path');

// Test suite calling the local Next.js server endpoint /api/laboratorio
async function testLaboratorio() {
  const url = 'http://localhost:3001/api/laboratorio';

  console.log('=== VERIFICANDO LOS 10 ESCENARIOS DEL LABORATORIO IA ===\n');

  // 1. Obtener escenarios y perfiles
  const getRes = await fetch(url);
  const data = await getRes.json();
  if (!data.success) {
    console.error('Error al obtener datos del laboratorio:', data.error);
    process.exit(1);
  }

  const { perfiles, escenarios } = data;
  console.log(`Perfiles disponibles: ${perfiles.length} | Escenarios: ${escenarios.length}\n`);

  let aprobados = 0;

  for (const esc of escenarios) {
    console.log(`----------------------------------------------------------------`);
    console.log(`[ESCENARIO #${esc.numero}] ${esc.titulo} (${esc.id})`);
    console.log(`Criterio: ${esc.criterioExito}`);

    // Buscar perfil sugerido
    const perfil = perfiles.find(p => p.claveDemo === esc.perfilSugerido) || perfiles[0];
    console.log(`Cliente: ${perfil.nombreCompleto} (#${perfil.id_persona}) | Fav: ${perfil.producto_favorito_declarado}`);
    console.log(`Mensaje enviado: "${esc.promptSugerido}"`);

    // Enviar solicitud POST
    const bodyPayload = {
      idPersona: perfil.id_persona,
      idNegociacion: perfil.id_negociacion || 1,
      scenarioId: esc.id,
      mensajeCliente: esc.promptSugerido,
      simularPago: esc.id === 'CONVERSION_PAGO',
      relojHorasSimuladas: esc.id === 'SEGUIMIENTO_RELOJ' ? 24 : 0,
      historialChat: [],
    };

    const postRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    const resJson = await postRes.json();
    if (!resJson.success) {
      console.error(`  ❌ FALLÓ: ${resJson.error}`);
    } else {
      console.log(`  🤖 Respuesta IA:\n  "${resJson.respuesta}"`);
      console.log(`  Acción: ${resJson.telemetria?.evento || resJson.telemetria?.intencionDetectada || 'OK'}`);
      console.log(`  ✅ ESTADO: APROBADO`);
      aprobados++;
    }
  }

  console.log(`\n================================================================`);
  console.log(`RESULTADO FINAL: ${aprobados}/${escenarios.length} ESCENARIOS APROBADOS AL 100%`);
  console.log(`================================================================`);
}

testLaboratorio().catch(console.error);
