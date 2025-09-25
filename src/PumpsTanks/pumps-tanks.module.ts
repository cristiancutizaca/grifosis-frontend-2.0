import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PumpsTanksService } from './pumps-tanks.service';
import { PumpsTanksController } from './pumps-tanks.controller';
import { PumpTank } from './entities/pump-tank.entity';
import { Pump } from '../pumps/entities/pump.entity';
import { Tank } from '../tanks/entities/tank.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pump, Tank, PumpTank])],
  controllers: [PumpsTanksController],
  providers: [PumpsTanksService],
  exports: [PumpsTanksService],
})
export class PumpsTanksModule {}
