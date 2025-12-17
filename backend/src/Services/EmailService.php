<?php

namespace App\Services;

class EmailService
{

    public function __construct()
    {
        // Helper function to clean environment variables (remove quotes)
        $cleanEnv = function($key, $default = '') {
            $value = $_ENV[$key] ?? $default;
            // Remove surrounding quotes if present
            if (is_string($value) && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
                $value = substr($value, 1, -1);
            }
            return trim($value);
        };

        // Verificar que SendGrid esté configurado
        $sendGridApiKey = $cleanEnv('SENDGRID_API_KEY', '');
        if (empty($sendGridApiKey)) {
            error_log("⚠️ ADVERTENCIA: SENDGRID_API_KEY no está configurado. Los correos no se podrán enviar.");
        } else {
            error_log("✅ SendGrid configurado correctamente");
        }
    }

    public function sendEmail($to, $subject, $htmlBody)
    {
        // Normalizar el correo: trim, lowercase, eliminar espacios
        $to = trim(strtolower($to));

        // Validar que el destinatario sea válido
        if (empty($to) || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            error_log("❌ Correo inválido después de normalizar: '$to' (original: " . var_export(func_get_arg(0), true) . ")");
            throw new \Exception("Dirección de correo inválida: $to");
        }

        error_log("📧 Correo normalizado para envío: '$to'");

        // Helper para limpiar variables de entorno
        $cleanEnv = function($key, $default = '') {
            $value = $_ENV[$key] ?? $default;
            if (is_string($value) && strlen($value) > 0) {
                if (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'")) {
                    $value = substr($value, 1, -1);
                }
            }
            return trim($value);
        };

        // Verificar que SendGrid esté configurado
        $sendGridApiKey = $cleanEnv('SENDGRID_API_KEY', '');
        if (empty($sendGridApiKey)) {
            $errorMsg = "SENDGRID_API_KEY no está configurado. Configura esta variable de entorno para enviar correos.";
            error_log("❌ $errorMsg");
            throw new \Exception($errorMsg);
        }

        // Usar solo SendGrid (sin SMTP)
        error_log("📤 Intentando enviar correo a: $to usando SendGrid API");
        $result = $this->sendEmailUsingSendGrid($to, $subject, $htmlBody);

        if ($result) {
            error_log("✅ Correo enviado exitosamente a: $to usando SendGrid");
            return true;
        } else {
            $errorMsg = "No se pudo enviar el correo usando SendGrid. Verifica SENDGRID_API_KEY y que el remitente esté verificado en SendGrid.";
            error_log("❌ $errorMsg");
            throw new \Exception($errorMsg);
        }
    }

    /**
     * Método alternativo usando mail() de PHP cuando SMTP está bloqueado
     * Usa el servidor de correo del hosting en lugar de SMTP externo
     */
    private function sendEmailUsingPHPMail($to, $subject, $htmlBody)
    {
        try {
            // Obtener el remitente desde la configuración
            $cleanEnv = function($key, $default = '') {
                $value = $_ENV[$key] ?? $default;
                if (is_string($value) && strlen($value) > 0) {
                    if (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'")) {
                        $value = substr($value, 1, -1);
                    }
                }
                return trim($value);
            };

            $smtpFrom = $cleanEnv('SMTP_FROM', '');
            $smtpUser = $cleanEnv('SMTP_USER', '');

            // Determinar el remitente
            $fromEmail = $smtpUser;
            $fromName = 'Mesa de Ayuda - ITS';

            if (!empty($smtpFrom)) {
                if (preg_match('/^(.+?)\s*<(.+?)>$/', $smtpFrom, $matches)) {
                    $fromName = trim($matches[1]);
                    $fromEmail = trim($matches[2]);
                } else {
                    $fromEmail = $smtpFrom;
                }
            }

            // Preparar headers para mail()
            $headers = [];
            $headers[] = "MIME-Version: 1.0";
            $headers[] = "Content-Type: text/html; charset=UTF-8";
            $headers[] = "From: {$fromName} <{$fromEmail}>";
            $headers[] = "Reply-To: {$fromEmail}";
            $headers[] = "X-Mailer: PHP/" . phpversion();

            $headersString = implode("\r\n", $headers);

            // Intentar enviar usando mail() de PHP
            $result = @mail($to, $subject, $htmlBody, $headersString);

            if ($result) {
                error_log("✅ mail() de PHP envió el correo exitosamente a: $to");
                return true;
            } else {
                error_log("❌ mail() de PHP falló al enviar a: $to");
                $lastError = error_get_last();
                if ($lastError) {
                    error_log("❌ Último error de PHP: " . $lastError['message']);
                }
                return false;
            }
        } catch (\Exception $e) {
            error_log("❌ Excepción en sendEmailUsingPHPMail: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Método alternativo usando SendGrid API cuando SMTP está bloqueado
     * SendGrid funciona a través de API REST, no necesita conexiones SMTP salientes
     */
    private function sendEmailUsingSendGrid($to, $subject, $htmlBody)
    {
        try {
            // Verificar si SendGrid está configurado
            $cleanEnv = function($key, $default = '') {
                $value = $_ENV[$key] ?? $default;
                if (is_string($value) && strlen($value) > 0) {
                    if (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'")) {
                        $value = substr($value, 1, -1);
                    }
                }
                return trim($value);
            };

            $sendGridApiKey = $cleanEnv('SENDGRID_API_KEY', '');

            if (empty($sendGridApiKey)) {
                error_log("⚠️ SendGrid no está configurado (SENDGRID_API_KEY no encontrado)");
                return false;
            }

            // Obtener remitente
            $smtpFrom = $cleanEnv('SMTP_FROM', '');
            $smtpUser = $cleanEnv('SMTP_USER', '');

            $fromEmail = $smtpUser;
            $fromName = 'Mesa de Ayuda - ITS';

            if (!empty($smtpFrom)) {
                if (preg_match('/^(.+?)\s*<(.+?)>$/', $smtpFrom, $matches)) {
                    $fromName = trim($matches[1]);
                    $fromEmail = trim($matches[2]);
                } else {
                    $fromEmail = $smtpFrom;
                }
            }

            // Preparar datos para SendGrid API
            $data = [
                'personalizations' => [
                    [
                        'to' => [
                            ['email' => $to]
                        ],
                        'subject' => $subject
                    ]
                ],
                'from' => [
                    'email' => $fromEmail,
                    'name' => $fromName
                ],
                'content' => [
                    [
                        'type' => 'text/html',
                        'value' => $htmlBody
                    ]
                ]
            ];

            // Enviar a través de SendGrid API usando cURL
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, 'https://api.sendgrid.com/v3/mail/send');
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $sendGridApiKey,
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            $curlInfo = curl_getinfo($ch);
            curl_close($ch);

            // Log detallado para diagnóstico
            error_log("📊 SendGrid Response - HTTP Code: $httpCode");
            error_log("📊 SendGrid Response - cURL Error: " . ($curlError ?: 'Ninguno'));
            error_log("📊 SendGrid Response - Remitente: $fromEmail");
            error_log("📊 SendGrid Response - Destinatario: $to");

            if ($curlError) {
                error_log("❌ Error cURL con SendGrid: $curlError");
                error_log("❌ Detalles cURL: " . json_encode($curlInfo));
                return false;
            }

            if ($httpCode >= 200 && $httpCode < 300) {
                error_log("✅ SendGrid envió el correo exitosamente (HTTP $httpCode)");
                error_log("✅ Correo aceptado por SendGrid - De: $fromEmail, Para: $to");
                return true;
            } else {
                // Parsear respuesta de error de SendGrid para mensaje más útil
                $errorDetails = $response;
                $errorMessages = [];

                try {
                    $errorJson = json_decode($response, true);
                    if (isset($errorJson['errors']) && is_array($errorJson['errors'])) {
                        foreach ($errorJson['errors'] as $err) {
                            $errorMsg = $err['message'] ?? 'Error desconocido';
                            $errorField = $err['field'] ?? '';
                            $errorMessages[] = $errorMsg . ($errorField ? " (Campo: $errorField)" : '');
                        }
                        $errorDetails = implode('; ', $errorMessages);
                    }
                } catch (\Exception $e) {
                    // Si no se puede parsear, usar la respuesta original
                    error_log("⚠️ No se pudo parsear respuesta de error: " . $e->getMessage());
                }

                error_log("❌ SendGrid falló (HTTP $httpCode): $errorDetails");
                error_log("❌ Respuesta completa de SendGrid: " . substr($response, 0, 500));

                // Log específico para errores comunes
                if ($httpCode === 403) {
                    error_log("⚠️ Error 403: Verifica que el remitente ($fromEmail) esté verificado en SendGrid");
                } elseif ($httpCode === 401) {
                    error_log("⚠️ Error 401: Verifica que SENDGRID_API_KEY sea correcto");
                } elseif ($httpCode === 400) {
                    error_log("⚠️ Error 400: Verifica el formato del correo remitente y destinatario");
                }

                return false;
            }

        } catch (\Exception $e) {
            error_log("❌ Excepción en sendEmailUsingSendGrid: " . $e->getMessage());
            return false;
        }
    }


    public function sendTicketAssignedNotification($ticket, $technician, $employee)
    {
        $subject = "Nuevo ticket asignado #{$ticket['id']}";
        $htmlContent = $this->generateTicketAssignedEmail($ticket, $technician, $employee);

        $errors = [];

        // Validar email del técnico antes de enviar
        if (empty($technician['email']) || !filter_var($technician['email'], FILTER_VALIDATE_EMAIL)) {
            $errorMsg = "Email del técnico inválido o vacío: " . ($technician['email'] ?? 'NO DEFINIDO');
            error_log("❌ [Ticket #{$ticket['id']}] $errorMsg");
            $errors[] = $errorMsg;
        } else {
            try {
                // Send to technician
                error_log("📧 [Ticket #{$ticket['id']}] Intentando enviar correo de asignación al técnico: {$technician['email']}");
                $this->sendEmail($technician['email'], $subject, $htmlContent);
                error_log("✅ [Ticket #{$ticket['id']}] Correo enviado exitosamente al técnico: {$technician['email']}");
            } catch (\Exception $e) {
                $errorMsg = "Error enviando correo al técnico {$technician['email']}: " . $e->getMessage();
                error_log("❌ [Ticket #{$ticket['id']}] $errorMsg");
                error_log("❌ [Ticket #{$ticket['id']}] Stack trace: " . $e->getTraceAsString());
                $errors[] = $errorMsg;
            }
        }

        // Validar email del empleado antes de enviar
        if (empty($employee['email']) || !filter_var($employee['email'], FILTER_VALIDATE_EMAIL)) {
            $errorMsg = "Email del empleado inválido o vacío: " . ($employee['email'] ?? 'NO DEFINIDO');
            error_log("❌ [Ticket #{$ticket['id']}] $errorMsg");
            $errors[] = $errorMsg;
        } else {
            try {
                // Send confirmation to employee
                $employeeSubject = "Tu ticket #{$ticket['id']} ha sido asignado";
                $employeeContent = $this->generateTicketAssignedEmployeeEmail($ticket, $technician, $employee);

                error_log("📧 [Ticket #{$ticket['id']}] Intentando enviar correo de asignación al empleado: {$employee['email']}");
                $this->sendEmail($employee['email'], $employeeSubject, $employeeContent);
                error_log("✅ [Ticket #{$ticket['id']}] Correo enviado exitosamente al empleado: {$employee['email']}");
            } catch (\Exception $e) {
                $errorMsg = "Error enviando correo al empleado {$employee['email']}: " . $e->getMessage();
                error_log("❌ [Ticket #{$ticket['id']}] $errorMsg");
                error_log("❌ [Ticket #{$ticket['id']}] Stack trace: " . $e->getTraceAsString());
                $errors[] = $errorMsg;
            }
        }

        if (empty($errors)) {
            error_log("✅ [Ticket #{$ticket['id']}] Notificaciones de ticket asignado enviadas correctamente");
        } else {
            error_log("⚠️ [Ticket #{$ticket['id']}] Algunos correos no se pudieron enviar: " . implode('; ', $errors));
        }
    }

    private function generateTicketAssignedEmail($ticket, $technician, $employee)
    {
        $baseUrl = $this->getFrontendUrl();
        $ticketUrl = "$baseUrl/tickets/assigned";

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Nuevo Ticket Asignado</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #1976D2; margin-bottom: 10px;">Nuevo Ticket Asignado</h2>
        <hr style="border:none; border-top:2px solid #1976D2; margin-bottom: 30px;">
        <p>Hola <strong>{$technician['nombre']}</strong>:</p>
        <p>Se te ha asignado un nuevo ticket:</p>
        <div style="background: #e3f2fd; border-left: 6px solid #1976D2; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id']}</p>
            <p><strong>Categoría:</strong> {$ticket['categoria']} - {$ticket['subcategoria']}</p>
            <p><strong>Descripción:</strong> {$ticket['descripcion']}</p>
            <p><strong>Prioridad:</strong> {$ticket['prioridad']}</p>
            <p><strong>Solicitante:</strong> {$employee['nombre']}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #1976D2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Ticket</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
    }

    private function generateTicketAssignedEmployeeEmail($ticket, $technician, $employee)
    {
        $baseUrl = $this->getFrontendUrl();
        $ticketUrl = "$baseUrl/tickets";

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket Asignado</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #1976D2; margin-bottom: 10px;">Ticket Asignado</h2>
        <hr style="border:none; border-top:2px solid #1976D2; margin-bottom: 30px;">
        <p>Hola <strong>{$employee['nombre']}</strong>:</p>
        <p>Tu ticket ha sido asignado a un técnico:</p>
        <div style="background: #e8f5e9; border-left: 6px solid #4CAF50; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id']}</p>
            <p><strong>Técnico asignado:</strong> {$technician['nombre']}</p>
            <p><strong>Estado:</strong> En proceso</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Mis Tickets</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
    }

    private function generateTicketCreatedEmail($ticket, $employee, $hasTechnician = false, $technicianName = null)
    {
        $baseUrl = $this->getFrontendUrl();
        $ticketUrl = "$baseUrl/tickets/tracking";

        $tecnicoInfo = $hasTechnician && $technicianName
            ? "<p><strong>Técnico asignado:</strong> {$technicianName}</p>"
            : "<p><strong>Técnico asignado:</strong> En proceso de asignación</p>";

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket Creado</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #4CAF50; margin-bottom: 10px;">✅ Ticket Creado Exitosamente</h2>
        <hr style="border:none; border-top:2px solid #4CAF50; margin-bottom: 30px;">
        <p>Hola <strong>{$employee['nombre']}</strong>:</p>
        <p>Tu ticket ha sido creado exitosamente y está siendo procesado.</p>
        <div style="background: #e8f5e9; border-left: 6px solid #4CAF50; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id']}</p>
            <p><strong>Categoría:</strong> {$ticket['categoria']} - {$ticket['subcategoria']}</p>
            <p><strong>Descripción:</strong> {$ticket['descripcion']}</p>
            <p><strong>Prioridad:</strong> {$ticket['prioridad']}</p>
            <p><strong>Estado:</strong> {$ticket['estado']}</p>
            {$tecnicoInfo}
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Seguimiento del Ticket</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
    }

    public function sendTicketCreatedNotification($ticket, $employee, $hasTechnician = false, $technicianName = null)
    {
        $subject = "Tu ticket #{$ticket['id']} ha sido creado";
        $htmlContent = $this->generateTicketCreatedEmail($ticket, $employee, $hasTechnician, $technicianName);

        try {
            error_log("📧 [Ticket #{$ticket['id']}] Intentando enviar correo de creación al empleado: {$employee['email']}");
            $this->sendEmail($employee['email'], $subject, $htmlContent);
            error_log("✅ [Ticket #{$ticket['id']}] Correo de creación enviado exitosamente al empleado: {$employee['email']}");
        } catch (\Exception $e) {
            $errorMsg = "Error enviando correo de creación al empleado {$employee['email']}: " . $e->getMessage();
            error_log("❌ [Ticket #{$ticket['id']}] $errorMsg");
            error_log("❌ [Ticket #{$ticket['id']}] Stack trace: " . $e->getTraceAsString());
        }
    }

    public function sendTicketClosedNotification($ticket, $employee)
    {
        $subject = "Ticket #{$ticket['id']} cerrado";
        $htmlContent = $this->generateTicketClosedEmail($ticket, $employee);

        try {
            $this->sendEmail($employee['email'], $subject, $htmlContent);
            error_log("Correo de ticket cerrado enviado para ticket #{$ticket['id']}");
        } catch (\Exception $e) {
            error_log("Error enviando correo de ticket cerrado: " . $e->getMessage());
        }
    }

    public function sendTicketEscalatedNotification($ticket, $newTechnician, $oldTechnician, $employee, $motivo)
    {
        $subject = "Ticket #{$ticket['id']} escalado";

        try {
            // Enviar al nuevo técnico
            $htmlContentNewTech = $this->generateTicketEscalatedEmail($ticket, $newTechnician, $oldTechnician, $employee, $motivo, 'new');
            $this->sendEmail($newTechnician['email'], $subject, $htmlContentNewTech);

            // Enviar al empleado
            $htmlContentEmployee = $this->generateTicketEscalatedEmail($ticket, $newTechnician, $oldTechnician, $employee, $motivo, 'employee');
            $this->sendEmail($employee['email'], "Tu ticket #{$ticket['id']} ha sido escalado", $htmlContentEmployee);

            error_log("Correos de ticket escalado enviados para ticket #{$ticket['id']}");
        } catch (\Exception $e) {
            error_log("Error enviando correos de ticket escalado: " . $e->getMessage());
        }
    }

    public function sendTicketStatusChangeNotification($ticket, $newStatus, $oldStatus, $technician, $employee)
    {
        $subject = "Cambio de estado - Ticket #{$ticket['id']}";
        $htmlContent = $this->generateTicketStatusChangeEmail($ticket, $newStatus, $oldStatus, $technician, $employee);

        $errors = [];

        try {
            // Enviar al empleado
            error_log("📧 Intentando enviar correo de cambio de estado al empleado: {$employee['email']}");
            $this->sendEmail($employee['email'], $subject, $htmlContent);
            error_log("✅ Correo enviado al empleado: {$employee['email']}");
        } catch (\Exception $e) {
            $errorMsg = "Error enviando correo al empleado {$employee['email']}: " . $e->getMessage();
            error_log("❌ $errorMsg");
            $errors[] = $errorMsg;
        }

        try {
            // Si hay técnico asignado, también enviarle
            if ($technician && !empty($technician['email'])) {
                error_log("📧 Intentando enviar correo de cambio de estado al técnico: {$technician['email']}");
                $this->sendEmail($technician['email'], $subject, $htmlContent);
                error_log("✅ Correo enviado al técnico: {$technician['email']}");
            }
        } catch (\Exception $e) {
            $errorMsg = "Error enviando correo al técnico {$technician['email']}: " . $e->getMessage();
            error_log("❌ $errorMsg");
            $errors[] = $errorMsg;
        }

        if (empty($errors)) {
            error_log("✅ Correos de cambio de estado enviados correctamente para ticket #{$ticket['id']}");
        } else {
            error_log("⚠️ Algunos correos no se pudieron enviar para ticket #{$ticket['id']}: " . implode('; ', $errors));
        }
    }

    private function generateTicketClosedEmail($ticket, $employee)
    {
        $baseUrl = $this->getFrontendUrl();
        $ticketUrl = "$baseUrl/tickets";

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket Cerrado</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #4CAF50; margin-bottom: 10px;">Ticket Cerrado</h2>
        <hr style="border:none; border-top:2px solid #4CAF50; margin-bottom: 30px;">
        <p>Hola <strong>{$employee['nombre']}</strong>:</p>
        <p>Tu ticket ha sido cerrado:</p>
        <div style="background: #e8f5e9; border-left: 6px solid #4CAF50; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id']}</p>
            <p><strong>Categoría:</strong> {$ticket['categoria']} - {$ticket['subcategoria']}</p>
            <p><strong>Estado:</strong> Cerrado</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Mis Tickets</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
    }

    private function generateTicketEscalatedEmail($ticket, $newTechnician, $oldTechnician, $employee, $motivo, $recipient)
    {
        $baseUrl = $this->getFrontendUrl();

        if ($recipient === 'new') {
            $ticketUrl = "$baseUrl/tickets/assigned";
            return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket Escalado</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #FF9800; margin-bottom: 10px;">Ticket Escalado</h2>
        <hr style="border:none; border-top:2px solid #FF9800; margin-bottom: 30px;">
        <p>Hola <strong>{$newTechnician['nombre']}</strong>:</p>
        <p>Se te ha escalado un ticket:</p>
        <div style="background: #fff3e0; border-left: 6px solid #FF9800; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id']}</p>
            <p><strong>Categoría:</strong> {$ticket['categoria']} - {$ticket['subcategoria']}</p>
            <p><strong>Técnico anterior:</strong> {$oldTechnician['nombre']}</p>
            <p><strong>Motivo:</strong> {$motivo}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #FF9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Ticket</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
        } else {
            $ticketUrl = "$baseUrl/tickets";
            return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket Escalado</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #FF9800; margin-bottom: 10px;">Ticket Escalado</h2>
        <hr style="border:none; border-top:2px solid #FF9800; margin-bottom: 30px;">
        <p>Hola <strong>{$employee['nombre']}</strong>:</p>
        <p>Tu ticket ha sido escalado a otro técnico:</p>
        <div style="background: #fff3e0; border-left: 6px solid #FF9800; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id']}</p>
            <p><strong>Nuevo técnico:</strong> {$newTechnician['nombre']}</p>
            <p><strong>Motivo:</strong> {$motivo}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #FF9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Mis Tickets</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
        }
    }

    private function generateTicketStatusChangeEmail($ticket, $newStatus, $oldStatus, $technician, $employee)
    {
        $baseUrl = $this->getFrontendUrl();
        $ticketUrl = "$baseUrl/tickets";

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cambio de Estado</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #2196F3; margin-bottom: 10px;">Cambio de Estado</h2>
        <hr style="border:none; border-top:2px solid #2196F3; margin-bottom: 30px;">
        <p>Hola <strong>{$employee['nombre']}</strong>:</p>
        <p>El estado de tu ticket ha cambiado:</p>
        <div style="background: #e3f2fd; border-left: 6px solid #2196F3; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id']}</p>
            <p><strong>Estado anterior:</strong> {$oldStatus}</p>
            <p><strong>Nuevo estado:</strong> {$newStatus}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Mis Tickets</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
    }

    /**
     * Envía correo de recordatorio de evaluación
     */
    public function sendEvaluationReminderEmail($ticket)
    {
        $to = $ticket['usuario_correo'];
        $subject = "Recordatorio: Evalúa tu ticket #{$ticket['id_ticket']}";
        $body = $this->generateEvaluationReminderEmail($ticket);

        return $this->sendEmail($to, $subject, $body);
    }

    /**
     * Envía correo de cierre automático por falta de evaluación
     */
    public function sendEvaluationAutoClosedEmail($ticket)
    {
        $to = $ticket['usuario_correo'];
        $subject = "Ticket #{$ticket['id_ticket']} cerrado automáticamente";
        $body = $this->generateEvaluationAutoClosedEmail($ticket);

        return $this->sendEmail($to, $subject, $body);
    }

    /**
     * Envía correo diario con todos los tickets pendientes de evaluación
     */
    public function sendDailyEvaluationReminderEmail($usuario, $tickets)
    {
        $to = $usuario['correo'];
        $subject = "Recordatorio diario: Tienes " . count($tickets) . " ticket(s) pendiente(s) de evaluación";
        $body = $this->generateDailyEvaluationReminderEmail($usuario, $tickets);

        return $this->sendEmail($to, $subject, $body);
    }

    private function generateEvaluationReminderEmail($ticket)
    {
        $baseUrl = $this->getFrontendUrl();
        $ticketUrl = "$baseUrl/tickets/tracking?ticketId={$ticket['id_ticket']}";
        $diasTranscurridos = $this->calculateDaysSince($ticket['fecha_finalizacion']);

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recordatorio de Evaluación</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #FF9800; margin-bottom: 10px;">⏰ Recordatorio de Evaluación</h2>
        <hr style="border:none; border-top:2px solid #FF9800; margin-bottom: 30px;">
        <p>Hola <strong>{$ticket['usuario_nombre']}</strong>:</p>
        <p>Tu ticket ha sido finalizado hace <strong>{$diasTranscurridos} día(s)</strong> y aún no lo has evaluado.</p>
        <div style="background: #fff3e0; border-left: 6px solid #FF9800; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id_ticket']}</p>
            <p><strong>Descripción:</strong> {$this->truncateText($ticket['descripcion'], 100)}</p>
            <p><strong>Fecha de finalización:</strong> {$this->formatDate($ticket['fecha_finalizacion'])}</p>
        </div>
        <p style="color: #d32f2f; font-weight: bold;">⚠️ Si no evalúas tu ticket pronto, se cerrará automáticamente.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #FF9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Evaluar Ticket</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
    }

    private function generateEvaluationAutoClosedEmail($ticket)
    {
        $baseUrl = $this->getFrontendUrl();
        $ticketUrl = "$baseUrl/tickets/tracking?ticketId={$ticket['id_ticket']}";

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket Cerrado Automáticamente</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #d32f2f; margin-bottom: 10px;">⚠️ Ticket Cerrado Automáticamente</h2>
        <hr style="border:none; border-top:2px solid #d32f2f; margin-bottom: 30px;">
        <p>Hola <strong>{$ticket['usuario_nombre']}</strong>:</p>
        <p>Tu ticket ha sido cerrado automáticamente por falta de evaluación después de varios días.</p>
        <div style="background: #ffebee; border-left: 6px solid #d32f2f; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id_ticket']}</p>
            <p><strong>Descripción:</strong> {$this->truncateText($ticket['descripcion'], 100)}</p>
            <p><strong>Fecha de finalización:</strong> {$this->formatDate($ticket['fecha_finalizacion'])}</p>
        </div>
        <p><strong>Nota:</strong> Aún puedes evaluar este ticket si lo deseas.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #d32f2f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver y Evaluar Ticket</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
    }

    private function generateDailyEvaluationReminderEmail($usuario, $tickets)
    {
        $baseUrl = $this->getFrontendUrl();
        $ticketUrl = "$baseUrl/tickets";

        $ticketsList = '';
        foreach ($tickets as $ticket) {
            $diasTranscurridos = $this->calculateDaysSince($ticket['fecha_finalizacion']);
            $descripcion = $this->truncateText($ticket['descripcion'], 80);
            $ticketsList .= <<<HTML
            <div style="background: #fff3e0; border-left: 4px solid #FF9800; padding: 15px; margin: 10px 0;">
                <p style="margin: 5px 0;"><strong>Ticket #{$ticket['id_ticket']}</strong> - Finalizado hace {$diasTranscurridos} día(s)</p>
                <p style="margin: 5px 0; color: #666; font-size: 14px;">{$descripcion}</p>
            </div>
HTML;
        }

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recordatorio Diario de Evaluaciones</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #FF9800; margin-bottom: 10px;">📋 Recordatorio Diario</h2>
        <hr style="border:none; border-top:2px solid #FF9800; margin-bottom: 30px;">
        <p>Hola <strong>{$usuario['nombre']}</strong>:</p>
        <p>Tienes <strong>{$this->formatTicketCount(count($tickets))} ticket(s)</strong> pendiente(s) de evaluación:</p>
        $ticketsList
        <p style="color: #d32f2f; font-weight: bold; margin-top: 20px;">⚠️ Por favor, evalúa tus tickets para poder crear nuevos tickets.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #FF9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Mis Tickets</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
    }

    /**
     * Envía correo cuando un administrador regresa un ticket escalado al técnico original
     */
    public function sendTicketReturnedFromEscalationEmail($ticket, $technician, $comentarioAdmin = '')
    {
        $to = $technician['email'];
        $subject = "Ticket #{$ticket['id']} regresado a ti";
        $body = $this->generateTicketReturnedFromEscalationEmail($ticket, $technician, $comentarioAdmin);

        return $this->sendEmail($to, $subject, $body);
    }

    private function generateTicketReturnedFromEscalationEmail($ticket, $technician, $comentarioAdmin)
    {
        $baseUrl = $this->getFrontendUrl();
        $ticketUrl = "$baseUrl/tickets/assigned";

        $comentarioHtml = '';
        if (!empty($comentarioAdmin)) {
            $comentarioHtml = <<<HTML
        <div style="background: #fff3e0; border-left: 6px solid #FF9800; padding: 20px; margin: 25px 0;">
            <p><strong>Comentario del administrador:</strong></p>
            <p style="font-style: italic; color: #666;">{$comentarioAdmin}</p>
        </div>
HTML;
        }

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket Regresado</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #4CAF50; margin-bottom: 10px;">Ticket Regresado</h2>
        <hr style="border:none; border-top:2px solid #4CAF50; margin-bottom: 30px;">
        <p>Hola <strong>{$technician['nombre']}</strong>:</p>
        <p>Un administrador ha regresado un ticket escalado a tu atención:</p>
        <div style="background: #e8f5e9; border-left: 6px solid #4CAF50; padding: 20px; margin: 25px 0;">
            <p><strong>Ticket #:</strong> {$ticket['id']}</p>
            <p><strong>Categoría:</strong> {$ticket['categoria']} - {$ticket['subcategoria']}</p>
        </div>
        $comentarioHtml
        <div style="text-align: center; margin: 30px 0;">
            <a href="$ticketUrl" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Ticket</a>
        </div>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;
    }

    private function calculateDaysSince($date)
    {
        if (empty($date)) return 0;
        $dateTime = new \DateTime($date);
        $now = new \DateTime();
        $diff = $now->diff($dateTime);
        return $diff->days;
    }

    public function getFrontendUrl()
    {
        return $_ENV['FRONTEND_URL'] ?? 'https://atiendeti.com/';
    }

    /**
     * Helper para truncar texto
     */
    private function truncateText($text, $length = 100)
    {
        if (empty($text)) return '';
        $text = strip_tags($text);
        if (strlen($text) <= $length) {
            return htmlspecialchars($text);
        }
        return htmlspecialchars(substr($text, 0, $length)) . '...';
    }

    /**
     * Helper para formatear fechas
     */
    private function formatDate($date)
    {
        if (empty($date)) return 'N/A';
        return date('d/m/Y H:i', strtotime($date));
    }

    /**
     * Helper para formatear conteo de tickets
     */
    private function formatTicketCount($count)
    {
        return (string)$count;
    }
}
