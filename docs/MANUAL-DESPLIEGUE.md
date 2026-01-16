# Manual de Configuración y Despliegue - Sistema de Mesa de Ayuda

##  Tabla de Contenidos

1. [Requisitos del Servidor](#requisitos-del-servidor)
2. [Configuración del Backend](#configuración-del-backend)
3. [Configuración del Frontend](#configuración-del-frontend)
4. [Configuración del Servidor Web](#configuración-del-servidor-web)
5. [Configuración de Base de Datos](#configuración-de-base-de-datos)
6. [Configuración de Seguridad](#configuración-de-seguridad)
7. [Configuración de Correos](#configuración-de-correos)
8. [Verificación Post-Despliegue](#verificación-post-despliegue)
9. [Mantenimiento](#mantenimiento)

---

## Requisitos del Servidor

### Especificaciones Mínimas Recomendadas

**Servidor Web:**
- CPU: 2+ núcleos
- RAM: 4 GB mínimo (8 GB recomendado)
- Almacenamiento: 20 GB SSD
- Sistema Operativo: Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+) o Windows Server 2019+

**Software Requerido:**
- PHP >= 8.0 con extensiones: PDO, OpenSSL, cURL, mbstring, JSON
- MySQL >= 8.0 o MariaDB >= 10.5
- Apache 2.4+ o Nginx 1.18+
- Composer 2.x
- Node.js 18.x+ (solo para compilación)
- Certificado SSL/TLS (recomendado)

---

## Configuración del Backend

### Paso 1: Subir Archivos al Servidor

**Opción 1: FTP/SFTP**
```bash
# Conectar al servidor
sftp usuario@servidor.com

# Subir archivos
put -r backend/
```

**Opción 2: Git**
```bash
# En el servidor
git clone <repositorio>
cd mesadeayuda-main/backend
```

**Opción 3: SCP**
```bash
scp -r backend/ usuario@servidor.com:/var/www/mesadeayuda/
```

### Paso 2: Instalar Dependencias en el Servidor

```bash
cd /ruta/al/backend
composer install --no-dev --optimize-autoloader
```

**Nota**: `--no-dev` excluye dependencias de desarrollo. `--optimize-autoloader` optimiza para producción.

### Paso 3: Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp env.example .env

# Editar configuración
nano .env
# O usar el editor que prefieras
```

**Configuración para Producción (.env):**
```env
# Base de Datos
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mesadeayuda
DB_USER=mesadeayuda_prod
DB_PASSWORD=contraseña_segura_aqui

# JWT - IMPORTANTE: Cambiar por una clave segura
# Generar: openssl rand -base64 32
JWT_SECRET=clave_secreta_muy_segura_generada_aqui

# SendGrid (Recomendado)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# O SMTP
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=correo@tudominio.com
# SMTP_PASS=contraseña_de_aplicacion
# SMTP_FROM="Mesa de Ayuda <noreply@tudominio.com>"

# CORS - URL de producción del frontend
CORS_ORIGIN=https://mesadeayuda.tudominio.com

# Entorno
ENVIRONMENT=production
DISPLAY_ERRORS=0  # IMPORTANTE: Siempre 0 en producción
TIMEZONE=America/Mexico_City
```

### Paso 4: Configurar Permisos

```bash
# Permisos para directorios
chmod 755 /ruta/al/backend
chmod 755 /ruta/al/backend/uploads

# Propietario (ajustar según tu servidor web)
chown -R www-data:www-data /ruta/al/backend  # Linux Apache
# O
chown -R nginx:nginx /ruta/al/backend  # Nginx

# Permisos para archivos
find /ruta/al/backend -type f -exec chmod 644 {} \;
find /ruta/al/backend -type d -exec chmod 755 {} \;
```

### Paso 5: Proteger Archivo .env

```bash
# Restringir acceso al archivo .env
chmod 600 /ruta/al/backend/.env
chown www-data:www-data /ruta/al/backend/.env
```

---

## Configuración del Frontend

### Paso 1: Compilar para Producción

**En tu máquina local o servidor de compilación:**
```bash
cd frontend
npm install
ng build --configuration production
```

**O si prefieres compilar en el servidor:**
```bash
# Instalar Node.js y npm en el servidor
# Luego:
cd frontend
npm install
ng build --configuration production
```

**Resultado:** Los archivos compilados estarán en `frontend/dist/mesadeayuda/browser/`

### Paso 2: Actualizar Configuración de API

**Antes de compilar**, editar `frontend/src/app/config/api.config.ts`:
```typescript
export const API_CONFIG = {
  baseUrl: 'https://api.tudominio.com/api',  // URL de producción
  timeout: 30000
};
```

### Paso 3: Subir Archivos Compilados

```bash
# Subir el contenido de dist/mesadeayuda/browser/
scp -r frontend/dist/mesadeayuda/browser/* usuario@servidor.com:/var/www/html/
```

**O configurar servidor web para servir directamente desde:**
```
/var/www/mesadeayuda/frontend/dist/mesadeayuda/browser/
```

---

## Configuración del Servidor Web

### Opción 1: Apache 2.4

#### Configuración Virtual Host (httpd.conf o sites-available/)

```apache
<VirtualHost *:80>
    ServerName mesadeayuda.tudominio.com
    ServerAlias www.mesadeayuda.tudominio.com
    
    # Redirigir a HTTPS
    Redirect permanent / https://mesadeayuda.tudominio.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName mesadeayuda.tudominio.com
    ServerAlias www.mesadeayuda.tudominio.com
    
    # Certificado SSL
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/tudominio.crt
    SSLCertificateKeyFile /etc/ssl/private/tudominio.key
    SSLCertificateChainFile /etc/ssl/certs/tudominio-chain.crt
    
    # Document Root (Frontend)
    DocumentRoot /var/www/mesadeayuda/frontend/dist/mesadeayuda/browser
    <Directory /var/www/mesadeayuda/frontend/dist/mesadeayuda/browser>
        AllowOverride All
        Require all granted
        Options -Indexes +FollowSymLinks
        
        # Rewrite rules para Angular
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # API Backend (Proxy)
    ProxyPreserveHost On
    ProxyPass /api http://localhost:8000/api
    ProxyPassReverse /api http://localhost:8000/api
    
    # O si usas PHP-FPM directamente:
    # Alias /api /var/www/mesadeayuda/backend
    # <Directory /var/www/mesadeayuda/backend>
    #     AllowOverride All
    #     Require all granted
    #     <FilesMatch \.php$>
    #         SetHandler "proxy:unix:/var/run/php/php8.0-fpm.sock|fcgi://localhost"
    #     </FilesMatch>
    # </Directory>
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/mesadeayuda_error.log
    CustomLog ${APACHE_LOG_DIR}/mesadeayuda_access.log combined
</VirtualHost>
```

#### Habilitar Módulos Necesarios

```bash
sudo a2enmod rewrite
sudo a2enmod ssl
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo systemctl restart apache2
```

### Opción 2: Nginx

#### Configuración del Site

```nginx
# Redirección HTTP a HTTPS
server {
    listen 80;
    server_name mesadeayuda.tudominio.com www.mesadeayuda.tudominio.com;
    return 301 https://mesadeayuda.tudominio.com$request_uri;
}

# Configuración HTTPS
server {
    listen 443 ssl http2;
    server_name mesadeayuda.tudominio.com www.mesadeayuda.tudominio.com;
    
    # Certificado SSL
    ssl_certificate /etc/ssl/certs/tudominio.crt;
    ssl_certificate_key /etc/ssl/private/tudominio.key;
    ssl_trusted_certificate /etc/ssl/certs/tudominio-chain.crt;
    
    # Configuración SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Document Root (Frontend)
    root /var/www/mesadeayuda/frontend/dist/mesadeayuda/browser;
    index index.html;
    
    # Compresión
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
    
    # Frontend - Angular
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
    
    # Assets estáticos con caché
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API Backend
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Uploads
    location /uploads {
        alias /var/www/mesadeayuda/backend/uploads;
        access_log off;
    }
    
    # Seguridad - Bloquear acceso a archivos sensibles
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ \.(env|log|sql)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

#### Habilitar Site

```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/mesadeayuda /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### Opción 3: PHP Built-in Server (Solo para Pruebas)

**NO RECOMENDADO para producción**, solo para pruebas rápidas:

```bash
cd /ruta/al/backend
php -S localhost:8000 -t .
```

---

## Configuración de Base de Datos

### Crear Usuario y Base de Datos

```sql
-- Crear base de datos
CREATE DATABASE mesadeayuda 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

-- Crear usuario (NO usar root en producción)
CREATE USER 'mesadeayuda_prod'@'localhost' 
    IDENTIFIED BY 'contraseña_muy_segura_aqui';

-- Otorgar privilegios
GRANT ALL PRIVILEGES ON mesadeayuda.* 
    TO 'mesadeayuda_prod'@'localhost';

FLUSH PRIVILEGES;
```

### Importar Estructura

```bash
mysql -u mesadeayuda_prod -p mesadeayuda < backend/_resources/database.sql
```

### Configurar MySQL para Producción

**Editar `/etc/mysql/mysql.conf.d/mysqld.cnf`:**
```ini
[mysqld]
# Charset
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Configuración de rendimiento
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M

# Logs
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-query.log
long_query_time = 2
```

**Reiniciar MySQL:**
```bash
sudo systemctl restart mysql
```

### Crear Backup Automático

**Script de backup (`/usr/local/bin/backup-mesadeayuda.sh`):**
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mesadeayuda"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="mesadeayuda"
DB_USER="mesadeayuda_prod"
DB_PASS="contraseña"

mkdir -p $BACKUP_DIR

# Backup de base de datos
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup de uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/mesadeayuda/backend/uploads

# Eliminar backups antiguos (más de 30 días)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completado: $DATE"
```

**Hacer ejecutable y configurar cron:**
```bash
sudo chmod +x /usr/local/bin/backup-mesadeayuda.sh

# Agregar a crontab (backup diario a las 2 AM)
sudo crontab -e
# Agregar línea:
0 2 * * * /usr/local/bin/backup-mesadeayuda.sh >> /var/log/backup-mesadeayuda.log 2>&1
```

---

## Configuración de Seguridad

### 1. Configurar PHP para Producción

**Editar `php.ini`:**
```ini
; Ocultar errores
display_errors = Off
display_startup_errors = Off

; Logs de errores
log_errors = On
error_log = /var/log/php_errors.log

; Límites de seguridad
upload_max_filesize = 10M
post_max_size = 12M
max_execution_time = 30
max_input_time = 60

; Deshabilitar funciones peligrosas
disable_functions = exec,passthru,shell_exec,system,proc_open,popen

; Ocultar versión de PHP
expose_php = Off
```

### 2. Configurar Firewall

**UFW (Ubuntu):**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

**Firewalld (CentOS/RHEL):**
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

### 3. Configurar Certificado SSL/TLS

**Opción 1: Let's Encrypt (Gratis)**
```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-apache  # Para Apache
# O
sudo apt install certbot python3-certbot-nginx   # Para Nginx

# Obtener certificado
sudo certbot --apache -d mesadeayuda.tudominio.com
# O
sudo certbot --nginx -d mesadeayuda.tudominio.com

# Renovación automática (ya configurado automáticamente)
sudo certbot renew --dry-run
```

**Opción 2: Certificado Comercial**
- Obtener certificado de un proveedor comercial
- Configurar en el servidor web según las instrucciones del proveedor

### 4. Headers de Seguridad

**Para Apache (.htaccess o configuración del VirtualHost):**
```apache
# Security Headers
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"

# CSP (Content Security Policy) - Ajustar según necesidades
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
```

**Para Nginx:**
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
```

### 5. Proteger Archivos Sensibles

**Crear `.htaccess` en el directorio raíz del backend:**
```apache
# Proteger archivos sensibles
<FilesMatch "\.(env|log|sql|md)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Bloquear acceso a directorios
Options -Indexes
```

---

## Configuración de Correos

### SendGrid (Recomendado)

1. **Verificar Dominio en SendGrid:**
   - Ir a Settings > Sender Authentication
   - Verificar dominio o usar Single Sender Verification
   - Configurar registros DNS según instrucciones

2. **Obtener API Key:**
   - Settings > API Keys
   - Crear nueva API Key con permisos "Mail Send"
   - Guardar en `SENDGRID_API_KEY`

3. **Configurar From Address:**
   - Settings > Sender Authentication > Single Sender Verification
   - Verificar dirección de correo remitente

### SMTP Alternativo

Si usas SMTP en lugar de SendGrid:

**Gmail con App Password:**
1. Activar verificación en 2 pasos
2. Generar contraseña de aplicación
3. Configurar en `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=correo@gmail.com
   SMTP_PASS=contraseña_de_aplicacion
   SMTP_FROM="Mesa de Ayuda <correo@gmail.com>"
   ```

---

## Verificación Post-Despliegue

### Checklist de Verificación

- [ ] **Backend accesible:**
  ```bash
  curl https://mesadeayuda.tudominio.com/api/health
  # Debe retornar: {"status":"OK","database":"Connected",...}
  ```

- [ ] **Frontend carga correctamente:**
  - Abrir en navegador: `https://mesadeayuda.tudominio.com`
  - Verificar que no haya errores en consola (F12)

- [ ] **Login funciona:**
  - Intentar iniciar sesión con credenciales válidas
  - Verificar que se reciba token JWT

- [ ] **Crear ticket de prueba:**
  - Crear un ticket desde la aplicación
  - Verificar que se guarde en la base de datos

- [ ] **Correos funcionan:**
  - Crear ticket y verificar que se envíe correo
  - Revisar logs en SendGrid Dashboard o SMTP

- [ ] **Archivos se suben correctamente:**
  - Subir archivo adjunto en un ticket
  - Verificar que se guarde en `backend/uploads/`

- [ ] **SSL/HTTPS funciona:**
  - Verificar certificado en: https://www.ssllabs.com/ssltest/
  - Debe tener calificación A o A+

- [ ] **Backups funcionan:**
  - Ejecutar script de backup manualmente
  - Verificar que se cree archivo de backup

### Monitoreo

**Configurar monitoreo básico:**
```bash
# Instalar herramientas de monitoreo (opcional)
# Ejemplo: Monit, Uptime Robot, etc.
```

---

## Mantenimiento

### Actualizaciones

**Actualizar Backend:**
```bash
cd /var/www/mesadeayuda/backend
git pull  # Si usas Git
# O subir nuevos archivos

composer install --no-dev --optimize-autoloader
```

**Actualizar Frontend:**
```bash
cd /var/www/mesadeayuda/frontend
git pull  # Si usas Git
npm install
ng build --configuration production

# Reemplazar archivos compilados
cp -r dist/mesadeayuda/browser/* /var/www/html/
```

### Logs

**Revisar logs regularmente:**
```bash
# Logs de Apache
tail -f /var/log/apache2/mesadeayuda_error.log

# Logs de Nginx
tail -f /var/log/nginx/error.log

# Logs de PHP
tail -f /var/log/php_errors.log

# Logs del backend
tail -f /var/www/mesadeayuda/backend/error.log
```

### Limpieza

**Limpiar logs antiguos:**
```bash
# Configurar rotación de logs
# Ver: logrotate
```

**Limpiar archivos temporales:**
```bash
# Limpiar archivos antiguos en uploads (si es necesario)
find /var/www/mesadeayuda/backend/uploads -type f -mtime +90 -delete
```

---

**Última Actualización**: Enero 2025  
**Versión del Documento**: 1.0.0

