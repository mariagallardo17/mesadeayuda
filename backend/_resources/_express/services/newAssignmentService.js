const { query } = require('../config/database');

class NewAssignmentService {

  /**
   * Asigna automáticamente un ticket usando el nuevo catálogo de servicios
   * @param {number} servicioId - ID del servicio
   * @param {string} prioridadTecnica - Prioridad técnica del ticket
   * @param {number} usuarioId - ID del usuario que solicita (no se usa actualmente)
   * @returns {Object} - Información del técnico asignado
   */
  async assignTicketAutomatically(servicioId, prioridadTecnica = 'media', usuarioId = null) {
    try {
      console.log(`🔍 Nueva asignación automática para servicio ${servicioId} con prioridad ${prioridadTecnica}`);

      // 1. Obtener información del servicio desde el nuevo catálogo
      const servicio = await this.getServiceInfo(servicioId);
      if (!servicio) {
        throw new Error('Servicio no encontrado');
      }

      console.log(`📋 Servicio encontrado: ${servicio.categoria} - ${servicio.subcategoria}`);
      console.log(`👤 Responsable inicial: ${servicio.responsableInicial}`);

      // 2. Si no hay responsable inicial definido, no asignar
      if (!servicio.responsableInicial || servicio.responsableInicial.trim() === '') {
        console.log('⚠️ No hay responsable inicial definido para este servicio');
        return {
          success: false,
          message: 'No hay responsable inicial definido para este servicio'
        };
      }

      // 3. Buscar el técnico por nombre en la base de datos
      console.log(`🔍 Buscando técnico: "${servicio.responsableInicial}"`);
      const tecnico = await this.findTechnicianByName(servicio.responsableInicial);
      if (!tecnico) {
        console.error(`❌ Técnico "${servicio.responsableInicial}" no encontrado en la base de datos`);
        console.error(`❌ Esto significa que el responsable_inicial del servicio no coincide con ningún técnico en la BD`);
        return {
          success: false,
          message: `Técnico "${servicio.responsableInicial}" no encontrado en la base de datos. Verifica que el nombre en el catálogo coincida con el nombre completo del técnico en la BD.`
        };
      }

      // 4. Verificar que el técnico esté activo
      if (tecnico.estatus !== 'Activo') {
        console.log(`⚠️ Técnico "${tecnico.nombre}" está inactivo`);
        return {
          success: false,
          message: `Técnico "${tecnico.nombre}" está inactivo`
        };
      }

      // 5. Verificar disponibilidad del técnico (opcional - por ahora solo verificamos que esté activo)
      const disponible = await this.checkTechnicianAvailability(tecnico.id_usuario);
      if (!disponible) {
        console.error(`❌ Técnico "${tecnico.nombre}" no está disponible (estatus: ${tecnico.estatus})`);
        // Aún así intentar asignar si está activo (la verificación de disponibilidad puede ser muy estricta)
        if (tecnico.estatus === 'Activo') {
          console.log(`⚠️ Técnico está activo pero checkTechnicianAvailability falló, asignando de todos modos`);
        } else {
          return {
            success: false,
            message: `Técnico "${tecnico.nombre}" no está disponible actualmente`
          };
        }
      }

      // 6. Calcular prioridad final (solo técnica)
      const prioridadFinal = await this.calculateFinalPriority(prioridadTecnica);

      console.log(`✅ Asignación exitosa: ${tecnico.nombre} (ID: ${tecnico.id_usuario})`);

      return {
        success: true,
        tecnico: {
          id: tecnico.id_usuario,
          nombre: tecnico.nombre,
          correo: tecnico.correo,
          area: servicio.categoria,
          nivel: 'responsable_inicial'
        },
        servicio: {
          id: servicio.id_servicio,
          categoria: servicio.categoria,
          subcategoria: servicio.subcategoria,
          responsableInicial: servicio.responsableInicial,
          prioridad: servicio.prioridad,
          escalamiento: servicio.escalamiento
        },
        prioridadFinal: prioridadFinal
      };

    } catch (error) {
      console.error('❌ Error en asignación automática:', error);
      return {
        success: false,
        message: `Error en asignación: ${error.message}`
      };
    }
  }

  /**
   * Obtiene información del servicio desde el nuevo catálogo
   */
  async getServiceInfo(servicioId) {
    try {
      console.log(`🔍 Obteniendo información del servicio ID: ${servicioId}`);
      const servicios = await query(`
        SELECT
          id_servicio,
          categoria,
          subcategoria,
          responsable_inicial,
          prioridad,
          escalamiento,
          tiempo_objetivo,
          tiempo_maximo
        FROM Servicios
        WHERE id_servicio = ? AND estatus = 'Activo'
      `, [servicioId]);

      if (servicios.length === 0) {
        console.error(`❌ Servicio con ID ${servicioId} no encontrado o está inactivo`);
        return null;
      }

      const servicio = servicios[0];
      console.log(`✅ Servicio encontrado: ${servicio.categoria} - ${servicio.subcategoria}`);
      console.log(`👤 Responsable inicial del servicio: "${servicio.responsable_inicial}"`);
      console.log(`📋 Tipo de responsable_inicial:`, typeof servicio.responsable_inicial);
      console.log(`📋 Valor completo del servicio:`, JSON.stringify(servicio, null, 2));

      if (!servicio.responsable_inicial || servicio.responsable_inicial.trim() === '') {
        console.error(`❌ El servicio NO tiene responsable_inicial definido`);
      }

      return {
        id_servicio: servicio.id_servicio,
        categoria: servicio.categoria,
        subcategoria: servicio.subcategoria,
        responsableInicial: servicio.responsable_inicial,
        prioridad: servicio.prioridad,
        escalamiento: servicio.escalamiento,
        tiempoObjetivo: servicio.tiempo_objetivo,
        tiempoMaximo: servicio.tiempo_maximo
      };
    } catch (error) {
      console.error('❌ Error obteniendo información del servicio:', error);
      console.error('❌ Stack:', error.stack);
      return null;
    }
  }

  /**
   * Busca un técnico por nombre en la base de datos
   */
  async findTechnicianByName(nombreTecnico) {
    try {
      // Normalizar el nombre para la búsqueda
      const nombreNormalizado = nombreTecnico.trim().toUpperCase();
      console.log(`🔍 Buscando técnico con nombre: "${nombreNormalizado}"`);

      // Búsqueda optimizada: intentar todas las variantes en una sola consulta con OR
      const primerNombre = nombreNormalizado.split(' ')[0];
      const tecnicos = await query(`
        SELECT
          id_usuario,
          nombre,
          correo,
          rol,
          estatus,
          departamento
        FROM Usuarios
        WHERE (rol = 'tecnico' OR rol = 'administrador')
        AND estatus = 'Activo'
        AND (
          UPPER(TRIM(nombre)) = ?
          OR UPPER(TRIM(nombre)) LIKE ?
          OR UPPER(TRIM(nombre)) LIKE ?
          OR (LENGTH(?) > 2 AND UPPER(SUBSTRING_INDEX(TRIM(nombre), ' ', 1)) = ?)
        )
        ORDER BY
          CASE
            WHEN UPPER(TRIM(nombre)) = ? THEN 1
            WHEN UPPER(TRIM(nombre)) LIKE ? THEN 2
            WHEN UPPER(TRIM(nombre)) LIKE ? THEN 3
            ELSE 4
          END,
          nombre ASC
        LIMIT 1
      `, [
        nombreNormalizado,                    // Exacto
        `${nombreNormalizado}%`,              // Comienza con
        `%${nombreNormalizado}%`,             // Contiene
        primerNombre,                          // Primer nombre (para verificar longitud)
        primerNombre,                          // Primer nombre (para comparar)
        nombreNormalizado,                     // Orden: exacto
        `${nombreNormalizado}%`,              // Orden: comienza con
        `%${nombreNormalizado}%`              // Orden: contiene
      ]);

      if (tecnicos.length === 0) {
        console.log(`❌ No se encontró ningún técnico con nombre similar a "${nombreNormalizado}"`);
        return null;
      }

      console.log(`✅ Técnico encontrado: ${tecnicos[0].nombre} (ID: ${tecnicos[0].id_usuario})`);
      return tecnicos[0];
    } catch (error) {
      console.error('❌ Error buscando técnico por nombre:', error);
      console.error('❌ Stack:', error.stack);
      return null;
    }
  }

  /**
   * Verifica la disponibilidad de un técnico
   */
  async checkTechnicianAvailability(tecnicoId) {
    try {
      // Por ahora, verificamos solo que el técnico esté activo
      // En el futuro se puede agregar lógica más compleja (horarios, carga de trabajo, etc.)
      const tecnicos = await query(`
        SELECT estatus, nombre
        FROM Usuarios
        WHERE id_usuario = ? AND (rol = 'tecnico' OR rol = 'administrador')
      `, [tecnicoId]);

      if (tecnicos.length === 0) {
        console.log(`⚠️ Técnico con ID ${tecnicoId} no encontrado o no es técnico/administrador`);
        return false;
      }

      const isActive = tecnicos[0].estatus === 'Activo';
      console.log(`📊 Disponibilidad técnico ${tecnicos[0].nombre} (ID: ${tecnicoId}): ${isActive ? 'Activo' : 'Inactivo'}`);
      return isActive;
    } catch (error) {
      console.error('❌ Error verificando disponibilidad del técnico:', error);
      return false;
    }
  }

  /**
   * Calcula la prioridad final del ticket
   * Usa solo la prioridad técnica del servicio
   */
  async calculateFinalPriority(prioridadTecnica) {
    try {
      const prioridades = {
        'critica': 4,
        'alta': 3,
        'media': 2,
        'baja': 1
      };

      const prioridadNormalizada = prioridadTecnica.toLowerCase() || 'media';
      const scoreTecnico = prioridades[prioridadNormalizada] || 2;
      const level = prioridadNormalizada;

      console.log(`📊 Prioridad final: ${level} (Score: ${scoreTecnico})`);

      return {
        level: level,
        score: scoreTecnico,
        tecnico: prioridadTecnica
      };
    } catch (error) {
      console.error('Error calculando prioridad final:', error);
      return {
        level: prioridadTecnica || 'media',
        score: 2,
        tecnico: prioridadTecnica || 'media'
      };
    }
  }
}

module.exports = new NewAssignmentService();
