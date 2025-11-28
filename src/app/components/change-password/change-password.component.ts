import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { timeout } from 'rxjs/operators';
import { passwordValidator } from '../../validators/password.validator';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent implements OnInit {
  changePasswordForm: FormGroup;
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {
    this.changePasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, passwordValidator()]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Verificar si el usuario realmente necesita cambiar la contraseña
    this.authService.currentUser$.subscribe(user => {
      if (user && !user.password_temporal) {
        // Si no tiene contraseña temporal, redirigir al dashboard
        this.router.navigate(['/dashboard']);
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');

    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword && confirmPassword.errors?.['passwordMismatch']) {
      delete confirmPassword.errors['passwordMismatch'];
      if (Object.keys(confirmPassword.errors).length === 0) {
        confirmPassword.setErrors(null);
      }
    }

    return null;
  }

  get newPassword() {
    return this.changePasswordForm.get('newPassword');
  }

  get confirmPassword() {
    return this.changePasswordForm.get('confirmPassword');
  }

  onSubmit(): void {
    if (this.changePasswordForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const { newPassword } = this.changePasswordForm.value;

      this.authService.changeTemporaryPassword(newPassword).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = response.message || 'Contraseña cambiada exitosamente';

          // Redirigir al dashboard después de 2 segundos
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 2000);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.message || 'Error al cambiar la contraseña';
        }
      });
    }
  }
}
