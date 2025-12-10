import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfig } from '../config/api.config';

export interface TechnicianSpecialty {
  id: number;
  usuario_id: number;
  area_especialidad: string;
  nivel_expertise: 'principal' | 'secundario' | 'soporte';
  activo: boolean;
  fecha_asignacion: string;
  fecha_modificacion: string;
  tecnico_nombre: string;
  tecnico_correo: string;
}

export interface AssignmentRule {
  id: number;
  servicio_id: number;
  area_servicio: string;
  prioridad_ticket: 'alta' | 'media' | 'baja';
  tecnico_principal_id: number | null;
  tecnico_secundario_id: number | null;
  tecnico_soporte_id: number | null;
  regla_asignacion: any;
  carga_maxima: number;
  activo: boolean;
  fecha_creacion: string;
  fecha_modificacion: string;
  categoria: string;
  subcategoria: string;
  tecnico_principal_nombre: string | null;
  tecnico_secundario_nombre: string | null;
  tecnico_soporte_nombre: string | null;
}

export interface AssignmentStats {
  area_servicio: string;
  prioridad_ticket: string;
  reglas_activas: number;
  tecnico_principal: string | null;
  tecnico_secundario: string | null;
}

export interface TechnicianWorkload {
  id_usuario: number;
  nombre: string;
  tickets_activos: number;
  tickets_abiertos: number;
  tickets_proceso: number;
  tickets_pendientes: number;
}

export interface AssignmentTestResult {
  success: boolean;
  tecnico?: {
    id: number;
    nombre: string;
    area: string;
    nivel: string;
  };
  fallback?: boolean;
  general?: boolean;
  areaServicio?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AssignmentService {
  private apiUrl = `${ApiConfig.API_BASE_URL}/assignments`;

  constructor(private http: HttpClient) {}

  // =====================================================
  // ESPECIALIDADES DE TÉCNICOS
  // =====================================================

  /**
   * Obtener todas las especialidades de técnicos
   */
  getTechnicianSpecialties(): Observable<TechnicianSpecialty[]> {
    return this.http.get<TechnicianSpecialty[]>(`${this.apiUrl}/specialties`);
  }

  /**
   * Crear nueva especialidad
   */
  createSpecialty(specialty: Partial<TechnicianSpecialty>): Observable<{message: string, specialty: TechnicianSpecialty}> {
    return this.http.post<{message: string, specialty: TechnicianSpecialty}>(`${this.apiUrl}/specialties`, specialty);
  }

  /**
   * Actualizar especialidad
   */
  updateSpecialty(id: number, updates: Partial<TechnicianSpecialty>): Observable<TechnicianSpecialty> {
    return this.http.put<TechnicianSpecialty>(`${this.apiUrl}/specialties/${id}`, updates);
  }

  // =====================================================
  // REGLAS DE ASIGNACIÓN
  // =====================================================

  /**
   * Obtener todas las reglas de asignación
   */
  getAssignmentRules(): Observable<AssignmentRule[]> {
    return this.http.get<AssignmentRule[]>(`${this.apiUrl}/rules`);
  }

  /**
   * Crear nueva regla de asignación
   */
  createAssignmentRule(rule: Partial<AssignmentRule>): Observable<{message: string, rule: AssignmentRule}> {
    return this.http.post<{message: string, rule: AssignmentRule}>(`${this.apiUrl}/rules`, rule);
  }

  /**
   * Actualizar regla de asignación
   */
  updateAssignmentRule(id: number, updates: Partial<AssignmentRule>): Observable<{message: string}> {
    return this.http.put<{message: string}>(`${this.apiUrl}/rules/${id}`, updates);
  }

  // =====================================================
  // ESTADÍSTICAS Y MONITOREO
  // =====================================================

  /**
   * Obtener estadísticas de asignaciones
   */
  getAssignmentStats(): Observable<AssignmentStats[]> {
    return this.http.get<AssignmentStats[]>(`${this.apiUrl}/stats`);
  }

  /**
   * Obtener carga de trabajo de técnicos
   */
  getTechnicianWorkload(): Observable<TechnicianWorkload[]> {
    return this.http.get<TechnicianWorkload[]>(`${this.apiUrl}/workload`);
  }

  /**
   * Probar asignación automática
   */
  testAssignment(servicioId: number, prioridad: string = 'media'): Observable<AssignmentTestResult> {
    return this.http.post<AssignmentTestResult>(`${this.apiUrl}/test-assignment`, {
      servicio_id: servicioId,
      prioridad: prioridad
    });
  }

  // =====================================================
  // MÉTODOS AUXILIARES
  // =====================================================

  /**
   * Obtener áreas de especialización disponibles
   */
  getAvailableAreas(): string[] {
    return [
      'INTERNET',
      'TELEFONIA_IP',
      'EQUIPO_COMPUTO',
      'CORREO',
      'SOFTWARE',
      'RED',
      'GENERAL'
    ];
  }

  /**
   * Obtener niveles de expertise disponibles
   */
  getAvailableExpertiseLevels(): string[] {
    return ['principal', 'secundario', 'soporte'];
  }

  /**
   * Obtener prioridades disponibles
   */
  getAvailablePriorities(): string[] {
    return ['alta', 'media', 'baja'];
  }

  /**
   * Formatear área para mostrar
   */
  formatAreaForDisplay(area: string): string {
    const areaMap: {[key: string]: string} = {
      'INTERNET': 'Internet y Conectividad',
      'TELEFONIA_IP': 'Telefonía IP',
      'EQUIPO_COMPUTO': 'Equipo de Cómputo',
      'CORREO': 'Correo Electrónico',
      'SOFTWARE': 'Software y Aplicaciones',
      'RED': 'Red y Infraestructura',
      'GENERAL': 'General'
    };
    return areaMap[area] || area;
  }

  /**
   * Formatear nivel de expertise para mostrar
   */
  formatExpertiseForDisplay(level: string): string {
    const levelMap: {[key: string]: string} = {
      'principal': 'Principal',
      'secundario': 'Secundario',
      'soporte': 'Soporte'
    };
    return levelMap[level] || level;
  }

  /**
   * Formatear prioridad para mostrar
   */
  formatPriorityForDisplay(priority: string): string {
    const priorityMap: {[key: string]: string} = {
      'alta': 'Alta',
      'media': 'Media',
      'baja': 'Baja'
    };
    return priorityMap[priority] || priority;
  }

  /**
   * Obtener color para nivel de expertise
   */
  getExpertiseColor(level: string): string {
    const colorMap: {[key: string]: string} = {
      'principal': '#28a745', // Verde
      'secundario': '#ffc107', // Amarillo
      'soporte': '#17a2b8'  // Azul
    };
    return colorMap[level] || '#6c757d'; // Gris por defecto
  }

  /**
   * Obtener color para prioridad
   */
  getPriorityColor(priority: string): string {
    const colorMap: {[key: string]: string} = {
      'alta': '#dc3545', // Rojo
      'media': '#ffc107', // Amarillo
      'baja': '#28a745'  // Verde
    };
    return colorMap[priority] || '#6c757d'; // Gris por defecto
  }
}
