<?php
/**
 * Script de diagnóstico para el error 500 en login
 * Accede desde: https://tudominio.com/api/diagnostico-login.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$diagnostico = [
    'fecha' => date('Y-m-d H:i:s'),
    'problemas' => [],
    'exitosos' => [],
    'recomendaciones' => []
];

// 1. Verificar vendor
$vendorPath = __DIR__ . '/vendor/autoload.php';
if (!file_exists($vendorPath)) {
    $diagnostico['problemas'][] = [
        'tipo' => 'CRÍTICO',
        'mensaje' => 'La carpeta vendor/ no existe o está incompleta',
        'solucion' => 'Ejecuta: composer install --no-dev --optimize-autoloader y sube la carpeta vendor/ al servidor'
    ];
} else {
    $diagnostico['exitosos'][] = 'Carpeta vendor/ encontrada correctamente';
    require_once $vendorPath;
}

// 2. Verificar .env
$envPath = __DIR__ . '/.env';
if (!file_exists($envPath)) {
    $diagnostico['problemas'][] = [
        'tipo' => 'CRÍTICO',
        'mensaje' => 'El archivo .env no existe',
        'solucion' => 'Copia env.example a .env y configura tus datos'
    ];
} else {
    $diagnostico['exitosos'][] = 'Archivo .env encontrado';

    // Cargar .env
    if (class_exists('Dotenv\Dotenv')) {
        try {
            $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
            $dotenv->safeLoad();
            $diagnostico['exitosos'][] = 'Variables de entorno cargadas';
        } catch (Exception $e) {
            $diagnostico['problemas'][] = [
                'tipo' => 'ADVERTENCIA',
                'mensaje' => 'Error cargando .env: ' . $e->getMessage()
            ];
        }
    }
}

// 3. Verificar variables de entorno críticas
$variablesRequeridas = [
    'DB_HOST' => 'Host de la base de datos',
    'DB_NAME' => 'Nombre de la base de datos',
    'DB_USER' => 'Usuario de la base de datos',
    'DB_PASSWORD' => 'Contraseña de la base de datos',
    'JWT_SECRET' => 'Clave secreta para JWT'
];

foreach ($variablesRequeridas as $var => $descripcion) {
    $valor = $_ENV[$var] ?? null;
    if (empty($valor)) {
        $diagnostico['problemas'][] = [
            'tipo' => 'CRÍTICO',
            'mensaje' => "Variable de entorno faltante: $var ($descripcion)",
            'solucion' => "Agrega $var=valor en tu archivo .env"
        ];
    } else {
        // Ocultar valores sensibles en el diagnóstico
        if (in_array($var, ['DB_PASSWORD', 'JWT_SECRET'])) {
            $valorMostrar = str_repeat('*', min(strlen($valor), 10));
        } else {
            $valorMostrar = $valor;
        }
        $diagnostico['exitosos'][] = "$var configurado: $valorMostrar";
    }
}

// 4. Verificar conexión a base de datos
if (class_exists('App\Config\Database')) {
    try {
        $db = App\Config\Database::getInstance();
        $diagnostico['exitosos'][] = 'Conexión a la base de datos exitosa';

        // Verificar tabla usuarios
        try {
            $stmt = $db->getConnection()->query("SHOW TABLES LIKE 'usuarios'");
            $tablaExiste = $stmt->rowCount() > 0;

            if (!$tablaExiste) {
                // Intentar con mayúsculas
                $stmt = $db->getConnection()->query("SHOW TABLES LIKE 'Usuarios'");
                $tablaExiste = $stmt->rowCount() > 0;
            }

            if ($tablaExiste) {
                $diagnostico['exitosos'][] = 'Tabla usuarios encontrada';

                // Contar usuarios
                try {
                    $stmt = $db->getConnection()->query("SELECT COUNT(*) as total FROM usuarios");
                    $result = $stmt->fetch();
                    $diagnostico['exitosos'][] = "Total de usuarios en la base de datos: " . ($result['total'] ?? 0);
                } catch (Exception $e) {
                    $diagnostico['problemas'][] = [
                        'tipo' => 'ADVERTENCIA',
                        'mensaje' => 'No se pudo contar usuarios: ' . $e->getMessage()
                    ];
                }
            } else {
                $diagnostico['problemas'][] = [
                    'tipo' => 'CRÍTICO',
                    'mensaje' => 'La tabla usuarios no existe en la base de datos',
                    'solucion' => 'Importa el archivo _resources/database.sql en tu base de datos'
                ];
            }
        } catch (Exception $e) {
            $diagnostico['problemas'][] = [
                'tipo' => 'ERROR',
                'mensaje' => 'Error verificando tabla usuarios: ' . $e->getMessage()
            ];
        }

    } catch (Exception $e) {
        $diagnostico['problemas'][] = [
            'tipo' => 'CRÍTICO',
            'mensaje' => 'Error conectando a la base de datos: ' . $e->getMessage(),
            'solucion' => 'Verifica las credenciales en el archivo .env (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)'
        ];
    }
} else {
    $diagnostico['problemas'][] = [
        'tipo' => 'CRÍTICO',
        'mensaje' => 'No se puede cargar la clase Database',
        'solucion' => 'Verifica que vendor/autoload.php esté funcionando correctamente'
    ];
}

// 5. Verificar permisos de archivos
$archivosImportantes = [
    '.env' => 'Archivo de configuración',
    'index.php' => 'Punto de entrada',
    'vendor/autoload.php' => 'Autoloader de Composer'
];

foreach ($archivosImportantes as $archivo => $descripcion) {
    $ruta = __DIR__ . '/' . $archivo;
    if (file_exists($ruta)) {
        $permisos = substr(sprintf('%o', fileperms($ruta)), -4);
        $diagnostico['exitosos'][] = "$descripcion: permisos $permisos";

        if (!is_readable($ruta)) {
            $diagnostico['problemas'][] = [
                'tipo' => 'ERROR',
                'mensaje' => "$descripcion no es legible (permisos: $permisos)",
                'solucion' => "Cambia permisos a 644: chmod 644 $archivo"
            ];
        }
    }
}

// 6. Generar recomendaciones
if (count($diagnostico['problemas']) === 0) {
    $diagnostico['recomendaciones'][] = '✅ Todo parece estar configurado correctamente';
    $diagnostico['recomendaciones'][] = 'Si aún tienes error 500, revisa los logs de error del servidor';
} else {
    $problemasCriticos = array_filter($diagnostico['problemas'], function($p) {
        return $p['tipo'] === 'CRÍTICO';
    });

    if (count($problemasCriticos) > 0) {
        $diagnostico['recomendaciones'][] = '⚠️ Hay ' . count($problemasCriticos) . ' problema(s) crítico(s) que deben resolverse primero';
    }

    $diagnostico['recomendaciones'][] = 'Revisa cada problema y aplica su solución correspondiente';
    $diagnostico['recomendaciones'][] = 'Después de corregir, recarga esta página para verificar';
}

// 7. Resumen
$diagnostico['resumen'] = [
    'total_problemas' => count($diagnostico['problemas']),
    'problemas_criticos' => count(array_filter($diagnostico['problemas'], function($p) {
        return $p['tipo'] === 'CRÍTICO';
    })),
    'verificaciones_exitosas' => count($diagnostico['exitosos']),
    'estado' => count($diagnostico['problemas']) === 0 ? 'OK' : 'ERROR'
];

echo json_encode($diagnostico, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
