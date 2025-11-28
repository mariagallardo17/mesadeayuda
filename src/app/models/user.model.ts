export interface User {
  _id?: string;
  id?: number;
  num_empleado?: string;
  email: string;
  password?: string;
  nombre: string;
  apellido: string;
  rol: 'administrador' | 'tecnico' | 'empleado';
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion?: Date;
  ultimoAcceso?: Date;
  nombreCompleto?: string;
  departamento?: string;
  password_temporal?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  message: string;
  requiresPasswordChange?: boolean;
}

export interface CreateUserRequest {
  nombre: string;
  email: string;
  password: string;
  rol: 'administrador' | 'tecnico' | 'empleado';
  departamento?: string;
  numEmpleado?: string;
}

export interface UpdateUserRequest {
  nombre?: string;
  email?: string;
  rol?: 'administrador' | 'tecnico' | 'empleado';
  departamento?: string;
  activo?: boolean;
  numEmpleado?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}


