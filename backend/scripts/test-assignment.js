const { query } = require('../config/database');
const newAssignmentService = require('../services/newAssignmentService');

async function testAssignment() {
  try {
    console.log('🧪 Iniciando prueba de asignación...\n');

    // 1. Obtener todos los servicios con responsable_inicial
    const servicios = await query(`
      SELECT id_servicio, categoria, subcategoria, responsable_inicial
      FROM Servicios
      WHERE responsable_inicial IS NOT NULL
      AND responsable_inicial != ''
      AND estatus = 'Activo'
      LIMIT 5
    `);

    console.log(`📋 Servicios encontrados: ${servicios.length}\n`);

    for (const servicio of servicios) {
      console.log(`\n🔍 Probando servicio: ${servicio.categoria} - ${servicio.subcategoria}`);
      console.log(`   Responsable inicial: "${servicio.responsable_inicial}"`);
      console.log(`   ID Servicio: ${servicio.id_servicio}`);

      // 2. Listar todos los técnicos disponibles
      const tecnicos = await query(`
        SELECT id_usuario, nombre, rol, estatus
        FROM Usuarios
        WHERE (rol = 'tecnico' OR rol = 'administrador')
        AND estatus = 'Activo'
        ORDER BY nombre ASC
      `);

      console.log(`\n📋 Técnicos disponibles (${tecnicos.length}):`);
      tecnicos.forEach(t => {
        console.log(`   - ${t.nombre} (ID: ${t.id_usuario}, Rol: ${t.rol})`);
      });

      // 3. Intentar asignación
      console.log(`\n🤖 Intentando asignación automática...`);
      const resultado = await newAssignmentService.assignTicketAutomatically(
        servicio.id_servicio,
        'media',
        null
      );

      console.log(`\n📊 Resultado de asignación:`);
      console.log(JSON.stringify(resultado, null, 2));

      if (resultado.success) {
        console.log(`\n✅ ASIGNACIÓN EXITOSA: ${resultado.tecnico.nombre} (ID: ${resultado.tecnico.id})`);
      } else {
        console.log(`\n❌ ASIGNACIÓN FALLÓ: ${resultado.message}`);
      }

      console.log('\n' + '='.repeat(60) + '\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en prueba:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAssignment();


