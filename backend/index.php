<?php
// Check if Composer dependencies are installed
if (!file_exists(__DIR__ . '/vendor/autoload.php')) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Dependencies not installed',
        'message' => 'Please run "composer install" in the backend directory to install PHP dependencies.',
        'instructions' => [
            '1. Install Composer from https://getcomposer.org/',
            '2. Run: cd backend',
            '3. Run: composer install',
            '4. Reload this page'
        ]
    ]);
    exit(1);
}

require_once __DIR__ . '/vendor/autoload.php';

use App\Config\Database;
use App\Router;

// Load environment variables
// Intentar cargar desde múltiples ubicaciones posibles
$envPaths = [
    __DIR__,  // backend/
    __DIR__ . '/api',  // backend/api/
    dirname(__DIR__) . '/api',  // api/ (si está al mismo nivel que backend)
];

$envLoaded = false;
foreach ($envPaths as $envPath) {
    $envFile = $envPath . '/.env';
    if (file_exists($envFile)) {
        $dotenv = Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
        error_log("✅ Archivo .env cargado desde: $envPath");
        $envLoaded = true;
        break;
    }
}

if (!$envLoaded) {
    error_log("⚠️ Advertencia: No se encontró archivo .env en ninguna de las ubicaciones esperadas");
    // Intentar cargar desde __DIR__ como fallback
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->safeLoad();
}

// Configurar zona horaria de México (importante para fechas en correos y BD)
date_default_timezone_set('America/Mexico_City');
error_log("🕐 Zona horaria configurada: " . date_default_timezone_get());

// Set error reporting (desactivar en producción)
error_reporting(E_ALL);
ini_set('display_errors', $_ENV['DISPLAY_ERRORS'] ?? '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/error.log');

// Set headers for CORS
header('Access-Control-Allow-Origin: ' . ($_ENV['CORS_ORIGIN'] ?? 'http://localhost:4200'));
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get request method and URI first
$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Handle migration scripts directly (before router and content type)
if (strpos($uri, '/migrate-create-evaluaciones-reaperturas.php') !== false ||
    strpos($uri, '/migrate-allow-multiple-evaluations.php') !== false) {
    // Remove base path if exists
    $basePath = '/api';
    if (strpos($uri, $basePath) === 0) {
        $uri = substr($uri, strlen($basePath));
    }

    // Extract filename
    $filename = basename($uri);
    $filepath = __DIR__ . '/' . $filename;

    if (file_exists($filepath)) {
        // Change content type for migration scripts (they output HTML)
        header('Content-Type: text/html; charset=utf-8');
        require $filepath;
        exit;
    }
}

// Set content type for API responses
header('Content-Type: application/json');

try {
    // Test database connection
    $db = Database::getInstance();

    // Initialize router
    $router = new Router();

    // Remove base path if exists
    $basePath = '/api';
    if (strpos($uri, $basePath) === 0) {
        $uri = substr($uri, strlen($basePath));
    }

    // Route the request
    $router->route($method, $uri);

    // Si llegamos aquí y no se envió respuesta, significa que la ruta no se encontró
    // El router ya debería haber manejado esto, pero por si acaso:
    if (!headers_sent()) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Route not found',
            'path' => $uri
        ]);
    }

} catch (Exception $e) {
    // Solo enviar error si no se ha enviado respuesta aún
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => 'Something went wrong!',
            'message' => $e->getMessage(),
            'file' => basename($e->getFile()),
            'line' => $e->getLine()
        ]);
    }
} catch (Throwable $e) {
    // Capturar también errores fatales
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => 'Fatal error occurred!',
            'message' => $e->getMessage(),
            'file' => basename($e->getFile()),
            'line' => $e->getLine()
        ]);
    }
}
