const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

async function runUpdateAprobacion() {
  try {
    console.log('🔄 Iniciando actualización de servicios que requieren aprobación...\n');

    const sqlFile = path.join(__dirname, 'update-servicios-requieren-aprobacion.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Dividir el SQL en statements individuales
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Filtrar líneas vacías, comentarios y líneas de separación
        if (s.length === 0) return false;
        if (s.startsWith('--')) return false;
        if (s.startsWith('===')) return false;
        return true;
      });

    console.log(`📋 Ejecutando ${statements.length} statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (!statement) continue;

      // Ejecutar UPDATE
      if (statement.startsWith('UPDATE')) {
        console.log(`🔄 Ejecutando UPDATE...`);
        const result = await query(statement);
        console.log(`✅ Servicios actualizados: ${result.affectedRows}\n`);
        continue;
      }

      // Ejecutar SELECT de verificación
      if (statement.startsWith('SELECT') && statement.includes('requiere_aprobacion')) {
        console.log(`📊 Verificando servicios actualizados...`);
        const results = await query(statement);
        if (results.length > 0) {
          console.table(results);
        }
        console.log('');
        continue;
      }

      // Ejecutar SELECT COUNT
      if (statement.startsWith('SELECT') && statement.includes('COUNT')) {
        const results = await query(statement);
        console.log(`✅ Total de servicios que requieren aprobación: ${results[0].total_requieren_aprobacion}`);
        continue;
      }
    }

    console.log('\n✅ Actualización completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando script:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runUpdateAprobacion();

