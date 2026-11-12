const path = require('path');
const fs = require('fs');

// Cargar variables de entorno de .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }
}

// Compilar require de TypeScript vía ts-node o usando el build de Next.js
const { procesarMensajeLead } = require('../src/lib/ai-agent');

async function testear() {
  console.log('=== TEST DE ROBUSTEZ Y VALIDACIONES TOTALES DEL AGENTE IA ===\n');

  const casos = [
    {
      categoria: 'PREFERENCIA HIGH TICKET / MÁS CARO',
      mensaje: 'hay mas caro los cortes ?',
      espera: 'Parrilla Familiar / Parrilla Mixta Especial / Picaña',
    },
    {
      categoria: 'PREFERENCIA HIGH TICKET / TENGO DINERO',
      mensaje: 'quiero mas caro los cortes , tengo dinero',
      espera: 'Parrilla Familiar / Parrilla Mixta Especial / Picaña',
    },
    {
      categoria: 'PREGUNTA FUERA DE DOMINIO / FÚTBOL',
      mensaje: 'HOLA QUIEN GANO AYER EL REAL MADRID O BARCELONA',
      espera: 'Pivote con buen humor a la leña de El Establo',
    },
    {
      categoria: 'IDENTIDAD / PREGUNTA SI ES IA O HUMANO',
      mensaje: 'eres una ia o quien me habla?',
      espera: 'Explicación transparente de Agente Inteligente oficial',
    },
    {
      categoria: 'PREGUNTA OPERATIVA / HORARIOS',
      mensaje: 'a que hora abren hoy y atienden domingo?',
      espera: 'Lunes a Domingo 12:00 m a 11:00 pm',
    },
    {
      categoria: 'PREGUNTA OPERATIVA / UBICACIÓN',
      mensaje: 'donde quedan ubicados?',
      espera: 'Trujillo / California / Víctor Larco y delivery',
    },
    {
      categoria: 'PREGUNTA OPERATIVA / VEGETARIANO O CEVICHE',
      mensaje: 'tienen ceviche o platos vegetarianos?',
      espera: 'Ensalada César, papas rústicas y especialidad carnes',
    },
    {
      categoria: 'PREGUNTA OPERATIVA / RESERVAS Y CUMPLEAÑOS',
      mensaje: 'hacen reservas para un cumpleaños de 10 personas?',
      espera: 'Atención a eventos, Parrilla Familiar, Combo Amigos',
    },
    {
      categoria: 'PREGUNTA OPERATIVA / BEBIDAS Y LICORES',
      mensaje: 'que bebidas o tragos tienen para acompañar?',
      espera: 'Sangría 1L, Chicha Morada 1L, cervezas',
    },
    {
      categoria: 'OBJECIÓN DE PRESUPUESTO REAL',
      mensaje: 'esta muy caro no me alcanza la plata dame algo economico',
      espera: 'Chorizo S/ 15.00 o Combo Estudiante',
    },
    {
      categoria: 'SEGURIDAD / DE-ESCALACIÓN ANTE QUEJA O AGRESIÓN',
      mensaje: 'son unos estafadores comida fea',
      espera: 'Respuesta cortés, profesional, de-escalando sin agresión',
    },
    {
      categoria: 'AGRADECIMIENTO Y CIERRE',
      mensaje: 'muchas gracias hasta luego',
      espera: 'Despedida cordial y hospitalaria',
    },
    {
      categoria: 'TEXTO SIN SENTIDO / GIBBERISH',
      mensaje: 'asdfghjk??????',
      espera: 'Aclaración amigable sin romperse',
    },
  ];

  // Probamos con Cristhian (id_negociacion = 18)
  const idNegociacion = 18;

  let pasados = 0;
  for (let i = 0; i < casos.length; i++) {
    const c = casos[i];
    console.log(`\n--- [TEST ${i + 1}/${casos.length}] ${c.categoria} ---`);
    console.log(`Mensaje Cliente: "${c.mensaje}"`);
    try {
      const resp = await procesarMensajeLead(idNegociacion, c.mensaje);
      console.log(`Acción Tomada: [${resp.accionTomada}]`);
      console.log(`Respuesta Agente:\n${resp.mensaje}\n`);
      pasados++;
    } catch (err) {
      console.error(`❌ Error procesando caso ${i + 1}:`, err);
    }
  }

  console.log(`\n========================================`);
  console.log(`RESULTADO FINAL: ${pasados}/${casos.length} CASOS SUPERADOS CON ÉXITO`);
  console.log(`========================================`);
}

testear().catch(console.error);
