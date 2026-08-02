import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController, ModalController, ViewWillEnter } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DatabaseService } from '../core/services/database.service';
import { WorkLog } from '../core/entities/work-log.entity';
import { Client } from '../core/entities/client.entity';
import { WorkLogModalComponent } from '../shared/components/work-log-modal/work-log-modal.component';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit, ViewWillEnter {
  allLogs: WorkLog[] = [];
  filteredLogs: WorkLog[] = [];
  clients: Client[] = [];

  searchQuery = '';
  filterClientId = '';

  private undoTimer: any = null;
  private pendingDeleteLog: WorkLog | null = null;

  constructor(
    private dbService: DatabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private translate: TranslateService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadLogs();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadLogs();
  }

  async loadLogs(): Promise<void> {
    if (!this.dbService.isReady()) return;

    this.clients = await this.dbService.clientRepo.find({ order: { name: 'ASC' } });

    this.allLogs = await this.dbService.workLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.client', 'client')
      .leftJoinAndSelect('log.service', 'service')
      .orderBy('log.workDate', 'DESC')
      .addOrderBy('log.createdAt', 'DESC')
      .getMany();

    this.filterLogs();
  }

  filterLogs(): void {
    let result = [...this.allLogs];

    // Exclude pending delete item from UI
    if (this.pendingDeleteLog) {
      result = result.filter((l) => l.id !== this.pendingDeleteLog?.id);
    }

    if (this.filterClientId) {
      result = result.filter((l) => l.client.id === this.filterClientId);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.notes?.toLowerCase().includes(q) ||
          l.client.name.toLowerCase().includes(q) ||
          l.service.name.toLowerCase().includes(q)
      );
    }

    this.filteredLogs = result;
  }

  async editLog(log: WorkLog): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: WorkLogModalComponent,
      componentProps: { workLog: log },
      breakpoints: [0, 0.75, 1.0],
      initialBreakpoint: 0.75,
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.saved) {
      await this.loadLogs();
    }
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
          handler: () => {
            this.executeSoftDeleteWithUndo(log);
          },
        },
      ],
    });

    await alert.present();
  }

  private async executeSoftDeleteWithUndo(log: WorkLog): Promise<void> {
    // If there is a previous pending deletion, commit it now
    if (this.pendingDeleteLog) {
      await this.commitPhysicalDelete(this.pendingDeleteLog);
    }

    this.pendingDeleteLog = log;
    this.filterLogs();

    const toast = await this.toastCtrl.create({
      message: this.translate.instant('WORK_LOGS.DELETED'),
      duration: 4000,
      color: 'dark',
      buttons: [
        {
          text: this.translate.instant('WORK_LOGS.UNDO'),
          role: 'cancel',
          handler: () => {
            // Cancel deletion & restore log item in list
            if (this.undoTimer) clearTimeout(this.undoTimer);
            this.pendingDeleteLog = null;
            this.filterLogs();
          },
        },
      ],
    });

    await toast.present();

    // Set 4-second timer to commit physical delete in SQLite
    this.undoTimer = setTimeout(async () => {
      if (this.pendingDeleteLog && this.pendingDeleteLog.id === log.id) {
        await this.commitPhysicalDelete(log);
        this.pendingDeleteLog = null;
      }
    }, 4000);
  }

  private async commitPhysicalDelete(log: WorkLog): Promise<void> {
    if (this.dbService.isReady()) {
      await this.dbService.workLogRepo.remove(log);
    }
  }
}
