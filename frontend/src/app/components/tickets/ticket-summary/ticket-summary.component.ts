import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { TicketService, Ticket } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

interface TicketStats {
  total: number;
  pendientes: number;
  enProceso: number;
  finalizados: number;
  cerrados: number;
  escalados: number;
  reabiertos: number;
  porPrioridad: {
    alta: number;
    media: number;
    baja: number;
  };
  porCategoria: { [key: string]: number };
  ticketsRecientes: Ticket[];
}

type EstadoClave = 'pendiente' | 'enProgreso' | 'finalizado' | 'escalado' | 'reabierto' | 'cerrado' | 'otros';

interface EstadoSection {
  key: EstadoClave;
  title: string;
  description: string;
  color: string;
  icon: string;
}

@Component({
  selector: 'app-ticket-summary',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ticket-summary.component.html',
  styleUrls: ['./ticket-summary.component.css']
})
export class TicketSummaryComponent implements OnInit, OnDestroy {
  tickets: Ticket[] = [];
  stats: TicketStats = this.getInitialStats();
  isLoading = false;
  canReopenTickets = false;
  ticketsPorEstado: Record<EstadoClave, Ticket[]> = this.getInitialEstadoBuckets();
  showReopenModal = false;
  reopenForm: FormGroup;
  ticketSeleccionado: Ticket | null = null;
  isSubmittingReopen = false;
  private destroy$ = new Subject<void>();

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.reopenForm = this.fb.group({
      observaciones: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]]
    });
  }

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    this.canReopenTickets = currentUser?.rol === 'empleado';
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
        this.tickets = tickets;
        this.calculateStats();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando tickets:', error);
        this.isLoading = false;
      }
    });
  }

  calculateStats(): void {
    this.stats = this.getInitialStats();
    this.stats.total = this.tickets.length;
    this.ticketsPorEstado = this.getInitialEstadoBuckets();

    this.tickets.forEach(ticket => {
      const estadoLower = ticket.estado.toLowerCase();
      const esReabierto = !!ticket.reapertura;

      if (esReabierto) {
        this.stats.reabiertos++;
        ticket.mostrarEstadoReabierto = true;
        this.agregarTicketAEstado('reabierto', ticket);
      }

      if (!esReabierto) {
        switch (estadoLower) {
          case 'pendiente':
          case 'abierto':
            this.stats.pendientes++;
            this.agregarTicketAEstado('pendiente', ticket);
            break;
          case 'en proceso':
          case 'en_proceso':
          case 'en progreso':
            this.stats.enProceso++;
            this.agregarTicketAEstado('enProgreso', ticket);
            break;
          case 'finalizado':
            this.stats.finalizados++;
            this.agregarTicketAEstado('finalizado', ticket);
            break;
          case 'escalado':
            this.stats.escalados++;
            this.agregarTicketAEstado('escalado', ticket);
            break;
          case 'reabierto':
          case 're-abierto':
          case 're_abierto':
            this.stats.reabiertos++;
            this.agregarTicketAEstado('reabierto', ticket);
            break;
          case 'cerrado':
            this.stats.cerrados++;
            this.agregarTicketAEstado('cerrado', ticket);
            break;
          default:
            this.agregarTicketAEstado('otros', ticket);
            break;
        }
      }

      switch (ticket.prioridad.toLowerCase()) {
        case 'alta':
          this.stats.porPrioridad.alta++;
          break;
        case 'media':
          this.stats.porPrioridad.media++;
          break;
        case 'baja':
          this.stats.porPrioridad.baja++;
          break;
      }

      if (ticket.categoria) {
        if (this.stats.porCategoria[ticket.categoria]) {
          this.stats.porCategoria[ticket.categoria]++;
        } else {
          this.stats.porCategoria[ticket.categoria] = 1;
        }
      }
    });

    this.stats.ticketsRecientes = this.tickets
      .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
      .slice(0, 5);
  }

  getEstadoColor(estado: string): string {
    switch (estado.toLowerCase()) {
      case 'pendiente':
      case 'abierto':
        return '#f39c12';
      case 'en proceso':
      case 'en_proceso':
      case 'en progreso':
        return '#3498db';
      case 'finalizado':
        return '#6c5ce7';
      case 'escalado':
        return '#e74c3c';
      case 'reabierto':
      case 're-abierto':
      case 're_abierto':
        return '#9b59b6';
      case 'cerrado':
        return '#27ae60';
      default:
        return '#95a5a6';
    }
  }

  getEstadoLabel(estado: string): string {
    switch (estado.toLowerCase()) {
      case 'pendiente':
      case 'abierto':
        return 'Pendiente';
      case 'en proceso':
      case 'en_proceso':
      case 'en progreso':
        return 'En Proceso';
      case 'finalizado':
        return 'Finalizado';
      case 'escalado':
        return 'Escalado';
      case 'cerrado':
        return 'Cerrado';
      case 'reabierto':
      case 're-abierto':
      case 're_abierto':
        return 'Reabierto';
      default:
        return estado;
    }
  }

  getPrioridadColor(prioridad: string): string {
    switch (prioridad.toLowerCase()) {
      case 'alta':
        return '#e74c3c';
      case 'media':
        return '#f39c12';
      case 'baja':
        return '#27ae60';
      default:
        return '#95a5a6';
    }
  }

  getPorcentaje(valor: number, total: number): number {
    return total > 0 ? Math.round((valor / total) * 100) : 0;
  }

  getCategoriasArray(): { categoria: string; cantidad: number }[] {
    return Object.entries(this.stats.porCategoria)
      .map(([categoria, cantidad]) => ({ categoria, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }

  getEstadoSections(): EstadoSection[] {
    const sections: EstadoSection[] = [
      {
        key: 'pendiente',
        title: 'Pendientes',
        description: 'Tickets en espera de ser atendidos',
        color: '#f39c12',
        icon: 'far fa-clock'
      },
      {
        key: 'enProgreso',
        title: 'En Proceso',
        description: 'Tickets actualmente en trabajo',
        color: '#3498db',
        icon: 'fas fa-spinner'
      },
      {
        key: 'finalizado',
        title: 'Finalizados',
        description: 'Tickets resueltos pendientes de evaluación',
        color: '#6c5ce7',
        icon: 'fas fa-clipboard-check'
      },
      {
        key: 'escalado',
        title: 'Escalados',
        description: 'Tickets enviados a un nivel superior',
        color: '#e74c3c',
        icon: 'fas fa-exclamation-triangle'
      },
      {
        key: 'reabierto',
        title: 'Reabiertos',
        description: 'Tickets que han sido abiertos nuevamente',
        color: '#9b59b6',
        icon: 'fas fa-undo-alt'
      },
      {
        key: 'cerrado',
        title: 'Cerrados',
        description: 'Tickets completados y cerrados',
        color: '#27ae60',
        icon: 'fas fa-lock'
      }
    ];

    if (this.ticketsPorEstado.otros.length > 0) {
      sections.push({
        key: 'otros',
        title: 'Otros Estados',
        description: 'Estados fuera del flujo estándar',
        color: '#95a5a6',
        icon: 'fas fa-question-circle'
      });
    }

    return sections;
  }

  getTicketsByState(section: EstadoSection): Ticket[] {
    return this.ticketsPorEstado[section.key] ?? [];
  }

  getTicketsCount(section: EstadoSection): number {
    return this.getTicketsByState(section).length;
  }

  truncateDescription(ticket: Ticket, limit = 80): string {
    const description = ticket.descripcion || '';
    return description.length > limit
      ? `${description.slice(0, limit)}...`
      : description;
  }

  abrirModalReapertura(ticket: Ticket): void {
    if (!this.canReopenTickets) {
      return;
    }

    this.ticketSeleccionado = ticket;
    this.reopenForm.reset({ observaciones: '' });
    this.reopenForm.markAsPristine();
    this.reopenForm.markAsUntouched();
    this.showReopenModal = true;
  }

  cerrarModalReapertura(): void {
    this.showReopenModal = false;
    this.ticketSeleccionado = null;
    this.isSubmittingReopen = false;
  }

  enviarReapertura(): void {
    if (!this.ticketSeleccionado || this.reopenForm.invalid) {
      this.reopenForm.markAllAsTouched();
      return;
    }

    const observaciones = (this.reopenForm.value.observaciones || '').trim();
    if (!observaciones) {
      this.reopenForm.get('observaciones')?.setErrors({ required: true });
      return;
    }

    this.isSubmittingReopen = true;
    const ticketId = this.ticketSeleccionado.id;

    this.ticketService.reopenTicket(ticketId, observaciones)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isSubmittingReopen = false;
          this.showReopenModal = false;

          const actualizarTicket = (ticket: Ticket) => {
            ticket.estado = response.estatus;
            ticket.pendienteMotivo = response.pendienteMotivo ?? null;
            ticket.pendienteTiempoEstimado = response.pendienteTiempoEstimado ?? null;
            ticket.pendienteActualizadoEn = response.pendienteActualizadoEn ?? null;
            ticket.reapertura = response.reapertura ?? null;
            ticket.mostrarEstadoReabierto = response.reapertura ? true : false;
          };

          actualizarTicket(this.ticketSeleccionado!);

          const index = this.tickets.findIndex(t => t.id === ticketId);
          if (index !== -1) {
            actualizarTicket(this.tickets[index]);
          }

          this.calculateStats();

          this.notificationService.addNotification({
            type: 'info',
            title: 'Ticket Reabierto',
            message: `El ticket #${ticketId} fue reabierto correctamente.`,
            ticketId: ticketId.toString(),
            actionUrl: `/tickets/reopened`
          });

          this.ticketSeleccionado = null;

          this.router.navigate(['/tickets/reopened']);
        },
        error: (error) => {
          this.isSubmittingReopen = false;
          console.error('❌ Error reabriendo ticket:', error);
          alert(error.error?.error || 'No fue posible reabrir el ticket. Intenta nuevamente.');
        }
      });
  }

  private getInitialStats(): TicketStats {
    return {
      total: 0,
      pendientes: 0,
      enProceso: 0,
      finalizados: 0,
      cerrados: 0,
      escalados: 0,
      reabiertos: 0,
      porPrioridad: {
        alta: 0,
        media: 0,
        baja: 0
      },
      porCategoria: {},
      ticketsRecientes: []
    };
  }

  private getInitialEstadoBuckets(): Record<EstadoClave, Ticket[]> {
    return {
      pendiente: [],
      enProgreso: [],
      finalizado: [],
      escalado: [],
      reabierto: [],
      cerrado: [],
      otros: []
    };
  }

  private agregarTicketAEstado(key: EstadoClave, ticket: Ticket): void {
    this.ticketsPorEstado[key].push(ticket);
  }
}
