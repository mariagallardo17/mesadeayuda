# 🔧 Solución de Problemas con Correos

## Problemas Comunes y Soluciones

### 1. ❌ "No hay configuración de correo disponible"

**Síntoma:** El sistema dice que no hay configuración de correo.

**Solución:**
1. Verifica que el archivo `.env` existe en la carpeta `backend/`
2. Verifica que tiene las siguientes variables configuradas:

**Para SMTP:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@correo.com
SMTP_PASS=tu_contraseña_app
SMTP_FROM="Mesa de Ayuda <tu@correo.com>"
```

**Para SendGrid:**
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM=tu@correo.com
```

3. **IMPORTANTE:** No uses comillas en las variables (excepto en SMTP_FROM si incluye nombre)
4. Reinicia el servidor después de modificar `.env`

---

### 2. ❌ SMTP no se conecta / "Connection refused"

**Síntoma:** El sistema intenta conectarse pero falla.

**Soluciones:**

#### a) Verifica el host y puerto:
- **Gmail:** `smtp.gmail.com` puerto `587` (TLS) o `465` (SSL)
- **Outlook/Hotmail:** `smtp-mail.outlook.com` puerto `587`
- **Yahoo:** `smtp.mail.yahoo.com` puerto `587` o `465`

#### b) Verifica que el hosting permita conexiones SMTP salientes:
- Algunos hostings bloquean el puerto 587
- Prueba con puerto 465 (SSL) o 25
- Contacta a tu proveedor de hosting si sigue fallando

#### c) Para Gmail específicamente:
1. Necesitas una **Contraseña de aplicación** (no tu contraseña normal)
2. Ve a: https://myaccount.google.com/apppasswords
3. Genera una contraseña de aplicación
4. Úsala en `SMTP_PASS`

#### d) Verifica el firewall:
- Algunos servidores bloquean conexiones salientes
- Verifica con tu administrador de servidor

---

### 3. ❌ SendGrid: "API Key inválida" o "403 Forbidden"

**Síntoma:** SendGrid rechaza la solicitud.

**Soluciones:**

#### a) Verifica la API Key:
1. Ve a: https://app.sendgrid.com/settings/api_keys
2. Verifica que la API Key tenga permisos de "Mail Send"
3. Copia la API Key completa (empieza con `SG.`)

#### b) Verifica el remitente:
1. Ve a: https://app.sendgrid.com/settings/sender_auth
2. Verifica que el correo en `SMTP_FROM` esté verificado
3. Si no está verificado, agrégalo y verifícalo

#### c) Verifica el formato:
- La API Key debe estar en `SENDGRID_API_KEY` sin comillas
- No debe tener espacios al inicio o final

---

### 4. ⚠️ Los correos se envían pero no llegan

**Síntoma:** El sistema dice que envió el correo pero no aparece en el buzón.

**Soluciones:**

#### a) Revisa la carpeta de spam:
- Los correos pueden estar en spam
- Marca como "No es spam" para futuros correos

#### b) Verifica el remitente:
- El correo remitente debe estar verificado
- Para Gmail: debe ser tu correo real
- Para SendGrid: debe estar verificado en SendGrid

#### c) Verifica el dominio:
- Si usas un dominio personalizado, configura SPF y DKIM
- Esto mejora la entregabilidad

#### d) Revisa los logs:
- Los logs pueden mostrar si el servidor SMTP aceptó el correo
- Busca mensajes de error en los logs

---

### 5. ❌ "PHPMailer Error" o errores de SSL

**Síntoma:** Errores relacionados con SSL/TLS.

**Soluciones:**

#### a) Verifica la extensión OpenSSL:
```bash
php -m | grep openssl
```
Si no aparece, instálala.

#### b) Para desarrollo local, desactiva verificación SSL:
El código ya tiene esto configurado, pero si persiste:
- Verifica que `SMTPOptions` esté configurado en `EmailService.php`

#### c) Prueba diferentes puertos:
- Puerto 587: TLS (STARTTLS)
- Puerto 465: SSL directo
- Puerto 25: Sin encriptación (puede estar bloqueado)

---

### 6. ❌ Variables de entorno no se cargan

**Síntoma:** El sistema no lee las variables del `.env`.

**Soluciones:**

#### a) Verifica la ubicación del `.env`:
- Debe estar en `backend/.env` (misma carpeta que `index.php`)

#### b) Verifica el formato del `.env`:
```env
# CORRECTO
SMTP_HOST=smtp.gmail.com
SMTP_USER=tu@correo.com

# INCORRECTO (con espacios)
SMTP_HOST = smtp.gmail.com
SMTP_USER = tu@correo.com
```

#### c) No uses comillas innecesarias:
```env
# CORRECTO
SMTP_HOST=smtp.gmail.com

# INCORRECTO
SMTP_HOST="smtp.gmail.com"
```

#### d) Reinicia el servidor:
- Después de modificar `.env`, reinicia PHP/Apache

---

## 🔍 Herramientas de Diagnóstico

### 1. Script de diagnóstico por navegador:
Accede a: `https://tudominio.com/backend/test-email-diagnostico.php`

Este script te mostrará:
- ✅ Estado de la configuración
- ✅ Extensiones PHP instaladas
- ✅ Prueba de conexión SMTP
- ✅ Prueba de API SendGrid
- ✅ Envío de correo de prueba

### 2. Script de diagnóstico por línea de comandos:
```bash
cd backend
php diagnostico-correos-completo.php
```

### 3. Revisar logs:
Los logs están en:
- `backend/error.log` (si está configurado)
- Logs del servidor web (Apache/Nginx)
- Logs de PHP

Busca líneas que empiecen con:
- `📧 [CORREOS]` - Información general
- `✅ [CORREOS]` - Operaciones exitosas
- `❌ [CORREOS]` - Errores
- `⚠️ [CORREOS]` - Advertencias

---

## 📋 Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] El archivo `.env` existe en `backend/`
- [ ] Las variables están configuradas (SMTP o SendGrid)
- [ ] No hay espacios extra en las variables
- [ ] No hay comillas innecesarias
- [ ] El correo remitente está verificado
- [ ] Las credenciales son correctas
- [ ] El hosting permite conexiones SMTP salientes
- [ ] Las extensiones PHP están instaladas (cURL, OpenSSL)
- [ ] PHPMailer está instalado (`composer install`)
- [ ] Revisaste la carpeta de spam
- [ ] Revisaste los logs de error

---

## 🆘 Si Nada Funciona

1. **Prueba con SendGrid** (más confiable que SMTP):
   - Crea cuenta en: https://sendgrid.com
   - Verifica tu correo remitente
   - Obtén API Key
   - Configura en `.env`

2. **Contacta a tu proveedor de hosting**:
   - Pregunta si bloquean conexiones SMTP salientes
   - Pregunta qué puertos están disponibles
   - Pregunta si hay restricciones de firewall

3. **Revisa los logs detallados**:
   - Habilita `SMTPDebug = 2` temporalmente en `EmailService.php`
   - Esto mostrará toda la conversación SMTP

4. **Prueba desde otro servidor**:
   - Si funciona en otro servidor, el problema es del hosting actual

---

## 📞 Información para Soporte

Si necesitas ayuda, proporciona:

1. **Resultado del diagnóstico:**
   - Ejecuta `test-email-diagnostico.php` y copia el resultado

2. **Configuración (sin contraseñas):**
   - Qué método usas (SMTP o SendGrid)
   - Host y puerto (si es SMTP)
   - Si el remitente está verificado

3. **Mensajes de error:**
   - Copia los mensajes de los logs
   - Especialmente los que empiezan con `❌ [CORREOS]`

4. **Información del servidor:**
   - Versión de PHP
   - Proveedor de hosting
   - Si tienes acceso a logs del servidor
