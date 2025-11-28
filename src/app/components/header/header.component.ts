import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subject, takeUntil, filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { User } from '../../models/user.model';
import { NotificationsComponent } from '../shared/notifications/notifications.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, NotificationsComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  showUserMenu = false;
  isSidebarCollapsed = false;
  currentSection = '';
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Suscribirse a cambios en el usuario actual
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });

    // Suscribirse al estado del sidebar
    this.sidebarService.isCollapsed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isCollapsed => {
        this.isSidebarCollapsed = isCollapsed;
      });

    // Detectar cambios de ruta para mostrar la sección actual
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateCurrentSection(event.url);
      });

    // Establecer la sección inicial
    this.updateCurrentSection(this.router.url);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  toggleSidebar(): void {
    this.sidebarService.toggleSidebar();
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
    this.closeUserMenu();
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'administrador':
        return 'ADMINISTRADOR';
      case 'tecnico':
        return 'TÉCNICO';
      case 'empleado':
        return 'EMPLEADO';
      default:
        return role.toUpperCase();
    }
  }

  getUserInitials(): string {
    if (!this.currentUser) return '';

    const firstName = this.currentUser.nombre.split(' ')[0] || '';
    const lastName = this.currentUser.apellido || this.currentUser.nombre.split(' ')[1] || '';

    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  getFullName(): string {
    if (!this.currentUser) return '';

    // Si el usuario tiene apellido separado, usarlo
    if (this.currentUser.apellido && this.currentUser.apellido.trim() !== '') {
      return `${this.currentUser.nombre} ${this.currentUser.apellido}`;
    }

    // Si no tiene apellido separado, solo mostrar el nombre
    return this.currentUser.nombre;
  }

  private updateCurrentSection(url: string): void {
    if (url.includes('/reports')) {
      this.currentSection = 'Reportes';
    } else if (url.includes('/profile')) {
      this.currentSection = 'Perfil';
    } else if (url.includes('/tickets/new')) {
      this.currentSection = 'Nuevo Ticket';
    } else if (url.includes('/tickets/my-tickets')) {
      this.currentSection = 'Mis Tickets';
    } else if (url.includes('/tickets/assigned')) {
      this.currentSection = 'Tickets Asignados';
    } else if (url.includes('/tickets/all')) {
      this.currentSection = 'Todos los Tickets';
    } else if (url.includes('/tickets/reopened')) {
      this.currentSection = 'Tickets Reabiertos';
    } else if (url.includes('/tickets/tracking')) {
      this.currentSection = 'Seguimiento de Tickets';
    } else if (url.includes('/tickets/summary')) {
      this.currentSection = 'Resumen de Tickets';
    } else if (url.includes('/tickets/close')) {
      this.currentSection = 'Cerrar Ticket';
    } else if (url.includes('/tickets/escalated')) {
      this.currentSection = 'Tickets Escalados';
    } else if (url.includes('/services/catalog')) {
      this.currentSection = 'Catálogo de Servicios';
    } else if (url.includes('/services/manage')) {
      this.currentSection = 'Gestión de Servicios';
    } else if (url.includes('/users')) {
      this.currentSection = 'Gestión de Usuarios';
    } else if (url.includes('/policies')) {
      this.currentSection = 'Políticas';
    } else {
      this.currentSection = 'Dashboard';
    }
  }
}
