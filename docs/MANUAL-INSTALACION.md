# Manual de Instalación - Sistema de Mesa de Ayuda

##  Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Instalación del Backend](#instalación-del-backend)
3. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)
4. [Instalación del Frontend](#instalación-del-frontend)
5. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
6. [Verificación de la Instalación](#verificación-de-la-instalación)
7. [Solución de Problemas](#solución-de-problemas)

---

## Requisitos Previos

### Software Necesario

#### Para el Backend:
- **PHP**: >= 8.0
  - Extensión PDO para MySQL
  - Extensión OpenSSL
  - Extensión cURL
  - Extensión JSON
  - Extensión mbstring
- **Composer**: >= 2.0
- **MySQL**: >= 8.0 o MariaDB >= 10.5
- **Servidor Web**: Apache 2.4+ o Nginx 1.18+

#### Para el Frontend:
- **Node.js**: >= 18.x
- **npm**: >= 9.x (incluido con Node.js)
- **Angular CLI**: 20.3.0 (se instala automáticamente)

#### Para Desarrollo:
- **Git**: (opcional, para control de versiones)
- **Editor de Código**: Visual Studio Code, PhpStorm, etc.

### Verificar Instalación de Requisitos

**Windows (PowerShell):**
```powershell
# Verificar PHP
php -v

# Verificar Composer
composer --version

# Verificar Node.js
node -v

# Verificar npm
npm -v

# Verificar MySQL
mysql --version
```

**Linux/Mac:**
```bash
# Verificar PHP
php -v

# Verificar Composer
composer --version

# Verificar Node.js
node -v

# Verificar npm
npm -v

# Verificar MySQL
mysql --version
```

---

## Instalación del Backend

### Paso 1: Clonar/Descargar el Proyecto

Si tienes acceso al repositorio:
```bash
git clone <url-del-repositorio>
cd mesadeayuda-main
```

Si tienes el código comprimido:
```bash
# Extraer el archivo ZIP/tar
cd mesadeayuda-main
```

### Paso 2: Instalar Dependencias PHP

```bash
cd backend
composer install
```

**Nota**: Si no tienes Composer instalado:
1. Descargar desde: https://getcomposer.org/download/
2. Instalar siguiendo las instrucciones del sitio

**Problemas Comunes:**
- Si aparece error de memoria, aumentar límite:
  ```bash
  php -d memory_limit=-1 composer install
  ```

### Paso 3: Crear Archivo de Configuración

```bash
# Copiar el archivo de ejemplo
cp env.example .env
# O en Windows:
copy env.example .env
```

Editar el archivo `.env` con tu configuración (ver sección [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)).

### Paso 4: Verificar Estructura de Directorios

Asegúrate de que existan los siguientes directorios:
```bash
backend/
├── uploads/          # Crear si no existe (permisos 755)
├── vendor/           # Se crea con composer install
└── .env              # Tu archivo de configuración
```

**Crear directorio de uploads:**
```bash
# Windows
mkdir uploads

# Linux/Mac
mkdir -p uploads
chmod 755 uploads
```

---

## Configuración de la Base de Datos

### Paso 1: Crear Base de Datos

Acceder a MySQL:
```bash
mysql -u root -p
```

Ejecutar comandos SQL:
```sql
-- Crear base de datos
CREATE DATABASE mesadeayuda CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear usuario (opcional, recomendado para producción)
CREATE USER 'mesadeayuda_user'@'localhost' IDENTIFIED BY 'contraseña_segura';
GRANT ALL PRIVILEGES ON mesadeayuda.* TO 'mesadeayuda_user'@'localhost';
FLUSH PRIVILEGES;

-- Salir
EXIT;
```

### Paso 2: Importar Estructura de Base de Datos

```bash
mysql -u root -p mesadeayuda < backend/_resources/database.sql
```

O si usas el usuario creado:
```bash
mysql -u mesadeayuda_user -p mesadeayuda < backend/_resources/database.sql
```

### Paso 3: Importar Scripts Adicionales (Opcional)

```bash
# Optimizaciones de índices
mysql -u root -p mesadeayuda < backend/_resources/optimizaciones-indices.sql

# Script para reportes mensuales
mysql -u root -p mesadeayuda < backend/_resources/create-reportes-mensuales.sql
```

### Paso 4: Verificar Importación

```bash
mysql -u root -p mesadeayuda
```

```sql
-- Verificar tablas creadas
SHOW TABLES;

-- Deberías ver tablas como:
-- - usuarios
-- - tickets
-- - servicios
-- - asignaciones
-- - escalamientos
-- - evaluaciones
-- - notificaciones
-- - reportes_mensuales

-- Verificar estructura de una tabla
DESCRIBE usuarios;

EXIT;
```

---

## Instalación del Frontend

### Paso 1: Navegar al Directorio Frontend

```bash
cd frontend
```

### Paso 2: Instalar Dependencias Node.js

```bash
npm install
```

**Nota**: Este proceso puede tardar varios minutos dependiendo de tu conexión a internet.

**Problemas Comunes:**
- Si hay errores de permisos (Linux/Mac):
  ```bash
  sudo npm install
  ```
- Si hay problemas con node_modules:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### Paso 3: Verificar Instalación

```bash
# Verificar que Angular CLI esté instalado
npx ng version

# O verificar manualmente
ng version
```

---

## Configuración de Variables de Entorno

### Configurar Backend (.env)

Editar el archivo `backend/.env`:

```env
# ============================================
# CONFIGURACIÓN DE BASE DE DATOS
# ============================================
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mesadeayuda
DB_USER=root
# O usar el usuario creado:
# DB_USER=mesadeayuda_user
DB_PASSWORD=tu_contraseña_mysql

# ============================================
# CONFIGURACIÓN JWT (AUTENTICACIÓN)
# ============================================
# IMPORTANTE: Cambiar por una clave secreta segura
# Generar una clave: openssl rand -base64 32
JWT_SECRET=clave_secreta_muy_segura_generada_aqui

# ============================================
# CONFIGURACIÓN DE CORREO ELECTRÓNICO
# ============================================
# Opción 1: SendGrid (RECOMENDADO)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Opción 2: SMTP (Alternativa)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_contraseña_de_aplicacion
SMTP_FROM="Mesa de Ayuda ITS <noreply@tudominio.com>"

# ============================================
# CONFIGURACIÓN CORS
# ============================================
CORS_ORIGIN=http://localhost:4200

# ============================================
# CONFIGURACIÓN DEL ENTORNO
# ============================================
ENVIRONMENT=development
DISPLAY_ERRORS=1
TIMEZONE=America/Mexico_City
```

### Configurar Frontend (api.config.ts)

Editar el archivo `frontend/src/app/config/api.config.ts`:

```typescript
export const API_CONFIG = {
  baseUrl: 'http://localhost/api',  
  timeout: 30000
};
```

**Para producción:**
```typescript
export const API_CONFIG = {
  baseUrl: 'https://api.tudominio.com/api',
  timeout: 30000
};
```

### Obtener API Key de SendGrid

1. Crear cuenta en: https://app.sendgrid.com
2. Verificar tu dominio (o usar Single Sender Verification)
3. Ir a Settings > API Keys
4. Crear nueva API Key con permisos de "Mail Send"
5. Copiar la API Key y pegarla en `SENDGRID_API_KEY`

### Configurar SMTP (Alternativa a SendGrid)

#### Para Gmail:
1. Activar verificación en 2 pasos
2. Ir a: https://myaccount.google.com/apppasswords
3. Generar contraseña de aplicación para "Correo"
4. Usar esa contraseña en `SMTP_PASS`

#### Para Outlook/Hotmail:
1. Usar autenticación normal de Office 365
2. `SMTP_HOST`: smtp.office365.com
3. `SMTP_PORT`: 587

---

## Verificación de la Instalación

### Verificar Backend

#### 1. Verificar Health Check

Acceder a: `http://localhost/api/health`

**Respuesta esperada:**
```json
{
  "status": "OK",
  "database": "Connected",
  "timestamp": "2025-01-07T15:30:00-06:00"
}
```

#### 2. Verificar Conexión a Base de Datos

Ejecutar desde terminal:
```bash
cd backend
php -r "
require 'vendor/autoload.php';
use App\Config\Database;
try {
    \$db = Database::getInstance();
    echo ' Conexión a base de datos exitosa\n';
} catch (Exception \$e) {
    echo ' Error: ' . \$e->getMessage() . '\n';
}
"
```

#### 3. Verificar Configuración de Correo

Acceder a: `http://localhost/api/auth/test-smtp`

**Respuesta esperada:**
```json
{
  "status": "success",
  "smtp_configured": true,
  "sendgrid_configured": true
}
```

### Verificar Frontend

#### 1. Iniciar Servidor de Desarrollo

```bash
cd frontend
ng serve
# O
npm start
```

Abrir en el navegador: `http://localhost:4200`

#### 2. Verificar que se Cargue la Aplicación

Deberías ver:
- Pantalla de login
- Sin errores en la consola del navegador (F12)

---

## Solución de Problemas

### Problemas Comunes con Backend

#### Error: "Dependencies not installed"
**Solución:**
```bash
cd backend
composer install
```

#### Error: "No se encontró archivo .env"
**Solución:**
```bash
cd backend
cp env.example .env
# Editar .env con tu configuración
```

#### Error de Conexión a Base de Datos
**Verificar:**
1. MySQL está corriendo:
   ```bash
   # Windows
   net start MySQL80
   
   # Linux
   sudo systemctl status mysql
   ```

2. Credenciales en `.env` son correctas
3. Base de datos existe:
   ```sql
   SHOW DATABASES;
   ```

4. Usuario tiene permisos:
   ```sql
   SHOW GRANTS FOR 'usuario'@'localhost';
   ```

#### Error: "Class 'App\Config\Database' not found"
**Solución:**
```bash
cd backend
composer dump-autoload
```

#### Error de Permisos en Directorio uploads
**Solución:**
```bash
# Linux/Mac
chmod 755 uploads
chown www-data:www-data uploads

# Windows: Verificar permisos desde Propiedades > Seguridad
```

### Problemas Comunes con Frontend

#### Error: "ng: command not found"
**Solución:**
```bash
npm install -g @angular/cli
```

O usar npx:
```bash
npx ng serve
```

#### Error: "Cannot find module '@angular/core'"
**Solución:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

#### Error de CORS en el navegador
**Solución:**
1. Verificar que `CORS_ORIGIN` en backend `.env` sea correcto
2. Verificar que el backend esté corriendo
3. Verificar la URL en `api.config.ts`

#### Error: "ERR_CONNECTION_REFUSED"
**Solución:**
1. Verificar que el backend esté corriendo
2. Verificar la URL en `api.config.ts`
3. Verificar el puerto del servidor web

### Problemas con Correos Electrónicos

#### SendGrid no envía correos
**Verificar:**
1. API Key es correcta
2. Dominio remitente está verificado en SendGrid
3. API Key tiene permisos de "Mail Send"
4. Revisar logs en SendGrid Dashboard > Activity

#### SMTP no funciona
**Verificar:**
1. Credenciales correctas
2. Puerto no está bloqueado por firewall
3. Si es Gmail, usar "Contraseña de Aplicación"
4. Servidor SMTP permite conexiones externas

**Probar conexión SMTP:**
```bash
cd backend
php test-smtp.php
```

### Problemas con Base de Datos

#### Error: "Table 'mesadeayuda.tabla' doesn't exist"
**Solución:**
```bash
# Reimportar estructura
mysql -u root -p mesadeayuda < backend/_resources/database.sql
```

#### Error: "Access denied for user"
**Solución:**
1. Verificar usuario y contraseña en `.env`
2. Verificar permisos del usuario:
   ```sql
   GRANT ALL PRIVILEGES ON mesadeayuda.* TO 'usuario'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Verificar Logs

#### Backend (PHP)
```bash
# Ver error.log del backend
tail -f backend/error.log

# Ver logs de PHP
tail -f /var/log/php_errors.log  # Linux
# O verificar ubicación en php.ini: error_log
```

#### Frontend (Navegador)
1. Abrir herramientas de desarrollador (F12)
2. Pestaña Console para errores JavaScript
3. Pestaña Network para errores de peticiones HTTP

---

## Próximos Pasos

Después de completar la instalación:

1. **Crear Usuario Administrador**:
   - Ver manual de usuario o ejecutar script de creación
   - O crear manualmente en la base de datos

2. **Configurar Servidor Web** (para producción):
   - Ver [Manual de Despliegue](MANUAL-DESPLIEGUE.md)

3. **Revisar Configuración de Seguridad**:
   - Cambiar `JWT_SECRET` por una clave segura
   - Cambiar `DISPLAY_ERRORS=0` en producción
   - Configurar HTTPS

4. **Probar Funcionalidades**:
   - Crear un ticket de prueba
   - Asignar un ticket
   - Cerrar y evaluar un ticket

---

## Comandos Útiles

### Desarrollo

```bash
# Backend - Servidor integrado PHP
cd backend
php -S localhost:8000 -t .

# Frontend - Servidor de desarrollo Angular
cd frontend
ng serve
# O en un puerto específico:
ng serve --port 4200
```

### Producción

```bash
# Backend - Configurar en servidor web (Apache/Nginx)
# Ver Manual de Despliegue

# Frontend - Compilar para producción
cd frontend
ng build --configuration production
# Los archivos estarán en frontend/dist/mesadeayuda/browser/
```

---

**Última Actualización**: Enero 2025  
**Versión del Documento**: 1.0.0

