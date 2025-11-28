const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'carmen12',
  database: process.env.DB_NAME || 'mesadeayuda',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para probar la conexión
async function testConnection() {
  try {
    console.log('🔍 Intentando conectar a la base de datos...');
    console.log('📊 Configuración:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      hasPassword: !!dbConfig.password
    });

    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL establecida correctamente');

    // Probar una query simple
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query de prueba exitosa:', rows);

    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:');
    console.error('   Mensaje:', error.message);
    console.error('   Código:', error.code);
    console.error('   SQL State:', error.sqlState);

    if (error.code === 'ECONNREFUSED') {
      console.error('   ⚠️  El servidor MySQL no está corriendo o no está accesible en', dbConfig.host + ':' + dbConfig.port);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   ⚠️  Credenciales incorrectas (usuario o contraseña)');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   ⚠️  La base de datos "' + dbConfig.database + '" no existe');
    }

    return false;
  }
}

// Función para ejecutar queries
async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Error ejecutando query:', error);
    throw error;
  }
}

module.exports = {
  pool,
  query,
  testConnection
};
