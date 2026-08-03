import { Injectable, Inject } from '@angular/core';
import { DataSource, Repository } from 'typeorm';
import { Capacitor } from '@capacitor/core';
import { SQLJS_LOADER_TOKEN, SqlJsInitFunction } from '../tokens/database.tokens';
import { Client } from '../entities/client.entity';
import { Service } from '../entities/service.entity';
import { WorkLog } from '../entities/work-log.entity';
import { BrusselsHoliday } from '../entities/brussels-holiday.entity';
import { BRUSSELS_HOLIDAYS, SEED_SERVICES } from '../data/seed-data';
import { IDatabaseStrategy } from '../strategies/database/database-strategy.interface';
import { WebDatabaseStrategy } from '../strategies/database/web-database.strategy';
import { NativeDatabaseStrategy } from '../strategies/database/native-database.strategy';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private dataSource!: DataSource;
  private strategy!: IDatabaseStrategy;

  constructor(
    @Inject(SQLJS_LOADER_TOKEN) private sqlJsLoader: () => Promise<SqlJsInitFunction>
  ) {}

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
    try {
      const platform = Capacitor.getPlatform();

      if (platform === 'web') {
        this.strategy = new WebDatabaseStrategy(this.sqlJsLoader);
      } else {
        this.strategy = new NativeDatabaseStrategy();
      }

      this.dataSource = await this.strategy.createDataSource();
      await this.dataSource.initialize();
      await this.seedServices();
      await this.seedHolidays();
      console.log(`[DatabaseService] Database successfully initialized on platform '${platform}'.`);
    } catch (error) {
      console.error('[DatabaseService] Initialization error:', error);
    }
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
    for (const h of BRUSSELS_HOLIDAYS) {
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
