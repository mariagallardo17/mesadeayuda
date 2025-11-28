const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const router = express.Router();

// Función para validar contraseña
// Requisitos: mínimo 7 caracteres, al menos una mayúscula, un número y un carácter especial
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'La contraseña es requerida' };
  }

  if (password.length < 7) {
    return { valid: false, error: 'La contraseña debe tener al menos 7 caracteres' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos una letra mayúscula' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos un número' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)' };
  }

  return { valid: true };
}

// Middleware para verificar token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Login
router.post('/login', async (req, res) => {
  const startTime = Date.now();

  try {
    const { correo, password } = req.body;

    // Validaciones rápidas
    if (!correo || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    if (password.length < 3) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Buscar usuario en la base de datos (solo campos necesarios)
    const users = await query(
      'SELECT id_usuario, correo, password, rol, nombre, password_temporal, num_empleado, departamento, estatus FROM Usuarios WHERE correo = ? AND estatus = "Activo"',
      [correo]
    );

    if (users.length === 0) {
      console.log(`Login fallido - Usuario no encontrado: ${correo} (${Date.now() - startTime}ms)`);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = users[0];

    // Verificar contraseña con timeout
    const passwordCheckPromise = bcrypt.compare(password, user.password);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 5000) // 5 segundos máximo
    );

    const validPassword = await Promise.race([passwordCheckPromise, timeoutPromise]);

    if (!validPassword) {
      console.log(`Login fallido - Contraseña incorrecta: ${correo} (${Date.now() - startTime}ms)`);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Crear token JWT
    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        correo: user.correo,
        rol: user.rol,
        nombre: user.nombre
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    // Preparar respuesta sin contraseña
    const userResponse = {
      id: user.id_usuario,
      num_empleado: user.num_empleado,
      nombre: user.nombre,
      apellido: user.nombre.split(' ')[1] || '',
      departamento: user.departamento,
      email: user.correo,
      rol: user.rol.toLowerCase(),
      activo: user.estatus === 'Activo',
      password_temporal: user.password_temporal || false,
      fechaCreacion: new Date()
    };

    // Si tiene contraseña temporal, agregar flag especial
    const response = {
      token,
      user: userResponse,
      message: user.password_temporal ? 'Login exitoso - Debe cambiar contraseña' : 'Login exitoso',
      requiresPasswordChange: user.password_temporal || false
    };

    console.log(`Login exitoso: ${correo} (${Date.now() - startTime}ms)`);
    res.json(response);

  } catch (error) {
    const elapsedTime = Date.now() - startTime;

    if (error.message === 'Timeout') {
      console.log(`Login timeout: ${req.body.correo} (${elapsedTime}ms)`);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    console.error(`Error en login: ${req.body.correo} (${elapsedTime}ms)`, error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Verificar token
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    // Buscar usuario actualizado
    const users = await query(
      'SELECT * FROM Usuarios WHERE id_usuario = ?',
      [req.user.id_usuario]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];

    const userResponse = {
      id: user.id_usuario,
      num_empleado: user.num_empleado,
      nombre: user.nombre,
      apellido: user.nombre.split(' ')[1] || '',
      departamento: user.departamento,
      correo: user.correo,
      rol: user.rol.toLowerCase(),
      estatus: user.estatus
    };

    res.json({ user: userResponse });

  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cambiar contraseña
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva contraseña son requeridas' });
    }

    // Validar nueva contraseña
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Buscar usuario
    const users = await query(
      'SELECT password FROM Usuarios WHERE id_usuario = ?',
      [req.user.id_usuario]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];

    // Verificar contraseña actual
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    // Encriptar nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await query(
      'UPDATE Usuarios SET password = ?, password_temporal = FALSE, fecha_ultimo_cambio = NOW() WHERE id_usuario = ?',
      [hashedNewPassword, req.user.id_usuario]
    );

    res.json({ message: 'Contraseña actualizada exitosamente' });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cambiar contraseña temporal (sin verificar contraseña actual)
router.post('/change-temporary-password', authenticateToken, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        error: 'La nueva contraseña es requerida'
      });
    }

    // Validar nueva contraseña
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Verificar que el usuario tenga contraseña temporal
    const users = await query(
      'SELECT password_temporal FROM Usuarios WHERE id_usuario = ?',
      [req.user.id_usuario]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];
    if (!user.password_temporal) {
      return res.status(400).json({
        error: 'Este usuario no tiene contraseña temporal'
      });
    }

    // Encriptar nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña y marcar como no temporal
    await query(
      'UPDATE Usuarios SET password = ?, password_temporal = FALSE, fecha_ultimo_cambio = NOW() WHERE id_usuario = ?',
      [hashedNewPassword, req.user.id_usuario]
    );

    res.json({
      message: 'Contraseña temporal cambiada exitosamente',
      requiresPasswordChange: false
    });

  } catch (error) {
    console.error('Error cambiando contraseña temporal:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Recuperar contraseña por correo (Olvidé mi contraseña)
router.post('/forgot-password', async (req, res) => {
  try {
    const { correo } = req.body;
    if (!correo) {
      return res.status(400).json({ error: 'El campo correo es obligatorio.' });
    }

    // Buscar usuario activo
    const users = await query('SELECT id_usuario, nombre, correo FROM Usuarios WHERE correo = ? AND estatus = "Activo"', [correo]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'No se encontró ningún usuario con ese correo.' });
    }

    const user = users[0];

    // Generar nueva contraseña temporal aleatoria
    const nuevaPassword = Math.random().toString(36).slice(-8) + '!';
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);

    // Actualizar contraseña y marcar como temporal
    await query('UPDATE Usuarios SET password = ?, password_temporal = TRUE, fecha_ultimo_cambio = NOW() WHERE id_usuario = ?', [hashedPassword, user.id_usuario]);

    // Enviar correo en background
    const emailService = require('../services/emailService');
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const loginUrl = `${baseUrl}/login`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Recuperación de contraseña - Mesa de Ayuda</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
  <div style="max-width: 500px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
    <h2 style="text-align: center; color: #1976D2; margin-bottom: 10px;">Recuperación de contraseña</h2>
    <hr style="border:none; border-top:2px solid #1976D2; margin-bottom: 30px;">
    <p>Hola <strong>${user.nombre}</strong>:</p>
    <p>Se ha solicitado el restablecimiento del acceso a tu cuenta.</p>
    <div style="background: #e3f2fd; border-left: 6px solid #1976D2; padding: 25px 20px; margin: 25px 0; text-align: center;">
      <span>Tu <strong style="font-size:19px">NUEVA CONTRASEÑA TEMPORAL</strong> es:</span><br>
      <span style="font-size: 28px; font-weight: bold; color: #d32f2f; background:#fbe9e7; padding:8px 28px; border-radius:6px; display:inline-block; letter-spacing:2px; margin: 10px 0;">${nuevaPassword}</span>
      <div style="font-size:13px;margin-top:12px;color:#b71c1c;">Recuerda: Esta contraseña es válida por único uso, deberás cambiarla apenas ingreses al sistema.</div>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" style="background-color: #1976D2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ir a Iniciar Sesión</a>
    </div>
    <p style="color: #333; text-align: center; font-size: 14px;">O copia y pega este enlace en tu navegador:<br><a href="${loginUrl}" style="color: #1976D2; word-break: break-all;">${loginUrl}</a></p>
    <p style="color: #333;">Si NO solicitaste este cambio, por favor IGNORA este mensaje.</p>
    <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
    <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
  </div>
</body>
</html>`;

    setImmediate(() => {
      emailService.sendEmail({
        to: user.correo,
        subject: 'Recuperación de contraseña - Mesa de Ayuda',
        html
      }).then(() => console.log(`📧 Correo de recuperación enviado a ${user.correo}`))
        .catch(err => console.error('❌ Error enviando correo de recuperación:', err.message));
    });

    // Responder de inmediato
    res.json({ message: 'Se ha enviado una contraseña temporal a su correo. Revíselo e inicie sesión para cambiar la contraseña.' });

  } catch (error) {
    console.error('Error en recuperación de contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// Obtener perfil del usuario autenticado
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // El usuario ya está en req.user por el middleware authenticateToken
    const user = req.user;

    res.json({
      success: true,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
        num_empleado: user.num_empleado,
        departamento: user.departamento
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
