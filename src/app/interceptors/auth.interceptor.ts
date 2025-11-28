import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';

// Función interceptor para usar con withInterceptors
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: (req: HttpRequest<unknown>) => Observable<HttpEvent<unknown>>) => {
  const authService = inject(AuthService);

  // Obtener el token del AuthService
  const token = authService.getToken();

  // Log para debugging
  if (req.url.includes('/api/services')) {
    console.log('🔍 AuthInterceptor - URL:', req.url);
    console.log('🔑 Token disponible:', token ? 'SÍ' : 'NO');
    if (token) {
      console.log('🔑 Token (primeros 20 chars):', token.substring(0, 20) + '...');
    }
  }

  // Si hay token, agregarlo al header de Authorization
  if (token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authReq);
  }

  // Si no hay token, enviar la petición sin modificar
  console.log('⚠️ AuthInterceptor - Enviando petición sin token');
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
