import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NozzlesService } from './nozzles.service';
import { NozzlesController } from './nozzles.controller';
import { Nozzle } from './entities/nozzle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Nozzle])],
  controllers: [NozzlesController],
  providers: [NozzlesService],
})

export class NozzlesModule {}