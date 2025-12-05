<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class TicketRoutes
{
    private $router;
    private $db;
    
    const MIN_DESCRIPTION_LENGTH = 10;
    
    public function __construct($router)
    {
        $this->router = $router;
        $this->db = Database::getInstance();
        $this->registerRoutes();
    }
    
    private function registerRoutes()
    {
        $this->router->addRoute('GET', '/tickets/my-tickets', [$this, 'getMyTickets']);
        $this->router->addRoute('GET', '/tickets/check-pending-evaluation', [$this, 'checkPendingEvaluation']);
        $this->router->addRoute('GET', '/tickets/reopened', [$this, 'getReopenedTickets']);
        $this->router->addRoute('GET', '/tickets/escalados', [$this, 'getEscaladosTickets']);
        $this->router->addRoute('GET', '/tickets/technicians', [$this, 'getTechnicians']);
        $this->router->addRoute('GET', '/tickets/:id/evaluation', [$this, 'getEvaluation']);
        $this->router->addRoute('GET', '/tickets/:ticketId/approval-letter', [$this, 'getApprovalLetter']);
        $this->router->addRoute('GET', '/tickets/download/:filename', [$this, 'downloadFile']);
        $this->router->addRoute('GET', '/tickets/:id', [$this, 'getTicketById']);
        $this->router->addRoute('POST', '/tickets', [$this, 'createTicket']);
        $this->router->addRoute('POST', '/tickets/:id/escalate', [$this, 'escalateTicket']);
        $this->router->addRoute('PUT', '/tickets/:id/status', [$this, 'updateTicketStatus']);
        $this->router->addRoute('PUT', '/tickets/:id/reopen/technician-comment', [$this, 'addTechnicianReopenComment']);
        $this->router->addRoute('POST', '/tickets/:id/close', [$this, 'closeTicket']);
        $this->router->addRoute('POST', '/tickets/:id/evaluate', [$this, 'evaluateTicket']);
    }
    
    public function getMyTickets()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            if ($user['rol'] === 'tecnico' || $user['rol'] === 'administrador') {
                $stmt = $this->db->query(
                    'SELECT t.id_ticket as id, s.categoria, s.subcategoria, t.descripcion, 
                            s.tiempo_objetivo as tiempo_estimado, t.estatus as estado, t.prioridad,
                            t.fecha_creacion, t.fecha_cierre, u.nombre as usuario_nombre
                     FROM Tickets t
                     JOIN Servicios s ON t.id_servicio = s.id_servicio
                     JOIN Usuarios u ON t.id_usuario = u.id_usuario
                     WHERE t.id_tecnico = ? AND t.estatus != "Escalado"
                     ORDER BY t.fecha_creacion DESC',
                    [$user['id_usuario']]
                );
            } else {
                $stmt = $this->db->query(
                    'SELECT t.id_ticket as id, s.categoria, s.subcategoria, t.descripcion, 
                            s.tiempo_objetivo as tiempo_estimado, t.estatus as estado, t.prioridad,
                            t.fecha_creacion, t.fecha_cierre, u.nombre as tecnico_nombre
                     FROM Tickets t
                     JOIN Servicios s ON t.id_servicio = s.id_servicio
                     LEFT JOIN Usuarios u ON t.id_tecnico = u.id_usuario
                     WHERE t.id_usuario = ?
                     ORDER BY t.fecha_creacion DESC',
                    [$user['id_usuario']]
                );
            }
            
            $tickets = $stmt->fetchAll();
            AuthMiddleware::sendResponse($tickets);
        } catch (\Exception $e) {
            error_log('Error getting tickets: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function checkPendingEvaluation()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            $stmt = $this->db->query(
                'SELECT COUNT(*) as count FROM Tickets t
                 LEFT JOIN Evaluaciones e ON e.id_ticket = t.id_ticket
                 WHERE t.id_usuario = ? AND e.id_evaluacion IS NULL
                   AND (t.estatus = "Finalizado" OR (t.estatus = "Cerrado" AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
                   AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL',
                [$user['id_usuario']]
            );
            
            $result = $stmt->fetch();
            $hasPending = $result['count'] > 0;
            
            AuthMiddleware::sendResponse(['hasPending' => $hasPending]);
        } catch (\Exception $e) {
            error_log('Error checking pending evaluations: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function getTicketById($id)
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            $stmt = $this->db->query(
                'SELECT t.id_ticket as id, s.categoria, s.subcategoria, t.descripcion,
                        s.tiempo_objetivo as tiempoEstimado, t.estatus as estado, t.prioridad,
                        t.fecha_creacion, t.fecha_cierre, u.nombre as usuario_nombre
                 FROM Tickets t
                 JOIN Servicios s ON t.id_servicio = s.id_servicio
                 JOIN Usuarios u ON t.id_usuario = u.id_usuario
                 WHERE t.id_ticket = ? AND (t.id_usuario = ? OR t.id_tecnico = ?)',
                [$id, $user['id_usuario'], $user['id_usuario']]
            );
            
            $ticket = $stmt->fetch();
            
            if (!$ticket) {
                AuthMiddleware::sendError('Ticket no encontrado', 404);
            }
            
            AuthMiddleware::sendResponse($ticket);
        } catch (\Exception $e) {
            error_log('Error getting ticket: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function createTicket()
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $categoria = trim($body['categoria'] ?? '');
        $subcategoria = trim($body['subcategoria'] ?? '');
        $descripcion = trim($body['descripcion'] ?? '');
        
        if (empty($categoria) || empty($subcategoria) || empty($descripcion)) {
            AuthMiddleware::sendError('Todos los campos obligatorios deben ser completados', 400);
        }
        
        if (strlen($descripcion) < self::MIN_DESCRIPTION_LENGTH) {
            AuthMiddleware::sendError('La descripción debe tener al menos ' . self::MIN_DESCRIPTION_LENGTH . ' caracteres', 400);
        }
        
        try {
            // Get service
            $stmt = $this->db->query(
                'SELECT id_servicio, tiempo_objetivo, prioridad FROM Servicios 
                 WHERE categoria = ? AND subcategoria = ? AND estatus = "Activo"',
                [$categoria, $subcategoria]
            );
            
            $servicio = $stmt->fetch();
            
            if (!$servicio) {
                AuthMiddleware::sendError('Servicio no encontrado', 404);
            }
            
            $prioridad = $servicio['prioridad'] ?? 'Media';
            
            // Create ticket
            $this->db->query(
                'INSERT INTO Tickets (id_usuario, id_servicio, descripcion, prioridad, estatus, fecha_creacion)
                 VALUES (?, ?, ?, ?, "Pendiente", NOW())',
                [$user['id_usuario'], $servicio['id_servicio'], $descripcion, $prioridad]
            );
            
            $ticketId = $this->db->getConnection()->lastInsertId();
            
            AuthMiddleware::sendResponse([
                'message' => 'Ticket creado exitosamente',
                'ticket' => [
                    'id' => $ticketId,
                    'categoria' => $categoria,
                    'subcategoria' => $subcategoria,
                    'descripcion' => $descripcion,
                    'prioridad' => $prioridad,
                    'estado' => 'Pendiente'
                ]
            ], 201);
        } catch (\Exception $e) {
            error_log('Error creating ticket: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function updateTicketStatus($id)
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $estatus = $body['estatus'] ?? $body['nuevoEstado'] ?? '';
        
        if (empty($estatus)) {
            AuthMiddleware::sendError('Estado es requerido', 400);
        }
        
        try {
            $this->db->query(
                'UPDATE Tickets SET estatus = ? WHERE id_ticket = ?',
                [$estatus, $id]
            );
            
            AuthMiddleware::sendResponse(['message' => 'Estado actualizado exitosamente']);
        } catch (\Exception $e) {
            error_log('Error updating ticket status: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function closeTicket($id)
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $rating = $body['rating'] ?? 0;
        $comentarios = $body['comentarios'] ?? '';
        
        if ($rating < 1 || $rating > 5) {
            AuthMiddleware::sendError('La calificación debe ser entre 1 y 5 estrellas', 400);
        }
        
        try {
            // Close ticket
            $this->db->query(
                'UPDATE Tickets SET estatus = "Cerrado", fecha_cierre = NOW() WHERE id_ticket = ? AND id_usuario = ?',
                [$id, $user['id_usuario']]
            );
            
            // Create evaluation
            $this->db->query(
                'INSERT INTO Evaluaciones (id_ticket, calificacion, comentario, fecha_evaluacion) VALUES (?, ?, ?, NOW())',
                [$id, $rating, $comentarios]
            );
            
            AuthMiddleware::sendResponse(['message' => 'Ticket cerrado exitosamente']);
        } catch (\Exception $e) {
            error_log('Error closing ticket: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function evaluateTicket($id)
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $calificacion = $body['calificacion'] ?? 0;
        $comentario = $body['comentario'] ?? '';
        
        if ($calificacion < 1 || $calificacion > 5) {
            AuthMiddleware::sendError('La calificación debe ser entre 1 y 5', 400);
        }
        
        try {
            $this->db->query(
                'INSERT INTO Evaluaciones (id_ticket, calificacion, comentario, fecha_evaluacion) VALUES (?, ?, ?, NOW())',
                [$id, $calificacion, $comentario]
            );
            
            AuthMiddleware::sendResponse(['message' => 'Evaluación registrada exitosamente']);
        } catch (\Exception $e) {
            error_log('Error evaluating ticket: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    /**
     * GET /tickets/reopened
     * Get reopened tickets
     */
    public function getReopenedTickets()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            // Different query based on user role
            if ($user['rol'] === 'empleado') {
                $stmt = $this->db->query(
                    'SELECT t.id_ticket as id, s.categoria, s.subcategoria, t.descripcion,
                            s.tiempo_objetivo as tiempo_estimado, t.estatus as estado, t.prioridad,
                            t.fecha_creacion, t.fecha_cierre, tr.observaciones_usuario, 
                            tr.causa_tecnico, tr.fecha_reapertura
                     FROM Tickets t
                     JOIN Servicios s ON t.id_servicio = s.id_servicio
                     JOIN TicketReaperturas tr ON t.id_ticket = tr.id_ticket
                     WHERE t.id_usuario = ?
                     ORDER BY tr.fecha_reapertura DESC',
                    [$user['id_usuario']]
                );
            } else if ($user['rol'] === 'tecnico' || $user['rol'] === 'administrador') {
                $stmt = $this->db->query(
                    'SELECT t.id_ticket as id, s.categoria, s.subcategoria, t.descripcion,
                            s.tiempo_objetivo as tiempo_estimado, t.estatus as estado, t.prioridad,
                            t.fecha_creacion, t.fecha_cierre, tr.observaciones_usuario, 
                            tr.causa_tecnico, tr.fecha_reapertura
                     FROM Tickets t
                     JOIN Servicios s ON t.id_servicio = s.id_servicio
                     JOIN TicketReaperturas tr ON t.id_ticket = tr.id_ticket
                     WHERE t.id_tecnico = ? OR tr.tecnico_id = ?
                     ORDER BY tr.fecha_reapertura DESC',
                    [$user['id_usuario'], $user['id_usuario']]
                );
            } else {
                AuthMiddleware::sendError('Rol de usuario no autorizado', 403);
            }
            
            $tickets = $stmt->fetchAll();
            AuthMiddleware::sendResponse($tickets);
            
        } catch (\Exception $e) {
            error_log('Error getting reopened tickets: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    /**
     * GET /tickets/escalados
     * Get escalated tickets
     */
    public function getEscaladosTickets()
    {
        $user = AuthMiddleware::authenticate();
        
        // Check permissions
        if ($user['rol'] !== 'tecnico' && $user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('Solo los técnicos y administradores pueden ver tickets escalados', 403);
        }
        
        try {
            $stmt = $this->db->query(
                'SELECT t.id_ticket as id, t.descripcion, t.prioridad, t.fecha_creacion,
                        t.estatus, s.categoria, s.subcategoria, s.tiempo_objetivo,
                        u.nombre as usuario_nombre, tec.nombre as tecnico_nombre,
                        tec_orig.nombre as tecnico_original_nombre,
                        e.motivo_escalamiento, e.fecha_escalamiento, e.nivel_escalamiento
                 FROM Tickets t
                 JOIN Servicios s ON t.id_servicio = s.id_servicio
                 JOIN Usuarios u ON t.id_usuario = u.id_usuario
                 LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
                 INNER JOIN Escalamientos e ON t.id_ticket = e.id_ticket
                 LEFT JOIN Usuarios tec_orig ON e.tecnico_original_id = tec_orig.id_usuario
                 WHERE t.id_tecnico = ? AND e.tecnico_nuevo_id = ?
                 AND e.fecha_escalamiento = (
                   SELECT MAX(fecha_escalamiento)
                   FROM Escalamientos
                   WHERE id_ticket = t.id_ticket
                 )
                 ORDER BY e.fecha_escalamiento DESC, t.fecha_creacion DESC',
                [$user['id_usuario'], $user['id_usuario']]
            );
            
            $tickets = $stmt->fetchAll();
            
            AuthMiddleware::sendResponse([
                'tickets' => $tickets,
                'total' => count($tickets)
            ]);
            
        } catch (\Exception $e) {
            error_log('Error getting escalated tickets: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    /**
     * GET /tickets/technicians
     * Get list of technicians
     */
    public function getTechnicians()
    {
        $user = AuthMiddleware::authenticate();
        
        // Check permissions
        $userRol = strtolower(trim($user['rol'] ?? ''));
        if ($userRol !== 'tecnico' && $userRol !== 'administrador') {
            AuthMiddleware::sendError('Solo los técnicos y administradores pueden ver la lista de técnicos', 403);
        }
        
        try {
            $stmt = $this->db->query(
                'SELECT id_usuario as id, nombre, correo, rol
                 FROM Usuarios
                 WHERE LOWER(TRIM(rol)) IN ("tecnico", "administrador")
                 ORDER BY nombre ASC'
            );
            
            $technicians = $stmt->fetchAll();
            AuthMiddleware::sendResponse($technicians);
            
        } catch (\Exception $e) {
            error_log('Error getting technicians: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    /**
     * GET /tickets/:id/evaluation
     * Get ticket evaluation
     */
    public function getEvaluation($id)
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            // Check ticket ownership
            $stmt = $this->db->query(
                'SELECT id_usuario FROM Tickets WHERE id_ticket = ?',
                [$id]
            );
            
            $ticket = $stmt->fetch();
            if (!$ticket || $ticket['id_usuario'] != $user['id_usuario']) {
                AuthMiddleware::sendError('Ticket no encontrado', 404);
            }
            
            // Get evaluation
            $stmt = $this->db->query(
                'SELECT id_evaluacion, calificacion, comentario, fecha_evaluacion
                 FROM Evaluaciones
                 WHERE id_ticket = ?',
                [$id]
            );
            
            $evaluation = $stmt->fetch();
            
            if (!$evaluation) {
                AuthMiddleware::sendError('No se encontró evaluación para este ticket', 404);
            }
            
            AuthMiddleware::sendResponse([
                'id' => $evaluation['id_evaluacion'],
                'calificacion' => $evaluation['calificacion'],
                'comentario' => $evaluation['comentario'],
                'fechaEvaluacion' => $evaluation['fecha_evaluacion']
            ]);
            
        } catch (\Exception $e) {
            error_log('Error getting evaluation: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    /**
     * GET /tickets/:ticketId/approval-letter
     * Get approval letter file
     */
    public function getApprovalLetter($ticketId)
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            $disposition = isset($_GET['disposition']) && $_GET['disposition'] === 'inline' ? 'inline' : 'attachment';
            
            $stmt = $this->db->query(
                'SELECT archivo_aprobacion, id_usuario, id_tecnico FROM Tickets WHERE id_ticket = ?',
                [$ticketId]
            );
            
            $ticket = $stmt->fetch();
            
            if (!$ticket) {
                AuthMiddleware::sendError('Ticket no encontrado', 404);
            }
            
            if (!$ticket['archivo_aprobacion']) {
                AuthMiddleware::sendError('El ticket no tiene carta de aprobación adjunta', 404);
            }
            
            // Check permissions
            $esCreador = $ticket['id_usuario'] == $user['id_usuario'];
            $esTecnicoAsignado = $ticket['id_tecnico'] == $user['id_usuario'];
            $esAdministrador = $user['rol'] === 'administrador';
            
            if (!$esCreador && !$esTecnicoAsignado && !$esAdministrador) {
                AuthMiddleware::sendError('No tienes permisos para acceder a esta carta de aprobación', 403);
            }
            
            $filePath = __DIR__ . '/../../uploads/' . $ticket['archivo_aprobacion'];
            
            if (!file_exists($filePath)) {
                AuthMiddleware::sendError('Archivo no encontrado en el servidor', 404);
            }
            
            header('Content-Type: application/pdf');
            header('Content-Disposition: ' . $disposition . '; filename="' . urlencode($ticket['archivo_aprobacion']) . '"');
            readfile($filePath);
            exit;
            
        } catch (\Exception $e) {
            error_log('Error getting approval letter: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    /**
     * GET /tickets/download/:filename
     * Download file
     */
    public function downloadFile($filename)
    {
        AuthMiddleware::authenticate();
        
        try {
            $filePath = __DIR__ . '/../../uploads/' . $filename;
            
            if (!file_exists($filePath)) {
                AuthMiddleware::sendError('Archivo no encontrado', 404);
            }
            
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . urlencode($filename) . '"');
            readfile($filePath);
            exit;
            
        } catch (\Exception $e) {
            error_log('Error downloading file: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    /**
     * POST /tickets/:id/escalate
     * Escalate ticket
     */
    public function escalateTicket($id)
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $tecnicoDestino = $body['tecnicoDestino'] ?? null;
        $motivoEscalamiento = $body['motivoEscalamiento'] ?? '';
        
        if (!$motivoEscalamiento) {
            AuthMiddleware::sendError('El motivo de escalamiento es requerido', 400);
        }
        
        if (!$tecnicoDestino) {
            AuthMiddleware::sendError('Debes seleccionar un técnico destino para escalar el ticket', 400);
        }
        
        try {
            // Check destination technician exists
            $stmt = $this->db->query(
                'SELECT id_usuario, nombre, correo, rol FROM Usuarios WHERE id_usuario = ? AND rol IN ("tecnico", "administrador")',
                [$tecnicoDestino]
            );
            
            $tecnicoDestinoInfo = $stmt->fetch();
            
            if (!$tecnicoDestinoInfo) {
                AuthMiddleware::sendError('El técnico seleccionado no existe o no es válido', 400);
            }
            
            // Cannot escalate to self
            if ($tecnicoDestino == $user['id_usuario']) {
                AuthMiddleware::sendError('No puedes escalar un ticket a ti mismo', 400);
            }
            
            // Check ticket exists and assigned to user
            $stmt = $this->db->query(
                'SELECT id_ticket, id_tecnico, estatus FROM Tickets WHERE id_ticket = ? AND id_tecnico = ?',
                [$id, $user['id_usuario']]
            );
            
            $ticket = $stmt->fetch();
            
            if (!$ticket) {
                AuthMiddleware::sendError('Ticket no encontrado o no tienes permisos para escalarlo', 404);
            }
            
            // Cannot escalate closed ticket
            if ($ticket['estatus'] === 'Cerrado') {
                AuthMiddleware::sendError('No se puede escalar un ticket que ya está cerrado', 403);
            }
            
            // Update ticket status and assign to new technician
            $this->db->query(
                'UPDATE Tickets SET estatus = "Escalado", id_tecnico = ?, fecha_asignacion = COALESCE(fecha_asignacion, NOW()) WHERE id_ticket = ?',
                [$tecnicoDestino, $id]
            );
            
            // Save escalation info
            $this->db->query(
                'INSERT INTO Escalamientos (id_ticket, tecnico_original_id, tecnico_nuevo_id, nivel_escalamiento, persona_enviar, motivo_escalamiento, fecha_escalamiento) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                [$id, $user['id_usuario'], $tecnicoDestino, 'Manual', $tecnicoDestino, $motivoEscalamiento]
            );
            
            AuthMiddleware::sendResponse([
                'message' => 'Ticket escalado exitosamente a ' . $tecnicoDestinoInfo['nombre'],
                'ticketId' => $id,
                'escalamiento' => [
                    'tecnicoDestino' => $tecnicoDestinoInfo['nombre'],
                    'motivo' => $motivoEscalamiento
                ]
            ]);
            
        } catch (\Exception $e) {
            error_log('Error escalating ticket: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    /**
     * PUT /tickets/:id/reopen/technician-comment
     * Add technician comment to reopened ticket
     */
    public function addTechnicianReopenComment($id)
    {
        $user = AuthMiddleware::authenticate();
        
        if ($user['rol'] !== 'tecnico' && $user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('Solo los técnicos pueden registrar la causa de reapertura', 403);
        }
        
        $body = AuthMiddleware::getRequestBody();
        $causa = $body['causa'] ?? '';
        
        if (!$causa || !trim($causa)) {
            AuthMiddleware::sendError('La causa es obligatoria', 400);
        }
        
        try {
            // Get latest reopening
            $stmt = $this->db->query(
                'SELECT tr.id_reapertura, tr.tecnico_id, t.id_tecnico as ticket_tecnico_id
                 FROM TicketReaperturas tr
                 JOIN Tickets t ON tr.id_ticket = t.id_ticket
                 WHERE tr.id_ticket = ?
                 ORDER BY tr.fecha_reapertura DESC, tr.id_reapertura DESC
                 LIMIT 1',
                [$id]
            );
            
            $reopening = $stmt->fetch();
            
            if (!$reopening) {
                AuthMiddleware::sendError('No se encontró información de reapertura para este ticket', 404);
            }
            
            // Check permissions
            if ($reopening['ticket_tecnico_id'] != $user['id_usuario'] && 
                $reopening['tecnico_id'] != $user['id_usuario'] && 
                $user['rol'] !== 'administrador') {
                AuthMiddleware::sendError('No tienes permisos para actualizar la causa de este ticket', 403);
            }
            
            // Update reopening with cause
            $this->db->query(
                'UPDATE TicketReaperturas SET causa_tecnico = ?, tecnico_id = ?, fecha_respuesta_tecnico = NOW() WHERE id_reapertura = ?',
                [trim($causa), $user['id_usuario'], $reopening['id_reapertura']]
            );
            
            AuthMiddleware::sendResponse([
                'message' => 'Causa de reapertura registrada correctamente'
            ]);
            
        } catch (\Exception $e) {
            error_log('Error adding technician reopen comment: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}
