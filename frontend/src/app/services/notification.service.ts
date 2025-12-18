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
    return `${ApiConfig.API_BASE_URL}/notifications`;
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
    // El backend usa el token JWT para obtener el usuario, no necesita ID en la URL
    console.log('📧 [NOTIFICACIONES] Solicitando notificaciones desde:', `${this.apiUrl}`);
    return this.http.get(`${this.apiUrl}`).pipe(
      tap(response => {
        console.log('✅ [NOTIFICACIONES] Respuesta del backend:', response);
        if (Array.isArray(response)) {
          console.log(`📊 [NOTIFICACIONES] Se recibieron ${response.length} notificaciones`);
        } else {
          console.warn('⚠️ [NOTIFICACIONES] Respuesta no es un array:', response);
        }
      }),
      catchError(error => {
        console.error('❌ [NOTIFICACIONES] Error fetching notifications from backend:', error);
        console.error('❌ [NOTIFICACIONES] Error details:', {
          status: error?.status,
          statusText: error?.statusText,
          message: error?.message,
          url: error?.url
        });
        return new Observable(observer => {
          observer.next([]);
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
          // Intentar obtener el ID de diferentes formas posibles
          const userId = parsedUser.id || parsedUser.id_usuario || parsedUser.userId || null;
          if (userId) {
            const userIdNum = typeof userId === 'number' ? userId : parseInt(userId);
            console.log(`✅ [NOTIFICACIONES] ID del usuario actual: ${userIdNum}`);
            return userIdNum;
          }
        } catch (error) {
          console.error('❌ [NOTIFICACIONES] Error parseando usuario del localStorage:', error);
          return null;
        }
      }
    }
    console.warn('⚠️ [NOTIFICACIONES] No se encontró usuario en localStorage');
    return null;
  }

  /**
   * Mezcla notificaciones del backend con las locales
   * IMPORTANTE: Solo usa notificaciones del backend para evitar mostrar notificaciones de otros usuarios
   */
  private mergeBackendNotifications(backendResponse: any): void {
    // El backend devuelve un array directamente, no un objeto con 'notifications'
    console.log('🔄 [NOTIFICACIONES] Procesando respuesta del backend:', backendResponse);
    
    if (!backendResponse || !Array.isArray(backendResponse)) {
      console.warn('⚠️ [NOTIFICACIONES] Respuesta del backend no válida o no es un array:', backendResponse);
      console.warn('⚠️ [NOTIFICACIONES] Tipo de respuesta:', typeof backendResponse);
      return;
    }
    
    if (backendResponse.length === 0) {
      console.log('ℹ️ [NOTIFICACIONES] No hay notificaciones en la respuesta del backend');
    }

    // Obtener el ID del usuario actual para validar
    const currentUserId = this.getCurrentUserId();

    const backendNotifications = backendResponse.map((n: any) => ({
      id: (n.id_notificacion || n.id || '').toString(),
      type: (n.tipo || n.type || 'info') as 'info' | 'success' | 'warning' | 'error',
      title: n.titulo || n.title || this.getTitleFromMessage(n.mensaje || n.message || ''),
      message: n.mensaje || n.message || '',
      timestamp: new Date(n.fecha_envio || n.fecha_creacion || n.timestamp || Date.now()),
      read: (n.leida !== undefined ? n.leida : (n.read || false)) === 1 || (n.read === true),
      actionUrl: n.actionUrl,
      ticketId: (n.id_ticket || n.ticketId) ? (n.id_ticket || n.ticketId).toString() : undefined,
      userId: n.id_usuario || n.userId // Agregar userId para validación
    }));

    // FILTRAR CRÍTICO: Solo mostrar notificaciones que pertenecen al usuario actual
    // Esto es una doble validación de seguridad además del filtrado del backend
    let notificacionesValidas = backendNotifications;
    
    if (currentUserId) {
      const notificacionesInvalidas: any[] = [];
      notificacionesValidas = backendNotifications.filter((notif: any) => {
        const notifUserId = notif.userId ? parseInt(notif.userId) : null;
        
        // Solo incluir notificaciones que pertenecen al usuario actual
        if (notifUserId === currentUserId) {
          return true;
        } else {
          notificacionesInvalidas.push(notif);
          console.warn(`🚫 [NOTIFICACIONES] FILTRADA: Notificación ID ${notif.id} pertenece a usuario ${notifUserId}, pero el usuario actual es ${currentUserId}`);
          return false;
        }
      });
      
      if (notificacionesInvalidas.length > 0) {
        console.error(`❌ [NOTIFICACIONES] ERROR CRÍTICO: Se filtraron ${notificacionesInvalidas.length} notificaciones que no pertenecen al usuario ${currentUserId}`);
        console.error(`❌ [NOTIFICACIONES] Esto indica un problema grave - las notificaciones se están creando o consultando incorrectamente`);
      }
    } else {
      console.warn('⚠️ [NOTIFICACIONES] No se pudo obtener el ID del usuario actual - no se puede validar notificaciones');
    }

    // Ordenar por timestamp (más recientes primero)
    notificacionesValidas.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Actualizar el subject SOLO con notificaciones válidas del usuario actual
    this.notificationsSubject.next(notificacionesValidas.slice(0, 50)); // Mantener solo las últimas 50
    this.updateUnreadCount();
    this.saveNotificationsToStorage();
  }

  /**
   * Extrae el título del mensaje si no viene en la respuesta
   */
  private getTitleFromMessage(message: string): string {
    if (message.includes('ha sido creado exitosamente')) {
      return 'Ticket Creado';
    } else if (message.includes('ha sido asignado')) {
      return 'Ticket Asignado';
    } else if (message.includes('cambió de estado')) {
      return 'Estado Actualizado';
    } else if (message.includes('ha sido cerrado')) {
      return 'Ticket Cerrado';
    } else if (message.includes('ha sido escalado')) {
      return 'Ticket Escalado';
    } else if (message.includes('ha sido reabierto')) {
      return 'Ticket Reabierto';
    }
    return 'Notificación';
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
   * IMPORTANTE: Solo carga notificaciones si no hay notificaciones del backend aún
   */
  private loadNotificationsFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        // NO cargar notificaciones antiguas del localStorage
        // Solo confiar en las notificaciones del backend que ya están filtradas por usuario
        // Limpiar localStorage de notificaciones para evitar mostrar notificaciones de otros usuarios
        localStorage.removeItem('notifications');
        console.log('✅ Limpiado localStorage de notificaciones. Solo se usarán notificaciones del backend.');
      } catch (error) {
        console.error('Error limpiando notificaciones del storage:', error);
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

