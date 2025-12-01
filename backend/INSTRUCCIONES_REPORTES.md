# 📊 Instrucciones para el Módulo de Reportes Mensuales

## 📋 Descripción

Este módulo proporciona un sistema completo de reportes de gestión de servicios que incluye todos los KPIs solicitados y generación automática de reportes mensuales.

## 🚀 Instalación

### 1. Instalar dependencias

```bash
cd backend
npm install
```

Esto instalará automáticamente `node-cron` que es necesario para el scheduler mensual.

### 2. Crear la tabla en la base de datos

Ejecuta el siguiente script SQL en tu base de datos MySQL:

```bash
mysql -u tu_usuario -p mesadeayuda < database/create-reportes-mensuales.sql
```

O ejecuta manualmente el contenido del archivo `backend/database/create-reportes-mensuales.sql` en tu cliente MySQL.

## 📁 Estructura de Archivos Creados

```
backend/
├── controllers/
│   └── reportesController.js          # Controlador con toda la lógica de KPIs
├── routes/
│   └── reportes.js                    # Nueva ruta para reportes de gestión
├── services/
│   └── reportesMensualesScheduler.js # Scheduler para reportes automáticos
├── database/
│   └── create-reportes-mensuales.sql  # Script SQL para crear la tabla
└── server.js                          # Actualizado con nueva ruta y scheduler
```

## 🔌 Endpoints Disponibles

### GET `/api/reportes/gestion-servicios`

Obtiene todos los KPIs de reportes de gestión de servicios.

**Query Parameters:**
- `fechaInicio` (opcional): Fecha de inicio en formato `YYYY-MM-DD` o `DD/MM/YYYY`
- `fechaFin` (opcional): Fecha de fin en formato `YYYY-MM-DD` o `DD/MM/YYYY`

**Ejemplo de uso:**
```bash
GET /api/reportes/gestion-servicios?fechaInicio=2024-01-01&fechaFin=2024-01-31
```

**Respuesta JSON incluye:**
- `ticketsSolicitados`: Total de tickets creados
- `ticketsAtendidos`: Tickets con técnico asignado y en progreso/finalizado/cerrado
- `ticketsCerradosPorSistema`: Tickets cerrados automáticamente
- `ticketsAsignados`: Tickets con técnico asignado
- `ticketsPendientes`: Tickets en estado Abierto/En Progreso/Pendiente
- `ticketsSinCerrar`: Tickets finalizados sin fecha de cierre
- `ticketsEscalados`: Tickets que han sido escalados
- `ticketsTardios`: Tickets cerrados fuera del tiempo objetivo
- `ticketsReabiertos`: Tickets que han sido reabiertos
- `evaluacionesTardias`: Tickets finalizados sin evaluación después de 2 días
- `satisfaccionPromedio`: Promedio de calificaciones (1-5)
- `mttr`: Objeto con `horas`, `minutos` y `totalMinutos` (Mean Time To Resolution)
- `mtta`: Objeto con `minutos` (Mean Time To Acknowledge)
- `cumplimientoSLA`: Porcentaje de tickets resueltos dentro del tiempo objetivo
- `actualizacionesEstado`: Objeto con `total` y `porcentaje` de tickets con actualizaciones
- `ticketsPorSemana`: Array con 4 valores (tickets por semana)
- `rendimientoPorTecnico`: Array con métricas por cada técnico
- `histogramaEvaluaciones`: Objeto con distribución de calificaciones (1-5)
- `resumenEjecutivo`: Objeto con `fortalezas` y `areasMejora`

### GET `/api/reportes/mensuales`

Obtiene los reportes mensuales guardados.

**Query Parameters:**
- `limit` (opcional, default: 50): Número de reportes a obtener
- `offset` (opcional, default: 0): Desplazamiento para paginación

### GET `/api/reportes/mensuales/:id`

Obtiene un reporte mensual específico por ID.

## ⏰ Scheduler Automático

El sistema genera automáticamente un reporte mensual el **día 1 de cada mes a las 00:00** (hora de México).

El scheduler:
- Se inicia automáticamente cuando el servidor arranca
- Genera un reporte para el mes anterior
- Guarda el reporte en la tabla `reportesmensuales`
- No requiere intervención manual

## 🧪 Cómo Probar

### 1. Probar el endpoint de reportes

```bash
# Con fechas específicas
curl -X GET "http://localhost:3000/api/reportes/gestion-servicios?fechaInicio=2024-01-01&fechaFin=2024-01-31" \
  -H "Authorization: Bearer TU_TOKEN_JWT"

# Sin fechas (todos los tickets)
curl -X GET "http://localhost:3000/api/reportes/gestion-servicios" \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

### 2. Probar el scheduler manualmente

Puedes probar la generación de reportes mensuales manualmente usando Node.js:

```javascript
const { generarReporteMensualManual } = require('./services/reportesMensualesScheduler');

// Generar reporte para un período específico
generarReporteMensualManual('2024-01-01', '2024-01-31', null)
  .then(result => {
    console.log('Reporte generado:', result);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### 3. Verificar que la tabla existe

```sql
SELECT * FROM reportesmensuales ORDER BY fecha_generacion DESC LIMIT 10;
```

## 📊 KPIs Implementados

Todos los KPIs solicitados están implementados:

✅ Tickets solicitados  
✅ Tickets atendidos  
✅ Tickets cerrados por el sistema  
✅ Tickets asignados  
✅ Tickets pendientes  
✅ Tickets sin cerrar  
✅ Tickets escalados  
✅ Tickets tardíos  
✅ Tickets reabiertos  
✅ Evaluaciones tardías  
✅ Satisfacción promedio  
✅ MTTR (Mean Time To Resolution)  
✅ MTTA (Mean Time To Acknowledge)  
✅ Cumplimiento de SLA  
✅ Actualizaciones de estado  
✅ Tickets por semana  
✅ Rendimiento por técnico  
✅ Histograma de evaluaciones  
✅ Resumen ejecutivo (con fortalezas y áreas de mejora)  

## 🔧 Configuración

### Zona horaria del scheduler

Si necesitas cambiar la zona horaria del scheduler, edita el archivo `backend/services/reportesMensualesScheduler.js`:

```javascript
timezone: "America/Mexico_City" // Cambia según tu zona horaria
```

### Horario de ejecución

Para cambiar el horario de ejecución del scheduler, modifica la expresión cron en `reportesMensualesScheduler.js`:

```javascript
// Actual: día 1 de cada mes a las 00:00
cron.schedule('0 0 1 * *', ...)

// Ejemplo: día 1 de cada mes a las 02:00
cron.schedule('0 2 1 * *', ...)
```

## 📝 Notas Importantes

1. **Autenticación requerida**: Todos los endpoints requieren autenticación JWT y rol de administrador.

2. **Formato de fechas**: El sistema acepta fechas en formato `YYYY-MM-DD` o `DD/MM/YYYY` y las normaliza automáticamente.

3. **Tiempo objetivo**: El sistema maneja correctamente formatos de tiempo objetivo como:
   - `"00:45:00"` (horas:minutos:segundos)
   - `"30 días"` (días)

4. **Tabla automática**: La tabla `reportesmensuales` se crea automáticamente si no existe cuando se intenta guardar un reporte.

5. **Compatibilidad**: El módulo es compatible con la estructura existente y no modifica otros módulos.

## 🐛 Solución de Problemas

### Error: "Tabla reportesmensuales no existe"
- Ejecuta el script SQL: `database/create-reportes-mensuales.sql`
- O la tabla se creará automáticamente al intentar guardar un reporte

### Error: "Cannot find module 'node-cron'"
- Ejecuta: `npm install node-cron`

### El scheduler no se ejecuta
- Verifica que el servidor esté corriendo el día 1 del mes
- Revisa los logs del servidor para ver mensajes del scheduler
- Verifica la zona horaria configurada

## 📞 Soporte

Si encuentras algún problema, revisa los logs del servidor para más detalles. Todos los errores se registran en la consola con prefijos como:
- ✅ Éxito
- ⚠️ Advertencia
- ❌ Error
- 📊 Información de reportes

