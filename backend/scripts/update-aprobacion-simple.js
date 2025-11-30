const { query } = require('../config/database');

async function updateAprobacion() {
  try {
    console.log('🔄 Actualizando servicios que requieren aprobación...\n');

    const updateQuery = `
      UPDATE Servicios
      SET requiere_aprobacion = 1
      WHERE (categoria = 'Internet' AND subcategoria = 'Descargas de software')
         OR (categoria = 'Internet' AND subcategoria = 'Solicitud de red')
         OR (categoria = 'Telefonía IP' AND subcategoria = 'Instalación de teléfono IP')
         OR (categoria = 'Telefonía IP' AND subcategoria = 'Creación de extensión')
         OR (categoria = 'Equipo de cómputo' AND subcategoria = 'Instalación de nuevo equipo')
         OR (categoria = 'Equipo de cómputo' AND subcategoria = 'Reemplazo de equipo')
         OR (categoria = 'Proyectores' AND subcategoria = 'Instalación de nuevo proyector')
         OR (categoria = 'Correo' AND subcategoria = 'Creación de correo')
         OR (categoria = 'Teams' AND subcategoria = 'Creación de grupos')
         OR (categoria = 'Desarrollo de software' AND subcategoria = 'Nuevo sistema')
         OR (categoria = 'Red interna' AND subcategoria = 'Nodo')
         OR (categoria = 'Red interna' AND subcategoria = 'Servidor')
    `;

    const result = await query(updateQuery);
    console.log(`✅ Servicios actualizados: ${result.affectedRows}\n`);

    // Verificar los servicios actualizados
    const servicios = await query(`
      SELECT
        id_servicio,
        categoria,
        subcategoria,
        requiere_aprobacion,
        estatus
      FROM Servicios
      WHERE requiere_aprobacion = 1
      ORDER BY categoria, subcategoria
    `);

    console.log('📋 Servicios que requieren aprobación:');
    console.table(servicios);

    const count = await query(`
      SELECT COUNT(*) as total
      FROM Servicios
      WHERE requiere_aprobacion = 1
    `);

    console.log(`\n✅ Total de servicios que requieren aprobación: ${count[0].total}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateAprobacion();


