import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { authInterceptor } from './interceptors/auth.interceptor';

// Error handler global para capturar errores
class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    console.error('Error global capturado:', error);
    // No hacer nada más para evitar loops infinitos
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withInterceptors([authInterceptor])
      // Removido withFetch() para compatibilidad con Internet Explorer
      // Internet Explorer no soporta Fetch API, por lo que usará XMLHttpRequest automáticamente
    )
  ]
};
