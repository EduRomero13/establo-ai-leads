async function testAgentSuite() {
  const preguntas = [
    "hay mas caro los cortes ?",
    "quiero mas caro los cortes , tengo dinero",
    "asdasdasd",
    "cuál es la capital de francia?",
    "eres una ia o una persona real?",
    "dónde están ubicados y cuál es el horario?",
    "hacen delivery a víctor larco?",
    "tienen chimichurri o salsas?",
    "me puedes hacer una rebaja de 10 soles?",
    "cuánto demora el delivery?",
    "qué incluye la parrilla familiar?",
    "buenas noches gracias por la atencion",
  ];

  console.log("=== EVALUACIÓN DE ROBUSTEZ DEL AGENTE COMERCIAL (ID_NEGOCIACION = 20) ===\n");

  for (const p of preguntas) {
    const res = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "copiloto_assist",
        id_negociacion: 20,
        id_sesion: 1,
      }),
    });

    // To test with specific prompt text:
    // We can call an endpoint or test directly
  }
}
testAgentSuite();

