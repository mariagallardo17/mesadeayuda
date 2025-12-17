<?php
/**
 * Script para verificar el formato de los correos en la base de datos
 * Accede desde: https://atiendeti.com/api/verificar-correos-bd.php
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

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    // Obtener todos los usuarios con sus correos
    $stmt = $pdo->query('SELECT id_usuario, nombre, correo, rol FROM usuarios ORDER BY nombre');
    $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificar Correos en BD</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 20px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #1976D2; border-bottom: 3px solid #1976D2; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: bold; }
        .valid { color: #28a745; }
        .invalid { color: #dc3545; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .badge { padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
        .badge-valid { background: #d4edda; color: #155724; }
        .badge-invalid { background: #f8d7da; color: #721c24; }
        .badge-warning { background: #fff3cd; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📧 Verificación de Correos en Base de Datos</h1>';

    $totalUsuarios = count($usuarios);
    $correosValidos = 0;
    $correosInvalidos = 0;
    $correosConProblemas = [];

    echo '<div class="info">';
    echo '<strong>Total de usuarios:</strong> ' . $totalUsuarios;
    echo '</div>';

    echo '<table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Correo Original</th>
                    <th>Correo Normalizado</th>
                    <th>Estado</th>
                    <th>Problemas</th>
                </tr>
            </thead>
            <tbody>';

    foreach ($usuarios as $usuario) {
        $correoOriginal = $usuario['correo'] ?? '';
        $correoNormalizado = trim(strtolower($correoOriginal));
        $esValido = !empty($correoNormalizado) && filter_var($correoNormalizado, FILTER_VALIDATE_EMAIL);
        $problemas = [];

        // Detectar problemas
        if (empty($correoOriginal)) {
            $problemas[] = 'Correo vacío';
        } else {
            if ($correoOriginal !== $correoNormalizado) {
                $problemas[] = 'Tiene mayúsculas o espacios';
            }
            if (strpos($correoOriginal, ' ') !== false) {
                $problemas[] = 'Contiene espacios';
            }
            if ($correoOriginal !== strtolower($correoOriginal)) {
                $problemas[] = 'Tiene mayúsculas';
            }
            if (!filter_var($correoNormalizado, FILTER_VALIDATE_EMAIL)) {
                $problemas[] = 'Formato inválido';
            }
        }

        if ($esValido) {
            $correosValidos++;
        } else {
            $correosInvalidos++;
            $correosConProblemas[] = $usuario;
        }

        $estadoClass = $esValido ? 'valid' : 'invalid';
        $estadoBadge = $esValido ? '<span class="badge badge-valid">VÁLIDO</span>' : '<span class="badge badge-invalid">INVÁLIDO</span>';

        echo '<tr>
                <td>' . htmlspecialchars($usuario['id_usuario']) . '</td>
                <td>' . htmlspecialchars($usuario['nombre']) . '</td>
                <td>' . htmlspecialchars($usuario['rol']) . '</td>
                <td><code>' . htmlspecialchars($correoOriginal) . '</code></td>
                <td><code>' . htmlspecialchars($correoNormalizado) . '</code></td>
                <td class="' . $estadoClass . '">' . $estadoBadge . '</td>
                <td>' . (!empty($problemas) ? '<span class="badge badge-warning">' . implode(', ', $problemas) . '</span>' : '-') . '</td>
              </tr>';
    }

    echo '</tbody></table>';

    echo '<div class="info">';
    echo '<strong>Resumen:</strong><br>';
    echo '✅ Correos válidos: ' . $correosValidos . '<br>';
    echo '❌ Correos inválidos: ' . $correosInvalidos . '<br>';
    echo '</div>';

    if (!empty($correosConProblemas)) {
        echo '<div class="warning">';
        echo '<strong>⚠️ Usuarios con correos problemáticos:</strong><br>';
        foreach ($correosConProblemas as $usuario) {
            echo '- ' . htmlspecialchars($usuario['nombre']) . ' (' . htmlspecialchars($usuario['correo'] ?? 'SIN CORREO') . ')<br>';
        }
        echo '</div>';
    }

    echo '</div></body></html>';

} catch (Exception $e) {
    echo '<div class="error">❌ Error: ' . htmlspecialchars($e->getMessage()) . '</div>';
}

