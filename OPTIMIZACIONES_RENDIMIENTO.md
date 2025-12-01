# Optimizaciones de Rendimiento - Mesa de Ayuda

## Problema Identificado
El sistema se congela y no avanza hasta que el usuario hace click en la pantalla. Esto es causado por problemas de detección de cambios en Angular con `OnPush` y `zonelessChangeDetection`.

## Soluciones Aplicadas

### 1. Countdown Component ✅
- **Problema**: Usa `OnPush` pero no forzaba detección de cambios cuando recibía actualizaciones del observable.
- **Solución**: Agregado `cdr.markForCheck()` en el subscribe del countdown.

### 2. Zoneless Change Detection
- La app usa `provideZonelessChangeDetection()` que mejora el rendimiento pero requiere que los componentes marquen explícitamente cuando necesitan detección de cambios.
- Componentes que usan observables deben usar `markForCheck()` o `detectChanges()`.

## Recomendaciones Adicionales

### Backend
1. **Índices en Base de Datos**:
   ```sql
   -- Agregar índices para consultas frecuentes
   CREATE INDEX idx_tickets_fecha_creacion ON Tickets(fecha_creacion);
   CREATE INDEX idx_tickets_estatus ON Tickets(estatus);
   CREATE INDEX idx_tickets_id_tecnico ON Tickets(id_tecnico);
   CREATE INDEX idx_tickets_id_usuario ON Tickets(id_usuario);
   CREATE INDEX idx_tickets_id_servicio ON Tickets(id_servicio);
   ```

2. **Optimizar Consultas**:
   - Usar `LIMIT` en consultas que devuelven muchos registros
   - Evitar `SELECT *` - seleccionar solo columnas necesarias
   - Usar `JOIN` en lugar de subconsultas cuando sea posible

3. **Caché de Consultas**:
   - Implementar caché para servicios del catálogo (cambian poco)
   - Caché para reportes (actualizar cada X minutos)

### Frontend
1. **Lazy Loading**:
   - Asegurar que los módulos se carguen bajo demanda
   - Usar `loadChildren` en rutas

2. **OnPush Strategy**:
   - Todos los componentes que usan observables deben usar `markForCheck()` o `detectChanges()`
   - Preferir `markForCheck()` sobre `detectChanges()` (más eficiente)

3. **Debounce en Búsquedas**:
   - Agregar debounce a campos de búsqueda para evitar múltiples peticiones

4. **Virtual Scrolling**:
   - Para listas largas de tickets, usar `cdk-virtual-scroll-viewport`

5. **Optimizar Imágenes**:
   - Comprimir imágenes
   - Usar formatos modernos (WebP)

### Monitoreo
1. **Performance API**:
   - Agregar métricas de rendimiento
   - Monitorear tiempo de respuesta de API

2. **Logs de Rendimiento**:
   - Registrar tiempos de carga de componentes
   - Identificar cuellos de botella

## Checklist de Optimización

- [x] Countdown component usa `markForCheck()`
- [ ] Verificar otros componentes con observables
- [ ] Agregar índices en BD
- [ ] Implementar caché para servicios
- [ ] Agregar debounce a búsquedas
- [ ] Optimizar consultas SQL
- [ ] Implementar virtual scrolling para listas largas
- [ ] Comprimir assets (imágenes)

## Notas
- `markForCheck()` marca el componente para detección de cambios en el próximo ciclo
- `detectChanges()` fuerza la detección de cambios inmediatamente (más costoso)
- Con `zonelessChangeDetection`, Angular no detecta cambios automáticamente - debe marcarse manualmente

