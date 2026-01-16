# Guía para Subir Cambios a Git

## Pasos para subir tus cambios

### 1. Ver el estado actual
```bash
git status
```

### 2. Agregar todos los archivos modificados y nuevos
```bash
# Agregar todos los archivos (recomendado para esta primera vez)
git add .

# O agregar archivos específicos:
git add README.md
git add docs/
git add backend/env.example
git add backend/src/Services/EmailService.php
```

### 3. Hacer commit de los cambios
```bash
git commit -m "Agregar documentación técnica completa y corregir error en EmailService"
```

**Mensajes de commit recomendados:**
- `"Agregar documentación técnica completa"`
- `"Corregir error de sintaxis en EmailService.php"`
- `"Agregar manuales de instalación y despliegue"`
- `"Crear checklist de entrega y resumen"`

### 4. Subir los cambios al repositorio remoto
```bash
git push origin main
```

**Si es la primera vez o hay conflictos:**
```bash
# Primero, traer cambios remotos
git pull origin main

# Si hay conflictos, resolverlos y luego:
git push origin main
```

## Resumen de Comandos Completos

```bash
# 1. Ver cambios
git status

# 2. Agregar cambios
git add .

# 3. Hacer commit
git commit -m "Descripción de tus cambios"

# 4. Subir a GitHub
git push origin main
```

## Si hay errores

### Error: "Your branch is ahead of 'origin/main'"
- Solo necesitas hacer `git push origin main`

### Error: "Updates were rejected"
- Primero haz: `git pull origin main`
- Resuelve conflictos si los hay
- Luego: `git push origin main`

### Error: "Authentication failed"
- Necesitas configurar tus credenciales de GitHub
- O usar un Personal Access Token en lugar de contraseña

