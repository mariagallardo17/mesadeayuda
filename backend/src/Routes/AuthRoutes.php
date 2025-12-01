<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Services\EmailService;
use Firebase\JWT\JWT;

class AuthRoutes
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
        $this->router->addRoute('POST', '/auth/login', [$this, 'login']);
        $this->router->addRoute('GET', '/auth/verify', [$this, 'verify']);
        $this->router->addRoute('POST', '/auth/change-password', [$this, 'changePassword']);
        $this->router->addRoute('POST', '/auth/change-temporary-password', [$this, 'changeTemporaryPassword']);
        $this->router->addRoute('POST', '/auth/forgot-password', [$this, 'forgotPassword']);
        $this->router->addRoute('GET', '/auth/profile', [$this, 'getProfile']);
    }
    
    public function login()
    {
        $startTime = microtime(true);
        $body = AuthMiddleware::getRequestBody();
        
        $correo = $body['correo'] ?? '';
        $password = $body['password'] ?? '';
        
        // Quick validations
        if (empty($correo) || empty($password)) {
            AuthMiddleware::sendError('Email y contraseña son requeridos', 400);
        }
        
        if (strlen($password) < 3) {
            AuthMiddleware::sendError('Credenciales inválidas', 401);
        }
        
        try {
            // Find user in database
            $stmt = $this->db->query(
                'SELECT id_usuario, correo, password, rol, nombre, password_temporal, num_empleado, departamento, estatus 
                 FROM Usuarios WHERE correo = ? AND estatus = "Activo"',
                [$correo]
            );
            
            $user = $stmt->fetch();
            
            if (!$user) {
                $elapsed = (microtime(true) - $startTime) * 1000;
                error_log("Login fallido - Usuario no encontrado: $correo ({$elapsed}ms)");
                AuthMiddleware::sendError('Credenciales inválidas', 401);
            }
            
            // Verify password
            if (!password_verify($password, $user['password'])) {
                $elapsed = (microtime(true) - $startTime) * 1000;
                error_log("Login fallido - Contraseña incorrecta: $correo ({$elapsed}ms)");
                AuthMiddleware::sendError('Credenciales inválidas', 401);
            }
            
            // Create JWT token
            $secret = $_ENV['JWT_SECRET'] ?? 'fallback_secret';
            $payload = [
                'id_usuario' => $user['id_usuario'],
                'correo' => $user['correo'],
                'rol' => $user['rol'],
                'nombre' => $user['nombre'],
                'exp' => time() + (24 * 3600) // 24 hours
            ];
            
            $token = JWT::encode($payload, $secret, 'HS256');
            
            // Prepare user response
            $nameParts = explode(' ', $user['nombre']);
            $userResponse = [
                'id' => $user['id_usuario'],
                'num_empleado' => $user['num_empleado'],
                'nombre' => $user['nombre'],
                'apellido' => $nameParts[1] ?? '',
                'departamento' => $user['departamento'],
                'email' => $user['correo'],
                'rol' => strtolower($user['rol']),
                'activo' => $user['estatus'] === 'Activo',
                'password_temporal' => (bool)$user['password_temporal'],
                'fechaCreacion' => date('c')
            ];
            
            $response = [
                'token' => $token,
                'user' => $userResponse,
                'message' => $user['password_temporal'] ? 'Login exitoso - Debe cambiar contraseña' : 'Login exitoso',
                'requiresPasswordChange' => (bool)$user['password_temporal']
            ];
            
            $elapsed = (microtime(true) - $startTime) * 1000;
            error_log("Login exitoso: $correo ({$elapsed}ms)");
            
            AuthMiddleware::sendResponse($response);
            
        } catch (\Exception $e) {
            $elapsed = (microtime(true) - $startTime) * 1000;
            error_log("Error en login: {$correo} ({$elapsed}ms) - " . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function verify()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            // Find updated user
            $stmt = $this->db->query(
                'SELECT * FROM Usuarios WHERE id_usuario = ?',
                [$user['id_usuario']]
            );
            
            $userData = $stmt->fetch();
            
            if (!$userData) {
                AuthMiddleware::sendError('Usuario no encontrado', 404);
            }
            
            $nameParts = explode(' ', $userData['nombre']);
            $userResponse = [
                'id' => $userData['id_usuario'],
                'num_empleado' => $userData['num_empleado'],
                'nombre' => $userData['nombre'],
                'apellido' => $nameParts[1] ?? '',
                'departamento' => $userData['departamento'],
                'correo' => $userData['correo'],
                'rol' => strtolower($userData['rol']),
                'estatus' => $userData['estatus']
            ];
            
            AuthMiddleware::sendResponse(['user' => $userResponse]);
            
        } catch (\Exception $e) {
            error_log('Error verificando token: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function changePassword()
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $currentPassword = $body['currentPassword'] ?? '';
        $newPassword = $body['newPassword'] ?? '';
        
        if (empty($currentPassword) || empty($newPassword)) {
            AuthMiddleware::sendError('Contraseña actual y nueva contraseña son requeridas', 400);
        }
        
        // Validate new password
        $validation = $this->validatePassword($newPassword);
        if (!$validation['valid']) {
            AuthMiddleware::sendError($validation['error'], 400);
        }
        
        try {
            // Find user
            $stmt = $this->db->query(
                'SELECT password FROM Usuarios WHERE id_usuario = ?',
                [$user['id_usuario']]
            );
            
            $userData = $stmt->fetch();
            
            if (!$userData) {
                AuthMiddleware::sendError('Usuario no encontrado', 404);
            }
            
            // Verify current password
            if (!password_verify($currentPassword, $userData['password'])) {
                AuthMiddleware::sendError('La contraseña actual es incorrecta', 401);
            }
            
            // Hash new password
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            
            // Update password
            $this->db->query(
                'UPDATE Usuarios SET password = ?, password_temporal = FALSE, fecha_ultimo_cambio = NOW() WHERE id_usuario = ?',
                [$hashedPassword, $user['id_usuario']]
            );
            
            AuthMiddleware::sendResponse(['message' => 'Contraseña actualizada exitosamente']);
            
        } catch (\Exception $e) {
            error_log('Error cambiando contraseña: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function changeTemporaryPassword()
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();
        
        $newPassword = $body['newPassword'] ?? '';
        
        if (empty($newPassword)) {
            AuthMiddleware::sendError('La nueva contraseña es requerida', 400);
        }
        
        // Validate new password
        $validation = $this->validatePassword($newPassword);
        if (!$validation['valid']) {
            AuthMiddleware::sendError($validation['error'], 400);
        }
        
        try {
            // Verify user has temporary password
            $stmt = $this->db->query(
                'SELECT password_temporal FROM Usuarios WHERE id_usuario = ?',
                [$user['id_usuario']]
            );
            
            $userData = $stmt->fetch();
            
            if (!$userData) {
                AuthMiddleware::sendError('Usuario no encontrado', 404);
            }
            
            if (!$userData['password_temporal']) {
                AuthMiddleware::sendError('Este usuario no tiene contraseña temporal', 400);
            }
            
            // Hash new password
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            
            // Update password
            $this->db->query(
                'UPDATE Usuarios SET password = ?, password_temporal = FALSE, fecha_ultimo_cambio = NOW() WHERE id_usuario = ?',
                [$hashedPassword, $user['id_usuario']]
            );
            
            AuthMiddleware::sendResponse([
                'message' => 'Contraseña temporal cambiada exitosamente',
                'requiresPasswordChange' => false
            ]);
            
        } catch (\Exception $e) {
            error_log('Error cambiando contraseña temporal: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function forgotPassword()
    {
        $body = AuthMiddleware::getRequestBody();
        $correo = $body['correo'] ?? '';
        
        if (empty($correo)) {
            AuthMiddleware::sendError('El campo correo es obligatorio.', 400);
        }
        
        try {
            // Find active user
            $stmt = $this->db->query(
                'SELECT id_usuario, nombre, correo FROM Usuarios WHERE correo = ? AND estatus = "Activo"',
                [$correo]
            );
            
            $user = $stmt->fetch();
            
            if (!$user) {
                AuthMiddleware::sendError('No se encontró ningún usuario con ese correo.', 404);
            }
            
            // Generate random temporary password
            $nuevaPassword = substr(str_shuffle('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 8) . '!';
            $hashedPassword = password_hash($nuevaPassword, PASSWORD_DEFAULT);
            
            // Update password and mark as temporary
            $this->db->query(
                'UPDATE Usuarios SET password = ?, password_temporal = TRUE, fecha_ultimo_cambio = NOW() WHERE id_usuario = ?',
                [$hashedPassword, $user['id_usuario']]
            );
            
            // Send email in background (async simulation)
            $emailService = new EmailService();
            $baseUrl = $_ENV['FRONTEND_URL'] ?? 'http://localhost:4200';
            $loginUrl = "$baseUrl/login";
            
            $html = $this->generatePasswordRecoveryEmail($user['nombre'], $nuevaPassword, $loginUrl);
            
            // Send email (non-blocking)
            try {
                $emailService->sendEmail($user['correo'], 'Recuperación de contraseña - Mesa de Ayuda', $html);
                error_log("📧 Correo de recuperación enviado a {$user['correo']}");
            } catch (\Exception $e) {
                error_log("❌ Error enviando correo de recuperación: " . $e->getMessage());
            }
            
            AuthMiddleware::sendResponse([
                'message' => 'Se ha enviado una contraseña temporal a su correo. Revíselo e inicie sesión para cambiar la contraseña.'
            ]);
            
        } catch (\Exception $e) {
            error_log('Error en recuperación de contraseña: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    
    public function getProfile()
    {
        $user = AuthMiddleware::authenticate();
        
        AuthMiddleware::sendResponse([
            'success' => true,
            'user' => [
                'id' => $user['id_usuario'],
                'nombre' => $user['nombre'],
                'correo' => $user['correo'],
                'rol' => $user['rol'],
                'num_empleado' => $user['num_empleado'] ?? null,
                'departamento' => $user['departamento'] ?? null
            ]
        ]);
    }
    
    private function validatePassword($password)
    {
        if (empty($password) || !is_string($password)) {
            return ['valid' => false, 'error' => 'La contraseña es requerida'];
        }
        
        if (strlen($password) < 7) {
            return ['valid' => false, 'error' => 'La contraseña debe tener al menos 7 caracteres'];
        }
        
        if (!preg_match('/[A-Z]/', $password)) {
            return ['valid' => false, 'error' => 'La contraseña debe contener al menos una letra mayúscula'];
        }
        
        if (!preg_match('/[0-9]/', $password)) {
            return ['valid' => false, 'error' => 'La contraseña debe contener al menos un número'];
        }
        
        if (!preg_match('/[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]/', $password)) {
            return ['valid' => false, 'error' => 'La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)'];
        }
        
        return ['valid' => true];
    }
    
    private function generatePasswordRecoveryEmail($nombre, $password, $loginUrl)
    {
        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Recuperación de contraseña - Mesa de Ayuda</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
  <div style="max-width: 500px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
    <h2 style="text-align: center; color: #1976D2; margin-bottom: 10px;">Recuperación de contraseña</h2>
    <hr style="border:none; border-top:2px solid #1976D2; margin-bottom: 30px;">
    <p>Hola <strong>$nombre</strong>:</p>
    <p>Se ha solicitado el restablecimiento del acceso a tu cuenta.</p>
    <div style="background: #e3f2fd; border-left: 6px solid #1976D2; padding: 25px 20px; margin: 25px 0; text-align: center;">
      <span>Tu <strong style="font-size:19px">NUEVA CONTRASEÑA TEMPORAL</strong> es:</span><br>
      <span style="font-size: 28px; font-weight: bold; color: #d32f2f; background:#fbe9e7; padding:8px 28px; border-radius:6px; display:inline-block; letter-spacing:2px; margin: 10px 0;">$password</span>
      <div style="font-size:13px;margin-top:12px;color:#b71c1c;">Recuerda: Esta contraseña es válida por único uso, deberás cambiarla apenas ingreses al sistema.</div>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="$loginUrl" style="background-color: #1976D2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ir a Iniciar Sesión</a>
    </div>
    <p style="color: #333; text-align: center; font-size: 14px;">O copia y pega este enlace en tu navegador:<br><a href="$loginUrl" style="color: #1976D2; word-break: break-all;">$loginUrl</a></p>
    <p style="color: #333;">Si NO solicitaste este cambio, por favor IGNORA este mensaje.</p>
    <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
    <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
  </div>
</body>
</html>
HTML;
    }
}
