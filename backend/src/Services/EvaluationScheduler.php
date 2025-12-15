<?php

namespace App\Services;

use App\Config\Database;
use App\Services\EmailService;

/**
 * Scheduler para manejar recordatorios y cierre automático de tickets sin evaluación
 */
class EvaluationScheduler
{
    private $db;
    private $emailService;
    
    // Configuración por defecto (puede sobrescribirse con variables de entorno)
    private $reminderDays = 1; // Días para primer recordatorio
    private $autoCloseDays = 2; // Días para cierre automático
    private $checkIntervalMinutes = 60; // Intervalo de verificación en minutos
    
    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->emailService = new EmailService();
        
        // Cargar configuración desde variables de entorno
        $this->reminderDays = (int)($_ENV['EVALUATION_REMINDER_DAYS'] ?? 1);
        $this->autoCloseDays = (int)($_ENV['EVALUATION_AUTO_CLOSE_DAYS'] ?? 2);
        $this->checkIntervalMinutes = (int)($_ENV['EVALUATION_CHECK_INTERVAL_MINUTES'] ?? 60);
    }
    
    /**
     * Obtiene tickets que necesitan recordatorio o cierre automático
     */
    public function getTicketsPendingEvaluation()
    {
        try {
            // Tickets que necesitan recordatorio: finalizados hace X días pero menos de Y días
            $stmtReminder = $this->db->query(
                'SELECT
                    t.id_ticket,
                    t.descripcion,
                    t.estatus,
                    COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS fecha_finalizacion,
                    t.evaluacion_ultimo_recordatorio,
                    t.evaluacion_recordatorio_contador,
                    u.id_usuario,
                    u.nombre AS usuario_nombre,
                    u.correo AS usuario_correo
                 FROM tickets t
                 JOIN usuarios u ON t.id_usuario = u.id_usuario
                 LEFT JOIN evaluaciones e ON e.id_ticket = t.id_ticket
                 WHERE t.estatus = "Finalizado"
                   AND e.id_evaluacion IS NULL
                   AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
                   AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) <= DATE_SUB(NOW(), INTERVAL ? DAY)
                   AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) > DATE_SUB(NOW(), INTERVAL ? DAY)
                   AND (t.evaluacion_ultimo_recordatorio IS NULL OR DATE(t.evaluacion_ultimo_recordatorio) < DATE(NOW()))',
                [$this->reminderDays, $this->autoCloseDays]
            );
            $reminderTickets = $stmtReminder->fetchAll();
            
            // Tickets que deben cerrarse automáticamente: finalizados hace X+ días sin evaluación
            $stmtAutoClose = $this->db->query(
                'SELECT
                    t.id_ticket,
                    t.descripcion,
                    t.estatus,
                    COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS fecha_finalizacion,
                    u.id_usuario,
                    u.nombre AS usuario_nombre,
                    u.correo AS usuario_correo,
                    tec.nombre AS tecnico_nombre,
                    tec.correo AS tecnico_correo
                 FROM tickets t
                 JOIN usuarios u ON t.id_usuario = u.id_usuario
                 LEFT JOIN usuarios tec ON t.id_tecnico = tec.id_usuario
                 LEFT JOIN evaluaciones e ON e.id_ticket = t.id_ticket
                 WHERE t.estatus = "Finalizado"
                   AND e.id_evaluacion IS NULL
                   AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
                   AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) <= DATE_SUB(NOW(), INTERVAL ? DAY)',
                [$this->autoCloseDays]
            );
            $autoCloseTickets = $stmtAutoClose->fetchAll();
            
            // TODOS los tickets pendientes de evaluación (para correos diarios)
            $stmtAllPending = $this->db->query(
                'SELECT
                    t.id_ticket,
                    t.descripcion,
                    t.estatus,
                    COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS fecha_finalizacion,
                    u.id_usuario,
                    u.nombre AS usuario_nombre,
                    u.correo AS usuario_correo
                 FROM tickets t
                 JOIN usuarios u ON t.id_usuario = u.id_usuario
                 LEFT JOIN evaluaciones e ON e.id_ticket = t.id_ticket
                 WHERE (t.estatus = "Finalizado" OR (t.estatus = "Cerrado" AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
                   AND e.id_evaluacion IS NULL
                   AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
                   AND (t.evaluacion_ultimo_recordatorio_diario IS NULL OR DATE(t.evaluacion_ultimo_recordatorio_diario) < DATE(NOW()))'
            );
            $allPendingTickets = $stmtAllPending->fetchAll();
            
            return [
                'reminderTickets' => $reminderTickets,
                'autoCloseTickets' => $autoCloseTickets,
                'allPendingTickets' => $allPendingTickets
            ];
        } catch (\Exception $e) {
            error_log('Error obteniendo tickets pendientes de evaluación: ' . $e->getMessage());
            return [
                'reminderTickets' => [],
                'autoCloseTickets' => [],
                'allPendingTickets' => []
            ];
        }
    }
    
    /**
     * Envía recordatorio de evaluación a un usuario
     */
    public function sendReminderEmail($ticket)
    {
        try {
            // Actualizar contador de recordatorios
            $this->db->query(
                'UPDATE tickets SET 
                    evaluacion_ultimo_recordatorio = NOW(),
                    evaluacion_recordatorio_contador = COALESCE(evaluacion_recordatorio_contador, 0) + 1
                 WHERE id_ticket = ?',
                [$ticket['id_ticket']]
            );
            
            // Enviar correo de recordatorio
            $this->emailService->sendEvaluationReminderEmail($ticket);
            
            error_log("📧 Recordatorio de evaluación enviado para ticket #{$ticket['id_ticket']} a {$ticket['usuario_correo']}");
            return true;
        } catch (\Exception $e) {
            error_log("❌ Error enviando recordatorio para ticket #{$ticket['id_ticket']}: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Cierra automáticamente un ticket sin evaluación
     */
    public function closeTicketAutomatically($ticket)
    {
        try {
            // Cerrar el ticket automáticamente
            $this->db->query(
                'UPDATE tickets SET
                    estatus = "Cerrado",
                    fecha_cierre = COALESCE(fecha_cierre, NOW()),
                    evaluacion_cierre_automatico = 1,
                    evaluacion_ultimo_recordatorio = NOW()
                 WHERE id_ticket = ?',
                [$ticket['id_ticket']]
            );
            
            // Enviar correo de cierre automático
            $this->emailService->sendEvaluationAutoClosedEmail($ticket);
            
            error_log("✅ Ticket #{$ticket['id_ticket']} cerrado automáticamente por evaluación tardía");
            return true;
        } catch (\Exception $e) {
            error_log("❌ Error cerrando automáticamente ticket #{$ticket['id_ticket']}: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Envía correos diarios con todos los tickets pendientes de evaluación agrupados por usuario
     */
    public function sendDailyReminders($allPendingTickets)
    {
        // Agrupar tickets por usuario
        $ticketsByUser = [];
        foreach ($allPendingTickets as $ticket) {
            $userId = $ticket['id_usuario'];
            if (!isset($ticketsByUser[$userId])) {
                $ticketsByUser[$userId] = [
                    'usuario' => [
                        'id' => $ticket['id_usuario'],
                        'nombre' => $ticket['usuario_nombre'],
                        'correo' => $ticket['usuario_correo']
                    ],
                    'tickets' => []
                ];
            }
            $ticketsByUser[$userId]['tickets'][] = $ticket;
        }
        
        // Enviar correo a cada usuario con sus tickets pendientes
        foreach ($ticketsByUser as $usuarioData) {
            try {
                // Actualizar fecha de último recordatorio diario para todos los tickets del usuario
                $ticketIds = array_column($usuarioData['tickets'], 'id_ticket');
                if (!empty($ticketIds)) {
                    $placeholders = implode(',', array_fill(0, count($ticketIds), '?'));
                    $this->db->query(
                        "UPDATE tickets SET evaluacion_ultimo_recordatorio_diario = NOW() WHERE id_ticket IN ($placeholders)",
                        $ticketIds
                    );
                }
                
                // Enviar correo diario
                $this->emailService->sendDailyEvaluationReminderEmail($usuarioData['usuario'], $usuarioData['tickets']);
                
                error_log("📧 Correo diario de recordatorios enviado a {$usuarioData['usuario']['correo']} ({$usuarioData['usuario']['nombre']}) - " . count($usuarioData['tickets']) . " tickets pendientes");
            } catch (\Exception $e) {
                error_log("❌ Error enviando correo diario a {$usuarioData['usuario']['correo']}: " . $e->getMessage());
            }
        }
    }
    
    /**
     * Procesa todos los recordatorios y cierres automáticos
     */
    public function processEvaluationReminders()
    {
        try {
            error_log("🔄 Iniciando procesamiento de recordatorios de evaluación...");
            
            $tickets = $this->getTicketsPendingEvaluation();
            
            // Enviar correos diarios a todos los usuarios con tickets pendientes
            if (!empty($tickets['allPendingTickets'])) {
                $this->sendDailyReminders($tickets['allPendingTickets']);
            }
            
            // Enviar recordatorios específicos
            foreach ($tickets['reminderTickets'] as $ticket) {
                $this->sendReminderEmail($ticket);
            }
            
            // Cerrar tickets automáticamente
            foreach ($tickets['autoCloseTickets'] as $ticket) {
                $this->closeTicketAutomatically($ticket);
            }
            
            $totalProcessed = count($tickets['reminderTickets']) + count($tickets['autoCloseTickets']) + count($tickets['allPendingTickets']);
            error_log("✅ Procesamiento completado: $totalProcessed tickets procesados");
            
            return [
                'success' => true,
                'remindersSent' => count($tickets['reminderTickets']),
                'autoClosed' => count($tickets['autoCloseTickets']),
                'dailyRemindersSent' => count($tickets['allPendingTickets'])
            ];
        } catch (\Exception $e) {
            error_log('❌ Error en el scheduler de recordatorios de evaluación: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}

