# 🔍 Cómo Verificar las Notificaciones SIN Acceso a la Base de Datos

## Método 1: Usar el Endpoint de Diagnóstico (Más Fácil)

### Paso 1: Abre tu aplicación en el navegador

### Paso 2: Abre la Consola del Navegador (F12)

### Paso 3: Ve a la pestaña "Console" (Consola)

### Paso 4: Ejecuta este comando en la consola:

```javascript
fetch('/api/notifications/debug', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('🔍 DIAGNÓSTICO DE NOTIFICACIONES:');
  console.log('=====================================');
  console.log('✅ Usuario ID:', data.usuario_id);
  console.log('✅ Usuario:', data.usuario_nombre);
  console.log('✅ Tabla encontrada:', data.tabla_encontrada ? 'SÍ' : 'NO');
  if (data.tabla_encontrada) {
    console.log('✅ Nombre de tabla:', data.tabla_nombre);
    console.log('✅ Total de notificaciones:', data.total_notificaciones);
    console.log('✅ No leídas:', data.notificaciones_no_leidas);
    console.log('✅ Últimas 5 notificaciones:');
    console.table(data.ultimas_5_notificaciones);
  }
  if (data.errores && data.errores.length > 0) {
    console.error('❌ Errores encontrados:');
    data.errores.forEach(err => console.error('  -', err));
  }
  console.log('=====================================');
})
.catch(err => console.error('❌ Error:', err));
```

**Esto te mostrará:**
- ✅ Si se encuentra la tabla de notificaciones
- ✅ Cuántas notificaciones tienes en total
- ✅ Cuántas no has leído
- ✅ Las últimas 5 notificaciones

**Si `total_notificaciones` es 0 → El problema está en el BACKEND (no se están creando)**
**Si `total_notificaciones` > 0 → El problema está en el FRONTEND (no se están mostrando)**

---

## Método 2: Verificar el Endpoint Normal en Network

### Paso 1: Abre tu aplicación en el navegador

### Paso 2: Abre las Herramientas de Desarrollador (F12)

### Paso 3: Ve a la pestaña "Network" (Red)

### Paso 4: Filtra por "notifications"

### Paso 5: Espera unos segundos (el frontend hace polling cada 5 segundos)

### Paso 6: Busca la petición GET a `/api/notifications`

### Paso 7: Haz clic en ella

### Paso 8: Ve a la pestaña "Response" (Respuesta)

**Interpretación:**
- Si ves `[]` (array vacío) → Puede ser normal si no tienes notificaciones, pero verifica con el Método 1
- Si ves un array con objetos → El backend funciona, el problema está en el frontend
- Si ves un error → El problema está en el backend

---

## Método 3: Verificar en la Consola del Navegador

### Paso 1: Abre tu aplicación en el navegador

### Paso 2: Presiona F12

### Paso 3: Ve a la pestaña "Console"

### Paso 4: Busca mensajes que empiecen con:

- `📧 [NOTIFICACIONES]` - Logs del servicio de notificaciones
- `✅ [NOTIFICACIONES]` - Notificaciones recibidas correctamente
- `❌ [NOTIFICACIONES]` - Errores

**Ejemplo de lo que deberías ver:**
```
📧 [NOTIFICACIONES] Solicitando notificaciones desde: http://tu-servidor/api/notifications
✅ [NOTIFICACIONES] Respuesta del backend: Array(3)
📊 [NOTIFICACIONES] Se recibieron 3 notificaciones
✅ [NOTIFICACIONES] Actualizando subject con 3 notificaciones
```

**Si ves errores HTTP (401, 500, etc.) → Problema del BACKEND**
**Si ves que recibe datos pero no aparecen en pantalla → Problema del FRONTEND**

---

## Método 4: Crear un Ticket y Verificar

### Paso 1: Abre la Consola del Navegador (F12)

### Paso 2: Ve a la pestaña "Console"

### Paso 3: Crea un ticket nuevo

### Paso 4: Busca en la consola mensajes como:

```
✅ [NOTIFICACIONES] Notificación creación empleado (ID: X) OK
```

**Si NO ves estos mensajes → El problema está en el BACKEND (no se está llamando la función de crear notificaciones)**

---

## Resumen Rápido

**Usa el Método 1 (Endpoint de Diagnóstico) - Es el más rápido y completo**

Simplemente ejecuta este código en la consola del navegador:

```javascript
fetch('/api/notifications/debug', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

Esto te dará toda la información que necesitas para saber si el problema es del backend o frontend.

