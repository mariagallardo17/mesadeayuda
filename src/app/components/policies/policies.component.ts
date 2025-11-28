import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './policies.component.html',
  styleUrls: ['./policies.component.css']
})
export class PoliciesComponent {

  policies = [
    {
      id: 1,
      title: 'Solicitud y Registro de Requerimientos',
      description: 'Todos los usuarios deberán registrar sus solicitudes únicamente a través del sistema de Mesa de Servicio. Queda prohibido solicitar soporte mediante llamadas, mensajes o solicitudes verbales, ya que dichas peticiones no generan un ticket y no pueden ser atendidas ni rastreadas dentro del sistema.',
      icon: 'fas fa-portal-enter',
      color: '#007bff',
      category: 'Uso del Sistema'
    },
    {
      id: 2,
      title: 'Responsabilidad del Usuario en el Ciclo del Ticket',
      description: 'El usuario es responsable de proporcionar información clara en su solicitud, revisar el avance de sus tickets y evaluar la calidad del servicio una vez que la atención haya concluido. El cierre de tickets y la evaluación son obligatorios para solicitar nuevos servicios.',
      icon: 'fas fa-user-check',
      color: '#28a745',
      category: 'Responsabilidades'
    },
    {
      id: 3,
      title: 'Manejo y Mantenimiento de Equipos',
      description: 'Ningún usuario podrá mover, modificar, abrir, desconectar o realizar mantenimiento a equipos de cómputo, redes o periféricos sin autorización del área de TI. El incumplimiento puede generar suspensiones temporales del acceso al sistema.',
      icon: 'fas fa-tools',
      color: '#dc3545',
      category: 'Restricciones'
    },
    {
      id: 4,
      title: 'Instalación y Administración de Software',
      description: 'La instalación, actualización, configuración o desinstalación de software será realizada únicamente por el personal de TI autorizado. Los usuarios deberán solicitar estos servicios mediante el sistema y esperar la aprobación correspondiente.',
      icon: 'fas fa-download',
      color: '#ffc107',
      category: 'Restricciones'
    },
    {
      id: 5,
      title: 'Seguimiento y Actualización de Tickets',
      description: 'Los técnicos están obligados a mantener actualizado el estado de cada ticket dentro del sistema. Esto incluye registrar cambios de estado, agregar notas internas cuando sea necesario y actualizar la fecha y hora de las intervenciones para garantizar trazabilidad.',
      icon: 'fas fa-tasks',
      color: '#17a2b8',
      category: 'Procesos'
    },
    {
      id: 6,
      title: 'Escalamiento de Incidencias',
      description: 'Cuando un ticket requiera ser atendido por un técnico de mayor nivel o por un área diferente, el personal de TI deberá realizar el proceso de escalamiento directamente desde el sistema. El técnico asignado debe notificar al usuario mediante el sistema una vez que se complete el cambio.',
      icon: 'fas fa-arrow-up',
      color: '#6f42c1',
      category: 'Procesos'
    },
    {
      id: 7,
      title: 'Respeto a Roles y Niveles de Acceso',
      description: 'Los usuarios deberán utilizar únicamente las funciones correspondientes a su rol (usuario, técnico o administrador). Cualquier intento de acceder a funciones no autorizadas será registrado y reportado al administrador del sistema.',
      icon: 'fas fa-shield-alt',
      color: '#e83e8c',
      category: 'Seguridad'
    },
    {
      id: 8,
      title: 'Cumplimiento de Categorías y Tiempos de Atención (SLA)',
      description: 'El área de TI se compromete a atender los tickets de acuerdo con las categorías y tiempos de respuesta definidos en el sistema. El incumplimiento reiterado deberá ser analizado en los reportes mensuales generados por el administrador.',
      icon: 'fas fa-clock',
      color: '#20c997',
      category: 'Compromisos'
    },
    {
      id: 9,
      title: 'Uso Correcto del Sistema',
      description: 'El sistema debe utilizarse exclusivamente para actividades relacionadas con el servicio técnico y la gestión TI. No está permitido ingresar información falsa, duplicar solicitudes o generar tickets con intenciones ajenas al soporte institucional.',
      icon: 'fas fa-check-circle',
      color: '#fd7e14',
      category: 'Uso del Sistema'
    },
    {
      id: 10,
      title: 'Evaluación Continua del Servicio',
      description: 'Los usuarios deben realizar evaluaciones al finalizar cada servicio. Estas evaluaciones alimentan las métricas de satisfacción del sistema y permiten mejorar la calidad del soporte.',
      icon: 'fas fa-star',
      color: '#ffc107',
      category: 'Calidad'
    }
  ];
}

