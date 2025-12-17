# 🌍 Configuración de Zona Horaria en SendGrid

## ⚠️ Problema Detectado

SendGrid solo está mostrando opciones de zona horaria de **Asia-Pacífico** (UTC+09:00 en adelante), pero para **México necesitas UTC-6:00**.

## ✅ Soluciones

### **Opción 1: Buscar en la lista completa (RECOMENDADO)**

1. En el selector de zona horaria, **haz clic en la barra de búsqueda** o **escribe "Mexico"** o **"UTC-6"**
2. Busca alguna de estas opciones:
   - `UTC-06:00 - Central Time (US & Canada)`
   - `America/Mexico_City`
   - `Mexico City`
   - `Central Time`
   - `CST` (Central Standard Time)

### **Opción 2: Usar UTC (UTC+00:00) como alternativa**

Si no encuentras la zona horaria de México, puedes usar **UTC+00:00 (Coordinated Universal Time)**:

**Ventajas:**
- ✅ Siempre está disponible
- ✅ No afecta el envío de correos (solo los reportes)
- ✅ Puedes calcular manualmente la diferencia si necesitas ver fechas en hora de México

**Desventajas:**
- ⚠️ Los reportes mostrarán fechas en UTC (6 horas adelante de México)
- ⚠️ Tendrás que restar 6 horas mentalmente para ver la hora de México

### **Opción 3: Cambiar la región de la cuenta**

1. Ve a **Settings** → **Account Details**
2. Busca la opción de **"Region"** o **"Región"**
3. Cambia a **"Americas"** o **"United States"**
4. Esto debería mostrar más opciones de zona horaria de América

### **Opción 4: Contactar soporte de SendGrid**

Si ninguna de las opciones anteriores funciona, contacta a SendGrid:
- Email: support@sendgrid.com
- O desde el panel: **Help** → **Contact Support**

---

## 📋 ¿Qué zona horaria usar si no encuentras México?

### **Recomendación: UTC+00:00 (Coordinated Universal Time)**

**Razón:** La zona horaria en SendGrid **SOLO afecta los reportes y estadísticas**, NO el envío de correos. Los correos se envían inmediatamente cuando tu código PHP los solicita.

**Conversión:**
- **Hora México (UTC-6):** 14:00
- **Hora UTC (UTC+0):** 20:00
- **Diferencia:** +6 horas

---

## 🔧 Configuración en el Servidor PHP (IMPORTANTE)

Aunque la zona horaria de SendGrid no afecta el envío, **SÍ debes configurar la zona horaria en tu servidor PHP** para que las fechas en los correos y en la base de datos sean correctas.

### **Opción 1: En `php.ini`**
```ini
date.timezone = America/Mexico_City
```

### **Opción 2: En tu código PHP (recomendado)**

Agrega esto al inicio de `backend/index.php`:

```php
// Configurar zona horaria de México
date_default_timezone_set('America/Mexico_City');
```

O en `backend/src/Services/EmailService.php` al inicio de la clase:

```php
public function __construct()
{
    // Configurar zona horaria de México
    date_default_timezone_set('America/Mexico_City');
    // ... resto del código
}
```

---

## ✅ Verificación

Para verificar que la zona horaria está configurada correctamente:

1. **En PHP:**
   ```php
   echo date('Y-m-d H:i:s T'); // Debe mostrar hora de México
   ```

2. **En SendGrid:**
   - Ve a **Activity** → Revisa las fechas de los correos enviados
   - Si usas UTC, las fechas estarán 6 horas adelante
   - Si usas México, las fechas coincidirán con la hora local

---

## 📝 Resumen

1. **SendGrid zona horaria:** Usa **UTC+00:00** si no encuentras México (solo afecta reportes)
2. **PHP zona horaria:** Configura **America/Mexico_City** en tu código (afecta fechas en correos y BD)
3. **Envío de correos:** NO se ve afectado por la zona horaria, se envían inmediatamente

---

## 🎯 Pasos Inmediatos

1. **En SendGrid:** Selecciona **UTC+00:00 - Coordinated Universal Time** (si no encuentras México)
2. **En tu código PHP:** Agrega `date_default_timezone_set('America/Mexico_City');` al inicio de `index.php`
3. **Prueba:** Crea un ticket y verifica que la fecha en el correo sea correcta

