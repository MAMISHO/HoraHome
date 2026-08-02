import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import type { WorkLog } from './work-log.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: false })
  name!: string;

  @OneToMany('WorkLog', (workLog: WorkLog) => workLog.service)
  workLogs!: WorkLog[];
}
