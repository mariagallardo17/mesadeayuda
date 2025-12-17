import { Component, signal, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from './services/auth.service';
import { SidebarService } from './services/sidebar.service';
import { NavigationService } from './services/navigation.service';
import { SidebarMenuComponent } from './components/sidebar-menu/sidebar-menu.component';
import { HeaderComponent } from './components/header/header.component';
import { Subject, takeUntil, filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, SidebarMenuComponent, HeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('mesadeayuda');

  isAuthenticated = false;
  isSidebarCollapsed = false;
  currentRoute = '';
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private navigationService: NavigationService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Verificar autenticación inicial inmediatamente
    const currentUser = this.authService.getCurrentUser();
    this.isAuthenticated = currentUser !== null;
  }

  ngOnInit(): void {
    // Establecer ruta actual
    this.currentRoute = this.router.url;

    // Escuchar cambios de ruta
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.currentRoute = event.url;
      });

    // Verificar estado de autenticación
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.isAuthenticated = user !== null;
        // Si el usuario está autenticado y está en login, redirigir
        if (user && this.currentRoute === '/login') {
          this.router.navigate(['/profile']);
        }
        // Si no hay usuario y no está en login, redirigir a login
        if (!user && this.currentRoute !== '/login' && this.currentRoute !== '/change-password') {
          this.router.navigate(['/login']);
        }
      });

    // Verificar estado del sidebar
    this.sidebarService.isCollapsed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isCollapsed => {
        this.isSidebarCollapsed = isCollapsed;
      });

    // Verificar tamaño de pantalla al inicializar
    this.sidebarService.checkScreenSize();

    // Escuchar cambios de tamaño de ventana
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('resize', () => {
        this.sidebarService.checkScreenSize();
      });
    }

    // Inicializar el servicio de navegación
    this.navigationService.disableBrowserNavigation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
