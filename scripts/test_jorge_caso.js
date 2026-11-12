const fs = require('fs');

async function testJorge() {
  const url = 'http://localhost:3001/api/laboratorio';

  console.log('=== TEST ESPECÍFICO JORGE MENDOZA ===\n');

  // Mensaje 1
  const m1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idPersona: 8, // Jorge
      idNegociacion: 10,
      scenarioId: 'REC_PERSONALIZADA',
      mensajeCliente: 'Hola, ¿qué me recomiendas para comer hoy?',
      historialChat: [],
    }),
  });
  const r1 = await m1.json();
  console.log('Cliente: "Hola, ¿qué me recomiendas para comer hoy?"');
  console.log('IA:', r1.respuesta);

  // Mensaje 2
  const m2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idPersona: 8,
      idNegociacion: 10,
      scenarioId: 'REC_PERSONALIZADA',
      mensajeCliente: 'Combo Amigos',
      historialChat: [
        { remitente: 'lead', texto: 'Hola, ¿qué me recomiendas para comer hoy?' },
        { remitente: 'agente', texto: r1.respuesta },
      ],
    }),
  });
  const r2 = await m2.json();
  console.log('\nCliente: "Combo Amigos"');
  console.log('IA:', r2.respuesta);
}

testJorge();

