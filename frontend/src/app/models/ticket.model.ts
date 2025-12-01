export interface Ticket {
  id: number;
  titulo?: string;
  categoria: string;
  subcategoria: string;
  descripcion: string;
  tiempoEstimado: string; // Usa tiempo_maximo si existe, sino tiempo_objetivo
  tiempoObjetivo?: string; // Tiempo objetivo original del servicio
  tiempoMaximo?: string; // Tiempo máximo del servicio
  tiempoRestanteFinalizacion?: number | null; // Tiempo restante en segundos (calculado en backend)
  estado: string;
  prioridad: string;
  fechaCreacion: string;
  fechaActualizacion?: string;
  fechaCierre?: string;
  fechaFinalizacion?: string;
  fechaInicioAtencion?: string;
  tiempoAtencionSegundos?: number;
  tiempoReal?: number;
  usuarioId?: number;
  tecnicoId?: number;
  servicioId?: number;
  evaluacionId?: number;
  archivoAprobacion?: string; // Nombre del archivo adjunto
  tecnicoAsignado?: string | {
    nombre: string;
    correo: string;
  };
  pendienteMotivo?: string | null;
  pendienteTiempoEstimado?: string | null;
  pendienteActualizadoEn?: string | null;
  reapertura?: {
    id: number;
    observacionesUsuario: string;
    causaTecnico?: string | null;
    fechaReapertura?: string | null;
    fechaRespuestaTecnico?: string | null;
  } | null;
  mostrarEstadoReabierto?: boolean;
  // Información del countdown
  countdown?: {
    displayText: string;
    status: 'normal' | 'warning' | 'expired';
    isExpired: boolean;
    deadline?: string;
  };
  evaluacion?: {
    id?: number;
    calificacion: number;
    comentario: string;
    fechaEvaluacion: string;
  };
  usuario?: {
    nombre: string;
    correo: string;
  };
  evaluacionUltimoRecordatorio?: string;
  evaluacionRecordatorioContador?: number;
  evaluacionCierreAutomatico?: boolean;
  tecnico?: any;
  servicio?: any;
  enTiempo?: boolean | null; // true si fue resuelto en tiempo, false si fue tardío, null si no aplica
}

export interface Evaluation {
  id?: number;
  calificacion: number;
  comentario: string;
  fechaEvaluacion: string;
}

export interface CloseTicketRequest {
  ticketId: number;
  rating: number;
  comentarios: string;
}

export interface CloseTicketResponse {
  message: string;
  evaluation: {
    calificacion: number;
    comentario: string;
  };
}

export interface CreateTicketRequest {
  titulo: string;
  descripcion: string;
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  servicioId: number;
}


