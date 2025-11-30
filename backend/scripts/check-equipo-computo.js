const { query } = require('../config/database');

async function checkEquipoComputo() {
  try {
    const servicios = await query(`
      SELECT id_servicio, categoria, subcategoria, requiere_aprobacion
      FROM Servicios
      WHERE categoria = 'Equipo de cómputo'
      ORDER BY subcategoria
    `);

    console.log('📋 Servicios de Equipo de cómputo:');
    console.table(servicios);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkEquipoComputo();


