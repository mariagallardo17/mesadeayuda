import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { Ticket, Evaluation, CloseTicketRequest, CloseTicketResponse } from '../models/ticket.model';
import { ApiConfig } from '../config/api.config';

// Re-exportar Ticket para que otros componentes puedan usarlo
export type { Ticket } from '../models/ticket.model';

export interface TicketResponse {
  id: number;
  categoria: string;
  subcategoria: string;
  descripcion: string;
  tiempoEstimado: string;
  estado: string;
  prioridad: string;
  fechaCreacion: string;
  fechaFinalizacion?: string;
  fechaCierre?: string;
  pendienteMotivo?: string | null;
  pendienteTiempoEstimado?: string | null;
  pendienteActualizadoEn?: string | null;
  archivoAprobacion?: string;
  tecnicoAsignado?: string;
  evaluacionUltimoRecordatorio?: string | null;
  evaluacionRecordatorioContador?: number;
  evaluacionCierreAutomatico?: boolean;
  evaluacion?: {
    calificacion: number;
    comentario: string;
    fechaEvaluacion: string;
  };
  usuario?: {
    nombre: string;
    correo: string;
  };
}

export interface CreateTicketRequest {
  categoria: string;
  subcategoria: string;
  descripcion: string;
  archivoAprobacion?: File;
}

export interface CreateTicketResponse {
  message: string;
  ticket: Ticket;
  asignacionAutomatica?: {
    exitosa: boolean;
    tecnico: string;
    area: string;
    nivel: string;
    fallback: boolean;
    prioridadFinal: {
      nivel: string;
      score: number;
      nivelOrganizacional: string;
      nivelTecnico: string;
    };
  };
}

export interface UpdateTicketStatusResponse {
  message: string;
  estatus: string;
  pendienteMotivo?: string | null;
  pendienteTiempoEstimado?: string | null;
  pendienteActualizadoEn?: string | null;
  reapertura?: Ticket['reapertura'] | null;
}

// Estas interfaces ya están definidas en ticket.model.ts

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private apiUrl = `${ApiConfig.API_BASE_URL}/tickets`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  createTicket(ticketData: CreateTicketRequest): Observable<CreateTicketResponse> {
    const formData = new FormData();
    formData.append('categoria', ticketData.categoria);
    formData.append('subcategoria', ticketData.subcategoria);
    formData.append('descripcion', ticketData.descripcion);

    if (ticketData.archivoAprobacion) {
      formData.append('archivoAprobacion', ticketData.archivoAprobacion);
    }

    // Obtener token de autenticación
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    console.log('🔑 Token enviado:', token ? 'SÍ' : 'NO');
    console.log('📤 Enviando petición a:', this.apiUrl);
    console.log('📋 Datos del ticket:', {
      categoria: ticketData.categoria,
      subcategoria: ticketData.subcategoria,
      descripcion: ticketData.descripcion
    });

    return this.http.post<CreateTicketResponse>(this.apiUrl, formData, { headers }).pipe(
      tap(response => {
        // Las notificaciones ahora se crean en el backend
        // El servicio de notificaciones las obtendrá automáticamente mediante polling
        // NO crear notificaciones localmente aquí para evitar duplicados y problemas de sincronización
        console.log('✅ Ticket creado, las notificaciones serán obtenidas del backend automáticamente');
      })
    );
  }

  getMyTickets(page: number = 1, limit: number = 10): Observable<{tickets: Ticket[], pagination: any}> {
    // Obtener token de autenticación
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    // Agregar parámetros de paginación
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    console.log('🔑 Token para getMyTickets:', token ? 'SÍ' : 'NO');
    console.log('📤 URL:', `${this.apiUrl}/my-tickets?page=${page}&limit=${limit}`);

    return this.http.get<{tickets: Ticket[], pagination: any}>(`${this.apiUrl}/my-tickets`, { headers, params });
  }


  escalateTicket(ticketId: number, escalateData: any): Observable<{message: string}> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.post<{message: string}>(`${this.apiUrl}/${ticketId}/escalate`, escalateData, { headers });
  }

  getTicketById(ticketId: number): Observable<Ticket> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.get<Ticket>(`${this.apiUrl}/${ticketId}`, { headers });
  }

  closeTicket(closeData: CloseTicketRequest): Observable<CloseTicketResponse> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.post<CloseTicketResponse>(`${this.apiUrl}/${closeData.ticketId}/close`, {
      rating: closeData.rating,
      comentarios: closeData.comentarios
    }, { headers });
  }

  getTechnicians(): Observable<any[]> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.get<any[]>(`${this.apiUrl}/technicians`, { headers });
  }

  // Evaluar un ticket
  evaluateTicket(ticketId: number, calificacion: number, comentario: string): Observable<{message: string}> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.post<{message: string}>(`${this.apiUrl}/${ticketId}/evaluate`, {
      calificacion,
      comentario
    }, { headers });
  }

  // Obtener evaluación de un ticket
  getTicketEvaluation(ticketId: number): Observable<Evaluation> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.get<Evaluation>(`${this.apiUrl}/${ticketId}/evaluation`, { headers });
  }

  getApprovalLetter(ticketId: number, disposition: 'inline' | 'attachment' = 'attachment'): Observable<Blob> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    const params = new HttpParams().set('disposition', disposition);

    return this.http.get(`${this.apiUrl}/${ticketId}/approval-letter`, {
      headers,
      params,
      responseType: 'blob'
    });
  }

  // Cerrar ticket con evaluación
  closeTicketWithEvaluation(closeData: CloseTicketRequest): Observable<CloseTicketResponse> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.post<CloseTicketResponse>(`${this.apiUrl}/${closeData.ticketId}/close`, {
      rating: closeData.rating,
      comentarios: closeData.comentarios
    }, { headers });
  }

  // Obtener tickets escalados (solo para administradores)
  getEscalatedTickets(page: number = 1, limit: number = 10): Observable<{tickets: any[], pagination: any}> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    // Agregar parámetros de paginación
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<{tickets: any[], pagination: any}>(`${this.apiUrl}/escalados`, { headers, params });
  }

  // Actualizar estado de un ticket (para administradores)
  updateTicketStatus(
    ticketId: number,
    nuevoEstado: string,
    options?: {
      comentarios?: string;
      motivo?: string;
      pendienteMotivo?: string;
      pendienteTiempoEstimado?: string;
    }
  ): Observable<UpdateTicketStatusResponse> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });

    const body = {
      nuevoEstado: nuevoEstado,
      ...(options?.comentarios ? { comentarios: options.comentarios } : {}),
      ...(options?.motivo ? { motivo: options.motivo } : {}),
      ...(options?.pendienteMotivo ? { pendienteMotivo: options.pendienteMotivo } : {}),
      ...(options?.pendienteTiempoEstimado ? { pendienteTiempoEstimado: options.pendienteTiempoEstimado } : {})
    };

    return this.http.put<UpdateTicketStatusResponse>(`${this.apiUrl}/${ticketId}/status`, body, { headers });
  }

  getReopenedTickets(page: number = 1, limit: number = 10): Observable<{tickets: Ticket[], pagination: any}> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    // Agregar parámetros de paginación
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<{tickets: Ticket[], pagination: any}>(`${this.apiUrl}/reopened`, { headers, params });
  }

  reopenTicket(ticketId: number, observaciones: string): Observable<UpdateTicketStatusResponse> {
    return this.updateTicketStatus(ticketId, 'Pendiente', {
      comentarios: observaciones
    });
  }

  registerReopenCause(ticketId: number, causa: string): Observable<{ message: string; reapertura: Ticket['reapertura'] | null; }> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.put<{ message: string; reapertura: Ticket['reapertura'] | null; }>(
      `${this.apiUrl}/${ticketId}/reopen/technician-comment`,
      { causa },
      { headers }
    );
  }

  // Verificar si el usuario tiene tickets pendientes de evaluación
  checkPendingEvaluationTickets(): Observable<{ hasPending: boolean; tickets?: Array<{ id: number; estado: string; fechaFinalizacion: string }> }> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.get<{ hasPending: boolean; tickets?: Array<{ id: number; estado: string; fechaFinalizacion: string }> }>(
      `${this.apiUrl}/check-pending-evaluation`,
      { headers }
    );
  }
}
