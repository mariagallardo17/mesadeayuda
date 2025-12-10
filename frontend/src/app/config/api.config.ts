// Configuración dinámica de la API
export class ApiConfig {
  // Obtener la URL base del backend de forma dinámica
  static getBaseUrl(): string {
    // Si estamos en el navegador
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const port = window.location.port;

      // Si es localhost, usar localhost para el backend con /api
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
      }

      // Si estamos en una IP de red local (192.168.x.x, 10.x.x.x, 172.x.x.x)
      // Usar la misma IP pero con el puerto del backend y /api
      if (this.isLocalNetworkIp(hostname)) {
        return `http://${hostname}:3000/api`;
      }

      // Para producción, usar el mismo dominio con /api
      // Si el frontend está en https://tudominio.com
      // El backend estará en https://tudominio.com/api
      return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
    }

    // Por defecto, usar localhost con /api
    return 'http://localhost:3000/api';
  }

  // Verificar si es una IP de red local
  private static isLocalNetworkIp(hostname: string): boolean {
    // Verificar si es una IP privada
    const localIpPatterns = [
      /^192\.168\.\d{1,3}\.\d{1,3}$/,  // 192.168.x.x
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,  // 10.x.x.x
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/  // 172.16-31.x.x
    ];

    return localIpPatterns.some(pattern => pattern.test(hostname));
  }

  // URL base del API (getter que se calcula dinámicamente)
  static get API_BASE_URL(): string {
    return ApiConfig.getBaseUrl();
  }
}

