import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { GoogleAuthService } from './google-auth.service';
import { DatabaseService } from './database.service';
import { lastValueFrom } from 'rxjs';

const BACKUP_FILENAME = 'db_horahome.db';
const LAST_BACKUP_KEY = 'horahome_last_backup_timestamp';

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  readonly lastBackupTimestamp = signal<string | null>(null);

  constructor(
    private http: HttpClient,
    private authService: GoogleAuthService,
    private dbService: DatabaseService
  ) {
    this.loadLastBackupTimestamp();
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
    await this.uploadOrUpdateFile(token, fileBlob, BACKUP_FILENAME, undefined, true);

    // 3. Subida 2: En carpeta visible "HoraHomeApp" en la raíz del Drive del usuario
    const rootFolderId = await this.getOrCreateFolder(token, 'HoraHomeApp');
    await this.uploadOrUpdateFile(token, fileBlob, BACKUP_FILENAME, rootFolderId, false);

    const nowIso = new Date().toISOString();
    await Preferences.set({ key: LAST_BACKUP_KEY, value: nowIso });
    this.lastBackupTimestamp.set(nowIso);

    return true;
  }

  async downloadBackup(): Promise<boolean> {
    let token = await this.authService.getAccessToken();
    if (!token) {
      const user = await this.authService.signIn().catch(() => null);
      token = user?.accessToken || null;
    }

    if (!token) {
      throw new Error('No se pudo obtener el token de autenticación de Google.');
    }

    // Restaurar desde la appDataFolder (el backup oculto y seguro de la app)
    const fileId = await this.findFileId(token, BACKUP_FILENAME, undefined, true);
    if (!fileId) {
      throw new Error('No se encontró ninguna copia de seguridad en la carpeta de la app.');
    }

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

    // Re-inicializar base de datos
    await this.dbService.initialize();
    return true;
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
  ): Promise<string> {
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

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    if (isAppData) {
      url += '&spaces=appDataFolder';
    }

    let method: 'POST' | 'PATCH' = 'POST';
    if (existingFileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
      method = 'PATCH';
    }

    const response: any = await lastValueFrom(
      method === 'POST'
        ? this.http.post(url, formData, { headers })
        : this.http.patch(url, formData, { headers })
    );

    return response.id;
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
