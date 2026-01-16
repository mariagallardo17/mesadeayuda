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
        // Limpiar cualquier output buffer previo al inicio
        if (ob_get_level() > 0) {
            ob_clean();
        }
        
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();

        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('No tienes permisos para crear servicios', 403);
            return;
        }

        $requerimiento = $body['requerimiento'] ?? null;
        $categoria = trim($body['categoria'] ?? '');
        $subcategoria = trim($body['subcategoria'] ?? '');
        $tiempoObjetivo = $body['tiempoObjetivo'] ?? null;
        $tiempoMaximo = $body['tiempoMaximo'] ?? null;
        $prioridad = $body['prioridad'] ?? null;
        $responsableInicial = $body['responsableInicial'] ?? null;
        $escalamiento = trim($body['escalamiento'] ?? '');
        $motivoEscalamiento = trim($body['motivoEscalamiento'] ?? '');
        $sla = $body['nivelServicio'] ?? $body['sla'] ?? null;
        $requiereAprobacion = isset($body['requiere_aprobacion']) ? (int)$body['requiere_aprobacion'] : 0;
        $activo = isset($body['activo']) ? $body['activo'] : true;

        // Validaciones de campos requeridos
        if (empty($categoria)) {
            AuthMiddleware::sendError('La categoría es requerida', 400);
            return;
        }

        if (empty($subcategoria)) {
            AuthMiddleware::sendError('La subcategoría es requerida', 400);
            return;
        }

        if (empty($escalamiento)) {
            AuthMiddleware::sendError('El escalamiento es requerido', 400);
            return;
        }

        // Normalizar valores vacíos a null
        $requerimiento = empty($requerimiento) ? null : $requerimiento;
        $tiempoObjetivo = empty($tiempoObjetivo) ? null : $tiempoObjetivo;
        $tiempoMaximo = empty($tiempoMaximo) ? null : $tiempoMaximo;
        $prioridad = empty($prioridad) ? null : $prioridad;
        $responsableInicial = empty($responsableInicial) ? null : $responsableInicial;
        $motivoEscalamiento = empty($motivoEscalamiento) ? null : $motivoEscalamiento;

        // Verificar que no existe un servicio ACTIVO con la misma categoría y subcategoría
        // Permitir crear servicios con la misma categoría/subcategoría si el existente está inactivo
        try {
            $stmtCheck = $this->db->query(
                'SELECT id_servicio, estatus FROM servicios WHERE categoria = ? AND subcategoria = ? AND estatus = "Activo"',
                [$categoria, $subcategoria]
            );
            $existing = $stmtCheck->fetch();
            if ($existing) {
                error_log("⚠️ [SERVICIOS] Intento de crear servicio duplicado - Categoría: '$categoria', Subcategoría: '$subcategoria', ID existente: {$existing['id_servicio']}");
                AuthMiddleware::sendError('Ya existe un servicio activo con esta categoría y subcategoría', 400);
                return;
            }
        } catch (\Exception $e) {
            error_log('❌ [SERVICIOS] Error verificando servicio existente: ' . $e->getMessage());
            error_log('❌ [SERVICIOS] Stack trace: ' . $e->getTraceAsString());
            // Continuar con la creación si hay error en la verificación
        }

        try {
            // Normalizar nivelServicio (sla) - puede ser null
            $slaValue = null;
            if ($sla) {
                $slaNormalized = strtoupper(trim($sla));
                if (!empty($slaNormalized)) {
                    $slaValue = $slaNormalized;
                }
            }

            // Log para debugging
            error_log("📝 [SERVICIOS] Creando servicio - Categoría: '$categoria', Subcategoría: '$subcategoria', Activo: " . ($activo ? 'Sí' : 'No'));

            // Preparar valores para la inserción
            $insertValues = [
                $requerimiento,
                $categoria,
                $subcategoria,
                $tiempoObjetivo,
                $tiempoMaximo,
                $prioridad,
                $responsableInicial,
                $escalamiento,
                $motivoEscalamiento,
                $slaValue,
                $activo ? 'Activo' : 'Inactivo',
                $requiereAprobacion
            ];

            $this->db->query(
                'INSERT INTO servicios (
                    requerimiento, categoria, subcategoria, tiempo_objetivo, tiempo_maximo,
                    prioridad, responsable_inicial, escalamiento, motivo_escalamiento,
                    sla, estatus, requiere_aprobacion
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                $insertValues
            );

            $serviceId = $this->db->lastInsertId();

            // Si lastInsertId devuelve 0 o false, intentar obtener el ID de otra forma
            if (!$serviceId || $serviceId === 0) {
                // Intentar obtener el último ID insertado de otra forma
                try {
                    $stmt = $this->db->query('SELECT LAST_INSERT_ID() as id');
                    $result = $stmt->fetch();
                    $serviceId = $result['id'] ?? 0;
                } catch (\Exception $e) {
                    $serviceId = 0;
                }
            }

            // Crear el objeto de respuesta directamente con los datos que tenemos
            // Esto evita errores al recuperar el servicio de la BD
            $formattedService = [
                'id' => (int)$serviceId,
                'requerimiento' => $requerimiento ?? null,
                'categoria' => $categoria,
                'subcategoria' => $subcategoria,
                'tiempoObjetivo' => $tiempoObjetivo ?? null,
                'tiempoMaximo' => $tiempoMaximo ?? null,
                'prioridad' => $prioridad ?? null,
                'responsableInicial' => $responsableInicial ?? null,
                'escalamiento' => $escalamiento,
                'motivoEscalamiento' => $motivoEscalamiento ?? null,
                'sla' => $slaValue,
                'activo' => $activo,
                'requiere_aprobacion' => (bool)$requiereAprobacion,
                'fechaCreacion' => date('Y-m-d H:i:s'),
                'fechaActualizacion' => date('Y-m-d H:i:s')
            ];

            // Preparar respuesta
            $responseData = ['message' => 'Servicio creado exitosamente', 'service' => $formattedService];
            
            // Limpiar cualquier output buffer previo ANTES de codificar JSON
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            
            // Codificar JSON
            $jsonResponse = json_encode($responseData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonResponse === false) {
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['error' => 'Error al procesar la respuesta', 'message' => json_last_error_msg()], JSON_UNESCAPED_UNICODE);
                if (function_exists('fastcgi_finish_request')) {
                    fastcgi_finish_request();
                }
                exit(0);
            }
            
            // Enviar respuesta exitosa
            http_response_code(201);
            header('Content-Type: application/json; charset=utf-8');
            header('Content-Length: ' . strlen($jsonResponse));
            header('Cache-Control: no-cache, must-revalidate');
            header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');
            echo $jsonResponse;
            
            // Finalizar request si está disponible
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            }
            
            // Terminar inmediatamente - no ejecutar nada más
            exit(0);
        } catch (\PDOException $e) {
            // Obtener información del error SQL
            $errorInfo = $e->errorInfo ?? [];
            if (!empty($errorInfo)) {
                $sqlError = $errorInfo[2] ?? $e->getMessage();
                $sqlState = $errorInfo[0] ?? $e->getCode();
            } else {
                $sqlError = $e->getMessage();
                $sqlState = $e->getCode();
            }

            // Si es un error de columna o tabla, dar un mensaje más específico
            if (strpos($sqlError, 'Unknown column') !== false || strpos($sqlError, "doesn't exist") !== false) {
                AuthMiddleware::sendError('Error en la estructura de la base de datos: ' . $sqlError, 500);
                return;
            }

            // Si es un error de valor duplicado
            if (strpos($sqlError, 'Duplicate entry') !== false) {
                AuthMiddleware::sendError('Ya existe un servicio activo con esta categoría y subcategoría', 400);
                return;
            }

            // Devolver información detallada del error en la respuesta (para diagnóstico sin logs)
            $errorDetails = [
                'error' => 'Error al crear el servicio',
                'message' => $sqlError,
                'sqlState' => $sqlState,
                'code' => $e->getCode(),
                'debug' => [
                    'categoria' => $categoria,
                    'subcategoria' => $subcategoria,
                    'escalamiento' => $escalamiento,
                    'activo' => $activo
                ]
            ];
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode($errorDetails);
            exit;
        } catch (\Exception $e) {
            // Devolver información detallada del error en la respuesta (para diagnóstico sin logs)
            $errorDetails = [
                'error' => 'Error al crear el servicio',
                'message' => $e->getMessage(),
                'file' => basename($e->getFile()),
                'line' => $e->getLine(),
                'code' => $e->getCode(),
                'debug' => [
                    'categoria' => $categoria ?? 'N/A',
                    'subcategoria' => $subcategoria ?? 'N/A',
                    'escalamiento' => $escalamiento ?? 'N/A'
                ]
            ];
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode($errorDetails);
            exit;
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
            return;
        }

        try {
            // Verificar si el servicio tiene tickets asociados
            $stmtTickets = $this->db->query(
                'SELECT COUNT(*) as total FROM tickets WHERE id_servicio = ?',
                [$id]
            );
            $ticketsResult = $stmtTickets->fetch();
            $tieneTickets = $ticketsResult && $ticketsResult['total'] > 0;

            if ($tieneTickets) {
                // Si tiene tickets, inactivar el servicio
                error_log("⚠️ [SERVICIOS] El servicio ID $id tiene tickets asociados, se inactivará en lugar de borrarse");
                $this->db->query('UPDATE servicios SET estatus = "Inactivo" WHERE id_servicio = ?', [$id]);
                AuthMiddleware::sendResponse(['message' => 'Servicio inactivado exitosamente (tiene tickets asociados)']);
            } else {
                // Si no tiene tickets, borrar el servicio
                error_log("✅ [SERVICIOS] El servicio ID $id no tiene tickets asociados, se eliminará permanentemente");
                $this->db->query('DELETE FROM servicios WHERE id_servicio = ?', [$id]);
                AuthMiddleware::sendResponse(['message' => 'Servicio eliminado exitosamente']);
            }
        } catch (\Exception $e) {
            error_log('❌ [SERVICIOS] Error deleting service: ' . $e->getMessage());
            error_log('❌ [SERVICIOS] Stack trace: ' . $e->getTraceAsString());
            
            // Si es un error de foreign key, significa que tiene tickets asociados
            if (strpos($e->getMessage(), 'foreign key') !== false || strpos($e->getMessage(), 'FOREIGN KEY') !== false) {
                // Intentar inactivar en lugar de borrar
                try {
                    $this->db->query('UPDATE servicios SET estatus = "Inactivo" WHERE id_servicio = ?', [$id]);
                    AuthMiddleware::sendResponse(['message' => 'Servicio inactivado exitosamente (tiene tickets asociados)']);
                } catch (\Exception $e2) {
                    error_log('❌ [SERVICIOS] Error inactivando servicio: ' . $e2->getMessage());
                    AuthMiddleware::sendError('Error al procesar la eliminación del servicio', 500);
                }
            } else {
                AuthMiddleware::sendError('Error interno del servidor', 500);
            }
        }
    }
}
