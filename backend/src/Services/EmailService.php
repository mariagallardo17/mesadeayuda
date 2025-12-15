<?php

namespace App\Services;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class EmailService
{
    private $mailer;
    private $useSendGrid = false;

    public function __construct()
    {
        $this->mailer = new PHPMailer(true);

        // Helper function to clean environment variables (remove quotes)
        $cleanEnv = function($key, $default = '') {
            $value = $_ENV[$key] ?? $default;
            // Remove surrounding quotes if present
            if (is_string($value) && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
                $value = substr($value, 1, -1);
            }
            return trim($value);
        };

        // Server settings - Configuración SMTP simple
        $this->mailer->isSMTP();
        $this->mailer->Host = $cleanEnv('SMTP_HOST', 'smtp.gmail.com');
        $this->mailer->SMTPAuth = true;
        $this->mailer->Username = $cleanEnv('SMTP_USER', '');
        $this->mailer->Password = $cleanEnv('SMTP_PASS', '');

        // Determinar el tipo de encriptación según el puerto
        $smtpPort = (int)($cleanEnv('SMTP_PORT', '587'));
        $this->mailer->Port = $smtpPort;

        // Configurar encriptación según el puerto
        if ($smtpPort == 465) {
            // Puerto 465 usa SSL
            $this->mailer->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } else {
            // Puerto 587 usa STARTTLS
            $this->mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        }

        $this->mailer->CharSet = 'UTF-8';

        // Configuraciones adicionales para conexiones SSL/TLS más flexibles
        // Similar a la configuración de Node.js: tls: { rejectUnauthorized: false }
        // Deshabilitar verificación de certificado para evitar problemas con algunos hostings
        $this->mailer->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
                'crypto_method' => STREAM_CRYPTO_METHOD_TLS_CLIENT
            ]
        ];

        // Timeout más largo para conexiones lentas y hostings con conexiones lentas
        $this->mailer->Timeout = 60;
        $this->mailer->SMTPKeepAlive = false;

        // Configuraciones adicionales para mejorar la conexión
        $this->mailer->SMTPAutoTLS = true;

        // Habilitar debug solo si está configurado explícitamente
        $debugLevel = isset($_ENV['SMTP_DEBUG']) && $_ENV['SMTP_DEBUG'] === 'true' ? 2 : 0;
        $this->mailer->SMTPDebug = $debugLevel;
        if ($debugLevel > 0) {
            $this->mailer->Debugoutput = function($str, $level) {
                error_log("PHPMailer Debug (Level $level): $str");
            };
        }

        // Validar que las credenciales estén configuradas
        if (empty($this->mailer->Username) || empty($this->mailer->Password)) {
            error_log("⚠️ Advertencia: SMTP_USER o SMTP_PASS no están configurados");
        }

        // Default sender (usar SMTP_FROM si está configurado, sino usar SMTP_USER)
        // IMPORTANTE: Gmail requiere que el remitente coincida con la cuenta autenticada
        $smtpFrom = $cleanEnv('SMTP_FROM', '');
        $smtpUser = $this->mailer->Username;

        if (!empty($smtpFrom)) {
            // Extraer el email del formato "Nombre <email@domain.com>" o usar directamente
            $fromEmail = $smtpFrom;
            $fromName = 'Mesa de Ayuda - ITS';

            if (preg_match('/^(.+?)\s*<(.+?)>$/', $smtpFrom, $matches)) {
                $fromName = trim($matches[1]);
                $fromEmail = trim($matches[2]);
            }

            // Si el email del remitente no coincide con SMTP_USER, usar SMTP_USER como remitente
            // pero mantener el nombre personalizado si está disponible
            if (!empty($smtpUser) && strtolower($fromEmail) !== strtolower($smtpUser)) {
                error_log("⚠️ SMTP_FROM ($fromEmail) no coincide con SMTP_USER ($smtpUser). Usando SMTP_USER como remitente.");
                $this->mailer->setFrom($smtpUser, $fromName);
            } else {
                $this->mailer->setFrom($fromEmail, $fromName);
            }
        } elseif (!empty($smtpUser)) {
            $this->mailer->setFrom($smtpUser, 'Mesa de Ayuda - ITS');
        } else {
            error_log("⚠️ Advertencia: No se configuró SMTP_FROM ni SMTP_USER, el correo puede fallar");
        }

        // Log configuration (sin mostrar la contraseña completa)
        $passwordPreview = !empty($this->mailer->Password) ? substr($this->mailer->Password, 0, 4) . '...' : 'VACÍO';
        error_log("📧 Configuración SMTP cargada: Host={$this->mailer->Host}, Port={$this->mailer->Port}, User={$this->mailer->Username}, Pass={$passwordPreview}");
    }

    public function sendEmail($to, $subject, $htmlBody)
    {
        // Validar que el destinatario sea válido
        if (empty($to) || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            throw new \Exception("Dirección de correo inválida: $to");
        }

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

        // PRIORIDAD 1: Intentar con SendGrid primero (funciona por API, no necesita SMTP)
        $sendGridApiKey = $cleanEnv('SENDGRID_API_KEY', '');
        if (!empty($sendGridApiKey)) {
            error_log("📤 Intentando enviar correo a: $to usando SendGrid API");
            $result = $this->sendEmailUsingSendGrid($to, $subject, $htmlBody);
            if ($result) {
                error_log("✅ Correo enviado exitosamente a: $to usando SendGrid");
                return true;
            } else {
                error_log("⚠️ SendGrid falló, intentando con SMTP como respaldo...");
            }
        }

        // PRIORIDAD 2: Si SendGrid no está configurado o falló, usar SMTP
        // Validar que las credenciales SMTP estén configuradas
        if (empty($this->mailer->Username) || empty($this->mailer->Password)) {
            $errorMsg = "Configuración SMTP incompleta. Verifica SMTP_USER y SMTP_PASS en las variables de entorno.";
            if (empty($sendGridApiKey)) {
                error_log("❌ $errorMsg");
                throw new \Exception($errorMsg);
            } else {
                // Si SendGrid falló y SMTP no está configurado, lanzar error
                throw new \Exception("SendGrid falló y SMTP no está configurado. Verifica SENDGRID_API_KEY o configura SMTP_USER y SMTP_PASS.");
            }
        }

        // Guardar configuración original
        $originalPort = $this->mailer->Port;
        $originalSecure = $this->mailer->SMTPSecure;

        // Intentar con diferentes configuraciones SMTP
        $configs = [
            ['port' => 587, 'secure' => PHPMailer::ENCRYPTION_STARTTLS, 'name' => '587 (STARTTLS)'],
            ['port' => 465, 'secure' => PHPMailer::ENCRYPTION_SMTPS, 'name' => '465 (SSL)'],
        ];

        $lastError = null;

        foreach ($configs as $config) {
            try {
                // Configurar puerto y encriptación
                $this->mailer->Port = $config['port'];
                $this->mailer->SMTPSecure = $config['secure'];

                // Limpiar destinatarios anteriores
                $this->mailer->clearAddresses();
                $this->mailer->clearAttachments();
                $this->mailer->clearReplyTos();
                $this->mailer->clearAllRecipients();
                $this->mailer->clearCustomHeaders();

                // Configurar destinatario y contenido
                $this->mailer->addAddress($to);
                $this->mailer->isHTML(true);
                $this->mailer->Subject = $subject;
                $this->mailer->Body = $htmlBody;
                $this->mailer->AltBody = strip_tags($htmlBody);

                error_log("📤 Intentando enviar correo a: $to usando SMTP {$config['name']}");

                // Intentar enviar el correo
                $result = $this->mailer->send();

                if ($result) {
                    error_log("✅ Correo enviado exitosamente a: $to usando SMTP {$config['name']}");
                    // Restaurar configuración original
                    $this->mailer->Port = $originalPort;
                    $this->mailer->SMTPSecure = $originalSecure;
                    return true;
                } else {
                    $lastError = $this->mailer->ErrorInfo ?? 'Error desconocido';
                    error_log("❌ Falló con SMTP {$config['name']}: $lastError");
                }

            } catch (\Exception $e) {
                $lastError = $e->getMessage() . " | " . ($this->mailer->ErrorInfo ?? 'Sin información adicional');
                error_log("❌ Excepción con SMTP {$config['name']}: " . $e->getMessage());
                // Continuar con la siguiente configuración
                continue;
            }
        }

        // Si llegamos aquí, todos los intentos fallaron
        // Restaurar configuración original
        $this->mailer->Port = $originalPort;
        $this->mailer->SMTPSecure = $originalSecure;

        // Lanzar excepción con mensaje útil
        $errorMsg = "No se pudo enviar el correo. ";
        if (!empty($sendGridApiKey)) {
            $errorMsg .= "SendGrid falló y SMTP también falló. ";
        }
        $errorMsg .= "Último error SMTP: " . ($lastError ?? 'Desconocido');
        $errorMsg .= " | Considera usar SendGrid (SENDGRID_API_KEY) para evitar problemas con hostings que bloquean SMTP.";

        throw new \Exception($errorMsg);
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
            curl_close($ch);

            if ($curlError) {
                error_log("❌ Error cURL con SendGrid: $curlError");
                return false;
            }

            if ($httpCode >= 200 && $httpCode < 300) {
                error_log("✅ SendGrid envió el correo exitosamente (HTTP $httpCode)");
                return true;
            } else {
                // Parsear respuesta de error de SendGrid para mensaje más útil
                $errorDetails = $response;
                try {
                    $errorJson = json_decode($response, true);
                    if (isset($errorJson['errors']) && is_array($errorJson['errors'])) {
                        $errorMessages = array_map(function($err) {
                            return $err['message'] ?? 'Error desconocido';
                        }, $errorJson['errors']);
                        $errorDetails = implode('; ', $errorMessages);
                    }
                } catch (\Exception $e) {
                    // Si no se puede parsear, usar la respuesta original
                }

                error_log("❌ SendGrid falló (HTTP $httpCode): $errorDetails");
                return false;
            }

        } catch (\Exception $e) {
            error_log("❌ Excepción en sendEmailUsingSendGrid: " . $e->getMessage());
            return false;
        }
    }

    private function getDetailedSMTPError($errorInfo, $exceptionMsg)
    {
        $details = [
            'raw_error' => $errorInfo,
            'exception' => $exceptionMsg,
            'error_code' => null,
            'error_type' => 'unknown'
        ];

        // Buscar códigos de error comunes
        if (preg_match('/\b(\d{3})\b/', $errorInfo, $matches)) {
            $details['error_code'] = $matches[1];
        }

        $lowerError = strtolower($errorInfo . ' ' . $exceptionMsg);

        if (strpos($lowerError, 'authentication failed') !== false || strpos($lowerError, '535') !== false || strpos($lowerError, '534') !== false) {
            $details['error_type'] = 'authentication';
            $details['suggestion'] = 'Verifica SMTP_USER y SMTP_PASS. Si usas Gmail, usa una contraseña de aplicación.';
        } elseif (strpos($lowerError, 'connection') !== false || strpos($lowerError, 'timeout') !== false || strpos($lowerError, 'could not connect') !== false) {
            $details['error_type'] = 'connection';
            $details['suggestion'] = 'Verifica SMTP_HOST y SMTP_PORT. El servidor puede estar bloqueado o inaccesible.';
        } elseif (strpos($lowerError, 'could not instantiate mail function') !== false) {
            $details['error_type'] = 'server';
            $details['suggestion'] = 'Error del servidor. Contacta al administrador.';
        }

        return $details;
    }

    private function getUserFriendlyError($errorInfo, $exceptionMsg)
    {
        // Analizar el error y proporcionar mensajes más útiles
        $lowerError = strtolower($errorInfo . ' ' . $exceptionMsg);

        if (strpos($lowerError, 'authentication failed') !== false || strpos($lowerError, '535') !== false || strpos($lowerError, '534') !== false) {
            return "Error de autenticación SMTP. Verifica que SMTP_USER y SMTP_PASS sean correctos. Si usas Gmail, asegúrate de usar una contraseña de aplicación (no tu contraseña normal). Genera una en: https://myaccount.google.com/apppasswords";
        }

        if (strpos($lowerError, 'connection') !== false || strpos($lowerError, 'timeout') !== false || strpos($lowerError, 'could not connect') !== false || strpos($lowerError, 'stream_socket_client') !== false) {
            $currentPort = $this->mailer->Port ?? 'desconocido';
            $currentHost = $this->mailer->Host ?? 'desconocido';
            $suggestion = "Error de conexión con el servidor SMTP ({$currentHost}:{$currentPort}). ";
            $suggestion .= "Posibles soluciones:\n";
            $suggestion .= "1. El hosting puede estar bloqueando el puerto {$currentPort} - contacta a tu proveedor\n";
            if ($currentPort == 465) {
                $suggestion .= "2. Si estás usando puerto 465, intenta cambiar a 587 con STARTTLS\n";
            } else {
                $suggestion .= "2. Si estás usando puerto 587, intenta cambiar a 465 con SSL\n";
            }
            $suggestion .= "3. Algunos hostings bloquean TODAS las conexiones SMTP salientes\n";
            $suggestion .= "4. Considera usar un servicio de correo externo (SendGrid, Mailgun) si tu hosting bloquea SMTP";
            return $suggestion;
        }

        if (strpos($lowerError, 'could not instantiate mail function') !== false) {
            return "Error del servidor de correo. Contacta al administrador del sistema.";
        }

        // Mensaje genérico con información del error (limitado para no exponer demasiado)
        $shortError = substr($errorInfo ?: $exceptionMsg, 0, 200);
        return "No se pudo enviar el correo. Error técnico: " . $shortError . " (Revisa la configuración SMTP en el servidor)";
    }

    public function sendTicketAssignedNotification($ticket, $technician, $employee)
    {
        $subject = "Nuevo ticket asignado #{$ticket['id']}";
        $htmlContent = $this->generateTicketAssignedEmail($ticket, $technician, $employee);

        try {
            // Send to technician
            $this->sendEmail($technician['email'], $subject, $htmlContent);

            // Send confirmation to employee
            $employeeSubject = "Tu ticket #{$ticket['id']} ha sido asignado";
            $employeeContent = $this->generateTicketAssignedEmployeeEmail($ticket, $technician, $employee);

            $this->sendEmail($employee['email'], $employeeSubject, $employeeContent);

            error_log("Notificaciones de ticket asignado enviadas para ticket #{$ticket['id']}");
        } catch (\Exception $e) {
            error_log("Error enviando notificaciones de ticket asignado: " . $e->getMessage());
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

        try {
            // Enviar al empleado
            $this->sendEmail($employee['email'], $subject, $htmlContent);

            // Si hay técnico asignado, también enviarle
            if ($technician && !empty($technician['email'])) {
                $this->sendEmail($technician['email'], $subject, $htmlContent);
            }

            error_log("Correo de cambio de estado enviado para ticket #{$ticket['id']}");
        } catch (\Exception $e) {
            error_log("Error enviando correo de cambio de estado: " . $e->getMessage());
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
