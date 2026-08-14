import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { GoogleDriveService } from './google-drive.service';
import { ExcelExportService } from './excel-export.service';
import { GoogleAuthService } from './google-auth.service';
import { WorkLog } from '../entities/work-log.entity';
import { Client } from '../entities/client.entity';
import { Service } from '../entities/service.entity';
import { Preferences } from '@capacitor/preferences';

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
  async syncAll(onProgress?: (progress: number) => void, isManual = false): Promise<void> {
    if (this.isSyncing) return;

    if (!this.dbService.isReady()) {
      console.warn('[SyncManagerService] Database is not initialized yet. Skipping syncAll.');
      return;
    }

    if (onProgress) onProgress(0.05);

    // Verificar si el usuario está autenticado en Google
    const token = await this.authService.getAccessToken().catch(() => null);
    if (!token) {
      if (isManual) {
        throw new Error('Sincronización cancelada: No se pudo obtener el token de Google.');
      }
      console.warn('[SyncManagerService] Token de Google no disponible. Omitiendo sincronización de fondo.');
      return;
    }

    // EVITAR MACHACAR LA NUBE EN EL PRIMER SYNC DE FONDO
    // Si es automático y no manual, y el dispositivo nunca completó una copia exitosa en esta instalación,
    // pero ya hay un archivo en Drive, abortamos para no pisarlo con los datos actuales.
    if (!isManual) {
      const { value: lastBackup } = await Preferences.get({ key: 'horahome_last_backup_timestamp' });
      if (!lastBackup) {
        const fileMeta = await this.driveService.findFileMetadata(token, 'db_horahome.db', undefined, true);
        if (fileMeta && fileMeta.id) {
          console.warn('[SyncManagerService] Sincronización automática de fondo cancelada para evitar sobreescribir el backup de la nube.');
          this.driveService.checkAndPromptRestore();
          return;
        }
      }
    }

    this.isSyncing = true;
    console.log('[SyncManagerService] Iniciando sincronización en segundo plano…');
    if (onProgress) onProgress(0.1);

    try {
      // 0. Prevenir sobreescritura de backup más reciente en la nube
      const conflict = await this.driveService.hasConflict(token);
      if (conflict) {
        console.warn('[SyncManagerService] Conflicto detectado: la nube es más reciente. Sincronización cancelada.');
        this.driveService.checkAndPromptRestore();
        return;
      }

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
   * Maneja la sincronización inteligente inmediatamente después del inicio de sesión.
   * Si la app está vacía (instalación limpia), descarga la copia de seguridad sin preguntar.
   * Si ya tiene registros, corre el chequeo de conflictos habitual.
   */
  async handlePostLoginSync(): Promise<void> {
    const token = await this.authService.getAccessToken();
    if (!token) return;

    if (!this.dbService.isReady()) return;

    const logsCount = await this.dbService.workLogRepo.count();
    const clientsCount = await this.dbService.clientRepo.count();
    const isEmpty = logsCount === 0 && clientsCount === 0;

    if (isEmpty) {
      // Buscar si existe un respaldo en Drive
      const fileMeta = await this.driveService.findFileMetadata(token, 'db_horahome.db', undefined, true);
      const hasBackup = !!(fileMeta && fileMeta.id);

      if (hasBackup) {
        console.log('[SyncManagerService] Dispositivo limpio detectado. Ejecutando restauración automática…');
        // Descargar la copia de la nube usando el loader bloqueante
        await this.driveService.downloadBackup(true);
        // Recargar la ventana para re-inicializar SQLite
        window.location.reload();
        return;
      }
    }

    // Si ya hay datos locales, ejecutar verificación de conflictos estándar
    await this.driveService.checkAndPromptRestore();
  }

  /**
   * Fusiona los datos locales en memoria con la base de datos recién descargada/restaurada.
   * Utiliza UUIDs para evitar colisiones y realiza un fuzzy matching de nombres para clientes.
   */
  async mergeLocalData(
    localData: LocalBackupData,
    onPromptClientMatch: (localName: string, cloudName: string) => Promise<boolean>
  ): Promise<MergeResult> {
    const clientIdMap = new Map<string, string>();
    const serviceIdMap = new Map<string, string>();
    
    let insertedLogsCount = 0;
    let skippedDuplicatesCount = 0;
    const conflicts: Array<{ clientName: string; date: string; time: string }> = [];

    // 1. Fusión de Servicios
    const cloudServices = await this.dbService.serviceRepo.find();
    for (const ls of localData.services) {
      const match = cloudServices.find(
        (cs) => cs.name.trim().toLowerCase() === ls.name.trim().toLowerCase()
      );
      if (match) {
        serviceIdMap.set(ls.id, match.id);
      } else {
        const saved = await this.dbService.serviceRepo.save(ls);
        serviceIdMap.set(ls.id, saved.id);
        cloudServices.push(saved);
      }
    }

    // 2. Fusión de Clientes
    const cloudClients = await this.dbService.clientRepo.find();
    for (const lc of localData.clients) {
      const localNorm = lc.name.trim().toLowerCase();
      
      // Buscar candidatos por subcadena (fuzzy matching bidireccional)
      const candidates = cloudClients.filter((cc) => {
        const cloudNorm = cc.name.trim().toLowerCase();
        return cloudNorm.includes(localNorm) || localNorm.includes(cloudNorm);
      });

      let matchedClientId: string | null = null;

      for (const candidate of candidates) {
        // Preguntar al usuario de forma interactiva (asíncrona)
        const isSame = await onPromptClientMatch(lc.name, candidate.name);
        if (isSame) {
          matchedClientId = candidate.id;
          break;
        }
      }

      if (matchedClientId) {
        clientIdMap.set(lc.id, matchedClientId);
      } else {
        // Si no se vincula, se guarda como un nuevo registro
        const saved = await this.dbService.clientRepo.save(lc);
        clientIdMap.set(lc.id, saved.id);
        cloudClients.push(saved);
      }
    }

    // 3. Fusión de Registros de Horas
    const cloudLogs = await this.dbService.workLogRepo.find({
      relations: { client: true, service: true },
    });

    for (const lw of localData.workLogs) {
      const mappedClientId = clientIdMap.get(lw.client.id);
      const mappedServiceId = serviceIdMap.get(lw.service.id);

      if (!mappedClientId || !mappedServiceId) continue;

      const clientObj = await this.dbService.clientRepo.findOneBy({ id: mappedClientId });
      const serviceObj = await this.dbService.serviceRepo.findOneBy({ id: mappedServiceId });

      if (!clientObj || !serviceObj) continue;

      // Chequear duplicado exacto
      const isDuplicate = cloudLogs.some(
        (cl) =>
          cl.client.id === mappedClientId &&
          cl.workDate === lw.workDate &&
          cl.startTime === lw.startTime &&
          cl.endTime === lw.endTime &&
          cl.hours === lw.hours
      );

      if (isDuplicate) {
        skippedDuplicatesCount++;
        continue;
      }

      // Chequear solapamiento de horas en la misma fecha
      let hasOverlap = false;
      if (lw.startTime && lw.endTime) {
        hasOverlap = cloudLogs.some((cl) => {
          if (cl.client.id !== mappedClientId || cl.workDate !== lw.workDate) return false;
          if (!cl.startTime || !cl.endTime) return false;
          
          return lw.startTime! < cl.endTime && lw.endTime! > cl.startTime;
        });
      }

      if (hasOverlap) {
        conflicts.push({
          clientName: clientObj.name,
          date: lw.workDate,
          time: lw.startTime && lw.endTime ? `${lw.startTime} - ${lw.endTime}` : 'Horario solapado',
        });
        continue;
      }

      // Guardar el registro
      lw.client = clientObj;
      lw.service = serviceObj;
      await this.dbService.workLogRepo.save(lw);
      cloudLogs.push(lw);
      insertedLogsCount++;
    }

    return {
      insertedLogsCount,
      skippedDuplicatesCount,
      conflicts,
    };
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

export interface LocalBackupData {
  clients: Client[];
  services: Service[];
  workLogs: WorkLog[];
}

export interface MergeResult {
  insertedLogsCount: number;
  skippedDuplicatesCount: number;
  conflicts: Array<{
    clientName: string;
    date: string;
    time: string;
  }>;
}
