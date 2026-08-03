import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx';
import { WorkLog } from '../entities/work-log.entity';

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  constructor(private translate: TranslateService) {}

  generateClientMonthExcel(clientName: string, year: string, month: string, workLogs: WorkLog[]): Blob {
    const titleText = `${this.translate.instant('CLIENTS.TITLE')}: ${clientName} — ${month}/${year}`;
    
    // Preparar filas del reporte
    const rows = workLogs.map((log) => {
      const serviceName = this.translate.instant(`SERVICES.${log.service.name}`);
      return {
        [this.translate.instant('CALENDAR.SELECT_DATE')]: log.workDate,
        [this.translate.instant('DASHBOARD.SERVICES_BREAKDOWN')]: serviceName,
        'Hora Inicio': log.startTime || '',
        'Hora Fin': log.endTime || '',
        [this.translate.instant('REPORTS.TOTAL_HOURS')]: Number(log.hours),
        [this.translate.instant('WORK_LOGS.SEARCH_PLACEHOLDER')]: log.notes || '',
      };
    });

    // Crear hoja de trabajo
    const ws = XLSX.utils.json_to_sheet(rows);

    // Ajustar anchos de columnas automáticamente
    const maxLens = rows.reduce((acc, row) => {
      Object.keys(row).forEach((key, idx) => {
        const valStr = String((row as any)[key] || '');
        const keyStr = String(key);
        const len = Math.max(valStr.length, keyStr.length);
        acc[idx] = Math.max(acc[idx] || 10, len);
      });
      return acc;
    }, [] as number[]);
    ws['!cols'] = maxLens.map((w) => ({ wch: w + 2 }));

    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horas Trabajadas');

    // Generar buffer binario
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    return new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}
