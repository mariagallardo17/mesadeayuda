import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { ServiceCatalogService } from '../../../services/service-catalog.service';
import { UserService } from '../../../services/user.service';
import { ServiceCatalog, CreateServiceRequest, UpdateServiceRequest } from '../../../models/service-catalog.model';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-service-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './service-catalog.component.html',
  styleUrls: ['./service-catalog.component.css']
})
export class ServiceCatalogComponent implements OnInit, OnDestroy {
  services: ServiceCatalog[] = [];
  filteredServices: ServiceCatalog[] = [];
  isLoading = false;
  searchQuery = '';
  showAddForm = false;
  showEditForm = false;
  showActionsPanel = false;
  selectedService: ServiceCatalog | null = null;
  errorMessage = '';
  successMessage = '';
  categories: string[] = [];
  serviceLevels: string[] = [];
  technicians: User[] = [];
  responsableInicialOptions: Array<{value: string, label: string}> = [];

  // Modales de confirmación y éxito/error
  showSuccessModal = false;
  showErrorModal = false;
  showConfirmModal = false;
  confirmMessage = '';
  confirmTitle = '';
  confirmAction: (() => void) | null = null;

  addServiceForm: FormGroup;
  editServiceForm: FormGroup;

  private destroy$ = new Subject<void>();

  constructor(
    private serviceCatalogService: ServiceCatalogService,
    private userService: UserService,
    private fb: FormBuilder
  ) {
    this.addServiceForm = this.fb.group({
      categoria: ['', [Validators.required]],
      subcategoria: ['', [Validators.required]],
      tiempoObjetivo: ['', [Validators.required]],
      tiempoMaximo: [''],
      prioridad: [''],
      responsableInicial: [''],
      escalamiento: ['', [Validators.required]],
      motivoEscalamiento: [''],
      nivelServicio: [''],
      activo: [true]
    });

    this.editServiceForm = this.fb.group({
      categoria: ['', [Validators.required]],
      subcategoria: ['', [Validators.required]],
      tiempoObjetivo: ['', [Validators.required]],
      tiempoMaximo: [''],
      prioridad: [''],
      responsableInicial: [''],
      escalamiento: ['', [Validators.required]],
      motivoEscalamiento: [''],
      nivelServicio: [''],
      activo: [true]
    });
  }

  ngOnInit(): void {
    this.loadServices();
    this.loadCategories();
    this.loadServiceLevels();
    this.loadTechnicians();
    // Inicializar con RITO al menos
    this.responsableInicialOptions = [{ value: 'RITO', label: 'RITO' }];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadServices(): void {
    this.isLoading = true;
    this.serviceCatalogService.reloadServices()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (services) => {
          this.services = services;
          this.filteredServices = services;
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = 'Error al cargar los servicios';
          this.isLoading = false;
          // Si falla, intentar obtener desde el observable
          this.serviceCatalogService.getServices()
            .pipe(takeUntil(this.destroy$))
            .subscribe(services => {
              this.services = services;
              this.filteredServices = services;
            });
        }
      });
  }

  loadCategories(): void {
    this.serviceCatalogService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe(categories => {
        this.categories = categories;
      });
  }

  loadServiceLevels(): void {
    this.serviceCatalogService.getServiceLevels()
      .pipe(takeUntil(this.destroy$))
      .subscribe(levels => {
        this.serviceLevels = levels;
      });
  }

  loadTechnicians(): void {
    this.userService.getTechnicians()
      .pipe(takeUntil(this.destroy$))
      .subscribe(technicians => {
        this.technicians = technicians;
        this.updateResponsableInicialOptions();
      });
  }

  // Actualizar opciones de responsable inicial (técnicos + RITO)
  updateResponsableInicialOptions(): void {
    try {
      const options: Array<{value: string, label: string}> = [];

      // Agregar técnicos
      if (this.technicians && Array.isArray(this.technicians)) {
        this.technicians.forEach(technician => {
          options.push({
            value: technician.nombre,
            label: `${technician.nombre} ${technician.apellido || ''}`.trim()
          });
        });
      }

      // Agregar RITO como opción especial
      options.push({
        value: 'RITO',
        label: 'RITO'
      });

      this.responsableInicialOptions = options;
    } catch (error) {
      console.error('Error en updateResponsableInicialOptions:', error);
      this.responsableInicialOptions = [{ value: 'RITO', label: 'RITO' }];
    }
  }

  getTechnicianName(technicianIdOrName: string | number | null | undefined): string {
    if (!technicianIdOrName) return '';

    // Si es un número, buscar por ID
    if (typeof technicianIdOrName === 'number') {
      const technician = this.technicians.find(t => t.id === technicianIdOrName);
      return technician ? `${technician.nombre} ${technician.apellido || ''}`.trim() : '';
    }

    // Si es un string, verificar si coincide con algún nombre completo
    const technician = this.technicians.find(t => {
      const fullName = `${t.nombre} ${t.apellido || ''}`.trim();
      return fullName === technicianIdOrName || t.nombre === technicianIdOrName;
    });

    if (technician) {
      return `${technician.nombre} ${technician.apellido || ''}`.trim();
    }

    // Si no se encuentra, retornar el valor original (para compatibilidad)
    return String(technicianIdOrName);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value;

    if (this.searchQuery.trim()) {
      this.serviceCatalogService.searchServices(this.searchQuery)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (services) => {
            this.filteredServices = services;
          },
          error: (error) => {
            this.errorMessage = 'Error al buscar servicios';
          }
        });
    } else {
      this.filteredServices = this.services;
    }
  }

  selectService(service: ServiceCatalog): void {
    this.selectedService = service;
    this.showActionsPanel = true;
    this.showAddForm = false;
    this.showEditForm = false;
    this.clearMessages();
  }

  showServiceActions(service: ServiceCatalog, event: Event): void {
    event.stopPropagation();
    this.selectService(service);
  }

  showAddServiceForm(): void {
    this.showAddForm = true;
    this.showEditForm = false;
    this.showActionsPanel = false;
    this.selectedService = null;
    this.addServiceForm.reset();
    this.clearMessages();
  }

  showEditServiceForm(service: ServiceCatalog): void {
    this.selectedService = service;
    this.showEditForm = true;
    this.showAddForm = false;
    this.showActionsPanel = false;

    this.editServiceForm.patchValue({
      categoria: service.categoria,
      subcategoria: service.subcategoria,
      tiempoObjetivo: service.tiempoObjetivo,
      tiempoMaximo: service.tiempoMaximo,
      prioridad: service.prioridad,
      responsableInicial: service.responsableInicial,
      escalamiento: service.escalamiento,
      motivoEscalamiento: service.motivoEscalamiento,
      nivelServicio: service.sla,
      activo: service.activo
    });

    this.clearMessages();
  }

  hideForms(): void {
    this.showAddForm = false;
    this.showEditForm = false;
    this.showActionsPanel = false;
    this.selectedService = null;
    this.clearMessages();
  }

  onSubmitAddService(): void {
    if (this.addServiceForm.valid) {
      this.isLoading = true;
      const formValue = this.addServiceForm.value;

      // Mapear los campos del formulario al formato esperado por el backend
      const serviceData: CreateServiceRequest = {
        categoria: formValue.categoria,
        subcategoria: formValue.subcategoria,
        tiempoObjetivo: formValue.tiempoObjetivo,
        tiempoMaximo: formValue.tiempoMaximo || null,
        prioridad: formValue.prioridad || null,
        responsableInicial: formValue.responsableInicial || null,
        escalamiento: formValue.escalamiento,
        motivoEscalamiento: formValue.motivoEscalamiento || null,
        nivelServicio: formValue.nivelServicio || null
      };

      this.serviceCatalogService.createService(serviceData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (newService) => {
            this.successMessage = `Servicio ${newService.categoria} - ${newService.subcategoria} creado exitosamente`;
            this.showSuccessModal = true;
            this.hideForms();
            this.loadServices();
            this.isLoading = false;
          },
          error: (error) => {
            this.errorMessage = error.error?.error || error.message || 'Error al crear el servicio';
            this.showErrorModal = true;
            this.isLoading = false;
          }
        });
    } else {
      this.errorMessage = 'Por favor, complete todos los campos correctamente';
      this.showErrorModal = true;
      // Marcar todos los campos como touched para mostrar errores
      Object.keys(this.addServiceForm.controls).forEach(key => {
        this.addServiceForm.get(key)?.markAsTouched();
      });
    }
  }

  onSubmitEditService(): void {
    if (this.editServiceForm.valid && this.selectedService) {
      this.isLoading = true;
      const formValue = this.editServiceForm.value;

      // Mapear los campos del formulario al formato esperado por el backend
      const serviceData: UpdateServiceRequest = {
        categoria: formValue.categoria,
        subcategoria: formValue.subcategoria,
        tiempoObjetivo: formValue.tiempoObjetivo,
        tiempoMaximo: formValue.tiempoMaximo || null,
        prioridad: formValue.prioridad || null,
        responsableInicial: formValue.responsableInicial || null,
        escalamiento: formValue.escalamiento,
        motivoEscalamiento: formValue.motivoEscalamiento || null,
        nivelServicio: formValue.nivelServicio || null,
        activo: formValue.activo
      };

      this.serviceCatalogService.updateService(this.selectedService.id!, serviceData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updatedService) => {
            this.successMessage = `Servicio ${updatedService.categoria} - ${updatedService.subcategoria} actualizado exitosamente`;
            this.showSuccessModal = true;
            this.hideForms();
            this.loadServices();
            this.isLoading = false;
          },
          error: (error) => {
            this.errorMessage = error.error?.error || error.message || 'Error al actualizar el servicio';
            this.showErrorModal = true;
            this.isLoading = false;
          }
        });
    } else {
      this.errorMessage = 'Por favor, complete todos los campos correctamente';
      this.showErrorModal = true;
      // Marcar todos los campos como touched para mostrar errores
      Object.keys(this.editServiceForm.controls).forEach(key => {
        this.editServiceForm.get(key)?.markAsTouched();
      });
    }
  }

  deleteService(service: ServiceCatalog): void {
    this.confirmTitle = 'Confirmar eliminación';
    this.confirmMessage = `¿Está seguro de que desea eliminar el servicio ${service.categoria} - ${service.subcategoria}? Esta acción no se puede deshacer.`;
    this.confirmAction = () => {
      this.isLoading = true;
      this.closeConfirmModal();

      this.serviceCatalogService.deleteService(service.id!)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.successMessage = `Servicio ${service.categoria} - ${service.subcategoria} eliminado exitosamente`;
            this.showSuccessModal = true;
            this.loadServices();
            this.isLoading = false;
          },
          error: (error) => {
            this.errorMessage = error.message || 'Error al eliminar el servicio';
            this.showErrorModal = true;
            this.isLoading = false;
          }
        });
    };
    this.showConfirmModal = true;
  }

  toggleServiceStatus(service: ServiceCatalog): void {
    const action = service.activo ? 'desactivar' : 'activar';
    this.confirmTitle = `Confirmar ${action} servicio`;
    this.confirmMessage = `¿Está seguro de que desea ${action} el servicio ${service.categoria} - ${service.subcategoria}?`;
    this.confirmAction = () => {
      this.isLoading = true;
      this.closeConfirmModal();

      this.serviceCatalogService.updateService(service.id!, { activo: !service.activo })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updatedService) => {
            this.successMessage = `Servicio ${updatedService.categoria} - ${updatedService.subcategoria} ${updatedService.activo ? 'activado' : 'desactivado'} exitosamente`;
            this.showSuccessModal = true;
            this.loadServices();
            this.isLoading = false;
          },
          error: (error) => {
            this.errorMessage = error.message || 'Error al cambiar el estado del servicio';
            this.showErrorModal = true;
            this.isLoading = false;
          }
        });
    };
    this.showConfirmModal = true;
  }

  getStatusColor(active: boolean): string {
    return active ? 'status-active' : 'status-inactive';
  }

  getStatusLabel(active: boolean): string {
    return active ? 'Activo' : 'Inactivo';
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  trackByServiceId(index: number, service: ServiceCatalog): number {
    return service.id || index;
  }

  // Métodos para manejar modales
  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.successMessage = '';
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmTitle = '';
    this.confirmMessage = '';
    this.confirmAction = null;
  }

  confirmActionExecute(): void {
    if (this.confirmAction) {
      this.confirmAction();
    }
  }

  // Getters para el formulario de agregar servicio
  get addCategoria() { return this.addServiceForm.get('categoria'); }
  get addSubcategoria() { return this.addServiceForm.get('subcategoria'); }
  get addTiempoObjetivo() { return this.addServiceForm.get('tiempoObjetivo'); }
  get addTiempoMaximo() { return this.addServiceForm.get('tiempoMaximo'); }
  get addPrioridad() { return this.addServiceForm.get('prioridad'); }
  get addResponsableInicial() { return this.addServiceForm.get('responsableInicial'); }
  get addEscalamiento() { return this.addServiceForm.get('escalamiento'); }
  get addMotivoEscalamiento() { return this.addServiceForm.get('motivoEscalamiento'); }
  get addNivelServicio() { return this.addServiceForm.get('nivelServicio'); }
  get addActivo() { return this.addServiceForm.get('activo'); }

  // Getters para el formulario de editar servicio
  get editCategoria() { return this.editServiceForm.get('categoria'); }
  get editSubcategoria() { return this.editServiceForm.get('subcategoria'); }
  get editTiempoObjetivo() { return this.editServiceForm.get('tiempoObjetivo'); }
  get editTiempoMaximo() { return this.editServiceForm.get('tiempoMaximo'); }
  get editPrioridad() { return this.editServiceForm.get('prioridad'); }
  get editResponsableInicial() { return this.editServiceForm.get('responsableInicial'); }
  get editEscalamiento() { return this.editServiceForm.get('escalamiento'); }
  get editMotivoEscalamiento() { return this.editServiceForm.get('motivoEscalamiento'); }
  get editNivelServicio() { return this.editServiceForm.get('nivelServicio'); }
  get editActivo() { return this.editServiceForm.get('activo'); }
}
