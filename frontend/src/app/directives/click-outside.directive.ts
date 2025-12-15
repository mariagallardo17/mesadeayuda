/**
 * Directiva personalizada que detecta cuando se hace clic fuera de un elemento HTML.
 *
 * Esta directiva es útil para cerrar menús desplegables, modales o cualquier componente
 * que deba ocultarse cuando el usuario hace clic fuera de él.
 *
 * Uso:
 * <div (clickOutside)="cerrarMenu()">Contenido del menú</div>
 */

// Importaciones necesarias de Angular
import { Directive, ElementRef, EventEmitter, HostListener, Output } from '@angular/core';

/**
 * Decorador @Directive que define esta clase como una directiva de Angular
 *
 * selector: '[clickOutside]' - Permite usar la directiva como atributo en HTML
 * standalone: true - Indica que es un componente standalone (no necesita módulo)
 */
@Directive({
  selector: '[clickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  /**
   * @Output() - Define un evento que se emite cuando se detecta un clic fuera del elemento
   *
   * clickOutside - Nombre del evento que se puede escuchar en el template HTML
   * EventEmitter<Event> - Emite el evento del clic para que el componente padre pueda manejarlo
   */
  @Output() clickOutside = new EventEmitter<Event>();

  /**
   * Constructor de la directiva
   *
   * @param elementRef - Referencia al elemento HTML donde se aplica la directiva
   *                     Permite acceder al elemento DOM nativo para verificar si contiene el clic
   */
  constructor(private elementRef: ElementRef) {}

  /**
   * @HostListener - Escucha eventos del DOM en el documento completo
   *
   * 'document:click' - Escucha todos los clics que ocurren en cualquier parte del documento
   * ['$event'] - Pasa el evento del clic como parámetro a la función
   *
   * @param event - El evento de clic capturado del documento
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Obtiene el elemento HTML donde se hizo clic
    const target = event.target as HTMLElement;

    // Verifica si el clic fue dentro del elemento donde está aplicada la directiva
    // contains() retorna true si el elemento contiene al target (clic dentro)
    // o false si el clic fue fuera del elemento
    const clickedInside = this.elementRef.nativeElement.contains(target);

    // Si el clic NO fue dentro del elemento (fue fuera), emite el evento
    if (!clickedInside) {
      // Emite el evento clickOutside para que el componente padre pueda reaccionar
      // Por ejemplo, cerrar un menú desplegable o un modal
      this.clickOutside.emit(event);
    }
  }
}










