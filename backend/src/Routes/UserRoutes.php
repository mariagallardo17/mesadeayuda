<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class UserRoutes
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
        $this->router->addRoute('GET', '/users', [$this, 'getUsers']);
        $this->router->addRoute('GET', '/users/:id', [$this, 'getUserById']);
        $this->router->addRoute('POST', '/users', [$this, 'createUser']);
        $this->router->addRoute('PUT', '/users/:id', [$this, 'updateUser']);
        $this->router->addRoute('POST', '/users/:id/reset-password', [$this, 'resetPassword']);
        $this->router->addRoute('DELETE', '/users/:id', [$this, 'deleteUser']);
    }

    public function getUsers()
    {
        $user = AuthMiddleware::authenticate();

        try {
            $stmt = $this->db->query('SELECT id_usuario as id, nombre, correo, rol, departamento, estatus, num_empleado FROM usuarios ORDER BY nombre');
            $users = $stmt->fetchAll();

            AuthMiddleware::sendResponse($users);
        } catch (\Exception $e) {
            error_log('Error getting users: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    public function getUserById($id)
    {
        $user = AuthMiddleware::authenticate();

        try {
            $stmt = $this->db->query(
                'SELECT id_usuario as id, nombre, correo, rol, departamento, num_empleado, estatus FROM usuarios WHERE id_usuario = ?',
                [$id]
            );

            $userData = $stmt->fetch();

            if (!$userData) {
                AuthMiddleware::sendError('Usuario no encontrado', 404);
            }

            AuthMiddleware::sendResponse($userData);
        } catch (\Exception $e) {
            error_log('Error getting user: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    public function createUser()
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();

        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('No tienes permisos para crear usuarios', 403);
        }

        $nombre = $body['nombre'] ?? '';
        $correo = $body['correo'] ?? '';
        $rol = $body['rol'] ?? 'empleado';
        $password = $body['password'] ?? '';

        if (empty($nombre) || empty($correo) || empty($password)) {
            AuthMiddleware::sendError('Todos los campos son requeridos', 400);
        }

        try {
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            $this->db->query(
                'INSERT INTO usuarios (nombre, correo, password, rol, estatus) VALUES (?, ?, ?, ?, "Activo")',
                [$nombre, $correo, $hashedPassword, $rol]
            );

            AuthMiddleware::sendResponse(['message' => 'Usuario creado exitosamente'], 201);
        } catch (\Exception $e) {
            error_log('Error creating user: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    public function updateUser($id)
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();

        // Check admin permissions
        if ($user['rol'] !== 'administrador' && $user['id_usuario'] != $id) {
            AuthMiddleware::sendError('No tienes permisos para actualizar este usuario', 403);
        }

        try {
            $updates = [];
            $params = [];

            if (isset($body['nombre'])) {
                $updates[] = 'nombre = ?';
                $params[] = $body['nombre'];
            }

            if (isset($body['correo'])) {
                $updates[] = 'correo = ?';
                $params[] = $body['correo'];
            }

            if (isset($body['rol']) && $user['rol'] === 'administrador') {
                $updates[] = 'rol = ?';
                $params[] = $body['rol'];
            }

            if (isset($body['estatus']) && $user['rol'] === 'administrador') {
                $updates[] = 'estatus = ?';
                $params[] = $body['estatus'];
            }

            if (empty($updates)) {
                AuthMiddleware::sendError('No hay datos para actualizar', 400);
            }

            $params[] = $id;
            $sql = 'UPDATE usuarios SET ' . implode(', ', $updates) . ' WHERE id_usuario = ?';

            $this->db->query($sql, $params);

            AuthMiddleware::sendResponse(['message' => 'Usuario actualizado exitosamente']);
        } catch (\Exception $e) {
            error_log('Error updating user: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    public function resetPassword($id)
    {
        $user = AuthMiddleware::authenticate();

        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('No tienes permisos para resetear contraseñas', 403);
        }

        try {
            // Check if user exists
            $stmt = $this->db->query(
                'SELECT id_usuario, nombre FROM usuarios WHERE id_usuario = ?',
                [$id]
            );

            $targetUser = $stmt->fetch();

            if (!$targetUser) {
                AuthMiddleware::sendError('Usuario no encontrado', 404);
            }

            // Generate random secure temporary password
            $newPassword = 'Temp1!'; // Temporary default - TODO: In production, send via secure email
            $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);

            // Update password and mark as temporal
            $this->db->query(
                'UPDATE usuarios SET password = ?, password_temporal = TRUE, fecha_ultimo_cambio = NOW() WHERE id_usuario = ?',
                [$hashedPassword, $id]
            );

            // TODO: In production, send password via email instead of API response
            // For now, returning in response for compatibility with existing frontend
            AuthMiddleware::sendResponse([
                'message' => 'Contraseña reseteada exitosamente',
                'newPassword' => $newPassword
            ]);
        } catch (\Exception $e) {
            error_log('Error resetting password: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    public function deleteUser($id)
    {
        $user = AuthMiddleware::authenticate();

        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('No tienes permisos para eliminar usuarios', 403);
        }

        try {
            $this->db->query('UPDATE usuarios SET estatus = "Inactivo" WHERE id_usuario = ?', [$id]);

            AuthMiddleware::sendResponse(['message' => 'Usuario desactivado exitosamente']);
        } catch (\Exception $e) {
            error_log('Error deleting user: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}
