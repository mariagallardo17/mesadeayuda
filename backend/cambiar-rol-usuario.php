<?php
/**
 * Script de emergencia para cambiar el rol de un usuario
 * Accede desde: https://atiendeti.com/api/cambiar-rol-usuario.php?email=correo@ejemplo.com&rol=administrador
 * 
 * ⚠️ IMPORTANTE: Elimina este archivo después de usarlo por seguridad
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\Config\Database;

// Cargar variables de entorno
$envPaths = [
    __DIR__,
    __DIR__ . '/api',
    dirname(__DIR__) . '/api',
];

$envLoaded = false;
foreach ($envPaths as $envPath) {
    $envFile = $envPath . '/.env';
    if (file_exists($envFile)) {
        $dotenv = Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
        $envLoaded = true;
        break;
    }
}

if (!$envLoaded) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->safeLoad();
}

header('Content-Type: text/html; charset=UTF-8');

// Obtener parámetros
$email = $_GET['email'] ?? '';
$rol = $_GET['rol'] ?? 'administrador';

// Validar parámetros
if (empty($email)) {
    echo '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cambiar Rol de Usuario</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #1976D2; border-bottom: 3px solid #1976D2; padding-bottom: 10px; }
        .form-group { margin: 20px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select { width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 16px; }
        .btn { background: #1976D2; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; width: 100%; }
        .btn:hover { background: #1565C0; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Cambiar Rol de Usuario</h1>
        <div class="warning">
            <strong>⚠️ ADVERTENCIA:</strong> Este script es de emergencia. Elimínalo después de usarlo por seguridad.
        </div>
        <form method="GET">
            <div class="form-group">
                <label for="email">Correo del Usuario:</label>
                <input type="email" id="email" name="email" required placeholder="correo@ejemplo.com">
            </div>
            <div class="form-group">
                <label for="rol">Nuevo Rol:</label>
                <select id="rol" name="rol" required>
                    <option value="administrador" selected>Administrador</option>
                    <option value="tecnico">Técnico</option>
                    <option value="empleado">Empleado</option>
                </select>
            </div>
            <button type="submit" class="btn">Cambiar Rol</button>
        </form>
    </div>
</body>
</html>';
    exit;
}

// Validar rol
$rolesValidos = ['administrador', 'tecnico', 'empleado'];
if (!in_array($rol, $rolesValidos)) {
    die('<div class="error">❌ Rol inválido. Los roles válidos son: administrador, tecnico, empleado</div>');
}

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    // Buscar usuario por correo
    $stmt = $pdo->prepare('SELECT id_usuario, nombre, correo, rol FROM usuarios WHERE correo = ?');
    $stmt->execute([$email]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario) {
        die('<div class="error">❌ Usuario no encontrado con el correo: ' . htmlspecialchars($email) . '</div>');
    }

    // Actualizar rol
    $stmt = $pdo->prepare('UPDATE usuarios SET rol = ? WHERE correo = ?');
    $result = $stmt->execute([$rol, $email]);

    if ($result) {
        echo '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rol Actualizado</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #4CAF50; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ Rol Actualizado Exitosamente</h1>
        <div class="success">
            <strong>✅ El rol del usuario ha sido actualizado correctamente.</strong>
        </div>
        <table>
            <tr>
                <th>Campo</th>
                <th>Valor</th>
            </tr>
            <tr>
                <td>ID Usuario</td>
                <td>' . htmlspecialchars($usuario['id_usuario']) . '</td>
            </tr>
            <tr>
                <td>Nombre</td>
                <td>' . htmlspecialchars($usuario['nombre']) . '</td>
            </tr>
            <tr>
                <td>Correo</td>
                <td>' . htmlspecialchars($usuario['correo']) . '</td>
            </tr>
            <tr>
                <td>Rol Anterior</td>
                <td>' . htmlspecialchars($usuario['rol']) . '</td>
            </tr>
            <tr>
                <td>Rol Nuevo</td>
                <td><strong>' . htmlspecialchars($rol) . '</strong></td>
            </tr>
        </table>
        <div class="info">
            <strong>📝 Próximos pasos:</strong><br>
            1. El usuario debe cerrar sesión y volver a iniciar sesión para que los cambios surtan efecto.<br>
            2. O puede usar el sistema normalmente, el rol se actualizará en su próxima sesión.
        </div>
        <div class="warning">
            <strong>⚠️ IMPORTANTE:</strong> Elimina este archivo (cambiar-rol-usuario.php) después de usarlo por seguridad.
        </div>
    </div>
</body>
</html>';
    } else {
        throw new Exception('No se pudo actualizar el rol');
    }

} catch (Exception $e) {
    echo '<div class="error">❌ Error: ' . htmlspecialchars($e->getMessage()) . '</div>';
}

