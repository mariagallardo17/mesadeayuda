import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TicketService } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth.service';
import { CountdownComponent } from '../../shared/countdown/countdown.component';

interface EscalatedTicket {
  id: number;
  descripcion: string;
  prioridad: string;
  fecha_creacion: string;
  fecha_inicio_atencion?: string;
  tiempo_atencion_segundos?: number;
  estatus: string;
  categoria: string;
  subcategoria: string;
  tiempo_objetivo?: number;
  usuario: {
    nombre: string;
    correo: string;
  };
  tecnico: {
    nombre: string;
    correo: string;
  } | null;
  escalamiento?: {
    motivo?: string;
    fecha?: string;
    nivel?: string;
  } | null;
}

@Component({
  selector: 'app-escalated-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CountdownComponent],
  templateUrl: './escalated-tickets.component.html',
  styleUrls: ['./escalated-tickets.component.css']
})
export class EscalatedTicketsComponent implements OnInit, OnDestroy {
  tickets: EscalatedTicket[] = []; // Inicializado como array vacío
  filteredTickets: EscalatedTicket[] = [];
  isLoading = false;
  error: string | null = null;
  private destroy$ = new Subject<void>();

  // Búsqueda y filtrado
  searchText: string = '';
  selectedEstado: string = 'todos';

  // Modales
  showDetailsModal = false;
  selectedTicket: EscalatedTicket | null = null;

  // Modales de confirmación y éxito
  showConfirmModal = false;
  showSuccessModal = false;
  showErrorModal = false;
  confirmMessage = '';
  confirmTitle = '';
  successMessage = '';
  errorMessage = '';
  ticketParaConfirmar: EscalatedTicket | null = null;
  estadoParaConfirmar: string = '';

  // Estados disponibles para el panel de cambio de estado
  estadosDisponibles = [
    { value: 'Pendiente', label: 'PENDIENTE', color: '#dc3545' },
    { value: 'Escalado', label: 'ESCALADO', color: '#90ee90' },
    { value: 'Finalizado', label: 'FINALIZADO', color: '#28a745' }
  ];

  // Estados para el filtro
  estados = [
    { value: 'Pendiente', label: 'PENDIENTE', color: 'red' },
    { value: 'En Progreso', label: 'EN PROGRESO', color: 'yellow' },
    { value: 'Escalado', label: 'ESCALADO', color: 'lightgreen' },
    { value: 'Finalizado', label: 'FINALIZADO', color: 'darkgreen' },
    { value: 'Cerrado', label: 'CERRADO', color: 'blue' }
  ];

  // Comentario técnico para cuando se regresa a En Progreso
  comentarioTecnico: string = '';

  // Formularios
  escalateForm: FormGroup;
  showEscalateModal = false;
  technicians: any[] = [];
  isLoadingTechnicians = false;
  pendingForm: FormGroup;
  showPendienteModal = false;
  ticketPendienteSeleccionado: EscalatedTicket | null = null;

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.escalateForm = this.fb.group({
      tecnicoDestino: ['', Validators.required],
      motivoEscalamiento: ['', Validators.required]
    });

    this.pendingForm = this.fb.group({
      motivo: ['', [Validators.required, Validators.maxLength(500)]],
      tiempoEstimado: ['', [Validators.required, Validators.maxLength(100)]]
    });
  }

  get canViewTechnicalInfo(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador';
  }

  get puedeCambiarEstados(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador';
  }

  ngOnInit(): void {
    this.loadEscalatedTickets();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadEscalatedTickets(): void {
    this.isLoading = true;
    this.error = null;

    this.ticketService.getEscalatedTickets()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.tickets = Array.isArray(response?.tickets) ? response.tickets : [];
          this.applyFilters();
          this.isLoading = false;
          console.log('Tickets escalados cargados:', this.tickets);
        },
        error: (error) => {
          console.error('Error cargando tickets escalados:', error);
          this.error = 'Error al cargar los tickets escalados';
          this.isLoading = false;
        }
      });
  }

  applyFilters(): void {
    let filtered = [...this.tickets];

    if (this.selectedEstado !== 'todos') {
      filtered = filtered.filter(ticket => ticket.estatus === this.selectedEstado);
    }

    if (this.searchText.trim() !== '') {
      const searchLower = this.searchText.toLowerCase().trim();
      filtered = filtered.filter(ticket => {
        return (
          ticket.id.toString().includes(searchLower) ||
          ticket.categoria?.toLowerCase().includes(searchLower) ||
          ticket.subcategoria?.toLowerCase().includes(searchLower) ||
          ticket.descripcion?.toLowerCase().includes(searchLower) ||
          ticket.prioridad?.toLowerCase().includes(searchLower) ||
          ticket.estatus?.toLowerCase().includes(searchLower) ||
          ticket.usuario?.nombre?.toLowerCase().includes(searchLower) ||
          ticket.usuario?.correo?.toLowerCase().includes(searchLower)
        );
      });
    }

    this.filteredTickets = filtered;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onEstadoChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedEstado = 'todos';
    this.applyFilters();
  }

  verDetalles(ticket: EscalatedTicket): void {
    this.selectedTicket = ticket;
    this.showDetailsModal = true;
    // No cargar datos adicionales, usar los datos que ya tenemos
  }

  getEstadoColor(estado: string): string {
    const colors: { [key: string]: string } = {
      'Escalado': '#ff6b35',

      'En Progreso': '#2196f3',
      'Finalizado': '#9c27b0',
      'Cerrado': '#607d8b'
    };
    return colors[estado] || '#666';
  }

  getEstadoLabel(estado: string): string {
    const labels: { [key: string]: string } = {
      'Escalado': 'ESCALADO',
      'Abierto': 'ABIERTO',
      'Pendiente': 'PENDIENTE',
      'En Progreso': 'EN PROGRESO',
      'Finalizado': 'FINALIZADO',
      'Cerrado': 'CERRADO'
    };
    return labels[estado] || estado.toUpperCase();
  }

  getPrioridadColor(prioridad: string): string {
    const colors: { [key: string]: string } = {
      'Alta': '#f44336',
      'Media': '#ff9800',
      'Baja': '#4caf50'
    };
    return colors[prioridad] || '#666';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Convierte una fecha string a objeto Date para el countdown
   * Usa fecha_inicio_atencion si existe, sino usa fecha_creacion
   */
  parseDateForCountdown(ticket: EscalatedTicket): Date {
    // Si el ticket tiene fecha_inicio_atencion, usarla (cuando el técnico abrió el ticket)
    // Si no, usar fecha_creacion (fallback para tickets antiguos)
    const fecha = ticket.fecha_inicio_atencion || ticket.fecha_creacion;
    return new Date(fecha);
  }

  cerrarDetalles(): void {
    this.showDetailsModal = false;
  }

  cambiarEstado(ticket: EscalatedTicket, nuevoEstado: string): void {
    const currentUser = this.authService.getCurrentUser();

    // Si quiere cambiar a Pendiente, abrir modal de pendiente
    if ((currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador') && nuevoEstado === 'Pendiente') {
      this.abrirModalPendiente(ticket);
      return;
    }

    // Si es Escalado, abrir el modal de escalamiento
    if (nuevoEstado === 'Escalado') {
      if (!this.selectedTicket || this.selectedTicket.id !== ticket.id) {
        this.selectedTicket = ticket;
      }
      this.abrirEscalamiento();
      return;
    }

    // Para otros estados, mostrar modal de confirmación
    this.abrirModalConfirmacion(ticket, nuevoEstado);
  }

  abrirModalConfirmacion(ticket: EscalatedTicket, nuevoEstado: string): void {
    // Cerrar el modal de detalles primero para evitar superposición
    this.showDetailsModal = false;

    this.ticketParaConfirmar = ticket;
    this.estadoParaConfirmar = nuevoEstado;

    let mensaje = '';
    if (nuevoEstado === 'En Progreso') {
      mensaje = `¿Confirmas regresar el ticket #${ticket.id} al técnico en estado En Progreso? El técnico recibirá un correo notificándole que puede continuar revisando el ticket.`;
    } else if (nuevoEstado === 'Finalizado') {
      mensaje = `¿Confirmas finalizar el ticket #${ticket.id}? El usuario y el técnico recibirán un correo notificándoles que el ticket ha sido finalizado.`;
    } else if (nuevoEstado === 'Pendiente') {
      mensaje = `¿Confirmas marcar el ticket #${ticket.id} como pendiente?`;
    } else if (nuevoEstado === 'Escalado') {
      mensaje = `¿Confirmas escalar el ticket #${ticket.id}?`;
    }

    this.confirmTitle = 'Confirmar cambio de estado';
    this.confirmMessage = mensaje;
    this.showConfirmModal = true;
  }

  cerrarModalConfirmacion(): void {
    this.showConfirmModal = false;
    this.ticketParaConfirmar = null;
    this.estadoParaConfirmar = '';
    this.confirmMessage = '';
    this.confirmTitle = '';
    this.comentarioTecnico = ''; // Limpiar comentario
    // Asegurar que no haya otros modales abiertos
    this.showErrorModal = false;
    this.showSuccessModal = false;
  }

  confirmarCambioEstado(): void {
    console.log('🔵 confirmarCambioEstado llamado');
    console.log('🔵 ticketParaConfirmar:', this.ticketParaConfirmar);
    console.log('🔵 estadoParaConfirmar:', this.estadoParaConfirmar);
    console.log('🔵 tipo estadoParaConfirmar:', typeof this.estadoParaConfirmar);

    if (!this.ticketParaConfirmar || !this.estadoParaConfirmar) {
      console.error('❌ No hay ticket o estado para confirmar');
      return;
    }

    const ticket = this.ticketParaConfirmar;
    const nuevoEstado = String(this.estadoParaConfirmar);

    console.log('🔵 Valores guardados:', {
      ticketId: ticket.id,
      nuevoEstado: nuevoEstado,
      tipo: typeof nuevoEstado
    });

    // Cerrar modal de confirmación
    this.cerrarModalConfirmacion();

    // Mostrar modal de éxito inmediatamente según el estado
    if (nuevoEstado === 'Finalizado') {
      this.successMessage = `El ticket #${ticket.id} fue finalizado exitosamente.`;
      this.showSuccessModal = true;
    } else if (nuevoEstado === 'En Progreso') {
      this.successMessage = `El ticket #${ticket.id} fue regresado al técnico en estado En Progreso.`;
      this.showSuccessModal = true;
    } else if (nuevoEstado === 'Escalado') {
      this.successMessage = `El ticket #${ticket.id} fue escalado exitosamente.`;
      this.showSuccessModal = true;
    }

    this.isLoading = true;
    console.log('🔄 Llamando a updateTicketStatus con:', {
      ticketId: ticket.id,
      nuevoEstado: nuevoEstado,
      tipo: typeof nuevoEstado
    });

    // Preparar opciones para el cambio de estado
    const options: any = {};

    // Si se está regresando a En Progreso desde Escalado, incluir el comentario técnico
    if (nuevoEstado === 'En Progreso' && this.comentarioTecnico && this.comentarioTecnico.trim()) {
      options.comentarios = this.comentarioTecnico.trim();
    }

    this.ticketService.updateTicketStatus(ticket.id, nuevoEstado, options).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        ticket.estatus = nuevoEstado;
        this.isLoading = false;

        // Actualizar el ticket seleccionado si está abierto
        if (this.selectedTicket && this.selectedTicket.id === ticket.id) {
          this.selectedTicket.estatus = nuevoEstado;
        }

        // Recargar tickets
        this.loadEscalatedTickets();
      },
      error: (error) => {
        this.isLoading = false;
        // Cerrar modal de éxito si hay error
        if (this.showSuccessModal) {
          this.cerrarSuccessModal();
        }
        console.error('Error actualizando estado:', error);
        const errorMsg = error.error?.error || error.message || 'Error al actualizar el estado del ticket';
        this.errorMessage = errorMsg;
        this.showErrorModal = true;
      }
    });
  }

  cerrarErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
    // Asegurar que no haya otros modales abiertos
    this.showConfirmModal = false;
    this.showSuccessModal = false;
  }

  abrirModalPendiente(ticket: EscalatedTicket): void {
    this.ticketPendienteSeleccionado = ticket;
    this.pendingForm.reset({
      motivo: '',
      tiempoEstimado: ''
    });
    this.pendingForm.markAsPristine();
    this.pendingForm.markAsUntouched();
    this.showPendienteModal = true;
  }

  cerrarModalPendiente(): void {
    this.showPendienteModal = false;
    this.ticketPendienteSeleccionado = null;
    this.pendingForm.reset();
  }

  guardarPendiente(): void {
    if (!this.ticketPendienteSeleccionado) {
      return;
    }

    if (this.pendingForm.invalid) {
      this.pendingForm.markAllAsTouched();
      return;
    }

    const motivo = (this.pendingForm.value.motivo || '').trim();
    const tiempoEstimado = (this.pendingForm.value.tiempoEstimado || '').trim();

    this.isLoading = true;
    this.ticketService.updateTicketStatus(this.ticketPendienteSeleccionado.id, 'Pendiente', {
      comentarios: motivo,
      pendienteTiempoEstimado: tiempoEstimado
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        const ticket = this.ticketPendienteSeleccionado as EscalatedTicket;
        ticket.estatus = 'Pendiente';
        this.isLoading = false;
        this.cerrarModalPendiente();
        this.successMessage = `El ticket #${ticket.id} fue marcado como pendiente.`;
        this.showSuccessModal = true;
        this.loadEscalatedTickets();
      },
      error: (error) => {
        console.error('Error marcando ticket como pendiente:', error);
        this.isLoading = false;
        this.errorMessage = error.error?.error || 'Error al guardar el estado pendiente del ticket';
        this.showErrorModal = true;
      }
    });
  }

  abrirEscalamiento(): void {
    if (!this.selectedTicket) {
      return;
    }
    this.escalateForm.reset({
      tecnicoDestino: '',
      motivoEscalamiento: ''
    });
    this.escalateForm.markAsPristine();
    this.escalateForm.markAsUntouched();
    this.loadTechnicians();
    this.showEscalateModal = true;
  }

  loadTechnicians(): void {
    this.isLoadingTechnicians = true;
    this.ticketService.getTechnicians().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (technicians) => {
        const currentUser = this.authService.getCurrentUser();
        const currentUserId = (currentUser as any)?.id_usuario || (currentUser as any)?.id;
        this.technicians = technicians.filter((tech: any) => tech.id !== currentUserId);
        this.isLoadingTechnicians = false;
      },
      error: (error) => {
        console.error('Error cargando técnicos:', error);
        this.isLoadingTechnicians = false;
        this.errorMessage = 'Error al cargar la lista de técnicos';
        this.showErrorModal = true;
      }
    });
  }

  cerrarEscalamiento(): void {
    this.showEscalateModal = false;
    this.escalateForm.reset();
  }

  escalarTicket(): void {
    if (!this.selectedTicket) {
      return;
    }

    if (this.escalateForm.invalid) {
      this.escalateForm.markAllAsTouched();
      return;
    }

    const tecnicoDestino = this.escalateForm.value.tecnicoDestino;
    const motivoEscalamiento = (this.escalateForm.value.motivoEscalamiento || '').trim();

    if (!motivoEscalamiento) {
      this.escalateForm.get('motivoEscalamiento')?.setErrors({ required: true });
      return;
    }

    if (!tecnicoDestino) {
      this.escalateForm.get('tecnicoDestino')?.setErrors({ required: true });
      return;
    }

    this.isLoading = true;

    this.ticketService.escalateTicket(this.selectedTicket.id, {
      tecnicoDestino: tecnicoDestino,
      motivoEscalamiento: motivoEscalamiento
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isLoading = false;
        this.cerrarEscalamiento();
        this.loadEscalatedTickets();
        if (this.selectedTicket) {
          this.selectedTicket.estatus = 'Escalado';
        }
        this.successMessage = 'Ticket escalado exitosamente';
        this.showSuccessModal = true;
      },
      error: (error) => {
        console.error('Error escalando ticket:', error);
        this.isLoading = false;
        this.errorMessage = error.error?.error || 'Error al escalar el ticket';
        this.showErrorModal = true;
      }
    });
  }

  cerrarSuccessModal(): void {
    this.showSuccessModal = false;
    this.successMessage = '';
    if (this.showDetailsModal) {
      this.cerrarDetalles();
    }
  }
}
