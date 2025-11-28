const { query } = require('../config/database');

class NewAssignmentService {

  /**
   * Asigna automáticamente un ticket usando el nuevo catálogo de servicios
   * @param {number} servicioId - ID del servicio
   * @param {string} prioridadTecnica - Prioridad técnica del ticket
   * @param {number} usuarioId - ID del usuario que solicita
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
      const tecnico = await this.findTechnicianByName(servicio.responsableInicial);
      if (!tecnico) {
        console.log(`⚠️ Técnico "${servicio.responsableInicial}" no encontrado en la base de datos`);
        return {
          success: false,
          message: `Técnico "${servicio.responsableInicial}" no encontrado`
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
        console.log(`⚠️ Técnico "${tecnico.nombre}" no está disponible`);
        return {
          success: false,
          message: `Técnico "${tecnico.nombre}" no está disponible actualmente`
        };
      }

      // 6. Calcular prioridad final
      const prioridadFinal = await this.calculateFinalPriority(prioridadTecnica, usuarioId);

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
      const servicios = await query(`
        SELECT
          id_servicio,
          categoria,
          subcategoria,
          descripcion,
          responsable_inicial,
          prioridad,
          escalamiento,
          tiempo_objetivo,
          tiempo_maximo
        FROM Servicios
        WHERE id_servicio = ? AND estatus = 'Activo'
      `, [servicioId]);

      if (servicios.length === 0) {
        return null;
      }

      const servicio = servicios[0];
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
      console.error('Error obteniendo información del servicio:', error);
      return null;
    }
  }

  /**
   * Busca un técnico por nombre en la base de datos
   */
  async findTechnicianByName(nombreTecnico) {
    try {
      // Normalizar el nombre para la búsqueda
      const nombreNormalizado = nombreTecnico.trim();

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
          nombre LIKE ?
          OR nombre LIKE ?
          OR nombre LIKE ?
        )
        ORDER BY nombre ASC
      `, [
        `%${nombreNormalizado}%`,
        `%${nombreNormalizado.split(' ')[0]}%`, // Solo el primer nombre
        `%${nombreNormalizado.split(' ').pop()}%` // Solo el apellido
      ]);

      if (tecnicos.length === 0) {
        return null;
      }

      // Si hay múltiples coincidencias, tomar la más exacta
      const exactMatch = tecnicos.find(t =>
        t.nombre.toLowerCase() === nombreNormalizado.toLowerCase()
      );

      return exactMatch || tecnicos[0];
    } catch (error) {
      console.error('Error buscando técnico por nombre:', error);
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
        SELECT estatus
        FROM Usuarios
        WHERE id_usuario = ? AND (rol = 'tecnico' OR rol = 'administrador')
      `, [tecnicoId]);

      return tecnicos.length > 0 && tecnicos[0].estatus === 'Activo';
    } catch (error) {
      console.error('Error verificando disponibilidad del técnico:', error);
      return false;
    }
  }

  /**
   * Calcula la prioridad final del ticket
   */
  async calculateFinalPriority(prioridadTecnica, usuarioId) {
    try {
      let prioridadOrganizacional = 'media';

      // Si tenemos el ID del usuario, podemos verificar su nivel organizacional
      if (usuarioId) {
        const usuarios = await query(`
          SELECT rol, departamento
          FROM Usuarios
          WHERE id_usuario = ?
        `, [usuarioId]);

        if (usuarios.length > 0) {
          const usuario = usuarios[0];
          // Lógica para determinar prioridad organizacional
          if (usuario.rol === 'administrador') {
            prioridadOrganizacional = 'alta';
          } else if (usuario.departamento === 'IT' || usuario.departamento === 'Sistemas') {
            prioridadOrganizacional = 'alta';
          } else {
            prioridadOrganizacional = 'media';
          }
        }
      }

      // Combinar prioridades
      const prioridades = {
        'critica': 4,
        'alta': 3,
        'media': 2,
        'baja': 1
      };

      const scoreTecnico = prioridades[prioridadTecnica.toLowerCase()] || 2;
      const scoreOrganizacional = prioridades[prioridadOrganizacional.toLowerCase()] || 2;

      const scoreFinal = Math.max(scoreTecnico, scoreOrganizacional);

      const level = Object.keys(prioridades).find(key => prioridades[key] === scoreFinal) || 'media';

      return {
        level: level,
        score: scoreFinal,
        tecnico: prioridadTecnica,
        organizacional: prioridadOrganizacional
      };
    } catch (error) {
      console.error('Error calculando prioridad final:', error);
      return {
        level: prioridadTecnica || 'media',
        score: 2,
        tecnico: prioridadTecnica || 'media',
        organizacional: 'media'
      };
    }
  }
}

module.exports = new NewAssignmentService();
