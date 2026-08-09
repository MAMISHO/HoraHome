import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModalController, ViewWillEnter } from '@ionic/angular';
import { DatabaseService } from '../core/services/database.service';
import { LanguageService } from '../core/services/language.service';
import { WorkLog } from '../core/entities/work-log.entity';
import { WorkLogModalComponent } from '../shared/components/work-log-modal/work-log-modal.component';

export interface CalendarDay {
  dateIso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isHoliday: boolean;
  isWorkingDayHoliday: boolean;
  holidayName?: string;
  totalHours: number;
  logs: WorkLog[];
}

function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, ViewWillEnter, OnDestroy {
  private dbSub?: Subscription;
  currentMonthDate = new Date();
  weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  calendarDays: CalendarDay[] = [];
  selectedDay: CalendarDay | null = null;
  minDate = '2025-01-01';

  constructor(
    private dbService: DatabaseService,
    private langService: LanguageService,
    private modalCtrl: ModalController
  ) {
    if (this.currentMonthDate.getFullYear() < 2025) {
      this.currentMonthDate = new Date(2025, 0, 1);
    }
  }

  get currentLang(): string {
    return this.langService.getCurrentLanguage();
  }

  async ngOnInit(): Promise<void> {
    await this.generateCalendar();
    this.dbSub = this.dbService.workLogsChanged$.subscribe(() => {
      this.generateCalendar();
    });
  }

  ngOnDestroy(): void {
    this.dbSub?.unsubscribe();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.generateCalendar();
  }

  changeMonth(delta: number): void {
    const nextDate = new Date(
      this.currentMonthDate.getFullYear(),
      this.currentMonthDate.getMonth() + delta,
      1
    );
    if (nextDate.getFullYear() < 2025) return;
    this.currentMonthDate = nextDate;
    this.generateCalendar();
  }

  changeYear(delta: number): void {
    const nextDate = new Date(
      this.currentMonthDate.getFullYear() + delta,
      this.currentMonthDate.getMonth(),
      1
    );
    if (nextDate.getFullYear() < 2025) return;
    this.currentMonthDate = nextDate;
    this.generateCalendar();
  }

  goToToday(): void {
    const today = new Date();
    this.currentMonthDate = today.getFullYear() < 2025 ? new Date(2025, 0, 1) : today;
    this.generateCalendar();
  }

  onMonthYearSelected(event: CustomEvent): void {
    const val = event.detail.value;
    if (val) {
      const parts = val.split('T')[0].split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        if (year >= 2025) {
          this.currentMonthDate = new Date(year, month, 1);
          this.generateCalendar();
        }
      }
    }
  }

  async generateCalendar(): Promise<void> {
    if (!this.dbService.isReady()) return;

    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();
    const todayIso = formatDateIso(new Date());

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const startDate = new Date(year, month, 1 - startDayOfWeek);
    const endDate = new Date(year, month + 1, 6 - lastDayOfMonth.getDay());

    const startDateIso = formatDateIso(startDate);
    const endDateIso = formatDateIso(endDate);

    const logs = await this.dbService.workLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.client', 'client')
      .leftJoinAndSelect('log.service', 'service')
      .where('log.workDate >= :start AND log.workDate <= :end', {
        start: startDateIso,
        end: endDateIso,
      })
      .getMany();

    const holidays = await this.dbService.holidayRepo
      .createQueryBuilder('h')
      .where('h.holidayDate >= :start AND h.holidayDate <= :end', {
        start: startDateIso,
        end: endDateIso,
      })
      .getMany();

    const holidayMap = new Map<string, { name: string; isWorkingDay: boolean }>();
    const lang = this.langService.getCurrentLanguage();
    holidays.forEach((h) => {
      holidayMap.set(h.holidayDate, {
        name: lang === 'en' ? h.nameNl : h.nameFr,
        isWorkingDay: h.isWorkingDay ?? true,
      });
    });

    const logsMap = new Map<string, WorkLog[]>();
    logs.forEach((log) => {
      const existing = logsMap.get(log.workDate) || [];
      existing.push(log);
      logsMap.set(log.workDate, existing);
    });

    const days: CalendarDay[] = [];
    const curr = new Date(startDate);

    while (curr <= endDate) {
      const dateIso = formatDateIso(curr);
      const dayLogs = logsMap.get(dateIso) || [];
      const totalHours = Math.round(dayLogs.reduce((sum, l) => sum + Number(l.hours), 0) * 10) / 10;
      
      const holidayInfo = holidayMap.get(dateIso);
      const isHoliday = !!holidayInfo;
      const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const isWorkingDayHoliday = isHoliday && isWeekday && (holidayInfo?.isWorkingDay ?? true);

      days.push({
        dateIso,
        dayNumber: curr.getDate(),
        isCurrentMonth: curr.getMonth() === month,
        isToday: dateIso === todayIso,
        isHoliday,
        isWorkingDayHoliday,
        holidayName: holidayInfo?.name,
        totalHours,
        logs: dayLogs,
      });

      curr.setDate(curr.getDate() + 1);
    }

    this.calendarDays = days;
    if (this.selectedDay) {
      this.selectedDay = days.find((d) => d.dateIso === this.selectedDay?.dateIso) || null;
    }
  }

  async onDayClick(day: CalendarDay): Promise<void> {
    this.selectedDay = day;
    await this.openLogModalForDate(day.dateIso);
  }

  async openLogModalForDate(dateIso: string): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: WorkLogModalComponent,
      componentProps: { initialDate: dateIso },
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.saved) {
      await this.generateCalendar();
    }
  }
}
