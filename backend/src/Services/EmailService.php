<?php

namespace App\Services;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class EmailService
{
    private $mailer;

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

        // Server settings
        $this->mailer->isSMTP();
        $this->mailer->Host = $cleanEnv('SMTP_HOST', 'smtp.gmail.com');
        $this->mailer->SMTPAuth = true;
        $this->mailer->Username = $cleanEnv('SMTP_USER', '');
        $this->mailer->Password = $cleanEnv('SMTP_PASS', '');
        $this->mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $this->mailer->Port = (int)($cleanEnv('SMTP_PORT', '587'));
        $this->mailer->CharSet = 'UTF-8';

        // Configuraciones adicionales para Gmail
        $this->mailer->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        // Habilitar debug si está configurado o si hay problemas
        $debugLevel = isset($_ENV['SMTP_DEBUG']) && $_ENV['SMTP_DEBUG'] === 'true' ? 2 : 0;
        if ($debugLevel > 0) {
            $this->mailer->SMTPDebug = $debugLevel;
            $this->mailer->Debugoutput = function($str, $level) {
                error_log("PHPMailer Debug (Level $level): $str");
            };
        }

        // Validar que las credenciales estén configuradas
        if (empty($this->mailer->Username) || empty($this->mailer->Password)) {
            error_log("⚠️ Advertencia: SMTP_USER o SMTP_PASS no están configurados");
        }

        // Default sender (usar SMTP_FROM si está configurado, sino usar SMTP_USER)
        $smtpFrom = $cleanEnv('SMTP_FROM', '');
        if (!empty($smtpFrom)) {
            // SMTP_FROM puede estar en formato "Nombre <email@domain.com>"
            if (preg_match('/^(.+?)\s*<(.+?)>$/', $smtpFrom, $matches)) {
                $this->mailer->setFrom(trim($matches[2]), trim($matches[1]));
            } else {
                $this->mailer->setFrom($smtpFrom);
            }
        } elseif (!empty($this->mailer->Username)) {
            $this->mailer->setFrom($this->mailer->Username, 'Mesa de Ayuda - ITS');
        } else {
            error_log("⚠️ Advertencia: No se configuró SMTP_FROM ni SMTP_USER, el correo puede fallar");
        }

        // Log configuration (sin mostrar la contraseña completa)
        $passwordPreview = !empty($this->mailer->Password) ? substr($this->mailer->Password, 0, 4) . '...' : 'VACÍO';
        error_log("📧 Configuración SMTP cargada: Host={$this->mailer->Host}, Port={$this->mailer->Port}, User={$this->mailer->Username}, Pass={$passwordPreview}");
    }

    public function sendEmail($to, $subject, $htmlBody)
    {
        // Habilitar debug temporalmente si hay problemas
        $originalDebug = $this->mailer->SMTPDebug;
        $enableDebug = false;

        try {
            // Validar que el destinatario sea válido
            if (empty($to) || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
                throw new \Exception("Dirección de correo inválida: $to");
            }

            // Validar que las credenciales SMTP estén configuradas
            if (empty($this->mailer->Username) || empty($this->mailer->Password)) {
                $errorMsg = "Configuración SMTP incompleta. Verifica SMTP_USER y SMTP_PASS en las variables de entorno.";
                error_log("❌ $errorMsg");
                error_log("❌ Username vacío: " . (empty($this->mailer->Username) ? 'SÍ' : 'NO'));
                error_log("❌ Password vacío: " . (empty($this->mailer->Password) ? 'SÍ' : 'NO'));
                throw new \Exception($errorMsg);
            }

            $this->mailer->clearAddresses();
            $this->mailer->clearAttachments();
            $this->mailer->clearReplyTos();
            $this->mailer->clearAllRecipients();
            $this->mailer->clearCustomHeaders();

            $this->mailer->addAddress($to);

            $this->mailer->isHTML(true);
            $this->mailer->Subject = $subject;
            $this->mailer->Body = $htmlBody;
            $this->mailer->AltBody = strip_tags($htmlBody);

            error_log("📤 Intentando enviar correo a: $to");
            error_log("📤 Configuración SMTP: Host={$this->mailer->Host}, Port={$this->mailer->Port}, User={$this->mailer->Username}, Secure={$this->mailer->SMTPSecure}");

            // Habilitar debug temporalmente para capturar errores
            if ($enableDebug || isset($_ENV['SMTP_DEBUG']) && $_ENV['SMTP_DEBUG'] === 'true') {
                $this->mailer->SMTPDebug = 2;
                $this->mailer->Debugoutput = function($str, $level) {
                    error_log("PHPMailer Debug (Level $level): $str");
                };
            }

            $result = $this->mailer->send();

            // Restaurar debug original
            $this->mailer->SMTPDebug = $originalDebug;

            if (!$result) {
                $errorInfo = $this->mailer->ErrorInfo;
                error_log("❌ PHPMailer falló al enviar: $errorInfo");
                throw new \Exception("PHPMailer no pudo enviar el correo: $errorInfo");
            }

            error_log("✅ Correo enviado exitosamente a: $to");
            return true;
        } catch (Exception $e) {
            // Restaurar debug original
            $this->mailer->SMTPDebug = $originalDebug;

            $errorInfo = $this->mailer->ErrorInfo ?? 'Sin información de error';
            $errorMsg = "Error enviando correo a $to";
            error_log("❌ $errorMsg");
            error_log("❌ ErrorInfo de PHPMailer: $errorInfo");
            error_log("❌ Exception: " . $e->getMessage());
            error_log("❌ Stack trace: " . $e->getTraceAsString());

            // Proporcionar un mensaje más útil
            $userFriendlyError = $this->getUserFriendlyError($errorInfo, $e->getMessage());
            throw new \Exception($userFriendlyError);
        }
    }

    private function getUserFriendlyError($errorInfo, $exceptionMsg)
    {
        // Analizar el error y proporcionar mensajes más útiles
        $lowerError = strtolower($errorInfo . ' ' . $exceptionMsg);

        if (strpos($lowerError, 'authentication failed') !== false || strpos($lowerError, '535') !== false) {
            return "Error de autenticación SMTP. Verifica que SMTP_USER y SMTP_PASS sean correctos. Si usas Gmail, asegúrate de usar una contraseña de aplicación, no tu contraseña normal.";
        }

        if (strpos($lowerError, 'connection') !== false || strpos($lowerError, 'timeout') !== false) {
            return "Error de conexión con el servidor SMTP. Verifica que SMTP_HOST y SMTP_PORT sean correctos y que el servidor esté accesible.";
        }

        if (strpos($lowerError, 'could not instantiate mail function') !== false) {
            return "Error del servidor de correo. Contacta al administrador del sistema.";
        }

        // Mensaje genérico con información del error
        return "No se pudo enviar el correo. Error: " . ($errorInfo ?: $exceptionMsg);
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

    public function getFrontendUrl()
    {
        return $_ENV['FRONTEND_URL'] ?? 'http://localhost:4200';
    }
}
