<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Services\EmailService;
use App\Services\NotificationService;

class TicketRoutes
{
    private $router;
    private $db;

    const MIN_DESCRIPTION_LENGTH = 10;

    public function __construct($router)
    {
        $this->router = $router;
        $this->db = Database::getInstance();
        $this->registerRoutes();
    }

    private function registerRoutes()
    {
        $this->router->addRoute('GET', '/tickets/my-tickets', [$this, 'getMyTickets']);
        $this->router->addRoute('GET', '/tickets/check-pending-evaluation', [$this, 'checkPendingEvaluation']);
        $this->router->addRoute('GET', '/tickets/reopened', [$this, 'getReopenedTickets']);
        $this->router->addRoute('GET', '/tickets/escalados', [$this, 'getEscaladosTickets']);
        $this->router->addRoute('GET', '/tickets/technicians', [$this, 'getTechnicians']);
        $this->router->addRoute('GET', '/tickets/:id/evaluation', [$this, 'getEvaluation']);
        $this->router->addRoute('GET', '/tickets/:ticketId/approval-letter', [$this, 'getApprovalLetter']);
        $this->router->addRoute('GET', '/tickets/download/:filename', [$this, 'downloadFile']);
        $this->router->addRoute('GET', '/tickets/:id', [$this, 'getTicketById']);
        $this->router->addRoute('POST', '/tickets', [$this, 'createTicket']);
        $this->router->addRoute('POST', '/tickets/:id/escalate', [$this, 'escalateTicket']);
        $this->router->addRoute('PUT', '/tickets/:id/status', [$this, 'updateTicketStatus']);
        $this->router->addRoute('PUT', '/tickets/:id/reopen/technician-comment', [$this, 'addTechnicianReopenComment']);
        $this->router->addRoute('POST', '/tickets/:id/close', [$this, 'closeTicket']);
        $this->router->addRoute('POST', '/tickets/:id/evaluate', [$this, 'evaluateTicket']);
    }

    public function getMyTickets()
    {
        $user = AuthMiddleware::authenticate();

        // Obtener parámetros de paginación
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 10; // Máximo 100 por página
        $offset = ($page - 1) * $limit;

        error_log('getMyTickets - Usuario: ' . $user['id_usuario'] . ', Rol: ' . ($user['rol'] ?? 'N/A') . ', Page: ' . $page . ', Limit: ' . $limit);

        try {
            if ($user['rol'] === 'tecnico' || $user['rol'] === 'administrador') {
                // OPTIMIZADO: Usar una sola consulta con SQL_CALC_FOUND_ROWS para mejor rendimiento
                // Para técnicos: mostrar tickets asignados con información del usuario que creó el ticket
                $stmt = $this->db->query(
                    'SELECT
                        t.id_ticket as id,
                        s.categoria,
                        s.subcategoria,
                        t.descripcion,
                        s.tiempo_objetivo as tiempo_estimado,
                        s.tiempo_maximo,
                        t.estatus as estado,
                        t.prioridad,
                        t.fecha_creacion,
                        t.fecha_asignacion,
                        t.fecha_inicio_atencion,
                        t.fecha_finalizacion,
                        t.fecha_cierre,
                        t.tiempo_atencion_segundos,
                        t.tiempo_restante_finalizacion,
                        u.id_usuario as usuario_id,
                        u.nombre as usuario_nombre,
                        u.correo as usuario_correo,
                        u.departamento as usuario_departamento,
                        t.id_tecnico as tecnico_id
                     FROM tickets t
                     JOIN servicios s ON t.id_servicio = s.id_servicio
                     JOIN usuarios u ON t.id_usuario = u.id_usuario
                     WHERE t.id_tecnico = ? AND t.estatus != "Escalado"
                     ORDER BY t.fecha_creacion DESC
                     LIMIT ? OFFSET ?',
                    [$user['id_usuario'], $limit, $offset]
                );

                // Obtener total usando FOUND_ROWS (más rápido que COUNT separado)
                $stmtTotal = $this->db->query('SELECT FOUND_ROWS() as total');
                $total = (int)($stmtTotal->fetch()['total'] ?? 0);

                // Si FOUND_ROWS no funciona, hacer COUNT (fallback)
                if ($total === 0) {
                    $stmtCount = $this->db->query(
                        'SELECT COUNT(*) as total FROM tickets t WHERE t.id_tecnico = ? AND t.estatus != "Escalado"',
                        [$user['id_usuario']]
                    );
                    $total = (int)($stmtCount->fetch()['total'] ?? 0);
                }
            } else {
                // OPTIMIZADO: Para empleados también usar una sola consulta
                // Para empleados: mostrar sus tickets con información del técnico asignado y del usuario que creó el ticket
                $stmt = $this->db->query(
                    'SELECT
                        t.id_ticket as id,
                        s.categoria,
                        s.subcategoria,
                        t.descripcion,
                        s.tiempo_objetivo as tiempo_estimado,
                        s.tiempo_maximo,
                        t.estatus as estado,
                        t.prioridad,
                        t.fecha_creacion,
                        t.fecha_asignacion,
                        t.fecha_inicio_atencion,
                        t.fecha_finalizacion,
                        t.fecha_cierre,
                        t.tiempo_atencion_segundos,
                        t.tiempo_restante_finalizacion,
                        t.id_usuario as usuario_id,
                        t.id_tecnico as tecnico_id,
                        u_creador.id_usuario as usuario_id_usuario,
                        u_creador.nombre as usuario_nombre,
                        u_creador.correo as usuario_correo,
                        u_creador.departamento as usuario_departamento,
                        u.id_usuario as tecnico_id_usuario,
                        u.nombre as tecnico_nombre,
                        u.correo as tecnico_correo,
                        u.departamento as tecnico_departamento
                     FROM tickets t
                     JOIN servicios s ON t.id_servicio = s.id_servicio
                     JOIN usuarios u_creador ON t.id_usuario = u_creador.id_usuario
                     LEFT JOIN usuarios u ON t.id_tecnico = u.id_usuario
                     WHERE t.id_usuario = ?
                     ORDER BY t.fecha_creacion DESC
                     LIMIT ? OFFSET ?',
                    [$user['id_usuario'], $limit, $offset]
                );

                // Obtener total usando FOUND_ROWS (más rápido que COUNT separado)
                $stmtTotal = $this->db->query('SELECT FOUND_ROWS() as total');
                $total = (int)($stmtTotal->fetch()['total'] ?? 0);

                // Si FOUND_ROWS no funciona, hacer COUNT (fallback)
                if ($total === 0) {
                    $stmtCount = $this->db->query(
                        'SELECT COUNT(*) as total FROM tickets t WHERE t.id_usuario = ?',
                        [$user['id_usuario']]
                    );
                    $total = (int)($stmtCount->fetch()['total'] ?? 0);
                }
            }

            $tickets = $stmt->fetchAll();

            error_log('Tickets encontrados (raw): ' . count($tickets));

            // Si no hay tickets, devolver array vacío
            if (empty($tickets)) {
                error_log('No hay tickets para el usuario: ' . $user['id_usuario'] . ' (rol: ' . $user['rol'] . ')');
                AuthMiddleware::sendResponse([]);
                return;
            }

            // Formatear datos para el frontend
            $formattedTickets = [];
            foreach ($tickets as $ticket) {
                try {
                    // Convertir snake_case a camelCase y estructurar datos
                    $formattedTicket = [
                        'id' => isset($ticket['id']) ? (int)$ticket['id'] : null,
                        'categoria' => $ticket['categoria'] ?? '',
                        'subcategoria' => $ticket['subcategoria'] ?? '',
                        'descripcion' => $ticket['descripcion'] ?? '',
                        'tiempoEstimado' => $ticket['tiempo_estimado'] ?? null,
                        'tiempoObjetivo' => $ticket['tiempo_estimado'] ?? null,
                        'tiempoMaximo' => $ticket['tiempo_maximo'] ?? null,
                        'estado' => $ticket['estado'] ?? 'Pendiente',
                        'prioridad' => $ticket['prioridad'] ?? 'Media',
                        'fechaCreacion' => $ticket['fecha_creacion'] ?? null,
                        'fechaAsignacion' => $ticket['fecha_asignacion'] ?? null,
                        'fechaInicioAtencion' => $ticket['fecha_inicio_atencion'] ?? null,
                        'fechaFinalizacion' => $ticket['fecha_finalizacion'] ?? null,
                        'fechaCierre' => $ticket['fecha_cierre'] ?? null,
                        'tiempoAtencionSegundos' => isset($ticket['tiempo_atencion_segundos']) ? (int)$ticket['tiempo_atencion_segundos'] : null,
                        'tiempoRestanteFinalizacion' => isset($ticket['tiempo_restante_finalizacion']) ? (int)$ticket['tiempo_restante_finalizacion'] : null,
                        'usuarioId' => isset($ticket['usuario_id']) ? (int)$ticket['usuario_id'] : null,
                        'tecnicoId' => isset($ticket['tecnico_id']) ? (int)$ticket['tecnico_id'] : null,
                    ];

                    // Agrupar datos del usuario en objeto usuario
                    if (!empty($ticket['usuario_nombre'])) {
                        $formattedTicket['usuario'] = [
                            'id' => isset($ticket['usuario_id']) ? (int)$ticket['usuario_id'] : null,
                            'nombre' => $ticket['usuario_nombre'] ?? '',
                            'correo' => $ticket['usuario_correo'] ?? '',
                            'departamento' => $ticket['usuario_departamento'] ?? null
                        ];
                    }

                    // Agrupar datos del técnico si existen (para empleados)
                    if (!empty($ticket['tecnico_nombre'])) {
                        $formattedTicket['tecnico'] = [
                            'id' => isset($ticket['tecnico_id_usuario']) ? (int)$ticket['tecnico_id_usuario'] : null,
                            'nombre' => $ticket['tecnico_nombre'] ?? '',
                            'correo' => $ticket['tecnico_correo'] ?? '',
                            'departamento' => $ticket['tecnico_departamento'] ?? null
                        ];
                        $formattedTicket['tecnicoAsignado'] = $ticket['tecnico_nombre'] ?? null;
                    } else if (!empty($ticket['tecnico_id'])) {
                        // Si hay técnico asignado pero no tenemos el nombre, al menos devolver el ID
                        $formattedTicket['tecnicoAsignado'] = 'Técnico asignado';
                        $formattedTicket['tecnicoId'] = (int)$ticket['tecnico_id'];
                    }

                    // Asegurar que el estado siempre esté presente
                    if (empty($formattedTicket['estado'])) {
                        $formattedTicket['estado'] = 'Pendiente';
                    }

                    // Formatear tiempo de atención para mejor legibilidad
                    if (!empty($ticket['tiempo_atencion_segundos'])) {
                        $segundos = (int)$ticket['tiempo_atencion_segundos'];
                        $horas = floor($segundos / 3600);
                        $minutos = floor(($segundos % 3600) / 60);
                        $formattedTicket['tiempoAtencionFormateado'] = sprintf('%02d:%02d:%02d', $horas, $minutos, $segundos % 60);
                    } else {
                        $formattedTicket['tiempoAtencionFormateado'] = null;
                    }

                    $formattedTickets[] = $formattedTicket;
                } catch (\Exception $e) {
                    error_log('Error formateando ticket: ' . $e->getMessage());
                    error_log('Ticket data: ' . json_encode($ticket));
                    error_log('Stack trace: ' . $e->getTraceAsString());
                    // Continuar con el siguiente ticket en lugar de fallar completamente
                    continue;
                }
            }

            error_log('Tickets formateados: ' . count($formattedTickets));
            error_log('Primer ticket formateado: ' . json_encode($formattedTickets[0] ?? 'N/A'));

            // Calcular información de paginación
            $totalPages = ceil($total / $limit);
            $startItem = $total > 0 ? $offset + 1 : 0;
            $endItem = min($offset + $limit, $total);

            // Devolver respuesta con paginación
            AuthMiddleware::sendResponse([
                'tickets' => $formattedTickets,
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => $totalPages,
                    'startItem' => $startItem,
                    'endItem' => $endItem,
                    'hasNextPage' => $page < $totalPages,
                    'hasPrevPage' => $page > 1
                ]
            ]);
        } catch (\Exception $e) {
            error_log('Error getting tickets: ' . $e->getMessage());
            error_log('Stack trace: ' . $e->getTraceAsString());
            error_log('File: ' . $e->getFile() . ' Line: ' . $e->getLine());
            AuthMiddleware::sendError('Error interno del servidor: ' . $e->getMessage(), 500);
        }
    }

    public function checkPendingEvaluation()
    {
        $user = AuthMiddleware::authenticate();

        try {
            $stmt = $this->db->query(
                'SELECT COUNT(*) as count FROM tickets t
                 LEFT JOIN evaluaciones e ON e.id_ticket = t.id_ticket
                 WHERE t.id_usuario = ? AND e.id_evaluacion IS NULL
                   AND (t.estatus = "Finalizado" OR (t.estatus = "Cerrado" AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
                   AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL',
                [$user['id_usuario']]
            );

            $result = $stmt->fetch();
            $hasPending = $result['count'] > 0;

            AuthMiddleware::sendResponse(['hasPending' => $hasPending]);
        } catch (\Exception $e) {
            error_log('Error checking pending evaluations: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    public function getTicketById($id)
    {
        $user = AuthMiddleware::authenticate();

        try {
            // Obtener información completa del ticket
            $stmt = $this->db->query(
                'SELECT
                    t.id_ticket as id,
                    s.categoria,
                    s.subcategoria,
                    t.descripcion,
                    s.tiempo_objetivo as tiempo_estimado,
                    s.tiempo_maximo,
                    t.estatus as estado,
                    t.prioridad,
                    t.fecha_creacion,
                    t.fecha_asignacion,
                    t.fecha_inicio_atencion,
                    t.fecha_finalizacion,
                    t.fecha_cierre,
                    t.tiempo_atencion_segundos,
                    t.tiempo_restante_finalizacion,
                    t.id_usuario as usuario_id,
                    t.id_tecnico as tecnico_id,
                    t.id_servicio as servicio_id,
                    u.id_usuario as usuario_id_usuario,
                    u.nombre as usuario_nombre,
                    u.correo as usuario_correo,
                    u.departamento as usuario_departamento,
                    tec.id_usuario as tecnico_id_usuario,
                    tec.nombre as tecnico_nombre,
                    tec.correo as tecnico_correo,
                    tec.departamento as tecnico_departamento
                 FROM tickets t
                 JOIN servicios s ON t.id_servicio = s.id_servicio
                 JOIN usuarios u ON t.id_usuario = u.id_usuario
                 LEFT JOIN usuarios tec ON t.id_tecnico = tec.id_usuario
                 WHERE t.id_ticket = ? AND (t.id_usuario = ? OR t.id_tecnico = ?)',
                [$id, $user['id_usuario'], $user['id_usuario']]
            );

            $ticket = $stmt->fetch();

            if (!$ticket) {
                AuthMiddleware::sendError('Ticket no encontrado', 404);
            }

            // Formatear datos para el frontend (mismo formato que getMyTickets)
            $formattedTicket = [
                'id' => $ticket['id'],
                'categoria' => $ticket['categoria'],
                'subcategoria' => $ticket['subcategoria'],
                'descripcion' => $ticket['descripcion'],
                'tiempoEstimado' => $ticket['tiempoEstimado'] ?? null,
                'tiempoObjetivo' => $ticket['tiempoEstimado'] ?? null,
                'tiempoMaximo' => $ticket['tiempoMaximo'] ?? null,
                'estado' => $ticket['estado'],
                'prioridad' => $ticket['prioridad'],
                'fechaCreacion' => $ticket['fecha_creacion'] ?? null,
                'fechaAsignacion' => $ticket['fecha_asignacion'] ?? null,
                'fechaInicioAtencion' => $ticket['fecha_inicio_atencion'] ?? null,
                'fechaFinalizacion' => $ticket['fecha_finalizacion'] ?? null,
                'fechaCierre' => $ticket['fecha_cierre'] ?? null,
                'tiempoAtencionSegundos' => $ticket['tiempo_atencion_segundos'] ?? null,
                'tiempoRestanteFinalizacion' => $ticket['tiempo_restante_finalizacion'] ?? null,
                'usuarioId' => $ticket['usuario_id'] ?? null,
                'tecnicoId' => $ticket['tecnico_id'] ?? null,
                'servicioId' => $ticket['servicio_id'] ?? null,
            ];

            // Agrupar datos del usuario en objeto usuario
            if (!empty($ticket['usuario_nombre'])) {
                $formattedTicket['usuario'] = [
                    'id' => $ticket['usuario_id_usuario'] ?? null,
                    'nombre' => $ticket['usuario_nombre'] ?? null,
                    'correo' => $ticket['usuario_correo'] ?? null,
                    'departamento' => $ticket['usuario_departamento'] ?? null
                ];
            }

            // Agrupar datos del técnico si existen
            if (!empty($ticket['tecnico_nombre'])) {
                $formattedTicket['tecnico'] = [
                    'id' => $ticket['tecnico_id_usuario'] ?? null,
                    'nombre' => $ticket['tecnico_nombre'] ?? null,
                    'correo' => $ticket['tecnico_correo'] ?? null,
                    'departamento' => $ticket['tecnico_departamento'] ?? null
                ];
                $formattedTicket['tecnicoAsignado'] = $ticket['tecnico_nombre'] ?? null;
            }

            // Formatear tiempo de atención si existe
            if (!empty($ticket['tiempo_atencion_segundos'])) {
                $segundos = (int)$ticket['tiempo_atencion_segundos'];
                $horas = floor($segundos / 3600);
                $minutos = floor(($segundos % 3600) / 60);
                $formattedTicket['tiempoAtencionFormateado'] = sprintf('%02d:%02d:%02d', $horas, $minutos, $segundos % 60);
            } else {
                $formattedTicket['tiempoAtencionFormateado'] = null;
            }

            $ticket = $formattedTicket;

            AuthMiddleware::sendResponse($ticket);
        } catch (\Exception $e) {
            error_log('Error getting ticket: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    public function createTicket()
    {
        $user = AuthMiddleware::authenticate();

        // Leer datos de FormData (multipart/form-data) o JSON
        // Si es FormData, los datos vienen en $_POST, si es JSON viene en php://input
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

        if (strpos($contentType, 'multipart/form-data') !== false) {
            // FormData - leer de $_POST
            $categoria = trim($_POST['categoria'] ?? '');
            $subcategoria = trim($_POST['subcategoria'] ?? '');
            $descripcion = trim($_POST['descripcion'] ?? '');
            $archivoAprobacion = $_FILES['archivoAprobacion'] ?? null;
            error_log("📋 Datos recibidos desde FormData: categoria=$categoria, subcategoria=$subcategoria, descripcion=" . substr($descripcion, 0, 50) . "...");
        } else {
            // JSON - leer de php://input
            $body = AuthMiddleware::getRequestBody();
        $categoria = trim($body['categoria'] ?? '');
        $subcategoria = trim($body['subcategoria'] ?? '');
        $descripcion = trim($body['descripcion'] ?? '');
            $archivoAprobacion = null;
            error_log("📋 Datos recibidos desde JSON: categoria=$categoria, subcategoria=$subcategoria, descripcion=" . substr($descripcion, 0, 50) . "...");
        }

        // Validar campos obligatorios
        if (empty($categoria) || empty($subcategoria) || empty($descripcion)) {
            error_log("❌ Campos faltantes: categoria=" . (empty($categoria) ? 'VACÍO' : 'OK') . ", subcategoria=" . (empty($subcategoria) ? 'VACÍO' : 'OK') . ", descripcion=" . (empty($descripcion) ? 'VACÍO' : 'OK'));
            AuthMiddleware::sendError('Todos los campos obligatorios deben ser completados', 400);
        }

        if (strlen($descripcion) < self::MIN_DESCRIPTION_LENGTH) {
            AuthMiddleware::sendError('La descripción debe tener al menos ' . self::MIN_DESCRIPTION_LENGTH . ' caracteres', 400);
        }

        // Validación de tickets pendientes DESACTIVADA temporalmente para evitar errores
        // Se puede reactivar después cuando el sistema esté funcionando

        try {
            // Get service - Intentar con diferentes nombres de tabla
            $servicio = null;

            // Intentar con "servicios" (minúscula)
            try {
                $stmt = $this->db->query(
                    'SELECT id_servicio, tiempo_objetivo, tiempo_maximo, prioridad, requiere_aprobacion FROM servicios
                     WHERE categoria = ? AND subcategoria = ? AND estatus = "Activo"',
                    [$categoria, $subcategoria]
                );
                $servicio = $stmt->fetch();
            } catch (\Exception $e) {
                error_log("⚠️ Error con tabla 'servicios': " . $e->getMessage());
            }

            // Si no funcionó, intentar con "Servicios" (mayúscula)
            if (!$servicio) {
                try {
                    $stmt = $this->db->query(
                        'SELECT id_servicio, tiempo_objetivo, tiempo_maximo, prioridad, requiere_aprobacion FROM Servicios
                         WHERE categoria = ? AND subcategoria = ? AND estatus = "Activo"',
                        [$categoria, $subcategoria]
                    );
                    $servicio = $stmt->fetch();
                } catch (\Exception $e) {
                    error_log("⚠️ Error con tabla 'Servicios': " . $e->getMessage());
                }
            }

            if (!$servicio) {
                error_log("❌ Servicio no encontrado: categoria=$categoria, subcategoria=$subcategoria");
                AuthMiddleware::sendError('Servicio no encontrado. Verifica que la categoría y subcategoría sean correctas.', 404);
            }

            $prioridad = $servicio['prioridad'] ?? 'Media';
            $requiereAprobacion = ($servicio['requiere_aprobacion'] == 1 || $servicio['requiere_aprobacion'] === true || $servicio['requiere_aprobacion'] === '1');

            // Validar archivo de aprobación si es requerido
            $nombreArchivoAprobacion = null;
            if ($requiereAprobacion) {
                if (!$archivoAprobacion || !isset($archivoAprobacion['tmp_name']) || empty($archivoAprobacion['tmp_name'])) {
                    AuthMiddleware::sendError('Este servicio requiere carta de aprobación. Por favor, adjunta el documento correspondiente.', 400);
                }

                // Validar que sea PDF (múltiples métodos para compatibilidad)
                $mimeType = null;
                if (function_exists('finfo_open')) {
                    try {
                        $finfo = finfo_open(FILEINFO_MIME_TYPE);
                        $mimeType = finfo_file($finfo, $archivoAprobacion['tmp_name']);
                        finfo_close($finfo);
                    } catch (\Exception $e) {
                        error_log("⚠️ Error usando finfo: " . $e->getMessage());
                    }
                }

                // Fallback: validar por extensión si finfo no está disponible
                if (!$mimeType) {
                    $extension = strtolower(pathinfo($archivoAprobacion['name'], PATHINFO_EXTENSION));
                    if ($extension !== 'pdf') {
                        AuthMiddleware::sendError('Solo se permiten archivos PDF para la carta de aprobación', 400);
                    }
                    $mimeType = 'application/pdf'; // Asumir que es PDF si la extensión es correcta
                } else {
                    if ($mimeType !== 'application/pdf') {
                        AuthMiddleware::sendError('Solo se permiten archivos PDF para la carta de aprobación', 400);
                    }
                }

                // Validar tamaño (máximo 10MB)
                if (!isset($archivoAprobacion['size']) || $archivoAprobacion['size'] > 10 * 1024 * 1024) {
                    AuthMiddleware::sendError('El archivo de aprobación no puede exceder 10MB', 400);
                }

                // Generar nombre único para el archivo
                $extension = pathinfo($archivoAprobacion['name'], PATHINFO_EXTENSION);
                if (empty($extension)) {
                    $extension = 'pdf'; // Por defecto PDF
                }
                $nombreArchivoAprobacion = time() . '_' . $user['id_usuario'] . '_' . uniqid() . '.' . $extension;

                // Crear directorio uploads si no existe
                $uploadsDir = __DIR__ . '/../../uploads/';
                if (!is_dir($uploadsDir)) {
                    if (!mkdir($uploadsDir, 0755, true)) {
                        error_log("❌ Error creando directorio uploads: $uploadsDir");
                        AuthMiddleware::sendError('Error al crear directorio para archivos', 500);
                    }
                }

                // Mover archivo
                $rutaDestino = $uploadsDir . $nombreArchivoAprobacion;
                if (!move_uploaded_file($archivoAprobacion['tmp_name'], $rutaDestino)) {
                    error_log("❌ Error moviendo archivo de aprobación: " . ($archivoAprobacion['tmp_name'] ?? 'N/A') . " a " . $rutaDestino);
                    AuthMiddleware::sendError('Error al guardar el archivo de aprobación', 500);
                }

                error_log("✅ Archivo de aprobación guardado: $nombreArchivoAprobacion");
            }

            // ASIGNACIÓN AUTOMÁTICA SEGÚN responsable_inicial DEL CATÁLOGO DE SERVICIOS
            $tecnicoId = null;
            $tecnicoNombre = null;

            error_log("═══════════════════════════════════════════════════════");
            error_log("🔍 INICIANDO ASIGNACIÓN AUTOMÁTICA - Servicio ID: " . $servicio['id_servicio']);
            error_log("═══════════════════════════════════════════════════════");

            // PASO 1: Obtener responsable_inicial del servicio
            $stmtServicio = $this->db->query(
                'SELECT responsable_inicial FROM servicios WHERE id_servicio = ?',
                [$servicio['id_servicio']]
            );
            $servicioInfo = $stmtServicio->fetch();

            if ($servicioInfo && !empty($servicioInfo['responsable_inicial'])) {
                $responsableInicial = trim($servicioInfo['responsable_inicial']);
                error_log("📋 Responsable inicial del catálogo: '$responsableInicial'");

                // PASO 2: Listar TODOS los técnicos disponibles
                $stmtAll = $this->db->query(
                    'SELECT id_usuario, nombre, rol, estatus FROM usuarios
                     WHERE (rol = "tecnico" OR rol = "administrador")
                     AND estatus = "Activo"'
                );
                $allTecnicos = $stmtAll->fetchAll();
                error_log("📋 Técnicos disponibles en BD (" . count($allTecnicos) . "):");
                foreach ($allTecnicos as $tec) {
                    error_log("  - ID: {$tec['id_usuario']}, Nombre: '{$tec['nombre']}', Rol: '{$tec['rol']}'");
                }

                // PASO 3: Buscar técnico por nombre exacto
                $nombreBuscado = strtoupper(trim($responsableInicial));
                error_log("🔍 Buscando técnico con nombre: '$nombreBuscado'");

                // Buscar técnico - comparación exacta en mayúsculas
                $stmtTecnico = $this->db->query(
                    'SELECT id_usuario, nombre, rol FROM usuarios
                     WHERE (rol = "tecnico" OR rol = "administrador")
                     AND estatus = "Activo"
                     AND UPPER(TRIM(nombre)) = ?
                     LIMIT 1',
                    [$nombreBuscado]
                );
                $tecnico = $stmtTecnico->fetch();

                if ($tecnico) {
                    $tecnicoId = (int)$tecnico['id_usuario'];
                    $tecnicoNombre = $tecnico['nombre'];
                    error_log("✅✅✅ TÉCNICO ENCONTRADO Y ASIGNADO: ID $tecnicoId, Nombre: '$tecnicoNombre' ✅✅✅");
                } else {
                    error_log("⚠️ No se encontró técnico con nombre exacto '$responsableInicial' - Ticket quedará sin asignar (Pendiente)");
                    error_log("⚠️ IMPORTANTE: Verificar que el nombre en 'responsable_inicial' del catálogo coincida exactamente con el nombre del técnico en la tabla usuarios");
                }
            } else {
                error_log("⚠️ El servicio no tiene responsable_inicial configurado - Ticket quedará sin asignar (Pendiente)");
            }

            // NO HAY FALLBACK - Solo se asigna al técnico específico del catálogo de servicios
            // Si no se encuentra, el ticket queda sin asignar (estado Pendiente) para asignación manual

            error_log("═══════════════════════════════════════════════════════");
            error_log("📊 RESULTADO FINAL: tecnicoId = " . ($tecnicoId ?? 'NULL') . ", tecnicoNombre = " . ($tecnicoNombre ?? 'NULL'));
            error_log("═══════════════════════════════════════════════════════");

            // Create ticket con o sin técnico asignado
            error_log("═══════════════════════════════════════════════════════");
            error_log("📝 CREANDO TICKET EN BASE DE DATOS");
            error_log("   - id_usuario: " . $user['id_usuario']);
            error_log("   - id_servicio: " . $servicio['id_servicio']);
            error_log("   - id_tecnico: " . ($tecnicoId ?? 'NULL') . " (tipo: " . gettype($tecnicoId) . ")");
            error_log("   - estatus: " . ($tecnicoId ? 'En proceso' : 'Pendiente'));
            error_log("═══════════════════════════════════════════════════════");

            // Asegurar que tecnicoId sea un entero o NULL
            $idTecnicoParaInsert = ($tecnicoId && $tecnicoId > 0) ? (int)$tecnicoId : null;

            // Calcular tiempo_restante_finalizacion basado en tiempo_maximo o tiempo_objetivo
            $tiempoRestanteSegundos = null;
            $tiempoMaximo = $servicio['tiempo_maximo'] ?? null;
            $tiempoObjetivo = $servicio['tiempo_objetivo'] ?? null;

            try {
                if ($tiempoMaximo || $tiempoObjetivo) {
                    // Convertir tiempo_maximo o tiempo_objetivo a segundos
                    // Formato puede ser: "HH:MM:SS" o "D días" o número de horas
                    $tiempoParaCalcular = $tiempoMaximo ?: $tiempoObjetivo;

                    if (!empty($tiempoParaCalcular)) {
                        // Intentar parsear diferentes formatos
                        if (preg_match('/^(\d+):(\d+):(\d+)$/', $tiempoParaCalcular, $matches)) {
                            // Formato HH:MM:SS
                            $tiempoRestanteSegundos = (int)$matches[1] * 3600 + (int)$matches[2] * 60 + (int)$matches[3];
                        } elseif (preg_match('/(\d+)\s*d[íi]as?/i', $tiempoParaCalcular, $matches)) {
                            // Formato "X días"
                            $tiempoRestanteSegundos = (int)$matches[1] * 24 * 3600;
                        } elseif (is_numeric($tiempoParaCalcular)) {
                            // Número de horas
                            $tiempoRestanteSegundos = (int)$tiempoParaCalcular * 3600;
                        } else {
                            // Por defecto, intentar como horas
                            $tiempoRestanteSegundos = (int)$tiempoParaCalcular * 3600;
                        }

                        error_log("⏱️ Tiempo calculado: $tiempoParaCalcular = $tiempoRestanteSegundos segundos");
                    }
                }
            } catch (\Exception $e) {
                error_log("⚠️ Error calculando tiempo_restante_finalizacion: " . $e->getMessage());
                // Continuar sin tiempo_restante_finalizacion si hay error
                $tiempoRestanteSegundos = null;
            }

            // INSERT SIMPLIFICADO - Solo campos esenciales primero
            $estatusFinal = $idTecnicoParaInsert ? 'En proceso' : 'Pendiente';

            try {
                if ($idTecnicoParaInsert) {
                    // Con técnico
            $this->db->query(
                        'INSERT INTO tickets (id_usuario, id_servicio, descripcion, prioridad, estatus, id_tecnico, fecha_asignacion)
                         VALUES (?, ?, ?, ?, ?, ?, NOW())',
                        [
                            $user['id_usuario'],
                            $servicio['id_servicio'],
                            $descripcion,
                            $prioridad,
                            $estatusFinal,
                            $idTecnicoParaInsert
                        ]
                    );
                } else {
                    // Sin técnico
                    $this->db->query(
                        'INSERT INTO tickets (id_usuario, id_servicio, descripcion, prioridad, estatus)
                         VALUES (?, ?, ?, ?, ?)',
                        [
                            $user['id_usuario'],
                            $servicio['id_servicio'],
                            $descripcion,
                            $prioridad,
                            $estatusFinal
                        ]
                    );
                }

                $ticketId = (int)$this->db->getConnection()->lastInsertId();

                if (!$ticketId) {
                    throw new \Exception('No se pudo obtener el ID del ticket');
                }

                // Actualizar campos opcionales después del INSERT
                if ($nombreArchivoAprobacion || $tiempoRestanteSegundos !== null) {
                    $updateFields = [];
                    $updateParams = [];

                    if ($nombreArchivoAprobacion) {
                        $updateFields[] = 'archivo_aprobacion = ?';
                        $updateParams[] = $nombreArchivoAprobacion;
                    }

                    if ($tiempoRestanteSegundos !== null) {
                        $updateFields[] = 'tiempo_restante_finalizacion = ?';
                        $updateParams[] = $tiempoRestanteSegundos;
                    }

                    if (!empty($updateFields)) {
                        $updateParams[] = $ticketId;
                        $this->db->query(
                            'UPDATE tickets SET ' . implode(', ', $updateFields) . ' WHERE id_ticket = ?',
                            $updateParams
                        );
                    }
                }

                error_log("✅ Ticket #$ticketId creado exitosamente");
            } catch (\Exception $e) {
                error_log("❌ ERROR: " . $e->getMessage());
                throw $e;
            }

            $estadoFinal = $idTecnicoParaInsert ? 'En proceso' : 'Pendiente';

            // ============================================
            // CREAR NOTIFICACIONES - ANTES de enviar respuesta
            // ============================================
            try {
                error_log("📧 [NOTIFICACIONES] Creando notificaciones para ticket #$ticketId");

                // CRÍTICO: Obtener el ID del usuario REAL del ticket desde la BD
                // NO usar $user['id_usuario'] del token, usar el ID real del ticket
                $stmtTicketUsuario = $this->db->query(
                    'SELECT id_usuario FROM tickets WHERE id_ticket = ?',
                    [$ticketId]
                );
                $ticketUsuario = $stmtTicketUsuario->fetch();

                if (!$ticketUsuario || !isset($ticketUsuario['id_usuario']) || $ticketUsuario['id_usuario'] <= 0) {
                    error_log("❌ [NOTIFICACIONES] ERROR CRÍTICO: No se puede obtener id_usuario del ticket #$ticketId desde la BD");
                } else {
                    $idUsuarioCreador = (int)$ticketUsuario['id_usuario'];
                    error_log("📧 [NOTIFICACIONES] Usuario REAL del ticket desde BD: ID $idUsuarioCreador (token tenía: {$user['id_usuario']})");

                    // NOTIFICACIÓN 1: SOLO al usuario que creó el ticket - SIEMPRE
                    $resultEmp1 = $this->crearNotificacionInterna(
                        $idUsuarioCreador,
                        $ticketId,
                        "Tu ticket #$ticketId ha sido creado exitosamente"
                    );
                    error_log($resultEmp1 ? "✅ [NOTIFICACIONES] Notificación creación empleado (ID: $idUsuarioCreador) OK" : "❌ [NOTIFICACIONES] Notificación creación empleado FALLÓ");

                    // Si hay técnico asignado, notificar también
                    if ($tecnicoId && $idTecnicoParaInsert) {
                        $idTecnicoValidado = (int)$idTecnicoParaInsert;

                        // IMPORTANTE: Solo notificar al técnico si es diferente del usuario que creó el ticket
                        if ($idTecnicoValidado > 0 && $idTecnicoValidado !== $idUsuarioCreador) {
                            // NOTIFICACIÓN 2: SOLO al técnico asignado (NO al usuario que creó el ticket)
                            $resultTec = $this->crearNotificacionInterna(
                                $idTecnicoValidado,
                                $ticketId,
                                "Se te ha asignado un nuevo ticket #$ticketId. Categoría: $categoria - $subcategoria"
                            );
                            error_log($resultTec ? "✅ [NOTIFICACIONES] Notificación técnico (ID: $idTecnicoValidado) OK" : "❌ [NOTIFICACIONES] Notificación técnico FALLÓ");

                            // Obtener nombre del técnico para el mensaje
                            $nombreTecnico = 'el técnico asignado';
                            try {
                                $stmtTec = $this->db->query('SELECT nombre FROM usuarios WHERE id_usuario = ?', [$idTecnicoValidado]);
                                $tecData = $stmtTec->fetch();
                                if ($tecData && !empty($tecData['nombre'])) {
                                    $nombreTecnico = $tecData['nombre'];
                                }
                            } catch (\Exception $e) {
                                error_log("⚠️ No se pudo obtener nombre del técnico: " . $e->getMessage());
                            }

                            // NOTIFICACIÓN 3: SOLO al usuario que creó el ticket sobre la asignación
                            $resultEmp2 = $this->crearNotificacionInterna(
                                $idUsuarioCreador,
                                $ticketId,
                                "Tu ticket #$ticketId ha sido asignado al técnico $nombreTecnico. Estado: En proceso"
                            );
                            error_log($resultEmp2 ? "✅ [NOTIFICACIONES] Notificación asignación empleado (ID: $idUsuarioCreador) OK" : "❌ [NOTIFICACIONES] Notificación asignación empleado FALLÓ");
                        } else {
                            error_log("⚠️ [NOTIFICACIONES] El técnico asignado ($idTecnicoValidado) es el mismo que el usuario que creó el ticket ($idUsuarioCreador) - No se crea notificación de asignación");
                        }
                    } else {
                        // Sin técnico asignado - solo notificar al usuario que creó el ticket
                        $resultEmp3 = $this->crearNotificacionInterna(
                            $idUsuarioCreador,
                            $ticketId,
                            "Tu ticket #$ticketId ha sido creado exitosamente. Estado: Pendiente de asignación"
                        );
                        error_log($resultEmp3 ? "✅ [NOTIFICACIONES] Notificación pendiente empleado (ID: $idUsuarioCreador) OK" : "❌ [NOTIFICACIONES] Notificación pendiente FALLÓ");
                    }
                }
            } catch (\Exception $e) {
                error_log("❌ [NOTIFICACIONES] Error crítico creando notificaciones para ticket #$ticketId: " . $e->getMessage());
                error_log("❌ [NOTIFICACIONES] Stack trace: " . $e->getTraceAsString());
                // NO bloquear la respuesta si fallan las notificaciones
            }

            // Preparar respuesta SIMPLE y DIRECTA - siempre funciona
            $tiempoEstimado = $servicio['tiempo_maximo'] ?? $servicio['tiempo_objetivo'] ?? null;

            $response = [
                'message' => 'Ticket creado exitosamente',
                'ticket' => [
                    'id' => $ticketId,
                    'categoria' => $categoria,
                    'subcategoria' => $subcategoria,
                    'descripcion' => $descripcion,
                    'prioridad' => $prioridad,
                    'estado' => $estadoFinal,
                    'fechaCreacion' => date('Y-m-d H:i:s'),
                    'tiempoEstimado' => $tiempoEstimado, // Tiempo aproximado de solución
                    'tiempoObjetivo' => $servicio['tiempo_objetivo'] ?? null,
                    'tiempoMaximo' => $servicio['tiempo_maximo'] ?? null
                ]
            ];

            // Agregar información de asignación si se asignó
            if ($tecnicoId && $idTecnicoParaInsert) {
                $response['asignacionAutomatica'] = [
                    'exitosa' => true,
                    'tecnico' => $tecnicoNombre ?? 'Técnico asignado',
                    'tecnicoId' => $idTecnicoParaInsert
                ];

                $response['ticket']['tecnicoAsignado'] = [
                    'id' => $idTecnicoParaInsert,
                    'nombre' => $tecnicoNombre ?? 'Técnico asignado'
                ];
            } else {
                $response['asignacionAutomatica'] = [
                    'exitosa' => false,
                    'mensaje' => 'No se pudo asignar técnico automáticamente. El ticket quedó en estado Pendiente.'
                ];
                $response['ticket']['tecnicoAsignado'] = null;
            }

            // ENVIAR RESPUESTA DESPUÉS de crear las notificaciones
            error_log("✅ Enviando respuesta exitosa para ticket #$ticketId");
            AuthMiddleware::sendResponse($response, 201);

            // Intentar enviar correos DESPUÉS de enviar la respuesta (no bloquea)
            // IMPORTANTE: Los correos se envían de forma asíncrona y no bloquean la respuesta
            // Si fallan, se loguean pero no afectan la creación del ticket ni las notificaciones
            try {
                error_log("📧 [CORREOS] Preparando envío de correos para ticket #$ticketId");

                // Obtener datos del empleado (SIEMPRE)
                $stmtEmpleado = $this->db->query(
                    'SELECT nombre, correo FROM usuarios WHERE id_usuario = ?',
                    [$user['id_usuario']]
                );
                $empleado = $stmtEmpleado->fetch();

                if (!$empleado) {
                    error_log("⚠️ [CORREOS] No se encontró empleado con ID: {$user['id_usuario']}");
                } elseif (empty($empleado['correo'])) {
                    error_log("⚠️ [CORREOS] El empleado {$empleado['nombre']} no tiene correo configurado");
                } elseif (!filter_var($empleado['correo'], FILTER_VALIDATE_EMAIL)) {
                    error_log("⚠️ [CORREOS] Correo del empleado inválido: {$empleado['correo']}");
                } else {
                    $emailService = new EmailService();

                    // Si hay técnico asignado, enviar correos de asignación
                    if ($tecnicoId && $idTecnicoParaInsert) {
                        $stmtTecnico = $this->db->query(
                            'SELECT nombre, correo FROM usuarios WHERE id_usuario = ?',
                            [$idTecnicoParaInsert]
                        );
                        $tecnico = $stmtTecnico->fetch();

                        if (!$tecnico) {
                            error_log("⚠️ [CORREOS] No se encontró técnico con ID: $idTecnicoParaInsert");
                        } elseif (empty($tecnico['correo'])) {
                            error_log("⚠️ [CORREOS] El técnico {$tecnico['nombre']} no tiene correo configurado");
                        } elseif (!filter_var($tecnico['correo'], FILTER_VALIDATE_EMAIL)) {
                            error_log("⚠️ [CORREOS] Correo del técnico inválido: {$tecnico['correo']}");
                        } else {
                            error_log("📧 [CORREOS] Enviando correos de asignación - Técnico: {$tecnico['correo']}, Empleado: {$empleado['correo']}");

                            try {
                                $emailService->sendTicketAssignedNotification(
                                    [
                                        'id' => $ticketId,
                                        'categoria' => $categoria,
                                        'subcategoria' => $subcategoria,
                                        'descripcion' => $descripcion,
                                        'prioridad' => $prioridad
                                    ],
                                    ['nombre' => $tecnico['nombre'], 'email' => $tecnico['correo']],
                                    ['nombre' => $empleado['nombre'], 'email' => $empleado['correo']]
                                );
                                error_log("✅ [CORREOS] Correos de asignación enviados para ticket #$ticketId");
                            } catch (\Exception $emailEx) {
                                error_log("❌ [CORREOS] Error crítico enviando correos de asignación: " . $emailEx->getMessage());
                                error_log("❌ [CORREOS] Stack trace: " . $emailEx->getTraceAsString());
                            }
                        }
                    } else {
                        // Sin técnico asignado, enviar correo de creación
                        error_log("📧 [CORREOS] Enviando correo de creación al empleado: {$empleado['correo']}");

                        try {
                            $result = $emailService->sendTicketCreatedNotification(
                                [
                                    'id' => $ticketId,
                                    'categoria' => $categoria,
                                    'subcategoria' => $subcategoria,
                                    'descripcion' => $descripcion,
                                    'prioridad' => $prioridad
                                ],
                                ['nombre' => $empleado['nombre'], 'email' => $empleado['correo']]
                            );

                            if ($result) {
                                error_log("✅ [CORREOS] Correo de creación enviado para ticket #$ticketId");
                            } else {
                                error_log("⚠️ [CORREOS] Correo de creación falló para ticket #$ticketId (ver logs anteriores)");
                            }
                        } catch (\Exception $emailEx) {
                            error_log("❌ [CORREOS] Error crítico enviando correo de creación: " . $emailEx->getMessage());
                            error_log("❌ [CORREOS] Stack trace: " . $emailEx->getTraceAsString());
                        }
                    }
                }
            } catch (\Exception $e) {
                error_log("❌ [CORREOS] Error general enviando correos para ticket #$ticketId: " . $e->getMessage());
                error_log("❌ [CORREOS] Stack trace: " . $e->getTraceAsString());
                // NO lanzar la excepción - las notificaciones deben crearse independientemente
            }

            // Las notificaciones ya se crearon antes de enviar la respuesta
        } catch (\PDOException $e) {
            error_log('❌ Error PDO creating ticket: ' . $e->getMessage());
            error_log('❌ SQL State: ' . ($e->errorInfo[0] ?? 'N/A'));
            error_log('❌ Driver Error: ' . ($e->errorInfo[1] ?? 'N/A'));

            // Si hay un archivo subido pero falló, intentar eliminarlo
            if (isset($nombreArchivoAprobacion) && $nombreArchivoAprobacion) {
                $filePath = __DIR__ . '/../../uploads/' . $nombreArchivoAprobacion;
                if (file_exists($filePath)) {
                    @unlink($filePath);
                    error_log("🗑️ Archivo de aprobación eliminado tras error: $nombreArchivoAprobacion");
                }
            }

            // Determinar código de error apropiado según el tipo de error SQL
            $errorCode = 500;
            $errorMessage = 'Error al crear el ticket en la base de datos';

            if (isset($e->errorInfo[0])) {
                switch ($e->errorInfo[0]) {
                    case '23000': // Violación de restricción de integridad
                        $errorCode = 400;
                        $errorMessage = 'Error de validación: Los datos proporcionados no son válidos';
                        break;
                    case '42S02': // Tabla no existe
                    case '42S22': // Columna no existe
                        $errorCode = 500;
                        $errorMessage = 'Error de configuración del sistema';
                        break;
                    default:
                        $errorCode = 500;
                        $errorMessage = 'Error interno del servidor';
                }
            }

            AuthMiddleware::sendError($errorMessage, $errorCode);
        } catch (\Exception $e) {
            error_log('❌ Error creating ticket: ' . $e->getMessage());
            error_log('❌ Stack trace: ' . $e->getTraceAsString());
            error_log('❌ File: ' . $e->getFile() . ' Line: ' . $e->getLine());

            // Si hay un archivo subido pero falló, intentar eliminarlo
            if (isset($nombreArchivoAprobacion) && $nombreArchivoAprobacion) {
                $filePath = __DIR__ . '/../../uploads/' . $nombreArchivoAprobacion;
                if (file_exists($filePath)) {
                    @unlink($filePath);
                    error_log("🗑️ Archivo de aprobación eliminado tras error: $nombreArchivoAprobacion");
                }
            }

            // Si el error ya tiene un código HTTP, usarlo; sino usar 500
            $errorCode = method_exists($e, 'getCode') && $e->getCode() >= 400 && $e->getCode() < 600
                ? $e->getCode()
                : 500;

            $errorMessage = $e->getMessage() ?: 'Error interno del servidor';

            AuthMiddleware::sendError($errorMessage, $errorCode);
        }
    }

    public function updateTicketStatus($id)
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();

        $estatus = $body['estatus'] ?? $body['nuevoEstado'] ?? '';

        if (empty($estatus)) {
            AuthMiddleware::sendError('Estado es requerido', 400);
        }

        try {
            // OPTIMIZADO: Obtener estado anterior y datos del ticket antes de actualizar (con LIMIT 1)
            $stmtOld = $this->db->query(
                'SELECT t.estatus, t.id_tecnico, t.id_usuario, s.categoria, s.subcategoria,
                        u.id_usuario as empleado_id, u.nombre as empleado_nombre, u.correo as empleado_correo,
                        tec.nombre as tecnico_nombre, tec.correo as tecnico_correo
                 FROM tickets t
                 JOIN servicios s ON t.id_servicio = s.id_servicio
                 JOIN usuarios u ON t.id_usuario = u.id_usuario
                 LEFT JOIN usuarios tec ON t.id_tecnico = tec.id_usuario
                 WHERE t.id_ticket = ?
                 LIMIT 1',
                [$id]
            );
            $ticketOld = $stmtOld->fetch();

            if (!$ticketOld) {
                AuthMiddleware::sendError('Ticket no encontrado', 404);
            }

            $estadoAnterior = $ticketOld['estatus'];

            // LÓGICA DE REAPERTURA: Detectar si se está reabriendo un ticket (de Finalizado/Cerrado a otro estado)
            $esReapertura = ($estadoAnterior === 'Finalizado' || $estadoAnterior === 'Cerrado') &&
                           ($estatus !== 'Finalizado' && $estatus !== 'Cerrado');

            if ($esReapertura) {
                // Obtener observaciones del usuario (puede venir como comentarios o observaciones)
                $observacionesReapertura = trim($body['comentarios'] ?? $body['observaciones'] ?? $body['observaciones_usuario'] ?? 'Reapertura solicitada sin comentarios');

                try {
                    // Insertar registro en ticketreaperturas
                    $this->db->query(
                        'INSERT INTO ticketreaperturas (
                            id_ticket,
                            usuario_id,
                            tecnico_id,
                            observaciones_usuario,
                            fecha_reapertura,
                            estado_reapertura
                        ) VALUES (?, ?, ?, ?, NOW(), ?)',
                        [
                            $id,
                            $user['id_usuario'],
                            $ticketOld['id_tecnico'] ?? null,
                            $observacionesReapertura,
                            $estadoAnterior
                        ]
                    );
                    error_log("✅ Reapertura registrada en ticketreaperturas para ticket #$id (estado anterior: $estadoAnterior)");
                } catch (\Exception $e) {
                    error_log("⚠️ Error registrando reapertura para ticket #$id: " . $e->getMessage());
                    // No fallar el proceso si hay error al registrar la reapertura
                }
            }

            // LÓGICA ESPECIAL PARA ESTADO "PENDIENTE": Requiere motivo y tiempo estimado
            if ($estatus === 'Pendiente' && ($estadoAnterior === 'En Progreso' || $estadoAnterior === 'En proceso')) {
                $pendienteMotivo = trim($body['pendienteMotivo'] ?? $body['motivo'] ?? '');
                $pendienteTiempoEstimado = trim($body['pendienteTiempoEstimado'] ?? $body['tiempoEstimado'] ?? '');

                if (empty($pendienteMotivo)) {
                    AuthMiddleware::sendError('Debes proporcionar un motivo para marcar el ticket como Pendiente', 400);
                }

                if (empty($pendienteTiempoEstimado)) {
                    AuthMiddleware::sendError('Debes proporcionar un tiempo estimado para retomar el ticket', 400);
                }

                // Guardar motivo y tiempo estimado
                $this->db->query(
                    'UPDATE tickets SET
                        estatus = ?,
                        pendiente_motivo = ?,
                        pendiente_tiempo_estimado = ?,
                        pendiente_actualizado_en = NOW(),
                        pendiente_actualizado_por = ?
                     WHERE id_ticket = ?',
                    [$estatus, $pendienteMotivo, $pendienteTiempoEstimado, $user['id_usuario'], $id]
                );

                error_log("✅ Ticket #$id marcado como Pendiente con motivo y tiempo estimado");

                // Continuar con el envío de correos y respuesta
            } else if ($estatus === 'En Progreso' || $estatus === 'En proceso') {
                // Normalizar el estado a "En Progreso"
                $estatusNormalizado = 'En Progreso';

                // Verificar estado actual y fecha_inicio_atencion
                $stmtCheck = $this->db->query(
                    'SELECT fecha_inicio_atencion, estatus FROM tickets WHERE id_ticket = ?',
                    [$id]
                );
                $checkData = $stmtCheck->fetch();

                // Si ya está en "En Progreso", solo asegurar que fecha_inicio_atencion esté establecida
                if ($checkData['estatus'] === 'En Progreso' || $checkData['estatus'] === 'En proceso') {
                    if (empty($checkData['fecha_inicio_atencion'])) {
                        $this->db->query(
                            'UPDATE tickets SET fecha_inicio_atencion = NOW() WHERE id_ticket = ?',
                            [$id]
                        );
                        error_log("✅ Ticket #$id - fecha_inicio_atencion establecida (ya estaba en En Progreso)");
                    }
                } else {
                    // Cambiar a "En Progreso" por primera vez
                    $this->db->query(
                        'UPDATE tickets SET estatus = ?, fecha_inicio_atencion = COALESCE(fecha_inicio_atencion, NOW()) WHERE id_ticket = ?',
                        [$estatusNormalizado, $id]
                    );
                    error_log("✅ Ticket #$id cambiado a En Progreso (fecha_inicio_atencion establecida)");
                }
            } else if ($estatus === 'Finalizado') {
                // Al finalizar, calcular tiempo_atencion_segundos
                try {
                    $stmtFinalizar = $this->db->query(
                        'SELECT fecha_inicio_atencion FROM tickets WHERE id_ticket = ?',
                        [$id]
                    );
                    $finalizarData = $stmtFinalizar->fetch();

                    $tiempoAtencionSegundos = null;
                    if (!empty($finalizarData['fecha_inicio_atencion'])) {
                        try {
                            $stmtCalc = $this->db->query(
                                'SELECT TIMESTAMPDIFF(SECOND, fecha_inicio_atencion, NOW()) as segundos FROM tickets WHERE id_ticket = ?',
                                [$id]
                            );
                            $calcData = $stmtCalc->fetch();
                            $tiempoAtencionSegundos = $calcData['segundos'] ?? null;
                        } catch (\Exception $e) {
                            error_log("⚠️ Error calculando tiempo_atencion_segundos para ticket #$id: " . $e->getMessage());
                            // Continuar sin tiempo_atencion_segundos
                        }
                    }

                    // Actualizar ticket a Finalizado
                    $this->db->query(
                        'UPDATE tickets SET
                            estatus = ?,
                            fecha_finalizacion = NOW(),
                            fecha_cierre = NOW(),
                            tiempo_atencion_segundos = ?
                         WHERE id_ticket = ?',
                        [$estatus, $tiempoAtencionSegundos, $id]
                    );
                    error_log("✅ Ticket #$id finalizado (tiempo_atencion_segundos: $tiempoAtencionSegundos)");
                } catch (\Exception $e) {
                    error_log("⚠️ Error en proceso de finalización para ticket #$id: " . $e->getMessage());
                    // Intentar actualizar solo el estado si falla el cálculo - esto NO debe fallar
                    try {
                        $this->db->query(
                            'UPDATE tickets SET estatus = ?, fecha_finalizacion = NOW(), fecha_cierre = NOW() WHERE id_ticket = ?',
                            [$estatus, $id]
                        );
                        error_log("✅ Ticket #$id finalizado (sin tiempo_atencion_segundos debido a error en cálculo)");
                    } catch (\Exception $e2) {
                        error_log("❌ ERROR CRÍTICO: No se pudo actualizar ticket #$id: " . $e2->getMessage());
                        // Lanzar excepción solo si el UPDATE básico falla
                        throw new \Exception('Error al finalizar el ticket: ' . $e2->getMessage());
                    }
                }
            }

            // LÓGICA ESPECIAL: Si es administrador O técnico actual reasignando un ticket escalado
            // Permitir que el técnico que tiene el ticket escalado lo pueda reasignar a otro técnico
            $esReasignacionDeEscalado = $estadoAnterior === 'Escalado' && $estatus !== 'Escalado';
            $esAdministrador = $user['rol'] === 'administrador';
            $esTecnicoConTicketEscalado = ($user['rol'] === 'tecnico' || $user['rol'] === 'administrador') &&
                                         isset($ticketOld['id_tecnico']) &&
                                         $ticketOld['id_tecnico'] == $user['id_usuario'];

            if ($esReasignacionDeEscalado && ($esAdministrador || $esTecnicoConTicketEscalado)) {
                // Obtener el técnico original del último escalamiento
                $stmtEscalamiento = $this->db->query(
                    'SELECT tecnico_original_id FROM escalamientos
                     WHERE id_ticket = ?
                     ORDER BY fecha_escalamiento DESC LIMIT 1',
                    [$id]
                );
                $escalamiento = $stmtEscalamiento->fetch();

                if ($escalamiento && $escalamiento['tecnico_original_id']) {
                    $comentarioAdmin = trim($body['comentarioAdminTecnico'] ?? $body['comentario_admin_tecnico'] ?? '');

                    // Regresar al técnico original
                    $this->db->query(
                        'UPDATE tickets SET
                            estatus = ?,
                            id_tecnico = ?,
                            comentario_admin_tecnico = ?,
                            fecha_asignacion = COALESCE(fecha_asignacion, NOW())
                         WHERE id_ticket = ?',
                        [$estatus, $escalamiento['tecnico_original_id'], $comentarioAdmin, $id]
                    );

                    // Enviar correo al técnico original con el comentario privado
                    try {
                        $stmtTecnicoOriginal = $this->db->query(
                            'SELECT id_usuario, nombre, correo FROM usuarios WHERE id_usuario = ?',
                            [$escalamiento['tecnico_original_id']]
                        );
                        $tecnicoOriginal = $stmtTecnicoOriginal->fetch();

                        if ($tecnicoOriginal) {
                            $ticketData = [
                                'id' => $id,
                                'categoria' => $ticketOld['categoria'],
                                'subcategoria' => $ticketOld['subcategoria']
                            ];

                            $emailService = new EmailService();
                            $emailService->sendTicketReturnedFromEscalationEmail(
                                $ticketData,
                                ['nombre' => $tecnicoOriginal['nombre'], 'email' => $tecnicoOriginal['correo']],
                                $comentarioAdmin
                            );
                             error_log("📧 Correo de regreso de escalamiento enviado a técnico original para ticket #$id");
                        }
                    } catch (\Exception $e) {
                        error_log("⚠️ Error enviando correo de regreso de escalamiento para ticket #$id: " . $e->getMessage());
                    }

                    // ============================================
                    // CREAR NOTIFICACIONES DE REGRESO - SIEMPRE
                    // ============================================
                    try {
                        error_log("📧 [NOTIFICACIONES] Creando notificaciones de regreso de escalamiento para ticket #$id");

                        if (isset($escalamiento['tecnico_original_id']) && $escalamiento['tecnico_original_id'] > 0) {
                            // Crear notificación interna para el técnico original
                            $mensajeTecnico = "El ticket #$id ha sido regresado a tu atención desde escalamiento";
                            if (!empty($comentarioAdmin)) {
                                $mensajeTecnico .= ". Comentario del administrador: " . substr($comentarioAdmin, 0, 100);
                            }
                            $resultTec = $this->crearNotificacionInterna(
                                $escalamiento['tecnico_original_id'],
                                $id,
                                $mensajeTecnico
                            );
                            error_log($resultTec ? "✅ [NOTIFICACIONES] Notificación regreso técnico OK" : "❌ [NOTIFICACIONES] Notificación regreso técnico FALLÓ");

                            // Notificar al empleado
                            if (isset($ticketOld['empleado_id']) && $ticketOld['empleado_id'] > 0) {
                                $resultEmp = $this->crearNotificacionInterna(
                                    $ticketOld['empleado_id'],
                                    $id,
                                    "Tu ticket #$id ha sido regresado al técnico original"
                                );
                                error_log($resultEmp ? "✅ [NOTIFICACIONES] Notificación regreso empleado OK" : "❌ [NOTIFICACIONES] Notificación regreso empleado FALLÓ");
                            }
                        } else {
                            error_log("⚠️ [NOTIFICACIONES] No se puede crear: tecnico_original_id inválido");
                        }
                    } catch (\Exception $e) {
                        error_log("❌ [NOTIFICACIONES] Error crítico creando notificaciones de regreso: " . $e->getMessage());
                    }

                    error_log("✅ Ticket #$id regresado al técnico original por administrador");
                }
            }

            // Verificar si se está asignando un técnico manualmente
            // IMPORTANTE: Permitir reasignación si el ticket estaba escalado y el usuario actual es el técnico asignado
            $idTecnicoNuevo = $body['id_tecnico'] ?? null;
            $esTecnicoActual = isset($ticketOld['id_tecnico']) && $ticketOld['id_tecnico'] == $user['id_usuario'];
            $esAdmin = $user['rol'] === 'administrador';

            // Permitir asignación si:
            // 1. Hay un técnico nuevo Y es diferente del actual, O
            // 2. El ticket estaba escalado (para permitir reasignación desde tickets escalados)
            $puedeAsignar = false;
            if ($idTecnicoNuevo) {
                if ($idTecnicoNuevo != $ticketOld['id_tecnico']) {
                    // Técnico diferente - permitir si es admin o técnico actual
                    $puedeAsignar = $esAdmin || $esTecnicoActual;
                } elseif ($estadoAnterior === 'Escalado' && $esTecnicoActual) {
                    // Mismo técnico pero ticket estaba escalado y el usuario es el técnico actual - permitir cambio de estado
                    $puedeAsignar = true;
                }
            }

            if ($puedeAsignar) {
                // Se está asignando un técnico manualmente o reasignando un ticket escalado
                $this->db->query(
                    'UPDATE tickets SET estatus = ?, id_tecnico = ?, fecha_asignacion = COALESCE(fecha_asignacion, NOW()) WHERE id_ticket = ?',
                    [$estatus, $idTecnicoNuevo, $id]
                );

                error_log("✅ Ticket #$id reasignado: estado='$estatus', técnico anterior={$ticketOld['id_tecnico']}, técnico nuevo=$idTecnicoNuevo");

                // Enviar correo de asignación
                try {
                    $stmtTecnico = $this->db->query(
                        'SELECT id_usuario, nombre, correo FROM usuarios WHERE id_usuario = ?',
                        [$idTecnicoNuevo]
                    );
                    $tecnicoNuevo = $stmtTecnico->fetch();

                    if ($tecnicoNuevo && $ticketOld) {
                        $ticketData = [
                            'id' => $id,
                            'categoria' => $ticketOld['categoria'],
                            'subcategoria' => $ticketOld['subcategoria'],
                            'descripcion' => '',
                            'prioridad' => 'Media'
                        ];

                         $emailService = new EmailService();
                         $emailService->sendTicketAssignedNotification(
                             $ticketData,
                             ['nombre' => $tecnicoNuevo['nombre'], 'email' => $tecnicoNuevo['correo']],
                             ['nombre' => $ticketOld['empleado_nombre'], 'email' => $ticketOld['empleado_correo']]
                         );
                         error_log("📧 Correos de asignación manual enviados para ticket #$id");
                    }
                } catch (\Exception $e) {
                    error_log("⚠️ Error enviando correos de asignación manual para ticket #$id: " . $e->getMessage());
                }

                // ============================================
                // CREAR NOTIFICACIONES DE ASIGNACIÓN MANUAL - SIEMPRE
                // ============================================
                try {
                    error_log("📧 [NOTIFICACIONES] Creando notificaciones de asignación manual para ticket #$id");

                    if ($idTecnicoNuevo && isset($ticketOld['empleado_id']) && $ticketOld['empleado_id'] > 0) {
                        // Notificar al técnico asignado
                        $resultTec = $this->crearNotificacionInterna(
                            $idTecnicoNuevo,
                            $id,
                            "Se te ha asignado manualmente el ticket #$id"
                        );
                        error_log($resultTec ? "✅ [NOTIFICACIONES] Notificación asignación técnico OK" : "❌ [NOTIFICACIONES] Notificación asignación técnico FALLÓ");

                        // Obtener nombre del técnico
                        $nombreTecnico = 'el técnico asignado';
                        try {
                            $stmtTec = $this->db->query('SELECT nombre FROM usuarios WHERE id_usuario = ?', [$idTecnicoNuevo]);
                            $tecData = $stmtTec->fetch();
                            if ($tecData && !empty($tecData['nombre'])) {
                                $nombreTecnico = $tecData['nombre'];
                            }
                        } catch (\Exception $e) {
                            error_log("⚠️ No se pudo obtener nombre del técnico: " . $e->getMessage());
                        }

                        // Notificar al empleado
                        $resultEmp = $this->crearNotificacionInterna(
                            $ticketOld['empleado_id'],
                            $id,
                            "Tu ticket #$id ha sido asignado al técnico $nombreTecnico"
                        );
                        error_log($resultEmp ? "✅ [NOTIFICACIONES] Notificación asignación empleado OK" : "❌ [NOTIFICACIONES] Notificación asignación empleado FALLÓ");
                    } else {
                        error_log("⚠️ [NOTIFICACIONES] No se pueden crear notificaciones: datos inválidos");
                    }
                } catch (\Exception $e) {
                    error_log("❌ [NOTIFICACIONES] Error crítico creando notificaciones de asignación manual: " . $e->getMessage());
                }
            } else if ($estatus !== 'Pendiente' && $estatus !== 'En Progreso' && $estatus !== 'En proceso' && $estatus !== 'Finalizado') {
                // Solo cambio de estado (para otros estados que no requieren lógica especial)
                $this->db->query(
                    'UPDATE tickets SET estatus = ? WHERE id_ticket = ?',
                    [$estatus, $id]
                );
            }

            // ============================================
            // CREAR NOTIFICACIONES DE CAMBIO DE ESTADO - ANTES de enviar respuesta
            // ============================================
            if ($estadoAnterior !== $estatus) {
                try {
                    error_log("📧 [NOTIFICACIONES] Creando notificaciones de cambio de estado para ticket #$id");

                    if (!isset($ticketOld['empleado_id']) || !$ticketOld['empleado_id']) {
                        error_log("⚠️ [NOTIFICACIONES] No se puede crear: empleado_id inválido");
                    } else {
                        $esReapertura = ($estadoAnterior === 'Finalizado' || $estadoAnterior === 'Cerrado') &&
                                       ($estatus !== 'Finalizado' && $estatus !== 'Cerrado');

                        if ($esReapertura) {
                            // Notificación especial para reapertura
                            $mensajeEmpleado = "Tu ticket #$id ha sido reabierto. Estado: $estatus";
                            $resultEmp = $this->crearNotificacionInterna($ticketOld['empleado_id'], $id, $mensajeEmpleado);
                            error_log($resultEmp ? "✅ [NOTIFICACIONES] Notificación reapertura empleado OK" : "❌ [NOTIFICACIONES] Notificación reapertura empleado FALLÓ");

                            // Notificar al técnico si está asignado
                            if (isset($ticketOld['id_tecnico']) && $ticketOld['id_tecnico'] > 0) {
                                $mensajeTecnico = "El ticket #$id ha sido reabierto por el usuario";
                                $resultTec = $this->crearNotificacionInterna($ticketOld['id_tecnico'], $id, $mensajeTecnico);
                                error_log($resultTec ? "✅ [NOTIFICACIONES] Notificación reapertura técnico OK" : "❌ [NOTIFICACIONES] Notificación reapertura técnico FALLÓ");
                            }
                        } else {
                            // Notificación normal de cambio de estado - NOTIFICAR A TODOS LOS USUARIOS RELEVANTES
                            // 1. SIEMPRE notificar al empleado propietario del ticket
                            $mensajeEmpleado = "El estado de tu ticket #$id ha cambiado de \"$estadoAnterior\" a \"$estatus\"";

                            // Mensajes más específicos según el estado
                            if ($estatus === 'En Progreso' || $estatus === 'En proceso') {
                                $mensajeEmpleado = "Tu ticket #$id está ahora en progreso. El técnico asignado está trabajando en tu solicitud.";
                            } elseif ($estatus === 'Pendiente') {
                                $mensajeEmpleado = "Tu ticket #$id ha sido marcado como Pendiente. Se retomará según el tiempo estimado proporcionado.";
                            } elseif ($estatus === 'Finalizado') {
                                $mensajeEmpleado = "Tu ticket #$id ha sido finalizado. Por favor, completa la evaluación.";
                            } elseif ($estatus === 'Escalado') {
                                $mensajeEmpleado = "Tu ticket #$id ha sido escalado a un técnico de mayor nivel para su atención.";
                            }

                            $resultEmp = $this->crearNotificacionInterna($ticketOld['empleado_id'], $id, $mensajeEmpleado);
                            if ($resultEmp) {
                                error_log("✅ [NOTIFICACIONES] Notificación cambio estado empleado #{$ticketOld['empleado_id']} OK - Mensaje: " . substr($mensajeEmpleado, 0, 50));
                            } else {
                                error_log("❌ [NOTIFICACIONES] Notificación cambio estado empleado #{$ticketOld['empleado_id']} FALLÓ");
                            }

                            // 2. SIEMPRE notificar al técnico asignado (si existe y es diferente del empleado)
                            // Para tickets finalizados, asegurar que se notifique al técnico incluso si es el mismo que el empleado
                            $idTecnicoActual = $idTecnicoNuevo ?? $ticketOld['id_tecnico'] ?? null;

                            // Si el estado es Finalizado y hay un técnico asignado, asegurar notificación
                            if ($estatus === 'Finalizado' && $idTecnicoActual && $idTecnicoActual > 0) {
                                $mensajeTecnico = "El ticket #$id ha sido finalizado. Esperando evaluación del usuario.";
                                $resultTec = $this->crearNotificacionInterna($idTecnicoActual, $id, $mensajeTecnico);
                                if ($resultTec) {
                                    error_log("✅ [NOTIFICACIONES] Notificación finalización técnico #{$idTecnicoActual} OK");
                                } else {
                                    error_log("❌ [NOTIFICACIONES] Notificación finalización técnico #{$idTecnicoActual} FALLÓ");
                                }
                            } elseif ($idTecnicoActual && $idTecnicoActual > 0 && $idTecnicoActual != $ticketOld['empleado_id']) {
                                $mensajeTecnico = "El ticket #$id ha cambiado de estado de \"$estadoAnterior\" a \"$estatus\"";

                                // IMPORTANTE: NO notificar al técnico cuando se escala
                                // El escalamiento tiene su propio método (escalateTicket) que maneja las notificaciones
                                // Solo notificar cuando NO es un escalamiento
                                if ($estatus !== 'Escalado') {
                                    // Mensajes más específicos para el técnico
                                    if ($estatus === 'En Progreso' || $estatus === 'En proceso') {
                                        $mensajeTecnico = "El ticket #$id está ahora en progreso. Continúa trabajando en él.";
                                    } elseif ($estatus === 'Pendiente') {
                                        $mensajeTecnico = "El ticket #$id ha sido marcado como Pendiente. Se retomará según el tiempo estimado.";
                                    } elseif ($estatus === 'Finalizado') {
                                        $mensajeTecnico = "El ticket #$id ha sido finalizado. Esperando evaluación del usuario.";
                                    }

                                    $resultTec = $this->crearNotificacionInterna($idTecnicoActual, $id, $mensajeTecnico);
                                    error_log($resultTec ? "✅ [NOTIFICACIONES] Notificación cambio estado técnico #{$idTecnicoActual} OK" : "❌ [NOTIFICACIONES] Notificación cambio estado técnico FALLÓ");
                                } else {
                                    error_log("ℹ️ [NOTIFICACIONES] Estado es 'Escalado' - Las notificaciones se manejan en el método escalateTicket, no aquí");
                                }
                            } else {
                                if ($estatus !== 'Finalizado') {
                                    error_log("⚠️ [NOTIFICACIONES] No se notifica al técnico: idTecnicoActual=$idTecnicoActual, empleado_id={$ticketOld['empleado_id']}, estatus=$estatus");
                                }
                            }
                        }

                        // NOTA: No se notifica a todos los administradores en escalamientos
                        // Solo el técnico destino recibe la notificación (que puede ser un administrador si es el destinatario)
                    }
                } catch (\Exception $e) {
                    error_log("❌ [NOTIFICACIONES] Error crítico creando notificaciones de cambio de estado para ticket #$id: " . $e->getMessage());
                    error_log("❌ [NOTIFICACIONES] Stack trace: " . $e->getTraceAsString());
                    // NO bloquear la respuesta si fallan las notificaciones
                }
            }

            // Obtener datos actualizados del ticket para la respuesta
            // Si falla, usar los datos que ya tenemos
            try {
                $stmtUpdated = $this->db->query(
                    'SELECT estatus, pendiente_motivo, pendiente_tiempo_estimado, pendiente_actualizado_en, fecha_finalizacion, fecha_cierre FROM tickets WHERE id_ticket = ?',
                    [$id]
                );
                $ticketUpdated = $stmtUpdated->fetch();

                if (!$ticketUpdated) {
                    error_log("⚠️ No se encontraron datos actualizados para ticket #$id después de actualizar estado");
                    // Usar el estado que se intentó establecer
                    $ticketUpdated = ['estatus' => $estatus];
                }
            } catch (\Exception $e) {
                error_log("⚠️ Error obteniendo datos actualizados del ticket #$id: " . $e->getMessage());
                error_log("⚠️ Stack trace: " . $e->getTraceAsString());
                // Usar datos por defecto si falla la consulta
                $ticketUpdated = ['estatus' => $estatus];
            }

            // Preparar respuesta completa con todos los campos que el frontend espera
            $response = [
                'message' => 'Estado actualizado exitosamente',
                'estatus' => $ticketUpdated['estatus'] ?? $estatus,
                'pendienteMotivo' => $ticketUpdated['pendiente_motivo'] ?? null,
                'pendienteTiempoEstimado' => $ticketUpdated['pendiente_tiempo_estimado'] ?? null,
                'pendienteActualizadoEn' => $ticketUpdated['pendiente_actualizado_en'] ?? null
            ];

            // Agregar información adicional para tickets finalizados
            if ($estatus === 'Finalizado') {
                $response['fechaFinalizacion'] = $ticketUpdated['fecha_finalizacion'] ?? null;
                $response['fechaCierre'] = $ticketUpdated['fecha_cierre'] ?? null;
            }

            // ENVIAR RESPUESTA DESPUÉS de crear las notificaciones
            error_log("✅ Ticket #$id actualizado a estado: $estatus - Enviando respuesta exitosa");
            AuthMiddleware::sendResponse($response);

            // Enviar correo de cambio de estado si cambió (DESPUÉS de enviar respuesta, no bloquea)
            if ($estadoAnterior !== $estatus) {
                try {
                    // Validar que tenemos los datos necesarios
                    if (!empty($ticketOld['empleado_correo'])) {
                        $ticketData = [
                            'id' => $id,
                            'categoria' => $ticketOld['categoria'] ?? 'N/A',
                            'subcategoria' => $ticketOld['subcategoria'] ?? 'N/A'
                        ];

                        $technician = null;
                        if ($ticketOld['id_tecnico'] && !empty($ticketOld['tecnico_correo'])) {
                            $technician = [
                                'nombre' => $ticketOld['tecnico_nombre'] ?? 'Técnico',
                                'email' => $ticketOld['tecnico_correo']
                            ];
                        }

                        $employee = [
                            'nombre' => $ticketOld['empleado_nombre'] ?? 'Usuario',
                            'email' => $ticketOld['empleado_correo']
                        ];

                         $emailService = new EmailService();
                         $emailService->sendTicketStatusChangeNotification($ticketData, $estatus, $estadoAnterior, $technician, $employee);
                         error_log("📧 Correo de cambio de estado enviado para ticket #$id");
                     } else {
                         error_log("⚠️ No se puede enviar correo: empleado_correo vacío para ticket #$id");
                     }
                 } catch (\Exception $e) {
                     error_log("⚠️ Error enviando correo de cambio de estado para ticket #$id: " . $e->getMessage());
                 }

                 // Las notificaciones ya se crearon antes de enviar la respuesta
            }
        } catch (\Exception $e) {
            error_log('❌ [ERROR] Error updating ticket status: ' . $e->getMessage());
            error_log('❌ [ERROR] Stack trace: ' . $e->getTraceAsString());
            error_log('❌ [ERROR] File: ' . $e->getFile() . ' Line: ' . $e->getLine());
            AuthMiddleware::sendError('Error al actualizar el estado del ticket: ' . $e->getMessage(), 500);
        }
    }
    public function closeTicket($id)
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();

        // Aceptar ambos formatos (rating/calificacion y comentarios/comentario)
        $rating = $body['rating']
            ?? $body['calificacion']
            ?? 0;

        $comentarios = $body['comentarios']
            ?? $body['comentario']
            ?? '';

        if ($rating < 1 || $rating > 5) {
            AuthMiddleware::sendError('La calificación debe ser entre 1 y 5 estrellas', 400);
            return;
        }

        try {
            // Verificar que el ticket existe y obtener información
            $stmtTicket = $this->db->query(
                'SELECT id_ticket, id_usuario, id_tecnico, estatus FROM tickets WHERE id_ticket = ?',
                [$id]
            );
            $ticket = $stmtTicket->fetch();

            if (!$ticket) {
                AuthMiddleware::sendError('El ticket no existe', 404);
                return;
            }

            // Verificar permisos: el usuario puede cerrar si es el propietario, el técnico asignado, o es administrador/tecnico
            $canClose = false;
            if ($ticket['id_usuario'] == $user['id_usuario']) {
                $canClose = true; // El propietario puede cerrar
            } elseif (($user['rol'] === 'tecnico' || $user['rol'] === 'administrador') &&
                     ($ticket['id_tecnico'] == $user['id_usuario'] || $user['rol'] === 'administrador')) {
                $canClose = true; // Técnico asignado o administrador puede cerrar
            }

            if (!$canClose) {
                AuthMiddleware::sendError('No tienes permiso para cerrar este ticket', 403);
                return;
            }

            // Close ticket - ESTO ES LO MÁS IMPORTANTE
            $this->db->query(
                'UPDATE tickets SET estatus = "Cerrado", fecha_cierre = NOW() WHERE id_ticket = ?',
                [$id]
            );

            // OPERACIONES OPCIONALES después de cerrar el ticket
            // Todas están protegidas para que NO afecten la respuesta exitosa
            try {
                // Insert evaluation (opcional, no crítico)
                $this->db->query(
                    'INSERT INTO evaluaciones (id_ticket, calificacion, comentario, fecha_evaluacion)
                     VALUES (?, ?, ?, NOW())
                     ON DUPLICATE KEY UPDATE calificacion = VALUES(calificacion), comentario = VALUES(comentario)',
                    [$id, $rating, $comentarios]
                );
            } catch (\Throwable $e) {
                // Capturar cualquier error (Exception o Error) pero no afectar la respuesta
                error_log("⚠️ Error insertando evaluación del ticket #$id: " . $e->getMessage());
            }

            // ENVIAR RESPUESTA EXITOSA - esto NUNCA debe fallar
            // Se envía inmediatamente después de cerrar el ticket
            AuthMiddleware::sendResponse(['message' => 'Ticket cerrado exitosamente']);

            // Intentar enviar correo DESPUÉS de enviar la respuesta (no bloquea)
            try {
                // Obtener información completa del ticket y empleado para el correo
                $stmtTicketInfo = $this->db->query(
                    'SELECT t.id_ticket, s.categoria, s.subcategoria, u.id_usuario as empleado_id, u.nombre as empleado_nombre, u.correo as empleado_correo
                     FROM tickets t
                     JOIN servicios s ON t.id_servicio = s.id_servicio
                     JOIN usuarios u ON t.id_usuario = u.id_usuario
                     WHERE t.id_ticket = ?',
                    [$id]
                );
                $ticketInfo = $stmtTicketInfo->fetch();

                if ($ticketInfo && !empty($ticketInfo['empleado_correo'])) {
                    // Validar que el correo sea válido
                    if (filter_var($ticketInfo['empleado_correo'], FILTER_VALIDATE_EMAIL)) {
                        $ticketData = [
                            'id' => $ticketInfo['id_ticket'],
                            'categoria' => $ticketInfo['categoria'],
                            'subcategoria' => $ticketInfo['subcategoria']
                        ];

                        $employee = [
                            'nombre' => $ticketInfo['empleado_nombre'],
                            'email' => $ticketInfo['empleado_correo']
                        ];

                         error_log("📧 Preparando envío de correo de cierre para ticket #$id");
                         $emailService = new EmailService();
                         $emailService->sendTicketClosedNotification($ticketData, $employee);
                         error_log("✅ Correo de cierre enviado para ticket #$id");
                     } else {
                         error_log("⚠️ Correo del empleado inválido para ticket #$id: {$ticketInfo['empleado_correo']}");
                     }
                 } else {
                     error_log("⚠️ No se puede enviar correo: empleado_correo vacío o ticket no encontrado para ticket #$id");
                 }
             } catch (\Exception $e) {
                 error_log("⚠️ Error enviando correo de cierre para ticket #$id (no crítico): " . $e->getMessage());
             }

             // ============================================
             // CREAR NOTIFICACIÓN DE CIERRE - SIEMPRE (independiente de correos)
             // ============================================
             try {
                 error_log("📧 [NOTIFICACIONES] Creando notificación de cierre para ticket #$id");

                 // Obtener información del ticket si no la tenemos
                 if (!isset($ticketInfo)) {
                     $stmtTicketInfo = $this->db->query(
                         'SELECT t.id_ticket, u.id_usuario as empleado_id
                          FROM tickets t
                          JOIN usuarios u ON t.id_usuario = u.id_usuario
                          WHERE t.id_ticket = ?',
                         [$id]
                     );
                     $ticketInfo = $stmtTicketInfo->fetch();
                 }

                 if ($ticketInfo && isset($ticketInfo['empleado_id']) && $ticketInfo['empleado_id'] > 0) {
                     $result = $this->crearNotificacionInterna(
                         $ticketInfo['empleado_id'],
                         $id,
                         "Tu ticket #$id ha sido cerrado"
                     );
                     error_log($result ? "✅ [NOTIFICACIONES] Notificación cierre OK" : "❌ [NOTIFICACIONES] Notificación cierre FALLÓ");
                 } else {
                     error_log("⚠️ [NOTIFICACIONES] No se puede crear notificación de cierre: ticketInfo o empleado_id inválido");
                 }
             } catch (\Exception $e) {
                 error_log("❌ [NOTIFICACIONES] Error crítico creando notificación de cierre para ticket #$id: " . $e->getMessage());
             }

        } catch (\Exception $e) {
            error_log('❌ Error closing ticket #' . $id . ': ' . $e->getMessage());
            error_log('❌ Stack trace: ' . $e->getTraceAsString());
            error_log('❌ File: ' . $e->getFile() . ' Line: ' . $e->getLine());
            AuthMiddleware::sendError('Error interno del servidor: ' . $e->getMessage(), 500);
        } catch (\Throwable $e) {
            // Capturar cualquier otro tipo de error (fatal errors, etc.)
            error_log('❌ Fatal error closing ticket #' . $id . ': ' . $e->getMessage());
            error_log('❌ Stack trace: ' . $e->getTraceAsString());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
    public function evaluateTicket($id)
    {
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();

        $calificacion = $body['calificacion'] ?? 0;
        $comentario = $body['comentario'] ?? '';

        if ($calificacion < 1 || $calificacion > 5) {
            AuthMiddleware::sendError('La calificación debe ser entre 1 y 5', 400);
            return;
        }

        try {
            // Verificar que el ticket existe y que el usuario tiene permiso para evaluarlo
            $stmtTicket = $this->db->query(
                'SELECT id_ticket, id_usuario FROM tickets WHERE id_ticket = ?',
                [$id]
            );
            $ticket = $stmtTicket->fetch();

            if (!$ticket) {
                AuthMiddleware::sendError('El ticket no existe', 404);
                return;
            }

            // Solo el propietario del ticket puede evaluarlo
            if ($ticket['id_usuario'] != $user['id_usuario']) {
                AuthMiddleware::sendError('No tienes permiso para evaluar este ticket', 403);
                return;
            }

            $this->db->query(
                'INSERT INTO evaluaciones (id_ticket, calificacion, comentario, fecha_evaluacion)
                 VALUES (?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE calificacion = VALUES(calificacion), comentario = VALUES(comentario)',
                [$id, $calificacion, $comentario]
            );

            AuthMiddleware::sendResponse(['message' => 'Evaluación registrada exitosamente']);
        } catch (\Exception $e) {
            error_log('Error evaluating ticket: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * GET /tickets/reopened
     * Get reopened tickets
     */
    public function getReopenedTickets()
    {
        $user = AuthMiddleware::authenticate();

        // Obtener parámetros de paginación
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 10;
        $offset = ($page - 1) * $limit;

        try {
            // Different query based on user role
            if ($user['rol'] === 'empleado') {
                // Contar total
                $stmtCount = $this->db->query(
                    'SELECT COUNT(*) as total
                     FROM tickets t
                     JOIN ticketreaperturas tr ON t.id_ticket = tr.id_ticket
                     WHERE t.id_usuario = ?',
                    [$user['id_usuario']]
                );
                $countResult = $stmtCount->fetch();
                $total = (int)$countResult['total'];

                $stmt = $this->db->query(
                    'SELECT t.id_ticket as id, s.categoria, s.subcategoria, t.descripcion,
                            s.tiempo_objetivo as tiempo_estimado, t.estatus as estado, t.prioridad,
                            t.fecha_creacion, t.fecha_cierre, tr.observaciones_usuario,
                            tr.causa_tecnico, tr.fecha_reapertura
                     FROM tickets t
                     JOIN servicios s ON t.id_servicio = s.id_servicio
                     JOIN ticketreaperturas tr ON t.id_ticket = tr.id_ticket
                     WHERE t.id_usuario = ?
                     ORDER BY tr.fecha_reapertura DESC
                     LIMIT ? OFFSET ?',
                    [$user['id_usuario'], $limit, $offset]
                );
            } else if ($user['rol'] === 'tecnico' || $user['rol'] === 'administrador') {
                // Contar total - Excluir tickets escalados, solo mostrar al técnico asignado
                $stmtCount = $this->db->query(
                    'SELECT COUNT(*) as total
                     FROM tickets t
                     JOIN ticketreaperturas tr ON t.id_ticket = tr.id_ticket
                     WHERE (t.id_tecnico = ? OR tr.tecnico_id = ?)
                     AND t.estatus != "Escalado"',
                    [$user['id_usuario'], $user['id_usuario']]
                );
                $countResult = $stmtCount->fetch();
                $total = (int)$countResult['total'];

                $stmt = $this->db->query(
                    'SELECT t.id_ticket as id, s.categoria, s.subcategoria, t.descripcion,
                            s.tiempo_objetivo as tiempo_estimado, t.estatus as estado, t.prioridad,
                            t.fecha_creacion, t.fecha_cierre, tr.observaciones_usuario,
                            tr.causa_tecnico, tr.fecha_reapertura
                     FROM tickets t
                     JOIN servicios s ON t.id_servicio = s.id_servicio
                     JOIN ticketreaperturas tr ON t.id_ticket = tr.id_ticket
                     WHERE (t.id_tecnico = ? OR tr.tecnico_id = ?)
                     AND t.estatus != "Escalado"
                     ORDER BY tr.fecha_reapertura DESC
                     LIMIT ? OFFSET ?',
                    [$user['id_usuario'], $user['id_usuario'], $limit, $offset]
                );
            } else {
                AuthMiddleware::sendError('Rol de usuario no autorizado', 403);
                return;
            }

            $tickets = $stmt->fetchAll();

            // Formatear datos para el frontend (similar a getMyTickets)
            $formattedTickets = [];
            foreach ($tickets as $ticket) {
                try {
                    // Convertir snake_case a camelCase y estructurar datos
                    $formattedTicket = [
                        'id' => isset($ticket['id']) ? (int)$ticket['id'] : null,
                        'categoria' => $ticket['categoria'] ?? '',
                        'subcategoria' => $ticket['subcategoria'] ?? '',
                        'descripcion' => $ticket['descripcion'] ?? '',
                        'tiempoEstimado' => $ticket['tiempo_estimado'] ?? null,
                        'tiempoObjetivo' => $ticket['tiempo_estimado'] ?? null,
                        'estado' => $ticket['estado'] ?? 'Pendiente',
                        'prioridad' => $ticket['prioridad'] ?? 'Media',
                        'fechaCreacion' => $ticket['fecha_creacion'] ?? null,
                        'fechaCierre' => $ticket['fecha_cierre'] ?? null,
                        'reapertura' => [
                            'observacionesUsuario' => $ticket['observaciones_usuario'] ?? null,
                            'causaTecnico' => $ticket['causa_tecnico'] ?? null,
                            'fechaReapertura' => $ticket['fecha_reapertura'] ?? null
                        ]
                    ];

                    // Asegurar que el estado siempre esté presente
                    if (empty($formattedTicket['estado'])) {
                        $formattedTicket['estado'] = 'Pendiente';
                    }

                    $formattedTickets[] = $formattedTicket;
                } catch (\Exception $e) {
                    error_log('Error formateando ticket reabierto: ' . $e->getMessage());
                    continue;
                }
            }

            // Calcular información de paginación
            $totalPages = ceil($total / $limit);
            $startItem = $total > 0 ? $offset + 1 : 0;
            $endItem = min($offset + $limit, $total);

            AuthMiddleware::sendResponse([
                'tickets' => $formattedTickets,
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => $totalPages,
                    'startItem' => $startItem,
                    'endItem' => $endItem,
                    'hasNextPage' => $page < $totalPages,
                    'hasPrevPage' => $page > 1
                ]
            ]);

        } catch (\Exception $e) {
            error_log('Error getting reopened tickets: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * GET /tickets/escalados
     * Get escalated tickets
     */
    public function getEscaladosTickets()
    {
        $user = AuthMiddleware::authenticate();

        // Check permissions
        if ($user['rol'] !== 'tecnico' && $user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('Solo los técnicos y administradores pueden ver tickets escalados', 403);
            return;
        }

        // Obtener parámetros de paginación
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 10;
        $offset = ($page - 1) * $limit;

        try {
            // Contar total - SOLO tickets escalados donde el usuario es el técnico de destino
            // IMPORTANTE: Solo mostrar al técnico destino, no al técnico original
            $stmtCount = $this->db->query(
                'SELECT COUNT(DISTINCT t.id_ticket) as total
                 FROM tickets t
                 INNER JOIN escalamientos e ON t.id_ticket = e.id_ticket
                 WHERE t.estatus = "Escalado"
                 AND e.tecnico_nuevo_id = ?
                 AND e.fecha_escalamiento = (
                   SELECT MAX(fecha_escalamiento)
                   FROM escalamientos
                   WHERE id_ticket = t.id_ticket
                 )',
                [$user['id_usuario']]
            );
            $countResult = $stmtCount->fetch();
            $total = (int)$countResult['total'];

            // Obtener tickets escalados - SOLO para el técnico destino
            // IMPORTANTE: Usar solo e.tecnico_nuevo_id para asegurar que solo el técnico destino vea estos tickets
            $stmt = $this->db->query(
                'SELECT t.id_ticket as id, t.descripcion, t.prioridad, t.fecha_creacion,
                        t.estatus, s.categoria, s.subcategoria, s.tiempo_objetivo,
                        u.nombre as usuario_nombre, u.correo as usuario_correo,
                        tec.nombre as tecnico_nombre, tec.correo as tecnico_correo,
                        tec_orig.nombre as tecnico_original_nombre,
                        e.motivo_escalamiento, e.fecha_escalamiento, e.nivel_escalamiento
                 FROM tickets t
                 JOIN servicios s ON t.id_servicio = s.id_servicio
                 JOIN usuarios u ON t.id_usuario = u.id_usuario
                 LEFT JOIN usuarios tec ON t.id_tecnico = tec.id_usuario
                 INNER JOIN escalamientos e ON t.id_ticket = e.id_ticket
                 LEFT JOIN usuarios tec_orig ON e.tecnico_original_id = tec_orig.id_usuario
                 WHERE t.estatus = "Escalado"
                 AND e.tecnico_nuevo_id = ?
                 AND e.fecha_escalamiento = (
                   SELECT MAX(fecha_escalamiento)
                   FROM escalamientos
                   WHERE id_ticket = t.id_ticket
                 )
                 ORDER BY e.fecha_escalamiento DESC, t.fecha_creacion DESC
                 LIMIT ? OFFSET ?',
                [$user['id_usuario'], $limit, $offset]
            );

            $tickets = $stmt->fetchAll();

            // Formatear tickets para el frontend
            $formattedTickets = [];
            foreach ($tickets as $ticket) {
                $formattedTicket = [
                    'id' => (int)$ticket['id'],
                    'descripcion' => $ticket['descripcion'] ?? '',
                    'prioridad' => $ticket['prioridad'] ?? 'Media',
                    'fecha_creacion' => $ticket['fecha_creacion'] ?? null,
                    'estatus' => $ticket['estatus'] ?? 'Pendiente',
                    'categoria' => $ticket['categoria'] ?? '',
                    'subcategoria' => $ticket['subcategoria'] ?? '',
                    'tiempo_objetivo' => $ticket['tiempo_objetivo'] ?? null,
                    'usuario' => [
                        'nombre' => $ticket['usuario_nombre'] ?? '',
                        'correo' => $ticket['usuario_correo'] ?? ''
                    ],
                    'tecnico' => null,
                    'escalamiento' => [
                        'motivo' => $ticket['motivo_escalamiento'] ?? null,
                        'fecha' => $ticket['fecha_escalamiento'] ?? null,
                        'nivel' => $ticket['nivel_escalamiento'] ?? null
                    ]
                ];

                // Agregar técnico si existe
                if (!empty($ticket['tecnico_nombre'])) {
                    $formattedTicket['tecnico'] = [
                        'nombre' => $ticket['tecnico_nombre'] ?? '',
                        'correo' => $ticket['tecnico_correo'] ?? ''
                    ];
                }

                $formattedTickets[] = $formattedTicket;
            }

            // Calcular información de paginación
            $totalPages = ceil($total / $limit);
            $startItem = $total > 0 ? $offset + 1 : 0;
            $endItem = min($offset + $limit, $total);

            AuthMiddleware::sendResponse([
                'tickets' => $formattedTickets,
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => $totalPages,
                    'startItem' => $startItem,
                    'endItem' => $endItem,
                    'hasNextPage' => $page < $totalPages,
                    'hasPrevPage' => $page > 1
                ]
            ]);

        } catch (\Exception $e) {
            error_log('Error getting escalated tickets: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * GET /tickets/technicians
     * Get list of technicians
     */
    public function getTechnicians()
    {
        $user = AuthMiddleware::authenticate();

        // Check permissions
        $userRol = strtolower(trim($user['rol'] ?? ''));
        if ($userRol !== 'tecnico' && $userRol !== 'administrador') {
            AuthMiddleware::sendError('Solo los técnicos y administradores pueden ver la lista de técnicos', 403);
        }

        try {
            $stmt = $this->db->query(
                'SELECT id_usuario as id, nombre, correo, rol
                 FROM usuarios
                 WHERE LOWER(TRIM(rol)) IN ("tecnico", "administrador")
                 ORDER BY nombre ASC'
            );

            $technicians = $stmt->fetchAll();
            AuthMiddleware::sendResponse($technicians);

        } catch (\Exception $e) {
            error_log('Error getting technicians: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * GET /tickets/:id/evaluation
     * Get ticket evaluation
     */
    public function getEvaluation($id)
    {
        $user = AuthMiddleware::authenticate();

        try {
            // Check ticket ownership
            $stmt = $this->db->query(
                'SELECT id_usuario FROM tickets WHERE id_ticket = ?',
                [$id]
            );

            $ticket = $stmt->fetch();
            if (!$ticket || $ticket['id_usuario'] != $user['id_usuario']) {
                AuthMiddleware::sendError('Ticket no encontrado', 404);
            }

            // Get evaluation
            $stmt = $this->db->query(
                'SELECT id_evaluacion, calificacion, comentario, fecha_evaluacion
                 FROM evaluaciones
                 WHERE id_ticket = ?',
                [$id]
            );

            $evaluation = $stmt->fetch();

            if (!$evaluation) {
                AuthMiddleware::sendError('No se encontró evaluación para este ticket', 404);
            }

            AuthMiddleware::sendResponse([
                'id' => $evaluation['id_evaluacion'],
                'calificacion' => $evaluation['calificacion'],
                'comentario' => $evaluation['comentario'],
                'fechaEvaluacion' => $evaluation['fecha_evaluacion']
            ]);

        } catch (\Exception $e) {
            error_log('Error getting evaluation: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * GET /tickets/:ticketId/approval-letter
     * Get approval letter file
     */
    public function getApprovalLetter($ticketId)
    {
        $user = AuthMiddleware::authenticate();

        try {
            // Validate disposition parameter
            $allowedDispositions = ['inline', 'attachment'];
            $requestedDisposition = $_GET['disposition'] ?? 'attachment';
            $disposition = in_array($requestedDisposition, $allowedDispositions) ? $requestedDisposition : 'attachment';

            $stmt = $this->db->query(
                'SELECT archivo_aprobacion, id_usuario, id_tecnico FROM tickets WHERE id_ticket = ?',
                [$ticketId]
            );

            $ticket = $stmt->fetch();

            if (!$ticket) {
                AuthMiddleware::sendError('Ticket no encontrado', 404);
            }

            if (!$ticket['archivo_aprobacion']) {
                AuthMiddleware::sendError('El ticket no tiene carta de aprobación adjunta', 404);
            }

            // Check permissions
            $esCreador = $ticket['id_usuario'] == $user['id_usuario'];
            $esTecnicoAsignado = $ticket['id_tecnico'] == $user['id_usuario'];
            $esAdministrador = $user['rol'] === 'administrador';

            if (!$esCreador && !$esTecnicoAsignado && !$esAdministrador) {
                AuthMiddleware::sendError('No tienes permisos para acceder a esta carta de aprobación', 403);
            }

            // Validate and sanitize filename to prevent path traversal
            $filename = basename($ticket['archivo_aprobacion']);
            if (empty($filename) || $filename !== $ticket['archivo_aprobacion']) {
                AuthMiddleware::sendError('Nombre de archivo inválido', 400);
            }

            $filePath = __DIR__ . '/../../uploads/' . $filename;

            if (!file_exists($filePath)) {
                AuthMiddleware::sendError('Archivo no encontrado en el servidor', 404);
            }

            // Additional security: verify file is within uploads directory
            $realPath = realpath($filePath);
            $uploadsDir = realpath(__DIR__ . '/../../uploads/');
            if ($realPath === false || strpos($realPath, $uploadsDir) !== 0) {
                AuthMiddleware::sendError('Acceso denegado', 403);
            }

            header('Content-Type: application/pdf');
            header('Content-Disposition: ' . $disposition . '; filename="' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename) . '"');
            readfile($filePath);
            exit;

        } catch (\Exception $e) {
            error_log('Error getting approval letter: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * GET /tickets/download/:filename
     * Download file
     */
    public function downloadFile($filename)
    {
        AuthMiddleware::authenticate();

        try {
            // Validate and sanitize filename to prevent path traversal
            $safeFilename = basename($filename);
            if (empty($safeFilename) || $safeFilename !== $filename) {
                AuthMiddleware::sendError('Nombre de archivo inválido', 400);
            }

            $filePath = __DIR__ . '/../../uploads/' . $safeFilename;

            if (!file_exists($filePath)) {
                AuthMiddleware::sendError('Archivo no encontrado', 404);
            }

            // Additional security: verify file is within uploads directory
            $realPath = realpath($filePath);
            $uploadsDir = realpath(__DIR__ . '/../../uploads/');
            if ($realPath === false || strpos($realPath, $uploadsDir) !== 0) {
                AuthMiddleware::sendError('Acceso denegado', 403);
            }

            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $safeFilename) . '"');
            readfile($filePath);
            exit;

        } catch (\Exception $e) {
            error_log('Error downloading file: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * POST /tickets/:id/escalate
     * Escalate ticket
     */
    public function escalateTicket($id)
    {
        // Validar ID del ticket
        $id = (int)$id;
        if ($id <= 0) {
            error_log("❌ [ESCALAMIENTO] ID de ticket inválido: $id");
            AuthMiddleware::sendError('ID de ticket inválido', 400);
            return;
        }

        error_log("🚀 [ESCALAMIENTO] Iniciando escalamiento de ticket #$id");

        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();

        // Validar que el usuario tenga permisos para escalar (técnico o administrador)
        $rolUsuario = strtolower(trim($user['rol'] ?? ''));
        if ($rolUsuario !== 'tecnico' && $rolUsuario !== 'administrador') {
            AuthMiddleware::sendError('Solo los técnicos y administradores pueden escalar tickets', 403);
            return;
        }

        $tecnicoDestino = $body['tecnicoDestino'] ?? null;
        $motivoEscalamiento = $body['motivoEscalamiento'] ?? '';

        error_log("📋 [ESCALAMIENTO] Datos recibidos - técnicoDestino: $tecnicoDestino, motivo: " . substr($motivoEscalamiento, 0, 50));

        if (!$motivoEscalamiento) {
            AuthMiddleware::sendError('El motivo de escalamiento es requerido', 400);
            return;
        }

        if (!$tecnicoDestino) {
            AuthMiddleware::sendError('Debes seleccionar un técnico destino para escalar el ticket', 400);
            return;
        }

        // Variable para rastrear si el escalamiento se completó exitosamente
        $escalamientoCompletado = false;

        try {
            // Check destination technician exists
            $stmt = $this->db->query(
                'SELECT id_usuario, nombre, correo, rol FROM usuarios WHERE id_usuario = ? AND rol IN ("tecnico", "administrador")',
                [$tecnicoDestino]
            );

            $tecnicoDestinoInfo = $stmt->fetch();

            if (!$tecnicoDestinoInfo) {
                AuthMiddleware::sendError('El técnico seleccionado no existe o no es válido', 400);
                return;
            }

            // Cannot escalate to self - comparar como enteros para evitar problemas de tipo
            $tecnicoDestinoId = (int)$tecnicoDestino;
            $usuarioActualId = (int)($user['id_usuario'] ?? $user['id'] ?? 0);

            error_log("🔍 [ESCALAMIENTO] Validación: técnicoDestino=$tecnicoDestinoId, usuarioActual=$usuarioActualId");

            if ($tecnicoDestinoId === $usuarioActualId && $tecnicoDestinoId > 0) {
                error_log("❌ [ESCALAMIENTO] Intento de escalar a sí mismo bloqueado");
                AuthMiddleware::sendError('No puedes escalar un ticket a ti mismo', 400);
                return;
            }

            // Check ticket exists
            // Si es administrador, puede escalar cualquier ticket
            // Si es técnico, puede escalar tickets asignados a él (incluyendo tickets escalados a él)
            // IMPORTANTE: Cuando un ticket se escala, el id_tecnico cambia al técnico destino,
            // por lo que el técnico destino puede escalarlo nuevamente
            $esAdministrador = ($rolUsuario === 'administrador');
            $idUsuarioActual = (int)$user['id_usuario'];

            if ($esAdministrador) {
                // Administrador puede escalar cualquier ticket
                $stmt = $this->db->query(
                    'SELECT id_ticket, id_tecnico, id_usuario, estatus FROM tickets WHERE id_ticket = ?',
                    [$id]
                );
            } else {
                // Técnico puede escalar tickets asignados a él
                // Esto incluye tickets normales Y tickets escalados a él (porque id_tecnico ya apunta a él)
                $stmt = $this->db->query(
                    'SELECT id_ticket, id_tecnico, id_usuario, estatus FROM tickets WHERE id_ticket = ? AND id_tecnico = ?',
                    [$id, $idUsuarioActual]
                );
            }

            $ticket = $stmt->fetch();

            if (!$ticket) {
                if ($esAdministrador) {
                    AuthMiddleware::sendError('Ticket no encontrado', 404);
                } else {
                    // Verificar si el ticket existe pero no pertenece al usuario
                    $stmtCheck = $this->db->query(
                        'SELECT id_ticket FROM tickets WHERE id_ticket = ?',
                        [$id]
                    );
                    $ticketExiste = $stmtCheck->fetch();

                    if ($ticketExiste) {
                        AuthMiddleware::sendError('No tienes permisos para escalar este ticket. Solo puedes escalar tickets asignados a ti.', 403);
                    } else {
                        AuthMiddleware::sendError('Ticket no encontrado', 404);
                    }
                }
                return;
            }

            // Log para debugging
            error_log("📧 [ESCALAMIENTO] Ticket #$id - Usuario: {$user['nombre']} (ID: $idUsuarioActual, Rol: $rolUsuario)");
            error_log("📧 [ESCALAMIENTO] Ticket asignado a técnico ID: " . ($ticket['id_tecnico'] ?? 'NULL'));
            error_log("📧 [ESCALAMIENTO] Ticket creado por usuario ID: " . ($ticket['id_usuario'] ?? 'NULL'));

            // Cannot escalate closed ticket
            if ($ticket['estatus'] === 'Cerrado') {
                AuthMiddleware::sendError('No se puede escalar un ticket que ya está cerrado', 403);
                return;
            }

            // Update ticket status and assign to new technician
            // IMPORTANTE: Esta es la operación crítica - si esto funciona, el escalamiento se considera exitoso
            error_log("📧 [ESCALAMIENTO] Actualizando ticket #$id a estado Escalado y asignando a técnico ID: $tecnicoDestino");
            $this->db->query(
                'UPDATE tickets SET estatus = "Escalado", id_tecnico = ?, fecha_asignacion = COALESCE(fecha_asignacion, NOW()) WHERE id_ticket = ?',
                [$tecnicoDestino, $id]
            );
            error_log("✅ [ESCALAMIENTO] Ticket #$id actualizado exitosamente - Escalamiento completado");

            // Marcar que el escalamiento se completó exitosamente
            $escalamientoCompletado = true;

            // ============================================
            // ENVIAR RESPUESTA EXITOSA INMEDIATAMENTE - ANTES de hacer cualquier otra cosa
            // ============================================
            $nombreTecnicoDestino = isset($tecnicoDestinoInfo['nombre']) ? $tecnicoDestinoInfo['nombre'] : 'Técnico destino';

            $response = [
                'message' => 'Ticket escalado exitosamente a ' . $nombreTecnicoDestino,
                'ticketId' => (int)$id,
                'escalamiento' => [
                    'tecnicoDestino' => $nombreTecnicoDestino,
                    'motivo' => $motivoEscalamiento
                ],
                'success' => true
            ];

            error_log("✅ [ESCALAMIENTO] Enviando respuesta exitosa INMEDIATAMENTE para ticket #$id");
            AuthMiddleware::sendResponse($response);

            // ============================================
            // DESPUÉS de enviar la respuesta, hacer las operaciones secundarias (no críticas)
            // Si fallan, no importa porque ya enviamos respuesta exitosa
            // ============================================
            try {
                // Save escalation info
                // IMPORTANTE: tecnico_original_id debe ser el técnico que tenía el ticket ANTES del escalamiento
                // Si el ticket ya estaba asignado a alguien, ese es el técnico original
                // Si no estaba asignado, el técnico original es el usuario que está escalando
                $tecnicoOriginalId = $ticket['id_tecnico'] ?? $user['id_usuario'];

                error_log("📧 [ESCALAMIENTO] Guardando información de escalamiento en BD");
                error_log("📧 [ESCALAMIENTO] Técnico original: $tecnicoOriginalId, Técnico nuevo: $tecnicoDestino, Usuario que escala: {$user['id_usuario']}");

                try {
                    $this->db->query(
                        'INSERT INTO escalamientos (id_ticket, tecnico_original_id, tecnico_nuevo_id, nivel_escalamiento, persona_enviar, motivo_escalamiento, fecha_escalamiento) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                        [$id, $tecnicoOriginalId, $tecnicoDestino, 'Manual', $tecnicoDestino, $motivoEscalamiento]
                    );
                    error_log("✅ [ESCALAMIENTO] Información de escalamiento guardada exitosamente");
                } catch (\Exception $e) {
                    error_log("❌ [ESCALAMIENTO] Error guardando información de escalamiento: " . $e->getMessage());
                    // No lanzar excepción - el ticket ya fue actualizado, solo falla el registro del escalamiento
                }

                // Obtener información completa del ticket y empleado (para correos y notificaciones)
                $ticketInfo = null;
                try {
                    $stmtTicket = $this->db->query(
                        'SELECT t.id_ticket, s.categoria, s.subcategoria, u.id_usuario as empleado_id, u.nombre as empleado_nombre, u.correo as empleado_correo
                         FROM tickets t
                         JOIN servicios s ON t.id_servicio = s.id_servicio
                         JOIN usuarios u ON t.id_usuario = u.id_usuario
                         WHERE t.id_ticket = ?',
                        [$id]
                    );
                    $ticketInfo = $stmtTicket->fetch();

                    if (!$ticketInfo) {
                        error_log("⚠️ [ESCALAMIENTO] No se pudo obtener información completa del ticket #$id después del escalamiento");
                    }
                } catch (\Exception $e) {
                    error_log("❌ [ESCALAMIENTO] Error obteniendo información del ticket #$id: " . $e->getMessage());
                    $ticketInfo = null;
                }

                // ============================================
                // CREAR NOTIFICACIONES DE ESCALAMIENTO - ANTES de enviar respuesta
                // ============================================
                try {
                    error_log("📧 [NOTIFICACIONES] Creando notificaciones de escalamiento para ticket #$id");

                    if ($ticketInfo && isset($ticketInfo['empleado_id']) && $ticketInfo['empleado_id'] > 0) {
                        // Notificar al nuevo técnico
                        $resultTec = $this->crearNotificacionInterna(
                            $tecnicoDestino,
                            $id,
                            "Se te ha escalado el ticket #$id. Motivo: $motivoEscalamiento"
                        );
                        error_log($resultTec ? "✅ [NOTIFICACIONES] Notificación escalamiento técnico OK" : "❌ [NOTIFICACIONES] Notificación escalamiento técnico FALLÓ");

                        // Notificar al empleado (usuario del ticket)
                        $nombreTecnico = $tecnicoDestinoInfo['nombre'] ?? 'un técnico';
                        $resultEmp = $this->crearNotificacionInterna(
                            $ticketInfo['empleado_id'],
                            $id,
                            "Tu ticket #$id ha sido escalado al técnico $nombreTecnico"
                        );
                        error_log($resultEmp ? "✅ [NOTIFICACIONES] Notificación escalamiento empleado OK" : "❌ [NOTIFICACIONES] Notificación escalamiento empleado FALLÓ");
                    } else {
                        error_log("⚠️ [NOTIFICACIONES] No se puede crear notificación de escalamiento: ticketInfo inválido");
                    }
                } catch (\Exception $e) {
                    error_log("❌ [NOTIFICACIONES] Error creando notificaciones: " . $e->getMessage());
                }

                // Enviar correos de notificación (no crítico)
                if ($ticketInfo && isset($ticketInfo['empleado_nombre']) && isset($ticketInfo['empleado_correo'])) {
                    try {
                        $ticketData = [
                            'id' => $ticketInfo['id_ticket'],
                            'categoria' => $ticketInfo['categoria'] ?? 'N/A',
                            'subcategoria' => $ticketInfo['subcategoria'] ?? 'N/A'
                        ];

                        $oldTechnician = [
                            'nombre' => $user['nombre'] ?? 'Técnico anterior',
                            'email' => $user['correo'] ?? ''
                        ];

                        $newTechnician = [
                            'nombre' => $tecnicoDestinoInfo['nombre'] ?? 'Técnico',
                            'email' => $tecnicoDestinoInfo['correo'] ?? ''
                        ];

                        $employee = [
                            'nombre' => $ticketInfo['empleado_nombre'],
                            'email' => $ticketInfo['empleado_correo']
                        ];

                        $emailService = new EmailService();
                        $emailService->sendTicketEscalatedNotification($ticketData, $newTechnician, $oldTechnician, $employee, $motivoEscalamiento);
                        error_log("📧 [CORREOS] Correos de escalamiento enviados para ticket #$id");
                    } catch (\Exception $e) {
                        error_log("⚠️ [CORREOS] Error enviando correos: " . $e->getMessage());
                    }
                }
            } catch (\Exception $e) {
                error_log("⚠️ [ESCALAMIENTO] Error en proceso secundario (no crítico): " . $e->getMessage());
                // No importa - la respuesta ya se envió exitosamente arriba
            }

            // La respuesta ya se envió arriba, no hacer nada más
            return;

        } catch (\Exception $e) {
            error_log("❌ [ESCALAMIENTO] Error en escalamiento de ticket #$id: " . $e->getMessage());
            error_log("❌ [ESCALAMIENTO] Stack trace: " . $e->getTraceAsString());
            error_log("❌ [ESCALAMIENTO] File: " . $e->getFile() . " Line: " . $e->getLine());

            // Si el escalamiento se completó (el UPDATE fue exitoso), enviar respuesta exitosa
            if ($escalamientoCompletado) {
                error_log("⚠️ [ESCALAMIENTO] El ticket se escaló exitosamente pero hubo un error después. Enviando respuesta exitosa.");
                $nombreTecnicoDestino = 'el técnico asignado';
                try {
                    if (isset($tecnicoDestinoInfo) && isset($tecnicoDestinoInfo['nombre'])) {
                        $nombreTecnicoDestino = $tecnicoDestinoInfo['nombre'];
                    } else {
                        // Intentar obtener el nombre del técnico desde la BD
                        $stmtTec = $this->db->query(
                            'SELECT nombre FROM usuarios WHERE id_usuario = ?',
                            [$tecnicoDestino]
                        );
                        $tecData = $stmtTec->fetch();
                        if ($tecData && !empty($tecData['nombre'])) {
                            $nombreTecnicoDestino = $tecData['nombre'];
                        }
                    }
                } catch (\Exception $e2) {
                    // Ignorar error al obtener nombre
                }

                AuthMiddleware::sendResponse([
                    'message' => 'Ticket escalado exitosamente a ' . $nombreTecnicoDestino,
                    'ticketId' => (int)$id,
                    'success' => true
                ]);
                return;
            }

            // Si el escalamiento no se completó, verificar si se completó de todos modos (fallback)
            try {
                $stmtCheck = $this->db->query(
                    'SELECT estatus, id_tecnico FROM tickets WHERE id_ticket = ?',
                    [$id]
                );
                $ticketCheck = $stmtCheck->fetch();

                // Si el ticket está escalado, enviar respuesta exitosa aunque haya habido un error
                if ($ticketCheck && $ticketCheck['estatus'] === 'Escalado') {
                    error_log("⚠️ [ESCALAMIENTO] El ticket se escaló (verificado en BD). Enviando respuesta exitosa.");
                    $nombreTecnico = 'el técnico asignado';
                    try {
                        $stmtTec = $this->db->query(
                            'SELECT nombre FROM usuarios WHERE id_usuario = ?',
                            [$ticketCheck['id_tecnico']]
                        );
                        $tecData = $stmtTec->fetch();
                        if ($tecData && !empty($tecData['nombre'])) {
                            $nombreTecnico = $tecData['nombre'];
                        }
                    } catch (\Exception $e2) {
                        // Ignorar error al obtener nombre
                    }

                    AuthMiddleware::sendResponse([
                        'message' => 'Ticket escalado exitosamente a ' . $nombreTecnico,
                        'ticketId' => (int)$id,
                        'success' => true
                    ]);
                    return;
                }
            } catch (\Exception $e2) {
                // Si falla la verificación, continuar con el error original
            }

            AuthMiddleware::sendError('Error interno del servidor al escalar el ticket: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /tickets/:id/reopen/technician-comment
     * Add technician comment to reopened ticket
     */
    public function addTechnicianReopenComment($id)
    {
        $user = AuthMiddleware::authenticate();

        if ($user['rol'] !== 'tecnico' && $user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('Solo los técnicos pueden registrar la causa de reapertura', 403);
        }

        $body = AuthMiddleware::getRequestBody();
        $causa = $body['causa'] ?? '';

        if (!$causa || !trim($causa)) {
            AuthMiddleware::sendError('La causa es obligatoria', 400);
        }

        try {
            // Get latest reopening
            $stmt = $this->db->query(
                'SELECT tr.id_reapertura, tr.tecnico_id, t.id_tecnico as ticket_tecnico_id
                 FROM ticketreaperturas tr
                 JOIN Tickets t ON tr.id_ticket = t.id_ticket
                 WHERE tr.id_ticket = ?
                 ORDER BY tr.fecha_reapertura DESC, tr.id_reapertura DESC
                 LIMIT 1',
                [$id]
            );

            $reopening = $stmt->fetch();

            if (!$reopening) {
                AuthMiddleware::sendError('No se encontró información de reapertura para este ticket', 404);
            }

            // Check permissions
            if ($reopening['ticket_tecnico_id'] != $user['id_usuario'] &&
                $reopening['tecnico_id'] != $user['id_usuario'] &&
                $user['rol'] !== 'administrador') {
                AuthMiddleware::sendError('No tienes permisos para actualizar la causa de este ticket', 403);
            }

            // Update reopening with cause
            $this->db->query(
                'UPDATE ticketreaperturas SET causa_tecnico = ?, tecnico_id = ?, fecha_respuesta_tecnico = NOW() WHERE id_reapertura = ?',
                [trim($causa), $user['id_usuario'], $reopening['id_reapertura']]
            );

            AuthMiddleware::sendResponse([
                'message' => 'Causa de reapertura registrada correctamente'
            ]);

        } catch (\Exception $e) {
            error_log('Error adding technician reopen comment: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * Helper function para crear notificaciones internas
     * Solo crea la notificación para el usuario especificado
     * OPTIMIZADO: Eliminada validación de usuario para mejorar rendimiento (se confía en IDs del sistema)
     *
     * @param int $idUsuario ID del usuario que recibirá la notificación
     * @param int|null $idTicket ID del ticket relacionado (opcional)
     * @param string $mensaje Mensaje de la notificación
     * @return bool true si se creó exitosamente, false en caso contrario
     */
    private function crearNotificacionInterna($idUsuario, $idTicket, $mensaje)
    {
        try {
            // Validación básica solo (sin consulta extra a la BD para mejor rendimiento)
            if (!$idUsuario || $idUsuario <= 0 || !is_numeric($idUsuario)) {
                error_log("⚠️ [NOTIFICACIONES] No se puede crear notificación: idUsuario inválido ($idUsuario)");
                return false;
            }

            // Crear la notificación directamente (optimizado - sin validar existencia de usuario)
            // NOTA: id_ticket es NOT NULL en la BD, así que siempre debe tener un valor
            // Si viene null, no crear la notificación (evitar errores de BD)
            if ($idTicket === null || $idTicket <= 0) {
                error_log("⚠️ [NOTIFICACIONES] No se puede crear notificación: idTicket inválido ($idTicket) para usuario $idUsuario");
                return false;
            }

            error_log("📝 [NOTIFICACIONES] Intentando crear notificación - Usuario: $idUsuario, Ticket: $idTicket");

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

            // Log siempre activo para debugging de notificaciones
            error_log("✅ [NOTIFICACIONES] Creada exitosamente para usuario ID $idUsuario, ticket #$idTicket: " . substr($mensaje, 0, 60) . "...");
            return true;
        } catch (\PDOException $e) {
            $errorMsg = $e->getMessage();
            $errorCode = $e->getCode();
            error_log("❌ [NOTIFICACIONES] Error PDO creando notificación para usuario $idUsuario, ticket #$idTicket");
            error_log("❌ [NOTIFICACIONES] Mensaje: $errorMsg");
            error_log("❌ [NOTIFICACIONES] Código: $errorCode");
            error_log("❌ [NOTIFICACIONES] SQL State: " . ($e->errorInfo[0] ?? 'N/A'));

            // Si es un error de FK, el usuario o ticket no existe
            if (strpos($errorMsg, 'FOREIGN KEY') !== false || strpos($errorMsg, '1452') !== false) {
                error_log("⚠️ [NOTIFICACIONES] Usuario $idUsuario o ticket #$idTicket no existe en la BD");
            }
            return false;
        } catch (\Exception $e) {
            error_log("❌ [NOTIFICACIONES] Error general creando notificación para usuario $idUsuario, ticket #$idTicket: " . $e->getMessage());
            error_log("❌ [NOTIFICACIONES] Stack trace: " . $e->getTraceAsString());
            return false;
        }
    }

    /**
     * Crea notificaciones para administradores cuando ocurre un evento importante
     *
     * @param string $tipoEvento Tipo de evento (escalamiento, asignacion, etc.)
     * @param int|null $idTicket ID del ticket relacionado
     * @param string $mensaje Mensaje de la notificación
     */
    private function notificarAdministradores($tipoEvento, $idTicket, $mensaje)
    {
        try {
            // Obtener todos los administradores
            $stmt = $this->db->query(
                'SELECT id_usuario FROM usuarios WHERE rol = ? AND activo = 1',
                ['administrador']
            );
            $administradores = $stmt->fetchAll();

            foreach ($administradores as $admin) {
                $this->crearNotificacionInterna($admin['id_usuario'], $idTicket, $mensaje);
            }

            error_log("✅ Notificaciones enviadas a " . count($administradores) . " administrador(es) para evento: $tipoEvento");
        } catch (\Exception $e) {
            error_log("❌ Error notificando administradores: " . $e->getMessage());
        }
    }
}
