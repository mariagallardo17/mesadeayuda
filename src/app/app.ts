import { Component, signal, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from './services/auth.service';
import { SidebarService } from './services/sidebar.service';
import { NavigationService } from './services/navigation.service';
import { SidebarMenuComponent } from './components/sidebar-menu/sidebar-menu.component';
import { HeaderComponent } from './components/header/header.component';
import { Subject, takeUntil } from 'rxjs';

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
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private navigationService: NavigationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Verificar estado de autenticación
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.isAuthenticated = user !== null;
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
