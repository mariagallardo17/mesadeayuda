import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface EmailRequest {
  to: string;
  subject: string;
  body: string;
}

export interface EmailResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {

  constructor() { }

  /**
   * Simula el envío de un correo electrónico
   * En un entorno real, aquí se integraría con un servicio como SendGrid, AWS SES, etc.
   */
  sendEmail(emailRequest: EmailRequest): Observable<EmailResponse> {
    // Simular delay de red
    return of({
      success: true,
      message: 'Correo enviado exitosamente',
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }).pipe(
      delay(1500) // Simular tiempo de envío
    );
  }

  /**
   * Envía un correo de recuperación de contraseña
   */
  sendPasswordResetEmail(email: string, resetToken: string): Observable<EmailResponse> {
    const resetUrl = `${window.location.origin}/reset-password?token=${resetToken}`;

    const emailRequest: EmailRequest = {
      to: email,
      subject: 'Recuperación de Contraseña - Mesa de Ayuda',
      body: this.generatePasswordResetEmailBody(email, resetUrl)
    };

    return this.sendEmail(emailRequest);
  }

  /**
   * Genera el contenido HTML del correo de recuperación de contraseña
   */
  private generatePasswordResetEmailBody(email: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperación de Contraseña</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #667eea;
          }
          .header h1 {
            color: #667eea;
            margin: 0;
            font-size: 24px;
          }
          .content {
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .button:hover {
            opacity: 0.9;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mesa de Ayuda</h1>
            <p>Sistema de Gestión de Tickets</p>
          </div>

          <div class="content">
            <h2>Recuperación de Contraseña</h2>
            <p>Hola,</p>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta asociada al correo: <strong>${email}</strong></p>

            <p>Si solicitaste este cambio, haz clic en el siguiente botón para restablecer tu contraseña:</p>

            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
            </div>

            <p>O copia y pega el siguiente enlace en tu navegador:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
              ${resetUrl}
            </p>

            <div class="warning">
              <strong>⚠️ Importante:</strong>
              <ul>
                <li>Este enlace expirará en 24 horas por seguridad</li>
                <li>Si no solicitaste este cambio, puedes ignorar este correo</li>
                <li>Tu contraseña actual seguirá siendo válida hasta que la cambies</li>
              </ul>
            </div>
          </div>

          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>© ${new Date().getFullYear()} Mesa de Ayuda - Sistema de Gestión de Tickets</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
