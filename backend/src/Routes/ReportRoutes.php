<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class ReportRoutes
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
        $this->router->addRoute('GET', '/reports', [$this, 'getReports']);
        $this->router->addRoute('GET', '/reports/tickets', [$this, 'getTicketReports']);
    }
    
    public function getReports()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            // Report generation logic would go here
            AuthMiddleware::sendResponse(['reports' => []]);
        } catch (\Exception $e) {
            error_log('Error getting reports: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function getTicketReports()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            $stmt = $this->db->query(
                'SELECT COUNT(*) as total, estatus 
                 FROM tickets 
                 GROUP BY estatus'
            );
            
            $reports = $stmt->fetchAll();
            AuthMiddleware::sendResponse($reports);
        } catch (\Exception $e) {
            error_log('Error getting ticket reports: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}
