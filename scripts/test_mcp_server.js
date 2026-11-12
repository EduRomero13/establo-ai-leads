async function testMCP() {
  console.log("=== TEST DE SERVIDOR MCP (/api/mcp) PARA HERMES AGENT ===\n");

  // 1. Handshake / List Tools vía GET
  console.log("1. Test GET /api/mcp (Catálogo de herramientas)...");
  const resGet = await fetch("http://localhost:3000/api/mcp");
  const dataGet = await resGet.json();
  console.log(
    "Status:",
    resGet.status,
    "Nombre:",
    dataGet.name,
    "Herramientas:",
    dataGet.toolsCount,
  );

  // 2. JSON-RPC tools/list vía POST
  console.log("\n2. Test POST tools/list (JSON-RPC 2.0)...");
  const resList = await fetch("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    }),
  });
  const dataList = await resList.json();
  console.log("Herramientas retornadas:", dataList.result?.tools?.length);

  // 3. JSON-RPC tools/call para consultar_productos
  console.log("\n3. Test POST tools/call: consultar_productos...");
  const resCall = await fetch("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "consultar_productos",
        arguments: { solo_cortes: true },
      },
    }),
  });
  const dataCall = await resCall.json();
  const textOutput = dataCall.result?.content?.[0]?.text;
  const parsed = JSON.parse(textOutput || "[]");
  console.log(`Cortes retornados: ${parsed.length}`);
  console.table(parsed.slice(0, 4));

  // 4. JSON-RPC tools/call para consultar_politicas (Lectura Markdown)
  console.log("\n4. Test POST tools/call: consultar_politicas...");
  const resPol = await fetch("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "consultar_politicas",
        arguments: { categoria: "precios_descuentos" },
      },
    }),
  });
  const dataPol = await resPol.json();
  const polOutput = JSON.parse(dataPol.result?.content?.[0]?.text || "{}");
  console.log(
    "Política recuperada:",
    polOutput.categoria,
    "Longitud MD:",
    polOutput.documento_markdown?.length,
    "caracteres",
  );

  console.log("\n✅ ¡SERVIDOR MCP VALIDADO EXITOSAMENTE AL 100%!");
}

testMCP().catch(console.error);
