# ESTABLO AI — Sistema Inteligente de Gestión y Conversión de LEADS
### Plataforma SaaS de Inteligencia Comercial y Ventas Personalizadas con IA
**Parrilladas El Establo · Trujillo, Perú**  
*Proyecto de Aplicación Práctica para el Curso de Inteligencia de Negocios — Ingeniería de Sistemas*

---

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Microsoft%20SQL%20Server-2019%2B-CC292B?style=for-the-badge&logo=microsoft-sql-server&logoColor=white" alt="SQL Server" />
  <img src="https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Estado-Producci%C3%B3n%20Verificada-emerald?style=for-the-badge" alt="Estado" />
</p>

---

## 📑 Tabla de Contenidos
1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Alcance Exclusivo: Fase LEADS](#2-alcance-exclusivo-fase-leads)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Módulos de la Plataforma](#4-módulos-de-la-plataforma)
5. [Modelo de Datos y Vistas SQL Server V3](#5-modelo-de-datos-y-vistas-sql-server-v3)
6. [Métricas e Indicadores Oficiales (KPIs)](#6-métricas-e-indicadores-oficiales-kpis)
7. [Casos de Negocio Sintéticos Validados](#7-casos-de-negocio-sintéticos-validados)
8. [Motor de Inteligencia Artificial y Reglas de Promociones](#8-motor-de-inteligencia-artificial-y-reglas-de-promociones)
9. [Instalación y Puesta en Marcha](#9-instalación-y-puesta-en-marcha)
10. [Estructura del Proyecto](#10-estructura-del-proyecto)
11. [Seguridad y Buenas Prácticas](#11-seguridad-y-buenas-prácticas)

---

## 1. Visión General del Proyecto

**ESTABLO AI** es una solución de software empresarial diseñada para optimizar y automatizar el embudo de ventas de la startup gastronómica **Parrilladas El Establo** en la ciudad de Trujillo, Perú.

A diferencia de los chatbots decorativos o maquetas con datos estáticos, este sistema opera conectado en tiempo real a una base de datos relacional **Microsoft SQL Server (Base `buyer` V3)**, procesando datos transaccionales de clientes, cortes de carne, combos paquetizados, campañas de captación, reservas y transacciones de pago.

### Propósito Comercial
Convertir personas interesadas (**LEADS**) en clientes compradores (**PAYERS**) mediante atención contextualizada en canales de mensajería (WhatsApp), recomendaciones personalizadas según el segmento del consumidor y resolución transparente de objeciones comerciales.

---

## 2. Alcance Exclusivo: Fase LEADS

El ciclo de vida del cliente contempla cuatro fases:

```
[ BUYER ] ────────> [ LEAD ] ────────> [ PAYER ] ────────> [ CUSTOMER ]
 Interesado          Prospecto          Primer Pago         Pedido Entregado
 Anónimo            Identificado        Confirmado            y Atendido
```

### Reglas de Frontera del Alcance:
- **Enfoque Obligatorio**: El sistema opera **exclusivamente dentro de la fase LEAD** (desde que la persona envía un formulario o escribe por WhatsApp solicitando información, hasta que confirma su primer pago).
- **Conversión a PAYER**: Se produce en el instante exacto en que se registra un **primer pago confirmado** (incluyendo pagos parciales o anticipos de reserva).
- **Fuera del Alcance**: No incluye punto de venta de caja (POS), gestión de comandas de cocina, asignación de mesas en salón ni sistemas de fidelización posterior.
- **Trazabilidad de Recurrencia**: Cuando un cliente recurrente vuelve a negociar, reingresa como un **nuevo ciclo de LEAD** en `dbo.negociacion`, manteniendo la memoria de sus consumos anteriores sin duplicar su identidad.

---

## 3. Arquitectura del Sistema

La solución adopta una arquitectura en capas desacoplada con separación estricta de responsabilidades:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAPA DE PRESENTACIÓN (UI)                       │
│  Next.js 15 (App Router) + Tailwind CSS + Lucide Icons + Recharts UI   │
│         [Modo Claro / Modo Oscuro] [Mobile First 320px - Desktop]      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON
┌───────────────────────────────────▼────────────────────────────────────┐
│                       CAPA DE SERVICIOS Y API                          │
│     Rutas de Servidor Next.js (/api/kpi, /api/leads, /api/chat, etc.)  │
│  - Controladores REST            - Validación de Entradas              │
│  - Middleware de Auditoría       - Formateo de Moneda Peruana (PEN)    │
└──────────────┬───────────────────────────────┬─────────────────────────┘
               │                               │
┌──────────────▼─────────────┐   ┌─────────────▼─────────────────────────┐
│     MOTOR DE REGLAS E IA   │   │       CAPA DE ACCESO A DATOS          │
│ - Copiloto Heurístico V3   │   │ - Pool Singleton de Conexiones        │
│ - Integración Google Gemini│   │ - Consultas Parametrizadas (mssql)    │
│ - Validador Reglas Lima    │   │ - Protección contra Inyección SQL     │
└──────────────┬─────────────┘   └─────────────┬─────────────────────────┘
               │                               │
               └───────────────┬───────────────┘
                               │ TCP/IP Port 1434
┌──────────────────────────────▼─────────────────────────────────────────┐
│                       MICROSOFT SQL SERVER                             │
│                     Base de Datos: 'buyer'                             │
│         - 34 Tablas Transaccionales     - 9 Vistas Oficiales           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Módulos de la Plataforma

La barra de navegación lateral (*Sidebar*) organiza las funciones en 9 módulos especializados:

### 1. Dashboard — Centro de Inteligencia Comercial (`/`)
- **Diferenciación Operativa**: Desglosa claramente **ciclos comerciales** (19 ciclos) frente a **personas únicas** (17 personas).
- **Tarjetas de los 3 KPIs Oficiales**: Estado semafórico (Bueno, Regular, Malo) de TCP, TEN y TPN.
- **Visualizaciones Gráficas con Recharts**:
  - Evolución mensual de ciclos vs conversiones.
  - Curvas de tasa de éxito (TEN) vs tasa de pérdida (TPN).
  - Distribución de volumen de leads por segmento de cliente.
  - Efectividad de las recomendaciones emitidas por el Agente IA.

### 2. Gestión de Leads — CRM Comercial (`/leads`)
- Tabla integral con búsqueda instantánea por nombre, teléfono o correo.
- Filtros por estado transaccional (`ABIERTA`, `CONVERTIDA`, `PERDIDA`) y segmento (*Familias*, *Estudiantes*, *Amigos*).
- Cálculo en vivo del **tiempo sin respuesta** del cliente.
- Botones de acceso directo a los 6 casos de demostración académica.

### 3. Perfil 360° del Lead (`/leads/[id]`)
Ficha comercial exhaustiva estructurada en 7 secciones:
1. **Información Personal**: Identidad, segmento declarado, contacto y fase actual.
2. **Preferencias Gastronómicas**: Plato favorito declarado vs corte más comprado históricamente (`vw_preferencias_persona`).
3. **Historial y Recurrencia**: Conteo de veces que alcanzó cada fase (`vw_veces_fase_persona`) y ciclos de vida previos.
4. **Conversaciones**: Mensajería cronológica completa vía WhatsApp (`mensaje_whatsapp`).
5. **Recomendaciones Emitidas**: Historial de propuestas con respuesta (`oferta_negociacion`).
6. **Conversión a PAYER**: Primer pago confirmado, pedido asociado, desglose de ítems y saldo pendiente (`pedido`, `pago`, `vw_pedido_saldo`).
7. **Auditoría**: Acciones comerciales registradas en `dbo.accion_agente`.

### 4. Agente Conversacional IA (`/agente` o `/chat`)
- **Espacio de Atención en 3 Paneles**:
  - *Panel Izquierdo*: Directorio de sesiones activas de WhatsApp.
  - *Panel Central*: Interfaz interactiva de chat con selector de rol (*escribir como cliente* o *responder como asesor*) y sugerencias comerciales automáticas.
  - *Panel Derecho*: Ficha comercial en vivo del prospecto y botón para aplicar ofertas recomendadas con un solo clic.
- **Herramientas Controladas**: El modelo opera mediante 12 funciones seguras sin permitir SQL arbitrario.
- **Español Peruano Contextualizado**: Resuelve dudas sobre puntos de cocción, guarniciones y métodos de pago locales (Yape, Plin).

### 5. Motor de Recomendaciones Personalizadas (`/recomendaciones`)
- Genera propuestas basadas en los cortes más demandados por segmento (`vw_top_cortes_segmento`) y combos populares (`vw_top_combos_segmento`).
- Evalúa el historial previo del prospecto para evitar repetir ofertas rechazadas.
- Permite registrar ofertas interactivamente en `dbo.oferta_negociacion` con estados `ACEPTADA`, `RECHAZADA` o `SIN_RESPUESTA`.

### 6. Seguimiento Inteligente y Prevención de Abandono (`/seguimiento`)
- Semáforo de atención configurado en 6 intervalos:
  - `0 – 2 h`: Espera normal.
  - `2 – 6 h`: Respuesta demorada.
  - `6 – 24 h`: Posible desinterés.
  - `24 – 48 h`: Riesgo alto de abandono.
  - `48 – 72 h`: Negociación inactiva.
  - `> 72 h`: Inactividad prolongada (Candidato a `TIMEOUT_72H`).
- Distinción entre desistimiento formal (`RECHAZO`) e inactividad (`TIMEOUT_72H`).
- Modal de confirmación con supervisión humana antes de asentar un cierre por pérdida.

### 7. Catálogo Comercial Parrillero (`/catalogo`)
- **Cortes y Platos**: Detalle de porciones en gramos, estilos de preparación y precios unitarios.
- **Combos Paquetizados**: Desglose de cortes, acompañamientos y bebidas incluidas.
- **Promociones y Reglas de Validación**: Validador interactivo que evalúa vigencia de fecha, segmento y día permitido (`L,M,X,J,V,S,D`) según la hora oficial de Perú (`America/Lima`).

### 8. Analítica Oficial LEADS (`/analitica`)
- Reporte formal de la vista `dbo.vw_kpi_mensual`.
- Tabla comparativa de resultados con granularidad de ciclos por mes de inicio.
- Umbrales oficiales de rendimiento comercial (Bueno / Regular / Malo).

### 9. Configuración y Monitor de Salud (`/configuracion`)
- Diagnóstico en tiempo real del pool de conexiones a SQL Server con test de latencia.
- Indicador del proveedor de IA activo (Gemini API vs Copiloto Heurístico Autónomo).
- Parámetros comerciales configurables.

---

## 5. Modelo de Datos y Vistas SQL Server V3

El sistema utiliza íntegramente las tablas y vistas provistas en el esquema transaccional `buyer`:

### Vistas Consumidas por la Plataforma:
| Nombre de la Vista | Utilidad en el Sistema | Módulo Destino |
|---|---|---|
| `dbo.vw_kpi_mensual` | Agrupación mensual de ciclos, payers, pérdidas y cálculo de TCP, TEN y TPN. | Dashboard / Analítica |
| `dbo.vw_negociacion_detalle` | Detalle a nivel de ciclo con horas de conversión y primer pago. | Gestión de Leads |
| `dbo.vw_preferencias_persona` | Favorito declarado en formulario, más comprado y recurrencia. | Perfil 360° / Agente IA |
| `dbo.vw_top_cortes_segmento` | Ranking de cortes de carne más vendidos (incluyendo dentro de combos). | Recomendaciones |
| `dbo.vw_top_combos_segmento` | Combos más pedidos por segmento de consumidor. | Recomendaciones / Catálogo |
| `dbo.vw_promos_vigentes` | Promociones activas filtradas por fecha y día local de Perú. | Recomendaciones / Catálogo |
| `dbo.vw_veces_fase_persona` | Conteo histórico de recurrencia por fase (`LEAD`, `PAYER`, `CUSTOMER`). | Perfil 360° |
| `dbo.vw_pedido_saldo` | Control de saldos y verificación de pagos parciales. | Conversión / Perfil 360° |

---

## 6. Métricas e Indicadores Oficiales (KPIs)

Los tres indicadores oficiales del negocio se evalúan con estricto rigor analítico:

### 1. TCP — Tiempo Promedio de Conversión
Representa el promedio de horas transcurridas desde el ingreso formal a la fase LEAD hasta la confirmación del primer pago:
$$\text{TCP} = \frac{\sum (\text{Fecha Primer Pago} - \text{Fecha Inicio Lead en Horas})}{\text{Total de Payers}}$$
- **Meta Oficial**: $\le 48\text{ horas}$
- **Rangos**: Bueno ($\le 48\text{ h}$) · Regular ($48 - 72\text{ h}$) · Malo ($> 72\text{ h}$)

### 2. TEN — Tasa de Éxito de Negociación
Porcentaje de ciclos de negociación que culminaron en venta efectiva:
$$\text{TEN} = \left( \frac{\text{Total de Payers}}{\text{Total de Ciclos Lead}} \right) \times 100$$
- **Meta Oficial**: $\ge 30\text{ \%}$
- **Rangos**: Bueno ($\ge 30\text{ \%}$) · Regular ($15\text{ \%} - 30\text{ \%}$) · Malo ($< 15\text{ \%}$)

### 3. TPN — Tasa de Pérdida de Negociación
Porcentaje de ciclos abandonados por rechazo o inactividad:
$$\text{TPN} = \left( \frac{\text{Total de Leads Perdidos}}{\text{Total de Ciclos Lead}} \right) \times 100$$
- **Meta Oficial**: $\le 40\text{ \%}$
- **Rangos**: Bueno ($\le 40\text{ \%}$) · Regular ($40\text{ \%} - 60\text{ \%}$) · Malo ($> 60\text{ \%}$)

### Resultados Obtenidos desde SQL Server V3:
| Indicador | Octubre 2026 | Noviembre 2026 | Estado Oficial |
|---|:---:|:---:|:---:|
| **Ciclos Totales** | 7 | 12 | — |
| **Payers Confirmados** | 6 | 9 | — |
| **Pérdidas Registradas** | 1 | 1 | — |
| **Negociaciones Abiertas** | 0 | 2 | — |
| **TCP** | **39.02 h** | **13.18 h** | **Bueno** |
| **TEN** | **85.71 %** | **75.00 %** | **Bueno** |
| **TPN** | **14.29 %** | **8.33 %** | **Bueno** |

---

## 7. Casos de Negocio Sintéticos Validados

El sistema incorpora selectores rápidos en la interfaz para auditar los escenarios clave diseñados en la base de datos:

```
┌─────────────────┬──────────────┬───────────────┬────────────────────────────────────────────────────────┐
│ Lead            │ Segmento     │ Estado        │ Hallazgo Comercial Demostrado                          │
├─────────────────┼──────────────┼───────────────┼────────────────────────────────────────────────────────┤
│ Ana Ramírez     │ Estudiantes  │ 3 Ciclos      │ Recurrente: 2 compras cerradas + 1 ciclo en curso.     │
│ Luis Torres     │ Familias     │ 2 Ciclos      │ Recurrente: 2 reservas familiares atendidas.           │
│ María Paredes   │ Amigos       │ CONVERTIDA    │ Pago parcial: S/60 confirmado (Yape) + S/50 pendiente. │
│ Sofía Vargas    │ Estudiantes  │ PERDIDA       │ Desistimiento explícito por objeción de precio.        │
│ Diego Flores    │ Familias     │ PERDIDA       │ Cierre registrado tras superar 72 horas de inactividad. │
│ Jorge Mendoza   │ Estudiantes  │ ABIERTA       │ Lead nuevo en negociación activa (43 h sin respuesta). │
└─────────────────┴──────────────┴───────────────┴────────────────────────────────────────────────────────┘
```

---

## 8. Motor de Inteligencia Artificial y Reglas de Promociones

### Arquitectura del Agente Copiloto:
- **Herramientas de Consulta Controladas**: La IA no tiene acceso libre a la consola SQL; en su lugar invoca funciones de backend que devuelven estructuras JSON predefinidas.
- **Manejo de Objeciones**: Ante objeciones de costo (*"me parece caro"*, *"cocinaré en casa"*), el agente explica el rendimiento de los 350 g de carne importada y ofrece alternativas directas como el **Combo Estudiante (S/ 39.00)** o el **15% de descuento en cortes**.
- **Memoria Comercial**: Registra cada interacción en `dbo.mensaje_whatsapp` y cada oferta en `dbo.oferta_negociacion`.

### Reglas de Validación de Promociones (Hora Oficial Perú: `America/Lima`):
Antes de que una promoción sea recomendada al cliente, el motor (`src/lib/promotions-engine.ts`) comprueba:
1. Que el indicador `activa` sea `1`.
2. Que la fecha actual en Perú se encuentre entre `fecha_inicio` y `fecha_fin`.
3. Que el día de la semana (`L,M,X,J,V,S,D`) coincida con los días permitidos.
4. Que el prospecto pertenezca al `id_segmento_objetivo`.
5. En promociones como la *Promo Cumpleañero*, verifica que la fecha de nacimiento esté en la ventana de cumpleaños ($\pm 3\text{ días}$).
6. Que no se aplique más de una promoción por pedido.

---

## 9. Instalación y Puesta en Marcha

### Requisitos Previos:
- **Node.js**: Versión 18 o superior (Probado en Node.js v22.19.0).
- **Microsoft SQL Server**: 2019 o superior con la base de datos `buyer` cargada con los scripts provistos en `/sql`.

### 1. Clonar el Repositorio
```bash
git clone https://github.com/Prolexis/establo-ai-leads.git
cd establo-ai-leads
```

### 2. Configurar Variables de Entorno
Copia el archivo de plantilla a `.env.local`:
```bash
cp .env.example .env.local
```

Verifica la configuración de conexión a tu base de datos:
```env
DB_SERVER=127.0.0.1
DB_PORT=1434
DB_NAME=buyer
DB_USER=establo_app
DB_PASSWORD=EstabloLeads2026!
DB_TRUST_SERVER_CERTIFICATE=true
DB_TRUSTED_CONNECTION=false

# Opcional: API Key de Google Gemini (si está vacía, opera en modo heurístico experto)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

TZ=America/Lima
WHATSAPP_DEMO_MODE=true
```

### 3. Instalar Dependencias
```bash
npm install
```

### 4. Compilar y Ejecutar en Producción
```bash
npm run build
npm run start
```

La aplicación estará lista y accesible en:  
👉 **`http://localhost:3001`**

*(Para ejecutar en modo desarrollo con recarga en caliente: `npm run dev -- -p 3001`)*

---

## 10. Estructura del Proyecto

```
establo-ai-leads/
├── .env.example              # Plantilla de variables de entorno seguras
├── .gitignore                # Reglas de exclusión para credenciales y temporales
├── README.md                 # Documentación técnica y académica integral
├── package.json              # Definición de dependencias y scripts de ejecución
├── tsconfig.json             # Configuración del compilador TypeScript
├── tailwind.config.ts        # Sistema de diseño con tokens de modo claro y oscuro
├── sql/                      # Scripts oficiales de la base de datos SQL Server
│   ├── 01_CREAR_BD_EL_ESTABLO_V3.sql
│   └── 02_LLENAR_BD_EL_ESTABLO_V3.sql
└── src/
    ├── types/
    │   └── database.ts       # Modelos TypeScript de tablas, vistas y payloads
    ├── lib/
    │   ├── db.ts             # Conexión singleton y consultas parametrizadas
    │   ├── ai-agent.ts       # Agente IA, herramientas y copiloto conversacional
    │   ├── promotions-engine.ts # Validador estricto de promociones en Trujillo
    │   └── utils.ts          # Formateadores de moneda (S/), porcentajes y horas
    ├── components/
    │   ├── theme-provider.tsx# Manejador de Modo Claro / Oscuro sin parpadeo
    │   └── layout/
    │       ├── app-layout.tsx# Contenedor responsive con navegación adaptativa
    │       ├── navbar.tsx    # Barra superior con selector de Casos de Prueba
    │       └── sidebar.tsx   # Menú lateral con los 9 módulos de la fase LEADS
    └── app/
        ├── layout.tsx        # Layout principal de Next.js
        ├── globals.css       # Estilos globales y paleta parrillera premium
        ├── page.tsx          # Módulo 1: Dashboard (Centro de Inteligencia Comercial)
        ├── leads/            # Módulo 2 y 3: Gestión de Leads CRM y Perfil 360°
        ├── agente/           # Módulo 4: Agente Conversacional Copiloto
        ├── chat/             # Módulo complementario de Mensajería WhatsApp
        ├── recomendaciones/  # Módulo 5: Motor de Recomendaciones Gastronómicas
        ├── seguimiento/      # Módulo 6: Seguimiento y Semáforo de Abandono (72h)
        ├── catalogo/         # Módulo 7: Catálogo Comercial y Promociones
        ├── analitica/        # Módulo 8: Analítica de KPIs Oficiales (TCP, TEN, TPN)
        ├── configuracion/    # Módulo 9: Monitor de Salud de SQL Server
        └── api/              # Endpoints RESTful para consumo de datos
```

---

## 11. Seguridad y Buenas Prácticas

- **Cero Inyección SQL**: Todas las interacciones con SQL Server emplean parámetros fuertemente tipados a través del driver nativo `mssql`.
- **Aislamiento de Secretos**: Ninguna clave de base de datos ni token de API se expone en el código fuente. El archivo `.env.local` está estrictamente ignorado por `.gitignore`.
- **Auditoría Transaccional**: Cada recomendación y acción emitida por el asesor inteligente se persiste de forma permanente en la tabla `dbo.accion_agente`.
- **Integridad Referencial**: Respeta las llaves foráneas circulares entre `negociacion` y `pedido` mediante validaciones de estado en el backend.
- **Diseño Ergonómico y Accesible**: Cumple con estándares de contraste en modo claro y modo oscuro, con tipografía clara y sin elementos decorativos que carezcan de función operativa.

---

<p align="center">
  <b>ESTABLO AI</b> — Desarrollado para <b>Parrilladas El Establo</b> (Trujillo, Perú)<br />
  <i>Escuela Profesional de Ingeniería de Sistemas · Universidad Nacional de Trujillo</i>
</p>
