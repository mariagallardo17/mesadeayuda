const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const jwt = require('jsonwebtoken');

const router = express.Router();

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

const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
  }
  next();
};

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await query(`
      SELECT
        id_usuario as id,
        num_empleado,
        nombre,
        departamento,
        correo,
        rol,
        estatus
      FROM Usuarios
      ORDER BY nombre ASC
    `);

    const formattedUsers = users.map(user => ({
      id: user.id,
      num_empleado: user.num_empleado,
      nombre: user.nombre,
      apellido: user.nombre.split(' ')[1] || '',
      departamento: user.departamento,
      email: user.correo,
      rol: user.rol.toLowerCase(),
      activo: user.estatus === 'Activo',
      fechaCreacion: new Date() // Fecha actual como placeholder
    }));

    res.json(formattedUsers);

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener usuario por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Solo administradores pueden ver otros usuarios, o el usuario puede verse a sí mismo
    if (req.user.rol !== 'administrador' && req.user.id_usuario !== parseInt(id)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const users = await query(`
      SELECT
        id_usuario as id,
        num_empleado,
        nombre,
        departamento,
        correo,
        rol,
        estatus
      FROM Usuarios
      WHERE id_usuario = ?
    `, [id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];
    const formattedUser = {
      id: user.id,
      num_empleado: user.num_empleado,
      nombre: user.nombre,
      apellido: user.nombre.split(' ')[1] || '',
      departamento: user.departamento,
      email: user.correo,
      rol: user.rol.toLowerCase(),
      activo: user.estatus === 'Activo',
      fechaCreacion: new Date() // Fecha actual como placeholder
    };

    res.json(formattedUser);

  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo usuario (solo administradores)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      num_empleado,
      nombre,
      departamento,
      email,
      password,
      rol,
      activo = true
    } = req.body;

    // Validaciones
    if (!num_empleado || !nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados' });
    }

    // Validar contraseña
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Verificar si el email ya existe
    const existingUsers = await query(
      'SELECT id_usuario FROM Usuarios WHERE correo = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está en uso' });
    }

    // Verificar si el número de empleado ya existe
    const existingEmployee = await query(
      'SELECT id_usuario FROM Usuarios WHERE num_empleado = ?',
      [num_empleado]
    );

    if (existingEmployee.length > 0) {
      return res.status(400).json({ error: 'El número de empleado ya está en uso' });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario
    const result = await query(`
      INSERT INTO Usuarios (num_empleado, nombre, departamento, correo, password, rol, estatus)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      num_empleado,
      nombre,
      departamento,
      email,
      hashedPassword,
      rol,
      activo ? 'Activo' : 'Inactivo'
    ]);

    const newUserId = result.insertId;

    // Obtener el usuario creado
    const newUsers = await query(`
      SELECT
        id_usuario as id,
        num_empleado,
        nombre,
        departamento,
        correo,
        rol,
        estatus
      FROM Usuarios
      WHERE id_usuario = ?
    `, [newUserId]);

    const newUser = newUsers[0];
    const formattedUser = {
      id: newUser.id,
      num_empleado: newUser.num_empleado,
      nombre: newUser.nombre,
      apellido: newUser.nombre.split(' ')[1] || '',
      departamento: newUser.departamento,
      email: newUser.correo,
      rol: newUser.rol.toLowerCase(),
      activo: newUser.estatus === 'Activo',
      fechaCreacion: new Date() // Fecha actual como placeholder
    };

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: formattedUser
    });

  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar usuario
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      num_empleado,
      nombre,
      departamento,
      email,
      rol,
      activo
    } = req.body;

    // Solo administradores pueden actualizar otros usuarios, o el usuario puede actualizarse a sí mismo
    const canUpdate = req.user.rol === 'administrador' || req.user.id_usuario === parseInt(id);
    if (!canUpdate) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Solo administradores pueden cambiar roles
    const updateRole = req.user.rol === 'administrador' ? rol : undefined;

    // Verificar si el usuario existe y validar duplicados en una sola consulta
    const validationQueries = [];
    const validationParams = [];

    // Query base para verificar existencia del usuario
    let baseQuery = 'SELECT id_usuario FROM Usuarios WHERE id_usuario = ?';
    validationParams.push(id);

    // Agregar validaciones de duplicados si es necesario
    if (email) {
      baseQuery += ' OR correo = ?';
      validationParams.push(email);
    }

    if (num_empleado) {
      baseQuery += ' OR num_empleado = ?';
      validationParams.push(num_empleado);
    }

    const validationResults = await query(baseQuery, validationParams);

    if (validationResults.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar duplicados
    const userExists = validationResults.some(r => r.id_usuario == id);
    if (!userExists) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (email) {
      const emailExists = validationResults.some(r => r.id_usuario != id && r.correo === email);
      if (emailExists) {
        return res.status(400).json({ error: 'El correo electrónico ya está en uso' });
      }
    }

    if (num_empleado) {
      const employeeExists = validationResults.some(r => r.id_usuario != id && r.num_empleado === num_empleado);
      if (employeeExists) {
        return res.status(400).json({ error: 'El número de empleado ya está en uso' });
      }
    }

    // Construir query de actualización
    const updateFields = [];
    const updateValues = [];

    if (num_empleado) {
      updateFields.push('num_empleado = ?');
      updateValues.push(num_empleado);
    }
    if (nombre) {
      updateFields.push('nombre = ?');
      updateValues.push(nombre);
    }
    if (departamento) {
      updateFields.push('departamento = ?');
      updateValues.push(departamento);
    }
    if (email) {
      updateFields.push('correo = ?');
      updateValues.push(email);
    }
    if (updateRole) {
      updateFields.push('rol = ?');
      updateValues.push(updateRole);
    }
    if (activo !== undefined) {
      updateFields.push('estatus = ?');
      updateValues.push(activo ? 'Activo' : 'Inactivo');
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateValues.push(id);

    await query(
      `UPDATE Usuarios SET ${updateFields.join(', ')} WHERE id_usuario = ?`,
      updateValues
    );

    res.json({ message: 'Usuario actualizado exitosamente' });

  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Resetear contraseña de usuario (solo administradores)
router.post('/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const existingUsers = await query(
      'SELECT id_usuario, nombre FROM Usuarios WHERE id_usuario = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Generar nueva contraseña temporal
    const newPassword = 'Temp1!';
    const hashedPassword = await bcrypt.hash(newPassword, 4); // Factor bajo para mejor performance

    // Actualizar contraseña en la base de datos y marcar como temporal
    await query(
      'UPDATE Usuarios SET password = ?, password_temporal = TRUE, fecha_ultimo_cambio = NOW() WHERE id_usuario = ?',
      [hashedPassword, id]
    );

    res.json({
      message: 'Contraseña reseteada exitosamente',
      newPassword: newPassword
    });

  } catch (error) {
    console.error('Error reseteando contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar usuario (solo administradores)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // No permitir eliminar el propio usuario
    if (req.user.id_usuario === parseInt(id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    // Verificar si el usuario existe
    const existingUsers = await query(
      'SELECT id_usuario FROM Usuarios WHERE id_usuario = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Eliminar usuario
    await query('DELETE FROM Usuarios WHERE id_usuario = ?', [id]);

    res.json({ message: 'Usuario eliminado exitosamente' });

  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
