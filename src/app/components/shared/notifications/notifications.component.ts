import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService, Notification } from '../../../services/notification.service';
import { ClickOutsideDirective } from '../../../directives/click-outside.directive';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, ClickOutsideDirective],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  unreadCount: number = 0;
  showDropdown: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Suscribirse a las notificaciones
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.notifications = notifications;
        this.cdr.detectChanges();
      });

    // Suscribirse al conteo de no leídas
    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.unreadCount = count;
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  closeDropdown(): void {
    this.showDropdown = false;
  }

  markAsRead(notification: Notification): void {
    this.notificationService.markAsRead(notification.id);

    // Si la notificación tiene una URL de acción, navegar
    if (notification.actionUrl) {
      this.router.navigateByUrl(notification.actionUrl);
      this.closeDropdown();
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  removeNotification(notificationId: string): void {
    this.notificationService.removeNotification(notificationId);
  }

  clearAllNotifications(): void {
    this.notificationService.clearAllNotifications();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  }

  formatTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  }

  onNotificationClick(notification: Notification): void {
    this.markAsRead(notification);
  }

  onOutsideClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notifications-container')) {
      this.closeDropdown();
    }
  }

  trackByNotificationId(index: number, notification: Notification): string {
    return notification.id;
  }

  /**
   * Método de prueba para simular cambio de estado
   */
}
