import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}
  private isCollapsedSubject = new BehaviorSubject<boolean>(false);
  private isMobileSubject = new BehaviorSubject<boolean>(false);
  private menuOpenedSubject = new Subject<void>();

  // Observables públicos
  public isCollapsed$: Observable<boolean> = this.isCollapsedSubject.asObservable();
  public isMobile$: Observable<boolean> = this.isMobileSubject.asObservable();
  public menuOpened$: Observable<void> = this.menuOpenedSubject.asObservable();

  // Getters para obtener el estado actual
  get isCollapsed(): boolean {
    return this.isCollapsedSubject.value;
  }

  get isMobile(): boolean {
    return this.isMobileSubject.value;
  }

  // Métodos para cambiar el estado
  toggleSidebar(): void {
    const newValue = !this.isCollapsedSubject.value;
    this.isCollapsedSubject.next(newValue);

    // Emitir evento cuando se abre el menú (se descolapsa)
    if (!newValue) {
      this.notifyMenuOpened();
    }
  }

  setCollapsed(collapsed: boolean): void {
    this.isCollapsedSubject.next(collapsed);
  }

  setMobile(isMobile: boolean): void {
    this.isMobileSubject.next(isMobile);
  }

  // Método para notificar que el menú se abrió
  private notifyMenuOpened(): void {
    this.menuOpenedSubject.next();
  }

  // Método para verificar el tamaño de pantalla
  checkScreenSize(): void {
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth <= 768;
      this.setMobile(isMobile);

      // En móviles, colapsar automáticamente
      if (isMobile) {
        this.setCollapsed(true);
      }
    }
  }
}
