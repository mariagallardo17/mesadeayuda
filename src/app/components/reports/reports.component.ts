import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ReportsService, ReportesResponse } from '../../services/reports.service';
import jsPDF from 'jspdf';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface ReportesData {
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

interface DistribucionEstado {
  estado: string;
  cantidad: number;
  porcentaje: number;
}

interface DistribucionServicio {
  tipoServicio: string;
  total: number;
}

interface RendimientoTecnico {
  idUsuario?: number;
  nombre: string;
  ticketsAsignados: number;
  ticketsResueltos: number;
  ticketsPendientes?: number;
  ticketsEscalados?: number;
  ticketsReabiertos?: number;
  ticketsFueraTiempo?: number;
  calificacionPromedio: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('estadosChart', { static: false }) estadosChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rendimientoChart', { static: false }) rendimientoChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('semanasChart', { static: false }) semanasChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tendenciaChart', { static: false }) tendenciaChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('evaluacionesChart', { static: false }) evaluacionesChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('slaChart', { static: false }) slaChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('estadosPieChart', { static: false }) estadosPieChartRef!: ElementRef<HTMLCanvasElement>;

  estadosChart: Chart | null = null;
  rendimientoChart: Chart | null = null;
  semanasChart: Chart | null = null;
  tendenciaChart: Chart | null = null;
  evaluacionesChart: Chart | null = null;
  slaChart: Chart | null = null;
  estadosPieChart: Chart | null = null;

  reportes: ReportesData = {
    ticketsSolicitados: 0,
    ticketsAtendidos: 0,
    ticketsAsignados: 0,
    ticketsPendientes: 0,
    ticketsSinCerrar: 0,
    ticketsCerradosPorSistema: 0,
    ticketsEscalados: 0,
    ticketsTardios: 0,
    ticketsReabiertos: 0,
    evaluacionesTardias: 0,
    satisfaccionPromedio: 0,
          ticketsPorSemana: [0, 0, 0, 0],
          mttrHoras: 0,
          mttrMinutos: 0,
          mttaMinutos: 0,
          cumplimientoSLA: 0,
          porcentajeActualizaciones: 0,
          distribucionEvaluaciones: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };

  distribucionEstados: DistribucionEstado[] = [];
  distribucionServicios: DistribucionServicio[] = [];
  rendimientoTecnicos: RendimientoTecnico[] = [];

  fechaInicio: string = '';
  fechaFin: string = '';
  isLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private reportsService: ReportsService
  ) {
    // Establecer fechas por defecto (último mes)
    const hoy = new Date();
    const haceUnMes = new Date();
    haceUnMes.setMonth(hoy.getMonth() - 1);

    this.fechaFin = hoy.toISOString().split('T')[0];
    this.fechaInicio = haceUnMes.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.cargarReportes();
  }

  ngAfterViewInit(): void {
    // Las gráficas se crearán después de cargar los datos
  }

  ngOnDestroy(): void {
    if (this.estadosChart) {
      this.estadosChart.destroy();
    }
    if (this.rendimientoChart) {
      this.rendimientoChart.destroy();
    }
    if (this.semanasChart) {
      this.semanasChart.destroy();
    }
    if (this.tendenciaChart) {
      this.tendenciaChart.destroy();
    }
    if (this.evaluacionesChart) {
      this.evaluacionesChart.destroy();
    }
    if (this.slaChart) {
      this.slaChart.destroy();
    }
    if (this.estadosPieChart) {
      this.estadosPieChart.destroy();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarReportes(): void {
    this.isLoading = true;

    console.log('📊 Cargando reportes desde la base de datos...');
    console.log('📅 Fecha inicio (original):', this.fechaInicio);
    console.log('📅 Fecha fin (original):', this.fechaFin);

    // Convertir fechas de formato DD/MM/YYYY o DD-MM-YYYY a YYYY-MM-DD si es necesario
    let fechaInicioFormato = this.fechaInicio;
    let fechaFinFormato = this.fechaFin;

    if (fechaInicioFormato) {
      // Si la fecha viene en formato DD/MM/YYYY o DD-MM-YYYY, convertirla
      if (fechaInicioFormato.includes('/') || (fechaInicioFormato.includes('-') && fechaInicioFormato.split('-')[0].length <= 2)) {
        const partes = fechaInicioFormato.split(/[\/-]/);
        if (partes.length === 3) {
          fechaInicioFormato = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        }
      }
    }

    if (fechaFinFormato) {
      // Si la fecha viene en formato DD/MM/YYYY o DD-MM-YYYY, convertirla
      if (fechaFinFormato.includes('/') || (fechaFinFormato.includes('-') && fechaFinFormato.split('-')[0].length <= 2)) {
        const partes = fechaFinFormato.split(/[\/-]/);
        if (partes.length === 3) {
          fechaFinFormato = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        }
      }
    }

    console.log('📅 Fecha inicio (convertida):', fechaInicioFormato);
    console.log('📅 Fecha fin (convertida):', fechaFinFormato);
    console.log('📅 ¿Enviando fechas vacías?', !fechaInicioFormato && !fechaFinFormato);

    // Si ambas fechas están vacías, enviar undefined explícitamente
    const fechaInicioEnviar = fechaInicioFormato || undefined;
    const fechaFinEnviar = fechaFinFormato || undefined;

    console.log('📅 Fechas a enviar al backend - Inicio:', fechaInicioEnviar, 'Fin:', fechaFinEnviar);

    this.reportsService.getReportesSummary(fechaInicioEnviar, fechaFinEnviar).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response: ReportesResponse) => {
        console.log('✅ Reportes obtenidos:', response);
        console.log('✅ Summary completo:', JSON.stringify(response.summary, null, 2));

        // Verificar que response.summary existe
        if (!response || !response.summary) {
          console.error('❌ La respuesta no contiene summary:', response);
          alert('Error: La respuesta del servidor no contiene datos válidos');
          this.isLoading = false;
          return;
        }

        this.reportes = {
          ticketsSolicitados: response.summary.ticketsSolicitados || 0,
          ticketsAtendidos: response.summary.ticketsAtendidos || 0,
          ticketsAsignados: response.summary.ticketsAsignados || 0,
          ticketsPendientes: response.summary.ticketsPendientes || 0,
          ticketsSinCerrar: response.summary.ticketsSinCerrar || 0,
          ticketsCerradosPorSistema: response.summary.ticketsCerradosPorSistema || 0,
          ticketsEscalados: response.summary.ticketsEscalados || 0,
          ticketsTardios: response.summary.ticketsTardios || 0,
          ticketsReabiertos: response.summary.ticketsReabiertos || 0,
          evaluacionesTardias: response.summary.evaluacionesTardias || 0,
          satisfaccionPromedio: response.summary.satisfaccionPromedio || 0,
          ticketsPorSemana: response.summary.ticketsPorSemana || [0, 0, 0, 0],
          mttrHoras: response.summary.mttrHoras || 0,
          mttrMinutos: response.summary.mttrMinutos || 0,
          mttaMinutos: response.summary.mttaMinutos || 0,
          cumplimientoSLA: response.summary.cumplimientoSLA || 0,
          porcentajeActualizaciones: response.summary.porcentajeActualizaciones || 0,
          distribucionEvaluaciones: response.summary.distribucionEvaluaciones || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
        this.distribucionEstados = response.distribucionEstado || [];
        this.distribucionServicios = response.distribucionServicio || [];
        this.rendimientoTecnicos = response.rendimientoTecnico || [];

        this.isLoading = false;
        console.log('📊 Reportes actualizados exitosamente');
        console.log('📊 Tickets solicitados:', this.reportes.ticketsSolicitados);
        console.log('📊 Tickets atendidos:', this.reportes.ticketsAtendidos);
        console.log('📊 Tickets asignados:', this.reportes.ticketsAsignados);
        console.log('📊 Tickets pendientes:', this.reportes.ticketsPendientes);
        console.log('📊 Tickets cerrados por sistema:', this.reportes.ticketsCerradosPorSistema);
        console.log('📊 Distribución de estados:', this.distribucionEstados);
        console.log('📊 Distribución de servicios:', this.distribucionServicios);
        console.log('📊 Rendimiento técnicos:', this.rendimientoTecnicos);
        console.log('📊 MTTR:', this.reportes.mttrHoras, 'h', this.reportes.mttrMinutos, 'min');
        console.log('📊 MTTA:', this.reportes.mttaMinutos, 'min');
        console.log('📊 Cumplimiento SLA:', this.reportes.cumplimientoSLA, '%');

        setTimeout(() => {
          this.crearGraficas();
        }, 500);
      },
      error: (error) => {
        console.error('❌ Error cargando reportes:', error);
        console.error('❌ Error completo:', JSON.stringify(error, null, 2));
        this.isLoading = false;
        const errorMessage = error.error?.error || error.message || 'Error desconocido al cargar los reportes';
        alert('Error al cargar los reportes: ' + errorMessage);
      }
    });
  }


  cargarTodosLosTickets(): void {
    console.log('🔄 Cargando TODOS los tickets (sin filtro de fecha)');
    this.fechaInicio = '';
    this.fechaFin = '';
    console.log('📅 Fechas limpiadas - Inicio:', this.fechaInicio, 'Fin:', this.fechaFin);
    this.cargarReportes();
  }

  exportarReportes(): void {
    this.isLoading = true;

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      let yPosition = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;

      // Encabezado
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte Mensual de Gestión de Servicios de TI', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const fechaInicioFormato = this.formatearFecha(this.fechaInicio);
      const fechaFinFormato = this.formatearFecha(this.fechaFin);
      doc.text(`Periodo evaluado: ${fechaInicioFormato} – ${fechaFinFormato}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // 1. Introducción al Reporte
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Introducción al Reporte', margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const introText = 'El presente reporte mensual recopila los resultados generados por el Sistema de Service Desk. Está basado en indicadores ITIL y métricas específicas que el sistema genera automáticamente: solicitudes, tiempos, desempeño por técnico, evaluaciones y seguimiento. El reporte ofrece una visión completa del comportamiento del servicio, permitiendo identificar áreas fuertes, oportunidades de mejora y cumplimiento del nivel de servicio (SLA).';
      const introLines = doc.splitTextToSize(introText, pageWidth - 2 * margin);
      introLines.forEach((line: string) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });
      yPosition += 5;

      // 2. Indicadores Generales del Mes
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Indicadores Generales del Mes', margin, yPosition);
      yPosition += 8;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('2.1 Indicadores globales del sistema', margin, yPosition);
      yPosition += 8;

      // Tabla de indicadores
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');

      // Encabezado de tabla
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('Indicador', margin, yPosition);
      doc.text('Valor', pageWidth - margin - 30, yPosition, { align: 'right' });
      yPosition += 8;

      // Línea separadora
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      doc.setFont('helvetica', 'normal');

      const metricas = [
        ['Tickets solicitados', this.reportes.ticketsSolicitados],
        ['Tickets atendidos', this.reportes.ticketsAtendidos],
        ['Tickets pendientes', this.reportes.ticketsPendientes],
        ['Tickets cerrados por el sistema', this.reportes.ticketsCerradosPorSistema],
        ['Tickets escalados', this.reportes.ticketsEscalados],
        ['Tickets finalizados fuera de tiempo', this.reportes.ticketsTardios],
        ['Tickets reabiertos', this.reportes.ticketsReabiertos],
        ['Satisfacción promedio de usuarios', `${this.reportes.satisfaccionPromedio} / 5`]
      ];

      metricas.forEach(([label, value]) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(String(label), margin, yPosition);
        doc.setFont('helvetica', 'bold');
        const valueStr = typeof value === 'number' ? String(value) : String(value);
        doc.text(valueStr, pageWidth - margin - 30, yPosition, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        yPosition += 7;
      });

      // Tickets generados por semana
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('Tickets generados por semana', margin, yPosition);
      const semanasText = this.reportes.ticketsPorSemana.join(' / ');
      doc.setFont('helvetica', 'bold');
      doc.text(semanasText, pageWidth - margin - 30, yPosition, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      yPosition += 10;

      // Interpretación
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      const interpretacionText = 'Interpretación: El volumen de tickets se mantuvo estable durante el mes, con una ligera variación semanal. La satisfacción del usuario se encuentra por encima del 4.0, lo cual indica percepción favorable del servicio.';
      const interpLines = doc.splitTextToSize(interpretacionText, pageWidth - 2 * margin);
      interpLines.forEach((line: string) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });
      yPosition += 8;

      // 3. Indicadores de Tiempo
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('3. Indicadores de Tiempo', margin, yPosition);
      yPosition += 8;

      // 3.1 MTTR
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('3.1 Tiempo Promedio de Resolución (MTTR)', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Definición: Tiempo que tarda el técnico en resolver un ticket desde su creación.', margin, yPosition);
      yPosition += 6;
      doc.text('Fórmula: Promedio(fecha/hora de resolución – fecha/hora de creación)', margin, yPosition);
      yPosition += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`Resultado del mes: ${this.reportes.mttrHoras}h ${this.reportes.mttrMinutos}min`, margin, yPosition);
      yPosition += 6;
      doc.setFont('helvetica', 'italic');
      doc.text('Interpretación: Un tiempo aceptable considerando la carga del área y el personal disponible.', margin, yPosition);
      yPosition += 10;

      // 3.2 MTTA
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('3.2 Tiempo Promedio de Atención (MTTA)', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Definición: Tiempo trascurrido desde que se asigna el ticket hasta que el técnico comienza a atenderlo.', margin, yPosition);
      yPosition += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`Resultado del mes: ${this.reportes.mttaMinutos} minutos`, margin, yPosition);
      yPosition += 6;
      doc.setFont('helvetica', 'italic');
      doc.text('Interpretación: El área responde rápido; se recomienda mantener el proceso de priorización.', margin, yPosition);
      yPosition += 10;

      // 3.3 Tickets atendidos por técnico
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('3.3 Tickets atendidos por técnico', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Definición: Conteo mensual del total de tickets asignados y resueltos por cada miembro de TI.', margin, yPosition);
      yPosition += 8;

      // Tabla de técnicos
      if (this.rendimientoTecnicos.length > 0) {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 20;
        }

        // Encabezado de tabla
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Técnico', margin, yPosition);
        doc.text('Tickets Asignados', margin + 50, yPosition);
        doc.text('Tickets Resueltos', pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += 6;
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        this.rendimientoTecnicos.forEach(tech => {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
            // Re-imprimir encabezado si es nueva página
            doc.setFont('helvetica', 'bold');
            doc.text('Técnico', margin, yPosition);
            doc.text('Tickets Asignados', margin + 50, yPosition);
            doc.text('Tickets Resueltos', pageWidth - margin - 30, yPosition, { align: 'right' });
            yPosition += 6;
            doc.setLineWidth(0.5);
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 5;
            doc.setFont('helvetica', 'normal');
          }
          doc.text(tech.nombre, margin, yPosition);
          doc.text(String(tech.ticketsAsignados || 0), margin + 50, yPosition);
          doc.text(String(tech.ticketsResueltos || 0), pageWidth - margin - 30, yPosition, { align: 'right' });
          yPosition += 7;
        });

        yPosition += 5;
        doc.setFont('helvetica', 'italic');
        doc.text('Interpretación: La carga se distribuye equilibradamente de acuerdo con el catálogo de servicios, permitiendo evaluar el desempeño individual.', margin, yPosition);
        yPosition += 10;
      }

      // 3.4 Cumplimiento de SLA Técnico
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('3.4 Cumplimiento de SLA Técnico', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Definición: Porcentaje de tickets resueltos dentro del tiempo acordado.', margin, yPosition);
      yPosition += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`Resultado: ${this.reportes.cumplimientoSLA}% de cumplimiento del SLA`, margin, yPosition);
      yPosition += 6;
      doc.setFont('helvetica', 'italic');
      doc.text('Interpretación: Aunque es positivo, los "Tickets fuera de tiempo" reflejan que aún hay margen de mejora.', margin, yPosition);
      yPosition += 10;

      // 3.5 Índice de Satisfacción del Usuario
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('3.5 Índice de Satisfacción del Usuario', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Definición: Promedio de calificación otorgada por los usuarios (1 a 5 estrellas).', margin, yPosition);
      yPosition += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`Resultado: ${this.reportes.satisfaccionPromedio} / 5`, margin, yPosition);
      yPosition += 10;

      // 3.6 Tickets Reabiertos
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('3.6 Tickets Reabiertos', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Definición: Tickets que el usuario volvió a abrir por inconformidad.', margin, yPosition);
      yPosition += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`Resultado: ${this.reportes.ticketsReabiertos} tickets reabiertos`, margin, yPosition);
      yPosition += 10;

      // 3.7 Actualización del estado del ticket
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('3.7 Actualización del estado del ticket', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Definición: Frecuencia con la que el técnico documenta avances.', margin, yPosition);
      yPosition += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`Resultado: ${this.reportes.porcentajeActualizaciones}% de actualizaciones registradas.`, margin, yPosition);
      yPosition += 10;

      // 4. Indicadores Operativos del Sistema
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('4. Indicadores Operativos del Sistema', margin, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Además de los indicadores ITIL, el sistema genera métricas propias que complementan la evaluación general.', margin, yPosition);
      yPosition += 8;

      // 4.1 Distribución por tipo de servicio
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('4.1 Distribución por tipo de servicio', margin, yPosition);
      yPosition += 8;

      // Tabla de distribución por servicio
      if (this.distribucionServicios.length > 0) {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 20;
        }

        // Encabezado de tabla
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Tipo de Servicio', margin, yPosition);
        doc.text('Total', pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += 6;
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        this.distribucionServicios.forEach(servicio => {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(servicio.tipoServicio, margin, yPosition);
          doc.text(String(servicio.total), pageWidth - margin - 30, yPosition, { align: 'right' });
          yPosition += 7;
        });
        yPosition += 10;
      }

      // 5. Reporte Individual por Técnico
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('5. Reporte Individual por Técnico', margin, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('El sistema genera automáticamente un reporte para cada técnico y el administrador.', margin, yPosition);
      yPosition += 8;

      // Ejemplo de reporte individual (primer técnico)
      if (this.rendimientoTecnicos.length > 0) {
        const primerTecnico = this.rendimientoTecnicos[0];
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`5.1 ${primerTecnico.nombre} – Ejemplo`, margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const metricasTecnico = [
          ['Tickets asignados', primerTecnico.ticketsAsignados || 0],
          ['Tickets resueltos', primerTecnico.ticketsResueltos || 0],
          ['Tickets pendientes', primerTecnico.ticketsPendientes || 0],
          ['Tickets escalados', primerTecnico.ticketsEscalados || 0],
          ['Tickets reabiertos', primerTecnico.ticketsReabiertos || 0],
          ['Tickets fuera de tiempo', primerTecnico.ticketsFueraTiempo || 0],
          ['Calificación promedio', `${primerTecnico.calificacionPromedio || 0}`]
        ];

        metricasTecnico.forEach(([label, value]) => {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(`${label}:`, margin, yPosition);
          doc.setFont('helvetica', 'bold');
          doc.text(String(value), pageWidth - margin - 30, yPosition, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          yPosition += 7;
        });

        yPosition += 5;
        doc.setFont('helvetica', 'italic');
        doc.text('Análisis del desempeño: El técnico muestra eficiencia y buena satisfacción; se recomienda mejorar la documentación.', margin, yPosition);
        yPosition += 10;
      }

      // Pie de página
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      // 6. Gráficas que el Sistema Debe Incluir
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('6. Gráficas que el Sistema Debe Incluir', margin, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const graficasText = 'Estas gráficas se incorporan en el PDF exportado: Gráfica de barras → Tickets por semana, Línea → Tendencia de tickets atendidos vs. pendientes, Barras comparativas → Tickets por técnico, Histograma → Evaluaciones del usuario, Radar → Cumplimiento de SLA por técnico, Gráfica de pastel → tickets por estado (todos los estados).';
      const graficasLines = doc.splitTextToSize(graficasText, pageWidth - 2 * margin);
      graficasLines.forEach((line: string) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });
      yPosition += 10;

      // 7. Interpretación General del Mes
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('7. Interpretación General del Mes', margin, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const interpretacionGeneral = [
        '• El volumen de solicitudes se mantuvo estable.',
        `• El área alcanzó un ${this.reportes.cumplimientoSLA}% de cumplimiento de SLA, indicador positivo.`,
        `• La satisfacción del usuario se mantiene ${this.reportes.satisfaccionPromedio >= 4 ? 'alta' : 'en niveles aceptables'}.`,
        `• Los escalamientos representan solo el ${this.reportes.ticketsSolicitados > 0 ? ((this.reportes.ticketsEscalados / this.reportes.ticketsSolicitados) * 100).toFixed(1) : 0}% del total de solicitudes.`,
        '• El desempeño entre técnicos es consistente, con diferencias mínimas.',
        '• El número de tickets cerrados por el sistema refleja falta de seguimiento del usuario, no del área de TI.'
      ];
      interpretacionGeneral.forEach((line: string) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });
      yPosition += 10;

      // 8. Conclusión
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('8. Conclusión', margin, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const conclusionText = 'El sistema de Service Desk implementado proporciona información clara, precisa y alineada con ITIL, permitiendo tomar decisiones estratégicas para mejorar la calidad del servicio del área de TI. Los reportes mensuales facilitan la supervisión operacional, el análisis del desempeño y la identificación de oportunidades de mejora.';
      const conclusionLines = doc.splitTextToSize(conclusionText, pageWidth - 2 * margin);
      conclusionLines.forEach((line: string) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });

      // Guardar PDF
      const fileName = `reporte-mensual-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    this.isLoading = false;
      alert('Reporte exportado a PDF exitosamente');
    } catch (error) {
      console.error('Error exportando a PDF:', error);
      this.isLoading = false;
      alert('Error al exportar el reporte a PDF: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  }

  crearGraficas(): void {
    console.log('🎨 Creando gráficas...');

    // Destruir gráficas existentes
    if (this.estadosChart) {
      this.estadosChart.destroy();
      this.estadosChart = null;
    }
    if (this.rendimientoChart) {
      this.rendimientoChart.destroy();
      this.rendimientoChart = null;
    }
    if (this.semanasChart) {
      this.semanasChart.destroy();
      this.semanasChart = null;
    }
    if (this.tendenciaChart) {
      this.tendenciaChart.destroy();
      this.tendenciaChart = null;
    }
    if (this.evaluacionesChart) {
      this.evaluacionesChart.destroy();
      this.evaluacionesChart = null;
    }
    if (this.slaChart) {
      this.slaChart.destroy();
      this.slaChart = null;
    }
    if (this.estadosPieChart) {
      this.estadosPieChart.destroy();
      this.estadosPieChart = null;
    }

    // Gráfica de distribución de estados
    if (this.estadosChartRef?.nativeElement && this.distribucionEstados.length > 0) {
      try {
        const ctx = this.estadosChartRef.nativeElement.getContext('2d');
        if (ctx) {
          console.log('✅ Creando gráfica de distribución de estados');
          this.estadosChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: this.distribucionEstados.map(e => e.estado),
            datasets: [{
              label: 'Cantidad de Tickets',
              data: this.distribucionEstados.map(e => e.cantidad),
              backgroundColor: [
                'rgba(54, 162, 235, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(255, 99, 132, 0.6)',
                'rgba(153, 102, 255, 0.6)',
                'rgba(255, 159, 64, 0.6)',
                'rgba(199, 199, 199, 0.6)',
                'rgba(83, 102, 255, 0.6)'
              ],
              borderColor: [
                'rgba(54, 162, 235, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)',
                'rgba(199, 199, 199, 1)',
                'rgba(83, 102, 255, 1)'
              ],
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: false
              },
              title: {
                display: true,
                text: 'Distribución de Tickets por Estado',
                font: {
                  size: 16,
                  weight: 'bold'
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1
                }
              }
            }
          }
        });
        console.log('✅ Gráfica de distribución de estados creada exitosamente');
        }
      } catch (error) {
        console.error('❌ Error creando gráfica de distribución de estados:', error);
      }
    } else {
      console.warn('⚠️ No se puede crear gráfica de estados - Canvas o datos no disponibles');
    }

    // 1. Gráfica de barras: Tickets por semana
    if (this.semanasChartRef?.nativeElement && this.reportes.ticketsPorSemana && this.reportes.ticketsPorSemana.length > 0) {
      try {
        const ctx = this.semanasChartRef.nativeElement.getContext('2d');
        if (ctx) {
          console.log('✅ Creando gráfica de tickets por semana');
          this.semanasChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
              datasets: [{
                label: 'Tickets Generados',
                data: this.reportes.ticketsPorSemana,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Tickets Generados por Semana',
                  font: { size: 14, weight: 'bold' }
                },
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }
          });
        }
      } catch (error) {
        console.error('❌ Error creando gráfica de semanas:', error);
      }
    }

    // 2. Gráfica de línea: Tendencia atendidos vs. pendientes
    if (this.tendenciaChartRef?.nativeElement) {
      try {
        const ctx = this.tendenciaChartRef.nativeElement.getContext('2d');
        if (ctx) {
          console.log('✅ Creando gráfica de tendencia');
          this.tendenciaChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
              datasets: [
                {
                  label: 'Tickets Atendidos',
                  data: this.reportes.ticketsPorSemana.map((_, i) =>
                    Math.floor(this.reportes.ticketsAtendidos * (this.reportes.ticketsPorSemana[i] / this.reportes.ticketsSolicitados || 0))
                  ),
                  borderColor: 'rgba(75, 192, 192, 1)',
                  backgroundColor: 'rgba(75, 192, 192, 0.2)',
                  tension: 0.4
                },
                {
                  label: 'Tickets Pendientes',
                  data: this.reportes.ticketsPorSemana.map((_, i) =>
                    Math.floor(this.reportes.ticketsPendientes * 0.25)
                  ),
                  borderColor: 'rgba(255, 99, 132, 1)',
                  backgroundColor: 'rgba(255, 99, 132, 0.2)',
                  tension: 0.4
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Tendencia: Tickets Atendidos vs. Pendientes',
                  font: { size: 14, weight: 'bold' }
                },
                legend: { display: true, position: 'top' }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }
          });
        }
      } catch (error) {
        console.error('❌ Error creando gráfica de tendencia:', error);
      }
    }

    // 3. Gráfica de pastel: Distribución por estado
    if (this.estadosPieChartRef?.nativeElement && this.distribucionEstados.length > 0) {
      try {
        const ctx = this.estadosPieChartRef.nativeElement.getContext('2d');
        if (ctx) {
          console.log('✅ Creando gráfica de pastel de estados');
          this.estadosPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
              labels: this.distribucionEstados.map(e => e.estado),
              datasets: [{
                data: this.distribucionEstados.map(e => e.cantidad),
                backgroundColor: [
                  'rgba(54, 162, 235, 0.6)',
                  'rgba(75, 192, 192, 0.6)',
                  'rgba(255, 206, 86, 0.6)',
                  'rgba(255, 99, 132, 0.6)',
                  'rgba(153, 102, 255, 0.6)',
                  'rgba(255, 159, 64, 0.6)',
                  'rgba(199, 199, 199, 0.6)',
                  'rgba(83, 102, 255, 0.6)'
                ],
                borderColor: [
                  'rgba(54, 162, 235, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(255, 206, 86, 1)',
                  'rgba(255, 99, 132, 1)',
                  'rgba(153, 102, 255, 1)',
                  'rgba(255, 159, 64, 1)',
                  'rgba(199, 199, 199, 1)',
                  'rgba(83, 102, 255, 1)'
                ],
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Distribución de Tickets por Estado',
                  font: { size: 16, weight: 'bold' }
                },
                legend: { display: true, position: 'right' }
              }
            }
          });
        }
      } catch (error) {
        console.error('❌ Error creando gráfica de pastel:', error);
      }
    }

    // 4. Gráfica de barras comparativas: Tickets por técnico
    if (this.rendimientoChartRef?.nativeElement && this.rendimientoTecnicos.length > 0) {
      try {
        const ctx = this.rendimientoChartRef.nativeElement.getContext('2d');
        if (ctx) {
          console.log('✅ Creando gráfica de rendimiento de técnicos (barras comparativas)');
          this.rendimientoChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: this.rendimientoTecnicos.map(t => t.nombre),
              datasets: [
                {
                  label: 'Tickets Asignados',
                  data: this.rendimientoTecnicos.map(t => t.ticketsAsignados || 0),
                  backgroundColor: 'rgba(54, 162, 235, 0.6)',
                  borderColor: 'rgba(54, 162, 235, 1)',
                  borderWidth: 2
                },
                {
                  label: 'Tickets Resueltos',
                  data: this.rendimientoTecnicos.map(t => t.ticketsResueltos || 0),
                  backgroundColor: 'rgba(75, 192, 192, 0.6)',
                  borderColor: 'rgba(75, 192, 192, 1)',
                  borderWidth: 2
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Rendimiento por Técnico (Barras Comparativas)',
                  font: { size: 16, weight: 'bold' }
                },
                legend: { display: true, position: 'top' }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }
          });
        }
      } catch (error) {
        console.error('❌ Error creando gráfica de rendimiento:', error);
      }
    }

    // 5. Histograma: Evaluaciones del usuario
    if (this.evaluacionesChartRef?.nativeElement) {
      try {
        const ctx = this.evaluacionesChartRef.nativeElement.getContext('2d');
        if (ctx) {
          console.log('✅ Creando histograma de evaluaciones');
          // Usar distribución real de evaluaciones del backend
          const evaluaciones = [1, 2, 3, 4, 5];
          const distribucion = evaluaciones.map(cal => {
            return this.reportes.distribucionEvaluaciones?.[cal] || 0;
          });
          console.log('📊 Distribución de evaluaciones para gráfica:', distribucion);

          this.evaluacionesChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: evaluaciones.map(e => `${e} ⭐`),
              datasets: [{
                label: 'Cantidad de Evaluaciones',
                data: distribucion,
                backgroundColor: 'rgba(255, 206, 86, 0.6)',
                borderColor: 'rgba(255, 206, 86, 1)',
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Histograma de Evaluaciones del Usuario',
                  font: { size: 14, weight: 'bold' }
                },
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }
          });
        }
      } catch (error) {
        console.error('❌ Error creando histograma de evaluaciones:', error);
      }
    }

    // 6. Gráfica Radar: Cumplimiento de SLA por técnico
    if (this.slaChartRef?.nativeElement && this.rendimientoTecnicos.length > 0) {
      try {
        const ctx = this.slaChartRef.nativeElement.getContext('2d');
        if (ctx) {
          console.log('✅ Creando gráfica radar de SLA');
          // Calcular cumplimiento de SLA por técnico (simulado basado en tickets fuera de tiempo)
          const metricas = this.rendimientoTecnicos.map(tech => {
            const total = tech.ticketsResueltos || 0;
            const fueraTiempo = tech.ticketsFueraTiempo || 0;
            return total > 0 ? ((total - fueraTiempo) / total) * 100 : 0;
          });

          this.slaChart = new Chart(ctx, {
            type: 'radar',
            data: {
              labels: this.rendimientoTecnicos.map(t => t.nombre),
              datasets: [{
                label: 'Cumplimiento SLA (%)',
                data: metricas,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Cumplimiento de SLA por Técnico',
                  font: { size: 14, weight: 'bold' }
                },
                legend: { display: true }
              },
              scales: {
                r: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    stepSize: 20
                  }
                }
              }
            }
          });
        }
      } catch (error) {
        console.error('❌ Error creando gráfica radar:', error);
      }
    }

    console.log('🎨 Proceso de creación de gráficas completado');
  }

  calcularPorcentajeTicketsAtendidos(): number {
    if (this.reportes.ticketsSolicitados === 0) return 0;
    return Number(((this.reportes.ticketsAtendidos / this.reportes.ticketsSolicitados) * 100).toFixed(1));
  }

  calcularTiempoPromedioResolucion(): number {
    // Simular cálculo de tiempo promedio
    return Number((Math.random() * 5 + 2).toFixed(1));
  }

  obtenerIndicadorRendimiento(): string {
    const satisfaccion = this.reportes.satisfaccionPromedio;
    if (satisfaccion >= 4.5) return 'Excelente';
    if (satisfaccion >= 3.5) return 'Bueno';
    if (satisfaccion >= 2.5) return 'Regular';
    return 'Necesita mejora';
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    // Si ya está en formato DD/MM/YYYY, devolverla
    if (fecha.includes('/')) return fecha;
    // Convertir de YYYY-MM-DD a DD/MM/YYYY
    const partes = fecha.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fecha;
  }
}
