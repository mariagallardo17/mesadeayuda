import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, catchError, delay, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ServiceCatalog, CreateServiceRequest, UpdateServiceRequest } from '../models/service-catalog.model';
import { ApiConfig } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class ServiceCatalogService {
  private servicesSubject = new BehaviorSubject<ServiceCatalog[]>([]);
  public services$ = this.servicesSubject.asObservable();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    // Inicializar servicios desde la base de datos
    this.initializeServices();
  }

  // Inicializar servicios desde el backend
  private initializeServices(): void {
    this.loadServicesFromBackend();
  }

  // Cargar servicios desde el backend
  private loadServicesFromBackend(): void {
    console.log('🔄 Cargando servicios desde base de datos...');
    this.http.get<ServiceCatalog[]>(`${ApiConfig.API_BASE_URL}/services`)
      .pipe(
        catchError(error => {
          console.error('❌ Error cargando servicios desde backend:', error);
          if (error.status === 401) {
            console.log('🔐 Error de autenticación - Usuario no logueado');
          } else if (error.status === 0) {
            console.log('🌐 Error de conexión - Backend no disponible');
          }
          console.log('⚠️ No hay servicios disponibles - verificar conexión a base de datos');
          // Si hay error, retornar array vacío
          return of([]);
        })
      )
      .subscribe(services => {
        console.log('✅ Servicios cargados desde base de datos:', services.length);
        console.log('📋 Primeros 5 servicios:', services.slice(0, 5).map((s: ServiceCatalog) => `${s.categoria} - ${s.subcategoria}`));
        this.servicesSubject.next(services);
      });
  }

  // Obtener todos los servicios
  getServices(): Observable<ServiceCatalog[]> {
    return this.services$;
  }

  // Recargar servicios desde el backend
  reloadServices(): Observable<ServiceCatalog[]> {
    return this.http.get<ServiceCatalog[]>(`${ApiConfig.API_BASE_URL}/services`)
      .pipe(
        tap((services: ServiceCatalog[]) => {
          this.servicesSubject.next(services);
        }),
        catchError(error => {
          console.error('Error recargando servicios:', error);
          return throwError(() => error);
        })
      );
  }

  // Buscar servicios
  searchServices(query: string): Observable<ServiceCatalog[]> {
    return this.services$.pipe(
      map(services => {
        if (!query.trim()) return services;

        const searchTerm = query.toLowerCase();
        return services.filter(service => {
        const categoriaMatch = service.categoria.toLowerCase().includes(searchTerm);
        const subcategoriaMatch = service.subcategoria.toLowerCase().includes(searchTerm);
        const tiempoMatch = (service.tiempoObjetivo || '').toLowerCase().includes(searchTerm);
        const escalamientoMatch = service.escalamiento.toLowerCase().includes(searchTerm);
        const nivelMatch = service.sla?.toLowerCase().includes(searchTerm) ?? false;

        return categoriaMatch || subcategoriaMatch || tiempoMatch || escalamientoMatch || nivelMatch;
        });
      }),
      delay(200)
    );
  }

  // Obtener servicios por categoría
  getServicesByCategory(categoria: string): Observable<ServiceCatalog[]> {
    return this.services$.pipe(
      map(services => services.filter(service => service.categoria === categoria))
    );
  }

  // Obtener categorías únicas
  getCategories(): Observable<string[]> {
    console.log('🔍 getCategories() llamado');
    return this.services$.pipe(
      map(services => {
        console.log('📊 Servicios disponibles para getCategories:', services.length);
        console.log('📋 Primeros 3 servicios:', services.slice(0, 3).map(s => s.categoria));
        const categories = [...new Set(services.map(service => service.categoria))];
        console.log('🏷️ Categorías encontradas:', categories);
        return categories.sort();
      })
    );
  }

  // Obtener subcategorías por categoría
  getSubcategoriesByCategory(categoria: string): Observable<string[]> {
    console.log('🔍 getSubcategoriesByCategory llamado para:', categoria);
    return this.services$.pipe(
      map(services => {
        console.log('📊 Total de servicios disponibles:', services.length);
        const filteredServices = services.filter(service => service.categoria === categoria);
        console.log(`🎯 Servicios encontrados para "${categoria}":`, filteredServices.length);

        const subcategories = filteredServices.map(service => service.subcategoria);
        const uniqueSubcategories = [...new Set(subcategories)].sort();

        console.log('📝 Subcategorías únicas:', uniqueSubcategories);
        return uniqueSubcategories;
      })
    );
  }

  // Obtener información completa de un servicio específico
  getServiceInfo(categoria: string, subcategoria: string): Observable<ServiceCatalog | null> {
    return this.services$.pipe(
      map(services => {
        const service = services.find(s =>
          s.categoria === categoria && s.subcategoria === subcategoria
        );
        return service || null;
      })
    );
  }

  // Crear nuevo servicio
  createService(serviceData: CreateServiceRequest): Observable<ServiceCatalog> {
    return this.http.post<{service: ServiceCatalog}>(`${ApiConfig.API_BASE_URL}/services`, serviceData)
      .pipe(
        map(response => response.service),
        tap((newService: ServiceCatalog) => {
          // Actualizar la lista local
          const currentServices = this.servicesSubject.value;
          const updatedServices = [...currentServices, newService];
          this.servicesSubject.next(updatedServices);
        }),
        catchError(error => {
          console.error('Error creando servicio:', error);
          return throwError(() => error);
        })
      );
  }

  // Actualizar servicio
  updateService(id: number, serviceData: UpdateServiceRequest): Observable<ServiceCatalog> {
    return this.http.put<ServiceCatalog>(`${ApiConfig.API_BASE_URL}/services/${id}`, serviceData)
      .pipe(
        tap((updatedService: ServiceCatalog) => {
          // Actualizar la lista local
          const currentServices = this.servicesSubject.value;
          const serviceIndex = currentServices.findIndex(service => service.id === id);
          if (serviceIndex !== -1) {
            const updatedServices = [...currentServices];
            updatedServices[serviceIndex] = updatedService;
            this.servicesSubject.next(updatedServices);
          }
        }),
        catchError(error => {
          console.error('Error actualizando servicio:', error);
          return throwError(() => error);
        })
      );
  }

  // Eliminar servicio
  deleteService(id: number): Observable<boolean> {
    return this.http.delete<{message: string}>(`${ApiConfig.API_BASE_URL}/services/${id}`)
      .pipe(
        map(() => true),
        tap(() => {
          // Actualizar la lista local
          const currentServices = this.servicesSubject.value;
          const filteredServices = currentServices.filter(service => service.id !== id);
          this.servicesSubject.next(filteredServices);
        }),
        catchError(error => {
          console.error('Error eliminando servicio:', error);
          return throwError(() => error);
        })
      );
  }

  // Obtener servicio por ID
  getServiceById(id: number): Observable<ServiceCatalog | null> {
    return this.services$.pipe(
      map(services => services.find(service => service.id === id) || null)
    );
  }

  // Obtener estadísticas de servicios
  getServiceStats(): Observable<{
    total: number;
    porCategoria: { [key: string]: number };
    activos: number;
    inactivos: number;
  }> {
    return this.services$.pipe(
      map(services => {
        const total = services.length;
        const activos = services.filter(s => s.activo).length;
        const inactivos = total - activos;

        const porCategoria: { [key: string]: number } = {};
        services.forEach(service => {
          porCategoria[service.categoria] = (porCategoria[service.categoria] || 0) + 1;
        });

        return { total, porCategoria, activos, inactivos };
      })
    );
  }

  // Obtener servicios con filtros
  getFilteredServices(filters: {
    categoria?: string;
    subcategoria?: string;
    nivelServicio?: string;
    activo?: boolean;
  }): Observable<ServiceCatalog[]> {
    return this.services$.pipe(
      map(services => {
        return services.filter(service => {
          if (filters.categoria && service.categoria !== filters.categoria) return false;
          if (filters.subcategoria && service.subcategoria !== filters.subcategoria) return false;
          if (filters.nivelServicio && service.sla !== filters.nivelServicio) return false;
          if (filters.activo !== undefined && service.activo !== filters.activo) return false;
          return true;
        });
      })
    );
  }

  // Obtener niveles de servicio únicos
  getServiceLevels(): Observable<string[]> {
    return this.services$.pipe(
      map(services => {
        const levels = services
          .map(service => service.sla)
          .filter((level): level is string => level !== undefined && level !== null)
          .filter((level, index, array) => array.indexOf(level) === index); // Remove duplicates
        return levels.sort();
      })
    );
  }

  // Exportar servicios a CSV
  exportToCSV(): Observable<string> {
    return this.services$.pipe(
      map(services => {
        const headers = ['ID', 'Requerimiento', 'Categoría', 'Subcategoría', 'Tiempo Objetivo', 'Tiempo Máximo', 'Prioridad', 'Responsable', 'Escalamiento', 'SLA', 'Activo'];
        const csvContent = [
          headers.join(','),
          ...services.map(service => [
            service.id,
            `"${service.requerimiento || ''}"`,
            `"${service.categoria}"`,
            `"${service.subcategoria}"`,
            `"${service.tiempoObjetivo}"`,
            `"${service.tiempoMaximo}"`,
            `"${service.prioridad}"`,
            `"${service.responsableInicial}"`,
            `"${service.escalamiento}"`,
            `"${service.sla || ''}"`,
            service.activo ? 'Sí' : 'No'
          ].join(','))
        ].join('\n');

        return csvContent;
      })
    );
  }
}
