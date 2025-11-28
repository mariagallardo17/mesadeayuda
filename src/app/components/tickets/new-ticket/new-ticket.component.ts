import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ServiceCatalogService } from '../../../services/service-catalog.service';
import { TicketService, CreateTicketRequest } from '../../../services/ticket.service';
import { NotificationService } from '../../../services/notification.service';
import { User } from '../../../models/user.model';
import { ServiceCatalog } from '../../../models/service-catalog.model';

@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './new-ticket.component.html',
  styleUrls: ['./new-ticket.component.css']
})
export class NewTicketComponent implements OnInit, OnDestroy {
  ticketForm: FormGroup;
  currentUser: User | null = null;
  categories: string[] = [];
  subcategories: string[] = [];
  isLoading = false;
  showSuccessModal = false;
  ticketId: number | null = null;
  submissionStep: 'idle' | 'validating' | 'sending' | 'assigning' | 'complete' = 'idle';
  ticketDescription = '';
  estimatedTime = '';
  tecnicoAsignado = '';
  requiereAprobacion = false;
  selectedFile: File | null = null;
  isProcessingFile = false;
  fileError: string = '';
  showConfirmationModal = false;
  hasPendingTickets = false;
  isCheckingPendingTickets = true; // Bloquear formulario hasta verificar
  pendingTicketData: CreateTicketRequest | null = null;
  confirmationData: {
    email: string;
    departamento: string;
    categoria: string;
    subcategoria: string;
    descripcion: string;
    requiereAprobacion: boolean;
    archivoNombre: string | null;
  } | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private serviceCatalogService: ServiceCatalogService,
    private ticketService: TicketService,
    private notificationService: NotificationService
  ) {
    this.ticketForm = this.fb.group({
      email: [{ value: '', disabled: true }],
      departamento: [{ value: '', disabled: true }],
      categoria: ['', Validators.required],
      subcategoria: ['', Validators.required],
      descripcion: ['', Validators.required],
      archivoAprobacion: [null] // Removido Validators.required
    });
  }

  ngOnInit(): void {
    console.log('🚀 NewTicketComponent - ngOnInit iniciado');

    // BLOQUEAR FORMULARIO DESDE EL INICIO - CRÍTICO
    this.isCheckingPendingTickets = true;
    this.hasPendingTickets = false; // Se actualizará después de verificar
    console.log('🔒 Formulario bloqueado desde el inicio. isCheckingPendingTickets:', this.isCheckingPendingTickets);

    this.checkAuthStatus();
    this.loadCurrentUser();

    // Verificar tickets pendientes INMEDIATAMENTE después de cargar usuario
    // Usar setTimeout mínimo para asegurar que el usuario esté disponible
    setTimeout(() => {
      console.log('⏰ Ejecutando verificación de tickets pendientes...');
      this.checkPendingTickets();
    }, 100);

    // Cargar categorías (no bloquea la verificación)
    this.loadCategories();
  }

  checkAuthStatus(): void {
    const token = this.authService.getToken();
    const user = this.authService.getCurrentUser();
    console.log('🔑 Estado de autenticación:');
    console.log('  - Token disponible:', token ? 'SÍ' : 'NO');
    console.log('  - Usuario logueado:', user ? user.nombre : 'NO');
    if (token) {
      console.log('  - Token (primeros 20 chars):', token.substring(0, 20) + '...');
    }

    // Si no hay usuario logueado, redirigir al login
    if (!user) {
      console.log('⚠️ Usuario no autenticado, redirigiendo al login...');
      this.router.navigate(['/login']);
    }
  }

  checkPendingTickets(): void {
    console.log('🔍 Verificando tickets pendientes de evaluación...');
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.warn('⚠️ No hay usuario autenticado, no se puede verificar tickets pendientes');
      this.isCheckingPendingTickets = false;
      console.log('🔓 Formulario desbloqueado (sin usuario)');
      return;
    }

    // Mantener el formulario bloqueado mientras se verifica
    this.isCheckingPendingTickets = true;
    console.log('🔒 Formulario bloqueado durante verificación. isCheckingPendingTickets:', this.isCheckingPendingTickets);

    this.ticketService.checkPendingEvaluationTickets().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        console.log('📋 Respuesta de verificación de tickets pendientes:', response);

        if (response.hasPending) {
          console.log('⚠️ Usuario tiene tickets pendientes de evaluación');
          this.hasPendingTickets = true;
          this.isCheckingPendingTickets = false; // Desbloquear después de verificar
          console.log('🔒 Formulario permanece bloqueado por tickets pendientes. hasPendingTickets:', this.hasPendingTickets);
        } else {
          console.log('✅ No hay tickets pendientes de evaluación');
          this.hasPendingTickets = false;
          this.isCheckingPendingTickets = false; // Desbloquear después de verificar
          console.log('🔓 Formulario desbloqueado. No hay tickets pendientes.');
        }
      },
      error: (error) => {
        console.error('❌ Error verificando tickets pendientes:', error);
        console.error('❌ Detalles del error:', {
          status: error.status,
          message: error.message,
          error: error.error
        });
        // En caso de error, permitir crear ticket (el backend también validará)
        this.isCheckingPendingTickets = false;
        this.hasPendingTickets = false;
        console.log('🔓 Formulario desbloqueado (error en verificación)');
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCurrentUser(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) {
      this.ticketForm.patchValue({
        email: this.currentUser.email,
        departamento: this.currentUser.departamento || 'IT'
      });
    } else {
      // Si no hay usuario, desbloquear después de un momento
      setTimeout(() => {
        this.isCheckingPendingTickets = false;
      }, 500);
    }
  }

  loadCategories(): void {
    console.log('🔄 loadCategories() iniciado');

    // Primero recargar servicios desde el backend para asegurar que estén disponibles
    this.serviceCatalogService.reloadServices().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (services) => {
        console.log('✅ Servicios recargados:', services.length);
        // Luego obtener las categorías
        this.serviceCatalogService.getCategories().pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: (categories: string[]) => {
            this.categories = categories;
            console.log('✅ Categorías cargadas en formulario:', this.categories);
            console.log('📊 Número de categorías:', this.categories.length);
            if (this.categories.length === 0) {
              console.warn('⚠️ No se encontraron categorías. Verifica que haya servicios en el catálogo.');
            }
          },
          error: (error: any) => {
            console.error('❌ Error obteniendo categorías:', error);
          }
        });
      },
      error: (error: any) => {
        console.error('❌ Error recargando servicios:', error);
        // Intentar obtener categorías de todos modos
        this.serviceCatalogService.getCategories().pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: (categories: string[]) => {
            this.categories = categories;
            console.log('✅ Categorías obtenidas después del error:', this.categories.length);
          },
          error: (err: any) => {
            console.error('❌ Error crítico cargando catálogo:', err);
          }
        });
      }
    });
  }

  onCategoryChange(): void {
    const categoriaSeleccionada = this.ticketForm.get('categoria')?.value;
    console.log('🔄 Categoría seleccionada:', categoriaSeleccionada);

    if (categoriaSeleccionada) {
      console.log('🔍 Buscando subcategorías para:', categoriaSeleccionada);
      this.serviceCatalogService.getSubcategoriesByCategory(categoriaSeleccionada).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (subcategories: string[]) => {
          this.subcategories = subcategories;
          console.log('✅ Subcategorías cargadas:', this.subcategories);
          console.log('📊 Total de subcategorías:', this.subcategories.length);
        },
        error: (error: any) => {
          console.error('❌ Error cargando subcategorías:', error);
        }
      });
    } else {
      this.subcategories = [];
      console.log('🚫 No hay categoría seleccionada, limpiando subcategorías');
    }

    // Limpiar subcategoría cuando cambia la categoría
    this.ticketForm.get('subcategoria')?.setValue('');
    this.requiereAprobacion = false;
  }

  onSubcategoryChange(): void {
    const categoriaSeleccionada = this.ticketForm.get('categoria')?.value;
    const subcategoriaSeleccionada = this.ticketForm.get('subcategoria')?.value;

    if (categoriaSeleccionada && subcategoriaSeleccionada) {
      // Solo verificar si requiere aprobación, sin mostrar detalles internos
      this.serviceCatalogService.getServiceInfo(categoriaSeleccionada, subcategoriaSeleccionada).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (service: any) => {
          if (service) {
            this.requiereAprobacion = service.requiere_aprobacion || false;
            console.log('Requiere aprobación:', this.requiereAprobacion);

            // Actualizar validación del campo de archivo
            this.updateFileValidation();
          }
        },
        error: (error: any) => {
          console.error('Error obteniendo información del servicio:', error);
          this.requiereAprobacion = false;
          this.updateFileValidation();
        }
      });
    } else {
      this.requiereAprobacion = false;
      this.updateFileValidation();
    }
  }

  private updateFileValidation(): void {
    const archivoControl = this.ticketForm.get('archivoAprobacion');
    if (archivoControl) {
      if (this.requiereAprobacion) {
        archivoControl.setValidators([Validators.required]);
        archivoControl.updateValueAndValidity();
      } else {
        archivoControl.clearValidators();
        archivoControl.updateValueAndValidity();
      }
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    this.fileError = '';

    if (file) {
      // Validar que sea PDF
      if (file.type !== 'application/pdf') {
        this.fileError = 'Solo se permiten archivos PDF';
        event.target.value = ''; // Limpiar el input
        return;
      }

      // Validar tamaño (máximo 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB en bytes
      if (file.size > maxSize) {
        this.fileError = 'El archivo es demasiado grande. Máximo 10MB';
        event.target.value = ''; // Limpiar el input
        return;
      }

      // Mostrar estado de procesamiento
      this.isProcessingFile = true;

      // Procesamiento inmediato del archivo (validación local)
      this.selectedFile = file;
      this.isProcessingFile = false;
      this.ticketForm.patchValue({
        archivoAprobacion: file
      });
      this.ticketForm.get('archivoAprobacion')?.updateValueAndValidity();
    }
  }

  removeFile(): void {
    this.selectedFile = null;
    this.fileError = '';
    this.ticketForm.patchValue({
      archivoAprobacion: null
    });
    this.ticketForm.get('archivoAprobacion')?.updateValueAndValidity();

    // Limpiar el input file
    const fileInput = document.getElementById('archivoAprobacion') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  previewFile(): void {
    if (this.selectedFile) {
      // Crear URL del objeto para vista previa
      const fileUrl = URL.createObjectURL(this.selectedFile);

      // Crear un elemento iframe para mostrar el PDF
      // Crear embed para mostrar el PDF (mejor compatibilidad con Edge)
      const embed = document.createElement('embed');
      embed.src = fileUrl + '#toolbar=0&navpanes=0&scrollbar=1';
      embed.type = 'application/pdf';
      embed.style.width = '100%';
      embed.style.height = 'calc(100% - 80px)';
      embed.style.border = 'none';
      embed.style.borderRadius = '8px';
      embed.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      embed.title = 'Vista previa de documento PDF (Solo lectura)';

      // Crear iframe como respaldo si embed no funciona
      const iframe = document.createElement('iframe');
      iframe.src = fileUrl + '#toolbar=0&navpanes=0&scrollbar=1';
      iframe.style.width = '100%';
      iframe.style.height = 'calc(100% - 80px)';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      iframe.title = 'Vista previa de documento PDF (Solo lectura)';

      // Crear modal personalizado - ventana más pequeña y centrada
      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
      modal.style.zIndex = '10000';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.padding = '20px';

      // Contenedor del contenido - tamaño más manejable
      const content = document.createElement('div');
      content.style.backgroundColor = 'white';
      content.style.borderRadius = '12px';
      content.style.padding = '20px';
      content.style.maxWidth = '90%';
      content.style.maxHeight = '85%';
      content.style.width = '800px';
      content.style.height = '600px';
      content.style.position = 'relative';
      content.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
      content.style.overflow = 'hidden';

      // Crear botón de cerrar
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '10px';
      closeBtn.style.right = '15px';
      closeBtn.style.background = '#dc3545';
      closeBtn.style.color = 'white';
      closeBtn.style.border = 'none';
      closeBtn.style.borderRadius = '50%';
      closeBtn.style.width = '30px';
      closeBtn.style.height = '30px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.fontSize = '16px';
      closeBtn.style.fontWeight = 'bold';
      closeBtn.style.zIndex = '10001';


      // Crear título
      const title = document.createElement('h3');
      title.textContent = `Vista previa: ${this.selectedFile.name}`;
      title.style.margin = '0 0 15px 0';
      title.style.color = '#333';
      title.style.fontSize = '18px';
      title.style.fontWeight = 'bold';

      // Mensaje informativo sobre las restricciones
      const helpMessage = document.createElement('div');
      helpMessage.innerHTML = `
        <div style="
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 6px;
          padding: 10px;
          margin-bottom: 15px;
          color: #856404;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span style="font-size: 16px;">👁️</span>
          <span><strong>Vista previa:</strong> Este documento es de solo lectura. No se puede editar, descargar, imprimir ni copiar.</span>
        </div>
      `;

      // Actualizar el iframe para tamaño más manejable
      iframe.style.width = '100%';
      iframe.style.height = '500px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';

      // Crear botón de descargar
      // Removemos el botón de descarga para que sea solo visualización

      // Eventos
      closeBtn.onclick = () => {
        document.body.removeChild(modal);
        URL.revokeObjectURL(fileUrl);
      };


      // Cerrar con clic fuera del contenido
      modal.onclick = (e) => {
        if (e.target === modal) {
          closeBtn.click();
        }
      };

      // Cerrar con tecla ESC
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closeBtn.click();
          document.removeEventListener('keydown', handleKeyDown);
        }
      };
      document.addEventListener('keydown', handleKeyDown);

      // Ensamblar modal con embed (mejor compatibilidad con Edge)
      content.appendChild(closeBtn);
      content.appendChild(title);
      content.appendChild(helpMessage);
      content.appendChild(embed);
      modal.appendChild(content);
      document.body.appendChild(modal);

      // Limpiar la URL cuando se cierre el modal
      const originalCloseHandler = closeBtn.onclick;
      closeBtn.onclick = (event) => {
        if (originalCloseHandler) {
          (originalCloseHandler as any)(event);
        }
        URL.revokeObjectURL(fileUrl);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onSubmit(): void {
    // Verificar si hay tickets pendientes antes de permitir el envío
    if (this.hasPendingTickets || this.isCheckingPendingTickets) {
      if (this.isCheckingPendingTickets) {
        alert('Por favor espera mientras verificamos tus tickets pendientes...');
      } else {
        alert('Tienes tickets pendientes de evaluación. Por favor, evalúa tus tickets en el menú "Cerrar Ticket" antes de crear uno nuevo.');
      }
      return;
    }

    // Verificar nuevamente antes de enviar (doble verificación)
    this.isLoading = true;
    this.ticketService.checkPendingEvaluationTickets().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.hasPending) {
          this.hasPendingTickets = true;
          alert('Tienes tickets pendientes de evaluación. Por favor, evalúa tus tickets en el menú "Cerrar Ticket" antes de crear uno nuevo.');
          return;
        }
        // Si no hay tickets pendientes, continuar con el envío
        this.proceedWithSubmission();
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error verificando tickets pendientes:', error);
        // En caso de error, permitir el envío (el backend también validará)
        this.proceedWithSubmission();
      }
    });
  }

  private proceedWithSubmission(): void {
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      alert('Por favor, revisa los campos obligatorios antes de continuar.');
      return;
    }

    const rawData = this.ticketForm.getRawValue();
    this.pendingTicketData = {
      categoria: rawData.categoria,
      subcategoria: rawData.subcategoria,
      descripcion: rawData.descripcion,
      archivoAprobacion: rawData.archivoAprobacion
    };

    this.confirmationData = {
      email: rawData.email || this.currentUser?.email || '',
      departamento: rawData.departamento || this.currentUser?.departamento || '',
      categoria: rawData.categoria,
      subcategoria: rawData.subcategoria,
      descripcion: rawData.descripcion,
      requiereAprobacion: this.requiereAprobacion,
      archivoNombre: this.selectedFile ? this.selectedFile.name : null
    };

    this.showConfirmationModal = true;
  }

  confirmTicketSubmission(): void {
    if (!this.pendingTicketData || !this.confirmationData) {
      this.cancelTicketSubmission();
      return;
    }

    this.showConfirmationModal = false;
    this.isLoading = true;
    this.submissionStep = 'validating';
    this.estimatedTime = '';
    this.tecnicoAsignado = '';

    console.log('Datos confirmados para el ticket:', this.pendingTicketData);

    this.showTicketConfirmation(
      0,
      this.confirmationData.descripcion,
      this.estimatedTime,
      'Asignando...'
    );

    this.submissionStep = 'sending';
    this.ticketService.createTicket(this.pendingTicketData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        console.log('Ticket creado:', response);
        this.submissionStep = 'assigning';

        this.notificationService.addNotification({
          type: 'success',
          title: 'Ticket Creado',
          message: `Tu ticket #${response.ticket.id} ha sido creado exitosamente`,
          actionUrl: `/tickets/tracking?ticketId=${response.ticket.id}`
        });

        if (response.ticket.tecnicoAsignado) {
          this.notificationService.addNotification({
            type: 'info',
            title: 'Ticket Asignado',
            message: `Tu ticket #${response.ticket.id} ha sido asignado a ${response.ticket.tecnicoAsignado}`,
            actionUrl: `/tickets/tracking?ticketId=${response.ticket.id}`
          });
        }

        this.updateTicketConfirmation(
          response.ticket.id,
          response.ticket.tiempoEstimado?.toString() || '',
          response.ticket.tecnicoAsignado || 'No asignado'
        );

        this.submissionStep = 'complete';
        this.isLoading = false;
        this.pendingTicketData = null;
      },
      error: (error) => {
        console.error('Error creando ticket:', error);
        this.closeSuccessModal();
        this.isLoading = false;
        this.pendingTicketData = null;

        // Manejar error 409: Tickets pendientes de evaluación
        if (error.status === 409) {
          this.hasPendingTickets = true;
          alert(error.error?.error || 'Tienes tickets pendientes de evaluación. Por favor, evalúa tus tickets en el menú "Cerrar Ticket" antes de crear uno nuevo.');
        } else {
          alert(`Error al crear el ticket: ${error.error?.error || error.message || 'Error desconocido'}`);
        }
      }
    });
  }

  cancelTicketSubmission(): void {
    this.showConfirmationModal = false;
    this.pendingTicketData = null;
    this.confirmationData = null;
  }

  goToCloseTickets(): void {
    // Navegar a la página de Cerrar Ticket
    this.router.navigate(['/tickets/close']);
  }

  showTicketConfirmation(ticketId: number, descripcion: string, tiempoEstimado: string, tecnicoAsignado: any): void {
    this.ticketId = ticketId;
    this.ticketDescription = descripcion;
    this.estimatedTime = tiempoEstimado;
    this.tecnicoAsignado = tecnicoAsignado?.nombre || tecnicoAsignado || 'Sin asignar';
    this.showSuccessModal = true;
  }

  updateTicketConfirmation(ticketId: number, tiempoEstimado: string, tecnicoAsignado: any): void {
    this.ticketId = ticketId;
    this.estimatedTime = tiempoEstimado;
    this.tecnicoAsignado = tecnicoAsignado?.nombre || tecnicoAsignado || 'No asignado';
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    // Limpiar el formulario para permitir crear otro ticket
    this.ticketForm.reset();
    this.selectedFile = null;
    this.fileError = '';
    this.subcategories = [];
    this.estimatedTime = '';
    this.tecnicoAsignado = '';
    this.ticketId = 0;
    this.ticketDescription = '';
    this.submissionStep = 'idle';
    this.isLoading = false;
    this.pendingTicketData = null;
    this.confirmationData = null;
    this.showConfirmationModal = false;

    // Recargar datos del usuario actual
    this.loadCurrentUser();
  }


  get email() { return this.ticketForm.get('email'); }
  get departamento() { return this.ticketForm.get('departamento'); }
  get categoria() { return this.ticketForm.get('categoria'); }
  get subcategoria() { return this.ticketForm.get('subcategoria'); }
  get descripcion() { return this.ticketForm.get('descripcion'); }
  get archivoAprobacion() { return this.ticketForm.get('archivoAprobacion'); }
}
