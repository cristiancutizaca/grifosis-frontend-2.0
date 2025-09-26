import { Pump } from "../../pumps/entities/pump.entity";
import { Tank } from "../../tanks/entities/tank.entity";
import {
  Entity,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';

@Entity('pump_tank')
export class PumpTank {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Pump, (pump) => pump.tankConnections)
  @JoinColumn({ name: 'pump_id' })
  pump: Pump;

  @ManyToOne(() => Tank, (tank) => tank.pumpConnections)
  @JoinColumn({ name: 'tank_id' })
  tank: Tank;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
