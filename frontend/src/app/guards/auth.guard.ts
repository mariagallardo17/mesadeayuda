import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { NavigationService } from '../services/navigation.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router,
    private navigationService: NavigationService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (user) {
          // Si el usuario tiene contraseña temporal y no está en la página de cambio de contraseña,
          // redirigir a cambio de contraseña
          if (user.password_temporal && route.routeConfig?.path !== 'change-password') {
            this.navigationService.navigateWithoutHistory(['/change-password']);
            return false;
          }

          // Si está en la página de cambio de contraseña pero no tiene contraseña temporal,
          // redirigir al dashboard
          if (route.routeConfig?.path === 'change-password' && !user.password_temporal) {
            this.navigationService.navigateWithoutHistory(['/dashboard']);
            return false;
          }

          return true;
        } else {
          // Usar el servicio de navegación para redirigir sin historial
          this.navigationService.navigateWithoutHistory(['/login']);
          return false;
        }
      })
    );
  }
}
