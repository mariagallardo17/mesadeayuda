# Backend - Mesa de Ayuda

## Configuración

### 1. Variables de Entorno

Copia el archivo de ejemplo y configura las variables:

```bash
cp backend/config.env.example backend/.env
```

Edita el archivo `.env` con tus configuraciones:

```env
# Base de datos MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password_mysql
DB_NAME=mesadeayuda

# Servidor
PORT=3000
NODE_ENV=development

# JWT Secret (cambiar en producción)
JWT_SECRET=tu_clave_secreta_muy_segura

# CORS
CORS_ORIGIN=http://localhost:4200
```

### 2. Base de Datos

Asegúrate de que MySQL esté ejecutándose y que la base de datos `mesadeayuda` esté creada con las tablas definidas.

### 3. Inicializar Usuarios

Ejecuta el script para crear los usuarios iniciales:

```bash
npm run init-db
```

Esto creará los siguientes usuarios:

- **Carmen Gallardo** (Administrador)
  - Email: cj106558@gmail.com
  - Password: admin12

- **Franco Jaime** (Usuario)
  - Email: franco0241016@gmail.com
  - Password: usuario12

- **Agustín Gallardo** (Técnico)
  - Email: gallardoagustin088@gmail.com
  - Password: tecnico12

### 4. Iniciar el Servidor

#### Desarrollo (con auto-reload):
```bash
npm run server:dev
```

#### Producción:
```bash
npm run server
```

El servidor se ejecutará en `http://localhost:3000`

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/verify` - Verificar token
- `POST /api/auth/change-password` - Cambiar contraseña

### Usuarios
- `GET /api/users` - Obtener todos los usuarios (Admin)
- `GET /api/users/:id` - Obtener usuario por ID
- `POST /api/users` - Crear usuario (Admin)
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario (Admin)

### Tickets
- `GET /api/tickets` - Obtener tickets
- `GET /api/tickets/:id` - Obtener ticket por ID
- `POST /api/tickets` - Crear ticket
- `PUT /api/tickets/:id` - Actualizar ticket

### Servicios
- `GET /api/services` - Obtener servicios
- `GET /api/services/:id` - Obtener servicio por ID
- `POST /api/services` - Crear servicio (Admin)
- `PUT /api/services/:id` - Actualizar servicio (Admin)
- `DELETE /api/services/:id` - Eliminar servicio (Admin)

### Health Check
- `GET /api/health` - Estado del servidor y base de datos

## Estructura de la Base de Datos

### Tablas:
- `Usuarios` - Información de usuarios
- `Servicios` - Catálogo de servicios
- `Tickets` - Tickets de soporte
- `Historial_Tickets` - Historial de cambios
- `Evaluaciones` - Evaluaciones de tickets
- `Notificaciones` - Notificaciones del sistema

## Seguridad

- Contraseñas encriptadas con bcrypt
- Tokens JWT para autenticación
- Validación de roles en endpoints
- CORS configurado
- Validación de entrada en todos los endpoints
