import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';

export interface CountdownInfo {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  status: 'normal' | 'warning' | 'expired';
  displayText: string;
  isExpired: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CountdownService {
  private countdowns = new Map<number, BehaviorSubject<CountdownInfo>>();
  private subscriptions = new Map<number, Subscription>();

  /**
   * Inicia un countdown para un ticket específico
   * @param ticketId ID del ticket
   * @param creationDate Fecha de creación del ticket
   * @param targetTime Tiempo objetivo en formato HH:MM:SS
   */
  startCountdown(ticketId: number, creationDate: Date, targetTime: string): Observable<CountdownInfo> {
    // Si ya existe un countdown para este ticket, lo detenemos
    this.stopCountdown(ticketId);

    // Parsear el tiempo objetivo
    const targetSeconds = this.parseTimeToSeconds(targetTime);

    // Calcular la fecha límite
    const deadline = new Date(creationDate.getTime() + (targetSeconds * 1000));

    // Crear el BehaviorSubject para este ticket
    const countdownSubject = new BehaviorSubject<CountdownInfo>({
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      status: 'normal',
      displayText: '',
      isExpired: false
    });

    this.countdowns.set(ticketId, countdownSubject);

    // Iniciar el intervalo de actualización (cada segundo)
    const subscription = interval(1000).subscribe(() => {
      const now = new Date();
      const remainingTime = deadline.getTime() - now.getTime();

      if (remainingTime <= 0) {
        // Tiempo expirado
        const expiredInfo: CountdownInfo = {
          hours: 0,
          minutes: 0,
          seconds: 0,
          totalSeconds: 0,
          status: 'expired',
          displayText: 'TIEMPO VENCIDO',
          isExpired: true
        };
        countdownSubject.next(expiredInfo);
        this.stopCountdown(ticketId);
      } else {
        // Calcular tiempo restante
        const totalSeconds = Math.floor(remainingTime / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        // Determinar el estado
        const status = this.getCountdownStatus(totalSeconds, targetSeconds);

        const countdownInfo: CountdownInfo = {
          hours,
          minutes,
          seconds,
          totalSeconds,
          status,
          displayText: this.formatTime(hours, minutes, seconds),
          isExpired: false
        };

        countdownSubject.next(countdownInfo);
      }
    }, undefined, () => {
      // On complete, no hacer nada
    });

    this.subscriptions.set(ticketId, subscription);

    // Emitir el valor inicial
    const now = new Date();
    const remainingTime = deadline.getTime() - now.getTime();
    const totalSeconds = Math.floor(remainingTime / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const status = this.getCountdownStatus(totalSeconds, targetSeconds);

    countdownSubject.next({
      hours,
      minutes,
      seconds,
      totalSeconds,
      status,
      displayText: this.formatTime(hours, minutes, seconds),
      isExpired: totalSeconds <= 0
    });

    return countdownSubject.asObservable();
  }

  /**
   * Detiene el countdown de un ticket específico
   */
  stopCountdown(ticketId: number): void {
    const subscription = this.subscriptions.get(ticketId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(ticketId);
    }
    this.countdowns.delete(ticketId);
  }

  /**
   * Obtiene el countdown actual de un ticket
   */
  getCountdown(ticketId: number): Observable<CountdownInfo> | null {
    const countdown = this.countdowns.get(ticketId);
    return countdown ? countdown.asObservable() : null;
  }

  /**
   * Detiene todos los countdowns
   */
  stopAllCountdowns(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions.clear();
    this.countdowns.clear();
  }

  /**
   * Convierte tiempo en formato HH:MM:SS o "X días" a segundos
   */
  private parseTimeToSeconds(timeString: string): number {
    // Si el tiempo está en formato "X días" o "X día"
    if (timeString.toLowerCase().includes('día') || timeString.toLowerCase().includes('dia')) {
      const daysMatch = timeString.match(/(\d+)\s*(?:día|dias|dia|días)/i);
      if (daysMatch) {
        const days = parseInt(daysMatch[1], 10) || 0;
        return days * 24 * 3600; // Convertir días a segundos
      }
    }

    // Formato HH:MM:SS o HH:MM
    const parts = timeString.split(':');
    if (parts.length < 2) return 0;

    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parts.length > 2 ? (parseInt(parts[2], 10) || 0) : 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Formatea el tiempo para mostrar en cuenta regresiva
   */
  private formatTime(hours: number, minutes: number, seconds: number): string {
    // Si hay días
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      const labelDia = days === 1 ? 'día' : 'días';
      const h = remainingHours.toString().padStart(2, '0');
      const m = minutes.toString().padStart(2, '0');
      const s = seconds.toString().padStart(2, '0');
      return `${days} ${labelDia} ${h}:${m}:${s}`;
    }

    // Si hay horas (pero menos de 24)
    if (hours > 0) {
      const h = hours.toString().padStart(2, '0');
      const m = minutes.toString().padStart(2, '0');
      const s = seconds.toString().padStart(2, '0');
      return `${h}:${m}:${s}`;
    }

    // Si solo hay minutos (menos de 1 hora) - mostrar MM:SS
    if (minutes > 0) {
      const m = minutes.toString().padStart(2, '0');
      const s = seconds.toString().padStart(2, '0');
      return `${m}:${s}`;
    }

    // Si solo hay segundos (menos de 1 minuto)
    const s = seconds.toString().padStart(2, '0');
    return `00:${s}`;
  }

  /**
   * Determina el estado del countdown basado en el tiempo restante
   */
  private getCountdownStatus(remainingSeconds: number, totalSeconds: number): 'normal' | 'warning' | 'expired' {
    if (remainingSeconds <= 0) {
      return 'expired';
    }

    const percentageRemaining = remainingSeconds / totalSeconds;

    if (percentageRemaining <= 0.25) {
      return 'warning';
    }

    return 'normal';
  }

  /**
   * Calcula la fecha límite para un ticket
   */
  calculateDeadline(creationDate: Date, targetTime: string): Date {
    const targetSeconds = this.parseTimeToSeconds(targetTime);
    return new Date(creationDate.getTime() + (targetSeconds * 1000));
  }

  /**
   * Obtiene información de countdown sin iniciar un observable
   */
  getCountdownInfo(creationDate: Date, targetTime: string): CountdownInfo {
    const deadline = this.calculateDeadline(creationDate, targetTime);
    const now = new Date();
    const remainingTime = deadline.getTime() - now.getTime();
    const totalSeconds = Math.floor(remainingTime / 1000);
    const targetSeconds = this.parseTimeToSeconds(targetTime);

    if (totalSeconds <= 0) {
      return {
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        status: 'expired',
        displayText: 'TIEMPO VENCIDO',
        isExpired: true
      };
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const status = this.getCountdownStatus(totalSeconds, targetSeconds);

    return {
      hours,
      minutes,
      seconds,
      totalSeconds,
      status,
      displayText: this.formatTime(hours, minutes, seconds),
      isExpired: false
    };
  }
}








