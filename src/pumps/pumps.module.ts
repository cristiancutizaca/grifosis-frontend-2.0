import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PumpsService } from './pumps.service';
import { PumpsController } from './pumps.controller';
import { Pump } from './entities/pump.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pump])],
  controllers: [PumpsController],
  providers: [PumpsService],
  exports: [PumpsService],
})
export class PumpsModule {}
