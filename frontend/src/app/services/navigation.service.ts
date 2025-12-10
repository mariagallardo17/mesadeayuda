import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private isNavigating: boolean = false;
  private previousUrl: string = '';

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.setupNavigationHandlers();
    }
  }

  private setupNavigationHandlers(): void {
    // Prevenir navegación del navegador
    window.addEventListener('popstate', (event) => {
      this.handlePopState(event);
    });

    // Escuchar cambios de ruta para limpiar formularios
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.handleRouteChange(event.url);
      });
  }

  private handlePopState(event: PopStateEvent): void {
    // Prevenir TODA la navegación del navegador
    event.preventDefault();

    const currentUrl = window.location.hash || window.location.pathname;

    // Mantener la URL actual sin cambiar
    window.history.pushState(null, '', currentUrl);

    // Si estamos en login y hay un historial, redirigir a dashboard
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      this.router.navigate(['/profile'], { replaceUrl: true });
      return;
    }

    // Si estamos en una ruta protegida y no hay usuario autenticado, ir a login
    if (this.isProtectedRoute(currentUrl) && !this.hasValidUser()) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    // Para cualquier otra ruta, simplemente prevenir el cambio
    return;
  }

  private handleRouteChange(url: string): void {
    // Limpiar formularios al cambiar de ruta
    this.clearFormsOnRouteChange(url);

    // Actualizar URL previa
    this.previousUrl = url;
  }

  private clearFormsOnRouteChange(url: string): void {
    // Si vamos al login, limpiar cualquier formulario previo
    if (url.includes('/login') || url.includes('#/login')) {
      this.clearLoginForm();
    }

    // Si salimos del login, limpiar formularios de login
    if (this.previousUrl &&
        (this.previousUrl.includes('/login') || this.previousUrl.includes('#/login')) &&
        !url.includes('/login') && !url.includes('#/login')) {
      this.clearLoginForm();
    }
  }

  private clearLoginForm(): void {
    // Limpiar formularios usando eventos personalizados
    const clearEvent = new CustomEvent('clearLoginForm');
    window.dispatchEvent(clearEvent);
  }

  private isProtectedRoute(url: string): boolean {
    const protectedRoutes = ['/profile', '/tickets', '/services', '/users'];
    return protectedRoutes.some(route =>
      url.includes(route) || url.includes(`#${route}`)
    );
  }

  private hasValidUser(): boolean {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }

  // Método público para forzar navegación sin historial
  navigateWithoutHistory(url: string[]): void {
    this.isNavigating = true;
    this.router.navigate(url, { replaceUrl: true }).then(() => {
      this.isNavigating = false;
    });
  }

  // Método para prevenir navegación del navegador completamente
  disableBrowserNavigation(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Interceptar todos los eventos de navegación
      window.addEventListener('beforeunload', (event) => {
        if (!this.isNavigating) {
          event.preventDefault();
          event.returnValue = '';
        }
      });

      // Interceptar teclas de navegación (flechas del navegador)
      document.addEventListener('keydown', (event) => {
        // Prevenir Alt + Flecha Izquierda (navegación hacia atrás)
        if (event.altKey && event.key === 'ArrowLeft') {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }

        // Prevenir Alt + Flecha Derecha (navegación hacia adelante)
        if (event.altKey && event.key === 'ArrowRight') {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }

        // Prevenir Ctrl + Flechas en algunos navegadores
        if ((event.ctrlKey || event.metaKey) &&
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }

        // Retornar undefined para otros casos
        return undefined;
      });

      // Interceptar eventos de mouse en las flechas del navegador
      window.addEventListener('popstate', (event) => {
        event.preventDefault();
        event.stopPropagation();

        // Mantener la URL actual sin cambiar
        const currentUrl = window.location.hash || window.location.pathname;
        window.history.pushState(null, '', currentUrl);

        return false;
      });

      // Prevenir clics en las flechas del navegador
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target && (target.classList.contains('back-button') ||
                      target.classList.contains('forward-button') ||
                      target.getAttribute('aria-label')?.includes('back') ||
                      target.getAttribute('aria-label')?.includes('forward') ||
                      target.getAttribute('aria-label')?.includes('atrás') ||
                      target.getAttribute('aria-label')?.includes('adelante'))) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        // Retornar undefined para otros casos
        return undefined;
      });

      // Interceptar eventos de mouse en el área de navegación del navegador
      document.addEventListener('mousedown', (event) => {
        const target = event.target as HTMLElement;
        if (target && target.closest('[role="navigation"]')) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        // Retornar undefined para otros casos
        return undefined;
      });

      // Prevenir navegación por gestos en trackpad
      document.addEventListener('wheel', (event) => {
        if (event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        // Retornar undefined para otros casos
        return undefined;
      });
    }
  }

  // Método para habilitar navegación del navegador
  enableBrowserNavigation(): void {
    // En una implementación más compleja, aquí se removerían los listeners
    // Por ahora, simplemente permitimos la navegación normal
    this.isNavigating = false;
  }
}
