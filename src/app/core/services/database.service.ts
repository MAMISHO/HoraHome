import { Injectable } from '@angular/core';
import { DataSource, Repository } from 'typeorm';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Client } from '../entities/client.entity';
import { Service } from '../entities/service.entity';
import { WorkLog } from '../entities/work-log.entity';
import { BrusselsHoliday } from '../entities/brussels-holiday.entity';
import {
  BRUSSELS_HOLIDAYS_2026,
  BRUSSELS_HOLIDAYS_2027,
  SEED_SERVICES,
} from '../data/seed-data';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private dataSource!: DataSource;
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);

  get clientRepo(): Repository<Client> {
    return this.dataSource.getRepository(Client);
  }

  get serviceRepo(): Repository<Service> {
    return this.dataSource.getRepository(Service);
  }

  get workLogRepo(): Repository<WorkLog> {
    return this.dataSource.getRepository(WorkLog);
  }

  get holidayRepo(): Repository<BrusselsHoliday> {
    return this.dataSource.getRepository(BrusselsHoliday);
  }

  async initialize(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      // For web/testing: use sqljs driver (not for production)
      console.warn('[DatabaseService] Running on web — SQLite not available');
      return;
    }

    await this.sqlite.checkConnectionsConsistency().catch(() => {});

    this.dataSource = new DataSource({
      type: 'capacitor',
      driver: this.sqlite,
      database: 'db_horahome',
      mode: 'no-encryption',
      version: 1,
      logging: false,
      synchronize: true, // auto-create/update tables from entities
      entities: [Client, Service, WorkLog, BrusselsHoliday],
    });

    await this.dataSource.initialize();
    await this.seedServices();
    await this.seedHolidays();
  }

  private async seedServices(): Promise<void> {
    const count = await this.serviceRepo.count();
    if (count > 0) return;

    for (const s of SEED_SERVICES) {
      const service = this.serviceRepo.create({ name: s.name });
      await this.serviceRepo.save(service);
    }
  }

  private async seedHolidays(): Promise<void> {
    const currentYear = new Date().getFullYear();
    const holidays = [
      ...(currentYear === 2026 ? BRUSSELS_HOLIDAYS_2026 : []),
      ...(currentYear === 2027 ? BRUSSELS_HOLIDAYS_2027 : []),
      ...BRUSSELS_HOLIDAYS_2026, // always ensure 2026 is seeded
    ];

    for (const h of holidays) {
      const existing = await this.holidayRepo.findOneBy({ holidayDate: h.holidayDate });
      if (!existing) {
        const holiday = this.holidayRepo.create(h);
        await this.holidayRepo.save(holiday);
      }
    }
  }

  isReady(): boolean {
    return this.dataSource?.isInitialized ?? false;
  }
}
