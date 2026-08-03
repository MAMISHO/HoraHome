import { Component, OnInit } from '@angular/core';
import { ToastController, ViewWillEnter } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DatabaseService } from '../core/services/database.service';
import { LanguageService, SupportedLanguage } from '../core/services/language.service';
import { GoogleAuthService } from '../core/services/google-auth.service';
import { GoogleDriveService } from '../core/services/google-drive.service';
import { SyncManagerService } from '../core/services/sync-manager.service';
import { Client } from '../core/entities/client.entity';

@Component({
  selector: 'app-reports-settings',
  templateUrl: './reports-settings.page.html',
  styleUrls: ['./reports-settings.page.scss'],
  standalone: false,
})
export class ReportsSettingsPage implements OnInit, ViewWillEnter {
  currentLang: SupportedLanguage = 'es';
  currentUser;

  periodType: 'today' | 'week' | 'month' | 'year' | 'custom' = 'month';
  customStartDate = new Date().toISOString().split('T')[0];
  customEndDate = new Date().toISOString().split('T')[0];

  filterClientId = '';
  clients: Client[] = [];

  totalHours = 0;
  estimatedEarnings = 0;
  serviceSubtotals: { name: string; hours: number }[] = [];

  isSyncing = false;
  syncProgress = 0;
  lastBackupTime: string | null = null;
  avatarFailed = false;

  onAvatarError(): void {
    this.avatarFailed = true;
  }

  constructor(
    private dbService: DatabaseService,
    private langService: LanguageService,
    private authService: GoogleAuthService,
    private driveService: GoogleDriveService,
    private syncManager: SyncManagerService,
    private toastCtrl: ToastController,
    private translate: TranslateService
  ) {
    this.currentUser = this.authService.currentUser;
  }

  async ngOnInit(): Promise<void> {
    this.currentLang = this.langService.getCurrentLanguage();
    await this.generateReport();
  }

  async ionViewWillEnter(): Promise<void> {
    this.currentLang = this.langService.getCurrentLanguage();
    this.lastBackupTime = this.driveService.lastBackupTimestamp();
    await this.generateReport();
  }

  async onLanguageChange(event: any): Promise<void> {
    const lang = event.detail.value as SupportedLanguage;
    this.currentLang = lang;
    await this.langService.setLanguage(lang);
  }

  async generateReport(): Promise<void> {
    if (!this.dbService.isReady()) return;

    this.clients = await this.dbService.clientRepo.find({ order: { name: 'ASC' } });

    const { startDate, endDate } = this.calculateDateRange();

    let query = this.dbService.workLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.client', 'client')
      .leftJoinAndSelect('log.service', 'service')
      .where('log.workDate >= :start AND log.workDate <= :end', {
        start: startDate,
        end: endDate,
      });

    if (this.filterClientId) {
      query = query.andWhere('client.id = :clientId', { clientId: this.filterClientId });
    }

    const logs = await query.getMany();

    this.totalHours = Math.round(logs.reduce((sum, l) => sum + Number(l.hours), 0) * 10) / 10;

    // Financial Estimation: Hours * Client Hourly Rate
    const earnings = logs.reduce((sum, l) => {
      const rate = Number(l.client.hourlyRate) || 0;
      return sum + Number(l.hours) * rate;
    }, 0);
    this.estimatedEarnings = Math.round(earnings * 100) / 100;

    // Subtotals per service
    const subMap = new Map<string, number>();
    logs.forEach((l) => {
      const curr = subMap.get(l.service.name) || 0;
      subMap.set(l.service.name, curr + Number(l.hours));
    });

    this.serviceSubtotals = Array.from(subMap.entries()).map(([name, hours]) => ({
      name,
      hours: Math.round(hours * 10) / 10,
    }));
  }

  calculateDateRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];

    if (this.periodType === 'today') {
      return { startDate: todayIso, endDate: todayIso };
    }

    if (this.periodType === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: monday.toISOString().split('T')[0],
        endDate: sunday.toISOString().split('T')[0],
      };
    }

    if (this.periodType === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }

    if (this.periodType === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }

    // Custom
    return {
      startDate: this.customStartDate,
      endDate: this.customEndDate,
    };
  }

  async signIn(): Promise<void> {
    try {
      await this.authService.signIn();
      this.showToast(this.translate.instant('CLOUD_SYNC.SIGNIN_SUCCESS') || 'Sesión iniciada con Google', 'success');
    } catch (err: any) {
      console.error('Error signing in:', err);
      const msg = err?.message || err?.error || 'Error al iniciar sesión con Google';
      this.showToast(msg, 'danger');
    }
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
  }

  async backupNow(): Promise<void> {
    this.isSyncing = true;
    this.syncProgress = 0;
    try {
      await this.syncManager.syncAll((progress) => {
        this.syncProgress = progress;
      });
      this.lastBackupTime = this.driveService.lastBackupTimestamp();
      this.showToast(this.translate.instant('CLOUD_SYNC.BACKUP_SUCCESS'), 'success');
    } catch (err: any) {
      console.error(err);
      const detail = err?.message || err?.error?.error?.message || '';
      const msg = `${this.translate.instant('CLOUD_SYNC.BACKUP_ERROR')}${detail ? ': ' + detail : ''}`;
      this.showToast(msg, 'danger');
    } finally {
      this.isSyncing = false;
      this.syncProgress = 0;
    }
  }

  async restoreData(): Promise<void> {
    this.isSyncing = true;
    try {
      await this.driveService.downloadBackup();
      await this.generateReport();
      this.showToast(this.translate.instant('CLOUD_SYNC.RESTORE_SUCCESS'), 'success');
    } catch (err: any) {
      console.error(err);
      const detail = err?.message || err?.error?.error?.message || '';
      const msg = `${this.translate.instant('CLOUD_SYNC.RESTORE_ERROR')}${detail ? ': ' + detail : ''}`;
      this.showToast(msg, 'danger');
    } finally {
      this.isSyncing = false;
    }
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
    });
    await toast.present();
  }
}
