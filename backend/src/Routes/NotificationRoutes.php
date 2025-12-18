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
        $this->router->addRoute('GET', '/notifications/debug', [$this, 'getNotificationsDebug']);
        $this->router->addRoute('GET', '/notifications/:userId', [$this, 'getNotificationsByUserId']);
        $this->router->addRoute('POST', '/notifications', [$this, 'createNotification']);
        $this->router->addRoute('POST', '/notifications/status-change', [$this, 'createStatusChangeNotification']);
        $this->router->addRoute('PUT', '/notifications/:id/read', [$this, 'markAsRead']);
        $this->router->addRoute('DELETE', '/notifications/:notificationId', [$this, 'deleteNotification']);
    }
    
    /**
     * Endpoint de diagnóstico para verificar el estado de las notificaciones
     * Útil para depuración sin acceso directo a la base de datos
     */
    public function getNotificationsDebug()
    {
        $user = AuthMiddleware::authenticate();
        
        if (!isset($user['id_usuario']) || empty($user['id_usuario'])) {
            AuthMiddleware::sendError('Error de autenticación: usuario no válido', 401);
            return;
        }
        
        $userId = (int)$user['id_usuario'];
        $debugInfo = [
            'usuario_id' => $userId,
            'usuario_nombre' => $user['nombre'] ?? 'N/A',
            'fecha_consulta' => date('Y-m-d H:i:s'),
            'tabla_encontrada' => false,
            'tabla_nombre' => null,
            'total_notificaciones' => 0,
            'notificaciones_no_leidas' => 0,
            'ultimas_5_notificaciones' => [],
            'errores' => []
        ];
        
        try {
            // Intentar encontrar la tabla
            $nombresTabla = ['notificaciones', 'Notificaciones', 'NOTIFICACIONES'];
            
            foreach ($nombresTabla as $nombreTabla) {
                try {
                    // Verificar que la tabla existe
                    $stmt = $this->db->query("SELECT COUNT(*) as total FROM `$nombreTabla` WHERE id_usuario = ?", [$userId]);
                    $result = $stmt->fetch();
                    
                    if ($result !== false) {
                        $debugInfo['tabla_encontrada'] = true;
                        $debugInfo['tabla_nombre'] = $nombreTabla;
                        $debugInfo['total_notificaciones'] = (int)$result['total'];
                        
                        // Contar no leídas
                        $stmt = $this->db->query(
                            "SELECT COUNT(*) as total FROM `$nombreTabla` WHERE id_usuario = ? AND leida = 0",
                            [$userId]
                        );
                        $resultNoLeidas = $stmt->fetch();
                        $debugInfo['notificaciones_no_leidas'] = (int)($resultNoLeidas['total'] ?? 0);
                        
                        // Obtener las últimas 5
                        $stmt = $this->db->query(
                            "SELECT id_notificacion, id_ticket, mensaje, fecha_envio, leida 
                             FROM `$nombreTabla` 
                             WHERE id_usuario = ? 
                             ORDER BY fecha_envio DESC 
                             LIMIT 5",
                            [$userId]
                        );
                        $notificaciones = $stmt->fetchAll();
                        $debugInfo['ultimas_5_notificaciones'] = $notificaciones;
                        
                        break;
                    }
                } catch (\Exception $e) {
                    $debugInfo['errores'][] = "Error con tabla $nombreTabla: " . $e->getMessage();
                    continue;
                }
            }
            
            if (!$debugInfo['tabla_encontrada']) {
                $debugInfo['errores'][] = "No se encontró ninguna tabla de notificaciones válida";
            }
            
        } catch (\Exception $e) {
            $debugInfo['errores'][] = "Error general: " . $e->getMessage();
        }
        
        AuthMiddleware::sendResponse($debugInfo);
    }
    
    public function getNotifications()
    {
        $user = AuthMiddleware::authenticate();
        
        // Validar que tenemos el id_usuario
        if (!isset($user['id_usuario']) || empty($user['id_usuario'])) {
            error_log('❌ ERROR: Usuario autenticado no tiene id_usuario válido');
            AuthMiddleware::sendError('Error de autenticación: usuario no válido', 401);
            return;
        }
        
        $userId = (int)$user['id_usuario'];
        error_log("📧 Obteniendo notificaciones para usuario ID: $userId");
        
        try {
            // Intentar con diferentes nombres de tabla (case-sensitive)
            $notifications = [];
            $tablaEncontrada = false;
            $nombresTabla = ['notificaciones', 'Notificaciones', 'NOTIFICACIONES'];
            
            foreach ($nombresTabla as $nombreTabla) {
                try {
                    error_log("🔍 Intentando obtener notificaciones de tabla: $nombreTabla");
                    $stmt = $this->db->query(
                        "SELECT id_notificacion, id_ticket, id_usuario, tipo, mensaje, fecha_envio as fecha_creacion, leida 
                         FROM `$nombreTabla` 
                         WHERE id_usuario = ? 
                         ORDER BY fecha_envio DESC 
                         LIMIT 50",
                        [$userId]
                    );
                    
                    $notifications = $stmt->fetchAll();
                    $tablaEncontrada = true;
                    error_log("✅ Tabla encontrada: $nombreTabla");
                    break;
                } catch (\Exception $e) {
                    error_log("⚠️ Tabla $nombreTabla no encontrada o error: " . $e->getMessage());
                    continue;
                }
            }
            
            if (!$tablaEncontrada) {
                error_log("❌ No se encontró ninguna tabla de notificaciones válida");
                AuthMiddleware::sendResponse([]);
                return;
            }
            
            // Log para depuración
            error_log("✅ Se encontraron " . count($notifications) . " notificaciones para usuario ID: $userId");
            
            // FILTRAR CRÍTICO: Asegurar que todas las notificaciones pertenecen al usuario correcto
            // Esto es una doble validación de seguridad
            $notificacionesValidas = [];
            $notificacionesInvalidas = 0;
            
            foreach ($notifications as $notif) {
                $notifUserId = isset($notif['id_usuario']) ? (int)$notif['id_usuario'] : 0;
                
                // Solo incluir notificaciones que pertenecen al usuario autenticado
                if ($notifUserId === $userId) {
                    $notificacionesValidas[] = $notif;
                } else {
                    $notificacionesInvalidas++;
                    error_log("🚫 [NOTIFICACIONES] ERROR CRÍTICO: Notificación ID {$notif['id_notificacion']} pertenece a usuario $notifUserId, pero se solicitó para usuario $userId - FILTRADA");
                }
            }
            
            if ($notificacionesInvalidas > 0) {
                error_log("⚠️ [NOTIFICACIONES] ADVERTENCIA CRÍTICA: Se filtraron $notificacionesInvalidas notificaciones que no pertenecen al usuario $userId");
            }
            
            error_log("✅ [NOTIFICACIONES] Devolviendo " . count($notificacionesValidas) . " notificaciones válidas para usuario ID: $userId");
            
            // Solo devolver notificaciones válidas
            AuthMiddleware::sendResponse($notificacionesValidas);
        } catch (\Exception $e) {
            error_log('❌ Error getting notifications: ' . $e->getMessage());
            error_log('❌ Stack trace: ' . $e->getTraceAsString());
            // En caso de error, devolver array vacío en lugar de error 500
            AuthMiddleware::sendResponse([]);
        }
    }
    
    public function getNotificationsByUserId($userId)
    {
        AuthMiddleware::authenticate();
        
        try {
            // Intentar con diferentes nombres de tabla
            $notifications = [];
            $tablaEncontrada = false;
            $nombresTabla = ['notificaciones', 'Notificaciones', 'NOTIFICACIONES'];
            
            foreach ($nombresTabla as $nombreTabla) {
                try {
                    $stmt = $this->db->query(
                        "SELECT id_notificacion, id_ticket, id_usuario, tipo, mensaje, fecha_envio as fecha_creacion, leida FROM `$nombreTabla` WHERE id_usuario = ? ORDER BY fecha_envio DESC LIMIT 50",
                        [$userId]
                    );
                    
                    $notifications = $stmt->fetchAll();
                    $tablaEncontrada = true;
                    break;
                } catch (\Exception $e) {
                    continue;
                }
            }
            
            if (!$tablaEncontrada) {
                error_log("❌ No se encontró ninguna tabla de notificaciones válida para usuario $userId");
                AuthMiddleware::sendResponse([]);
                return;
            }
            
            AuthMiddleware::sendResponse($notifications);
        } catch (\Exception $e) {
            error_log('❌ Error getting notifications by user ID: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function createNotification()
    {
        AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $idUsuario = $body['id_usuario'] ?? null;
        $mensaje = $body['mensaje'] ?? '';
        $tipo = $body['tipo'] ?? 'Interna';
        $idTicket = $body['id_ticket'] ?? null;
        
        // Validar tipo
        $validTypes = ['Correo', 'WhatsApp', 'Interna'];
        if (!in_array($tipo, $validTypes)) {
            $tipo = 'Interna';
        }
        
        if (!$idUsuario || !$mensaje) {
            AuthMiddleware::sendError('id_usuario y mensaje son requeridos', 400);
        }
        
        try {
            // Intentar insertar en diferentes nombres de tabla
            $insertado = false;
            $nombresTabla = ['notificaciones', 'Notificaciones', 'NOTIFICACIONES'];
            
            foreach ($nombresTabla as $nombreTabla) {
                try {
                    $this->db->query(
                        "INSERT INTO `$nombreTabla` (id_usuario, mensaje, tipo, id_ticket, fecha_envio, leida) VALUES (?, ?, ?, ?, NOW(), 0)",
                        [$idUsuario, $mensaje, $tipo, $idTicket]
                    );
                    $insertado = true;
                    error_log("✅ Notificación insertada en tabla: $nombreTabla");
                    break;
                } catch (\Exception $e) {
                    if (strpos($e->getMessage(), "doesn't exist") === false && strpos($e->getMessage(), "Unknown table") === false) {
                        // Si es otro tipo de error, lanzarlo
                        throw $e;
                    }
                    // Si es error de tabla no existe, intentar siguiente
                    continue;
                }
            }
            
            if (!$insertado) {
                throw new \Exception("No se pudo insertar notificación: ninguna tabla de notificaciones encontrada");
            }
            
            AuthMiddleware::sendResponse(['message' => 'Notificación creada exitosamente'], 201);
        } catch (\Exception $e) {
            error_log('❌ Error creating notification: ' . $e->getMessage());
            error_log('❌ Stack trace: ' . $e->getTraceAsString());
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
            $mensaje = 'El estado del ticket #' . $idTicket . ' ha cambiado de "' . $estatusAnterior . '" a "' . $nuevoEstatus . '"';
            
            // Intentar insertar en diferentes nombres de tabla
            $insertado = false;
            $nombresTabla = ['notificaciones', 'Notificaciones', 'NOTIFICACIONES'];
            
            foreach ($nombresTabla as $nombreTabla) {
                try {
                    $this->db->query(
                        "INSERT INTO `$nombreTabla` (id_usuario, mensaje, tipo, id_ticket, fecha_envio, leida) VALUES (?, ?, ?, ?, NOW(), 0)",
                        [$idUsuario, $mensaje, 'Interna', $idTicket]
                    );
                    $insertado = true;
                    error_log("✅ Notificación de cambio de estado insertada en tabla: $nombreTabla");
                    break;
                } catch (\Exception $e) {
                    if (strpos($e->getMessage(), "doesn't exist") === false && strpos($e->getMessage(), "Unknown table") === false) {
                        // Si es otro tipo de error, lanzarlo
                        throw $e;
                    }
                    // Si es error de tabla no existe, intentar siguiente
                    continue;
                }
            }
            
            if (!$insertado) {
                throw new \Exception("No se pudo insertar notificación: ninguna tabla de notificaciones encontrada");
            }
            
            AuthMiddleware::sendResponse(['message' => 'Notificación de cambio de estado creada exitosamente'], 201);
        } catch (\Exception $e) {
            error_log('❌ Error creating status change notification: ' . $e->getMessage());
            error_log('❌ Stack trace: ' . $e->getTraceAsString());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function markAsRead($id)
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            // Intentar actualizar en diferentes nombres de tabla
            $actualizado = false;
            $nombresTabla = ['notificaciones', 'Notificaciones', 'NOTIFICACIONES'];
            
            foreach ($nombresTabla as $nombreTabla) {
                try {
                    $this->db->query(
                        "UPDATE `$nombreTabla` SET leida = 1 WHERE id_notificacion = ? AND id_usuario = ?",
                        [$id, $user['id_usuario']]
                    );
                    $actualizado = true;
                    break;
                } catch (\Exception $e) {
                    if (strpos($e->getMessage(), "doesn't exist") === false && strpos($e->getMessage(), "Unknown table") === false) {
                        // Si es otro tipo de error, lanzarlo
                        throw $e;
                    }
                    continue;
                }
            }
            
            if (!$actualizado) {
                throw new \Exception("No se pudo actualizar notificación: ninguna tabla de notificaciones encontrada");
            }
            
            AuthMiddleware::sendResponse(['message' => 'Notificación marcada como leída']);
        } catch (\Exception $e) {
            error_log('❌ Error marking notification as read: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function deleteNotification($notificationId)
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            // Intentar eliminar en diferentes nombres de tabla
            $eliminado = false;
            $nombresTabla = ['notificaciones', 'Notificaciones', 'NOTIFICACIONES'];
            
            foreach ($nombresTabla as $nombreTabla) {
                try {
                    $this->db->query(
                        "DELETE FROM `$nombreTabla` WHERE id_notificacion = ? AND id_usuario = ?",
                        [$notificationId, $user['id_usuario']]
                    );
                    $eliminado = true;
                    break;
                } catch (\Exception $e) {
                    if (strpos($e->getMessage(), "doesn't exist") === false && strpos($e->getMessage(), "Unknown table") === false) {
                        // Si es otro tipo de error, lanzarlo
                        throw $e;
                    }
                    continue;
                }
            }
            
            if (!$eliminado) {
                throw new \Exception("No se pudo eliminar notificación: ninguna tabla de notificaciones encontrada");
            }
            
            AuthMiddleware::sendResponse(['message' => 'Notificación eliminada exitosamente']);
        } catch (\Exception $e) {
            error_log('❌ Error deleting notification: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}

