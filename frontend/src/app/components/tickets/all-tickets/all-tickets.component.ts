import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-all-tickets',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Todos los Tickets</h1>
      <p>Esta funcionalidad estará disponible próximamente para administradores y técnicos.</p>
      <button class="btn btn-primary" (click)="goBack()">← Volver al Dashboard</button>
    </div>
  `,
  styles: [`
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      text-align: center;
    }
    h1 { color: #333; margin-bottom: 20px; }
    p { color: #666; margin-bottom: 30px; font-size: 1.1rem; }
    .btn {
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      text-decoration: none;
      display: inline-block;
    }
  `]
})
export class AllTicketsComponent {
  goBack() {
    window.history.back();
  }
}
