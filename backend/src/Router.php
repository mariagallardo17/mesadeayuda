<?php

namespace App;

use App\Routes\AuthRoutes;
use App\Routes\UserRoutes;
use App\Routes\TicketRoutes;
use App\Routes\ServiceRoutes;
use App\Routes\AssignmentRoutes;
use App\Routes\ReportRoutes;
use App\Routes\ReportesRoutes;
use App\Routes\NotificationRoutes;

class Router
{
    private $routes = [];
    
    public function __construct()
    {
        $this->registerRoutes();
    }
    
    private function registerRoutes()
    {
        // Register all route handlers
        new AuthRoutes($this);
        new UserRoutes($this);
        new TicketRoutes($this);
        new ServiceRoutes($this);
        new AssignmentRoutes($this);
        new ReportRoutes($this);
        new ReportesRoutes($this);
        new NotificationRoutes($this);
    }
    
    public function addRoute($method, $path, $callback)
    {
        $this->routes[] = [
            'method' => strtoupper($method),
            'path' => $path,
            'callback' => $callback
        ];
    }
    
    public function route($method, $uri)
    {
        // Health check endpoint
        if ($method === 'GET' && $uri === '/health') {
            $this->handleHealthCheck();
            return;
        }
        
        // Find matching route
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            
            // Convert route path to regex
            $pattern = $this->convertPathToRegex($route['path']);
            
            if (preg_match($pattern, $uri, $matches)) {
                // Extract parameters
                array_shift($matches);
                
                // Call the route handler
                // El handler debe enviar su propia respuesta y hacer exit() si es necesario
                call_user_func_array($route['callback'], $matches);
                // Si llegamos aquí, el handler no hizo exit, pero eso está bien
                return;
            }
        }
        
        // No route found
        http_response_code(404);
        echo json_encode([
            'error' => 'Route not found',
            'path' => $uri
        ]);
    }
    
    private function convertPathToRegex($path)
    {
        // Convert :param to named regex group
        $pattern = preg_replace('/:\w+/', '([^/]+)', $path);
        return '#^' . $pattern . '$#';
    }
    
    private function handleHealthCheck()
    {
        $db = \App\Config\Database::getInstance();
        $dbStatus = $db->testConnection();
        
        echo json_encode([
            'status' => 'OK',
            'database' => $dbStatus ? 'Connected' : 'Disconnected',
            'timestamp' => date('c')
        ]);
    }
}
