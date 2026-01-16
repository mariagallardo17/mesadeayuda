<?php
/**
 * Script para ver los archivos subidos en la carpeta uploads
 * Accede desde: http://tu-dominio.com/backend/ver-archivos-subidos.php
 */

// Configurar zona horaria
date_default_timezone_set('America/Mexico_City');

// Ruta de la carpeta uploads
$uploadsDir = __DIR__ . '/uploads/';

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Archivos Subidos - Mesa de Ayuda</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }

        .header p {
            opacity: 0.9;
            font-size: 14px;
        }

        .content {
            padding: 30px;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            border-left: 4px solid #1976D2;
        }

        .stat-card .number {
            font-size: 32px;
            font-weight: bold;
            color: #1976D2;
            margin-bottom: 5px;
        }

        .stat-card .label {
            color: #666;
            font-size: 14px;
        }

        .files-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .files-table th {
            background: #f8f9fa;
            padding: 15px;
            text-align: left;
            font-weight: 600;
            color: #333;
            border-bottom: 2px solid #dee2e6;
        }

        .files-table td {
            padding: 15px;
            border-bottom: 1px solid #dee2e6;
        }

        .files-table tr:hover {
            background: #f8f9fa;
        }

        .file-name {
            font-family: 'Courier New', monospace;
            color: #1976D2;
            word-break: break-all;
        }

        .file-size {
            color: #666;
        }

        .file-date {
            color: #666;
            font-size: 13px;
        }

        .btn-download {
            background: #4CAF50;
            color: white;
            padding: 8px 15px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            font-size: 13px;
            transition: background 0.3s;
        }

        .btn-download:hover {
            background: #45a049;
        }

        .no-files {
            text-align: center;
            padding: 60px 20px;
            color: #999;
        }

        .no-files-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }

        .error {
            background: #ffebee;
            color: #c62828;
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid #c62828;
            margin-bottom: 20px;
        }

        .info {
            background: #e3f2fd;
            color: #1565C0;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📁 Archivos Subidos</h1>
            <p>Lista de archivos almacenados en la carpeta uploads</p>
        </div>

        <div class="content">
            <?php
            // Verificar si la carpeta existe
            if (!is_dir($uploadsDir)) {
                echo '<div class="error">';
                echo '<strong>⚠️ Error:</strong> La carpeta uploads no existe.<br>';
                echo 'Ruta esperada: <code>' . htmlspecialchars($uploadsDir) . '</code><br>';
                echo 'Se creará automáticamente cuando se suba el primer archivo.';
                echo '</div>';
            } else {
                // Obtener todos los archivos
                $files = glob($uploadsDir . '*');
                $files = array_filter($files, 'is_file');

                // Ordenar por fecha de modificación (más recientes primero)
                usort($files, function($a, $b) {
                    return filemtime($b) - filemtime($a);
                });

                $totalFiles = count($files);
                $totalSize = 0;

                foreach ($files as $file) {
                    $totalSize += filesize($file);
                }

                // Mostrar estadísticas
                echo '<div class="stats">';
                echo '<div class="stat-card">';
                echo '<div class="number">' . $totalFiles . '</div>';
                echo '<div class="label">Archivos Totales</div>';
                echo '</div>';

                echo '<div class="stat-card">';
                echo '<div class="number">' . number_format($totalSize / 1024 / 1024, 2) . ' MB</div>';
                echo '<div class="label">Tamaño Total</div>';
                echo '</div>';

                echo '<div class="stat-card">';
                echo '<div class="number">' . date('d/m/Y', filemtime($uploadsDir)) . '</div>';
                echo '<div class="label">Última Actualización</div>';
                echo '</div>';
                echo '</div>';

                // Mostrar información
                echo '<div class="info">';
                echo '<strong>📂 Ruta:</strong> <code>' . htmlspecialchars($uploadsDir) . '</code>';
                echo '</div>';

                if ($totalFiles > 0) {
                    // Mostrar tabla de archivos
                    echo '<table class="files-table">';
                    echo '<thead>';
                    echo '<tr>';
                    echo '<th>Nombre del Archivo</th>';
                    echo '<th>Tamaño</th>';
                    echo '<th>Fecha de Subida</th>';
                    echo '<th>Acciones</th>';
                    echo '</tr>';
                    echo '</thead>';
                    echo '<tbody>';

                    foreach ($files as $file) {
                        $fileName = basename($file);
                        $fileSize = filesize($file);
                        $fileDate = date('d/m/Y H:i:s', filemtime($file));
                        $fileSizeFormatted = $fileSize < 1024
                            ? $fileSize . ' B'
                            : ($fileSize < 1024 * 1024
                                ? number_format($fileSize / 1024, 2) . ' KB'
                                : number_format($fileSize / 1024 / 1024, 2) . ' MB');

                        // Parsear información del nombre del archivo
                        $parts = explode('_', $fileName);
                        $userId = isset($parts[1]) ? $parts[1] : 'N/A';
                        $originalName = isset($parts[2]) ? implode('_', array_slice($parts, 2)) : $fileName;

                        echo '<tr>';
                        echo '<td>';
                        echo '<div class="file-name" title="' . htmlspecialchars($fileName) . '">';
                        echo htmlspecialchars($originalName);
                        echo '</div>';
                        echo '<div style="font-size: 11px; color: #999; margin-top: 5px;">';
                        echo 'ID Usuario: ' . htmlspecialchars($userId) . ' | ';
                        echo 'Archivo: ' . htmlspecialchars($fileName);
                        echo '</div>';
                        echo '</td>';
                        echo '<td class="file-size">' . $fileSizeFormatted . '</td>';
                        echo '<td class="file-date">' . $fileDate . '</td>';
                        echo '<td>';
                        // Ruta para ver/descargar
                        echo '<a href="ver-archivo.php?file=' . urlencode($fileName) . '" class="btn-download" target="_blank">👁️ Ver/Descargar</a>';
                        echo '</td>';
                        echo '</tr>';
                    }

                    echo '</tbody>';
                    echo '</table>';
                } else {
                    echo '<div class="no-files">';
                    echo '<div class="no-files-icon">📭</div>';
                    echo '<h2>No hay archivos subidos aún</h2>';
                    echo '<p>Los archivos aparecerán aquí cuando se suban a través del sistema.</p>';
                    echo '</div>';
                }
            }
            ?>
        </div>
    </div>
</body>
</html>

