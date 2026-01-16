import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, NgIf, NgForOf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TicketService, Ticket } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-reopened-tickets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgIf, NgForOf],
  templateUrl: './reopened-tickets.component.html',
  styleUrls: ['./reopened-tickets.component.css']
})
export class ReopenedTicketsComponent implements OnInit, OnDestroy {
  reopenedTickets: Ticket[] = [];
  filteredTickets: Ticket[] = [];
  isLoading = false;
  causeForm: FormGroup;
  pendienteForm: FormGroup;
  isSavingCause = false;
  isUpdatingStatus = false;
  ticketSeleccionadoParaCausa: Ticket | null = null;
  ticketPendienteSeleccionado: Ticket | null = null;
  mostrarModalCausa = false;
  showTicketDetails = false;
  selectedTicket: Ticket | null = null;
  showPendienteModal = false;
  showEscalateModal = false;
  showSuccessModal = false;
  showConfirmModal = false;
  successMessage = '';
  confirmMessage = '';
  confirmTitle = '';
  ticketParaConfirmar: Ticket | null = null;
  estadoParaConfirmar: string = '';
  escalateForm: FormGroup;
  technicians: any[] = [];
  isLoadingTechnicians = false;
  private destroy$ = new Subject<void>();

  // Filtros
  searchText: string = '';
  selectedEstado: string = 'todos';

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  totalPages: number = 0;
  startItem: number = 0;
  endItem: number = 0;
  hasNextPage: boolean = false;
  hasPrevPage: boolean = false;

  estados = [
    { value: 'Pendiente', label: 'PENDIENTE', color: 'red' },
    { value: 'En Progreso', label: 'EN PROGRESO', color: 'yellow' },
    { value: 'Escalado', label: 'ESCALADO', color: 'lightgreen' },
    { value: 'Finalizado', label: 'FINALIZADO', color: 'darkgreen' },
    { value: 'Cerrado', label: 'CERRADO', color: 'blue' }
  ];

  // Estados disponibles según el rol del usuario
  get estadosDisponibles() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.rol === 'tecnico') {
      // Los técnicos pueden cambiar a estados específicos, pero no a los automáticos
      return this.estados.filter(estado =>
        estado.value !== 'Cerrado' &&
        estado.value !== 'En Progreso'  // Automático - se cambia al abrir detalles
      );
    } else if (currentUser?.rol === 'administrador') {
      // Los administradores tienen rol de técnico, pueden cambiar a estados específicos
      // Incluyendo Pendiente (con modal para motivo)
      return this.estados.filter(estado =>
        estado.value !== 'Cerrado' && // Solo administradores puros pueden cerrar
        estado.value !== 'En Progreso'  // Automático - se cambia al abrir detalles
      );
    } else {
      // Los empleados NO pueden cambiar estados - solo ver
      return [];
    }
  }

  // Verificar si el usuario puede cambiar estados
  get puedeCambiarEstados(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador';
  }

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.causeForm = this.fb.group({
      causa: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1000)]]
    });

    this.pendienteForm = this.fb.group({
      comentarios: ['', [Validators.required, Validators.maxLength(500)]],
      pendienteTiempoEstimado: ['', [Validators.required, Validators.maxLength(100)]]
    });

    this.escalateForm = this.fb.group({
      tecnicoDestino: ['', Validators.required],
      motivoEscalamiento: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadReopenedTickets();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isTecnico(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador';
  }

  get isEmpleado(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.rol === 'empleado';
  }

  loadReopenedTickets(): void {
    this.isLoading = true;
    // Cargar todos los tickets reabiertos sin paginación (límite muy alto)
    this.ticketService.getReopenedTickets(1, 10000).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        // Verificar si la respuesta tiene el nuevo formato con paginación
        if (response && response.tickets && response.pagination) {
          this.reopenedTickets = response.tickets.map(ticket => ({
            ...ticket,
            mostrarEstadoReabierto: true
          }));
          this.totalItems = response.pagination.total;
          this.totalPages = response.pagination.totalPages;
          this.startItem = response.pagination.startItem;
          this.endItem = response.pagination.endItem;
          this.hasNextPage = response.pagination.hasNextPage;
          this.hasPrevPage = response.pagination.hasPrevPage;
        } else if (Array.isArray(response)) {
          // Compatibilidad con formato antiguo (sin paginación)
          console.log('📦 Tickets reabiertos (formato antiguo):', response);
          this.reopenedTickets = response.map(ticket => ({
            ...ticket,
            mostrarEstadoReabierto: true
          }));
          this.totalItems = this.reopenedTickets.length;
          this.totalPages = 1;
          this.startItem = this.reopenedTickets.length > 0 ? 1 : 0;
          this.endItem = this.reopenedTickets.length;
          this.hasNextPage = false;
          this.hasPrevPage = false;
        } else {
          console.error('❌ La respuesta no es válida:', response);
          this.isLoading = false;
          alert('Error: La respuesta del servidor no es válida');
          return;
        }
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar tickets reabiertos:', error);
        this.isLoading = false;
        alert('No fue posible cargar los tickets reabiertos.');
      }
    });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadReopenedTickets();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  changeItemsPerPage(limit: number): void {
    this.itemsPerPage = limit;
    this.currentPage = 1;
    this.loadReopenedTickets();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPages - 1);

    if (endPage - startPage < maxPages - 1) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  applyFilters(): void {
    let filtered = [...this.reopenedTickets];

    // Filtro por estado
    if (this.selectedEstado !== 'todos') {
      filtered = filtered.filter(ticket => ticket.estado === this.selectedEstado);
    }

    // Filtro por búsqueda
    if (this.searchText.trim() !== '') {
      const searchLower = this.searchText.toLowerCase().trim();
      filtered = filtered.filter(ticket => {
        return (
          ticket.id.toString().includes(searchLower) ||
          ticket.categoria?.toLowerCase().includes(searchLower) ||
          ticket.subcategoria?.toLowerCase().includes(searchLower) ||
          ticket.descripcion?.toLowerCase().includes(searchLower) ||
          ticket.prioridad?.toLowerCase().includes(searchLower) ||
          ticket.estado?.toLowerCase().includes(searchLower) ||
          ticket.reapertura?.observacionesUsuario?.toLowerCase().includes(searchLower) ||
          ticket.reapertura?.causaTecnico?.toLowerCase().includes(searchLower)
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

  getEstadoLabel(estado: string): string {
    const estadoObj = this.estados.find(e => e.value === estado);
    return estadoObj ? estadoObj.label : estado;
  }

  verDetalles(ticket: Ticket): void {
    this.selectedTicket = ticket;
    this.showTicketDetails = true;
    console.log('Ver detalles del ticket reabierto:', ticket);

    // Si es técnico y el ticket está en Pendiente, cambiar automáticamente a En Progreso
    if (this.isTecnico && ticket.estado === 'Pendiente' && ticket.mostrarEstadoReabierto) {
      this.cambiarEstadoAutomatico(ticket, 'En Progreso');
    }
  }

  cerrarDetalles(): void {
    this.showTicketDetails = false;
    this.selectedTicket = null;
    if (this.showPendienteModal) {
      this.cerrarModalPendiente();
    }
    if (this.showEscalateModal) {
      this.cerrarEscalamiento();
    }
    if (this.mostrarModalCausa) {
      this.cerrarFormularioCausa();
    }
  }

  abrirFormularioCausa(ticket: Ticket, event: MouseEvent): void {
    event.stopPropagation();
    this.ticketSeleccionadoParaCausa = ticket;
    this.causeForm.reset({
      causa: ticket.reapertura?.causaTecnico || ''
    });
    this.causeForm.markAsPristine();
    this.causeForm.markAsUntouched();
  }

  abrirModalCausa(ticket: Ticket, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.ticketSeleccionadoParaCausa = ticket;
    this.causeForm.reset({
      causa: ticket.reapertura?.causaTecnico || ''
    });
    this.causeForm.markAsPristine();
    this.causeForm.markAsUntouched();
    this.mostrarModalCausa = true;
  }

  cerrarFormularioCausa(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.ticketSeleccionadoParaCausa = null;
    this.isSavingCause = false;
    this.causeForm.reset({
      causa: ''
    });
    this.mostrarModalCausa = false;
  }

  guardarCausa(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    if (!this.ticketSeleccionadoParaCausa) {
      return;
    }

    if (this.causeForm.invalid) {
      this.causeForm.markAllAsTouched();
      return;
    }

    const causa = (this.causeForm.value.causa || '').trim();
    if (!causa) {
      this.causeForm.get('causa')?.setErrors({ required: true });
      return;
    }

    const ticketId = this.ticketSeleccionadoParaCausa.id;
    this.isSavingCause = true;

    this.ticketService.registerReopenCause(ticketId, causa).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.isSavingCause = false;

        const actualizarTicket = (ticket?: Ticket | null) => {
          if (!ticket) {
            return;
          }
          ticket.reapertura = response.reapertura ?? null;
        };

        actualizarTicket(this.ticketSeleccionadoParaCausa);

        const index = this.reopenedTickets.findIndex(ticket => ticket.id === ticketId);
        if (index !== -1) {
          actualizarTicket(this.reopenedTickets[index]);
        }

        this.notificationService.addNotification({
          type: 'success',
          title: 'Causa registrada',
          message: `La causa del ticket #${ticketId} se guardó correctamente.`,
          ticketId: ticketId.toString(),
          actionUrl: `/tickets/reopened`
        });

        this.cerrarFormularioCausa();
        this.loadReopenedTickets();
      },
      error: (error) => {
        this.isSavingCause = false;
        console.error('❌ Error guardando causa de reapertura:', error);
        console.error('❌ Status:', error?.status);
        console.error('❌ Error completo:', error);
        
        let errorMessage = 'No fue posible guardar la causa. Intenta nuevamente.';
        
        if (error?.error?.error) {
          errorMessage = error.error.error;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (error?.status === 500) {
          errorMessage = 'Error interno del servidor. Verifica los logs del servidor para más detalles.';
        } else if (error?.status === 404) {
          errorMessage = 'No se encontró información de reapertura para este ticket.';
        } else if (error?.status === 403) {
          errorMessage = 'No tienes permisos para registrar la causa de este ticket.';
        }
        
        alert(errorMessage);
      }
    });
  }


  guardarPendiente(): void {
    if (!this.ticketPendienteSeleccionado) {
      return;
    }

    if (this.pendienteForm.invalid) {
      this.pendienteForm.markAllAsTouched();
      return;
    }

    const motivo = (this.pendienteForm.value.comentarios || '').trim();
    const tiempoEstimado = (this.pendienteForm.value.pendienteTiempoEstimado || '').trim();

    if (!motivo || !tiempoEstimado) {
      if (!motivo) {
        this.pendienteForm.get('comentarios')?.setErrors({ required: true });
      }
      if (!tiempoEstimado) {
        this.pendienteForm.get('pendienteTiempoEstimado')?.setErrors({ required: true });
      }
      return;
    }

    const ticket = this.ticketPendienteSeleccionado;
    this.isUpdatingStatus = true;

    this.ticketService.updateTicketStatus(ticket.id, 'Pendiente', {
      motivo: motivo,
      pendienteTiempoEstimado: tiempoEstimado
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.isUpdatingStatus = false;
        this.cerrarModalPendiente();
        this.successMessage = `El ticket #${ticket.id} fue marcado como pendiente.`;
        this.showSuccessModal = true;
        this.loadReopenedTickets();
        // Actualizar el ticket seleccionado si está abierto
        if (this.selectedTicket && this.selectedTicket.id === ticket.id) {
          this.selectedTicket.estado = 'Pendiente';
          this.selectedTicket.pendienteMotivo = motivo;
          this.selectedTicket.pendienteTiempoEstimado = tiempoEstimado;
        }
      },
      error: (error) => {
        this.isUpdatingStatus = false;
        console.error('Error marcando ticket como pendiente:', error);
        alert(error.error?.error || 'No fue posible marcar el ticket como pendiente.');
      }
    });
  }

  cambiarEstado(ticket: Ticket, nuevoEstado: string): void {
    if (this.isUpdatingStatus) {
      return;
    }

    // Si es Pendiente, abrir el modal de pendiente
    if (nuevoEstado === 'Pendiente') {
      this.abrirModalPendiente(ticket);
      return;
    }

    // Si es Escalado, abrir el modal de escalamiento
    if (nuevoEstado === 'Escalado') {
      this.abrirEscalamiento(ticket);
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

    this.isUpdatingStatus = true;

    this.ticketService.updateTicketStatus(ticket.id, nuevoEstado).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isUpdatingStatus = false;
        this.notificationService.addNotification({
          type: 'info',
          title: 'Estado actualizado',
          message: `El ticket #${ticket.id} se actualizó a ${nuevoEstado}.`,
          ticketId: ticket.id.toString(),
          actionUrl: `/tickets/reopened`
        });
        this.loadReopenedTickets();
        // Actualizar el ticket seleccionado si está abierto
        if (this.selectedTicket && this.selectedTicket.id === ticket.id) {
          this.selectedTicket.estado = nuevoEstado;
        }
      },
      error: (error) => {
        this.isUpdatingStatus = false;
        // Cerrar modal de éxito si hay error
        if (this.showSuccessModal) {
          this.cerrarSuccessModal();
        }
        console.error('Error actualizando estado:', error);
        alert(error.error?.error || 'No fue posible actualizar el estado.');
      }
    });
  }

  abrirModalPendiente(ticket: Ticket): void {
    this.ticketPendienteSeleccionado = ticket;
    this.pendienteForm.reset({
      comentarios: ticket.pendienteMotivo || '',
      pendienteTiempoEstimado: ticket.pendienteTiempoEstimado || ''
    });
    this.pendienteForm.markAsPristine();
    this.pendienteForm.markAsUntouched();
    this.showPendienteModal = true;
  }

  cerrarModalPendiente(): void {
    this.showPendienteModal = false;
    this.ticketPendienteSeleccionado = null;
    this.pendienteForm.reset();
  }

  abrirEscalamiento(ticket: Ticket): void {
    this.ticketPendienteSeleccionado = ticket;
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
    this.ticketPendienteSeleccionado = null;
    this.escalateForm.reset();
  }

  escalarTicket(): void {
    if (!this.ticketPendienteSeleccionado) {
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

    const ticketId = this.ticketPendienteSeleccionado.id;
    this.isUpdatingStatus = true;

    this.ticketService.escalateTicket(ticketId, {
      tecnicoDestino: tecnicoDestino,
      motivoEscalamiento: motivoEscalamiento
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isUpdatingStatus = false;
        this.notificationService.addNotification({
          type: 'info',
          title: 'Ticket Escalado',
          message: `El ticket #${ticketId} ha sido escalado exitosamente.`,
          ticketId: ticketId.toString(),
          actionUrl: `/tickets/reopened`
        });
        this.cerrarEscalamiento();
        this.loadReopenedTickets();
        // Actualizar el ticket seleccionado si está abierto
        if (this.selectedTicket && this.selectedTicket.id === ticketId) {
          this.selectedTicket.estado = 'Escalado';
        }
      },
      error: (error) => {
        this.isUpdatingStatus = false;
        console.error('Error escalando ticket:', error);
        alert(error.error?.error || 'No fue posible escalar el ticket.');
      }
    });
  }

  cerrarSuccessModal(): void {
    this.showSuccessModal = false;
    this.successMessage = '';
  }

  getEstadoColor(estado: string): string {
    switch (estado.toLowerCase()) {
      case 'pendiente':
        return '#dc3545';
      case 'escalado':
        return '#fd7e14';
      case 'finalizado':
        return '#28a745';
      case 'en progreso':
      case 'en proceso':
        return '#ffc107';
      default:
        return '#6c5ce7';
    }
  }

  private cambiarEstadoAutomatico(ticket: Ticket, nuevoEstado: string): void {
    this.ticketService.updateTicketStatus(ticket.id, nuevoEstado).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        ticket.estado = nuevoEstado;
        this.loadReopenedTickets();
      },
      error: (error) => {
        console.error('Error actualizando estado automáticamente:', error);
      }
    });
  }
}

