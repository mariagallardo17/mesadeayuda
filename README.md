# Sistema de Mesa de Ayuda - Documentación Completa

##  Descripción del Proyecto

Sistema web completo para la gestión de tickets service desk, desarrollado como parte del Proyecto de Residencias Profesionales. El sistema permite a usuarios crear, asignar, gestionar y evaluar tickets de soporte técnico, con funcionalidades avanzadas de notificaciones, reportes y escalamiento.

## Arquitectura del Sistema

El sistema está compuesto por dos aplicaciones principales:

- **Frontend**: Aplicación Angular 20.3.0
- **Backend**: API REST desarrollada en PHP 8.0+
- **Base de Datos**: MySQL 8.0.43

##  Tecnologías Utilizadas

### Frontend
- **Framework**: Angular 20.3.0
- **TypeScript**: 5.9.2
- **Librerías principales**:
  - Chart.js 4.1.1 (gráficas)
  - jsPDF 3.0.3 (generación de PDFs)
  - html2canvas 1.4.1 (capturas de pantalla)
  - Axios 1.12.2 (peticiones HTTP)

### Backend
- **Lenguaje**: PHP 8.0+
- **Framework**: PHP puro con arquitectura MVC personalizada
- **Dependencias principales** (Composer):
  - `vlucas/phpdotenv` ^5.5 (gestión de variables de entorno)
  - `firebase/php-jwt` ^6.8 (autenticación JWT)
  - `phpmailer/phpmailer` ^6.8 (envío de correos - alternativa)

### Base de Datos
- **Motor**: MySQL 8.0.43
- **Charset**: utf8mb4
- **Collation**: utf8mb4_unicode_ci

### Servicios Externos
- **SendGrid**: API para envío de correos electrónicos
- **SMTP**: Alternativa para envío de correos (Gmail, Outlook, etc.)

##  Requisitos del Sistema

### Servidor Backend
- PHP >= 8.0
- Extensión PDO para MySQL
- Extensión OpenSSL (para JWT)
- Extensión cURL (para SendGrid)
- Composer 2.x
- MySQL 8.0+ o MariaDB 10.5+

### Cliente Frontend
- Node.js >= 18.x
- npm >= 9.x o Angular CLI 20.3.0
- Navegador moderno (Chrome, Firefox, Edge, Safari)

##  Estructura del Proyecto

```
mesadeayuda-main/
├── backend/                    # Aplicación PHP Backend
│   ├── src/
│   │   ├── Config/            # Configuración de base de datos
│   │   ├── Controllers/       # Controladores
│   │   ├── Middleware/        # Middleware de autenticación
│   │   ├── Routes/            # Definición de rutas API
│   │   ├── Services/          # Servicios (Email, Notificaciones, etc.)
│   │   └── Router.php         # Enrutador principal
│   ├── _resources/            # Recursos adicionales
│   │   ├── database.sql       # Script de creación de BD
│   │   └── _express/          # Scripts Express (no utilizado actualmente)
│   ├── index.php              # Punto de entrada del backend
│   ├── composer.json          # Dependencias PHP
│   └── .env                   # Variables de entorno (crear desde .env.example)
│
├── frontend/                   # Aplicación Angular Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/    # Componentes Angular
│   │   │   ├── services/      # Servicios Angular
│   │   │   ├── guards/        # Guards de autenticación
│   │   │   ├── models/        # Modelos de datos
│   │   │   └── config/        # Configuración de API
│   │   └── assets/            # Recursos estáticos
│   ├── angular.json           # Configuración de Angular
│   └── package.json           # Dependencias Node.js
│
└── docs/                      # Documentación técnica
    ├── MANUAL-TECNICO.md
    ├── MANUAL-INSTALACION.md
    ├── MANUAL-DESPLIEGUE.md
    └── CHECKLIST-ENTREGA.md
```

##  Características Principales

### Módulos del Sistema

1. **Autenticación y Autorización**
   - Login con JWT
   - Roles: Administrador, Técnico, Usuario
   - Cambio de contraseña
   - Recuperación de contraseña

2. **Gestión de Tickets**
   - Creación de tickets
   - Asignación automática y manual
   - Actualización de estado
   - Cierre de tickets
   - Reapertura de tickets
   - Escalamiento de tickets

3. **Evaluación de Servicio**
   - Evaluación post-cierre
   - Calificación 1-5 estrellas
   - Comentarios de evaluación

4. **Notificaciones**
   - Notificaciones internas
   - Correos electrónicos
   - Notificaciones en tiempo real

5. **Reportes**
   - Reportes de tickets
   - Reportes mensuales automáticos
   - Gráficas y estadísticas

6. **Gestión de Usuarios**
   - CRUD completo de usuarios
   - Gestión de roles
   - Perfiles de usuario

7. **Gestión de Servicios**
   - CRUD de servicios
   - Servicios que requieren aprobación
   - Carta de aprobación

##  Documentación Disponible

La documentación completa del sistema está disponible en los siguientes manuales:

1. **[Manual Técnico](docs/MANUAL-TECNICO.md)** - Arquitectura, versiones, tecnologías y detalles técnicos
2. **[Manual de Instalación](docs/MANUAL-INSTALACION.md)** - Guía paso a paso para instalar el sistema
3. **[Manual de Configuración y Despliegue](docs/MANUAL-DESPLIEGUE.md)** - Configuración del entorno y despliegue a producción
4. **[Checklist de Entrega](docs/CHECKLIST-ENTREGA.md)** - Lista de verificación pre-entrega

##  Inicio Rápido

### 1. Clonar o descargar el proyecto

```bash
# Si tienes el código fuente
cd mesadeayuda-main
```

### 2. Configurar Backend

```bash
cd backend
composer install
cp .env.example .env
# Editar .env con tus configuraciones
```

### 3. Configurar Base de Datos

```bash
# Importar el script SQL
mysql -u root -p mesadeayuda < _resources/database.sql
```

### 4. Configurar Frontend

```bash
cd ../frontend
npm install
```

### 5. Ejecutar en Desarrollo

**Backend:**
```bash
cd backend
# Configurar servidor web (Apache/Nginx) para apuntar a backend/index.php
# O usar el servidor integrado de PHP:
php -S localhost:8000 -t .
```

**Frontend:**
```bash
cd frontend
ng serve
# O
npm start
```

El sistema estará disponible en `http://localhost:4200`

##  Seguridad

- Autenticación basada en JWT
- Validación de entrada en todos los endpoints
- Protección CSRF
- Sanitización de datos
- Validación de roles y permisos
- Conexiones HTTPS recomendadas en producción

##  Solución de Problemas

Ver la sección de solución de problemas en el [Manual de Instalación](docs/MANUAL-INSTALACION.md).

##  Soporte

Para reportar problemas o solicitar soporte, contactar al equipo de desarrollo.

##  Licencia

Este proyecto fue desarrollado como parte de las Residencias Profesionales. Todos los derechos reservados.

---

**Versión del Sistema**: 1.0.0  
**Fecha de Última Actualización**: 2024  
**Estado**:  Listo para producción

