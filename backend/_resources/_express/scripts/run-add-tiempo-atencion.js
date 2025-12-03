const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'carmen12',
  database: process.env.DB_NAME || 'mesadeayuda',
  multipleStatements: true
};

async function runScript() {
  let connection;
  try {
    console.log('🔍 Verificando conexión a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión a MySQL establecida correctamente');

    const scriptPath = path.join(__dirname, 'add-tiempo-atencion-columns.sql');
    console.log('\n📖 Leyendo script SQL...');
    const sqlScript = fs.readFileSync(scriptPath, 'utf8');

    // Split the script into individual statements
    const statements = sqlScript.split(';').filter(s => s.trim().length > 0);
    console.log(`📝 Encontradas ${statements.length} sentencias SQL para ejecutar\n`);

    // Verificar y agregar columnas si no existen
    console.log('\n🔍 Verificando columnas existentes...');

    const [existingColumns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Tickets'
        AND COLUMN_NAME IN ('fecha_inicio_atencion', 'tiempo_atencion_segundos')
    `);

    const existingColumnNames = existingColumns.map(col => col.COLUMN_NAME);

    // Agregar fecha_inicio_atencion si no existe
    if (!existingColumnNames.includes('fecha_inicio_atencion')) {
      console.log('🔄 Agregando columna fecha_inicio_atencion...');
      await connection.query(`
        ALTER TABLE Tickets
        ADD COLUMN fecha_inicio_atencion DATETIME NULL
        COMMENT 'Fecha cuando el técnico abre el ticket (estado En Progreso por primera vez)'
      `);
      console.log('✅ Columna fecha_inicio_atencion agregada\n');
    } else {
      console.log('ℹ️  Columna fecha_inicio_atencion ya existe\n');
    }

    // Agregar tiempo_atencion_segundos si no existe
    if (!existingColumnNames.includes('tiempo_atencion_segundos')) {
      console.log('🔄 Agregando columna tiempo_atencion_segundos...');
      await connection.query(`
        ALTER TABLE Tickets
        ADD COLUMN tiempo_atencion_segundos INT NULL
        COMMENT 'Tiempo total de atención en segundos cuando el ticket fue finalizado'
      `);
      console.log('✅ Columna tiempo_atencion_segundos agregada\n');
    } else {
      console.log('ℹ️  Columna tiempo_atencion_segundos ya existe\n');
    }

    console.log('\n✅ Script ejecutado correctamente');

    // Crear índices si no existen
    console.log('\n📊 Creando índices...');
    try {
      const [indexExists1] = await connection.query(`
        SELECT 1
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'Tickets'
          AND INDEX_NAME = 'idx_tickets_fecha_inicio_atencion'
        LIMIT 1
      `);

      if (indexExists1.length === 0) {
        await connection.query(`CREATE INDEX idx_tickets_fecha_inicio_atencion ON Tickets(fecha_inicio_atencion)`);
        console.log('✅ Índice idx_tickets_fecha_inicio_atencion creado');
      } else {
        console.log('ℹ️  Índice idx_tickets_fecha_inicio_atencion ya existe');
      }

      const [indexExists2] = await connection.query(`
        SELECT 1
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'Tickets'
          AND INDEX_NAME = 'idx_tickets_tiempo_atencion'
        LIMIT 1
      `);

      if (indexExists2.length === 0) {
        await connection.query(`CREATE INDEX idx_tickets_tiempo_atencion ON Tickets(tiempo_atencion_segundos)`);
        console.log('✅ Índice idx_tickets_tiempo_atencion creado');
      } else {
        console.log('ℹ️  Índice idx_tickets_tiempo_atencion ya existe');
      }
    } catch (indexError) {
      console.warn('⚠️  Error creando índices:', indexError.message);
    }

    // Verificación
    console.log('\n📊 Verificando columnas agregadas...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Tickets'
        AND COLUMN_NAME IN ('fecha_inicio_atencion', 'tiempo_atencion_segundos')
    `);

    console.log('\n📋 Columnas encontradas:');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}): ${col.COLUMN_COMMENT || 'Sin comentario'}`);
    });

    console.log('\n🎉 Proceso completado exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la ejecución del script:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  runScript();
}

module.exports = { runScript };

