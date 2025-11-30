const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const ticketRoutes = require('./routes/tickets');
const serviceRoutes = require('./routes/services');
const assignmentRoutes = require('./routes/assignments');
const reportsRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const { startEvaluationScheduler } = require('./services/evaluationScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  process.env.CORS_ORIGIN || 'http://localhost:4200',
  'http://localhost:4201',
  /^http:\/\/192\.168\.\d+\.\d+:4200$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:4200$/,
  /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:4200$/,
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`⚠️  Intento de acceso bloqueado desde: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'OK',
    database: dbStatus ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🌐 Escuchando en todas las interfaces de red (accesible desde la red local)`);
  console.log(`📊 Verificando conexión a la base de datos...`);

  const dbConnected = await testConnection();
  if (dbConnected) {
    console.log(`✅ Servidor listo para recibir peticiones`);
    console.log(`📍 Accede desde tu celular usando: http://TU_IP_LOCAL:${PORT}`);
    startEvaluationScheduler();
  } else {
    console.log(`⚠️  Servidor iniciado pero sin conexión a la base de datos`);
  }
});

module.exports = app;
