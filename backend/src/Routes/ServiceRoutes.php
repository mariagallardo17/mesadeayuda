<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class ServiceRoutes
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
        $this->router->addRoute('GET', '/services', [$this, 'getServices']);
        $this->router->addRoute('GET', '/services/:id', [$this, 'getServiceById']);
        $this->router->addRoute('POST', '/services', [$this, 'createService']);
        $this->router->addRoute('PUT', '/services/:id', [$this, 'updateService']);
        $this->router->addRoute('DELETE', '/services/:id', [$this, 'deleteService']);
    }
    
    public function getServices()
    {
        try {
            $stmt = $this->db->query(
                'SELECT id_servicio as id, categoria, subcategoria, descripcion, tiempo_objetivo, prioridad, estatus 
                 FROM Servicios WHERE estatus = "Activo" ORDER BY categoria, subcategoria'
            );
            
            $services = $stmt->fetchAll();
            AuthMiddleware::sendResponse($services);
        } catch (\Exception $e) {
            error_log('Error getting services: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function getServiceById($id)
    {
        try {
            $stmt = $this->db->query(
                'SELECT id_servicio as id, categoria, subcategoria, descripcion, tiempo_objetivo, prioridad, estatus 
                 FROM Servicios WHERE id_servicio = ?',
                [$id]
            );
            
            $service = $stmt->fetch();
            
            if (!$service) {
                AuthMiddleware::sendError('Servicio no encontrado', 404);
            }
            
            AuthMiddleware::sendResponse($service);
        } catch (\Exception $e) {
            error_log('Error getting service: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function createService()
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('No tienes permisos para crear servicios', 403);
        }
        
        $categoria = $body['categoria'] ?? '';
        $subcategoria = $body['subcategoria'] ?? '';
        $descripcion = $body['descripcion'] ?? '';
        
        if (empty($categoria) || empty($subcategoria)) {
            AuthMiddleware::sendError('Categoría y subcategoría son requeridas', 400);
        }
        
        try {
            $this->db->query(
                'INSERT INTO Servicios (categoria, subcategoria, descripcion, estatus) VALUES (?, ?, ?, "Activo")',
                [$categoria, $subcategoria, $descripcion]
            );
            
            AuthMiddleware::sendResponse(['message' => 'Servicio creado exitosamente'], 201);
        } catch (\Exception $e) {
            error_log('Error creating service: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function updateService($id)
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('No tienes permisos para actualizar servicios', 403);
        }
        
        try {
            $updates = [];
            $params = [];
            
            if (isset($body['categoria'])) {
                $updates[] = 'categoria = ?';
                $params[] = $body['categoria'];
            }
            
            if (isset($body['subcategoria'])) {
                $updates[] = 'subcategoria = ?';
                $params[] = $body['subcategoria'];
            }
            
            if (isset($body['descripcion'])) {
                $updates[] = 'descripcion = ?';
                $params[] = $body['descripcion'];
            }
            
            if (empty($updates)) {
                AuthMiddleware::sendError('No hay datos para actualizar', 400);
            }
            
            $params[] = $id;
            $sql = 'UPDATE Servicios SET ' . implode(', ', $updates) . ' WHERE id_servicio = ?';
            
            $this->db->query($sql, $params);
            
            AuthMiddleware::sendResponse(['message' => 'Servicio actualizado exitosamente']);
        } catch (\Exception $e) {
            error_log('Error updating service: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function deleteService($id)
    {
        $user = AuthMiddleware::authenticate();
        
        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('No tienes permisos para eliminar servicios', 403);
        }
        
        try {
            $this->db->query('UPDATE Servicios SET estatus = "Inactivo" WHERE id_servicio = ?', [$id]);
            
            AuthMiddleware::sendResponse(['message' => 'Servicio desactivado exitosamente']);
        } catch (\Exception $e) {
            error_log('Error deleting service: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}
