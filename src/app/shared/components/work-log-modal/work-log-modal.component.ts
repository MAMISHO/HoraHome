import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
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

  isEdit = false;
  workDate = new Date().toISOString().split('T')[0];
  selectedClientId = '';
  selectedServiceId = '';
  hours = 4.0;
  notes = '';

  isHoliday = false;
  holidayName = '';

  activeClients: Client[] = [];
  services: Service[] = [];

  constructor(
    private modalCtrl: ModalController,
    private dbService: DatabaseService,
    private langService: LanguageService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadClientsAndServices();

    if (this.workLog) {
      this.isEdit = true;
      this.workDate = this.workLog.workDate;
      this.selectedClientId = this.workLog.client.id;
      this.selectedServiceId = this.workLog.service.id;
      this.hours = Number(this.workLog.hours);
      this.notes = this.workLog.notes || '';
    } else {
      if (this.initialDate) {
        this.workDate = this.initialDate;
      }
      if (this.initialClientId) {
        this.selectedClientId = this.initialClientId;
      } else if (this.activeClients.length > 0) {
        this.selectedClientId = this.activeClients[0].id;
      }
      if (this.services.length > 0) {
        this.selectedServiceId = this.services[0].id;
      }
    }

    await this.checkHoliday();
  }

  async loadClientsAndServices(): Promise<void> {
    if (this.dbService.isReady()) {
      this.activeClients = await this.dbService.clientRepo.findBy({ isActive: true });
      this.services = await this.dbService.serviceRepo.find();
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
    // Default service choice on client selection if not edit
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
    if (this.isEdit && this.workLog) {
      log = this.workLog;
    } else {
      log = this.dbService.workLogRepo.create();
    }

    log.workDate = this.workDate;
    log.client = client;
    log.service = service;
    log.hours = this.hours;
    log.notes = this.notes.trim() || undefined;

    const saved = await this.dbService.workLogRepo.save(log);
    this.modalCtrl.dismiss({ saved: true, workLog: saved });
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }
}
