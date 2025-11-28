import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AssignmentService, TechnicianSpecialty, AssignmentRule, AssignmentStats, TechnicianWorkload } from '../../../services/assignment.service';
import { UserService } from '../../../services/user.service';
import { ServiceCatalogService } from '../../../services/service-catalog.service';

@Component({
  selector: 'app-manage-assignments',
  templateUrl: './manage-assignments.component.html',
  styleUrls: ['./manage-assignments.component.css'],
  imports: [CommonModule, FormsModule],
  standalone: true
})
export class ManageAssignmentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Datos
  specialties: TechnicianSpecialty[] = [];
  assignmentRules: AssignmentRule[] = [];
  assignmentStats: AssignmentStats[] = [];
  technicianWorkload: TechnicianWorkload[] = [];
  users: any[] = [];
  services: any[] = [];

  // Estados de carga
  loadingSpecialties = false;
  loadingRules = false;
  loadingStats = false;
  loadingWorkload = false;
  loadingUsers = false;
  loadingServices = false;

  // Formularios
  showSpecialtyForm = false;
  showRuleForm = false;
  showTestForm = false;

  // Datos del formulario de especialidad
  newSpecialty = {
    usuario_id: undefined as number | undefined,
    area_especialidad: '',
    nivel_expertise: 'secundario' as 'principal' | 'secundario' | 'soporte'
  };

  // Datos del formulario de regla
  newRule = {
    servicio_id: undefined as number | undefined,
    area_servicio: '',
    prioridad_ticket: 'media' as 'alta' | 'media' | 'baja',
    tecnico_principal_id: undefined as number | undefined,
    tecnico_secundario_id: undefined as number | undefined,
    tecnico_soporte_id: undefined as number | undefined,
    carga_maxima: 5
  };

  // Datos del formulario de prueba
  testAssignmentData = {
    servicio_id: undefined as number | undefined,
    prioridad: 'media'
  };
  testResult: any = null;

  // Mensajes
  message = '';
  messageType = '';

  // Filtros y búsqueda
  specialtySearchTerm = '';
  ruleSearchTerm = '';

  // Pestañas activas
  activeTab = 'specialties';

  constructor(
    private assignmentService: AssignmentService,
    private userService: UserService,
    private serviceCatalogService: ServiceCatalogService
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar todos los datos necesarios
   */
  loadAllData(): void {
    this.loadSpecialties();
    this.loadAssignmentRules();
    this.loadAssignmentStats();
    this.loadTechnicianWorkload();
    this.loadUsers();
    this.loadServices();
  }

  /**
   * Cargar especialidades de técnicos
   */
  loadSpecialties(): void {
    this.loadingSpecialties = true;
    this.assignmentService.getTechnicianSpecialties()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (specialties) => {
          this.specialties = specialties;
          this.loadingSpecialties = false;
        },
        error: (error) => {
          console.error('Error cargando especialidades:', error);
          this.showMessage('Error al cargar especialidades', 'error');
          this.loadingSpecialties = false;
        }
      });
  }

  /**
   * Cargar reglas de asignación
   */
  loadAssignmentRules(): void {
    this.loadingRules = true;
    this.assignmentService.getAssignmentRules()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rules) => {
          this.assignmentRules = rules;
          this.loadingRules = false;
        },
        error: (error) => {
          console.error('Error cargando reglas:', error);
          this.showMessage('Error al cargar reglas de asignación', 'error');
          this.loadingRules = false;
        }
      });
  }

  /**
   * Cargar estadísticas de asignación
   */
  loadAssignmentStats(): void {
    this.loadingStats = true;
    this.assignmentService.getAssignmentStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.assignmentStats = stats;
          this.loadingStats = false;
        },
        error: (error) => {
          console.error('Error cargando estadísticas:', error);
          this.loadingStats = false;
        }
      });
  }

  /**
   * Cargar carga de trabajo de técnicos
   */
  loadTechnicianWorkload(): void {
    this.loadingWorkload = true;
    this.assignmentService.getTechnicianWorkload()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (workload) => {
          this.technicianWorkload = workload;
          this.loadingWorkload = false;
        },
        error: (error) => {
          console.error('Error cargando carga de trabajo:', error);
          this.loadingWorkload = false;
        }
      });
  }

  /**
   * Cargar usuarios (para selección en formularios)
   */
  loadUsers(): void {
    this.loadingUsers = true;
    this.userService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users.filter(user => user.rol === 'tecnico');
          this.loadingUsers = false;
        },
        error: (error) => {
          console.error('Error cargando usuarios:', error);
          this.loadingUsers = false;
        }
      });
  }

  /**
   * Cargar servicios (para selección en formularios)
   */
  loadServices(): void {
    this.loadingServices = true;
    this.serviceCatalogService.getServices()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (services) => {
          this.services = services;
          this.loadingServices = false;
        },
        error: (error) => {
          console.error('Error cargando servicios:', error);
          this.loadingServices = false;
        }
      });
  }

  /**
   * Crear nueva especialidad
   */
  createSpecialty(): void {
    if (!this.newSpecialty.usuario_id || !this.newSpecialty.area_especialidad) {
      this.showMessage('Por favor completa todos los campos obligatorios', 'error');
      return;
    }

    this.assignmentService.createSpecialty(this.newSpecialty)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.showMessage('Especialidad creada exitosamente', 'success');
          this.loadSpecialties();
          this.resetSpecialtyForm();
        },
        error: (error) => {
          console.error('Error creando especialidad:', error);
          this.showMessage('Error al crear especialidad', 'error');
        }
      });
  }

  /**
   * Crear nueva regla de asignación
   */
  createRule(): void {
    if (!this.newRule.servicio_id || !this.newRule.area_servicio) {
      this.showMessage('Por favor completa todos los campos obligatorios', 'error');
      return;
    }

    this.assignmentService.createAssignmentRule(this.newRule)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.showMessage('Regla de asignación creada exitosamente', 'success');
          this.loadAssignmentRules();
          this.resetRuleForm();
        },
        error: (error) => {
          console.error('Error creando regla:', error);
          this.showMessage('Error al crear regla de asignación', 'error');
        }
      });
  }

  /**
   * Probar asignación automática
   */
  testAssignment(): void {
    if (!this.testAssignmentData.servicio_id) {
      this.showMessage('Por favor selecciona un servicio', 'error');
      return;
    }

    this.assignmentService.testAssignment(this.testAssignmentData.servicio_id, this.testAssignmentData.prioridad)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.testResult = result;
          if (result.success) {
            this.showMessage('Prueba de asignación exitosa', 'success');
          } else {
            this.showMessage('No se pudo asignar automáticamente', 'warning');
          }
        },
        error: (error) => {
          console.error('Error probando asignación:', error);
          this.showMessage('Error al probar asignación', 'error');
        }
      });
  }

  /**
   * Cambiar estado de especialidad
   */
  toggleSpecialtyStatus(specialty: TechnicianSpecialty): void {
    this.assignmentService.updateSpecialty(specialty.id, { activo: !specialty.activo })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.showMessage('Estado actualizado exitosamente', 'success');
          this.loadSpecialties();
        },
        error: (error) => {
          console.error('Error actualizando estado:', error);
          this.showMessage('Error al actualizar estado', 'error');
        }
      });
  }

  /**
   * Cambiar estado de regla
   */
  toggleRuleStatus(rule: AssignmentRule): void {
    this.assignmentService.updateAssignmentRule(rule.id, { activo: !rule.activo })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.showMessage('Estado actualizado exitosamente', 'success');
          this.loadAssignmentRules();
        },
        error: (error) => {
          console.error('Error actualizando estado:', error);
          this.showMessage('Error al actualizar estado', 'error');
        }
      });
  }

  /**
   * Resetear formulario de especialidad
   */
  resetSpecialtyForm(): void {
    this.newSpecialty = {
      usuario_id: undefined,
      area_especialidad: '',
      nivel_expertise: 'secundario'
    };
    this.showSpecialtyForm = false;
  }

  /**
   * Resetear formulario de regla
   */
  resetRuleForm(): void {
    this.newRule = {
      servicio_id: undefined,
      area_servicio: '',
      prioridad_ticket: 'media',
      tecnico_principal_id: undefined,
      tecnico_secundario_id: undefined,
      tecnico_soporte_id: undefined,
      carga_maxima: 5
    };
    this.showRuleForm = false;
  }

  /**
   * Cambiar pestaña activa
   */
  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.clearMessages();
  }

  /**
   * Mostrar mensaje
   */
  showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.message = message;
    this.messageType = type;
    setTimeout(() => this.clearMessages(), 5000);
  }

  /**
   * Limpiar mensajes
   */
  clearMessages(): void {
    this.message = '';
    this.messageType = '';
  }

  /**
   * Obtener especialidades filtradas
   */
  get filteredSpecialties(): TechnicianSpecialty[] {
    if (!this.specialtySearchTerm) return this.specialties;

    const term = this.specialtySearchTerm.toLowerCase();
    return this.specialties.filter(specialty =>
      specialty.tecnico_nombre.toLowerCase().includes(term) ||
      specialty.area_especialidad.toLowerCase().includes(term)
    );
  }

  /**
   * Obtener reglas filtradas
   */
  get filteredRules(): AssignmentRule[] {
    if (!this.ruleSearchTerm) return this.assignmentRules;

    const term = this.ruleSearchTerm.toLowerCase();
    return this.assignmentRules.filter(rule =>
      rule.area_servicio.toLowerCase().includes(term) ||
      rule.categoria.toLowerCase().includes(term) ||
      rule.subcategoria.toLowerCase().includes(term)
    );
  }

  /**
   * Obtener técnicos disponibles para un área específica
   */
  getTechniciansForArea(area: string): any[] {
    return this.users.filter(user =>
      this.specialties.some(spec =>
        spec.usuario_id === user.id &&
        spec.area_especialidad === area &&
        spec.activo
      )
    );
  }

  /**
   * Obtener servicios para un área específica
   */
  getServicesForArea(area: string): any[] {
    return this.services.filter(service =>
      this.mapCategoryToArea(service.categoria) === area
    );
  }

  /**
   * Mapear categoría a área (método auxiliar local)
   */
  private mapCategoryToArea(categoria: string): string {
    const categoriaLower = categoria.toLowerCase();

    if (categoriaLower.includes('internet') || categoriaLower.includes('conexión') || categoriaLower.includes('acceso')) {
      return 'INTERNET';
    }
    if (categoriaLower.includes('teléfono') || categoriaLower.includes('telefonía') || categoriaLower.includes('ip')) {
      return 'TELEFONIA_IP';
    }
    if (categoriaLower.includes('computadora') || categoriaLower.includes('equipo') ||
        categoriaLower.includes('impresora') || categoriaLower.includes('proyector')) {
      return 'EQUIPO_COMPUTO';
    }
    if (categoriaLower.includes('correo') || categoriaLower.includes('email')) {
      return 'CORREO';
    }
    if (categoriaLower.includes('software') || categoriaLower.includes('office') ||
        categoriaLower.includes('teams') || categoriaLower.includes('connect')) {
      return 'SOFTWARE';
    }
    if (categoriaLower.includes('red') || categoriaLower.includes('wifi') || categoriaLower.includes('nodo')) {
      return 'RED';
    }

    return 'GENERAL';
  }

  // Métodos auxiliares para formateo
  formatArea = (area: string) => this.assignmentService.formatAreaForDisplay(area);
  formatExpertise = (level: string) => this.assignmentService.formatExpertiseForDisplay(level);
  formatPriority = (priority: string) => this.assignmentService.formatPriorityForDisplay(priority);
  getExpertiseColor = (level: string) => this.assignmentService.getExpertiseColor(level);
  getPriorityColor = (priority: string) => this.assignmentService.getPriorityColor(priority);
  getAvailableAreas = () => this.assignmentService.getAvailableAreas();
  getAvailableExpertiseLevels = () => this.assignmentService.getAvailableExpertiseLevels();
  getAvailablePriorities = () => this.assignmentService.getAvailablePriorities();
}
