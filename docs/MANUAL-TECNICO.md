# Manual Técnico - Sistema de Mesa de Ayuda

##  Tabla de Contenidos

1. [Información General](#información-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Versiones y Dependencias](#versiones-y-dependencias)
4. [Estructura de la Base de Datos](#estructura-de-la-base-de-datos)
5. [API REST - Endpoints](#api-rest---endpoints)
6. [Seguridad](#seguridad)
7. [Servicios Externos](#servicios-externos)
8. [Flujos de Trabajo Principales](#flujos-de-trabajo-principales)

---

## Información General

### Propósito del Sistema
Sistema de gestión de tickets de mesa de ayuda para el seguimiento, asignación y resolución de solicitudes de soporte técnico.

### Versión Actual
- **Versión del Sistema**: 1.0.0
- **Fecha de Última Actualización**: Enero 2025
- **Estado**:  Listo para Producción

---

## Arquitectura del Sistema

### Diagrama de Arquitectura

```
┌─────────────────┐
│   Frontend      │
│   Angular 20.3  │
│   (Navegador)   │
└────────┬────────┘
         │ HTTP/REST
         │ JWT Token
         ▼
┌─────────────────┐
│   Backend API   │
│   PHP 8.0+      │
│   index.php     │
└────────┬────────┘
         │ PDO
         ▼
┌─────────────────┐
│  MySQL 8.0.43   │
│  Base de Datos  │
└─────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  SendGrid API   │     │   SMTP       │
│  (Correos)      │     │  (Alternativo)│
└─────────────────┘     └──────────────┘
```

### Patrón de Diseño
- **Frontend**: Component-Based Architecture (Angular)
- **Backend**: MVC (Model-View-Controller) personalizado
- **Autenticación**: JWT (JSON Web Tokens)
- **Comunicación**: RESTful API con JSON

---

## Versiones y Dependencias

### Frontend

#### Framework Principal
- **Angular**: 20.3.0
- **TypeScript**: 5.9.2
- **Node.js**: >= 18.x (requerido)

#### Dependencias Principales
```json
{
  "@angular/common": "^20.3.0",
  "@angular/core": "^20.3.0",
  "@angular/forms": "^20.3.0",
  "@angular/router": "^20.3.0",
  "@angular/platform-browser": "^20.3.0",
  "axios": "^1.12.2",
  "chart.js": "^4.1.1",
  "jspdf": "^3.0.3",
  "html2canvas": "^1.4.1",
  "rxjs": "~7.8.0"
}
```

#### Herramientas de Desarrollo
```json
{
  "@angular/cli": "^20.3.0",
  "@angular/build": "^20.3.0",
  "typescript": "~5.9.2"
}
```

### Backend

#### Runtime
- **PHP**: >= 8.0
- **Extensión PDO**: Requerida
- **Extensión OpenSSL**: Requerida (para JWT)
- **Extensión cURL**: Requerida (para SendGrid)
- **Composer**: >= 2.0

#### Dependencias PHP (composer.json)
```json
{
  "php": ">=8.0",
  "vlucas/phpdotenv": "^5.5",
  "firebase/php-jwt": "^6.8",
  "phpmailer/phpmailer": "^6.8"
}
```

### Base de Datos

- **MySQL**: 8.0.43
- **Charset**: utf8mb4
- **Collation**: utf8mb4_unicode_ci
- **Motor**: InnoDB

---

## Estructura de la Base de Datos

### Tablas Principales

#### 1. usuarios
Almacena información de usuarios del sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_usuario | INT | PK, Auto-increment |
| nombre | VARCHAR(100) | Nombre completo |
| email | VARCHAR(100) | Email (único) |
| password | VARCHAR(255) | Contraseña (hasheada) |
| rol | ENUM | 'Administrador', 'Tecnico', 'Usuario' |
| estado | ENUM | 'Activo', 'Inactivo' |
| fecha_creacion | DATETIME | Timestamp de creación |

#### 2. tickets
Almacena los tickets de soporte.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_ticket | INT | PK, Auto-increment |
| id_usuario | INT | FK a usuarios |
| id_servicio | INT | FK a servicios |
| titulo | VARCHAR(255) | Título del ticket |
| descripcion | TEXT | Descripción detallada |
| estado | ENUM | Estados del ticket |
| prioridad | ENUM | Niveles de prioridad |
| fecha_creacion | DATETIME | Fecha de creación |
| fecha_cierre | DATETIME | Fecha de cierre (nullable) |

#### 3. servicios
Catálogo de servicios disponibles.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_servicio | INT | PK, Auto-increment |
| nombre | VARCHAR(255) | Nombre del servicio |
| descripcion | TEXT | Descripción |
| requiere_aprobacion | BOOLEAN | Si requiere aprobación |
| estado | ENUM | 'Activo', 'Inactivo' |

#### 4. asignaciones
Relación entre tickets y técnicos asignados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_asignacion | INT | PK, Auto-increment |
| id_ticket | INT | FK a tickets |
| id_tecnico | INT | FK a usuarios |
| fecha_asignacion | DATETIME | Fecha de asignación |

#### 5. escalamientos
Registro de escalamientos de tickets.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INT | PK, Auto-increment |
| id_ticket | INT | FK a tickets |
| tecnico_original_id | INT | FK a usuarios |
| tecnico_nuevo_id | INT | FK a usuarios (nullable) |
| nivel_escalamiento | VARCHAR(50) | Nivel de escalamiento |
| motivo_escalamiento | TEXT | Motivo |
| estatus | ENUM | Estado del escalamiento |

#### 6. evaluaciones
Evaluaciones post-cierre de tickets.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_evaluacion | INT | PK, Auto-increment |
| id_ticket | INT | FK a tickets (único) |
| calificacion | INT | 1-5 estrellas |
| comentario | TEXT | Comentario opcional |
| fecha_evaluacion | DATETIME | Fecha de evaluación |

#### 7. notificaciones
Sistema de notificaciones del usuario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_notificacion | INT | PK, Auto-increment |
| id_ticket | INT | FK a tickets |
| id_usuario | INT | FK a usuarios |
| tipo | ENUM | 'Correo', 'WhatsApp', 'Interna' |
| mensaje | TEXT | Mensaje de notificación |
| leida | BOOLEAN | Estado de lectura |
| fecha_creacion | DATETIME | Fecha de creación |

#### 8. reportes_mensuales
Reportes mensuales generados automáticamente.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_reporte | INT | PK, Auto-increment |
| mes | INT | Mes (1-12) |
| año | INT | Año |
| datos | JSON | Datos del reporte |
| fecha_generacion | DATETIME | Fecha de generación |

### Índices y Optimizaciones
- Índices en claves foráneas
- Índices en campos de búsqueda frecuente (estado, fecha)
- Índices compuestos para consultas complejas

---

## API REST - Endpoints

### Base URL
```
http://localhost/api (desarrollo)
https://tudominio.com/api (producción)
```

### Autenticación
La mayoría de los endpoints requieren autenticación mediante JWT Token en el header:
```
Authorization: Bearer <token>
```

### Endpoints Disponibles

#### 1. Autenticación (`/auth`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/auth/login` | Iniciar sesión | No |
| GET | `/auth/verify` | Verificar token | Sí |
| POST | `/auth/change-password` | Cambiar contraseña | Sí |
| POST | `/auth/change-temporary-password` | Cambiar contraseña temporal | Sí |
| POST | `/auth/forgot-password` | Recuperar contraseña | No |
| GET | `/auth/profile` | Obtener perfil | Sí |
| GET | `/auth/test-smtp` | Probar configuración SMTP | No |

**Ejemplo de Login:**
```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "contraseña"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id_usuario": 1,
    "nombre": "Juan Pérez",
    "email": "usuario@ejemplo.com",
    "rol": "Usuario"
  }
}
```

#### 2. Tickets (`/tickets`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/tickets/my-tickets` | Mis tickets | Sí |
| GET | `/tickets/:id` | Obtener ticket por ID | Sí |
| POST | `/tickets` | Crear ticket | Sí |
| PUT | `/tickets/:id/status` | Actualizar estado | Sí |
| POST | `/tickets/:id/close` | Cerrar ticket | Sí |
| POST | `/tickets/:id/evaluate` | Evaluar ticket | Sí |
| POST | `/tickets/:id/escalate` | Escalar ticket | Sí |
| PUT | `/tickets/:id/reopen/technician-comment` | Reabrir con comentario | Sí |
| GET | `/tickets/reopened` | Tickets reabiertos | Sí |
| GET | `/tickets/escalados` | Tickets escalados | Sí |
| GET | `/tickets/technicians` | Lista de técnicos | Sí |
| GET | `/tickets/check-pending-evaluation` | Verificar evaluación pendiente | Sí |
| GET | `/tickets/:id/evaluation` | Obtener evaluación | Sí |
| GET | `/tickets/:ticketId/approval-letter` | Carta de aprobación | Sí |
| GET | `/tickets/download/:filename` | Descargar archivo | Sí |

**Ejemplo de Crear Ticket:**
```json
POST /api/tickets
Authorization: Bearer <token>
Content-Type: application/json

{
  "titulo": "Problema con impresora",
  "descripcion": "La impresora no imprime correctamente",
  "id_servicio": 1,
  "prioridad": "Media",
  "archivos": ["archivo.pdf"]
}

Response:
{
  "id_ticket": 123,
  "titulo": "Problema con impresora",
  "estado": "Abierto",
  "fecha_creacion": "2025-01-07 15:30:00"
}
```

#### 3. Usuarios (`/users`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/users` | Listar usuarios | Sí | Admin |
| GET | `/users/:id` | Obtener usuario | Sí | Admin |
| POST | `/users` | Crear usuario | Sí | Admin |
| PUT | `/users/:id` | Actualizar usuario | Sí | Admin |
| DELETE | `/users/:id` | Eliminar usuario | Sí | Admin |
| POST | `/users/:id/reset-password` | Resetear contraseña | Sí | Admin |

#### 4. Servicios (`/services`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/services` | Listar servicios | Sí |
| GET | `/services/:id` | Obtener servicio | Sí |
| POST | `/services` | Crear servicio | Sí |
| PUT | `/services/:id` | Actualizar servicio | Sí |
| DELETE | `/services/:id` | Eliminar servicio | Sí |

#### 5. Asignaciones (`/assignments`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/assignments` | Mis asignaciones | Sí |
| POST | `/assignments` | Crear asignación | Sí |

#### 6. Notificaciones (`/notifications`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/notifications` | Mis notificaciones | Sí |
| GET | `/notifications/debug` | Debug notificaciones | Sí |
| GET | `/notifications/:userId` | Notificaciones por usuario | Sí |
| POST | `/notifications` | Crear notificación | Sí |
| PUT | `/notifications/:id/read` | Marcar como leída | Sí |
| DELETE | `/notifications/:notificationId` | Eliminar notificación | Sí |

#### 7. Reportes (`/reports` y `/reportes`)

**Reportes Generales:**
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/reports` | Listar reportes | Sí |
| GET | `/reports/tickets` | Reporte de tickets | Sí |
| GET | `/reports/summary` | Resumen de reportes | Sí |

**Reportes Específicos:**
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/reportes/gestion-servicios` | Gestión de servicios | Sí |
| GET | `/reportes/mensuales` | Reportes mensuales | Sí |
| GET | `/reportes/mensuales/:id` | Reporte mensual por ID | Sí |

#### 8. Health Check

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Estado del sistema | No |

**Response:**
```json
{
  "status": "OK",
  "database": "Connected",
  "timestamp": "2025-01-07T15:30:00-06:00"
}
```

---

## Seguridad

### Autenticación JWT

**Estructura del Token:**
```json
{
  "user_id": 1,
  "email": "usuario@ejemplo.com",
  "rol": "Usuario",
  "iat": 1704652200,
  "exp": 1704738600
}
```

**Algoritmo**: HS256  
**Duración**: 24 horas  
**Secreto**: Configurado en `JWT_SECRET` (variable de entorno)

### Validación de Entrada
- Sanitización de datos de entrada
- Validación de tipos de datos
- Protección contra SQL Injection (PDO Prepared Statements)
- Protección contra XSS (sanitización de salida)

### CORS
Configurado mediante variable de entorno `CORS_ORIGIN`:
```php
Access-Control-Allow-Origin: <CORS_ORIGIN>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Roles y Permisos

| Rol | Permisos |
|-----|----------|
| Administrador | Acceso completo al sistema |
| Técnico | Gestión de tickets asignados, asignación de tickets |
| Usuario | Crear tickets, ver sus propios tickets, evaluar |

---

## Servicios Externos

### SendGrid (Recomendado)

**Propósito**: Envío de correos electrónicos  
**API Version**: v3  
**Endpoint**: `https://api.sendgrid.com/v3/mail/send`  
**Autenticación**: API Key (Bearer Token)  
**Variable de Entorno**: `SENDGRID_API_KEY`

**Configuración Requerida:**
1. Crear cuenta en SendGrid
2. Verificar dominio remitente
3. Generar API Key con permisos de envío
4. Configurar `SENDGRID_API_KEY` en `.env`

### SMTP (Alternativa)

**Propósito**: Envío de correos (alternativa a SendGrid)  
**Puertos**: 587 (TLS) o 465 (SSL)  
**Variables de Entorno**:
- `SMTP_HOST`: Servidor SMTP
- `SMTP_PORT`: Puerto (587 o 465)
- `SMTP_USER`: Usuario SMTP
- `SMTP_PASS`: Contraseña
- `SMTP_FROM`: Remitente

**Ejemplo para Gmail:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=contraseña_de_aplicacion
SMTP_FROM="Mesa de Ayuda <tu_email@gmail.com>"
```

**Nota**: Para Gmail, se requiere usar una "Contraseña de Aplicación" en lugar de la contraseña normal.

---

## Flujos de Trabajo Principales

### 1. Flujo de Creación de Ticket

```
Usuario → Crear Ticket → Validación → Guardar en BD
    ↓
Crear Notificación Interna
    ↓
Asignar Automáticamente (si aplica)
    ↓
Enviar Correo al Técnico Asignado
    ↓
Enviar Correo de Confirmación al Usuario
```

### 2. Flujo de Asignación

```
Administrador/Técnico → Seleccionar Ticket → Seleccionar Técnico
    ↓
Crear Asignación en BD
    ↓
Actualizar Estado del Ticket
    ↓
Enviar Notificación al Técnico
    ↓
Enviar Correo al Técnico
```

### 3. Flujo de Cierre de Ticket

```
Técnico → Completar Trabajo → Cerrar Ticket
    ↓
Actualizar Estado a "Cerrado"
    ↓
Registrar Fecha de Cierre
    ↓
Enviar Notificación al Usuario
    ↓
Enviar Correo al Usuario
    ↓
Solicitar Evaluación (Automático después de 5 minutos)
```

### 4. Flujo de Evaluación

```
Usuario → Recibir Solicitud de Evaluación → Evaluar Ticket
    ↓
Calificación 1-5 Estrellas + Comentario
    ↓
Guardar Evaluación en BD
    ↓
Enviar Notificación al Técnico
    ↓
Actualizar Estadísticas
```

### 5. Flujo de Escalamiento

```
Técnico/Usuario → Escalar Ticket → Seleccionar Nivel y Motivo
    ↓
Crear Registro de Escalamiento
    ↓
Asignar a Técnico de Nivel Superior
    ↓
Enviar Notificaciones
    ↓
Enviar Correos
```

---

## Códigos de Estado HTTP

| Código | Descripción | Uso |
|--------|-------------|-----|
| 200 | OK | Operación exitosa |
| 201 | Created | Recurso creado exitosamente |
| 400 | Bad Request | Error en los datos enviados |
| 401 | Unauthorized | No autenticado o token inválido |
| 403 | Forbidden | Sin permisos para la operación |
| 404 | Not Found | Recurso no encontrado |
| 422 | Unprocessable Entity | Error de validación |
| 500 | Internal Server Error | Error del servidor |

---

## Manejo de Errores

### Formato de Error Estándar
```json
{
  "error": "Descripción del error",
  "message": "Mensaje detallado",
  "code": 400
}
```

### Logs de Error
Los errores se registran en:
- **Backend**: `backend/error.log`
- **PHP Error Log**: Configurado en `php.ini`

---

## Variables de Entorno

Ver documentación completa en `backend/env.example` o `backend/.env.example`

**Variables Requeridas:**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `SENDGRID_API_KEY` (o configuración SMTP completa)
- `CORS_ORIGIN`

**Variables Opcionales:**
- `DISPLAY_ERRORS` (default: 0)
- `ENVIRONMENT` (default: development)
- `TIMEZONE` (default: America/Mexico_City)

---

## Mejores Prácticas de Desarrollo

### Backend
1. Usar PDO Prepared Statements siempre
2. Validar y sanitizar toda entrada del usuario
3. Usar variables de entorno para configuración sensible
4. Implementar logging apropiado
5. Manejar excepciones correctamente

### Frontend
1. Validar formularios antes de enviar
2. Manejar estados de carga y error
3. Usar interceptors para autenticación
4. Implementar guards para protección de rutas
5. Optimizar peticiones HTTP

---

**Última Actualización**: Enero 2025  
**Versión del Documento**: 1.0.0

