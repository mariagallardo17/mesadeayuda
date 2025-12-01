<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class TicketRoutes
{
    private $router;
    private $db;
    
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
        $this->router->addRoute('GET', '/tickets/:id', [$this, 'getTicketById']);
        $this->router->addRoute('POST', '/tickets', [$this, 'createTicket']);
        $this->router->addRoute('PUT', '/tickets/:id/status', [$this, 'updateTicketStatus']);
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
        
        if (strlen($descripcion) < 10) {
            AuthMiddleware::sendError('La descripción debe tener al menos 10 caracteres', 400);
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
}
