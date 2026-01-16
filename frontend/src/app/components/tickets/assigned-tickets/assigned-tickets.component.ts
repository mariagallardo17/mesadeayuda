import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TicketService, Ticket } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { CountdownComponent } from '../../shared/countdown/countdown.component';

@Component({
  selector: 'app-assigned-tickets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CountdownComponent],
  templateUrl: './assigned-tickets.component.html',
  styleUrls: ['./assigned-tickets.component.css']
})
export class AssignedTicketsComponent implements OnInit, OnDestroy {
  tickets: Ticket[] = [];
  selectedTicket: Ticket | null = null;
  showTicketDetails = false;
  isLoading = false;
  showAutoChangeNotification = false;
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

  // Formulario para cambio de estado
  statusForm: FormGroup;

  // Estados disponibles para técnicos
  estados = [
    { value: 'Pendiente', label: 'PENDIENTE', color: '#dc3545' },
    { value: 'En Progreso', label: 'EN PROGRESO', color: '#ffc107' },
    { value: 'Finalizado', label: 'FINALIZADO', color: '#28a745' },
    { value: 'Escalado', label: 'ESCALADO', color: '#fd7e14' }
  ];

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.statusForm = this.fb.group({
      nuevoEstado: ['', Validators.required],
      comentarios: [''],
      pendienteTiempoEstimado: ['']
    });

    this.statusForm.get('nuevoEstado')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe((estado: string) => {
      if (estado === 'Pendiente') {
        this.statusForm.get('comentarios')?.setValidators([Validators.required, Validators.maxLength(500)]);
        this.statusForm.get('pendienteTiempoEstimado')?.setValidators([Validators.required, Validators.maxLength(100)]);
      } else {
        this.statusForm.get('comentarios')?.clearValidators();
        this.statusForm.get('pendienteTiempoEstimado')?.clearValidators();
      }

      this.statusForm.get('comentarios')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      this.statusForm.get('pendienteTiempoEstimado')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
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
    // Cargar todos los tickets sin paginación (límite muy alto)
    this.ticketService.getMyTickets(1, 10000).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        // Validar que la respuesta sea válida
        if (!response) {
          console.warn('⚠️ Respuesta vacía del servidor');
          this.tickets = [];
          this.resetPagination();
          this.isLoading = false;
          return;
        }

        // Extraer tickets de la respuesta paginada (validar formato)
        let tickets: any[] = [];
        if (response && typeof response === 'object') {
          if (response.tickets && Array.isArray(response.tickets)) {
            tickets = response.tickets;
          } else if (Array.isArray(response)) {
            tickets = response;
          } else {
            console.warn('⚠️ Formato de respuesta no reconocido:', response);
            tickets = [];
          }
        } else {
          tickets = [];
        }

        // Filtrar solo tickets que están asignados al técnico actual
        // Excluir tickets cerrados (el backend ya excluye tickets reabiertos)
        const currentUser = this.authService.getCurrentUser();
        this.tickets = tickets.filter((ticket: any) => {
          if (!ticket || typeof ticket !== 'object') return false;
          if (!ticket.tecnicoAsignado) return false;
          
          const estadoLower = (ticket.estado || '').toLowerCase().trim();
          const esCerrado = estadoLower === 'cerrado' || 
                           estadoLower.startsWith('cerr') ||
                           estadoLower === 'cerr';
          
          // Excluir tickets cerrados (los tickets reabiertos ya están excluidos por el backend)
          return !esCerrado;
        });
        
        // Actualizar información de paginación
        if (response && response.pagination && typeof response.pagination === 'object') {
          this.paginationInfo = response.pagination;
          this.totalItems = response.pagination.total || 0;
          this.totalPages = response.pagination.totalPages || 0;
          this.startItem = response.pagination.startItem || 0;
          this.endItem = response.pagination.endItem || 0;
          this.hasNextPage = response.pagination.hasNextPage || false;
          this.hasPrevPage = response.pagination.hasPrevPage || false;
        } else {
          // Si no hay paginación, calcularla
          this.resetPagination();
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error cargando tickets:', error);
        this.tickets = [];
        this.resetPagination();
        this.isLoading = false;
        
        // No mostrar alert si es error 401 (ya se maneja en el interceptor)
        if (error?.status !== 401) {
          const errorMsg = error?.error?.error || error?.message || 'Error al cargar los tickets';
          console.error('Error detallado:', errorMsg);
        }
      }
    });
  }

  private resetPagination(): void {
    this.totalItems = this.tickets.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage) || 1;
    this.startItem = this.tickets.length > 0 ? 1 : 0;
    this.endItem = this.tickets.length;
    this.hasNextPage = false;
    this.hasPrevPage = false;
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
    this.currentPage = 1;
    this.loadTickets();
  }

  getPaginationArray(): number[] {
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
    this.statusForm.reset({
      nuevoEstado: '',
      comentarios: '',
      pendienteTiempoEstimado: ''
    });

    // Si el ticket está pendiente, cambiarlo automáticamente a "En Progreso"
    // Solo si el técnico asignado abre el ticket
    const tienePendienteManual = !!ticket.pendienteMotivo;
    const currentUser = this.authService.getCurrentUser();
    const esTecnicoOAdmin = currentUser?.rol === 'tecnico' || currentUser?.rol === 'administrador';
    
    // En assigned-tickets, todos los tickets ya están asignados al técnico actual
    // Por lo tanto, si es técnico/admin y el ticket está pendiente, cambiar automáticamente
    if (esTecnicoOAdmin && ticket.estado === 'Pendiente' && !tienePendienteManual) {
      console.log('✅ Técnico abriendo ticket asignado - Cambiando estado automáticamente a En Progreso');
      this.cambiarEstadoAutomatico(ticket, 'En Progreso');
    } else {
      console.log('ℹ️ No se cambia el estado automáticamente:', {
        esTecnicoOAdmin,
        estado: ticket.estado,
        tienePendienteManual
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
  }

  cambiarEstado(): void {
    if (this.statusForm.valid && this.selectedTicket) {
      const nuevoEstado = this.statusForm.get('nuevoEstado')?.value;
      const comentariosRaw = this.statusForm.get('comentarios')?.value;
      const pendienteTiempoRaw = this.statusForm.get('pendienteTiempoEstimado')?.value;
      const comentarios = typeof comentariosRaw === 'string' ? comentariosRaw.trim() : comentariosRaw;
      const pendienteTiempoEstimado = typeof pendienteTiempoRaw === 'string' ? pendienteTiempoRaw.trim() : pendienteTiempoRaw;
      const options = nuevoEstado === 'Pendiente'
        ? { comentarios, pendienteTiempoEstimado }
        : (comentarios ? { comentarios } : undefined);

      this.ticketService.updateTicketStatus(
        this.selectedTicket.id,
        nuevoEstado,
        options
      ).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          console.log('Estado actualizado:', response);
          this.selectedTicket!.estado = nuevoEstado;
          this.selectedTicket!.pendienteMotivo = response.pendienteMotivo ?? (nuevoEstado === 'Pendiente' ? comentarios : null);
          this.selectedTicket!.pendienteTiempoEstimado = response.pendienteTiempoEstimado ?? (nuevoEstado === 'Pendiente' ? pendienteTiempoEstimado : null);
          this.selectedTicket!.pendienteActualizadoEn = response.pendienteActualizadoEn ?? (nuevoEstado === 'Pendiente' ? new Date().toISOString() : null);

          // Agregar notificación de cambio de estado
          this.notificationService.addNotification({
            type: 'info',
            title: 'Estado Actualizado',
            message: `El ticket #${this.selectedTicket!.id} cambió de estado a '${nuevoEstado}'`,
            actionUrl: `/tickets/tracking?ticketId=${this.selectedTicket!.id}`
          });

          this.statusForm.reset();
          this.cerrarDetalles();
          this.loadTickets(); // Recargar la lista
        },
        error: (error) => {
          console.error('Error actualizando estado:', error);
          alert('Error al actualizar el estado del ticket');
        }
      });
    }
  }

  getEstadoColor(estado: string): string {
    const estadoInfo = this.estados.find(e => e.value === estado);
    return estadoInfo ? estadoInfo.color : '#6c757d';
  }

  getEstadoLabel(estado: string): string {
    const estadoInfo = this.estados.find(e => e.value === estado);
    return estadoInfo ? estadoInfo.label : estado;
  }

  parseDate(dateString: string): Date {
    return new Date(dateString);
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
}
