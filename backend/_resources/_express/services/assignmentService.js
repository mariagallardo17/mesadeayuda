const { query } = require('../config/database');

class AssignmentService {

  /**
   * Asigna automáticamente un ticket a un técnico basado en roles y especialidades
   * @param {number} servicioId - ID del servicio
   * @param {string} prioridadTecnica - Prioridad técnica del ticket (critica, alta, media, baja)
   * @param {number} usuarioId - ID del usuario que solicita (para prioridad organizacional)
   * @param {boolean} isEscalated - Si el ticket fue escalado desde otro técnico
   * @returns {Object} - Información del técnico asignado
   */
  async assignTicketAutomatically(servicioId, prioridadTecnica = 'media', usuarioId = null, isEscalated = false) {
    try {
      console.log(`🔍 Buscando asignación automática para servicio ${servicioId} con prioridad técnica ${prioridadTecnica}`);

      // 1. Obtener información del servicio
      const servicio = await this.getServiceInfo(servicioId);
      if (!servicio) {
        throw new Error('Servicio no encontrado');
      }

      // 2. Calcular prioridad final (técnica + organizacional)
      const prioridadFinal = await this.calculateFinalPriority(prioridadTecnica, usuarioId);
      console.log(`📊 Prioridad final calculada: ${prioridadFinal.score} (${prioridadFinal.level})`);

      // 3. Mapear categoría a área de especialización
      const areaServicio = this.mapCategoryToArea(servicio.categoria);
      console.log(`📍 Área mapeada: ${areaServicio} para categoría: ${servicio.categoria}`);

      // 3.1. Asignación especial para TELEFONIA IP - asignar directamente a ADRIAN
      if (areaServicio === 'TELEFONIA_IP') {
        console.log('📞 Asignación especial: TELEFONIA IP -> ADRIAN');
        const adrianInfo = await this.getTechnicianInfo(10); // ID de ADRIAN
        if (adrianInfo) {
          const disponible = await this.checkTechnicianAvailability(10, 50); // Límite alto para ADRIAN
          if (disponible) {
            console.log(`✅ TELEFONIA IP asignado directamente a: ${adrianInfo.nombre}`);
            return {
              success: true,
              tecnico: {
                id: adrianInfo.id_usuario,
                nombre: adrianInfo.nombre,
                area: areaServicio,
                nivel: 'especialista_telefonia'
              },
              areaServicio: areaServicio,
              prioridadFinal: prioridadFinal,
              especial: true // Marcar como asignación especial
            };
          } else {
            console.log('⚠️ ADRIAN no disponible para TELEFONIA IP, continuando con asignación normal');
          }
        } else {
          console.log('❌ ADRIAN no encontrado en el sistema, continuando con asignación normal');
        }
      }

      // 4. Si es escalamiento, buscar técnico de nivel superior
      if (isEscalated) {
        console.log(`📈 Procesando escalamiento para área: ${areaServicio}`);
        const tecnicoEscalado = await this.assignEscalatedTicket(areaServicio, prioridadFinal.level);
        if (tecnicoEscalado) {
          return {
            success: true,
            tecnico: tecnicoEscalado,
            areaServicio: areaServicio,
            prioridadFinal: prioridadFinal,
            isEscalated: true
          };
        }
      }

      // 5. Buscar reglas de asignación para esta área y prioridad final
      const reglaAsignacion = await this.getAssignmentRule(areaServicio, prioridadFinal.level);
      if (!reglaAsignacion) {
        console.log(`⚠️ No se encontró regla de asignación para ${areaServicio} - ${prioridadFinal.level}`);
        return await this.getFallbackAssignment(areaServicio, prioridadFinal);
      }

      // 6. Verificar disponibilidad y asignar técnico
      const tecnicoAsignado = await this.assignTechnician(reglaAsignacion, prioridadFinal.level);

      if (tecnicoAsignado) {
        console.log(`✅ Ticket asignado automáticamente a: ${tecnicoAsignado.nombre} (${tecnicoAsignado.area})`);
        return {
          success: true,
          tecnico: tecnicoAsignado,
          reglaUsada: reglaAsignacion,
          areaServicio: areaServicio,
          prioridadFinal: prioridadFinal
        };
      }

      // 5. Si no se puede asignar, usar fallback
      return await this.getFallbackAssignment(areaServicio);

    } catch (error) {
      console.error('❌ Error en asignación automática:', error);
      throw error;
    }
  }

  /**
   * Calcula la prioridad final combinando prioridad técnica y organizacional
   */
  async calculateFinalPriority(prioridadTecnica, usuarioId) {
    try {
      // Mapear prioridad técnica a número
      const prioridadTecnicaMap = {
        'critica': 1,
        'alta': 2,
        'media': 3,
        'baja': 4
      };

      const nivelTecnico = prioridadTecnicaMap[prioridadTecnica.toLowerCase()] || 3;

      let nivelOrganizacional = 7; // Por defecto, nivel más bajo
      let nivelOrganizacionalNombre = 'Docentes, auxiliares, asistentes';

      // Si se proporciona usuarioId, obtener su nivel organizacional
      if (usuarioId) {
        // Para simplificar, usar nivel organizacional por defecto basado en el rol
        const usuarioInfo = await query(`
          SELECT rol FROM Usuarios WHERE id_usuario = ?
        `, [usuarioId]);

        let nivelOrganizacional = 7; // Por defecto, nivel más bajo
        let nivelOrganizacionalNombre = 'Docentes, auxiliares, asistentes';

        if (usuarioInfo.length > 0) {
          const rol = usuarioInfo[0].rol;
          if (rol === 'administrador') {
            nivelOrganizacional = 1;
            nivelOrganizacionalNombre = 'Director General';
          } else if (rol === 'tecnico') {
            nivelOrganizacional = 3;
            nivelOrganizacionalNombre = 'Jefes de Departamento';
          } else if (rol === 'empleado') {
            nivelOrganizacional = 7;
            nivelOrganizacionalNombre = 'Docentes, auxiliares, asistentes';
          }
        }

        const usuarioNivel = [{ nivel_prioridad: nivelOrganizacional, nivel_organizacional: nivelOrganizacionalNombre }];

        if (usuarioNivel.length > 0) {
          nivelOrganizacional = usuarioNivel[0].nivel_prioridad;
          nivelOrganizacionalNombre = usuarioNivel[0].nivel_organizacional;
        }
      }

      // Obtener configuración de pesos
      // Usar configuración por defecto ya que no tenemos la tabla configuracion_prioridades
      const configuracion = [];

      const pesoOrg = configuracion.length > 0 ? configuracion[0].peso_organizacional : 0.70;
      const pesoTec = configuracion.length > 0 ? configuracion[0].peso_tecnico : 0.30;

      // Calcular prioridad final (menor número = mayor prioridad)
      const prioridadFinal = (nivelOrganizacional * pesoOrg) + (nivelTecnico * pesoTec);

      // Determinar nivel de prioridad final
      let nivelFinal;
      if (prioridadFinal <= 2.0) {
        nivelFinal = 'critica';
      } else if (prioridadFinal <= 3.5) {
        nivelFinal = 'alta';
      } else if (prioridadFinal <= 5.0) {
        nivelFinal = 'media';
      } else {
        nivelFinal = 'baja';
      }

      return {
        score: prioridadFinal,
        level: nivelFinal,
        technicalLevel: nivelTecnico,
        organizationalLevel: nivelOrganizacional,
        organizationalName: nivelOrganizacionalNombre,
        weights: {
          organizational: pesoOrg,
          technical: pesoTec
        }
      };

    } catch (error) {
      console.error('Error calculando prioridad final:', error);
      // Fallback a prioridad media
      return {
        score: 4.0,
        level: 'media',
        technicalLevel: 3,
        organizationalLevel: 7,
        organizationalName: 'Nivel no definido',
        weights: { organizational: 0.70, technical: 0.30 }
      };
    }
  }

  /**
   * Asigna ticket escalado a técnico de nivel superior
   */
  async assignEscalatedTicket(areaServicio, prioridadFinal) {
    try {
      console.log(`🔄 Buscando técnico para escalamiento en área: ${areaServicio}`);

      // Buscar técnicos especialistas de nivel principal primero
      const tecnicosPrincipales = await query(`
        SELECT
          u.id_usuario,
          u.nombre,
          te.area_especialidad,
          te.nivel_expertise,
          COUNT(t.id_ticket) as tickets_activos
        FROM Usuarios u
        JOIN tecnicos_especialidades te ON u.id_usuario = te.usuario_id
        LEFT JOIN Tickets t ON u.id_usuario = t.id_tecnico
          AND t.estatus IN ('Abierto', 'En Proceso', 'Pendiente')
        WHERE te.area_especialidad = ?
        AND te.nivel_expertise = 'principal'
        AND u.rol IN ('tecnico', 'administrador')
        AND te.activo = 1
        GROUP BY u.id_usuario, u.nombre, te.area_especialidad, te.nivel_expertise
        ORDER BY tickets_activos ASC
      `, [areaServicio]);

      if (tecnicosPrincipales.length > 0) {
        const tecnico = tecnicosPrincipales[0];
        console.log(`✅ Escalamiento asignado a técnico principal: ${tecnico.nombre}`);

        return {
          id: tecnico.id_usuario,
          nombre: tecnico.nombre,
          area: tecnico.area_especialidad,
          nivel: 'principal',
          ticketsActivos: tecnico.tickets_activos,
          isEscalated: true
        };
      }

      // Si no hay técnicos principales disponibles, buscar técnicos secundarios
      const tecnicosSecundarios = await query(`
        SELECT
          u.id_usuario,
          u.nombre,
          te.area_especialidad,
          te.nivel_expertise,
          COUNT(t.id_ticket) as tickets_activos
        FROM Usuarios u
        JOIN tecnicos_especialidades te ON u.id_usuario = te.usuario_id
        LEFT JOIN Tickets t ON u.id_usuario = t.id_tecnico
          AND t.estatus IN ('Abierto', 'En Proceso', 'Pendiente')
        WHERE te.area_especialidad = ?
        AND te.nivel_expertise = 'secundario'
        AND u.rol IN ('tecnico', 'administrador')
        AND te.activo = 1
        GROUP BY u.id_usuario, u.nombre, te.area_especialidad, te.nivel_expertise
        ORDER BY tickets_activos ASC
      `, [areaServicio]);

      if (tecnicosSecundarios.length > 0) {
        const tecnico = tecnicosSecundarios[0];
        console.log(`✅ Escalamiento asignado a técnico secundario: ${tecnico.nombre}`);

        return {
          id: tecnico.id_usuario,
          nombre: tecnico.nombre,
          area: tecnico.area_especialidad,
          nivel: 'secundario',
          ticketsActivos: tecnico.tickets_activos,
          isEscalated: true
        };
      }

      // Si no hay técnicos especializados, escalar a administradores técnicos
      const administradores = await query(`
        SELECT
          u.id_usuario,
          u.nombre,
          COUNT(t.id_ticket) as tickets_activos
        FROM Usuarios u
        LEFT JOIN Tickets t ON u.id_usuario = t.id_tecnico
          AND t.estatus IN ('Abierto', 'En Proceso', 'Pendiente')
        WHERE u.rol = 'administrador'
        GROUP BY u.id_usuario, u.nombre
        ORDER BY tickets_activos ASC
        LIMIT 1
      `);

      if (administradores.length > 0) {
        const admin = administradores[0];
        console.log(`⚠️ Escalamiento asignado a administrador: ${admin.nombre}`);

        return {
          id: admin.id_usuario,
          nombre: admin.nombre,
          area: 'ADMINISTRACION',
          nivel: 'administrador',
          ticketsActivos: admin.tickets_activos,
          isEscalated: true,
          isAdminEscalation: true
        };
      }

      console.log(`❌ No se encontró técnico disponible para escalamiento`);
      return null;

    } catch (error) {
      console.error('Error en asignación de escalamiento:', error);
      return null;
    }
  }

  /**
   * Obtiene información del servicio por ID
   */
  async getServiceInfo(servicioId) {
    const servicios = await query(`
      SELECT id_servicio, categoria, subcategoria, tiempo_objetivo
      FROM Servicios
      WHERE id_servicio = ? AND estatus = 'Activo'
    `, [servicioId]);

    return servicios.length > 0 ? servicios[0] : null;
  }

  /**
   * Mapea la categoría del servicio a un área de especialización
   */
  mapCategoryToArea(categoria) {
    const categoriaLower = categoria.toLowerCase();

    if (categoriaLower.includes('internet') || categoriaLower.includes('conexión') || categoriaLower.includes('acceso')) {
      return 'INTERNET';
    }
    if (categoriaLower.includes('teléfono') || categoriaLower.includes('telefonía') || categoriaLower.includes('ip')) {
      return 'TELEFONIA_IP';
    }
    if (categoriaLower.includes('computadora') || categoriaLower.includes('equipo') ||
        categoriaLower.includes('impresora') || categoriaLower.includes('proyector')) {
      return 'EQUIPO_COMPUTO';
    }
    if (categoriaLower.includes('correo') || categoriaLower.includes('email')) {
      return 'CORREO';
    }
    if (categoriaLower.includes('software') || categoriaLower.includes('office') ||
        categoriaLower.includes('teams') || categoriaLower.includes('connect')) {
      return 'SOFTWARE';
    }
    if (categoriaLower.includes('red') || categoriaLower.includes('wifi') || categoriaLower.includes('nodo')) {
      return 'RED';
    }

    return 'GENERAL';
  }

  /**
   * Obtiene la regla de asignación para un área y prioridad específica
   */
  async getAssignmentRule(areaServicio, prioridad) {
    const reglas = await query(`
      SELECT
        aa.*,
        tp.nombre as tecnico_principal_nombre,
        ts.nombre as tecnico_secundario_nombre,
        tso.nombre as tecnico_soporte_nombre
      FROM asignaciones_automaticas aa
      LEFT JOIN Usuarios tp ON aa.tecnico_principal_id = tp.id_usuario
      LEFT JOIN Usuarios ts ON aa.tecnico_secundario_id = ts.id_usuario
      LEFT JOIN Usuarios tso ON aa.tecnico_soporte_id = tso.id_usuario
      WHERE aa.area_servicio = ?
      AND aa.prioridad_ticket = ?
      AND aa.activo = 1
      ORDER BY aa.fecha_creacion DESC
      LIMIT 1
    `, [areaServicio, prioridad]);

    return reglas.length > 0 ? reglas[0] : null;
  }

  /**
   * Asigna un técnico basado en la regla de asignación
   */
  async assignTechnician(reglaAsignacion, prioridad) {
    // 1. Verificar disponibilidad del técnico principal
    if (reglaAsignacion.tecnico_principal_id) {
      const disponible = await this.checkTechnicianAvailability(
        reglaAsignacion.tecnico_principal_id,
        reglaAsignacion.carga_maxima
      );

      if (disponible) {
        const tecnico = await this.getTechnicianInfo(reglaAsignacion.tecnico_principal_id);
        if (tecnico) {
          return {
            id: tecnico.id_usuario,
            nombre: tecnico.nombre,
            area: reglaAsignacion.area_servicio,
            nivel: 'principal',
            regla: reglaAsignacion
          };
        }
      }
    }

    // 2. Si el principal no está disponible, intentar con el secundario
    if (reglaAsignacion.tecnico_secundario_id) {
      const disponible = await this.checkTechnicianAvailability(
        reglaAsignacion.tecnico_secundario_id,
        reglaAsignacion.carga_maxima
      );

      if (disponible) {
        const tecnico = await this.getTechnicianInfo(reglaAsignacion.tecnico_secundario_id);
        if (tecnico) {
          return {
            id: tecnico.id_usuario,
            nombre: tecnico.nombre,
            area: reglaAsignacion.area_servicio,
            nivel: 'secundario',
            regla: reglaAsignacion
          };
        }
      }
    }

    // 3. Si el secundario no está disponible, intentar con soporte
    if (reglaAsignacion.tecnico_soporte_id) {
      const disponible = await this.checkTechnicianAvailability(
        reglaAsignacion.tecnico_soporte_id,
        reglaAsignacion.carga_maxima
      );

      if (disponible) {
        const tecnico = await this.getTechnicianInfo(reglaAsignacion.tecnico_soporte_id);
        if (tecnico) {
          return {
            id: tecnico.id_usuario,
            nombre: tecnico.nombre,
            area: reglaAsignacion.area_servicio,
            nivel: 'soporte',
            regla: reglaAsignacion
          };
        }
      }
    }

    return null;
  }

  /**
   * Verifica la disponibilidad de un técnico
   */
  async checkTechnicianAvailability(tecnicoId, cargaMaxima) {
    // Contar tickets activos del técnico
    const ticketsActivos = await query(`
      SELECT COUNT(*) as count
      FROM Tickets
      WHERE id_tecnico = ?
      AND estatus IN ('Abierto', 'En Proceso', 'Pendiente')
    `, [tecnicoId]);

    const cantidadActiva = ticketsActivos[0].count;

    // Verificar si está dentro del límite
    const disponible = cantidadActiva < cargaMaxima;

    console.log(`👤 Técnico ${tecnicoId}: ${cantidadActiva}/${cargaMaxima} tickets activos - ${disponible ? 'Disponible' : 'Sobrecargado'}`);

    return disponible;
  }

  /**
   * Obtiene información de un técnico
   */
  async getTechnicianInfo(tecnicoId) {
    const tecnicos = await query(`
      SELECT id_usuario, nombre, correo, rol
      FROM Usuarios
      WHERE id_usuario = ? AND rol IN ('tecnico', 'administrador')
    `, [tecnicoId]);

    return tecnicos.length > 0 ? tecnicos[0] : null;
  }

  /**
   * Fallback: busca cualquier técnico disponible con especialidad en el área
   */
  async getFallbackAssignment(areaServicio) {
    console.log(`🔄 Usando fallback para área: ${areaServicio}`);

    // Buscar técnicos con especialidad en el área, ordenados por nivel de expertise
    const tecnicosEspecialistas = await query(`
      SELECT
        u.id_usuario,
        u.nombre,
        te.area_especialidad,
        te.nivel_expertise,
        COUNT(t.id_ticket) as tickets_activos
      FROM Usuarios u
      JOIN tecnicos_especialidades te ON u.id_usuario = te.usuario_id
      LEFT JOIN Tickets t ON u.id_usuario = t.id_tecnico
        AND t.estatus IN ('Abierto', 'En Proceso', 'Pendiente')
      WHERE te.area_especialidad = ?
        AND u.rol IN ('tecnico', 'administrador')
        AND te.activo = 1
      GROUP BY u.id_usuario, u.nombre, te.area_especialidad, te.nivel_expertise
      ORDER BY
        CASE te.nivel_expertise
          WHEN 'principal' THEN 1
          WHEN 'secundario' THEN 2
          WHEN 'soporte' THEN 3
        END,
        tickets_activos ASC
    `, [areaServicio]);

    if (tecnicosEspecialistas.length > 0) {
      const tecnico = tecnicosEspecialistas[0];
      console.log(`✅ Fallback: Asignado a ${tecnico.nombre} (${tecnico.nivel_expertise})`);

      return {
        success: true,
        tecnico: {
          id: tecnico.id_usuario,
          nombre: tecnico.nombre,
          area: tecnico.area_especialidad,
          nivel: tecnico.nivel_expertise,
          ticketsActivos: tecnico.tickets_activos
        },
        fallback: true,
        areaServicio: areaServicio,
        prioridadFinal: await this.calculateFinalPriority('media', null)
      };
    }

    // Si no hay especialistas, buscar cualquier técnico disponible
    const tecnicosGenerales = await query(`
      SELECT
        u.id_usuario,
        u.nombre,
        COUNT(t.id_ticket) as tickets_activos
      FROM Usuarios u
      LEFT JOIN Tickets t ON u.id_usuario = t.id_tecnico
        AND t.estatus IN ('Abierto', 'En Proceso', 'Pendiente')
      WHERE u.rol = 'tecnico'
      AND u.activo = 1
      GROUP BY u.id_usuario, u.nombre
      ORDER BY tickets_activos ASC
      LIMIT 1
    `);

    if (tecnicosGenerales.length > 0) {
      const tecnico = tecnicosGenerales[0];
      console.log(`⚠️ Fallback general: Asignado a ${tecnico.nombre}`);

      return {
        success: true,
        tecnico: {
          id: tecnico.id_usuario,
          nombre: tecnico.nombre,
          area: 'GENERAL',
          nivel: 'general',
          ticketsActivos: tecnico.tickets_activos
        },
        fallback: true,
        general: true,
        areaServicio: areaServicio,
        prioridadFinal: await this.calculateFinalPriority('media', null)
      };
    }

    console.log(`❌ No se encontró ningún técnico disponible`);
    return {
      success: false,
      error: 'No hay técnicos disponibles para asignar',
      areaServicio: areaServicio
    };
  }

  /**
   * Obtiene estadísticas de asignaciones
   */
  async getAssignmentStats() {
    try {
      const stats = await query(`
        SELECT
          aa.area_servicio,
          aa.prioridad_ticket,
          COUNT(*) as reglas_activas,
          tp.nombre as tecnico_principal,
          ts.nombre as tecnico_secundario
        FROM asignaciones_automaticas aa
        LEFT JOIN Usuarios tp ON aa.tecnico_principal_id = tp.id_usuario
        LEFT JOIN Usuarios ts ON aa.tecnico_secundario_id = ts.id_usuario
        WHERE aa.activo = 1
        GROUP BY aa.area_servicio, aa.prioridad_ticket, aa.tecnico_principal_id, aa.tecnico_secundario_id
        ORDER BY aa.area_servicio, aa.prioridad_ticket
      `);

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Obtiene carga actual de cada técnico
   */
  async getTechnicianWorkload() {
    try {
      const workload = await query(`
        SELECT
          u.id_usuario,
          u.nombre,
          COUNT(t.id_ticket) as tickets_activos,
          COUNT(CASE WHEN t.estatus = 'Abierto' THEN 1 END) as tickets_abiertos,
          COUNT(CASE WHEN t.estatus = 'En Proceso' THEN 1 END) as tickets_proceso,
          COUNT(CASE WHEN t.estatus = 'Pendiente' THEN 1 END) as tickets_pendientes
        FROM Usuarios u
        LEFT JOIN Tickets t ON u.id_usuario = t.id_tecnico
          AND t.estatus IN ('Abierto', 'En Proceso', 'Pendiente')
        WHERE u.rol = 'tecnico' AND u.activo = 1
        GROUP BY u.id_usuario, u.nombre
        ORDER BY tickets_activos DESC
      `);

      return workload;
    } catch (error) {
      console.error('Error obteniendo carga de trabajo:', error);
      throw error;
    }
  }
}

module.exports = new AssignmentService();
