import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User, ChangePasswordRequest } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit, AfterViewInit {
  currentUser: User | null = null;
  userEmail: string = 'No disponible';
  displayEmail: string = 'No disponible';

  // Modal de cambio de contraseña
  showPasswordModal: boolean = false;
  passwordForm: ChangePasswordRequest = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  passwordError: string = '';
  passwordSuccess: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('=== DEBUG INICIO PERFIL ===');

    // Verificar localStorage directamente
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    console.log('Token en localStorage:', token);
    console.log('UserData en localStorage:', userData);

    // Intentar obtener el usuario del servicio primero
    this.currentUser = this.authService.getCurrentUser();
    console.log('Usuario del servicio:', this.currentUser);

    // Si no hay usuario del servicio, intentar del localStorage
    if (!this.currentUser && userData) {
      try {
        this.currentUser = JSON.parse(userData);
        console.log('Usuario parseado del localStorage:', this.currentUser);
      } catch (error) {
        console.error('Error parseando usuario del localStorage:', error);
      }
    }

    // Si aún no hay usuario, redirigir al login
    if (!this.currentUser) {
      console.log('No hay usuario, redirigiendo al login');
      this.router.navigate(['/login']);
      return;
    }

    console.log('=== USUARIO FINAL ===');
    console.log('Usuario final:', this.currentUser);
    console.log('Email del usuario:', this.currentUser?.email);
    console.log('Todas las propiedades del usuario:', Object.keys(this.currentUser));
    console.log('Valor completo del usuario:', JSON.stringify(this.currentUser, null, 2));

    // Establecer el email directamente
    this.setUserEmail();
    console.log('=== FIN DEBUG ===');
  }

  ngAfterViewInit(): void {
    console.log('ngAfterViewInit ejecutándose...');
    // Forzar actualización después de que la vista se haya inicializado
    if (this.currentUser) {
      const userAny = this.currentUser as any;
      const email = userAny.correo || this.currentUser.email;
      if (email && email.trim() !== '') {
        this.displayEmail = email;
        console.log('DisplayEmail actualizado en ngAfterViewInit:', this.displayEmail);
      }
    }
  }

  setUserEmail(): void {
    if (!this.currentUser) {
      this.userEmail = 'No disponible';
      this.displayEmail = 'No disponible';
      return;
    }

    const userAny = this.currentUser as any;
    const email = userAny.correo || this.currentUser.email;

    if (email && email.trim() !== '') {
      this.userEmail = email;
      this.displayEmail = email;
      console.log('Email establecido:', this.userEmail);
      console.log('DisplayEmail establecido:', this.displayEmail);

      // Forzar actualización inmediata
      setTimeout(() => {
        this.displayEmail = email;
        console.log('DisplayEmail forzado después de timeout:', this.displayEmail);
      }, 0);
    } else {
      this.userEmail = 'No disponible';
      this.displayEmail = 'No disponible';
      console.log('No se pudo establecer el email');
    }
  }


  openPasswordModal(): void {
    this.showPasswordModal = true;
    this.passwordForm = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    this.passwordError = '';
    this.passwordSuccess = '';
  }

  closePasswordModal(): void {
    this.showPasswordModal = false;
    this.passwordForm = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    this.passwordError = '';
    this.passwordSuccess = '';
  }

  changePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';

    // Validaciones básicas
    if (!this.passwordForm.currentPassword) {
      this.passwordError = 'La contraseña actual es requerida';
      return;
    }

    if (!this.passwordForm.newPassword) {
      this.passwordError = 'La nueva contraseña es requerida';
      return;
    }

    // Validar requisitos de contraseña
    const password = this.passwordForm.newPassword;

    if (password.length < 7) {
      this.passwordError = 'La contraseña debe tener al menos 7 caracteres';
      return;
    }

    if (!/[A-Z]/.test(password)) {
      this.passwordError = 'La contraseña debe contener al menos una letra mayúscula';
      return;
    }

    if (!/[0-9]/.test(password)) {
      this.passwordError = 'La contraseña debe contener al menos un número';
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      this.passwordError = 'La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)';
      return;
    }

    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.passwordError = 'Las contraseñas nuevas no coinciden';
      return;
    }

    // Llamar al servicio
    this.authService.changePassword(this.passwordForm).subscribe({
      next: (response) => {
        this.passwordSuccess = response.message;
        setTimeout(() => {
          this.closePasswordModal();
        }, 2000);
      },
      error: (error) => {
        this.passwordError = error.message || 'Error al cambiar la contraseña';
      }
    });
  }

  consultarPoliticas(): void {
    this.router.navigate(['/policies']);
  }






  get fullName(): string {
    if (!this.currentUser) return '';

    // Si el usuario tiene apellido separado, usarlo
    if (this.currentUser.apellido && this.currentUser.apellido.trim() !== '') {
      return `${this.currentUser.nombre} ${this.currentUser.apellido}`;
    }

    // Si no tiene apellido separado, solo mostrar el nombre
    return this.currentUser.nombre;
  }

  // Métodos para validar requisitos de contraseña (para uso en template)
  hasMinLength(): boolean {
    return this.passwordForm.newPassword?.length >= 7;
  }

  hasUpperCase(): boolean {
    return /[A-Z]/.test(this.passwordForm.newPassword || '');
  }

  hasNumber(): boolean {
    return /[0-9]/.test(this.passwordForm.newPassword || '');
  }

  hasSpecialChar(): boolean {
    return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.passwordForm.newPassword || '');
  }

  getCheckIcon(condition: boolean): string {
    return condition ? '✓' : '○';
  }


}
