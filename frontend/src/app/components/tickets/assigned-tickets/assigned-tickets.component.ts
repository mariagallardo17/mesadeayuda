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
    this.ticketService.getMyTickets().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (tickets) => {
        // Filtrar solo tickets que están asignados al técnico actual
        const currentUser = this.authService.getCurrentUser();
        this.tickets = tickets.filter(ticket =>
          ticket.tecnicoAsignado &&
          ticket.estado !== 'Cerrado' &&
          !ticket.reapertura
        );
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando tickets:', error);
        this.isLoading = false;
      }
    });
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
}
