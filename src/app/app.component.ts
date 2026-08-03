import { Component, OnInit } from '@angular/core';
import { SyncManagerService } from './core/services/sync-manager.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(private syncManager: SyncManagerService) {}

  ngOnInit(): void {
    // Iniciar sincronización de base de datos y Excels en segundo plano al arrancar
    this.syncManager.syncInBackground();
  }
}
