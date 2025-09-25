import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TanksService } from './tanks.service';
import { TanksController } from './tanks.controller';
import { Tank } from './entities/tank.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tank])],
  controllers: [TanksController],
  providers: [TanksService],
})
export class TanksModule {}