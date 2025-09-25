import { Module } from '@nestjs/common';
import { MeterReadingsService } from './meter-readings.service';
import { MeterReadingsController } from './meter-readings.controller';
import { Nozzle } from '../nozzles/entities/nozzle.entity';
import { User } from '../users/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeterReading } from './entities/meter-reading.entity';
import { SettingsModule } from 'src/settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MeterReading, Nozzle, User]),
    SettingsModule,
  ],
  controllers: [MeterReadingsController],
  providers: [MeterReadingsService],
})
export class MeterReadingsModule {}
