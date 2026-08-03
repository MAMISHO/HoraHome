import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { GoogleDriveService } from './google-drive.service';
import { ExcelExportService } from './excel-export.service';
import { GoogleAuthService } from './google-auth.service';
import { WorkLog } from '../entities/work-log.entity';

@Injectable({ providedIn: 'root' })
export class SyncManagerService {
  private isSyncing = false;

  constructor(
    private dbService: DatabaseService,
    private driveService: GoogleDriveService,
    private excelService: ExcelExportService,
    private authService: GoogleAuthService
  ) {}

  /**
   * Ejecuta la sincronización en segundo plano (non-blocking).
   * Genera los reportes Excel y realiza el backup de base de datos dual.
   */
  async syncAll(onProgress?: (progress: number) => void): Promise<void> {
    if (this.isSyncing) return;

    if (onProgress) onProgress(0.05);

    // Verificar si el usuario está autenticado en Google
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('Sincronización cancelada: No se pudo obtener el token de Google. Por favor, cierra sesión e inicia sesión de nuevo para aceptar los nuevos permisos.');
    }

    this.isSyncing = true;
    console.log('[SyncManagerService] Iniciando sincronización en segundo plano…');
    if (onProgress) onProgress(0.1);

    try {
      // 1. Ejecutar copia de seguridad dual de la base de datos SQLite
      if (onProgress) onProgress(0.15);
      await this.driveService.uploadBackup();
      console.log('[SyncManagerService] Backup de base de datos dual completado.');
      if (onProgress) onProgress(0.35);

      // 2. Obtener todos los logs de trabajo
      if (!this.dbService.isReady()) {
        throw new Error('La base de datos no está inicializada.');
      }

      const logs = await this.dbService.workLogRepo.find({
        relations: {
          client: true,
          service: true,
        },
        order: { workDate: 'ASC' },
      });
      if (onProgress) onProgress(0.4);

      // 3. Agrupar logs por Año -> Mes -> Cliente
      const groups = this.groupLogs(logs);

      // 4. Crear estructura de carpetas y subir excels
      const rootFolderId = await this.driveService.getOrCreateFolder(token, 'HoraHomeApp');
      if (onProgress) onProgress(0.5);

      // Contar el total de subidas de excels para calcular incrementos
      let totalUploads = 0;
      for (const year of Object.keys(groups)) {
        for (const month of Object.keys(groups[year])) {
          totalUploads += Object.keys(groups[year][month]).length;
        }
      }

      let uploadedCount = 0;
      for (const year of Object.keys(groups)) {
        const yearFolderId = await this.driveService.getOrCreateFolder(token, year, rootFolderId);

        for (const month of Object.keys(groups[year])) {
          const monthFolderId = await this.driveService.getOrCreateFolder(token, month, yearFolderId);

          for (const clientId of Object.keys(groups[year][month])) {
            const clientGroup = groups[year][month][clientId];
            const clientName = clientGroup.clientName;
            const clientLogs = clientGroup.logs;

            // Generar archivo Excel
            const excelBlob = this.excelService.generateClientMonthExcel(clientName, year, month, clientLogs);
            const filename = `${clientName.replace(/[\/\\?%*:|"<>]/g, '_')}.xlsx`;

            // Subir o actualizar Excel en la carpeta del mes
            await this.driveService.uploadOrUpdateFile(token, excelBlob, filename, monthFolderId, false);
            
            uploadedCount++;
            if (onProgress && totalUploads > 0) {
              onProgress(0.5 + (uploadedCount / totalUploads) * 0.5);
            }
          }
        }
      }

      if (onProgress) onProgress(1.0);
      console.log('[SyncManagerService] Sincronización de reportes Excel completada exitosamente.');
    } catch (error) {
      console.error('[SyncManagerService] Error durante la sincronización:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Lanza la sincronización sin esperar (fire and forget) para no bloquear la UI.
   */
  syncInBackground(): void {
    this.syncAll().catch((err) => {
      console.warn('[SyncManagerService] Omitiendo syncInBackground:', err?.message || err);
    });
  }

  /**
   * Agrupa los registros de trabajo por Año, Mes y Cliente.
   */
  private groupLogs(logs: WorkLog[]): any {
    const groups: any = {};

    logs.forEach((log) => {
      if (!log.workDate || !log.client) return;

      const year = log.workDate.substring(0, 4); // YYYY
      const month = log.workDate.substring(5, 7); // MM
      const clientId = log.client.id;
      const clientName = log.client.name;

      if (!groups[year]) {
        groups[year] = {};
      }
      if (!groups[year][month]) {
        groups[year][month] = {};
      }
      if (!groups[year][month][clientId]) {
        groups[year][month][clientId] = {
          clientName,
          logs: [],
        };
      }

      groups[year][month][clientId].logs.push(log);
    });

    return groups;
  }
}
