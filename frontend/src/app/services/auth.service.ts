import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, of, throwError, timeout } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { User, LoginRequest, LoginResponse, ChangePasswordRequest } from '../models/user.model';
import { ApiConfig } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();


  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    // Solo verificar localStorage en el navegador
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        try {
          const user = JSON.parse(userData);
          this.currentUserSubject.next(user);
        } catch (error) {
          this.logout();
        }
      }
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${ApiConfig.API_BASE_URL}/auth/login`, {
      correo: credentials.correo,
      password: credentials.password
    }).pipe(
      timeout(10000), // 10 segundos de timeout
      map(response => {
        // Guardar en localStorage solo en el navegador
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
        }

        // Actualizar el estado
        this.currentUserSubject.next(response.user);

        return response;
      }),
      catchError(error => {
        console.error('Error en login:', error);

        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('Tiempo de espera agotado. Inténtalo de nuevo.'));
        }

        return throwError(() => new Error(error.error?.error || 'Error de autenticación'));
      })
    );
  }

  logout(): void {
    // Limpiar localStorage
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    // Actualizar el estado
    this.currentUserSubject.next(null);
    console.log('Logout exitoso');
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.rol) {
      console.warn('⚠️ hasRole: No hay usuario o rol', { user, role });
      return false;
    }
    // Normalizar comparación: trim y lowercase
    const userRol = String(user.rol).toLowerCase().trim();
    const expectedRol = String(role).toLowerCase().trim();
    const hasAccess = userRol === expectedRol;
    console.log('🔍 hasRole check:', { userRol, expectedRol, hasAccess, user });
    return hasAccess;
  }


  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  changePassword(request: ChangePasswordRequest): Observable<{ message: string }> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    return this.http.post<{ message: string }>(`${ApiConfig.API_BASE_URL}/auth/change-password`, {
      currentPassword: request.currentPassword,
      newPassword: request.newPassword
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).pipe(
      map(response => {
        // Actualizar el usuario local para quitar el flag de contraseña temporal
        const currentUser = this.getCurrentUser();
        if (currentUser) {
          currentUser.password_temporal = false;
          this.currentUserSubject.next(currentUser);

          // Actualizar localStorage
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('user', JSON.stringify(currentUser));
          }
        }
        return response;
      }),
      catchError(error => {
        console.error('Error cambiando contraseña:', error);
        return throwError(() => new Error(error.error?.error || 'Error al cambiar la contraseña'));
      })
    );
  }

  changeTemporaryPassword(newPassword: string): Observable<{ message: string }> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    return this.http.post<{ message: string }>(`${ApiConfig.API_BASE_URL}/auth/change-temporary-password`, {
      newPassword: newPassword
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).pipe(
      map(response => {
        // Actualizar el usuario local para quitar el flag de contraseña temporal
        const currentUser = this.getCurrentUser();
        if (currentUser) {
          currentUser.password_temporal = false;
          this.currentUserSubject.next(currentUser);

          // Actualizar localStorage
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('user', JSON.stringify(currentUser));
          }
        }
        return response;
      }),
      catchError(error => {
        console.error('Error cambiando contraseña temporal:', error);
        return throwError(() => new Error(error.error?.error || 'Error al cambiar la contraseña'));
      })
    );
  }

  recuperarPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${ApiConfig.API_BASE_URL}/auth/forgot-password`, {
      correo: email
    }).pipe(
      map((response: { message: string }) => response),
      catchError((error: any) => {
        return throwError(() => error);
      })
    );
  }

  private generateToken(user: User): string {
    // Simular un token JWT simple
    const payload = {
      sub: user.id,
      correo: user.correo,
      rol: user.rol,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
    };

    return btoa(JSON.stringify(payload));
  }

  // Métodos de verificación de roles
  isAdmin(): boolean {
    return this.hasRole('administrador');
  }

  isTecnico(): boolean {
    return this.hasRole('tecnico');
  }

  isEmpleado(): boolean {
    return this.hasRole('empleado');
  }

  // Método para actualizar el usuario actual en la sesión
  updateCurrentUser(updatedUser: User): void {
    this.currentUserSubject.next(updatedUser);
    
    // Actualizar localStorage
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  }
}
