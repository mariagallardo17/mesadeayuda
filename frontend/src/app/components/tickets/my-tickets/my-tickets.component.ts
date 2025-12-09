import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TicketService, Ticket } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth.service';
import { CountdownComponent } from '../../shared/countdown/countdown.component';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CountdownComponent],
  templateUrl: './my-tickets.component.html',
  styleUrls: ['./my-tickets.component.css']
})
export class MyTicketsComponent implements OnInit, OnDestroy {
  tickets: Ticket[] = [];
  filteredTickets: Ticket[] = [];
  selectedTicket: Ticket | null = null;
  showTicketDetails = false;
  showEscalateForm = false;
  isLoading = false;
  showAutoChangeNotification = false;
  showPendienteModal = false;
  showSuccessModal = false;
  showConfirmModal = false;
  successMessage = '';
  confirmMessage = '';
  confirmTitle = '';
  ticketParaConfirmar: Ticket | null = null;
  estadoParaConfirmar: string = '';
  pendingForm: FormGroup;
  ticketPendienteSeleccionado: Ticket | null = null;
  private destroy$ = new Subject<void>();

  searchText: string = '';
  selectedEstado: string = 'todos';

  get canViewTechnicalInfo(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador';
  }

  escalateForm: FormGroup;
  showEscalateModal = false;
  technicians: any[] = [];
  isLoadingTechnicians = false;

  evaluationForm!: FormGroup;

  estados = [
    { value: 'Pendiente', label: 'PENDIENTE', color: 'red' },
    { value: 'En Progreso', label: 'EN PROGRESO', color: 'yellow' },
    { value: 'Escalado', label: 'ESCALADO', color: 'lightgreen' },
    { value: 'Finalizado', label: 'FINALIZADO', color: 'darkgreen' },
    { value: 'Cerrado', label: 'CERRADO', color: 'blue' }
  ];

  get estadosDisponibles() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.rol === 'tecnico') {
      return this.estados.filter(estado =>
        estado.value !== 'Cerrado' &&
        estado.value !== 'En Progreso'
      );
    } else if (currentUser?.rol === 'administrador') {
      return this.estados.filter(estado =>
        estado.value !== 'Cerrado' &&
        estado.value !== 'En Progreso'
      );
    } else {
      return [];
    }
  }

  // Verificar si el usuario puede cambiar estados
  get puedeCambiarEstados(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador';
  }

  private isBrowser = false;

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.escalateForm = this.fb.group({
      tecnicoDestino: ['', Validators.required],
      motivoEscalamiento: ['', Validators.required]
    });

    this.evaluationForm = this.fb.group({
      calificacion: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      comentario: ['']
    });

    this.pendingForm = this.fb.group({
      motivo: ['', [Validators.required, Validators.maxLength(500)]],
      tiempoEstimado: ['', [Validators.required, Validators.maxLength(100)]]
    });
  }

  ngOnInit(): void {
    this.loadTickets();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTickets(): void {
    this.isLoading = true;
    this.ticketService.getMyTickets().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (tickets) => {
        this.tickets = tickets.filter(ticket => !ticket.reapertura);
        this.applyFilters();
        this.isLoading = false;
        console.log('Tickets cargados:', tickets);
      },
      error: (error) => {
        console.error('Error cargando tickets:', error);
        this.isLoading = false;
        alert('Error al cargar los tickets');
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.tickets];

    if (this.selectedEstado !== 'todos') {
      filtered = filtered.filter(ticket => ticket.estado === this.selectedEstado);
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
          ticket.estado?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Ordenar por prioridad: Crítica > Alta > Media > Baja
    filtered.sort((a, b) => {
      const priorityOrder: { [key: string]: number } = {
        'Crítica': 4,
        'Critica': 4,
        'Alta': 3,
        'Media': 2,
        'Baja': 1
      };

      const priorityA = priorityOrder[a.prioridad?.charAt(0).toUpperCase() + a.prioridad?.slice(1).toLowerCase() || 'Media'] || 2;
      const priorityB = priorityOrder[b.prioridad?.charAt(0).toUpperCase() + b.prioridad?.slice(1).toLowerCase() || 'Media'] || 2;

      // Si tienen la misma prioridad, ordenar por fecha (más recientes primero)
      if (priorityB === priorityA) {
        const dateA = new Date(a.fechaCreacion).getTime();
        const dateB = new Date(b.fechaCreacion).getTime();
        return dateB - dateA;
      }

      return priorityB - priorityA; // Mayor prioridad primero
    });

    this.filteredTickets = filtered;
  }

  // Verificar si un ticket es urgente (Crítica o Alta)
  isUrgent(ticket: Ticket): boolean {
    const prioridad = ticket.prioridad?.toLowerCase() || '';
    return prioridad === 'crítica' || prioridad === 'critica' || prioridad === 'alta';
  }

  // Obtener la clase CSS para la prioridad
  getPriorityClass(ticket: Ticket): string {
    const prioridad = ticket.prioridad?.toLowerCase() || 'media';
    if (prioridad === 'crítica' || prioridad === 'critica') {
      return 'priority-critica';
    } else if (prioridad === 'alta') {
      return 'priority-alta';
    } else if (prioridad === 'media') {
      return 'priority-media';
    } else {
      return 'priority-baja';
    }
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


  verDetalles(ticket: Ticket): void {
    this.selectedTicket = ticket;
    this.showTicketDetails = true;
    console.log('Ver detalles del ticket:', ticket);

    // SOLO técnicos y administradores pueden cambiar automáticamente el estado
    // Los empleados NO pueden cambiar el estado automáticamente
    const currentUser = this.authService.getCurrentUser();
    console.log('🔍 Usuario actual:', currentUser?.rol, 'Ticket estado:', ticket.estado);

    const tienePendienteManual = !!ticket.pendienteMotivo;

    if ((currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador') && ticket.estado === 'Pendiente' && !tienePendienteManual) {
      console.log('✅ Usuario autorizado - Cambiando estado automáticamente');
      this.cambiarEstadoAutomatico(ticket, 'En Progreso');
    } else {
      console.log('❌ Usuario NO autorizado - NO se cambia el estado automáticamente');
    }
  }

  cerrarDetalles(): void {
    this.showTicketDetails = false;
    this.selectedTicket = null;
    if (this.showPendienteModal) {
      this.cerrarModalPendiente();
    }
  }

  private cambiarEstadoAutomatico(ticket: Ticket, nuevoEstado: string): void {
    console.log(`🔄 Cambiando automáticamente ticket ${ticket.id} de "${ticket.estado}" a "${nuevoEstado}"`);

    this.ticketService.updateTicketStatus(ticket.id, nuevoEstado).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        console.log(`✅ Estado actualizado automáticamente:`, response);
        // Actualizar el estado local del ticket
        ticket.estado = nuevoEstado;
        ticket.pendienteMotivo = response.pendienteMotivo ?? null;
        ticket.pendienteTiempoEstimado = response.pendienteTiempoEstimado ?? null;
        ticket.pendienteActualizadoEn = response.pendienteActualizadoEn ?? null;
        // Actualizar la lista local
        const index = this.tickets.findIndex(t => t.id === ticket.id);
        if (index !== -1) {
          this.tickets[index].estado = nuevoEstado;
          this.tickets[index].pendienteMotivo = response.pendienteMotivo ?? null;
          this.tickets[index].pendienteTiempoEstimado = response.pendienteTiempoEstimado ?? null;
          this.tickets[index].pendienteActualizadoEn = response.pendienteActualizadoEn ?? null;
        }

        // Mostrar notificación de cambio automático
        this.showAutoChangeNotification = true;
        setTimeout(() => {
          this.showAutoChangeNotification = false;
        }, 3000); // Ocultar después de 3 segundos
      },
      error: (error) => {
        console.error('❌ Error actualizando estado automáticamente:', error);
        // No mostrar alerta para cambios automáticos, solo log
      }
    });
  }

  cambiarEstado(ticket: Ticket, nuevoEstado: string): void {
    const currentUser = this.authService.getCurrentUser();
    // Si es técnico o administrador y quiere cambiar a Pendiente, abrir modal
    if ((currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador') && nuevoEstado === 'Pendiente') {
      this.abrirModalPendiente(ticket);
      return;
    }

    // Si es Escalado, abrir el modal de escalamiento
    if (nuevoEstado === 'Escalado') {
      // Asegurar que el ticket esté seleccionado
      if (!this.selectedTicket || this.selectedTicket.id !== ticket.id) {
        this.selectedTicket = ticket;
      }
      this.abrirEscalamiento();
      return;
    }

    // Para otros estados, mostrar modal de confirmación
    this.abrirModalConfirmacion(ticket, nuevoEstado);
  }

  abrirModalConfirmacion(ticket: Ticket, nuevoEstado: string): void {
    this.ticketParaConfirmar = ticket;
    this.estadoParaConfirmar = nuevoEstado;

    const currentUser = this.authService.getCurrentUser();
    let mensaje = `¿Confirmas cambiar el ticket #${ticket.id} a ${nuevoEstado}?`;

    if (currentUser?.rol === 'tecnico' && nuevoEstado === 'Finalizado') {
      mensaje = `¿Finalizar el ticket #${ticket.id}? (Los técnicos solo pueden finalizar tickets, no cerrarlos)`;
    } else if (currentUser?.rol === 'administrador' && nuevoEstado === 'Finalizado') {
      mensaje = `¿Finalizar el ticket #${ticket.id}? (Los administradores-técnicos solo pueden finalizar tickets, no cerrarlos)`;
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
  }

  confirmarCambioEstado(): void {
    if (!this.ticketParaConfirmar || !this.estadoParaConfirmar) {
      return;
    }

    const ticket = this.ticketParaConfirmar;
    const nuevoEstado = this.estadoParaConfirmar;

    // Cerrar modal de confirmación
    this.cerrarModalConfirmacion();

    // Mostrar modal de éxito inmediatamente si es Finalizado
    if (nuevoEstado === 'Finalizado') {
      this.successMessage = `El ticket #${ticket.id} fue finalizado exitosamente.`;
      this.showSuccessModal = true;
    }

    this.isLoading = true;
    console.log('🔄 Cambiando estado del ticket:', {
      ticketId: ticket.id,
      nuevoEstado: nuevoEstado
    });

    this.ticketService.updateTicketStatus(ticket.id, nuevoEstado).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        ticket.estado = nuevoEstado as any;
        ticket.pendienteMotivo = response.pendienteMotivo ?? null;
        ticket.pendienteTiempoEstimado = response.pendienteTiempoEstimado ?? null;
        ticket.pendienteActualizadoEn = response.pendienteActualizadoEn ?? null;
        this.isLoading = false;

        // Actualizar el ticket seleccionado si está abierto
        if (this.selectedTicket && this.selectedTicket.id === ticket.id) {
          this.selectedTicket.estado = nuevoEstado as any;
          this.selectedTicket.pendienteMotivo = response.pendienteMotivo ?? null;
          this.selectedTicket.pendienteTiempoEstimado = response.pendienteTiempoEstimado ?? null;
          this.selectedTicket.pendienteActualizadoEn = response.pendienteActualizadoEn ?? null;
        }

        // Recargar tickets
        this.loadTickets();
      },
      error: (error) => {
        this.isLoading = false;
        // Cerrar modal de éxito si hay error
        if (this.showSuccessModal) {
          this.cerrarSuccessModal();
        }
        console.error('Error actualizando estado:', error);
        alert(error.error?.error || 'Error al actualizar el estado del ticket');
      }
    });
  }

  abrirModalPendiente(ticket: Ticket): void {
    this.ticketPendienteSeleccionado = ticket;
    this.pendingForm.reset({
      motivo: ticket.pendienteMotivo || '',
      tiempoEstimado: ticket.pendienteTiempoEstimado || ''
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

  cerrarSuccessModal(): void {
    this.showSuccessModal = false;
    this.successMessage = '';
    // Si el modal de éxito se muestra después de escalar, cerrar también los detalles del ticket
    if (this.showTicketDetails) {
      this.cerrarDetalles();
    }
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
        const ticket = this.ticketPendienteSeleccionado as Ticket;
        ticket.estado = 'Pendiente';
        ticket.pendienteMotivo = response.pendienteMotivo ?? motivo;
        ticket.pendienteTiempoEstimado = response.pendienteTiempoEstimado ?? tiempoEstimado;
        ticket.pendienteActualizadoEn = response.pendienteActualizadoEn ?? new Date().toISOString();

        const index = this.tickets.findIndex(t => t.id === ticket.id);
        if (index !== -1) {
          this.tickets[index] = { ...this.tickets[index], ...ticket };
        }

        if (this.selectedTicket?.id === ticket.id) {
          this.selectedTicket = { ...this.selectedTicket, ...ticket };
        }

        this.isLoading = false;
        this.cerrarModalPendiente();
        this.successMessage = `El ticket #${ticket.id} fue marcado como pendiente.`;
        this.showSuccessModal = true;
      },
      error: (error) => {
        console.error('Error marcando ticket como pendiente:', error);
        this.isLoading = false;
        alert(error.error?.error || 'Error al guardar el estado pendiente del ticket');
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
        // Filtrar el técnico actual si está en la lista
        const currentUser = this.authService.getCurrentUser();
        const currentUserId = (currentUser as any)?.id_usuario || (currentUser as any)?.id;
        this.technicians = technicians.filter((tech: any) => tech.id !== currentUserId);
        this.isLoadingTechnicians = false;
      },
      error: (error) => {
        console.error('Error cargando técnicos:', error);
        this.isLoadingTechnicians = false;
        alert('Error al cargar la lista de técnicos');
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
        this.loadTickets(); // Recargar tickets
        // Actualizar el ticket seleccionado si está abierto
        if (this.selectedTicket) {
          this.selectedTicket.estado = 'Escalado';
        }
        // Mostrar modal de éxito en lugar de alert
        this.successMessage = 'Ticket escalado exitosamente';
        this.showSuccessModal = true;
      },
      error: (error) => {
        console.error('Error escalando ticket:', error);
        this.isLoading = false;
        alert(error.error?.error || 'Error al escalar el ticket');
      }
    });
  }

  getEstadoColor(estado: string): string {
    const estadoObj = this.estados.find(e => e.value === estado);
    if (!estadoObj) return '#666';

    const colorMap: { [key: string]: string } = {
      'Pendiente': '#dc3545',
      'En Progreso': '#ffc107',
      'Escalado': '#90ee90',
      'Finalizado': '#28a745',
      'Cerrado': '#007bff'
    };
    return colorMap[estado] || '#666';
  }

  puedeEvaluarTicket(ticket: Ticket | null): boolean {
    if (!ticket || ticket.evaluacion) {
      return false;
    }

    const estado = ticket.estado.toLowerCase();
    return estado === 'finalizado' || (estado === 'cerrado' && !!ticket.evaluacionCierreAutomatico);
  }

  getEstadoLabel(estado: string): string {
    const estadoObj = this.estados.find(e => e.value === estado);
    return estadoObj ? estadoObj.label : estado;
  }

  getPrioridadColor(prioridad: string): string {
    const colorMap: { [key: string]: string } = {
      'Alta': '#dc3545',
      'Media': '#ffc107',
      'Baja': '#28a745',
      'Crítica': '#8b0000'
    };
    return colorMap[prioridad] || '#666';
  }

  getDiasVencimiento(fechaCreacion: string | Date): number {
    const fecha = new Date(fechaCreacion);
    const hoy = new Date();
    const diffTime = hoy.getTime() - fecha.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, 7 - diffDays); // Asumiendo 7 días de vencimiento
  }

  getAlertaVencimiento(ticket: Ticket): string {
    const dias = this.getDiasVencimiento(ticket.fechaCreacion);
    if (dias <= 0) {
      return 'VENCIDO';
    } else if (dias <= 2) {
      return `Vence en ${dias} días`;
    }
    return '';
  }

  verCartaAprobacion(ticket: Ticket): void {
    if (!ticket.archivoAprobacion) {
      return;
    }

    const previewWindow = window.open('', '_blank');

    if (!previewWindow) {
      alert('El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para ver la carta de aprobación.');
      return;
    }

    previewWindow.document.write('<p style="font-family: sans-serif; padding: 16px;">Cargando carta de aprobación...</p>');

    this.ticketService.getApprovalLetter(ticket.id, 'inline').pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        previewWindow.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: (error) => {
        console.error('Error al visualizar la carta de aprobación:', error);
        previewWindow.close();
        alert('No se pudo abrir la carta de aprobación. Intenta de nuevo más tarde.');
      }
    });
  }

  descargarCartaAprobacion(ticket: Ticket): void {
    if (!ticket.archivoAprobacion) {
      return;
    }

    this.ticketService.getApprovalLetter(ticket.id, 'attachment').pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = ticket.archivoAprobacion || `carta-aprobacion-${ticket.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error al descargar la carta de aprobación:', error);
        alert('No se pudo descargar la carta de aprobación. Intenta de nuevo más tarde.');
      }
    });
  }

  // Métodos para evaluación
  setRating(rating: number): void {
    this.evaluationForm.patchValue({ calificacion: rating });
  }

  evaluarTicket(): void {
    if (this.evaluationForm.valid && this.selectedTicket) {
      this.isLoading = true;
      const { calificacion, comentario } = this.evaluationForm.value;

      this.ticketService.closeTicketWithEvaluation({
        ticketId: this.selectedTicket.id,
        rating: calificacion,
        comentarios: comentario
      }).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          console.log('Ticket evaluado y cerrado:', response);
          this.isLoading = false;
          alert('Ticket evaluado y cerrado exitosamente');

          // Actualizar el ticket local
          if (this.selectedTicket) {
            this.selectedTicket.estado = 'Cerrado';
            this.selectedTicket.evaluacion = {
              calificacion: calificacion,
              comentario: comentario,
              fechaEvaluacion: new Date().toISOString()
            };
          }

          // Recargar tickets para obtener la información actualizada
          this.loadTickets();
        },
        error: (error) => {
          console.error('Error evaluando ticket:', error);
          this.isLoading = false;
          const mensajeError = error.error?.error || 'Error al evaluar el ticket';
          alert(mensajeError);
        }
      });
    } else {
      alert('Por favor, selecciona una calificación');
    }
  }

  /**
   * Convierte una fecha string a objeto Date
   * Usa fechaInicioAtencion si existe, sino usa fechaCreacion
   */
  parseDate(ticket: any): Date {
    // Si el ticket tiene fechaInicioAtencion, usarla (cuando el técnico abrió el ticket)
    // Si no, usar fechaCreacion (fallback para tickets antiguos)
    const fecha = ticket.fechaInicioAtencion || ticket.fechaCreacion;
    return new Date(fecha);
  }
}
