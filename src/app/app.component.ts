import { Component, OnInit } from '@angular/core';
import { SyncManagerService } from './core/services/sync-manager.service';

import { App } from '@capacitor/app';
import { BackgroundTask } from '@capawesome/capacitor-background-task';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(private syncManager: SyncManagerService) {
    App.addListener('appStateChange', async (state) => {
      if (!state.isActive) {
        // Solicitar tiempo extra de procesamiento en segundo plano al OS
        const taskId = await BackgroundTask.beforeExit(async () => {
          try {
            await this.syncManager.syncAll();
          } catch (err) {
            console.error('[AppComponent] Error en background sync:', err);
          } finally {
            // Notificar al OS que la tarea ha finalizado
            await BackgroundTask.finish({ taskId });
          }
        });
      }
    });
  }

  ngOnInit(): void {
    // Iniciar sincronización de base de datos y Excels en segundo plano al arrancar
    this.syncManager.syncInBackground();
  }
}
