# 📋 Cómo Usar el Script de Verificación de Notificaciones

## 🚀 Método 1: Desde el Navegador (Recomendado)

### Paso 1: 
Abre tu navegador y ve a:
```
http://tu-servidor/backend/verificar-notificaciones-tabla.php
```

O si tu backend está en una carpeta diferente:
```
http://tu-servidor/ruta-al-backend/verificar-notificaciones-tabla.php
```

### Paso 2:
El script mostrará:
- ✅ Si la conexión a la BD funciona
- ✅ Si la tabla `notificaciones` existe
- ✅ La estructura completa de la tabla
- ✅ Estadísticas de notificaciones (total, no leídas, etc.)
- ✅ Las últimas 10 notificaciones
- ✅ Lista de usuarios disponibles para hacer pruebas

### Paso 3: Probar Inserción (Opcional)
Haz clic en el botón "Probar" junto a cualquier usuario para crear una notificación de prueba y verificar que la inserción funciona.

---

## 💻 Método 2: Desde Línea de Comandos

### Paso 1:
Abre una terminal en la carpeta `backend`

### Paso 2:
Ejecuta:
```bash
php verificar-notificaciones-tabla.php
```

---

## 🔍 Qué Buscar en los Resultados

### ✅ Todo está bien si ves:
- "✅ Conexión a la base de datos exitosa"
- "✅ Tabla encontrada: notificaciones"
- "✅ Todos los campos requeridos están presentes"
- Estadísticas con números (pueden ser 0 si no hay notificaciones aún)

### ❌ Hay problemas si ves:
- "❌ No se encontró ninguna tabla de notificaciones" → La tabla no existe
- "❌ Faltan campos requeridos" → La tabla existe pero le faltan columnas
- "❌ Error insertando notificación de prueba" → Hay un problema con los permisos o la estructura

---

## 📊 Interpretación de Resultados

### Si la tabla NO existe:
- Necesitas crear la tabla en la base de datos
- El script te mostrará qué campos son necesarios

### Si la tabla existe pero está vacía:
- Esto es normal si no has creado tickets aún
- El problema puede estar en que las notificaciones no se están creando cuando se crean tickets

### Si la tabla tiene notificaciones pero no aparecen en la app:
- El problema está en el FRONTEND o en el endpoint del backend
- Verifica el endpoint `/api/notifications/debug` que creamos anteriormente

---

## 🎯 Próximos Pasos Según el Resultado

1. **Si todo funciona pero no hay notificaciones**: Crea un ticket y verifica si aparece una nueva notificación en este script
2. **Si hay notificaciones pero no se muestran en la app**: El problema es del frontend o del endpoint API
3. **Si hay errores**: Comparte el resultado conmigo para ayudarte a solucionarlo

