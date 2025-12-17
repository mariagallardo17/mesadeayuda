import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const expectedRoles = route.data['roles'] as string[];

    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          this.router.navigate(['/dashboard']);
          return false;
        }

        // Los administradores siempre tienen acceso a todo
        if (user.rol === 'administrador') {
          return true;
        }

        // Verificar si el rol del usuario está en los roles permitidos
        if (expectedRoles && expectedRoles.includes(user.rol)) {
          return true;
        }

        this.router.navigate(['/dashboard']);
        return false;
      })
    );
  }
}


