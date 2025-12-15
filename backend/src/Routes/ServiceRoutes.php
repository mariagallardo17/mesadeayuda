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
                'SELECT 
                    id_servicio as id,
                    requerimiento,
                    categoria,
                    subcategoria,
                    tiempo_objetivo,
                    tiempo_maximo,
                    prioridad,
                    responsable_inicial,
                    escalamiento,
                    motivo_escalamiento,
                    nivel_servicio,
                    sla,
                    estatus,
                    requiere_aprobacion,
                    fecha_creacion,
                    fecha_actualizacion
                 FROM servicios 
                 WHERE estatus = "Activo" 
                 ORDER BY categoria, subcategoria'
            );
            
            $services = $stmt->fetchAll();
            
            // Mapear los campos al formato que espera el frontend
            $formattedServices = array_map(function($service) {
                return [
                    'id' => $service['id'],
                    'requerimiento' => $service['requerimiento'] ?? null,
                    'categoria' => $service['categoria'],
                    'subcategoria' => $service['subcategoria'],
                    'tiempoObjetivo' => $service['tiempo_objetivo'] ?? null,
                    'tiempoMaximo' => $service['tiempo_maximo'] ?? null,
                    'prioridad' => $service['prioridad'] ?? null,
                    'responsableInicial' => $service['responsable_inicial'] ?? null,
                    'escalamiento' => $service['escalamiento'] ?? null,
                    'motivoEscalamiento' => $service['motivo_escalamiento'] ?? null,
                    'sla' => $service['sla'] ?? $service['nivel_servicio'] ?? null,
                    'activo' => $service['estatus'] === 'Activo',
                    'requiere_aprobacion' => (bool)($service['requiere_aprobacion'] ?? false),
                    'fechaCreacion' => $service['fecha_creacion'] ?? null,
                    'fechaActualizacion' => $service['fecha_actualizacion'] ?? null
                ];
            }, $services);
            
            AuthMiddleware::sendResponse($formattedServices);
        } catch (\Exception $e) {
            error_log('Error getting services: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function getServiceById($id)
    {
        try {
            $stmt = $this->db->query(
                'SELECT 
                    id_servicio as id,
                    requerimiento,
                    categoria,
                    subcategoria,
                    tiempo_objetivo,
                    tiempo_maximo,
                    prioridad,
                    responsable_inicial,
                    escalamiento,
                    motivo_escalamiento,
                    nivel_servicio,
                    sla,
                    estatus,
                    requiere_aprobacion,
                    fecha_creacion,
                    fecha_actualizacion
                 FROM servicios 
                 WHERE id_servicio = ?',
                [$id]
            );
            
            $service = $stmt->fetch();
            
            if (!$service) {
                AuthMiddleware::sendError('Servicio no encontrado', 404);
            }
            
            // Mapear al formato que espera el frontend
            $formattedService = [
                'id' => $service['id'],
                'requerimiento' => $service['requerimiento'] ?? null,
                'categoria' => $service['categoria'],
                'subcategoria' => $service['subcategoria'],
                'tiempoObjetivo' => $service['tiempo_objetivo'] ?? null,
                'tiempoMaximo' => $service['tiempo_maximo'] ?? null,
                'prioridad' => $service['prioridad'] ?? null,
                'responsableInicial' => $service['responsable_inicial'] ?? null,
                'escalamiento' => $service['escalamiento'] ?? null,
                'motivoEscalamiento' => $service['motivo_escalamiento'] ?? null,
                'sla' => $service['sla'] ?? $service['nivel_servicio'] ?? null,
                'activo' => $service['estatus'] === 'Activo',
                'requiere_aprobacion' => (bool)($service['requiere_aprobacion'] ?? false),
                'fechaCreacion' => $service['fecha_creacion'] ?? null,
                'fechaActualizacion' => $service['fecha_actualizacion'] ?? null
            ];
            
            AuthMiddleware::sendResponse($formattedService);
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
        
        $requerimiento = $body['requerimiento'] ?? null;
        $categoria = $body['categoria'] ?? '';
        $subcategoria = $body['subcategoria'] ?? '';
        $tiempoObjetivo = $body['tiempoObjetivo'] ?? null;
        $tiempoMaximo = $body['tiempoMaximo'] ?? null;
        $prioridad = $body['prioridad'] ?? null;
        $responsableInicial = $body['responsableInicial'] ?? null;
        $escalamiento = $body['escalamiento'] ?? null;
        $motivoEscalamiento = $body['motivoEscalamiento'] ?? null;
        $sla = $body['nivelServicio'] ?? $body['sla'] ?? null;
        $requiereAprobacion = isset($body['requiere_aprobacion']) ? (int)$body['requiere_aprobacion'] : 0;
        $activo = isset($body['activo']) ? $body['activo'] : true;
        
        if (empty($categoria) || empty($subcategoria)) {
            AuthMiddleware::sendError('Categoría y subcategoría son requeridas', 400);
        }
        
        try {
            $this->db->query(
                'INSERT INTO servicios (
                    requerimiento, categoria, subcategoria, tiempo_objetivo, tiempo_maximo,
                    prioridad, responsable_inicial, escalamiento, motivo_escalamiento,
                    sla, estatus, requiere_aprobacion
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $requerimiento, $categoria, $subcategoria, $tiempoObjetivo, $tiempoMaximo,
                    $prioridad, $responsableInicial, $escalamiento, $motivoEscalamiento,
                    $sla, $activo ? 'Activo' : 'Inactivo', $requiereAprobacion
                ]
            );
            
            $serviceId = $this->db->lastInsertId();
            
            // Obtener el servicio creado
            $stmt = $this->db->query(
                'SELECT 
                    id_servicio as id,
                    requerimiento,
                    categoria,
                    subcategoria,
                    tiempo_objetivo,
                    tiempo_maximo,
                    prioridad,
                    responsable_inicial,
                    escalamiento,
                    motivo_escalamiento,
                    nivel_servicio,
                    sla,
                    estatus,
                    requiere_aprobacion,
                    fecha_creacion,
                    fecha_actualizacion
                 FROM servicios 
                 WHERE id_servicio = ?',
                [$serviceId]
            );
            
            $service = $stmt->fetch();
            
            // Mapear al formato que espera el frontend
            $formattedService = [
                'id' => $service['id'],
                'requerimiento' => $service['requerimiento'] ?? null,
                'categoria' => $service['categoria'],
                'subcategoria' => $service['subcategoria'],
                'tiempoObjetivo' => $service['tiempo_objetivo'] ?? null,
                'tiempoMaximo' => $service['tiempo_maximo'] ?? null,
                'prioridad' => $service['prioridad'] ?? null,
                'responsableInicial' => $service['responsable_inicial'] ?? null,
                'escalamiento' => $service['escalamiento'] ?? null,
                'motivoEscalamiento' => $service['motivo_escalamiento'] ?? null,
                'sla' => $service['sla'] ?? $service['nivel_servicio'] ?? null,
                'activo' => $service['estatus'] === 'Activo',
                'requiere_aprobacion' => (bool)($service['requiere_aprobacion'] ?? false),
                'fechaCreacion' => $service['fecha_creacion'] ?? null,
                'fechaActualizacion' => $service['fecha_actualizacion'] ?? null
            ];
            
            AuthMiddleware::sendResponse(['message' => 'Servicio creado exitosamente', 'service' => $formattedService], 201);
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
            
            if (isset($body['requerimiento'])) {
                $updates[] = 'requerimiento = ?';
                $params[] = $body['requerimiento'];
            }
            
            if (isset($body['categoria'])) {
                $updates[] = 'categoria = ?';
                $params[] = $body['categoria'];
            }
            
            if (isset($body['subcategoria'])) {
                $updates[] = 'subcategoria = ?';
                $params[] = $body['subcategoria'];
            }
            
            if (isset($body['tiempoObjetivo'])) {
                $updates[] = 'tiempo_objetivo = ?';
                $params[] = $body['tiempoObjetivo'];
            }
            
            if (isset($body['tiempoMaximo'])) {
                $updates[] = 'tiempo_maximo = ?';
                $params[] = $body['tiempoMaximo'];
            }
            
            if (isset($body['prioridad'])) {
                $updates[] = 'prioridad = ?';
                $params[] = $body['prioridad'];
            }
            
            if (isset($body['responsableInicial'])) {
                $updates[] = 'responsable_inicial = ?';
                $params[] = $body['responsableInicial'];
            }
            
            if (isset($body['escalamiento'])) {
                $updates[] = 'escalamiento = ?';
                $params[] = $body['escalamiento'];
            }
            
            if (isset($body['motivoEscalamiento'])) {
                $updates[] = 'motivo_escalamiento = ?';
                $params[] = $body['motivoEscalamiento'];
            }
            
            if (isset($body['nivelServicio']) || isset($body['sla'])) {
                $updates[] = 'sla = ?';
                $params[] = $body['nivelServicio'] ?? $body['sla'] ?? null;
            }
            
            if (isset($body['activo'])) {
                $updates[] = 'estatus = ?';
                $params[] = $body['activo'] ? 'Activo' : 'Inactivo';
            }
            
            if (isset($body['requiere_aprobacion'])) {
                $updates[] = 'requiere_aprobacion = ?';
                $params[] = (int)$body['requiere_aprobacion'];
            }
            
            if (empty($updates)) {
                AuthMiddleware::sendError('No hay datos para actualizar', 400);
            }
            
            $params[] = $id;
            $sql = 'UPDATE servicios SET ' . implode(', ', $updates) . ' WHERE id_servicio = ?';
            
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
            $this->db->query('UPDATE servicios SET estatus = "Inactivo" WHERE id_servicio = ?', [$id]);
            
            AuthMiddleware::sendResponse(['message' => 'Servicio desactivado exitosamente']);
        } catch (\Exception $e) {
            error_log('Error deleting service: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}
