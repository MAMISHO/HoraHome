import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AlertController, ToastController, ModalController, ActionSheetController, ViewWillEnter } from '@ionic/angular';
import { Share } from '@capacitor/share';
import { TranslateService } from '@ngx-translate/core';
import { DatabaseService } from '../core/services/database.service';
import { LanguageService } from '../core/services/language.service';
import { WorkLog } from '../core/entities/work-log.entity';
import { Client } from '../core/entities/client.entity';
import { WorkLogModalComponent } from '../shared/components/work-log-modal/work-log-modal.component';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit, ViewWillEnter, OnDestroy {
  private dbSub?: Subscription;
  allLogs: WorkLog[] = [];
  filteredLogs: WorkLog[] = [];
  clients: Client[] = [];

  searchQuery = '';
  filterClientId = '';

  // Filtros de Fecha
  filterPeriodType: 'month' | 'custom' | 'all' = 'month';
  selectedMonthDate = new Date();
  customStartDate = new Date().toISOString().split('T')[0];
  customEndDate = new Date().toISOString().split('T')[0];
  totalHoursFiltered = 0;
  isLoading = false;

  private undoTimer: any = null;
  private pendingDeleteLog: WorkLog | null = null;

  constructor(
    private dbService: DatabaseService,
    private langService: LanguageService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private actionSheetCtrl: ActionSheetController,
    private translate: TranslateService
  ) {}

  get currentLang(): string {
    return this.langService.getCurrentLanguage();
  }

  get selectedMonthLabel(): string {
    const lang = this.currentLang;
    const monthsEs = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthsEn = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthsFr = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    let months = monthsEs;
    if (lang === 'en') months = monthsEn;
    else if (lang === 'fr') months = monthsFr;

    const monthName = months[this.selectedMonthDate.getMonth()];
    const year = this.selectedMonthDate.getFullYear();
    return `${monthName} ${year}`;
  }

  prevMonth(): void {
    const current = this.selectedMonthDate;
    this.selectedMonthDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    this.filterLogs();
  }

  nextMonth(): void {
    const current = this.selectedMonthDate;
    this.selectedMonthDate = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    this.filterLogs();
  }

  onMonthYearSelected(event: any): void {
    const val = event.detail.value;
    if (val) {
      this.selectedMonthDate = new Date(val);
      this.filterLogs();
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadLogs();
    this.dbSub = this.dbService.workLogsChanged$.subscribe(() => {
      this.loadLogs();
    });
  }

  ngOnDestroy(): void {
    this.dbSub?.unsubscribe();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadLogs();
  }

  async loadLogs(): Promise<void> {
    if (!this.dbService.isReady()) return;

    this.isLoading = true;
    try {
      // Breve retraso artificial para asegurar que el skeleton sea apreciable por el usuario
      await new Promise(resolve => setTimeout(resolve, 400));

      this.clients = await this.dbService.clientRepo.find({ order: { name: 'ASC' } });

      this.allLogs = await this.dbService.workLogRepo
        .createQueryBuilder('log')
        .leftJoinAndSelect('log.client', 'client')
        .leftJoinAndSelect('log.service', 'service')
        .orderBy('log.workDate', 'DESC')
        .addOrderBy('log.createdAt', 'DESC')
        .getMany();

      this.filterLogs();
    } finally {
      this.isLoading = false;
    }
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

    // Filtro por Fecha
    if (this.filterPeriodType === 'month') {
      const range = this.getMonthRange(this.selectedMonthDate);
      result = result.filter(
        (l) => l.workDate >= range.startDate && l.workDate <= range.endDate
      );
    } else if (this.filterPeriodType === 'custom') {
      result = result.filter(
        (l) => l.workDate >= this.customStartDate && l.workDate <= this.customEndDate
      );
    }

    this.filteredLogs = result;
    this.totalHoursFiltered = Math.round(this.filteredLogs.reduce((sum, l) => sum + Number(l.hours), 0) * 10) / 10;
  }

  async editLog(log: WorkLog): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: WorkLogModalComponent,
      componentProps: { workLog: log },
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
      await this.dbService.notifyWorkLogsChanged();
    }
  }

  private getMonthRange(date: Date): { startDate: string; endDate: string } {
    const year = date.getFullYear();
    const month = date.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // Last day of month
    
    const format = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const r = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${r}`;
    };
    
    return {
      startDate: format(start),
      endDate: format(end)
    };
  }

  private formatDateShort(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  private getShareTranslation(key: string, lang: string): string {
    const dict: { [lang: string]: { [key: string]: string } } = {
      es: {
        HEADER: '📊 RESUMEN DE TRABAJO',
        CLIENT: '👤 Cliente :',
        ALL_CLIENTS: '👤 Clientes : Todos los clientes',
        PERIOD: '📅 Período :',
        DETAIL_HEADER: '📝 DETALLE DIARIO',
        TOTAL: '⏱️ TOTAL :',
        PERIOD_ALL: 'Todo'
      },
      fr: {
        HEADER: '📊 RÉSUMÉ DU TRAVAIL',
        CLIENT: '👤 Client :',
        ALL_CLIENTS: '👤 Clients : Tous les clients',
        PERIOD: '📅 Période :',
        DETAIL_HEADER: '📝 DÉTAIL QUOTIDIEN',
        TOTAL: '⏱️ TOTAL :',
        PERIOD_ALL: 'Tout'
      },
      en: {
        HEADER: '📊 WORK SUMMARY',
        CLIENT: '👤 Client :',
        ALL_CLIENTS: '👤 Clients: All clients',
        PERIOD: '📅 Period :',
        DETAIL_HEADER: '📝 DAILY DETAIL',
        TOTAL: '⏱️ TOTAL :',
        PERIOD_ALL: 'All'
      }
    };
    return dict[lang]?.[key] || dict['es'][key] || key;
  }

  private getServiceTranslation(serviceName: string, lang: string): { name: string; emoji: string } {
    const emojiMap: { [name: string]: string } = {
      Cleaning: '🧹',
      Childcare: '👶',
      Cooking: '🍳',
      Ironing: '🧺'
    };
    const nameMap: { [lang: string]: { [name: string]: string } } = {
      es: { Cleaning: 'Limpieza', Childcare: 'Cuidado de niños', Ironing: 'Planchado', Cooking: 'Cocina' },
      fr: { Cleaning: 'Nettoyage', Childcare: "Garde d'enfants", Ironing: 'Repassage', Cooking: 'Cuisine' },
      en: { Cleaning: 'Cleaning', Childcare: 'Childcare', Ironing: 'Ironing', Cooking: 'Cooking' }
    };

    const emoji = emojiMap[serviceName] || '📋';
    const translatedName = nameMap[lang]?.[serviceName] || serviceName;
    return { name: translatedName, emoji };
  }

  private formatLogDateForShare(dateStr: string, lang: string = this.currentLang): string {
    const date = new Date(dateStr + 'T00:00:00');
    const daysEs = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    
    let days = daysEs;
    if (lang === 'en') days = daysEn;
    else if (lang === 'fr') days = daysFr;
    
    const dayName = days[date.getDay()];
    const [, month, day] = dateStr.split('-');
    return `${dayName} ${day}/${month}`;
  }

  async shareLogs(): Promise<void> {
    if (this.filteredLogs.length === 0) return;

    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('WORK_LOGS.SELECT_SHARE_ACTION') || 'Compartir historial de trabajo',
      buttons: [
        {
          text: '🇫🇷 Français',
          handler: () => {
            this.executeShare('fr');
          }
        },
        {
          text: '🇪🇸 Español',
          handler: () => {
            this.executeShare('es');
          }
        },
        {
          text: '🇬🇧 English',
          handler: () => {
            this.executeShare('en');
          }
        },
        {
          text: `📋 ${this.translate.instant('WORK_LOGS.SHARE_COPY') || 'Copiar al portapapeles'}`,
          handler: () => {
            const text = this.generateShareText(this.currentLang);
            this.copyToClipboard(text);
          }
        },
        {
          text: this.translate.instant('WORK_LOGS.CANCEL') || 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async executeShare(lang: string): Promise<void> {
    if (this.filteredLogs.length === 0) return;
    const text = this.generateShareText(lang);

    try {
      await Share.share({
        title: this.translate.instant('WORK_LOGS.SHARE_TITLE') || 'Resumen de Horas',
        text: text,
        dialogTitle: 'Compartir resumen de trabajo'
      });
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        await this.copyToClipboard(text);
      }
    }
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      const toast = await this.toastCtrl.create({
        message: this.translate.instant('WORK_LOGS.COPIED_TO_CLIPBOARD') || 'Copiado al portapapeles',
        duration: 3000,
        color: 'success'
      });
      await toast.present();
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  }

  generateShareText(targetLang: string = this.currentLang): string {
    const header = this.getShareTranslation('HEADER', targetLang);
    const clientLabel = this.getShareTranslation('CLIENT', targetLang);
    const periodLabel = this.getShareTranslation('PERIOD', targetLang);
    const detailHeader = this.getShareTranslation('DETAIL_HEADER', targetLang);
    const totalLabel = this.getShareTranslation('TOTAL', targetLang);

    let periodRangeStr = '';
    if (this.filterPeriodType === 'month') {
      const range = this.getMonthRange(this.selectedMonthDate);
      periodRangeStr = `${this.formatDateShort(range.startDate)} – ${this.formatDateShort(range.endDate)}`;
    } else if (this.filterPeriodType === 'custom') {
      periodRangeStr = `${this.formatDateShort(this.customStartDate)} – ${this.formatDateShort(this.customEndDate)}`;
    } else {
      periodRangeStr = this.getShareTranslation('PERIOD_ALL', targetLang);
    }

    let clientStr = '';
    if (this.filterClientId) {
      const clientName = this.clients.find(c => c.id === this.filterClientId)?.name || '';
      clientStr = `${clientLabel} ${clientName}`;
    } else {
      clientStr = this.getShareTranslation('ALL_CLIENTS', targetLang);
    }

    let text = `${header}\n`;
    text += `${clientStr}\n`;
    text += `${periodLabel} ${periodRangeStr}\n\n`;
    text += `──────────────────\n`;
    text += `${detailHeader}\n\n`;

    const sortedLogs = [...this.filteredLogs].sort((a, b) => a.workDate.localeCompare(b.workDate));

    // Agrupar registros cronológicamente por día (workDate)
    const dateGroups: { [dateStr: string]: WorkLog[] } = {};
    sortedLogs.forEach(log => {
      if (!dateGroups[log.workDate]) {
        dateGroups[log.workDate] = [];
      }
      dateGroups[log.workDate].push(log);
    });

    const dates = Object.keys(dateGroups);
    dates.forEach((dateStr, index) => {
      const dayLogs = dateGroups[dateStr];
      const formattedDate = this.formatLogDateForShare(dateStr, targetLang);
      
      if (index > 0) text += `\n`;
      text += `• **${formattedDate}**\n`;

      dayLogs.forEach(log => {
        const { name: serviceName, emoji } = this.getServiceTranslation(log.service.name, targetLang);
        const notes = log.notes ? ` (${log.notes})` : '';
        const clientExtra = (!this.filterClientId && log.client) ? ` [${log.client.name}]` : '';

        if (log.startTime && log.endTime) {
          text += `└ ⏰ ${log.startTime} – ${log.endTime} (${log.hours}h)${clientExtra} | ${emoji} ${serviceName}${notes}\n`;
        } else {
          text += `└ ⏰ ${log.hours}h${clientExtra} | ${emoji} ${serviceName}${notes}\n`;
        }
      });
    });

    text += `\n──────────────────\n`;
    text += `${totalLabel} ${this.totalHoursFiltered} h`;

    return text;
  }
}
