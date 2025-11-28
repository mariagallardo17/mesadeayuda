
export interface ServiceCatalog {
  id?: number;
  requerimiento?: string;
  categoria: string;
  subcategoria: string;
  tiempoObjetivo: string;
  tiempoMaximo: string;
  prioridad: string;
  responsableInicial: string;
  escalamiento: string;
  motivoEscalamiento: string;
  sla?: string;
  activo: boolean;
  requiere_aprobacion?: boolean;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

export interface CreateServiceRequest {
  categoria: string;
  subcategoria: string;
  tiempoObjetivo: string;
  tiempoMaximo: string;
  prioridad: string;
  responsableInicial: string;
  escalamiento: string;
  motivoEscalamiento: string;
  nivelServicio?: string;
  requiere_aprobacion?: boolean;
}

export interface UpdateServiceRequest {
  categoria?: string;
  subcategoria?: string;
  tiempoObjetivo?: string;
  tiempoMaximo?: string;
  prioridad?: string;
  responsableInicial?: string;
  escalamiento?: string;
  motivoEscalamiento?: string;
  nivelServicio?: string;
  activo?: boolean;
  requiere_aprobacion?: boolean;
}

export interface ServiceCategory {
  categoria: string;
  subcategorias: string[];
  tiempoBase: string;
  escalamiento: string;
}

// Catálogo predefinido de servicios

