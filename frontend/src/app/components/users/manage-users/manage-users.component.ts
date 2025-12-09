import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { SidebarService } from '../../../services/sidebar.service';
import { User, CreateUserRequest, UpdateUserRequest } from '../../../models/user.model';
import { passwordValidator } from '../../../validators/password.validator';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './manage-users.component.html',
  styleUrls: ['./manage-users.component.css']
})
export class ManageUsersComponent implements OnInit, OnDestroy {
  users: User[] = [];
  filteredUsers: User[] = [];
  isLoading = false;
  searchQuery = '';
  showAddForm = false;
  showEditForm = false;
  showActionsPanel = false;
  selectedUser: User | null = null;
  errorMessage = '';
  successMessage = '';
  departments: string[] = [];
  roles: string[] = [];

  // Modales de confirmación y éxito
  showSuccessModal = false;
  showErrorModal = false;
  showConfirmModal = false;
  confirmMessage = '';
  confirmTitle = '';
  confirmAction: (() => void) | null = null;

  addUserForm: FormGroup;
  editUserForm: FormGroup;
  availableRolesForAdd: string[] = [];
  availableRolesForEdit: string[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private userService: UserService,
    private sidebarService: SidebarService,
    private fb: FormBuilder
  ) {
    // Inicializar formulario vacío
    this.addUserForm = this.createEmptyAddUserForm();

    this.editUserForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      correo: ['', [Validators.required, Validators.email]],
      rol: ['', [Validators.required]],
      departamento: ['', [Validators.required]],
      activo: [true]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
    this.departments = this.userService.getDepartments();
    this.roles = this.userService.getRoles();

    // Configurar listeners para cambio de departamento
    this.setupDepartmentChangeListeners();

    // Suscribirse al evento de menú abierto para cerrar el panel de acciones
    this.sidebarService.menuOpened$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.closeUserActionsPanel();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.userService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
          this.filteredUsers = users;
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = 'Error al cargar los usuarios';
          this.isLoading = false;
        }
      });
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value;

    if (this.searchQuery.trim()) {
      this.userService.searchUsers(this.searchQuery)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (users) => {
            this.filteredUsers = users;
          },
          error: (error) => {
            this.errorMessage = 'Error al buscar usuarios';
          }
        });
    } else {
      this.filteredUsers = this.users;
    }
  }

  onSearchEnter(): void {
    // Forzar la búsqueda al presionar Enter
    if (this.searchQuery.trim()) {
      this.userService.searchUsers(this.searchQuery)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (users) => {
            this.filteredUsers = users;
            console.log(`🔍 Búsqueda ejecutada: "${this.searchQuery}" - ${users.length} resultados`);
          },
          error: (error) => {
            this.errorMessage = 'Error al buscar usuarios';
          }
        });
    } else {
      this.filteredUsers = this.users;
    }
  }

  selectUser(user: User): void {
    this.selectedUser = user;
    // No abrir el panel automáticamente, solo seleccionar el usuario
    this.showAddForm = false;
    this.showEditForm = false;
    this.clearMessages();
  }

  showUserActions(user: User, event: Event): void {
    event.stopPropagation();

    // Si es el mismo usuario y el panel está abierto, cerrarlo
    if (this.selectedUser?.id === user.id && this.showActionsPanel) {
      this.closeUserActionsPanel();
      return;
    }

    // Seleccionar el usuario y abrir/cerrar el panel
    this.selectUser(user);
    this.showActionsPanel = true;
  }

  showAddUserForm(): void {
    this.showAddForm = true;
    this.showEditForm = false;
    this.showActionsPanel = false;
    this.selectedUser = null;
    this.clearMessages();

    // Limpiar roles disponibles
    this.availableRolesForAdd = [];

    // Recrear el formulario completamente vacío
    this.addUserForm = this.createEmptyAddUserForm();

    // Reconfigurar listeners después de recrear el formulario
    this.setupAddFormListeners();

    // Forzar limpieza adicional
    this.forceFormClean();

    // Limpiar campos del DOM directamente
    setTimeout(() => {
      this.clearFormFields();
    }, 50);
  }

  private clearFormFields(): void {
    // Limpiar campos del DOM directamente
    const emailField = document.getElementById('add-email') as HTMLInputElement;
    const passwordField = document.getElementById('add-password') as HTMLInputElement;
    const nombreField = document.getElementById('add-nombre') as HTMLInputElement;

    if (emailField) {
      emailField.value = '';
      emailField.setAttribute('value', '');
    }
    if (passwordField) {
      passwordField.value = '';
      passwordField.setAttribute('value', '');
    }
    if (nombreField) {
      nombreField.value = '';
      nombreField.setAttribute('value', '');
    }
  }

  private createEmptyAddUserForm(): FormGroup {
    return this.fb.group({
      nombre: [null, [Validators.required, Validators.minLength(2)]],
      correo: [null, [Validators.required, Validators.email]],
      password: [null, [Validators.required, passwordValidator()]],
      rol: [null, [Validators.required]],
      departamento: [null, [Validators.required]]
    });
  }

  private setupAddFormListeners(): void {
    // Listener para cambio de departamento en formulario de agregar
    this.addUserForm.get('departamento')?.valueChanges.subscribe(department => {
      this.onDepartmentChange(department, 'add');
    });
  }

  private forceFormClean(): void {
    // Forzar limpieza completa del formulario
    setTimeout(() => {
      if (this.addUserForm) {
        this.addUserForm.patchValue({
          nombre: null,
          correo: null,
          password: null,
          rol: null,
          departamento: null
        });

        // Marcar como untouched para limpiar validaciones
        this.addUserForm.markAsUntouched();
        this.addUserForm.markAsPristine();
      }
    }, 10);
  }

  showEditUserForm(user: User): void {
    this.selectedUser = user;
    this.showEditForm = true;
    this.showAddForm = false;
    this.showActionsPanel = false;

    this.editUserForm.patchValue({
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
      departamento: user.departamento,
      activo: user.activo
    });

    this.clearMessages();
  }

  hideForms(): void {
    this.showAddForm = false;
    this.showEditForm = false;
    this.showActionsPanel = false;
    this.selectedUser = null;
    this.clearMessages();

    // Limpiar el formulario de agregar cuando se cierre
    if (this.addUserForm) {
      this.addUserForm = this.createEmptyAddUserForm();
    }
  }

  onSubmitAddUser(): void {
    console.log('🔍 onSubmitAddUser llamado');
    console.log('📋 Formulario válido:', this.addUserForm.valid);
    console.log('📋 Valores del formulario:', this.addUserForm.value);
    console.log('📋 Errores del formulario:', this.addUserForm.errors);
    
    // Mostrar errores de cada campo
    Object.keys(this.addUserForm.controls).forEach(key => {
      const control = this.addUserForm.get(key);
      if (control && control.invalid) {
        console.log(`❌ Campo ${key} inválido:`, control.errors);
      }
    });

    if (this.addUserForm.valid) {
      this.isLoading = true;
      const userData: CreateUserRequest = this.addUserForm.value;
      console.log('📤 Enviando datos al backend:', userData);

      this.userService.createUser(userData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (newUser) => {
            console.log('✅ Usuario creado exitosamente:', newUser);
            this.successMessage = `Usuario ${newUser.nombre} creado exitosamente`;
            this.showSuccessModal = true;
            this.hideForms();
            this.loadUsers();
            this.isLoading = false;
          },
          error: (error) => {
            console.error('❌ Error al crear usuario:', error);
            console.error('❌ Detalles del error:', error.error);
            this.errorMessage = error.error?.error || error.message || 'Error al crear el usuario';
            this.showErrorModal = true;
            this.isLoading = false;
          }
        });
    } else {
      console.log('❌ Formulario inválido, no se puede enviar');
      this.errorMessage = 'Por favor, complete todos los campos correctamente';
      this.showErrorModal = true;
    }
  }

  onSubmitEditUser(): void {
    if (this.editUserForm.valid && this.selectedUser) {
      this.isLoading = true;
      const userData: UpdateUserRequest = this.editUserForm.value;

      this.userService.updateUser(this.selectedUser.id!, userData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updatedUser) => {
            this.successMessage = `Usuario ${updatedUser.nombre} actualizado exitosamente`;
            this.showSuccessModal = true;
            this.hideForms();
            this.loadUsers();
            this.isLoading = false;
          },
          error: (error) => {
            this.errorMessage = error.message || 'Error al actualizar el usuario';
            this.showErrorModal = true;
            this.isLoading = false;
          }
        });
    } else {
      this.errorMessage = 'Por favor, complete todos los campos correctamente';
      this.showErrorModal = true;
    }
  }

  deleteUser(user: User): void {
    this.confirmTitle = 'Confirmar eliminación';
    this.confirmMessage = `¿Está seguro de que desea eliminar al usuario ${user.nombre}? Esta acción no se puede deshacer.`;
    this.confirmAction = () => {
      this.isLoading = true;
      this.closeConfirmModal();

      this.userService.deleteUser(user.id!)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.successMessage = `Usuario ${user.nombre} eliminado exitosamente`;
            this.showSuccessModal = true;
            this.loadUsers();
            this.isLoading = false;
          },
          error: (error) => {
            this.errorMessage = error.message || 'Error al eliminar el usuario';
            this.showErrorModal = true;
            this.isLoading = false;
          }
        });
    };
    this.showConfirmModal = true;
  }

  resetPassword(user: User): void {
    this.confirmTitle = 'Confirmar reseteo de contraseña';
    this.confirmMessage = `¿Está seguro de que desea resetear la contraseña de ${user.nombre}? Esto establecerá una nueva contraseña temporal y el usuario deberá cambiarla en su próximo inicio de sesión.`;
    this.confirmAction = () => {
      this.isLoading = true;
      this.closeConfirmModal();

      this.userService.resetPassword(user.id!)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (newPassword) => {
            this.successMessage = `Contraseña reseteada exitosamente para ${user.nombre}. Nueva contraseña temporal: ${newPassword}. El usuario deberá cambiar esta contraseña en su próximo inicio de sesión.`;
            this.showSuccessModal = true;
            this.isLoading = false;
          },
          error: (error) => {
            this.errorMessage = error.message || 'Error al resetear la contraseña';
            this.showErrorModal = true;
            this.isLoading = false;
          }
        });
    };
    this.showConfirmModal = true;
  }

  toggleUserStatus(user: User): void {
    const action = user.activo ? 'desactivar' : 'activar';
    this.confirmTitle = `Confirmar ${action} usuario`;
    this.confirmMessage = `¿Está seguro de que desea ${action} al usuario ${user.nombre}?`;
    this.confirmAction = () => {
      this.isLoading = true;
      this.closeConfirmModal();

      this.userService.toggleUserStatus(user.id!)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updatedUser) => {
            this.successMessage = `Usuario ${updatedUser.nombre} ${updatedUser.activo ? 'activado' : 'desactivado'} exitosamente`;
            this.showSuccessModal = true;
            this.loadUsers();
            this.isLoading = false;
          },
          error: (error) => {
            this.errorMessage = error.message || 'Error al cambiar el estado del usuario';
            this.showErrorModal = true;
            this.isLoading = false;
          }
        });
    };
    this.showConfirmModal = true;
  }

  getRoleLabel(role: string): string {
    const labels: { [key: string]: string } = {
      'administrador': 'Administrador',
      'tecnico': 'Técnico',
      'empleado': 'Empleado'
    };
    return labels[role] || role;
  }

  getRoleColor(role: string): string {
    const colors: { [key: string]: string } = {
      'administrador': 'role-admin',
      'tecnico': 'role-tech',
      'empleado': 'role-employee'
    };
    return colors[role] || 'role-default';
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

  trackByUserId(index: number, user: User): number {
    return user.id || index;
  }

  // Getters para el formulario de agregar usuario
  get addNombre() { return this.addUserForm.get('nombre'); }
  get addCorreo() { return this.addUserForm.get('correo'); }
  get addPassword() { return this.addUserForm.get('password'); }
  get addRol() { return this.addUserForm.get('rol'); }
  get addDepartamento() { return this.addUserForm.get('departamento'); }

  // Getters para el formulario de editar usuario
  get editNombre() { return this.editUserForm.get('nombre'); }
  get editCorreo() { return this.editUserForm.get('correo'); }
  get editRol() { return this.editUserForm.get('rol'); }
  get editDepartamento() { return this.editUserForm.get('departamento'); }
  get editActivo() { return this.editUserForm.get('activo'); }

  // Configurar listeners para cambio de departamento
  private setupDepartmentChangeListeners(): void {
    // NO configurar listener para formulario de agregar aquí - se hace dinámicamente
    // Listener para formulario de editar usuario
    this.editUserForm.get('departamento')?.valueChanges.subscribe(department => {
      this.onDepartmentChange(department, 'edit');
    });
  }

  // Manejar cambio de departamento
  private onDepartmentChange(department: string, formType: 'add' | 'edit'): void {
    if (!department) return;

    const availableRoles = this.userService.getRolesForDepartment(department);
    const autoRole = this.userService.getAutoRoleForDepartment(department);

    if (formType === 'add') {
      // Actualizar roles disponibles
      this.availableRolesForAdd = availableRoles;

      // NO asignar rol automático - dejar que el usuario elija
      // Solo limpiar el rol si no está en la lista de roles disponibles
      const currentRole = this.addUserForm.get('rol')?.value;
      if (currentRole && !availableRoles.includes(currentRole)) {
        this.addUserForm.patchValue({ rol: null });
      }
    } else {
      // Para edición, solo actualizar si el rol actual no está disponible
      this.availableRolesForEdit = availableRoles;
      const currentRole = this.editUserForm.get('rol')?.value;

      if (currentRole && !availableRoles.includes(currentRole)) {
        this.editUserForm.patchValue({ rol: autoRole });
      }
    }
  }

  // Obtener roles disponibles para el formulario de agregar
  getAvailableRolesForAdd(): string[] {
    const department = this.addUserForm.get('departamento')?.value;
    if (department) {
      return this.userService.getRolesForDepartment(department);
    }
    return this.roles;
  }

  // Obtener roles disponibles para el formulario de editar
  getAvailableRolesForEdit(): string[] {
    const department = this.editUserForm.get('departamento')?.value;
    if (department) {
      return this.userService.getRolesForDepartment(department);
    }
    return this.roles;
  }

  // Cerrar el panel de acciones de usuario
  closeUserActionsPanel(): void {
    this.showActionsPanel = false;
    this.selectedUser = null;
  }

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
}
