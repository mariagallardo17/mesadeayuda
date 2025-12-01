import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountdownService, CountdownInfo } from '../../../services/countdown.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-countdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './countdown.component.html',
  styleUrls: ['./countdown.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountdownComponent implements OnInit, OnDestroy, OnChanges {
  @Input() ticketId!: number;
  @Input() creationDate!: Date;
  @Input() targetTime!: string;
  @Input() showLabel: boolean = true;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() ticketStatus: string = '';
  @Input() tiempoAtencionSegundos?: number;

  countdownInfo: CountdownInfo | null = null;
  private subscription: Subscription | null = null;

  constructor(
    private countdownService: CountdownService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeCountdown();
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('🔄 CountdownComponent ngOnChanges:', changes);

    // Si cambió el estado del ticket o el tiempo de atención, reinicializar el countdown
    if (changes['ticketStatus'] || changes['tiempoAtencionSegundos']) {
      console.log('📊 Estado del ticket o tiempo de atención cambió:', {
        previousValue: changes['ticketStatus']?.previousValue,
        currentValue: changes['ticketStatus']?.currentValue,
        tiempoAtencion: changes['tiempoAtencionSegundos']?.currentValue
      });

      // Detener el countdown actual
      if (this.subscription) {
        this.subscription.unsubscribe();
        this.subscription = null;
      }

      // Si el estado es Finalizado o Cerrado, detener también el temporizador compartido del servicio
      if (this.ticketId && (changes['ticketStatus']?.currentValue === 'Finalizado' || changes['ticketStatus']?.currentValue === 'Cerrado')) {
        this.countdownService.stopCountdown(this.ticketId);
      }

      // Reinicializar con el nuevo estado
      this.initializeCountdown();

      // Forzar la detección de cambios
      this.cdr.detectChanges();
    }
  }

  private initializeCountdown(): void {
    console.log('🕐 CountdownComponent initializeCountdown:', {
      ticketId: this.ticketId,
      ticketStatus: this.ticketStatus,
      creationDate: this.creationDate,
      targetTime: this.targetTime
    });

    if (this.ticketId && this.creationDate && this.targetTime) {
      if (this.ticketStatus === 'Finalizado' || this.ticketStatus === 'Cerrado') {
        console.log('🛑 Ticket finalizado/cerrado, mostrando estado final estático');
        // Si ya hubo una suscripción previa, la cancelamos y usamos el último valor emitido si existe
        if (this.subscription) {
          this.subscription.unsubscribe();
          this.subscription = null;
        }

        // Detener el temporizador compartido si estuviera corriendo
        if (this.ticketId) {
          this.countdownService.stopCountdown(this.ticketId);
        }
        // Si ya teníamos un valor mostrado previamente, no recalcular: conservarlo
        if (this.countdownInfo) {
          this.cdr.detectChanges();
          return;
        }
        // Si no hay un valor previo (p. ej., tras recargar), calcular una sola vez estático
        this.showFinalTime();
        return;
      } else {
        console.log('⏰ Ticket activo, iniciando countdown normal');
        this.subscription = this.countdownService.startCountdown(
          this.ticketId,
          this.creationDate,
          this.targetTime
        ).subscribe(info => {
          this.countdownInfo = info;
          // Forzar detección de cambios para OnPush
          this.cdr.markForCheck();
        });
      }
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.ticketId) {
      this.countdownService.stopCountdown(this.ticketId);
    }
  }

  private showFinalTime(): void {
    console.log('🛑 showFinalTime() ejecutándose - Estado final estático');

    let countdownInfo: CountdownInfo;

    // Si tenemos tiempo_atencion_segundos, usarlo para mostrar el tiempo real de atención
    if (this.tiempoAtencionSegundos !== undefined && this.tiempoAtencionSegundos !== null) {
      const tiempoAtencion = this.tiempoAtencionSegundos;
      const targetSeconds = this.parseTimeToSeconds(this.targetTime);

      const hours = Math.floor(tiempoAtencion / 3600);
      const minutes = Math.floor((tiempoAtencion % 3600) / 60);
      const seconds = tiempoAtencion % 60;

      const displayCore = this.formatDaysHours(hours, minutes);

      // Comparar con el tiempo objetivo
      if (tiempoAtencion > targetSeconds) {
        const tiempoExcedido = tiempoAtencion - targetSeconds;
        const horasExcedidas = Math.floor(tiempoExcedido / 3600);
        const minutosExcedidos = Math.floor((tiempoExcedido % 3600) / 60);
        const excedidoDisplay = this.formatDaysHours(horasExcedidas, minutosExcedidos);

        countdownInfo = {
          hours,
          minutes,
          seconds,
          totalSeconds: tiempoAtencion,
          status: 'expired',
          displayText: `VENCIDO (-${excedidoDisplay})`,
          isExpired: true
        };
      } else {
        countdownInfo = {
          hours,
          minutes,
          seconds,
          totalSeconds: tiempoAtencion,
          status: 'normal',
          displayText: `COMPLETADO (${displayCore})`,
          isExpired: false
        };
      }
    } else {
      // Fallback: calcular desde la fecha (para tickets antiguos sin tiempo_atencion_segundos)
      const deadline = new Date(this.creationDate.getTime() + (this.parseTimeToSeconds(this.targetTime) * 1000));
      const now = new Date();
      const timeRemaining = deadline.getTime() - now.getTime();
      const remainingSeconds = Math.floor(timeRemaining / 1000);

      const absSeconds = Math.abs(remainingSeconds);
      const hours = Math.floor(absSeconds / 3600);
      const minutes = Math.floor((absSeconds % 3600) / 60);
      const seconds = absSeconds % 60;

      const displayCore = this.formatDaysHours(hours, minutes);

      if (remainingSeconds < 0) {
        countdownInfo = {
          hours,
          minutes,
          seconds,
          totalSeconds: absSeconds,
          status: 'expired',
          displayText: `VENCIDO (-${displayCore})`,
          isExpired: true
        };
      } else {
        countdownInfo = {
          hours,
          minutes,
          seconds,
          totalSeconds: absSeconds,
          status: 'normal',
          displayText: 'COMPLETADO A TIEMPO',
          isExpired: false
        };
      }
    }

    this.countdownInfo = countdownInfo;
    this.cdr.detectChanges();
  }

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
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseInt(parts[2], 10) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  private formatTime(hours: number, minutes: number, seconds: number): string {
    // Conservado para compatibilidad interna
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatDaysHours(hours: number, minutes: number): string {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    const h = remainingHours.toString().padStart(2, '0');
    const m = minutes.toString().padStart(2, '0');
    if (days > 0) {
      const labelDia = days === 1 ? 'día' : 'días';
      return `${days} ${labelDia} y ${h}:${m} horas`;
    }
    return `${h}:${m} horas`;
  }

  getStatusClass(): string {
    if (!this.countdownInfo) return 'countdown-normal';

    // Si el ticket está finalizado, usar clases especiales
    if (this.ticketStatus === 'Finalizado') {
      if (this.countdownInfo.isExpired) {
        return 'countdown-completed-overdue';
      } else {
        return 'countdown-completed-ontime';
      }
    }

    switch (this.countdownInfo.status) {
      case 'normal':
        return 'countdown-normal';
      case 'warning':
        return 'countdown-warning';
      case 'expired':
        return 'countdown-expired';
      default:
        return 'countdown-normal';
    }
  }

  getSizeClass(): string {
    return `countdown-${this.size}`;
  }
}
