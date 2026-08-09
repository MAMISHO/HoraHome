import { Component, OnInit } from '@angular/core';
import { ModalController, ViewWillEnter } from '@ionic/angular';
import { ChartData, ChartOptions } from 'chart.js';
import { DatabaseService } from '../core/services/database.service';
import { LanguageService } from '../core/services/language.service';
import { BrusselsHoliday } from '../core/entities/brussels-holiday.entity';
import { WorkLogModalComponent } from '../shared/components/work-log-modal/work-log-modal.component';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit, ViewWillEnter {
  monthlyHours = 0;
  monthDiff = 0;

  unpaidHours = 0;
  unpaidEarnings = 0;
  paidHours = 0;
  paidEarnings = 0;
  cashHours = 0;
  checkHours = 0;

  topClientName = '';
  topClientHours = 0;

  nextHoliday: BrusselsHoliday | null = null;
  nextHolidayName = '';

  hasChartData = false;
  donutChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#3880ff', '#52de97', '#ffc409', '#eb445a'] }],
  };

  chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
    },
  };

  constructor(
    private dbService: DatabaseService,
    private langService: LanguageService,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadDashboardData();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    if (!this.dbService.isReady()) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
    const endOfLastMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    // 1. Current Month Work Logs
    const currentLogs = await this.dbService.workLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.client', 'client')
      .leftJoinAndSelect('log.service', 'service')
      .where('log.workDate >= :start AND log.workDate <= :end', {
        start: startOfMonth,
        end: endOfMonth,
      })
      .getMany();

    this.monthlyHours = currentLogs.reduce((sum, log) => sum + Number(log.hours), 0);

    // Payment breakdown
    const unpaid = currentLogs.filter(l => !l.isPaid);
    this.unpaidHours = Math.round(unpaid.reduce((s, l) => s + Number(l.hours), 0) * 10) / 10;
    this.unpaidEarnings = Math.round(unpaid.reduce((s, l) => s + Number(l.hours) * (Number(l.client.hourlyRate) || 0), 0) * 100) / 100;

    const paid = currentLogs.filter(l => l.isPaid);
    this.paidHours = Math.round(paid.reduce((s, l) => s + Number(l.hours), 0) * 10) / 10;
    this.paidEarnings = Math.round(paid.reduce((s, l) => s + Number(l.hours) * (Number(l.client.hourlyRate) || 0), 0) * 100) / 100;

    this.cashHours = Math.round(paid.filter(l => l.paymentType === 'cash').reduce((s, l) => s + Number(l.hours), 0) * 10) / 10;
    this.checkHours = Math.round(paid.filter(l => l.paymentType === 'check').reduce((s, l) => s + Number(l.hours), 0) * 10) / 10;

    // 2. Last Month Work Logs
    const lastLogs = await this.dbService.workLogRepo
      .createQueryBuilder('log')
      .where('log.workDate >= :start AND log.workDate <= :end', {
        start: startOfLastMonth,
        end: endOfLastMonth,
      })
      .getMany();

    const lastMonthHours = lastLogs.reduce((sum, log) => sum + Number(log.hours), 0);
    this.monthDiff = Math.round((this.monthlyHours - lastMonthHours) * 10) / 10;

    // 3. Top Client
    const clientHoursMap = new Map<string, { name: string; hours: number }>();
    currentLogs.forEach((log) => {
      const existing = clientHoursMap.get(log.client.id) || { name: log.client.name, hours: 0 };
      existing.hours += Number(log.hours);
      clientHoursMap.set(log.client.id, existing);
    });

    let topClient = { name: '', hours: 0 };
    clientHoursMap.forEach((val) => {
      if (val.hours > topClient.hours) {
        topClient = val;
      }
    });
    this.topClientName = topClient.name;
    this.topClientHours = Math.round(topClient.hours * 10) / 10;

    // 4. Next Brussels Holiday
    const todayIso = now.toISOString().split('T')[0];
    const upcoming = await this.dbService.holidayRepo
      .createQueryBuilder('h')
      .where('h.holidayDate >= :today', { today: todayIso })
      .orderBy('h.holidayDate', 'ASC')
      .getOne();

    if (upcoming) {
      this.nextHoliday = upcoming;
      const lang = this.langService.getCurrentLanguage();
      this.nextHolidayName = lang === 'en' ? upcoming.nameNl : upcoming.nameFr;
    }

    // 5. Donut Chart Breakdown by Service
    const serviceHoursMap = new Map<string, number>();
    currentLogs.forEach((log) => {
      const current = serviceHoursMap.get(log.service.name) || 0;
      serviceHoursMap.set(log.service.name, current + Number(log.hours));
    });

    const labels: string[] = [];
    const data: number[] = [];
    serviceHoursMap.forEach((hrs, sName) => {
      labels.push(sName);
      data.push(hrs);
    });

    this.hasChartData = data.length > 0 && data.some((v) => v > 0);
    this.donutChartData = {
      labels,
      datasets: [{ data, backgroundColor: ['#3880ff', '#52de97', '#ffc409', '#eb445a'] }],
    };
  }

  async openQuickLogModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: WorkLogModalComponent,
      breakpoints: [0, 0.75, 1.0],
      initialBreakpoint: 0.75,
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.saved) {
      await this.loadDashboardData();
    }
  }
}
