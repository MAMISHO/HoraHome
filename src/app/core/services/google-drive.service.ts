import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
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
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('User not authenticated');
    }

    // 1. Check if backup file already exists in appDataFolder
    const existingFileId = await this.findBackupFileId(token);

    // 2. Read local database file content via Filesystem or Capacitor SQLite
    const fileResult = await Filesystem.readFile({
      path: `Databases/${BACKUP_FILENAME}`,
      directory: Directory.Library,
    }).catch(async () => {
      // Fallback path attempt for Android Capacitor SQLite
      return await Filesystem.readFile({
        path: `../databases/${BACKUP_FILENAME}`,
        directory: Directory.Data,
      });
    });

    const fileBlob = new Blob([fileResult.data], { type: 'application/x-sqlite3' });

    // 3. Prepare multipart upload or update
    const metadata = {
      name: BACKUP_FILENAME,
      parents: existingFileId ? undefined : ['appDataFolder'],
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

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&spaces=appDataFolder';
    let method: 'POST' | 'PATCH' = 'POST';

    if (existingFileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
      method = 'PATCH';
    }

    if (method === 'POST') {
      await lastValueFrom(this.http.post(url, formData, { headers }));
    } else {
      await lastValueFrom(this.http.patch(url, formData, { headers }));
    }

    const nowIso = new Date().toISOString();
    await Preferences.set({ key: LAST_BACKUP_KEY, value: nowIso });
    this.lastBackupTimestamp.set(nowIso);

    return true;
  }

  async downloadBackup(): Promise<boolean> {
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('User not authenticated');
    }

    const fileId = await this.findBackupFileId(token);
    if (!fileId) {
      throw new Error('No backup file found on Google Drive');
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const arrayBuffer = await lastValueFrom(
      this.http.get(downloadUrl, { headers, responseType: 'arraybuffer' })
    );

    // Save downloaded file back to local database path
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    await Filesystem.writeFile({
      path: `Databases/${BACKUP_FILENAME}`,
      directory: Directory.Library,
      data: base64Data,
    }).catch(async () => {
      await Filesystem.writeFile({
        path: `../databases/${BACKUP_FILENAME}`,
        directory: Directory.Data,
        data: base64Data,
      });
    });

    // Re-initialize database connection
    await this.dbService.initialize();
    return true;
  }

  private async findBackupFileId(token: string): Promise<string | null> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    const queryUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}' and trashed=false`;
    const response: any = await lastValueFrom(this.http.get(queryUrl, { headers }));

    if (response.files && response.files.length > 0) {
      return response.files[0].id;
    }
    return null;
  }

  private async loadLastBackupTimestamp(): Promise<void> {
    const { value } = await Preferences.get({ key: LAST_BACKUP_KEY });
    if (value) {
      this.lastBackupTimestamp.set(value);
    }
  }
}
