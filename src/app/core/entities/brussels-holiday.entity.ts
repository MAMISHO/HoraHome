import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('brussels_holidays')
export class BrusselsHoliday {
  @PrimaryColumn({ type: 'varchar' })
  holidayDate!: string; // ISO format YYYY-MM-DD

  @Column({ type: 'varchar', nullable: false })
  nameFr!: string;

  @Column({ type: 'varchar', nullable: false })
  nameNl!: string;

  @Column({ type: 'integer', nullable: false })
  year!: number;

  @Column({ type: 'boolean', default: true })
  isWorkingDay!: boolean; // Only working days (Mon-Fri / replacement working days)
}
