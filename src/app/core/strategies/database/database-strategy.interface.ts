import { DataSource } from 'typeorm';

export interface IDatabaseStrategy {
  createDataSource(): Promise<DataSource>;
}
