<?php
/**
 * Script para ver/descargar un archivo específico
 * Accede desde: http://tu-dominio.com/backend/ver-archivo.php?file=nombre_archivo.pdf
 */

// Ruta de la carpeta uploads
$uploadsDir = __DIR__ . '/uploads/';

// Obtener nombre del archivo
$fileName = $_GET['file'] ?? '';

if (empty($fileName)) {
    die('Error: No se especificó ningún archivo');
}

// Validar y sanitizar nombre del archivo
$safeFileName = basename($fileName);
if ($safeFileName !== $fileName) {
    die('Error: Nombre de archivo inválido');
}

$filePath = $uploadsDir . $safeFileName;

// Verificar que el archivo existe
if (!file_exists($filePath)) {
    die('Error: El archivo no existe');
}

// Verificar que está dentro del directorio uploads (seguridad)
$realPath = realpath($filePath);
$realUploadsDir = realpath($uploadsDir);
if ($realPath === false || strpos($realPath, $realUploadsDir) !== 0) {
    die('Error: Acceso denegado');
}

// Obtener tipo MIME
$mimeType = mime_content_type($filePath);
if (!$mimeType) {
    $mimeType = 'application/octet-stream';
}

// Si es PDF, mostrarlo en el navegador
if ($mimeType === 'application/pdf') {
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . $safeFileName . '"');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
}

// Para otros tipos, forzar descarga
header('Content-Type: ' . $mimeType);
header('Content-Disposition: attachment; filename="' . $safeFileName . '"');
header('Content-Length: ' . filesize($filePath));
readfile($filePath);
exit;

