import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

// Función interceptor para usar con withInterceptors
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: (req: HttpRequest<unknown>) => Observable<HttpEvent<unknown>>) => {
  // Obtener token directamente de localStorage (más confiable)
  let token: string | null = null;
  
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('token');
    }
  } catch (e) {
    // Si falla al acceder a localStorage, continuar sin token
    console.warn('⚠️ No se pudo acceder a localStorage');
  }

  // Si no hay token en localStorage, intentar del AuthService como fallback
  if (!token) {
    try {
      const authService = inject(AuthService);
      token = authService.getToken();
    } catch (e) {
      // Si falla la inyección, continuar sin token (no es crítico)
    }
  }

  // Si hay token, agregarlo al header de Authorization
  let authReq = req;
  if (token) {
    try {
      authReq = req.clone({
        setHeaders: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (e) {
      // Si falla al clonar la petición, continuar con la original
      console.warn('⚠️ Error al clonar request:', e);
    }
  }
  
  // Agregar timeout de 30 segundos y manejar errores
  return next(authReq).pipe(
    timeout(30000), // 30 segundos de timeout
    catchError((error: any) => {
      // Manejar timeout
      if (error instanceof TimeoutError || error?.name === 'TimeoutError') {
        console.error('⏱️ Timeout: La petición tardó más de 30 segundos');
        return throwError(() => new Error('Tiempo de espera agotado. El servidor está tardando demasiado en responder.'));
      }

      // Manejar HttpErrorResponse
      if (error instanceof HttpErrorResponse) {
        // Manejar error 401 (Token expirado o inválido)
        if (error.status === 401) {
        console.warn('🔒 Token expirado o inválido. Redirigiendo al login...');
        
        // Limpiar datos de autenticación
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
          
          // Cerrar sesión en el servicio
          const authService = inject(AuthService);
          authService.logout();
          
          // Redirigir al login (evitar redirección si ya estamos en login)
          const router = inject(Router);
          const currentUrl = router.url;
          if (!currentUrl.includes('/login')) {
            router.navigate(['/login'], { 
              queryParams: { expired: 'true' },
              replaceUrl: true 
            });
          }
        } catch (e) {
          console.error('❌ Error al manejar expiración de token:', e);
          // Fallback: redirección directa
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login?expired=true';
          }
        }
        
          return throwError(() => new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'));
        }
        
        // Manejar error 403 (Sin permisos)
        if (error.status === 403) {
          console.warn('🚫 Acceso denegado:', error.error?.error || 'No tienes permisos para esta acción');
          return throwError(() => new Error(error.error?.error || 'No tienes permisos para esta acción'));
        }
        
        // Manejar error de conexión (status 0)
        if (error.status === 0) {
          console.error('❌ Error de conexión: El servidor no está disponible');
          return throwError(() => new Error('Error de conexión. Verifica que el servidor esté disponible.'));
        }
      }
      
      // Otros errores (pasar el error original)
      return throwError(() => error);
    })
  );
};

// Clase interceptor (alternativa)
@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Obtener el token del AuthService
    const token = this.authService.getToken();

    // Si hay token, agregarlo al header de Authorization
    if (token) {
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      return next.handle(authReq);
    }

    // Si no hay token, enviar la petición sin modificar
    return next.handle(req);
  }
}
