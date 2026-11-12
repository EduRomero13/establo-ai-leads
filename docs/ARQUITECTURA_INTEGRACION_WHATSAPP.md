# ESTABLO AI — Documentación de Arquitectura e Integración WhatsApp Business Cloud API

## 1. Visión General del Proyecto
**ESTABLO AI** es una plataforma SaaS de Inteligencia Comercial y Conversión de LEADS diseñada para la startup gastronómica **Parrilladas El Establo** (Trujillo, Perú), enfocada rigurosamente en la fase comercial **LEADS** (`BUYER → LEAD → PAYER → CUSTOMER`).

- **Canal de Negociación con el Cliente:** WhatsApp Business Cloud API (Meta Graph API v21.0). El cliente negocia exclusivamente por WhatsApp.
- **Sistema Web Interno:** ESTABLO AI (Next.js 15, App Router, TypeScript, Tailwind CSS, shadcn/ui, Recharts). Panel privado para que el personal del restaurante supervise conversaciones, intervenga ante dudas complejas y evalúe indicadores.
- **Base de Datos Transaccional:** Microsoft SQL Server V3 (`buyer`, puerto 1434, 34 tablas, 9 vistas oficiales).
- **Motor de Inteligencia Artificial:** Agente comercial con 12 herramientas controladas (consultas SQL parametrizadas, elegibilidad de promociones en tiempo real y manejo de objeciones comerciales).

---

## 2. Flujo Completo Demostrable

```
[ CLIENTE EN WHATSAPP ]
         │
         ▼ (Mensaje entrante o actualización de estado)
[ WEBHOOK OFICIAL META: /api/webhook/whatsapp ]
         │ 1. Valida firma criptográfica X-Hub-Signature-256 (HMAC SHA-256)
         │ 2. Control de idempotencia en dbo.evento_integracion (evita duplicados)
         ▼
[ IDENTIFICACIÓN DEL LEAD EN SQL SERVER V3 ]
         │ - Normaliza número de teléfono (+51 9XXXXXXXX)
         │ - Busca en dbo.persona y consulta negociación en dbo.negociacion
         │ - Si NO es LEAD: envía cordial saludo con enlace al formulario de captación
         ▼
[ AGENTE IA DE VENTAS PERSONALIZADAS ]
         │ - Consulta preferencias en dbo.vw_preferencias_persona
         │ - Evalúa top cortes y combos en dbo.vw_top_cortes_segmento
         │ - Valida promociones vigentes (regla 1 promo/pedido, horario Lima UTC-5)
         │ - Resuelve objeciones comerciales (precio, métodos de pago Yape/Plin, delivery)
         ▼
[ RESPUESTA AUTOMÁTICA VÍA META CLOUD API ]
         │ - Envía mensaje de vuelta al WhatsApp del cliente
         │ - Registra mensaje en dbo.mensaje_whatsapp
         │ - Registra oferta en dbo.oferta_negociacion
         │ - Registra auditoría en dbo.accion_agente
         ▼
[ BANDEJA EN VIVO ESTABLO AI (/chat) ]
         │ - Stream Server-Sent Events (SSE) sin recarga manual
         │ - Semáforo de seguimiento y alerta de abandono (0 a 72h)
         │ - Botón de intervención humana (suspende bot y permite respuesta del asesor)
         ▼
[ CONVERSIÓN A PAYER ]
         │ - Verificación estricta del primer pago o anticipo confirmado en dbo.pago
         │ - El Dashboard calcula TCP (13.18h / 39.02h / 23.5h), TEN y TPN desde dbo.vw_kpi_mensual
```

---

## 3. Guía de Configuración de Meta WhatsApp Cloud API

Para conectar un número de teléfono real de WhatsApp Business:

1. Ingresa a [Meta for Developers](https://developers.facebook.com/) y crea una App de tipo **Negocios**.
2. Agrega el producto **WhatsApp**.
3. En el panel de WhatsApp, copia:
   - **Identificador de número de teléfono** (`WHATSAPP_PHONE_NUMBER_ID`)
   - **Identificador de la cuenta de WhatsApp Business** (`WHATSAPP_BUSINESS_ACCOUNT_ID`)
   - **Token de acceso temporal / permanente** (`WHATSAPP_ACCESS_TOKEN`)
4. En **Configuración básica de la App**, copia la **Clave secreta de la app** (`META_APP_SECRET`).
5. Configura tu `.env.local`:
   ```env
   WHATSAPP_DEMO_MODE=false
   WHATSAPP_ACCESS_TOKEN=tu_token_aqui
   WHATSAPP_PHONE_NUMBER_ID=tu_phone_id_aqui
   WHATSAPP_BUSINESS_ACCOUNT_ID=tu_waba_id_aqui
   WHATSAPP_VERIFY_TOKEN=establo_ai_webhook_secret_2026
   META_APP_SECRET=tu_app_secret_aqui
   WHATSAPP_API_VERSION=v21.0
   ```
6. En la sección **Webhook de WhatsApp** en Meta:
   - URL de devolución de llamada: `https://tu-dominio.com/api/webhook/whatsapp`
   - Token de verificación: `establo_ai_webhook_secret_2026`
   - Campos de suscripción: marca `messages`.

---

## 4. Pruebas Automatizadas de Integración

Ejecuta la suite oficial de pruebas desde la terminal:

```bash
node scripts/test-suite.mjs
```

### Resultados de la Suite:
- ✅ **Test 1:** Normalización de números telefónicos peruanos (+51).
- ✅ **Test 2:** Validación criptográfica de firma Meta `X-Hub-Signature-256`.
- ✅ **Test 3:** Handshake de verificación Meta GET (`hub.challenge`).
- ✅ **Test 4:** Rechazo seguro ante `verify_token` incorrecto (HTTP 403).
- ✅ **Test 5:** Procesamiento desacoplado POST Webhook de Meta (HTTP 200).
- ✅ **Test 6:** Canal Server-Sent Events (SSE) activo para actualización en vivo.
- ✅ **Test 7:** Conexión verificada con SQL Server V3 (Base: `buyer`, 34 tablas).

---

## 5. Criterios de Aceptación y KPIs Oficiales

Los indicadores comerciales mostrados en `/` y `/analitica` provienen de `dbo.vw_kpi_mensual`:

- **Noviembre 2026 (Mes Actual):**
  - Ciclos Lead: **12** | Payers: **9** | Perdidas: **1** | Abiertas: **2**
  - **TCP:** `13.18 h` | **TEN:** `75.00%` | **TPN:** `8.33%`
- **Octubre 2026:**
  - Ciclos Lead: **7** | Payers: **6** | Perdidas: **1** | Abiertas: **0**
  - **TCP:** `39.02 h` | **TEN:** `85.71%` | **TPN:** `14.29%`
- **Histórico Consolidado (19 Ciclos Totales):**
  - Total Payers: **15** | Total Pérdidas: **2**
  - **TCP Ponderado:** `23.5 h` | **TEN:** `78.95%` | **TPN:** `10.53%`

