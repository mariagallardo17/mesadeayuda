import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TicketService } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth.service';

interface TicketDetails {
  id: number;
  categoria?: string;
  subcategoria?: string;
  descripcion: string;
  estado: string;
  prioridad: string;
  fechaCreacion: string;
  tecnicoAsignado?: string;
  archivos?: string[];
  evaluacionCierreAutomatico?: boolean;
  evaluacion?: {
    calificacion: number;
    comentario: string;
    fechaEvaluacion: string;
  };
}

@Component({
  selector: 'app-close-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './close-ticket.component.html',
  styleUrls: ['./close-ticket.component.css']
})
export class CloseTicketComponent implements OnInit, OnDestroy {
  searchForm: FormGroup;
  closeForm: FormGroup;
  ticketDetails: TicketDetails | null = null;
  tickets: TicketDetails[] = []; // Lista de tickets finalizados
  isLoading = false;
  isSearching = false;
  showCloseForm = false;
  rating = 0;
  hoverRating = 0;
  showSuccessModal = false;
  showErrorModal = false;
  successMessage = '';
  errorMessage = '';
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      ticketId: ['', [Validators.required, Validators.pattern(/^\d+$/)]]
    });

    this.closeForm = this.fb.group({
      rating: [0, [Validators.required, Validators.min(1)]],
      comentarios: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Suscribirse a cambios en el rating
    this.closeForm.get('rating')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(rating => {
      this.rating = rating;
    });

    // Asegurar que los modales estén cerrados al inicializar
    this.isLoading = false;
    this.isSearching = false;
    this.showCloseForm = false;

    // Verificar si hay un ticketId en los queryParams
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      const ticketId = params['ticketId'];
      if (ticketId) {
        console.log('🎫 TicketId recibido en queryParams:', ticketId);
        // Buscar y mostrar el ticket automáticamente
        this.searchForm.patchValue({ ticketId: ticketId });
        this.loadTicketById(parseInt(ticketId, 10));
        // Limpiar el queryParam después de leerlo
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      } else {
        // Cargar tickets finalizados automáticamente al inicializar
        this.loadFinalizedTickets();
      }
    });

    // Timeout de seguridad para cerrar modales bloqueados
    setTimeout(() => {
      if (this.isLoading) {
        console.log('⚠️ Timeout de seguridad: cerrando modal bloqueado');
        this.forceCloseAllModals();
      }
    }, 10000); // 10 segundos
  }

  loadTicketById(ticketId: number): void {
    console.log('🔍 Cargando ticket por ID:', ticketId);
    this.isSearching = true;
    this.ticketService.getTicketById(ticketId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (ticket) => {
        console.log('✅ Ticket encontrado:', ticket);
        // Si ya tiene evaluación, recargar lista y no mostrar formulario
        if (this.hasEvaluation(ticket)) {
          console.log('⚠️ El ticket ya está evaluado');
          this.isSearching = false;
          this.loadFinalizedTickets();
          return;
        }
        // Si no tiene evaluación, mostrar formulario directamente
        this.ticketDetails = ticket;
        this.showCloseForm = true;
        this.isSearching = false;
      },
      error: (error) => {
        console.error('❌ Error buscando ticket:', error);
        this.isSearching = false;
        this.errorMessage = 'Ticket no encontrado o no tienes permisos para verlo';
        this.showErrorModal = true;
        // Si no se encuentra, cargar la lista de tickets finalizados
        this.loadFinalizedTickets();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(): void {
    if (this.searchForm.valid) {
      this.isSearching = true;
      const ticketId = this.searchForm.get('ticketId')?.value;

      // Simular búsqueda del ticket (aquí deberías implementar la búsqueda real)
      this.ticketService.getTicketById(ticketId).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
      next: (ticket) => {
        // Si ya tiene evaluación, recargar lista
        if (this.hasEvaluation(ticket)) {
          console.log('⚠️ El ticket ya está evaluado');
          this.isSearching = false;
          this.loadFinalizedTickets();
          return;
        }
        // Si no tiene evaluación, mostrar formulario directamente
        this.ticketDetails = ticket;
        this.showCloseForm = true;
        this.isSearching = false;
      },
        error: (error) => {
          console.error('Error buscando ticket:', error);
          this.isSearching = false;
          this.errorMessage = 'Ticket no encontrado o no tienes permisos para verlo';
          this.showErrorModal = true;
        }
      });
    }
  }

  setRating(rating: number): void {
    this.rating = rating;
    this.closeForm.patchValue({ rating });
  }

  onRatingHover(rating: number): void {
    this.hoverRating = rating;
  }

  onRatingLeave(): void {
    this.hoverRating = 0;
  }

  onCloseTicket(): void {
    if (!this.ticketDetails) {
      this.errorMessage = 'No hay ticket seleccionado';
      this.showErrorModal = true;
      return;
    }

    // Verificar si ya tiene evaluación (si aparece en la lista, no debería tenerla, pero verificamos por seguridad)
    if (this.hasEvaluation(this.ticketDetails)) {
      console.log('⚠️ El ticket ya está evaluado');
      this.resetForm();
      this.loadFinalizedTickets();
      return;
    }

    if (this.closeForm.valid) {
      console.log('🔄 Iniciando cierre de ticket...');
      this.isLoading = true;

      const closeData = {
        ticketId: this.ticketDetails.id,
        rating: this.closeForm.get('rating')?.value,
        comentarios: this.closeForm.get('comentarios')?.value
      };

      console.log('📤 Enviando datos:', closeData);

      this.ticketService.closeTicketWithEvaluation(closeData).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          console.log('✅ Respuesta del servidor:', response);
          this.isLoading = false;
          this.successMessage = 'Ticket cerrado y evaluado exitosamente';
          this.showSuccessModal = true;
          // Recargar la lista de tickets después de un delay
          setTimeout(() => {
            this.resetForm();
            this.loadFinalizedTickets();
          }, 2000);
        },
        error: (error) => {
          console.error('❌ Error cerrando ticket:', error);
          this.isLoading = false;
          const errorMsg = error.error?.error || error.message || 'Error desconocido al cerrar el ticket';

          // Si el error es que ya está evaluado, recargar la lista
          if (errorMsg.includes('ya está cerrado y evaluado') || errorMsg.includes('ya está evaluado')) {
            this.errorMessage = 'El ticket ya está cerrado y evaluado. No se puede volver a evaluar.';
            this.resetForm();
            this.loadFinalizedTickets();
          } else {
            this.errorMessage = errorMsg;
          }

          this.showErrorModal = true;
          console.log('🔄 Estado isLoading después del error:', this.isLoading);
        }
      });
    } else {
      if (this.closeForm.get('rating')?.value < 1) {
        this.errorMessage = 'Evaluar el ticket es obligatorio';
        this.showErrorModal = true;
      } else {
        this.errorMessage = 'Por favor, complete todos los campos requeridos';
        this.showErrorModal = true;
      }
    }
  }

  forceCloseModal(): void {
    console.log('🚨 Forzando cierre del modal de emergencia');
    this.isLoading = false;
    this.isSearching = false;
    this.showCloseForm = false;
    this.resetForm();
  }

  resetForm(): void {
    this.searchForm.reset();
    this.closeForm.reset();
    this.ticketDetails = null;
    this.showCloseForm = false;
    this.rating = 0;
    this.hoverRating = 0;
  }

  getStars(): number[] {
    return [1, 2, 3, 4, 5];
  }

  getStarClass(star: number): string {
    const currentRating = this.hoverRating || this.rating;
    return star <= currentRating ? 'star-filled' : 'star-empty';
  }

  // Cargar tickets finalizados del usuario
  loadFinalizedTickets(): void {
    this.isSearching = true;
    this.ticketService.getMyTickets().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (tickets) => {
        console.log('Todos los tickets recibidos:', tickets);
        // Filtrar tickets que pueden ser evaluados:
        // - Tickets finalizados sin evaluación
        // - Tickets cerrados por sistema sin evaluación
        this.tickets = tickets.filter(ticket => {
          // Verificar que no tenga evaluación
          if (this.hasEvaluation(ticket)) {
            return false;
          }
          // Verificar cierre automático - puede venir como true, 1, o '1'
          const evaluacionCierre = ticket.evaluacionCierreAutomatico;
          const esCierreAutomatico = evaluacionCierre === true ||
                                     (typeof evaluacionCierre === 'number' && evaluacionCierre === 1) ||
                                     (typeof evaluacionCierre === 'string' && evaluacionCierre === '1');
          // Mostrar si está finalizado o cerrado por sistema
          return ticket.estado === 'Finalizado' ||
                 (ticket.estado === 'Cerrado' && esCierreAutomatico);
        }).map(ticket => {
          // Limpiar la descripción si contiene una fecha al final
          // Patrón: fecha en formato dd/MM/yyyy o dd-MM-yyyy al final de la descripción
          const fechaPattern = /\s*\d{2}[\/\-]\d{2}[\/\-]\d{4}\s*$/;
          if (ticket.descripcion && fechaPattern.test(ticket.descripcion)) {
            ticket.descripcion = ticket.descripcion.replace(fechaPattern, '').trim();
          }
          return ticket;
        });
        this.isSearching = false;
        console.log('Tickets listos para evaluar encontrados:', this.tickets);
      },
      error: (error) => {
        console.error('Error cargando tickets:', error);
        this.isSearching = false;
        this.errorMessage = 'Error al cargar los tickets';
        this.showErrorModal = true;
      }
    });
  }

  // Seleccionar un ticket para evaluar
  selectTicket(ticket: TicketDetails): void {
    // Si ya tiene evaluación, recargar lista
    if (this.hasEvaluation(ticket)) {
      console.log('⚠️ El ticket ya está evaluado');
      this.loadFinalizedTickets();
      return;
    }

    // Recargar el ticket desde el backend para obtener la información más actualizada
    this.isSearching = true;
    this.ticketService.getTicketById(ticket.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (updatedTicket) => {
        console.log('✅ Ticket actualizado desde el backend:', updatedTicket);
        this.isSearching = false;

        // Si ya tiene evaluación, recargar lista
        if (this.hasEvaluation(updatedTicket)) {
          console.log('⚠️ El ticket ya está evaluado (verificación actualizada)');
          this.loadFinalizedTickets();
          return;
        }

        // Si no tiene evaluación, mostrar formulario
        this.ticketDetails = updatedTicket;
        this.showCloseForm = true;
      },
      error: (error) => {
        console.error('❌ Error recargando ticket:', error);
        this.isSearching = false;
        // Si hay error, usar el ticket original
        this.ticketDetails = ticket;
        this.showCloseForm = true;
      }
    });
  }

  // Verificar si un ticket tiene evaluación (maneja null, undefined, y objetos vacíos)
  hasEvaluation(ticket: TicketDetails): boolean {
    if (!ticket.evaluacion) {
      return false;
    }
    // Si es un objeto, verificar que tenga propiedades
    if (typeof ticket.evaluacion === 'object') {
      return Object.keys(ticket.evaluacion).length > 0;
    }
    return true;
  }

  // Verificar si un ticket puede ser evaluado
  // Simplificado: si no tiene evaluación, se puede evaluar (ya sea finalizado o cerrado por sistema)
  canEvaluateTicket(ticket: TicketDetails): boolean {
    // Solo verificar que no tenga evaluación
    return !this.hasEvaluation(ticket);
  }

  // Determinar el tipo de cierre del ticket
  getTipoCierre(ticket: TicketDetails): 'usuario' | 'sistema' | null {
    if (this.hasEvaluation(ticket)) {
      return 'usuario'; // Ya evaluado = cerrado por usuario
    }
    if (ticket.estado === 'Finalizado' && !this.hasEvaluation(ticket)) {
      return 'usuario'; // Finalizado sin evaluación = pendiente de cierre por usuario
    }
    // Verificar cierre automático - puede venir como true, 1, o '1'
    const evaluacionCierre = ticket.evaluacionCierreAutomatico;
    const esCierreAutomatico = evaluacionCierre === true ||
                               (typeof evaluacionCierre === 'number' && evaluacionCierre === 1) ||
                               (typeof evaluacionCierre === 'string' && evaluacionCierre === '1');
    if (ticket.estado === 'Cerrado' && esCierreAutomatico) {
      return 'sistema'; // Cerrado por sistema
    }
    return null;
  }

  // Obtener etiqueta del tipo de cierre
  getTipoCierreLabel(ticket: TicketDetails): string {
    const tipo = this.getTipoCierre(ticket);
    if (tipo === 'sistema') {
      return 'Cerrado por el sistema';
    }
    if (tipo === 'usuario') {
      return 'Finalizado (Pendiente Evaluación)';
    }
    return ticket.estado;
  }

  // Obtener el texto del estado a mostrar
  getEstadoDisplay(ticket: TicketDetails): string {
    // Verificar cierre automático - puede venir como true, 1, o '1'
    const evaluacionCierre = ticket.evaluacionCierreAutomatico;
    const esCierreAutomatico = evaluacionCierre === true ||
                               (typeof evaluacionCierre === 'number' && evaluacionCierre === 1) ||
                               (typeof evaluacionCierre === 'string' && evaluacionCierre === '1');
    if (ticket.estado === 'Cerrado' && esCierreAutomatico) {
      return 'Cerrado por el sistema';
    }
    return ticket.estado;
  }

  forceCloseAllModals(): void {
    this.isLoading = false;
    this.showCloseForm = false;
    this.ticketDetails = null;
    this.rating = 0;
    this.hoverRating = 0;
    this.showSuccessModal = false;
    this.showErrorModal = false;
    console.log('🔧 Forzando cierre de todos los modales');
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.successMessage = '';
  }

  closeErrorModal(): void {
    const wasAlreadyEvaluated = this.errorMessage.includes('ya está cerrado y evaluado');
    this.showErrorModal = false;
    this.errorMessage = '';
    // Si el error fue por ticket ya evaluado, recargar la lista
    if (wasAlreadyEvaluated) {
      this.loadFinalizedTickets();
    }
  }
}
