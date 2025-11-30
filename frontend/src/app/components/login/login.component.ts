import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { EmailService } from '../../services/email.service';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  forgotPasswordForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;
  showForgotPassword: boolean = false;
  isSendingEmail: boolean = false;
  forgotPasswordMessage: string = '';
  forgotPasswordSuccess: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private emailService: EmailService,
    private router: Router,
    private navigationService: NavigationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Escuchar eventos de limpieza de formularios
      window.addEventListener('clearLoginForm', this.clearForms.bind(this));

      // Limpiar formularios al cargar el componente
      this.clearForms();
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Remover el listener cuando se destruye el componente
      window.removeEventListener('clearLoginForm', this.clearForms.bind(this));
    }
  }

  private clearForms(): void {
    this.loginForm.reset();
    this.forgotPasswordForm.reset();
    this.errorMessage = '';
    this.forgotPasswordMessage = '';
    this.forgotPasswordSuccess = false;
    this.showForgotPassword = false;
    this.isLoading = false;
    this.isSendingEmail = false;
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      const credentials = this.loginForm.value;

      this.authService.login(credentials).subscribe({
        next: (response) => {
          this.isLoading = false;

          // Verificar si requiere cambio de contraseña
          if (response.requiresPasswordChange) {
            // Redirigir a cambio de contraseña obligatorio
            this.navigationService.navigateWithoutHistory(['/change-password']);
          } else {
            // Redirigir al perfil normalmente
            this.navigationService.navigateWithoutHistory(['/profile']);
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.message || 'Error al iniciar sesión';
        }
      });
    } else {
      this.errorMessage = 'Por favor, complete todos los campos correctamente';
    }
  }

  onForgotPasswordSubmit(): void {
    if (this.forgotPasswordForm.valid) {
      this.isSendingEmail = true;
      this.forgotPasswordMessage = '';
      this.forgotPasswordSuccess = false;

      const email = this.forgotPasswordForm.get('email')?.value;

      // Llamada al backend para recuperar contraseña temporal
      this.authService.recuperarPassword(email).subscribe({
        next: (response) => {
          this.isSendingEmail = false;
          this.forgotPasswordSuccess = true;
          this.forgotPasswordMessage = 'Para restablecer tu contraseña, revisa tu correo y sigue las instrucciones.';
          setTimeout(() => {
            this.closeForgotPassword();
          }, 3500);
        },
        error: (error) => {
          this.isSendingEmail = false;
          this.forgotPasswordSuccess = false;
          this.forgotPasswordMessage = (error?.error?.error || 'Error al enviar el correo. Por favor, intenta nuevamente.');
        }
      });
    } else {
      this.forgotPasswordMessage = 'Por favor, ingresa un correo electrónico válido';
      this.forgotPasswordSuccess = false;
    }
  }

  closeForgotPassword(): void {
    this.showForgotPassword = false;
    this.forgotPasswordForm.reset();
    this.forgotPasswordMessage = '';
    this.forgotPasswordSuccess = false;
    this.isSendingEmail = false;
  }

  private generateResetToken(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}_${random}`;
  }

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }
}


