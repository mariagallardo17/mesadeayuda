import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';

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
  if (token) {
    try {
      const authReq = req.clone({
        setHeaders: {
          'Authorization': `Bearer ${token}`
        }
      });
      return next(authReq);
    } catch (e) {
      // Si falla al clonar la petición, continuar con la original
      return next(req);
    }
  }
  
  // Si no hay token, enviar la petición sin modificar
  return next(req);
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
