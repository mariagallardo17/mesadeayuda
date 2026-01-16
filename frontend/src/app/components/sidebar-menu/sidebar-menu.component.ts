import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ElementRef, ViewChild } from '@angular/core';
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
  @ViewChild('sidebarContainer', { static: false }) sidebarContainer!: ElementRef;
  
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
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
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
        // Cerrar menú en móvil después de navegar (solo si es realmente móvil, no tablet)
        if (this.isMobile && window.innerWidth <= 768) {
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
    // Cerrar menú en móvil después de navegar
    if (this.isMobile && window.innerWidth <= 768) {
      setTimeout(() => {
        this.sidebarService.setCollapsed(true);
      }, 100);
    }
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

  // Listener para cerrar el menú cuando se hace clic fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Solo cerrar si el menú está abierto
    if (!this.isCollapsed) {
      const clickedInside = this.elementRef.nativeElement.contains(event.target);
      const clickedOnFloatingButton = (event.target as HTMLElement).closest('.floating-menu-button');
      const clickedOnMenuToggle = (event.target as HTMLElement).closest('.menu-toggle');
      const clickedOnHeaderToggle = (event.target as HTMLElement).closest('.menu-toggle-button');
      
      // Si el clic fue fuera del menú y no fue en los botones de toggle, cerrar el menú
      if (!clickedInside && !clickedOnFloatingButton && !clickedOnMenuToggle && !clickedOnHeaderToggle) {
        this.sidebarService.setCollapsed(true);
      }
    }
  }
}
