import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, catchError, delay, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { User, CreateUserRequest, UpdateUserRequest } from '../models/user.model';
import { ApiConfig } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersSubject = new BehaviorSubject<User[]>([]);
  public users$ = this.usersSubject.asObservable();

  //  predefinidos eliminados - ahora solo usamos la API

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    // Cargar usuarios desde la API al inicializar
    this.loadUsers();
  }

  // Cargar usuarios desde la API
  private loadUsers(): void {
    // Verificar si hay un token de autenticación
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No hay token de autenticación. No se pueden cargar usuarios.');
      this.usersSubject.next([]);
      return;
    }

    console.log('🔍 Cargando usuarios desde la API...');
    this.http.get<any[]>(`${ApiConfig.API_BASE_URL}/users`)
      .pipe(
        map(users => users.map(user => this.mapBackendUserToFrontend(user))),
        catchError(error => {
          console.error('❌ Error cargando usuarios:', error);
          // NO usar usuarios predefinidos como fallback
          this.usersSubject.next([]);
          return throwError(() => error);
        })
      )
      .subscribe(users => {
        console.log('✅ Usuarios cargados desde API:', users);
        this.usersSubject.next(users);
      });
  }

  /**
   * Mapea los datos del backend al formato del frontend
   */
  private mapBackendUserToFrontend(backendUser: any): User {
    return {
      id: backendUser.id || backendUser.id_usuario,
      nombre: backendUser.nombre || '',
      apellido: backendUser.apellido || '', // Si no existe, usar string vacío
      correo: backendUser.correo || '',
      rol: backendUser.rol || 'empleado',
      activo: backendUser.activo !== undefined
        ? backendUser.activo
        : (backendUser.estatus === 'Activo' || backendUser.estatus === 1 || backendUser.estatus === true),
      departamento: backendUser.departamento || '',
      num_empleado: backendUser.num_empleado || backendUser.numEmpleado,
      fechaCreacion: backendUser.fechaCreacion ? new Date(backendUser.fechaCreacion) : new Date(),
      nombreCompleto: `${backendUser.nombre || ''} ${backendUser.apellido || ''}`.trim()
    };
  }

  // Obtener todos los usuarios
  getUsers(): Observable<User[]> {
    // Verificar si hay un token de autenticación
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No hay token de autenticación. No se pueden cargar usuarios.');
      return of([]);
    }

    // Hacer petición HTTP directamente para obtener usuarios actualizados
    return this.http.get<any[]>(`${ApiConfig.API_BASE_URL}/users`)
      .pipe(
        map(users => {
          const mappedUsers = users.map(user => this.mapBackendUserToFrontend(user));
          // Actualizar el BehaviorSubject con los nuevos datos
          this.usersSubject.next(mappedUsers);
          return mappedUsers;
        }),
        catchError(error => {
          console.error('❌ Error cargando usuarios:', error);
          this.usersSubject.next([]);
          return throwError(() => error);
        })
      );
  }

  // Buscar usuarios solo por ID o nombre
  searchUsers(query: string): Observable<User[]> {
    return this.users$.pipe(
      map(users => {
        if (!query.trim()) return users;

        const searchTerm = query.toLowerCase();
        return users.filter(user => {
          // Buscar solo por ID (número)
          const userIdMatch = user.id?.toString().includes(searchTerm);

          // Buscar solo por nombre completo
          const fullNameMatch = user.nombre.toLowerCase().includes(searchTerm) ||
                               (user.apellido || '').toLowerCase().includes(searchTerm) ||
                               `${user.nombre} ${user.apellido || ''}`.toLowerCase().includes(searchTerm);

          return userIdMatch || fullNameMatch;
        });
      }),
      delay(200)
    );
  }

  // Crear nuevo usuario
  createUser(userData: CreateUserRequest): Observable<User> {
    const requestData = {
      num_empleado: userData.numEmpleado || `EMP${Date.now()}`,
      nombre: userData.nombre,
      departamento: userData.departamento,
      correo: userData.correo,
      password: userData.password,
      rol: userData.rol,
      activo: true
    };

    console.log('📤 UserService - Enviando request:', requestData);
    console.log('📤 UserService - URL:', `${ApiConfig.API_BASE_URL}/users`);

    return this.http.post<{message: string, user: any}>(`${ApiConfig.API_BASE_URL}/users`, requestData)
      .pipe(
        map(response => {
          console.log('✅ UserService - Respuesta del backend:', response);
          // Mapear el usuario del backend al formato del frontend
          const mappedUser = this.mapBackendUserToFrontend(response.user);
          console.log('✅ UserService - Usuario mapeado:', mappedUser);
          // Agregar usuario a la lista local sin recargar toda la lista
          this.addUserToList(mappedUser);
          return mappedUser;
        }),
        catchError(error => {
          console.error('❌ UserService - Error creando usuario:', error);
          console.error('❌ UserService - Status:', error.status);
          console.error('❌ UserService - Error completo:', JSON.stringify(error, null, 2));
          return throwError(() => new Error(error.error?.error || error.message || 'Error al crear el usuario'));
        })
      );
  }

  // Actualizar usuario
  updateUser(id: number, userData: UpdateUserRequest): Observable<User> {
    const requestData: any = {};

    if (userData.correo) requestData.correo = userData.correo;
    if (userData.nombre) requestData.nombre = userData.nombre;
    if (userData.departamento) requestData.departamento = userData.departamento;
    if (userData.rol) requestData.rol = userData.rol;
    if (userData.activo !== undefined) requestData.activo = userData.activo;
    if (userData.numEmpleado) requestData.num_empleado = userData.numEmpleado;

    return this.http.put<{message: string}>(`${ApiConfig.API_BASE_URL}/users/${id}`, requestData)
      .pipe(
        map(response => {
          // Actualizar el usuario en la lista local sin recargar toda la lista
          this.updateUserInList(id, userData);
          return {} as User;
        }),
        catchError(error => {
          console.error('Error actualizando usuario:', error);
          return throwError(() => new Error(error.error?.error || 'Error al actualizar el usuario'));
        })
      );
  }

  // Eliminar usuario
  deleteUser(id: number): Observable<boolean> {
    return this.http.delete<{message: string}>(`${ApiConfig.API_BASE_URL}/users/${id}`)
      .pipe(
        map(response => {
          // Eliminar usuario de la lista local sin recargar toda la lista
          this.removeUserFromList(id);
          return true;
        }),
        catchError(error => {
          console.error('Error eliminando usuario:', error);
          return throwError(() => new Error(error.error?.error || 'Error al eliminar el usuario'));
        })
      );
  }

  // Resetear contraseña
  resetPassword(id: number): Observable<string> {
    return this.http.post<{message: string, newPassword: string}>(`${ApiConfig.API_BASE_URL}/users/${id}/reset-password`, {})
      .pipe(
        map(response => {
          // No necesitamos recargar la lista para reset de contraseña
          // ya que no afecta la información visible en la lista
          return response.newPassword;
        }),
        catchError(error => {
          console.error('Error reseteando contraseña:', error);
          return throwError(() => new Error(error.error?.error || 'Error al resetear la contraseña'));
        })
      );
  }

  // Cambiar estado del usuario (activar/desactivar)
  toggleUserStatus(id: number): Observable<User> {
    // Obtener el usuario actual de la lista local
    const currentUsers = this.usersSubject.value;
    const user = currentUsers.find(u => u.id === id);

    if (!user) {
      return throwError(() => new Error('Usuario no encontrado'));
    }

    const newStatus = !user.activo;

    // Actualizar usando el método optimizado
    return this.updateUser(id, { activo: newStatus });
  }

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Obtener departamentos disponibles
  getDepartments(): string[] {
    return [
      'IT',
      'Dirección',
      'Subdireccion Administrativa',
      'Subdireccion Academica',
      'Subdireccion de planeacion y vinculacion',
      'Jefaturas de división',
      'Jefes de departamento',
      'Docentes',
      'Auxiliares',
      'Asistentes'
    ];
  }

  // Obtener roles disponibles según el departamento
  getRolesForDepartment(department: string): string[] {
    if (department === 'IT') {
      return ['administrador', 'tecnico', 'empleado'];
    } else {
      return ['empleado'];
    }
  }

  // Obtener rol automático según el departamento
  getAutoRoleForDepartment(department: string): string {
    if (department === 'IT') {
      return 'empleado'; // Por defecto empleado para IT, pero puede cambiarse
    } else {
      return 'empleado'; // Automático para todos los demás departamentos
    }
  }

  // Obtener roles disponibles
  getRoles(): string[] {
    return ['administrador', 'tecnico', 'empleado'];
  }

  // Actualizar usuario en la lista local sin recargar toda la lista
  private updateUserInList(id: number, userData: UpdateUserRequest): void {
    const currentUsers = this.usersSubject.value;
    const userIndex = currentUsers.findIndex(user => user.id === id);

    if (userIndex !== -1) {
      const updatedUser = { ...currentUsers[userIndex] };

      // Actualizar solo los campos que cambiaron
      if (userData.nombre) updatedUser.nombre = userData.nombre;
      if (userData.correo) updatedUser.correo = userData.correo;
      if (userData.departamento) updatedUser.departamento = userData.departamento;
      if (userData.rol) updatedUser.rol = userData.rol;
      if (userData.activo !== undefined) updatedUser.activo = userData.activo;
      if (userData.numEmpleado) updatedUser.num_empleado = userData.numEmpleado;

      // Actualizar la lista
      const newUsers = [...currentUsers];
      newUsers[userIndex] = updatedUser;
      this.usersSubject.next(newUsers);
    }
  }

  // Eliminar usuario de la lista local sin recargar toda la lista
  private removeUserFromList(id: number): void {
    const currentUsers = this.usersSubject.value;
    const filteredUsers = currentUsers.filter(user => user.id !== id);
    this.usersSubject.next(filteredUsers);
  }

  // Agregar usuario a la lista local sin recargar toda la lista
  private addUserToList(newUser: User): void {
    const currentUsers = this.usersSubject.value;
    const updatedUsers = [...currentUsers, newUser];
    this.usersSubject.next(updatedUsers);
  }

  // Obtener solo técnicos (usuarios con rol "técnico")
  getTechnicians(): Observable<User[]> {
    return this.users$.pipe(
      map(users => {
        return users.filter(user =>
          user.rol && user.rol.toLowerCase() === 'tecnico' && user.activo
        ).sort((a, b) => {
          const nameA = `${a.nombre} ${a.apellido || ''}`.trim().toLowerCase();
          const nameB = `${b.nombre} ${b.apellido || ''}`.trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
      })
    );
  }
}
