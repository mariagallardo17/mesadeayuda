const fs = require('fs');
const path = require('path');
const { query, testConnection } = require('../config/database');

async function limpiarTablas() {
  try {
    console.log('🔄 Iniciando limpieza de tablas...\n');

    // Verificar conexión a la base de datos
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ No se pudo conectar a la base de datos');
      process.exit(1);
    }

    console.log('⚠️  ADVERTENCIA: Este script eliminará el contenido de todas las tablas');
    console.log('   excepto Usuarios y Servicios.\n');

    const sqlFile = path.join(__dirname, 'limpiar-tablas.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Dividir el SQL en statements individuales
    // Primero eliminar comentarios de línea (-- comentario)
    const sqlSinComentarios = sql
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        if (commentIndex !== -1) {
          return line.substring(0, commentIndex).trim();
        }
        return line.trim();
      })
      .filter(line => line.length > 0 && !line.startsWith('===') && !line.startsWith('='))
      .join(' ');

    const statements = sqlSinComentarios
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📋 Ejecutando ${statements.length} statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (!statement) continue;

      try {
        // Ejecutar SET FOREIGN_KEY_CHECKS
        if (statement.includes('FOREIGN_KEY_CHECKS')) {
          console.log('🔓 Deshabilitando restricciones de claves foráneas...');
          await query(statement);
          console.log('✅ Restricciones deshabilitadas\n');
          continue;
        }

        // Ejecutar DELETE
        if (statement.startsWith('DELETE FROM')) {
          const tableName = statement.match(/DELETE FROM\s+(\w+)/i)?.[1];
          console.log(`🗑️  Eliminando contenido de la tabla: ${tableName}`);
          const result = await query(statement);
          console.log(`✅ Registros eliminados: ${result.affectedRows}\n`);
          continue;
        }

        // Ejecutar ALTER TABLE (para resetear auto_increment)
        if (statement.startsWith('ALTER TABLE')) {
          const tableName = statement.match(/ALTER TABLE\s+(\w+)/i)?.[1];
          console.log(`🔄 Reiniciando auto_increment de la tabla: ${tableName}`);
          await query(statement);
          console.log('✅ Auto_increment reiniciado\n');
          continue;
        }

        // Ejecutar SELECT (mensaje de confirmación)
        if (statement.startsWith('SELECT')) {
          const results = await query(statement);
          if (results.length > 0) {
            console.log(`\n${results[0].resultado || '✅ Operación completada'}\n`);
          }
          continue;
        }

        // Ejecutar cualquier otro statement
        await query(statement);
      } catch (error) {
        // Si la tabla no existe, continuar con la siguiente
        if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes("doesn't exist")) {
          console.log(`⚠️  Tabla no encontrada, omitiendo...\n`);
          continue;
        }
        throw error;
      }
    }

    console.log('✅ Limpieza completada exitosamente');
    console.log('📊 Las tablas Usuarios y Servicios se mantienen intactas');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando script:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

limpiarTablas();

