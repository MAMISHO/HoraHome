import { Component, Input, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DatabaseService } from '../../../core/services/database.service';
import { Client } from '../../../core/entities/client.entity';
import { Service } from '../../../core/entities/service.entity';
import { WorkLog } from '../../../core/entities/work-log.entity';
import { LanguageService } from '../../../core/services/language.service';

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
  notes = '';

  isHoliday = false;
  holidayName = '';

  dateLogs: WorkLog[] = [];
  activeClients: Client[] = [];
  services: Service[] = [];

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private dbService: DatabaseService,
    public langService: LanguageService,
    private translate: TranslateService
  ) {}

  get currentLang(): string {
    return this.langService.getCurrentLanguage();
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
    this.notes = log.notes || '';
  }

  resetForm(): void {
    this.isEdit = false;
    this.editingLogId = null;
    if (this.initialClientId) {
      this.selectedClientId = this.initialClientId;
    } else if (this.activeClients.length > 0) {
      this.selectedClientId = this.activeClients[0].id;
    }
    if (this.services.length > 0) {
      this.selectedServiceId = this.services[0].id;
    }
    this.hours = 4.0;
    this.notes = '';
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

  adjustHours(delta: number): void {
    const next = Math.round((this.hours + delta) * 2) / 2;
    if (next >= 0.5 && next <= 24) {
      this.hours = next;
    }
  }

  async save(): Promise<void> {
    if (!this.selectedClientId || !this.selectedServiceId) return;

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
    log.notes = this.notes.trim() || undefined;

    await this.dbService.workLogRepo.save(log);
    this.hasSavedChanges = true;

    await this.loadDateLogs();
    this.activeTab = 'list';
  }

  dismiss(): void {
    this.modalCtrl.dismiss({ saved: this.hasSavedChanges });
  }
}
