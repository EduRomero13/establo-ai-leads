# Verificación de Hermes y WhatsApp en Dokploy

Guía operativa para el despliegue de **ESTABLO AI** en Dokploy.
Todo se ejecuta desde la **Terminal** de cada servicio en Dokploy
(no hay `bash` ni `curl` en los contenedores; usamos `node -e` y `sh`).

---

## 0. Antes de empezar: desplegar el código corregido

Los cambios hechos en el repositorio deben llegar a Dokploy:

```sh
git add -A
git commit -m "fix: integración Whapi/Hermes, health de integraciones y usuario establo_app"
git push
```

En Dokploy → aplicación `eduardo-agente-yuldzi` → **Deploy** (o **Redeploy**)
para reconstruir la imagen `app`.

> Si Dokploy construye desde el repositorio, sin push no verás los cambios.

---

## 0.1 Síntoma típico: `EAI_AGAIN` y `404 page not found` de Traefik

Si desde la terminal de `app` ves esto:

```sh
node -e 'require("dns").lookup("NOMBRE_HERMES",(e,a)=>console.log(e?e.code:a))'
# EAI_AGAIN

node -e 'fetch("http://TU_DOMINIO/api/webhook/whapi").then(async r=>console.log(r.status,await r.text()))'
# 404 404 page not found
```

los dos síntomas tienen **una sola causa**: el contenedor `app` (y/o Hermes) **no está en la
red `dokploy-network`**. Esa red es la que comparten **Traefik** (enrutado de dominios) y
los demás servicios; sin ella:

- Traefik no encuentra un *router* para el dominio → responde su propio
  `404 page not found` (texto plano, **no** es el 404 de Next.js).
- El DNS interno de Docker no resuelve el nombre del otro contenedor → `EAI_AGAIN`
  (fallo temporal de resolución; `ENOTFOUND` es "no existe", `EAI_AGAIN` es "no puedo
  resolverlo desde mis redes").

> `404 page not found` con esa redacción exacta = **Traefik**, nunca Next.js.
> Si viera la página HTML "This page could not be found", entonces sí sería la app.

### Comprobación en el host de Dokploy (ahí sí hay `docker`)

```sh
docker ps --format '{{.Names}}' | grep -Ei 'agente|hermes|traefik'

# ¿Cada contenedor está en dokploy-network?
for c in $(docker ps --format '{{.Names}}' | grep -Ei 'agente|hermes|traefik'); do
  echo -n "$c -> "
  docker inspect "$c" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
done
```

Cada contenedor debe listar `dokploy-network`. Si `app` o el contenedor de Hermes **no**
lo muestran, ese es el problema.

### El nombre DNS NO es el del proyecto, es el del *servicio*

Error muy común. Aunque ambos contenedores estén en `dokploy-network`, el nombre que
resuelve el DNS de Docker es el **alias**, y los alias son:

```
dokploy-network [eduardo-hermes-r0f6ph-hermes-1 hermes]
                  ^ nombre del contenedor      ^ nombre del SERVICIO
```

- ✅ Resuelve: `hermes` (el nombre del servicio en el compose).
- ❌ **No** resuelve: `eduardo-hermes-r0f6ph` (eso es el *proyecto* de Dokploy, no un alias).

Por eso `dns.lookup("eduardo-hermes-r0f6ph")` da `EAI_AGAIN` aunque la red esté bien.
Usa el nombre del servicio:

```env
HERMES_API_URL=http://hermes:8642/v1
```

Compruébalo desde `app`:

```sh
node -e 'require("dns").lookup("hermes",(e,a)=>console.log("dns:",e?e.code:a))'
```

> Ojo con la clave al probar a mano: `"Bearer "+process.env.API_SERVER_KEY` usa la
> variable **de Hermes**. En el contenedor `app` la variable se llama `HERMES_API_KEY`,
> y si no existe verás `Bearer undefined` → `401`. Usa la clave literal o
> `process.env.HERMES_API_KEY`.

### Corrección

Ambos `docker-compose.yml` (el de la app y el de Hermes) deben declarar la red externa:

```yaml
services:
  app:            # (o hermes)
    networks: [dokploy-network]

networks:
  dokploy-network:
    external: true
```

El de la app ya viene así en el repositorio; el de Hermes hay que agregarlo igual.

1. Guarda el compose de Hermes y **redeploya** (o usa su webhook de deploy):
   ```sh
   # desde cualquier terminal con acceso a internet
   curl -X POST "https://dokploy.giansmd.dev/api/deploy/compose/8UbrcQ5KFtWqxBlwLtp_"
   ```
2. Redeploya también `app` para regenerar las etiquetas de Traefik.
3. Repite las dos pruebas del inicio: el DNS debe resolver una IP y el dominio debe
   devolver `200`.

### Y no olvides el HTTPS del dominio

En Dokploy → `app` → **Domains** la fila del dominio debe quedar:

| Campo | Valor |
|---|---|
| Host | `eduardo-agente-yuldzi-063818-169-58-140-8.sslip.io` |
| Path | `/` |
| Service | `app` |
| Port | `3000` |
| HTTPS | **activado** |
| Certificate Provider | **Let's Encrypt** |

Si dejas `HTTP` + `Cert: none`, Whapi no podrá llamar al webhook (rechaza certificados
autofirmados y el `https://` dará 404 de Traefik porque no hay router TLS).
Tras activarlo, **redeploya** y comprueba:

```sh
node -e 'fetch("https://TU_DOMINIO/api/webhook/whapi").then(async r=>console.log(r.status,await r.text()))'
```

---

## 1. Semáforo rápido (nuevo endpoint)

Desde la terminal del servicio `app`:

```sh
node -e 'fetch("http://localhost:3000/api/health/integrations").then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))'
```

Devuelve:

```json
{
  "ok": false,
  "resumen": { "database": "OK", "whapi": "OK", "hermes": "FALLA" },
  "database": { "ok": true, "base": "buyer", "tablas": 34 },
  "whapi":    { "configurado": true, "ok": true, "estado": { "status": { "code": 4, "text": "AUTH" } } },
  "hermes":   { "configurado": false, "error": "HERMES_API_URL y/o HERMES_API_KEY no configurados" },
  "trazas":   { "eventos": [], "mensajes": [] }
}
```

- `database: OK` → SQL Server responde.
- `whapi: OK` → canal de Whapi autenticado.
- `hermes: FALLA` → falta configurar Hermes (paso 3).

Para una prueba **real** de generación de Hermes (consume tokens):

```sh
node -e 'fetch("http://localhost:3000/api/health/integrations?deep=1").then(r=>r.json()).then(d=>console.log(JSON.stringify(d.hermes,null,2)))'
```

Debe responder `ok: true` y `deep.respuesta: "OK"`.

---

## 2. WhatsApp / Whapi

### 2.1 Verificar el dominio público

Desde la terminal de `app` (sin `curl`):

```sh
node -e 'fetch("https://TU_DOMINIO/api/webhook/whapi").then(async r=>console.log(r.status, await r.text()))'
```

Debe devolver `200` y un JSON con `"status":"ready"`.

> Usa **un solo slash**: `https://TU_DOMINIO/api/webhook/whapi`.
> El doble slash que probaste (`//api/...`) puede fallar en el enrutador.

Si devuelve `404`/`502`, el dominio de Dokploy no apunta al servicio `app`, puerto `3000`.

### 2.2 Registrar el webhook en Whapi

En el panel de Whapi → **Settings → Webhooks**:

- **URL**: `https://TU_DOMINIO/api/webhook/whapi?token=TU_WHAPI_WEBHOOK_TOKEN`
- **Método**: `POST`
- **Evento**: `messages`
- Opcional: `statuses` (hoy no se procesan en la ruta de Whapi, no aporta)

El `token` es exactamente el valor de `WHAPI_WEBHOOK_TOKEN` en Dokploy.
Sin token la ruta responde `401` (fail-closed en producción).

Si prefieres hacerlo por API (ojo: `PATCH /settings` resetea lo que omitas):

```sh
node -e 'fetch("https://gate.whapi.cloud/settings",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.WHAPI_TOKEN},body:JSON.stringify({webhooks:[{url:"https://TU_DOMINIO/api/webhook/whapi?token="+process.env.WHAPI_WEBHOOK_TOKEN,mode:"body",events:[{type:"messages",method:"post"}]}]})}).then(async r=>console.log(r.status,await r.text()))'
```

### 2.3 Probar que Whapi alcanza tu webhook

```sh
node -e 'fetch("https://gate.whapi.cloud/settings/webhook_test",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.WHAPI_TOKEN},body:JSON.stringify({url:"https://TU_DOMINIO/api/webhook/whapi?token="+process.env.WHAPI_WEBHOOK_TOKEN,type:"messages",mode:"body"})}).then(async r=>console.log(r.status,await r.text()))'
```

En los logs de `app` debe aparecer `[Webhook Whapi] Evento recibido: ...`.

### 2.4 Prueba real de ida y vuelta

1. Escribe desde un celular **no registrado** en `dbo.persona`.
2. Debe llegar el enlace de captación (`CAPTACION_URL`).
3. Escribe desde un celular que sí sea lead con negociación `ABIERTA`.
4. Debe responder el agente.

Revisar la trazabilidad en el servicio `database`.
**Importante**: `SQLCMD` vive en la sesión de shell; si abres otra terminal se pierde.
Ejecuta todo en una sola línea:

```sh
SQLCMD=$(ls /opt/mssql-tools*/bin/sqlcmd | tail -1); "$SQLCMD" -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d buyer -W -s "|" -Q "SELECT TOP 5 id_evento, proveedor, tipo, estado, recibido_en, procesado_en, error_resumen FROM dbo.evento_integracion ORDER BY id_evento DESC; SELECT TOP 8 id_mensaje, id_sesion, direccion, tipo, LEFT(contenido,60) AS contenido, estado_entrega, fecha_mensaje FROM dbo.mensaje_whatsapp ORDER BY id_mensaje DESC;"
```

Criterios:

| Resultado | Significado |
|---|---|
| `evento_integracion.estado = PROCESADO` y `procesado_en` con fecha | El webhook entró y terminó |
| `estado = RECIBIDO` y `procesado_en` nulo tras 1–2 min | Procesamiento asíncrono colgado: revisar logs de `app` |
| `estado = ERROR` + `error_resumen` | Ahí está la causa exacta |
| Fila `ENTRANTE` y al menos una `SALIENTE` | Ida y vuelta completa |
| Sin filas tras un mensaje real | El webhook no está llegando: revisar URL/token/dominio en Whapi |

---

## 3. Hermes

Hermes Agent (NousResearch) expone una **API OpenAI-compatible**:

- Puerto por defecto: **8642** (no 8080).
- Endpoints: `GET /v1/models`, `POST /v1/chat/completions`.
- Requiere `API_SERVER_KEY`.

### 3.1 Configurar el servicio Hermes

En las variables de entorno de Hermes (o su `.env`):

```env
API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
API_SERVER_KEY=una-clave-larga-y-aleatoria
# Opcional: nombre que verás en /v1/models
API_SERVER_MODEL_NAME=hermes-agent
```

Reinicia/redeploya Hermes y confirma que el **gateway** está corriendo
(`hermes gateway`). Si solo está la CLI, el puerto 8642 no existirá.

Dentro del contenedor de Hermes:

```sh
node -e 'fetch("http://localhost:8642/v1/models",{headers:{Authorization:"Bearer "+process.env.API_SERVER_KEY}}).then(async r=>console.log(r.status,await r.text()))'
```

Debe devolver `200` con la lista de modelos (por defecto `hermes-agent`).

### 3.2 Conectar la app con Hermes

En Dokploy → `app` → Environment:

```env
HERMES_API_URL=http://NOMBRE_INTERNO_HERMES:8642/v1
HERMES_API_KEY=una-clave-larga-y-aleatoria
HERMES_MODEL=hermes-agent
HERMES_TIMEOUT_MS=60000
```

Dos opciones para la URL:

- **Red interna (recomendado)**: Hermes debe estar en la red `dokploy-network`
  y compartir proyecto/servicio. Usa `http://<servicio>:8642/v1`.
  Verifica el nombre real en Dokploy → Hermes → pestaña Docker/General
  (o en el host: `docker ps --format "{{.Names}}" | grep -i hermes`).
- **Dominio público**: `https://<dominio-de-hermes>/v1`. Funciona aunque no
  compartan red; queda protegido por `API_SERVER_KEY`.

Comprobar DNS desde `app`:

```sh
node -e 'const u=new URL(process.env.HERMES_API_URL);require("dns").lookup(u.hostname,(e,a)=>console.log(u.hostname,"->",e?e.code:a))'
```

Redeploya `app` y verifica:

```sh
node -e 'fetch("http://localhost:3000/api/health/integrations?deep=1").then(r=>r.json()).then(d=>console.log(JSON.stringify(d.hermes,null,2)))'
```

Interpretación:

| Respuesta | Causa / acción |
|---|---|
| `200` + `deep.respuesta: "OK"` | Hermes funcionando |
| `401` | `HERMES_API_KEY` ≠ `API_SERVER_KEY` |
| `404` en `/models` | Servidor alcanzable, pero sin `/models`; prueba `?deep=1` |
| `400 model not found` | Ajusta `HERMES_MODEL` al valor de `/v1/models` |
| `ECONNREFUSED` / timeout | `API_SERVER_HOST` no es `0.0.0.0`, puerto incorrecto o sin red común |

Prueba definitiva por base de datos (marcador que dejó el código):

```sh
SQLCMD=$(ls /opt/mssql-tools*/bin/sqlcmd | tail -1); "$SQLCMD" -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d buyer -W -s "|" -Q "SELECT TOP 3 id_accion, accion, LEFT(detalle,90) AS detalle, fecha_ejecucion FROM dbo.accion_agente WHERE detalle LIKE 'Respuesta generada por Hermes Agent%' ORDER BY id_accion DESC;"
```

Si hay fila reciente → Hermes respondió. Si no → cayó al motor heurístico;
revisa en los logs de `app` el mensaje `[Agente IA] Hermes respondió HTTP ...`.

---

## 4. Usuario de base de datos con mínimos privilegios (opcional pero recomendado)

La app puede seguir usando `sa`, pero es mejor `establo_app`.
El script es `sql/03_CREAR_USUARIO_APP.sql` (ya montado en `/sql`).

En la terminal del servicio `database`, **en una sola línea**:

```sh
SQLCMD=$(ls /opt/mssql-tools*/bin/sqlcmd | tail -1); "$SQLCMD" -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -v APP_PASSWORD='EstabloApp#2026' -i /sql/03_CREAR_USUARIO_APP.sql
```

Luego, en Dokploy → `app` → Environment:

```env
DB_USER=establo_app
DB_APP_PASSWORD=EstabloApp#2026
```

**No cambies `DB_PASSWORD`**: esa es la contraseña de `sa` y
`MSSQL_SA_PASSWORD` solo se aplica al inicializar el volumen por primera vez.
`DB_APP_PASSWORD` existe justamente para no tocar la de `sa`.

Redeploya `app` y comprueba:

```sh
node -e 'fetch("http://localhost:3000/api/config").then(r=>r.json()).then(d=>console.log(d.config.baseDeDatos))'
```

Debe mostrar `usuario: "establo_app"` y `conectado: true`.

---

## 5. Seguridad pendiente (importante)

Hoy el panel y `/api/mcp` están **públicos**. `/api/mcp` permite escrituras
(por ejemplo `registrar_pedido`, `actualizar_estado_payer`).
Antes de usar datos reales, protege el dominio con una de estas opciones:

1. **Basic Auth en Dokploy/Traefik** para todo excepto:
   - `/api/webhook/whapi`
   - `/api/health/integrations`
2. **Middleware de Next.js** con sesión/API key propia.
3. Restringir `/api/mcp` por IP o token (`MCP_API_KEY`) y no exponerlo al público.

También conviene:

- Rotar la contraseña de `sa` con `ALTER LOGIN sa WITH PASSWORD = '...'`
  (cambiar solo la variable de entorno NO la actualiza en un volumen existente).
- Programar respaldos del volumen `mssql-data` con `BACKUP DATABASE buyer TO DISK=...`.

---

## Checklist de aceptación

| Integración | Prueba | Resultado esperado |
|---|---|---|
| App | `GET /api/health/integrations` | `database: OK` |
| BD | `/api/config` | `conectado: true`, 34 tablas |
| Whapi canal | `/api/health/integrations` | `whapi.ok: true`, `AUTH` |
| Webhook público | `GET /api/webhook/whapi` | `200`, `status: "ready"` |
| Webhook seguro | POST sin token / con token | `401` / `200` |
| WhatsApp entrante | mensaje real | `evento_integracion` PROCESADO |
| WhatsApp saliente | respuesta automática | `mensaje_whatsapp` SALIENTE |
| Hermes red | `dns.lookup` | IP resuelta |
| Hermes API | `?deep=1` | `hermes.deep.ok: true` |
| Hermes E2E | `accion_agente` | “Respuesta generada por Hermes Agent” |
