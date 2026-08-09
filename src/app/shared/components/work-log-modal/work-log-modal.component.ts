import { Component, Input, OnInit } from '@angular/core';
import { AlertController, ModalController, LoadingController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Client } from '../../../core/entities/client.entity';
import { Service } from '../../../core/entities/service.entity';
import { WorkLog } from '../../../core/entities/work-log.entity';
import { LanguageService } from '../../../core/services/language.service';
import { SyncManagerService } from '../../../core/services/sync-manager.service';

@Component({
  selector: 'app-work-log-modal',
  templateUrl: './work-log-modal.component.html',
  styleUrls: ['./work-log-modal.component.scss'],
  standalone: false,
})
export class WorkLogModalComponent implements OnInit {
  @Input() initialDate?: string;
  @Input() initialClientId?: string;
  @Input() workLog?: WorkLog;

  activeTab: 'list' | 'form' = 'form';
  isEdit = false;
  editingLogId: string | null = null;
  hasSavedChanges = false;

  workDate = new Date().toISOString().split('T')[0];
  selectedClientId = '';
  selectedServiceId = '';
  hours = 4.0;
  startTime = '09:00';
  endTime = '17:00';
  notes = '';
  isPaid = false;
  paymentType?: 'cash' | 'check';

  isHoliday = false;
  holidayName = '';

  dateLogs: WorkLog[] = [];
  activeClients: Client[] = [];
  services: Service[] = [];

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private dbService: DatabaseService,
    public langService: LanguageService,
    private translate: TranslateService,
    private syncManager: SyncManagerService
  ) { }

  get currentLang(): string {
    return this.langService.getCurrentLanguage();
  }

  get isToday(): boolean {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.workDate === todayStr;
  }

  async ngOnInit(): Promise<void> {
    await this.loadClientsAndServices();

    if (this.initialDate) {
      this.workDate = this.initialDate;
    }

    await this.loadDateLogs();

    if (this.workLog) {
      this.setupEditForm(this.workLog);
      this.activeTab = 'form';
    } else if (this.dateLogs.length > 0) {
      this.activeTab = 'list';
      this.resetForm();
    } else {
      this.activeTab = 'form';
      this.resetForm();
    }

    await this.checkHoliday();
  }

  async loadClientsAndServices(): Promise<void> {
    if (this.dbService.isReady()) {
      this.activeClients = await this.dbService.clientRepo.findBy({ isActive: true });
      this.services = await this.dbService.serviceRepo.find();
    }
  }

  async loadDateLogs(): Promise<void> {
    if (!this.dbService.isReady() || !this.workDate) return;
    this.dateLogs = await this.dbService.workLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.client', 'client')
      .leftJoinAndSelect('log.service', 'service')
      .where('log.workDate = :date', { date: this.workDate })
      .orderBy('log.createdAt', 'DESC')
      .getMany();
  }

  setupEditForm(log: WorkLog): void {
    this.isEdit = true;
    this.editingLogId = log.id;
    this.workDate = log.workDate;
    this.selectedClientId = log.client.id;
    this.selectedServiceId = log.service.id;
    this.hours = Number(log.hours);
    this.startTime = log.startTime || '09:00';
    this.endTime = log.endTime || this.calculateEndTime('09:00', this.hours);
    this.notes = log.notes || '';
    this.isPaid = log.isPaid || false;
    this.paymentType = log.paymentType;
  }

  resetForm(): void {
    this.isEdit = false;
    this.editingLogId = null;
    this.selectedClientId = ''; // El cliente no puede venir preseleccionado
    if (this.services.length > 0) {
      this.selectedServiceId = this.services[0].id;
    }
    this.hours = 4.0;

    // Buscar la hora de fin del anterior registro del mismo día
    let start = '09:00';
    if (this.dateLogs && this.dateLogs.length > 0) {
      const withEndTime = this.dateLogs.filter(l => l.endTime);
      if (withEndTime.length > 0) {
        const sorted = [...withEndTime].sort((a, b) => (a.endTime || '').localeCompare(b.endTime || ''));
        start = sorted[sorted.length - 1].endTime || '09:00';
      }
    }
    this.startTime = start;
    this.endTime = this.calculateEndTime(this.startTime, this.hours);
    this.notes = '';
    this.isPaid = false;
    this.paymentType = undefined;
  }

  isValidForm(): boolean {
    if (!this.selectedClientId) return false;
    if (!this.selectedServiceId) return false;
    if (!this.workDate) return false;
    if (!this.hours || this.hours < 0.5 || this.hours > 24.0) return false;
    if (!this.startTime || !this.endTime) return false;
    if (this.endTime <= this.startTime) return false;
    if (this.hasOverlap()) return false;
    return true;
  }

  hasOverlap(): boolean {
    if (!this.startTime || !this.endTime) return false;
    return this.dateLogs.some(log => {
      if (this.isEdit && log.id === this.editingLogId) return false;
      if (!log.startTime || !log.endTime) return false;
      return this.startTime < log.endTime && log.startTime < this.endTime;
    });
  }

  async onDateChange(): Promise<void> {
    await this.loadDateLogs();
    await this.checkHoliday();
    if (!this.isEdit) {
      let start = '09:00';
      if (this.dateLogs && this.dateLogs.length > 0) {
        const withEndTime = this.dateLogs.filter(l => l.endTime);
        if (withEndTime.length > 0) {
          const sorted = [...withEndTime].sort((a, b) => (a.endTime || '').localeCompare(b.endTime || ''));
          start = sorted[sorted.length - 1].endTime || '09:00';
        }
      }
      this.startTime = start;
      this.endTime = this.calculateEndTime(this.startTime, this.hours);
    }
  }

  startNewRegistration(): void {
    this.resetForm();
    this.activeTab = 'form';
  }

  startEditLog(log: WorkLog): void {
    this.setupEditForm(log);
    this.activeTab = 'form';
  }

  async confirmDeleteLog(log: WorkLog): Promise<void> {
    const msg = this.translate.instant('WORK_LOGS.DELETE_CONFIRM', {
      hours: log.hours,
      client: log.client.name,
    });

    const alert = await this.alertCtrl.create({
      header: this.translate.instant('WORK_LOGS.DELETE'),
      message: msg,
      buttons: [
        {
          text: this.translate.instant('WORK_LOGS.CANCEL'),
          role: 'cancel',
        },
        {
          text: this.translate.instant('WORK_LOGS.DELETE'),
          role: 'destructive',
          handler: async () => {
            await this.executeDeleteLog(log);
          },
        },
      ],
    });

    await alert.present();
  }

  private async executeDeleteLog(log: WorkLog): Promise<void> {
    if (this.dbService.isReady()) {
      await this.dbService.workLogRepo.remove(log);
      this.hasSavedChanges = true;
      await this.dbService.notifyWorkLogsChanged();
      this.syncManager.syncInBackground();
      await this.loadDateLogs();
      if (this.dateLogs.length === 0) {
        this.startNewRegistration();
      }
    }
  }

  async checkHoliday(): Promise<void> {
    if (!this.dbService.isReady()) return;
    const holiday = await this.dbService.holidayRepo.findOneBy({ holidayDate: this.workDate });
    if (holiday) {
      this.isHoliday = true;
      const lang = this.langService.getCurrentLanguage();
      this.holidayName = lang === 'en' ? holiday.nameNl : holiday.nameFr;
    } else {
      this.isHoliday = false;
      this.holidayName = '';
    }
  }

  onClientChange(): void {
    if (!this.isEdit && this.services.length > 0) {
      this.selectedServiceId = this.services[0].id;
    }
  }

  onTimeChange(): void {
    if (this.startTime && this.endTime) {
      const [sh, sm] = this.startTime.split(':').map(Number);
      const [eh, em] = this.endTime.split(':').map(Number);
      let diffMins = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMins < 0) {
        // Asumir que termina al día siguiente o valor nulo si es menor
        diffMins = 0;
      }
      const rawHours = diffMins / 60;
      // Redondear a la fracción de 30 minutos más cercana
      const rounded = Math.round(rawHours * 2) / 2;
      this.hours = Math.max(0.5, Math.min(24.0, rounded));
    }
  }

  private calculateEndTime(start: string, hours: number): string {
    const [sh, sm] = start.split(':').map(Number);
    const totalMins = (sh * 60 + sm) + (hours * 60);
    const eh = Math.floor(totalMins / 60) % 24;
    const em = Math.floor(totalMins % 60);
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  }

  adjustHours(delta: number): void {
    const next = Math.round((this.hours + delta) * 2) / 2;
    if (next >= 0.5 && next <= 24) {
      this.hours = next;
      if (this.startTime) {
        this.endTime = this.calculateEndTime(this.startTime, this.hours);
      }
    }
  }

  async save(): Promise<void> {
    if (!this.isValidForm()) return;

    const loading = await this.loadingCtrl.create({
      message: this.translate.instant('COMMON.SAVING') || 'Guardando…',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const client = await this.dbService.clientRepo.findOneBy({ id: this.selectedClientId });
      const service = await this.dbService.serviceRepo.findOneBy({ id: this.selectedServiceId });
      if (!client || !service) return;

      let log: WorkLog;
      if (this.isEdit && this.editingLogId) {
        const existing = await this.dbService.workLogRepo.findOneBy({ id: this.editingLogId });
        log = existing || this.dbService.workLogRepo.create();
      } else {
        log = this.dbService.workLogRepo.create();
      }

      log.workDate = this.workDate;
      log.client = client;
      log.service = service;
      log.hours = this.hours;
      log.startTime = this.startTime || undefined;
      log.endTime = this.endTime || undefined;
      log.notes = this.notes.trim() || undefined;
      log.isPaid = this.isPaid;
      log.paymentType = this.isPaid ? this.paymentType : undefined;

      await this.dbService.workLogRepo.save(log);
      this.hasSavedChanges = true;
      await this.dbService.notifyWorkLogsChanged();
      this.syncManager.syncInBackground();

      await this.loadDateLogs();
      this.activeTab = 'list';
    } catch (err) {
      console.error('Error saving work log:', err);
    } finally {
      await loading.dismiss();
    }
  }

  dismiss(): void {
    this.modalCtrl.dismiss({ saved: this.hasSavedChanges });
  }
}
