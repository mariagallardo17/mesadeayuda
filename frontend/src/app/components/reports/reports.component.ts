import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ReportsService, ReportesResponse } from '../../services/reports.service';
import jsPDF from 'jspdf';
import { Chart, registerables } from 'chart.js';
import html2canvas from 'html2canvas';

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
  @ViewChild('reportsContainer', { static: false }) reportsContainerRef!: ElementRef<HTMLDivElement>;

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
    console.log('📊 ReportsComponent - ngOnInit iniciado');
    try {
      this.cargarReportes();
    } catch (error) {
      console.error('❌ Error en ngOnInit de ReportsComponent:', error);
      alert('Error al inicializar el componente de reportes. Por favor, recarga la página.');
    }
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
        console.error('❌ Status:', error.status);
        console.error('❌ Error completo:', JSON.stringify(error, null, 2));
        this.isLoading = false;
        
        let errorMessage = 'Error desconocido al cargar los reportes';
        
        if (error.status === 401) {
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else if (error.status === 403) {
          errorMessage = 'No tienes permisos para ver los reportes. Se requiere rol de administrador.';
        } else if (error.status === 0) {
          errorMessage = 'Error de conexión. Verifica que el servidor esté disponible.';
        } else if (error.error?.error) {
          errorMessage = error.error.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert('Error al cargar los reportes: ' + errorMessage);
        
        // Inicializar con valores por defecto para que el componente se muestre aunque haya error
        this.reportes = {
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
        this.distribucionEstados = [];
        this.distribucionServicios = [];
        this.rendimientoTecnicos = [];
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

  // Función auxiliar para capturar gráfica como imagen
  private async capturarGrafica(chart: Chart | null, canvasRef: ElementRef<HTMLCanvasElement> | undefined): Promise<string | null> {
    if (!chart || !canvasRef?.nativeElement) {
      console.warn('⚠️ No hay gráfica o canvas disponible para capturar');
      return null;
    }
    
    // Esperar un momento para asegurar que la gráfica esté renderizada
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      const canvas = canvasRef.nativeElement;
      
      // Verificar que el canvas tenga dimensiones válidas
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        console.warn('⚠️ Canvas tiene dimensiones inválidas:', canvas.width, canvas.height);
        return null;
      }
      
      // Intentar usar el método de Chart.js primero
      if (chart && typeof (chart as any).toBase64Image === 'function') {
        try {
          const imageData = (chart as any).toBase64Image('image/png', 1.0);
          if (imageData && typeof imageData === 'string' && imageData.startsWith('data:image')) {
            console.log('✅ Gráfica capturada usando toBase64Image(), tamaño:', imageData.length);
            return imageData;
          }
        } catch (e) {
          console.warn('⚠️ toBase64Image() falló, usando canvas directamente:', e);
        }
      }
      
      // Fallback: usar canvas directamente con calidad máxima
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        try {
          const imageData = canvas.toDataURL('image/png', 1.0);
          if (imageData && typeof imageData === 'string' && imageData.startsWith('data:image')) {
            console.log('✅ Gráfica capturada usando canvas.toDataURL(), tamaño:', imageData.length);
            return imageData;
          } else {
            console.warn('⚠️ toDataURL() retornó datos inválidos');
          }
        } catch (e) {
          console.error('❌ Error en toDataURL():', e);
        }
      }
      
      console.warn('⚠️ No se pudo capturar la gráfica: canvas vacío o inválido');
      return null;
    } catch (error) {
      console.error('❌ Error capturando gráfica:', error);
      return null;
    }
  }

  // Nueva función para exportar PDF con vista visual exacta del sistema
  async exportarReportesVisual(): Promise<void> {
    this.isLoading = true;

    try {
      if (!this.reportsContainerRef?.nativeElement) {
        alert('Error: No se puede capturar la vista. Por favor, recarga la página e intenta nuevamente.');
        this.isLoading = false;
        return;
      }

      // Ocultar elementos que no queremos en el PDF (botones, filtros, etc.)
      const container = this.reportsContainerRef.nativeElement;
      const filtersSection = container.querySelector('.filters-section') as HTMLElement;
      const exportBtn = container.querySelector('.export-btn') as HTMLElement;
      
      const originalFilterDisplay = filtersSection?.style.display;
      const originalBtnDisplay = exportBtn?.style.display;

      if (filtersSection) filtersSection.style.display = 'none';
      if (exportBtn) exportBtn.style.display = 'none';

      // Esperar un momento para que los cambios se apliquen
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capturar la vista como imagen
      console.log('📸 Capturando vista visual del sistema...');
      const canvas = await html2canvas(container, {
        scale: 2, // Mayor resolución
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        removeContainer: false,
        allowTaint: false
      });

      // Restaurar elementos ocultos
      if (filtersSection) filtersSection.style.display = originalFilterDisplay || '';
      if (exportBtn) exportBtn.style.display = originalBtnDisplay || '';

      // Crear PDF
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // Ancho A4 en mm
      const pageHeight = 297; // Alto A4 en mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const doc = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      // Agregar primera página
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Agregar páginas adicionales si es necesario
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Guardar PDF
      const fileName = `reporte-mensual-visual-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      this.isLoading = false;
      alert('✅ Reporte exportado exitosamente con diseño visual exacto del sistema');
    } catch (error) {
      console.error('❌ Error exportando PDF visual:', error);
      this.isLoading = false;
      alert('Error al exportar el reporte: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  }

  exportarReportes(): void {
    this.isLoading = true;

    // Asegurar que las gráficas estén creadas
    if (!this.estadosChart || !this.semanasChart || !this.tendenciaChart) {
      console.log('⚠️ Las gráficas no están creadas, creándolas ahora...');
      this.crearGraficas();
      // Esperar a que las gráficas se rendericen
      setTimeout(() => {
        this.exportarReportes();
      }, 1500);
      return;
    }

    // Función asíncrona para exportar
    (async () => {
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
      yPosition += 10;

      // Reporte de TODOS los técnicos
      if (this.rendimientoTecnicos.length > 0) {
        this.rendimientoTecnicos.forEach((tecnico, index) => {
          // Nueva página si es necesario
          if (yPosition > pageHeight - 80) {
            doc.addPage();
            yPosition = 20;
          }

          // Título del técnico
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
          doc.text(`5.${index + 1} ${tecnico.nombre}`, margin, yPosition);
        yPosition += 8;

          // Tabla de métricas del técnico
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
          
        const metricasTecnico = [
            ['Tickets asignados', tecnico.ticketsAsignados || 0],
            ['Tickets resueltos', tecnico.ticketsResueltos || 0],
            ['Tickets pendientes', tecnico.ticketsPendientes || 0],
            ['Tickets escalados', tecnico.ticketsEscalados || 0],
            ['Tickets reabiertos', tecnico.ticketsReabiertos || 0],
            ['Tickets fuera de tiempo', tecnico.ticketsFueraTiempo || 0],
            ['Calificación promedio', `${tecnico.calificacionPromedio ? tecnico.calificacionPromedio.toFixed(1) : '0.0'}`]
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

          // Análisis del desempeño
        yPosition += 5;
        doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          
          // Generar análisis dinámico basado en métricas
          let analisis = '';
          const eficiencia = tecnico.ticketsAsignados > 0 
            ? parseFloat(((tecnico.ticketsResueltos || 0) / tecnico.ticketsAsignados * 100).toFixed(0))
            : 0;
          
          if (eficiencia >= 80 && (tecnico.calificacionPromedio || 0) >= 4.0) {
            analisis = 'El técnico muestra excelente eficiencia y alta satisfacción del usuario.';
          } else if (eficiencia >= 60 && (tecnico.calificacionPromedio || 0) >= 3.5) {
            analisis = 'El técnico muestra buena eficiencia y satisfacción aceptable.';
          } else if ((tecnico.ticketsReabiertos || 0) > 2 || (tecnico.ticketsFueraTiempo || 0) > 2) {
            analisis = 'Se recomienda mejorar el seguimiento y la documentación para reducir reaperturas y retrasos.';
          } else {
            analisis = 'El técnico muestra desempeño aceptable con oportunidades de mejora.';
          }
          
          const analisisLines = doc.splitTextToSize(`Análisis del desempeño: ${analisis}`, pageWidth - 2 * margin);
          analisisLines.forEach((line: string) => {
            if (yPosition > pageHeight - 30) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(line, margin, yPosition);
            yPosition += 6;
          });
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          yPosition += 10;
        });
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('No hay datos de técnicos disponibles para este período.', margin, yPosition);
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

      // 6. Gráficas del Sistema
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }
      // Agregar título de sección
      doc.text('6. Graficas del Sistema', margin, yPosition);
      yPosition += 10;

      // Capturar y agregar gráficas al PDF
      const chartWidth = pageWidth - 2 * margin;
      const chartHeight = 70; // Altura en mm para cada gráfica (aumentada para mejor visualización)

      console.log('📸 Iniciando captura de gráficas para PDF...');
      
      // Esperar un momento adicional para asegurar que todas las gráficas estén completamente renderizadas
      await new Promise(resolve => setTimeout(resolve, 200));

      // 6.1 Gráfica de Tickets por Semana
      if (this.semanasChart && this.semanasChartRef) {
        console.log('📸 Capturando gráfica de semanas...');
        const semanasImage = await this.capturarGrafica(this.semanasChart, this.semanasChartRef);
        if (semanasImage) {
          console.log('✅ Gráfica de semanas capturada exitosamente');
          if (yPosition + chartHeight > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('6.1 Tickets por Semana', margin, yPosition);
        yPosition += 6;
          try {
            doc.addImage(semanasImage, 'PNG', margin, yPosition, chartWidth, chartHeight, undefined, 'FAST');
            yPosition += chartHeight + 10;
          } catch (error) {
            console.error('❌ Error agregando imagen de semanas:', error);
            doc.text('Error al cargar la gráfica de Tickets por Semana', margin, yPosition);
            yPosition += 15;
          }
        }
      }

      // 6.2 Gráfica de Tendencia
      if (this.tendenciaChart && this.tendenciaChartRef) {
        console.log('📸 Capturando gráfica de tendencia...');
        const tendenciaImage = await this.capturarGrafica(this.tendenciaChart, this.tendenciaChartRef);
        if (tendenciaImage) {
          console.log('✅ Gráfica de tendencia capturada exitosamente');
          if (yPosition + chartHeight > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('6.2 Tendencia: Tickets Atendidos vs. Pendientes', margin, yPosition);
          yPosition += 6;
          try {
            doc.addImage(tendenciaImage, 'PNG', margin, yPosition, chartWidth, chartHeight, undefined, 'FAST');
            yPosition += chartHeight + 10;
          } catch (error) {
            console.error('❌ Error agregando imagen de tendencia:', error);
            doc.text('Error al cargar la gráfica de Tendencia', margin, yPosition);
            yPosition += 15;
          }
        }
      }

      // 6.3 Gráfica de Distribución por Estado (Barras)
      if (this.estadosChart && this.estadosChartRef) {
        console.log('📸 Capturando gráfica de estados (barras)...');
        const estadosImage = await this.capturarGrafica(this.estadosChart, this.estadosChartRef);
        if (estadosImage) {
          console.log('✅ Gráfica de estados capturada exitosamente');
          if (yPosition + chartHeight > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('6.3 Distribución de Tickets por Estado', margin, yPosition);
          yPosition += 6;
          try {
            doc.addImage(estadosImage, 'PNG', margin, yPosition, chartWidth, chartHeight, undefined, 'FAST');
            yPosition += chartHeight + 10;
          } catch (error) {
            console.error('❌ Error agregando imagen de estados:', error);
            doc.text('Error al cargar la gráfica de Distribución por Estado', margin, yPosition);
            yPosition += 15;
          }
        }
      }

      // 6.4 Gráfica de Pastel de Estados
      if (this.estadosPieChart && this.estadosPieChartRef) {
        console.log('📸 Capturando gráfica de estados (pastel)...');
        const pieImage = await this.capturarGrafica(this.estadosPieChart, this.estadosPieChartRef);
        if (pieImage) {
          console.log('✅ Gráfica de pastel capturada exitosamente');
          if (yPosition + chartHeight > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('6.4 Distribución de Tickets por Estado (Pastel)', margin, yPosition);
          yPosition += 6;
          try {
            doc.addImage(pieImage, 'PNG', margin, yPosition, chartWidth, chartHeight, undefined, 'FAST');
            yPosition += chartHeight + 10;
          } catch (error) {
            console.error('❌ Error agregando imagen de pastel:', error);
            doc.text('Error al cargar la gráfica de Pastel', margin, yPosition);
            yPosition += 15;
          }
        }
      }

      // 6.5 Gráfica de Rendimiento por Técnico
      if (this.rendimientoChart && this.rendimientoChartRef) {
        console.log('📸 Capturando gráfica de rendimiento...');
        const rendimientoImage = await this.capturarGrafica(this.rendimientoChart, this.rendimientoChartRef);
        if (rendimientoImage) {
          console.log('✅ Gráfica de rendimiento capturada exitosamente');
          if (yPosition + chartHeight > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('6.5 Rendimiento por Técnico', margin, yPosition);
          yPosition += 6;
          try {
            doc.addImage(rendimientoImage, 'PNG', margin, yPosition, chartWidth, chartHeight, undefined, 'FAST');
            yPosition += chartHeight + 10;
          } catch (error) {
            console.error('❌ Error agregando imagen de rendimiento:', error);
            doc.text('Error al cargar la gráfica de Rendimiento', margin, yPosition);
            yPosition += 15;
          }
        }
      }

      // 6.6 Gráfica de Evaluaciones
      if (this.evaluacionesChart && this.evaluacionesChartRef) {
        console.log('📸 Capturando gráfica de evaluaciones...');
        const evaluacionesImage = await this.capturarGrafica(this.evaluacionesChart, this.evaluacionesChartRef);
        if (evaluacionesImage) {
          console.log('✅ Gráfica de evaluaciones capturada exitosamente');
          if (yPosition + chartHeight > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('6.6 Distribución de Evaluaciones de Usuarios', margin, yPosition);
          yPosition += 6;
          try {
            doc.addImage(evaluacionesImage, 'PNG', margin, yPosition, chartWidth, chartHeight, undefined, 'FAST');
            yPosition += chartHeight + 10;
          } catch (error) {
            console.error('❌ Error agregando imagen de evaluaciones:', error);
            doc.text('Error al cargar la gráfica de Evaluaciones', margin, yPosition);
            yPosition += 15;
          }
        }
      }

      // 6.7 Gráfica de SLA
      if (this.slaChart && this.slaChartRef) {
        console.log('📸 Capturando gráfica de SLA...');
        const slaImage = await this.capturarGrafica(this.slaChart, this.slaChartRef);
        if (slaImage) {
          console.log('✅ Gráfica de SLA capturada exitosamente');
          if (yPosition + chartHeight > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('6.7 Cumplimiento de SLA por Técnico', margin, yPosition);
          yPosition += 6;
          try {
            doc.addImage(slaImage, 'PNG', margin, yPosition, chartWidth, chartHeight, undefined, 'FAST');
            yPosition += chartHeight + 10;
          } catch (error) {
            console.error('❌ Error agregando imagen de SLA:', error);
            doc.text('Error al cargar la gráfica de SLA', margin, yPosition);
            yPosition += 15;
          }
        }
      }

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
        alert('Reporte exportado a PDF exitosamente con todas las gráficas');
    } catch (error) {
      console.error('Error exportando a PDF:', error);
      this.isLoading = false;
      alert('Error al exportar el reporte a PDF: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
    })();
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
