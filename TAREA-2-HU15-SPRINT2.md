# Tarea 2 - HU15 - Sprint 2

## Sistema de Autorización y Interfaces por Rol

De acuerdo con la Tarea 2 de la HU15 del Sprint 2, se implementó un sistema de autorización robusto que protege automáticamente todas las funcionalidades según el rol del usuario. El sistema verifica el rol del usuario en cada petición y valida que tenga los permisos necesarios para acceder a la funcionalidad solicitada. Si el usuario no tiene los permisos adecuados, el sistema bloquea el acceso y muestra un mensaje de error claro.

### Implementación de Interfaces Diferenciadas por Rol

Para garantizar una experiencia de usuario óptima y segura, se desarrollaron **tres interfaces completamente diferenciadas** que se adaptan automáticamente según el rol del usuario autenticado. Cada interfaz presenta un menú de navegación único y funcionalidades específicas, asegurando que los usuarios solo vean y accedan a las opciones correspondientes a su nivel de autorización. Las tres interfaces implementadas son: Interfaz para Empleados/Usuarios, Interfaz para Técnicos, e Interfaz para Administradores, cada una con menús y opciones de navegación completamente distintos según las necesidades y permisos de cada rol.

### Características del Sistema de Autorización

- **Protección Automática**: El sistema aplica la autorización de manera consistente en todos los endpoints protegidos, garantizando que solo los usuarios autorizados puedan realizar acciones sensibles.

- **Validación en Tiempo Real**: Cada petición al backend valida el rol del usuario mediante middleware de autenticación, asegurando que las restricciones se apliquen incluso si se intenta acceder directamente a los endpoints.

- **Navegación Condicional**: El sistema de rutas en el frontend redirige automáticamente a los usuarios según su rol, mostrando únicamente las opciones de menú y funcionalidades correspondientes a su nivel de acceso.

- **Mensajes de Error Claros**: Cuando un usuario intenta acceder a una funcionalidad no autorizada, recibe un mensaje de error descriptivo que explica la restricción de acceso.

- **Seguridad en Múltiples Capas**: La autorización se implementa tanto en el frontend (guards de Angular) como en el backend (middleware de PHP), proporcionando una doble capa de seguridad.

Este sistema garantiza que cada usuario tenga acceso únicamente a las funcionalidades apropiadas para su rol, mejorando tanto la seguridad como la experiencia de usuario al presentar interfaces limpias y enfocadas en las tareas relevantes para cada tipo de usuario.

