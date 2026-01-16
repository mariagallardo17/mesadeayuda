<?php
/**
 * Script para probar el endpoint de login y ver el error específico
 * Accede desde: https://atiendeti.com/api/test-login-endpoint.php
 * 
 * ⚠️ IMPORTANTE: Elimina este archivo después de usarlo por seguridad
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');

// Cargar dependencias
require_once __DIR__ . '/vendor/autoload.php';

// Cargar .env
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

use App\Config\Database;
use App\Routes\AuthRoutes;
use App\Router;

$resultado = [
    'fecha' => date('Y-m-d H:i:s'),
    'pasos' => [],
    'errores' => [],
    'exito' => false
];

try {
    // Paso 1: Verificar conexión a BD
    $resultado['pasos'][] = 'Paso 1: Verificando conexión a base de datos...';
    $db = Database::getInstance();
    $resultado['pasos'][] = '✅ Conexión a base de datos exitosa';
    
    // Paso 2: Verificar que existe la tabla usuarios
    $resultado['pasos'][] = 'Paso 2: Verificando tabla usuarios...';
    $stmt = $db->getConnection()->query("SHOW TABLES LIKE 'usuarios'");
    if ($stmt->rowCount() === 0) {
        $resultado['errores'][] = '❌ La tabla usuarios no existe';
    } else {
        $resultado['pasos'][] = '✅ Tabla usuarios encontrada';
    }
    
    // Paso 3: Verificar columnas de la tabla
    $resultado['pasos'][] = 'Paso 3: Verificando columnas de la tabla...';
    $stmt = $db->getConnection()->query("DESCRIBE usuarios");
    $columnas = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $resultado['columnas'] = $columnas;
    
    $columnasRequeridas = ['id_usuario', 'correo', 'password', 'rol', 'nombre', 'password_temporal', 'num_empleado', 'departamento', 'estatus'];
    $columnasFaltantes = array_diff($columnasRequeridas, $columnas);
    
    if (!empty($columnasFaltantes)) {
        $resultado['errores'][] = '❌ Columnas faltantes: ' . implode(', ', $columnasFaltantes);
    } else {
        $resultado['pasos'][] = '✅ Todas las columnas requeridas existen';
    }
    
    // Paso 4: Verificar que existe la clase JWT
    $resultado['pasos'][] = 'Paso 4: Verificando librería JWT...';
    if (!class_exists('Firebase\JWT\JWT')) {
        $resultado['errores'][] = '❌ La clase Firebase\JWT\JWT no existe';
    } else {
        $resultado['pasos'][] = '✅ Librería JWT encontrada';
    }
    
    // Paso 5: Verificar función password_verify
    $resultado['pasos'][] = 'Paso 5: Verificando función password_verify...';
    if (!function_exists('password_verify')) {
        $resultado['errores'][] = '❌ La función password_verify no está disponible';
    } else {
        $resultado['pasos'][] = '✅ Función password_verify disponible';
    }
    
    // Paso 6: Intentar crear una instancia de AuthRoutes
    $resultado['pasos'][] = 'Paso 6: Verificando clase AuthRoutes...';
    if (!class_exists('App\Routes\AuthRoutes')) {
        $resultado['errores'][] = '❌ La clase App\Routes\AuthRoutes no existe';
    } else {
        $resultado['pasos'][] = '✅ Clase AuthRoutes encontrada';
        
        // Intentar crear instancia
        try {
            $router = new Router();
            $authRoutes = new AuthRoutes($router);
            $resultado['pasos'][] = '✅ Instancia de AuthRoutes creada exitosamente';
        } catch (Exception $e) {
            $resultado['errores'][] = '❌ Error al crear AuthRoutes: ' . $e->getMessage();
            $resultado['errores'][] = 'Stack trace: ' . $e->getTraceAsString();
        }
    }
    
    // Paso 7: Verificar que hay usuarios en la tabla
    $resultado['pasos'][] = 'Paso 7: Verificando usuarios en la tabla...';
    $stmt = $db->getConnection()->query("SELECT COUNT(*) as total FROM usuarios");
    $total = $stmt->fetch()['total'];
    $resultado['total_usuarios'] = $total;
    
    if ($total > 0) {
        // Intentar obtener un usuario de prueba
        $stmt = $db->getConnection()->query("SELECT correo, estatus FROM usuarios LIMIT 1");
        $usuario = $stmt->fetch();
        if ($usuario) {
            $resultado['pasos'][] = '✅ Usuario de prueba encontrado: ' . $usuario['correo'] . ' (estatus: ' . $usuario['estatus'] . ')';
        }
    } else {
        $resultado['errores'][] = '⚠️ No hay usuarios en la tabla';
    }
    
    // Resumen
    if (empty($resultado['errores'])) {
        $resultado['exito'] = true;
        $resultado['mensaje'] = '✅ Todo parece estar correcto. El problema puede estar en el procesamiento del login.';
    } else {
        $resultado['mensaje'] = '❌ Se encontraron ' . count($resultado['errores']) . ' error(es)';
    }
    
} catch (Exception $e) {
    $resultado['errores'][] = '❌ Excepción capturada: ' . $e->getMessage();
    $resultado['errores'][] = 'Archivo: ' . $e->getFile() . ' Línea: ' . $e->getLine();
    $resultado['errores'][] = 'Stack trace: ' . $e->getTraceAsString();
}

echo json_encode($resultado, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
