import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import type { Client } from './client.entity';
import type { Service } from './service.entity';

@Entity('work_logs')
@Check('"hours" >= 0.5 AND "hours" <= 24.0')
export class WorkLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  workDate!: string; // ISO format YYYY-MM-DD

  @ManyToOne('Client', (client: Client) => client.workLogs, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @ManyToOne('Service', (service: Service) => service.workLogs, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'service_id' })
  service!: Service;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: false })
  hours!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
