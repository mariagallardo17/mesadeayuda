# 📤 Guía para Subir Cambios a Git

## 🚀 Comandos Rápidos (Ejecutar en Git Bash)

### 1. Ver qué archivos se modificaron
```bash
git status
```

### 2. Agregar todos los archivos modificados
```bash
git add .
```

### 3. Hacer commit con un mensaje descriptivo
```bash
git commit -m "Corregir sistema de notificaciones y configurar SMTP para correos

- Corregir eliminación de notificaciones (ya no reaparecen)
- Validar que notificaciones lleguen solo a usuarios correctos
- Implementar SMTP con PHPMailer como método principal de envío de correos
- Mejorar logging de correos para diagnóstico
- Agregar validación de roles para notificaciones de asignación
- Corregir error 500 en getMyTickets
- Mejorar manejo de errores en notificaciones y correos"
```

### 4. Subir cambios al repositorio remoto
```bash
# Si tu rama se llama 'main'
git push origin main

# Si tu rama se llama 'master'
git push origin master
```

---

## 📋 Archivos Modificados (Para referencia)

### Backend (PHP):
- `backend/src/Services/EmailService.php` - Implementación SMTP con PHPMailer
- `backend/src/Routes/TicketRoutes.php` - Correcciones de errores y mejoras
- `backend/src/Routes/NotificationRoutes.php` - Validación de notificaciones
- `backend/env.example` - Actualizado con SMTP como opción principal
- `backend/diagnostico-correos-final.php` - Script de diagnóstico (NUEVO)

### Backend (Express/Node.js):
- `backend/_resources/_express/services/emailService.js` - Mejoras de logging
- `backend/_resources/_express/routes/notifications.js` - Validación de seguridad

### Frontend (Angular):
- `frontend/src/app/services/notification.service.ts` - Corrección de eliminación

### Scripts y Documentación:
- `backend/crear-env.ps1` - Script para crear .env (NUEVO)
- `backend/crear-env.sh` - Script para crear .env Linux/Mac (NUEVO)
- `SUBIR-CAMBIOS-GIT.md` - Esta guía (NUEVO)

---

## ⚠️ IMPORTANTE: Archivo .env NO se sube

El archivo `.env` está en `.gitignore` y **NO debe subirse a Git** por seguridad.
Debes crearlo manualmente en el servidor con tus credenciales reales.

---

## 🔧 Si hay problemas

### Error: "no se encontró el repositorio Git"
```bash
# Inicializar repositorio (solo si no existe)
git init

# Agregar remoto (solo si no existe)
git remote add origin https://github.com/tu-usuario/tu-repositorio.git
```

### Error: "Your branch is ahead"
```bash
# Primero traer cambios remotos
git pull origin main --rebase

# Luego subir
git push origin main
```

### Error: "Authentication failed"
```bash
# Configurar usuario Git
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Si usas HTTPS, necesitarás un Personal Access Token
# Obtén uno desde: https://github.com/settings/tokens
```

---

## ✅ Comandos Completos en una Línea (Para Copiar y Pegar)

```bash
git status && git add . && git commit -m "Corregir sistema de notificaciones y configurar SMTP" && git push origin main
```

---

## 📝 Nota sobre el archivo .env

**NO subir a Git:**
- `backend/.env` (contiene credenciales sensibles)

**SÍ subir a Git:**
- `backend/env.example` (plantilla sin credenciales)
- Todos los demás archivos modificados
