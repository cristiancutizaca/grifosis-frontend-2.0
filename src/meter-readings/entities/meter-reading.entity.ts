import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Nozzle } from '../../nozzles/entities/nozzle.entity';

@Entity('meter_readings')
export class MeterReading {
    @PrimaryGeneratedColumn()
    reading_id: number;

    @Column()
    nozzle_id: number;

    @Column('numeric', { precision: 12, scale: 2 })
    initial_reading: number;

    @Column('numeric', { precision: 12, scale: 2 })
    final_reading: number;

    @Column('numeric', { precision: 12, scale: 2, nullable: true })
    total_dispensed: number;

    @Column()
    user_id: number;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', nullable: true })
    updated_at: Date;

    @ManyToOne(() => Nozzle, (nozzle) => nozzle.meterReadings, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'nozzle_id' })
    nozzle: Nozzle;

    @ManyToOne(() => User, (user) => user.meterReadings, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}