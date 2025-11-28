import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiConfig } from '../config/api.config';

export interface ReportesSummary {
  ticketsSolicitados: number;
  ticketsAtendidos: number;
  ticketsAsignados: number;
  ticketsPendientes: number;
  ticketsSinCerrar: number;
  ticketsCerradosPorSistema: number;
  ticketsEscalados: number;
  ticketsTardios: number;
  ticketsReabiertos: number;
  evaluacionesTardias: number;
  satisfaccionPromedio: number;
  ticketsPorSemana: number[];
  mttrHoras: number;
  mttrMinutos: number;
  mttaMinutos: number;
  cumplimientoSLA: number;
  porcentajeActualizaciones: number;
  distribucionEvaluaciones?: { [key: number]: number };
}

export interface DistribucionEstado {
  estado: string;
  cantidad: number;
  porcentaje: number;
}

export interface DistribucionServicio {
  tipoServicio: string;
  total: number;
}

export interface RendimientoTecnico {
  idUsuario?: number;
  nombre: string;
  ticketsAsignados: number;
  ticketsResueltos: number;
  ticketsPendientes?: number;
  ticketsEscalados?: number;
  ticketsReabiertos?: number;
  ticketsFueraTiempo?: number;
  calificacionPromedio: number;
  // Mantener compatibilidad con campos antiguos
  ticketsAtendidos?: number;
  tiempoPromedioHoras?: number;
  satisfaccion?: number;
}

export interface ReportesResponse {
  summary: ReportesSummary;
  distribucionEstado: DistribucionEstado[];
  rendimientoTecnico: RendimientoTecnico[];
  distribucionServicio?: DistribucionServicio[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private apiUrl = `${ApiConfig.API_BASE_URL}/api/reports`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  getReportesSummary(fechaInicio?: string, fechaFin?: string): Observable<ReportesResponse> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    let url = `${this.apiUrl}/summary`;
    const params: string[] = [];

    // Solo agregar parámetros si las fechas tienen valor (no vacías ni undefined)
    if (fechaInicio && fechaInicio.trim() !== '') {
      params.push(`fechaInicio=${fechaInicio}`);
    }
    if (fechaFin && fechaFin.trim() !== '') {
      params.push(`fechaFin=${fechaFin}`);
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    console.log('📊 Obteniendo reportes desde:', url);
    console.log('📊 Parámetros de fecha - Inicio:', fechaInicio, 'Fin:', fechaFin);
    console.log('📊 URL final:', url);
    return this.http.get<ReportesResponse>(url, { headers });
  }

  getReportesPorPeriodo(periodo: 'hoy' | 'semana' | 'mes' | 'año'): Observable<ReportesResponse> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    const url = `${this.apiUrl}/period/${periodo}`;
    console.log('📊 Obteniendo reportes por período:', url);
    return this.http.get<ReportesResponse>(url, { headers });
  }
}

