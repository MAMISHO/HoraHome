import { DataSource } from 'typeorm';

export interface IDatabaseStrategy {
  createDataSource(synchronize?: boolean): Promise<DataSource>;
}
