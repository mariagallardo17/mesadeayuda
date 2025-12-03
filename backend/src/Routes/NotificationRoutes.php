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
        $this->router->addRoute('PUT', '/notifications/:id/read', [$this, 'markAsRead']);
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
}
