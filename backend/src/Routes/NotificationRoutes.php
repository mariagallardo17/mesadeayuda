<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class NotificationRoutes
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
        $this->router->addRoute('GET', '/notifications', [$this, 'getNotifications']);
        $this->router->addRoute('GET', '/notifications/:userId', [$this, 'getNotificationsByUserId']);
        $this->router->addRoute('POST', '/notifications', [$this, 'createNotification']);
        $this->router->addRoute('POST', '/notifications/status-change', [$this, 'createStatusChangeNotification']);
        $this->router->addRoute('PUT', '/notifications/:id/read', [$this, 'markAsRead']);
        $this->router->addRoute('DELETE', '/notifications/:notificationId', [$this, 'deleteNotification']);
    }
    
    public function getNotifications()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            $stmt = $this->db->query(
                'SELECT * FROM Notificaciones WHERE id_usuario = ? ORDER BY fecha_creacion DESC LIMIT 50',
                [$user['id_usuario']]
            );
            
            $notifications = $stmt->fetchAll();
            AuthMiddleware::sendResponse($notifications);
        } catch (\Exception $e) {
            error_log('Error getting notifications: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function getNotificationsByUserId($userId)
    {
        AuthMiddleware::authenticate();
        
        try {
            $stmt = $this->db->query(
                'SELECT * FROM Notificaciones WHERE id_usuario = ? ORDER BY fecha_creacion DESC LIMIT 50',
                [$userId]
            );
            
            $notifications = $stmt->fetchAll();
            AuthMiddleware::sendResponse($notifications);
        } catch (\Exception $e) {
            error_log('Error getting notifications by user ID: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function createNotification()
    {
        AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $idUsuario = $body['id_usuario'] ?? null;
        $titulo = $body['titulo'] ?? '';
        $mensaje = $body['mensaje'] ?? '';
        $tipo = $body['tipo'] ?? 'info';
        $idTicket = $body['id_ticket'] ?? null;
        
        if (!$idUsuario || !$titulo || !$mensaje) {
            AuthMiddleware::sendError('id_usuario, titulo y mensaje son requeridos', 400);
        }
        
        try {
            $this->db->query(
                'INSERT INTO Notificaciones (id_usuario, titulo, mensaje, tipo, id_ticket, fecha_creacion, leida) VALUES (?, ?, ?, ?, ?, NOW(), 0)',
                [$idUsuario, $titulo, $mensaje, $tipo, $idTicket]
            );
            
            AuthMiddleware::sendResponse(['message' => 'Notificación creada exitosamente'], 201);
        } catch (\Exception $e) {
            error_log('Error creating notification: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function createStatusChangeNotification()
    {
        AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $idUsuario = $body['id_usuario'] ?? null;
        $idTicket = $body['id_ticket'] ?? null;
        $nuevoEstatus = $body['nuevo_estatus'] ?? '';
        $estatusAnterior = $body['estatus_anterior'] ?? '';
        
        if (!$idUsuario || !$idTicket || !$nuevoEstatus) {
            AuthMiddleware::sendError('id_usuario, id_ticket y nuevo_estatus son requeridos', 400);
        }
        
        try {
            $titulo = 'Cambio de estado del ticket #' . $idTicket;
            $mensaje = 'El estado del ticket ha cambiado de "' . $estatusAnterior . '" a "' . $nuevoEstatus . '"';
            
            $this->db->query(
                'INSERT INTO Notificaciones (id_usuario, titulo, mensaje, tipo, id_ticket, fecha_creacion, leida) VALUES (?, ?, ?, ?, ?, NOW(), 0)',
                [$idUsuario, $titulo, $mensaje, 'status_change', $idTicket]
            );
            
            AuthMiddleware::sendResponse(['message' => 'Notificación de cambio de estado creada exitosamente'], 201);
        } catch (\Exception $e) {
            error_log('Error creating status change notification: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function markAsRead($id)
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            $this->db->query(
                'UPDATE Notificaciones SET leida = 1 WHERE id_notificacion = ? AND id_usuario = ?',
                [$id, $user['id_usuario']]
            );
            
            AuthMiddleware::sendResponse(['message' => 'Notificación marcada como leída']);
        } catch (\Exception $e) {
            error_log('Error marking notification as read: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function deleteNotification($notificationId)
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            $this->db->query(
                'DELETE FROM Notificaciones WHERE id_notificacion = ? AND id_usuario = ?',
                [$notificationId, $user['id_usuario']]
            );
            
            AuthMiddleware::sendResponse(['message' => 'Notificación eliminada exitosamente']);
        } catch (\Exception $e) {
            error_log('Error deleting notification: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}
