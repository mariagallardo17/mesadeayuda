import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/profile',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'change-password',
    loadComponent: () => import('./components/change-password/change-password.component').then(m => m.ChangePasswordComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'dashboard',
    redirectTo: '/profile',
    pathMatch: 'full'
  },
  {
    path: 'tickets',
    canActivate: [AuthGuard],
    children: [
      {
        path: 'new',
        loadComponent: () => import('./components/tickets/new-ticket/new-ticket.component').then(m => m.NewTicketComponent),
        data: { roles: ['empleado'] },
        canActivate: [RoleGuard]
      },
      {
        path: 'my-tickets',
        loadComponent: () => import('./components/tickets/my-tickets/my-tickets.component').then(m => m.MyTicketsComponent),
        data: { roles: ['tecnico', 'administrador'] },
        canActivate: [RoleGuard]
      },
      {
        path: 'tracking',
        loadComponent: () => import('./components/tickets/ticket-tracking/ticket-tracking.component').then(m => m.TicketTrackingComponent),
        data: { roles: ['empleado'] },
        canActivate: [RoleGuard]
      },
      {
        path: 'reopened',
        loadComponent: () => import('./components/tickets/reopened-tickets/reopened-tickets.component').then(m => m.ReopenedTicketsComponent),
        data: { roles: ['empleado', 'tecnico', 'administrador'] },
        canActivate: [RoleGuard]
      },
      {
        path: 'assigned',
        loadComponent: () => import('./components/tickets/assigned-tickets/assigned-tickets.component').then(m => m.AssignedTicketsComponent),
        data: { roles: ['tecnico'] },
        canActivate: [RoleGuard]
      },
      {
        path: 'all',
        loadComponent: () => import('./components/tickets/all-tickets/all-tickets.component').then(m => m.AllTicketsComponent),
        data: { roles: ['administrador', 'tecnico'] },
        canActivate: [RoleGuard]
      },
      {
        path: 'escalated',
        loadComponent: () => import('./components/tickets/escalated-tickets/escalated-tickets.component').then(m => m.EscalatedTicketsComponent),
        data: { roles: ['tecnico', 'administrador'] },
        canActivate: [RoleGuard]
      },
      {
        path: 'close',
        loadComponent: () => import('./components/tickets/close-ticket/close-ticket.component').then(m => m.CloseTicketComponent),
        data: { roles: ['empleado'] },
        canActivate: [RoleGuard]
      },
      {
        path: 'summary',
        loadComponent: () => import('./components/tickets/ticket-summary/ticket-summary.component').then(m => m.TicketSummaryComponent),
        data: { roles: ['empleado'] },
        canActivate: [RoleGuard]
      }
    ]
  },
  {
    path: 'services',
    canActivate: [AuthGuard],
    children: [
      {
        path: 'catalog',
        loadComponent: () => import('./components/services/service-catalog/service-catalog.component').then(m => m.ServiceCatalogComponent)
      },
      {
        path: 'manage',
        loadComponent: () => import('./components/services/manage-services/manage-services.component').then(m => m.ManageServicesComponent),
        data: { roles: ['administrador'] },
        canActivate: [RoleGuard]
      }
    ]
  },
  {
    path: 'users',
    loadComponent: () => import('./components/users/manage-users/manage-users.component').then(m => m.ManageUsersComponent),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['administrador'] }
  },
  {
    path: 'assignments',
    loadComponent: () => import('./components/assignments/manage-assignments/manage-assignments.component').then(m => m.ManageAssignmentsComponent),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['administrador'] }
  },
  {
    path: 'profile',
    loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'policies',
    loadComponent: () => import('./components/policies/policies.component').then(m => m.PoliciesComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'reports',
    loadComponent: () => import('./components/reports/reports.component').then(m => m.ReportsComponent),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['administrador'] }
  },
  {
    path: '**',
    redirectTo: '/profile'
  }
];
