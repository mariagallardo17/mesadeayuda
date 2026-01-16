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

        // Verificar que el usuario sea administrador - verificar directamente en BD (más confiable)
        $userId = $user['id_usuario'] ?? null;

        if (!$userId) {
            error_log("❌ No se pudo obtener el ID del usuario del token");
            AuthMiddleware::sendError('Error de autenticación', 401);
        }

        error_log("🔍 Verificando permisos para usuario ID: $userId");
        error_log("🔍 Rol en JWT: '" . ($user['rol'] ?? 'NULL') . "'");

        // Verificar el rol directamente en la base de datos (más confiable que el JWT)
        try {
            $stmt = $this->db->query(
                'SELECT rol FROM usuarios WHERE id_usuario = ?',
                [$userId]
            );
            $dbUser = $stmt->fetch();

            if (!$dbUser) {
                error_log("❌ Usuario no encontrado en BD con ID: $userId");
                AuthMiddleware::sendError('Usuario no encontrado', 404);
            }

            $dbRol = strtolower(trim($dbUser['rol'] ?? ''));
            error_log("🔍 Rol en base de datos: '" . ($dbUser['rol'] ?? 'NULL') . "' (normalizado: '$dbRol')");

            // Verificar si es administrador (comparación flexible)
            if ($dbRol !== 'administrador') {
                error_log("❌ Acceso denegado - El usuario no es administrador.");
                error_log("❌ Rol en BD: '" . ($dbUser['rol'] ?? 'NULL') . "' (normalizado: '$dbRol')");
                AuthMiddleware::sendError('No tienes permisos para ver la lista de usuarios. Se requiere rol de administrador. Tu rol actual: ' . ($dbUser['rol'] ?? 'desconocido'), 403);
            }

            error_log("✅ Usuario verificado como administrador en BD");

        } catch (\Exception $e) {
            error_log("❌ Error verificando permisos: " . $e->getMessage());
            AuthMiddleware::sendError('Error al verificar permisos', 500);
        }

        error_log("✅ Obteniendo lista de usuarios...");

        try {
            // Consulta simple para obtener todos los usuarios (probar ambas variantes de nombre de tabla)
            // En algunos servidores las tablas pueden estar en mayúsculas
            $sql = 'SELECT id_usuario as id, nombre, correo, rol, departamento, estatus, num_empleado FROM usuarios ORDER BY nombre';
            error_log("📝 Ejecutando SQL: $sql");

            // Verificar si la tabla existe
            try {
                $testStmt = $this->db->query('SHOW TABLES LIKE "usuarios"');
                $tableExists = $testStmt->fetch();
                if (!$tableExists) {
                    // Intentar con mayúscula
                    $testStmt = $this->db->query('SHOW TABLES LIKE "Usuarios"');
                    $tableExists = $testStmt->fetch();
                    if ($tableExists) {
                        error_log("⚠️ Tabla encontrada como 'Usuarios' (mayúscula), ajustando consulta...");
                        $sql = 'SELECT id_usuario as id, nombre, correo, rol, departamento, estatus, num_empleado FROM Usuarios ORDER BY nombre';
                    }
                }
            } catch (\Exception $e) {
                error_log("⚠️ No se pudo verificar nombre de tabla: " . $e->getMessage());
            }

            $stmt = $this->db->query($sql);
            $users = $stmt->fetchAll();

            error_log("📊 Usuarios encontrados en BD: " . count($users));

            if (count($users) === 0) {
                error_log("⚠️ No se encontraron usuarios en la base de datos");
                AuthMiddleware::sendResponse([]);
                return;
            }

            // Formatear usuarios para el frontend (separar nombre y apellido)
            $formattedUsers = [];
            foreach ($users as $userData) {
                $nameParts = explode(' ', $userData['nombre'], 2);
                $formattedUser = [
                    'id' => (int)$userData['id'],
                    'num_empleado' => $userData['num_empleado'] ?? null,
                    'nombre' => $nameParts[0] ?? $userData['nombre'],
                    'apellido' => $nameParts[1] ?? '',
                    'departamento' => $userData['departamento'] ?? '',
                    'correo' => $userData['correo'],
                    'rol' => strtolower(trim($userData['rol'] ?? 'empleado')),
                    'activo' => ($userData['estatus'] ?? '') === 'Activo'
                ];
                $formattedUsers[] = $formattedUser;
                error_log("👤 Usuario formateado: ID={$formattedUser['id']}, Nombre={$formattedUser['nombre']}, Rol={$formattedUser['rol']}");
            }

            error_log("✅ Usuarios formateados para envío: " . count($formattedUsers));
            error_log("📤 Enviando respuesta JSON con " . count($formattedUsers) . " usuarios");

            // Enviar respuesta
            AuthMiddleware::sendResponse($formattedUsers);
        } catch (\Exception $e) {
            error_log('❌ Error getting users: ' . $e->getMessage());
            error_log('❌ Stack trace: ' . $e->getTraceAsString());
            AuthMiddleware::sendError('Error interno del servidor: ' . $e->getMessage(), 500);
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

        // Verificar permisos de administrador - verificar directamente en BD (más confiable)
        $userId = $user['id_usuario'] ?? null;

        if (!$userId) {
            error_log("❌ No se pudo obtener el ID del usuario del token");
            AuthMiddleware::sendError('Error de autenticación', 401);
        }

        error_log("🔍 Verificando permisos para crear usuario - Usuario ID: $userId");

        // Verificar el rol directamente en la base de datos
        try {
            $stmt = $this->db->query(
                'SELECT rol FROM usuarios WHERE id_usuario = ?',
                [$userId]
            );
            $dbUser = $stmt->fetch();

            if (!$dbUser) {
                error_log("❌ Usuario no encontrado en BD con ID: $userId");
                AuthMiddleware::sendError('Usuario no encontrado', 404);
            }

            $dbRol = strtolower(trim($dbUser['rol'] ?? ''));
            error_log("🔍 Rol en base de datos: '" . ($dbUser['rol'] ?? 'NULL') . "' (normalizado: '$dbRol')");

            if ($dbRol !== 'administrador') {
                error_log("❌ Acceso denegado - El usuario no es administrador.");
                AuthMiddleware::sendError('No tienes permisos para crear usuarios. Se requiere rol de administrador.', 403);
            }

            error_log("✅ Usuario verificado como administrador en BD");

        } catch (\Exception $e) {
            error_log("❌ Error verificando permisos: " . $e->getMessage());
            AuthMiddleware::sendError('Error al verificar permisos', 500);
        }

        $nombre = $body['nombre'] ?? '';
        $correo = $body['correo'] ?? '';
        $rol = $body['rol'] ?? 'empleado';
        $password = $body['password'] ?? '';
        $departamento = $body['departamento'] ?? '';
        $numEmpleado = $body['num_empleado'] ?? '';

        if (empty($nombre) || empty($correo) || empty($password)) {
            AuthMiddleware::sendError('Todos los campos son requeridos', 400);
        }

        try {
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            $this->db->query(
                'INSERT INTO usuarios (nombre, correo, password, rol, estatus, departamento, num_empleado) VALUES (?, ?, ?, ?, "Activo", ?, ?)',
                [$nombre, $correo, $hashedPassword, $rol, $departamento, $numEmpleado]
            );

            $userId = $this->db->getConnection()->lastInsertId();

            // Obtener el usuario creado
            $stmt = $this->db->query(
                'SELECT id_usuario as id, nombre, correo, rol, departamento, estatus, num_empleado FROM usuarios WHERE id_usuario = ?',
                [$userId]
            );

            $newUser = $stmt->fetch();

            // Mapear al formato que espera el frontend
            $nameParts = explode(' ', $newUser['nombre']);
            $userResponse = [
                'id' => $newUser['id'],
                'num_empleado' => $newUser['num_empleado'] ?? null,
                'nombre' => $newUser['nombre'],
                'apellido' => $nameParts[1] ?? '',
                'departamento' => $newUser['departamento'] ?? '',
                'correo' => $newUser['correo'],
                'rol' => strtolower($newUser['rol']),
                'activo' => $newUser['estatus'] === 'Activo',
                'password_temporal' => false,
                'fechaCreacion' => date('c')
            ];

            AuthMiddleware::sendResponse(['message' => 'Usuario creado exitosamente', 'user' => $userResponse], 201);
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

        // Prevenir que el administrador cambie su propio rol
        $userId = $user['id_usuario'] ?? null;
        if ($userId && (int)$userId === (int)$id) {
            // Obtener el rol actual del usuario desde la BD
            $stmt = $this->db->query(
                'SELECT rol FROM usuarios WHERE id_usuario = ?',
                [$id]
            );
            $currentUser = $stmt->fetch();

            if ($currentUser && strtolower(trim($currentUser['rol'])) === 'administrador') {
                // Si intenta cambiar su propio rol siendo administrador, prevenir
                if (isset($body['rol']) && strtolower(trim($body['rol'])) !== 'administrador') {
                    AuthMiddleware::sendError('No puedes cambiar tu propio rol. El administrador siempre debe mantener su rol de administrador.', 403);
                }
            }
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
                // Verificar nuevamente que no sea el administrador actual cambiando su propio rol
                if ($userId && (int)$userId === (int)$id) {
                    $stmt = $this->db->query(
                        'SELECT rol FROM usuarios WHERE id_usuario = ?',
                        [$id]
                    );
                    $currentUser = $stmt->fetch();
                    if ($currentUser && strtolower(trim($currentUser['rol'])) === 'administrador' && strtolower(trim($body['rol'])) !== 'administrador') {
                        AuthMiddleware::sendError('No puedes cambiar tu propio rol. El administrador siempre debe mantener su rol de administrador.', 403);
                    }
                }
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

        // Prevenir que el administrador elimine su propia cuenta
        $userId = $user['id_usuario'] ?? null;
        if ($userId && (int)$userId === (int)$id) {
            // Verificar que sea administrador
            $stmt = $this->db->query(
                'SELECT rol FROM usuarios WHERE id_usuario = ?',
                [$id]
            );
            $targetUser = $stmt->fetch();

            if ($targetUser && strtolower(trim($targetUser['rol'])) === 'administrador') {
                AuthMiddleware::sendError('No puedes eliminar tu propia cuenta. El administrador no puede ser eliminado.', 403);
            }
        }

        try {
            // Verificar si el usuario existe
            $stmt = $this->db->query(
                'SELECT id_usuario, rol FROM usuarios WHERE id_usuario = ?',
                [$id]
            );
            $targetUser = $stmt->fetch();

            if (!$targetUser) {
                AuthMiddleware::sendError('Usuario no encontrado', 404);
                return;
            }

            $userRol = strtolower(trim($targetUser['rol']));

            // No permitir eliminar administradores (super usuarios)
            if ($userRol === 'administrador') {
                AuthMiddleware::sendError('No se puede eliminar un usuario administrador. Los administradores son super usuarios y no pueden ser eliminados.', 403);
                return;
            }

            // No permitir eliminar técnicos
            if ($userRol === 'tecnico') {
                AuthMiddleware::sendError('No se pueden eliminar usuarios técnicos. Considera desactivarlos en lugar de eliminarlos.', 403);
                return;
            }

            // Verificar si el usuario tiene tickets asociados
            $stmtTickets = $this->db->query(
                'SELECT COUNT(*) as count FROM tickets WHERE id_usuario = ?',
                [$id]
            );
            $ticketCount = $stmtTickets->fetch();
            $hasTickets = $ticketCount && (int)$ticketCount['count'] > 0;

            if ($hasTickets) {
                AuthMiddleware::sendError('No se puede eliminar el usuario porque tiene tickets asociados. Considera desactivarlo en lugar de eliminarlo.', 400);
                return;
            }

            // Si llegamos aquí, el usuario no es administrador, no es técnico y no tiene tickets
            // Proceder a eliminar
            $this->db->query('DELETE FROM usuarios WHERE id_usuario = ?', [$id]);

            AuthMiddleware::sendResponse(['message' => 'Usuario eliminado exitosamente']);
        } catch (\Exception $e) {
            error_log('Error deleting user: ' . $e->getMessage());
            error_log('Stack trace: ' . $e->getTraceAsString());

            // Si hay error de foreign key, informar al usuario
            if (strpos($e->getMessage(), 'FOREIGN KEY') !== false || strpos($e->getMessage(), '1451') !== false) {
                AuthMiddleware::sendError('No se puede eliminar el usuario porque tiene tickets, reaperturas o evaluaciones asociadas. Considera desactivarlo en lugar de eliminarlo.', 400);
            } else {
                AuthMiddleware::sendError('Error interno del servidor: ' . $e->getMessage(), 500);
            }
        }
    }
}
