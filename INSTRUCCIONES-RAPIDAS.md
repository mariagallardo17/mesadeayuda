# 🚀 Instrucciones Rápidas para Verificar Notificaciones

## ⚡ Método Más Rápido (1 minuto)

### 1. Abre tu aplicación en el navegador
### 2. Presiona F12 (abre las herramientas de desarrollador)
### 3. Ve a la pestaña "Console" (Consola)
### 4. Copia y pega este código:

```javascript
fetch('/api/notifications/debug', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('🔍 RESULTADO:');
  console.log('Total de notificaciones:', data.total_notificaciones);
  console.log('Notificaciones no leídas:', data.notificaciones_no_leidas);
  
  if (data.total_notificaciones === 0) {
    console.log('❌ PROBLEMA: No hay notificaciones en la BD');
    console.log('👉 Esto significa que el BACKEND no está creando notificaciones');
  } else {
    console.log('✅ Hay notificaciones en la BD');
    console.log('👉 Si no las ves en pantalla, el problema es del FRONTEND');
  }
  
  console.log('Últimas notificaciones:');
  console.table(data.ultimas_5_notificaciones);
})
.catch(err => console.error('❌ Error:', err));
```

### 5. Presiona Enter

**El resultado te dirá:**
- ✅ **Si `total_notificaciones` es mayor a 0**: Hay notificaciones en la BD → El problema es del FRONTEND
- ❌ **Si `total_notificaciones` es 0**: No hay notificaciones → El problema es del BACKEND

---

## 📋 Qué Hacer Según el Resultado

### Si el problema es del BACKEND (total = 0):
- Las notificaciones no se están creando
- Revisa los logs del servidor para ver errores
- Verifica que el código de creación de notificaciones se esté ejecutando

### Si el problema es del FRONTEND (total > 0 pero no aparecen):
- Las notificaciones existen pero no se muestran
- Revisa la consola del navegador para errores JavaScript
- Verifica que el servicio de notificaciones esté funcionando

