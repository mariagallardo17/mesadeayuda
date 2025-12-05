# Mesa de Ayuda - Backend PHP

This is the PHP backend for the Mesa de Ayuda (Help Desk) system, migrated from Node.js/Express.

> **Migration Branch:** ld1-1002-migrate-missing-endpoints-to-php

## Requirements

- PHP >= 8.0
- MySQL >= 5.7
- Composer
- Apache or Nginx web server (with mod_rewrite enabled)

## Installation

1. Install PHP dependencies:
```bash
cd backend
composer install
```

2. Copy the `.env.example` file to `.env` and configure your database credentials:
```bash
cp .env.example .env
```

3. Configure your `.env` file with the following variables:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mesadeayuda

JWT_SECRET=your_jwt_secret_key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

CORS_ORIGIN=http://localhost:4200
FRONTEND_URL=http://localhost:4200
```

4. Set up the database using the SQL file in `database/mesadeayuda.sql`:
```bash
mysql -u root -p < database/mesadeayuda.sql
```

## Running the Application

### Using PHP Built-in Server (Development)

```bash
cd backend
php -S localhost:3000 index.php
```

The API will be available at `http://localhost:3000/api`

### Using Apache

1. Configure Apache to serve the backend directory
2. Ensure `.htaccess` is enabled (mod_rewrite)
3. Point your VirtualHost document root to the `backend` directory

### Using Nginx

Configure Nginx with the following server block:

```nginx
server {
    listen 3000;
    server_name localhost;
    root /path/to/backend;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.0-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/change-temporary-password` - Change temporary password
- `POST /api/auth/forgot-password` - Request password reset
- `GET /api/auth/profile` - Get user profile

### Users
- `GET /api/users` - List all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user (admin only)

### Tickets
- `GET /api/tickets/my-tickets` - Get user's tickets
- `GET /api/tickets/check-pending-evaluation` - Check for pending evaluations
- `GET /api/tickets/:id` - Get ticket by ID
- `POST /api/tickets` - Create new ticket
- `PUT /api/tickets/:id/status` - Update ticket status
- `POST /api/tickets/:id/close` - Close and evaluate ticket
- `POST /api/tickets/:id/evaluate` - Evaluate ticket

### Services
- `GET /api/services` - List all active services
- `GET /api/services/:id` - Get service by ID
- `POST /api/services` - Create service (admin only)
- `PUT /api/services/:id` - Update service (admin only)
- `DELETE /api/services/:id` - Deactivate service (admin only)

### Reports
- `GET /api/reports` - Get reports
- `GET /api/reports/tickets` - Get ticket reports

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

### Assignments
- `GET /api/assignments` - Get user assignments
- `POST /api/assignments` - Create assignment

### Health Check
- `GET /api/health` - Check API and database status

## Project Structure

```
backend/
├── index.php                 # Main entry point
├── .htaccess                 # Apache rewrite rules
├── composer.json             # PHP dependencies
├── src/
│   ├── Config/
│   │   └── Database.php      # Database connection
│   ├── Middleware/
│   │   └── AuthMiddleware.php # JWT authentication
│   ├── Routes/
│   │   ├── AuthRoutes.php    # Authentication endpoints
│   │   ├── UserRoutes.php    # User management endpoints
│   │   ├── TicketRoutes.php  # Ticket management endpoints
│   │   ├── ServiceRoutes.php # Service catalog endpoints
│   │   ├── ReportRoutes.php  # Reporting endpoints
│   │   ├── NotificationRoutes.php # Notification endpoints
│   │   └── AssignmentRoutes.php # Assignment endpoints
│   ├── Services/
│   │   └── EmailService.php  # Email sending service
│   └── Router.php            # Request router
└── vendor/                   # Composer dependencies (git-ignored)
```

## Security

- Passwords are hashed using PHP's `password_hash()` with bcrypt
- JWT tokens are used for authentication
- All API endpoints (except login and forgot-password) require authentication
- SQL injection protection via PDO prepared statements
- CORS configuration for frontend integration

## Differences from Node.js Version

The PHP implementation maintains the same API contract as the Node.js version but with the following changes:

1. **Dependency Management**: Uses Composer instead of npm
2. **Server**: Can run on Apache, Nginx, or PHP built-in server
3. **Database**: Uses PDO instead of mysql2
4. **Email**: Uses PHPMailer instead of nodemailer
5. **JWT**: Uses firebase/php-jwt instead of jsonwebtoken
6. **Routing**: Custom PHP router instead of Express
7. **Password Hashing**: Native PHP password functions instead of bcrypt package

## Development

To check for syntax errors:
```bash
find . -name "*.php" -not -path "./vendor/*" -exec php -l {} \;
```

To run in development mode with error display:
```bash
php -S localhost:3000 -d display_errors=1 -d error_reporting=E_ALL index.php
```

## Testing

Test the health endpoint:
```bash
curl http://localhost:3000/api/health
```

Test authentication:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"user@example.com","password":"yourpassword"}'
```

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running
- Check database credentials in `.env`
- Ensure the database exists and has the correct schema

### 404 Errors
- Verify `.htaccess` is enabled (Apache)
- Check web server configuration
- Ensure mod_rewrite is enabled

### Permission Issues
- Ensure `uploads/` directory exists and is writable
- Check file permissions: `chmod -R 755 backend/`

## License

MIT
