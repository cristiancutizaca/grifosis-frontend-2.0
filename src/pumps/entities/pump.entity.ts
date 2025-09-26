import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Nozzle } from '../../nozzles/entities/nozzle.entity';
import { PumpTank } from 'src/PumpsTanks/entities/pump-tank.entity';

@Entity('pumps')
export class Pump {
  @PrimaryGeneratedColumn('increment')
  pump_id: number;

  @Column({ type: 'varchar', nullable: false })
  pump_number: string;

  @Column({ type: 'varchar', nullable: false })
  pump_name: string;

  @Column({ type: 'text', nullable: true })
  location_description: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at: Date;

  // Relación: Un dispensador puede tener muchas boquillas
  @OneToMany(() => Nozzle, (nozzle) => nozzle.pump)
  nozzles: Nozzle[];

  @OneToMany(() => PumpTank, (pumpTank) => pumpTank.pump)
  tankConnections: PumpTank[];
}
