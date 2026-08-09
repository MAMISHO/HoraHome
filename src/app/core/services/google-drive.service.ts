import { Injectable, signal, Injector } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { AlertController, LoadingController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { GoogleAuthService } from './google-auth.service';
import { DatabaseService } from './database.service';
import { SyncManagerService } from './sync-manager.service';
import { lastValueFrom } from 'rxjs';

const BACKUP_FILENAME = 'db_horahome.db';
const LAST_BACKUP_KEY = 'horahome_last_backup_timestamp';

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  readonly lastBackupTimestamp = signal<string | null>(null);

  constructor(
    private http: HttpClient,
    private authService: GoogleAuthService,
    private dbService: DatabaseService,
    private alertCtrl: AlertController,
    private translate: TranslateService,
    private loadingCtrl: LoadingController,
    private injector: Injector
  ) {
    this.loadLastBackupTimestamp();
  }

  async checkAndPromptRestore(): Promise<void> {
    let token = await this.authService.getAccessToken();
    if (!token) return; // Silent return if not logged in

    const fileMeta = await this.findFileMetadata(token, BACKUP_FILENAME, undefined, true);
    if (!fileMeta || !fileMeta.modifiedTime) return;

    const { value: localDbLastUpdate } = await Preferences.get({ key: 'local_db_last_update' });
    const { value: lastBackup } = await Preferences.get({ key: LAST_BACKUP_KEY });

    // Compare dates. If Drive is newer than local DB by more than 5 seconds (tolerance threshold) or if it's the first sync on this device.
    const driveTime = new Date(fileMeta.modifiedTime).getTime();
    const localTime = localDbLastUpdate ? new Date(localDbLastUpdate).getTime() : 0;
    const isFirstSync = !lastBackup;

    if (driveTime > localTime + 5000 || isFirstSync) {
      const formattedLocal = this.formatDate(localDbLastUpdate);
      const formattedDrive = this.formatDate(fileMeta.modifiedTime);
      const isDriveNewer = driveTime > localTime + 5000;

      const header = isDriveNewer
        ? (this.translate.instant('COMMON.NEWER_BACKUP_FOUND') || 'Copia de seguridad reciente')
        : (this.translate.instant('COMMON.BACKUP_FOUND') || 'Copia de seguridad encontrada');

      const message = isDriveNewer
        ? (this.translate.instant('COMMON.RESTORE_PROMPT_NEWER', {
            localTime: formattedLocal,
            cloudTime: formattedDrive
          }) || `Hay una copia de seguridad en la nube más reciente que la de tu dispositivo.\n\n• En la nube: ${formattedDrive}\n• En tu dispositivo: ${formattedLocal}\n\n¿Deseas restaurar la copia de la nube?`)
        : (this.translate.instant('COMMON.RESTORE_PROMPT_FIRST', {
            localTime: formattedLocal,
            cloudTime: formattedDrive
          }) || `Se encontró una copia de seguridad en la nube. Puedes restaurarla para recuperar tus datos históricos.\n\n• En la nube: ${formattedDrive}\n• En tu dispositivo: ${formattedLocal}\n\n¿Deseas restaurar la copia de la nube?`);

      const alert = await this.alertCtrl.create({
        header,
        message,
        buttons: [
          {
            text: this.translate.instant('COMMON.CANCEL') || 'Cancelar',
            role: 'cancel'
          },
          {
            text: this.translate.instant('COMMON.RESTORE') || 'Restaurar',
            handler: () => {
              this.executeConflictRestore(token!);
            }
          }
        ]
      });
      await alert.present();
    }
  }

  private formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) {
      return this.translate.instant('CLOUD_SYNC.NEVER') || 'Nunca';
    }
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  }

  async hasConflict(token: string): Promise<boolean> {
    const fileMeta = await this.findFileMetadata(token, BACKUP_FILENAME, undefined, true);
    if (!fileMeta || !fileMeta.modifiedTime) return false;

    const { value: localDbLastUpdate } = await Preferences.get({ key: 'local_db_last_update' });
    const driveTime = new Date(fileMeta.modifiedTime).getTime();
    const localTime = localDbLastUpdate ? new Date(localDbLastUpdate).getTime() : 0;

    // Margen de tolerancia de 5 segundos para evitar falsos positivos por latencia de subida
    return driveTime > localTime + 5000;
  }

  private async executeConflictRestore(token: string): Promise<void> {
    const loading = await this.loadingCtrl.create({
      message: this.translate.instant('COMMON.RESTORING') || 'Restaurando copia de seguridad…',
      backdropDismiss: false
    });
    await loading.present();

    try {
      // 1. Backup local to visible folder
      const base64Data = await this.readDatabaseFileBase64();
      if (base64Data) {
        const byteArray = this.base64ToUint8Array(base64Data);
        const fileBlob = new Blob([byteArray.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
        
        const rootFolderId = await this.getOrCreateFolder(token, 'HoraHomeApp');
        const conflictFolderId = await this.getOrCreateFolder(token, 'Conflict_Backups', rootFolderId);
        const backupName = `db_backup_${new Date().toISOString().split('T')[0]}.db`;
        
        await this.uploadOrUpdateFile(token, fileBlob, backupName, conflictFolderId, false);
      }

      // 2. Download from cloud (se desactiva su loader interno para no duplicarlo)
      await this.downloadBackup(false);

      // 3. Reload window to reinitialize SQLite cleanly
      window.location.reload();
    } catch (err) {
      console.error('Error in executeConflictRestore:', err);
      await loading.dismiss();
    }
  }

  async uploadBackup(): Promise<boolean> {
    let token = await this.authService.getAccessToken();
    if (!token) {
      const user = await this.authService.signIn().catch(() => null);
      token = user?.accessToken || null;
    }

    if (!token) {
      throw new Error('No se pudo obtener el token de autenticación de Google.');
    }

    // 1. Leer los datos de la base de datos local
    const base64Data = await this.readDatabaseFileBase64();
    if (!base64Data) {
      throw new Error('No se pudo leer el archivo de la base de datos local.');
    }

    const byteArray = this.base64ToUint8Array(base64Data);
    const fileBlob = new Blob([byteArray.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });

    // 2. Subida 1: En carpeta oculta (appDataFolder) para restauración segura de la app
    const appDataFileMeta = await this.uploadOrUpdateFile(token, fileBlob, BACKUP_FILENAME, undefined, true);

    // 3. Subida 2: En carpeta visible "HoraHomeApp" en la raíz del Drive del usuario
    const rootFolderId = await this.getOrCreateFolder(token, 'HoraHomeApp');
    await this.uploadOrUpdateFile(token, fileBlob, BACKUP_FILENAME, rootFolderId, false);

    // Sincronizar la marca local con el modifiedTime exacto retornado por Drive para evitar diferencias de milisegundos
    if (appDataFileMeta && appDataFileMeta.modifiedTime) {
      await Preferences.set({ key: 'local_db_last_update', value: appDataFileMeta.modifiedTime });
    } else {
      const nowIso = new Date().toISOString();
      await Preferences.set({ key: 'local_db_last_update', value: nowIso });
    }

    const nowIso = new Date().toISOString();
    await Preferences.set({ key: LAST_BACKUP_KEY, value: nowIso });
    this.lastBackupTimestamp.set(nowIso);

    return true;
  }

  async downloadBackup(showLoader: boolean = true): Promise<boolean> {
    let loading: any = null;
    if (showLoader) {
      loading = await this.loadingCtrl.create({
        message: this.translate.instant('COMMON.RESTORING') || 'Restaurando copia de seguridad…',
        backdropDismiss: false
      });
      await loading.present();
    }

    try {
      let token = await this.authService.getAccessToken();
      if (!token) {
        const user = await this.authService.signIn().catch(() => null);
        token = user?.accessToken || null;
      }

      if (!token) {
        throw new Error('No se pudo obtener el token de autenticación de Google.');
      }

      // 1. Leer los datos locales actuales para la fusión antes de cerrar la conexión
      let localData: any = null;
      try {
        const localClients = await this.dbService.clientRepo.find();
        const localServices = await this.dbService.serviceRepo.find();
        const localWorkLogs = await this.dbService.workLogRepo.find({ relations: { client: true, service: true } });
        localData = { clients: localClients, services: localServices, workLogs: localWorkLogs };
      } catch (err) {
        console.warn('[GoogleDriveService] No se pudieron precargar datos locales para fusión:', err);
      }

      // Restaurar desde la appDataFolder (el backup oculto y seguro de la app)
      const fileMeta = await this.findFileMetadata(token, BACKUP_FILENAME, undefined, true);
      if (!fileMeta || !fileMeta.id) {
        throw new Error('No se encontró ninguna copia de seguridad en la carpeta de la app.');
      }
      const fileId = fileMeta.id;

      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
      });

      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const arrayBuffer = await lastValueFrom(
        this.http.get(downloadUrl, { headers, responseType: 'arraybuffer' })
      );

      // Cerrar la conexión actual de la base de datos antes de sobreescribir el archivo SQLite
      await this.dbService.closeConnection();

      // Guardar el archivo descargado en la base de datos local
      const base64Data = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      await this.writeDatabaseFileBase64(base64Data);

      // Re-inicializar base de datos con los datos recién restaurados
      await this.dbService.initialize();

      // 2. Ejecutar fusión inteligente si había datos locales
      let mergeResult: any = null;
      if (localData && (localData.clients.length > 0 || localData.services.length > 0)) {
        // Descartar CUALQUIER loader activo en pantalla para liberar la UI para las modales interactivas
        await this.loadingCtrl.dismiss().catch(() => null);

        const onPromptClientMatch = async (localName: string, cloudName: string): Promise<boolean> => {
          return new Promise(async (resolve) => {
            const alert = await this.alertCtrl.create({
              header: this.translate.instant('MERGE.CLIENT_HEADER') || '¿Es el mismo cliente?',
              message: (this.translate.instant('MERGE.CLIENT_BODY', {
                localName,
                cloudName
              }) || `Hemos encontrado una coincidencia similar:\n\n• En tu dispositivo: "${localName}"\n• En la nube: "${cloudName}"\n\n¿Se trata del mismo cliente? Si confirmas, sus registros se fusionarán.`),
              backdropDismiss: false,
              buttons: [
                {
                  text: this.translate.instant('MERGE.NO_DIFFERENT') || 'No, es diferente',
                  role: 'cancel',
                  handler: () => resolve(false)
                },
                {
                  text: this.translate.instant('MERGE.YES_SAME') || 'Sí, es el mismo',
                  handler: () => resolve(true)
                }
              ]
            });
            await alert.present();
          });
        };

        const syncManager = this.injector.get(SyncManagerService);
        mergeResult = await syncManager.mergeLocalData(localData, onPromptClientMatch);

        // Volver a mostrar el loader si es necesario para completar la operación
        if (showLoader) {
          loading = await this.loadingCtrl.create({
            message: this.translate.instant('COMMON.RESTORING') || 'Restaurando copia de seguridad…',
            backdropDismiss: false
          });
          await loading.present();
        }
      }

      // Sincronizar el timestamp local con el del archivo que acabamos de descargar para evitar bucles de conflicto
      if (fileMeta && fileMeta.modifiedTime) {
        await Preferences.set({ key: 'local_db_last_update', value: fileMeta.modifiedTime });
        await Preferences.set({ key: LAST_BACKUP_KEY, value: fileMeta.modifiedTime });
        this.lastBackupTimestamp.set(fileMeta.modifiedTime);
      } else {
        const nowIso = new Date().toISOString();
        await Preferences.set({ key: LAST_BACKUP_KEY, value: nowIso });
        this.lastBackupTimestamp.set(nowIso);
      }

      // 3. Mostrar resumen de conflictos si hubo solapamiento
      if (mergeResult && mergeResult.conflicts.length > 0) {
        if (loading) await loading.dismiss();

        await new Promise<void>(async (resolve) => {
          const alert = await this.alertCtrl.create({
            header: this.translate.instant('MERGE.CONFLICTS_HEADER') || 'Registros omitidos',
            message: (this.translate.instant('MERGE.CONFLICTS_BODY', {
              count: mergeResult.conflicts.length
            }) || `Se restauró la copia de seguridad, pero se omitieron ${mergeResult.conflicts.length} registros locales debido a solapamiento de horarios (ya resguardados en Drive/Conflict_Backups).`),
            backdropDismiss: false,
            buttons: [
              {
                text: this.translate.instant('COMMON.OK') || 'Aceptar',
                handler: () => resolve()
              }
            ]
          });
          await alert.present();
        });
      }

      return true;
    } catch (error) {
      throw error;
    } finally {
      if (loading) {
        await loading.dismiss();
      }
    }
  }

  /**
   * Obtiene o crea una carpeta por nombre en Google Drive (área visible).
   */
  async getOrCreateFolder(token: string, name: string, parentId?: string): Promise<string> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    // Construir la consulta
    let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += ` and 'root' in parents`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
    const response: any = await lastValueFrom(this.http.get(url, { headers }));

    if (response?.files && response.files.length > 0) {
      return response.files[0].id;
    }

    // Crear carpeta si no existe
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const body = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    };

    const createResponse: any = await lastValueFrom(this.http.post(createUrl, body, { headers }));
    return createResponse.id;
  }

  /**
   * Sube o actualiza un archivo Blob en Drive (público o appDataFolder).
   */
  async uploadOrUpdateFile(
    token: string,
    fileBlob: Blob,
    filename: string,
    parentId?: string,
    isAppData: boolean = false
  ): Promise<{ id: string, modifiedTime: string }> {
    const existingFileId = await this.findFileId(token, filename, parentId, isAppData);

    const metadata = {
      name: filename,
      parents: isAppData ? (existingFileId ? undefined : ['appDataFolder']) : (existingFileId ? undefined : [parentId]),
    };

    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', fileBlob);

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime';
    if (isAppData) {
      url += '&spaces=appDataFolder';
    }

    let method: 'POST' | 'PATCH' = 'POST';
    if (existingFileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,modifiedTime`;
      method = 'PATCH';
    }

    const response: any = await lastValueFrom(
      method === 'POST'
        ? this.http.post(url, formData, { headers })
        : this.http.patch(url, formData, { headers })
    );

    return { id: response.id, modifiedTime: response.modifiedTime };
  }

  /**
   * Busca un archivo por nombre en Drive.
   */
  private async findFileId(
    token: string,
    name: string,
    parentId?: string,
    isAppData: boolean = false
  ): Promise<string | null> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    let query = `name='${name}' and trashed=false`;
    let url = 'https://www.googleapis.com/drive/v3/files?';

    if (isAppData) {
      url += 'spaces=appDataFolder&';
      query += " and 'appDataFolder' in parents";
    } else if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    url += `q=${encodeURIComponent(query)}`;
    const response: any = await lastValueFrom(this.http.get(url, { headers }));

    if (response?.files && response.files.length > 0) {
      return response.files[0].id;
    }
    return null;
  }

  async findFileMetadata(
    token: string,
    name: string,
    parentId?: string,
    isAppData: boolean = false
  ): Promise<{ id: string, modifiedTime: string } | null> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    let query = `name='${name}' and trashed=false`;
    let url = 'https://www.googleapis.com/drive/v3/files?fields=files(id,modifiedTime)&';

    if (isAppData) {
      url += 'spaces=appDataFolder&';
      query += " and 'appDataFolder' in parents";
    } else if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    url += `q=${encodeURIComponent(query)}`;
    const response: any = await lastValueFrom(this.http.get(url, { headers }));

    if (response?.files && response.files.length > 0) {
      return response.files[0];
    }
    return null;
  }

  private async readDatabaseFileBase64(): Promise<string | null> {
    const possiblePaths = [
      { path: '../databases/db_horahomeSQLite.db', directory: Directory.Data },
      { path: 'Databases/db_horahomeSQLite.db', directory: Directory.Library },
      { path: '../databases/db_horahome.db', directory: Directory.Data },
      { path: 'Databases/db_horahome.db', directory: Directory.Library },
      { path: 'db_horahomeSQLite.db', directory: Directory.Data },
      { path: 'db_horahome.db', directory: Directory.Data },
    ];

    for (const location of possiblePaths) {
      try {
        const result = await Filesystem.readFile({
          path: location.path,
          directory: location.directory,
        });

        if (result?.data) {
          if (typeof result.data === 'string') {
            return result.data;
          } else if (result.data instanceof Blob) {
            return await this.blobToBase64(result.data);
          }
        }
      } catch {
        // Continuar si no existe
      }
    }

    return null;
  }

  private async writeDatabaseFileBase64(base64Data: string): Promise<void> {
    const isAndroid = Capacitor.getPlatform() === 'android';
    const targetPath = isAndroid ? '../databases/db_horahomeSQLite.db' : `Databases/${BACKUP_FILENAME}`;
    const targetDir = isAndroid ? Directory.Data : Directory.Library;

    await Filesystem.writeFile({
      path: targetPath,
      directory: targetDir,
      data: base64Data,
    }).catch(async () => {
      await Filesystem.writeFile({
        path: BACKUP_FILENAME,
        directory: Directory.Data,
        data: base64Data,
      });
    });
  }

  private async loadLastBackupTimestamp(): Promise<void> {
    const { value } = await Preferences.get({ key: LAST_BACKUP_KEY });
    if (value) {
      this.lastBackupTimestamp.set(value);
    }
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.includes(',') ? res.split(',')[1] : res);
      };
      reader.readAsDataURL(blob);
    });
  }
}
