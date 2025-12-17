import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { User } from '../../models/user.model';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-sidebar-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar-menu.component.html',
  styleUrls: ['./sidebar-menu.component.css']
})
export class SidebarMenuComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  currentRoute: string = '';
  isCollapsed: boolean = false;
  isMobile: boolean = false;
  ticketStats = {
    abiertos: 2,
    enProceso: 1
  };

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Suscribirse a cambios del usuario actual
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        console.log('🔍 Sidebar - Usuario actualizado:', user);
        this.currentUser = user;
        // Si no hay usuario en el observable, intentar obtenerlo directamente
        if (!this.currentUser) {
          this.currentUser = this.authService.getCurrentUser();
          console.log('🔍 Sidebar - Usuario obtenido directamente:', this.currentUser);
        }
        console.log('🔍 Sidebar - isAdmin:', this.isAdmin, 'isTecnico:', this.isTecnico, 'isEmpleado:', this.isEmpleado);
        this.cdr.detectChanges(); // Forzar detección de cambios
      });
    
    // Verificar usuario al iniciar
    const initialUser = this.authService.getCurrentUser();
    if (initialUser) {
      this.currentUser = initialUser;
      console.log('🔍 Sidebar - Usuario inicial:', initialUser);
    }

    // Suscribirse al estado del sidebar desde el servicio
    this.sidebarService.isCollapsed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isCollapsed => {
        this.isCollapsed = isCollapsed;
      });

    this.sidebarService.isMobile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isMobile => {
        this.isMobile = isMobile;
      });

    // Suscribirse a cambios de ruta
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.currentRoute = event.url;
        // Cerrar menú en móvil después de navegar
        if (this.isMobile) {
          this.sidebarService.setCollapsed(true);
        }
      });

    // Establecer la ruta actual
    this.currentRoute = this.router.url;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMenu(): void {
    this.sidebarService.toggleSidebar();
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  get isAdmin(): boolean {
    const result = this.authService.isAdmin();
    console.log('🔍 Sidebar isAdmin check:', { 
      result, 
      currentUser: this.currentUser, 
      userRol: this.currentUser?.rol 
    });
    return result;
  }

  get isTecnico(): boolean {
    return this.authService.isTecnico();
  }

  get isEmpleado(): boolean {
    return this.authService.isEmpleado();
  }

  // Getter para obtener la ruta actual de forma dinámica
  get currentRoutePath(): string {
    return this.router.url;
  }
}
