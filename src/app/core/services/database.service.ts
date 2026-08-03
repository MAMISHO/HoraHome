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

  async closeConnection(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      console.log('[DatabaseService] Database connection closed.');
    }
  }

  async initialize(): Promise<void> {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      this.strategy = new WebDatabaseStrategy(this.sqlJsLoader);
    } else {
      this.strategy = new NativeDatabaseStrategy();
    }

    try {
      await this.closeConnection();
      // 1. Intentar inicializar SIN sincronización primero (ideal para verificar el estado de base de datos)
      this.dataSource = await this.strategy.createDataSource(false);
      await this.dataSource.initialize();

      // 2. Comprobar si las tablas principales existen
      const tablesExist = await this.checkIfTablesExist();

      if (!tablesExist) {
        console.log('[DatabaseService] Database is empty. Re-initializing with synchronize=true to build schema...');
        await this.closeConnection();
        // Espera de 100ms para asegurar la liberación del descriptor de archivo
        await new Promise((resolve) => setTimeout(resolve, 100));

        this.dataSource = await this.strategy.createDataSource(true);
        await this.dataSource.initialize();
      } else {
        console.log('[DatabaseService] Database tables exist. Checking schema updates...');
        // 3. Si ya existen, añadir las nuevas columnas de forma segura sin romper datos
        await this.runSchemaUpdates();
      }

      await this.seedServices();
      await this.seedHolidays();
      console.log(`[DatabaseService] Database successfully initialized on platform '${platform}'.`);
    } catch (error) {
      console.error('[DatabaseService] Critical initialization error:', error);
    }
  }

  private async checkIfTablesExist(): Promise<boolean> {
    try {
      // Consultar en sqlite_master si la tabla principal 'work_logs' ya existe
      const result = await this.dataSource.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='work_logs'"
      );
      return result && result.length > 0;
    } catch (e) {
      console.warn('[DatabaseService] Error checking tables existence:', e);
      return false;
    }
  }

  private async runSchemaUpdates(): Promise<void> {
    try {
      const tableInfo = await this.dataSource.query("PRAGMA table_info('work_logs')");
      const columns = Array.isArray(tableInfo) ? tableInfo.map((col: any) => col.name) : [];

      if (!columns.includes('startTime')) {
        await this.dataSource.query('ALTER TABLE work_logs ADD COLUMN startTime VARCHAR');
      }
      if (!columns.includes('endTime')) {
        await this.dataSource.query('ALTER TABLE work_logs ADD COLUMN endTime VARCHAR');
      }
      console.log('[DatabaseService] Schema updates verified/applied (startTime, endTime).');
    } catch (e) {
      console.warn('[DatabaseService] Schema updates warning:', e);
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
