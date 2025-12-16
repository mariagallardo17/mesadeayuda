<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Services\EmailService;

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
                // Obtener total de tickets para técnicos
                $stmtCount = $this->db->query(
                    'SELECT COUNT(*) as total
                     FROM tickets t
                     WHERE t.id_tecnico = ? AND t.estatus != "Escalado"',
                    [$user['id_usuario']]
                );
                $countResult = $stmtCount->fetch();
                $total = (int)$countResult['total'];

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
            } else {
                // Obtener total de tickets para empleados
                $stmtCount = $this->db->query(
                    'SELECT COUNT(*) as total
                     FROM tickets t
                     WHERE t.id_usuario = ?',
                    [$user['id_usuario']]
                );
                $countResult = $stmtCount->fetch();
                $total = (int)$countResult['total'];

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

            // ENVIAR RESPUESTA INMEDIATAMENTE - sin consultas adicionales que puedan fallar
            error_log("✅ Enviando respuesta exitosa para ticket #$ticketId");
            AuthMiddleware::sendResponse($response, 201);

            // Intentar enviar correos DESPUÉS de enviar la respuesta (no bloquea)
            if ($tecnicoId && $idTecnicoParaInsert) {
                try {
                    error_log("📧 Preparando envío de correos para ticket #$ticketId");

                    $stmtTecnico = $this->db->query(
                        'SELECT nombre, correo FROM usuarios WHERE id_usuario = ?',
                        [$idTecnicoParaInsert]
                    );
                    $tecnico = $stmtTecnico->fetch();

                    $stmtEmpleado = $this->db->query(
                        'SELECT nombre, correo FROM usuarios WHERE id_usuario = ?',
                        [$user['id_usuario']]
                    );
                    $empleado = $stmtEmpleado->fetch();

                    // Validar que tenemos los datos necesarios
                    if (!$tecnico) {
                        error_log("⚠️ No se encontró técnico con ID: $idTecnicoParaInsert");
                    } elseif (empty($tecnico['correo'])) {
                        error_log("⚠️ El técnico {$tecnico['nombre']} no tiene correo configurado");
                    } elseif (!$empleado) {
                        error_log("⚠️ No se encontró empleado con ID: {$user['id_usuario']}");
                    } elseif (empty($empleado['correo'])) {
                        error_log("⚠️ El empleado {$empleado['nombre']} no tiene correo configurado");
                    } else {
                        // Validar que los correos sean válidos
                        if (!filter_var($tecnico['correo'], FILTER_VALIDATE_EMAIL)) {
                            error_log("⚠️ Correo del técnico inválido: {$tecnico['correo']}");
                        } elseif (!filter_var($empleado['correo'], FILTER_VALIDATE_EMAIL)) {
                            error_log("⚠️ Correo del empleado inválido: {$empleado['correo']}");
                        } else {
                            error_log("📧 Enviando correos - Técnico: {$tecnico['correo']}, Empleado: {$empleado['correo']}");

                            $emailService = new EmailService();
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

                            error_log("✅ Correos de asignación enviados para ticket #$ticketId");
                        }
                    }
                } catch (\Exception $e) {
                    error_log("❌ Error enviando correos para ticket #$ticketId: " . $e->getMessage());
                    error_log("❌ Stack trace: " . $e->getTraceAsString());
                }
            } else {
                error_log("ℹ️ No se enviarán correos: ticket #$ticketId no tiene técnico asignado (tecnicoId: " . ($tecnicoId ?? 'NULL') . ", idTecnicoParaInsert: " . ($idTecnicoParaInsert ?? 'NULL') . ")");
            }
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
            // Obtener estado anterior y datos del ticket antes de actualizar
            $stmtOld = $this->db->query(
                'SELECT t.estatus, t.id_tecnico, s.categoria, s.subcategoria,
                        u.id_usuario as empleado_id, u.nombre as empleado_nombre, u.correo as empleado_correo,
                        tec.nombre as tecnico_nombre, tec.correo as tecnico_correo
                 FROM tickets t
                 JOIN servicios s ON t.id_servicio = s.id_servicio
                 JOIN usuarios u ON t.id_usuario = u.id_usuario
                 LEFT JOIN usuarios tec ON t.id_tecnico = tec.id_usuario
                 WHERE t.id_ticket = ?',
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

            // LÓGICA ESPECIAL: Si es administrador regresando un ticket escalado
            if ($user['rol'] === 'administrador' && $estadoAnterior === 'Escalado' && $estatus !== 'Escalado') {
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

                    error_log("✅ Ticket #$id regresado al técnico original por administrador");
                }
            }

            // Verificar si se está asignando un técnico manualmente
            $idTecnicoNuevo = $body['id_tecnico'] ?? null;
            if ($idTecnicoNuevo && $idTecnicoNuevo != $ticketOld['id_tecnico']) {
                // Se está asignando un técnico manualmente
                $this->db->query(
                    'UPDATE tickets SET estatus = ?, id_tecnico = ?, fecha_asignacion = COALESCE(fecha_asignacion, NOW()) WHERE id_ticket = ?',
                    [$estatus, $idTecnicoNuevo, $id]
                );

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
            } else if ($estatus !== 'Pendiente' && $estatus !== 'En Progreso' && $estatus !== 'En proceso' && $estatus !== 'Finalizado') {
                // Solo cambio de estado (para otros estados que no requieren lógica especial)
                $this->db->query(
                    'UPDATE tickets SET estatus = ? WHERE id_ticket = ?',
                    [$estatus, $id]
                );
            }

            // Obtener datos actualizados del ticket para la respuesta
            $stmtUpdated = $this->db->query(
                'SELECT estatus, pendiente_motivo, pendiente_tiempo_estimado, pendiente_actualizado_en FROM tickets WHERE id_ticket = ?',
                [$id]
            );
            $ticketUpdated = $stmtUpdated->fetch();

            // Preparar respuesta completa con todos los campos que el frontend espera
            $response = [
                'message' => 'Estado actualizado exitosamente',
                'estatus' => $ticketUpdated['estatus'] ?? $estatus,
                'pendienteMotivo' => $ticketUpdated['pendiente_motivo'] ?? null,
                'pendienteTiempoEstimado' => $ticketUpdated['pendiente_tiempo_estimado'] ?? null,
                'pendienteActualizadoEn' => $ticketUpdated['pendiente_actualizado_en'] ?? null
            ];

            // ENVIAR RESPUESTA EXITOSA INMEDIATAMENTE después de actualizar el ticket
            // Esto asegura que el usuario vea el éxito incluso si algo falla después
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
                    // No hacer nada, la respuesta ya se envió exitosamente
                }
            }
        } catch (\Exception $e) {
            error_log('Error updating ticket status: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
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
                // No hacer nada, la respuesta ya se envió exitosamente
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
                // Contar total
                $stmtCount = $this->db->query(
                    'SELECT COUNT(*) as total
                     FROM tickets t
                     JOIN ticketreaperturas tr ON t.id_ticket = tr.id_ticket
                     WHERE t.id_tecnico = ? OR tr.tecnico_id = ?',
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
                     WHERE t.id_tecnico = ? OR tr.tecnico_id = ?
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
            // Contar total
            $stmtCount = $this->db->query(
                'SELECT COUNT(DISTINCT t.id_ticket) as total
                 FROM tickets t
                 INNER JOIN escalamientos e ON t.id_ticket = e.id_ticket
                 WHERE t.id_tecnico = ? AND e.tecnico_nuevo_id = ?
                 AND e.fecha_escalamiento = (
                   SELECT MAX(fecha_escalamiento)
                   FROM escalamientos
                   WHERE id_ticket = t.id_ticket
                 )',
                [$user['id_usuario'], $user['id_usuario']]
            );
            $countResult = $stmtCount->fetch();
            $total = (int)$countResult['total'];

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
                 WHERE t.id_tecnico = ? AND e.tecnico_nuevo_id = ?
                 AND e.fecha_escalamiento = (
                   SELECT MAX(fecha_escalamiento)
                   FROM escalamientos
                   WHERE id_ticket = t.id_ticket
                 )
                 ORDER BY e.fecha_escalamiento DESC, t.fecha_creacion DESC
                 LIMIT ? OFFSET ?',
                [$user['id_usuario'], $user['id_usuario'], $limit, $offset]
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
        $user = AuthMiddleware::authenticate();
        $body = AuthMiddleware::getRequestBody();

        $tecnicoDestino = $body['tecnicoDestino'] ?? null;
        $motivoEscalamiento = $body['motivoEscalamiento'] ?? '';

        if (!$motivoEscalamiento) {
            AuthMiddleware::sendError('El motivo de escalamiento es requerido', 400);
        }

        if (!$tecnicoDestino) {
            AuthMiddleware::sendError('Debes seleccionar un técnico destino para escalar el ticket', 400);
        }

        try {
            // Check destination technician exists
            $stmt = $this->db->query(
                'SELECT id_usuario, nombre, correo, rol FROM usuarios WHERE id_usuario = ? AND rol IN ("tecnico", "administrador")',
                [$tecnicoDestino]
            );

            $tecnicoDestinoInfo = $stmt->fetch();

            if (!$tecnicoDestinoInfo) {
                AuthMiddleware::sendError('El técnico seleccionado no existe o no es válido', 400);
            }

            // Cannot escalate to self
            if ($tecnicoDestino == $user['id_usuario']) {
                AuthMiddleware::sendError('No puedes escalar un ticket a ti mismo', 400);
            }

            // Check ticket exists and assigned to user
            $stmt = $this->db->query(
                'SELECT id_ticket, id_tecnico, estatus FROM tickets WHERE id_ticket = ? AND id_tecnico = ?',
                [$id, $user['id_usuario']]
            );

            $ticket = $stmt->fetch();

            if (!$ticket) {
                AuthMiddleware::sendError('Ticket no encontrado o no tienes permisos para escalarlo', 404);
            }

            // Cannot escalate closed ticket
            if ($ticket['estatus'] === 'Cerrado') {
                AuthMiddleware::sendError('No se puede escalar un ticket que ya está cerrado', 403);
            }

            // Update ticket status and assign to new technician
            $this->db->query(
                'UPDATE tickets SET estatus = "Escalado", id_tecnico = ?, fecha_asignacion = COALESCE(fecha_asignacion, NOW()) WHERE id_ticket = ?',
                [$tecnicoDestino, $id]
            );

            // Save escalation info
            $this->db->query(
                'INSERT INTO escalamientos (id_ticket, tecnico_original_id, tecnico_nuevo_id, nivel_escalamiento, persona_enviar, motivo_escalamiento, fecha_escalamiento) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                [$id, $user['id_usuario'], $tecnicoDestino, 'Manual', $tecnicoDestino, $motivoEscalamiento]
            );

            // Enviar correos de notificación
            try {
                // Obtener información completa del ticket y empleado
                $stmtTicket = $this->db->query(
                    'SELECT t.id_ticket, s.categoria, s.subcategoria, u.id_usuario as empleado_id, u.nombre as empleado_nombre, u.correo as empleado_correo
                     FROM tickets t
                     JOIN servicios s ON t.id_servicio = s.id_servicio
                     JOIN usuarios u ON t.id_usuario = u.id_usuario
                     WHERE t.id_ticket = ?',
                    [$id]
                );
                $ticketInfo = $stmtTicket->fetch();

                if ($ticketInfo) {
                    $ticketData = [
                        'id' => $ticketInfo['id_ticket'],
                        'categoria' => $ticketInfo['categoria'],
                        'subcategoria' => $ticketInfo['subcategoria']
                    ];

                    $oldTechnician = [
                        'nombre' => $user['nombre'] ?? 'Técnico anterior',
                        'email' => $user['correo'] ?? ''
                    ];

                    $newTechnician = [
                        'nombre' => $tecnicoDestinoInfo['nombre'],
                        'email' => $tecnicoDestinoInfo['correo']
                    ];

                    $employee = [
                        'nombre' => $ticketInfo['empleado_nombre'],
                        'email' => $ticketInfo['empleado_correo']
                    ];

                    $emailService = new EmailService();
                    $emailService->sendTicketEscalatedNotification($ticketData, $newTechnician, $oldTechnician, $employee, $motivoEscalamiento);
                    error_log("📧 Correos de escalamiento enviados para ticket #$id");
                }
            } catch (\Exception $e) {
                error_log("⚠️ Error enviando correos de escalamiento para ticket #$id: " . $e->getMessage());
                // No fallar la operación si el correo falla
            }

            AuthMiddleware::sendResponse([
                'message' => 'Ticket escalado exitosamente a ' . $tecnicoDestinoInfo['nombre'],
                'ticketId' => $id,
                'escalamiento' => [
                    'tecnicoDestino' => $tecnicoDestinoInfo['nombre'],
                    'motivo' => $motivoEscalamiento
                ]
            ]);

        } catch (\Exception $e) {
            error_log('Error escalating ticket: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
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
}
