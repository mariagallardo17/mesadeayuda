import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { TicketService, Ticket } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-ticket-tracking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ticket-tracking.component.html',
  styleUrls: ['./ticket-tracking.component.css']
})
export class TicketTrackingComponent implements OnInit, OnDestroy {
  tickets: Ticket[] = [];
  filteredTickets: Ticket[] = [];
  selectedTicket: Ticket | null = null;
  showTicketDetails = false;
  isLoading = false;
  searchQuery = '';
  showAutoChangeNotification = false;
  showReopenModal = false;
  isSubmittingReopen = false;
  ticketReaperturaSeleccionado: Ticket | null = null;
  reopenForm!: FormGroup;
  private destroy$ = new Subject<void>();

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  totalPages: number = 0;
  startItem: number = 0;
  endItem: number = 0;
  hasNextPage: boolean = false;
  hasPrevPage: boolean = false;
  paginationInfo: any = null;

  // Estados disponibles con colores
  estados = [
    { value: 'Pendiente', label: 'PENDIENTE', color: 'red' },
    { value: 'En Progreso', label: 'EN PROGRESO', color: 'yellow' },
    { value: 'Escalado', label: 'ESCALADO', color: 'lightgreen' },
    { value: 'Finalizado', label: 'FINALIZADO', color: 'darkgreen' },
    { value: 'Reabierto', label: 'REABIERTO', color: '#9b59b6' },
    { value: 'Cerrado', label: 'CERRADO', color: 'blue' }
  ];

  // Formulario de búsqueda
  searchForm: FormGroup;

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      ticketId: ['']
    });

    this.reopenForm = this.fb.group({
      observaciones: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]]
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
    console.log('🔄 Cargando tickets en seguimiento...');
    this.ticketService.getMyTickets(this.currentPage, this.itemsPerPage).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        // Extraer tickets de la respuesta paginada
        const tickets = response.tickets || [];
        console.log('📋 Tickets recibidos del backend:', tickets.length);
        console.log('📋 Lista completa de tickets:', tickets);
        const visibles = tickets.filter((ticket: any) => !ticket.reapertura);
        console.log('✅ Tickets visibles (sin reapertura):', visibles.length);
        console.log('✅ Lista de tickets visibles:', visibles);
        this.tickets = visibles;
        this.filteredTickets = visibles;
        
        // Actualizar información de paginación
        if (response.pagination) {
          this.paginationInfo = response.pagination;
          this.totalItems = response.pagination.total || 0;
          this.totalPages = response.pagination.totalPages || 0;
          this.startItem = response.pagination.startItem || 0;
          this.endItem = response.pagination.endItem || 0;
          this.hasNextPage = response.pagination.hasNextPage || false;
          this.hasPrevPage = response.pagination.hasPrevPage || false;
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error cargando tickets:', error);
        console.error('❌ Detalles del error:', error.error);
        this.isLoading = false;
        alert('Error al cargar los tickets: ' + (error.error?.error || error.message));
      }
    });
  }

  onSearch(): void {
    const ticketId = this.searchForm.get('ticketId')?.value?.trim();

    if (!ticketId) {
      // Si no hay búsqueda, mostrar todos los tickets
      this.filteredTickets = this.tickets;
      return;
    }

    // Filtrar por ID del ticket
    this.filteredTickets = this.tickets.filter(ticket =>
      ticket.id.toString().toLowerCase().includes(ticketId.toLowerCase())
    );
  }

  clearSearch(): void {
    this.searchForm.get('ticketId')?.setValue('');
    this.filteredTickets = this.tickets;
  }

  // Métodos de paginación
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadTickets();
    }
  }

  changeItemsPerPage(newLimit: number): void {
    this.itemsPerPage = newLimit;
    this.currentPage = 1; // Reset a la primera página
    this.loadTickets();
  }

  getPaginationArray(): number[] {
    const pages: number[] = [];
    const maxPages = 5; // Máximo de números de página a mostrar
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

  getDisplayedRange(): string {
    if (this.totalItems === 0) {
      return '0';
    }
    return `${this.startItem} - ${this.endItem}`;
  }

  onPageChange(page: number): void {
    this.goToPage(page);
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const newLimit = parseInt(target.value, 10);
    this.changeItemsPerPage(newLimit);
  }

  verDetalles(ticket: Ticket): void {
    this.selectedTicket = ticket;
    this.showTicketDetails = true;
    console.log('Ver detalles del ticket:', ticket);

    // SOLO técnicos y administradores pueden cambiar automáticamente el estado
    // Y solo si el ticket está asignado a ellos o lo crearon
    const currentUser = this.authService.getCurrentUser();
    const esTecnicoOAdmin = currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador';
    const tienePendienteManual = !!ticket.pendienteMotivo;
    
    // Verificar si el usuario es el técnico asignado o el creador del ticket
    const esTecnicoAsignado = ticket.tecnicoAsignado && (
      (typeof ticket.tecnicoAsignado === 'object' && ticket.tecnicoAsignado.nombre) ||
      (typeof ticket.tecnicoAsignado === 'string')
    );
    const esCreadorDelTicket = currentUser?.id && ticket.usuarioId === currentUser.id;
    
    if (esTecnicoOAdmin && ticket.estado === 'Pendiente' && !tienePendienteManual && (esTecnicoAsignado || esCreadorDelTicket)) {
      console.log('✅ Usuario autorizado - Cambiando estado automáticamente a En Progreso');
      this.cambiarEstadoAutomatico(ticket, 'En Progreso');
    } else {
      console.log('❌ No se cambia el estado automáticamente:', {
        esTecnicoOAdmin,
        estado: ticket.estado,
        tienePendienteManual,
        esTecnicoAsignado,
        esCreadorDelTicket
      });
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
        // Actualizar también en la lista filtrada si existe
        const filteredIndex = this.filteredTickets.findIndex(t => t.id === ticket.id);
        if (filteredIndex !== -1) {
          this.filteredTickets[filteredIndex].estado = nuevoEstado;
          this.filteredTickets[filteredIndex].pendienteMotivo = response.pendienteMotivo ?? null;
          this.filteredTickets[filteredIndex].pendienteTiempoEstimado = response.pendienteTiempoEstimado ?? null;
          this.filteredTickets[filteredIndex].pendienteActualizadoEn = response.pendienteActualizadoEn ?? null;
        }

        // Agregar notificación de cambio de estado
        this.notificationService.addNotification({
          type: 'info',
          title: 'Estado Actualizado',
          message: `El ticket #${ticket.id} cambió de estado a '${nuevoEstado}'`,
          actionUrl: `/tickets/tracking?ticketId=${ticket.id}`
        });

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

  cerrarDetalles(): void {
    this.showTicketDetails = false;
    this.selectedTicket = null;
    this.cerrarModalReapertura();
  }

  getEstadoColor(estado: string): string {
    const estadoObj = this.estados.find(e => e.value === estado);
    return estadoObj ? estadoObj.color : 'gray';
  }

  getEstadoLabel(estado: string): string {
    const estadoObj = this.estados.find(e => e.value === estado);
    return estadoObj ? estadoObj.label : estado;
  }

  getPrioridadClass(prioridad: string): string {
    switch (prioridad.toLowerCase()) {
      case 'alta':
        return 'priority-high';
      case 'media':
        return 'priority-medium';
      case 'baja':
        return 'priority-low';
      default:
        return 'priority-medium';
    }
  }

  getPrioridadText(prioridad: string): string {
    return prioridad.toUpperCase();
  }

  getDiasTranscurridos(fechaCreacion: string | Date): number {
    const fecha = new Date(fechaCreacion);
    const hoy = new Date();
    const diffTime = hoy.getTime() - fecha.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getTecnicoAsignado(ticket: Ticket): string {
    if (!ticket.tecnicoAsignado) {
      return 'Sin asignar';
    }
    if (typeof ticket.tecnicoAsignado === 'object' && 'nombre' in ticket.tecnicoAsignado) {
      return ticket.tecnicoAsignado.nombre;
    }
    return ticket.tecnicoAsignado;
  }

  abrirModalReapertura(ticket: Ticket): void {
    this.ticketReaperturaSeleccionado = ticket;
    this.reopenForm.reset({
      observaciones: ''
    });
    this.reopenForm.markAsPristine();
    this.reopenForm.markAsUntouched();
    this.showReopenModal = true;
  }

  cerrarModalReapertura(): void {
    this.showReopenModal = false;
    this.isSubmittingReopen = false;
    this.ticketReaperturaSeleccionado = null;
    this.reopenForm.reset({
      observaciones: ''
    });
  }

  enviarReapertura(): void {
    if (!this.ticketReaperturaSeleccionado) {
      return;
    }

    if (this.reopenForm.invalid) {
      this.reopenForm.markAllAsTouched();
      return;
    }

    const observaciones = (this.reopenForm.value.observaciones || '').trim();
    if (!observaciones) {
      this.reopenForm.get('observaciones')?.setErrors({ required: true });
      return;
    }

    this.isSubmittingReopen = true;
    const ticketId = this.ticketReaperturaSeleccionado.id;

    this.ticketService.reopenTicket(ticketId, observaciones).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.isSubmittingReopen = false;
        this.cerrarModalReapertura();

        const applyResponse = (ticket: Ticket) => {
          ticket.estado = response.estatus;
          ticket.pendienteMotivo = response.pendienteMotivo ?? null;
          ticket.pendienteTiempoEstimado = response.pendienteTiempoEstimado ?? null;
          ticket.pendienteActualizadoEn = response.pendienteActualizadoEn ?? null;
          ticket.reapertura = response.reapertura ?? null;
          ticket.mostrarEstadoReabierto = response.reapertura ? true : false;
        };

        const updateList = (list: Ticket[]) => {
          const index = list.findIndex(t => t.id === ticketId);
          if (index !== -1) {
            applyResponse(list[index]);
            if (list[index].reapertura) {
              list.splice(index, 1);
            }
          }
        };

        if (this.selectedTicket?.id === ticketId) {
          applyResponse(this.selectedTicket);
          if (this.selectedTicket.reapertura) {
            this.selectedTicket = null;
            this.showTicketDetails = false;
          }
        }

        updateList(this.tickets);
        updateList(this.filteredTickets);

        this.notificationService.addNotification({
          type: 'info',
          title: 'Ticket Reabierto',
          message: `El ticket #${ticketId} fue reabierto correctamente.`,
          ticketId: ticketId.toString(),
          actionUrl: `/tickets/reopened`
        });

        this.router.navigate(['/tickets/reopened']);
      },
      error: (error) => {
        this.isSubmittingReopen = false;
        console.error('❌ Error reabriendo ticket:', error);
        const mensaje = error.error?.error || 'No fue posible reabrir el ticket. Intenta nuevamente.';
        alert(mensaje);
      }
    });
  }

  parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: any): void {
    if (this.showTicketDetails) {
      this.cerrarDetalles();
    }
  }
}
