<?php
/**
 * Script para probar diferentes credenciales de base de datos
 * Accede desde: https://atiendeti.com/api/test-db-connection.php
 * 
 * ⚠️ IMPORTANTE: Elimina este archivo después de usarlo por seguridad
 */

header('Content-Type: text/html; charset=utf-8');

// Lista de credenciales comunes a probar
$configuraciones = [
    [
        'host' => 'localhost',
        'dbname' => 'lugiadar_atiendeti',
        'user' => 'lugiadar_atiendeti',
        'password' => ']87yvDDS!!AR@o[',
        'descripcion' => 'Configuración actual'
    ],
    // Agrega más configuraciones aquí si las conoces
    // Ejemplo:
    // [
    //     'host' => 'localhost',
    //     'dbname' => 'atiendeti',
    //     'user' => 'atiendeti_user',
    //     'password' => 'otra_contraseña',
    //     'descripcion' => 'Configuración alternativa'
    // ],
];

echo "<!DOCTYPE html>
<html>
<head>
    <title>Test de Conexión a Base de Datos</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; margin: 10px 0; border-radius: 5px; }
        h1 { color: #333; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🔍 Test de Conexión a Base de Datos</h1>
    <p><strong>⚠️ IMPORTANTE:</strong> Elimina este archivo después de usarlo por seguridad.</p>
    <hr>";

$conexionExitosa = false;

foreach ($configuraciones as $config) {
    echo "<div class='info'>";
    echo "<h3>Probando: {$config['descripcion']}</h3>";
    echo "<pre>";
    echo "Host: {$config['host']}\n";
    echo "Base de datos: {$config['dbname']}\n";
    echo "Usuario: {$config['user']}\n";
    echo "Contraseña: " . str_repeat('*', strlen($config['password'])) . "\n";
    echo "</pre>";
    
    try {
        $dsn = "mysql:host={$config['host']};dbname={$config['dbname']};charset=utf8mb4";
        $pdo = new PDO($dsn, $config['user'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        
        echo "<div class='success'>";
        echo "✅ <strong>¡CONEXIÓN EXITOSA!</strong><br>";
        echo "Estas son las credenciales correctas:<br><br>";
        echo "<strong>Actualiza tu archivo .env con:</strong><br>";
        echo "<pre>";
        echo "DB_HOST={$config['host']}\n";
        echo "DB_PORT=3306\n";
        echo "DB_NAME={$config['dbname']}\n";
        echo "DB_USER={$config['user']}\n";
        echo "DB_PASSWORD={$config['password']}\n";
        echo "</pre>";
        
        // Probar si existe la tabla usuarios
        try {
            $stmt = $pdo->query("SHOW TABLES LIKE 'usuarios'");
            if ($stmt->rowCount() > 0) {
                echo "<br>✅ La tabla 'usuarios' existe en la base de datos.";
            } else {
                echo "<br>⚠️ La tabla 'usuarios' NO existe. Necesitas importar database.sql";
            }
        } catch (Exception $e) {
            echo "<br>⚠️ No se pudo verificar la tabla: " . $e->getMessage();
        }
        
        echo "</div>";
        $conexionExitosa = true;
        break;
        
    } catch (PDOException $e) {
        echo "<div class='error'>";
        echo "❌ Error: " . $e->getMessage() . "<br>";
        echo "Código: " . $e->getCode();
        echo "</div>";
    }
    
    echo "</div><hr>";
}

if (!$conexionExitosa) {
    echo "<div class='error'>";
    echo "<h3>❌ Ninguna configuración funcionó</h3>";
    echo "<p>Necesitas obtener las credenciales correctas de tu hosting.</p>";
    echo "<p><strong>Opciones:</strong></p>";
    echo "<ul>";
    echo "<li>Contactar a tu proveedor de hosting</li>";
    echo "<li>Buscar archivos de configuración (wp-config.php, config.php) en el servidor</li>";
    echo "<li>Intentar acceder a phpMyAdmin desde el navegador</li>";
    echo "</ul>";
    echo "</div>";
}

echo "<hr>";
echo "<p><strong>⚠️ RECUERDA:</strong> Elimina este archivo (test-db-connection.php) después de usarlo por seguridad.</p>";
echo "</body></html>";
