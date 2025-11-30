import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { ApiConfig } from '../config/api.config';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  ticketId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private get apiUrl(): string {
    return `${ApiConfig.API_BASE_URL}/api/notifications`;
  }

  constructor(private http: HttpClient) {
    // Cargar notificaciones existentes del localStorage
    this.loadNotificationsFromStorage();

    // Iniciar polling para obtener notificaciones del backend cada 10 segundos
    this.startPolling();
  }

  /**
   * Inicia el polling para obtener notificaciones del backend
   */
  private startPolling(): void {
    // Cargar inmediatamente al iniciar
    this.fetchNotificationsFromBackend().subscribe({
      next: (notifications) => {
        this.mergeBackendNotifications(notifications);
      },
      error: (error) => {
        console.error('Error fetching notifications from backend:', error);
      }
    });

    // Luego hacer polling cada 5 segundos para sincronización más rápida
    interval(5000) // Cada 5 segundos
      .pipe(
        switchMap(() => this.fetchNotificationsFromBackend()),
        catchError(error => {
          console.error('Error fetching notifications from backend:', error);
          return [];
        })
      )
      .subscribe({
        next: (notifications) => {
          // Mezclar notificaciones del backend con las locales
          this.mergeBackendNotifications(notifications);
        }
      });
  }

  /**
   * Obtiene notificaciones del backend
   */
  private fetchNotificationsFromBackend(): Observable<any> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return new Observable(observer => {
        observer.next({ notifications: [] });
        observer.complete();
      });
    }
    return this.http.get(`${this.apiUrl}/${userId}`).pipe(
      catchError(error => {
        console.error('Error fetching notifications from backend:', error);
        return new Observable(observer => {
          observer.next({ notifications: [] });
          observer.complete();
        });
      })
    );
  }

  /**
   * Obtiene el ID del usuario actual del localStorage
   */
  private getCurrentUserId(): number | null {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const parsedUser = JSON.parse(user);
          return parsedUser.id || null;
        } catch (error) {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Mezcla notificaciones del backend con las locales
   */
  private mergeBackendNotifications(backendResponse: any): void {
    if (!backendResponse || !backendResponse.notifications) {
      return;
    }

    const backendNotifications = backendResponse.notifications.map((n: any) => ({
      id: n.id.toString(),
      type: n.type || 'info',
      title: n.title || 'Notificación',
      message: n.message,
      timestamp: new Date(n.timestamp),
      read: n.read || false,
      actionUrl: n.actionUrl,
      ticketId: n.ticketId ? n.ticketId.toString() : undefined
    }));

    // Obtener notificaciones actuales
    const currentNotifications = this.notificationsSubject.value;

    // Crear un mapa de notificaciones del backend por ID
    const backendNotificationsMap = new Map<string, Notification>();
    backendNotifications.forEach((notif: Notification) => {
      backendNotificationsMap.set(notif.id, notif);
    });

    // Crear un mapa de notificaciones locales por ID
    const localNotificationsMap = new Map<string, Notification>();
    currentNotifications.forEach((notif: Notification) => {
      localNotificationsMap.set(notif.id, notif);
    });

    // Mezclar: priorizar el estado del backend pero mantener notificaciones locales nuevas
    const mergedNotifications: Notification[] = [];
    const processedIds = new Set<string>();
    const processedContent = new Set<string>(); // Para evitar duplicados por contenido

    // Primero agregar todas las notificaciones del backend (tienen prioridad)
    backendNotifications.forEach((backendNotif: Notification) => {
      mergedNotifications.push(backendNotif);
      processedIds.add(backendNotif.id);
      // Crear clave única por contenido para evitar duplicados
      const contentKey = `${backendNotif.title}_${backendNotif.message}_${backendNotif.ticketId || ''}`;
      processedContent.add(contentKey);
    });

    // Luego agregar notificaciones locales que no están en el backend ni duplicadas por contenido
    currentNotifications.forEach((localNotif: Notification) => {
      if (!processedIds.has(localNotif.id)) {
        // Verificar si el contenido ya existe (evitar duplicados)
        const contentKey = `${localNotif.title}_${localNotif.message}_${localNotif.ticketId || ''}`;
        if (!processedContent.has(contentKey)) {
          mergedNotifications.push(localNotif);
          processedContent.add(contentKey);
        }
      }
    });

    // Ordenar por timestamp (más recientes primero)
    mergedNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Actualizar el subject
    this.notificationsSubject.next(mergedNotifications.slice(0, 50)); // Mantener solo las últimas 50
    this.updateUnreadCount();
    this.saveNotificationsToStorage();
  }

  /**
   * Agrega una nueva notificación
   */
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = [newNotification, ...currentNotifications].slice(0, 50); // Mantener solo las últimas 50

    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount();
    this.saveNotificationsToStorage();
  }

  /**
   * Marca una notificación como leída
   */
  markAsRead(notificationId: string): void {
    // Actualizar localmente primero
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.map(notification =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification
    );

    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount();
    this.saveNotificationsToStorage();

    // Sincronizar con el backend
    this.http.put(`${this.apiUrl}/${notificationId}/read`, {})
      .pipe(
        catchError(error => {
          console.error('Error marcando notificación como leída en el backend:', error);
          return [];
        })
      )
      .subscribe({
        next: () => {
          console.log('✅ Notificación marcada como leída en el backend:', notificationId);
        }
      });
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  markAllAsRead(): void {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.map(notification =>
      ({ ...notification, read: true })
    );

    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount();
    this.saveNotificationsToStorage();

    // Sincronizar cada notificación con el backend
    currentNotifications.forEach(notification => {
      if (!notification.read) {
        this.http.put(`${this.apiUrl}/${notification.id}/read`, {})
          .pipe(
            catchError(error => {
              console.error(`Error marcando notificación ${notification.id} como leída:`, error);
              return [];
            })
          )
          .subscribe();
      }
    });
  }

  /**
   * Elimina una notificación
   */
  removeNotification(notificationId: string): void {
    // Eliminar localmente primero
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.filter(
      notification => notification.id !== notificationId
    );

    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount();
    this.saveNotificationsToStorage();

    // Sincronizar con el backend
    this.http.delete(`${this.apiUrl}/${notificationId}`)
      .pipe(
        catchError(error => {
          console.error('Error eliminando notificación en el backend:', error);
          return [];
        })
      )
      .subscribe({
        next: () => {
          console.log('✅ Notificación eliminada en el backend:', notificationId);
        }
      });
  }

  /**
   * Elimina todas las notificaciones
   */
  clearAllNotifications(): void {
    this.notificationsSubject.next([]);
    this.updateUnreadCount();
    this.saveNotificationsToStorage();
  }

  /**
   * Obtiene las notificaciones actuales
   */
  getNotifications(): Notification[] {
    return this.notificationsSubject.value;
  }

  /**
   * Obtiene el conteo de notificaciones no leídas
   */
  getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * Notificaciones específicas para tickets
   */
  addTicketNotification(ticketId: string, type: 'assigned' | 'status_changed' | 'completed' | 'comment_added', data?: any): void {
    let title = '';
    let message = '';

    switch (type) {
      case 'assigned':
        title = 'Ticket Asignado';
        message = `Se te ha asignado el ticket #${ticketId}`;
        break;
      case 'status_changed':
        title = 'Estado Actualizado';
        message = `El ticket #${ticketId} cambió de estado a "${data?.newStatus || 'Nuevo estado'}"`;
        break;
      case 'completed':
        title = 'Ticket Completado';
        message = `El ticket #${ticketId} ha sido completado`;
        break;
      case 'comment_added':
        title = 'Nuevo Comentario';
        message = `Se agregó un comentario al ticket #${ticketId}`;
        break;
    }

    this.addNotification({
      type: 'info',
      title,
      message,
      ticketId,
      actionUrl: `/tickets/tracking?ticketId=${ticketId}`
    });
  }

  /**
   * Actualiza el conteo de notificaciones no leídas
   */
  private updateUnreadCount(): void {
    const unreadCount = this.notificationsSubject.value.filter(n => !n.read).length;
    this.unreadCountSubject.next(unreadCount);
  }

  /**
   * Genera un ID único para las notificaciones
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Guarda las notificaciones en localStorage
   */
  private saveNotificationsToStorage(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('notifications', JSON.stringify(this.notificationsSubject.value));
    }
  }

  /**
   * Carga las notificaciones desde localStorage
   */
  private loadNotificationsFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('notifications');
        if (stored) {
          const notifications = JSON.parse(stored).map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp)
          }));
          this.notificationsSubject.next(notifications);
          this.updateUnreadCount();
        }
      } catch (error) {
        console.error('Error loading notifications from storage:', error);
      }
    }
  }

  /**
   * Fuerza la recarga de notificaciones desde localStorage
   */
  forceReload(): void {
    console.log('🔄 Forzando recarga de notificaciones...');
    this.loadNotificationsFromStorage();
  }

  /**
   * Agrega notificación de cambio de estado (para uso manual)
   */
}

