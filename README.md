# ESTABLO AI — Sistema Inteligente de Gestión y Conversión de LEADS
### Parrilladas El Establo (Trujillo, Perú)
> **Proyecto para el Curso de Inteligencia de Negocios — Ingeniería de Sistemas**  
> **Alcance Riguroso: Fase LEADS** (`BUYER → LEAD → PAYER → CUSTOMER`)

---

## 1. Visión y Misión del Sistema

**ESTABLO AI** es una plataforma SaaS empresarial de inteligencia comercial desarrollada para la startup gastronómica **Parrilladas El Establo** en Trujillo, Perú.

Su objetivo es convertir personas interesadas en clientes compradores (**PAYERS**) mediante:
1. **Recomendaciones gastronómicas personalizadas** basadas en cortes más pedidos por segmento y combos.
2. **Atención comercial contextualizada con Agente IA** mediante WhatsApp.
3. **Gestión inteligente de objeciones comerciales** (precios, gramajes, tiempos, ocasiones de consumo).
4. **Seguimiento comercial disciplinado** bajo la regla de inactividad de 72 horas (`TIMEOUT_72H` vs `RECHAZO`).
5. **Verificación rigurosa de la conversión a PAYER** exclusivamente cuando existe un primer pago confirmado (incluyendo anticipos y pagos parciales).
6. **Cálculo automatizado de los indicadores oficiales**:
   - **TCP** (Tiempo Promedio de Conversión)
   - **TEN** (Tasa de Éxito de Negociación)
   - **TPN** (Tasa de Pérdida de Negociación)

---

## 2. Alcance Exclusivo: Únicamente Fase LEADS

El ciclo de vida del cliente gastronómico contempla:
$$\text{BUYER} \longrightarrow \mathbf{LEAD} \longrightarrow \text{PAYER} \longrightarrow \text{CUSTOMER}$$

- **No es un sistema de POS de caja, ni de comandas de cocina, ni de mesas, ni de fidelización.**
- El sistema se concentra en el **seguimiento comercial previo y hasta la confirmación de la primera compra o anticipo**.
- Se consulta la recurrencia e historial de otras fases únicamente como evidencia para atender mejor al lead que reincide en el ciclo comercial.

---

## 3. Arquitectura y Tecnologías

### Frontend
- **Framework**: Next.js 15 (App Router con Server Components y Client Components).
- **Lenguaje**: TypeScript con tipado estricto.
- **Diseño Visual**: Tailwind CSS con paleta premium de restaurante parrillero + SaaS corporativo.
- **Iconografía**: `lucide-react`.
- **Gráficos**: `recharts` (BarChart, LineChart, PieChart interactivos).
- **Temas**: Modo Claro y Modo Oscuro completo con persistencia en `localStorage`, selector sol/luna y sin parpadeo (FOUC).
- **Diseño Responsive**: Optimizado para Smartphone (320px+), Tablet y Escritorio.

### Backend y Base de Datos
- **Entorno**: Node.js v22 con rutas API de Next.js (`/api/*`).
- **Base de Datos**: **Microsoft SQL Server (Base `buyer`)**.
- **Conector**: Paquete `mssql` con pool singleton de conexiones y consultas SQL estrictamente parametrizadas.
- **Integridad**: **No ejecuta SQL arbitrario**. Las herramientas del agente invocan procedimientos y funciones controladas del backend.
- **Validación de Promociones**: Motor de reglas en zona horaria `America/Lima` que valida día de la semana (`L,M,X,J,V,S,D`), vigencia de fechas, segmento del lead, producto aplicable y ventana de cumpleaños (±3 días).

### Inteligencia Artificial
- **Integración Dual**:
  - **Google Gemini** (`gemini-1.5-flash`) mediante API Key en variables de entorno.
  - **Copiloto Heurístico Autónomo**: Motor experto en ventas gastronómicas peruanas que funciona de forma offline si no se proporciona API key, garantizando demostraciones 100% estables en cualquier momento.

---

## 4. Los 9 Módulos del Sistema (Sidebar)

| # | Módulo | Descripción Funcional |
|---|---|---|
| 1 | **Dashboard** | Centro de Inteligencia Comercial. Comparación entre ciclos comerciales y personas únicas, tarjetas de los 3 KPIs oficiales (TCP, TEN, TPN) con rangos Bueno/Regular/Malo, gráficos de evolución mensual, distribución por segmento y efectividad del agente. |
| 2 | **Gestión de Leads** | CRM comercial con búsqueda en tiempo real, filtros por estado (`ABIERTA`, `CONVERTIDA`, `PERDIDA`) y segmento, ordenación, tiempo sin respuesta y selector rápido de los 6 casos sintéticos de demostración. |
| 3 | **Perfil 360° del Lead** | Ficha comercial integral con sus 7 secciones: 1) Información personal, 2) Preferencias gastronómicas (`vw_preferencias_persona`), 3) Historial y recurrencia (`vw_veces_fase_persona`), 4) Conversaciones cronológicas, 5) Recomendaciones registradas (`oferta_negociacion`), 6) Conversión / Primer pago confirmado (`pedido`, `pago`), 7) Auditoría del agente (`accion_agente`). |
| 4 | **Agente IA** | Espacio de atención en 3 paneles: 1) Lista de chats, 2) Conversación interactiva con cliente / copiloto, 3) Contexto del lead, sugerencias comerciales y ofertas recomendadas con registro directo en SQL Server. |
| 5 | **Recomendaciones** | Motor híbrido basado en cortes más vendidos por segmento (`vw_top_cortes_segmento`), combos más pedidos (`vw_top_combos_segmento`) y promociones vigentes (`vw_promos_vigentes`). Incluye simulador de ofertas con registro de estado `ACEPTADA`, `RECHAZADA` o `SIN_RESPUESTA`. |
| 6 | **Seguimiento** | Semáforo de tiempos sin respuesta con 6 niveles (0-2h, 2-6h, 6-24h, 24-48h, 48-72h, >72h). Alerta de riesgo de abandono y modal de confirmación humana para registrar cierres por `RECHAZO` o `TIMEOUT_72H`. |
| 7 | **Catálogo Comercial** | Consulta de productos de la carta (con peso y categoría), combos (con desglose de ítems incluidos) y promociones (con validador interactivo de reglas en vivo para el día de hoy en Trujillo). |
| 8 | **Analítica LEADS** | Reporte oficial de la vista `dbo.vw_kpi_mensual`, tabla de resultados Octubre vs Noviembre 2026, definiciones de metas y métricas de desempeño del agente comercial. |
| 9 | **Configuración** | Monitor de salud de SQL Server en vivo (test de conexión, base de datos, puerto 1434, tablas detectadas), estado de la integración de IA, WhatsApp y parámetros comerciales. |

---

## 5. Resultados Oficiales de Referencia (Validados en SQL Server V3)

Los resultados obtenidos desde la vista `dbo.vw_kpi_mensual` de la base `buyer` son:

| Indicador | Octubre 2026 | Noviembre 2026 | Meta Oficial | Estado |
|---|:---:|:---:|:---:|:---:|
| **Total Ciclos LEAD** | 7 | 12 | — | Base del embudo |
| **Payers (Convertidos)** | 6 | 9 | — | 1er pago confirmado |
| **Pérdidas** | 1 | 1 | — | Rechazo / Timeout 72h |
| **Negociaciones Abiertas** | 0 | 2 | — | En negociación |
| **TCP (Tiempo Promedio)** | **39.02 h** | **13.18 h** | $\le 48\text{ h}$ | **Bueno** |
| **TEN (Tasa de Éxito)** | **85.71 %** | **75.00 %** | $\ge 30\text{ \%}$ | **Bueno** |
| **TPN (Tasa de Pérdida)** | **14.29 %** | **8.33 %** | $\le 40\text{ \%}$ | **Bueno** |

---

## 6. Casos Sintéticos para Demostración

El sistema incluye acceso directo desde la barra superior y desde el módulo de Leads para los siguientes casos clave:

1. **Ana Ramírez** (`caso=ana`): Cliente recurrente del segmento *Estudiantes*. Registra 3 ciclos de vida:
   - Ciclo 1: Convertida con descuento estudiante en cortes (TCP 57.35 h).
   - Ciclo 2: Convertida con Combo Estudiante y torta (TCP 0.72 h).
   - Ciclo 3: Negociación abierta actualmente en curso.
2. **Luis Torres** (`caso=luis`): Cliente recurrente del segmento *Familias* con 2 ciclos y reservas familiares atendidas.
3. **María Paredes** (`caso=maria`): Demuestra que un pago parcial (S/ 60 Yape confirmado y S/ 50 pendiente en caja al recoger) constituye una **conversión a PAYER**.
4. **Sofía Vargas** (`caso=sofia`): Demuestra una negociación **PERDIDA por RECHAZO** explícito al considerar alto el precio.
5. **Diego Flores** (`caso=diego`): Demuestra una negociación **PERDIDA por TIMEOUT_72H** tras superar las 72 horas de inactividad.
6. **Jorge Mendoza** (`caso=jorge`): Negociación **ABIERTA** nueva en curso.

---

## 7. Instrucciones de Configuración y Ejecución

### Requisitos Previos
- Node.js v18+ (recomendado Node.js v22).
- Microsoft SQL Server en ejecución con la base de datos `buyer` cargada (usando `01_CREAR_BD_EL_ESTABLO_V3.sql` y `02_LLENAR_BD_EL_ESTABLO_V3.sql`).

### Variables de Entorno (`.env.local`)
Crear el archivo `.env.local` en la raíz (se incluye plantilla en `.env.example`):
```env
# Conexión a Microsoft SQL Server (Base: buyer)
DB_SERVER=127.0.0.1
DB_PORT=1434
DB_NAME=buyer
DB_USER=establo_app
DB_PASSWORD=EstabloLeads2026!
DB_TRUST_SERVER_CERTIFICATE=true
DB_TRUSTED_CONNECTION=false

# Inteligencia Artificial (Gemini)
# Opcional: Si se deja vacío opera el Copiloto Heurístico Experto V3 offline
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

# Zona Horaria Comercial
TZ=America/Lima

# WhatsApp Integración (Simulador activo)
WHATSAPP_DEMO_MODE=true
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=establo_ai_webhook_secret_2026
```

### Comandos de Puesta en Marcha

1. **Instalación de Dependencias**:
   ```bash
   npm install
   ```

2. **Compilación de Producción**:
   ```bash
   npm run build
   ```

3. **Iniciar Servidor Web**:
   ```bash
   npm run start
   ```
   *La aplicación estará disponible de inmediato en [http://localhost:3001](http://localhost:3001)*.

4. **Modo Desarrollo (Opcional)**:
   ```bash
   npm run dev
   ```

---

## 8. Seguridad y Calidad del Software

- **SQL Parametrizado**: Todas las consultas a SQL Server utilizan parámetros fuertemente tipados (`sql.BigInt`, `sql.VarChar`, `sql.NVarChar`), eliminando vectores de inyección SQL.
- **Protección de Datos Personales**: Los números telefónicos y correos se muestran dentro del contexto del CRM para operadores autorizados.
- **Auditoría Transaccional**: Toda acción del agente comercial se audita en la tabla `dbo.accion_agente`.
- **Confirmación Humana**: Las operaciones sensibles como el cierre de una negociación por abandono o rechazo exigen validación humana obligatoria.
- **Manejo Centralizado de Errores**: Códigos de estado HTTP estandarizados y mensajes amigables para el usuario.

