import { Injectable, Inject } from '@angular/core';
import { DataSource, Repository } from 'typeorm';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { SQLJS_LOADER_TOKEN, SqlJsInitFunction } from '../tokens/database.tokens';
import { Client } from '../entities/client.entity';
import { Service } from '../entities/service.entity';
import { WorkLog } from '../entities/work-log.entity';
import { BrusselsHoliday } from '../entities/brussels-holiday.entity';
import {
  BRUSSELS_HOLIDAYS,
  SEED_SERVICES,
} from '../data/seed-data';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private dataSource!: DataSource;
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);

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
        // En entorno web, obtenemos la función initSqlJs inyectada por el token
        const initFn = await this.sqlJsLoader();
        const SQL = await initFn({
          locateFile: (file: string) => `assets/${file}`,
        });

        (window as any).SQL = SQL;

        this.dataSource = new DataSource({
          type: 'sqljs',
          driver: SQL,
          location: 'db_horahome',
          autoSave: true,
          logging: false,
          synchronize: true,
          entities: [Client, Service, WorkLog, BrusselsHoliday],
        });
      } else {
        // En dispositivos móviles (Android / iOS), usamos el driver de CapacitorSQLite
        await this.sqlite.checkConnectionsConsistency().catch(() => {});

        this.dataSource = new DataSource({
          type: 'capacitor',
          driver: this.sqlite,
          database: 'db_horahome',
          mode: 'no-encryption',
          version: 1,
          logging: false,
          synchronize: true,
          entities: [Client, Service, WorkLog, BrusselsHoliday],
        });
      }

      await this.dataSource.initialize();
      await this.seedServices();
      await this.seedHolidays();
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
