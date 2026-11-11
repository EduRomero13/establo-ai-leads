// Tipos y esquemas que corresponden exactamente a la estructura SQL Server V3 de la base 'buyer'

export type FaseActual = 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER';
export type EstadoNegociacion = 'ABIERTA' | 'CONVERTIDA' | 'PERDIDA';
export type MotivoPerdida = 'RECHAZO' | 'TIMEOUT_72H';
export type RespuestaOferta = 'ACEPTADA' | 'RECHAZADA' | 'SIN_RESPUESTA';
export type TipoBeneficio = 'PORCENTAJE' | 'MONTO_FIJO' | 'PRECIO_FIJO' | 'PRODUCTO_GRATIS';
export type CategoriaProducto = 'COMIDA' | 'BEBIDA' | 'POSTRE';
export type EstadoPedido = 'REGISTRADO' | 'PAGADO_PARCIAL' | 'PAGADO' | 'ATENDIDO' | 'ANULADO';
export type EstadoPago = 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO' | 'REEMBOLSADO';
export type DireccionMensaje = 'ENTRANTE' | 'SALIENTE';

export interface SegmentoCliente {
  id_segmento: number;
  nombre: string;
  descripcion?: string | null;
}

export interface Persona {
  id_persona: number;
  nombres: string;
  apellidos: string;
  telefono?: string | null;
  email?: string | null;
  fecha_nacimiento?: string | null;
  id_segmento?: number | null;
  segmento?: string | null;
  fecha_registro: string;
  fase_actual: FaseActual;
  consentimiento_datos_fecha?: string | null;
  consentimiento_marketing_fecha?: string | null;
}

export interface Negociacion {
  id_negociacion: number;
  id_persona: number;
  id_sesion_whatsapp?: number | null;
  id_formulario?: number | null;
  nro_ciclo: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  estado: EstadoNegociacion;
  motivo_perdida?: MotivoPerdida | null;
  detalle_perdida?: string | null;
  id_pedido?: number | null;
  fecha_primer_pago?: string | null;
  fecha_atencion?: string | null;
  resumen?: string | null;
  // Campos complementarios calculados o unidos
  persona_nombre?: string;
  persona_apellidos?: string;
  telefono?: string | null;
  email?: string | null;
  id_segmento?: number | null;
  segmento_nombre?: string | null;
  horas_conversion?: number | null;
  tiempo_sin_respuesta_horas?: number | null;
}

export interface ProductoCarta {
  id_producto: number;
  nombre: string;
  categoria: CategoriaProducto;
  descripcion?: string | null;
  estilo?: string | null;
  es_corte: boolean;
  peso_cantidad?: number | null;
  peso_unidad?: string | null;
  precio: number;
  activo: boolean;
}

export interface Combo {
  id_combo: number;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  activo: boolean;
  detalles?: ComboDetalleItem[];
}

export interface ComboDetalleItem {
  id_detalle: number;
  id_combo: number;
  id_producto: number;
  producto_nombre: string;
  cantidad: number;
  es_corte: boolean;
  peso_cantidad?: number | null;
  peso_unidad?: string | null;
}

export interface Promocion {
  id_promocion: number;
  nombre_promocion: string;
  descripcion: string;
  tipo_beneficio: TipoBeneficio;
  valor_beneficio?: number | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  dias_aplicables: string; // 'TODOS' o 'L,M,X,J,V,S,D'
  id_segmento_objetivo?: number | null;
  segmento_nombre?: string | null;
  activa: boolean;
  aplicables?: PromocionAplicable[];
}

export interface PromocionAplicable {
  id_aplicacion: number;
  id_promocion: number;
  id_producto?: number | null;
  id_combo?: number | null;
  categoria?: CategoriaProducto | null;
  producto_nombre?: string | null;
  combo_nombre?: string | null;
}

export interface OfertaNegociacion {
  id_oferta: number;
  id_negociacion: number;
  id_producto?: number | null;
  id_combo?: number | null;
  id_promocion?: number | null;
  fecha_oferta: string;
  respuesta: RespuestaOferta;
  detalle?: string | null;
  // Nombres descriptivos
  nombre_oferta?: string;
  tipo_oferta?: 'PRODUCTO' | 'COMBO' | 'PROMOCION';
  precio?: number | null;
}

export interface SesionWhatsApp {
  id_sesion: number;
  id_buyer?: number | null;
  id_persona?: number | null;
  telefono_cliente: string;
  fecha_inicio: string;
  fecha_ultimo_mensaje: string;
  estado: 'ABIERTA' | 'CERRADA';
  origen?: string | null;
  persona_nombre?: string;
  ultimo_mensaje?: string;
  mensajes_no_leidos?: number;
}

export interface MensajeWhatsApp {
  id_mensaje: number;
  id_sesion: number;
  wamid?: string | null;
  direccion: DireccionMensaje;
  tipo: 'TEXTO' | 'BOTONES' | 'INTERACTIVO' | 'IMAGEN' | 'OTRO';
  contenido?: string | null;
  opcion_seleccionada?: string | null;
  fecha_mensaje: string;
  estado_entrega?: string | null;
}

export interface Pedido {
  id_pedido: number;
  id_persona: number;
  id_negociacion: number;
  id_personal_atiende?: number | null;
  tipo: 'LOCAL' | 'RESERVA';
  fecha_registro: string;
  estado: EstadoPedido;
  fecha_atencion?: string | null;
  id_promocion?: number | null;
  subtotal: number;
  descuento: number;
  total: number;
  detalles?: PedidoDetalleItem[];
  pagos?: PagoItem[];
  reserva?: ReservaItem | null;
}

export interface PedidoDetalleItem {
  id_detalle: number;
  id_pedido: number;
  id_producto?: number | null;
  id_combo?: number | null;
  nombre_item: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface PagoItem {
  id_pago: number;
  id_pedido: number;
  id_medio_pago: number;
  medio_pago_nombre: string;
  monto: number;
  moneda: string;
  fecha_pago: string;
  estado: EstadoPago;
  referencia?: string | null;
}

export interface ReservaItem {
  id_reserva: number;
  id_pedido: number;
  fecha_reserva: string;
  nro_personas: number;
  estado: 'CONFIRMADA' | 'ATENDIDA' | 'NO_ASISTIO' | 'CANCELADA';
}

export interface HistorialFaseItem {
  id_historial: number;
  id_persona: number;
  fase: FaseActual;
  fecha_cambio: string;
  id_buyer?: number | null;
  id_negociacion?: number | null;
  id_formulario?: number | null;
  id_pedido?: number | null;
}

export interface AccionAgente {
  id_accion: number;
  id_personal: number;
  personal_nombre?: string;
  id_negociacion?: number | null;
  id_buyer?: number | null;
  id_sesion_whatsapp?: number | null;
  accion: string;
  detalle?: string | null;
  resultado: 'EXITOSO' | 'FALLIDO' | 'PENDIENTE';
  fecha_ejecucion: string;
}

// Interfaces para Vistas SQL existentes
export interface VwKpiMensual {
  anio: number;
  mes: number;
  ciclos_lead: number;
  payers: number;
  perdidas: number;
  abiertas: number;
  tcp_horas: number | null;
  tasa_exito_ten: number | null;
  tasa_perdida_tpn: number | null;
}

export interface VwNegociacionDetalle {
  id_negociacion: number;
  id_persona: number;
  nro_ciclo: number;
  estado: EstadoNegociacion;
  motivo_perdida?: MotivoPerdida | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  fecha_primer_pago?: string | null;
  fecha_atencion?: string | null;
  tipo_lead: 'NUEVO' | 'RECURRENTE';
  horas_conversion?: number | null;
  id_segmento?: number | null;
  id_pedido?: number | null;
  id_promocion?: number | null;
  total_pedido?: number | null;
  id_medio_pago?: number | null;
  id_primer_pago?: number | null;
  estado_actual_primer_pago?: EstadoPago | null;
}

export interface VwPreferenciasPersona {
  id_persona: number;
  nombres: string;
  apellidos: string;
  id_segmento?: number | null;
  segmento?: string | null;
  fase_actual: FaseActual;
  id_producto_favorito?: number | null;
  producto_favorito_declarado?: string | null;
  producto_mas_comprado?: number | null;
  nombre_mas_comprado?: string | null;
  unidades_mas_comprado?: number | null;
  ciclos_convertidos: number;
  ciclos_perdidos: number;
}

export interface VwTopCortesSegmento {
  id_segmento?: number | null;
  segmento?: string | null;
  id_producto: number;
  corte: string;
  estilo?: string | null;
  peso_cantidad?: number | null;
  peso_unidad?: string | null;
  unidades_vendidas: number;
}

export interface VwTopProductosSegmento {
  id_segmento?: number | null;
  segmento?: string | null;
  id_producto: number;
  producto: string;
  categoria: CategoriaProducto;
  es_corte: boolean;
  peso_cantidad?: number | null;
  peso_unidad?: string | null;
  unidades_vendidas: number;
  pedidos: number;
}

export interface VwTopCombosSegmento {
  id_segmento?: number | null;
  segmento?: string | null;
  id_combo: number;
  combo: string;
  precio: number;
  unidades_vendidas: number;
  pedidos: number;
}

export interface VwPromosVigentes {
  id_promocion: number;
  nombre_promocion: string;
  descripcion: string;
  tipo_beneficio: TipoBeneficio;
  valor_beneficio?: number | null;
  dias_aplicables: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  id_segmento_objetivo?: number | null;
  segmento_objetivo?: string | null;
  id_producto?: number | null;
  id_combo?: number | null;
  categoria?: CategoriaProducto | null;
}

export interface VwPedidoSaldo {
  id_pedido: number;
  id_persona: number;
  id_negociacion: number;
  estado: EstadoPedido;
  total: number;
  pagado_confirmado: number;
  saldo_pendiente?: number | null;
}

export interface VwVecesFasePersona {
  id_persona: number;
  fase: FaseActual;
  veces: number;
  primera_vez: string;
  ultima_vez: string;
}

