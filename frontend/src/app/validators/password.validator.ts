import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador personalizado para contraseñas
 * Requisitos:
 * - Mínimo 7 caracteres
 * - Al menos una letra mayúscula
 * - Al menos un número
 * - Al menos un carácter especial
 */
export function passwordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // Dejar que Validators.required maneje el valor vacío
    }

    const password = control.value;
    const errors: ValidationErrors = {};

    // Validar longitud mínima
    if (password.length < 7) {
      errors['minlength'] = {
        requiredLength: 7,
        actualLength: password.length,
        message: 'La contraseña debe tener al menos 7 caracteres'
      };
    }

    // Validar mayúscula
    if (!/[A-Z]/.test(password)) {
      errors['noUpperCase'] = {
        message: 'La contraseña debe contener al menos una letra mayúscula'
      };
    }

    // Validar número
    if (!/[0-9]/.test(password)) {
      errors['noNumber'] = {
        message: 'La contraseña debe contener al menos un número'
      };
    }

    // Validar carácter especial
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors['noSpecialChar'] = {
        message: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)'
      };
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

