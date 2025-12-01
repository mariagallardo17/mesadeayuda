// Configuración de la aplicación
module.exports = {
  // Base de datos
  database: {
    host: process.env.DB_HOST || '127.0.0.2',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'mesadeayuda'
  },

  // Servidor
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_key_change_in_production',
    expiresIn: '24h'
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200'
  }
};

