# Cambios en el Cálculo de SLA con Tiempo Objetivo

## 📋 Resumen

Se ha actualizado el sistema para calcular correctamente el cumplimiento de SLA basándose en el campo `tiempoObjetivo` de cada servicio. Ahora el sistema:

1. **Calcula automáticamente** si un ticket fue resuelto dentro del tiempo objetivo
2. **Agrega la propiedad `enTiempo`** a todos los tickets
3. **Actualiza todos los KPIs** para usar esta nueva lógica basada en minutos
4. **Incluye métricas de SLA por técnico** en los reportes

## 🔧 Cambios Técnicos

### Backend

#### 1. Nueva Utilidad: `backend/utils/tiempoHelper.js`

Se creó un módulo helper con funciones para:
- Convertir `tiempoObjetivo` a minutos (soporta formatos "HH:MM:SS" y "X días")
- Calcular si un ticket está en tiempo o fuera de tiempo
- Generar expresiones SQL para calcular `enTiempo` en consultas

#### 2. Endpoints de Tickets Actualizados

Los siguientes endpoints ahora incluyen la propiedad `enTiempo`:

- `GET /api/tickets/:id` - Detalle de un ticket
- `GET /api/tickets/my-tickets` - Lista de tickets del usuario
- `POST /api/tickets` - Creación de ticket (siempre será `null` para tickets nuevos)

#### 3. Consultas SQL Actualizadas

**Tickets Tardíos:**
- Ahora compara `TIMESTAMPDIFF(MINUTE, fecha_creacion, fecha_cierre)` con `tiempoObjetivo` convertido a minutos
- Soporta formatos: "HH:MM:SS", "X días", y números directos (asumiendo minutos)

**Cumplimiento de SLA:**
- Calcula el porcentaje de tickets resueltos dentro del tiempo objetivo
- Solo considera tickets con `fecha_cierre` y `tiempoObjetivo` definido

**Rendimiento por Técnico:**
- Agrega métricas:
  - `cumplimientoSLA`: Porcentaje de tickets resueltos en tiempo
  - `ticketsEnTiempo`: Cantidad de tickets resueltos en tiempo
  - `ticketsTardios`: Cantidad de tickets resueltos fuera de tiempo

### Frontend

#### Modelo de Ticket Actualizado

El modelo `Ticket` ahora incluye:

```typescript
enTiempo?: boolean | null;
```

- `true`: Ticket resuelto dentro del tiempo objetivo
- `false`: Ticket resuelto fuera del tiempo objetivo
- `null`: No aplica (ticket sin fecha de cierre o sin tiempoObjetivo)

## 📊 Propiedad `enTiempo`

### Cálculo

La propiedad `enTiempo` se calcula automáticamente comparando:

```
TIMESTAMPDIFF(MINUTE, fecha_creacion, fecha_cierre) <= tiempoObjetivo (en minutos)
```

### Reglas

1. **Si el ticket no tiene `fecha_cierre`**: `enTiempo = null`
2. **Si el servicio no tiene `tiempoObjetivo`**: `enTiempo = null`
3. **Si el tiempo real ≤ tiempo objetivo**: `enTiempo = true`
4. **Si el tiempo real > tiempo objetivo**: `enTiempo = false`

### Formatos de `tiempoObjetivo` Soportados

- **"HH:MM:SS"** (ej: "01:30:00") → Convertido a minutos
- **"X días"** (ej: "30 días") → Convertido a minutos (X * 24 * 60)
- **Número directo** (ej: "90") → Asumido como minutos

## 🎯 KPIs Actualizados

### 1. Tickets Tardíos

Ahora cuenta tickets donde:
- `fecha_cierre IS NOT NULL`
- `estatus IN ('Finalizado', 'Cerrado')`
- `TIMESTAMPDIFF(MINUTE, fecha_creacion, fecha_cierre) > tiempoObjetivo (en minutos)`

### 2. Cumplimiento de SLA

Calcula:
```
(cantidad de tickets en tiempo / cantidad total de tickets con SLA) * 100
```

Solo considera tickets:
- Con `fecha_cierre` definida
- Con `tiempoObjetivo` definido en el servicio
- Con estado 'Finalizado' o 'Cerrado'

### 3. SLA por Técnico

Cada técnico ahora tiene:
- `cumplimientoSLA`: Porcentaje de cumplimiento
- `ticketsEnTiempo`: Cantidad de tickets resueltos en tiempo
- `ticketsTardios`: Cantidad de tickets resueltos fuera de tiempo

## 💻 Uso en Frontend

### Leer la Propiedad `enTiempo`

```typescript
// En un componente Angular
import { Ticket } from './models/ticket.model';

ticket: Ticket;

// Verificar si está en tiempo
if (ticket.enTiempo === true) {
  console.log('Ticket resuelto en tiempo');
} else if (ticket.enTiempo === false) {
  console.log('Ticket resuelto fuera de tiempo');
} else {
  console.log('No aplica (ticket sin cerrar o sin tiempo objetivo)');
}
```

### Mostrar en la UI

```html
<!-- Ejemplo en template Angular -->
<div *ngIf="ticket.enTiempo === true" class="badge badge-success">
  ✓ En Tiempo
</div>
<div *ngIf="ticket.enTiempo === false" class="badge badge-danger">
  ⚠ Fuera de Tiempo
</div>
<div *ngIf="ticket.enTiempo === null" class="badge badge-secondary">
  - Sin Cerrar
</div>
```

### Filtrar Tickets

```typescript
// Filtrar tickets tardíos
const ticketsTardios = tickets.filter(t => t.enTiempo === false);

// Filtrar tickets en tiempo
const ticketsEnTiempo = tickets.filter(t => t.enTiempo === true);

// Filtrar tickets sin cerrar
const ticketsSinCerrar = tickets.filter(t => t.enTiempo === null);
```

### Calcular Métricas

```typescript
// Calcular cumplimiento de SLA en el frontend
const ticketsConSLA = tickets.filter(t => t.enTiempo !== null);
const ticketsEnTiempo = tickets.filter(t => t.enTiempo === true);
const cumplimientoSLA = ticketsConSLA.length > 0 
  ? (ticketsEnTiempo.length / ticketsConSLA.length) * 100 
  : 0;
```

## 🔍 Endpoints Afectados

### Tickets
- `GET /api/tickets/:id` - Incluye `enTiempo`
- `GET /api/tickets/my-tickets` - Incluye `enTiempo` en cada ticket
- `POST /api/tickets` - Incluye `enTiempo` (siempre `null` para nuevos)

### Reportes
- `GET /api/reportes/summary` - Usa nueva lógica para tickets tardíos y cumplimiento SLA
- `GET /api/reportes/gestion-servicios` - Incluye SLA por técnico con nuevas métricas

## ⚠️ Notas Importantes

1. **Tickets sin fecha de cierre**: No se consideran para cálculos de SLA
2. **Servicios sin tiempoObjetivo**: Los tickets de estos servicios no se incluyen en métricas de SLA
3. **Compatibilidad**: Los tickets existentes se calcularán automáticamente al consultarlos
4. **Rendimiento**: El cálculo se hace en SQL para mejor rendimiento, con fallback en JavaScript si es necesario

## 🧪 Pruebas

Para verificar que todo funciona correctamente:

1. Crear un ticket con un servicio que tenga `tiempoObjetivo`
2. Cerrar el ticket dentro del tiempo objetivo → `enTiempo` debe ser `true`
3. Cerrar otro ticket fuera del tiempo objetivo → `enTiempo` debe ser `false`
4. Verificar que los reportes muestran correctamente los KPIs actualizados

## 📝 Archivos Modificados

- `backend/utils/tiempoHelper.js` (nuevo)
- `backend/routes/tickets.js`
- `backend/routes/reports.js`
- `backend/controllers/reportesController.js`
- `frontend/src/app/models/ticket.model.ts`

