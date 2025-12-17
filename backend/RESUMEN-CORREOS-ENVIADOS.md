# 📧 Resumen de Correos Enviados Automáticamente

## ✅ Correos Implementados

### 1. **Cuando se levanta el ticket** ✅
- **Método:** `sendTicketCreatedNotification`
- **Cuándo:** Al crear un nuevo ticket
- **Destinatario:** Empleado que creó el ticket
- **Ubicación:** `TicketRoutes.php` línea ~792
- **Estado:** ✅ Implementado

### 2. **Cuando se asigna un técnico** ✅
- **Método:** `sendTicketAssignedNotification`
- **Cuándo:** Al asignar un técnico al ticket (automático o manual)
- **Destinatarios:** 
  - Técnico asignado
  - Empleado (notificación de asignación)
- **Ubicación:** `TicketRoutes.php` línea ~835
- **Estado:** ✅ Implementado

### 3. **Cuando cambia de estado** ✅
- **Método:** `sendTicketStatusChangeNotification`
- **Cuándo:** Cuando el estado del ticket cambia (Pendiente → En Progreso, En Progreso → Finalizado, etc.)
- **Destinatario:** Empleado
- **Ubicación:** `TicketRoutes.php` línea ~1238
- **Estado:** ✅ Implementado

### 4. **Cuando se evalúa y cierra** ✅
- **Método:** `sendTicketClosedNotification`
- **Cuándo:** Al cerrar un ticket (con evaluación)
- **Destinatario:** Empleado
- **Ubicación:** `TicketRoutes.php` línea ~1353
- **Estado:** ✅ Implementado

### 5. **Recordatorios para evaluar** ✅
- **Método:** `sendEvaluationReminderEmail` y `sendDailyEvaluationReminderEmail`
- **Cuándo:** 
  - Recordatorios específicos después de X días sin evaluar
  - Correos diarios con todos los tickets pendientes de evaluación
- **Destinatario:** Empleado con tickets pendientes de evaluación
- **Ubicación:** `EvaluationScheduler.php` líneas ~138 y ~212
- **Estado:** ✅ Implementado

### 6. **Cierre automático sin evaluación** ✅
- **Método:** `sendEvaluationAutoClosedEmail`
- **Cuándo:** Cuando un ticket se cierra automáticamente por falta de evaluación
- **Destinatario:** Empleado
- **Ubicación:** `EvaluationScheduler.php` línea ~166
- **Estado:** ✅ Implementado

### 7. **Escalamiento de tickets** ✅
- **Método:** `sendTicketEscalatedNotification`
- **Cuándo:** Cuando un ticket es escalado a otro técnico o administrador
- **Destinatarios:** Nuevo técnico, administrador, empleado
- **Ubicación:** `TicketRoutes.php` (método de escalamiento)
- **Estado:** ✅ Implementado

---

## 🌍 Configuración de Zona Horaria en SendGrid

### **Zona Horaria Recomendada para México:**
**UTC-6:00 - Hora estándar del centro de México (CST - Central Standard Time)**

### **¿Por qué UTC-6?**
- México ya no usa horario de verano desde 2022
- La hora estándar de México es UTC-6 durante todo el año
- Esta es la zona horaria de la mayor parte del país (Ciudad de México, Guadalajara, Monterrey, etc.)

### **¿Dónde configurar la zona horaria en SendGrid?**
1. Inicia sesión en SendGrid: https://app.sendgrid.com
2. Ve a **Settings** → **Account Details**
3. Busca el campo **"Time Zone"** o **"Zona Horaria"**
4. Selecciona: **"UTC-06:00 - Central Time (US & Canada) / Mexico City"** o **"America/Mexico_City"**

### **¿Afecta la zona horaria el envío de correos?**
**NO.** La zona horaria en SendGrid solo afecta:
- 📊 Cómo se muestran las fechas en los reportes y estadísticas
- 📈 Los gráficos y métricas de actividad
- 📅 Las fechas en los logs de actividad

**NO afecta:**
- ❌ El momento en que se envían los correos (se envían inmediatamente)
- ❌ La hora que aparece en los correos (eso lo controla el servidor PHP)
- ❌ La programación de tareas (eso lo controla el cron job)

### **Nota Importante:**
Si tu servidor PHP está en México, asegúrate de que también tenga configurada la zona horaria correcta en `php.ini`:
```ini
date.timezone = America/Mexico_City
```

O en tu código PHP (en `index.php` o similar):
```php
date_default_timezone_set('America/Mexico_City');
```

---

## 📋 Verificación de Funcionamiento

Para verificar que todos los correos se están enviando correctamente:

1. **Revisa los logs del servidor:**
   - Busca mensajes que empiecen con `📧` para ver intentos de envío
   - Busca mensajes que empiecen con `✅` para confirmaciones exitosas
   - Busca mensajes que empiecen con `❌` para errores

2. **Revisa SendGrid Activity:**
   - Ve a: https://app.sendgrid.com/activity
   - Verifica que los correos aparezcan como "Delivered" (entregado)

3. **Prueba cada escenario:**
   - Crear un ticket nuevo
   - Cambiar el estado de un ticket
   - Cerrar un ticket con evaluación
   - Esperar a que llegue un recordatorio de evaluación

---

## 🔧 Archivos Clave

- `backend/src/Services/EmailService.php` - Servicio principal de correos
- `backend/src/Routes/TicketRoutes.php` - Lógica de tickets y envío de correos
- `backend/src/Services/EvaluationScheduler.php` - Recordatorios de evaluación
- `backend/run-evaluation-scheduler.php` - Script para cron job de recordatorios

