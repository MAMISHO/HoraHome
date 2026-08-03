import { DataSource } from 'typeorm';
import { IDatabaseStrategy } from './database-strategy.interface';
import { SqlJsInitFunction } from '../../tokens/database.tokens';
import { Client } from '../../entities/client.entity';
import { Service } from '../../entities/service.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { BrusselsHoliday } from '../../entities/brussels-holiday.entity';

export class WebDatabaseStrategy implements IDatabaseStrategy {
  constructor(private sqlJsLoader: () => Promise<SqlJsInitFunction>) {}

  async createDataSource(): Promise<DataSource> {
    const initFn = await this.sqlJsLoader();
    const SQL = await initFn({
      locateFile: (file: string) => `assets/${file}`,
    });

    (window as any).SQL = SQL;

    return new DataSource({
      type: 'sqljs',
      driver: SQL,
      location: 'db_horahome',
      autoSave: true,
      logging: false,
      synchronize: true,
      entities: [Client, Service, WorkLog, BrusselsHoliday],
    });
  }
}
