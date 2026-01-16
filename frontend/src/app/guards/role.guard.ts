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
        console.log('🔐 RoleGuard - Verificando acceso:', {
          route: state.url,
          expectedRoles,
          user: user ? { id: user.id, nombre: user.nombre, rol: user.rol } : null
        });

        if (!user) {
          console.warn('⚠️ RoleGuard - No hay usuario, redirigiendo a /profile');
          this.router.navigate(['/profile']);
          return false;
        }

        // Los administradores siempre tienen acceso a todo
        if (user.rol === 'administrador') {
          console.log('✅ RoleGuard - Usuario es administrador, acceso permitido');
          return true;
        }

        // Verificar si el rol del usuario está en los roles permitidos
        if (expectedRoles && expectedRoles.includes(user.rol)) {
          console.log('✅ RoleGuard - Rol del usuario está permitido');
          return true;
        }

        console.warn('❌ RoleGuard - Acceso denegado. Rol del usuario:', user.rol, 'Roles esperados:', expectedRoles);
        alert('No tienes permisos para acceder a esta sección. Se requiere rol de administrador.');
        this.router.navigate(['/profile']);
        return false;
      })
    );
  }
}


