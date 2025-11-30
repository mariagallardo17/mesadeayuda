const bcrypt = require('bcryptjs');
const { query, testConnection } = require('../config/database');
const readline = require('readline');

// Interfaz para leer datos del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Función para hacer preguntas
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Función para crear un super usuario
async function createSuperUser() {
  try {
    console.log('\n🔐 CREAR SUPER USUARIO (ADMINISTRADOR)\n');
    console.log('═'.repeat(50));

    // Verificar conexión
    const connected = await testConnection();
    if (!connected) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    // Solicitar datos del usuario
    console.log('\nPor favor, ingresa los datos del super usuario:\n');

    const num_empleado = await question('Número de Empleado: ');
    const nombre = await question('Nombre Completo: ');
    const departamento = await question('Departamento (ej: Administración): ');
    const correo = await question('Correo Electrónico: ');
    const password = await question('Contraseña: ');

    // Validaciones básicas
    if (!num_empleado || !nombre || !correo || !password) {
      console.log('\n❌ Todos los campos son obligatorios');
      rl.close();
      process.exit(1);
    }

    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
      console.log('\n❌ El formato del correo electrónico no es válido');
      rl.close();
      process.exit(1);
    }

    // Validar contraseña (mínimo 6 caracteres, al menos una mayúscula, una minúscula y un número)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(password)) {
      console.log('\n❌ La contraseña debe tener al menos 6 caracteres, una mayúscula, una minúscula y un número');
      rl.close();
      process.exit(1);
    }

    console.log('\n🔄 Verificando si el usuario ya existe...');

    // Verificar si el correo ya existe
    const existingEmail = await query(
      'SELECT id_usuario, nombre FROM Usuarios WHERE correo = ?',
      [correo]
    );

    if (existingEmail.length > 0) {
      console.log(`\n⚠️  Ya existe un usuario con el correo: ${correo}`);
      console.log(`   Usuario: ${existingEmail[0].nombre}`);
      const overwrite = await question('\n¿Deseas actualizar este usuario a Administrador? (s/n): ');

      if (overwrite.toLowerCase() === 's' || overwrite.toLowerCase() === 'si') {
        const hashedPassword = await bcrypt.hash(password, 10);

        await query(`
          UPDATE Usuarios
          SET num_empleado = ?,
              nombre = ?,
              departamento = ?,
              password = ?,
              rol = 'Administrador',
              estatus = 'Activo',
              password_temporal = false
          WHERE correo = ?
        `, [num_empleado, nombre, departamento, hashedPassword, correo]);

        console.log('\n✅ Usuario actualizado a Administrador exitosamente!');
        console.log('\n📋 Datos del usuario:');
        console.log(`   Número de Empleado: ${num_empleado}`);
        console.log(`   Nombre: ${nombre}`);
        console.log(`   Departamento: ${departamento}`);
        console.log(`   Correo: ${correo}`);
        console.log(`   Rol: Administrador`);
        console.log(`   Contraseña: ${password}`);
      } else {
        console.log('\n❌ Operación cancelada');
      }

      rl.close();
      process.exit(0);
    }

    // Verificar si el número de empleado ya existe
    const existingEmp = await query(
      'SELECT id_usuario, nombre FROM Usuarios WHERE num_empleado = ?',
      [num_empleado]
    );

    if (existingEmp.length > 0) {
      console.log(`\n❌ Ya existe un usuario con el número de empleado: ${num_empleado}`);
      console.log(`   Usuario: ${existingEmp[0].nombre}`);
      rl.close();
      process.exit(1);
    }

    console.log('\n🔄 Creando super usuario...');

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario
    const result = await query(`
      INSERT INTO Usuarios (
        num_empleado,
        nombre,
        departamento,
        correo,
        password,
        rol,
        estatus,
        password_temporal
      )
      VALUES (?, ?, ?, ?, ?, 'Administrador', 'Activo', false)
    `, [num_empleado, nombre, departamento, correo, hashedPassword]);

    console.log('\n✅ Super usuario creado exitosamente!');
    console.log('\n📋 Datos del usuario:');
    console.log(`   ID: ${result.insertId}`);
    console.log(`   Número de Empleado: ${num_empleado}`);
    console.log(`   Nombre: ${nombre}`);
    console.log(`   Departamento: ${departamento}`);
    console.log(`   Correo: ${correo}`);
    console.log(`   Rol: Administrador`);
    console.log(`   Contraseña: ${password}`);
    console.log('\n⚠️  IMPORTANTE: Guarda estos datos en un lugar seguro');

    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error creando super usuario:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Ejecutar
createSuperUser();

