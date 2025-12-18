# Guía para Verificar Notificaciones

## Cómo verificar si el problema es del Backend o Frontend

### Paso 1: Verificar que las notificaciones se están creando en la BD

**Ejecuta este comando en la terminal (desde la carpeta backend):**
```bash
php test-notificaciones-creacion.php
```

Este script verificará:
- ✅ Si la tabla `notificaciones` existe
- ✅ Si se pueden crear notificaciones
- ✅ Si se pueden leer notificaciones

**Si este script falla → El problema está en el BACKEND (tabla o permisos)**

### Paso 2: Verificar las notificaciones directamente en la BD

Conéctate a tu base de datos y ejecuta:
```sql
-- Ver todas las notificaciones recientes
SELECT id_notificacion, id_usuario, id_ticket, mensaje, fecha_envio, leida 
FROM notificaciones 
ORDER BY fecha_envio DESC 
LIMIT 20;

-- Contar notificaciones por usuario (reemplaza 6 con tu ID de usuario)
SELECT COUNT(*) as total 
FROM notificaciones 
WHERE id_usuario = 6;

-- Ver tus notificaciones específicas (reemplaza 6 con tu ID de usuario)
SELECT id_notificacion, id_ticket, mensaje, fecha_envio, leida 
FROM notificaciones 
WHERE id_usuario = 6 
ORDER BY fecha_envio DESC;
```

**Si no hay notificaciones en la BD → El problema está en el BACKEND (no se están creando)**

### Paso 3: Verificar el endpoint del backend

**Abre la consola del navegador (F12) y revisa:**

1. Ve a la pestaña **Network** (Red)
2. Filtra por "notifications"
3. Busca la petición GET a `/api/notifications`
4. Haz clic en ella y revisa:
   - **Status Code**: Debe ser 200
   - **Response**: Debe ser un array JSON con notificaciones

**Si el Status Code es diferente de 200 → Problema del BACKEND**
**Si el Response está vacío [] pero hay notificaciones en la BD → Problema en la consulta del BACKEND**
**Si el Response tiene datos pero no aparecen en pantalla → Problema del FRONTEND**

### Paso 4: Verificar los logs del backend

En los logs del servidor (error_log de PHP), busca líneas que contengan:
- `✅ [NOTIFICACIONES]` - Notificaciones creadas exitosamente
- `❌ [NOTIFICACIONES]` - Errores al crear notificaciones
- `📧 Obteniendo notificaciones` - Consultas de notificaciones

**Si ves errores en los logs → El problema está en el BACKEND**

### Paso 5: Verificar la consola del navegador (Frontend)

Abre la consola del navegador (F12) y busca mensajes que empiecen con:
- `📧 [NOTIFICACIONES]` - Logs del servicio de notificaciones
- `✅ [NOTIFICACIONES]` - Notificaciones recibidas correctamente
- `❌ [NOTIFICACIONES]` - Errores al obtener notificaciones

**Si ves errores en la consola → El problema puede estar en el FRONTEND**

## Resumen de Verificación

| Síntoma | Problema Probable | Solución |
|---------|------------------|----------|
| No hay notificaciones en la BD | BACKEND - No se están creando | Revisar logs, verificar `crearNotificacionInterna` |
| Hay notificaciones en BD pero no llegan al frontend | BACKEND - Endpoint no funciona | Revisar `NotificationRoutes::getNotifications` |
| El endpoint devuelve datos pero no se muestran | FRONTEND - Problema de visualización | Revisar `notification.service.ts` y componente |
| Las notificaciones aparecen pero en otro dispositivo no | FRONTEND - Problema de sincronización | El polling cada 5 seg debería solucionarlo |

## Solución Rápida

Si después de crear un ticket:
1. Ve directamente a la BD y verifica si se creó una notificación para tu usuario
2. Si SÍ existe en la BD → El problema es el FRONTEND
3. Si NO existe en la BD → El problema es el BACKEND (no se está llamando `crearNotificacionInterna`)

