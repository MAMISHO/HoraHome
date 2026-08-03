import { DataSource } from 'typeorm';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { IDatabaseStrategy } from './database-strategy.interface';
import { Client } from '../../entities/client.entity';
import { Service } from '../../entities/service.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { BrusselsHoliday } from '../../entities/brussels-holiday.entity';

export class NativeDatabaseStrategy implements IDatabaseStrategy {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);

  async createDataSource(): Promise<DataSource> {
    // Only check consistency; TypeORM's capacitor driver handles
    // createConnection and open internally via the SQLiteConnection driver.
    await this.sqlite.checkConnectionsConsistency().catch(() => {});

    return new DataSource({
      type: 'capacitor',
      driver: this.sqlite,
      database: 'db_horahome',
      mode: 'no-encryption',
      version: 1,
      logging: ['error', 'warn'],
      synchronize: true,
      entities: [Client, Service, WorkLog, BrusselsHoliday],
    });
  }
}

