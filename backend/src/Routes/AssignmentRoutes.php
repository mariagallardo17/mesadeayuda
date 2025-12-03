<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class AssignmentRoutes
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
        $this->router->addRoute('GET', '/assignments', [$this, 'getAssignments']);
        $this->router->addRoute('POST', '/assignments', [$this, 'createAssignment']);
    }
    
    public function getAssignments()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            $stmt = $this->db->query(
                'SELECT * FROM Asignaciones WHERE id_tecnico = ? ORDER BY fecha_asignacion DESC',
                [$user['id_usuario']]
            );
            
            $assignments = $stmt->fetchAll();
            AuthMiddleware::sendResponse($assignments);
        } catch (\Exception $e) {
            error_log('Error getting assignments: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function createAssignment()
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        try {
            // Assignment logic would go here
            AuthMiddleware::sendResponse(['message' => 'Assignment created'], 201);
        } catch (\Exception $e) {
            error_log('Error creating assignment: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}
